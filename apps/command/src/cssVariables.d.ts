import 'react';

declare module 'react' {
  /** CSS custom properties (`--name`) in a `style` prop, so passing one needs no type assertion. */
  interface CSSProperties {
    [variable: `--${string}`]: string | number;
  }
}
