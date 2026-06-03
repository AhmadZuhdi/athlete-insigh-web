import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { stravaService } from '../services/stravaService';
import { ActivityDetail, Segment as SegmentDef } from '../services/database';
import { segmentService } from '../services/segmentService';
import { computeSegmentPolyline, computeSegmentStats } from '../services/segmentDetector';
import { useThemeColors } from '../context/ThemeContext';

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

function FitMapToBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [0.05, 0.05] });
    }
  }, [map, bounds]);
  return null;
}

function MapClickHandler({
  segmentMode,
  latlngs,
  onPointPicked,
}: {
  segmentMode: boolean;
  latlngs: [number, number][];
  onPointPicked: (index: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!segmentMode) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const clicked: [number, number] = [e.latlng.lat, e.latlng.lng];
      let closestIdx = 0;
      let closestDist = Infinity;

      for (let i = 0; i < latlngs.length; i++) {
        const dist = haversineDistance(clicked[0], clicked[1], latlngs[i][0], latlngs[i][1]);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestDist < 500) {
        onPointPicked(closestIdx);
      }
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [map, segmentMode, latlngs, onPointPicked]);

  return null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function HoverTooltip({ position, content }: { position: [number, number] | null; content: string }) {
  const map = useMap();
  const tooltipRef = useRef<L.Tooltip | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!tooltipRef.current) {
      const initialPos = position || [0, 0];
      tooltipRef.current = L.tooltip({ direction: 'top', offset: L.point(0, -10) });
      tooltipRef.current.setLatLng(initialPos);
      tooltipRef.current.setContent(content);
      tooltipRef.current.setOpacity(0);
      tooltipRef.current.addTo(map);
      lastPosRef.current = initialPos;
    }
    const pos = position || lastPosRef.current;
    if (pos && tooltipRef.current) {
      tooltipRef.current.setLatLng(pos);
      tooltipRef.current.setContent(content);
      tooltipRef.current.setOpacity(0.95);
      lastPosRef.current = pos;
    } else if (tooltipRef.current) {
      tooltipRef.current.setOpacity(0);
    }
  }, [map, position, content]);

  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, [map]);

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
  const colors = useThemeColors();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('heartrate');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTileLayer, setActiveTileLayer] = useState<string>('dark');
  const mapRef = useRef<L.Map | null>(null);

  const [segmentMode, setSegmentMode] = useState(false);
  const [segmentStartIdx, setSegmentStartIdx] = useState<number | null>(null);
  const [segmentEndIdx, setSegmentEndIdx] = useState<number | null>(null);
  const [segmentName, setSegmentName] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handlePointPicked = useCallback((index: number) => {
    if (segmentStartIdx === null) {
      setSegmentStartIdx(index);
    } else if (segmentEndIdx === null && index !== segmentStartIdx) {
      setSegmentEndIdx(index);
    }
  }, [segmentStartIdx]);

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
        <button onClick={() => navigate(`/activity/${id}`)} className="btn">
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'1rem' }}>
        <h2 style={{ margin:0 }}>{activity.name}</h2>
        <p style={{ color:'#666' }}>No GPS data available for this activity</p>
        <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary">Back to Activity</button>
      </div>
    );
  }

  if (!routeData) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'1rem' }}>
        <h2 style={{ margin:0 }}>{activity.name}</h2>
        <p style={{ color:'#666' }}>No metric data available for heatmap visualization</p>
        <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary">Back to Activity</button>
      </div>
    );
  }

  const currentMetric = METRICS.find((m) => m.key === selectedMetric);
  const currentTileLayer = TILE_LAYERS.find((tl) => tl.id === activeTileLayer) || TILE_LAYERS[0];

  return (
    <div>
      {/* Header overlay */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:1000, padding:'0.75rem 1rem', background:'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', pointerEvents:'none' }}>
        <div style={{ pointerEvents:'auto' }}>
          <h2 style={{ margin:0, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.8)', fontSize:'1.1rem' }}>{activity.name}</h2>
          <p style={{ margin:'0.15rem 0 0', fontSize:'0.8rem', color:'rgba(255,255,255,0.8)', textShadow:'0 1px 2px rgba(0,0,0,0.6)' }}>
            {activity.type} • {new Date(activity.start_date_local).toLocaleDateString()}
          </p>
        </div>
        <button onClick={() => navigate(`/activities/${id}`)} className="btn btn-secondary" style={{ pointerEvents:'auto', fontSize:'0.8rem', padding:'0.3rem 0.75rem', opacity:0.9 }}>
          ← Back
        </button>
      </div>

       {/* Selectors */}
       <div className="card" style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', zIndex:1000, marginBottom:0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Metric:</label>
            <select
              value={selectedMetric}
              onChange={handleMetricChange}
              style={{
                padding: '0.5rem',
                border: `1px solid ${colors.border}`,
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
                border: `1px solid ${colors.border}`,
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
              <button
                onClick={() => {
                  setSegmentMode(!segmentMode);
                  setSegmentStartIdx(null);
                  setSegmentEndIdx(null);
                  setSegmentName('');
                }}
                className={`btn ${segmentMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
                type="button"
              >
                {segmentMode ? 'Exit Segment' : 'Create Segment'}
              </button>
            </div>
        </div>
      </div>

      {/* Segment creation panel */}
      {segmentMode && (
        <div className="card" style={{ position:'absolute', top:'80px', right:'20px', zIndex:1000, padding:'1rem', minWidth:'250px', maxWidth:'350px' }}>
          <h3 style={{ margin:'0 0 0.5rem', fontSize:'1rem' }}>Create Segment</h3>
          {segmentStartIdx === null ? (
            <p style={{ fontSize:'0.85rem', color:'#888', margin:0 }}>Click on the route to set START point</p>
          ) : segmentEndIdx === null ? (
            <>
              <p style={{ fontSize:'0.85rem', color:'#22c55e', margin:'0 0 0.5rem' }}>Start point set ✓</p>
              <p style={{ fontSize:'0.85rem', color:'#888', margin:0 }}>Click on the route to set END point</p>
            </>
          ) : (
            <div>
              <p style={{ fontSize:'0.85rem', color:'#22c55e', margin:'0 0 0.5rem' }}>
                Start ✓ & End ✓
              </p>
              {activity?.streams?.latlng && (
                <div style={{ fontSize:'0.85rem', marginBottom:'0.75rem' }}>
                  <div>Distance: <strong>{(() => {
                    const stats = computeSegmentStats(
                      activity.streams!.latlng!,
                      activity.streams?.altitude,
                      segmentStartIdx!,
                      segmentEndIdx!
                    );
                    return `${stats.distanceKm} km`;
                  })()}</strong></div>
                  <div>Elevation gain: <strong>{(() => {
                    const stats = computeSegmentStats(
                      activity.streams!.latlng!,
                      activity.streams?.altitude,
                      segmentStartIdx!,
                      segmentEndIdx!
                    );
                    return `${stats.elevationGain} m`;
                  })()}</strong></div>
                </div>
              )}
              <input
                type="text"
                placeholder="Segment name..."
                value={segmentName}
                onChange={e => setSegmentName(e.target.value)}
                style={{
                  width: '100%', padding: '0.4rem', marginBottom: '0.5rem',
                  border: `1px solid ${colors.border}`, borderRadius: '4px',
                  fontSize: '0.85rem', boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={async () => {
                    if (!activity || !segmentName.trim() || segmentStartIdx === null || segmentEndIdx === null) return;
                    setSaving(true);
                    try {
                      const latlng = activity.streams!.latlng!;
                      const polyline = computeSegmentPolyline(latlng, segmentStartIdx, segmentEndIdx);
                      const stats = computeSegmentStats(latlng, activity.streams?.altitude, segmentStartIdx, segmentEndIdx);
                      await segmentService.createSegment({
                        name: segmentName.trim(),
                        activityId: activity.id,
                        startIndex: segmentStartIdx,
                        endIndex: segmentEndIdx,
                        distanceKm: stats.distanceKm,
                        elevationGain: stats.elevationGain,
                        polyline,
                        createdBy: 'custom-points',
                      });
                      setSegmentMode(false);
                      setSegmentStartIdx(null);
                      setSegmentEndIdx(null);
                      setSegmentName('');
                    } catch (err) {
                      console.error('Failed to save segment:', err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="btn btn-primary"
                  disabled={!segmentName.trim() || saving}
                  type="button"
                  style={{ fontSize:'0.85rem', padding:'0.4rem 0.75rem', flex:1 }}
                >
                  {saving ? 'Saving...' : 'Save Segment'}
                </button>
                <button
                  onClick={() => {
                    setSegmentStartIdx(null);
                    setSegmentEndIdx(null);
                    setSegmentName('');
                  }}
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize:'0.85rem', padding:'0.4rem 0.75rem' }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, margin:0, padding:0, zIndex:1, overflow:'hidden' }}>
        <MapContainer
          ref={mapRef as any}
          center={routeData.bounds[0] || [0, 0]}
          zoom={13}
          style={{ width: '100%', height: '100vh' }}
          worldCopyJump={true}
        >
          <TileLayer
            attribution={currentTileLayer.attribution}
            url={currentTileLayer.url}
          />
          <FitMapToBounds bounds={routeData.bounds} />

          {segmentMode && activity?.streams?.latlng && (
            <MapClickHandler
              segmentMode={segmentMode}
              latlngs={activity.streams.latlng}
              onPointPicked={handlePointPicked}
            />
          )}

          {/* Highlight selected segment portion */}
          {segmentMode && activity?.streams?.latlng && segmentStartIdx !== null && (
            (() => {
              const fullLatLngs = activity.streams!.latlng!;
              const end = segmentEndIdx ?? segmentStartIdx;
              const startIdx = Math.min(segmentStartIdx, end);
              const endIdx = Math.max(segmentStartIdx, end);
              const coords = fullLatLngs
                .slice(startIdx, endIdx + 1)
                .map(ll => [ll[0], ll[1]] as [number, number]);
              return (
                <Polyline
                  positions={coords}
                  pathOptions={{
                    color: segmentEndIdx !== null ? '#22c55e' : '#fbbf24',
                    weight: 6,
                    opacity: 0.9,
                  }}
                />
              );
            })()
          )}

          {/* Segment start/end markers */}
          {segmentMode && activity?.streams?.latlng && segmentStartIdx !== null && (
            <Marker
              position={[activity.streams.latlng[segmentStartIdx][0], activity.streams.latlng[segmentStartIdx][1]]}
              icon={L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold">S</div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}
          {segmentMode && activity?.streams?.latlng && segmentEndIdx !== null && (
            <Marker
              position={[activity.streams.latlng[segmentEndIdx][0], activity.streams.latlng[segmentEndIdx][1]]}
              icon={L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold">E</div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}

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

            {routeData.points.length > 0 && (
              <>
                <Marker position={[routeData.points[0].lat, routeData.points[0].lng]} icon={L.divIcon({ className:'', html:'<div style="width:14px;height:14px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7] })} />
                <Marker position={[routeData.points[routeData.points.length-1].lat, routeData.points[routeData.points.length-1].lng]} icon={L.divIcon({ className:'', html:'<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7] })} />
              </>
            )}

            <HoverTooltip
           position={hoveredIndex !== null && routeData?.points[hoveredIndex] ? [routeData.points[hoveredIndex].lat, routeData.points[hoveredIndex].lng] : null}
           content={`${currentMetric?.label}: ${hoveredIndex !== null && routeData?.points[hoveredIndex] ? routeData.points[hoveredIndex].value.toFixed(1) : ''} ${currentMetric?.unit}`}
         />
        </MapContainer>
      </div>
    </div>
  );
};

export default ActivityMap;
