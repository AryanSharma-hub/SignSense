import { useCallback, useEffect, useState } from 'react';

const KEY = 'signsense:theme';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function useTheme() {
  const [theme, setTheme] = useState(() => read() || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
