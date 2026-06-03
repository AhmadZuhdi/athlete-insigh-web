## Context

The app currently stores full activity GPS stream data (lat/lng, time, distance, heartrate, watts, cadence, altitude at ~1s intervals) and 1km split data in IndexedDB. Segment PRs already exist for standard distances (5k through marathon) using linear interpolation on these streams.

For arbitrary segment matching, the core technical problem is: given a segment defined as a polyline between two points, determine if any activity's GPS trace passes through that segment, and if so, calculate the exact elapsed time and metrics within it.

No backend server exists — everything runs in the browser. Performance on ~500 cached activities must be reasonable (<10s for full scan, async/non-blocking).

## Goals / Non-Goals

**Goals:**
- Allow users to create segments by picking any two points on an activity's map view
- Auto-detect segment matching across all past activities using GPS buffer matching
- Display per-segment PR leaderboard (time, pace, HR, power, elevation)
- Handle both directions (forward and reverse segment traversal)
- Work entirely offline, no backend dependency
- Export/import segments and efforts with existing data management

**Non-Goals:**
- Social features (no global leaderboards, no following other athletes)
- Segment discovery (no auto-suggesting popular segments — user creates them)
- Real-time segment matching during activity recording
- Machine learning for route clustering (use deterministic algorithms)

## Decisions

### D1: Buffer-based polyline matching over point-to-point comparison

**Chosen:** Create a ~30m buffer around segment polyline, find longest contiguous run of activity GPS points within buffer, then interpolate exact time at entry/exit.

**Alternatives considered:**
- **Dynamic Time Warping**: More accurate but O(n²) — too slow for 500 activities with 10000+ GPS points each
- **Fréchet distance**: Accurate but also O(n²) and complex to implement
- **Grid snapping + hash**: Fast but brittle with GPS drift
- **Perpendicular projection** (point-to-line distance): Used as the distance metric within the buffer approach

**Why buffer wins:** O(n) per activity, simple to implement with Haversine + point-to-line math, configurable tolerance, and the ~1s GPS sample interval means the interpolated time error is negligible.

### D2: Pure JS math over turf.js dependency

**Chosen:** Implement point-to-line distance and Haversine manually. No new dependencies.

**Rationale:** The geometry needed is small (point-to-great-circle-line distance, interpolation along polyline segments). Adding turf.js (~200KB) for essentially 2-3 utility functions is not justified. The math is well-documented and straightforward.

### D3: Separate segment service over extending stravaService

**Chosen:** New `segmentService.ts` with `SegmentDetector` class for matching logic, `SegmentRepository` for CRUD.

**Rationale:** stravaService is already 575 lines handling OAuth, API calls, and distance PRs. Segment matching is a distinct concern with its own data model, algorithm, and performance characteristics. Separation keeps both files manageable.

### D4: IndexedDB schema version bump with new tables

**Chosen:** Version 6 of `AthleteInsightDB` with `segments` and `segmentEfforts` tables. Include in export/import.

**Rationale:** Current version 5 has 5 tables. Adding 2 more follows the established pattern. The segment-effort relationship is one-to-many (one segment → many efforts, one per matching activity).

### D5: Async background scan with progress reporting

**Chosen:** When segments exist and new activities arrive, scan runs via `requestIdleCallback` or batched `setTimeout(0)` yielding to UI. Progress callback updates a badge/counter.

**Rationale:** Scanning 500 activities × ~10k GPS points each = ~5M distance calculations. Even with O(n) per activity, this needs to not block the main thread. Web Worker would be ideal but adds complexity — async batching with progress is sufficient and simpler.

## Data Model

