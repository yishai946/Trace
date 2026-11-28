import { size, stroke } from '@trace/design';
import Svg, { Circle } from 'react-native-svg';

/** The TRACE mark of Fm01: a ring around a dot. Decorative; the name next to it says what it is. */
export function TraceMark({ color }: { color: string }) {
  return (
    <Svg
      width={size.brandMark}
      height={size.brandMark}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke.strokeStrong}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </Svg>
  );
}
