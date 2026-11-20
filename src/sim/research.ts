import type { GameState, TechNode } from './types';
import { TECH, TECH_BY_ID } from '../data/research';
import { SPEC, DIFF } from '../data/core';
import { expense, revenue } from './ledger';
import { toast, sfx, logEntry, addNews, rnd, chance, pick, clamp, uid } from './util';
import { labSlots } from './facilities';

export interface Res { ok: boolean; msg: string }
export const hasTech = (s: GameState, id: string) => s.research.done[id] !== undefined;

export function init(s: GameState): void {
  const R = s.research; R.done = {}; R.active = []; R.patents = []; R.slots = 1;
  const grant = (id: string) => { const t = TECH_BY_ID[id]; if (!t || R.done[id] !== undefined) return; t.req.forEach(grant); R.done[id] = 0; };
  SPEC[s.co.spec].techs.forEach(grant);
  R.log.push({ day: 0, text: `Founding technologies established: ${Object.keys(R.done).map(i => TECH_BY_ID[i].name).join(', ')}.`, kind: 'ok' });
}
/** Effective cash cost of a tech for this company (spec perks + difficulty). */
export function techCost(s: GameState, t: TechNode): number {
  let m = DIFF[s.difficulty].cost; const sp = s.co.spec;
  if (sp === 'space' && t.tier >= 6) m *= .75; if (sp === 'auto' && t.tags.includes('batt')) m *= .8; if (sp === 'semis' && t.id.startsWith('fab')) m *= .85;
  if (s.co.ceo.perks.includes('visionary')) m *= .95;
  return Math.round(t.cost * m);
}
export function speedMult(s: GameState): number {
  let m = 1; const d = s.research.done; const sp = s.co.spec;
  if (d.agents) m *= 1.08; if (d.reasoning) m *= 1.1; if (d.agi) m *= 1.25; if (sp === 'ai') m *= 1.1; if (sp === 'biotech') m *= 1.15; if (s.co.ceo.perks.includes('visionary')) m *= 1.1;
  return m;
}
export function totalRpPerDay(s: GameState): number { return s.derived.rpPerDay * s.derived.labBonus * (1 + s.research.budgetBoost * .5) * speedMult(s); }
export function canResearch(s: GameState, id: string): { ok: boolean; reasons: string[] } {
  const t = TECH_BY_ID[id]; const r: string[] = []; if (!t) return { ok: false, reasons: ['Unknown technology'] };
  if (hasTech(s, id)) r.push('Already researched');
  if (s.research.active.some(p => p.id === id)) r.push('Already in progress');
  const missing = t.req.filter(q => !hasTech(s, q)); if (missing.length) r.push('Needs ' + missing.map(q => TECH_BY_ID[q].name).join(', '));
  if (s.research.active.length >= s.research.slots) r.push(`All ${s.research.slots} research slot(s) busy — build a lab`);
  if (s.derived.rpPerDay <= 0) r.push('No researchers — hire scientists first');
  if (!s.sandboxCash && s.fin.cash < techCost(s, t) * .1) r.push('Not enough cash to fund the first stage');
  return { ok: r.length === 0, reasons: r };
}
export function startResearch(s: GameState, id: string): Res {
  const c = canResearch(s, id); if (!c.ok) return { ok: false, msg: c.reasons[0] };
  s.research.active.push({ id, progress: 0, paid: 0, setbacks: 0, started: s.day });
  logEntry(s, `Research started: ${TECH_BY_ID[id].name}`, 'info'); sfx('click'); return { ok: true, msg: `Researching ${TECH_BY_ID[id].name}` };
}
export function cancelResearch(s: GameState, id: string): Res {
  const i = s.research.active.findIndex(p => p.id === id); if (i < 0) return { ok: false, msg: 'Not active' };
  s.research.active.splice(i, 1); return { ok: true, msg: 'Project cancelled — progress is lost, money spent is gone.' };
}
export function setBudgetBoost(s: GameState, v: number): Res { s.research.budgetBoost = clamp(v, 0, 2); return { ok: true, msg: `R&D budget boost ×${(1 + s.research.budgetBoost).toFixed(1)}` }; }
export function estimateDays(s: GameState, id: string): number {
  const t = TECH_BY_ID[id]; const p = s.research.active.find(a => a.id === id); const n = Math.max(1, s.research.active.length + (p ? 0 : 1));
  const rate = totalRpPerDay(s) / n; return rate > 0 ? Math.ceil((t.rp - (p?.progress || 0)) / rate) : Infinity;
}
export function researchSummary(s: GameState) {
  const R = s.research; return { rpPerDay: totalRpPerDay(s), slots: R.slots, active: R.active.length, done: Object.keys(R.done).length, total: TECH.length, patents: R.patents.length, breakthroughs: R.breakthroughs, failures: R.failures };
}

