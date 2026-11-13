import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportImage } from '.';
import { useSession } from '../../state/session';
import { ThemeProvider } from '../../theme';

beforeEach(() => useSession.setState({ token: 'tok' }));
afterEach(() => {
  useSession.setState({ token: null });
  vi.unstubAllGlobals();
});

describe('ReportImage', () => {
  it('shows the placeholder when the report has no photo', () => {
    render(<ReportImage url={null} />, { wrapper: ThemeProvider });
    expect(screen.getByText('תמונה')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the photo from the API', () => {
    render(<ReportImage url="/api/missions/m/reports/r/photo?v=1" />, { wrapper: ThemeProvider });
    const image = screen.getByRole('img', { name: 'תמונת הדיווח' });
    expect(image.getAttribute('src') ?? image.innerHTML).toContain('/api/missions/m/reports/r/photo?v=1');
  });

  it('shows the placeholder without a session token', () => {
    useSession.setState({ token: null });
    render(<ReportImage url="/api/x" />, { wrapper: ThemeProvider });
    expect(screen.getByText('תמונה')).toBeInTheDocument();
  });

  it('falls back to the placeholder when the photo does not load', async () => {
    // React Native for web loads a picture through the browser's Image, which here fails at once.
    class FailingImage {
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('Image', FailingImage);
    render(<ReportImage url="/api/x" />, { wrapper: ThemeProvider });
    expect(await screen.findByText('תמונה')).toBeInTheDocument();
  });
});
