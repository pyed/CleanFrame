# Interaction behaviour — 0.6.1

## Home

- Dock: Left/Right scrolls the apps without wrapping. Up enters the top-right controls, starting with Art Mode or the last selected control. Left/Right moves between Art Mode, All apps and Settings. Down or Back returns to the selected app. The clock is at the top left.
- List: Up/Down scrolls the apps without wrapping. Right enters the bottom-right controls, aligned with the clock above. Up/Down moves between Art Mode, All apps and Settings. Left or Back returns to the selected app. The list fades at both ends as it scrolls.
- OK opens the selected item. Focus alone never launches an app.
- Icons-only apps and controls reveal their names when focused. App presentation and control presentation are independent.
- Back from the app list or Dock opens a choice to stay or open Samsung Home.
- A panel keeps focus within its own controls. Back closes one panel at a time.
- Returning to the running launcher keeps the selected app or panel item. There is no auto-return timer. Held OK and Back keys act once until the key is released.

## Settings and appearance

Settings opens a grouped overview: Background, Layout, Typography, Focus, Apps on Home, Samsung, Widgets and Language. Six groups are visible; Up/Down scrolls the overview to the last two, with cues above and below. OK opens a group. Appearance groups use a two-pane screen with visible choices on the left and the committed Home preview on the right.

| Group | Choices |
| --- | --- |
| Background | Photo, Light, Dark; Wallpaper and Rotation when Photo is active |
| Layout | List or Dock; independent Text, Icons or Both choices for apps and Home controls |
| Typography | Manrope, Neue Montreal, Mori, Pangram Sans, Geist and Newsreader, when available; in Arabic, IBM Plex Sans Arabic, Thmanyah Sans and Thmanyah Serif Display, when available |
| Focus | Type or Glass; Soft, Frost or Clear tint material |
| Apps on Home | Membership and arrangement editor |
| Samsung | Samsung Home and TV settings |
| Widgets | Date and prayer times, each Show or Hide; prayer city; headline source (Arabic only) |
| Language | English or العربية |

Up/Down moves between rows. Left/Right moves between choices in a horizontal row. Focus alone changes neither the preview nor saved preferences in these appearance groups. Wallpaper has its own temporary photo preview, described below. OK applies the focused value. A checkmark identifies the applied value; the filled plate identifies remote focus. Applying the current value does not write again.

Material applies to a photographic Dock, or Glass focus on a photographic List. Inactive material choices remain visible with an explanation and are skipped during navigation. Their stored value is retained. Wallpaper and rotation are also inactive on flat backgrounds.

A font or photo change applies only after its resources are ready and storage succeeds. A load or storage failure keeps the previous appearance and checkmark, with a Try again action. Back cancels a pending change, leaves the group and keeps completed changes. Late load callbacks cannot apply a cancelled choice. There is no Save button. Returning to a group restores its last choice focus; returning to Settings restores its category focus. Rotation is nested within Background, and Back returns to its Rotation row.

The selected font applies to Home app names, the clock and Home controls, including Newsreader. Settings, All apps, the Home editor and status text retain Manrope, or IBM Plex Sans Arabic in Arabic. The preview shows the committed Home appearance and its clock continues to update. Pangram faces are available in Nathan's private build when the local files are present; their binaries are not included in the public source. An unavailable optional face is omitted. If the baseline font is slow or missing, Home remains usable with a local fallback and can recover when the font loads.

## Arabic and right to left

Settings → Language applies Arabic like a font change: the interface switches only when IBM Plex Sans Arabic (and any selected local Arabic face) is ready and storage succeeds, and Back cancels a pending switch. All interface text is Arabic; app names keep their own spelling and direction. Numerals stay Western (0-9).

Arabic mirrors Home together with its photograph. The clock and its widgets move to the top right, Home controls to the top left (Dock) or bottom left (List), the Dock fills from the right and List names align right. Because the photo, scrims and registered glass fields mirror with the layout, each text area keeps the photo region and offline ink chosen for it. Text, logos and icons turn back so they read normally; directional arrows point the mirrored way. Wallpapers therefore appear mirrored in Arabic.

Remote Left and Right follow the screen: Left moves to whatever is shown on the left. In the Dock, Left selects the next app; in List, Left reaches the controls; Settings rows, All apps, the editor and messages behave the same way. Up, Down, OK and Back are unchanged. Settings, All apps and the editor mirror their layout, with the Home preview on the left.

## Date, prayer times and headlines

