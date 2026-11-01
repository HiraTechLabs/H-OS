import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ApiError, useSession } from '@h-os/web-client';
import { applyDocumentLocale } from './i18n.js';
import { router } from './router.js';

/** Mirrors the active language onto `<html lang>` and `<html dir>` (UX-006). */
function LanguageSync(): null {
  const { i18n } = useTranslation();
  useEffect(() => {
    applyDocumentLocale(i18n.language);
  }, [i18n.language]);
  return null;
}

/**
 * Wires server state and the router under the session. A 401 from any query is treated as an
 * expired session rather than a screen-level error, so the shell returns to sign-in exactly once
 * (SEC-009, UX-008).
 */
export function App(): ReactNode {
  const session = useSession();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) void session.reload();
          },
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageSync />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
