import { radius, spacing, typography } from '@trace/design';
import { formatCallsign } from '@trace/domain';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

/** Trace Console CallsignChip: the searcher's two-digit number, identical across Command and Field. */
export function CallsignChip({ callsign, sos = false }: { callsign: number; sos?: boolean }) {
  const { color } = useTheme().theme;
  return (
    <View style={[styles.chip, { backgroundColor: sos ? color.danger : color.chip }]}>
      <Text style={[typography.callsign, { color: sos ? color.onDanger : color.ink }]}>{formatCallsign(callsign)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 26,
    height: 20,
    paddingHorizontal: spacing.space2,
    borderRadius: radius.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
