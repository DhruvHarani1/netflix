import './research.css';
import { registerView, registerActions, registerInputs, pageHead, panel, kpi, tabs, curTab, bar, badge, btn, esc, money, num, empty, slider, app } from '../kit';
import { S, ui } from '../state';
import { TECH, TECH_BY_ID, BRANCHES, TAG_NAMES, specCap } from '../../data/research';
import { CAT } from '../../data/categories';
import { fmtDate } from '../../sim/util';
import * as R from '../../sim/research';
import type { TechNode } from '../../sim/types';

const NW = 150, NH = 50, GX = 200, GY = 62, PADX = 24, TOP = 26;
interface Layout { pos: Record<string, { x: number; y: number }>; bands: { id: string; name: string; color: string; y: number; h: number }[]; w: number; h: number }
let LAY: Layout | null = null;
function layout(): Layout {
  if (LAY) return LAY; const pos: Layout['pos'] = {}; const bands: Layout['bands'] = []; let y = TOP;
  for (const b of BRANCHES) {
    const nodes = TECH.filter(t => t.branch === b.id); const rows: Record<number, number> = {}; let maxRows = 1;
    // order within tier by average prerequisite row to reduce crossings
    const byTier: Record<number, TechNode[]> = {}; nodes.forEach(n => (byTier[n.tier] ||= []).push(n));
    for (const tier of Object.keys(byTier).map(Number).sort((a, c) => a - c)) {
      const ts = byTier[tier]; const key = (n: TechNode) => { const ps = n.req.map(r => pos[r]?.y).filter(v => v !== undefined) as number[]; return ps.length ? ps.reduce((a, c) => a + c, 0) / ps.length : 1e9; };
      ts.sort((a, c) => key(a) - key(c)); ts.forEach((n, i) => { pos[n.id] = { x: PADX + (n.tier - 1) * GX, y: y + 22 + i * GY }; }); maxRows = Math.max(maxRows, ts.length);
    }
    const h = 22 + maxRows * GY + 10; bands.push({ id: b.id, name: b.name, color: b.color, y, h }); y += h;
  }
  return (LAY = { pos, bands, w: PADX * 2 + 7 * GX, h: y + 10 });
}
const sel = () => (ui.sel.research ||= { id: 'ml1' }) as { id: string };
const color = (t: TechNode) => BRANCHES.find(b => b.id === t.branch)!.color;
function tree() {
  const s = S(), L = layout(); const sid = sel().id; const done = s.research.done; const act = s.research.active;
  let svg = ''; let nodes = '';
  for (const t of TECH) for (const r of t.req) { const a = L.pos[r], b = L.pos[t.id]; if (!a || !b) continue; const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2; const on = done[r] !== undefined;
    svg += `<path d="M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}" fill="none" stroke="${on ? (done[t.id] !== undefined ? color(t) : '#6b7a99') : '#2a3347'}" stroke-width="${done[t.id] !== undefined ? 2 : 1.4}" ${on ? '' : 'stroke-dasharray="4 4"'} opacity="${on ? .9 : .6}"/>`; }
  for (const t of TECH) { const p = L.pos[t.id]; const isDone = done[t.id] !== undefined; const a = act.find(q => q.id === t.id); const avail = !isDone && !a && t.req.every(r => done[r] !== undefined);
    const st = isDone ? 'done' : a ? 'active' : avail ? 'avail' : 'locked'; const prog = a ? Math.min(100, a.progress / t.rp * 100) : isDone ? 100 : 0;
    nodes += `<div class="rs-n ${st} ${sid === t.id ? 'sel' : ''}" style="left:${p.x}px;top:${p.y}px;--c:${color(t)};--p:${prog}" data-act="rs-sel" data-id="${t.id}"><span class="ring"><i>${isDone ? '✓' : a ? Math.round(prog) : t.tier}</i></span><b>${esc(t.name)}</b><small>${isDone ? 'Researched' : a ? `${prog.toFixed(0)}% · ~${R.estimateDays(s, t.id)}d` : `T${t.tier} · ${money(R.techCost(s, t))}`}</small></div>`; }
  const bands = L.bands.map(b => `<div class="rs-band" style="top:${b.y}px;height:${b.h}px"><span class="rs-bl" style="color:${b.color}">${b.name}</span></div>`).join('');
  const tiers = [1, 2, 3, 4, 5, 6, 7].map(i => `<div class="rs-tier" style="left:${PADX + (i - 1) * GX}px">TIER ${i}</div>`).join('');
  return `<div class="rs-tree" id="rs-tree"><div class="rs-in" style="width:${L.w}px;height:${L.h}px">${bands}${tiers}<svg width="${L.w}" height="${L.h}">${svg}</svg>${nodes}</div></div>`;
}
function detail() {
  const s = S(); const t = TECH_BY_ID[sel().id]; if (!t) return '';
  const done = s.research.done[t.id] !== undefined; const a = s.research.active.find(q => q.id === t.id); const c = R.canResearch(s, t.id);
  const reqs = t.req.map(r => `<span class="badge ${s.research.done[r] !== undefined ? 'good' : ''}">${s.research.done[r] !== undefined ? '✓ ' : ''}${esc(TECH_BY_ID[r].name)}</span>`).join(' ') || '<span class="dim">None</span>';
  const eff = t.tags.map(tg => `<span class="badge info">${TAG_NAMES[tg]} cap ${specCap(s.research.done, tg)}→${Math.min(10, specCap(s.research.done, tg) + (done ? 0 : 1))}</span>`).join(' ');
  const unl = (t.unlocks || []).map(u => `<span class="badge purple">${CAT[u].icon} ${CAT[u].name}</span>`).join(' ');
  const days = R.estimateDays(s, t.id); const fail = Math.round(Math.max(1, t.fail * (1.3 - s.derived.dept.research.avgSkill / 160) * 100));
  return `<div class="rs-side">${panel(esc(t.name), `<div class="row between"><span class="badge" style="color:${color(t)}">${BRANCHES.find(b => b.id === t.branch)!.name} · Tier ${t.tier}</span>${done ? badge('Researched ' + fmtDate(s.research.done[t.id]), 'good') : a ? badge('In progress', 'warn') : ''}</div><p class="dim">${esc(t.desc)}</p>${t.perk ? `<p class="pos sm">★ ${esc(t.perk)}</p>` : ''}
    <div class="stat-row"><span>Cost</span><b class="num">${money(R.techCost(s, t))}</b></div><div class="stat-row"><span>Research points</span><b class="num">${num(t.rp, 0)}</b></div><div class="stat-row"><span>Est. duration</span><b class="num">${isFinite(days) ? days + ' days' : '—'}</b></div><div class="stat-row"><span>Failure risk</span><b class="num">${fail}%</b></div>
    <div class="mt"><small class="dim">PREREQUISITES</small><div class="rs-tags">${reqs}</div></div><div><small class="dim">RAISES SPEC CEILING</small><div class="rs-tags">${eff}</div></div>${unl ? `<div><small class="dim">UNLOCKS PRODUCTS</small><div class="rs-tags">${unl}</div></div>` : ''}
    ${a ? `${bar(a.progress / t.rp * 100, 100, color(t), `${(a.progress / t.rp * 100).toFixed(1)}% · paid ${money(a.paid)}${a.setbacks ? ` · ${a.setbacks} setback(s)` : ''}`, 8)}<div class="mt">${btn('Cancel project', 'rs-cancel', { id: t.id }, 'bad sm')}</div>` : done ? '' : `<div class="mt">${btn('Start research', 'rs-start', { id: t.id }, 'primary block', !c.ok)}${!c.ok ? `<p class="neg sm">${esc(c.reasons[0])}</p>` : ''}</div>`}`)}
    ${panel('Lab queue', queue())}</div>`;
}
function queue() {
  const s = S(), rs = R.researchSummary(s); const act = s.research.active;
  return `<div class="stat-row"><span>Slots</span><b class="num">${act.length} / ${s.research.slots}</b></div><div class="stat-row"><span>Research speed</span><b class="num">${rs.rpPerDay.toFixed(1)} RP/day</b></div>` + (act.length ? act.map(p => { const t = TECH_BY_ID[p.id]; return `<div class="rs-q"><div class="grow"><b>${esc(t.name)}</b>${bar(p.progress / t.rp * 100, 100, color(t))}</div><button class="btn sm ghost" data-act="rs-sel" data-id="${t.id}">View</button></div>`; }).join('') : '<p class="dim sm">No active projects. Pick a technology and start it.</p>')
    + `<div class="mt">${slider('rs-boost', s.research.budgetBoost, 0, 2, .1, 'R&D budget boost', '×' + (1 + s.research.budgetBoost).toFixed(1))}<p class="dim sm">Boost speeds research up to +100% at up to +120% cost. More slots need Research Labs.</p></div>`;
}
function render() {
  const s = S(); const rs = R.researchSummary(s); const t = curTab('research', 'tree');
  let body = '';
  if (t === 'tree') body = `<div class="rs-wrap">${tree()}${detail()}</div>`;
  else if (t === 'patents') body = s.research.patents.length ? `<div class="rs-pat">${[...s.research.patents].reverse().map(p => `<div><b>${esc(p.name)}</b><div class="dim sm">Granted ${fmtDate(p.day)}</div><div class="row between mt"><span class="dim sm">Value</span><b class="num">${money(p.value)}</b></div><div class="row between"><span class="dim sm">Licensing / mo</span><b class="num pos">${money(p.value * .003)}</b></div></div>`).join('')}</div>` : panel('Patents', empty('No patents yet', 'Every completed technology files a patent family that earns licensing income and strengthens your IP position.'));
  else body = panel('Discovery log', `<div class="rs-log">${[...s.research.log].reverse().map(l => `<div class="${l.kind}"><small>${fmtDate(l.day)}</small>${esc(l.text)}</div>`).join('') || empty('Nothing yet')}</div>`, '', 'flat');
  return pageHead('Research & Development', 'Unlock technologies that raise your design ceilings and open new product categories.', `<span class="badge info">${rs.done}/${rs.total} technologies</span>`)
    + `<div class="kpis mb">${kpi('Research speed', rs.rpPerDay.toFixed(1) + ' RP/day', `Labs ×${s.derived.labBonus.toFixed(2)}`)}${kpi('Lab slots', `${rs.active} / ${rs.slots}`, 'Parallel projects')}${kpi('Patents', String(rs.patents), `${money(s.research.patents.reduce((a, p) => a + p.value * .003, 0))}/mo licensing`)}${kpi('Breakthroughs', String(rs.breakthroughs), `${rs.failures} failed experiments`)}</div>`
    + tabs('research', [['tree', 'Technology tree'], ['patents', 'Patents'], ['log', 'Discovery log']]) + body;
}
registerView({ id: 'research', title: 'Research', icon: '🔬', group: 'build', order: 2, render, mount: root => {
  const tr = root.querySelector('#rs-tree') as HTMLElement | null; if (!tr) return;
  tr.scrollLeft = (ui.sel.rsScroll?.x ?? 0); tr.scrollTop = ui.sel.rsScroll?.y ?? 0;
  tr.addEventListener('scroll', () => { ui.sel.rsScroll = { x: tr.scrollLeft, y: tr.scrollTop }; });
  tr.addEventListener('mousedown', e => {
    if ((e.target as HTMLElement).closest('.rs-n')) return; const d = { x: e.clientX, y: e.clientY, sx: tr.scrollLeft, sy: tr.scrollTop }; tr.classList.add('drag');
    const mv = (ev: MouseEvent) => { tr.scrollLeft = d.sx - (ev.clientX - d.x); tr.scrollTop = d.sy - (ev.clientY - d.y); };
    const up = () => { tr.classList.remove('drag'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
} });
registerInputs({ 'rs-boost': el => { R.setBudgetBoost(S(), +el.value); const o = document.querySelector('[data-for="rs-boost"]'); if (o) o.textContent = '×' + (1 + +el.value).toFixed(1); } });
registerActions({
  'rs-sel': el => { sel().id = el.dataset.id!; },
  'rs-start': el => { const r = R.startResearch(S(), el.dataset.id!); app.toast(r.msg, r.ok ? 'good' : 'warn'); },
  'rs-cancel': el => { const id = el.dataset.id!; app.confirm('Cancel research?', 'All progress on this project is lost.', () => { R.cancelResearch(S(), id); app.refresh(); }, 'Cancel project'); },
});
