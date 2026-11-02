import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, Input, ThemeSwitcher } from '@h-os/ui';
import { ApiError, errorMessageKey, useSession } from '@h-os/web-client';
import { LanguageSwitcher } from '../shell/language-switcher.js';

/**
 * The H-OS Lock Screen (UX-001, HHR-UX-001, DEC-0010):
 * - Atmospheric operating system entrance
 * - Large local time and localized date
 * - Architectural branching node background motif
 * - High-contrast, WCAG 2.2 AA compliant login card
 * - Under-200ms unlock transition upon authentication
 * - Clean bilingual professional copy
 */
export function LoginScreen(): ReactNode {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<unknown>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(currentTime);
  }, [currentTime, lang]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(currentTime);
  }, [currentTime, lang]);

  const message =
    failure === null
      ? null
      : failure instanceof ApiError && failure.status === 401
        ? t('auth.failed')
        : t(errorMessageKey(failure));

  const themeLabels = {
    settings: t('theme.settings'),
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
    paletteClassic: t('theme.paletteClassic'),
    paletteTeal: t('theme.paletteTeal'),
    paletteCarbon: t('theme.paletteCarbon'),
  };

  const handleLoginSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    void session
      .login({ email: email.trim(), password })
      .then(() => {
        setIsUnlocking(true);
      })
      .catch((error: unknown) => {
        setIsUnlocking(false);
        setFailure(error);
      });
  };

  return (
    <div
      className={`relative flex min-h-screen flex-col justify-between bg-canvas text-ink overflow-hidden transition-all duration-200 ${
        isUnlocking ? 'opacity-0 scale-102' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Architectural Node Vector Motif */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-20 select-none overflow-hidden" aria-hidden="true">
        <svg className="h-full w-full stroke-line-strong" fill="none" viewBox="0 0 1000 800">
          <circle cx="500" cy="400" r="280" strokeDasharray="4 8" strokeWidth="1" />
          <circle cx="500" cy="400" r="160" strokeWidth="1" />
          <line x1="500" y1="120" x2="500" y2="680" strokeWidth="1" />
          <line x1="220" y1="400" x2="780" y2="400" strokeWidth="1" />
          <circle cx="500" cy="240" r="4" fill="currentColor" />
          <circle cx="500" cy="560" r="4" fill="currentColor" />
          <circle cx="340" cy="400" r="4" fill="currentColor" />
          <circle cx="660" cy="400" r="4" fill="currentColor" />
        </svg>
      </div>

      {/* Top Discreet Utility Bar (System Tray) */}
      <header className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl overflow-hidden bg-surface border border-line shadow-xs p-0.5">
            <img src="/logo.jpeg" alt={t('app.name')} className="size-full object-cover rounded-lg" />
          </div>
          <span className="text-sm font-bold tracking-tight text-ink-strong">{t('app.name')}</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeSwitcher labels={themeLabels} />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Center Lock Screen Content & Form */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {/* Large Local Lock Screen Time & Date */}
        <div className="text-center mb-8 select-none">
          <p className="text-4xl sm:text-6xl font-bold tracking-tight text-ink-strong font-mono">
            {formattedTime}
          </p>
          <p className="mt-1 text-sm sm:text-base font-medium text-ink-muted">
            {formattedDate}
          </p>
        </div>

        {/* Lock Screen Authentication Card */}
        <div className="w-full max-w-sm">
          <Card
            className="border-line/90 bg-surface/95 backdrop-blur-md shadow-raised overflow-hidden"
            title={
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent animate-pulse" />
                <span className="text-base font-bold text-ink-strong">{t('auth.title')}</span>
              </div>
            }
            description={t('auth.subtitle')}
          >
            <form className="flex flex-col gap-4 mt-2" onSubmit={handleLoginSubmit}>
              {message ? <Alert tone="danger">{message}</Alert> : null}

              <Field label={t('auth.email')}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                )}
              </Field>

              <Field label={t('auth.password')}>
                {(props) => (
                  <Input
                    {...props}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                )}
              </Field>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full py-2.5 text-sm font-semibold shadow-xs"
                  disabled={session.signingIn}
                >
                  {session.signingIn ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {t('auth.submitting')}
                    </span>
                  ) : (
                    <span>{t('auth.submit')}</span>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>

      {/* Discreet Platform Signature Footer */}
      <footer className="py-4 text-center text-xs text-ink-muted">
        <p>{lang === 'ar' ? 'H-OS · المنصة المؤسسية المتكاملة' : 'H-OS · Integrated Enterprise Workspace'}</p>
      </footer>
    </div>
  );
}
