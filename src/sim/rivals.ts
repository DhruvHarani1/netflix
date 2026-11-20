// Competitor AI — rivals behave like businesses: they earn market-simulated revenue, pay costs, invest in R&D,
// launch products, react to the player, raise capital, buy startups, consolidate, go bankrupt, and new startups appear.
import type { GameState, Rival, RivalOffer, CatId, RegionId } from './types';
import { rnd, rrange, rint, chance, pick, gauss, clamp, lerp, sum, weighted, addNews, logEntry } from './util';
import { CAT, CATS } from '../data/categories';
import { DIFF, REGION } from '../data/core';
import { TECH, TECH_BY_ID } from '../data/research';
import { MAJORS, PRODUCT_LINE, VARIANTS, STARTUP_TPL, SYL_A, SYL_B, type MajorSpec } from '../data/rivals';

const SHARES_CAP = 1e12;
export const activeRivals = (s: GameState) => s.rivals.filter(r => r.status === 'active');
const cats = (r: Rival) => Object.keys(r.offers) as CatId[];
const posMult = (p: number) => (p >= 0 ? 1 + 0.9 * p : 1 + 0.4 * p);
const rlog = (s: GameState, r: Rival, text: string, kind: Rival['log'][number]['kind']) => { r.log.push({ day: s.day, text, kind }); if (r.log.length > 60) r.log.shift(); };
const yearsNow = (s: GameState) => s.day / 365.25;

function productName(s: GameState, r: Rival, cat: CatId): string {
  const v = pick(s, VARIANTS); const gen = 1 + Math.floor(yearsNow(s) + rint(s, 0, 6));
  return `${r.short} ${PRODUCT_LINE[cat]} ${gen}${v ? ' ' + v : ''}`.trim();
}
function makeOffer(s: GameState, r: Rival, cat: CatId, dq: number, svc: number, share: number, age = rint(s, 90, 500)): RivalOffer {
  const def = CAT[cat], m = s.market.cats[cat];
  const q = clamp(m.avgQ + dq + rrange(s, -2, 2), 25, 96);
  const price = m.ref * posMult(r.personality.premium) * (0.85 + 0.3 * q / 100);
  let base = 0, units = 0, rev = 0;
  if (def.sub) { base = (m.size * share) / Math.max(.01, def.churn * 12) * 0.35; rev = base * price / 30; units = rev / price; }
  else { units = (m.size * share) / 365; rev = units * price; }
  return { name: productName(s, r, cat), q, rel: clamp(q - 4 + rrange(s, -6, 6), 30, 95), inn: clamp(40 + r.personality.innov * 35 + rrange(s, -8, 8), 15, 95), ux: clamp(q + rrange(s, -8, 8), 25, 95), svc: clamp(svc || 50 + rrange(s, -8, 8), 20, 95), price, since: s.day - age - 200, lastLaunch: s.day - age, unitsEma: units, revEma: rev, base, focus: .5 };
}
const mkRival = (p: Partial<Rival>): Rival => ({
  id: '', name: '', short: '', color: '#888', logo: 0, kind: 'major', archetype: '', blurb: '', hq: 'na', personality: { aggr: .5, caution: .5, innov: .5, premium: 0, expand: .5, acquis: .3, marketing: .5, pr: .5 }, status: 'active', founded: 2000,
  cash: 0, debt: 0, headcount: 10, rd: 0, brand: 30, reach: .3, offers: {}, revM: 0, costM: 0, netM: 0, revEma: 0, costEma: 0, revHist: [], netHist: [], shares: 1e6, px: 10, pxHist: [10], valuation: 0, sentiment: 55, growth: .1,
  publicCo: true, log: [], strengths: [], weaknesses: [], relation: 0, negative: 0, founderOwned: .1, forSale: false, askMult: 1.4, ...p,
});

