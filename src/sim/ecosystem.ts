// ECOSYSTEM — synergy graph, lock-in, cross-sell, platform network effects, developer adoption.
import type { GameState, CatId } from './types';
import { clamp } from './util';
import { CATS, CAT } from '../data/categories';

const DEV_CATS: CatId[] = ['os', 'cloud', 'devplatform', 'aimodel', 'database', 'marketplace'];
const ANCHORS: CatId[] = ['os', 'cloud', 'marketplace', 'payment', 'devplatform', 'assistant'];

export function init(s: GameState): void { s.derived.ecosystem = { score: 0, lockin: 0, net: {}, devAdoption: 0, links: 0 }; }

/** installed users per category from live products + subsidiaries (partial weight) */
export function ownedUsers(s: GameState): Partial<Record<CatId, number>> {
  const u: Partial<Record<CatId, number>> = {};
  for (const p of s.products) if (p.status === 'live') u[p.cat] = (u[p.cat] || 0) + Math.max(p.base || 0, p.lifeUnits || 0, 1);
  for (const sub of s.ma.subs) for (const c of sub.cats) { const o = sub.offers[c]; u[c] = (u[c] || 0) + Math.max(1, (o?.base || 0) * 0.6, (o?.revEma || 0) * 30 / Math.max(1, CAT[c].ref)); }
  return u;
}
export const linked = (a: CatId, b: CatId) => CAT[a].syn.includes(b) || CAT[b].syn.includes(a);
const lg = (n: number) => Math.log10(1 + Math.max(0, n));

export function recompute(s: GameState, smoothDev = false) {
  const users = ownedUsers(s); const owned = Object.keys(users) as CatId[]; const e = s.derived.ecosystem;
  let links = 0; for (let i = 0; i < owned.length; i++) for (let j = i + 1; j < owned.length; j++) if (linked(owned[i], owned[j])) links++;
  const anchors = owned.filter(c => ANCHORS.includes(c)).length;
  const live = s.products.filter(p => p.status === 'live'); const rating = live.length ? live.reduce((a, p) => a + (p.rating || 3), 0) / live.length : 3;
  const satPts = clamp((rating - 2.5) * 4, 0, 10);
  e.links = links; e.score = clamp(Math.min(30, owned.length * 5) + Math.min(34, links * 6) + Math.min(24, anchors * 6) + satPts);
  e.lockin = clamp((e.score / 100) * 0.7 + Math.min(0.1, links * 0.01), 0, 0.85);
  // developer adoption (monthly smoothing)
  if (smoothDev) {
    let du = 0, q = 0, n = 0; for (const c of DEV_CATS) if (users[c]) { du += users[c]!; } for (const p of live) if (DEV_CATS.includes(p.cat)) { q += p.q; n++; }
    const tgt = du > 0 ? clamp((lg(du) / 8) * 100 * (0.55 + (n ? q / n : 50) / 110) + (owned.includes('marketplace') ? 6 : 0) + (s.legal.policies.opensource ? 6 : 0)) : 0;
    e.devAdoption = clamp(e.devAdoption + (tgt - e.devAdoption) * 0.1);
  }
  const net: Partial<Record<CatId, number>> = {};
  for (const c of CATS) {
    let cross = 0; for (const o of owned) if (o !== c.id && linked(o, c.id)) cross += 0.05 * Math.min(1.4, lg(users[o]!) / 6.5);
    let v = Math.min(0.2, cross);
    if (c.platform && users[c.id]) v += 0.1 * Math.min(1, lg(users[c.id]!) / 8);
    if (c.platform || DEV_CATS.includes(c.id)) v += (e.devAdoption / 100) * 0.07;
    net[c.id] = Math.min(0.35, v);
  }
  e.net = net;
}
export function daily(s: GameState): void { if (s.day % 3 === 0) recompute(s); }
export function monthly(s: GameState): void { recompute(s, true); }

export interface EcoLink { a: CatId; b: CatId; strength: number }
export interface EcoRec { cat: CatId; gain: number; text: string; unlocked: boolean }
export function ecosystemReport(s: GameState) {
  const users = ownedUsers(s); const owned = Object.keys(users) as CatId[]; const links: EcoLink[] = [];
  for (let i = 0; i < owned.length; i++) for (let j = i + 1; j < owned.length; j++) if (linked(owned[i], owned[j])) links.push({ a: owned[i], b: owned[j], strength: Math.min(1, (lg(users[owned[i]]!) + lg(users[owned[j]]!)) / 14) });
  const recs: EcoRec[] = [];
  for (const c of CATS) {
    if (owned.includes(c.id)) continue; const pals = owned.filter(o => linked(o, c.id)); if (!pals.length) continue;
    let cross = 0; for (const o of pals) cross += 0.05 * Math.min(1.4, lg(users[o]!) / 6.5);
    const gain = Math.min(0.2, cross); const unlocked = c.req.every(r => s.research.done[r] !== undefined);
    recs.push({ cat: c.id, gain, unlocked, text: `Add ${c.name}: +${(gain * 100).toFixed(0)}% demand from your ${pals.map(p => CAT[p].name).join(', ')} base${unlocked ? '' : ' (needs research)'}` });
  }
  recs.sort((x, y) => (Number(y.unlocked) - Number(x.unlocked)) || y.gain - x.gain);
  return { owned, users, links, recs, anchors: owned.filter(c => ANCHORS.includes(c)) };
}
export const ANCHOR_CATS = ANCHORS; export const DEV_CATEGORIES = DEV_CATS;
