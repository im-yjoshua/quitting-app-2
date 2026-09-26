import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../../components/glass/Screen';
import { GlassCard } from '../../../components/glass/GlassCard';
import { colors, spacing, type } from '../../../theme/tokens';

// Day 2 builds the real Home: the Orb, live counter, pledge button.
export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Sovereign</Text>
        <GlassCard style={styles.card}>
          <Text style={styles.cardText}>Home lands Day 2 — the Orb, the counter, the pledge.</Text>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...type.hero, color: colors.text, marginBottom: spacing.lg },
  card: { marginTop: spacing.sm },
  cardText: { ...type.body, color: colors.textSecondary },
});
