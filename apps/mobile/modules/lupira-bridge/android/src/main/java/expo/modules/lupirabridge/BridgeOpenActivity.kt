package expo.modules.lupirabridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.util.Log

/// Invisible trampoline for the "Open in Lupira" contact row: the VIEW intent hands us the Data row uri,
/// DATA1 holds the Lupira contact id, and we bounce into the app's deep link.
class BridgeOpenActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val contactId = intent?.data?.let { dataRowContactId(it) }
    if (contactId != null) {
      startActivity(
        Intent(Intent.ACTION_VIEW, Uri.parse("lupiracalendar://contact/$contactId")).setPackage(packageName),
      )
    } else {
      Log.w(Bridge.TAG, "BridgeOpenActivity: no contact id on ${intent?.data}")
    }
    finish()
  }

  private fun dataRowContactId(uri: Uri): String? =
    contentResolver.query(uri, arrayOf(ContactsContract.Data.DATA1), null, null, null)?.use {
      if (it.moveToFirst()) it.getString(0) else null
    }
}
