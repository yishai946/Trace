import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import type { MissionArea } from '../../mission/missionArea';
import { useTheme } from '../../theme';

export interface MissionMapProps {
  area: MissionArea;
}

/**
 * Web stand-in for the mission map. MapLibre React Native runs only on Android and iOS, and Field ships only there;
 * the web build exists for development and tests, so it shows the map's place on the screen in the theme's ground.
 */
export function MissionMap({ area }: MissionMapProps) {
  const { color } = useTheme().theme;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="מפת המסע"
      style={[styles.fill, { backgroundColor: color.mapGround }]}
    >
      <Text style={[typography.body, { color: color.inkSecondary }]}>
        {area.data.polygons.length ? area.data.polygons.map((p) => p.name).join(', ') : 'אין עדיין פוליגונים במסע'}
      </Text>
      <Text style={[typography.caption, { color: color.inkMuted }]}>המפה מוצגת באפליקציה ב-Android וב-iOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space2, padding: spacing.space7 },
});
