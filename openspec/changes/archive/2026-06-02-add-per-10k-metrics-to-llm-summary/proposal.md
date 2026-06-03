## Why

The LLM summary currently includes overall averages (avg HR, avg speed) but lacks granular per-10km segment data. Adding per-10k averages for HR, speed, and cadence enables better post-activity analysis — identifying pacing decay, heart rate drift, and cadence variation across longer distances.

## What Changes

- Compute per-10km segment averages (HR, speed, cadence) from stream data in `ActivityDetail.tsx`
- Append per-10k metrics to the `generateLLMSummary()` output in a structured format
- Handle edge cases: activities <10km (single segment), partial final segments, missing stream data

## Capabilities

### New Capabilities
- `per-10k-metrics`: Compute and expose average HR, speed, and cadence per 10km segment from activity stream data for LLM consumption

### Modified Capabilities

None — no existing specs are affected.

## Impact

- `src/components/ActivityDetail.tsx`: Modify `generateLLMSummary()` to compute and include per-10k averages
- No new dependencies, APIs, or backend changes
