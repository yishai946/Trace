import { describe, expect, it, vi } from 'vitest';
import { resetDb } from './index';
import type { Db } from '../../db';

const deadlock = () => Object.assign(new Error('deadlock detected'), { code: '40P01' });

/** A database whose `execute` fails with the given errors in turn, then succeeds. */
function dbFailing(...errors: Error[]) {
  const execute = vi.fn(async () => {
    const error = errors.shift();
    if (error) throw error;
  });
  return { db: { execute } as unknown as Db, execute };
}

describe('resetDb', () => {
  it('truncates once when nothing goes wrong', async () => {
    const { db, execute } = dbFailing();
    await resetDb(db);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('retries when the truncate is the deadlock victim (40P01)', async () => {
    const { db, execute } = dbFailing(deadlock(), deadlock());
    await resetDb(db);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('finds the code on the cause of a wrapped error', async () => {
    const wrapped = new Error('Failed query', { cause: deadlock() });
    const { db, execute } = dbFailing(wrapped);
    await resetDb(db);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few deadlocks', async () => {
    const { db, execute } = dbFailing(...Array.from({ length: 10 }, deadlock));
    await expect(resetDb(db)).rejects.toThrow('deadlock detected');
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it('does not retry other errors', async () => {
    const { db, execute } = dbFailing(new Error('connection refused'));
    await expect(resetDb(db)).rejects.toThrow('connection refused');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
