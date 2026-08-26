import { fmtWhen } from '@lupira/cal-domain/time';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { getListsListIdItemsItemId } from '../../data/api/generated/tasks/items/items';
import { taskDeepLink } from '../../domain/taskRows';
import { Centered } from '../components/Centered';
import { Button } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

/// Read-only view of a LupiraTasks deadline. Online-only by design (tasks never enter the mirror);
/// editing lives in the Lupira Tasks app, reached via the deep link below.
export function TaskDetailScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const { listId, itemId } = route.params;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tasks', 'detail', listId, itemId],
    staleTime: 60_000,
    retry: 1,
    queryFn: () => getListsListIdItemsItemId(listId, itemId),
  });

  if (isLoading) return <Centered text="Loading…" />;
  if (isError) return <Centered text="Needs a connection to the server." />;
  if (!data || data.status !== 200) return <Centered text="Task not found (or no access)." />;
  const task = data.data;

  const due = task.dueAt ? new Date(task.dueAt) : null;
  const overdue = due != null && due < new Date() && !task.completed;
  const openInTasks = () =>
    Linking.openURL(taskDeepLink(task.listId, task.id)).catch(() =>
      Alert.alert('Lupira Tasks not installed', 'Task details live in the Lupira Tasks app.'),
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>⏰ {task.title}</Text>
      {task.dueAt ? (
        <Text style={[styles.when, { color: overdue ? theme.colors.error : theme.colors.onSurfaceVariant }]}>
          Due {fmtWhen(task.dueAt, false)}
          {overdue ? ' — overdue' : ''}
        </Text>
      ) : (
        <Text style={[styles.when, { color: theme.colors.onSurfaceVariant }]}>No deadline</Text>
      )}
      <View style={styles.chipRow}>
        <Chip compact mode="outlined">{task.status}</Chip>
        {task.priority > 0 && (
          <Chip compact mode="outlined">{`Priority ${task.priority}`}</Chip>
        )}
      </View>
      {task.statusReason ? <Text style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>{task.statusReason}</Text> : null}
      {task.assignee && (
        <Text style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>Assigned to {task.assignee.displayName || task.assignee.email}</Text>
      )}
      {task.notes ? <Text style={styles.notes}>{task.notes}</Text> : null}
      <View style={styles.actions}>
        <Button title="Open in Lupira Tasks ↗" onPress={openInTasks} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  h1: { fontSize: 20, fontWeight: '700' },
  when: { fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  note: { fontSize: 13 },
  notes: { fontSize: 14, marginTop: 4 },
  actions: { marginTop: 12 },
});
