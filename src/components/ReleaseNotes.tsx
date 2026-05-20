import React from 'react';
import './ReleaseNotes.css';

interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
  features?: string[];
  improvements?: string[];
  bugFixes?: string[];
}

const ReleaseNotes: React.FC = () => {
  const releases: Release[] = [
    {
      version: '1.2.0',
      date: 'October 19, 2025',
      title: 'Distance-Based Personal Records',
      description: 'Major update with comprehensive distance-based performance tracking',
      features: [
        'View top 5 fastest times for each standard distance (5km, 10km, 15km, 20km, 21.1km, 30km, 42.2km)',
        'Expandable distance sections showing all your PRs ranked by time',
        'GPS-precise (stream-based) vs estimated (split-based) data quality indicators',
        'Click any PR to view the full activity details'
      ],
      improvements: [
        'Auto-expand all distance sections on page load for better visibility',
        'Responsive list format for easy comparison across distances',
        'Real-time progress tracking during segment calculation',
        'Bulk "Calculate All PRs" button for offline data processing'
      ],
      bugFixes: [
        'Fixed segment calculation for activities with incomplete stream data',
        'Improved IndexedDB caching efficiency for large activity datasets'
      ]
    },
    {
      version: '1.1.0',
      date: 'October 15, 2025',
      title: 'Progress Tracking & UI Enhancements',
      description: 'Enhanced user experience with real-time progress indicators',
      features: [
        'Real-time progress badges across Activities, PersonalRecords, and ActivityDetail pages',
        'Background segment calculation without blocking UI interactions',
        'Activity-specific distance records displayed in detail view'
      ],
      improvements: [
        'Optimized segment calculation for faster processing',
        'Improved visual hierarchy in personal records display',
        'Better error handling for incomplete activity data'
      ]
    },
    {
      version: '1.0.0',
      date: 'October 10, 2025',
      title: 'Initial Release',
      description: 'Launch of Athlete Insight with core features',
      features: [
        'OAuth 2.0 integration with Strava API',
        'Activity caching with IndexedDB for offline access',
        'Personal records tracking (distance, speed, elevation, moving time, pace)',
        'Advanced HR zone-based effort scoring',
        'Activity detail view with stream data analysis',
        'LLM-friendly summary export for AI analysis'
      ],
      improvements: [
        'Responsive design for desktop and mobile',
        'Efficient pagination for large activity lists',
        'Automatic token refresh with 5-minute buffer'
      ]
    }
  ];

  const renderReleaseCard = (release: Release, index: number) => {
    return (
      <div key={index} className="release-card">
        <div className="release-header">
          <div className="release-version-info">
            <h2 className="release-version">{release.version}</h2>
            <p className="release-title">{release.title}</p>
            <p className="release-date">{release.date}</p>
          </div>
          {index === 0 && <span className="release-badge">Latest</span>}
        </div>

        <p className="release-description">{release.description}</p>

        {release.features && release.features.length > 0 && (
          <div className="release-section">
            <h3 className="release-section-title">✨ Features</h3>
            <ul className="release-list">
              {release.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>
        )}

        {release.improvements && release.improvements.length > 0 && (
          <div className="release-section">
            <h3 className="release-section-title">🚀 Improvements</h3>
            <ul className="release-list">
              {release.improvements.map((improvement, idx) => (
                <li key={idx}>{improvement}</li>
              ))}
            </ul>
          </div>
        )}

        {release.bugFixes && release.bugFixes.length > 0 && (
          <div className="release-section">
            <h3 className="release-section-title">🐛 Bug Fixes</h3>
            <ul className="release-list">
              {release.bugFixes.map((fix, idx) => (
                <li key={idx}>{fix}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="release-notes-container">
      <h1>Release Notes</h1>
      <p className="release-notes-intro">
        Version history and updates for Athlete Insight
      </p>

      <div className="releases-grid">
        {releases.map((release, index) => renderReleaseCard(release, index))}
      </div>

      <div className="release-footer">
        <p>
          Have feedback or found an issue?{' '}
          <a href="https://github.com/AhmadZuhdi/athlete-insigh-web/issues" target="_blank" rel="noopener noreferrer">
            Report it on GitHub
          </a>
        </p>
      </div>
    </div>
  );
};

export default ReleaseNotes;
