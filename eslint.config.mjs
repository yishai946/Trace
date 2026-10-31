import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { fontWeights } from './packages/design/scripts/lint-values.mjs';

// Raw design values that must come from @trace/design instead.
const RAW_COLOR = String.raw`/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/`;
const COLOR_KEYWORDS = '/^(transparent|inherit|currentColor|currentcolor)$/';
const STYLE_KEYS =
  '/^(fontSize|lineHeight|fontFamily|letterSpacing|(border\\w*)?[rR]adius|margin\\w*|padding\\w*|gap|rowGap|columnGap|boxShadow|shadow\\w*|elevation)$/';
// Font weights have no tokens; only the weights used by the design system's text styles are allowed.
const ALLOWED_WEIGHTS = fontWeights.flatMap((w) => [`:not([value.value=${w}])`, `:not([value.value='${w}'])`]).join('');
const FREE_VALUES = '/%$|^(auto|inherit|normal|none)$/';
const RAW_COLOR_MESSAGE =
  'Use a color token from @trace/design (themes.<theme>.color.* or var(--token)) instead of a raw color.';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Applies to every React app (Command web, Field mobile) once they exist.
    files: ['apps/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Design values come only from @trace/design (the Trace Console design system). See AGENTS.md.
    files: ['apps/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${RAW_COLOR}]`,
          message: RAW_COLOR_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=${RAW_COLOR}]`,
          message: RAW_COLOR_MESSAGE,
        },
        {
          selector: `Property[key.name=/[cC]olor$/][value.type='Literal']:not([value.value=${COLOR_KEYWORDS}])`,
          message: RAW_COLOR_MESSAGE,
        },
        {
          selector: `JSXAttribute[name.name=/[cC]olor$|^(fill|stroke)$/] > Literal:not([value=${COLOR_KEYWORDS}])`,
          message: RAW_COLOR_MESSAGE,
        },
        {
          selector: `Property[key.name='fontWeight'][value.type='Literal']${ALLOWED_WEIGHTS}`,
          message: `Font weight must be one of the design system's weights: ${fontWeights.join(', ')}.`,
        },
        {
          selector: `Property[key.name=${STYLE_KEYS}][value.type='Literal']:not([value.value=0]):not([value.value=${FREE_VALUES}])`,
          message:
            'Use a token from @trace/design (spacing, radius, typography, themes.*.shadow) instead of a raw style value.',
        },
      ],
    },
  },
);
