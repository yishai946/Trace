import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Splash } from '../components/Splash';
import { applyDocumentDirection } from '../i18n/rtl';
import { ThemeProvider, useTheme } from '../theme';

const queryClient = new QueryClient();

function ThemedStack() {
  const { themeId, theme } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      <StatusBar style={themeId === 'night' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.surface } }}>
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
      </Stack>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') applyDocumentDirection(document);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
