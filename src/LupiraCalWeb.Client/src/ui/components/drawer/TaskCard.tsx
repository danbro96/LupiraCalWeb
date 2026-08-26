import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useGetListsListIdItemsItemId } from '../../../data/api-tasks/lupiraTasksApi';
import type { ItemResponse } from '../../../data/api-tasks/models';
import { fmtDate, fmtTime } from '@lupira/cal-domain/time';
import { DetailDrawer } from './DetailDrawer';

/** Read-only view for a task deadline (lives in LupiraTasks, not cal): status, due, notes, and the
 *  deep link into the tasks app. The web fallback lands on the list — tasks-web has no per-task route. */
export function TaskCard({ listId, itemId, onClose }: { listId: string; itemId: string; onClose: () => void }) {
  const { data: task, isLoading } = useGetListsListIdItemsItemId(listId, itemId);

  return (
    <DetailDrawer onClose={onClose}>
      {isLoading && <p className="meta drawer-pad">Loading…</p>}
      {!isLoading && !task && <p className="meta drawer-pad">Task not found (or no access).</p>}
      {task && <TaskBody task={task} />}
    </DetailDrawer>
  );
}

function TaskBody({ task }: { task: ItemResponse }) {
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const overdue = due != null && due < new Date() && !task.completed;

  return (
    <div className="drawer-pad">
      <div className="drawer-title-row">
        <span className="kind-icon" title="Task">
          ⏰
        </span>
        <h2 className="field-value">{task.title}</h2>
      </div>

      <section className="drawer-section">
        <h3>Due</h3>
        {due ? (
          <p className="field-value" style={overdue ? { color: 'var(--mui-palette-error-main)' } : undefined}>
            {fmtDate(due)} {fmtTime(due)}
            {overdue ? ' — overdue' : ''}
          </p>
        ) : (
          <Typography variant="caption" color="text.secondary" component="p">No deadline.</Typography>
        )}
      </section>

      <section className="drawer-section">
        <h3>Status</h3>
        <p className="field-value">
          {task.status}
          {task.statusReason ? ` — ${task.statusReason}` : ''}
        </p>
        {task.priority > 0 && <Typography variant="caption" color="text.secondary" component="p">Priority {task.priority}</Typography>}
        {task.assignee && <Typography variant="caption" color="text.secondary" component="p">Assigned to {task.assignee.displayName || task.assignee.email}</Typography>}
      </section>

      {task.notes && (
        <section className="drawer-section">
          <h3>Notes</h3>
          <p className="field-value">{task.notes}</p>
        </section>
      )}

      <section className="drawer-section">
        <Button variant="contained" href={`lupiratasks://task/${task.listId}/${task.id}`}>
          Open in Lupira Tasks
        </Button>
      </section>
      <Button variant="text" href={`https://tasks.lupira.com/lists/${task.listId}`} target="_blank" rel="noreferrer">
        Open list on the web →
      </Button>
    </div>
  );
}