The clock column can show a date line and prayer times, each controlled under Settings → Widgets. The date gives the weekday, Gregorian day and month, then the Umm al-Qura Hijri date, for example `Wednesday 28 October · 17 Jumada al-Ula 1448 AH`. The Hijri date comes from a bundled Umm al-Qura table (1440-1500 AH); outside it, the arithmetic calendar may differ by a day. Religious dates announced by moon sighting can differ from Umm al-Qura.

Prayer times show the next prayer with a countdown (`Asr in 2 h 38 min`) and the day's five times, the next one emphasised; on Fridays Dhuhr is labelled Jumuah. Times are calculated offline in 12-hour form for the chosen city with its official method: Umm al-Qura for the Saudi cities, and the UAE, Qatar and Kuwait methods for those cities, with the standard Asr. They use the city's fixed UTC offset, so the countdown stays correct even if the TV is set to another time zone. The lines refresh with the clock at each minute. A soft photo shade sits under them, mirrored with the photo.

In Arabic, a glass card shows the three newest headlines from the selected source: Sabq (default), Al Arabiya, Al Jazeera, Sky News Arabia or Asharq Al-Awsat, or Off. It sits opposite the clock: top left in the Dock, below the clock in List. Headlines are plain text with no links or images. They refresh every 15 minutes while Home is visible, two minutes after a failure, and never while the launcher is hidden. A failure says so on the card. Headlines are CleanFrame's only network use; English never requests them.

The news never holds up the remote. A background worker fetches and reads the feed and passes back only the titles; the card appears at once with a loading line, so arriving headlines replace text in place. New headlines wait until the remote has rested for 0.7 seconds, so they never land during a move. Sabq, Al Arabiya and Al Jazeera send no CORS headers. A desktop browser refuses them, so the browser preview's card says that the source is for the TV; a TV's packaged-app runtime is expected to read them, which still needs confirming on each TV.

## Streaming apps

Home starts with HDMI 3, YouTube, Plex and Apple TV. The known services, Plex included, keep their native IDs and bundled marks. Other installed consumer apps can also be added to Home. Launching uses the public `tizen.application.launch` API with the app's native ID. Missing apps and denied launches produce a real error. No web player, placeholder success page or account credential is embedded.

## HDMI input

The first Home tile is not an app: OK puts the TV on that HDMI input and shows it, in one press. It uses the public `tizen.tvwindow.setSource` API with the TV's own source record from `tizen.systeminfo` `VIDEOSOURCE`, then opens the TV's viewer (`org.tizen.tv-viewer`), which shows the current source. If the viewer cannot open, CleanFrame hides to uncover the TV's picture. The tile names the input it opens: HDMI 3 when the TV lists HDMI 3 as connected or lists nothing as connected, otherwise the connected input. A device on standby can be listed as disconnected and can still be selected. It is checked when Home starts and each time it returns. An input the TV does not list, or a browser preview, produces a real error. The tile can be moved or removed like an app; once removed, it leads Not on Home in the editor. The switch has not yet been observed on a CleanFrame TV; see [development](development.md).

## All apps

The panel reads `tizen.application.getAppsInfo` on entry and shows the filtered consumer apps alphabetically. Samsung's visibility flag alone also exposes system utilities, so EP packages, background services, ad players, account utilities, placeholders and duplicates are omitted. Known brands use bundled marks. Other apps use their local installed icon, with initials as a fallback.

The five-column grid scrolls with remote focus. OK launches an app; its On Home badge shows membership. Up from the first row reaches Apps on Home, which opens the editor. An API failure shows a retry and keeps saved Home choices. Browser previews report that installed-app discovery and launching require the TV.

## Apps on Home

Open the editor from Settings or All apps. On Home shows the current order on the left. Not on Home shows Recently removed first, followed by other installed apps on the right. Home holds one to nine apps.

- Reorder: OK on an app name picks it up. Up/Down moves it. OK places it and saves the order. Back puts an unplaced app back without saving that move.
- Remove: Right from an app name reaches Remove from Home. OK saves the removal and moves focus to the same app in Recently removed. The app stays installed.
- Add: OK on an app in Not on Home adds it and saves. A recently removed app returns to its previous position within the editing session; another app is added at the end. Focus follows the app to its Remove from Home control, so another OK can reverse the addition.
- Undo reverses a completed addition, removal or reorder from the current editing session. Done or Back closes the editor and keeps completed changes. Undo history ends when the editor closes.

Removing the last Home app or adding a tenth app is prevented. A failed storage write keeps the committed choices and order, with a retry message. Saved native app IDs and names survive a restart or a failed catalogue refresh.

## Art Mode and Samsung screens

Art Mode sends an application control to the installed `org.tizen.art-app`, with `mode=fullscreen` and `requester=mobile`. This aims to enter native Art Mode with its current artwork, without toggling power or changing the selected artwork.

