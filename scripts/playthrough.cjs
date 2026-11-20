// Human-style UI playthrough: real clicks through product lifecycle, research, marketing, finance. Usage: node scripts/playthrough.cjs URL
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const st = f => p.evaluate(f); const results = []; const ok = (n, c) => { results.push([n, !!c]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
  const clear = async () => { for (let i = 0; i < 6; i++) { if (!(await p.$('#modal'))) return; const c = await p.$('#modal [data-act=decide-pick]'); if (c) await c.click(); else { const x = await p.$('#modal [data-act=modal-close]'); if (x) await x.click(); else await p.keyboard.press('Escape'); } await p.waitForTimeout(120); } };
  const go = async v => { await clear(); await p.click(`.nitem[data-v=${v}]`); await p.waitForTimeout(150); };
  const runUntil = async (cond, maxMs = 90000) => { await clear(); await st(() => { __tt.ui.paused = false; __tt.ui.speed = 10; }); const t0 = Date.now(); while (Date.now() - t0 < maxMs) { await p.waitForTimeout(400); await clear(); await st(() => { __tt.ui.paused = false; __tt.ui.speed = 10; }); if (await st(cond)) break; } await st(() => { __tt.ui.paused = true; }); await clear(); };
  await p.goto(url); await p.waitForSelector('#menu');
  await p.click('[data-act=menu-new]'); await p.fill('[data-input=c-name]', 'Playthrough Inc'); await p.fill('[data-input=c-founder]', 'Pat');
  await p.click('[data-act=c-next]'); await p.click('[data-act=c-spec][data-v=software]'); await p.click('[data-act=c-next]'); await p.click('[data-act=c-cap][data-v=series]'); await p.click('[data-act=c-next]'); await p.click('[data-act=c-launch]');
  await p.waitForSelector('#frame'); await p.click('[data-act=welcome-go]');
  // product via wizard
  await go('products'); await p.click('[data-act=p-new]'); await p.click('[data-act=w-cat][data-id=desktopapp]'); await p.click('[data-act=w-create]'); await p.waitForTimeout(250);
  ok('product created', await st(() => __tt.G.s.products.length === 1));
  const cash0 = await st(() => __tt.G.s.fin.cash);
  await runUntil(() => __tt.G.s.products[0].status !== 'dev', 120000);
  ok('development progressed to prototype', await st(() => ['prototype', 'testing', 'ready'].includes(__tt.G.s.products[0].status)));
  ok('dev consumed money', await st(() => __tt.G.s.products[0].spent > 0));
  await go('products'); { const o = await p.$('[data-act=p-open]'); if (o) await o.click(); } await p.waitForTimeout(150);
  if (await p.$('[data-act=p-test]')) await p.click('[data-act=p-test]');
  await runUntil(() => __tt.G.s.products[0].status === 'ready', 120000);
  ok('testing finished -> ready', await st(() => __tt.G.s.products[0].status === 'ready'));
  await go('products'); { const o = await p.$('[data-act=p-open]'); if (o) await o.click(); } await p.waitForTimeout(150); await p.click('[data-act=p-launch]'); await p.waitForTimeout(300); await clear();
  ok('product launched', await st(() => __tt.G.s.products[0].status === 'live'));
  // marketing
  await go('marketing'); await p.click('[data-act=mk-ch][data-v=social]').catch(() => {}); const launchBtn = await p.$('[data-act=mk-launch]'); if (launchBtn) await launchBtn.click(); await p.waitForTimeout(200);
  ok('campaign launched via UI', await st(() => __tt.G.s.marketing.campaigns.length >= 1));
  // research
  await go('research'); const node = await p.$('[data-act=rs-sel]'); if (node) await node.click(); await p.waitForTimeout(150);
  const rsb = await p.$('[data-act=rs-start]'); if (rsb) await rsb.click(); await p.waitForTimeout(150);
  ok('research queued via UI', await st(() => __tt.G.s.research.active.length >= 1));
  // finance: take a bank loan
  await go('finance'); await p.click('.tab[data-key=debt]').catch(() => {}); await p.waitForTimeout(150);
  await runUntil(() => __tt.G.s.products[0].lifeRev > 50000 || __tt.G.s.day > 700, 90000);
  ok('revenue earned after launch', await st(() => __tt.G.s.products[0].lifeRev > 0));
  ok('research progressing', await st(() => __tt.G.s.research.active.length === 0 || __tt.G.s.research.active[0].progress > 0));
  ok('balance sheet balances', await st(() => { const s = __tt.G.s, l = s.fin.ledger; const a = s.fin.cash + l.ppe + l.goodwill + l.invest; const e = l.paidIn + l.retained + s.fin.loans.reduce((x, y) => x + y.principal, 0); return Math.abs(a - e) < 5; }));
  console.log('day', await st(() => __tt.G.s.day), 'cash', Math.round(cash0), '->', Math.round(await st(() => __tt.G.s.fin.cash)), 'lifeRev', Math.round(await st(() => __tt.G.s.products[0].lifeRev)));
  console.log('console errors:', errors.length); errors.slice(0, 5).forEach(e => console.log(' -', e.slice(0, 250)));
  await b.close(); process.exit(results.every(r => r[1]) && !errors.length ? 0 : 1);
})();
