import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { stravaService } from '../services/stravaService';
import { ActivityDetail as ActivityDetailType, StravaAthlete } from '../services/database';

const ActivityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityDetailType | null>(null);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonPeriod, setComparisonPeriod] = useState<'month' | 'year'>('month');
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadActivityDetail(parseInt(id));
      loadAthlete();
    }
  }, [id]);

  useEffect(() => {
    if (activity && athlete?.birth_year) {
      loadComparisonData();
    }
  }, [activity, athlete, comparisonPeriod]);

  const loadActivityDetail = async (activityId: number, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      if (forceRefresh) {
        await stravaService.clearActivityDetailCache(activityId);
      }
      
      const detail = await stravaService.getActivityDetail(activityId);
      setActivity(detail);
    } catch (error) {
      console.error('Error loading activity detail:', error);
      setError(error instanceof Error ? error.message : 'Failed to load activity detail');
    } finally {
      setLoading(false);
    }
  };

  const loadAthlete = async () => {
    try {
      const athleteData = await stravaService.getAthlete();
      setAthlete(athleteData);
    } catch (error) {
      console.error('Error loading athlete:', error);
    }
  };

  const loadComparisonData = async () => {
    if (!activity || !athlete?.birth_year) return;

    try {
      // Get all cached activities
      const allActivities = await stravaService.getCachedActivities();
      
      // Filter activities by period
      const activityDate = new Date(activity.start_date_local);
      const filteredActivities = allActivities.filter(act => {
        const actDate = new Date(act.start_date_local);
        if (comparisonPeriod === 'month') {
          return actDate.getFullYear() === activityDate.getFullYear() && 
                 actDate.getMonth() === activityDate.getMonth() &&
                 act.id !== activity.id; // Exclude current activity
        } else {
          return actDate.getFullYear() === activityDate.getFullYear() &&
                 act.id !== activity.id; // Exclude current activity
        }
      });

      // Calculate relative effort for each activity that has heart rate data
      const comparisonResults: any[] = [];
      
      for (const act of filteredActivities) {
        try {
          // Try to get detailed activity data
          const detailedAct = await stravaService.getActivityDetail(act.id);
          
          if (detailedAct.streams?.heartrate && athlete.birth_year) {
            const maxHR = calculateMaxHeartRate(athlete.birth_year);
            const zones = getHeartRateZones(maxHR);
            const heartRateData = detailedAct.streams.heartrate;
            const timeData = detailedAct.streams.time || [];

            const zoneMultipliers = { zone1: 1, zone2: 2, zone3: 3, zone4: 5, zone5: 8 };
            let totalEffortPoints = 0;
            let totalTimeInZones = 0;

            heartRateData.forEach((hr, index) => {
              if (hr && hr > 0) {
                const timeIncrement = index < timeData.length - 1 ? timeData[index + 1] - timeData[index] : 1;
                totalTimeInZones += timeIncrement;
                
                if (hr <= zones.zone1.max) {
                  totalEffortPoints += timeIncrement * zoneMultipliers.zone1;
                } else if (hr <= zones.zone2.max) {
                  totalEffortPoints += timeIncrement * zoneMultipliers.zone2;
                } else if (hr <= zones.zone3.max) {
                  totalEffortPoints += timeIncrement * zoneMultipliers.zone3;
                } else if (hr <= zones.zone4.max) {
                  totalEffortPoints += timeIncrement * zoneMultipliers.zone4;
                } else {
                  totalEffortPoints += timeIncrement * zoneMultipliers.zone5;
                }
              }
            });

            comparisonResults.push({
              id: act.id,
              name: act.name.length > 20 ? act.name.substring(0, 20) + '...' : act.name,
              date: new Date(act.start_date_local).toLocaleDateString(),
              type: act.type,
              effort: Math.round(totalEffortPoints),
              distance: act.distance / 1000,
              isCurrentActivity: false
            });
          }
        } catch (error) {
          // Skip activities that can't be loaded
          console.log(`Skipping activity ${act.id} - no detailed data available`);
        }
      }

      // Add current activity to comparison
      const currentEffort = calculateRelativeEffortPoints();
      if (currentEffort) {
        comparisonResults.push({
          id: activity.id,
          name: activity.name.length > 20 ? activity.name.substring(0, 20) + '...' : activity.name,
          date: new Date(activity.start_date_local).toLocaleDateString(),
          type: activity.type,
          effort: currentEffort.totalPoints,
          distance: activity.distance / 1000,
          isCurrentActivity: true
        });
      }

      // Sort by date (oldest first for chronological timeline)
      comparisonResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setComparisonData(comparisonResults);
    } catch (error) {
      console.error('Error loading comparison data:', error);
    }
  };

  const handleRefresh = () => {
    if (id) {
      loadActivityDetail(parseInt(id), true);
    }
  };

  // Heart Rate Zone Calculations
  const calculateMaxHeartRate = (birthYear: number): number => {
    const age = new Date().getFullYear() - birthYear;
    return 220 - age; // Simple formula: 220 - age
  };

  const getHeartRateZones = (maxHR: number) => {
    return {
      zone1: { min: 0, max: Math.round(maxHR * 0.6), name: 'Recovery (Zone 1)', color: '#4FC3F7' },
      zone2: { min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7), name: 'Aerobic Base (Zone 2)', color: '#66BB6A' },
      zone3: { min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8), name: 'Aerobic (Zone 3)', color: '#FFEB3B' },
      zone4: { min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9), name: 'Lactate Threshold (Zone 4)', color: '#FF9800' },
      zone5: { min: Math.round(maxHR * 0.9), max: maxHR, name: 'Neuromuscular Power (Zone 5)', color: '#F44336' }
    };
  };

  const getHeartRateZoneDistribution = () => {
    if (!activity?.streams?.heartrate || !athlete?.birth_year) {
      return [];
    }

    const maxHR = calculateMaxHeartRate(athlete.birth_year);
    const zones = getHeartRateZones(maxHR);
    const heartRateData = activity.streams.heartrate;
    const timeData = activity.streams.time || [];

    // Initialize zone counters
    const zoneDistribution = {
      zone1: { time: 0, name: zones.zone1.name, color: zones.zone1.color },
      zone2: { time: 0, name: zones.zone2.name, color: zones.zone2.color },
      zone3: { time: 0, name: zones.zone3.name, color: zones.zone3.color },
      zone4: { time: 0, name: zones.zone4.name, color: zones.zone4.color },
      zone5: { time: 0, name: zones.zone5.name, color: zones.zone5.color }
    };

    // Calculate time in each zone
    heartRateData.forEach((hr, index) => {
      if (hr && hr > 0) {
        const timeIncrement = index < timeData.length - 1 ? timeData[index + 1] - timeData[index] : 1;
        
        if (hr <= zones.zone1.max) {
          zoneDistribution.zone1.time += timeIncrement;
        } else if (hr <= zones.zone2.max) {
          zoneDistribution.zone2.time += timeIncrement;
        } else if (hr <= zones.zone3.max) {
          zoneDistribution.zone3.time += timeIncrement;
        } else if (hr <= zones.zone4.max) {
          zoneDistribution.zone4.time += timeIncrement;
        } else {
          zoneDistribution.zone5.time += timeIncrement;
        }
      }
    });

    // Convert to chart format
    return Object.entries(zoneDistribution).map(([zone, data]) => ({
      zone: data.name,
      time: Math.round(data.time / 60), // Convert to minutes
      percentage: Math.round((data.time / (timeData[timeData.length - 1] || 1)) * 100),
      color: data.color
    })).filter(item => item.time > 0);
  };

  const calculateRelativeEffortPoints = () => {
    if (!activity?.streams?.heartrate || !athlete?.birth_year) {
      return null;
    }

    const maxHR = calculateMaxHeartRate(athlete.birth_year);
    const zones = getHeartRateZones(maxHR);
    const heartRateData = activity.streams.heartrate;
    const timeData = activity.streams.time || [];

    // Zone multipliers for effort calculation
    const zoneMultipliers = {
      zone1: 1,   // Recovery
      zone2: 2,   // Aerobic Base
      zone3: 3,   // Aerobic
      zone4: 5,   // Lactate Threshold
      zone5: 8    // Neuromuscular Power
    };

    let totalEffortPoints = 0;
    let totalTimeInZones = 0;

    // Calculate effort points for each heart rate reading
    heartRateData.forEach((hr, index) => {
      if (hr && hr > 0) {
        const timeIncrement = index < timeData.length - 1 ? timeData[index + 1] - timeData[index] : 1;
        totalTimeInZones += timeIncrement;
        
        if (hr <= zones.zone1.max) {
          totalEffortPoints += timeIncrement * zoneMultipliers.zone1;
        } else if (hr <= zones.zone2.max) {
          totalEffortPoints += timeIncrement * zoneMultipliers.zone2;
        } else if (hr <= zones.zone3.max) {
          totalEffortPoints += timeIncrement * zoneMultipliers.zone3;
        } else if (hr <= zones.zone4.max) {
          totalEffortPoints += timeIncrement * zoneMultipliers.zone4;
        } else {
          totalEffortPoints += timeIncrement * zoneMultipliers.zone5;
        }
      }
    });

    // Calculate relative effort score (normalized per hour)
    const relativeEffortScore = totalTimeInZones > 0 ? Math.round((totalEffortPoints / totalTimeInZones) * 3600) : 0;
    const intensityFactor = totalTimeInZones > 0 ? (totalEffortPoints / totalTimeInZones) / 3 : 0; // Normalized intensity
    
    return {
      totalPoints: Math.round(totalEffortPoints),
      relativeScore: relativeEffortScore,
      intensityFactor: Math.round(intensityFactor * 100) / 100,
      timeInZones: Math.round(totalTimeInZones / 60), // in minutes
      zoneMultipliers
    };
  };

  const formatDistance = (distance: number) => {
    return (distance / 1000).toFixed(2) + ' km';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatPace = (metersPerSecond: number) => {
    if (metersPerSecond === 0) return 'N/A';
    const secondsPerKm = 1000 / metersPerSecond;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatSpeed = (metersPerSecond: number) => {
    return (metersPerSecond * 3.6).toFixed(1) + ' km/h';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAnalysisData = () => {
    if (!activity) return [];

    // First try to use stream data if available
    if (activity.streams?.time && activity.streams?.distance) {
      const data: any[] = [];
      const timeData = activity.streams.time;
      const distanceData = activity.streams.distance;
      const heartrateData = activity.streams.heartrate;
      const altitudeData = activity.streams.altitude;
      const velocityData = activity.streams.velocity_smooth;
      
      // Create data points every kilometer or every ~50 time points
      const interval = Math.max(1, Math.floor(timeData.length / 50));
      
      for (let i = 0; i < timeData.length; i += interval) {
        const distance = distanceData[i] / 1000; // Convert to km
        const time = timeData[i];
        const speed = velocityData?.[i] || 0;
        const pace = speed > 0 ? (1000 / speed) / 60 : 0; // min/km
        
        data.push({
          km: distance,
          time: time,
          pace: pace,
          speed: speed * 3.6, // km/h
          elevation: altitudeData?.[i] || 0,
          heartrate: heartrateData?.[i] || 0
        });
      }
      
      return data;
    }

    // Fallback to splits data if streams not available
    const data: any[] = [];
    const splits = activity.splits_metric || [];
    
    splits.forEach((split: any, index: number) => {
      data.push({
        km: index + 1,
        pace: split.average_speed ? 1000 / split.average_speed / 60 : 0,
        elevation: split.elevation_difference || 0,
        heartrate: split.average_heartrate || 0,
        speed: split.average_speed ? split.average_speed * 3.6 : 0
      });
    });

    return data;
  };

  const getElevationData = () => {
    if (!activity?.streams?.distance || !activity?.streams?.altitude) {
      return [];
    }

    const data: any[] = [];
    const distanceData = activity.streams.distance;
    const altitudeData = activity.streams.altitude;
    
    // Sample data points for visualization
    const interval = Math.max(1, Math.floor(distanceData.length / 100));
    
    for (let i = 0; i < distanceData.length; i += interval) {
      data.push({
        distance: distanceData[i] / 1000, // Convert to km
        altitude: altitudeData[i]
      });
    }
    
    return data;
  };

  const getHeartRateData = () => {
    if (!activity?.streams?.time || !activity?.streams?.heartrate) {
      return [];
    }

    const data: any[] = [];
    const timeData = activity.streams.time;
    const heartrateData = activity.streams.heartrate;
    
    // Sample data points for visualization (every ~100 points)
    const interval = Math.max(1, Math.floor(timeData.length / 100));
    
    for (let i = 0; i < timeData.length; i += interval) {
      data.push({
        time: timeData[i] / 60, // Convert to minutes
        heartrate: heartrateData[i]
      });
    }
    
    return data;
  };

  const getEffortAnalysis = () => {
    if (!activity) return null;

    const totalTime = activity.moving_time;
    const distance = activity.distance / 1000;
    const elevationGain = activity.total_elevation_gain;
    
    return {
      efficiency: distance / (totalTime / 3600), // km/h
      elevationRate: elevationGain / distance, // m per km
      intensityScore: activity.suffer_score || 0
    };
  };

  const generateLLMSummary = async () => {
    if (!activity) return '';
    
    const effortData = calculateRelativeEffortPoints();
    const zoneData = getHeartRateZoneDistribution();
    
    // Format date
    const activityDate = new Date(activity.start_date_local).toISOString().split('T')[0];
    
    // Format times
    const movingTime = formatDuration(activity.moving_time);
    const totalTime = formatDuration(activity.elapsed_time);
    
    // Format HR zones
    let hrZonesText = '';
    if (zoneData.length > 0) {
      hrZonesText = '[' + zoneData.map(zone => {
        const zoneName = zone.zone.replace(/\s*\(Zone \d+\)/, '').replace(/\s+/g, '_');
        return `${zoneName}:${zone.percentage}%`;
      }).join(',') + ']';
    }
    
    // Build main activity summary
    let summary = `Activity: ${activity.name} (${activity.type}) on ${activityDate} - `;
    summary += `Distance: ${formatDistance(activity.distance)}, `;
    summary += `Time: ${movingTime} (moving) / ${totalTime} (total), `;
    summary += `Avg_speed: ${(activity.average_speed * 3.6).toFixed(2)}km/h, `;
    summary += `Elevation: ${activity.total_elevation_gain.toFixed(0)}m`;
    
    if (hrZonesText) {
      summary += `, HR_zones:${hrZonesText}`;
    }
    
    if (activity.average_heartrate) {
      summary += `, avg_HR:${activity.average_heartrate.toFixed(1)}bpm`;
    }
    
    if (effortData) {
      summary += `, relative_effort:${effortData.totalPoints}pts`;
    }
    
    // Add yearly activity context
    try {
      const allActivities = await stravaService.getCachedActivities();
      const currentYear = new Date(activity.start_date_local).getFullYear();
      
      const yearActivities = allActivities.filter(act => {
        const actDate = new Date(act.start_date_local);
        return actDate.getFullYear() === currentYear && act.id !== activity.id;
      });
      
      if (yearActivities.length > 0) {
        summary += `\n\nYear_${currentYear}_context: `;
        summary += `Total_activities:${yearActivities.length + 1}, `;
        
        // Calculate yearly totals
        const totalDistance = yearActivities.reduce((sum, act) => sum + act.distance, activity.distance) / 1000;
        const totalTime = yearActivities.reduce((sum, act) => sum + act.moving_time, activity.moving_time);
        const avgSpeed = totalDistance / (totalTime / 3600);
        
        summary += `Total_distance:${totalDistance.toFixed(1)}km, `;
        summary += `Total_time:${Math.round(totalTime / 3600)}h, `;
        summary += `Avg_pace_year:${avgSpeed.toFixed(2)}km/h, `;
        
        // Activity type distribution
        const typeCount: { [key: string]: number } = {};
        [...yearActivities, activity].forEach(act => {
          typeCount[act.type] = (typeCount[act.type] || 0) + 1;
        });
        
        const topTypes = Object.entries(typeCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type, count]) => `${type}:${count}`)
          .join(',');
        
        summary += `Activity_types:[${topTypes}], `;
        
        // All activities in same year with full details
        const sortedActivities = [...yearActivities].sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime());
        const allActivities = sortedActivities
          .map(act => {
            const date = new Date(act.start_date_local).toISOString().split('T')[0];
            const distance = (act.distance / 1000).toFixed(2) + 'km';
            const movingTime = formatDuration(act.moving_time);
            const avgSpeed = (act.average_speed * 3.6).toFixed(2) + 'km/h';
            const elevation = act.total_elevation_gain.toFixed(0) + 'm';
            const avgHR = act.average_heartrate ? act.average_heartrate.toFixed(1) + 'bpm' : 'N/A';
            
            return `${act.name}(${act.type})_${date}:${distance}_${movingTime}_${avgSpeed}_${elevation}_HR:${avgHR}`;
          })
          .join('|');
        
        summary += `All_year_activities:[${allActivities}]`;
      }
    } catch (error) {
      console.log('Could not load yearly context:', error);
    }
    
    // Add custom LLM prefix if available
    let finalSummary = summary;
    if (athlete?.llm_summary_prefix) {
      finalSummary = `${athlete.llm_summary_prefix}\n\n${summary}`;
    }
    
    return finalSummary;
  };

  const copyLLMSummary = async () => {
    const summary = await generateLLMSummary();
    try {
      await navigator.clipboard.writeText(summary);
      // Show temporary success message
      const button = document.getElementById('llm-summary-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.backgroundColor = '#28a745';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: show summary in alert
      alert(summary);
    }
  };

  if (loading) {
    return <div className="loading">Loading activity details...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/activities')} className="btn">
          Back to Activities
        </button>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="card">
        <div className="error">Activity not found</div>
        <button onClick={() => navigate('/activities')} className="btn">
          Back to Activities
        </button>
      </div>
    );
  }

  const analysisData = getAnalysisData();
  const elevationData = getElevationData();
  const heartRateData = getHeartRateData();
  const effortAnalysis = getEffortAnalysis();

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h1>{activity.name}</h1>
            <p style={{ color: '#666', marginBottom: '0.5rem' }}>
              {activity.type} • {formatDate(activity.start_date_local)}
            </p>
            {activity.description && (
              <p style={{ fontStyle: 'italic' }}>{activity.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              id="llm-summary-btn"
              onClick={copyLLMSummary} 
              className="btn btn-secondary"
              title="Copy activity summary for LLM analysis"
            >
              📋 LLM Summary
            </button>
            <button onClick={handleRefresh} className="btn" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button onClick={() => navigate('/activities')} className="btn btn-secondary">
              Back to Activities
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{formatDistance(activity.distance)}</div>
          <div className="stat-label">Distance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(activity.moving_time)}</div>
          <div className="stat-label">Moving Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPace(activity.average_speed)}</div>
          <div className="stat-label">Avg Pace</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activity.total_elevation_gain.toFixed(0)}m</div>
          <div className="stat-label">Elevation Gain</div>
        </div>
        {activity.average_heartrate && (
          <div className="stat-card">
            <div className="stat-value">{activity.average_heartrate.toFixed(0)}</div>
            <div className="stat-label">Avg Heart Rate</div>
          </div>
        )}
        {activity.average_watts && (
          <div className="stat-card">
            <div className="stat-value">{activity.average_watts.toFixed(0)}W</div>
            <div className="stat-label">Avg Power</div>
          </div>
        )}
      </div>

      {/* Performance Analysis */}
      {effortAnalysis && (
        <div className="card">
          <h3>Performance Analysis</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{effortAnalysis.efficiency.toFixed(1)}</div>
              <div className="stat-label">Avg Speed (km/h)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{effortAnalysis.elevationRate.toFixed(1)}</div>
              <div className="stat-label">Elevation Rate (m/km)</div>
            </div>
            {effortAnalysis.intensityScore > 0 && (
              <div className="stat-card">
                <div className="stat-value">{effortAnalysis.intensityScore}</div>
                <div className="stat-label">Suffer Score</div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-value">{activity.streams ? '✓' : '✗'}</div>
              <div className="stat-label">Stream Data</div>
            </div>
          </div>
          {activity.streams && (
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
              📊 Enhanced charts available with detailed GPS and sensor data
            </p>
          )}
        </div>
      )}

      {/* Split Analysis Chart */}
      {analysisData.length > 0 && (
        <div className="card">
          <h3>Pace Analysis</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysisData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="km" 
                  label={{ value: activity.streams?.distance ? 'Distance (km)' : 'Kilometer', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'pace') {
                      const minutes = Math.floor(Number(value));
                      const seconds = Math.floor((Number(value) - minutes) * 60);
                      return [`${minutes}:${seconds.toString().padStart(2, '0')}`, 'Pace (min/km)'];
                    }
                    return [value, name];
                  }}
                />
                <Line type="monotone" dataKey="pace" stroke="#fc4c02" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Elevation Profile */}
      {elevationData.length > 0 && (
        <div className="card">
          <h3>Elevation Profile</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={elevationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="distance" label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="altitude" stroke="#28a745" strokeWidth={2} fill="#28a745" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heart Rate Chart */}
      {heartRateData.length > 0 && (
        <div className="card">
          <h3>Heart Rate Over Time</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={heartRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Time (minutes)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="heartrate" stroke="#dc3545" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heart Rate Zone Distribution */}
      {getHeartRateZoneDistribution().length > 0 && (
        <div className="card">
          <h3>Heart Rate Zone Distribution</h3>
          {athlete?.birth_year ? (
            <div>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                Based on estimated max HR: {calculateMaxHeartRate(athlete.birth_year)} bpm (Age: {new Date().getFullYear() - athlete.birth_year})
              </p>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getHeartRateZoneDistribution()}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="time"
                      label={(entry) => `${entry.zone}: ${entry.time}min (${entry.percentage}%)`}
                    >
                      {getHeartRateZoneDistribution().map((entry) => (
                        <Cell key={entry.zone} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value} minutes`, 'Time']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <h4>Zone Breakdown:</h4>
                {getHeartRateZoneDistribution().map((zone) => (
                  <div key={zone.zone} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div 
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        backgroundColor: zone.color, 
                        marginRight: '10px',
                        border: '1px solid #ccc'
                      }}
                    ></div>
                    <span>{zone.zone}: {zone.time} minutes ({zone.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                To see heart rate zone distribution, please set your birth year in settings.
              </p>
              <button onClick={() => navigate('/settings')} className="btn">
                Go to Settings
              </button>
            </div>
          )}
        </div>
      )}

      {/* Relative Effort Analysis */}
      {calculateRelativeEffortPoints() && (
        <div className="card">
          <h3>Relative Effort Analysis</h3>
          {(() => {
            const effortData = calculateRelativeEffortPoints();
            if (!effortData) return null;
            
            return (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                  Effort calculation based on time spent in each heart rate zone with weighted multipliers
                </p>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{effortData.totalPoints}</div>
                    <div className="stat-label">Total Effort Points</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{effortData.relativeScore}</div>
                    <div className="stat-label">Relative Effort Score</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{effortData.intensityFactor}</div>
                    <div className="stat-label">Intensity Factor</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{effortData.timeInZones}min</div>
                    <div className="stat-label">Time in HR Zones</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Zone Multipliers:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div>🔵 Zone 1 (Recovery): ×{effortData.zoneMultipliers.zone1}</div>
                    <div>🟢 Zone 2 (Aerobic Base): ×{effortData.zoneMultipliers.zone2}</div>
                    <div>🟡 Zone 3 (Aerobic): ×{effortData.zoneMultipliers.zone3}</div>
                    <div>🟠 Zone 4 (Threshold): ×{effortData.zoneMultipliers.zone4}</div>
                    <div>🔴 Zone 5 (Max Effort): ×{effortData.zoneMultipliers.zone5}</div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
                    Higher zones contribute exponentially more to effort score, reflecting physiological stress
                  </p>
                </div>
                
                {/* Effort Comparison Chart */}
                <div style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>Effort Comparison</h4>
                    <select 
                      value={comparisonPeriod} 
                      onChange={(e) => setComparisonPeriod(e.target.value as 'month' | 'year')}
                      style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="month">Same Month</option>
                      <option value="year">Same Year</option>
                    </select>
                  </div>
                  
                  {comparisonData.length > 0 ? (
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                        Comparing with {comparisonData.length - 1} other activities from the same {comparisonPeriod}
                      </p>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis label={{ value: 'Effort Points', angle: -90, position: 'insideLeft' }} />
                            <Tooltip 
                              formatter={(value: any, name: string) => [value, 'Effort Points']}
                              labelFormatter={(label: any) => `Date: ${label}`}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div style={{ 
                                      backgroundColor: 'white', 
                                      padding: '10px', 
                                      border: '1px solid #ccc', 
                                      borderRadius: '4px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                      <p><strong>{data.name}</strong></p>
                                      <p>Date: {data.date}</p>
                                      <p>Type: {data.type}</p>
                                      <p>Distance: {data.distance.toFixed(2)} km</p>
                                      <p>Effort: {data.effort} points</p>
                                      {data.isCurrentActivity && <p style={{color: '#007bff'}}><strong>← Current Activity</strong></p>}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="effort" 
                              stroke="#007bff" 
                              strokeWidth={2}
                              dot={(props) => {
                                const { payload } = props;
                                return (
                                  <circle
                                    {...props}
                                    fill={payload.isCurrentActivity ? '#ff6b6b' : '#007bff'}
                                    stroke={payload.isCurrentActivity ? '#ff6b6b' : '#007bff'}
                                    strokeWidth={2}
                                    r={payload.isCurrentActivity ? 6 : 4}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>
                          <strong>Your Position:</strong> {(() => {
                            const currentIndex = comparisonData.findIndex(d => d.isCurrentActivity);
                            const rank = currentIndex + 1;
                            const total = comparisonData.length;
                            const percentile = Math.round(((total - rank) / (total - 1)) * 100);
                            return `${rank} of ${total} activities (${percentile}th percentile)`;
                          })()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
                      No other activities with heart rate data found for comparison in this {comparisonPeriod}.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Speed Chart */}
      {analysisData.length > 0 && analysisData.some(d => d.speed > 0) && (
        <div className="card">
          <h3>Speed Analysis</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysisData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="km" 
                  label={{ value: activity.streams?.distance ? 'Distance (km)' : 'Kilometer', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="speed" stroke="#007bff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="card">
        <h3>Additional Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>Max Speed:</strong> {formatSpeed(activity.max_speed)}
          </div>
          {activity.max_heartrate && (
            <div>
              <strong>Max Heart Rate:</strong> {activity.max_heartrate} bpm
            </div>
          )}
          {activity.kilojoules && (
            <div>
              <strong>Energy:</strong> {activity.kilojoules} kJ
            </div>
          )}
          <div>
            <strong>Kudos:</strong> {activity.kudos_count}
          </div>
          <div>
            <strong>PRs:</strong> {activity.pr_count || 0}
          </div>
          {activity.average_cadence && (
            <div>
              <strong>Avg Cadence:</strong> {activity.average_cadence.toFixed(0)} rpm
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityDetail;
