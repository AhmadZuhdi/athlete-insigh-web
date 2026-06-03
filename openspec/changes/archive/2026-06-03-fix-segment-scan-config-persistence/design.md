## Context

The Segments page (`src/components/Segments.tsx`) has a scan config panel with three user-configurable settings:

- `scanDirection`: `'newest'` | `'oldest'` — order to scan activities
- `scanLimit`: `number` — max activities to scan (0 = unlimited)
- `scanLimitEnabled`: `boolean` — whether the limit is active

These are initialized to hardcoded defaults via `useState()` and reset on every page mount/refresh. The settings table in IndexedDB exists but is designed for Strava OAuth tokens. There is no existing UI settings persistence pattern in the codebase.

## Goals / Non-Goals

**Goals:**
- Persist scan config so users don't have to reconfigure on each page visit
- Load persisted config as initial values on mount
- Fall back to current defaults if no saved config exists
- Keep the change minimal — no new dependencies, no schema bumps

**Non-Goals:**
- Persisting other UI state (segment list sort, column visibility, etc.)
- Adding a general-purpose settings UI
- Schema version bump or new IndexedDB tables

## Decisions

### D1: localStorage over IndexedDB for scan config persistence

**Chosen:** Store scan config in `localStorage` under key `segmentScanConfig`.

**Alternatives considered:**
- **IndexedDB `settings` table**: Would require schema version bump, export/import handling, and is overkill for 3 small values. The table is typed for `StravaSettings` — reusing it would mix unrelated concerns.
- **New Dexie table**: Even more overhead (schema bump, migration, export/import).
- **sessionStorage**: Wouldn't persist across sessions.

**Why localStorage wins:** Zero dependencies, synchronous read on mount (no async loading state), automatic cleanup with "Clear Storage", and this is purely a UI preference — not data that needs export/import.

### D2: Load persisted config lazily on mount, not in useState initializer

**Chosen:** Read localStorage in a `useEffect` (or sync on mount), merge with defaults. If corrupt or missing, use defaults silently.

**Rationale:** `localStorage.getItem` is synchronous, so reading in a `useEffect` runs immediately. The merge-with-defaults approach handles migration naturally — if a new config key is added in the future, it gets the default value without migration code.

## Risks / Trade-offs

- **localStorage cleared by user**: No data loss — config gracefully falls back to defaults. No different from the current behavior.
- **Config corruption**: `try/catch` around the read; corrupt JSON silently falls back to defaults.
- **Not exported/imported**: Scan config is a UI preference, not athlete data. Intentional exclusion.
