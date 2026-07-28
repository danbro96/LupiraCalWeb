/// The minimal database surface the mirror + sync engine are written against. Two implementations: expo-sqlite
/// on the device and node:sqlite in the vitest harness — so the ENTIRE engine (transactions included) runs
/// under tests with no native code. Every helper takes a Tx, never a Db: writes always happen inside
/// `exclusive`, the fix for LupiraTasksMobile's interleaved-async-transaction defect.

export type SqlValue = string | number | null;

export interface Tx {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export interface Db extends Tx {
  /// Serialized, exclusive write transaction: no other statement interleaves; throw = rollback.
  exclusive<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /// Multi-statement DDL (migrations).
  exec(sql: string): Promise<void>;
}
