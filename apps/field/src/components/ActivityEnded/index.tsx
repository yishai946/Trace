import { radius, spacing, typography } from '@trace/design';
import type { Mission } from '@trace/schemas';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Screen } from '../Screen';

export interface ActivityEndedProps {
  mission: Mission | undefined;
  /** The commander ended it (UC-C18), rather than the searcher. */
  removed: boolean;
  onJoinAgain: () => void;
  onOpenMyMissions: () => void;
}

/**
 * Fm13 "הוסרת מהפעילות": the participation ended. Tracking stopped, what the searcher collected stays in the history,
 * and they may join the mission again while it is active (UC-C18, decisions 70, 82).
 */
export function ActivityEnded({ mission, removed, onJoinAgain, onOpenMyMissions }: ActivityEndedProps) {
  const { color } = useTheme().theme;
  const person = mission?.missingPerson.name;
  const canJoinAgain = mission?.status === 'active';
  const lines = [
    { key: 'מעקב בטיחות', value: 'נפסק' },
    ...(mission ? [{ key: 'מסע', value: person ? `${mission.name}, ${person}` : mission.name }] : []),
  ];
  return (
    <Screen
      title="סיום פעילות"
      tabbed
      footer={
        <>
          <Button label="המסעות שלי" variant="primary" size="lg" block onPress={onOpenMyMissions} />
          {canJoinAgain ? <Button label="הצטרף שוב" size="lg" block onPress={onJoinAgain} /> : null}
        </>
      }
    >
      <View style={[styles.card, styles.strong, { backgroundColor: color.surface, borderColor: color.inkMuted }]}>
        <View style={styles.row}>
          <Text accessibilityRole="header" style={[typography.title, styles.grow, { color: color.ink }]}>
            {removed ? 'הוסרת מהפעילות' : 'הפעילות הסתיימה'}
          </Text>
          <Badge label="הסתיימה" />
        </View>
        <Text style={[typography.body, { color: color.inkSecondary }]}>
          {removed
            ? `המנהל הסיר אותך מהמסע. ההשתתפות נשמרה בהיסטוריה${canJoinAgain ? ', ואפשר להצטרף שוב' : ''}.`
            : `ההשתתפות נשמרה בהיסטוריה${canJoinAgain ? ', ואפשר להצטרף שוב' : ''}.`}
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
        {lines.map((line, i) => (
          <View key={line.key} style={[styles.row, i > 0 && [styles.divided, { borderTopColor: color.borderSubtle }]]}>
            <Text style={[typography.meta, styles.grow, { color: color.inkMuted }]}>{line.key}</Text>
            <Text style={[typography.body, { color: color.ink }]}>{line.value}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.space4, padding: spacing.space6, borderWidth: 1, borderRadius: radius.radiusLg },
  strong: { borderWidth: pendingTokens.cardStrongBorder },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  divided: { paddingTop: spacing.space4, borderTopWidth: 1 },
  grow: { flex: 1 },
});
