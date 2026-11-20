// ============================================================================
// TECH TYCOON — shared type contract.  ALL simulation state is plain JSON
// (no classes, no functions, no Maps) so that saving = JSON.stringify(state).
// Each domain module owns a slice of state (see the "OWNER" comments).
// ============================================================================

export type Seg = 'budget' | 'mainstream' | 'premium' | 'enterprise' | 'government' | 'developer' | 'education';
export type RegionId = 'na' | 'sa' | 'eu' | 'as' | 'af' | 'me' | 'oc';
export type CatId =
  | 'smartphone' | 'laptop' | 'os' | 'desktopapp' | 'game' | 'assistant' | 'aimodel' | 'gpu' | 'cpu'
  | 'cloud' | 'database' | 'security' | 'watch' | 'tablet' | 'ev' | 'robot' | 'social' | 'search'
  | 'streaming' | 'payment' | 'marketplace' | 'devplatform';
export type Dept = 'eng' | 'pm' | 'research' | 'marketing' | 'sales' | 'finance' | 'hr' | 'mfg' | 'support' | 'legal' | 'security' | 'ops';
export type Tag = 'compute' | 'gfx' | 'ai' | 'mem' | 'disp' | 'batt' | 'sens' | 'sec' | 'soft' | 'net' | 'mfg' | 'bot' | 'ux';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare' | 'sandbox';
export type SpecId =
  | 'software' | 'ai' | 'electronics' | 'smartphones' | 'semis' | 'gaming' | 'cloud' | 'cyber' | 'robotics'
  | 'auto' | 'biotech' | 'space' | 'telecom' | 'ecom' | 'social' | 'fintech';
export type ExpKey =
  | 'salaries' | 'rent' | 'rnd' | 'marketing' | 'cogs' | 'legal' | 'training' | 'dev' | 'facilities'
  | 'interest' | 'tax' | 'other' | 'fees' | 'dep' | 'hiring' | 'integration';
export type RevKey = 'products' | 'subsidiaries' | 'licensing' | 'other';
export type ComplianceKey = 'privacy' | 'safety' | 'antitrust' | 'employment' | 'environment' | 'cyber' | 'trade' | 'ip';

// ---------------------------------------------------------------- CORE -----
export interface Company {
  name: string; slogan: string; founder: string; color: string; logo: number;
  hq: RegionId; city: string; spec: SpecId; startDay: number;
  ceo: { level: number; xp: number; perkPoints: number; perks: string[] };
}

export interface Loan { id: number; name: string; principal: number; rate: number /*annual*/; monthly: number /*min payment*/; kind: 'bank' | 'bond' | 'credit' | 'emergency'; taken: number }

// -------------------------------------------------------------- LEDGER ----
export interface Period {
  rev: number; revBy: Record<string, number>; cogs: number; exp: Record<string, number>;
  gains: number /*non-operating gains(+)/losses(-)*/; ni: number;
  cfo: number; cfi: number; cff: number; capex: number; dep: number;
  dividends: number; buybacks: number; equityRaised: number; debtNet: number;
}
export interface Ledger {
  // balance sheet non-cash lines (book values).  cash lives in FinState.cash
  ppe: number; goodwill: number; invest: number; paidIn: number; retained: number;
  m: Period;       // current month accumulators
  y: Period;       // current calendar-year accumulators
  last: Period;    // last completed month
  nol: number;     // tax loss carry-forward
  hist: Period[];  // completed months (capped 240)
}
export interface FinState {
  cash: number; loans: Loan[]; ledger: Ledger; nextLoanId: number;
  shares: number;            // total shares outstanding (incl. founder / investors)
  founderShares: number;     // shares held by founder
  treasury: number;          // shares repurchased & held
  rounds: { name: string; day: number; raised: number; pct: number; post: number }[];
  creditScore: number;       // 300-850
  insolventDays: number; bankrupt: boolean;
  dividendPerShare: number;  // quarterly, 0 = none
  buybackActive: boolean;
  lastTaxMonthNI: number;
}

