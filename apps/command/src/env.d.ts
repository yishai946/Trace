interface ImportMetaEnv {
  /** MapTiler client key, from apps/command/.env.local (see .env.example). */
  readonly MAPTILER_API_KEY?: string;
  /** Where Field answers join links: the public address of Command, e.g. `https://trace.app`. Defaults to the Field app's scheme, `trace-field://`. */
  readonly VITE_JOIN_LINK_BASE?: string;
}

interface ImportMetaEnv {
  /** Sentry DSN of the Command project. Error tracking is off without it. */
  readonly VITE_SENTRY_DSN?: string;
  /** Defaults to the Vite mode (`production` for a build). */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The release the build is uploaded under, e.g. `trace-command@<git sha>`. */
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
