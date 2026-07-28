package expo.modules.lupirabridge

import android.accounts.AccountManager
import android.content.ContentResolver
import android.content.ContentValues
import android.net.Uri
import android.provider.CalendarContract
import android.provider.ContactsContract
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class PublishEvent : Record {
  @Field var key: String = ""
  @Field var title: String = ""
  @Field var startMs: Double = 0.0
  @Field var endMs: Double? = null
  @Field var allDay: Boolean = false
}

/// JS-facing spike API. Everything runs in the app process; provider writes go through the
/// CALLER_IS_SYNCADAPTER door so the rows belong to the Lupira account (that is also what exempts
/// them from the provider's dirty-flag bookkeeping — user edits in stock apps set DIRTY, ours don't).
class LupiraBridgeModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val resolver: ContentResolver get() = context.contentResolver

  override fun definition() = ModuleDefinition {
    Name("LupiraBridge")

    AsyncFunction("ensureAccount") {
      val am = AccountManager.get(context)
      val existed = am.getAccountsByType(Bridge.ACCOUNT_TYPE).isNotEmpty()
      if (!existed) {
        if (!am.addAccountExplicitly(Bridge.account, null, null))
          throw CodedException("ERR_ACCOUNT", "addAccountExplicitly returned false", null)
        ContentResolver.setIsSyncable(Bridge.account, Bridge.CALENDAR_AUTHORITY, 1)
        ContentResolver.setSyncAutomatically(Bridge.account, Bridge.CALENDAR_AUTHORITY, true)
      }
      existed
    }

    AsyncFunction("removeAccount") {
      val am = AccountManager.get(context)
      val accounts = am.getAccountsByType(Bridge.ACCOUNT_TYPE)
      for (a in accounts) am.removeAccountExplicitly(a)
      accounts.isNotEmpty()
    }

    AsyncFunction("requestSync") {
      val extras = android.os.Bundle().apply {
        putBoolean(ContentResolver.SYNC_EXTRAS_MANUAL, true)
        putBoolean(ContentResolver.SYNC_EXTRAS_EXPEDITED, true)
      }
      ContentResolver.requestSync(Bridge.account, Bridge.CALENDAR_AUTHORITY, extras)
    }

    AsyncFunction("getBridgeState") {
      val am = AccountManager.get(context)
      val lastSync = Bridge.prefs(context).getLong(Bridge.PREF_LAST_SYNC, 0L)
      mapOf(
        "accountPresent" to am.getAccountsByType(Bridge.ACCOUNT_TYPE).isNotEmpty(),
        "calendarId" to findCalendarId(),
        "lastSyncAt" to if (lastSync == 0L) null else lastSync.toDouble(),
      )
    }

    /// Wholesale publish: drop our calendar's events and re-insert the given window. Fine for a spike;
    /// M7 does row-level upserts keyed on _SYNC_ID.
    AsyncFunction("publishEvents") { events: List<PublishEvent> ->
      val calendarId = findCalendarId() ?: createCalendar()
      resolver.delete(
        asSyncAdapter(CalendarContract.Events.CONTENT_URI),
        "${CalendarContract.Events.CALENDAR_ID} = ?", arrayOf(calendarId.toString()),
      )
      var inserted = 0
      for (e in events) {
        val end = e.endMs ?: (e.startMs + if (e.allDay) 86_400_000.0 else 1_800_000.0)
        val values = ContentValues().apply {
          put(CalendarContract.Events.CALENDAR_ID, calendarId)
          put(CalendarContract.Events.TITLE, e.title)
          put(CalendarContract.Events.DTSTART, e.startMs.toLong())
          put(CalendarContract.Events.DTEND, end.toLong())
          put(CalendarContract.Events.ALL_DAY, if (e.allDay) 1 else 0)
          put(CalendarContract.Events.EVENT_TIMEZONE, "UTC")
          put(CalendarContract.Events._SYNC_ID, e.key)
        }
        resolver.insert(asSyncAdapter(CalendarContract.Events.CONTENT_URI), values) ?: continue
        inserted++
      }
      inserted
    }

    /// Recon for M7's write-back design: raw-contact rows with the columns the dirty-flag flow
    /// pivots on (ACCOUNT_TYPE, SOURCE_ID, DIRTY, DELETED).
    AsyncFunction("readContactsSample") { limit: Int ->
      val projection = arrayOf(
        ContactsContract.RawContacts._ID,
        ContactsContract.RawContacts.ACCOUNT_TYPE,
        ContactsContract.RawContacts.ACCOUNT_NAME,
        ContactsContract.RawContacts.SOURCE_ID,
        ContactsContract.RawContacts.DIRTY,
        ContactsContract.RawContacts.DELETED,
        ContactsContract.RawContacts.DISPLAY_NAME_PRIMARY,
      )
      val rows = mutableListOf<Map<String, Any?>>()
      var total = 0
      resolver.query(ContactsContract.RawContacts.CONTENT_URI, projection, null, null, null)?.use { c ->
        total = c.count
        while (c.moveToNext() && rows.size < limit) {
          rows.add(
            mapOf(
              "id" to c.getLong(0),
              "accountType" to c.getString(1),
              "accountName" to c.getString(2),
              "sourceId" to c.getString(3),
              "dirty" to c.getInt(4),
              "deleted" to c.getInt(5),
              "displayName" to c.getString(6),
            ),
          )
        }
      }
      mapOf("total" to total, "rows" to rows)
    }
  }

  private fun asSyncAdapter(uri: Uri): Uri = uri.buildUpon()
    .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
    .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, Bridge.ACCOUNT_NAME)
    .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, Bridge.ACCOUNT_TYPE)
    .build()

  private fun findCalendarId(): Long? =
    resolver.query(
      CalendarContract.Calendars.CONTENT_URI, arrayOf(CalendarContract.Calendars._ID),
      "${CalendarContract.Calendars.ACCOUNT_TYPE} = ?", arrayOf(Bridge.ACCOUNT_TYPE), null,
    )?.use { if (it.moveToFirst()) it.getLong(0) else null }

  private fun createCalendar(): Long {
    val values = ContentValues().apply {
      put(CalendarContract.Calendars.ACCOUNT_NAME, Bridge.ACCOUNT_NAME)
      put(CalendarContract.Calendars.ACCOUNT_TYPE, Bridge.ACCOUNT_TYPE)
      put(CalendarContract.Calendars.NAME, "Lupira")
      put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, "Lupira")
      put(CalendarContract.Calendars.CALENDAR_COLOR, 0xFF4457C2.toInt())
      put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER)
      put(CalendarContract.Calendars.OWNER_ACCOUNT, Bridge.ACCOUNT_NAME)
      put(CalendarContract.Calendars.SYNC_EVENTS, 1)
      put(CalendarContract.Calendars.VISIBLE, 1)
    }
    val uri = resolver.insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), values)
      ?: throw CodedException("ERR_CALENDAR", "calendar insert returned null", null)
    return uri.lastPathSegment!!.toLong()
  }
}
