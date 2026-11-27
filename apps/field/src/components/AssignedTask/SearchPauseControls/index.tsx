import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { Button } from '../../Button';

export interface SearchPauseControlsProps {
  /** The task is Paused: the button resumes, otherwise it pauses. */
  paused: boolean;
  onPause?: () => void;
  onResume?: () => void;
  /** A pause or resume is on its way to the server: no second tap. */
  pending: boolean;
  /** Why the last pause or resume failed, in Hebrew; the searcher can press again. */
  error: string | null;
}

/**
 * Personal Pause and Resume (UC-F07, Fm06 and Fm07). While searching: "השהה". While paused: a primary "המשך חיפוש" and
 * a note that safety tracking goes on but the movement does not count toward Coverage (decision 71).
 */
export function SearchPauseControls({
  paused,
  onPause,
  onResume,
  pending,
  error,
  missionPaused = false,
}: SearchPauseControlsProps) {
  const { color } = useTheme().theme;
  const action = paused ? onResume : onPause;
  return (
    <View style={styles.controls}>
      <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: color.inkMuted }]}>
        {paused
          ? 'החיפוש מושהה. מעקב הבטיחות ממשיך, והתנועה לא נספרת לכיסוי.'
          : 'המסלול שלך נרשם והמנהל רואה אותך על המפה'}
      </Text>
      <Button
        label={paused ? 'המשך חיפוש' : 'השהה'}
        variant={paused ? 'primary' : 'secondary'}
        size="lg"
        block
        icon={paused ? 'play' : 'pause'}
        disabled={!action || pending}
        onPress={action}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[typography.caption, styles.center, { color: color.dangerInk }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { gap: spacing.space4 },
  center: { textAlign: 'center' },
});
