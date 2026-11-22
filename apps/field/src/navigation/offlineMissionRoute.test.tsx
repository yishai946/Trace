import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissingPersonScreen from '../app/missing-person';
import { MISSION_ID, mission } from '../offline/downloadPackage/fixtures';
import { saveStep } from '../offline/store';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  Redirect: ({ href }: { href: string }) => <p>{`redirect ${href}`}</p>,
}));

const saved = async () => {
  await saveStep(MISSION_ID, 'mission', { json: mission });
  await saveStep(MISSION_ID, 'photo', { bytes: new Uint8Array([104, 105]), contentType: 'image/jpeg' });
};

beforeEach(() =>
  useSession.setState({ ...useSession.getInitialState(), token: 't', restored: true, missionId: MISSION_ID }),
);
afterEach(() => vi.unstubAllGlobals());

describe('the missing person details without a connection (UC-F04)', () => {
  it('shows the saved details, the saved photo and says they may be out of date', async () => {
    await saved();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<MissingPersonScreen />, { wrapper: TestProviders });

    expect(await screen.findByText('חולצה כחולה')).toBeInTheDocument();
    expect(await screen.findByText('מוצג מידע שנשמר במכשיר. ייתכן שהוא לא מעודכן.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'נסה שוב' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('data:image/jpeg;base64,aGk='));
  });

  it('shows no warning while the server answers', async () => {
    await saved();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...mission, name: 'מסע מעודכן' }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    render(<MissingPersonScreen />, { wrapper: TestProviders });

    expect(await screen.findByText('חולצה כחולה')).toBeInTheDocument();
    expect(screen.queryByText(/נשמר במכשיר/)).not.toBeInTheDocument();
  });

  it('still offers a retry when nothing is saved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<MissingPersonScreen />, { wrapper: TestProviders });

    expect(await screen.findByRole('button', { name: 'נסה שוב' })).toBeInTheDocument();
  });
});
