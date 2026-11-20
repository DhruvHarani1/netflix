// FINANCE — loans, venture capital, equity, dividends, buybacks, tax, insolvency, valuation, statements.
import type { GameState, Period, Loan } from './types';
import { clamp, isQuarterStart, toast, addNews, logEntry, sum, lerp } from './util';
import { expense, repayPrincipal, borrow, issueEquity, dividend, buyback, totalDebt, totalAssets, totalEquity, opexTotal, emptyPeriod } from './ledger';
import { DIFF, REGIONS, REGION } from '../data/core';

export interface Res { ok: boolean; msg: string }
const ok = (msg: string): Res => ({ ok: true, msg });
const no = (msg: string): Res => ({ ok: false, msg });
export const outstanding = (s: GameState) => Math.max(1, s.fin.shares - s.fin.treasury);
export const founderPct = (s: GameState) => s.fin.founderShares / outstanding(s);

// ------------------------------------------------------------ run-rate helpers
function histSum(s: GameState, from: number, to: number, key: 'rev' | 'ni'): number {
  const h = s.fin.ledger.hist; let t = 0; for (let i = Math.max(0, h.length - from); i < h.length - to; i++) t += h[i][key]; return t;
}
/** Annualised revenue run-rate (uses recent months; extrapolates month-to-date for brand-new companies). */
export function revRunRate(s: GameState): number {
  const h = s.fin.ledger.hist; const n = Math.min(3, h.length);
  if (n === 0) return (s.fin.ledger.m.rev / Math.max(1, s.day)) * 365;
  return (histSum(s, n, 0, 'rev') / n) * 12;
}
export function profitRunRate(s: GameState): number {
  const h = s.fin.ledger.hist; const n = Math.min(3, h.length);
  if (n === 0) return (s.fin.ledger.m.ni / Math.max(1, s.day)) * 365;
  return (histSum(s, n, 0, 'ni') / n) * 12;
}
export function revGrowth(s: GameState): number {
  const h = s.fin.ledger.hist;
  if (h.length >= 15) { const a = histSum(s, 3, 0, 'rev'), b = histSum(s, 15, 12, 'rev'); if (b > 0) return clamp(a / b - 1, -0.5, 1.5); }
  if (h.length >= 6) { const a = histSum(s, 3, 0, 'rev'), b = histSum(s, 6, 3, 'rev'); if (b > 0) return clamp(Math.pow(a / b, 4) - 1, -0.5, 1.5); }
  return h.length >= 2 && h[h.length - 2].rev > 0 ? clamp(Math.pow(h[h.length - 1].rev / h[h.length - 2].rev, 6) - 1, -0.5, 1.5) : 0;
}
export function assetValue(s: GameState): number {
  const L = s.fin.ledger; let people = 0; for (const e of s.people.emps) people += e.heads * (e.skill / 100) * 22000;
  let pat = 0; for (const p of s.research.patents) pat += p.value;
  let dev = 0; for (const p of s.products) if (p.status !== 'live' && p.status !== 'retired') dev += p.spent * 0.8;
  return Math.max(0, s.fin.cash) + L.ppe + L.invest + people + pat + dev + L.goodwill * 0.5;
}
/** Fundamental equity value of the company (before smoothing). */
export function fundamentalValue(s: GameState): number {
  const d = s.derived; const rr = revRunRate(s), pr = profitRunRate(s), g = revGrowth(s);
  const margin = rr > 0 ? pr / rr : 0; const econ = s.market.econ;
  const rateF = clamp(1 - (econ.rate - 0.04) * 4, 0.6, 1.3);
  const sentF = Math.sqrt(clamp(s.stock.sentiment, 10, 100) / 55);
  const mult = (1.5 + 7 * Math.min(1.2, Math.max(0, g)) + 8 * Math.max(0, margin)) * rateF * sentF;
  const prem = 0.85 + (d.brand / 100) * 0.3 + (d.ecosystem.score / 100) * 0.25;
  const ev = Math.max(0, rr) * mult * prem;
  const debt = totalDebt(s);
  return Math.max(ev + s.fin.cash - debt, (assetValue(s) - debt) * 1.15, 100_000);
}
export function updateValuation(s: GameState, smooth = true) {
  const d = s.derived; const t = fundamentalValue(s); s.flags.valTarget = t;
  d.valuation = smooth && d.valuation > 0 ? lerp(d.valuation, t, 0.2) : t;
  d.mcap = s.stock.public ? s.stock.px * outstanding(s) : d.valuation;
  d.revYr = trailingRev(s); d.profitYr = trailingNi(s); d.growth = revGrowth(s);
  if (d.valuation > s.meta.peak.valuation) s.meta.peak.valuation = d.valuation;
}
const trailingRev = (s: GameState) => histSum(s, 12, 0, 'rev') + s.fin.ledger.m.rev * (s.fin.ledger.hist.length < 12 ? 1 : 0);
const trailingNi = (s: GameState) => histSum(s, 12, 0, 'ni') + s.fin.ledger.m.ni * (s.fin.ledger.hist.length < 12 ? 1 : 0);

