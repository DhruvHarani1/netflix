// UI shell: screens, nav, top bar, game loop, modals, toasts, input routing.
import { ui, G, S } from './state';
import { views, actions, inputs, app, esc, money, logo, fmtDay, badge, btn, num } from './kit';
import { drawAllCharts } from './charts';
import { playSfx } from './audio';
import { tick, advance } from '../sim/engine';
import { newGame } from '../sim/state';
import { botMonth } from '../sim/autopilot';
import { drainSignals, monthIndex } from '../sim/util';
import { saveGame, loadGame, saveSettings, loadSettings } from '../sim/save';
import { resolveEvent } from '../sim/events';
import { STAGES } from '../data/core';
import { renderMenu, renderCreate, mountMenu, menuActions } from './screens';
import './views';

export const DAY_MS = 700;
let acc = 0, lastT = performance.now(), lastRender = 0, lastMonth = -1, dirty = true, pointerDown = false;
const root = () => document.getElementById('app')!;

const GROUPS: [string, string][] = [['command', 'Command'], ['build', 'Build'], ['money', 'Capital'], ['market', 'Market'], ['world', 'World'], ['risk', 'Intel']];

// ------------------------------------------------------------------ hooks --
app.refresh = () => { dirty = true; renderNow(); };
app.toast = (text, tone = 'info') => pushToast(text, tone);
app.sfx = n => playSfx(n);
app.go = v => { if (views[v]) { ui.view = v; ui.modal = null; app.refresh(); const m = document.getElementById('view'); if (m) m.scrollTop = 0; } };
app.openModal = (id, render, wide) => { ui.modal = { id, render, wide }; playSfx('click'); renderNow(); };
app.closeModal = () => { ui.modal = null; renderNow(); };
app.confirm = (title, body, ok, label = 'Confirm') => {
  (window as any).__confirmOk = () => { ui.modal = null; ok(); renderNow(); };
  app.openModal('confirm', () => `<div class="mhead"><h2>${title}</h2></div><div class="mbody"><p>${body}</p></div><div class="mfoot">${btn('Cancel', 'modal-close', {}, 'ghost')}${btn(label, 'confirm-ok', {}, 'primary')}</div>`);
};
app.save = (slot) => {
  const s = G.s; if (!s) return; const r = saveGame(s, slot ?? (ui.slot || 1));
  if (r.ok) { pushToast(`Game saved to ${slot === 0 ? 'autosave' : 'slot ' + (slot ?? ui.slot)}`, 'good'); playSfx('success'); } else { pushToast(r.error || 'Save failed', 'bad'); playSfx('error'); }
};

// ----------------------------------------------------------------- toasts --
export function pushToast(text: string, tone = 'info') {
  ui.notes.unshift({ day: G.s?.day ?? 0, text, tone }); if (ui.notes.length > 80) ui.notes.pop();
  const el = document.getElementById('toasts'); if (!el) return;
  const d = document.createElement('div'); d.className = `toast ${tone}`; d.innerHTML = `<i></i><span>${esc(text)}</span>`; el.appendChild(d);
  while (el.children.length > 5) el.removeChild(el.firstChild!);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 4600);
}

// ------------------------------------------------------------------ boot ---
export function boot() {
  const saved = loadSettings(); if (saved) Object.assign(ui.settings, saved);
  applySettings();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('pointerdown', () => (pointerDown = true));
  document.addEventListener('pointerup', () => { pointerDown = false; });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => drawAllCharts());
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.s && ui.screen === 'game' && ui.settings.autosave) saveGame(G.s, 'auto'); });
  window.addEventListener('beforeunload', () => { if (G.s && ui.screen === 'game' && ui.settings.autosave && !G.s.gameOver) saveGame(G.s, 'auto'); });
  (window as any).__tt = { G, ui, tick, S, newGame, startGame, app, advance, bot: botMonth };
  renderNow();
  setInterval(loop, 40);
}
export function applySettings() {
  const b = document.body; b.classList.toggle('reduce', ui.settings.reduceMotion); b.classList.toggle('bigtext', ui.settings.bigText); b.classList.toggle('compact', ui.settings.compact); b.classList.toggle('contrast', ui.settings.contrast);
  saveSettings(ui.settings);
}
export function startGame(s: any, slot = 1) {
  G.s = s; ui.screen = 'game'; ui.view = 'dashboard'; ui.tab = {}; ui.sel = {}; ui.paused = true; ui.speed = 1; ui.modal = null; ui.slot = slot; lastMonth = monthIndex(s.day); acc = 0; ui.notes = [];
  renderNow();
}
export function toMenu() { ui.screen = 'menu'; ui.modal = null; ui.paused = true; renderNow(); }

