import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** One key and value of a read-only list (wireframe `.tcx-ln`), at least 44px high. */
export function DetailLine({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const { color } = useTheme().theme;
  return (
    <View style={[styles.line, !first && { borderTopColor: color.borderSubtle, borderTopWidth: 1 }]}>
      <Text style={[typography.meta, styles.key, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[typography.bodyStrong, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4, minHeight: pendingTokens.touchTarget },
  key: { flex: 1 },
});
