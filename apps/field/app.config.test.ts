import { describe, expect, it } from 'vitest';
import { type PluginEntry, sentryPluginProps, withSentryUpload } from './app.config';

describe('sentryPluginProps', () => {
  it('skips the upload when no auth token is set, so a build without secrets still passes', () => {
    expect(sentryPluginProps({})).toEqual({ project: 'trace-field', disableAutoUpload: true });
  });

  it('treats a blank token as no token', () => {
    expect(sentryPluginProps({ SENTRY_AUTH_TOKEN: ' ' }).disableAutoUpload).toBe(true);
  });

  it('uploads to the organization and project of the EAS environment when the token is set', () => {
    expect(
      sentryPluginProps({
        SENTRY_AUTH_TOKEN: 'sntrys_token',
        SENTRY_ORG: 'trace-org',
        SENTRY_PROJECT: 'trace-field-b',
      }),
    ).toEqual({ organization: 'trace-org', project: 'trace-field-b', disableAutoUpload: false });
  });

  it('never writes the token into the native project', () => {
    expect(sentryPluginProps({ SENTRY_AUTH_TOKEN: 'sntrys_token', SENTRY_ORG: 'trace-org' })).not.toHaveProperty(
      'authToken',
    );
  });

  it('fails the build when a token is set without an organization', () => {
    expect(() => sentryPluginProps({ SENTRY_AUTH_TOKEN: 'sntrys_token' })).toThrow(/SENTRY_ORG/);
  });
});

describe('withSentryUpload', () => {
  it('replaces the bare Sentry plugin entry and keeps the other plugins in order', () => {
    const plugins: PluginEntry[] = [
      'expo-router',
      '@sentry/react-native/expo',
      ['expo-camera', { microphonePermission: false }],
    ];
    expect(withSentryUpload(plugins, {})).toEqual([
      'expo-router',
      ['@sentry/react-native/expo', { project: 'trace-field', disableAutoUpload: true }],
      ['expo-camera', { microphonePermission: false }],
    ]);
  });

  it('adds the Sentry plugin when it is missing', () => {
    expect(withSentryUpload(['expo-router'], {})).toEqual([
      'expo-router',
      ['@sentry/react-native/expo', { project: 'trace-field', disableAutoUpload: true }],
    ]);
  });
});
