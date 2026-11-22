/**
 * The essential mission data a searcher's device must hold before Searching (UC-F03): the mission details
 * (UC-F03 step 1, "מידע חיוני") and the search-area map. Which parts are essential is not fixed by the spec.
 */
export const OFFLINE_PACKAGE_PARTS = ['missionInfo', 'map'] as const;
export type OfflinePackagePart = (typeof OFFLINE_PACKAGE_PARTS)[number];

/** What the device has saved completely so far. A part that is absent or `false` was not saved. */
export type SavedOfflineParts = Partial<Record<OfflinePackagePart, boolean>>;

export interface StartSearchReadiness {
  ready: boolean;
  missing: OfflinePackagePart[];
}

/** The essential parts still to download, in package order. */
export function missingOfflineParts(saved: SavedOfflineParts): OfflinePackagePart[] {
  return OFFLINE_PACKAGE_PARTS.filter((part) => saved[part] !== true);
}

/**
 * Start Search stays blocked until the whole essential package is saved (UC-F03 step 3, decision 85). A cut-off
 * download leaves the searcher in the mission but not ready, until it completes.
 */
export function canStartSearch(saved: SavedOfflineParts): StartSearchReadiness {
  const missing = missingOfflineParts(saved);
  return { ready: missing.length === 0, missing };
}