// ------------------------------------------------------------------ loop ---
function loop() {
  const now = performance.now(); const dt = Math.min(250, now - lastT); lastT = now;
  const s = G.s;
  if (ui.screen === 'game' && s && !s.gameOver) {
    const blocked = !!ui.modal && ui.modal.id === 'decision';
    if (!ui.paused && !blocked) {
      acc += dt * ui.speed; let n = 0;
      while (acc >= DAY_MS && n < 6) { acc -= DAY_MS; tick(s); n++; }
      if (n) dirty = true;
      const mi = monthIndex(s.day);
      if (mi !== lastMonth) { lastMonth = mi; if (ui.settings.autosave && mi % Math.max(1, ui.settings.autosaveMonths) === 0) { saveGame(s, 'auto'); } }
    }
  }
  const sigs = drainSignals();
  for (const g of sigs) { if (g.type === 'toast') pushToast(g.text || '', g.tone || 'info'); else if (g.type === 'sfx' && g.sfx) playSfx(g.sfx); }
  if (sigs.length) dirty = true;
  if (ui.screen === 'game' && s) {
    // surface newly pending decisions
    const pend = s.events.pending.find(e => !e.resolved && e.choices.length > 0);
    if (pend && !ui.modal) { if (ui.settings.autoPause) ui.paused = true; openDecision(pend.uid); }
    if (s.gameOver && !ui.modal) openGameOver();
  }
  if (dirty && now - lastRender > (ui.paused ? 120 : 380)) renderNow();
}

// --------------------------------------------------------------- rendering --
function isEditing() { const a = document.activeElement as HTMLElement | null; return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && !!a.closest('#view, #modal') || pointerDown && !!document.querySelector('input[type=range]:active'); }
export function renderNow() {
  if (isEditing() && ui.screen === 'game' && !(window as any).__forceRender) { dirty = true; return; }
  lastRender = performance.now(); dirty = false;
  const r = root();
  document.body.dataset.screen = ui.screen;
  if (ui.screen === 'menu') { if (!r.querySelector('#menu')) { r.innerHTML = renderMenu(); mountMenu(); } else { const m = r.querySelector('#menu-panel'); if (m) m.innerHTML = renderMenu(true); } renderModal(); return; }
  if (ui.screen === 'create') { r.innerHTML = renderCreate(); renderModal(); return; }
  const s = G.s!;
  // frame (built once)
  if (!r.querySelector('#frame')) r.innerHTML = frame();
  r.querySelector('#nav')!.innerHTML = navHtml();
  r.querySelector('#top')!.innerHTML = topHtml();
  const v = views[ui.view] || views.dashboard;
  const vc = r.querySelector('#view') as HTMLElement; const st = vc.scrollTop;
  let html = ''; try { html = v.render(); } catch (e: any) { console.error(e); html = `<div class="panel"><div class="pb"><h3>View error</h3><pre>${esc(e?.stack || e)}</pre></div></div>`; }
  vc.innerHTML = html; vc.scrollTop = st;
  drawAllCharts(vc); try { v.mount?.(vc); } catch (e) { console.error(e); }
  const last = s.events.news[s.events.news.length - 1];
  (r.querySelector('#ticker') as HTMLElement).innerHTML = last ? `<b>${fmtDay(last.day)}</b> ${esc(last.headline)}` : `<b>${esc(s.co.name)}</b> ${esc(s.co.slogan)}`;
  renderModal();
}
function frame() {
  return `<div id="frame"><aside id="nav"></aside><div id="mainc"><header id="top"></header><main id="view"></main><footer id="ticker"></footer></div></div>`;
}
function navHtml(): string {
  const s = G.s!; let h = `<div class="brand" data-act="go" data-v="dashboard">${logo(s.co.logo, s.co.color, 30)}<div><b>${esc(s.co.name)}</b><small>${esc(STAGES[s.derived.stage - 1]?.name || '')}</small></div></div>`;
  for (const [gid, gname] of GROUPS) {
    const vs = Object.values(views).filter(v => v.group === gid).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); if (!vs.length) continue;
    h += `<div class="ngroup">${gname}</div>`;
    for (const v of vs) { const b = v.badge?.(); h += `<button class="nitem ${ui.view === v.id ? 'on' : ''}" data-act="go" data-v="${v.id}"><span class="ni">${v.icon}</span><span class="nl">${v.title}</span>${b ? `<em>${b}</em>` : ''}</button>`; }
  }
  h += `<div class="nfoot"><button class="nitem" data-act="open-menu"><span class="ni">☰</span><span class="nl">Menu</span></button></div>`;
  return h;
}
function topHtml(): string {
  const s = G.s!; const d = s.derived; const L = s.fin.ledger.last; const burn = L.rev - (L.cogs + Object.values(L.exp).reduce((a, b) => a + b, 0));
  const pend = s.events.pending.filter(e => !e.resolved && e.choices.length).length;
  const sp = [0, 1, 2, 5, 10];
  return `<div class="tk"><span class="tkl">CASH</span><b class="num ${s.fin.cash < 0 ? 'neg' : ''}">${money(s.fin.cash)}</b></div>
  <div class="tk"><span class="tkl">VALUATION</span><b class="num">${money(d.valuation)}</b></div>
  <div class="tk"><span class="tkl">LAST MONTH</span><b class="num ${burn >= 0 ? 'pos' : 'neg'}">${burn >= 0 ? '+' : ''}${money(burn)}</b></div>
  <div class="tk hide-sm"><span class="tkl">STAFF</span><b class="num">${num(d.headcount, 0)}</b></div>
  ${s.stock.public ? `<div class="tk hide-sm"><span class="tkl">${esc(s.co.name.slice(0, 4).toUpperCase())}</span><b class="num">$${s.stock.px.toFixed(2)}</b></div>` : ''}
  <div class="grow"></div>
  <div class="clock"><span class="num">${fmtDay(s.day)}</span><small>${s.mode === 'sandbox' ? 'Sandbox' : s.difficulty}</small></div>
  <div class="speed">${sp.map(v => `<button class="sp ${(v === 0 ? ui.paused : !ui.paused && ui.speed === v) ? 'on' : ''}" data-act="speed" data-v="${v}" title="${v === 0 ? 'Pause (Space)' : v + 'x'}">${v === 0 ? '❚❚' : v + '×'}</button>`).join('')}</div>
  <button class="icon-btn" data-act="notes" title="Notifications">🔔${ui.notes.length ? `<i>${Math.min(99, ui.notes.length)}</i>` : ''}</button>
  ${pend ? `<button class="btn warn sm" data-act="decide">⚡ ${pend} decision${pend > 1 ? 's' : ''}</button>` : ''}
  <button class="icon-btn" data-act="save-quick" title="Save (Ctrl+S)">💾</button>`;
}

