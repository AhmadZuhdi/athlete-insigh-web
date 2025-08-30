import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Settings from './components/Settings';
import Activities from './components/Activities';
import ActivityDetail from './components/ActivityDetail';
import LanguageSwitcher from './components/LanguageSwitcher';
import './App.css';

function App() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="App">
      <nav className="nav">
        <div className="nav-content">
          <Link to="/" className="nav-brand">
            {t('app.title')}
          </Link>
          <div className="nav-links">
            <Link 
              to="/activities" 
              className={`nav-link ${location.pathname === '/activities' ? 'active' : ''}`}
            >
              {t('navigation.activities')}
            </Link>
            <Link 
              to="/settings" 
              className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
            >
              {t('navigation.settings')}
            </Link>
            <LanguageSwitcher />
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
