import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListContainersQueryKey, useBootstrapMe, useListContainers } from '../data/api/lupiraCalApi';
import type { ContainerDto } from '../data/api/models';

export function useContainers() {
  const query = useListContainers();
  const containers = useMemo(() => query.data ?? [], [query.data]);
  // Containers are all calendars now — address books moved to LupiraContactApi (useAddressBooks).
  const calendars = containers;
  return { ...query, containers, calendars };
}

/** First-login seeding: once containers load with no calendars, run /me/bootstrap (idempotent) once. */
export function useEnsureBootstrap() {
  const queryClient = useQueryClient();
  const { isSuccess, calendars } = useContainers();
  const bootstrap = useBootstrapMe({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListContainersQueryKey() }),
    },
  });
  const started = useRef(false);
  const { mutate } = bootstrap;

  useEffect(() => {
    if (isSuccess && calendars.length === 0 && !started.current) {
      started.current = true;
      mutate();
    }
  }, [isSuccess, calendars.length, mutate]);

  return bootstrap.isPending;
}

export function calendarLabel(c: ContainerDto): string {
  return c.displayName || c.slug;
}
