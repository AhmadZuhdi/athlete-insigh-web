# segment-prs Specification

## Purpose
TBD - created by archiving change segment-pr-tracking. Update Purpose after archive.
## Requirements
### Requirement: Segment PR leaderboard shows ranked efforts

The system SHALL display a per-segment leaderboard showing all recorded efforts ranked by elapsed time (fastest first), with rank, time, pace, and activity name.

#### Scenario: View segment PR leaderboard
- **WHEN** user opens a segment from the segment list view
- **THEN** the system displays a table ranked by time showing: rank, elapsed time, pace, avg speed, avg HR, max HR, date, and activity name, with the fastest effort highlighted as "PR"

#### Scenario: Empty segment leaderboard
- **WHEN** user views a segment with no matching efforts
- **THEN** the system displays "No efforts yet — new activities will be scanned automatically"

### Requirement: User can navigate to source activity from effort

Each segment effort in the leaderboard SHALL be clickable to navigate to the source activity detail view.

#### Scenario: Click effort navigates to activity
- **WHEN** user clicks a segment effort row
- **THEN** the system navigates to /activity/:id for that effort's activity

### Requirement: Segment list shows summary stats

The segment list view SHALL show each segment with summary stats: number of efforts, PR time, PR date, distance, elevation gain.

#### Scenario: View segment list with stats
- **WHEN** user navigates to the segments page
- **THEN** the system displays all segments with name, effort count, PR time, and last effort date

### Requirement: Segment PRs are included in data export/import

The system SHALL include segments and segment efforts tables in the app's JSON export and import functionality.

#### Scenario: Export includes segments
- **WHEN** user exports data from Settings
- **THEN** the export JSON includes segments and segmentEfforts arrays

#### Scenario: Import restores segments
- **WHEN** user imports a valid JSON file that contains segments and segmentEfforts
- **THEN** the system restores both tables to IndexedDB

