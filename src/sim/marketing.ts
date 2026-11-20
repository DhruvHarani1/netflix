import { perkMult } from './achievements';
import type { GameState, Channel, Campaign, Seg, RegionId } from './types';
import { clamp, lerp, dateOf, toast, sfx, logEntry, addNews, avg, pick } from './util';
import { expense } from './ledger';
import { SEGS, SEG, REGION, REGIONS } from '../data/core';

export interface ChannelDef { id: Channel; name: string; icon: string; desc: string; cpp: number /* $ per awareness point per month at full audience */; min: number; rep: number; loyal: number }
export const CHANNELS: ChannelDef[] = [
  { id: 'tv', name: 'Television', icon: '📺', desc: 'Broad mainstream reach. Expensive and blunt.', cpp: 120000, min: 20000, rep: 0, loyal: 0 },
  { id: 'social', name: 'Social Media', icon: '📱', desc: 'Cheap, targeted reach with younger and budget buyers.', cpp: 32000, min: 2000, rep: 0, loyal: .01 },
  { id: 'influencer', name: 'Influencers', icon: '🤳', desc: 'Viral and fast — but reads as discount-brand to premium buyers.', cpp: 42000, min: 3000, rep: 0, loyal: .01 },
  { id: 'search', name: 'Search Ads', icon: '🔎', desc: 'Intent-driven. Great for enterprise and developers.', cpp: 52000, min: 2000, rep: 0, loyal: 0 },
  { id: 'sponsor', name: 'Sponsorships', icon: '🏟️', desc: 'Prestige associations that lift premium perception.', cpp: 150000, min: 25000, rep: .1, loyal: .02 },
  { id: 'event', name: 'Product Events', icon: '🎤', desc: 'Keynotes and trade shows. Builds hype for a product.', cpp: 90000, min: 10000, rep: .05, loyal: .03 },
  { id: 'pr', name: 'Public Relations', icon: '📰', desc: 'Earned media and thought leadership; steadily lifts reputation.', cpp: 26000, min: 2000, rep: .25, loyal: .01 },
  { id: 'global', name: 'Global Campaign', icon: '🌐', desc: 'Everywhere at once. Enormous cost; boosts awareness in every segment.', cpp: 320000, min: 100000, rep: .05, loyal: .01 },
];
export const CH: Record<Channel, ChannelDef> = Object.fromEntries(CHANNELS.map(c => [c.id, c])) as any;

export const sizeScale = (s: GameState) => clamp(Math.sqrt(Math.max(1, s.derived.revYr) / 2e6), 1, 60);
/** Share of the world (population weighted) where the company has market access. */
export function presenceWeight(s: GameState): number { let t = 0; for (const r of REGIONS) t += r.pop * s.regions[r.id].presence / 100; return t; }
function audience(s: GameState, region: RegionId | 'all'): number { return region === 'all' ? presenceWeight(s) : REGION[region].pop * s.regions[region].presence / 100; }
const cppAt = (ch: Channel, aud: number) => CH[ch].cpp * (0.15 + 1.7 * aud);
const mEff = (s: GameState) => clamp(s.derived.dept.marketing?.eff ?? 1, .7, 1.5) * perkMult(s, 'marketing');

