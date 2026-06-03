import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { segmentService } from '../services/segmentService';
import { db, Segment, SegmentEffort } from '../services/database';
import './PersonalRecords.css';

const SegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [efforts, setEfforts] = useState<(SegmentEffort & { activityName?: string; activityDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [effortCounts, setEffortCounts] = useState<Map<number, number>>(new Map());
  const [bestEfforts, setBestEfforts] = useState<Map<number, SegmentEffort>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    setLoading(true);
    try {
      const all = await segmentService.getAllSegments();
      setSegments(all);

      const counts = new Map<number, number>();
      const bests = new Map<number, SegmentEffort>();

      for (const seg of all) {
        const count = await segmentService.getEffortCountForSegment(seg.id!);
        counts.set(seg.id!, count);
        const best = await segmentService.getBestEffortForSegment(seg.id!);
        if (best) bests.set(seg.id!, best);
      }

      setEffortCounts(counts);
      setBestEfforts(bests);
    } catch (err) {
      console.error('Failed to load segments:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectSegment = async (seg: Segment) => {
    setSelectedSegment(seg);
    try {
      const effortsData = await segmentService.getEffortsForSegment(seg.id!);
      const enriched = await Promise.all(
        effortsData.map(async (eff) => {
          const activity = await db.activities.get(eff.activityId);
          return {
            ...eff,
            activityName: activity?.name || `Activity #${eff.activityId}`,
            activityDate: activity?.start_date_local || '',
          };
        })
      );
      setEfforts(enriched);
    } catch (err) {
      console.error('Failed to load efforts:', err);
      setEfforts([]);
    }
  };

  const handleScanAll = async () => {
    setScanning(true);
    setScanProgress({ done: 0, total: 0 });
    try {
      await segmentService.rescanAll((done, total) => {
        setScanProgress({ done, total });
      });
      await loadSegments();
      if (selectedSegment) {
        await selectSegment(selectedSegment);
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
      setScanProgress({ done: 0, total: 0 });
    }
  };

  const handleRename = async (id: number) => {
    if (!renameValue.trim()) return;
    try {
      await segmentService.updateSegment(id, { name: renameValue.trim() });
      setRenamingId(null);
      setRenameValue('');
      await loadSegments();
      if (selectedSegment?.id === id) {
        setSelectedSegment(prev => prev ? { ...prev, name: renameValue.trim() } : null);
      }
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this segment and all its efforts?')) return;
    try {
      await segmentService.deleteSegment(id);
      if (selectedSegment?.id === id) {
        setSelectedSegment(null);
        setEfforts([]);
      }
      await loadSegments();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatPace = (minPerKm: number): string => {
    const m = Math.floor(minPerKm);
    const s = Math.round((minPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  };

  const formatDate = (ds: string): string => {
    return new Date(ds).toLocaleDateString();
  };

  if (loading) {
    return <div className="personal-records-container"><div className="loading">Loading segments...</div></div>;
  }

  return (
    <div className="personal-records-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Segments</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleScanAll}
            className="btn btn-secondary"
            disabled={scanning}
            type="button"
          >
            {scanning ? `Scanning ${scanProgress.done}/${scanProgress.total}...` : 'Recalculate All'}
          </button>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="no-data" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>No segments yet.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Open an activity map, click "Create Segment", and pick start/end points on your route.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
          {/* Segment list */}
          <div style={{ flex: '1 1 350px', minWidth: 0 }}>
            <div className="pr-section">
              <h2>All Segments ({segments.length})</h2>
              <div className="distance-pr-list">
                <div className="distance-pr-header">
                  <div className="activity" style={{ flex: 2 }}>Name</div>
                  <div className="rank" style={{ flex: 1, textAlign: 'center' }}>Efforts</div>
                  <div className="time" style={{ flex: 1.5, textAlign: 'center' }}>PR</div>
                  <div className="date" style={{ flex: 1, textAlign: 'center' }}>Actions</div>
                </div>
                {segments.map((seg) => {
                  const best = bestEfforts.get(seg.id!);
                  const count = effortCounts.get(seg.id!) || 0;
                  return (
                    <button
                      key={seg.id}
                      className={`distance-pr-row ${selectedSegment?.id === seg.id ? 'selected' : ''}`}
                      onClick={() => selectSegment(seg)}
                      type="button"
                      style={{
                        cursor: 'pointer',
                        background: selectedSegment?.id === seg.id ? 'var(--accent-bg, #e8f4fd)' : undefined,
                      }}
                    >
                      <div className="activity" style={{ flex: 2, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {seg.name}
                      </div>
                      <div className="rank" style={{ flex: 1, textAlign: 'center' }}>{count}</div>
                      <div className="time" style={{ flex: 1.5, textAlign: 'center' }}>
                        {best ? formatTime(best.timeSecs) : '-'}
                      </div>
                      <div className="date" style={{ flex: 1, textAlign: 'center', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        {renamingId === seg.id ? (
                          <>
                            <input
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(seg.id!); if (e.key === 'Escape') setRenamingId(null); }}
                              style={{ width: '70px', fontSize: '0.8rem' }}
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                            <button onClick={e => { e.stopPropagation(); handleRename(seg.id!); }} type="button" style={{ fontSize: '0.7rem' }}>✓</button>
                            <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} type="button" style={{ fontSize: '0.7rem' }}>✗</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); setRenamingId(seg.id!); setRenameValue(seg.name); }}
                              type="button"
                              style={{ fontSize: '0.75rem', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                              title="Rename"
                            >✏️</button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(seg.id!); }}
                              type="button"
                              style={{ fontSize: '0.75rem', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                              title="Delete"
                            >🗑️</button>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PR leaderboard */}
          {selectedSegment && (
            <div style={{ flex: '1 1 500px', minWidth: 0 }}>
              <div className="pr-section">
                <h2>{selectedSegment.name}</h2>
                <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 0.75rem' }}>
                  {selectedSegment.distanceKm} km • {selectedSegment.elevationGain}m elevation
                </p>
                {efforts.length === 0 ? (
                  <div className="no-data" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    No matching activities yet. Click "Recalculate All" to scan.
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
                    </div>
                    {efforts.map((eff, i) => (
                      <button
                        key={eff.id}
                        className={`distance-pr-row ${i === 0 ? 'pr-row-best' : ''}`}
                        onClick={() => navigate(`/activity/${eff.activityId}`)}
                        type="button"
                      >
                        <div className="rank">#{i + 1}</div>
                        <div className="time">{formatTime(eff.timeSecs)}</div>
                        <div className="pace">{formatPace(eff.avgPace)}</div>
                        <div className="speed">{eff.avgSpeed.toFixed(1)} km/h</div>
                        <div className="activity" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {eff.activityName || `#${eff.activityId}`}
                        </div>
                        <div className="date">{eff.activityDate ? formatDate(eff.activityDate) : '-'}</div>
                        <div>{eff.avgHr ? `${Math.round(eff.avgHr)} bpm` : '-'}</div>
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

export default SegmentsPage;
