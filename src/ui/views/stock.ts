import { registerView, registerActions, registerInputs, pageHead, panel, kpi, tabs, curTab, table, bar, badge, btn, money, pct, sgn, empty, app, num, px, fmtDay, tip } from '../kit';
import { chart } from '../charts';
import { spark } from '../charts';
import { ui, S } from '../state';
import * as stock from '../../sim/stock';
import * as fin from '../../sim/finance';
import { fmtDate } from '../../sim/util';
import './stock.css';

interface Sel { period: string; mode: 'candle' | 'line'; ipoPrice: number; ipoPct: number; qty: number }
const sel = (): Sel => (ui.sel.stock ||= { period: '1Y', mode: 'candle', ipoPrice: 0, ipoPct: 0.15, qty: 1000 });

function render(): string {
  const s = S(); const pub = s.stock.public; const tab = curTab('stock', pub ? 'terminal' : 'ipo');
  const items: [string, string][] = pub ? [['terminal', 'My Stock'], ['market', 'Market'], ['portfolio', 'Portfolio']] : [['ipo', 'Go Public (IPO)'], ['market', 'Market'], ['portfolio', 'Portfolio']];
  const st = s.stock; const idx = st.index; const ch = idx.length > 1 ? idx[idx.length - 1] / idx[idx.length - 2] - 1 : 0;
  const head = pageHead('Stock Market', pub ? `${s.co.name} is listed. Share price reflects fundamentals, sentiment and every headline.` : 'Watch the market, build stakes in rivals — and take your company public when you are ready.',
    `<div class="tick"><span>TECH-IDX</span><b class="num">${(idx[idx.length - 1] || 1000).toFixed(1)}</b><em class="${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '▲' : '▼'} ${(Math.abs(ch) * 100).toFixed(2)}%</em></div>`);
  return head + tabs('stock', items, pub ? 'terminal' : 'ipo') + (tab === 'terminal' ? terminal() : tab === 'ipo' ? ipo() : tab === 'market' ? market() : portfolio());
}
function gauge(v: number): string {
  const lbl = v < 25 ? 'Extreme fear' : v < 45 ? 'Fear' : v < 55 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme greed'; const col = v < 45 ? 'var(--bad)' : v < 55 ? 'var(--warn)' : 'var(--good)';
  return `<div class="fg"><div class="fgbar"><i style="left:${v}%"></i></div><div class="row between"><small>Fear</small><b style="color:${col}">${lbl} · ${v.toFixed(0)}</b><small>Greed</small></div></div>`;
}
function terminal(): string {
  const s = S(); const st = s.stock; const x = sel(); const h = st.pxHist; const prev = h.length > 1 ? h[h.length - 2] : st.px; const d = st.px - prev;
  const hist = stock.playerStockHistory(s, x.period); const out = fin.outstanding(s);
  const lbl = hist.labels.map(l => fmtDate(+l));
  const chartHtml = chart('stk-main', () => { const hh = stock.playerStockHistory(s, sel().period); const l2 = hh.labels.map(l => fmtDate(+l)); return sel().mode === 'candle' ? { candles: hh.candles, labels: l2, fmt: px } : { series: [{ name: 'Price', color: '#4cc9f0', data: hh.line, fill: true }], labels: l2, fmt: px, legend: false }; }, 330);
  void lbl; void hist;
  const eh: any[] = s.flags.earnHist || [];
  return `<div class="grid g32">
   <div class="col">${panel(`${s.co.name.toUpperCase()} <span class="dim">· ${s.co.name.slice(0, 4).toUpperCase()}</span>`, `<div class="quote"><b class="num big">${px(st.px)}</b><span class="num ${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)} (${(prev ? (d / prev) * 100 : 0).toFixed(2)}%)</span></div>
    <div class="row wrap mb">${Object.keys(stock.PERIODS).map(p => btn(p, 'stk-period', { p }, x.period === p ? 'primary sm' : 'sm ghost')).join('')}<span class="grow"></span>${btn('Candles', 'stk-mode', { m: 'candle' }, x.mode === 'candle' ? 'sm primary' : 'sm ghost')}${btn('Line', 'stk-mode', { m: 'line' }, x.mode === 'line' ? 'sm primary' : 'sm ghost')}</div>${chartHtml}`)}
   ${panel('TECH index', chart('stk-idx', () => ({ series: [{ name: 'TECH-IDX', color: '#c77dff', data: s.stock.index.slice(-150), fill: true }], legend: false, fmt: v => v.toFixed(0) }), 150))}</div>
   <div class="col">${panel('Statistics', `${row('Market cap', money(st.px * out))}${row('Fundamental value / share', px(st.fair))}${row('52-wk high / low', `${px(st.hi52)} / ${px(st.lo52)}`)}${row('Volume (shares)', num(st.volume))}${row('Shares outstanding', num(out))}${row('EPS (last qtr)', '$' + st.lastEPS.toFixed(3))}${row('Short interest', pct(st.shortInterest / 100))}${row('IPO price', px(st.ipoPx))}${row('Since IPO', `<span class="${st.px >= st.ipoPx ? 'pos' : 'neg'}">${sgn((st.px / Math.max(0.01, st.ipoPx) - 1) * 100, v => v.toFixed(1) + '%')}</span>`)}`)}
   ${panel('Analyst consensus', `<div class="anl"><i class="g" style="width:${st.analysts.buy}%"></i><i class="y" style="width:${st.analysts.hold}%"></i><i class="r" style="width:${st.analysts.sell}%"></i></div><div class="row between sm"><span class="pos">Buy ${st.analysts.buy}%</span><span class="warn-c">Hold ${st.analysts.hold}%</span><span class="neg">Sell ${st.analysts.sell}%</span></div>${row('Price target', px(st.analysts.target))}${row('Institutions / Retail', `${st.inst}% / ${st.retail}%`)}`)}
   ${panel('Market sentiment', gauge(st.sentiment))}
   ${panel('Earnings', `${row('Next report', fmtDate(st.nextEarnings))}${row('Last surprise', `<span class="${st.lastSurprise >= 0 ? 'pos' : 'neg'}">${sgn(st.lastSurprise * 100, v => v.toFixed(1) + '%')}</span>`)}${eh.length ? table(['Date', 'Revenue', 'EPS', 'Surprise', 'Move'], eh.slice(-5).reverse().map(e => [fmtDate(e.day), money(e.rev), '$' + e.eps.toFixed(3), `<span class="${e.surprise >= 0 ? 'pos' : 'neg'}">${(e.surprise * 100).toFixed(1)}%</span>`, `<span class="${e.jump >= 0 ? 'pos' : 'neg'}">${(e.jump * 100).toFixed(1)}%</span>`]), 'mt', ['', 'r', 'r', 'r', 'r']) : ''}`)}
   </div></div>`;
}
const row = (a: string, b: string) => `<div class="stat-row"><span>${a}</span><b class="num">${b}</b></div>`;