export function taxRate(s: GameState): number {
  let w = 0, t = 0; for (const r of REGIONS) { const p = s.regions[r.id]?.presence || 0; w += p; t += p * r.tax; }
  const hq = REGION[s.co.hq].tax; let rate = w > 0 ? (t / w) * 0.6 + hq * 0.4 : hq; rate = clamp(rate, 0.08, 0.35);
  const fe = clamp(s.derived.dept.finance?.eff ?? 1, 0.5, 1.5); return rate * (1.1 - 0.1 * fe);
}

// --------------------------------------------------------------- lifecycle
export function init(s: GameState): void { updateValuation(s, false); }

export function daily(s: GameState): void {
  const f = s.fin;
  if (s.mode === 'sandbox' || s.sandboxCash) { if (f.cash < 2_000_000) issueEquity(s, 2_000_000 - f.cash + 1_000_000); f.insolventDays = 0; }
  else if (f.cash < 0) {
    f.insolventDays++;
    expense(s, (-f.cash * 0.18) / 365, 'interest');
    s.marketing.reputation = clamp(s.marketing.reputation - 0.06);
    if (f.insolventDays === 1) { addNews(s, `${s.co.name} misses payments as cash runs dry`, 'Suppliers and creditors are demanding payment. Raise cash immediately.', 'finance', 'bad'); toast('INSOLVENT: cash is negative! Raise funds or cut costs.', 'bad', 'warn'); }
    if (f.insolventDays === 20) { addNews(s, `Creditors threaten ${s.co.name} with bankruptcy`, 'Banks have frozen credit lines.', 'finance', 'bad'); toast('Creditors are losing patience — 25 days left.', 'bad', 'warn'); }
    if (f.insolventDays >= 45) {
      f.bankrupt = true; s.gameOver = { reason: `${s.co.name} could not pay its bills for 45 days and was forced into bankruptcy. Creditors liquidated the company.`, day: s.day };
      addNews(s, `${s.co.name} files for bankruptcy`, 'The once-promising company is liquidated.', 'finance', 'bad'); logEntry(s, 'Bankruptcy.', 'bad');
    }
  } else if (f.insolventDays > 0) f.insolventDays = Math.max(0, f.insolventDays - 2);
  if (s.day % 5 === 0) updateValuation(s);
}

export function monthly(s: GameState): void {
  const f = s.fin; const L = f.ledger;
  // interest + scheduled principal
  for (const l of [...f.loans]) {
    const interest = (l.principal * l.rate) / 12; expense(s, interest, 'interest');
    const pay = Math.min(l.monthly, l.principal); if (pay > 0) { repayPrincipal(s, pay); l.principal -= pay; }
    if (l.principal < 1) { if (l.principal > 0) { repayPrincipal(s, l.principal); l.principal = 0; } f.loans.splice(f.loans.indexOf(l), 1); toast(`Loan "${l.name}" fully repaid`, 'good', 'success'); }
  }
  // corporate tax on last month's result with loss carry-forward
  const ni = L.last.ni; f.lastTaxMonthNI = ni;
  if (ni > 0) { const use = Math.min(L.nol, ni); L.nol -= use; const tax = (ni - use) * taxRate(s); if (tax > 0) expense(s, tax, 'tax'); }
  else if (ni < 0) L.nol += -ni;
  // credit score
  const rr = revRunRate(s), pr = profitRunRate(s), m = rr > 0 ? pr / rr : -0.3; const burn = monthlyBurn(s);
  const runway = burn > 0 ? f.cash / burn : 60; const debt = totalDebt(s); const assets = Math.max(1, totalAssets(s));
  const target = 560 + (f.cash > 0 ? 40 : -60) + 70 * clamp(runway / 24, 0, 1) + 90 * clamp((m + 0.1) / 0.4, 0, 1) + 30 * clamp(Math.log10(Math.max(1, rr) / 1e6) / 4, 0, 1) - 90 * clamp(debt / assets, 0, 1) - (f.insolventDays > 0 ? 150 : 0);
  f.creditScore = Math.round(clamp(lerp(f.creditScore, target, 0.2), 300, 850));
  // dividends (quarterly) & buybacks
  const out = outstanding(s);
  if (s.stock.public && f.dividendPerShare > 0 && isQuarterStart(s.day)) {
    const amt = f.dividendPerShare * out;
    if (f.cash > amt * 1.2) { dividend(s, amt); toast(`Dividend paid: ${fmt(amt)} ($${f.dividendPerShare.toFixed(3)}/share)`, 'good', 'cash'); s.stock.px *= 1.002; }
    else toast('Dividend skipped — not enough cash.', 'neutral');
  }
  if (s.stock.public && f.buybackActive && s.stock.px > 0) {
    const spend = Math.min(Math.max(0, f.cash - burn * 6) * 0.2, s.stock.px * out * 0.012);
    const n = Math.floor(spend / s.stock.px); if (n > 0 && n < out * 0.5) { buyback(s, n * s.stock.px); f.treasury += n; s.stock.px *= 1 + Math.min(0.01, n / out); }
  }
  updateValuation(s, false);
}
const fmt = (n: number) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

