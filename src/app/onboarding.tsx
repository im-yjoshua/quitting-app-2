/**
 * Onboarding — 4 steps, no login, ~90 seconds (spec §2.1).
 * 1. Category chips → 2. Three reasons (min 1) → 3. Cost/minutes (skippable → 0)
 * → 4. Pledge time (default 07:00). Creates the Quit and routes to Home.
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
  TextInput,
  View,
} from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { Screen } from '../../components/glass/Screen';
import { useAppState } from '../../state/AppStateContext';
import { colors, radii, spacing, type } from '../../theme/tokens';
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
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperNumber}>{format(value)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => step(1)}
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
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

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
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
          <Text style={styles.title}>{titles[step].title}</Text>
          <Text style={styles.sub}>{titles[step].sub}</Text>

          {step === 0 && (
            <View style={styles.chips}>
              {QUIT_CATEGORIES.map((c) => {
                const selected = category === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    onPress={() => setCategory(c)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {QUIT_CATEGORY_LABELS[c]}
                    </Text>
                  </Pressable>
                );
              })}
              {category === 'custom' && (
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Name it — e.g. energy drinks"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                  autoFocus
                />
              )}
            </View>
          )}

          {step === 1 && (
            <View style={styles.reasons}>
              {REASON_PROMPTS.map((prompt, i) => (
                <View key={prompt} style={styles.reasonRow}>
                  <Text style={styles.reasonPrompt}>{prompt}</Text>
                  <TextInput
                    value={reasons[i]}
                    onChangeText={(t) =>
                      setReasons((r) => r.map((v, j) => (j === i ? t : v)))
                    }
                    placeholder="…"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                    maxLength={120}
                  />
                </View>
              ))}
              <Text style={styles.hint}>At least one — this is the emotional hook.</Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.math}>
              <Text style={styles.groupLabel}>About how much did it cost per day?</Text>
              <View style={styles.presets}>
                {COST_PRESETS.map((v) => (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    onPress={() => setDailyCost(v)}
                    style={({ pressed }) => [
                      styles.preset,
                      dailyCost === v && styles.presetSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.presetText, dailyCost === v && styles.presetTextSelected]}>
                      {v === 0 ? 'Skip' : `$${v}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.groupLabel}>How many minutes a day did it take?</Text>
              <View style={styles.presets}>
                {MINUTE_PRESETS.map((v) => (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    onPress={() => setDailyMinutes(v)}
                    style={({ pressed }) => [
                      styles.preset,
                      dailyMinutes === v && styles.presetSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.presetText, dailyMinutes === v && styles.presetTextSelected]}>
                      {v === 0 ? 'Skip' : `${v}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>Skip = we count it as 0. No judgment.</Text>
            </View>
          )}

          {step === 3 && (
            <View style={styles.time}>
              <View style={styles.timeRow}>
                <Stepper label="Hour" value={hour12} onChange={setHour12} min={1} max={12} format={(v) => String(v)} />
                <Text style={styles.timeColon}>:</Text>
                <Stepper label="Min" value={minute} onChange={setMinute} min={0} max={55} format={(v) => String(v).padStart(2, '0')} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAmpm(ampm === 'AM' ? 'PM' : 'AM')}
                  style={({ pressed }) => [styles.ampm, pressed && styles.pressed]}
                >
                  <Text style={styles.ampmText}>{ampm}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>
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
  backBtn: { paddingVertical: spacing.sm, minWidth: 64 },
  backText: { ...type.body, color: colors.accent },
  backSpacer: { minWidth: 64 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.backgroundElement },
  dotActive: { backgroundColor: colors.accent, width: 24 },
  dotDone: { backgroundColor: colors.accentSoft },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  sub: { ...type.body, color: colors.textSecondary, marginBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { ...type.body, color: colors.textSecondary },
  chipTextSelected: { color: colors.text, fontWeight: '600' },
  reasons: { gap: spacing.md },
  reasonRow: { gap: spacing.xs },
  reasonPrompt: { ...type.callout, color: colors.textSecondary },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.backgroundElement,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  hint: { ...type.caption, color: colors.textTertiary, marginTop: spacing.md },
  math: { gap: spacing.md },
  groupLabel: { ...type.callout, color: colors.textSecondary, marginTop: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  presetSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  presetText: { ...type.callout, color: colors.textSecondary },
  presetTextSelected: { color: colors.text, fontWeight: '600' },
  time: { gap: spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  timeColon: { ...type.hero, color: colors.textTertiary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: { ...type.title, color: colors.text },
  stepperValue: { alignItems: 'center', minWidth: 56 },
  stepperLabel: { ...type.micro, color: colors.textTertiary },
  stepperNumber: { ...type.title, color: colors.text },
  ampm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  ampmText: { ...type.callout, color: colors.text, fontWeight: '700' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  pressed: { opacity: 0.7 },
});
