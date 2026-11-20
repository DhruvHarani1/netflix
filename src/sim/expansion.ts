import { perkMult } from './achievements';
import type { GameState, RegionId, RegionState } from './types';
import { clamp, toast, logEntry, avg } from './util';
import { expense } from './ledger';
import { REGIONS, REGION } from '../data/core';
import { SEGS } from '../data/core';

export type ExpansionKind = 'office' | 'hq' | 'distribution' | 'partner' | 'subsidiary';
export interface ExpansionDef { id: ExpansionKind; name: string; icon: string; desc: string; setup: number; monthly: number; gain: number; needs?: ExpansionKind }
export const EXPANSIONS: ExpansionDef[] = [
  { id: 'partner', name: 'Local Partnership', icon: '🤝', desc: 'Sign a reseller. Cheap, partial reach, shares revenue.', setup: .6, monthly: .02, gain: 15 },
  { id: 'office', name: 'International Office', icon: '🏢', desc: 'Sales & support presence in-country.', setup: 1, monthly: .05, gain: 25 },
  { id: 'distribution', name: 'Distribution Network', icon: '🚚', desc: 'Warehouses and logistics to reach customers faster.', setup: 2.5, monthly: .1, gain: 20, needs: 'office' },
  { id: 'hq', name: 'Regional Headquarters', icon: '🏛️', desc: 'Local leadership and R&D. Cuts regulatory friction.', setup: 4, monthly: .18, gain: 20, needs: 'office' },
  { id: 'subsidiary', name: 'Local Subsidiary', icon: '🏷️', desc: 'Local legal entity: trust with governments, reduced regulatory risk.', setup: 6, monthly: .15, gain: 15, needs: 'office' },
];
export const EXP: Record<ExpansionKind, ExpansionDef> = Object.fromEntries(EXPANSIONS.map(e => [e.id, e])) as any;
const costScale = (s: GameState) => 1 + Math.min(9, s.derived.headcount / 60);
export const expansionCost = (s: GameState, r: RegionId, k: ExpansionKind) => Math.round(REGION[r].officeCost * EXP[k].setup * costScale(s) / perkMult(s, 'expansion') / 1000) * 1000;
export const expansionMonthly = (s: GameState, r: RegionId, k: ExpansionKind) => Math.round(REGION[r].officeCost * EXP[k].monthly * costScale(s) / 100) * 100;

export function has(rs: RegionState, k: ExpansionKind): boolean {
  return k === 'office' ? rs.office >= 1 : k === 'hq' ? rs.office >= 2 : k === 'distribution' ? rs.distribution : k === 'partner' ? rs.partner : rs.subsidiary;
}
const isHome = (s: GameState, r: RegionId) => s.co.hq === r;

/** Target market presence for a region. */
export function computeTarget(s: GameState, r: RegionId, hypo?: Partial<Record<ExpansionKind, boolean>>): number {
  const rs = s.regions[r], d = REGION[r]; const h = (k: ExpansionKind) => (hypo && hypo[k] !== undefined ? hypo[k] : has(rs, k));
  let t = 0; if (isHome(s, r)) t += 25; if (h('office')) t += 25; if (h('hq')) t += 20; if (h('distribution')) t += 20; if (h('partner')) t += h('office') ? 8 : 15; if (h('subsidiary')) t += 15;
  const any = t > (isHome(s, r) ? 25 : 0);
  if (any || isHome(s, r)) { const aw = avg(SEGS.map(g => s.marketing.awareness[g])); t += Math.min(15, aw * .2); }
  if (!h('office') && !isHome(s, r)) t = Math.min(t, 30);
  return clamp(t * (0.55 + 0.45 * d.infra) * (1 - 0.18 * d.competition), 0, 100);
}
export function initRegion(s: GameState, r: RegionId) { const rs = s.regions[r]; rs.target = computeTarget(s, r); }

