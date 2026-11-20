import type { RegionId, Seg, Dept, Difficulty, SpecId, Tag, CatId, ComplianceKey } from '../sim/types';

export const SEGS: Seg[] = ['budget', 'mainstream', 'premium', 'enterprise', 'government', 'developer', 'education'];
export interface SegDef { id: Seg; name: string; icon: string; blurb: string; priceMult: number; w: { price: number; perf: number; brand: number; inn: number; rel: number; svc: number; eco: number }; mediaFit: Record<string, number> }
export const SEG: Record<Seg, SegDef> = {
  budget:     { id: 'budget', name: 'Budget Consumers', icon: '🏷️', blurb: 'Price is everything. Loyal to deals, not brands.', priceMult: 0.62, w: { price: .46, perf: .14, brand: .05, inn: .04, rel: .15, svc: .06, eco: .10 }, mediaFit: { tv: .8, social: 1, influencer: 1.2, search: .9, sponsor: .3, event: .2, pr: .4, global: .8 } },
  mainstream: { id: 'mainstream', name: 'Mainstream Consumers', icon: '👥', blurb: 'Balanced buyers who want good value from names they trust.', priceMult: 1.0, w: { price: .26, perf: .2, brand: .16, inn: .08, rel: .12, svc: .08, eco: .10 }, mediaFit: { tv: 1.2, social: 1, influencer: 1, search: .8, sponsor: .8, event: .6, pr: .8, global: 1 } },
  premium:    { id: 'premium', name: 'Premium Consumers', icon: '💎', blurb: 'Pay more for design, status and cutting-edge. Allergic to discount marketing.', priceMult: 1.9, w: { price: .06, perf: .22, brand: .24, inn: .18, rel: .08, svc: .08, eco: .14 }, mediaFit: { tv: .7, social: .5, influencer: -.4, search: .2, sponsor: 1.3, event: 1.5, pr: 1.2, global: 1.1 } },
  enterprise: { id: 'enterprise', name: 'Enterprise', icon: '🏢', blurb: 'Reliability, security and support drive multi-year contracts.', priceMult: 1.7, w: { price: .10, perf: .14, brand: .10, inn: .04, rel: .24, svc: .20, eco: .18 }, mediaFit: { tv: .1, social: .15, influencer: -.2, search: 1, sponsor: .6, event: 1.2, pr: 1, global: .5 } },
  government: { id: 'government', name: 'Government', icon: '🏛️', blurb: 'Slow, conservative, compliance-obsessed — and enormous budgets.', priceMult: 1.4, w: { price: .14, perf: .08, brand: .14, inn: .02, rel: .26, svc: .20, eco: .16 }, mediaFit: { tv: .2, social: 0, influencer: -.4, search: .6, sponsor: .5, event: .8, pr: 1.4, global: .6 } },
  developer:  { id: 'developer', name: 'Developers', icon: '⌨️', blurb: 'Value openness, performance and ecosystem. Opinionated and vocal.', priceMult: 1.2, w: { price: .12, perf: .26, brand: .06, inn: .20, rel: .12, svc: .06, eco: .18 }, mediaFit: { tv: -.2, social: .8, influencer: .6, search: 1.2, sponsor: .5, event: 1.3, pr: .5, global: .4 } },
  education:  { id: 'education', name: 'Education', icon: '🎓', blurb: 'Tight budgets, long cycles, huge volume, great for future loyalty.', priceMult: 0.72, w: { price: .34, perf: .12, brand: .10, inn: .04, rel: .18, svc: .12, eco: .10 }, mediaFit: { tv: .4, social: .6, influencer: .3, search: .7, sponsor: .9, event: .6, pr: 1, global: .5 } },
};

