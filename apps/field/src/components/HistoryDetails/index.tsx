import { radius, spacing, typography } from '@trace/design';
import type { Mission } from '@trace/schemas';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../mission/missionArea';
import { endedOutcome } from '../../history/summary';
import { useOwnActivity } from '../../history/queries';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ActivityItems } from './ActivityItems';
import { DetailLine } from './DetailLine';

/**
 * An ended mission, read-only (Fm15, UC-F17, decision 95): how it ended, the missing person's details and what the
 * searcher did in it. Their own reports and sightings only. It has no action buttons: the mission is over.
 */
export function HistoryDetails({ mission }: { mission: Mission }) {
  const { color } = useTheme().theme;
  const activity = useOwnActivity(mission.id);
  const outcome = endedOutcome(mission);
  const person = mission.missingPerson;
  const notes = [person.description, person.additionalInfo, mission.stopped?.note, mission.located?.note].filter(
    (note) => !!note,
  );
  const mine = activity.data;

  return (
    <View
      role="region"
      accessibilityLabel="צפייה במסע שהסתיים, קריאה בלבד"
      style={[styles.panel, { backgroundColor: color.surface, borderColor: color.border }]}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[typography.title, styles.title, { color: color.ink }]}>
          {`המסע שלי, ${mission.name}`}
        </Text>
        <Badge icon="lock" label="קריאה בלבד" />
      </View>
      <View>
        <DetailLine first label="תוצאה" value={outcome.result} />
        {outcome.endedAt ? <DetailLine label="הסתיים" value={formatDateTime(outcome.endedAt)} /> : null}
        {mine ? <DetailLine label="סימן קריאה" value={String(mine.callsign)} /> : null}
        {mine ? <DetailLine label="הצטרפתי" value={formatDateTime(mine.joinedAt)} /> : null}
        {mine?.polygon ? <DetailLine label="הפוליגון שלי" value={`פוליגון ${mine.polygon.name}`} /> : null}
      </View>
      {notes.map((note) => (
        <Text key={note} style={[typography.body, { color: color.inkSecondary }]}>
          {note}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[typography.bodyStrong, { color: color.ink }]}>
        הפעילות שלי
      </Text>
      {activity.isPending ? (
        <ActivityIndicator color={color.inkMuted} accessibilityLabel="טוען את הפעילות" />
      ) : activity.isError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={[typography.body, { color: color.ink }]}>לא ניתן לטעון את הפעילות שלך</Text>
          <Button label="נסה שוב" onPress={() => void activity.refetch()} />
        </View>
      ) : (
        <ActivityItems activity={activity.data} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.space4, padding: spacing.space5, borderWidth: 1, borderRadius: radius.radiusLg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  title: { flex: 1 },
  error: { gap: spacing.space4, alignItems: 'flex-start' },
});
