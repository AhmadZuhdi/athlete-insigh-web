import { db, Segment, SegmentEffort, ActivityDetail } from './database';
import { matchActivity } from './segmentDetector';
import { stravaService } from './stravaService';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 50;

export class SegmentService {
  async createSegment(segment: Omit<Segment, 'id' | 'createdAt'>): Promise<number> {
    const id = await db.segments.add({
      ...segment,
      createdAt: Date.now(),
    } as Segment) as number;
    return id;
  }

  async updateSegment(id: number, updates: Partial<Segment>): Promise<void> {
    await db.segments.update(id, updates);
  }

  async deleteSegment(id: number): Promise<void> {
    await db.transaction('rw', db.segments, db.segmentEfforts, async () => {
      await db.segmentEfforts.where('segmentId').equals(id).delete();
      await db.segments.delete(id);
    });
  }

  async getAllSegments(): Promise<Segment[]> {
    return await db.segments.toArray();
  }

  async getSegment(id: number): Promise<Segment | undefined> {
    return await db.segments.get(id);
  }

  async getEffortsForSegment(segmentId: number): Promise<SegmentEffort[]> {
    return await db.segmentEfforts
      .where('segmentId')
      .equals(segmentId)
      .sortBy('timeSecs');
  }

  async getEffortsForActivity(activityId: number): Promise<SegmentEffort[]> {
    return await db.segmentEfforts
      .where('activityId')
      .equals(activityId)
      .toArray();
  }

  async getEffortCountForSegment(segmentId: number): Promise<number> {
    return await db.segmentEfforts
      .where('segmentId')
      .equals(segmentId)
      .count();
  }

  async getBestEffortForSegment(segmentId: number): Promise<SegmentEffort | undefined> {
    const efforts = await db.segmentEfforts
      .where('segmentId')
      .equals(segmentId)
      .sortBy('timeSecs');
    return efforts[0];
  }

  async scanActivity(activityId: number): Promise<SegmentEffort[]> {
    const segments = await this.getAllSegments();
    if (segments.length === 0) return [];

    let detail: ActivityDetail;
    try {
      detail = await stravaService.getActivityDetail(activityId);
    } catch {
      return [];
    }

    if (!detail.streams?.latlng || !detail.streams?.time) return [];

    const existingEfforts = await this.getEffortsForActivity(activityId);
    const existingSegmentIds = new Set(existingEfforts.map(e => e.segmentId));

    const newEfforts: SegmentEffort[] = [];

    for (const segment of segments) {
      if (existingSegmentIds.has(segment.id!)) continue;

      const effort = matchActivity(segment, detail);
      if (effort) {
        await db.segmentEfforts.add(effort);
        newEfforts.push(effort);
      }
    }

    return newEfforts;
  }

  async scanAllActivitiesForSegment(segmentId: number): Promise<SegmentEffort[]> {
    const segment = await this.getSegment(segmentId);
    if (!segment) return [];

    const activities = await db.activityDetails.toArray();
    const existingEfforts = await this.getEffortsForSegment(segmentId);
    const existingActivityIds = new Set(existingEfforts.map(e => e.activityId));

    const newEfforts: SegmentEffort[] = [];

    for (const activity of activities) {
      if (existingActivityIds.has(activity.id)) continue;
      if (!activity.streams?.latlng || !activity.streams?.time) continue;

      const effort = matchActivity(segment, activity);
      if (effort) {
        await db.segmentEfforts.add(effort);
        newEfforts.push(effort);
      }
    }

    return newEfforts;
  }

  async rescanAll(callback?: (progress: number, total: number) => void): Promise<void> {
    const segments = await this.getAllSegments();
    if (segments.length === 0) return;

    const activities = await db.activityDetails.toArray();
    const activitiesWithStreams = activities.filter(
      a => a.streams?.latlng && a.streams?.time
    );

    const total = segments.length * activitiesWithStreams.length;
    let completed = 0;

    await db.segmentEfforts.clear();

    for (const segment of segments) {
      for (let i = 0; i < activitiesWithStreams.length; i += BATCH_SIZE) {
        const batch = activitiesWithStreams.slice(i, i + BATCH_SIZE);
        const promises = batch.map(activity => {
          const effort = matchActivity(segment, activity);
          if (effort) {
            return db.segmentEfforts.add(effort);
          }
          return Promise.resolve();
        });

        await Promise.all(promises);
        completed += batch.length;
        callback?.(completed, total);

        if (BATCH_DELAY_MS > 0) {
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    }
  }
}

export const segmentService = new SegmentService();