export interface RegionDef { id: RegionId; name: string; short: string; pop: number /*demand weight*/; power: number /*purchasing power idx*/; labor: number; tax: number; regulation: number; infra: number; competition: number; premiumBias: number; blurb: string; officeCost: number; color: string }
export const REGIONS: RegionDef[] = [
  { id: 'na', name: 'North America', short: 'NA', pop: .25, power: 1.35, labor: 1.4, tax: .24, regulation: .55, infra: .95, competition: .85, premiumBias: .25, blurb: 'Deep capital markets, premium buyers, fierce competition.', officeCost: 180000, color: '#4cc9f0' },
  { id: 'sa', name: 'South America', short: 'SA', pop: .07, power: .62, labor: .55, tax: .30, regulation: .45, infra: .6, competition: .45, premiumBias: -.15, blurb: 'Fast-growing mobile-first consumers with price sensitivity.', officeCost: 70000, color: '#80ed99' },
  { id: 'eu', name: 'Europe', short: 'EU', pop: .22, power: 1.2, labor: 1.2, tax: .27, regulation: .9, infra: .92, competition: .75, premiumBias: .15, blurb: 'Rich, regulated markets with strict privacy and antitrust regimes.', officeCost: 160000, color: '#a29bfe' },
  { id: 'as', name: 'Asia', short: 'AS', pop: .34, power: .85, labor: .7, tax: .22, regulation: .55, infra: .85, competition: .95, premiumBias: 0, blurb: 'The largest market and the manufacturing heartland — brutally competitive.', officeCost: 110000, color: '#ff7675' },
  { id: 'af', name: 'Africa', short: 'AF', pop: .05, power: .38, labor: .35, tax: .25, regulation: .4, infra: .4, competition: .25, premiumBias: -.3, blurb: 'Young population, leapfrog adoption, thin infrastructure.', officeCost: 50000, color: '#fdcb6e' },
  { id: 'me', name: 'Middle East', short: 'ME', pop: .035, power: 1.05, labor: .8, tax: .08, regulation: .4, infra: .75, competition: .35, premiumBias: .35, blurb: 'Sovereign wealth, low tax and appetite for flagship tech projects.', officeCost: 90000, color: '#e17055' },
  { id: 'oc', name: 'Oceania', short: 'OC', pop: .035, power: 1.3, labor: 1.2, tax: .28, regulation: .6, infra: .9, competition: .4, premiumBias: .2, blurb: 'Small but wealthy, early-adopter markets.', officeCost: 100000, color: '#55efc4' },
];
export const REGION: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map(r => [r.id, r])) as any;
export const CITIES: Record<RegionId, string[]> = {
  na: ['San Francisco', 'Austin', 'Seattle', 'New York', 'Toronto', 'Boston'], sa: ['São Paulo', 'Buenos Aires', 'Santiago', 'Bogotá'],
  eu: ['London', 'Berlin', 'Stockholm', 'Paris', 'Amsterdam', 'Zurich', 'Tallinn'], as: ['Shenzhen', 'Tokyo', 'Bangalore', 'Singapore', 'Seoul', 'Taipei'],
  af: ['Lagos', 'Nairobi', 'Cape Town', 'Cairo'], me: ['Dubai', 'Tel Aviv', 'Riyadh', 'Doha'], oc: ['Sydney', 'Melbourne', 'Auckland'],
};

