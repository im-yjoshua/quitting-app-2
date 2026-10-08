/**
 * TimePickerSheet — editable pledge-time picker on the Sheet primitive.
 *
 * Two 24h drums (hour 0–23, minute 0–59) built from RN primitives only —
 * no native date picker (Expo Go compatibility is sacred). 44pt rows,
 * snap-to-row scrolling, haptic ticks, Reanimated press springs.
 * Saves back as "HH:MM" zero-padded.
 */
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

import { GlassButton } from './glass/GlassButton';
import { Sheet } from './glass/Sheet';
import { formatPledgeTime12h } from '../services/pledgeTime';
import { motion, radii, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const ROW_H = 44;
const VISIBLE_ROWS = 5;
const DRUM_H = ROW_H * VISIBLE_ROWS;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

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
  // form trips the react-hooks/immutability lint rule (see GlassButton).
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
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
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
    listRef.current?.scrollToIndex({ index: clamped + 2, animated: true });
    void Haptics.selectionAsync();
    onChange(values[clamped]);
  };

  const handleScrollEnd = (offsetY: number) => {
    selectIndex(Math.round(offsetY / ROW_H));
  };

  return (
    <View
      style={styles.drum}
      accessibilityLabel={`${label} picker`}
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

  const handleSave = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(`${pad(hour24)}:${pad(minute)}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} dismissLabel="Close time picker">
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Pledge time</Text>
        <Text style={[styles.subtitle, { color: c.metadata }]}>
          Your daily reminder time
        </Text>
      </View>

      <Text
        style={[styles.preview, { color: c.text }, styles.tabular]}
        accessibilityLiveRegion="polite"
      >
        {formatPledgeTime12h(`${pad(hour24)}:${pad(minute)}`)}
      </Text>

      <View style={styles.drums}>
        <DrumColumn
          label="Hour"
          values={HOURS}
          value={hour24}
          onChange={setHour24}
        />
        <Text style={[styles.colon, { color: c.metadata }]}>:</Text>
        <DrumColumn
          label="Minute"
          values={MINUTES}
          value={minute}
          onChange={setMinute}
        />
      </View>

      <View style={styles.actions}>
        <GlassButton title="Save" onPress={handleSave} variant="primary" />
        <GlassButton title="Cancel" onPress={onClose} variant="secondary" />
      </View>
      <View style={{ height: spacing.md }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.xs },
  title: { ...type.title3 },
  subtitle: { ...type.subhead, marginTop: 2 },
  preview: {
    ...type.title1,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  drums: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
  actions: { gap: spacing.sm },
  tabular: { ...type.tabular },
});
