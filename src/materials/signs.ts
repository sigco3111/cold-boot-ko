/**
 * Canvas-2D signage: industrial labels, warning / danger plates, directional room signs, stencilled
 * wall lettering. Wear (scratches, dirt, fading, chipped edges) is composited so they sit in the world.
 * The sign texture covers the whole quad (UV 0..1); `aspect` = quad width / height.
 */
import * as THREE from 'three';
import type { SignStyle } from '../core/types';

const SANS = '"Arial Narrow", "Helvetica Neue", "Roboto Condensed", Arial, sans-serif';
const MONO = 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
function hashStr(t: string) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

type Ctx = CanvasRenderingContext2D;

/** Fit text into a box by shrinking the font size. */
function fitText(g: Ctx, text: string, maxW: number, size: number, weight: string, family: string) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (g.measureText(text).width > maxW && s > 8) { s -= 1; g.font = `${weight} ${s}px ${family}`; }
  return s;
}

function drawStripes(g: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, period: number) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h);
  g.fillStyle = b;
  for (let i = -h; i < w + h; i += period) {
    g.beginPath();
    g.moveTo(x + i, y + h); g.lineTo(x + i + period / 2, y + h); g.lineTo(x + i + period / 2 + h, y); g.lineTo(x + i + h, y);
    g.closePath(); g.fill();
  }
  g.restore();
}

