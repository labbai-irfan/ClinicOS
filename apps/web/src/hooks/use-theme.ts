import { useEffect } from 'react';
import { useUiStore } from '../stores/ui-store';

const THEME_ORDER = ['system', 'light', 'dark'] as const;

/** Applies the persisted theme preference to the document root (spec: tokens.css reads data-theme). */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);
}

export function useThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const cycleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length] ?? THEME_ORDER[0];
    setTheme(next);
  };

  return { theme, cycleTheme };
}
