// Adds debug ids to the bundle so Sentry can match source maps to it. Builds work without a Sentry token: set
// SENTRY_DISABLE_AUTO_UPLOAD=true to skip the upload (docs/MONITORING.md).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
