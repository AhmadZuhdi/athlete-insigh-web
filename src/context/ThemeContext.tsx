import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const lightColors = {
  textSecondary: '#666',
  textTertiary: '#999',
  bgTertiary: '#f8f9fa',
  border: '#ddd',
  borderLight: '#e0e0e0',
  info: '#0066cc',
  infoLight: '#e3f2fd',
  success: '#28a745',
  danger: '#dc3545',
  warningBg: '#fff3cd',
  warningText: '#856404',
  errorBg: '#f8d7da',
  errorText: '#721c24',
  bgSecondary: '#ffffff',
  textPrimary: '#333',
};

const darkColors: typeof lightColors = {
  textSecondary: '#a0a0a0',
  textTertiary: '#707070',
  bgTertiary: '#2a2a2a',
  border: '#333',
  borderLight: '#2a2a2a',
  info: '#4da6ff',
  infoLight: '#1a2a3d',
  success: '#2dce68',
  danger: '#f05353',
  warningBg: '#3d3d1a',
  warningText: '#f0e0a0',
  errorBg: '#3d1a1a',
  errorText: '#f8a0a0',
  bgSecondary: '#1e1e1e',
  textPrimary: '#e0e0e0',
};

export function useThemeColors() {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
