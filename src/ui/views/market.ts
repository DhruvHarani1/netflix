import { registerView, registerActions, pageHead, panel, kpi, btn, badge, bar, table, tabs, curTab, money, num, pct, esc, app, stars, tip, scoreColor } from '../kit';
import { chart, donut } from '../charts';
import { ui, S } from '../state';
import { CATS, CAT, CAT_GROUPS } from '../../data/categories';
import { SEGS, SEG, REGIONS } from '../../data/core';
import { fmtDate } from '../../sim/util';
import { loadPerUser } from '../../sim/market';
import type { GameState, CatId } from '../../sim/types';
import './market.css';

const sel = () => (ui.sel.market ||= { cat: null as CatId | null });
function catTable(s: GameState): string {
  const rows = CATS.map(c => { const cm = s.market.cats[c.id]; const nr = s.rivals.filter(r => r.status === 'active' && r.offers[c.id]).length; const mine = s.products.filter(p => p.status === 'live' && p.cat === c.id).length;
    const rev = cm.rev30;
    return `<tr class="${cm.unlocked ? '' : 'dimrow'}" data-act="m-cat" data-id="${c.id}" style="cursor:pointer"><td>${c.icon} <b>${c.name}</b><br><small class="dim">${c.group}</small></td><td class="r num">${money(cm.size * cm.ref * (c.sub ? 6 : 1))}</td><td class="r num ${cm.growth > .1 ? 'pos' : ''}">${pct(cm.growth, 1)}</td><td class="r num">$${cm.ref.toFixed(cm.ref < 10 ? 2 : 0)}</td><td class="r num">${cm.avgQ.toFixed(0)}</td><td class="r">${trend(cm.trend)}</td><td class="r num">${nr}</td><td class="r num">${mine ? `<b style="color:var(--accent)">${pct(cm.playerShare, 1)}</b>` : '—'}</td><td class="r">${cm.unlocked ? badge('open', 'good') : badge('locked', 'warn')}</td></tr>`; }).join('');
  return `<table class="tbl click"><thead><tr><th>Category</th><th class="r">Market /yr</th><th class="r">Growth</th><th class="r">Ref. price</th><th class="r">Avg quality</th><th class="r">Trend</th><th class="r">Rivals</th><th class="r">Your share</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
const trend = (t: number) => t > .25 ? '<span class="pos">▲ hot</span>' : t < -.25 ? '<span class="neg">▼ cooling</span>' : '<span class="dim">– steady</span>';
function catDetail(s: GameState, id: CatId): string {
  const c = CAT[id]; const cm = s.market.cats[id];
  const owners = Object.entries(cm.shares).filter(([, v]) => v > 0.003).sort((a, b) => b[1] - a[1]);
  const name = (k: string) => k === 'player' ? s.co.name : k === 'gen' ? 'Generic / white-label' : s.rivals.find(r => r.id === k)?.name || k;
  const col = (k: string, i: number) => k === 'player' ? s.co.color : k === 'gen' ? '#59627a' : s.rivals.find(r => r.id === k)?.color || ['#4cc9f0', '#c77dff', '#ffb703', '#2ee6a6'][i % 4];
  return `<div class="row between mb">${btn('← All categories', 'm-cat-close', {}, 'ghost sm')}<h2>${c.icon} ${c.name}</h2><span></span></div>
  <div class="kpis mb">${kpi('Market size', money(cm.size * cm.ref * (c.sub ? 6 : 1)) + '/yr', c.sub ? 'recurring revenue at steady state' : `${num(cm.size)} units/yr`)}${kpi('Growth', pct(cm.growth, 1), 'annual')}${kpi('Avg quality', cm.avgQ.toFixed(0), `frontier ${cm.frontierQ.toFixed(0)}`)}${kpi('Reference price', '$' + cm.ref.toFixed(cm.ref < 10 ? 2 : 0), c.sub ? 'per month' : 'per unit')}${kpi('Saturation', pct(cm.saturation, 0), 'market maturity')}</div>
  <div class="grid g2">${panel('Revenue share', `<div class="row" style="align-items:flex-start;gap:24px">${donut(owners.map(([k, v], i) => ({ label: name(k), value: v, color: col(k, i) })), 150)}<div style="flex:1">${owners.map(([k, v], i) => `<div class="stat-row"><span><i class="dot" style="background:${col(k, i)}"></i>${esc(name(k))}</span><b class="num">${pct(v, 1)}</b></div>`).join('')}</div></div>`)}
  ${panel('Segment mix', SEGS.filter(g => c.seg[g] > .01).map(g => `<div class="stat-row"><span>${SEG[g].icon} ${SEG[g].name} <small class="dim">awareness ${s.marketing.awareness[g].toFixed(0)}%</small></span><b class="num">${(c.seg[g] * 100).toFixed(0)}%</b></div>`).join('') + `<p class="dim sm mt">${c.cls === 'hw' ? 'Hardware needs factories or contract manufacturing.' : c.cls === 'svc' ? `Services need data-centre capacity (load ${loadPerUser(id)}/user) or cloud hosting.` : 'Software scales without factories.'}</p>`)}</div>
  ${panel('Competitors in this market', table(['Company', 'Product', 'Quality', 'Price', 'Rev / mo'], s.rivals.filter(r => r.status === 'active' && r.offers[id]).map(r => { const o = r.offers[id]!; return [`<b style="color:${r.color}">${esc(r.name)}</b>`, esc(o.name), `<span class="num">${o.q.toFixed(0)}</span>`, `<span class="num">$${o.price.toFixed(o.price < 10 ? 2 : 0)}</span>`, `<span class="num">${money(o.revEma * 30)}</span>`]; }), '', ['', '', 'r', 'r', 'r']) || '')}`;
}
function segments(s: GameState): string {
  const live = s.products.filter(p => p.status === 'live');
  return `<div class="segs">${SEGS.map(g => { const d = SEG[g]; const w = d.w; const ps = live.filter(p => p.target === g);
    const wsum = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${({ price: 'Price', perf: 'Performance', brand: 'Brand', inn: 'Innovation', rel: 'Reliability', svc: 'Service', eco: 'Ecosystem' } as any)[k]} ${(v * 100).toFixed(0)}%`).join(' · ');
    return `<div class="seg"><div class="seg-h"><span class="pc-ic">${d.icon}</span><div><b>${d.name}</b><small>${d.blurb}</small></div></div><div class="stat-row"><span>Cares about</span><b>${wsum}</b></div><div class="stat-row"><span>Expects prices ≈</span><b class="num">${d.priceMult.toFixed(2)}× ref</b></div><div class="stat-row"><span>Your awareness</span><b class="num">${s.marketing.awareness[g].toFixed(0)}%</b></div>${bar(s.marketing.awareness[g], 100, 'var(--accent)', '', 4)}<div class="stat-row mt"><span>Your products targeting</span><b>${ps.length ? ps.map(p => esc(p.name)).join(', ') : '—'}</b></div></div>`; }).join('')}</div>`;
}
function reviews(s: GameState): string {
  const all = s.products.flatMap(p => p.reviews.map(r => ({ ...r, p }))).sort((a, b) => b.day - a.day).slice(0, 30);
  const live = s.products.filter(p => p.status === 'live');
  return `<div class="grid g21">${panel('Customer reviews', all.length ? `<div class="reviews">${all.map(r => `<div class="rev"><span class="stars">${stars(r.stars)}</span><b>${esc(r.p.name)}</b> <small>${r.who === 'press' ? 'Press' : SEG[r.who as any as keyof typeof SEG].name} · ${fmtDate(r.day)}</small><p>“${esc(r.text)}”</p></div>`).join('')}</div>` : '<p class="dim">Launch a product to start collecting reviews.</p>')}
  ${panel('Satisfaction', live.length ? live.map(p => `<div class="mb"><div class="row between"><b>${esc(p.name)}</b><span>${stars(p.rating)} <small class="dim">${p.rating.toFixed(1)}</small></span></div>${bar(p.satisf, 100, scoreColor(p.satisf), `satisfaction ${p.satisf.toFixed(0)} · reliability ${p.rel.toFixed(0)} · support ${s.derived.service.toFixed(0)}`, 6)}</div>`).join('') : '<p class="dim">No live products.</p>')}</div>`;
}
function economy(s: GameState): string {
  const e = s.market.econ;
  return `<div class="kpis mb">${kpi('Cycle', `<span style="text-transform:capitalize;color:${e.cycle === 'recession' ? 'var(--bad)' : e.cycle === 'boom' ? 'var(--good)' : 'var(--text)'}">${e.cycle}</span>`, `demand ×${e.demandMult.toFixed(2)}`)}${kpi('GDP growth', pct(e.gdp / 100, 1))}${kpi('Interest rate', pct(e.rate, 2))}${kpi('Inflation', pct(e.inflation, 1))}${kpi('Consumer confidence', e.confidence.toFixed(0))}${kpi('Unemployment', pct(e.unemployment, 1))}</div>
  <div class="grid g2">${panel('Industry revenue by category (30d)', chart('m-ind', () => ({ type: 'bar', series: [{ name: 'Revenue', color: '#4cc9f0', data: CATS.map(c => s.market.cats[c.id].rev30) }], labels: CATS.map(c => c.name.slice(0, 5)), fmt: money, legend: false }), 220))}
  ${panel('Regional demand', table(['Region', 'Weight', 'Buying power', 'Your presence', 'Your revenue'], REGIONS.map(r => [`<b>${r.name}</b>`, `<span class="num">${(r.pop * 100).toFixed(0)}%</span>`, `<span class="num">×${r.power.toFixed(2)}</span>`, `<span class="num">${s.regions[r.id].presence.toFixed(0)}%</span>`, `<span class="num">${money(s.regions[r.id].revenueEma * 30)}</span>`]), '', ['', 'r', 'r', 'r', 'r']))}</div>`;
}
registerView({
  id: 'market', title: 'Market', icon: '🛒', group: 'market', order: 0,
  render: () => {
    const s = S(); const t = curTab('market', 'cats');
    let body = ''; if (t === 'cats') body = sel().cat ? catDetail(s, sel().cat!) : panel('All markets', catTable(s), '', 'flat'); else if (t === 'segs') body = segments(s); else if (t === 'rev') body = reviews(s); else body = economy(s);
    return pageHead('Market & Customers', 'Demand is split across seven customer segments and seven regions. Awareness gates who can buy; quality, price, brand and ecosystem decide who wins.') + tabs('market', [['cats', 'Categories'], ['segs', 'Customer segments'], ['rev', 'Reviews & satisfaction'], ['eco', 'Economy']]) + body;
  },
});
registerActions({ 'm-cat': el => { sel().cat = el.dataset.id as CatId; }, 'm-cat-close': () => { sel().cat = null; } });
