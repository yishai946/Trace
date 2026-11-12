import { beforeEach, describe, expect, it, vi } from 'vitest';
import { takeReportPhoto } from '.';

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  resize: vi.fn(),
  render: vi.fn(),
  save: vi.fn(),
  manipulate: vi.fn(),
}));
vi.mock('expo-image-picker', () => ({ launchCameraAsync: mocks.launch }));
vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: mocks.manipulate },
  SaveFormat: { JPEG: 'jpeg' },
}));

beforeEach(() => {
  const context = { resize: mocks.resize, renderAsync: mocks.render };
  mocks.manipulate.mockReset().mockReturnValue(context);
  mocks.resize.mockReset().mockReturnValue(context);
  mocks.render.mockReset().mockResolvedValue({ saveAsync: mocks.save });
  mocks.save.mockReset().mockResolvedValue({ uri: 'file:///small.jpg', base64: 'QUJD' });
  mocks.launch.mockReset();
});

describe('takeReportPhoto', () => {
  it('gives nothing when the searcher cancels', async () => {
    mocks.launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(takeReportPhoto()).resolves.toBeNull();
    expect(mocks.manipulate).not.toHaveBeenCalled();
  });

  it('shrinks the long side to 1600 and encodes a JPEG as base64', async () => {
    mocks.launch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.jpg', width: 4000, height: 3000 }],
    });

    await expect(takeReportPhoto()).resolves.toEqual({ uri: 'file:///small.jpg', base64: 'QUJD' });
    expect(mocks.manipulate).toHaveBeenCalledWith('file:///big.jpg');
    expect(mocks.resize).toHaveBeenCalledWith({ width: 1600 });
    expect(mocks.save).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85, base64: true });
  });

  it('keeps the ratio of a tall photo', async () => {
    mocks.launch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tall.jpg', width: 3000, height: 4000 }],
    });
    await takeReportPhoto();
    expect(mocks.resize).toHaveBeenCalledWith({ width: 1200 });
  });
});
