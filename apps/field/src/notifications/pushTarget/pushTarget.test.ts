import { describe, expect, it } from 'vitest';
import { pushTarget } from '.';
import { routes } from '../../navigation/routes';

const missionId = '00000000-0000-4000-8000-000000000001';

describe('pushTarget', () => {
  it.each([
    ['sos', routes.sos],
    ['messages', routes.messages],
    ['map', routes.map],
    ['missing-person', routes.missingPerson],
  ] as const)('opens %s of the mission named in the notification', (screen, href) => {
    expect(pushTarget({ missionId, screen })).toEqual({ missionId, href });
  });

  it.each([
    ['no data', undefined],
    ['an unknown screen', { missionId, screen: 'admin' }],
    ['a missing mission', { screen: 'sos' }],
    ['a mission id that is not a uuid', { missionId: '1', screen: 'sos' }],
    ['something that is not an object', 'sos'],
  ])('ignores %s', (_name, data) => {
    expect(pushTarget(data)).toBeNull();
  });
});
