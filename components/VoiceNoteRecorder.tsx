/**
 * VoiceNoteRecorder — the REAL voice-note pipeline (expo-audio +
 * services/voiceJournal), premium-gated.
 *
 * Nothing here is mocked: permission → prepare → record → stop → the
 * temp file is moved into the app's document directory and its metadata
 * persisted through the checksum envelope via saveVoiceJournal.
 *
 * It is NOT mounted anywhere yet — the journal's mic button opens an
 * honest "Sovereign members only" lock sheet until the Day 5 paywall
 * wires it behind the entitlement check. When that lands, mount this
 * component for entitled users instead of the lock.
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GlassButton } from './glass/GlassButton';
import {
  saveVoiceJournal,
  type VoiceJournalEntry,
} from '../services/voiceJournal';
import { colors, spacing, type } from '../theme/tokens';

interface VoiceNoteRecorderProps {
  onSaved: (entries: VoiceJournalEntry[]) => void;
  onCancel: () => void;
}

function formatElapsed(millis: number): string {
  const s = Math.floor(millis / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VoiceNoteRecorder({ onSaved, onCancel }: VoiceNoteRecorderProps) {
  // Record straight into the document directory so the OS can't purge it.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recording = recorderState.isRecording;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone access is needed to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError('Could not start recording. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const stopAndSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMillis = recorderState.durationMillis ?? 0;
      if (!uri || durationMillis <= 0) {
        setError('Nothing was recorded — try again.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await saveVoiceJournal({ tempUri: uri, durationMillis });
      onSaved(updated);
    } catch {
      setError('Could not save the recording. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.timer}>
        {formatElapsed(recorderState.durationMillis ?? 0)}
      </Text>
      {recording && <ActivityIndicator color={colors.danger} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {recording ? (
        <GlassButton
          title={busy ? 'Saving…' : 'Stop & save'}
          onPress={stopAndSave}
          disabled={busy}
        />
      ) : (
        <GlassButton
          title={busy ? 'Preparing…' : 'Start recording'}
          onPress={start}
          disabled={busy}
        />
      )}
      <GlassButton title="Cancel" onPress={onCancel} tone="neutral" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, alignItems: 'stretch' },
  timer: { ...type.title, color: colors.text, textAlign: 'center' },
  error: { ...type.callout, color: colors.warning, textAlign: 'center' },
});
