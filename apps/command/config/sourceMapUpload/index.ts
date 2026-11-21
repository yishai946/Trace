import type { SentryVitePluginOptions } from '@sentry/vite-plugin';

/** The build environment that the source map upload reads (docs/MONITORING.md). */
export interface SourceMapUploadEnv {
  readonly SENTRY_AUTH_TOKEN?: string;
  readonly SENTRY_ORG?: string;
  readonly SENTRY_PROJECT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
}

interface BuildInfo {
  /** The `version` of `apps/command/package.json`, for the default release. */
  readonly version: string;
  /** The absolute path of the build output, whose `.map` files are deleted after the upload. */
  readonly distDir: string;
}

const DEFAULT_PROJECT = 'trace-command';

/**
 * Options for `@sentry/vite-plugin`. Without `SENTRY_AUTH_TOKEN` the plugin is off and the build keeps working (a
 * fork, a local build). With it, the hidden source maps are uploaded under the release the app reports and then
 * deleted, so the server never serves them.
 */
export function sourceMapUploadOptions(env: SourceMapUploadEnv, build: BuildInfo): SentryVitePluginOptions {
  const authToken = env.SENTRY_AUTH_TOKEN?.trim();
  if (!authToken) return { disable: true, telemetry: false };
  const org = env.SENTRY_ORG?.trim();
  if (!org) throw new Error('SENTRY_AUTH_TOKEN is set but SENTRY_ORG is not: set the Sentry organization slug.');
  return {
    authToken,
    org,
    project: env.SENTRY_PROJECT?.trim() || DEFAULT_PROJECT,
    telemetry: false,
    release: { name: env.VITE_SENTRY_RELEASE?.trim() || `${DEFAULT_PROJECT}@${build.version}` },
    sourcemaps: { filesToDeleteAfterUpload: [`${build.distDir}/**/*.map`] },
  };
}
