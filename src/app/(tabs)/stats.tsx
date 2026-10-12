/**
 * Stats tab — v4 Stitch rebuild (Phase 5).
 *
 * Matches Joshua's approved Google Stitch stats reference as closely as
 * native allows:
 * - Header "Stats" + "Your recovery trajectory"; bell + violet avatar.
 * - Segmented control: Week / Month / All time (drives the rhythm chart).
 * - "Clean Rhythm" card: real "{clean}/{active} Days", real "{pct}% PURE"
 *   pill, bar chart from chartData buckets — older bars grey, the newest
 *   quarter ramping violet, today marked with a dot.
 * - "Urge Decay Curve" card: weekly urge-surf frequency from the real
 *   urge-surf logs — violet decay line + gradient wash, real reduction %
 *   (first week vs last week). Never invented: no logs → honest empty
 *   state; no decrease → neutral copy, never a fake percentage.
 * - Money Saved / Hours Reclaimed cards (real, services/savings.ts).
 * - Milestones: our REAL time-based timeline (services/milestones.ts)
 *   with honest per-category copy (HEALTH_TIMELINES) — the reference's
 *   disease claims ("Prefrontal cortex density +14%") are forbidden and
 *   do not appear. Share button per achieved milestone → ShareCardSheet.
 *
 * Presentation only: every number comes from services/* + AppState via
 * chartData.ts / savings.ts / milestones.ts / healthTimeline.ts.
 * services/*, state/* and __tests__/* are untouched.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ShareCardSheet } from '../../../components/ShareCardSheet';
import {
  Screen,
  SegmentedControl,
  Skeleton,
} from '../../../components/ui';
import { buildStatsChart, type StatsBucket, type StatsRange } from '../../lib/chartData';
import { getLocalDateKey, MS_PER_DAY } from '../../../services/chronometerEngine';
import { healthTimelineFor } from '../../../services/healthTimeline';
import { MILESTONES } from '../../../services/milestones';
import {
  cleanDaysFloor,
  formatMoney,
  moneySaved,
  timeReclaimed,
} from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import type { QuitCategory, RelapseEntry } from '../../../types/app';
import { radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

const SEGMENTS = ['Week', 'Month', 'All time'] as const;
const RANGES: StatsRange[] = ['week', 'month', 'all'];
const RHYTHM_HEIGHT = 112;
const DECAY_HEIGHT = 132;
const STAGGER_MS = 60;

/** Small SF-Symbol / Material-Symbol icon (no new native deps). */
function Icon({
  ios,
  android,
  size = 18,
  color,
}: {
  ios: string;
  android: string;
  size?: number;
  color: string;
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never }}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------
// Presentation-side derivations over real state (services/* untouched).
// ---------------------------------------------------------------------------

/** Local day keys covered by the selected range, oldest → newest. */
function dayKeysForRange(
  range: StatsRange,
  startDateIso: string,
  nowMs: number
): string[] {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  if (range === 'all') {
    // Cap at 365 days so very old streaks stay cheap to render.
    const startMs = Date.parse(startDateIso);
    const daysBack = isNaN(startMs)
      ? 365
      : Math.min(
          365,
          Math.max(0, Math.ceil((today.getTime() - startMs) / MS_PER_DAY))
        );
    for (let i = daysBack; i >= 0; i--) {
      keys.push(getLocalDateKey(today.getTime() - i * MS_PER_DAY));
    }
    return keys;
  }
  const n = range === 'week' ? 7 : 28;
  for (let i = n - 1; i >= 0; i--) {
    keys.push(getLocalDateKey(today.getTime() - i * MS_PER_DAY));
  }
  return keys;
}

function slipKeysOf(relapseLog: RelapseEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const e of relapseLog) {
    const ms = Date.parse(e.date);
    if (!isNaN(ms)) keys.add(getLocalDateKey(ms));
  }
  return keys;
}

