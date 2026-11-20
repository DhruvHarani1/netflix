// LEGAL & COMPLIANCE — owns s.legal and derived.complianceRisk.
import type { GameState, ComplianceKey, LegalCase, CatId } from './types';
import { clamp, rnd, chance, pick, rint, toast, sfx, addNews, logEntry, rrange } from './util';
import { expense } from './ledger';
import { COMPLIANCE, POLICIES, DIFF } from '../data/core';
import { CAT } from '../data/categories';

export const KEYS: ComplianceKey[] = ['privacy', 'safety', 'antitrust', 'employment', 'environment', 'cyber', 'trade', 'ip'];
const PRIVACY_CATS: CatId[] = ['social', 'search', 'assistant', 'cloud', 'database', 'marketplace', 'payment', 'streaming', 'aimodel'];
const SAFETY_CATS: CatId[] = ['ev', 'robot', 'smartphone', 'watch', 'laptop', 'tablet'];
const TRADE_CATS: CatId[] = ['cpu', 'gpu', 'aimodel', 'cloud'];

export function init(s: GameState): void {
  s.legal.boost = {}; s.legal.fineHist = [];
  for (const k of KEYS) s.legal.boost![k] = 0;
}

/** Scale a fine/exposure to company size. frac = fraction of annual revenue-ish. */
export function scaleExposure(s: GameState, frac: number): number {
  const d = s.derived; return Math.max(25000, Math.round(frac * Math.max(d.revYr, d.valuation * 0.15, d.payroll * 6)));
}
const liveProducts = (s: GameState) => s.products.filter(p => p.status === 'live');
const liveCats = (s: GameState): CatId[] => Array.from(new Set(liveProducts(s).map(p => p.cat)));
export function policyActive(s: GameState, id: string) { return !!s.legal.policies[id]; }
export function policyCostMonthly(s: GameState, id: string): number {
  const p = POLICIES.find(x => x.id === id); if (!p) return 0;
  const base = 2500 + s.derived.payroll * 0.012 + s.derived.revYr / 12 * 0.002;
  return Math.round(base * (id === 'lobby' ? 2.6 : id === 'fairwork' ? 1.4 : 1) * p.cost);
}
export function togglePolicy(s: GameState, id: string): { ok: boolean; msg: string } {
  const p = POLICIES.find(x => x.id === id); if (!p) return { ok: false, msg: 'Unknown policy' };
  const on = !s.legal.policies[id]; s.legal.policies[id] = on;
  if (on) { s.marketing.reputation = clamp(s.marketing.reputation + (id === 'ethicalai' || id === 'privacyfirst' ? 1.5 : 0.6)); sfx('success'); }
  return { ok: true, msg: on ? `${p.name} adopted (≈${Math.round(policyCostMonthly(s, id)).toLocaleString()}/mo)` : `${p.name} discontinued` };
}
const POLICY_TARGET: Record<string, Partial<Record<ComplianceKey, number>>> = {
  privacyfirst: { privacy: 20 }, ethicalai: { safety: 14, privacy: 6 }, green: { environment: 24 }, opensource: { ip: -8 },
  bugbounty: { cyber: 16 }, fairwork: { employment: 24 }, lobby: { antitrust: 12, trade: 8 },
};
export function complianceTarget(s: GameState, k: ComplianceKey): number {
  const d = s.derived; const legalOut = d.dept.legal.output, secOut = d.dept.security.output;
  const scale = 1 + d.headcount / 18;
  let t = 38 + 22 * Math.tanh(legalOut / scale);
  if (k === 'cyber') t = 34 + 28 * Math.tanh(secOut / scale) + 8 * Math.tanh(legalOut / scale);
  if (k === 'environment') t = 40 + 6 * Math.tanh(d.dept.ops.output / scale);
  if (k === 'employment') t = 40 + 10 * Math.tanh(d.dept.hr.output / scale);
  if (k === 'ip') t += Math.min(22, s.research.patents.length * 1.6);
  for (const id in s.legal.policies) if (s.legal.policies[id]) t += POLICY_TARGET[id]?.[k] || 0;
  // pressure: dominance & scale make life harder
  if (k === 'antitrust') t -= Math.max(0, 30 * (maxShare(s) - 0.25));
  t -= (s.legal.watch / 100) * 8;
  return clamp(t, 5, 98);
}
function maxShare(s: GameState): number { let m = 0; for (const c of liveCats(s)) m = Math.max(m, s.market.cats[c]?.playerShare || 0); return m; }

