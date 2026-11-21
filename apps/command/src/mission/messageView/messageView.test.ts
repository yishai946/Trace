import { describe, expect, it } from 'vitest';
import { messageCritical, messageNormal, messageToOne, polygonB } from '../fixtures';
import {
  byAttention,
  counts,
  isFinal,
  lastStepTime,
  readFractions,
  recipientsLabel,
  recipientState,
  recipientStateLabel,
  sendLabel,
  statusSummary,
} from '.';

const [acknowledged, read, delivered] = messageCritical.recipients;
const [normalRead, waiting] = messageNormal.recipients;
if (!acknowledged || !read || !delivered || !normalRead || !waiting) throw new Error('fixtures');

describe('recipientsLabel', () => {
  it('names the whole mission with its recipient count', () => {
    expect(recipientsLabel(messageCritical)).toBe('כלל המסע, 3');
  });

  it('names the polygons with the count', () => {
    expect(recipientsLabel(messageNormal)).toBe('ואדי צפוני, 2');
    const two = {
      ...messageNormal,
      target: {
        kind: 'polygons' as const,
        polygons: [
          { id: 'a', name: 'ואדי צפוני' },
          { id: polygonB.id, name: 'חורשת אורנים' },
        ],
      },
    };
    expect(recipientsLabel(two)).toBe('ואדי צפוני, חורשת אורנים, 2');
  });

  it('names one searcher with the callsign', () => {
    expect(recipientsLabel(messageToOne)).toBe('09 מיכל פרץ');
  });
});

describe('recipientStateLabel', () => {
  it('has a word for every state', () => {
    expect(recipientStateLabel(waiting)).toBe('נשלחה, ממתין למסירה');
    expect(recipientStateLabel(delivered)).toBe('נמסרה');
    expect(recipientStateLabel(read)).toBe('נקראה');
    expect(recipientStateLabel(acknowledged)).toBe('אושרה');
  });
});

describe('statusSummary', () => {
  it('shows read and acknowledged for a critical message', () => {
    expect(statusSummary(messageCritical)).toBe('נקראה 2, אושרה 1');
  });

  it('shows read out of all for other messages', () => {
    expect(statusSummary(messageNormal)).toBe('נקראה 1 מתוך 2');
  });

  it('shows the state of the only recipient', () => {
    expect(statusSummary(messageToOne)).toBe('נקראה');
  });
});

describe('counts', () => {
  it('counts delivered, read and acknowledged recipients', () => {
    expect(counts(messageCritical)).toEqual({ total: 3, delivered: 3, read: 2, acknowledged: 1 });
    expect(counts(messageNormal)).toEqual({ total: 2, delivered: 1, read: 1, acknowledged: 0 });
  });
});

describe('byAttention', () => {
  it('puts the ones waiting first and the acknowledged last', () => {
    const sorted = [acknowledged, read, delivered].sort(byAttention).map((r) => r.callsign);
    expect(sorted).toEqual([9, 7, 4]);
    expect([normalRead, waiting].sort(byAttention).map((r) => r.callsign)).toEqual([5, 4]);
  });

  it('orders equal states by callsign', () => {
    expect(
      [
        { ...read, callsign: 8 },
        { ...read, callsign: 2 },
      ]
        .sort(byAttention)
        .map((r) => r.callsign),
    ).toEqual([2, 8]);
  });
});

describe('isFinal', () => {
  it('is acknowledged for a critical message', () => {
    expect(isFinal(messageCritical, acknowledged)).toBe(true);
    expect(isFinal(messageCritical, read)).toBe(false);
    expect(isFinal(messageCritical, delivered)).toBe(false);
  });

  it('is read for any other message', () => {
    expect(isFinal(messageNormal, normalRead)).toBe(true);
    expect(isFinal(messageNormal, waiting)).toBe(false);
  });
});

describe('sendLabel', () => {
  it('counts the recipients', () => {
    expect(sendLabel(0)).toBe('שלח');
    expect(sendLabel(1)).toBe('שלח למחפש אחד');
    expect(sendLabel(7)).toBe('שלח ל-7 מחפשים');
  });
});

describe('recipientState', () => {
  it('names the step: pending, delivered, read, acknowledged', () => {
    expect(recipientState(waiting)).toBe('pending');
    expect(recipientState(delivered)).toBe('delivered');
    expect(recipientState(read)).toBe('read');
    expect(recipientState(acknowledged)).toBe('acknowledged');
  });
});

describe('lastStepTime', () => {
  it('is the latest step, and null while waiting', () => {
    expect(lastStepTime(acknowledged)).toBe(acknowledged.acknowledgedAt);
    expect(lastStepTime(read)).toBe(read.readAt);
    expect(lastStepTime(delivered)).toBe(delivered.deliveredAt);
    expect(lastStepTime(waiting)).toBeNull();
  });
});

describe('readFractions', () => {
  it('adds the acknowledged fraction for a critical message only', () => {
    expect(readFractions(messageCritical)).toEqual([
      { label: 'נקראה', value: '2/3' },
      { label: 'אושרה', value: '1/3' },
    ]);
    expect(readFractions(messageNormal)).toEqual([{ label: 'נקראה', value: '1/2' }]);
  });
});
