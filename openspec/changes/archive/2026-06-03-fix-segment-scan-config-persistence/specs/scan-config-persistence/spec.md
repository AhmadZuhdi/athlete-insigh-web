## ADDED Requirements

### Requirement: Scan config persists across page reloads

The system SHALL persist the segment scan configuration (direction, limit, limit enabled) so that values survive page navigation and full browser reloads.

#### Scenario: Config saved on change
- **WHEN** user changes the scan direction dropdown, toggles the limit checkbox, or changes the limit number input
- **THEN** the new value is immediately persisted to localStorage

#### Scenario: Config loaded on mount
- **WHEN** the Segments page mounts and a saved config exists in localStorage
- **THEN** the scan direction, limit, and limit enabled inputs are initialized from the saved values

#### Scenario: No saved config uses defaults
- **WHEN** the Segments page mounts and no saved config exists in localStorage
- **THEN** the scan config inputs use default values (direction: `'newest'`, limit: 0, limit enabled: false)

#### Scenario: Corrupt config falls back to defaults
- **WHEN** the Segments page mounts and the saved config in localStorage has invalid JSON or missing fields
- **THEN** the system silently falls back to default values without showing an error
