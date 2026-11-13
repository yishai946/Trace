import { radius, spacing, typography } from '@trace/design';
import type { LngLat } from '@trace/geo';
import {
  buildMapStyle,
  iconId,
  ISRAEL_BOUNDS,
  mapIcons,
  maptilerProvider,
  type MapIconName,
  type MapReport,
  type MapProvider,
} from '@trace/map';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { MissionArea } from '../../mission/missionArea';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { reportLabel } from './reportLabel';

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
  /** One more point to show, such as the place of a sighting being reported (UC-F10). */
  marker?: { position: LngLat; label: string } | null;
  /** Called with the point the searcher taps on the map. */
  onPressMap?: (position: LngLat) => void;
  /** Called with the id of the report symbol the searcher taps (UC-F11). */
  onPressReport?: (id: string) => void;
  /** The report shown open, drawn with a ring. */
  selectedReportId?: string | null;
  /** The map's name for screen readers. */
  accessibilityLabel?: string;
}

/**
 * The mission map on Android and iOS: MapLibre Native with the shared Trace Console style (`@trace/map`), rebuilt
 * from the current theme so day and night switch the map with the rest of the app. Frames the mission area, or
 * Israel before the mission has polygons. Draws the reports in `area.data.reports` as tappable symbols (UC-F11).
 */
export function MissionMap({
  area,
  marker = null,
  onPressMap,
  onPressReport,
  selectedReportId = null,
  accessibilityLabel = 'מפת המסע',
}: MissionMapProps) {
  const { themeId, theme } = useTheme();
  const mapStyle = useMemo(
    () => (provider ? buildMapStyle({ themeId, provider, terrain, data: area.data }) : null),
    [themeId, area.data],
  );

  if (!mapLibre || !mapStyle) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
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
  const symbol = (name: MapIconName, label: string, lngLat: LngLat) => {
    const icon = icons[iconId(themeId, name)];
    return icon ? (
      <Marker key={name} id={name} lngLat={lngLat}>
        <View accessibilityRole="image" accessibilityLabel={label} style={styles.symbol}>
          <SvgXml xml={icon.svg} width={icon.size} height={icon.size} />
          <Text
            style={[typography.mapLabel, styles.tag, { color: theme.color.ink, backgroundColor: theme.color.surface }]}
          >
            {label}
          </Text>
        </View>
      </Marker>
    ) : null;
  };
  const reportSymbol = (report: MapReport) => {
    const icon = icons[iconId(themeId, report.located ? 'located' : report.hazard ? 'hazard' : 'report')];
    if (!icon) return null;
    const label = reportLabel(report);
    return (
      <Marker key={`report-${report.id}`} id={`report-${report.id}`} lngLat={report.position}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: report.id === selectedReportId }}
          hitSlop={pendingTokens.touchTarget / 2}
          onPress={() => onPressReport?.(report.id)}
          style={[
            styles.report,
            report.id === selectedReportId && {
              borderColor: theme.color.accent,
              borderWidth: pendingTokens.selectionRing,
            },
          ]}
        >
          <SvgXml xml={icon.svg} width={icon.size} height={icon.size} />
          {report.located && report.time ? (
            <Text
              style={[
                typography.mapLabel,
                styles.tag,
                { color: theme.color.ink, backgroundColor: theme.color.surface },
              ]}
            >
              {report.time}
            </Text>
          ) : null}
        </Pressable>
      </Marker>
    );
  };
  return (
    <Map
      style={styles.fill}
      mapStyle={mapStyle}
      accessibilityLabel={accessibilityLabel}
      logo={false}
      compass={false}
      onPress={onPressMap ? (event) => onPressMap(event.nativeEvent.lngLat as LngLat) : undefined}
    >
      <Camera bounds={area.bounds ?? ISRAEL_BOUNDS} padding={framePadding} duration={0} />
      {area.data.rally ? symbol('rally', 'כינוס', area.data.rally) : null}
      {area.data.lkp ? symbol('lkp', `LKP ${area.data.lkp.time ?? ''}`.trim(), area.data.lkp.position) : null}
      {area.data.reports.map(reportSymbol)}
      {marker ? symbol('sighting', marker.label, marker.position) : null}
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
  symbol: { alignItems: 'center', gap: spacing.space1 },
  report: { alignItems: 'center', gap: spacing.space1, borderRadius: radius.radiusSm },
  tag: { paddingHorizontal: spacing.space2, borderRadius: radius.radiusSm, overflow: 'hidden' },
  notice: { alignItems: 'center', justifyContent: 'center', padding: spacing.space7 },
});
