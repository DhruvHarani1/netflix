// ACHIEVEMENTS, STAGES, MISSIONS, CEO PERKS — owns s.meta and derived.stage.
import type { GameState, Mission } from './types';
import { toast, sfx, addNews, logEntry, clamp } from './util';
import { revenue } from './ledger';
import { TECH } from '../data/research';
import { STAGES } from '../data/core';

// ------------------------------------------------------------ helpers -----
const live = (s: GameState) => s.products.filter(p => p.status === 'live');
const liveCats = (s: GameState) => new Set(live(s).map(p => p.cat)).size;
const regionsActive = (s: GameState) => Object.values(s.regions).filter(r => r.presence >= 12).length;
const futureTechs = (s: GameState) => TECH.filter(t => t.branch === 'future' && s.research.done[t.id] !== undefined).length;
const techCount = (s: GameState) => Object.keys(s.research.done).length;
const lifetimeRev = (s: GameState) => s.fin.ledger.hist.reduce((a, p) => a + p.rev, 0) + s.fin.ledger.m.rev;
const acquisitions = (s: GameState) => s.ma.subs.length + s.ma.history.filter(h => /acquir/i.test(h.text)).length - (s.ma.subs.length ? 0 : 0);
const aiTechs = (s: GameState) => TECH.filter(t => t.branch === 'ai' && s.research.done[t.id] !== undefined).length;
const stat = (s: GameState, k: string) => s.meta.stats[k] || 0;
const val = (s: GameState) => s.derived.valuation;
const maxShare = (s: GameState) => Math.max(0, ...live(s).map(p => s.market.cats[p.cat]?.playerShare || 0));
const debt = (s: GameState) => s.fin.loans.reduce((a, l) => a + l.principal, 0);

// -------------------------------------------------------------- stages ----
export interface StageReq { label: string; cur: number; need: number; fmt?: 'money' | 'num' | 'bool' }
export function stageRequirements(s: GameState, stage: number): StageReq[] {
  const v = val(s);
  switch (stage) {
    case 2: return [{ label: 'Valuation', cur: v, need: 20e6, fmt: 'money' }, { label: 'Live products (or 15 staff)', cur: Math.max(live(s).length / 2, s.derived.headcount / 15), need: 1, fmt: 'num' }];
    case 3: return [{ label: 'Valuation', cur: v, need: 500e6, fmt: 'money' }, { label: 'Regions with presence', cur: regionsActive(s), need: 2, fmt: 'num' }];
    case 4: return [{ label: 'Valuation', cur: v, need: 25e9, fmt: 'money' }, { label: 'Publicly listed', cur: s.stock.public ? 1 : 0, need: 1, fmt: 'bool' }, { label: 'Subsidiary or 5% market share', cur: Math.max(s.ma.subs.length, s.derived.marketShare / 0.05), need: 1, fmt: 'num' }];
    case 5: return [{ label: 'Valuation', cur: v, need: 250e9, fmt: 'money' }, { label: 'Live product categories', cur: liveCats(s), need: 5, fmt: 'num' }];
    case 6: return [{ label: 'Valuation', cur: v, need: 1e12, fmt: 'money' }, { label: 'Future technologies', cur: futureTechs(s), need: 3, fmt: 'num' }];
  }
  return [];
}
const stageMet = (s: GameState, n: number) => stageRequirements(s, n).every(r => r.cur >= r.need);
export function computeStage(s: GameState): number { let st = 1; for (let n = 2; n <= 6; n++) { if (stageMet(s, n)) st = n; else break; } return st; }

