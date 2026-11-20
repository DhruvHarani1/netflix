// Product workflow: design -> develop -> prototype -> test -> price -> launch -> monitor -> update.
import type { GameState, Product, CatId, Seg, Employee } from './types';
import { CAT, CATS, specQuality, specCostIndex, type CatDef } from '../data/categories';
import { SEG, SPEC, DIFF, DEPT } from '../data/core';
import { specCap, TECH_BY_ID } from '../data/research';
import { clamp, empOutput, toast, sfx, addNews, logEntry, rnd, gauss, pick, rrange } from './util';
import { expense } from './ledger';
import { unlocked } from './market';

export type Res = { ok: boolean; msg: string; id?: number };
const ok = (msg: string, id?: number): Res => ({ ok: true, msg, id }); const no = (msg: string): Res => ({ ok: false, msg });

export function init(s: GameState): void {}

// ------------------------------------------------------------ helpers -----
export const getProduct = (s: GameState, id: number) => s.products.find(p => p.id === id);
export const ASSIGNABLE = ['eng', 'pm', 'mfg', 'research', 'security', 'ops'] as const;
export function complexity(cat: CatDef, specs: Record<string, number>): number {
  let a = 0; for (const sp of cat.specs) a += (specs[sp.key] || 1); return 0.3 + 0.7 * (a / cat.specs.length / 10);
}
export function devPointsNeeded(s: GameState, cat: CatDef, specs: Record<string, number>): number { return Math.round(cat.days * Math.pow(complexity(cat, specs), 1.15)); }
export function recommendedBudget(s: GameState, cat: CatDef, specs: Record<string, number>): number { return Math.round((cat.dev * 0.6 * Math.pow(complexity(cat, specs), 1.35) * DIFF[s.difficulty].cost) / 1000) * 1000; }
export function levelCap(s: GameState, tag: any): number { return specCap(s.research.done, tag); }
export function defaultSpecs(s: GameState, cat: CatDef): Record<string, number> { const o: Record<string, number> = {}; for (const sp of cat.specs) o[sp.key] = Math.min(levelCap(s, sp.tag), 5); return o; }
export function specBonus(s: GameState, cat: CatId): number { return SPEC[s.co.spec].bonusCats.includes(cat) ? 1.1 : 1; }

