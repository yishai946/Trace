import type { LngLat } from '@trace/geo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@trace/design';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { FinishActivityConfirm } from './FinishActivityConfirm';

export interface FinishActivityControlsProps {
  /** The mission's Rally Point; null while the mission is not loaded, which only drops the distance warning. */
  rallyPoint: LngLat | null;
  /** Finishes the activity (UC-F15). Without it the confirmation button stays disabled. */
  onFinish?: () => void;
  /** The finish is on its way to the server: no second tap. */
  pending: boolean;
  /** Why the last finish failed, in Hebrew; the searcher can press again. */
  error: string | null;
}

/**
 * "סיימתי פעילות…" (UC-F15, Fm16): a tap first asks to confirm and says what finishing means. Being far from the Rally
 * Point only warns (decision 30).
 */
export function FinishActivityControls({ rallyPoint, onFinish, pending, error }: FinishActivityControlsProps) {
  const { color } = useTheme().theme;
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.controls}>
      {confirming ? (
        <FinishActivityConfirm
          rallyPoint={rallyPoint}
          onConfirm={onFinish}
          onCancel={() => setConfirming(false)}
          pending={pending}
        />
      ) : (
        <Button label="סיימתי פעילות…" size="lg" block onPress={() => setConfirming(true)} />
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
  center: { textAlign: 'center' },
});