function buildMajor(s: GameState, m: MajorSpec): Rival {
  const dm = DIFF[s.difficulty].rival;
  const r = mkRival({
    id: m.id, name: m.name, short: m.short, color: m.color, logo: m.logo, kind: 'major', archetype: m.archetype, blurb: m.blurb, hq: m.hq, founded: m.founded,
    personality: { ...m.pers, aggr: clamp(m.pers.aggr * (0.8 + 0.2 * dm), 0, 1) }, strengths: m.strengths, weaknesses: m.weaknesses,
    cash: m.val * .1, debt: m.val * .02, headcount: m.heads, brand: m.brand, reach: m.reach, valuation: m.val, px: m.px, pxHist: [m.px], shares: m.val / m.px, publicCo: true, founderOwned: .05,
    rd: 0, relation: 0, sentiment: 55 + rint(s, -8, 8), growth: .06,
  });
  for (const c of Object.keys(m.cats) as CatId[]) { const sp = m.cats[c]!; r.offers[c] = makeOffer(s, r, c, sp.dq, sp.svc || 0, sp.share); if (sp.pm) r.offers[c]!.price *= sp.pm; }
  r.rd = m.val * 0.002 * (m.rdPct / .12);
  return r;
}
function startupName(s: GameState) { return pick(s, SYL_A) + pick(s, SYL_B); }
function spawnStartup(s: GameState, initial = false): Rival | null {
  const used = new Set(s.rivals.map(r => r.name)); let name = startupName(s), tries = 0; while (used.has(name) && tries++ < 20) name = startupName(s);
  const tpl = pick(s, STARTUP_TPL); const dm = DIFF[s.difficulty].rival;
  const colors = ['#00f5d4', '#fee440', '#f15bb5', '#9b5de5', '#00bbf9', '#ff9770', '#80ffdb', '#e0aaff'];
  const techs = tpl.tech.filter(t => TECH_BY_ID[t] && !s.research.done[t]); const grant = techs.length ? pick(s, techs) : undefined;
  const r = mkRival({
    id: 'st_' + (s.flags.stSeq = (s.flags.stSeq || 0) + 1), name, short: name, color: pick(s, colors), logo: rint(s, 0, 11), kind: 'startup', archetype: 'Venture-backed Startup', blurb: tpl.blurb, hq: pick(s, ['na', 'eu', 'as', 'me', 'na'] as RegionId[]),
    personality: { aggr: rrange(s, .3, .8), caution: rrange(s, .1, .5), innov: rrange(s, .75, 1), premium: rrange(s, -.2, .5), expand: .6, acquis: .1, marketing: .4, pr: .4 },
    cash: rrange(s, 1.2e6, 9e6) * (1 + 0.15 * Math.max(0, yearsNow(s))), headcount: rint(s, 8, 45), brand: rrange(s, 8, 25), reach: rrange(s, .08, .25), publicCo: false, founded: 2026 + Math.floor(yearsNow(s)),
    strengths: ['Innovation speed', 'Focused team'], weaknesses: ['Thin cash runway', 'Little brand awareness'], techGrant: grant, forSale: initial ? chance(s, .5) : chance(s, .3), askMult: rrange(s, 1.2, 2), founderOwned: .6,
    sentiment: 60,
  });
  const m = s.market.cats[tpl.cat]; if (!m) return null;
  const o = makeOffer(s, r, tpl.cat, rrange(s, -10, 8), 40, 0.002, rint(s, 30, 200)); o.inn = rrange(s, 70, 92); o.focus = .9; r.offers[tpl.cat] = o;
  r.valuation = startupValue(r); r.shares = 1e7; r.px = r.valuation / r.shares; r.pxHist = [r.px]; r.rd = r.headcount * 2500;
  s.rivals.push(r);
  if (!initial) addNews(s, `${name} emerges from stealth`, `${tpl.blurb}. Backed by fresh venture funding, the startup targets ${CAT[tpl.cat].name.toLowerCase()}s.`, 'rival', 'neutral', r.id);
  return r;
}
function startupValue(r: Rival): number {
  const best = Math.max(0, ...Object.values(r.offers).map(o => o!.q));
  return 2e6 + r.headcount * 110000 + Math.max(0, best - 40) * 90000 + r.revEma * 12 * 4 + r.cash * .5;
}