export function investCompliance(s: GameState, key: ComplianceKey, amount: number): { ok: boolean; msg: string } {
  if (!(amount > 0)) return { ok: false, msg: 'Enter an amount' };
  if (s.fin.cash < amount && !s.sandboxCash) return { ok: false, msg: 'Not enough cash' };
  const scale = 40000 + s.derived.payroll * 0.6; const pts = 14 * (1 - Math.exp(-amount / scale));
  expense(s, amount, 'legal'); s.legal.boost![key] = clamp((s.legal.boost![key] || 0) + pts, 0, 30); sfx('success');
  return { ok: true, msg: `+${pts.toFixed(1)} ${key} compliance boost` };
}

// ------------------------------------------------------------- cases ------
export function openCase(s: GameState, o: { kind: string; title: string; opp: string; exposure: number; months?: number; desc: string; product?: number; cat?: CatId }): LegalCase {
  const c: LegalCase = { id: s.legal.nextId++, kind: o.kind, title: o.title, opp: o.opp, day: s.day, ends: s.day + Math.round((o.months ?? 6) * 30), exposure: Math.round(o.exposure), status: 'open', desc: o.desc, product: o.product, cat: o.cat, stance: 'default', fee: 0 };
  s.legal.cases.push(c);
  if (o.kind === 'antitrust' || o.kind === 'privacy-probe') s.legal.investigations.push({ kind: o.kind, day: s.day, ends: c.ends, cat: o.cat });
  toast(`New legal matter: ${o.title}`, 'warn', 'warn'); addNews(s, `${s.co.name} faces legal action: ${o.title}`, o.desc, 'law', 'bad');
  logEntry(s, `Legal case opened: ${o.title}`, 'bad');
  return c;
}
export function winChance(s: GameState, c: LegalCase): number {
  const lo = s.derived.dept.legal.output; const comp = c.kind === 'patent' ? s.legal.compliance.ip : c.kind === 'antitrust' ? s.legal.compliance.antitrust : c.kind === 'privacy' || c.kind === 'privacy-probe' ? s.legal.compliance.privacy : c.kind === 'recall' ? s.legal.compliance.safety : 55;
  const pat = c.kind === 'patent' ? Math.min(0.12, s.research.patents.length * 0.012) : 0;
  return clamp(0.2 + 0.22 * Math.tanh(lo / (1 + s.derived.headcount / 25)) + comp / 260 + pat - (c.stance === 'default' ? 0.12 : 0), 0.08, 0.88);
}
export function settleCost(c: LegalCase) { return Math.round(c.exposure * 0.42); }
export function fightFee(c: LegalCase) { return Math.round(c.exposure * 0.07); }
export function settleCase(s: GameState, id: number): { ok: boolean; msg: string } {
  const c = s.legal.cases.find(x => x.id === id && x.status === 'open'); if (!c) return { ok: false, msg: 'Case not found' };
  const cost = settleCost(c); if (s.fin.cash < cost && !s.sandboxCash) return { ok: false, msg: 'Not enough cash to settle' };
  expense(s, cost, 'legal'); s.legal.fines += cost; s.legal.fineHist!.push({ day: s.day, amount: cost, text: `Settled: ${c.title}` });
  c.status = 'settled'; c.outcome = `Settled for $${cost.toLocaleString()}`; closeInvestigation(s, c); sfx('cash');
  return { ok: true, msg: `Settled — paid $${cost.toLocaleString()}` };
}
export function fightCase(s: GameState, id: number): { ok: boolean; msg: string } {
  const c = s.legal.cases.find(x => x.id === id && x.status === 'open'); if (!c) return { ok: false, msg: 'Case not found' };
  if (c.stance === 'fight') return { ok: false, msg: 'Already fighting this case' };
  const fee = fightFee(c); if (s.fin.cash < fee && !s.sandboxCash) return { ok: false, msg: 'Not enough cash for legal fees' };
  expense(s, fee, 'legal'); c.fee = fee; c.stance = 'fight'; return { ok: true, msg: `Fighting in court — fees $${fee.toLocaleString()}. Win chance ${(winChance(s, c) * 100).toFixed(0)}%` };
}
function closeInvestigation(s: GameState, c: LegalCase) { s.legal.investigations = s.legal.investigations.filter(i => !(i.kind === c.kind && i.ends === c.ends)); }
function resolveCase(s: GameState, c: LegalCase) {
  const win = chance(s, winChance(s, c)); closeInvestigation(s, c);
  if (win) { c.status = 'won'; c.outcome = 'Case dismissed in your favour'; toast(`Legal victory: ${c.title}`, 'good', 'success'); addNews(s, `${s.co.name} wins legal fight: ${c.title}`, '', 'law', 'good'); s.marketing.reputation = clamp(s.marketing.reputation + 1.5); }
  else {
    const pay = Math.round(c.exposure * (c.stance === 'fight' ? 1.25 : 1.0)); expense(s, pay, 'legal'); s.legal.fines += pay; s.legal.fineHist!.push({ day: s.day, amount: pay, text: `Lost: ${c.title}` });
    c.status = 'lost'; c.outcome = `Lost — damages $${pay.toLocaleString()}`; s.marketing.reputation = clamp(s.marketing.reputation - 2.5);
    s.legal.watch = clamp(s.legal.watch + 4); toast(`Case lost: ${c.title} (-$${pay.toLocaleString()})`, 'bad', 'warn'); addNews(s, `${s.co.name} loses ${c.title}`, `Ordered to pay $${pay.toLocaleString()}.`, 'law', 'bad');
    if (c.kind === 'recall' && c.product) { const p = s.products.find(x => x.id === c.product); if (p) { p.satisf = clamp(p.satisf - 12); } }
  }
}
export function daily(s: GameState): void {
  if (!s.legal.cases.length) return;
  for (const c of s.legal.cases) if (c.status === 'open' && s.day >= c.ends) resolveCase(s, c);
  if (s.legal.cases.length > 60) s.legal.cases = s.legal.cases.filter(c => c.status === 'open' || s.day - c.ends < 900);
}

