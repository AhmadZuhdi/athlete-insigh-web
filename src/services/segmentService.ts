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

  async getEffortsForActivity(activityId: string): Promise<SegmentEffort[]> {
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

  async scanActivity(activityId: string): Promise<SegmentEffort[]> {
    const segments = await this.getAllSegments();
    if (segments.length === 0) return [];

    let detail: ActivityDetail;
    try {
      const activity = await db.allActivities.get(activityId);
      const numericId = activity?.externalId;
      if (numericId === undefined) return [];
      detail = await stravaService.getActivityDetail(numericId);
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

    const activities = await db.allActivityDetails.toArray();
    const existingEfforts = await this.getEffortsForSegment(segmentId);
    const existingActivityIds = new Set(existingEfforts.map(e => e.activityId));

    const newEfforts: SegmentEffort[] = [];

    for (const activity of activities) {
      if (!activity.id) continue;
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

  async rescanAll(
    options?: { direction?: 'newest' | 'oldest'; limit?: number },
    callback?: (progress: number, total: number) => void
  ): Promise<void> {
    const segments = await this.getAllSegments();
    if (segments.length === 0) return;

    let activities = await db.allActivityDetails.toArray();
    let activitiesWithStreams = activities.filter(
      a => a.streams?.latlng && a.streams?.time
    );

    if (options?.direction === 'newest') {
      activitiesWithStreams.sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime());
    } else if (options?.direction === 'oldest') {
      activitiesWithStreams.sort((a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime());
    }

    if (options?.limit && options.limit > 0 && options.limit < activitiesWithStreams.length) {
      activitiesWithStreams = activitiesWithStreams.slice(0, options.limit);
    }

    const total = activitiesWithStreams.length;
    let completed = 0;

    await db.segmentEfforts.clear();

    for (let ai = 0; ai < activitiesWithStreams.length; ai += BATCH_SIZE) {
      const batch = activitiesWithStreams.slice(ai, ai + BATCH_SIZE);
      for (const segment of segments) {
        const promises = batch.map(activity => {
          const effort = matchActivity(segment, activity);
          if (effort) {
            return db.segmentEfforts.add(effort);
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
      }

      completed += batch.length;
      callback?.(completed, total);

      if (BATCH_DELAY_MS > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  }
}

export const segmentService = new SegmentService();