// ------------------------------------------------------------------ init ---
export function init(s: GameState): void {
  s.rivals = [];
  for (const m of MAJORS) s.rivals.push(buildMajor(s, m));
  const n = 4; for (let i = 0; i < n; i++) spawnStartup(s, true);
}
export function daily(s: GameState): void { /* rivals decide monthly; market writes accumulators daily */ }

// ------------------------------------------------------------- monthly -----
export function monthly(s: GameState): void {
  const dm = DIFF[s.difficulty].rival;
  const living = s.rivals.filter(r => r.status === 'active');
  for (const r of living) { finances(s, r); decide(s, r, dm); }
  consolidate(s);
  for (const r of living) if (r.status === 'active') checkSolvency(s, r);
  const startups = s.rivals.filter(r => r.status === 'active' && r.kind === 'startup').length;
  if (startups < 6 && chance(s, 0.07 + Math.max(0, 3 - startups) * 0.04)) spawnStartup(s);
  for (const r of s.rivals) if (r.status === 'active') r.relation = Math.round(r.relation * 0.98 * 10) / 10;
  // keep list bounded: drop oldest dead entries
  const dead = s.rivals.filter(r => r.status !== 'active'); if (dead.length > 40) { const rm = new Set(dead.slice(0, dead.length - 40).map(r => r.id)); s.rivals = s.rivals.filter(r => !rm.has(r.id) || r.status === 'active'); }
}

function finances(s: GameState, r: Rival) {
  const offs = Object.values(r.offers) as RivalOffer[];
  let rev = r.revM > 0 ? r.revM : sum(offs.map(o => o.revEma)) * 30; if (!isFinite(rev)) rev = 0;
  let cogs = r.costM > 0 ? r.costM : rev * 0.6; if (!isFinite(cogs)) cogs = rev * .6;
  const labor = REGION[r.hq].labor; const perHead = 8600 * labor * (1 + 0.025 * yearsNow(s));
  const payroll = r.headcount * perHead;
  const rdPct = r.kind === 'startup' ? 0.25 : clamp(0.04 + r.personality.innov * 0.1, 0.04, 0.22);
  const stress = r.negative > 0 ? 0.6 : 1;
  const rd = Math.max(r.headcount * 1800, rev * rdPct) * stress; r.rd = rd;
  const mkt = rev * 0.02 * (0.4 + r.personality.marketing);
  const interest = r.debt * 0.06 / 12;
  const sga = rev * (r.kind === 'startup' ? 0.1 : 0.15);
  let net = rev - cogs - Math.min(payroll * 0.55, rev * 0.3) - rd - mkt - sga - interest; // payroll partially inside rd -> avoid double counting
  if (net > 0) net *= 0.82;
  if (!isFinite(net)) net = 0;
  r.cash += net; r.netM = net; r.costM = 0; r.revM = 0;
  r.revEma = r.revEma ? r.revEma * .6 + rev * .4 : rev; r.costEma = r.costEma ? r.costEma * .6 + (rev - net) * .4 : rev - net;
  r.revHist.push(rev); r.netHist.push(net); if (r.revHist.length > 120) { r.revHist.shift(); r.netHist.shift(); }
  // headcount follows revenue (slowly)
  const rpp = (r.kind === 'startup' ? 260000 : 480000) * (1 + (rev * 12) / 1.5e11); const hcTarget = Math.max(r.kind === 'startup' ? 6 : 200, (rev * 12) / rpp);
  const rate = net < 0 && r.cash < payroll * 6 ? 0.1 : 0.05;
  const delta = (hcTarget - r.headcount) * rate; r.headcount = Math.max(3, Math.round(r.headcount + (net < 0 && delta > 0 ? 0 : delta)));
  // growth, sentiment, valuation
  if (r.revHist.length >= 6) { const n = r.revHist.length; const a = sum(r.revHist.slice(n - 3)) / 3, b = sum(r.revHist.slice(n - 6, n - 3)) / 3 || 1; const g = clamp(Math.pow(Math.max(.01, a / b), 4) - 1, -.6, 1.5); r.growth = lerp(r.growth, g, .3); }
  const margin = rev > 0 ? net / rev : -0.5;
  r.sentiment = clamp(r.sentiment + gauss(s) * 3 + r.growth * 6 + margin * 8 - (r.sentiment - 55) * .12, 12, 92);
  const mult = clamp(1.4 + 5 * Math.max(0, r.growth) + 5 * Math.max(0, margin) - 3 * Math.max(0, -margin), .7, 14) * (0.75 + r.sentiment / 200);
  let target = r.revEma * 12 * mult + r.cash - r.debt; if (r.kind === 'startup') target = Math.max(target, startupValue(r));
  target = Math.max(target, r.revEma * 12 * 0.4, 1e6);
  r.valuation = isFinite(target) ? lerp(r.valuation || target, target, .25) : r.valuation;
  r.shares = clamp(r.shares, 1, SHARES_CAP);
  if (r.cash < 0) r.negative++; else r.negative = 0;
}

