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

// ---------------- MANIFEST + ICONS ----------------
console.log('== MANIFEST & ICONS ==');
const mres = await fetch(URL + '/manifest.webmanifest');
const manifest = await mres.json();
check('manifest name is Tommy Labs', manifest.name === 'Tommy Labs', manifest.name);
const iconSrcs = (manifest.icons || []).map(i => i.src);
check('manifest has 192/512/maskable icons', iconSrcs.includes('/icon-192.png') && iconSrcs.includes('/icon-512.png') && iconSrcs.includes('/icon-maskable-512.png'));
for (const p of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']) {
  const r = await fetch(URL + p);
  const ct = r.headers.get('content-type') || '';
  check(p + ' served as PNG', r.ok && ct.includes('image/png'), `${r.status} ${ct}`);
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

// Desktop: hover ANYWHERE on a product picture -> overlay shows, click opens 3D
await dp.evaluate(() => document.getElementById('shop').scrollIntoView());
await dp.waitForTimeout(700);
const dbox = await dp.evaluate(() => {
  const b = document.querySelector('.product-img-box.img3d');
  const r = b.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await dp.mouse.move(dbox.x + dbox.w / 2, dbox.y + dbox.h / 2);
await dp.waitForTimeout(500);
const ov = await dp.evaluate(() => {
  const b = document.querySelector('.product-img-box.img3d');
  return getComputedStyle(b, '::after').opacity;
});
check('hovering the picture shows the 3D overlay', ov === '1', `opacity=${ov}`);
await dp.mouse.click(dbox.x + dbox.w / 2, dbox.y + dbox.h / 2);
await dp.waitForTimeout(1200);
const dopen = await dp.evaluate(() => document.getElementById('viewerModal').classList.contains('open'));
check('clicking the picture opens the 3D viewer on desktop', dopen);
const coverState = await dp.evaluate(() => {
  const box = document.querySelector('.product-img-box.img3d');
  const img = box.querySelector('img');
  return {
    hasImg: !!img,
    imgLoaded: !!img && img.complete && img.naturalWidth > 0,
    hasLivePreview: !!box.querySelector('model-viewer'),
    src: img ? img.getAttribute('src') : null,
  };
});
check('product card shows the cover photo (not a live 3D preview)', coverState.hasImg && coverState.imgLoaded && !coverState.hasLivePreview, coverState.src);
check('no install pop-up on desktop', await dp.evaluate(() => !document.getElementById('installDialog').classList.contains('show')));
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
  const tr = tab ? tab.getBoundingClientRect() : null;
  return {
    appMode: html.classList.contains('app-mode'),
    tabDisplay: tab ? getComputedStyle(tab).display : 'NO TABBAR',
    pillDisplay: pill ? getComputedStyle(pill).display : 'NO PILL',
    swCount: registrations.length,
    bodyPad: getComputedStyle(document.body).paddingBottom,
    tabRect: tr ? { top: Math.round(tr.top), bottom: Math.round(tr.bottom), height: Math.round(tr.height) } : null,
    innerH: window.innerHeight,
  };
});
check('app-mode set on phone', mobState.appMode);
check('tab bar visible on phone', mobState.tabDisplay === 'flex', `display=${mobState.tabDisplay}`);
check('tab bar pinned to the BOTTOM of the screen', mobState.tabRect && Math.abs(mobState.tabRect.bottom - mobState.innerH) <= 1 && mobState.tabRect.top > 0, `top=${mobState.tabRect && mobState.tabRect.top}, bottom=${mobState.tabRect && mobState.tabRect.bottom}, innerH=${mobState.innerH}`);
check('tab bar is a strip, not full-screen', mobState.tabRect && mobState.tabRect.height > 30 && mobState.tabRect.height < 130, `height=${mobState.tabRect && mobState.tabRect.height}`);
check('install pill hidden until prompt on phone', mobState.pillDisplay === 'none', `display=${mobState.pillDisplay}`);
check('service worker registered on phone', mobState.swCount === 1, `registrations=${mobState.swCount}`);
check('app bottom padding on phone', mobState.bodyPad === '86px', `padding=${mobState.bodyPad}`);

// Phone pop-up (iOS UA here -> Add to Home Screen teaching variant)
const dlg = await mp.evaluate(() => ({
  shown: document.getElementById('installDialog').classList.contains('show'),
  body: document.getElementById('installDialogBody').textContent,
  btn: document.getElementById('appInstallBtn').textContent,
}));
check('install pop-up shows on phone', dlg.shown);
check('pop-up says this is an app', /this page is an app/i.test(dlg.body), dlg.body.slice(0, 60));
check('iOS pop-up teaches Add to Home Screen', /Add to Home Screen/i.test(dlg.body), dlg.body.slice(0, 60));
check('iOS pop-up button is Got it', dlg.btn === 'Got it', dlg.btn);
await mp.click('#appInstallLater');
await mp.waitForTimeout(300);
check('pop-up dismisses on Not now', await mp.evaluate(() => !document.getElementById('installDialog').classList.contains('show')));

// Phone: synthetic install prompt must reveal the pill
await mp.evaluate(() => {
  const pill = document.getElementById('installPill');
  window.dispatchEvent(new Event('beforeinstallprompt'));
  return new Promise(r => setTimeout(r, 300));
});
const pillShown = await mp.evaluate(() => getComputedStyle(document.getElementById('installPill')).display);
check('install pill appears when prompt fires on phone', pillShown === 'flex', `display=${pillShown}`);

// Phone: tap the CENTER of a product picture -> 3D viewer must open
await mp.evaluate(() => document.getElementById('shop').scrollIntoView());
await mp.waitForTimeout(700);
const tapTarget = await mp.evaluate(() => {
  const b = document.querySelector('.product-img-box.img3d');
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await mp.touchscreen.tap(tapTarget.x, tapTarget.y);
await mp.waitForTimeout(1200);
const openedByTap = await mp.evaluate(() => document.getElementById('viewerModal').classList.contains('open'));
check('tapping anywhere on the picture opens the 3D viewer', openedByTap);
if (openedByTap) await mp.evaluate(() => document.getElementById('viewerClose').click());

// The tab bar must stay glued to the bottom while scrolling (never fly away)
await mp.evaluate(() => window.scrollBy(0, 1200));
await mp.waitForTimeout(900);
const afterScroll = await mp.evaluate(() => {
  const r = document.getElementById('tabBar').getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), innerH: window.innerHeight };
});
check('tab bar stays fixed at the bottom while scrolling', afterScroll.top > 0 && Math.abs(afterScroll.bottom - afterScroll.innerH) <= 1, `top=${afterScroll.top}, bottom=${afterScroll.bottom}, innerH=${afterScroll.innerH}`);
await mob.close();

// ---------------- ANDROID (install-capable variant) ----------------
console.log('\n== ANDROID (Chrome 412x915, touch) ==');
const and = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' });
const ap = await and.newPage();
await ap.goto(URL, { waitUntil: 'networkidle' });
await ap.waitForTimeout(2600);
const aState = await ap.evaluate(() => ({
  shown: document.getElementById('installDialog').classList.contains('show'),
  btn: document.getElementById('appInstallBtn').textContent,
  body: document.getElementById('installDialogBody').textContent,
}));
check('Android pop-up shows', aState.shown);
check('Android pop-up button is Install app', aState.btn === 'Install app', aState.btn);
check('Android pop-up copy mentions home screen', /home screen/i.test(aState.body), aState.body.slice(0, 60));
await ap.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
await ap.waitForTimeout(300);
const aPill = await ap.evaluate(() => getComputedStyle(document.getElementById('installPill')).display);
check('Android install pill appears on prompt', aPill === 'flex', aPill);
await ap.click('#appInstallLater');
await and.close();

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
