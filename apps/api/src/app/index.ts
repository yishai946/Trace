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
import { healthRoutes } from '../modules/health/routes';
import { createExpoPushSender } from '../modules/notifications/expoPushSender';
import { notificationRoutes } from '../modules/notifications';
import { createPushNotifier } from '../modules/notifications/notifications.service';
import type { PushSender } from '../modules/notifications/pushSender';
import { missionRoutes } from '../modules/missions';
import { participantRoutes } from '../modules/participants';
import { polygonRoutes } from '../modules/polygons';
import { reportRoutes } from '../modules/reports';
import { sightingRoutes } from '../modules/sightings';
import { sosRoutes } from '../modules/sos';
import { searcherRoutes } from '../modules/searchers';
import { timelineRoutes } from '../modules/timeline';
import { trackingRoutes } from '../modules/tracking';
import { createRealtime } from '../realtime';

const VERSION = '0.1.0';

interface AppOptions {
  env: Env;
  db: Db;
  /** Sends searchers their sign-in code. Defaults to writing it to the log outside production. */
  sendOtp?: OtpSender;
  /** How often open realtime connections recheck their session. Tests shorten it. */
  realtimeRevalidateMs?: number;
  /** Sends push notifications. Defaults to Expo Push; tests pass a fake. */
  pushSender?: PushSender;
}

/** Builds the app without listening, so tests can call it with `app.inject`. */
export async function buildApp({ env, db, sendOtp, realtimeRevalidateMs, pushSender }: AppOptions) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();
  const auth = createAuth({
    env,
    db,
    sendOtp:
      sendOtp ??
      (async ({ phoneNumber, code }) => {
        // The SMS provider is still an open decision (TECH_STACK.md), so production cannot send codes yet.
        if (env.NODE_ENV === 'production') throw new Error('No SMS provider is configured to send sign-in codes');
        app.log.info({ phoneNumber, code }, 'Sign-in code (development only, not sent by SMS)');
      }),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);
  const realtime = createRealtime({ app, auth, db, env, revalidateMs: realtimeRevalidateMs });

  const push = createPushNotifier({
    db,
    sender: pushSender ?? createExpoPushSender({ accessToken: env.EXPO_ACCESS_TOKEN }),
    log: app.log,
  });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
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
        await signedIn.register(missionRoutes, { db, realtime });
        await signedIn.register(polygonRoutes, { db, realtime });
        await signedIn.register(sightingRoutes, { db, realtime });
        await signedIn.register(sosRoutes, { db, realtime });
        await signedIn.register(participantRoutes, { db, realtime });
        await signedIn.register(trackingRoutes, { db, realtime });
        await signedIn.register(reportRoutes, { db, realtime });
        await signedIn.register(searcherRoutes, { db });
        await signedIn.register(notificationRoutes, { db });
        await signedIn.register(timelineRoutes, { db });
      });
    },
    { prefix: '/api' },
  );

  return { app, auth, realtime, push };
}
