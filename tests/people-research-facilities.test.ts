import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/engine';
import * as people from '../src/sim/people';
import * as research from '../src/sim/research';
import * as fac from '../src/sim/facilities';
import { totalAssets, totalEquity, totalDebt } from '../src/sim/ledger';

const mk = (spec: any = 'software', cap = 'seed', diff: any = 'normal') => newGame({ name: 'T', slogan: '', founder: 'F', color: '#4cc9f0', logo: 0, hq: 'na', city: 'Austin', spec, difficulty: diff, capitalId: cap, seed: 7 });
const bal = (s: any) => Math.abs(totalAssets(s) - totalDebt(s) - totalEquity(s));

describe('people', () => {
  it('creates a starting team and charges salaries', () => {
    const s = mk(); expect(s.people.emps.length).toBeGreaterThanOrEqual(4); expect(s.derived.dept.research.heads).toBeGreaterThan(0);
    const c0 = s.fin.cash; advance(s, 10); expect(s.fin.cash).toBeLessThan(c0); expect(s.fin.ledger.m.exp.salaries || s.fin.ledger.y.exp.salaries).toBeGreaterThan(0);
    expect(bal(s)).toBeLessThan(1);
  });
  it('hiring changes headcount and expenses', () => {
    const s = mk('software', 'series'); const n0 = s.derived.headcount; const pay0 = s.derived.payroll;
    const c = people.listCandidates(s).find(x => x.dept === 'eng')!; let r = people.hire(s, c.id, c.ask * 1.2); expect(r.ok).toBe(true);
    advance(s, 1); expect(s.derived.headcount).toBe(n0 + 1); expect(s.derived.payroll).toBeGreaterThan(pay0);
    const t = people.hireTeam(s, 'support', 20, 50); expect(t.ok).toBe(true); advance(s, 1); expect(s.derived.headcount).toBe(n0 + 21);
    const l = people.layoff(s, 'support', 50); expect(l.ok).toBe(true); advance(s, 1); expect(s.derived.headcount).toBeLessThan(n0 + 21);
    expect(bal(s)).toBeLessThan(1);
  });
  it('mgmt independent of skill, interview reveals skill', () => {
    const s = mk(); const cs = Array.from({ length: 40 }, () => people.genCandidate(s, 'eng'));
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length; const ms = mean(cs.map(c => c.skill)), mm = mean(cs.map(c => c.mgmt));
    let cov = 0; cs.forEach(c => (cov += (c.skill - ms) * (c.mgmt - mm))); expect(Math.abs(cov / 40 / 150)).toBeLessThan(.6);
    const c = s.people.pool[0]; expect(c.interviewed).toBe(false); expect(people.interview(s, c.id).ok).toBe(true); expect(c.estSkill).toBe(c.skill);
  });
  it('survives 400 days with population stable & finite', () => {
    const s = mk('ai', 'founder'); advance(s, 400); expect(Number.isFinite(s.fin.cash)).toBe(true); expect(s.derived.headcount).toBeGreaterThan(0); expect(bal(s)).toBeLessThan(1);
  });
});
describe('research', () => {
  it('grants spec techs and completes research, unlocking', () => {
    const s = mk('software', 'series'); expect(research.hasTech(s, 'web')).toBe(true); expect(research.hasTech(s, 'os1')).toBe(false);
    const cr = research.canResearch(s, 'os1'); expect(cr.ok).toBe(true); expect(research.startResearch(s, 'os1').ok).toBe(true);
    const c0 = s.fin.cash; advance(s, 600); expect(research.hasTech(s, 'os1')).toBe(true); expect(s.research.patents.length).toBeGreaterThan(0); expect(s.fin.cash).not.toBe(c0);
    expect(bal(s)).toBeLessThan(1);
  });
  it('blocks without prereqs', () => { const s = mk(); expect(research.canResearch(s, 'agi').ok).toBe(false); });
});
describe('facilities', () => {
  it('building a lab adds slot; buying HQ raises office capacity', () => {
    const s = mk('software', 'founder'); const cap0 = s.derived.officeCap; expect(cap0).toBeGreaterThan(0);
    expect(fac.buildFacility(s, 'hq', 'na', true, 1).ok).toBe(true); expect(fac.buildFacility(s, 'lab', 'na', false, 1).ok).toBe(true);
    advance(s, 130); expect(s.derived.officeCap).toBeGreaterThan(cap0); expect(s.research.slots).toBe(2); expect(s.derived.labBonus).toBeGreaterThan(1);
    const hq = s.facilities.find(f => f.kind === 'hq')!; expect(fac.upgradeFacility(s, hq.id, 'amenities').ok).toBe(true);
    expect(bal(s)).toBeLessThan(1); advance(s, 120); expect(bal(s)).toBeLessThan(1);
    expect(fac.sellFacility(s, hq.id).ok).toBe(true); expect(bal(s)).toBeLessThan(1);
  });
});
