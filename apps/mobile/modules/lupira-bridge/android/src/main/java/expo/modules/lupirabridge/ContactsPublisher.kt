package expo.modules.lupirabridge

import android.content.ContentProviderOperation
import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.provider.ContactsContract.CommonDataKinds
import android.util.Log
import java.security.MessageDigest

/// Mirror contacts → raw contacts under the Lupira account, upserted by SOURCE_ID = contact id.
/// Updates are wholesale per contact (drop our Data rows, re-insert) — simple and correct because SYNC1
/// carries a content hash so unchanged contacts are never touched. Dirty rows (user edits in the stock
/// app) are held back for the capturer (S4) rather than clobbered.
object ContactsPublisher {
  const val OPEN_IN_MIMETYPE = "vnd.android.cursor.item/vnd.com.lupira.calendar.contact"

  fun publish(context: Context) {
    val mirror = BridgeDb.openMirror(context) ?: return
    val resolver = context.contentResolver
    mirror.use {
      val contacts = MirrorReader.contacts(mirror)

      data class Row(val rawId: Long, val hash: String?, val dirty: Boolean, val deleted: Boolean)
      val existing = mutableMapOf<String, Row>()
      resolver.query(
        rawContactsUri(),
        arrayOf(
          ContactsContract.RawContacts._ID, ContactsContract.RawContacts.SOURCE_ID,
          ContactsContract.RawContacts.SYNC1, ContactsContract.RawContacts.DIRTY, ContactsContract.RawContacts.DELETED,
        ),
        "${ContactsContract.RawContacts.ACCOUNT_TYPE} = ?", arrayOf(Bridge.ACCOUNT_TYPE), null,
      )?.use { c ->
        while (c.moveToNext()) c.getString(1)?.let {
          existing[it] = Row(c.getLong(0), c.getString(2), c.getInt(3) == 1, c.getInt(4) == 1)
        }
      }

      var inserted = 0
      var updated = 0
      val desired = mutableSetOf<String>()
      for (contact in contacts) {
        desired.add(contact.id)
        val current = existing[contact.id]
        if (current?.dirty == true || current?.deleted == true) continue   // S4's capturer owns these
        val hash = hashOf(contact)
        if (current?.hash == hash) continue

        if (current == null) {
          insert(resolver, contact, hash)
          inserted++
        } else {
          replaceData(resolver, current.rawId, contact, hash)
          updated++
        }
      }

      var removed = 0
      for ((sourceId, row) in existing) {
        if (desired.contains(sourceId) || row.dirty || row.deleted) continue
        resolver.delete(rawContactsUri(), "${ContactsContract.RawContacts._ID} = ?", arrayOf(row.rawId.toString()))
        removed++
      }
      Log.i(Bridge.TAG, "contacts publish: $inserted new, $updated updated, $removed removed of ${contacts.size}")
    }
  }

