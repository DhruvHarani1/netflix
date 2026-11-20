import type { TechNode, Tag, CatId } from '../sim/types';

type B = TechNode['branch'];
const N = (id: string, name: string, branch: B, tier: number, desc: string, req: string[], tags: Tag[], unlocks?: CatId[], perk?: string): TechNode => ({
  id, name, branch, tier, desc, req, tags, unlocks, perk,
  cost: Math.round(30000 * Math.pow(3.1, tier - 1) / 1000) * 1000,
  rp: Math.round(150 * Math.pow(2.55, tier - 1) / 10) * 10,
  fail: Math.min(0.32, 0.03 + tier * 0.035),
});

export const TECH: TechNode[] = [
  // ------------------------------------------------------------- AI ------
  N('ml1', 'Machine Learning', 'ai', 1, 'Statistical learning, classifiers and recommenders. The foundation of modern AI.', [], ['ai'], ['assistant']),
  N('dl', 'Deep Learning', 'ai', 2, 'Multi-layer networks trained with GPUs on huge datasets.', ['ml1'], ['ai', 'compute'], ['aimodel']),
  N('cv', 'Computer Vision', 'ai', 2, 'Machines that see: detection, segmentation and tracking.', ['ml1'], ['ai', 'sens']),
  N('nlp', 'Natural Language Processing', 'ai', 2, 'Understanding and generating human language.', ['ml1'], ['ai', 'soft']),
  N('nn', 'Transformer Networks', 'ai', 3, 'Attention-based architectures that scale with data and compute.', ['dl'], ['ai', 'mem']),
  N('llm', 'Large Language Models', 'ai', 4, 'Foundation models with emergent reasoning and conversation abilities.', ['nn', 'nlp'], ['ai', 'mem'], undefined, '+10% AI assistant demand'),
  N('robotai', 'Robotics Intelligence', 'ai', 4, 'Learning-based perception and control for embodied systems.', ['dl', 'cv'], ['ai', 'bot'], ['robot']),
  N('agents', 'AI Agents', 'ai', 5, 'Autonomous, tool-using agents that plan and execute multi-step tasks.', ['llm'], ['ai', 'soft'], undefined, '+8% research speed (AI-assisted R&D)'),
  N('autonomy', 'Autonomous Systems', 'ai', 5, 'Safe self-driving and self-navigating machines.', ['robotai', 'sens2'], ['ai', 'bot', 'sens']),
  N('reasoning', 'Advanced Reasoning', 'ai', 6, 'Systems that verify, plan and reason over long horizons.', ['agents'], ['ai', 'compute'], undefined, '+10% research speed'),
  // ---------------------------------------------------------- COMPUTING --
  N('cpu1', 'CPU Architecture', 'computing', 1, 'Pipelines, caches and instruction sets.', [], ['compute'], ['cpu', 'laptop']),
  N('cpu2', 'Multicore & Superscalar CPUs', 'computing', 3, 'Wide cores, many threads, aggressive speculation.', ['cpu1', 'chipdesign1'], ['compute']),
  N('cpu3', 'Chiplet Architectures', 'computing', 5, 'Modular dies stitched with high-bandwidth interconnects.', ['cpu2', 'fab2'], ['compute', 'mfg']),
  N('gpu1', 'GPU Architecture', 'computing', 1, 'Massively parallel shader and compute cores.', [], ['gfx', 'compute'], ['gpu']),
  N('gfx1', 'Real-time Graphics', 'computing', 1, 'Rasterisation pipelines and game-ready rendering.', [], ['gfx']),
  N('gpu2', 'Tensor Cores & Ray Tracing', 'computing', 3, 'Dedicated matrix and ray-intersection hardware.', ['gpu1', 'dl'], ['gfx', 'ai']),
  N('gpu3', 'Unified Compute Fabric', 'computing', 5, 'Coherent multi-GPU memory and scheduling.', ['gpu2', 'mem2'], ['gfx', 'compute']),
  N('mem1', 'Advanced Memory', 'computing', 2, 'High-density DRAM and flash controllers.', ['cpu1'], ['mem']),
  N('mem2', 'Stacked HBM Memory', 'computing', 4, 'Through-silicon-via stacks with enormous bandwidth.', ['mem1', 'fab1'], ['mem', 'compute']),
  N('dist', 'Distributed Computing', 'computing', 3, 'Consensus, sharding and fault-tolerant clusters.', ['cloud1'], ['compute', 'net']),
  N('edge', 'Edge Computing', 'computing', 4, 'Compute pushed next to the user for latency and privacy.', ['dist', 'net2'], ['net', 'compute']),
  N('neuro', 'Neuromorphic Computing', 'computing', 5, 'Spiking-neuron hardware with brain-like efficiency.', ['mem2', 'dl'], ['compute', 'ai', 'mem']),
  N('quantum', 'Quantum Computing', 'computing', 6, 'Error-corrected qubits solving classically intractable problems.', ['cpu3', 'crypto2'], ['compute'], undefined, 'Unlocks quantum-era cloud tiers'),
  // ----------------------------------------------------------- SOFTWARE --
  N('web', 'Web Platforms', 'software', 1, 'Browsers, HTTP services and modern web stacks.', [], ['soft', 'net'], ['social', 'search', 'streaming', 'marketplace']),
  N('lang1', 'Programming Languages', 'software', 1, 'Safer, faster languages and tooling.', [], ['soft'], ['devplatform']),
  N('ui1', 'UI Frameworks', 'software', 1, 'Component toolkits and polished interaction design.', [], ['ux']),
  N('gameengine', 'Game Engines', 'software', 1, 'Physics, scripting and asset pipelines for interactive worlds.', ['lang1'], ['gfx', 'soft'], ['game']),
  N('os1', 'Operating Systems', 'software', 2, 'Kernels, schedulers, drivers and app frameworks.', ['lang1'], ['soft', 'ux'], ['os']),
  N('db1', 'Database Engines', 'software', 2, 'Transactional storage, indexing and query planning.', ['lang1'], ['soft', 'mem'], ['database']),
  N('cloud1', 'Cloud Infrastructure', 'software', 2, 'Virtualised compute, storage and networking on demand.', ['web', 'lang1'], ['net', 'soft'], ['cloud']),
  N('lang2', 'Modern Compilers', 'software', 3, 'Optimising compilers, JITs and verified toolchains.', ['lang1'], ['soft', 'compute']),
  N('ux2', 'Design Systems & HCI', 'software', 3, 'Research-led interface design and accessibility.', ['ui1'], ['ux']),
  N('cloud2', 'Cloud-Native & Serverless', 'software', 4, 'Containers, orchestration and elastic functions.', ['cloud1', 'lang2'], ['net', 'soft']),
  N('db2', 'Vector & Distributed Databases', 'software', 4, 'Planet-scale storage with semantic retrieval.', ['db1', 'dist'], ['soft', 'mem', 'ai']),
  N('os2', 'Secure Microkernel OS', 'software', 4, 'Formally verified isolation for critical systems.', ['os1', 'lang2'], ['soft', 'sec']),
  N('crypto1', 'Encryption & Cryptography', 'software', 1, 'Modern ciphers, key exchange and signatures.', [], ['sec'], ['security']),
  N('cyber2', 'Zero-Trust Security', 'software', 3, 'Continuous verification of every identity and device.', ['crypto1'], ['sec', 'net']),
  N('cyber3', 'AI Threat Detection', 'software', 4, 'Behavioural models that catch intrusions in real time.', ['cyber2', 'dl'], ['sec', 'ai']),
  N('crypto2', 'Post-Quantum Cryptography', 'software', 5, 'Algorithms that survive a quantum adversary.', ['cyber2', 'lang2'], ['sec']),
  N('payrails1', 'Payment Rails', 'software', 1, 'Settlement, fraud scoring and card-network integration.', ['crypto1'], ['soft', 'sec'], ['payment']),
  N('recsys1', 'Recommendation Systems', 'software', 1, 'Personalisation engines that drive engagement.', ['ml1'], ['ai', 'soft']),
  // ----------------------------------------------------------- HARDWARE --
  N('sens1', 'Sensors & Cameras', 'hardware', 1, 'Image sensors, MEMS and biometrics.', [], ['sens'], ['watch']),
  N('disp1', 'Display Technology', 'hardware', 1, 'LCD and OLED panels with fine pixel control.', [], ['disp'], ['tablet']),
  N('batt1', 'Battery Technology', 'hardware', 1, 'Lithium-ion cells and power management.', [], ['batt'], ['ev']),
  N('mobilesoc', 'Mobile SoC Design', 'hardware', 2, 'Power-efficient systems-on-chip for handheld devices.', ['cpu1'], ['compute', 'batt'], ['smartphone']),
  N('chipdesign1', 'Chip Design', 'hardware', 1, 'RTL, verification and physical design flow.', [], ['compute', 'mfg']),
  N('mfgauto1', 'Manufacturing Automation', 'hardware', 1, 'Robotic lines, vision inspection and lean production.', [], ['mfg', 'bot']),
  N('net1', 'Wireless Networking', 'hardware', 1, 'Wi-Fi, Bluetooth and cellular radios.', [], ['net']),
  N('fab1', 'Semiconductor Fabrication', 'hardware', 2, 'Cleanroom processes down to tens of nanometres.', ['chipdesign1', 'mfgauto1'], ['mfg', 'compute'], undefined, 'Enables Semiconductor Fabs'),
  N('sens2', 'Computational Photography', 'hardware', 3, 'Multi-frame fusion and AI imaging pipelines.', ['sens1', 'cv'], ['sens', 'ai']),
  N('disp2', 'MicroLED Displays', 'hardware', 3, 'Self-emissive pixels with superb brightness and life.', ['disp1'], ['disp']),
  N('batt2', 'Fast-Charge Li-Ion', 'hardware', 3, 'Silicon anodes and ultra-fast charging.', ['batt1'], ['batt']),
  N('net2', '5G Networks', 'hardware', 3, 'Low-latency, high-throughput mobile networks.', ['net1'], ['net']),
  N('chipdesign2', 'AI-Assisted Chip Design', 'hardware', 3, 'Machine-learned floorplanning and verification.', ['chipdesign1', 'ml1'], ['compute', 'ai', 'mfg']),
  N('arvr', 'AR/VR Headsets', 'hardware', 4, 'Immersive wearable displays with inside-out tracking.', ['disp2', 'sens2'], ['disp', 'sens', 'ux']),
  N('fab2', 'EUV Lithography', 'hardware', 4, 'Extreme-ultraviolet patterning for leading-edge nodes.', ['fab1', 'chipdesign2'], ['mfg', 'compute']),
  N('mfgauto2', 'Lights-Out Factories', 'hardware', 4, 'Fully autonomous production lines.', ['mfgauto1', 'robotai'], ['mfg', 'bot']),
  N('sens3', 'LiDAR & Radar Fusion', 'hardware', 4, 'Dense 3-D perception for machines.', ['sens2'], ['sens']),
  N('batt3', 'Solid-State Batteries', 'hardware', 5, 'Dense, safe, fast-charging solid electrolytes.', ['batt2', 'fab1'], ['batt']),
  N('disp3', 'Flexible & Holographic Displays', 'hardware', 5, 'Foldable, rollable and light-field panels.', ['disp2'], ['disp', 'ux']),
  N('net3', '6G & Satellite Mesh', 'hardware', 5, 'Orbital and terrestrial integrated networking.', ['net2', 'edge'], ['net']),
  N('fab3', 'Angstrom-Era Fabrication', 'hardware', 5, 'Gate-all-around transistors and backside power.', ['fab2'], ['mfg', 'compute']),
  // ------------------------------------------------------------- FUTURE ---
  N('superc', 'Room-Temperature Superconductors', 'future', 6, 'Lossless power and ultra-dense magnets.', ['batt3', 'fab3'], ['compute', 'batt']),
  N('advrobotics', 'Advanced Robotics', 'future', 6, 'General-purpose dexterous humanoids.', ['autonomy', 'mfgauto2'], ['bot', 'ai']),
  N('bci', 'Brain-Computer Interfaces', 'future', 6, 'High-bandwidth neural read/write interfaces.', ['neuro', 'sens3'], ['ai', 'sens', 'ux']),
  N('spacecomp', 'Space Computing', 'future', 6, 'Orbital data centres powered by constant sunlight.', ['net3', 'fab2'], ['compute', 'net']),
  N('qnet', 'Quantum Networks', 'future', 7, 'Entanglement-based unbreakable communications.', ['quantum', 'net3'], ['net', 'sec']),
  N('fusion', 'Fusion Technology', 'future', 7, 'Abundant clean power for planetary-scale compute.', ['superc', 'advrobotics'], ['batt', 'mfg']),
  N('agi', 'Artificial General Intelligence', 'future', 7, 'Systems that match or exceed human cognition broadly.', ['reasoning', 'neuro', 'quantum'], ['ai', 'compute'], undefined, '+25% research speed, transforms every industry'),
];
export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(TECH.map(t => [t.id, t]));
export const BRANCHES: { id: TechNode['branch']; name: string; color: string }[] = [
  { id: 'ai', name: 'Artificial Intelligence', color: '#c77dff' }, { id: 'computing', name: 'Computing', color: '#4cc9f0' },
  { id: 'software', name: 'Software', color: '#2ee6a6' }, { id: 'hardware', name: 'Hardware', color: '#ffb703' }, { id: 'future', name: 'Future Technologies', color: '#ff4d6d' },
];
export const TAG_NAMES: Record<Tag, string> = { compute: 'Compute', gfx: 'Graphics', ai: 'AI', mem: 'Memory', disp: 'Display', batt: 'Battery', sens: 'Sensors', sec: 'Security', soft: 'Software', net: 'Networking', mfg: 'Manufacturing', bot: 'Robotics', ux: 'Design/UX' };
/** Max spec level you can design at for a tag, given completed research. */
export function specCap(done: Record<string, number>, tag: Tag): number {
  let n = 0; for (const id in done) { const t = TECH_BY_ID[id]; if (t && t.tags.includes(tag)) n++; }
  return Math.min(10, 4 + n);
}
