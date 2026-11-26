import { radius, spacing, typography } from '@trace/design';
import { rallyPointAdvice } from '@trace/domain';
import { distanceMeters, type LngLat } from '@trace/geo';
import { StyleSheet, Text, View } from 'react-native';
import { useCurrentFix } from '../../location/useCurrentFix';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { Notice } from '../Notice';

const ADVICE = {
  far: 'אתה עדיין רחוק מנקודת הכינוס. מומלץ להגיע אליה לפני הסיום, אבל אפשר לסיים גם עכשיו.',
  unknown: 'לא הצלחנו לקבוע את מיקומך. מומלץ להגיע לנקודת הכינוס לפני הסיום, אבל אפשר לסיים גם עכשיו.',
} as const;

export interface FinishActivityConfirmProps {
  rallyPoint: LngLat | null;
  onConfirm?: () => void;
  onCancel: () => void;
  pending: boolean;
}

/**
 * The confirmation of "סיימתי פעילות" (UC-F15). It takes the phone's position once, only to warn when the searcher is
 * far from the Rally Point (decision 30); the warning never blocks, and without a position the button still works.
 */
export function FinishActivityConfirm({ rallyPoint, onConfirm, onCancel, pending }: FinishActivityConfirmProps) {
  const { color } = useTheme().theme;
  const { state, fix } = useCurrentFix({ prompt: false });
  const meters = fix && rallyPoint ? distanceMeters(fix.position, rallyPoint) : null;
  // The position is still being taken: no warning yet, so a near searcher never sees one flash by.
  const advice = state === 'locating' ? 'near' : rallyPointAdvice(meters);
  return (
    <View
      accessibilityRole="alert"
      style={[styles.confirm, { borderColor: color.border, backgroundColor: color.surfaceRaised }]}
    >
      <Text style={[typography.title, { color: color.ink }]}>לסיים פעילות ולצאת מהשטח?</Text>
      <Text style={[typography.body, { color: color.inkSecondary }]}>
        מעקב המיקום ייפסק ותפסיק להיחשב מחפש פעיל במסע. מה שאספת נשמר, ואפשר להצטרף שוב למסע פעיל.
      </Text>
      {advice === 'near' ? null : (
        <Notice icon="alert" tone="warn" live>
          {ADVICE[advice]}
        </Notice>
      )}
      <Button
        label="סיים פעילות"
        variant="primary"
        size="lg"
        block
        disabled={!onConfirm || pending}
        onPress={onConfirm}
      />
      <Button label="ביטול" size="lg" block disabled={pending} onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  confirm: { gap: spacing.space4, padding: spacing.space5, borderWidth: 1, borderRadius: radius.radiusMd },
});
