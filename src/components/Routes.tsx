import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { routeGroupingService } from '../services/routeGroupingService';
import { db, RouteGroup, RouteActivity } from '../services/database';
import './PersonalRecords.css';

const RoutesPage: React.FC = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteGroup | null>(null);
  const [routeActivities, setRouteActivities] = useState<(RouteActivity & { activityName?: string; activityDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const all = await routeGroupingService.getAllRouteGroups();
      setRoutes(all);
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = async (route: RouteGroup) => {
    setSelectedRoute(route);
    try {
      const activities = await routeGroupingService.getRouteActivities(route.id!);
      const enriched = await Promise.all(
        activities.map(async (ra) => {
          const activity = await db.activities.get(ra.activityId);
          return {
            ...ra,
            activityName: activity?.name || `Activity #${ra.activityId}`,
            activityDate: activity?.start_date_local || '',
          };
        })
      );
      enriched.sort((a, b) => a.timeSecs - b.timeSecs);
      setRouteActivities(enriched);
    } catch (err) {
      console.error('Failed to load route activities:', err);
      setRouteActivities([]);
    }
  };

  const handleUnassign = async (routeId: number, activityId: string) => {
    try {
      await routeGroupingService.unassignActivity(routeId, activityId);
      await selectRoute(selectedRoute!);
    } catch (err) {
      console.error('Failed to unassign:', err);
    }
  };

  const handleRename = async (id: number) => {
    if (!renameValue.trim()) return;
    try {
      await routeGroupingService.renameRouteGroup(id, renameValue.trim());
      setRenamingId(null);
      setRenameValue('');
      await loadRoutes();
      if (selectedRoute?.id === id) {
        setSelectedRoute(prev => prev ? { ...prev, name: renameValue.trim() } : null);
      }
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this route group?')) return;
    try {
      await routeGroupingService.deleteRouteGroup(id);
      if (selectedRoute?.id === id) {
        setSelectedRoute(null);
        setRouteActivities([]);
      }
      await loadRoutes();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatTime = (s: number): string => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  };

  const formatPace = (mpk: number): string => {
    const m = Math.floor(mpk);
    const sec = Math.round((mpk - m) * 60);
    return `${m}:${sec.toString().padStart(2, '0')}/km`;
  };

  const formatDate = (ds: string): string => new Date(ds).toLocaleDateString();

  if (loading) {
    return <div className="personal-records-container"><div className="loading">Loading routes...</div></div>;
  }

  return (
    <div className="personal-records-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Routes</h1>
      </div>

      {routes.length === 0 ? (
        <div className="no-data" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>No routes yet.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Open an activity detail and click "Save as Route" to create one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
          <div style={{ flex: '1 1 350px', minWidth: 0 }}>
            <div className="pr-section">
              <h2>All Routes ({routes.length})</h2>
              <div className="distance-pr-list">
                <div className="distance-pr-header">
                  <div className="activity" style={{ flex: 2 }}>Name</div>
                  <div className="date" style={{ flex: 1, textAlign: 'center' }}>Actions</div>
                </div>
                {routes.map((route) => (
                  <button
                    key={route.id}
                    className={`distance-pr-row ${selectedRoute?.id === route.id ? 'selected' : ''}`}
                    onClick={() => selectRoute(route)}
                    type="button"
                    style={{
                      cursor: 'pointer',
                      background: selectedRoute?.id === route.id ? 'var(--accent-bg, #e8f4fd)' : undefined,
                    }}
                  >
                    <div className="activity" style={{ flex: 2, textAlign: 'left' }}>{route.name}</div>
                    <div className="date" style={{ flex: 1, textAlign: 'center', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      {renamingId === route.id ? (
                        <>
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(route.id!); if (e.key === 'Escape') setRenamingId(null); }}
                            style={{ width: '70px', fontSize: '0.8rem' }}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                          <button onClick={e => { e.stopPropagation(); handleRename(route.id!); }} type="button" style={{ fontSize: '0.7rem' }}>✓</button>
                          <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} type="button" style={{ fontSize: '0.7rem' }}>✗</button>
                        </>
                      ) : (
                        <>
                          <button onClick={e => { e.stopPropagation(); setRenamingId(route.id!); setRenameValue(route.name); }} type="button" style={{ fontSize: '0.75rem', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }} title="Rename">✏️</button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(route.id!); }} type="button" style={{ fontSize: '0.75rem', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }} title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedRoute && (
            <div style={{ flex: '1 1 500px', minWidth: 0 }}>
              <div className="pr-section">
                <h2>{selectedRoute.name}</h2>
                {routeActivities.length === 0 ? (
                  <div className="no-data" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    No activities assigned to this route.
                  </div>
                ) : (
                  <div className="distance-pr-list">
                    <div className="distance-pr-header">
                      <div className="rank">Rank</div>
                      <div className="time">Time</div>
                      <div className="pace">Pace</div>
                      <div className="speed">Speed</div>
                      <div className="activity">Activity</div>
                      <div className="date">Date</div>
                      <div>HR</div>
                      <div></div>
                    </div>
                    {routeActivities.map((ra, i) => (
                      <button
                        key={ra.id}
                        className={`distance-pr-row ${i === 0 ? 'pr-row-best' : ''}`}
                        onClick={() => navigate(`/activity/${ra.activityId}`)}
                        type="button"
                      >
                        <div className="rank">#{i + 1}</div>
                        <div className="time">{formatTime(ra.timeSecs)}</div>
                        <div className="pace">{formatPace(ra.avgPace)}</div>
                        <div className="speed">{(ra.avgSpeed * 3.6).toFixed(1)} km/h</div>
                        <div className="activity" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ra.activityName}</div>
                        <div className="date">{ra.activityDate ? formatDate(ra.activityDate) : '-'}</div>
                        <div>{ra.avgHr ? `${Math.round(ra.avgHr)} bpm` : '-'}</div>
                        <button
                          onClick={e => { e.stopPropagation(); handleUnassign(selectedRoute.id!, ra.activityId); }}
                          type="button"
                          style={{ fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                          title="Remove from route"
                        >✕</button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoutesPage;
