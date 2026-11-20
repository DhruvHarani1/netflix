import type { GameState, Employee, Candidate, Dept, Tag } from './types';
import { DEPTS, DEPT, REGION, CAPITALS, SPEC, DIFF, LEVEL_NAMES } from '../data/core';
import { TRAITS, EDU, DEPT_TAGS, TRAIN_KINDS, PAY_MULT } from '../data/people';
import { expense } from './ledger';
import { rnd, rint, chance, pick, gauss, clamp, FIRST, LAST, empOutput, toast, sfx, logEntry, addNews, dateOf, rrange, weighted, shuffle } from './util';

export interface Res { ok: boolean; msg: string; id?: number }
const ok = (msg: string, id?: number): Res => ({ ok: true, msg, id }); const no = (msg: string): Res => ({ ok: false, msg });
const fmt = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : n.toFixed(0));
const TRAIN_STATE = 'train';

// ------------------------------------------------------------ generation --
export function marketSalary(s: GameState, dept: Dept, level: number, skill: number, exp = 0): number {
  const infl = Math.pow(1 + s.market.econ.inflation, s.day / 365);
  return Math.round(DEPT[dept].baseSalary * PAY_MULT[level] * (0.7 + skill / 100 * 0.65) * (1 + Math.min(exp, 15) * .01) * (0.55 + REGION[s.co.hq].labor * .45) * infl * (s.difficulty === 'sandbox' ? 1 : DIFF[s.difficulty].talent > 1 ? .95 : 1) / 500) * 500;
}
function newPerson(s: GameState, dept: Dept, o: { level?: number; skill?: number; rep?: number } = {}): Omit<Employee, 'hired' | 'project' | 'trainUntil' | 'lastReview' | 'leader'> {
  const lvl = o.level ?? weighted(s, [0, 1, 2, 3, 4], l => [34, 36, 20 + (o.rep ?? 0) / 8, 7 + (o.rep ?? 0) / 20, 1.5][l])!;
  const traits: string[] = []; const nT = chance(s, .55) ? (chance(s, .3) ? 2 : 1) : 0;
  for (let i = 0; i < nT; i++) { const t = pick(s, TRAITS).id; if (!traits.includes(t) && !(t === 'leader' && traits.includes('poormgr')) && !(t === 'poormgr' && traits.includes('leader'))) traits.push(t); }
  let skill = o.skill ?? clamp(40 + lvl * 9 + gauss(s) * 11 + (o.rep ?? 0) / 14, 18, 97);
  let mgmt = clamp(32 + gauss(s) * 18 + lvl * 4, 5, 90); // independent of skill!
  let prod = clamp(1 + gauss(s) * .14, .7, 1.3);
  if (traits.includes('abrasive')) skill += 9; if (traits.includes('lazy')) { skill += 8; prod -= .18; } if (traits.includes('workaholic')) prod += .14; if (traits.includes('perfectionist')) prod -= .05;
  if (traits.includes('leader')) mgmt += 24; if (traits.includes('poormgr')) mgmt = Math.min(mgmt, 22);
  skill = clamp(skill, 15, 99); mgmt = clamp(mgmt, 3, 98); prod = clamp(prod, .6, 1.4);
  const tags = DEPT_TAGS[dept]; const spec: Tag | 'general' = tags.length ? pick(s, tags) : 'general';
  const exp = Math.max(0, lvl * 2.8 + rrange(s, 0, 4));
  const edu = dept === 'research' ? weighted(s, EDU, e => (e === 'PhD' ? 5 : e === 'Master’s' ? 3 : 1))! : dept === 'finance' ? pick(s, ['Bachelor’s', 'MBA', 'Master’s']) : pick(s, EDU.slice(0, 4));
  const id = s.people.nextId++;
  return { id, name: `${pick(s, FIRST)} ${pick(s, LAST)}`, dept, title: DEPT[dept].titles[lvl], level: lvl, salary: marketSalary(s, dept, lvl, skill, exp), skill, mgmt, exp, prod, baseProd: prod,
    happy: 72, motiv: 75, loyalty: clamp(55 + gauss(s) * 14 + (traits.includes('loyal') ? 25 : 0) - (traits.includes('flight') ? 28 : 0), 8, 99), edu, spec, heads: 1, traits };
}
function capitalEmp(s: GameState): number {
  const base = s.fin.cash + s.fin.loans.reduce((a, l) => a + 0, 0); const sp = SPEC[s.co.spec]; const d = DIFF[s.difficulty];
  const unit = d.capital * (sp.cashMult || 1); let best = CAPITALS[1], bd = 1e18;
  for (const c of CAPITALS) { const dist = Math.abs(c.amount * unit - base) / (c.amount * unit); if (dist < bd) { bd = dist; best = c; } }
  return Math.max(2, Math.round(best.emp * (s.difficulty === 'sandbox' ? 1.5 : 1)));
}
export function genCandidate(s: GameState, dept: Dept): Candidate {
  const rep = s.marketing.reputation; const p = newPerson(s, dept, { rep });
  const ask = Math.round(p.salary * rrange(s, .92, 1.15) * (1 + (p.traits.includes('greedy') ? .12 : 0)) / 500) * 500;
  return { ...p, ask, interviewed: false, estSkill: clamp(p.skill + rrange(s, -15, 15)), expires: s.day + rint(s, 30, 75) };
}

