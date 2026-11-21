import { describe, expect, it } from 'vitest';
import { sourceMapUploadOptions } from '.';

const DIST = '/repo/apps/command/dist';
const UPLOAD_ENV = { SENTRY_AUTH_TOKEN: 'sntrys_token', SENTRY_ORG: 'trace-org' };

describe('sourceMapUploadOptions', () => {
  it('turns the upload off when no auth token is set, so the build still passes', () => {
    expect(sourceMapUploadOptions({}, { version: '0.1.0', distDir: DIST })).toEqual({
      disable: true,
      telemetry: false,
    });
  });

  it('treats a blank token as no token', () => {
    const options = sourceMapUploadOptions(
      { SENTRY_AUTH_TOKEN: '  ', SENTRY_ORG: 'trace-org' },
      { version: '0.1.0', distDir: DIST },
    );
    expect(options.disable).toBe(true);
  });

  it('uploads to trace-command under the release the app reports, then deletes the maps', () => {
    const options = sourceMapUploadOptions(
      { ...UPLOAD_ENV, VITE_SENTRY_RELEASE: 'trace-command@abc123' },
      { version: '0.1.0', distDir: DIST },
    );
    expect(options).toEqual({
      authToken: 'sntrys_token',
      org: 'trace-org',
      project: 'trace-command',
      telemetry: false,
      release: { name: 'trace-command@abc123' },
      sourcemaps: { filesToDeleteAfterUpload: [`${DIST}/**/*.map`] },
    });
  });

  it('defaults the release to the package version and honours another project slug', () => {
    const options = sourceMapUploadOptions(
      { ...UPLOAD_ENV, SENTRY_PROJECT: 'trace-command-staging' },
      { version: '0.1.0', distDir: DIST },
    );
    expect(options.release).toEqual({ name: 'trace-command@0.1.0' });
    expect(options.project).toBe('trace-command-staging');
  });

  it('fails the build when a token is set without an organization', () => {
    expect(() =>
      sourceMapUploadOptions({ SENTRY_AUTH_TOKEN: 'sntrys_token' }, { version: '0.1.0', distDir: DIST }),
    ).toThrow(/SENTRY_ORG/);
  });
});
