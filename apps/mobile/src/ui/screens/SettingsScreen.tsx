import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { APP_VERSION } from '../../config';
import { useAuth } from '../../state/auth-store';
import { useBridge } from '../../state/bridge-store';
import { usePrefs } from '../../state/prefs-store';
import { runSync } from '../../sync/sync';
import { useSyncStatus } from '../../sync/syncStatus';
import { Button, formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

/// User-facing settings only: session, the Android-integration toggle, and the sync surface.
/// Everything developer-shaped (backend switching, debug log, bridge diagnostics) lives behind
/// the Developer row.
export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMode, user, token } = useAuth();
  const bridge = useBridge();
  const prefs = usePrefs();
  const { syncing, pending, parked, lastSyncAt } = useSyncStatus();

  const toggleBridge = (value: boolean) => {
    if (value) {
      void useBridge.getState().enable().then((ok) => {
        if (!ok) {
          Alert.alert('Permissions needed', 'Calendar and contacts permissions are required. Grant them in the system settings and try again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open app settings', onPress: () => void Linking.openSettings() },
          ]);
        }
      });
    } else {
      Alert.alert('Turn off Android integration', 'The Lupira calendar and contacts are removed from this phone (they stay in the app and on the server).', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => void useBridge.getState().disable() },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={formStyles.section}>Account</Text>
      <Text style={styles.detail}>
        {authMode === 'none' ? 'Dev auto-auth (no sign-in)' : user ? `Signed in as ${user.sub}` : 'Signed out'}
      </Text>
      {token !== null && (
        <Button title="Sign out" onPress={() => void useAuth.getState().clearSession()} />
      )}

      <Text style={formStyles.section}>Android integration</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Sync with Android calendar & contacts</Text>
        <Switch value={bridge.enabled} onValueChange={toggleBridge} disabled={!bridge.loaded} />
      </View>
      {bridge.enabled && (
        <Text style={styles.detail}>
          {bridge.status?.accountPresent ? 'Account active' : 'Account missing — toggle off and on to repair'}
          {bridge.status?.lastSyncAt ? ` · last OS sync ${new Date(bridge.status.lastSyncAt).toLocaleString()}` : ''}
        </Text>
      )}
      {!bridge.permissionsOk && (
        <Pressable onPress={() => void Linking.openSettings()}>
          <Text style={styles.warning}>Calendar/contacts permissions missing — tap to open app settings</Text>
        </Pressable>
      )}

      <Text style={formStyles.section}>Calendars</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Show system calendars</Text>
        <Switch
          value={prefs.showSystemCalendars}
          onValueChange={(v) => void usePrefs.getState().setShowSystemCalendars(v)}
          disabled={!prefs.loaded}
        />
      </View>
      <Text style={styles.detail}>Agent-managed calendars (inbox, availability …) and their events stay hidden unless enabled.</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Show task deadlines</Text>
        <Switch
          value={prefs.showTaskDeadlines}
          onValueChange={(v) => void usePrefs.getState().setShowTaskDeadlines(v)}
          disabled={!prefs.loaded}
        />
      </View>
      <Text style={styles.detail}>Deadlines from Lupira Tasks appear on their due day. Needs a connection.</Text>

      <Text style={formStyles.section}>Sync</Text>
      <Text style={styles.detail}>
        {syncing ? 'Syncing…' : lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleString()}` : 'Not synced yet'}
      </Text>
      <View style={styles.row}>
        <Button title="Sync now" onPress={() => void runSync()} disabled={syncing} />
        <Pressable onPress={() => navigation.navigate('SyncIssues')}>
          <Text style={styles.link}>
            Sync issues{pending + parked > 0 ? ` (${pending + parked})` : ''}
          </Text>
        </Pressable>
      </View>

      <Text style={formStyles.section}>About</Text>
      <Text style={styles.detail}>Lupira Calendar {APP_VERSION}</Text>

      <Text style={formStyles.section}>Developer</Text>
      <Pressable onPress={() => navigation.navigate('Developer')}>
        <Text style={styles.link}>Developer options</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  detail: { color: '#777', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { fontSize: 15, flex: 1 },
  warning: { color: '#b45309', fontSize: 13, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  link: { color: '#4457c2', paddingVertical: 6 },
});
