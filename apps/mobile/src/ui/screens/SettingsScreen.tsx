import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_PRESETS, APP_VERSION, type AuthMode } from '../../config';
import { presetFor, useAuth } from '../../state/auth-store';
import type { RootStackParamList } from '../navigation/types';

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { apiUrl, authMode, user, token } = useAuth();
  const activeKey = presetFor(apiUrl, authMode);
  const [customUrl, setCustomUrl] = useState(activeKey === 'custom' ? apiUrl : '');
  const [customMode, setCustomMode] = useState<AuthMode>(authMode);

  const applyBackend = (url: string, mode: AuthMode) => {
    void useAuth.getState().setBackend(url.trim().replace(/\/$/, ''), mode);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Backend</Text>
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
          style={styles.input}
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

      <Text style={styles.section}>Session</Text>
      <Text style={styles.rowDetail}>
        {authMode === 'none' ? 'Dev auto-auth (no token sent)' : user ? `Signed in as ${user.sub}` : 'Signed out'}
      </Text>
      {token !== null && (
        <Pressable style={styles.button} onPress={() => void useAuth.getState().clearSession()}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Diagnostics</Text>
      <Pressable onPress={() => navigation.navigate('DebugLog')}>
        <Text style={styles.link}>Debug log</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('SyncIssues')}>
        <Text style={styles.link}>Sync issues</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('BridgeSpike')}>
        <Text style={styles.link}>Bridge spike (M6)</Text>
      </Pressable>
      <Text style={styles.version}>Lupira Calendar {APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  section: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginTop: 16 },
  row: { paddingVertical: 8 },
  rowLabel: { fontSize: 16 },
  rowDetail: { color: '#777', fontSize: 13 },
  custom: { paddingVertical: 8, gap: 8 },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 6, padding: 8, fontSize: 14 },
  button: { borderWidth: 1, borderColor: '#4457c2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#4457c2' },
  link: { color: '#4457c2', paddingVertical: 6 },
  version: { color: '#aaa', fontSize: 12, marginTop: 24 },
});
