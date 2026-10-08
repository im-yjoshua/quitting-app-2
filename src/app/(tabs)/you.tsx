/**
 * You tab (spec §2.8): streak summary, Data & Backup, Notifications,
 * App Commitments, Sovereign premium row, privacy/support, erase-all-data.
 *
 * Everything here is honest: backups are checksum-verified, commitments
 * never claim OS powers, and destructive actions are double-confirmed.
 *
 * Monochrome reskin: iOS Settings-style grouped inset list — section
 * headers in footnote caps, rows on the ONE grey surface, hairline
 * separators, disclosure chevrons, destructive action in red.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassButton } from '../../../components/glass/GlassButton';
import { GlassToggle } from '../../../components/glass/GlassToggle';
import { Screen } from '../../../components/glass/Screen';
import { TextField } from '../../../components/glass/TextField';
import { TimePickerSheet } from '../../../components/TimePickerSheet';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../../../constants';
import {
  eraseAllAppData,
  exportV2Backup,
  importV2Backup,
  verifyV2Integrity,
} from '../../../services/appStateStore';
import {
  addTriggerApp,
  clearCommitments,
  loadCommitments,
  removeTriggerApp,
  saveCommitments,
  type AppCommitmentState,
} from '../../../services/commitments';
import {
  createBackupFile,
  pickBackupFileContents,
  shareBackupFile,
} from '../../../services/dataBackup';
import {
  cancelScheduledNotification,
  DAILY_ENCOURAGEMENT_IDENTIFIER,
  MILESTONE_EVE_IDENTIFIER,
  requestNotificationPermissions,
  scheduleDailyCheckIn,
} from '../../../services/notifications';
import { formatPledgeTime12h } from '../../../services/pledgeTime';
import { restorePurchasesWithBiometrics } from '../../../services/purchases';
import { cleanDaysFloor } from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import { radii, spacing, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';
import type { AppearanceSetting, OrbTheme } from '../../../types/app';

const ORB_THEMES: { id: OrbTheme; label: string; locked: boolean; swatch: string }[] = [
  { id: 'dawn', label: 'Dawn', locked: false, swatch: '#7C6CF0' },
  { id: 'ember', label: 'Ember', locked: true, swatch: '#E8786A' },
  { id: 'tide', label: 'Tide', locked: true, swatch: '#35B3A3' },
];

const APPEARANCES: { id: AppearanceSetting; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.metadata }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface }]}>
        {children}
      </View>
    </View>
  );
}

/** A tappable row: label left, optional value/chevron right. */
function Row({
  theme,
  label,
  value,
  onPress,
  chevron,
  last,
  accessibilityLabel,
}: {
  theme: Theme;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const c = theme.colors;
  const body = (
    <>
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: c.metadata }]}>{value}</Text>
        ) : null}
        {chevron ? (
          <Text style={[styles.chevron, { color: c.metadata }]}>›</Text>
        ) : null}
      </View>
    </>
  );
  const rowStyle = [
    styles.row,
    !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
  ];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export default function YouScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading, updateSettings, updatePledgeTime, refresh } =
    useAppState();
  const { isPremium } = usePremium();
  // Purity rule: Date.now() can't run in the render body — snapshot it once.
  const [nowSnapshot] = useState(() => Date.now());
  const [integrity, setIntegrity] = useState<'verified' | 'recovered' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<AppCommitmentState | null>(null);
  const [newApp, setNewApp] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  useEffect(() => {
    void verifyV2Integrity().then(setIntegrity);
    void loadCommitments().then(setCommitments);
  }, []);

  if (loading || !state?.quit) {
    return (
      <Screen>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: c.metadata }]}>
            Loading…
          </Text>
        </View>
      </Screen>
    );
  }

  const quit = state.quit;
  const cleanDays = cleanDaysFloor(quit.startDate, nowSnapshot);
  const settings = state.settings;

  // ---- Backup ----
  const handleCreateBackup = async () => {
    setBusy('backup');
    try {
      const created = await createBackupFile(exportV2Backup);
      if (!created.success || !created.fileUri) {
        Alert.alert('Backup failed', created.error ?? 'Could not create the backup file.');
        return;
      }
      const shared = await shareBackupFile(created.fileUri);
      if (!shared.shared && shared.error) {
        Alert.alert('Backup saved', 'The backup file is saved on this device, but the share sheet could not be opened.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreBackup = async () => {
    Alert.alert(
      'Restore from backup?',
      'This replaces your current data with the backup file. Your current streak will be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          onPress: async () => {
            setBusy('restore');
            try {
              const picked = await pickBackupFileContents();
              if (picked.canceled) return;
              if (!picked.json) {
                Alert.alert('Restore failed', picked.error ?? 'Could not read the file.');
                return;
              }
              const result = await importV2Backup(picked.json);
              if (!result.success) {
                // Honest damaged-file footnote, right where it happens.
                Alert.alert('Backup rejected', `${result.error ?? 'Invalid backup.'} Your current data was not touched.`);
                return;
              }
              await refresh();
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Restored', 'Your backup is back in place.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  // ---- Notifications ----
  const handlePledgeReminder = async (next: boolean) => {
    await updateSettings({ pledgeReminder: next });
    try {
      if (next) {
        const granted = await requestNotificationPermissions();
        if (granted) {
          const [h, m] = quit.pledgeTime.split(':').map(Number);
          await scheduleDailyCheckIn(h, m);
        } else {
          Alert.alert(
            'Notifications off',
            'Enable notifications in Settings to get your morning pledge nudge.'
          );
        }
      } else {
        await cancelScheduledNotification(DAILY_ENCOURAGEMENT_IDENTIFIER);
      }
    } catch {
      // Best-effort.
    }
  };

  // ---- Pledge time ----
  const handleSavePledgeTime = async (time: string) => {
    setTimeSheetOpen(false);
    await updatePledgeTime(time);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Re-point the daily nudge at the new time. The scheduler is idempotent,
    // so the old slot must be cancelled first or the new time never takes.
    if (!settings.pledgeReminder) return;
    try {
      await cancelScheduledNotification(DAILY_ENCOURAGEMENT_IDENTIFIER);
      const [h, m] = time.split(':').map(Number);
      const id = await scheduleDailyCheckIn(h, m);
      if (!id) {
        Alert.alert(
          'Notifications off',
          'Enable notifications in Settings to get your morning pledge nudge.'
        );
      }
    } catch {
      // Best-effort.
    }
  };

  const handleMilestoneAlerts = async (next: boolean) => {    await updateSettings({ milestoneAlerts: next });
    if (!next) {
      try {
        await cancelScheduledNotification(MILESTONE_EVE_IDENTIFIER);
      } catch {
        // Best-effort.
      }
    }
    // Re-enabling re-arms the next milestone eve on the next Home check.
  };

  // ---- Commitments ----
  const persistCommitments = async (next: AppCommitmentState) => {
    setCommitments(next);
    await saveCommitments(next);
  };

  const handleAddApp = async () => {
    if (!commitments) return;
    const { state: next, added } = addTriggerApp(commitments, newApp);
    if (!added) {
      Alert.alert(
        'Could not add',
        'Use a short name (max 40 characters), no duplicates — 20 apps max.'
      );
      return;
    }
    setNewApp('');
    await persistCommitments(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveApp = async (name: string) => {
    if (!commitments) return;
    await persistCommitments(removeTriggerApp(commitments, name));
  };

  // ---- Premium ----
  const handleRestore = async () => {
    setBusy('restore-purchases');
    try {
      const result = await restorePurchasesWithBiometrics();
      Alert.alert(
        result.success ? 'Restored' : 'Nothing to restore',
        result.success
          ? 'Your Sovereign membership is active on this device.'
          : 'No purchases were found for this store account.'
      );
    } finally {
      setBusy(null);
    }
  };

  // ---- Erase ----
  const handleErase = () => {
    Alert.alert(
      'Erase everything?',
      'This deletes your streak, journal, milestones, and settings from this device. This cannot be undone.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Last chance',
              'Really erase all Sovereign data? Your purchase history with Apple stays untouched.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Erase everything',
                  style: 'destructive',
                  onPress: async () => {
                    await eraseAllAppData();
                    await clearCommitments();
                    router.replace('/onboarding');
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  const openLink = (url: string, emptyNote: string) => {
    if (!url) {
      Alert.alert('Coming at launch', emptyNote);
      return;
    }
    void Linking.openURL(url);
  };

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: c.text }]}>You</Text>

        {/* Streak summary */}
        <Section title="Streak summary" theme={theme}>
          <View style={styles.statGrid}>
            {[
              { value: String(cleanDays), label: 'current' },
              { value: String(quit.longestStreakDays), label: 'longest' },
              { value: String(quit.totalRelapses), label: 'slips' },
              { value: String(state.pledge.pledgeStreak), label: 'pledge streak' },
            ].map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text
                  style={[styles.statValue, { color: c.text }, styles.tabular]}
                >
                  {s.value}
                </Text>
                <Text style={[styles.statLabel, { color: c.metadata }]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Data & Backup */}
        <Section title="Data & backup" theme={theme}>
          <View style={styles.padded}>
            <View style={styles.integrityRow}>
              <Text style={[styles.rowLabel, { color: c.text }]}>
                Storage integrity
              </Text>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color:
                      integrity === 'verified' ? c.success : c.metadata,
                  },
                ]}
              >
                {integrity === null
                  ? 'checking…'
                  : integrity === 'verified'
                    ? '✓ Verified'
                    : 'Recovered from safe defaults'}
              </Text>
            </View>
            <Text style={[styles.footnote, { color: c.metadata }]}>
              Everything stays on this device. Backups are checksummed —
              damaged files are rejected, never half-applied.
            </Text>
            <View style={styles.btnRow}>
              <GlassButton
                title={busy === 'backup' ? 'Working…' : 'Create backup'}
                onPress={handleCreateBackup}
                disabled={busy !== null}
              />
              <GlassButton
                title={busy === 'restore' ? 'Working…' : 'Restore backup'}
                onPress={handleRestoreBackup}
                variant="secondary"
                disabled={busy !== null}
              />
            </View>
          </View>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" theme={theme}>
          <View style={styles.togglePad}>
            <GlassToggle
              label="Morning pledge reminder"
              hint="A gentle nudge to start the day"
              value={settings.pledgeReminder}
              onValueChange={handlePledgeReminder}
            />
          </View>
          <View
            style={[styles.insetDivider, { backgroundColor: c.hairline }]}
          />
          <Row
            theme={theme}
            label="Pledge time"
            value={formatPledgeTime12h(quit.pledgeTime)}
            chevron
            last
            accessibilityLabel={`Pledge time, currently ${formatPledgeTime12h(quit.pledgeTime)}. Tap to change.`}
            onPress={() => setTimeSheetOpen(true)}
          />
          <View
            style={[styles.insetDivider, { backgroundColor: c.hairline }]}
          />
          <View style={styles.togglePad}>
            <GlassToggle
              label="Milestone alerts"
              hint="A heads-up the evening before a milestone"
              value={settings.milestoneAlerts}
              onValueChange={handleMilestoneAlerts}
            />
          </View>
        </Section>

        {/* Appearance — Light / Dark / System */}
        <Section title="Appearance" theme={theme}>
          {APPEARANCES.map((a, i) => {
            const selected = settings.appearance === a.id;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${a.label} appearance`}
                onPress={() => {
                  void Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  );
                  void updateSettings({ appearance: a.id });
                }}
                style={({ pressed }) => [
                  styles.row,
                  i < APPEARANCES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rowLabel, { color: c.text }]}>
                  {a.label}
                </Text>
                {selected ? (
                  <Text style={[styles.check, { color: c.accent }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </Section>

        {/* Orb theme — Ember & Tide are Sovereign-member only */}
        <Section title="Orb theme" theme={theme}>
          <View style={styles.padded}>
            <View style={styles.themeRow}>
              {ORB_THEMES.map((t) => {
                const locked = t.locked && !isPremium;
                const selected = settings.orbTheme === t.id;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={
                      locked ? `${t.label} theme (Sovereign members only)` : `${t.label} theme`
                    }
                    onPress={() => {
                      if (locked) {
                        router.push('/paywall');
                      } else {
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        );
                        void updateSettings({ orbTheme: t.id });
                      }
                    }}
                    style={({ pressed }) => [
                      styles.themeSwatch,
                      {
                        borderColor: selected
                          ? c.accent
                          : 'transparent',
                        backgroundColor: selected
                          ? c.accentSoft
                          : 'transparent',
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[styles.themeDot, { backgroundColor: t.swatch }]}
                    />
                    <Text style={[styles.themeLabel, { color: c.text }]}>
                      {t.label}
                      {locked ? ' 🔒' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!isPremium && (
              <Text style={[styles.footnote, { color: c.metadata }]}>
                Ember and Tide unlock with Sovereign.
              </Text>
            )}
          </View>
        </Section>

        {/* App Commitments */}
        <Section title="App commitments" theme={theme}>
          <View style={styles.padded}>
            <Text style={[styles.body, { color: c.text }]}>
              Declare the apps you commit to avoid. This is a personal
              commitment — Sovereign can&apos;t block or limit other apps.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setGuideOpen((o) => !o)}
              style={styles.guideToggle}
            >
              <Text style={[styles.guideToggleText, { color: c.accent }]}>
                {guideOpen ? 'Hide' : 'Show'} the honest Screen Time guide
              </Text>
            </Pressable>
            {guideOpen && (
              <Text
                style={[
                  styles.guide,
                  { color: c.text, backgroundColor: c.background },
                ]}
              >
                If you want enforced limits, iOS Screen Time is the real tool:
                Settings → Screen Time → App Limits → Add Limit → pick the
                app → set 1 minute. Sovereign won&apos;t pretend to do this
                for you — but your commitment list above keeps the promise
                visible.
              </Text>
            )}
            <View style={styles.addRow}>
              <TextField
                placeholder="App name, e.g. TikTok"
                value={newApp}
                onChangeText={setNewApp}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleAddApp}
                style={styles.addField}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add app commitment"
                onPress={handleAddApp}
                style={({ pressed }) => [
                  styles.addBtn,
                  { backgroundColor: c.accentSoft },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.addBtnText, { color: c.accent }]}>
                  Add
                </Text>
              </Pressable>
            </View>
            {(commitments?.triggerApps ?? []).map((app, i, arr) => (
              <View
                key={app}
                style={[
                  styles.appRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                  },
                ]}
              >
                <Text style={[styles.appName, { color: c.text }]}>{app}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${app}`}
                  onPress={() => handleRemoveApp(app)}
                  style={styles.removeBtn}
                >
                  <Text
                    style={[styles.removeText, { color: c.metadata }]}
                  >
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
            {(commitments?.triggerApps.length ?? 0) === 0 && (
              <Text style={[styles.empty, { color: c.metadata }]}>
                No commitments yet — add the apps that test you most.
              </Text>
            )}
          </View>
        </Section>

        {/* Premium */}
        <Section title="Sovereign" theme={theme}>
          <Row
            theme={theme}
            label="Membership"
            value={isPremium ? '✓ Active' : 'Free'}
            last={!isPremium}
          />
          {!isPremium && (
            <View style={[styles.padded, styles.plansPad]}>
              <GlassButton
                title="See plans"
                onPress={() => router.push('/paywall')}
                variant="secondary"
              />
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={handleRestore}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rowLabel, { color: c.accent }]}>
              {busy === 'restore-purchases' ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
        </Section>

        {/* Privacy & support */}
        <Section title="About" theme={theme}>
          <Row
            theme={theme}
            label="Privacy policy"
            chevron
            onPress={() =>
              openLink(
                PRIVACY_POLICY_URL,
                'The privacy policy ships with the App Store listing — the full text is already drafted.'
              )
            }
          />
          <Row
            theme={theme}
            label="Contact support"
            chevron
            last
            onPress={() =>
              openLink(
                SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : '',
                'The support inbox is set up before launch.'
              )
            }
          />
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone" theme={theme}>
          <Pressable
            accessibilityRole="button"
            onPress={handleErase}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[styles.rowLabel, { color: c.danger }]}>
              Erase all my data
            </Text>
          </Pressable>
          <View style={styles.padded}>
            <Text style={[styles.footnote, { color: c.metadata }]}>
              Deletes streak, journal, and settings from this device. Your
              App Store purchase history is untouched.
            </Text>
          </View>
        </Section>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <TimePickerSheet
        visible={timeSheetOpen}
        initialTime={quit.pledgeTime}
        onSave={handleSavePledgeTime}
        onClose={() => setTimeSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.body },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...type.largeTitle, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    ...type.footnote,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
  },
  group: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  rowLabel: { ...type.body },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { ...type.body },
  chevron: { fontSize: 20, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  padded: { padding: spacing.md },
  plansPad: { paddingTop: spacing.sm },
  integrityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  footnote: { ...type.footnote, marginTop: spacing.xs },
  btnRow: { gap: spacing.sm, marginTop: spacing.md },
  togglePad: { paddingHorizontal: spacing.md },
  insetDivider: {
    height: 1,
    marginLeft: spacing.md,
  },
  check: { ...type.title3 },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeSwatch: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  themeDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  themeLabel: { ...type.headline },
  body: { ...type.body, lineHeight: 24 },
  guideToggle: { paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  guideToggleText: { ...type.headline },
  guide: {
    ...type.body,
    lineHeight: 22,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  addField: { flex: 1 },
  addBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { ...type.headline },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  appName: { ...type.body },
  removeBtn: { paddingVertical: spacing.sm, paddingLeft: spacing.md },
  removeText: { ...type.headline },
  empty: { ...type.subhead, fontStyle: 'italic', marginTop: spacing.sm },
  statGrid: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { ...type.title1 },
  tabular: { ...type.tabular },
  statLabel: { ...type.caption, marginTop: 2 },
});
