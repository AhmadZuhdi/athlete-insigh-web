import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fitImportService, FitFileEntry } from '../services/fitImportService';
import { useThemeColors } from '../context/ThemeContext';

const FitImport: React.FC = () => {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState<FitFileEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFilesRef = useRef<(fileList: FileList | File[]) => void>();

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newEntries: FitFileEntry[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.fit')) {
        errors.push(`${file.name}: Not a .fit file`);
        continue;
      }
      newEntries.push({
        file,
        name: file.name,
        size: file.size,
        status: 'queued',
      });
    }

    setFiles(prev => [...prev, ...newEntries]);
    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join('\n') });
    }
  }, []);

  addFilesRef.current = addFiles;

  useEffect(() => {
    const loadSharedFiles = async () => {
      const shared = searchParams.get('shared');
      if (shared !== 'true') return;

      try {
        if ('caches' in window) {
          const cache = await caches.open('fit-share-cache-v1');
          const keys = await cache.keys();
          const fitFiles: File[] = [];

          for (const request of keys) {
            if (request.url.includes('/fit-share/')) {
              const response = await cache.match(request);
              if (response) {
                const blob = await response.blob();
                const fileName = request.url.split('/fit-share/').pop() || 'shared.fit';
                const file = new File([blob], fileName, { type: 'application/octet-stream' });
                fitFiles.push(file);
                await cache.delete(request);
              }
            }
          }

          if (fitFiles.length > 0) {
            addFilesRef.current?.(fitFiles);
            setMessage({ type: 'success', text: `${fitFiles.length} shared file(s) loaded! Review and click Import.` });
          }
        }
      } catch (error) {
        console.warn('Could not load shared files:', error);
      }
    };

    loadSharedFiles();
  }, [searchParams]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setMessage(null);
  }, []);

  const handleImport = useCallback(async () => {
    const queuedFiles = files.filter(f => f.status === 'queued');
    if (queuedFiles.length === 0) return;

    setImporting(true);
    setMessage(null);

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status !== 'queued') continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'parsing' } : f));

      try {
        const parsed = await fitImportService.parseFitFile(entry.file);

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'storing' } : f));

        const isDuplicate = await fitImportService.checkDuplicate(
          parsed.summary.start_date,
          parsed.summary.moving_time
        );

        if (isDuplicate) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'duplicate', activity: parsed } : f));
          duplicateCount++;
          continue;
        }

        await fitImportService.storeActivity(parsed.summary, parsed.details);

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'imported', activity: parsed } : f));
        successCount++;
      } catch (err) {
        setFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        } : f));
        errorCount++;
      }
    }

    setImporting(false);
    setMessage({
      type: errorCount === 0 ? 'success' : 'error',
      text: `Import complete: ${successCount} imported, ${duplicateCount} duplicates, ${errorCount} failed`,
    });
  }, [files]);

  const completedCount = files.filter(f => f.status === 'imported').length;
  const totalToProcess = files.filter(f => f.status === 'queued').length;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: FitFileEntry['status']) => {
    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
      queued: { label: 'Queued', color: colors.textSecondary, bg: colors.bgTertiary },
      parsing: { label: 'Parsing...', color: colors.info, bg: colors.infoLight },
      storing: { label: 'Storing...', color: colors.info, bg: colors.infoLight },
      imported: { label: 'Imported', color: colors.success, bg: '#d4edda' },
      error: { label: 'Error', color: colors.danger, bg: colors.errorBg },
      duplicate: { label: 'Duplicate', color: colors.warningText, bg: colors.warningBg },
    };
    const config = statusConfig[status];
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: 500,
        color: config.color,
        backgroundColor: config.bg,
      }}>
        {config.label}
      </span>
    );
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>Import FIT Files</h1>
          <button onClick={() => navigate('/activities')} className="btn btn-secondary">
            Back to Activities
          </button>
        </div>

        {message && (
          <div className={message.type === 'success' ? 'success' : 'error'} style={{ whiteSpace: 'pre-line' }}>
            {message.text}
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? colors.info : colors.border}`,
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragOver ? colors.infoLight : colors.bgTertiary,
            transition: 'all 0.2s',
            marginBottom: '1rem',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".fit"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
            {dragOver ? 'Drop files here' : 'Drag & drop .fit files here, or click to select'}
          </p>
          <p style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
            Supports multiple files from Garmin, Wahoo, Coros, and other devices
          </p>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3>Files ({files.length})</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {completedCount > 0 && files.every(f => f.status === 'imported' || f.status === 'duplicate') && (
                  <button onClick={clearAll} className="btn btn-secondary" style={{ fontSize: '0.9rem' }}>
                    Clear All
                  </button>
                )}
                <button
                  onClick={handleImport}
                  className="btn"
                  disabled={importing || totalToProcess === 0}
                  style={{ fontSize: '0.9rem' }}
                >
                  {importing ? 'Importing...' : `Import ${totalToProcess} File${totalToProcess !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            {/* Progress Summary */}
            {completedCount > 0 && (
              <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '0.5rem' }}>
                {completedCount} of {files.length} files complete
              </p>
            )}

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {files.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    borderBottom: `1px solid ${colors.border}`,
                    backgroundColor: entry.status === 'error' ? colors.errorBg :
                      entry.status === 'imported' ? '#f0fff4' :
                      entry.status === 'duplicate' ? colors.warningBg : 'transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                      {formatSize(entry.size)}
                    </div>
                    {entry.error && (
                      <div style={{ fontSize: '0.8rem', color: colors.danger, marginTop: '0.25rem' }}>
                        {entry.error}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStatusBadge(entry.status)}
                    {entry.status === 'queued' && !importing && (
                      <button
                        onClick={() => removeFile(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: colors.textSecondary,
                          fontSize: '1.2rem',
                          padding: '0 0.25rem',
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                    {(entry.status === 'parsing' || entry.status === 'storing') && (
                      <span style={{ color: colors.info }}>⏳</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FitImport;
