import type { Plugin } from 'vite';

/** The build environment that the Digital Asset Links file reads (docs/DEPLOYMENT.md). */
export interface AssetLinksEnv {
  /** SHA-256 fingerprints of the certificate the Field APK is signed with, separated by commas. */
  readonly ANDROID_CERT_SHA256?: string;
}

interface AssetLinkStatement {
  readonly relation: readonly string[];
  readonly target: {
    readonly namespace: 'android_app';
    readonly package_name: string;
    readonly sha256_cert_fingerprints: readonly string[];
  };
}

/** The Android package of Field (`android.package` in `apps/field/app.json`). */
const FIELD_PACKAGE = 'com.yishai946.tracefield';
const WELL_KNOWN_PATH = '.well-known/assetlinks.json';
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

/**
 * The statements that let Android open this site's links in Field (App Links). Without a fingerprint there are none,
 * so a build without it (a fork, a local build) still passes and links open in the browser.
 */
export function assetLinks(env: AssetLinksEnv): AssetLinkStatement[] {
  const fingerprints = (env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (fingerprints.length === 0) return [];
  const invalid = fingerprints.find((value) => !FINGERPRINT.test(value));
  if (invalid) throw new Error(`ANDROID_CERT_SHA256 holds "${invalid}", which is not a SHA-256 fingerprint (AA:BB:…).`);
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: FIELD_PACKAGE, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

/** `/.well-known/assetlinks.json` as a build output, or null when there is nothing to declare. */
export function assetLinksFile(env: AssetLinksEnv): { fileName: string; source: string } | null {
  const statements = assetLinks(env);
  if (statements.length === 0) return null;
  return { fileName: WELL_KNOWN_PATH, source: JSON.stringify(statements, null, 2) };
}

/** Writes the Digital Asset Links file into the build, so `vite preview` serves it from the site root. */
export function assetLinksPlugin(env: AssetLinksEnv): Plugin {
  return {
    name: 'trace-asset-links',
    generateBundle() {
      const file = assetLinksFile(env);
      if (file) this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source });
    },
  };
}
