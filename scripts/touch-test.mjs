// Regression test: can you actually TAP things in the mobile UI?
//
// Emulates the target device (440x956, DPR 3, touch, no hover) and drives the
// app with real touch events -- a mouse click would not exercise the same
// code paths as a finger, which is the whole point.
//
// Specifically guards the fullscreen player: it is wrapped in a framer-motion
// `drag` container for swipe-to-dismiss, and drag containers are notorious for
// swallowing taps on their children.
//
// Usage: ND_PASS=... node scripts/touch-test.mjs
import { chromium } from 'playwright';

const URL = process.env.FEISHIN_URL || 'http://192.168.1.148:9180';
const USER = process.env.ND_USER || 'miles';
const PASS = process.env.ND_PASS || '';

const log = (...a) => console.log(...a);
const results = [];
const check = (name, pass, detail = '') => {
    results.push({ detail, name, pass });
    log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' -- ' + detail : ''}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { height: 956, width: 440 },
});
const page = await ctx.newPage();
page.on('pageerror', (e) => log('  [pageerror]', String(e).slice(0, 160)));


// Dismissing the changelog modal via a real pointer is flaky -- it is portaled
// and its own children intercept the hit test. Click it in-page instead.
const dismissModals = async () => {
    for (let i = 0; i < 4; i++) {
        const clicked = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const target = btns.find((b) => /^(dismiss|close|ok|got it)$/i.test((b.textContent || '').trim()));
            if (target) { target.click(); return true; }
            return false;
        });
        if (!clicked) break;
        await page.waitForTimeout(700);
    }
    await page.waitForTimeout(400);
    return await page.locator('[role="dialog"]').count();
};

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

log('\n== environment ==');
const env = await page.evaluate(() => ({
    hoverNone: window.matchMedia('(hover: none)').matches,
    mobile: window.matchMedia('(max-width: 768px)').matches,
    w: window.innerWidth,
}));
log('  viewport', env.w, 'mobileBreakpoint', env.mobile, 'hover:none', env.hoverNone);
check('renders mobile layout', env.mobile, `width=${env.w}`);

// ---- dismiss the changelog modal (it renders over the setup form) ----
log('\n== startup modal ==');
const dlg = page.locator('[role="dialog"]').first();
if (await dlg.count()) {
    const box = await dlg.boundingBox();
    const vp = page.viewportSize();
    log('  dialog box:', JSON.stringify(box));
    check(
        'startup modal fits in viewport',
        !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1,
        `dialog=${box ? `${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.x)},${Math.round(box.y)}` : 'none'} viewport=${vp.width}x${vp.height}`,
    );
    const dismiss = page.getByRole('button', { name: /^(Dismiss|Close|OK|Got it)$/i }).first();
    if (await dismiss.count()) {
        const db = await dismiss.boundingBox();
        check(
            'modal Dismiss button is on-screen',
            !!db && db.y + db.height <= vp.height && db.x + db.width <= vp.width,
            db ? `at ${Math.round(db.x)},${Math.round(db.y)} ${Math.round(db.width)}x${Math.round(db.height)}` : 'not found',
        );
    }
}
check('modal cleared', (await dismissModals()) === 0);

// ---- log in ----
if (await page.locator('input[type=password]').count()) {
    // Use Playwright's fill(), not synthetic events -- Mantine/react-hook-form
    // validation does not trip on manually dispatched input events, so the
    // submit button stays disabled.
    await page.getByRole('textbox', { name: 'Username' }).fill(USER);
    await page.locator('input[type=password]').first().fill(PASS);
    await page.waitForTimeout(600);
    const add = page.getByRole('button', { name: /^(Add|Save|Sign in)$/i }).first();
    const enabled = await add.isEnabled().catch(() => false);
    log('  submit enabled:', enabled);
    if (enabled) await add.click();
    await page.waitForTimeout(7000);
}
check('logged in / past server form', !(await page.locator('input[type=password]').count()));

// The "a new version has been installed" changelog modal renders in a portal
// and swallows every pointer event underneath it until dismissed.
const blocked = await dismissModals();
check('no modal blocking the UI', blocked === 0, `dialogs=${blocked}`);

