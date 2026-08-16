import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { List, Switch, useTheme } from 'react-native-paper';
import { APP_VERSION } from '../../config';
import { useAuth } from '../../state/auth-store';
import { useBridge } from '../../state/bridge-store';
import { usePrefs } from '../../state/prefs-store';
import { runSync } from '../../sync/sync';
import { useSyncStatus } from '../../sync/syncStatus';
import { useConfirm } from '../components/ConfirmDialog';
import { Button, formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

/// User-facing settings only: session, the Android-integration toggle, and the sync surface.
/// Everything developer-shaped (backend switching, debug log, bridge diagnostics) lives behind
/// the Developer row.
export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMode, user, token } = useAuth();
  const bridge = useBridge();
  const prefs = usePrefs();
  const { syncing, pending, parked, lastSyncAt } = useSyncStatus();
  const confirm = useConfirm();

  const toggleBridge = (value: boolean) => {
    if (value) {
      void useBridge.getState().enable().then(async (ok) => {
        if (ok) return;
        const open = await confirm({
          title: 'Permissions needed',
          message: 'Calendar and contacts permissions are required. Grant them in the system settings and try again.',
          confirmLabel: 'Open app settings',
        });
        if (open) void Linking.openSettings();
      });
    } else {
      void confirm({
        title: 'Turn off Android integration',
        message: 'The Lupira calendar and contacts are removed from this phone (they stay in the app and on the server).',
        confirmLabel: 'Turn off',
        destructive: true,
      }).then((ok) => {
        if (ok) void useBridge.getState().disable();
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>Account</Text>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
        {authMode === 'none' ? 'Dev auto-auth (no sign-in)' : user ? `Signed in as ${user.sub}` : 'Signed out'}
      </Text>
      {token !== null && (
        <Button title="Sign out" onPress={() => void useAuth.getState().clearSession()} />
      )}

      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>Android integration</Text>
      <List.Item
        title="Sync with Android calendar & contacts"
        right={() => <Switch value={bridge.enabled} onValueChange={toggleBridge} disabled={!bridge.loaded} />}
      />
      {bridge.enabled && (
        <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
          {bridge.status?.accountPresent ? 'Account active' : 'Account missing — toggle off and on to repair'}
          {bridge.status?.lastSyncAt ? ` · last OS sync ${new Date(bridge.status.lastSyncAt).toLocaleString()}` : ''}
        </Text>
      )}
      {!bridge.permissionsOk && (
        <Pressable onPress={() => void Linking.openSettings()}>
          <Text style={styles.warning}>Calendar/contacts permissions missing — tap to open app settings</Text>
        </Pressable>
      )}

      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>Calendars</Text>
      <List.Item
        title="Show system calendars"
        right={() => (
          <Switch
            value={prefs.showSystemCalendars}
            onValueChange={(v) => void usePrefs.getState().setShowSystemCalendars(v)}
            disabled={!prefs.loaded}
          />
        )}
      />
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>Agent-managed calendars (inbox, availability …) and their events stay hidden unless enabled.</Text>
      <List.Item
        title="Show task deadlines"
        right={() => (
          <Switch
            value={prefs.showTaskDeadlines}
            onValueChange={(v) => void usePrefs.getState().setShowTaskDeadlines(v)}
            disabled={!prefs.loaded}
          />
        )}
      />
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>Deadlines from Lupira Tasks appear on their due day. Needs a connection.</Text>

      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>Sync</Text>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
        {syncing ? 'Syncing…' : lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleString()}` : 'Not synced yet'}
      </Text>
      <View style={styles.row}>
        <Button title="Sync now" onPress={() => void runSync()} disabled={syncing} />
        <Pressable onPress={() => navigation.navigate('SyncIssues')}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>
            Sync issues{pending + parked > 0 ? ` (${pending + parked})` : ''}
          </Text>
        </Pressable>
      </View>

      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>About</Text>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>Lupira Calendar {APP_VERSION}</Text>

      <Text style={[formStyles.section, { color: theme.colors.onSurfaceVariant }]}>Developer</Text>
      <Pressable onPress={() => navigation.navigate('Developer')}>
        <Text style={[styles.link, { color: theme.colors.primary }]}>Developer options</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  detail: { fontSize: 13 },
  warning: { color: '#b45309', fontSize: 13, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  link: { paddingVertical: 6 },
});
