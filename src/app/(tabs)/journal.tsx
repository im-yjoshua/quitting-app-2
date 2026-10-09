/**
 * Journal tab — v3 rebuild (plan §3.6).
 *
 * - Month-style grouped list of text entries (same day-grouping contract
 *   the v2 screen used: groupEntriesByDay / formatDayHeader).
 * - Swipe-to-delete: trailing red action, trash icon + "Delete" label,
 *   confirmation dialog → the same removeJournalEntry action from
 *   AppStateContext (v2's long-press contract, upgraded to the swipe
 *   pattern users expect).
 * - Composer: bottom sheet (ui/Sheet), large text area, keyboard-tracked
 *   via a keyboard-height listener (no new deps).
 * - Voice entries (premium): waveform row; free users get a lock row →
 *   paywall. VoiceNoteRecorder reused as-is behind the entitlement check.
 * - Apple-style empty state: journal symbol, "No entries yet", one
 *   inverted button.
 * - Five states: loading skeleton, empty, error-with-retry (voice list),
 *   content.
 */
import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

import { CravingDots, type CravingValue } from '../../../components/CravingDots';
import { VoiceNoteRecorder } from '../../../components/VoiceNoteRecorder';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FAB } from '../../../components/ui/FAB';
import { GhostButton } from '../../../components/ui/GhostButton';
import { InvertedButton } from '../../../components/ui/InvertedButton';
import { Screen } from '../../../components/ui/Screen';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { Sheet } from '../../../components/ui/Sheet';
import { Skeleton } from '../../../components/ui/Skeleton';
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
import { radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

function formatDuration(millis: number): string {
  const s = Math.floor(millis / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Trailing swipe action — red, labeled, icon + text (ios-native rule). */
function DeleteAction({
  onPress,
  theme,
  label,
}: {
  onPress: () => void;
  theme: Theme;
  label: string;
}) {
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.deleteAction, { backgroundColor: c.danger }]}
    >
      <SymbolView name="trash" tintColor={c.onAccent} style={styles.deleteIcon} />
      <Text style={[styles.deleteLabel, { color: c.onAccent }]}>Delete</Text>
    </Pressable>
  );
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
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <DeleteAction onPress={confirmDelete} theme={theme} label="Delete check-in" />
      )}
    >
      {/* Grouped for VoiceOver (time + note as one unit); the swipe
          action is also exposed as a delete accessibility action. */}
      <View
        accessible
        accessibilityLabel={
          `Check-in${entry.craving !== null ? `, craving ${entry.craving} of 5` : ''}, ` +
          `${formatTime(entry.createdAt)}: ${entry.note}`
        }
        accessibilityActions={[{ name: 'delete', label: 'Delete check-in' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') confirmDelete();
        }}
        style={[
          styles.entry,
          !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
        ]}
      >
        <View style={styles.entryTop}>
          {entry.craving !== null && (
            <View style={[styles.chip, { borderColor: c.hairline }]}>
              <Text style={[styles.chipText, { color: c.metadata }]}>
                Craving {entry.craving}/5
              </Text>
            </View>
          )}
          <Text style={[styles.entryTime, { color: c.metadata }]}>
            {formatTime(entry.createdAt)}
          </Text>
        </View>
        <Text style={[styles.entryNote, { color: c.text }]}>{entry.note}</Text>
      </View>
    </Swipeable>
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
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <DeleteAction onPress={confirmDelete} theme={theme} label="Delete voice note" />
      )}
    >
      <View
        style={[
          styles.entry,
          !last && { borderBottomWidth: 1, borderBottomColor: c.hairline },
        ]}
      >
        {/* Metadata grouped for VoiceOver with its own delete action; the
            play button stays a separate target. */}
        <View
          accessible
          accessibilityLabel={`Voice note, ${formatDuration(entry.durationMillis)}`}
          accessibilityActions={[{ name: 'delete', label: 'Delete voice note' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') confirmDelete();
          }}
          style={styles.entryTop}
        >
          <View style={[styles.chip, { borderColor: c.hairline }]}>
            <Text style={[styles.chipText, { color: c.metadata }]}>
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
            hitSlop={8}
            style={[styles.voicePlay, { backgroundColor: c.text }]}
          >
            <SymbolView
              name={playing ? 'pause.fill' : 'play.fill'}
              tintColor={c.background}
              style={styles.voicePlayIcon}
            />
          </Pressable>
          {/* Waveform placeholder — the row reads as a voice entry. */}
          <View
            style={[
              styles.voiceWave,
              { backgroundColor: c.background, borderColor: c.hairline },
            ]}
          />
        </View>
      </View>
    </Swipeable>
  );
}

function ComposerSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (note: string, craving: CravingValue) => Promise<void>;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [note, setNote] = useState('');
  const [craving, setCraving] = useState<CravingValue>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard-tracked sheet without new deps: lift the content above the
  // keyboard by its reported height.
  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  if (!visible) return null;

  const canSave = note.trim().length > 0 && !saving;
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(note.trim(), craving);
      Keyboard.dismiss();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} testID="composer-sheet">
      <View
        style={[styles.composer, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }]}
      >
        <View style={styles.composerHead}>
          <Text style={[styles.composerTitle, { color: c.text }]}>
            New check-in
          </Text>
          <GhostButton title="Cancel" onPress={onClose} />
        </View>
        <Text style={[styles.composerLabel, { color: c.text }]}>
          How’s the craving right now?
        </Text>
        <CravingDots value={craving} onChange={setCraving} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What's on your mind?"
          placeholderTextColor={c.metadata}
          multiline
          autoFocus
          maxLength={1000}
          textAlignVertical="top"
          style={[
            styles.noteInput,
            {
              backgroundColor: c.surface,
              color: c.text,
              borderColor: c.hairline,
            },
          ]}
        />
        <InvertedButton
          title={saving ? 'Saving…' : 'Save check-in'}
          onPress={() => void handleSave()}
          disabled={!canSave}
          accessibilityLabel="Save check-in"
        />
      </View>
    </Sheet>
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

function JournalSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton width="40%" height={40} style={styles.skelTitle} />
      <Skeleton width="100%" height={150} />
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={180} />
    </View>
  );
}

