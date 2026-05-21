## ADDED Requirements

### Requirement: Heatmap Route Coloring
The system SHALL color-code the activity route line on the map based on the selected metric value at each point, using a green-to-yellow-to-red gradient.

#### Scenario: Route is colored by metric values
- **WHEN** the map view loads with GPS and metric data
- **THEN** the route line is drawn as a series of segments
- **AND** each segment's color reflects the metric value at that position
- **AND** low values appear green, mid values yellow, high values red

#### Scenario: Color gradient is smooth
- **WHEN** metric values change gradually along the route
- **THEN** the color transition between segments is smooth (no abrupt color jumps)
- **AND** the gradient uses linear RGB interpolation

#### Scenario: Metric values are correctly mapped to colors
- **WHEN** a data point has the minimum metric value
- **THEN** it is colored green (RGB: 0, 255, 0)
- **AND** when a data point has the maximum metric value, it is colored red (RGB: 255, 0, 0)
- **AND** mid-range values interpolate between green, yellow, and red

### Requirement: Route Data Sampling
The system SHALL sample raw GPS and metric stream data to a manageable number of points for map rendering performance.

#### Scenario: Data is sampled for rendering
- **WHEN** the route data is prepared for the map
- **THEN** the data is sampled to approximately 200 points maximum
- **AND** the sampling interval is evenly distributed across the route
- **AND** metric values at sampled points correspond to the same indices as latlng data

#### Scenario: Sampled route preserves visual shape
- **WHEN** the route is rendered with sampled data
- **THEN** the route shape is visually identical to the full-resolution route
- **AND** no significant turns or curves are lost in sampling
