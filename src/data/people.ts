import type { Tag } from '../sim/types';
export interface TraitDef { id: string; label: string; good: boolean; desc: string }
export const TRAITS: TraitDef[] = [
  { id: 'abrasive', label: 'Brilliant but abrasive', good: false, desc: '+skill, but clashes with colleagues' },
  { id: 'leader', label: 'Natural leader', good: true, desc: 'Excellent management potential' },
  { id: 'fast', label: 'Fast learner', good: true, desc: 'Training gains ×1.5' },
  { id: 'perfectionist', label: 'Perfectionist', good: true, desc: 'Slower but more reliable output' },
  { id: 'team', label: 'Team player', good: true, desc: 'Rarely in conflict; raises neighbours’ morale' },
  { id: 'flight', label: 'Flight risk', good: false, desc: 'Low loyalty — easily poached' },
  { id: 'loyal', label: 'Fiercely loyal', good: true, desc: 'Very unlikely to quit' },
  { id: 'workaholic', label: 'Workaholic', good: true, desc: '+productivity, burns out faster' },
  { id: 'mentor', label: 'Mentor', good: true, desc: 'Lifts skill growth of the department' },
  { id: 'lazy', label: 'Lazy genius', good: false, desc: '+skill, much lower output' },
  { id: 'poormgr', label: 'Terrible manager', good: false, desc: 'Management skill is poor even if brilliant' },
  { id: 'greedy', label: 'Money-motivated', good: false, desc: 'Needs pay above market to stay happy' },
];
export const EDU = ['Self-taught', 'Bachelor’s', 'Master’s', 'PhD', 'MBA'];
export const DEPT_TAGS: Record<string, Tag[]> = {
  eng: ['soft', 'compute', 'net', 'gfx', 'mem', 'sec', 'ux'], pm: ['ux', 'soft'], research: ['ai', 'compute', 'mem', 'sens', 'disp', 'batt', 'bot', 'sec'],
  mfg: ['mfg', 'bot', 'batt', 'disp'], security: ['sec', 'net'], marketing: [], sales: [], finance: [], hr: [], support: [], legal: [], ops: [],
};
export const TRAIN_KINDS: Record<string, { name: string; days: number; costPct: number; skill: number; mgmt: number; desc: string }> = {
  workshop: { name: 'Skills workshop', days: 14, costPct: .02, skill: 3, mgmt: 0, desc: '2 weeks · +3 skill' },
  degree: { name: 'Advanced degree / sabbatical', days: 90, costPct: .15, skill: 8, mgmt: 0, desc: '3 months · +8 skill' },
  leadership: { name: 'Leadership program', days: 30, costPct: .08, skill: 1, mgmt: 10, desc: '1 month · +10 management' },
};
export const PAY_MULT = [1, 1.25, 1.6, 2.1, 3.0];
