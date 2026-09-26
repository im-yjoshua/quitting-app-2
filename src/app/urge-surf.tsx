/**
 * Urge Surf — stub. The full 2-minute guided breathing experience lands Day 3.
 */
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';
import { Screen } from '../../components/glass/Screen';
import { colors, spacing, type } from '../../theme/tokens';

export default function UrgeSurfStub() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Urge Surf</Text>
          <Text style={styles.sub}>
            The 2-minute guided breathing ride lands Day 3. For now: breathe in
            4, hold 4, out 6. Urges peak and pass.
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
