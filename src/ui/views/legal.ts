import './legal.css';
import { registerView, registerActions, pageHead, panel, bar, badge, btn, kpi, esc, money, fmtDay, empty, scoreColor, table, tabs, curTab } from '../kit';
import { S } from '../state';
import { app } from '../kit';
import { COMPLIANCE, POLICIES } from '../../data/core';
import { togglePolicy, investCompliance, settleCase, fightCase, settleCost, fightFee, winChance, policyCostMonthly, openCaseCount } from '../../sim/legal';

const ADVICE: Record<string, string> = {
  privacy: 'Hire legal staff, adopt the Privacy-First policy.', safety: 'Invest in testing facilities and a Responsible AI board.', antitrust: 'Avoid >40% share; open a Government Relations office.',
  employment: 'Fair Work Charter and a strong HR team help.', environment: 'Carbon-neutral operations and ops staff.', cyber: 'Security staff plus a Bug Bounty program.', trade: 'Lobbying and diversified regions.', ip: 'Research & patent more; avoid open-source exposure.',
};
const heat = () => { const w = S().legal.watch; return `<div class="heatbar"><i style="left:calc(${w}% - 1px)"></i></div><div class="row between dim sm" style="margin-top:4px"><span>Calm</span><b class="num">${w.toFixed(0)}/100</b><span>Under the microscope</span></div>`; };
function overview() {
  const s = S(); const L = s.legal; const amts = [0.5, 1, 3].map(k => Math.round(k * Math.max(25000, s.derived.payroll * 0.5) / 5000) * 5000);
  const meters = COMPLIANCE.map(c => { const v = L.compliance[c.id]; const b = (L.boost?.[c.id] || 0);
    return `<div class="cmeter"><div class="ch"><span><span class="ci">${c.icon}</span><b>${c.name}</b></span><b class="num" style="color:${scoreColor(v)}">${v.toFixed(0)}</b></div>${bar(v, 100, scoreColor(v), '', 8)}<small>${c.blurb}</small>${v < 50 ? `<div class="adv">⚠ ${ADVICE[c.id]}</div>` : ''}
    <div class="row wrap">${amts.map(a => btn(`+ ${money(a)}`, 'legal-invest', { k: c.id, a }, 'sm')).join('')}${b > 0.5 ? `<small>boost +${b.toFixed(1)}</small>` : ''}</div></div>`; }).join('');
  return `<div class="kpis mb">${kpi('Regulatory heat', L.watch.toFixed(0), 'higher = more scrutiny')}${kpi('Open cases', String(openCaseCount(s)), `${L.investigations.length} investigations`)}${kpi('Lifetime fines', money(L.fines), 'legal costs & damages')}${kpi('Risk multiplier', '×' + s.derived.complianceRisk.toFixed(2), 'on bad events')}${kpi('Patents', String(s.research.patents.length), 'strengthen IP defence')}</div>
  ${panel('Regulatory heat', heat())}<div class="grid g4 mt">${meters}</div>`;
}
function policies() {
  const s = S();
  return panel('Corporate policies', POLICIES.map(p => { const on = !!s.legal.policies[p.id]; return `<div class="pol"><div class="grow"><b>${p.name}</b><small>${p.desc}</small><br><em>${p.effect}</em></div><span class="num dim sm">${money(policyCostMonthly(s, p.id))}/mo</span><button class="sw2 ${on ? 'on' : ''}" data-act="legal-policy" data-id="${p.id}" aria-label="toggle"></button></div>`; }).join(''), '', 'flat');
}
function cases() {
  const s = S(); const open = s.legal.cases.filter(c => c.status === 'open'); const done = s.legal.cases.filter(c => c.status !== 'open').reverse().slice(0, 12);
  return panel('Active cases & investigations', open.length ? open.map(c => `<div class="case"><div class="row between"><h4>${esc(c.title)}</h4>${badge(c.kind, c.kind === 'antitrust' ? 'bad' : 'warn')}</div>
    <div class="meta"><span>vs ${esc(c.opp)}</span><span>Exposure <b class="num">${money(c.exposure)}</b></span><span>Verdict ${fmtDay(c.ends)}</span><span>Win chance <b>${(winChance(s, c) * 100).toFixed(0)}%</b></span>${c.stance === 'fight' ? badge('Fighting', 'info') : ''}</div><div class="dim sm mb">${esc(c.desc)}</div>
    <div class="row">${btn(`Settle (${money(settleCost(c))})`, 'legal-settle', { id: c.id }, 'sm')}${c.stance === 'fight' ? '' : btn(`Fight in court (${money(fightFee(c))} fees)`, 'legal-fight', { id: c.id }, 'sm warn')}</div></div>`).join('') : empty('No active legal matters', 'Keep compliance high to keep it that way.'), '', 'flat')
    + `<div class="mt"></div>` + panel('Closed cases', done.length ? table(['Case', 'Result', 'Closed'], done.map(c => [esc(c.title), `${badge(c.status, c.status === 'won' ? 'good' : c.status === 'lost' ? 'bad' : '')} <span class="dim sm">${esc(c.outcome || '')}</span>`, fmtDay(c.ends)])) : empty('Nothing resolved yet'), '', 'flat');
}
function ip() {
  const s = S(); const p = s.research.patents;
  return panel('Patent portfolio', p.length ? table(['Patent', 'Technology', 'Granted', 'Value'], p.slice().reverse().map(x => [esc(x.name), esc(x.tech), fmtDay(x.day), `<span class="num">${money(x.value)}</span>`]), '', ['', '', '', 'r']) : empty('No patents yet', 'Completing research grants patents, which strengthen IP defence and earn licensing income.'), '', 'flat')
    + `<div class="mt"></div>` + panel('Fines history', (s.legal.fineHist || []).length ? table(['Date', 'Item', 'Amount'], (s.legal.fineHist || []).slice().reverse().slice(0, 20).map(f => [fmtDay(f.day), esc(f.text), `<span class="num neg">${money(f.amount)}</span>`], ), '', ['', '', 'r']) : empty('No fines yet'), '', 'flat');
}
registerView({ id: 'legal', title: 'Legal', icon: '⚖️', group: 'risk', order: 2, badge: () => { const n = openCaseCount(S()); return n || null; },
  render: () => pageHead('Legal & Compliance', 'Balance profit, innovation and the law. Regulators watch the biggest players hardest.') + tabs('legal', [['ov', 'Compliance'], ['pol', 'Policies'], ['cases', 'Cases'], ['ip', 'IP & fines']]) + ({ ov: overview, pol: policies, cases, ip } as any)[curTab('legal', 'ov')]() });
registerActions({
  'legal-invest': el => { const r = investCompliance(S(), el.dataset.k as any, +el.dataset.a!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'legal-policy': el => { const r = togglePolicy(S(), el.dataset.id!); app.toast(r.msg, r.ok ? 'info' : 'warn'); },
  'legal-settle': el => { const r = settleCase(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'legal-fight': el => { const r = fightCase(S(), +el.dataset.id!); app.toast(r.msg, r.ok ? 'info' : 'warn'); },
});
