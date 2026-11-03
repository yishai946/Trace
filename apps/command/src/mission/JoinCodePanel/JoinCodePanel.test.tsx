import { joinCodeFromLink } from '@trace/domain';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinCodePanel } from '.';
import { encodeQr } from './encodeQr';

describe('JoinCodePanel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the code, a QR and the join link of the mission', () => {
    render(<JoinCodePanel mission={{ joinCode: 'K7-4Q2', status: 'active' }} onClose={() => {}} />);
    expect(screen.getByLabelText('קוד K7-4Q2')).toHaveTextContent('K7-4Q2');
    expect(screen.getByRole('img', { name: 'קוד QR להצטרפות למסע' })).toBeInTheDocument();
    const link = screen.getByText(/\/j\/K7-4Q2$/);
    // The link leads back to the same mission's code (UC-F02).
    expect(joinCodeFromLink(link.textContent ?? '')).toBe('K7-4Q2');
    expect(screen.getByText('הצטרפות פתוחה')).toBeInTheDocument();
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<JoinCodePanel mission={{ joinCode: 'K7-4Q2', status: 'active' }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'העתק קישור' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/j\/K7-4Q2$/));
    expect(await screen.findByText('הקישור הועתק.')).toBeInTheDocument();
  });

  it('says joining is closed when the mission is not active', () => {
    render(<JoinCodePanel mission={{ joinCode: 'K7-4Q2', status: 'paused' }} onClose={() => {}} />);
    expect(screen.getByText('הצטרפות חסומה')).toBeInTheDocument();
  });
});

describe('encodeQr', () => {
  it('draws a square code whose size grows with the text', () => {
    const short = encodeQr('trace-field://j/K7-4Q2');
    const long = encodeQr(`https://trace.app/j/K7-4Q2?${'x'.repeat(200)}`);
    expect(short.path).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
