import { detailChangesText } from '@trace/domain';
import type { MissionEvent } from '@trace/schemas';
import { routes } from '../../navigation/routes';
import type { FieldAlert } from '..';

/** What a mission event does to the alerts: raise one, withdraw one, or nothing (null). */
export type AlertChange = { raise: FieldAlert } | { dismiss: string };

/**
 * The in-app alert a live mission event calls for. An SOS another searcher sent to this one (decision 98) and the
 * commander's significant change of the details (UC-C03 step 4) each raise one; closing the SOS withdraws its alert.
 * The searcher's own SOS has its own screen and raises none.
 */
export function alertFromEvent(event: MissionEvent, ownParticipantId: string | undefined): AlertChange | null {
  if (event.type === 'sos.saved') {
    const { sos } = event;
    const id = `sos-${sos.id}`;
    if (sos.sender.participantId === ownParticipantId) return null;
    if (sos.status !== 'active') return { dismiss: id };
    const where = sos.polygon ? ` בפוליגון ${sos.polygon.name}` : '';
    const text = `${sos.sender.name} (${sos.sender.callsign}) הפעיל SOS${where}.`;
    return { raise: { id, kind: 'sos', title: 'SOS ממחפש אחר', text, href: routes.sos } };
  }
  if (event.type === 'mission.updated' && event.changedFields) {
    return {
      raise: {
        id: `details-${event.mission.updatedAt}`,
        kind: 'details',
        title: 'פרטי הנעדר עודכנו',
        text: detailChangesText(event.changedFields),
        href: routes.missingPerson,
      },
    };
  }
  return null;
}
