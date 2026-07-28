import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_PRESETS, type AuthMode } from '../../config';
import { presetFor, useAuth } from '../../state/auth-store';
import { useSyncStatus } from '../../sync/syncStatus';
import { formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

/// Developer tooling, deliberately out of the user path: backend switching (a family member on the
/// LAN preset has a silently dead app), diagnostics links, raw sync state. Reachable from Settings
/// and from the login screen (switching backends must not require signing in first).
export function DeveloperScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { apiUrl, authMode } = useAuth();
  const sync = useSyncStatus();
  const activeKey = presetFor(apiUrl, authMode);
  const [customUrl, setCustomUrl] = useState(activeKey === 'custom' ? apiUrl : '');
  const [customMode, setCustomMode] = useState<AuthMode>(authMode);

  const applyBackend = (url: string, mode: AuthMode) => {
    void useAuth.getState().setBackend(url.trim().replace(/\/$/, ''), mode);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={formStyles.section}>Backend</Text>
      {/* http presets need cleartext networking — dev-client-only (release builds block cleartext). */}
      {API_PRESETS.filter((p) => __DEV__ || p.url.startsWith('https')).map((p) => (
        <Pressable key={p.key} style={styles.row} onPress={() => applyBackend(p.url, p.authMode)}>
          <Text style={styles.rowLabel}>
            {activeKey === p.key ? '● ' : '○ '}{p.label}
          </Text>
          <Text style={styles.rowDetail}>{p.url} · {p.authMode === 'oidc' ? 'sign-in' : 'dev auto-auth'}</Text>
        </Pressable>
      ))}
      <View style={styles.custom}>
        <Text style={styles.rowLabel}>{activeKey === 'custom' ? '● ' : '○ '}Custom</Text>
        <TextInput
          style={formStyles.input}
          placeholder="http://host:5181"
          autoCapitalize="none"
          autoCorrect={false}
          value={customUrl}
          onChangeText={setCustomUrl}
        />
        <Pressable onPress={() => setCustomMode(customMode === 'oidc' ? 'none' : 'oidc')}>
          <Text style={styles.link}>Auth: {customMode === 'oidc' ? 'sign-in' : 'dev auto-auth'} (tap to toggle)</Text>
        </Pressable>
        <Pressable
          style={[styles.button, !customUrl.trim() && styles.buttonDisabled]}
          disabled={!customUrl.trim()}
          onPress={() => applyBackend(customUrl, customMode)}
        >
          <Text style={styles.buttonText}>Use custom backend</Text>
        </Pressable>
      </View>

      <Text style={formStyles.section}>Diagnostics</Text>
      <Pressable onPress={() => navigation.navigate('DebugLog')}>
        <Text style={styles.link}>Debug log</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('BridgeDiagnostics')}>
        <Text style={styles.link}>Bridge diagnostics</Text>
      </Pressable>

      <Text style={formStyles.section}>Sync state</Text>
      <Text style={styles.mono}>{JSON.stringify(sync, null, 2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  row: { paddingVertical: 8 },
  rowLabel: { fontSize: 16 },
  rowDetail: { color: '#777', fontSize: 13 },
  custom: { paddingVertical: 8, gap: 8 },
  link: { color: '#4457c2', paddingVertical: 6 },
  button: { borderWidth: 1, borderColor: '#4457c2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#4457c2' },
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#555' },
});
