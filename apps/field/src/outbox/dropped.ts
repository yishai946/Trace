/** How many dropped ids are remembered; a refused item is looked up right after its send, so a few are enough. */
const DROPPED_MEMORY = 200;
/** Ids of items the server refused for good and the outbox deleted, newest last. Kept in memory only. */
const dropped = new Set<string>();

export function rememberDropped(ids: string[]): void {
  for (const id of ids) {
    dropped.delete(id);
    dropped.add(id);
  }
  for (const id of dropped) {
    if (dropped.size <= DROPPED_MEMORY) break;
    dropped.delete(id);
  }
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
