## 1. Data Model — Unified Tables & Migration

- [x] 1.1 Install `fit-file-parser` npm dependency
- [x] 1.2 Create TypeScript interfaces: `Activity` (generic, `id: string`, `source: 'strava' | 'device'`, `externalId?: number`, plus all StravaActivity fields) and `ActivityDetail` (extends Activity with `streams?: StreamData`)
- [x] 1.3 Bump Dexie schema to version 8: redefine all tables — add `allActivities` + `allActivityDetails` (keyed by string UUID), update FK tables (`segments`, `segmentEfforts`, `routeGroups`, `routeActivities`, `activitySegments`) to use `activityId: string`
- [x] 1.4 Implement v8 upgrade callback: iterate old `activities`, generate UUID per row, copy to `allActivities` with `source = 'strava'` + `externalId = old id`; build numeric-to-UUID ID map
- [x] 1.5 In same upgrade callback: migrate `activityDetails` to `allActivityDetails` using ID map
- [x] 1.6 In same upgrade callback: migrate FK tables (`segments`, `segmentEfforts`, `routeGroups`, `routeActivities`, `activitySegments`) — replace `activityId: number` with UUID from ID map; build segment ID map for `segmentEfforts.segmentId`
- [x] 1.7 Add `deleteLegacyTables()` method to `AthleteInsightDB` — clears old `activities` and `activityDetails` tables
- [x] 1.8 Update `exportData()` / `importData()` / `clearAllData()` / `getDataStats()` to use new tables

## 2. FIT File Parsing Service

- [x] 2.1 Create `src/services/fitImportService.ts` with `parseFitFile(file: File): Promise<ParsedFitActivity>` — reads ArrayBuffer, decodes via `fit-file-parser`
- [x] 2.2 Map FIT session/lap messages to `Activity` fields (start_time, name, type, distance, moving_time, avg speed/hr, elevation)
- [x] 2.3 Map FIT record messages to stream data arrays (latlng, timestamp, heartrate, cadence, power, altitude, speed)
- [x] 2.4 Implement duplicate detection (same start timestamp + duration across all `allActivities`)
- [x] 2.5 Add `storeActivity(activity, details)` — writes to `allActivities` + `allActivityDetails` in a Dexie transaction

## 3. Import Page Component

- [x] 3.1 Create `src/components/FitImport.tsx` with drag-and-drop zone using HTML5 Drag and Drop API
- [x] 3.2 Add file picker button (accepting `.fit`, multiple) and queue display showing filename, file size, and status badge
- [x] 3.3 Implement "Import All" button that processes queued files sequentially with per-file status updates (queued → parsing → storing → imported/error/duplicate)
- [x] 3.4 Add progress summary (X of Y complete) and per-file error display
- [x] 3.5 Add route `/import` in `src/App.tsx` pointing to `FitImport`, add "Import" nav link

## 4. Activity List & Detail Integration

- [x] 4.1 Update `src/components/Activities.tsx` to query `allActivities` (single source), add `source` badge ("Strava" / "Device")
- [x] 4.2 Update `ActivityDetail.tsx` to handle UUID URL params; support backward-compat numeric ID lookup via `externalId` with redirect
- [x] 4.3 Ensure all activity-related links use UUIDs; verify `ActivityMap.tsx`, `MultiMetricChart.tsx` work with unified data

## 5. Legacy Cleanup UI

- [x] 5.1 In `Settings.tsx`, add "Data Migration" section with "Purge legacy tables" button and storage freed estimate
- [x] 5.2 Add confirmation dialog before executing cleanup
- [x] 5.3 Wire button to `db.deleteLegacyTables()` and show success/error feedback

## 6. PWA Share Target

- [x] 5.1 Add `share_target` block to `public/manifest.json` accepting `.fit` files
- [x] 5.2 Register service worker in `src/index.tsx` (create `src/serviceWorker.ts` if needed)
- [x] 5.3 Implement service worker `fetch` handler to intercept share POST, cache file data, redirect to `/import?shared=true`
- [x] 5.4 Update `FitImport.tsx` to detect `?shared=true` param and load shared file data from cache
- [x] 5.5 Add feature detection: hide share instructions on unsupported platforms

## 7. Verification

- [x] 6.1 Verify `npm run build` succeeds with new dependencies and types
- [ ] 6.2 Verify v7 → v8 migration: existing Strava data survives, FK references are intact
- [ ] 6.3 Manual test: import a sample `.fit` file and confirm it appears in the activity list with correct source badge
- [ ] 6.4 Verify old `/activity/12345` (numeric ID) URLs redirect to UUID-based URL