function checkSolvency(s: GameState, r: Rival) {
  const monthlyCost = r.headcount * 8600 * REGION[r.hq].labor + r.rd;
  if (r.cash < monthlyCost * 3 && r.negative === 0 && r.cash >= 0) {
    // proactive fundraising
    if (r.kind === 'startup' ? chance(s, .5) : chance(s, .7)) {
      const amt = monthlyCost * (r.kind === 'startup' ? 14 : 8); const pct = amt / (r.valuation + amt);
      if (r.kind === 'major' && r.personality.caution > .5) { r.debt += amt; r.cash += amt; rlog(s, r, `Raises ${money(amt)} in debt financing`, 'cash'); }
      else { r.shares = clamp(r.shares / (1 - pct), 1, SHARES_CAP); r.cash += amt; rlog(s, r, `Raises ${money(amt)} (${(pct * 100).toFixed(0)}% dilution)`, 'cash'); if (r.kind === 'major' || amt > 2e7) addNews(s, `${r.name} raises ${money(amt)}`, `The ${r.archetype.toLowerCase()} is shoring up its balance sheet amid heavy spending.`, 'rival', 'neutral', r.id); }
    }
  }
  if (r.negative >= 3) bankrupt(s, r);
  else if (r.negative === 2 && r.kind === 'major') { r.headcount = Math.round(r.headcount * .85); rlog(s, r, 'Announces layoffs to stem losses', 'crisis'); addNews(s, `${r.name} cuts 15% of its workforce`, 'Losses are mounting and creditors are circling.', 'rival', 'bad', r.id); }
}
const money = (n: number) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

function bankrupt(s: GameState, r: Rival) {
  r.status = 'bankrupt'; r.offers = {}; r.forSale = false; r.headcount = 0;
  addNews(s, `${r.name} files for bankruptcy`, `After months of negative cash flow, ${r.name} has collapsed. Competitors and customers scramble to fill the gap.`, 'rival', r.kind === 'startup' ? 'neutral' : 'good', r.id);
  rlog(s, r, 'Files for bankruptcy', 'crisis');
}