// -------------------------------------------------------------- PEOPLE ----
export interface Employee {
  id: number; name: string; dept: Dept; title: string;
  level: number;               // 0 junior,1 mid,2 senior,3 lead,4 director/VP
  salary: number;              // annual per head
  skill: number; mgmt: number; exp: number /*years*/; prod: number /*0.6-1.4*/;
  happy: number; motiv: number; loyalty: number; // 0-100
  edu: string; spec: Tag | 'general'; heads: number; // heads>1 = a team of N people with averaged stats
  traits: string[]; hired: number; project: number | null; // product id they work on
  trainUntil: number; lastReview: number; leader: boolean; // is department head
  notes?: string; baseProd?: number; rating?: number; wantsRaise?: boolean; trainKind?: string; conflictWith?: number;
}
export interface Candidate extends Omit<Employee, 'project' | 'trainUntil' | 'lastReview' | 'leader' | 'hired'> {
  ask: number; interviewed: boolean; estSkill: number; expires: number; poached?: boolean; fromRival?: string;
}
export interface PeopleState { emps: Employee[]; pool: Candidate[]; nextId: number; conflicts: { id: number; a: number; b: number; day: number }[]; policy: { wage: number /*0.8-1.4 pay stance*/; perks: number /*0-3*/; remote: boolean }; morale?: number /*temporary company-wide penalty, decays*/; poach?: { id: number; empId: number; rival: string; offer: number; deadline: number }[]; hist?: { day: number; heads: number }[] }

// ------------------------------------------------------------ RESEARCH ----
export interface TechNode {
  id: string; name: string; branch: 'ai' | 'computing' | 'software' | 'hardware' | 'future' | 'applied';
  tier: number; desc: string; cost: number; rp: number; req: string[]; tags: Tag[]; unlocks?: CatId[]; perk?: string; fail: number;
}
export interface ResearchProject { id: string; progress: number /*rp done*/; paid: number; setbacks: number; started: number }
export interface ResearchState {
  done: Record<string, number>;      // techId -> day completed
  active: ResearchProject[]; slots: number;
  patents: { id: number; tech: string; day: number; name: string; value: number }[];
  breakthroughs: number; failures: number; budgetBoost: number; // 0..2 extra spend multiplier on speed
  log: { day: number; text: string; kind: 'ok' | 'fail' | 'bt' }[];
}

// ----------------------------------------------------------- FACILITIES ---
export type FacKind = 'office' | 'hq' | 'lab' | 'datacenter' | 'factory' | 'fab' | 'warehouse' | 'testing' | 'campus';
export interface Facility {
  id: number; kind: FacKind; name: string; region: RegionId; level: number; own: boolean;
  built: number; // day
  upg: { capacity: number; compute: number; security: number; amenities: number; energy: number; equipment: number; automation: number };
  buildUntil: number; // day when construction completes (0 = ready)
  value: number; // book value if owned
}

// ------------------------------------------------------------- PRODUCTS ---
export interface Review { day: number; stars: number; who: Seg | 'press'; text: string }
export interface Product {
  id: number; name: string; cat: CatId; version: number;
  status: 'dev' | 'prototype' | 'testing' | 'ready' | 'live' | 'retired';
  specs: Record<string, number>; target: Seg; budget: number; spent: number;
  progress: number /*dev points done*/; need: number /*dev points needed*/; testProg: number; testNeed: number;
  bugs: number /*0-100 latent bugs*/; q: number; rel: number; inn: number; ux: number; // 0-100
  price: number; ucost: number; startDay: number; launchDay: number; lifeRev: number; lifeUnits: number;
  base: number /*subscribers/installed*/; unitsEma: number; revEma: number; satisf: number; rating: number;
  reviews: Review[]; hist: { day: number; units: number; rev: number; base: number }[];
  outsource: boolean; promo: number /*product-specific hype 0-100*/; protoNote: string; updating: boolean; lastUpdate: number;
  sold30: number; lost30: number /*lost sales from capacity*/; platformUsers: number; devBuzz: number;
  teamSkill: number; stalled: boolean; pendingSpecs?: Record<string, number>; qaSpent: number; rushed: boolean; budgetRatio: number; note?: string; rampLimited?: boolean; rampCap?: number;
}

// ------------------------------------------------------------- MARKETING --
export type Channel = 'tv' | 'social' | 'influencer' | 'search' | 'sponsor' | 'event' | 'pr' | 'global';
export interface Campaign { id: number; channel: Channel; budget: number /*per month*/; start: number; end: number; product: number | null; region: RegionId | 'all'; name: string }
export interface MarketingState {
  campaigns: Campaign[]; nextId: number;
  awareness: Record<Seg, number>;     // 0-100 brand awareness by segment
  reputation: number;                 // 0-100 overall
  loyalty: number;                    // 0-100
  positioning: number;                // -1 budget ... +1 premium (derived from prices/campaigns)
  history: { day: number; awareness: number; reputation: number }[];
}

