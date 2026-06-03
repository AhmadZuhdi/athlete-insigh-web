## Why

Athlete Insight lacks dark mode — a standard accessibility and preference feature. Users who train early morning or late evening get eye strain from bright UI. No theme infrastructure exists, making maintenance harder over time.

## What Changes

- Introduce CSS custom properties for all colors, replacing hardcoded hex values
- Add a theme toggle component in the nav bar
- Persist theme preference in localStorage
- Respect system `prefers-color-scheme` as default
- Apply dark color palette across all components and views
- Support theme in both global CSS and inline styles

## Capabilities

### New Capabilities
- `dark-mode`: App-wide dark/light theme toggle with system preference detection and localStorage persistence. Covers all views: activities, records, settings, activity detail, maps, and release notes.

### Modified Capabilities
- None (no existing spec-based capabilities)

## Impact

- `src/index.css` — rewrite with CSS custom properties for colors
- `src/App.css` — update color references
- `src/components/PersonalRecords.css` — update color references
- `src/components/ReleaseNotes.css` — update color references
- `src/App.tsx` — add theme toggle in nav, manage theme state
- `src/index.tsx` — apply theme class to root element
- Components with inline styles (Activities, ActivityDetail, Settings, ActivityMap, MultiMetricChart) — read theme context for colors
- New file: `src/context/ThemeContext.tsx` for theme state management
- No new dependencies required