/** Output (person-days/day) of the assigned team for a product. */
export function teamOf(s: GameState, pid: number): Employee[] { return s.people.emps.filter(e => e.project === pid); }
export function teamOutput(s: GameState, p: Product): { out: number; skill: number; heads: number; pmShare: number } {
  const cat = CAT[p.cat]; const tags = new Set(cat.specs.map(x => x.tag)); let out = 0, sk = 0, heads = 0, pm = 0;
  for (const e of teamOf(s, p.id)) {
    const fit = ({ eng: 1, pm: 0.35, mfg: cat.cls === 'hw' ? 0.8 : 0.12, research: 0.3, security: ['security', 'cloud', 'database', 'payment'].includes(p.cat) ? 0.7 : 0.15, ops: 0.12 } as any)[e.dept] ?? 0;
    const match = e.spec !== 'general' && tags.has(e.spec as any) ? 1.2 : 1;
    const o = empOutput(e) * fit * match * clamp(s.derived.dept[e.dept]?.eff ?? 1, 0.7, 1.4);
    out += o; sk += o * e.skill; heads += e.heads; if (e.dept === 'pm') pm += o;
  }
  const bro = 1 / (1 + Math.max(0, heads - 14) / 45); // coordination overhead
  out *= bro; return { out, skill: out > 0 ? sk / (out / bro) : 0, heads, pmShare: out > 0 ? pm / (out / bro) : 0 };
}
/** Quality attributes from spec choices + execution. */
export function evaluate(s: GameState, cat: CatDef, specs: Record<string, number>, ctx: { teamSkill: number; budgetRatio: number; pmShare: number; bugs: number }) {
  const cm = s.market.cats[cat.id];
  const sq = specQuality(cat, specs);
  const teamF = 0.82 + 0.38 * clamp(ctx.teamSkill, 0, 100) / 100;
  const bf = clamp(0.8 + 0.2 * Math.min(1.25, ctx.budgetRatio) + (ctx.budgetRatio > 1 ? 0.05 : 0), 0.75, 1.1);
  const q = clamp(sq * teamF * bf * specBonus(s, cat.id), 5, 99);
  const lvl = (re: RegExp) => { const xs = cat.specs.filter(x => re.test(x.key) || re.test(x.label.toLowerCase())).map(x => specs[x.key] || 1); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 5; };
  const relBase = 38 + 5.2 * lvl(/^(rel|bld|sec|saf|dur|build|stab|reliab|avail|dura)/);
  const rel = clamp(relBase * (1 - ctx.bugs / 150), 5, 99);
  const ux = clamp(34 + 6 * lvl(/^(ux|opt|dis|fea|tol)/) + ctx.pmShare * 18 + (s.derived.dept.pm.eff - 1) * 10, 5, 99);
  const tagLv = cat.specs.reduce((a, x) => a + (specs[x.key] || 1) * x.w, 0) / cat.specs.reduce((a, x) => a + x.w, 0);
  let recent = 0; for (const id in s.research.done) { const t = TECH_BY_ID[id]; if (t && s.day - s.research.done[id] < 540 && t.tags.some(tg => cat.specs.some(sp => sp.tag === tg))) recent++; }
  const inn = clamp(26 + 6.5 * tagLv + Math.min(14, recent * 2.5) + (q - cm.frontierQ) * 0.35, 5, 99);
  const ci = specCostIndex(cat, specs);
  const ucost = cat.ref * cat.ucr * Math.pow(ci, cat.sub ? 0.65 : 1) * (0.92 + 0.08 * (1 + DIFF[s.difficulty].cost) / 2) * (1 - (SPEC[s.co.spec].id === 'semis' && cat.group === 'Semiconductors' ? 0.1 : 0));
  return { q, rel, ux, inn, ucost, sq };
}
export function recommendedPrice(s: GameState, cat: CatDef, target: Seg, q: number, ucost: number): number {
  const cm = s.market.cats[cat.id]; const p = cm.ref * Math.pow(SEG[target].priceMult, 0.9) * (0.55 + 0.45 * q / 60);
  return Math.max(p, ucost * 1.12);
}
export function hasPrereqs(s: GameState, cat: CatId): string[] { return CAT[cat].req.filter(r => !s.research.done[r]).map(r => TECH_BY_ID[r]?.name || r); }

