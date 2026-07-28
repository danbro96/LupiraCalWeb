import { StyleSheet, Text, View } from 'react-native';
import { useBridge } from '../../state/bridge-store';
import { Button } from './form';

/// One-time post-sign-in card: sets up the Android integration (permissions + account + first
/// publish) or goes quiet forever. An inline card, not an Alert — it may wait across launches.
export function BridgePrompt() {
  const { loaded, prompted, enabled } = useBridge();
  if (!loaded || prompted || enabled) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Show in Android calendar & contacts?</Text>
      <Text style={styles.body}>
        Your events and contacts can appear in this phone's own calendar and contacts apps, and edits
        there sync back. You can change this anytime in Settings.
      </Text>
      <View style={styles.buttons}>
        <Button title="Enable" onPress={() => void useBridge.getState().enable()} />
        <Button title="Not now" kind="plain" onPress={() => void useBridge.getState().markPrompted()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 10, padding: 12, borderRadius: 10, backgroundColor: '#eef0fb', gap: 6 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13, color: '#555' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