// -------------------------------------------------------------- decisions --
function decide(s: GameState, r: Rival, dm: number) {
  const pers = r.personality; const startupMode = r.kind === 'startup';
  const playerLive = s.products.filter(p => p.status === 'live');
  for (const cat of cats(r)) {
    const o = r.offers[cat]!; const m = s.market.cats[cat]; const def = CAT[cat];
    const playerHere = playerLive.filter(p => p.cat === cat);
    const threatened = playerHere.length > 0 && m.playerShare > 0.03;
    // R&D focus
    const tFocus = clamp(0.35 + pers.innov * .3 + (threatened ? 2 * m.playerShare : 0) + (r.cash > 0 ? 0 : -.3), 0.1, 1);
    o.focus = lerp(o.focus, tFocus, .25);
    // continuous quality drift
    const pull = Math.max(0, (m.frontierQ - 4 - o.q)) * 0.02;
    const rdBoost = clamp(r.rd / Math.max(1, r.revEma + 1) * 4, .5, 1.6);
    const drift = (3 / 12) * (0.5 + pers.innov) * Math.pow(Math.max(0, 1 - o.q / 100), .7) * (0.7 + 0.6 * o.focus) * (0.85 + 0.15 * dm) * rdBoost + pull;
    o.q = clamp(o.q + drift, 20, 97);
    o.ux = clamp(o.ux + drift * .8, 20, 96); o.rel = clamp(o.rel + (88 - o.rel) * .01, 25, 96); o.inn = clamp(o.inn - .7 + pers.innov * .15, 12, 98);
    o.svc = clamp(o.svc + (r.kind === 'major' ? (72 - o.svc) * .01 : 0), 15, 95);
    // pricing
    let tp = m.ref * posMult(pers.premium) * (0.85 + 0.3 * o.q / 100);
    const ucost = m.ref * def.ucr * (0.6 + 0.8 * o.q / 100);
    const rival = playerHere.find(p => p.price < o.price * 1.08);
    if (threatened && rival) {
      if (pers.aggr > .55 && pers.caution < .75) {
        tp *= 1 - 0.07 * pers.aggr; if (chance(s, .3)) { rlog(s, r, `Cuts ${def.name} prices to counter ${s.co.name}'s ${rival.name}`, 'respond'); r.relation = clamp(r.relation - 3, -100, 100); }
      } else if (pers.premium > .3 && chance(s, .15)) rlog(s, r, `Holds premium pricing against ${rival.name}; leans on brand`, 'respond');
    }
    tp = Math.max(tp, ucost * 1.06);
    o.price = lerp(o.price, tp, 0.12);
    // react to a fresh player launch
    const fresh = playerHere.find(p => p.launchDay >= s.day - 40);
    if (fresh && (pers.aggr > .5 || pers.innov > .65) && !s.flags['resp_' + r.id + '_' + fresh.id]) { s.flags['resp_' + r.id + '_' + fresh.id] = 1; o.focus = Math.min(1, o.focus + .3); rlog(s, r, `Responding to ${s.co.name} ${fresh.name}: accelerating ${def.name} roadmap`, 'respond'); }
    // launches
    const months = (s.day - o.lastLaunch) / 30; const interval = (22 - 12 * pers.innov) * (1 + pers.caution * .25) / Math.max(.6, (0.9 + 0.1 * dm));
    if (months >= 6 && r.cash > r.rd * 2 && chance(s, clamp((months - 6) / (interval * 6), 0, .3))) launch(s, r, cat, o);
  }
  // expansion into new categories
  if (!startupMode || r.cash > 2e7) {
    const rich = r.cash > r.revEma * 3 && r.cash > r.rd * 12;
    if (rich && cats(r).length < (startupMode ? 3 : 9) && chance(s, 0.008 + 0.03 * pers.expand * dm * (startupMode ? .3 : 1))) enterCategory(s, r);
  }
  // brand & reach
  const brandTarget = (r.kind === 'major' ? 45 : 20) + 40 * pers.marketing + 15 * r.growth + (r.hq === s.co.hq ? 0 : 0);
  r.brand = clamp(r.brand + (brandTarget - r.brand) * .02 + gauss(s) * .4, 5, 98);
  if (r.reach < .96 && r.cash > r.rd) { const g = .004 * (.5 + pers.marketing) * (startupMode ? 1.6 : 1); r.reach = clamp(r.reach + g, 0, .97); if (chance(s, .01 * pers.marketing)) rlog(s, r, `Launches a ${pick(s, ['global', 'regional', 'influencer-led', 'sponsorship'])} marketing push`, 'marketing'); }
  if (r.kind === 'major' && chance(s, .04)) {
    const roll = rnd(s); if (r.headcount > 0 && roll < .5) rlog(s, r, `Hiring wave: headcount now ${Math.round(r.headcount).toLocaleString()}`, 'hire'); else if (roll < .8) rlog(s, r, `R&D budget set to ${money(r.rd)}/mo`, 'rd');
  }
  // buyback / debt paydown when flush
  const mc = r.rd + r.headcount * 8600;
  if (r.cash > mc * 24 && r.netM > 0) {
    if (r.debt > 0) { const pay = Math.min(r.debt, r.cash * .05); r.debt -= pay; r.cash -= pay; }
    else if (pers.caution > .5 && r.publicCo) { const bb = r.cash * .01; r.cash -= bb; r.shares = Math.max(1, r.shares * (1 - bb / Math.max(1, r.valuation))); if (chance(s, .2)) rlog(s, r, `Executes ${money(bb)} share buyback`, 'cash'); }
  }
  // sell-side flag for startups
  if (r.kind === 'startup') { if (r.cash < r.rd * 4) r.forSale = true; else if (chance(s, .03)) r.forSale = !r.forSale; }
  // acquire startups
  if (r.kind === 'major' && pers.acquis > .4 && chance(s, 0.015 * pers.acquis * dm)) {
    const targets = s.rivals.filter(t => t.status === 'active' && t.kind === 'startup'); const t = weighted(s, targets, x => (x.forSale ? 2 : .4));
    if (t) { const price = t.valuation * t.askMult; if (r.cash > price * 3) acquireStartup(s, r, t, price); }
  }
}

