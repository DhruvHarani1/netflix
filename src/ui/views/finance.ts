import { registerView, registerActions, registerInputs, pageHead, panel, kpi, tabs, curTab, table, bar, badge, btn, money, moneyFull, pct, sgn, empty, scoreColor, app, num } from '../kit';
import { chart } from '../charts';
import { ui, S } from '../state';
import * as fin from '../../sim/finance';
import { fmtMonth } from '../../sim/util';
import type { Period } from '../../sim/types';
import './finance.css';

interface Sel { per: 'm' | 'q' | 'y'; kind: 'bank' | 'bond' | 'credit'; amt: number; years: number; vcPct: number; eq: number; dps: number }
const sel = (): Sel => (ui.sel.fin ||= { per: 'q', kind: 'bank', amt: 250000, years: 5, vcPct: 1, eq: 1_000_000, dps: 0.05 });
const rowCls = (c = '') => `class="${c}"`;

function setDigits(el: HTMLElement | null, t: string) { if (el) el.textContent = t; }

export function renderFinance(): string {
  const s = S(); const r = fin.ratios(s); const tab = curTab('finance', 'overview');
  const crisis = s.fin.cash < 0 ? `<div class="crisis bad">⚠ INSOLVENT — cash is negative for ${s.fin.insolventDays} days. Bankruptcy at 45. Raise funds, sell assets or cut payroll NOW.</div>` : (r.runway < 4 && isFinite(r.runway) ? `<div class="crisis warn">Runway is only ${r.runway.toFixed(1)} months at the current burn. Consider a loan or a funding round.</div>` : '');
  return pageHead('Finance', 'Treasury, statements and capital structure.', badge(`Credit ${s.fin.creditScore}`, s.fin.creditScore > 700 ? 'good' : s.fin.creditScore > 600 ? 'warn' : 'bad')) + crisis +
    tabs('finance', [['overview', 'Overview'], ['income', 'Income Statement'], ['balance', 'Balance Sheet'], ['cash', 'Cash Flow'], ['capital', 'Debt & Capital'], ['invest', 'Investments']], 'overview') +
    (tab === 'overview' ? overview() : tab === 'income' ? income() : tab === 'balance' ? balance() : tab === 'cash' ? cashflow() : tab === 'capital' ? capital() : investments());
}

