import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';
import type { Realtime } from '../realtime';
import type { PushNotifier } from './notifications/notifications.service';

/** What a write service needs to publish after its transaction commits: realtime events, push and the logger. */
export interface ServiceDeps {
  db: Db;
  realtime: Realtime;
  push: PushNotifier;
  log: FastifyBaseLogger;
}
