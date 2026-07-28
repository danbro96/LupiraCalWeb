import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BridgeState, ContactsSampleRow } from '../../../modules/lupira-bridge/src';
import { LupiraBridge } from '../../../modules/lupira-bridge/src';
import { getDb } from '../../data/db/expoDb';
import { drainBridgeInbox } from '../../sync/bridge';
import { runSync } from '../../sync/sync';
import { Button, formStyles } from '../components/form';

/// Bridge diagnostics (born as the M6 spike, now the M7 two-way surface): manual triggers for each half
/// of the loop — capture/publish (Kotlin), inbox drain (JS→outbox), and the OS scheduler.
export function BridgeSpikeScreen() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [contacts, setContacts] = useState<{ total: number; rows: ContactsSampleRow[] } | null>(null);

  const append = (line: string) => setLog((l) => [...l.slice(-20), line]);
  const refresh = useCallback(async () => {
    try {
      setState(await LupiraBridge.getBridgeState());
      setInboxCount((await LupiraBridge.drainInbox()).length);
    } catch (e) {
      append(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = (label: string, fn: () => Promise<unknown>) => async () => {
    try {
      const result = await fn();
      append(`${label}: ${result === undefined ? 'ok' : JSON.stringify(result)}`);
    } catch (e) {
      append(`${label} FAILED: ${String(e)}`);
    }
    await refresh();
  };

  const requestPermissions = run('permissions', () =>
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
    ]));

  const readContacts = run('contacts', async () => {
    const sample = await LupiraBridge.readContactsSample(10);
    setContacts(sample);
    return `${sample.total} raw contacts on device`;
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={formStyles.section}>State</Text>
      <Text style={styles.mono}>
        account: {state ? String(state.accountPresent) : '…'}   calendarId: {state?.calendarId ?? '—'}{'\n'}
        last OS sync: {state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : 'never'}{'\n'}
        inbox rows: {inboxCount ?? '…'}
      </Text>

      <Text style={formStyles.section}>Actions</Text>
      <View style={styles.buttons}>
        <Button title="Request permissions" onPress={() => void requestPermissions()} />
        <Button title="Ensure account" onPress={run('ensureAccount', () => LupiraBridge.ensureAccount())} />
        <Button title="Bridge sync now (capture + publish)" onPress={run('bridgeSyncNow', () => LupiraBridge.bridgeSyncNow())} />
        <Button
          title="Drain inbox → outbox + full sync"
          onPress={run('drain', async () => {
            const ops = await drainBridgeInbox(await getDb());
            void runSync();
            return `${ops} ops enqueued`;
          })}
        />
        <Button title="Request OS sync" onPress={run('requestSync', () => LupiraBridge.requestSync())} />
        <Button title="Read contacts sample" onPress={() => void readContacts()} />
        <Button title="Remove account" kind="danger" onPress={run('removeAccount', () => LupiraBridge.removeAccount())} />
      </View>

      {contacts && (
        <>
          <Text style={formStyles.section}>Raw contacts ({contacts.total})</Text>
          {contacts.rows.map((r) => (
            <Text key={r.id} style={styles.mono}>
              {r.displayName ?? '(no name)'} · {r.accountType ?? 'local'} · src={r.sourceId ?? '—'} · dirty={r.dirty} del={r.deleted}
            </Text>
          ))}
        </>
      )}

      <Text style={formStyles.section}>Log</Text>
      {log.map((l, i) => <Text key={i} style={styles.mono}>{l}</Text>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 6 },
  buttons: { gap: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#444' },
});
