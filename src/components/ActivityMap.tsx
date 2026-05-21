import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { stravaService } from '../services/stravaService';
import { ActivityDetail } from '../services/database';

// Fix Leaflet default marker icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

interface StreamData {
  distance?: number[];
  latlng?: [number, number][];
  altitude?: number[];
  velocity_smooth?: number[];
  heartrate?: number[];
  cadence?: number[];
  watts?: number[];
}

interface RoutePoint {
  lat: number;
  lng: number;
  value: number;
}

interface MetricDef {
  key: string;
  label: string;
  unit: string;
  convert?: (v: number) => number;
  streamKey?: string;
}

interface TileLayerDef {
  id: string;
  name: string;
  url: string;
  attribution: string;
}

const TILE_LAYERS: TileLayerDef[] = [
  {
    id: 'osm',
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  {
    id: 'topo',
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
];

const METRICS: MetricDef[] = [
  { key: 'heartrate', label: 'Heart Rate', unit: 'bpm', streamKey: 'heartrate' },
  { key: 'speed', label: 'Speed', unit: 'km/h', convert: (v) => v * 3.6, streamKey: 'velocity_smooth' },
  { key: 'elevation', label: 'Elevation', unit: 'm', streamKey: 'altitude' },
  { key: 'watts', label: 'Power', unit: 'W', streamKey: 'watts' },
  { key: 'cadence', label: 'Cadence', unit: 'rpm', streamKey: 'cadence' },
];

const SAMPLE_COUNT = 200;
let tooltipInstance: L.Tooltip | null = null;
let lastValidPosition: [number, number] | null = null;

function FitMapToBounds({ bounds, onMapRef }: { bounds: [number, number][]; onMapRef: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapRef(map);
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [0.05, 0.05] });
    }
  }, [map, bounds, onMapRef]);
  return null;
}

function HoverTooltip({ position, content }: { position: [number, number] | null; content: string }) {
  const map = useMap();
  useEffect(() => {
    if (!tooltipInstance) {
      const initialPos = position || [0, 0];
      tooltipInstance = L.tooltip({ direction: 'top', offset: L.point(0, -10) });
      tooltipInstance.setLatLng(initialPos);
      tooltipInstance.setContent(content);
      tooltipInstance.setOpacity(0);
      tooltipInstance.addTo(map);
      lastValidPosition = initialPos;
    }
    if (!tooltipInstance) return;
    const pos = position || lastValidPosition;
    if (pos) {
      tooltipInstance.setLatLng(pos);
      tooltipInstance.setContent(content);
      tooltipInstance.setOpacity(0.95);
      lastValidPosition = pos;
    } else {
      tooltipInstance.setOpacity(0);
    }
  }, [map, position, content]);
  return null;
}

