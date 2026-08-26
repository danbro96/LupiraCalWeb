import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { List, Switch, Text, useTheme } from 'react-native-paper';
import { APP_VERSION } from '../../config';
import { useAuth } from '../../state/auth-store';
import { useBridge } from '../../state/bridge-store';
import { usePhotoBackup } from '../../state/photo-backup-store';
import { usePhotoBackupStatus } from '../../sync/photoBackupStatus';
import { usePrefs } from '../../state/prefs-store';
import { retryParkedPhotos, runPhotoBackup } from '../../sync/photoUploader';
import { runSync } from '../../sync/sync';
import { useSyncStatus } from '../../sync/syncStatus';
import { useConfirm } from '../components/ConfirmDialog';
import { Button, DateField } from '../components/form';
import type { RootStackParamList } from '../navigation/types';
import type { AppTheme } from '../theme/paperTheme';

/// User-facing settings only: session, the Android-integration toggle, and the sync surface.
/// Everything developer-shaped (backend switching, debug log, bridge diagnostics) lives behind
/// the Developer row.
export function SettingsScreen() {
  const theme = useTheme<AppTheme>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMode, user, token } = useAuth();
  const bridge = useBridge();
  const prefs = usePrefs();
  const photos = usePhotoBackup();
  const photoStatus = usePhotoBackupStatus();
  const { syncing, pending, parked, lastSyncAt } = useSyncStatus();
  const confirm = useConfirm();

  const togglePhotoBackup = (value: boolean) => {
    void usePhotoBackup.getState().setEnabled(value).then(async (ok) => {
      if (!ok) {
        const open = await confirm({
          title: 'Photo permissions needed',
          message: 'Access to photos and videos — including their location data — is required to back them up. Grant it in the system settings and try again.',
          confirmLabel: 'Open app settings',
        });
        if (open) void Linking.openSettings();
        return;
      }
      if (value) void runPhotoBackup();
    });
  };

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
      <List.Subheader>Account</List.Subheader>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
        {authMode === 'none' ? 'Dev auto-auth (no sign-in)' : user ? `Signed in as ${user.sub}` : 'Signed out'}
      </Text>
      {token !== null && (
        <Button title="Sign out" onPress={() => void useAuth.getState().clearSession()} />
      )}

      <List.Subheader>Android integration</List.Subheader>
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
          <Text style={[styles.warning, { color: theme.colors.warning }]}>Calendar/contacts permissions missing — tap to open app settings</Text>
        </Pressable>
      )}

      <List.Subheader>Calendars</List.Subheader>
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

      <List.Subheader>Photo backup</List.Subheader>
      <List.Item
        title="Back up photos & videos"
        right={() => (
          <Switch value={photos.settings.enabled} onValueChange={togglePhotoBackup} disabled={!photos.loaded} />
        )}
      />
      {photos.settings.enabled && (
        <>
          <List.Item
            title="Only on Wi-Fi"
            right={() => (
              <Switch
                value={photos.settings.wifiOnly}
                onValueChange={(v) => void usePhotoBackup.getState().setWifiOnly(v)}
              />
            )}
          />
          <View style={styles.row}>
            <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>Back up from</Text>
            <DateField
              value={photos.settings.backupFrom.slice(0, 10)}
              onChange={(day) => day && void usePhotoBackup.getState().setBackupFrom(new Date(`${day}T00:00:00`).toISOString())}
            />
          </View>
          <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
            {photoStatus.progress
              ? `Uploading… ${Math.round(photoStatus.progress.fraction * 100)}%`
              : photoStatus.pending > 0
                ? `${photoStatus.pending} waiting to upload`
                : `${photoStatus.done} backed up`}
          </Text>
          {photoStatus.parked > 0 && (
            <Pressable onPress={() => void retryParkedPhotos()}>
              <Text style={[styles.warning, { color: theme.colors.warning }]}>{photoStatus.parked} failed — tap to retry</Text>
            </Pressable>
          )}
        </>
      )}
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
        Originals upload straight to your own storage. Bulk backup runs while the app is open; in the background it catches up slowly.
      </Text>

      <List.Subheader>Sync</List.Subheader>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>
        {syncing ? 'Syncing…' : lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleString()}` : 'Not synced yet'}
      </Text>
      <View style={styles.row}>
        <Button title="Sync now" onPress={() => void runSync()} disabled={syncing} />
        <Button
          kind="link"
          title={`Sync issues${pending + parked > 0 ? ` (${pending + parked})` : ''}`}
          onPress={() => navigation.navigate('SyncIssues')}
        />
      </View>

      <List.Subheader>About</List.Subheader>
      <Text style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}>Lupira Calendar {APP_VERSION}</Text>

      <List.Subheader>Developer</List.Subheader>
      <Button kind="link" title="Developer options" onPress={() => navigation.navigate('Developer')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  detail: { fontSize: 13 },
  warning: { fontSize: 13, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
