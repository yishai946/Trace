import { encode } from 'uqr';

/** A QR code as an SVG path of its dark modules, with the quiet zone scanners need around it. */
export function encodeQr(value: string): { size: number; path: string } {
  // Medium error correction survives a creased printout or a glare on a screen.
  const { size, data } = encode(value, { ecc: 'M', border: 2 });
  const path = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('');
  return { size, path };
}
