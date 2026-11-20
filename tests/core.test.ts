import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import { createProduct, assign, defaultSpecs, recommendedBudget, startTesting, launch, autoAssign } from '../src/sim/products';
import { CAT } from '../src/data/categories';
import { issueEquity, totalAssets, totalEquity, totalDebt } from '../src/sim/ledger';
import type { GameState, Employee } from '../src/sim/types';

const cfg = { name: 'T', slogan: '', founder: 'F', color: '#fff', logo: 0, hq: 'na' as const, city: 'Austin', spec: 'software' as const, difficulty: 'normal' as const, capitalId: 'seed' };
function mockStaff(s: GameState, n: number) {
  for (let i = 0; i < n; i++) s.people.emps.push({ id: 900 + i, name: 'E' + i, dept: 'eng', title: 'Eng', level: 1, salary: 90000, skill: 65, mgmt: 40, exp: 3, prod: 1, happy: 75, motiv: 75, loyalty: 70, edu: 'BS', spec: 'soft', heads: 1, traits: [], hired: 0, project: null, trainUntil: 0, lastReview: 0, leader: false } as Employee);
}
const bal = (s: GameState) => totalAssets(s) - totalDebt(s) - totalEquity(s);
describe('core loop', () => {
  it('product lifecycle makes revenue and balance sheet balances', () => {
    const s = newGame({ ...cfg, seed: 7 });
    mockStaff(s, 5); issueEquity(s, 5e6);
    const cat = CAT.desktopapp; const specs = defaultSpecs(s, cat);
    const r = createProduct(s, { cat: 'desktopapp', name: 'Test App', target: 'mainstream', specs, budget: recommendedBudget(s, cat, specs), outsource: true });
    expect(r.ok, r.msg).toBe(true);
    autoAssign(s, r.id!);
    let days = 0; const p = s.products[0];
    while (p.status === 'dev' && days++ < 900) advance(s, 1);
    expect(p.status).toBe('prototype');
    startTesting(s, p.id); while (p.status === 'testing' && days++ < 1200) advance(s, 1);
    expect(p.status).toBe('ready');
    const l = launch(s, p.id); expect(l.ok, l.msg).toBe(true);
    if (s.regions.na.presence < 1) s.regions.na.presence = 35;
    const cash0 = s.fin.cash;
    for (const aw of [5, 15, 30]) { for (const g of Object.keys(s.marketing.awareness)) (s.marketing.awareness as any)[g] = aw; const r0 = p.lifeRev; advance(s, 60); console.log('awareness', aw, 'rev/60d', (p.lifeRev - r0).toFixed(0), 'units', p.lifeUnits.toFixed(0)); }
    console.log('days to launch', days, 'rev', p.lifeRev.toFixed(0), 'units', p.lifeUnits.toFixed(0), 'q', p.q.toFixed(1), 'price', p.price, 'cash', cash0.toFixed(0), '->', s.fin.cash.toFixed(0), 'bugs', p.bugs.toFixed(1));
    expect(Math.abs(bal(s))).toBeLessThan(1);
  });
});
