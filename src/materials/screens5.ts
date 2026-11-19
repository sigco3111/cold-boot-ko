/**
 * Stage 3c screen kinds (docs/plans/stage-3c.md §6.4, §8.9): `keypad`, `launch`, `dock_status`, `onpost`. Drawn by
 * ScreenManager (screens.ts) into the screen's canvas; the shared pixel-grid overlay and glare go on top. The navy
 * look: deep navy glass, cool white type, condensed sans for status, state colour only on the value (green = ready /
 * nominal / complete, amber = running / in progress / sealed, red = refused).
 *
 * `text` formats (what the level / story writes with `setScreen`; the screen's clock `t` restarts at every write):
 *   keypad       `off` | `ready` | `typing|<n>` (n of 4 digits entered) | `rejected` | `accepted` | `open`.
 *                The §6.4 display strings work as well: `권한 없음`, `코드 입력`, `* * * _` (stars = digits typed),
 *                `코드 거부됨`, `승인됨`, `열림`. `rejected` shows CODE REJECTED for 1.2 s, then ENTER CODE by
 *                itself. Portrait quads (aspect < 1) also draw the 3 × 4 key field under the display (1–9, CLR 0 ENT;
 *                unlit while `off`); landscape quads are the display alone.
 *   launch       `idle` (or `-`, empty) | `running[|<seconds>]` (default 6 s: the checklist fills over it) | `complete`.
 *   dock_status  status lines, `\n`-separated: `<LABEL> — <VALUE>` (split at the last ` — `). One line = a wall board
 *                (label over a big value, no header); more = the duty board (level header band, a dot per line). A value
 *                ending in `<d>d <h>h <m>m` counts up by itself from the value written (write it once).
 *                A changed text flips in over 0.45 s (the boards are split-flap-like).
 *   onpost       the number (e.g. `26`); amber LED dot-matrix `근무 중` + the number; a new number rolls in over 0.4 s.
 */

export interface S5 {
  g: CanvasRenderingContext2D;
  W: number; H: number;
  t: number;
  text: string | undefined;
  seed: number;
  rand: () => number;
  aux: Record<string, unknown>;
  /** Level header (`LevelInfo.screenHeader`). */
  header: string;
}

const COND = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';

export const NAVY_INK = { bg: '#040a12', panel: '#0a1724', line: 'rgba(150,190,220,0.35)', label: '#9cbad0', text: '#eaf2f8',
  green: '#7dffb0', amber: '#ffb43c', red: '#ff5040', dimRed: '#7a1c14' };
const K = NAVY_INK;

function fit(g: CanvasRenderingContext2D, txt: string, weight: number, size: number, maxW: number, family = COND) {
  let sz = Math.max(6, size);
  g.font = `${weight} ${Math.round(sz)}px ${family}`;
  while (g.measureText(txt).width > maxW && sz > 6) { sz -= Math.max(1, sz * 0.04); g.font = `${weight} ${Math.round(sz)}px ${family}`; }
  return sz;
}
const glow = (g: CanvasRenderingContext2D, col: string, blur: number, f: () => void) => { g.save(); g.shadowColor = col; g.shadowBlur = blur; f(); g.restore(); };

/** Colour of a status value by its words. */
export function statusColour(v: string): string {
  const u = v.toUpperCase();
  if (/REJECT|REFUS|FAIL|NO AUTHORITY|NOT ROSTERED|LOST|FLOODED/.test(u)) return K.red;
  if (/RUNNING|IN PROGRESS|SEALED|CYCLING|AWAITING|ISOLATED/.test(u)) return K.amber;
  if (/READY|NOMINAL|COMPLETE|ACCEPTED|OPEN|OK\b|RESTORED/.test(u)) return K.green;
  return K.text;
}

// ───────────────────────────── keypad (key5_panel)

type KeyState = 'off' | 'ready' | 'typing' | 'rejected' | 'accepted' | 'open';
export function keypadState(text: string | undefined): { st: KeyState; n: number } {
  const raw = (text ?? '').trim();
  const u = raw.toUpperCase();
  const [a, b] = u.split('|');
  if (a === '입력 중') return { st: 'typing', n: Math.max(0, Math.min(4, Number(b) || 0)) };
  if (/^[*_\s]+$/.test(u) && u.length > 0) return { st: 'typing', n: (u.match(/\*/g) ?? []).length };
  if (a === '준비' || a === '코드 입력') return { st: 'ready', n: 0 };
  if (a === '거부됨' || a === '코드 거부됨') return { st: 'rejected', n: 0 };
  if (a === '승인됨') return { st: 'accepted', n: 4 };
  if (a === '열림') return { st: 'open', n: 4 };
  return { st: 'off', n: 0 };
}

