import type { SavedOfflineParts } from '@trace/domain';
import type { OfflineStep } from '../store';

/** What a download saves, in order: the mission (details, LKP, rally point), the photo, the polygons, the base map of the area. */
export const OFFLINE_STEPS: readonly OfflineStep[] = ['mission', 'photo', 'polygons', 'map'];

export interface OfflineProgress {
  done: number;
  total: number;
  percent: number;
  complete: boolean;
}

export function offlineProgress(saved: readonly OfflineStep[]): OfflineProgress {
  const done = OFFLINE_STEPS.filter((step) => saved.includes(step)).length;
  const total = OFFLINE_STEPS.length;
  return { done, total, percent: Math.round((done / total) * 100), complete: done === total };
}

/** The essential parts of the domain rule (decision 85) that the saved steps make up. */
export function savedParts(saved: readonly OfflineStep[]): SavedOfflineParts {
  const has = (step: OfflineStep) => saved.includes(step);
  return { missionInfo: has('mission') && has('photo'), map: has('mission') && has('polygons') && has('map') };
}
