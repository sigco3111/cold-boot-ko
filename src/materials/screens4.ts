/**
 * Stage 3b screen kinds (docs/plans/stage-3b.md §6.4, §4.4, §8.7): `containment`, `video_log`, `roster`, `theatre_cam`.
 * Drawn by ScreenManager (screens.ts) into the screen's canvas; the shared pixel-grid overlay and glare go on top.
 *
 * `text` formats (what the level / story writes with `setScreen`; the screen's clock `t` restarts at every write):
 *   containment  `<panel>|<state>|<h:mm:ss>[|<arrow>]`  panel `suite` (surg_hold) or `store` (cold_panel);
 *                state `hold` | `cleared` (suite) | `ack` (store); the DOOR OPEN counter ticks up from the value given
 *                (write it once; re-writing it is harmless); arrow `<` (default) or `>` on the suite panel.
 *   video_log    `idle` (or empty) | `paused|<line 1-9>` | `play|<line 1-9>|<seconds>|<pose>` | `static`;
 *                pose `settle` | `off` | `lean` | `down` | `` (neutral). The pose eases in over the line and holds;
 *                the mask moves with speech for `<seconds>`.
 *   roster       (fixed content; `text` ignored)
 *   theatre_cam  `<cue>|<t>|<attempt>` — cue of the arm cycle (`approach | fit | handshake | fail | remove | regel |
 *                return | idle`, or `off`), `t` = seconds into that cue when written (the screen advances it itself),
 *                attempt = the full attempt number (5601 → `5,601`).
 */

const MONO = 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';
const SANS = '"Helvetica Neue", Arial, "Segoe UI", sans-serif';

export interface S4 {
  g: CanvasRenderingContext2D;
  W: number; H: number;
  t: number;
  text: string | undefined;
  seed: number;
  rand: () => number;
  aux: Record<string, unknown>;
}

function fit(g: CanvasRenderingContext2D, txt: string, weight: number, size: number, maxW: number, family = SANS) {
  let sz = Math.max(6, size);
  g.font = `${weight} ${Math.round(sz)}px ${family}`;
  while (g.measureText(txt).width > maxW && sz > 6) { sz -= Math.max(1, sz * 0.04); g.font = `${weight} ${Math.round(sz)}px ${family}`; }
  return sz;
}
const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const clockOf = (s: string): number | null => {
  const m = /(\d+):(\d{2}):(\d{2})/.exec(s);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};
const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
function arrowGlyph(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, left: boolean) {
  g.save(); g.translate(cx, cy); if (!left) g.scale(-1, 1);
  g.beginPath();
  g.moveTo(-sz * 0.5, 0); g.lineTo(-sz * 0.05, -sz * 0.4); g.lineTo(-sz * 0.05, -sz * 0.15); g.lineTo(sz * 0.5, -sz * 0.15);
  g.lineTo(sz * 0.5, sz * 0.15); g.lineTo(-sz * 0.05, sz * 0.15); g.lineTo(-sz * 0.05, sz * 0.4); g.closePath(); g.fill();
  g.restore();
}

// ───────────────────────────── containment (surg_hold, cold_panel)

