// Canvas chart library: line / area / bar / candle, crosshair tooltips, DPR-aware.
export interface Series { name: string; color: string; data: number[]; fill?: boolean; dash?: boolean; width?: number; bar?: boolean }
export interface Candle { o: number; h: number; l: number; c: number }
export interface ChartCfg {
  type?: 'line' | 'bar' | 'candle'; series?: Series[]; candles?: Candle[]; labels?: string[];
  fmt?: (v: number) => string; min?: number; max?: number; zero?: boolean; stacked?: boolean; legend?: boolean; grid?: boolean; baseline?: number;
}
type Factory = () => ChartCfg;
const registry = new Map<string, Factory>();
const hover = new Map<string, number>();

/** Returns canvas HTML and registers its config factory. Call drawAllCharts(root) after inserting HTML. */
export function chart(id: string, factory: Factory, h = 170, cls = ''): string {
  registry.set(id, factory);
  return `<div class="chartwrap ${cls}" style="height:${h}px"><canvas class="chart" data-chart="${id}"></canvas></div>`;
}
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

export function drawAllCharts(root: ParentNode = document) {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-chart]').forEach(cv => draw(cv));
}
function draw(cv: HTMLCanvasElement) {
  const f = registry.get(cv.dataset.chart || ''); if (!f) return;
  const wrap = cv.parentElement!; const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  const ctx = cv.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  let cfg: ChartCfg; try { cfg = f(); } catch { return; }
  render(ctx, cfg, w, h, hover.get(cv.dataset.chart || '') ?? -1);
  if (!(cv as any)._hooked) {
    (cv as any)._hooked = true;
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); const n = count(f()); const padL = 52; const x = e.clientX - r.left; const frac = (x - padL) / Math.max(1, r.width - padL - 10); const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))); hover.set(cv.dataset.chart || '', i); draw(cv); });
    cv.addEventListener('mouseleave', () => { hover.delete(cv.dataset.chart || ''); draw(cv); });
  }
}
const count = (c: ChartCfg) => (c.candles ? c.candles.length : Math.max(0, ...(c.series || []).map(s => s.data.length)));
function nice(v: number, up: boolean) { if (v === 0) return 0; const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v)))); const m = v / e; const n = up ? (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) : (m >= -1 ? -1 : m >= -2 ? -2 : m >= -5 ? -5 : -10); return v > 0 === up ? n * e : (v < 0 ? -Math.ceil(Math.abs(m)) * e : Math.floor(m) * e); }