// ------------------------------------------------------------------ modal --
function renderModal() {
  let m = document.getElementById('modal');
  if (!ui.modal) { if (m) m.remove(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
  let inner = ''; try { inner = ui.modal.render(); } catch (e: any) { inner = `<div class="mbody"><pre>${esc(e?.stack || e)}</pre></div>`; }
  const sc = (m.querySelector('.mcard') as HTMLElement | null)?.scrollTop || 0;
  m.innerHTML = `<div class="mback" data-act="modal-close-bg"></div><div class="mcard ${ui.modal.wide ? 'wide' : ''}">${inner}</div>`;
  const nc = m.querySelector('.mcard') as HTMLElement; if (nc) nc.scrollTop = sc; drawAllCharts(m);
}
function openDecision(uid: number) {
  ui.modal = { id: 'decision', wide: false, render: () => {
    const s = G.s!; const e = s.events.pending.find(x => x.uid === uid && !x.resolved); if (!e) { return `<div class="mbody">Resolved.</div><div class="mfoot">${btn('Close', 'modal-close', {}, 'primary')}</div>`; }
    return `<div class="mhead ${e.severity}"><span class="mi">${e.icon}</span><div><small>${fmtDay(e.day)} · decision required</small><h2>${esc(e.title)}</h2></div></div>
    <div class="mbody"><p>${esc(e.body)}</p><div class="choices">${e.choices.map((c, i) => `<button class="choice" data-act="decide-pick" data-uid="${uid}" data-i="${i}"><b>${esc(c.label)}</b><small>${esc(c.hint)}</small></button>`).join('')}</div></div>
    <div class="mfoot"><small>${e.deadline > s.day ? `Auto-resolves in ${e.deadline - s.day} days` : ''}</small>${btn('Decide later', 'modal-close', {}, 'ghost')}</div>`;
  } };
  playSfx('notify'); renderNow();
}
function openGameOver() {
  ui.paused = true;
  ui.modal = { id: 'gameover', render: () => { const s = G.s!; return `<div class="mhead bad"><span class="mi">💥</span><div><small>${fmtDay(s.gameOver!.day)}</small><h2>${esc(s.co.name)} has collapsed</h2></div></div><div class="mbody"><p>${esc(s.gameOver!.reason)}</p><p class="dim">Peak valuation ${money(s.meta.peak.valuation)} · ${s.products.filter(p => p.status === 'live').length} live products · ${s.derived.headcount} employees at the end.</p></div><div class="mfoot">${btn('Load last save', 'open-load', {}, 'ghost')}${btn('Main menu', 'to-menu', {}, 'primary')}</div>`; } };
  renderNow();
}

// --------------------------------------------------------------- input -----
function onClick(ev: MouseEvent) {
  const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!t) return;
  if ((t as HTMLButtonElement).disabled) return;
  const a = t.dataset.act!;
  if (a === 'modal-close-bg') { if (ui.modal && (ev.target as HTMLElement).classList.contains('mback')) { if (ui.modal.id !== 'gameover') { ui.modal = null; renderNow(); } } return; }
  const fn = core[a] || menuActions[a] || actions[a]; if (!fn) { console.warn('no action', a); return; }
  if (!['speed', 'tab-noclick'].includes(a)) playSfx('click');
  (window as any).__forceRender = true;
  try { fn(t, ev); } catch (e) { console.error('action failed', a, e); pushToast('Something went wrong: ' + (e as any)?.message, 'bad'); }
  (window as any).__forceRender = false;
  dirty = true; renderNow();
}
function onInput(ev: Event) {
  const t = ev.target as HTMLInputElement; const n = t.dataset?.input; if (!n) return;
  const h = inputs[n]; if (h) h(t, ev);
  const out = document.querySelector(`[data-for="${n}"]`); if (out && t.type === 'range') { /* views update label themselves via inputs handler */ }
}
function onChange(ev: Event) {
  const t = ev.target as HTMLElement; const a = (t as any).dataset?.change; if (!a) return;
  const fn = actions[a] || menuActions[a]; if (fn) { (window as any).__forceRender = true; try { fn(t, ev); } catch (e) { console.error(e); } (window as any).__forceRender = false; dirty = true; renderNow(); }
}
function onKey(ev: KeyboardEvent) {
  const tag = (ev.target as HTMLElement)?.tagName; if (/INPUT|TEXTAREA|SELECT/.test(tag)) { if (ev.key === 'Escape') (ev.target as HTMLElement).blur(); return; }
  if (ev.key === 's' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); if (ui.screen === 'game') app.save(ui.slot || 1); return; }
  if (ui.screen !== 'game') return;
  if (ev.key === 'Escape') { if (ui.modal && ui.modal.id !== 'gameover' && ui.modal.id !== 'decision') { ui.modal = null; renderNow(); } else if (!ui.modal) core['open-menu'](document.body, ev); return; }
  if (ui.modal) return;
  if (ev.key === ' ') { ev.preventDefault(); ui.paused = !ui.paused; renderNow(); }
  else if ('1234'.includes(ev.key) && ev.key.length === 1) { ui.speed = [1, 2, 5, 10][+ev.key - 1]; ui.paused = false; renderNow(); }
  else if (ev.key === 'f') { ui.speed = Math.min(10, ui.speed === 5 ? 10 : ui.speed === 2 ? 5 : ui.speed === 1 ? 2 : 10); }
}

