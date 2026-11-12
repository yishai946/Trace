import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportPhoto } from '.';
import { ThemeProvider } from '../../theme';

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  request: vi.fn(),
  permission: { granted: false, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null,
  take: vi.fn(),
}));
vi.mock('expo-image-picker', () => ({
  useCameraPermissions: () => [mocks.permission, mocks.request],
  launchCameraAsync: mocks.launch,
}));
vi.mock('../../reports/photo', () => ({ takeReportPhoto: mocks.take }));

beforeEach(() => {
  mocks.permission = { granted: true, canAskAgain: true };
  mocks.request.mockReset();
  mocks.take.mockReset();
  mocks.launch.mockReset();
});

const photo = { uri: 'file:///small.jpg', base64: 'QUJD' };

describe('ReportPhoto', () => {
  it('offers an optional photo', () => {
    render(<ReportPhoto photo={null} onChange={() => {}} />, { wrapper: ThemeProvider });
    const button = screen.getByRole('button', { name: 'צרף תמונה' });
    expect(button).toHaveTextContent('אופציונלי');
  });

  it('takes the photo when the camera is allowed', async () => {
    mocks.take.mockResolvedValue(photo);
    const onChange = vi.fn();
    render(<ReportPhoto photo={null} onChange={onChange} />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('button', { name: 'צרף תמונה' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(photo));
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('asks for the permission first, and takes the photo once it is given', async () => {
    mocks.permission = { granted: false, canAskAgain: true };
    mocks.request.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.take.mockResolvedValue(photo);
    const onChange = vi.fn();
    render(<ReportPhoto photo={null} onChange={onChange} />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('button', { name: 'צרף תמונה' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(photo));
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it('without the camera permission, and no way to ask again, says the report can go without a photo', () => {
    mocks.permission = { granted: false, canAskAgain: false };
    render(<ReportPhoto photo={null} onChange={() => {}} />, { wrapper: ThemeProvider });

    expect(screen.getByText('אין הרשאה למצלמה. אפשר לשלוח בלי תמונה.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'צרף תמונה' })).toHaveAttribute('aria-disabled', 'true');
    expect(mocks.take).not.toHaveBeenCalled();
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it('says the same when the searcher refuses the permission, and does not open the camera', async () => {
    mocks.permission = { granted: false, canAskAgain: true };
    mocks.request.mockResolvedValue({ granted: false, canAskAgain: true });
    render(<ReportPhoto photo={null} onChange={() => {}} />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('button', { name: 'צרף תמונה' }));
    expect(await screen.findByText('אין הרשאה למצלמה. אפשר לשלוח בלי תמונה.')).toBeInTheDocument();
    expect(mocks.take).not.toHaveBeenCalled();
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it('says so when the camera fails', async () => {
    mocks.take.mockRejectedValue(new Error('camera'));
    render(<ReportPhoto photo={null} onChange={() => {}} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('button', { name: 'צרף תמונה' }));
    expect(await screen.findByText('לא ניתן לצלם. אפשר לשלוח בלי תמונה.')).toBeInTheDocument();
  });

  it('shows the attached photo and removes it', () => {
    const onChange = vi.fn();
    render(<ReportPhoto photo={photo} onChange={onChange} />, { wrapper: ThemeProvider });
    expect(screen.getByText('תמונה מצורפת')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'צרף תמונה' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'הסר' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
