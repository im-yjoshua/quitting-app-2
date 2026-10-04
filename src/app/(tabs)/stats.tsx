/**
 * Stats tab (spec §2.5) + Milestones section (spec §2.6).
 *
 * - Hero numbers: money saved (live-ticking), time reclaimed, current
 *   streak, longest streak.
 * - 12-week clean-day heatmap, monochrome intensity + accent for today.
 * - Health timeline: per-category recovery windows, achieved vs dimmed.
 * - Milestones timeline: achieved glow (+ share), upcoming dimmed.
 * - Subtle premium upsell card at the bottom → /paywall (Day 5).
 *
 * Monochrome reskin: white tabular numerals, grouped surface blocks,
 * full-brightness type. The heatmap is the one place texture lives —
 * monochrome cells, accent only on today.
 */
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ShareCardSheet } from '../../../components/ShareCardSheet';
import { Skeleton } from '../../../components/Skeleton';
import { GlassButton } from '../../../components/glass/GlassButton';
import { Screen } from '../../../components/glass/Screen';
import { MS_PER_DAY } from '../../../services/chronometerEngine';
import {
  buildCleanHeatmap,
  formatMoney,
  formatTimeReclaimed,
  timeReclaimed,
  type HeatDay,
} from '../../../services/savings';
import { healthTimelineFor } from '../../../services/healthTimeline';
import { MILESTONES } from '../../../services/milestones';
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import { radii, spacing, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

const HEATMAP_COLS = 12;
const CELL_GAP = 3;

function todayKeyLocal(nowMs: number): string {
  const d = new Date(nowMs);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function Heatmap({
  days,
  width,
  theme,
  today,
}: {
  days: HeatDay[];
  width: number;
  theme: Theme;
  today: string;
}) {
  const cell = (width - CELL_GAP * (HEATMAP_COLS - 1)) / HEATMAP_COLS;
  // 12 week-columns × 7 day-rows (GitHub style).
  const columns: HeatDay[][] = Array.from({ length: HEATMAP_COLS }, () => []);
  days.forEach((d, i) => {
    columns[Math.floor(i / 7)].push(d);
  });
  const c = theme.colors;
  return (
    <View style={styles.heatRow}>
      {columns.map((col, ci) => (
        <View key={ci} style={[styles.heatCol, { gap: CELL_GAP }]}>
          {col.map((d) => {
            const isToday = d.key === today;
            return (
              <View
                key={d.key}
                style={[
                  styles.heatCell,
                  {
                    width: cell,
                    height: cell,
                    borderRadius: Math.max(2, cell / 4),
                    backgroundColor:
                      d.status === 'clean'
                        ? isToday
                          ? c.accent
                          : c.text
                        : d.status === 'slip'
                          ? c.hairline
                          : 'transparent',
                    borderWidth: d.status === 'pending' || isToday ? 1 : 0,
                    borderColor: isToday ? c.accent : c.hairline,
                    opacity: d.status === 'clean' && !isToday ? 0.85 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function StatsSkeleton() {
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Skeleton width="40%" height={40} style={styles.skelTitle} />
      <Skeleton width="100%" height={110} />
      <View style={styles.heroGrid}>
        <Skeleton width="31%" height={84} />
        <Skeleton width="31%" height={84} />
        <Skeleton width="31%" height={84} />
      </View>
      <Skeleton width="100%" height={220} />
      <Skeleton width="100%" height={160} />
    </ScrollView>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading } = useAppState();
  const { width } = useWindowDimensions();
  const { isPremium } = usePremium();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [shareDays, setShareDays] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  // 1s tick so money-saved feels alive.
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
  const cleanMs = Math.max(0, nowMs - Date.parse(quit.startDate));
  const cleanDays = Math.floor(cleanMs / MS_PER_DAY);
  const moneyLive = Math.max(0, quit.dailyCost) * (cleanMs / MS_PER_DAY);
  const reclaimed = timeReclaimed(quit.dailyMinutes, cleanDays);
  const heat = buildCleanHeatmap(quit.startDate, state.relapseLog, nowMs);
  const timeline = healthTimelineFor(quit.category);
  const seen = new Set(state.milestonesSeen);
  const achievedHealth = timeline.filter((m) => cleanMs >= m.atMs).length;
  const unseenMilestones = MILESTONES.filter((m) => !seen.has(m));
  const nextMs = unseenMilestones.length > 0 ? unseenMilestones[0] : null;
  const today = todayKeyLocal(nowMs);

  const sectionHeader = (title: string, sub?: string) => (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      {sub ? (
        <Text style={[styles.sectionSub, { color: c.metadata }]}>{sub}</Text>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: c.text }]}>Stats</Text>

        {/* Hero numbers — money saved is the hero metric */}
        <View style={[styles.block, { backgroundColor: c.surface }]}>
          <Text style={[styles.moneyLabel, { color: c.metadata }]}>
            SAVED SO FAR
          </Text>
          <Text
            style={[styles.moneyValue, { color: c.text }, styles.tabular]}
          >
            {formatMoney(moneyLive)}
          </Text>
        </View>
        <View style={styles.heroGrid}>
          {[
            {
              value: formatTimeReclaimed(reclaimed.hours, reclaimed.minutes),
              label: 'reclaimed',
            },
            {
              value: cleanDays.toLocaleString('en-US'),
              label: `day${cleanDays === 1 ? '' : 's'} clean`,
            },
            {
              value: quit.longestStreakDays.toLocaleString('en-US'),
              label: 'longest streak',
            },
          ].map((h) => (
            <View
              key={h.label}
              style={[styles.heroCard, { backgroundColor: c.surface }]}
            >
              <Text
                style={[styles.heroValue, { color: c.text }, styles.tabular]}
              >
                {h.value}
              </Text>
              <Text style={[styles.heroLabel, { color: c.metadata }]}>
                {h.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 12-week heatmap */}
        <View style={[styles.block, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>
            Last 12 weeks
          </Text>
          <Text style={[styles.cardSub, { color: c.metadata }]}>
            Every clean day, at a glance.
          </Text>
          <Heatmap
            days={heat}
            width={width - spacing.lg * 4}
            theme={theme}
            today={today}
          />
          <View style={styles.legend}>
            <Text style={[styles.legendText, { color: c.metadata }]}>
              Less
            </Text>
            <View style={styles.legendSwatches}>
              <View
                style={[
                  styles.legendSwatch,
                  { borderWidth: 1, borderColor: c.hairline },
                ]}
              />
              {[0.35, 0.65, 0.9].map((o) => (
                <View
                  key={o}
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: c.text, opacity: o },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.legendText, { color: c.metadata }]}>
              More
            </Text>
          </View>
        </View>

        {/* Health timeline */}
        {sectionHeader(
          'Body recovery',
          `${achievedHealth} of ${timeline.length} unlocked`
        )}
        <View style={[styles.block, { backgroundColor: c.surface }]}>
          {timeline.map((m, i) => {
            const achieved = cleanMs >= m.atMs;
            const isNext = !achieved && i === achievedHealth;
            return (
              <View
                key={m.label}
                style={[
                  styles.tlRow,
                  i < timeline.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                ]}
              >
                <View
                  style={[
                    styles.tlDot,
                    {
                      borderColor: achieved
                        ? c.accent
                        : isNext
                          ? c.accent
                          : c.hairline,
                      backgroundColor: achieved ? c.accent : 'transparent',
                      ...(isNext && { borderStyle: 'dashed' as const }),
                    },
                  ]}
                >
                  {achieved && (
                    <Text style={[styles.tlCheck, { color: c.onAccent }]}>
                      ✓
                    </Text>
                  )}
                </View>
                <View style={styles.tlText}>
                  <Text
                    style={[
                      styles.tlLabel,
                      { color: achieved || isNext ? c.text : c.metadata },
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text
                    style={[
                      styles.tlDetail,
                      { color: achieved || isNext ? c.text : c.metadata },
                    ]}
                  >
                    {m.detail}
                  </Text>
                </View>
                {isNext && (
                  <Text
                    style={[
                      styles.nextTag,
                      { color: c.accent, borderColor: c.accent },
                    ]}
                  >
                    NEXT
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Milestones */}
        {sectionHeader('Milestones', 'Tap a glowing milestone to share it.')}
        <View style={[styles.block, { backgroundColor: c.surface }]}>
          {MILESTONES.map((m, i) => {
            const achieved = seen.has(m);
            const upcoming = !achieved && m === nextMs;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                disabled={!achieved}
                onPress={() => setShareDays(m)}
                style={({ pressed }) => [
                  styles.msRow,
                  i < MILESTONES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                  achieved && { backgroundColor: c.accentSoft },
                  pressed && achieved && styles.pressed,
                ]}
              >
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
                      achieved && styles.msBadgeTextOn,
                    ]}
                  >
                    {m}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.msLabel,
                    { color: achieved ? c.text : c.metadata },
                    achieved && styles.msLabelOn,
                  ]}
                >
                  {m === 365
                    ? 'One full year'
                    : m === 1
                      ? 'First day'
                      : `${m} days`}
                  {upcoming ? ' — next' : ''}
                </Text>
                {achieved && (
                  <Text style={[styles.msShare, { color: c.accent }]}>
                    Share ↗
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Premium upsell */}
        {!isPremium && (
          <View
            style={[
              styles.block,
              styles.upsell,
              { backgroundColor: c.surface },
            ]}
          >
            <Text style={[styles.upsellTitle, { color: c.text }]}>
              Go further with Sovereign
            </Text>
            <Text style={[styles.upsellBody, { color: c.text }]}>
              Projections, per-day charts, your full health timeline, voice
              journaling, and premium share-card styles.
            </Text>
            <View style={styles.upsellCta}>
              <GlassButton
                title="See plans"
                onPress={() => router.push('/paywall')}
              />
            </View>
          </View>
        )}

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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...type.largeTitle, marginBottom: spacing.md },
  block: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  moneyLabel: {
    ...type.caption,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  moneyValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  heroGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
  },
  heroValue: { ...type.headline },
  heroLabel: { ...type.caption, marginTop: 2, textAlign: 'center' },
  cardTitle: { ...type.headline },
  cardSub: { ...type.caption, marginBottom: spacing.md, marginTop: 2 },
  heatRow: { flexDirection: 'row', gap: CELL_GAP },
  heatCol: { flex: 1 },
  heatCell: {},
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendText: { ...type.caption },
  legendSwatches: { flexDirection: 'row', gap: 3 },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },
  sectionHead: { marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { ...type.title3 },
  sectionSub: { ...type.footnote, marginTop: 2 },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tlCheck: { fontSize: 14, fontWeight: '700' },
  tlText: { flex: 1 },
  tlLabel: { ...type.headline },
  tlDetail: { ...type.subhead, marginTop: 2 },
  nextTag: {
    ...type.caption,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  msRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    minHeight: 56,
  },
  pressed: { opacity: 0.7 },
  msBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  msBadgeText: { ...type.headline },
  msBadgeTextOn: { fontWeight: '700' },
  msLabel: { ...type.body, flex: 1 },
  msLabelOn: { fontWeight: '600' },
  msShare: { ...type.headline },
  upsell: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  upsellTitle: { ...type.title3 },
  upsellBody: {
    ...type.body,
    textAlign: 'center',
  },
  upsellCta: { alignSelf: 'stretch', marginTop: spacing.sm },
  skelTitle: { marginBottom: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
});
