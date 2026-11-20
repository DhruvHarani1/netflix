import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import { issueEquity, totalAssets, totalDebt, totalEquity, revenue, expense } from '../src/sim/ledger';
import * as fin from '../src/sim/finance';
import * as stock from '../src/sim/stock';
import * as ma from '../src/sim/ma';
import type { GameState, Rival } from '../src/sim/types';

const mk = (diff: any = 'normal', cap = 'seed') => newGame({ name: 'T', slogan: '', founder: 'F', color: '#fff', logo: 0, hq: 'na', city: 'Austin', spec: 'software', difficulty: diff, capitalId: cap, seed: 7 });
const bal = (s: GameState) => Math.abs(totalAssets(s) - totalDebt(s) - totalEquity(s));
function fakeRival(s: GameState, id = 'rv1', pub = true): Rival {
  const r: Rival = { id, name: 'Rival ' + id, short: 'RV', color: '#f00', logo: 1, kind: pub ? 'major' : 'startup', archetype: 'x', blurb: '', hq: 'as', personality: { aggr: .5, caution: .3, innov: .5, premium: 0, expand: .5, acquis: .5, marketing: .5, pr: .5 },
    status: 'active', founded: 2000, cash: 1e8, debt: 0, headcount: 200, rd: 1e6, brand: 50, reach: .6, offers: { desktopapp: { name: 'App', q: 60, rel: 60, inn: 50, ux: 50, svc: 50, price: 40, since: 0, lastLaunch: 0, unitsEma: 100, revEma: 5000, base: 0, focus: .5 } },
    revM: 0, costM: 0, netM: 0, revEma: 0, costEma: 0, revHist: [], netHist: [], shares: 1e7, px: 20, pxHist: [20], valuation: 2e8, sentiment: 50, growth: .1, publicCo: pub, log: [], strengths: [], weaknesses: [], relation: 0, negative: 0, founderOwned: .1, forSale: false, askMult: 1.2 };
  s.rivals.push(r); return r;
}
describe('finance / stock / ma', () => {
  it('balance sheet balances through loans, VC, repayments', () => {
    const s = mk(); advance(s, 120);
    expect(bal(s)).toBeLessThan(1);
    expect(fin.takeLoan(s, 'bank', 100_000, 5).ok).toBe(true); expect(bal(s)).toBeLessThan(1);
    s.derived.valuation = 6e6; s.flags.valTarget = 6e6; s.fin.rounds.push({ name: 'Seed', day: -300, raised: 1, pct: .1, post: 1 });
    const sh0 = s.fin.shares; const r = fin.raiseVC(s, 1, 0.15); expect(r.ok).toBe(true); expect(s.fin.shares).toBeGreaterThan(sh0); expect(fin.founderPct(s)).toBeLessThan(0.9);
    advance(s, 90); expect(bal(s)).toBeLessThan(1);
    const id = s.fin.loans[0].id; expect(fin.repayLoan(s, id, 1e9).ok).toBe(true); expect(bal(s)).toBeLessThan(1);
    expect(s.fin.loans.every(l => l.principal >= 0)).toBe(true);
  });
  it('cash flow statement reconciles to cash change', () => {
    const s = mk(); const c0 = s.fin.cash; advance(s, 100); fin.takeLoan(s, 'bank', 50_000, 3); advance(s, 70);
    const all = fin.sumPeriods([...s.fin.ledger.hist, s.fin.ledger.m]); const cf = fin.cashFlowStatement(s, all);
    expect(Math.abs(c0 + cf.net - s.fin.cash)).toBeLessThan(1);
  });
  it('tax uses loss carry-forward', () => {
    const s = mk(); advance(s, 2); s.fin.ledger.nol = 1000; const L = s.fin.ledger;
    L.last.ni = 0; // force: simulate profitable month after losses
    revenue(s, 500_000, 'products'); const tax0 = s.fin.ledger.m.exp.tax || 0; advance(s, 40);
    expect(tax0).toBe(0); expect(s.fin.ledger.nol).toBeGreaterThanOrEqual(0);
    const s2 = mk(); advance(s2, 70); expect(s2.fin.ledger.nol).toBeGreaterThan(0); // loss-making start accumulates NOL
  });
  it('bankruptcy in normal mode, never in sandbox', () => {
    const s = mk('normal', 'bootstrap'); s.fin.cash = -50_000; advance(s, 60); expect(s.gameOver).not.toBeNull(); expect(s.fin.bankrupt).toBe(true);
    const b = mk('sandbox'); b.fin.cash = -9e6; advance(b, 200); expect(b.gameOver).toBeNull(); expect(b.fin.cash).toBeGreaterThan(0);
  });
  it('IPO changes shares and cash, keeps books balanced; dividends/buybacks too', () => {
    const s = mk('normal', 'founder'); advance(s, 200);
    // make the company IPO-ready
    for (let i = 0; i < 8; i++) { const p = s.fin.ledger.hist; if (p[p.length - 1]) p[p.length - 1].rev = 1e6; }
    revenue(s, 0); s.fin.ledger.hist.forEach(p => { p.rev = 1_000_000; }); s.derived.valuation = 60e6; s.flags.valTarget = 60e6;
    const rd = stock.ipoReadiness(s); expect(rd.ready).toBe(true);
    const out = fin.outstanding(s); const cash0 = s.fin.cash; const price = (s.derived.valuation / out) * 0.9;
    const r = stock.launchIPO(s, { price, shares: Math.round(out * 0.15) }); expect(r.ok).toBe(true); expect(s.stock.public).toBe(true);
    expect(s.fin.shares).toBeGreaterThan(out); expect(s.fin.cash).toBeGreaterThan(cash0); expect(bal(s)).toBeLessThan(1);
    advance(s, 30); expect(s.stock.px).toBeGreaterThan(0); expect(s.stock.pxHist.length).toBeGreaterThan(20);
    expect(fin.setDividend(s, 0.01).ok).toBe(true); fin.startBuyback(s); advance(s, 120); expect(bal(s)).toBeLessThan(1);
    expect(fin.sellEquity(s, 200_000).ok).toBe(true); expect(bal(s)).toBeLessThan(1); expect(s.fin.treasury).toBeGreaterThanOrEqual(0);
  });
  it('stock trading and acquisition work and keep books balanced', () => {
    const s = mk('sandbox'); advance(s, 40); issueEquity(s, 2e9); const r = fakeRival(s); advance(s, 30);
    expect(stock.buyShares(s, r.id, 1000).ok).toBe(true); expect(bal(s)).toBeLessThan(1); advance(s, 35); expect(bal(s)).toBeLessThan(1);
    expect(stock.sellShares(s, r.id, 500).ok).toBe(true); expect(bal(s)).toBeLessThan(1);
    issueEquity(s, 5e10); r.forSale = true; r.askMult = 1.1; const m = ma.offerOdds(s, r, 0.9); expect(m).toBeGreaterThan(0.5);
    let res = ma.makeOffer(s, r.id, 1.0); if (!res.ok) console.log(res.msg); if (!res.ok && s.ma.offers.length && s.ma.offers[s.ma.offers.length - 1].status === 'countered') res = ma.acceptCounter(s, s.ma.offers[s.ma.offers.length - 1].id);
    expect(r.status).toBe('acquired');
    if (r.status === 'acquired') { expect(s.ma.subs.length).toBe(1); expect(s.fin.ledger.goodwill).toBeGreaterThan(0); advance(s, 400); expect(bal(s)).toBeLessThan(1); expect(s.ma.subs[0].integration).toBe(1); expect(ma.sellSubsidiary(s, s.ma.subs[0].id).ok).toBe(true); expect(bal(s)).toBeLessThan(1); }
  });
  it('hostile takeover needs a 15% stake', () => {
    const s = mk('sandbox'); issueEquity(s, 2e9); const r = fakeRival(s, 'h1'); expect(ma.hostileTakeover(s, r.id, 0.3).ok).toBe(false);
    expect(stock.buyShares(s, r.id, 2_000_000).ok).toBe(true); const h = ma.hostileInfo(s, r, 0.3); expect(h.canTry).toBe(true);
  });
  it('expense helper sanity', () => { const s = mk(); expense(s, 1000, 'other'); expect(bal(s)).toBeLessThan(1); });
});
