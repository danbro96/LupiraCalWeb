import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BridgeState, ContactsSampleRow, PublishEvent } from '../../../modules/lupira-bridge/src';
import { LupiraBridge } from '../../../modules/lupira-bridge/src';
import { getDb } from '../../data/db/expoDb';
import { gridRowsBetween } from '../../data/mirror';
import { Button, formStyles } from '../components/form';

/// M6 spike surface (throwaway): pokes the native bridge module and shows raw results. Feeds the
/// go/no-go learnings doc — not a shipping feature.
export function BridgeSpikeScreen() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [contacts, setContacts] = useState<{ total: number; rows: ContactsSampleRow[] } | null>(null);

  const append = (line: string) => setLog((l) => [...l.slice(-20), line]);
  const refresh = useCallback(async () => {
    try {
      setState(await LupiraBridge.getBridgeState());
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

  const requestPermissions = run('permissions', async () => {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ]);
    return res;
  });

  const publishWindow = run('publish', async () => {
    const db = await getDb();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const rows = await gridRowsBetween(db, key(from), key(to));
    const events: PublishEvent[] = rows.map((r) => ({
      key: `${r.source}-${r.source_id}-${r.start_utc}`,
      title: r.source === 'birthday' ? `🎂 ${r.title ?? ''}` : (r.title ?? '(untitled)'),
      startMs: Date.parse(r.start_utc),
      endMs: r.end_utc ? Date.parse(r.end_utc) : null,
      allDay: r.all_day === 1,
    }));
    const inserted = await LupiraBridge.publishEvents(events);
    return `${inserted}/${events.length} events into the stock calendar`;
  });

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
        last OS sync: {state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : 'never'}
      </Text>

      <Text style={formStyles.section}>Actions</Text>
      <View style={styles.buttons}>
        <Button title="Request permissions" onPress={() => void requestPermissions()} />
        <Button title="Ensure account" onPress={run('ensureAccount', () => LupiraBridge.ensureAccount())} />
        <Button title="Publish ±1 month to stock calendar" onPress={() => void publishWindow()} />
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
