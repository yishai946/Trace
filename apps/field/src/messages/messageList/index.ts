import type { OwnMessage } from '@trace/schemas';

/** Puts a message in the list (replacing the one with its id), newest first, as the server lists them. */
export function upsertMessage(list: OwnMessage[], message: OwnMessage): OwnMessage[] {
  return [...list.filter((item) => item.id !== message.id), message].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/** Unread, or critical and not yet acknowledged: the commander is still waiting for the searcher (decision 27). */
export function needsAttention(message: OwnMessage): boolean {
  return message.status === 'sent' || (message.requiresAcknowledgement && message.status !== 'acknowledged');
}

export function countNeedingAttention(list: OwnMessage[]): number {
  return list.filter(needsAttention).length;
}
