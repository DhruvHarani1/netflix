import type { GameState, Dept, RegionId, Seg, CatId, ComplianceKey, SpecId, Difficulty, DeptDerived } from './types';
import { DEPTS, SEGS, REGIONS, DIFF, CAPITALS, SPEC } from '../data/core';
import { CATS } from '../data/categories';
import { emptyLedger } from './ledger';
import { MODULES } from './engine';

export interface NewGameConfig {
  name: string; slogan: string; founder: string; color: string; logo: number; hq: RegionId; city: string; spec: SpecId;
  difficulty: Difficulty; capitalId: string; seed?: number;
}
export const SAVE_VERSION = 1;
export const START_SHARES = 10_000_000;

const zeroDept = (): DeptDerived => ({ heads: 0, output: 0, avgHappy: 70, avgSkill: 0, leader: null, eff: 1, payroll: 0 });

export function newGame(cfg: NewGameConfig): GameState {
  const diff = DIFF[cfg.difficulty]; const cap = CAPITALS.find(c => c.id === cfg.capitalId) || CAPITALS[1];
  const specDef = SPEC[cfg.spec];
  const capital = Math.round(cap.amount * diff.capital * (specDef.cashMult || 1) / 1000) * 1000;
  const seed = cfg.seed ?? (Math.random() * 2 ** 31) | 0;
  const dept = {} as Record<Dept, DeptDerived>; for (const d of DEPTS) dept[d.id] = zeroDept();
  const awareness = {} as Record<Seg, number>; for (const sg of SEGS) awareness[sg] = 2;
  const regions = {} as GameState['regions'];
  for (const r of REGIONS) regions[r.id] = { id: r.id, presence: 0, office: 0, distribution: false, partner: false, subsidiary: false, since: 0, target: 0, revenueEma: 0, regulationRisk: 20 };
  const compliance = {} as Record<ComplianceKey, number>; for (const k of ['privacy', 'safety', 'antitrust', 'employment', 'environment', 'cyber', 'trade', 'ip'] as ComplianceKey[]) compliance[k] = 55;
  const cats = {} as GameState['market']['cats'];
  for (const c of CATS) cats[c.id] = { size: c.size, growth: c.growth, ref: c.ref, trend: 0, avgQ: c.startQ, frontierQ: c.startQ + 8, rev30: 0, units30: 0, shares: {}, playerShare: 0, unlocked: false, saturation: c.adopt ?? .5 };
  const debt = cap.debt * diff.capital;
  const s: GameState = {
    v: SAVE_VERSION, seed, rng: seed >>> 0, day: 0, mode: cfg.difficulty === 'sandbox' ? 'sandbox' : 'normal', difficulty: cfg.difficulty,
    co: { name: cfg.name, slogan: cfg.slogan, founder: cfg.founder, color: cfg.color, logo: cfg.logo, hq: cfg.hq, city: cfg.city, spec: cfg.spec, startDay: 0, ceo: { level: 1, xp: 0, perkPoints: 1, perks: [] } },
    fin: { cash: capital, loans: [], ledger: emptyLedger(), nextLoanId: 1, shares: START_SHARES, founderShares: START_SHARES, treasury: 0, rounds: [], creditScore: 640, insolventDays: 0, bankrupt: false, dividendPerShare: 0, buybackActive: false, lastTaxMonthNI: 0 },
    people: { emps: [], pool: [], nextId: 1, conflicts: [], policy: { wage: 1, perks: 0, remote: false } },
    research: { done: {}, active: [], slots: 1, patents: [], breakthroughs: 0, failures: 0, budgetBoost: 0, log: [] },
    facilities: [], nextFacId: 1, products: [], nextProdId: 1,
    marketing: { campaigns: [], nextId: 1, awareness, reputation: 20 + cap.rep, loyalty: 30, positioning: 0, history: [] },
    regions, rivals: [],
    market: { cats, econ: { cycle: 'normal', cycleDays: 600, gdp: 2.6, confidence: 60, rate: .045 + diff.rate, inflation: .025, demandMult: 1, unemployment: .05 }, year: 2026 },
    stock: { public: false, px: 0, pxHist: [], ipoDay: 0, ipoPx: 0, sentiment: 55, fair: 0, analysts: { buy: 0, hold: 0, sell: 0, target: 0 }, inst: 0, retail: 0, index: [1000], indexDay: [0], portfolio: {}, nextEarnings: 90, lastSurprise: 0, expectedEPS: 0, lastEPS: 0, volume: 0, hi52: 0, lo52: 0, shortInterest: 0 },
    ma: { subs: [], offers: [], nextOfferId: 1, history: [] },
    events: { pending: [], log: [], nextUid: 1, cooldown: {}, news: [], nextNews: 1, flags: {} },
    legal: { compliance, policies: {}, cases: [], nextId: 1, fines: 0, watch: 10, investigations: [] },
    meta: { ach: {}, missions: [], stage: 1, stageDay: { 1: 0 }, peak: { valuation: 0, revenue: 0, cash: capital }, challengeDone: {}, stats: {} },
    derived: {
      dept, payroll: 0, headcount: 0, officeCap: 0, rpPerDay: 0, service: 40, mfgCap: 0, dcCap: 0, labBonus: 1, testBonus: 1, happinessBonus: 0,
      ecosystem: { score: 0, lockin: 0, net: {}, devAdoption: 0, links: 0 }, brand: 20, valuation: capital, mcap: capital, stage: 1, marketShare: 0, revYr: 0, profitYr: 0, growth: 0, complianceRisk: 1, rivalPressure: 0,
    },
    hist: [], log: [], gameOver: null, cheats: false, sandboxCash: cfg.difficulty === 'sandbox', flags: { uid: 1000 },
  };
  s.fin.ledger.paidIn = capital - debt;
  if (debt > 0) { s.fin.loans.push({ id: s.fin.nextLoanId++, name: 'Launch Bank Loan', principal: debt, rate: .075 + diff.rate, monthly: Math.round(debt / 84), kind: 'bank', taken: 0 }); }
  // initialise all modules in dependency order
  const M = MODULES;
  M.market.init(s); M.research.init(s); M.facilities.init(s); M.people.init(s); M.finance.init(s); M.marketing.init(s); M.expansion.init(s);
  M.rivals.init(s); M.ecosystem.init(s); M.stock.init(s); M.ma.init(s); M.products.init(s); M.legal.init(s); M.events.init(s); M.achievements.init(s);
  return s;
}
