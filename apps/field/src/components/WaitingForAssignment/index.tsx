import { radius, size, spacing, stroke, typography } from '@trace/design';
import type { Mission, OwnParticipation } from '@trace/schemas';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSearcherProfile } from '../../auth';
import { ltr } from '../../i18n/rtl';
import { NOT_UP_TO_DATE } from '../../mission/mapWarning';
import { formatTime, toMissionArea } from '../../mission/missionArea';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { CallCommanderButton } from '../CallCommanderButton';
import { CallsignChip } from '../CallsignChip';
import { MissingPersonPhoto } from '../MissingPersonPhoto';
import { MissionMap } from '../MissionMap';
import { Notice } from '../Notice';
import { OfflineDownload } from '../OfflineDownload';
import { ReadinessPermissions } from '../ReadinessPermissions';
import { Screen } from '../Screen';

export interface WaitingForAssignmentProps {
  mission: Mission;
  participation: OwnParticipation;
  /** "פרטי נעדר מלאים": opens the missing person's full details. */
  onOpenDetails: () => void;
  /** The mission is the copy saved on the phone and the server could not be reached (UC-F04). */
  notUpToDate?: boolean;
}

/**
 * Fm04: what a searcher sees between joining and being assigned (UC-F02 step 3, decision 31): that they wait, the
 * general map with the LKP and the rally point, and who is missing. No other searcher appears anywhere on it.
 */
export function WaitingForAssignment({
  mission,
  participation,
  onOpenDetails,
  notUpToDate = false,
}: WaitingForAssignmentProps) {
  const { color } = useTheme().theme;
  const profile = useSearcherProfile();
  const area = useMemo(() => toMissionArea([], mission), [mission]);
  const person = mission.missingPerson;
  const times = [
    person.disappearedAt ? `נעלם ${ltr(formatTime(person.disappearedAt))}` : null,
    mission.lkp ? `LKP ${ltr(formatTime(mission.lkp.observedAt))}` : null,
  ].filter(Boolean);

  return (
    <Screen title={person.name ? `${mission.name}, ${person.name}` : mission.name} tabbed>
      <View
        accessibilityLabel="סטטוס שיבוץ"
        style={[styles.card, styles.status, { backgroundColor: color.surfaceSunken, borderColor: color.borderStrong }]}
      >
        <CallsignChip callsign={participation.callsign} waiting />
        <View style={styles.grow}>
          <Text style={[typography.title, { color: color.ink }]}>ממתין לשיבוץ מהמנהל</Text>
          {profile.data ? <Text style={[typography.meta, { color: color.inkMuted }]}>{profile.data.name}</Text> : null}
        </View>
        <Badge label="זמין" tone="accent" />
      </View>
      {notUpToDate ? (
        <Notice icon="wifiOff" tone="warn" live>
          {NOT_UP_TO_DATE}
        </Notice>
      ) : null}
      <CallCommanderButton />
      <OfflineDownload />
      <ReadinessPermissions />
      <View style={[styles.map, { borderColor: color.border }]}>
        <MissionMap area={area} />
      </View>
      <View
        accessibilityLabel="פרטי הנעדר"
        style={[styles.card, styles.person, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}
      >
        <MissingPersonPhoto url={person.photoUrl} fromPhone={notUpToDate} />
        <View style={styles.grow}>
          <Text style={[typography.title, { color: color.ink }]}>
            {person.name ?? 'שם הנעדר לא הוזן'}
            {person.age === null ? '' : `, ${ltr(person.age)}`}
          </Text>
          {times.length ? <Text style={[typography.meta, { color: color.inkMuted }]}>{times.join(', ')}</Text> : null}
          {person.description ? (
            <Text style={[typography.body, { color: color.inkSecondary }]}>{person.description}</Text>
          ) : null}
          <Button label="פרטי נעדר מלאים" variant="ghost" onPress={onOpenDetails} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.space6,
    padding: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusLg,
  },
  status: { alignItems: 'center', borderWidth: stroke.strokeStrong },
  person: { alignItems: 'flex-start' },
  grow: { flex: 1, gap: spacing.space1 },
  map: { height: size.mapPreviewH, borderWidth: 1, borderRadius: radius.radiusXl, overflow: 'hidden' },
});
