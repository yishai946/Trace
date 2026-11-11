import { radius, spacing, typography } from '@trace/design';
import { formatCallsign } from '@trace/domain';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { pendingTokens } from '../theme/pending';

interface CallsignChipProps {
  callsign: number;
  sos?: boolean;
  /** Dashed: a searcher waiting for an assignment (`.tc-callsign--waiting`). */
  waiting?: boolean;
}

/** Trace Console CallsignChip: the searcher's two-digit number, identical across Command and Field. */
export function CallsignChip({ callsign, sos = false, waiting = false }: CallsignChipProps) {
  const { color } = useTheme().theme;
  const dashed = waiting && !sos;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: sos ? color.danger : dashed ? 'transparent' : color.chip },
        dashed && [styles.waiting, { borderColor: color.borderStrong }],
      ]}
    >
      <Text style={[typography.callsign, { color: sos ? color.onDanger : dashed ? color.inkSecondary : color.ink }]}>
        {formatCallsign(callsign)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: pendingTokens.callsignMinW,
    height: pendingTokens.callsignH,
    paddingHorizontal: spacing.space2,
    borderRadius: radius.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: { borderWidth: 1, borderStyle: 'dashed' },
});
