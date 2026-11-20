// MERGERS & ACQUISITIONS — friendly offers, counters, hostile takeovers, subsidiaries, sales and spin-offs.
import type { GameState, Rival, Subsidiary, MAOffer } from './types';
import { clamp, sigmoid, rnd, gauss, toast, addNews, logEntry, sum } from './util';
import { acquireBusiness, divest, expense, saleOfBusiness, impairGoodwill } from './ledger';
import { rivalMcap, stakePrice, stakeShares } from './stock';
import { outstanding, type Res } from './finance';

const ok = (msg: string): Res => ({ ok: true, msg });
const no = (msg: string): Res => ({ ok: false, msg });

export function init(s: GameState): void {}

export const offerRev = (r: Rival) => { let t = 0; for (const k in r.offers) t += (r.offers as any)[k].revEma * 365; return t; };
export function valueOfTarget(s: GameState, r: Rival): number { return Math.max(200_000, r.valuation, r.publicCo && r.px > 0 ? rivalMcap(r) : 0); }
export function targets(s: GameState): Rival[] { return s.rivals.filter(r => r.status === 'active'); }
export function stakeOf(s: GameState, r: Rival) { const p = s.stock.portfolio[r.id]; return p ? p.shares / stakeShares(r) : 0; }
function needPremium(s: GameState, r: Rival): number {
  const p = r.personality; const v = valueOfTarget(s, r);
  let need = r.forSale ? Math.max(0.02, (r.askMult || 1.2) - 1) : 0.2 + 0.35 * p.caution + 0.15 * p.aggr + 0.2 * clamp(r.founderOwned, 0, 1);
  need -= (r.relation / 100) * 0.1; if (r.kind === 'startup') need -= 0.08; if (v > s.derived.valuation * 0.7) need += 0.1; if (v > s.derived.valuation * 2) need += 0.15; return clamp(need, 0.02, 1.2);
}
export function offerOdds(s: GameState, r: Rival, premium: number): number { return clamp(sigmoid((premium - needPremium(s, r)) * 9), 0.01, 0.97); }
export const offerPrice = (s: GameState, r: Rival, premium: number) => Math.round(valueOfTarget(s, r) * (1 + premium));
function recentlyRejected(s: GameState, rid: string) { return s.ma.offers.find(o => o.rivalId === rid && o.status === 'rejected' && s.day - o.day < 45); }

export function makeOffer(s: GameState, rivalId: string, premium: number): Res {
  const r = s.rivals.find(x => x.id === rivalId); if (!r || r.status !== 'active') return no('That company is no longer independent.');
  if (r.takeoverShield && s.day < r.takeoverShield) return no(`${r.name} has a poison pill active.`);
  if (recentlyRejected(s, rivalId)) return no('They rejected you recently — wait about 45 days before a new offer.');
  const price = offerPrice(s, r, premium); const effective = price - stakeValue(s, r); if (effective > s.fin.cash) return no(`You need ${fm(effective)} cash (have ${fm(s.fin.cash)}). Borrow or raise capital first.`);
  const odds = offerOdds(s, r, premium); const roll = rnd(s);
  const offer: MAOffer = { id: s.ma.nextOfferId++, rivalId, price, premium, kind: 'friendly', status: 'open', day: s.day, note: '' };
  s.ma.offers.push(offer); trim(s);
  if (roll < odds) { offer.status = 'accepted'; offer.note = 'Board accepted'; complete(s, r, price, 'friendly'); return ok(`${r.name} accepted! You now own it for ${fm(price)}.`); }
  const counterPrem = needPremium(s, r) + 0.03 + rnd(s) * 0.08;
  if (odds > 0.2 && roll < odds + 0.35) { offer.status = 'countered'; offer.counter = offerPrice(s, r, counterPrem); offer.note = `Board wants ${fm(offer.counter)} (+${(counterPrem * 100).toFixed(0)}% premium)`; return ok(`${r.name}'s board countered at ${fm(offer.counter)}. Review it under Offers.`); }
  offer.status = 'rejected'; offer.note = 'Board rejected'; r.relation = clamp(r.relation - 8, -100, 100); return no(`${r.name} rejected your offer outright.`);
}
export function acceptCounter(s: GameState, offerId: number): Res {
  const o = s.ma.offers.find(x => x.id === offerId); if (!o || o.status !== 'countered' || !o.counter) return no('Counter-offer no longer valid.'); const r = s.rivals.find(x => x.id === o.rivalId);
  if (!r || r.status !== 'active') { o.status = 'rejected'; return no('Target is gone.'); } if (s.day - o.day > 30) { o.status = 'rejected'; return no('The counter-offer expired.'); }
  const eff = o.counter - stakeValue(s, r); if (eff > s.fin.cash) return no(`Need ${fm(eff)} cash.`); o.status = 'accepted'; complete(s, r, o.counter, 'friendly'); return ok(`Deal done at ${fm(o.counter)}.`);
}
export function rejectCounter(s: GameState, offerId: number) { const o = s.ma.offers.find(x => x.id === offerId); if (o && o.status === 'countered') o.status = 'rejected'; }

