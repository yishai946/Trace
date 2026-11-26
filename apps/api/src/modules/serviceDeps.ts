import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';
import type { Realtime } from '../realtime';
import type { PhotoStorage } from '../storage';
import type { GpsLossConfig } from './gpsLoss';
import type { PushNotifier } from './notifications/notifications.service';

/** What a write service needs to publish after its transaction commits: realtime events, push, photo storage and the logger. */
export interface ServiceDeps {
  db: Db;
  realtime: Realtime;
  push: PushNotifier;
  photos: PhotoStorage;
  log: FastifyBaseLogger;
  /**
   * The GPS margin near a polygon border before a searcher counts as outside it (UC-S04, decision 14). The spec leaves
   * it TBD, so there is no default: unset means 0, the exact boundary.
   */
  outOfPolygonToleranceMeters?: number;
  /** Escalating a GPS loss to the commander (UC-S04, decision 42). Off when the time is not configured. */
  gpsLoss?: GpsLossConfig;
}
