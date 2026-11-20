import './world.css';
import { registerView, registerActions, pageHead, panel, table, money, bar, badge, btn, kpi, esc, app, scoreColor } from '../kit';
import { S, ui } from '../state';
import { REGIONS, REGION } from '../../data/core';
import { EXPANSIONS, EXP, expansionCost, expansionMonthly, has, computeTarget, regionStats, buy, type ExpansionKind } from '../../sim/expansion';
import { presenceWeight } from '../../sim/marketing';
import type { RegionId, GameState } from '../../sim/types';

// ---- hand-authored continent outlines (lon,lat) rasterised into a dot matrix --------------------
type Poly = [number, number][];
const POLYS: { r: RegionId; p: Poly }[] = [
  { r: 'me', p: [[34, 31], [36, 37], [44, 37], [48, 30], [56, 27], [60, 25], [60, 22], [57, 17], [52, 16], [43, 12], [43, 17], [38, 25], [35, 29]] },
  { r: 'me', p: [[44, 38], [54, 38], [61, 36], [62, 26], [57, 26], [50, 30], [46, 33]] },
  { r: 'oc', p: [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [151, -34], [146, -39], [138, -35], [131, -31], [124, -34], [115, -34]] },
  { r: 'oc', p: [[172, -35], [178, -38], [175, -41], [170, -46], [167, -46], [172, -41]] }, { r: 'oc', p: [[141, -3], [150, -6], [147, -10], [141, -9]] },
  { r: 'af', p: [[-17, 21], [-13, 28], [-9, 33], [-6, 36], [10, 37], [11, 33], [20, 32], [32, 31], [35, 28], [33, 22], [38, 18], [43, 12], [51, 12], [48, 5], [40, -3], [40, -10], [35, -20], [33, -26], [27, -34], [20, -35], [17, -30], [12, -18], [13, -8], [9, -1], [9, 4], [5, 6], [-8, 4], [-13, 8], [-17, 14]] },
  { r: 'af', p: [[44, -13], [50, -15], [47, -25], [43, -22]] },
  { r: 'sa', p: [[-79, 8], [-72, 12], [-62, 11], [-52, 5], [-50, 0], [-35, -6], [-39, -14], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-72, -54], [-75, -48], [-73, -38], [-71, -28], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-77, 4]] },
  { r: 'eu', p: [[-10, 36], [-9, 43], [-1, 46], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [14, 69], [25, 71], [40, 68], [50, 68], [60, 68], [60, 50], [52, 46], [48, 42], [40, 42], [36, 45], [28, 41], [26, 36], [22, 36], [15, 38], [12, 38], [8, 44], [3, 43], [-2, 37]] },
  { r: 'eu', p: [[-6, 50], [2, 51], [2, 56], [-2, 59], [-6, 58], [-5, 54]] }, { r: 'eu', p: [[-24, 64], [-14, 64], [-14, 66], [-24, 66]] },
  { r: 'na', p: [[-168, 66], [-156, 71], [-125, 70], [-100, 70], [-85, 69], [-82, 63], [-93, 58], [-88, 52], [-82, 52], [-79, 55], [-77, 62], [-70, 60], [-62, 58], [-56, 52], [-60, 47], [-66, 44], [-70, 42], [-75, 38], [-76, 35], [-81, 31], [-80, 26], [-83, 29], [-90, 29], [-97, 26], [-97, 22], [-92, 18], [-88, 21], [-87, 16], [-83, 10], [-79, 8], [-82, 8], [-86, 12], [-92, 14], [-97, 16], [-105, 20], [-110, 24], [-114, 31], [-117, 32], [-121, 35], [-124, 40], [-124, 47], [-130, 54], [-140, 60], [-150, 60], [-158, 57], [-165, 60]] },
  { r: 'na', p: [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-60, 82], [-72, 78], [-55, 70]] }, { r: 'na', p: [[-85, 22], [-74, 20], [-68, 18], [-78, 24]] },
  { r: 'as', p: [[60, 68], [80, 73], [110, 77], [140, 72], [170, 70], [180, 66], [178, 62], [160, 58], [156, 52], [142, 52], [140, 46], [130, 42], [128, 35], [122, 38], [122, 30], [120, 22], [108, 20], [106, 10], [100, 13], [103, 2], [98, 8], [98, 16], [92, 22], [88, 22], [80, 15], [77, 8], [72, 20], [67, 25], [60, 25], [60, 50]] },
  { r: 'as', p: [[130, 31], [135, 34], [141, 38], [142, 44], [145, 44], [140, 36], [135, 32]] }, { r: 'as', p: [[95, 5], [105, -6], [103, -4], [98, 2]] },
  { r: 'as', p: [[109, 1], [117, 7], [119, 0], [116, -4], [110, -3]] }, { r: 'as', p: [[105, -6], [114, -8], [114, -7]] }, { r: 'as', p: [[120, 18], [122, 18], [126, 8], [122, 7]] },
];
function inside(p: Poly, x: number, y: number) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const COLS = 100, ROWS = 46, CW = 8, W = COLS * CW, H = ROWS * CW; let DOTS: { x: number; y: number; r: RegionId }[] | null = null;
function dots() {
  if (DOTS) return DOTS; DOTS = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const lon = -180 + (i + .5) * (360 / COLS), lat = 82 - (j + .5) * (142 / ROWS); const hit = POLYS.find(q => inside(q.p, lon, lat)); if (hit) DOTS.push({ x: i * CW + CW / 2, y: j * CW + CW / 2, r: hit.r }); }
  return DOTS;
}
const proj = (lon: number, lat: number) => [((lon + 180) / 360) * W, ((82 - lat) / 142) * H];
const PINS: Record<RegionId, [number, number]> = { na: [-100, 40], sa: [-58, -14], eu: [12, 50], as: [105, 34], af: [20, 5], me: [47, 28], oc: [134, -26] };
const sel = () => (ui.sel.world ||= { region: null as RegionId | null });
const selRegion = (s: GameState): RegionId => sel().region || s.co.hq;

