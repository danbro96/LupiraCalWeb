import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../data/db/expoDb';
import type { OutboxRow } from '../../data/mirror';
import { opOfRow } from '../../data/mirror';
import { OP_LABELS, type OpKind } from '../../domain/ops';
import { retryOne } from '../../sync/outbox';
import { discardParkedAndRestore, runSync } from '../../sync/sync';
import { useSyncStatus } from '../../sync/syncStatus';
import { useOutboxRows } from '../../state/queries';
import { Button, formStyles } from '../components/form';

/// The review surface for offline writes: parked ops (gave up after backoff or hit a definitive rejection)
/// get per-row retry / discard — discard also rolls the optimistic mirror write back to server truth.
export function SyncIssuesScreen() {
  const { data } = useOutboxRows();
  const { syncing, serverReachable, lastSyncAt, lastError } = useSyncStatus();

  const parked = data?.parked ?? [];
  const pending = data?.pending ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {syncing ? 'Syncing…' : serverReachable ? 'Server reachable' : 'Offline'}
          {lastSyncAt ? ` · last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
        </Text>
        <Button title="Sync now" kind="plain" onPress={() => void runSync()} disabled={syncing} />
      </View>
      {lastError && <Text style={styles.lastError}>{lastError}</Text>}

      {parked.length === 0 && pending.length === 0 && (
        <Text style={styles.empty}>All changes are synced.</Text>
      )}

      {parked.length > 0 && <Text style={formStyles.section}>Needs attention</Text>}
      {parked.map((row) => <ParkedCard key={row.seq} row={row} />)}

      {pending.length > 0 && <Text style={formStyles.section}>Waiting to sync</Text>}
      {pending.map((row) => (
        <View key={row.seq} style={styles.pendingRow}>
          <Text style={styles.opLabel}>{labelOf(row)}</Text>
          <Text style={styles.muted}>
            {new Date(row.occurred_at).toLocaleString()}
            {row.attempts > 0 ? ` · attempt ${row.attempts}` : ''}
            {row.next_attempt_at ? ` · retries ${new Date(row.next_attempt_at).toLocaleTimeString()}` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ParkedCard({ row }: { row: OutboxRow }) {
  const [expanded, setExpanded] = useState(false);

  const retry = async () => retryOne(await getDb(), row.seq);
  const discard = () =>
    Alert.alert(
      'Discard change',
      `Discard “${labelOf(row)}”? The local edit is undone and the server’s version is restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void discardParkedAndRestore(row.seq) },
      ],
    );

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Text style={styles.opLabel}>{labelOf(row)}</Text>
        <Text style={styles.muted}>
          {new Date(row.occurred_at).toLocaleString()} · {row.attempts} attempt{row.attempts === 1 ? '' : 's'}
        </Text>
        {row.last_error && <Text style={styles.error} numberOfLines={expanded ? undefined : 2}>{row.last_error}</Text>}
      </Pressable>
      {expanded && <Text style={styles.payload}>{payloadOf(row)}</Text>}
      <View style={styles.cardButtons}>
        <Button title="Retry" onPress={() => void retry()} />
        <Button title="Discard" kind="danger" onPress={discard} />
        <Button title={expanded ? 'Less' : 'Details'} kind="plain" onPress={() => setExpanded(!expanded)} />
      </View>
    </View>
  );
}

function labelOf(row: OutboxRow): string {
  return OP_LABELS[row.kind as OpKind] ?? row.kind;
}

function payloadOf(row: OutboxRow): string {
  try {
    return JSON.stringify(opOfRow(row), null, 2);
  } catch {
    return row.payload;
  }
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusText: { fontSize: 13, color: '#555' },
  lastError: { fontSize: 12, color: '#b45309' },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  card: { borderWidth: 1, borderColor: '#e8c9a8', backgroundColor: '#fdf8f1', borderRadius: 8, padding: 10, gap: 6 },
  opLabel: { fontSize: 15, fontWeight: '600' },
  muted: { fontSize: 12, color: '#888' },
  error: { fontSize: 12, color: '#b91c1c' },
  payload: { fontFamily: 'monospace', fontSize: 11, color: '#444', backgroundColor: '#f4f4f6', borderRadius: 6, padding: 8 },
  cardButtons: { flexDirection: 'row', gap: 8 },
  pendingRow: { paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#eee' },
});