function launch(s: GameState, r: Rival, cat: CatId, o: RivalOffer) {
  const pers = r.personality; const m = s.market.cats[cat]; const def = CAT[cat];
  const gain = rrange(s, 3, 8) * (0.6 + pers.innov) * Math.max(.15, 1 - o.q / 110) + Math.max(0, m.frontierQ - o.q) * .4;
  o.q = clamp(o.q + gain, 20, 97); o.rel = clamp(o.rel - 3, 25, 95); o.inn = clamp(Math.max(o.inn, 55) + rrange(s, 10, 25), 15, 98); o.ux = clamp(o.ux + rrange(s, 0, 4), 20, 96);
  o.name = productName(s, r, cat); o.lastLaunch = s.day;
  o.price = lerp(o.price, m.ref * posMult(pers.premium) * (0.85 + 0.3 * o.q / 100), .6);
  rlog(s, r, `Launches ${o.name} (${def.name}, quality ${o.q.toFixed(0)})`, 'launch');
  const loud = r.kind === 'major' ? chance(s, .65) : chance(s, .25);
  if (loud) addNews(s, `${r.name} unveils ${o.name}`, `The new ${def.name.toLowerCase()} promises a ${gain.toFixed(0)}-point leap in capability${s.products.some(p => p.cat === cat && p.status === 'live') ? ' and lands squarely in your market' : ''}.`, 'rival', s.products.some(p => p.cat === cat && p.status === 'live') ? 'bad' : 'neutral', r.id);
  m.trend = clamp(m.trend + .05, -1, 1);
}
function enterCategory(s: GameState, r: Rival) {
  const owned = new Set(cats(r)); const unlocked = CATS.filter(c => !owned.has(c.id) && (s.market.cats[c.id].unlocked || c.req.length === 0 || chance(s, .15)));
  const pickC = weighted(s, unlocked, c => 1 + sum(cats(r).map(o => (CAT[o].syn.includes(c.id) ? 3 : 0) + (CAT[o].group === c.group ? 2 : 0))) + (c.growth > .1 ? 1 : 0));
  if (!pickC) return;
  const o = makeOffer(s, r, pickC.id, rrange(s, -10, 0) + r.personality.innov * 4, 45, 0.002, 0); o.since = s.day; o.lastLaunch = s.day; o.focus = .8; r.offers[pickC.id] = o;
  rlog(s, r, `Enters the ${pickC.name.toLowerCase()} market with ${o.name}`, 'expand');
  addNews(s, `${r.name} expands into ${pickC.name.toLowerCase()}s`, `${r.archetype} ${r.short} is diversifying; analysts see ${pickC.name} incumbents as exposed.`, 'rival', s.products.some(p => p.cat === pickC.id && p.status === 'live') ? 'bad' : 'neutral', r.id);
}
function mergeOffers(s: GameState, into: Rival, from: Rival, factor = .9) {
  for (const c of cats(from)) {
    const o = from.offers[c]!; const mine = into.offers[c];
    if (!mine) { into.offers[c] = { ...o, price: o.price }; }
    else { mine.q = Math.max(mine.q, mine.q + (o.q - mine.q) * .35); mine.inn = Math.max(mine.inn, o.inn * factor); mine.base += o.base; mine.revEma += o.revEma; mine.unitsEma += o.unitsEma; }
  }
  into.headcount += from.headcount;
}
function acquireStartup(s: GameState, buyer: Rival, t: Rival, price: number) {
  buyer.cash -= price; mergeOffers(s, buyer, t); t.status = 'acquired'; t.acquiredBy = buyer.id; t.offers = {}; t.forSale = false;
  rlog(s, buyer, `Acquires ${t.name} for ${money(price)}`, 'ma'); rlog(s, t, `Acquired by ${buyer.name}`, 'ma');
  addNews(s, `${buyer.name} acquires ${t.name} for ${money(price)}`, `${t.blurb}. The deal ${t.techGrant ? `brings technology in ${TECH_BY_ID[t.techGrant]?.name || 'advanced research'}` : 'adds talent'} to ${buyer.short}.`, 'rival', 'neutral', buyer.id);
}
function consolidate(s: GameState) {
  const sick = s.rivals.filter(r => r.status === 'active' && r.kind === 'major' && r.negative >= 2);
  for (const t of sick) {
    const buyers = s.rivals.filter(b => b.status === 'active' && b.kind === 'major' && b !== t && b.personality.acquis > .5 && b.cash > t.valuation * .3 * 2);
    if (buyers.length && chance(s, .5)) { const b = pick(s, buyers); const price = Math.max(1e6, t.valuation * .25); b.cash -= price; mergeOffers(s, b, t, .8); t.status = 'acquired'; t.acquiredBy = b.id; t.offers = {}; rlog(s, b, `Absorbs distressed ${t.name} for ${money(price)}`, 'ma'); rlog(s, t, `Absorbed by ${b.name}`, 'ma'); addNews(s, `${b.name} swallows struggling ${t.name}`, `A distressed sale for ${money(price)} reshapes the competitive landscape.`, 'rival', 'neutral', b.id); }
  }
  // occasional friendly mega-merger of the two smallest mid-caps would be too disruptive; skip.
}

