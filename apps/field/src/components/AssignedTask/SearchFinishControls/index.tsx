import { radius, spacing, typography } from '@trace/design';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { Button } from '../../Button';

export interface SearchFinishControlsProps {
  /** Finishes the search (UC-F08). Without it the buttons stay disabled. */
  onFinish?: () => void;
  /** The finish is on its way to the server: no second tap. */
  pending: boolean;
  /** Why the last finish failed, in Hebrew; the searcher can press again. */
  error: string | null;
}

/**
 * "סיימתי חיפוש…" (UC-F08, Fm07). The searcher cannot undo it (only the commander can start them again), so a tap
 * first asks to confirm and says what finishing means: still assigned, not Activity Ended, polygon not completed.
 */
export function SearchFinishControls({ onFinish, pending, error }: SearchFinishControlsProps) {
  const { color } = useTheme().theme;
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.controls}>
      {confirming ? (
        <View
          accessibilityRole="alert"
          style={[styles.confirm, { borderColor: color.border, backgroundColor: color.surfaceRaised }]}
        >
          <Text style={[typography.title, { color: color.ink }]}>סיימתי חיפוש?</Text>
          <Text style={[typography.body, { color: color.inkSecondary }]}>
            משימת החיפוש תסתיים. תישאר משובץ לפוליגון עד החלטת המנהל. זה לא סיום פעילות, והפוליגון לא יסומן כהושלם.
          </Text>
          <Button
            label="סיים חיפוש"
            variant="primary"
            size="lg"
            block
            disabled={!onFinish || pending}
            onPress={onFinish}
          />
          <Button label="ביטול" size="lg" block disabled={pending} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button label="סיימתי חיפוש…" size="lg" block icon="stop" onPress={() => setConfirming(true)} />
      )}
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
  confirm: { gap: spacing.space4, padding: spacing.space5, borderWidth: 1, borderRadius: radius.radiusMd },
  center: { textAlign: 'center' },
});
