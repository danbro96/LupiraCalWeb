package expo.modules.lupirabridge

import android.accounts.Account
import android.app.Service
import android.content.AbstractThreadedSyncAdapter
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.content.SyncResult
import android.os.Bundle
import android.os.IBinder
import android.util.Log

/// Spike sync adapter: proves the OS binds and schedules us for the calendar authority. It only stamps
/// a timestamp the app surfaces (getBridgeState) and logs — the actual publish is JS-driven for now.
/// M7 moves the real mirror→provider work in here so OS-scheduled sync runs without the app process.
class CalendarSyncAdapter(context: Context) : AbstractThreadedSyncAdapter(context, true) {
  override fun onPerformSync(
    account: Account, extras: Bundle, authority: String, provider: ContentProviderClient, syncResult: SyncResult,
  ) {
    Log.i(Bridge.TAG, "onPerformSync fired: account=${account.name} authority=$authority extras=$extras")
    Bridge.prefs(context).edit().putLong(Bridge.PREF_LAST_SYNC, System.currentTimeMillis()).apply()
  }
}

class CalendarSyncService : Service() {
  override fun onBind(intent: Intent?): IBinder {
    synchronized(lock) {
      adapter = adapter ?: CalendarSyncAdapter(applicationContext)
    }
    return adapter!!.syncAdapterBinder
  }

  companion object {
    private val lock = Any()
    private var adapter: CalendarSyncAdapter? = null
  }
}