export function containment(s: S4) {
  const { g, W, H, t } = s;
  const [panelRaw = 'suite', stateRaw = 'hold', clockRaw = '', arrowRaw = '<'] = (s.text ?? '').split('|');
  const panel = panelRaw.trim().toLowerCase() === 'store' ? 'store' : 'suite';
  const state = stateRaw.trim().toLowerCase();
  const base = clockOf(clockRaw);
  const counter = base === null ? '--:--:--' : fmtClock(base + t);
  const AMBER = '#ffad2e', AMB_D = 'rgba(255,173,46,0.55)', WHITE = '#fff4e2', GREEN = '#6dffa6';
  const cleared = state === 'cleared';
  const ack = state === 'ack';
  g.fillStyle = cleared ? '#04120a' : '#120a01'; g.fillRect(0, 0, W, H);
  const cx = W / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const glow = (col: string, f: () => void, k = 0.05) => { g.save(); g.shadowColor = col; g.shadowBlur = H * k; f(); g.restore(); };
  if (cleared) {
    g.fillStyle = GREEN; g.fillRect(0, 0, W, H * 0.05);
    glow(GREEN, () => { g.fillStyle = GREEN; fit(g, '홀드 해제됨', 900, H * 0.22, W * 0.86); g.fillText('홀드 해제됨', cx, H * 0.4); });
    g.strokeStyle = GREEN; g.lineWidth = H * 0.035; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - H * 0.09, H * 0.66); g.lineTo(cx - H * 0.02, H * 0.73); g.lineTo(cx + H * 0.11, H * 0.59); g.stroke();
    g.fillStyle = 'rgba(200,255,220,0.7)'; fit(g, '수술실 — 격리 인터록 해제됨', 600, H * 0.055, W * 0.9);
    g.fillText('수술실 — 격리 인터록 해제됨', cx, H * 0.88);
    return;
  }
  // hazard bar (amber / black chevrons), pulsing slowly — the hold is still live
  const hb = H * 0.13;
  const pulse = ack ? 0.85 : 0.7 + 0.3 * Math.abs(Math.sin(t * 2.2));
  g.save();
  g.beginPath(); g.rect(0, 0, W, hb); g.clip();
  g.globalAlpha = pulse; g.fillStyle = AMBER; g.fillRect(0, 0, W, hb);
  g.fillStyle = '#140b00';
  for (let x = -hb; x < W + hb; x += hb * 1.2) { g.beginPath(); g.moveTo(x, hb); g.lineTo(x + hb * 0.6, hb); g.lineTo(x + hb * 1.2, 0); g.lineTo(x + hb * 0.6, 0); g.closePath(); g.fill(); }
  g.restore();
  g.fillStyle = AMBER; g.fillRect(0, H - H * 0.02, W, H * 0.02);
  // title
  const title = ack ? '확인됨 — 문 장애물' : '격리 유지';
  glow(AMBER, () => { g.fillStyle = WHITE; fit(g, title, 900, H * (ack ? 0.11 : 0.16), W * 0.9); g.fillText(title, cx, H * 0.26); });
  if (panel === 'suite') {
    // COLD STORE 2 — DOOR OPEN {counter}
    g.fillStyle = AMBER; fit(g, '냉장고 2 — 문 열림', 800, H * 0.08, W * 0.9);
    g.fillText('냉장고 2 — 문 열림', cx, H * 0.4);
    glow(AMBER, () => { g.fillStyle = WHITE; fit(g, counter, 600, H * 0.14, W * 0.7, MONO); g.fillText(counter, cx, H * 0.54); }, 0.03);
    // the instruction with its arrow (where to go), two lines so it reads from the corridor
    const bh = H * 0.27, by = H * 0.67;
    g.fillStyle = AMBER; g.fillRect(W * 0.03, by, W * 0.94, bh);
    g.fillStyle = '#140b00';
    const left = arrowRaw.trim() !== '>';
    const asz = bh * 0.8;
    const ax = left ? W * 0.03 + asz * 0.62 : W * 0.97 - asz * 0.62;
    arrowGlyph(g, ax, by + bh / 2, asz, left);
    const tx = left ? cx + asz * 0.55 : cx - asz * 0.55, tw = W * 0.94 - asz * 1.4;
    const s1 = fit(g, '현장 확인만 가능', 900, bh * 0.4, tw);
    g.fillText('유선 직결 —', tx, by + bh * 0.3);
    g.font = `900 ${Math.round(s1)}px ${SANS}`;
    g.fillText('현장 확인만 가능', tx, by + bh * 0.72);
    return;
  }
  // store panel (cold_panel): DOOR OPEN / SURGICAL SUITE SEALED / HARD-WIRED … / [ ACKNOWLEDGE ]
  g.fillStyle = AMBER; fit(g, '문 열림', 800, H * 0.075, W * 0.4); g.textAlign = 'right';
  g.fillText('문 열림', cx - W * 0.02, H * 0.42);
  g.textAlign = 'left';
  glow(AMBER, () => { g.fillStyle = WHITE; fit(g, counter, 600, H * 0.12, W * 0.45, MONO); g.fillText(counter, cx + W * 0.01, H * 0.42); }, 0.03);
  g.textAlign = 'center';
  g.fillStyle = ack ? AMB_D : WHITE; fit(g, '수술실 봉쇄됨', 800, H * 0.085, W * 0.9);
  g.fillText(ack ? '수술실 — 홀드 해제됨' : '수술실 봉쇄됨', cx, H * 0.55);
  g.fillStyle = AMBER; fit(g, '유선 직결 — 현장 확인만 가능', 700, H * 0.06, W * 0.9);
  g.fillText('유선 직결 — 현장 확인만 가능', cx, H * 0.665);
  const bx = W * 0.2, bw = W * 0.6, by = H * 0.74, bh = H * 0.16;
  if (ack) {
    const on = Math.floor(t * 2) % 2 === 0;
    g.strokeStyle = AMB_D; g.lineWidth = H * 0.012; g.strokeRect(bx, by, bw, bh);
    g.fillStyle = on ? '#ff6a3a' : '#a8401f'; fit(g, '문 장애물', 900, bh * 0.5, bw * 0.9);
    g.fillText('문 장애물', cx, by + bh * 0.53);
  } else {
    const p = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.6));
    glow(AMBER, () => {
      g.globalAlpha = p; g.strokeStyle = AMBER; g.lineWidth = H * 0.018; g.strokeRect(bx, by, bw, bh);
      g.globalAlpha = 1; g.fillStyle = WHITE; fit(g, '[ 확인 ]', 900, bh * 0.55, bw * 0.9);
      g.fillText('[ 확인 ]', cx, by + bh * 0.53);
    }, 0.04);
  }
}

// ───────────────────────────── video_log (pi_video)

/** Pose vector: [x shift, y shift, scale, head turn (−1 … 1), head down (0 … 1)] (fractions of H). */
type Pose = [number, number, number, number, number];
const POSES: Record<string, Pose> = {
  '': [0, 0, 1, 0, 0.05],
  settle: [0, 0.02, 1, 0, 0.08],
  off: [0, 0, 1, 0.75, 0.05],
  lean: [0, 0.05, 1.16, 0, 0.12],
  down: [0, 0.01, 1, 0.08, 0.6],
};
/** Seconds into the recording at which each line starts (≈ the nominal line lengths + gaps): the timestamp's offset. */
const LINE_AT = [0, 4, 7.5, 13, 16, 24, 28, 34, 44];

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return [0, 1, 2, 3, 4].map((i) => a[i] + (b[i] - a[i]) * k) as Pose;
}

