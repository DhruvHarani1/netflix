// End-to-end smoke test: drives the real UI with Playwright, visits every view, collects console errors, saves screenshots.
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:5173';
const out = process.argv[3] || '/tmp/shots';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = []; p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.goto(url); await p.waitForSelector('#menu'); await p.screenshot({ path: `${out}/01-menu.png` });
  await p.click('[data-act=menu-new]'); await p.waitForSelector('#create');
  await p.fill('[data-input=c-name]', 'Quantum Forge'); await p.fill('[data-input=c-founder]', 'Dana Reyes'); await p.screenshot({ path: `${out}/02-create1.png` });
  await p.click('[data-act=c-next]'); await p.click('[data-act=c-spec][data-v=ai]'); await p.screenshot({ path: `${out}/03-create2.png` });
  await p.click('[data-act=c-next]'); await p.screenshot({ path: `${out}/04-create3.png` });
  await p.click('[data-act=c-next]'); await p.screenshot({ path: `${out}/05-create4.png` });
  await p.click('[data-act=c-launch]'); await p.waitForSelector('#frame'); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/06-welcome.png` });
  await p.click('[data-act=welcome-go]');
  // run some game time
  await p.evaluate(() => { __tt.ui.paused = false; __tt.ui.speed = 10; }); await p.waitForTimeout(6000); await p.evaluate(() => { __tt.ui.paused = true; });
  const views = await p.evaluate(() => Array.from(document.querySelectorAll('.nitem[data-v]')).map(e => e.dataset.v));
  for (const v of views) { await p.click(`.nitem[data-v=${v}]`); await p.waitForTimeout(350); await p.screenshot({ path: `${out}/v-${v}.png` }); }
  const day = await p.evaluate(() => __tt.G.s.day); console.log('day', day, 'views', views.length);
  console.log('ERRORS', errors.length); errors.slice(0, 15).forEach(e => console.log(' -', e.slice(0, 300)));
  await b.close();
})();
