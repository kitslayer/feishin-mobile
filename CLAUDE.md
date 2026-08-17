# Feishin Mobile — Claude Handoff

## Mission

This fork is being actively reshaped as a **native iPhone app**, served through a Capacitor/WKWebView shell. Treat iPhone touch use as the primary product; desktop/browser compatibility is not the delivery target. Chromium may be used only as a renderer/test harness.

Target viewport: **440 × 956 CSS px** (iPhone-class touch viewport).

Miles likes the direction of the current redesign. Improve it incrementally and preserve its visual language; do not replace it with a broad redesign.

## Non-negotiable user requirements

- **No unintended zoom.** Pinch, double-tap, and input-focus zoom were specifically reported as harmful because Miles cannot reliably zoom back out. Preserve the committed native no-zoom policy while retaining normal one-finger vertical scrolling.
- **Do not deploy, build/download an IPA, or install to the phone without a fresh explicit request from Miles.** Source fixes, validation, commits, and pushes are allowed. The current overnight sweeps are source-only.
- Mobile controls need genuinely touchable targets (44 pt minimum for primary controls).
- Respect safe areas/Dynamic Island/home indicator. Avoid viewport-height assumptions that create nested or oversized scrollers.
- Do not reintroduce desktop-only chrome as the mobile UI. The bottom tab bar + More drawer are intentional.
- Fix concrete, reproducible defects. Do not apply speculative redesigns just because an area looks improvable.

## Working environment

- Repository: `~/feishin-mobile` on Legion at `miles@192.168.1.3`.
- SSH must retain host verification: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes miles@192.168.1.3 ...`
- `pnpm` is available only through Fish on Legion:
  ```sh
  fish -lc 'cd ~/feishin-mobile; pnpm <command>'
  ```
- Do not start two package/build sessions that contend for the same lock.
- Current branch: `development`, tracking `origin/development`.

## What has been implemented

### Mobile app foundation

- Native iOS viewport/no-zoom policy and input-focus zoom prevention.
- A safe-area-aware bottom tab bar, mobile More drawer, mobile back affordance, and idle-player layout that reclaims empty player space.
- Mobile Settings scrolling via a bounded native vertical scroller.
- 44 pt primary touch targets, player/toast safe-area spacing, and setup/recovery shell layouts that do not reserve invisible player/tab bars.
- Collections are reachable through More.

### More → Library source

Miles reported that the old menu containing **Select server** and **Select music folder** had disappeared. It was accidentally lost when the desktop action-bar/sidebar entry point was replaced by the mobile More drawer.

It has been restored at the top of **More** as **Library source**:

- Current server and active music-folder state are visible there.
- It opens the existing selector with server switching, Manage servers, scan/logout actions, and music-folder selection.
- The selector is intentionally reused rather than reimplemented. `ServerSelector` now accepts `position` and `withinPortal` props so it can open correctly from the drawer.

Relevant files:
- `src/renderer/features/sidebar/components/mobile-sidebar.tsx`
- `src/renderer/features/sidebar/components/mobile-sidebar.module.css`
- `src/renderer/features/sidebar/components/server-selector.tsx`

### Playlist and detail-page repairs

Miles reported:

- playlist-detail actions (Play / Next / Last / related actions) covered artwork or sat in the wrong place;
- vertical swipes begun on artwork/title did not scroll—the gesture had to begin on tracks;
- the detail header collapsed as a hard jump rather than a smooth slide;
- playlist/album art loaded too slowly.

Current repair direction:

- The mobile `LibraryHeaderMenu` action row is constrained at its actual DOM level and can scroll horizontally instead of covering art.
- A vertical header drag forwards into the active OverlayScrollbars scrollport, so scrolling can start from non-control header/artwork surfaces.
- Compact-header dimensions/details transition during collapse rather than abruptly disappearing.
- Shared `BaseImage` default priority is `auto` rather than forced `low`; lazy viewport loading remains enabled, so visible covers are not unnecessarily deprioritized while the entire library is not eagerly fetched.

Relevant files:
- `src/renderer/features/shared/components/library-header.tsx`
- `src/renderer/features/shared/components/library-header.module.css`
- `src/shared/components/image/image.tsx`

### More button visual state

Miles reported that the More button stayed highlighted after its drawer closed. This is WKWebView focus retention on a plain button. The mobile tab button has explicit transparent native-button styling and only presents an outline for `:focus-visible`, not normal touch focus.

Relevant files:
- `src/renderer/layouts/mobile-layout/mobile-tab-bar.tsx`
- `src/renderer/layouts/mobile-layout/mobile-tab-bar.module.css`

### Other verified repairs

- Failed downloads Retry now requeues the actual failed source; Remove all cancels queued/active work safely.
- Native offline scrobbles persist immediately.
- Mini-player metadata no longer navigates behind the fullscreen player.
- No Network now uses `ResponsiveLayout shell`, matching login/action-required rather than mounting normal tab/player layout.
- Native document-level horizontal overflow is hidden on narrow screens, preventing a blank WKWebView edge from an overwide portal/detail surface.
- The visualizer overlay uses a full mobile `100dvh` envelope and has a safe, 44px close action rather than desktop Escape-only exit.

## Recent verified commits

- `3922bf6a` — Lock iOS zoom and restore Settings scrolling
- `169c369b` — Refine native mobile flows and playlist presentation
- `3d27717b` — Repair mobile playlist detail and library source access
- `c85d1160` — Fix mobile no-network shell
- `76619df8` — Fix native mobile horizontal overflow
- `b1ce2503` — Fix iPhone visualizer overlay
- `a4375f88` — Harden touch suite against the late-mounting changelog modal

Use `git log --oneline` and `git show <commit>` before assuming this list is still the tip.

## Validation procedure

Run on Legion through Fish. Before committing:

```sh
pnpm typecheck
pnpm exec eslint --no-cache --max-warnings=0 <changed .ts/.tsx files>
pnpm exec stylelint --max-warnings=0 <changed .css files>
pnpm build:web
git diff --check
```

Then inspect the exact diff. `pnpm run lint-code` has a known pre-existing failure mode: `eslint --max-warnings=0 --cache .` may hang with no diagnostics (observed timeouts at 180–240 seconds). Do not report global lint as clean merely because focused checks passed; state that limitation separately.

The production web bundle can emit existing non-fatal warnings about non-module `settings.js`, `taglib-wasm` browser externalization, mixed dynamic/static MPV filter imports, and large chunks. Record them, but do not misclassify them as failures unless the build exits non-zero.

## Current overnight sweep context

The maintenance worklist is local to Hermes:

`/home/miles/.hermes/feishin-mobile-worklist.md`

Three source-only full sweeps were requested for the overnight period. Every sweep covers the full reachable native mobile surface—not a single assigned category—and may commit/push only verified changes. It must never trigger CI or interact with phone hardware.

At the time this handoff was written, the working tree contained uncommitted inspection artifacts:

- `src/renderer/components/native-scroll-area/native-scroll-area.module.css`
- `v-home.png`
- `v-more.png`
- `verify.mjs`

Do **not** delete, reset, or commit them blindly. Inspect and preserve them unless their owner explicitly decides otherwise.

## How to report to Miles

Be direct and concrete:

- Name the route/interaction that was broken and the actual root cause.
- State exact validation commands/results and any known limitations.
- Distinguish **pushed source** from **iPhone installed**—they are never equivalent.
- Teach briefly: explain why the layout/scroll/gesture broke and which implementation knob repaired it.
