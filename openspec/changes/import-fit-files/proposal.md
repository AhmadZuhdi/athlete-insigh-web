## Why

Athletes often record activities on devices (Garmin, Wahoo, etc.) that export `.fit` files, but this app currently only supports Strava-synced activities. Adding native FIT file import unlocks data from non-Strava sources and allows offline/bulk import. PWA share target integration lets users share FIT files directly from email, file managers, or other apps.

## What Changes

- Add FIT file parsing capability (decode raw `.fit` binary format into activity data)
- Create new `/import` page for bulk-importing multiple FIT files with drag-and-drop
- Create a unified `allActivities` table (UUID primary key) that replaces the old `activities` + `activityDetails` tables
- Migrate all existing Strava activities to the new unified table with generated UUIDs
- Add cleanup button in Settings page to delete old `activities`/`activityDetails` tables after migration is confirmed successful
- Add FIT file parsing capability that stores into the same unified table
- Register PWA `share_target` to handle incoming `.fit` file shares
- Integrate shared FIT files into the import flow
- Add navigation link to the new import page

## Capabilities

### New Capabilities

- `fit-file-import`: Parse raw `.fit` binary files, extract activity summaries (timestamp, type, duration, distance) and detailed stream data (GPS, HR, cadence, power, altitude), and store in IndexedDB
- `fit-import-page`: Dedicated page with drag-and-drop zone, file picker button, batch upload progress indicators, and per-file status (queued/parsing/imported/error)
- `pwa-share-target`: Register PWA manifest `share_target` for `.fit` files, handle the share via service worker or `launchQueue`, route shared files to the import page

### Modified Capabilities

- _(none — all three capabilities are new)_

## Impact

- **New dependency**: A FIT file parsing library (e.g., `fit-file-parser` or `@garmin/fitsdk`) required
- **Database**: New `allActivities` + `allActivityDetails` tables in Dexie (schema version bump to 8); FK tables (`segments`, `segmentEfforts`, `routeGroups`, `routeActivities`, `activitySegments`) have `activityId` changed from `number` to `string`
- **Data migration**: v8 upgrade callback copies all existing Strava activities to unified tables and remaps all FK references with UUIDs
- **Routing**: New `/import` route added to `src/App.tsx` with nav link; `/activity/:id` now accepts UUIDs, with backward compat for numeric Strava IDs
- **PWA**: `public/manifest.json` updated with `share_target`; service worker registered if needed
- **Components**: New `src/components/FitImport.tsx` component; shared file handler utility; cleanup UI added to Settings
- **Settings**: Optional reference to new import page from settings
- **Breaking change**: Strava activity IDs in URLs change from numeric to UUID after migration
