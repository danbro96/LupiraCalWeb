# Bridge spike (M6) — findings

Throwaway spike answering three questions before M7 commits to a design. Code lives in
`apps/mobile/modules/lupira-bridge` (local Expo module) + the Bridge spike screen
(Settings → Bridge spike). This doc is the deliverable; the code is disposable.

## Q1 — Native packaging: config plugin vs local Expo module

**Decision: local Expo module.** `create-expo-module --local` gives a Kotlin library under
`modules/lupira-bridge` that expo autolinking discovers automatically:

- Its `AndroidManifest.xml` (services, permissions, meta-data) merges via the standard
  library manifest merger — zero config-plugin manifest surgery, survives prebuild by
  construction.
- XML resources (`res/xml/lupira_authenticator.xml`, `res/xml/lupira_syncadapter_calendar.xml`)
  ride the library like any Android lib.
- The same module exposes a typed JS API (`requireNativeModule`) — the config-plugin
  approach would still have needed a separate native-module story for JS↔Kotlin calls.

A `withDangerousMod` config plugin copying sources into the app template remains the
fallback only if something requires editing the *app* module itself. Nothing so far does.

## Q2 — Account lifecycle

- Stub `AbstractAccountAuthenticator` + service registered for account type
  `com.lupira.calendar`; the app creates the account programmatically
  (`addAccountExplicitly`) — Settings → "Add account" is NOT supported (stub `addAccount`
  returns null); acceptable, the app owns the lifecycle.
- Device findings (S23): _pending device loop_
  - [ ] Account visible under Settings → Accounts after "Ensure account"
  - [ ] Account survives app kill/restart; removed cleanly by "Remove account"
  - [ ] `requestSync` → `onPerformSync` fires (state shows "last OS sync")

## Q3 — Provider mechanics

- Calendar publish goes through `CALLER_IS_SYNCADAPTER` under our account: rows belong to
  the Lupira account, provider skips dirty-flag bookkeeping for our own writes (user edits
  in stock apps DO set `DIRTY` — that asymmetry is M7's write-back signal).
- Spike publish is wholesale (delete-by-calendar + insert window, `_SYNC_ID` = occurrence
  key). M7 needs row-level upserts keyed on `_SYNC_ID` + recurring events as RRULE rows
  rather than expanded instances (spike publishes expanded occurrences — fine for
  visibility, wrong for edit round-trips).
- Contacts: `readContactsSample` dumps RawContacts with ACCOUNT_TYPE / SOURCE_ID / DIRTY /
  DELETED to map the write-back columns.
- Device findings (S23): _pending device loop_
  - [ ] Lupira calendar + events visible in Samsung Calendar (may need
        "Manage calendars → show Lupira" once)
  - [ ] All-day vs timed rendering correct; 🎂 birthday titles show
  - [ ] RawContacts sample shows existing account types + dirty semantics

## M7 scope adjustments

_Filled after the device loop._
