import type { CatId, Personality, RegionId } from '../sim/types';

export interface RivalCatSpec { dq: number; pm?: number; svc?: number; share: number }
export interface MajorSpec {
  id: string; name: string; short: string; color: string; logo: number; hq: RegionId; archetype: string; blurb: string;
  pers: Personality; strengths: string[]; weaknesses: string[];
  val: number; px: number; heads: number; brand: number; reach: number; rdPct: number; founded: number;
  cats: Partial<Record<CatId, RivalCatSpec>>;
}
const P = (aggr: number, caution: number, innov: number, premium: number, expand: number, acquis: number, marketing: number, pr: number): Personality => ({ aggr, caution, innov, premium, expand, acquis, marketing, pr });

export const MAJORS: MajorSpec[] = [
  { id: 'neuronet', name: 'Neuronet', short: 'Neuronet', color: '#c77dff', logo: 5, hq: 'na', archetype: 'Aggressive AI Lab', blurb: 'Ships fast, burns cash and treats every month as a race. Wants to own the AI stack end to end.',
    pers: P(.9, .2, .95, .3, .8, .6, .6, .3), strengths: ['Frontier AI research', 'Talent magnet', 'Rapid release cadence'], weaknesses: ['Cash burn', 'Reliability issues', 'Weak enterprise support'],
    val: 180e9, px: 142, heads: 9000, brand: 66, reach: .7, rdPct: .32, founded: 2016,
    cats: { assistant: { dq: 12, pm: 1.15, svc: 50, share: .22 }, aimodel: { dq: 14, pm: 1.1, svc: 45, share: .26 }, cloud: { dq: -8, pm: .9, svc: 50, share: .02 }, search: { dq: -4, pm: 1, share: .03 } } },
  { id: 'ironwell', name: 'Ironwell Corporation', short: 'Ironwell', color: '#8d99ae', logo: 3, hq: 'eu', archetype: 'Conservative Hardware Maker', blurb: 'A century of engineering discipline. Reliable, expensive to dislodge, slow to change.',
    pers: P(.2, .9, .35, .25, .3, .3, .35, .5), strengths: ['Reliability', 'Enterprise & government trust', 'Deep manufacturing'], weaknesses: ['Slow innovation', 'Dated design', 'Bureaucracy'],
    val: 95e9, px: 88, heads: 60000, brand: 62, reach: .85, rdPct: .08, founded: 1957,
    cats: { laptop: { dq: 4, pm: 1.15, svc: 75, share: .15 }, tablet: { dq: -4, pm: 1.0, svc: 70, share: .05 }, cpu: { dq: -6, pm: 1.05, share: .06 }, desktopapp: { dq: 2, pm: 1.1, share: .08 }, os: { dq: 0, pm: 1, share: .05 } } },
  { id: 'aurelia', name: 'Aurelia', short: 'Aurelia', color: '#f4d58d', logo: 11, hq: 'na', archetype: 'Premium Consumer Electronics', blurb: 'Design-led ecosystem that sells aspiration. Customers pay more and rarely leave.',
    pers: P(.35, .6, .7, .95, .5, .4, .9, .8), strengths: ['Brand halo', 'Ecosystem lock-in', 'Industrial design'], weaknesses: ['Premium pricing excludes budget buyers', 'Closed platform', 'Supply concentration'],
    val: 900e9, px: 215, heads: 150000, brand: 90, reach: .85, rdPct: .12, founded: 1998,
    cats: { smartphone: { dq: 14, pm: 1, svc: 80, share: .2 }, tablet: { dq: 12, pm: 1, svc: 78, share: .3 }, watch: { dq: 14, pm: 1, svc: 78, share: .4 }, laptop: { dq: 10, pm: 1, svc: 75, share: .1 }, os: { dq: 8, pm: 1, share: .12 }, streaming: { dq: 2, pm: 1, share: .06 }, marketplace: { dq: 4, pm: 1, share: .12 }, payment: { dq: 4, pm: 1, share: .14 } } },
  { id: 'kestrel', name: 'Kestrel Mobile', short: 'Kestrel', color: '#ff7a00', logo: 7, hq: 'as', archetype: 'Low-Cost Mass Market', blurb: 'Razor-thin margins and enormous volume. If a product can be made cheaper, Kestrel will.',
    pers: P(.75, .4, .45, -.85, .7, .5, .7, .2), strengths: ['Cost leadership', 'Massive distribution', 'Supply chain mastery'], weaknesses: ['Thin margins', 'Quality perception', 'Weak brand outside emerging markets'],
    val: 120e9, px: 31, heads: 110000, brand: 52, reach: .9, rdPct: .05, founded: 2005,
    cats: { smartphone: { dq: -6, pm: 1, svc: 50, share: .22 }, tablet: { dq: -8, pm: 1, share: .16 }, watch: { dq: -8, pm: 1, share: .18 }, laptop: { dq: -8, pm: 1, share: .12 } } },
  { id: 'stratus', name: 'Stratus Cloud', short: 'Stratus', color: '#4cc9f0', logo: 4, hq: 'na', archetype: 'Dominant Cloud Provider', blurb: 'The default home of enterprise workloads. Scale, uptime and a sprawling partner network.',
    pers: P(.5, .6, .6, .5, .6, .8, .5, .6), strengths: ['Scale economics', 'Enterprise relationships', 'Developer ecosystem'], weaknesses: ['Complex pricing', 'Antitrust scrutiny', 'Consumer weakness'],
    val: 700e9, px: 178, heads: 120000, brand: 78, reach: .92, rdPct: .14, founded: 2006,
    cats: { cloud: { dq: 14, pm: 1.1, svc: 78, share: .4 }, database: { dq: 10, pm: 1.05, share: .3 }, security: { dq: 4, pm: 1, share: .1 }, devplatform: { dq: 8, pm: 1, share: .28 }, aimodel: { dq: 4, pm: 1, share: .12 } } },
  { id: 'silicium', name: 'Silicium Corp', short: 'Silicium', color: '#2ee6a6', logo: 1, hq: 'as', archetype: 'Semiconductor Giant', blurb: 'Fabs, IP and a decade-long roadmap. Everyone in tech depends on its silicon.',
    pers: P(.55, .7, .75, .6, .35, .45, .35, .4), strengths: ['Process leadership', 'Patent portfolio', 'Foundry scale'], weaknesses: ['Capex-heavy', 'Geopolitical exposure', 'Cyclical demand'],
    val: 450e9, px: 120, heads: 80000, brand: 68, reach: .9, rdPct: .2, founded: 1983,
    cats: { cpu: { dq: 16, pm: 1.1, share: .45 }, gpu: { dq: 14, pm: 1.15, share: .5 } } },
  { id: 'pixelforge', name: 'Pixelforge Interactive', short: 'Pixelforge', color: '#ff4d6d', logo: 9, hq: 'eu', archetype: 'Gaming & Media Studio', blurb: 'Hit-driven studio with a loyal community and a growing streaming arm.',
    pers: P(.5, .4, .8, .4, .6, .55, .85, .5), strengths: ['Beloved franchises', 'Community', 'Creative talent'], weaknesses: ['Hit-or-miss releases', 'Crunch culture', 'Platform dependence'],
    val: 60e9, px: 54, heads: 22000, brand: 74, reach: .8, rdPct: .18, founded: 2002,
    cats: { game: { dq: 14, pm: 1.1, share: .12 }, streaming: { dq: -2, pm: .95, share: .05 } } },
  { id: 'aegis', name: 'Aegis Cyber', short: 'Aegis', color: '#6ea8ff', logo: 2, hq: 'me', archetype: 'Security Specialist', blurb: 'Trusted by governments and banks. Obsessive about threat intelligence.',
    pers: P(.3, .8, .65, .55, .35, .55, .3, .7), strengths: ['Government contracts', 'Threat intel', 'Compliance credentials'], weaknesses: ['Narrow portfolio', 'Clunky UX', 'Smaller sales force'],
    val: 40e9, px: 96, heads: 14000, brand: 64, reach: .7, rdPct: .17, founded: 2003,
    cats: { security: { dq: 16, pm: 1.15, svc: 80, share: .2 }, cloud: { dq: -10, pm: .95, share: .01 } } },
  { id: 'voltra', name: 'Voltra Motors', short: 'Voltra', color: '#90be6d', logo: 8, hq: 'na', archetype: 'EV & Autonomy Maker', blurb: 'Electric cars as rolling computers. Charismatic leadership and relentless ambition.',
    pers: P(.7, .3, .85, .55, .75, .35, .75, .25), strengths: ['Battery tech', 'Autonomy data', 'Charging network'], weaknesses: ['Quality control', 'Production ramps', 'Regulatory attention'],
    val: 350e9, px: 260, heads: 90000, brand: 76, reach: .75, rdPct: .1, founded: 2003,
    cats: { ev: { dq: 14, pm: 1.05, svc: 62, share: .18 }, robot: { dq: -4, pm: 1, share: .04 } } },
  { id: 'hivemind', name: 'Hivemind', short: 'Hivemind', color: '#f15bb5', logo: 0, hq: 'na', archetype: 'Social & Search Giant', blurb: 'Attention is the product. Billions of users, an ad machine and a data moat.',
    pers: P(.6, .45, .6, .35, .7, .85, .8, .45), strengths: ['Network effects', 'Data advantage', 'Ad revenue engine'], weaknesses: ['Privacy scandals', 'Antitrust heat', 'Hardware weakness'],
    val: 800e9, px: 190, heads: 100000, brand: 84, reach: .95, rdPct: .15, founded: 2004,
    cats: { social: { dq: 12, pm: 1, share: .35 }, search: { dq: 14, pm: 1, share: .4 }, marketplace: { dq: 0, pm: 1, share: .06 }, assistant: { dq: 2, pm: 1, share: .1 }, streaming: { dq: 0, pm: 1, share: .08 } } },
];

