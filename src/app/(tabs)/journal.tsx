/**
 * Journal tab (spec §2.7).
 *
 * - Check-in composer: craving 1–5 + note → JournalEntry (text is free
 *   and unlimited).
 * - Timeline: reverse-chron entries grouped by day ("Today"/"Yesterday"/
 *   short date) in iOS grouped-inset blocks. Long-press an entry to delete.
 * - Voice notes: the mic button is premium-gated — non-members route to the
 *   real paywall (/paywall); members get the real recording pipeline
 *   (components/VoiceNoteRecorder + services/voiceJournal + expo-audio)
 *   mounted behind the entitlement check.
 * - Voice entries (once they exist) render a play/delete row.
 *
 * Monochrome reskin: grouped surface blocks, full-brightness type,
 * Apple-style empty state, inline error with retry for voice-load
 * failures.
 */
import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { EmptyState } from '../../../components/EmptyState';
import { Skeleton } from '../../../components/Skeleton';
import { GlassButton } from '../../../components/glass/GlassButton';
import { Screen } from '../../../components/glass/Screen';
import { Sheet } from '../../../components/glass/Sheet';
import { TextField } from '../../../components/glass/TextField';
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
import { radii, spacing, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

function formatDuration(millis: number): string {
  const s = Math.floor(millis / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TextEntryRow({
  entry,
  onDelete,
  theme,
  last,
}: {
  entry: JournalEntry;
  onDelete: (id: string) => void;
  theme: Theme;
  last: boolean;
}) {
  const c = theme.colors;
  const time = new Date(entry.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const confirmDelete = () =>
    Alert.alert('Delete this check-in?', "This can't be undone.", [
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
      style={({ pressed }) => [
        styles.entry,
        !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.entryTop}>
        {entry.craving !== null && (
          <View style={[styles.cravingChip, { borderColor: c.hairline }]}>
            <Text style={[styles.cravingChipText, { color: c.metadata }]}>
              Craving {entry.craving}/5
            </Text>
          </View>
        )}
        <Text style={[styles.entryTime, { color: c.metadata }]}>
          {time}
        </Text>
      </View>
      <Text style={[styles.entryNote, { color: c.text }]}>{entry.note}</Text>
    </Pressable>
  );
}

function VoiceEntryRow({
  entry,
  onDeleted,
  theme,
  last,
}: {
  entry: VoiceJournalEntry;
  onDeleted: (entries: VoiceJournalEntry[]) => void;
  theme: Theme;
  last: boolean;
}) {
  const c = theme.colors;
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
    <View
      style={[
        styles.entry,
        !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
      ]}
    >
      <View style={styles.entryTop}>
        <View style={[styles.voiceChip, { borderColor: c.hairline }]}>
          <Text style={[styles.voiceChipText, { color: c.metadata }]}>
            Voice note
          </Text>
        </View>
        <Text style={[styles.entryTime, { color: c.metadata }]}>
          {formatDuration(entry.durationMillis)}
        </Text>
      </View>
      <View style={styles.voiceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          onPress={toggle}
          style={[styles.voicePlay, { backgroundColor: c.accent }]}
        >
          <SymbolView
            name={playing ? 'pause.fill' : 'play.fill'}
            tintColor={c.onAccent}
            style={styles.voicePlayIcon}
          />
        </Pressable>
        <View
          style={[
            styles.voiceWave,
            { backgroundColor: c.background, borderColor: c.hairline },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete voice note"
          onPress={confirmDelete}
          style={styles.voiceDelete}
        >
          <Text style={[styles.voiceDeleteText, { color: c.metadata }]}>
            Delete
          </Text>
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
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.recorderWrap}>
        <VoiceNoteRecorder
          onSaved={(entries) => {
            onSaved(entries);
            onClose();
          }}
          onCancel={onClose}
        />
      </View>
    </Sheet>
  );
}

export default function JournalScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading, addJournal, removeJournalEntry } = useAppState();
  const [note, setNote] = useState('');
  const [craving, setCraving] = useState<CravingValue>(null);
  const [saving, setSaving] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { isPremium } = usePremium();
  const [voiceEntries, setVoiceEntries] = useState<VoiceJournalEntry[]>([]);
  const [voiceError, setVoiceError] = useState(false);
  const composerRef = useRef<TextInput>(null);

  // Voice entries merge into the timeline once the gate opens (Day 5).
  // Behind the gate this stays empty — the pipeline is real, just locked.
  useEffect(() => {
    let cancelled = false;
    void listVoiceJournals()
      .then((entries) => {
        if (!cancelled) setVoiceEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setVoiceError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retryVoiceLoad = () => {
    setVoiceError(false);
    void listVoiceJournals()
      .then(setVoiceEntries)
      .catch(() => setVoiceError(true));
  };

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
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Skeleton width="40%" height={40} style={styles.skelTitle} />
          <Skeleton width="100%" height={230} />
          <Skeleton width="100%" height={120} />
        </ScrollView>
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
        <Text style={[styles.title, { color: c.text }]}>Journal</Text>

        <View style={[styles.composer, { backgroundColor: c.surface }]}>
          <Text style={[styles.composerLabel, { color: c.text }]}>
            How’s the craving right now?
          </Text>
          <CravingDots value={craving} onChange={setCraving} />
          <TextField
            ref={composerRef}
            value={note}
            onChangeText={setNote}
            placeholder="What's on your mind?"
            multiline
            maxLength={1000}
            inputStyle={styles.noteInput}
            style={styles.noteField}
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
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isPremium) {
                  setVoiceOpen(true);
                } else {
                  router.push('/paywall');
                }
              }}
              style={({ pressed }) => [
                styles.micButton,
                { backgroundColor: c.background },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{ ios: 'mic.fill' as never, android: 'mic' as never }}
                tintColor={isPremium ? c.accent : c.metadata}
                style={styles.micIcon}
              />
            </Pressable>
            <View style={styles.saveWrap}>
              <GlassButton
                title={saving ? 'Saving…' : 'Save check-in'}
                onPress={handleSave}
                disabled={!canSave}
              />
            </View>
          </View>
        </View>

        {!hasAnything && !voiceError && (
          <EmptyState
            symbol="book.closed"
            materialSymbol="book"
            headline="No check-ins yet"
            body="The first one is the hardest — and the most honest."
            actionTitle="Write a check-in"
            onAction={() => composerRef.current?.focus()}
          />
        )}

        {voiceError && (
          <View style={[styles.block, { backgroundColor: c.surface }]}>
            <Text style={[styles.errorTitle, { color: c.text }]}>
              Couldn’t load voice notes
            </Text>
            <Text style={[styles.errorBody, { color: c.metadata }]}>
              Your text check-ins are safe. This is just the voice list.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retryVoiceLoad}
              style={styles.retry}
            >
              <Text style={[styles.retryText, { color: c.accent }]}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {voiceEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.dayHeader, { color: c.metadata }]}>
              VOICE NOTES
            </Text>
            <View style={[styles.block, { backgroundColor: c.surface }]}>
              {voiceEntries.map((v, i) => (
                <VoiceEntryRow
                  key={v.id}
                  entry={v}
                  onDeleted={setVoiceEntries}
                  theme={theme}
                  last={i === voiceEntries.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {groups.map((group) => (
          <View key={group.dayKey} style={styles.section}>
            <Text style={[styles.dayHeader, { color: c.metadata }]}>
              {formatDayHeader(group.dayKey, nowMs).toUpperCase()}
            </Text>
            <View style={[styles.block, { backgroundColor: c.surface }]}>
              {group.entries.map((entry, i) => (
                <TextEntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={(id) => {
                    void removeJournalEntry(id);
                  }}
                  theme={theme}
                  last={i === group.entries.length - 1}
                />
              ))}
            </View>
          </View>
        ))}

        {hasAnything && (
          <Text style={[styles.hint, { color: c.metadata }]}>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  title: { ...type.largeTitle },
  composer: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  composerLabel: { ...type.headline },
  noteField: {},
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  composerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  micButton: {
    width: 56,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: { width: 22, height: 22 },
  pressed: { opacity: 0.7 },
  saveWrap: { flex: 1 },
  section: { gap: spacing.sm },
  dayHeader: {
    ...type.footnote,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  block: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  entry: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cravingChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cravingChipText: { ...type.caption, fontWeight: '600' },
  entryTime: { ...type.caption },
  entryNote: { ...type.body, lineHeight: 24 },
  voiceChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  voiceChipText: { ...type.caption, fontWeight: '600' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voicePlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayIcon: { width: 18, height: 18 },
  voiceWave: {
    flex: 1,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  voiceDelete: { paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  voiceDeleteText: { ...type.headline },
  hint: {
    ...type.footnote,
    textAlign: 'center',
  },
  errorTitle: { ...type.headline, paddingTop: spacing.md },
  errorBody: { ...type.subhead, marginTop: 2 },
  retry: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  retryText: { ...type.headline },
  recorderWrap: { padding: spacing.lg, gap: spacing.md },
  skelTitle: { marginBottom: spacing.xs },
});