  private fun insert(resolver: ContentResolver, contact: MirrorContact, hash: String) {
    val ops = arrayListOf(
      ContentProviderOperation.newInsert(rawContactsUri())
        .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, Bridge.ACCOUNT_NAME)
        .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, Bridge.ACCOUNT_TYPE)
        .withValue(ContactsContract.RawContacts.SOURCE_ID, contact.id)
        .withValue(ContactsContract.RawContacts.SYNC1, hash)
        .build(),
    )
    for (values in dataRows(contact)) {
      ops.add(
        ContentProviderOperation.newInsert(dataUri())
          .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
          .withValues(values)
          .build(),
      )
    }
    resolver.applyBatch(ContactsContract.AUTHORITY, ops)
  }

  private fun replaceData(resolver: ContentResolver, rawId: Long, contact: MirrorContact, hash: String) {
    val ops = arrayListOf(
      ContentProviderOperation.newDelete(dataUri())
        .withSelection("${ContactsContract.Data.RAW_CONTACT_ID} = ?", arrayOf(rawId.toString()))
        .build(),
    )
    for (values in dataRows(contact)) {
      ops.add(
        ContentProviderOperation.newInsert(dataUri())
          .withValue(ContactsContract.Data.RAW_CONTACT_ID, rawId)
          .withValues(values)
          .build(),
      )
    }
    ops.add(
      ContentProviderOperation.newUpdate(rawContactsUri())
        .withSelection("${ContactsContract.RawContacts._ID} = ?", arrayOf(rawId.toString()))
        .withValue(ContactsContract.RawContacts.SYNC1, hash)
        .withValue(ContactsContract.RawContacts.DIRTY, 0)
        .build(),
    )
    resolver.applyBatch(ContactsContract.AUTHORITY, ops)
  }

  private fun dataRows(contact: MirrorContact): List<android.content.ContentValues> {
    val rows = mutableListOf<android.content.ContentValues>()

    rows.add(android.content.ContentValues().apply {
      put(ContactsContract.Data.MIMETYPE, CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
      put(CommonDataKinds.StructuredName.DISPLAY_NAME, contact.displayName)
      put(CommonDataKinds.StructuredName.GIVEN_NAME, contact.givenName)
      put(CommonDataKinds.StructuredName.MIDDLE_NAME, contact.middleName)
      put(CommonDataKinds.StructuredName.FAMILY_NAME, contact.familyName)
    })

    contact.nickname?.let {
      rows.add(android.content.ContentValues().apply {
        put(ContactsContract.Data.MIMETYPE, CommonDataKinds.Nickname.CONTENT_ITEM_TYPE)
        put(CommonDataKinds.Nickname.NAME, it)
        put(CommonDataKinds.Nickname.TYPE, CommonDataKinds.Nickname.TYPE_DEFAULT)
      })
    }

    for (ch in contact.channels) {
      when (ch.medium) {
        "Phone" -> rows.add(android.content.ContentValues().apply {
          put(ContactsContract.Data.MIMETYPE, CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
          put(CommonDataKinds.Phone.NUMBER, ch.value)
          put(CommonDataKinds.Phone.TYPE, phoneType(ch.type))
          if (ch.preferred) put(ContactsContract.Data.IS_SUPER_PRIMARY, 1)
        })
        "Email" -> rows.add(android.content.ContentValues().apply {
          put(ContactsContract.Data.MIMETYPE, CommonDataKinds.Email.CONTENT_ITEM_TYPE)
          put(CommonDataKinds.Email.ADDRESS, ch.value)
          put(CommonDataKinds.Email.TYPE, emailType(ch.type))
          if (ch.preferred) put(ContactsContract.Data.IS_SUPER_PRIMARY, 1)
        })
      }
    }

    contact.birthday?.let {
      rows.add(android.content.ContentValues().apply {
        put(ContactsContract.Data.MIMETYPE, CommonDataKinds.Event.CONTENT_ITEM_TYPE)
        put(CommonDataKinds.Event.START_DATE, it)
        put(CommonDataKinds.Event.TYPE, CommonDataKinds.Event.TYPE_BIRTHDAY)
      })
    }

    contact.notes?.let {
      rows.add(android.content.ContentValues().apply {
        put(ContactsContract.Data.MIMETYPE, CommonDataKinds.Note.CONTENT_ITEM_TYPE)
        put(CommonDataKinds.Note.NOTE, it)
      })
    }

    rows.add(android.content.ContentValues().apply {
      put(ContactsContract.Data.MIMETYPE, OPEN_IN_MIMETYPE)
      put(ContactsContract.Data.DATA1, contact.id)
      put(ContactsContract.Data.DATA2, "Lupira Calendar")
      put(ContactsContract.Data.DATA3, "Open in Lupira")
    })
    return rows
  }

  private fun phoneType(type: String?): Int = when (type?.lowercase()) {
    "work" -> CommonDataKinds.Phone.TYPE_WORK
    "home" -> CommonDataKinds.Phone.TYPE_HOME
    else -> CommonDataKinds.Phone.TYPE_MOBILE
  }

  private fun emailType(type: String?): Int = when (type?.lowercase()) {
    "work" -> CommonDataKinds.Email.TYPE_WORK
    else -> CommonDataKinds.Email.TYPE_HOME
  }

  private fun hashOf(contact: MirrorContact): String {
    val canonical = buildString {
      append(contact.displayName).append('|').append(contact.givenName ?: "").append('|')
      append(contact.middleName ?: "").append('|').append(contact.familyName ?: "").append('|')
      append(contact.nickname ?: "").append('|').append(contact.birthday ?: "").append('|')
      append(contact.notes ?: "")
      for (ch in contact.channels) append('|').append(ch.medium).append(':').append(ch.value).append(':').append(ch.type ?: "").append(':').append(ch.preferred)
    }
    return MessageDigest.getInstance("MD5").digest(canonical.toByteArray()).joinToString("") { "%02x".format(it) }
  }

  fun rawContactsUri(): Uri = asSyncAdapter(ContactsContract.RawContacts.CONTENT_URI)
  fun dataUri(): Uri = asSyncAdapter(ContactsContract.Data.CONTENT_URI)

  fun asSyncAdapter(uri: Uri): Uri = uri.buildUpon()
    .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
    .appendQueryParameter(ContactsContract.RawContacts.ACCOUNT_NAME, Bridge.ACCOUNT_NAME)
    .appendQueryParameter(ContactsContract.RawContacts.ACCOUNT_TYPE, Bridge.ACCOUNT_TYPE)
    .build()
}
