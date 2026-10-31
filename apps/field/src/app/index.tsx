import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CallsignChip } from '../components/CallsignChip';
import { useTheme } from '../theme/theme';

export default function HomeScreen() {
  const { themeId, theme, setThemeId } = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.color.surface }]}>
      <Text style={[typography.title, { color: theme.color.ink }]}>TRACE Field</Text>
      <View style={styles.row}>
        <CallsignChip callsign={7} />
        <Text style={[typography.body, { color: theme.color.inkSecondary }]}>ממתין לשיבוץ</Text>
      </View>
      <Button
        label={themeId === 'night' ? 'ערכת יום' : 'ערכת לילה'}
        onPress={() => setThemeId(themeId === 'night' ? 'day' : 'night')}
      />
      <Button label="SOS" variant="danger" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.space6, padding: spacing.space7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space5 },
});