// -------------------------------------------------------------------- init --
export function init(s: GameState): void {
  const P = s.people; P.emps = []; P.pool = []; P.nextId = 1; P.conflicts = []; P.poach = []; P.morale = 0; P.hist = [];
  let n = capitalEmp(s); const sd = SPEC[s.co.spec].depts; const plan: Dept[] = [];
  plan.push(sd[0] === 'research' ? 'research' : 'eng'); plan.push('research');
  if (n >= 3) plan.push(sd[1] ?? 'eng'); if (s.co.spec === 'ai' || s.co.spec === 'biotech') plan.push('research');
  if (n >= 4) plan.push('pm'); if (n >= 5) plan.push('marketing'); if (n >= 6) plan.push('support'); if (n >= 7) plan.push('eng');
  if (n >= 8) plan.push(sd[2] ?? 'sales'); if (n >= 9) plan.push('finance'); if (n >= 10) plan.push('hr'); if (n >= 11) plan.push('ops'); if (n >= 12) plan.push('legal');
  while (plan.length < n) plan.push(pick(s, ['eng', 'eng', 'research', 'sales', 'support', 'pm'] as Dept[]));
  for (const d of plan.slice(0, n)) {
    const lvl = chance(s, .15) ? 2 : chance(s, .55) ? 1 : 0; const p = newPerson(s, d, { level: lvl, rep: 8, skill: clamp(52 + lvl * 8 + gauss(s) * 8, 35, 85) });
    P.emps.push({ ...p, salary: Math.round(p.salary * 1.0 / 500) * 500, hired: 0, project: null, trainUntil: 0, lastReview: 0, leader: false });
  }
  for (const d of DEPTS) { const l = autoLeader(s, d.id); if (l) l.leader = true; }
  for (let i = 0; i < 16; i++) P.pool.push(genCandidate(s, pick(s, ['eng', 'eng', 'research', 'research', 'pm', 'marketing', 'sales', 'support', 'mfg', 'security', 'finance', 'hr'] as Dept[])));
  calc(s);
}
function autoLeader(s: GameState, d: Dept): Employee | null {
  const c = s.people.emps.filter(e => e.dept === d && e.heads === 1); if (!c.length) return null;
  return c.sort((a, b) => (b.mgmt * .6 + b.skill * .2 + b.level * 5) - (a.mgmt * .6 + a.skill * .2 + a.level * 5))[0];
}

