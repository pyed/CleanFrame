# Development

## Browser preview

Start with Node.js 22.13+ (22 LTS), or 24+, and Python 3.10+, then `npm ci`. These are the supported development baselines; lower versions have not been checked. Install Chromium once with `npx playwright install chromium` for the optional browser tools. Linux hosts may also need Playwright's documented system dependencies (`npx playwright install --with-deps chromium`).

`npm run dev` starts http://localhost:4795/home/, bound to this computer only. `/home/` serves `app/`, the same source used in the signed widget. Arrow keys, Enter and Escape mirror remote navigation. Device controls report that they require the TV; no success is simulated.

`npm run dev:public` serves the same interface using only the bundled public fonts, even when paid Pangram files exist locally. For a contributor's fresh clone, use the README and `docs/for-agents.md`; the signing/device setup below describes the reference machine and needs adaptation for another owner.

All UI assets, public fonts and the fifteen wallpapers are bundled. This private build also includes the three locally installed Pangram families through an ignored build overlay; their binaries are not in the public source tree. Glass materials and blurred panel backgrounds are rendered ahead of time; see app/assets/wallpapers/README.md.

## Runtime map and compatibility

- `app/index.html` loads the device adapter, gallery/font/palette catalogues, `assets/icons/metrics.js`, `i18n.js`, `assets/hijri.js`, `almanac.js`, `news.js` and `main.js`, with `style.css`.
- `main.js` owns the List and Dock layouts, panel stack, focus, preferences and wallpaper timers. `device.js` owns installed-app discovery and Tizen calls. Keep device details in that adapter.
- `i18n.js` holds the Arabic strings, keyed by the English source text; a missing key stays English. `almanac.js` calculates Umm al-Qura dates from `assets/hijri.js` and prayer times from solar formulas, offline. Startup keeps `.scene` hidden (`is-booting`) until the first look is shown or fails, for at most `BOOT_LIMIT` (4 s). On that QN90B, painting text in a newly loaded face held the main thread for about 0.9 s while the CPU rasterised. The fallback, Manrope and Arabic faces each caused one such stall before this, so the remote waited during startup; the photo swap itself took about 0.1 s. Keep work that changes fonts or large painted areas out of the moments when the remote is in use. `news.js` is the only network code. The same file runs as a worker that makes one bounded request per feed and reads it into plain-text titles with string matching, so the page receives only a few titles. If the worker cannot start, or its request is refused without an HTTP status, the page makes that request itself.
- Arabic mirrors `.bg` and `.home` with `scaleX(-1)`, so photos, scrims, glass fields and offline ink regions stay registered; text, logos and icons turn back inside `.flip` wrappers and the caption/controls containers. Positions computed from screen rectangles convert back with `1920 - x - width`. Remote Left/Right swap at the key input (`physical()`), and `ShoreQA.nav` uses the same physical keys. Settings and panels mirror through `.rtl` CSS overrides; when adding a physical margin or position rule, add its mirrored `.rtl` counterpart.
- `node scripts/build-hijri.mjs` regenerates `assets/hijri.js` from Node's ICU Umm al-Qura calendar. Prayer times were calibrated against ummulqura.org.sa (October 2026 samples for Riyadh, Makkah and Madinah); check other cities against their local announcements.
- The logical stage is 1920 x 1080, scaled uniformly to the viewport. Check at 1920 x 1080 and 1280 x 720. Glass geometry and cached materials must stay aligned.
- Preferences use localStorage key `cleanframe.home.v1`, with a fallback read from `cleanframe.shore.v1`. Legacy fields are `dock`, `wallpaper`, `mode`, `lastApp` and `theme`. The 0.6 migration preserves app order, wallpaper, rotation and selection. Legacy `list` becomes Dark / List / Type; `shore` and `grid` become Photo / Dock / Glass. Appearance axes are stored separately; `lang` (`en`/`ar`) and `arfont` join them, because a language switch waits for its font like any appearance change. `date`, `prayer` (`show`/`hide`), `city` and `news` (a source ID or `off`) are top-level and written directly. Earlier preferences gain English, date and prayer times shown, Riyadh and Sabq; a saved source that is no longer offered falls back to Sabq. Preferences are written as version 3. A version 2 Home that held only the old nine defaults (and Plex) becomes HDMI 3, YouTube, Plex and Apple TV, focused on HDMI 3; a version 2 Home with other apps keeps them and gains the HDMI tile first. Unversioned older preferences keep their Home. An app saved by an ID that now has a known entry (Plex) moves to that entry. A saved dynamic app keeps its real app ID and name; discovery refreshes the installed catalogue. Keep migration checks when changing this format.
- `window.ShoreQA.state()` and `.where()` expose state and focus for browser tests. `minuteMs` can shorten rotation intervals in an isolated browser test.

