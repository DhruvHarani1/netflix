# TECH TYCOON

> Found a technology company in 2026 and grow it into a trillion-dollar empire.

A deep, fully simulated business-strategy game that runs entirely in the browser (no server, no account, no assets to download).
Every number on screen comes from a deterministic simulation: hiring changes payroll, products consume budget and time,
research unlocks capabilities, rivals are living companies that react to you, and the stock market prices all of it.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (hot reload)
# — or a production build —
npm run build        # type-checks, then bundles to ./dist
npm run preview      # http://localhost:4173
```

Requires Node 18+. Progress is stored in your browser (`localStorage`); there are 5 manual slots + an autosave slot,
and you can export/import a save as a `.json` file from the save/load dialog.

### Other scripts
```bash
npm test             # 38 vitest tests: ledger invariants, every module, a 12-year autoplay bot
npm run typecheck
```
`scripts/smoke.cjs` and `scripts/e2e.cjs` are Playwright drivers that click through the real UI
(`NODE_PATH=$(npm root -g) node scripts/e2e.cjs http://localhost:4173 /tmp/out`).

## Controls

| Key | Action |
|---|---|
| `Space` | pause / resume |
| `1` `2` `3` `4` | speed 1× / 2× / 5× / 10× |
| `Esc` | close dialog / open pause menu |
| `Ctrl/Cmd + S` | save to the active slot |

Everything else is mouse-driven. Time pauses automatically when a decision event needs you (Settings → *Pause on decisions*).

## How to play (the 10-minute version)

1. **Create your company** — name, logo, brand colour, HQ city, one of 16 specialisations, difficulty (Easy → Nightmare, or Sandbox) and starting capital.
2. **People** — hire engineers and a researcher. Interview candidates to reveal their true skill, negotiate salary, appoint department leaders.
3. **Products** — design a product (22 categories). Pick a target segment, set spec levels (capped by your research), fund it, assign a team,
   test it, price it, launch it. Quality is the result of your choices *and* execution — nothing succeeds by magic.
4. **Research** — queue technologies. They raise spec ceilings, unlock new product categories, grant patents and can fail or break through.
5. **Marketing** — awareness gates who can even buy from you. Premium customers punish discount advertising.
6. **Finance** — payroll is paid daily. Take loans, raise venture capital, IPO, pay dividends, buy back stock. Run out of cash for 45 days and you are bankrupt.
7. **World & M&A** — open regional offices and distribution, then buy startups and rivals, integrate them and reap (or regret) the synergies.
8. **Ecosystem** — products that reinforce each other create lock-in competitors struggle to copy.

## Implemented systems

