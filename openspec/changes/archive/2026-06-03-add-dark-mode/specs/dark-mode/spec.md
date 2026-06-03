## ADDED Requirements

### Requirement: Theme toggle exists in navigation
The system SHALL provide a theme toggle button in the navigation bar that switches between light and dark themes.

#### Scenario: Toggle switches theme
- **WHEN** user clicks the theme toggle button while in light mode
- **THEN** app switches to dark mode immediately

#### Scenario: Toggle switches back
- **WHEN** user clicks the theme toggle button while in dark mode
- **THEN** app switches to light mode immediately

### Requirement: System preference detected on first visit
The system SHALL detect the OS-level `prefers-color-scheme` on first visit and apply the matching theme if no saved preference exists.

#### Scenario: System preference dark on first visit
- **WHEN** user visits for the first time and OS is in dark mode
- **THEN** app renders in dark theme

#### Scenario: System preference light on first visit
- **WHEN** user visits for the first time and OS is in light mode
- **THEN** app renders in light theme

### Requirement: Theme preference persisted
The system SHALL persist the user's theme choice in localStorage so it survives page reloads.

#### Scenario: Theme persists after reload
- **WHEN** user selects dark theme and reloads the page
- **THEN** app renders in dark theme

### Requirement: Live system preference changes respected
If user chose "system" mode, the system SHALL react to live changes in `prefers-color-scheme`.

#### Scenario: OS switches to dark while app is open
- **WHEN** user is in system mode and OS switches to dark mode
- **THEN** app switches to dark theme without requiring a reload

### Requirement: All views display correct theme colors
Every route (Activities, Records, Settings, Activity Detail, Activity Map, Release Notes) SHALL render with theme-appropriate colors for backgrounds, text, borders, links, and accents.

#### Scenario: Activities page in dark mode
- **WHEN** user navigates to Activities page in dark mode
- **THEN** background is dark, text is light, cards use dark surface colors

#### Scenario: Records page in dark mode
- **WHEN** user navigates to Records page in dark mode
- **THEN** all table and card elements use dark theme colors

#### Scenario: Map page in dark mode
- **WHEN** user navigates to an activity map in dark mode
- **THEN** the map tile layer switches to a dark variant and map controls are themed

### Requirement: Theme applied via CSS custom properties
The system SHALL define all theme colors as CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark), enabling consistent theming across all CSS files.

#### Scenario: CSS variable used for background
- **WHEN** a CSS rule references `var(--bg-primary)`
- **THEN** it resolves to the light value under `:root` and dark value under `[data-theme="dark"]`

### Requirement: Inline styles receive theme via context
Components using inline styles SHALL read color tokens from a React context rather than hardcoding colors.

#### Scenario: Inline-styled component in dark mode
- **WHEN** a component using inline styles renders in dark mode
- **THEN** its color values come from the theme context's dark palette
