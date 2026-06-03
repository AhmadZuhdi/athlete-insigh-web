## Why

The Segments page has scan config settings (scan direction, activity limit, limit toggle) that reset to defaults every time the page is loaded or remounted. Users who want to scan only newest activities or limit the scan count must reconfigure each visit. These configs should persist across sessions.

## What Changes

- Persist `scanDirection`, `scanLimit`, and `scanLimitEnabled` settings in IndexedDB using a new settings table entry
- Load persisted settings on Segments page mount instead of using hardcoded defaults
- Keep the existing UI behavior unchanged — only the source of initial values changes
- Backward-compatible: missing settings gracefully fall back to current defaults

## Capabilities

### New Capabilities
- `scan-config-persistence`: Persisting and loading segment scan configuration across page reloads

### Modified Capabilities

(No existing spec-level capabilities are modified — this is purely a persistence improvement.)

## Impact

- **`src/components/Segments.tsx`**: Load initial scan config from IndexedDB on mount; save config on user interaction
- **`src/services/segmentService.ts`** (or a new settings service): Add methods to get/put scan config in IndexedDB
- **`src/services/database.ts`**: May need a new table or reuse an existing settings table for storing scan config
- **No new dependencies**: IndexedDB via Dexie is already available
