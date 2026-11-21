import type { Key } from 'react-aria-components';

/** The option a react-aria selection key (or a stored string) stands for; `fallback` when it is none of them. */
export const choose = <T extends string, F extends T | null = T>(
  options: readonly T[],
  key: Key | null | undefined,
  fallback: F,
): T | F => options.find((option) => option === key) ?? fallback;

/** The same for a single-selection set of keys. */
export const chooseFirst = <T extends string>(options: readonly T[], keys: Iterable<Key>, fallback: T): T =>
  choose(options, [...keys][0], fallback);