function overview(): string {
  const s = S(); const r = fin.ratios(s); const L = s.fin.ledger; const h = s.hist.slice(-36); const lbl = h.map(p => fmtMonth(p.day));
  const runway = isFinite(r.runway) ? `${r.runway.toFixed(1)} mo` : '∞';
  return `<div class="kpis mb">${kpi('Cash', money(s.fin.cash), r.burn > 0 ? `Burning ${money(r.burn)}/mo` : 'Cash-flow positive', s.fin.cash < 0 ? 'neg' : '')}${kpi('Runway', runway, 'at last month’s burn')}${kpi('Valuation', money(s.derived.valuation), s.derived.growth ? `${sgn(s.derived.growth * 100, v => v.toFixed(0) + '%')} YoY growth` : 'pre-growth')}${kpi('Revenue (TTM)', money(s.derived.revYr), `Net ${money(s.derived.profitYr)}`)}${kpi('Total debt', money(r.debt), `${s.fin.loans.length} loan(s)`)}${kpi('Founder stake', pct(fin.founderPct(s)), `${(s.fin.shares / 1e6).toFixed(1)}M shares`)}</div>
  <div class="grid g2 mb">${panel('Cash balance & operating cash flow', chart('fin-cash', () => ({ series: [{ name: 'Cash', color: '#4cc9f0', data: h.map(p => p.cash), fill: true }, { name: 'Op. cash flow', color: '#2ee6a6', data: h.map(p => p.cfo) }], labels: lbl, fmt: money }), 210))}
  ${panel('Revenue vs expenses', chart('fin-rev', () => ({ type: 'bar', series: [{ name: 'Revenue', color: '#2ee6a6', data: h.map(p => p.rev) }, { name: 'Expenses', color: '#ff5d73', data: h.map(p => p.exp) }], labels: lbl, fmt: money }), 210))}</div>
  <div class="grid g3">${panel('Key ratios', `${stat('Gross margin', pct(r.grossMargin))}${stat('Operating margin', pct(r.opMargin))}${stat('Net margin', pct(r.netMargin))}${stat('Debt / equity', isFinite(r.debtEquity) ? r.debtEquity.toFixed(2) : '—')}${stat('Interest cover', isFinite(r.interestCover) ? r.interestCover.toFixed(1) + '×' : '—')}${stat('Return on equity', pct(r.roe))}${stat('Liquidity (months of costs)', r.liquidity.toFixed(1))}`)}
  ${panel('Credit health', `<div class="gauge"><b class="num" style="color:${scoreColor((s.fin.creditScore - 300) / 5.5)}">${s.fin.creditScore}</b><small>of 850</small></div>${bar(s.fin.creditScore - 300, 550, scoreColor((s.fin.creditScore - 300) / 5.5), '', 8)}<p class="dim sm mt">Improves with profits, runway and low leverage. Missed payments and insolvency crush it. Loan limit now: ${money(fin.maxLoan(s, 'bank'))} (bank), ${money(fin.maxLoan(s, 'credit'))} (credit line).</p><div class="stat-row"><span>Tax loss carry-forward</span><b class="num">${money(L.nol)}</b></div><div class="stat-row"><span>Effective tax rate</span><b class="num">${pct(fin.taxRate(s))}</b></div>`)}
  ${panel('Debt schedule', s.fin.loans.length ? table(['Loan', 'Principal', 'Rate', 'Monthly'], s.fin.loans.map(l => [l.name, money(l.principal), pct(l.rate), l.monthly ? money(l.monthly) : 'interest only']), '', ['', 'r', 'r', 'r']) : empty('Debt free', 'No outstanding loans.'))}</div>`;
}
const stat = (a: string, b: string) => `<div class="stat-row"><span>${a}</span><b class="num">${b}</b></div>`;

