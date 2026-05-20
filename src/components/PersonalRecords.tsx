import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stravaService } from '../services/stravaService';
import { StravaActivity, ActivitySegment } from '../services/database';
import './PersonalRecords.css';

interface PersonalRecord {
  activity: StravaActivity;
  value: number;
  unit: string;
}

interface DistancePR {
  segment: ActivitySegment & { activity: StravaActivity };
  distance: number;
}

const PersonalRecords: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [prs, setPrs] = useState({
    longestDistance: null as PersonalRecord | null,
    highestSpeed: null as PersonalRecord | null,
    highestElevation: null as PersonalRecord | null,
    longestMovingTime: null as PersonalRecord | null,
    highestAveragePace: null as PersonalRecord | null,
  });
  const [distancePRs, setDistancePRs] = useState<Map<number, any[]>>(new Map());
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [segmentProgress, setSegmentProgress] = useState({ loaded: 0, total: 7 });
  const [expandedDistances, setExpandedDistances] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadPersonalRecords = async () => {
      try {
        setLoading(true);
        const authenticated = await stravaService.isAuthenticated();
        
        if (authenticated) {
          // Fetch all activities from cache/database
          const allActivities = await stravaService.getCachedActivities();
          setActivities(allActivities);
        } else {
          const cachedActivities = await stravaService.getCachedActivities();
          setActivities(cachedActivities);
        }
      } catch (err) {
        console.error('Error loading personal records:', err);
        setError('Failed to load personal records');
      } finally {
        setLoading(false);
      }
    };

    loadPersonalRecords();
  }, []);

  // Calculate personal records whenever activities change
  useEffect(() => {
    if (activities.length > 0) {
      calculatePersonalRecords();
      loadDistancePRs();
    }
  }, [activities]);

  // Auto-expand all distances once they're loaded
  useEffect(() => {
    if (distancePRs.size > 0 && expandedDistances.size === 0) {
      setExpandedDistances(new Set(getDistancesWithSegments()));
    }
  }, [distancePRs]);

  const loadDistancePRs = async () => {
    setLoadingSegments(true);
    setSegmentProgress({ loaded: 0, total: 7 });
    try {
      const distances = [5, 10, 15, 20, 21.1, 30, 42.2];
      const allPRs = new Map();
      
      for (let i = 0; i < distances.length; i++) {
        const distance = distances[i];
        // Get all segments for this distance, sorted by time (fastest first)
        const db = new (await import('../services/database')).AthleteInsightDB();
        const segments = await db.activitySegments
          .where('distanceKm')
          .equals(distance)
          .toArray();
        
        if (segments.length > 0) {
          // Sort by time and remove duplicates by activity ID, keeping fastest for each activity
          const uniqueByActivity = new Map<number, typeof segments[0]>();
          
          segments
            .sort((a, b) => a.timeSecs - b.timeSecs)
            .forEach(segment => {
              if (!uniqueByActivity.has(segment.activityId)) {
                uniqueByActivity.set(segment.activityId, segment);
              }
            });

          // Get top 5 unique segments
          const top5 = Array.from(uniqueByActivity.values())
            .slice(0, 5)
            .map(async (segment) => {
              // Enrich segment with activity data
              const activity = await db.activities.get(segment.activityId);
              // Calculate avgSpeed if missing (for legacy segments)
              const avgSpeed = segment.avgSpeed ?? ((segment.distanceKm / segment.timeSecs) * 3600);
              return {
                ...segment,
                avgSpeed,
                activity
              };
            });
          
          allPRs.set(distance, await Promise.all(top5));
        }
        setSegmentProgress({ loaded: i + 1, total: 7 });
      }
      
      setDistancePRs(allPRs);
    } catch (error) {
      console.error('Error loading distance PRs:', error);
    } finally {
      setLoadingSegments(false);
      setSegmentProgress({ loaded: 0, total: 7 });
    }
  };

  const getDistancesWithSegments = (): number[] => {
    const distances = [5, 10, 15, 20, 21.1, 30, 42.2];
    return distances.filter(d => distancePRs.has(d) && (distancePRs.get(d) || []).length > 0);
  };

  const calculatePersonalRecords = () => {
    if (activities.length === 0) return;

    // Longest Distance
    const longestDistanceActivity = activities.reduce((prev, current) =>
      (prev.distance || 0) > (current.distance || 0) ? prev : current, activities[0]
    );

    // Highest Speed
    const highestSpeedActivity = activities.reduce((prev, current) =>
      (prev.max_speed || 0) > (current.max_speed || 0) ? prev : current, activities[0]
    );

    // Highest Elevation Gain
    const highestElevationActivity = activities.reduce((prev, current) =>
      (prev.total_elevation_gain || 0) > (current.total_elevation_gain || 0) ? prev : current, activities[0]
    );

    // Longest Moving Time
    const longestMovingTimeActivity = activities.reduce((prev, current) =>
      (prev.moving_time || 0) > (current.moving_time || 0) ? prev : current, activities[0]
    );

    // Highest Average Pace (lowest value in min/km, only for running activities)
    const runningActivities = activities.filter(a => 
      a.type?.toLowerCase() === 'run' || a.type?.toLowerCase() === 'trail_run'
    );
    
    const highestAveragePaceActivity = runningActivities.length > 0 
      ? runningActivities.reduce((prev, current) => {
          const prevPace = (prev.distance && prev.moving_time) 
            ? (prev.moving_time / 60) / (prev.distance / 1000) 
            : Infinity;
          const currentPace = (current.distance && current.moving_time)
            ? (current.moving_time / 60) / (current.distance / 1000)
            : Infinity;
          return prevPace < currentPace ? prev : current;
        }, runningActivities[0])
      : null;

    setPrs({
      longestDistance: {
        activity: longestDistanceActivity,
        value: (longestDistanceActivity.distance || 0) / 1000,
        unit: 'km'
      },
      highestSpeed: {
        activity: highestSpeedActivity,
        value: highestSpeedActivity.max_speed || 0,
        unit: 'km/h'
      },
      highestElevation: {
        activity: highestElevationActivity,
        value: highestElevationActivity.total_elevation_gain || 0,
        unit: 'm'
      },
      longestMovingTime: {
        activity: longestMovingTimeActivity,
        value: longestMovingTimeActivity.moving_time || 0,
        unit: 's'
      },
      highestAveragePace: highestAveragePaceActivity ? {
        activity: highestAveragePaceActivity,
        value: (highestAveragePaceActivity.distance && highestAveragePaceActivity.moving_time)
          ? (highestAveragePaceActivity.moving_time / 60) / (highestAveragePaceActivity.distance / 1000)
          : 0,
        unit: 'min/km'
      } : null,
    });
  };

  const formatDistance = (km: number): string => {
    return (km).toFixed(2);
  };

  const formatSpeed = (speed: number): string => {
    return speed.toFixed(2);
  };

  const formatElevation = (elevation: number): string => {
    return Math.round(elevation).toString();
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatPace = (minPerKm: number): string => {
    const minutes = Math.floor(minPerKm);
    const seconds = Math.round((minPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatSegmentTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatSegmentPace = (minPerKm: number): string => {
    const minutes = Math.floor(minPerKm);
    const seconds = Math.round((minPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatAvgSpeed = (speedKmh: number): string => {
    return `${speedKmh?.toFixed(2)} km/h`;
  };

  const renderPRCard = (
    title: string,
    pr: PersonalRecord | null,
    formatter: (value: number) => string
  ) => {
    if (!pr) {
      return (
        <div className="pr-card">
          <h3>{title}</h3>
          <p className="no-data">No data available</p>
        </div>
      );
    }

    const handleCardClick = () => {
      navigate(`/activity/${pr.activity.id}`);
    };

    return (
      <button 
        className="pr-card" 
        onClick={handleCardClick}
        type="button"
        title={`View details for ${pr.activity.name}`}
      >
        <h3>{title}</h3>
        <div className="pr-value">
          <span className="value">{formatter(pr.value)}</span>
          <span className="unit">{pr.unit}</span>
        </div>
        <div className="pr-activity">
          <p className="activity-name">{pr.activity.name}</p>
          <p className="activity-date">{formatDate(pr.activity.start_date_local)}</p>
          <p className="activity-type">{pr.activity.type}</p>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="personal-records-container">
        <div className="loading">Loading personal records...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="personal-records-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="personal-records-container">
        <div className="no-activities">No activities available</div>
      </div>
    );
  }

  return (
    <div className="personal-records-container">
      <h1>Personal Records</h1>
      <div className="pr-stats">
        <p>Total Activities: {activities.length}</p>
      </div>

      {/* Activity-Based Records */}
      <div className="pr-section">
        <h2>Activity Records</h2>
        <div className="pr-grid">
          {renderPRCard(
            'Longest Distance',
            prs.longestDistance,
            formatDistance
          )}
          {renderPRCard(
            'Highest Speed',
            prs.highestSpeed,
            formatSpeed
          )}
          {renderPRCard(
            'Highest Elevation',
            prs.highestElevation,
            formatElevation
          )}
          {renderPRCard(
            'Longest Moving Time',
            prs.longestMovingTime,
            formatTime
          )}
          {renderPRCard(
            'Fastest Pace',
            prs.highestAveragePace,
            formatPace
          )}
        </div>
      </div>

      {/* Distance-Based Records */}
      <div className="pr-section">
        <h2>
          Distance-Based Records - Top 5 per Distance
          {loadingSegments && (
            <span className="loading-badge">
              Loading... ({segmentProgress.loaded}/{segmentProgress.total})
            </span>
          )}
        </h2>
        {getDistancesWithSegments().length > 0 ? (
          <div className="distance-sections">
            {getDistancesWithSegments().map((distance) => (
              <div key={distance} className="distance-section">
                <button
                  className="distance-section-header"
                  onClick={() => {
                    const newSet = new Set(expandedDistances);
                    if (newSet.has(distance)) {
                      newSet.delete(distance);
                    } else {
                      newSet.add(distance);
                    }
                    setExpandedDistances(newSet);
                  }}
                  type="button"
                >
                  <span className="distance-label">{distance}km</span>
                  <span className="expansion-arrow">{expandedDistances.has(distance) ? '▼' : '▶'}</span>
                  <span className="segment-count">({(distancePRs.get(distance) || []).length} records)</span>
                </button>
                {expandedDistances.has(distance) && (
                  <div className="distance-pr-list">
                    <div className="distance-pr-header">
                      <div className="rank">Rank</div>
                      <div className="time">Time</div>
                      <div className="pace">Pace</div>
                      <div className="speed">Speed</div>
                      <div className="activity">Activity</div>
                      <div className="date">Date</div>
                      <div className="quality">Quality</div>
                    </div>
                    {(distancePRs.get(distance) || []).map((segment, index) => (
                      <button
                        key={`${distance}-${segment.activityId}`}
                        className="distance-pr-row"
                        onClick={() => segment.activity && navigate(`/activity/${segment.activity.id}`)}
                        type="button"
                        title="View activity"
                      >
                        <div className="rank">#{index + 1}</div>
                        <div className="time">{formatSegmentTime(segment.timeSecs)}</div>
                        <div className="pace">{formatSegmentPace(segment.pace)}</div>
                        <div className="speed">{formatAvgSpeed(segment.avgSpeed)}</div>
                        <div className="activity">
                          <span className="activity-id">{segment.activityId}</span> {segment.activity?.name || 'Unknown'}
                        </div>
                        <div className="date">{segment.activity ? formatDate(segment.activity.start_date_local) : '-'}</div>
                        <div className="quality">{segment.dataQuality === 'stream-precise' ? '🎯 GPS' : '📊 Est'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data" style={{ textAlign: 'center', padding: '2rem' }}>
            No distance records found
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalRecords;
