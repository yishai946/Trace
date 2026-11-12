import { describe, expect, it, vi } from 'vitest';
import { clearOutbox, enqueue, flushOutbox, pending, pendingCount, type OutboxSender, type SendOutcome } from '.';
import { openDatabaseAsync } from 'expo-sqlite';

const A = 'mission-a';
const B = 'mission-b';

const sender = (send: OutboxSender['send'] = async () => 'sent', batchSize = 500): OutboxSender => ({
  batchSize,
  send: vi.fn(send),
});
const payloadsOf = (call: unknown[]) => (call[1] as { payload: unknown }[]).map((item) => item.payload);
const numbers = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

describe('enqueue and pending', () => {
  it('keeps items in the order they were added, with unique ids', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2] });
    await enqueue({ kind: 'track-point', missionId: A, payloads: [3] });
    await enqueue({ kind: 'track-point', missionId: B, payloads: [4] });

    const items = await pending();
    expect(items.map((item) => item.payload)).toEqual([1, 2, 3, 4]);
    expect(new Set(items.map((item) => item.id)).size).toBe(4);
    expect([...items.map((item) => item.id)].sort()).toEqual(items.map((item) => item.id));
    expect(items.map((item) => item.missionId)).toEqual([A, A, A, B]);
    expect(await pendingCount()).toBe(4);
  });

  it('ignores an item whose id is already there', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1] });
    const [first] = await pending();
    const db = await openDatabaseAsync('trace-outbox.db');
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox (id, kind, mission_id, payload, created_at) VALUES (?, 'track-point', ?, '2', 0)`,
      first!.id,
      A,
    );
    expect(await pendingCount()).toBe(1);
  });

  it('adds nothing for an empty list', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [] });
    expect(await pendingCount()).toBe(0);
  });
});

describe('flushOutbox', () => {
  it('calls no sender when the outbox is empty', async () => {
    const track = sender();
    await flushOutbox({ 'track-point': track });
    expect(track.send).not.toHaveBeenCalled();
  });

  it('keeps items while the send is pending and deletes them after it was confirmed', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2] });
    let confirm: (outcome: SendOutcome) => void = () => undefined;
    const track = sender(() => new Promise<SendOutcome>((resolve) => (confirm = resolve)));

    const flush = flushOutbox({ 'track-point': track });
    await vi.waitFor(() => expect(track.send).toHaveBeenCalledTimes(1));
    expect(await pendingCount()).toBe(2);

    confirm('sent');
    await flush;
    expect(await pendingCount()).toBe(0);
  });

  it('keeps an item added during a send, and sends it in the same flush', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1] });
    let first = true;
    const track = sender(async () => {
      if (first) {
        first = false;
        await enqueue({ kind: 'track-point', missionId: A, payloads: [2] });
      }
      return 'sent';
    });

    await flushOutbox({ 'track-point': track });
    expect(vi.mocked(track.send).mock.calls.map(payloadsOf)).toEqual([[1], [2]]);
    expect(await pendingCount()).toBe(0);
  });

  it('keeps everything when the send throws, and sends in order on a later flush', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2, 3] });
    const down = sender(async () => {
      throw new Error('offline');
    });
    await flushOutbox({ 'track-point': down });
    expect(await pendingCount()).toBe(3);

    await enqueue({ kind: 'track-point', missionId: A, payloads: [4] });
    const up = sender();
    await flushOutbox({ 'track-point': up });
    expect(vi.mocked(up.send).mock.calls.map(payloadsOf)).toEqual([[1, 2, 3, 4]]);
    expect(await pendingCount()).toBe(0);
  });

  it('sends in batches of the sender size, oldest first', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: numbers(0, 1203) });
    const track = sender();
    await flushOutbox({ 'track-point': track });

    const calls = vi.mocked(track.send).mock.calls;
    expect(calls.map((call) => call[1].length)).toEqual([500, 500, 203]);
    expect(calls.flatMap(payloadsOf)).toEqual(numbers(0, 1203));
  });

  it('sends each mission on its own, and a failure stops the flush with nothing deleted', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1] });
    await enqueue({ kind: 'track-point', missionId: B, payloads: [2] });
    await enqueue({ kind: 'track-point', missionId: A, payloads: [3] });
    const ok = sender();
    await flushOutbox({ 'track-point': ok });
    expect(vi.mocked(ok.send).mock.calls.map((call) => [call[0], payloadsOf(call)])).toEqual([
      [A, [1, 3]],
      [B, [2]],
    ]);

    await enqueue({ kind: 'track-point', missionId: A, payloads: [4] });
    await enqueue({ kind: 'track-point', missionId: B, payloads: [5] });
    const failing = sender(async () => {
      throw new Error('offline');
    });
    await flushOutbox({ 'track-point': failing });
    expect(failing.send).toHaveBeenCalledTimes(1);
    expect(await pendingCount()).toBe(2);
  });

  it('drops all items of a mission on drop-mission and goes on with the others', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2] });
    await enqueue({ kind: 'track-point', missionId: B, payloads: [3] });
    await enqueue({ kind: 'track-point', missionId: A, payloads: [4] });
    const track = sender(async (missionId) => (missionId === A ? 'drop-mission' : 'sent'));
    await flushOutbox({ 'track-point': track });

    expect(vi.mocked(track.send).mock.calls.map((call) => call[0])).toEqual([A, B]);
    expect(await pendingCount()).toBe(0);
  });

  it('drops only the batch on drop-batch', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: numbers(0, 3) });
    const track = sender(async (_m, items) => (items[0]!.payload === 0 ? 'drop-batch' : 'sent'), 2);
    await flushOutbox({ 'track-point': track });

    expect(vi.mocked(track.send).mock.calls.map(payloadsOf)).toEqual([[0, 1], [2]]);
    expect(await pendingCount()).toBe(0);
  });

  it('runs one flush at a time: concurrent calls send each batch once', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2] });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const track = sender(async () => {
      await gate;
      return 'sent';
    });

    const first = flushOutbox({ 'track-point': track });
    const second = flushOutbox({ 'track-point': track });
    await vi.waitFor(() => expect(track.send).toHaveBeenCalledTimes(1));
    await enqueue({ kind: 'track-point', missionId: A, payloads: [3] });
    release();
    await Promise.all([first, second]);

    expect(vi.mocked(track.send).mock.calls.map(payloadsOf)).toEqual([[1, 2], [3]]);
    expect(await pendingCount()).toBe(0);
  });

  it('drops items whose stored payload cannot be read, without sending them', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1] });
    const db = await openDatabaseAsync('trace-outbox.db');
    await db.runAsync(
      `INSERT INTO outbox (id, kind, mission_id, payload, created_at) VALUES ('x', 'track-point', ?, '{broken', 0)`,
      A,
    );
    await enqueue({ kind: 'track-point', missionId: A, payloads: [2] });

    const track = sender();
    await flushOutbox({ 'track-point': track });
    expect(vi.mocked(track.send).mock.calls.map(payloadsOf)).toEqual([[1, 2]]);
    expect(await pendingCount()).toBe(0);
  });
});

describe('clearOutbox', () => {
  it('forgets everything that waits', async () => {
    await enqueue({ kind: 'track-point', missionId: A, payloads: [1, 2] });
    await clearOutbox();
    expect(await pendingCount()).toBe(0);
  });
});
