/**
 * Onboarding — v4 Phase 2 (Stitch Obsidian): 4 screens.
 * 1. Welcome (glowing orb + ∞, wordmark, dots, white Continue, privacy line)
 * → 2. Habit select (reference cards, SELECTED pill + violet ring + check,
 *    info card, violet Continue →) → 3. Quit time (chips, date/time drums,
 *    clean-time + recovery-phase card, white Lock In Quit Date →)
 * → 4. Daily pledge (Daily Ritual card, pledge picker, reminder toggle,
 *    oath card, violet Save Commitment Window).
 *
 * Presentation-only rebuild: the completion contract is exactly what
 * services/onboarding.ts and AppStateContext expect — completeOnboarding
 * receives { category, customName, reasons, dailyCost, dailyMinutes,
 * pledgeTime, quitAtMs } with the same quit-type keys, then routes to
 * /(tabs). The v3 QA fix is preserved: the drum-picked quit moment flows
 * through quitAtMs → startDate (never Date.now() at completion).
 * dailyCost/dailyMinutes ride as 0 ("unknown" per the service); reasons
 * ship as a personal default built from the chosen category.
 *
 * Honesty adaptations vs the Stitch reference (plan §3): our real 6 quit
 * categories (the service/test contract) in the reference's card design;
 * "Choose your primary focus." (one quit in MVP); the 3.8× pledge claim
 * dropped; "3-second biometric hold" → "Recorded on this device.";
 * dopamine-receptor copy → our real per-category health-timeline data;
 * "Stage N: Detox" → Stage N of our real milestone sequence; no "Tomorrow"
 * in the quit-date drum (the future is never a valid quit date).
 *
 * Chrome: page dots (top header on pages 2–4, above the CTA on welcome),
 * chevron back, swipeable pages (native paging — 1:1, interruptible,
 * reversible; instant jumps under Reduce Motion). Swipe-forward is gated
 * by the current step's validity and springs back with a light haptic
 * when blocked.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Orb } from '../../components/orb';
import {
  clampQuitMoment,
  defaultReasonForCategory,
  quitDayOptions,
  quitMomentMs,
} from '../../components/onboarding/logic';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { AccentButton } from '../../components/ui/AccentButton';
import { InvertedButton } from '../../components/ui/InvertedButton';
import { Screen } from '../../components/ui/Screen';
import { HEALTH_TIMELINES } from '../../services/healthTimeline';
import {
  DAILY_ENCOURAGEMENT_IDENTIFIER,
  cancelScheduledNotification,
} from '../../services/notifications';
import { useAppState } from '../../state/AppStateContext';
import { radii, spacing, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import {
  QUIT_CATEGORIES,
  QUIT_CATEGORY_LABELS,
  type QuitCategory,
} from '../../types/app';

const PAGE_COUNT = 4;
/** Drum rows are 44pt targets; 5 visible rows like the pledge picker. */
const ROW_H = 44;
const VISIBLE_ROWS = 5;

/** SF symbol name in the v3 object form (typed for both platforms). */
const symbol = (name: string) =>
  ({ ios: name as never, android: name as never });

/** Reference-style card metadata for our real quit categories. */
const CATEGORY_META: Record<QuitCategory, { icon: string; blurb: string }> = {
  smoking: { icon: 'flame.fill', blurb: 'Cigarettes, cigars, rolling tobacco' },
  alcohol: { icon: 'wineglass.fill', blurb: 'Beer, liquor, wine, drinking loops' },
  weed: { icon: 'leaf.fill', blurb: 'Cannabis, edibles, concentrates' },
  porn: { icon: 'eye.slash.fill', blurb: 'Pornography, adult sites and apps' },
  sugar: { icon: 'birthday.cake.fill', blurb: 'Sweets, soda, and junk food' },
  custom: { icon: 'slider.horizontal.3', blurb: 'Gambling, caffeine, or anything else' },
};

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0')
);
const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

