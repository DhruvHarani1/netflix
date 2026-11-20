import './marketing.css';
import { registerView, registerActions, registerInputs, pageHead, panel, empty, table, money, bar, badge, btn, kpi, esc, fmtDay, app, scoreColor } from '../kit';
import { S, ui } from '../state';
import { chart } from '../charts';
import { SEGS, SEG, REGIONS, REGION } from '../../data/core';
import { CHANNELS, CH, estimateReach, launchCampaign, stopCampaign, PR_ACTIONS, prCost, runPR } from '../../sim/marketing';
import { fmtMonth, avg } from '../../sim/util';
import type { Channel, RegionId, GameState } from '../../sim/types';

interface Draft { ch: Channel; v: number; months: number; product: number | null; region: RegionId | 'all' }
const D = (): Draft => (ui.sel.marketing ||= { ch: 'social', v: 45, months: 3, product: null, region: 'all' } as Draft);
const budgetOf = (v: number) => { const raw = 1000 * Math.pow(1e5, v / 100); const p = Math.pow(10, Math.floor(Math.log10(raw)) - 1); return Math.round(raw / p) * p; };
const fitColor = (f: number) => (f >= 0 ? `rgba(46,230,166,${Math.min(.65, f * .5)})` : `rgba(255,93,115,${Math.min(.65, -f * .9)})`);

