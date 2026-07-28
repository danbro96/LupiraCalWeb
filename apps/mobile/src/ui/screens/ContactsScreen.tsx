import { StyleSheet, Text, View } from 'react-native';

export function ContactsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Contacts</Text>
      <Text style={styles.note}>Contact book + birthdays arrive with M5.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  h1: { fontSize: 20, fontWeight: '600' },
  note: { color: '#777', textAlign: 'center' },
});