function ipo(): string {
  const s = S(); const x = sel(); const rd = stock.ipoReadiness(s); const out = fin.outstanding(s);
  const fair = s.derived.valuation / out; if (!x.ipoPrice) x.ipoPrice = Math.round(fair * 100) / 100;
  const shares = Math.round((out * x.ipoPct) / (1 - x.ipoPct)); const p = stock.ipoPreview(s, x.ipoPrice, shares);
  const dcol = p.demand < 0.6 ? 'var(--bad)' : p.demand < 1 ? 'var(--warn)' : 'var(--good)';
  return `<div class="grid g2">${panel('IPO readiness', `<ul class="checks">${rd.checks.map(c => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✔' : '✘'} ${c.label}</li>`).join('')}</ul><p class="dim sm">Underwriters take ~6% of proceeds. A strong brand, growth, profitability and bullish markets increase demand. Pricing too high gets the IPO pulled.</p>
    ${row('Fundamental valuation', money(s.derived.valuation))}${row('Fair value per share', px(fair))}${row('Market sentiment', s.stock.sentiment.toFixed(0) + ' / 100')}`)}
  ${panel('Structure your offering', `<div class="col">${sl('stk-ipoprice', x.ipoPrice, Math.max(0.01, fair * 0.4), fair * 2, Math.max(0.01, fair / 100), 'Offer price', px(x.ipoPrice))}${sl('stk-ipopct', x.ipoPct, 0.05, 0.4, 0.01, 'Float (new shares)', pct(x.ipoPct, 0))}</div>
    <div class="mt">${row('New shares issued', num(shares))}${row('Gross proceeds', money(p.raise))}${row('Underwriting fees (6%)', money(p.fee))}${row('Net proceeds', `<b class="pos">${money(p.net)}</b>`)}${row('Founder stake after', pct(s.fin.founderShares / (out + shares)))}${row('Price vs fair value', `${(p.ratio * 100).toFixed(0)}%`)}</div>
    <div class="demand mt"><div class="row between"><span>Expected demand ${tip('Book demand relative to the shares offered')}</span><b class="num" style="color:${dcol}">${p.demand.toFixed(2)}× subscribed</b></div>${bar(p.demand, 3, dcol, '', 8)}<small class="dim">${p.demand < 0.4 ? 'The IPO would be pulled at this price.' : `Opening-day move expected: ${sgn(p.pop * 100, v => v.toFixed(0) + '%')}`}</small></div>
    ${btn('🔔 Ring the bell — launch IPO', 'stk-ipo', {}, 'primary xl block mt', !rd.ready)}`)}</div>`;
}
function sl(id: string, v: number, min: number, max: number, step: number, label: string, shown: string) {
  return `<label class="slider"><span>${label}</span><input type="range" data-input="${id}" data-change="stk-upd" min="${min}" max="${max}" step="${step}" value="${v}"><b class="num" data-for="${id}">${shown}</b></label>`;
}
function market(): string {
  const s = S(); const x = sel(); const rows = s.rivals.filter(r => r.status === 'active').sort((a, b) => stock.rivalMcap(b) - stock.rivalMcap(a));
  const pf = s.stock.portfolio;
  const body = rows.length ? table(['Company', 'Price', 'Δ wk', 'Mkt cap', 'Trend', 'Sentiment', `Trade ${tip('Buy qty is set in the box above')}`], rows.map(r => {
    const h = r.pxHist; const d = h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0; const held = pf[r.id]; const price = stock.stakePrice(r);
    return [`<b style="color:${r.color}">${r.name}</b><br><small class="dim">${r.publicCo ? 'Listed' : 'Private'} · ${r.archetype}</small>`, px(price), `<span class="${d >= 0 ? 'pos' : 'neg'}">${(d * 100).toFixed(1)}%</span>`, money(stock.rivalMcap(r)), spark(h.slice(-52), d >= 0 ? '#2ee6a6' : '#ff5d73'), `${r.sentiment.toFixed(0)}`,
      `<div class="row">${btn('Buy', 'stk-buy', { id: r.id }, 'sm good')}${held ? btn('Sell', 'stk-sell', { id: r.id }, 'sm bad') : ''}${held ? `<small class="dim">${num(held.shares)} held</small>` : ''}</div>`];
  }), 'click', ['', 'r', 'r', 'r', '', 'r', '']) : empty('No listed companies yet', 'Rivals will appear here.');
  return `<div class="row mb"><span class="dim">Trade size (shares)</span>${[100, 1000, 10000, 100000, 1000000].map(q => btn(q >= 1000 ? num(q) : String(q), 'stk-qty', { q }, x.qty === q ? 'sm primary' : 'sm')).join('')}<span class="dim sm">Fee 0.1%. Private startups trade at a premium and are illiquid.</span></div>` + panel('Companies', body, '', 'flat') +
    `<div class="mt">${panel('TECH index (weekly)', chart('stk-idx2', () => ({ series: [{ name: 'TECH-IDX', color: '#c77dff', data: s.stock.index.slice(-200), fill: true }], legend: false, fmt: v => v.toFixed(0) }), 190))}</div>`;
}
function portfolio(): string {
  const s = S(); const pf = Object.entries(s.stock.portfolio); let cost = 0, val = 0;
  const rows = pf.map(([id, p]) => { const r = s.rivals.find(v => v.id === id); const price = r ? stock.stakePrice(r) : 0; const v = p.shares * price; cost += p.cost; val += v; const own = r ? p.shares / stock.stakeShares(r) : 0;
    return [r?.name || id, num(p.shares), pct(own, 1), money(p.cost / p.shares), px(price), money(v), `<span class="${v >= p.cost ? 'pos' : 'neg'}">${sgn(v - p.cost)}</span>`, `<div class="row">${btn('Buy more', 'stk-buy', { id }, 'sm good')}${btn('Sell', 'stk-sell', { id }, 'sm bad')}</div>`]; });
  return `<div class="kpis mb">${kpi('Portfolio value', money(val))}${kpi('Cost basis', money(cost))}${kpi('Unrealised P&L', `<span class="${val >= cost ? 'pos' : 'neg'}">${sgn(val - cost)}</span>`)}${kpi('Cash', money(s.fin.cash))}</div>` +
    panel('Your holdings', pf.length ? table(['Company', 'Shares', 'Ownership', 'Avg cost', 'Price', 'Value', 'P&L', ''], rows, '', ['', 'r', 'r', 'r', 'r', 'r', 'r', 'r']) + `<p class="dim sm pad">Stakes of 15%+ in a listed company unlock hostile takeovers (Corporate M&A).</p>` : empty('No positions', 'Open the Market tab to buy shares in rivals and startups.'), '', 'flat');
}
registerActions({
  'stk-upd': () => {}, 'stk-period': el => { sel().period = el.dataset.p!; }, 'stk-mode': el => { sel().mode = el.dataset.m as any; }, 'stk-qty': el => { sel().qty = +el.dataset.q!; },
  'stk-ipo': () => { const s = S(); const x = sel(); const out = fin.outstanding(s); const r = stock.launchIPO(s, { price: x.ipoPrice, shares: Math.round((out * x.ipoPct) / (1 - x.ipoPct)) }); app.toast(r.msg, r.ok ? 'good' : 'bad'); app.sfx(r.ok ? 'launch' : 'error'); if (r.ok) ui.tab.stock = 'terminal'; },
  'stk-buy': el => { const r = stock.buyShares(S(), el.dataset.id!, sel().qty); app.toast(r.msg, r.ok ? 'good' : 'warn'); app.sfx(r.ok ? 'cash' : 'error'); },
  'stk-sell': el => { const r = stock.sellShares(S(), el.dataset.id!, sel().qty); app.toast(r.msg, r.ok ? 'good' : 'warn'); app.sfx(r.ok ? 'cash' : 'error'); },
});
registerInputs({
  'stk-ipoprice': el => { sel().ipoPrice = +el.value; const o = document.querySelector('[data-for="stk-ipoprice"]'); if (o) o.textContent = px(+el.value); }, 'stk-ipopct': el => { sel().ipoPct = +el.value; const o = document.querySelector('[data-for="stk-ipopct"]'); if (o) o.textContent = pct(+el.value, 0); },
});
registerView({ id: 'stock', title: 'Stock Market', icon: '📈', group: 'money', order: 1, render });
void fmtDay;
