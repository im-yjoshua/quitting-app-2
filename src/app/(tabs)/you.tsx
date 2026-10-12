/**
 * You tab — Profile & Settings (Phase 6, plan §2.7 + §3.7).
 *
 * Stitch reference: title + "Profile & Settings" subtitle, Go Premium upsell
 * card (mini orb glow, hidden when already premium), then inset-grouped
 * sections — QUIT SUMMARY (Focus Habit, Quit Timestamp, Daily Pledge Time),
 * NOTIFICATIONS (two real toggles), APPEARANCE (real Light/Dark/System
 * segmented), DATA & PRIVACY (Backup & Restore, premium-gated Export, red
 * Reset All Progress with the real double-confirm flow), ABOUT (Privacy
 * Policy, Terms, Support with the Phase-4 honest fallback, Version), and a
 * one-line privacy footer.
 *
 * ONLY the rows in plan §2.7 ship — Stitch's fictional rows (Emergency
 * Contact, Orb Glow Intensity, Evening Reflection Prompt, Sleep Focus
 * delivery, FaceID app lock) are dropped per plan §3.7.
 *
 * Presentation-only: every handler is the v2/v3 logic, untouched —
 * services/*, state/AppStateContext, and constants are consumed read-only.
 */
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { OrbGlow } from '../../../components/orb/OrbGlow';
import { TimePickerSheet } from '../../../components/TimePickerSheet';
import {
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
} from '../../../components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../../../constants';
import {
  eraseAllAppData,
  exportV2Backup,
  importV2Backup,
} from '../../../services/appStateStore';
import { clearCommitments } from '../../../services/commitments';
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
import { useAppState } from '../../../state/AppStateContext';
import { usePremium } from '../../../hooks/usePremium';
import {
  QUIT_CATEGORY_LABELS,
  type AppearanceSetting,
  type OrbTheme,
  type QuitCategory,
} from '../../../types/app';
import { radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

const APPLE_STANDARD_EULA =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const APPEARANCES: { id: AppearanceSetting; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/** Orb themes — the paywall advertises these as premium; settings.orbTheme
 * persists the pick (dawn is the free default; ember/tide are premium). */
const ORB_THEMES: { id: OrbTheme; label: string }[] = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'ember', label: 'Ember' },
  { id: 'tide', label: 'Tide' },
];

