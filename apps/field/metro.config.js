// Adds debug ids to the bundle so Sentry can match source maps to it. Builds work without a Sentry token: app.config.ts
// then turns the upload off (docs/MONITORING.md).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// expo-sqlite's web build loads `wa-sqlite.wasm`; Metro bundles it as an asset only when `wasm` is an asset extension.
config.resolver.assetExts.push('wasm');

module.exports = config;