This mode comes from [research on Samsung's Art app](https://github.com/TheFab21/ha-samsungtv-smart/blob/master/notes/QN55LS03FAFXZA/ART_MODE_DECOMPILED.md), on another Tizen 9 Frame model. It is an internal Samsung contract, not a documented public Art API. Its visible behaviour on this exact firmware must be confirmed on the TV.

Samsung Home explicitly launches the original `com.samsung.tv.csfs` app, independently of the new Home assignment. The earlier `com.samsung.tv.coba.newhome` component did not open Smart Hub visibly and is no longer the escape target. TV settings still uses `com.samsung.tv.coba.setting`. Exact on-device destinations are recorded in docs/tv-status.md; launch callbacks alone are not visual proof. There is no blind power-key fallback.

All calls have bounded response handling. A failure leaves CleanFrame usable. No simulated device success views remain. Browser validation cannot confirm the visible Samsung destination.

Installed-app discovery allows up to 20 seconds for large TV catalogues; launch controls retain an 8-second limit. Opening All apps or the editor refreshes the catalogue while retaining saved Home choices. No discovery polling runs during hidden startup.

## Preferences and wallpaper

The launcher stores appearance (including language and Arabic font), Home order, recently removed apps, the last launched Home app, wallpaper, rotation and widget choices locally. Earlier preferences gain English with the date and Riyadh prayer times shown. List and Dock share these preferences. The existing `cleanframe.home.v1` key is retained, with a fallback read from `cleanframe.shore.v1`. Legacy List maps to Dark + List + Type; Glass Dock and Glass Grid map to Photo + Dock + Glass. App order, wallpaper, rotation and the last Home app are preserved.

The gallery contains 15 bundled wallpapers. Settings → Background → Wallpaper keeps the two-pane Settings frame. Up/Down browses a vertical thumbnail list without wrapping; the right-hand Home preview shows the candidate while the surrounding Settings backdrop stays on the applied photo. OK applies the focused photo and stays in Wallpaper. The tick marks the applied photo and preview status distinguishes unsaved browsing. Back restores the latest applied photo, cancels pending loading and returns to Background’s Wallpaper row. Photo and material assets change as one complete bundle; a failed load restores the applied preview and offers retry. Preview loading waits briefly for remote focus to settle. OK during loading queues application for that photo; another browse move or Back cancels it. Browsing never saves, and repeated OK on the applied photo does not write again.

Settings → Background → Rotation offers Fixed, Each time Home opens, Every 5 minutes, Every 15 minutes and Every hour. Each time Home opens advances once when the launcher loads; a return to the already-running launcher does not advance it. Timed rotation counts only visible Photo Home time in either List or Dock. Panels, flat backgrounds and time spent in other apps pause the cycle. Changing the photo or rotation mode starts a new interval.

Launcher wallpaper is separate from native Art Mode. Runtime photos, materials and available fonts are local assets; they do not require the Mac or a network download.

## Sources

- [Samsung Application API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/application-api.html): installed-app discovery and application control.
- [Samsung application termination guide](https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html): exiting is not treated as a deterministic Samsung Home route.

The native Home operation and startup configuration from 19 October remain separate from this app update. Home from Netflix was confirmed for that configuration; power-on after Netflix remains provisional. Streaming apps retain their own Back navigation. Netflix did not exit on repeated Back in the observed test, so there was no app-exit destination to verify. No global Back interception or key-filter hook was installed. See [TV status](tv-status.md) for device evidence; this behaviour specification is not an installation or visual-verification record for 0.6.0.

## Clock and rendering

Both layouts show the TV's local time in 12-hour format, without AM/PM or seconds. It updates at the minute boundary and on return to the launcher. The optional date and prayer lines sit beneath it; there is no clock panel.

Photographic materials and blurred panel backgrounds are generated before packaging and stay aligned with the full-screen image. Photo colour and contrast metadata are also prepared offline. Navigation does not sample image pixels, run an optics engine or apply live backdrop blur. Flat backgrounds use matching light or dark panel colours. Focus feedback uses transforms and opacity; reduced motion removes animated scaling and movement while retaining opacity feedback.

Hidden prelaunch can install a fully loaded wallpaper bundle without waiting for an animation frame. A valid loaded image remains usable if detached-image decoding rejects. A failed startup bundle retries when the launcher becomes visible; an active wallpaper preview keeps its candidate. Font recovery clears fallback measurements and cached markup. This readiness fallback uses a completed load and nonzero image dimensions; it does not prove a TV has painted the image, and an accepted bundle is not automatically decoded again on return. These paths have browser regression coverage; physical cold-boot behaviour still needs owner observation.
