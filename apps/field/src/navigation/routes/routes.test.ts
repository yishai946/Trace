// @vitest-environment node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { routes, tabs } from '.';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));
// Expo Router: a route `/x` is `x.tsx` in the app folder or in a group such as `(mission)`.
const routeFileExists = (href: string) =>
  [`${appDir}${href.slice(1)}.tsx`, `${appDir}(mission)/${href.slice(1)}.tsx`].some(existsSync);

describe('routes', () => {
  it('has a screen for every route of the Field app', () => {
    expect(Object.keys(routes).sort()).toEqual(
      ['join', 'login', 'map', 'messages', 'more', 'myMissions', 'report', 'reports', 'sos'].sort(),
    );
    for (const href of Object.values(routes)) expect(routeFileExists(href), href).toBe(true);
  });

  it('puts the mission tabs in the wireframe order, in Hebrew', () => {
    expect(tabs.map((t) => t.label)).toEqual(['מסע', 'דיווחים', 'הודעות', 'SOS', 'עוד']);
    expect(tabs.map((t) => t.href)).toEqual([routes.map, routes.reports, routes.messages, routes.sos, routes.more]);
  });

  it('gives every tab a distinct name', () => {
    expect(new Set(tabs.map((t) => t.name)).size).toBe(tabs.length);
  });
});
