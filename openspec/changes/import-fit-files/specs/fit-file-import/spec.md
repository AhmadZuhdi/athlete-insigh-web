## ADDED Requirements

### Requirement: Parse FIT binary files
The system SHALL parse raw `.fit` binary files using the `fit-file-parser` library to extract activity summaries and stream data.

#### Scenario: Successful parse of a valid FIT file
- **WHEN** a valid `.fit` file is provided to the parser
- **THEN** the system returns an activity summary (timestamp, type, duration, distance, average HR, average speed, total ascent/descent) and stream data (timestamp, position/latlng, heart rate, cadence, power, altitude, speed)

#### Scenario: Parse fails on invalid FIT file
- **WHEN** an invalid or corrupted `.fit` file is provided
- **THEN** the system returns an error object with a descriptive message and does not crash

### Requirement: Store imported activities in unified table
The system SHALL store imported FIT activities in the `allActivities` Dexie table with `source = 'device'` and stream data in `allActivityDetails`.

#### Scenario: Store parsed device activity
- **WHEN** a FIT file is successfully parsed
- **THEN** the activity summary is written to `allActivities` with `id = generated UUID`, `source = 'device'`, `externalId = undefined`, and stream data to `allActivityDetails`

#### Scenario: Duplicate detection
- **WHEN** a FIT file with the same start timestamp and duration as an existing import is detected
- **THEN** the system skips the duplicate and returns an "already imported" status

#### Scenario: Query all activities (Strava + device)
- **WHEN** the activity list is displayed
- **THEN** a single query to `allActivities` returns both Strava-sourced (`source = 'strava'`) and device-imported activities, sorted by date

### Requirement: Legacy table cleanup
The system SHALL provide a mechanism to clear the old `activities` and `activityDetails` tables after migration is confirmed successful.

#### Scenario: Cleanup button on Settings page
- **WHEN** user navigates to Settings after migration
- **THEN** a "Purge legacy tables" button is visible with a confirmation dialog

#### Scenario: Confirm and execute cleanup
- **WHEN** user clicks the button and confirms the dialog
- **THEN** the old `activities` and `activityDetails` tables are cleared, and a success message is shown

#### Scenario: Cleanup does not affect new tables
- **WHEN** the cleanup is executed
- **THEN** the `allActivities` and `allActivityDetails` tables (and all FK tables) remain intact

### Requirement: Map FIT data to existing data model
The system SHALL map FIT message fields to the existing `StravaActivity` / `ActivityDetail` / `StreamData` interfaces so imported data renders correctly in existing views.

#### Scenario: FIT session maps to activity
- **WHEN** a FIT session message is parsed
- **THEN** its fields are mapped to a `StravaActivity`-compatible object: `start_time`, `name`, `type` (Run/Ride/Swim/etc.), `distance`, `moving_time`, `average_speed`, `average_heartrate`, `total_elevation_gain`

#### Scenario: FIT record maps to stream data
- **WHEN** FIT record messages are parsed
- **THEN** each record's `timestamp`, `position_lat`/`position_long`, `heart_rate`, `cadence`, `power`, `altitude`, `speed` are mapped to arrays in a `StreamData`-compatible object
