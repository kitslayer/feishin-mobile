// Headed WebKit preview at the exact geometry of Miles's iPhone.
//
// WebKit (not Chromium) because the app ships as a WKWebView -- Chromium
// renders scrolling, overscroll and touch handling differently enough that
// mobile bugs don't reproduce faithfully. This is the closest engine to
// Mobile Safari available on Linux.
//
// Geometry taken from the device's own FBSDisplayLayout in idevicesyslog:
// bounds = {{0, 0}, {440, 956}}.
//
// Usage:
//   node scripts/mobile-preview.mjs [--shot out.png] [--url http://...]
//
// The browser profile persists in .preview-profile/ so the Navidrome login
// survives across runs.
import { webkit, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const URL = arg('--url', process.env.FEISHIN_URL || 'http://192.168.1.148:9180');
const USER = process.env.ND_USER || 'miles';
const PASS = process.env.ND_PASS || '';
const SHOT = arg('--shot', null);
const KEEP = process.argv.includes('--keep');

const ctx = await webkit.launchPersistentContext(path.join(repo, '.preview-profile'), {
    headless: false,
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
    args: ['--window-size=460,1000'],
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Log in if the server form is showing. Feishin uses controlled React inputs,
// so set values through the native setter and fire input/change, otherwise
// React never sees them and the submit button stays disabled.
const needsLogin = await page.locator('input[type=password]').count();
if (needsLogin && PASS) {
    await page.evaluate(
        ({ user, pass }) => {
            const set = (el, v) => {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value',
                ).set;
                setter.call(el, v);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const inputs = [...document.querySelectorAll('input')];
            const pw = inputs.find((i) => i.type === 'password');
            // the username field is the text input immediately before it
            const uname = inputs.filter((i) => i.type === 'text').at(-1);
            if (uname) set(uname, user);
            if (pw) set(pw, pass);
        },
        { user: USER, pass: PASS },
    );
    await page.waitForTimeout(400);
    const submit = page.getByRole('button', { name: /^(Add|Save|Sign in|Submit)$/i });
    if (await submit.count()) await submit.first().click();
    await page.waitForTimeout(4000);
}

console.log('url      :', page.url());
console.log('viewport :', JSON.stringify(page.viewportSize()));
console.log(
    'mobile   :',
    await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches),
);

if (SHOT) {
    await page.screenshot({ path: path.resolve(repo, SHOT) });
    console.log('shot     :', SHOT);
}

if (!KEEP) {
    await ctx.close();
}
