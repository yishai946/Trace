import { MESSAGE_TARGET_KINDS } from '@trace/domain';
import type { Message, MissionPolygon, Participant, SendMessageBody } from '@trace/schemas';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { choose } from '../../choose';
import styles from './MessagesPage.module.css';
import { UrgencyChoice } from './UrgencyChoice';
import { useComposeMessage } from './useComposeMessage';
import { TargetChoice } from './TargetChoice';
import { sendLabel, TARGET_KIND_LABEL } from './messageView';

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
  const { form, errors, setErrors, announcement, dismissedError, formRef, change, submit, count } = useComposeMessage({
    participants,
    sendError,
    onSend,
    sending,
    onSent,
  });

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
            change({ kind: choose(MESSAGE_TARGET_KINDS, value, 'mission') });
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

        <TargetChoice
          form={form}
          participants={participants}
          polygons={polygons}
          onChange={(patch) => {
            change(patch);
            setErrors((current) => ({ ...current, target: undefined }));
          }}
        />

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

        <UrgencyChoice value={form.urgency} onChange={(urgency) => change({ urgency })} />

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