export function keypad(s: S5) {
  const { g, W, H, t } = s;
  let { st, n } = keypadState(s.text);
  if (st === 'rejected' && t > 1.2) st = 'ready';
  const off = st === 'off';
  g.fillStyle = off ? '#050202' : K.bg; g.fillRect(0, 0, W, H);
  const portrait = W < H;
  const dh = portrait ? H * 0.36 : H;          // display height
  const pad = Math.min(W, dh) * 0.06;
  // display glass
  g.fillStyle = off ? '#0a0303' : '#071624';
  g.fillRect(pad, pad, W - pad * 2, dh - pad * 2);
  const cx = W / 2, x0 = pad * 2, iw = W - pad * 4;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // header (the door's name), dim
  g.fillStyle = off ? 'rgba(122,28,20,0.55)' : K.label;
  fit(g, '스파인 — 인가된 출입', 700, dh * 0.11, iw);
  g.fillText('스파인 — 인가된 출입', cx, pad + dh * 0.12);
  const main = (txt: string, col: string, size: number, y: number, blur = 0.06) => {
    glow(g, col, dh * blur, () => { g.fillStyle = col; fit(g, txt, 800, size, iw); g.fillText(txt, cx, y); });
  };
  const blink = Math.floor(t * 2) % 2 === 0;
  if (off) {
    // dark red, dim: the panel has no power to act (it still says so)
    g.fillStyle = K.dimRed; fit(g, '권한 없음', 800, dh * 0.3, iw); g.fillText('권한 없음', cx, dh * 0.58);
  } else if (st === 'ready' || st === 'typing') {
    main('코드 입력', K.text, dh * (st === 'ready' ? 0.27 : 0.17), st === 'ready' ? dh * 0.44 : dh * 0.36);
    // four slots: `*` typed, `_` to come, the next one blinking
    const slots = [0, 1, 2, 3].map((i) => (i < n ? '*' : i === n && !blink ? ' ' : '_'));
    g.fillStyle = K.text;
    const sz = fit(g, '* * * *', 700, dh * 0.34, iw * 0.8, MONO);
    const sw = Math.min(iw * 0.8 / 4, sz * 1.25);
    slots.forEach((c, i) => {
      const x = cx + (i - 1.5) * sw;
      g.fillStyle = i < n ? K.text : K.label;
      g.fillText(c === '*' ? '*' : c, x, dh * (st === 'ready' ? 0.75 : 0.68) + (c === '*' ? sz * 0.12 : 0));
    });
  } else if (st === 'rejected') {
    const on = Math.floor(t * 4) % 2 === 0;
    g.fillStyle = on ? '#3a0806' : '#1a0302'; g.fillRect(pad, pad + dh * 0.22, W - pad * 2, dh * 0.62);
    main('코드 거부됨', on ? K.red : '#c83a2c', dh * 0.27, dh * 0.55, 0.08);
  } else if (st === 'accepted' || st === 'open') {
    g.fillStyle = 'rgba(125,255,176,0.1)'; g.fillRect(pad, pad + dh * 0.22, W - pad * 2, dh * 0.62);
    main(st === 'open' ? '열림' : '승인됨', K.green, dh * 0.34, dh * 0.56, 0.08);
  }
  if (!portrait) return;
  // the key field: 1–9, CLR 0 ENT, backlit when powered
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '입력'];
  const kx0 = W * 0.1, ky0 = dh + H * 0.03, kw = (W * 0.8) / 3, kh = (H - ky0 - H * 0.05) / 4;
  keys.forEach((k, i) => {
    const x = kx0 + (i % 3) * kw, y = ky0 + Math.floor(i / 3) * kh;
    g.fillStyle = off ? '#0c0c0d' : '#121c26';
    g.beginPath(); g.roundRect(x + kw * 0.08, y + kh * 0.08, kw * 0.84, kh * 0.84, kw * 0.1); g.fill();
    const col = off ? '#2a2a2a' : k === '입력' ? K.green : k === '지움' ? '#ff8a70' : K.text;
    g.fillStyle = col;
    fit(g, k, 800, kh * (k.length > 1 ? 0.34 : 0.5), kw * 0.7);
    g.fillText(k, x + kw / 2, y + kh / 2);
  });
}

// ───────────────────────────── launch (the bridge console)

