import type { FacKind } from '../sim/types';

export type Track = 'capacity' | 'compute' | 'security' | 'amenities' | 'energy' | 'equipment' | 'automation';
export interface FacDef {
  kind: FacKind; name: string; icon: string; blurb: string; maxLevel: number;
  cap: number[];        // staff capacity per level (0 = none)
  rent: number[];       // monthly rent at cost index 1.0
  build: number[];      // construction days if bought
  buyMonths: number;    // purchase price = rent * buyMonths
  energy: number;       // monthly utilities as fraction of rent
  effect: string;       // short description of the level effect
  tracks: Track[]; req?: string; reqText?: string;
  mfg?: number[]; dc?: number[]; lab?: number[]; test?: number[]; warehouse?: number[]; amen?: number[];
}
export const FACS: FacDef[] = [
  { kind: 'office', name: 'Office', icon: '🏢', blurb: 'Desk space for your growing team.', maxLevel: 4, cap: [16, 40, 90, 180], rent: [4500, 10000, 22000, 45000], build: [20, 40, 70, 100], buyMonths: 84, energy: .08, effect: 'Staff capacity', tracks: ['capacity', 'amenities', 'security', 'energy'] },
  { kind: 'hq', name: 'Corporate Headquarters', icon: '🏛️', blurb: 'Flagship campus. Big capacity, big prestige.', maxLevel: 5, cap: [80, 220, 500, 1000, 2000], rent: [35000, 90000, 200000, 420000, 850000], build: [90, 140, 200, 260, 320], buyMonths: 84, energy: .08, effect: 'Staff capacity', tracks: ['capacity', 'amenities', 'security', 'energy'], amen: [1, 2, 3, 4, 5] },
  { kind: 'campus', name: 'Innovation Campus', icon: '🌳', blurb: 'Sprawling campus with amenities that keep talent happy and creative.', maxLevel: 3, cap: [1500, 4000, 10000], rent: [300000, 800000, 2000000], build: [240, 330, 420], buyMonths: 84, energy: .1, effect: 'Capacity + happiness + extra research slot', tracks: ['capacity', 'amenities', 'security', 'energy'], amen: [6, 9, 12], req: '$500M valuation', reqText: 'Requires $500M+ valuation' },
  { kind: 'lab', name: 'Research Laboratory', icon: '🧪', blurb: 'Each lab adds a parallel research slot and speeds up R&D.', maxLevel: 4, cap: [20, 50, 120, 300], rent: [20000, 55000, 130000, 300000], build: [60, 100, 160, 240], buyMonths: 84, energy: .15, effect: '+1 research slot, +R&D speed', tracks: ['capacity', 'compute', 'equipment', 'security', 'energy'], lab: [.15, .35, .65, 1.0] },
  { kind: 'datacenter', name: 'Data Center', icon: '🖥️', blurb: 'Serve cloud, AI & platform customers. Owning beats renting capacity at scale.', maxLevel: 5, cap: [0, 0, 0, 0, 0], rent: [25000, 110000, 500000, 2200000, 9000000], build: [90, 150, 240, 360, 480], buyMonths: 54, energy: .45, effect: 'Service capacity (customers)', tracks: ['capacity', 'compute', 'security', 'energy'], dc: [60000, 300000, 1500000, 8000000, 40000000] },
  { kind: 'factory', name: 'Manufacturing Plant', icon: '🏭', blurb: 'Build hardware in-house at far lower unit cost than contract manufacturing.', maxLevel: 5, cap: [30, 120, 500, 2000, 8000], rent: [30000, 150000, 700000, 3200000, 14000000], build: [120, 200, 300, 420, 540], buyMonths: 60, energy: .3, effect: 'Hardware units / month', tracks: ['capacity', 'equipment', 'automation', 'energy', 'security'], mfg: [5000, 30000, 150000, 800000, 4000000] },
  { kind: 'fab', name: 'Semiconductor Fab', icon: '🔲', blurb: 'Cleanroom wafer fabrication for chips. Brutally expensive and strategic.', maxLevel: 4, cap: [100, 400, 1500, 5000], rent: [150000, 800000, 4000000, 20000000], build: [300, 480, 660, 840], buyMonths: 70, energy: .6, effect: 'Chip units / month', tracks: ['capacity', 'equipment', 'automation', 'energy', 'security'], mfg: [100000, 600000, 3000000, 15000000], req: 'fab1', reqText: 'Requires Semiconductor Fabrication research' },
  { kind: 'warehouse', name: 'Warehouse & Distribution', icon: '📦', blurb: 'Logistics hubs that lift hardware throughput and cut delivery friction.', maxLevel: 3, cap: [10, 30, 90], rent: [8000, 30000, 100000], build: [40, 80, 140], buyMonths: 72, energy: .1, effect: '+10/22/40% hardware throughput', tracks: ['capacity', 'automation', 'energy'], warehouse: [.1, .22, .4] },
  { kind: 'testing', name: 'Testing Facility', icon: '🔎', blurb: 'Speeds testing and squeezes out bugs before launch.', maxLevel: 3, cap: [15, 40, 100], rent: [15000, 50000, 160000], build: [50, 90, 150], buyMonths: 80, energy: .12, effect: 'Faster, deeper product testing', tracks: ['capacity', 'equipment', 'security'], test: [.25, .6, 1.1] },
];
export const FAC: Record<FacKind, FacDef> = Object.fromEntries(FACS.map(f => [f.kind, f])) as any;
export const TRACK_INFO: Record<Track, { name: string; desc: string; icon: string }> = {
  capacity: { name: 'Expansion', desc: '+20% capacity per level', icon: '↔️' },
  compute: { name: 'Compute', desc: '+25% serving capacity / +15% lab speed per level', icon: '⚡' },
  security: { name: 'Security', desc: 'Hardens against breaches & espionage', icon: '🛡️' },
  amenities: { name: 'Amenities', desc: '+1.3 happiness per level', icon: '☕' },
  energy: { name: 'Energy efficiency', desc: '-8% utility costs per level', icon: '🌿' },
  equipment: { name: 'Equipment', desc: '+12% lab/test effectiveness, +6% output per level', icon: '🔧' },
  automation: { name: 'Automation', desc: '+12% throughput, -6% maintenance per level', icon: '🤖' },
};