The tested target is the Tizen 9.0 TV in [TV status](tv-status.md); [contributor reports](compatibility.md) cover other TVs. The manifest's `required_version="6.5"` is a package declaration, not proof of broad Tizen 6.5 support. The exact reference TV Chromium/WebKit engine version has not been recorded. `npm run lint` uses ESLint's ES5 grammar for all runtime JavaScript and checks undefined names, unused code and dynamic evaluation. This does not check DOM/CSS or TV API availability; verify new APIs on the target before claiming support. The CSS guard rejects `inset` and flex `gap` declarations; use explicit top/right/bottom/left edges and child margins. The spacing fallback addresses the older engine reported in PR #11 without changing the package minimum. Geometry checks cover both Home layouts, all three control modes and both preview sizes; they do not establish TV compositor support. Tooling stays in development dependencies and outside the widget. See [ESLint's language options](https://eslint.org/docs/latest/use/configure/language-options).

Keep material rendering in the development tools. See [asset generation](assets.md) and [testing](testing.md).

## Local TV tools and signing

This Mac's setup lives under `.local/` and is excluded from Git:

- `tizen-sdk/`: official Tizen SDK command-line tools, embedded Java and SDB.
- `certificates/private/`: Samsung-issued author/distributor certificates, private keys, protected PKCS12 files and their generated password.
- `certificates/ca/`: CA certificates from Samsung's Certificate Extension.
- `device.json`: TV host address.

`npm run package` builds the widget from `app/` and signs it with an existing official SDK profile. It does not rewrite `profiles.xml`, certificate paths or SDK configuration. It writes `dist/CleanFrame-unsigned.wgt` and promotes a successful build to `dist/CleanFrame.wgt`. Each attempt uses a fresh ignored `dist/signed-*` folder, retained for inspection; a failed attempt keeps the previous successful widget. Check the packaging exit status before installing, since `tv:install` does not establish that this is the latest source build. `scripts/font_assets.py` adds only the six approved local Pangram files and the four Thmanyah files when complete pairs are available, plus their generated CSS/catalogue. It never copies private fonts into `app/`. Public checkouts use Manrope, Geist, Newsreader and IBM Plex Sans Arabic.

Thmanyah's licence forbids redistribution, so each owner downloads the family from [font.thmanyah.com](https://font.thmanyah.com/) and places `thmanyahsans-Regular` and `thmanyahsans-Medium` (and optionally `thmanyahserifdisplay-Regular` and `-Medium`) in `.local/research/font-candidates/thmanyah/`, keeping the downloaded `.otf`, `.ttf` or `.woff2` format unmodified. `npm run dev` then offers them under Typography in Arabic; `npm run dev:public` and `npm run export:public` never include them. A personal widget with these faces must stay private.

The manifest declares `http://tizen.org/privilege/internet` and an `access` origin for each of the five headline feeds; nothing else uses the network. It also declares `http://tizen.org/privilege/tv.window` (public level) for the HDMI tile's source switch. Sabq, Al Arabiya and Al Jazeera send no CORS headers, and Al Arabiya refuses some non-browser clients. On the Tizen 6.5 QN90B in [compatibility](compatibility.md), all five feeds returned 200 to the page and to the worker; other TVs are unverified. The HDMI tile follows the sequence that the MIT-licensed Free My TV home screen reports working on a Tizen 4 TV (set the listed source, then open `org.tizen.tv-viewer`); on the Tizen 6.5 QN90B in [compatibility](compatibility.md), its owner confirmed that OK on the tile switches the TV to HDMI 3. Re-check the manifest after any packaging change, and confirm headlines on the TV before relying on them.