export function hostileInfo(s: GameState, r: Rival, premium: number) {
  const stake = stakeOf(s, r); const need = 0.35 + clamp(r.founderOwned, 0, 0.9) * 0.6 + r.personality.caution * 0.2;
  const prob = r.publicCo ? clamp(sigmoid((stake + premium * 0.6 - need) * 7), 0.01, 0.95) : 0; const total = Math.round(rivalMcap(r) * (1 + premium));
  return { stake, prob, total, eff: total - stakeValue(s, r, 1 + premium), canTry: r.publicCo && stake >= 0.15 };
}
export function hostileTakeover(s: GameState, rivalId: string, premium: number): Res {
  const r = s.rivals.find(x => x.id === rivalId); if (!r || r.status !== 'active') return no('Target unavailable.'); if (!r.publicCo) return no('Hostile bids need a listed company.');
  if (r.takeoverShield && s.day < r.takeoverShield) return no('Poison pill active.'); const h = hostileInfo(s, r, premium); if (!h.canTry) return no(`Build a stake of at least 15% first (you hold ${(h.stake * 100).toFixed(1)}%).`);
  if (h.eff > s.fin.cash) return no(`Need ${fm(h.eff)} cash for the tender offer.`);
  const offer: MAOffer = { id: s.ma.nextOfferId++, rivalId, price: h.total, premium, kind: 'hostile', status: 'open', day: s.day, note: '' }; s.ma.offers.push(offer); trim(s);
  if (rnd(s) < h.prob) { offer.status = 'accepted'; offer.note = 'Shareholders tendered'; complete(s, r, h.total, 'hostile', 1 + premium); return ok(`Takeover succeeded! ${r.name} is now yours for ${fm(h.total)}.`); }
  offer.status = 'rejected'; offer.note = 'Tender failed'; r.takeoverShield = s.day + 180; r.relation = clamp(r.relation - 35, -100, 100); expense(s, h.total * 0.01, 'fees');
  addNews(s, `${r.name} fends off hostile bid from ${s.co.name}`, 'The board activated a poison pill.', 'rival', 'neutral', r.id); return no(`The tender offer failed. ${r.name} adopted a poison pill and costs of ${fm(h.total * 0.01)} were incurred.`);
}
function stakeValue(s: GameState, r: Rival, mult = 1): number { const p = s.stock.portfolio[r.id]; return p ? p.shares * stakePrice(r) * mult : 0; }
const fm = (n: number) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
function trim(s: GameState) { if (s.ma.offers.length > 60) s.ma.offers.splice(0, s.ma.offers.length - 60); }

function complete(s: GameState, r: Rival, price: number, kind: 'friendly' | 'hostile', stakeMult = 1) {
  const pos = s.stock.portfolio[r.id]; if (pos) { divest(s, pos.cost, pos.shares * stakePrice(r) * stakeMult); delete s.stock.portfolio[r.id]; }
  acquireBusiness(s, price, 0);
  const cats = Object.keys(r.offers) as any[]; const offers = JSON.parse(JSON.stringify(r.offers));
  const rev = offerRev(r) / 12; const culture = Math.round(clamp(55 + r.relation * 0.15 + (kind === 'friendly' ? 10 : -12) - Math.abs(r.personality.aggr - 0.5) * 20 + gauss(s) * 10, 15, 95));
  const sub: Subsidiary = {
    id: 'sub_' + r.id, name: r.name, color: r.color, fromRival: r.id, cats, offers, headcount: r.headcount, costM: Math.round(r.headcount * 7200 + rev * 0.08), revEma: 0, integration: 0,
    integrationCost: Math.round(price * 0.06 + r.headcount * 6000), bookValue: price, acquired: s.day, synergy: 0, culture, techGranted: undefined, reach: r.reach, brand: r.brand, region: r.hq, revHist: [],
  };
  if (r.techGrant && !s.research.done[r.techGrant]) { s.research.done[r.techGrant] = s.day; sub.techGranted = r.techGrant; toast(`Acquired technology: ${r.techGrant}`, 'good', 'research'); }
  s.ma.subs.push(sub); r.status = 'acquired'; r.acquiredBy = 'player'; r.offers = {}; r.log.push({ day: s.day, text: `Acquired by ${s.co.name} for ${fm(price)}`, kind: 'ma' });
  s.meta.stats.acquisitions = (s.meta.stats.acquisitions || 0) + 1; s.ma.history.push({ day: s.day, text: `Acquired ${r.name} for ${fm(price)}` });
  addNews(s, `${s.co.name} ${kind === 'hostile' ? 'seizes control of' : 'acquires'} ${r.name} for ${fm(price)}`, `Integration will take about 12 months; culture fit ${culture}/100.`, 'company', 'good', r.id);
  logEntry(s, `Acquired ${r.name} (${fm(price)})`, 'good'); toast(`Acquired ${r.name}!`, 'good', 'launch');
}