function warningTriangle(g: Ctx, cx: number, cy: number, size: number, fill: string, ink: string) {
  const h = size * 0.866;
  g.save();
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(cx, cy - h / 2); g.lineTo(cx + size / 2, cy + h / 2); g.lineTo(cx - size / 2, cy + h / 2); g.closePath();
  g.fillStyle = ink; g.fill();
  const s2 = size * 0.78, h2 = s2 * 0.866, oy = (h - h2) * 0.18;
  g.beginPath(); g.moveTo(cx, cy - h2 / 2 + oy); g.lineTo(cx + s2 / 2, cy + h2 / 2 - oy * 0.3); g.lineTo(cx - s2 / 2, cy + h2 / 2 - oy * 0.3); g.closePath();
  g.fillStyle = fill; g.fill();
  g.fillStyle = ink;
  g.font = `900 ${Math.round(size * 0.5)}px ${SANS}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!', cx, cy + h * 0.1);
  g.restore();
}

function arrow(g: Ctx, cx: number, cy: number, size: number, dir: 'left' | 'right' | 'up' | 'down', color: string) {
  g.save();
  g.translate(cx, cy);
  g.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir]);
  g.fillStyle = color;
  const s = size / 2;
  g.beginPath();
  g.moveTo(-s, -s * 0.28); g.lineTo(s * 0.15, -s * 0.28); g.lineTo(s * 0.15, -s * 0.75); g.lineTo(s, 0);
  g.lineTo(s * 0.15, s * 0.75); g.lineTo(s * 0.15, s * 0.28); g.lineTo(-s, s * 0.28); g.closePath();
  g.fill();
  g.restore();
}

function screw(g: Ctx, x: number, y: number, r: number, rand: () => number) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, '#b8bcbf'); gr.addColorStop(0.6, '#6a6e72'); gr.addColorStop(1, '#2a2c2e');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1b1c'; g.lineWidth = r * 0.25;
  const a = rand() * Math.PI;
  g.beginPath(); g.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7); g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); g.stroke();
  // rust halo
  const rg = g.createRadialGradient(x, y + r, 0, x, y + r * 2, r * 3);
  rg.addColorStop(0, 'rgba(90,45,20,0.35)'); rg.addColorStop(1, 'rgba(90,45,20,0)');
  g.fillStyle = rg; g.fillRect(x - r * 3, y - r, r * 6, r * 6);
}

/** Dirt, scratches, fading, edge grime. `rough` canvas gets matching roughness changes. */
function weather(g: Ctx, rg: Ctx, w: number, h: number, rand: () => number, amount: number, paintOnly = false) {
  // fading / chalking
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 18 * amount; i++) {
    const x = rand() * w, y = rand() * h, r = (0.1 + rand() * 0.35) * Math.max(w, h);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() < 0.6;
    gr.addColorStop(0, dark ? `rgba(30,24,18,${0.12 + rand() * 0.2})` : `rgba(220,215,200,${0.05 + rand() * 0.08})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  // grime gradient at the bottom + edges (dust settles, hands touch the edges)
  const bg = g.createLinearGradient(0, h, 0, h * 0.55);
  bg.addColorStop(0, `rgba(25,20,15,${0.35 * amount})`); bg.addColorStop(1, 'rgba(25,20,15,0)');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (!paintOnly) {
    const e = Math.min(w, h) * 0.08;
    for (const [x0, y0, x1, y1] of [[0, 0, e, 0], [w, 0, w - e, 0], [0, 0, 0, e], [0, h, 0, h - e]] as const) {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, `rgba(20,16,12,${0.4 * amount})`); lg.addColorStop(1, 'rgba(20,16,12,0)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    }
  }
  // drip streaks
  for (let i = 0; i < 10 * amount; i++) {
    const x = rand() * w, y = rand() * h * 0.4, len = (0.2 + rand() * 0.8) * h, ww = 1 + rand() * 3;
    const lg = g.createLinearGradient(0, y, 0, y + len);
    lg.addColorStop(0, `rgba(40,28,18,${0.25 + rand() * 0.2})`); lg.addColorStop(1, 'rgba(40,28,18,0)');
    g.fillStyle = lg; g.fillRect(x, y, ww, len);
  }
  // speckle
  for (let i = 0; i < w * h * 0.002 * amount; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(15,12,10,${rand() * 0.5})` : `rgba(200,195,180,${rand() * 0.25})`;
    const s = 0.5 + rand() * 1.8;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
  // scratches: light thin strokes (paint scraped to metal)
  g.lineCap = 'round';
  rg.lineCap = 'round';
  for (let i = 0; i < 40 * amount; i++) {
    const x = rand() * w, y = rand() * h, a = (rand() - 0.5) * 1.2 + (rand() < 0.3 ? Math.PI / 2 : 0), l = (0.02 + rand() * 0.15) * w;
    const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
    g.strokeStyle = `rgba(190,192,190,${0.15 + rand() * 0.45})`;
    g.lineWidth = 0.6 + rand() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (rand() - 0.5) * 6, (y + y2) / 2 + (rand() - 0.5) * 6, x2, y2); g.stroke();
    rg.strokeStyle = 'rgb(120,120,120)'; rg.lineWidth = g.lineWidth;
    rg.beginPath(); rg.moveTo(x, y); rg.lineTo(x2, y2); rg.stroke();
  }
  // chips: irregular blobs exposing primer / metal
  for (let i = 0; i < 14 * amount; i++) {
    const edge = rand() < 0.7;
    let x = rand() * w, y = rand() * h;
    if (edge) { if (rand() < 0.5) x = rand() < 0.5 ? rand() * 8 : w - rand() * 8; else y = rand() < 0.5 ? rand() * 8 : h - rand() * 8; }
    const r = 1.5 + rand() * 6;
    g.fillStyle = rand() < 0.5 ? '#6f7377' : '#5a3a2a';
    rg.fillStyle = 'rgb(90,90,90)';
    for (const c of [g, rg]) {
      c.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2, rr = r * (0.5 + rand() * 0.7);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.fill();
    }
  }
  g.restore();
}

function parseArrow(text: string): { text: string; dir: 'left' | 'right' | 'up' | 'down' | null; side: 'left' | 'right' } {
  let t = text.trim();
  const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { '<': 'left', '←': 'left', '>': 'right', '→': 'right', '^': 'up', '↑': 'up', 'v': 'down', '↓': 'down' };
  let dir: 'left' | 'right' | 'up' | 'down' | null = null; let side: 'left' | 'right' = 'left';
  const first = t[0], last = t[t.length - 1];
  if (first in map && (t[1] === ' ' || t.length === 1)) { dir = map[first]; t = t.slice(1).trim(); side = 'left'; }
  else if (last in map && t[t.length - 2] === ' ') { dir = map[last]; t = t.slice(0, -1).trim(); side = 'right'; }
  return { text: t, dir, side };
}

// ───────────────────────────── stage 3a: habitat wayfinding (§8.6)

const WAY = '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export type Pictogram = 'leaf' | 'cup' | 'cross' | 'bed' | 'info' | 'person' | 'flask' | 'stairs' | 'lift' | 'wave' | 'warn' | 'door' | 'none';
/** Band colour per pictogram: the habitat's colour code (garden green, canteen orange, clinic red, quarters blue…). */
export const WAY_COLOURS: Record<Pictogram, string> = {
  leaf: '#4f8a4a', cup: '#d0782e', cross: '#c4463a', bed: '#3d6fa8', info: '#c49a3a', person: '#b58a34', flask: '#6a5aa0',
  stairs: '#55636e', lift: '#55636e', wave: '#2c7c8c', warn: '#c0392b', door: '#5f7a8a', none: '#5f7a8a',
};
const WAY_KEYS: [RegExp, Pictogram][] = [
  [/SEALED|ALARM|EMERGENCY|DANGER|NO ENTRY|DO NOT/i, 'warn'],
  [/BIOLOG|BIO-SYS|\bBIO\b|DECON/i, 'flask'],
  [/ATRIUM|GARDEN|PLANT|GREEN/i, 'leaf'],
  [/VIEWPORT|\bSEA\b|OCEAN|POOL|FOUNTAIN/i, 'wave'],
  [/CANTEEN|CAF[EÉ]|KITCHEN|GALLEY|MESS|MENU/i, 'cup'],
  [/CLINIC|MEDICAL|SICK|FIRST AID|PHARMA/i, 'cross'],
  [/QUARTERS|CABIN|RESIDENT|DORM|\bRING [A-Z]\b/i, 'bed'],
  [/STAIR/i, 'stairs'],
  [/\bLIFT\b|ELEVATOR/i, 'lift'],
  [/LOBBY|RECEPTION|INFORMATION|PLEASE|WAIT|EQUALIS/i, 'info'],
  [/FACILIT|OFFICE|STAFF|SUPERVISOR|ADMIN|HALVORSEN/i, 'person'],
];

/** `[picto] text` override, else the first keyword that matches; plain nameplates get no pictogram. */
export function wayPictogram(text: string): { picto: Pictogram; text: string } {
  const m = /^\s*\[(\w+)\]\s*/.exec(text);
  if (m && m[1] in WAY_COLOURS) return { picto: m[1] as Pictogram, text: text.slice(m[0].length) };
  for (const [re, p] of WAY_KEYS) if (re.test(text)) return { picto: p, text };
  return { picto: 'none', text };
}

function pictogram(g: Ctx, p: Pictogram, cx: number, cy: number, s: number, ink: string, bg: string) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  const r = s / 2;
  const lw = (k: number) => { g.lineWidth = s * k; };
  switch (p) {
    case 'leaf': {
      g.rotate(-0.6);
      g.beginPath(); g.moveTo(0, r * 0.95); g.quadraticCurveTo(r * 0.95, 0, 0, -r * 0.95); g.quadraticCurveTo(-r * 0.95, 0, 0, r * 0.95); g.fill();
      g.strokeStyle = bg; lw(0.05);
      g.beginPath(); g.moveTo(0, r * 0.95); g.lineTo(0, -r * 0.6); g.stroke();
      for (let i = 0; i < 3; i++) { const y = r * (0.4 - i * 0.35); g.beginPath(); g.moveTo(0, y); g.lineTo(r * 0.3, y - r * 0.22); g.moveTo(0, y); g.lineTo(-r * 0.3, y - r * 0.22); g.stroke(); }
      g.strokeStyle = ink; lw(0.07); g.beginPath(); g.moveTo(0, r * 0.9); g.lineTo(0, r * 1.15); g.stroke();
      break;
    }
    case 'cup': {
      g.beginPath(); g.moveTo(-r * 0.62, -r * 0.2); g.lineTo(r * 0.42, -r * 0.2); g.lineTo(r * 0.34, r * 0.55); g.quadraticCurveTo(r * 0.3, r * 0.75, r * 0.1, r * 0.75);
      g.lineTo(-r * 0.38, r * 0.75); g.quadraticCurveTo(-r * 0.56, r * 0.75, -r * 0.56, r * 0.55); g.closePath(); g.fill();
      lw(0.08); g.beginPath(); g.arc(r * 0.48, r * 0.2, r * 0.22, -Math.PI / 2, Math.PI / 2); g.stroke();
      lw(0.06);
      for (let i = 0; i < 3; i++) { const x = -r * 0.35 + i * r * 0.3; g.beginPath(); g.moveTo(x, -r * 0.35); g.bezierCurveTo(x + r * 0.15, -r * 0.55, x - r * 0.15, -r * 0.7, x, -r * 0.9); g.stroke(); }
      break;
    }
    case 'cross': {
      const a = r * 0.3, b = r * 0.85;
      g.fillRect(-a, -b, a * 2, b * 2); g.fillRect(-b, -a, b * 2, a * 2);
      break;
    }
    case 'bed': {
      g.fillRect(-r * 0.9, r * 0.1, r * 1.8, r * 0.32);
      g.fillRect(-r * 0.9, -r * 0.5, r * 0.14, r * 1.25); g.fillRect(r * 0.76, r * 0.1, r * 0.14, r * 0.65);
      g.beginPath(); g.arc(-r * 0.48, -r * 0.12, r * 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-r * 0.2, r * 0.08); g.lineTo(-r * 0.2, -r * 0.25); g.quadraticCurveTo(-r * 0.2, -r * 0.32, -r * 0.1, -r * 0.32);
      g.lineTo(r * 0.76, -r * 0.18); g.lineTo(r * 0.76, r * 0.08); g.closePath(); g.fill();
      g.fillRect(-r * 0.9, r * 0.42, r * 0.14, r * 0.33);
      break;
    }
    case 'info': {
      lw(0.08); g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, -r * 0.45, r * 0.13, 0, Math.PI * 2); g.fill();
      g.fillRect(-r * 0.12, -r * 0.2, r * 0.24, r * 0.75); g.fillRect(-r * 0.28, r * 0.43, r * 0.56, r * 0.12); g.fillRect(-r * 0.28, -r * 0.2, r * 0.2, r * 0.12);
      break;
    }
    case 'person': {
      g.beginPath(); g.arc(0, -r * 0.5, r * 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-r * 0.68, r * 0.9); g.lineTo(-r * 0.68, r * 0.3); g.quadraticCurveTo(-r * 0.68, -r * 0.1, -r * 0.25, -r * 0.1);
      g.lineTo(r * 0.25, -r * 0.1); g.quadraticCurveTo(r * 0.68, -r * 0.1, r * 0.68, r * 0.3); g.lineTo(r * 0.68, r * 0.9); g.closePath(); g.fill();
      break;
    }
    case 'flask': {
      g.beginPath(); g.moveTo(-r * 0.2, -r * 0.85); g.lineTo(-r * 0.2, -r * 0.25); g.lineTo(-r * 0.75, r * 0.75); g.quadraticCurveTo(-r * 0.8, r * 0.88, -r * 0.62, r * 0.88);
      g.lineTo(r * 0.62, r * 0.88); g.quadraticCurveTo(r * 0.8, r * 0.88, r * 0.75, r * 0.75); g.lineTo(r * 0.2, -r * 0.25); g.lineTo(r * 0.2, -r * 0.85); g.closePath();
      lw(0.08); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.5, r * 0.3); g.lineTo(r * 0.5, r * 0.3); g.lineTo(r * 0.72, r * 0.75); g.lineTo(-r * 0.72, r * 0.75); g.closePath(); g.fill();
      g.fillRect(-r * 0.35, -r * 0.95, r * 0.7, r * 0.1);
      break;
    }
    case 'stairs': {
      g.beginPath(); g.moveTo(-r * 0.9, r * 0.85);
      for (let i = 0; i < 4; i++) { const x = -r * 0.9 + i * r * 0.45, y = r * 0.85 - (i + 1) * r * 0.42; g.lineTo(x, y); g.lineTo(x + r * 0.45, y); }
      g.lineTo(r * 0.9, r * 0.85); g.closePath(); g.fill();
      break;
    }
    case 'lift': {
      lw(0.08); g.strokeRect(-r * 0.75, -r * 0.9, r * 1.5, r * 1.8);
      g.beginPath(); g.moveTo(0, -r * 0.7); g.lineTo(r * 0.38, -r * 0.18); g.lineTo(-r * 0.38, -r * 0.18); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, r * 0.7); g.lineTo(r * 0.38, r * 0.18); g.lineTo(-r * 0.38, r * 0.18); g.closePath(); g.fill();
      break;
    }
    case 'wave': {
      lw(0.1);
      for (let i = 0; i < 3; i++) {
        const y = -r * 0.5 + i * r * 0.5;
        g.beginPath(); g.moveTo(-r * 0.9, y);
        for (let k = 0; k <= 16; k++) { const x = -r * 0.9 + k * r * 1.8 / 16; g.lineTo(x, y + Math.sin(k / 16 * Math.PI * 4) * r * 0.14); }
        g.stroke();
      }
      break;
    }
    case 'warn': {
      g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(r * 0.95, r * 0.75); g.lineTo(-r * 0.95, r * 0.75); g.closePath(); g.fill();
      g.fillStyle = bg; g.fillRect(-r * 0.08, -r * 0.35, r * 0.16, r * 0.62); g.beginPath(); g.arc(0, r * 0.5, r * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'door': {
      g.fillRect(-r * 0.5, -r * 0.9, r * 1.0, r * 1.8);
      g.fillStyle = bg; g.beginPath(); g.arc(r * 0.28, 0, r * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'none': break;
  }
  g.restore();
}

/**
 * Habitat wayfinding plaque: warm-white satin enamel, a coloured band with a white pictogram, dark humanist lettering
 * IN THE CASE GIVEN ("생물 시스템 →"), optional arrow (same parsing as `directional`: `→ ← > < ↑ ↓` at the start
 * or end), extra lines smaller. Wide quads (aspect ≥ 1.6) put the band on the left; square / tall ones (totems) on top.
 * Returns the base roughness (0..255) for the roughness canvas.
 */
function drawWayfinding(g: Ctx, rg: Ctx, W: number, H: number, raw: string, rand: () => number): number {
  const { picto, text: t0 } = wayPictogram(raw);
  // an arrow on a line of its own (a totem: "Biological Systems\nDeck 2\n→") counts as a trailing arrow
  const { text, dir, side } = parseArrow(t0.replace(/\n\s*([→←↑↓<>^])\s*$/, " $1"));
  const band = WAY_COLOURS[picto];
  const ink = '#25292c', plate = '#efe9dc';
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f3eee3'); bg.addColorStop(1, '#e6dfd0');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const lines = text.split('\n');
  const wide = W / H >= 1.6;
  const arrowCol = picto === 'none' ? ink : band;
  if (wide) {
    // band: a square with the pictogram, or a slim stripe when there is none
    const bw = picto === 'none' ? H * 0.1 : H;
    const bx = 0;
    g.fillStyle = band; g.fillRect(bx, 0, bw, H);
    rg.fillStyle = 'rgb(95,95,95)'; rg.fillRect(bx, 0, bw, H);
    if (picto !== 'none') pictogram(g, picto, bx + bw / 2, H / 2, H * 0.6, plate, band);
    let x0 = bw + H * 0.22, x1 = W - H * 0.22;
    if (dir) {
      const asz = H * 0.5;
      const ax = side === 'left' ? x0 + asz / 2 : x1 - asz / 2;
      g.save(); g.fillStyle = arrowCol; g.beginPath(); g.arc(ax, H / 2, asz * 0.62, 0, Math.PI * 2); g.fill(); g.restore();
      arrow(g, ax, H / 2, asz * 0.72, dir, plate);
      if (side === 'left') x0 = ax + asz * 0.8; else x1 = ax - asz * 0.8;
    }
    g.fillStyle = ink; g.textBaseline = 'middle'; g.textAlign = 'left';
    const main = lines[0], subs = lines.slice(1);
    const mainH = subs.length ? H * 0.34 : H * 0.42;
    const ms = fitText(g, main, x1 - x0, mainH, '600', WAY);
    const total = ms + subs.length * ms * 0.75;
    let y = H / 2 - total / 2 + ms * 0.5;
    g.fillText(main, x0, y + ms * 0.04);
    y += ms * 0.62;
    for (const sub of subs) {
      g.fillStyle = '#4c5257';
      const ss = fitText(g, sub, x1 - x0, ms * 0.58, '500', WAY);
      y += ss * 0.62; g.fillText(sub, x0, y); y += ss * 0.55;
    }
    // a hairline in the band colour along the bottom of the text field
    g.fillStyle = band; g.fillRect(bw, H - H * 0.045, W - bw, H * 0.045);
  } else {
    const bh = picto === 'none' ? H * 0.08 : Math.min(H * 0.5, W * 0.8);
    g.fillStyle = band; g.fillRect(0, 0, W, bh);
    rg.fillStyle = 'rgb(95,95,95)'; rg.fillRect(0, 0, W, bh);
    if (picto !== 'none') pictogram(g, picto, W / 2, bh / 2, bh * 0.62, plate, band);
    const y0 = bh + H * 0.06;
    if (dir) {
      const asz = Math.min(W * 0.32, (H - bh) * 0.3);
      g.save(); g.fillStyle = arrowCol; g.beginPath(); g.arc(W / 2, H - asz * 0.85, asz * 0.62, 0, Math.PI * 2); g.fill(); g.restore();
      arrow(g, W / 2, H - asz * 0.85, asz * 0.72, dir, plate);
    }
    const room = (dir ? H * 0.72 : H * 0.94) - y0;
    const lh = room / Math.max(1, lines.length);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.fillStyle = i === 0 ? ink : '#4c5257';
      fitText(g, ln, W * 0.86, Math.min(lh * (i === 0 ? 0.62 : 0.5), W * 0.2), i === 0 ? '600' : '500', WAY);
      g.fillText(ln, W / 2, y0 + lh * (i + 0.5));
    });
  }
  // printed vinyl lettering is a little glossier than the enamel
  // (roughness: the plate is satin; the weather pass below is gentle: a habitat that is cleaned)
  for (let i = 0; i < 6; i++) {
    const x = rand() * W, y = rand() * H, r = (0.15 + rand() * 0.3) * Math.max(W, H);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(60,50,40,${0.03 + rand() * 0.03})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  const dust = g.createLinearGradient(0, 0, 0, H * 0.25);
  dust.addColorStop(0, 'rgba(120,110,95,0.08)'); dust.addColorStop(1, 'rgba(120,110,95,0)');
  g.fillStyle = dust; g.fillRect(0, 0, W, H);
  // bevelled edge of the plate
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = Math.max(2, H * 0.015); g.strokeRect(0, 0, W, H);
  return 115;
}

// ───────────────────────────── stage 3b: clinical signage (§8.7, §2.6)

const CLIN = '"Helvetica Neue", "Arial", "Segoe UI", sans-serif';
type ClinPicto = 'bio' | 'cold' | 'doc' | 'rack' | 'flask' | 'stairs' | 'warn' | 'door' | 'person' | 'cross' | 'none';
const CLIN_KEYS: [RegExp, ClinPicto][] = [
  [/DO NOT|NO ENTRY|DANGER|WARNING|HOLD|SEALED|RESTRICTED|AUTHORISED/i, 'warn'],
  [/COLD STORE|FREEZER|−80|-80/i, 'cold'],
  [/BIO|CONTAINMENT|VIVARIUM|DECON|AIR SHOWER/i, 'bio'],
  [/RECORDS|ARCHIVE|FILING/i, 'doc'],
  [/NODE|SERVER|UNIT BAY/i, 'rack'],
  [/WET LAB|\bLAB\b|LABORATORY/i, 'flask'],
  [/SURGICAL|THEATRE|SCRUB|GALLERY/i, 'cross'],
  [/STAIR/i, 'stairs'],
  [/OFFICE|\bPI\b|GOWNING|STAFF/i, 'person'],
];

function clinicalPicto(text: string): { picto: ClinPicto; text: string } {
  const m = /^\s*\[(\w+)\]\s*/.exec(text);
  const all: ClinPicto[] = ['bio', 'cold', 'doc', 'rack', 'flask', 'stairs', 'warn', 'door', 'person', 'cross', 'none'];
  if (m && all.includes(m[1] as ClinPicto)) return { picto: m[1] as ClinPicto, text: text.slice(m[0].length) };
  for (const [re, p] of CLIN_KEYS) if (re.test(text)) return { picto: p, text };
  return { picto: 'none', text };
}

function drawClinPicto(g: Ctx, p: ClinPicto, cx: number, cy: number, s: number, ink: string, bg: string) {
  const r = s / 2;
  if (p === 'flask' || p === 'stairs' || p === 'warn' || p === 'door' || p === 'person' || p === 'cross' || p === 'none') {
    pictogram(g, p, cx, cy, s, ink, bg);
    return;
  }
  g.save();
  g.translate(cx, cy);
  g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  if (p === 'bio') {
    // biohazard trefoil: three crescents round a ring
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 3;
      const ox = Math.cos(a) * r * 0.36, oy = Math.sin(a) * r * 0.36;
      g.beginPath(); g.arc(ox, oy, r * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = bg;
      g.beginPath(); g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.36, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink;
    }
    g.fillStyle = bg; g.beginPath(); g.arc(0, 0, r * 0.13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = s * 0.06; g.beginPath(); g.arc(0, 0, r * 0.42, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = bg; g.lineWidth = s * 0.05;
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + k * Math.PI * 2 / 3;
      g.beginPath(); g.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12); g.lineTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); g.stroke();
    }
  } else if (p === 'cold') {
    // snowflake: six arms with side barbs
    g.lineWidth = s * 0.07;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      const c = Math.cos(a), sn = Math.sin(a);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(c * r * 0.9, sn * r * 0.9); g.stroke();
      for (const t of [0.45, 0.68]) {
        const bx = c * r * t, by = sn * r * t, l = r * (t === 0.45 ? 0.26 : 0.18);
        for (const d of [-1, 1]) {
          const b = a + d * Math.PI / 4;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(b) * l, by + Math.sin(b) * l); g.stroke();
        }
      }
    }
  } else if (p === 'doc') {
    g.lineWidth = s * 0.07;
    g.beginPath(); g.moveTo(-r * 0.55, -r * 0.85); g.lineTo(r * 0.25, -r * 0.85); g.lineTo(r * 0.6, -r * 0.5); g.lineTo(r * 0.6, r * 0.85);
    g.lineTo(-r * 0.55, r * 0.85); g.closePath(); g.stroke();
    for (let i = 0; i < 4; i++) g.fillRect(-r * 0.35, -r * 0.35 + i * r * 0.3, r * 0.75, r * 0.08);
  } else if (p === 'rack') {
    g.lineWidth = s * 0.07;
    for (let i = 0; i < 3; i++) {
      const y = -r * 0.8 + i * r * 0.56;
      g.strokeRect(-r * 0.75, y, r * 1.5, r * 0.42);
      g.beginPath(); g.arc(r * 0.45, y + r * 0.21, r * 0.07, 0, Math.PI * 2); g.fill();
      g.fillRect(-r * 0.55, y + r * 0.17, r * 0.6, r * 0.08);
    }
  }
  g.restore();
}

/**
 * Bio-Sys clinical signage: cool white acrylic plate, slate blue-grey band with a white pictogram, uppercase dark
 * blue-grey lettering, arrows in a filled circle (same parsing as `directional`); a warning band in signal red for
 * holds / restricted doors. A text starting `FUMIGATED` is an inspection sticker (yellow, rounded, the rest transparent).
 * Returns the base roughness, and whether the sign is transparent (sticker).
 */
function drawClinical(g: Ctx, rg: Ctx, W: number, H: number, raw: string, rand: () => number): [number, boolean] {
  if (/^\s*FUMIGATED/i.test(raw)) {
    const lines = raw.split('\n');
    g.clearRect(0, 0, W, H);
    const m = H * 0.06, rr = H * 0.12;
    g.beginPath(); g.roundRect(m, m, W - 2 * m, H - 2 * m, rr);
    g.fillStyle = '#e6c23a'; g.fill();
    g.lineWidth = H * 0.035; g.strokeStyle = '#1d1c18'; g.beginPath(); g.roundRect(m * 2.2, m * 2.2, W - 4.4 * m, H - 4.4 * m, rr * 0.7); g.stroke();
    g.fillStyle = '#1d1c18'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const main = lines[0].toUpperCase(), sub = lines.slice(1).join(' ').toUpperCase() || '제거 금지';
    fitText(g, main, W - m * 8, H * 0.32, '800', CLIN); g.fillText(main, W / 2, H * 0.42);
    fitText(g, sub, W - m * 8, H * 0.14, '600', CLIN); g.fillText(sub, W / 2, H * 0.7);
    // slightly lifted, scuffed corner
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${rand() * 0.25})`; g.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1); }
    g.globalCompositeOperation = 'source-over';
    return [95, true];
  }
  const { picto, text: t0 } = clinicalPicto(raw);
  const { text, dir, side } = parseArrow(t0.replace(/\n\s*([→←↑↓<>^])\s*$/, ' $1'));
  const warnSign = picto === 'warn';
  const band = warnSign ? '#b0402c' : '#4d6779';
  const ink = '#1f2d37', plate = '#f4f7f8';
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#e9eef0'); bg.addColorStop(1, '#dce3e6');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const lines = text.toUpperCase().split('\n');
  const wide = W / H >= 1.6;
  if (wide) {
    const bw = picto === 'none' ? H * 0.12 : H;
    g.fillStyle = band; g.fillRect(0, 0, bw, H);
    rg.fillStyle = 'rgb(80,80,80)'; rg.fillRect(0, 0, bw, H);
    if (picto !== 'none') drawClinPicto(g, picto, bw / 2, H / 2, H * 0.6, plate, band);
    let x0 = bw + H * 0.2, x1 = W - H * 0.2;
    if (dir) {
      const asz = H * 0.5;
      const ax = side === 'left' ? x0 + asz / 2 : x1 - asz / 2;
      g.fillStyle = band; g.beginPath(); g.arc(ax, H / 2, asz * 0.6, 0, Math.PI * 2); g.fill();
      arrow(g, ax, H / 2, asz * 0.7, dir, plate);
      if (side === 'left') x0 = ax + asz * 0.8; else x1 = ax - asz * 0.8;
    }
    g.textBaseline = 'middle'; g.textAlign = side === 'right' && dir ? 'right' : 'left';
    const tx = g.textAlign === 'right' ? x1 : x0;
    const main = lines[0], subs = lines.slice(1);
    const ms = fitText(g, main, x1 - x0, subs.length ? H * 0.3 : H * 0.36, '700', CLIN);
    const total = ms + subs.length * ms * 0.8;
    let y = H / 2 - total / 2 + ms * 0.5;
    g.fillStyle = ink; g.fillText(main, tx, y + ms * 0.04);
    y += ms * 0.6;
    for (const sub of subs) {
      g.fillStyle = '#4b5f6b';
      const ss = fitText(g, sub, x1 - x0, ms * 0.6, '500', CLIN);
      y += ss * 0.65; g.fillText(sub, tx, y); y += ss * 0.55;
    }
    g.fillStyle = band; g.fillRect(bw, H - H * 0.035, W - bw, H * 0.035);
  } else {
    const bh = picto === 'none' ? H * 0.08 : Math.min(H * 0.45, W * 0.8);
    g.fillStyle = band; g.fillRect(0, 0, W, bh);
    rg.fillStyle = 'rgb(80,80,80)'; rg.fillRect(0, 0, W, bh);
    if (picto !== 'none') drawClinPicto(g, picto, W / 2, bh / 2, bh * 0.62, plate, band);
    const y0 = bh + H * 0.05;
    if (dir) {
      const asz = Math.min(W * 0.32, (H - bh) * 0.3);
      g.fillStyle = band; g.beginPath(); g.arc(W / 2, H - asz * 0.85, asz * 0.6, 0, Math.PI * 2); g.fill();
      arrow(g, W / 2, H - asz * 0.85, asz * 0.7, dir, plate);
    }
    const room = (dir ? H * 0.72 : H * 0.95) - y0;
    const lh = room / Math.max(1, lines.length);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.fillStyle = i === 0 ? ink : '#4b5f6b';
      fitText(g, ln, W * 0.86, Math.min(lh * (i === 0 ? 0.6 : 0.48), W * 0.2), i === 0 ? '700' : '500', CLIN);
      g.fillText(ln, W / 2, y0 + lh * (i + 0.5));
    });
  }
  // wiped acrylic: almost no wear; a faint cloth haze in the roughness only
  for (let i = 0; i < 5; i++) {
    const x = rand() * W, y = rand() * H, r = (0.2 + rand() * 0.3) * Math.max(W, H);
    const gr = rg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(120,120,120,0.25)'); gr.addColorStop(1, 'rgba(120,120,120,0)');
    rg.fillStyle = gr; rg.fillRect(0, 0, W, H);
  }
  g.strokeStyle = 'rgba(30,45,55,0.25)'; g.lineWidth = Math.max(2, H * 0.012); g.strokeRect(0, 0, W, H);
  return [115, false];
}

