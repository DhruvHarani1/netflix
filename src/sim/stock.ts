// STOCK MARKET — player share price, IPO, earnings, analysts, rival stocks, TECH index, trading.
import type { GameState, Rival } from './types';
import { clamp, gauss, rnd, toast, addNews, sigmoid, isMonthStart } from './util';
import { issueEquity, expense, investIn, divest, markInvest } from './ledger';
import { outstanding, revRunRate, revGrowth, profitRunRate, updateValuation, sumPeriods, type Res } from './finance';

const ok = (msg: string): Res => ({ ok: true, msg });
const no = (msg: string): Res => ({ ok: false, msg });

export function init(s: GameState): void {
  const st = s.stock; st.index = [1000]; st.indexDay = [0]; st.sentiment = 55; s.flags.idxPrev = {};
  for (const r of s.rivals) ensurePx(r);
}
function ensurePx(r: Rival) {
  if (r.status !== 'active' || !r.publicCo || r.shares <= 0) return;
  if (!(r.px > 0)) { r.px = Math.max(0.5, r.valuation / r.shares); r.pxHist = [r.px]; }
}
export const rivalMcap = (r: Rival) => (r.publicCo && r.px > 0 ? r.px * r.shares : r.valuation);
/** Per-share price at which the player can trade a rival's stock (private startups: 15% premium). */
export function stakePrice(r: Rival): number {
  const sh = r.shares > 0 ? r.shares : 1_000_000; return r.publicCo && r.px > 0 ? r.px : (r.valuation / sh) * 1.15;
}
export function stakeShares(r: Rival) { return r.shares > 0 ? r.shares : 1_000_000; }

/** Stock splits keep share prices in a human range (companies split when the price runs away). */
function splitRatio(px: number): number { return px > 6000 ? 50 : px > 2500 ? 20 : px > 1200 ? 10 : px > 600 ? 5 : 0; }
function splits(s: GameState): void {
  const st = s.stock; const prev: Record<string, number> = s.flags.idxPrev || {};
  for (const r of s.rivals) {
    if (r.status !== 'active' || !r.publicCo) continue;
    const k = splitRatio(r.px); if (!k) continue;
    r.shares *= k; r.px /= k; r.pxHist = r.pxHist.map(v => v / k); if (prev[r.id]) prev[r.id] /= k;
    const pf = st.portfolio[r.id]; if (pf) pf.shares *= k;
    addNews(s, r.name + ' announces ' + k + '-for-1 stock split', 'Shares will trade at a lower price after the split; holders receive additional shares.', 'finance', 'neutral', r.id);
  }
  if (st.public) {
    const k = splitRatio(st.px); if (!k) return;
    s.fin.shares *= k; s.fin.founderShares *= k; s.fin.treasury *= k; s.fin.dividendPerShare /= k;
    st.px /= k; st.pxHist = st.pxHist.map(v => v / k); st.hi52 /= k; st.lo52 /= k; st.ipoPx /= k; st.fair /= k; st.analysts.target /= k; st.lastEPS /= k; st.expectedEPS /= k;
    if (prev.player) prev.player /= k;
    addNews(s, s.co.name + ' announces ' + k + '-for-1 stock split', 'The board approved a split to make shares more accessible to retail investors.', 'company', 'good');
    toast(k + '-for-1 stock split: price now $' + st.px.toFixed(2), 'good', 'success');
  }
}
export function daily(s: GameState): void {
  const st = s.stock; const econ = s.market.econ;
  // ---- market sentiment
  const cyc = { boom: 15, normal: 0, slowdown: -10, recession: -28 }[econ.cycle];
  const idx = st.index; const mom = idx.length > 9 ? (idx[idx.length - 1] / idx[idx.length - 9] - 1) * 120 : 0;
  const target = clamp(50 + cyc + (econ.confidence - 60) * 0.3 + clamp(mom, -20, 20), 8, 92);
  st.sentiment = clamp(st.sentiment + (target - st.sentiment) * 0.03 + gauss(s) * 0.8, 4, 96);
  const drift = ((st.sentiment - 50) / 50) * 0.0004;
  // ---- news shocks
  const seen = s.flags.stkNews || 0; let shock = 0; const rshock: Record<string, number> = {};
  for (const n of s.events.news) {
    if (n.id <= seen) continue;
    if (n.rival) rshock[n.rival] = (rshock[n.rival] || 0) + (n.tone === 'good' ? 0.02 : n.tone === 'bad' ? -0.03 : 0);
    else if (n.kind === 'company') shock += n.tone === 'good' ? 0.02 : n.tone === 'bad' ? -0.04 : 0; else if (n.kind === 'people' && n.tone === 'bad') shock -= 0.015;
  }
  if (s.events.news.length) s.flags.stkNews = s.events.news[s.events.news.length - 1].id;
  for (const p of s.products) if (p.status === 'live' && p.launchDay === s.day) shock += 0.01 + (p.rating >= 4 ? 0.015 : 0);
  // ---- rival prices
  for (const r of s.rivals) {
    if (r.status !== 'active' || !r.publicCo || r.shares <= 0) continue; ensurePx(r);
    const fair = Math.max(0.01, r.valuation / r.shares); const vol = 0.016 * (1 + (r.valuation < 5e9 ? 0.4 : 0));
    r.px = Math.max(0.01, r.px * Math.exp(0.05 * Math.log(fair / r.px) + drift + (rshock[r.id] || 0) + vol * gauss(s)));
    if (s.day % 7 === 0) { r.pxHist.push(r.px); if (r.pxHist.length > 1500) r.pxHist.shift(); }
  }
  // ---- player price
  if (st.public) {
    const out = outstanding(s); const fair = (s.derived.valuation) / out; st.fair = fair;
    const vol = 0.018 * (1 + 0.6 * (1 - st.sentiment / 100)) * (s.derived.valuation < 1e8 ? 1.4 : 1);
    st.px = Math.max(0.01, st.px * Math.exp(0.04 * Math.log(fair / st.px) + drift + shock + vol * gauss(s)));
    st.pxHist.push(st.px); if (st.pxHist.length > 8000) st.pxHist.shift();
    const win = st.pxHist.slice(-252); st.hi52 = Math.max(...win); st.lo52 = Math.min(...win);
    st.volume = Math.round(out * (0.004 + Math.abs(shock) * 0.3 + rnd(s) * 0.003));
    if (s.day >= st.nextEarnings) earnings(s);
    if (s.day % 7 === 0) analysts(s);
  }
  splits(s);
  // ---- TECH index (weekly, chain-linked cap-weighted)
  if (s.day % 7 === 0) {
    const prev: Record<string, number> = s.flags.idxPrev || (s.flags.idxPrev = {}); let w = 0, ret = 0; const cur: Record<string, number> = {};
    for (const r of s.rivals) if (r.status === 'active' && r.publicCo && r.px > 0) { const c = r.px * r.shares; cur[r.id] = r.px; if (prev[r.id]) { ret += c * (r.px / prev[r.id] - 1); w += c; } }
    if (st.public) { cur.player = st.px; if (prev.player) { const c = st.px * outstanding(s); ret += c * (st.px / prev.player - 1); w += c; } }
    s.flags.idxPrev = cur; const last = st.index[st.index.length - 1];
    st.index.push(w > 0 ? last * (1 + ret / w) : last); st.indexDay.push(s.day); if (st.index.length > 1500) { st.index.shift(); st.indexDay.shift(); }
  }
}

