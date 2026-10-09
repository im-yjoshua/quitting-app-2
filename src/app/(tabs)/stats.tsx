/**
 * Stats tab — v3 rebuild (plan §3.5).
 *
 * - Native large title "Stats" that collapses on scroll (the title scrolls
 *   away under a sticky nav title — the pattern the v2 screen used, kept
 *   working on iOS and Android).
 * - Glass segmented control: Week / Month / All time.
 * - Monochrome bar chart (clean-day share per bucket) + thin craving-
 *   intensity line, both built from plain Views — no chart library, no
 *   violet in the charts (the Orb is the single color object).
 * - Totals row: money saved (live-ticking, per quit config) · time
 *   reclaimed — same data source the v2 screen used.
 * - Vertical milestones timeline, share button per achieved milestone →
 *   the existing ShareCardSheet contract.
 * - Staggered 60ms fade reveals (plan §12 motion discipline); FadeIn is
 *   opacity-only so it stays Reduce-Motion-safe.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolate,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareCardSheet } from '../../../components/ShareCardSheet';
import { Screen } from '../../../components/ui/Screen';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buildStatsChart, type StatsBucket, type StatsRange } from '../../lib/chartData';
import { MS_PER_DAY } from '../../../services/chronometerEngine';
import { MILESTONES } from '../../../services/milestones';
import {
  formatMoney,
  formatTimeReclaimed,
  timeReclaimed,
} from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import { radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

const SEGMENTS = ['Week', 'Month', 'All time'] as const;
const RANGES: StatsRange[] = ['week', 'month', 'all'];
const CHART_HEIGHT = 168;
const LINE_HEIGHT = 132;
const STAGGER_MS = 60;

function Bars({ buckets, theme }: { buckets: StatsBucket[]; theme: Theme }) {
  const c = theme.colors;
  // Reduce Motion → no stagger: the bars land as one static chart.
  const reduceMotion = useReducedMotion();
  return (
    <View style={[styles.bars, { height: CHART_HEIGHT }]}>
      {buckets.map((b, i) => (
        <Animated.View
          key={b.key}
          entering={reduceMotion ? undefined : FadeIn.delay(i * STAGGER_MS)}
          style={styles.barCol}
        >
          <View style={styles.barTrack}>
            {b.cleanRatio === null || b.cleanRatio <= 0 ? (
              // Stub so empty buckets still read as "no clean days".
              <View
                style={[styles.barStub, { backgroundColor: c.hairline }]}
              />
            ) : (
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(8, b.cleanRatio * 100)}%` as `${number}%`,
                    backgroundColor: c.text,
                  },
                ]}
              />
            )}
          </View>
          <Text style={[styles.barLabel, { color: c.metadata }]}>
            {b.label}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** Thin monochrome craving line from plain Views — no fill, no gradient. */
