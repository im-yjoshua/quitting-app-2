/**
 * Stats tab (spec §2.5) + Milestones section (spec §2.6).
 *
 * - Hero numbers: money saved (live-ticking), time reclaimed, current
 *   streak, longest streak.
 * - Glass chart card: last 12 weeks as a clean-day heatmap.
 * - Health timeline: per-category recovery windows, achieved vs dimmed.
 * - Milestones timeline: achieved glow (+ share), upcoming dimmed.
 * - Subtle premium upsell card at the bottom → /paywall (Day 5).
 */
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ShareCardSheet } from '../../../components/ShareCardSheet';
import { GlassButton } from '../../../components/glass/GlassButton';
import { GlassCard } from '../../../components/glass/GlassCard';
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
import { colors, radii, spacing, type } from '../../../theme/tokens';

const HEATMAP_COLS = 12;
const CELL_GAP = 3;

function Heatmap({ days, width }: { days: HeatDay[]; width: number }) {
  const cell = (width - CELL_GAP * (HEATMAP_COLS - 1)) / HEATMAP_COLS;
  // 12 week-columns × 7 day-rows (GitHub style).
  const columns: HeatDay[][] = Array.from({ length: HEATMAP_COLS }, () => []);
  days.forEach((d, i) => {
    columns[Math.floor(i / 7)].push(d);
  });
  return (
    <View style={styles.heatRow}>
      {columns.map((col, ci) => (
        <View key={ci} style={[styles.heatCol, { gap: CELL_GAP }]}>
          {col.map((d) => (
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
                      ? colors.accent
                      : d.status === 'slip'
                        ? colors.hairlineStrong
                        : 'transparent',
                  borderWidth: d.status === 'pending' ? 1 : 0,
                  borderColor: colors.hairline,
                  opacity:
                    d.status === 'clean' ? 0.9 : d.status === 'slip' ? 0.6 : 1,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function StatsScreen() {
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

  if (loading || !state?.quit) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Screen>
    );
  }

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

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Stats</Text>

        {/* Hero numbers */}
        <View style={styles.heroGrid}>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroValue}>{formatMoney(moneyLive)}</Text>
            <Text style={styles.heroLabel}>saved</Text>
          </GlassCard>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroValue}>
              {formatTimeReclaimed(reclaimed.hours, reclaimed.minutes)}
            </Text>
            <Text style={styles.heroLabel}>reclaimed</Text>
          </GlassCard>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroValue}>
              {cleanDays.toLocaleString('en-US')}
            </Text>
            <Text style={styles.heroLabel}>
              day{cleanDays === 1 ? '' : 's'} clean
            </Text>
          </GlassCard>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroValue}>
              {quit.longestStreakDays.toLocaleString('en-US')}
            </Text>
            <Text style={styles.heroLabel}>longest streak</Text>
          </GlassCard>
        </View>

        {/* 12-week heatmap */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Last 12 weeks</Text>
          <Text style={styles.cardSub}>Every clean day, at a glance.</Text>
          <Heatmap days={heat} width={width - spacing.lg * 4} />
        </GlassCard>

        {/* Health timeline */}
        <Text style={styles.sectionTitle}>Body recovery</Text>
        <Text style={styles.sectionSub}>
          {achievedHealth} of {timeline.length} unlocked
        </Text>
        <GlassCard style={styles.card}>
          {timeline.map((m, i) => {
            const achieved = cleanMs >= m.atMs;
            const isNext = !achieved && i === achievedHealth;
            return (
              <View
                key={m.label}
                style={[
                  styles.tlRow,
                  i < timeline.length - 1 && styles.tlRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.tlDot,
                    achieved && styles.tlDotOn,
                    isNext && styles.tlDotNext,
                  ]}
                >
                  {achieved && <Text style={styles.tlCheck}>✓</Text>}
                </View>
                <View style={styles.tlText}>
                  <Text
                    style={[
                      styles.tlLabel,
                      !achieved && !isNext && styles.dim,
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text
                    style={[styles.tlDetail, !achieved && !isNext && styles.dim]}
                  >
                    {m.detail}
                  </Text>
                </View>
                {isNext && <Text style={styles.nextTag}>NEXT</Text>}
              </View>
            );
          })}
        </GlassCard>

        {/* Milestones */}
        <Text style={styles.sectionTitle}>Milestones</Text>
        <Text style={styles.sectionSub}>
          Tap a glowing milestone to share it.
        </Text>
        <GlassCard style={styles.card}>
          {MILESTONES.map((m, i) => {
            const achieved = seen.has(m);
            const upcoming = !achieved && m === nextMs;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                disabled={!achieved}
                onPress={() => setShareDays(m)}
                style={[
                  styles.msRow,
                  i < MILESTONES.length - 1 && styles.tlRowBorder,
                  achieved && styles.msRowOn,
                ]}
              >
                <View style={[styles.msBadge, achieved && styles.msBadgeOn]}>
                  <Text
                    style={[
                      styles.msBadgeText,
                      achieved && styles.msBadgeTextOn,
                    ]}
                  >
                    {m}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.msLabel,
                    achieved ? styles.msLabelOn : styles.dim,
                  ]}
                >
                  {m === 365
                    ? 'One full year'
                    : m === 1
                      ? 'First day'
                      : `${m} days`}
                  {upcoming ? ' — next' : ''}
                </Text>
                {achieved && <Text style={styles.msShare}>Share ↗</Text>}
              </Pressable>
            );
          })}
        </GlassCard>

        {/* Premium upsell */}
        {!isPremium && (
          <GlassCard style={styles.upsell}>
            <Text style={styles.upsellTitle}>Go further with Sovereign</Text>
            <Text style={styles.upsellBody}>
              Projections, per-day charts, your full health timeline, voice
              journaling, and premium share-card styles.
            </Text>
            <GlassButton
              title="See plans"
              onPress={() => router.push('/paywall')}
            />
          </GlassCard>
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...type.title, color: colors.text, marginBottom: spacing.md },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroCard: {
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  heroValue: { ...type.headline, color: colors.text },
  heroLabel: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
  card: { marginBottom: spacing.md, padding: spacing.lg },
  cardTitle: { ...type.headline, color: colors.text },
  cardSub: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  heatRow: { flexDirection: 'row', gap: CELL_GAP },
  heatCol: { flex: 1 },
  heatCell: {},
  sectionTitle: {
    ...type.headline,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  sectionSub: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tlRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tlDotOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tlDotNext: { borderColor: colors.accent, borderStyle: 'dashed' },
  tlCheck: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  tlText: { flex: 1 },
  tlLabel: { ...type.callout, color: colors.text },
  tlDetail: { ...type.caption, color: colors.textSecondary },
  nextTag: {
    ...type.micro,
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dim: { color: colors.textTertiary },
  msRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  msRowOn: { backgroundColor: 'rgba(124,108,240,0.07)' },
  msBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  msBadgeOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  msBadgeText: { ...type.callout, color: colors.textTertiary },
  msBadgeTextOn: { color: '#fff', fontWeight: '700' },
  msLabel: { ...type.body, flex: 1 },
  msLabelOn: { color: colors.text, fontWeight: '600' },
  msShare: { ...type.callout, color: colors.accent },
  upsell: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  upsellTitle: { ...type.headline, color: colors.text },
  upsellBody: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