// ------------------------------------------------------------- exports -----
export function adjustRelation(s: GameState, id: string, delta: number) { const r = s.rivals.find(x => x.id === id); if (r) r.relation = clamp(r.relation + delta, -100, 100); }
export interface RivalSummary { revMonth: number; marketShare: number; shares: Partial<Record<CatId, number>>; products: { cat: CatId; name: string; q: number; price: number; units: number }[]; }
export function rivalSummary(s: GameState, r: Rival): RivalSummary {
  const shares: Partial<Record<CatId, number>> = {}; const products: RivalSummary['products'] = [];
  let myRev = 0, tot = 0;
  for (const c of cats(r)) {
    const o = r.offers[c]!; const m = s.market.cats[c]; const rev = o.revEma * 30; myRev += rev;
    const sh = m.shares[r.id] ?? (m.rev30 > 0 ? rev / m.rev30 : 0); shares[c] = sh; tot += m.rev30; products.push({ cat: c, name: o.name, q: o.q, price: o.price, units: o.unitsEma * 30 });
  }
  const revMonth = r.status === 'active' ? (myRev > 0 ? myRev : r.revEma) : 0;
  return { revMonth, marketShare: tot > 0 ? myRev / tot : 0, shares, products };
}
/** Rivals that currently offer a category. */
export function rivalsIn(s: GameState, cat: CatId) { return s.rivals.filter(r => r.status === 'active' && r.offers[cat]); }
