import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportLocation } from '.';
import { ltr } from '../../i18n/rtl';
import { ThemeProvider } from '../../theme';

const fix = { position: [35.0139, 31.7412] as [number, number], accuracy: 6, at: Date.UTC(2026, 9, 3, 13, 58) };

describe('ReportLocation', () => {
  it('shows the coordinates left to right with the time, and the polygon', () => {
    render(<ReportLocation state="ready" fix={fix} polygonName="פוליגון A" />, { wrapper: ThemeProvider });
    expect(screen.getByText('מיקום ושעה אוטומטיים')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ltr('31.7412, 35.0139')))).toBeInTheDocument();
    expect(screen.getByText('פוליגון A')).toBeInTheDocument();
  });

  it('says it is locating', () => {
    render(<ReportLocation state="locating" fix={null} polygonName={null} />, { wrapper: ThemeProvider });
    expect(screen.getByText('מאתר מיקום…')).toBeInTheDocument();
  });

  it('says there is no GPS and what to do', () => {
    render(<ReportLocation state="unavailable" fix={null} polygonName={null} />, { wrapper: ThemeProvider });
    expect(screen.getByText('אין מיקום GPS. הפעל את שירותי המיקום בטלפון כדי לשלוח.')).toBeInTheDocument();
  });
});
