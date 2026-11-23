import { describe, expect, it } from 'vitest';
import { assetLinks, assetLinksFile } from '.';

const SHA = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';

describe('assetLinks', () => {
  it('lets the Field package open links of this site, for the certificate it is signed with', () => {
    expect(assetLinks({ ANDROID_CERT_SHA256: SHA })).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'com.yishai946.tracefield', sha256_cert_fingerprints: [SHA] },
      },
    ]);
  });

  it('accepts several fingerprints, for a debug and a release key', () => {
    const other = SHA.replace('AB', 'FF');
    const [statement] = assetLinks({ ANDROID_CERT_SHA256: ` ${SHA}, ${other} ` });
    expect(statement?.target.sha256_cert_fingerprints).toEqual([SHA, other]);
  });

  it('upper-cases the fingerprint, as Android compares it', () => {
    const [statement] = assetLinks({ ANDROID_CERT_SHA256: SHA.toLowerCase() });
    expect(statement?.target.sha256_cert_fingerprints).toEqual([SHA]);
  });

  it('is empty without a fingerprint, so a build without it still passes', () => {
    expect(assetLinks({})).toEqual([]);
    expect(assetLinks({ ANDROID_CERT_SHA256: ' , ' })).toEqual([]);
  });

  it('rejects a value that is not a SHA-256 fingerprint', () => {
    expect(() => assetLinks({ ANDROID_CERT_SHA256: 'not-a-fingerprint' })).toThrow(/ANDROID_CERT_SHA256/);
  });
});

describe('assetLinksFile', () => {
  it('is served from the well-known path, as JSON', () => {
    const file = assetLinksFile({ ANDROID_CERT_SHA256: SHA });
    expect(file?.fileName).toBe('.well-known/assetlinks.json');
    expect(JSON.parse(file?.source ?? '')).toHaveLength(1);
  });

  it('is absent without a fingerprint', () => {
    expect(assetLinksFile({})).toBeNull();
  });
});
