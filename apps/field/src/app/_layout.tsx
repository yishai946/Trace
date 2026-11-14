import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ThemedStack } from '../components/ThemedStack';
// Importing the tracking module defines the background GPS task at load time, before any screen
// (expo-task-manager); `useOutboxSync` is the hook that sends what is queued.
import { useOutboxSync } from '../tracking';
import { applyDocumentDirection } from '../i18n/rtl';
import { useSession } from '../state/session';
import { ThemeProvider } from '../theme';

const queryClient = new QueryClient();

export default function RootLayout() {
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
