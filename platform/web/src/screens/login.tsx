import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, Input, ThemeSwitcher } from '@h-os/ui';
import { ApiError, errorMessageKey, useSession } from '@h-os/web-client';
import { LanguageSwitcher } from '../shell/language-switcher.js';

/**
 * The single sign-in screen for every H-OS app (UX-001, HHR-UX-001). Failure copy is generic on
 * purpose: the server does not reveal whether the email or the password was wrong (SEC-011).
 */
export function LoginScreen(): ReactNode {
  const { t } = useTranslation();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<unknown>(null);

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

  return (
    <div className="flex min-h-screen flex-col bg-canvas selection:bg-primary/20">
      {/* Top Utility Bar */}
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 border-b border-line/40 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover font-bold text-on-primary shadow-sm ring-1 ring-white/10">
            <span className="text-lg tracking-wider">H</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-ink-strong">{t('app.name')}</span>
            <span className="hidden sm:inline text-xs text-ink-muted">{t('app.tagline')}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeSwitcher labels={themeLabels} />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main OS Entrance Surface */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="relative w-full max-w-md">
          {/* Subtle Ambient OS Glow Backdrop */}
          <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/10 via-accent/5 to-transparent blur-2xl -z-10" />

          <Card
            className="border-line/80 shadow-raised overflow-hidden"
            title={
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-accent animate-pulse" />
                <span className="text-lg font-bold">{t('auth.title')}</span>
              </div>
            }
            description={t('auth.subtitle')}
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setFailure(null);
                void session
                  .login({ email: email.trim(), password })
                  .catch((error: unknown) => setFailure(error));
              }}
            >
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
                <Button type="submit" className="w-full py-2.5 text-base font-medium shadow-sm" disabled={session.signingIn}>
                  {session.signingIn ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {t('auth.submitting')}
                    </span>
                  ) : (
                    t('auth.submit')
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Secure Workspace Trust Indicator */}
          <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-muted">
            <svg className="size-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>{t('app.tagline')}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
