import type { IconName } from '../../components/Icon';

/** Every screen of the Field app (Trace Wireframes `Fm*`). Files live in `src/app/`. */
export const routes = {
  /** Fm01: phone and OTP sign-in (UC-F01). */
  login: '/login',
  /** Fm02: join a mission by QR or code (UC-F02). */
  join: '/join',
  /** Fm04 to Fm06: the mission and its map. */
  map: '/map',
  /** Fm10: reports in my polygon. */
  reports: '/reports',
  /** Fm08: a new report. */
  report: '/report',
  /** Fm11: messages from the commander. */
  messages: '/messages',
  /** Fm12: SOS. */
  sos: '/sos',
  /** Fm16: more. */
  more: '/more',
  /** Fm15: my missions and their history. */
  myMissions: '/my-missions',
} as const;

export type RouteName = keyof typeof routes;

export interface TabSpec {
  name: RouteName;
  href: (typeof routes)[RouteName];
  label: string;
  icon: IconName;
  /** SOS keeps its danger color in the tab bar. */
  tone?: 'danger';
}

/** The bottom tab bar of the mission screens, in the wireframes' order (right to left). */
export const tabs: TabSpec[] = [
  { name: 'map', href: routes.map, label: 'מסע', icon: 'mission' },
  { name: 'reports', href: routes.reports, label: 'דיווחים', icon: 'reports' },
  { name: 'messages', href: routes.messages, label: 'הודעות', icon: 'messages' },
  { name: 'sos', href: routes.sos, label: 'SOS', icon: 'sos', tone: 'danger' },
  { name: 'more', href: routes.more, label: 'עוד', icon: 'more' },
];
