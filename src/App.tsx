import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Settings from './components/Settings';
import Activities from './components/Activities';
import ActivityDetail from './components/ActivityDetail';
import ActivityMap from './components/ActivityMap';
import PersonalRecords from './components/PersonalRecords';
import ReleaseNotes from './components/ReleaseNotes';
import { useTheme } from './context/ThemeContext';
import './App.css';

function App() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="App">
      <nav className="nav">
        <div className="nav-content">
          <Link to="/" className="nav-brand">
            Athlete Insight
          </Link>
          <div className="nav-links">
            <Link 
              to="/activities" 
              className={`nav-link ${location.pathname === '/activities' ? 'active' : ''}`}
            >
              Activities
            </Link>
            <Link 
              to="/records" 
              className={`nav-link ${location.pathname === '/records' ? 'active' : ''}`}
            >
              Records
            </Link>
            <Link 
              to="/settings" 
              className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
            >
              Settings
            </Link>
          </div>
          <button
            onClick={toggleTheme}
            className="nav-link"
            style={{ marginLeft: 'auto', cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<Activities />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/records" element={<PersonalRecords />} />
          <Route path="/release-notes" element={<ReleaseNotes />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/activity/:id/map" element={<ActivityMap />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
