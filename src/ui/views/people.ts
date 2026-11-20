import './people.css';
import { registerView, registerActions, registerInputs, pageHead, panel, kpi, tabs, curTab, table, bar, badge, btn, esc, money, num, scoreColor, empty, app, slider, pct100 } from '../kit';
import { S, ui } from '../state';
import { DEPTS, DEPT, REGION, LEVEL_NAMES } from '../../data/core';
import { TRAITS, TRAIN_KINDS } from '../../data/people';
import * as P from '../../sim/people';
import { chart } from '../charts';
import type { Dept, Employee, Candidate } from '../../sim/types';

interface Sel { sort: string; dir: number; dept: string; emp: number | null; neg: number | null; offer: number; teamDept: Dept; teamN: number; teamQ: number; q: string; hdept: string }
const sel = (): Sel => (ui.sel.people ||= { sort: 'dept', dir: 1, dept: 'all', emp: null, neg: null, offer: 0, teamDept: 'eng', teamN: 10, teamQ: 50, q: '', hdept: 'all' });
const trait = (id: string) => TRAITS.find(t => t.id === id)!;
const av = (name: string, c: string) => `<span class="pp-av" style="background:${c}">${name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>`;
const dcol = (d: string) => ['#4cc9f0', '#c77dff', '#2ee6a6', '#ffb703', '#ff7a00', '#9bf6ff', '#f15bb5', '#ff7675', '#80ed99', '#a29bfe', '#fdcb6e', '#e0e1dd'][DEPTS.findIndex(x => x.id === d)];
const traitTags = (e: { traits: string[] }) => e.traits.map(t => `<span class="pp-tr ${trait(t).good ? 'g' : 'b'}" title="${esc(trait(t).desc)}">${trait(t).label}</span>`).join('');
const act = (r: { ok: boolean; msg: string }) => app.toast(r.msg, r.ok ? 'good' : 'warn');