// ------------------------------------------------------------------- ratios
export function monthlyBurn(s: GameState): number {
  const p = s.fin.ledger.last; const op = p.cfo + 0; const free = op - p.capex; return free < 0 ? -free : 0;
}
export function runwayMonths(s: GameState): number { const b = monthlyBurn(s); return b > 0 ? Math.max(0, s.fin.cash) / b : Infinity; }
export function ratios(s: GameState) {
  const p = s.fin.ledger.last; const L = s.fin.ledger; const debt = totalDebt(s); const eq = totalEquity(s); const inc = incomeStatement(s, p);
  const yr = sumPeriods(s.fin.ledger.hist.slice(-12));
  return {
    grossMargin: p.rev > 0 ? (p.rev - p.cogs) / p.rev : 0, opMargin: p.rev > 0 ? inc.opIncome / p.rev : 0, netMargin: p.rev > 0 ? p.ni / p.rev : 0,
    debtEquity: eq > 0 ? debt / eq : debt > 0 ? Infinity : 0, burn: monthlyBurn(s), runway: runwayMonths(s), roe: eq > 0 ? yr.ni / eq : 0,
    interestCover: inc.interest > 0 ? inc.opIncome / inc.interest : Infinity, liquidity: s.fin.cash / Math.max(1, p.cogs + opexTotal(p)), assets: totalAssets(s), debt, equity: eq, ppe: L.ppe,
  };
}

// ------------------------------------------------------------- statements
export function sumPeriods(list: Period[]): Period {
  const o = emptyPeriod();
  for (const p of list) {
    o.rev += p.rev; o.cogs += p.cogs; o.gains += p.gains; o.ni += p.ni; o.cfo += p.cfo; o.cfi += p.cfi; o.cff += p.cff; o.capex += p.capex; o.dep += p.dep;
    o.dividends += p.dividends; o.buybacks += p.buybacks; o.equityRaised += p.equityRaised; o.debtNet += p.debtNet;
    for (const k in p.revBy) o.revBy[k] = (o.revBy[k] || 0) + p.revBy[k]; for (const k in p.exp) o.exp[k] = (o.exp[k] || 0) + p.exp[k];
  }
  return o;
}
/** key: 'm' month, 'q' quarter, 'y' year, 'ytd' year to date; back: 0 = latest completed, 1 = the one before. */
export function getPeriod(s: GameState, key: 'm' | 'q' | 'y' | 'ytd', back = 0): Period {
  const h = s.fin.ledger.hist; if (key === 'ytd') return back === 0 ? s.fin.ledger.y : emptyPeriod();
  const n = key === 'm' ? 1 : key === 'q' ? 3 : 12; const end = h.length - back * n; return sumPeriods(h.slice(Math.max(0, end - n), Math.max(0, end)));
}
export function incomeStatement(s: GameState, p: Period) {
  let opexEx = 0; for (const k in p.exp) if (k !== 'interest' && k !== 'tax') opexEx += p.exp[k];
  const interest = p.exp.interest || 0, tax = p.exp.tax || 0; const gross = p.rev - p.cogs; const opIncome = gross - opexEx; const pretax = opIncome - interest + p.gains;
  return { revenue: p.rev, revBy: p.revBy, cogs: p.cogs, gross, opex: p.exp, opexTotal: opexEx, opIncome, interest, gains: p.gains, pretax, tax, ni: pretax - tax };
}
export function balanceSheet(s: GameState) {
  const L = s.fin.ledger; const assets = totalAssets(s); const debt = totalDebt(s); const equity = totalEquity(s);
  return { cash: s.fin.cash, ppe: L.ppe, goodwill: L.goodwill, invest: L.invest, assets, loans: s.fin.loans, debt, paidIn: L.paidIn, retained: L.retained, equity, total: debt + equity, check: assets - debt - equity };
}
export function cashFlowStatement(s: GameState, p: Period) {
  const sub = p.cfi + p.capex; const nonCashGain = p.gains;
  return { ni: p.ni, dep: p.dep, gains: nonCashGain, cfo: p.cfo, capex: -p.capex, otherInv: sub, cfi: p.cfi, debtNet: p.debtNet, equity: p.equityRaised, buybacks: -p.buybacks, dividends: -p.dividends, cff: p.cff, net: p.cfo + p.cfi + p.cff };
}

