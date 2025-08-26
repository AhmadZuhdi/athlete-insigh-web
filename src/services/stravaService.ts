import { db, StravaSettings, StravaActivity, ActivityDetail, StreamData, StravaAthlete } from './database';

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
    }

    return activities;
  }

  async getActivityDetail(activityId: number): Promise<ActivityDetail> {
    // First try to get from IndexedDB
    const cachedDetail = await db.activityDetails.get(activityId);
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
    
    // Save to IndexedDB
    await db.activityDetails.put(activityDetail);

    return activityDetail;
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

  async clearCache(): Promise<void> {
    await db.activities.clear();
    await db.activityDetails.clear();
  }

  async clearActivityDetailCache(activityId?: number): Promise<void> {
    if (activityId) {
      await db.activityDetails.delete(activityId);
    } else {
      await db.activityDetails.clear();
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
}

export const stravaService = StravaService.getInstance();