function mapSvg(s: GameState): string {
  const cur = selRegion(s);
  const circles = dots().map(d => { const rs = s.regions[d.r]; const p = rs.presence; const op = p > 0 ? .4 + .6 * (p / 100) : .34; return `<circle class="d r-${d.r}" data-act="world-pick" data-r="${d.r}" cx="${d.x}" cy="${d.y}" r="2.7" fill="${REGION[d.r].color}" opacity="${op.toFixed(2)}"/>`; }).join('');
  const pins = REGIONS.map(r => { const rs = s.regions[r.id]; if (rs.office < 1) return ''; const [x, y] = proj(...PINS[r.id]); const hq = r.id === s.co.hq; return `<g pointer-events="none"><circle class="pulse" cx="${x}" cy="${y}" r="6" fill="${s.co.color}" opacity=".7"/><circle cx="${x}" cy="${y}" r="${hq ? 5.5 : 4}" fill="${s.co.color}" stroke="#fff" stroke-width="1.5"/>${hq ? `<text x="${x}" y="${y - 10}" style="fill:#fff">★ HQ</text>` : ''}</g>`; }).join('');
  const labels = REGIONS.map(r => { const [x, y] = proj(...PINS[r.id]); return `<text x="${x}" y="${y + 24}">${r.short} · ${s.regions[r.id].presence.toFixed(0)}%</text>`; }).join('');
  return `<div class="mapbox"><svg class="wmap" viewBox="0 0 ${W} ${H}" data-hover="" data-sel="${cur}">${circles}${labels}${pins}</svg>
  <div class="maplegend"><span><i style="background:${s.co.color}"></i>Your offices</span><span>Brighter dots = stronger market presence</span><span>Click a region</span></div></div>`;
}

function xrows(s: GameState, r: RegionId): string {
  const rs = s.regions[r]; const cur = rs.target; const home = s.co.hq === r;
  return EXPANSIONS.map(e => {
    const done = home && (e.id === 'office' || (e.id === 'hq' && rs.office >= 2)) ? true : has(rs, e.id); const needOK = !e.needs || has(rs, e.needs) || home;
    const cost = expansionCost(s, r, e.id); const mc = expansionMonthly(s, r, e.id);
    const after = computeTarget(s, r, { [e.id]: true } as any); const gain = Math.max(0, after - cur); const can = !done && needOK && (s.sandboxCash || s.fin.cash >= cost);
    const hqMissing = e.id === 'hq' && rs.office < 1 && !home;
    return `<div class="xrow ${done ? 'done' : ''}"><span class="xi">${e.icon}</span><div><b>${e.name}</b> ${done ? badge('Active', 'good') : !needOK || hqMissing ? badge(`Needs ${EXP[e.needs || 'office'].name}`, 'warn') : ''}<small>${e.desc}</small>${!done ? `<small class="num">Cost ${money(cost)} · ${money(mc)}/mo · target presence ${cur.toFixed(0)}% → <b class="pos">${after.toFixed(0)}% (+${gain.toFixed(0)})</b></small>` : `<small class="num">${money(mc)}/mo</small>`}</div>${done ? '' : btn('Build', 'world-buy', { r, k: e.id }, can ? 'primary sm' : 'sm', !needOK || hqMissing, can ? '' : needOK ? 'Not enough cash' : '')}</div>`;
  }).join('');
}

