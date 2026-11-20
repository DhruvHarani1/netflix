// Autoplay "CEO bot": exercises the full loop headlessly for many years and prints a yearly report.
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import * as P from '../src/sim/products';
import * as people from '../src/sim/people';
import * as R from '../src/sim/research';
import * as F from '../src/sim/facilities';
import * as MK from '../src/sim/marketing';
import * as EX from '../src/sim/expansion';
import * as FIN from '../src/sim/finance';
import * as ST from '../src/sim/stock';
import { CATS, CAT } from '../src/data/categories';
import { TECH } from '../src/data/research';
import { REGIONS, DEPTS } from '../src/data/core';
import { totalAssets, totalEquity, totalDebt } from '../src/sim/ledger';
import * as require_ from '../src/sim/save';
import { unlocked } from '../src/sim/market';
import type { GameState, Dept } from '../src/sim/types';

function botMonth(s: GameState) {
  const burn = Math.max(1, s.derived.payroll + 30000); const runway = s.fin.cash / burn;
  // hiring
  const want: Dept[] = ['eng', 'eng', 'research', 'pm', 'marketing', 'support', 'sales', 'eng', 'hr', 'finance', 'legal', 'security', 'ops', 'mfg'];
  const cap = s.derived.officeCap;
  const rev = s.fin.ledger.last.rev; const profitable = s.fin.ledger.last.ni > 0;
  if ((runway > 14 || (profitable && runway > 6)) && s.derived.headcount < cap + 4) {
    for (const d of want.slice(0, 3 + Math.floor(s.derived.headcount / 6))) {
      if (s.derived.headcount >= cap + 4) break;
      const c = people.listCandidates(s).find(c => c.dept === d); if (c) { people.hire(s, c.id, c.ask * 1.04); break; }
    }
  }
  if (s.derived.headcount > 25 && s.derived.headcount >= cap - 2 && s.fin.cash > 4e6) { const own = s.fin.cash > 2e7; F.buildFacility(s, 'hq', s.co.hq, own, Math.min(5, 1 + Math.floor(Math.log10(s.derived.headcount / 10)))); }
  // staff big teams when rich
  if (s.fin.cash > 3e7 && profitable) for (const d of ['eng', 'research', 'sales', 'support', 'marketing', 'mfg'] as Dept[]) people.hireTeam(s, d, 20, 60);
  // research
  if (s.research.active.length < s.research.slots) {
    const opts = TECH.filter(t => !s.research.done[t.id] && R.canResearch(s, t.id).ok).sort((a, b) => a.cost - b.cost);
    if (opts[0]) R.startResearch(s, opts[0].id);
  }
  // products
  const inflight = s.products.filter(p => ['dev', 'prototype', 'testing', 'ready'].includes(p.status));
  for (const p of inflight) { if (p.status === 'prototype') P.startTesting(s, p.id); else if (p.status === 'ready') P.launch(s, p.id); else if (p.stalled) P.topUpBudget(s, p.id, p.budget * 0.3); P.autoAssign(s, p.id); }
  if (inflight.length < 1 + Math.floor(s.derived.headcount / 40) && runway > 5) {
    const live = new Set(s.products.filter(p => p.status === 'live').map(p => p.cat));
    const opts = CATS.filter(c => unlocked(s, c.id) && !live.has(c.id) && !s.products.some(p => p.cat === c.id && p.status !== 'retired')).sort((a, b) => a.dev - b.dev);
    const c = opts.find(c => P.recommendedBudget(s, c, P.defaultSpecs(s, c)) < s.fin.cash * 0.5);
    if (c) { const specs = P.defaultSpecs(s, c); const r = P.createProduct(s, { cat: c.id, name: c.name + ' ' + s.nextProdId, target: 'mainstream', specs, budget: P.recommendedBudget(s, c, specs), outsource: true }); if (r.ok) P.autoAssign(s, r.id!); }
  }
  for (const p of s.products) if (p.status === 'live' && !p.updating && s.day - Math.max(p.launchDay, p.lastUpdate) > 400 && s.fin.cash > P.recommendedBudget(s, CAT[p.cat], p.specs) * 0.9) {
    const specs = { ...p.specs }; for (const sp of CAT[p.cat].specs) specs[sp.key] = Math.min(P.levelCap(s, sp.tag), specs[sp.key] + 1); const r = P.startUpdate(s, p.id, { specs, budget: P.recommendedBudget(s, CAT[p.cat], specs) * 0.45 }); if (r.ok) P.autoAssign(s, p.id);
  }
  // marketing
  if (s.products.some(p => p.status === 'live') && s.fin.cash > burn * 5 && s.marketing.campaigns.length < 2) MK.launchCampaign(s, { channel: s.marketing.campaigns.length ? 'search' : 'social', budget: Math.max(8000, Math.min(s.fin.cash * 0.03, s.derived.revYr * 0.04 / 12 + 8000)), months: 6, product: null, region: 'all' });
  // expansion
  if (s.fin.cash > 8e6) for (const r of REGIONS) { if (s.regions[r.id].office === 0 && s.fin.cash > 12e6) { EX.openOffice(s, r.id); break; } }
  // finance
  if (runway < 5 && s.fin.loans.length < 3) FIN.takeLoan(s, 'bank', Math.min(FIN.maxLoan(s, 'bank'), burn * 8), 5);
  if (!s.stock.public && s.derived.valuation > 3e8 && s.derived.revYr > 2e7) (ST as any).launchIPO?.(s, { price: Math.max(1, s.derived.valuation / s.fin.shares), shares: Math.round(s.fin.shares * 0.15) });
}
const bal = (s: GameState) => totalAssets(s) - totalDebt(s) - totalEquity(s);

