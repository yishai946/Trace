import '@trace/design/tokens.css';
import './global.css';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { App } from './App';
import { isSignedOutError, signedOut } from './auth';
import { ThemeProvider } from './theme/theme';

// Any request answered 401 means the session ended: go back to the login screen.
const onError = (error: unknown) => {
  if (isSignedOutError(error)) signedOut(queryClient);
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
});
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {/* he-IL gives React Aria RTL layout, Hebrew dates and numbers. */}
    <I18nProvider locale="he-IL">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
