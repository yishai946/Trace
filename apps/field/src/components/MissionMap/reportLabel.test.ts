import { describe, expect, it } from 'vitest';
import { reportLabel } from './reportLabel';

describe('reportLabel', () => {
  it('names a plain report by its time', () => {
    expect(reportLabel({ hazard: false, time: '16:44' })).toBe('דיווח 16:44');
  });

  it('names a hazard and a located report by their kind', () => {
    expect(reportLabel({ hazard: true, time: '16:44' })).toBe('דיווח מפגע 16:44');
    expect(reportLabel({ hazard: false, located: true, time: '17:10' })).toBe('דיווח הנעדר אותר 17:10');
  });

  it('puts "located" before "hazard" and leaves out a missing time', () => {
    expect(reportLabel({ hazard: true, located: true, time: '17:10' })).toBe('דיווח הנעדר אותר 17:10');
    expect(reportLabel({ hazard: true })).toBe('דיווח מפגע');
  });
});
