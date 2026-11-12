import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Splash } from '../components/Splash';
// Importing the tracking module defines the background GPS task at load time, before any screen
// (expo-task-manager); `useTrackSync` is the hook that sends the queued points.
import { useTrackSync } from '../tracking';
import { applyDocumentDirection } from '../i18n/rtl';
import { useSession } from '../state/session';
import { ThemeProvider, useTheme } from '../theme';

const queryClient = new QueryClient();

function ThemedStack() {
  const { themeId, theme } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      <StatusBar style={themeId === 'night' ? 'light' : 'dark'} />
      {/* Hidden from VoiceOver and TalkBack while the splash covers it, so nothing behind it can be focused. */}
      <View
        style={styles.stack}
        accessibilityElementsHidden={!splashDone}
        importantForAccessibility={splashDone ? 'auto' : 'no-hide-descendants'}
      >
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.surface } }}>
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
          <Stack.Screen name="missing-person" options={{ presentation: 'modal' }} />
        </Stack>
      </View>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  // Sends the track points kept on the device when the connection or the session allows (UC-S01).
  useTrackSync();
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

const styles = StyleSheet.create({
  stack: { flex: 1 },
});
