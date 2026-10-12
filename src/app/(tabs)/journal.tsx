/**
 * Journal tab — v4 Stitch rebuild (Phase 5).
 *
 * "Reflections": matches Joshua's approved Google Stitch journal reference
 * as closely as native allows:
 * - Title + real subtitle ("{N} days of clarity · {M} entries"); violet
 *   "+ New Entry" pill → the existing composer sheet.
 * - Search bar (client-side filter) + filter chips (All entries /
 *   Reflections / Urges Logged / Voice) filtering our real entry types:
 *   text reflections, craving-rated check-ins, voice memos.
 * - Day groups ("Today · Day N") with a real integrity pill (from the
 *   relapse log — never invented); entry cards (type pill, time, body,
 *   craving footer); voice cards (real audio player, waveform, duration,
 *   PRO pill — premium-gated per services/purchases.ts); milestone anchor
 *   cards (real achieved milestones, honest per-category copy — the
 *   reference's "Prefrontal cortex density +14%" claim is forbidden and
 *   does not appear); bottom CTA card → urge surf ("Begin").
 * - Swipe-to-delete on text + voice rows (the v3 contract, kept).
 *
 * Presentation only: every entry comes from AppState / voiceJournal;
 * services/*, state/* and __tests__/* are untouched.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import {
  EmptyState,
  GhostButton,
  InvertedButton,
  Screen,
  Sheet,
  Skeleton,
} from '../../../components/ui';
import { usePremium } from '../../../hooks/usePremium';
import {
  deleteVoiceJournal,
  listVoiceJournals,
  type VoiceJournalEntry,
} from '../../../services/voiceJournal';
import { formatDayHeader } from '../../../services/journal';
import { getLocalDateKey, MS_PER_DAY } from '../../../services/chronometerEngine';
import { healthTimelineFor } from '../../../services/healthTimeline';
import { MILESTONES } from '../../../services/milestones';
import { cleanDaysFloor } from '../../../services/savings';
import { useAppState } from '../../../state/AppStateContext';
import type { JournalEntry, QuitCategory } from '../../../types/app';
import { radii, spacing, type as typeScale } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import type { Theme } from '../../../theme/tokens';

type Filter = 'all' | 'reflections' | 'urges' | 'voice';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All entries' },
  { key: 'reflections', label: 'Reflections' },
  { key: 'urges', label: 'Urges Logged' },
  { key: 'voice', label: 'Voice' },
];

/** Small SF-Symbol / Material-Symbol icon (no new native deps). */
function Icon({
  ios,
  android,
  size = 18,
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

function milestoneLabel(m: number): string {
  if (m === 1) return 'First day clean';
  if (m === 365) return 'One full year clean';
  return `${m} days clean`;
}

/** Honest per-category copy for a milestone, or null when none aligns. */
function milestoneDetail(
  category: QuitCategory,
  milestoneDays: number,
  prevMilestoneDays: number
): string | null {
  const lo = prevMilestoneDays * MS_PER_DAY;
  const hi = milestoneDays * MS_PER_DAY;
  const hits = healthTimelineFor(category).filter(
    (h) => h.atMs > lo && h.atMs <= hi
  );
  if (hits.length === 0) return null;
  const h = hits[hits.length - 1];
  return `${h.label} · ${h.detail}`;
}

/** Trailing swipe action — red, labeled, icon + text. */
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
      <Icon ios="trash" android="delete" size={22} color={c.onAccent} />
      <Text style={[styles.deleteLabel, { color: c.onAccent }]}>Delete</Text>
    </Pressable>
  );
}

