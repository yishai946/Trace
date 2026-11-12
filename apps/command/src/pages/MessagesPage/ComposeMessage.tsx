import { MESSAGE_TARGET_KINDS, MESSAGE_URGENCIES, type MessageTargetKind, type MessageUrgency } from '@trace/domain';
import type { Message, MissionPolygon, Participant, SendMessageBody } from '@trace/schemas';
import { useEffect, useRef, useState } from 'react';
import { Checkbox, CheckboxGroup, Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { TextField } from '../../components/TextField';
import styles from './MessagesPage.module.css';
import {
  activeParticipants,
  countInPolygon,
  emptyForm,
  recipientsOf,
  toSendBody,
  validate,
  type MessageForm,
  type MessageFormErrors,
} from './messageForm';
import { sendLabel, TARGET_KIND_LABEL, URGENCY_LABEL } from './messageView';

export interface ComposeMessageProps {
  participants: Participant[] | undefined;
  participantsFailed: boolean;
  polygons: MissionPolygon[];
  ended: boolean;
  /** Undefined while sending is blocked (no connection, or the mission ended). `onSent` runs after the server saved it. */
  onSend?: (body: SendMessageBody, onSent: (message: Message) => void) => void;
  sending: boolean;
  sendError: string | null;
  /** The message the server saved, to select it in the list. */
  onSent: (message: Message) => void;
}

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

const sendIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 11 18-8-8 18-2-8z" />
  </svg>
);

const searchersLabel = (count: number) => (count === 1 ? 'מחפש אחד' : `${count} מחפשים`);

/** The new-message form (wireframe Cd11 "הודעה חדשה"): target, urgency and free text, sent one way to searchers. */
export function ComposeMessage({
  participants,
  participantsFailed,
  polygons,
  ended,
  onSend,
  sending,
  sendError,
  onSent,
}: ComposeMessageProps) {
  const [form, setForm] = useState<MessageForm>(emptyForm);
  const [errors, setErrors] = useState<MessageFormErrors>({});
  const [announcement, setAnnouncement] = useState('');
  // The send error the commander already reacted to by editing; a new attempt shows it again.
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Set at once on submit: `sending` only re-renders after a second click could already have passed.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!sending) inFlight.current = false;
  }, [sending]);

  const change = (patch: Partial<MessageForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setAnnouncement('');
    setDismissedError(sendError);
  };
  const pool = participants ?? [];
  const active = activeParticipants(pool);
  const count = recipientsOf(form, pool).length;

  const submit = () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = found.target ? '[data-target-field] input' : 'textarea';
      formRef.current?.querySelector<HTMLElement>(first)?.focus();
      return;
    }
    if (!onSend || inFlight.current) return;
    inFlight.current = true;
    setDismissedError(null);
    onSend(toSendBody(form), (message) => {
      inFlight.current = false;
      formRef.current?.querySelector<HTMLElement>('textarea')?.focus();
      setForm((current) => ({ ...current, body: '' }));
      setAnnouncement(`ההודעה נשלחה ל-${message.recipients.length} מחפשים.`);
      onSent(message);
    });
  };

  return (
    <section className={`${styles.panel} ${styles.compose}`} aria-label="הודעה חדשה">
      <div className={styles.section}>
        <h2 className={styles.title}>הודעה חדשה</h2>
        <span className={styles.meta}>חד-כיוונית: מנהל ← מחפשים</span>
      </div>
      <form
        ref={formRef}
        aria-label="הודעה חדשה"
        noValidate
        className={styles.formBody}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <RadioGroup
          className={styles.field}
          orientation="horizontal"
          value={form.kind}
          onChange={(value) => {
            change({ kind: value as MessageTargetKind });
            setErrors((current) => ({ ...current, target: undefined }));
          }}
        >
          <Label className={styles.label}>נמענים</Label>
          <div className={styles.seg}>
            {MESSAGE_TARGET_KINDS.map((kind) => (
              <Radio key={kind} value={kind} className={styles.segOption}>
                {TARGET_KIND_LABEL[kind]}
              </Radio>
            ))}
          </div>
        </RadioGroup>

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
                change({ polygonIds });
                setErrors((current) => ({ ...current, target: undefined }));
              }}
            >
              {polygons.map((polygon) => (
                <Checkbox key={polygon.id} value={polygon.id} className={styles.check}>
                  <span className={styles.box}>{checkIcon}</span>
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
                change({ participantId });
                setErrors((current) => ({ ...current, target: undefined }));
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

        {form.kind !== 'mission' && participants === undefined && !participantsFailed && (
          <p className={styles.hint}>טוען מחפשים…</p>
        )}
        {participantsFailed && (
          <p role="alert" className={styles.error}>
            לא ניתן לטעון את המחפשים מהשרת.
          </p>
        )}
        {errors.target && (
          <p role="alert" className={styles.error}>
            {errors.target}
          </p>
        )}

        <RadioGroup
          className={styles.field}
          orientation="horizontal"
          value={form.urgency}
          onChange={(value) => change({ urgency: value as MessageUrgency })}
        >
          <Label className={styles.label}>דחיפות</Label>
          <div className={styles.seg}>
            {MESSAGE_URGENCIES.map((urgency) => (
              <Radio key={urgency} value={urgency} className={styles.segOption}>
                {URGENCY_LABEL[urgency]}
              </Radio>
            ))}
          </div>
          <p className={styles.hint}>קריטית: כל נמען נדרש לאשר קריאה.</p>
        </RadioGroup>

        <TextField
          label="טקסט חופשי"
          rows={4}
          maxLength={2000}
          value={form.body}
          onChange={(body) => change({ body })}
          isInvalid={!!errors.body}
          errorMessage={errors.body}
        />

        {sendError && sendError !== dismissedError && (
          <p role="alert" className={styles.error}>
            {sendError}
          </p>
        )}
        {ended ? (
          <p className={styles.hint}>המסע הסתיים. אי אפשר לשלוח הודעות.</p>
        ) : (
          !onSend && <p className={styles.hint}>אין חיבור לשרת. שליחה חסומה.</p>
        )}

        <Button
          variant="primary"
          type="submit"
          className={styles.block}
          isDisabled={!onSend || sending || participantsFailed}
        >
          {sendIcon}
          {sendLabel(count)}
        </Button>
        <p role="status" className={styles.status}>
          {announcement}
        </p>
      </form>
    </section>
  );
}
