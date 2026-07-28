# Lupira Calendar Mobile — milestones

React Native app (Android-first, offline-first) in this repo: `apps/mobile` (Expo dev
client) + `packages/domain` (shared pure TS). Sync = REST delta endpoints (changes /
cursor / tombstone vocabulary) on cal-api + contact-api, through the web BFF as single
gateway. Statuses: `pending` | `in-progress` | `done` | `blocked(<reason + unblock>)`.
This file is the single source of truth — updated in the same commit as the work; exit
criteria are verifiable commands/observations.

| M  | Title | Repos | Status |
|----|-------|-------|--------|
| M0 | Monorepo restructure | LupiraCalWeb | done |
| M1 | cal-api sync surface | LupiraCalApi | done |
| M2 | contact-api sync surface + BFF bearer + Authentik | LupiraContactApi, LupiraCalWeb | done |
| M3 | App skeleton + auth | LupiraCalWeb | done |
| M4 | Sync engine | LupiraCalWeb | done |
| M5 | Calendar + contacts UI | LupiraCalWeb | done |
| M6 | Bridge spike (throwaway) | LupiraCalWeb | done |
| M7 | Bridges full two-way | LupiraCalWeb | in-progress |
| M8 | Hardening + release | LupiraCalWeb | pending |

Fixed identity: Android package `com.lupira.calendar`, scheme `lupiracalendar`
(redirect `lupiracalendar://oauthredirect`), Authentik public client `lupira-cal-mobile`,
display name "Lupira Calendar".

## M0 — Monorepo restructure   [status: done]

npm workspaces; extract `@lupira/cal-domain` (packages/domain, consumed as source via
`exports: {"./*": "./src/*.ts"}`); web client + BFF stay put; repo/remote/deploys untouched.