function TextEntryCard({
  entry,
  onDelete,
  theme,
}: {
  entry: JournalEntry;
  onDelete: (id: string) => void;
  theme: Theme;
}) {
  const c = theme.colors;
  const rated = entry.craving !== null;
  const confirmDelete = () =>
    Alert.alert('Delete this check-in?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <DeleteAction onPress={confirmDelete} theme={theme} label="Delete check-in" />
      )}
    >
      <View
        accessible
        accessibilityLabel={
          `${rated ? 'Urge logged' : 'Reflection'}, ${formatTime(entry.createdAt)}` +
          `${rated ? `, craving ${entry.craving} of 5` : ''}: ${entry.note}`
        }
        accessibilityActions={[{ name: 'delete', label: 'Delete check-in' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') confirmDelete();
        }}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}
      >
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <View
              style={[
                styles.typePill,
                {
                  backgroundColor: rated ? c.surfaceDeep : c.accentSoft,
                },
              ]}
            >
              <Icon
                ios={rated ? 'bolt.fill' : 'square.and.pencil'}
                android={rated ? 'bolt' : 'edit_note'}
                size={11}
                color={rated ? c.danger : c.accent}
              />
              <Text
                style={[
                  styles.typePillText,
                  { color: rated ? c.danger : c.accent },
                ]}
              >
                {rated ? 'Urge Logged' : 'Reflection'}
              </Text>
            </View>
            <Text style={[styles.cardTime, { color: c.muted }, typeScale.tabular]}>
              {formatTime(entry.createdAt)}
            </Text>
          </View>
          {rated && (
            <View style={[styles.cravingPill, { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.cravingPillText, { color: c.accent }]}>
                Craving {entry.craving}/5
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.cardBody, { color: c.text }]}
          numberOfLines={4}
        >
          {entry.note}
        </Text>
      </View>
    </Swipeable>
  );
}

// Deterministic waveform heights (stable per entry, no randomness).
const WAVE_BARS = [10, 16, 22, 14, 20, 26, 18, 12, 24, 16, 10, 22, 14, 8, 20, 26, 12, 18, 10, 24, 16, 20, 12, 8];
function waveHeights(id: string, count: number): number[] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, i) => WAVE_BARS[(h + i) % WAVE_BARS.length]);
}

