import { registerView, registerActions, panel, kpi, btn, badge, bar, money, num, pct, esc, app, fmtDay, logo, sgn, stars } from '../kit';
import { chart } from '../charts';
import { ui, S } from '../state';
import { CATS, CAT } from '../../data/categories';
import { STAGES, REGION } from '../../data/core';
import { TECH_BY_ID } from '../../data/research';
import { fmtDate, MONTHS, dateOf } from '../../sim/util';
import { opexTotal } from '../../sim/ledger';
import * as ach from '../../sim/achievements';
import { monthlyBurn } from '../../sim/finance';
import type { GameState } from '../../sim/types';
import './dashboard.css';

const lab = (s: GameState, d: number) => { const t = dateOf(d); return `${MONTHS[t.m]} '${String(t.y).slice(2)}`; };
function series(s: GameState, f: (h: GameState['hist'][number]) => number, n = 48) { return s.hist.slice(-n).map(f); }

function checklist(s: GameState): string {
  const items: [string, boolean][] = [
    ['Hire a researcher or engineer', s.people.emps.length > (s.flags.startEmps ?? 0) || s.people.emps.some(e => e.dept === 'research')],
    ['Start designing a product', s.products.length > 0],
    ['Queue a research project', s.research.active.length > 0 || Object.keys(s.research.done).length > 6],
    ['Launch your first product', s.products.some(p => p.status === 'live' || p.status === 'retired')],
    ['Run a marketing campaign', s.marketing.campaigns.length > 0 || s.marketing.history.length > 3],
    ['Reach monthly profit', s.fin.ledger.hist.some(h => h.ni > 0)],
  ];
  if (items.every(i => i[1])) return '';
  return panel('Getting started', items.map(([t, d]) => `<div class="chk ${d ? 'done' : ''}"><i>${d ? '✓' : ''}</i><span>${t}</span></div>`).join(''));
}
function opportunities(s: GameState): string {
  const mine = new Set(s.products.filter(p => p.status === 'live').map(p => p.cat));
  const ops: { icon: string; t: string; sub: string; act?: string; id?: string }[] = [];
  const cands = CATS.filter(c => s.market.cats[c.id].unlocked && !mine.has(c.id)).map(c => { const cm = s.market.cats[c.id]; const rivals = s.rivals.filter(r => r.status === 'active' && r.offers[c.id]).length; const val = cm.size * cm.ref * (c.sub ? 6 : 1); return { c, cm, rivals, score: (val / 1e9) * (1 + cm.growth * 3 + cm.trend) / (1 + rivals * 0.5) }; }).sort((a, b) => b.score - a.score).slice(0, 3);
  for (const o of cands) ops.push({ icon: o.c.icon, t: `${o.c.name} market`, sub: `${money(o.cm.size * o.cm.ref * (o.c.sub ? 6 : 1))}/yr · +${pct(o.cm.growth, 0)} growth · ${o.rivals} rivals${o.cm.trend > .3 ? ' · trending 🔥' : ''}`, act: 'go', id: 'products' });
  const locked = CATS.filter(c => !s.market.cats[c.id].unlocked).map(c => ({ c, miss: c.req.filter(r => !s.research.done[r]) })).filter(x => x.miss.length === 1 && TECH_BY_ID[x.miss[0]].req.every(r => s.research.done[r])).slice(0, 2);
  for (const l of locked) ops.push({ icon: '🔬', t: `Unlock ${l.c.name}`, sub: `Research ${TECH_BY_ID[l.miss[0]].name} to enter a ${money(s.market.cats[l.c.id].size * s.market.cats[l.c.id].ref)}/yr market`, act: 'go', id: 'research' });
  for (const r of s.rivals) if (r.status === 'active' && r.forSale && r.kind === 'startup') { ops.push({ icon: '🤝', t: `${r.name} is for sale`, sub: `Startup · valued ${money(r.valuation)}`, act: 'go', id: 'corporate' }); break; }
  return ops.length ? ops.map(o => `<div class="opp"><span class="pc-ic">${o.icon}</span><div style="flex:1"><b>${esc(o.t)}</b><small>${esc(o.sub)}</small></div>${o.act ? btn('→', o.act, { v: o.id! }, 'ghost sm') : ''}</div>`).join('') : '<p class="dim">No clear gaps — you are competing everywhere you can.</p>';
}


