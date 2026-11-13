import { radius, spacing, typography } from '@trace/design';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from '../../api';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/**
 * A report's photo thumbnail, fetched with the searcher's token (a report's photo is for those who may see the report,
 * decision 80). The wireframe's placeholder (`.tcx-ph`) stands in when there is none or it cannot load (Fm10).
 */
export function ReportImage({ url }: { url: string | null }) {
  const { color } = useTheme().theme;
  const token = useSession((s) => s.token);
  const [failed, setFailed] = useState(false);
  if (!url || !apiBaseUrl || !token || failed) {
    return (
      <View
        style={[styles.thumb, styles.placeholder, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}
      >
        <Text style={[typography.caption, { color: color.inkMuted }]}>תמונה</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel="תמונת הדיווח"
      source={{ uri: `${apiBaseUrl.replace(/\/$/, '')}${url}`, headers: { authorization: `Bearer ${token}` } }}
      onError={() => setFailed(true)}
      resizeMode="cover"
      style={[styles.thumb, styles.image]}
    />
  );
}

const styles = StyleSheet.create({
  thumb: { width: pendingTokens.reportThumb, height: pendingTokens.reportThumb },
  image: { borderRadius: radius.radiusMd },
  placeholder: {
    borderRadius: radius.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.space2,
  },
});
