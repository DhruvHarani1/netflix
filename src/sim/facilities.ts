import { perkMult } from './achievements';
import type { GameState, Facility, FacKind, RegionId } from './types';
import { FAC, FACS, TRACK_INFO, type Track } from '../data/facilities';
import { REGION, CITIES } from '../data/core';
import { capex, expense, depreciate, saleOfAsset } from './ledger';
import { toast, sfx, clamp, logEntry, addNews } from './util';
import { hasTech } from './research';

export interface Res { ok: boolean; msg: string }
const ok = (msg: string): Res => ({ ok: true, msg }); const no = (msg: string): Res => ({ ok: false, msg });
const OFFICE_KINDS: FacKind[] = ['office', 'hq', 'campus', 'lab', 'testing', 'warehouse'];

export function costIndex(kind: FacKind, region: RegionId): number {
  const r = REGION[region]; const ci = r.officeCost / 120000;
  return ['factory', 'fab', 'warehouse', 'datacenter'].includes(kind) ? ci * .5 + r.labor * .5 : ci;
}
export function rentOf(s: GameState, kind: FacKind, region: RegionId, level: number): number {
  const d = FAC[kind]; return Math.round(d.rent[level - 1] * costIndex(kind, region) * (region === s.co.hq ? 1 : 1.08) * (1 + (s.market.econ.inflation) * s.day / 365));
}
export const priceOf = (s: GameState, kind: FacKind, region: RegionId, level: number) => Math.round(rentOf(s, kind, region, level) * FAC[kind].buyMonths);
export function upgradeCost(s: GameState, f: Facility, track: Track): number {
  const n = f.upg[track]; const base = priceOf(s, f.kind, f.region, f.level);
  return Math.round(base * 0.12 * Math.pow(n + 1, 1.4) * (f.own ? 1 : .6));
}
const isBuilt = (s: GameState, f: Facility) => f.buildUntil <= s.day;

export function facilityCatalog(s?: GameState) { return FACS; }
export function canBuild(s: GameState, kind: FacKind): string | null {
  const d = FAC[kind];
  if (kind === 'fab' && !hasTech(s, 'fab1')) return 'Requires Semiconductor Fabrication research';
  if (kind === 'campus' && s.derived.valuation < 5e8) return 'Requires $500M+ valuation';
  if (kind === 'office' && false) return null;
  return null;
}

export function buildFacility(s: GameState, kind: FacKind, region: RegionId, own: boolean, level = 1): Res {
  const d = FAC[kind]; level = Math.max(1, Math.min(d.maxLevel, level | 0));
  const why = canBuild(s, kind); if (why) return no(why);
  const price = priceOf(s, kind, region, level), rent = rentOf(s, kind, region, level);
  const upfront = own ? price : rent * 2; // deposit = 2 months
  if (s.fin.cash < upfront && !s.sandboxCash) return no(`Not enough cash — need ${fmt(upfront)}`);
  const days = Math.round(d.build[level - 1] * (own ? 1 : .4));
  const fid = s.nextFacId++;
  const city = region === s.co.hq ? s.co.city : CITIES[region][s.facilities.length % CITIES[region].length];
  const f: Facility = { id: fid, kind, name: `${city} ${d.name}`, region, level, own, built: s.day, upg: { capacity: 0, compute: 0, security: 0, amenities: 0, energy: 0, equipment: 0, automation: 0 }, buildUntil: s.day + days, value: 0 };
  if (own) { capex(s, price); f.value = price; } else expense(s, rent * 2, 'rent');
  s.facilities.push(f);
  logEntry(s, `${own ? 'Began building' : 'Leased'} ${f.name} (L${level}) — ready in ${days} days.`, 'info');
  sfx('click'); return ok(`${f.name} ${own ? 'under construction' : 'lease signed'} — ready in ${days} days.`);
}
export function buyoutFacility(s: GameState, id: number): Res {
  const f = s.facilities.find(x => x.id === id); if (!f) return no('Not found'); if (f.own) return no('Already owned');
  const price = priceOf(s, f.kind, f.region, f.level) * .9;
  if (s.fin.cash < price && !s.sandboxCash) return no(`Need ${fmt(price)} to buy out the lease`);
  capex(s, price); f.own = true; f.value = price; return ok(`Purchased ${f.name} for ${fmt(price)}.`);
}
export function upgradeFacility(s: GameState, id: number, track: Track): Res {
  const f = s.facilities.find(x => x.id === id); if (!f) return no('Facility not found');
  if (!FAC[f.kind].tracks.includes(track)) return no('Not applicable to this facility');
  if (!isBuilt(s, f)) return no('Still under construction');
  if (f.upg[track] >= 5) return no('Already at max level');
  const c = upgradeCost(s, f, track); if (s.fin.cash < c && !s.sandboxCash) return no(`Need ${fmt(c)}`);
  if (f.own) { capex(s, c); f.value += c; } else expense(s, c, 'facilities');
  f.upg[track]++; sfx('success'); return ok(`${TRACK_INFO[track].name} upgraded to level ${f.upg[track]}.`);
}
export function sellFacility(s: GameState, id: number): Res {
  const f = s.facilities.find(x => x.id === id); if (!f) return no('Not found');
  if (OFFICE_KINDS.slice(0, 3).includes(f.kind)) {
    const others = s.facilities.filter(x => x.id !== id && ['office', 'hq', 'campus'].includes(x.kind) && isBuilt(s, x));
    if (!others.length && isBuilt(s, f)) return no('You need at least one office — build a replacement first');
  }
  if (f.own) { const proceeds = Math.round(f.value * .9); saleOfAsset(s, f.value, proceeds); toast(`Sold ${f.name} for ${fmt(proceeds)}`, 'info', 'cash'); }
  else { expense(s, rentOf(s, f.kind, f.region, f.level) * 2, 'rent'); }
  s.facilities = s.facilities.filter(x => x.id !== id); recompute(s);
  return ok(f.own ? `Sold ${f.name}.` : `Lease terminated (2 months' penalty paid).`);
}
const fmt = (n: number) => '$' + (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : n.toFixed(0));

