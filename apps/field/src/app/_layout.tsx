import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ThemedStack } from '../components/ThemedStack';
// Importing the tracking module defines the background GPS task at load time, before any screen
// (expo-task-manager); `useOutboxSync` is the hook that sends what is queued.
import { useOutboxSync } from '../tracking';
import { applyDocumentDirection } from '../i18n/rtl';
import { initMonitoring, reportQueryError } from '../monitoring';
import { useSession } from '../state/session';
import { ThemeProvider } from '../theme';

// Before anything renders, so errors from the first screen are caught. Does nothing without a Sentry DSN.
initMonitoring();

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportQueryError }),
  mutationCache: new MutationCache({ onError: reportQueryError }),
});

function RootLayout() {
  // Sends the track points, sightings and reports kept on the device when the connection or the session allows (UC-S01).
  useOutboxSync();
  useEffect(() => {
    if (Platform.OS === 'web') applyDocumentDirection(document);
    // Reads the session saved on the device; the start screen waits for it (UC-F01).
    void useSession.getState().restore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Sentry.wrap catches render errors and records navigation and touches as breadcrumbs.
export default Sentry.wrap(RootLayout);