// -------------------------------------------------------- achievements ----
export interface AchDef { id: string; name: string; desc: string; icon: string; cond: (s: GameState) => boolean; cash?: number; rep?: number; xp?: number; secret?: boolean }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first_product', name: 'Hello, World', desc: 'Launch your first product.', icon: '🚀', cond: s => live(s).length >= 1 || s.products.some(p => p.launchDay > 0), cash: 20000 },
  { id: 'first_profit', name: 'Profit!', desc: 'Close a month in the black.', icon: '💚', cond: s => s.fin.ledger.hist.some(p => p.ni > 0), rep: 1 },
  { id: 'first_million', name: 'First Million', desc: 'Reach $1M in valuation.', icon: '💵', cond: s => val(s) >= 1e6, cash: 10000 },
  { id: 'ten_million', name: 'Ten Million Club', desc: 'Reach $10M valuation.', icon: '💰', cond: s => val(s) >= 10e6, cash: 50000 },
  { id: 'hundred_million', name: 'Nine Figures', desc: 'Reach $100M valuation.', icon: '🏦', cond: s => val(s) >= 100e6, rep: 2 },
  { id: 'unicorn', name: 'Unicorn Startup', desc: 'Reach $1B valuation while still private.', icon: '🦄', cond: s => val(s) >= 1e9 && !s.stock.public, rep: 4, xp: 60 },
  { id: 'first_billion', name: 'First Billion', desc: 'Reach $1B valuation.', icon: '💎', cond: s => val(s) >= 1e9, rep: 3, xp: 40 },
  { id: 'hundred_billion', name: 'Hundred-Billion Giant', desc: 'Reach $100B valuation.', icon: '🏔️', cond: s => val(s) >= 100e9, rep: 5, xp: 80 },
  { id: 'trillion', name: 'Trillion-Dollar Empire', desc: 'Reach $1T valuation.', icon: '👑', cond: s => val(s) >= 1e12, rep: 10, xp: 200 },
  { id: 'ipo', name: 'IPO Success', desc: 'Take your company public.', icon: '🔔', cond: s => s.stock.public, rep: 3, xp: 50 },
  { id: 'global', name: 'Global Expansion', desc: 'Establish presence in 4 regions.', icon: '🌍', cond: s => regionsActive(s) >= 4, rep: 2 },
  { id: 'worldwide', name: 'Everywhere', desc: 'Establish presence in all 7 regions.', icon: '🛰️', cond: s => regionsActive(s) >= 7, rep: 4, xp: 60 },
  { id: 'ai_pioneer', name: 'AI Pioneer', desc: 'Research 6 AI technologies.', icon: '🧠', cond: s => aiTechs(s) >= 6, rep: 2, xp: 40 },
  { id: 'dominator', name: 'Market Dominator', desc: 'Hold 40% share in a category.', icon: '🏆', cond: s => maxShare(s) >= 0.4, rep: 3, xp: 60 },
  { id: 'acq_king', name: 'Acquisition King', desc: 'Own 3 subsidiaries.', icon: '🤝', cond: s => s.ma.subs.length >= 3, rep: 2, xp: 50 },
  { id: 'first_acq', name: 'Deal Maker', desc: 'Complete your first acquisition.', icon: '📑', cond: s => s.ma.subs.length >= 1, xp: 25 },
  { id: 'tech_legend', name: 'Technology Legend', desc: 'Research 3 future technologies and reach stage 6.', icon: '🌟', cond: s => futureTechs(s) >= 3 && s.derived.stage >= 6, rep: 10, xp: 200 },
  { id: 'research_master', name: 'Research Master', desc: 'Complete 25 technologies.', icon: '🔬', cond: s => techCount(s) >= 25, xp: 50 },
  { id: 'research_first', name: 'Eureka', desc: 'Complete a research project.', icon: '💡', cond: s => techCount(s) > stat(s, 'startTechs'), cash: 5000 },
  { id: 'patents10', name: 'Patent Portfolio', desc: 'Hold 10 patents.', icon: '📜', cond: s => s.research.patents.length >= 10, xp: 30 },
  { id: 'hire25', name: 'Growing Team', desc: 'Reach 25 employees.', icon: '👥', cond: s => s.derived.headcount >= 25, xp: 15 },
  { id: 'hire100', name: 'Hire 100', desc: 'Reach 100 employees.', icon: '🏢', cond: s => s.derived.headcount >= 100, xp: 30 },
  { id: 'hire10000', name: 'Employer of Thousands', desc: 'Reach 10,000 employees.', icon: '🏙️', cond: s => s.derived.headcount >= 10000, xp: 80 },
  { id: 'recession', name: 'Survivor', desc: 'Survive a global recession.', icon: '🛡️', cond: s => stat(s, 'recessions') >= 1, rep: 2, xp: 40 },
  { id: 'diversified', name: 'Diversified', desc: 'Have live products in 5 categories.', icon: '🧩', cond: s => liveCats(s) >= 5, xp: 40 },
  { id: 'ecosystem', name: 'Walled Garden', desc: 'Reach an ecosystem score of 60.', icon: '🕸️', cond: s => s.derived.ecosystem.score >= 60, rep: 2, xp: 40 },
  { id: 'rev_billion', name: 'Billion-Dollar Revenue', desc: 'Make $1B of revenue in a year.', icon: '📈', cond: s => s.derived.revYr >= 1e9, xp: 60 },
  { id: 'rev_life', name: 'Seasoned Seller', desc: 'Earn $10M lifetime revenue.', icon: '🧾', cond: s => lifetimeRev(s) >= 10e6, xp: 20 },
  { id: 'cash_hoard', name: 'Cash Dragon', desc: 'Hold $1B cash.', icon: '🐉', cond: s => s.fin.cash >= 1e9, xp: 30 },
  { id: 'debt_free', name: 'Debt Free', desc: 'Reach $50M valuation with zero debt.', icon: '🕊️', cond: s => val(s) >= 50e6 && debt(s) === 0, xp: 20 },
  { id: 'five_star', name: 'Five Stars', desc: 'Have a live product rated 4.6+.', icon: '⭐', cond: s => live(s).some(p => p.rating >= 4.6), xp: 25 },
  { id: 'policy_pioneer', name: 'Good Corporate Citizen', desc: 'Adopt 4 corporate policies.', icon: '🌱', cond: s => Object.values(s.legal.policies).filter(Boolean).length >= 4, rep: 3, xp: 25 },
  { id: 'stage3', name: 'Established', desc: 'Reach stage 3.', icon: '🏛️', cond: s => s.derived.stage >= 3, xp: 30 },
  { id: 'stage5', name: 'Conglomerate', desc: 'Reach stage 5.', icon: '🏗️', cond: s => s.derived.stage >= 5, xp: 80 },
];

