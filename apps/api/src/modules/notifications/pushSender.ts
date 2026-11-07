import type { PushData } from '@trace/schemas';

export interface PushMessage {
  title: string;
  body: string;
  /** Read by Field when the notification is tapped, to open the right screen. */
  data?: PushData;
}

export interface PushResult {
  /** Tokens Expo says no longer reach a device; delete them. */
  invalidTokens: string[];
  /** Tokens whose send failed for another reason; keep them. */
  failedTokens: string[];
}

/** Delivers one message to many devices. The real one talks to Expo Push; tests use a fake. */
export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}
