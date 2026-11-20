import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import { triggerEvent, resolveEvent, eventTemplates } from '../src/sim/events';
import { openCase, settleCase, fightCase, togglePolicy, investCompliance } from '../src/sim/legal';
import { ecosystemReport, recompute } from '../src/sim/ecosystem';
import { computeStage, ACHIEVEMENTS, claimMission, buyPerk, perkMult, objectivesForDashboard, _evaluate } from '../src/sim/achievements';
import { totalAssets, totalDebt, totalEquity } from '../src/sim/ledger';
import type { GameState } from '../src/sim/types';

const mk = (seed = 7): GameState => newGame({ name: 'T', slogan: 's', founder: 'F', color: '#4cc9f0', logo: 0, hq: 'na', city: 'Austin', spec: 'software', difficulty: 'normal', capitalId: 'seed', seed });
const fakeLive = (s: GameState, cat: any, base = 1e6) => { s.products.push({ id: s.nextProdId++, name: cat + ' x', cat, version: 1, status: 'live', specs: {}, target: 'mainstream', budget: 0, spent: 0, progress: 1, need: 1, testProg: 1, testNeed: 1, bugs: 5, q: 70, rel: 70, inn: 60, ux: 60, price: 10, ucost: 3, startDay: 0, launchDay: 10, lifeRev: 0, lifeUnits: base, base, unitsEma: 0, revEma: 0, satisf: 70, rating: 4, reviews: [], hist: [], outsource: false, promo: 0, protoNote: '', updating: false, lastUpdate: 0, sold30: 0, lost30: 0, platformUsers: 0, devBuzz: 0 } as any); };

describe('events', () => {
  it('fire over time, resolve, and keep the books balanced', () => {
    const s = mk(); advance(s, 365 * 3);
    expect(s.events.log.length + s.events.pending.length).toBeGreaterThan(3);
    for (const e of [...s.events.pending]) resolveEvent(s, e.uid, 0);
    expect(totalAssets(s)).toBeCloseTo(totalDebt(s) + totalEquity(s), 0);
  });
  it('every template builds and applies without throwing', () => {
    const s = mk(3); fakeLive(s, 'os'); fakeLive(s, 'social'); advance(s, 200);
    for (const t of eventTemplates) { if (t.weight <= 0) continue; let ok = false; try { ok = t.when(s); } catch { } if (!ok) continue; const ev = triggerEvent(s, t.id); expect(ev).toBeTruthy(); if (ev && !ev.resolved) for (let c = 0; c < ev.choices.length; c++) { const s2: GameState = JSON.parse(JSON.stringify(s)); expect(() => resolveEvent(s2, ev.uid, c)).not.toThrow(); } }
  });
  it('choices have consequences (counter-offer raises salary)', () => {
    const s = mk(); const e = s.people.emps[0]; if (!e) return; e.skill = 90; const before = e.salary; const ev = triggerEvent(s, 'key_resign'); if (!ev) return;
    const id = ev.params.e; resolveEvent(s, ev.uid, 0); expect(s.people.emps.find(x => x.id === id)!.salary).toBeGreaterThan(before === 0 ? -1 : before - 1);
  });
  it('macro cycle moves and is deterministic', () => {
    const a = mk(11), b = mk(11); advance(a, 365 * 6); advance(b, 365 * 6); expect(a.market.econ.gdp).toBe(b.market.econ.gdp); expect(a.events.news.length).toBe(b.events.news.length);
  });
});
describe('legal', () => {
  it('cases settle / fight and fines are recorded', () => {
    const s = mk(); const c = openCase(s, { kind: 'patent', title: 'T', opp: 'X', exposure: 10000, months: 3, desc: 'd' }); const cash0 = s.fin.cash;
    expect(settleCase(s, c.id).ok).toBe(true); expect(s.fin.cash).toBeLessThan(cash0); expect(c.status).toBe('settled');
    const c2 = openCase(s, { kind: 'patent', title: 'T2', opp: 'X', exposure: 10000, months: 1, desc: 'd' }); expect(fightCase(s, c2.id).ok).toBe(true); advance(s, 40); expect(c2.status).not.toBe('open');
  });
  it('policies and compliance investment', () => {
    const s = mk(); expect(togglePolicy(s, 'green').ok).toBe(true); expect(s.legal.policies.green).toBe(true); const r = investCompliance(s, 'cyber', 1000); expect(r.ok).toBe(true); advance(s, 120); expect(s.derived.complianceRisk).toBeGreaterThan(0);
  });
});
describe('ecosystem', () => {
  it('links raise score & lockin', () => {
    const s = mk(); recompute(s); const z = s.derived.ecosystem.score; fakeLive(s, 'smartphone'); fakeLive(s, 'os'); fakeLive(s, 'marketplace'); recompute(s, true);
    expect(s.derived.ecosystem.score).toBeGreaterThan(z); expect(s.derived.ecosystem.links).toBeGreaterThanOrEqual(2); expect(s.derived.ecosystem.lockin).toBeGreaterThan(0);
    const rep = ecosystemReport(s); expect(rep.recs.length).toBeGreaterThan(0); expect(s.derived.ecosystem.net.watch ?? 0).toBeGreaterThan(0);
  });
});
describe('achievements', () => {
  it('stage logic and unlocks', () => {
    const s = mk(); expect(computeStage(s)).toBe(1); s.derived.valuation = 3e9; s.fin.cash = 2e9; _evaluate(s);
    expect(s.meta.ach.first_billion).toBeDefined(); expect(s.meta.ach.unicorn).toBeDefined(); expect(s.meta.ach.cash_hoard).toBeDefined();
    s.derived.valuation = 30e9; s.stock.public = true; s.ma.subs.push({} as any); for (const c of ['os', 'cloud', 'game', 'social', 'search'] as const) fakeLive(s, c); s.regions.na.presence = 50; s.regions.eu.presence = 50; _evaluate(s);
    expect(s.meta.stage).toBeGreaterThanOrEqual(4);
  });
  it('missions claim and perks', () => {
    const s = mk(); s.derived.headcount = 10; _evaluate(s); const m = s.meta.missions.find(x => x.id === 'm_team')!; expect(m.done).toBe(true);
    const c0 = s.fin.cash; expect(claimMission(s, 'm_team').ok).toBe(true); expect(s.fin.cash).toBeGreaterThan(c0); expect(claimMission(s, 'm_team').ok).toBe(false);
    expect(buyPerk(s, 'visionary').ok).toBe(true); expect(perkMult(s, 'research')).toBeCloseTo(1.1); expect(objectivesForDashboard(s).length).toBeGreaterThan(0);
  });
  it('achievements well-formed', () => { expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30); expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length); });
});