// ------------------------------------------------------------ missions ----
export interface MissionDef { id: string; title: string; desc: string; goal: string; after?: string; prog: (s: GameState) => number; cash?: number; perk?: number; rep?: number; xp?: number }
const clamp1 = (x: number) => Math.max(0, Math.min(1, x));
export const MISSIONS: MissionDef[] = [
  { id: 'm_team', title: 'Assemble the Team', desc: 'Grow your staff.', goal: 'Reach 6 employees', prog: s => s.derived.headcount / 6, cash: 15000 },
  { id: 'm_product', title: 'Start a Product', desc: 'Open the Products screen and begin development.', goal: 'Start developing 1 product', after: 'm_team', prog: s => s.products.length >= 1 ? 1 : 0, cash: 10000 },
  { id: 'm_research', title: 'First Research', desc: 'Queue and finish a technology.', goal: 'Complete 1 research project', after: 'm_team', prog: s => techCount(s) > stat(s, 'startTechs') ? 1 : 0, cash: 15000 },
  { id: 'm_launch', title: 'Ship It', desc: 'Test and launch a product.', goal: 'Launch 1 product', after: 'm_product', prog: s => (live(s).length || s.products.some(p => p.launchDay > 0)) ? 1 : 0, cash: 25000, rep: 2 },
  { id: 'm_rev', title: 'First Revenue', desc: 'Earn real customer money.', goal: 'Earn $100K lifetime revenue', after: 'm_launch', prog: s => lifetimeRev(s) / 100000, cash: 30000 },
  { id: 'm_profit', title: 'Break Even', desc: 'Profit in a single month.', goal: 'Close a profitable month', after: 'm_launch', prog: s => s.fin.ledger.hist.some(p => p.ni > 0) ? 1 : s.fin.ledger.last.ni > -1 ? 0.5 : 0, perk: 1, cash: 50000 },
  { id: 'm_two', title: 'Product Line', desc: 'Diversify your lineup.', goal: '2 live products', after: 'm_launch', prog: s => live(s).length / 2, cash: 40000 },
  { id: 'm_team25', title: 'Scale Up', desc: 'Grow the company.', goal: 'Reach 25 employees', after: 'm_profit', prog: s => s.derived.headcount / 25, perk: 1 },
  { id: 'm_val20', title: 'Growing Company', desc: 'Reach stage 2.', goal: '$20M valuation', after: 'm_two', prog: s => val(s) / 20e6, cash: 150000, xp: 40 },
  { id: 'm_region', title: 'Go International', desc: 'Open an office abroad.', goal: 'Presence in 2 regions', after: 'm_val20', prog: s => regionsActive(s) / 2, cash: 200000, rep: 2 },
  { id: 'm_cats3', title: 'Platform Thinking', desc: 'Build products that reinforce each other.', goal: 'Live in 3 categories', after: 'm_two', prog: s => liveCats(s) / 3, perk: 1 },
  { id: 'm_ipo', title: 'Ring the Bell', desc: 'Go public via the Stock Market screen.', goal: 'Complete an IPO', after: 'm_val20', prog: s => s.stock.public ? 1 : clamp1(val(s) / 100e6) * 0.6, perk: 1, rep: 3 },
  { id: 'm_acq', title: 'Acquire a Company', desc: 'Buy a startup or rival.', goal: 'Own a subsidiary', after: 'm_val20', prog: s => s.ma.subs.length >= 1 ? 1 : 0, cash: 500000 },
  { id: 'm_val500', title: 'Established Tech Company', desc: 'Reach stage 3.', goal: '$500M valuation, 2 regions', after: 'm_region', prog: s => Math.min(val(s) / 500e6, 1) * 0.7 + Math.min(1, regionsActive(s) / 2) * 0.3, perk: 1, xp: 80 },
  { id: 'm_billion', title: 'Unicorn', desc: 'Become a billion-dollar company.', goal: '$1B valuation', after: 'm_val500', prog: s => val(s) / 1e9, perk: 1, cash: 2e6 },
  { id: 'm_giant', title: 'Global Technology Giant', desc: 'Reach stage 4.', goal: '$25B valuation, public', after: 'm_billion', prog: s => Math.min(1, val(s) / 25e9) * (s.stock.public ? 1 : 0.8), perk: 2, xp: 120 },
  { id: 'm_future', title: 'Touch the Future', desc: 'Research a future technology.', goal: 'Complete 1 future tech', after: 'm_giant', prog: s => futureTechs(s), perk: 1 },
  { id: 'm_trillion', title: 'Trillion-Dollar Empire', desc: 'The ultimate goal.', goal: '$1T valuation', after: 'm_future', prog: s => val(s) / 1e12, perk: 3, xp: 300 },
];
const MDEF: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
export function missionProgress(s: GameState, id: string): number { const d = MDEF[id]; return d ? clamp1(d.prog(s)) : 0; }
export function missionAvailable(s: GameState, m: Mission): boolean { const d = MDEF[m.id]; if (!d?.after) return true; return !!s.meta.missions.find(x => x.id === d.after)?.done; }
export function rewardText(d: MissionDef) { return [d.cash ? `$${d.cash.toLocaleString()}` : '', d.perk ? `${d.perk} perk pt` : '', d.rep ? `+${d.rep} rep` : '', d.xp ? `${d.xp} xp` : ''].filter(Boolean).join(' · ') || 'Prestige'; }
export function claimMission(s: GameState, id: string): { ok: boolean; msg: string } {
  const m = s.meta.missions.find(x => x.id === id), d = MDEF[id]; if (!m || !d) return { ok: false, msg: 'Unknown mission' };
  if (!m.done) return { ok: false, msg: 'Not complete yet' }; if (m.claimed) return { ok: false, msg: 'Already claimed' };
  m.claimed = true; if (d.cash) revenue(s, d.cash, 'other'); if (d.perk) s.co.ceo.perkPoints += d.perk; if (d.rep) s.marketing.reputation = clamp(s.marketing.reputation + d.rep); addXp(s, d.xp ?? 15);
  sfx('cash'); return { ok: true, msg: `Reward claimed: ${rewardText(d)}` };
}
export function objectivesForDashboard(s: GameState): { id: string; title: string; goal: string; progress: number; reward: string; claimable: boolean }[] {
  const out: any[] = [];
  for (const m of s.meta.missions) { if (m.claimed) continue; const d = MDEF[m.id]; if (!d || !missionAvailable(s, m)) continue; out.push({ id: m.id, title: d.title, goal: d.goal, progress: m.done ? 1 : missionProgress(s, m.id), reward: rewardText(d), claimable: m.done }); }
  out.sort((a, b) => Number(b.claimable) - Number(a.claimable));
  return out.slice(0, 4);
}

