import { PushData } from '@trace/schemas';
import { routes } from '../../navigation/routes';

const screens = {
  map: routes.map,
  messages: routes.messages,
  sos: routes.sos,
  'missing-person': routes.missingPerson,
} as const satisfies Record<PushData['screen'], string>;

export interface PushTarget {
  missionId: string;
  href: (typeof screens)[PushData['screen']];
}

/** The screen a push notification opens when tapped (its `data`, set by the API), or null for data we do not know. */
export function pushTarget(data: unknown): PushTarget | null {
  const parsed = PushData.safeParse(data);
  return parsed.success ? { missionId: parsed.data.missionId, href: screens[parsed.data.screen] } : null;
}
