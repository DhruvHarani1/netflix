# Cross-module contracts (READ BEFORE WRITING YOUR MODULE)

Shared files you may NOT restructure: `src/sim/types.ts` (you may ADD optional fields to your own slice interface via small Edits), `src/sim/ledger.ts`, `src/sim/util.ts`,
`src/sim/engine.ts`, `src/sim/state.ts`, `src/ui/app.ts`, `src/ui/kit.ts`, `src/ui/charts.ts`, `src/styles.css`.
Put view-specific CSS in `src/ui/views/<view>.css` and `import './<view>.css'` from your view file.
Do not `git commit` — the orchestrator commits. Keep `npx tsc --noEmit` clean for YOUR files.

## Money
Every cash movement MUST use `ledger.ts` helpers: `revenue`, `expense(s, amt, key)`, `capex`, `saleOfAsset`, `investIn`, `divest`, `markInvest`, `acquireBusiness`, `saleOfBusiness`, `borrow`, `repayPrincipal`, `issueEquity`, `buyback`, `dividend`, `depreciate`. Never write `s.fin.cash` directly. Invariant (unit-tested): `cash + ppe + goodwill + invest == Σ loans.principal + paidIn + retained`.
Expense keys: salaries, rent, rnd, marketing, cogs, legal, training, dev, facilities, interest, tax, other, fees, dep, hiring, integration.

## Time
`s.day` = days since 2026-01-01. engine.tick increments day then calls each module's `daily(s)`; on the 1st of a month it calls `closeMonth` (so `ledger.last` = month just ended) then each `monthly(s)`. Costs charged in `monthly` go to the NEW month. Player pays salaries DAILY (people.daily), rent monthly (facilities.monthly), interest monthly (finance.monthly), tax monthly on last month's profit (finance.monthly).
Use `dateOf`, `isMonthStart`, `isQuarterStart`, `fmtDate` from util. Use `rnd(s)`/`chance`/`pick`/`gauss` for ALL randomness.

## Who owns what derived values (recompute in your daily/monthly)
- people: `derived.dept[d]` {heads, output (Σ empOutput of staff in dept), avgHappy, avgSkill, leader, eff, payroll}, `derived.payroll` (monthly cost incl. benefits), `derived.headcount`, `derived.rpPerDay` (research points/day), `derived.service` (0-100 support quality: support output vs customer load = Σ live product `base` + units; formula: `service = clamp(35 + 55*tanh(supportOutput*3000 / (1+customers)) )` roughly, but must be sane at low customer counts), `derived.officeCap` set by facilities.
- facilities: `derived.officeCap` (sum of capacity of office/hq/campus), `mfgCap` (hardware units/month from owned factories/fabs), `dcCap` (service capacity: abstract units where a live service product needs `base*loadPerUser`), `labBonus` (research mult), `testBonus` (testing speed/bug mult), `happinessBonus`.
- finance: `derived.valuation`, `derived.mcap`, `derived.revYr`, `derived.profitYr`, `derived.growth` (YoY revenue growth fraction).
- marketing: `s.marketing.awareness[seg]`, `reputation`, `loyalty`, `positioning`, `derived.brand`.
- ecosystem: `derived.ecosystem {score 0-100, lockin 0-1, net[cat] bonus 0..0.3 demand multiplier, devAdoption 0-100, links}`.
- legal: `legal.compliance[k]` 0-100, `derived.complianceRisk` (0.5..2 multiplier on bad-event probability).
- achievements: `derived.stage` (1-6), `meta.*`.
- market (core, orchestrator-owned): `market.cats[*]`, `derived.marketShare`, accumulates `rival.revM/costM`, writes `offer.unitsEma/revEma/base`, product sales (`product.base/unitsEma/revEma/lifeRev`), calls `revenue(s,…,'products')` & `expense(…, 'cogs')` for the player's sales and `'subsidiaries'` revenue for acquired subs.
- products (core, orchestrator-owned): product workflow. People assigned to a product have `employee.project = product.id` (people module must leave this field alone except clearing when an employee leaves).

## How the market reads your state (so your numbers matter)
Player offer availability in region r = `regions[r].presence/100` (expansion module moves presence toward a target each day; HQ region starts ~35).
Brand attribute for segment g = 0.5*`marketing.reputation` + 0.5*`marketing.awareness[g]`. Service attr = `derived.service`. Ecosystem attr uses `derived.ecosystem.score` and per-category `net[cat]`.
Rival offer availability = `rival.reach` (0..1) (×1.3 in its HQ region); rival brand = `rival.brand`; rival quality fields q/rel/inn/ux/svc and `price` come from `rival.offers[cat]`. Market writes `offer.unitsEma`/`revEma` (per-day EMAs, α=1/30) so monthly revenue ≈ `revEma*30`. Rivals module owns everything else about rivals (quality growth, pricing, new launches, cash, headcount, valuation, bankruptcy, startups).
Subsidiaries (`s.ma.subs[].offers`) behave like rival offers but revenue goes to the player.
Category market: `market.cats[cat].size` (annual units; or NEW subscribers/yr for subscription cats), `ref` (reference price), `avgQ` (avg quality), `frontierQ`. Cats unlocked when all `CAT[cat].req` techs are in `research.done` (market sets `.unlocked` monthly; research module may also read `TECH[].unlocks`).

## UI conventions
- A view file calls `registerView({id,title,icon,group,render,mount?,badge?})` and `registerActions({...})` (data-act handlers: `(el)=>void`, read args from `el.dataset`). After an action runs the shell re-renders automatically. Text inputs: use `data-input="name"` + `registerInputs`; they update draft state in `ui.sel[...]` WITHOUT re-render. Selects/checkboxes: `data-change="actionName"`.
- Sim state is `S()` (from `ui/state`). UI-only state lives in `ui.sel[viewId]` / `ui.tab`. Use `tabs()`, `panel()`, `kpi()`, `table()`, `bar()`, `badge()`, `btn()` from `kit.ts`; charts via `chart(id, ()=>cfg, height)` from `charts.ts` (they are drawn automatically after render).
- Modals: `app.openModal(id, ()=>html, wide?)`, `app.closeModal()`, `app.confirm(title, body, onOk)`. Modal render fn is re-invoked on every refresh so it can read live state.
- Feedback: sim code calls `toast(text, tone, sfx?)` and `addNews(...)`, UI actions call `app.toast`. Every action that fails must explain WHY (toast with tone 'warn'/'bad').
- Design language: dark premium (Bloomberg × Apple). Each major screen should have its own personality but use the same tokens (`--accent`, `--good`, `--bad`, `--panel`, etc.). No placeholder/fake data — every number must come from state.
- Debug in browser: `window.__tt = {G, ui, tick, S, newGame, startGame, app, advance}`; e.g. `__tt.startGame(__tt.newGame({name:'T',slogan:'',founder:'F',color:'#4cc9f0',logo:0,hq:'na',city:'Austin',spec:'software',difficulty:'normal',capitalId:'seed'}))` then `__tt.ui.paused=false`.