/** Static noise into the screen canvas (the `static` cut), from a small buffer kept in `aux`. */
function noise(s: S4, dim = 0.35) {
  const { g, W, H, rand, t } = s;
  let cv = s.aux.noiseCv as HTMLCanvasElement | undefined;
  if (!cv) { cv = document.createElement('canvas'); cv.width = Math.ceil(W / 2); cv.height = Math.ceil(H / 2); s.aux.noiseCv = cv; }
  const c = cv.getContext('2d')!;
  const img = c.createImageData(cv.width, cv.height); const d = img.data;
  const roll = (t * 37) % img.height;
  for (let y = 0; y < img.height; y++) {
    const band = Math.abs(y - roll) < 4 ? 70 : 0;
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4; const v = (rand() * 200 + band) | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v + 10; d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, W, H); g.imageSmoothingEnabled = true;
  g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(0, 0, W, H);
}

/** The recording's frame: a backlit hooded figure in a desk chair, a mask, no face. */
function videoFrame(s: S4, pose: Pose, talk: number) {
  const { g, W, H, t } = s;
  // room: dark; a cold lamp behind and right of the chair (the backlight that makes the silhouette)
  g.fillStyle = '#07090b'; g.fillRect(0, 0, W, H);
  const lx = W * 0.62, ly = H * 0.3;
  const back = g.createRadialGradient(lx, ly, 0, lx, ly, W * 0.55);
  back.addColorStop(0, 'rgba(176,196,210,0.95)'); back.addColorStop(0.18, 'rgba(110,130,146,0.6)'); back.addColorStop(0.6, 'rgba(30,38,46,0.35)'); back.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = back; g.fillRect(0, 0, W, H);
  // shelves / whiteboard edge in the background, barely there
  g.fillStyle = 'rgba(150,170,185,0.12)'; g.fillRect(W * 0.06, H * 0.12, W * 0.24, H * 0.5);
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(W * 0.06, H * (0.2 + i * 0.12), W * 0.24, 2);
  const [px, py, sc, turn, down] = pose;
  const breath = Math.sin(t * 1.4) * 0.006;
  g.save();
  g.translate(W * 0.5 + px * H, H * (0.98 + py));
  g.scale(sc, sc * (1 + breath));
  const u = H; // figure units: fractions of H, origin at the bottom centre
  // chair back (behind the shoulders)
  g.fillStyle = '#0a0c0e';
  g.beginPath(); g.roundRect(-u * 0.3, -u * 0.86, u * 0.6, u * 0.6, u * 0.06); g.fill();
  // shoulders + suit (backlit: a pale rim on the top edge)
  const sh = new Path2D();
  sh.moveTo(-u * 0.48, 0); sh.bezierCurveTo(-u * 0.46, -u * 0.32, -u * 0.34, -u * 0.44, -u * 0.12, -u * 0.47);
  sh.lineTo(u * 0.12, -u * 0.47); sh.bezierCurveTo(u * 0.34, -u * 0.44, u * 0.46, -u * 0.32, u * 0.48, 0); sh.closePath();
  g.fillStyle = '#121619'; g.fill(sh);
  g.save(); g.clip(sh);
  const rim = g.createLinearGradient(u * 0.4, -u * 0.5, u * 0.1, -u * 0.25);
  rim.addColorStop(0, 'rgba(170,190,205,0.55)'); rim.addColorStop(1, 'rgba(170,190,205,0)');
  g.fillStyle = rim; g.fillRect(-u * 0.5, -u * 0.5, u, u * 0.5);
  // suit folds
  g.strokeStyle = 'rgba(90,105,115,0.1)'; g.lineWidth = u * 0.006;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-u * 0.3 + i * u * 0.14, -u * 0.4); g.quadraticCurveTo(-u * 0.25 + i * u * 0.13, -u * 0.2, -u * 0.32 + i * u * 0.15, 0); g.stroke(); }
  g.restore();
  // head: hood (a soft dome falling to the shoulders), turned and tilted by the pose
  const hx = turn * u * 0.03, hy = -u * 0.66 + down * u * 0.05;
  g.save();
  g.translate(hx, hy);
  const hood = new Path2D();
  hood.moveTo(-u * 0.2, u * 0.2); hood.bezierCurveTo(-u * 0.24, -u * 0.05, -u * 0.18, -u * 0.22, 0, -u * 0.23);
  hood.bezierCurveTo(u * 0.18, -u * 0.22, u * 0.24, -u * 0.05, u * 0.2, u * 0.2); hood.closePath();
  g.fillStyle = '#15191c'; g.fill(hood);
  g.save(); g.clip(hood);
  const hr = g.createLinearGradient(u * 0.22, -u * 0.22, u * 0.02, 0);
  hr.addColorStop(0, 'rgba(185,205,218,0.7)'); hr.addColorStop(1, 'rgba(185,205,218,0)');
  g.fillStyle = hr; g.fillRect(-u * 0.25, -u * 0.25, u * 0.5, u * 0.5);
  g.restore();
  // the hood's opening: deep shadow; inside it only the mask is lit (by the monitor in front of her)
  const ox = turn * u * 0.07, oy = down * u * 0.06;
  const ow = u * 0.115 * (1 - Math.abs(turn) * 0.35), oh = u * 0.15 * (1 - down * 0.3);
  g.fillStyle = '#030405';
  g.beginPath(); g.ellipse(ox, oy, ow, oh, 0, 0, Math.PI * 2); g.fill();
  // mask: pleated surgical mask, cool grey, lit faintly from the front; it moves a little with the voice
  const mw = ow * 0.74, mh = oh * 0.36, my = oy + oh * 0.46 + talk * u * 0.004;
  const mg = g.createLinearGradient(0, my - mh, 0, my + mh);
  mg.addColorStop(0, 'rgba(96,112,122,0.8)'); mg.addColorStop(1, 'rgba(40,48,54,0.8)');
  g.fillStyle = mg;
  g.beginPath(); g.ellipse(ox + turn * ow * 0.25, my, mw, mh, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(30,38,44,0.6)'; g.lineWidth = u * 0.004;
  for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(ox + turn * ow * 0.25 - mw * 0.85, my + k * mh * 0.35); g.lineTo(ox + turn * ow * 0.25 + mw * 0.85, my + k * mh * 0.35); g.stroke(); }
  g.restore();
  g.restore();
}

