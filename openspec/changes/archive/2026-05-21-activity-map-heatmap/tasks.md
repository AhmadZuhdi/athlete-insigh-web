## 1. Setup

- [x] 1.1 Install leaflet and react-leaflet dependencies
- [x] 1.2 Create openspec/changes/activity-map-heatmap/maps directory structure

## 2. Map Component

- [x] 2.1 Create ActivityMap.tsx component with Leaflet map rendering
- [x] 2.2 Implement GPS data loading and latlng parsing from activity streams
- [x] 2.3 Add map auto-fit to route bounds using Leaflet fitBounds
- [x] 2.4 Handle missing GPS data with fallback message

## 3. Route Heatmap

- [x] 3.1 Create routeData sampling utility (sample to ~200 points)
- [x] 3.2 Implement metric-to-color conversion (green-yellow-red gradient)
- [x] 3.3 Draw route as segmented polylines with per-segment coloring
- [x] 3.4 Support all metric types: heartrate, velocity_smooth, altitude, watts, cadence

## 4. Metric Selector

- [x] 4.1 Create metric selector dropdown component
- [x] 4.2 Populate selector with available metrics for the activity
- [x] 4.3 Wire selector to re-render route with new metric coloring
- [x] 4.4 Set default metric to Heart Rate (if available), otherwise first available

## 5. Color Legend

- [x] 5.1 Create color legend component with gradient bar
- [x] 5.2 Display metric name, min value (green), max value (red)
- [x] 5.3 Update legend when metric selector changes

## 6. Navigation & Routing

- [x] 6.1 Add map route (/activities/:id/map) to App.tsx router
- [x] 6.2 Add "Map View" button on Activity Detail page
- [x] 6.3 Import Leaflet CSS in the map component entry

## 7. Testing & Polish

- [x] 7.1 Test map view with activities that have GPS data
- [x] 7.2 Test map view with activities without GPS data
- [x] 7.3 Test metric switching and legend updates
- [x] 7.4 Test mobile responsiveness of map view
