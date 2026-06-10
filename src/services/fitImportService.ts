import { db, Activity, ActivityDetail } from './database';

export interface ParsedFitActivity {
  summary: Activity;
  details: ActivityDetail;
}

export interface FitFileEntry {
  file: File;
  name: string;
  size: number;
  status: 'queued' | 'parsing' | 'storing' | 'imported' | 'error' | 'duplicate';
  error?: string;
  activity?: ParsedFitActivity;
}

export class FitImportService {
  async parseFitFile(file: File): Promise<ParsedFitActivity> {
    const arrayBuffer = await file.arrayBuffer();
    
    const FitParser = (await import('fit-file-parser')).default;

    return new Promise((resolve, reject) => {
      try {
        const fitParser = new FitParser({
          force: true,
          speedUnit: 'm/s',
          lengthUnit: 'm',
          elapsedRecordField: true,
        });

        fitParser.parse(arrayBuffer, (error: any, data: any) => {
          if (error) {
            reject(new Error(`FIT parse error: ${error}`));
            return;
          }

          if (!data || !data.sessions || data.sessions.length === 0) {
            reject(new Error('No session data found in FIT file'));
            return;
          }

          try {
            const result = this.mapFitDataToActivity(data, file.name);
            resolve(result);
          } catch (mapError) {
            reject(new Error(`Failed to map FIT data: ${mapError}`));
          }
        });
      } catch (err) {
        reject(new Error(`Failed to initialize FIT parser: ${err}`));
      }
    });
  }

  private mapFitDataToActivity(data: any, fileName: string): ParsedFitActivity {
    const session = data.sessions[0];
    const records = data.records || [];

    const sportMap: Record<string, string> = {
      running: 'Run',
      cycling: 'Ride',
      swimming: 'Swim',
      hiking: 'Hike',
      walking: 'Walk',
      mountain_biking: 'MountainBikeRide',
      trail_running: 'TrailRun',
      virtual_ride: 'VirtualRide',
      virtual_run: 'VirtualRun',
      workout: 'Workout',
      other: 'Other',
    };

    const sport = session.sport || 'other';
    const subSport = session.sub_sport || '';
    const type = sportMap[sport] || sportMap[subSport] || 'Other';

    const uuid = crypto.randomUUID();
    const startDate = new Date(
      (session.start_time || data.file_id?.time_created || new Date()).toString()
    ).toISOString();

    const distance = session.total_distance || 0;
    const movingTime = session.total_timer_time || session.total_elapsed_time || 0;
    const elapsedTime = session.total_elapsed_time || movingTime;

    const latlng: [number, number][] = [];
    const time: number[] = [];
    const heartrate: number[] = [];
    const cadence: number[] = [];
    const watts: number[] = [];
    const altitude: number[] = [];
    const speed: number[] = [];

    for (const record of records) {
      if (record.position_lat !== undefined && record.position_long !== undefined) {
        const lat = this.semicirclesToDegrees(record.position_lat);
        const lng = this.semicirclesToDegrees(record.position_long);
        if (lat !== 0 || lng !== 0) {
          latlng.push([lat, lng]);
        }
      }

      if (record.timestamp !== undefined) {
        time.push(
          (new Date(record.timestamp.toString()).getTime() -
            new Date(startDate).getTime()) /
            1000
        );
      }

      if (record.heart_rate !== undefined) {
        heartrate.push(record.heart_rate);
      }
      if (record.cadence !== undefined) {
        cadence.push(record.cadence);
      }
      if (record.power !== undefined) {
        watts.push(record.power);
      }
      if (record.altitude !== undefined) {
        altitude.push(record.altitude);
      }
      if (record.speed !== undefined) {
        speed.push(record.speed);
      }
      if (record.enhanced_speed !== undefined) {
        speed.push(record.enhanced_speed);
      }
    }

    const avgSpeed = speed.length > 0
      ? speed.reduce((a, b) => a + b, 0) / speed.length
      : distance > 0 && movingTime > 0
        ? distance / movingTime
        : 0;

    const avgHr = heartrate.length > 0
      ? heartrate.reduce((a, b) => a + b, 0) / heartrate.length
      : undefined;

    const avgCad = cadence.length > 0
      ? cadence.reduce((a, b) => a + b, 0) / cadence.length
      : undefined;

    const avgWatts = watts.length > 0
      ? watts.reduce((a, b) => a + b, 0) / watts.length
      : undefined;

    const elevGain = session.total_ascent || 0;
    const elevHigh = altitude.length > 0 ? Math.max(...altitude) : undefined;
    const elevLow = altitude.length > 0 ? Math.min(...altitude) : undefined;

    const name = session.sport ? `${session.sport} Activity` : fileName.replace(/\.fit$/i, '');

    const summary: Activity = {
      id: uuid,
      source: 'device',
      name,
      distance,
      moving_time: Math.round(movingTime),
      elapsed_time: Math.round(elapsedTime),
      total_elevation_gain: elevGain,
      type,
      start_date: startDate,
      start_date_local: startDate,
      average_speed: avgSpeed,
      max_speed: session.max_speed || (speed.length > 0 ? Math.max(...speed) : 0),
      average_heartrate: avgHr,
      max_heartrate: session.max_heart_rate || (heartrate.length > 0 ? Math.max(...heartrate) : undefined),
      average_cadence: avgCad,
      average_watts: avgWatts,
      max_watts: session.max_power || (watts.length > 0 ? Math.max(...watts) : undefined),
      kilojoules: session.total_work ? session.total_work / 1000 : undefined,
      device_watts: avgWatts !== undefined,
      has_heartrate: heartrate.length > 0,
      elev_high: elevHigh,
      elev_low: elevLow,
      kudos_count: 0,
      comment_count: 0,
      athlete_count: 0,
      photo_count: 0,
      start_latlng: latlng.length > 0 ? latlng[0] : undefined,
      end_latlng: latlng.length > 0 ? latlng[latlng.length - 1] : undefined,
      pr_count: 0,
      trainer: false,
      commute: false,
      manual: false,
      private: false,
      flagged: false,
      achievement_count: 0,
      suffer_score: 0,
    };

    const details: ActivityDetail = {
      ...summary,
      device_name: data.file_id?.manufacturer ? this.getManufacturerName(data.file_id.manufacturer) : undefined,
      streams: {
        time: time.length > 0 ? time : undefined,
        distance: records.length > 0 ? records.map((r: any, i: number) => (i / Math.max(records.length - 1, 1)) * distance) : undefined,
        latlng: latlng.length > 0 ? latlng : undefined,
        altitude: altitude.length > 0 ? altitude : undefined,
        velocity_smooth: speed.length > 0 ? speed : undefined,
        heartrate: heartrate.length > 0 ? heartrate : undefined,
        cadence: cadence.length > 0 ? cadence : undefined,
        watts: watts.length > 0 ? watts : undefined,
      },
    };

    return { summary, details };
  }

