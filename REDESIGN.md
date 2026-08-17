# Mobile redesign — task board

Target: iOS only. Anything desktop-shaped is a bug.

## Done

- [x] Bottom tab bar (Home / Albums / Search / Playlists / More), 49pt, owns the
      home-indicator inset
- [x] Playlists on the tab bar instead of Downloads — downloaded files are already
      preferred automatically, so that page is for managing storage, not reaching music
- [x] Track rows: artwork + title over artist + duration + heart; no table header,
      no borders, no grid lines
- [x] Continuous scroll instead of numbered pagination (it went to page 258)
- [x] Single tap plays — double-tap-to-play was a mouse idiom
- [x] Single tap opens album cards and playlists (an `onMouseEnter` class change
      swapped content under the finger, so WebKit suppressed the first tap's click)
- [x] Drawer closes on navigation — it stayed open over the result, so taps read as
      doing nothing
- [x] Whole now-playing bar opens the full player, not just the artwork
- [x] Compact horizontal detail header, and it collapses on scroll (295px -> 52px),
      so a detail page shows 12 rows instead of 3
- [x] Back control + left-edge swipe-back on every detail page
- [x] Album detail: tracks above the metadata block
- [x] Mobile layout is unconditional on device — a 768px query meant landscape
      (956px) threw the desktop layout back
- [x] Safe areas: page headers, queue/lyrics tabs, drawer, modals, toasts, player bar
- [x] Tooltips work on touch at all (Mantine defaults `events.touch: false`)
- [x] 44pt minimum touch targets; 16px inputs so iOS stops zooming on focus

## Next — ranked, with what was actually found

### 1. More drawer (worst offender)

Screenshotted at 440x956. It is the desktop sidebar unchanged:

- **Settings is unreachable on mobile.** It is `disabled: true` in `sidebarItems`
  (`store/settings.store.ts`), so it never renders — there is no way into settings
  from the phone at all.
- **Desktop browser chrome at the top**: a hamburger and back/forward arrows sit
  next to the search field. Pointless here — there is a tab bar and a back control.
- Duplicates the tab bar (Home, Albums) instead of showing what the tabs do not.
- `downloads` renders lowercase next to `Radio Stations` / `Collections`.
- Rows are desktop-height; should be a 44pt iOS grouped list.

### 2. Home screen

- A **~500px carousel card frozen on slide 0**. Its nav arrows are
  `pointer-events: none; opacity: 0` outside hover, the auto-advance interval is
  commented out in `single-feature-carousel.tsx`, and there is no swipe handler —
  so half the first screen is dead space showing one album with no label.
- Below it, **Genres** dominates: ~120px per row with a large play button, and
  genres are the least useful thing to open an app on.
- No Recently Played / Recently Added / Most Played shelves — which is what a
  music app's home screen is for.

### 3. Search + Playlists pages

- The search input **overflows the viewport** (`INPUT.fs-text-input-module-input`
  reported past `window.innerWidth` on both pages).

### 4. Now playing bar

- Shows `—` placeholders when nothing is playing, so the app looks broken on first
  launch. Should collapse or show a prompt.

### 5. Smaller

- List toolbar (`Name` + five icons) is cramped.
- Back control overlaps the first track row once the header collapses.
- Album detail metadata (genres/tags/label) is still centre-aligned while the rest
  of the page is left-aligned.

## Verify on device (cannot be checked from Linux)

- [ ] Lock screen with music playing — does WebKit suspend the AudioContext when
      backgrounded? If audio dies, the fix costs the EQ and ReplayGain
- [ ] Offline downloads end to end: download an album, Airplane Mode, play

## How this is tested

`ND_PASS=… node scripts/touch-test.mjs` drives the deployed build in Chromium at
440x956 with touch emulation. Playback assertions use the stream request, not the
queue — headless has no audio device, so the player never reaches PLAYING.
