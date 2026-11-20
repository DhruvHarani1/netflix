// Double-entry-ish ledger.  EVERY cash movement in the game must go through these helpers so that
//   Assets (cash + ppe + goodwill + invest) = Liabilities (loans) + Equity (paidIn + retained)
// always holds, and the three financial statements reconcile.
import type { GameState, Period, ExpKey, RevKey, Ledger } from './types';

export const emptyPeriod = (): Period => ({ rev: 0, revBy: {}, cogs: 0, exp: {}, gains: 0, ni: 0, cfo: 0, cfi: 0, cff: 0, capex: 0, dep: 0, dividends: 0, buybacks: 0, equityRaised: 0, debtNet: 0 });
export const emptyLedger = (): Ledger => ({ ppe: 0, goodwill: 0, invest: 0, paidIn: 0, retained: 0, m: emptyPeriod(), y: emptyPeriod(), last: emptyPeriod(), nol: 0, hist: [] });

function both(s: GameState, f: (p: Period) => void) { f(s.fin.ledger.m); f(s.fin.ledger.y); }
const noop = (s: GameState) => s.sandboxCash;

/** Revenue received in cash. */
export function revenue(s: GameState, amt: number, key: RevKey = 'products') {
  if (!(amt > 0)) return; s.fin.cash += amt; s.fin.ledger.retained += amt;
  both(s, p => { p.rev += amt; p.revBy[key] = (p.revBy[key] || 0) + amt; p.ni += amt; p.cfo += amt; });
}
/** Operating expense paid in cash.  key 'cogs' is shown above gross profit. */
export function expense(s: GameState, amt: number, key: ExpKey) {
  if (!(amt > 0)) return;
  if (noop(s) && key !== 'tax') { /* sandbox: infinite funds are applied at month close */ }
  s.fin.cash -= amt; s.fin.ledger.retained -= amt;
  both(s, p => { if (key === 'cogs') p.cogs += amt; else p.exp[key] = (p.exp[key] || 0) + amt; p.ni -= amt; p.cfo -= amt; });
}
/** Non-cash depreciation of owned property. */
export function depreciate(s: GameState, amt: number) {
  amt = Math.min(amt, s.fin.ledger.ppe); if (!(amt > 0)) return;
  s.fin.ledger.ppe -= amt; s.fin.ledger.retained -= amt;
  both(s, p => { p.dep += amt; p.exp.dep = (p.exp.dep || 0) + amt; p.ni -= amt; p.cfo += 0; });
  // depreciation lowers NI but is non-cash: add back in CFO
  both(s, p => { p.cfo += amt; });
}
/** Purchase of a fixed asset (cash -> ppe). */
export function capex(s: GameState, amt: number) {
  if (!(amt > 0)) return; s.fin.cash -= amt; s.fin.ledger.ppe += amt;
  both(s, p => { p.cfi -= amt; p.capex += amt; });
}
/** Sale of a fixed asset: proceeds in cash, gain/loss vs. book value goes to income. */
export function saleOfAsset(s: GameState, book: number, proceeds: number) {
  const b = Math.min(book, s.fin.ledger.ppe); s.fin.ledger.ppe -= b; s.fin.cash += proceeds;
  const g = proceeds - b; s.fin.ledger.retained += g;
  both(s, p => { p.cfi += proceeds; p.gains += g; p.ni += g; p.cfo -= g; });
}
/** Buying shares / businesses recorded as investments (cash -> invest). */
export function investIn(s: GameState, amt: number) { if (!(amt > 0)) return; s.fin.cash -= amt; s.fin.ledger.invest += amt; both(s, p => { p.cfi -= amt; }); }
/** Selling investments at proceeds vs. carried cost. */
export function divest(s: GameState, carry: number, proceeds: number) {
  const c = Math.min(carry, s.fin.ledger.invest); s.fin.ledger.invest -= c; s.fin.cash += proceeds; const g = proceeds - c; s.fin.ledger.retained += g;
  both(s, p => { p.cfi += proceeds; p.gains += g; p.ni += g; p.cfo -= g; });
}
/** Mark investments to market (non-cash unrealised gain). */
export function markInvest(s: GameState, newCarry: number) {
  const d = newCarry - s.fin.ledger.invest; if (Math.abs(d) < 1) return;
  s.fin.ledger.invest = newCarry; s.fin.ledger.retained += d;
  both(s, p => { p.gains += d; p.ni += d; p.cfo -= d; });
}
/** Acquire a business: cash out, goodwill + (optionally) property recognised. */
export function acquireBusiness(s: GameState, price: number, ppeValue = 0) {
  if (!(price > 0)) return; s.fin.cash -= price; s.fin.ledger.goodwill += price - ppeValue; s.fin.ledger.ppe += ppeValue; both(s, p => { p.cfi -= price; });
}
/** Dispose of goodwill when selling a subsidiary. */
export function saleOfBusiness(s: GameState, carry: number, proceeds: number) {
  const c = Math.min(carry, s.fin.ledger.goodwill); s.fin.ledger.goodwill -= c; s.fin.cash += proceeds; const g = proceeds - c; s.fin.ledger.retained += g;
  both(s, p => { p.cfi += proceeds; p.gains += g; p.ni += g; p.cfo -= g; });
}
export function impairGoodwill(s: GameState, amt: number) { amt = Math.min(amt, s.fin.ledger.goodwill); if (amt <= 0) return; s.fin.ledger.goodwill -= amt; s.fin.ledger.retained -= amt; both(s, p => { p.gains -= amt; p.ni -= amt; }); }
// ---- financing -------------------------------------------------------------
export function borrow(s: GameState, amt: number) { s.fin.cash += amt; both(s, p => { p.cff += amt; p.debtNet += amt; }); }
export function repayPrincipal(s: GameState, amt: number) { s.fin.cash -= amt; both(s, p => { p.cff -= amt; p.debtNet -= amt; }); }
export function issueEquity(s: GameState, amt: number) { s.fin.cash += amt; s.fin.ledger.paidIn += amt; both(s, p => { p.cff += amt; p.equityRaised += amt; }); }
export function buyback(s: GameState, amt: number) { s.fin.cash -= amt; s.fin.ledger.paidIn -= amt; both(s, p => { p.cff -= amt; p.buybacks += amt; }); }
export function dividend(s: GameState, amt: number) { s.fin.cash -= amt; s.fin.ledger.retained -= amt; both(s, p => { p.cff -= amt; p.dividends += amt; }); }
/** Cash-free equity adjustment (e.g. share-based compensation granted by acquirer). */
export function totalDebt(s: GameState) { let d = 0; for (const l of s.fin.loans) d += l.principal; return d; }
export function totalAssets(s: GameState) { const l = s.fin.ledger; return s.fin.cash + l.ppe + l.goodwill + l.invest; }
export function totalEquity(s: GameState) { const l = s.fin.ledger; return l.paidIn + l.retained; }
/** Close the month: roll accumulators into history. */
export function closeMonth(s: GameState) {
  const L = s.fin.ledger; L.last = L.m; L.hist.push(L.m); if (L.hist.length > 240) L.hist.shift(); L.m = emptyPeriod();
}
export function closeYear(s: GameState) { s.fin.ledger.y = emptyPeriod(); }
/** Trailing N completed months summed (plus optional current month). */
export function trailing(s: GameState, n: number, key: 'rev' | 'ni' | 'cfo' | 'cogs'): number {
  const h = s.fin.ledger.hist; let t = 0; for (let i = Math.max(0, h.length - n); i < h.length; i++) t += h[i][key]; return t;
}
export function opexTotal(p: Period) { let t = 0; for (const k in p.exp) t += p.exp[k]; return t; }
export function totalExpenses(p: Period) { return p.cogs + opexTotal(p); }
