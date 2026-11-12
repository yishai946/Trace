import { describe, expect, it } from 'vitest';
import { mapWarning } from '.';

describe('mapWarning', () => {
  it('has none when nothing is wrong', () => {
    expect(mapWarning({ gpsLost: false, locatedWaiting: false })).toBeNull();
  });

  it('warns that the GPS is lost (decision 42)', () => {
    expect(mapWarning({ gpsLost: true, locatedWaiting: false })?.text).toContain('ה-GPS לא זמין');
  });

  it('warns that a "הנעדר אותר" report has not reached the commander', () => {
    expect(mapWarning({ gpsLost: false, locatedWaiting: true })?.text).toBe(
      'דיווח "הנעדר אותר" עדיין לא הגיע למנהל. הוא יישלח אוטומטית כשהחיבור יחזור.',
    );
  });

  it('shows the located report first when both apply: the commander does not know the person was found', () => {
    expect(mapWarning({ gpsLost: true, locatedWaiting: true })?.text).toContain('הנעדר אותר');
  });
});
