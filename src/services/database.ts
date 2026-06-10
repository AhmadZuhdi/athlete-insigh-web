import Dexie, { Table } from 'dexie';

export interface Activity extends Omit<StravaActivity, 'id'> {
  id: string;
  source: 'strava' | 'device';
  externalId?: number;
}

export interface ActivityDetail extends Activity {
  description?: string;
  calories?: number;
  segment_efforts?: any[];
  splits_metric?: any[];
  splits_standard?: any[];
  laps?: any[];
  best_efforts?: any[];
  photos?: any;
  stats_visibility?: any[];
  hide_from_home?: boolean;
  device_name?: string;
  embed_token?: string;
  similar_activities?: any;
  available_zones?: any[];
  streams?: StreamData;
}

export interface StravaSettings {
  id?: number;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  autoFetchStrava?: boolean;
}

export interface StravaAthlete {
  id: number;
  firstname?: string;
  lastname?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: 'M' | 'F';
  premium?: boolean;
  created_at?: string;
  updated_at?: string;
  badge_type_id?: number;
  profile_medium?: string;
  profile?: string;
  friend?: string;
  follower?: string;
  blocked?: boolean;
  can_follow?: boolean;
  follower_count?: number;
  friend_count?: number;
  mutual_friend_count?: number;
  athlete_type?: number;
  date_preference?: string;
  measurement_preference?: string;
  clubs?: any[];
  ftp?: number;
  weight?: number;
  bikes?: any[];
  shoes?: any[];
  // Custom field for HR zone calculation
  birth_year?: number;
  // Custom field for LLM summary prefix
  llm_summary_prefix?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  max_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate: boolean;
  elev_high?: number;
  elev_low?: number;
  pr_count?: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map?: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  visibility?: string;
  flagged?: boolean;
  gear_id?: string;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  achievement_count?: number;
  suffer_score?: number;
  workout_type?: number;
  upload_id?: number;
  external_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StreamData {
  time?: number[];
  distance?: number[];
  latlng?: [number, number][];
  altitude?: number[];
  velocity_smooth?: number[];
  heartrate?: number[];
  cadence?: number[];
  watts?: number[];
  temp?: number[];
  moving?: boolean[];
  grade_smooth?: number[];
}

export interface ActivitySegment {
  id?: number;
  activityId: string;
  distanceKm: number;
  timeSecs: number;
  pace: number; // min/km
  avgSpeed: number; // km/h
  dataQuality: 'stream-precise' | 'split-approximate';
  calculatedAt: number;
}

export interface Segment {
  id?: number;
  name: string;
  activityId: string;
  startIndex: number;
  endIndex: number;
  distanceKm: number;
  elevationGain: number;
  polyline: [number, number][];
  createdBy: 'full-route' | 'custom-points';
  createdAt: number;
}

export interface SegmentEffort {
  id?: number;
  segmentId: number;
  activityId: string;
  timeSecs: number;
  avgPace: number;
  avgSpeed: number;
  avgHr?: number;
  maxHr?: number;
  avgWatts?: number;
  maxWatts?: number;
  elevationGain?: number;
  direction: 'forward' | 'reverse';
  matchedAt: number;
}

export interface RouteGroup {
  id?: number;
  name: string;
  fingerprint: string;
  activityId: string;
  createdAt: number;
}

export interface RouteActivity {
  id?: number;
  routeId: number;
  activityId: string;
  timeSecs: number;
  avgSpeed: number;
  avgPace: number;
  avgHr?: number;
  maxHr?: number;
  elevationGain: number;
  assignedAt: number;
}

export class AthleteInsightDB extends Dexie {
  settings!: Table<StravaSettings>;
  activities!: Table<StravaActivity>;
  activityDetails!: Table<ActivityDetail>;
  athlete!: Table<StravaAthlete>;
  activitySegments!: Table<ActivitySegment>;
  segments!: Table<Segment>;
  segmentEfforts!: Table<SegmentEffort>;
  routeGroups!: Table<RouteGroup>;
  routeActivities!: Table<RouteActivity>;
  allActivities!: Table<Activity>;
  allActivityDetails!: Table<ActivityDetail>;

  constructor() {
    super('AthleteInsightDB');
    
    // Version 4 - Fresh start with correct schema
    this.version(4).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname'
    });

