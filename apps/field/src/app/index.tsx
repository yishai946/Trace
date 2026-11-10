import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useStartRoute } from '../auth';
import { useTheme } from '../theme';

/** Decides where the app opens (UC-F01): sign-in, the name on first sign-in, or the app. The splash covers the wait. */
export default function Index() {
  const href = useStartRoute();
  const { color } = useTheme().theme;
  if (href) return <Redirect href={href} />;
  return (
    <View style={[styles.wait, { backgroundColor: color.surface }]}>
      <ActivityIndicator color={color.inkMuted} accessibilityLabel="טוען" />
    </View>
  );
}

const styles = StyleSheet.create({
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
