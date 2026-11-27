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

  it('warns that saved information shows, after the GPS (UC-F04)', () => {
    expect(mapWarning({ gpsLost: false, locatedWaiting: false, notUpToDate: true })?.text).toContain('נשמר במכשיר');
    expect(mapWarning({ gpsLost: true, locatedWaiting: false, notUpToDate: true })?.text).toContain('ה-GPS לא זמין');
  });

  it('warns that the searcher left the polygon, before every other warning (UC-S04)', () => {
    const warning = mapWarning({ gpsLost: true, locatedWaiting: true, notUpToDate: true, outsidePolygon: true });
    expect(warning?.text).toContain('יצאתם מגבול הפוליגון');
    expect(mapWarning({ gpsLost: false, locatedWaiting: false, outsidePolygon: false })).toBeNull();
  });

  it('says the mission ended because the missing person was located, after leaving the polygon (UC-C16)', () => {
    const base = { gpsLost: true, locatedWaiting: true, notUpToDate: true };
    expect(mapWarning({ ...base, missionLocated: true })?.text).toBe(
      'הנעדר אותר והמסע הסתיים. הפסיקו את החיפוש וחזרו מהשטח. כשתסיימו, לחצו "סיימתי פעילות".',
    );
    expect(mapWarning({ ...base, missionLocated: true, outsidePolygon: true })?.text).toContain('יצאתם מגבול');
    expect(mapWarning({ gpsLost: false, locatedWaiting: false, missionLocated: false })).toBeNull();
  });

  it('tells the searchers to return to the Rally Point while the commander paused the mission (UC-C15)', () => {
    const base = { gpsLost: true, locatedWaiting: true, notUpToDate: true };
    expect(mapWarning({ ...base, missionPaused: true })?.text).toBe('החיפוש הושהה, חזרו ל־Rally Point.');
    expect(mapWarning({ ...base, missionPaused: true, outsidePolygon: true })?.text).toContain('יצאתם מגבול');
    expect(mapWarning({ ...base, missionPaused: true, missionLocated: true })?.text).toContain('הנעדר אותר');
    expect(mapWarning({ gpsLost: false, locatedWaiting: false, missionPaused: false })).toBeNull();
  });
});
