## ADDED Requirements

### Requirement: Activity Map View Page
The system SHALL provide a dedicated map view page for each activity, accessible from the Activity Detail page, displaying the activity route on an interactive map.

#### Scenario: Navigate to map view from activity detail
- **WHEN** user is on an Activity Detail page
- **THEN** a "Map View" button/link is displayed
- **AND** clicking it navigates to a map view page for that activity

#### Scenario: Map view shows activity route
- **WHEN** user opens the map view page for an activity with GPS data
- **THEN** the map displays the full activity route as a colored line
- **AND** the map auto-zooms to fit the entire route

#### Scenario: Map view handles missing GPS data
- **WHEN** the activity has no latlng stream data
- **THEN** the page displays a message "No GPS data available for this activity"
- **AND** no map is rendered

### Requirement: Metric Selector for Heatmap
The system SHALL provide a dropdown selector allowing the user to choose which metric colors the route line.

#### Scenario: Metric selector is displayed
- **WHEN** the map view is loaded with GPS data
- **THEN** a metric selector dropdown is visible near the top of the map
- **AND** the default selection is "Heart Rate" if available

#### Scenario: Switching metric changes route colors
- **WHEN** user selects a different metric from the dropdown
- **THEN** the route line colors update to reflect the new metric values
- **AND** the color legend updates to show the new metric's value range

#### Scenario: Metric selector only shows available metrics
- **WHEN** the activity is loaded
- **THEN** only metrics with available stream data are shown in the selector
- **AND** unavailable metrics (e.g., Power if no power meter) are excluded

### Requirement: Color Legend
The system SHALL display a color legend showing the mapping between colors and metric values.

#### Scenario: Legend displays with metric info
- **WHEN** the route heatmap is displayed
- **THEN** a color gradient bar is shown beneath the map
- **AND** the legend shows the metric name, minimum value (green end), and maximum value (red end)

#### Scenario: Legend updates with metric change
- **WHEN** user switches the selected metric
- **THEN** the legend updates with the new metric name and its min/max values
- **AND** the gradient colors remain green-to-red
