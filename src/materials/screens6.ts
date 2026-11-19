/**
 * Stage 3d screen kinds (docs/plans/stage-3d.md §6.4, §8.8): `mimic`, `manifest`, `interlock`, `dock_board`, `gauge`,
 * and the live `feed`'s OSD text overlay. Drawn by ScreenManager (screens.ts) into the screen's canvas; the shared
 * pixel-grid overlay and glare go on top. The navy palette of 3c (screens5.ts `NAVY_INK`): deep navy glass, cool white
 * type, state colour on the value only (green = live / ready / open, amber = standby / running / waiting, red = LOS /
 * fault / hazard).
 *
 * Every draw function returns false when nothing visible changed since its last draw (the manager then skips the
 * texture upload — the wall boards are 2048 px wide).
 *
 * `text` formats (what the level / story writes with `setScreen`; the screen's clock `t` restarts at every write):
 *   mimic       `auto` | `manual` | `pulled` | `cut` (or the §6.4 phrases: `모드: 자동`, `MANUAL — PROTECTION OFF`,
 *               `신호 손실` / `ACTIVE` → pulled, `ALL LOS` → cut). The trunk HEAD-END — VAULT (BEACH JOINT) — SURFACE
 *               2.1 KM and the branch MOON POOL — TETHER — ACOUSTIC BUOY; traffic dots run along every live line.
 *               Empty = `auto`.
 *   manifest    `\n`-separated lines. Directive lines (anywhere, not shown): `@title <T>` (header band; default
 *               `헤드엔드 — 발신 대기열`), `@rate <s>` (a NEW line types in per <s> seconds from the write: the E1
 *               scroll, 0.35), `@hl <substring>` (lines containing it are highlighted), `@cursor <substring>` (a
 *               blinking block cursor after the line containing it; default: after the last line while typing),
 *               `@scroll <n>` (first shown line; default: follow the newest line), `@rows <n>` (body rows; default
 *               the line count within 7 … 13). A rewrite keeps every line that is unchanged at the same index (only new lines type in), so the
 *               story can add `@hl` / `@cursor` without the list re-typing. Empty = the §6.3 queue (`note6_queue`).
 *   interlock   `<TITLE>\n<STATE>`: STATE `locked` | `open` | `los` or a display string (`키 A 삽입 — 열림`,
 *               `광케이블 — 신호 손실`; the state is read from its words). `locked` shows `INSERT KEY <X>` (X from the title's
 *               `KEY X`). A Castell barrel pictogram: empty (amber), key in and turned (green), red on LOS.
 *   dock_board  `\n`-separated: line 1 the title, then `<LABEL>: <VALUE>` rows (split at the first `: `). Changed
 *               rows flip in over 0.45 s; HAZARD / FAULT rows blink. Empty = the arrival state of §6.4.
 *   gauge       `pin` (`핀 삽입됨`) | `<k>` 0 … 1 of 210 bar (`0 BAR — 펌프`, `n BAR`, `210 BAR — READY` at 1) |
 *               `fired` (needle dumps to 0; `트렁크: 신호 손실 · 부이: 신호 손실` from +0.6 s) | `low|<k>` (`압력 낮음` for
 *               1.2 s, then the reading of k). The needle eases (≈ 0.15 s) to every new value.
 *   feed (OSD)  on the trunk level, a `feed` WITH a texture draws its `text` over the live picture: `\n`-separated
 *               lines top-left, a line starting `_` bottom-left. New lines type in at 34 characters / s, one after
 *               the other (the O1 beat); a `hh:mm:ss` in a line runs on from the write (the camera clock).
 */
import * as THREE from 'three';
import type { ScreenKind } from '../core/types';
import { NAVY_INK, type S5 } from './screens5';

const K = NAVY_INK;
const COND = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';

export const TRUNK_KINDS = new Set<ScreenKind>(['mimic', 'manifest', 'interlock', 'dock_board', 'gauge']);

/** Canvas size of a stage-3d kind (null: not one). The wall boards are read across a hall: 2048 wide. */
export function size6(kind: ScreenKind, aspect: number): [number, number] | null {
  if (!TRUNK_KINDS.has(kind)) return null;
  const base = kind === 'mimic' || kind === 'dock_board' ? (aspect >= 2.4 ? 2048 : 1024)
    : kind === 'manifest' ? (aspect >= 2 ? 2048 : 1024) : 512;
  return aspect >= 1 ? [base, Math.max(16, Math.round(base / aspect))] : [Math.round(base * aspect), base];
}

function fit(g: CanvasRenderingContext2D, txt: string, weight: number, size: number, maxW: number, family = COND) {
  let sz = Math.max(6, size);
  g.font = `${weight} ${Math.round(sz)}px ${family}`;
  while (g.measureText(txt).width > maxW && sz > 6) { sz -= Math.max(1, sz * 0.04); g.font = `${weight} ${Math.round(sz)}px ${family}`; }
  return sz;
}
const glow = (g: CanvasRenderingContext2D, col: string, blur: number, f: () => void) => { g.save(); g.shadowColor = col; g.shadowBlur = blur; f(); g.restore(); };
/** True when `key` differs from the last drawn one (and remembers it). */
function changed(s: S5, key: string): boolean {
  if (s.aux.key6 === key) return false;
  s.aux.key6 = key;
  return true;
}
const blinkOf = (t: number, hz: number) => Math.floor(t * hz * 2) % 2 === 0;

