package expo.modules.lupirabridge

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File

/// Kotlin-owned handoff store between onPerformSync (which has no JS runtime) and the app's engine.
/// Captured provider edits land here; the JS drain translates them into outbox ops and acks. Lives in the
/// same SQLite directory as the mirror so expo-sqlite could open it, but only Kotlin writes the schema.
object BridgeDb {
  private const val NAME = "lupira-bridge.db"

  fun open(context: Context): SQLiteDatabase {
    val dir = File(context.filesDir, "SQLite").apply { mkdirs() }
    val db = SQLiteDatabase.openOrCreateDatabase(File(dir, NAME), null)
    db.execSQL("PRAGMA busy_timeout = 30000")
    db.execSQL(
      """CREATE TABLE IF NOT EXISTS bridge_inbox (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           domain TEXT NOT NULL,
           kind TEXT NOT NULL,
           sync_id TEXT,
           provider_id INTEGER NOT NULL,
           payload TEXT NOT NULL,
           captured_at INTEGER NOT NULL)""",
    )
    return db
  }

  /// The mirror database the RN app maintains (expo-sqlite). This connection never writes, but it must
  /// open READWRITE: Android's read-only open cannot recover a live WAL index ("database is locked"
  /// while the engine's first big pull is mid-flight — observed on a fresh install). WAL + busy_timeout
  /// make the cross-connection read safe. Null when the app has never synced.
  fun openMirror(context: Context): SQLiteDatabase? {
    val file = File(context.filesDir, "SQLite/lupira-calendar-mirror.db")
    if (!file.exists()) return null
    val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE)
    db.execSQL("PRAGMA busy_timeout = 30000")
    return db
  }

  fun pendingSyncIds(context: Context): Set<String> =
    open(context).use { db ->
      db.rawQuery("SELECT DISTINCT sync_id FROM bridge_inbox WHERE sync_id IS NOT NULL", null).use { c ->
        val out = mutableSetOf<String>()
        while (c.moveToNext()) out.add(c.getString(0))
        out
      }
    }
}
