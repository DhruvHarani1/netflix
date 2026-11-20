// Formatting + HTML-string helpers shared by all views.
import { ui, S } from './state';
import { dateOf, MONTHS } from '../sim/util';

export const esc = (x: any) => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function money(n: number, d = 1): string {
  if (!isFinite(n)) return '—'; const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e12) return `${sg}$${(a / 1e12).toFixed(2)}T`; if (a >= 1e9) return `${sg}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : d + 1)}B`;
  if (a >= 1e6) return `${sg}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : d)}M`; if (a >= 1e4) return `${sg}$${(a / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${sg}$${(a / 1e3).toFixed(1)}K`; return `${sg}$${a.toFixed(a < 10 && a % 1 ? 2 : 0)}`;
}
export const moneyFull = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export function num(n: number, d = 1): string {
  if (!isFinite(n)) return '—'; const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e12) return `${sg}${(a / 1e12).toFixed(2)}T`; if (a >= 1e9) return `${sg}${(a / 1e9).toFixed(2)}B`; if (a >= 1e6) return `${sg}${(a / 1e6).toFixed(d + 1)}M`;
  if (a >= 1e4) return `${sg}${(a / 1e3).toFixed(0)}K`; if (a >= 1e3) return `${sg}${(a / 1e3).toFixed(1)}K`; return `${sg}${a % 1 ? a.toFixed(d) : a.toFixed(0)}`;
}
export const int = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const pct100 = (x: number, d = 0) => `${x.toFixed(d)}%`;
export const sgn = (n: number, f: (n: number) => string = money) => (n > 0 ? '+' : '') + f(n);
export const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
export function fmtDay(day: number) { const t = dateOf(day); return `${MONTHS[t.m]} ${t.d}, ${t.y}`; }
export const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
export const px = (n: number) => `$${n >= 1 ? n.toFixed(2) : n.toFixed(3)}`;

// ---------- HTML builders -------------------------------------------------
export const btn = (label: string, act: string, data: Record<string, any> = {}, cls = '', disabled = false, title = '') =>
  `<button class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${disabled ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`;
