import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Settings from './components/Settings';
import Activities from './components/Activities';
import ActivityDetail from './components/ActivityDetail';
import './App.css';

function App() {
  const location = useLocation();

  return (
    <div className="App">
      <nav className="nav">
        <div className="nav-content">
          <Link to="/" className="nav-brand">
            Athlete Insight
          </Link>
          <div className="nav-links">
            <Link 
              to="/settings" 
              className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
            >
              Settings
            </Link>
            <Link 
              to="/activities" 
              className={`nav-link ${location.pathname === '/activities' ? 'active' : ''}`}
            >
              Activities
            </Link>
          </div>
        </div>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<Activities />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
