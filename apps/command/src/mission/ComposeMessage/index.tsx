import type { Message, MissionPolygon, Participant, SendMessageBody } from '@trace/schemas';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import styles from './ComposeMessage.module.css';
import { TargetChoice } from './TargetChoice';
import { TargetKindChoice } from './TargetKindChoice';
import { TemplateChoice } from './TemplateChoice';
import { UrgencyChoice } from './UrgencyChoice';
import { useComposeMessage } from './useComposeMessage';
import { sendLabel } from '../messageView';

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
  onSent?: (message: Message) => void;
  /** The phone layout (Cm11): no panel frame or header, a shorter text field and a large send button. */
  phone?: boolean;
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

/** Why sending is closed, if it is: the mission ended, there is no connection, or nobody would receive it. */
function blockedHint(ended: boolean, onSend: ComposeMessageProps['onSend'], noRecipients: boolean): string | null {
  if (ended) return 'המסע הסתיים. אי אפשר לשלוח הודעות.';
  if (!onSend) return 'אין חיבור לשרת. שליחה חסומה.';
  return noRecipients ? 'אין מחפשים פעילים ביעד שנבחר.' : null;
}

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
  phone,
}: ComposeMessageProps) {
  const {
    form,
    errors,
    setErrors,
    announcement,
    dismissedError,
    formRef,
    change,
    submit,
    count,
    noRecipients,
    blocked,
  } = useComposeMessage({
    participants,
    sendError,
    onSend,
    sending,
    participantsFailed,
    onSent,
  });

  const hint = blockedHint(ended, onSend, noRecipients);

  return (
    <section className={phone ? styles.phone : `${styles.panel} ${styles.compose}`} aria-label="הודעה חדשה">
      {!phone && (
        <div className={styles.section}>
          <h2 className={styles.title}>הודעה חדשה</h2>
          <span className={styles.meta}>חד-כיוונית: מנהל ← מחפשים</span>
        </div>
      )}
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
        <TargetKindChoice
          value={form.kind}
          onChange={(kind) => {
            change({ kind });
            setErrors((current) => ({ ...current, target: undefined }));
          }}
        />

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

        <TemplateChoice body={form.body} onChange={(body) => change({ body })} />

        <TextField
          label="טקסט חופשי"
          rows={phone ? 3 : 4}
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
        {hint && <p className={styles.hint}>{hint}</p>}

        <Button
          variant="primary"
          size={phone ? 'lg' : undefined}
          type="submit"
          className={styles.block}
          isDisabled={blocked}
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