// ------------------------------------------------------------ challenges --
export interface ChallengeDef { id: string; name: string; desc: string; cond: (s: GameState) => boolean; fail?: (s: GameState) => boolean }
export const CHALLENGES: ChallengeDef[] = [
  { id: 'ch_lean', name: 'Lean Machine', desc: 'Reach $10M valuation with 15 or fewer staff.', cond: s => val(s) >= 10e6 && s.derived.headcount <= 15 },
  { id: 'ch_fast', name: 'Blitzscale', desc: 'Reach $1B valuation within 8 years.', cond: s => val(s) >= 1e9 && s.day <= 8 * 365 },
  { id: 'ch_green', name: 'Conscientious Capitalist', desc: 'Reach $100M valuation with Green, Privacy-First and Fair Work policies active.', cond: s => val(s) >= 100e6 && !!s.legal.policies.green && !!s.legal.policies.privacyfirst && !!s.legal.policies.fairwork },
  { id: 'ch_nodebt', name: 'Bootstrapped Giant', desc: 'Reach $250M valuation having never raised equity or debt.', cond: s => val(s) >= 250e6 && s.fin.rounds.length === 0 && !s.meta.stats.tookDebt },
  { id: 'ch_open', name: 'Open Ecosystem', desc: 'Reach 70 developer adoption.', cond: s => s.derived.ecosystem.devAdoption >= 70 },
  { id: 'ch_clean', name: 'Squeaky Clean', desc: 'Hold 75+ compliance in every area while valued above $500M.', cond: s => val(s) >= 500e6 && Object.values(s.legal.compliance).every(v => v >= 75) },
];

