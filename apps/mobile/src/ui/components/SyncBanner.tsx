import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Banner, Text, useTheme } from 'react-native-paper';
import { getMe } from '../../data/api/generated/cal/me/me';
import { PHASE_LABELS, useSyncStatus } from '../../sync/syncStatus';
import type { RootStackParamList } from '../navigation/types';

/// One-line connection/queue status above the grids; doubles as the M3 exit-criterion probe
/// ("Connected as …" proves token → BFF → cal-api). Tapping it opens the sync issues screen.
export function SyncBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { syncing, serverReachable, pending, parked, lastError, progress } = useSyncStatus();
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
    ? progress && progress.count > 0
      ? `Syncing — ${progress.count} ${PHASE_LABELS[progress.phase]}…`
      : 'Syncing…'
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
    <Pressable onPress={() => navigation.navigate('SyncIssues')}>
      <Banner visible style={alert ? { backgroundColor: theme.colors.errorContainer } : undefined}>
        <Text
          variant="bodySmall"
          style={{ color: alert ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant }}
        >
          {text}
        </Text>
      </Banner>
    </Pressable>
  );
}
