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
        await dismiss.click({ force: true, timeout: 5000 }).catch((e) => log('  dismiss failed:', e.message.slice(0, 60)));
        await page.waitForTimeout(1000);
    }
}
check('modal cleared', (await page.locator('[role="dialog"]').count()) === 0);

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
for (let i = 0; i < 3; i++) {
    const dismiss = page.getByRole('button', { name: /^(Dismiss|Close|OK|Got it)$/i }).first();
    if (await dismiss.count().catch(() => 0)) {
        await dismiss.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
    } else break;
}
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(600);
const blocked = await page.locator('[data-portal="true"] [role="dialog"], [role="dialog"]').count();
check('no modal blocking the UI', blocked === 0, `dialogs=${blocked}`);

// ---- find something playable and start it ----
log('\n== start playback ==');
await page.waitForTimeout(2000);
const rows = page.locator('[role="row"], [class*="item-card"], [class*="album"]');
log('  candidate items:', await rows.count());

// Tap the first playable-looking thing, then look for the player bar.
if (await rows.count()) {
    await rows.first().tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
}

const playerbar = page.locator('[class*="mobile-playerbar"], [class*="playerbar"]').first();
const hasBar = await playerbar.count();
check('player bar present', !!hasBar);

// ---- open the fullscreen player ----
log('\n== fullscreen player ==');
if (hasBar) {
    await playerbar.tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
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
check('fullscreen player opened', expanded === true, `expanded=${expanded}`);

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
