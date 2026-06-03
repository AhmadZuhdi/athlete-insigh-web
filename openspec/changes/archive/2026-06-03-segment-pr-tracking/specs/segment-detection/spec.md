## ADDED Requirements

### Requirement: System detects matching activities for a segment

The system SHALL match a segment against all stored activities by comparing GPS polylines using buffer-based point-to-line distance matching.

#### Scenario: Activity passes through segment (forward)
- **WHEN** an activity's GPS trace contains a contiguous run of points within 30m of the segment's polyline, covering at least 50% of the segment distance, traversing from segment start toward segment end
- **THEN** the system creates a segment effort with calculated elapsed time, direction "forward", and extracted metrics (HR, power, cadence where available)

#### Scenario: Activity passes through segment (reverse)
- **WHEN** an activity's GPS trace matches the segment's polyline buffer but traverses from segment end toward segment start
- **THEN** the system creates a segment effort with direction "reverse"

#### Scenario: Activity does not match segment
- **WHEN** an activity's GPS trace has no contiguous run of points within 30m of the segment polyline covering at least 50% of the segment distance
- **THEN** the system does not create a segment effort

### Requirement: Time calculation uses stream interpolation

The system SHALL calculate segment elapsed time by interpolating timestamps at the entry and exit boundaries of the matched GPS window.

#### Scenario: Precise time at segment entry
- **WHEN** the first matched GPS point is at index N in the activity stream
- **THEN** the system uses linear interpolation between point N-1 (outside buffer) and point N (inside buffer) to estimate the exact moment the activity entered the segment

#### Scenario: Precise time at segment exit
- **WHEN** the last matched GPS point is at index M in the activity stream
- **THEN** the system uses linear interpolation between point M (inside buffer) and point M+1 (outside buffer) to estimate the exact moment the activity exited the segment

### Requirement: Metrics are extracted from matched window

The system SHALL extract average and maximum values for available metrics (heartrate, watts, cadence, speed) within the matched GPS window.

#### Scenario: Average heart rate calculation
- **WHEN** the segment effort is created and the activity has heartrate stream data
- **THEN** the system calculates avgHr as the arithmetic mean of all heartrate values in the matched window

#### Scenario: Max heart rate calculation
- **WHEN** the segment effort is created and the activity has heartrate stream data
- **THEN** the system calculates maxHr as the maximum heartrate value in the matched window

#### Scenario: Metrics unavailable
- **WHEN** the activity lacks heartrate or power stream data
- **THEN** the corresponding metrics in the segment effort are set to null/undefined

### Requirement: Auto-scan on new activity fetch

The system SHALL automatically scan a newly fetched activity against all existing segments.

#### Scenario: New activity triggers scan
- **WHEN** a new activity is fetched and cached in IndexedDB
- **THEN** the system runs segment matching for this activity against all stored segments and creates any matching efforts