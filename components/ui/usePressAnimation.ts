/**
 * usePressAnimation — spring press feedback for tappable UI.
 *
 * Scale 0.97 → 1 on the press spring (damping 16 / stiffness 380). Under
 * Reduce Motion there is no movement — the press still registers, it just
 * doesn't travel.
 *
 * The scale drivers are module-level functions (called from press event
 * handlers) because Reanimated shared values are designed-mutable and must
 * not be written from render-phase closures.
 */
import {
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '../../theme/tokens';

/** Drive the press-in scale. Call from onPressIn. */
export function pressInScale(scale: SharedValue<number>, reduceMotion: boolean): void {
  scale.value = reduceMotion ? 1 : withSpring(motion.pressScale, motion.press);
}

/** Drive the press-out scale. Call from onPressOut. */
export function pressOutScale(scale: SharedValue<number>, reduceMotion: boolean): void {
  scale.value = reduceMotion ? 1 : withSpring(1, motion.press);
}

export function usePressAnimation() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, scale, reduceMotion };
}
