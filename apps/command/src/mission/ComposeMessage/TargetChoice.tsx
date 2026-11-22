import type { MissionPolygon, Participant } from '@trace/schemas';
import { CheckboxGroup, Radio, RadioGroup } from 'react-aria-components';
import { CallsignChip } from '../../components/CallsignChip';
import { Checkbox } from '../../components/Checkbox';
import styles from './ComposeMessage.module.css';
import { activeParticipants, countInPolygon, type MessageForm } from '../messageForm';

const checkIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 5 5 9-10" />
  </svg>
);

const searchersLabel = (count: number) => (count === 1 ? 'מחפש אחד' : `${count} מחפשים`);

interface TargetChoiceProps {
  form: MessageForm;
  /** Undefined while they load. */
  participants: Participant[] | undefined;
  polygons: MissionPolygon[];
  onChange: (patch: Partial<MessageForm>) => void;
}

/** Which polygons, or which searcher, the message goes to. The whole mission has nothing to choose. */
export function TargetChoice({ form, participants, polygons, onChange }: TargetChoiceProps) {
  const pool = participants ?? [];
  const active = activeParticipants(pool);
  return (
    <>
      {form.kind === 'polygons' &&
        (polygons.length === 0 ? (
          <p className={styles.hint}>אין פוליגונים במפה.</p>
        ) : (
          <CheckboxGroup
            className={styles.list}
            data-target-field
            aria-label="פוליגונים"
            value={form.polygonIds}
            onChange={(polygonIds) => {
              onChange({ polygonIds });
            }}
          >
            {polygons.map((polygon) => (
              <Checkbox key={polygon.id} value={polygon.id} className={styles.polygonCheck}>
                <span className={styles.grow}>{polygon.name}</span>
                <span className={styles.meta}>{searchersLabel(countInPolygon(polygon.id, pool))}</span>
              </Checkbox>
            ))}
          </CheckboxGroup>
        ))}

      {form.kind === 'searcher' &&
        (active.length === 0 ? (
          <p className={styles.hint}>אין מחפשים פעילים במסע.</p>
        ) : (
          <RadioGroup
            className={styles.list}
            data-target-field
            aria-label="מחפש"
            value={form.participantId}
            onChange={(participantId) => {
              onChange({ participantId });
            }}
          >
            {active.map((participant) => (
              <Radio key={participant.id} value={participant.id} className={`${styles.check} ${styles.radio}`}>
                <span className={styles.box}>{checkIcon}</span>
                <CallsignChip
                  callsign={participant.callsign}
                  state={participant.status === 'available' ? 'waiting' : 'normal'}
                />
                <span className={styles.grow}>{participant.name}</span>
                <span className={styles.meta}>
                  {polygons.find((polygon) => polygon.id === participant.polygonId)?.name ?? 'ממתין לשיבוץ'}
                </span>
              </Radio>
            ))}
          </RadioGroup>
        ))}
    </>
  );
}
