/**
 * You tab (spec §2.8): streak summary, Data & Backup, Notifications,
 * App Commitments, Sovereign premium row, privacy/support, erase-all-data.
 *
 * Everything here is honest: backups are checksum-verified, commitments
 * never claim OS powers, and destructive actions are double-confirmed.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlassButton } from '../../../components/glass/GlassButton';
import { GlassCard } from '../../../components/glass/GlassCard';
import { GlassToggle } from '../../../components/glass/GlassToggle';
import { Screen } from '../../../components/glass/Screen';
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
import { restorePurchasesWithBiometrics } from '../../../services/purchases';
import { cleanDaysFloor } from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import { colors, radii, spacing, type } from '../../../theme/tokens';
import type { AppearanceSetting, OrbTheme } from '../../../types/app';

const ORB_THEMES: { id: OrbTheme; label: string; locked: boolean; swatch: string }[] = [
  { id: 'dawn', label: 'Dawn', locked: false, swatch: '#7C6CF0' },
  { id: 'ember', label: 'Ember', locked: true, swatch: '#E8786A' },
  { id: 'tide', label: 'Tide', locked: true, swatch: '#35B3A3' },
];

/** Appearance switcher (redesign phase 1 placeholder — full You reskin later). */
const APPEARANCES: { id: AppearanceSetting; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function YouScreen() {
  const { state, loading, updateSettings, refresh } = useAppState();
  const { isPremium } = usePremium();
  // Purity rule: Date.now() can't run in the render body — snapshot it once.
  const [nowSnapshot] = useState(() => Date.now());
  const [integrity, setIntegrity] = useState<'verified' | 'recovered' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<AppCommitmentState | null>(null);
  const [newApp, setNewApp] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

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
          <ActivityIndicator size="large" color={colors.accent} />
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

  const handleMilestoneAlerts = async (next: boolean) => {
    await updateSettings({ milestoneAlerts: next });
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
        <Text style={styles.title}>You</Text>

        {/* Streak summary */}
        <SectionTitle>Streak summary</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.statGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{cleanDays}</Text>
              <Text style={styles.statLabel}>current</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{quit.longestStreakDays}</Text>
              <Text style={styles.statLabel}>longest</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{quit.totalRelapses}</Text>
              <Text style={styles.statLabel}>slips</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{state.pledge.pledgeStreak}</Text>
              <Text style={styles.statLabel}>pledge streak</Text>
            </View>
          </View>
        </GlassCard>

        {/* Data & Backup */}
        <SectionTitle>Data &amp; backup</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Storage integrity</Text>
            <Text
              style={[
                styles.rowValue,
                integrity === 'verified' && styles.good,
              ]}
            >
              {integrity === null
                ? 'checking…'
                : integrity === 'verified'
                  ? '✓ Verified'
                  : 'Recovered from safe defaults'}
            </Text>
          </View>
          <Text style={styles.footnote}>
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
              tone="neutral"
              disabled={busy !== null}
            />
          </View>
        </GlassCard>

        {/* Notifications */}
        <SectionTitle>Notifications</SectionTitle>
        <GlassCard style={styles.card}>
          <GlassToggle
            label="Morning pledge reminder"
            hint={`Daily at ${quit.pledgeTime}`}
            value={settings.pledgeReminder}
            onValueChange={handlePledgeReminder}
          />
          <View style={styles.divider} />
          <GlassToggle
            label="Milestone alerts"
            hint="A heads-up the evening before a milestone"
            value={settings.milestoneAlerts}
            onValueChange={handleMilestoneAlerts}
          />
        </GlassCard>

        {/* Appearance — Light / Dark / System */}
        <SectionTitle>Appearance</SectionTitle>
        <GlassCard style={styles.card}>
          {APPEARANCES.map((a) => {
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
                  styles.appearanceRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.rowLabel}>{a.label}</Text>
                {selected ? (
                  <Text style={styles.check}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </GlassCard>

        {/* Orb theme — Ember & Tide are Sovereign-member only */}
        <SectionTitle>Orb theme</SectionTitle>
        <GlassCard style={styles.card}>
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
                      void updateSettings({ orbTheme: t.id });
                    }
                  }}
                  style={[
                    styles.themeSwatch,
                    selected && styles.themeSwatchSelected,
                  ]}
                >
                  <View
                    style={[styles.themeDot, { backgroundColor: t.swatch }]}
                  />
                  <Text style={styles.themeLabel}>
                    {t.label}
                    {locked ? ' 🔒' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!isPremium && (
            <Text style={styles.footnote}>
              Ember and Tide unlock with Sovereign.
            </Text>
          )}
        </GlassCard>

        {/* App Commitments */}
        <SectionTitle>App commitments</SectionTitle>
        <GlassCard style={styles.card}>
          <Text style={styles.body}>
            Declare the apps you commit to avoid. This is a personal
            commitment — Sovereign can&apos;t block or limit other apps.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setGuideOpen((o) => !o)}
            style={styles.guideToggle}
          >
            <Text style={styles.guideToggleText}>
              {guideOpen ? 'Hide' : 'Show'} the honest Screen Time guide
            </Text>
          </Pressable>
          {guideOpen && (
            <Text style={styles.guide}>
              If you want enforced limits, iOS Screen Time is the real tool:
              Settings → Screen Time → App Limits → Add Limit → pick the
              app → set 1 minute. Sovereign won&apos;t pretend to do this
              for you — but your commitment list above keeps the promise
              visible.
            </Text>
          )}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="App name, e.g. TikTok"
              placeholderTextColor={colors.textTertiary}
              value={newApp}
              onChangeText={setNewApp}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleAddApp}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleAddApp}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          {(commitments?.triggerApps ?? []).map((app) => (
            <View key={app} style={styles.appRow}>
              <Text style={styles.appName}>{app}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleRemoveApp(app)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {(commitments?.triggerApps.length ?? 0) === 0 && (
            <Text style={styles.empty}>
              No commitments yet — add the apps that test you most.
            </Text>
          )}
        </GlassCard>

        {/* Premium */}
        <SectionTitle>Sovereign</SectionTitle>
        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Membership</Text>
            <Text style={[styles.rowValue, isPremium && styles.good]}>
              {isPremium ? '✓ Active' : 'Free'}
            </Text>
          </View>
          {!isPremium && (
            <View style={styles.btnRow}>
              <GlassButton
                title="See plans"
                onPress={() => router.push('/paywall')}
              />
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={handleRestore}
            disabled={busy !== null}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>
              {busy === 'restore-purchases' ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
        </GlassCard>

        {/* Privacy & support */}
        <SectionTitle>About</SectionTitle>
        <GlassCard style={styles.card}>
          <Pressable
            accessibilityRole="button"
            style={styles.linkRow}
            onPress={() =>
              openLink(
                PRIVACY_POLICY_URL,
                'The privacy policy ships with the App Store listing — the full text is already drafted.'
              )
            }
          >
            <Text style={styles.linkText}>Privacy policy</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            style={styles.linkRow}
            onPress={() =>
              openLink(
                SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : '',
                'The support inbox is set up before launch.'
              )
            }
          >
            <Text style={styles.linkText}>Contact support</Text>
          </Pressable>
        </GlassCard>

        {/* Danger zone */}
        <GlassCard style={[styles.card, styles.dangerCard]}>
          <Pressable accessibilityRole="button" onPress={handleErase}>
            <Text style={styles.dangerText}>Erase all my data</Text>
          </Pressable>
          <Text style={styles.footnote}>
            Deletes streak, journal, and settings from this device. Your
            App Store purchase history is untouched.
          </Text>
        </GlassCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...type.title, color: colors.text, marginBottom: spacing.md },
  sectionTitle: {
    ...type.headline,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm, padding: spacing.lg, gap: spacing.sm },
  body: { ...type.body, color: colors.textSecondary },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { ...type.title, color: colors.text },
  statLabel: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: { ...type.callout, color: colors.text },
  rowValue: { ...type.callout, color: colors.textSecondary },
  good: { color: colors.success, fontWeight: '600' },
  footnote: { ...type.caption, color: colors.textTertiary },
  themeRow: { flexDirection: 'row', gap: spacing.md },
  themeSwatch: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  themeSwatchSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  themeDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  themeLabel: { ...type.callout, color: colors.text },
  appearanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  pressed: { opacity: 0.7 },
  check: { ...type.headline, color: colors.accent },
  btnRow: { gap: spacing.sm, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.hairline },
  guideToggle: { paddingVertical: spacing.xs },
  guideToggleText: { ...type.callout, color: colors.accent },
  guide: {
    ...type.body,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    ...type.body,
    color: colors.text,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtn: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addBtnText: { ...type.callout, color: colors.text },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  appName: { ...type.body, color: colors.text },
  removeBtn: { padding: spacing.xs },
  removeText: { ...type.callout, color: colors.textSecondary },
  empty: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  linkRow: { paddingVertical: spacing.sm },
  linkText: { ...type.body, color: colors.accent },
  dangerCard: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' },
  dangerText: { ...type.callout, color: colors.danger, fontWeight: '600' },
});
