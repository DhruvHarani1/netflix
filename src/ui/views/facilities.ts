import './facilities.css';
import { registerView, registerActions, pageHead, panel, kpi, bar, badge, btn, esc, money, num, empty, app, scoreColor } from '../kit';
import { S, ui } from '../state';
import { REGIONS, REGION } from '../../data/core';
import { FACS, FAC, TRACK_INFO, type Track } from '../../data/facilities';
import { CAT } from '../../data/categories';
import * as F from '../../sim/facilities';
import type { FacKind, RegionId, Facility } from '../../sim/types';

const KC: Record<string, string> = { office: '#4cc9f0', hq: '#7c5cff', campus: '#2ee6a6', lab: '#c77dff', datacenter: '#6ea8ff', factory: '#ffb703', fab: '#ff7a00', warehouse: '#a29bfe', testing: '#ff7675' };
const bs = () => (ui.sel.fbuild ||= { kind: 'office', region: S().co.hq, level: 1 }) as { kind: FacKind; region: RegionId; level: number };
const act = (r: { ok: boolean; msg: string }) => app.toast(r.msg, r.ok ? 'good' : 'warn');

function card(f: Facility) {
  const s = S(); const d = FAC[f.kind]; const built = f.buildUntil <= s.day; const rent = F.rentOf(s, f.kind, f.region, f.level);
  const eff = d.cap[f.level - 1] ? `${num(d.cap[f.level - 1] * (1 + .2 * f.upg.capacity), 0)} seats` : '';
  const main = d.mfg ? `${num(d.mfg[f.level - 1], 0)} units/mo` : d.dc ? `${num(d.dc[f.level - 1], 0)} customers` : d.lab ? `+${(d.lab[f.level - 1] * 100).toFixed(0)}% R&D, +1 slot` : d.test ? `+${(d.test[f.level - 1] * 100).toFixed(0)}% testing` : d.warehouse ? `+${(d.warehouse[f.level - 1] * 100).toFixed(0)}% throughput` : '';
  return `<div class="fc ${built ? '' : 'build'}" style="--c:${KC[f.kind]}"><h4><span class="big">${d.icon}</span><div class="grow">${esc(f.name)}<div class="dim sm">${REGION[f.region].name} · Level ${f.level} · ${f.own ? 'Owned' : 'Leased'}</div></div>${built ? badge('Operational', 'good') : badge(`Ready in ${f.buildUntil - s.day}d`, 'warn')}</h4>
  <div class="row between sm"><span>${[eff, main].filter(Boolean).join(' · ')}</span><span class="num">${f.own ? 'Book ' + money(f.value) : money(rent) + '/mo'}</span></div>
  ${built ? d.tracks.map(t => `<div class="trk"><span>${TRACK_INFO[t].icon}</span><div><b>${TRACK_INFO[t].name}</b> <span class="dim">${TRACK_INFO[t].desc}</span><div class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i < f.upg[t] ? 'on' : ''}"></i>`).join('')}</div></div>${f.upg[t] >= 5 ? '<span class="dim">MAX</span>' : btn(money(F.upgradeCost(s, f, t)), 'fc-upg', { id: f.id, t }, 'sm')}</div>`).join('') : ''}
  <div class="row between mt">${f.own ? '<span class="dim sm">Sells for ~' + money(f.value * .9) + '</span>' : btn('Buy out lease', 'fc-buy', { id: f.id }, 'sm')}${btn(f.own ? 'Sell' : 'Terminate lease', 'fc-sell', { id: f.id }, 'bad sm')}</div></div>`;
}
function guidance() {
  const s = S(); const D = s.derived; const live = s.products.filter(p => p.status === 'live'); const hw = live.filter(p => CAT[p.cat].cls === 'hw'); const sv = live.filter(p => CAT[p.cat].cls === 'svc');
  const hwUnits = hw.reduce((a, p) => a + p.unitsEma * 30, 0); const users = sv.reduce((a, p) => a + p.base, 0); const tips: string[] = [];
  if (D.headcount > D.officeCap) tips.push(`🏢 <b>Over capacity:</b> ${D.headcount} staff for ${D.officeCap} seats. Build a larger office or HQ — crowding drains morale and output.`);
  else if (D.headcount > D.officeCap * .85) tips.push('🏢 You are near office capacity — plan an expansion before the next hiring wave.');
  if (hw.length && D.mfgCap < hwUnits) tips.push(`🏭 Hardware demand (~${num(hwUnits, 0)}/mo) exceeds owned plant capacity (${num(D.mfgCap, 0)}). You are outsourcing at a cost premium — a Manufacturing Plant would pay for itself.`);
  if (sv.length && D.dcCap < users) tips.push(`🖥️ Online services have ${num(users, 0)} customers vs. ${num(D.dcCap, 0)} owned data-centre capacity. Rented cloud costs more per customer.`);
  if (!tips.length) tips.push('✅ Capacity is healthy. <b>Rent</b> while cash is tight, <b>buy</b> when you will hold a site 5+ years, and <b>outsource</b> only for short-term spikes.');
  return panel('Capacity advisor', `<ul style="margin:0;padding-left:18px">${tips.map(t => `<li style="margin:6px 0">${t}</li>`).join('')}</ul>`);
}
function render() {
  const s = S(), D = s.derived; const fs = s.facilities; let rentM = 0, owned = 0;
  for (const f of fs) if (f.buildUntil <= s.day) { if (!f.own) rentM += F.rentOf(s, f.kind, f.region, f.level); else owned += f.value; }
  const util = D.officeCap ? D.headcount / D.officeCap * 100 : 100;
  return pageHead('Facilities & Infrastructure', 'Offices, labs, plants and data centres. Own to save at scale; rent to stay flexible; outsource to stay light.', btn('+ New facility', 'fc-open', {}, 'primary'))
    + `<div class="kpis mb">${kpi('Office utilisation', `${util.toFixed(0)}%`, `${num(D.headcount, 0)} / ${num(D.officeCap, 0)} seats`, util > 100 ? 'neg' : '')}${kpi('Manufacturing', num(D.mfgCap, 0) + '/mo', 'Hardware units (owned)')}${kpi('Service capacity', num(D.dcCap, 0), 'Customers served in-house')}${kpi('Research labs', `×${D.labBonus.toFixed(2)}`, `${s.research.slots} slot(s)`)}${kpi('Monthly rent', money(rentM), `${money(owned)} owned assets`)}</div>
    <div class="mb">${bar(util, 130, scoreColor(130 - util), `Office utilisation ${util.toFixed(0)}%`, 8)}</div><div class="grid g21"><div class="fc-grid">${fs.map(card).join('') || empty('No facilities')}</div><div>${guidance()}</div></div>`;
}
function buildModal() {
  return () => { const s = S(), z = bs(); const d = FAC[z.kind]; z.level = Math.min(z.level, d.maxLevel);
    const rent = F.rentOf(s, z.kind, z.region, z.level), price = F.priceOf(s, z.kind, z.region, z.level); const why = F.canBuild(s, z.kind);
    const bd = d.build[z.level - 1]; const yrs = 5; const ownCost = price + rent * d.energy * 12 * yrs + price * .003 * 12 * yrs - price * .5; const rentCost = rent * 12 * yrs + rent * d.energy * 12 * yrs;
    const effect = d.cap[z.level - 1] ? `${num(d.cap[z.level - 1], 0)} seats` : d.mfg ? `${num(d.mfg[z.level - 1], 0)} units/mo` : d.dc ? `${num(d.dc[z.level - 1], 0)} customers` : d.lab ? `+${(d.lab[z.level - 1] * 100).toFixed(0)}% R&D & +1 slot` : d.test ? `+${(d.test[z.level - 1] * 100).toFixed(0)}% testing` : `+${((d.warehouse?.[z.level - 1] || 0) * 100).toFixed(0)}% throughput`;
    const outs = d.mfg ? '<br><span class="dim sm">Outsourcing alternative: contract manufacturing adds ~18% to unit cost with no capacity limit.</span>' : d.dc ? '<br><span class="dim sm">Outsourcing alternative: rented cloud adds ~25% to serving cost.</span>' : '';
    return `<div class="mhead"><h2>New facility</h2></div><div class="mbody"><div class="fb-kinds">${FACS.map(k => `<button class="fb-k ${k.kind === z.kind ? 'on' : ''}" data-act="fb-kind" data-k="${k.kind}"><span>${k.icon}</span><b>${k.name}</b><small>${k.effect}</small></button>`).join('')}</div>
    <p class="dim">${d.blurb}${why ? ` <b class="neg">${why}</b>` : ''}</p><div class="row wrap mb"><span class="dim">Region</span>${REGIONS.map(r => `<button class="chip ${z.region === r.id ? 'on' : ''}" data-act="fb-region" data-r="${r.id}">${r.short}</button>`).join('')}</div>
    <div class="row wrap mb"><span class="dim">Size</span>${Array.from({ length: d.maxLevel }, (_, i) => `<button class="chip ${z.level === i + 1 ? 'on' : ''}" data-act="fb-level" data-l="${i + 1}">Level ${i + 1}</button>`).join('')}<span class="dim">→ ${effect}</span></div>
    <div class="fc-cmp"><div><b>🔑 Rent</b><div class="num">${money(rent)}/mo</div><small class="dim">Upfront ${money(rent * 2)} · ready in ~${Math.round(bd * .4)}d<br>5-yr cost ${money(rentCost)}</small></div><div class="${ownCost < rentCost ? 'best' : ''}"><b>🏗️ Build / buy</b><div class="num">${money(price)}</div><small class="dim">Ready in ${bd}d · maintenance ${money(price * .003)}/mo<br>5-yr net cost ≈ ${money(ownCost)}${ownCost < rentCost ? ' — cheaper' : ''}</small></div><div><b>🤝 Outsource</b><div class="num">$0 upfront</div><small class="dim">No facility${outs.replace(/<br>/g, ' ')}</small></div></div></div>
    <div class="mfoot"><small>Cash ${money(s.fin.cash)}</small>${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Lease', 'fb-go', { own: 0 }, '', !!why)}${btn('Build / buy', 'fb-go', { own: 1 }, 'primary', !!why)}</div>`; };
}
registerView({ id: 'facilities', title: 'Facilities', icon: '🏢', group: 'build', order: 4, render, badge: () => { const s = S(); return s.derived.headcount > s.derived.officeCap ? '!' : null; } });
registerActions({
  'fc-open': () => app.openModal('fbuild', buildModal(), true), 'fb-kind': el => { const z = bs(); z.kind = el.dataset.k as FacKind; z.level = 1; }, 'fb-region': el => { bs().region = el.dataset.r as RegionId; }, 'fb-level': el => { bs().level = +el.dataset.l!; },
  'fb-go': el => { const z = bs(); const r = F.buildFacility(S(), z.kind, z.region, el.dataset.own === '1', z.level); act(r); if (r.ok) app.closeModal(); },
  'fc-upg': el => act(F.upgradeFacility(S(), +el.dataset.id!, el.dataset.t as Track)), 'fc-buy': el => act(F.buyoutFacility(S(), +el.dataset.id!)),
  'fc-sell': el => { const id = +el.dataset.id!; const f = S().facilities.find(x => x.id === id); if (f) app.confirm(f.own ? 'Sell facility?' : 'Terminate lease?', `${esc(f.name)} — ${f.own ? 'sold at ~90% of book value' : 'a 2-month penalty applies'}.`, () => act(F.sellFacility(S(), id)), 'Confirm'); },
});
