import { encodeQr } from './encodeQr';
import styles from './JoinCodePanel.module.css';

interface QrCodeProps {
  value: string;
  label: string;
}

/** A QR code drawn as one SVG path, dark on light in both themes so every phone camera reads it. */
export function QrCode({ value, label }: QrCodeProps) {
  const { size, path } = encodeQr(value);
  return (
    <div className={styles.qr} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
        <path d={path} />
      </svg>
    </div>
  );
}
