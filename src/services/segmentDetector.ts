import { Segment, SegmentEffort, ActivityDetail } from './database';

const BUFFER_METERS = 30;
const MIN_COVERAGE_RATIO = 0.5;
const MIN_EFFORT_SECONDS = 60;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;

  if (ab2 === 0) {
    return haversineDistance(px, py, ax, ay);
  }

  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx;
  const cy = ay + t * aby;

  return haversineDistance(px, py, cx, cy);
}

function minDistanceToPolyline(
  point: [number, number],
  polyline: [number, number][]
): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistance(
      point[0], point[1],
      polyline[i][0], polyline[i][1],
      polyline[i + 1][0], polyline[i + 1][1]
    );
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

function findLongestWithinWindow(
  within: boolean[]
): { start: number; end: number; length: number } | null {
  let bestStart = -1;
  let bestEnd = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < within.length; i++) {
    if (within[i]) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
        bestEnd = i;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestStart === -1) return null;
  return { start: bestStart, end: bestEnd, length: bestLen };
}

function interpolateTime(
  timeArray: number[],
  index: number,
  latlng: [number, number][],
  point: [number, number]
): number {
  if (index <= 0) return timeArray[0];
  if (index >= timeArray.length - 1) return timeArray[timeArray.length - 1];

  const prevDist = haversineDistance(
    latlng[index - 1][0], latlng[index - 1][1],
    point[0], point[1]
  );
  const segDist = haversineDistance(
    latlng[index - 1][0], latlng[index - 1][1],
    latlng[index][0], latlng[index][1]
  );

  if (segDist === 0) return timeArray[index];

  const ratio = prevDist / segDist;
  return timeArray[index - 1] + ratio * (timeArray[index] - timeArray[index - 1]);
}

function calcDistanceAlongLatLng(
  latlng: [number, number][],
  startIndex: number,
  endIndex: number
): number {
  let dist = 0;
  for (let i = startIndex; i < endIndex; i++) {
    dist += haversineDistance(
      latlng[i][0], latlng[i][1],
      latlng[i + 1][0], latlng[i + 1][1]
    );
  }
  return dist;
}

function interpolateLatLng(
  latlng: [number, number][],
  index: number,
  targetPoint: [number, number]
): [number, number] {
  if (index <= 0) return latlng[0];
  if (index >= latlng.length - 1) return latlng[latlng.length - 1];

  const prevDist = haversineDistance(
    latlng[index - 1][0], latlng[index - 1][1],
    targetPoint[0], targetPoint[1]
  );
  const segDist = haversineDistance(
    latlng[index - 1][0], latlng[index - 1][1],
    latlng[index][0], latlng[index][1]
  );

  if (segDist === 0) return latlng[index];

  const ratio = prevDist / segDist;
  return [
    latlng[index - 1][0] + ratio * (latlng[index][0] - latlng[index - 1][0]),
    latlng[index - 1][1] + ratio * (latlng[index][1] - latlng[index - 1][1]),
  ];
}

