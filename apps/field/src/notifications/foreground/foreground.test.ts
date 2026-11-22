import { describe, expect, it } from 'vitest';
import { foregroundBehavior } from '.';

const missionId = '00000000-0000-4000-8000-000000000001';

describe('foregroundBehavior', () => {
  it('shows an SOS notification while the app is open, with its sound', () => {
    expect(foregroundBehavior({ missionId, screen: 'sos' })).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
    });
  });

  it.each(['messages', 'map', 'missing-person'])('leaves %s to the live connection while the app is open', (screen) => {
    expect(foregroundBehavior({ missionId, screen })).toMatchObject({ shouldShowBanner: false, shouldShowList: false });
  });

  it('shows a notification it cannot read rather than lose it', () => {
    expect(foregroundBehavior(undefined)).toMatchObject({ shouldShowBanner: true });
  });
});
