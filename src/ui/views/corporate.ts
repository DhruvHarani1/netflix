import { registerView, registerActions, registerInputs, pageHead, panel, kpi, tabs, curTab, table, bar, badge, btn, money, pct, sgn, empty, app, num, logo, esc, scoreColor } from '../kit';
import { ui, S } from '../state';
import * as ma from '../../sim/ma';
import * as stock from '../../sim/stock';
import { CAT } from '../../data/categories';
import { fmtDate } from '../../sim/util';
import type { Rival } from '../../sim/types';
import './corporate.css';

interface Sel { premium: number; target: string | null; hostile: boolean; filter: string }
const sel = (): Sel => (ui.sel.corp ||= { premium: 0.3, target: null, hostile: false, filter: 'all' });

function render(): string {
  const s = S(); const tab = curTab('corporate', 'targets'); const open = s.ma.offers.filter(o => o.status === 'countered').length;
  return pageHead('Corporate M&A', 'Buy rivals and startups, absorb their products and people — or sell and spin off what no longer fits.', `<span class="dim sm">Cash ${money(s.fin.cash)}</span>`) +
    tabs('corporate', [['targets', 'Acquisition targets'], ['subs', `Subsidiaries (${s.ma.subs.length})`], ['offers', `Offers${open ? ` (${open})` : ''}`]], 'targets') +
    (tab === 'targets' ? targets() : tab === 'subs' ? subs() : offers());
}
function personality(r: Rival): string { const p = r.personality; return [p.aggr > .65 ? 'Aggressive' : p.caution > .65 ? 'Conservative' : '', p.innov > .65 ? 'Innovator' : '', p.premium > .4 ? 'Premium' : p.premium < -.4 ? 'Low-cost' : ''].filter(Boolean).join(' · ') || 'Balanced'; }
function targets(): string {
  const s = S(); const x = sel(); let list = ma.targets(s);
  if (x.filter === 'startup') list = list.filter(r => r.kind === 'startup'); else if (x.filter === 'major') list = list.filter(r => r.kind === 'major'); else if (x.filter === 'sale') list = list.filter(r => r.forSale);
  list.sort((a, b) => ma.valueOfTarget(s, b) - ma.valueOfTarget(s, a));
  const chips = [['all', 'All'], ['startup', 'Startups'], ['major', 'Established'], ['sale', 'For sale']].map(([k, l]) => `<button class="chip ${x.filter === k ? 'on' : ''}" data-act="corp-filter" data-k="${k}">${l}</button>`).join('');
  const rows = list.map(r => {
    const v = ma.valueOfTarget(s, r); const hold = ma.stakeOf(s, r); const cats = Object.keys(r.offers).map(c => (CAT as any)[c]?.icon || '').join(' ');
    return [`<div class="row">${logo(r.logo, r.color, 26)}<div><b>${esc(r.name)}</b> ${r.forSale ? badge('For sale', 'good') : ''}<br><small class="dim">${r.kind === 'startup' ? 'Startup' : r.archetype} · ${personality(r)}</small></div></div>`, money(v), money(ma.offerRev(r)), cats || '—', num(r.headcount, 0), `${hold ? pct(hold, 1) : '—'}`,
      `<div class="row">${btn('Offer', 'corp-offer', { id: r.id }, 'sm primary')}${r.publicCo ? btn('Hostile', 'corp-hostile', { id: r.id }, 'sm bad', false, hold >= 0.15 ? '' : 'Needs a 15% stake') : ''}</div>`];
  });
  return `<div class="row wrap mb">${chips}</div>` + panel('Companies in play', rows.length ? table(['Company', 'Valuation', 'Revenue / yr', 'Markets', 'Staff', 'Your stake', ''], rows, '', ['', 'r', 'r', '', 'r', 'r', 'r']) : empty('No targets match', 'Rivals appear as the world develops.'), '', 'flat');
}
function subs(): string {
  const s = S(); if (!s.ma.subs.length) return panel('Subsidiaries', empty('No subsidiaries yet', 'Acquire a company from the Targets tab. Its products keep selling under its own brand while you integrate.'));
  return `<div class="subgrid">${s.ma.subs.map(sub => {
    const val = ma.subValue(s, sub); const gl = val - sub.bookValue; const rev = sub.revEma * 30; const cols = scoreColor(sub.culture);
    return `<div class="subcard" style="--c:${sub.color}"><header>${logo(0, sub.color, 30)}<div><b>${esc(sub.name)}</b><small>${sub.cats.map(c => (CAT as any)[c]?.name).filter(Boolean).join(', ') || 'no products'}</small></div></header>
    <div class="subgrid2"><div><span>Revenue / mo</span><b class="num">${money(rev)}</b></div><div><span>Overhead / mo</span><b class="num">${money(sub.costM * (1 - 0.25 * sub.synergy))}</b></div><div><span>Staff</span><b class="num">${num(sub.headcount, 0)}</b></div><div><span>Acquired</span><b>${fmtDate(sub.acquired)}</b></div></div>
    <div class="lbl">Integration ${(sub.integration * 100).toFixed(0)}%</div>${bar(sub.integration, 1, 'var(--accent)')}<div class="lbl">Culture fit ${sub.culture}/100</div>${bar(sub.culture, 100, cols)}<div class="lbl">Synergy ${(sub.synergy * 100).toFixed(0)}%</div>${bar(sub.synergy, 1, 'var(--good)')}
    ${sub.techGranted ? `<div class="mt">${badge('Tech: ' + sub.techGranted, 'purple')}</div>` : ''}
    <div class="row between mt"><small class="dim">Book ${money(sub.bookValue)} → worth ${money(val)} <span class="${gl >= 0 ? 'pos' : 'neg'}">(${sgn(gl)})</span></small></div>
    <div class="row mt">${btn('Sell', 'corp-sell', { id: sub.id }, 'sm bad')}${btn('Spin off', 'corp-spin', { id: sub.id }, 'sm', sub.integration < 0.5, 'Needs 50% integration')}</div></div>`;
  }).join('')}</div>` + (s.ma.history.length ? panel('Deal history', `<div class="list">${s.ma.history.slice(-8).reverse().map(h => `<div class="row between"><span>${h.text}</span><small class="dim">${fmtDate(h.day)}</small></div>`).join('')}</div>`, '', 'mt flat') : '');
}
function offers(): string {
  const s = S(); const list = [...s.ma.offers].reverse();
  return panel('Offer history', list.length ? table(['Date', 'Target', 'Type', 'Price', 'Premium', 'Status', ''], list.map(o => { const r = s.rivals.find(x => x.id === o.rivalId);
    return [fmtDate(o.day), esc(r?.name || o.rivalId), o.kind, money(o.price), pct(o.premium, 0), `${badge(o.status, o.status === 'accepted' ? 'good' : o.status === 'rejected' ? 'bad' : 'warn')}<br><small class="dim">${esc(o.note)}</small>`,
      o.status === 'countered' ? `<div class="row">${btn(`Accept ${money(o.counter || 0)}`, 'corp-accept', { id: o.id }, 'sm good')}${btn('Decline', 'corp-decline', { id: o.id }, 'sm')}</div>` : ''];
  }), '', ['', '', '', 'r', 'r', '', 'r']) : empty('No offers yet', 'Make an offer from the Targets tab.'), '', 'flat');
}
function offerModal(): string {
  const s = S(); const x = sel(); const r = s.rivals.find(v => v.id === x.target);
  if (!r || r.status !== 'active') return `<div class="mbody">Target is no longer available.</div><div class="mfoot">${btn('Close', 'modal-close', {}, 'primary')}</div>`;
  const v = ma.valueOfTarget(s, r);
  if (x.hostile) {
    const h = ma.hostileInfo(s, r, x.premium);
    return `<div class="mhead bad"><span class="mi">🦈</span><div><small>Hostile takeover · tender offer</small><h2>${esc(r.name)}</h2></div></div><div class="mbody">
      <p class="dim">Bypass the board and buy the float directly. Your stake: <b>${pct(h.stake, 1)}</b> ${h.canTry ? '' : '— <span class="neg">you need at least 15%</span>'}. Founders and insiders hold ${pct(r.founderOwned, 0)}.</p>
      ${prem(x.premium)}<div class="stat-row"><span>Total tender value</span><b class="num" id="h-total">${money(h.total)}</b></div><div class="stat-row"><span>Cash required (after your stake)</span><b class="num ${h.eff > s.fin.cash ? 'neg' : ''}" id="h-eff">${money(h.eff)}</b></div>
      <div class="stat-row"><span>Estimated success</span><b class="num" id="h-prob">${pct(h.prob, 0)}</b></div><p class="dim sm">A failed bid triggers a poison pill, fees and lasting hostility.</p></div>
      <div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Launch tender offer', 'corp-hostile-go', {}, 'bad', !h.canTry || h.eff > s.fin.cash)}</div>`;
  }
  const odds = ma.offerOdds(s, r, x.premium); const price = ma.offerPrice(s, r, x.premium);
  return `<div class="mhead"><span class="mi">🤝</span><div><small>${r.kind === 'startup' ? 'Startup' : r.archetype}</small><h2>Acquire ${esc(r.name)}</h2></div></div><div class="mbody">
    <div class="grid g2 mb"><div class="stat-row"><span>Valuation</span><b class="num">${money(v)}</b></div><div class="stat-row"><span>Revenue / yr</span><b class="num">${money(ma.offerRev(r))}</b></div><div class="stat-row"><span>Staff</span><b class="num">${num(r.headcount, 0)}</b></div><div class="stat-row"><span>Attitude</span><b>${r.relation > 20 ? 'Friendly' : r.relation < -20 ? 'Hostile' : 'Neutral'}</b></div></div>
    ${r.techGrant ? `<p>${badge('Brings technology: ' + r.techGrant, 'purple')}</p>` : ''}${r.forSale ? `<p>${badge('Exploring a sale', 'good')}</p>` : ''}
    ${prem(x.premium)}<div class="stat-row"><span>Offer price</span><b class="num" id="o-price">${money(price)}</b></div><div class="stat-row"><span>Your cash</span><b class="num ${price > s.fin.cash ? 'neg' : ''}">${money(s.fin.cash)}</b></div>
    <div class="stat-row"><span>Acceptance odds</span><b class="num" id="o-odds">${pct(odds, 0)}</b></div>${bar(odds, 1, scoreColor(odds * 100), '', 8)}
    <p class="dim sm mt">Acquisitions add goodwill to your balance sheet, ~12 months of integration costs, monthly overhead and cultural risk. Their products keep selling and can lift your valuation.</p></div>
    <div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Submit offer', 'corp-offer-go', {}, 'primary', price > s.fin.cash + ma.stakeOf(s, r) * 0)}</div>`;
}
const prem = (p: number) => `<label class="slider"><span>Premium over valuation</span><input type="range" data-input="corp-prem" min="0" max="1" step="0.01" value="${p}"><b class="num" data-for="corp-prem">+${(p * 100).toFixed(0)}%</b></label>`;

