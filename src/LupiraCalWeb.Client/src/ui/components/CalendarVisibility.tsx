import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContainerDto } from '@lupira/cal-api/models';

interface Visibility {
  isVisible: (c: ContainerDto) => boolean;
  toggle: (c: ContainerDto) => void;
  tasksVisible: boolean;
  toggleTasks: () => void;
}

const VisibilityContext = createContext<Visibility | null>(null);

const defaultVisible = (c: ContainerDto) => c.class !== 'System';

/** Per-session calendar visibility. Agenda calendars start visible; System calendars start hidden.
 *  `tasksVisible` gates the task-deadline pseudo-source (LupiraTasksApi), visible by default. */
export function CalendarVisibilityProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [tasksVisible, setTasksVisible] = useState(true);

  const isVisible = useCallback((c: ContainerDto) => overrides.get(c.id) ?? defaultVisible(c), [overrides]);

  const toggle = useCallback((c: ContainerDto) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(c.id, !(next.get(c.id) ?? defaultVisible(c)));
      return next;
    });
  }, []);

  const toggleTasks = useCallback(() => setTasksVisible((v) => !v), []);

  const value = useMemo(
    () => ({ isVisible, toggle, tasksVisible, toggleTasks }),
    [isVisible, toggle, tasksVisible, toggleTasks],
  );
  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
}

export function useCalendarVisibility(): Visibility {
  const ctx = useContext(VisibilityContext);
  if (!ctx) throw new Error('useCalendarVisibility outside provider');
  return ctx;
}