function VoiceEntryCard({
  entry,
  onDeleted,
  theme,
}: {
  entry: VoiceJournalEntry;
  onDeleted: (entries: VoiceJournalEntry[]) => void;
  theme: Theme;
}) {
  const c = theme.colors;
  const player = useAudioPlayer(entry.uri);
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => waveHeights(entry.id, 24), [entry.id]);

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

  const title = entry.notes?.trim() ? entry.notes.trim() : 'Voice note';
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <DeleteAction onPress={confirmDelete} theme={theme} label="Delete voice note" />
      )}
    >
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <View style={[styles.typePill, { backgroundColor: c.accentSoft }]}>
              <Icon ios="mic.fill" android="mic" size={11} color={c.accent} />
              <Text style={[styles.typePillText, { color: c.accent }]}>
                Voice Note
              </Text>
            </View>
            <Text style={[styles.cardTime, { color: c.muted }, typeScale.tabular]}>
              {formatTime(entry.createdAt)}
            </Text>
          </View>
          {/* Voice is premium content — the gate lives in services/purchases.ts. */}
          <View
            accessible
            accessibilityLabel="Premium voice note"
            style={[styles.proPill, { backgroundColor: c.accentSoft }]}
          >
            <Icon ios="crown.fill" android="workspace_premium" size={11} color={c.accent} />
            <Text style={[styles.proPillText, { color: c.accent }]}>PRO</Text>
          </View>
        </View>
        <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.player, { backgroundColor: c.surfaceDeep }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
            onPress={toggle}
            hitSlop={8}
            style={[styles.playBtn, { backgroundColor: c.accent }]}
          >
            <Icon
              ios={playing ? 'pause.fill' : 'play.fill'}
              android={playing ? 'pause' : 'play_arrow'}
              size={18}
              color={c.onAccent}
            />
          </Pressable>
          <View
            style={styles.wave}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Waveform, ${formatDuration(entry.durationMillis)} long`}
          >
            {bars.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: h,
                    backgroundColor: i < bars.length * 0.4 ? c.accent : c.hairline,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.duration, { color: c.accent }, typeScale.tabular]}>
            {formatDuration(entry.durationMillis)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}

function MilestoneAnchorCard({
  days,
  category,
  startMs,
  prevDays,
  theme,
}: {
  days: number;
  category: QuitCategory;
  startMs: number;
  prevDays: number;
  theme: Theme;
}) {
  const c = theme.colors;
  const date = new Date(startMs + days * MS_PER_DAY).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const detail =
    milestoneDetail(category, days, prevDays) ??
    (days === 1
      ? 'The hardest day, behind you.'
      : `${days} days of choosing yourself.`);
  return (
    <View
      accessible
      accessibilityLabel={`Milestone: ${milestoneLabel(days)}. ${detail}`}
      style={[styles.anchorWrap, { borderColor: c.hairline }]}
    >
      <LinearGradient
        colors={[c.surface, c.accentSoft]}
        style={styles.anchor}
      >
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <View style={[styles.majorPill, { backgroundColor: c.accent }]}>
              <Icon ios="medal.fill" android="military_tech" size={11} color={c.onAccent} />
              <Text style={[styles.majorPillText, { color: c.onAccent }]}>
                MAJOR MILESTONE
              </Text>
            </View>
            <Text style={[styles.cardTime, { color: c.muted }]}>{date}</Text>
          </View>
          <Text style={[styles.daysFree, { color: c.success }, typeScale.tabular]}>
            {days} DAYS FREE
          </Text>
        </View>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {milestoneLabel(days)}
        </Text>
        <Text style={[styles.cardBody, { color: c.metadata }]} numberOfLines={3}>
          {detail}
        </Text>
        <View style={styles.unlockedRow}>
          <Icon ios="brain.head.profile" android="psychology" size={16} color={c.accent} />
          <Text style={[styles.unlockedText, { color: c.accent }]}>Unlocked</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

function ComposerSheet({
  visible,
  onClose,
  onSave,
  onVoice,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (note: string, craving: CravingValue) => Promise<void>;
  onVoice: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [note, setNote] = useState('');
  const [craving, setCraving] = useState<CravingValue>(null);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const canSave = note.trim().length > 0 && !saving;
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(note.trim(), craving);
      setNote('');
      setCraving(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} testID="composer-sheet">
      <View style={styles.composer}>
        <View style={styles.composerHead}>
          <Text style={[styles.composerTitle, { color: c.text }]}>
            New Journal Entry
          </Text>
          <View style={styles.composerHeadRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Record a voice note instead"
              onPress={() => {
                onClose();
                onVoice();
              }}
              hitSlop={8}
              style={[styles.micBtn, { backgroundColor: c.surfaceDeep }]}
            >
              <Icon ios="mic.fill" android="mic" size={18} color={c.accent} />
            </Pressable>
            <GhostButton title="Cancel" onPress={onClose} />
          </View>
        </View>
        <Text style={[styles.composerLabel, { color: c.text }]}>
          How’s the craving right now?
        </Text>
        <CravingDots value={craving} onChange={setCraving} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What mental shift just took place? How does your body feel?"
          placeholderTextColor={c.metadata}
          multiline
          autoFocus
          maxLength={1000}
          textAlignVertical="top"
          style={[
            styles.noteInput,
            { backgroundColor: c.surface, color: c.text, borderColor: c.hairline },
          ]}
        />
        <InvertedButton
          title={saving ? 'Saving…' : 'Save Reflection'}
          onPress={() => void handleSave()}
          disabled={!canSave}
          accessibilityLabel="Save reflection"
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
      <Skeleton width="100%" height={44} />
      <Skeleton width="100%" height={150} />
      <Skeleton width="100%" height={180} />
    </View>
  );
}

type TimelineItem =
  | { kind: 'text'; entry: JournalEntry }
  | { kind: 'voice'; entry: VoiceJournalEntry };

interface DayGroup {
  dayKey: string;
  items: TimelineItem[];
}

export default function JournalScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { state, loading, addJournal, removeJournalEntry } = useAppState();
  const { isPremium } = usePremium();
  const [nowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceEntries, setVoiceEntries] = useState<VoiceJournalEntry[]>([]);
  const [voiceError, setVoiceError] = useState(false);

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

  const quit = state.quit;
  const startMs = Date.parse(quit.startDate);
  const cleanDays = cleanDaysFloor(quit.startDate, nowMs);
  const q = query.trim().toLowerCase();

  const textEntries = state.journal.filter((e) => {
    if (filter === 'voice') return false;
    if (filter === 'urges' && e.craving === null) return false;
    if (q && !e.note.toLowerCase().includes(q)) return false;
    return true;
  });
  const voiceShown =
    (filter === 'all' || filter === 'voice') &&
    voiceEntries.filter(
      (v) => !q || (v.notes ?? '').toLowerCase().includes(q)
    );

  // Merge text + voice into day groups, newest first.
  const groups: DayGroup[] = (() => {
    const byDay = new Map<string, TimelineItem[]>();
    for (const entry of textEntries) {
      const list = byDay.get(entry.dayKey) ?? [];
      list.push({ kind: 'text', entry });
      byDay.set(entry.dayKey, list);
    }
    if (voiceShown) {
      for (const entry of voiceShown) {
        const key = getLocalDateKey(Date.parse(entry.createdAt));
        const list = byDay.get(key) ?? [];
        list.push({ kind: 'voice', entry });
        byDay.set(key, list);
      }
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([dayKey, items]) => ({
        dayKey,
        items: [...items].sort((a, b) => {
          const ta = a.entry.createdAt;
          const tb = b.entry.createdAt;
          return ta < tb ? 1 : ta > tb ? -1 : 0;
        }),
      }));
  })();

  const totalEntries = state.journal.length + voiceEntries.length;
  const hasContent = groups.length > 0;
  const slipKeys = new Set(
    state.relapseLog
      .map((e) => {
        const ms = Date.parse(e.date);
        return isNaN(ms) ? null : getLocalDateKey(ms);
      })
      .filter((k): k is string => k !== null)
  );
  const todayKey = getLocalDateKey(nowMs);
  const reachedMilestones = MILESTONES.filter((m) => m <= cleanDays);
  const showAnchors = q === '' && filter === 'all' && reachedMilestones.length > 0;

  const dayNumber = (dayKey: string): number | null => {
    if (isNaN(startMs)) return null;
    const [y, m, d] = dayKey.split('-').map(Number);
    const n = Math.floor((new Date(y, m - 1, d).getTime() - startMs) / MS_PER_DAY) + 1;
    return n >= 1 ? n : null;
  };

  return (
    <Screen>
      <GestureHandlerRootView style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            styles.content,
            !hasContent && !voiceError && styles.contentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: c.text }]}>Reflections</Text>
              <Text style={[styles.subtitle, { color: c.metadata }]}>
                {cleanDays} days of clarity · {totalEntries}{' '}
                {totalEntries === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New journal entry"
              onPress={() => setComposerOpen(true)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.newEntry,
                { backgroundColor: c.accentDeep },
                pressed && styles.pressed,
              ]}
            >
              <Icon ios="plus" android="add" size={16} color={c.onAccent} />
              <Text style={[styles.newEntryText, { color: c.onAccent }]}>
                New Entry
              </Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.hairline }]}>
            <Icon ios="magnifyingglass" android="search" size={18} color={c.metadata} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search insights, triggers, or mantras..."
              placeholderTextColor={c.muted}
              returnKeyType="search"
              accessibilityLabel="Search journal entries"
              style={[styles.searchInput, { color: c.text }]}
            />
            {query.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                hitSlop={8}
                style={styles.searchClear}
              >
                <Icon ios="xmark.circle.fill" android="cancel" size={18} color={c.muted} />
              </Pressable>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            style={styles.chipsScroll}
          >
            {FILTERS.map((f) => {
              const selected = filter === f.key;
              const label =
                f.key === 'all' ? `All entries (${totalEntries})` : f.label;
              return (
                <Pressable
                  key={f.key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? c.accentDeep : c.surface,
                      borderColor: selected ? c.accentDeep : c.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? c.onAccent : c.metadata },
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {voiceError && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
              <Text style={[styles.errorTitle, { color: c.text }]}>
                Couldn’t load voice notes
              </Text>
              <Text style={[styles.errorBody, { color: c.metadata }]}>
                Your written entries are safe. This is just the voice list.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading voice notes"
                onPress={retryVoiceLoad}
                hitSlop={12}
                style={styles.retry}
              >
                <Text style={[styles.retryText, { color: c.accent }]}>Try again</Text>
              </Pressable>
            </View>
          )}

          {!hasContent && !voiceError ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                iosSymbol="book.closed"
                androidSymbol="menu_book"
                title="No entries yet"
                message={
                  q || filter !== 'all'
                    ? 'Nothing matches — try a different search or filter.'
                    : 'The first one is the hardest — and the most honest.'
                }
                actionLabel={q || filter !== 'all' ? undefined : 'Write a check-in'}
                onAction={q || filter !== 'all' ? undefined : () => setComposerOpen(true)}
              />
            </View>
          ) : (
            groups.map((group) => {
              const isToday = group.dayKey === todayKey;
              const n = dayNumber(group.dayKey);
              const slipped = slipKeys.has(group.dayKey);
              return (
                <View key={group.dayKey} style={styles.group}>
                  <View style={styles.groupHead}>
                    <View style={styles.groupHeadLeft}>
                      <Text style={[styles.groupTitle, { color: c.text }]}>
                        {formatDayHeader(group.dayKey, nowMs)}
                      </Text>
                      {n !== null && (
                        <Text style={[styles.groupDay, { color: c.muted }, typeScale.tabular]}>
                          Day {n}
                        </Text>
                      )}
                    </View>
                    {isToday ? (
                      <View
                        accessible
                        accessibilityLabel={slipped ? 'Streak reset today' : 'Streak intact today'}
                        style={[
                          styles.intactPill,
                          { backgroundColor: slipped ? c.surfaceDeep : c.successDim },
                        ]}
                      >
                        <Icon
                          ios={slipped ? 'arrow.counterclockwise' : 'checkmark.seal.fill'}
                          android={slipped ? 'refresh' : 'verified'}
                          size={12}
                          color={slipped ? c.danger : c.success}
                        />
                        <Text
                          style={[
                            styles.intactText,
                            { color: slipped ? c.danger : c.success },
                          ]}
                        >
                          {slipped ? 'Reset today' : 'Intact'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.groupCount, { color: c.muted }]}>
                        {group.items.length}{' '}
                        {group.items.length === 1 ? 'entry' : 'entries'} captured
                      </Text>
                    )}
                  </View>
                  <View style={styles.groupCards}>
                    {group.items.map((item) =>
                      item.kind === 'text' ? (
                        <TextEntryCard
                          key={item.entry.id}
                          entry={item.entry}
                          onDelete={(id) => {
                            void removeJournalEntry(id);
                          }}
                          theme={theme}
                        />
                      ) : (
                        <VoiceEntryCard
                          key={item.entry.id}
                          entry={item.entry}
                          onDeleted={setVoiceEntries}
                          theme={theme}
                        />
                      )
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Milestone anchors */}
          {showAnchors && (
            <View style={styles.group}>
              <View style={styles.groupHead}>
                <View style={styles.groupHeadLeft}>
                  <Text style={[styles.groupTitle, { color: c.text }]}>
                    Milestone anchors
                  </Text>
                </View>
                <Icon ios="medal.fill" android="military_tech" size={15} color={c.accent} />
              </View>
              <View style={styles.groupCards}>
                {reachedMilestones.map((m, i) => (
                  <MilestoneAnchorCard
                    key={m}
                    days={m}
                    category={quit.category}
                    startMs={startMs}
                    prevDays={i === 0 ? 0 : reachedMilestones[i - 1]}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Bottom CTA → urge surf */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Need an emergency urge audit? Begin the guided surf exercise."
            onPress={() => router.push('/urge-surf')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.surface, borderColor: c.hairline },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.ctaLeft}>
              <View style={[styles.ctaIcon, { backgroundColor: c.accentSoft }]}>
                <Icon ios="calendar.badge.clock" android="edit_calendar" size={18} color={c.accent} />
              </View>
              <View style={styles.ctaText}>
                <Text style={[styles.ctaTitle, { color: c.text }]}>
                  Need an emergency urge audit?
                </Text>
                <Text style={[styles.ctaBody, { color: c.metadata }]}>
                  Tap to launch the guided 3-minute surf exercise.
                </Text>
              </View>
            </View>
            <View style={[styles.beginBtn, { backgroundColor: c.surfaceDeep }]}>
              <Text style={[styles.beginText, { color: c.accent }]}>Begin</Text>
            </View>
          </Pressable>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        <ComposerSheet
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          onSave={handleSave}
          onVoice={openVoice}
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
    paddingBottom: spacing.md,
  },
  contentEmpty: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerLeft: { flex: 1 },
  title: { ...typeScale.title2 },
  subtitle: { ...typeScale.subhead, marginTop: 2 },
  newEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  newEntryText: { ...typeScale.headline },
  pressed: { opacity: 0.7 },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  searchInput: { ...typeScale.subhead, flex: 1, paddingVertical: spacing.sm },
  searchClear: { padding: spacing.xs },
  // Chips
  chipsScroll: { marginBottom: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...typeScale.subhead },
  chipTextSelected: { fontWeight: '600' },
  // Groups
  group: { marginBottom: spacing.lg },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    minHeight: 28,
  },
  groupHeadLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  groupTitle: { ...typeScale.headline },
  groupDay: { ...typeScale.footnote },
  groupCount: { ...typeScale.caption },
  intactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  intactText: { ...typeScale.caption, fontWeight: '600' },
  groupCards: { gap: spacing.sm },
  // Cards
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  typePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  cardTime: { ...typeScale.caption },
  cravingPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  cravingPillText: { ...typeScale.caption, fontWeight: '600' },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  proPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardTitle: { ...typeScale.headline, marginBottom: 2 },
  cardBody: { ...typeScale.subhead, lineHeight: 22 },
  // Voice player
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 32 },
  waveBar: { width: 3, borderRadius: 1.5 },
  duration: { ...typeScale.footnote, fontWeight: '600' },
  // Milestone anchor
  anchorWrap: { borderWidth: 1, borderRadius: radii.lg, overflow: 'hidden' },
  anchor: { padding: spacing.md, gap: 2 },
  majorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  majorPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  daysFree: { ...typeScale.footnote, fontWeight: '800', letterSpacing: 0.5 },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  unlockedText: { ...typeScale.footnote, fontWeight: '600' },
  // CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { ...typeScale.headline },
  ctaBody: { ...typeScale.footnote },
  beginBtn: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginText: { ...typeScale.headline },
  // Swipe delete
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.lg,
  },
  deleteLabel: { ...typeScale.footnote, fontWeight: '600' },
  // Composer
  composer: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTitle: { ...typeScale.title3 },
  composerHeadRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyWrap: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxl },
  errorTitle: { ...typeScale.headline, paddingTop: spacing.md },
  errorBody: { ...typeScale.footnote, marginTop: 2 },
  retry: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  retryText: { ...typeScale.headline },
  skelTitle: { marginBottom: spacing.md },
});
