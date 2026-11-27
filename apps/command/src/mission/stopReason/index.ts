import type { MissionStopReason } from '@trace/schemas';

/** The Hebrew name of each reason the search can be stopped for (UC-C17, decision 96). */
export const STOP_REASON_LABELS: Record<MissionStopReason, string> = {
  search_exhausted: 'מוצו מאמצי החיפוש',
  weather: 'מזג אוויר ותנאי שטח',
  safety: 'סיבות בטיחות',
  resources: 'חוסר במשאבים ובמחפשים',
  handed_over: 'הועבר לגורם מקצועי',
  other: 'אחר',
};
