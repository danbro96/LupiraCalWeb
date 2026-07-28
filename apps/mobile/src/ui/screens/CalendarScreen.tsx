import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMe } from '../../data/api/generated/cal/me/me';
import { useAuth } from '../../state/auth-store';

/// M3 stub: proves the authenticated chain (token/dev-header → BFF → cal-api) end to end.
/// The real grids arrive with M5, reading the SQLite mirror built in M4.
export function CalendarScreen() {
  const apiUrl = useAuth((s) => s.apiUrl);
  const [status, setStatus] = useState<string>('…');

  const smoke = useCallback(async () => {
    setStatus('calling /api/me…');
    try {
      const r = await getMe();
      setStatus(r.status === 200 ? `Connected as ${r.data.email}` : `HTTP ${r.status}`);
    } catch (e) {
      setStatus(String(e));
    }
  }, []);

  useEffect(() => {
    void smoke();
  }, [smoke]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Calendar</Text>
      <Text style={styles.note}>Grids arrive with M5 (offline mirror lands in M4).</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.backend}>{apiUrl}</Text>
      <Pressable style={styles.button} onPress={() => void smoke()}>
        <Text style={styles.buttonText}>Retry connection check</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  h1: { fontSize: 20, fontWeight: '600' },
  note: { color: '#777', textAlign: 'center' },
  status: { fontSize: 16, textAlign: 'center' },
  backend: { color: '#999', fontSize: 12 },
  button: { borderWidth: 1, borderColor: '#4457c2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#4457c2' },
});