export function videoLog(s: S4) {
  const { g, W, H, t } = s;
  const parts = (s.text ?? '').split('|');
  const mode = (parts[0] || 'idle').trim().toLowerCase();
  if (mode === 'static') { noise(s); return; }
  const idx = Math.max(1, Math.min(9, Number(parts[1]) || 1));
  const cur = (s.aux.pose as Pose | undefined) ?? POSES[''];
  if (mode === 'play') {
    const dur = Math.max(0.3, Number(parts[2]) || 3);
    const to = POSES[(parts[3] ?? '').trim().toLowerCase()] ?? POSES[''];
    const from = (s.aux.poseFrom as Pose | undefined) ?? cur;
    const k = smooth(0, Math.min(dur * 0.6, 1.8), t);
    const p = lerpPose(from, to, k);
    // a slow drift while she talks, and the mask moving with the voice until the line ends
    p[0] += Math.sin(t * 0.7 + idx) * 0.004;
    const speaking = t < dur ? 1 : 0;
    const talk = speaking * (Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3 + 1) * 0.4) * (0.5 + 0.5 * Math.abs(Math.sin(t * 2.1)));
    s.aux.pose = p;
    videoFrame(s, p, talk);
    // playback chrome: timestamp of the recording, line marker, a progress strip
    const fs = Math.round(H * 0.05);
    g.font = `${fs}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillStyle = 'rgba(220,232,240,0.85)';
    g.fillText('▶ 기록 41 — 순데', W * 0.03, H * 0.03);
    const sec = 6 + LINE_AT[idx - 1] + Math.min(t, dur + 2);
    g.textAlign = 'right';
    g.fillText(`일 23:${String(10 + Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec) % 60).padStart(2, '0')}`, W * 0.97, H * 0.03);
    g.fillStyle = 'rgba(220,232,240,0.25)'; g.fillRect(W * 0.03, H * 0.94, W * 0.94, H * 0.012);
    g.fillStyle = 'rgba(220,232,240,0.8)'; g.fillRect(W * 0.03, H * 0.94, W * 0.94 * ((idx - 1 + Math.min(1, t / dur)) / 9), H * 0.012);
    // tape wobble: a faint bright line rolling
    const ry = (t * 23) % H;
    g.fillStyle = 'rgba(200,220,235,0.05)'; g.fillRect(0, ry, W, H * 0.02);
    return;
  }
  // idle / paused: the first frame, dimmed, with the title card
  s.aux.pose = cur;
  videoFrame(s, cur, 0);
  g.fillStyle = 'rgba(2,4,6,0.62)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = W / 2;
  // play button
  const r = H * 0.14, pulse = 0.75 + 0.25 * Math.sin(t * 2);
  g.strokeStyle = `rgba(225,236,244,${pulse})`; g.lineWidth = H * 0.012;
  g.beginPath(); g.arc(cx, H * 0.42, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = `rgba(225,236,244,${pulse})`;
  g.beginPath(); g.moveTo(cx - r * 0.32, H * 0.42 - r * 0.45); g.lineTo(cx + r * 0.5, H * 0.42); g.lineTo(cx - r * 0.32, H * 0.42 + r * 0.45); g.closePath(); g.fill();
  const title = '순데 — 기록 41 — 일 23:10 — ▶';
  g.fillStyle = '#eef4f8'; fit(g, title, 700, H * 0.085, W * 0.92);
  g.fillText(title, cx, H * 0.72);
  if (mode === 'paused') {
    g.fillStyle = 'rgba(220,232,240,0.75)'; fit(g, `PAUSED — ${idx} / 9`, 600, H * 0.06, W * 0.8, MONO);
    g.fillText(`PAUSED — ${idx} / 9`, cx, H * 0.84);
  }
}

/** Called by ScreenManager.set before a new `text` lands: remember where the figure is, to ease from it. */
export function videoLogBeforeSet(s: S4) {
  if (s.aux.pose) s.aux.poseFrom = (s.aux.pose as Pose).slice() as Pose;
}

// ───────────────────────────── roster (chk wall, 2.4 × 1.2 m)

/** 23 fitted: [rank, name, linked]. The four NO SIGNAL rows are 3c's shielded handful (D10). */
const CREW: [string, string, boolean][] = [
  ['중사', '브레케, H.', true], ['하사', '솔베르그, K.', true], ['수병', '트베이트, J.', true], ['수병', '닐센, O.', true],
  ['수병', '룬드, M.', true], ['선임수병', '리사, T.', false], ['수병', '비크, A.', true], ['수병', '홀테, E.', true],
  ['수병', '미레, S.', true], ['하사', '바케, R.', true], ['수병', '외데고르, P.', false], ['수병', '세테르, L.', true],
  ['선임수병', '피엘드, K.', true], ['수병', '니고르, I.', true], ['수병', 'RØNNING, B.', true], ['중사', '하겐, T.', false],
  ['수병', '스트룀, V.', true], ['수병', '아우네, D.', true], ['수병', '에이데, G.', true], ['수병', '크누센, F.', false],
  ['선임수병', '스코그, J.', true], ['수병', '볼드, H.', true], ['수병', '그란, E.', true],
];

export function roster(s: S4) {
  const { g, W, H, t } = s;
  const RED = '#ff3a2a', GREY = '#7d878d', INK = '#e6edf0', DIM = 'rgba(230,237,240,0.55)', CYAN = '#86e4ff';
  g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
  // header
  const hh = H * 0.085;
  g.fillStyle = 'rgba(230,237,240,0.08)'; g.fillRect(0, 0, W, hh);
  g.fillStyle = 'rgba(230,237,240,0.35)'; g.fillRect(0, hh - 2, W, 2);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  fit(g, '클라스프 링크 명단 — 초소 4 파견대', 700, hh * 0.55, W * 0.7);
  g.fillText('클라스프 링크 명단 — 초소 4 파견대', W * 0.02, hh * 0.52);
  g.textAlign = 'right'; g.fillStyle = DIM; g.font = `500 ${Math.round(hh * 0.4)}px ${MONO}`;
  g.fillText('바이오시스 링크 모니터', W * 0.98, hh * 0.52);
  // the two lines that must read from across the checkpoint
  g.textAlign = 'left';
  const y1 = H * 0.16, y2 = H * 0.27;
  g.fillStyle = INK; fit(g, '장착 23 — 링크 19 활성 · 4 신호 없음', 800, H * 0.075, W * 0.96);
  g.fillText('장착 23 — 링크 19 활성 · 4 신호 없음', W * 0.02, y1);
  const lbl = '제어:';
  const cs = fit(g, lbl, 800, H * 0.075, W * 0.3);
  g.fillStyle = INK; g.fillText(lbl, W * 0.02, y2);
  let x = W * 0.02 + g.measureText(lbl).width + cs * 0.5;
  g.fillStyle = GREY; g.fillText('없음', x, y2);
  const nw = g.measureText('없음').width;
  g.strokeStyle = GREY; g.lineWidth = Math.max(2, cs * 0.09);
  g.beginPath(); g.moveTo(x - cs * 0.1, y2); g.lineTo(x + nw + cs * 0.1, y2); g.stroke();
  x += nw + cs * 0.6;
  g.save(); g.shadowColor = CYAN; g.shadowBlur = cs * 0.35; g.fillStyle = CYAN; g.fillText('노드 2', x, y2); g.restore();
  x += g.measureText('노드 2').width + cs * 0.5;
  g.fillStyle = DIM; g.font = `500 ${Math.round(cs * 0.5)}px ${MONO}`;
  g.fillText('배정 월 08:40', x, y2 + cs * 0.05);
  g.fillStyle = 'rgba(230,237,240,0.18)'; g.fillRect(W * 0.02, H * 0.335, W * 0.96, 2);
  // crew: two columns (12 + 11), a 1 Hz red dot per linked row (staggered), grey for no signal
  const top = H * 0.36, rows = 12, rh = (H * 0.53) / rows;
  const colW = W * 0.47;
  const fs = Math.round(rh * 0.62);
  CREW.forEach(([rank, name, linked], i) => {
    const c = Math.floor(i / rows), r = i % rows;
    const x0 = W * 0.025 + c * (colW + W * 0.03), yc = top + (r + 0.5) * rh;
    if (r % 2 === 0) { g.fillStyle = 'rgba(230,237,240,0.035)'; g.fillRect(x0 - W * 0.01, yc - rh / 2, colW + W * 0.01, rh); }
    const dr = rh * 0.26;
    if (linked) {
      const ph = ((i * 0.618) % 1);
      const on = ((t + ph) % 1) < 0.25;
      g.fillStyle = on ? RED : 'rgba(110,16,10,0.9)';
      if (on) { g.save(); g.shadowColor = RED; g.shadowBlur = dr * 2.5; }
      g.beginPath(); g.arc(x0 + dr, yc, dr, 0, Math.PI * 2); g.fill();
      if (on) g.restore();
    } else {
      g.strokeStyle = GREY; g.lineWidth = Math.max(1.5, dr * 0.3);
      g.beginPath(); g.arc(x0 + dr, yc, dr * 0.85, 0, Math.PI * 2); g.stroke();
    }
    g.textAlign = 'left'; g.font = `600 ${fs}px ${MONO}`;
    g.fillStyle = linked ? INK : GREY;
    g.fillText(`${String(i + 1).padStart(2, '0')}  ${rank.padEnd(3, ' ')} ${name}`, x0 + dr * 3, yc + 1);
    g.textAlign = 'right'; g.font = `600 ${Math.round(fs * 0.85)}px ${MONO}`;
    g.fillStyle = linked ? 'rgba(255,90,70,0.85)' : GREY;
    g.fillText(linked ? '링크 활성' : '신호 없음', x0 + colW - W * 0.005, yc + 1);
  });
  // the commanding officer: not fitted, no dot
  const yk = top + 12 * rh + H * 0.055;
  g.fillStyle = 'rgba(230,237,240,0.18)'; g.fillRect(W * 0.02, yk - H * 0.035, W * 0.96, 2);
  g.textAlign = 'left'; g.fillStyle = INK;
  fit(g, '함장: 중령 M. 케슬러 — 미장착', 700, H * 0.05, W * 0.9, MONO);
  g.fillText('함장: 중령 M. 케슬러 — 미장착', W * 0.025 + rh * 0.78, yk);
}

// ───────────────────────────── theatre_cam (gallery desk monitor, 0.6 × 0.4)

const CUE_LEN: Record<string, number> = { approach: 6, fit: 6, handshake: 2.5, fail: 2.5, remove: 5, regel: 6, return: 5, idle: 7 };

/** The fixed part of the picture (skin, hair, collar, drape) at the canvas size: built once per screen. */
function napeBase(s: S4): HTMLCanvasElement {
  const { W, H } = s;
  let cv = s.aux.napeCv as HTMLCanvasElement | undefined;
  if (cv && cv.width === W && cv.height === H) return cv;
  cv = document.createElement('canvas'); cv.width = W; cv.height = H; s.aux.napeCv = cv;
  const g = cv.getContext('2d')!;
  let seed = 9173;
  const r = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
  // drape (surgical green-grey, dark at the edges)
  const dg = g.createRadialGradient(W * 0.5, H * 0.5, H * 0.2, W * 0.5, H * 0.5, W * 0.7);
  dg.addColorStop(0, '#2e3a37'); dg.addColorStop(1, '#0d1312');
  g.fillStyle = dg; g.fillRect(0, 0, W, H);
  // the neck and upper back, the spine running left → right across the frame
  const body = new Path2D();
  body.moveTo(W * 0.18, H * 0.08); body.bezierCurveTo(W * 0.42, H * 0.16, W * 0.6, H * 0.08, W * 1.05, H * 0.02);
  body.lineTo(W * 1.05, H * 0.98); body.bezierCurveTo(W * 0.6, H * 0.92, W * 0.42, H * 0.84, W * 0.18, H * 0.92); body.closePath();
  const sk = g.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#5b5250'); sk.addColorStop(0.3, '#b3a7a2'); sk.addColorStop(0.5, '#c9bfba'); sk.addColorStop(0.7, '#b0a49f'); sk.addColorStop(1, '#4f4745');
  g.fillStyle = sk; g.fill(body);
  g.save(); g.clip(body);
  // pallor: a cold grey-blue cast, mottled
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rr = (0.03 + r() * 0.08) * W;
    const gg = g.createRadialGradient(x, y, 0, x, y, rr);
    gg.addColorStop(0, `rgba(${r() < 0.5 ? '120,130,145' : '170,150,148'},${0.08 + r() * 0.08})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // spine: soft vertebral bumps along the midline (C7 the most prominent), the groove either side
  const mid = H * 0.5;
  for (let k = 0; k < 6; k++) {
    const x = W * (0.42 + k * 0.1), w = W * (0.03 + (k === 2 ? 0.012 : 0)), h = H * (0.05 + (k === 2 ? 0.015 : 0));
    const vg = g.createRadialGradient(x - w * 0.3, mid - h * 0.4, 0, x, mid, w * 1.4);
    vg.addColorStop(0, 'rgba(235,228,222,0.55)'); vg.addColorStop(0.6, 'rgba(200,190,185,0.15)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.beginPath(); g.ellipse(x, mid, w * 1.4, h * 1.4, 0, 0, Math.PI * 2); g.fill();
  }
  for (const d of [-1, 1]) {
    const gr = g.createLinearGradient(0, mid + d * H * 0.05, 0, mid + d * H * 0.14);
    gr.addColorStop(0, 'rgba(60,50,50,0)'); gr.addColorStop(0.5, 'rgba(60,50,50,0.16)'); gr.addColorStop(1, 'rgba(60,50,50,0)');
    g.fillStyle = gr; g.fillRect(W * 0.3, mid + Math.min(d * H * 0.05, d * H * 0.14), W * 0.75, H * 0.09);
  }
  // skin texture: fine pores
  for (let i = 0; i < W * H * 0.02; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,60,60' : '230,222,216'},${r() * 0.07})`; g.fillRect(r() * W, r() * H, 1, 1); }
  g.restore();
  // suit collar (white spunbond folded down) on the right, over the shoulders
  const col = new Path2D();
  col.moveTo(W * 0.86, 0); col.bezierCurveTo(W * 0.8, H * 0.3, W * 0.8, H * 0.7, W * 0.86, H); col.lineTo(W, H); col.lineTo(W, 0); col.closePath();
  const cg = g.createLinearGradient(W * 0.8, 0, W, 0);
  cg.addColorStop(0, '#d9dee0'); cg.addColorStop(0.4, '#c3c9cc'); cg.addColorStop(1, '#8b9296');
  g.fillStyle = cg; g.fill(col);
  g.save(); g.clip(col);
  g.strokeStyle = 'rgba(80,88,92,0.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { const y = r() * H; g.beginPath(); g.moveTo(W * 0.8, y); g.quadraticCurveTo(W * 0.9, y + (r() - 0.5) * H * 0.2, W, y + (r() - 0.5) * H * 0.1); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(40,44,46,0.5)'; g.lineWidth = 2; g.stroke(col);
  // the back of the head on the left: close-cropped dark hair, a ragged hairline
  const head = new Path2D();
  head.moveTo(-W * 0.05, H * 0.02); head.bezierCurveTo(W * 0.2, H * 0.0, W * 0.3, H * 0.25, W * 0.3, H * 0.5);
  head.bezierCurveTo(W * 0.3, H * 0.75, W * 0.2, H * 1.0, -W * 0.05, H * 0.98); head.closePath();
  const hg = g.createRadialGradient(W * 0.1, H * 0.45, H * 0.05, W * 0.1, H * 0.5, W * 0.3);
  hg.addColorStop(0, '#3a332f'); hg.addColorStop(1, '#141110');
  g.fillStyle = hg; g.fill(head);
  g.save(); g.clip(head);
  for (let i = 0; i < 2600; i++) {
    const x = r() * W * 0.32, y = r() * H, a = Math.PI * (0.05 + 0.15 * (r() - 0.5)) + (y < H / 2 ? -0.3 : 0.3);
    const l = 3 + r() * 6;
    g.strokeStyle = r() < 0.5 ? 'rgba(10,8,7,0.6)' : 'rgba(110,98,90,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.restore();
  // stubble past the hairline
  for (let i = 0; i < 900; i++) {
    const y = r() * H, x = W * 0.29 + Math.pow(r(), 2.2) * W * 0.07 + Math.sin(y * 0.05) * 3;
    g.fillStyle = `rgba(30,24,22,${0.25 + r() * 0.35})`; g.fillRect(x, y, 1.2, 1.2);
  }
  // fitting site: gel residue around two small prong marks at the nape
  const nx = W * 0.47, ny = H * 0.5;
  for (const d of [-1, 1]) {
    g.fillStyle = 'rgba(120,60,62,0.45)'; g.beginPath(); g.arc(nx + d * W * 0.035, ny, W * 0.009, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(25,14,14,0.85)'; g.beginPath(); g.arc(nx + d * W * 0.035, ny, W * 0.0042, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

export function theatreCam(s: S4) {
  const { g, W, H, t } = s;
  const [cueRaw = 'idle', t0Raw = '0', attRaw = ''] = (s.text ?? '').split('|');
  const cue = cueRaw.trim().toLowerCase();
  const ct = (Number(t0Raw) || 0) + t;
  const att = Number(attRaw.replace(/[^0-9]/g, ''));
  const attTxt = Number.isFinite(att) && att > 0 ? att.toLocaleString('en-GB') : '—';
  if (cue === 'off') {
    g.fillStyle = '#030405'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(200,215,220,0.6)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fit(g, '수술실 1 — 예정 시술 없음', 600, H * 0.07, W * 0.8, MONO); g.fillText('수술실 1 — 예정 시술 없음', W / 2, H / 2);
    return;
  }
  g.drawImage(napeBase(s), 0, 0);
  // where the Clasp is: hgt 0 = seated on the nape, 1 = hovering, > 1.6 = out of frame (above the camera)
  let hgt = 3;
  if (cue === 'approach') hgt = 1 + 2.2 * (1 - smooth(0, CUE_LEN.approach, ct));
  else if (cue === 'fit') hgt = 1 - smooth(0, 4, ct);
  else if (cue === 'handshake' || cue === 'fail') hgt = 0;
  else if (cue === 'remove') hgt = smooth(0, 2, ct) + 2.2 * smooth(2, 5, ct);
  // LED: red solid 1.0 s, then three blinks 0.25 on / 0.25 off (§4.4); off otherwise
  let led = 0;
  if (cue === 'handshake') led = ct < 1 ? 1 : ct < 2.5 ? (Math.floor((ct - 1) / 0.25) % 2 === 0 ? 1 : 0) : 0;
  // B3 (D9): seated and powered, not linked — the amber stage (the arm's ring is amber from fit + 3.45 to the handshake)
  const amber = cue === 'fit' && ct >= 3.45;
  const ledCol = amber ? [255, 170, 40] : [255, 50, 30];
  const nx = W * 0.47, ny = H * 0.5;
  // gel on the skin: wet shine, stronger right after a fitting
  const wet = cue === 'regel' || cue === 'return' || cue === 'idle' || cue === 'approach' ? 0.55 : 0.85;
  const sg = g.createRadialGradient(nx - W * 0.01, ny - H * 0.03, 0, nx, ny, W * 0.08);
  sg.addColorStop(0, `rgba(235,240,240,${0.35 * wet})`); sg.addColorStop(0.5, `rgba(200,210,212,${0.12 * wet})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.beginPath(); g.ellipse(nx, ny, W * 0.085, H * 0.11, 0, 0, Math.PI * 2); g.fill();
  if (hgt < 2.6) {
    const sc = 1 + 0.38 * Math.min(hgt, 2.2);
    const cx = nx + hgt * W * 0.03, cy = ny - hgt * H * 0.17;
    const cw = W * 0.3 * sc, chh = W * 0.2 * sc;          // 9 × 6 cm in a ≈ 30 cm wide frame
    // shadow on the skin: offset, soft, fading with height
    g.save();
    g.filter = `blur(${(2 + hgt * 10).toFixed(1)}px)`;
    g.fillStyle = `rgba(10,8,8,${0.5 - Math.min(hgt, 2) * 0.17})`;
    g.beginPath(); g.roundRect(nx - W * 0.15 + hgt * W * 0.07, ny - W * 0.1 + hgt * H * 0.1, W * 0.3, W * 0.2, W * 0.05); g.fill();
    g.restore();
    // the gripper jaws come down from above
    const jaw = (x: number) => {
      const jg = g.createLinearGradient(x - W * 0.02, 0, x + W * 0.02, 0);
      jg.addColorStop(0, '#2a2e31'); jg.addColorStop(0.5, '#8a9196'); jg.addColorStop(1, '#25292c');
      g.fillStyle = jg;
      g.beginPath(); g.moveTo(x - W * 0.018 * sc, -H * 0.05); g.lineTo(x + W * 0.018 * sc, -H * 0.05); g.lineTo(x + W * 0.014 * sc, cy + chh * 0.1); g.lineTo(x - W * 0.014 * sc, cy + chh * 0.1); g.closePath(); g.fill();
    };
    jaw(cx - cw * 0.53); jaw(cx + cw * 0.53);
    // the Clasp: graphite shell, ribbed pad, LED on the top edge
    const shell = g.createLinearGradient(cx, cy - chh / 2, cx, cy + chh / 2);
    shell.addColorStop(0, '#5d6266'); shell.addColorStop(0.35, '#2b2f32'); shell.addColorStop(1, '#141618');
    g.fillStyle = shell;
    g.beginPath(); g.roundRect(cx - cw / 2, cy - chh / 2, cw, chh, chh * 0.32); g.fill();
    g.strokeStyle = 'rgba(160,170,175,0.4)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = Math.max(1.5, cw * 0.012);
    for (let k = -4; k <= 4; k++) { const x = cx + k * cw * 0.085; g.beginPath(); g.moveTo(x, cy - chh * 0.2); g.lineTo(x, cy + chh * 0.32); g.stroke(); }
    g.fillStyle = 'rgba(200,210,215,0.18)'; g.fillRect(cx - cw * 0.4, cy - chh * 0.4, cw * 0.8, chh * 0.06);
    // LED (4 mm): a dark lens, or lit red with its bloom
    const lx = cx, ly = cy - chh * 0.3, lr = Math.max(2.5, cw * 0.022);
    if (led || amber) {
      const [cr, cg, cb] = ledCol;
      g.save(); g.globalCompositeOperation = 'lighter';
      const lg = g.createRadialGradient(lx, ly, 0, lx, ly, lr * 11);
      lg.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`); lg.addColorStop(0.25, `rgba(${cr},${cg},${cb},0.45)`); lg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = lg; g.fillRect(lx - lr * 11, ly - lr * 11, lr * 22, lr * 22);
      g.restore();
      g.fillStyle = amber ? '#fff0c8' : '#ffd8d0'; g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#1c0b0a'; g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(lx - lr * 0.3, ly - lr * 0.3, lr * 0.35, 0, Math.PI * 2); g.fill();
    }
  }
  // camera look: cold grade, grain, vignette
  g.save();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#c8d4d6'; g.fillRect(0, 0, W, H);
  g.restore();
  const r = s.rand;
  for (let i = 0; i < 700; i++) { const v = (r() * 255) | 0; g.fillStyle = `rgba(${v},${v},${v},0.07)`; g.fillRect(r() * W, r() * H, 2, 2); }
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // reticle on the fitting site
  g.strokeStyle = 'rgba(190,235,225,0.55)'; g.lineWidth = 1.5;
  const rr = W * 0.12;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.beginPath(); g.moveTo(nx + sx * rr, ny + sy * rr * 0.6); g.lineTo(nx + sx * rr, ny + sy * rr * 0.85); g.moveTo(nx + sx * rr, ny + sy * rr * 0.85); g.lineTo(nx + sx * rr * 0.75, ny + sy * rr * 0.85); g.stroke();
  }
  // OSD: the readout of §4.4
  const fs = Math.round(H * 0.052);
  g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, fs * 3.9);
  g.fillStyle = '#e4f0ee';
  fit(g, `THEATRE 1 — FITTING 31 — ATTEMPT ${attTxt}`, 700, fs, W * 0.94, MONO);
  g.fillText(`THEATRE 1 — FITTING 31 — ATTEMPT ${attTxt}`, W * 0.03, fs * 0.35);
  g.font = `500 ${fs}px ${MONO}`; g.fillStyle = 'rgba(228,240,238,0.85)';
  g.fillText('호스트: 스트란드, E.', W * 0.03, fs * 1.55);
  g.fillText('맥박: 없음', W * 0.03, fs * 2.7);
  g.textAlign = 'right'; g.fillStyle = 'rgba(228,240,238,0.6)';
  g.fillText('CAM 2 · 후두부', W * 0.97, fs * 1.55);
  // LINK state: the line read from the door — large, with a dot that is the LED's colour
  const link = cue === 'handshake' ? '핸드셰이크' : cue === 'fail' ? '실패' : amber ? '착석 · 링크 없음' : '—';
  const lcol = cue === 'handshake' ? '#ff5a3a' : cue === 'fail' ? '#ff3a2a' : amber ? '#ffb23a' : '#c9d6d4';
  const bh = H * 0.17, by = H * 0.74;
  g.fillStyle = cue === 'fail' ? 'rgba(70,6,4,0.8)' : 'rgba(0,0,0,0.55)'; g.fillRect(0, by, W, bh);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const blink = cue === 'fail' ? Math.floor(t * 2.5) % 2 === 0 : true;
  const ls = fit(g, `LINK: ${link}`, 800, bh * 0.66, W * 0.78);
  g.fillStyle = blink ? lcol : 'rgba(255,58,42,0.45)';
  g.fillText(`LINK: ${link}`, W * 0.03, by + bh * 0.53);
  const dx = W * 0.03 + g.measureText(`LINK: ${link}`).width + ls * 0.7, dr = ls * 0.3;
  if (led || amber) { const c = amber ? '#ffaa28' : '#ff3a2a'; g.save(); g.shadowColor = c; g.shadowBlur = dr * 3; g.fillStyle = c; g.beginPath(); g.arc(dx, by + bh / 2, dr, 0, Math.PI * 2); g.fill(); g.restore(); }
  else { g.strokeStyle = 'rgba(200,214,212,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(dx, by + bh / 2, dr, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(228,240,238,0.75)'; g.textAlign = 'left';
  fit(g, '대기열: 자동 — 오더 0031-H (수율)', 500, H * 0.045, W * 0.94, MONO);
  g.fillText('대기열: 자동 — 오더 0031-H (수율)', W * 0.03, H * 0.955);
}
