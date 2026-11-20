// Customer & market simulation.  Every category is a pool of demand split across 7 customer segments x 7 regions.
// Every offering (player products, acquired subsidiaries, rival products, a generic "no-name" baseline) competes
// with a softmax over a weighted attribute score.  Awareness gates who can actually be bought.
import type { GameState, CatId, Seg, RegionId, RivalOffer, Product } from './types';
import { CATS, CAT, type CatDef } from '../data/categories';
import { SEGS, SEG, REGIONS, DIFF } from '../data/core';
import { TECH_BY_ID } from '../data/research';
import { clamp, dateOf, logEntry, rrange, gauss, rnd, pick, addNews, isMonthStart } from './util';
import { revenue, expense } from './ledger';

export const TEMP = 10;          // softmax temperature (score points per e-fold)
export const OUTSIDE = 38;       // score of "don't buy"
const AW_EXP = 2.2;              // how hard low awareness gates sales
export const PRESS_DAYS = 90;    // launch buzz window

export function unlocked(s: GameState, cat: CatId): boolean { return CAT[cat].req.every(r => !!s.research.done[r]); }
/** Per-unit (hw/sw) or per-user-month (sub) cost of a rival-style offer. */
export function offerUnitCost(cat: CatDef, o: { q: number }): number { return cat.ref * cat.ucr * (0.62 + 0.62 * clamp(o.q, 0, 100) / 100) * 0.9; }
export const awarenessGate = (aw: number) => 0.012 + 0.988 * Math.pow(clamp(aw, 0, 100) / 100, AW_EXP);
export function seasonFactor(day: number, season: number) { const t = dateOf(day); return 1 + season * 0.5 * Math.cos(((t.m - 10.5) / 12) * Math.PI * 2); }
/** How many 'phone-equivalents' of factory capacity one unit of this category consumes. */
export const capWeight = (cat: CatDef) => Math.max(0.2, Math.pow(cat.ref / 450, 0.85));
export function loadPerUser(cat: CatId): number { return ({ cloud: 40, aimodel: 120, database: 15, security: 0.6, devplatform: 3, assistant: 1.2, social: 0.6, streaming: 1.5, search: 0.4, payment: 0.3, marketplace: 0.5 } as any)[cat] ?? 1; }

interface Off {
  key: string; owner: 'player' | 'sub' | 'rival' | 'gen'; id: string; q: number; rel: number; inn: number; ux: number; svc: number; eco: number; price: number;
  brand: number; reach: number; hq: RegionId | null; mult: number; age: number;
  prod?: Product; ro?: RivalOffer; rivalIdx?: number; subIdx?: number; hype: number;
}

export function init(s: GameState): void { for (const c of CATS) s.market.cats[c.id].unlocked = unlocked(s, c.id); }

/** Effective demand (units/day) in a category before splitting. */
function demandOf(s: GameState, cat: CatDef): number {
  const cm = s.market.cats[cat.id]; const econ = s.market.econ;
  return (cm.size / 365) * seasonFactor(s.day, cat.season) * econ.demandMult * (1 + clamp(cm.trend, -1, 1) * 0.25);
}

const regionWeightCache: Record<string, number> = {};
function regionSegWeights(cat: CatDef) {
  const out: { r: RegionId; g: Seg; w: number; pm: number }[] = [];
  for (const r of REGIONS) {
    let tot = 0; const ws: number[] = [];
    for (const g of SEGS) { const bias = g === 'premium' ? r.premiumBias : g === 'budget' ? -r.premiumBias : 0; const w = cat.seg[g] * (1 + bias); ws.push(w); tot += w; }
    SEGS.forEach((g, i) => out.push({ r: r.id, g, w: r.pop * (ws[i] / tot), pm: Math.pow(r.power, 0.7) }));
  }
  return out;
}
const WCACHE: Partial<Record<CatId, ReturnType<typeof regionSegWeights>>> = {};