    // Version 5 - Add activity segments for time-based personal records
    this.version(5).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname',
      activitySegments: '++id, activityId, distanceKm, pace'
    });

    // Version 6 - Add custom segments and segment efforts
    this.version(6).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname',
      activitySegments: '++id, activityId, distanceKm, pace',
      segments: '++id, name, activityId, createdAt',
      segmentEfforts: '++id, segmentId, activityId, timeSecs'
    });

    // Version 7 - Add route groups for full-route PR tracking
    this.version(7).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname',
      activitySegments: '++id, activityId, distanceKm, pace',
      segments: '++id, name, activityId, createdAt',
      segmentEfforts: '++id, segmentId, activityId, timeSecs',
      routeGroups: '++id, name, fingerprint, activityId',
      routeActivities: '++id, routeId, activityId'
    });

    // Version 8 - Unified activities table with UUID keys
    this.version(8).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname',
      allActivities: 'id, source, externalId, name, start_date_local, type',
      allActivityDetails: 'id, source, externalId, name, start_date_local, type',
      activitySegments: '++id, activityId, distanceKm, pace',
      segments: '++id, name, activityId, createdAt',
      segmentEfforts: '++id, segmentId, activityId, timeSecs',
      routeGroups: '++id, name, fingerprint, activityId',
      routeActivities: '++id, routeId, activityId'
    }).upgrade(async tx => {
      const idMap = new Map<number, string>();
      const oldActivities: StravaActivity[] = await tx.table('activities').toArray();

      for (const act of oldActivities) {
        const uuid = crypto.randomUUID();
        idMap.set(act.id, uuid);
        await tx.table('allActivities').add({
          id: uuid,
          source: 'strava' as const,
          externalId: act.id,
          name: act.name,
          distance: act.distance,
          moving_time: act.moving_time,
          elapsed_time: act.elapsed_time,
          total_elevation_gain: act.total_elevation_gain,
          type: act.type,
          start_date: act.start_date,
          start_date_local: act.start_date_local,
          average_speed: act.average_speed,
          max_speed: act.max_speed,
          average_heartrate: act.average_heartrate,
          max_heartrate: act.max_heartrate,
          average_cadence: act.average_cadence,
          average_watts: act.average_watts,
          max_watts: act.max_watts,
          kilojoules: act.kilojoules,
          device_watts: act.device_watts,
          has_heartrate: act.has_heartrate,
          elev_high: act.elev_high,
          elev_low: act.elev_low,
          pr_count: act.pr_count,
          kudos_count: act.kudos_count,
          comment_count: act.comment_count,
          athlete_count: act.athlete_count,
          photo_count: act.photo_count,
          map: act.map,
          trainer: act.trainer,
          commute: act.commute,
          manual: act.manual,
          private: act.private,
          visibility: act.visibility,
          flagged: act.flagged,
          gear_id: act.gear_id,
          start_latlng: act.start_latlng,
          end_latlng: act.end_latlng,
          achievement_count: act.achievement_count,
          suffer_score: act.suffer_score,
          workout_type: act.workout_type,
          upload_id: act.upload_id,
          external_id: act.external_id,
          created_at: act.created_at,
          updated_at: act.updated_at
        });
      }

      const oldDetails: any[] = await tx.table('activityDetails').toArray();
      for (const det of oldDetails) {
        const uuid = idMap.get(det.id as number);
        if (uuid) {
          const { id, description, calories, segment_efforts, splits_metric, splits_standard, laps, best_efforts, photos, stats_visibility, hide_from_home, device_name, embed_token, similar_activities, available_zones, streams, ...rest } = det;
          await tx.table('allActivityDetails').add({
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
          });
        }
      }

      const oldSegments: any[] = await tx.table('segments').toArray();
      const segmentIdMap = new Map<number, number>();
      for (const seg of oldSegments) {
        const newActivityId = idMap.get(seg.activityId);
        if (newActivityId) {
          const oldId = seg.id;
          delete seg.id;
          seg.activityId = newActivityId;
          const newId = await tx.table('segments').add(seg);
          if (oldId !== undefined) {
            segmentIdMap.set(oldId, newId);
          }
        }
      }

      const oldEfforts: any[] = await tx.table('segmentEfforts').toArray();
      for (const eff of oldEfforts) {
        const newActivityId = idMap.get(eff.activityId);
        if (newActivityId) {
          const newSegmentId = segmentIdMap.get(eff.segmentId) || eff.segmentId;
          delete eff.id;
          eff.activityId = newActivityId;
          eff.segmentId = newSegmentId;
          await tx.table('segmentEfforts').add(eff);
        }
      }

      const oldRouteGroups: any[] = await tx.table('routeGroups').toArray();
      for (const rg of oldRouteGroups) {
        const newActivityId = idMap.get(rg.activityId);
        if (newActivityId) {
          delete rg.id;
          rg.activityId = newActivityId;
          await tx.table('routeGroups').add(rg);
        }
      }

      const oldRouteActivities: any[] = await tx.table('routeActivities').toArray();
      for (const ra of oldRouteActivities) {
        const newActivityId = idMap.get(ra.activityId);
        if (newActivityId) {
          delete ra.id;
          ra.activityId = newActivityId;
          await tx.table('routeActivities').add(ra);
        }
      }

      const oldActivitySegments: any[] = await tx.table('activitySegments').toArray();
      for (const seg of oldActivitySegments) {
        const newActivityId = idMap.get(seg.activityId);
        if (newActivityId) {
          delete seg.id;
          seg.activityId = newActivityId;
          await tx.table('activitySegments').add(seg);
        }
      }
    });
  }

  async clearAllData(): Promise<void> {
    try {
      await this.transaction('rw', [this.settings, this.activities, this.activityDetails, this.athlete, this.allActivities, this.allActivityDetails, this.activitySegments, this.segments, this.segmentEfforts, this.routeGroups, this.routeActivities], async () => {
        await this.settings.clear();
        await this.activities.clear();
        await this.activityDetails.clear();
        await this.athlete.clear();
        await this.allActivities.clear();
        await this.allActivityDetails.clear();
        await this.activitySegments.clear();
        await this.segments.clear();
        await this.segmentEfforts.clear();
        await this.routeGroups.clear();
        await this.routeActivities.clear();
      });
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }

  async deleteLegacyTables(): Promise<void> {
    try {
      await this.transaction('rw', [this.activities, this.activityDetails], async () => {
        await this.activities.clear();
        await this.activityDetails.clear();
      });
    } catch (error) {
      console.error('Error clearing legacy tables:', error);
      throw error;
    }
  }

  async deleteDatabase(): Promise<void> {
    try {
      await this.delete();
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  }

  async exportData(): Promise<string> {
    try {
      const data = {
        version: 8,
        timestamp: new Date().toISOString(),
        settings: await this.settings.toArray(),
        allActivities: await this.allActivities.toArray(),
        allActivityDetails: await this.allActivityDetails.toArray(),
        athlete: await this.athlete.toArray(),
        activitySegments: await this.activitySegments.toArray(),
        segments: await this.segments.toArray(),
        segmentEfforts: await this.segmentEfforts.toArray(),
        routeGroups: await this.routeGroups.toArray(),
        routeActivities: await this.routeActivities.toArray()
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate data structure
      if (!data.version || !data.timestamp) {
        throw new Error('Invalid data format - missing version or timestamp');
      }

      // Clear existing data
      await this.clearAllData();

      // Import data
      await this.transaction('rw', [this.settings, this.allActivities, this.allActivityDetails, this.athlete, this.activitySegments, this.segments, this.segmentEfforts, this.routeGroups, this.routeActivities], async () => {
        if (data.settings && Array.isArray(data.settings)) {
          await this.settings.bulkAdd(data.settings);
        }
        if (data.allActivities && Array.isArray(data.allActivities)) {
          await this.allActivities.bulkAdd(data.allActivities);
        }
        if (data.allActivityDetails && Array.isArray(data.allActivityDetails)) {
          await this.allActivityDetails.bulkAdd(data.allActivityDetails);
        }
        if (data.athlete && Array.isArray(data.athlete)) {
          await this.athlete.bulkAdd(data.athlete);
        }
        if (data.activitySegments && Array.isArray(data.activitySegments)) {
          await this.activitySegments.bulkAdd(data.activitySegments);
        }
        if (data.segments && Array.isArray(data.segments)) {
          await this.segments.bulkAdd(data.segments);
        }
        if (data.segmentEfforts && Array.isArray(data.segmentEfforts)) {
          await this.segmentEfforts.bulkAdd(data.segmentEfforts);
        }
        if (data.routeGroups && Array.isArray(data.routeGroups)) {
          await this.routeGroups.bulkAdd(data.routeGroups);
        }
        if (data.routeActivities && Array.isArray(data.routeActivities)) {
          await this.routeActivities.bulkAdd(data.routeActivities);
        }
      });

      console.log('Data imported successfully:', {
        settings: data.settings?.length || 0,
        allActivities: data.allActivities?.length || 0,
        allActivityDetails: data.allActivityDetails?.length || 0,
        athlete: data.athlete?.length || 0,
        activitySegments: data.activitySegments?.length || 0,
        segments: data.segments?.length || 0,
        segmentEfforts: data.segmentEfforts?.length || 0,
        routeGroups: data.routeGroups?.length || 0,
        routeActivities: data.routeActivities?.length || 0
      });
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  async getDataStats(): Promise<{
    settings: number;
    allActivities: number;
    allActivityDetails: number;
    athlete: number;
    segments: number;
    segmentEfforts: number;
    totalSize: string;
  }> {
    try {
      const stats = {
        settings: await this.settings.count(),
        allActivities: await this.allActivities.count(),
        allActivityDetails: await this.allActivityDetails.count(),
        athlete: await this.athlete.count(),
        segments: await this.segments.count(),
        segmentEfforts: await this.segmentEfforts.count(),
        routeGroups: await this.routeGroups.count(),
        routeActivities: await this.routeActivities.count(),
        totalSize: 'Calculating...'
      };

      // Estimate size by exporting data and measuring
      try {
        const exported = await this.exportData();
        const sizeInBytes = new Blob([exported]).size;
        const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);
        stats.totalSize = `${sizeInMB} MB`;
      } catch (sizeError) {
        console.warn('Could not calculate database size:', sizeError);
        stats.totalSize = 'Unknown';
      }

      return stats;
    } catch (error) {
      console.error('Error getting data stats:', error);
      throw error;
    }
  }
}

export const db = new AthleteInsightDB();