export default function JournalScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading, addJournal, removeJournalEntry } = useAppState();
  const { isPremium } = usePremium();
  const [composerOpen, setComposerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceEntries, setVoiceEntries] = useState<VoiceJournalEntry[]>([]);
  const [voiceError, setVoiceError] = useState(false);

  // Voice entries merge into the timeline; behind the gate this stays
  // empty — the pipeline is real, just locked.
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

  useEffect(() => {
    if (!loading && state && !state.quit) router.replace('/onboarding');
  }, [loading, state]);

  const retryVoiceLoad = () => {
    setVoiceError(false);
    void listVoiceJournals()
      .then(setVoiceEntries)
      .catch(() => setVoiceError(true));
  };

  const handleSave = async (note: string, craving: CravingValue) => {
    await addJournal(note, craving);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openVoice = () => {
    if (isPremium) {
      setVoiceOpen(true);
    } else {
      router.push('/paywall');
    }
  };

  if (loading || !state) {
    return (
      <Screen>
        <JournalSkeleton />
      </Screen>
    );
  }
  if (!state.quit) return null; // redirecting to onboarding

  const groups = groupEntriesByDay(state.journal);
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const hasAnything = groups.length > 0 || voiceEntries.length > 0;

  return (
    <Screen>
      <GestureHandlerRootView style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, !hasAnything && !voiceError && styles.contentEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: c.text }]}>Journal</Text>

          {!hasAnything && !voiceError ? (
            <EmptyState
              iosSymbol="book.closed"
              androidSymbol="book"
              title="No entries yet"
              message="The first one is the hardest — and the most honest."
              actionLabel="Write a check-in"
              onAction={() => setComposerOpen(true)}
            />
          ) : (
            <>
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
                    accessibilityLabel="Retry loading voice notes"
                    onPress={retryVoiceLoad}
                    hitSlop={12}
                    style={styles.retry}
                  >
                    <Text style={[styles.retryText, { color: c.accent }]}>
                      Try again
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Voice notes — waveform rows, or the lock affordance. */}
              <SectionHeader title="Voice notes" />
              <View style={[styles.block, { backgroundColor: c.surface }]}>
                {voiceEntries.map((v, i) => (
                  <VoiceEntryRow
                    key={v.id}
                    entry={v}
                    onDeleted={setVoiceEntries}
                    theme={theme}
                    last={isPremium ? i === voiceEntries.length - 1 : false}
                  />
                ))}
                {!isPremium && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Voice notes are a Sovereign feature. Open plans."
                    onPress={() => router.push('/paywall')}
                    style={({ pressed }) => [
                      styles.lockRow,
                      voiceEntries.length > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: c.hairline,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name="lock.fill"
                      tintColor={c.metadata}
                      style={styles.lockIcon}
                    />
                    <View style={styles.lockText}>
                      <Text style={[styles.lockTitle, { color: c.text }]}>
                        Voice notes
                      </Text>
                      <Text style={[styles.lockSub, { color: c.metadata }]}>
                        A Sovereign feature — record instead of typing.
                      </Text>
                    </View>
                    <SymbolView
                      name="chevron.right"
                      tintColor={c.metadata}
                      style={styles.lockChevron}
                    />
                  </Pressable>
                )}
                {isPremium && voiceEntries.length === 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Record a voice note"
                    onPress={openVoice}
                    style={({ pressed }) => [
                      styles.lockRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name="mic.fill"
                      tintColor={c.accent}
                      style={styles.lockIcon}
                    />
                    <View style={styles.lockText}>
                      <Text style={[styles.lockTitle, { color: c.text }]}>
                        Record your first voice note
                      </Text>
                      <Text style={[styles.lockSub, { color: c.metadata }]}>
                        Some days are easier said than written.
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>

              {groups.map((group) => (
                <View key={group.dayKey}>
                  <SectionHeader
                    title={formatDayHeader(group.dayKey, nowMs)}
                  />
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
            </>
          )}
        </ScrollView>

        {/* Composer FAB — accent fill, the one colored spot. */}
        <View style={styles.fabWrap} pointerEvents="box-none">
          <FAB
            iosSymbol="plus"
            androidSymbol="add"
            label="New journal entry"
            onPress={() => setComposerOpen(true)}
          />
        </View>

        <ComposerSheet
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          onSave={handleSave}
        />
        <VoiceRecorderSheet
          visible={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          onSaved={setVoiceEntries}
        />
      </GestureHandlerRootView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96,
  },
  contentEmpty: { flexGrow: 1 },
  title: { ...typeScale.largeTitle, marginBottom: spacing.md },
  block: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  entry: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'transparent',
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { ...typeScale.footnote, fontWeight: '600' },
  entryTime: { ...typeScale.footnote },
  entryNote: { ...typeScale.body, lineHeight: 24 },
  pressed: { opacity: 0.7 },
  // Swipe delete action
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteIcon: { width: 22, height: 22 },
  deleteLabel: {
    ...typeScale.footnote,
    fontWeight: '600',
  },
  // Voice rows
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
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
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  lockIcon: { width: 22, height: 22 },
  lockText: { flex: 1, gap: 2 },
  lockTitle: { ...typeScale.headline },
  lockSub: { ...typeScale.footnote },
  lockChevron: { width: 14, height: 14 },
  // Composer
  composer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTitle: { ...typeScale.title3 },
  composerLabel: { ...typeScale.headline },
  noteInput: {
    ...typeScale.body,
    minHeight: 160,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  recorderWrap: { padding: spacing.lg, gap: spacing.md },
  // States
  errorTitle: { ...typeScale.headline, paddingTop: spacing.md },
  errorBody: { ...typeScale.footnote, marginTop: 2 },
  retry: {
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { ...typeScale.headline },
  fabWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  skelTitle: { marginBottom: spacing.md },
});
