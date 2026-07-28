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
  await raw.execAsync('PRAGMA journal_mode = WAL;');
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
        result = await fn(wrapTx(txn as unknown as SQLite.SQLiteDatabase));
      });
      return result;
    },
  };
}
