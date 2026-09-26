import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../../components/glass/Screen';
import { colors, spacing, type } from '../../../theme/tokens';

export default function JournalScreen() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.sub}>Check-ins, text entries, and voice notes land Day 3.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
});
