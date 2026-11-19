import type { PushData, Sos } from '@trace/schemas';
import type { PushMessage } from '../notifications/pushSender';

/**
 * The push for an SOS (UC-F13): the activation alert to the sender's polygon, or the closing update. Tapping it opens
 * the SOS screen.
 */
export function sosPushMessage(sos: Sos, kind: 'activated' | 'closed'): PushMessage {
  const data: PushData = { missionId: sos.missionId, screen: 'sos' };
  if (kind === 'closed') return { title: `SOS נסגר · ${sos.sender.name}`, body: 'ה־SOS נסגר.', data };
  const fallback = sos.polygon ? `נדרש סיוע מיידי בפוליגון ${sos.polygon.name}` : 'נדרש סיוע מיידי';
  return { title: `SOS · ${sos.sender.name}`, body: sos.message ?? fallback, data };
}