type ChipId = 'right-now' | 'earlier-today' | 'yesterday' | 'custom';
const CHIPS: readonly { id: ChipId; label: string }[] = [
  { id: 'right-now', label: 'Right now' },
  { id: 'earlier-today', label: 'Earlier today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'custom', label: 'Custom date' },
];

const PRESET_TIMES = ['07:00', '08:00', '09:30'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 12-hour clock + period → 24-hour clock (quitMomentMs takes 24h). */
function to24h(hour12: number, period: Period): number {
  return (hour12 % 12) + (period === 'PM' ? 12 : 0);
}

/** "08:00" (24h "HH:MM") → "08:00 AM" with a padded 12-hour hour. */
function formatTime12h(time: string): { main: string; suffix: Period } {
  const [h, m] = time.split(':').map(Number);
  const suffix: Period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { main: `${pad2(h12)}:${pad2(m)}`, suffix };
}

function commitmentLabel(time: string): string {
  const h = Number(time.split(':')[0]);
  if (h < 12) return 'Morning kickoff';
  if (h < 17) return 'Afternoon check-in';
  return 'Evening wind-down';
}

/** Reduce Transparency (same pattern as GlassView): washes go solid. */
function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (mounted) setEnabled(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setEnabled
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

/** Page dots — 24×6 violet pill active, 6×6 hairline otherwise. */
function PageDots({ page }: { page: number }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={styles.dots}
      accessibilityRole="none"
      accessibilityLabel={`Step ${page + 1} of ${PAGE_COUNT}`}
    >
      {Array.from({ length: PAGE_COUNT }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === page ? c.accent : c.hairline,
              width: i === page ? 24 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Step 1 — the brand moment: glowing orb with ∞, wordmark, promise. */
function IntroPage({ orbSize }: { orbSize: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.9);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 250 });
      textOpacity.value = withTiming(1, { duration: 250 });
    } else {
      opacity.value = withTiming(1, { duration: 700 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      textOpacity.value = withDelay(250, withTiming(1, { duration: 600 }));
    }
  }, [reduceMotion, opacity, scale, textOpacity]);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <View style={styles.introInner}>
      <Animated.View style={orbStyle}>
        <Orb
          cleanDays={0}
          size={orbSize}
          accessibilityLabel="Sovereign orb"
          centerContent={
            <Text
              style={[
                styles.infinity,
                { color: c.text, fontSize: orbSize * 0.3 },
              ]}
            >
              ∞
            </Text>
          }
        />
      </Animated.View>
      <Animated.View style={[styles.introText, textStyle]}>
        <Text style={[styles.wordmark, { color: c.text }]}>Sovereign</Text>
        <Text style={[styles.promise, { color: c.metadata }]}>
          Quit for good, one day at a time.
        </Text>
      </Animated.View>
    </View>
  );
}

/** One quit-type option: reference card, violet ring + SELECTED pill when on. */
function CategoryRow({
  category,
  selected,
  onSelect,
}: {
  category: QuitCategory;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const reduceTransparency = useReduceTransparency();
  const meta = CATEGORY_META[category];
  const wash = reduceTransparency ? c.surfaceDeep : c.accentSoft;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={QUIT_CATEGORY_LABELS[category]}
      onPress={() => {
        void Haptics.selectionAsync();
        onSelect();
      }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? wash : c.surface,
          borderColor: selected ? c.accent : c.hairline,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.optionTile,
          { backgroundColor: selected ? wash : c.surfaceDeep },
        ]}
      >
        <SymbolView
          name={symbol(meta.icon)}
          tintColor={selected ? c.accent : c.metadata}
          style={styles.optionIcon}
          weight="semibold"
        />
      </View>
      <View style={styles.optionText}>
        <View style={styles.optionNameRow}>
          <Text style={[styles.optionLabel, { color: c.text }]}>
            {QUIT_CATEGORY_LABELS[category]}
          </Text>
          {selected && (
            <View style={[styles.selectedPill, { backgroundColor: wash }]}>
              <Text style={[styles.selectedPillText, { color: c.accent }]}>
                Selected
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.optionBlurb, { color: c.metadata }]}>
          {meta.blurb}
        </Text>
      </View>
      <View
        style={[
          styles.checkCircle,
          selected
            ? { backgroundColor: c.accentDeep, borderColor: c.accentDeep }
            : { borderColor: c.hairline },
        ]}
      >
        {selected && (
          <SymbolView
            name={symbol('checkmark')}
            tintColor={c.onAccent}
            style={styles.checkIcon}
            weight="bold"
          />
        )}
      </View>
    </Pressable>
  );
}

/** Step 2 — what are you quitting? Single-select, our real categories. */
function CategoryPage({
  category,
  onSelect,
  customName,
  onCustomName,
}: {
  category: QuitCategory | null;
  onSelect: (c: QuitCategory) => void;
  customName: string;
  onCustomName: (t: string) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.pageInner}>
      <Text style={[styles.title, { color: c.text }]}>
        What are you quitting?
      </Text>
      <Text style={[styles.sub, { color: c.metadata }]}>
        Choose your primary focus.
      </Text>
      <View
        style={styles.options}
        accessibilityRole="radiogroup"
        accessibilityLabel="Quit options"
      >
        {QUIT_CATEGORIES.map((cat) => (
          <CategoryRow
            key={cat}
            category={cat}
            selected={category === cat}
            onSelect={() => onSelect(cat)}
          />
        ))}
      </View>
      {category === 'custom' && (
        <TextInput
          value={customName}
          onChangeText={onCustomName}
          placeholder="Name it — e.g. energy drinks"
          placeholderTextColor={c.muted}
          autoFocus
          returnKeyType="done"
          maxLength={40}
          accessibilityLabel="Name what you're quitting"
          style={[
            styles.customField,
            {
              backgroundColor: c.surface,
              borderColor: c.hairline,
              color: c.text,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: c.surface, borderColor: c.hairline },
        ]}
      >
        <View style={[styles.infoTile, { backgroundColor: c.surfaceDeep }]}>
          <SymbolView
            name={symbol('checkmark.seal.fill')}
            tintColor={c.success}
            style={styles.infoIcon}
            weight="semibold"
          />
        </View>
        <View style={styles.infoText}>
          <Text style={[styles.infoTitle, { color: c.text }]}>
            Your recovery timeline
          </Text>
          <Text style={[styles.infoBody, { color: c.metadata }]}>
            Personalized milestones and urge-surfing tools unlock next.
          </Text>
        </View>
      </View>
    </View>
  );
}

/** One snap-scrolling drum column (44pt rows, haptic ticks, selection band). */
function DrumColumn({
  label,
  values,
  value,
  onChange,
  columnWidth,
  selectedTone = 'accent',
  pillSelected = false,
  format,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  columnWidth: number;
  /** 'accent' (time drums) or 'plain' (date drum) selected text. */
  selectedTone?: 'accent' | 'plain';
  /** Selected row renders as a violet pill (the AM/PM drum). */
  pillSelected?: boolean;
  /** Display transform for values (the date drum shows "Today, Oct 24"). */
  format?: (value: string) => string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList<string | null>>(null);
  const lastIndex = useRef(values.indexOf(value));

  // nulls pad top/bottom so the first/last value can center.
  const [data] = useState<(string | null)[]>(() => [
    null,
    null,
    ...values,
    null,
    null,
  ]);

  const selectIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    lastIndex.current = clamped;
    // Already there: the drag/momentum end pair fires twice for one flick;
    // the second lands after the re-render with the new value in closure.
    if (values[clamped] === value) return;
    listRef.current?.scrollToIndex({
      index: clamped + 2,
      animated: !reduceMotion,
    });
    void Haptics.selectionAsync();
    onChange(values[clamped]);
  };

  // Chip presets change the value from outside: scroll the drum to match.
  // lastIndex guards against fighting the user's own flick.
  useEffect(() => {
    const idx = values.indexOf(value);
    if (idx >= 0 && idx !== lastIndex.current) {
      lastIndex.current = idx;
      listRef.current?.scrollToIndex({
        index: idx + 2,
        animated: !reduceMotion,
      });
    }
  }, [value, values, reduceMotion]);

  const handleScrollEnd = (offsetY: number) => {
    selectIndex(Math.round(offsetY / ROW_H));
  };

  return (
    <View
      accessibilityLabel={`${label} picker`}
      style={[styles.drumWrap, { width: columnWidth }]}
    >
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, index) => ({
          length: ROW_H,
          offset: ROW_H * index,
          index,
        })}
        initialScrollIndex={values.indexOf(value) + 2}
        snapToInterval={ROW_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          handleScrollEnd(e.nativeEvent.contentOffset.y)
        }
        onScrollEndDrag={(e) => handleScrollEnd(e.nativeEvent.contentOffset.y)}
        renderItem={({ item, index }) => {
          if (item === null) return <View style={styles.drumRow} />;
          const selected = item === value;
          const display = format ? format(item) : item;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label} ${display}`}
              accessibilityState={{ selected }}
              onPress={() => selectIndex(index - 2)}
              style={({ pressed }) => [
                styles.drumRow,
                pressed && styles.pressed,
              ]}
            >
              {pillSelected && selected ? (
                <View
                  style={[
                    styles.periodPill,
                    { backgroundColor: c.accentDeep },
                  ]}
                >
                  <Text
                    style={[
                      styles.drumText,
                      styles.drumTextSelected,
                      { color: c.onAccent },
                    ]}
                  >
                    {display}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.drumText,
                    selected && styles.drumTextSelected,
                    {
                      color: selected
                        ? selectedTone === 'accent'
                          ? c.accent
                          : c.text
                        : c.metadata,
                    },
                  ]}
                >
                  {display}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
      {/* Center selection band — hairlines only, never filled. */}
      <View
        pointerEvents="none"
        style={[styles.band, { borderColor: c.hairline }]}
      />
    </View>
  );
}

/**
 * Step 3 — when did you quit? Chips set drum presets; the drums are the
 * source of truth and feed quitAtMs (the v3 QA fix). The summary card shows
 * live clean-time elapsed plus the recovery stage derived from our real
 * per-category health-timeline milestones (plan §3.3).
 */
function WhenPage({
  active,
  dayOptions,
  dayOffset,
  onDayChange,
  hour12,
  onHour12Change,
  minute,
  onMinuteChange,
  period,
  onPeriodChange,
  chip,
  onChip,
  quitAtMs,
  category,
  baseNowMs,
}: {
  active: boolean;
  dayOptions: { offset: number; label: string }[];
  dayOffset: number;
  onDayChange: (v: number) => void;
  hour12: number;
  onHour12Change: (v: number) => void;
  minute: number;
  onMinuteChange: (v: number) => void;
  period: Period;
  onPeriodChange: (v: Period) => void;
  chip: ChipId;
  onChip: (id: ChipId) => void;
  quitAtMs: number;
  category: QuitCategory;
  baseNowMs: number;
}) {
  const theme = useTheme();
  const c = theme.colors;

  // Live clean-time ticker (display only — quitAtMs stays the source of truth).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedMs = Math.max(0, nowMs - quitAtMs);
  const totalSecs = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  // Recovery stage from REAL data: the Nth health milestone is the stage.
  const timeline = HEALTH_TIMELINES[category];
  const unlockedCount = timeline.filter((ms) => ms.atMs <= elapsedMs).length;
  const stageNo = Math.min(unlockedCount + 1, timeline.length);
  const nextMilestone =
    unlockedCount < timeline.length ? timeline[unlockedCount] : null;
  const stageName = nextMilestone ? nextMilestone.label : 'Complete';

  const elapsedParts: { v: string; u: string; emerald?: boolean }[] = [];
  if (h > 0) elapsedParts.push({ v: String(h), u: 'hrs' });
  if (m > 0 || h > 0) elapsedParts.push({ v: String(m), u: 'mins' });
  elapsedParts.push({ v: `${s}s`, u: '', emerald: true });

  const dateValues = useMemo(
    () => dayOptions.map((o) => String(o.offset)),
    [dayOptions]
  );
  const dateLabel = (offset: number) => {
    const base =
      dayOptions.find((o) => o.offset === offset)?.label ?? '';
    const d = new Date(baseNowMs);
    const dt = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() - offset
    );
    const md = dt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${base}, ${md}`;
  };

  return (
    <View style={styles.pageInner}>
      <Text style={[styles.title, { color: c.text }]}>When did you quit?</Text>
      <Text style={[styles.sub, { color: c.metadata }]}>
        Every second since counts toward your new neural baseline.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CHIPS.map((ch) => {
          const selected = chip === ch.id;
          return (
            <Pressable
              key={ch.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={ch.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onChip(ch.id);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: c.surface,
                  borderColor: selected ? c.accent : c.hairline,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? c.accent : c.metadata },
                  selected && styles.chipTextSelected,
                ]}
              >
                {ch.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.drumCard,
          { backgroundColor: c.surface, borderColor: c.hairline },
        ]}
      >
        <View style={styles.drums}>
          <View style={styles.dateDrum}>
            <DrumColumn
              label="Day"
              values={dateValues}
              value={String(dayOffset)}
              onChange={(v) => onDayChange(Number(v))}
              columnWidth={140}
              selectedTone="plain"
              format={(v) => dateLabel(Number(v))}
            />
          </View>
          <DrumColumn
            label="Hour"
            values={HOURS_12}
            value={String(hour12)}
            onChange={(v) => onHour12Change(Number(v))}
            columnWidth={56}
          />
          <DrumColumn
            label="Minute"
            values={MINUTES_60}
            value={pad2(minute)}
            onChange={(v) => onMinuteChange(Number(v))}
            columnWidth={64}
          />
          <DrumColumn
            label="AM or PM"
            values={[...PERIODS]}
            value={period}
            onChange={(v) => onPeriodChange(v as Period)}
            columnWidth={64}
            pillSelected
          />
        </View>
      </View>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: c.surface, borderColor: c.hairline },
        ]}
        accessible
        accessibilityLabel={`Clean time elapsed: ${h} hours, ${m} minutes, ${s} seconds. Recovery phase: stage ${stageNo}, ${stageName}.`}
      >
        <View style={styles.summaryLeft}>
          <View style={[styles.summaryTile, { backgroundColor: c.surfaceDeep }]}>
            <SymbolView
              name={symbol('timer')}
              tintColor={c.success}
              style={styles.summaryIcon}
              weight="semibold"
            />
            <View
              style={[styles.liveDot, { backgroundColor: c.success }]}
            />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.eyebrow, { color: c.metadata }]}>
              Clean time elapsed
            </Text>
            <Text style={[styles.elapsed, typeScale.tabular, { color: c.text }]}>
              {elapsedParts.map((p, i) => (
                <Text key={i}>
                  <Text style={{ color: p.emerald ? c.success : c.text }}>
                    {p.v}
                  </Text>
                  {p.u ? (
                    <Text style={{ color: c.metadata }}> {p.u} </Text>
                  ) : null}
                </Text>
              ))}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRight}>
          <Text style={[styles.eyebrow, { color: c.metadata }]}>
            Recovery phase
          </Text>
          <Text style={[styles.stage, { color: c.accent }]}>
            Stage {stageNo}: {stageName}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.infoCard,
          { backgroundColor: c.surface, borderColor: c.hairline },
        ]}
      >
        <View style={[styles.infoTile, { backgroundColor: c.surfaceDeep }]}>
          <SymbolView
            name={symbol('brain.head.profile')}
            tintColor={c.metadata}
            style={styles.infoIcon}
            weight="semibold"
          />
        </View>
        <Text style={[styles.infoBody, { color: c.metadata }]}>
          {nextMilestone ? (
            <>
              <Text style={[styles.infoStrong, { color: c.text }]}>
                {nextMilestone.label}
              </Text>
              {` — ${nextMilestone.detail} Your clean-time timer tracks every milestone on your recovery timeline.`}
            </>
          ) : (
            'Every milestone on your recovery timeline is unlocked. You are living the proof.'
          )}
        </Text>
      </View>
    </View>
  );
}

