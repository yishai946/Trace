import Svg, { Circle, Path } from 'react-native-svg';
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
} as const;

export type IconName = keyof typeof icons;

/** Decorative: the label next to it, or the button's accessibility label, names the action. */
export function Icon({ name, color, large = false }: { name: IconName; color: string; large?: boolean }) {
  const size = large ? pendingTokens.iconLg : pendingTokens.icon;
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
