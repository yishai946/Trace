interface ImportMetaEnv {
  /** MapTiler client key, from apps/command/.env.local (see .env.example). */
  readonly MAPTILER_API_KEY?: string;
  /** Where Field answers join links, e.g. `https://trace.app`. Defaults to the Field app's scheme, `trace-field://`. */
  readonly VITE_JOIN_LINK_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
