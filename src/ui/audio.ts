// Tiny WebAudio synth — no asset files.  All sounds are short and quiet.
import { ui } from './state';
let ctx: AudioContext | null = null;
function ac(): AudioContext | null { try { if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; } }
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = .15, delay = 0, slide = 0) {
  const c = ac(); if (!c || !ui.settings.sound) return; const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  const v = vol * ui.settings.volume * 2; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .05);
}
export function playSfx(name: string) {
  if (!ui.settings.sound) return;
  switch (name) {
    case 'click': tone(660, .05, 'triangle', .07); break;
    case 'tick': tone(900, .03, 'square', .02); break;
    case 'success': tone(523, .09, 'sine', .12); tone(784, .14, 'sine', .12, .08); break;
    case 'error': tone(180, .18, 'sawtooth', .09, 0, .6); break;
    case 'warn': tone(330, .12, 'square', .06); tone(294, .16, 'square', .06, .1); break;
    case 'notify': tone(880, .08, 'sine', .1); tone(1175, .12, 'sine', .08, .07); break;
    case 'cash': tone(1318, .06, 'triangle', .09); tone(1760, .1, 'triangle', .09, .05); break;
    case 'hire': tone(440, .08, 'sine', .1); tone(554, .08, 'sine', .1, .07); tone(659, .12, 'sine', .1, .14); break;
    case 'research': tone(392, .1, 'sine', .1); tone(587, .1, 'sine', .1, .09); tone(784, .2, 'sine', .1, .18); break;
    case 'launch': [262, 330, 392, 523, 659].forEach((f, i) => tone(f, .35, 'triangle', .1, i * .09)); tone(1046, .6, 'sine', .08, .5); break;
    case 'achievement': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .22, 'sine', .1, i * .07)); break;
  }
}
