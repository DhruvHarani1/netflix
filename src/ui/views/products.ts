import { confetti, registerView, registerActions, registerInputs, pageHead, panel, kpi, btn, badge, bar, table, tabs, curTab, empty, money, num, int, pct, esc, app, scoreColor, stars, tip } from '../kit';
import { chart } from '../charts';
import { ui, S } from '../state';
import { CATS, CAT, CAT_GROUPS, specValue, specQuality, type CatDef } from '../../data/categories';
import { SEGS, SEG, SPEC, DEPT } from '../../data/core';
import { TECH_BY_ID, TAG_NAMES } from '../../data/research';
import * as P from '../../sim/products';
import { unlocked } from '../../sim/market';
import { clamp, fmtDate, pick } from '../../sim/util';
import type { Product, CatId, Seg, GameState } from '../../sim/types';
import './products.css';

interface Wiz { cat: CatId | null; target: Seg; specs: Record<string, number>; budget: number; budgetMul: number; name: string; outsource: boolean; step: number }
const st = () => (ui.sel.products ||= { wiz: null as Wiz | null, sel: null as number | null, upd: null as any }) as { wiz: Wiz | null; sel: number | null; upd: null | { specs: Record<string, number>; budgetMul: number } };
const NAMEA = ['Aurora', 'Helix', 'Nimbus', 'Vertex', 'Pulse', 'Orion', 'Zephyr', 'Atlas', 'Lumen', 'Echo', 'Quasar', 'Nova', 'Titan', 'Vega', 'Prime', 'Apex'];
const NAMEB = ['One', 'X', 'Pro', 'Air', 'Max', 'Edge', 'Core', 'Studio', 'Go', 'Flow', 'Ultra', 'Lite'];
const STATUS: Record<string, [string, string]> = { dev: ['In development', 'info'], prototype: ['Prototype', 'purple'], testing: ['Testing', 'warn'], ready: ['Ready to launch', 'good'], live: ['Live', 'good'], retired: ['Retired', ''] };

// ------------------------------------------------------------------ helpers
function wizPreview(s: GameState, w: Wiz) {
  const cat = CAT[w.cat!]; const emps = s.people.emps.filter(e => (P.ASSIGNABLE as readonly string[]).includes(e.dept) && (!e.project || P.getProduct(s, e.project)?.status === 'live'));
  const eng = s.people.emps.filter(e => e.dept === 'eng'); const skill = eng.length ? eng.reduce((a, e) => a + e.skill * e.heads, 0) / eng.reduce((a, e) => a + e.heads, 0) : 50;
  const rec = P.recommendedBudget(s, cat, w.specs); const ratio = w.budget / rec;
  const ev = P.evaluate(s, cat, w.specs, { teamSkill: skill, budgetRatio: ratio, pmShare: 0.08, bugs: 15 });
  const price = P.recommendedPrice(s, cat, w.target, ev.q, ev.ucost); const need = P.devPointsNeeded(s, cat, w.specs);
  const out = emps.reduce((a, e) => a + (e.dept === 'eng' ? 1 : e.dept === 'pm' ? .35 : .3) * e.heads * (e.skill / 100) * e.prod * (0.55 + 0.45 * e.happy / 100) * (0.6 + 0.4 * e.motiv / 100), 0);
  const cm = s.market.cats[cat.id];
  return { cat, rec, ratio, ev, price, need, out, days: out > 0 ? Math.ceil(need / out) : Infinity, cm, margin: (price - ev.ucost * (w.outsource ? (cat.sub ? 1.25 : 1.18) : 1)) / price, skill };
}
function priceBenchmarks(s: GameState, cat: CatId) {
  const rows: { name: string; q: number; price: number; mine?: boolean }[] = [];
  for (const r of s.rivals) { const o = r.offers[cat]; if (r.status === 'active' && o) rows.push({ name: `${r.short || r.name} ${o.name}`, q: o.q, price: o.price }); }
  for (const p of s.products) if (p.status === 'live' && p.cat === cat) rows.push({ name: p.name, q: p.q, price: p.price, mine: true });
  return rows.sort((a, b) => b.q - a.q);
}

