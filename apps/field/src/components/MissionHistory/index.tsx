import { spacing, typography } from '@trace/design';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEndedMissions } from '../../history/queries';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { HistoryRow } from '../HistoryRow';

/**
 * "היסטוריה" (Fm15, UC-F17): the missions the searcher took part in that ended. Pressing one opens it read-only with
 * the mission details and the searcher's own activity; only one is open at a time.
 */
export function MissionHistory() {
  const { color } = useTheme().theme;
  const missions = useEndedMissions();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View style={styles.stack}>
      <Text accessibilityRole="header" style={[typography.title, { color: color.ink }]}>
        היסטוריה
      </Text>
      {missions.isPending ? (
        <Text role="status" accessibilityLiveRegion="polite" style={[typography.body, { color: color.inkSecondary }]}>
          טוען את ההיסטוריה…
        </Text>
      ) : missions.isError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={[typography.body, { color: color.ink }]}>לא ניתן לטעון את ההיסטוריה</Text>
          <Button label="נסה שוב" onPress={() => void missions.refetch()} />
        </View>
      ) : missions.data.length === 0 ? (
        <Text style={[typography.body, { color: color.inkSecondary }]}>עוד אין מסעות שהסתיימו</Text>
      ) : (
        <View style={styles.stack}>
          {missions.data.map((mission) => (
            <HistoryRow
              key={mission.id}
              mission={mission}
              open={openId === mission.id}
              onPress={() => setOpenId(openId === mission.id ? null : mission.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space4 },
  error: { gap: spacing.space4, alignItems: 'flex-start' },
});
