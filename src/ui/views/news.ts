import './news.css';
import { registerView, registerActions, pageHead, panel, tabs, curTab, badge, kpi, esc, fmtDay, empty, pct, btn } from '../kit';
import { chart } from '../charts';
import { S, ui } from '../state';
import { unreadNews, markNewsRead } from '../../sim/events';
import type { NewsItem } from '../../sim/types';

const KINDS: [string, string][] = [['all', 'All'], ['company', 'Company'], ['rival', 'Rivals'], ['market', 'Markets'], ['tech', 'Tech'], ['law', 'Legal'], ['world', 'World'], ['finance', 'Finance'], ['people', 'People']];
const f = () => (ui.sel.news ||= { kind: 'all', tone: 'all' }) as { kind: string; tone: string };

function row(n: NewsItem) {
  const s = S(); const r = n.rival ? s.rivals.find(x => x.id === n.rival) : null;
  return `<div class="nrow ${n.tone}"><span class="d">${fmtDay(n.day)}</span><span class="k">${n.kind}</span><div><b>${esc(n.headline)}</b>${r ? `<span class="rchip" style="color:${r.color};border-color:${r.color}55">${esc(r.short || r.name)}</span>` : ''}${n.body ? `<p>${esc(n.body)}</p>` : ''}</div></div>`;
}
function feed() {
  const s = S(); const fl = f(); let items = [...s.events.news].reverse();
  const hero = items.find(n => n.tone !== 'neutral' && s.day - n.day < 60) || items[0];
  if (fl.kind !== 'all') items = items.filter(n => n.kind === fl.kind); if (fl.tone !== 'all') items = items.filter(n => n.tone === fl.tone);
  const rivalNews = [...s.events.news].reverse().filter(n => n.kind === 'rival').slice(0, 6);
  return `<div class="news-hero">${hero ? `<div class="story ${hero.tone}"><small>${hero.kind} · ${fmtDay(hero.day)} · top story</small><h2>${esc(hero.headline)}</h2><p>${esc(hero.body || 'Developing story.')}</p></div>` : ''}
    ${panel('Rival watch', rivalNews.length ? rivalNews.map(row).join('') : empty('No rival headlines yet'), '', 'flat')}</div>
  <div class="row wrap mb">${KINDS.map(([k, l]) => `<button class="chip ${fl.kind === k ? 'on' : ''}" data-act="news-kind" data-v="${k}">${l}</button>`).join('')}<span class="grow"></span>
    ${['all', 'good', 'bad', 'neutral'].map(t => `<button class="chip ${fl.tone === t ? 'on' : ''}" data-act="news-tone" data-v="${t}">${t === 'all' ? 'Any tone' : t}</button>`).join('')}</div>
  ${panel('Wire', items.length ? items.slice(0, 120).map(row).join('') : empty('Nothing matches these filters'), `<small class="dim">${items.length} stories</small>`, 'flat')}`;
}
function decisions() {
  const s = S(); const log = [...s.events.log].reverse();
  const pend = s.events.pending.filter(e => !e.resolved);
  return `${pend.length ? panel('Awaiting your decision', pend.map(e => `<div class="dlog"><span class="mi">${e.icon}</span><div class="grow"><b>${esc(e.title)}</b><div class="dim sm">${esc(e.body)}</div><small>Auto-resolves ${fmtDay(e.deadline)}</small></div>${btn('Decide', 'decide', {}, 'warn')}</div>`).join(''), '', 'flat mb') : ''}
  <div class="mt"></div>${panel('Decision history', log.length ? log.map(e => `<div class="dlog"><span class="mi">${e.icon}</span><div class="grow"><small>${fmtDay(e.day)} · ${badge(e.severity, e.severity === 'bad' ? 'bad' : e.severity === 'good' ? 'good' : '')}</small><div><b>${esc(e.title)}</b></div>${e.choices.length ? `<div class="pick">▸ ${esc(e.choices[e.picked ?? 0]?.label ?? '')}</div>` : ''}${e.outcome ? `<div class="out">${esc(e.outcome)}</div>` : ''}</div></div>`).join('') : empty('No events yet', 'Events begin after the first couple of months.'), '', 'flat')}`;
}
function economy() {
  const s = S(); const e = s.market.econ; const h = (s.events.flags.econHist || []) as number[][]; const lab = h.map(r => fmtDay(r[0]).replace(/ \d+,/, ''));
  const mc = (k: number) => h.map(r => r[k]);
  return `<div class="row mb"><span class="econ-badge ${e.cycle}">● ${e.cycle}</span><span class="dim">Phase ends in ~${Math.max(0, Math.round(e.cycleDays / 30))} months</span></div>
  <div class="kpis mb">${kpi('GDP growth', e.gdp.toFixed(1) + '%', 'annualised')}${kpi('Interest rate', pct(e.rate, 2), 'base lending')}${kpi('Inflation', pct(e.inflation, 1), 'wages & prices')}${kpi('Consumer confidence', e.confidence.toFixed(0), 'index 0–100')}${kpi('Demand multiplier', '×' + e.demandMult.toFixed(2), 'applied to every market')}${kpi('Unemployment', pct(e.unemployment, 1), 'talent supply')}</div>
  <div class="grid g2">${panel('GDP growth & confidence', chart('ec1', () => ({ labels: lab, series: [{ name: 'GDP %', color: '#4cc9f0', data: mc(1) }, { name: 'Confidence/10', color: '#ffb703', data: mc(4).map(v => v / 10) }], fmt: v => v.toFixed(1) }), 190))}
  ${panel('Rates & inflation (%)', chart('ec2', () => ({ labels: lab, series: [{ name: 'Rate', color: '#c77dff', data: mc(2) }, { name: 'Inflation', color: '#ff5d73', data: mc(3) }], fmt: v => v.toFixed(2) }), 190))}</div>
  <div class="mt">${panel('Market demand multiplier', chart('ec3', () => ({ labels: lab, series: [{ name: 'Demand ×', color: '#2ee6a6', data: mc(5) }], fmt: v => v.toFixed(2) }), 170))}</div>`;
}
registerView({ id: 'news', title: 'News', icon: '📰', group: 'risk', order: 1, badge: () => { const n = unreadNews(S()); return n ? Math.min(n, 99) : null; },
  render: () => pageHead('Global Wire', 'Headlines, decisions and the macro economy.', '') + tabs('news', [['feed', 'Headlines'], ['dec', 'Decisions'], ['eco', 'Economy']]) + ({ feed, dec: decisions, eco: economy } as any)[curTab('news', 'feed')](),
  mount: () => { if (curTab('news', 'feed') === 'feed') markNewsRead(S()); } });
registerActions({ 'news-kind': el => { f().kind = el.dataset.v!; }, 'news-tone': el => { f().tone = el.dataset.v!; } });
