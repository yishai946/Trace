/** How many dropped ids are remembered; a refused item is looked up right after its send, so a few are enough. */
const DROPPED_MEMORY = 200;
/** Ids of items the server refused for good and the outbox deleted, newest last. Kept in memory only. */
const dropped = new Set<string>();
/** The dropped items nobody has told the searcher about yet, by id, with their kind. Not capped: none may go unsaid. */
const unseen = new Map<string, string>();

export function rememberDropped(kind: string, ids: string[]): void {
  for (const id of ids) {
    dropped.delete(id);
    dropped.add(id);
    unseen.set(id, kind);
  }
  for (const id of dropped) {
    if (dropped.size <= DROPPED_MEMORY) break;
    dropped.delete(id);
  }
}

/** The ids of the items of this kind the server refused for good that the searcher has not been told about. */
export function unseenDropped(kind: string): string[] {
  return [...unseen].filter(([, itemKind]) => itemKind === kind).map(([id]) => id);
}

/** The searcher has been told about these items (or all of this kind, with no ids). */
export function markDroppedSeen(ids: string[]): void {
  for (const id of ids) unseen.delete(id);
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
  unseen.clear();
}
