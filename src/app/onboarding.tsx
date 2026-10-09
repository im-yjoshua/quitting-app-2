/**
 * Onboarding — v3 rebuild (plan §3.1): 4 steps, full-screen cover.
 * 1. Orb intro → 2. What are you quitting? → 3. When did you quit?
 * → 4. Your daily pledge.
 *
 * Presentation-only rebuild: the completion contract is exactly what
 * services/onboarding.ts and AppStateContext expect — completeOnboarding
 * receives { category, customName, reasons, dailyCost, dailyMinutes,
 * pledgeTime } with the same quit-type keys, then routes to /(tabs).
 * dailyCost/dailyMinutes ride as 0 ("unknown" per the service); reasons
 * ship as a personal default built from the chosen category, since the
 * service throws on an empty list and the v3 flow collects none.
 *
 * Chrome: page dots, inverted Continue, swipeable pages (native paging —
 * 1:1, interruptible, reversible; instant jumps under Reduce Motion).
 * Swipe-forward is gated by the current step's validity and springs back
 * with a light haptic when blocked.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
  formatQuitMoment,
  quitDayOptions,
  quitMomentMs,
} from '../../components/onboarding/logic';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { InvertedButton } from '../../components/ui/InvertedButton';
import { Screen } from '../../components/ui/Screen';
import { formatPledgeTime12h } from '../../services/pledgeTime';
import { useAppState } from '../../state/AppStateContext';
import { motion, radii, spacing, type as typeScale } from '../../theme/tokens';
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

const CATEGORY_SYMBOLS: Record<QuitCategory, string> = {
  smoking: 'flame.fill',
  weed: 'leaf.fill',
  alcohol: 'wineglass.fill',
  porn: 'eye.slash.fill',
  sugar: 'birthday.cake.fill',
  custom: 'ellipsis',
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

const pad2 = (n: number) => String(n).padStart(2, '0');

/** One snap-scrolling drum column (44pt rows, haptic ticks, selection band). */
function DrumColumn({
  label,
  values,
  value,
  onChange,
  format,
  columnWidth,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  columnWidth: number;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList<number | null>>(null);

  // nulls pad top/bottom so the first/last value can center.
  const [data] = useState<(number | null)[]>(() => [
    null,
    null,
    ...values,
    null,
    null,
  ]);

  const selectIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
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
          const selected = values.indexOf(value) === index - 2;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label} ${format(item)}`}
              accessibilityState={{ selected }}
              onPress={() => selectIndex(index - 2)}
              style={({ pressed }) => [
                styles.drumRow,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.drumText,
                  { color: selected ? c.text : c.metadata },
                  selected && styles.drumTextSelected,
                ]}
              >
                {format(item)}
              </Text>
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

/** Step 1 — the brand moment: dormant Orb, wordmark, one line of promise. */
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
      scale.value = withSpring(1, motion.standard);
      textOpacity.value = withDelay(250, withTiming(1, { duration: 600 }));
    }
  }, [reduceMotion, opacity, scale, textOpacity]);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <View style={[styles.pageInner, styles.introInner]}>
      {/* cleanDays 0: the orb is dormant on Day 0 — yours to light. */}
      <Animated.View style={orbStyle}>
        <Orb cleanDays={0} size={orbSize} />
      </Animated.View>
      <Animated.View style={[styles.introText, textStyle]}>
        <Text style={[styles.wordmark, { color: c.text }]}>Sovereign</Text>
        <Text style={[styles.promise, { color: c.text }]}>
          One day at a time, starting now.
        </Text>
      </Animated.View>
    </View>
  );
}

/** One quit-type option: monochrome card, violet ring when selected. */
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
  const symbol = CATEGORY_SYMBOLS[category];
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
          backgroundColor: selected ? c.accentSoft : c.surface,
          borderColor: selected ? c.accent : 'transparent',
        },
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        name={{ ios: symbol as never, android: symbol as never }}
        tintColor={selected ? c.accent : c.text}
        style={styles.optionIcon}
        weight="semibold"
      />
      <Text
        style={[
          styles.optionLabel,
          { color: c.text },
          selected && styles.optionLabelSelected,
        ]}
      >
        {QUIT_CATEGORY_LABELS[category]}
      </Text>
    </Pressable>
  );
}

/** Step 2 — what are you quitting? */
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
      <Text style={[styles.sub, { color: c.text }]}>
        One thing. The one that owns too much of you.
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
          placeholderTextColor={c.metadata}
          autoFocus
          returnKeyType="done"
          maxLength={40}
          accessibilityLabel="Name what you're quitting"
          style={[
            styles.customField,
            { backgroundColor: c.surface, color: c.text },
          ]}
        />
      )}
    </View>
  );
}

/** Step 3 — when did you quit? Date + time drums, native-feeling. */
function WhenPage({
  dayOptions,
  dayOffset,
  onDayChange,
  hour,
  onHourChange,
  minute,
  onMinuteChange,
  preview,
}: {
  dayOptions: { offset: number; label: string }[];
  dayOffset: number;
  onDayChange: (v: number) => void;
  hour: number;
  onHourChange: (v: number) => void;
  minute: number;
  onMinuteChange: (v: number) => void;
  preview: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const offsets = dayOptions.map((o) => o.offset);
  const dayLabel = (offset: number) =>
    dayOptions.find((o) => o.offset === offset)?.label ?? '';
  return (
    <View style={styles.pageInner}>
      <Text style={[styles.title, { color: c.text }]}>When did you quit?</Text>
      <Text style={[styles.sub, { color: c.text }]}>
        Your streak starts the moment you finish setup — mark the moment.
      </Text>
      <Text
        style={[styles.preview, { color: c.text }]}
        accessibilityLiveRegion="polite"
      >
        {preview}
      </Text>
      <View style={styles.drums}>
        <DrumColumn
          label="Day"
          values={offsets}
          value={dayOffset}
          onChange={onDayChange}
          format={dayLabel}
          columnWidth={112}
        />
        <DrumColumn
          label="Hour"
          values={HOURS_24}
          value={hour}
          onChange={onHourChange}
          format={pad2}
          columnWidth={72}
        />
        <Text style={[styles.colon, { color: c.metadata }]}>:</Text>
        <DrumColumn
          label="Minute"
          values={MINUTES_60}
          value={minute}
          onChange={onMinuteChange}
          format={pad2}
          columnWidth={72}
        />
      </View>
    </View>
  );
}

/** Step 4 — the daily pledge time, via the shared TimePickerSheet. */
function PledgePage({
  pledgeTime,
  onEdit,
}: {
  pledgeTime: string;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.pageInner}>
      <Text style={[styles.title, { color: c.text }]}>Your daily pledge</Text>
      <Text style={[styles.sub, { color: c.text }]}>
        One nudge each morning. We&apos;ll remind you at your time — change it
        anytime in settings.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pledge time, currently ${formatPledgeTime12h(pledgeTime)}. Change`}
        onPress={() => {
          void Haptics.selectionAsync();
          onEdit();
        }}
        style={({ pressed }) => [
          styles.timeCard,
          { borderColor: c.hairline },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.timeText, styles.tabular, { color: c.text }]}>
          {formatPledgeTime12h(pledgeTime)}
        </Text>
        <Text style={[styles.timeHint, { color: c.metadata }]}>
          Tap to change
        </Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { completeOnboarding } = useAppState();

  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const pagerRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<QuitCategory | null>(null);
  const [customName, setCustomName] = useState('');
  const [pledgeTime, setPledgeTime] = useState('07:00');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Quit-moment drums — default to right now. The mount timestamp is the
  // stable "now" for the preview line (no impure calls during render).
  const [mountedAt] = useState(() => Date.now());
  const [dayOptions] = useState(() => quitDayOptions(Date.now()));
  const [dayOffset, setDayOffset] = useState(0);
  const [quitHour, setQuitHour] = useState(() => new Date().getHours());
  const [quitMinute, setQuitMinute] = useState(() => new Date().getMinutes());

  const orbSize = Math.round(Math.min(width, height) * 0.52);

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

  const quitAtMs = clampQuitMoment(
    quitMomentMs(mountedAt, dayOffset, quitHour, quitMinute),
    mountedAt
  );
  const quitPreview = formatQuitMoment(quitAtMs, mountedAt);

  const lastPage = page === PAGE_COUNT - 1;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.header}>
          {page > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              hitSlop={8}
              style={styles.backBtn}
            >
              <SymbolView
                name={{ ios: 'chevron.left' as never, android: 'chevron.left' as never }}
                tintColor={c.accent}
                style={styles.backIcon}
                weight="semibold"
              />
              <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <View
            style={styles.dots}
            accessibilityLabel={`Step ${page + 1} of ${PAGE_COUNT}`}
          >
            {Array.from({ length: PAGE_COUNT }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === page
                        ? c.accent
                        : i < page
                          ? c.accentSoft
                          : c.surface,
                  },
                  i === page && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.backSpacer} />
        </View>

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
                    dayOptions={dayOptions}
                    dayOffset={dayOffset}
                    onDayChange={setDayOffset}
                    hour={quitHour}
                    onHourChange={setQuitHour}
                    minute={quitMinute}
                    onMinuteChange={setQuitMinute}
                    preview={quitPreview}
                  />
                )}
                {i === 3 && (
                  <PledgePage
                    pledgeTime={pledgeTime}
                    onEdit={() => setPickerOpen(true)}
                  />
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <InvertedButton
            title={lastPage ? (saving ? 'Starting…' : 'Begin Day One') : 'Continue'}
            onPress={onContinue}
            disabled={!canContinueAt(page) || saving}
            loading={lastPage && saving}
            testID="onboarding-continue"
          />
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
  tabular: { ...typeScale.tabular },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    minHeight: 44,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 72,
    paddingRight: spacing.sm,
  },
  backIcon: { width: 14, height: 20 },
  backText: { ...typeScale.body },
  backSpacer: { minWidth: 72 },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  pageScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pageInner: { gap: spacing.md },
  introInner: { alignItems: 'center', gap: spacing.xl },
  introText: { alignItems: 'center', gap: spacing.sm },
  wordmark: { ...typeScale.largeTitle, textAlign: 'center' },
  promise: { ...typeScale.body, textAlign: 'center' },
  title: { ...typeScale.title2 },
  sub: { ...typeScale.body, marginBottom: spacing.sm },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
  },
  optionIcon: { width: 28, height: 28 },
  optionLabel: { ...typeScale.body, flex: 1 },
  optionLabelSelected: { fontWeight: '600' },
  customField: {
    ...typeScale.body,
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  preview: {
    ...typeScale.title3,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  drums: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
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
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ROW_H * 2,
    height: ROW_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colon: { ...typeScale.title2 },
  timeCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  timeText: { ...typeScale.title1 },
  timeHint: { ...typeScale.footnote },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
