import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionHistory } from '.';
import { activity, active, endedLocated, endedStopped, ENDED_ID } from '../../history/fixtures';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function serve(routes: Record<string, () => Response>) {
  const fetch = vi.fn(async (url: string) => {
    const route = Object.entries(routes).find(([path]) => url.endsWith(path));
    return route ? route[1]() : json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const show = () => render(<MissionHistory />, { wrapper: TestProviders });

beforeEach(() => useSession.setState({ token: 'tok' }));
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null });
});

describe('MissionHistory', () => {
  it('lists the ended missions only, newest first, with how they ended', async () => {
    serve({ '/api/missions': () => json([active, endedLocated, endedStopped]) });
    show();
    expect(await screen.findByRole('button', { name: /מסע 0371/ })).toHaveTextContent('אותר');
    expect(screen.getByRole('button', { name: /מסע 0329/ })).toHaveTextContent('הופסק');
    expect(screen.queryByText(/מסע 0412/)).toBeNull();
  });

  it('says there is no history yet', async () => {
    serve({ '/api/missions': () => json([active]) });
    show();
    expect(await screen.findByText('עוד אין מסעות שהסתיימו')).toBeTruthy();
  });

  it('says it is loading and offers a retry when it failed', async () => {
    serve({ '/api/missions': () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500) });
    show();
    expect(screen.getByRole('status')).toHaveTextContent('טוען');
    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לטעון את ההיסטוריה');
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeTruthy();
  });

  it('opens a mission read-only with its details and my own activity, and no action buttons', async () => {
    serve({
      '/api/missions': () => json([endedLocated]),
      [`/api/missions/${ENDED_ID}/my-activity`]: () => json(activity),
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /מסע 0371/ }));

    const panel = await screen.findByRole('region', { name: 'צפייה במסע שהסתיים, קריאה בלבד' });
    expect(panel).toHaveTextContent('קריאה בלבד');
    expect(await screen.findByText('מדרון חלק')).toBeTruthy();
    expect(panel).toHaveTextContent('חולצה כחולה');
    expect(panel).toHaveTextContent(/סימן קריאה.*4/);
    expect(panel).toHaveTextContent('פוליגון A');
    expect(panel.querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /עריכה|שלח|התחל|סיום/ })).toBeNull();
  });

  it('closes the open mission when it is pressed again', async () => {
    serve({
      '/api/missions': () => json([endedLocated]),
      [`/api/missions/${ENDED_ID}/my-activity`]: () => json(activity),
    });
    show();
    const row = await screen.findByRole('button', { name: /מסע 0371/ });
    fireEvent.click(row);
    await screen.findByRole('region');
    fireEvent.click(row);
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
  });

  it('says there was no activity of mine to show', async () => {
    serve({
      '/api/missions': () => json([endedStopped]),
      [`/api/missions/${endedStopped.id}/my-activity`]: () => json({ ...activity, reports: [], sightings: [] }),
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /מסע 0329/ }));
    expect(await screen.findByText('לא שלחת דיווחים או תצפיות במסע הזה')).toBeTruthy();
  });

  it('says my activity could not be loaded and retries', async () => {
    serve({
      '/api/missions': () => json([endedLocated]),
      [`/api/missions/${ENDED_ID}/my-activity`]: () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500),
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /מסע 0371/ }));
    expect(await screen.findByText('לא ניתן לטעון את הפעילות שלך')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeTruthy();
  });
});