function colorFromValue(value: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return '#00ff00';

  const ratio = (value - min) / range;

  // Green (0) -> Yellow (0.5) -> Red (1)
  let r: number, g: number, b: number;
  if (ratio <= 0.5) {
    const t = ratio * 2;
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - t));
  } else {
    const t = (ratio - 0.5) * 2;
    r = 255;
    g = Math.round(255 * (1 - t));
    b = 0;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

const ActivityMap: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('heartrate');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTileLayer, setActiveTileLayer] = useState<string>('dark');
  const [mapHeight, setMapHeight] = useState<number>(600);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (id) {
      loadActivityDetail(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    const handleResize = () => {
      mapRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
  }, [mapHeight]);

  const loadActivityDetail = async (activityId: number) => {
    try {
      setLoading(true);
      setError(null);
      const detail = await stravaService.getActivityDetail(activityId);
      setActivity(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const routeData = useMemo(() => {
    if (!activity?.streams?.latlng) return null;

    const latlngs = activity.streams.latlng;
    if (latlngs.length === 0) return null;

    // Sample latlng to target count and capture the indices
    const sampledIndices: number[] = [];
    if (latlngs.length <= SAMPLE_COUNT) {
      for (let i = 0; i < latlngs.length; i++) {
        sampledIndices.push(i);
      }
    } else {
      const interval = Math.floor(latlngs.length / SAMPLE_COUNT);
      for (let i = 0; i < latlngs.length && sampledIndices.length < SAMPLE_COUNT; i += interval) {
        sampledIndices.push(i);
      }
    }

    const sampledLatLngs = sampledIndices.map((i) => latlngs[i]);

    // Determine which metrics are available
    const availableMetrics = METRICS.filter((m) => {
      const streamKey = m.streamKey || m.key;
      const stream = activity.streams?.[streamKey as keyof StreamData];
      return Array.isArray(stream) && stream.length > 0;
    });

    if (availableMetrics.length === 0) return null;

    // Build route points with metric values, using same indices for alignment
    const metricDef = METRICS.find((m) => m.key === selectedMetric);
    const streamKey = metricDef?.streamKey || metricDef?.key;
    const points: RoutePoint[] = sampledLatLngs.map((ll, i) => {
      const metricStream = activity.streams?.[streamKey as keyof StreamData] as number[] | undefined;
      let value = 0;
      if (metricStream) {
        const origIndex = sampledIndices[i];
        if (origIndex < metricStream.length) {
          value = metricStream[origIndex];
        } else {
          // Stream is shorter than latlng - use last available value
          value = metricStream[metricStream.length - 1];
        }
      }
      // Apply unit conversion if defined (e.g., m/s -> km/h for speed)
      if (metricDef?.convert) {
        value = metricDef.convert(value);
      }
      return { lat: ll[0], lng: ll[1], value };
    });

    // Calculate bounds
    const bounds: [number, number][] = sampledLatLngs.map((ll) => [ll[0], ll[1]]);

    // Calculate min/max for the selected metric
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Build segmented polylines
    const segments: { coords: [number, number][], color: string }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const avgValue = (points[i].value + points[i + 1].value) / 2;
      segments.push({
        coords: [
          [points[i].lat, points[i].lng],
          [points[i + 1].lat, points[i + 1].lng],
        ],
        color: colorFromValue(avgValue, min, max),
      });
    }

    return {
      points,
      bounds,
      segments,
      min,
      max,
      availableMetrics,
    };
  }, [activity, selectedMetric]);

  // Set default metric when activity loads
  useEffect(() => {
    if (activity?.streams) {
      const availableMetrics = METRICS.filter((m) => {
        const streamKey = m.streamKey || m.key;
        const stream = activity.streams?.[streamKey as keyof StreamData];
        return Array.isArray(stream) && stream.length > 0;
      });
      if (availableMetrics.length > 0) {
        const hrAvailable = availableMetrics.find((m) => m.key === 'heartrate');
        const defaultMetric = hrAvailable ? 'heartrate' : availableMetrics[0].key;
        setSelectedMetric(defaultMetric);
      }
    }
  }, [activity]);

  const handleMetricChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMetric(e.target.value);
  }, []);

  const handleTileLayerChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveTileLayer(e.target.value);
  }, []);

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
        <button onClick={() => navigate(`/activities/${id}`)} className="btn">
          Back to Activity
        </button>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="card">
        <div className="error">Activity not found</div>
        <button onClick={() => navigate('/activities')} className="btn">
          Back to Activities
        </button>
      </div>
    );
  }

  const hasLatLng = !!(activity.streams?.latlng && activity.streams.latlng.length > 0);

  if (!hasLatLng) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{activity.name}</h2>
            <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary">
              Back to Activity
            </button>
          </div>
        </div>
        <div className="card">
          <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
            No GPS data available for this activity
          </p>
        </div>
      </div>
    );
  }

  if (!routeData) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{activity.name}</h2>
            <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary">
              Back to Activity
            </button>
          </div>
        </div>
        <div className="card">
          <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
            No metric data available for heatmap visualization
          </p>
        </div>
      </div>
    );
  }

  const currentMetric = METRICS.find((m) => m.key === selectedMetric);
  const hoveredPoint = hoveredIndex !== null ? routeData.points[hoveredIndex] : null;
  const currentTileLayer = TILE_LAYERS.find((tl) => tl.id === activeTileLayer) || TILE_LAYERS[0];

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{activity.name}</h2>
            <p style={{ color: '#666', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              {activity.type} • {new Date(activity.start_date_local).toLocaleDateString()}
            </p>
          </div>
          <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary">
            Back to Activity
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Metric:</label>
            <select
              value={selectedMetric}
              onChange={handleMetricChange}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                minWidth: '150px',
              }}
            >
              {routeData.availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Map:</label>
            <select
              value={activeTileLayer}
              onChange={handleTileLayerChange}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                minWidth: '130px',
              }}
            >
              {TILE_LAYERS.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name}
                </option>
              ))}
            </select>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Height:</label>
             <input
               type="range"
               min="300"
               max="1000"
               step="50"
               value={mapHeight}
               onChange={(e) => setMapHeight(Number(e.target.value))}
               style={{ width: '100px' }}
             />
             <span style={{ fontSize: '0.85rem', minWidth: '45px' }}>{mapHeight}px</span>
           </div>

        </div>
      </div>

      {/* Map */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        <MapContainer
          ref={mapRef as any}
          center={routeData.bounds[0] || [0, 0]}
          zoom={13}
          style={{ width: '100%', height: `${mapHeight}px` }}
          worldCopyJump={true}
        >
          <TileLayer
            attribution={currentTileLayer.attribution}
            url={currentTileLayer.url}
          />
          <FitMapToBounds bounds={routeData.bounds} onMapRef={(m) => { mapRef.current = m; }} />

          {routeData.segments.map((seg, i) => (
             <Polyline
               key={i}
               positions={seg.coords}
               pathOptions={{ color: seg.color, weight: 8, opacity: 0.85 }}
               eventHandlers={{
                 mouseover: () => setHoveredIndex(i),
                 mouseout: () => setHoveredIndex(null),
               }}
             />
           ))}
           <HoverTooltip
           position={hoveredIndex !== null && routeData?.points[hoveredIndex] ? [routeData.points[hoveredIndex].lat, routeData.points[hoveredIndex].lng] : null}
           content={`${currentMetric?.label}: ${hoveredIndex !== null && routeData?.points[hoveredIndex] ? routeData.points[hoveredIndex].value.toFixed(1) : ''} ${currentMetric?.unit}`}
         />
        </MapContainer>
      </div>

      {/* Color Legend */}
      <div className="card">
        <h3 style={{ margin: '0 0 0.75rem' }}>
          {currentMetric?.label} ({currentMetric?.unit})
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', minWidth: '60px', textAlign: 'right' }}>
            {routeData.min.toFixed(1)}
          </span>
          <div
            style={{
              flex: 1,
              height: '20px',
              borderRadius: '4px',
              background: 'linear-gradient(to right, rgb(0, 255, 0), rgb(255, 255, 0), rgb(255, 0, 0))',
            }}
          />
          <span style={{ fontSize: '0.85rem', minWidth: '60px' }}>
            {routeData.max.toFixed(1)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#999' }}>Low</span>
          <span style={{ fontSize: '0.75rem', color: '#999' }}>High</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityMap;