/** Colour of a trunk status value by its words. */
export function trunkColour(v: string): string {
  const u = v.toUpperCase();
  if (/\bLOS\b|HAZARD|FAULT|OFFLINE|LOW\b|FIRED|REFUS|DENIED/.test(u)) return K.red;
  if (/LOWERING|AWAITING|STANDBY|STOPPED|WORKING|IN WELL|MANUAL|PUMP|PIN IN|INSERT|CYCLING|QUEUED/.test(u)) return K.amber;
  if (/ACTIVE|READY|OPEN|\bAUTO\b|NOMINAL|\bOK\b|TAUT/.test(u)) return K.green;
  return K.text;
}

/** Flip-in: characters scramble and settle left to right over 0.45 s after a write. */
function flip(txt: string, t: number, rand: () => number): string {
  if (t >= 0.45) return txt;
  const k = Math.max(0, t) / 0.45;
  const A = 'ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789—';
  return txt.split('').map((c, i) => (c === ' ' || i / txt.length < k ? c : A[Math.floor(rand() * A.length)])).join('');
}

// ───────────────────────────── mimic (mimic6, he6 south wall)

type MimicState = 'auto' | 'manual' | 'pulled' | 'cut';
export function mimicState(text: string | undefined): MimicState {
  const u = (text ?? '').trim().toUpperCase();
  if (!u || u === '자동' || /모드:\s*자동/.test(u)) return 'auto';
  if (u === '절단' || /모두\s*신호 손실/.test(u)) return 'cut';
  if (u === '당겨짐' || /신호 손실|활성/.test(u)) return 'pulled';
  return 'manual';
}

