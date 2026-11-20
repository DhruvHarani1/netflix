// Main menu, company creation wizard, save/load, settings, help.
import { ui, G, S } from './state';
import { esc, money, logo, btn, badge, registerInputs, app, fmtDay, num } from './kit';
import { BRAND_COLORS, LOGOS, REGIONS, CITIES, SPECIALIZATIONS, DIFFS, CAPITALS, SPEC, DIFF, REGION } from '../data/core';
import { CAT } from '../data/categories';
import { newGame } from '../sim/state';
import { getMeta, saveGame, loadGame, deleteSave, SLOTS, latestSave, serialize, deserialize } from '../sim/save';
import { playSfx } from './audio';
import type { RegionId, SpecId, Difficulty } from '../sim/types';
import { startGame, toMenu, applySettings, pushToast } from './app';

// -------------------------------------------------------------------- menu --
export function renderMenu(inner = false): string {
  const last = latestSave();
  const body = `<div class="menu-box">
    <div class="menu-logo"><svg width="54" height="54" viewBox="0 0 32 32"><defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc9f0"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><path d="M4 22 L12 8 L17 17 L22 6 L28 22 L22 18 L17 26 L12 18Z" fill="url(#mg)"/></svg></div>
    <h1 class="menu-title">TECH <span>TYCOON</span></h1>
    <p class="menu-sub">Found. Build. Disrupt. Rule the future.</p>
    <div class="menu-btns">
      ${last ? btn(`▶ Continue <small>${esc(last.name)} · ${fmtDay(last.day)}</small>`, 'menu-continue', {}, 'primary xl') : ''}
      ${btn('✦ New Game', 'menu-new', {}, last ? 'xl' : 'primary xl')}
      ${btn('📂 Load Game', 'open-load', {}, 'xl')}
      ${btn('⚙ Settings', 'open-settings', {}, 'xl')}
      ${btn('❓ How to Play', 'open-help', {}, 'xl')}
    </div>
    <div class="menu-foot">v1.0 · All progress is saved in your browser · <a href="#" data-act="menu-import">Import save file</a></div>
  </div>`;
  return inner ? body : `<div id="menu"><canvas id="menubg"></canvas><div id="menu-panel">${body}</div></div>`;
}
let bgRaf = 0;
export function mountMenu() {
  const cv = document.getElementById('menubg') as HTMLCanvasElement | null; if (!cv) return; cancelAnimationFrame(bgRaf);
  const ctx = cv.getContext('2d')!; let W = 0, H = 0;
  const fit = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }; fit(); window.addEventListener('resize', fit);
  const pts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .00015, vy: (Math.random() - .5) * .00015 }));
  const line: number[] = Array.from({ length: 80 }, (_, i) => 0.62 + Math.sin(i / 6) * .05 + Math.random() * .03 + i * .0012);
  let t = 0;
  const frame = () => {
    if (!document.getElementById('menubg')) return; t++;
    ctx.clearRect(0, 0, W, H); const reduce = ui.settings.reduceMotion;
    // grid
    ctx.strokeStyle = 'rgba(120,150,255,.06)'; ctx.lineWidth = 1; for (let x = (t * .2) % 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // network
    for (const p of pts) { if (!reduce) { p.x += p.vx * 16; p.y += p.vy * 16; } if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = (pts[i].x - pts[j].x) * W, dy = (pts[i].y - pts[j].y) * H; const d = Math.hypot(dx, dy); if (d < 170) { ctx.strokeStyle = `rgba(76,201,240,${(1 - d / 170) * .22})`; ctx.beginPath(); ctx.moveTo(pts[i].x * W, pts[i].y * H); ctx.lineTo(pts[j].x * W, pts[j].y * H); ctx.stroke(); } }
    for (const p of pts) { ctx.fillStyle = 'rgba(124,92,255,.7)'; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2, 0, 7); ctx.fill(); }
    // stock line
    if (t % 18 === 0 && !reduce) { line.shift(); line.push(Math.max(.35, Math.min(.85, line[line.length - 1] + (Math.random() - .46) * .03))); }
    const g = ctx.createLinearGradient(0, H * .3, 0, H); g.addColorStop(0, 'rgba(46,230,166,.18)'); g.addColorStop(1, 'rgba(46,230,166,0)');
    ctx.beginPath(); line.forEach((v, i) => { const x = (i / (line.length - 1)) * W, y = (1 - v) * H * 1.2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = 'rgba(46,230,166,.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fillStyle = g; ctx.fill();
    bgRaf = requestAnimationFrame(frame);
  }; frame();
}

// --------------------------------------------------------- company creation --
interface Draft { step: number; name: string; slogan: string; founder: string; color: string; logo: number; hq: RegionId; city: string; spec: SpecId; diff: Difficulty; cap: string }
const NAMES_A = ['Nova', 'Quantum', 'Apex', 'Helix', 'Vertex', 'Lumen', 'Zenith', 'Orbit', 'Pulse', 'Atlas', 'Cipher', 'Nimbus', 'Vector', 'Aether', 'Kinetic', 'Prism', 'Solace', 'Ember', 'Halcyon', 'Tesseract'];
const NAMES_B = ['Labs', 'Systems', 'Dynamics', 'Works', 'Industries', 'Computing', 'Technologies', 'Devices', 'Networks', 'Robotics', 'Digital', 'Logic', 'Silicon', 'Cloud', 'Foundry'];
const SLOGANS = ['Think different. Build bigger.', 'Technology for tomorrow.', 'Moving fast, building things.', 'The future, shipped.', 'Where ideas compute.', 'Engineering the impossible.', 'Built to scale the world.'];
function draft(): Draft {
  if (!ui.sel.create) ui.sel.create = { step: 0, name: '', slogan: '', founder: '', color: BRAND_COLORS[0], logo: 0, hq: 'na', city: 'San Francisco', spec: 'software', diff: 'normal', cap: 'seed' } as Draft;
  return ui.sel.create as Draft;
}
export function renderCreate(): string {
  const d = draft(); const steps = ['Identity', 'Industry', 'Conditions', 'Launch'];
  const diff = DIFF[d.diff]; const cap = CAPITALS.find(c => c.id === d.cap)!; const sp = SPEC[d.spec];
  const startCash = Math.round(cap.amount * diff.capital * (sp.cashMult || 1) / 1000) * 1000;
  let body = '';
  if (d.step === 0) {
    body = `<div class="cgrid"><div class="cform">
      <label>Company name<div class="row"><input data-input="c-name" value="${esc(d.name)}" maxlength="28" placeholder="e.g. Nimbus Labs"><button class="btn sm" data-act="c-rand-name">🎲</button></div></label>
      <label>Slogan<div class="row"><input data-input="c-slogan" value="${esc(d.slogan)}" maxlength="60" placeholder="Your motto"><button class="btn sm" data-act="c-rand-slogan">🎲</button></div></label>
      <label>Founder & CEO<input data-input="c-founder" value="${esc(d.founder)}" maxlength="26" placeholder="Your name"></label>
      <label>Brand color</label><div class="swatches">${BRAND_COLORS.map(c => `<button class="sw ${c === d.color ? 'on' : ''}" style="background:${c}" data-act="c-color" data-v="${c}"></button>`).join('')}</div>
      <label>Logo</label><div class="logos">${Array.from({ length: LOGOS }, (_, i) => `<button class="lg ${i === d.logo ? 'on' : ''}" data-act="c-logo" data-v="${i}">${logo(i, d.color, 34)}</button>`).join('')}</div>
      <label>Headquarters region</label><div class="chips">${REGIONS.map(r => `<button class="chip ${r.id === d.hq ? 'on' : ''}" data-act="c-hq" data-v="${r.id}">${r.name}</button>`).join('')}</div>
      <label>City</label><div class="chips">${CITIES[d.hq].map(c => `<button class="chip ${c === d.city ? 'on' : ''}" data-act="c-city" data-v="${c}">${c}</button>`).join('')}</div>
    </div>
    <div class="cprev"><div class="idcard" style="--c:${d.color}"><div class="idtop">${logo(d.logo, d.color, 64)}</div><h2>${esc(d.name || 'Your Company')}</h2><p>${esc(d.slogan || 'Your slogan here')}</p><div class="idmeta"><span>Founder</span><b>${esc(d.founder || '—')}</b><span>HQ</span><b>${esc(d.city)}, ${REGION[d.hq].name}</b></div></div>
    <p class="dim sm">${REGION[d.hq].blurb} Labor cost ×${REGION[d.hq].labor.toFixed(2)}, corporate tax ${(REGION[d.hq].tax * 100).toFixed(0)}%.</p></div></div>`;
  } else if (d.step === 1) {
    body = `<p class="dim">Your specialization sets starting technology, your first products and where your team excels. You can expand into anything later.</p><div class="cards">${SPECIALIZATIONS.map(s => `<button class="scard ${s.id === d.spec ? 'on' : ''}" data-act="c-spec" data-v="${s.id}"><span class="si">${s.icon}</span><b>${s.name}</b><small>${s.blurb}</small><em>${s.perk}</em>${s.cashMult ? `<i>Capital ×${s.cashMult}</i>` : ''}</button>`).join('')}</div>`;
  } else if (d.step === 2) {
    body = `<div class="cgrid2"><div><h3>Difficulty</h3><div class="stack">${DIFFS.map(x => `<button class="opt ${x.id === d.diff ? 'on' : ''}" data-act="c-diff" data-v="${x.id}"><b>${x.name}</b><small>${x.blurb}</small><em>Rivals ×${x.rival} · Costs ×${x.cost} · Events ×${x.event}</em></button>`).join('')}</div></div>
    <div><h3>Starting capital</h3><div class="stack">${CAPITALS.map(c => `<button class="opt ${c.id === d.cap ? 'on' : ''}" data-act="c-cap" data-v="${c.id}"><b>${c.name} <span class="num">${money(Math.round(c.amount * diff.capital * (sp.cashMult || 1)))}</span></b><small>${c.blurb}</small><em>${c.emp} starting staff${c.debt ? ` · ${money(c.debt * diff.capital)} bank loan` : ''}</em></button>`).join('')}</div></div></div>`;
  } else {
    body = `<div class="review"><div class="idcard big" style="--c:${d.color}">${logo(d.logo, d.color, 72)}<h2>${esc(d.name || 'Unnamed Co.')}</h2><p>${esc(d.slogan || '')}</p></div>
    <div class="rgrid"><div><span>Founder</span><b>${esc(d.founder || 'The Founder')}</b></div><div><span>Headquarters</span><b>${esc(d.city)}</b></div><div><span>Industry</span><b>${sp.icon} ${sp.name}</b></div><div><span>Difficulty</span><b>${diff.name}</b></div><div><span>Starting cash</span><b class="num">${money(startCash)}</b></div><div><span>Starting team</span><b>${cap.emp} people</b></div>
    <div><span>First products</span><b>${sp.cats.length ? sp.cats.map(c => CAT[c].name).join(', ') : 'Research your first unlock'}</b></div><div><span>Perk</span><b>${sp.perk}</b></div></div>
    <p class="dim">Year 2026. Rivals are already shipping. Your runway is your first deadline.</p></div>`;
  }
  return `<div id="create"><div class="chead"><button class="btn ghost" data-act="c-back-menu">← Menu</button><h1>Found Your Company</h1><div class="csteps">${steps.map((s, i) => `<span class="${i === d.step ? 'on' : i < d.step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div></div>
  <div class="cbody">${body}</div><div class="cfoot">${d.step > 0 ? btn('← Back', 'c-prev', {}, 'ghost') : '<span></span>'}${d.step < 3 ? btn('Next →', 'c-next', {}, 'primary') : btn('🚀 Launch Company', 'c-launch', {}, 'primary xl')}</div></div>`;
}
registerInputs({
  'c-name': el => { draft().name = el.value; }, 'c-slogan': el => { draft().slogan = el.value; }, 'c-founder': el => { draft().founder = el.value; },
});

// ---------------------------------------------------------- modals ----------
function savesModal(mode: 'save' | 'load') {
  return () => {
    const rows = [...SLOTS, 'auto' as const].map(sl => {
      const m = getMeta(sl); const canSave = mode === 'save' && sl !== 'auto' && G.s;
      return `<div class="slot ${m ? '' : 'empty'}">${m ? `<div class="sl-logo">${logo(m.logo, m.color, 34)}</div><div class="sl-info"><b>${esc(m.name)}</b><small>${fmtDay(m.day)} · ${m.difficulty} · Stage ${m.stage}</small><small>${money(m.cash)} cash · ${money(m.valuation)} valuation · ${m.headcount} staff</small></div>` : `<div class="sl-info"><b>${sl === 'auto' ? 'Autosave' : 'Slot ' + sl}</b><small>Empty</small></div>`}
      <div class="sl-act">${canSave ? btn(m ? 'Overwrite' : 'Save', 'slot-save', { slot: sl }, 'primary sm') : ''}${m && mode === 'load' ? btn('Load', 'slot-load', { slot: sl }, 'primary sm') : ''}${m && sl !== 'auto' ? btn('✕', 'slot-del', { slot: sl }, 'ghost sm') : ''}</div></div>`;
    }).join('');
    return `<div class="mhead"><h2>${mode === 'save' ? 'Save Game' : 'Load Game'}</h2></div><div class="mbody slots">${rows}</div><div class="mfoot">${G.s ? btn('⬇ Export file', 'slot-export', {}, 'ghost') : ''}${btn('⬆ Import file', 'menu-import', {}, 'ghost')}${btn('Close', 'modal-close', {}, 'primary')}</div>`;
  };
}
function settingsModal() {
  const st = ui.settings;
  const row = (k: keyof typeof st, label: string, sub = '') => `<label class="setrow"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-change="set-toggle" data-k="${k}" ${st[k] ? 'checked' : ''}></label>`;
  return `<div class="mhead"><h2>Settings</h2></div><div class="mbody">
    ${row('sound', 'Sound effects', 'Short synthesised cues')}
    <label class="setrow"><span><b>Volume</b></span><input type="range" min="0" max="1" step="0.05" value="${st.volume}" data-input="set-vol"></label>
    ${row('autoPause', 'Pause on decisions', 'Stop time when an event needs your input')}
    ${row('autosave', 'Autosave', 'Saves to the Autosave slot as months pass')}
    <label class="setrow"><span><b>Autosave every</b><small>months</small></span><select data-change="set-autosave">${[1, 3, 6, 12].map(n => `<option ${n === st.autosaveMonths ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${row('reduceMotion', 'Reduce motion', 'Disable animations')}${row('bigText', 'Larger text', 'Accessibility')}${row('compact', 'Compact layout', 'Denser tables & panels')}${row('contrast', 'High contrast', 'Stronger text and borders')}
  </div><div class="mfoot">${btn('Done', 'modal-close', {}, 'primary')}</div>`;
}
function helpModal() {
  return `<div class="mhead"><h2>How to Play</h2></div><div class="mbody help">
  <h4>Goal</h4><p>Grow a tiny startup into a trillion-dollar technology empire. Stay solvent, ship products people want, out-research and out-maneuver rivals.</p>
  <h4>The loop</h4><ol><li><b>People</b> — hire engineers (and a researcher). Staff drive everything.</li><li><b>Products</b> — design a product, assign a team, fund it, test it, set a price, launch.</li><li><b>Research</b> — unlock technologies that raise your spec ceilings and open new product categories.</li><li><b>Market &amp; Marketing</b> — build awareness in the segments you target; premium and budget buyers respond differently.</li><li><b>Finance</b> — watch runway. Take loans, raise venture capital, or go public (IPO).</li><li><b>World &amp; M&amp;A</b> — expand regions, then buy rivals and startups.</li></ol>
  <h4>Controls</h4><div class="keys"><kbd>Space</kbd> pause/resume <kbd>1</kbd>-<kbd>4</kbd> speed 1×/2×/5×/10× <kbd>Esc</kbd> menu/close <kbd>Ctrl</kbd>+<kbd>S</kbd> save</div>
  <h4>Tips</h4><ul><li>Cash is king: payroll is paid daily. Keep 6+ months of runway.</li><li>A great product still fails without a team to build it, a price that fits its segment, awareness, and distribution in the region.</li><li>Rivals respond to you. Undercut them and they may undercut back.</li><li>Update products before they age — the market frontier keeps rising.</li></ul></div><div class="mfoot">${btn('Got it', 'modal-close', {}, 'primary')}</div>`;
}
function welcomeModal() {
  const s = S();
  return `<div class="mhead"><span class="mi">🚀</span><div><small>Welcome, ${esc(s.co.founder)}</small><h2>${esc(s.co.name)} is open for business</h2></div></div><div class="mbody help">
  <p>You have <b>${money(s.fin.cash)}</b> in the bank, a small office in ${esc(s.co.city)}, and a team ready to build. Time is <b>paused</b> — take a moment to plan.</p>
  <ol><li>Open <b>People</b> and check your team (hire a researcher if you have none).</li><li>Open <b>Products</b> → <i>New product</i>. Pick a category, spec it, assign engineers, and fund it.</li><li>Open <b>Research</b> and queue a technology.</li><li>Press <kbd>Space</kbd> to start time. Watch your cash — payroll is daily.</li></ol>
  <p class="dim">Follow the objectives on the Dashboard. Everything you do changes the simulation.</p></div><div class="mfoot">${btn('Let’s build', 'welcome-go', {}, 'primary xl')}</div>`;
}

// -------------------------------------------------------------- actions -----
export const menuActions: Record<string, (el: HTMLElement, ev?: Event) => void> = {
  'menu-new': () => { ui.screen = 'create'; ui.sel.create = null; },
  'c-back-menu': () => { ui.screen = 'menu'; },
  'menu-continue': () => { const m = latestSave(); if (!m) return; const s = loadGame(m.slot); if (s) { startGame(s, typeof m.slot === 'number' ? m.slot : 1); pushToast('Game loaded', 'good'); } else pushToast('Could not load save', 'bad'); },
  'open-load': () => app.openModal('load', savesModal('load')),
  'open-save': () => app.openModal('save', savesModal('save')),
  'open-settings': () => app.openModal('settings', settingsModal),
  'open-help': () => app.openModal('help', helpModal, true),
  'welcome-go': () => { ui.modal = null; },
  'slot-save': el => { const sl = +el.dataset.slot!; ui.slot = sl; app.save(sl); },
  'slot-load': el => { const sl = el.dataset.slot === 'auto' ? 'auto' : +el.dataset.slot!; const s = loadGame(sl as any); if (!s) { pushToast('Save is corrupted', 'bad'); return; } ui.modal = null; startGame(s, typeof sl === 'number' ? sl : 1); pushToast('Game loaded', 'good'); },
  'slot-del': el => { const sl: any = el.dataset.slot === 'auto' ? 'auto' : +el.dataset.slot!; app.confirm('Delete save?', 'This cannot be undone.', () => { deleteSave(sl); app.openModal(ui.screen === 'menu' ? 'load' : 'save', savesModal(ui.screen === 'menu' ? 'load' : 'save')); }, 'Delete'); },
  'slot-export': () => { const s = G.s; if (!s) return; const blob = new Blob([serialize(s)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${s.co.name.replace(/\W+/g, '_')}_${fmtDay(s.day).replace(/\W+/g, '')}.ttsave.json`; a.click(); URL.revokeObjectURL(a.href); },
  'menu-import': () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(t => { try { const s = deserialize(t); ui.modal = null; startGame(s, 1); pushToast('Save imported', 'good'); } catch (e: any) { pushToast('Invalid save file', 'bad'); } }); }; inp.click(); },
  'set-toggle': el => { (ui.settings as any)[el.dataset.k!] = (el as HTMLInputElement).checked; applySettings(); ui.modal = { id: 'settings', render: settingsModal }; },
  'set-autosave': el => { ui.settings.autosaveMonths = +(el as HTMLSelectElement).value; applySettings(); },
  // wizard
  'c-rand-name': () => { const r = (a: string[]) => a[Math.floor(Math.random() * a.length)]; draft().name = `${r(NAMES_A)} ${r(NAMES_B)}`; },
  'c-rand-slogan': () => { draft().slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]; },
  'c-color': el => { draft().color = el.dataset.v!; }, 'c-logo': el => { draft().logo = +el.dataset.v!; },
  'c-hq': el => { const d = draft(); d.hq = el.dataset.v as RegionId; d.city = CITIES[d.hq][0]; }, 'c-city': el => { draft().city = el.dataset.v!; },
  'c-spec': el => { draft().spec = el.dataset.v as SpecId; }, 'c-diff': el => { draft().diff = el.dataset.v as Difficulty; }, 'c-cap': el => { draft().cap = el.dataset.v!; },
  'c-next': () => { const d = draft(); if (d.step === 0 && !d.name.trim()) { pushToast('Give your company a name first', 'warn'); const r = (a: string[]) => a[Math.floor(Math.random() * a.length)]; d.name = `${r(NAMES_A)} ${r(NAMES_B)}`; } if (d.step === 0 && !d.founder.trim()) d.founder = 'Alex Morgan'; d.step = Math.min(3, d.step + 1); },
  'c-prev': () => { const d = draft(); d.step = Math.max(0, d.step - 1); },
  'c-launch': () => {
    const d = draft(); const s = newGame({ name: d.name.trim() || 'Nova Labs', slogan: d.slogan.trim() || 'Build the future.', founder: d.founder.trim() || 'Alex Morgan', color: d.color, logo: d.logo, hq: d.hq, city: d.city, spec: d.spec, difficulty: d.diff, capitalId: d.cap });
    startGame(s, 1); playSfx('launch'); app.openModal('welcome', welcomeModal, true);
  },
};
registerInputs({ 'set-vol': el => { ui.settings.volume = +el.value; applySettings(); playSfx('click'); } });