export interface DeptDef { id: Dept; name: string; icon: string; blurb: string; baseSalary: number; titles: string[]; tag: Tag | 'general' }
export const DEPTS: DeptDef[] = [
  { id: 'eng', name: 'Engineering', icon: '🛠️', blurb: 'Builds and ships product code & hardware designs.', baseSalary: 95000, titles: ['Junior Engineer', 'Software Engineer', 'Senior Engineer', 'Staff Engineer', 'VP Engineering'], tag: 'soft' },
  { id: 'pm', name: 'Product Management', icon: '🧭', blurb: 'Specs, roadmaps and product-market fit; boosts UX & quality.', baseSalary: 105000, titles: ['Associate PM', 'Product Manager', 'Senior PM', 'Group PM', 'Chief Product Officer'], tag: 'ux' },
  { id: 'research', name: 'Research', icon: '🔬', blurb: 'Scientists driving the technology tree and patents.', baseSalary: 120000, titles: ['Research Assistant', 'Research Scientist', 'Senior Scientist', 'Principal Scientist', 'Chief Scientist'], tag: 'ai' },
  { id: 'marketing', name: 'Marketing', icon: '📣', blurb: 'Amplifies campaigns and brand-building.', baseSalary: 80000, titles: ['Marketing Associate', 'Marketing Manager', 'Senior Marketer', 'Head of Brand', 'CMO'], tag: 'general' },
  { id: 'sales', name: 'Sales', icon: '🤝', blurb: 'Enterprise & government deals, channel conversion.', baseSalary: 78000, titles: ['Sales Rep', 'Account Executive', 'Senior AE', 'Sales Director', 'Chief Revenue Officer'], tag: 'general' },
  { id: 'finance', name: 'Finance', icon: '💹', blurb: 'Treasury, tax optimisation and investor relations.', baseSalary: 90000, titles: ['Analyst', 'Accountant', 'Senior Analyst', 'Controller', 'CFO'], tag: 'general' },
  { id: 'hr', name: 'Human Resources', icon: '🫂', blurb: 'Recruiting, retention and culture.', baseSalary: 72000, titles: ['HR Coordinator', 'Recruiter', 'HR Business Partner', 'Head of People', 'CHRO'], tag: 'general' },
  { id: 'mfg', name: 'Manufacturing', icon: '🏭', blurb: 'Hardware production engineering and supply chain.', baseSalary: 68000, titles: ['Technician', 'Process Engineer', 'Senior Process Eng.', 'Plant Manager', 'VP Manufacturing'], tag: 'mfg' },
  { id: 'support', name: 'Customer Support', icon: '🎧', blurb: 'Keeps customers happy; drives satisfaction & retention.', baseSalary: 52000, titles: ['Support Agent', 'Support Specialist', 'Senior Specialist', 'Support Manager', 'Head of Customer Success'], tag: 'general' },
  { id: 'legal', name: 'Legal', icon: '⚖️', blurb: 'Patents, compliance and litigation defence.', baseSalary: 130000, titles: ['Paralegal', 'Counsel', 'Senior Counsel', 'Deputy GC', 'General Counsel'], tag: 'general' },
  { id: 'security', name: 'Cybersecurity', icon: '🛡️', blurb: 'Defends against breaches and ensures cyber compliance.', baseSalary: 110000, titles: ['Security Analyst', 'Security Engineer', 'Senior Security Eng.', 'Security Architect', 'CISO'], tag: 'sec' },
  { id: 'ops', name: 'Operations', icon: '⚙️', blurb: 'Facilities, logistics and overhead efficiency.', baseSalary: 70000, titles: ['Ops Associate', 'Ops Analyst', 'Senior Ops', 'Ops Director', 'COO'], tag: 'general' },
];
export const DEPT: Record<Dept, DeptDef> = Object.fromEntries(DEPTS.map(d => [d.id, d])) as any;
export const LEVEL_NAMES = ['Junior', 'Mid-level', 'Senior', 'Lead', 'Director'];

