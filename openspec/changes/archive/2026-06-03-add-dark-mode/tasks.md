## 1. Foundation — CSS Variables & Theme Context

- [x] 1.1 Define light-theme CSS custom properties on `:root` in `src/index.css` (bg-primary, bg-secondary, text-primary, text-secondary, border, accent, etc.)
- [x] 1.2 Define dark-theme overrides under `[data-theme="dark"]` in `src/index.css`
- [x] 1.3 Create `src/context/ThemeContext.tsx` with React Context providing `theme` string, `toggleTheme` fn, `isDark` bool; handle `prefers-color-scheme` detection, localStorage persistence, `data-theme` attr on `<html>`

## 2. Theme Global CSS Files

- [x] 2.1 Replace hardcoded colors in `src/index.css` with `var(--...)` references
- [x] 2.2 Replace hardcoded colors in `src/App.css` with `var(--...)` references
- [x] 2.3 Replace hardcoded colors in `src/components/PersonalRecords.css` with `var(--...)` references
- [x] 2.4 Replace hardcoded colors in `src/components/ReleaseNotes.css` with `var(--...)` references

## 3. Theme Toggle & Integration

- [x] 3.1 Add sun/moon toggle button to `App.tsx` nav bar that calls `toggleTheme` from context
- [x] 3.2 Wrap `<App />` with `<ThemeProvider>` in `src/index.tsx`

## 4. Inline Style Components

- [x] 4.1 Update `src/components/Activities.tsx` — consume `ThemeContext`, pass colors to inline styles
- [x] 4.2 Update `src/components/ActivityDetail.tsx` — consume `ThemeContext`, pass colors to inline styles
- [x] 4.3 Update `src/components/Settings.tsx` — consume `ThemeContext`, pass colors to inline styles
- [x] 4.4 Update `src/components/ActivityMap.tsx` — use dark map tile layer when dark mode active, theme map controls
- [x] 4.5 Update `src/components/MultiMetricChart.tsx` — pass theme-aware colors to Recharts props

## 5. Verification

- [x] 5.1 Toggle dark/light — all nav links, cards, tables, forms display correct colors
- [x] 5.2 Reload page — theme persists from localStorage
- [x] 5.3 Clear localStorage, set OS to dark mode — app loads dark on first visit
- [x] 5.4 Map page uses dark tiles in dark mode
- [x] 5.5 Charts use theme-appropriate colors in both modes
