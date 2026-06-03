import { db, RouteGroup, RouteActivity, StravaActivity } from './database';

const START_END_ROUNDING = 3;
const DISTANCE_TOLERANCE = 0.05;

export function generateFingerprint(activity: StravaActivity): string | null {
  const start = activity.start_latlng;
  const end = activity.end_latlng;
  const dist = activity.distance;
  if (!start || !end || !dist) return null;

  const slat = start[0].toFixed(START_END_ROUNDING);
  const slng = start[1].toFixed(START_END_ROUNDING);
  const elat = end[0].toFixed(START_END_ROUNDING);
  const elng = end[1].toFixed(START_END_ROUNDING);
  const d = (dist / 1000).toFixed(1);

  return `${slat},${slng}|${elat},${elng}|${d}`;
}

export function fingerprintsMatch(fp1: string, fp2: string): boolean {
  const parts1 = fp1.split('|');
  const parts2 = fp2.split('|');
  if (parts1.length !== 3 || parts2.length !== 3) return false;

  const dist1 = parseFloat(parts1[2]);
  const dist2 = parseFloat(parts2[2]);
  if (Math.abs(dist1 - dist2) / Math.max(dist1, dist2) > DISTANCE_TOLERANCE) return false;

  return parts1[0] === parts2[0] && parts1[1] === parts2[1];
}

export class RouteGroupingService {
  async getAllRouteGroups(): Promise<RouteGroup[]> {
    return await db.routeGroups.toArray();
  }

  async getRouteGroup(id: number): Promise<RouteGroup | undefined> {
    return await db.routeGroups.get(id);
  }

  async getRouteActivities(routeId: number): Promise<RouteActivity[]> {
    return await db.routeActivities.where('routeId').equals(routeId).toArray();
  }

  async createRouteGroup(name: string, activity: StravaActivity): Promise<number> {
    const fingerprint = generateFingerprint(activity);
    if (!fingerprint) throw new Error('Activity missing GPS data for route creation');

    const id = await db.routeGroups.add({
      name,
      fingerprint,
      activityId: activity.id,
      createdAt: Date.now(),
    } as RouteGroup) as number;

    await this.assignActivityToRoute(id, activity);
    return id;
  }

  async getOrCreateRouteGroup(activity: StravaActivity): Promise<number | null> {
    const fp = generateFingerprint(activity);
    if (!fp) return null;

    const existing = await db.routeGroups.toArray();
    for (const route of existing) {
      if (fingerprintsMatch(route.fingerprint, fp)) {
        return route.id!;
      }
    }
    return null;
  }

  async autoAssignActivity(activity: StravaActivity): Promise<boolean> {
    const routeId = await this.getOrCreateRouteGroup(activity);
    if (!routeId) return false;

    const alreadyAssigned = await db.routeActivities
      .where({ routeId, activityId: activity.id })
      .count();
    if (alreadyAssigned > 0) return true;

    await this.assignActivityToRoute(routeId, activity);
    return true;
  }

  async assignActivityToRoute(routeId: number, activity: StravaActivity): Promise<void> {
    const movingTime = activity.moving_time || activity.elapsed_time || 0;
    const distKm = (activity.distance || 0) / 1000;

    await db.routeActivities.add({
      routeId,
      activityId: activity.id,
      timeSecs: movingTime,
      avgSpeed: activity.average_speed || 0,
      avgPace: distKm > 0 ? (movingTime / 60) / distKm : 0,
      avgHr: activity.average_heartrate,
      maxHr: activity.max_heartrate,
      elevationGain: activity.total_elevation_gain || 0,
      assignedAt: Date.now(),
    } as RouteActivity);
  }

  async unassignActivity(routeId: number, activityId: number): Promise<void> {
    await db.routeActivities
      .where({ routeId, activityId })
      .delete();
  }

  async deleteRouteGroup(id: number): Promise<void> {
    await db.transaction('rw', db.routeGroups, db.routeActivities, async () => {
      await db.routeActivities.where('routeId').equals(id).delete();
      await db.routeGroups.delete(id);
    });
  }

  async renameRouteGroup(id: number, name: string): Promise<void> {
    await db.routeGroups.update(id, { name });
  }
}

export const routeGroupingService = new RouteGroupingService();
