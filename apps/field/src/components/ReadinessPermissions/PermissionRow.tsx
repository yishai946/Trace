import { radius, size, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import type { PermissionState } from '../../permissions/devicePermissions';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Icon } from '../Icon';

export interface PermissionRowProps {
  label: string;
  caption: string;
  required: boolean;
  state: PermissionState;
  /** The camera is asked for only when a report takes a photo: its row says so instead of offering a button. */
  askLater?: string;
  onGrant?: () => void;
}

/** One permission of Fm03 (`<li>` of the wireframe): a check, what it is for, and "מאושר" or the button to grant it. */
export function PermissionRow({ label, caption, required, state, askLater, onGrant }: PermissionRowProps) {
  const { color } = useTheme().theme;
  const granted = state === 'granted';
  return (
    <View accessibilityRole="listitem" style={[styles.row, { borderTopColor: color.borderSubtle }]}>
      <View
        style={[
          styles.box,
          {
            borderColor: granted ? color.success : color.borderStrong,
            backgroundColor: granted ? color.chip : 'transparent',
          },
        ]}
      >
        {granted ? <Icon name="check" color={color.success} size={size.checkIcon} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.title}>
          <Text style={[typography.bodyStrong, { color: color.ink }]}>{label}</Text>
          <Badge label={required ? 'חובה' : 'רשות'} />
        </View>
        <Text style={[typography.caption, { color: color.inkMuted }]}>{caption}</Text>
      </View>
      {granted ? (
        <Badge label="מאושר" tone="ok" />
      ) : askLater ? (
        <Text style={[typography.caption, { color: color.inkMuted }]}>{askLater}</Text>
      ) : (
        <Button
          label={state === 'blocked' ? 'פתח הגדרות' : 'אשר'}
          accessibilityLabel={`${state === 'blocked' ? 'פתח הגדרות עבור' : 'אשר'} ${label}`}
          size="lg"
          onPress={onGrant}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space6,
    minHeight: size.cardRowH,
    borderTopWidth: 1,
  },
  box: {
    width: size.stepMarker,
    height: size.stepMarker,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.radiusSm,
  },
  text: { flex: 1, gap: spacing.space1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
});
