import {
  ApiError,
  Message,
  MessageList,
  MessageParams,
  MessageReceiptBody,
  MissionParams,
  OwnMessage,
  OwnMessageList,
  SendMessageBody,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { forbidden } from '../../errors';
import type { Realtime } from '../../realtime';
import type { PushNotifier } from '../notifications/notifications.service';
import { listMessages, listOwnMessages, PUSH_TITLES, recordReceipt, sendMessage } from './messages.service';

export const messageRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime; push: PushNotifier }> = async (
  app,
  { db, realtime, push },
) => {
  app.post(
    '/missions/:missionId/messages',
    {
      schema: {
        tags: ['messages'],
        summary: 'Send an operational message (UC-C12)',
        description:
          'The mission’s commander only (spec §7), while the mission is active or paused. Recipients are fixed when ' +
          'sent: the whole mission (everyone not Activity Ended), searchers assigned to the given polygons, or one ' +
          'searcher. 404 POLYGON_NOT_FOUND or NOT_FOUND for a target not in the mission; 409 MISSION_ENDED, ' +
          'PARTICIPATION_ENDED, NO_RECIPIENTS.',
        params: MissionParams,
        body: SendMessageBody,
        response: { 201: Message, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request, reply) => {
      const { missionId } = request.params;
      const { message, deliveries } = await sendMessage(db, {
        missionId,
        sentBy: actorOf(request).userId,
        message: request.body,
      });
      realtime.publish({ type: 'message.sent', missionId, message });
      for (const delivery of deliveries) {
        realtime.publish({
          type: 'message.received',
          missionId,
          searcherId: delivery.searcherId,
          message: delivery.message,
        });
      }
      // Best effort: push never fails or delays the send.
      void push.notifySearchers({
        missionId,
        searcherIds: deliveries.map((delivery) => delivery.searcherId),
        message: {
          title: PUSH_TITLES[message.urgency],
          body: message.body,
          data: { missionId, screen: 'messages' },
        },
      });
      return reply.status(201).send(message);
    },
  );

  app.get(
    '/missions/:missionId/messages',
    {
      schema: {
        tags: ['messages'],
        summary: 'List the mission’s messages with their recipients, newest first (UC-C12)',
        description: 'The mission’s commander only. Also after the mission ended.',
        params: MissionParams,
        response: { 200: MessageList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    (request) => listMessages(db, request.params.missionId),
  );

  app.get(
    '/missions/:missionId/participation/messages',
    {
      schema: {
        tags: ['messages'],
        summary: 'The messages addressed to the signed-in searcher (UC-F12)',
        description:
          'Messages addressed to the signed-in searcher, newest first. Field reads it after reconnecting, so ' +
          'messages sent while offline arrive (decision 77).',
        params: MissionParams,
        response: { 200: OwnMessageList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      return listOwnMessages(db, { missionId: request.params.missionId, searcherId: actor.searcherId });
    },
  );

  app.put(
    '/missions/:missionId/participation/messages/:messageId/receipt',
    {
      schema: {
        tags: ['messages'],
        summary: 'Report that a message was delivered, read or acknowledged (UC-F12)',
        description:
          'Receipts move forward only (delivered, read, acknowledged); a repeated or earlier one changes nothing. ' +
          '409 MESSAGE_NOT_CRITICAL for acknowledging a normal or important message (decision 27). 404 for a ' +
          'message not addressed to this searcher.',
        params: MessageParams,
        body: MessageReceiptBody,
        response: { 200: OwnMessage, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId, messageId } = request.params;
      const { message, recipient, changed } = await recordReceipt(db, {
        missionId,
        searcherId: actor.searcherId,
        messageId,
        receipt: request.body.receipt,
      });
      if (changed) realtime.publish({ type: 'message.receipt', missionId, messageId, recipient });
      return message;
    },
  );
};
