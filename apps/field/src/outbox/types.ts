/**
 * The outbox: what the phone must tell the server but could not yet (UC-S01, UC-S03, UC-F10). Items wait in a SQLite table on
 * the device, oldest first, and an item is deleted only after the server confirmed it, so a failed or interrupted send
 * loses nothing. Each kind of item has a sender that knows its endpoint; the outbox knows only order and deletion.
 */
export type OutboxKind = 'track-point' | 'sighting' | 'report' | 'report-photo';

export interface OutboxItem {
  /** Time-ordered UUID, made on the phone. */
  id: string;
  kind: OutboxKind;
  missionId: string;
  /** What the sender sends, as it was when recorded. Not validated here: the sender validates it. */
  payload: unknown;
  /** Milliseconds since the epoch, when the item was added. */
  createdAt: number;
}

/**
 * What the server answered for a batch. `sent`: it took the batch. `drop-batch`: it will never take this batch (it is
 * invalid). `drop-mission`: it will take nothing more of this mission (the activity ended, or access is gone). A
 * sender throws when the answer is not final (no network, server error, no token), and the items stay.
 */
export type SendOutcome = 'sent' | 'drop-batch' | 'drop-mission';

export interface OutboxSender {
  /** Most items of one send. */
  batchSize: number;
  /** Sends the oldest items of one mission, in order. */
  send(missionId: string, items: OutboxItem[]): Promise<SendOutcome>;
}

export interface Row {
  seq: number;
  id: string;
  kind: OutboxKind;
  mission_id: string;
  payload: string;
  created_at: number;
}
