import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../../components/glass/Screen';
import { colors, spacing, type } from '../../../theme/tokens';

export default function YouScreen() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>You</Text>
        <Text style={styles.sub}>Backup, notifications, commitments, and the paywall land Day 4–5.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
});
