import { radius, spacing, typography } from '@trace/design';
import { useCameraPermissions } from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { takeReportPhoto } from '../../reports/photo';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Button } from '../Button';

export interface ReportPhotoValue {
  uri: string;
  base64: string;
}

const NO_PERMISSION = 'אין הרשאה למצלמה. אפשר לשלוח בלי תמונה.';
const FAILED = 'לא ניתן לצלם. אפשר לשלוח בלי תמונה.';

/**
 * The report's optional photo (UC-F09, decision 76). The camera permission is asked only when the searcher presses to
 * take a photo, and a refusal never blocks the report. The photo is shrunk on the phone as soon as it is taken.
 */
export function ReportPhoto({
  photo,
  onChange,
  disabled = false,
}: {
  photo: ReportPhotoValue | null;
  onChange: (photo: ReportPhotoValue | null) => void;
  disabled?: boolean;
}) {
  const { color } = useTheme().theme;
  const [permission, requestPermission] = useCameraPermissions();
  const [taking, setTaking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const blocked = permission !== null && !permission.granted && !permission.canAskAgain;

  async function take() {
    setMessage(null);
    setTaking(true);
    try {
      const allowed = permission?.granted ? permission : await requestPermission();
      if (!allowed.granted) {
        setMessage(NO_PERMISSION);
        return;
      }
      const taken = await takeReportPhoto();
      if (taken) onChange(taken);
    } catch {
      setMessage(FAILED);
    } finally {
      setTaking(false);
    }
  }

  if (photo) {
    return (
      <View style={styles.attached}>
        <Image
          source={{ uri: photo.uri }}
          accessibilityIgnoresInvertColors
          style={[styles.thumb, { borderColor: color.border }]}
        />
        <Text style={[typography.body, styles.text, { color: color.ink }]}>תמונה מצורפת</Text>
        <Button label="הסר" onPress={() => onChange(null)} disabled={disabled} />
      </View>
    );
  }
  return (
    <View style={styles.field}>
      <Button
        label={taking ? 'מצלם…' : 'צרף תמונה'}
        accessibilityLabel="צרף תמונה"
        icon="camera"
        size="lg"
        block
        trailing="אופציונלי"
        disabled={disabled || taking || blocked}
        onPress={() => void take()}
      />
      {blocked || message ? (
        <Text style={[typography.meta, { color: color.inkSecondary }]}>{message ?? NO_PERMISSION}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space3 },
  attached: { flexDirection: 'row', alignItems: 'center', gap: spacing.space5 },
  thumb: {
    width: pendingTokens.reportThumb,
    height: pendingTokens.reportThumb,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
  text: { flex: 1 },
});
