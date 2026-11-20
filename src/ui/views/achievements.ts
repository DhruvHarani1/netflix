import './achievements.css';
import { registerView, registerActions, pageHead, panel, kpi, bar, badge, btn, esc, money, num, fmtDay, tabs, curTab, empty, app } from '../kit';
import { S } from '../state';
import { STAGES } from '../../data/core';
import { ACHIEVEMENTS, MISSIONS, CHALLENGES, PERKS, stageRequirements, missionProgress, missionAvailable, claimMission, buyPerk, xpForLevel, rewardText } from '../../sim/achievements';

function fmtReq(r: { cur: number; need: number; fmt?: string }) { return r.fmt === 'money' ? `${money(r.cur)} / ${money(r.need)}` : r.fmt === 'bool' ? (r.cur >= 1 ? 'Done' : 'No') : `${Math.min(r.cur, 9999).toFixed(r.need < 10 ? 1 : 0)} / ${r.need}`; }
function stageHero() {
  const s = S(); const cur = s.meta.stage; const next = cur < 6 ? cur + 1 : 0; const reqs = next ? stageRequirements(s, next) : [];
  return panel('Company stage', `<div class="stagebar">${STAGES.map(st => `<div class="stg ${st.n < cur ? 'done' : ''} ${st.n === cur ? 'cur' : ''}"><i>${st.n}</i><b>${st.name}</b><small>${st.blurb}</small></div>`).join('')}</div>
    ${next ? `<div class="dim sm mb">Next: <b style="color:var(--text)">Stage ${next} — ${STAGES[next - 1].name}</b></div>${reqs.map(r => `<div class="req"><span>${r.label}</span>${bar(Math.min(r.cur, r.need), r.need, r.cur >= r.need ? 'var(--good)' : 'var(--accent)', '', 8)}<b class="num">${fmtReq(r)}</b></div>`).join('')}` : `<p class="pos">You have built a Future Technology Empire.</p>`}`);
}
function missions() {
  const s = S();
  return panel('Objectives', s.meta.missions.map(m => { const d = MISSIONS.find(x => x.id === m.id)!; const avail = missionAvailable(s, m); const pr = m.done ? 1 : missionProgress(s, m.id);
    return `<div class="mis ${!avail ? 'locked' : ''} ${m.claimed ? 'claimed' : ''}"><div class="grow"><b>${esc(m.title)}</b><small>${esc(m.desc)} — <i>${esc(m.goal)}</i></small>${avail && !m.claimed ? bar(pr, 1, m.done ? 'var(--good)' : 'var(--accent)', '', 5) : ''}</div><span class="rw">${rewardText(d)}</span>${m.claimed ? badge('Claimed', 'good') : m.done ? btn('Claim', 'ach-claim', { id: m.id }, 'primary sm') : avail ? `<span class="num dim">${Math.round(pr * 100)}%</span>` : badge('Locked')}</div>`; }).join(''), '', 'flat');
}
function challenges() {
  const s = S(); return panel('Optional challenges', CHALLENGES.map(c => { const d = !!s.meta.challengeDone[c.id]; return `<div class="mis ${d ? 'claimed' : ''}"><div class="grow"><b>${c.name}</b><small>${c.desc}</small></div>${d ? badge('Complete', 'good') : badge('Open')}</div>`; }).join(''), '<small class="dim">+1 perk point each</small>', 'flat');
}
function achs() {
  const s = S(); const n = ACHIEVEMENTS.filter(a => s.meta.ach[a.id] !== undefined).length;
  return panel(`Achievements · ${n}/${ACHIEVEMENTS.length}`, `<div class="agrid">${ACHIEVEMENTS.map(a => { const d = s.meta.ach[a.id]; const on = d !== undefined; return `<div class="ach ${on ? 'on' : ''}"><span class="ic">${a.icon}</span><div><b>${a.name}</b><small>${a.desc}</small>${on ? `<em>Unlocked ${fmtDay(d)}</em>` : ''}</div></div>`; }).join('')}</div>`);
}
function perks() {
  const s = S(); const c = s.co.ceo;
  return `<div class="kpis mb">${kpi('CEO level', String(c.level), `${c.xp} / ${xpForLevel(c.level)} xp`)}${kpi('Perk points', String(c.perkPoints), 'earned from stages, goals & achievements')}${kpi('Perks owned', `${c.perks.length}/${PERKS.length}`)}</div>
  <div class="agrid">${PERKS.map(p => { const own = c.perks.includes(p.id); return `<div class="perk ${own ? 'own' : ''}"><span class="ic">${p.icon}</span><div class="grow"><b>${p.name}</b><small>${p.desc}</small></div>${own ? badge('Active', 'good') : btn(`${p.cost} pt`, 'ach-perk', { id: p.id }, 'sm', c.perkPoints < p.cost)}</div>`; }).join('')}</div>`;
}
function stats() {
  const s = S(); const d = s.derived; const rows: [string, string][] = [['Peak valuation', money(s.meta.peak.valuation)], ['Peak yearly revenue', money(s.meta.peak.revenue)], ['Peak cash', money(s.meta.peak.cash)], ['Founded', fmtDay(s.co.startDay)], ['Days in business', num(s.day, 0)], ['Technologies researched', String(Object.keys(s.research.done).length)], ['Patents', String(s.research.patents.length)], ['Live products', String(s.products.filter(p => p.status === 'live').length)], ['Subsidiaries', String(s.ma.subs.length)], ['Legal fines paid', money(s.legal.fines)], ['Recessions survived', String(s.meta.stats.recessions || 0)], ['Current headcount', num(d.headcount, 0)]];
  return panel('Career statistics', rows.map(([a, b]) => `<div class="stat-row"><span>${a}</span><b class="num">${b}</b></div>`).join(''));
}
registerView({ id: 'achievements', title: 'Goals', icon: '🏆', group: 'risk', order: 3, badge: () => { const n = S().meta.missions.filter(m => m.done && !m.claimed).length; return n || null; },
  render: () => pageHead('Goals & Legacy', 'Objectives, achievements and the long road to a trillion-dollar empire.') + stageHero() + `<div class="mt"></div>` + tabs('ach', [['m', 'Objectives'], ['a', 'Achievements'], ['p', 'CEO perks'], ['s', 'Statistics']]) + (curTab('ach', 'm') === 'm' ? `<div class="grid g2">${missions()}${challenges()}</div>` : curTab('ach', 'm') === 'a' ? achs() : curTab('ach', 'm') === 'p' ? perks() : stats()) });
registerActions({ 'ach-claim': el => { const r = claimMission(S(), el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); }, 'ach-perk': el => { const r = buyPerk(S(), el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); } });
