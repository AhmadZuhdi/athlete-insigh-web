## ADDED Requirements

### Requirement: Compute segment averages from stream data with dynamic sizing
The system SHALL compute average heart rate, average speed, and average cadence for each distance segment of an activity using stream data. Segment size is dynamic: 5km for activities under 20km total distance, 10km for activities 20km and above.

#### Scenario: Activity 20km or longer
- **WHEN** the activity has total distance >= 20000
- **THEN** the system SHALL split into 10km segments and compute averages for each

#### Scenario: Activity under 20km
- **WHEN** the activity has total distance < 20000
- **THEN** the system SHALL split into 5km segments and compute averages for each

#### Scenario: Partial final segment
- **WHEN** the activity distance is not a multiple of the segment size
- **THEN** the final segment SHALL contain the remaining distance with its actual averages

#### Scenario: Missing cadence stream
- **WHEN** the cadence stream is not available
- **THEN** the system SHALL compute HR and speed averages per segment but omit cadence

### Requirement: Append segment metrics to LLM summary output
The system SHALL append segment data to the `generateLLMSummary()` output in a structured format.

#### Scenario: Segment data included in LLM summary
- **WHEN** `generateLLMSummary()` is called and stream data is available
- **THEN** the output SHALL contain a `per_10k:` section with each segment's averages

#### Scenario: Segment data format for 10km splits
- **WHEN** segment size is 10km
- **THEN** each segment SHALL be formatted as `10k_N_DIST:{avgHR:N,avgSpeed:N,avgCadence:N}` and segments SHALL be pipe-delimited

#### Scenario: Segment data format for 5km splits
- **WHEN** segment size is 5km
- **THEN** each segment SHALL be formatted as `5k_N_DIST:{avgHR:N,avgSpeed:N,avgCadence:N}` and segments SHALL be pipe-delimited
