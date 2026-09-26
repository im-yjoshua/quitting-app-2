/**
 * Relapse flow — stub. The compassionate slip-logging flow lands Day 3.
 */
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { Screen } from '../../components/glass/Screen';
import { colors, spacing, type } from '../../theme/tokens';

export default function RelapseStub() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Hey. Breathe.</Text>
          <Text style={styles.sub}>
            The compassionate relapse flow lands Day 3. Nothing is lost — your
            streak so far still counts.
          </Text>
        </GlassCard>
        <GlassButton title="Back home" onPress={() => router.back()} tone="neutral" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  card: { padding: spacing.xl },
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  sub: { ...type.body, color: colors.textSecondary },
});
