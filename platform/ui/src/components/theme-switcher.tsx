import type { ReactNode } from 'react';
import { useTheme } from '../theme/theme-context.js';

export interface ThemeSwitcherProps {
  readonly labels?: {
    readonly settings?: string;
    readonly light?: string;
    readonly dark?: string;
    readonly system?: string;
    readonly paletteClassic?: string;
    readonly paletteTeal?: string;
    readonly paletteCarbon?: string;
  };
  readonly className?: string;
}

export function ThemeSwitcher({ labels = {}, className = '' }: ThemeSwitcherProps): ReactNode {
  const { mode, palette, setMode, setPalette } = useTheme();

  const lightLabel = labels.light ?? 'Light';
  const darkLabel = labels.dark ?? 'Dark';
  const systemLabel = labels.system ?? 'System';
  const settingsLabel = labels.settings ?? 'Theme';
  const classicLabel = labels.paletteClassic ?? 'Classic';
  const tealLabel = labels.paletteTeal ?? 'Teal';
  const carbonLabel = labels.paletteCarbon ?? 'Carbon';

  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label={settingsLabel}>
      {/* Mode Selector */}
      <div className="flex items-center rounded-lg border border-line-strong bg-surface p-0.5 shadow-xs">
        <button
          type="button"
          onClick={() => setMode('light')}
          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
            mode === 'light'
              ? 'bg-primary text-on-primary font-semibold shadow-xs'
              : 'text-ink-muted hover:text-ink-strong'
          }`}
          title={lightLabel}
          aria-label={lightLabel}
          aria-pressed={mode === 'light'}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setMode('system')}
          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
            mode === 'system'
              ? 'bg-primary text-on-primary font-semibold shadow-xs'
              : 'text-ink-muted hover:text-ink-strong'
          }`}
          title={systemLabel}
          aria-label={systemLabel}
          aria-pressed={mode === 'system'}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setMode('dark')}
          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
            mode === 'dark'
              ? 'bg-primary text-on-primary font-semibold shadow-xs'
              : 'text-ink-muted hover:text-ink-strong'
          }`}
          title={darkLabel}
          aria-label={darkLabel}
          aria-pressed={mode === 'dark'}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.03 9.03 0 008.354-5.646z" />
          </svg>
        </button>
      </div>

      {/* Palette Selector */}
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1 shadow-xs">
        <button
          type="button"
          onClick={() => setPalette('classic')}
          className={`size-3.5 rounded-full bg-blue-700 transition-all ${
            palette === 'classic' ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110' : 'opacity-60 hover:opacity-100'
          }`}
          title={classicLabel}
          aria-label={classicLabel}
          aria-pressed={palette === 'classic'}
        />
        <button
          type="button"
          onClick={() => setPalette('teal')}
          className={`size-3.5 rounded-full bg-teal-600 transition-all ${
            palette === 'teal' ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110' : 'opacity-60 hover:opacity-100'
          }`}
          title={tealLabel}
          aria-label={tealLabel}
          aria-pressed={palette === 'teal'}
        />
        <button
          type="button"
          onClick={() => setPalette('carbon')}
          className={`size-3.5 rounded-full bg-zinc-800 transition-all ${
            palette === 'carbon' ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110' : 'opacity-60 hover:opacity-100'
          }`}
          title={carbonLabel}
          aria-label={carbonLabel}
          aria-pressed={palette === 'carbon'}
        />
      </div>
    </div>
  );
}