interface Tip { sev: 'bad' | 'warn' | 'info'; text: string; view: string; label: string }
function advisor(s: GameState): string {
  const tips: Tip[] = []; const burn = monthlyBurn(s); const runway = burn > 0 ? s.fin.cash / burn : Infinity;
  if (runway < 3) tips.push({ sev: 'bad', text: `Cash runway is only ${runway.toFixed(1)} months. Raise money, cut costs or launch something that sells.`, view: 'finance', label: 'Finance' });
  else if (runway < 6) tips.push({ sev: 'warn', text: `Runway is ${runway.toFixed(1)} months — consider a loan or funding round before it gets tight.`, view: 'finance', label: 'Finance' });
  for (const p of s.products) {
    if (p.status === 'dev' && !s.people.emps.some(e => e.project === p.id)) tips.push({ sev: 'warn', text: `${p.name} has no team — development is paused.`, view: 'products', label: 'Assign team' });
    else if (p.stalled) tips.push({ sev: 'warn', text: `${p.name} ran out of budget and is stalled.`, view: 'products', label: 'Top up' });
    else if (p.status === 'prototype') tips.push({ sev: 'info', text: `${p.name} has a prototype ready for your review.`, view: 'products', label: 'Review' });
    else if (p.status === 'ready') tips.push({ sev: 'info', text: `${p.name} is ready — set the price and launch it.`, view: 'products', label: 'Launch' });
    else if (p.status === 'live' && p.satisf < 40 && p.base + p.unitsEma * 30 > 500) tips.push({ sev: 'warn', text: `${p.name} customers are unhappy (${p.rating.toFixed(1)}★). Patch bugs or release an update.`, view: 'products', label: 'Fix' });
    else if (p.status === 'live' && p.lost30 > p.sold30 * 0.2 && p.lost30 > 0) tips.push({ sev: 'info', text: `${p.name} is capacity-constrained — build factories / data centres or outsource.`, view: 'facilities', label: 'Facilities' });
  }
  if (!s.products.some(p => ['dev', 'prototype', 'testing', 'ready'].includes(p.status)) && s.fin.cash > 150000) tips.push({ sev: 'info', text: s.products.length ? 'Nothing is in development. New launches and updates keep you ahead of the market.' : 'You have not started a product yet — that is where revenue comes from.', view: 'products', label: 'New product' });
  if (s.research.active.length < s.research.slots && s.fin.cash > 200000) tips.push({ sev: 'info', text: 'A research lab slot is idle. Queue a technology to raise your spec ceilings.', view: 'research', label: 'Research' });
  if (s.derived.officeCap > 0 && s.derived.headcount > s.derived.officeCap) tips.push({ sev: 'warn', text: `Over office capacity (${s.derived.headcount}/${s.derived.officeCap}) — morale and productivity suffer.`, view: 'facilities', label: 'Expand' });
  if (s.products.some(p => p.status === 'live') && Object.values(s.marketing.awareness).reduce((a, b) => a + b, 0) / 7 < 12 && !s.marketing.campaigns.length && s.fin.cash > 100000) tips.push({ sev: 'info', text: 'Awareness is very low — people cannot buy what they have not heard of. Run a campaign.', view: 'marketing', label: 'Marketing' });
  const risk = s.people.emps.filter(e => e.heads === 1 && e.happy < 35).length; if (risk) tips.push({ sev: 'warn', text: `${risk} employee${risk > 1 ? 's are' : ' is'} unhappy and may quit.`, view: 'people', label: 'People' });
  if (s.meta.missions.some(m => m.done && !m.claimed)) tips.push({ sev: 'info', text: 'You have mission rewards to claim.', view: 'achievements', label: 'Claim' });
  if (s.co.ceo.perkPoints > 0) tips.push({ sev: 'info', text: `You have ${s.co.ceo.perkPoints} unspent CEO perk point${s.co.ceo.perkPoints > 1 ? 's' : ''}.`, view: 'achievements', label: 'Perks' });
  if (!tips.length) return '';
  const order = { bad: 0, warn: 1, info: 2 } as const; tips.sort((a, b) => order[a.sev] - order[b.sev]);
  return panel('Advisor', tips.slice(0, 5).map(t => `<div class="tip-row ${t.sev}"><span>${t.sev === 'bad' ? '🚨' : t.sev === 'warn' ? '⚠️' : '💡'}</span><p>${esc(t.text)}</p>${btn(t.label, 'go', { v: t.view }, 'ghost sm')}</div>`).join(''));
}

