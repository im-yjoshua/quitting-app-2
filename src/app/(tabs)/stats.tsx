import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../../components/glass/Screen';
import { colors, spacing, type } from '../../../theme/tokens';

export default function StatsScreen() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.sub}>Money saved, charts, and the health timeline land Day 4.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
});
