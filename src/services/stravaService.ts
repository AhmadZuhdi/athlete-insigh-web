import { db, StravaSettings, StravaActivity, ActivityDetail, StreamData, StravaAthlete, ActivitySegment, Activity } from './database';
import { segmentService } from './segmentService';

const STRAVA_BASE_URL = 'https://www.strava.com/api/v3';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export class StravaService {
  private static instance: StravaService;
  private settings: StravaSettings | null = null;

  static getInstance(): StravaService {
    if (!StravaService.instance) {
      StravaService.instance = new StravaService();
    }
    return StravaService.instance;
  }

  async getSettings(): Promise<StravaSettings | null> {
    if (!this.settings) {
      const settings = await db.settings.toCollection().first();
      this.settings = settings || null;
    }
    return this.settings;
  }

  async saveSettings(settings: Partial<StravaSettings>): Promise<void> {
    const existingSettings = await this.getSettings();
    if (existingSettings) {
      await db.settings.update(existingSettings.id!, settings);
      this.settings = { ...existingSettings, ...settings };
    } else {
      const id = await db.settings.add(settings as StravaSettings);
      this.settings = { id, ...settings } as StravaSettings;
    }
  }

  getAuthorizationUrl(clientId: string, redirectUri: string = window.location.origin): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      approval_prompt: 'force'
    });
    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, clientId: string, clientSecret: string): Promise<void> {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();
    
    await this.saveSettings({
      clientId,
      clientSecret,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at * 1000, // Convert to milliseconds
      scope: data.scope
    });
  }

  async refreshAccessToken(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings?.refreshToken || !settings.clientId || !settings.clientSecret) {
      throw new Error('Missing refresh token or client credentials');
    }

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: settings.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    
    await this.saveSettings({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at * 1000
    });
  }

  async ensureValidToken(): Promise<string> {
    const settings = await this.getSettings();
    if (!settings?.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token is expired (with 5 minute buffer)
    if (settings.expiresAt && settings.expiresAt < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
      const updatedSettings = await this.getSettings();
      return updatedSettings!.accessToken!;
    }

    return settings.accessToken;
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.ensureValidToken();
    
    const response = await fetch(`${STRAVA_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response;
  }

  private async ensureUuidForStravaId(stravaId: number): Promise<string> {
    const existing = await db.allActivities
      .where('externalId')
      .equals(stravaId)
      .first();
    if (existing) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id);
      if (!isUuid) {
        const uuid = crypto.randomUUID();
        const { id: _oldId, ...rest } = existing;
        await db.allActivities.delete(existing.id);
        await db.allActivities.add({ ...rest, id: uuid });
        const details = await db.allActivityDetails.get(existing.id as any);
        if (details) {
          const { id: _oldDetId, ...detRest } = details;
          await db.allActivityDetails.delete(existing.id as any);
          await db.allActivityDetails.add({ ...detRest, id: uuid });
        }
        await db.activitySegments.where('activityId').equals(existing.id).modify({ activityId: uuid });
        await db.segments.where('activityId').equals(existing.id).modify({ activityId: uuid });
        await db.segmentEfforts.where('activityId').equals(existing.id).modify({ activityId: uuid });
        await db.routeGroups.where('activityId').equals(existing.id).modify({ activityId: uuid });
        await db.routeActivities.where('activityId').equals(existing.id).modify({ activityId: uuid });
        return uuid;
      }
      return existing.id;
    }
    const uuid = crypto.randomUUID();
    return uuid;
  }

  async getActivities(page: number = 1, perPage: number = 30): Promise<StravaActivity[]> {
    const response = await this.makeAuthenticatedRequest(
      `/athlete/activities?page=${page}&per_page=${perPage}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const activities = await response.json();
    
    // Save activities to IndexedDB
    for (const activity of activities) {
      await db.activities.put(activity);
      const uuid = await this.ensureUuidForStravaId(activity.id);
      const exists = await db.allActivities.get(uuid);
      if (!exists) {
        await db.allActivities.add({
          source: 'strava',
          externalId: activity.id,
          ...activity,
          id: uuid,
          map: activity.map ? { id: activity.map.id, summary_polyline: activity.map.summary_polyline, resource_state: activity.map.resource_state } : undefined
        } as any);
      }
    }

    return activities;
  }

  async getActivityDetail(activityId: number): Promise<ActivityDetail> {
    // First try to get from IndexedDB
    const cachedDetail = await db.activityDetails.get(activityId);
    const uuid = await this.ensureUuidForStravaId(activityId);
    const cachedUnifiedDetail = await db.allActivityDetails.get(uuid);

    if (cachedUnifiedDetail && cachedUnifiedDetail.streams) {
      return cachedUnifiedDetail;
    }
    if (cachedDetail && cachedDetail.streams) {
      return cachedDetail;
    }

    // If not cached, fetch from API
    const response = await this.makeAuthenticatedRequest(`/activities/${activityId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch activity detail: ${response.statusText}`);
    }

    const activityDetail = await response.json();
    
    // Fetch activity streams
    try {
      const streams = await this.getActivityStreams(activityId);
      activityDetail.streams = streams;
    } catch (error) {
      console.warn('Failed to fetch activity streams:', error);
      // Continue without streams if they fail to load
    }
    
    // Save to IndexedDB (old table)
    await db.activityDetails.put(activityDetail);

    // Save to unified table
    const { id, description, calories, segment_efforts, splits_metric, splits_standard, laps, best_efforts, photos, stats_visibility, hide_from_home, device_name, embed_token, similar_activities, available_zones, streams, ...rest } = activityDetail;
    const unifiedDetail = {
      id: uuid,
      source: 'strava' as const,
      externalId: id,
      ...rest,
      description,
      calories,
      segment_efforts,
      splits_metric,
      splits_standard,
      laps,
      best_efforts,
      photos,
      stats_visibility,
      hide_from_home,
      device_name,
      embed_token,
      similar_activities,
      available_zones,
      streams
    };
    await db.allActivityDetails.put(unifiedDetail);

    // Auto-scan against existing segments (non-blocking)
    if (activityDetail.streams?.latlng && activityDetail.streams?.time) {
      segmentService.scanActivity(uuid).catch(err => {
        console.warn('Segment scan failed for activity', uuid, err);
      });
    }

    return unifiedDetail;
  }

  async getActivityStreams(activityId: number): Promise<StreamData> {
    // Define the stream types we want to fetch
    const streamTypes = ['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'];
    const streamTypesParam = streamTypes.join(',');
    
    const response = await this.makeAuthenticatedRequest(
      `/activities/${activityId}/streams?keys=${streamTypesParam}&key_by_type=true`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activity streams: ${response.statusText}`);
    }

    const streamsData = await response.json();
    
    // Transform the response into our StreamData format
    const streams: StreamData = {};
    
    Object.keys(streamsData).forEach(streamType => {
      const streamInfo = streamsData[streamType];
      if (streamInfo && streamInfo.data) {
        streams[streamType as keyof StreamData] = streamInfo.data;
      }
    });

    return streams;
  }

  async getCachedActivities(): Promise<StravaActivity[]> {
    return await db.activities.orderBy('start_date_local').reverse().toArray();
  }

  async getCachedUnifiedActivities(): Promise<Activity[]> {
    return await db.allActivities.orderBy('start_date_local').reverse().toArray();
  }

  async clearCache(): Promise<void> {
    await db.activities.clear();
    await db.activityDetails.clear();
    await db.allActivities.clear();
    await db.allActivityDetails.clear();
  }

  async clearActivityDetailCache(activityId?: number | string): Promise<void> {
    if (activityId !== undefined) {
      await db.activityDetails.delete(activityId as any);
      if (typeof activityId === 'number') {
        const unified = await db.allActivities.where('externalId').equals(activityId).first();
        if (unified) {
          await db.allActivityDetails.delete(unified.id);
        }
      } else {
        await db.allActivityDetails.delete(activityId);
      }
    } else {
      await db.activityDetails.clear();
      await db.allActivityDetails.clear();
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const settings = await this.getSettings();
    return !!(settings?.accessToken);
  }

  async getAthlete(): Promise<StravaAthlete | null> {
    try {
      // First try to get cached athlete data
      const cachedAthlete = await db.athlete.toCollection().first();
      if (cachedAthlete) {
        return cachedAthlete;
      }

      // If no cached data, fetch from API
      const response = await this.makeAuthenticatedRequest('/athlete');
      if (response.ok) {
        const athleteData: StravaAthlete = await response.json();
        // Cache the athlete data
        await db.athlete.clear(); // Clear any existing data
        await db.athlete.add(athleteData);
        return athleteData;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching athlete:', error);
      return null;
    }
  }

  async updateAthleteBirthYear(birthYear: number): Promise<void> {
    try {
      const athlete = await this.getAthlete();
      if (athlete) {
        await db.athlete.update(athlete.id, { birth_year: birthYear });
      }
    } catch (error) {
      console.error('Error updating birth year:', error);
      throw error;
    }
  }

  async updateAthleteLLMPrefix(prefix: string): Promise<void> {
    try {
      const athlete = await this.getAthlete();
      if (athlete) {
        await db.athlete.update(athlete.id, { llm_summary_prefix: prefix });
      }
    } catch (error) {
      console.error('Error updating LLM prefix:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await db.settings.clear();
    await this.clearCache();
    this.settings = null;
  }

  async resetDatabase(): Promise<void> {
    try {
      await db.deleteDatabase();
      this.settings = null;
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  async exportAllData(): Promise<string> {
    return await db.exportData();
  }

  async importAllData(jsonData: string): Promise<void> {
    await db.importData(jsonData);
    // Clear cached settings and reload
    this.settings = null;
  }

  async getDataStats() {
    return await db.getDataStats();
  }

  // ============ SEGMENT CALCULATION FOR TIME-BASED PERSONAL RECORDS ============

  /**
   * Standard race distances to track (in kilometers)
   */
  private static readonly STANDARD_DISTANCES = [5, 10, 15, 20, 21.1, 30, 42.2];

  /**
   * Extract segment time from stream data (most accurate)
   * Uses linear interpolation for precise timing at exact distances
   */
  private extractSegmentTimeFromStreams(
    activity: ActivityDetail,
    targetDistanceKm: number
  ): { time: number; pace: number } | null {
    if (!activity.streams?.distance || !activity.streams?.time) {
      return null;
    }

    const distanceArray = activity.streams.distance; // meters
    const timeArray = activity.streams.time; // seconds
    const targetDistanceM = targetDistanceKm * 1000;

    // Check if activity covers target distance
    const totalDistanceM = distanceArray.at(-1) || 0;
    if (totalDistanceM < targetDistanceM) {
      return null;
    }

    // Find the index where we cross the target distance
    let endIndex = distanceArray.findIndex(d => d >= targetDistanceM);
    if (endIndex === -1) {
      return null;
    }

    // Get surrounding data points for interpolation
    const startIndex = Math.max(0, endIndex - 1);
    const startDistance = distanceArray[startIndex];
    const endDistance = distanceArray[endIndex];
    const startTime = timeArray[startIndex];
    const endTime = timeArray[endIndex];

    // Linear interpolation for precise timing at exact target distance
    const interpolationFactor =
      endDistance === startDistance
        ? 0
        : (targetDistanceM - startDistance) / (endDistance - startDistance);
    
    const finalTime = startTime + interpolationFactor * (endTime - startTime);

    return {
      time: finalTime, // seconds
      pace: (finalTime / 60) / targetDistanceKm // min/km
    };
  }

  /**
   * Extract segment time from split data (fallback)
   * Limited to 1km boundaries but works when streams unavailable
   */
  private extractSegmentTimeFromSplits(
    activity: ActivityDetail,
    targetDistanceKm: number
  ): { time: number; pace: number } | null {
    if (!activity.splits_metric || activity.splits_metric.length === 0) {
      return null;
    }

    // Check if activity is long enough
    if (activity.splits_metric.length < targetDistanceKm) {
      return null;
    }

    // Get splits up to target distance (array indices are 0-based)
    const splitsToSum = activity.splits_metric.slice(0, Math.round(targetDistanceKm));

    const totalTime = splitsToSum.reduce((sum, split) => sum + (split.moving_time || 0), 0);

    return {
      time: totalTime, // seconds
      pace: (totalTime / 60) / targetDistanceKm // min/km
    };
  }

  /**
   * Extract segment time using hybrid approach
   * Tries streams first (precise), falls back to splits (approximate)
   */
  async extractSegmentTime(
    activity: ActivityDetail,
    targetDistanceKm: number,
    activityIdOverride?: string
  ): Promise<ActivitySegment | null> {
    // Try streams first (most accurate)
    let result = this.extractSegmentTimeFromStreams(activity, targetDistanceKm);
    let quality: 'stream-precise' | 'split-approximate' = 'stream-precise';

    // Fall back to splits if streams unavailable
    if (!result) {
      result = this.extractSegmentTimeFromSplits(activity, targetDistanceKm);
      quality = 'split-approximate';
    }

    if (!result) {
      return null;
    }

    // Calculate average speed: (km / seconds) * 3600 = km/h
    const avgSpeed = (targetDistanceKm / result.time) * 3600;

    return {
      activityId: activityIdOverride || String(activity.id),
      distanceKm: targetDistanceKm,
      timeSecs: result.time,
      pace: result.pace,
      avgSpeed: avgSpeed,
      dataQuality: quality,
      calculatedAt: Date.now()
    };
  }

  /**
   * Calculate all standard distance segments for an activity
   */
  async calculateSegmentsForActivity(
    activityId: number,
    distances: number[] = StravaService.STANDARD_DISTANCES
  ): Promise<ActivitySegment[]> {
    try {
      const activity = await db.activityDetails.get(activityId);
      const uuid = await this.ensureUuidForStravaId(activityId);
      const unifiedActivity = await db.allActivityDetails.get(uuid);
      const detail = unifiedActivity || activity;
      if (!detail) {
        console.warn(`Activity ${activityId} not found`);
        return [];
      }

      const segments: ActivitySegment[] = [];

      for (const distance of distances) {
        const segment = await this.extractSegmentTime(detail, distance, uuid);
        if (segment) {
          segments.push(segment);
        }
      }

      // Save to database if any segments found
      if (segments.length > 0) {
        await db.activitySegments.bulkAdd(segments);
      }

      return segments;
    } catch (error) {
      console.error(`Error calculating segments for activity ${activityId}:`, error);
      return [];
    }
  }

  /**
   * Get personal record for a specific distance
   */
  async getPersonalRecordForDistance(
    distanceKm: number,
    activityType?: string
  ): Promise<(ActivitySegment & { activity: StravaActivity }) | null> {
    try {
      const segments = await db.activitySegments
        .where('distanceKm')
        .equals(distanceKm)
        .toArray();

      if (segments.length === 0) {
        return null;
      }

      // Find fastest (lowest pace)
      let fastest = segments[0];
      for (const segment of segments) {
        if (segment.pace < fastest.pace) {
          fastest = segment;
        }
      }

      // Get associated activity from unified table
      const unifiedActivity = await db.allActivities.get(fastest.activityId);
      if (!unifiedActivity) {
        return null;
      }
      const activity: StravaActivity = {
        ...unifiedActivity,
        id: unifiedActivity.externalId || 0
      };

      return {
        ...fastest,
        activity
      };
    } catch (error) {
      console.error(`Error getting PR for ${distanceKm}km:`, error);
      return null;
    }
  }

  /**
   * Get all personal records for all standard distances
   */
  async getAllPersonalRecords(): Promise<
    Map<number, (ActivitySegment & { activity: StravaActivity }) | null>
  > {
    const records = new Map<number, (ActivitySegment & { activity: StravaActivity }) | null>();

    for (const distance of StravaService.STANDARD_DISTANCES) {
      const pr = await this.getPersonalRecordForDistance(distance);
      records.set(distance, pr);
    }

    return records;
  }

  /**
   * Recalculate segments for all cached activities
   * Useful after importing data or updating activity cache
   */
  async recalculateAllSegments(
    progressCallback?: (current: number, total: number) => void
  ): Promise<number> {
    try {
      const activities = await db.allActivities.toArray();
      let calculatedCount = 0;

      for (let i = 0; i < activities.length; i++) {
        const numericId = activities[i].externalId;
        if (numericId === undefined) continue;
        const segments = await this.calculateSegmentsForActivity(numericId);
        if (segments.length > 0) {
          calculatedCount++;
        }

        if (progressCallback) {
          progressCallback(i + 1, activities.length);
        }
      }

      console.log(`Recalculated segments for ${calculatedCount} activities`);
      return calculatedCount;
    } catch (error) {
      console.error('Error recalculating all segments:', error);
      return 0;
    }
  }

  /**
   * Clear all cached segments (e.g., when resetting database)
   */
  async clearSegments(): Promise<void> {
    try {
      await db.activitySegments.clear();
    } catch (error) {
      console.error('Error clearing segments:', error);
      throw error;
    }
  }
}

export const stravaService = StravaService.getInstance();