// ───────────────────────────── stage 3c: navy stencils (§8.9, §2.6)

/** A compartment number in the navy's deck-frame-position-use form, e.g. `2-34-0-L` (drawn boxed, smaller). */
const HULL_NO = /^\s*\d{1,2}-\d{1,3}-\d{1,2}-[A-Z]{1,2}\s*$/;

/**
 * Navy signage: white stencil paint on a masked haze-grey-dark backing (so it reads on `navy_grey` frames and on the
 * off-white `hull_white` plating alike); transparent outside the backing except a faint overspray. Stencil bridges,
 * arrows (same parsing as `directional`), first line large; warning words (DANGER, NO …, KEEP …, WARNING, FLOODED,
 * HIGH …, DOGGED) in signal yellow; a line like `2-34-0-L` is a hull number in a painted box. Boot- and hand-worn
 * dropouts. Returns the base roughness.
 */
function drawNavy(g: Ctx, rg: Ctx, W: number, H: number, raw: string, rand: () => number): number {
  g.clearRect(0, 0, W, H);
  const { text, dir, side } = parseArrow(raw.replace(/\n\s*([→←↑↓<>^])\s*$/, ' $1'));
  const lines = text.toUpperCase().split('\n');
  const WHITE = '#e8e7e0', YEL = '#e2b322', BACK = '#3b444a';
  const m = Math.max(2, H * 0.035);
  // the masked backing (crisp taped edges, a soft overspray halo outside)
  g.save();
  g.filter = `blur(${Math.max(1.5, H * 0.02)}px)`;
  g.globalAlpha = 0.25; g.fillStyle = BACK; g.fillRect(m * 0.4, m * 0.4, W - m * 0.8, H - m * 0.8);
  g.restore();
  g.fillStyle = BACK; g.fillRect(m, m, W - m * 2, H - m * 2);
  rg.fillStyle = 'rgb(150,150,150)'; rg.fillRect(m, m, W - m * 2, H - m * 2);
  // brush-out of the backing coat: faint horizontal drag marks
  g.save(); g.beginPath(); g.rect(m, m, W - m * 2, H - m * 2); g.clip();
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.04})`; g.fillRect(m + rand() * W, m + rand() * H, W * (0.1 + rand() * 0.4), 1 + rand() * 2); }
  g.restore();
  const warn = /^(DANGER|NO |KEEP|WARNING|FLOODED|HIGH|DOGGED|BILGE)/.test(lines[0]);
  let x0 = m * 3, x1 = W - m * 3;
  if (dir) {
    const asz = Math.min(H * 0.62, W * 0.3);
    const ax = side === 'left' ? x0 + asz / 2 : x1 - asz / 2;
    arrow(g, ax, H / 2, asz, dir, WHITE);
    if (side === 'left') x0 = ax + asz * 0.62; else x1 = ax - asz * 0.62;
  }
  const hullIdx = lines.findIndex((l) => HULL_NO.test(l));
  const body = lines.filter((_, i) => i !== hullIdx);
  const hullH = hullIdx >= 0 ? (H - m * 2) * 0.28 : 0;
  const avail = H - m * 4 - hullH;
  const weights = body.map((_, i) => (i === 0 ? 1 : 0.62));
  const tot = weights.reduce((a, b) => a + b, 0) || 1;
  g.textAlign = dir && side === 'right' ? 'right' : dir ? 'left' : 'center';
  const tx = g.textAlign === 'center' ? (x0 + x1) / 2 : g.textAlign === 'right' ? x1 : x0;
  g.textBaseline = 'middle';
  const rows: { y: number; lh: number }[] = [];
  let y = m * 2;
  body.forEach((ln, i) => {
    const lh = avail * weights[i] / tot;
    g.fillStyle = i === 0 && warn ? YEL : WHITE;
    fitText(g, ln, x1 - x0, Math.round(lh * 0.84), '900', SANS);
    g.fillText(ln, tx, y + lh * 0.52);
    rows.push({ y: y + lh * 0.52, lh });
    y += lh;
  });
  if (hullIdx >= 0) {
    const hn = lines[hullIdx].trim();
    const bh = hullH * 0.86, by = H - m * 2 - bh;
    g.font = `800 ${Math.round(bh * 0.66)}px ${MONO}`;
    const bw = Math.min(x1 - x0, g.measureText(hn).width + bh * 0.8);
    const bx = g.textAlign === 'center' ? (x0 + x1) / 2 - bw / 2 : g.textAlign === 'right' ? x1 - bw : x0;
    g.strokeStyle = WHITE; g.lineWidth = Math.max(1.5, bh * 0.08); g.strokeRect(bx, by, bw, bh);
    g.fillStyle = WHITE; g.textAlign = 'center';
    fitText(g, hn, bw - bh * 0.5, Math.round(bh * 0.66), '800', MONO);
    g.fillText(hn, bx + bw / 2, by + bh * 0.54);
  }
  // stencil bridges through the lettering (the backing shows through)
  g.fillStyle = BACK;
  for (const r of rows) g.fillRect(m, r.y - r.lh * 0.025, W - m * 2, r.lh * 0.045);
  // wear: dropouts through both coats near the bottom edge and where hands go; scratches
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const x = rand() * W, yy = H * (0.55 + 0.45 * Math.sqrt(rand())), r = 1 + rand() * H * 0.035;
    const gr = g.createRadialGradient(x, yy, 0, x, yy, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.25 + rand() * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, yy - r, r * 2, r * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const x = rand() * W, yy = rand() * H, a = (rand() - 0.5) * 0.6, l = (0.04 + rand() * 0.2) * W;
    g.strokeStyle = `rgba(0,0,0,${0.4 + rand() * 0.5})`; g.lineWidth = 0.6 + rand() * 1.2;
    g.beginPath(); g.moveTo(x, yy); g.lineTo(x + Math.cos(a) * l, yy + Math.sin(a) * l); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // grime settling on the lower edge, a rust run or two from the fixing points
  const bg = g.createLinearGradient(0, H, 0, H * 0.6);
  bg.addColorStop(0, 'rgba(30,26,20,0.3)'); bg.addColorStop(1, 'rgba(30,26,20,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2; i++) {
    const x = m + rand() * (W - m * 2), len = H * (0.2 + rand() * 0.5);
    const lg = g.createLinearGradient(0, m, 0, m + len); lg.addColorStop(0, 'rgba(120,60,25,0.4)'); lg.addColorStop(1, 'rgba(120,60,25,0)');
    g.fillStyle = lg; g.fillRect(x, m, 1.5 + rand() * 2, len);
  }
  g.globalCompositeOperation = 'source-over';
  return 165;
}

export function createSign(text: string, style: SignStyle, aspect: number, maxAniso: number): THREE.MeshStandardMaterial {
  const H = aspect >= 4 ? 192 : 256;
  const W = Math.min(2048, Math.max(64, Math.round(H * aspect)));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const g = cv.getContext('2d')!; const rg = rc.getContext('2d')!;
  const rand = rng(hashStr(style + text + aspect));
  const lines = text.split('\n');
  const pad = H * 0.08;
  let roughBase = 150; // 0..255 → roughness ~0.6
  let transparent = false;

  if (style === 'label') {
    g.fillStyle = '#c9c6b8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = H * 0.035; g.strokeRect(pad * 0.6, pad * 0.6, W - pad * 1.2, H - pad * 1.2);
    g.fillStyle = '#161616'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    const lh = (H - pad * 3) / n;
    lines.forEach((ln, i) => {
      const size = fitText(g, ln, W - pad * 4, Math.min(lh * 0.8, H * 0.5), i === 0 ? '700' : '600', i === 0 ? SANS : MONO);
      void size;
      g.fillText(ln, W / 2, pad * 1.5 + lh * (i + 0.5));
    });
    // tiny part number bottom-right
    g.font = `500 ${Math.round(H * 0.06)}px ${MONO}`; g.textAlign = 'right'; g.fillStyle = '#3a3a36';
    g.fillText(`HD-${(hashStr(text) % 9000 + 1000)}-E3`, W - pad * 1.1, H - pad * 1.0);
    for (const [x, y] of [[pad * 0.35, pad * 0.35], [W - pad * 0.35, pad * 0.35], [pad * 0.35, H - pad * 0.35], [W - pad * 0.35, H - pad * 0.35]]) screw(g, x, y, H * 0.025, rand);
    roughBase = 120;
    weather(g, rg, W, H, rand, 0.8);
  } else if (style === 'warning') {
    g.fillStyle = '#d9a813'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111'; g.lineWidth = H * 0.05; g.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad);
    const tri = H * 0.7;
    const hasRoom = W > H * 1.3;
    warningTriangle(g, hasRoom ? pad + tri * 0.55 : W / 2, H / 2 + (hasRoom ? 0 : -H * 0.12), hasRoom ? tri : tri * 0.6, '#d9a813', '#111');
    g.fillStyle = '#111'; g.textBaseline = 'middle';
    if (hasRoom) {
      g.textAlign = 'left';
      const x0 = pad * 2 + tri * 1.05; const n = lines.length; const lh = (H - pad * 3) / n;
      lines.forEach((ln, i) => { fitText(g, ln.toUpperCase(), W - x0 - pad * 1.5, Math.min(lh * 0.82, H * 0.42), '800', SANS); g.fillText(ln.toUpperCase(), x0, pad * 1.5 + lh * (i + 0.5)); });
    } else {
      g.textAlign = 'center';
      fitText(g, lines[0].toUpperCase(), W - pad * 2.5, H * 0.18, '800', SANS);
      g.fillText(lines[0].toUpperCase(), W / 2, H * 0.82);
    }
    weather(g, rg, W, H, rand, 1.0);
  } else if (style === 'danger') {
    const band = H * 0.2;
    drawStripes(g, 0, 0, W, band, '#d6a512', '#121212', band * 1.4);
    drawStripes(g, 0, H - band, W, band, '#d6a512', '#121212', band * 1.4);
    g.fillStyle = '#a3140f'; g.fillRect(0, band, W, H - band * 2);
    g.fillStyle = '#f0ece4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length; const lh = (H - band * 2 - pad) / n;
    lines.forEach((ln, i) => { fitText(g, ln.toUpperCase(), W - pad * 3, Math.min(lh * 0.85, H * 0.4), '900', SANS); g.fillText(ln.toUpperCase(), W / 2, band + pad / 2 + lh * (i + 0.5)); });
    weather(g, rg, W, H, rand, 1.1);
  } else if (style === 'directional') {
    const { text: t, dir, side } = parseArrow(text);
    g.fillStyle = '#1d3a34'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e8e6de'; g.lineWidth = H * 0.025; g.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad);
    g.fillStyle = '#ecebe4'; g.textBaseline = 'middle';
    const asz = H * 0.62;
    let x0 = pad * 1.6, x1 = W - pad * 1.6;
    if (dir) {
      const ax = side === 'left' ? pad * 1.4 + asz / 2 : W - pad * 1.4 - asz / 2;
      arrow(g, ax, H / 2, asz, dir, '#ecebe4');
      if (side === 'left') x0 = ax + asz * 0.65; else x1 = ax - asz * 0.65;
    }
    const tl = t.split('\n');
    const lh = (H - pad * 2.5) / tl.length;
    g.textAlign = side === 'right' && dir ? 'right' : 'left';
    tl.forEach((ln, i) => {
      fitText(g, ln.toUpperCase(), x1 - x0, Math.min(lh * (i === 0 ? 0.8 : 0.55), H * 0.5), i === 0 ? '700' : '500', SANS);
      g.fillText(ln.toUpperCase(), g.textAlign === 'right' ? x1 : x0, pad * 1.25 + lh * (i + 0.5));
    });
    roughBase = 110;
    weather(g, rg, W, H, rand, 0.7);
  } else if (style === 'wayfinding') {
    roughBase = drawWayfinding(g, rg, W, H, text, rand);
  } else if (style === 'clinical') {
    [roughBase, transparent] = drawClinical(g, rg, W, H, text, rand);
  } else if (style === 'navy') {
    roughBase = drawNavy(g, rg, W, H, text, rand);
    transparent = true;
  } else { // stencil — transparent spray paint
    transparent = true;
    g.clearRect(0, 0, W, H);
    const color = /^(DANGER|NO |KEEP|HIGH|WARNING)/i.test(text) ? '#b88c14' : '#b9b5aa';
    const n = lines.length; const lh = H / n;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // overspray halo
    g.save();
    g.filter = `blur(${Math.max(2, H * 0.025)}px)`;
    g.fillStyle = color; g.globalAlpha = 0.35;
    lines.forEach((ln, i) => { fitText(g, ln.toUpperCase(), W * 0.92, lh * 0.82, '900', SANS); g.fillText(ln.toUpperCase(), W / 2, lh * (i + 0.5)); });
    g.restore();
    g.fillStyle = color;
    lines.forEach((ln, i) => { fitText(g, ln.toUpperCase(), W * 0.92, lh * 0.82, '900', SANS); g.fillText(ln.toUpperCase(), W / 2, lh * (i + 0.5)); });
    // stencil bridges: horizontal gaps through the letters
    g.globalCompositeOperation = 'destination-out';
    lines.forEach((_, i) => {
      const y = lh * (i + 0.5);
      g.fillStyle = 'rgba(0,0,0,1)';
      g.fillRect(0, y - lh * 0.03, W, lh * 0.05);
    });
    // wear: patchy dropouts + scratches through the paint
    for (let i = 0; i < 160; i++) {
      const x = rand() * W, y = rand() * H, r = 1 + rand() * H * 0.05;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${0.3 + rand() * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = rand() * W, y = rand() * H, a = (rand() - 0.5) * 0.8, l = (0.05 + rand() * 0.3) * W;
      g.strokeStyle = `rgba(0,0,0,${0.5 + rand() * 0.5})`; g.lineWidth = 0.7 + rand() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // spray speckle around
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = color;
    for (let i = 0; i < W * H * 0.004; i++) { g.globalAlpha = rand() * 0.5; g.fillRect(rand() * W, rand() * H, 1, 1); }
    // paint runs
    g.globalAlpha = 0.6;
    for (let i = 0; i < 6; i++) {
      const x = W * (0.1 + rand() * 0.8), y = H * (0.3 + rand() * 0.4), len = H * (0.1 + rand() * 0.35);
      const lg = g.createLinearGradient(0, y, 0, y + len); lg.addColorStop(0, color); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg; g.fillRect(x, y, 1.5 + rand() * 1.5, len);
    }
    g.globalAlpha = 1;
    roughBase = 190;
  }

  // roughness canvas: base + weather marks already drawn in rg (darker = smoother)
  rg.globalCompositeOperation = 'destination-over';
  rg.fillStyle = `rgb(${roughBase},${roughBase},${roughBase})`;
  rg.fillRect(0, 0, W, H);
  rg.globalCompositeOperation = 'source-over';

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAniso);
  const rough = new THREE.CanvasTexture(rc);
  rough.colorSpace = THREE.NoColorSpace;
  for (const t of [map, rough]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  const m = new THREE.MeshStandardMaterial({
    name: `sign_${style}`,
    map, roughnessMap: rough, roughness: 1, metalness: 0,
  });
  if (transparent) {
    m.transparent = true; m.depthWrite = false;
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  }
  return m;
}
