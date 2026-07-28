# Bridge spike (M6) — findings

Throwaway spike answering three questions before M7 commits to a design. Code lives in
`apps/mobile/modules/lupira-bridge` (local Expo module) + the Bridge spike screen
(Settings → Bridge spike). Verdict: **GO** — all mechanics proven on the S23 (2026-07-28).

## Q1 — Native packaging: config plugin vs local Expo module

**Answer: local Expo module, decisively.** `create-expo-module --local` under
`modules/lupira-bridge`, discovered by expo autolinking:

- Library `AndroidManifest.xml` (services, permissions, meta-data) merges via the standard
  manifest merger — zero config-plugin surgery, survives prebuild by construction.
- XML resources (`res/xml/lupira_authenticator.xml`, `res/xml/lupira_syncadapter_calendar.xml`)
  ride the library like any Android lib.
- The same module exposes the typed JS API (`requireNativeModule`) that a config plugin
  would have needed separately.

Proven end-to-end: prebuild → Gradle → device, services registered and functional.

## Q2 — Account lifecycle (verified on device)

- Stub `AbstractAccountAuthenticator` for type `com.lupira.calendar`; the app creates the
  account with `addAccountExplicitly`. Settings → "Add account" entry is not offered
  (stub returns null) — acceptable, the app owns the lifecycle.
- Account appears under Android Settings → Accounts; survives app restart.
- **`WRITE_SYNC_SETTINGS` (+ READ) install-time permissions are required** for
  `setIsSyncable`/`setSyncAutomatically` — missing them throws SecurityException *after*
  account creation, so ensure-account must be idempotent/repair-on-retap (it is now).
- `isAlwaysSyncable` in the adapter XML alone was enough for a **manual** `requestSync`
  to dispatch `onPerformSync` (observed via the last-sync stamp) even when the
  sync-settings write had failed.
- **Removing the account purges the Lupira calendar and its events automatically** —
  provider cleanup is free; also means account removal is destructive and a later
  ensure+publish rebuilds from the mirror (fine — the mirror is the source of truth).

## Q3 — Provider mechanics (verified on device)

- Calendar publish as `CALLER_IS_SYNCADAPTER` under our account: 49/49 occurrences of a
  ±1-month window landed and render correctly in Samsung Calendar (all-day + timed,
  🎂 birthday titles). Calendar may need enabling once under Manage calendars.
- Provider reads before the runtime grant throw SecurityException — state reads must
  catch it (mount-time read does).
- Contacts recon (415 raw contacts): SIM (`vnd.sec.contact.sim`) and Telegram
  (`org.telegram.messenger`) accounts visible. **`DIRTY=1` sits permanently on rows of
  accounts whose adapter never clears it** — the flag is per-account bookkeeping, only
  meaningful for rows we own; never read other accounts' dirty flags as signal.
  `SOURCE_ID` is frequently null on other adapters — ours must always set it (aggregate id).
- The Lupira account does NOT appear as a contacts source — a second sync adapter bound
  to the `com.android.contacts` authority is required for that (M7).
- Open oddity: RawContacts total differed between two consecutive reads (1019 → 415);
  suspect profile/visibility scoping — pin down in M7 before relying on counts.

## M7 device findings (addendum, 2026-07-28)

- Samsung Contacts (One UI) does NOT render third-party `ContactsDataKind` rows — the
  "Open in Lupira" row exists in the provider (and works on AOSP-based contact apps) but is
  invisible in Samsung's UI. The deep link itself is proven (adb VIEW intent →
  ContactDetail). Keep the row; don't advertise it as a Samsung feature.
- Samsung Contacts never offers third-party accounts as contact storage (no `EditSchema`
  escape hatch honored) → stock-created contacts can't land under our account. Write-back
  covers edits + deletes of Lupira-owned raw contacts; creation stays in the app/web.
- Settings → "Add account → Lupira" with a null-returning stub bounces silently; returning
  a KEY_INTENT launch intent opens the app instead.

## M7 scope adjustments

1. Add a contacts sync-adapter service (`syncadapter_contacts.xml`, authority
   `com.android.contacts`) so the account owns raw contacts and shows as a contacts source.
2. Recurring items: publish RRULE rows, not expanded instances (spike published expanded
   occurrences — fine for visibility, wrong for edit round-trips and reminder semantics).
3. Row-level upserts keyed on `_SYNC_ID` / `SOURCE_ID` (spike does wholesale replace).
4. Write-back loop: user edits set DIRTY on our rows → adapter translates to outbox ops →
   clear DIRTY (as sync adapter) after ack; echo suppression via `_SYNC_ID` + content hash.
5. Move the publish from JS into `onPerformSync` so OS-scheduled sync works without the
   app process; keep permissions ensured before enabling.
6. Keep `isAlwaysSyncable`; still set sync flags explicitly now that the permission exists.
