## Context

The Activity Detail page currently displays charts for pace, speed, elevation, and heart rate over distance/time. GPS coordinates (`activity.streams.latlng`) are fetched from Strava but never visualized on a map. Users want to see their route spatially and correlate metric values with geographic positions.

## Goals / Non-Goals

**Goals:**
- Display activity route on an interactive map
- Color-code route segments by a selected metric (heatmap style)
- Support metric toggling: HR, Speed, Elevation, Power, Cadence
- Provide a color legend showing the value-to-color mapping
- Show tooltip with metric value when hovering over route points
- Accessible from Activity Detail page via a navigation link

**Non-Goals:**
- Elevation profile on map (separate chart handles this)

- Multiple route overlays or comparison maps
- Satellite/aerial map tiles (standard tiles only)
- Offline map support

## Decisions

### 1. Map Library: Leaflet + React-Leaflet
- **Decision**: Use `leaflet` + `react-leaflet` for map rendering
- **Rationale**: Lightweight, free, no API key required (OpenStreetMap tiles), mature React integration, small bundle size
- **Alternatives considered**:
  - Google Maps: Requires API key, billing setup
  - Mapbox: Requires API key, more complex setup
  - Maplibre: Good but heavier dependency

### 2. Heatmap Implementation: Segmented Polylines
- **Decision**: Split the route into small polyline segments, each colored individually based on the metric value at that point
- **Rationale**: True heatmap libraries (like leaflet.heat) create a blur/glow effect that doesn't show precise metric values. Segmented polylines give clean, accurate color transitions along the route
- **Alternatives considered**:
  - `leaflet.heat` plugin: Creates a blur heatmap, loses precision
  - Canvas-based rendering: More performant for very large datasets, but adds complexity

### 3. Color Gradient: Green → Yellow → Red
- **Decision**: Use a 3-stop gradient (green = low, yellow = mid, red = high)
- **Rationale**: Intuitive for athletes — green means easy/recovery, red means high exertion. Matches standard fitness color conventions
- **Implementation**: Linear interpolation between RGB values at each data point

### 4. Route Data Sampling
- **Decision**: Sample latlng data to ~200 points for performance, same as other charts
- **Rationale**: Raw stream data can have thousands of points. Sampling keeps the map responsive while maintaining visual accuracy
- **Correlation**: Sampled points align with the same interval used by `getAnalysisData()`, so metric values stay in sync

### 5. Route with 2-sided Coloring (each segment has 2 colors)
- **Decision**: Each polyline segment connects two points with potentially different metric values. The segment will be colored based on the average of the two endpoints
- **Rationale**: Simpler than gradient segments within each polyline, and visually sufficient given the small segment size

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Large latlng arrays cause map lag | Sample to ~200 points max, same as existing charts |
| Missing latlng data (some Strava activities) | Gracefully show "No GPS data available" message |
| Missing metric data (no HR/power on some activities) | Only show available metrics in the selector |
| Leaflet CSS not loaded | Import Leaflet CSS in the map component entry point |
| Mobile responsiveness | Use responsive Leaflet container, test on mobile viewports |
