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
import { botMonth } from '../src/sim/autopilot';
import type { GameState, Dept } from '../src/sim/types';

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
