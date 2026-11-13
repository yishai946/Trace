import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { pendingTokens } from '../theme/pending';

/** Line icons drawn in the Trace Wireframes; the design system has no icon library yet. */
const icons = {
  mission: (
    <>
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={18} cy={6} r={2} />
      <Path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
    </>
  ),
  reports: (
    <>
      <Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <Circle cx={12} cy={10} r={2.5} />
    </>
  ),
  messages: <Path d="M4 5h16v11H9l-5 4z" />,
  sos: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v6M12 16h.01" />
    </>
  ),
  more: (
    <>
      <Circle cx={5} cy={12} r={1.2} />
      <Circle cx={12} cy={12} r={1.2} />
      <Circle cx={19} cy={12} r={1.2} />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="m5 12 5 5 9-10" />,
  alert: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v6M12 16h.01" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  camera: (
    <>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <Circle cx={12} cy={13} r={3.5} />
    </>
  ),
  hazard: (
    <>
      <Path d="M12 3l10 18H2z" />
      <Path d="M12 10v5M12 18h.01" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={9} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  flag: <Path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
  wifiOff: <Path d="M2 8a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" />,
  sighting: <Path d="M12 3l9 9-9 9-9-9z" />,
  send: <Path d="m3 11 18-8-8 18-2-8z" />,
} as const;

export type IconName = keyof typeof icons;

/** Decorative: the label next to it, or the button's accessibility label, names the action. */
export function Icon({
  name,
  color,
  large = false,
  size: sizeOverride,
}: {
  name: IconName;
  color: string;
  large?: boolean;
  /** Overrides the 16px and 20px sizes, e.g. the 12px check of a done step. */
  size?: number;
}) {
  const size = sizeOverride ?? (large ? pendingTokens.iconLg : pendingTokens.icon);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'more' ? color : 'none'}
      stroke={color}
      strokeWidth={pendingTokens.iconStroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {icons[name]}
    </Svg>
  );
}
