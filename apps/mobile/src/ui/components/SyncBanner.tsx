import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getMe } from '../../data/api/generated/cal/me/me';
import { useSyncStatus } from '../../sync/syncStatus';
import type { RootStackParamList } from '../navigation/types';

/// One-line connection/queue status above the grids; doubles as the M3 exit-criterion probe
/// ("Connected as …" proves token → BFF → cal-api). Tapping it opens the sync issues screen.
export function SyncBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { syncing, serverReachable, pending, parked, lastError } = useSyncStatus();
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    if (!serverReachable || who !== null) return;
    let cancelled = false;
    getMe()
      .then((r) => {
        if (!cancelled && r.status === 200) setWho(r.data.email ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [serverReachable, who]);

  const text = syncing
    ? 'Syncing…'
    : !serverReachable
      ? `Offline${pending > 0 ? ` — ${pending} change${pending === 1 ? '' : 's'} queued` : ''}`
      : parked > 0
        ? `${parked} change${parked === 1 ? '' : 's'} need attention`
        : lastError
          ? 'Sync problem — tap for details'
          : who
            ? `Connected as ${who}`
            : 'Connected';
  const alert = parked > 0 || (!syncing && !serverReachable) || (!syncing && !!lastError);

  return (
    <Pressable style={[styles.banner, alert && styles.alert]} onPress={() => navigation.navigate('SyncIssues')}>
      <Text style={[styles.text, alert && styles.alertText]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f2f3f7' },
  alert: { backgroundColor: '#fdf1e3' },
  text: { fontSize: 12, color: '#777' },
  alertText: { color: '#b45309' },
});
