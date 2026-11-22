import type { Message, Participant, SendMessageBody } from '@trace/schemas';
import { useEffect, useRef, useState } from 'react';
import {
  emptyForm,
  recipientsOf,
  targetRule,
  toSendBody,
  validate,
  type MessageForm,
  type MessageFormErrors,
} from '../messageForm';

interface ComposeInput {
  participants: Participant[] | undefined;
  sendError: string | null;
  /** Undefined while sending is blocked. `onSent` runs after the server saved the message. */
  onSend?: (body: SendMessageBody, onSent: (message: Message) => void) => void;
  sending: boolean;
  participantsFailed: boolean;
  onSent?: (message: Message) => void;
}

/** The new-message form's state: what was typed, what is wrong with it, and sending it once. */
export function useComposeMessage({
  participants,
  sendError,
  onSend,
  sending,
  participantsFailed,
  onSent,
}: ComposeInput) {
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
  const count = recipientsOf(form, participants ?? []).length;
  // The case the API refuses with 409 NO_RECIPIENTS: a complete target nobody is in.
  const noRecipients = participants !== undefined && targetRule(form) !== null && count === 0;

  const blocked = !onSend || sending || participantsFailed || noRecipients;

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
      onSent?.(message);
    });
  };

  return {
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
  };
}