// ------------------------------------------------------------------- views
function portfolio(s: GameState): string {
  const groups: [string, Product[]][] = [['In development', s.products.filter(p => ['dev', 'prototype', 'testing', 'ready'].includes(p.status))], ['Live products', s.products.filter(p => p.status === 'live')], ['Retired', s.products.filter(p => p.status === 'retired')]];
  const card = (p: Product) => {
    const c = CAT[p.cat]; const [sl, sc] = STATUS[p.status]; const prog = p.status === 'dev' ? p.progress / p.need : p.status === 'testing' ? p.testProg / Math.max(1, p.testNeed) : p.status === 'prototype' || p.status === 'ready' ? 1 : 1;
    const live = p.status === 'live';
    return `<button class="pcard ${live ? 'live' : ''}" data-act="p-open" data-id="${p.id}"><div class="pc-top"><span class="pc-ic">${c.icon}</span><div><b>${esc(p.name)}</b><small>${c.name} · v${p.version}</small></div>${badge(sl, sc)}</div>
    ${live ? `<div class="pc-stats"><div><span>Revenue / mo</span><b class="num">${money(p.revEma * 30)}</b></div><div><span>${c.sub ? 'Subscribers' : 'Units / mo'}</span><b class="num">${num(c.sub ? p.base : p.unitsEma * 30)}</b></div><div><span>Rating</span><b>${stars(p.rating)}</b></div></div>` : p.status === 'retired' ? `<div class="pc-stats"><div><span>Lifetime revenue</span><b class="num">${money(p.lifeRev)}</b></div></div>` : `${bar(prog * 100, 100, p.stalled ? 'var(--bad)' : 'var(--accent)', `${p.updating ? 'Update' : STATUS[p.status][0]} · ${(prog * 100).toFixed(0)}%${p.stalled ? ' · OUT OF BUDGET' : ''}`)}<div class="pc-stats"><div><span>Budget used</span><b class="num">${money(p.spent)} / ${money(p.budget)}</b></div><div><span>Team</span><b>${s.people.emps.filter(e => e.project === p.id).reduce((a, e) => a + e.heads, 0)}</b></div></div>`}</button>`;
  };
  let h = '';
  for (const [t, list] of groups) if (list.length) h += `<h3 class="sect">${t}</h3><div class="pgrid">${list.map(card).join('')}</div>`;
  if (!s.products.length) h = panel('No products yet', empty('Your first product is your first big bet.', 'Design a product, assign engineers and fund it. Software ships fastest; hardware earns more per sale but needs manufacturing.') + `<div style="text-align:center;padding-bottom:20px">${btn('✦ Design your first product', 'p-new', {}, 'primary xl')}</div>`);
  return h;
}

