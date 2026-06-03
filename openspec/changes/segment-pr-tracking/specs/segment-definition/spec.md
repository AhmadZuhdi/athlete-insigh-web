## ADDED Requirements

### Requirement: User can create a segment from activity map

The system SHALL allow users to create a named segment by picking two points on the activity route map (ActivityMap.tsx). The segment stores the sub-polyline between those two points, computed distance, and elevation gain.

#### Scenario: Create segment by clicking two route points
- **WHEN** user activates "Create Segment" mode on the activity map and clicks a start point, then an end point on the route line
- **THEN** the system displays a preview of the segment polyline highlighted on the map, shows computed distance and elevation gain, and prompts for a segment name

#### Scenario: Cancel segment creation
- **WHEN** user activates "Create Segment" mode but presses Escape or clicks "Cancel"
- **THEN** the system exits segment creation mode without saving

### Requirement: User can create a segment from the full activity route

The system SHALL allow users to create a segment that spans the entire activity route with a single click.

#### Scenario: Save full route as segment
- **WHEN** user clicks "Save as Segment" on the activity detail view and provides a name
- **THEN** the system creates a segment using the full activity polyline and saves it

### Requirement: User can name, rename, and delete segments

The system SHALL allow users to manage segments through a segment management interface.

#### Scenario: Rename a segment
- **WHEN** user edits a segment name in the segment list view
- **THEN** the system updates the segment name in IndexedDB

#### Scenario: Delete a segment
- **WHEN** user clicks "Delete" on a segment and confirms
- **THEN** the system removes the segment and all associated segment efforts from IndexedDB

### Requirement: Segment stores polyline for matching

Each segment SHALL store the sub-polyline (array of [lat, lng] coordinates) between its start and end points for use in the matching algorithm.

#### Scenario: Segment polyline fidelity
- **WHEN** a segment is created from two points on an activity
- **THEN** the segment contains every GPS point from the source activity between (and including) the start and end indices
