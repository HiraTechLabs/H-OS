import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePalette = 'classic' | 'teal' | 'carbon';

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly resolvedMode: 'light' | 'dark';
  readonly palette: ThemePalette;
  readonly setMode: (mode: ThemeMode) => void;
  readonly setPalette: (palette: ThemePalette) => void;
}

const STORAGE_KEY_MODE = 'hos-theme-mode';
const STORAGE_KEY_PALETTE = 'hos-theme-palette';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  defaultMode = 'system',
  defaultPalette = 'classic',
}: {
  readonly children: ReactNode;
  readonly defaultMode?: ThemeMode;
  readonly defaultPalette?: ThemePalette;
}): ReactNode {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return defaultMode;
  });

  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    if (typeof window === 'undefined') return defaultPalette;
    const stored = localStorage.getItem(STORAGE_KEY_PALETTE) as ThemePalette | null;
    if (stored === 'classic' || stored === 'teal' || stored === 'carbon') return stored;
    return defaultPalette;
  });

  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(getSystemPreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const resolvedMode = mode === 'system' ? systemMode : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedMode);
    root.setAttribute('data-palette', palette);
    root.style.colorScheme = resolvedMode;
  }, [resolvedMode, palette]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, newMode);
    } catch {
      // localStorage may fail in restricted/incognito modes
    }
  };

  const setPalette = (newPalette: ThemePalette) => {
    setPaletteState(newPalette);
    try {
      localStorage.setItem(STORAGE_KEY_PALETTE, newPalette);
    } catch {
      // localStorage may fail in restricted/incognito modes
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedMode,
        palette,
        setMode,
        setPalette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
