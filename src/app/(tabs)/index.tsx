/**
 * Home — v4 Stitch 3-Tier Layout Upgrade.
 *
 * 3-Tier Layout Architecture:
 * - Tier 1: Hero Orb (components/orb) with streak-reactive glow + live tabular clean-time ticker.
 * - Tier 2: Thumb-zone action bar (Pledge Today / Pledged + Urge Surf).
 * - Tier 3: 2-column GlassCard bento grid (Milestone, Money Saved, Urges Defeated, Commitment & Quote).
 *
 * Presentation only: every number comes from services/* + AppState
 * (chronometerEngine, milestones, savings, pledge, urgeSurf logs).
 * services/*, state/* and __tests__/* are untouched.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  AppState as RNAppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccentButton,
  GhostButton,
  GlassCard,
  InvertedButton,
  Screen,
  Sheet,
  Skeleton,
} from '../../../components/ui';
import { Orb } from '../../../components/orb';
import { CelebrationSheet } from '../../../components/CelebrationSheet';
import { PledgeConfirmationSheet } from '../../../components/PledgeConfirmationSheet';
import { ShareCardSheet } from '../../../components/ShareCardSheet';
import {
  breakDownDuration,
  calculateCleanDurationMs,
  getLocalDateKey,
} from '../../../services/chronometerEngine';
import { MILESTONES, nextMilestone } from '../../../services/milestones';
import { hasPledgedToday } from '../../../services/pledge';
import { formatMoney, moneySaved, timeReclaimed } from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { useMilestoneCelebration } from '../../../hooks/useMilestoneCelebration';
import { usePremium } from '../../../hooks/usePremium';
import { useTheme } from '../../../theme/useTheme';
import { radii, spacing, type as typeScale } from '../../../theme/tokens';

/** Small SF-Symbol / Material-Symbol icon (no new native deps). */
function Icon({
  ios,
  android,
  size = 20,
  color,
  weight = 'regular',
}: {
  ios: string;
  android: string;
  size?: number;
  color: string;
  weight?: 'regular' | 'semibold' | 'bold';
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never }}
      tintColor={color}
      weight={weight}
      style={{ width: size, height: size }}
    />
  );
}

/** Loading state: skeletons in the shape of the 3-Tier Home layout. */
function HomeSkeleton() {
  return (
    <View style={styles.skelContent} testID="home-loading">
      <View style={styles.skelHeader}>
        <Skeleton width={96} height={26} radius={6} />
        <View style={styles.skelHeaderRight}>
          <Skeleton width={44} height={44} radius={22} />
          <Skeleton width={32} height={32} radius={16} />
        </View>
      </View>
      <Skeleton width={200} height={200} radius={100} style={styles.skelCenter} />
      <Skeleton width={170} height={34} radius={17} style={styles.skelCenter} />
      <View style={styles.skelThumbRow}>
        <Skeleton width="48%" height={50} radius={radii.pill} />
        <Skeleton width="48%" height={50} radius={radii.pill} />
      </View>
      <Skeleton width="100%" height={118} radius={radii.lg} />
      <View style={styles.skelBentoRow}>
        <Skeleton width="48%" height={110} radius={radii.lg} />
        <Skeleton width="48%" height={110} radius={radii.lg} />
      </View>
    </View>
  );
}

/** Read-only oath sheet behind the pledge card's "View oath" action. */
function OathSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Sheet visible={visible} onClose={onClose} testID="oath-sheet">
      <View style={styles.oathSheet}>
        <Text style={[styles.oathEyebrow, { color: c.accent }]}>
          The Sovereign Oath
        </Text>
        <Text style={[styles.oathQuote, { color: c.text }]}>
          &ldquo;Today, I choose clarity over impulse. I do not negotiate with
          cravings.&rdquo;
        </Text>
        <View style={styles.oathFoot}>
          <View style={[styles.recDot, { backgroundColor: c.success }]} />
          <Text style={[styles.oathNote, { color: c.metadata }]}>
            Recorded on this device.
          </Text>
        </View>
        <GhostButton
          title="Done"
          onPress={onClose}
          style={styles.oathDone}
          testID="oath-done"
        />
      </View>
    </Sheet>
  );
}