function detail(s: GameState, r: RegionId): string {
  const d = REGION[r]; const rs = s.regions[r]; const st = regionStats(s).find(x => x.id === r)!;
  const rivalsHere = s.rivals.filter(x => x.status === 'active' && x.kind === 'major' && x.hq === r).map(x => esc(x.short)).join(', ') || '—';
  const row = (l: string, v: number, txt: string, color = 'var(--accent)') => `<div class="rstat"><span>${l}</span>${bar(v * 100, 100, color, '', 6)}<b>${txt}</b></div>`;
  return panel(`${d.name}`, `<p class="dim">${d.blurb}</p>
  ${row('Market size', d.pop / .34, `${(d.pop * 100).toFixed(0)}%`)}${row('Purchasing power', Math.min(1, d.power / 1.4), d.power.toFixed(2) + '×', '#2ee6a6')}${row('Labor cost', Math.min(1, d.labor / 1.4), d.labor.toFixed(2) + '×', '#ffb703')}${row('Corporate tax', d.tax / .35, `${(d.tax * 100).toFixed(0)}%`, '#ffb703')}${row('Regulation', d.regulation, `${(d.regulation * 100).toFixed(0)}`, '#ff5d73')}${row('Infrastructure', d.infra, `${(d.infra * 100).toFixed(0)}`, '#4cc9f0')}${row('Competition', d.competition, `${(d.competition * 100).toFixed(0)}`, '#ff5d73')}
  <div class="stat-row"><span>Customer preference</span><b>${d.premiumBias > .1 ? 'Premium-leaning' : d.premiumBias < -.1 ? 'Value-seeking' : 'Balanced'}</b></div>
  <div class="stat-row"><span>Local rival HQs</span><b>${rivalsHere}</b></div><div class="stat-row"><span>Avg rival reach here</span><b class="num">${(st.rivalStrength * 100).toFixed(0)}%</b></div>
  <div class="kl mt">Your position</div>
  ${row('Presence', rs.presence / 100, `${rs.presence.toFixed(0)}%`, s.co.color)}${row('Target', rs.target / 100, `${rs.target.toFixed(0)}%`, '#7c5cff')}
  <div class="stat-row"><span>Revenue / mo</span><b class="num">${money(st.revenue)}</b></div><div class="stat-row"><span>Regional costs / mo</span><b class="num">${money(st.monthlyCost)}</b></div><div class="stat-row"><span>Regulatory risk</span><b class="num">${rs.regulationRisk.toFixed(0)}</b></div>
  <div class="kl mt">Expansion options</div>${xrows(s, r)}`);
}
function ranking(s: GameState): string {
  const st = regionStats(s).sort((a, b) => b.score - a.score);
  const hint = (x: typeof st[0]) => (x.next ? `${EXP[x.next].name}` : 'Fully built');
  return table(['#', 'Region', 'Opportunity', 'Presence', 'Rivals', 'Revenue/mo', 'Next step', ''], st.map((x, i) => [`${i + 1}`, `<b style="color:${REGION[x.id].color}">${REGION[x.id].name}</b>`, `<div style="width:110px">${bar(x.score, st[0].score, scoreColor(x.score / st[0].score * 100), '', 6)}</div>`, `<span class="num">${x.presence.toFixed(0)}% → ${x.target.toFixed(0)}%</span>`, `<span class="num">${(x.rivalStrength * 100).toFixed(0)}%</span>`, `<span class="num">${money(x.revenue)}</span>`, hint(x), btn('Open', 'world-pick', { r: x.id }, 'sm ghost')]), 'click', ['', '', '', '', 'r', 'r', '', 'r']);
}

registerView({
  id: 'world', title: 'World Map', icon: '🌍', group: 'world', order: 1,
  render: () => {
    const s = S(); const r = selRegion(s); const st = regionStats(s);
    const offices = REGIONS.filter(x => s.regions[x.id].office >= 1).length;
    const kp = `<div class="kpis mb">${kpi('Regions served', `${REGIONS.filter(x => s.regions[x.id].presence > 5).length} / 7`, `${offices} with offices`)}${kpi('Global access', (presenceWeight(s) * 100).toFixed(0) + '%', 'population-weighted presence')}${kpi('Regional costs', money(st.reduce((a, x) => a + x.monthlyCost, 0)) + '/mo', 'offices, distribution, partners')}${kpi('Foreign revenue', money(st.filter(x => x.id !== s.co.hq).reduce((a, x) => a + x.revenue, 0)), 'per month')}</div>`;
    return pageHead('Global Expansion', 'Presence determines which customers can buy from you. Each region differs in size, wealth, regulation and competition.') + kp
      + `<div class="grid g32"><div class="col" style="gap:14px">${mapSvg(s)}${panel('Global strategy — best regions to enter', ranking(s), '', 'flat')}</div>${detail(s, r)}</div>`;
  },
  mount: root => {
    const svg = root.querySelector('.wmap') as SVGElement | null; if (!svg) return;
    svg.addEventListener('mouseover', e => { const t = (e.target as Element).closest('[data-r]') as HTMLElement | null; svg.setAttribute('data-hover', t?.dataset.r || ''); });
    svg.addEventListener('mouseleave', () => svg.setAttribute('data-hover', ''));
  },
});
registerActions({
  'world-pick': el => { sel().region = el.dataset.r as RegionId; },
  'world-buy': el => { const r = buy(S(), el.dataset.r as RegionId, el.dataset.k as ExpansionKind); if (!r.ok) { app.toast(r.msg, 'warn'); app.sfx('error'); } },
});
