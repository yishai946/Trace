import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { PushResult, PushSender } from '../pushSender';

/**
 * Sends push notifications through Expo Push. It checks the immediate ticket of each message; receipts, which can
 * report `DeviceNotRegistered` about 15 minutes later, are not read yet (see TECH_STACK.md).
 * A failed request never throws: its tokens come back in `failedTokens`.
 */
export function createExpoPushSender({ accessToken }: { accessToken?: string }): PushSender {
  const expo = new Expo({ accessToken });
  return {
    async send(tokens, { title, body, data }) {
      const result: PushResult = { invalidTokens: [], failedTokens: [] };
      const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));
      for (const chunk of expo.chunkPushNotifications(messages)) {
        const recipients = chunk.map((message) => String(message.to));
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, index) => {
            const token = recipients[index];
            if (token === undefined || ticket.status === 'ok') return;
            if (ticket.details?.error === 'DeviceNotRegistered') result.invalidTokens.push(token);
            else result.failedTokens.push(token);
          });
        } catch {
          result.failedTokens.push(...recipients);
        }
      }
      return result;
    },
  };
}
