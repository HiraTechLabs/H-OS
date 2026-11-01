import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, Input } from '@h-os/ui';
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

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-lg bg-primary font-semibold text-on-primary"
          >
            H
          </span>
          <span className="text-lg font-semibold text-ink-strong">{t('app.name')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card title={t('auth.title')} description={t('auth.subtitle')}>
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
              <Button type="submit" disabled={session.signingIn}>
                {session.signingIn ? t('auth.submitting') : t('auth.submit')}
              </Button>
            </form>
          </Card>
          <p className="mt-6 text-center text-xs text-ink-muted">{t('app.tagline')}</p>
        </div>
      </main>
    </div>
  );
}