function perSel(): string { const x = sel(); return `<div class="row mb"><span class="dim sm">Period</span>${(['m', 'q', 'y'] as const).map(k => btn({ m: 'Month', q: 'Quarter', y: 'Year' }[k], 'fin-per', { k }, x.per === k ? 'primary sm' : 'sm')).join('')}<span class="dim sm">vs. prior period</span></div>`; }
const chg = (a: number, b: number) => (b === 0 || (a === 0 && b === 0) ? '<span class="dim">—</span>' : `<span class="${a - b >= 0 ? 'pos' : 'neg'}">${((a - b) / Math.abs(b) * 100).toFixed(0)}%</span>`);
function stRow(label: string, cur: number, prev: number, cls = '', indent = false): string {
  return `<tr class="st ${cls}"><td class="${indent ? 'ind' : ''}">${label}</td><td class="r num ${cur < 0 ? 'neg' : ''}">${moneyFull(cur)}</td><td class="r num dim">${moneyFull(prev)}</td><td class="r num">${chg(cur, prev)}</td></tr>`;
}
const EXPN: Record<string, string> = { salaries: 'Salaries & benefits', rent: 'Rent', rnd: 'Research & development', marketing: 'Marketing', legal: 'Legal & compliance', training: 'Training', dev: 'Product development', facilities: 'Facilities & utilities', other: 'Other operating', fees: 'Professional fees', dep: 'Depreciation', hiring: 'Recruiting', integration: 'Integration costs' };
function stTable(rows: string): string { return `<table class="tbl stmt"><thead><tr><th></th><th class="r">Current</th><th class="r">Prior</th><th class="r">Change</th></tr></thead><tbody>${rows}</tbody></table>`; }
function pLabel(): string { const s = S(); const x = sel(); const n = x.per === 'm' ? 1 : x.per === 'q' ? 3 : 12; const h = s.fin.ledger.hist.length; return h ? `${n === 1 ? 'Month' : n === 3 ? 'Quarter' : 'Year'} ending ${fmtMonth(s.hist.length ? s.hist[s.hist.length - 1].day - 1 : s.day)}` : 'No completed months yet'; }
function income(): string {
  const s = S(); const x = sel(); const A = fin.incomeStatement(s, fin.getPeriod(s, x.per, 0)), B = fin.incomeStatement(s, fin.getPeriod(s, x.per, 1));
  if (!s.fin.ledger.hist.length) return panel('Income statement', empty('No completed month yet', 'Statements appear after the first month closes.'));
  let rows = stRow('Revenue', A.revenue, B.revenue, 'sub');
  for (const k of Object.keys({ ...A.revBy, ...B.revBy })) rows += stRow(k === 'products' ? 'Product sales' : k[0].toUpperCase() + k.slice(1), A.revBy[k] || 0, B.revBy[k] || 0, '', true);
  rows += stRow('Cost of goods sold', -A.cogs, -B.cogs) + stRow('Gross profit', A.gross, B.gross, 'sub');
  for (const k of Object.keys({ ...A.opex, ...B.opex })) if (k !== 'interest' && k !== 'tax') rows += stRow(EXPN[k] || k, -(A.opex[k] || 0), -(B.opex[k] || 0), '', true);
  rows += stRow('Operating expenses', -A.opexTotal, -B.opexTotal) + stRow('Operating income', A.opIncome, B.opIncome, 'sub') + stRow('Interest expense', -A.interest, -B.interest) + stRow('Investment & asset gains/losses', A.gains, B.gains) + stRow('Pre-tax income', A.pretax, B.pretax, 'sub') + stRow('Income tax', -A.tax, -B.tax) + stRow('Net income', A.ni, B.ni, 'tot');
  return perSel() + panel(`Income Statement — ${pLabel()}`, stTable(rows), '', 'flat');
}
function balance(): string {
  const s = S(); const b = fin.balanceSheet(s); const prevH = s.hist.length > 12 ? s.hist[s.hist.length - 13] : null;
  const row = (l: string, v: number, cls = '', ind = false) => `<tr class="st ${cls}"><td class="${ind ? 'ind' : ''}">${l}</td><td class="r num ${v < 0 ? 'neg' : ''}">${moneyFull(v)}</td><td class="r num dim">${b.total ? pct(Math.abs(v) / Math.max(1, b.assets), 1) : ''}</td></tr>`;
  const rows = row('ASSETS', 0, 'hd') + row('Cash & equivalents', b.cash, '', true) + row('Property, plant & equipment', b.ppe, '', true) + row('Investments', b.invest, '', true) + row('Goodwill & acquired intangibles', b.goodwill, '', true) + row('Total assets', b.assets, 'sub') +
    row('LIABILITIES', 0, 'hd') + (b.loans.length ? b.loans.map(l => row(l.name, l.principal, '', true)).join('') : row('No debt', 0, '', true)) + row('Total liabilities', b.debt, 'sub') +
    row('EQUITY', 0, 'hd') + row('Paid-in capital', b.paidIn, '', true) + row('Retained earnings', b.retained, '', true) + row('Total equity', b.equity, 'sub') + row('Total liabilities & equity', b.total, 'tot');
  return panel(`Balance Sheet — ${money(b.assets)} total assets`, `<table class="tbl stmt"><thead><tr><th></th><th class="r">Amount</th><th class="r">% of assets</th></tr></thead><tbody>${rows}</tbody></table><p class="dim sm pad">${Math.abs(b.check) < 1 ? '✓ Balanced: assets = liabilities + equity' : '⚠ Imbalance ' + moneyFull(b.check)}${prevH ? '' : ''}</p>`, '', 'flat');
}
function cashflow(): string {
  const s = S(); const x = sel(); if (!s.fin.ledger.hist.length) return panel('Cash flow', empty('No completed month yet'));
  const A = fin.cashFlowStatement(s, fin.getPeriod(s, x.per, 0)), B = fin.cashFlowStatement(s, fin.getPeriod(s, x.per, 1));
  const r = (l: string, k: keyof typeof A, cls = '', ind = false) => stRow(l, A[k] as number, B[k] as number, cls, ind);
  const rows = `<tr class="st hd"><td>OPERATING</td><td></td><td></td><td></td></tr>` + r('Net income', 'ni', '', true) + r('+ Depreciation', 'dep', '', true) + stRow('− Non-cash investment gains', -A.gains, -B.gains, '', true) + r('Cash from operations', 'cfo', 'sub') +
    `<tr class="st hd"><td>INVESTING</td><td></td><td></td><td></td></tr>` + r('Capital expenditure', 'capex', '', true) + stRow('Acquisitions, investments & disposals', A.otherInv, B.otherInv, '', true) + r('Cash from investing', 'cfi', 'sub') +
    `<tr class="st hd"><td>FINANCING</td><td></td><td></td><td></td></tr>` + r('Net borrowing', 'debtNet', '', true) + r('Equity raised', 'equity', '', true) + r('Share buybacks', 'buybacks', '', true) + r('Dividends', 'dividends', '', true) + r('Cash from financing', 'cff', 'sub') + r('Net change in cash', 'net', 'tot');
  return perSel() + panel(`Cash Flow Statement — ${pLabel()}`, stTable(rows), '', 'flat');
}