export interface DiffDef { id: Difficulty; name: string; blurb: string; capital: number; cost: number; rival: number; event: number; demand: number; rate: number; loanAccess: number; talent: number }
export const DIFFS: DiffDef[] = [
  { id: 'easy', name: 'Easy', blurb: 'Generous funding, soft rivals, forgiving markets.', capital: 1.5, cost: .85, rival: .75, event: .7, demand: 1.2, rate: -.01, loanAccess: 1.5, talent: 1.2 },
  { id: 'normal', name: 'Normal', blurb: 'The intended experience. Fair but unforgiving.', capital: 1, cost: 1, rival: 1, event: 1, demand: 1, rate: 0, loanAccess: 1, talent: 1 },
  { id: 'hard', name: 'Hard', blurb: 'Aggressive rivals, expensive talent, expensive money.', capital: .8, cost: 1.15, rival: 1.25, event: 1.2, demand: .9, rate: .015, loanAccess: .7, talent: .9 },
  { id: 'nightmare', name: 'Nightmare', blurb: 'Predatory competitors and recession-prone markets. Good luck.', capital: .6, cost: 1.3, rival: 1.6, event: 1.5, demand: .8, rate: .03, loanAccess: .5, talent: .8 },
  { id: 'sandbox', name: 'Sandbox', blurb: 'Unlimited funds, no bankruptcy. Build freely.', capital: 5, cost: .9, rival: .8, event: .8, demand: 1.1, rate: 0, loanAccess: 3, talent: 1.3 },
];
export const DIFF: Record<Difficulty, DiffDef> = Object.fromEntries(DIFFS.map(d => [d.id, d])) as any;

export const CAPITALS = [
  { id: 'bootstrap', name: 'Bootstrapped', amount: 250_000, blurb: 'Garage startup. Tiny team, no safety net.', emp: 2, debt: 0, rep: 0 },
  { id: 'seed', name: 'Seed Funded', amount: 1_000_000, blurb: 'Friends, family and a small angel round. Room to move.', emp: 4, debt: 0, rep: 2 },
  { id: 'series', name: 'Series A Backed', amount: 5_000_000, blurb: 'VC cash, a real team — and investors who expect growth.', emp: 8, debt: 0, rep: 5 },
  { id: 'founder', name: 'Serial Founder', amount: 15_000_000, blurb: 'A previous exit funds you. Press attention and high expectations.', emp: 14, debt: 0, rep: 10 },
  { id: 'loan', name: 'Leveraged Launch', amount: 4_000_000, blurb: 'Bank-financed with a heavy loan. Cash now, interest forever.', emp: 8, debt: 3_000_000, rep: 0 },
];

export const BRAND_COLORS = ['#4cc9f0', '#7c5cff', '#ff4d6d', '#2ee6a6', '#ffb703', '#ff7a00', '#e0e1dd', '#00f5d4', '#f15bb5', '#9bf6ff', '#c77dff', '#90be6d'];
export const LOGOS = 12;

