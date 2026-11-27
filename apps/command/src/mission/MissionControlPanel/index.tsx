import { canEndMissionLocated, STOP_REASON_LABELS } from '@trace/domain';
import { formatLatLng, type LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { EndMissionLocatedBody, Mission, StopMissionBody } from '@trace/schemas';
import { useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import type { Place } from '../../map/geocoding';
import type { PlaceMode } from '../../map/PlacePicker';
import { timeLabel } from '../timeLabel';
import { EndLocatedForm } from './EndLocatedForm';
import { PauseCard } from './PauseCard';
import { StopMissionForm } from './StopMissionForm';
import { usePanelFocus } from './usePanelFocus';
import styles from './MissionControlPanel.module.css';

interface MissionControlPanelProps {
  mission: Mission;
  provider: MapProvider;
  /** Where the missing person was found: set by a click on the map, a search or coordinates. */
  point: LngLat | null;
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  onPoint: (point: LngLat) => void;
  onPlaceFound: (place: Place) => void;
  /** The mission is being ended. */
  busy: boolean;
  /** Why the last attempt failed. */
  error: string | null;
  /** No connection: the mission cannot be ended now. */
  offline: boolean;
  /** Called with a valid form once the commander confirmed. */
  onEnd: (body: EndMissionLocatedBody) => void;
  /** Called with a reason once the commander confirmed stopping the search. */
  onStop: (body: StopMissionBody) => void;
  /** Called once the commander confirmed pausing the search (UC-C15). */
  onPause: () => void;
  onResume: () => void;
  onEdit: () => void;
  onClose: () => void;
}

const STATUS_LABELS = {
  active: 'פעיל',
  paused: 'מושהה',
  ended_located: 'הסתיים: הנעדר אותר',
  ended_stopped: 'הסתיים: הופסק',
} as const;

type Way = 'located' | 'stopped';

/** The mission control panel (wireframe Cd13): the mission's state and how it ends: "הנעדר אותר" or stopping the search. */
export function MissionControlPanel({
  mission,
  onClose,
  onStop,
  onPause,
  onResume,
  ...form
}: MissionControlPanelProps) {
  const { located, stopped } = mission;
  const [way, setWay] = useState<Way>('located');
  const { heading, onKeyDown } = usePanelFocus(onClose);
  return (
    // The handler only catches Escape bubbling up from the panel's own controls.
    <section className={styles.panel} aria-label="בקרת מסע" onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <h2 className={styles.title} ref={heading} tabIndex={-1}>
          בקרת מסע
        </h2>
        <span className={styles.badge}>מצב: {STATUS_LABELS[mission.status]}</span>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.body}>
        <PauseCard
          status={mission.status}
          busy={form.busy}
          offline={form.offline}
          onPause={onPause}
          onResume={onResume}
        />
        {located ? (
          <dl className={styles.facts} aria-label="פרטי האיתור">
            <dt>זמן האיתור</dt>
            <dd>{timeLabel(located.locatedAt)}</dd>
            <dt>מיקום</dt>
            <dd dir="ltr">{formatLatLng(located.position.coordinates)}</dd>
            {located.note && (
              <>
                <dt>הערה</dt>
                <dd>{located.note}</dd>
              </>
            )}
          </dl>
        ) : stopped ? (
          <dl className={styles.facts} aria-label="פרטי ההפסקה">
            <dt>סיבה</dt>
            <dd>{STOP_REASON_LABELS[stopped.reason]}</dd>
            <dt>זמן הסיום</dt>
            <dd>{timeLabel(stopped.endedAt)}</dd>
            {stopped.note && (
              <>
                <dt>הערה</dt>
                <dd>{stopped.note}</dd>
              </>
            )}
          </dl>
        ) : canEndMissionLocated(mission.status) ? (
          <>
            <RadioGroup
              aria-label="אופן סיום המסע"
              orientation="horizontal"
              value={way}
              onChange={(next) => setWay(next === 'stopped' ? 'stopped' : 'located')}
            >
              <Label className={styles.label}>איך המסע מסתיים</Label>
              <div className={styles.seg}>
                <Radio value="located" className={styles.segOption}>
                  הנעדר אותר
                </Radio>
                <Radio value="stopped" className={styles.segOption}>
                  הפסק חיפוש
                </Radio>
              </div>
            </RadioGroup>
            {way === 'located' ? (
              <EndLocatedForm {...form} />
            ) : (
              <StopMissionForm
                busy={form.busy}
                error={form.error}
                offline={form.offline}
                onStop={onStop}
                onEdit={form.onEdit}
              />
            )}
          </>
        ) : (
          <p className={styles.hint}>המסע הסתיים ונשמר לקריאה בלבד.</p>
        )}
      </div>
    </section>
  );
}