export function mimic(s: S5): boolean {
  const { g, W, H, t } = s;
  const st = mimicState(s.text);
  const trunkLive = st === 'auto' || st === 'manual';
  const buoyLive = st === 'pulled';
  // (traffic dots move on live lines: redraw always while any line is live)
  const phase = trunkLive || buoyLive ? Math.floor(t * 10) : 0;
  if (!changed(s, `mimic|${st}|${phase}|${blinkOf(t, 1)}|${W}x${H}`)) return false;
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const p = H * 0.06;
  // header band: title left, mode right
  const hb = H * 0.17;
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, hb);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = K.text;
  fit(g, '헤드엔드 — 트렁크 단선', 800, hb * 0.62, W * 0.45); g.fillText('헤드엔드 — 트렁크 단선', p, hb / 2);
  const mode = st === 'auto' ? '모드: 자동' : '모드: 수동 — 보호 꺼짐';
  const mcol = st === 'auto' ? K.green : K.amber;
  g.textAlign = 'right';
  glow(g, mcol, hb * 0.2, () => { g.fillStyle = st !== 'auto' && !blinkOf(t, 0.5) ? '#a8701e' : mcol; fit(g, mode, 900, hb * 0.62, W * 0.45); g.fillText(mode, W - p, hb / 2); });

  const RED = K.red, GRN = K.green, DIM = 'rgba(156,186,208,0.35)';
  const lw = Math.max(3, H * 0.022);
  const yT = H * 0.43, yB = H * 0.8;
  const xHE0 = W * 0.03, xHE1 = W * 0.17, xJ = W * 0.25, xBJ = W * 0.58, xS = W * 0.95;
  const xMP = W * 0.42, xBU = W * 0.8;
  const trunkCol = trunkLive ? GRN : RED;
  const buoyCol = st === 'cut' ? RED : buoyLive ? GRN : K.amber;
  const line = (pts: [number, number][], col: string, dash = false, live = false) => {
    g.save();
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    if (dash) g.setLineDash([lw * 3, lw * 2.5]);
    g.shadowColor = col; g.shadowBlur = live ? lw * 2 : lw * 0.6;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    g.restore();
    if (!live) return;
    // traffic: dots travelling outward along the line
    let L = 0; const seg: number[] = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    const gap = lw * 9, off = (t * lw * 14) % gap;
    g.fillStyle = '#eafff2';
    for (let d = off; d < L; d += gap) {
      let r = d, i = 0;
      while (i < seg.length - 1 && r > seg[i]) { r -= seg[i]; i++; }
      const k = Math.min(1, r / seg[i]);
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
      g.beginPath(); g.arc(x, y, lw * 0.55, 0, Math.PI * 2); g.fill();
    }
  };
  // the trunk: head-end → junction → beach joint → surface
  line([[xHE1, yT], [xBJ, yT]], trunkCol, false, trunkLive);
  line([[xBJ, yT], [xS - lw * 3, yT]], trunkCol, false, trunkLive);
  // the branch: junction → moon pool → tether → buoy
  line([[xJ, yT], [xJ, yB], [xMP, yB]], buoyCol, !buoyLive && st !== 'cut', buoyLive);
  line([[xMP, yB], [xBU, yB]], buoyCol, !buoyLive && st !== 'cut', buoyLive);
  // arrow at the surface end
  g.fillStyle = trunkCol;
  g.beginPath(); g.moveTo(xS, yT); g.lineTo(xS - lw * 4, yT - lw * 2.2); g.lineTo(xS - lw * 4, yT + lw * 2.2); g.closePath(); g.fill();
  // head-end block
  g.fillStyle = K.panel; g.strokeStyle = K.text; g.lineWidth = Math.max(2, lw * 0.5);
  const hh = H * 0.2;
  g.fillRect(xHE0, yT - hh / 2, xHE1 - xHE0, hh); g.strokeRect(xHE0, yT - hh / 2, xHE1 - xHE0, hh);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = K.text;
  fit(g, '헤드엔드', 800, hh * 0.42, (xHE1 - xHE0) * 0.86); g.fillText('헤드엔드', (xHE0 + xHE1) / 2, yT);
  // the changeover switch at the junction: AUTO = blade on the trunk with the failover arrow; MANUAL = blade lifted
  const sw = H * 0.09;
  g.save(); g.strokeStyle = st === 'auto' ? GRN : K.amber; g.lineWidth = lw * 0.8; g.lineCap = 'round';
  g.beginPath(); g.arc(xJ, yT, lw * 1.2, 0, Math.PI * 2); g.stroke();
  const ang = st === 'auto' ? -0.05 : -0.75;
  g.beginPath(); g.moveTo(xJ, yT); g.lineTo(xJ + Math.cos(ang) * sw * 1.4, yT + Math.sin(ang) * sw * 1.4); g.stroke();
  g.restore();
  g.textAlign = 'center'; g.fillStyle = st === 'auto' ? GRN : K.amber;
  fit(g, st === 'auto' ? '자동' : '수동', 800, H * 0.06, W * 0.06); g.fillText(st === 'auto' ? '자동' : '수동', xJ + sw * 0.8, yT - sw * 1.45);
  // nodes
  const node = (x: number, y: number, col: string, broken: boolean) => {
    const r = lw * 2.1;
    g.save(); g.fillStyle = K.bg; g.strokeStyle = col; g.lineWidth = lw * 0.7;
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke();
    if (broken) {
      g.strokeStyle = RED; g.lineWidth = lw * 0.8; g.shadowColor = RED; g.shadowBlur = lw * 2;
      g.beginPath(); g.moveTo(x - r * 1.5, y - r * 1.5); g.lineTo(x + r * 1.5, y + r * 1.5); g.moveTo(x + r * 1.5, y - r * 1.5); g.lineTo(x - r * 1.5, y + r * 1.5); g.stroke();
    }
    g.restore();
  };
  node(xBJ, yT, trunkCol, !trunkLive);
  node(xMP, yB, buoyCol, false);
  node((xMP + xBU) / 2, yB, buoyCol, st === 'cut');
  // the buoy: a small float symbol
  g.save(); g.strokeStyle = buoyCol; g.lineWidth = lw * 0.7; g.fillStyle = K.bg;
  g.beginPath(); g.arc(xBU + lw * 2.5, yB, lw * 2.3, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(xBU + lw * 2.5, yB - lw * 2.3); g.lineTo(xBU + lw * 2.5, yB - lw * 5); g.stroke();
  g.restore();
  // labels
  const lab = (txt: string, x: number, y: number, col: string, align: CanvasTextAlign, size = H * 0.075, maxW = W * 0.3) => {
    g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; fit(g, txt, 800, size, maxW); g.fillText(txt, x, y);
  };
  const blink = blinkOf(t, 1);
  lab('볼트 — 비치 조인트', xBJ, yT - H * 0.1, K.label, 'center');
  lab('수면 2.1 KM', xS, yT - H * 0.1, K.label, 'right', H * 0.075, W * 0.2);
  if (!trunkLive) glow(g, RED, H * 0.03, () => lab(blink ? '광케이블 — 신호 손실' : '', xBJ, yT + H * 0.1, RED, 'center', H * 0.085));
  else lab('광케이블 — 사용 중', (xBJ + xS) / 2, yT + H * 0.08, 'rgba(125,255,176,0.75)', 'center', H * 0.06);
  lab('문풀', xMP, yB + H * 0.1, K.label, 'center', H * 0.08, W * 0.14);
  lab('테더', (xMP + xBU) / 2, yB - H * 0.09, K.label, 'center', H * 0.08, W * 0.14);
  const bv = st === 'cut' ? '음향 부이: 신호 손실' : buoyLive ? '음향 부이: 활성' : '음향 부이: 대기';
  glow(g, buoyCol, buoyLive || st === 'cut' ? H * 0.03 : 0, () => lab(st === 'cut' && !blink ? '음향 부이:' : bv, xBU + lw * 6, yB, buoyCol, 'left', H * 0.075, W - xBU - lw * 6 - p));
  return true;
}

// ───────────────────────────── manifest (queue6, console6)

const QUEUE_DEFAULT = [
  '@title 헤드엔드 — 발신 대기열',
  '대기 중: 적하목록 0031-H / B-14',
  '클라스프 조립체(경추용) × 240',
  '발송: 문풀 → 해저 셔틀',
  '발송: B-01 … B-13',
  '수령인: —',
].join('\n');

