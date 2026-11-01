import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://trace:trace@localhost:5433/trace' },
  // PostGIS owns its own tables (spatial_ref_sys); migrations must not touch them.
  extensionsFilters: ['postgis'],
});