```
segments: {
  id?: number,
  name: string,
  activityId: number,        // source activity where segment was defined
  startIndex: number,        // index in source activity's stream
  endIndex: number,
  distanceKm: number,        // pre-computed from polyline
  elevationGain: number,     // from altitude stream
  polyline: [lat, lng][],    // the sub-polyline for matching
  createdBy: 'full-route' | 'custom-points',
  createdAt: number
}

segmentEfforts: {
  id?: number,
  segmentId: number,
  activityId: number,
  timeSecs: number,
  avgPace: number,
  avgSpeed: number,
  avgHr?: number,
  maxHr?: number,
  avgWatts?: number,
  maxWatts?: number,
  elevationGain?: number,
  direction: 'forward' | 'reverse',
  matchedAt: number
}
```

## Architecture

```
┌────────────────────────────────────────────────────┐
│                    UI Layer                         │
│                                                     │
│  ActivityMap (segment creation mode)                │
│    └─ Picker: click 2 points → segment preview      │
│                                                     │
│  SegmentsPage (segment list + PR leaderboard)       │
│    └─ Per-segment table: rank, time, pace, HR, act  │
│                                                     │
│  PersonalRecords (optional: tab for segments)        │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────┐
│                  Service Layer                       │
│                                                      │
│  segmentService.ts                                   │
│    ├─ SegmentRepository (CRUD on IndexedDB)          │
│    ├─ SegmentDetector (matching algorithm)           │
│    │   ├─ matchActivity(segment, activity) → effort  │
│    │   ├─ scanAllActivities(segment) → efforts[]     │
│    │   └─ scanAllSegments(activity) → efforts[]      │
│    └─ BulkScanner (async, progress callbacks)        │
│                                                      │
│  stravaService.ts (updated)                          │
│    └─ onNewActivity → trigger segment scanning       │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────┐
│                 Data Layer                           │
│                                                      │
│  database.ts (v6)                                    │
│    └─ segments: Table<Segment>                       │
│    └─ segmentEfforts: Table<SegmentEffort>           │
│    └─ export/import includes both tables             │
└────────────────────────────────────────────────────┘
```

## Matching Algorithm (SegmentDetector)

```
Input: Segment S (polyline of N points), Activity A (GPS stream of M points)
Output: SegmentEffort | null

1. DECODE: Decode activity summary_polyline (or use full streams.latlng)

2. FIND MATCH WINDOW:
   For each point P in activity.latlng:
     - Find minimum distance from P to any line segment in S's polyline
     - If distance < BUFFER_METERS (default 30m), mark as "within"
   Find longest contiguous run of "within" points
   
3. VALIDATE:
   - Run length must be >= 50% of segment point count (configurable)
   - Total covered distance must be >= 50% of segment distance

4. INTERPOLATE:
   - Entry time: use linear interpolation between the first "within" point
     and its predecessor's timestamp
   - Exit time: same for the last "within" point and its successor
   - Elapsed = exitTime - entryTime

5. DETERMINE DIRECTION:
   - Compare start/end indices: if activity traverses S's start→end, 
     direction = "forward", else "reverse"

6. EXTRACT METRICS:
   - avg HR: mean of matched window's HR stream values
   - max HR: max of matched window's HR stream values
   - avg power: mean of matched window's watts stream
   - elevation gain: altitude delta across matched window
   - avg cadence: mean of matched window's cadence

7. RETURN SegmentEffort or null (if match quality too low)
```

## Risks / Trade-offs

- **GPS drift causing false negatives**: Tight buffer (30m) may miss some runs on wide roads. → Make buffer user-configurable per segment (narrow road vs. multi-lane).
- **False positives on parallel roads**: Buffer overlapping a nearby parallel road. → Require minimum contiguous run length; unlikely with 30m buffer on standard roads.
- **Computation time on large datasets**: 500 activities × 10000 GPS points = 5M distance checks. → Async batching with progress; optionally defer to Web Worker if needed.
- **Warmup/cooldown contamination**: Segment may appear in run warmup/cooldown, giving a misleading time. → Minimum effort duration check (<60s efforts discarded); user can adjust start/end markers.
- **Partial segment coverage**: Activity only covers 60% of segment (turns off early). → Configurable threshold (default 50%); show warning in PR view.