// -------------------------------------------------------------- actions ---
export function createProduct(s: GameState, o: { cat: CatId; name: string; target: Seg; specs: Record<string, number>; budget: number; outsource: boolean }): Res {
  const cat = CAT[o.cat]; if (!cat) return no('Unknown category');
  if (!unlocked(s, o.cat)) return no(`Research required: ${hasPrereqs(s, o.cat).join(', ')}`);
  const name = (o.name || '').trim(); if (!name) return no('Give the product a name');
  const rec = recommendedBudget(s, cat, o.specs); const min = rec * 0.3;
  if (o.budget < min) return no(`Budget too small — minimum viable is ${fmt$(min)}`);
  if (s.fin.cash < o.budget * 0.15 && !s.sandboxCash) return no(`You need at least ${fmt$(o.budget * 0.15)} cash on hand to kick off development`);
  const specs: Record<string, number> = {};
  for (const sp of cat.specs) { const cap = levelCap(s, sp.tag); const v = clamp(Math.round(o.specs[sp.key] || 1), 1, 10); if (v > cap) return no(`${sp.label} level ${v} exceeds your research cap (${cap}). Research ${sp.tag} technologies.`); specs[sp.key] = v; }
  const need = devPointsNeeded(s, cat, specs);
  const p: Product = {
    id: s.nextProdId++, name, cat: o.cat, version: 1, status: 'dev', specs, target: o.target, budget: o.budget, spent: 0, progress: 0, need, testProg: 0, testNeed: Math.round(need * 0.12),
    bugs: 0, q: 0, rel: 0, inn: 0, ux: 0, price: 0, ucost: 0, startDay: s.day, launchDay: 0, lifeRev: 0, lifeUnits: 0, base: 0, unitsEma: 0, revEma: 0, satisf: 55, rating: 3, reviews: [], hist: [],
    outsource: o.outsource, promo: 0, protoNote: '', updating: false, lastUpdate: 0, sold30: 0, lost30: 0, platformUsers: 0, devBuzz: 0, teamSkill: 50, stalled: false, qaSpent: 0, rushed: false, budgetRatio: o.budget / rec,
  };
  s.products.push(p); logEntry(s, `Started development of ${p.name}`, 'info'); sfx('click');
  return ok(`${p.name} is in development — assign a team!`, p.id);
}
export function assign(s: GameState, pid: number, empId: number): Res {
  const p = getProduct(s, pid), e = s.people.emps.find(x => x.id === empId); if (!p || !e) return no('Not found');
  if (!(ASSIGNABLE as readonly string[]).includes(e.dept)) return no(`${DEPT[e.dept].name} staff can't work on products`);
  if (e.project && e.project !== pid) { const o = getProduct(s, e.project); if (o && o.status !== 'live' && o.status !== 'retired') return no(`${e.name} is already on ${o.name}`); }
  e.project = pid; return ok(`${e.name} assigned to ${p.name}`);
}
export function unassign(s: GameState, empId: number): Res { const e = s.people.emps.find(x => x.id === empId); if (!e) return no('Not found'); e.project = null; return ok('Unassigned'); }
export function autoAssign(s: GameState, pid: number): Res {
  const p = getProduct(s, pid); if (!p) return no('Not found'); let n = 0;
  for (const e of s.people.emps) { if (e.project) continue; if (!['eng', 'pm', 'mfg'].includes(e.dept)) continue; if (e.dept === 'mfg' && CAT[p.cat].cls !== 'hw') continue; if (e.dept === 'pm' && teamOf(s, pid).filter(x => x.dept === 'pm').length >= 2) continue; e.project = pid; n++; }
  return n ? ok(`Assigned ${n} available employees`) : no('No free engineers, product managers or manufacturing staff — hire more');
}
export function topUpBudget(s: GameState, pid: number, amt: number): Res { const p = getProduct(s, pid); if (!p) return no('Not found'); if (amt <= 0) return no('Invalid amount'); p.budget += amt; p.stalled = false; p.budgetRatio = p.budget / Math.max(1, recommendedBudget(s, CAT[p.cat], p.specs)); return ok(`Budget raised by ${fmt$(amt)}`); }
export function setPrice(s: GameState, pid: number, price: number): Res { const p = getProduct(s, pid); if (!p) return no('Not found'); if (!(price > 0)) return no('Price must be positive'); p.price = price; return ok('Price updated'); }
export function setOutsource(s: GameState, pid: number, v: boolean): Res { const p = getProduct(s, pid); if (!p) return no('Not found'); p.outsource = v; return ok(v ? 'Now outsourcing production' : 'Now using own facilities'); }
export function startTesting(s: GameState, pid: number): Res { const p = getProduct(s, pid); if (!p || p.status !== 'prototype') return no('Product must be at prototype stage'); p.status = 'testing'; return ok('Testing started — QA team is on it'); }
export function skipTesting(s: GameState, pid: number): Res { const p = getProduct(s, pid); if (!p || p.status !== 'prototype') return no('Product must be at prototype stage'); finishToReady(s, p, false); return ok('Skipped testing — bugs remain!'); }
export function rework(s: GameState, pid: number): Res {
  const p = getProduct(s, pid); if (!p || p.status !== 'prototype') return no('Product must be at prototype stage');
  p.status = 'dev'; p.progress = p.need * 0.8; p.budget += recommendedBudget(s, CAT[p.cat], p.specs) * 0.1; p.stalled = false; p.rushed = false; return ok('Back to development for another iteration (+10% budget)');
}
export function launch(s: GameState, pid: number): Res {
  const p = getProduct(s, pid); if (!p || p.status !== 'ready') return no('Product is not ready to launch');
  const cat = CAT[p.cat]; if (!(p.price > 0)) return no('Set a price first');
  if (!cat.sub && cat.cls === 'hw' && !p.outsource && s.derived.mfgCap <= 0) return no('You have no factories — switch to contract manufacturing or build a plant');
  p.status = 'live'; p.launchDay = s.day; p.base = 0; p.promo = Math.max(p.promo, 25 + s.marketing.reputation * 0.2 + p.inn * 0.2); p.version = 1;
  const cm = s.market.cats[p.cat]; const stars = clamp(Math.round(1 + 4 * clamp(50 + (p.q - cm.avgQ) * 1.4 + (p.rel - 55) * 0.5 - p.bugs * 0.4) / 100), 1, 5);
  p.reviews.push({ day: s.day, stars, who: 'press', text: stars >= 4 ? pick(s, ['A genuine contender — ' + p.name + ' impresses.', 'Hard to fault. Competitors should worry.']) : stars <= 2 ? pick(s, ['Launched too soon: bugs and rough edges everywhere.', 'Unconvincing against established rivals.']) : 'A decent debut with room to grow.' });
  p.satisf = clamp(35 + stars * 10);
  addNews(s, `${s.co.name} launches ${p.name}`, `${cat.name} · $${p.price.toFixed(p.price < 10 ? 2 : 0)} · press verdict ${stars}/5`, 'company', stars >= 4 ? 'good' : stars <= 2 ? 'bad' : 'neutral');
  s.marketing.reputation = clamp(s.marketing.reputation + (stars - 3) * 1.2);
  toast(`🚀 ${p.name} is live!`, 'good', 'launch'); logEntry(s, `Launched ${p.name} at $${p.price.toFixed(2)}`, 'good');
  s.meta.stats.launches = (s.meta.stats.launches || 0) + 1;
  // free the team for the next project
  for (const e of s.people.emps) if (e.project === p.id) e.project = null;
  return ok(`${p.name} launched!`);
}
export function startUpdate(s: GameState, pid: number, o: { specs?: Record<string, number>; budget: number }): Res {
  const p = getProduct(s, pid); if (!p || p.status !== 'live') return no('Only live products can be updated'); if (p.updating) return no('An update is already in progress');
  const cat = CAT[p.cat]; const specs: Record<string, number> = { ...p.specs };
  if (o.specs) for (const sp of cat.specs) { const v = clamp(Math.round(o.specs[sp.key] ?? specs[sp.key]), specs[sp.key], 10); if (v > levelCap(s, sp.tag)) return no(`${sp.label} exceeds your research cap`); specs[sp.key] = v; }
  const rec = recommendedBudget(s, cat, specs) * 0.45; if (o.budget < rec * 0.3) return no(`Update budget too small (min ${fmt$(rec * 0.3)})`);
  p.pendingSpecs = specs; p.updating = true; p.progress = 0; p.need = Math.round(devPointsNeeded(s, cat, specs) * 0.42); p.budget = o.budget; p.spent = 0; p.stalled = false; p.budgetRatio = o.budget / rec;
  return ok(`Version ${p.version + 1} of ${p.name} in development — assign a team`);
}
export function retire(s: GameState, pid: number): Res {
  const p = getProduct(s, pid); if (!p) return no('Not found'); const was = p.status; p.status = 'retired'; p.updating = false;
  for (const e of s.people.emps) if (e.project === p.id) e.project = null;
  logEntry(s, `${p.name} ${was === 'live' ? 'retired from the market' : 'cancelled'}`, 'neutral'); return ok(`${p.name} retired`);
}
export function patchBugs(s: GameState, pid: number): Res {
  const p = getProduct(s, pid); if (!p || p.status !== 'live') return no('Only live products can be patched'); const cost = Math.max(20000, CAT[p.cat].dev * 0.03); if (s.fin.cash < cost && !s.sandboxCash) return no(`Needs ${fmt$(cost)}`);
  expense(s, cost, 'dev'); p.bugs = Math.max(0, p.bugs - 18); p.rel = clamp(p.rel + 4); p.satisf = clamp(p.satisf + 3); return ok(`Patch shipped (${fmt$(cost)}) — bugs reduced`);
}
export const fmt$ = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;