/** Real clean/active day counts inside the selected window. */
function cleanActiveTotals(
  range: StatsRange,
  startDateIso: string,
  relapseLog: RelapseEntry[],
  nowMs: number
): { clean: number; active: number } {
  const startMs = Date.parse(startDateIso);
  const startKey = isNaN(startMs) ? null : getLocalDateKey(startMs);
  const slips = slipKeysOf(relapseLog);
  let clean = 0;
  let active = 0;
  for (const key of dayKeysForRange(range, startDateIso, nowMs)) {
    if (startKey !== null && key < startKey) continue;
    active += 1;
    if (!slips.has(key)) clean += 1;
  }
  return { clean, active };
}

interface UrgeDecay {
  /** Surf counts per 7-day block since quit, oldest → newest. */
  weekly: number[];
  streakDays: number;
  /** Reduction % first week → last week; null when not computable. */
  reductionPct: number | null;
  /** Real surfs in the trailing 7 days. */
  last7: number;
  total: number;
}

/** Honest urge decay from the real urge-surf logs (ISO timestamps). */
function computeUrgeDecay(
  urgeSurfs: string[],
  startDateIso: string,
  nowMs: number
): UrgeDecay | null {
  const startMs = Date.parse(startDateIso);
  if (isNaN(startMs)) return null;
  const inStreak = urgeSurfs
    .map((iso) => Date.parse(iso))
    .filter((ms) => !isNaN(ms) && ms >= startMs && ms <= nowMs);
  if (inStreak.length === 0) return null;

  const streakDays = Math.max(1, Math.ceil((nowMs - startMs) / MS_PER_DAY));
  const weekCount = Math.max(1, Math.ceil(streakDays / 7));
  const weekly = new Array<number>(weekCount).fill(0);
  for (const ms of inStreak) {
    const w = Math.min(
      weekCount - 1,
      Math.floor((ms - startMs) / (7 * MS_PER_DAY))
    );
    weekly[w] += 1;
  }

  const weekMs = 7 * MS_PER_DAY;
  const early = inStreak.filter((ms) => ms < startMs + weekMs).length;
  const recent = inStreak.filter((ms) => ms >= nowMs - weekMs).length;
  const span = Math.min(7, streakDays);
  const earlyRate = early / span;
  const recentRate = recent / span;
  // A reduction needs a real baseline and a full comparison window.
  const reductionPct =
    streakDays >= 7 && earlyRate > 0
      ? Math.round(((earlyRate - recentRate) / earlyRate) * 100)
      : null;

  return { weekly, streakDays, reductionPct, last7: recent, total: inStreak.length };
}

/** Honest per-category copy for a milestone, or null when none aligns. */
function milestoneDetail(
  category: QuitCategory,
  milestoneDays: number,
  prevMilestoneDays: number
): string | null {
  const lo = prevMilestoneDays * MS_PER_DAY;
  const hi = milestoneDays * MS_PER_DAY;
  const hits = healthTimelineFor(category).filter(
    (h) => h.atMs > lo && h.atMs <= hi
  );
  if (hits.length === 0) return null;
  const h = hits[hits.length - 1];
  return `${h.label} · ${h.detail}`;
}

function milestoneLabel(m: number): string {
  if (m === 1) return 'First day';
  if (m === 365) return 'One full year';
  return `${m} days`;
}

// ---------------------------------------------------------------------------
// Clean Rhythm bar chart
// ---------------------------------------------------------------------------

