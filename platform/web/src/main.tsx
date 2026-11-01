import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { SessionProvider, configureApi } from '@h-os/web-client';
import { App } from './App.js';
import { applyDocumentLocale, i18n } from './i18n.js';
import './styles.css';

configureApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1' });
applyDocumentLocale(i18n.language);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root was not found');

createRoot(container).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </I18nextProvider>
  </StrictMode>,
);