/** Step 4 — the daily pledge: ritual card, picker, reminder, oath. */
function PledgePage({
  pledgeTime,
  onPledgeTime,
  onEdit,
  reminderOn,
  onReminderChange,
}: {
  pledgeTime: string;
  onPledgeTime: (t: string) => void;
  onEdit: () => void;
  reminderOn: boolean;
  onReminderChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const reduceTransparency = useReduceTransparency();
  const wash = reduceTransparency ? c.surfaceDeep : c.accentSoft;
  const { main, suffix } = formatTime12h(pledgeTime);

  return (
    <View style={styles.pageInner}>
      <Text style={[styles.title, { color: c.text }]}>Your daily pledge</Text>
      <Text style={[styles.sub, { color: c.metadata }]}>
        Choose when you renew your commitment every 24 hours. A morning
        pledge starts the day on your terms.
      </Text>

      <View
        style={[
          styles.ritualCard,
          { backgroundColor: c.surface, borderColor: c.hairline },
        ]}
      >
        <View style={styles.ritualTop}>
          <View style={[styles.ritualTile, { backgroundColor: wash }]}>
            <SymbolView
              name={symbol('shield.fill')}
              tintColor={c.accent}
              style={styles.ritualIcon}
              weight="semibold"
            />
          </View>
          <View style={[styles.ritualPill, { backgroundColor: wash }]}>
            <Text style={[styles.ritualPillText, { color: c.accent }]}>
              Daily Ritual
            </Text>
          </View>
          <View style={styles.flexSpacer} />
          <View style={[styles.recDot, { backgroundColor: c.success }]} />
          <Text style={[styles.recommended, { color: c.success }]}>
            Recommended
          </Text>
        </View>

        <Text style={[styles.eyebrow, styles.sectionGap, { color: c.metadata }]}>
          Commitment window
        </Text>
        <View style={styles.timeRow}>
          <Text style={[styles.bigTime, typeScale.tabular, { color: c.text }]}>
            {main}
          </Text>
          <Text style={[styles.ampm, { color: c.accent }]}>{suffix}</Text>
          <View style={styles.flexSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change pledge time, currently ${main} ${suffix}`}
            onPress={() => {
              void Haptics.selectionAsync();
              onEdit();
            }}
            style={({ pressed }) => [
              styles.changeBtn,
              { backgroundColor: c.surfaceDeep },
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={symbol('clock')}
              tintColor={c.accent}
              style={styles.changeIcon}
              weight="semibold"
            />
            <Text style={[styles.changeText, { color: c.text }]}>Change</Text>
          </Pressable>
        </View>
        <Text style={[styles.kickoff, { color: c.metadata }]}>
          {commitmentLabel(pledgeTime)}
        </Text>

        <Text style={[styles.presetsLabel, { color: c.muted }]}>
          Quick presets:
        </Text>
        <View style={styles.presetRow}>
          {PRESET_TIMES.map((t) => {
            const f = formatTime12h(t);
            const selected = pledgeTime === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Pledge at ${f.main} ${f.suffix}`}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onPledgeTime(t);
                }}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: c.surfaceDeep,
                    borderColor: selected ? c.accent : c.hairline,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    typeScale.tabular,
                    { color: selected ? c.accent : c.metadata },
                    selected && styles.presetTextSelected,
                  ]}
                >
                  {f.main} {f.suffix}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: c.hairline }]} />

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: reminderOn }}
          accessibilityLabel="Pledge reminder"
          accessibilityHint="Sends a gentle vibration and prompt at your pledge time"
          onPress={() => {
            void Haptics.selectionAsync();
            onReminderChange(!reminderOn);
          }}
          style={styles.reminderRow}
        >
          <View style={[styles.ritualTile, { backgroundColor: wash }]}>
            <SymbolView
              name={symbol('bell.fill')}
              tintColor={c.accent}
              style={styles.ritualIcon}
              weight="semibold"
            />
          </View>
          <View style={styles.reminderText}>
            <Text style={[styles.reminderTitle, { color: c.text }]}>
              Pledge Reminder
            </Text>
            <Text style={[styles.reminderSub, { color: c.metadata }]}>
              Sends gentle vibration & prompt
            </Text>
          </View>
          <Switch
            value={reminderOn}
            pointerEvents="none"
            trackColor={{ false: c.hairline, true: c.accent }}
            thumbColor={c.onAccent}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.oathCard,
          {
            backgroundColor: c.surface,
            borderColor: c.hairline,
            borderLeftColor: c.accent,
          },
        ]}
      >
        <Text style={[styles.oathGlyph, { color: c.accent }]}>“</Text>
        <Text style={[styles.oathEyebrow, { color: c.accent }]}>
          The Sovereign Oath
        </Text>
        <Text style={[styles.oathQuote, { color: c.text }]}>
          “Today, I choose clarity over impulse. I do not negotiate with
          cravings.”
        </Text>
        <View style={styles.oathFoot}>
          <View style={[styles.recDot, { backgroundColor: c.success }]} />
          <Text style={[styles.oathNote, { color: c.metadata }]}>
            Recorded on this device.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { completeOnboarding, updateSettings } = useAppState();

  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const pagerRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<QuitCategory | null>(null);
  const [customName, setCustomName] = useState('');
  const [pledgeTime, setPledgeTime] = useState('07:00');
  const [reminderOn, setReminderOn] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Quit-moment drums. baseNowMs is the stable "now" for the quit-moment
  // math (no impure calls during render); the "Right now" chip refreshes
  // it so the preset means the moment of the tap, not of screen mount.
  const [baseNowMs, setBaseNowMs] = useState(() => Date.now());
  const [dayOptions] = useState(() => quitDayOptions(Date.now()));
  const [dayOffset, setDayOffset] = useState(0);
  const [hour12, setHour12] = useState(() => {
    const h = new Date().getHours();
    return h % 12 === 0 ? 12 : h % 12;
  });
  const [period, setPeriod] = useState<Period>(() =>
    new Date().getHours() < 12 ? 'AM' : 'PM'
  );
  const [minute, setMinute] = useState(() => new Date().getMinutes());
  const [chip, setChip] = useState<ChipId>('right-now');

  const orbSize = Math.round(Math.min(width, height) * 0.58);

  // Keep the pager on the current page across rotations.
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: pageRef.current * width, animated: false });
  }, [width]);

  const canContinueAt = (p: number) =>
    p === 0 ||
    p === 2 ||
    p === 3 ||
    (p === 1 &&
      category !== null &&
      (category !== 'custom' || customName.trim().length > 0));

  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, next));
    pageRef.current = clamped;
    setPage(clamped);
    pagerRef.current?.scrollTo({ x: clamped * width, animated: !reduceMotion });
  };

  const goBack = () => {
    if (pageRef.current > 0) {
      void Haptics.selectionAsync();
      goToPage(pageRef.current - 1);
    }
  };

  /** Chip presets write the drums; any drum edit returns to "Custom date". */
  const applyChip = (id: ChipId) => {
    if (id !== 'custom') {
      const now = new Date();
      const nowMs = Date.now();
      setBaseNowMs(nowMs);
      setDayOffset(id === 'yesterday' ? 1 : 0);
      const h24 = now.getHours();
      setPeriod(h24 < 12 ? 'AM' : 'PM');
      setHour12(h24 % 12 === 0 ? 12 : h24 % 12);
      setMinute(now.getMinutes());
    }
    setChip(id);
  };

  const drumChanged = <T,>(setter: (v: T) => void) => (v: T) => {
    setChip('custom');
    setter(v);
  };

  const finish = async () => {
    if (saving || category === null) return;
    setSaving(true);
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeOnboarding({
        category,
        customName: customName.trim(),
        reasons: [defaultReasonForCategory(category, customName)],
        dailyCost: 0,
        dailyMinutes: 0,
        pledgeTime,
        quitAtMs,
      });
      // The reminder toggle is real: the service default is ON, so only an
      // explicit OFF needs applying (plus cancelling the check-in that
      // completeOnboarding scheduled).
      if (!reminderOn) {
        await updateSettings({ pledgeReminder: false });
        try {
          await cancelScheduledNotification(DAILY_ENCOURAGEMENT_IDENTIFIER);
        } catch {
          // Best-effort.
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const onContinue = () => {
    if (saving || !canContinueAt(pageRef.current)) return;
    if (pageRef.current === PAGE_COUNT - 1) {
      void finish();
      return;
    }
    // Haptics fire at animation start.
    void Haptics.selectionAsync();
    goToPage(pageRef.current + 1);
  };

  /** Swipe-forward past an invalid step springs back with a light tick. */
  const onMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const next = Math.max(
      0,
      Math.min(
        PAGE_COUNT - 1,
        Math.round(e.nativeEvent.contentOffset.x / width)
      )
    );
    if (next === pageRef.current) return;
    if (next > pageRef.current && !canContinueAt(pageRef.current)) {
      pagerRef.current?.scrollTo({
        x: pageRef.current * width,
        animated: !reduceMotion,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    pageRef.current = next;
    setPage(next);
  };

  // The v3 QA fix, preserved: the drum-picked moment (never Date.now() at
  // completion) is what createQuitFromAnswers uses for startDate.
  const quitAtMs = clampQuitMoment(
    quitMomentMs(baseNowMs, dayOffset, to24h(hour12, period), minute),
    baseNowMs
  );

  const lastPage = page === PAGE_COUNT - 1;
  const ctaDisabled = !canContinueAt(page) || saving;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        {page > 0 && (
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={goBack}
                hitSlop={12}
                style={styles.backBtn}
              >
                <SymbolView
                  name={symbol('chevron.left')}
                  tintColor={c.accent}
                  style={styles.backIcon}
                  weight="semibold"
                />
              </Pressable>
            </View>
            <PageDots page={page} />
            <View style={[styles.headerSide, styles.headerSideRight]}>
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={[styles.avatar, { backgroundColor: c.accentDeep }]}
              >
                <SymbolView
                  name={symbol('person.fill')}
                  tintColor={c.onAccent}
                  style={styles.avatarIcon}
                  weight="semibold"
                />
              </View>
            </View>
          </View>
        )}

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={styles.fill}
        >
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width }}>
              <ScrollView
                contentContainerStyle={styles.pageScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {i === 0 && <IntroPage orbSize={orbSize} />}
                {i === 1 && (
                  <CategoryPage
                    category={category}
                    onSelect={setCategory}
                    customName={customName}
                    onCustomName={setCustomName}
                  />
                )}
                {i === 2 && (
                  <WhenPage
                    active={page === 2}
                    dayOptions={dayOptions}
                    dayOffset={dayOffset}
                    onDayChange={drumChanged(setDayOffset)}
                    hour12={hour12}
                    onHour12Change={drumChanged(setHour12)}
                    minute={minute}
                    onMinuteChange={drumChanged(setMinute)}
                    period={period}
                    onPeriodChange={drumChanged(setPeriod)}
                    chip={chip}
                    onChip={applyChip}
                    quitAtMs={quitAtMs}
                    category={category ?? 'custom'}
                    baseNowMs={baseNowMs}
                  />
                )}
                {i === 3 && (
                  <PledgePage
                    pledgeTime={pledgeTime}
                    onPledgeTime={setPledgeTime}
                    onEdit={() => setPickerOpen(true)}
                    reminderOn={reminderOn}
                    onReminderChange={setReminderOn}
                  />
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
        >
          {page === 0 && (
            <View style={styles.footerDots}>
              <PageDots page={page} />
            </View>
          )}
          {page === 1 || lastPage ? (
            <AccentButton
              title={lastPage ? 'Save Commitment Window' : 'Continue →'}
              onPress={onContinue}
              disabled={ctaDisabled}
              loading={lastPage && saving}
              testID="onboarding-continue"
            />
          ) : (
            <InvertedButton
              title={page === 2 ? 'Lock In Quit Date →' : 'Continue →'}
              onPress={onContinue}
              disabled={ctaDisabled}
              testID="onboarding-continue"
            />
          )}
          {page === 0 ? (
            <View style={styles.privacyLine}>
              <SymbolView
                name={symbol('lock.fill')}
                tintColor={c.muted}
                style={styles.privacyIcon}
                weight="semibold"
              />
              <Text style={[styles.footerNote, { color: c.muted }]}>
                Private by design · No account required to start
              </Text>
            </View>
          ) : (
            <Text style={[styles.footerNote, styles.footerNoteGap, { color: c.metadata }]}>
              {page === 1 &&
                'You are taking command of your nervous system.'}
              {page === 2 &&
                'You can fine-tune this timestamp anytime in You › Settings.'}
              {lastPage &&
                'You can adjust pledge times anytime in You › Settings.'}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <TimePickerSheet
        visible={pickerOpen}
        initialTime={pledgeTime}
        onSave={(t) => {
          setPledgeTime(t);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
  flexSpacer: { flex: 1 },

  // -- header ------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    minHeight: 56,
  },
  headerSide: { width: 44, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: { width: 12, height: 20 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { width: 20, height: 20 },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: { height: 6, borderRadius: 3 },
  footerDots: { marginBottom: spacing.md },

  // -- pages -------------------------------------------------------------
  pageScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pageInner: { gap: spacing.md },
  title: { ...typeScale.title2 },
  sub: { ...typeScale.body, marginBottom: spacing.sm },

  // -- welcome -----------------------------------------------------------
  introInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  introText: { alignItems: 'center', gap: spacing.sm },
  infinity: { fontWeight: '300' },
  wordmark: { ...typeScale.largeTitle, textAlign: 'center' },
  promise: { ...typeScale.body, textAlign: 'center' },

  // -- habit select ------------------------------------------------------
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1.5,
  },
  optionTile: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIcon: { width: 26, height: 26 },
  optionText: { flex: 1, gap: 2 },
  optionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionLabel: { ...typeScale.headline },
  selectedPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  optionBlurb: { ...typeScale.subhead },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { width: 14, height: 14 },
  customField: {
    ...typeScale.body,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },

  // -- info card (shared) --------------------------------------------------
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  infoTile: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: { width: 24, height: 24 },
  infoText: { flex: 1, gap: 2 },
  infoTitle: { ...typeScale.headline },
  infoBody: { ...typeScale.subhead, lineHeight: 21 },
  infoStrong: { fontWeight: '600' },

  // -- quit time -----------------------------------------------------------
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  chipText: { ...typeScale.callout },
  chipTextSelected: { fontWeight: '600' },
  drumCard: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  drums: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateDrum: { flex: 1, marginRight: spacing.sm },
  drumWrap: {
    height: ROW_H * VISIBLE_ROWS,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  drumRow: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumText: { ...typeScale.body },
  drumTextSelected: { fontSize: 20, fontWeight: '600' },
  periodPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ROW_H * 2,
    height: ROW_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1.25,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  summaryTile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: { width: 24, height: 24 },
  liveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  summaryText: { flex: 1, gap: 2 },
  summaryRight: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  elapsed: { fontSize: 20, fontWeight: '600' },
  stage: { ...typeScale.headline },

  // -- pledge --------------------------------------------------------------
  ritualCard: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ritualTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ritualTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ritualIcon: { width: 22, height: 22 },
  ritualPill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  ritualPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recommended: { ...typeScale.subhead, fontWeight: '600' },
  sectionGap: { marginTop: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bigTime: { fontSize: 44, fontWeight: '700', letterSpacing: 0.5 },
  ampm: { fontSize: 20, fontWeight: '600', marginTop: 14 },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  changeIcon: { width: 18, height: 18 },
  changeText: { ...typeScale.callout, fontWeight: '600' },
  kickoff: { ...typeScale.subhead },
  presetsLabel: { ...typeScale.footnote, marginTop: spacing.sm },
  presetRow: { flexDirection: 'row', gap: spacing.sm },
  presetChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  presetText: { ...typeScale.callout },
  presetTextSelected: { fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { ...typeScale.headline },
  reminderSub: { ...typeScale.footnote },
  oathCard: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  oathGlyph: { fontSize: 28, fontWeight: '700', marginBottom: -spacing.sm },
  oathEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  oathQuote: { ...typeScale.body, lineHeight: 25 },
  oathFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  oathNote: { ...typeScale.footnote },

  // -- footer ----------------------------------------------------------------
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  privacyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.sm,
  },
  privacyIcon: { width: 14, height: 14 },
  footerNote: { ...typeScale.footnote, textAlign: 'center' },
  footerNoteGap: { paddingTop: spacing.sm },
});
