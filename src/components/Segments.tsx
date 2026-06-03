import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { segmentService } from '../services/segmentService';
import { db, Segment, SegmentEffort } from '../services/database';
import './PersonalRecords.css';

const SCAN_CONFIG_KEY = 'segmentScanConfig';

interface ScanConfig {
  direction: 'newest' | 'oldest';
  limit: number;
  limitEnabled: boolean;
}

const DEFAULT_SCAN_CONFIG: ScanConfig = {
  direction: 'newest',
  limit: 0,
  limitEnabled: false,
};

function loadScanConfig(): ScanConfig {
  try {
    const raw = localStorage.getItem(SCAN_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_SCAN_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      direction: parsed.direction ?? DEFAULT_SCAN_CONFIG.direction,
      limit: typeof parsed.limit === 'number' ? parsed.limit : DEFAULT_SCAN_CONFIG.limit,
      limitEnabled: typeof parsed.limitEnabled === 'boolean' ? parsed.limitEnabled : DEFAULT_SCAN_CONFIG.limitEnabled,
    };
  } catch {
    return { ...DEFAULT_SCAN_CONFIG };
  }
}

function saveScanConfig(config: ScanConfig): void {
  try {
    localStorage.setItem(SCAN_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // localStorage may be full or disabled
  }
}

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
  const [showScanConfig, setShowScanConfig] = useState(false);
  const [scanDirection, setScanDirection] = useState<'newest' | 'oldest'>(() => loadScanConfig().direction);
  const [scanLimit, setScanLimit] = useState<number>(() => loadScanConfig().limit);
  const [scanLimitEnabled, setScanLimitEnabled] = useState<boolean>(() => loadScanConfig().limitEnabled);

  useEffect(() => {
    loadSegments();
  }, []);

  useEffect(() => {
    saveScanConfig({ direction: scanDirection, limit: scanLimit, limitEnabled: scanLimitEnabled });
  }, [scanDirection, scanLimit, scanLimitEnabled]);

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
    if (selectedSegment?.id === seg.id) {
      setSelectedSegment(null);
      setEfforts([]);
      return;
    }
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
      await segmentService.rescanAll(
        scanLimitEnabled && scanLimit > 0
          ? { direction: scanDirection, limit: scanLimit }
          : { direction: scanDirection },
        (done, total) => {
          setScanProgress({ done, total });
        }
      );
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowScanConfig(!showScanConfig)}
            className="btn btn-secondary"
            type="button"
            style={{ fontSize: '0.85rem' }}
          >
            {showScanConfig ? 'Hide Scan Config' : 'Scan Config'}
          </button>
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

      {/* Scan config panel */}
      {showScanConfig && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Direction:</label>
              <select
                value={scanDirection}
                onChange={e => setScanDirection(e.target.value as 'newest' | 'oldest')}
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', borderRadius: '4px' }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={scanLimitEnabled}
                  onChange={e => setScanLimitEnabled(e.target.checked)}
                  style={{ marginRight: '0.3rem' }}
                />
                Limit:
              </label>
              <input
                type="number"
                min={1}
                value={scanLimit || ''}
                onChange={e => setScanLimit(Math.max(1, parseInt(e.target.value) || 0))}
                disabled={!scanLimitEnabled}
                placeholder="count"
                style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', borderRadius: '4px' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#888' }}>activities</span>
            </div>
          </div>
        </div>
      )}

      {segments.length === 0 ? (
        <div className="no-data" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>No segments yet.</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Open an activity map, click "Create Segment", and pick start/end points on your route.
          </p>
        </div>
      ) : (
        <div>
          {/* Segment list */}
          <div className="pr-section">
            <h2>All Segments ({segments.length})</h2>
            <div className="distance-pr-list">
              <div className="distance-pr-header">
                <div className="activity" style={{ flex: 3 }}>Name</div>
                <div className="rank" style={{ flex: 1, textAlign: 'center' }}>Efforts</div>
                <div className="time" style={{ flex: 1.5, textAlign: 'center' }}>PR</div>
                <div className="date" style={{ flex: 0.5, textAlign: 'center' }}>Actions</div>
              </div>
              {segments.map((seg) => {
                const best = bestEfforts.get(seg.id!);
                const count = effortCounts.get(seg.id!) || 0;
                const isSelected = selectedSegment?.id === seg.id;
                return (
                  <React.Fragment key={seg.id}>
                    <button
                      className={`distance-pr-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectSegment(seg)}
                      type="button"
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-bg, #e8f4fd)' : undefined,
                      }}
                    >
                      <div className="activity" style={{ flex: 3, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {seg.name}
                      </div>
                      <div className="rank" style={{ flex: 1, textAlign: 'center' }}>{count}</div>
                      <div className="time" style={{ flex: 1.5, textAlign: 'center' }}>
                        {best ? formatTime(best.timeSecs) : '-'}
                      </div>
                      <div className="date" style={{ flex: 0.5, textAlign: 'center', whiteSpace: 'nowrap' }}>
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

                    {/* Detail panel below the selected segment */}
                    {isSelected && selectedSegment && (
                      <div style={{ padding: '1rem 1rem 0.5rem 2rem', borderBottom: '1px solid var(--border-color, #eee)' }}>
                        <h3 style={{ margin: '0 0 0.25rem' }}>{selectedSegment.name}</h3>
                        <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 0.75rem' }}>
                          {selectedSegment.distanceKm} km • {selectedSegment.elevationGain}m elevation
                        </p>
                        {efforts.length === 0 ? (
                          <div className="no-data" style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            No matching activities yet.
                          </div>
                        ) : (
                          <div className="distance-pr-list" style={{ border: 'none' }}>
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
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentsPage;