// ------------------------------------------------------------- derived calc --
function spanCap(s: GameState, d: Dept): number {
  let cap = 18; const L = s.people.emps.find(e => e.dept === d && e.leader);
  if (L) cap += L.mgmt * .5 + L.level * 8;
  for (const e of s.people.emps) if (e.dept === d && e.heads === 1 && e.level >= 3 && !e.leader) cap += e.level === 4 ? 70 : 35;
  return cap;
}
function calc(s: GameState) {
  const P = s.people, D = s.derived; let payAnn = 0, total = 0, cust = 0;
  for (const p of s.products) if (p.status === 'live') cust += p.base + p.unitsEma * 30;
  const crowd = D.officeCap > 0 ? Math.max(0, Math.min(.4, 1 - D.officeCap / Math.max(1, headcountOf(s)))) : 0;
  const benefit = 1.18 + P.policy.perks * .03;
  for (const d of DEPTS) {
    const es = P.emps.filter(e => e.dept === d.id); const dd = D.dept[d.id]; let heads = 0, out = 0, hs = 0, sk = 0, pay = 0;
    for (const e of es) { heads += e.heads; pay += e.salary * e.heads; hs += e.happy * e.heads; sk += e.skill * e.heads; if (e.trainUntil <= s.day) out += empOutput(e); }
    const L = es.find(e => e.leader); const cap = spanCap(s, d.id);
    let eff = L ? .9 + L.mgmt / 100 * .4 : .82; if (heads > cap) eff *= Math.max(.6, 1 - (heads - cap) / (heads * 2.2));
    eff *= 1 - Math.min(.15, P.conflicts.filter(c => es.some(e => e.id === c.a)).length * .04);
    dd.heads = heads; dd.output = out; dd.avgHappy = heads ? hs / heads : 70; dd.avgSkill = heads ? sk / heads : 0; dd.leader = L ? L.id : null; dd.eff = clamp(eff, .5, 1.4); dd.payroll = pay * benefit * P.policy.wage / 12;
    total += heads; payAnn += pay;
  }
  D.headcount = total; D.payroll = payAnn * benefit * P.policy.wage / 12;
  D.rpPerDay = D.dept.research.output * D.dept.research.eff * 4;
  const so = D.dept.support.output * D.dept.support.eff; D.service = clamp(35 + 55 * Math.tanh(so * 3000 / (1 + cust)), 0, 100) - (cust > 0 ? 0 : 0);
  (D as any)._crowd = crowd;
}
const headcountOf = (s: GameState) => s.people.emps.reduce((a, e) => a + e.heads, 0);