  private semicirclesToDegrees(semicircles: number): number {
    return semicircles * (180 / Math.pow(2, 31));
  }

  private getManufacturerName(id: number): string {
    const manufacturers: Record<number, string> = {
      1: 'Garmin',
      2: 'Garmin (FR405, FR50)',
      3: 'Garmin (FR60)',
      4: 'Garmin (FR310XT)',
      5: 'Garmin (FR110)',
      6: 'Garmin (FR610)',
      7: 'Garmin (FR10)',
      8: 'Garmin (FR910XT)',
      13: 'Tacx',
      15: 'Magellan',
      18: 'Polar Electro',
      19: 'Suunto',
      20: 'Suunto (t6c)',
      21: 'Suunto (t6)',
      22: 'Suunto (t6d)',
      23: 'Dynastream',
      24: 'Dynastream (Pro)',
      25: 'Dynastream (AntFS)',
      31: 'Wahoo Fitness',
      34: 'Zwift',
      38: 'Lezyne',
      40: 'Strava',
      44: 'TrainingPeaks',
      47: 'Pear Sports',
      48: 'Stryd',
      62: 'Bryton',
      64: '4iiii',
      72: 'Coros',
      73: 'Hammerhead',
      76: 'Form',
      82: 'Saris',
      255: 'Development',
      257: 'Health',
    };
    return manufacturers[id] || `Manufacturer ${id}`;
  }

  async checkDuplicate(startDate: string, duration: number): Promise<boolean> {
    const allActivities = await db.allActivities.toArray();
    return allActivities.some(a => {
      const sameSource = a.source === 'device';
      const sameStart = Math.abs(new Date(a.start_date).getTime() - new Date(startDate).getTime()) < 5000;
      const sameDuration = Math.abs(a.moving_time - duration) < 30;
      return sameSource && sameStart && sameDuration;
    });
  }

  async storeActivity(activity: Activity, details: ActivityDetail): Promise<void> {
    await db.transaction('rw', [db.allActivities, db.allActivityDetails], async () => {
      await db.allActivities.add(activity);
      await db.allActivityDetails.add(details);
    });
  }
}

export const fitImportService = new FitImportService();
