/**
 * Journal tab (spec §2.7).
 *
 * - Check-in composer: craving 1–5 + note → JournalEntry (text is free
 *   and unlimited).
 * - Timeline: reverse-chron entries grouped by day ("Today"/"Yesterday"/
 *   short date). Long-press an entry to delete it.
 * - Voice notes: the mic button is premium-gated — non-members route to the
 *   real paywall (/paywall); members get the real recording pipeline
 *   (components/VoiceNoteRecorder + services/voiceJournal + expo-audio)
 *   mounted behind the entitlement check.
 * - Voice entries (once they exist) render a play/delete row.
 */
import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CravingDots,
  type CravingValue,
} from '../../../components/CravingDots';
import { GlassButton } from '../../../components/glass/GlassButton';
import { GlassCard } from '../../../components/glass/GlassCard';
import { Screen } from '../../../components/glass/Screen';
import { VoiceNoteRecorder } from '../../../components/VoiceNoteRecorder';
import { usePremium } from '../../../hooks/usePremium';
import {
  deleteVoiceJournal,
  listVoiceJournals,
  type VoiceJournalEntry,
} from '../../../services/voiceJournal';
import {
  formatDayHeader,
  groupEntriesByDay,
} from '../../../services/journal';
import { useAppState } from '../../../state/AppStateContext';
import type { JournalEntry } from '../../../types/app';
import { colors, radii, spacing, type } from '../../../theme/tokens';

