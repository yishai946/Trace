import { spacing, typography } from '@trace/design';
import { startSearchBlockers, type RequiredPermission } from '@trace/domain';
import { StyleSheet, Text, View } from 'react-native';
import { useOfflinePackage } from '../../offline/useOfflinePackage';
import { usePermissions } from '../../permissions/usePermissions';
import { useTheme } from '../../theme';
import { Notice } from '../Notice';
import { PermissionRow } from './PermissionRow';
import { blockedSummary } from './blockedSummary';

const REQUIRED_ROWS: { permission: RequiredPermission; label: string; caption: string }[] = [
  { permission: 'location', label: 'מיקום', caption: 'להצגת מיקומך למנהל' },
  { permission: 'backgroundLocation', label: 'מיקום ברקע', caption: 'המעקב ממשיך כשהמסך כבוי' },
  { permission: 'push', label: 'התראות Push', caption: 'שיבוץ, הודעות והתראות SOS' },
];

/**
 * Fm03 "הרשאות": what the phone allows, a way to grant each, and one banner that lists everything keeping "התחל חיפוש"
 * closed: the unfinished offline package and the missing permissions (UC-F06, decisions 73 and 85). Joining and viewing
 * the mission stay open meanwhile.
 */
export function ReadinessPermissions() {
  const { color } = useTheme().theme;
  const { permissions, grant } = usePermissions();
  const { status, savedParts } = useOfflinePackage();
  if (!permissions) return null;

  const blockers = startSearchBlockers(savedParts, {
    location: permissions.location === 'granted',
    backgroundLocation: permissions.backgroundLocation === 'granted',
    push: permissions.push === 'granted',
  });
  // Until the device says what it holds, the package is not "missing", just not read yet.
  const showBanner = !blockers.ready && status !== 'checking';

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[typography.title, { color: color.ink }]}>
        הרשאות
      </Text>
      <View accessibilityRole="list">
        {REQUIRED_ROWS.map((row) => (
          <PermissionRow
            key={row.permission}
            label={row.label}
            caption={row.caption}
            required
            state={permissions[row.permission]}
            onGrant={() => void grant(row.permission)}
          />
        ))}
        <PermissionRow
          label="מצלמה"
          caption="לצילום בדיווחים, מתבקשת רק בעת צילום"
          required={false}
          state={permissions.camera}
          askLater="בעת צילום"
        />
      </View>
      {showBanner ? (
        <Notice icon="alert" tone="warn" live>
          {blockedSummary(blockers)}
        </Notice>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ section: { gap: spacing.space3 } });
