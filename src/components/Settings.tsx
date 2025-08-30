import React, { useState, useEffect, useRef } from 'react';
import { stravaService } from '../services/stravaService';
import { StravaSettings, StravaAthlete, db } from '../services/database';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Partial<StravaSettings>>({
    clientId: '',
    clientSecret: ''
  });
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [birthYear, setBirthYear] = useState<string>('');
  const [llmPrefix, setLlmPrefix] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dataStats, setDataStats] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDataStats();
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      const savedSettings = await stravaService.getSettings();
      if (savedSettings) {
        setSettings(savedSettings);
      }
      setIsAuthenticated(await stravaService.isAuthenticated());
      
      // Load athlete data if authenticated
      if (await stravaService.isAuthenticated()) {
        const athleteData = await stravaService.getAthlete();
        setAthlete(athleteData);
        setBirthYear(athleteData?.birth_year?.toString() || '');
        setLlmPrefix(athleteData?.llm_summary_prefix || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDataStats = async () => {
    try {
      const stats = await db.getDataStats();
      setDataStats(stats);
    } catch (error) {
      console.error('Error loading data stats:', error);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const data = await stravaService.exportAllData();
      
      // Create and download file
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `athlete-insight-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      
      // Validate JSON
      try {
        JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON file');
      }
      
      await stravaService.importAllData(text);
      
      setMessage({ type: 'success', text: 'Data imported successfully! Please refresh the page.' });
      
      // Reload data after import
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (!settings.clientId || !settings.clientSecret) {
        throw new Error('Client ID and Client Secret are required');
      }

      await stravaService.saveSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStrava = () => {
    if (!settings.clientId) {
      setMessage({ type: 'error', text: 'Please save your Client ID first' });
      return;
    }

    const authUrl = stravaService.getAuthorizationUrl(settings.clientId);
    window.location.href = authUrl;
  };

  const handleSaveBirthYear = async () => {
    if (!birthYear || !athlete) return;
    
    setSaving(true);
    try {
      const year = parseInt(birthYear);
      if (year < 1900 || year > new Date().getFullYear()) {
        throw new Error('Please enter a valid birth year');
      }
      
      await stravaService.updateAthleteBirthYear(year);
      setMessage({ type: 'success', text: 'Birth year saved successfully' });
      
      // Reload athlete data
      const updatedAthlete = await stravaService.getAthlete();
      setAthlete(updatedAthlete);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save birth year'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLLMPrefix = async () => {
    if (!athlete) return;
    
    setSaving(true);
    try {
      await stravaService.updateAthleteLLMPrefix(llmPrefix);
      setMessage({ type: 'success', text: 'LLM summary prefix saved successfully' });
      
      // Reload athlete data
      const updatedAthlete = await stravaService.getAthlete();
      setAthlete(updatedAthlete);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save LLM prefix'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDatabase = async () => {
    if (window.confirm('Are you sure you want to reset the database? This will clear all stored data and you will need to re-authenticate.')) {
      try {
        await stravaService.resetDatabase();
        window.location.reload();
      } catch (error) {
        console.error('Error resetting database:', error);
        setMessage({
          type: 'error',
          text: 'Failed to reset database. Please try again.'
        });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await stravaService.logout();
      setIsAuthenticated(false);
      setSettings({ clientId: '', clientSecret: '' });
      setAthlete(null);
      setBirthYear('');
      setMessage({ type: 'success', text: 'Logged out successfully' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to logout' 
      });
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Strava API Settings</h1>
        <span style={{ 
          fontSize: '0.9rem', 
          color: '#666', 
          backgroundColor: '#f8f9fa', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          v0.1.3
        </span>
      </div>
      
      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label htmlFor="clientId">Client ID</label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            value={settings.clientId || ''}
            onChange={handleInputChange}
            placeholder="Your Strava app Client ID"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="clientSecret">Client Secret</label>
          <input
            type="password"
            id="clientSecret"
            name="clientSecret"
            value={settings.clientSecret || ''}
            onChange={handleInputChange}
            placeholder="Your Strava app Client Secret"
            required
          />
        </div>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h3>Strava Connection</h3>
        {isAuthenticated ? (
          <div>
            <p style={{ color: 'green', marginBottom: '1rem' }}>✓ Connected to Strava</p>
            <button onClick={handleLogout} className="btn btn-secondary">
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Not connected to Strava. Save your settings first, then connect.
            </p>
            <button onClick={handleConnectStrava} className="btn">
              Connect to Strava
            </button>
          </div>
        )}
      </div>

      {/* Birth Year Settings */}
      {isAuthenticated && athlete && (
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
          <h3>Athlete Profile</h3>
          <div style={{ marginBottom: '1rem' }}>
            <p><strong>Name:</strong> {athlete.firstname} {athlete.lastname}</p>
            {athlete.city && <p><strong>Location:</strong> {athlete.city}, {athlete.state}</p>}
          </div>
          
          <div className="form-group">
            <label htmlFor="birthYear">Birth Year (for Heart Rate Zone Calculation)</label>
            <input
              type="number"
              id="birthYear"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g., 1990"
              min="1900"
              max={new Date().getFullYear()}
              style={{ marginBottom: '0.5rem' }}
            />
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              This is used to calculate your estimated maximum heart rate (220 - age) for heart rate zone analysis.
            </p>
            <button 
              type="button" 
              onClick={handleSaveBirthYear} 
              className="btn"
              disabled={saving || !birthYear}
            >
              {saving ? 'Saving...' : 'Save Birth Year'}
            </button>
          </div>
          
          {athlete.birth_year && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>Current Age:</strong> {new Date().getFullYear() - athlete.birth_year} years<br />
                <strong>Estimated Max HR:</strong> {220 - (new Date().getFullYear() - athlete.birth_year)} bpm
              </p>
            </div>
          )}
        </div>
      )}

      {/* LLM Summary Prefix Settings */}
      {isAuthenticated && athlete && (
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
          <h3>LLM Summary Settings</h3>
          <div className="form-group">
            <label htmlFor="llmPrefix">
              Custom LLM Summary Prefix <br />
              $summary will be replaced with the activity summary.
            </label>
            <textarea
              id="llmPrefix"
              value={llmPrefix}
              onChange={(e) => setLlmPrefix(e.target.value)}
              placeholder="e.g., Analyze this fitness data as a professional coach and provide insights on..."
              rows={4}
              style={{ 
                marginBottom: '0.5rem',
                resize: 'vertical',
                minHeight: '100px',
                width: '100%',
              }}
            />
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              This custom prefix will be added to the beginning of activity data when generating LLM summaries. 
              Use it to provide context or specific instructions for AI analysis of your fitness data.
            </p>
            <button 
              type="button" 
              onClick={handleSaveLLMPrefix} 
              className="btn"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save LLM Prefix'}
            </button>
          </div>
          
          {athlete.llm_summary_prefix && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>Current Prefix:</strong><br />
                <em>"{athlete.llm_summary_prefix}"</em>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Data Management */}
      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h3>Data Management</h3>
        
        {isAuthenticated && dataStats && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h4 style={{ marginBottom: '1rem' }}>Database Statistics</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
              <div><strong>Activities:</strong> {dataStats.activities}</div>
              <div><strong>Activity Details:</strong> {dataStats.activityDetails}</div>
              <div><strong>Athletes:</strong> {dataStats.athlete}</div>
              <div><strong>Total Size:</strong> {dataStats.totalSize}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {/* Export - Only show when authenticated */}
          {isAuthenticated && (
            <div style={{ padding: '1rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Export Data</h4>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                Download all your activity data as a JSON file for backup or transfer.
              </p>
              <button 
                onClick={handleExportData}
                className="btn"
                disabled={exporting}
                style={{ width: '100%' }}
              >
                {exporting ? 'Exporting...' : '📥 Export Data'}
              </button>
            </div>
          )}

          {/* Import - Always show */}
          <div style={{ padding: '1rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Import Data</h4>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              Import previously exported data. This will replace all current data.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportData}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn"
              disabled={importing}
              style={{ width: '100%', backgroundColor: '#28a745', borderColor: '#28a745' }}
            >
              {importing ? 'Importing...' : '📤 Import Data'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
            <strong>⚠️ Important:</strong> Import will replace all existing data. {isAuthenticated ? 'Make sure to export your current data first if you want to keep it.' : 'You can import data even when not authenticated.'}
          </p>
        </div>
      </div>

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h3 style={{ color: '#dc3545' }}>Danger Zone</h3>
        <div style={{ padding: '1rem', backgroundColor: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#721c24' }}>
            If you're experiencing database issues, you can reset all data. This will clear all stored activities and settings.
          </p>
          <button 
            type="button" 
            onClick={handleResetDatabase}
            className="btn"
            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
          >
            Reset Database
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h3>Setup Instructions</h3>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
          <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer">Strava API Settings</a></li>
          <li>Create a new app or use an existing one</li>
          <li>Set the Authorization Callback Domain to: <code>{window.location.hostname}</code></li>
          <li>Copy the Client ID and Client Secret here</li>
          <li>Save settings and connect to Strava</li>
        </ol>
      </div>
    </div>
  );
};

export default Settings;
