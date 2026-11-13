import { radius, spacing, typography } from '@trace/design';
import { REPORT_TYPE_LABELS, REPORT_TYPES, type ReportType } from '@trace/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { FieldError } from '../FieldError';
import { Icon, type IconName } from '../Icon';

const ICONS: Record<ReportType, IconName> = {
  finding: 'check',
  hazard: 'hazard',
  inaccessible: 'lock',
  general: 'messages',
  located: 'flag',
};

const LOCATED_NOTE = 'התראה קריטית למנהל, לא סוגר את המסע';

/**
 * The five report categories (Fm08, decision 15) as one radio group: four in two columns, "הנעדר אותר" full width
 * with what it does. The chosen option is raised with an accent border.
 */
export function ReportTypePicker({
  value,
  onChange,
  error,
}: {
  value: ReportType | null;
  onChange: (type: ReportType) => void;
  error?: string | null;
}) {
  const { color } = useTheme().theme;
  const option = (type: ReportType) => {
    const selected = value === type;
    const note = type === 'located' ? LOCATED_NOTE : null;
    return (
      <Pressable
        key={type}
        role="radio"
        aria-checked={selected}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={note ? `${REPORT_TYPE_LABELS[type]}, ${note}` : REPORT_TYPE_LABELS[type]}
        onPress={() => onChange(type)}
        style={[
          styles.option,
          {
            backgroundColor: selected ? color.surfaceRaised : color.surfaceSunken,
            borderColor: selected ? color.accent : color.borderField,
          },
        ]}
      >
        <Icon name={ICONS[type]} size={pendingTokens.iconMd} color={selected ? color.accent : color.inkSecondary} />
        <View style={styles.text}>
          <Text
            style={[
              typography.body,
              { fontSize: pendingTokens.reportOptionText, color: color.ink },
              selected && { fontWeight: typography.title.fontWeight },
            ]}
          >
            {REPORT_TYPE_LABELS[type]}
          </Text>
          {note ? <Text style={[typography.caption, { color: color.inkMuted }]}>{note}</Text> : null}
        </View>
      </Pressable>
    );
  };

  const [first, second, third, fourth, fifth] = REPORT_TYPES;
  return (
    <View style={styles.field}>
      <Text importantForAccessibility="no" aria-hidden style={[typography.meta, styles.label, { color: color.ink }]}>
        קטגוריה
      </Text>
      <View role="radiogroup" aria-label="קטגוריה" style={styles.group}>
        <View style={styles.row}>
          {option(first)}
          {option(second)}
        </View>
        <View style={styles.row}>
          {option(third)}
          {option(fourth)}
        </View>
        <View style={styles.row}>{option(fifth)}</View>
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space3 },
  label: { fontWeight: typography.bodyStrong.fontWeight },
  group: { gap: spacing.space4 },
  row: { flexDirection: 'row', gap: spacing.space4 },
  option: {
    flex: 1,
    minHeight: pendingTokens.reportOptionH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space4,
    paddingHorizontal: spacing.space5,
    borderWidth: pendingTokens.reportOptionBorder,
    borderRadius: radius.radiusLg,
  },
  text: { flexShrink: 1 },
});
