import { CONTOUR_WIDTH, FOREFOOT, SOLE, SPLASH, printContours, walk } from '@trace/design';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import { useTheme } from '../../theme';

/** Every sole is drawn in this box (print units): about 190 wide and 380 tall around the origin. */
const BOX = { x: -120, y: -220, w: 240, h: 440 } as const;
const SOLE_HEIGHT = 381;
const HEADING_DEG = 30;
const FOREFOOT_BOX = { w: 240, h: 280 } as const;

export interface SplashProps {
  /** Called once the screen has opened and the splash can be removed. */
  onDone: () => void;
}

/**
 * The launch splash: five soles filled with contour lines appear one after another as if someone walks across the
 * screen, then the last one grows until it covers everything and the app shows underneath. With "reduce motion" the
 * soles show at once and the splash only fades.
 */
export function Splash({ onDone }: SplashProps) {
  const { color } = useTheme().theme;
  const { width, height } = useWindowDimensions();
  const steps = useMemo(() => walk(SPLASH.steps), []);
  const [appear] = useState(() => steps.map(() => new Animated.Value(0)));
  const [open] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  // One print unit in pixels: the trail takes about two thirds of the screen height and fits narrow screens.
  const unit = Math.min(height * 0.17, width * 0.28) / SOLE_HEIGHT;
  const place = (step: { x: number; y: number }) => ({ x: width / 2 + step.x * unit, y: height / 2 + step.y * unit });

  const last = steps[steps.length - 1];
  const lastAt = last ? place(last) : { x: width / 2, y: height / 2 };
  // The forefoot's centre on screen: its offset from the sole's origin, turned with the sole.
  const angle = (HEADING_DEG * Math.PI) / 180;
  const growFrom = {
    x: lastAt.x + (FOREFOOT.cx * Math.cos(angle) - FOREFOOT.cy * Math.sin(angle)) * unit,
    y: lastAt.y + (FOREFOOT.cx * Math.sin(angle) + FOREFOOT.cy * Math.cos(angle)) * unit,
  };
  const coverScale = (Math.hypot(width, height) / (FOREFOOT.radius * unit)) * 1.2;

  useEffect(() => {
    let cancelled = false;
    let running: Animated.CompositeAnimation | undefined;
    const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      running = reduceMotion
        ? Animated.sequence([
            Animated.parallel(appear.map((value) => timing(value, 1, 0))),
            Animated.delay(SPLASH.holdMs * 2),
            timing(fade, 0, SPLASH.fadeMs),
          ])
        : Animated.sequence([
            Animated.stagger(
              SPLASH.stepMs,
              appear.map((value) => timing(value, 1, SPLASH.fadeMs)),
            ),
            Animated.delay(SPLASH.holdMs),
            timing(open, 1, SPLASH.openMs, Easing.bezier(0.7, 0, 0.3, 1)),
            timing(fade, 0, SPLASH.fadeMs / 2),
          ]);
      running.start(({ finished }) => {
        if (finished) onDone();
      });
    });

    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [appear, open, fade, onDone]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="TRACE"
      style={[StyleSheet.absoluteFill, { backgroundColor: color.surfaceSunken, opacity: fade }]}
    >
      {steps.map((step, i) => {
        const at = place(step);
        return (
          <Animated.View
            key={i}
            style={[
              styles.print,
              {
                left: at.x - (BOX.w * unit) / 2,
                top: at.y - (BOX.h * unit) / 2,
                width: BOX.w * unit,
                height: BOX.h * unit,
                opacity: appear[i],
                transform: [
                  { rotate: `${step.rotate}deg` },
                  { scale: appear[i]?.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) ?? 1 },
                ],
              },
            ]}
          >
            <Sole
              index={i}
              ink={color.ink}
              line={color.surfaceSunken}
              peak={i === steps.length - 1 ? color.warning : null}
            />
          </Animated.View>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.print,
          {
            left: growFrom.x - (FOREFOOT_BOX.w * unit) / 2,
            top: growFrom.y - (FOREFOOT_BOX.h * unit) / 2,
            width: FOREFOOT_BOX.w * unit,
            height: FOREFOOT_BOX.h * unit,
            // Hidden until the screen opens, then the last forefoot turns into the app's own background.
            opacity: open.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] }),
            transform: [
              { rotate: `${HEADING_DEG}deg` },
              { scale: open.interpolate({ inputRange: [0, 1], outputRange: [1, coverScale] }) },
            ],
          },
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`${FOREFOOT.cx - FOREFOOT_BOX.w / 2} ${FOREFOOT.cy - FOREFOOT_BOX.h / 2} ${FOREFOOT_BOX.w} ${FOREFOOT_BOX.h}`}
        >
          <Path d={SOLE.forefoot} fill={color.surface} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

interface SoleProps {
  index: number;
  ink: string;
  line: string;
  /** Colour of the summit; null leaves a hole in the ink like the other steps. */
  peak: string | null;
}

/** One sole: ink with contour lines cut into it. */
function Sole({ index, ink, line, peak }: SoleProps) {
  const { contours, peak: summit } = useMemo(() => printContours(index), [index]);
  const clipId = `sole-${index}`;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}>
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
        <Circle cx={summit.x} cy={summit.y} r={peak ? 16 : 12} fill={peak ?? line} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  print: { position: 'absolute' },
});
