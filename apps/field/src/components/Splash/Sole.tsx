import { CONTOUR_WIDTH, PEAK_RADIUS, PRINT_BOX, SOLE, printContours } from '@trace/design';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

/** One sole: ink with contour lines cut into it. */
export function Sole({ index, ink, line, peak }: SoleProps) {
  const { contours, peak: summit } = useMemo(() => printContours(index), [index]);
  const clipId = `sole-${index}`;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`${PRINT_BOX.x} ${PRINT_BOX.y} ${PRINT_BOX.w} ${PRINT_BOX.h}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={SOLE.forefoot} />
            <Path d={SOLE.heel} />
          </ClipPath>
        </Defs>
        <Path d={SOLE.forefoot} fill={ink} />
        <Path d={SOLE.heel} fill={ink} />
        <G clipPath={`url(#${clipId})`} fill="none" stroke={line} strokeLinejoin="round">
          {contours.map((c, i) => (
            <Path key={i} d={c.d} strokeWidth={c.major ? CONTOUR_WIDTH.major : CONTOUR_WIDTH.minor} />
          ))}
        </G>
        <Circle cx={summit.x} cy={summit.y} r={peak ? PEAK_RADIUS.last : PEAK_RADIUS.hole} fill={peak ?? line} />
      </Svg>
    </View>
  );
}

export interface SoleProps {
  index: number;
  ink: string;
  line: string;
  /** Colour of the summit; null leaves a hole in the ink like the other steps. */
  peak: string | null;
}
