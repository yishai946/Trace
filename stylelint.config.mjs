// Design values in app stylesheets come only from @trace/design CSS variables (var(--token)). See AGENTS.md.
import { fontWeights } from './packages/design/scripts/lint-values.mjs';

export default {
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  rules: {
    // Font weights have no tokens; only the weights used by the design system's text styles are allowed.
    'declaration-property-value-allowed-list': {
      'font-weight': [...fontWeights.map(String), '/^var\\(/', 'inherit'],
    },
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color-mix'],
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'font',
        'font-size',
        'font-family',
        'line-height',
        'letter-spacing',
        '/radius$/',
        'box-shadow',
        '/^(margin|padding)/',
        'gap',
        'row-gap',
        'column-gap',
      ],
      {
        ignoreValues: [
          'transparent',
          'inherit',
          'currentColor',
          'currentcolor',
          'none',
          '0',
          'auto',
          'initial',
          'unset',
        ],
        disableFix: true,
        message: 'Use a var(--token) from @trace/design for "${property}" instead of "${value}".',
      },
    ],
  },
};
