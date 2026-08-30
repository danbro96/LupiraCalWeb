import { create } from 'zustand';
import { getDb } from '../data/db/expoDb';
import { migrate } from '../data/db/schema';
import { getMeta, setMeta } from '../data/mirror';

/** Small user preferences, persisted in mirror_meta (same reasoning as bridge-store: shared ground the
 *  data layer can read, and no brittle SecureStore key destructuring). */

const DEBUG_KEY = 'prefs.debugEnabled';
const SHOW_SYSTEM_KEY = 'prefs.showSystemCalendars';
const SHOW_TASKS_KEY = 'prefs.showTaskDeadlines';

type Prefs = {
  loaded: boolean;
  /** Gates the Developer + debug-log entries in Settings. */
  debugEnabled: boolean;
  /** System-class calendars (Inbox, Availability, agent scaffolding …) are developer/agent surfaces —
   *  hidden from lists, pickers, AND grids unless this is on. Birthdays is Agenda-class: unaffected. */
  showSystemCalendars: boolean;
  /** Task deadlines from LupiraTasks (online-only third grid source). Default ON — unset means shown. */
  showTaskDeadlines: boolean;
};

type PrefsActions = {
  init(): Promise<void>;
  setDebugEnabled(value: boolean): Promise<void>;
  setShowSystemCalendars(value: boolean): Promise<void>;
  setShowTaskDeadlines(value: boolean): Promise<void>;
};

export const usePrefs = create<Prefs & PrefsActions>((set) => ({
  loaded: false,
  debugEnabled: false,
  showSystemCalendars: false,
  showTaskDeadlines: true,

  init: async () => {
    const db = await getDb();
    await migrate(db);
    set({
      debugEnabled: (await getMeta(db, DEBUG_KEY)) === '1',
      showSystemCalendars: (await getMeta(db, SHOW_SYSTEM_KEY)) === '1',
      showTaskDeadlines: (await getMeta(db, SHOW_TASKS_KEY)) !== '0',
      loaded: true,
    });
  },

  setDebugEnabled: async (value) => {
    set({ debugEnabled: value });
    const db = await getDb();
    await db.exclusive((tx) => setMeta(tx, DEBUG_KEY, value ? '1' : '0'));
  },

  setShowSystemCalendars: async (value) => {
    set({ showSystemCalendars: value });
    const db = await getDb();
    await db.exclusive((tx) => setMeta(tx, SHOW_SYSTEM_KEY, value ? '1' : '0'));
  },

  setShowTaskDeadlines: async (value) => {
    set({ showTaskDeadlines: value });
    const db = await getDb();
    await db.exclusive((tx) => setMeta(tx, SHOW_TASKS_KEY, value ? '1' : '0'));
  },
}));
