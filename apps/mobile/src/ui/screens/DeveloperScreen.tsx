import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, List, RadioButton, useTheme } from 'react-native-paper';
import { API_PRESETS, type AuthMode } from '../../config';
import { presetFor, useAuth } from '../../state/auth-store';
import { useSyncStatus } from '../../sync/syncStatus';
import { Input } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

/// Developer tooling, deliberately out of the user path: backend switching (a family member on the
/// LAN preset has a silently dead app), diagnostics links, raw sync state. Reachable from Settings
/// and from the login screen (switching backends must not require signing in first).
export function DeveloperScreen() {
  const theme = useTheme();
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
      <List.Subheader>Backend</List.Subheader>
      {/* http presets need cleartext networking — dev-client-only (release builds block cleartext). */}
      {API_PRESETS.filter((p) => __DEV__ || p.url.startsWith('https')).map((p) => (
        <List.Item
          key={p.key}
          onPress={() => applyBackend(p.url, p.authMode)}
          title={p.label}
          description={`${p.url} · ${p.authMode === 'oidc' ? 'sign-in' : 'dev auto-auth'}`}
          left={() => <RadioButton status={activeKey === p.key ? 'checked' : 'unchecked'} value={p.key} onPress={() => applyBackend(p.url, p.authMode)} />}
        />
      ))}
      <View style={styles.custom}>
        <List.Item
          title="Custom"
          left={() => <RadioButton status={activeKey === 'custom' ? 'checked' : 'unchecked'} value="custom" />}
        />
        <Input
          label="http://host:5181"
          autoCapitalize="none"
          autoCorrect={false}
          value={customUrl}
          onChangeText={setCustomUrl}
        />
        <Pressable onPress={() => setCustomMode(customMode === 'oidc' ? 'none' : 'oidc')}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>Auth: {customMode === 'oidc' ? 'sign-in' : 'dev auto-auth'} (tap to toggle)</Text>
        </Pressable>
        <Button
          mode="outlined"
          disabled={!customUrl.trim()}
          onPress={() => applyBackend(customUrl, customMode)}
        >
          Use custom backend
        </Button>
      </View>

      <List.Subheader>Diagnostics</List.Subheader>
      <Pressable onPress={() => navigation.navigate('DebugLog')}>
        <Text style={[styles.link, { color: theme.colors.primary }]}>Debug log</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('BridgeDiagnostics')}>
        <Text style={[styles.link, { color: theme.colors.primary }]}>Bridge diagnostics</Text>
      </Pressable>

      <List.Subheader>Sync state</List.Subheader>
      <Text style={[styles.mono, { color: theme.colors.onSurfaceVariant }]}>{JSON.stringify(sync, null, 2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  custom: { paddingVertical: 8, gap: 8 },
  link: { paddingVertical: 6 },
  mono: { fontFamily: 'monospace', fontSize: 11 },
});