export default function HomeScreen() {
  const { state, loading, pledgeNow } = useAppState();
  const theme = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [oathOpen, setOathOpen] = useState(false);
  // Pledge confirmation sheet: opens right after a pledge counts.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRecordedAt, setConfirmRecordedAt] = useState(() => Date.now());
  const celebration = useMilestoneCelebration();
  const { isPremium } = usePremium();

  // 1s live tick, paused while backgrounded. Numbers change, nothing
  // animates on tick.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => setNowMs(Date.now()), 1000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNowMs(Date.now());
        start();
      } else {
        stop();
      }
    });
    start();
    return () => {
      stop();
      sub.remove();
    };
  }, []);

  // Route guard: no quit = onboarding not complete.
  useEffect(() => {
    if (!loading && state && !state.quit) {
      router.replace('/onboarding');
    }
  }, [loading, state]);

  const orbSize = Math.min(width * 0.52, 200);

  if (loading || !state) {
    return (
      <Screen>
        <HomeSkeleton />
      </Screen>
    );
  }
  const quit = state.quit;
  if (!quit) return null; // redirecting to onboarding

  const cleanMs = calculateCleanDurationMs(nowMs, Date.parse(quit.startDate));
  const bd = breakDownDuration(cleanMs);
  const days = bd.days;

  const pledged = hasPledgedToday(state.pledge, nowMs);
  const pledgeStreak = state.pledge.pledgeStreak;

  // Next milestone: progress measured from the previous milestone so the
  // bar fills between them ("13 days to 60 days" at day 47).
  const next = nextMilestone(days);
  const prev = [...MILESTONES].reverse().find((m) => m <= days) ?? 0;
  const milestoneProgress =
    next === null ? 1 : Math.min(1, Math.max(0, (days - prev) / (next - prev)));
  const milestonePct = Math.round(milestoneProgress * 100);

  const saved = moneySaved(quit.dailyCost, days);
  const perDay = formatMoney(quit.dailyCost);

  // Urges defeated = completed urge-surf sessions (the service only stores
  // completed ones).
  const todayKey = getLocalDateKey(nowMs);
  const urgesTotal = state.urgeSurfs.length;
  const urgesToday = state.urgeSurfs.filter((iso) => {
    const ms = Date.parse(iso);
    return !isNaN(ms) && getLocalDateKey(ms) === todayKey;
  }).length;

  const handlePledge = async () => {
    const counted = await pledgeNow();
    if (counted) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmRecordedAt(Date.now());
      setConfirmOpen(true);
    }
  };

  return (
    <View style={styles.root} testID="home-root">
      <Screen>
        {/* Fixed header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Home</Text>
          <View style={styles.headerRight}>
            {/* Decorative in the reference; there is no notification inbox
                anywhere in the product, so it is not a button. */}
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
              testID="home-avatar"
            >
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Icon ios="person.fill" android="person" size={18} color={c.onAccent} />
              </View>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ==============================================================
              TIER 1: HERO ORB + CLEAN TIME TICKER
              ============================================================== */}
          <View style={styles.tier1Hero}>
            <Orb cleanDays={days} size={orbSize} testID="home-orb" />

            {/* Live timer pill directly below Orb */}
            <View
              style={styles.timerBlock}
              accessibilityRole="timer"
              accessibilityLabel={`Clean time right now: ${days} days, ${bd.hours} hours, ${bd.minutes} minutes, ${bd.seconds} seconds`}
              testID="home-ticker"
            >
              <View style={[styles.timerPill, { backgroundColor: c.surfaceDeep }]}>
                <Icon ios="clock" android="schedule" size={14} color={c.accent} />
                <Text
                  style={[styles.timerTime, { color: c.text, ...typeScale.tabular }]}
                >
                  {bd.formattedHours}:{bd.formattedMinutes}:{bd.formattedSeconds}
                </Text>
              </View>
              <Text style={[styles.timerLabel, { color: c.metadata }]}>
                CLEAN TIME RIGHT NOW
              </Text>
            </View>
          </View>

          {/* ==============================================================
              TIER 2: THUMB-ZONE ACTION BUTTONS
              ============================================================== */}
          <View style={styles.tier2ThumbZone}>
            {pledged ? (
              <Pressable
                onPress={() => setOathOpen(true)}
                style={({ pressed }) => [
                  styles.thumbPledgedBtn,
                  {
                    backgroundColor: c.accentSoft,
                    borderColor: c.accent,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Pledged today. ${pledgeStreak}-day consecutive commitment. Tap to view oath.`}
                testID="view-oath"
              >
                <Icon
                  ios="checkmark.seal.fill"
                  android="verified"
                  size={18}
                  color={c.accent}
                />
                <Text style={[styles.thumbPledgedText, { color: c.accent }]}>
                  Pledged ({pledgeStreak}d)
                </Text>
              </Pressable>
            ) : (
              <View style={styles.thumbBtnWrap}>
                <AccentButton
                  title="Pledge Today"
                  onPress={handlePledge}
                  testID="pledge-button"
                  style={styles.thumbBtn}
                />
              </View>
            )}

            <View style={styles.thumbBtnWrap}>
              <InvertedButton
                title="Urge Surf"
                onPress={() => router.push('/urge-surf')}
                testID="urge-fab"
                style={styles.thumbBtn}
              />
            </View>
          </View>

          {/* ==============================================================
              TIER 3: 2-COLUMN GLASSCARD BENTO GRID
              ============================================================== */}
          <View style={styles.tier3Bento}>
            {/* Bento Item 1: Next Milestone (Full Width) */}
            <GlassCard style={styles.bentoCard} testID="milestone-block">
              <View style={styles.milestoneHead}>
                <View style={styles.milestoneLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: c.surfaceDeep }]}>
                    <Icon ios="trophy.fill" android="military_tech" size={16} color={c.accent} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: c.text }]}>
                      {next !== null ? `Milestone: ${next} Days` : 'Milestones'}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.metadata }]}>
                      Next recovery milestone
                    </Text>
                  </View>
                </View>
                {next !== null && (
                  <View style={styles.milestoneRight}>
                    <Text
                      style={[styles.milestonePct, { color: c.accent, ...typeScale.tabular }]}
                    >
                      {milestonePct}%
                    </Text>
                    <Text
                      style={[styles.milestoneDaysLeft, { color: c.metadata }]}
                      accessibilityLabel={`${next - days} days left to the ${next}-day milestone`}
                    >
                      {next - days} days left
                    </Text>
                  </View>
                )}
              </View>

              {next !== null ? (
                <View
                  style={[styles.barTrack, { backgroundColor: c.surfaceDeep }]}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ now: milestonePct, min: 0, max: 100 }}
                  accessibilityLabel={`Progress to the ${next}-day milestone: ${milestonePct} percent`}
                >
                  <View
                    style={[styles.barFillWrap, { width: `${milestoneProgress * 100}%` }]}
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                  >
                    <LinearGradient
                      colors={[c.accentDeep, c.accent, c.success]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.barFill}
                    />
                  </View>
                </View>
              ) : (
                <Text style={[styles.milestoneDone, { color: c.text }]}>
                  Every milestone reached.
                </Text>
              )}
            </GlassCard>

            {/* Bento Row: 2-Column Split (Money Saved + Urges Defeated) */}
            <View style={styles.bentoRow}>
              {/* Bento Item 2: Money Saved */}
              <GlassCard style={styles.bentoCol}>
                <View style={styles.statHead}>
                  <Text style={[styles.statLabel, { color: c.metadata }]}>
                    Money Saved
                  </Text>
                  <View style={[styles.iconCircleSm, { backgroundColor: c.surfaceDeep }]}>
                    <Icon ios="dollarsign.circle" android="payments" size={14} color={c.success} />
                  </View>
                </View>
                <Text
                  style={[styles.statValue, { color: c.text, ...typeScale.tabular }]}
                  accessibilityLabel={`Money saved: ${formatMoney(saved)}`}
                >
                  {formatMoney(saved)}
                </Text>
                <View style={styles.statFoot}>
                  <Icon ios="arrow.up.right" android="trending_up" size={11} color={c.success} weight="semibold" />
                  <Text
                    style={[styles.statDelta, { color: c.success, ...typeScale.tabular }]}
                  >
                    +{perDay}/day
                  </Text>
                </View>
              </GlassCard>

              {/* Bento Item 3: Urges Defeated */}
              <GlassCard style={styles.bentoCol}>
                <View style={styles.statHead}>
                  <Text style={[styles.statLabel, { color: c.metadata }]}>
                    Urges Defeated
                  </Text>
                  <View style={[styles.iconCircleSm, { backgroundColor: c.surfaceDeep }]}>
                    <Icon ios="shield.fill" android="shield" size={14} color={c.accent} />
                  </View>
                </View>
                <Text
                  style={[styles.statValue, { color: c.text, ...typeScale.tabular }]}
                  accessibilityLabel={`Urges defeated: ${urgesTotal}`}
                >
                  {urgesTotal}
                </Text>
                <View style={styles.statFoot}>
                  <View style={[styles.dot, { backgroundColor: c.accent }]} />
                  <Text style={[styles.statSub2, { color: c.metadata }]}>
                    {urgesToday} today
                  </Text>
                </View>
              </GlassCard>
            </View>

            {/* Bento Item 4: Commitment & Wisdom (Full Width) */}
            <GlassCard style={styles.bentoCard} testID="pledge-card">
              <View style={styles.pledgeCardHead}>
                <View style={styles.pledgeHeadLeft}>
                  <Icon
                    ios={pledged ? 'checkmark.seal.fill' : 'circle'}
                    android={pledged ? 'verified' : 'radio_button_unchecked'}
                    size={18}
                    color={pledged ? c.accent : c.metadata}
                  />
                  <View style={styles.pledgeTitleWrap}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>
                      {pledged ? 'Daily Pledge Active' : 'Daily Pledge'}
                    </Text>
                    <Text
                      style={[styles.cardSub, { color: c.metadata }]}
                      testID="pledge-status"
                    >
                      {pledged
                        ? `${pledgeStreak}-day consecutive commitment`
                        : 'Renew your commitment for the next 24 hours'}
                    </Text>
                  </View>
                </View>
                {pledged && (
                  <Pressable
                    onPress={() => setOathOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="View your oath"
                    style={[styles.oathLink, { backgroundColor: c.surfaceDeep }]}
                  >
                    <Text style={[styles.oathLinkText, { color: c.accent }]}>Oath</Text>
                    <Icon ios="chevron.right" android="chevron_right" size={12} color={c.accent} />
                  </Pressable>
                )}
              </View>

              <View style={[styles.cardDivider, { backgroundColor: c.hairline }]} />

              <View
                style={styles.quoteRow}
                accessibilityRole="text"
                accessibilityLabel="Quote: Freedom is not the absence of desire, but the mastery of choice."
              >
                <Icon ios="quote.opening" android="format_quote" size={16} color={c.metadata} />
                <Text style={[styles.quoteText, { color: c.metadata }]}>
                  &ldquo;Freedom is not the absence of desire, but the mastery of
                  choice.&rdquo;
                </Text>
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </Screen>

      <OathSheet visible={oathOpen} onClose={() => setOathOpen(false)} />

      <PledgeConfirmationSheet
        visible={confirmOpen}
        pledgeStreak={pledgeStreak}
        pledgeTime={quit.pledgeTime}
        recordedAtMs={confirmRecordedAt}
        onClose={() => setConfirmOpen(false)}
      />

      {celebration.celebration !== null && (
        <CelebrationSheet
          visible
          milestone={celebration.celebration}
          category={quit.category}
          urgesTotal={urgesTotal}
          capitalSaved={saved}
          timeReclaimed={timeReclaimed(quit.dailyMinutes, days)}
          onShare={celebration.openShare}
          onDismiss={celebration.dismissCelebration}
        />
      )}

      {celebration.celebration !== null && (
        <ShareCardSheet
          visible={celebration.shareOpen}
          days={celebration.celebration}
          category={quit.category}
          customName={quit.customName}
          isPremium={isPremium}
          onRequestPremium={() => {
            celebration.closeShare();
            router.push('/paywall');
          }}
          onClose={celebration.closeShare}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    gap: spacing.lg,
  },

  // Skeleton
  skelContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  skelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skelHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skelCenter: { alignSelf: 'center' },
  skelThumbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  skelBentoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  // Header
  header: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHit: {
    width: 44,
    height: 44,
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

  // TIER 1: HERO ORB + CLEAN TIME TICKER
  tier1Hero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    marginTop: -spacing.md,
    gap: 6,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  timerTime: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },

  // TIER 2: THUMB-ZONE ACTION ROW
  tier2ThumbZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbBtnWrap: {
    flex: 1,
  },
  thumbBtn: {
    minHeight: 50,
  },
  thumbPledgedBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  thumbPledgedText: {
    ...typeScale.headline,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },

  // TIER 3: BENTO GRID
  tier3Bento: {
    gap: spacing.md,
  },
  bentoCard: {
    width: '100%',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bentoCol: {
    flex: 1,
  },

  // Milestone inside Bento
  milestoneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  milestoneRight: {
    alignItems: 'flex-end',
  },
  milestonePct: {
    fontSize: 16,
    fontWeight: '700',
  },
  milestoneDaysLeft: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  barFillWrap: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    flex: 1,
  },
  milestoneDone: {
    ...typeScale.subhead,
    marginTop: spacing.xs,
  },

  // Common card elements
  cardTitle: {
    ...typeScale.headline,
  },
  cardSub: {
    ...typeScale.caption,
    marginTop: 2,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },

  // Stat cards in 2-col row
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  statFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  statDelta: {
    fontSize: 11,
    fontWeight: '600',
  },
  statSub2: {
    fontSize: 11,
    fontWeight: '500',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Pledge card in Bento
  pledgeCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pledgeHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  pledgeTitleWrap: {
    flex: 1,
  },
  oathLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  oathLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Quote
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  quoteText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  // Oath Sheet
  oathSheet: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  oathEyebrow: {
    ...typeScale.subhead,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  oathQuote: {
    ...typeScale.title3,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  oathFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  oathNote: {
    ...typeScale.caption,
  },
  oathDone: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