function formatDuration(millis: number): string {
  const s = Math.floor(millis / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function cravingSeverityColor(value: number): string {
  if (value <= 2) return colors.success;
  if (value === 3) return colors.warning;
  return colors.danger;
}

function TextEntryRow({
  entry,
  onDelete,
}: {
  entry: JournalEntry;
  onDelete: (id: string) => void;
}) {
  const time = new Date(entry.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const confirmDelete = () =>
    Alert.alert("Delete this check-in?", "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(entry.id),
      },
    ]);
  return (
    <Pressable
      onLongPress={confirmDelete}
      delayLongPress={500}
      style={styles.entry}
    >
      {entry.craving !== null && (
        <View
          style={[
            styles.severityBar,
            { backgroundColor: cravingSeverityColor(entry.craving) },
          ]}
        />
      )}
      <View style={styles.entryTop}>
        {entry.craving !== null && (
          <View style={styles.cravingChip}>
            <Text style={styles.cravingChipText}>
              Craving {entry.craving}/5
            </Text>
          </View>
        )}
        <Text style={styles.entryTime}>{time}</Text>
      </View>
      <Text style={styles.entryNote}>{entry.note}</Text>
    </Pressable>
  );
}

function VoiceEntryRow({
  entry,
  onDeleted,
}: {
  entry: VoiceJournalEntry;
  onDeleted: (entries: VoiceJournalEntry[]) => void;
}) {
  const player = useAudioPlayer(entry.uri);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete this voice note?',
      'The recording will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteVoiceJournal(entry.id).then(onDeleted);
          },
        },
      ]
    );

  return (
    <View style={styles.entry}>
      <View style={styles.entryTop}>
        <View style={styles.voiceChip}>
          <Text style={styles.voiceChipText}>🎙️ Voice note</Text>
        </View>
        <Text style={styles.entryTime}>
          {formatDuration(entry.durationMillis)}
        </Text>
      </View>
      <View style={styles.voiceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          onPress={toggle}
          style={styles.voicePlay}
        >
          <Text style={styles.voicePlayText}>{playing ? '⏸' : '▶️'}</Text>
        </Pressable>
        <View style={styles.voiceWave} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete voice note"
          onPress={confirmDelete}
          style={styles.voiceDelete}
        >
          <Text style={styles.voiceDeleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VoiceRecorderSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (entries: VoiceJournalEntry[]) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <GlassCard style={styles.sheetCard}>
            <VoiceNoteRecorder
              onSaved={(entries) => {
                onSaved(entries);
                onClose();
              }}
              onCancel={onClose}
            />
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function JournalScreen() {
  const { state, loading, addJournal, removeJournalEntry } = useAppState();
  const [note, setNote] = useState('');
  const [craving, setCraving] = useState<CravingValue>(null);
  const [saving, setSaving] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { isPremium } = usePremium();
  const [voiceEntries, setVoiceEntries] = useState<VoiceJournalEntry[]>([]);

  // Voice entries merge into the timeline once the gate opens (Day 5).
  // Behind the gate this stays empty — the pipeline is real, just locked.
  useEffect(() => {
    void listVoiceJournals()
      .then(setVoiceEntries)
      .catch(() => setVoiceEntries([]));
  }, []);

  const handleSave = async () => {
    const trimmed = note.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await addJournal(trimmed, craving);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNote('');
      setCraving(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const groups = groupEntriesByDay(state.journal);
  // "Now" at render time — idempotent within a render, safe here.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const hasAnything = groups.length > 0 || voiceEntries.length > 0;
  const canSave = note.trim().length > 0 && !saving;

  return (
    <Screen>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Journal</Text>

        <GlassCard style={styles.composer}>
          <Text style={styles.composerLabel}>How’s the craving right now?</Text>
          <CravingDots value={craving} onChange={setCraving} />
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <View style={styles.composerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isPremium
                  ? 'Record a voice note'
                  : 'Record a voice note (Sovereign members only)'
              }
              onPress={() => {
                if (isPremium) {
                  setVoiceOpen(true);
                } else {
                  router.push('/paywall');
                }
              }}
              style={styles.micButton}
            >
              <Text style={styles.micText}>{isPremium ? '🎙️' : '🎙️ 🔒'}</Text>
            </Pressable>
            <View style={styles.saveWrap}>
              <GlassButton
                title={saving ? 'Saving…' : 'Save check-in'}
                onPress={handleSave}
                disabled={!canSave}
              />
            </View>
          </View>
        </GlassCard>

        {!hasAnything && (
          <Text style={styles.empty}>
            No check-ins yet. The first one is the hardest — and the most
            honest.
          </Text>
        )}

        {voiceEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.dayHeader}>Voice notes</Text>
            {voiceEntries.map((v) => (
              <VoiceEntryRow
                key={v.id}
                entry={v}
                onDeleted={setVoiceEntries}
              />
            ))}
          </View>
        )}

        {groups.map((group) => (
          <View key={group.dayKey} style={styles.section}>
            <Text style={styles.dayHeader}>
              {formatDayHeader(group.dayKey, nowMs)}
            </Text>
            {group.entries.map((entry) => (
              <TextEntryRow
                key={entry.id}
                entry={entry}
                onDelete={(id) => {
                  void removeJournalEntry(id);
                }}
              />
            ))}
          </View>
        ))}

        {hasAnything && (
          <Text style={styles.hint}>
            Tip: long-press an entry to delete it.
          </Text>
        )}
      </ScrollView>

      <VoiceRecorderSheet
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSaved={setVoiceEntries}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: { ...type.title, color: colors.text, marginTop: spacing.sm },
  composer: { padding: spacing.lg, gap: spacing.md },
  composerLabel: { ...type.callout, color: colors.textSecondary },
  noteInput: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.backgroundElement,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    minHeight: 88,
  },
  composerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  micButton: {
    width: 56,
    borderRadius: radii.md,
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micText: { fontSize: 20 },
  saveWrap: { flex: 1 },
  empty: {
    ...type.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 24,
  },
  section: { gap: spacing.sm },
  dayHeader: { ...type.micro, color: colors.textTertiary, marginTop: spacing.sm },
  entry: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  severityBar: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cravingChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cravingChipText: { ...type.caption, color: colors.accent },
  entryTime: { ...type.caption, color: colors.textTertiary },
  entryNote: { ...type.body, color: colors.text, lineHeight: 22 },
  voiceChip: {
    backgroundColor: colors.backgroundElement,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  voiceChipText: { ...type.caption, color: colors.textSecondary },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voicePlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayText: { fontSize: 16 },
  voiceWave: {
    flex: 1,
    height: 24,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundElement,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  voiceDelete: { paddingVertical: spacing.sm },
  voiceDeleteText: { ...type.callout, color: colors.textTertiary },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetCard: {
    width: '100%',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
});