/** Small SF-Symbol / Material-Symbol icon (no new native deps). */
function Icon({
  ios,
  android,
  size = 16,
  color,
}: {
  ios: string;
  android: string;
  size?: number;
  color: string;
}) {
  return (
    <SymbolView
      name={{ ios: ios as never, android: android as never }}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

/** Rounded icon tile at the row's leading edge, Stitch-style. */
function IconTile({
  theme,
  ios,
  android,
  tone = 'accent',
}: {
  theme: Theme;
  ios: string;
  android: string;
  tone?: 'accent' | 'danger';
}) {
  const c = theme.colors;
  return (
    <View
      style={[
        styles.iconTile,
        {
          backgroundColor:
            tone === 'danger' ? c.danger : c.accentSoft,
        },
      ]}
    >
      <Icon
        ios={ios}
        android={android}
        size={16}
        color={tone === 'danger' ? c.onAccent : c.accent}
      />
    </View>
  );
}

/** A tappable row: icon tile, label, optional value / PRO pill / chevron. */
function Row({
  theme,
  label,
  value,
  icon,
  onPress,
  chevron,
  pro,
  last,
  accessibilityLabel,
  labelColor,
  rightIcon,
  iconTone = 'accent',
}: {
  theme: Theme;
  label: string;
  value?: string;
  icon?: { ios: string; android: string };
  onPress?: () => void;
  chevron?: boolean;
  pro?: boolean;
  last?: boolean;
  accessibilityLabel?: string;
  labelColor?: string;
  rightIcon?: { ios: string; android: string };
  iconTone?: 'accent' | 'danger';
}) {
  const c = theme.colors;
  const body = (
    <>
      {icon ? (
        <IconTile
          theme={theme}
          ios={icon.ios}
          android={icon.android}
          tone={iconTone}
        />
      ) : null}
      <Text style={[styles.rowLabel, { color: labelColor ?? c.text }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {pro ? (
          <View style={[styles.proPill, { backgroundColor: c.accentSoft }]}>
            <Text style={[styles.proPillText, { color: c.accent }]}>PRO</Text>
          </View>
        ) : null}
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
        {rightIcon ? (
          <Icon
            ios={rightIcon.ios}
            android={rightIcon.android}
            size={18}
            color={c.danger}
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

/** A label + Switch row, with the Stitch icon tile. */
function ToggleRow({
  theme,
  label,
  icon,
  value,
  onValueChange,
  last,
}: {
  theme: Theme;
  label: string;
  icon: { ios: string; android: string };
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
      <IconTile theme={theme} ios={icon.ios} android={icon.android} />
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.rowRight}>
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
    </View>
  );
}

/** "Oct 24, 2024 · 09:30 AM" — presentation formatting of the quit ISO. */
function formatQuitTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function habitLabel(category: QuitCategory, customName?: string): string {
  return category === 'custom' && customName
    ? customName
    : QUIT_CATEGORY_LABELS[category];
}

/** Loading state: skeletons in the shape of the inset-grouped list. */
function YouSkeleton() {
  return (
    <View style={styles.skelContent} testID="you-loading">
      <Skeleton width="28%" height={40} style={styles.skelGap} />
      <Skeleton width="100%" height={150} radius={radii.md} style={styles.skelGap} />
      <Skeleton width="100%" height={110} radius={radii.md} style={styles.skelGap} />
      <Skeleton width="100%" height={196} radius={radii.md} />
    </View>
  );
}

export default function YouScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading, updateSettings, updatePledgeTime, refresh } =
    useAppState();
  const { isPremium } = usePremium();
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  // Orb theme picker expansion (premium-gated row below).
  const [orbPickerOpen, setOrbPickerOpen] = useState(false);

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  if (loading || !state?.quit) {
    return (
      <Screen scrollable scrollContentStyle={styles.content}>
        <YouSkeleton />
      </Screen>
    );
  }

  const quit = state.quit;
  const settings = state.settings;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  // ---- Backup & restore (free, local safety) ----
  const handleCreateBackup = async () => {
    const created = await createBackupFile(exportV2Backup);
    if (!created.success || !created.fileUri) {
      Alert.alert('Backup failed', created.error ?? 'Could not create the backup file.');
      return;
    }
    const shared = await shareBackupFile(created.fileUri);
    if (!shared.shared && shared.error) {
      Alert.alert('Backup saved', 'The backup file is saved on this device, but the share sheet could not be opened.');
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
          },
        },
      ]
    );
  };

  const handleBackupRestore = () => {
    Alert.alert(
      'Backup & Restore',
      'Backups are checksummed files — a damaged file is rejected, never half-applied.',
      [
        { text: 'Create backup', onPress: () => void handleCreateBackup() },
        { text: 'Restore backup', onPress: () => void handleRestoreBackup() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ---- Export (premium-gated): the same real export pipeline, shareable. ----
  const handleExport = async () => {
    if (!isPremium) {
      router.push('/paywall');
      return;
    }
    const created = await createBackupFile(exportV2Backup);
    if (!created.success || !created.fileUri) {
      Alert.alert('Export failed', created.error ?? 'Could not create the export file.');
      return;
    }
    const shared = await shareBackupFile(created.fileUri);
    if (!shared.shared && shared.error) {
      Alert.alert('Export saved', 'The export file is saved on this device, but the share sheet could not be opened.');
    }
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

  // ---- Reset (real double-confirm flow) ----
  const handleErase = () => {
    Alert.alert(
      'Reset all progress?',
      'This deletes your streak, journal, milestones, and settings from this device. This cannot be undone.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Last chance',
              'Really erase all Sovereign data? Your purchase history with Apple stays untouched.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset everything',
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
      <Text style={[styles.subtitle, { color: c.metadata }]}>
        Profile &amp; Settings
      </Text>

      {/* Go Premium upsell — hidden once premium. */}
      {!isPremium && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go Premium — see Sovereign plans"
          onPress={() => router.push('/paywall')}
          style={({ pressed }) => [
            styles.upsell,
            { backgroundColor: c.surface },
            pressed && styles.pressed,
          ]}
        >
          <OrbGlow size={44} />
          <View style={styles.upsellText}>
            <View style={styles.upsellTitleRow}>
              <Text style={[styles.upsellTitle, { color: c.text }]}>
                Go Premium
              </Text>
              <View style={[styles.proPill, { backgroundColor: c.accentSoft }]}>
                <Text style={[styles.proPillText, { color: c.accent }]}>
                  PRO
                </Text>
              </View>
            </View>
            <Text style={[styles.upsellSub, { color: c.metadata }]}>
              Voice journaling, orb themes &amp; more
            </Text>
          </View>
          <View style={[styles.upgradePill, { backgroundColor: c.accent }]}>
            <Text style={[styles.upgradeText, { color: c.onAccent }]}>
              Upgrade
            </Text>
          </View>
        </Pressable>
      )}

      {/* QUIT SUMMARY — real values; only pledge time is editable. */}
      <SectionHeader title="Quit Summary" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row
          theme={theme}
          label="Focus Habit"
          value={habitLabel(quit.category, quit.customName)}
          icon={{ ios: 'target', android: 'track_changes' }}
        />
        <Row
          theme={theme}
          label="Quit Timestamp"
          value={formatQuitTimestamp(quit.startDate)}
          icon={{ ios: 'calendar', android: 'calendar_month' }}
        />
        <Row
          theme={theme}
          label="Daily Pledge Time"
          value={formatPledgeTime12h(quit.pledgeTime)}
          icon={{ ios: 'clock.fill', android: 'schedule' }}
          chevron
          last
          accessibilityLabel={`Daily pledge time, currently ${formatPledgeTime12h(quit.pledgeTime)}. Tap to change.`}
          onPress={() => setTimeSheetOpen(true)}
        />
      </View>

      {/* NOTIFICATIONS — the two real toggles. */}
      <SectionHeader title="Notifications" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <ToggleRow
          theme={theme}
          label="Daily Pledge Reminder"
          icon={{ ios: 'bell.fill', android: 'notifications' }}
          value={settings.pledgeReminder}
          onValueChange={handlePledgeReminder}
        />
        <ToggleRow
          theme={theme}
          label="Milestone Alerts"
          icon={{ ios: 'trophy.fill', android: 'emoji_events' }}
          value={settings.milestoneAlerts}
          onValueChange={handleMilestoneAlerts}
          last
        />
      </View>

      {/* APPEARANCE — real Light / Dark / System setting. */}
      <SectionHeader title="Appearance" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <IconTile
            theme={theme}
            ios="moon.fill"
            android="dark_mode"
          />
          <Text style={[styles.rowLabel, { color: c.text }]}>Theme</Text>
        </View>
        <View style={styles.segmentedWrap}>
          <SegmentedControl
            segments={APPEARANCES.map((a) => a.label)}
            selectedIndex={appearanceIndex}
            onChange={(index) => {
              void updateSettings({ appearance: APPEARANCES[index].id });
            }}
            accessibilityLabel="Appearance"
          />
        </View>
      </View>

      {/* ORB THEME — premium-gated (the paywall advertises orb themes as
          premium). Real persistence via settings.orbTheme. */}
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row
          theme={theme}
          label="Orb Theme"
          value={
            ORB_THEMES.find((o) => o.id === settings.orbTheme)?.label ?? 'Dawn'
          }
          icon={{ ios: 'sparkles', android: 'auto_awesome' }}
          chevron
          pro={!isPremium}
          last={!orbPickerOpen}
          accessibilityLabel={
            isPremium
              ? `Orb theme, currently ${ORB_THEMES.find((o) => o.id === settings.orbTheme)?.label ?? 'Dawn'}. Tap to change.`
              : 'Orb theme, Sovereign members only. Tap to see plans.'
          }
          onPress={() => {
            if (!isPremium) {
              router.push('/paywall');
              return;
            }
            setOrbPickerOpen((open) => !open);
          }}
        />
        {isPremium && orbPickerOpen && (
          <View style={styles.segmentedWrap}>
            <SegmentedControl
              segments={ORB_THEMES.map((o) => o.label)}
              selectedIndex={Math.max(
                0,
                ORB_THEMES.findIndex((o) => o.id === settings.orbTheme)
              )}
              onChange={(index) => {
                void updateSettings({ orbTheme: ORB_THEMES[index].id });
              }}
              accessibilityLabel="Orb theme"
            />
          </View>
        )}
      </View>

      {/* DATA & PRIVACY */}
      <SectionHeader title="Data & Privacy" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row
          theme={theme}
          label="Backup & Restore"
          icon={{ ios: 'arrow.triangle.2.circlepath', android: 'sync' }}
          chevron
          accessibilityLabel="Backup and restore. Tap to choose."
          onPress={handleBackupRestore}
        />
        <Row
          theme={theme}
          label="Export Recovery Data"
          icon={{ ios: 'square.and.arrow.up', android: 'share' }}
          chevron
          pro={!isPremium}
          accessibilityLabel={
            isPremium
              ? 'Export recovery data'
              : 'Export recovery data, Sovereign members only. Tap to see plans.'
          }
          onPress={handleExport}
        />
        <Row
          theme={theme}
          label="Reset All Progress"
          icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning' }}
          iconTone="danger"
          labelColor={c.danger}
          last
          accessibilityLabel="Reset all progress. This cannot be undone."
          onPress={handleErase}
        />
      </View>

      {/* ABOUT */}
      <SectionHeader title="About" />
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        <Row
          theme={theme}
          label="Privacy Policy"
          icon={{ ios: 'lock.shield.fill', android: 'shield' }}
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
          label="Terms"
          icon={{ ios: 'doc.text.fill', android: 'description' }}
          chevron
          onPress={() => void Linking.openURL(APPLE_STANDARD_EULA)}
        />
        <Row
          theme={theme}
          label="Support"
          icon={{ ios: 'headphones', android: 'headset_mic' }}
          chevron
          onPress={() =>
            openLink(
              SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : '',
              'The support inbox is set up before launch.'
            )
          }
        />
        <Row
          theme={theme}
          label="Version"
          value={version}
          icon={{ ios: 'info.circle.fill', android: 'info' }}
          last
        />
      </View>

      <Text style={[styles.footer, { color: c.metadata }]}>
        Private by design — everything stays on this device.
      </Text>

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
  skelContent: { paddingTop: spacing.sm },
  skelGap: { marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  title: { ...typeScale.largeTitle },
  subtitle: { ...typeScale.body, marginTop: spacing.xs, marginBottom: spacing.md },
  group: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  rowLabel: { ...typeScale.headline, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typeScale.body, ...typeScale.tabular },
  chevronIcon: { width: 12, height: 16 },
  pressed: { opacity: 0.7 },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  proPillText: { ...typeScale.caption, fontWeight: '700', letterSpacing: 1 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    minHeight: 76,
  },
  upsellText: { flex: 1, gap: 2 },
  upsellTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  upsellTitle: { ...typeScale.headline },
  upsellSub: { ...typeScale.footnote },
  upgradePill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  upgradeText: { ...typeScale.headline },
  segmentedWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  footer: {
    ...typeScale.footnote,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