function builder(s: GameState): string {
  const d = D(); const budget = budgetOf(d.v); const est = estimateReach(s, { channel: d.ch, budget, months: d.months, product: d.product, region: d.region });
  const prods = s.products.filter(p => p.status !== 'retired');
  const chBtn = CHANNELS.map(c => `<button class="chcard ${c.id === d.ch ? 'on' : ''}" data-act="mk-ch" data-id="${c.id}"><span class="ci">${c.icon}</span><b>${c.name}</b><small>${c.desc}</small></button>`).join('');
  const rows = SEGS.map(g => { const dv = est.seg[g]; return `<div class="awrow"><span>${SEG[g].icon} ${SEG[g].name}</span>${bar(s.marketing.awareness[g] + Math.max(0, dv), 100, dv < 0 ? 'var(--bad)' : 'var(--accent)', '', 7)}<span class="d ${dv >= 0 ? 'pos' : 'neg'}">${dv >= 0 ? '+' : ''}${dv.toFixed(1)} pts</span></div>`; }).join('');
  const sp = d.product != null ? prods.find(p => p.id === d.product) : null;
  return `<div class="chcards mb">${chBtn}</div>
  <div class="grid g2"><div class="col">
    <label class="slider"><span>Monthly budget</span><input type="range" min="0" max="100" step="1" value="${d.v}" data-input="mk-v" data-change="mk-commit"><b class="num" data-for="mk-v">${money(budget)}</b></label>
    <label class="slider"><span>Duration</span><input type="range" min="1" max="24" step="1" value="${d.months}" data-input="mk-m" data-change="mk-commit"><b class="num" data-for="mk-m">${d.months} mo</b></label>
    <label class="slider"><span>Target product</span><select data-change="mk-prod" style="flex:1"><option value="">Whole brand</option>${prods.map(p => `<option value="${p.id}" ${p.id === d.product ? 'selected' : ''}>${esc(p.name)} (${p.status})</option>`).join('')}</select></label>
    <label class="slider"><span>Region</span><select data-change="mk-region" style="flex:1"><option value="all">All regions with presence</option>${REGIONS.map(r => `<option value="${r.id}" ${r.id === d.region ? 'selected' : ''}>${r.name} (${s.regions[r.id].presence.toFixed(0)}% presence)</option>`).join('')}</select></label>
    <div class="stat-row"><span>Total cost</span><b class="num">${money(est.cost)}</b></div><div class="stat-row"><span>Audience</span><b class="num">${(est.aud * 100).toFixed(1)}% of world</b></div>
    ${sp ? `<div class="stat-row"><span>Hype for ${esc(sp.name)}</span><b class="num pos">+${est.promo.toFixed(0)}</b></div>` : ''}
    ${d.ch !== 'pr' && SEG.premium.mediaFit[d.ch] < 0 && s.marketing.positioning > .15 ? `<p class="neg sm">⚠ This channel reads as discount advertising and will erode your premium customers' perception.</p>` : ''}
    ${btn(`🚀 Launch ${CH[d.ch].name} campaign`, 'mk-launch', {}, 'primary block')}</div>
  <div><div class="kl">Forecast awareness gain by segment</div>${rows}</div></div>`;
}
function fitMatrix(s: GameState): string {
  const d = D();
  return `<table class="fit"><thead><tr><th></th>${SEGS.map(g => `<th title="${SEG[g].name}">${SEG[g].icon}<br>${SEG[g].name.split(' ')[0]}</th>`).join('')}</tr></thead><tbody>${CHANNELS.map(c => `<tr class="${c.id === d.ch ? 'sel' : ''}"><td class="l">${c.icon} ${c.name}</td>${SEGS.map(g => { const f = SEG[g].mediaFit[c.id] ?? 0; return `<td style="background:${fitColor(f)}">${f > 0 ? '+' : ''}${f.toFixed(1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="dim sm">Green = amplifies awareness; red = <i>harms</i> that segment (e.g. influencer ads cheapen premium brands).</p>`;
}
function status(s: GameState): string {
  const m = s.marketing; const pos = (m.positioning + 1) / 2 * 100;
  const awr = SEGS.map(g => `<div class="awrow"><span>${SEG[g].icon} ${SEG[g].name}</span>${bar(m.awareness[g], 100, 'var(--accent)', '', 7)}<span class="d">${m.awareness[g].toFixed(1)}%</span></div>`).join('');
  return `<div class="kpis mb">${kpi('Brand strength', s.derived.brand.toFixed(0), 'blended index')}${kpi('Reputation', m.reputation.toFixed(0), bar(m.reputation, 100, scoreColor(m.reputation), '', 4))}${kpi('Loyalty', m.loyalty.toFixed(0), bar(m.loyalty, 100, scoreColor(m.loyalty), '', 4))}${kpi('Avg awareness', avg(SEGS.map(g => m.awareness[g])).toFixed(1) + '%', 'across segments')}${kpi('Spend / mo', money(m.campaigns.reduce((a, c) => a + c.budget, 0)), `${m.campaigns.length} campaigns`)}</div>
  <div class="grid g2">${panel('Awareness by segment', awr)}${panel('Market positioning', `<div class="posbar"><i style="left:${pos}%"></i></div><div class="row between dim sm" style="margin-top:6px"><span>Budget</span><span>${m.positioning > .25 ? 'Premium brand' : m.positioning < -.25 ? 'Value brand' : 'Mainstream'}</span><span>Premium</span></div><p class="dim sm mt">Positioning follows your product prices relative to market reference. Premium positioning rewards event/PR/sponsorship campaigns; discount channels hurt it.</p>${chart('mk-hist', () => ({ type: 'line', legend: true, min: 0, labels: m.history.map(h => fmtMonth(h.day)), series: [{ name: 'Reputation', color: '#2ee6a6', data: m.history.map(h => h.reputation) }, { name: 'Awareness', color: '#4cc9f0', data: m.history.map(h => h.awareness) }] }), 150)}`)}</div>`;
}
function active(s: GameState): string {
  const cs = s.marketing.campaigns; if (!cs.length) return empty('No active campaigns', 'Build one above — marketing costs nothing until you launch.');
  return table(['Campaign', 'Region', 'Budget/mo', 'Ends', ''], cs.map(c => [`${CH[c.channel].icon} ${esc(c.name)}`, c.region === 'all' ? 'All' : REGION[c.region].name, `<span class="num">${money(c.budget)}</span>`, `${fmtDay(c.end)} <small class="dim">(${Math.max(0, c.end - s.day)}d)</small>`, btn('Stop', 'mk-stop', { id: c.id }, 'sm bad')]), '', ['', '', 'r', '', 'r']);
}
function pr(s: GameState): string {
  return `<div class="prgrid">${PR_ACTIONS.map(a => { const cd = Math.max(0, a.cooldown - (s.day - (s.flags['pr_' + a.id] ?? -9999))); return `<div class="prcard"><b>${a.icon} ${a.name}</b><small class="dim">${a.desc}</small><div class="row between"><span class="num">${money(prCost(s, a.id))}</span>${btn(cd ? `Cooldown ${cd}d` : 'Run', 'mk-pr', { id: a.id }, 'sm primary', cd > 0)}</div></div>`; }).join('')}</div>`;
}

registerView({
  id: 'marketing', title: 'Marketing', icon: '📣', group: 'market', order: 2,
  render: () => { const s = S(); return pageHead('Marketing & Brand', 'Awareness decides who can even consider your product. Different segments react very differently to the same ad.') + `<div class="col" style="gap:14px">${status(s)}${panel('Campaign builder', builder(s))}<div class="grid g2">${panel('Segment × channel fit', fitMatrix(s))}${panel('Active campaigns', active(s), '', 'flat')}</div>${panel('Public relations & brand actions', pr(s))}</div>`; },
  badge: () => null,
});
const msg = (r: { ok: boolean; msg: string }) => app.toast(r.msg, r.ok ? 'good' : 'warn');
registerInputs({
  'mk-v': el => { const d = D(); d.v = +el.value; const o = document.querySelector('[data-for="mk-v"]'); if (o) o.textContent = money(budgetOf(d.v)); },
  'mk-m': el => { const d = D(); d.months = +el.value; const o = document.querySelector('[data-for="mk-m"]'); if (o) o.textContent = d.months + ' mo'; },
});
registerActions({
  'mk-ch': el => { D().ch = el.dataset.id as Channel; }, 'mk-commit': () => {},
  'mk-prod': el => { const v = (el as HTMLSelectElement).value; D().product = v === '' ? null : +v; },
  'mk-region': el => { D().region = (el as HTMLSelectElement).value as any; },
  'mk-launch': () => { const d = D(); const r = launchCampaign(S(), { channel: d.ch, budget: budgetOf(d.v), months: d.months, product: d.product, region: d.region }); if (!r.ok) { app.toast(r.msg, 'warn'); app.sfx('error'); } },
  'mk-stop': el => { stopCampaign(S(), +el.dataset.id!); app.toast('Campaign stopped', 'info'); },
  'mk-pr': el => { const r = runPR(S(), el.dataset.id!); if (!r.ok) { app.toast(r.msg, 'warn'); app.sfx('error'); } },
});