const CHECKLIST = ['밸러스트 배출', '트림', '세일 해치', '크레이들 클램프', '주 배터리', '항법 / 소나'];

export function launch(s: S5) {
  const { g, W, H, t } = s;
  const [stRaw = '', secRaw = ''] = (s.text ?? '').split('|');
  const st = stRaw.trim().toLowerCase();
  const running = st === 'running', complete = st === 'complete';
  const dur = Math.max(1, Number(secRaw) || 6);
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const p = H * 0.04;
  // title band
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, H * 0.15);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = K.text; fit(g, 'SDV 턴 — 발사 관제', 800, H * 0.1, W - p * 2); g.fillText('SDV 턴 — 발사 관제', p, H * 0.077);
  // pre-launch check line
  const val = complete ? '완료 (요청: CHOIR)' : running ? '가동 중' : '—';
  const y1 = H * 0.25;
  g.fillStyle = K.label;
  const ls = fit(g, '발사 전 점검:', 700, H * 0.075, W * 0.42);
  g.fillText('발사 전 점검:', p, y1);
  const lw = g.measureText('발사 전 점검:').width;
  const blink = Math.floor(t * 2.5) % 2 === 0;
  const vcol = complete ? K.green : running ? (blink ? K.amber : '#a8701e') : K.label;
  glow(g, vcol, running || complete ? H * 0.03 : 0, () => { g.fillStyle = vcol; fit(g, val, 800, ls, W - p * 3 - lw); g.fillText(val, p * 2 + lw, y1); });
  // the boat in its cradle (schematic) and the checklist
  const sx = p, sy = H * 0.34, sw = W * 0.46, sh = H * 0.34;
  g.strokeStyle = K.line; g.lineWidth = Math.max(1, H * 0.006); g.strokeRect(sx, sy, sw, sh);
  const k = running ? Math.min(1, t / dur) : complete ? 1 : 0;
  const bcol = complete ? K.green : running ? K.amber : K.label;
  g.save();
  g.strokeStyle = bcol; g.lineWidth = Math.max(1.5, H * 0.008);
  const hx = sx + sw * 0.08, hw = sw * 0.84, hy = sy + sh * 0.52, hr = sh * 0.17;
  g.beginPath(); g.moveTo(hx + hr, hy - hr); g.lineTo(hx + hw - hr * 1.6, hy - hr); g.quadraticCurveTo(hx + hw, hy, hx + hw - hr * 1.6, hy + hr);
  g.lineTo(hx + hr, hy + hr); g.arc(hx + hr, hy, hr, Math.PI / 2, Math.PI * 1.5); g.stroke();
  g.strokeRect(hx + hw * 0.32, hy - hr - sh * 0.16, hw * 0.16, sh * 0.16);              // sail
  // ballast tanks fill (blow) while running
  g.fillStyle = bcol; g.globalAlpha = 0.25 + 0.35 * (running ? 0.5 + 0.5 * Math.sin(t * 6) : complete ? 1 : 0);
  g.fillRect(hx + hr * 0.4, hy - hr * 0.6, hw * 0.22, hr * 1.2); g.fillRect(hx + hw * 0.62, hy - hr * 0.6, hw * 0.2, hr * 1.2);
  g.globalAlpha = 1;
  // cradle saddles
  g.strokeStyle = K.label; for (let i = 0; i < 5; i++) { const x = hx + hw * (0.1 + i * 0.19); g.beginPath(); g.moveTo(x, hy + hr); g.lineTo(x, sy + sh * 0.92); g.stroke(); }
  g.restore();
  const cx0 = sx + sw + p, cw = W - cx0 - p, rh = sh / CHECKLIST.length;
  CHECKLIST.forEach((item, i) => {
    const y = sy + rh * (i + 0.5);
    const done = complete || (running && k * CHECKLIST.length > i + 1);
    const now = running && !done && k * CHECKLIST.length > i;
    g.textAlign = 'left'; g.fillStyle = done || now ? K.text : K.label;
    fit(g, item, 700, rh * 0.62, cw * 0.66); g.fillText(item, cx0, y);
    g.textAlign = 'right';
    const v = done ? 'OK' : now ? (blink ? '· · ·' : '· ·') : '—';
    g.fillStyle = done ? K.green : now ? K.amber : K.label;
    fit(g, v, 800, rh * 0.62, cw * 0.3); g.fillText(v, cx0 + cw, y);
  });
  // launch authority + awaiting palm
  g.textAlign = 'left'; g.fillStyle = K.text;
  fit(g, '발사 권한: 장교 손바닥 인증 — 함장/부함장', 800, H * 0.085, W - p * 2);
  g.fillText('발사 권한: 장교 손바닥 인증 — 함장/부함장', p, H * 0.76);
  const by = H * 0.83, bh = H * 0.13;
  const pulse = complete ? 0.6 + 0.4 * Math.abs(Math.sin(t * 2)) : 0.55;
  g.globalAlpha = pulse; g.strokeStyle = K.amber; g.lineWidth = Math.max(2, H * 0.012); g.strokeRect(p, by, W - p * 2, bh);
  g.globalAlpha = 1;
  g.textAlign = 'center';
  glow(g, K.amber, complete ? H * 0.04 : 0, () => { g.fillStyle = complete ? K.amber : '#b07a2a'; fit(g, '손바닥 인증 대기 중', 900, bh * 0.66, W * 0.8); g.fillText('손바닥 인증 대기 중', W / 2, by + bh * 0.53); });
}