function wizard(s: GameState, w: Wiz): string {
  // step 1: choose category
  if (!w.cat) {
    return `<p class="dim mb">Choose what to build. Categories you haven’t unlocked need research first.</p>` + CAT_GROUPS.map(g => `<h3 class="sect">${g}</h3><div class="pgrid cats">${CATS.filter(c => c.group === g).map(c => {
      const un = unlocked(s, c.id); const cm = s.market.cats[c.id]; const nrv = s.rivals.filter(r => r.status === 'active' && r.offers[c.id]).length;
      return `<button class="catcard ${un ? '' : 'locked'}" data-act="w-cat" data-id="${c.id}" ${un ? '' : 'disabled'}><div class="cc-h"><span class="pc-ic">${c.icon}</span><b>${c.name}</b></div><small>${c.desc}</small><div class="cc-m"><span>Market <b class="num">${money(cm.size * cm.ref * (c.sub ? 8 : 1))}/yr</b></span><span>Growth <b>${pct(cm.growth, 0)}</b></span><span>Rivals <b>${nrv}</b></span></div>${un ? `<em>${c.cls === 'hw' ? 'Hardware' : c.cls === 'sw' ? 'Software' : 'Service'} · dev ≈ ${money(c.dev * .35)}–${money(c.dev)}</em>` : `<em class="lock">🔒 Needs: ${P.hasPrereqs(s, c.id).join(', ')}</em>`}</button>`;
    }).join('')}</div>`).join('');
  }
  const cat = CAT[w.cat]; const pv = wizPreview(s, w);
  const specRows = cat.specs.map(sp => { const cap = P.levelCap(s, sp.tag); const v = Math.min(w.specs[sp.key], cap); const tech = Object.values(TECH_BY_ID).find(t => !s.research.done[t.id] && t.tags.includes(sp.tag) && t.req.every(r => s.research.done[r]));
    return `<div class="specrow"><div class="sp-l"><b>${sp.label}</b><small>${TAG_NAMES[sp.tag]} tech · cap ${cap}${cap < 10 && tech ? ` · next: ${tech.name}` : ''}</small></div><input type="range" min="1" max="10" step="1" value="${v}" data-input="w-spec" data-key="${sp.key}" data-change="w-commit" style="--cap:${cap * 10}%"><div class="sp-v num" data-sv="${sp.key}"><b>${specValue(sp, v)}</b><small>L${v}${v >= cap ? ' · max' : ''}</small></div></div>`; }).join('');
  const needTeam = pv.out <= 0;
  return `<div class="wiz"><div class="wiz-main">
    <div class="row between"><div class="row"><span class="pc-ic xl">${cat.icon}</span><div><h2>${cat.name}</h2><small class="dim">${cat.desc}</small></div></div>${btn('← Change category', 'w-back', {}, 'ghost sm')}</div>
    <h3 class="sect">1 · Target customers</h3><div class="chips">${SEGS.filter(g => cat.seg[g] > 0.03).map(g => `<button class="chip ${w.target === g ? 'on' : ''}" data-act="w-target" data-id="${g}" title="${esc(SEG[g].blurb)}">${SEG[g].icon} ${SEG[g].name.replace(' Consumers', '')} <small>${(cat.seg[g] * 100).toFixed(0)}%</small></button>`).join('')}</div><p class="dim sm">${SEG[w.target].blurb}</p>
    <h3 class="sect">2 · Specifications ${tip('Higher levels raise quality but also unit cost, dev time and budget. Caps rise as you research technologies.')}</h3><div class="specs">${specRows}</div>
    <h3 class="sect">3 · Budget & production</h3>
    <label class="slider"><span>Development budget</span><input type="range" min="0.3" max="1.8" step="0.05" value="${w.budgetMul}" data-input="w-budget" data-change="w-commit"><b class="num" data-bv>${money(w.budget)}</b></label>
    <p class="dim sm">Recommended <b class="num">${money(pv.rec)}</b>. Under-funding rushes development: more bugs and lower quality. Over-funding adds polish with diminishing returns.</p>
    ${cat.cls !== 'sw' ? `<label class="check"><input type="checkbox" data-change="w-outsource" ${w.outsource ? 'checked' : ''}> <span><b>${cat.cls === 'hw' ? 'Contract manufacturing' : 'Cloud-hosted'}</b> — no facilities needed, ${cat.cls === 'hw' ? '+18% unit cost, capacity ramps slowly' : '+25% serving cost, scales instantly'}. Untick to use your own ${cat.cls === 'hw' ? 'factories' : 'data centres'} (build them under Facilities).</span></label>` : ''}
    <h3 class="sect">4 · Name</h3><div class="row"><input data-input="w-name" value="${esc(w.name)}" maxlength="28" placeholder="Product name" style="flex:1"><button class="btn" data-act="w-rand">🎲</button></div>
  </div>
  <aside class="wiz-side" id="wiz-preview">${previewHtml(s, w, pv, needTeam)}</aside></div>`;
}
function previewHtml(s: GameState, w: Wiz, pv: ReturnType<typeof wizPreview>, needTeam: boolean) {
  const cat = pv.cat; const bench = priceBenchmarks(s, cat.id).slice(0, 4);
  return panel('Projected outcome', `
    <div class="pv-q"><div class="gauge" style="--v:${pv.ev.q};--c:${scoreColor(pv.ev.q)}"><b class="num">${pv.ev.q.toFixed(0)}</b><small>quality</small></div>
    <div class="pv-b"><div class="stat-row"><span>Market average</span><b class="num">${pv.cm.avgQ.toFixed(0)}</b></div><div class="stat-row"><span>Market frontier</span><b class="num">${pv.cm.frontierQ.toFixed(0)}</b></div><div class="stat-row"><span>Innovation</span><b class="num">${pv.ev.inn.toFixed(0)}</b></div><div class="stat-row"><span>Reliability</span><b class="num">${pv.ev.rel.toFixed(0)}</b></div></div></div>
    <div class="stat-row"><span>Unit cost ${cat.sub ? '/ user / mo' : ''}</span><b class="num">$${pv.ev.ucost.toFixed(pv.ev.ucost < 10 ? 2 : 0)}</b></div>
    <div class="stat-row"><span>Suggested price</span><b class="num">$${pv.price.toFixed(pv.price < 10 ? 2 : 0)}</b></div>
    <div class="stat-row"><span>Gross margin at suggested</span><b class="num ${pv.margin > .3 ? 'pos' : pv.margin < .1 ? 'neg' : ''}">${(pv.margin * 100).toFixed(0)}%</b></div>
    <div class="stat-row"><span>Dev effort</span><b class="num">${int(pv.need)} person-days</b></div>
    <div class="stat-row"><span>Est. time with free staff</span><b class="num">${isFinite(pv.days) ? `${pv.days} days` : '—'}</b></div>
    <div class="stat-row"><span>Dev budget</span><b class="num">${money(w.budget)}</b></div>
    ${needTeam ? `<div class="warnbox">You have no free engineers. Hire people first (People → Hiring) — a team is required to make progress.</div>` : ''}
    ${s.fin.cash < w.budget * 0.15 ? `<div class="warnbox">Cash ${money(s.fin.cash)} is below the 15% kickoff reserve (${money(w.budget * .15)}).</div>` : ''}
    ${bench.length ? `<h4 class="mini">Rival benchmarks</h4>${bench.map(b => `<div class="stat-row"><span>${esc(b.name)}</span><b class="num">Q${b.q.toFixed(0)} · $${b.price.toFixed(b.price < 10 ? 2 : 0)}</b></div>`).join('')}` : ''}
    <div style="margin-top:14px">${btn('Create product →', 'w-create', {}, 'primary block')}</div>`);
}
function stepper(p: Product): string {
  const steps = [['dev', 'Develop'], ['prototype', 'Prototype'], ['testing', 'Test'], ['ready', 'Price'], ['live', 'Live']]; const idx = steps.findIndex(x => x[0] === p.status);
  return `<div class="stepper">${steps.map(([k, l], i) => `<div class="step ${i < idx || p.status === 'live' && i <= idx ? 'done' : i === idx ? 'cur' : ''}"><i>${i < idx ? '✓' : i + 1}</i><span>${l}</span></div>`).join('<em></em>')}</div>`;
}
function teamPanel(s: GameState, p: Product): string {
  const team = P.teamOf(s, p.id); const tm = P.teamOutput(s, p);
  const free = s.people.emps.filter(e => !e.project && (P.ASSIGNABLE as readonly string[]).includes(e.dept) && (e.dept !== 'mfg' || CAT[p.cat].cls === 'hw'));
  return panel(`Team <span class="dim">· ${tm.out.toFixed(1)} person-days/day</span>`, `
    ${team.length ? `<table class="tbl"><tbody>${team.map(e => `<tr><td><b>${esc(e.name)}${e.heads > 1 ? ` <small>×${e.heads}</small>` : ''}</b><br><small class="dim">${esc(e.title)}</small></td><td class="r num">skill ${e.skill.toFixed(0)}</td><td class="r">${btn('✕', 'p-unassign', { id: e.id }, 'ghost sm')}</td></tr>`).join('')}</tbody></table>` : `<div class="warnbox">No team assigned — development is paused.</div>`}
    ${free.length ? `<h4 class="mini">Available staff</h4><div class="chips">${free.slice(0, 14).map(e => `<button class="chip" data-act="p-assign" data-id="${e.id}" data-pid="${p.id}">+ ${esc(e.name.split(' ')[0])} <small>${DEPT[e.dept].name} · ${e.skill.toFixed(0)}</small></button>`).join('')}</div>${btn('Auto-assign everyone free', 'p-auto', { id: p.id }, 'sm mt')}` : `<p class="dim sm">No unassigned engineers, PMs or manufacturing staff. Hire more in People.</p>`}`);
}
function detail(s: GameState, p: Product): string {
  const c = CAT[p.cat]; const [sl, sc] = STATUS[p.status]; const tm = P.teamOutput(s, p); const cm = s.market.cats[p.cat];
  const head = `<div class="row between mb"><div class="row">${btn('← Products', 'p-close', {}, 'ghost sm')}<span class="pc-ic xl">${c.icon}</span><div><h1>${esc(p.name)} <small class="dim">v${p.version}</small></h1><small class="dim">${c.name} · target ${SEG[p.target].name}</small></div></div><div class="row">${badge(sl, sc)}${p.status !== 'retired' ? btn(p.status === 'live' ? 'Retire' : 'Cancel', 'p-retire', { id: p.id }, 'bad sm') : ''}</div></div>${p.status !== 'retired' ? stepper(p) : ''}`;
  let body = '';
  const attrs = `<div class="attrs">${[['Quality', p.q], ['Reliability', p.rel], ['UX', p.ux], ['Innovation', p.inn]].map(([l, v]) => `<div><span>${l}</span><b class="num" style="color:${scoreColor(v as number)}">${(v as number) ? (v as number).toFixed(0) : '—'}</b>${bar(v as number, 100, scoreColor(v as number), '', 4)}</div>`).join('')}</div>`;
  if (p.status === 'dev' || p.updating) {
    const eta = tm.out > 0 ? Math.ceil((p.need - p.progress) / tm.out) : null;
    body = `<div class="grid g21"><div class="col">${panel(p.updating ? `Version ${p.version + 1} update` : 'Development', `${bar((p.progress / p.need) * 100, 100, p.stalled ? 'var(--bad)' : 'var(--accent)', `${(p.progress / p.need * 100).toFixed(1)}% · ${int(p.progress)} / ${int(p.need)} person-days · ${eta ? `ETA ${eta} days (${fmtDate(s.day + eta)})` : 'no team'}`, 10)}
      <div class="kpis mt">${kpi('Budget', money(p.budget), `${money(p.spent)} spent`)}${kpi('Burn / day', money(tm.out > 0 ? p.budget * tm.out / p.need : 0))}${kpi('Team skill', p.teamSkill.toFixed(0), `${tm.heads} people`)}${kpi('Budget ratio', `${(p.budgetRatio * 100).toFixed(0)}%`, p.budgetRatio < .8 ? 'rushed — bug risk' : 'healthy')}</div>
      ${p.stalled ? `<div class="warnbox">Budget exhausted — progress paused. ${btn('Add 25% budget', 'p-topup', { id: p.id, mul: .25 }, 'sm warn')} ${btn('Add 50%', 'p-topup', { id: p.id, mul: .5 }, 'sm')}</div>` : `<div class="row mt">${btn('+ $ 25% budget', 'p-topup', { id: p.id, mul: .25 }, 'sm')}${btn('+ 50% budget', 'p-topup', { id: p.id, mul: .5 }, 'sm')}</div>`}`)}
      ${p.updating ? '' : panel('Design', specTable(p))}</div><div class="col">${teamPanel(s, p)}</div></div>`;
  } else if (p.status === 'prototype') {
    body = `<div class="grid g2">${panel('Prototype review', `<p>${esc(p.protoNote)}</p><div class="choices"><button class="choice" data-act="p-test" data-id="${p.id}"><b>Begin QA testing</b><small>Removes most bugs (~${int(p.testNeed)} person-days, ~6% of budget). Recommended.</small></button><button class="choice" data-act="p-skip" data-id="${p.id}"><b>Skip testing</b><small>Launch sooner, but shipped bugs hurt reviews and reliability.</small></button><button class="choice" data-act="p-rework" data-id="${p.id}"><b>Another iteration</b><small>Return to development for ~20% more work and +10% budget.</small></button></div>`)}${teamPanel(s, p)}</div>`;
  } else if (p.status === 'testing') {
    const lvl = p.bugs > 35 ? ['High', 'var(--bad)'] : p.bugs > 15 ? ['Medium', 'var(--warn)'] : ['Low', 'var(--good)'];
    body = `<div class="grid g2">${panel('QA testing', `${bar(p.testProg / p.testNeed * 100, 100, 'var(--warn)', `${(p.testProg / p.testNeed * 100).toFixed(0)}% of test plan`, 10)}<div class="stat-row mt"><span>Defect density</span><b style="color:${lvl[1]}">${lvl[0]}</b></div><div class="stat-row"><span>QA spend</span><b class="num">${money(p.qaSpent)}</b></div><p class="dim sm">Test facilities (Facilities → Testing) speed QA up.</p>`)}${teamPanel(s, p)}</div>`;
  } else if (p.status === 'ready') {
    const bench = priceBenchmarks(s, p.cat); const lo = Math.max(c.ref * .25, p.ucost * 1.0), hi = c.ref * 4; const step = Math.max(0.01, +(c.ref / 200).toFixed(2));
    body = `<div class="grid g21">${panel('Pricing & launch', `${attrs}<div class="mt"><label class="slider"><span>Price${c.sub ? ' / month' : ''}</span><input type="range" min="${lo.toFixed(2)}" max="${hi.toFixed(2)}" step="${step}" value="${p.price}" data-input="p-price" data-id="${p.id}" data-change="p-price-commit"><b class="num" data-pv>$${p.price.toFixed(p.price < 10 ? 2 : 0)}</b></label></div>
      <div class="stat-row"><span>Unit cost</span><b class="num">$${(p.ucost * (p.outsource ? (c.sub ? 1.25 : 1.18) : 1)).toFixed(p.ucost < 10 ? 2 : 0)}</b></div><div class="stat-row"><span>Margin at this price</span><b class="num ${p.price > p.ucost * 1.3 ? 'pos' : 'neg'}" data-pm>${((1 - p.ucost * (p.outsource ? 1.18 : 1) / p.price) * 100).toFixed(0)}%</b></div><div class="stat-row"><span>Suggested</span><b class="num">$${P.recommendedPrice(s, c, p.target, p.q, p.ucost).toFixed(2)}</b></div>
      <p class="dim sm">Known bugs: ${p.bugs > 30 ? '<b class="neg">significant</b>' : p.bugs > 12 ? 'some' : 'few'}. ${SEG[p.target].name} expect a price near $${(cm.ref * SEG[p.target].priceMult).toFixed(0)}.</p><div class="mt">${btn('🚀 Launch ' + esc(p.name), 'p-launch', { id: p.id }, 'primary xl')}</div>`)}
      ${panel('Competitive landscape', bench.length ? `<table class="tbl"><tbody>${bench.map(b => `<tr class="${b.mine ? 'me' : ''}"><td>${esc(b.name)}</td><td class="r num">Q${b.q.toFixed(0)}</td><td class="r num">$${b.price.toFixed(b.price < 10 ? 2 : 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="dim">No direct rivals yet.</p>')}</div>`;
  } else if (p.status === 'live') {
    const rev30 = p.revEma * 30; const margin = rev30 > 0 ? 1 - (p.ucost * (p.outsource ? 1.18 : 1) * (c.sub ? p.base : p.unitsEma * 30)) / rev30 : 0;
    const bench = priceBenchmarks(s, p.cat); const lo = Math.max(c.ref * .25, p.ucost), hi = c.ref * 4; const step = Math.max(0.01, +(c.ref / 200).toFixed(2));
    const u = st().upd;
    body = `<div class="kpis mb">${kpi('Revenue / month', money(rev30), `lifetime ${money(p.lifeRev)}`)}${kpi(c.sub ? 'Subscribers' : 'Units / month', num(c.sub ? p.base : p.unitsEma * 30), c.sub ? `+${num(p.unitsEma * 30)} / mo` : `lifetime ${num(p.lifeUnits)}`)}${kpi('Rating', stars(p.rating), `${p.rating.toFixed(1)} · satisfaction ${p.satisf.toFixed(0)}`)}${kpi('Gross margin', pct(margin, 0), `$${p.price.toFixed(p.price < 10 ? 2 : 0)} price`)}${kpi('Category share', pct(cm.shares[ 'player'] ? (p.revEma * 30) / Math.max(1, cm.rev30) : 0, 1), `${c.name} market`)}</div>
    ${p.rampLimited ? `<div class="infobox">📈 <b>Sales are ramp-limited</b> (cap ${num(p.rampCap || 0)}/day). Awareness and word-of-mouth cap how fast a new product spreads — marketing, regional presence and satisfaction raise the ceiling.</div>` : ''}
    ${p.lost30 > p.sold30 * .15 && p.lost30 > 0 ? `<div class="warnbox">⚠ Capacity shortfall — losing sales you could make. ${p.outsource ? 'Contract capacity is ramping slowly; consider your own factories.' : 'Expand your factories or data centres in Facilities.'}</div>` : ''}
    <div class="grid g21"><div class="col">${panel('Sales history', chart(`p-hist-${p.id}`, () => ({ type: 'line', series: [{ name: 'Revenue / mo', color: 'var(--accent)', data: p.hist.map(h => h.rev), fill: true }], labels: p.hist.map(h => fmtDate(h.day).slice(0, 6)), fmt: money, zero: true }), 190), `${p.hist.length} months`)}
    ${panel('Customer reviews', p.reviews.length ? `<div class="reviews">${p.reviews.slice(-8).reverse().map(r => `<div class="rev"><span class="stars">${stars(r.stars)}</span><b>${r.who === 'press' ? 'Press' : SEG[r.who as Seg].name}</b><p>“${esc(r.text)}”</p><small>${fmtDate(r.day)}</small></div>`).join('')}</div>` : '<p class="dim">Reviews will appear as customers buy.</p>')}</div>
    <div class="col">${panel('Controls', `${attrs}<label class="slider mt"><span>Price${c.sub ? '/mo' : ''}</span><input type="range" min="${lo.toFixed(2)}" max="${hi.toFixed(2)}" step="${step}" value="${p.price}" data-input="p-price" data-id="${p.id}" data-change="p-price-commit"><b class="num" data-pv>$${p.price.toFixed(p.price < 10 ? 2 : 0)}</b></label>
      <div class="row wrap mt">${btn('⬆ Release update', 'p-upd-open', { id: p.id }, 'primary sm', p.updating)}${btn('🩹 Patch bugs', 'p-patch', { id: p.id }, 'sm')}${c.cls !== 'sw' ? btn(p.outsource ? 'Switch to own facilities' : 'Switch to outsourcing', 'p-outsource', { id: p.id }, 'sm') : ''}</div>
      <div class="stat-row mt"><span>Bugs</span><b class="num ${p.bugs > 30 ? 'neg' : ''}">${p.bugs.toFixed(0)}</b></div><div class="stat-row"><span>Age</span><b>${Math.floor((s.day - p.launchDay) / 30)} months</b></div><div class="stat-row"><span>Market quality avg</span><b class="num">${cm.avgQ.toFixed(0)}</b></div>`)}
      ${panel('Versus rivals', bench.length ? `<table class="tbl"><tbody>${bench.map(b => `<tr class="${b.mine ? 'me' : ''}"><td>${esc(b.name)}</td><td class="r num">Q${b.q.toFixed(0)}</td><td class="r num">$${b.price.toFixed(b.price < 10 ? 2 : 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="dim">No rivals in this category.</p>')}
      ${p.updating ? teamPanel(s, p) : ''}</div></div>`;
  } else body = panel('Retired', `<p class="dim">${esc(p.name)} was retired. Lifetime revenue ${money(p.lifeRev)}.</p>`);
  return head + body;
}
function specTable(p: Product): string {
  const c = CAT[p.cat]; return `<table class="tbl"><tbody>${c.specs.map(sp => `<tr><td>${sp.label}</td><td class="r num">${specValue(sp, p.specs[sp.key])}</td><td style="width:120px">${bar(p.specs[sp.key] * 10, 100, 'var(--accent)', '', 4)}</td></tr>`).join('')}</tbody></table>`;
}
function updateModal(): string {
  const s = S(); const p = P.getProduct(s, st().sel!)!; const u = st().upd!; const c = CAT[p.cat];
  const specs: Record<string, number> = {}; for (const sp of c.specs) specs[sp.key] = Math.max(p.specs[sp.key], u.specs[sp.key] ?? p.specs[sp.key]);
  const rec = P.recommendedBudget(s, c, specs) * 0.45; const budget = rec * u.budgetMul;
  const ev = P.evaluate(s, c, specs, { teamSkill: p.teamSkill, budgetRatio: u.budgetMul, pmShare: .1, bugs: p.bugs * .5 });
  return `<div class="mhead"><span class="mi">⬆</span><div><small>${esc(p.name)}</small><h2>Release version ${p.version + 1}</h2></div></div><div class="mbody"><p class="dim">Raise spec levels (within research caps), fix half the bugs, refresh innovation and generate launch buzz. Assign a team after starting.</p>
  ${c.specs.map(sp => { const cap = P.levelCap(s, sp.tag); return `<div class="specrow"><div class="sp-l"><b>${sp.label}</b><small>now L${p.specs[sp.key]} · cap ${cap}</small></div><input type="range" min="${p.specs[sp.key]}" max="${Math.max(p.specs[sp.key], cap)}" step="1" value="${specs[sp.key]}" data-input="u-spec" data-key="${sp.key}" data-change="u-commit"><div class="sp-v num"><b>${specValue(sp, specs[sp.key])}</b></div></div>`; }).join('')}
  <label class="slider mt"><span>Budget</span><input type="range" min=".4" max="1.6" step=".05" value="${u.budgetMul}" data-input="u-budget" data-change="u-commit"><b class="num">${money(budget)}</b></label>
  <div class="stat-row"><span>Projected quality</span><b class="num">${p.q.toFixed(0)} → ${Math.max(p.q, ev.q).toFixed(0)}</b></div></div>
  <div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Start update', 'p-upd-go', { id: p.id }, 'primary')}</div>`;
}

registerView({
  id: 'products', title: 'Products', icon: '📦', group: 'build', order: 0,
  badge: () => { const s = S(); const n = s.products.filter(p => p.status === 'prototype' || p.status === 'ready' || p.stalled).length; return n || null; },
  render: () => {
    const s = S(); const z = st();
    if (z.wiz) return pageHead('New product', 'Design → fund → staff → test → price → launch', btn('Cancel', 'w-cancel', {}, 'ghost')) + wizard(s, z.wiz);
    if (z.sel != null) { const p = P.getProduct(s, z.sel); if (p) return detail(s, p); z.sel = null; }
    return pageHead('Products', 'Everything you are building, shipping and maintaining.', btn('✦ New product', 'p-new', {}, 'primary')) + portfolio(s);
  },
});

const ws = () => st().wiz!;
function rebudget(w: Wiz) { const s = S(); w.budget = Math.round((P.recommendedBudget(s, CAT[w.cat!], w.specs) * w.budgetMul) / 1000) * 1000; }
function refreshPreview() { const s = S(); const w = st().wiz; const el = document.getElementById('wiz-preview'); if (!w || !el || !w.cat) return; const pv = wizPreview(s, w); el.innerHTML = previewHtml(s, w, pv, pv.out <= 0); }
registerInputs({
  'w-spec': el => { const w = ws(); const k = el.dataset.key!; const cap = P.levelCap(S(), CAT[w.cat!].specs.find(x => x.key === k)!.tag); let v = +el.value; if (v > cap) { v = cap; el.value = String(cap); } w.specs[k] = v; rebudget(w); const sp = CAT[w.cat!].specs.find(x => x.key === k)!; const o = document.querySelector(`[data-sv="${k}"]`); if (o) o.innerHTML = `<b>${specValue(sp, v)}</b><small>L${v}${v >= cap ? ' · max' : ''}</small>`; const b = document.querySelector('[data-bv]'); if (b) b.textContent = money(w.budget); refreshPreview(); },
  'w-budget': el => { const w = ws(); w.budgetMul = +el.value; rebudget(w); const b = document.querySelector('[data-bv]'); if (b) b.textContent = money(w.budget); refreshPreview(); },
  'w-name': el => { ws().name = el.value; },
  'p-price': el => { const s = S(); const p = P.getProduct(s, +el.dataset.id!)!; p.price = +el.value; const o = document.querySelector('[data-pv]'); if (o) o.textContent = `$${p.price.toFixed(p.price < 10 ? 2 : 0)}`; const m = document.querySelector('[data-pm]'); if (m) m.textContent = `${((1 - p.ucost * (p.outsource ? 1.18 : 1) / p.price) * 100).toFixed(0)}%`; },
  'u-spec': el => { const u = st().upd!; u.specs[el.dataset.key!] = +el.value; },
  'u-budget': el => { st().upd!.budgetMul = +el.value; },
});
const commit = (el: HTMLElement) => { (el as HTMLElement).blur(); };
const top = () => { const v = document.getElementById('view'); if (v) v.scrollTop = 0; };
registerActions({
  'w-commit': commit, 'p-price-commit': commit, 'u-commit': el => { commit(el); app.openModal('upd', updateModal); },
  'w-outsource': el => { ws().outsource = (el as HTMLInputElement).checked; },
  'p-new': () => { top(); const s = S(); st().wiz = { cat: null, target: 'mainstream', specs: {}, budget: 0, budgetMul: 1, name: '', outsource: true, step: 0 }; st().sel = null; },
  'w-cancel': () => { st().wiz = null; }, 'w-back': () => { ws().cat = null; top(); },
  'w-cat': el => { top(); const s = S(); const w = ws(); const cat = CAT[el.dataset.id as CatId]; w.cat = cat.id; w.specs = P.defaultSpecs(s, cat); w.target = (SEGS.filter(g => cat.seg[g] > 0.03).sort((a, b) => cat.seg[b] - cat.seg[a])[0]) as Seg; w.budgetMul = 1; w.outsource = cat.cls !== 'sw' ? true : false; w.name = `${pick(s, NAMEA)} ${pick(s, NAMEB)}`; rebudget(w); },
  'w-target': el => { ws().target = el.dataset.id as Seg; }, 'w-rand': () => { ws().name = `${pick(S(), NAMEA)} ${pick(S(), NAMEB)}`; },
  'w-create': () => { top(); const s = S(); const w = ws(); const r = P.createProduct(s, { cat: w.cat!, name: w.name, target: w.target, specs: w.specs, budget: w.budget, outsource: w.outsource }); app.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) { st().wiz = null; st().sel = r.id!; P.autoAssign(s, r.id!); app.sfx('success'); } else app.sfx('error'); },
  'p-open': el => { top(); st().sel = +el.dataset.id!; }, 'p-close': () => { st().sel = null; },
  'p-assign': el => { const r = P.assign(S(), +el.dataset.pid!, +el.dataset.id!); if (!r.ok) app.toast(r.msg, 'warn'); },
  'p-unassign': el => { P.unassign(S(), +el.dataset.id!); }, 'p-auto': el => { const r = P.autoAssign(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'p-topup': el => { const s = S(); const p = P.getProduct(s, +el.dataset.id!)!; const r = P.topUpBudget(s, p.id, p.budget * +el.dataset.mul!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'p-test': el => { const r = P.startTesting(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); }, 'p-skip': el => { app.confirm('Skip QA?', 'Untested products ship with their bugs. Reviews and reliability will suffer.', () => { P.skipTesting(S(), +el.dataset.id!); }, 'Skip testing'); },
  'p-rework': el => { const r = P.rework(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'info' : 'warn'); },
  'p-launch': el => {
    const s = S(); const pid = +el.dataset.id!; const r = P.launch(s, pid);
    if (!r.ok) { app.toast(r.msg, 'warn'); app.sfx('error'); return; }
    app.openModal('launch', () => {
      const p = P.getProduct(s, pid)!; const c = CAT[p.cat]; const rv = p.reviews[0];
      return '<div class="celebrate">' + confetti() + '<div class="big">' + c.icon + '</div><small class="dim">NEW PRODUCT LAUNCH</small><h2>' + esc(p.name) + '</h2><div class="stars">' + (rv ? stars(rv.stars) : '') + '</div><p class="dim">' + (rv ? '“' + esc(rv.text) + '” — launch press' : '') + '</p><div class="mstats"><div><span>Quality</span><b class="num">' + p.q.toFixed(0) + '</b></div><div><span>Price</span><b class="num">$' + p.price.toFixed(p.price < 10 ? 2 : 0) + '</b></div><div><span>Market avg</span><b class="num">' + s.market.cats[p.cat].avgQ.toFixed(0) + '</b></div></div></div><div class="mfoot">' + btn('View product', 'modal-close', {}, 'primary') + '</div>';
    });
  },
  'p-patch': el => { const r = P.patchBugs(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'p-outsource': el => { const s = S(); const p = P.getProduct(s, +el.dataset.id!)!; const r = P.setOutsource(s, p.id, !p.outsource); app.toast(r.msg, 'info'); },
  'p-retire': el => app.confirm('Retire product?', 'Sales stop immediately and subscribers are lost. This cannot be undone.', () => { P.retire(S(), +el.dataset.id!); st().sel = null; }, 'Retire'),
  'p-upd-open': el => { const p = P.getProduct(S(), +el.dataset.id!)!; st().upd = { specs: { ...p.specs }, budgetMul: 1 }; app.openModal('upd', updateModal); },
  'p-upd-go': el => { const s = S(); const p = P.getProduct(s, +el.dataset.id!)!; const u = st().upd!; const rec = P.recommendedBudget(s, CAT[p.cat], u.specs) * 0.45; const r = P.startUpdate(s, p.id, { specs: u.specs, budget: rec * u.budgetMul }); app.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) { app.closeModal(); P.autoAssign(s, p.id); } },
});
