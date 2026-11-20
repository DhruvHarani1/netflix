import './competitors.css';
import { registerView, registerActions, pageHead, panel, empty, tabs, curTab, table, money, num, pct, bar, badge, btn, kpi, logo, esc, int, fmtDay, app, scoreColor } from '../kit';
import { S, ui } from '../state';
import { chart, spark, donut } from '../charts';
import { CATS, CAT } from '../../data/categories';
import { REGION } from '../../data/core';
import { TECH_BY_ID } from '../../data/research';
import { rivalSummary } from '../../sim/rivals';
import type { Rival, CatId, GameState } from '../../sim/types';

const sel = () => (ui.sel.competitors ||= { rival: null as string | null, cat: 'smartphone' as CatId });
const relLabel = (v: number) => (v < -40 ? ['Hostile', 'bad'] : v < -12 ? ['Cold', 'warn'] : v > 40 ? ['Allied', 'good'] : v > 12 ? ['Friendly', 'good'] : ['Neutral', '']);
function totalRev(s: GameState) { let t = mo(s); for (const r of s.rivals) if (r.status === 'active') t += rivalSummary(s, r).revMonth; return t; }
const mo = (s: GameState) => s.fin.ledger.last.rev || s.fin.ledger.m.rev * (30 / Math.max(1, (s.day % 30) + 1));

