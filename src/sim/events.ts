// EVENT ENGINE + MACRO ECONOMY + ROUTINE NEWS — owns s.events and market.econ transitions.
import type { GameState, GameEvent, Econ } from './types';
import { clamp, rnd, rint, pick, chance, weighted, toast, sfx, addNews, logEntry, gauss, rrange } from './util';
import { EVENTS, EVENT_BY_ID, WORLD_HEADLINES } from '../data/events';
import { DIFF } from '../data/core';
import { CAT } from '../data/categories';
import { perkMult } from './achievements';

export function init(s: GameState): void {
  s.events.flags.supplierCost = 1; s.events.flags.nextEvent = 50 + rint(s, 0, 25); s.events.flags.newsSeen = 0;
  addNews(s, `${s.co.name} opens its doors in ${s.co.city}`, s.co.slogan, 'company', 'good');
  addNews(s, 'Tech sector enters 2026 with cautious optimism', 'Analysts expect steady growth as AI spending accelerates.', 'market', 'neutral');
}

function instantiate(s: GameState, tplId: string): GameEvent | null {
  const t = EVENT_BY_ID[tplId]; if (!t) return null;
  const b = t.build(s);
  const ev: GameEvent = { uid: s.events.nextUid++, tpl: tplId, day: s.day, deadline: s.day + (b.deadline ?? 25), title: b.title, body: b.body, params: b.params, choices: b.choices, defaultChoice: b.defaultChoice, resolved: false, severity: b.severity, icon: b.icon };
  s.events.cooldown[tplId] = s.day + t.cooldown;
  if (!b.choices.length) { // instant
    const out = t.apply(s, b.params, 0); ev.resolved = true; ev.picked = 0; if (out) ev.outcome = out;
    pushLog(s, ev); if (b.title) { addNews(s, b.title, b.body, 'company', b.severity === 'bad' ? 'bad' : b.severity === 'good' ? 'good' : 'neutral'); toast(b.title, b.severity === 'bad' ? 'warn' : b.severity === 'good' ? 'good' : 'info', b.severity === 'bad' ? 'warn' : 'notify'); }
    return ev;
  }
  s.events.pending.push(ev); addNews(s, b.title, b.body, 'company', b.severity === 'bad' ? 'bad' : b.severity === 'good' ? 'good' : 'neutral'); sfx('notify');
  return ev;
}
function pushLog(s: GameState, ev: GameEvent) { s.events.log.push(ev); if (s.events.log.length > 200) s.events.log.shift(); }

/** Player (or auto) resolves a pending decision. */
export function resolveEvent(s: GameState, uid: number, choice: number): void {
  const i = s.events.pending.findIndex(e => e.uid === uid); if (i < 0) return; const ev = s.events.pending[i]; if (ev.resolved) return;
  const t = EVENT_BY_ID[ev.tpl]; const c = clamp(choice, 0, Math.max(0, ev.choices.length - 1));
  let out: string | void = undefined; try { out = t?.apply(s, ev.params, c); } catch (e) { console.error('event apply failed', ev.tpl, e); }
  ev.resolved = true; ev.picked = c; ev.outcome = out || ev.choices[c]?.hint || '';
  s.events.pending.splice(i, 1); pushLog(s, ev);
  if (out) toast(String(out), ev.severity === 'bad' ? 'warn' : 'info');
  logEntry(s, `${ev.title} → ${ev.choices[c]?.label ?? ''}`, 'neutral');
}

export function daily(s: GameState): void {
  // auto-resolve expired
  for (const ev of [...s.events.pending]) if (s.day >= ev.deadline) { toast(`Decision timed out: ${ev.title}`, 'warn'); resolveEvent(s, ev.uid, ev.defaultChoice); }
  if (s.day < (s.events.flags.nextEvent ?? 50)) return;
  const dd = DIFF[s.difficulty].event; const interval = rint(s, 18, 38) / Math.max(0.6, 0.8 + dd * 0.2);
  s.events.flags.nextEvent = s.day + Math.round(interval);
  if (s.events.pending.filter(e => !e.resolved).length >= 3) return;
  const risk = s.derived.complianceRisk || 1;
  const pool = EVENTS.filter(t => t.weight > 0 && (s.events.cooldown[t.id] ?? 0) <= s.day && (() => { try { return t.when(s); } catch { return false; } })());
  const t = weighted(s, pool, e => e.weight * (e.sev === 'bad' ? dd * (0.7 + 0.3 * risk) * perkMult(s, 'events') : e.sev === 'good' ? 1 / Math.sqrt(dd) : 1));
  if (t) instantiate(s, t.id);
}