export interface SpecDef { id: SpecId; name: string; icon: string; blurb: string; techs: string[]; cats: CatId[]; bonusCats: CatId[]; depts: Dept[]; cashMult?: number; perk: string }
export const SPECIALIZATIONS: SpecDef[] = [
  { id: 'software', name: 'Software', icon: '💾', blurb: 'Apps, tools and operating systems. Low capital, fast cycles.', techs: ['web', 'lang1', 'ui1'], cats: ['desktopapp', 'devplatform'], bonusCats: ['desktopapp', 'os', 'devplatform', 'database'], depts: ['eng', 'pm'], perk: '+12% software quality, cheaper dev tools' },
  { id: 'ai', name: 'Artificial Intelligence', icon: '🧠', blurb: 'Foundation models and assistants. Talent-hungry and compute-hungry.', techs: ['web', 'ml1', 'lang1'], cats: ['assistant'], bonusCats: ['assistant', 'aimodel', 'robot'], depts: ['research', 'eng'], perk: '+12% AI quality, research 10% faster' },
  { id: 'electronics', name: 'Consumer Electronics', icon: '🎧', blurb: 'Gadgets with design flair — tablets, watches, laptops.', techs: ['sens1', 'disp1', 'cpu1'], cats: ['tablet', 'watch'], bonusCats: ['tablet', 'watch', 'laptop', 'smartphone'], depts: ['eng', 'mfg'], perk: '+12% hardware quality, stronger brand starts' },
  { id: 'smartphones', name: 'Smartphones', icon: '📱', blurb: 'The most lucrative consumer market on Earth.', techs: ['sens1', 'disp1', 'mobilesoc', 'cpu1'], cats: ['smartphone'], bonusCats: ['smartphone', 'tablet', 'watch'], depts: ['eng', 'mfg', 'marketing'], cashMult: 1.3, perk: '+12% phone quality; hardware starts cost more' },
  { id: 'semis', name: 'Semiconductors', icon: '🔲', blurb: 'CPUs and GPUs. Capital-intensive, strategically vital.', techs: ['cpu1', 'gpu1', 'chipdesign1'], cats: ['cpu'], bonusCats: ['cpu', 'gpu'], depts: ['eng', 'mfg', 'research'], cashMult: 1.4, perk: '+12% chip quality, 15% cheaper fabs' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', blurb: 'Hit-driven entertainment with passionate communities.', techs: ['web', 'gameengine', 'gfx1'], cats: ['game'], bonusCats: ['game', 'streaming'], depts: ['eng', 'pm', 'marketing'], perk: '+12% game quality, community buzz' },
  { id: 'cloud', name: 'Cloud Computing', icon: '☁️', blurb: 'Infrastructure as a service. Scale is everything.', techs: ['web', 'lang1', 'cloud1'], cats: ['cloud', 'database'], bonusCats: ['cloud', 'database', 'devplatform'], depts: ['eng', 'ops'], perk: '+12% cloud quality, cheaper datacenters' },
  { id: 'cyber', name: 'Cybersecurity', icon: '🔐', blurb: 'Trust is the product. Enterprise and government love it.', techs: ['web', 'lang1', 'crypto1'], cats: ['security'], bonusCats: ['security', 'cloud', 'database'], depts: ['security', 'eng'], perk: '+12% security quality, breach immunity++' },
  { id: 'robotics', name: 'Robotics', icon: '🤖', blurb: 'Machines that act in the world. Long road, huge prize.', techs: ['ml1', 'sens1', 'mfgauto1'], cats: [], bonusCats: ['robot', 'ev'], depts: ['eng', 'research', 'mfg'], perk: '+12% robotics quality; start with automation tech' },
  { id: 'auto', name: 'Automotive Technology', icon: '🚗', blurb: 'Electric vehicles and autonomy. A trillion-dollar industry.', techs: ['batt1', 'sens1', 'mfgauto1'], cats: [], bonusCats: ['ev', 'robot'], depts: ['eng', 'mfg'], cashMult: 1.5, perk: '+12% EV quality; battery research discount' },
  { id: 'biotech', name: 'Biotechnology', icon: '🧬', blurb: 'Computational biology and neural interfaces — a long game.', techs: ['ml1', 'sens1', 'lang1'], cats: ['aimodel'], bonusCats: ['aimodel', 'watch'], depts: ['research'], perk: '+15% research speed, unique long-term tech' },
  { id: 'space', name: 'Space Technology', icon: '🚀', blurb: 'Satellites and orbital computing. Heroic capital needs.', techs: ['sens1', 'net1', 'mfgauto1'], cats: [], bonusCats: ['cloud', 'robot'], depts: ['eng', 'research'], cashMult: 1.5, perk: 'Space-tier research is 25% cheaper' },
  { id: 'telecom', name: 'Telecommunications', icon: '📡', blurb: 'Networks and connected devices.', techs: ['net1', 'sens1', 'cpu1'], cats: ['smartphone'], bonusCats: ['smartphone', 'cloud', 'streaming'], depts: ['eng', 'ops'], perk: '+12% network quality, faster expansion' },
  { id: 'ecom', name: 'E-commerce', icon: '🛒', blurb: 'Marketplaces, logistics and payments at scale.', techs: ['web', 'lang1', 'payrails1'], cats: ['marketplace'], bonusCats: ['marketplace', 'payment', 'search'], depts: ['eng', 'ops', 'sales'], perk: '+12% marketplace quality, cheaper distribution' },
  { id: 'social', name: 'Social Media', icon: '💬', blurb: 'Network effects and attention. Viral or dead.', techs: ['web', 'lang1', 'recsys1'], cats: ['social'], bonusCats: ['social', 'streaming', 'search'], depts: ['eng', 'pm', 'marketing'], perk: '+12% social quality, stronger network effects' },
  { id: 'fintech', name: 'Fintech', icon: '💳', blurb: 'Payments and trust infrastructure.', techs: ['web', 'lang1', 'payrails1', 'crypto1'], cats: ['payment'], bonusCats: ['payment', 'marketplace', 'security'], depts: ['eng', 'finance', 'legal'], perk: '+12% payments quality, cheaper compliance' },
];
export const SPEC: Record<SpecId, SpecDef> = Object.fromEntries(SPECIALIZATIONS.map(s => [s.id, s])) as any;

export const STAGES = [
  { n: 1, name: 'Startup', blurb: 'Limited capital, small office, first product.' },
  { n: 2, name: 'Growing Company', blurb: 'More employees, multiple products, first competitors.' },
  { n: 3, name: 'Established Tech Company', blurb: 'International operations and a strong brand.' },
  { n: 4, name: 'Global Technology Giant', blurb: 'Major market share, public markets, subsidiaries.' },
  { n: 5, name: 'Technology Conglomerate', blurb: 'Global dominance across multiple industries.' },
  { n: 6, name: 'Future Technology Empire', blurb: 'Technologies that reshape civilization.' },
];
export const COMPLIANCE: { id: ComplianceKey; name: string; icon: string; blurb: string }[] = [
  { id: 'privacy', name: 'Data Privacy', icon: '🕶️', blurb: 'GDPR-style rules on user data.' },
  { id: 'safety', name: 'Product Safety', icon: '🦺', blurb: 'Recalls, battery fires and autonomous-system incidents.' },
  { id: 'antitrust', name: 'Antitrust', icon: '🏛️', blurb: 'Scrutiny rises with market dominance.' },
  { id: 'employment', name: 'Employment Law', icon: '👷', blurb: 'Wages, overtime, layoffs and discrimination.' },
  { id: 'environment', name: 'Environmental', icon: '🌱', blurb: 'Emissions, e-waste and energy use.' },
  { id: 'cyber', name: 'Cyber Compliance', icon: '🔒', blurb: 'Breach preparedness and certifications.' },
  { id: 'trade', name: 'Trade & Export', icon: '🚢', blurb: 'Sanctions and chip export controls.' },
  { id: 'ip', name: 'Intellectual Property', icon: '©️', blurb: 'Patents, copyright and licensing exposure.' },
];
export const POLICIES: { id: string; name: string; desc: string; cost: number; effect: string }[] = [
  { id: 'privacyfirst', name: 'Privacy-First Data Policy', desc: 'Minimise data collection. Fewer ad dollars, far fewer lawsuits.', cost: 1, effect: '+privacy, -10% social/search revenue' },
  { id: 'ethicalai', name: 'Responsible AI Board', desc: 'Independent review of AI deployments.', cost: 1, effect: '+safety, +reputation, slower AI launches' },
  { id: 'green', name: 'Carbon-Neutral Operations', desc: 'Green energy & recycling programs.', cost: 1, effect: '+environment, +8% facility costs' },
  { id: 'opensource', name: 'Open-Source Program', desc: 'Contribute to open source.', cost: 1, effect: '+developer goodwill, +IP risk' },
  { id: 'bugbounty', name: 'Bug Bounty Program', desc: 'Pay researchers to find holes first.', cost: 1, effect: '+cyber, lower breach chance' },
  { id: 'fairwork', name: 'Fair Work Charter', desc: 'Wage floors, work-life balance and transparent promotions.', cost: 1, effect: '+employment, +happiness, +payroll' },
  { id: 'lobby', name: 'Government Relations Office', desc: 'Lobbying and regulatory engagement.', cost: 1, effect: '-regulatory heat, +antitrust resilience, costly' },
];
