// Deeper UI e2e: plays real flows through the DOM. Usage: node scripts/e2e.cjs URL OUTDIR
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173'; const out = process.argv[3] || '/tmp/e2e'; require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const st = f => p.evaluate(f);
  const ok = (name, cond) => console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  const clear = async () => { for (let i = 0; i < 5; i++) { const m = await p.$('#modal'); if (!m) return; const t = await st(() => __tt.ui.modal && __tt.ui.modal.id); console.log('  modal:', t); const c = await p.$('#modal [data-act=decide-pick]'); if (c) await c.click(); else { const x = await p.$('#modal [data-act=modal-close]'); if (x) await x.click(); else await p.keyboard.press('Escape'); } await p.waitForTimeout(150); } };
  const go = async v => { await clear(); await p.click(`.nitem[data-v=${v}]`); await p.waitForTimeout(200); };
    await p.goto(url); await p.waitForSelector('#menu');
  await p.click('[data-act=menu-new]'); await p.fill('[data-input=c-name]', 'E2E Corp'); await p.fill('[data-input=c-founder]', 'Tester');
  await p.click('[data-act=c-next]'); await p.click('[data-act=c-spec][data-v=software]'); await p.click('[data-act=c-next]'); await p.click('[data-act=c-cap][data-v=series]'); await p.click('[data-act=c-next]'); await p.click('[data-act=c-launch]');
  await p.waitForSelector('#frame'); await p.click('[data-act=welcome-go]');
  ok('game started', await st(() => !!__tt.G.s));
  // ---- hire
  await go('people'); await p.click('.tab[data-key=hiring]'); await p.waitForTimeout(200);
  const n0 = await st(() => __tt.G.s.derived.headcount);
  const hireBtn = await p.$('[data-act*=hire]:not([data-act*=team])'); console.log('hire actions:', await st(() => Array.from(document.querySelectorAll('#view [data-act]')).map(e => e.dataset.act).filter((v, i, a) => a.indexOf(v) === i).join(',')));
  await p.screenshot({ path: `${out}/people-hire.png` });
  // ---- product wizard
  await go('products'); await clear(); await p.click('[data-act=p-new]'); await p.click('[data-act=w-cat][data-id=desktopapp]'); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/wizard.png` });
  await p.click('[data-act=w-create]'); await p.waitForTimeout(250);
  const prod = await st(() => __tt.G.s.products.length); ok('product created via wizard', prod === 1);
  await p.screenshot({ path: `${out}/product-dev.png` });
  // run time until prototype
  await st(() => { const s = __tt.G.s; s.fin.cash += 5e6; });
  await st(() => { __tt.ui.paused = false; __tt.ui.speed = 10; });
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); const stt = await st(() => __tt.G.s.products[0].status); if (stt !== 'dev') break; }
  ok('prototype reached', ['prototype', 'testing', 'ready'].includes(await st(() => __tt.G.s.products[0].status)));
  await st(() => { __tt.ui.paused = true; }); await p.screenshot({ path: `${out}/product-proto.png` });
  // ---- research
  await go('research'); await p.screenshot({ path: `${out}/research.png` });
  // ---- visit every view quickly with errors
  const views = await st(() => Array.from(document.querySelectorAll('.nitem[data-v]')).map(e => e.dataset.v));
  for (const v of views) { await go(v); }
  // ---- save / load round trip
  const before = await st(() => JSON.stringify({ d: __tt.G.s.day, c: Math.round(__tt.G.s.fin.cash), p: __tt.G.s.products.length }));
  await p.click('[data-act=save-quick]'); await p.waitForTimeout(200);
  await p.reload(); await p.waitForSelector('#menu'); await p.click('[data-act=menu-continue]'); await p.waitForSelector('#frame');
  const after = await st(() => JSON.stringify({ d: __tt.G.s.day, c: Math.round(__tt.G.s.fin.cash), p: __tt.G.s.products.length }));
  ok('save/load round-trip', before === after); console.log(before, after);
  console.log('ERRORS', errors.length); errors.slice(0, 10).forEach(e => console.log(' -', e.slice(0, 300)));
  await b.close();
})();