export function daily(s: GameState): void {
  const diff = DIFF[s.difficulty];
  let playerRev = 0, playerCogs = 0, subRev = 0, subCogs = 0;
  const α = 1 / 30;
  // capacity left today
  let mfgLeft = (s.derived.mfgCap || 0) / 30; let dcLeft = (s.derived.dcCap || 0);
  let dcUsed = 0; for (const p of s.products) if (p.status === 'live' && CAT[p.cat].cls === 'svc' && !p.outsource) dcUsed += p.base * loadPerUser(p.cat);
  dcLeft -= dcUsed;
  const regRev: Record<string, number> = {};
  for (const cat of CATS) {
    const cm = s.market.cats[cat.id];
    // gather offers
    const offs: Off[] = [];
    for (const p of s.products) if (p.status === 'live' && p.cat === cat.id) {
      const age = s.day - p.launchDay; const buzz = age < PRESS_DAYS ? 1 + 0.35 * (1 - age / PRESS_DAYS) : 1;
      const net = 1 + (s.derived.ecosystem.net[cat.id] || 0) + (s.derived.ecosystem.lockin || 0) * 0.15;
      offs.push({ key: 'p' + p.id, owner: 'player', id: 'player', q: p.q, rel: p.rel, inn: clamp(p.inn - age * 0.028 + p.devBuzz * 0.1), ux: p.ux, svc: s.derived.service, eco: s.derived.ecosystem.score, price: p.price, brand: 0, reach: 1, hq: s.co.hq, mult: buzz * net * diff.demand * (1 + p.promo / 250), age, prod: p, hype: p.promo });
    }
    s.ma.subs.forEach((sub, si) => { const ro = sub.offers[cat.id]; if (ro) offs.push({ key: `s${si}`, owner: 'sub', id: sub.id, q: ro.q, rel: ro.rel, inn: ro.inn, ux: ro.ux, svc: ro.svc, eco: s.derived.ecosystem.score * .5, price: ro.price, brand: sub.brand, reach: sub.reach, hq: sub.region, mult: 1, age: s.day - ro.since, ro, subIdx: si, hype: 0 }); });
    s.rivals.forEach((r, ri) => { if (r.status !== 'active') return; const ro = r.offers[cat.id]; if (ro) offs.push({ key: `r${ri}`, owner: 'rival', id: r.id, q: ro.q, rel: ro.rel, inn: clamp(ro.inn - (s.day - ro.lastLaunch) * 0.02), ux: ro.ux, svc: ro.svc, eco: 25 + r.brand * .25, price: ro.price, brand: r.brand, reach: r.reach, hq: r.hq, mult: 1, age: s.day - ro.since, ro, rivalIdx: ri, hype: 0 }); });
    if (offs.length === 0) { cm.rev30 *= 1 - α; cm.units30 *= 1 - α; continue; }
    // category averages (for relative quality) — slow EMA from live offers
    let qs = 0, qw = 0; for (const o of offs) { const w = o.owner === 'player' ? 1 : 1.5; qs += o.q * w; qw += w; }
    const avgQ = qs / qw; cm.avgQ += (avgQ - cm.avgQ) * 0.02; cm.frontierQ += (Math.max(...offs.map(o => o.q)) - cm.frontierQ) * 0.02;
    offs.push({ key: 'gen', owner: 'gen', id: 'gen', q: cm.avgQ * 0.82, rel: 48, inn: 25, ux: 40, svc: 35, eco: 15, price: cm.ref * 0.68, brand: 30, reach: 0.55, hq: null, mult: 1, age: 999, hype: 0 });
    const demand = demandOf(s, cat); const W = WCACHE[cat.id] || (WCACHE[cat.id] = regionSegWeights(cat));
    const units = new Float64Array(offs.length); const unitsReg: Record<string, number>[] = offs.map(() => ({}));
    const outsideBase = Math.exp(OUTSIDE / TEMP);
    const aw = s.marketing.awareness; const rep = s.marketing.reputation;
    const sat = clamp(cm.saturation, 0, 0.98);
    for (const cell of W) {
      const sd = SEG[cell.g]; const w = sd.w; const dem = demand * cell.w; if (dem <= 0) continue;
      const refP = cm.ref * cell.pm * sd.priceMult;
      let tot = outsideBase * (1 + sat * 0.8); const A = new Float64Array(offs.length);
      for (let i = 0; i < offs.length; i++) {
        const o = offs[i];
        let avail: number, brand: number;
        if (o.owner === 'player') { avail = (s.regions[cell.r].presence / 100) * awarenessGate(aw[cell.g] + (o.hype * 0.2)); brand = 0.5 * rep + 0.5 * aw[cell.g]; }
        else if (o.owner === 'gen') { avail = 0.5; brand = 30; }
        else { const base = o.hq === cell.r ? Math.min(1, o.reach * 1.3) : o.reach; avail = base * awarenessGate(o.brand * 1.05); brand = o.brand; }
        if (avail < 1e-5) continue;
        const priceAttr = 100 / (1 + Math.pow(o.price / refP, 2.2));
        const perfAttr = clamp(50 + (o.q - cm.avgQ) * 1.5);
        const score = w.price * priceAttr + w.perf * perfAttr + w.brand * brand + w.inn * o.inn + w.rel * o.rel + w.svc * o.svc + w.eco * o.eco + 0.05 * o.ux;
        A[i] = Math.exp(score / TEMP) * avail * o.mult; tot += A[i];
      }
      for (let i = 0; i < offs.length; i++) if (A[i] > 0) { const u = (dem * A[i]) / tot; units[i] += u; if (offs[i].owner === 'player') unitsReg[i][cell.r] = (unitsReg[i][cell.r] || 0) + u; }
    }
    // dispatch sales
    let catUnits = 0, catRev = 0;
    const shares: Record<string, number> = {};
    for (let i = 0; i < offs.length; i++) {
      const o = offs[i]; let u = units[i]; if (u <= 0 && !(cat.sub && ((o.prod?.base || o.ro?.base || 0) > 0))) { if (o.owner !== 'gen') updateEma(o, 0, 0, α, cat); continue; }
      if (o.owner === 'player' && o.prod) {
        const p = o.prod; let lost = 0;
        const cw = capWeight(cat);
        if (cat.cls === 'hw' && !p.outsource) { const room = Math.max(0, mfgLeft) / cw; if (u > room) { lost = u - room; u = room; } mfgLeft -= u * cw; }
        else if (cat.cls === 'hw' && p.outsource) { const cap = outsourceCap(s, p) / cw; if (u > cap) { lost = u - cap; u = cap; } }
        else if (cat.cls === 'svc' && !p.outsource) { const room = Math.max(0, dcLeft / loadPerUser(cat.id)); if (u > room) { lost = u - room; u = room; } dcLeft -= u * loadPerUser(cat.id); }
        // new-entrant ramp (Bass-style): awareness seeds adoption, word-of-mouth compounds it
        { const cap = rampCap(s, cat, p, demand); if (u > cap) { p.rampLimited = true; u = cap; } else p.rampLimited = false; p.rampCap = cap; }
        p.lost30 += lost; p.sold30 += u;
        const rev = recognise(s, cat, o, u, 'player');
        playerRev += rev.rev; playerCogs += rev.cogs; catUnits += u; catRev += rev.rev;
        for (const r in unitsReg[i]) regRev[r] = (regRev[r] || 0) + rev.rev * (unitsReg[i][r] / (units[i] || 1));
        shares['player'] = (shares['player'] || 0) + rev.rev;
      } else if (o.owner === 'sub' && o.ro) {
        const rev = recognise(s, cat, o, u, 'sub'); subRev += rev.rev; subCogs += rev.cogs; catUnits += u; catRev += rev.rev; shares['player'] = (shares['player'] || 0) + rev.rev;
      } else if (o.owner === 'rival' && o.ro) {
        const rev = recognise(s, cat, o, u, 'rival'); const r = s.rivals[o.rivalIdx!]; r.revM += rev.rev; r.costM += rev.cogs; catUnits += u; catRev += rev.rev; shares[r.id] = (shares[r.id] || 0) + rev.rev;
      } else { const rr = u * (o.price); catUnits += u; catRev += rr; shares.gen = (shares.gen || 0) + rr; }
    }
    cm.rev30 += (catRev * 30 - cm.rev30) * α; cm.units30 += (catUnits * 30 - cm.units30) * α; // 30-day-equivalent totals
    if (isMonthStart(s.day + 1) || !cm.shares) { /* shares recomputed monthly */ }
    // smooth share (EMA of revenue) stored in cm.shares as running revenue EMA fractions
    const tr = Object.values(shares).reduce((a, b) => a + b, 0) || 1;
    for (const k in shares) cm.shares[k] = (cm.shares[k] ?? shares[k] / tr) + (shares[k] / tr - (cm.shares[k] ?? shares[k] / tr)) * α;
    for (const k of Object.keys(cm.shares)) if (!(k in shares)) cm.shares[k] *= 1 - α;
    cm.playerShare = cm.shares['player'] || 0;
  }
  if (playerRev > 0) revenue(s, playerRev, 'products'); if (playerCogs > 0) expense(s, playerCogs, 'cogs');
  if (subRev > 0) revenue(s, subRev, 'subsidiaries'); if (subCogs > 0) expense(s, subCogs, 'cogs');
  for (const r of REGIONS) { const st = s.regions[r.id]; st.revenueEma += ((regRev[r.id] || 0) - st.revenueEma) * α; }
}

