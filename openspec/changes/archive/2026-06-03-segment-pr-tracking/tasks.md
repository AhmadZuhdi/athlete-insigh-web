## 1. Database: Schema & Data Layer

- [x] 1.1 Add `Segment` and `SegmentEffort` interfaces to `database.ts`
- [x] 1.2 Bump `AthleteInsightDB` to version 6 with `segments` and `segmentEfforts` tables
- [x] 1.3 Update `clearAllData()`, `exportData()`, `importData()`, `getDataStats()` to include new tables

## 2. Core Algorithm: Segment Detection Engine

- [x] 2.1 Implement `segmentDetector.ts` with point-to-line Haversine distance utility
- [x] 2.2 Implement buffer matching: find longest contiguous GPS run within threshold of segment polyline
- [x] 2.3 Implement time interpolation at entry/exit boundaries
- [x] 2.4 Implement direction detection (forward vs. reverse)
- [x] 2.5 Implement metric extraction (HR, power, cadence, elevation) from matched window
- [x] 2.6 Implement `matchActivity(segment, activity)` returning `SegmentEffort | null`

## 3. Service: Segment CRUD

- [x] 3.1 Create `segmentService.ts` with `SegmentRepository` for IndexedDB CRUD
- [x] 3.2 Implement `scanActivity(activityId)` — matches one activity against all segments
- [x] 3.3 Implement `scanAllActivities(segmentId)` — matches all activities against one segment
- [x] 3.4 Implement async bulk scanner with progress callbacks
- [x] 3.5 Hook into `stravaService.ts` — auto-scan when new activity is fetched

## 4. UI: Segment Creation (ActivityMap)

- [x] 4.1 Add "Create Segment" toggle button to ActivityMap toolbar
- [x] 4.2 Implement click-to-pick two points on route polyline
- [x] 4.3 Highlight selected segment portion on map preview
- [x] 4.4 Show computed distance + elevation gain in creation panel
- [x] 4.5 Add name input and Save/Cancel buttons
- [x] 4.6 Add "Save Full Route as Segment" button to ActivityDetail stats section

## 5. UI: Segment List & PR Leaderboard

- [x] 5.1 Create `Segments.tsx` component with route `/segments`
- [x] 5.2 Implement segment list view (name, effort count, PR time, last date)
- [x] 5.3 Implement per-segment PR leaderboard (ranked by time, show HR/power/pace)
- [x] 5.4 Click-to-navigate from effort row to source activity
- [x] 5.5 Add rename and delete actions per segment
- [x] 5.6 Add "Segments" link to app navigation in `App.tsx`

## 6. UI: Route Grouping (full-route PRs)

- [x] 6.1 Implement route fingerprinting from activity start/end/distance
- [x] 6.2 Create route grouping view showing grouped activities with PRs
- [x] 6.3 Add "Save as Route" button on activity detail
- [x] 6.4 Implement manual assign/unassign of activities to routes
