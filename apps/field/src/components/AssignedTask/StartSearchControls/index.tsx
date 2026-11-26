import { spacing, typography } from '@trace/design';
import { startSearchBlockers } from '@trace/domain';
import { StyleSheet, Text, View } from 'react-native';
import { useOfflinePackage } from '../../../offline/useOfflinePackage';
import { usePermissions } from '../../../permissions/usePermissions';
import { useTheme } from '../../../theme';
import { Button } from '../../Button';
import { startHint } from '../startHint';

export interface StartSearchControlsProps {
  /** Starts the search (UC-F06). Without it the button stays disabled. */
  onStartSearch?: () => void;
  /** The start is on its way to the server: no second tap. */
  starting: boolean;
  /** Why the last start failed, in Hebrew; the searcher can press again. */
  startError: string | null;
}

/**
 * "התחל חיפוש" and what blocks it. Start Search is blocked until the essential package is saved on the phone (UC-F03,
 * decision 85) and the required permissions are granted (UC-F06, decision 73).
 */
export function StartSearchControls({ onStartSearch, starting, startError }: StartSearchControlsProps) {
  const { color } = useTheme().theme;
  const { savedParts } = useOfflinePackage();
  const { permissions, grant } = usePermissions();
  // Until the phone says what it allows, the button stays closed without claiming a permission is missing.
  const blockers = permissions
    ? startSearchBlockers(savedParts, {
        location: permissions.location === 'granted',
        backgroundLocation: permissions.backgroundLocation === 'granted',
        push: permissions.push === 'granted',
      })
    : null;
  const firstMissing = blockers?.missingPermissions[0];
  const hint = !blockers
    ? 'בודקים הרשאות…'
    : blockers.ready
      ? 'מעקב המיקום והמסלול מתחילים רק בלחיצה'
      : startHint(blockers);

  return (
    <View style={styles.controls}>
      <Button
        label="התחל חיפוש"
        variant="primary"
        size="lg"
        block
        disabled={!blockers?.ready || !onStartSearch || starting}
        onPress={onStartSearch}
      />
      <Text accessibilityLiveRegion="polite" style={[typography.caption, styles.center, { color: color.inkMuted }]}>
        {hint}
      </Text>
      {startError ? (
        <Text accessibilityRole="alert" style={[typography.caption, styles.center, { color: color.dangerInk }]}>
          {startError}
        </Text>
      ) : null}
      {firstMissing ? (
        <Button label="אשר הרשאה" variant="secondary" block onPress={() => void grant(firstMissing)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { gap: spacing.space5 },
  center: { textAlign: 'center' },
});
