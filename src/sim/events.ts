// STUB — module "events" (see docs/ARCHITECTURE.md for contract)
import type { GameState } from './types';
export function init(s: GameState): void {}
export function daily(s: GameState): void {}
export function monthly(s: GameState): void {}
/** Player resolves a pending decision event (choice index). Contract used by the UI shell. */
export function resolveEvent(s: GameState, uid: number, choice: number): void {}
