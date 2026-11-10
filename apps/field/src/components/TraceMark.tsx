import Svg, { Circle } from 'react-native-svg';
import { pendingTokens } from '../theme/pending';

/** The TRACE mark of Fm01: a ring around a dot. Decorative; the name next to it says what it is. */
export function TraceMark({ color }: { color: string }) {
  return (
    <Svg
      width={pendingTokens.brandMark}
      height={pendingTokens.brandMark}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={pendingTokens.brandMarkStroke}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </Svg>
  );
}
