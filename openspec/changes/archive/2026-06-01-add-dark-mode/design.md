## Context

CRA + React 18 + TypeScript app with plain CSS (one global stylesheet, 2 component CSS files) and heavy inline styles. No theme infrastructure — all colors hardcoded as hex. No CSS custom properties. No UI library.

## Goals / Non-Goals

**Goals:**
- Light/dark theme toggle in nav bar
- Detect `prefers-color-scheme` on first visit
- Persist choice in localStorage
- All views themed: activities, records, settings, activity detail, map, release notes
- Dark palette: dark gray backgrounds, light text, reduced brightness accents

**Non-Goals:**
- Custom theme creator / color picker
- Animated theme transitions
- Per-component theme overrides

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Theme mechanism | CSS custom properties on `:root` / `[data-theme="dark"]` | Zero runtime cost, no new deps, works with existing CSS files |
| Inline styles | React Context providing theme colors | Inline styles are pervasive; refactoring to CSS classes out of scope |
| State management | `ThemeContext` with React context + `useState` | Simple, no deps, adequate for app-wide boolean state |
| Persistence | `localStorage` key `theme` with values `"light"` / `"dark"` / `"system"` | Survives refresh, no backend needed |
| System preference | `matchMedia("(prefers-color-scheme: dark)")` listener | Respects OS setting, reacts to live changes |
| Toggle UI | Sun/Moon icon button in nav bar | Consistent with all apps, minimal space |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Inline styles bypass CSS variables | ThemeContext provides color tokens; components must consume context |
| CSS files with hardcoded colors need manual update | Audit all CSS files, replace colors with `var(--...)` |
| Third-party libs (Leaflet, Recharts) need their own dark theme | Leaflet has dark tile option; Recharts accepts colors via props/context |
