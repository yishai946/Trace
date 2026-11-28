import '@trace/design/tokens.css';
import './global.css';
import { reactErrorHandler } from '@sentry/react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { Entry } from './App/Entry';
import { isSignedOutError, signedOut } from './auth';
import { initMonitoring, reportQueryError } from './monitoring';
import { ThemeProvider } from './theme/theme';

initMonitoring();

// Any request answered 401 means the session ended: go back to the login screen.
const onError = (error: unknown) => {
  if (isSignedOutError(error)) signedOut(queryClient);
  reportQueryError(error);
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
});
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// React 19 hands errors to these hooks: uncaught ones, and ones an error boundary caught.
createRoot(root, { onUncaughtError: reactErrorHandler(), onCaughtError: reactErrorHandler() }).render(
  <StrictMode>
    {/* he-IL gives React Aria RTL layout, Hebrew dates and numbers. */}
    <I18nProvider locale="he-IL">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Entry />
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