registerActions({
  'corp-filter': el => { sel().filter = el.dataset.k!; },
  'corp-offer': el => { const x = sel(); x.target = el.dataset.id!; x.hostile = false; x.premium = 0.3; app.openModal('corp-offer', offerModal); },
  'corp-hostile': el => { const x = sel(); x.target = el.dataset.id!; x.hostile = true; x.premium = 0.3; app.openModal('corp-offer', offerModal); },
  'corp-offer-go': () => { const x = sel(); const r = ma.makeOffer(S(), x.target!, x.premium); app.closeModal(); app.toast(r.msg, r.ok ? 'good' : 'warn'); app.sfx(r.ok ? 'launch' : 'error'); if (r.ok && S().ma.subs.length) ui.tab.corporate = 'subs'; else ui.tab.corporate = 'offers'; },
  'corp-hostile-go': () => { const x = sel(); const r = ma.hostileTakeover(S(), x.target!, x.premium); app.closeModal(); app.toast(r.msg, r.ok ? 'good' : 'bad'); app.sfx(r.ok ? 'launch' : 'error'); if (r.ok) ui.tab.corporate = 'subs'; },
  'corp-accept': el => { const r = ma.acceptCounter(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) ui.tab.corporate = 'subs'; },
  'corp-decline': el => { ma.rejectCounter(S(), +el.dataset.id!); },
  'corp-sell': el => { const s = S(); const sub = s.ma.subs.find(v => v.id === el.dataset.id); if (!sub) return; app.confirm('Sell subsidiary?', `Sell ${esc(sub.name)} for ${money(ma.subValue(s, sub))}? Its products and staff leave with it.`, () => { const r = ma.sellSubsidiary(s, sub.id); app.toast(r.msg, r.ok ? 'good' : 'warn'); }, 'Sell'); },
  'corp-spin': el => { const s = S(); const sub = s.ma.subs.find(v => v.id === el.dataset.id); if (!sub) return; app.confirm('Spin off subsidiary?', `List ${esc(sub.name)} as an independent public company: raise ~${money(ma.subValue(s, sub) * 1.15 * 0.4 * 0.95)} now and keep a 60% stake.`, () => { const r = ma.spinOff(s, sub.id); app.toast(r.msg, r.ok ? 'good' : 'warn'); }, 'Spin off'); },
});
registerInputs({
  'corp-prem': el => {
    const x = sel(); x.premium = +el.value; const s = S(); const r = s.rivals.find(v => v.id === x.target); if (!r) return; const set = (id: string, t: string) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    const o = document.querySelector('[data-for="corp-prem"]'); if (o) o.textContent = `+${(x.premium * 100).toFixed(0)}%`;
    if (x.hostile) { const h = ma.hostileInfo(s, r, x.premium); set('h-total', money(h.total)); set('h-eff', money(h.eff)); set('h-prob', pct(h.prob, 0)); } else { set('o-price', money(ma.offerPrice(s, r, x.premium))); set('o-odds', pct(ma.offerOdds(s, r, x.premium), 0)); }
  },
});
registerView({ id: 'corporate', title: 'Corporate M&A', icon: '🤝', group: 'money', order: 2, render, badge: () => { const n = S().ma.offers.filter(o => o.status === 'countered').length; return n || null; } });
void stock;
