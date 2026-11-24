import { describe, expect, it } from 'vitest';
import {
  joinLinkIntentFilter,
  type PluginEntry,
  sentryPluginProps,
  withJoinLinks,
  withSentryUpload,
} from './app.config';

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

describe('joinLinkIntentFilter', () => {
  it('makes Android verify and open https join links of the site in the app', () => {
    expect(joinLinkIntentFilter({ JOIN_LINK_BASE: 'https://trace.up.railway.app' })).toEqual({
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: 'trace.up.railway.app', pathPrefix: '/j/' }],
      category: ['BROWSABLE', 'DEFAULT'],
    });
  });

  it('takes only the host of the address, whatever follows it', () => {
    expect(joinLinkIntentFilter({ JOIN_LINK_BASE: 'https://trace.up.railway.app/' })?.data[0]?.host).toBe(
      'trace.up.railway.app',
    );
  });

  it('is absent without an address, so a build without it passes and only the app scheme opens links', () => {
    expect(joinLinkIntentFilter({})).toBeNull();
    expect(joinLinkIntentFilter({ JOIN_LINK_BASE: ' ' })).toBeNull();
  });

  it('fails the build on an address that is not https, which Android would never verify', () => {
    expect(() => joinLinkIntentFilter({ JOIN_LINK_BASE: 'trace-field://' })).toThrow(/JOIN_LINK_BASE/);
    expect(() => joinLinkIntentFilter({ JOIN_LINK_BASE: 'http://trace.example.com' })).toThrow(/JOIN_LINK_BASE/);
    expect(() => joinLinkIntentFilter({ JOIN_LINK_BASE: 'not a url' })).toThrow(/JOIN_LINK_BASE/);
  });
});

describe('withJoinLinks', () => {
  it('adds the intent filter next to the ones the config already has', () => {
    const existing = { action: 'VIEW', data: [{ scheme: 'x' }] };
    const android = withJoinLinks({ intentFilters: [existing] }, { JOIN_LINK_BASE: 'https://trace.example.com' });
    expect(android.intentFilters).toHaveLength(2);
    expect(android.intentFilters?.[0]).toEqual(existing);
  });

  it('leaves the Android config as it is without an address', () => {
    expect(withJoinLinks({ package: 'a.b' }, {})).toEqual({ package: 'a.b' });
  });
});
