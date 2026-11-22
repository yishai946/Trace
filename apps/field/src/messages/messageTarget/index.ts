import type { OwnMessage } from '@trace/schemas';

/** Who the message was for, as the card shows it (Fm11): the whole mission, the polygon names, or personal. */
export function targetLabel(target: OwnMessage['target']): string {
  if (target.kind === 'polygons') return target.polygons.map((polygon) => polygon.name).join(', ');
  return target.kind === 'mission' ? 'כלל המסע' : 'אישי';
}
