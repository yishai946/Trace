import { radius, spacing, typography } from '@trace/design';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from '../api';
import { useSession } from '../state/session';
import { useTheme } from '../theme';
import { pendingTokens } from '../theme/pending';

/**
 * The missing person's photo, fetched with the searcher's token (members only, UC-F04). The wireframes' placeholder
 * (`.tcx-ph`) stands in when there is none or it cannot load.
 */
export function MissingPersonPhoto({ url, large = false }: { url: string | null; large?: boolean }) {
  const { color } = useTheme().theme;
  const token = useSession((s) => s.token);
  const [failed, setFailed] = useState(false);
  const size = large ? styles.large : styles.small;
  if (!url || !apiBaseUrl || !token || failed) {
    return (
      <View style={[size, styles.placeholder, { backgroundColor: color.surfaceRaised }]}>
        <Text style={[typography.caption, { color: color.inkMuted }]}>תמונה</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel="תמונת הנעדר"
      source={{ uri: `${apiBaseUrl.replace(/\/$/, '')}${url}`, headers: { authorization: `Bearer ${token}` } }}
      onError={() => setFailed(true)}
      resizeMode="cover"
      style={[size, styles.image]}
    />
  );
}

const styles = StyleSheet.create({
  small: { width: pendingTokens.photoW, height: pendingTokens.photoH },
  large: { alignSelf: 'stretch', aspectRatio: pendingTokens.photoW / pendingTokens.photoH },
  image: { borderRadius: radius.radiusMd },
  placeholder: {
    borderRadius: radius.radiusMd,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.space2,
  },
});
