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

/// Contacts-authority sync body. S3: publish only — the dirty-capture half (stock-app contact edits →
/// inbox) lands with S4 and will run before publish, mirroring the calendar adapter's ordering.
class ContactsSyncAdapter(context: Context) : AbstractThreadedSyncAdapter(context, true) {
  override fun onPerformSync(
    account: Account, extras: Bundle, authority: String, provider: ContentProviderClient, syncResult: SyncResult,
  ) {
    Log.i(Bridge.TAG, "onPerformSync: account=${account.name} authority=$authority")
    try {
      ContactsPublisher.publish(context)
    } catch (e: Exception) {
      Log.e(Bridge.TAG, "contacts onPerformSync failed", e)
      syncResult.stats.numIoExceptions++
    }
    Bridge.prefs(context).edit().putLong(Bridge.PREF_LAST_SYNC, System.currentTimeMillis()).apply()
  }
}

class ContactsSyncService : Service() {
  override fun onBind(intent: Intent?): IBinder {
    synchronized(lock) {
      adapter = adapter ?: ContactsSyncAdapter(applicationContext)
    }
    return adapter!!.syncAdapterBinder
  }

  companion object {
    private val lock = Any()
    private var adapter: ContactsSyncAdapter? = null
  }
}
