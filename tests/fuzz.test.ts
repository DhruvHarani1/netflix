// Fuzz soak: hammer every player action with random arguments; the sim must never throw, never produce NaN, never unbalance.
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import { rnd, rint, pick } from '../src/sim/util';
import * as P from '../src/sim/products';
import * as people from '../src/sim/people';
import * as R from '../src/sim/research';
import * as F from '../src/sim/facilities';
import * as MK from '../src/sim/marketing';
import * as EX from '../src/sim/expansion';
import * as FIN from '../src/sim/finance';
import * as ST from '../src/sim/stock';
import * as MA from '../src/sim/ma';
import * as LG from '../src/sim/legal';
import * as EV from '../src/sim/events';
import * as AC from '../src/sim/achievements';
import { serialize, deserialize } from '../src/sim/save';
import { CATS, CAT } from '../src/data/categories';
import { TECH } from '../src/data/research';
import { REGIONS, DEPTS, SPECIALIZATIONS, POLICIES, SEGS } from '../src/data/core';
import { issueEquity, totalAssets, totalEquity, totalDebt } from '../src/sim/ledger';
import type { GameState, Dept, Difficulty, Channel } from '../src/sim/types';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'nightmare', 'sandbox'];
const CH: Channel[] = ['tv', 'social', 'influencer', 'search', 'sponsor', 'event', 'pr', 'global'];
function finite(o: any, path = '', seen = new Set<any>()): string | null {
  if (typeof o === 'number') return Number.isFinite(o) ? null : `${path}=${o}`;
  if (!o || typeof o !== 'object' || seen.has(o)) return null; seen.add(o);
  for (const k of Object.keys(o)) { const r = finite(o[k], path + '.' + k, seen); if (r) return r; } return null;
}
function randomAction(s: GameState, errs: string[]) {
  const a = rint(s, 0, 22); const tag = `a${a}`;
  try {
    const live = s.products.filter(p => p.status === 'live'); const any = s.products.length ? pick(s, s.products) : null; const emp = s.people.emps.length ? pick(s, s.people.emps) : null;
    const rival = pick(s, s.rivals);
    switch (a) {
      case 0: { const d = pick(s, DEPTS).id; const c = people.listCandidates(s).find(c => c.dept === d) || people.listCandidates(s)[0]; if (c) { if (rnd(s) < .5) people.interview(s, c.id); people.hire(s, c.id, c.ask * (0.8 + rnd(s) * 0.5)); } break; }
      case 1: people.hireTeam(s, pick(s, DEPTS).id as Dept, rint(s, 2, 30), rint(s, 30, 90)); break;
      case 2: if (emp) people.fire(s, emp.id); break;
      case 3: people.layoff(s, pick(s, DEPTS).id as Dept, rnd(s) * 0.5); break;
      case 4: if (emp) { people.promote(s, emp.id); people.giveRaise(s, emp.id, rnd(s) * 0.3); people.train(s, emp.id, pick(s, ['skill', 'mgmt', 'leadership'])); people.setLeader(s, emp.dept, emp.id); } break;
      case 5: { const t = pick(s, TECH); R.startResearch(s, t.id); if (rnd(s) < .2) R.cancelResearch(s, t.id); R.setBudgetBoost(s, rnd(s) * 2); break; }
      case 6: { const c = pick(s, CATS); const specs = P.defaultSpecs(s, c); for (const k in specs) specs[k] = rint(s, 1, 10); const r = P.createProduct(s, { cat: c.id, name: 'F' + s.nextProdId, target: pick(s, SEGS), specs, budget: P.recommendedBudget(s, c, specs) * (0.2 + rnd(s) * 1.5), outsource: rnd(s) < .7 }); if (r.ok) P.autoAssign(s, r.id!); break; }
      case 7: for (const p of s.products) { if (p.status === 'prototype') rnd(s) < .6 ? P.startTesting(s, p.id) : P.skipTesting(s, p.id); else if (p.status === 'ready') { P.setPrice(s, p.id, p.price * (0.5 + rnd(s))); P.launch(s, p.id); } else if (p.stalled) P.topUpBudget(s, p.id, p.budget * 0.3); } break;
      case 8: if (any) { P.setPrice(s, any.id, Math.max(0.01, any.price * (0.4 + rnd(s) * 1.5))); P.setOutsource(s, any.id, rnd(s) < .5); } break;
      case 9: if (live.length) { const p = pick(s, live); const sp = { ...p.specs }; for (const x of CAT[p.cat].specs) sp[x.key] = Math.min(10, sp[x.key] + rint(s, 0, 2)); P.startUpdate(s, p.id, { specs: sp, budget: P.recommendedBudget(s, CAT[p.cat], sp) * 0.45 }); P.autoAssign(s, p.id); P.patchBugs(s, p.id); if (rnd(s) < .1) P.retire(s, p.id); } break;
      case 10: F.buildFacility(s, pick(s, ['office', 'hq', 'lab', 'datacenter', 'factory', 'fab', 'warehouse', 'testing', 'campus'] as const), pick(s, REGIONS).id, rnd(s) < .5, rint(s, 1, 3)); break;
      case 11: if (s.facilities.length) { const f = pick(s, s.facilities); rnd(s) < .7 ? F.upgradeFacility(s, f.id, pick(s, ['capacity', 'compute', 'security', 'amenities', 'energy', 'equipment', 'automation'] as const)) : rnd(s) < .5 ? F.sellFacility(s, f.id) : F.buyoutFacility(s, f.id); } break;
      case 12: MK.launchCampaign(s, { channel: pick(s, CH), budget: rint(s, 5, 400) * 1000, months: rint(s, 1, 12), product: live.length && rnd(s) < .5 ? pick(s, live).id : null, region: rnd(s) < .5 ? 'all' : pick(s, REGIONS).id }); if (s.marketing.campaigns.length > 4) MK.stopCampaign(s, s.marketing.campaigns[0].id); if (rnd(s) < .1) MK.runPR(s, pick(s, ['apology', 'charity', 'press', 'crisis', 'rebrand']) as any); break;
      case 13: pick(s, [EX.openOffice, EX.upgradeToRegionalHQ, EX.buildDistribution, EX.signPartner, EX.createSubsidiary])(s, pick(s, REGIONS).id); break;
      case 14: FIN.takeLoan(s, pick(s, ['bank', 'bond', 'credit'] as const), rint(s, 1, 50) * 1e5 * (1 + (s.derived.valuation > 1e8 ? 100 : 0)), rint(s, 1, 10)); if (s.fin.loans.length) FIN.repayLoan(s, pick(s, s.fin.loans).id, rnd(s) * 3e6); break;
      case 15: FIN.raiseVC(s, rint(s, 0, 3), 0.1 + rnd(s) * 0.2 as any); (FIN as any).sellEquity?.(s, rnd(s) * 1e7); FIN.setDividend(s, rnd(s) < .5 ? 0 : rnd(s) * 0.3); rnd(s) < .5 ? FIN.startBuyback(s) : FIN.stopBuyback(s); break;
      case 16: if (!s.stock.public) (ST as any).launchIPO(s, { price: Math.max(0.5, s.derived.valuation / s.fin.shares * (0.7 + rnd(s) * 0.6)), shares: Math.round(s.fin.shares * (0.05 + rnd(s) * 0.2)) }); else if (rival) { ST.buyShares(s, rival.id, rint(s, 1, 100000)); ST.sellShares(s, rival.id, rint(s, 1, 50000)); } break;
      case 17: if (rival && rival.status === 'active') { const r = MA.makeOffer(s, rival.id, 0.1 + rnd(s) * 0.6); const o = s.ma.offers.find(o => o.status === 'countered'); if (o) rnd(s) < .5 ? MA.acceptCounter(s, o.id) : MA.rejectCounter(s, o.id); } break;
      case 18: if (rival && rival.status === 'active') { ST.buyShares(s, rival.id, rint(s, 1000, 5e6)); MA.hostileTakeover(s, rival.id, 0.2 + rnd(s) * 0.5); } break;
      case 19: if (s.ma.subs.length) { const sub = pick(s, s.ma.subs); rnd(s) < .5 ? MA.sellSubsidiary(s, sub.id) : MA.spinOff(s, sub.id); } break;
      case 20: LG.togglePolicy(s, pick(s, POLICIES).id); LG.investCompliance(s, pick(s, ['privacy', 'safety', 'antitrust', 'employment', 'environment', 'cyber', 'trade', 'ip'] as const), rint(s, 1, 200) * 1000); for (const c of s.legal.cases) if (c.status === 'open') rnd(s) < .5 ? LG.settleCase(s, c.id) : LG.fightCase(s, c.id); break;
      case 21: for (const e of s.events.pending) if (!e.resolved && e.choices.length) EV.resolveEvent(s, e.uid, rint(s, 0, e.choices.length - 1)); break;
      case 22: for (const m of s.meta.missions) if (m.done && !m.claimed) AC.claimMission(s, m.id); AC.buyPerk(s, pick(s, ['research', 'dev', 'overhead', 'hiring', 'marketing', 'ma', 'interest', 'vc', 'legal', 'expansion', 'loyalty']) as any); break;
    }
  } catch (e: any) { errs.push(`${tag}: ${e?.message}\n${(e?.stack || '').split('\n').slice(1, 3).join('\n')}`); }
}
describe('fuzz soak', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15]) {
    it(`seed ${seed}: 8 years of random actions`, () => {
      const spec = SPECIALIZATIONS[seed * 5 % SPECIALIZATIONS.length].id; const diff = DIFFS[seed % DIFFS.length];
      const s = newGame({ name: 'Fuzz' + seed, slogan: '', founder: 'F', color: '#fff', logo: 0, hq: REGIONS[seed % 7].id, city: 'X', spec, difficulty: diff, capitalId: ['bootstrap', 'seed', 'series', 'founder', 'loan'][seed % 5], seed });
      const errs: string[] = [];
      for (let m = 0; m < 96 && !s.gameOver; m++) {
        if (seed % 2 === 1 && s.fin.cash < 5e6) issueEquity(s, 2e7);
        for (let k = 0; k < 8; k++) randomAction(s, errs);
        try { advance(s, 30); } catch (e: any) { errs.push('ADVANCE: ' + e.stack); break; }
        if (m % 24 === 23) { const s2 = deserialize(serialize(s)); expect(s2.day).toBe(s.day); expect(s2.fin.cash).toBeCloseTo(s.fin.cash, 0); }
      }
      const nan = finite(s);
      const bal = totalAssets(s) - totalDebt(s) - totalEquity(s);
      if (errs.length) console.log(`seed ${seed} (${spec}/${diff}) errors:\n` + [...new Set(errs)].slice(0, 6).join('\n'));
      expect(nan, 'non-finite value').toBeNull();
      expect(Math.abs(bal), 'balance sheet imbalance').toBeLessThan(10);
      expect(errs.length, errs.slice(0, 3).join('\n')).toBe(0);
    }, 120000);
  }
});