function render(ctx: CanvasRenderingContext2D, cfg: ChartCfg, W: number, H: number, hi: number) {
  const padL = 52, padR = 10, padT = cfg.legend === false ? 8 : 22, padB = cfg.labels ? 20 : 8;
  if (!cfg.candles && cfg.series) for (const sr of cfg.series) if (sr.data.length === 1) sr.data = [sr.data[0], sr.data[0]];
  if (cfg.labels && cfg.labels.length === 1) cfg.labels = [cfg.labels[0], cfg.labels[0]];
  const n = count(cfg); const fmt = cfg.fmt || ((v: number) => v.toFixed(0));
  const txt = css('--text-dim'), grid = css('--line');
  ctx.font = '10.5px ui-monospace, "JetBrains Mono", Menlo, monospace'; ctx.textBaseline = 'middle';
  if (n < 2) { ctx.fillStyle = txt; ctx.textAlign = 'center'; ctx.fillText('Collecting data…', W / 2, H / 2); return; }
  // y range
  let lo = Infinity, hiV = -Infinity;
  if (cfg.candles) { for (const c of cfg.candles) { lo = Math.min(lo, c.l); hiV = Math.max(hiV, c.h); } }
  else if (cfg.stacked) { for (let i = 0; i < n; i++) { let t = 0; for (const s of cfg.series!) t += s.data[i] || 0; hiV = Math.max(hiV, t); lo = Math.min(lo, 0); } }
  else for (const s of cfg.series!) for (const v of s.data) { if (v < lo) lo = v; if (v > hiV) hiV = v; }
  if (cfg.zero || cfg.type === 'bar') { lo = Math.min(lo, 0); hiV = Math.max(hiV, 0); }
  if (cfg.min !== undefined) lo = cfg.min; if (cfg.max !== undefined) hiV = cfg.max;
  if (!isFinite(lo) || !isFinite(hiV)) return; if (hiV === lo) { hiV = lo + 1; lo = lo - (lo === 0 ? 0 : 1); }
  const span = hiV - lo; if (cfg.min === undefined && !cfg.zero && cfg.type !== 'bar') lo -= span * .06; if (cfg.max === undefined) hiV += span * .06;
  const cw = W - padL - padR, ch = H - padT - padB;
  const X = (i: number) => padL + (cfg.type === 'bar' ? (i + .5) / n : i / (n - 1)) * cw; const Y = (v: number) => padT + (1 - (v - lo) / (hiV - lo)) * ch;
  // grid + y labels
  ctx.textAlign = 'right'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) { const v = lo + ((hiV - lo) * g) / 4; const y = Y(v); ctx.strokeStyle = grid; ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = txt; ctx.fillText(fmt(v), padL - 6, y); }
  if (lo < 0 && hiV > 0) { ctx.strokeStyle = css('--text-dim'); ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke(); ctx.globalAlpha = 1; }
  // x labels
  if (cfg.labels) { ctx.textAlign = 'center'; ctx.fillStyle = txt; const k = Math.min(6, n); for (let j = 0; j < k; j++) { const i = Math.round((j / (k - 1)) * (n - 1)); ctx.fillText(cfg.labels[i] ?? '', Math.min(W - 24, Math.max(padL + 10, X(i))), H - 8); } }
  // series
  if (cfg.candles) {
    const bw = Math.max(1.5, Math.min(14, (cw / n) * .7)); const up = css('--good'), dn = css('--bad');
    cfg.candles.forEach((c, i) => { const x = padL + ((i + .5) / n) * cw; const col = c.c >= c.o ? up : dn; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke(); const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); ctx.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1)); });
  } else if (cfg.type === 'bar') {
    const ser = cfg.series!; const bw = Math.max(2, (cw / n) * .72 / (cfg.stacked ? 1 : ser.length));
    for (let i = 0; i < n; i++) { let acc = 0; ser.forEach((s, si) => { const v = s.data[i] || 0; ctx.fillStyle = v < 0 && !cfg.stacked ? css('--bad') : s.color; const x = X(i) - (cfg.stacked ? bw / 2 : (bw * ser.length) / 2 - si * bw); const y0 = Y(cfg.stacked ? acc : 0), y1 = Y(cfg.stacked ? acc + v : v); ctx.globalAlpha = hi >= 0 && hi !== i ? .72 : 1; ctx.fillRect(x, Math.min(y0, y1), bw - 1, Math.abs(y1 - y0)); acc += v; }); }
    ctx.globalAlpha = 1;
  } else {
    for (const s of cfg.series!) {
      const d = s.data; const off = n - d.length; ctx.beginPath();
      d.forEach((v, i) => { const x = X(i + off), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (s.fill) { const g = ctx.createLinearGradient(0, padT, 0, padT + ch); g.addColorStop(0, s.color + '55'); g.addColorStop(1, s.color + '00'); ctx.save(); ctx.lineTo(X(n - 1), Y(Math.max(lo, 0 > lo ? 0 : lo))); ctx.lineTo(X(off), Y(Math.max(lo, 0 > lo ? 0 : lo))); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore(); ctx.beginPath(); d.forEach((v, i) => { const x = X(i + off), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.8; ctx.lineJoin = 'round'; ctx.setLineDash(s.dash ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // legend
  if (cfg.legend !== false && cfg.series && cfg.series.length > 1) { ctx.textAlign = 'left'; let x = padL; ctx.font = '10.5px system-ui, sans-serif'; for (const s of cfg.series) { ctx.fillStyle = s.color; ctx.fillRect(x, 5, 9, 3); ctx.fillStyle = txt; ctx.fillText(s.name, x + 13, 7); x += ctx.measureText(s.name).width + 28; } ctx.font = '10.5px ui-monospace, monospace'; }
  // crosshair
  if (hi >= 0 && hi < n) {
    const x = cfg.type === 'bar' || cfg.candles ? padL + ((hi + .5) / n) * cw : X(hi);
    ctx.strokeStyle = css('--text'); ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ch); ctx.stroke(); ctx.globalAlpha = 1;
    const lines: [string, string][] = [];
    if (cfg.labels) lines.push([cfg.labels[hi] ?? '', css('--text')]);
    if (cfg.candles) { const c = cfg.candles[hi]; lines.push([`O ${fmt(c.o)}  H ${fmt(c.h)}`, css('--text')], [`L ${fmt(c.l)}  C ${fmt(c.c)}`, c.c >= c.o ? css('--good') : css('--bad')]); }
    else for (const s of cfg.series!) { const off = n - s.data.length; const v = s.data[hi - off]; if (v !== undefined) { lines.push([`${s.name}: ${fmt(v)}`, s.color]); if (s.data.length === n && !cfg.stacked) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, Y(v), 3.2, 0, 7); ctx.fill(); } } }
    ctx.font = '11px ui-monospace, monospace'; const tw = Math.max(...lines.map(l => ctx.measureText(l[0]).width)) + 16; const th = lines.length * 15 + 8;
    let bx = x + 12; if (bx + tw > W - 4) bx = x - tw - 12; const by = padT + 4;
    ctx.fillStyle = css('--panel-hi'); ctx.strokeStyle = css('--line'); ctx.beginPath(); (ctx as any).roundRect?.(bx, by, tw, th, 6); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; lines.forEach((l, i) => { ctx.fillStyle = l[1]; ctx.fillText(l[0], bx + 8, by + 13 + i * 15); });
  }
}
/** Tiny inline sparkline as an SVG string. */
export function spark(data: number[], color = 'var(--accent)', w = 90, h = 26): string {
  if (data.length < 2) return `<svg width="${w}" height="${h}"></svg>`;
  const lo = Math.min(...data), hi = Math.max(...data), sp = hi - lo || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / sp) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
export function donut(parts: { label: string; value: number; color: string }[], size = 120): string {
  const tot = parts.reduce((a, p) => a + p.value, 0) || 1; let a0 = -Math.PI / 2; const r = size / 2 - 6, c = size / 2; let out = '';
  for (const p of parts) { const a1 = a0 + (p.value / tot) * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0; if (p.value > 0) out += `<path d="M${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1 - 0.0001)} ${c + r * Math.sin(a1 - 0.0001)}" stroke="${p.color}" stroke-width="14" fill="none"/>`; a0 = a1; }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${out}</svg>`;
}
