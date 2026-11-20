import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import * as mk from '../src/sim/marketing';
import * as ex from '../src/sim/expansion';
import * as rv from '../src/sim/rivals';
import { SEGS } from '../src/data/core';

const cfg = (seed = 7) => ({ name: 'T', slogan: '', founder: 'F', color: '#4cc9f0', logo: 0, hq: 'na' as const, city: 'Austin', spec: 'software' as const, difficulty: 'normal' as const, capitalId: 'series', seed });
// synthetic revenue so rival logic is testable even without the market engine
function feed(s: any) { for (const r of s.rivals) if (r.status === 'active') for (const o of Object.values(r.offers) as any[]) { r.revM += o.revEma * 1; r.costM += o.revEma * 0.6; } }
function run(s: any, days: number) { for (let i = 0; i < days; i++) { advance(s, 1); feed(s); } }

describe('rivals', () => {
  it('initialises majors + startups', () => {
    const s = newGame(cfg());
    expect(s.rivals.filter(r => r.kind === 'major').length).toBeGreaterThanOrEqual(10);
    expect(s.rivals.filter(r => r.kind === 'startup').length).toBeGreaterThanOrEqual(3);
  });
  it('stays sane for 3 years and produces news', () => {
    const s = newGame(cfg()); run(s, 365 * 3);
    for (const r of s.rivals) { expect(Number.isFinite(r.cash)).toBe(true); expect(Number.isFinite(r.valuation)).toBe(true); for (const o of Object.values(r.offers) as any[]) { expect(o.q).toBeLessThanOrEqual(97); expect(Number.isFinite(o.price)).toBe(true); } }
    expect(s.events.news.filter(n => n.kind === 'rival').length).toBeGreaterThan(2);
    expect(rv.activeRivals(s).length).toBeGreaterThan(5);
  });
  it('is deterministic', () => {
    const a = newGame(cfg(3)), b = newGame(cfg(3)); run(a, 400); run(b, 400);
    expect(a.rivals.map(r => Math.round(r.cash))).toEqual(b.rivals.map(r => Math.round(r.cash)));
  });
  it('world churns over a long horizon (startups spawn)', () => {
    const s = newGame(cfg(11)); const n0 = s.rivals.length; run(s, 365 * 6); expect(s.rivals.length).toBeGreaterThan(n0 - 1);
    expect(s.rivals.some(r => r.id.startsWith('st_') && Number(r.id.slice(3)) > 4)).toBe(true);
  });
});
describe('marketing', () => {
  it('campaign costs money and raises awareness', () => {
    const s = newGame(cfg()); const cash0 = s.fin.cash; const aw0 = s.marketing.awareness.mainstream;
    const r = mk.launchCampaign(s, { channel: 'social', budget: 20000, months: 3, product: null, region: 'all' }); expect(r.ok).toBe(true);
    advance(s, 60); expect(s.fin.cash).toBeLessThan(cash0); expect(s.marketing.awareness.mainstream).toBeGreaterThan(aw0);
  });
  it('influencer ads harm premium awareness', () => {
    const s = newGame(cfg()); s.marketing.awareness.premium = 30; mk.launchCampaign(s, { channel: 'influencer', budget: 30000, months: 2, product: null, region: 'all' }); advance(s, 30);
    expect(s.marketing.awareness.premium).toBeLessThan(30);
  });
  it('rejects campaigns in regions without presence', () => {
    const s = newGame(cfg()); expect(mk.launchCampaign(s, { channel: 'social', budget: 10000, months: 1, product: null, region: 'af' }).ok).toBe(false);
  });
  it('costs nothing without campaigns', () => { const s = newGame(cfg()); advance(s, 20); expect(s.fin.ledger.m.exp.marketing || 0).toBe(0); });
});
describe('expansion', () => {
  it('office raises presence over time and costs money', () => {
    const s = newGame(cfg()); expect(s.regions.eu.presence).toBe(0); const r = ex.openOffice(s, 'eu'); expect(r.ok).toBe(true);
    advance(s, 200); expect(s.regions.eu.presence).toBeGreaterThan(10);
  });
  it('requires prerequisites', () => { const s = newGame(cfg()); expect(ex.buildDistribution(s, 'as').ok).toBe(false); });
  it('HQ region starts with presence', () => { const s = newGame(cfg()); expect(s.regions.na.presence).toBeGreaterThan(30); });
});