| Area | What's in it |
|---|---|
| **Simulation core** | Deterministic seeded RNG, daily tick (1–10× speed), monthly rollups, double-entry ledger (assets = liabilities + equity is unit-tested), JSON-only state → save/load is exact |
| **Company creation** | Identity (name/slogan/founder/logo/colour/HQ), 16 specialisations with distinct starting tech & perks, 5 difficulties, 5 capital setups |
| **Dashboard** | KPIs, 8 live charts (revenue, expenses, P&L, valuation, stock, share, cash-flow, headcount), objectives, decisions, news, rival activity, opportunities |
| **Products** | 22 categories, 6–8 specs each, workflow: design → develop → prototype review → QA testing → price → launch → reviews → updates/patches/retire; budgets, team assignment, bugs, outsourcing vs. own plants |
| **Market** | 7 customer segments × 7 regions, softmax choice model over price/performance/brand/innovation/reliability/service/ecosystem, awareness gating, word-of-mouth ramp, seasonality, economic cycle, factory/data-centre capacity, churn, reviews & satisfaction |
| **Research** | 69-node tree in 5 branches, prerequisites, costs, duration, failures, breakthroughs, patents + licensing income, lab slots, budget boost |
| **People** | 12 departments, individuals and teams, interviews, negotiation, promotion, raises, training, performance, resignations, poaching & counter-offers, conflicts, layoffs, leadership vs. skill, pay & perks policy |
| **Facilities** | Offices, HQ, labs, data centres, factories, fabs, warehouses, test facilities, campuses; rent vs. buy vs. outsource, build time, 7 upgrade tracks, depreciation |
| **Finance** | Income statement, balance sheet, cash-flow statement, ratios, loans/bonds, VC rounds with dilution, equity sales, dividends, buybacks, tax with loss carry-forward, credit score, insolvency & bankruptcy |
| **Stock market** | IPO wizard with demand model, daily prices, earnings surprises, analysts, institutional/retail split, sentiment, tech index, candlestick/line charts with periods, trade rival shares, portfolio P&L |
| **Rivals** | 10 major companies with personalities + a churning pool of startups. They develop products, change prices (and respond to you), enter markets, raise money, acquire startups, go bankrupt |
| **Marketing** | 8 channels, per-segment fit matrix, campaigns with budgets, PR actions, awareness/reputation/loyalty/positioning |
| **Global expansion** | Interactive dot-matrix world map, 7 regions with distinct economics, offices, regional HQs, distribution, partnerships, subsidiaries |
| **M&A** | Valuations, friendly offers with counter-offers, hostile takeovers via stake-building, subsidiaries with integration, culture fit, synergies, impairment, sell/spin-off |
| **Events & news** | 39 event templates with consequences and choices, macro cycle (boom → recession), news terminal |
| **Legal** | 8 compliance tracks, 7 policy toggles, lawsuits/investigations with fight/settle, regulatory heat |
| **Ecosystem** | Synergy graph, lock-in, cross-sell, platform network effects, developer adoption, recommendations |
| **Progression** | 6 stages, 34 achievements, 18 missions, 6 challenges, 12 CEO perks |
| **Meta** | Save slots + autosave, export/import, settings, synthesised sound, reduced-motion / large-text / high-contrast |

## Architecture

```
src/
  sim/        pure TypeScript simulation — never touches the DOM
    types.ts      the whole state model (plain JSON)      ledger.ts   every cash movement
    engine.ts     daily/monthly tick orchestration        util.ts     RNG, dates, signals
    market.ts     customer choice model                   products.ts product workflow
    people.ts research.ts facilities.ts finance.ts stock.ts ma.ts rivals.ts marketing.ts
    expansion.ts events.ts legal.ts ecosystem.ts achievements.ts save.ts state.ts
  data/       static tables: categories, tech tree, regions, segments, events, rivals…
  ui/         HTML-string views + event delegation (no framework), canvas charts, synth audio
    views/        one file per screen (+ css)
tests/        vitest: unit + 12-year autoplay bot
docs/         ARCHITECTURE.md, CONTRACTS.md (module contracts)
```
Design rules: simulation and rendering are separate; all randomness flows through one seeded generator stored in the save;
every module exports `init / daily / monthly` plus its player actions; the UI never mutates state except through those actions.

## Known limitations / honest notes

- **Balance is tuned, not final.** Early game (first product ~month 12, $0.3 M/mo in year 2) feels right in autoplay tests;
  late-game growth for an optimal player is steep (a bot can reach trillion-dollar valuation in ~10–12 game-years).
  Constants in `market.ts` (`TEMP`, `OUTSIDE`, `AW_EXP`, `rampCap`) and `data/categories.ts` are the main knobs.
- Some legal policy side-effects described in the UI (e.g. "−10 % social revenue") only change compliance/reputation/cost, not revenue directly.
- CEO perks are mostly applied in events/achievements; not every module consults `perkMult`.
- Rival acquisitions transfer products/staff but not the target's cash.
- No multiplayer, no localisation, no mobile-optimised touch UX (layout is responsive but the game is built for mouse + keyboard).
- Audio is synthesised (no music).
- Saves live in `localStorage` (compressed). Clearing site data deletes them — use *Export file* for backups.

## Ideas for next iterations
Deeper supply-chain/commodity simulation, an antitrust review step on acquisitions, custom scenarios & scripted historical eras,
shareholder activism and board politics, richer product-specific events (recalls, viral moments), a music score, accessibility audit, mobile layout.
