## Why

Activity data includes GPS coordinates (lat/lng) that are currently unused. Athletes want to visualize their route on a map and understand how metrics like heart rate, speed, and power vary across different geographic positions. This enables spatial analysis of performance — for example, identifying which segments cause high heart rate exertion.

## What Changes

- Create a new "Map View" page accessible from the Activity Detail page
- Display the activity route on an interactive map using GPS coordinates
- Color-code the route line by a selected metric (heatmap-style) to show metric intensity at each position
- Support multiple metrics: Heart Rate, Speed, Elevation, Power, Cadence
- Add a metric selector dropdown to toggle which metric colors the route
- Color gradient: green (low values) → yellow → red (high values)
- Show a color legend/gradient bar for reference

## Capabilities

### New Capabilities
- `activity-map`: Interactive map view for activity routes with GPS visualization
- `route-heatmap`: Metric-driven heatmap coloring on map route lines

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **New dependency**: Leaflet + React-Leaflet for map rendering
- **New page**: `/activities/:id/map` route
- **New components**: `ActivityMap.tsx`, `RouteHeatmap.tsx`
- **Data**: Uses existing `activity.streams.latlng` data
- **Navigation**: New link/button on Activity Detail page to access Map View