export function rampCap(s: GameState, cat: CatDef, p: Product, demand: number): number {
  let aw = 0, tw = 0; for (const g of SEGS) { aw += s.marketing.awareness[g] * cat.seg[g]; tw += cat.seg[g]; } aw /= tw || 1;
  const reach = REGIONS.reduce((a, r) => a + r.pop * s.regions[r.id].presence / 100, 0);
  const seed = demand * 2.2e-5 * (1 + 45 * Math.pow(aw / 100, 1.3)) * (0.6 + 0.8 * reach) * (1 + p.promo / 60);
  const q = cat.cls === 'hw' ? 0.0035 : cat.platform ? 0.0085 : 0.0055;
  const wom = clamp(Math.pow(p.satisf / 60, 2), 0.2, 1.8) * (1 + (s.derived.ecosystem.net[cat.id] || 0) * 2 + s.derived.ecosystem.lockin * 0.3);
  const cum = cat.sub ? p.lifeUnits : p.lifeUnits;
  return seed + q * wom * Math.pow(cum, 0.995);
}
function outsourceCap(s: GameState, p: Product): number {
  // contract manufacturers ramp with the relationship: small at first, growing with age and brand
  const months = Math.max(0, (s.day - p.launchDay) / 30);
  return (800 + 2200 * Math.pow(months + 1, 1.35)) * (1 + s.marketing.reputation / 60) / 30 * Math.max(1, s.derived.dept.ops.eff);
}

