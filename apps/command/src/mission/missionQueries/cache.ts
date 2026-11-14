interface WithId {
  id: string;
}

/** A change to a cached list. A list that is not loaded yet stays unloaded, so its first fetch is not skipped. */
export type ListUpdate<T> = (list: T[] | undefined) => T[] | undefined;

const append = <T>(list: T[], item: T) => [...list, item];
/** For lists kept newest first. */
export const prepend = <T>(list: T[], item: T) => [item, ...list];

/** Changes the item with this id; a list without it stays as it is. */
export const patchById =
  <T extends WithId>(id: string, change: (item: T) => T): ListUpdate<T> =>
  (list) =>
    list?.map((item) => (item.id === id ? change(item) : item));

/** Replaces the item with the same id; a list without it stays as it is. */
export const replaceById = <T extends WithId>(item: T): ListUpdate<T> => patchById(item.id, () => item);

/** Adds the item with `add` (at the end unless said otherwise), unless the list already holds it. */
export const addOnce =
  <T extends WithId>(item: T, add: (list: T[], item: T) => T[] = append): ListUpdate<T> =>
  (list) =>
    list && !list.some((other) => other.id === item.id) ? add(list, item) : list;

/** Replaces the item with the same id, or adds it with `add` (at the end unless said otherwise). */
export const upsertById =
  <T extends WithId>(item: T, add: (list: T[], item: T) => T[] = append): ListUpdate<T> =>
  (list) =>
    list && (list.some((other) => other.id === item.id) ? replaceById(item)(list) : add(list, item));

export const removeById =
  <T extends WithId>(id: string): ListUpdate<T> =>
  (list) =>
    list?.filter((item) => item.id !== id);