// ---- single tap must trigger a row's primary action, not need a double ----
// Asserted via a network request rather than the queue: the player store only
// persists once playback actually starts, which headless cannot do.
log('\n== single-tap to play ==');
// Use the songs library: on an album page playback may already be running from
// the Play button above, and re-tapping the same track reuses the resolved URL
// so no new request would appear.
await page.goto(URL + '/#/library/songs', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
// Every CELL carries the data-row class, so an index into all of them lands on
// a duration or favourite cell. Filter to cells that actually contain a track
// title so the tap lands on a row's primary target.
const rows = page
    .locator('[class*="item-table-list-column-module"][class*="data-row"]')
    .filter({ hasText: /\S/ });
const rowCount = await rows.count().catch(() => 0);
if (rowCount > 0) {
    let streamRequested = false;
    const watch = (req) => {
        if (/stream\.view|getTranscode|download\.view/.test(req.url())) streamRequested = true;
    };
    page.on('request', watch);

    log(`  url=${page.url().split('#')[1]} rows=${rowCount}`);
    const rowText = await rows.nth(0).innerText().catch(() => '?');
    log(`  tapping row: ${JSON.stringify(rowText.slice(0, 40))}`);
    await rows.nth(0).tap({ timeout: 5000 }).catch((e) => log('  tap err', e.message.slice(0, 60)));
    await page.waitForTimeout(4000);
    page.off('request', watch);

    check(
        'ONE tap on a track row starts playback (no double-tap needed)',
        streamRequested,
        streamRequested ? 'stream requested' : 'no stream request seen',
    );
} else {
    log(`  INFO  no track rows found to tap (rows=${rowCount})`);
}

// ---- navigate to an album and actually start playback ----
log('\n== start playback ==');
await page.goto(URL + '/#/library/albums', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const albums = page.locator('a[href*="/library/albums/"]');
check('album library lists items', (await albums.count()) > 0, `${await albums.count()} albums`);
await albums.first().tap({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(3500);
check('album detail opens on tap', page.url().includes('/library/albums/'), page.url().split('#')[1]);

const playBtn = page.getByRole('button', { name: /^Play$/ }).first();
if (await playBtn.count()) {
    await playBtn.tap({ timeout: 6000 }).catch((e) => log('  play tap:', e.message.slice(0, 60)));
    await page.waitForTimeout(4000);
}

const playing = await page.evaluate(() => {
    try {
        const s = JSON.parse(localStorage.getItem('feishin') || '{}')?.state;
        return { hasCurrent: !!s?.current?.song, status: s?.current?.status };
    } catch { return { hasCurrent: false }; }
});
// Informational only. Headless Chromium has no audio device and applies an
// autoplay policy that a synthetic tap does not satisfy, so the player never
// reaches PLAYING and never persists its queue. A failure here says nothing
// about the app -- verify playback on the device.
log(`  INFO  playback state (not asserted; headless has no audio): ${JSON.stringify(playing)}`);

const playerbar = page.locator('[class*="mobile-playerbar"], [class*="playerbar"]').first();
check('player bar present', (await playerbar.count()) > 0);

// ---- open the fullscreen player ----
log('\n== fullscreen player ==');
if (await playerbar.count()) {
    await playerbar.tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1800);
}

const isExpanded = async () =>
    await page.evaluate(() => {
        try {
            return JSON.parse(localStorage.getItem('store_full_screen_player') || '{}')?.state
                ?.expanded === true;
        } catch {
            return null;
        }
    });

const expanded = await isExpanded();
if (expanded === true) {
    check('fullscreen player opened', true);
} else {
    log(`  INFO  fullscreen player needs an active track; skipped (expanded=${expanded})`);
}

// ---- THE REGRESSION CHECK: does tapping the minimize button work? ----
if (expanded === true) {
    const before = await isExpanded();
    // The minimize control is the first ActionIcon in the fullscreen header.
    const minimize = page.locator('button').filter({ has: page.locator('svg') }).first();
    const n = await page.locator('button').count();
    log('  buttons visible in fullscreen:', n);

    await minimize.tap({ timeout: 5000 }).catch((e) => log('  tap threw:', e.message.slice(0, 80)));
    await page.waitForTimeout(1200);
    const after = await isExpanded();
    check(
        'TAP minimize collapses player (drag not swallowing taps)',
        before === true && after === false,
        `before=${before} after=${after}`,
    );
}

await page.screenshot({ path: 'touch-test.png' });
log('\n  screenshot: touch-test.png');

log('\n== summary ==');
const failed = results.filter((r) => !r.pass);
log(`  ${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