function overview() {
  const s = S(), D = s.derived; const over = D.headcount > D.officeCap; const risk = s.people.emps.filter(e => e.heads === 1 && e.happy < 35);
  let h = `<div class="kpis mb">${kpi('Headcount', num(D.headcount, 0), `${s.people.emps.length} records`)}${kpi('Office capacity', `${num(D.headcount, 0)} / ${num(D.officeCap, 0)}`, over ? '<span class="neg">Over capacity — morale &amp; output suffer</span>' : 'Comfortable', over ? 'neg' : '')}${kpi('Monthly payroll', money(D.payroll), `${money(D.payroll * 12)} / yr incl. benefits`)}${kpi('Research output', D.rpPerDay.toFixed(1) + ' RP/day', 'Scientists × leadership')}${kpi('Customer service', D.service.toFixed(0) + '/100', 'Support vs customer load')}</div>`;
  for (const p of s.people.poach || []) { const e = s.people.emps.find(x => x.id === p.empId); if (e) h += `<div class="pp-alert"><span>⚔️ <b>${esc(p.rival)}</b> offered <b>${esc(e.name)}</b> ${money(p.offer)}/yr — decide within ${p.deadline - s.day} days.</span><span class="row">${btn('Counter-offer', 'pp-counter', { id: p.id, a: 1 }, 'good sm')}${btn('Let go', 'pp-counter', { id: p.id, a: 0 }, 'sm')}</span></div>`; }
  for (const c of s.people.conflicts) { const a = s.people.emps.find(x => x.id === c.a), b = s.people.emps.find(x => x.id === c.b); if (a && b) h += `<div class="pp-alert"><span>💢 Conflict in ${DEPT[a.dept].name}: <b>${esc(a.name)}</b> vs <b>${esc(b.name)}</b></span><span class="row">${btn('Mediate ($1.5K)', 'pp-conf', { id: c.id, how: 'mediate' }, 'sm')}${btn('Dismiss ' + esc(a.name.split(' ')[0]), 'pp-conf', { id: c.id, how: 'fireone' }, 'bad sm')}</span></div>`; }
  if (risk.length) h += `<div class="pp-alert"><span>😟 <b>${risk.length}</b> employee${risk.length > 1 ? 's are' : ' is'} close to quitting: ${risk.slice(0, 4).map(e => esc(e.name)).join(', ')}</span></div>`;
  h += `<div class="pp-dept">${DEPTS.map(d => { const dd = D.dept[d.id]; const L = s.people.emps.find(e => e.id === dd.leader);
    return `<div class="pp-d ${dd.heads ? '' : 'empty'}"><h4><span><span class="ic">${d.icon}</span>${d.name}</span><b class="num">${num(dd.heads, 0)}</b></h4><small class="dim">${d.blurb}</small>
    <div class="m"><span>Output</span>${bar(Math.min(100, dd.output / Math.max(1, dd.heads) * 110), 100, dcol(d.id))}<span class="num">${dd.output.toFixed(1)}</span></div>
    <div class="m"><span>Efficiency</span>${bar(dd.eff * 70, 100, scoreColor(dd.eff * 70))}<span class="num">${(dd.eff * 100).toFixed(0)}%</span></div>
    <div class="m"><span>Morale</span>${bar(dd.avgHappy, 100, scoreColor(dd.avgHappy))}<span class="num">${dd.avgHappy.toFixed(0)}</span></div>
    <div class="lead">${L ? `👑 ${esc(L.name)} <span class="dim">· mgmt ${L.mgmt.toFixed(0)}</span>` : dd.heads ? 'No leader' : 'Unstaffed'} ${dd.heads ? `· ${money(dd.payroll)}/mo` : ''}</div>
    <div class="row">${btn('+ Hire', 'pp-hiredept', { d: d.id }, 'sm')}${dd.heads ? btn('Roster', 'pp-rosterdept', { d: d.id }, 'sm ghost') : ''}</div></div>`; }).join('')}</div>`;
  h += `<div class="mt">${panel('Headcount over time', chart('pp-hc', () => ({ series: [{ name: 'Headcount', color: '#4cc9f0', data: (s.people.hist || []).map(x => x.heads), fill: true }], labels: (s.people.hist || []).map(x => `d${x.day}`), fmt: v => v.toFixed(0), zero: true })  , 150))}</div>`;
  return h;
}
function roster() {
  const s = S(), z = sel(); let es = s.people.emps.filter(e => (z.dept === 'all' || e.dept === z.dept) && (!z.q || e.name.toLowerCase().includes(z.q.toLowerCase())));
  const key: Record<string, (e: Employee) => number | string> = { name: e => e.name, dept: e => e.dept, level: e => e.level, salary: e => e.salary, skill: e => e.skill, happy: e => e.happy, prod: e => e.prod * e.heads, heads: e => e.heads };
  const f = key[z.sort] || key.dept; es = [...es].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * z.dir; });
  const th = (k: string, l: string, c = '') => `<th class="sortable ${c}" data-act="pp-sort" data-k="${k}">${l}${z.sort === k ? (z.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const rows = es.slice(0, 250).map(e => `<tr data-act="pp-emp" data-id="${e.id}"><td><div class="pp-emp">${av(e.name, dcol(e.dept))}<div><b>${esc(e.name)}</b>${e.leader ? ' 👑' : ''}${e.trainUntil > s.day ? ' 🎓' : ''}${e.project ? ' 📦' : ''}<div class="dim sm">${esc(e.title)}</div></div></div></td><td>${DEPT[e.dept].icon} ${DEPT[e.dept].name}</td><td class="c">${e.heads > 1 ? '×' + e.heads : LEVEL_NAMES[e.level]}</td><td class="r num">${money(e.salary)}</td><td style="width:110px">${bar(e.skill, 100, scoreColor(e.skill))}</td><td style="width:90px">${bar(e.happy, 100, scoreColor(e.happy))}</td><td class="c num">${(e.prod * 100).toFixed(0)}%</td><td>${e.wantsRaise ? badge('wants raise', 'warn') : ''}${e.happy < 35 && e.heads === 1 ? badge('at risk', 'bad') : ''}</td></tr>`).join('');
  return `<div class="row mb wrap"><select data-change="pp-filter"><option value="all">All departments</option>${DEPTS.map(d => `<option value="${d.id}" ${z.dept === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select><input placeholder="Search name…" data-input="pp-q" value="${esc(z.q)}"><span class="dim">${es.length} records · ${num(es.reduce((a, e) => a + e.heads, 0), 0)} people</span><span class="grow"></span>${btn('Lay off…', 'pp-layoff-open', {}, 'bad sm')}</div>
  ${panel('Roster', `<table class="tbl click"><thead><tr>${th('name', 'Employee')}${th('dept', 'Department')}${th('level', 'Level', 'c')}${th('salary', 'Salary', 'r')}${th('skill', 'Skill')}${th('happy', 'Morale')}${th('prod', 'Output', 'c')}<th></th></tr></thead><tbody>${rows}</tbody></table>${es.length ? '' : empty('No employees match')}`, '', 'flat')}`;
}
function hiring() {
  const s = S(), z = sel(); const pool = P.listCandidates(s).filter(c => z.hdept === 'all' || c.dept === z.hdept);
  const cards = pool.map(c => { const sk = c.interviewed ? c.skill : c.estSkill;
    return `<div class="pp-cand ${c.interviewed ? 'iv' : ''}"><div class="row">${av(c.name, dcol(c.dept))}<div class="grow"><b>${esc(c.name)}</b><div class="dim sm">${esc(c.title)} · ${DEPT[c.dept].name}</div></div><b class="num">${money(c.ask)}</b></div>
    <div class="pp-skill"><span class="dim sm">Skill</span>${bar(sk, 100, scoreColor(sk))}<span class="num sm">${c.interviewed ? sk.toFixed(0) : '~' + sk.toFixed(0)}</span></div>
    ${c.interviewed ? `<div class="pp-skill"><span class="dim sm">Mgmt</span>${bar(c.mgmt, 100, 'var(--accent2)')}<span class="num sm">${c.mgmt.toFixed(0)}</span></div><div class="dim sm">${c.edu} · ${c.exp.toFixed(0)} yrs · specialty ${c.spec} · loyalty ${c.loyalty.toFixed(0)}</div><div>${traitTags(c) || '<span class="dim sm">No notable traits</span>'}</div>` : `<div class="dim sm">${c.edu} · ${c.exp.toFixed(0)} yrs · skill is an estimate (±15) until interviewed</div>`}
    <div class="row between"><small class="dim">Expires in ${c.expires - s.day}d</small><span class="row">${c.interviewed ? '' : btn('Interview', 'pp-interview', { id: c.id }, 'sm')}${btn('Make offer', 'pp-neg', { id: c.id }, 'primary sm')}</span></div></div>`; }).join('');
  const teamCost = P.marketSalary(s, z.teamDept, 1, 38 + z.teamQ * .45, 3) * z.teamN;
  return `<div class="row mb wrap"><select data-change="pp-hfilter"><option value="all">All roles</option>${DEPTS.map(d => `<option value="${d.id}" ${z.hdept === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select>${z.hdept !== 'all' ? btn('📢 Post job ad', 'pp-post', { d: z.hdept }, 'sm') : ''}<span class="dim">${pool.length} candidates · pool grows with HR output, reputation and pay policy</span></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(290px,1fr))">${cards || empty('No candidates', 'Post a job ad or improve your reputation')}</div>
  <div class="mt">${panel('Bulk hiring — teams', `<p class="dim">Hire rank-and-file staff in bulk. A team is a single record of N people with averaged skill — ideal for scaling support, manufacturing and sales.</p><div class="grid g4"><label class="col dim sm">Department<select data-change="pp-teamdept">${DEPTS.map(d => `<option value="${d.id}" ${z.teamDept === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label><div>${slider('pp-teamn', z.teamN, 2, 500, 1, 'People', String(z.teamN))}</div><div>${slider('pp-teamq', z.teamQ, 0, 100, 1, 'Quality', String(z.teamQ))}</div><div class="col"><small class="dim">Est. annual payroll</small><b class="num" id="pp-teamcost">${money(teamCost)}</b>${btn('Hire team', 'pp-hireteam', {}, 'primary')}</div></div>`)}</div>`;
}
function org() {
  const s = S(); const kids = DEPTS.filter(d => s.derived.dept[d.id].heads).map(d => { const dd = s.derived.dept[d.id]; const L = s.people.emps.find(e => e.id === dd.leader); return `<div class="node" ${L ? `data-act="pp-emp" data-id="${L.id}"` : ''} style="border-top:3px solid ${dcol(d.id)}"><div class="n">${num(dd.heads, 0)}</div><b>${d.icon} ${d.name}</b>${L ? `<div>${esc(L.name)}</div><div class="dim">${esc(L.title)}</div>` : '<div class="dim">No leader</div>'}</div>`; }).join('');
  return panel('Organisation chart', `<div class="pp-org"><div class="ceo">${esc(s.co.founder)}<small>Founder &amp; CEO</small></div><div class="stem"></div><div class="rail"></div><div class="kids">${kids}</div></div>`);
}
function policies() {
  const s = S(), pol = s.people.policy; const avgHap = s.derived.headcount ? s.people.emps.reduce((a, e) => a + e.happy * e.heads, 0) / s.derived.headcount : 0;
  return `<div class="pp-pol">${panel('Compensation stance', `${slider('pp-wage', pol.wage, .8, 1.4, .05, 'Pay vs. market', '×' + pol.wage.toFixed(2))}<p class="dim sm">Raises (or cuts) every salary by this multiplier. Higher pay lifts morale, loyalty and candidate quality; payroll scales directly.</p>`)}
  ${panel('Perks & culture', `<div class="chips">${['None', 'Snacks & flex hours', 'Health & learning budget', 'Equity, wellness & sabbaticals'].map((n, i) => `<button class="chip ${pol.perks === i ? 'on' : ''}" data-act="pp-perks" data-v="${i}">${n}</button>`).join('')}</div><p class="dim sm">Each tier adds morale and +3% benefits cost.</p>`)}
  ${panel('Work model', `<div class="row">${btn(pol.remote ? '✔ Remote-friendly' : 'On-site only', 'pp-remote', {}, pol.remote ? 'good' : '')}</div><p class="dim sm">Remote work adds morale (+5) but −3% output.</p>`)}
  ${panel('Workforce health', `<div class="stat-row"><span>Average morale</span><b class="num">${avgHap.toFixed(0)}</b></div><div class="stat-row"><span>Open conflicts</span><b class="num">${s.people.conflicts.length}</b></div><div class="stat-row"><span>Poaching offers</span><b class="num">${(s.people.poach || []).length}</b></div><div class="stat-row"><span>Reviews overdue</span><b class="num">${s.people.emps.filter(e => s.day - e.lastReview > 400).length}</b></div><div class="stat-row"><span>Facility happiness bonus</span><b class="num">+${s.derived.happinessBonus.toFixed(1)}</b></div>`)}</div>`;
}
function render() {
  const s = S(); const t = curTab('people', 'overview');
  const body = t === 'overview' ? overview() : t === 'roster' ? roster() : t === 'hiring' ? hiring() : t === 'org' ? org() : policies();
  return pageHead('People', 'Hire, grow and keep the talent that builds your empire.', `<span class="badge">${num(s.derived.headcount, 0)} staff</span>`) + tabs('people', [['overview', 'Departments'], ['roster', 'Roster'], ['hiring', 'Hiring'], ['org', 'Org chart'], ['policies', 'Policies']]) + body;
}
function empModal(id: number) {
  return () => { const s = S(); const e = s.people.emps.find(x => x.id === id); if (!e) return `<div class="mbody">This employee has left.</div><div class="mfoot">${btn('Close', 'modal-close', {}, 'primary')}</div>`;
    const mkt = P.marketSalary(s, e.dept, e.level, e.skill, e.exp); const L = (k: string, v: number) => `<div><div class="row between"><span class="dim">${k}</span><b class="num">${v.toFixed(0)}</b></div>${bar(v, 100, scoreColor(v))}</div>`;
    return `<div class="mhead"><div class="pp-emp">${av(e.name, dcol(e.dept))}<div><small>${DEPT[e.dept].name}${e.leader ? ' · 👑 Department head' : ''}</small><h2>${esc(e.name)}</h2></div></div></div><div class="mbody pp-detail"><p>${esc(e.title)}${e.heads > 1 ? ` · team of ${e.heads}` : ''} · ${e.edu} · ${e.exp.toFixed(1)} yrs experience · specialty <b>${e.spec}</b>${e.rating ? ` · last review ${e.rating.toFixed(1)}/5` : ''}</p>
    <div class="stats">${L('Skill', e.skill)}${L('Management', e.mgmt)}${L('Morale', e.happy)}${L('Motivation', e.motiv)}${L('Loyalty', e.loyalty)}${L('Productivity', e.prod * 70)}</div><div>${traitTags(e)}</div>
    <div class="stat-row mt"><span>Salary (${e.heads > 1 ? 'per head' : 'annual'})</span><b class="num">${money(e.salary)} <small class="dim">market ${money(mkt)}</small></b></div>${e.trainUntil > s.day ? `<div class="stat-row"><span>Training</span><b>${TRAIN_KINDS[e.trainKind || 'workshop'].name} · ${e.trainUntil - s.day}d left</b></div>` : ''}${e.project ? `<div class="stat-row"><span>Assigned project</span><b>#${e.project}</b></div>` : ''}
    <div class="row wrap mt">${btn('+5% raise', 'pp-raise', { id, p: 5 }, 'sm')}${btn('+15% raise', 'pp-raise', { id, p: 15 }, 'sm')}${e.heads === 1 && e.level < 4 ? btn('⬆ Promote', 'pp-promote', { id }, 'good sm') : ''}${e.heads === 1 && !e.leader ? btn('👑 Make dept head', 'pp-leader', { id }, 'sm') : ''}</div>
    <div class="row wrap mt">${Object.entries(TRAIN_KINDS).map(([k, v]) => btn(`🎓 ${v.name} <small>${money(e.salary * e.heads * v.costPct + 500)} · ${v.desc}</small>`, 'pp-train', { id, k }, 'sm', e.trainUntil > s.day)).join('')}</div></div>
    <div class="mfoot">${btn('Dismiss', 'pp-fire', { id }, 'bad')}${btn('Close', 'modal-close', {}, 'primary')}</div>`; };
}
function negModal(id: number) {
  return () => { const s = S(), z = sel(); const c = s.people.pool.find(x => x.id === id); if (!c) return `<div class="mbody">Candidate is no longer available.</div><div class="mfoot">${btn('Close', 'modal-close', {}, 'primary')}</div>`;
    const ch = P.acceptChance(s, c, z.offer); const over = s.derived.headcount + c.heads > s.derived.officeCap;
    return `<div class="mhead"><div class="pp-emp">${av(c.name, dcol(c.dept))}<div><small>${DEPT[c.dept].name} · ${c.title}</small><h2>${esc(c.name)}</h2></div></div></div><div class="mbody"><p>Asking <b>${money(c.ask)}</b> / yr. Market rate is about ${money(P.marketSalary(s, c.dept, c.level, c.skill, c.exp))}. Recruiting fee ≈ ${money(z.offer * .08)}.</p>
    ${slider('pp-offer', z.offer, Math.round(c.ask * .85 / 500) * 500, Math.round(c.ask * 1.4 / 500) * 500, 500, 'Your offer', money(z.offer))}
    <p>Acceptance chance: <b id="pp-chance" class="num">${(ch * 100).toFixed(0)}%</b> <span class="dim sm">— below ~85% of the ask they refuse outright; a counter-offer may follow.</span></p>${over ? '<p class="neg sm">⚠ Office is at capacity — this hire will strain morale. Build or upgrade facilities.</p>' : ''}</div>
    <div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Send offer', 'pp-offer-send', { id }, 'primary')}</div>`; };
}
function layoffModal() {
  return () => { const z = sel(); return `<div class="mhead bad"><h2>Layoffs</h2></div><div class="mbody"><p>Cutting staff saves payroll but costs severance (25% of salary), damages morale across the company and hurts your reputation.</p><label class="col dim sm">Department<select data-change="pp-lodept">${DEPTS.map(d => `<option value="${d.id}" ${z.teamDept === d.id ? 'selected' : ''}>${d.name} (${num(S().derived.dept[d.id].heads, 0)})</option>`).join('')}</select></label>${slider('pp-lopct', z.teamN, 5, 90, 5, 'Cut', z.teamN + '%')}</div><div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn('Confirm layoffs', 'pp-layoff', {}, 'bad')}</div>`; };
}
registerView({ id: 'people', title: 'People', icon: '👥', group: 'build', order: 3, render, badge: () => { const n = P.riskCount(S()); return n || null; } });
registerInputs({
  'pp-q': el => { sel().q = el.value; }, 'pp-wage': el => { P.setPolicy(S(), { wage: +el.value }); const o = document.querySelector('[data-for="pp-wage"]'); if (o) o.textContent = '×' + (+el.value).toFixed(2); },
  'pp-offer': el => { const z = sel(); z.offer = +el.value; const o = document.querySelector('[data-for="pp-offer"]'); if (o) o.textContent = money(z.offer); const c = S().people.pool.find(x => x.id === z.neg); const ch = document.getElementById('pp-chance'); if (c && ch) ch.textContent = (P.acceptChance(S(), c, z.offer) * 100).toFixed(0) + '%'; },
  'pp-teamn': el => { const z = sel(); z.teamN = +el.value; upd(); }, 'pp-teamq': el => { const z = sel(); z.teamQ = +el.value; upd(); },
  'pp-lopct': el => { sel().teamN = +el.value; const o = document.querySelector('[data-for="pp-lopct"]'); if (o) o.textContent = el.value + '%'; },
});
function upd() { const z = sel(), s = S(); const o1 = document.querySelector('[data-for="pp-teamn"]'); if (o1) o1.textContent = String(z.teamN); const o2 = document.querySelector('[data-for="pp-teamq"]'); if (o2) o2.textContent = String(z.teamQ); const c = document.getElementById('pp-teamcost'); if (c) c.textContent = money(P.marketSalary(s, z.teamDept, 1, 38 + z.teamQ * .45, 3) * z.teamN); }
registerActions({
  'pp-sort': el => { const z = sel(), k = el.dataset.k!; if (z.sort === k) z.dir *= -1; else { z.sort = k; z.dir = 1; } },
  'pp-filter': el => { sel().dept = (el as any).value; }, 'pp-hfilter': el => { sel().hdept = (el as any).value; }, 'pp-teamdept': el => { sel().teamDept = (el as any).value; }, 'pp-lodept': el => { sel().teamDept = (el as any).value; },
  'pp-hiredept': el => { ui.tab.people = 'hiring'; sel().hdept = el.dataset.d!; }, 'pp-rosterdept': el => { ui.tab.people = 'roster'; sel().dept = el.dataset.d!; },
  'pp-emp': el => { const id = +el.dataset.id!; sel().emp = id; app.openModal('emp', empModal(id)); },
  'pp-interview': el => { act(P.interview(S(), +el.dataset.id!)); },
  'pp-neg': el => { const z = sel(); const c = S().people.pool.find(x => x.id === +el.dataset.id!); if (!c) return; z.neg = c.id; z.offer = Math.round(c.ask / 500) * 500; app.openModal('neg', negModal(c.id)); },
  'pp-offer-send': el => { const z = sel(); const r = P.hire(S(), +el.dataset.id!, z.offer); act(r); if (r.ok) app.closeModal(); else { const c = S().people.pool.find(x => x.id === z.neg); if (c) z.offer = Math.max(z.offer, Math.round(c.ask / 500) * 500); } },
  'pp-post': el => act(P.postJob(S(), el.dataset.d as Dept)), 'pp-hireteam': () => { const z = sel(); act(P.hireTeam(S(), z.teamDept, z.teamN, z.teamQ)); },
  'pp-raise': el => act(P.giveRaise(S(), +el.dataset.id!, +el.dataset.p!)), 'pp-promote': el => act(P.promote(S(), +el.dataset.id!)), 'pp-leader': el => { const e = S().people.emps.find(x => x.id === +el.dataset.id!); if (e) act(P.setLeader(S(), e.dept, e.id)); },
  'pp-train': el => act(P.train(S(), +el.dataset.id!, el.dataset.k!)),
  'pp-fire': el => { const id = +el.dataset.id!; const e = S().people.emps.find(x => x.id === id); if (e) app.confirm('Dismiss ' + esc(e.name) + '?', 'Severance of 25% of annual salary applies and colleagues will be unsettled.', () => act(P.fire(S(), id)), 'Dismiss'); },
  'pp-layoff-open': () => app.openModal('layoff', layoffModal()), 'pp-layoff': () => { const z = sel(); act(P.layoff(S(), z.teamDept, z.teamN)); app.closeModal(); },
  'pp-counter': el => act(P.counterOffer(S(), +el.dataset.id!, el.dataset.a === '1')), 'pp-conf': el => act(P.resolveConflict(S(), +el.dataset.id!, el.dataset.how as any)),
  'pp-perks': el => act(P.setPolicy(S(), { perks: +el.dataset.v! })), 'pp-remote': () => act(P.setPolicy(S(), { remote: !S().people.policy.remote })),
});
