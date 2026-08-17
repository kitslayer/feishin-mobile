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
- [x] Compact horizontal detail header on phones (was ~400px of a 956px screen,
      leaving about four rows visible)
- [x] Mobile layout is unconditional on device — a 768px query meant landscape
      (956px) threw the desktop layout back
- [x] Safe areas: page headers, queue/lyrics tabs, drawer, modals, toasts, player bar
- [x] Tooltips work on touch at all (Mantine defaults `events.touch: false`)
- [x] 44pt minimum touch targets; 16px inputs so iOS stops zooming on focus

## Next

- [ ] **Back navigation** — detail pages have no back affordance and no swipe-back
- [ ] **Album detail is off-centre**
- [ ] **More drawer is unpolished** — rebuild as a proper iOS settings-style list
- [ ] **Header collapse on scroll** — compact now, but should shrink as you scroll
- [ ] Home screen is still desktop shelves
- [ ] List toolbar (Name + five icons) is cramped
- [ ] Now-playing bar looks empty when nothing is playing

## Verify on device (cannot be checked from Linux)

- [ ] Lock screen with music playing — does WebKit suspend the AudioContext when
      backgrounded? If audio dies, the fix costs the EQ and ReplayGain
- [ ] Offline downloads end to end: download an album, Airplane Mode, play

## How this is tested

`ND_PASS=… node scripts/touch-test.mjs` drives the deployed build in Chromium at
440x956 with touch emulation. Playback assertions use the stream request, not the
queue — headless has no audio device, so the player never reaches PLAYING.