// ------------------------------------------------------------------- daily --
export function daily(s: GameState): void {
  const P = s.people, D = s.derived; calc(s);
  const crowd: number = (D as any)._crowd || 0; const pol = P.policy; const benefit = 1.18 + pol.perks * .03;
  let cost = 0; let moraleHit = P.morale || 0; if (moraleHit > 0) P.morale = Math.max(0, moraleHit - .12);
  const mentors: Record<string, number> = {};
  for (const e of P.emps) if (e.traits.includes('mentor')) mentors[e.dept] = (mentors[e.dept] || 0) + 1;
  for (const e of P.emps) {
    cost += e.salary * e.heads * benefit * pol.wage / 365;
    if (e.trainUntil && e.trainUntil <= s.day) finishTraining(s, e);
    const dd = D.dept[e.dept]; const mkt = marketSalary(s, e.dept, e.level, e.skill, e.exp);
    const ratio = (e.salary * pol.wage) / Math.max(1, mkt * (e.traits.includes('greedy') ? 1.12 : 1));
    const pay = clamp((ratio - 1) * 60, -28, 18); const L = P.emps.find(x => x.dept === e.dept && x.leader);
    const lead = L ? (L.mgmt - 50) / 9 : -4; const conf = P.conflicts.some(c => c.a === e.id || c.b === e.id) ? -9 : 0;
    let target = 63 + pay + pol.perks * 3.6 + lead + D.happinessBonus + (pol.remote ? 5 : 0) - crowd * 55 - moraleHit - (e.traits.includes('workaholic') ? 6 : 0) + conf + (mentors[e.dept] ? 2 : 0) + (e.wantsRaise ? -4 : 0);
    if (s.legal?.policies?.fairwork) target += 4;
    e.happy = clamp(e.happy + (target - e.happy) * .04);
    e.motiv = clamp(e.motiv + ((e.happy * .6 + 32 + (e.traits.includes('workaholic') ? 8 : 0)) - e.motiv) * .03);
    e.loyalty = clamp(e.loyalty + (e.happy - 58) * .0035);
    const tgt = (e.baseProd ?? e.prod) * dd.eff * (1 - crowd * .5) * (pol.remote ? .97 : 1);
    e.prod = clamp(e.prod + (tgt - e.prod) * .05, .35, 1.6);
  }
  if (cost > 0) expense(s, cost, 'salaries');
  if (P.poach) for (const p of [...P.poach]) if (p.deadline <= s.day) { const e = P.emps.find(x => x.id === p.empId); P.poach = P.poach.filter(x => x.id !== p.id); if (e) quit(s, e, `${e.name} accepted an offer from ${p.rival}`); }
  for (const c of [...P.conflicts]) if (s.day - c.day > 75) { P.conflicts = P.conflicts.filter(x => x.id !== c.id); const e = P.emps.find(x => x.id === (chance(s, .5) ? c.a : c.b)); if (e && e.heads === 1 && chance(s, .6)) quit(s, e, `${e.name} quit after an unresolved conflict`); }
}
function finishTraining(s: GameState, e: Employee) {
  const k = TRAIN_KINDS[e.trainKind || 'workshop']; e.trainUntil = 0; const mult = e.traits.includes('fast') ? 1.5 : 1; const ment = s.people.emps.some(x => x.dept === e.dept && x.traits.includes('mentor')) ? 1.15 : 1;
  e.skill = clamp(e.skill + k.skill * mult * ment); e.mgmt = clamp(e.mgmt + k.mgmt * mult); e.happy = clamp(e.happy + 6); e.loyalty = clamp(e.loyalty + 3);
  toast(`${e.name} finished ${k.name} (+${(k.skill * mult).toFixed(0)} skill${k.mgmt ? ', +' + k.mgmt + ' mgmt' : ''})`, 'good', 'success');
}
function quit(s: GameState, e: Employee, why: string) {
  const P = s.people; P.emps = P.emps.filter(x => x.id !== e.id); P.conflicts = P.conflicts.filter(c => c.a !== e.id && c.b !== e.id);
  if (e.leader) { const l = autoLeader(s, e.dept); if (l) l.leader = true; }
  for (const o of P.emps) if (o.dept === e.dept) o.happy = clamp(o.happy - 1.5);
  toast(why, 'warn', 'warn'); logEntry(s, why, 'bad'); if (e.level >= 3 || e.skill >= 85) addNews(s, `${s.co.name} loses ${e.title} ${e.name}`, why, 'people', 'bad');
  calc(s);
}