describe('autoplay', () => {
  it('survives and grows over 12 years', () => {
    const s = newGame({ name: 'Bot Co', slogan: '', founder: 'Bot', color: '#4cc9f0', logo: 0, hq: 'na', city: 'Austin', spec: 'software', difficulty: 'normal', capitalId: 'seed', seed: 11 });
    const rows: string[] = [];
    for (let m = 0; m < 12 * 12 && !s.gameOver; m++) {
      advance(s, 30); botMonth(s); if (m % 3 === 2 && m < 24) rows.push(`  m${m + 1} cash ${(s.fin.cash / 1e3).toFixed(0)}K rev ${(s.fin.ledger.last.rev / 1e3).toFixed(0)}K ni ${(s.fin.ledger.last.ni / 1e3).toFixed(0)}K staff ${s.derived.headcount} prods ${s.products.map(p => p.status[0] + (p.status === 'live' ? ((p.revEma * 30 / 1e3).toFixed(0) + 'K') : '')).join(',')}`);
      // resolve any pending decision with default
      if (m % 12 === 11) {
        const L = s.fin.ledger.y; const live = s.products.filter(p => p.status === 'live').length;
        rows.push(`yr${(m + 1) / 12} d${s.day} cash ${(s.fin.cash / 1e6).toFixed(1)}M val ${(s.derived.valuation / 1e6).toFixed(0)}M rev/mo ${(s.fin.ledger.last.rev / 1e6).toFixed(2)}M ni/mo ${(s.fin.ledger.last.ni / 1e6).toFixed(2)}M staff ${s.derived.headcount} prod ${live} techs ${Object.keys(s.research.done).length} stage ${s.derived.stage} rivals ${s.rivals.filter(r => r.status === 'active').length} share ${(s.derived.marketShare * 100).toFixed(2)}% bal ${bal(s).toFixed(2)} ${(s as GameState).gameOver ? 'GAMEOVER' : ''}`);
      }
    }
    const { serialize } = require_;
    console.log(rows.join('\n'), '\nSAVE SIZE KB', (serialize(s).length / 1024).toFixed(0));
    expect(Math.abs(bal(s))).toBeLessThan(5);
    for (const k of ['cash']) expect(Number.isFinite((s.fin as any)[k])).toBe(true);
  }, 120000);
});
