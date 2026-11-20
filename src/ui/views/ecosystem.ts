import './ecosystem.css';
import { registerView, registerActions, pageHead, panel, kpi, bar, badge, esc, num, pct, empty, scoreColor, logo } from '../kit';
import { S, ui } from '../state';
import { CATS, CAT, CAT_GROUPS } from '../../data/categories';
import { ecosystemReport, linked, ANCHOR_CATS } from '../../sim/ecosystem';
import type { CatId } from '../../sim/types';

const W = 760, H = 620, CX = W / 2, CY = H / 2 - 4, RX = 300, RY = 240;
const order = [...CATS].sort((a, b) => CAT_GROUPS.indexOf(a.group) - CAT_GROUPS.indexOf(b.group));
const pos: Record<string, { x: number; y: number }> = {};
order.forEach((c, i) => { const a = (i / order.length) * Math.PI * 2 - Math.PI / 2; pos[c.id] = { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) }; });
const sel = () => ((ui.sel.eco ||= { cat: null }) as { cat: CatId | null });

function graph() {
  const s = S(); const rep = ecosystemReport(s); const owned = new Set(rep.owned); const cur = sel().cat; const col = s.co.color;
  const edges: string[] = []; const seen = new Set<string>();
  for (const c of CATS) for (const o of c.syn) { const k = [c.id, o].sort().join('|'); if (seen.has(k)) continue; seen.add(k); const a = pos[c.id], b = pos[o]; const own = owned.has(c.id) && owned.has(o); const hl = cur && (cur === c.id || cur === o);
    edges.push(`<path class="eco-edge ${own ? 'own' : ''} ${hl ? 'hl' : ''}" ${own ? `style="stroke:${col}"` : ''} d="M${a.x},${a.y} Q${CX + (a.x + b.x - 2 * CX) * 0.25},${CY + (a.y + b.y - 2 * CY) * 0.25} ${b.x},${b.y}"/>`); }
  const nodes = CATS.map(c => { const p = pos[c.id]; const own = owned.has(c.id); const anchor = ANCHOR_CATS.includes(c.id); const unl = c.req.every(r => s.research.done[r] !== undefined);
    return `<g class="eco-node ${own ? 'own' : ''}" data-act="eco-pick" data-cat="${c.id}" transform="translate(${p.x},${p.y})"><circle class="b" r="${anchor ? 25 : 21}" fill="${own ? col : '#141a24'}" fill-opacity="${own ? 0.9 : 1}" stroke="${cur === c.id ? '#fff' : own ? col : unl ? '#3a4660' : '#222a38'}" stroke-width="${cur === c.id ? 3 : 1.6}" ${own ? `style="filter:drop-shadow(0 0 9px ${col})"` : ''}/><text class="i" ${own ? '' : 'opacity=".55"'}>${c.icon}</text><text class="l" y="${anchor ? 40 : 36}">${c.name.replace(' (API)', '')}</text></g>`; }).join('');
  return `<svg class="eco-svg" viewBox="0 0 ${W} ${H}"><g>${edges.join('')}</g>${nodes}<text x="${CX}" y="${CY - 8}" text-anchor="middle" style="font:700 30px var(--mono);fill:${scoreColor(s.derived.ecosystem.score)}">${s.derived.ecosystem.score.toFixed(0)}</text><text x="${CX}" y="${CY + 14}" text-anchor="middle" style="font:600 10px var(--sans);fill:var(--text-dim);letter-spacing:.18em">ECOSYSTEM SCORE</text></svg>`;
}
function detail() {
  const s = S(); const id = sel().cat; const rep = ecosystemReport(s); const e = s.derived.ecosystem;
  if (!id) return panel('Select a node', `<p class="dim">Click a product category to see how it connects to your ecosystem and what adding it would do.</p>` + legend());
  const c = CAT[id]; const own = rep.owned.includes(id); const net = e.net[id] || 0; const users = rep.users[id] || 0;
  const partners = CATS.filter(x => linked(id, x.id) && x.id !== id);
  const unl = c.req.every(r => s.research.done[r] !== undefined);
  return panel(`${c.icon} ${c.name}`, `<p class="dim">${esc(c.desc)}</p><div class="row wrap mb">${own ? badge('Owned · ' + num(users) + (c.sub ? ' subscribers' : ' units'), 'good') : badge(unl ? 'Not owned' : 'Needs research', unl ? '' : 'warn')}${c.platform ? badge('Platform', 'purple') : ''}</div>
    <div class="stat-row"><span>Demand bonus from ecosystem</span><b class="num pos">+${pct(net, 1)}</b></div>
    <div class="mt"><div class="dim sm">Synergy partners</div>${partners.map(p => { const o = rep.owned.includes(p.id); return `<div class="row between" style="padding:4px 0"><span>${p.icon} ${p.name}</span>${o ? badge('linked', 'good') : badge('—')}</div>`; }).join('')}</div>`);
}
function legend() { return `<div class="dim sm">● Glowing nodes: categories you have live products in<br>━ Bright lines: active synergy between two of your products<br>Large nodes: <b>platform anchors</b> (OS, cloud, marketplace, payments, dev platform, assistant) that anchor lock-in.</div>`; }
function render() {
  const s = S(); const e = s.derived.ecosystem; const rep = ecosystemReport(s);
  const kp = `<div class="kpis mb">${kpi('Ecosystem score', e.score.toFixed(0), 'breadth · links · anchors')}${kpi('Customer lock-in', pct(e.lockin, 0), 'cuts churn, lifts repeat sales')}${kpi('Active links', String(e.links), `${rep.owned.length} categories`)}${kpi('Developer adoption', e.devAdoption.toFixed(0) + '/100', 'feeds platform network effects')}${kpi('Platform anchors', `${rep.anchors.length}/${ANCHOR_CATS.length}`, rep.anchors.map(a => CAT[a].name).join(', ') || 'none yet')}</div>`;
  const recs = rep.recs.slice(0, 7).map(r => `<div class="rec"><span style="font-size:20px">${CAT[r.cat].icon}</span><div class="grow">${esc(r.text)}</div><b>+${(r.gain * 100).toFixed(0)}%</b></div>`).join('');
  return pageHead('Ecosystem', 'Products that reinforce each other create lock-in competitors struggle to copy.') + kp +
    `<div class="eco-wrap"><div>${graph()}</div><div class="col">${detail()}${panel('Recommended next products', recs || empty('Launch your first product to see recommendations'), '', 'flat')}${panel('How it works', `<div class="dim sm">Cross-selling: every linked product you own boosts demand for the new one, scaled by your installed base.<br>Network effects: platform products grow stronger with users.<br>Lock-in: a broad, well-linked ecosystem reduces churn. Developer adoption amplifies platform categories.</div>`)}</div></div>`;
}
registerView({ id: 'ecosystem', title: 'Ecosystem', icon: '🕸️', group: 'world', order: 2, render });
registerActions({ 'eco-pick': el => { const c = el.dataset.cat as CatId; sel().cat = sel().cat === c ? null : c; } });
