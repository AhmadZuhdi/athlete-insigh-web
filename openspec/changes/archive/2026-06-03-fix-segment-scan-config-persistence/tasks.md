## 1. Persist and load scan config in Segments.tsx

- [x] 1.1 Add save/load helper functions using localStorage key `segmentScanConfig` with JSON serialization and try/catch for corrupt data
- [x] 1.2 On each scan config change (direction dropdown, limit checkbox, limit input), call save function immediately
- [x] 1.3 On component mount, load saved config from localStorage and merge with defaults to initialize state, replacing hardcoded defaults
