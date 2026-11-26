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
    const [moved] = await rt.ctx.db.select().from(reportPhotos);
    expect(moved?.data).toBeNull();
    expect(await rt.ctx.photos.get(reportPhotoKey(ID, moved?.updatedAt ?? new Date(0)))).toEqual({
      contentType: 'image/jpeg',
      data: JPEG,
    });
    expect((await rt.getPhoto()).rawPayload.equals(JPEG)).toBe(true);
    expect(await movePhotos(rt.ctx.db, rt.ctx.photos)).toBe(0);
  });

  it('replaces an object left over under the same key with the photo in the row', async () => {
    await rt.send();
    const updatedAt = new Date('2026-10-03T10:00:00Z');
    await rt.ctx.db.insert(reportPhotos).values({ reportId: ID, contentType: 'image/jpeg', data: JPEG, updatedAt });
    await rt.ctx.photos.put(reportPhotoKey(ID, updatedAt), { contentType: 'image/png', data: PNG });
    await movePhotos(rt.ctx.db, rt.ctx.photos);
    expect(await rt.ctx.photos.get(reportPhotoKey(ID, updatedAt))).toEqual({ contentType: 'image/jpeg', data: JPEG });
    expect((await rt.getPhoto()).rawPayload.equals(JPEG)).toBe(true);
  });

  it('answers 404 for a photo with neither bytes in its row nor an object in the bucket', async () => {
    await rt.send();
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
    const [moved] = await ctx.db.select().from(missionPhotos);
    expect(await ctx.photos.get(missionPhotoKey(missionId, moved?.updatedAt ?? new Date(0)))).toEqual({
      contentType: 'image/png',
      data: PNG,
    });
    expect((await commander({ method: 'GET', url })).rawPayload.equals(PNG)).toBe(true);
  });
});
