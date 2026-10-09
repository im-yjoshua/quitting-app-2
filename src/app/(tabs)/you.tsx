/**
 * You tab (Phase 7 — v3 reskin, plan §3.7).
 *
 * Inset grouped list — the iOS Settings pattern: section headers in
 * footnote caps, rows on the one grey surface, hairline separators,
 * disclosure chevrons, destructive action in red, one-sentence footers
 * explaining what each toggle does.
 *
 * Sections: Quit (summary + pledge time → TimePickerSheet), Notifications
 * (two toggles, footers), Appearance (Light/Dark/System segmented — same
 * persistence contract), Data (backup & restore — same contracts),
 * Orb theme (same premium-gating contract), Commitments (same contract),
 * Premium (upsell row with Orb mini-glow for free users), About
 * (Privacy, Terms, Support, version), Danger zone.
 *
 * Presentation-only: every handler below is the v2 logic, untouched —
 * services/*, state/AppStateContext, and constants are consumed read-only.
 */
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OrbGlow } from '../../../components/orb/OrbGlow';
import { TimePickerSheet } from '../../../components/TimePickerSheet';
import {
  GhostButton,
  Screen,
  SectionHeader,
  SegmentedControl,
} from '../../../components/ui';
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
import { orbThemes, radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';
import type { AppearanceSetting, OrbTheme } from '../../../types/app';

const APPLE_STANDARD_EULA =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const APPEARANCES: { id: AppearanceSetting; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const ORB_THEMES: { id: OrbTheme; label: string; locked: boolean }[] = [
  { id: 'dawn', label: 'Dawn', locked: false },
  { id: 'ember', label: 'Ember', locked: true },
  { id: 'tide', label: 'Tide', locked: true },
];

/** A tappable row: label left, optional value/chevron right. */
function Row({
  theme,
  label,
  value,
  onPress,
  chevron,
  last,
  accessibilityLabel,
  labelColor,
}: {
  theme: Theme;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  accessibilityLabel?: string;
  labelColor?: string;
}) {
  const c = theme.colors;
  const body = (
    <>
      <Text style={[styles.rowLabel, { color: labelColor ?? c.text }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: c.metadata }]}>{value}</Text>
        ) : null}
        {chevron ? (
          <SymbolView
            name="chevron.right"
            tintColor={c.metadata}
            style={styles.chevronIcon}
          />
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

/** A label + Switch row. The on-state is the accent (per the monochrome law). */
function ToggleRow({
  theme,
  label,
  value,
  onValueChange,
  last,
}: {
  theme: Theme;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  last?: boolean;
}) {
  const c = theme.colors;
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
      ]}
    >
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={(next) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(next);
        }}
        trackColor={{ false: c.hairline, true: c.accent }}
        thumbColor={c.onAccent}
        ios_backgroundColor={c.surface}
      />
    </View>
  );
}