export function daily(s: GameState): void {
  const R = s.research; R.slots = Math.min(8, labSlots(s));
  if (!R.active.length) return;
  const rate = totalRpPerDay(s) / R.active.length; if (rate <= 0) return;
  const stalled = !s.sandboxCash && s.fin.cash <= 0;
  if (stalled) return;
  for (const p of [...R.active]) {
    const t = TECH_BY_ID[p.id]; const add = Math.min(rate, t.rp - p.progress + 1);
    const frac = add / t.rp; const cost = techCost(s, t) * frac * (1 + R.budgetBoost * .6);
    expense(s, cost, 'rnd'); p.paid += cost; p.progress += add;
    if (p.progress >= t.rp) complete(s, p.id);
  }
}
function complete(s: GameState, id: string) {
  const R = s.research; const t = TECH_BY_ID[id]; const p = R.active.find(a => a.id === id)!;
  const skill = s.derived.dept.research.avgSkill; const fail = clamp(t.fail * (1.3 - skill / 160), 0.01, 0.4);
  if (chance(s, fail)) {
    p.progress = t.rp * .65; p.setbacks++; R.failures++;
    R.log.push({ day: s.day, text: `Experiment failed: ${t.name} (setback to 65%)`, kind: 'fail' });
    toast(`Experiment failed on ${t.name} — progress set back`, 'warn', 'warn'); return;
  }
  R.active = R.active.filter(a => a.id !== id); R.done[id] = s.day;
  R.patents.push({ id: uid(s), tech: id, day: s.day, name: `${t.name} patent family`, value: t.cost * 3 });
  R.log.push({ day: s.day, text: `Research complete: ${t.name}${t.unlocks?.length ? ' — unlocks ' + t.unlocks.join(', ') : ''}`, kind: 'ok' });
  toast(`Research complete: ${t.name}`, 'good', 'research'); addNews(s, `${s.co.name} completes ${t.name} research`, t.desc, 'tech', 'good');
  s.marketing.reputation = clamp(s.marketing.reputation + 0.4 + t.tier * .15);
  if (chance(s, .05)) breakthrough(s, t);
}
function breakthrough(s: GameState, t: TechNode) {
  const R = s.research; R.breakthroughs++; const roll = rnd(s);
  let txt = '';
  if (roll < .4 && R.active.length) { for (const a of R.active) a.progress = Math.min(TECH_BY_ID[a.id].rp * .95, a.progress + TECH_BY_ID[a.id].rp * .25); txt = 'spills over and accelerates all active projects by 25%'; }
  else if (roll < .75) { R.patents.push({ id: uid(s), tech: t.id, day: s.day, name: `${t.name} — core process patent`, value: t.cost * 6 }); txt = 'yields a landmark patent'; }
  else { s.marketing.reputation = clamp(s.marketing.reputation + 4); txt = 'wins international acclaim (+4 reputation)'; }
  R.log.push({ day: s.day, text: `BREAKTHROUGH: ${t.name} ${txt}`, kind: 'bt' });
  toast(`✨ Breakthrough! ${t.name} ${txt}`, 'good', 'achievement'); addNews(s, `Breakthrough at ${s.co.name}`, `${t.name} ${txt}.`, 'tech', 'good');
}
export function monthly(s: GameState): void {
  let inc = 0; for (const p of s.research.patents) inc += p.value * .003;
  if (inc > 0) revenue(s, inc * (1 + Math.min(1, s.market.econ.demandMult - 1 + .0)), 'licensing');
  if (s.research.log.length > 120) s.research.log.splice(0, s.research.log.length - 120);
}
