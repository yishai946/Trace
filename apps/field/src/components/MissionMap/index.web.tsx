import { spacing, typography } from '@trace/design';
import type { LngLat } from '@trace/geo';
import { StyleSheet, Text, View } from 'react-native';
import type { MissionArea } from '../../mission/missionArea';
import { useTheme } from '../../theme';

export interface MissionMapProps {
  area: MissionArea;
  /** One more point to show, such as the place of a sighting being reported (UC-F10). */
  marker?: { position: LngLat; label: string } | null;
  /** Taps on the map are not handled here: the stand-in has no map to tap. */
  onPressMap?: (position: LngLat) => void;
  /** The map's name for screen readers. */
  accessibilityLabel?: string;
}

/**
 * Web stand-in for the mission map. MapLibre React Native runs only on Android and iOS, and Field ships only there;
 * the web build exists for development and tests, so it shows the map's place on the screen in the theme's ground.
 */
export function MissionMap({ area, marker = null, accessibilityLabel = 'מפת המסע' }: MissionMapProps) {
  const { color } = useTheme().theme;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.fill, { backgroundColor: color.mapGround }]}
    >
      <Text style={[typography.body, { color: color.inkSecondary }]}>
        {area.data.polygons.length ? area.data.polygons.map((p) => p.name).join(', ') : 'אין עדיין פוליגונים במסע'}
      </Text>
      {area.data.lkp ? (
        <Text style={[typography.body, { color: color.inkSecondary }]}>{`LKP ${area.data.lkp.time ?? ''}`.trim()}</Text>
      ) : null}
      {area.data.rally ? <Text style={[typography.body, { color: color.inkSecondary }]}>כינוס</Text> : null}
      {marker ? <Text style={[typography.body, { color: color.inkSecondary }]}>{marker.label}</Text> : null}
      <Text style={[typography.caption, { color: color.inkMuted }]}>המפה מוצגת באפליקציה ב-Android וב-iOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space2, padding: spacing.space7 },
});
