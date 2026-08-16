/* Verify the phone-app gate on tommylabs.store:
   - Desktop computer  -> plain website, NO tab bar, NO install pill, NO service worker
   - Phone             -> store app: tab bar visible, SW registered, install pill on prompt
   Usage: node verify-pwa-gate.mjs <url>  (default: http://127.0.0.1:8099)
*/
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8099';

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const browser = await chromium.launch();

// ---------------- DESKTOP ----------------
console.log('\n== DESKTOP (Windows Chrome 1280x800) ==');
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
const dp = await desk.newPage();
await dp.goto(URL, { waitUntil: 'networkidle' });
await dp.waitForTimeout(1500);

const deskState = await dp.evaluate(async () => {
  const html = document.documentElement;
  const tab = document.getElementById('tabBar');
  const pill = document.getElementById('installPill');
  const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
  return {
    appMode: html.classList.contains('app-mode'),
    tabDisplay: tab ? getComputedStyle(tab).display : 'NO TABBAR',
    pillDisplay: pill ? getComputedStyle(pill).display : 'NO PILL',
    swCount: registrations.length,
    bodyPad: getComputedStyle(document.body).paddingBottom,
  };
});
check('app-mode NOT set on desktop', !deskState.appMode);
check('tab bar hidden on desktop', deskState.tabDisplay === 'none', `display=${deskState.tabDisplay}`);
check('install pill hidden on desktop', deskState.pillDisplay === 'none', `display=${deskState.pillDisplay}`);
check('no service worker on desktop', deskState.swCount === 0, `registrations=${deskState.swCount}`);
check('no app bottom padding on desktop', deskState.bodyPad === '0px', `padding=${deskState.bodyPad}`);

// Desktop must also NOT react to an install prompt (no site listener,
// and no SW means Chrome never even fires the real one)
await dp.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
await dp.waitForTimeout(300);
const pillAfterPrompt = await dp.evaluate(() => getComputedStyle(document.getElementById('installPill')).display);
check('desktop install pill stays hidden even if prompt fires', pillAfterPrompt === 'none', `display=${pillAfterPrompt}`);
await desk.close();

// ---------------- PHONE ----------------
console.log('\n== PHONE (iPhone Safari 390x844, touch) ==');
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const mp = await mob.newPage();
await mp.goto(URL, { waitUntil: 'networkidle' });
await mp.waitForTimeout(2500);

const mobState = await mp.evaluate(async () => {
  const html = document.documentElement;
  const tab = document.getElementById('tabBar');
  const pill = document.getElementById('installPill');
  const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
  return {
    appMode: html.classList.contains('app-mode'),
    tabDisplay: tab ? getComputedStyle(tab).display : 'NO TABBAR',
    pillDisplay: pill ? getComputedStyle(pill).display : 'NO PILL',
    swCount: registrations.length,
    bodyPad: getComputedStyle(document.body).paddingBottom,
  };
});
check('app-mode set on phone', mobState.appMode);
check('tab bar visible on phone', mobState.tabDisplay === 'flex', `display=${mobState.tabDisplay}`);
check('install pill hidden until prompt on phone', mobState.pillDisplay === 'none', `display=${mobState.pillDisplay}`);
check('service worker registered on phone', mobState.swCount === 1, `registrations=${mobState.swCount}`);
check('app bottom padding on phone', mobState.bodyPad === '86px', `padding=${mobState.bodyPad}`);

// Phone: synthetic install prompt must reveal the pill
await mp.evaluate(() => {
  const pill = document.getElementById('installPill');
  window.dispatchEvent(new Event('beforeinstallprompt'));
  return new Promise(r => setTimeout(r, 300));
});
const pillShown = await mp.evaluate(() => getComputedStyle(document.getElementById('installPill')).display);
check('install pill appears when prompt fires on phone', pillShown === 'flex', `display=${pillShown}`);
await mob.close();

// ---------------- NARROW DESKTOP WINDOW ----------------
console.log('\n== NARROW DESKTOP WINDOW (computer browser squished to 480px) ==');
const nar = await browser.newContext({ viewport: { width: 480, height: 800 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
const np = await nar.newPage();
await np.goto(URL, { waitUntil: 'networkidle' });
await np.waitForTimeout(1200);
const narState = await np.evaluate(async () => ({
  appMode: document.documentElement.classList.contains('app-mode'),
  tabDisplay: getComputedStyle(document.getElementById('tabBar')).display,
  swCount: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
}));
check('narrow desktop window still NOT app mode', !narState.appMode);
check('tab bar still hidden in narrow desktop window', narState.tabDisplay === 'none', `display=${narState.tabDisplay}`);
check('no SW in narrow desktop window', narState.swCount === 0, `registrations=${narState.swCount}`);
await nar.close();

await browser.close();
const failed = checks.filter(c => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