// ----------------------------------------------------------------- monthly --
export function monthly(s: GameState): void {
  const P = s.people, D = s.derived; calc(s);
  // aging / growth
  for (const e of P.emps) { e.exp += 1 / 12; if (e.trainUntil <= s.day) e.skill = clamp(e.skill + (e.skill < 85 ? .12 : .03) + (P.emps.some(m => m.dept === e.dept && m.traits.includes('mentor') && m !== e) ? .08 : 0)); e.salary = Math.round(e.salary * (1 + s.market.econ.inflation / 12)); }
  // reviews
  for (const e of P.emps) if (s.day - e.lastReview >= 365 || (e.lastReview === 0 && s.day >= 300)) {
    e.lastReview = s.day; e.rating = clamp(Math.round((e.skill * .45 + e.prod * 100 * .3 + e.motiv * .25) / 20 * 10) / 10, 1, 5);
    const mkt = marketSalary(s, e.dept, e.level, e.skill, e.exp); e.wantsRaise = e.salary < mkt * .93;
  }
  for (const e of P.emps) if (!e.wantsRaise && e.salary < marketSalary(s, e.dept, e.level, e.skill, e.exp) * .88) { e.wantsRaise = true; if (e.level >= 2) toast(`${e.name} is asking for a raise`, 'info'); }
  // leaders
  for (const d of DEPTS) { if (!P.emps.some(e => e.dept === d.id && e.leader)) { const l = autoLeader(s, d.id); if (l) l.leader = true; } }
  // candidate pool
  P.pool = P.pool.filter(c => c.expires > s.day);
  const hr = D.dept.hr.output * D.dept.hr.eff; const target = Math.round(clamp(8 + hr * 3 + s.marketing.reputation / 8 + (P.policy.wage - 1) * 14, 6, 40));
  const depts: Dept[] = ['eng', 'eng', 'eng', 'research', 'research', 'pm', 'marketing', 'sales', 'support', 'mfg', 'security', 'finance', 'hr', 'legal', 'ops'];
  let guard = 0; while (P.pool.length < target && guard++ < 60) P.pool.push(genCandidate(s, pick(s, depts)));
  // resignations & poaching
  const rivals = s.rivals.filter(r => r.status === 'active'); const press = 1 + (D.rivalPressure || 0) * .5;
  for (const e of [...P.emps]) {
    if (e.heads > 1) { if (e.happy < 30 && chance(s, .08)) { const lost = Math.max(1, Math.round(e.heads * .06)); e.heads -= lost; toast(`${lost} members of ${e.title} (${e.dept}) resigned`, 'warn'); } continue; }
    const risk = (e.happy < 38 ? (38 - e.happy) / 160 : 0) + (e.loyalty < 30 ? (30 - e.loyalty) / 400 : 0);
    if (risk > 0 && chance(s, risk * (e.traits.includes('flight') ? 1.5 : 1))) { quit(s, e, `${e.name} (${e.title}) resigned — low morale`); continue; }
    if (rivals.length && (e.skill >= 68 || e.level >= 3) && !(P.poach || []).some(p => p.empId === e.id) && chance(s, (.006 + (70 - e.loyalty) / 5000 * (e.loyalty < 70 ? 1 : 0)) * press)) {
      const r = pick(s, rivals); const offer = Math.round(e.salary * rrange(s, 1.25, 1.55) / 500) * 500;
      (P.poach ||= []).push({ id: s.people.nextId++, empId: e.id, rival: r.name, offer, deadline: s.day + 21 });
      toast(`${r.name} is trying to poach ${e.name}! Counter-offer in People.`, 'warn', 'warn');
    }
  }
  // conflicts
  if (P.emps.length >= 4 && chance(s, .1 + P.emps.filter(e => e.traits.includes('abrasive')).length * .08)) {
    const abr = P.emps.filter(e => e.heads === 1 && (e.traits.includes('abrasive') || e.happy < 45)); const a = abr.length ? pick(s, abr) : pick(s, P.emps.filter(e => e.heads === 1));
    const peers = P.emps.filter(e => e.heads === 1 && e.id !== a?.id && e.dept === a?.dept && !e.traits.includes('team'));
    if (a && peers.length && !P.conflicts.some(c => c.a === a.id)) { const b = pick(s, peers); P.conflicts.push({ id: P.nextId++, a: a.id, b: b.id, day: s.day }); toast(`Conflict: ${a.name} vs ${b.name} (${DEPT[a.dept].name})`, 'warn'); }
  }
  P.hist ||= []; P.hist.push({ day: s.day, heads: D.headcount }); if (P.hist.length > 400) P.hist.shift();
  s.derived.rivalPressure = s.derived.rivalPressure || 0;
}