function capital(): string {
  const s = S(); const x = sel(); const rate = fin.loanRate(s, x.kind); const max = fin.maxLoan(s, x.kind); const amt = Math.min(x.amt, Math.max(10000, max));
  const monthlyPay = x.kind === 'bank' ? amt / (x.years * 12) + (amt * rate) / 12 : (amt * rate) / 12;
  const loanPanel = panel('Borrow', `<div class="chips mb">${(['bank', 'bond', 'credit'] as const).map(k => `<button class="chip ${x.kind === k ? 'on' : ''}" data-act="fin-kind" data-k="${k}">${fin.LOAN_KINDS[k].name}</button>`).join('')}</div><p class="dim sm">${fin.LOAN_KINDS[x.kind].desc}</p>
    <div class="stat-row"><span>Interest rate</span><b class="num">${pct(rate, 2)}</b></div><div class="stat-row"><span>Maximum available</span><b class="num">${money(max)}</b></div>
    ${max >= 10000 ? `<div class="col mt">${sliderN('fin-amt', amt, 10000, Math.max(20000, max), 5000, 'Amount', moneyFull(amt))}${x.kind === 'bank' ? sliderN('fin-years', x.years, 1, 10, 1, 'Term', x.years + ' years') : ''}</div><div class="stat-row mt"><span>Est. monthly payment</span><b class="num" id="fin-pay">${money(monthlyPay)}</b></div>${btn('Take loan', 'fin-loan', {}, 'primary block mt')}` : `<p class="neg mt">Lenders will not extend more credit now${x.kind === 'bond' ? ' (needs $5M revenue & credit ≥ 660)' : ''}.</p>`}`);
  const loansPanel = panel('Outstanding debt', s.fin.loans.length ? table(['Loan', 'Principal', 'Rate', 'Monthly', ''], s.fin.loans.map(l => [l.name, money(l.principal), pct(l.rate), l.monthly ? money(l.monthly) : '—', `<div class="row">${btn('25%', 'fin-repay', { id: l.id, f: 0.25 }, 'sm')}${btn('All', 'fin-repay', { id: l.id, f: 1 }, 'sm good')}</div>`]), '', ['', 'r', 'r', 'r', 'r']) : empty('No debt'));
  // VC
  const idx = s.fin.rounds.length; const why = fin.vcEligibility(s, idx); const rd = fin.ROUNDS[idx];
  const o = rd ? fin.vcOffer(s, idx, rd.pcts[Math.min(x.vcPct, 2)]) : null;
  const vcPanel = panel('Venture capital', s.stock.public ? `<p class="dim">You are public — raise money with a secondary offering below.</p>` : !rd ? empty('All private rounds completed', 'Consider an IPO.') : `<div class="row between"><b>${rd.name}</b>${badge(why ? 'Locked' : 'Open', why ? 'warn' : 'good')}</div>${why ? `<p class="dim sm">${why}</p>` : ''}
    <div class="chips mt">${rd.pcts.map((p, i) => `<button class="chip ${x.vcPct === i ? 'on' : ''}" data-act="fin-vcpct" data-i="${i}">Sell ${(p * 100).toFixed(0)}%</button>`).join('')}</div>
    ${o ? `<div class="mt">${stat('Pre-money valuation', money(o.pre))}${stat('Investment', money(o.raise))}${stat('Post-money', money(o.post))}${stat('Founder stake after', pct((s.fin.founderShares) / (fin.outstanding(s) + o.newShares)))}</div>` : ''}${btn(`Raise ${rd.name}`, 'fin-vc', {}, 'primary block mt', !!why)}`);
  const cap = [{ n: 'Founder', v: s.fin.founderShares }, ...s.fin.rounds.map((r, i) => ({ n: r.name + ' investors', v: 0, pct: r.pct }))];
  const others = fin.outstanding(s) - s.fin.founderShares; const capPanel = panel('Cap table', `<div class="stat-row"><span>Founder</span><b class="num">${pct(fin.founderPct(s))}</b></div>${bar(fin.founderPct(s) * 100, 100, 'var(--accent)')}<div class="stat-row mt"><span>Investors & public</span><b class="num">${pct(others / fin.outstanding(s))}</b></div><div class="stat-row"><span>Treasury shares</span><b class="num">${num(s.fin.treasury)}</b></div><div class="stat-row"><span>Shares outstanding</span><b class="num">${num(fin.outstanding(s))}</b></div>
    ${s.fin.rounds.length ? table(['Round', 'Date', 'Raised', 'Post-money'], s.fin.rounds.map(r => [r.name, fmtMonth(r.day), money(r.raised), money(r.post)]), 'mt', ['', '', 'r', 'r']) : ''}`);
  const pub = panel('Public-company tools', !s.stock.public ? `<p class="dim">Available after your IPO (Stock Market tab).</p>` : `<div class="stat-row"><span>Share price</span><b class="num">$${s.stock.px.toFixed(2)}</b></div>
    <div class="col mt">${sliderN('fin-eq', x.eq, 100000, Math.max(200000, Math.round(s.stock.px * fin.outstanding(s) * 0.15 / 1e5) * 1e5), 100000, 'Secondary offering', moneyFull(x.eq))}${btn('Sell new shares (3% discount)', 'fin-sell', {}, 'block')}</div>
    <hr class="sep"><div class="col">${sliderN('fin-dps', x.dps, 0, 5, 0.005, 'Dividend / share / qtr', '$' + x.dps.toFixed(3))}<div class="row">${btn('Set dividend', 'fin-div', {}, 'sm')}${btn('Suspend', 'fin-div0', {}, 'sm ghost')}<span class="dim sm">Current: $${s.fin.dividendPerShare.toFixed(3)}</span></div></div>
    <hr class="sep"><div class="row between"><span>Share buyback program</span>${s.fin.buybackActive ? btn('Stop', 'fin-bb', { on: 0 }, 'sm bad') : btn('Start', 'fin-bb', { on: 1 }, 'sm good')}</div><p class="dim sm">Spends up to ~1.2% of market cap monthly while keeping 6 months of runway.</p>`);
  return `<div class="grid g2">${loanPanel}${loansPanel}${vcPanel}${capPanel}</div><div class="mt">${pub}</div>`;
}
function sliderN(id: string, v: number, min: number, max: number, step: number, label: string, shown: string): string {
  return `<label class="slider"><span>${label}</span><input type="range" data-input="${id}" data-change="fin-upd" min="${min}" max="${max}" step="${step}" value="${Math.min(max, Math.max(min, v))}"><b class="num" data-for="${id}">${shown}</b></label>`;
}
function investments(): string {
  const s = S(); const pf = Object.entries(s.stock.portfolio); const L = s.fin.ledger;
  return `<div class="kpis mb">${kpi('Investments (book)', money(L.invest))}${kpi('PP&E', money(L.ppe))}${kpi('Goodwill', money(L.goodwill))}${kpi('Positions', String(pf.length))}</div>` +
    panel('Equity stakes in other businesses', pf.length ? table(['Company', 'Shares', 'Cost basis', 'Market value', 'P&L'], pf.map(([id, p]) => { const r = s.rivals.find(x => x.id === id); const v = r ? p.shares * (r.publicCo && r.px > 0 ? r.px : r.valuation / Math.max(1, r.shares || 1e6) * 1.15) : 0; return [r?.name || id, num(p.shares), money(p.cost), money(v), `<span class="${v >= p.cost ? 'pos' : 'neg'}">${sgn(v - p.cost)}</span>`]; }), '', ['', 'r', 'r', 'r', 'r']) + `<p class="dim sm pad">Buy and sell stakes on the <a href="#" data-act="go" data-v="stock">Stock Market</a> screen. Build 15%+ of a listed rival to enable a hostile takeover in Corporate M&A.</p>` : empty('No stakes held', 'Buy shares of rivals or startups from the Stock Market screen.'));
}

