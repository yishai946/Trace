import {
  isActiveInPolygon,
  isMessageRecipient,
  type MessageTargetKind,
  type MessageTargetRule,
  type MessageUrgency,
} from '@trace/domain';
import type { Participant, SendMessageBody } from '@trace/schemas';

export type TargetKind = MessageTargetKind;

export interface MessageForm {
  kind: TargetKind;
  polygonIds: string[];
  participantId: string | null;
  urgency: MessageUrgency;
  body: string;
}

export const emptyForm: MessageForm = {
  kind: 'mission',
  polygonIds: [],
  participantId: null,
  urgency: 'normal',
  body: '',
};

export type MessageFormErrors = Partial<Record<'target' | 'body', string>>;

/** The chosen target, or null while it is incomplete: no polygon checked, or no searcher chosen. */
export function targetRule(form: MessageForm): MessageTargetRule | null {
  if (form.kind === 'mission') return { kind: 'mission' };
  if (form.kind === 'polygons')
    return form.polygonIds.length > 0 ? { kind: 'polygons', polygonIds: form.polygonIds } : null;
  return form.participantId ? { kind: 'searcher', participantId: form.participantId } : null;
}

/** Who would get the message now. */
export function recipientsOf(form: MessageForm, participants: Participant[]): Participant[] {
  const rule = targetRule(form);
  return rule ? participants.filter((participant) => isMessageRecipient(participant, rule)) : [];
}

/** Searchers whose activity has not ended, by callsign. */
export function activeParticipants(participants: Participant[]): Participant[] {
  return participants.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);
}

/** How many searchers are assigned to the polygon. */
export function countInPolygon(polygonId: string, participants: Participant[]): number {
  return participants.filter((p) => isActiveInPolygon(p, polygonId)).length;
}

export function validate(form: MessageForm): MessageFormErrors {
  const errors: MessageFormErrors = {};
  if (form.kind === 'polygons' && form.polygonIds.length === 0) errors.target = 'בחרו לפחות פוליגון אחד.';
  if (form.kind === 'searcher' && !form.participantId) errors.target = 'בחרו מחפש.';
  if (form.body.trim() === '') errors.body = 'כתבו את ההודעה.';
  return errors;
}

/** The request for a valid form. */
export function toSendBody(form: MessageForm): SendMessageBody {
  const body = form.body.trim();
  if (form.kind === 'polygons')
    return { target: { kind: 'polygons', polygonIds: form.polygonIds }, urgency: form.urgency, body };
  if (form.kind === 'searcher' && form.participantId) {
    return { target: { kind: 'searcher', participantId: form.participantId }, urgency: form.urgency, body };
  }
  return { target: { kind: 'mission' }, urgency: form.urgency, body };
}
