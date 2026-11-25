import { Mission } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missionPhotos, reportPhotos } from '../db/schema';
import { lkp, rallyPoint } from '../modules/missions/fixtures';
import { ID, JPEG, setupReports } from '../modules/reports/fixtures';
import { createTestApp, injectAs, PNG_BYTES as PNG, resetDb, signInCommander, type TestContext } from '../testing';
import { missionPhotoKey, reportPhotoKey } from '.';
import { movePhotos } from './movePhotos';

describe('report photos saved before the bucket', () => {
  const rt = setupReports();

  it('serves a photo from its row, then from the bucket once moved, and moves it only once', async () => {
    await rt.send();
    await rt.ctx.db.insert(reportPhotos).values({ reportId: ID, contentType: 'image/jpeg', data: JPEG });
    const before = await rt.getPhoto();
    expect(before.statusCode).toBe(200);
    expect(before.rawPayload.equals(JPEG)).toBe(true);

    expect(await movePhotos(rt.ctx.db, rt.ctx.photos)).toBe(1);
    expect((await rt.ctx.db.select().from(reportPhotos))[0]?.data).toBeNull();
    expect(await rt.ctx.photos.get(reportPhotoKey(ID))).toEqual({ contentType: 'image/jpeg', data: JPEG });
    expect((await rt.getPhoto()).rawPayload.equals(JPEG)).toBe(true);
    expect(await movePhotos(rt.ctx.db, rt.ctx.photos)).toBe(0);
  });

  it('keeps a photo already in the bucket, because it was uploaded after the move began', async () => {
    await rt.send();
    await rt.ctx.db.insert(reportPhotos).values({ reportId: ID, contentType: 'image/jpeg', data: JPEG });
    const newer = { contentType: 'image/png', data: PNG };
    await rt.ctx.photos.put(reportPhotoKey(ID), newer);
    await movePhotos(rt.ctx.db, rt.ctx.photos);
    expect(await rt.ctx.photos.get(reportPhotoKey(ID))).toEqual(newer);
    expect((await rt.ctx.db.select().from(reportPhotos))[0]?.data).toBeNull();
  });

  it('answers 404 for a photo with neither bytes in its row nor an object in the bucket', async () => {
    await rt.send();
    await rt.ctx.photos.remove(reportPhotoKey(ID)); // the memory storage outlives resetDb, and the report id is fixed
    await rt.ctx.db.insert(reportPhotos).values({ reportId: ID, contentType: 'image/jpeg' });
    expect((await rt.getPhoto()).statusCode).toBe(404);
  });
});

describe('mission photos saved before the bucket', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx.db));
  afterAll(() => ctx.close());

  it('serves the photo from its row and moves it to the bucket', async () => {
    const commander = injectAs(ctx, await signInCommander(ctx));
    const created = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'מסע', rallyPoint, lkp },
    });
    const missionId = Mission.parse(created.json()).id;
    await ctx.db.insert(missionPhotos).values({ missionId, contentType: 'image/png', data: PNG });
    const url = `/api/missions/${missionId}/photo`;
    expect((await commander({ method: 'GET', url })).rawPayload.equals(PNG)).toBe(true);

    expect(await movePhotos(ctx.db, ctx.photos)).toBe(1);
    expect(await ctx.photos.get(missionPhotoKey(missionId))).toEqual({ contentType: 'image/png', data: PNG });
    expect((await commander({ method: 'GET', url })).rawPayload.equals(PNG)).toBe(true);
  });
});
