import type { GameState, HistPoint } from './types';
import { dateOf, isMonthStart, isYearStart } from './util';
import { closeMonth, closeYear } from './ledger';
import * as people from './people';
import * as research from './research';
import * as facilities from './facilities';
import * as products from './products';
import * as marketing from './marketing';
import * as expansion from './expansion';
import * as ecosystem from './ecosystem';
import * as market from './market';
import * as finance from './finance';
import * as stock from './stock';
import * as ma from './ma';
import * as rivals from './rivals';
import * as events from './events';
import * as legal from './legal';
import * as achievements from './achievements';

export const MODULES = { people, research, facilities, products, marketing, expansion, ecosystem, market, finance, stock, ma, rivals, events, legal, achievements };

/** Advance the world by exactly one day. */
export function tick(s: GameState): void {
  if (s.gameOver) return;
  s.day++;
  people.daily(s); research.daily(s); facilities.daily(s); products.daily(s); marketing.daily(s); expansion.daily(s);
  ecosystem.daily(s); market.daily(s); finance.daily(s); stock.daily(s); ma.daily(s); rivals.daily(s); events.daily(s); legal.daily(s); achievements.daily(s);
  if (isMonthStart(s.day)) {
    closeMonth(s); // ledger.last = month that just ended
    people.monthly(s); research.monthly(s); facilities.monthly(s); products.monthly(s); marketing.monthly(s); expansion.monthly(s);
    ecosystem.monthly(s); market.monthly(s); finance.monthly(s); stock.monthly(s); ma.monthly(s); rivals.monthly(s); events.monthly(s); legal.monthly(s); achievements.monthly(s);
    recordHistory(s);
    if (isYearStart(s.day)) closeYear(s);
  }
}
export function advance(s: GameState, days: number) { for (let i = 0; i < days && !s.gameOver; i++) tick(s); }

function recordHistory(s: GameState) {
  const L = s.fin.ledger.last; const d = s.derived;
  let users = 0; for (const p of s.products) if (p.status === 'live') users += p.base;
  const exp = L.cogs + Object.values(L.exp).reduce((a, b) => a + b, 0);
  const hp: HistPoint = {
    day: s.day, rev: L.rev, exp, ni: L.ni, cash: s.fin.cash, val: d.valuation, px: s.stock.px, share: d.marketShare, emp: d.headcount,
    rep: s.marketing.reputation, cfo: L.cfo, debt: s.fin.loans.reduce((a, l) => a + l.principal, 0), products: s.products.filter(p => p.status === 'live').length, users,
  };
  s.hist.push(hp); if (s.hist.length > 600) s.hist.shift();
}