/** Convert units to revenue/cogs and update base/EMAs for any offer type. */
function recognise(s: GameState, cat: CatDef, o: Off, units: number, who: 'player' | 'sub' | 'rival'): { rev: number; cogs: number } {
  const α = 1 / 30; let rev = 0, cogs = 0;
  const ref = o.prod || o.ro!;
  if (cat.sub) {
    const churnM = cat.churn * (who === 'player' ? churnMult(s, o.prod!) : 1);
    const base = ref.base; const nb = Math.max(0, base * (1 - churnM / 30) + units); ref.base = nb;
    rev = (base * o.price) / 30; const uc = who === 'player' ? o.prod!.ucost : offerUnitCost(cat, o); cogs = (base * uc * (who === 'player' && o.prod!.outsource ? 1.25 : 1)) / 30;
    if (who === 'player') { const p = o.prod!; p.platformUsers = nb; }
  } else {
    rev = units * o.price;
    if (who === 'player') { const p = o.prod!; cogs = units * p.ucost * (p.outsource ? 1.18 : 1) * Math.max(0.7, 1 - 0.04 * Math.log10(1 + p.lifeUnits / 1e4)); }
    else cogs = units * offerUnitCost(cat, o);
  }
  if (who === 'player') { const p = o.prod!; p.lifeRev += rev; p.lifeUnits += units; p.unitsEma += (units - p.unitsEma) * α; p.revEma += (rev - p.revEma) * α; }
  else { const ro = o.ro!; ro.unitsEma += (units - ro.unitsEma) * α; ro.revEma += (rev - ro.revEma) * α; }
  return { rev, cogs };
}
function updateEma(o: Off, units: number, rev: number, α: number, cat: CatDef) {
  const t: any = o.prod || o.ro; if (!t) return; t.unitsEma += (units - t.unitsEma) * α; t.revEma += (rev - t.revEma) * α;
  if (cat.sub && t.base > 0) { const churn = cat.churn * (o.prod ? 1.6 : 1); t.base = Math.max(0, t.base * (1 - churn / 30)); }
  if (cat.sub && o.prod) { const rv = (t.base * o.price) / 30; /* revenue from existing base even w/o new sales handled when units>0 */ }
}
export function churnMult(s: GameState, p: Product): number {
  return clamp(1.7 - 0.0125 * p.satisf, 0.55, 1.8) * (1 - 0.4 * s.derived.ecosystem.lockin) * (1 + Math.max(0, p.bugs - 30) / 100);
}