export function matchActivity(
  segment: Segment,
  activity: ActivityDetail
): SegmentEffort | null {
  const latlng = activity.streams?.latlng;
  const time = activity.streams?.time;
  if (!latlng || latlng.length === 0 || !time || time.length === 0) {
    return null;
  }

  const segPolyline = segment.polyline;
  if (segPolyline.length < 2) return null;

  const within: boolean[] = [];
  for (let i = 0; i < latlng.length; i++) {
    const dist = minDistanceToPolyline(latlng[i], segPolyline);
    within.push(dist < BUFFER_METERS);
  }

  const window = findLongestWithinWindow(within);
  if (!window) return null;

  const coverageRatio = window.length / segPolyline.length;
  if (coverageRatio < MIN_COVERAGE_RATIO) return null;

  const coveredDistance = calcDistanceAlongLatLng(latlng, window.start, window.end);
  if (coveredDistance < segment.distanceKm * 1000 * MIN_COVERAGE_RATIO) return null;

  const entryPoint = interpolateLatLng(latlng, window.start, latlng[window.start]);
  const exitPoint = interpolateLatLng(latlng, window.end, latlng[window.end]);

  const entryTime = interpolateTime(time, window.start, latlng, entryPoint);
  const exitTime = interpolateTime(time, window.end, latlng, exitPoint);

  const elapsedSecs = exitTime - entryTime;
  if (elapsedSecs < MIN_EFFORT_SECONDS) return null;

  const startLatLng = latlng[window.start];
  const segStart = segPolyline[0];
  const segEnd = segPolyline[segPolyline.length - 1];

  const actDir = haversineDistance(startLatLng[0], startLatLng[1], segEnd[0], segEnd[1]);
  const revDir = haversineDistance(startLatLng[0], startLatLng[1], segStart[0], segStart[1]);

  const direction: 'forward' | 'reverse' = actDir < revDir ? 'forward' : 'reverse';

  const hrValues = activity.streams?.heartrate?.slice(window.start, window.end + 1) || [];
  const wattsValues = activity.streams?.watts?.slice(window.start, window.end + 1) || [];
  const cadenceValues = activity.streams?.cadence?.slice(window.start, window.end + 1) || [];
  const altitudeValues = activity.streams?.altitude?.slice(window.start, window.end + 1) || [];

  const avgHr = hrValues.length > 0
    ? hrValues.reduce((sum, v) => sum + v, 0) / hrValues.length
    : undefined;

  const maxHr = hrValues.length > 0
    ? Math.max(...hrValues)
    : undefined;

  const avgWatts = wattsValues.length > 0
    ? wattsValues.reduce((sum, v) => sum + v, 0) / wattsValues.length
    : undefined;

  const maxWatts = wattsValues.length > 0
    ? Math.max(...wattsValues)
    : undefined;

  const elevGain = altitudeValues.length > 1
    ? altitudeValues[altitudeValues.length - 1] - altitudeValues[0]
    : undefined;

  const coveredDistanceKm = coveredDistance / 1000;
  const avgSpeedKmh = coveredDistanceKm / (elapsedSecs / 3600);
  const avgPaceMinPerKm = coveredDistanceKm > 0
    ? (elapsedSecs / 60) / coveredDistanceKm
    : 0;

  return {
    segmentId: segment.id!,
    activityId: activity.id,
    timeSecs: Math.round(elapsedSecs),
    avgPace: Math.round(avgPaceMinPerKm * 100) / 100,
    avgSpeed: Math.round(avgSpeedKmh * 100) / 100,
    avgHr: avgHr !== undefined ? Math.round(avgHr * 10) / 10 : undefined,
    maxHr: maxHr !== undefined ? Math.round(maxHr) : undefined,
    avgWatts: avgWatts !== undefined ? Math.round(avgWatts) : undefined,
    maxWatts: maxWatts !== undefined ? Math.round(maxWatts) : undefined,
    elevationGain: elevGain !== undefined ? Math.round(elevGain) : undefined,
    direction,
    matchedAt: Date.now(),
  };
}

export function computeSegmentPolyline(
  latlng: [number, number][],
  startIndex: number,
  endIndex: number
): [number, number][] {
  if (startIndex > endIndex) {
    return latlng.slice(endIndex, startIndex + 1).reverse();
  }
  return latlng.slice(startIndex, endIndex + 1);
}

export function computeSegmentStats(
  latlng: [number, number][],
  altitude: number[] | undefined,
  startIndex: number,
  endIndex: number
): { distanceKm: number; elevationGain: number } {
  let distanceKm = 0;
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  for (let i = start; i < end; i++) {
    distanceKm += haversineDistance(
      latlng[i][0], latlng[i][1],
      latlng[i + 1][0], latlng[i + 1][1]
    ) / 1000;
  }

  const elevationGain = altitude && altitude.length > end
    ? altitude[end] - altitude[start]
    : 0;

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGain: Math.round(elevationGain),
  };
}
