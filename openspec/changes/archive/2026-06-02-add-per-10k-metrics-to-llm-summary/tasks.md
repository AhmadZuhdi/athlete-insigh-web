## 1. Extract segment averages from stream data

- [x] 1.1 Add `getSegmentAverages()` helper that walks `activity.streams.distance` and groups data points by dynamic segment size
- [x] 1.2 For each segment, compute average HR, speed, cadence from parallel stream arrays
- [x] 1.3 Handle edge cases: <20km uses 5k splits, 20km+ uses 10k splits, partial final segment, missing stream fields

## 2. Integrate into LLM summary

- [x] 2.1 In `generateLLMSummary()`, call `getSegmentAverages()` when stream data is available
- [x] 2.2 Format segment data as `per_10k:<size>k_N_DIST:{avgHR:N,avgSpeed:N,avgCadence:N}|...` and append to output
- [x] 2.3 Skip segment section entirely if no stream data exists