/** Monthly awareness change for each segment from a campaign (negative for poor-fit channels). */
export function campaignEffect(s: GameState, c: { channel: Channel; budget: number; product: number | null; region: RegionId | 'all' }): { seg: Record<Seg, number>; promo: number } {
  const aud = audience(s, c.region), pw = Math.max(.01, presenceWeight(s)); const out = {} as Record<Seg, number>;
  const pts = aud > 0 ? c.budget / cppAt(c.channel, aud) : 0; const share = c.region === 'all' ? 1 : Math.min(1, aud / pw);
  const prod = c.product != null ? s.products.find(p => p.id === c.product) : null;
  for (const g of SEGS) {
    const fit = SEG[g].mediaFit[c.channel] ?? 0; const aw = s.marketing.awareness[g];
    let d = fit >= 0 ? pts * fit * share * mEff(s) * Math.pow(Math.max(0, 1 - aw / 100), 1.3) : pts * fit * share * .5 * (aw / 100 + .2);
    if (prod) d *= .6; if (c.channel === 'global') d *= 1.0;
    out[g] = d;
  }
  let promo = 0; if (prod) { const fit = Math.max(0, SEG[prod.target].mediaFit[c.channel] ?? 0); promo = pts * 4 * fit * mEff(s) * Math.max(0, 1 - prod.promo / 100); }
  return { seg: out, promo };
}
/** Forecast for the UI: awareness per segment after the full campaign, total cost, product hype. */
export function estimateReach(s: GameState, c: { channel: Channel; budget: number; months: number; product: number | null; region: RegionId | 'all' }) {
  const e = campaignEffect(s, c); const seg = {} as Record<Seg, number>; for (const g of SEGS) seg[g] = clamp(s.marketing.awareness[g] + e.seg[g] * c.months * .85, 0, 100) - s.marketing.awareness[g];
  return { seg, cost: c.budget * c.months, promo: e.promo * c.months, aud: audience(s, c.region) };
}
export function launchCampaign(s: GameState, a: { channel: Channel; budget: number; months: number; product: number | null; region: RegionId | 'all' }): { ok: boolean; msg: string } {
  const ch = CH[a.channel];
  if (a.budget < ch.min) return { ok: false, msg: `${ch.name} needs at least $${ch.min.toLocaleString()} per month.` };
  if (a.months < 1) return { ok: false, msg: 'Pick a duration of at least one month.' };
  if (s.marketing.campaigns.length >= 8) return { ok: false, msg: 'Too many active campaigns (max 8). Stop one first.' };
  if (!s.sandboxCash && s.fin.cash < a.budget) return { ok: false, msg: 'Not enough cash for the first month of this campaign.' };
  if (audience(s, a.region) <= 0) return { ok: false, msg: a.region === 'all' ? 'You have no market presence anywhere yet.' : `No market presence in ${REGION[a.region as RegionId].name} — open an office first.` };
  if (a.product != null && !s.products.find(p => p.id === a.product)) return { ok: false, msg: 'That product no longer exists.' };
  const id = s.marketing.nextId++; const name = `${ch.name}${a.product != null ? ' · ' + s.products.find(p => p.id === a.product)!.name : ''}`;
  s.marketing.campaigns.push({ id, channel: a.channel, budget: a.budget, start: s.day, end: s.day + Math.round(a.months * 30), product: a.product, region: a.region, name });
  toast(`Campaign launched: ${name}`, 'good', 'success'); logEntry(s, `Launched ${name} campaign ($${Math.round(a.budget).toLocaleString()}/mo)`, 'neutral');
  return { ok: true, msg: 'Campaign launched.' };
}
export function stopCampaign(s: GameState, id: number) { s.marketing.campaigns = s.marketing.campaigns.filter(c => c.id !== id); }

export const PR_ACTIONS: { id: string; name: string; icon: string; desc: string; base: number; cooldown: number }[] = [
  { id: 'apology', name: 'Crisis Response', icon: '🩹', desc: 'Public apology and remediation. Recovers reputation after scandals.', base: 120000, cooldown: 120 },
  { id: 'charity', name: 'Community Initiative', icon: '💚', desc: 'Fund education and open-source programs. Lifts reputation and loyalty.', base: 200000, cooldown: 180 },
  { id: 'press', name: 'Press Tour', icon: '🎙️', desc: 'Interviews and demos. Raises awareness across segments.', base: 150000, cooldown: 90 },
  { id: 'rebrand', name: 'Brand Refresh', icon: '🎨', desc: 'New identity. Resets stale perception; boosts premium awareness, costs loyalty briefly.', base: 600000, cooldown: 540 },
];
export const prCost = (s: GameState, id: string) => Math.round((PR_ACTIONS.find(p => p.id === id)!.base * sizeScale(s)) / 1000) * 1000;
export function runPR(s: GameState, kind: string): { ok: boolean; msg: string } {
  const a = PR_ACTIONS.find(x => x.id === kind); if (!a) return { ok: false, msg: 'Unknown action.' };
  const last = s.flags['pr_' + kind] ?? -9999; if (s.day - last < a.cooldown) return { ok: false, msg: `${a.name} is on cooldown for ${a.cooldown - (s.day - last)} more days.` };
  const cost = prCost(s, kind); if (!s.sandboxCash && s.fin.cash < cost) return { ok: false, msg: 'Not enough cash.' };
  expense(s, cost, 'marketing'); s.flags['pr_' + kind] = s.day; const m = s.marketing;
  if (kind === 'apology') m.reputation = clamp(m.reputation + 5 + (m.reputation < 40 ? 4 : 0), 0, 100);
  if (kind === 'charity') { m.reputation = clamp(m.reputation + 3, 0, 100); m.loyalty = clamp(m.loyalty + 3, 0, 100); }
  if (kind === 'press') for (const g of SEGS) m.awareness[g] = clamp(m.awareness[g] + 3 * mEff(s) * (1 - m.awareness[g] / 100), 0, 100);
  if (kind === 'rebrand') { m.awareness.premium = clamp(m.awareness.premium + 6, 0, 100); m.reputation = clamp(m.reputation + 2, 0, 100); m.loyalty = clamp(m.loyalty - 4, 0, 100); m.positioning = lerp(m.positioning, 0.2, .3); }
  toast(`${a.name} complete`, 'good', 'success'); return { ok: true, msg: 'Done' };
}

