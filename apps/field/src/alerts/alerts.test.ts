import { beforeEach, describe, expect, it } from 'vitest';
import { useAlerts, type FieldAlert } from '.';

const alert = (id: string, text = id): FieldAlert => ({ id, kind: 'details', title: 't', text, href: null });

beforeEach(() => useAlerts.setState(useAlerts.getInitialState()));

describe('useAlerts', () => {
  it('shows the newest alert first and keeps one alert per id', () => {
    const { raise } = useAlerts.getState();
    raise(alert('a'));
    raise(alert('b'));
    raise(alert('a', 'again'));
    expect(useAlerts.getState().alerts.map((a) => a.id)).toEqual(['a', 'b']);
    expect(useAlerts.getState().alerts[0]?.text).toBe('again');
  });

  it('dismisses one alert, and clears all of them', () => {
    const { raise, dismiss, clear } = useAlerts.getState();
    raise(alert('a'));
    raise(alert('b'));
    dismiss('a');
    expect(useAlerts.getState().alerts.map((a) => a.id)).toEqual(['b']);
    clear();
    expect(useAlerts.getState().alerts).toEqual([]);
  });
});
