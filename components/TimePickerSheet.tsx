/**
 * TimePickerSheet — Stitch pledge-window picker (Phase 7).
 *
 * Hour/minute snap drums (RN primitives, no native picker — Expo Go),
 * RECOMMENDED WINDOWS preset chips (tapping one sets the drums), a
 * lock-screen notification preview card showing the real pledge copy at
 * the chosen time, and a violet Save pill.
 *
 * The reference's header was mislabeled "SOVEREIGN EMERGENCY PROTOCOL"
 * (plan §3.9) — corrected to "SET PLEDGE WINDOW". The "Silent delivery
 * during active Sleep Focus" line is dropped: we have no Sleep Focus
 * integration. Saves back as "HH:MM" zero-padded.
 */
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AccentButton } from './ui/AccentButton';
import { Sheet } from './ui/Sheet';
import { formatPledgeTime12h } from '../services/pledgeTime';
import { motion, radii, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const ROW_H = 44;
const VISIBLE_ROWS = 5;
const DRUM_H = ROW_H * VISIBLE_ROWS;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Recommended windows (plan §2.9): tapping a preset sets the drums. */
const PRESETS: { label: string; h: number; m: number }[] = [
  { label: 'Early Bird', h: 6, m: 30 },
  { label: 'Morning Start', h: 8, m: 0 },
  { label: 'Commute', h: 9, m: 0 },
];

function parseTime(initialTime: string): { h: number; m: number } {
  const [h, m] = initialTime.split(':').map(Number);
  return {
    h: Number.isInteger(h) && h >= 0 && h <= 23 ? h : 7,
    m: Number.isInteger(m) && m >= 0 && m <= 59 ? m : 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** One drum row: 44pt target, spring press, haptic on select. */
function DrumRow({
  label,
  selected,
  onSelect,
  textColor,
  selectedColor,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  textColor: string;
  selectedColor: string;
}) {
  // Legacy Animated API: method calls only — the shared-value assignment
  // form trips the react-hooks/immutability lint rule.
  const [scaleAnim] = useState(() => new RNAnimated.Value(1));
  const springTo = (toValue: number) => {
    RNAnimated.spring(scaleAnim, {
      toValue,
      useNativeDriver: true,
      ...motion.press,
    }).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPressIn={() => springTo(0.94)}
      onPressOut={() => springTo(1)}
      onPress={onSelect}
      style={styles.drumRow}
    >
      <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text
          style={[
            styles.drumText,
            { color: selected ? selectedColor : textColor },
            selected && styles.drumTextSelected,
            styles.tabular,
          ]}
        >
          {label}
        </Text>
      </RNAnimated.View>
    </Pressable>
  );
}

/** A snap-scrolling vertical drum of numeric values. */
function DrumColumn({
  label,
  values,
  value,
  onChange,
  scrollToken,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
  /** Bumped by the parent (preset tap) to scroll the drum to `value`. */
  scrollToken: number;
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
    if (clamped === values.indexOf(value)) return;
    listRef.current?.scrollToIndex({
      index: clamped + 2,
      animated: !reduceMotion,
    });
    void Haptics.selectionAsync();
    onChange(values[clamped]);
  };

  // Preset tap: the parent sets the value and bumps scrollToken in the
  // same batch, so this render already carries the new value.
  useEffect(() => {
    if (scrollToken === 0) return;
    const idx = values.indexOf(value);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({
        index: idx + 2,
        animated: !reduceMotion,
      });
    }
    // Intentionally keyed on scrollToken only: `value` is read at the
    // render where the token changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToken]);

  const handleScrollEnd = (offsetY: number) => {
    selectIndex(Math.round(offsetY / ROW_H));
  };

  return (
    <View style={styles.drum} accessibilityLabel={`${label} picker`}>
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
        onScrollEndDrag={(e) =>
          handleScrollEnd(e.nativeEvent.contentOffset.y)
        }
        renderItem={({ item, index }) => {
          if (item === null) return <View style={styles.drumRow} />;
          const selected = values.indexOf(value) === index - 2;
          return (
            <DrumRow
              label={pad(item)}
              selected={selected}
              textColor={c.metadata}
              selectedColor={c.text}
              onSelect={() => selectIndex(index - 2)}
            />
          );
        }}
      />
    </View>
  );
}

/** A preset chip: 44pt, accent-selected. */
function PresetChip({
  label,
  time,
  selected,
  onPress,
}: {
  label: string;
  time: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${time}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? c.accent : c.hairline,
          backgroundColor: selected ? c.accentSoft : c.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipLabel, { color: c.metadata }]}>{label}</Text>
      <Text
        style={[
          styles.chipTime,
          { color: selected ? c.accent : c.text },
          styles.tabular,
        ]}
      >
        {time}
      </Text>
    </Pressable>
  );
}

export function TimePickerSheet({
  visible,
  initialTime,
  onSave,
  onClose,
}: {
  visible: boolean;
  /** "HH:MM" 24h */
  initialTime: string;
  /** Resolves with "HH:MM" zero-padded. */
  onSave: (time: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [hour24, setHour24] = useState(() => parseTime(initialTime).h);
  const [minute, setMinute] = useState(() => parseTime(initialTime).m);
  const [scrollToken, setScrollToken] = useState(0);

  // Re-seed the drums when the sheet opens: React state synced with the
  // external `visible` prop, which is what effects are for (same as Sheet).
  useEffect(() => {
    if (visible) {
      const parsed = parseTime(initialTime);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHour24(parsed.h);
      setMinute(parsed.m);
    }
  }, [visible, initialTime]);

  const applyPreset = (preset: { h: number; m: number }) => {
    setHour24(preset.h);
    setMinute(preset.m);
    setScrollToken((t) => t + 1);
    void Haptics.selectionAsync();
  };

  const handleSave = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(`${pad(hour24)}:${pad(minute)}`);
  };

  const time12h = formatPledgeTime12h(`${pad(hour24)}:${pad(minute)}`);

  return (
    <Sheet visible={visible} onClose={onClose} testID="time-picker-sheet">
      <View style={styles.inner}>
        {/* Header: corrected title (plan §3.9). */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={styles.topButton}
          >
            <Text style={[styles.topCancel, { color: c.metadata }]}>
              Cancel
            </Text>
          </Pressable>
          <View style={styles.eyebrow}>
            <View
              style={[styles.eyebrowDot, { backgroundColor: c.accent }]}
            />
            <Text style={[styles.eyebrowText, { color: c.metadata }]}>
              Set Pledge Window
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save ${time12h}`}
            onPress={handleSave}
            style={styles.topButton}
          >
            <Text style={[styles.topSave, { color: c.accent }]}>Save</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { color: c.text }]}>Prime Your Mind</Text>
        <Text style={[styles.copy, { color: c.metadata }]}>
          Choose the quiet morning hour when your daily resolve is strongest.
        </Text>

        <View
          style={[
            styles.drumCard,
            { backgroundColor: c.surface, borderColor: c.hairline },
          ]}
        >
          <View style={styles.drums}>
            <DrumColumn
              label="Hour"
              values={HOURS}
              value={hour24}
              onChange={setHour24}
              scrollToken={scrollToken}
            />
            <Text style={[styles.colon, { color: c.metadata }]}>:</Text>
            <DrumColumn
              label="Minute"
              values={MINUTES}
              value={minute}
              onChange={setMinute}
              scrollToken={scrollToken}
            />
          </View>
        </View>

        <Text style={[styles.sectionEyebrow, { color: c.metadata }]}>
          Recommended Windows
        </Text>
        <View style={styles.chips}>
          {PRESETS.map((preset) => (
            <PresetChip
              key={preset.label}
              label={preset.label}
              time={formatPledgeTime12h(
                `${pad(preset.h)}:${pad(preset.m)}`
              )}
              selected={hour24 === preset.h && minute === preset.m}
              onPress={() => applyPreset(preset)}
            />
          ))}
        </View>

        {/* Lock-screen delivery preview: the real pledge copy, at this time. */}
        <View
          style={[
            styles.previewCard,
            { backgroundColor: c.surface, borderColor: c.hairline },
          ]}
        >
          <View style={styles.previewHead}>
            <View style={styles.previewTitleRow}>
              <View
                style={[styles.shieldTile, { backgroundColor: c.accentSoft }]}
              >
                <SymbolView
                  name="lock.shield"
                  tintColor={c.accent}
                  style={styles.shieldIcon}
                />
              </View>
              <Text style={[styles.previewEyebrow, { color: c.metadata }]}>
                Lock Screen Delivery
              </Text>
            </View>
            <Text
              style={[styles.previewTime, { color: c.metadata }, styles.tabular]}
            >
              {time12h}
            </Text>
          </View>
          <View
            style={[styles.notif, { backgroundColor: c.surfaceDeep }]}
            accessibilityRole="text"
            accessibilityLabel={`Notification preview: Time to pledge. Your daily Sovereign pledge is waiting. Anchor your commitment for the next 24 hours.`}
          >
            <View style={styles.notifHead}>
              <View
                style={[styles.appDot, { backgroundColor: c.accent }]}
              />
              <Text style={[styles.notifApp, { color: c.metadata }]}>
                Sovereign
              </Text>
              <Text style={[styles.notifWhen, { color: c.muted }]}>now</Text>
            </View>
            <Text style={[styles.notifTitle, { color: c.text }]}>
              Time to pledge
            </Text>
            <Text style={[styles.notifBody, { color: c.metadata }]}>
              Your daily Sovereign pledge is waiting. Anchor your commitment
              for the next 24 hours.
            </Text>
          </View>
        </View>

        <AccentButton
          title="Save Commitment Window"
          onPress={handleSave}
          testID="time-picker-save"
        />
        <Text style={[styles.footNote, { color: c.muted }]}>
          Delivered daily at your pledge time.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topButton: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  topCancel: { ...type.headline },
  topSave: { ...type.headline, fontWeight: '700', textAlign: 'right' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { ...type.title1 },
  copy: { ...type.body, lineHeight: 24, marginTop: -spacing.sm },
  drumCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  drums: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drum: {
    width: 96,
    height: DRUM_H,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  drumRow: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumText: { ...type.body },
  drumTextSelected: { fontSize: 22, fontWeight: '700' },
  colon: { ...type.title1, marginHorizontal: spacing.xs },
  sectionEyebrow: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  chipLabel: { ...type.caption },
  chipTime: { ...type.headline, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  previewCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shieldTile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: { width: 15, height: 15 },
  previewEyebrow: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  previewTime: { ...type.subhead },
  notif: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  notifHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  appDot: { width: 18, height: 18, borderRadius: 9 },
  notifApp: { ...type.caption, fontWeight: '700', letterSpacing: 1.5 },
  notifWhen: { ...type.caption, marginLeft: 'auto' },
  notifTitle: { ...type.headline, fontWeight: '700' },
  notifBody: { ...type.subhead, lineHeight: 21 },
  footNote: { ...type.footnote, textAlign: 'center' },
  tabular: { ...type.tabular },
});
