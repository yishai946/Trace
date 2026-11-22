import { MissionPolygonList } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { clearOfflinePackages, keepOnly, loadPhoto, loadStep, saveStep, savedSteps } from './index';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';

describe('offline store', () => {
  it('starts empty', async () => {
    expect(await savedSteps(A)).toEqual([]);
  });

  it('keeps the steps saved for a mission', async () => {
    await saveStep(A, 'mission', { json: { name: 'x' } });
    await saveStep(A, 'polygons', { json: [] });
    expect((await savedSteps(A)).sort()).toEqual(['mission', 'polygons']);
    expect(await savedSteps(B)).toEqual([]);
  });

  it('reads a saved step back, validated with the given schema', async () => {
    await saveStep(A, 'polygons', { json: [] });
    expect(await loadStep(A, 'polygons', MissionPolygonList)).toEqual([]);
    expect(await loadStep(A, 'mission', MissionPolygonList)).toBeNull();
  });

  it('treats data that no longer fits the schema as missing', async () => {
    await saveStep(A, 'polygons', { json: [{ nope: true }] });
    expect(await loadStep(A, 'polygons', MissionPolygonList)).toBeNull();
  });

  it('keeps a photo as bytes with its content type', async () => {
    await saveStep(A, 'photo', { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' });
    const photo = await loadPhoto(A);
    expect(photo && Array.from(photo.bytes)).toEqual([1, 2, 3]);
    expect(photo?.contentType).toBe('image/jpeg');
  });

  it('marks the photo step saved when the mission has no photo', async () => {
    await saveStep(A, 'photo', {});
    expect(await savedSteps(A)).toEqual(['photo']);
    expect(await loadPhoto(A)).toBeNull();
  });

  it('replaces a step saved again', async () => {
    await saveStep(A, 'mission', { json: { v: 1 } });
    await saveStep(A, 'mission', { json: { v: 2 } });
    expect(await savedSteps(A)).toEqual(['mission']);
  });

  it('keeps only the current mission when the searcher moves to another', async () => {
    await saveStep(A, 'mission', { json: {} });
    await saveStep(B, 'mission', { json: {} });
    await keepOnly(B);
    expect(await savedSteps(A)).toEqual([]);
    expect(await savedSteps(B)).toEqual(['mission']);
  });

  it('forgets every mission on sign-out', async () => {
    await saveStep(A, 'mission', { json: {} });
    await saveStep(B, 'mission', { json: {} });
    await clearOfflinePackages();
    expect(await savedSteps(A)).toEqual([]);
    expect(await savedSteps(B)).toEqual([]);
  });
});
