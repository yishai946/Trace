import { describe, expect, it } from 'vitest';
import { ExpoPushToken, PushData, RegisterPushTokenBody } from '.';

describe('ExpoPushToken', () => {
  it.each(['ExponentPushToken[abc]', 'ExpoPushToken[abc]'])('accepts %s', (token) => {
    expect(ExpoPushToken.safeParse(token).success).toBe(true);
  });

  it.each(['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'])(
    'rejects %j',
    (token) => {
      expect(ExpoPushToken.safeParse(token).success).toBe(false);
    },
  );
});

describe('RegisterPushTokenBody', () => {
  it('requires a token', () => {
    expect(RegisterPushTokenBody.safeParse({}).success).toBe(false);
    expect(RegisterPushTokenBody.safeParse({ token: 'ExponentPushToken[a]' }).success).toBe(true);
  });
});

describe('PushData', () => {
  const missionId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('accepts a mission and a known screen', () => {
    expect(PushData.safeParse({ missionId, screen: 'sos' }).success).toBe(true);
  });

  it('rejects an unknown screen or a mission that is not a uuid', () => {
    expect(PushData.safeParse({ missionId, screen: 'home' }).success).toBe(false);
    expect(PushData.safeParse({ missionId: 'x', screen: 'map' }).success).toBe(false);
  });
});
