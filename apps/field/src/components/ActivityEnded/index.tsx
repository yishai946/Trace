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
 * and they may join the mission again while it is active (UC-C18, decision 70).
 */
export function ActivityEnded({ mission, removed, onJoinAgain, onOpenMyMissions }: ActivityEndedProps) {
  const { color } = useTheme().theme;
  const person = mission?.missingPerson.name;
  return (
    <Screen
      title="סיום פעילות"
      tabbed
      footer={
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button label="המסעות שלי" size="lg" block onPress={onOpenMyMissions} />
          </View>
          <View style={styles.grow}>
            <Button label="הצטרף שוב" variant="primary" size="lg" block onPress={onJoinAgain} />
          </View>
        </View>
      }
    >
      <View style={[styles.card, { backgroundColor: color.surfaceSunken, borderColor: color.borderStrong }]}>
        <View style={styles.row}>
          <Text accessibilityRole="header" style={[typography.title, styles.grow, { color: color.ink }]}>
            {removed ? 'הוסרת מהפעילות' : 'הפעילות הסתיימה'}
          </Text>
          <Badge label="הסתיימה" />
        </View>
        <Text style={[typography.body, { color: color.inkSecondary }]}>
          {removed
            ? 'המנהל הסיר אותך מהמסע. ההשתתפות נשמרה בהיסטוריה, ואפשר להצטרף שוב.'
            : 'ההשתתפות נשמרה בהיסטוריה, ואפשר להצטרף שוב.'}
        </Text>
      </View>
      <View style={[styles.line, { borderTopColor: color.borderSubtle }]}>
        <Text style={[typography.body, styles.grow, { color: color.ink }]}>מעקב בטיחות</Text>
        <Text style={[typography.meta, { color: color.inkMuted }]}>נפסק</Text>
      </View>
      {mission ? (
        <View style={[styles.line, { borderTopColor: color.borderSubtle }]}>
          <Text style={[typography.body, styles.grow, { color: color.ink }]}>מסע</Text>
          <Text style={[typography.meta, { color: color.inkMuted }]}>
            {person ? `${mission.name}, ${person}` : mission.name}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.space4,
    padding: spacing.space6,
    borderWidth: pendingTokens.cardStrongBorder,
    borderRadius: radius.radiusLg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  grow: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.space5, borderTopWidth: 1 },
  buttons: { flexDirection: 'row', gap: spacing.space4 },
});
