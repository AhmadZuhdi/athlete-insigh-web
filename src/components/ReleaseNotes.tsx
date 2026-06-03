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
  dependencies?: string[];
}

const ReleaseNotes: React.FC = () => {
  const releases: Release[] = [
    {
      version: '1.5.1',
      date: 'June 3, 2026',
      title: 'Bug Fixes & UI Polish',
      description: 'Fixed scan config persistence, improved progress display, and cleaned up table layouts',
      bugFixes: [
        'Fixed scan config (direction, limit) not persisting across page reloads — now stored in localStorage',
        'Fixed progress counter showing segments × activities instead of just activity count during scan',
        'Fixed navigation link on activity map error state pointing to wrong route'
      ],
      improvements: [
        'Wider segment name column and narrower Actions column for better table layout',
        'Responsive activity detail header layout with wrap support',
        'Activity card text now respects dark mode theme colors',
        'Removed redundant inline style on activity cards'
      ]
    },
    {
      version: '1.5.0',
      date: 'June 3, 2026',
      title: 'Segment PR Tracking & Route Grouping',
      description: 'Strava-style segment personal records with GPS-based polyline matching, plus route grouping for comparing repeated runs',
      features: [
        'Create custom segments by picking any two points on an activity map route',
        'Auto-detect segment matching across all past and future activities using GPS buffer matching (30m tolerance)',
        'Per-segment PR leaderboard ranked by time showing HR, pace, speed, and power metrics',
        'Route grouping via start/end/distance fingerprinting — automatically groups repeated runs of the same route',
        'New Segments and Routes pages with full CRUD management (rename, delete)'
      ],
      improvements: [
        'Add "Save Full Route as Segment" and "Save as Route" buttons on activity detail view',
        'Non-blocking background segment scan when new activities are fetched from Strava',
        'Export/import support for segments, segment efforts, route groups, and route activities'
      ]
    },
    {
      version: '1.4.0',
      date: 'June 1, 2026',
      title: 'Dark Mode Support',
      description: 'Full dark mode support with system preference detection and persistent theme toggle',
      features: [
        'CSS custom properties theming system for consistent dark/light colors across all components',
        'Dark mode toggle button in navigation bar with sun/moon icon',
        'System preference detection on first visit (respects prefers-color-scheme)',
        'Persistent theme choice in localStorage across sessions',
        'Dark-optimized color palette with reduced brightness accents'
      ],
      improvements: [
        'All global and component CSS files updated to use CSS variables',
        'Inline styles in Activities, ActivityDetail, Settings, ActivityMap, and MultiMetricChart respond to theme',
        'Map tile layer defaults to dark variant in dark mode',
        'Chart backgrounds and toggle buttons adapt to current theme'
      ]
    },
    {
      version: '1.3.0',
      date: 'May 21, 2026',
      title: 'Interactive Map View & Multi-Metric Charts',
      description: 'New map visualization and unified metric overview for activity analysis',
      features: [
        'Interactive map view with heatmap-style route coloring (green → yellow → red)',
        'Route line colored by metric intensity: Heart Rate, Speed, Elevation, Power, Cadence',
        '4 map tile layers: Streets, Dark (default), Satellite, Topographic',
        'Configurable map height via slider (300–1000px)',
        'Hover tooltips showing metric values on route',
        'Color legend with min/max values for selected metric',
        'Multi-Metric Overview Chart with toggleable lines (Pace, Speed, Elevation, HR, Altitude)',
        'Dynamic X-axis (distance or time) based on available data',
        'Custom pace formatter (min:sec)'
      ],
      improvements: [
        'Removed data points from line charts for cleaner visuals',
        'Added TypeScript type definitions for Leaflet',
        'Reorganized dependencies in package.json'
      ],
      dependencies: [
        'leaflet@^1.9.4',
        'react-leaflet@^4.2.1',
        '@types/leaflet@^1.9.21'
      ]
    },
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

        {release.dependencies && release.dependencies.length > 0 && (
          <div className="release-section">
            <h3 className="release-section-title">📦 Dependencies</h3>
            <ul className="release-list">
              {release.dependencies.map((dep, idx) => (
                <li key={idx}>{dep}</li>
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