// ------------------------------------------------------------ CEO perks ---
export interface PerkDef { id: string; name: string; icon: string; desc: string; mult: Record<string, number>; cost: number }
export const PERKS: PerkDef[] = [
  { id: 'visionary', name: 'Visionary', icon: '🔭', desc: 'Research output +10%.', mult: { research: 1.1 }, cost: 1 },
  { id: 'engineer', name: 'Hands-on Engineer', icon: '🛠️', desc: 'Product development 8% faster.', mult: { dev: 1.08 }, cost: 1 },
  { id: 'frugal', name: 'Frugal Operator', icon: '🪙', desc: 'Overhead and facility costs −6%.', mult: { overhead: 0.94 }, cost: 1 },
  { id: 'charisma', name: 'Charismatic Leader', icon: '🎤', desc: 'Candidates are better; morale +3.', mult: { hiring: 1.08, happy: 1.03 }, cost: 1 },
  { id: 'marketer', name: 'Master Marketer', icon: '📣', desc: 'Marketing effectiveness +10%.', mult: { marketing: 1.1 }, cost: 1 },
  { id: 'dealmaker', name: 'Dealmaker', icon: '🤝', desc: 'Acquisition premiums −8%, integration cheaper.', mult: { ma: 0.92 }, cost: 1 },
  { id: 'negotiator', name: 'Hard Negotiator', icon: '📉', desc: 'Interest rates −10%.', mult: { interest: 0.9 }, cost: 1 },
  { id: 'networker', name: 'Valley Networker', icon: '🌐', desc: 'Raise equity at 10% better valuations.', mult: { vc: 1.1 }, cost: 1 },
  { id: 'counsel', name: 'Legal Mind', icon: '⚖️', desc: 'Legal costs −15%, better case odds.', mult: { legal: 0.85 }, cost: 1 },
  { id: 'globalist', name: 'Globalist', icon: '🧭', desc: 'International expansion 10% cheaper & faster.', mult: { expansion: 1.1 }, cost: 1 },
  { id: 'culture', name: 'Culture Builder', icon: '🫂', desc: 'Retention +10%.', mult: { loyalty: 1.1 }, cost: 1 },
  { id: 'ironwill', name: 'Iron Will', icon: '🔥', desc: 'Bad events hit 15% softer.', mult: { events: 0.85 }, cost: 2 },
];
/** Multiplier from CEO perks for a key: research, dev, overhead, hiring, happy, marketing, ma, interest, vc, legal, expansion, loyalty, events */
export function perkMult(s: GameState, key: string): number {
  let m = 1; for (const id of s.co.ceo.perks) { const p = PERKS.find(x => x.id === id); if (p?.mult[key]) m *= p.mult[key]; } return m;
}
export function buyPerk(s: GameState, id: string): { ok: boolean; msg: string } {
  const p = PERKS.find(x => x.id === id); if (!p) return { ok: false, msg: 'Unknown perk' };
  if (s.co.ceo.perks.includes(id)) return { ok: false, msg: 'Already owned' };
  if (s.co.ceo.perkPoints < p.cost) return { ok: false, msg: `Needs ${p.cost} perk point(s)` };
  s.co.ceo.perkPoints -= p.cost; s.co.ceo.perks.push(id); sfx('success'); return { ok: true, msg: `${p.name} acquired` };
}
export const xpForLevel = (lv: number) => Math.round(80 * Math.pow(lv, 1.5));
export function addXp(s: GameState, n: number) {
  const c = s.co.ceo; c.xp += n;
  while (c.xp >= xpForLevel(c.level)) { c.xp -= xpForLevel(c.level); c.level++; c.perkPoints++; toast(`CEO level ${c.level}! +1 perk point`, 'good', 'achievement'); }
}