registerView({
  id: 'dashboard', title: 'CEO Dashboard', icon: '📊', group: 'command', order: -1,
  render: () => {
    const s = S(); const d = s.derived; const L = s.fin.ledger.last; const M = s.fin.ledger.m;
    const rev = L.rev || M.rev; const exp = L.cogs + opexTotal(L); const ni = L.ni;
    const live = s.products.filter(p => p.status === 'live');
    const rp = s.research.active[0]; const rtName = rp ? TECH_BY_ID[rp.id].name : ''; const rt = rp ? `${(rp.progress / TECH_BY_ID[rp.id].rp * 100).toFixed(0)}%` : 'Idle';
    const stage = STAGES[d.stage - 1];
    const hero = `<div class="hero" style="--c:${s.co.color}">${logo(s.co.logo, s.co.color, 56)}<div><h1>${esc(s.co.name)}</h1><small>${esc(s.co.slogan)} · CEO ${esc(s.co.founder)} · ${esc(s.co.city)}</small><div class="stagebar">${STAGES.map(x => `<i class="${x.n < d.stage ? 'on' : x.n === d.stage ? 'cur' : ''}" title="${x.name}"></i>`).join('')}</div><small>Stage ${d.stage}: <b style="color:var(--text)">${stage.name}</b> — ${stage.blurb}</small></div>
      <div class="hm"><div><span>Date</span><b class="num">${fmtDate(s.day)}</b></div><div><span>Live products</span><b class="num">${live.length}</b></div><div><span>Regions</span><b class="num">${Object.values(s.regions).filter(r => r.presence > 5).length}</b></div><div><span>Reputation</span><b class="num">${s.marketing.reputation.toFixed(0)}</b></div></div></div>`;
    const kp = `<div class="kpis mb">
      ${kpi('Cash', money(s.fin.cash), s.fin.cash < 0 ? '<span class="neg">OVERDRAWN</span>' : runway(s))}
      ${kpi('Valuation', money(d.valuation), s.stock.public ? `Market cap ${money(d.mcap)}` : 'Private')}
      ${kpi('Revenue / mo', money(rev), `${d.growth >= 0 ? '+' : ''}${(d.growth * 100).toFixed(0)}% YoY`)}
      ${kpi('Expenses / mo', money(exp), `payroll ${money(d.payroll)}`)}
      ${kpi('Net profit / mo', `<span class="${ni >= 0 ? 'pos' : 'neg'}">${money(ni)}</span>`, `margin ${rev > 0 ? (ni / rev * 100).toFixed(0) : 0}%`)}
      ${kpi('Employees', num(d.headcount, 0), `capacity ${num(d.officeCap, 0)}`)}
      ${kpi('Market share', pct(d.marketShare, 1), `${live.length} live product${live.length === 1 ? '' : 's'}`)}
      ${kpi('Stock price', s.stock.public ? `$${s.stock.px.toFixed(2)}` : '—', s.stock.public ? `sentiment ${s.stock.sentiment.toFixed(0)}` : 'Not public')}
      ${kpi('Research', rt, rp ? `${esc(rtName)}${s.research.active.length > 1 ? ` +${s.research.active.length - 1}` : ''}` : `${Object.keys(s.research.done).length} techs · ${s.research.patents.length} patents`)}
    </div>`;
    const cp = (id: string, title: string, cfg: () => any, val: string) => `<div class="panel cpanel"><header><h3>${title}</h3><span class="cval">${val}</span></header><div class="pb">${chart('d-' + id, cfg, 150)}</div></div>`;
    const lbl = s.hist.slice(-48).map(h => lab(s, h.day));
    const charts = `<div class="charts">
      ${cp('rev', 'Revenue', () => ({ series: [{ name: 'Revenue', color: '#4cc9f0', data: series(s, h => h.rev), fill: true }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: money, zero: true, legend: false }), money(rev))}
      ${cp('exp', 'Expenses', () => ({ series: [{ name: 'Expenses', color: '#ff7a8a', data: series(s, h => h.exp), fill: true }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: money, zero: true, legend: false }), money(exp))}
      ${cp('pnl', 'Profit & loss', () => ({ type: 'bar', series: [{ name: 'Net income', color: '#2ee6a6', data: series(s, h => h.ni) }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: money, legend: false }), `<span class="${ni >= 0 ? 'pos' : 'neg'}">${money(ni)}</span>`)}
      ${cp('val', 'Company valuation', () => ({ series: [{ name: 'Valuation', color: '#c77dff', data: series(s, h => h.val), fill: true }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: money, legend: false }), money(d.valuation))}
      ${cp('px', s.stock.public ? 'Stock price' : 'Stock price (private)', () => ({ series: [{ name: 'Price', color: '#ffb703', data: s.stock.public ? s.stock.pxHist.slice(-250) : series(s, h => h.val / Math.max(1, s.fin.shares)), fill: true }], fmt: (v: number) => "$" + v.toFixed(2), legend: false }), s.stock.public ? `$${s.stock.px.toFixed(2)}` : 'implied')}
      ${cp('share', 'Market share', () => ({ series: [{ name: 'Share', color: '#2ee6a6', data: series(s, h => h.share * 100), fill: true }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: (v: number) => v.toFixed(2) + '%', zero: true, legend: false }), pct(d.marketShare, 2))}
      ${cp('cf', 'Cash flow & balance', () => ({ series: [{ name: 'Cash', color: '#6ea8ff', data: series(s, h => h.cash), fill: true }, { name: 'Operating CF', color: '#2ee6a6', data: series(s, h => h.cfo) }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: money }), money(s.fin.cash))}
      ${cp('emp', 'Employee growth', () => ({ series: [{ name: 'Employees', color: '#ff9f68', data: series(s, h => h.emp), fill: true }], labels: s.hist.slice(-48).map(h => lab(s, h.day)), fmt: (v: number) => num(v, 0), zero: true, legend: false }), num(d.headcount, 0))}
    </div>`;
    // right column
    const objs = (() => { try { return (ach as any).objectivesForDashboard?.(s) as { title: string; desc: string; progress: number }[] | undefined; } catch { return undefined; } })() || s.meta.missions.filter(m => !m.done).slice(0, 4).map(m => ({ title: m.title, desc: m.desc, progress: 0 }));
    const objHtml = objs.length ? objs.map(o => `<div class="obj"><b>${esc(o.title)}</b><small>${esc(o.desc)}</small>${bar((o.progress || 0) * 100, 100, 'var(--accent)', '', 4)}</div>`).join('') : '<p class="dim">All current objectives complete.</p>';
    const pend = s.events.pending.filter(e => !e.resolved && e.choices.length);
    const pendHtml = pend.length ? pend.map(e => `<div class="opp"><span class="pc-ic">${e.icon}</span><div style="flex:1"><b>${esc(e.title)}</b><small>${e.deadline > s.day ? `${e.deadline - s.day} days left` : 'Awaiting decision'}</small></div>${btn('Decide', 'decide', {}, 'warn sm')}</div>`).join('') : '<p class="dim">No pending decisions.</p>';
    const news = s.events.news.slice(-6).reverse().map(n => `<div class="fi ${n.tone}"><small>${fmtDay(n.day)} · ${n.kind}</small><b>${esc(n.headline)}</b></div>`).join('') || '<p class="dim">Quiet on the wires…</p>';
    const rlog = s.rivals.flatMap(r => r.log.slice(-3).map(l => ({ ...l, r }))).sort((a, b) => b.day - a.day).slice(0, 6).map(l => `<div class="fi"><small>${fmtDay(l.day)}</small><b style="color:${l.r.color}">${esc(l.r.short || l.r.name)}</b> <span class="dim">${esc(l.text)}</span></div>`).join('') || '<p class="dim">Rivals are quiet for now.</p>';
    const right = `<div class="col">${advisor(s)}${checklist(s)}${panel('Objectives', objHtml, btn('All', 'go', { v: 'achievements' }, 'ghost sm'))}${panel('Pending decisions', pendHtml)}${panel('Market opportunities', opportunities(s))}${panel('Breaking news', news, btn('News', 'go', { v: 'news' }, 'ghost sm'))}${panel('Competitor activity', rlog, btn('Intel', 'go', { v: 'competitors' }, 'ghost sm'))}</div>`;
    return hero + kp + `<div class="dgrid"><div>${charts}</div>${right}</div>`;
  },
});
function runway(s: GameState): string {
  const burn = monthlyBurn(s); if (burn <= 0) return '<span class="pos">cash-flow positive</span>';
  const months = s.fin.cash / burn; return `runway ${months > 60 ? '5y+' : months.toFixed(1) + ' mo'}`;
}