export const PRODUCT_LINE: Record<CatId, string> = {
  smartphone: 'Phone', laptop: 'Book', tablet: 'Pad', watch: 'Watch', ev: 'Drive', robot: 'Bot', cpu: 'Core', gpu: 'Vision', os: 'OS', desktopapp: 'Suite', game: 'Quest',
  assistant: 'Mind', aimodel: 'Model', cloud: 'Cloud', database: 'DB', security: 'Shield', devplatform: 'Dev', social: 'Social', search: 'Search', streaming: 'Stream', payment: 'Pay', marketplace: 'Market',
};
export const VARIANTS = ['', '', 'Pro', 'Max', 'Ultra', 'X', 'S', 'Plus'];

export interface StartupTpl { cat: CatId; blurb: string; tech: string[] }
export const STARTUP_TPL: StartupTpl[] = [
  { cat: 'assistant', blurb: 'Voice-first AI companion with uncanny memory', tech: ['nlp', 'nn', 'dl'] },
  { cat: 'aimodel', blurb: 'Small, efficient foundation models', tech: ['nn', 'dl', 'llm'] },
  { cat: 'security', blurb: 'Behavioural threat detection', tech: ['cyber2', 'cyber3'] },
  { cat: 'database', blurb: 'Vector-native database engine', tech: ['db2', 'dist'] },
  { cat: 'watch', blurb: 'Medical-grade wearable sensors', tech: ['sens2', 'cv'] },
  { cat: 'robot', blurb: 'Dexterous warehouse robots', tech: ['robotai', 'mfgauto2'] },
  { cat: 'ev', blurb: 'Solid-state battery vehicles', tech: ['batt2', 'batt3'] },
  { cat: 'gpu', blurb: 'Open-architecture AI accelerators', tech: ['gpu2', 'chipdesign2'] },
  { cat: 'game', blurb: 'Genre-defining indie studio', tech: ['gfx1', 'ux2'] },
  { cat: 'social', blurb: 'Creator-first short-video network', tech: ['recsys1', 'nlp'] },
  { cat: 'payment', blurb: 'Instant cross-border payments', tech: ['crypto2', 'cyber2'] },
  { cat: 'cloud', blurb: 'Edge-native serverless platform', tech: ['cloud2', 'edge'] },
  { cat: 'devplatform', blurb: 'AI pair-programming toolchain', tech: ['lang2', 'agents'] },
  { cat: 'cpu', blurb: 'Neuromorphic processor design', tech: ['neuro', 'cpu2'] },
  { cat: 'tablet', blurb: 'Foldable display tablets', tech: ['disp2', 'disp3'] },
  { cat: 'search', blurb: 'Private answer engine', tech: ['nlp', 'llm'] },
];
export const SYL_A = ['Zen', 'Lyra', 'Quo', 'Vanta', 'Ori', 'Kai', 'Mira', 'Nexa', 'Flux', 'Sola', 'Axi', 'Pry', 'Tera', 'Evo', 'Luma', 'Bryo', 'Cora', 'Dyna', 'Ethos', 'Fenn'];
export const SYL_B = ['ly', 'ra', 'on', 'ix', 'ware', 'mind', 'grid', 'loop', 'forge', 'io', 'labs', 'bit', 'spark', 'wave', 'ify'];
