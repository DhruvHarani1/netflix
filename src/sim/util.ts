import type { GameState, Signal, Employee } from './types';

// ---------------------------------------------------------------- RNG ----
// Deterministic mulberry32; the generator state lives in GameState.rng so saves are reproducible.
export function rnd(s: GameState): number {
  let t = (s.rng += 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (s: GameState, a: number, b: number) => Math.floor(a + rnd(s) * (b - a + 1));
export const rrange = (s: GameState, a: number, b: number) => a + rnd(s) * (b - a);
export const chance = (s: GameState, p: number) => rnd(s) < p;
export function pick<T>(s: GameState, arr: readonly T[]): T { return arr[Math.floor(rnd(s) * arr.length)]; }
export function gauss(s: GameState): number { return (rnd(s) + rnd(s) + rnd(s) + rnd(s) - 2) * 1.7320508; }
export function shuffle<T>(s: GameState, a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function weighted<T>(s: GameState, items: T[], w: (t: T) => number): T | null {
  let tot = 0; for (const i of items) tot += Math.max(0, w(i)); if (tot <= 0) return null;
  let r = rnd(s) * tot; for (const i of items) { r -= Math.max(0, w(i)); if (r <= 0) return i; } return items[items.length - 1];
}

// --------------------------------------------------------------- MATH ----
export const clamp = (x: number, a = 0, b = 100) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// --------------------------------------------------------------- DATES ---
export const START_YEAR = 2026;
const MS = 86400000;
const T0 = Date.UTC(START_YEAR, 0, 1);
export function dateOf(day: number): { y: number; m: number; d: number; dow: number } {
  const dt = new Date(T0 + day * MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() };
}
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(day: number): string { const t = dateOf(day); return `${MONTHS[t.m]} ${t.d}, ${t.y}`; }
export function fmtMonth(day: number): string { const t = dateOf(day); return `${MONTHS[t.m]} ${t.y}`; }
export const yearOf = (day: number) => dateOf(day).y;
export const monthIndex = (day: number) => { const t = dateOf(day); return (t.y - START_YEAR) * 12 + t.m; };
export const isMonthStart = (day: number) => dateOf(day).d === 1;
export const isQuarterStart = (day: number) => { const t = dateOf(day); return t.d === 1 && t.m % 3 === 0; };
export const isYearStart = (day: number) => { const t = dateOf(day); return t.d === 1 && t.m === 0; };
export const daysInMonth = (day: number) => { const t = dateOf(day); return new Date(Date.UTC(t.y, t.m + 1, 0)).getUTCDate(); };
export const yearsSince = (s: GameState) => s.day / 365.25;

// ------------------------------------------------------------ SIGNALS ----
// The sim never touches the DOM.  It pushes signals; the UI drains them.
const queue: Signal[] = [];
export function emit(sig: Signal) { queue.push(sig); if (queue.length > 200) queue.shift(); }
export function toast(text: string, tone: Signal['tone'] = 'info', sfx?: Signal['sfx']) { emit({ type: 'toast', text, tone }); if (sfx) emit({ type: 'sfx', sfx }); }
export function sfx(name: NonNullable<Signal['sfx']>) { emit({ type: 'sfx', sfx: name }); }
export function drainSignals(): Signal[] { return queue.splice(0, queue.length); }

// -------------------------------------------------------- SHARED FORMULAS -
/** Effective work output of one employee record (team records have heads>1). Used by products/research/depts. */
export function empOutput(e: Employee): number {
  return e.heads * (e.skill / 100) * e.prod * (0.55 + 0.45 * (e.happy / 100)) * (0.6 + 0.4 * (e.motiv / 100));
}
/** Add an entry to the company log. */
export function logEntry(s: GameState, text: string, tone: 'good' | 'bad' | 'neutral' | 'info' = 'info') {
  s.log.push({ day: s.day, text, tone }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}
export function uid(s: GameState): number { return (s.flags.uid = (s.flags.uid || 1000) + 1); }
export function rounded(n: number, step: number) { return Math.round(n / step) * step; }
export function makeName(s: GameState, first: string[], last: string[]) { return `${pick(s, first)} ${pick(s, last)}`; }
export const FIRST = ['Aiden','Priya','Mateo','Yuki','Sofia','Omar','Lena','Kwame','Chloe','Ravi','Isabel','Noah','Mei','Lucas','Amara','Dmitri','Hana','Tomas','Zara','Felix','Nadia','Jin','Elena','Marcus','Aisha','Leo','Sana','Viktor','Ingrid','Diego','Olivia','Hiro','Fatima','Ethan','Camila','Arjun','Greta','Samir','Talia','Bruno','Wei','Maya','Jonas','Layla','Kofi','Anya','Ivan','Rosa','Theo','Ximena','Ola','Nils','Bao','Carmen','Idris','Petra','Rafael','Soo-jin','Hugo'];
export const LAST = ['Okafor','Tanaka','Silva','Novak','Haddad','Chen','Müller','Patel','Rossi','Kim','Johansson','Ortiz','Ivanov','Nguyen','Cohen','Mensah','Larsen','Santos','Park','Dubois','Kowalski','Rahman','Fischer','Alvarez','Nakamura','Moreau','Bianchi','Osei','Lindqvist','Reyes','Sato','Costa','Hassan','Volkov','Singh','Bauer','Mwangi','Aoki','Ferreira','Khan','Andersson','Lopez','Zhang','Murphy','Ahmed','Petrov','Wagner','Torres','Yamamoto','Gupta'];

/** Push a headline into the in-game news feed (used by every module). */
export function addNews(s: GameState, headline: string, body = '', kind: import('./types').NewsItem['kind'] = 'company', tone: import('./types').NewsItem['tone'] = 'neutral', rival?: string) {
  const ev = s.events; ev.news.push({ id: ev.nextNews++, day: s.day, headline, body, kind, tone, rival });
  if (ev.news.length > 300) ev.news.splice(0, ev.news.length - 300);
}