// ---------------------------------------------------------------- actions
export const LOAN_KINDS = {
  bank: { name: 'Bank term loan', spread: 0.02, minRev: 0, desc: 'Amortising loan, 1-10 years.' },
  bond: { name: 'Corporate bonds', spread: 0.012, minRev: 5_000_000, desc: 'Bullet-style bonds for established firms (revenue ≥ $5M).' },
  credit: { name: 'Revolving credit line', spread: 0.05, minRev: 0, desc: 'Flexible, interest-only, expensive. Repay any time.' },
} as const;
export function loanRate(s: GameState, kind: keyof typeof LOAN_KINDS): number {
  return Math.max(0.02, s.market.econ.rate + LOAN_KINDS[kind].spread + Math.max(0, (700 - s.fin.creditScore) / 100) * 0.012);
}
export function maxLoan(s: GameState, kind: keyof typeof LOAN_KINDS): number {
  const diff = DIFF[s.difficulty]; const cs = clamp((s.fin.creditScore - 400) / 450, 0.05, 1); const L = s.fin.ledger;
  let cap = diff.loanAccess * cs * (250_000 + 0.45 * revRunRate(s) + 0.5 * (L.ppe + Math.max(0, s.fin.cash)) + 0.03 * s.derived.valuation);
  if (kind === 'credit') cap *= 0.35; if (kind === 'bond') { if (revRunRate(s) < LOAN_KINDS.bond.minRev || s.fin.creditScore < 660) return 0; cap *= 1.8; }
  return Math.max(0, Math.round((cap - totalDebt(s)) / 1000) * 1000);
}
export function takeLoan(s: GameState, kind: keyof typeof LOAN_KINDS, amount: number, years: number): Res {
  amount = Math.round(amount); if (!(amount >= 10_000)) return no('Minimum loan is $10,000.');
  if (kind === 'bond' && revRunRate(s) < LOAN_KINDS.bond.minRev) return no('Bonds require at least $5M annual revenue.');
  const max = maxLoan(s, kind); if (amount > max) return no(max <= 0 ? 'Lenders will not extend more credit right now.' : `Lenders will only offer up to $${max.toLocaleString()}.`);
  years = clamp(Math.round(years), 1, 15); const rate = loanRate(s, kind);
  const l: Loan = { id: s.fin.nextLoanId++, name: `${LOAN_KINDS[kind].name} #${s.fin.nextLoanId - 1}`, principal: amount, rate, monthly: kind === 'credit' ? 0 : kind === 'bond' ? 0 : Math.ceil(amount / (years * 12)), kind: kind === 'bank' ? 'bank' : kind === 'bond' ? 'bond' : 'credit', taken: s.day };
  s.fin.loans.push(l); borrow(s, amount); s.fin.creditScore = Math.max(300, s.fin.creditScore - 3);
  return ok(`Borrowed $${amount.toLocaleString()} at ${(rate * 100).toFixed(1)}%.`);
}
export const issueBonds = (s: GameState, amount: number, years: number) => takeLoan(s, 'bond', amount, years);
export function repayLoan(s: GameState, id: number, amount: number): Res {
  const l = s.fin.loans.find(x => x.id === id); if (!l) return no('Loan not found.');
  amount = Math.min(Math.round(amount), Math.round(l.principal), Math.floor(Math.max(0, s.fin.cash))); if (amount <= 0) return no('Not enough cash to repay.');
  repayPrincipal(s, amount); l.principal -= amount; if (l.principal < 1) { if (l.principal > 0) { repayPrincipal(s, l.principal); } s.fin.loans.splice(s.fin.loans.indexOf(l), 1); }
  return ok(`Repaid $${amount.toLocaleString()}.`);
}
export const ROUNDS = [
  { name: 'Seed', minVal: 0, mult: 0.9, pcts: [0.08, 0.12, 0.18] }, { name: 'Series A', minVal: 4e6, mult: 1.0, pcts: [0.12, 0.18, 0.25] },
  { name: 'Series B', minVal: 25e6, mult: 1.05, pcts: [0.1, 0.15, 0.2] }, { name: 'Series C', minVal: 120e6, mult: 1.1, pcts: [0.08, 0.12, 0.16] },
  { name: 'Series D', minVal: 500e6, mult: 1.1, pcts: [0.05, 0.08, 0.12] },
];
export function vcOffer(s: GameState, idx: number, pct: number) {
  const r = ROUNDS[idx]; if (!r) return null;
  const pre = Math.max(500_000, s.derived.valuation * r.mult * (0.9 + (s.derived.brand / 100) * 0.2)); const raise = Math.round((pre * pct) / (1 - pct) / 1000) * 1000;
  const newShares = Math.round((outstanding(s) * pct) / (1 - pct)); return { pre, post: pre + raise, raise, newShares, price: raise / Math.max(1, newShares), pct };
}
export function vcEligibility(s: GameState, idx: number): string | null {
  const r = ROUNDS[idx]; if (!r) return 'No further rounds.'; if (s.stock.public) return 'Public companies raise via secondary offerings.';
  if (s.fin.rounds.length !== idx) return idx < s.fin.rounds.length ? 'Round already completed.' : `Complete ${ROUNDS[s.fin.rounds.length].name} first.`;
  if (s.derived.valuation < r.minVal) return `Needs valuation of at least $${(r.minVal / 1e6).toFixed(0)}M.`;
  const last = s.fin.rounds[s.fin.rounds.length - 1]; if (last && s.day - last.day < 150) return `Investors want ${150 - (s.day - last.day)} more days of progress.`;
  return null;
}
export function raiseVC(s: GameState, idx: number, pct: number): Res {
  const why = vcEligibility(s, idx); if (why) return no(why); const o = vcOffer(s, idx, pct); if (!o) return no('Invalid round.');
  issueEquity(s, o.raise); s.fin.shares += o.newShares; s.fin.rounds.push({ name: ROUNDS[idx].name, day: s.day, raised: o.raise, pct, post: o.post });
  s.fin.creditScore = Math.min(850, s.fin.creditScore + 8); updateValuation(s, false);
  addNews(s, `${s.co.name} raises $${(o.raise / 1e6).toFixed(1)}M in ${ROUNDS[idx].name}`, `Investors valued the company at $${(o.post / 1e6).toFixed(1)}M post-money.`, 'finance', 'good');
  return ok(`Raised $${o.raise.toLocaleString()} for ${(pct * 100).toFixed(0)}% of the company.`);
}
export function sellEquity(s: GameState, amount: number): Res {
  if (!s.stock.public) return no('Only public companies can sell shares on the market.'); amount = Math.round(amount);
  const mcap = s.stock.px * outstanding(s); if (amount < 100_000) return no('Minimum offering is $100,000.'); if (amount > mcap * 0.15) return no('Offering too large (max 15% of market cap).');
  const price = s.stock.px * 0.97; const n = Math.floor(amount / price); issueEquity(s, amount); expense(s, amount * 0.03, 'fees'); s.fin.shares += n;
  s.stock.px *= 1 - 0.6 * (n / outstanding(s)); return ok(`Sold ${n.toLocaleString()} new shares at $${price.toFixed(2)}.`);
}
export function setDividend(s: GameState, perShare: number): Res {
  if (!s.stock.public) return no('Dividends require a public listing.'); s.fin.dividendPerShare = Math.max(0, perShare); return ok(perShare > 0 ? `Quarterly dividend set to $${perShare.toFixed(3)}/share.` : 'Dividend suspended.');
}
export function startBuyback(s: GameState): Res { if (!s.stock.public) return no('Buybacks require a public listing.'); s.fin.buybackActive = true; return ok('Share buyback program started.'); }
export function stopBuyback(s: GameState): Res { s.fin.buybackActive = false; return ok('Buyback program stopped.'); }
