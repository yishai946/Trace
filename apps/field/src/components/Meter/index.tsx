import { radius } from '@trace/design';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** Trace Console `.tc-meter`: a track with an accent fill. `percent` is 0 to 100; `label` names what it measures. */
export function Meter({ percent, label }: { percent: number; label: string }) {
  const { color } = useTheme().theme;
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={[styles.track, { backgroundColor: color.track }]}
    >
      <View style={[styles.fill, { width: `${value}%`, backgroundColor: color.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: pendingTokens.meterH, borderRadius: radius.radiusSm, overflow: 'hidden' },
  fill: { height: '100%' },
});
