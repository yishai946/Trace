// Adds debug ids to the bundle so Sentry can match source maps to it. Builds work without a Sentry token: app.config.ts
// then turns the upload off (docs/MONITORING.md).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
