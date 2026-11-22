/** How many dropped ids are remembered; a refused item is looked up right after its send, so a few are enough. */
const DROPPED_MEMORY = 200;
/** Ids of items the server refused for good and the outbox deleted, newest last. Kept in memory only. */
const dropped = new Map<string, DroppedReason>();

/** `batch`: the server will never take this item. `mission`: it takes nothing more of the mission (it ended, or access is gone). */
export type DroppedReason = 'batch' | 'mission';

export function rememberDropped(ids: string[], reason: DroppedReason): void {
  for (const id of ids) {
    dropped.delete(id);
    dropped.set(id, reason);
  }
  for (const id of dropped.keys()) {
    if (dropped.size <= DROPPED_MEMORY) break;
    dropped.delete(id);
  }
}

/** Why the item with this id was dropped, or null when it was not. */
export function droppedReason(id: string): DroppedReason | null {
  return dropped.get(id) ?? null;
}

/**
 * Whether the item with this id was deleted because the server refused it for good (`drop-batch`, `drop-mission`), as
 * opposed to confirmed. Lets a caller tell a rejected sighting from a sent one once the item is no longer pending.
 */
export function wasDropped(id: string): boolean {
  return dropped.has(id);
}

/** Forgets which items were dropped, e.g. at sign-out. */
export function forgetDropped(): void {
  dropped.clear();
}
