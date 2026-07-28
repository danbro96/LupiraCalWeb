# Lupira Calendar — release & distribution

Same pipeline as LupiraTasksMobile: **EAS build → Play Console internal testing**. EAS owns the
signing key (managed credentials, project `danbro96/lupira-calendar`); Play distributes and
auto-updates the family's installs.

## Versioning

- `eas.json` sets `cli.appVersionSource: remote` + `production.autoIncrement` — EAS bumps
  `versionCode` per production build; `expo.version` in `app.json` is the human version.
- Keep `APP_VERSION` in `src/config/index.ts` in lockstep with `app.json` `expo.version`.

## Building

```bash
cd apps/mobile
npx eas-cli build -p android --profile production   # AAB for Play
npx eas-cli build -p android --profile preview      # sideloadable release APK (no Play)
```

Monorepo note: EAS archives the git root and installs the workspace; the root `.npmrc`
(cooldown + ignore-scripts) applies on the build host.

## Releasing

First time (manual, Play Console):
1. Create the app (package `com.lupira.calendar`) in Play Console.
2. Internal testing track → upload the AAB from the EAS build page → add the family's
   Gmail addresses as testers → share the opt-in link.

Subsequent releases: `npx eas-cli submit -p android --profile production` (uses the
internal track from `eas.json`; needs the Play service-account key linked once), or upload
the AAB manually.

## Dev client vs release install

Same package id, different signing keys — they can never be installed over each other.
Switching directions requires an uninstall (mirror data is lost locally but resyncs; **drain
the outbox first**: Sync issues screen must show zero pending/parked). Day-to-day: family
phones run the Play build; the dev client is a development tool.

## Release-build behavior differences

- JS is bundled into the app — no Metro dependency.
- Cleartext HTTP is blocked: the LAN/emulator presets are hidden in release builds
  (Settings shows only https presets + custom).

## Upgrade drill (per release, before promoting)

1. On a device with the previous build: airplane mode → make a few edits (outbox non-empty).
2. Install the new build over it (Play update or `adb install -r` for preview APKs).
3. Reconnect → the queued edits drain and appear on the web. Nothing may be lost — the
   outbox survives upgrades by design (append-only migrations, envelope-versioned ops).