// ----------------------------------------------------------- subsidiaries
export function subValue(s: GameState, sub: Subsidiary): number {
  const rev = sub.revEma * 365; return Math.round(Math.max(rev * (1.2 + 1.4 * sub.integration * (sub.culture / 100)), sub.bookValue * 0.35));
}
export function sellSubsidiary(s: GameState, id: string): Res {
  const i = s.ma.subs.findIndex(x => x.id === id); if (i < 0) return no('Subsidiary not found.'); const sub = s.ma.subs[i]; const price = subValue(s, sub);
  saleOfBusiness(s, sub.bookValue, price); s.ma.subs.splice(i, 1); s.ma.history.push({ day: s.day, text: `Sold ${sub.name} for ${fm(price)}` });
  addNews(s, `${s.co.name} sells ${sub.name} for ${fm(price)}`, '', 'company', 'neutral'); return ok(`Sold ${sub.name} for ${fm(price)}.`);
}
/** Spin a subsidiary off as an independent listed company: sell 40% in an IPO, keep 60% as a marked-to-market investment. */
export function spinOff(s: GameState, id: string): Res {
  const i = s.ma.subs.findIndex(x => x.id === id); if (i < 0) return no('Subsidiary not found.'); const sub = s.ma.subs[i]; const rv = s.rivals.find(r => r.id === sub.fromRival); if (!rv) return no('Origin company record missing.');
  if (sub.integration < 0.5) return no('Finish at least half of integration before spinning off.'); const V = subValue(s, sub) * 1.15; const cash40 = V * 0.4 * 0.95;
  saleOfBusiness(s, sub.bookValue * 0.4, cash40); const keep = sub.bookValue * 0.6; const L = s.fin.ledger; const mv = Math.min(keep, L.goodwill); L.goodwill -= mv; L.invest += mv;
  const sh = 50_000_000; rv.status = 'active'; rv.acquiredBy = undefined; rv.offers = JSON.parse(JSON.stringify(sub.offers)); rv.publicCo = true; rv.shares = sh; rv.valuation = V; rv.px = V / sh; rv.pxHist = [rv.px];
  rv.cash = V * 0.04; rv.founderOwned = 0; rv.forSale = false; rv.headcount = sub.headcount; rv.name = sub.name + ' (spin-off)'; rv.relation = 30; rv.log.push({ day: s.day, text: 'Spun off from ' + s.co.name, kind: 'ma' });
  s.stock.portfolio[rv.id] = { shares: sh * 0.6, cost: mv }; s.ma.subs.splice(i, 1); s.ma.history.push({ day: s.day, text: `Spun off ${sub.name} (kept 60%)` });
  addNews(s, `${s.co.name} spins off ${sub.name} in a ${fm(cash40)} listing`, 'It keeps a 60% stake.', 'company', 'good'); return ok(`Spun off ${sub.name}: raised ${fm(cash40)}, kept a 60% stake.`);
}

export function daily(s: GameState): void {
  for (const sub of s.ma.subs) { let r = 0; for (const k in sub.offers) r += (sub.offers as any)[k].revEma; sub.revEma = r; }
  if (s.day % 5 === 0) for (const o of s.ma.offers) if (o.status === 'countered' && s.day - o.day > 30) o.status = 'rejected';
}
export function monthly(s: GameState): void {
  for (const sub of [...s.ma.subs]) {
    const synergy = sub.integration * (sub.culture / 100); sub.synergy = synergy;
    expense(s, sub.costM * (1 - 0.25 * synergy), 'other');
    if (sub.integration < 1) {
      sub.integration = Math.min(1, sub.integration + 1 / 12); expense(s, sub.integrationCost / 12, 'integration');
      if (sub.culture < 50 && rnd(s) < 0.1) { s.marketing.reputation = clamp(s.marketing.reputation - 1.5); for (const e of s.people.emps) if (rnd(s) < 0.15) e.happy = clamp(e.happy - 6);
        addNews(s, `Culture clash at ${sub.name} unsettles ${s.co.name} staff`, 'Morale dips as integration drags on.', 'people', 'bad'); }
    }
    for (const k in sub.offers) { const o = (sub.offers as any)[k]; o.q = clamp(o.q + synergy * 0.25, 0, 96); o.rel = clamp(o.rel + synergy * 0.15, 0, 96); }
    sub.revHist.push(sub.revEma * 30); if (sub.revHist.length > 120) sub.revHist.shift();
    if (sub.integration >= 1 && sub.revHist.length >= 6 && sub.bookValue > 1e5) {
      const yr = (sum(sub.revHist.slice(-6)) / 6) * 12;
      if (yr < sub.bookValue * 0.12 && (s.day - (s.flags['imp_' + sub.id] || 0)) > 180) { const amt = sub.bookValue * 0.15; impairGoodwill(s, amt); sub.bookValue -= amt; s.flags['imp_' + sub.id] = s.day; toast(`Goodwill impairment on ${sub.name}: ${fm(amt)}`, 'bad'); addNews(s, `${s.co.name} writes down ${sub.name} by ${fm(amt)}`, 'The acquisition is underperforming.', 'finance', 'bad'); }
    }
  }
}
void outstanding;
