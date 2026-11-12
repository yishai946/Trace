import { spacing, typography } from '@trace/design';
import { isInsidePolygon, formatLatLng, type LngLat } from '@trace/geo';
import type { Mission, MissionPolygon, SightingSource } from '@trace/schemas';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { useCurrentFix } from '../../location/useCurrentFix';
import { toMissionArea } from '../../mission/missionArea';
import { uuidv7 } from '../../outbox/uuidv7';
import { clockOf, toSighting, type DraftErrors, type LocationMode } from '../../sightings/draft';
import { submitSighting } from '../../sightings/submit';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { FieldError } from '../FieldError';
import { Screen } from '../Screen';
import { SegmentedChoice } from '../SegmentedChoice';
import { TextField } from '../TextField';
import { SightingLocation } from './SightingLocation';

const sources = [
  { value: 'self', label: 'אני ראיתי' },
  { value: 'witness', label: 'עד ראייה' },
] as const;

type Status = 'idle' | 'sending' | 'pending' | 'rejected' | 'save-failed';

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
  const [source, setSource] = useState<SightingSource>('self');
  const [mode, setMode] = useState<LocationMode>('mine');
  const [picked, setPicked] = useState<LngLat | null>(null);
  const [clock, setClock] = useState(() => clockOf(new Date()));
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [status, setStatus] = useState<Status>('idle');

  const fix = useCurrentFix();
  const position = mode === 'mine' ? (fix.fix?.position ?? null) : picked;
  const polygon = position ? polygons.find((p) => isInsidePolygon(position, p.geometry)) : undefined;
  const area = toMissionArea(polygons, mission, assignedPolygonId);

  const meta = position
    ? `${ltr(formatLatLng(position))}${polygon ? `, פוליגון ${polygon.name}` : ''}`
    : mode === 'map'
      ? 'הקש על המפה במקום שבו נראה הנעדר.'
      : fix.state === 'locating'
        ? 'מאתר את המיקום שלך…'
        : 'המיקום שלך לא זמין. בחר את המקום במפה.';

  const pick = (point: LngLat) => {
    setPicked(point);
    setMode('map');
    setErrors((e) => ({ ...e, position: undefined }));
  };

  const submit = async () => {
    const result = toSighting({ source, position, clock, description }, { now: new Date(), id: uuidv7() });
    if ('errors' in result) return setErrors(result.errors);
    setErrors({});
    setStatus('sending');
    try {
      const delivery = await submitSighting({ missionId, sighting: result.sighting });
      if (delivery === 'sent') onDone();
      else setStatus(delivery);
    } catch {
      setStatus('save-failed');
    }
  };

  const sending = status === 'sending';
  const footer =
    status === 'pending' ? (
      <>
        <Text accessibilityLiveRegion="polite" style={[typography.body, { color: color.ink }]}>
          אין חיבור. התצפית נשמרה בטלפון ותישלח אוטומטית כשהחיבור יחזור.
        </Text>
        <Button label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
      </>
    ) : status === 'rejected' ? (
      <>
        <FieldError message="התצפית לא נשלחה: המסע הסתיים או שהפעילות שלך בו הסתיימה." />
        <Button label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
      </>
    ) : (
      <>
        {status === 'save-failed' ? <FieldError message="לא ניתן לשמור את התצפית בטלפון. נסה שוב." /> : null}
        <Button
          label={sending ? 'שולח…' : 'שלח תצפית'}
          variant="primary"
          size="lg"
          block
          icon="send"
          disabled={sending}
          onPress={() => void submit()}
        />
        <Text style={[typography.caption, styles.caption, { color: color.inkMuted }]}>
          התצפית תופיע מיד במפה של המנהל
        </Text>
      </>
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
        onPick={pick}
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