function leaderboard(s: GameState): string {
  const tot = totalRev(s) || 1; const me = mo(s);
  const rows = s.rivals.filter(r => r.status === 'active').map(r => ({ r, sum: rivalSummary(s, r) })).sort((a, b) => b.sum.revMonth - a.sum.revMonth);
  const items: { sort: number; html: string[]; cls: string }[] = rows.map(({ r, sum }) => {
    const [rl, rc] = relLabel(r.relation);
    return { sort: sum.revMonth, cls: 'cmp-row', html: [`<div class="cmp-name">${logo(r.logo, r.color, 28)}<div><b>${esc(r.name)}</b><small>${esc(r.archetype)} · ${REGION[r.hq].short}</small></div></div>`,
      `<span class="num">${money(sum.revMonth)}</span>`, `<span class="num">${(sum.revMonth / tot * 100).toFixed(1)}%</span>`, `<span class="num">${money(r.valuation)}</span>`, `<span class="num">${num(r.headcount, 0)}</span>`, bar(r.brand, 100, scoreColor(r.brand), '', 5), spark(r.revHist.slice(-18), r.color, 70, 22), `<span class="num ${r.growth >= 0 ? 'pos' : 'neg'}">${(r.growth * 100).toFixed(0)}%</span>`, badge(rl, rc), btn('Intel', 'cmp-open', { id: r.id }, 'sm')] };
  });
  items.push({ sort: me, cls: 'cmp-row me', html: [`<div class="cmp-name">${logo(s.co.logo, s.co.color, 28)}<div><b>${esc(s.co.name)}</b><small>You · ${REGION[s.co.hq].short}</small></div></div>`, `<span class="num">${money(me)}</span>`, `<span class="num">${(me / tot * 100).toFixed(2)}%</span>`, `<span class="num">${money(s.derived.valuation)}</span>`, `<span class="num">${num(s.derived.headcount, 0)}</span>`, bar(s.derived.brand, 100, scoreColor(s.derived.brand), '', 5), spark(s.fin.ledger.hist.slice(-18).map(p => p.rev), s.co.color, 70, 22), `<span class="num">${(s.derived.growth * 100).toFixed(0)}%</span>`, badge('You', 'info'), ''] });
  items.sort((a, b) => b.sort - a.sort);
  return `<table class="tbl"><thead><tr><th>#  Company</th><th class="r">Revenue/mo</th><th class="r">Share</th><th class="r">Valuation</th><th class="r">Staff</th><th>Brand</th><th>Trend</th><th class="r">Growth</th><th>Attitude</th><th></th></tr></thead><tbody>${items.map((it, i) => `<tr class="${it.cls}"><td>${i + 1}. ${it.html[0]}</td>${it.html.slice(1).map((c, j) => `<td class="${[0, 1, 2, 3].includes(j) || j === 6 ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function raceChart(s: GameState): string {
  const top = s.rivals.filter(r => r.status === 'active').sort((a, b) => b.revEma - a.revEma).slice(0, 5);
  return chart('cmp-race', () => ({
    type: 'line', fmt: v => money(v), legend: true, series: [...top.map(r => ({ name: r.short, color: r.color, data: r.revHist.slice(-24) })), { name: s.co.name, color: '#ffffff', data: s.fin.ledger.hist.slice(-24).map(p => p.rev), width: 2.4 }],
  }), 200);
}

function detail(s: GameState, id: string): string {
  const r = s.rivals.find(x => x.id === id); if (!r) return `<div class="mbody">Unknown company.</div>`;
  const sum = rivalSummary(s, r); const [rl, rc] = relLabel(r.relation); const live = s.products.filter(p => p.status === 'live');
  const prods = Object.keys(r.offers).map(c => {
    const cat = c as CatId; const o = r.offers[cat]!; const mine = live.find(p => p.cat === cat);
    return [`${CAT[cat].icon} ${CAT[cat].name}`, esc(o.name), `<div style="width:90px">${bar(o.q, 100, scoreColor(o.q), '', 5)}</div>`, `<span class="num">${o.q.toFixed(0)}${mine ? ` <small class="${mine.q >= o.q ? 'pos' : 'neg'}">vs ${mine.q.toFixed(0)}</small>` : ''}</span>`, `<span class="num">${money(o.price, 2)}${mine ? ` <small class="${mine.price <= o.price ? 'pos' : 'neg'}">vs ${money(mine.price, 2)}</small>` : ''}</span>`, `<span class="num">${((sum.shares[cat] || 0) * 100).toFixed(1)}%</span>`];
  });
  const logs = r.log.slice(-12).reverse();
  return `<div class="mhead"><div>${logo(r.logo, r.color, 46)}</div><div><small>${esc(r.archetype)} · ${REGION[r.hq].name} · est. ${r.founded}</small><h2>${esc(r.name)} ${r.status !== 'active' ? badge(r.status, 'bad') : ''}</h2></div></div>
  <div class="mbody"><p class="dim">${esc(r.blurb)}</p>
  <div class="kpis mb">${kpi('Revenue / mo', money(sum.revMonth), `Net ${money(r.netM)}`)}${kpi('Valuation', money(r.valuation), r.kind === 'startup' ? 'Private' : `$${r.px.toFixed(2)}/sh`)}${kpi('Cash', money(r.cash), r.debt > 0 ? `Debt ${money(r.debt)}` : 'No debt')}${kpi('Staff', int(r.headcount), `R&D ${money(r.rd)}/mo`)}</div>
  <div class="grid g2 mb"><div><div class="stat-row"><span>Brand strength</span><b>${r.brand.toFixed(0)}</b></div><div class="stat-row"><span>Global reach</span><b>${(r.reach * 100).toFixed(0)}%</b></div><div class="stat-row"><span>Attitude to you</span><span>${badge(rl, rc)}</span></div><div class="stat-row"><span>Market sentiment</span><b>${r.sentiment.toFixed(0)}/100</b></div></div>
  <div><div class="kl">Strengths</div><div class="pill-list good mb">${r.strengths.map(x => `<span>${esc(x)}</span>`).join('')}</div><div class="kl">Weaknesses</div><div class="pill-list bad">${r.weaknesses.map(x => `<span>${esc(x)}</span>`).join('')}</div></div></div>
  ${r.techGrant ? `<p>${badge('Acquisition prize', 'purple')} Owns breakthrough research in <b>${esc(TECH_BY_ID[r.techGrant]?.name || r.techGrant)}</b>${r.forSale ? ' — reportedly open to offers' : ''}.</p>` : ''}
  <h4 class="kl">Product portfolio</h4>${prods.length ? table(['Category', 'Product', 'Quality', '', 'Price', 'Share'], prods, '', ['', '', '', 'r', 'r', 'r']) : empty('No products')}
  <h4 class="kl" style="margin-top:14px">Revenue history</h4>${chart('cmp-rev-' + r.id, () => ({ type: 'line', fmt: v => money(v), legend: false, series: [{ name: 'Revenue', color: r.color, data: r.revHist.slice(-36), fill: true }] }), 130)}
  <h4 class="kl" style="margin-top:14px">Recent activity</h4><div class="tl">${logs.length ? logs.map(l => `<div class="${l.kind}"><small>${fmtDay(l.day)}</small>${esc(l.text)}</div>`).join('') : '<div class="dim">Quiet so far.</div>'}</div></div>
  <div class="mfoot">${r.status === 'active' ? btn('Acquisition options →', 'cmp-corp', {}, 'ghost') : ''}${btn('Close', 'modal-close', {}, 'primary')}</div>`;
}

function categories(s: GameState): string {
  const q = sel(); const active = CATS.filter(c => Object.values(s.market.cats[c.id].shares).some(v => v > 0) || s.rivals.some(r => r.offers[c.id]));
  const cat = (active.find(c => c.id === q.cat) || active[0] || CATS[0]).id; const m = s.market.cats[cat];
  const owners: { id: string; name: string; color: string; share: number }[] = [];
  for (const [k, v] of Object.entries(m.shares)) { if (v <= 0.0005) continue; const r = s.rivals.find(x => x.id === k); owners.push(k === 'player' ? { id: k, name: s.co.name, color: s.co.color, share: v } : k === 'gen' ? { id: k, name: 'Generic / no-name', color: '#5d687c', share: v } : { id: k, name: r?.name || k, color: r?.color || '#888', share: v }); }
  owners.sort((a, b) => b.share - a.share);
  const offers = s.rivals.filter(r => r.status === 'active' && r.offers[cat]).map(r => ({ r, o: r.offers[cat]! })).sort((a, b) => b.o.q - a.o.q);
  const mine = s.products.filter(p => p.status === 'live' && p.cat === cat);
  return `<div class="chips mb">${active.map(c => `<button class="chip ${c.id === cat ? 'on' : ''}" data-act="cmp-cat" data-id="${c.id}">${c.icon} ${c.name}</button>`).join('')}</div>
  <div class="grid g2">${panel(`${CAT[cat].icon} ${CAT[cat].name} — revenue share`, `<div class="donut-wrap">${donut(owners.map(o => ({ label: o.name, value: o.share, color: o.color })), 150)}<div class="legend col">${owners.slice(0, 9).map(o => `<span><i style="background:${o.color}"></i>${esc(o.name)} <b class="num">${(o.share * 100).toFixed(1)}%</b></span>`).join('')}</div></div>
    <div class="stat-row mt"><span>Market size / yr</span><b class="num">${num(m.size)} units</b></div><div class="stat-row"><span>Growth</span><b class="num">${(m.growth * 100).toFixed(1)}%</b></div><div class="stat-row"><span>Avg quality · frontier</span><b class="num">${m.avgQ.toFixed(0)} · ${m.frontierQ.toFixed(0)}</b></div><div class="stat-row"><span>Revenue (30d)</span><b class="num">${money(m.rev30)}</b></div>`)}
  ${panel('Offerings', offers.length || mine.length ? table(['Company', 'Product', 'Quality', 'Price', 'Rel.'], [...mine.map(p => [`<b>${esc(s.co.name)}</b>`, esc(p.name), `<span class="num">${p.q.toFixed(0)}</span>`, `<span class="num">${money(p.price, 2)}</span>`, `<span class="num">${p.rel.toFixed(0)}</span>`]), ...offers.map(({ r, o }) => [esc(r.short), esc(o.name), `<span class="num">${o.q.toFixed(0)}</span>`, `<span class="num">${money(o.price, 2)}</span>`, `<span class="num">${o.rel.toFixed(0)}</span>`])], '', ['', '', 'r', 'r', 'r']) : empty('Nobody sells this yet', 'A first-mover opportunity.'))}</div>`;
}

function startups(s: GameState): string {
  const list = s.rivals.filter(r => r.kind === 'startup' && r.status === 'active').sort((a, b) => b.valuation - a.valuation);
  if (!list.length) return empty('No startups on the radar', 'New ventures emerge regularly.');
  return `<p class="dim mb">Startups are acquisition targets: they bring technology, talent and products. Make offers from <b>Corporate M&amp;A</b>.</p><div class="grid g3">${list.map(r => { const c = Object.keys(r.offers)[0] as CatId; const o = r.offers[c]; return `<div class="rcard"><h4>${logo(r.logo, r.color, 26)} ${esc(r.name)} ${r.forSale ? badge('For sale', 'good') : ''}</h4><small class="dim">${esc(r.blurb)}</small>
    <div class="stat-row"><span>Valuation</span><b class="num">${money(r.valuation)}</b></div><div class="stat-row"><span>Cash / runway</span><b class="num">${money(r.cash)}</b></div><div class="stat-row"><span>Staff</span><b class="num">${int(r.headcount)}</b></div>${o ? `<div class="stat-row"><span>${c ? CAT[c].name : ''} quality</span><b class="num">${o.q.toFixed(0)} · innov ${o.inn.toFixed(0)}</b></div>` : ''}
    ${r.techGrant ? `<div class="stat-row"><span>Research prize</span><b>${esc(TECH_BY_ID[r.techGrant]?.name || '')}</b></div>` : ''}<div class="row between mt">${btn('Intel', 'cmp-open', { id: r.id }, 'sm')}${btn('Make offer', 'cmp-corp', {}, 'sm primary')}</div></div>`; }).join('')}</div>`;
}

function activity(s: GameState): string {
  const all: { day: number; r: Rival; text: string; kind: string }[] = []; for (const r of s.rivals) for (const l of r.log) all.push({ day: l.day, r, text: l.text, kind: l.kind });
  all.sort((a, b) => b.day - a.day); const l = all.slice(0, 40);
  return l.length ? `<div class="panel"><div class="pb tl">${l.map(x => `<div class="${x.kind}"><small>${fmtDay(x.day)}</small><b style="color:${x.r.color}">${esc(x.r.short)}</b> ${esc(x.text)}</div>`).join('')}</div></div>` : empty('No activity yet', 'Advance time to see competitors move.');
}

registerView({
  id: 'competitors', title: 'Competitors', icon: '🏁', group: 'market', order: 3,
  render: () => {
    const s = S(); const t = curTab('competitors', 'board'); const act = s.rivals.filter(r => r.status === 'active');
    const hostile = act.filter(r => r.relation < -30).length;
    let body = '';
    if (t === 'board') body = `<div class="kpis mb">${kpi('Active rivals', String(act.filter(r => r.kind === 'major').length), `${act.filter(r => r.kind === 'startup').length} startups`)}${kpi('Rival revenue / mo', money(act.reduce((a, r) => a + r.revEma, 0)), 'all competitors')}${kpi('Your rank', '#' + (1 + act.filter(r => rivalSummary(s, r).revMonth > mo(s)).length), `of ${act.length + 1} companies`)}${kpi('Hostile', String(hostile), 'rivals targeting you')}</div>
      ${panel('Revenue race (monthly)', raceChart(s))}<div class="mt">${panel('Industry leaderboard', leaderboard(s), '', 'flat')}</div>`;
    else if (t === 'cats') body = categories(s); else if (t === 'startups') body = startups(s); else body = activity(s);
    return pageHead('Competitive Intelligence', 'Real businesses with their own strategies — they launch, undercut, raise money, acquire startups and sometimes collapse.') + tabs('competitors', [['board', 'Leaderboard'], ['cats', 'By category'], ['startups', 'Startup radar'], ['feed', 'Activity feed']]) + body;
  },
  badge: () => { const n = S().rivals.filter(r => r.status === 'active' && r.relation < -30).length; return n || null; },
});
registerActions({
  'cmp-open': el => { const id = el.dataset.id!; sel().rival = id; app.openModal('rival', () => detail(S(), sel().rival!), true); },
  'cmp-cat': el => { sel().cat = el.dataset.id as CatId; },
  'cmp-corp': () => { app.closeModal(); app.go('corporate'); },
});
