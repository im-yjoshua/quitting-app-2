/**
 * Onboarding — 4 steps, no login, ~90 seconds (spec §2.1).
 * 1. Category chips → 2. Three reasons (min 1) → 3. Cost/minutes (skippable → 0)
 * → 4. Pledge time (default 07:00). Creates the Quit and routes to Home.
 *
 * Monochrome reskin: pure canvas, full-brightness type, inverted primary
 * CTA, progress dots, keyboard-aware. Warmth comes from copy, not color.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { Screen } from '../../components/glass/Screen';
import { TextField } from '../../components/glass/TextField';
import { useAppState } from '../../state/AppStateContext';
import { radii, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import {
  QUIT_CATEGORIES,
  QUIT_CATEGORY_LABELS,
  type QuitCategory,
} from '../../types/app';

const REASON_PROMPTS = ['For…', 'Because…', 'So I can…'];
const COST_PRESETS = [0, 2, 5, 10, 20];
const MINUTE_PRESETS = [0, 15, 30, 60, 120];

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  format: (v: number) => string;
}) {
  const theme = useTheme();
  const step = (delta: number) => {
    let next = value + delta;
    if (next > max) next = min;
    if (next < min) next = max;
    onChange(next);
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => step(-1)}
        style={({ pressed }) => [
          styles.stepperBtn,
          { backgroundColor: theme.colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.stepperGlyph, { color: theme.colors.text }]}>
          −
        </Text>
      </Pressable>
      <View style={styles.stepperValue}>
        <Text style={[styles.stepperLabel, { color: theme.colors.metadata }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.stepperNumber,
            { color: theme.colors.text },
            styles.tabular,
          ]}
        >
          {format(value)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => step(1)}
        style={({ pressed }) => [
          styles.stepperBtn,
          { backgroundColor: theme.colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.stepperGlyph, { color: theme.colors.text }]}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { completeOnboarding } = useAppState();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<QuitCategory | null>(null);
  const [customName, setCustomName] = useState('');
  const [reasons, setReasons] = useState(['', '', '']);
  const [dailyCost, setDailyCost] = useState(0);
  const [dailyMinutes, setDailyMinutes] = useState(0);
  const [hour12, setHour12] = useState(7);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  const canContinue =
    (step === 0 && category !== null && (category !== 'custom' || customName.trim().length > 0)) ||
    (step === 1 && reasons.some((r) => r.trim().length > 0)) ||
    step === 2 ||
    step === 3;

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  const finish = async () => {
    if (saving || category === null) return;
    setSaving(true);
    try {
      const hour24 = ampm === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;
      await completeOnboarding({
        category,
        customName,
        reasons,
        dailyCost,
        dailyMinutes,
        pledgeTime: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const titles = [
    { title: 'What are you quitting?', sub: 'One thing. The one that owns too much of you.' },
    { title: 'Why does it matter?', sub: 'Give your future self 3 reasons. They show up on the hard days.' },
    { title: 'The math', sub: 'Rough numbers are fine. This powers your money and time stats.' },
    { title: 'The morning nudge', sub: 'We\u2019ll remind you to pledge each day so the streak stays lit. Change it anytime in settings.' },
  ];

  const chipStyle = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected
        ? theme.colors.accentSoft
        : theme.colors.surface,
      borderColor: selected ? theme.colors.accent : 'transparent',
    },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={styles.backBtn}
          >
            <Text style={[styles.backText, { color: theme.colors.accent }]}>
              ‹ Back
            </Text>
          </Pressable>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === step
                        ? theme.colors.accent
                        : i < step
                          ? theme.colors.accentSoft
                          : theme.colors.surface,
                  },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {titles[step].title}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.text }]}>
            {titles[step].sub}
          </Text>

          {step === 0 && (
            <View style={styles.chips}>
              {QUIT_CATEGORIES.map((c) => {
                const selected = category === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setCategory(c)}
                    style={({ pressed }) => [
                      chipStyle(selected),
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: theme.colors.text },
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {QUIT_CATEGORY_LABELS[c]}
                    </Text>
                  </Pressable>
                );
              })}
              {category === 'custom' && (
                <TextField
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Name it — e.g. energy drinks"
                  style={styles.customField}
                  autoFocus
                />
              )}
            </View>
          )}

          {step === 1 && (
            <View style={styles.reasons}>
              {REASON_PROMPTS.map((prompt, i) => (
                <TextField
                  key={prompt}
                  label={prompt}
                  value={reasons[i]}
                  onChangeText={(t) =>
                    setReasons((r) => r.map((v, j) => (j === i ? t : v)))
                  }
                  placeholder="…"
                  maxLength={120}
                />
              ))}
              <Text style={[styles.hint, { color: theme.colors.metadata }]}>
                At least one — this is the emotional hook.
              </Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.math}>
              <Text style={[styles.groupLabel, { color: theme.colors.text }]}>
                About how much did it cost per day?
              </Text>
              <View style={styles.presets}>
                {COST_PRESETS.map((v) => {
                  const selected = dailyCost === v;
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDailyCost(v)}
                      style={({ pressed }) => [
                        chipStyle(selected),
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          { color: theme.colors.text },
                          selected && styles.presetTextSelected,
                        ]}
                      >
                        {v === 0 ? 'Skip' : `$${v}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.groupLabel, { color: theme.colors.text }]}>
                How many minutes a day did it take?
              </Text>
              <View style={styles.presets}>
                {MINUTE_PRESETS.map((v) => {
                  const selected = dailyMinutes === v;
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDailyMinutes(v)}
                      style={({ pressed }) => [
                        chipStyle(selected),
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          { color: theme.colors.text },
                          selected && styles.presetTextSelected,
                        ]}
                      >
                        {v === 0 ? 'Skip' : `${v}m`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: theme.colors.metadata }]}>
                Skip = we count it as 0. No judgment.
              </Text>
            </View>
          )}

          {step === 3 && (
            <View style={styles.time}>
              <View style={styles.timeRow}>
                <Stepper label="Hour" value={hour12} onChange={setHour12} min={1} max={12} format={(v) => String(v)} />
                <Text style={[styles.timeColon, { color: theme.colors.metadata }]}>
                  :
                </Text>
                <Stepper label="Min" value={minute} onChange={setMinute} min={0} max={55} format={(v) => String(v).padStart(2, '0')} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle AM PM, currently ${ampm}`}
                  onPress={() => setAmpm(ampm === 'AM' ? 'PM' : 'AM')}
                  style={({ pressed }) => [
                    styles.ampm,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accent,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.ampmText, { color: theme.colors.text }]}>
                    {ampm}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.hint, { color: theme.colors.metadata }]}>
                We\u2019ll ask for notification permission next — only so we can remind you to pledge.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 3 ? (
            <GlassButton
              title="Continue"
              onPress={() => canContinue && setStep(step + 1)}
              disabled={!canContinue}
            />
          ) : (
            <GlassButton
              title={saving ? 'Starting…' : 'Begin Day One'}
              onPress={finish}
              disabled={saving}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backBtn: {
    paddingVertical: spacing.sm,
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: { ...type.body },
  backSpacer: { minWidth: 64 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: { ...type.largeTitle, marginBottom: spacing.sm },
  sub: { ...type.body, marginBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...type.body },
  chipTextSelected: { fontWeight: '600' },
  customField: { width: '100%', marginTop: spacing.sm },
  reasons: { gap: spacing.md },
  hint: { ...type.footnote, marginTop: spacing.sm },
  math: { gap: spacing.md },
  groupLabel: { ...type.headline, marginTop: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetText: { ...type.body },
  presetTextSelected: { fontWeight: '600' },
  time: { gap: spacing.lg },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  timeColon: { ...type.largeTitle },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: { ...type.title1 },
  stepperValue: { alignItems: 'center', minWidth: 56 },
  stepperLabel: { ...type.caption },
  stepperNumber: { ...type.title1 },
  tabular: { ...type.tabular },
  ampm: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmText: { ...type.headline },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