// ------------------------------------------------------------ core actions --
const core: Record<string, (el: HTMLElement, ev?: Event) => void> = {
  go: el => app.go(el.dataset.v!),
  tab: el => { ui.tab[el.dataset.view!] = el.dataset.key!; },
  speed: el => { const v = +el.dataset.v!; if (v === 0) ui.paused = true; else { ui.paused = false; ui.speed = v; } },
  'modal-close': () => { ui.modal = null; },
  'confirm-ok': () => (window as any).__confirmOk?.(),
  'save-quick': () => app.save(ui.slot || 1),
  'to-menu': () => { if (G.s && !G.s.gameOver && ui.settings.autosave) saveGame(G.s, 'auto'); toMenu(); },
  decide: () => { const e = G.s!.events.pending.find(x => !x.resolved && x.choices.length); if (e) openDecision(e.uid); },
  'decide-pick': el => { const s = G.s!; resolveEvent(s, +el.dataset.uid!, +el.dataset.i!); ui.modal = null; playSfx('success'); },
  notes: () => {
    app.openModal('notes', () => `<div class="mhead"><h2>Notifications</h2></div><div class="mbody notes">${ui.notes.length ? ui.notes.map(n => `<div class="note ${n.tone}"><small>${fmtDay(n.day)}</small>${esc(n.text)}</div>`).join('') : '<p class="dim">Nothing yet.</p>'}</div><div class="mfoot">${btn('Clear', 'notes-clear', {}, 'ghost')}${btn('Close', 'modal-close', {}, 'primary')}</div>`);
  },
  'notes-clear': () => { ui.notes = []; ui.modal = null; },
  'open-menu': () => { ui.paused = true; app.openModal('pause', () => `<div class="mhead"><h2>${esc(G.s!.co.name)}</h2></div><div class="mbody menu-list">
    ${btn('▶ Resume', 'modal-close', {}, 'primary')}${btn('💾 Save game', 'open-save')}${btn('📂 Load game', 'open-load')}${btn('⚙ Settings', 'open-settings')}${btn('❓ How to play', 'open-help')}${btn('⏏ Save & quit to menu', 'to-menu', {}, 'ghost')}</div>`); },
};
export { startGame as _start };