// -------------------------------------------------------------- REGIONS ---
export interface RegionState {
  id: RegionId; presence: number /*0-100 effective market access*/; office: 0 | 1 | 2 /*none,intl office,regional HQ*/;
  distribution: boolean; partner: boolean; subsidiary: boolean; since: number; target: number; revenueEma: number;
  regulationRisk: number; // 0-100
}

// ------------------------------------------------------------- COMPETITORS -
export interface Personality { aggr: number; caution: number; innov: number; premium: number /*-1..1 pricing*/; expand: number; acquis: number; marketing: number; pr: number }
export interface RivalOffer {
  name: string; q: number; rel: number; inn: number; ux: number; svc: number; price: number;
  since: number; lastLaunch: number; unitsEma: number; revEma: number; base: number; focus: number /*0-1 R&D focus*/;
}
export interface Rival {
  id: string; name: string; short: string; color: string; logo: number; kind: 'major' | 'startup';
  archetype: string; blurb: string; hq: RegionId; personality: Personality;
  status: 'active' | 'bankrupt' | 'acquired'; acquiredBy?: string; founded: number;
  cash: number; debt: number; headcount: number; rd: number /*monthly spend*/; brand: number; reach: number; // 0-1
  offers: Partial<Record<CatId, RivalOffer>>;
  revM: number; costM: number; netM: number; revEma: number; costEma: number; revHist: number[]; netHist: number[];
  shares: number; px: number; pxHist: number[]; // weekly closes
  valuation: number; sentiment: number; growth: number; publicCo: boolean;
  log: { day: number; text: string; kind: 'launch' | 'price' | 'expand' | 'cash' | 'ma' | 'hire' | 'rd' | 'marketing' | 'crisis' | 'respond' }[];
  strengths: string[]; weaknesses: string[]; relation: number /*-100..100 attitude toward player*/;
  techGrant?: string; // startups: acquiring grants this tech
  negative: number; // months of negative cash
  founderOwned: number; // fraction of shares not on open market (control)
  forSale: boolean; askMult: number; takeoverShield?: number;
}

// ------------------------------------------------------------ MARKET -------
export interface CatMarket {
  size: number; growth: number; ref: number; trend: number /*-1..1 buzz*/; avgQ: number; frontierQ: number;
  rev30: number; units30: number; shares: Record<string, number>; // owner -> revenue share 0..1 ("player","gen",rivalId)
  playerShare: number; unlocked: boolean; saturation: number;
}
export interface Econ { cycle: 'boom' | 'normal' | 'slowdown' | 'recession'; cycleDays: number; gdp: number; confidence: number; rate: number; inflation: number; demandMult: number; unemployment: number }
export interface MarketState { cats: Record<CatId, CatMarket>; econ: Econ; year: number }

// -------------------------------------------------------------- STOCK ------
export interface StockState {
  public: boolean; px: number; pxHist: number[]; /* daily closes since IPO (player) */ ipoDay: number; ipoPx: number;
  sentiment: number; // market sentiment 0-100 (fear..greed)
  fair: number; analysts: { buy: number; hold: number; sell: number; target: number };
  inst: number; retail: number; // % ownership of float
  index: number[]; // tech index weekly closes (starts 1000)
  indexDay: number[];
  portfolio: Record<string, { shares: number; cost: number }>; // rival id -> holding by player
  nextEarnings: number; lastSurprise: number; expectedEPS: number; lastEPS: number;
  volume: number; hi52: number; lo52: number; shortInterest: number;
}

// ---------------------------------------------------------- M&A ------------
export interface Subsidiary {
  id: string; name: string; color: string; fromRival: string; cats: CatId[]; offers: Partial<Record<CatId, RivalOffer>>;
  headcount: number; costM: number; revEma: number; integration: number /*0-1 progress*/; integrationCost: number;
  bookValue: number; acquired: number; synergy: number; culture: number /*0-100 culture fit*/; techGranted?: string; reach: number; brand: number;
  region: RegionId; revHist: number[];
}
export interface MAOffer { id: number; rivalId: string; price: number; premium: number; kind: 'friendly' | 'hostile' | 'merger'; status: 'open' | 'accepted' | 'rejected' | 'countered'; counter?: number; day: number; note: string }
export interface MAState { subs: Subsidiary[]; offers: MAOffer[]; nextOfferId: number; history: { day: number; text: string }[] }

