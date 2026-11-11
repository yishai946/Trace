import { radius, spacing, typography } from '@trace/design';
import type { Mission, OwnParticipation } from '@trace/schemas';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from '../../api';
import { useSearcherProfile } from '../../auth';
import { ltr } from '../../i18n/rtl';
import { formatTime, toMissionArea } from '../../mission/missionArea';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge } from '../Badge';
import { CallsignChip } from '../CallsignChip';
import { MissionMap } from '../MissionMap';
import { Screen } from '../Screen';

/** The missing person's photo, sent with the searcher's token; the placeholder of the wireframes when there is none. */
function Photo({ url }: { url: string | null }) {
  const { color } = useTheme().theme;
  const token = useSession((s) => s.token);
  const [failed, setFailed] = useState(false);
  if (!url || !apiBaseUrl || !token || failed) {
    return (
      <View style={[styles.photo, styles.placeholder, { backgroundColor: color.surfaceRaised }]}>
        <Text style={[typography.caption, { color: color.inkMuted }]}>תמונה</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel="תמונת הנעדר"
      source={{ uri: `${apiBaseUrl.replace(/\/$/, '')}${url}`, headers: { authorization: `Bearer ${token}` } }}
      onError={() => setFailed(true)}
      style={styles.photo}
    />
  );
}

export interface WaitingForAssignmentProps {
  mission: Mission;
  participation: OwnParticipation;
}

/**
 * Fm04: what a searcher sees between joining and being assigned (UC-F02 step 3, decision 31): that they wait, the
 * general map with the LKP and the rally point, and who is missing. No other searcher appears anywhere on it.
 */
export function WaitingForAssignment({ mission, participation }: WaitingForAssignmentProps) {
  const { color } = useTheme().theme;
  const profile = useSearcherProfile();
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
      <View style={[styles.map, { borderColor: color.border }]}>
        <MissionMap area={toMissionArea([], mission)} />
      </View>
      <View
        accessibilityLabel="פרטי הנעדר"
        style={[styles.card, styles.person, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}
      >
        <Photo url={person.photoUrl} />
        <View style={styles.grow}>
          <Text style={[typography.title, { color: color.ink }]}>
            {person.name ?? 'שם הנעדר לא הוזן'}
            {person.age === null ? '' : `, ${ltr(person.age)}`}
          </Text>
          {times.length ? <Text style={[typography.meta, { color: color.inkMuted }]}>{times.join(', ')}</Text> : null}
          {person.description ? (
            <Text style={[typography.body, { color: color.inkSecondary }]}>{person.description}</Text>
          ) : null}
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
  status: { alignItems: 'center', borderWidth: pendingTokens.cardStrongBorder },
  person: { alignItems: 'flex-start' },
  grow: { flex: 1, gap: spacing.space1 },
  map: { height: pendingTokens.waitingMapH, borderWidth: 1, borderRadius: radius.radiusXl, overflow: 'hidden' },
  photo: { width: pendingTokens.photoW, height: pendingTokens.photoH, borderRadius: radius.radiusMd },
  placeholder: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing.space2 },
});