// ───────────────────────────── dock_status (duty board, TERN board)

const DHM = /(\d+)d\s*(\d+)h\s*(\d+)m\s*$/;
function tickDhm(v: string, t: number): string {
  const m = DHM.exec(v);
  if (!m) return v;
  const total = Number(m[1]) * 1440 + Number(m[2]) * 60 + Number(m[3]) + Math.floor(t / 60);
  const d = Math.floor(total / 1440), h = Math.floor(total / 60) % 24, mi = total % 60;
  return v.slice(0, m.index) + `${d}일 ${String(h).padStart(2, '0')}시간 ${String(mi).padStart(2, '0')}분`;
}
function splitLine(ln: string): [string, string] {
  const i = ln.lastIndexOf(' — ');
  return i < 0 ? ['', ln.trim()] : [ln.slice(0, i).trim(), ln.slice(i + 3).trim()];
}
/** Flip-in: characters scramble and settle left to right over 0.45 s after a write. */
function flip(txt: string, t: number, rand: () => number): string {
  if (t >= 0.45) return txt;
  const k = t / 0.45;
  const A = 'ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789—';
  return txt.split('').map((c, i) => (c === ' ' || i / txt.length < k ? c : A[Math.floor(rand() * A.length)])).join('');
}

export function dockStatus(s: S5) {
  const { g, W, H, t, rand } = s;
  const lines = (s.text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  // only a CHANGED line flips (never on creation: the board was already showing it)
  const prev = s.aux.prev === undefined ? null : String(s.aux.prev ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ft = (i: number, ln: string) => (prev && prev[i] !== ln ? t - i * 0.06 : 9);
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const blink = Math.floor(t * 2) % 2 === 0;
  if (lines.length <= 1) {
    // a wall board read from across a hall: label over a big value
    const [label, value0] = splitLine(lines[0] ?? '');
    const value = flip(tickDhm(value0, t), ft(0, lines[0] ?? ''), rand);
    const col = statusColour(value0);
    const p = H * 0.08;
    g.fillStyle = '#16324a'; g.fillRect(0, 0, W, H * 0.06); g.fillRect(0, H * 0.94, W, H * 0.06);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (label) {
      const lab = flip(label, ft(0, lines[0] ?? ''), rand);
      g.fillStyle = K.label; fit(g, lab, 800, H * 0.27, W - p * 2); g.fillText(lab, W / 2, H * 0.3);
    }
    const dotR = H * 0.09;
    const on = !/RUNNING|IN PROGRESS/.test(value0.toUpperCase()) || blink;
    glow(g, col, H * 0.08, () => {
      g.fillStyle = col;
      const sz = fit(g, value, 900, H * (label ? 0.4 : 0.55), W - p * 2 - dotR * 4);
      const tw = g.measureText(value).width;
      const vy = label ? H * 0.66 : H * 0.5;
      g.fillText(value, W / 2 + dotR * 1.4, vy);
      g.globalAlpha = on ? 1 : 0.25;
      g.beginPath(); g.arc(W / 2 - tw / 2 - dotR * 0.4, vy, Math.min(dotR, sz * 0.3), 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    });
    return;
  }
  // the duty board: header band + one row per line
  const hb = H * 0.12, p = H * 0.05;
  g.fillStyle = '#16324a'; g.fillRect(0, 0, W, hb);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = K.text; fit(g, s.header, 700, hb * 0.6, W * 0.7); g.fillText(s.header, p, hb / 2);
  g.textAlign = 'right'; g.fillStyle = K.label; fit(g, '도크 상태', 800, hb * 0.6, W * 0.25); g.fillText('도크 상태', W - p, hb / 2);
  const rh = (H - hb - p) / lines.length;
  lines.forEach((ln, i) => {
    const [label, value0] = splitLine(ln);
    const value = flip(tickDhm(value0, t), ft(i, ln), rand);
    const col = statusColour(value0);
    const y = hb + p * 0.5 + rh * (i + 0.5);
    if (i > 0) { g.fillStyle = K.line; g.fillRect(p, y - rh / 2, W - p * 2, Math.max(1, H * 0.004)); }
    const on = !/RUNNING|IN PROGRESS/.test(value0.toUpperCase()) || blink;
    g.globalAlpha = on ? 1 : 0.25;
    glow(g, col, rh * 0.25, () => { g.fillStyle = col; g.beginPath(); g.arc(p + rh * 0.18, y, rh * 0.13, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
    const lx = p + rh * 0.45;
    g.textAlign = 'left'; g.fillStyle = K.text;
    const ls = fit(g, label, 800, rh * 0.42, (W - lx - p) * 0.52);
    g.fillText(label, lx, y);
    g.textAlign = 'right';
    glow(g, col, rh * 0.15, () => { g.fillStyle = col; fit(g, value, 800, Math.max(ls, rh * 0.42), (W - lx - p) * 0.46); g.fillText(value, W - p, y); });
  });
}

// ───────────────────────────── onpost (the gatehouse counter)

/** 5 × 7 LED glyphs (rows top → bottom, bit 4 = left column). */
const GLYPH: Record<string, number[]> = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12], ' ': [0, 0, 0, 0, 0, 0, 0],
  O: [14, 17, 17, 17, 17, 17, 14], N: [17, 25, 21, 19, 17, 17, 17], P: [30, 17, 17, 30, 16, 16, 16], S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
};
function ledText(g: CanvasRenderingContext2D, txt: string, x: number, y: number, dot: number, on: string, offCol: string, dy = 0) {
  let cx = x;
  for (const ch of txt) {
    const rows = GLYPH[ch] ?? GLYPH[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const lit = (rows[r] >> (4 - c)) & 1;
      g.fillStyle = lit ? on : offCol;
      g.beginPath(); g.arc(cx + (c + 0.5) * dot, y + (r + 0.5) * dot + dy, dot * 0.38, 0, Math.PI * 2); g.fill();
    }
    cx += dot * 6;
  }
}

export function onpost(s: S5) {
  const { g, W, H, t } = s;
  const num = (s.text ?? '').trim().replace(/[^0-9]/g, '').slice(0, 3) || '0';
  const prev = String(s.aux.prev ?? '').replace(/[^0-9]/g, '').slice(0, 3);
  g.fillStyle = '#070503'; g.fillRect(0, 0, W, H);
  const AMB = '#ffa526', OFF = 'rgba(255,165,38,0.07)';
  // ON POST: small, top-left; the number: big, right
  const sd = Math.min(H * 0.065, W * 0.4 / 41);
  g.save(); g.shadowColor = AMB; g.shadowBlur = sd * 1.2;
  ledText(g, '근무 중', W * 0.06, H * 0.1, sd, AMB, OFF);
  g.restore();
  const digits = Math.max(2, num.length);
  const bd = Math.min(H * 0.65 / 7, (W * 0.86) / (digits * 6));
  const nx = W - W * 0.06 - (digits * 6 - 1) * bd, ny = H * 0.3;
  const shown = num.padStart(digits, ' ');
  const before = (prev || num).padStart(digits, ' ');
  const k = Math.min(1, t / 0.4);
  g.save();
  g.beginPath(); g.rect(nx - bd, ny - bd * 0.5, W, bd * 8); g.clip();
  g.shadowColor = AMB; g.shadowBlur = bd * 0.9;
  for (let i = 0; i < digits; i++) {
    const x = nx + i * bd * 6;
    if (k < 1 && before[i] !== shown[i]) {
      // the old digit rolls up and out, the new one in from below
      ledText(g, before[i], x, ny, bd, AMB, OFF, -k * bd * 7.5);
      ledText(g, shown[i], x, ny, bd, AMB, 'rgba(0,0,0,0)', (1 - k) * bd * 7.5);
    } else ledText(g, shown[i], x, ny, bd, AMB, OFF);
  }
  g.restore();
  // a thin rule and the arrival arrow under ON POST
  g.fillStyle = 'rgba(255,165,38,0.35)'; g.fillRect(W * 0.06, H * 0.1 + sd * 8.4, sd * 41, Math.max(1, H * 0.008));
}
