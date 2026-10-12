/**
 * Home — v4 Stitch rebuild (Phase 3).
 *
 * Matches Joshua's approved Google Stitch home reference as closely as
 * native allows:
 * - Fixed header: "Home" + decorative bell icon + violet avatar (→ You tab).
 * - Hero: violet ProgressRing with the big day count + "· DAYS CLEAN ·".
 *   The ring fills as the current day completes (honest definition of a
 *   day-count ring); a gentle breathing scale echoes the reference orb
 *   (static under Reduce Motion).
 * - Timer pill: clock icon + live HH:MM:SS in tabular numerals +
 *   "CLEAN TIME RIGHT NOW" (numbers just change — no animation on tick).
 * - Daily Pledge card: "Active" emerald pill + pledged row (check,
 *   "{streak}-day consecutive commitment", "View oath" → oath sheet);
 *   unpledged shows the "I pledge today" action instead.
 * - Milestone card: trophy, real next milestone, % + gradient progress bar
 *   (accentDeep → accent → success, token colors), real days left.
 *   ("Inner Shield tier unlocking" was Stitch fiction — honest subtitle.)
 * - Stat cards: Money Saved (real, +$/day) and Urges Defeated (real
 *   completed urge-surf count + today's count).
 * - Quote card, CRAVE SOS pill + violet waveform FAB → urge-surf.
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccentButton,
  FAB,
  GhostButton,
  ProgressRing,
  Screen,
  Sheet,
  Skeleton,
} from '../../../components/ui';
import { CelebrationSheet } from '../../../components/CelebrationSheet';
import { ShareCardSheet } from '../../../components/ShareCardSheet';
import {
  breakDownDuration,
  calculateCleanDurationMs,
  getLocalDateKey,
  MS_PER_DAY,
} from '../../../services/chronometerEngine';
import { MILESTONES, nextMilestone } from '../../../services/milestones';
import { hasPledgedToday } from '../../../services/pledge';
import { formatMoney, moneySaved } from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { useMilestoneCelebration } from '../../../hooks/useMilestoneCelebration';
import { usePremium } from '../../../hooks/usePremium';
import { useTheme } from '../../../theme/useTheme';
import { motion, radii, spacing, type as typeScale } from '../../../theme/tokens';

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

/** Loading state: skeletons in the shape of the Home layout. */
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
      <Skeleton width={232} height={232} radius={116} style={styles.skelCenter} />
      <Skeleton width={170} height={34} radius={17} style={styles.skelCenter} />
      <Skeleton width="100%" height={148} radius={radii.lg} />
      <Skeleton width="100%" height={118} radius={radii.lg} />
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
  const reduceMotion = useReducedMotion();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [oathOpen, setOathOpen] = useState(false);
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

  // Hero breathing scale (the reference orb breathes). Transform-only;
  // fully static under Reduce Motion.
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      return;
    }
    const half = motion.breathe.periodMs / 2;
    const ease = Easing.inOut(Easing.sin);
    breathe.value = withRepeat(
      withSequence(
        withTiming(motion.breathe.peakScale, { duration: half, easing: ease }),
        withTiming(1, { duration: half, easing: ease })
      ),
      -1,
      false
    );
  }, [reduceMotion, breathe]);
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  // CRAVE SOS dot pulse (opacity-only; static under Reduce Motion).
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
  }, [reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const ringSize = Math.min(width * 0.62, 232);

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
  // The day-count ring fills as the current day completes.
  const dayProgress = cleanMs <= 0 ? 0 : (cleanMs % MS_PER_DAY) / MS_PER_DAY;

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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero ring */}
          <View style={styles.hero}>
            <Animated.View style={breatheStyle}>
              <ProgressRing
                progress={dayProgress}
                size={ringSize}
                stroke={10}
                color={c.accent}
                testID="home-ring"
              >
                <Text
                  style={[styles.dayCount, { color: c.text, ...typeScale.tabular }]}
                  accessibilityRole="header"
                  accessibilityLabel={`${days} days clean`}
                >
                  {days}
                </Text>
                <View style={styles.daysCleanRow}>
                  <View style={[styles.dot, { backgroundColor: c.accent }]} />
                  <Text style={[styles.daysClean, { color: c.metadata }]}>
                    &middot; DAYS CLEAN &middot;
                  </Text>
                  <View style={[styles.dot, { backgroundColor: c.accent }]} />
                </View>
              </ProgressRing>
            </Animated.View>
          </View>

          {/* Live timer pill */}
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

          {/* Daily pledge */}
          <View
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
            testID="pledge-card"
          >
            <View style={styles.pledgeHead}>
              <View style={styles.pledgeTitleRow}>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  Daily Pledge
                </Text>
                {pledged ? (
                  <View style={[styles.activePill, { backgroundColor: c.success }]}>
                    <Text style={[styles.activePillText, { color: c.background }]}>
                      Active
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.pendingPill, { borderColor: c.hairline }]}>
                    <Text style={[styles.pendingPillText, { color: c.metadata }]}>
                      Not pledged
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.badgeCircle, { backgroundColor: c.surfaceDeep }]}>
                <Icon
                  ios="checkmark.seal.fill"
                  android="verified"
                  size={18}
                  color={c.accent}
                />
              </View>
            </View>
            <Text style={[styles.pledgeSub, { color: c.metadata }]}>
              Renew your commitment for the next 24 hours
            </Text>
            {pledged ? (
              <View style={[styles.pledgedRow, { backgroundColor: c.surfaceDeep }]}>
                <View style={styles.pledgedLeft}>
                  <View style={[styles.checkCircle, { backgroundColor: c.accentSoft }]}>
                    <Icon ios="checkmark" android="check" size={15} color={c.accent} weight="semibold" />
                  </View>
                  <View style={styles.pledgedText}>
                    <Text style={[styles.pledgedTitle, { color: c.text }]}>
                      Pledged Today
                    </Text>
                    <Text
                      style={[styles.pledgedSub2, { color: c.metadata }]}
                      accessibilityLabel={`Pledged today. ${pledgeStreak}-day consecutive commitment.`}
                      testID="pledge-status"
                    >
                      {pledgeStreak}-day consecutive commitment
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setOathOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View your oath"
                  style={[styles.oathButton, { backgroundColor: c.surface }]}
                  testID="view-oath"
                >
                  <Text style={[styles.oathButtonText, { color: c.accent }]}>
                    View oath
                  </Text>
                  <Icon ios="chevron.right" android="chevron_right" size={13} color={c.accent} weight="semibold" />
                </Pressable>
              </View>
            ) : (
              <AccentButton
                title="I pledge today"
                onPress={handlePledge}
                style={styles.pledgeCta}
                testID="pledge-button"
              />
            )}
          </View>

          {/* Milestone */}
          <View
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
            testID="milestone-block"
          >
            <View style={styles.milestoneHead}>
              <View style={styles.milestoneLeft}>
                <View style={[styles.trophyBox, { backgroundColor: c.surfaceDeep }]}>
                  <Icon ios="trophy.fill" android="military_tech" size={16} color={c.accent} />
                </View>
                <View>
                  <Text style={[styles.milestoneTitle, { color: c.text }]}>
                    {next !== null ? `Milestone: ${next} Days` : 'Milestones'}
                  </Text>
                  <Text style={[styles.milestoneSub, { color: c.metadata }]}>
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
                {/* Decorative gradient fill; the track above exposes the
                    progressbar role to VoiceOver. */}
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
          </View>

          {/* Stat cards */}
          <View style={styles.statGrid}>
            <View
              style={[
                styles.card,
                styles.statCard,
                { backgroundColor: c.surface, borderColor: c.hairline },
              ]}
            >
              <View style={styles.statHead}>
                <Text style={[styles.statLabel, { color: c.metadata }]}>
                  Money Saved
                </Text>
                <View style={[styles.statIcon, { backgroundColor: c.surfaceDeep }]}>
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
                  +{perDay} / day
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.card,
                styles.statCard,
                { backgroundColor: c.surface, borderColor: c.hairline },
              ]}
            >
              <View style={styles.statHead}>
                <Text style={[styles.statLabel, { color: c.metadata }]}>
                  Urges Defeated
                </Text>
                <View style={[styles.statIcon, { backgroundColor: c.surfaceDeep }]}>
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
                  {urgesToday} today so far
                </Text>
              </View>
            </View>
          </View>

          {/* Quote */}
          <View
            style={[styles.quoteCard, { backgroundColor: c.surfaceDeep }]}
            accessibilityRole="text"
            accessibilityLabel="Quote: Freedom is not the absence of desire, but the mastery of choice."
          >
            <Icon ios="quote.opening" android="format_quote" size={18} color={c.metadata} />
            <Text style={[styles.quoteText, { color: c.metadata }]}>
              &ldquo;Freedom is not the absence of desire, but the mastery of
              choice.&rdquo;
            </Text>
          </View>

          {/* Clearance for the floating SOS cluster */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Screen>

      {/* CRAVE SOS pill + waveform FAB */}
      <View
        style={[styles.sosCluster, { bottom: insets.bottom + spacing.md }]}
        pointerEvents="box-none"
      >
        <View
          style={[styles.sosPill, { backgroundColor: c.surface, borderColor: c.hairline }]}
          accessibilityRole="text"
          accessibilityLabel="Crave SOS — tap the waveform button for urge surf"
        >
          <Animated.View
            style={[styles.sosDot, { backgroundColor: c.danger }, pulseStyle]}
          />
          <Text style={[styles.sosText, { color: c.text }]}>CRAVE SOS</Text>
        </View>
        <FAB
          iosSymbol="waveform"
          androidSymbol="graphic_eq"
          label="Urge surf — ride out a craving"
          onPress={() => router.push('/urge-surf')}
          testID="urge-fab"
        />
      </View>

      <OathSheet visible={oathOpen} onClose={() => setOathOpen(false)} />

      {celebration.celebration !== null && (
        <CelebrationSheet
          visible
          milestone={celebration.celebration}
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
    paddingBottom: spacing.md,
  },
  bottomSpacer: { height: 96 },

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

  // Hero
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  dayCount: {
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 64,
  },
  daysCleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  daysClean: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Timer
  timerBlock: { alignItems: 'center', gap: spacing.xs },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  timerTime: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Cards (shared)
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Pledge
  pledgeHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pledgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pendingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pledgeSub: {
    ...typeScale.caption,
    marginTop: spacing.xs,
  },
  pledgedRow: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pledgedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pledgedText: { flex: 1 },
  pledgedTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  pledgedSub2: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  oathButton: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  oathButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pledgeCta: { marginTop: spacing.md },

  // Milestone
  milestoneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  trophyBox: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  milestoneSub: {
    fontSize: 11,
    marginTop: 2,
  },
  milestoneRight: { alignItems: 'flex-end' },
  milestonePct: {
    fontSize: 12,
    fontWeight: '700',
  },
  milestoneDaysLeft: {
    fontSize: 10,
    marginTop: 2,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: spacing.md,
    padding: 2,
    overflow: 'hidden',
  },
  barFillWrap: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { flex: 1 },
  milestoneDone: {
    ...typeScale.body,
    marginTop: spacing.sm,
  },

  // Stat cards
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDelta: {
    fontSize: 10,
    fontWeight: '500',
  },
  statSub2: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Quote
  quoteCard: {
    borderRadius: radii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quoteText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // SOS cluster
  sosCluster: {
    position: 'absolute',
    right: spacing.md,
    alignItems: 'flex-end',
    gap: 6,
  },
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sosDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sosText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Oath sheet
  oathSheet: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  oathEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  oathQuote: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  oathFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  oathNote: {
    ...typeScale.footnote,
  },
  oathDone: { marginTop: spacing.sm },
});