function Footer({ theme, children }: { theme: Theme; children: string }) {
  return (
    <Text style={[styles.footer, { color: theme.colors.metadata }]}>
      {children}
    </Text>
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
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  const quit = state.quit;
  const cleanDays = cleanDaysFloor(quit.startDate, nowSnapshot);
  const settings = state.settings;
  const version = Constants.expoConfig?.version ?? '1.0.0';

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

  const appearanceIndex = Math.max(
    0,
    APPEARANCES.findIndex((a) => a.id === settings.appearance)
  );

  return (
    <Screen scrollable scrollContentStyle={styles.content}>
      <Text style={[styles.title, { color: c.text }]}>You</Text>

      {/* Quit summary + pledge time */}
      <SectionHeader title="Quit" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row theme={theme} label="Days clean" value={String(cleanDays)} />
        <Row
          theme={theme}
          label="Pledge streak"
          value={`${state.pledge.pledgeStreak} days`}
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
      </View>

      {/* Notifications — one sentence of footer per toggle */}
      <SectionHeader title="Notifications" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <ToggleRow
          theme={theme}
          label="Morning pledge reminder"
          value={settings.pledgeReminder}
          onValueChange={handlePledgeReminder}
          last
        />
      </View>
      <Footer theme={theme}>
        A gentle nudge at your pledge time, so each day starts with the pledge.
      </Footer>
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <ToggleRow
          theme={theme}
          label="Milestone alerts"
          value={settings.milestoneAlerts}
          onValueChange={handleMilestoneAlerts}
          last
        />
      </View>
      <Footer theme={theme}>
        A heads-up the evening before a milestone, so you meet it head-on.
      </Footer>

      {/* Appearance — Light / Dark / System, same persistence contract */}
      <SectionHeader title="Appearance" />
      <SegmentedControl
        segments={APPEARANCES.map((a) => a.label)}
        selectedIndex={appearanceIndex}
        onChange={(index) => {
          void updateSettings({ appearance: APPEARANCES[index].id });
        }}
        accessibilityLabel="Appearance"
      />

      {/* Data & Backup */}
      <SectionHeader title="Data" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row
          theme={theme}
          label="Storage integrity"
          last
          value={
            integrity === null
              ? 'Checking…'
              : integrity === 'verified'
                ? '✓ Verified'
                : 'Recovered from safe defaults'
          }
        />
      </View>
      <Footer theme={theme}>
        Everything stays on this device. Backups are checksummed — damaged
        files are rejected, never half-applied.
      </Footer>
      <View style={styles.btnRow}>
        <GhostButton
          title="Create backup"
          onPress={handleCreateBackup}
          loading={busy === 'backup'}
          disabled={busy !== null}
          style={styles.btnHalf}
        />
        <GhostButton
          title="Restore backup"
          onPress={handleRestoreBackup}
          loading={busy === 'restore'}
          disabled={busy !== null}
          style={styles.btnHalf}
        />
      </View>

      {/* Orb theme — Ember & Tide are Sovereign-member only (same contract) */}
      <SectionHeader title="Orb theme" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
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
                  locked
                    ? `${t.label} theme (Sovereign members only)`
                    : `${t.label} theme`
                }
                onPress={() => {
                  if (locked) {
                    router.push('/paywall');
                  } else {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void updateSettings({ orbTheme: t.id });
                  }
                }}
                style={({ pressed }) => [
                  styles.themeSwatch,
                  {
                    borderColor: selected ? c.accent : 'transparent',
                    backgroundColor: selected ? c.accentSoft : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.themeDot,
                    { backgroundColor: orbThemes[t.id].glow },
                  ]}
                />
                <View style={styles.themeLabelRow}>
                  <Text style={[styles.themeLabel, { color: c.text }]}>
                    {t.label}
                  </Text>
                  {locked ? (
                    <SymbolView
                      name="lock.fill"
                      tintColor={c.metadata}
                      style={styles.lockIcon}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!isPremium && (
        <Footer theme={theme}>Ember and Tide unlock with Sovereign.</Footer>
      )}

      {/* App Commitments — same contract, honest copy kept */}
      <SectionHeader title="Commitments" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <View style={styles.padded}>
          <Text style={[styles.body, { color: c.text }]}>
            Declare the apps you commit to avoid. This is a personal
            commitment — Sovereign can&apos;t block or limit other apps.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              guideOpen
                ? 'Hide the honest Screen Time guide'
                : 'Show the honest Screen Time guide'
            }
            onPress={() => setGuideOpen((o) => !o)}
            style={styles.guideToggle}
            hitSlop={8}
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
              Settings → Screen Time → App Limits → Add Limit → pick the app
              → set 1 minute. Sovereign won&apos;t pretend to do this for you
              — but your commitment list above keeps the promise visible.
            </Text>
          )}
          <View style={styles.addRow}>
            <TextInput
              placeholder="App name, e.g. TikTok"
              placeholderTextColor={c.metadata}
              value={newApp}
              onChangeText={setNewApp}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleAddApp}
              style={[
                styles.field,
                { color: c.text, backgroundColor: c.background },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add app commitment"
              onPress={handleAddApp}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: c.inverted },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.addBtnText, { color: c.background }]}>
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
                hitSlop={8}
              >
                <Text style={[styles.removeText, { color: c.accent }]}>
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
      </View>

      {/* Premium */}
      <SectionHeader title="Premium" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        {isPremium ? (
          <Row theme={theme} label="Membership" value="✓ Active" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go Premium — see Sovereign plans"
            onPress={() => router.push('/paywall')}
            style={({ pressed }) => [styles.upsell, pressed && styles.pressed]}
          >
            <OrbGlow size={26} />
            <Text style={[styles.upsellLabel, { color: c.text }]}>
              Go Premium
            </Text>
            <SymbolView
              name="chevron.right"
              tintColor={c.metadata}
              style={styles.chevronIcon}
            />
          </Pressable>
        )}
        <View style={[styles.divider, { backgroundColor: c.hairline }]} />
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
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
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
          label="Terms of use"
          chevron
          onPress={() => void Linking.openURL(APPLE_STANDARD_EULA)}
        />
        <Row
          theme={theme}
          label="Contact support"
          chevron
          onPress={() =>
            openLink(
              SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : '',
              'The support inbox is set up before launch.'
            )
          }
        />
        <Row theme={theme} label="Version" value={version} last />
      </View>

      {/* Danger zone */}
      <SectionHeader title="Danger zone" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Erase all my data"
          onPress={handleErase}
          style={({ pressed }) => [
            styles.row,
            { borderBottomWidth: 0 },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.rowLabel, { color: c.danger }]}>
            Erase all my data
          </Text>
        </Pressable>
      </View>
      <Footer theme={theme}>
        Deletes your streak, journal, and settings from this device. Your App
        Store purchase history is untouched.
      </Footer>

      <View style={{ height: spacing.xxl }} />

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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  title: { ...typeScale.largeTitle, marginBottom: spacing.sm },
  group: {
    borderRadius: radii.md,
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
  rowLabel: { ...typeScale.headline },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typeScale.body, ...typeScale.tabular },
  chevronIcon: { width: 12, height: 16 },
  pressed: { opacity: 0.7 },
  footer: {
    ...typeScale.footnote,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  padded: { padding: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnHalf: { flex: 1 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  upsellLabel: { ...typeScale.headline, flex: 1 },
  divider: { height: 1, marginLeft: spacing.md },
  themeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  themeSwatch: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  themeDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  themeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  themeLabel: { ...typeScale.headline },
  lockIcon: { width: 12, height: 14 },
  body: { ...typeScale.body, lineHeight: 24 },
  guideToggle: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  guideToggleText: { ...typeScale.headline },
  guide: {
    ...typeScale.body,
    lineHeight: 22,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  field: {
    ...typeScale.body,
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  addBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { ...typeScale.headline },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  appName: { ...typeScale.body },
  removeBtn: { paddingVertical: spacing.sm, paddingLeft: spacing.md },
  removeText: { ...typeScale.headline },
  empty: { ...typeScale.footnote, fontStyle: 'italic', marginTop: spacing.sm },
});