function RhythmBars({
  buckets,
  clean,
  active,
  theme,
}: {
  buckets: StatsBucket[];
  clean: number;
  active: number;
  theme: Theme;
}) {
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const n = buckets.length;
  // The newest quarter ramps violet (reference's glowing recent streak);
  // older bars stay zinc grey.
  const violetCount = Math.max(1, Math.round(n / 4));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Clean rhythm: ${clean} of ${active} days clean`}
    >
      <View style={[styles.bars, { height: RHYTHM_HEIGHT }]}>
        {buckets.map((b, i) => {
          const isViolet = i >= n - violetCount;
          const ramp = isViolet
            ? 0.45 + (0.55 * (i - (n - violetCount))) / Math.max(1, violetCount - 1)
            : 1;
          const isToday = i === n - 1;
          return (
            <Animated.View
              key={b.key}
              entering={reduceMotion ? undefined : FadeIn.delay(i * STAGGER_MS)}
              style={styles.barCol}
            >
              <View style={styles.barTrack}>
                {b.cleanRatio === null || b.cleanRatio <= 0 ? (
                  <View style={[styles.barStub, { backgroundColor: c.hairline }]} />
                ) : (
                  <View
                    style={[
                      styles.barColumn,
                      { height: `${Math.max(8, b.cleanRatio * 100)}%` as `${number}%` },
                    ]}
                  >
                    {isToday && (
                      <View style={[styles.todayDot, { backgroundColor: c.text }]} />
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          backgroundColor: isViolet ? c.accent : c.hairline,
                          opacity: isViolet ? ramp : 1,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.barLabel,
                  { color: isToday ? c.accent : c.metadata },
                  isToday && styles.barLabelToday,
                ]}
              >
                {b.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Urge Decay curve (violet line + gradient wash, plain Views + expo gradient)
// ---------------------------------------------------------------------------

/** Cosine-interpolated samples between the real weekly points. */
function sampleCurve(weekly: number[], samples: number): number[] {
  const n = weekly.length;
  if (n === 0) return [];
  if (n === 1) return new Array<number>(samples).fill(weekly[0]);
  const out: number[] = [];
  for (let s = 0; s < samples; s++) {
    const t = (s / (samples - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(t));
    const f = t - i;
    const g = (1 - Math.cos(Math.PI * f)) / 2;
    out.push(weekly[i] * (1 - g) + weekly[i + 1] * g);
  }
  return out;
}

function DecayChart({
  decay,
  width,
  theme,
}: {
  decay: UrgeDecay;
  width: number;
  theme: Theme;
}) {
  const c = theme.colors;
  const SAMPLES = 48;
  const pad = 10;
  const values = sampleCurve(decay.weekly, SAMPLES);
  const max = Math.max(1, ...decay.weekly);
  const yOf = (v: number) =>
    DECAY_HEIGHT - pad - (v / max) * (DECAY_HEIGHT - pad * 2);
  const xOf = (s: number) =>
    pad + (s / (SAMPLES - 1)) * (width - pad * 2);

  interface Seg {
    key: string;
    left: number;
    top: number;
    w: number;
    rot: number;
  }
  const segs: Seg[] = [];
  for (let s = 0; s < SAMPLES - 1; s++) {
    const ax = xOf(s);
    const ay = yOf(values[s]);
    const bx = xOf(s + 1);
    const by = yOf(values[s + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const w = Math.hypot(dx, dy);
    if (w < 0.5) continue;
    segs.push({
      key: `${s}`,
      left: (ax + bx) / 2 - w / 2,
      top: (ay + by) / 2 - 1.25,
      w,
      rot: Math.atan2(dy, dx),
    });
  }

  // Dots land on the REAL weekly points (not the interpolated samples).
  const n = decay.weekly.length;
  const dot = (i: number) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2);
    return { x, y: yOf(decay.weekly[i]) };
  };

  const firstLabel = 'Day 1';
  const lastLabel = `Day ${decay.streakDays} (Now: ${decay.weekly[n - 1]})`;
  const midLabel =
    n > 2 ? `Day ${Math.round(((n - 1) / 2) * 7) + 1}` : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        decay.reductionPct !== null && decay.reductionPct > 0
          ? `Urge decay: ${decay.reductionPct} percent fewer urge surfs than the first week, ${decay.total} surfs logged`
          : `Urge surfs per week, ${decay.total} logged`
      }
    >
      <View style={{ width, height: DECAY_HEIGHT }}>
        {/* Area wash: interpolated strips under the curve. */}
        <View style={styles.areaRow}>
          {values.map((v, s) => (
            <View key={s} style={styles.areaStrip}>
              <LinearGradient
                colors={[c.accent, 'transparent']}
                style={[styles.areaFill, { height: DECAY_HEIGHT - yOf(v) }]}
              />
            </View>
          ))}
        </View>
        {/* Subtle guides */}
        <View style={[styles.guide, { top: DECAY_HEIGHT / 3, borderColor: c.hairline }]} />
        <View style={[styles.guide, { top: (2 * DECAY_HEIGHT) / 3, borderColor: c.hairline }]} />
        <View
          style={[
            styles.baseline,
            { top: DECAY_HEIGHT - 1, backgroundColor: c.hairline },
          ]}
        />
        {/* Violet trajectory */}
        {segs.map((s) => (
          <View
            key={s.key}
            style={[
              styles.lineSeg,
              {
                left: s.left,
                top: s.top,
                width: s.w,
                backgroundColor: c.accent,
                transform: [{ rotate: `${s.rot}rad` }],
              },
            ]}
          />
        ))}
        {decay.weekly.map((_, i) => {
          const p = dot(i);
          const isFirst = i === 0;
          const isLast = i === n - 1;
          return (
            <View
              key={i}
              style={[
                styles.decayDot,
                {
                  left: p.x - 4,
                  top: p.y - 4,
                  backgroundColor: isFirst || isLast ? c.text : c.accent,
                  borderColor: c.accent,
                  borderWidth: isLast ? 2 : 0,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: c.metadata }]}>{firstLabel}</Text>
        {midLabel && (
          <Text style={[styles.axisLabel, { color: c.metadata }]}>{midLabel}</Text>
        )}
        <Text style={[styles.axisLabel, styles.axisLabelNow, { color: c.accent }]}>
          {lastLabel}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Milestone rows
// ---------------------------------------------------------------------------

function MilestoneRows({
  cleanDays,
  seen,
  next,
  category,
  onShare,
  theme,
}: {
  cleanDays: number;
  seen: Set<number>;
  next: number | null;
  category: QuitCategory;
  onShare: (days: number) => void;
  theme: Theme;
}) {
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  return (
    <View>
      {MILESTONES.map((m, i) => {
        const achieved = seen.has(m);
        const isNext = !achieved && m === next;
        const prev = i === 0 ? 0 : MILESTONES[i - 1];
        const detail =
          milestoneDetail(category, m, prev) ??
          (m === 1
            ? 'The hardest day, behind you.'
            : `${m} days of choosing yourself.`);
        return (
          <Animated.View
            key={m}
            entering={reduceMotion ? undefined : FadeIn.delay(i * STAGGER_MS)}
          >
            {achieved ? (
              <View
                style={[
                  styles.msRow,
                  { borderBottomColor: c.hairline },
                  i < MILESTONES.length - 1 && styles.msRowBorder,
                ]}
              >
                <View style={[styles.msIcon, { backgroundColor: c.successDim }]}>
                  <Icon ios="checkmark.circle.fill" android="check_circle" size={20} color={c.success} />
                </View>
                <View style={styles.msBody}>
                  <View style={styles.msTitleRow}>
                    <Text style={[styles.msTitle, { color: c.text }]} numberOfLines={1}>
                      {milestoneLabel(m)}
                    </Text>
                    <View style={[styles.pctPill, { backgroundColor: c.successDim }]}>
                      <Text style={[styles.pctPillText, { color: c.success }]}>100%</Text>
                    </View>
                  </View>
                  <Text style={[styles.msDetail, { color: c.metadata }]} numberOfLines={2}>
                    {detail}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Share ${m} day milestone`}
                  onPress={() => onShare(m)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.cardBtn,
                    { backgroundColor: c.surfaceDeep },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon ios="square.and.arrow.up" android="ios_share" size={15} color={c.text} />
                  <Text style={[styles.cardBtnText, { color: c.text }]}>Card</Text>
                </Pressable>
              </View>
            ) : isNext ? (
              <View style={[styles.msRow, styles.msRowBorder, { borderBottomColor: c.hairline }]}>
                <View style={[styles.msIcon, { backgroundColor: c.accentSoft }]}>
                  <Icon ios="trophy.fill" android="military_tech" size={20} color={c.accent} />
                </View>
                <View style={styles.msBody}>
                  <View style={styles.msTitleRow}>
                    <Text style={[styles.msTitle, { color: c.text }]} numberOfLines={1}>
                      {milestoneLabel(m)}
                    </Text>
                    <Text style={[styles.msPct, { color: c.accent }, typeScale.tabular]}>
                      {Math.round((cleanDays / m) * 100)}%
                    </Text>
                  </View>
                  <Text style={[styles.msDetail, { color: c.metadata }]} numberOfLines={1}>
                    {m - cleanDays} days remaining ({m}-day target)
                  </Text>
                  <View style={[styles.msTrack, { backgroundColor: c.hairline }]}>
                    <View
                      style={[
                        styles.msFill,
                        {
                          width: `${Math.min(100, (cleanDays / m) * 100)}%` as `${number}%`,
                          backgroundColor: c.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View
                accessible
                accessibilityLabel={`${milestoneLabel(m)}, locked`}
                style={[styles.msRow, i < MILESTONES.length - 1 && styles.msRowBorder, { borderBottomColor: c.hairline }]}
              >
                <View style={[styles.msIcon, { backgroundColor: c.surfaceDeep }]}>
                  <Icon ios="lock.fill" android="lock" size={18} color={c.muted} />
                </View>
                <View style={styles.msBody}>
                  <Text style={[styles.msTitle, { color: c.muted }]} numberOfLines={1}>
                    {milestoneLabel(m)}
                  </Text>
                  <Text style={[styles.msDetail, { color: c.muted }]} numberOfLines={1}>
                    Reach day {m} to unlock
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

function StatsSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton width="40%" height={40} style={styles.skelTitle} />
      <Skeleton width="100%" height={44} />
      <Skeleton width="100%" height={260} />
      <Skeleton width="100%" height={220} />
      <Skeleton width="100%" height={120} />
    </View>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading } = useAppState();
  const { isPremium } = usePremium();
  const [rangeIndex, setRangeIndex] = useState(1); // Month, like the reference
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [shareDays, setShareDays] = useState<number | null>(null);
  const [rhythmWidth, setRhythmWidth] = useState(0);
  const [decayWidth, setDecayWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  // 1s tick so money-saved feels alive (same source the Home screen uses).
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading || !state) {
    return (
      <Screen>
        <StatsSkeleton />
      </Screen>
    );
  }
  if (!state.quit) return null; // redirecting to onboarding

  const quit = state.quit;
  const range = RANGES[rangeIndex];
  const cleanDays = cleanDaysFloor(quit.startDate, nowMs);
  const { clean, active } = cleanActiveTotals(range, quit.startDate, state.relapseLog, nowMs);
  const purePct = active > 0 ? Math.round((clean / active) * 100) : 0;
  const buckets = buildStatsChart(range, quit.startDate, state.relapseLog, state.journal, nowMs);
  const decay = computeUrgeDecay(state.urgeSurfs, quit.startDate, nowMs);
  // Floored-days savings + today's fractional accrual (same source Home uses).
  const todayFraction =
    ((nowMs - Date.parse(quit.startDate)) % MS_PER_DAY) / MS_PER_DAY;
  const moneyLive =
    moneySaved(quit.dailyCost, cleanDays) +
    Math.max(0, quit.dailyCost) * todayFraction;
  const reclaimed = timeReclaimed(quit.dailyMinutes, cleanDays);
  const reclaimedDays = Math.floor((reclaimed.hours * 60 + reclaimed.minutes) / (24 * 60));
  const seen = new Set(state.milestonesSeen);
  const next = MILESTONES.find((m) => !seen.has(m)) ?? null;
  const achievedCount = MILESTONES.filter((m) => seen.has(m)).length;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: c.text }]}>Stats</Text>
          <Text style={[styles.headerSub, { color: c.metadata }]}>
            Your recovery trajectory
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={styles.bellWrap}
            accessibilityRole="image"
            accessibilityLabel="Notifications"
          >
            <Icon ios="bell" android="notifications" size={20} color={c.metadata} />
          </View>
          <Pressable
            onPress={() => router.push('/you')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={styles.avatarHit}
          >
            <View style={[styles.avatar, { backgroundColor: c.accent }]}>
              <Icon ios="person.fill" android="person" size={18} color={c.onAccent} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentWrap}>
          <SegmentedControl
            segments={[...SEGMENTS]}
            selectedIndex={rangeIndex}
            onChange={setRangeIndex}
            accessibilityLabel="Stats time range"
          />
        </View>

        {/* Clean Rhythm */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.delay(0)}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
          onLayout={(e) => setRhythmWidth(e.nativeEvent.layout.width - spacing.lg * 2)}
        >
          <View style={styles.cardHead}>
            <View>
              <View style={styles.cardEyebrow}>
                <Icon ios="checkmark.seal.fill" android="verified" size={16} color={c.success} />
                <Text style={[styles.cardEyebrowText, { color: c.metadata }]}>
                  Clean Rhythm
                </Text>
              </View>
              <Text style={[styles.cardBig, { color: c.text }, typeScale.tabular]}>
                {clean} / {active} Days
              </Text>
            </View>
            <View style={styles.cardHeadRight}>
              <View style={[styles.purePill, { backgroundColor: c.successDim }]}>
                <Text style={[styles.purePillText, { color: c.success }]}>
                  {purePct}% PURE
                </Text>
              </View>
              <Text style={[styles.streakSub, { color: c.metadata }]}>
                Current: {cleanDays}d streak
              </Text>
            </View>
          </View>
          {rhythmWidth > 0 && (
            <View style={{ width: rhythmWidth }}>
              <RhythmBars buckets={buckets} clean={clean} active={active} theme={theme} />
            </View>
          )}
        </Animated.View>

        {/* Urge Decay Curve */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.delay(STAGGER_MS)}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
          onLayout={(e) => setDecayWidth(e.nativeEvent.layout.width - spacing.lg * 2)}
        >
          <View style={styles.cardHead}>
            <View>
              <View style={styles.cardEyebrow}>
                <Icon ios="chart.line.uptrend.xyaxis" android="show_chart" size={16} color={c.accent} />
                <Text style={[styles.cardEyebrowText, { color: c.metadata }]}>
                  Urge Decay Curve
                </Text>
              </View>
              <Text style={[styles.cardBig, { color: c.text }]}>
                {decay === null
                  ? 'No surfs yet'
                  : decay.reductionPct !== null && decay.reductionPct > 0
                    ? `${decay.reductionPct}% Reduction`
                    : 'Still tracking'}
              </Text>
            </View>
            {decay !== null && (
              <View style={[styles.basePill, { backgroundColor: c.successDim }]}>
                <Icon ios="arrow.down" android="arrow_downward" size={14} color={c.success} />
                <Text style={[styles.basePillText, { color: c.success }, typeScale.tabular]}>
                  {decay.last7} / 7d
                </Text>
              </View>
            )}
          </View>
          {decay === null ? (
            <Text style={[styles.emptyCopy, { color: c.metadata }]}>
              Surf an urge to start your decay curve — every quiet day is the
              trend.
            </Text>
          ) : (
            decayWidth > 0 && (
              <DecayChart decay={decay} width={decayWidth} theme={theme} />
            )
          )}
        </Animated.View>

        {/* Impact totals */}
        <View style={styles.impactRow}>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.delay(STAGGER_MS * 2)}
            style={[styles.impactCard, { backgroundColor: c.surface, borderColor: c.hairline }]}
          >
            <View style={styles.impactTop}>
              <View style={[styles.impactIcon, { backgroundColor: c.surfaceDeep }]}>
                <Icon ios="dollarsign.circle.fill" android="payments" size={18} color={c.accent} />
              </View>
              <View style={[styles.deltaPill, { backgroundColor: c.successDim }]}>
                <Text style={[styles.deltaPillText, { color: c.success }, typeScale.tabular]}>
                  +{formatMoney(Math.max(0, quit.dailyCost))}/day
                </Text>
              </View>
            </View>
            <Text style={[styles.impactLabel, { color: c.metadata }]}>Money Saved</Text>
            <Text style={[styles.impactValue, { color: c.text }, typeScale.tabular]}>
              {formatMoney(moneyLive)}
            </Text>
            <Text style={[styles.impactSub, { color: c.metadata }]} numberOfLines={1}>
              kept since you quit
            </Text>
          </Animated.View>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.delay(STAGGER_MS * 3)}
            style={[styles.impactCard, { backgroundColor: c.surface, borderColor: c.hairline }]}
          >
            <View style={styles.impactTop}>
              <View style={[styles.impactIcon, { backgroundColor: c.surfaceDeep }]}>
                <Icon ios="timer" android="timelapse" size={18} color={c.success} />
              </View>
              <View style={[styles.deltaPill, { backgroundColor: c.surfaceDeep }]}>
                <Text style={[styles.deltaPillText, { color: c.metadata }, typeScale.tabular]}>
                  {reclaimedDays}d {reclaimed.hours % 24}h
                </Text>
              </View>
            </View>
            <Text style={[styles.impactLabel, { color: c.metadata }]}>Hours Reclaimed</Text>
            <Text style={[styles.impactValue, { color: c.text }, typeScale.tabular]}>
              {reclaimed.hours >= 24
                ? `${reclaimed.hours} hrs`
                : `${reclaimed.hours}h ${reclaimed.minutes}m`}
            </Text>
            <Text style={[styles.impactSub, { color: c.metadata }]} numberOfLines={1}>
              Pure focus restored
            </Text>
          </Animated.View>
        </View>

        {/* Milestones */}
        <View style={styles.msHead}>
          <Text style={[styles.msSectionTitle, { color: c.text }]}>Milestones</Text>
          <Text style={[styles.msSectionSub, { color: c.metadata }]}>
            {achievedCount} of {MILESTONES.length} achieved
          </Text>
        </View>
        <View style={[styles.card, styles.msCard, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <MilestoneRows
            cleanDays={cleanDays}
            seen={seen}
            next={next}
            category={quit.category}
            onShare={(m) => setShareDays(m)}
            theme={theme}
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {shareDays !== null && (
        <ShareCardSheet
          visible
          days={shareDays}
          category={quit.category}
          customName={quit.customName}
          isPremium={isPremium}
          onRequestPremium={() => {
            setShareDays(null);
            router.push('/paywall');
          }}
          onClose={() => setShareDays(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typeScale.title2 },
  headerSub: { ...typeScale.subhead, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  segmentWrap: { marginBottom: spacing.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardHeadRight: { alignItems: 'flex-end' },
  cardEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cardEyebrowText: { ...typeScale.footnote, fontWeight: '500' },
  cardBig: { ...typeScale.title3, marginTop: 2 },
  purePill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  purePillText: { ...typeScale.caption, fontWeight: '700', letterSpacing: 0.5 },
  streakSub: { ...typeScale.caption, marginTop: 4 },
  basePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  basePillText: { ...typeScale.footnote, fontWeight: '600' },
  emptyCopy: { ...typeScale.footnote, lineHeight: 20 },
  // Rhythm bars
  bars: { flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: { flex: 1, width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barColumn: { width: '64%', alignItems: 'center' },
  barStub: { width: '64%', height: 4, borderRadius: 2 },
  todayDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginBottom: 3,
  },
  barLabel: { ...typeScale.caption },
  barLabelToday: { fontWeight: '700' },
  // Decay chart
  areaRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  areaStrip: { flex: 1, justifyContent: 'flex-end' },
  areaFill: { width: '100%' },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  baseline: { position: 'absolute', left: 0, right: 0, height: 1 },
  lineSeg: { position: 'absolute', height: 2.5, borderRadius: 1.25 },
  decayDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  axisLabel: { ...typeScale.caption },
  axisLabelNow: { fontWeight: '600' },
  // Impact cards
  impactRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  impactCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  impactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  impactIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  deltaPillText: { ...typeScale.caption, fontWeight: '600' },
  impactLabel: { ...typeScale.footnote, fontWeight: '500' },
  impactValue: { ...typeScale.title2, marginTop: 2 },
  impactSub: { ...typeScale.caption, marginTop: 2 },
  // Milestones
  msHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  msSectionTitle: { ...typeScale.headline },
  msSectionSub: { ...typeScale.footnote },
  msCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  msRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  msRowBorder: { borderBottomWidth: 1 },
  msIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msBody: { flex: 1, gap: 2 },
  msTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  msTitle: { ...typeScale.headline, flex: 1 },
  msPct: { ...typeScale.headline },
  msDetail: { ...typeScale.footnote },
  pctPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pctPillText: { ...typeScale.caption, fontWeight: '700' },
  msTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  msFill: { height: '100%', borderRadius: 3 },
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  cardBtnText: { ...typeScale.footnote, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  skelTitle: { marginBottom: spacing.md },
});
