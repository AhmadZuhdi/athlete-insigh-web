## Context

The `generateLLMSummary()` function in `ActivityDetail.tsx` builds a structured text summary of an activity for LLM consumption. It currently includes overall averages (avg_HR, avg_speed) and HR zone distribution, but does not break down metrics per 10km segment.

Stream data (time, distance, heartrate, velocity_smooth, cadence) is already loaded into the `activity` object. No new data fetching is needed.

## Goals / Non-Goals

**Goals:**
- Compute average HR, speed, and cadence per segment from stream data
- Segment size: 5km for activities <20km, 10km for 20km+
- Append segment data to the LLM summary in a parseable format
- Handle edge cases: activities under one segment, partial final segment, missing streams
- Keep the output compact — one line per segment

**Non-Goals:**
- UI changes or new visualizations
- Backend or database changes
- Persisting per-10k data to storage

## Decisions

- **Segment boundary**: Use the existing `activity.streams.distance` array. Walk through distance data and group by segment increments. Segment size is dynamic: 5km for total distance <20km, 10km otherwise.
- **Output format**: `<size>k_N:{avgHR:155,avgSpeed:12.3,avgCadence:85}|<size>k_N:{...}` — e.g. `10k_1:{...}` for 10km splits, `5k_1:{...}` for 5km splits. Pipe-delimited, JSON-like objects.
- **Missing data**: If a stream (e.g., cadence) is absent, omit that field for the segment. If no stream data at all, skip the section entirely.
- **Partial segment**: The final segment may be shorter than the full segment size. Include it with its actual distance noted (e.g., `10k_3_5.2k:{...}` for a 5.2km partial, `5k_2_3.0k:{...}` for a 3km partial).

## Risks / Trade-offs

- **Large summaries**: For ultramarathons, per-10k data could produce 4+ extra lines. This is acceptable for LLM context windows.
- **Stream alignment**: Distance and HR arrays must align by index (they do — Strava API returns them as parallel arrays).
