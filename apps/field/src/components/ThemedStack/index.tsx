import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Splash } from '../Splash';

/** The app's screens in the theme's colours, under the splash until it is done. */
export function ThemedStack() {
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
          <Stack.Screen name="report-edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sighting" options={{ presentation: 'modal' }} />
          <Stack.Screen name="missing-person" options={{ presentation: 'modal' }} />
        </Stack>
      </View>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1 },
});
