// Extends app.json: configures the Sentry plugin from the build environment (docs/MONITORING.md). The helpers live in
// this file because Expo's config loader transpiles app.config.ts but not the TypeScript files it imports.
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The build environment (EAS environment variables, or the shell of a local build). The upload reads
 * `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`.
 */
export type SentryUploadEnv = Readonly<Record<string, string | undefined>>;

/** Props of the `@sentry/react-native/expo` config plugin. */
export interface SentryPluginProps {
  readonly organization?: string;
  readonly project: string;
  readonly disableAutoUpload: boolean;
}

/** An entry of Expo's `plugins` list: a name, or a name with its props. */
export type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const SENTRY_PLUGIN = '@sentry/react-native/expo';
const DEFAULT_PROJECT = 'trace-field';

/**
 * Props for the Sentry config plugin. Without `SENTRY_AUTH_TOKEN` the source map and debug-symbol upload is turned
 * off in the native project, so a build without secrets (a fork, a local or CI build) passes. The token itself is
 * never written to the native project: sentry-cli reads it from the environment at build time.
 */
export function sentryPluginProps(env: SentryUploadEnv): SentryPluginProps {
  const project = env.SENTRY_PROJECT?.trim() || DEFAULT_PROJECT;
  if (!env.SENTRY_AUTH_TOKEN?.trim()) return { project, disableAutoUpload: true };
  const organization = env.SENTRY_ORG?.trim();
  if (!organization) {
    throw new Error('SENTRY_AUTH_TOKEN is set but SENTRY_ORG is not: set the Sentry organization slug.');
  }
  return { organization, project, disableAutoUpload: false };
}

/** The plugins list with the Sentry plugin configured for this build's environment. */
export function withSentryUpload(plugins: readonly PluginEntry[], env: SentryUploadEnv): PluginEntry[] {
  const entry: PluginEntry = [SENTRY_PLUGIN, sentryPluginProps(env)];
  const isSentry = (plugin: PluginEntry) => (typeof plugin === 'string' ? plugin : plugin[0]) === SENTRY_PLUGIN;
  if (!plugins.some(isSentry)) return [...plugins, entry];
  return plugins.map((plugin) => (isSentry(plugin) ? entry : plugin));
}

export default ({ config }: ConfigContext) => ({
  ...config,
  plugins: withSentryUpload(config.plugins ?? [], process.env),
});
