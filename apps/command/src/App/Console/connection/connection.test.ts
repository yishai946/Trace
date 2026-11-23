import { describe, expect, it } from 'vitest';
import { connectionOf } from '.';

const up = { online: true, connected: true, checking: false };

describe('connectionOf', () => {
  it('says the map is live while connected and the mission is live', () => {
    expect(connectionOf(up, 'live')).toMatchObject({ state: 'up', label: 'זמין' });
  });

  it('says "לא Live" with the last snapshot shown and actions blocked when the browser is offline', () => {
    const c = connectionOf({ online: false, connected: false, checking: false }, 'live');
    expect(c).toMatchObject({ state: 'down', label: 'לא Live' });
    expect(c.detail).toContain('המידע האחרון');
    expect(c.detail).toContain('פעולות מבצעיות חסומות');
  });

  it('says "לא Live" when the server is unreachable', () => {
    const c = connectionOf({ online: true, connected: false, checking: false }, null);
    expect(c).toMatchObject({ state: 'down', label: 'לא Live' });
    expect(c.detail).toContain('פעולות מבצעיות חסומות');
  });

  it('says "לא Live" when the live updates of the open mission are cut', () => {
    const c = connectionOf(up, 'down');
    expect(c).toMatchObject({ state: 'down', label: 'לא Live' });
    expect(c.detail).toContain('המידע האחרון');
  });
});