// ------------------------------------------------------------- EVENTS ------
export interface GameEvent {
  uid: number; tpl: string; day: number; deadline: number; title: string; body: string;
  params: Record<string, any>; choices: { label: string; hint: string }[]; defaultChoice: number; resolved: boolean; picked?: number; outcome?: string; severity: 'good' | 'bad' | 'neutral'; icon: string;
}
export interface NewsItem { id: number; day: number; headline: string; body: string; kind: 'market' | 'company' | 'rival' | 'tech' | 'law' | 'world' | 'finance' | 'people'; tone: 'good' | 'bad' | 'neutral'; rival?: string }
export interface EventState { pending: GameEvent[]; log: GameEvent[]; nextUid: number; cooldown: Record<string, number>; news: NewsItem[]; nextNews: number; flags: Record<string, any> }

// -------------------------------------------------------------- LEGAL ------
export interface LegalCase { id: number; kind: string; title: string; opp: string; day: number; ends: number; exposure: number; status: 'open' | 'won' | 'lost' | 'settled'; desc: string; product?: number; stance?: 'fight' | 'default'; fee?: number; outcome?: string; cat?: CatId }
export interface LegalState {
  compliance: Record<ComplianceKey, number>; policies: Record<string, boolean>; cases: LegalCase[]; nextId: number;
  fines: number; boost?: Record<string, number>; fineHist?: { day: number; amount: number; text: string }[]; watch: number; /*regulatory heat 0-100*/ investigations: { kind: string; day: number; ends: number; cat?: CatId }[];
}

// ---------------------------------------------------------- ACHIEVEMENTS ---
export interface Mission { id: string; title: string; desc: string; goal: string; reward: string; done: boolean; day: number; claimed: boolean }
export interface MetaState { ach: Record<string, number>; missions: Mission[]; stage: number; stageDay: Record<number, number>; peak: { valuation: number; revenue: number; cash: number }; challengeDone: Record<string, boolean>; stats: Record<string, number> }

// ----------------------------------------------------------- DERIVED -------
export interface DeptDerived { heads: number; output: number; avgHappy: number; avgSkill: number; leader: number | null; eff: number; payroll: number }
export interface Derived {
  dept: Record<Dept, DeptDerived>;            // OWNER people: recomputed daily
  payroll: number /*monthly total incl. benefits*/; headcount: number; officeCap: number; rpPerDay: number;
  service: number;                             // 0-100 customer-support quality   (OWNER people)
  mfgCap: number /*units/month*/; dcCap: number /*service load units*/; labBonus: number; testBonus: number; happinessBonus: number; // OWNER facilities
  ecosystem: { score: number; lockin: number; net: Partial<Record<CatId, number>>; devAdoption: number; links: number }; // OWNER ecosystem
  brand: number /*0-100 blended*/;            // OWNER marketing
  valuation: number; mcap: number; stage: number; marketShare: number; revYr: number; profitYr: number; growth: number; // OWNER finance
  complianceRisk: number;                      // OWNER legal: 0..1 risk multiplier on bad events
  rivalPressure: number;
}

// ------------------------------------------------------------- HISTORY -----
export interface HistPoint {
  day: number; rev: number; exp: number; ni: number; cash: number; val: number; px: number; share: number; emp: number;
  rep: number; cfo: number; debt: number; products: number; users: number;
}

// -------------------------------------------------------------- ROOT -------
export interface GameState {
  v: number; seed: number; rng: number; day: number;
  mode: 'normal' | 'sandbox'; difficulty: Difficulty;
  co: Company; fin: FinState; people: PeopleState; research: ResearchState; facilities: Facility[]; nextFacId: number;
  products: Product[]; nextProdId: number; marketing: MarketingState; regions: Record<RegionId, RegionState>;
  rivals: Rival[]; market: MarketState; stock: StockState; ma: MAState; events: EventState; legal: LegalState; meta: MetaState;
  derived: Derived; hist: HistPoint[]; log: { day: number; text: string; tone: 'good' | 'bad' | 'neutral' | 'info' }[];
  gameOver: null | { reason: string; day: number }; cheats: boolean; sandboxCash: boolean;
  flags: Record<string, any>;
}

// Notification emitted to UI/audio layer (not saved)
export type SfxName = 'click' | 'success' | 'error' | 'notify' | 'launch' | 'achievement' | 'cash' | 'research' | 'warn' | 'hire' | 'tick';
export interface Signal { type: 'toast' | 'sfx' | 'modal'; text?: string; tone?: 'good' | 'bad' | 'neutral' | 'info' | 'warn'; sfx?: SfxName; ref?: string }
