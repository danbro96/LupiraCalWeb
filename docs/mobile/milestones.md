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
| M2 | contact-api sync surface + BFF bearer + Authentik | LupiraContactApi, LupiraCalWeb | pending |
| M3 | App skeleton + auth | LupiraCalWeb | pending |
| M4 | Sync engine | LupiraCalWeb | pending |
| M5 | Calendar + contacts UI | LupiraCalWeb | pending |
| M6 | Bridge spike (throwaway) | LupiraCalWeb | pending |
| M7 | Bridges full two-way | LupiraCalWeb | pending |
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
- [ ] CI green on main (pending push)

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
- [ ] Deploy includes one-time projection rebuild: `dotnet LupiraCalApi.dll --rebuild-items` (backfills watermarks; full sync misses pre-existing items until run)

## M2 — contact-api sync surface + BFF bearer + Authentik   [status: pending]

### Scope
- [ ] contact-api `/sync/changes` (SQL AddressBookId filter; book-move tombstone branch) + `/sync/containers` (books + groups — closes the group feed gap)
- [ ] Per-section guards (core/channels/addresses/tags/profiles/avatar) + occurredAt + idempotency ledger (same port as M1)
- [ ] BFF: JwtBearer second scheme (validate issuer + aud `lupira-cal`); Default policy = cookie OR bearer; YARP forwards caller bearer verbatim, else Duende cookie exchange
- [ ] Fix 302-vs-401 guard to cover `/geo-api` + `/contact-api`
- [ ] BFF launchSettings binds 0.0.0.0:5181 (physical-device dev)

### Exit criteria
- [ ] PKCE token minted from `lupira-cal-mobile` → curl BFF `/api/*` and `/contact-api/*` through the tunnel succeeds
- [ ] Browser cookie flow unchanged (web login/logout/refresh works)
- [ ] BFF integration tests cover both auth paths

### Manual steps (all Authentik)
- [ ] Public client `lupira-cal-mobile`: PKCE, blank secret, subject mode email, issuer Global
- [ ] Redirect regex `^lupiracalendar://.*$`
- [ ] Scopes: openid email profile groups offline_access + lupira-cal-aud + lupira-contact-aud + lupira-geo-aud (aud = [lupira-cal-mobile, lupira-cal, lupira-contact, lupira-geo])

## M3 — App skeleton + auth   [status: pending]

### Scope
- [ ] apps/mobile: Expo SDK 57 + dev client, React Navigation 7 shell (Calendar / Contacts / Settings / Sync issues stubs), package `com.lupira.calendar`
- [ ] Orval per-app generation + mutator (bearer via AuthPort, timeout, Retry-After-aware retry, per-status unions)
- [ ] Native OIDC: expo-auth-session system browser + PKCE against `lupira-cal-mobile`; tokens in expo-secure-store
- [ ] AuthPort inversion; coalesced single-flight refresh with definitive-vs-transient classification
- [ ] Settings screen: API URL presets (LAN dev :5181 / prod / custom; emulator 10.0.2.2), default from EXPO_PUBLIC_API_URL, persisted override
- [ ] Debug ring buffer (on-device log screen); uuid v7 + crypto polyfill as first import

### Exit criteria
- [ ] Dev-client APK on a physical device signs in against prod BFF and completes an authenticated call
- [ ] LAN preset works unauthenticated against the Development BFF
- [ ] Token survives app restart; refresh is rotation-safe under concurrent calls (vitest on the state machine)

### Manual steps
- [ ] Local APK build + device install

## M4 — Sync engine   [status: pending]

Recurrence expander port can start right after M1, in parallel with M3.

### Scope
- [ ] Mirror schema (items + item_calendars + occurrences + contacts + containers + outbox + sync_state); migration ladder on user_version; outbox never dropped (envelope_version, drain-before-migrate attempted)
- [ ] Exclusive transactions threaded through all db helpers
- [ ] Outbox: per-row backoff (next_attempt_at), park-after-N, causal-chain hold (parked op blocks later ops on same aggregate), 429 = retry
- [ ] Client LWW twin passing the M1/M2 vector suites; per-section guard seeding from sectionGuards; rebase includes parked ops
- [ ] Paged delta pull that reads the cursor; tombstone apply + scope-matched prune; containers snapshot diff
- [ ] TS recurrence expander + parity fixtures; occurrences materialization (−12/+24-month rolling horizon); birthday synthesis
- [ ] monthKey-scoped invalidation (no global revision counter)
- [ ] expo-background-task registration; foreground triggers (active/resume, debounced post-enqueue, pull-to-refresh)
- [ ] node:sqlite in-memory harness from day one

### Exit criteria
- [ ] Engine fully covered under vitest: replay classification, backoff/park, causal hold, migration ladder incl. outbox survival, LWW vectors, expander parity, pull-with-pending-section-edit regression, deletion reconciliation
- [ ] Device: airplane-mode edit → kill → relaunch → reconnect → server converges
- [ ] Two-device concurrent edits converge to the vector-predicted winner
- [ ] Full + delta sync loops green against the dev stack; background task observed firing

## M5 — Calendar + contacts UI   [status: pending]

### Scope
- [ ] Week/month grids on packages/domain grid math; grids read only from `occurrences`
- [ ] Item detail + per-section editing → outbox ops; offline-editable matrix enforced (place attach / avatar / sharing / group membership gated online)
- [ ] Contacts list + detail; birthdays in both grids
- [ ] Sync issues screen: per-row retry, op detail, discard rolls back the mirror write

### Exit criteria
- [ ] Month/week render full family data offline from the mirror
- [ ] Every editable section edited offline round-trips to the server and shows in web UI
- [ ] Birthdays visible in month + week grids

## M6 — Bridge spike (throwaway)   [status: pending]

### Scope
- [ ] Kotlin AccountAuthenticator + stub sync module as an Expo config plugin (survives prebuild)
- [ ] One-way CalendarContract publish of mirror items; ContactsContract read
- [ ] Written go/no-go learnings: account lifecycle, plugin viability, dirty-flag mechanics

### Exit criteria
- [ ] Lupira account visible in Android Settings; mirror items visible in the stock calendar app
- [ ] Learnings doc committed; M7 scope adjusted from it

## M7 — Bridges full two-way   [status: pending]

### Scope
- [ ] CalendarContract + ContactsContract two-way; dirty-flag write-back translated into outbox ops (same LWW path) with echo suppression
- [ ] "Open in Lupira" MIME rows; OS-scheduled sync driving the engine

### Exit criteria
- [ ] Two-way edit matrix passes (stock apps ↔ server, both domains, defined field subset) without duplicate creation

## M8 — Hardening + release   [status: pending]

### Scope
- [ ] Self-distributed signed APK; versioning + update path documented
- [ ] Upgrade drill: previous build with queued outbox → upgrade → drain verified
- [ ] Month-grid perf pass on target device; docs refresh (README, docs/mobile)

### Exit criteria
- [ ] Upgrade-in-place with pending offline edits loses nothing
- [ ] Month swipe jank-free on the target device; docs current; tracker closed out