function CravingLine({
  buckets,
  width,
  theme,
}: {
  buckets: StatsBucket[];
  width: number;
  theme: Theme;
}) {
  const c = theme.colors;
  const n = buckets.length;
  const hasData = buckets.some((b) => b.craving !== null);
  const pad = 12;
  const span = Math.max(1, n - 1);
  const point = (i: number): { x: number; y: number } | null => {
    const v = buckets[i].craving;
    if (v === null || v === undefined) return null;
    const t = Math.min(5, Math.max(1, v));
    return {
      x: pad + (i / span) * (width - pad * 2),
      // 1 → bottom, 5 → top.
      y: LINE_HEIGHT - pad - ((t - 1) / 4) * (LINE_HEIGHT - pad * 2),
    };
  };
  interface LineSegment {
    key: string;
    left: number;
    top: number;
    w: number;
    rot: number;
  }
  const segments: LineSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = point(i);
    const b = point(i + 1);
    if (!a || !b) continue; // gap in the data stays a gap
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const w = Math.hypot(dx, dy);
    segments.push({
      key: `${i}`,
      // Center the segment on the midpoint so the rotate lands its
      // endpoints exactly on the two points.
      left: (a.x + b.x) / 2 - w / 2,
      top: (a.y + b.y) / 2 - 1, // minus half the 2pt segment height
      w,
      rot: Math.atan2(dy, dx),
    });
  }
  return (
    <View style={{ width, height: LINE_HEIGHT }}>
      {/* Baseline */}
      <View
        style={[
          styles.lineBase,
          { top: LINE_HEIGHT - pad, backgroundColor: c.hairline },
        ]}
      />
      {hasData ? (
        <>
          {segments.map((s) => (
            <View
              key={s.key}
              style={[
                styles.lineSeg,
                {
                  left: s.left,
                  top: s.top,
                  width: s.w,
                  backgroundColor: c.text,
                  transform: [{ rotate: `${s.rot}rad` }],
                },
              ]}
            />
          ))}
          {buckets.map((b, i) => {
            const p = point(i);
            return p ? (
              <View
                key={b.key}
                style={[
                  styles.lineDot,
                  {
                    left: p.x - 3,
                    top: p.y - 3,
                    backgroundColor: c.text,
                  },
                ]}
              />
            ) : null;
          })}
        </>
      ) : (
        <Text style={[styles.lineEmpty, { color: c.metadata }]}>
          Log cravings in your journal to see the trend.
        </Text>
      )}
    </View>
  );
}

function StatsSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton width="40%" height={40} style={styles.skelTitle} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={220} />
      <Skeleton width="100%" height={180} />
      <Skeleton width="100%" height={200} />
    </View>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { state, loading } = useAppState();
  const { isPremium } = usePremium();
  const [rangeIndex, setRangeIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [shareDays, setShareDays] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const scrollY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  // 1s tick so money-saved feels alive.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Collapsing large title: the big title scrolls away natively; the
  // compact title cross-fades in over it.
  const stickyTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [48, 96], [0, 1], Extrapolate.CLAMP),
  }));
  const bigTitleStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : interpolate(scrollY.value, [0, 96], [1, 0], Extrapolate.CLAMP),
  }));

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
  const cleanMs = Math.max(0, nowMs - Date.parse(quit.startDate));
  const cleanDays = Math.floor(cleanMs / MS_PER_DAY);
  // Same data source the v2 screen used: fractional-day money tick.
  const moneyLive = Math.max(0, quit.dailyCost) * (cleanMs / MS_PER_DAY);
  const reclaimed = timeReclaimed(quit.dailyMinutes, cleanDays);
  const buckets = buildStatsChart(
    range,
    quit.startDate,
    state.relapseLog,
    state.journal,
    nowMs
  );
  const seen = new Set(state.milestonesSeen);
  const next = MILESTONES.find((m) => !seen.has(m)) ?? null;
  const rangeLabel =
    range === 'week' ? 'day' : range === 'month' ? 'week' : 'month';

  return (
    <Screen>
      {/* Sticky compact title — fades in as the large title scrolls away. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyBar,
          {
            paddingTop: insets.top,
            backgroundColor: c.background,
            borderBottomColor: c.hairline,
          },
          stickyTitleStyle,
        ]}
      >
        <Text style={[styles.stickyTitle, { color: c.text }]}>Stats</Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Animated.Text style={[styles.title, { color: c.text }, bigTitleStyle]}>
          Stats
        </Animated.Text>

        <View style={styles.segmentWrap}>
          <SegmentedControl
            segments={[...SEGMENTS]}
            selectedIndex={rangeIndex}
            onChange={setRangeIndex}
            accessibilityLabel="Stats time range"
          />
        </View>

        {/* Totals — money saved is the hero metric. */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.delay(0)}
          style={[styles.totals, { backgroundColor: c.surface }]}
        >
          <View style={styles.totalCol}>
            <Text
              style={[styles.totalValue, { color: c.text }, typeScale.tabular]}
            >
              {formatMoney(moneyLive)}
            </Text>
            <Text style={[styles.totalLabel, { color: c.metadata }]}>
              MONEY SAVED
            </Text>
          </View>
          <View style={[styles.totalDivider, { backgroundColor: c.hairline }]} />
          <View style={styles.totalCol}>
            <Text
              style={[styles.totalValue, { color: c.text }, typeScale.tabular]}
            >
              {formatTimeReclaimed(reclaimed.hours, reclaimed.minutes)}
            </Text>
            <Text style={[styles.totalLabel, { color: c.metadata }]}>
              TIME RECLAIMED
            </Text>
          </View>
        </Animated.View>

        {/* Clean-days bar chart */}
        <View
          style={[styles.card, { backgroundColor: c.surface }]}
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>Clean days</Text>
          <Text style={[styles.cardSub, { color: c.metadata }]}>
            Share of clean days per {rangeLabel}.
          </Text>
          <Bars key={range} buckets={buckets} theme={theme} />
        </View>

        {/* Craving intensity */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>
            Craving intensity
          </Text>
          <Text style={[styles.cardSub, { color: c.metadata }]}>
            Average rated craving, 1–5.
          </Text>
          {chartWidth > 0 && (
            <CravingLine buckets={buckets} width={chartWidth} theme={theme} />
          )}
        </View>

        {/* Milestones timeline */}
        <SectionHeader title="Milestones" />
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {MILESTONES.map((m, i) => {
            const achieved = seen.has(m);
            const upcoming = !achieved && m === next;
            return (
              <Animated.View
                key={m}
                entering={reduceMotion ? undefined : FadeIn.delay(i * STAGGER_MS)}
                style={[
                  styles.msRow,
                  i < MILESTONES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                ]}
              >
                {/* Badge + label read as one VoiceOver unit; the share
                    button stays its own target. */}
                <View accessible style={styles.msInfo}>
                  <View
                    style={[
                      styles.msBadge,
                      {
                        borderColor: achieved ? c.accent : c.hairline,
                        backgroundColor: achieved ? c.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.msBadgeText,
                        { color: achieved ? c.onAccent : c.metadata },
                      ]}
                    >
                      {m}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.msLabel,
                      { color: achieved || upcoming ? c.text : c.metadata },
                    ]}
                  >
                    {m === 365
                      ? 'One full year'
                      : m === 1
                        ? 'First day'
                        : `${m} days`}
                    {upcoming ? ' · next' : ''}
                  </Text>
                </View>
                {achieved && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${m} day milestone`}
                    onPress={() => setShareDays(m)}
                    hitSlop={12}
                    style={styles.msShareHit}
                  >
                    <SymbolView
                      name="square.and.arrow.up"
                      tintColor={c.accent}
                      style={styles.msShareIcon}
                    />
                  </Pressable>
                )}
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: spacing.xxl }} />
      </Animated.ScrollView>

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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyTitle: { ...typeScale.headline },
  title: { ...typeScale.largeTitle, marginBottom: spacing.md },
  segmentWrap: { marginBottom: spacing.lg },
  totals: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  totalCol: { flex: 1, alignItems: 'center' },
  totalValue: { ...typeScale.headline, fontSize: 22, fontWeight: '700' },
  totalLabel: {
    ...typeScale.footnote,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  totalDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: spacing.md },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typeScale.headline },
  cardSub: { ...typeScale.footnote, marginTop: 2, marginBottom: spacing.md },
  bars: { flexDirection: 'row', alignItems: 'stretch' },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '62%',
    borderRadius: radii.sm,
    minHeight: 8,
  },
  barStub: { width: '62%', height: 4, borderRadius: 2 },
  barLabel: { ...typeScale.footnote },
  lineBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  lineSeg: { position: 'absolute', height: 2, borderRadius: 1 },
  lineDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  lineEmpty: {
    ...typeScale.footnote,
    position: 'absolute',
    left: 0,
    right: 0,
    top: LINE_HEIGHT / 2 - 10,
    textAlign: 'center',
  },
  msRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  msInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  msBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  msBadgeText: { ...typeScale.headline },
  msLabel: { ...typeScale.headline, flex: 1 },
  msShareHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msShareIcon: { width: 22, height: 22 },
  skelTitle: { marginBottom: spacing.md },
});