// ---------------------------------------------------------- macro economy -
const TARGET: Record<Econ['cycle'], { gdp: number; conf: number; dm: number; rate: number; infl: number; unemp: number }> = {
  boom: { gdp: 4.2, conf: 80, dm: 1.08, rate: 0.01, infl: 0.035, unemp: 0.037 }, normal: { gdp: 2.6, conf: 62, dm: 1.0, rate: 0, infl: 0.025, unemp: 0.05 },
  slowdown: { gdp: 1.0, conf: 42, dm: 0.94, rate: -0.005, infl: 0.02, unemp: 0.065 }, recession: { gdp: -2.2, conf: 22, dm: 0.82, rate: -0.02, infl: 0.012, unemp: 0.09 },
};
const CYCLE_NEWS: Record<Econ['cycle'], [string, string, 'good' | 'bad' | 'neutral']> = {
  boom: ['Economic boom lifts tech spending', 'Consumer confidence soars and capital is cheap.', 'good'], normal: ['Economy settles into steady growth', 'Markets stabilise as conditions normalise.', 'neutral'],
  slowdown: ['Growth slows as caution spreads', 'Businesses delay purchases and hiring.', 'bad'], recession: ['Global recession begins', 'GDP contracts, credit tightens and demand falls sharply. Cash is king.', 'bad'],
};
function nextCycle(s: GameState, cur: Econ['cycle']): Econ['cycle'] {
  const dd = DIFF[s.difficulty].event;
  switch (cur) { case 'boom': return chance(s, 0.35) ? 'slowdown' : 'normal'; case 'normal': return chance(s, 0.3) ? 'boom' : chance(s, 0.35 * dd) ? 'slowdown' : 'normal';
    case 'slowdown': return chance(s, 0.33 * dd) ? 'recession' : 'normal'; case 'recession': return chance(s, 0.7) ? 'slowdown' : 'normal'; }
}
function macroMonthly(s: GameState) {
  const e = s.market.econ; const dd = DIFF[s.difficulty];
  e.cycleDays -= 30;
  if (e.cycleDays <= 0) {
    const prev = e.cycle; let nx = nextCycle(s, prev); if (nx === prev && prev === 'normal') { e.cycleDays = rint(s, 300, 700); } else {
      e.cycle = nx; e.cycleDays = nx === 'recession' ? rint(s, 240, 540) : nx === 'boom' ? rint(s, 300, 600) : nx === 'slowdown' ? rint(s, 150, 360) : rint(s, 400, 900);
      const n = CYCLE_NEWS[nx]; addNews(s, n[0], n[1], 'world', n[2]); toast(n[0], n[2] === 'bad' ? 'warn' : 'info', n[2] === 'bad' ? 'warn' : 'notify');
      if (prev === 'recession' && nx !== 'recession') { addNews(s, 'Recession officially over', 'Economists declare the contraction ended.', 'world', 'good'); if (s.fin.cash > 0 && !s.fin.bankrupt) { s.meta.stats.recessions = (s.meta.stats.recessions || 0) + 1; toast('You survived the recession!', 'good', 'success'); } }
    }
  }
  const T = TARGET[e.cycle]; const k = 0.25;
  e.gdp += (T.gdp + gauss(s) * 0.25 - e.gdp) * k; e.confidence = clamp(e.confidence + (T.conf + gauss(s) * 3 - e.confidence) * k);
  e.demandMult += (T.dm - e.demandMult) * 0.3; e.inflation = clamp(e.inflation + (T.infl - e.inflation) * k + gauss(s) * 0.0015, 0, 0.12);
  e.unemployment = clamp(e.unemployment + (T.unemp - e.unemployment) * k, 0.02, 0.2);
  e.rate = clamp(e.rate + ((0.045 + dd.rate + T.rate + (e.inflation - 0.025) * 0.8) - e.rate) * 0.2, 0.005, 0.15);
  // keep a short econ history for charts
  const h = (s.events.flags.econHist ||= []) as number[][]; h.push([s.day, e.gdp, e.rate * 100, e.inflation * 100, e.confidence, e.demandMult]); if (h.length > 240) h.shift();
}

export function monthly(s: GameState): void {
  macroMonthly(s);
  // supplier shock decays
  const f = s.events.flags.supplierCost || 1; s.events.flags.supplierCost = f > 1.002 ? 1 + (f - 1) * 0.94 : 1;
  // routine world news
  const e = s.market.econ; const cats = Object.entries(s.market.cats).filter(([, m]) => m.unlocked || true);
  const hot = cats.reduce((a, b) => (b[1].trend > a[1].trend ? b : a), cats[0]);
  addNews(s, `Markets: GDP growth ${e.gdp.toFixed(1)}%, rates ${(e.rate * 100).toFixed(1)}%`, `Inflation ${(e.inflation * 100).toFixed(1)}%, unemployment ${(e.unemployment * 100).toFixed(1)}%. Confidence index ${e.confidence.toFixed(0)}.`, 'market', e.gdp > 2 ? 'good' : e.gdp < 1 ? 'bad' : 'neutral');
  if (hot && hot[1].trend > 0.25) addNews(s, `${CAT[hot[0] as keyof typeof CAT].name} market heats up`, 'Buzz around the category is lifting demand.', 'tech', 'good');
  if (chance(s, 0.5)) addNews(s, pick(s, WORLD_HEADLINES), '', 'world', 'neutral');
}
export function unreadNews(s: GameState): number { const seen = s.events.flags.newsSeen || 0; return s.events.news.filter(n => n.id > seen).length; }
export function markNewsRead(s: GameState) { const n = s.events.news; s.events.flags.newsSeen = n.length ? n[n.length - 1].id : 0; }
/** Force a specific event now (debug/tests/cheats). */
export function triggerEvent(s: GameState, tplId: string): GameEvent | null { return instantiate(s, tplId); }
export const eventTemplates = EVENTS;
