/**
 * Utility functions for segment time calculations
 * Useful for testing and debugging segment extraction
 */

import { ActivityDetail, ActivitySegment } from '../services/database';

/**
 * Format segment time to readable string
 * @param timeSecs - Time in seconds
 * @returns Formatted string (e.g., "42:30" or "1:23:45")
 */
export const formatSegmentTime = (timeSecs: number): string => {
  const hours = Math.floor(timeSecs / 3600);
  const minutes = Math.floor((timeSecs % 3600) / 60);
  const seconds = Math.floor(timeSecs % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Format pace to readable string
 * @param paceMinPerKm - Pace in min/km
 * @returns Formatted string (e.g., "4:23 /km")
 */
export const formatPace = (paceMinPerKm: number): string => {
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
};

/**
 * Get data quality label for display
 */
export const getQualityLabel = (quality: 'stream-precise' | 'split-approximate'): string => {
  return quality === 'stream-precise' ? 'GPS Data' : 'Estimated';
};

/**
 * Format segment for display in logs/debugging
 */
export const formatSegmentForDebug = (segment: ActivitySegment): string => {
  return `${segment.distanceKm}km: ${formatSegmentTime(segment.timeSecs)} @ ${formatPace(segment.pace)} [${getQualityLabel(segment.dataQuality)}]`;
};

/**
 * Check if activity has sufficient stream data for segment extraction
 */
export const hasStreamData = (activity: ActivityDetail | null): boolean => {
  if (!activity?.streams) return false;
  const { time, distance } = activity.streams;
  return !!(time && time.length > 0 && distance && distance.length > 0);
};

/**
 * Check if activity has split data for segment extraction
 */
export const hasSplitData = (activity: ActivityDetail | null): boolean => {
  if (!activity?.splits_metric) return false;
  return activity.splits_metric.length > 0;
};

/**
 * Get activity data availability summary
 */
export const getActivityDataAvailability = (
  activity: ActivityDetail | null
): { streams: boolean; splits: boolean; heartRate: boolean } => {
  return {
    streams: hasStreamData(activity),
    splits: hasSplitData(activity),
    heartRate: !!(activity?.streams?.heartrate && activity.streams.heartrate.length > 0)
  };
};