// ----------------------------------------------------------------- actions --
export const listCandidates = (s: GameState) => s.people.pool.filter(c => c.expires > s.day).sort((a, b) => b.estSkill - a.estSkill);
export function interview(s: GameState, candId: number): Res {
  const c = s.people.pool.find(x => x.id === candId); if (!c) return no('Candidate no longer available'); if (c.interviewed) return no('Already interviewed');
  const cost = Math.round(400 + c.ask * .012 * (c.heads || 1)); if (s.fin.cash < cost && !s.sandboxCash) return no(`Interview costs ${fmt(cost)}`);
  expense(s, cost, 'hiring'); c.interviewed = true; c.estSkill = c.skill; sfx('click'); return ok(`${c.name}: skill ${c.skill.toFixed(0)}, mgmt ${c.mgmt.toFixed(0)}, ${c.traits.length ? c.traits.map(t => TRAITS.find(x => x.id === t)!.label).join(', ') : 'no notable traits'}.`);
}
export function acceptChance(s: GameState, c: Candidate, offer: number): number {
  const ratio = offer / c.ask; const rep = s.marketing.reputation;
  return clamp(((ratio - .88) / .12) * (.7 + rep / 200 + (s.people.policy.wage - 1) * .3) * (c.loyalty > 85 ? .95 : 1), 0, 1);
}
export function hire(s: GameState, candId: number, offerSalary: number): Res {
  const P = s.people; const c = P.pool.find(x => x.id === candId && x.expires > s.day); if (!c) return no('Candidate no longer available');
  if (offerSalary < c.ask * .85) return no(`${c.name} rejected the offer outright (asks ${fmt(c.ask)})`);
  const fee = Math.round(offerSalary * .08 * (c.heads || 1)); if (s.fin.cash < fee + offerSalary / 12 && !s.sandboxCash) return no(`Not enough cash (recruiting fee ${fmt(fee)})`);
  if (!(rnd(s) < acceptChance(s, c, offerSalary))) { if (chance(s, .2)) { P.pool = P.pool.filter(x => x.id !== candId); return no(`${c.name} walked away from negotiations.`); } c.ask = Math.round(Math.max(c.ask * .97, offerSalary * 1.03) / 500) * 500; return no(`${c.name} countered: ${fmt(c.ask)}/yr`); }
  expense(s, fee, 'hiring'); P.pool = P.pool.filter(x => x.id !== candId);
  const { ask, interviewed, estSkill, expires, poached, fromRival, ...base } = c as any;
  const e: Employee = { ...base, salary: offerSalary, hired: s.day, project: null, trainUntil: 0, lastReview: s.day, leader: false, baseProd: c.prod, happy: 78, motiv: 80 };
  P.emps.push(e); if (!P.emps.some(x => x.dept === e.dept && x.leader)) e.leader = true;
  calc(s); sfx('hire'); const over = headcountOf(s) > s.derived.officeCap; return ok(`${e.name} joined as ${e.title}.${over ? ' ⚠ Office is over capacity — morale will suffer.' : ''}`, e.id);
}
export function hireTeam(s: GameState, dept: Dept, heads: number, quality: number): Res {
  heads = Math.max(2, Math.min(5000, Math.round(heads))); quality = clamp(quality);
  const skill = clamp(38 + quality * .45 + rrange(s, -3, 3), 20, 92); const sal = marketSalary(s, dept, 1, skill, 3);
  const fee = Math.round(sal * .06 * heads); if (s.fin.cash < fee + sal * heads / 12 && !s.sandboxCash) return no(`Need ${fmt(fee + sal * heads / 12)} for fee + first month`);
  expense(s, fee, 'hiring'); const id = s.people.nextId++;
  const t: Employee = { id, name: `${DEPT[dept].name} Team ${id}`, dept, title: `${DEPT[dept].name} Team (${heads})`, level: 1, salary: sal, skill, mgmt: 20, exp: 3, prod: 1, baseProd: 1, happy: 72, motiv: 75, loyalty: 58, edu: 'Mixed', spec: DEPT_TAGS[dept].length ? pick(s, DEPT_TAGS[dept]) : 'general', heads, traits: [], hired: s.day, project: null, trainUntil: 0, lastReview: s.day, leader: false };
  s.people.emps.push(t); calc(s); sfx('hire'); return ok(`Team of ${heads} joined ${DEPT[dept].name} (skill ≈ ${skill.toFixed(0)}, ${fmt(sal)}/head).${headcountOf(s) > s.derived.officeCap ? ' ⚠ Over office capacity.' : ''}`, id);
}
export function fire(s: GameState, empId: number): Res {
  const P = s.people; const e = P.emps.find(x => x.id === empId); if (!e) return no('Not found');
  const sev = Math.round(e.salary * e.heads * .25); expense(s, sev, 'other'); P.morale = (P.morale || 0) + 3;
  for (const o of P.emps) if (o.id !== e.id) o.loyalty = clamp(o.loyalty - 1.2);
  P.emps = P.emps.filter(x => x.id !== empId); P.conflicts = P.conflicts.filter(c => c.a !== empId && c.b !== empId); P.poach = (P.poach || []).filter(p => p.empId !== empId);
  if (e.leader) { const l = autoLeader(s, e.dept); if (l) l.leader = true; }
  calc(s); return ok(`${e.name} dismissed (severance ${fmt(sev)}).`);
}
export function layoff(s: GameState, dept: Dept, pct: number): Res {
  const P = s.people; const es = P.emps.filter(e => e.dept === dept); const total = es.reduce((a, e) => a + e.heads, 0); let rem = Math.round(total * clamp(pct, 1, 90) / 100); if (rem < 1) return no('Nothing to cut');
  const sorted = [...es].sort((a, b) => (a.skill * a.prod) - (b.skill * b.prod)); let cut = 0, sev = 0;
  for (const e of sorted) { if (rem <= 0) break; if (e.heads === 1) { if (e.leader && sorted.length > 1) continue; rem--; cut++; sev += e.salary * .25; P.emps = P.emps.filter(x => x.id !== e.id); } else { const k = Math.min(e.heads - 1, rem); e.heads -= k; rem -= k; cut += k; sev += e.salary * k * .25; } }
  expense(s, sev, 'other'); P.morale = (P.morale || 0) + 4 + pct / 8; for (const o of P.emps) o.loyalty = clamp(o.loyalty - 2 - pct / 15);
  if (s.legal?.compliance) s.legal.compliance.employment = clamp(s.legal.compliance.employment - (pct > 15 ? 3 : 1));
  s.marketing.reputation = clamp(s.marketing.reputation - pct / 20); calc(s); if (cut > 50) addNews(s, `${s.co.name} lays off ${cut} in ${DEPT[dept].name}`, '', 'people', 'bad');
  return ok(`Laid off ${cut} people in ${DEPT[dept].name} (severance ${fmt(sev)}). Morale has dropped.`);
}
export function promote(s: GameState, empId: number): Res {
  const e = s.people.emps.find(x => x.id === empId); if (!e) return no('Not found'); if (e.heads > 1) return no('Teams cannot be promoted'); if (e.level >= 4) return no('Already at the top level');
  e.level++; e.title = DEPT[e.dept].titles[e.level]; e.salary = Math.round(e.salary * 1.22 / 500) * 500; e.happy = clamp(e.happy + 12); e.loyalty = clamp(e.loyalty + 8); e.skill = clamp(e.skill + 2); e.mgmt = clamp(e.mgmt + 3); e.wantsRaise = false; calc(s);
  return ok(`${e.name} promoted to ${e.title} (${fmt(e.salary)}).`);
}
export function giveRaise(s: GameState, empId: number, pct: number): Res {
  const e = s.people.emps.find(x => x.id === empId); if (!e) return no('Not found'); pct = clamp(pct, 1, 40);
  e.salary = Math.round(e.salary * (1 + pct / 100) / 500) * 500; e.happy = clamp(e.happy + pct * .8); e.loyalty = clamp(e.loyalty + pct * .3); e.wantsRaise = false; return ok(`${e.name} now earns ${fmt(e.salary)}/yr.`);
}
export function train(s: GameState, empId: number, kind: string): Res {
  const e = s.people.emps.find(x => x.id === empId); const k = TRAIN_KINDS[kind]; if (!e || !k) return no('Invalid training');
  if (e.trainUntil > s.day) return no('Already in training'); const cost = Math.round(e.salary * e.heads * k.costPct + 500);
  if (s.fin.cash < cost && !s.sandboxCash) return no(`Needs ${fmt(cost)}`); expense(s, cost, 'training'); e.trainUntil = s.day + k.days; e.trainKind = kind; e.project = null; calc(s);
  return ok(`${e.name} enrolled in ${k.name} — unavailable for ${k.days} days.`);
}
export function setLeader(s: GameState, dept: Dept, empId: number): Res {
  const e = s.people.emps.find(x => x.id === empId); if (!e || e.dept !== dept) return no('Employee not in that department'); if (e.heads > 1) return no('A team cannot lead a department');
  for (const o of s.people.emps) if (o.dept === dept) o.leader = false; e.leader = true; e.happy = clamp(e.happy + 5); calc(s);
  return ok(`${e.name} now leads ${DEPT[dept].name}${e.mgmt < 40 ? ' (weak management skill — consider training)' : ''}.`);
}
export function setPolicy(s: GameState, p: { wage?: number; perks?: number; remote?: boolean }): Res {
  if (p.wage !== undefined) s.people.policy.wage = clamp(p.wage, .8, 1.4); if (p.perks !== undefined) s.people.policy.perks = clamp(Math.round(p.perks), 0, 3); if (p.remote !== undefined) s.people.policy.remote = p.remote; calc(s);
  return ok('Policy updated.');
}
export function counterOffer(s: GameState, poachId: number, accept: boolean): Res {
  const P = s.people; const p = (P.poach || []).find(x => x.id === poachId); if (!p) return no('Offer expired'); const e = P.emps.find(x => x.id === p.empId);
  P.poach = (P.poach || []).filter(x => x.id !== poachId); if (!e) return no('Employee already gone');
  if (!accept) { quit(s, e, `${e.name} left for ${p.rival}`); return ok(`You let ${e.name} go.`); }
  const newSal = Math.round(Math.max(e.salary * 1.15, p.offer * .95) / 500) * 500; const chanceStay = clamp(.45 + e.loyalty / 200 + (newSal / p.offer - .9) * 2, .2, .95);
  e.salary = newSal; if (rnd(s) < chanceStay) { e.happy = clamp(e.happy + 10); e.loyalty = clamp(e.loyalty + 10); return ok(`${e.name} accepted the counter-offer: ${fmt(newSal)}/yr.`); }
  quit(s, e, `${e.name} took the counter-offer money… then left for ${p.rival}`); return no('The counter-offer failed — they left anyway.');
}
export function resolveConflict(s: GameState, id: number, how: 'mediate' | 'fireone'): Res {
  const P = s.people; const c = P.conflicts.find(x => x.id === id); if (!c) return no('Already resolved');
  if (how === 'mediate') { const cost = 1500; if (s.fin.cash < cost && !s.sandboxCash) return no('Need $1.5K'); expense(s, cost, 'hiring'); P.conflicts = P.conflicts.filter(x => x.id !== id); const hrOK = s.derived.dept.hr.output > 0.5 ? .85 : .6; if (chance(s, hrOK)) { for (const x of [c.a, c.b]) { const e = P.emps.find(q => q.id === x); if (e) e.happy = clamp(e.happy + 8); } return ok('Mediation worked — the team is working together again.'); } return ok('Mediation only partly helped; tension remains.'); }
  const a = P.emps.find(x => x.id === c.a); return a ? fire(s, a.id) : no('Gone');
}
export function postJob(s: GameState, dept: Dept): Res {
  const cost = Math.round(2500 * (1 + s.derived.headcount / 200)); if (s.fin.cash < cost && !s.sandboxCash) return no(`Job ads cost ${fmt(cost)}`);
  expense(s, cost, 'hiring'); for (let i = 0; i < 4; i++) s.people.pool.push(genCandidate(s, dept)); return ok(`4 new ${DEPT[dept].name} candidates applied.`);
}
export const riskCount = (s: GameState) => (s.people.poach || []).length + s.people.emps.filter(e => e.heads === 1 && e.happy < 35).length;
