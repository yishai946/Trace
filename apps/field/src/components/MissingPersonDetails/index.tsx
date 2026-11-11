import { spacing, typography } from '@trace/design';
import type { Mission } from '@trace/schemas';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { formatTime } from '../../mission/missionArea';
import { useTheme } from '../../theme';
import { MissingPersonPhoto } from '../MissingPersonPhoto';
import { Screen } from '../Screen';

/** A moment as its date and hour on the searcher's phone, e.g. `3.10, 11:20`. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  return `${date}, ${formatTime(iso)}`;
}

export interface MissingPersonDetailsProps {
  mission: Mission;
  /** "סגור", at the start of the bar. */
  closeAction: ReactNode;
}

/**
 * "פרטי נעדר מלאים" (Fm04): everything the commander entered about the missing person, read-only for the searcher
 * for the whole mission (UC-F04, decision 33). Fields the commander left empty are not shown.
 */
export function MissingPersonDetails({ mission, closeAction }: MissingPersonDetailsProps) {
  const { color } = useTheme().theme;
  const person = mission.missingPerson;
  const rows: { label: string; value: string }[] = [
    person.age === null ? null : { label: 'גיל', value: ltr(person.age) },
    person.disappearedAt ? { label: 'נעלם', value: ltr(formatDateTime(person.disappearedAt)) } : null,
    mission.lkp ? { label: 'נראה לאחרונה (LKP)', value: ltr(formatDateTime(mission.lkp.observedAt)) } : null,
    person.description ? { label: 'תיאור', value: person.description } : null,
    person.additionalInfo ? { label: 'מידע נוסף', value: person.additionalInfo } : null,
  ].filter((row) => row !== null);

  return (
    <Screen title="פרטי הנעדר" leading={closeAction}>
      <MissingPersonPhoto url={person.photoUrl} large />
      <Text accessibilityRole="header" style={[typography.title, { color: color.ink }]}>
        {person.name ?? 'שם הנעדר לא הוזן'}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, { borderTopColor: color.borderSubtle }]}>
          <Text style={[typography.meta, { color: color.inkMuted }]}>{row.label}</Text>
          <Text style={[typography.body, { color: color.ink }]}>{row.value}</Text>
        </View>
      ))}
      {rows.length === 0 ? (
        <Text style={[typography.body, { color: color.inkSecondary }]}>המנהל עוד לא הוסיף פרטים על הנעדר.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.space1, paddingTop: spacing.space5, borderTopWidth: 1 },
});
