package expo.modules.lupirabridge

import android.accounts.AbstractAccountAuthenticator
import android.accounts.Account
import android.accounts.AccountAuthenticatorResponse
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.IBinder

/// Stub authenticator: its only job is making the "Lupira" account type exist so the sync framework
/// (and Android Settings) will host our account. Real token handling stays in the app — the account
/// never stores credentials. Spike learning to confirm: Settings → "Add account" needs an activity
/// intent from addAccount to work; the app creates the account programmatically instead.
class StubAuthenticator(context: Context) : AbstractAccountAuthenticator(context) {
  override fun addAccount(
    response: AccountAuthenticatorResponse?, accountType: String?, authTokenType: String?,
    requiredFeatures: Array<out String>?, options: Bundle?,
  ): Bundle? = null

  override fun getAuthToken(
    response: AccountAuthenticatorResponse?, account: Account?, authTokenType: String?, options: Bundle?,
  ): Bundle? = null

  override fun editProperties(response: AccountAuthenticatorResponse?, accountType: String?): Bundle? = null
  override fun confirmCredentials(response: AccountAuthenticatorResponse?, account: Account?, options: Bundle?): Bundle? = null
  override fun updateCredentials(
    response: AccountAuthenticatorResponse?, account: Account?, authTokenType: String?, options: Bundle?,
  ): Bundle? = null

  override fun getAuthTokenLabel(authTokenType: String?): String? = null
  override fun hasFeatures(response: AccountAuthenticatorResponse?, account: Account?, features: Array<out String>?): Bundle =
    Bundle().apply { putBoolean(android.accounts.AccountManager.KEY_BOOLEAN_RESULT, false) }
}

class AuthenticatorService : Service() {
  private lateinit var authenticator: StubAuthenticator

  override fun onCreate() {
    authenticator = StubAuthenticator(this)
  }

  override fun onBind(intent: Intent?): IBinder = authenticator.iBinder
}
