import { themes } from '@trace/design';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinForm, toJoinCode } from '.';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

// The camera is a button here: pressing it "scans" the QR whose text the test put in `qr.text`.
const qr = vi.hoisted(() => ({ text: '', granted: true }));
vi.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: qr.granted, canAskAgain: true }, vi.fn()],
  CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (result: { data: string }) => void }) => (
    <button onClick={() => onBarcodeScanned({ data: qr.text })}>scan</button>
  ),
}));

const JOIN = 'https://api.test/api/join/K7-4Q2';
const preview = { name: 'מסע 0412', status: 'active', missingPerson: { name: 'נועם אברהם', age: 74 } };
const missionId = '00000000-0000-4000-8000-000000000001';
const joined = {
  mission: {
    id: missionId,
    name: 'מסע 0412',
    status: 'active',
    joinCode: 'K7-4Q2',
    missingPerson: {
      name: 'נועם אברהם',
      age: 74,
      disappearedAt: null,
      description: null,
      additionalInfo: null,
      photoUrl: null,
    },
    rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
    lkp: null,
    createdAt: '2026-11-06T10:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  participation: {
    id: '00000000-0000-4000-8000-000000000002',
    callsign: 7,
    status: 'available',
    polygonId: null,
    taskStatus: null,
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (status: number, code: string) => json(status, { error: { code, message: 'x' } });

function stubApi(handlers: { preview?: () => Response; join?: () => Response } = {}) {
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    if (url !== JOIN) throw new Error(`unexpected ${url}`);
    return init.method === 'POST'
      ? (handlers.join ?? (() => json(201, joined)))()
      : (handlers.preview ?? (() => json(200, preview)))();
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderForm = (onJoined = vi.fn()) => {
  render(<JoinForm onJoined={onJoined} onOpenMyMissions={() => {}} />, { wrapper: TestProviders });
  return onJoined;
};
const typeCode = (text: string) => fireEvent.change(screen.getByLabelText('קוד הצטרפות'), { target: { value: text } });
const confirm = () => screen.getByRole('button', { name: 'אשר והצטרף' });

beforeEach(() => {
  qr.text = '';
  qr.granted = true;
  useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  usePreferences.setState(usePreferences.getInitialState());
});

describe('toJoinCode', () => {
  it('shapes typed characters into a join code', () => {
    expect(toJoinCode('k7')).toBe('K7');
    expect(toJoinCode('k74q2')).toBe('K7-4Q2');
    expect(toJoinCode(' k7-4q2 extra')).toBe('K7-4Q2');
  });

  it('takes the code out of a pasted join link', () => {
    expect(toJoinCode('https://trace.example/j/k7-4q2')).toBe('K7-4Q2');
  });
});

describe('JoinForm', () => {
  it('shows the mission of a typed code and joins it', async () => {
    const fetch = stubApi();
    const onJoined = renderForm();
    expect(confirm()).toBeDisabled();
    typeCode('k74q2');

    expect(await screen.findByText('מסע 0412')).toBeInTheDocument();
    expect(screen.getByText(/נעדר: נועם אברהם/)).toBeInTheDocument();
    expect(screen.getByText('פעיל')).toBeInTheDocument();
    fireEvent.click(confirm());

    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      JOIN,
      expect.objectContaining({ method: 'POST', headers: { authorization: 'Bearer t1' } }),
    );
    expect(useSession.getState()).toMatchObject({ missionId, participation: { callsign: 7, status: 'available' } });
  });

  it('opens with the code of a join link and scanning the QR leads to the same mission', async () => {
    stubApi();
    useSession.setState({ pendingJoinCode: 'K7-4Q2' });
    const { unmount } = render(<JoinForm onJoined={() => {}} onOpenMyMissions={() => {}} />, {
      wrapper: TestProviders,
    });
    expect(screen.getByLabelText('קוד הצטרפות')).toHaveValue('K7-4Q2');
    expect(await screen.findByText('מסע 0412')).toBeInTheDocument();
    unmount();

    useSession.setState({ pendingJoinCode: null });
    renderForm();
    qr.text = 'trace-field://j/K7-4Q2';
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));
    expect(screen.getByLabelText('קוד הצטרפות')).toHaveValue('K7-4Q2');
    expect(await screen.findByText('מסע 0412')).toBeInTheDocument();
  });

  it('ignores a QR that is not a join link', () => {
    const fetch = stubApi();
    renderForm();
    qr.text = 'https://example.com/menu';
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));

    expect(screen.getByLabelText('קוד הצטרפות')).toHaveValue('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for the camera before scanning and still takes a typed code', async () => {
    qr.granted = false;
    stubApi();
    renderForm();
    expect(screen.getByText('כוון את המצלמה אל קוד ה-QR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הפעל מצלמה' })).toBeInTheDocument();
    typeCode('K7-4Q2');
    expect(await screen.findByText('מסע 0412')).toBeInTheDocument();
  });

  it('says so when no mission has the code', async () => {
    stubApi({ preview: () => refusal(404, 'NOT_FOUND') });
    renderForm();
    typeCode('K7-4Q2');

    expect(await screen.findByRole('alert')).toHaveTextContent('לא נמצא מסע עם הקוד הזה');
    expect(confirm()).toBeDisabled();
  });

  it('shows a paused mission as paused and explains the refusal', async () => {
    stubApi({
      preview: () => json(200, { ...preview, status: 'paused' }),
      join: () => refusal(409, 'MISSION_NOT_ACTIVE'),
    });
    const onJoined = renderForm();
    typeCode('K7-4Q2');
    expect(await screen.findByText('מושהה')).toBeInTheDocument();
    fireEvent.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent('המסע אינו פעיל כרגע');
    expect(onJoined).not.toHaveBeenCalled();
    expect(useSession.getState().missionId).toBeNull();
  });

  it('shows a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    renderForm();
    typeCode('K7-4Q2');

    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור לשרת');
  });

  it.each(['night', 'day'] as const)('works in %s', async (id) => {
    usePreferences.setState({ themePreference: id });
    stubApi();
    renderForm();
    typeCode('K7-4Q2');

    expect(await screen.findByLabelText('אישור הצטרפות')).toHaveStyle({
      backgroundColor: themes[id].color.surfaceSunken,
    });
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: themes[id].color.surface });
  });
});
