import type { MissionView } from './MissionNav';

/** The phone views that replace the map with a screen of their own (Cm10, Cm11, Cm12). */
export const PHONE_SCREENS = ['reports', 'messages', 'sos'] as const;
export type PhoneScreen = 'map' | (typeof PHONE_SCREENS)[number];

/** The screen a view shows on the phone: its own, or the map. */
export const phoneScreenOf = (view: MissionView): PhoneScreen => PHONE_SCREENS.find((s) => s === view) ?? 'map';