export function init(s: GameState): void {
  const m = s.marketing; m.positioning = 0;
  for (const g of SEGS) m.awareness[g] = 2 + (s.co.spec === 'electronics' || s.co.spec === 'smartphones' ? 1 : 0);
  m.history.push({ day: 0, awareness: avg(SEGS.map(g => m.awareness[g])), reputation: m.reputation });
  s.derived.brand = blend(s);
}
const blend = (s: GameState) => clamp(0.45 * s.marketing.reputation + 0.4 * avg(SEGS.map(g => s.marketing.awareness[g])) + 0.15 * s.marketing.loyalty, 0, 100);

export function daily(s: GameState): void {
  const m = s.marketing; const ended: number[] = [];
  for (const c of m.campaigns) {
    if (s.day >= c.end) { ended.push(c.id); continue; }
    if (!s.sandboxCash && s.fin.cash < 0) { ended.push(c.id); toast(`Campaign ${c.name} halted — you're out of cash`, 'bad', 'warn'); continue; }
    expense(s, c.budget / 30, 'marketing');
    const e = campaignEffect(s, c);
    for (const g of SEGS) m.awareness[g] = clamp(m.awareness[g] + e.seg[g] / 30, 0, 100);
    const ch = CH[c.channel]; m.reputation = clamp(m.reputation + (ch.rep * (c.budget / cppAt(c.channel, Math.max(.05, audience(s, c.region)))) * mEff(s) * (1 - m.reputation / 100)) / 30 * .3, 0, 100);
    m.loyalty = clamp(m.loyalty + ch.loyal / 30, 0, 100);
    if (c.product != null) { const p = s.products.find(x => x.id === c.product); if (p) p.promo = clamp(p.promo + e.promo / 30, 0, 100); }
  }
  if (ended.length) { for (const id of ended) { const c = m.campaigns.find(x => x.id === id); if (c && s.day >= c.end) toast(`Campaign finished: ${c.name}`, 'info'); } m.campaigns = m.campaigns.filter(c => !ended.includes(c.id)); }
  // organic awareness from sales, and slow decay
  const share = clamp(s.derived.marketShare, 0, 1); const organic = Math.min(70, 220 * Math.sqrt(share));
  const live = s.products.filter(p => p.status === 'live').length;
  for (const g of SEGS) { const a = m.awareness[g]; const target = live ? organic * (g === 'government' || g === 'education' ? .75 : 1) : 0; m.awareness[g] = clamp(a + (target > a ? (target - a) * .01 : 0) - a * .0007, 0, 100); }
  for (const p of s.products) if (p.promo > 0) p.promo = Math.max(0, p.promo * .985 - .02);
  s.derived.brand = blend(s);
}

export function monthly(s: GameState): void {
  const m = s.marketing; const live = s.products.filter(p => p.status === 'live');
  if (live.length) {
    const rating = avg(live.map(p => p.rating || 3)); const target = clamp(10 + ((rating - 1) / 4) * 72 + (s.derived.service - 50) * .15 - Math.min(15, s.legal.fines / 5e6), 5, 98);
    m.reputation = clamp(lerp(m.reputation, target, .07), 0, 100);
    m.loyalty = clamp(lerp(m.loyalty, clamp(15 + ((rating - 1) / 4) * 50 + s.derived.service * .3 + s.derived.ecosystem.lockin * 20, 0, 100), .06), 0, 100);
    // positioning: price vs category reference, weighted by revenue
    let w = 0, acc = 0; for (const p of live) { const ref = s.market.cats[p.cat].ref; const wt = Math.max(1, p.revEma); w += wt; acc += wt * clamp(Math.log2(Math.max(.05, p.price / ref)) / 1.2, -1, 1); }
    m.positioning = clamp(lerp(m.positioning, acc / w, .12), -1, 1);
  } else m.reputation = clamp(m.reputation + (22 - m.reputation) * .02, 0, 100);
  m.history.push({ day: s.day, awareness: avg(SEGS.map(g => m.awareness[g])), reputation: m.reputation }); if (m.history.length > 240) m.history.shift();
  s.derived.brand = blend(s);
}