### Scope
- [x] Client toolchain bumps in place: eslint-plugin-boundaries ^7.1.0 (config migrated to v7 policies/entity selectors; config.ts → config/ so the element still classifies), typescript-eslint ^8.65.0, vitest ^4.1.10, orval ^8.23.0. TS stays 6.0.3 — typescript-eslint peers `<6.1.0` and TS 7 crashes its parser; revisit when support lands
- [x] Root package.json (workspaces: packages/*, src/LupiraCalWeb.Client, apps/*), root lock, `.npmrc` moved to root, toolchain devDeps hoisted
- [x] Dockerfile client stage rebuilt for workspace install; tests.yml uses root scripts + root lock cache path
- [x] Move 13 domain modules + tests → packages/domain/src; move partialDate.ts with structural PartialDate type (no generated import)
- [x] Import codemod to `@lupira/cal-domain/*`; web eslint drops `domain` element; domain package gets purity-enforcing eslint (`boundaries/external` disallow)
- [x] Docs: README/CLAUDE.md layout notes; verify skill path fix

### Exit criteria
- [x] Root `npm ci` clean; `node_modules/@lupira/cal-domain` is a workspace symlink
- [x] Root `npm run lint && npm run typecheck && npm test` green (domain: 13 suites / 87 tests; web: passWithNoTests)
- [x] Root `npm run build` emits to src/LupiraCalWeb/wwwroot; `docker build .` succeeds
- [x] `npm run gen:api` still resolves sibling repo specs (client cwd unchanged)
- [x] Vite dev serves workspace domain source (smoke: `/@fs/**/packages/domain/src/time.ts` transpiled)
- [x] CI green on main (release run 2026-07-28 on sha-c4c4de0)

### Non-goals
No Expo app yet; no backend/.NET/slnx/deploy changes; no entries.ts split; no path
aliases; no barrel index; no orval regen.

## M1 — cal-api sync surface   [status: done]

Additive only — existing routes and the legacy feed untouched; web unaffected.

### Scope
- [x] Projected `UpdatedSequence` (indexed, set in `Apply(IEvent<T>)`) + `createdAt`/`updatedAt`/`version` on snapshot and DTO. The planned flat `CalendarIds[]` column proved unnecessary: the feed is account-wide, so visibility filters in memory over the changed page only. Event store switched to Rich append mode (Quick assigns sequences server-side at INSERT — inline applies read 0)
- [x] `GET /sync/changes?since={cursor}&limit={n}` → `{cursor, hasMore, changed[full DTOs + guards], deleted[ids]}` — indexed watermark query, paged (default 200/cap 500); deleted = soft-deleted ∪ no-longer-visible (covers unfile + unshare)
- [x] `GET /sync/containers` → calendars snapshot (plain docs have no cursor)
- [x] Per-section LWW guards on the snapshot — sections: `core`, `metadata`, `payload` (prompt/action share the XOR slot, one guard), `filing` (per-calendar dict). Tasks-api wins rule byte-for-byte; unstamped events fall back to event timestamp + sequence-encoded command id (append order preserved). Delete absorbing. Deviation: participants stay append-ordered (rare conflicts; Idempotency-Key still dedups replays)
- [x] `occurredAt` optional on mutating endpoints (PUT body; `?occurredAt=` on metadata/clears/curation; payload set via body)
- [x] Idempotency ledger port (ProcessedCommand, same-transaction insert with event append; PK violation rolls back the loser); `Idempotency-Key` header on update/delete/metadata/payload/curation. Creates need no key — `SourceKey` already pins the stream id
- [x] PUT core totalized with `*Provided` sentinels: `startsAt/endsAt/startDate/endDate/startTimezone/endTimezone/recurrenceRule` + `isAllDay` (bool?, null = keep)
- [x] `tools/FixtureEmitter` → `packages/domain/test/fixtures/{recurrence,lww-vectors}.json` (17 recurrence cases, 10 LWW vectors; `--from-db` mode ingests real rules)
- [x] `sectionGuards` on the sync DTO; OpenAPI regen → downstream `gen:api` ran

### Exit criteria
- [x] Curl delta loop against dev stack: create → changed; edit → changed with guards; unfile → tombstone; delete → tombstone; quiet cursor stable; containers snapshot OK
- [x] Replayed Idempotency-Key: PUT replay returns prior state without reapplying; DELETE replay 204 instead of 404 (integration tests + curl)
- [x] Server LWW suite green (SectionLwwTests, 12 tests); vectors exported for the client twin
- [x] Full suites green: 140 unit / 133 integration (incl. legacy feed + web-facing routes untouched); web client regenerated, lint/typecheck/test/build green

### Manual steps
- [x] Deploy includes one-time projection rebuild: `dotnet LupiraCalApi.dll --rebuild-items` (run 2026-07-28 — cal-api sha-8cf1b83 deployed, schema applied, projection rebuilt)

## M2 — contact-api sync surface + BFF bearer + Authentik   [status: done]

### Scope
- [x] contact-api `/sync/changes` (account-wide watermark query; tombstones cover deletes + book-moves to unreadable books) + `/sync/containers` (books + groups — groups leave the cursor domain, closing the group feed gap)
- [x] Per-section guards + occurredAt + idempotency ledger (same port as M1). Deviation: channel and tag writes ride the `ContactRevised` event server-side, so they share the `core` guard — sections are core/addresses/profiles/avatar/metadata/deceased (mark/clear share one). Relations + emergency contacts stay append-ordered. Bonus: `CreateContactRequest.SourceKey` added — offline creates are replay-safe (cal already had it)
- [x] BFF: JwtBearer second scheme (`Auth:Bearer:Authority` ?? OIDC authority; aud `lupira-cal`); Default policy = interactive scheme OR bearer; YARP forwards a caller-presented bearer verbatim (transform stands aside), else Duende cookie exchange
- [x] 302-vs-401 guard covers `/api` + `/geo-api` + `/contact-api` (cookie login/denied + OIDC challenge)
- [x] BFF launchSettings binds 0.0.0.0:5181 (physical-device dev)

### Exit criteria
- [x] PKCE token minted from `lupira-cal-mobile` → BFF succeeds. Verified headlessly to the interactive boundary: discovery live (issuer Global, S256, all scopes), authorize endpoint 302s into the login flow with the app's exact client/redirect/scopes; the BFF leg is proven by the integration tests. The full mint needs a human login — exercised at M3's device sign-in exit
- [x] Browser cookie flow unchanged (OIDC/cookie wiring untouched apart from the challenge guard; non-API challenge still redirects — covered by test)
- [x] BFF integration tests cover both auth paths (tests/LupiraCalWeb.IntegrationTests, stub upstream: bearer accepted + forwarded verbatim on all three prefixes, wrong-audience/garbage bearer rejected, anonymous API calls 401 not 302, page navigation still redirects). contact-api: 168 unit / 96 integration green

### Manual steps (all Authentik)
- [x] Public client `lupira-cal-mobile`: PKCE, blank secret, subject mode email, issuer Global (verified via discovery)
- [x] Redirect regex `^lupiracalendar://.*$` (verified: authorize accepts `lupiracalendar://oauthredirect`)
- [x] Scopes: openid email profile offline_access + lupira-cal-aud + lupira-contact-aud + lupira-geo-aud (`groups` deliberately omitted — nothing in the mobile path needs it)
- [x] Deploy note: contact-api needs one-time `dotnet LupiraContactApi.dll --rebuild-contacts` (run 2026-07-28 — contact-api sha-d874085 deployed, schema applied, projection rebuilt; cal-web BFF sha-c4c4de0 live with the bearer front door)

## M3 — App skeleton + auth   [status: done]

### Scope
- [x] apps/mobile: Expo SDK 57 + dev client (RN 0.86.0 — 0.86.2 sits inside the npm release cooldown), React Navigation 7 shell (Calendar / Contacts / Settings tabs + Sync issues / Debug log stack), package `com.lupira.calendar`, scheme `lupiracalendar`
- [x] Orval per-app generation (cal `/api`, contact `/contact-api`, geo `/geo-api` — one BFF origin, prefix picks the upstream; raw fetchers with per-status envelope unions) + mutator (bearer via AuthPort, 10s timeout, Retry-After-aware retry, one forced re-auth per call)
- [x] Native OIDC: expo-auth-session system browser + PKCE against `lupira-cal-mobile` (hand-rolled code exchange for visible errors; `createTask:false`; non-empty redirect path); tokens in expo-secure-store
- [x] AuthPort inversion; coalesced single-flight refresh, rotation-safe (`sentToken` guard), definitive (400/401 → sign out) vs transient (keep session) classification
- [x] Settings screen: presets Production (oidc) / LAN dev `192.168.14.108:5181` (dev auto-auth) / Emulator `10.0.2.2:5181` / custom URL+mode; default from `EXPO_PUBLIC_API_URL`; persisted; reachable from the login screen too
- [x] Debug ring buffer + on-device log screen; uuid v7 + expo-crypto polyfill as first import
- [x] Calendar tab carries the `/api/me` connection smoke (proves token/dev-header → BFF → cal-api)

### Exit criteria
- [x] Dev-client APK on a physical device signs in against prod BFF and Calendar shows "Connected as …" (verified 2026-07-28 on the S23: Authentik sign-in, full sync pulled calendar items + contacts)
- [x] LAN preset criterion dropped 2026-07-28 — prod deployed early and became the dev loop; the Emulator preset covers future local dev
- [x] Refresh rotation-safe under concurrent calls + token persistence round-trip (vitest: 24 tests — refresh machine, mutator 401/retry paths, retry policy); Metro bundle exports clean; all root gates + docker build green (Docker installs web workspaces only)

### Manual steps
- [x] Dev client built + installed on the S23 2026-07-28 (`npx expo run:android`; Ubuntu SDK via cmdline-tools, inotify limits raised)

## M4 — Sync engine   [status: done]

### Scope
- [x] Mirror schema (items + item_calendars + occurrences + contacts + containers + outbox + sync_state + mirror_meta); append-only migration ladder on user_version; outbox never dropped (ops carry envelope_version)
- [x] Exclusive transactions: every mirror helper takes a Tx; writes only inside Db.exclusive (expo `withExclusiveTransactionAsync` / node BEGIN IMMEDIATE + mutex)
- [x] Outbox: per-row backoff (next_attempt_at, exp + jitter, 30 min cap), park after 8 attempts, causal hold (SQL NOT EXISTS earlier parked sibling), 429 = retry, 401 = pause untouched
- [x] Client LWW twin: `@lupira/cal-domain/lww` passes the emitted vector suite (sub-ms ISO precision preserved — Date.parse would mis-tie .NET's 7-digit timestamps); reducers seed per-section guards from sync `sectionGuards`; rebase folds pending AND parked ops over the server base
- [x] Paged delta pull that reads the cursor (persisted per page); tombstone apply; full-sync prune keeps pending local creates; containers snapshot replace
- [x] TS recurrence expander in packages/domain — 17/17 parity fixtures (incl. Ical.Net's non-matching-DTSTART behavior); occurrence materialization over a −12/+24-month rolling horizon with drift re-materialization; birthday synthesis (year-less + Feb 29)
- [x] monthKey-scoped react-query invalidation (no global revision counter); deterministic ids (MD5 + .NET Guid layout, pinned against real .NET output) so offline creates need no temp-id reconciliation
- [x] expo-background-task registration (15-min floor, best-effort) + foreground triggers (app-active, connectivity, sign-in, post-enqueue)
- [x] node:sqlite in-memory harness from day one — the entire engine (transactions included) runs under vitest

### Exit criteria
- [x] Engine covered under vitest (62 mobile + 123 domain tests): replay classification, backoff/park, causal hold, migration ladder incl. outbox survival, LWW vectors, expander parity, pull-with-pending-section-edit regression, deletion reconciliation, discard-rolls-back contract
- [x] Full + delta sync loops green against the LIVE dev stack (throwaway harness test, run then removed): offline create → drain through BFF → delta returns real section guards; cross-writer web PUT arrives on next delta; delete round-trips as tombstone; birthday synth from a created contact
- [x] Device: airplane-mode edit → kill → relaunch → reconnect → server converges (verified 2026-07-28 against prod)
- [x] Concurrent cross-writer edits (phone offline vs web) converge to the later occurredAt on both — same LWW path the two-device case exercises
- [x] Background task observed firing on device (best-effort under Doze, as documented)

## M5 — Calendar + contacts UI   [status: done]

### Scope
- [x] Week/month grids on packages/domain grid math (`monthMatrix`, `clampToDay` + `layoutColumns`); grids read only the `occurrences` table via one joined range query (`gridRowsBetween`: title/status/calendar color join — no per-item fan-out, no render-time expansion). Month view + selected-day agenda; week view with all-day chips + timed lanes
- [x] Item detail + per-section editing → outbox ops: core (whole-section form → totalized revise), metadata merge editor, filing toggles (file/unfile per mirror calendar), delete. Editing lives in pure `domain/editors.ts` (form ⇄ core, keep-vs-clear warts, timed/all-day duality) — vitest-covered
- [x] Offline-editable matrix enforced by construction: place attach, avatar, sharing, and group membership have no mobile write UI (web covers them). Deviation from plan: contact addresses joined the online-only set — an address is `{placeId, type}`, composing one requires geo place search, so detail shows a read-only summary
- [x] Contacts list (search, birthday badges) + detail (channels/tags/profiles wholesale editors → their ops, birthday with next-age, notes) + create/edit core forms; birthdays render in month cells, week all-day row, and the agenda
- [x] Sync issues screen: parked cards with op label/attempts/last error, expandable op JSON, per-row Retry (`retryOne`) and Discard (confirm → `discardParkedAndRestore` rolls the mirror back to server truth); waiting-to-sync list with backoff times; Sync now
- [x] Reactivity closure: `['items']`/`['outbox']` invalidation on enqueue/pull/drain/discard; `@react-native-community/datetimepicker` 9.1.0 added (native module — rides the still-pending first dev-client build)

### Exit criteria
- [x] Month/week render full family data offline from the mirror (verified 2026-07-28, airplane mode)
- [x] Every editable section edited offline round-trips to the server and shows in web UI
- [x] Birthdays visible in month + week grids
- [x] Code-level: 75 mobile + 123 domain tests green (incl. grid join, contact list, per-row retry); root lint/typecheck green; Metro bundle exports clean

## M6 — Bridge spike (throwaway)   [status: done]

### Scope
- [x] Kotlin AccountAuthenticator + stub sync adapter — packaged as a LOCAL EXPO MODULE (`modules/lupira-bridge`) instead of a config plugin: library manifest merges services/permissions/xml natively, survives prebuild by construction, and gives JS a typed API for free (the plugin-viability question, answered — see docs/mobile/bridge-spike.md)
- [x] One-way CalendarContract publish (as sync adapter under account `com.lupira.calendar`, own Lupira calendar, wholesale window publish keyed on `_SYNC_ID`); ContactsContract RawContacts sample read (ACCOUNT_TYPE/SOURCE_ID/DIRTY/DELETED)
- [x] Bridge spike screen (Settings → Bridge spike): permissions, ensure/remove account, publish ±1 month, request OS sync (onPerformSync stamps last-sync state), contacts sample
- [x] Written go/no-go learnings: account lifecycle, dirty-flag mechanics (docs/mobile/bridge-spike.md — verdict GO; device-verified findings incl. WRITE_SYNC_SETTINGS requirement, isAlwaysSyncable manual-sync behavior, account-removal purge, foreign-account DIRTY noise, contacts authority needed for a contacts source)

### Exit criteria
- [x] Lupira account visible in Android Settings; 49/49 published events visible + correctly rendered in Samsung Calendar; onPerformSync observed; account removal purges the calendar (verified 2026-07-28, S23)
- [x] Learnings doc committed; M7 scope adjusted from it (6 items in bridge-spike.md)

## M7 — Bridges full two-way   [status: in-progress]

Staged per the spike findings (docs/mobile/bridge-spike.md). Kotlin = provider I/O only;
inbox-row → op translation is pure TS under vitest. Write-back field subset — events:
title, description, schedule (timed + all-day), recurrence rule, delete, create;
contacts: structured name, phones, emails, birthday, delete, create. Out of scope:
location write-back (ItemCore has no location field — publish-only), calendar moves in
stock apps (overwritten by next publish), payload/participants.

### Scope
- [x] S1 Calendar publish v2 inside onPerformSync: mirror `items` → one provider calendar per mirror calendar (name/color), events upserted by `_SYNC_ID` = item id, RRULE rows for recurring items (not expanded instances), all-day/timed mapping, content-hash skip via SYNC_DATA1, stale-row/calendar deletion; birthdays left to the contacts bridge
- [x] S2 Calendar write-back (device matrix verified 2026-07-28: stock edit/create/delete → web; web → stock; no duplicates; echo suppressed): dirty/deleted/created rows captured to a Kotlin-owned bridge inbox db (capture-then-clear DIRTY as sync adapter), JS drain translates inbox → item.create/revise/delete through the normal outbox/LWW path; stock-created events get `_SYNC_ID` assigned post-create (no duplicate creation); echo suppression = value-hash comparison on publish
- [x] S3 Contacts adapter + publish (device-verified: Lupira contacts source live, cards render, deep link works; Samsung renders no third-party MIME rows and offers no third-party storage — see bridge-spike.md addendum): second sync service on the contacts authority (account becomes a contacts source), raw-contact upsert by `SOURCE_ID` (StructuredName/Phone/Email/Birthday event row), "Open in Lupira" MIME row
- [x] S4 Contacts write-back (code; device matrix pending): dirty/deleted Lupira raw contacts → inbox → contact.revise + wholesale contact.channels (+1ms guard ordering) / contact.delete; echo guard compares stock-expressible fields against the mirror; channel types the provider ints lost are re-attached from the mirror. Creation branch dropped — Samsung offers no third-party contact storage (stock-created contacts stay in Phone/Google, invisible to the adapter)
- [ ] S5 OS-scheduled drive: auto-sync + periodic sync on both authorities; provider-change upload syncs; inbox drained on app-active + background task (headless-JS drain documented as latency limit)

### Exit criteria
- [ ] Two-way edit matrix passes (stock apps ↔ server, both domains, the field subset above) without duplicate creation
- [ ] Stock-app edit round-trips to the web UI and a web edit lands in the stock app without manual sync taps

## M8 — Hardening + release   [status: pending]

### Scope
- [ ] Self-distributed signed APK; versioning + update path documented
- [ ] Upgrade drill: previous build with queued outbox → upgrade → drain verified
- [ ] Month-grid perf pass on target device; docs refresh (README, docs/mobile)

### Exit criteria
- [ ] Upgrade-in-place with pending offline edits loses nothing
- [ ] Month swipe jank-free on the target device; docs current; tracker closed out
