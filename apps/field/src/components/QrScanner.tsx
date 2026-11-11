import { radius, spacing, typography } from '@trace/design';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { pendingTokens } from '../theme/pending';
import { Button } from './Button';

const CORNERS = [
  { top: true, start: true },
  { top: true, start: false },
  { top: false, start: true },
  { top: false, start: false },
] as const;

/**
 * The QR frame of the join screen (wireframe Fm02 `.tcx-scan`): the camera once the searcher allows it, and the
 * request for it before. Scanning is one of three ways to join, so a refused camera is not an error.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const { color } = useTheme().theme;
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <View style={[styles.frame, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScan(data)}
        />
      ) : null}
      {CORNERS.map(({ top, start }) => (
        <View
          key={`${top}-${start}`}
          style={[
            styles.corner,
            { borderColor: color.ink },
            top ? styles.top : styles.bottom,
            start ? styles.start : styles.end,
          ]}
        />
      ))}
      {permission?.granted ? null : (
        <>
          <Text style={[typography.body, styles.text, { color: color.inkSecondary }]}>
            {permission && !permission.canAskAgain
              ? 'אין הרשאה למצלמה. אפשר להזין את הקוד למטה.'
              : 'כוון את המצלמה אל קוד ה-QR'}
          </Text>
          {permission?.canAskAgain ? <Button label="הפעל מצלמה" onPress={() => void requestPermission()} /> : null}
        </>
      )}
    </View>
  );
}

const inset = pendingTokens.scanCornerInset;
const stroke = pendingTokens.scanCornerStroke;

const styles = StyleSheet.create({
  frame: {
    height: pendingTokens.scanH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space4,
    padding: spacing.space7,
    borderWidth: 1,
    borderRadius: radius.radiusXl,
    overflow: 'hidden',
  },
  text: { textAlign: 'center' },
  corner: { position: 'absolute', width: pendingTokens.scanCorner, height: pendingTokens.scanCorner },
  top: { top: inset, borderTopWidth: stroke },
  bottom: { bottom: inset, borderBottomWidth: stroke },
  start: { start: inset, borderStartWidth: stroke },
  end: { end: inset, borderEndWidth: stroke },
});
