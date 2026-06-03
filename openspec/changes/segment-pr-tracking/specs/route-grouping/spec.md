## ADDED Requirements

### Requirement: System groups activities by route similarity

The system SHALL group activities into routes by comparing start/end proximity and total distance, allowing users to view PRs across repeated runs of the same full route.

#### Scenario: Activities match by start/end/distance
- **WHEN** two or more activities have start_latlng within 100m, end_latlng within 100m, and total distance within 5%
- **THEN** the system groups them into the same "route" and calculates per-route PRs (fastest time, best pace, best avg HR)

#### Scenario: Route group displayed with PRs
- **WHEN** user views a route group
- **THEN** the system shows the route name, activity count, and ranked table of all activities with time, pace, avg HR, and date

### Requirement: User can create named routes

The system SHALL allow users to save an activity as a named route and manually assign/unassign activities to routes.

#### Scenario: Save activity as route
- **WHEN** user clicks "Save as Route" on an activity
- **THEN** the system creates a new route with the activity's start/end/distance, prompts for a name, and assigns the activity to it

#### Scenario: Manually assign activity to route
- **WHEN** user assigns an activity to an existing route from the activity detail view
- **THEN** the system links the activity to that route

#### Scenario: Remove activity from route
- **WHEN** user unassigns an activity from a route
- **THEN** the system removes the link and recalculates the route's PRs