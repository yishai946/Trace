import { spacing, typography } from '@trace/design';
import type { Mission, MissionPolygon } from '@trace/schemas';
import { StyleSheet, Text, View } from 'react-native';
import { toMissionArea } from '../../mission/missionArea';
import { clockOf } from '../../sightings/draft';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { Screen } from '../Screen';
import { SegmentedChoice } from '../SegmentedChoice';
import { TextField } from '../TextField';
import { SightingFooter } from './SightingFooter';
import { SightingLocation } from './SightingLocation';
import { useSightingDraft } from './useSightingDraft';

const sources = [
  { value: 'self', label: 'אני ראיתי' },
  { value: 'witness', label: 'עד ראייה' },
] as const;

export interface SightingFormProps {
  missionId: string;
  mission: Mission | undefined;
  polygons: MissionPolygon[];
  /** The searcher's own polygon, drawn selected on the map. */
  assignedPolygonId: string | null;
  onCancel: () => void;
  /** The sighting is sent or kept on the phone: back to the map. */
  onDone: () => void;
}

/**
 * Fm09: the searcher reports a sighting of the missing person (UC-F10): who saw them, where, when and a short
 * description. It is kept on the phone and sent at once, or when the connection returns, and appears on the
 * commander's map. Whether it becomes the LKP is the commander's decision.
 */
export function SightingForm({ missionId, mission, polygons, assignedPolygonId, onCancel, onDone }: SightingFormProps) {
  const { color } = useTheme().theme;
  const draft = useSightingDraft({ missionId, polygons, onDone });
  const {
    source,
    setSource,
    mode,
    setMode,
    clock,
    setClock,
    description,
    setDescription,
    errors,
    setErrors,
    position,
    meta,
  } = draft;
  const area = toMissionArea(polygons, mission, assignedPolygonId);

  const footer = (
    <SightingFooter
      status={draft.status}
      sending={draft.status === 'sending'}
      onSubmit={() => void draft.submit()}
      onDone={onDone}
    />
  );

  return (
    <Screen
      title="תצפית על הנעדר"
      leading={<Button label="ביטול" icon="close" variant="ghost" onPress={onCancel} />}
      footer={footer}
    >
      <View style={styles.group}>
        <Text importantForAccessibility="no" aria-hidden style={[typography.meta, { color: color.inkSecondary }]}>
          מקור
        </Text>
        <SegmentedChoice label="מקור התצפית" options={sources} value={source} onChange={setSource} />
      </View>
      <SightingLocation
        mode={mode}
        onModeChange={setMode}
        position={position}
        meta={meta}
        area={area}
        onPick={draft.pick}
        error={errors.position}
      />
      <View style={styles.timeRow}>
        <View style={styles.fill}>
          <TextField
            label="זמן התצפית"
            ltr
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            value={clock}
            error={errors.clock}
            onChangeText={(text) => {
              setClock(text);
              setErrors((e) => ({ ...e, clock: undefined }));
            }}
          />
        </View>
        <Button
          label="עכשיו"
          size="lg"
          onPress={() => {
            setClock(clockOf(new Date()));
            setErrors((e) => ({ ...e, clock: undefined }));
          }}
        />
      </View>
      <TextField label="תיאור קצר" multiline maxLength={2000} value={description} onChangeText={setDescription} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.space2 },
  fill: { flex: 1 },
  // The button sits level with the input, not with its label above.
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.space4 },
  caption: { textAlign: 'center' },
});
