interface ImportMetaEnv {
  /** MapTiler client key, from apps/command/.env.local (see .env.example). */
  readonly MAPTILER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
