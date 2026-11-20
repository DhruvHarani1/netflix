// UI-side (non-saved) state + the live game handle.
import type { GameState } from '../sim/types';

export interface UIState {
  screen: 'menu' | 'create' | 'game';
  view: string;
  tab: Record<string, string>;            // active tab per view
  sel: Record<string, any>;               // selections / form drafts per view
  speed: number; paused: boolean;
  modal: null | { id: string; render: () => string; wide?: boolean };
  notes: { day: number; text: string; tone: string }[];
  settings: Settings;
  slot: number;                            // active save slot
  navCollapsed: boolean;
}
export interface Settings { sound: boolean; volume: number; reduceMotion: boolean; bigText: boolean; autoPause: boolean; autosave: boolean; autosaveMonths: number; compact: boolean; contrast: boolean; tooltips: boolean }
export const defaultSettings = (): Settings => ({ sound: true, volume: .5, reduceMotion: false, bigText: false, autoPause: true, autosave: true, autosaveMonths: 3, compact: false, contrast: false, tooltips: true });

export const ui: UIState = {
  screen: 'menu', view: 'dashboard', tab: {}, sel: {}, speed: 1, paused: true, modal: null, notes: [], settings: defaultSettings(), slot: 0, navCollapsed: false,
};
export const G: { s: GameState | null } = { s: null };
export function S(): GameState { if (!G.s) throw new Error('no game'); return G.s; }