For another owner (on Windows too; see [another checkout](#another-checkout-or-computer)), copy `signing.example.json` to `.local/signing.json` and replace its placeholders with the installed SDK path, certificate profile name and the package/application IDs generated by the official project wizard. An existing local config must explicitly select `profile`; the maintainer default applies only when no config exists. Paths may be absolute or relative to the repo; `~` is supported. The SDK path resolves symlinks before invoking its tools. If the SDK launcher fails on spaces in its real installation path, select a space-free SDK installation; a repository symlink can still contain spaces. The password filename remains unresolved so the no-follow check can reject a symlink. The example contains no real credentials. Both identity fields must be set together. Packaging changes only these two attribute values in the generated manifest; tracked source and the maintainer's identity remain unchanged. The installed app reads its own identity from Tizen when filtering All apps. Native Home helpers retain their separate reference-machine guards and must be reviewed independently.

Select the profile's existing `profiles.xml` through the official SDK configuration if needed; see [Samsung's CLI configuration and packaging documentation](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html). Certificate Manager can store certificates in its own folders. CleanFrame uses those existing paths without moving or rewriting them.

`npm run export:public` is a separate offline, unsigned export. It always disables the proprietary overlay, includes the project/third-party notices and writes `dist/CleanFrame-public-unsigned.wgt`. It reads no signing credentials and contacts no TV. Use it for public build preparation; `npm run package` on this machine remains a personal build that can contain paid fonts. Asset release checks are listed in `docs/public-release.md`.

Leave `password_file` as `null` or omit it to use the SDK's saved password access. No extra plaintext copy is required. An unexpected password prompt fails immediately; configure password access in the official tools or explicitly select a password file. The optional file must be owned by the current user, have mode `600` or `400`, and reside in `.local/` or outside the repo. A symlink at the final filename and files inside `app/` or `.git/` are rejected; parent symlinks are resolved before the location check. This fallback supplies one password to at most two certificate prompts and declines password-saving prompts; use SDK-managed access for certificates with different passwords. SDK signing output is suppressed so credentials cannot enter diagnostics. Fixed validation messages identify password-prompt, timeout, failed-command, missing-signature and identity errors without copying SDK output.

With no `.local/signing.json`, the original maintainer defaults remain: `.local/tizen-sdk`, profile `FrameHome`, the source manifest identity, and the existing private password file if present. Its permissions must satisfy the same checks. The SDK must already be configured; automatic SDK/profile repair has been removed. Actual signing with an owner's certificates requires a separate local check; offline tests use a fake SDK.

The initial custom XML-signature implementation was rejected by the TV. Use the official SDK packager for future builds; the installed test was signed with Tizen CLI 2.5.25.

## Another checkout or computer

Install the official [Samsung TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) and select its path in `.local/signing.json`. To retain in-place updates to your own existing app, securely transfer its author certificate and password. Keep those credentials local.

The npm scripts run Python through `scripts/run-python.mjs`: `python3` on macOS and Linux; on Windows, `python` or the `py` launcher in UTF-8 mode, because `python3` there is often the Microsoft Store placeholder. Packaging and the TV commands also work on Windows, with these limits:

- `npm run package` runs `tools\ide\bin\tizen.bat` without a terminal, so it uses only the profile's saved passwords. Leave `password_file` null; a password prompt stops packaging. The profile name and paths cannot contain `& | < > ^ % "` or `!`.
- The CLI signs with the profiles file named by `tizen cli-config -l` (`default.profiles.path`). Certificates made with Samsung's VS Code extension are listed in `%USERPROFILE%\.tizen-extension-platform\server\sdktools\sdk-data\profile\profiles.xml`; select that file once with `tizen cli-config "default.profiles.path=<that path>"` (the quotes are required on Windows). An unknown profile still produces an unsigned package, so packaging stops and names the profile.
- `npm run tv:info`, `tv:install` and `tv:launch` use `tools\sdb.exe` and the same checks as on macOS.
- `npm run check:tools` skips the cases that need POSIX symlinks, file modes or terminals; macOS, Linux and CI run them. Windows adds its own signing-runner cases.

For new certificates, use Samsung's [certificate setup](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html). The distributor certificate must include the target TV's DUID. A generic emulator certificate does not establish compatibility with this consumer TV.

Create `.local/device.json` with:

```json
{"host": "YOUR_TV_IP_ADDRESS"}
```

For developer access, connect the TV and Mac to the same network, enable Developer Mode in Apps → App Settings → 12345 and enter the Mac's local address. Fully restart the TV if the developer port remains closed.

## Install and launch

`npm run tv:install` uploads the signed widget with a unique build filename and calls Samsung's `vd_appinstall` command. It checks for `install completed` and confirms the app appears in the installed-app list. `sdb install` on this TV only uploaded the widget and did not install it.

`npm run tv:launch` opens the selected app. It does not change startup defaults. The TV tools use the SDK path and identity selected in `.local/signing.json`, falling back to the reference SDK and source manifest. Before any install connection, the installer checks the signed widget's identity and private-file policy. Changing an installed app's identity creates a different application; preserve existing identity and author certificates for updates. These tools remain reference installation commands, not an unattended installer for every TV.

## Sources

- [Samsung developer connection steps](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Samsung app-launch sample](https://github.com/SamsungDForum/LaunchApp)
- [Samsung remote input guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)

## Native Home and recovery

Native Home/startup was configured separately from the app installer. Physical Home from Netflix is confirmed. The one-shot helper runs as the SDK user. See scripts/native-home/README.md and docs/tv-status.md for the tested firmware and pending visual checks.

Query with `python3 scripts/native-home/run.py query`. Restore the saved pre-integration Home/startup values with `python3 scripts/native-home/run.py restore`. The private baseline is `.local/native-home/original.json`; preserve it and do not replace it with the applied state. The legacy `.local/native-home/run.py` command is also retained. Restore before uninstalling CleanFrame or changing its stable app identity.

To rebuild the one-shot helper with this Mac's private verified SDK:

```sh
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_CLI_HOME="$PWD/.local/native-home/cli" .local/native-home/dotnet-sdk/dotnet build scripts/native-home/Control.csproj -c Release --nologo -p:BaseIntermediateOutputPath="$PWD/.local/native-home/obj/" -o .local/native-home/out
```

The helper's output is not packaged inside the web app. Keep the original values, compiler, runtime output and all device diagnostics ignored.
