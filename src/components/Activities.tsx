import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { stravaService } from '../services/stravaService';
import { StravaActivity } from '../services/database';

const Activities: React.FC = () => {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamProgress, setStreamProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    checkAuthAndLoadActivities();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleOAuthCallback(code);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Apply filters when activities or filters change
    applyFilters();
  }, [activities, filters]);

  const checkAuthAndLoadActivities = async () => {
    try {
      const authenticated = await stravaService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        await loadActivities(true); // Reset pagination on initial load
      } else {
        // Load cached activities if available
        const cachedActivities = await stravaService.getCachedActivities();
        setActivities(cachedActivities);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setError('Failed to check authentication status');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      setLoading(true);
      const settings = await stravaService.getSettings();
      
      if (!settings?.clientId || !settings?.clientSecret) {
        setError('Client credentials not found. Please configure them in Settings.');
        return;
      }

      await stravaService.exchangeCodeForToken(code, settings.clientId, settings.clientSecret);
      
      // Clear the code from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setIsAuthenticated(true);
      await loadActivities(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (reset = false) => {
    try {
      setError(null);
      
      if (reset) {
        setCurrentPage(1);
        setHasMoreData(true);
        // First load cached activities
        const cachedActivities = await stravaService.getCachedActivities();
        setActivities(cachedActivities);
      }

      const pageToLoad = reset ? 1 : currentPage;
      
      // Then fetch fresh data from API
      const freshActivities = await stravaService.getActivities(pageToLoad, 30);
      
      if (reset) {
        setActivities(freshActivities);
      } else {
        setActivities(prev => [...prev, ...freshActivities]);
      }
      
      // Check if there's more data
      if (freshActivities.length < 30) {
        setHasMoreData(false);
      } else {
        setCurrentPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to load activities');
    }
  };

  const loadMoreActivities = async () => {
    if (loadingMore || !hasMoreData) return;
    
    setLoadingMore(true);
    try {
      await loadActivities(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshActivities = async () => {
    setLoading(true);
    await loadActivities(true);
    setLoading(false);
  };

  const fetchAllStreamData = async () => {
    if (!isAuthenticated || loadingStreams) return;
    
    setLoadingStreams(true);
    setError(null);
    
    try {
      const activitiesToProcess = filteredActivities.length > 0 ? filteredActivities : activities;
      setStreamProgress({ current: 0, total: activitiesToProcess.length });
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < activitiesToProcess.length; i++) {
        const activity = activitiesToProcess[i];
        setStreamProgress({ current: i + 1, total: activitiesToProcess.length });
        
        try {
          // Fetch detailed activity data with streams
          await stravaService.getActivityDetail(activity.id);
          successCount++;
          
          // Small delay to avoid rate limiting
          if (i < activitiesToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`Error fetching streams for activity ${activity.id}:`, error);
          errorCount++;
        }
      }
      
      // Show completion message
      const message = `Stream data fetch completed: ${successCount} successful, ${errorCount} failed`;
      if (errorCount === 0) {
        alert(`✅ ${message}`);
      } else {
        alert(`⚠️ ${message}`);
      }
      
    } catch (error) {
      console.error('Error during bulk stream fetch:', error);
      setError('Failed to fetch stream data. Please try again.');
    } finally {
      setLoadingStreams(false);
      setStreamProgress({ current: 0, total: 0 });
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Filter by activity type
    if (filters.type) {
      filtered = filtered.filter(activity => 
        activity.type.toLowerCase() === filters.type.toLowerCase()
      );
    }

    // Filter by search term (name)
    if (filters.search) {
      filtered = filtered.filter(activity =>
        activity.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(activity =>
        new Date(activity.start_date_local) >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(activity =>
        new Date(activity.start_date_local) <= toDate
      );
    }

    setFilteredActivities(filtered);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      search: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const getUniqueActivityTypes = () => {
    const types = new Set(activities.map(activity => activity.type));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  };

  const formatDistance = (distance: number) => {
    return (distance / 1000).toFixed(2) + ' km';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading activities...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h1>Welcome to Athlete Insight</h1>
        <p>Connect to Strava to start analyzing your activities.</p>
        {error && <div className="error">{error}</div>}
        <Link to="/settings" className="btn">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>Your Activities</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={fetchAllStreamData} 
              className="btn btn-secondary" 
              disabled={loading || loadingStreams || activities.length === 0}
              title="Fetch detailed stream data for all visible activities"
            >
              {loadingStreams ? (
                `📊 Fetching... (${streamProgress.current}/${streamProgress.total})`
              ) : (
                '📊 Fetch Streams'
              )}
            </button>
            <button onClick={refreshActivities} className="btn" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Filter Controls */}
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="activity-type" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Activity Type
              </label>
              <select 
                id="activity-type"
                value={filters.type} 
                onChange={(e) => handleFilterChange('type', e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">All Types</option>
                {getUniqueActivityTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="activity-search" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Search Activities
              </label>
              <input
                id="activity-search"
                type="text"
                placeholder="Search by name..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label htmlFor="date-from" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                From Date
              </label>
              <input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label htmlFor="date-to" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                To Date
              </label>
              <input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              <div>Showing {filteredActivities.length} of {activities.length} activities</div>
              {loadingStreams && (
                <div style={{ marginTop: '0.25rem', color: '#007bff' }}>
                  📊 Fetching stream data: {streamProgress.current}/{streamProgress.total}
                </div>
              )}
              {!loadingStreams && streamProgress.total === 0 && activities.length > 0 && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  💡 Use "Fetch Streams" to get detailed GPS and sensor data for {filteredActivities.length > 0 ? filteredActivities.length : activities.length} activities
                </div>
              )}
            </div>
            <button 
              onClick={clearFilters} 
              className="btn btn-secondary"
              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        {filteredActivities.length === 0 && activities.length > 0 && (
          <p>No activities match your filters. Try adjusting your search criteria.</p>
        )}
        
        {filteredActivities.length === 0 && activities.length === 0 && (
          <p>No activities found. Try refreshing or check your Strava account.</p>
        )}
      </div>

      <div className="activity-grid">
        {filteredActivities.map((activity) => (
          <button
            key={activity.id}
            className="activity-card"
            onClick={() => navigate(`/activity/${activity.id}`)}
            style={{ border: 'none', textAlign: 'left', background: 'transparent', padding: '10', width: '100%' }}
          >
            <div className="activity-name">{activity.name}</div>
            <div className="activity-meta">
              {activity.type} • {formatDate(activity.start_date_local)}
            </div>
            <div className="activity-stats">
              <span>📏 {formatDistance(activity.distance)}</span>
              <span>⏱️ {formatDuration(activity.moving_time)}</span>
              <span>⬆️ {activity.total_elevation_gain.toFixed(0)}m</span>
            </div>
            {activity.average_heartrate && (
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                ❤️ Avg HR: {activity.average_heartrate.toFixed(0)} bpm
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Load More Button */}
      {isAuthenticated && hasMoreData && filteredActivities.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button 
            onClick={loadMoreActivities} 
            className="btn"
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading more...' : 'Load More Activities'}
          </button>
        </div>
      )}
      
      {!hasMoreData && activities.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#666' }}>
          All activities loaded
        </div>
      )}
    </div>
  );
};

export default Activities;
