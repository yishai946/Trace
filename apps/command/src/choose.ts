import type { Key } from 'react-aria-components';

/** The option a react-aria selection key stands for; the fallback when it is none of them. Avoids casting a `Key`. */
export const choose = <T extends string>(options: readonly T[], key: Key | undefined, fallback: T): T =>
  options.find((option) => option === key) ?? fallback;

/** The same for a single-selection set of keys. */
export const chooseFirst = <T extends string>(options: readonly T[], keys: Iterable<Key>, fallback: T): T =>
  choose(options, [...keys][0], fallback);
