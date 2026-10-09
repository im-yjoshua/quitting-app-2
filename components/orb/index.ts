/**
 * components/orb — Orb v2, the emotional core of Sovereign v3.
 *
 * A luminous violet glass sphere: the single intentional color object on a
 * monochrome canvas. Breathing (6s loop, UI thread) and streak-reactive
 * glow; fully static under Reduce Motion.
 */
export { Orb } from './Orb';
export type { OrbGlow } from './logic';
export {
  orbDesaturation,
  orbGlow,
  orbRadiance,
  smoothstep,
} from './logic';
