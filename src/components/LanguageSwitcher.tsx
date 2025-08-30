import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      <span style={{ fontSize: '0.9rem', color: '#666' }}>Language:</span>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.9rem',
          borderRadius: '4px',
          border: '1px solid #ddd',
          backgroundColor: 'white'
        }}
      >
        <option value="en">🇺🇸 English</option>
        <option value="id">🇮🇩 Indonesia</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