export function buy(s: GameState, r: RegionId, k: ExpansionKind): { ok: boolean; msg: string } {
  const rs = s.regions[r], def = EXP[k];
  if (isHome(s, r) && (k === 'office' || k === 'hq' && rs.office >= 2)) return { ok: false, msg: 'Your headquarters region is already established.' };
  if (has(rs, k) && !(k === 'office' && rs.office === 0)) return { ok: false, msg: `${def.name} already exists in ${REGION[r].name}.` };
  if (def.needs && !has(rs, def.needs) && !isHome(s, r)) return { ok: false, msg: `Requires ${EXP[def.needs].name} first.` };
  if (k === 'hq' && rs.office < 1 && !isHome(s, r)) return { ok: false, msg: 'Open an international office first.' };
  const cost = expansionCost(s, r, k); if (!s.sandboxCash && s.fin.cash < cost) return { ok: false, msg: `You need $${cost.toLocaleString()} in cash.` };
  expense(s, cost, 'facilities');
  if (k === 'office') rs.office = Math.max(rs.office, 1) as 1 | 2; if (k === 'hq') rs.office = 2; if (k === 'distribution') rs.distribution = true; if (k === 'partner') rs.partner = true; if (k === 'subsidiary') rs.subsidiary = true;
  if (!rs.since) rs.since = s.day; rs.target = computeTarget(s, r);
  toast(`${def.name} established in ${REGION[r].name}`, 'good', 'success'); logEntry(s, `${def.name} established in ${REGION[r].name}`, 'good');
  return { ok: true, msg: 'Established.' };
}
export const openOffice = (s: GameState, r: RegionId) => buy(s, r, 'office');
export const upgradeToRegionalHQ = (s: GameState, r: RegionId) => buy(s, r, 'hq');
export const buildDistribution = (s: GameState, r: RegionId) => buy(s, r, 'distribution');
export const signPartner = (s: GameState, r: RegionId) => buy(s, r, 'partner');
export const createSubsidiary = (s: GameState, r: RegionId) => buy(s, r, 'subsidiary');
export function close(s: GameState, r: RegionId, k: ExpansionKind) {
  const rs = s.regions[r]; if (isHome(s, r) && (k === 'office' || k === 'hq')) return;
  if (k === 'office') { rs.office = 0; rs.distribution = false; rs.subsidiary = false; } if (k === 'hq') rs.office = 1; if (k === 'distribution') rs.distribution = false; if (k === 'partner') rs.partner = false; if (k === 'subsidiary') rs.subsidiary = false; rs.target = computeTarget(s, r);
}

export function init(s: GameState): void {
  for (const d of REGIONS) { const rs = s.regions[d.id]; rs.regulationRisk = Math.round(d.regulation * 50); }
  const hq = s.regions[s.co.hq]; hq.office = 2; hq.since = 0; hq.presence = 35; hq.target = computeTarget(s, s.co.hq);
  for (const d of REGIONS) if (d.id !== s.co.hq) initRegion(s, d.id);
}
export function daily(s: GameState): void {
  for (const d of REGIONS) {
    const rs = s.regions[d.id]; if (s.day % 5 === 0) rs.target = computeTarget(s, d.id);
    const diff = rs.target - rs.presence; if (Math.abs(diff) < .01) continue;
    rs.presence = clamp(rs.presence + (diff > 0 ? Math.min(diff, .11 + .0006 * diff * 10) : Math.max(diff, -.2)), 0, 100);
  }
}
export function monthly(s: GameState): void {
  for (const d of REGIONS) {
    const rs = s.regions[d.id]; let c = 0;
    if (!isHome(s, d.id)) { if (rs.office >= 1) c += expansionMonthly(s, d.id, 'office'); if (rs.office >= 2) c += expansionMonthly(s, d.id, 'hq'); }
    if (rs.distribution) c += expansionMonthly(s, d.id, 'distribution');
    if (rs.partner) c += expansionMonthly(s, d.id, 'partner') + rs.revenueEma * 30 * .04;
    if (rs.subsidiary) c += expansionMonthly(s, d.id, 'subsidiary');
    if (c > 0) expense(s, c, 'facilities');
    let tgt = d.regulation * 50 + (s.derived.marketShare > .2 ? 10 : 0) - (rs.subsidiary ? 15 : 0) - (rs.office >= 2 ? 8 : 0) + (100 - s.legal.compliance.privacy) * .1;
    rs.regulationRisk = clamp(rs.regulationRisk + (tgt - rs.regulationRisk) * .1, 0, 100);
  }
}
export interface RegionStat { id: RegionId; presence: number; target: number; monthlyCost: number; revenue: number; rivalStrength: number; score: number; next: ExpansionKind | null }
export function regionStats(s: GameState): RegionStat[] {
  const act = s.rivals.filter(r => r.status === 'active' && r.kind === 'major');
  return REGIONS.map(d => {
    const rs = s.regions[d.id]; let mc = 0;
    if (!isHome(s, d.id)) { if (rs.office >= 1) mc += expansionMonthly(s, d.id, 'office'); if (rs.office >= 2) mc += expansionMonthly(s, d.id, 'hq'); }
    if (rs.distribution) mc += expansionMonthly(s, d.id, 'distribution'); if (rs.partner) mc += expansionMonthly(s, d.id, 'partner'); if (rs.subsidiary) mc += expansionMonthly(s, d.id, 'subsidiary');
    const rv = act.length ? act.reduce((a, r) => a + r.reach * (r.hq === d.id ? 1.3 : 1), 0) / act.length : 0;
    const gap = Math.max(0, computeTarget(s, d.id, { office: true, distribution: true, hq: true }) - rs.presence);
    const score = d.pop * 100 * d.power * (1 - .45 * d.competition) * (.5 + .5 * d.infra) * (1 + gap / 100) * 3;
    const next: ExpansionKind | null = rs.office < 1 && !isHome(s, d.id) ? 'office' : !rs.distribution ? 'distribution' : rs.office < 2 ? 'hq' : !rs.subsidiary ? 'subsidiary' : null;
    return { id: d.id, presence: rs.presence, target: rs.target, monthlyCost: mc, revenue: rs.revenueEma * 30, rivalStrength: Math.min(1.3, rv), score, next };
  });
}
