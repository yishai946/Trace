import { spacing, typography } from '@trace/design';
import type { LngLat } from '@trace/geo';
import { buildMapStyle, ISRAEL_BOUNDS, mapIcons, maptilerProvider, type MapIcon, type MapProvider } from '@trace/map';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { MissionArea } from '../../mission/missionArea';
import { useTheme } from '../../theme';

/** MapTiler client key (public, restricted to the app in MapTiler's settings). Set in `apps/field/.env.local`. */
const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim();
const provider: MapProvider | null = mapTilerKey ? maptilerProvider(mapTilerKey) : null;

// MapLibre Native has no client-side contour generation and 3D is an open decision (TECH_STACK.md): relief only.
import type * as MapLibre from '@maplibre/maplibre-react-native';
type MapLibreModule = typeof MapLibre;

/**
 * MapLibre Native is a native module: it is missing from Expo Go, and importing it there throws at load time, which
 * would take the whole route down. Load it lazily so the app still opens and the map shows a notice instead.
 */
function loadMapLibre(): MapLibreModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch {
    return null;
  }
}
const mapLibre = loadMapLibre();

const terrain = { hillshade: true, contours: false, terrain3d: false };

export interface MissionMapProps {
  area: MissionArea;
}

/**
 * The mission map on Android and iOS: MapLibre Native with the shared Trace Console style (`@trace/map`), rebuilt
 * from the current theme so day and night switch the map with the rest of the app. Frames the mission area, or
 * Israel before the mission has polygons.
 */
export function MissionMap({ area }: MissionMapProps) {
  const { themeId, theme } = useTheme();
  const mapStyle = useMemo(
    () => (provider ? buildMapStyle({ themeId, provider, terrain, data: area.data }) : null),
    [themeId, area.data],
  );

  if (!mapLibre || !mapStyle) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel="מפת המסע"
        style={[styles.fill, styles.notice, { backgroundColor: theme.color.mapGround }]}
      >
        <Text style={[typography.body, { color: theme.color.inkSecondary }]}>
          {mapLibre ? 'המפה לא מוגדרת: חסר EXPO_PUBLIC_MAPTILER_API_KEY' : 'המפה דורשת בילד פיתוח (לא Expo Go)'}
        </Text>
      </View>
    );
  }

  const { Camera, Map, Marker } = mapLibre;
  const icons = mapIcons(themeId);
  // The style's symbol layers need raster images, which MapLibre Native cannot make from the shared SVG symbols.
  // The few fixed points a searcher sees are drawn as markers from the same SVG instead.
  const symbol = (id: string, label: string, lngLat: LngLat, icon: MapIcon | undefined) =>
    icon ? (
      <Marker key={id} id={id} lngLat={lngLat}>
        <View accessibilityRole="image" accessibilityLabel={label}>
          <SvgXml xml={icon.svg} width={icon.size} height={icon.size} />
        </View>
      </Marker>
    ) : null;
  return (
    <Map style={styles.fill} mapStyle={mapStyle} accessibilityLabel="מפת המסע" logo={false} compass={false}>
      <Camera bounds={area.bounds ?? ISRAEL_BOUNDS} padding={framePadding} duration={0} />
      {area.data.rally ? symbol('rally', 'נקודת כינוס', area.data.rally, icons.rally) : null}
      {area.data.lkp
        ? symbol('lkp', `LKP ${area.data.lkp.time ?? ''}`.trim(), area.data.lkp.position, icons.lkp)
        : null}
    </Map>
  );
}

const framePadding = {
  top: spacing.space7,
  bottom: spacing.space7,
  left: spacing.space7,
  right: spacing.space7,
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  notice: { alignItems: 'center', justifyContent: 'center', padding: spacing.space7 },
});
