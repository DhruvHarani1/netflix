# Tech Tycoon — Architecture & Module Contract

Stack: Vite + TypeScript, no UI framework.  Simulation (`src/sim`) is pure TS and never touches the DOM;
UI (`src/ui`) renders HTML strings from `GameState` and dispatches player actions into the sim.

## Layout
- `src/sim/types.ts`    — the ENTIRE state model (plain JSON, saved verbatim).
- `src/sim/util.ts`     — seeded RNG on state (`rnd(s)`), math, dates, signal bus (`toast`, `sfx`), `empOutput`.
- `src/sim/ledger.ts`   — ALL cash movement goes through here (keeps balance sheet balanced). Never mutate `s.fin.cash` directly.
- `src/sim/engine.ts`   — `tick(s)` advances one day, calling every module in fixed order.
- `src/sim/<module>.ts` — domain modules. Each exports `init(s)`, `daily(s)`, `monthly(s)` plus its player *actions*.
- `src/data/*`          — static tables (regions, segments, depts, categories, tech tree).
- `src/ui/app.ts`       — shell (nav, topbar, loop). `src/ui/kit.ts` — formatting + HTML helpers. `src/ui/charts.ts` — canvas charts.
- `src/ui/views/*.ts`   — one file per screen; each calls `registerView()` and `registerActions()` at import time.

## Module ownership (who writes what)
| module | owner of state | provides |
|---|---|---|
| people | `s.people`, `s.derived.dept/payroll/headcount/officeCap/service/rpPerDay` | hiring, interviews, salaries, training, reviews, quits, layoffs, conflicts |
| research | `s.research` | tech tree progress, patents, breakthroughs, failures |
| facilities | `s.facilities`, `derived.mfgCap/dcCap/labBonus/testBonus/happinessBonus` | build/rent/buy/upgrade/sell |
| finance | `s.fin`, `derived.valuation/mcap/revYr/profitYr/growth` | loans, VC, equity, dividends, statements, valuation, insolvency |
| stock | `s.stock` | IPO, daily price, earnings, indices, analysts, trading rivals' shares |
| ma | `s.ma` | acquisitions, hostile takeovers, subsidiaries, selling |
| rivals | `s.rivals` | competitor AI (monthly decisions) |
| marketing | `s.marketing`, `derived.brand` | campaigns, awareness, reputation, loyalty |
| expansion | `s.regions` | international offices, regional HQs, distribution, partners |
| events | `s.events` | random events w/ choices, news feed |
| legal | `s.legal`, `derived.complianceRisk` | compliance, policies, cases, investigations |
| ecosystem | `derived.ecosystem` | synergy graph, lock-in, network effects |
| achievements | `s.meta`, `derived.stage` | stages, missions, achievements |
| market (core) | `s.market` | customer simulation, sales of every offering |
| products (core) | `s.products` | product workflow |

## Daily order (engine.ts)
people → research → facilities → products → marketing → expansion → ecosystem → market(sales) → finance → stock → rivals → events → legal → achievements.
Monthly hooks fire on the 1st of each month (after daily).

## Rules
1. All cash through `ledger.ts`. `Assets = Liabilities + Equity` is unit-tested.
2. Randomness only through `rnd(s)` etc. (deterministic per seed).
3. State is JSON only. Event choices are stored as `{tpl, params}` and resolved by lookup.
4. Sim emits UI feedback via `toast()`/`sfx()`; news via `addNews()` (events.ts) — other modules may call it.
5. Money is in dollars; time is days; dept output in "effective person-days".