function earnings(s: GameState) {
  const st = s.stock; const h = s.fin.ledger.hist; const q = sumPeriods(h.slice(-3)); const out = outstanding(s);
  const eps = q.ni / out; const expRev = s.flags.expRev ?? q.rev * 0.97; const expEps = st.expectedEPS || eps * 0.9;
  const surprise = expRev > 0 ? (q.rev - expRev) / expRev : 0; const epsSurp = Math.abs(expEps) > 1e-6 ? clamp((eps - expEps) / Math.abs(expEps), -2, 2) : 0;
  const total = clamp(surprise * 0.8 + epsSurp * 0.08, -0.5, 0.5); const jump = clamp(total * 0.4, -0.22, 0.22);
  st.px *= 1 + jump; st.lastSurprise = total; st.lastEPS = eps;
  const g = clamp(revGrowth(s), 0, 0.6); s.flags.expRev = q.rev * (1 + g / 4 + 0.01); st.expectedEPS = eps + Math.abs(eps) * (g / 4) + 0.0001; st.nextEarnings = s.day + 91;
  (s.flags.earnHist ||= []).push({ day: s.day, rev: q.rev, eps, surprise: total, jump }); if (s.flags.earnHist.length > 24) s.flags.earnHist.shift();
  const beat = total > 0.02, miss = total < -0.02;
  addNews(s, `${s.co.name} ${beat ? 'beats' : miss ? 'misses' : 'meets'} Q expectations; shares ${jump >= 0 ? 'rise' : 'fall'} ${(Math.abs(jump) * 100).toFixed(1)}%`, `Quarterly revenue ${(q.rev / 1e6).toFixed(1)}M, EPS $${eps.toFixed(3)}.`, 'finance', beat ? 'good' : miss ? 'bad' : 'neutral');
  toast(`Earnings: ${beat ? 'beat' : miss ? 'miss' : 'in line'} (${jump >= 0 ? '+' : ''}${(jump * 100).toFixed(1)}%)`, beat ? 'good' : miss ? 'bad' : 'info');
}
function analysts(s: GameState) {
  const st = s.stock; const g = revGrowth(s); const rr = revRunRate(s), pr = profitRunRate(s); const m = rr > 0 ? pr / rr : -0.2;
  const score = clamp(0.5 + g * 0.5 + m * 1.2 + Math.log(Math.max(0.3, st.fair / Math.max(0.01, st.px))) * 0.8 + st.lastSurprise, 0, 1);
  const buy = Math.round(clamp(score * 100 * 0.9, 5, 90)), sell = Math.round(clamp((1 - score) * 70, 3, 60)); st.analysts = { buy, sell, hold: Math.max(0, 100 - buy - sell), target: st.fair * (1.05 + g * 0.2) };
  const mc = st.px * outstanding(s); st.inst = Math.round(clamp(22 + Math.log10(Math.max(1e6, mc) / 1e7) * 14, 15, 78)); st.retail = 100 - st.inst; st.shortInterest = clamp(4 + (1 - score) * 14, 1, 25);
}

