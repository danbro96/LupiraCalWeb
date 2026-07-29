import * as SQLite from 'expo-sqlite';
import type { Db, SqlValue, Tx } from './types';

const DB_NAME = 'lupira-calendar-mirror.db';

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(DB_NAME);
  // busy_timeout: exclusive transactions ride a second connection (expo-sqlite), and the Kotlin bridge
  // reads this file too — waiting beats an instant "database is locked" during the first big pull.
  await raw.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 30000;');
  return wrap(raw);
}

function wrapTx(h: SQLite.SQLiteDatabase): Tx {
  return {
    run: async (sql, params = []) => {
      await h.runAsync(sql, params as SQLite.SQLiteBindParams);
    },
    all: async <T,>(sql: string, params: SqlValue[] = []) => h.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams),
    first: async <T,>(sql: string, params: SqlValue[] = []) => h.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams),
  };
}

function wrap(raw: SQLite.SQLiteDatabase): Db {
  return {
    ...wrapTx(raw),
    exec: (sql) => raw.execAsync(sql),
    // withExclusiveTransactionAsync hands us a dedicated handle no other query can interleave with — the
    // whole point of the Tx-threading discipline (see types.ts). It returns void, so the result rides a closure.
    async exclusive<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      let result!: T;
      await raw.withExclusiveTransactionAsync(async (txn) => {
        const tx = wrapTx(txn as unknown as SQLite.SQLiteDatabase);
        // busy_timeout is per-connection and this txn rides its own — cover commits/escalations
        // against the Kotlin bridge connection instead of failing instantly.
        await tx.first('PRAGMA busy_timeout = 30000');
        result = await fn(tx);
      });
      return result;
    },
  };
}