// -------------------------------------------------------------- engine ----
export function init(s: GameState): void {
  s.meta.stats.startTechs = techCount(s);
  s.meta.missions = MISSIONS.map(d => ({ id: d.id, title: d.title, desc: d.desc, goal: d.goal, reward: rewardText(d), done: false, day: 0, claimed: false }));
}
function unlock(s: GameState, a: AchDef) {
  s.meta.ach[a.id] = s.day; if (a.cash) revenue(s, a.cash, 'other'); if (a.rep) s.marketing.reputation = clamp(s.marketing.reputation + a.rep); addXp(s, a.xp ?? 15);
  toast(`🏆 Achievement: ${a.name}`, 'good', 'achievement'); addNews(s, `${s.co.name} earns "${a.name}"`, a.desc, 'company', 'good'); logEntry(s, `Achievement unlocked: ${a.name}`, 'good');
}
function evalAll(s: GameState) {
  const d = s.derived;
  const st = computeStage(s); if (st > s.meta.stage) {
    s.meta.stage = st; s.meta.stageDay[st] = s.day; d.stage = st; s.co.ceo.perkPoints += 1; addXp(s, 100);
    const info = STAGES[st - 1]; toast(`Stage ${st}: ${info.name}! (+1 perk point)`, 'good', 'achievement'); addNews(s, `${s.co.name} becomes a ${info.name}`, info.blurb, 'company', 'good'); logEntry(s, `Reached stage ${st}: ${info.name}`, 'good');
  }
  d.stage = s.meta.stage;
  const pk = s.meta.peak; pk.valuation = Math.max(pk.valuation, d.valuation); pk.revenue = Math.max(pk.revenue, d.revYr); pk.cash = Math.max(pk.cash, s.fin.cash);
  for (const a of ACHIEVEMENTS) if (!s.meta.ach[a.id] && s.meta.ach[a.id] === undefined) { try { if (a.cond(s)) unlock(s, a); } catch { /* defensive */ } }
  for (const m of s.meta.missions) if (!m.done && missionAvailable(s, m) && missionProgress(s, m.id) >= 1) { m.done = true; m.day = s.day; toast(`Objective complete: ${m.title} — claim your reward`, 'good', 'success'); }
  for (const c of CHALLENGES) if (!s.meta.challengeDone[c.id] && c.cond(s)) { s.meta.challengeDone[c.id] = true; addXp(s, 60); s.co.ceo.perkPoints += 1; toast(`Challenge complete: ${c.name} (+1 perk point)`, 'good', 'achievement'); addNews(s, `Challenge complete: ${c.name}`, c.desc, 'company', 'good'); }
  if (debt(s) > 0) s.meta.stats.tookDebt = 1;
}
export function daily(s: GameState): void { if (s.day % 5 === 0) evalAll(s); }
export function monthly(s: GameState): void { evalAll(s); s.meta.stats.months = (s.meta.stats.months || 0) + 1; }
export { evalAll as _evaluate };