// ----------------------------------------------------------------- monthly --
export function monthly(s: GameState): void {
  const econ = s.market.econ;
  // category evolution
  for (const cat of CATS) {
    const cm = s.market.cats[cat.id]; cm.unlocked = unlocked(s, cat.id);
    cm.size *= 1 + (cm.growth * (econ.cycle === 'recession' ? 0.4 : econ.cycle === 'boom' ? 1.3 : 1)) / 12;
    cm.growth = Math.max(0.004, cm.growth * 0.9965);
    cm.ref *= 1 - 0.018 / 12; // tech deflation
    cm.trend += (-cm.trend * 0.08) + gauss(s) * 0.04;
    cm.trend = clamp(cm.trend, -1, 1);
    cm.saturation = clamp(cm.saturation + 0.002 * (1 + cm.growth * 3), 0, 0.97);
    // market-wide quality creep: the whole industry gets better
    cm.avgQ = Math.min(96, cm.avgQ + 0.18);
  }
  // player's products: satisfaction, ratings, reviews
  for (const p of s.products) if (p.status === 'live') monthlyProduct(s, p);
  // share of the market
  let pr = 0, tot = 0; for (const cat of CATS) { const cm = s.market.cats[cat.id]; const mine = s.products.some(p => p.status === 'live' && p.cat === cat.id) || s.ma.subs.some(x => x.offers[cat.id]); if (mine) { tot += cm.rev30; pr += cm.rev30 * cm.playerShare; } }
  s.derived.marketShare = tot > 0 ? pr / tot : 0;
}

const POS = ['Blazing fast and beautifully built.', 'Finally, something that just works.', 'Best in class — worth every penny.', 'A big leap over last generation.', 'Setup took minutes and it has been flawless.', 'Impressive value for the price.', 'Premium feel without the premium tax.'];
const NEG = ['Buggy and unfinished — crashes weekly.', 'Overpriced for what it delivers.', 'Support took days to answer.', 'Feels dated next to the competition.', 'Battery / performance fell short of the promises.', 'Great idea, poor execution.', 'Reliability issues ruined it for me.'];
const MID = ['Solid, if unremarkable.', 'Does the job. Nothing more.', 'Decent value, rough edges.', 'Good for the money but not exciting.'];
function monthlyProduct(s: GameState, p: Product) {
  const cat = CAT[p.cat]; const cm = s.market.cats[p.cat];
  const valueRatio = (Math.max(10, p.q) / Math.max(30, cm.avgQ)) / Math.max(0.2, p.price / cm.ref);
  const valueScore = clamp(52 + 38 * Math.log(Math.max(0.2, valueRatio)), 0, 100);
  const perf = clamp(50 + (p.q - cm.avgQ) * 1.6);
  let sv = 0.28 * p.rel + 0.24 * perf + 0.26 * valueScore + 0.12 * s.derived.service + 0.10 * p.ux;
  if (!p.outsource && cat.cls === 'svc' && s.derived.dcCap < p.platformUsers * loadPerUser(p.cat)) sv -= 10;
  if (p.lost30 > p.sold30 * 0.3 && p.lost30 > 0) sv -= 4; // shortages annoy
  p.satisf = clamp(p.satisf * 0.7 + clamp(sv) * 0.3);
  p.rating = Math.round((1 + 4 * (p.satisf / 100)) * 10) / 10;
  p.hist.push({ day: s.day, units: p.unitsEma * 30, rev: p.revEma * 30, base: p.base }); if (p.hist.length > 120) p.hist.shift();
  p.lost30 = 0; p.sold30 = 0; p.promo *= 0.8; p.devBuzz *= 0.97;
  // a handful of customer reviews each month
  const n = p.unitsEma * 30 > 5000 || p.base > 5000 ? 2 : p.unitsEma * 30 > 200 || p.base > 200 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const g = pick(s, SEGS); const stars = clamp(Math.round(1 + 4 * (clamp(p.satisf + gauss(s) * 14)) / 100), 1, 5);
    const text = stars >= 4 ? pick(s, POS) : stars <= 2 ? pick(s, NEG) : pick(s, MID);
    p.reviews.push({ day: s.day, stars, who: g, text }); if (p.reviews.length > 40) p.reviews.shift();
  }
  // reputation drift from satisfaction is handled by marketing module; negative buzz news for very bad products
  if (p.satisf < 28 && p.base + p.unitsEma * 30 > 2000 && rnd(s) < 0.25) { addNews(s, `${s.co.name}'s ${p.name} slammed by reviewers`, `Customers cite ${p.bugs > 35 ? 'persistent bugs' : 'poor value'}. Rating: ${p.rating.toFixed(1)}/5.`, 'company', 'bad'); }
}