interface ManifestDoc { title: string; rate: number; hl: string; cursor: string; scroll: number; rows: number; lines: string[] }
export function parseManifest(text: string | undefined): ManifestDoc {
  const d: ManifestDoc = { title: '헤드엔드 — 발신 대기열', rate: 0, hl: '', cursor: '', scroll: -1, rows: 0, lines: [] };
  const src = text && text.trim() ? text : QUEUE_DEFAULT;
  for (const raw of src.split('\n')) {
    const ln = raw.replace(/\s+$/, '');
    const m = /^@(title|rate|hl|cursor|scroll|rows)\s*(.*)$/.exec(ln.trim());
    if (!m) { d.lines.push(ln); continue; }
    const v = m[2].trim();
    if (m[1] === 'title') d.title = v;
    else if (m[1] === 'rate') d.rate = Math.max(0, Number(v) || 0);
    else if (m[1] === 'hl') d.hl = v;
    else if (m[1] === 'cursor') d.cursor = v;
    else if (m[1] === 'scroll') d.scroll = Math.max(0, Math.floor(Number(v) || 0));
    else d.rows = Math.max(3, Math.min(30, Math.floor(Number(v) || 13)));
  }
  // (a short list is set larger: 7 … 13 rows unless @rows says)
  if (!d.rows) d.rows = Math.min(13, Math.max(7, d.lines.length));
  return d;
}

export function manifest(s: S5): boolean {
  const { g, W, H, t } = s;
  const doc = parseManifest(s.text);
  // what was already on screen stays (unchanged lines at the same index); only new lines type in
  if (s.aux.mText !== s.text) {
    const prev = (s.aux.mLines as string[] | undefined);
    let keep = doc.lines.length;
    if (prev && doc.rate > 0) {
      const shown = Number(s.aux.mShown ?? prev.length);
      keep = 0;
      while (keep < doc.lines.length && keep < prev.length && keep < shown && prev[keep] === doc.lines[keep]) keep++;
    }
    s.aux.mText = s.text; s.aux.mLines = doc.lines; s.aux.mKeep = keep;
  }
  const keep = Number(s.aux.mKeep ?? doc.lines.length);
  const n = doc.lines.length;
  // typing: line i (≥ keep) appears over [ (i-keep)·rate, (i-keep+1)·rate ), its characters left to right
  const prog = doc.rate > 0 ? t / doc.rate : Infinity;
  const full = Math.min(n, keep + Math.floor(prog));
  const part = full < n ? prog - Math.floor(prog) : 0;
  const typing = full < n;
  s.aux.mShown = full;
  const curLine = doc.cursor ? doc.lines.findIndex((l) => l.includes(doc.cursor)) : -1;
  const blink = blinkOf(t, 1.2);
  const partChars = typing ? Math.floor(doc.lines[full].length * part) : 0;
  if (!changed(s, `man|${s.text}|${full}|${partChars}|${blink && (typing || curLine >= 0)}|${W}x${H}`)) return false;

  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const rows = doc.rows;
  const hb = H / (rows + 2.2) * 1.4;
  const rh = (H - hb - H * 0.05) / rows;
  const p = rh * 0.55;
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, hb);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = K.text;
  fit(g, doc.title, 800, hb * 0.6, W * 0.7); g.fillText(doc.title, p, hb / 2);
  g.textAlign = 'right'; g.fillStyle = K.label;
  const tag = typing ? '수신 중' : `${n} LINES`;
  fit(g, tag, 700, hb * 0.45, W * 0.25); g.fillText(tag, W - p, hb / 2);
  // which lines are in view: follow the newest (or @scroll)
  const visible = typing ? full + 1 : full;
  const first = doc.scroll >= 0 ? Math.min(doc.scroll, Math.max(0, n - 1)) : Math.max(0, visible - rows);
  const fs = rh * 0.62;
  g.font = `600 ${Math.round(fs)}px ${MONO}`;
  // (a line too wide shrinks alone)
  for (let r = 0; r < rows; r++) {
    const i = first + r;
    if (i >= visible || i >= n) break;
    let ln = doc.lines[i];
    if (i === full && typing) ln = ln.slice(0, partChars);
    const y = hb + H * 0.025 + rh * (r + 0.5);
    const hl = !!doc.hl && doc.lines[i].includes(doc.hl);
    if (hl) { g.fillStyle = 'rgba(255,180,60,0.16)'; g.fillRect(p * 0.5, y - rh / 2, W - p, rh); }
    const col = hl ? K.amber : /^(TRUNK|LAST OUTBOUND|MANIFEST|QUEUED|TOTAL|CONSIGNEE)/.test(ln) ? K.text : '#bcd6ea';
    g.textAlign = 'left';
    let sz = fs; g.font = `600 ${Math.round(sz)}px ${MONO}`;
    while (g.measureText(doc.lines[i]).width > W - p * 3 && sz > 6) { sz -= 1; g.font = `600 ${Math.round(sz)}px ${MONO}`; }
    glow(g, col, hl ? rh * 0.35 : rh * 0.18, () => { g.fillStyle = col; g.fillText(ln, p, y); });
    // cursor
    const curHere = (typing && i === full) || (!typing && i === curLine);
    if (curHere && blink) {
      const x = p + g.measureText(ln).width + sz * 0.25;
      g.fillStyle = hl ? K.amber : K.text; g.fillRect(x, y - sz * 0.5, sz * 0.55, sz);
    }
  }
  // scroll bar when the list is longer than the view
  if (n > rows) {
    const bx = W - p * 0.45, by = hb + H * 0.02, bh = H - by - H * 0.03;
    g.fillStyle = K.line; g.fillRect(bx, by, Math.max(2, p * 0.15), bh);
    g.fillStyle = K.label; g.fillRect(bx, by + bh * (first / n), Math.max(2, p * 0.15), bh * Math.min(1, rows / n));
  }
  return true;
}

