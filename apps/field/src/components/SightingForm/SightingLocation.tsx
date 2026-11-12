import { radius, spacing, typography } from '@trace/design';
import type { LngLat } from '@trace/geo';
import { StyleSheet, Text, View } from 'react-native';
import type { MissionArea } from '../../mission/missionArea';
import type { LocationMode } from '../../sightings/draft';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { FieldError } from '../FieldError';
import { MissionMap } from '../MissionMap';
import { SegmentedChoice } from '../SegmentedChoice';

const modes = [
  { value: 'mine', label: 'המיקום שלי' },
  { value: 'map', label: 'בחירה במפה' },
] as const;

export interface SightingLocationProps {
  mode: LocationMode;
  onModeChange: (mode: LocationMode) => void;
  /** The place the sighting will be reported at, or null while there is none. */
  position: LngLat | null;
  /** The meta line under the map: the coordinates (written left to right) or what to do next. */
  meta: string;
  area: MissionArea;
  onPick: (position: LngLat) => void;
  error?: string;
}

/** Fm09 "מיקום התצפית": the choice between my position and a point on the map, the minimap and its meta line. */
export function SightingLocation({ mode, onModeChange, position, meta, area, onPick, error }: SightingLocationProps) {
  const { color } = useTheme().theme;
  return (
    <View style={styles.group}>
      <Text importantForAccessibility="no" aria-hidden style={[typography.meta, { color: color.inkSecondary }]}>
        מיקום התצפית
      </Text>
      <SegmentedChoice label="מיקום התצפית" options={modes} value={mode} onChange={onModeChange} />
      <View style={[styles.map, { backgroundColor: color.mapGround, borderColor: color.borderStrong }]}>
        <MissionMap
          area={area}
          marker={position ? { position, label: 'תצפית' } : null}
          onPressMap={onPick}
          accessibilityLabel="מפת מיקום התצפית"
        />
      </View>
      <Text style={[typography.meta, { color: color.inkMuted }]}>{meta}</Text>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.space2 },
  map: {
    height: pendingTokens.sightingMapH,
    marginTop: spacing.space4,
    borderRadius: radius.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
