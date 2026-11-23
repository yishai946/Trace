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

/** The `android` section of the Expo config. */
type AndroidConfig = NonNullable<ExpoConfig['android']>;

/** An Android intent filter, as Expo's `android.intentFilters` takes it. */
export interface IntentFilter {
  action: string;
  autoVerify?: boolean;
  data: { scheme: string; host: string; pathPrefix: string }[];
  category: string[];
}

/** Where Field answers join links: the public address of Command (`JOIN_LINK_BASE`, the same as in Command's build). */
export type JoinLinkEnv = Readonly<Record<string, string | undefined>>;

/**
 * The Android App Link filter for `https://<host>/j/<code>` (UC-F02, #141): with `autoVerify` Android checks the
 * site's `/.well-known/assetlinks.json` and opens the link in Field. Without an address there is no filter, so a build
 * without it passes and only the app's own scheme (`trace-field://`) opens links. The address is baked into the APK:
 * another domain later needs a new APK. iOS has no `associatedDomains`, which a free signing certificate does not allow.
 */
export function joinLinkIntentFilter(env: JoinLinkEnv): IntentFilter | null {
  const base = env.JOIN_LINK_BASE?.trim();
  if (!base) return null;
  const host = URL.canParse(base) && new URL(base).protocol === 'https:' ? new URL(base).host : '';
  if (!host)
    throw new Error(
      `JOIN_LINK_BASE is "${base}": set the public https address of Command, e.g. https://trace.example.com.`,
    );
  return {
    action: 'VIEW',
    autoVerify: true,
    data: [{ scheme: 'https', host, pathPrefix: '/j/' }],
    category: ['BROWSABLE', 'DEFAULT'],
  };
}

/** The Android config with the join link filter added to its intent filters. */
export function withJoinLinks(android: AndroidConfig, env: JoinLinkEnv): AndroidConfig {
  const filter = joinLinkIntentFilter(env);
  return filter ? { ...android, intentFilters: [...(android.intentFilters ?? []), filter] } : android;
}

export default ({ config }: ConfigContext) => ({
  ...config,
  android: withJoinLinks(config.android ?? {}, process.env),
  plugins: withSentryUpload(config.plugins ?? [], process.env),
});