export const badge = (t: string, c = '') => `<span class="badge ${c}">${t}</span>`;
export function bar(v: number, max = 100, color = 'var(--accent)', label = '', h = 6): string {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar" style="height:${h}px"><i style="width:${p}%;background:${color}"></i></div>${label ? `<div class="barlbl">${label}</div>` : ''}`;
}
export const kpi = (label: string, value: string, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="kl">${label}</div><div class="kv num">${value}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div>`;
export const panel = (title: string, body: string, right = '', cls = '') => `<section class="panel ${cls}"><header><h3>${title}</h3><div class="pr">${right}</div></header><div class="pb">${body}</div></section>`;
export function tabs(view: string, items: [string, string][], def?: string): string {
  const cur = ui.tab[view] || def || items[0][0];
  return `<nav class="tabs">${items.map(([k, l]) => `<button class="tab ${k === cur ? 'on' : ''}" data-act="tab" data-view="${view}" data-key="${k}">${l}</button>`).join('')}</nav>`;
}
export const curTab = (view: string, def: string) => ui.tab[view] || def;
export function table(head: string[], rows: string[][], cls = '', aligns: string[] = []): string {
  return `<table class="tbl ${cls}"><thead><tr>${head.map((h, i) => `<th class="${aligns[i] || ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${aligns[i] || ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
export const empty = (t: string, sub = '') => `<div class="empty"><div>${t}</div>${sub ? `<small>${sub}</small>` : ''}</div>`;
export const pageHead = (title: string, sub = '', right = '') => `<div class="phead"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="pr">${right}</div></div>`;
export const slider = (id: string, v: number, min: number, max: number, step: number, label = '', fmtv = '') =>
  `<label class="slider"><span>${label}</span><input type="range" data-input="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><b class="num" data-for="${id}">${fmtv || v}</b></label>`;
export function logo(idx: number, color: string, size = 32): string {
  const shapes = [
    '<path d="M6 26 L16 6 L26 26 L16 20Z"/>', '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4" fill="#0c0f14"/>', '<rect x="6" y="6" width="20" height="20" rx="5"/><path d="M12 20 L16 11 L20 20" stroke="#0c0f14" stroke-width="2.4" fill="none"/>',
    '<path d="M16 5 L27 11 V21 L16 27 L5 21 V11Z"/>', '<path d="M5 22 C8 8,14 8,16 16 S24 24,27 10" stroke-width="4" stroke-linecap="round" fill="none"/>', '<path d="M16 4 L19 13 L28 16 L19 19 L16 28 L13 19 L4 16 L13 13Z"/>',
    '<rect x="5" y="5" width="9" height="22" rx="2"/><rect x="18" y="5" width="9" height="13" rx="2"/>', '<path d="M5 8 H27 L16 27Z"/>', '<circle cx="11" cy="16" r="7"/><circle cx="21" cy="16" r="7" opacity=".65"/>',
    '<path d="M6 6 H20 A6 6 0 0 1 20 18 H12 V26 H6Z"/>', '<path d="M16 5 A11 11 0 1 0 27 16 H16Z"/>', '<path d="M6 16 L16 6 L26 16 L16 26Z"/><circle cx="16" cy="16" r="3.5" fill="#0c0f14"/>',
  ];
  const sh = shapes[((idx % shapes.length) + shapes.length) % shapes.length];
  const stroke = sh.includes('fill="none"') && !sh.includes('stroke="#0c0f14"') ? `stroke="${color}"` : '';
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 32 32" fill="${color}" ${stroke}>${sh}</svg>`;
}
export function confetti(n = 46): string {
  const cols = ['#4cc9f0', '#7c5cff', '#2ee6a6', '#ffb703', '#ff4d6d', '#c77dff'];
  let h = '<div class="confetti">';
  for (let i = 0; i < n; i++) h += '<i style="left:' + ((i * 37 + (i % 7) * 11) % 100) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (((i * 13) % 20) / 10) + 's;animation-duration:' + (2.2 + (i % 5) * 0.35) + 's;transform:rotate(' + (i * 25) + 'deg)"></i>';
  return h + '</div>';
}
export const tip = (text: string) => `<span class="tip" data-tip="${esc(text)}">ⓘ</span>`;
export function scoreColor(v: number): string { return v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)'; }
export function companyName() { return esc(S().co.name); }

// ---------- action registry ----------------------------------------------
export type ActionFn = (el: HTMLElement, ev: Event) => void;
export const actions: Record<string, ActionFn> = {};
export function registerActions(a: Record<string, ActionFn>) { Object.assign(actions, a); }
/** Input handlers: fire on 'input' (live) for elements with data-input="name". */
export const inputs: Record<string, (el: HTMLInputElement, ev: Event) => void> = {};
export function registerInputs(a: Record<string, (el: HTMLInputElement, ev: Event) => void>) { Object.assign(inputs, a); }

// ---------- view registry --------------------------------------------------
export interface ViewDef { id: string; title: string; icon: string; group: string; render: () => string; mount?: (root: HTMLElement) => void; badge?: () => string | number | null; order?: number }
export const views: Record<string, ViewDef> = {};
export function registerView(v: ViewDef) { views[v.id] = v; }

// ---------- app hooks (set by app.ts) -------------------------------------
export const app = {
  refresh: () => {}, toast: (_t: string, _tone: string = 'info') => {}, sfx: (_n: string) => {}, openModal: (_id: string, _r: () => string, _wide?: boolean) => {}, closeModal: () => {}, go: (_v: string) => {},
  confirm: (_title: string, _body: string, _ok: () => void, _label = 'Confirm') => {},
  save: (_slot?: number) => {},
};