// --------------------------------------------------------------- engine ---
function finishToReady(s: GameState, p: Product, tested: boolean) {
  const cat = CAT[p.cat]; const tm = teamOutput(s, p);
  const ev = evaluate(s, cat, p.pendingSpecs || p.specs, { teamSkill: p.teamSkill, budgetRatio: p.budgetRatio, pmShare: tm.pmShare, bugs: p.bugs });
  p.q = ev.q; p.rel = ev.rel; p.ux = ev.ux; p.inn = ev.inn; p.ucost = ev.ucost;
  if (!(p.price > 0)) p.price = Math.round(recommendedPrice(s, cat, p.target, p.q, p.ucost) * (cat.ref > 100 ? 1 : 100)) / (cat.ref > 100 ? 1 : 100);
  p.status = 'ready'; toast(`✅ ${p.name} is ready to launch`, 'good', 'success');
}
export function daily(s: GameState): void {
  for (const p of s.products) {
    if (p.status === 'retired') continue;
    if (p.status === 'live' && !p.updating) { p.bugs = Math.max(0, p.bugs - 0.02 * (s.derived.dept.eng.eff)); continue; }
    const cat = CAT[p.cat];
    if (p.status === 'dev' || p.updating) {
      const tm = teamOutput(s, p); let pts = tm.out;
      if (pts <= 0) { if (!p.stalled && s.day % 30 === 0) toast(`${p.name} has no team assigned`, 'warn'); continue; }
      const remaining = p.need - p.progress; pts = Math.min(pts, remaining);
      const cost = (p.budget * pts) / p.need;
      if (p.spent + cost > p.budget + 1) { if (!p.stalled) { p.stalled = true; toast(`${p.name} ran out of budget — top it up`, 'warn', 'warn'); } continue; }
      p.stalled = false; if (s.fin.cash < cost && !s.sandboxCash) { /* still pay: overdraft handled by finance */ }
      if (cost > 0) { expense(s, cost, 'dev'); p.spent += cost; }
      p.teamSkill = (p.teamSkill * p.progress + tm.skill * pts) / Math.max(1, p.progress + pts); p.progress += pts;
      if (p.progress >= p.need - 1e-6) {
        if (p.updating) {
          p.updating = false; p.version++; p.specs = p.pendingSpecs || p.specs; p.pendingSpecs = undefined; const old = { q: p.q };
          const ev = evaluate(s, cat, p.specs, { teamSkill: p.teamSkill, budgetRatio: p.budgetRatio, pmShare: tm.pmShare, bugs: p.bugs * 0.5 });
          p.bugs *= 0.5; p.q = Math.max(p.q, ev.q); p.rel = Math.max(p.rel, ev.rel); p.ux = Math.max(p.ux, ev.ux); p.inn = Math.max(ev.inn, p.inn + 6); p.ucost = Math.min(p.ucost * 1.08, Math.max(p.ucost * 0.95, ev.ucost));
          p.promo = Math.max(p.promo, 22); p.lastUpdate = s.day; p.devBuzz = 18;
          addNews(s, `${s.co.name} ships ${p.name} v${p.version}`, `Quality ${old.q.toFixed(0)} → ${p.q.toFixed(0)}`, 'company', 'good'); toast(`🆕 ${p.name} v${p.version} released`, 'good', 'success');
          for (const e of s.people.emps) if (e.project === p.id) e.project = null;
        } else {
          // initial bug load: rushed/underfunded + complex + weak teams = buggy
          p.bugs = clamp(18 + complexity(cat, p.specs) * 22 + Math.max(0, 1 - p.budgetRatio) * 38 - (p.teamSkill - 50) * 0.3 + gauss(s) * 4, 3, 90);
          p.status = 'prototype'; const ev = evaluate(s, cat, p.specs, { teamSkill: p.teamSkill, budgetRatio: p.budgetRatio, pmShare: tm.pmShare, bugs: p.bugs });
          const noise = 7; p.protoNote = `Early benchmarks: performance ≈ ${Math.round(ev.q + gauss(s) * noise)}/100 (±${noise + 2}); internal builds crash ${p.bugs > 45 ? 'often' : p.bugs > 25 ? 'sometimes' : 'rarely'}. Run QA testing to firm this up.`;
          toast(`🧪 Prototype of ${p.name} is ready for review`, 'good', 'notify');
        }
      }
    } else if (p.status === 'testing') {
      const tm = teamOutput(s, p); const out = tm.out * s.derived.testBonus; if (out <= 0) continue;
      const step = Math.min(out, p.testNeed - p.testProg); const qa = (p.budget * 0.06 * step) / Math.max(1, p.testNeed);
      expense(s, qa, 'dev'); p.qaSpent += qa;
      const frac0 = p.testProg / p.testNeed; p.testProg += step; const frac1 = p.testProg / p.testNeed;
      p.bugs = Math.max(2, p.bugs * (1 - 0.88 * (frac1 - frac0) / Math.max(0.05, 1 - 0.88 * frac0)));
      if (p.testProg >= p.testNeed - 1e-6) { for (const e of s.people.emps) if (e.project === p.id) e.project = null; finishToReady(s, p, true); }
    }
  }
}
export function monthly(s: GameState): void {
  for (const p of s.products) {
    if (p.status !== 'live') continue;
    const cat = CAT[p.cat]; const maint = cat.dev * 0.0035 * (1 + p.version * 0.1) * DIFF[s.difficulty].cost * (cat.sub ? 1.5 : 1);
    expense(s, maint, 'dev');
  }
}
export { CATS };
