import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { Banner, Text, useTheme } from 'react-native-paper';
import { bannerState } from '../../domain/bannerState';
import { PHASE_LABELS } from '../../domain/syncPhase';
import { useSyncStatus } from '../../sync/syncStatus';
import type { RootStackParamList } from '../navigation/types';

/** Connection/queue state above the grids, and nothing at all when there is none to report.
 *  Tapping it opens the sync issues screen. */
export function SyncBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // useTheme, not useColors: the alert tint is MD3's errorContainer pair, which the estate
  // palette has no equivalent for.
  const theme = useTheme();
  const { syncing, serverReachable, pending, parked, lastError, progress } = useSyncStatus();

  const state = bannerState({ syncing, serverReachable, pending, parked, lastError, progress }, PHASE_LABELS);
  if (!state) return null;

  const alert = state.kind === 'offline' || state.kind === 'parked' || state.kind === 'error';

  return (
    <Pressable onPress={() => navigation.navigate('SyncIssues')}>
      <Banner visible style={alert ? { backgroundColor: theme.colors.errorContainer } : undefined}>
        <Text
          variant="bodySmall"
          style={{ color: alert ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant }}
        >
          {state.text}
        </Text>
      </Banner>
    </Pressable>
  );
}