export function monthly(s: GameState): void {
  // mark portfolio to market / settle dead or acquired companies
  const st = s.stock; let carry = 0;
  for (const id of Object.keys(st.portfolio)) {
    const pos = st.portfolio[id]; const r = s.rivals.find(x => x.id === id);
    if (!r || pos.shares <= 0) { delete st.portfolio[id]; continue; }
    if (r.status === 'bankrupt') { divest(s, pos.cost, 0); delete st.portfolio[id]; toast(`${r.name} went bankrupt — your stake is worthless`, 'bad'); continue; }
    if (r.status === 'acquired') { const val = pos.shares * stakePrice(r) * 1.25; divest(s, pos.cost, val); delete st.portfolio[id]; toast(`${r.name} was acquired — your stake paid ${Math.round(val / 1000)}K`, 'good'); continue; }
    carry += pos.shares * stakePrice(r) * (r.publicCo ? 1 : 0.9);
  }
  const L = s.fin.ledger; const own = Object.keys(st.portfolio).length; if (own || L.invest > 0) markInvest(s, own ? carry : L.invest);
  updateValuation(s, false);
}

// ----------------------------------------------------------------- IPO
export function ipoReadiness(s: GameState) {
  const h = s.fin.ledger.hist; const checks = [
    { label: 'Valuation ≥ $20M', ok: s.derived.valuation >= 20e6 }, { label: 'Annual revenue run-rate ≥ $2M', ok: revRunRate(s) >= 2e6 },
    { label: 'At least 6 months of financial history', ok: h.length >= 6 }, { label: 'Not already public', ok: !s.stock.public },
  ]; return { checks, ready: checks.every(c => c.ok) };
}
export function ipoPreview(s: GameState, price: number, shares: number) {
  const out = outstanding(s); const fair = s.derived.valuation / out; const pr = price / fair;
  const profitable = profitRunRate(s) > 0; const hype = (s.stock.sentiment / 55) * (0.8 + (s.derived.brand / 100) * 0.4) * (profitable ? 1.05 : 0.92) * (1 + Math.min(0.3, revGrowth(s) * 0.3));
  const demand = clamp(hype / Math.pow(Math.max(0.05, pr), 1.3), 0.15, 4); const raise = price * shares; const fee = raise * 0.06;
  return { fair, demand, raise, fee, net: raise - fee, pct: shares / (out + shares), pop: clamp(Math.log(demand) * 0.25, -0.15, 0.6), ratio: pr };
}
export function launchIPO(s: GameState, a: { price: number; shares: number }): Res & { demand?: number; pop?: number } {
  const rd = ipoReadiness(s); if (!rd.ready) return no('Not ready for an IPO: ' + rd.checks.filter(c => !c.ok).map(c => c.label).join(', '));
  const out = outstanding(s); const shares = Math.round(a.shares), price = a.price;
  if (!(price > 0) || !(shares > 0)) return no('Set a positive price and share count.'); if (shares > out * 0.4) return no('You can float at most 40% new shares.');
  const p = ipoPreview(s, price, shares);
  if (p.demand < 0.4) { expense(s, Math.min(250_000, p.raise * 0.01), 'fees'); return { ok: false, msg: `The IPO was pulled — demand was only ${p.demand.toFixed(2)}× at that price. Lower the price or wait for better sentiment.`, demand: p.demand }; }
  issueEquity(s, p.raise); expense(s, p.fee, 'fees'); s.fin.shares += shares;
  const st = s.stock; st.public = true; st.ipoDay = s.day; st.ipoPx = price; st.px = price * (1 + p.pop); st.pxHist = [st.px]; st.hi52 = st.lo52 = st.px; st.nextEarnings = s.day + 60;
  st.fair = s.derived.valuation / outstanding(s); st.expectedEPS = 0; s.flags.expRev = undefined; analysts(s);
  s.fin.creditScore = Math.min(850, s.fin.creditScore + 25); s.meta.stats.ipo = 1; updateValuation(s, false);
  addNews(s, `${s.co.name} goes public: IPO priced at $${price.toFixed(2)}, opens ${(p.pop * 100).toFixed(0)}% ${p.pop >= 0 ? 'higher' : 'lower'}`, `Raised ${(p.raise / 1e6).toFixed(1)}M; ${(p.demand).toFixed(1)}× oversubscribed.`, 'finance', p.pop >= 0 ? 'good' : 'bad');
  toast(`IPO complete! Raised $${(p.net / 1e6).toFixed(1)}M net. Opening at $${st.px.toFixed(2)}`, 'good', 'launch');
  return { ok: true, msg: `IPO raised $${Math.round(p.net).toLocaleString()} net.`, demand: p.demand, pop: p.pop };
}

