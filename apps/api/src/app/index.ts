import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createAuth, type OtpSender } from '../auth';
import { authRoutes, requireSignIn } from '../auth/auth.plugin';
import type { Db } from '../db';
import type { Env } from '../env';
import { registerErrorHandlers } from '../errors';
import { serverLogOptions, type LogStream } from '../logging';
import { commanderRoutes } from '../modules/commanders';
import { healthRoutes } from '../modules/health/routes';
import { createExpoPushSender } from '../modules/notifications/expoPushSender';
import { notificationRoutes } from '../modules/notifications';
import { createPushNotifier } from '../modules/notifications/notifications.service';
import type { PushSender } from '../modules/notifications/pushSender';
import { missionRoutes } from '../modules/missions';
import type { GpsLossScheduler } from '../modules/gpsLoss';
import { participantRoutes } from '../modules/participants';
import { polygonRoutes } from '../modules/polygons';
import { messageRoutes } from '../modules/messages';
import { reportRoutes } from '../modules/reports';
import { sightingRoutes } from '../modules/sightings';
import { sosRoutes } from '../modules/sos';
import { searcherRoutes } from '../modules/searchers';
import { timelineRoutes } from '../modules/timeline';
import { historyRoutes } from '../modules/history';
import { startConnectivityMonitor } from '../modules/timeline/timeline.connectivity';
import { trackingRoutes } from '../modules/tracking';
import type { ServiceDeps } from '../modules/serviceDeps';
import { createRealtime } from '../realtime';
import { createPhotoStorage, type PhotoStorage } from '../storage';
import { VERSION } from '../version';

interface AppOptions {
  env: Env;
  db: Db;
  /** Sends searchers their sign-in code. Defaults to writing it to the log outside production. */
  sendOtp?: OtpSender;
  /** How often open realtime connections recheck their session. Tests shorten it. */
  realtimeRevalidateMs?: number;
  /** Sends push notifications. Defaults to Expo Push; tests pass a fake. */
  pushSender?: PushSender;
  /** Where log lines go instead of stdout. Tests pass one to read them. */
  logStream?: LogStream;
  /** How often to record searchers going Offline or coming back (UC-C10). Off when omitted, so tests run the check themselves. */
  connectivityCheckMs?: number;
  /** Where photos are kept. Defaults to the Railway Bucket from the environment, or memory when it is not set. */
  photoStorage?: PhotoStorage;
  /** Queues the delayed GPS-loss escalation (UC-S04). Without one, or without the configured time, nothing escalates. */
  gpsLossScheduler?: GpsLossScheduler;
}

/** Builds the app without listening, so tests can call it with `app.inject`. */
export async function buildApp({
  env,
  db,
  sendOtp,
  realtimeRevalidateMs,
  pushSender,
  logStream,
  connectivityCheckMs,
  photoStorage,
  gpsLossScheduler,
}: AppOptions) {
  const app = Fastify({
    ...serverLogOptions(env, logStream),
    trustProxy: env.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();
  const auth = createAuth({
    env,
    db,
    log: app.log,
    sendOtp:
      sendOtp ??
      (async ({ phoneNumber, code }) => {
        // The SMS provider is still an open decision (TECH_STACK.md), so production cannot send codes yet.
        if (env.NODE_ENV === 'production') throw new Error('No SMS provider is configured to send sign-in codes');
        // Only the last digits, so the log holds no phone number; enough to tell two test phones apart.
        app.log.info({ phoneEnding: phoneNumber.slice(-4), code }, 'Sign-in code (development only, not sent by SMS)');
      }),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);
  // The id in every log line (`reqId`) and Sentry tag (`request_id`), so a client or a report leads to its logs.
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  const realtime = createRealtime({ app, auth, db, env, revalidateMs: realtimeRevalidateMs });

  const push = createPushNotifier({
    db,
    sender: pushSender ?? createExpoPushSender({ accessToken: env.EXPO_ACCESS_TOKEN }),
    log: app.log,
  });

  const deps: ServiceDeps = {
    db,
    realtime,
    push,
    photos: photoStorage ?? createPhotoStorage(env),
    log: app.log,
    outOfPolygonToleranceMeters: env.OUT_OF_POLYGON_TOLERANCE_METERS,
    gpsLoss:
      env.GPS_LOST_ESCALATION_SECONDS && gpsLossScheduler
        ? { afterSeconds: env.GPS_LOST_ESCALATION_SECONDS, scheduler: gpsLossScheduler }
        : undefined,
    lostContact: env.LOST_CONTACT_AFTER_SECONDS ? { afterSeconds: env.LOST_CONTACT_AFTER_SECONDS } : undefined,
  };
  if (connectivityCheckMs) {
    const stop = startConnectivityMonitor(deps, connectivityCheckMs);
    app.addHook('onClose', async () => stop());
  }

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(swagger, {
    openapi: { info: { title: 'TRACE API', version: VERSION } },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Each domain module (missions, polygons, searchers, ...) registers under /api, behind sign-in.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { version: VERSION });
      await api.register(authRoutes, { auth });
      await api.register(async (signedIn) => {
        requireSignIn(signedIn, { auth, db });
        await signedIn.register(missionRoutes, deps);
        await signedIn.register(polygonRoutes, deps);
        await signedIn.register(sightingRoutes, deps);
        await signedIn.register(messageRoutes, deps);
        await signedIn.register(sosRoutes, deps);
        await signedIn.register(participantRoutes, deps);
        await signedIn.register(trackingRoutes, deps);
        await signedIn.register(reportRoutes, deps);
        await signedIn.register(searcherRoutes, { db });
        await signedIn.register(notificationRoutes, { db });
        await signedIn.register(commanderRoutes, { db });
        await signedIn.register(timelineRoutes, { db });
        await signedIn.register(historyRoutes, { db });
      });
    },
    { prefix: '/api' },
  );

  return { app, auth, realtime, push, deps };
}