// ───────────────────────────── interlock (bj6, shaft6_panel)

type LockState = 'locked' | 'open' | 'los';
export function interlockState(text: string | undefined): { title: string; st: LockState; label: string; key: string } {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const title = lines[0] ?? '인터록';
  const key = /KEY\s+([A-Z])\b/.exec(title.toUpperCase())?.[1] ?? 'A';
  const raw = lines[1] ?? 'locked';
  const u = raw.toUpperCase();
  const st: LockState = u === '열림' || (/OPEN/.test(u) && !/\bLOS\b/.test(u)) ? 'open' : u === '신호 손실' || /\bLOS\b|FAULT/.test(u) ? 'los' : 'locked';
  const label = u === '잠김' ? `INSERT KEY ${key}` : u === '열림' ? `KEY ${key} IN — OPEN` : u === '신호 손실' ? '광케이블 — 신호 손실' : raw.toUpperCase();
  return { title, st, label, key };
}

export function interlock(s: S5): boolean {
  const { g, W, H, t } = s;
  const { title, st, label, key } = interlockState(s.text);
  const blink = blinkOf(t, 1);
  // the key turns over 0.4 s after the write that opened it
  const turn = st === 'locked' ? 0 : Math.min(1, t / 0.4);
  if (!changed(s, `il|${s.text}|${blink}|${turn.toFixed(2)}|${W}x${H}`)) return false;
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const hb = H * 0.2, p = Math.min(W, H) * 0.06;
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, hb);
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = K.text;
  fit(g, title, 800, hb * 0.55, W - p * 2); g.fillText(title, W / 2, hb / 2);
  const col = st === 'open' ? K.green : st === 'los' ? K.red : K.amber;
  // the Castell barrel: a ring, the keyway, the key (bow + shank) when in, turned 90°
  const cx = W * 0.2, cy = hb + (H - hb) * 0.47, R = Math.min(W * 0.14, (H - hb) * 0.3);
  g.save();
  g.fillStyle = '#0b1a28'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col; g.lineWidth = Math.max(2, R * 0.09); g.shadowColor = col; g.shadowBlur = R * 0.25;
  g.globalAlpha = st === 'locked' && !blink ? 0.55 : 1;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  g.translate(cx, cy); g.rotate(turn * Math.PI / 2);
  g.fillStyle = '#030608';
  g.fillRect(-R * 0.09, -R * 0.55, R * 0.18, R * 1.1);
  if (st !== 'locked') {
    g.fillStyle = col; g.shadowBlur = R * 0.2;
    g.fillRect(-R * 0.07, -R * 0.5, R * 0.14, R * 1.0);
    g.beginPath(); g.roundRect(-R * 0.32, -R * 0.95, R * 0.64, R * 0.5, R * 0.12); g.fill();
    g.fillStyle = K.bg; g.font = `900 ${Math.round(R * 0.36)}px ${COND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(key, 0, -R * 0.69);
  }
  g.restore();
  // position marks: LOCKED (up) / OPEN (right)
  g.fillStyle = K.label; g.textAlign = 'center';
  fit(g, 'L', 800, R * 0.3, R); g.fillText('L', cx, cy - R * 1.22);
  fit(g, 'O', 800, R * 0.3, R); g.fillText('O', cx + R * 1.24, cy);
  // status, right
  const x0 = W * 0.44, iw = W - x0 - p;
  g.textAlign = 'left';
  g.fillStyle = K.label; fit(g, `KEY ${key}`, 800, (H - hb) * 0.16, iw); g.fillText(`KEY ${key}`, x0, hb + (H - hb) * 0.24);
  const lines = label.includes(' — ') ? label.split(' — ').map((x, i, a) => (i < a.length - 1 ? x + ' —' : x)) : [label];
  const show = st !== 'locked' || blink;
  glow(g, col, (H - hb) * 0.05, () => {
    g.fillStyle = show ? col : '#7a5a24';
    const sz = Math.min(...lines.map((l) => fit(g, l, 900, (H - hb) * (lines.length > 1 ? 0.18 : 0.22), iw)));
    g.font = `900 ${Math.round(sz)}px ${COND}`;
    lines.forEach((l, i) => g.fillText(l, x0, hb + (H - hb) * 0.5 + i * sz * 1.15));
  });
  // footer: the rule plate's text
  g.fillStyle = K.line; g.fillRect(p, H - (H - hb) * 0.16, W - p * 2, Math.max(1, H * 0.006));
  g.fillStyle = K.label; g.textAlign = 'center';
  const foot = st === 'locked' ? '트랩드키 인터록 — 상류에서 키 해제됨' : '열린 동안 키 고정됨';
  fit(g, foot, 700, (H - hb) * 0.08, W - p * 2); g.fillText(foot, W / 2, H - (H - hb) * 0.08);
  return true;
}

// ───────────────────────────── dock_board (the chamber's 12 × 3 m board)

const BOARD_DEFAULT = [
  '문풀 — 도크 — 2,140 M',
  '이송 B-14: 하강 중',
  '화물 록: 내부 문 닫힘',
  '배수: 34 % — 정지됨',
  '테더: 팽팽함 — 부이: 대기',
  '로더 DL-2: 작동 중',
].join('\n');

function splitRow(ln: string): [string, string] {
  const i = ln.indexOf(': ');
  return i < 0 ? ['', ln.trim()] : [ln.slice(0, i).trim(), ln.slice(i + 2).trim()];
}

export function dockBoard(s: S5): boolean {
  const { g, W, H, t, rand } = s;
  const text = s.text && s.text.trim() ? s.text : BOARD_DEFAULT;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  // remember the previous rows: only a CHANGED row flips (never on creation)
  if (s.aux.bText !== text) {
    s.aux.bPrev = s.aux.bText === undefined ? null : String(s.aux.bText).split('\n').map((l) => l.trim()).filter(Boolean);
    s.aux.bText = text;
  }
  const prev = s.aux.bPrev as string[] | null;
  const ft = (i: number, ln: string) => (prev && prev[i] !== ln ? t - (i - 1) * 0.06 : 9);
  const flipping = !!prev && t < 0.45 + lines.length * 0.06;
  const blinkRows = lines.some((l) => /HAZARD|FAULT/.test(l.toUpperCase()));
  const blink = blinkOf(t, 1);
  if (!changed(s, `db|${text}|${flipping ? t.toFixed(2) : 'x'}|${blinkRows && blink}|${W}x${H}`)) return false;
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const p = H * 0.05;
  const hb = H * 0.2;
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, hb);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = K.text;
  const title = flip(lines[0] ?? '', ft(0, lines[0] ?? ''), rand);
  glow(g, K.text, hb * 0.1, () => { fit(g, title, 900, hb * 0.68, W - p * 2); g.fillText(title, p, hb / 2); });
  const body = lines.slice(1);
  const rh = (H - hb - p) / Math.max(1, body.length);
  body.forEach((ln, j) => {
    const i = j + 1;
    const [label0, value0] = splitRow(ln);
    const label = flip(label0, ft(i, ln), rand), value = flip(value0, ft(i, ln), rand);
    const col = trunkColour(value0);
    const y = hb + p * 0.5 + rh * (j + 0.5);
    if (j > 0) { g.fillStyle = K.line; g.fillRect(p, y - rh / 2, W - p * 2, Math.max(1, H * 0.004)); }
    const warn = /HAZARD|FAULT/.test(value0.toUpperCase());
    const on = !warn || blink;
    g.globalAlpha = on ? 1 : 0.3;
    glow(g, col, rh * 0.3, () => { g.fillStyle = col; g.beginPath(); g.arc(p + rh * 0.22, y, rh * 0.16, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
    const lx = p + rh * 0.6;
    g.textAlign = 'left'; g.fillStyle = K.label;
    const ls = fit(g, label, 800, rh * 0.76, (W - lx - p) * 0.34);
    g.fillText(label, lx, y);
    g.textAlign = 'right';
    g.globalAlpha = on ? 1 : 0.45;
    glow(g, col, rh * 0.2, () => { g.fillStyle = col; fit(g, value, 900, Math.max(ls, rh * 0.76), (W - lx - p) * 0.64); g.fillText(value, W - p, y); });
    g.globalAlpha = 1;
  });
  return true;
}

// ───────────────────────────── gauge (gauge6, the shear's hydraulic pressure)

export const GAUGE_FULL_BAR = 210;
const GAUGE_MAX = 250;
type GaugeState = { st: 'pin' | 'read' | 'fired' | 'low'; k: number };
export function gaugeState(text: string | undefined): GaugeState {
  const u = (text ?? '').trim().toUpperCase();
  if (!u || u === '핀' || u === '핀 삽입됨') return { st: 'pin', k: 0 };
  if (u === '발사됨') return { st: 'fired', k: 0 };
  const [a, b] = u.split('|');
  const num = (v: string | undefined) => { const n = Number((v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
  if (a === '낮음' || a === '압력 낮음') return { st: 'low', k: Math.max(0, Math.min(1, num(b))) };
  // a display string `n BAR …` reads as bar; a plain number as the fraction
  const k = /BAR/.test(a) ? num(a) / GAUGE_FULL_BAR : num(a);
  return { st: 'read', k: Math.max(0, Math.min(1, k)) };
}

export function gauge(s: S5): boolean {
  const { g, W, H, t } = s;
  const gs = gaugeState(s.text);
  // needle: eases to its target (pressure dumps on fired; a PRESSURE LOW message holds 1.2 s, then reads k)
  const target = gs.st === 'pin' || gs.st === 'fired' ? 0 : gs.k;
  const lastT = Number(s.aux.gT ?? t);
  const dt = Math.max(0, Math.min(0.25, t - lastT));
  s.aux.gT = t;
  let nd = Number(s.aux.gN ?? target);
  nd += (target - nd) * (1 - Math.exp(-dt * (gs.st === 'fired' ? 9 : 14)));
  if (Math.abs(target - nd) < 0.002) nd = target;
  s.aux.gN = nd;
  const lowMsg = gs.st === 'low' && t < 1.2;
  const ready = gs.st === 'read' && gs.k >= 1;
  const blink = blinkOf(t, 1.2);
  const losShown = gs.st === 'fired' && t >= 0.6;
  if (!changed(s, `g|${s.text}|${nd.toFixed(3)}|${lowMsg}|${(ready || lowMsg || gs.st === 'pin') && blink}|${losShown}|${W}x${H}`)) return false;

  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const S = Math.min(W, H);
  const cx = W / 2, cy = H * 0.5, R = S * 0.36;
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = K.label; fit(g, '전단 — 유압', 800, S * 0.06, W * 0.9); g.fillText('전단 — 유압', cx, H * 0.06);
  // dial face
  g.fillStyle = '#0b1a28'; g.beginPath(); g.arc(cx, cy, R * 1.08, 0, Math.PI * 2); g.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const ang = (bar: number) => a0 + (a1 - a0) * (bar / GAUGE_MAX);
  // the firing band 200–220 green, above red
  g.lineWidth = R * 0.08;
  g.strokeStyle = 'rgba(125,255,176,0.55)'; g.beginPath(); g.arc(cx, cy, R * 0.92, ang(200), ang(220)); g.stroke();
  g.strokeStyle = 'rgba(255,80,64,0.5)'; g.beginPath(); g.arc(cx, cy, R * 0.92, ang(220), ang(GAUGE_MAX)); g.stroke();
  // ticks + numerals
  g.strokeStyle = K.text; g.fillStyle = K.text;
  for (let b = 0; b <= GAUGE_MAX; b += 10) {
    const a = ang(b), major = b % 50 === 0;
    const r0 = R * (major ? 0.78 : 0.84), r1 = R * 0.98;
    g.lineWidth = Math.max(1, R * (major ? 0.025 : 0.012));
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    if (major) {
      g.font = `700 ${Math.round(R * 0.15)}px ${COND}`;
      g.fillText(String(b), cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
    }
  }
  // the 210 index
  const ai = ang(GAUGE_FULL_BAR);
  g.fillStyle = K.green;
  g.beginPath();
  g.moveTo(cx + Math.cos(ai) * R * 1.0, cy + Math.sin(ai) * R * 1.0);
  g.lineTo(cx + Math.cos(ai + 0.05) * R * 1.12, cy + Math.sin(ai + 0.05) * R * 1.12);
  g.lineTo(cx + Math.cos(ai - 0.05) * R * 1.12, cy + Math.sin(ai - 0.05) * R * 1.12);
  g.closePath(); g.fill();
  g.fillStyle = K.label; g.font = `700 ${Math.round(R * 0.11)}px ${COND}`; g.fillText('BAR', cx, cy + R * 0.32);
  // needle
  const an = ang(nd * GAUGE_FULL_BAR);
  const ca = Math.cos(an), sa = Math.sin(an), nx = -sa, ny = ca;
  g.fillStyle = '#3a4a58';
  g.beginPath(); g.arc(cx - ca * R * 0.16, cy - sa * R * 0.16, R * 0.06, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3a4a58'; g.lineWidth = Math.max(2, R * 0.03);
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - ca * R * 0.16, cy - sa * R * 0.16); g.stroke();
  glow(g, '#ffffff', R * 0.06, () => {
    g.fillStyle = '#f4f8fb';
    const bw = R * 0.035;
    g.beginPath(); g.moveTo(cx + nx * bw, cy + ny * bw); g.lineTo(cx + ca * R * 0.88, cy + sa * R * 0.88); g.lineTo(cx - nx * bw, cy - ny * bw); g.closePath(); g.fill();
  });
  g.fillStyle = '#2a3a48'; g.beginPath(); g.arc(cx, cy, R * 0.07, 0, Math.PI * 2); g.fill();
  // digital readout + state line
  const bar = Math.round(nd * GAUGE_FULL_BAR);
  g.fillStyle = K.text; fit(g, `${bar}`, 800, R * 0.2, R * 0.8, MONO); g.fillText(`${bar}`, cx, cy + R * 0.6);
  let msg: string, col: string;
  if (gs.st === 'pin') { msg = '핀 삽입됨'; col = K.amber; }
  else if (gs.st === 'fired') { msg = '발사됨'; col = K.red; }
  else if (lowMsg) { msg = '압력 낮음'; col = K.red; }
  else if (ready) { msg = `${GAUGE_FULL_BAR} BAR — READY`; col = K.green; }
  else if (bar <= 0) { msg = '0 BAR — 펌프'; col = K.amber; }
  else { msg = `${bar} BAR`; col = K.text; }
  const dim = (gs.st === 'pin' || lowMsg || ready) && !blink;
  glow(g, col, S * 0.03, () => { g.fillStyle = dim ? 'rgba(156,186,208,0.45)' : col; fit(g, msg, 900, S * 0.085, W * 0.92); g.fillText(msg, cx, H * 0.9); });
  if (losShown) { g.fillStyle = K.red; fit(g, '트렁크: 신호 손실 · 부이: 신호 손실', 800, S * 0.05, W * 0.9); g.fillText('트렁크: 신호 손실 · 부이: 신호 손실', cx, H * 0.97); }
  return true;
}

// ───────────────────────────── feed OSD (console6's E2: the live picture of the empty cradle)

const HMS = /(\d{2}):(\d{2}):(\d{2})/;
function tickHms(ln: string, t: number): string {
  const m = HMS.exec(ln);
  if (!m) return ln;
  const total = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Math.floor(t)) % 86400;
  const f = (n: number) => String(n).padStart(2, '0');
  return ln.slice(0, m.index) + `${f(Math.floor(total / 3600))}:${f(Math.floor(total / 60) % 60)}:${f(total % 60)}` + ln.slice(m.index + 8);
}
const OSD_CPS = 34;

/** Draws the OSD (text on black: the overlay is ADDED to the live picture by the shader patch below). */
export function feedOsd(s: S5): boolean {
  const { g, W, H, t } = s;
  const lines = (s.text ?? '').split('\n').filter((l) => l.trim());
  if (s.aux.oText !== s.text) {
    const prev = (s.aux.oLines as string[] | undefined) ?? null;
    let keep = 0;
    // the same line at the same index (clock aside) is not typed again
    const norm = (l: string) => l.replace(HMS, '');
    if (prev) while (keep < lines.length && keep < prev.length && norm(prev[keep]) === norm(lines[keep])) keep++;
    s.aux.oText = s.text; s.aux.oLines = lines; s.aux.oKeep = prev ? keep : lines.length; s.aux.oT0 = t;
  }
  const keep = Number(s.aux.oKeep ?? lines.length);
  // (the clock and the typing count from the write, not from the screen's own clock)
  const el = Math.max(0, t - Number(s.aux.oT0 ?? t));
  // typed characters so far, the new lines one after the other
  let budget = Math.floor(el * OSD_CPS);
  const shown = lines.map((l, i) => {
    if (i < keep) return l;
    const n = Math.min(l.length, budget); budget -= n;
    return l.slice(0, n);
  });
  const sec = Math.floor(el);
  if (!changed(s, `osd|${s.text}|${shown.map((l) => l.length).join(',')}|${sec}|${W}x${H}`)) return false;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (!lines.length) return true;
  const fs = Math.max(10, Math.round(H * 0.055));
  g.font = `700 ${fs}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left';
  // bottom lines stack as a block in their written order
  let top = H * 0.05, bottom = H * 0.95 - lines.filter((l) => l.startsWith('_')).length * fs * 1.3;
  const typingAt = shown.findIndex((l, i) => i >= keep && l.length < lines[i].length);
  shown.forEach((l0, i) => {
    const bottomLine = lines[i].startsWith('_');
    const l = tickHms(bottomLine ? l0.slice(1) : l0, el);
    if (!l && !(i === typingAt)) return;
    const y = bottomLine ? bottom : top;
    let sz = fs; g.font = `700 ${sz}px ${MONO}`;
    while (g.measureText(lines[i]).width > W * 0.92 && sz > 8) { sz -= 1; g.font = `700 ${sz}px ${MONO}`; }
    g.fillStyle = '#e8eef2';
    g.fillText(l, W * 0.04, y);
    if (i === typingAt && Math.floor(el * 4) % 2 === 0) g.fillRect(W * 0.04 + g.measureText(l).width + sz * 0.15, y, sz * 0.55, sz);
    if (bottomLine) bottom += fs * 1.3; else top += sz * 1.3;
  });
  return true;
}

/**
 * The OSD shader patch (trunk level only, every screen material so all screens share one program): the screen's own
 * canvas is ADDED to the emissive map at `uOsd` strength. Only a `feed` with a texture and text turns it on, so every
 * other screen renders exactly as before (strength 0).
 */
export function patchOsd(mat: THREE.MeshStandardMaterial, canvasTex: THREE.Texture) {
  const u = { uOsd: { value: canvasTex }, uOsdK: { value: 0 } };
  mat.userData.osd = u;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uOsd = u.uOsd; sh.uniforms.uOsdK = u.uOsdK;
    sh.fragmentShader = 'uniform sampler2D uOsd;\nuniform float uOsdK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\n  totalEmissiveRadiance += emissive * texture2D( uOsd, vEmissiveMapUv ).rgb * uOsdK;\n#endif');
  };
  mat.customProgramCacheKey = () => 'screen-osd6';
}
/** Turns the OSD layer on / off (no-op on a material without the patch). */
export function setOsd(mat: THREE.MeshStandardMaterial, on: boolean) {
  const u = mat.userData.osd as { uOsdK: { value: number } } | undefined;
  if (u) u.uOsdK.value = on ? 1 : 0;
}
