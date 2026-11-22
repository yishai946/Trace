import { radius, spacing, typography } from '@trace/design';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl } from '../api';
import { useSavedMission, useSavedPhotoUri } from '../offline/savedPackage';
import { useSession } from '../state/session';
import { useTheme } from '../theme';
import { pendingTokens } from '../theme/pending';

/**
 * The missing person's photo, fetched with the searcher's token (members only, UC-F04). When it cannot be fetched
 * (no connection) the copy saved by the offline package shows. The wireframes' placeholder (`.tcx-ph`) stands in when
 * there is none.
 */
export function MissingPersonPhoto({
  url,
  large = false,
  fromPhone = false,
}: {
  url: string | null;
  large?: boolean;
  /** The mission shown is the saved copy: the saved photo goes with it, with no request to a server that is not there. */
  fromPhone?: boolean;
}) {
  const { color } = useTheme().theme;
  const token = useSession((s) => s.token);
  const [failed, setFailed] = useState(false);
  const savedUri = useSavedPhotoUri().data;
  // The saved photo belongs to the saved mission: it shows only for the photo that mission points to.
  const savedFor = useSavedMission().data?.missingPerson.photoUrl;
  const saved = savedFor === url ? savedUri : null;
  const size = large ? styles.large : styles.small;
  const alt = 'תמונת הנעדר';
  const showSaved = !!url && !!saved && (fromPhone || failed || !apiBaseUrl || !token);
  if (showSaved) {
    return <Image accessibilityLabel={alt} source={{ uri: saved }} resizeMode="cover" style={[size, styles.image]} />;
  }
  if (!url || !apiBaseUrl || !token || failed) {
    return (
      <View style={[size, styles.placeholder, { backgroundColor: color.surfaceRaised }]}>
        <Text style={[typography.caption, { color: color.inkMuted }]}>תמונה</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={alt}
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
