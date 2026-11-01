import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@h-os/ui';
import { errorMessageKey } from '@h-os/web-client';

/**
 * Displays the i18n copy for a failure's stable code. Server sentences are never rendered, so
 * the UI stays fully translated and no internal detail leaks (SEC-008, UX-006).
 */
export function ErrorAlert({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <Alert tone="danger" title={t(errorMessageKey(error))}>
      {onRetry ? (
        <button type="button" className="hos-link bg-transparent p-0" onClick={onRetry}>
          {t('common.retry')}
        </button>
      ) : null}
    </Alert>
  );
}

export function SuccessAlert({ message }: { readonly message: string }): ReactNode {
  return <Alert tone="success">{message}</Alert>;
}
