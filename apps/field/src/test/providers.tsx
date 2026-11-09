import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';

// A 390x844 phone frame: test data, not styling.
/* eslint-disable no-restricted-syntax */
const frame = { x: 0, y: 0, width: 390, height: 844 };
/* eslint-enable no-restricted-syntax */
const insets = { top: 47, left: 0, right: 0, bottom: 34 };

/** Query client (no retries), safe-area metrics of a phone and the theme: what a Field screen needs to render. */
export function TestProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        {/* The web provider measures the page (zero in jsdom); a phone reports its insets here. */}
        <SafeAreaInsetsContext.Provider value={insets}>
          <ThemeProvider>{children}</ThemeProvider>
        </SafeAreaInsetsContext.Provider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