// ---------------------------------------------------------- monthly -------
export function monthly(s: GameState): void {
  const L = s.legal; const b = L.boost!;
  // policy upkeep + effects
  for (const p of POLICIES) if (L.policies[p.id]) { expense(s, policyCostMonthly(s, p.id), 'legal'); if (p.id === 'green') s.marketing.reputation = clamp(s.marketing.reputation + 0.05); }
  if (L.policies.fairwork) s.derived.happinessBonus = Math.max(s.derived.happinessBonus, 0);
  // compliance drift toward target (+ boosts that decay)
  for (const k of KEYS) { const t = clamp(complianceTarget(s, k) + (b[k] || 0)); L.compliance[k] = clamp(L.compliance[k] + (t - L.compliance[k]) * 0.18); b[k] = (b[k] || 0) * 0.94; }
  // regulatory heat target
  const share = maxShare(s); let heat = 8 + Math.max(0, share - 0.2) * 110;
  const cats = liveCats(s); if (cats.some(c => PRIVACY_CATS.includes(c))) heat += 8; if (cats.some(c => TRADE_CATS.includes(c))) heat += 5;
  heat += Math.min(20, s.derived.valuation / 5e10) + Math.min(14, s.ma.subs.length * 4);
  heat -= L.policies.lobby ? 14 : 0; heat -= (L.compliance.antitrust - 50) / 5;
  L.watch = clamp(L.watch + (clamp(heat) - L.watch) * 0.2);
  const avg = KEYS.reduce((a, k) => a + L.compliance[k], 0) / KEYS.length;
  s.derived.complianceRisk = clamp(0.55 + L.watch / 160 + (60 - avg) / 90, 0.5, 2) * (cats.length ? 1 : 0.7);
  generateCases(s, share, cats);
}
function generateCases(s: GameState, share: number, cats: CatId[]) {
  if (!cats.length || s.day < 120) return; const dd = DIFF[s.difficulty].event; const risk = s.derived.complianceRisk * dd;
  const open = (k: string) => s.legal.cases.some(c => c.status === 'open' && c.kind === k);
  const prod = () => pick(s, liveProducts(s));
  // patent infringement claim: more likely with few patents
  if (!open('patent') && chance(s, 0.018 * risk * (1 + Math.max(0, 6 - s.research.patents.length) * 0.12) * (1 - L.compliance(s, 'ip') / 200))) {
    const p = prod(); const opp = pick(s, ['Helios Licensing', 'Marlowe IP Holdings', 'Quark Patent Group', 'Dunmore Technologies', 'Sable Innovation LLC']);
    openCase(s, { kind: 'patent', title: `Patent claim over ${p.name}`, opp, exposure: scaleExposure(s, 0.04 + rnd(s) * 0.08), months: rint(s, 5, 9), desc: `${opp} alleges ${p.name} infringes its patents.`, product: p.id, cat: p.cat });
  }
  const pc = cats.filter(c => PRIVACY_CATS.includes(c));
  if (pc.length && !open('privacy') && chance(s, 0.016 * risk * (1 - s.legal.compliance.privacy / 140))) {
    const c = pick(s, pc); openCase(s, { kind: 'privacy', title: `Class action: ${CAT[c].name} data practices`, opp: 'Consumer coalition', exposure: scaleExposure(s, 0.05 + rnd(s) * 0.1), months: rint(s, 6, 10), desc: 'Plaintiffs allege your data collection violated privacy law.', cat: c });
  }
  if (share > 0.33 && !open('antitrust') && chance(s, 0.012 * risk * (1 + (share - 0.33) * 5) * (1 - s.legal.compliance.antitrust / 150))) {
    const c = cats.reduce((a, b) => ((s.market.cats[b]?.playerShare || 0) > (s.market.cats[a]?.playerShare || 0) ? b : a));
    openCase(s, { kind: 'antitrust', title: `Antitrust investigation: ${CAT[c].name}`, opp: 'Competition Authority', exposure: scaleExposure(s, 0.1 + share * 0.2), months: rint(s, 8, 14), desc: `Regulators examine your ${(share * 100).toFixed(0)}% share of ${CAT[c].name}.`, cat: c });
  }
  const sc = cats.filter(c => SAFETY_CATS.includes(c));
  if (sc.length && !open('recall') && chance(s, 0.01 * risk * (1 - s.legal.compliance.safety / 150))) {
    const ps = liveProducts(s).filter(p => SAFETY_CATS.includes(p.cat)); const p = pick(s, ps);
    openCase(s, { kind: 'recall', title: `Safety recall review: ${p.name}`, opp: 'Product Safety Commission', exposure: scaleExposure(s, 0.03 + rnd(s) * 0.05), months: rint(s, 3, 6), desc: `Reports of defects prompt a mandatory safety review of ${p.name}.`, product: p.id, cat: p.cat });
  }
}
// small helper object so the compliance lookup above reads naturally
const L = { compliance: (s: GameState, k: ComplianceKey) => s.legal.compliance[k] };
export const complianceInfo = COMPLIANCE;
export function openCaseCount(s: GameState) { return s.legal.cases.filter(c => c.status === 'open').length; }
