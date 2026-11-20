import type { GameState } from './types';
import { SAVE_VERSION } from './state';

const KEY = (slot: number | 'auto') => `tt.save.${slot}`;
export interface SaveMeta { slot: number | 'auto'; name: string; founder: string; color: string; logo: number; day: number; cash: number; valuation: number; stage: number; difficulty: string; savedAt: number; headcount: number; }

function replacer(_k: string, v: any) { return typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10000) / 10000 : v; }
export function serialize(s: GameState): string { return JSON.stringify(s, replacer); }
export function deserialize(txt: string): GameState {
  const s = JSON.parse(txt) as GameState; if (!s || typeof s !== 'object' || !s.co || !s.fin) throw new Error('Invalid save file');
  return migrate(s);
}
function migrate(s: GameState): GameState { if (!s.v) s.v = SAVE_VERSION; if (!s.flags) s.flags = { uid: 1000 }; return s; }
export function metaOf(s: GameState, slot: number | 'auto'): SaveMeta {
  return { slot, name: s.co.name, founder: s.co.founder, color: s.co.color, logo: s.co.logo, day: s.day, cash: s.fin.cash, valuation: s.derived.valuation, stage: s.derived.stage, difficulty: s.difficulty, savedAt: Date.now(), headcount: s.derived.headcount };
}
export function saveGame(s: GameState, slot: number | 'auto'): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(KEY(slot), serialize(s)); localStorage.setItem(KEY(slot) + '.meta', JSON.stringify(metaOf(s, slot))); return { ok: true };
  } catch (e: any) { return { ok: false, error: e?.name === 'QuotaExceededError' ? 'Browser storage is full — delete an old save or export to a file.' : String(e) }; }
}
export function loadGame(slot: number | 'auto'): GameState | null {
  try { const t = localStorage.getItem(KEY(slot)); return t ? deserialize(t) : null; } catch { return null; }
}
export function getMeta(slot: number | 'auto'): SaveMeta | null { try { const t = localStorage.getItem(KEY(slot) + '.meta'); return t ? JSON.parse(t) : null; } catch { return null; } }
export function deleteSave(slot: number | 'auto') { try { localStorage.removeItem(KEY(slot)); localStorage.removeItem(KEY(slot) + '.meta'); } catch {} }
export const SLOTS = [1, 2, 3, 4, 5];
export function latestSave(): SaveMeta | null {
  let best: SaveMeta | null = null; for (const sl of [...SLOTS, 'auto' as const]) { const m = getMeta(sl); if (m && (!best || m.savedAt > best.savedAt)) best = m; } return best;
}
export function saveSettings(o: any) { try { localStorage.setItem('tt.settings', JSON.stringify(o)); } catch {} }
export function loadSettings(): any | null { try { const t = localStorage.getItem('tt.settings'); return t ? JSON.parse(t) : null; } catch { return null; } }
