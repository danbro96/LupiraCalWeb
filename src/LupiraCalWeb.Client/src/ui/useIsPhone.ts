import { useSyncExternalStore } from 'react';

// Keep in sync with the phone breakpoint in index.css (media queries can't read custom props).
const PHONE_QUERY = '(max-width: 820px)';
const mql = window.matchMedia(PHONE_QUERY);

/** True below the phone breakpoint; drives structural (non-CSS) layout switches only. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => mql.matches,
  );
}
