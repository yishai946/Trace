import { radius, size, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/** Label and value rows on a bordered surface (wireframe `.tcx-surf` with `.tcx-ln` lines) used by both SOS states. */
export function SosFacts({ rows }: { rows: { label: string; value: string }[] }) {
  const { color } = useTheme().theme;
  return (
    <View
      style={[styles.box, { backgroundColor: color.surface, borderColor: color.border, borderRadius: radius.radiusLg }]}
    >
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[styles.line, index > 0 && { borderTopWidth: 1, borderTopColor: color.borderSubtle }]}
        >
          <Text style={[typography.meta, { color: color.inkMuted }]}>{row.label}</Text>
          <Text style={[typography.body, styles.value, { color: color.ink }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, paddingHorizontal: spacing.space6 },
  line: { minHeight: size.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  value: { flex: 1 },
});