registerActions({
  'fin-upd': () => {}, 'fin-per': el => { sel().per = el.dataset.k as any; }, 'fin-kind': el => { const x = sel(); x.kind = el.dataset.k as any; x.amt = Math.min(x.amt, Math.max(10000, fin.maxLoan(S(), x.kind))); },
  'fin-loan': () => { const x = sel(); const r = fin.takeLoan(S(), x.kind, x.amt, x.years); app.toast(r.msg, r.ok ? 'good' : 'warn'); app.sfx(r.ok ? 'cash' : 'error'); },
  'fin-repay': el => { const s = S(); const l = s.fin.loans.find(v => v.id === +el.dataset.id!); if (!l) return; const r = fin.repayLoan(s, l.id, l.principal * +el.dataset.f!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'fin-vcpct': el => { sel().vcPct = +el.dataset.i!; },
  'fin-vc': () => { const s = S(); const idx = s.fin.rounds.length; const rd = fin.ROUNDS[idx]; if (!rd) return; const r = fin.raiseVC(s, idx, rd.pcts[Math.min(sel().vcPct, 2)]); app.toast(r.msg, r.ok ? 'good' : 'warn'); app.sfx(r.ok ? 'cash' : 'error'); },
  'fin-sell': () => { const r = fin.sellEquity(S(), sel().eq); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'fin-div': () => { const r = fin.setDividend(S(), sel().dps); app.toast(r.msg, r.ok ? 'good' : 'warn'); }, 'fin-div0': () => { app.toast(fin.setDividend(S(), 0).msg, 'info'); },
  'fin-bb': el => { const r = el.dataset.on === '1' ? fin.startBuyback(S()) : fin.stopBuyback(S()); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
});
registerInputs({
  'fin-amt': el => { const x = sel(); x.amt = +el.value; setDigits(document.querySelector('[data-for="fin-amt"]'), moneyFull(x.amt)); const rate = fin.loanRate(S(), x.kind); setDigits(document.getElementById('fin-pay'), money((x.kind === 'bank' ? x.amt / (x.years * 12) : 0) + (x.amt * rate) / 12)); },
  'fin-years': el => { const x = sel(); x.years = +el.value; setDigits(document.querySelector('[data-for="fin-years"]'), x.years + ' years'); const rate = fin.loanRate(S(), x.kind); setDigits(document.getElementById('fin-pay'), money(x.amt / (x.years * 12) + (x.amt * rate) / 12)); },
  'fin-eq': el => { sel().eq = +el.value; setDigits(document.querySelector('[data-for="fin-eq"]'), moneyFull(+el.value)); },
  'fin-dps': el => { sel().dps = +el.value; setDigits(document.querySelector('[data-for="fin-dps"]'), '$' + (+el.value).toFixed(3)); },
});
registerView({ id: 'finance', title: 'Finance', icon: '💰', group: 'money', order: 0, render: renderFinance, badge: () => (S().fin.cash < 0 ? '!' : null) });
void rowCls; void ({} as Period);
