/**
 * components/ui — the v3 foundation library ("Obsidian").
 *
 * Everything visual in v3 builds from these primitives. All color, type,
 * spacing, radii, and motion values come from theme/tokens.ts — no hex
 * literal belongs in any component.
 *
 * Glass rule: GlassView is for floating chrome only, never under body text.
 * Motion rule: springs (damping 18 / stiffness 200), interruptible, only
 * transform/opacity animated, Reduce Motion respected everywhere.
 */
export { EmptyState } from './EmptyState';
export { FAB } from './FAB';
export { GhostButton } from './GhostButton';
export { GlassCard } from './GlassCard';
export { GlassView } from './GlassView';
export { InvertedButton } from './InvertedButton';
export { ProgressRing } from './ProgressRing';
export { Screen } from './Screen';
export { SectionHeader } from './SectionHeader';
export { SegmentedControl } from './SegmentedControl';
export { Sheet } from './Sheet';
export { Skeleton } from './Skeleton';
export { usePressAnimation } from './usePressAnimation';
export type { GlassCapabilities, GlassTier, RingAngles } from './logic';
export { clamp01, resolveGlassTier, ringAngles } from './logic';
