## Why

The app calculates personal records for standard distances (5k, 10k, half marathon, etc.) across all activities, but cannot track performance on specific routes or road segments. Strava-style segment PRs — comparing times on the same piece of road across different runs — are the most requested feature for runners who repeatedly run the same routes and want to measure progress. This can be done fully client-side using GPS stream data already stored in IndexedDB, with no backend required.

## What Changes

- **Segment creation**: Users can define a segment by picking any two points on an existing activity's map view, or draw start/end markers on the route
- **Auto-matching**: When a segment exists, the app scans all past (and future) activities to detect if they pass through that segment, using GPS polyline buffer matching
- **Segment leaderboard**: For each segment, show PR history — rank, time, pace, avg HR, max HR, power, elevation gain — across all matching activities
- **Segment management UI**: List all created segments, edit names, delete, view PRs per segment
- **Route-based grouping**: Optionally save full-activity routes (not just sub-segments) and compare complete route performance
- **New IndexedDB tables**: `segments` and `segmentEfforts` to store segment definitions and computed PRs
- **Export/import support**: Segments and efforts included in data export/import

## Capabilities

### New Capabilities
- `segment-definition`: Creating, editing, and deleting segments (two-point pickers on the activity map)
- `segment-detection`: Algorithm that matches segment polylines against activity GPS streams, returning time and metrics for matched portions
- `segment-prs`: Displaying segment PR leaderboards, ranking, and metric comparison across activities
- `route-grouping`: Grouping full activities by route similarity (start/end + fingerprint matching) for route-level PRs

### Modified Capabilities
- (none — this is entirely new functionality)

## Impact

- **New dependencies**: None required for core algorithm (Haversine + point-to-line math is pure JS). Optional: turf.js for buffer-based matching if needed.
- **Database**: New `segments` and `segmentEfforts` tables in `AthleteInsightDB` (Dexie/IndexedDB). Schema version bump.
- **Components**: New `Segments.tsx` (segment list), new segment creation mode in `ActivityMap.tsx`, segment PR section in `PersonalRecords.tsx` or separate tab
- **Services**: New `segmentService.ts` (segment CRUD + detection algorithm), updates to `stravaService.ts` (scan activities on new data)
- **Performance**: Segment matching runs in a Web Worker or async batch — ~100-500ms per activity for buffer matching. Full scan of 500 activities in background takes seconds, not minutes.
