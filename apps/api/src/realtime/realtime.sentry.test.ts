import { REALTIME_PATH, type JoinMissionAck } from '@trace/schemas';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../env';
import { flushMonitoring, initMonitoring } from '../monitoring';
import { createFakeSentryTransport } from '../testing/sentryTransport';
import { createTestApp, resetDb, signInCommander, type TestContext, type TestUser } from '../testing';
import { type Client, QUIET_MS } from './fixtures';

describe('realtime failures reported to Sentry', () => {
  const sentry = createFakeSentryTransport();
  let ctx: TestContext;
  let url: string;
  const clients: Client[] = [];

  // A fresh app and Sentry client per test: Sentry drops an event that repeats the one before it (its dedupe), and
  // a closed database fails every later query the same way.
  beforeEach(async () => {
    initMonitoring(loadEnv({ SENTRY_DSN: 'https://publickey@o1.ingest.sentry.io/2' }), sentry.factory);
    sentry.events.length = 0;
    ctx = await createTestApp();
    url = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    await resetDb(ctx.db);
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await ctx.close();
    await Sentry.close();
  });

  const socketFor = (user: TestUser): Client => {
    const client: Client = io(url, {
      path: REALTIME_PATH,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: user.headers.cookie ? { cookie: user.headers.cookie } : {},
    });
    clients.push(client);
    return client;
  };
  const connect = (client: Client) =>
    new Promise<Error | null>((resolve) => {
      client.once('connect', () => resolve(null));
      client.once('connect_error', resolve);
    });
  const join = (client: Client, missionId: string) =>
    new Promise<JoinMissionAck>((resolve) => client.emit('mission:join', { missionId }, resolve));
  /** The source tag of every event sent so far. */
  const sources = async () => {
    await flushMonitoring();
    return sentry.events.map(({ tags }) =>
      typeof tags === 'object' && tags && 'source' in tags ? String(tags.source) : 'none',
    );
  };

  it('reports nothing for a refused join', async () => {
    const client = socketFor(await signInCommander(ctx));
    expect(await connect(client)).toBeNull();
    expect(await join(client, randomUUID())).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await join(client, 'not-an-id')).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(await sources()).toEqual([]);
  });

  it('reports a join that fails because the database is down, once', async () => {
    const client = socketFor(await signInCommander(ctx));
    expect(await connect(client)).toBeNull();
    await ctx.closeDb();
    expect(await join(client, randomUUID())).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    const sent = await sources();
    expect(sent.filter((source) => source === 'realtime.join')).toHaveLength(1);
    // The periodic session check fails the same way meanwhile; nothing else is sent.
    expect(sent.every((source) => source === 'realtime.join' || source === 'realtime.session-check')).toBe(true);
  });

  it('reports a sign-in that fails because the database is down, once', async () => {
    const commander = await signInCommander(ctx);
    await ctx.closeDb();
    const failure = await connect(socketFor(commander));
    expect(failure?.message).toBe('INTERNAL_ERROR');
    expect(await sources()).toEqual(['realtime.sign-in']);
  });

  it('reports a session check that fails because the database is down', async () => {
    const client = socketFor(await signInCommander(ctx));
    expect(await connect(client)).toBeNull();
    await ctx.closeDb();
    await new Promise((resolve) => setTimeout(resolve, QUIET_MS));
    expect((await sources())[0]).toBe('realtime.session-check');
  });
});
