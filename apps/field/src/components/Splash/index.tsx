import { FOREFOOT, HEADING, PRINT_BOX, SOLE, SOLE_HEIGHT, SPLASH, walk } from '@trace/design';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Sole } from './Sole';

const BOX = PRINT_BOX;
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
  // A re-render with a new callback (e.g. the theme changes mid-splash) must not restart the animation.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // One print unit in pixels: the trail takes about two thirds of the screen height and fits narrow screens.
  const unit = Math.min(height * 0.17, width * 0.28) / SOLE_HEIGHT;
  const place = (step: { x: number; y: number }) => ({ x: width / 2 + step.x * unit, y: height / 2 + step.y * unit });

  const last = steps[steps.length - 1];
  const lastAt = last ? place(last) : { x: width / 2, y: height / 2 };
  // The forefoot's centre on screen: its offset from the sole's origin, turned with the sole.
  const angle = (HEADING * Math.PI) / 180;
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
        if (finished) done.current();
      });
    });

    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [appear, open, fade]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="TRACE"
      // ltr: the soles are placed with `left`, which forced RTL would mirror, stacking them and walking backwards.
      style={[StyleSheet.absoluteFill, { direction: 'ltr', backgroundColor: color.surfaceSunken, opacity: fade }]}
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
              { rotate: `${HEADING}deg` },
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

const styles = StyleSheet.create({
  print: { position: 'absolute' },
});