// -------------------------------------------------------------- trading
export function buyShares(s: GameState, rivalId: string, qty: number): Res {
  const r = s.rivals.find(x => x.id === rivalId); if (!r || r.status !== 'active') return no('Company not available.'); qty = Math.floor(qty); if (qty <= 0) return no('Enter a quantity.');
  const sh = stakeShares(r); const pos = s.stock.portfolio[rivalId] || { shares: 0, cost: 0 }; const maxOwn = sh * (1 - clamp(r.founderOwned, 0, 0.9));
  if (pos.shares + qty > maxOwn) return no(`Only ${Math.floor(maxOwn - pos.shares).toLocaleString()} more shares are available to outside investors.`);
  const price = stakePrice(r) * 1.001; const cost = qty * price; if (cost > s.fin.cash) return no('Not enough cash.');
  investIn(s, cost); pos.shares += qty; pos.cost += cost; s.stock.portfolio[rivalId] = pos; r.relation = clamp(r.relation - qty / sh * 40, -100, 100);
  if (r.publicCo && r.shares > 0) r.px *= 1 + Math.min(0.03, qty / sh * 0.5);
  return ok(`Bought ${qty.toLocaleString()} ${r.short} shares for $${Math.round(cost).toLocaleString()}.`);
}
export function sellShares(s: GameState, rivalId: string, qty: number): Res {
  const pos = s.stock.portfolio[rivalId]; const r = s.rivals.find(x => x.id === rivalId); if (!pos || !r) return no('You do not own this stock.');
  qty = Math.min(Math.floor(qty), pos.shares); if (qty <= 0) return no('Enter a quantity.');
  const proceeds = qty * stakePrice(r) * (r.publicCo ? 0.999 : 0.9 / 1.15); const carry = pos.cost * (qty / pos.shares); divest(s, carry, proceeds);
  pos.shares -= qty; pos.cost -= carry; if (pos.shares <= 0) delete s.stock.portfolio[rivalId]; return ok(`Sold ${qty.toLocaleString()} shares for $${Math.round(proceeds).toLocaleString()}.`);
}
export function portfolioValue(s: GameState) { let v = 0; for (const id in s.stock.portfolio) { const r = s.rivals.find(x => x.id === id); if (r) v += s.stock.portfolio[id].shares * stakePrice(r) * (r.publicCo ? 1 : 0.9); } return v; }

// -------------------------------------------------------------- history
export const PERIODS: Record<string, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '5Y': 1825, MAX: 99999 };
export function playerStockHistory(s: GameState, period: string, maxCandles = 90) {
  const all = s.stock.pxHist; const days = PERIODS[period] ?? 365; const closes = all.slice(-days); const startDay = s.day - closes.length + 1;
  const g = Math.max(1, Math.ceil(closes.length / maxCandles)); const candles: { o: number; h: number; l: number; c: number }[] = []; const labels: string[] = []; const line: number[] = [];
  for (let i = 0; i < closes.length; i += g) { const ch = closes.slice(i, i + g); const o = i === 0 ? ch[0] : closes[i - 1]; candles.push({ o, h: Math.max(o, ...ch), l: Math.min(o, ...ch), c: ch[ch.length - 1] }); line.push(ch[ch.length - 1]); labels.push(String(startDay + i)); }
  return { candles, labels, line, startDay, step: g };
}
export function isMonthStartDay(s: GameState) { return isMonthStart(s.day); }
void sigmoid;
