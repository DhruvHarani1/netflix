import { it } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import { botMonth } from '../src/sim/autopilot';
import { SPECIALIZATIONS } from '../src/data/core';
it('survey', () => {
  const out: string[] = [];
  for (const diff of ['easy', 'normal', 'hard', 'nightmare'] as const) for (const cap of ['bootstrap', 'seed', 'series'] as const) {
    let alive = 0, val = 0, n = 0;
    for (const sp of SPECIALIZATIONS) {
      const s = newGame({ name: 'S', slogan: '', founder: 'F', color: '#fff', logo: 0, hq: 'na', city: 'X', spec: sp.id, difficulty: diff, capitalId: cap, seed: 5 });
      for (let m = 0; m < 60 && !s.gameOver; m++) { advance(s, 30); botMonth(s); }
      n++; if (!s.gameOver) { alive++; val += s.derived.valuation; }
    }
    out.push(`${diff}/${cap}: alive ${alive}/${n} avg val ${(val / Math.max(1, alive) / 1e6).toFixed(0)}M`);
  }
  console.log(out.join('\n'));
}, 300000);
