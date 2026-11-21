import { Message } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { addParticipant, injectAs, signInCommander, signInSearcher, type TestUser } from '../testing';
import { type Client, setupRealtime } from './fixtures';

describe('realtime', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, record, settle, createMissionAs, createPolygonAs } = rt;

  describe('messages', () => {
    const sendAs = async (user: TestUser, missionId: string, payload: object) => {
      const res = await injectAs(rt.ctx, user)({ method: 'POST', url: `/api/missions/${missionId}/messages`, payload });
      expect(res.statusCode).toBe(201);
      return Message.parse(res.json());
    };
    const receiptAs = (user: TestUser, missionId: string, messageId: string, receipt: string) =>
      injectAs(
        rt.ctx,
        user,
      )({
        method: 'PUT',
        url: `/api/missions/${missionId}/participation/messages/${messageId}/receipt`,
        payload: { receipt },
      });

    it('R1: sends the commander the whole message and each recipient only their own copy', async () => {
      const commander = await signInCommander(rt.ctx);
      const otherCommander = await signInCommander(rt.ctx);
      const a = await signInSearcher(rt.ctx);
      const b = await signInSearcher(rt.ctx);
      const mission = await createMissionAs(commander);
      const polygonA = await createPolygonAs(commander, mission.id);
      const polygonB = await createPolygonAs(commander, mission.id);
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 1,
        polygonId: polygonA.id,
        searcherId: a.searcherId,
      });
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 2,
        polygonId: polygonB.id,
        searcherId: b.searcherId,
      });
      const otherMission = await createMissionAs(otherCommander);

      const [sc, sa, sb, so] = [commander, a, b, otherCommander].map(socketFor) as [Client, Client, Client, Client];
      await Promise.all([sc, sa, sb, so].map(connect));
      await join(sc, mission.id);
      await join(sa, mission.id);
      await join(sb, mission.id);
      await join(so, otherMission.id);
      const toCommander = record(sc);
      const toA = record(sa);
      const toB = record(sb);
      const toOther = record(so);

      const message = await sendAs(commander, mission.id, {
        target: { kind: 'polygons', polygonIds: [polygonA.id] },
        urgency: 'normal',
        body: 'חזרו לכינוס',
      });
      await settle();

      expect(toCommander).toEqual([{ type: 'message.sent', missionId: mission.id, message }]);
      expect(toA).toHaveLength(1);
      const received = toA[0];
      if (received?.type !== 'message.received') throw new Error('Expected message.received');
      expect(received.searcherId).toBe(a.searcherId);
      expect(received.message.status).toBe('sent');
      expect('recipients' in received.message).toBe(false);
      expect(toB).toEqual([]);
      expect(toOther).toEqual([]);
    });

    it('R2: sends a receipt to the commander only, once', async () => {
      const commander = await signInCommander(rt.ctx);
      const a = await signInSearcher(rt.ctx);
      const mission = await createMissionAs(commander);
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: a.searcherId });
      const message = await sendAs(commander, mission.id, {
        target: { kind: 'mission' },
        urgency: 'normal',
        body: 'שלום',
      });

      const [sc, sa] = [commander, a].map(socketFor) as [Client, Client];
      await Promise.all([sc, sa].map(connect));
      await join(sc, mission.id);
      await join(sa, mission.id);
      const toCommander = record(sc);
      const toA = record(sa);

      expect((await receiptAs(a, mission.id, message.id, 'read')).statusCode).toBe(200);
      await settle();
      expect(toCommander).toHaveLength(1);
      expect(toCommander[0]).toMatchObject({
        type: 'message.receipt',
        messageId: message.id,
        recipient: { status: 'read' },
      });
      expect(toA).toEqual([]);

      await receiptAs(a, mission.id, message.id, 'read');
      await settle();
      expect(toCommander).toHaveLength(1);
    });

    it('R3: a searcher who was offline reads the message after reconnecting and the commander sees the receipts', async () => {
      const commander = await signInCommander(rt.ctx);
      const a = await signInSearcher(rt.ctx);
      const mission = await createMissionAs(commander);
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: a.searcherId });
      const sc = socketFor(commander);
      await connect(sc);
      await join(sc, mission.id);
      const toCommander = record(sc);

      // Sent while the searcher has no socket.
      const message = await sendAs(commander, mission.id, {
        target: { kind: 'mission' },
        urgency: 'important',
        body: 'שלום',
      });

      const sa = socketFor(a);
      await connect(sa);
      await join(sa, mission.id);
      const inbox = await injectAs(
        rt.ctx,
        a,
      )({ method: 'GET', url: `/api/missions/${mission.id}/participation/messages` });
      expect(inbox.json()).toEqual([expect.objectContaining({ id: message.id, deliveredAt: null })]);

      await receiptAs(a, mission.id, message.id, 'delivered');
      await settle();
      const delivered = toCommander.find((e) => e.type === 'message.receipt');
      expect(delivered).toMatchObject({ recipient: { status: 'sent' } });
      if (delivered?.type !== 'message.receipt') throw new Error('Expected message.receipt');
      expect(delivered.recipient.deliveredAt).not.toBeNull();

      await receiptAs(a, mission.id, message.id, 'read');
      await settle();
      const receipts = toCommander.filter((e) => e.type === 'message.receipt');
      expect(receipts).toHaveLength(2);
      expect(receipts[1]).toMatchObject({ recipient: { status: 'read' } });
    });
  });
});
