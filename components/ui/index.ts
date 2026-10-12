/**
 * components/ui — the v4 foundation library ("Stitch Obsidian").
 *
 * Everything visual in v4 builds from these primitives. All color, type,
 * spacing, radii, and motion values come from theme/tokens.ts — no hex
 * literal belongs in any component.
 *
 * Stitch rules: near-black #09090b canvas, zinc surface scale, 1px #27272a
 * hairlines (borders over shadows), violet accent #a78bfa / deep #7c3aed,
 * cards at 16–20px radius, pills fully rounded, SF system type.
 * Glass rule: GlassView is for floating chrome only, never under body text.
 * Motion rule: springs (damping 18 / stiffness 200), interruptible, only
 * transform/opacity animated, Reduce Motion respected everywhere.
 */
export { AccentButton } from './AccentButton';
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
