import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import requireDisableReason from './eslint-rules/require-disable-reason.mjs';
import { fontWeights } from './packages/design/scripts/lint-values.mjs';

// Raw design values that must come from @trace/design instead.
const RAW_COLOR = String.raw`/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/`;
const COLOR_KEYWORDS = '/^(transparent|inherit|currentColor|currentcolor|none)$/';
const STYLE_KEYS =
  '/^(fontSize|lineHeight|fontFamily|letterSpacing|(border\\w*)?[rR]adius|margin\\w*|padding\\w*|gap|rowGap|columnGap|boxShadow|shadow\\w*|elevation|(min|max)?(Width|Height)|width|height)$/';
// Font weights have no tokens; only the weights used by the design system's text styles are allowed.
const ALLOWED_WEIGHTS = fontWeights.flatMap((w) => [`:not([value.value=${w}])`, `:not([value.value='${w}'])`]).join('');
const FREE_VALUES = '/%$|^(auto|inherit|normal|none)$/';
const RAW_COLOR_MESSAGE =
  'Use a color token from @trace/design (themes.<theme>.color.* or var(--token)) instead of a raw color.';

const DESIGN_SYNTAX = [
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
      'Use a token from @trace/design (spacing, radius, size, typography, themes.*.shadow) instead of a raw style value.',
  },
];

// A top-level React component: a PascalCase function, or a PascalCase const holding an arrow function.
const COMPONENT_NAME = '[id.name=/^[A-Z][a-z]/]';
const COMPONENT = `:matches(${[
  `FunctionDeclaration${COMPONENT_NAME}`,
  `:matches(ExportNamedDeclaration, ExportDefaultDeclaration):has(> FunctionDeclaration${COMPONENT_NAME})`,
  `:matches(VariableDeclaration, ExportNamedDeclaration):has(VariableDeclarator${COMPONENT_NAME}[init.type='ArrowFunctionExpression'])`,
].join(', ')})`;
const ONE_COMPONENT = {
  selector: `Program > ${COMPONENT} ~ ${COMPONENT}`,
  message: 'One React component per file: move this component to its own file in the module folder. See AGENTS.md.',
};

const NOT_PRODUCT_CODE = ['**/*.test.{ts,tsx}', '**/fixtures.ts', '**/testing/**', '**/test/**', '**/scripts/**'];
const API_CALL_MESSAGE =
  'Components, pages and routes do not call the API: use a query, mutation or sender module. See AGENTS.md.';
const API_CLIENT_ONLY_IN_DATA_MODULES = { group: ['**/api'], importNames: ['apiRequest'], message: API_CALL_MESSAGE };
const API_CLIENT_PACKAGE_ONLY_IN_API_MODULES = { group: ['@trace/api-client'], message: API_CALL_MESSAGE };

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
    // Every eslint-disable states its reason (ESLint core has no rule for it).
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    plugins: { trace: { rules: { 'require-disable-reason': requireDisableReason } } },
    rules: { 'trace/require-disable-reason': 'error' },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Metro loads its config with `require`, so it is a CommonJS file.
    files: ['apps/field/metro.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Applies to every React app (Command web, Field mobile) once they exist.
    files: ['apps/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Client code ships to users' browsers and phones: no console output (logging convention, CODING_STANDARDS.md §8).
    files: ['apps/command/**/*.{ts,tsx,js,jsx}', 'apps/field/**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.config.{ts,js,mjs,cjs}', '**/scripts/**'],
    rules: { 'no-console': 'error' },
  },
  {
    // Design values come only from @trace/design (the Trace Console design system). See AGENTS.md.
    files: ['apps/**/*.{ts,tsx,js,jsx}'],
    // Tests hold fixture data (image sizes, sample colors), not design values.
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...DESIGN_SYNTAX],
    },
  },
  {
    files: ['apps/**/*.tsx'],
    // An icon set is one module of many small components.
    ignores: ['**/*.test.tsx', '**/test/**', 'apps/command/src/components/icons.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...DESIGN_SYNTAX, ONE_COMPONENT] },
  },
  {
    // Size and structure limits. A file or function over a limit is split, never exempted. See AGENTS.md.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: NOT_PRODUCT_CODE,
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-statements': ['error', 30],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
    },
  },
  {
    // A test file past this size is split by area, with its setup in a fixtures file.
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }] },
  },
  {
    // A route file is one plugin function that registers its routes; the file limit bounds it.
    files: ['apps/api/src/modules/*/index.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'drizzle-orm', message: 'Routes do not query the database: call the module service.' }],
          patterns: [
            { group: ['**/db/schema'], message: 'Routes do not query the database: call the module service.' },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/*/src/components/**',
      'apps/*/src/pages/**',
      'apps/command/src/App/**',
      'apps/field/src/realtime/**',
      'apps/field/src/reports/senders/**',
      'apps/field/src/sightings/sender/**',
    ],
    ignores: NOT_PRODUCT_CODE,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [API_CLIENT_ONLY_IN_DATA_MODULES, API_CLIENT_PACKAGE_ONLY_IN_API_MODULES] },
      ],
    },
  },
  {
    // An Expo Router file only wires a route to its screen component.
    files: ['apps/field/src/app/**'],
    rules: {
      'max-lines': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': [
        'error',
        { patterns: [API_CLIENT_ONLY_IN_DATA_MODULES, API_CLIENT_PACKAGE_ONLY_IN_API_MODULES] },
      ],
    },
  },
  {
    files: ['packages/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**', '@trace/api', '@trace/command', '@trace/field'],
              message: 'Packages never import from apps.',
            },
          ],
        },
      ],
    },
  },
);
