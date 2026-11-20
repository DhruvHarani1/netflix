import { registerView, registerActions, panel, kpi, btn, badge, bar, money, num, pct, esc, app, fmtDay, logo, sgn, stars } from '../kit';
import { chart } from '../charts';
import { ui, S } from '../state';
import { CATS, CAT } from '../../data/categories';
import { STAGES, REGION } from '../../data/core';
import { TECH_BY_ID } from '../../data/research';
import { fmtDate, MONTHS, dateOf } from '../../sim/util';
import { opexTotal } from '../../sim/ledger';
import * as ach from '../../sim/achievements';
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

registerView({
  id: 'dashboard', title: 'CEO Dashboard', icon: '📊', group: 'command', order: -1,
  render: () => {
    const s = S(); const d = s.derived; const L = s.fin.ledger.last; const M = s.fin.ledger.m;
    const rev = L.rev || M.rev; const exp = L.cogs + opexTotal(L); const ni = L.ni;
    const live = s.products.filter(p => p.status === 'live');
    const rp = s.research.active[0]; const rt = rp ? (() => { const t = TECH_BY_ID[rp.id]; return `${t.name} ${(rp.progress / t.rp * 100).toFixed(0)}%`; })() : 'Idle';
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
      ${kpi('Research', rt, `${Object.keys(s.research.done).length} techs · ${s.research.patents.length} patents`)}
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
    const right = `<div class="col">${checklist(s)}${panel('Objectives', objHtml, btn('All', 'go', { v: 'achievements' }, 'ghost sm'))}${panel('Pending decisions', pendHtml)}${panel('Market opportunities', opportunities(s))}${panel('Breaking news', news, btn('News', 'go', { v: 'news' }, 'ghost sm'))}${panel('Competitor activity', rlog, btn('Intel', 'go', { v: 'competitors' }, 'ghost sm'))}</div>`;
    return hero + kp + `<div class="dgrid"><div>${charts}</div>${right}</div>`;
  },
});
function runway(s: GameState): string {
  const L = s.fin.ledger.last; const burn = L.cogs + opexTotal(L) - L.rev; if (burn <= 0) return '<span class="pos">cash-flow positive</span>';
  const months = s.fin.cash / burn; return `runway ${months > 60 ? '5y+' : months.toFixed(1) + ' mo'}`;
}