export function securityLevel(s: GameState): number { const b = s.facilities.filter(f => isBuilt(s, f)); return b.length ? b.reduce((a, f) => a + f.upg.security, 0) / b.length : 0; }

function recompute(s: GameState) {
  let off = 0, mfg = 0, dc = 0, lab = 0, test = 0, wh = 0, amen = 0;
  for (const f of s.facilities) {
    if (!isBuilt(s, f)) continue; const d = FAC[f.kind]; const u = f.upg; const L = f.level - 1; const capM = 1 + .2 * u.capacity;
    off += d.cap[L] * capM;
    if (d.mfg) mfg += d.mfg[L] * capM * (1 + .12 * u.automation) * (1 + .06 * u.equipment);
    if (d.dc) dc += d.dc[L] * capM * (1 + .25 * u.compute);
    if (d.lab) lab += d.lab[L] * (1 + .15 * u.compute) * (1 + .12 * u.equipment);
    if (d.test) test += d.test[L] * (1 + .12 * u.equipment);
    if (d.warehouse) wh += d.warehouse[L] * (1 + .12 * u.automation);
    if (d.amen) amen += d.amen[L] * .5; if (['office', 'hq', 'campus', 'lab'].includes(f.kind)) amen += 1.3 * u.amenities;
  }
  const dd = s.derived; dd.officeCap = Math.round(off); dd.mfgCap = Math.round(mfg * (1 + wh)); dd.dcCap = Math.round(dc);
  dd.labBonus = 1 + lab; dd.testBonus = 1 + test; dd.happinessBonus = Math.min(18, amen);
}
export function labSlots(s: GameState) { return Math.min(8, 1 + s.facilities.filter(f => (f.kind === 'lab' || f.kind === 'campus') && isBuilt(s, f)).length); }

export function init(s: GameState): void {
  s.facilities = []; s.nextFacId = 1;
  s.facilities.push({ id: s.nextFacId++, kind: 'office', name: `${s.co.city} Startup Office`, region: s.co.hq, level: 1, own: false, built: 0, upg: { capacity: 0, compute: 0, security: 0, amenities: 0, energy: 0, equipment: 0, automation: 0 }, buildUntil: 0, value: 0 });
  recompute(s);
}
export function daily(s: GameState): void {
  for (const f of s.facilities) if (f.buildUntil === s.day) { toast(`${f.name} is ready for use`, 'good', 'success'); addNews(s, `${s.co.name} opens ${f.name}`, '', 'company', 'good'); }
  recompute(s);
}
export function monthly(s: GameState): void {
  const green = (s.legal?.policies?.green ? 1.08 : 1) * perkMult(s, 'overhead');
  for (const f of s.facilities) {
    if (!isBuilt(s, f)) continue; const d = FAC[f.kind];
    const rent = rentOf(s, f.kind, f.region, f.level);
    const energy = rent * d.energy * (1 - .08 * f.upg.energy) * green;
    if (!f.own) expense(s, rent * perkMult(s, 'overhead'), 'rent');
    else { const maint = f.value * .003 * (1 - .06 * f.upg.automation); expense(s, maint, 'facilities'); depreciate(s, Math.min(f.value, f.value / 200)); f.value = Math.max(0, f.value - Math.min(f.value, f.value / 200)); }
    expense(s, energy, 'facilities');
  }
}
