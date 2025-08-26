import Dexie, { Table } from 'dexie';

export interface StravaSettings {
  id?: number;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
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

export interface ActivityDetail extends StravaActivity {
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

export class AthleteInsightDB extends Dexie {
  settings!: Table<StravaSettings>;
  activities!: Table<StravaActivity>;
  activityDetails!: Table<ActivityDetail>;
  athlete!: Table<StravaAthlete>;

  constructor() {
    super('AthleteInsightDB');
    
    // Version 4 - Fresh start with correct schema
    this.version(4).stores({
      settings: '++id, clientId, clientSecret',
      activities: 'id, name, start_date_local, type',
      activityDetails: 'id, name, start_date_local, type',
      athlete: 'id, firstname, lastname'
    });
  }

  async clearAllData(): Promise<void> {
    try {
      await this.transaction('rw', this.settings, this.activities, this.activityDetails, this.athlete, async () => {
        await this.settings.clear();
        await this.activities.clear();
        await this.activityDetails.clear();
        await this.athlete.clear();
      });
    } catch (error) {
      console.error('Error clearing database:', error);
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
        version: 4,
        timestamp: new Date().toISOString(),
        settings: await this.settings.toArray(),
        activities: await this.activities.toArray(),
        activityDetails: await this.activityDetails.toArray(),
        athlete: await this.athlete.toArray()
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
      await this.transaction('rw', this.settings, this.activities, this.activityDetails, this.athlete, async () => {
        if (data.settings && Array.isArray(data.settings)) {
          await this.settings.bulkAdd(data.settings);
        }
        if (data.activities && Array.isArray(data.activities)) {
          await this.activities.bulkAdd(data.activities);
        }
        if (data.activityDetails && Array.isArray(data.activityDetails)) {
          await this.activityDetails.bulkAdd(data.activityDetails);
        }
        if (data.athlete && Array.isArray(data.athlete)) {
          await this.athlete.bulkAdd(data.athlete);
        }
      });

      console.log('Data imported successfully:', {
        settings: data.settings?.length || 0,
        activities: data.activities?.length || 0,
        activityDetails: data.activityDetails?.length || 0,
        athlete: data.athlete?.length || 0
      });
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  async getDataStats(): Promise<{
    settings: number;
    activities: number;
    activityDetails: number;
    athlete: number;
    totalSize: string;
  }> {
    try {
      const stats = {
        settings: await this.settings.count(),
        activities: await this.activities.count(),
        activityDetails: await this.activityDetails.count(),
        athlete: await this.athlete.count(),
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
