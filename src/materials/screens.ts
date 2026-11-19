/**
 * Animated monitor materials. Each screen draws into its own small canvas (CanvasTexture as emissiveMap)
 * at a throttled rate, only while it was actually rendered recently (material.onBeforeRender), with a
 * global cap on redraws per frame. A shared overlay adds pixel grid, scanlines, vignette and glass glare.
 */
import * as THREE from 'three';
import type { LevelInfo, ScreenKind } from '../core/types';
import { containment, videoLog, videoLogBeforeSet, roster, theatreCam } from './screens4';
import { keypad, launch, dockStatus, onpost, NAVY_INK } from './screens5';
import { mimic, manifest, interlock, dockBoard, gauge, feedOsd, size6, TRUNK_KINDS, patchOsd, setOsd } from './screens6';

const MONO = 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';
const SANS = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
/** Stage 3a habitat screens: a friendlier humanist face than the plant's condensed industrial one. */
const HAB = '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

interface Screen {
  mat: THREE.MeshStandardMaterial;
  kind: ScreenKind;
  text: string | undefined;
  cv: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  W: number; H: number;
  aspect: number;
  t: number;
  since: number;
  lastSeen: number;
  drawn: boolean;
  seed: number;
  rand: () => number;
  lines: string[];
  lineTimer: number;
  scroll: number;
  noise: ImageData | null;
  noiseCv: HTMLCanvasElement | null;
  /** `feed`: the supplied live texture (shown as the emissive map instead of the canvas); null = NO SIGNAL card. */
  ext: THREE.Texture | null;
  /** Per-kind scratch state (stage 3b kinds: cached base picture, the video log's pose). */
  aux: Record<string, unknown>;
}

const INTENSITY: Record<ScreenKind, number> = {
  terminal_idle: 2.6, terminal_alert: 3.2, static: 1.8, choir: 3.5, camera_feed: 2.0, vitals: 2.6, door_locked: 3.5, door_open: 3.0, door_cycling: 3.2,
  choice_stop: 2.2, choice_command: 2.2, palm: 3.0,
  // stage 3a §8.5 (habitat screens are calmer than the plant's; the feed matches render/dev/feedtest's monitor)
  pressure: 2.8, habitat_status: 2.4, badge: 2.8, feed: 2.0, cctv: 2.0,
  // stage 3b §8.7 (screens4.ts)
  containment: 2.6, video_log: 2.2, roster: 2.4, theatre_cam: 2.2,
  // stage 3c §8.9 (screens5.ts): navy panels are dark glass with bright type; the ON POST LEDs are the brightest
  keypad: 2.6, launch: 2.4, dock_status: 2.5, onpost: 3.0,
  // stage 3d §8.8 (screens6.ts): the dock board is read across the chamber in the dark fight — a little brighter
  mimic: 2.5, manifest: 2.5, interlock: 2.6, dock_board: 2.8, gauge: 2.6,
};
const RATE: Record<ScreenKind, number> = {
  terminal_idle: 10, terminal_alert: 10, static: 15, choir: 15, camera_feed: 12, vitals: 12, door_locked: 5, door_open: 4, door_cycling: 8,
  choice_stop: 6, choice_command: 6, palm: 24,
  pressure: 4, habitat_status: 4, badge: 8, feed: 12, cctv: 12,
  // the roster's 1 Hz dots are on for 0.25 s: 12 Hz catches every one
  containment: 8, video_log: 12, roster: 12, theatre_cam: 12,
  // stage 3c: the boards flip in over 0.45 s and the counter rolls over 0.4 s (12 Hz shows both); the keypad blinks
  keypad: 8, launch: 8, dock_status: 12, onpost: 12,
  // stage 3d: the mimic's traffic dots 10 Hz, the gauge needle eases at 20 Hz (unchanged frames are not uploaded)
  mimic: 10, manifest: 12, interlock: 8, dock_board: 12, gauge: 20,
};
/**
 * Canvas size of a kind on a quad of `aspect`. The option cards of the core are 12 m wide wall displays that must
 * be read from across the room: on a wide quad they get a 2048 px canvas (everything else 512 / 256).
 */
function sizeFor(kind: ScreenKind, aspect: number): [number, number] {
  const s6 = size6(kind, aspect); if (s6) return s6;   // stage 3d kinds
  // (the roster is a 2.4 m wall board with 23 names: 1024 wide; so are stage 3c's dock boards — 3 m and 4 m wide)
  const base = kind.startsWith('door') || kind === 'badge' ? 256 : kind.startsWith('choice') && aspect >= 2.4 ? 2048 : kind === 'roster' || kind === 'dock_status' ? 1024 : 512;
  return aspect >= 1 ? [base, Math.max(16, Math.round(base / aspect))] : [Math.round(base * aspect), base];
}
const MAX_DRAWS_PER_UPDATE = 4;

function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

const WORDS = {
  sys: ['CHOIR', '할시온', '에리두', '제작-3', '하부-3', '노드', '중계', '의무-3A', '보안-3', '발전-3', '리프트-F2', '암-07', '컨베어-2'],
  verb: ['동기화', '조회', '경로', '재배치', '확인', '할당', '핸드셰이크', '배출', '대기열', '재색인', '수신'],
  stat: ['OK', 'OK', 'OK', '정상', '보류됨', '무응답', '시간 초과', '재시도', '들립니다', '승인됨', '수동 해제'],
};
function logLine(r: () => number): string {
  const p = (a: string[]) => a[Math.floor(r() * a.length)];
  const hex = () => Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const k = r();
  if (k < 0.08) return '> CHOIR: ' + p(['전 직원이 재배치되고 있습니다', '듣고 있습니다', '제자리에 계세요', '수면 연결은 필요 없습니다', '기다려 주셔서 감사합니다']);
  if (k < 0.2) return `[${hex()}] ${p(WORDS.sys)}.${p(WORDS.sys)} :: ${p(WORDS.stat)}`;
  if (k < 0.35) return `  전원 버스 ${Math.floor(r() * 9)}  ${(r() * 480).toFixed(1)}V  ${(r() * 40).toFixed(2)}A  ${p(WORDS.stat)}`;
  if (k < 0.45) return `  수면 업링크 ........ ${p(['반송파 없음', '반송파 없음', '거부됨', '불필요'])}`;
  return `${hex()}:${hex()}  ${p(WORDS.verb)} ${p(WORDS.sys)}-${Math.floor(r() * 99)} ${'.'.repeat(2 + Math.floor(r() * 8))} ${p(WORDS.stat)}`;
}

/** Stage 3c kinds whose clock starts at 0 on creation (they animate from their write: flip, roll, the 1.2 s reject). */
const CLOCKED_3C = new Set<ScreenKind>(['keypad', 'launch', 'dock_status', 'onpost']);

/**
 * Stage 3c navy log: the detachment's own systems; CHOIR appears only as the facility system that requests
 * maintenance (§1 — no navy screen says CHOIR controls anyone).
 */
const NAVY_WORDS = {
  sys: ['초소4', '게이트-4', '스파인', '정박-1', '식당', '무기고', '서브베이', 'TERN', '잠항', '빌지', '펌프-2', '선체-S', '트렁크'],
  verb: ['조회', '동기화', '확인', '기록', '스캔', '사이클', '시험', '질의'],
  stat: ['OK', 'OK', 'OK', '정상', '정상', '기록됨', '무응답', '시간 초과', '재시도'],
};
function navyLogLine(r: () => number): string {
  const p = (a: string[]) => a[Math.floor(r() * a.length)];
  const hex = () => Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const k = r();
  if (k < 0.06) return '> CHOIR: ' + p(['정비 요청 — SDV 턴 발사 전 점검', '정비 요청 — 빌지 펌프 2', '요청 기록됨 — 선체 센서 스캔', '정비 요청 — 갤리 냉장실']);
  if (k < 0.2) return `[${hex()}] ${p(NAVY_WORDS.sys)}.${p(NAVY_WORDS.sys)} :: ${p(NAVY_WORDS.stat)}`;
  if (k < 0.32) return `  선체 변형 F${Math.floor(r() * 40)}  ${(380 + r() * 60).toFixed(0)} µε  ${p(NAVY_WORDS.stat)}`;
  if (k < 0.4) return `  수심 2104 M   해수 ${(1.6 + r() * 0.4).toFixed(1)} °C   선체 ${(r() * 2 + 18).toFixed(1)} °C`;
  if (k < 0.48) return `  수면 업링크 ........ ${p(['반송파 없음', '반송파 없음', '반송파 없음', '시간 초과'])}`;
  return `${hex()}:${hex()}  ${p(NAVY_WORDS.verb)} ${p(NAVY_WORDS.sys)}-${Math.floor(r() * 99)} ${'.'.repeat(2 + Math.floor(r() * 8))} ${p(NAVY_WORDS.stat)}`;
}

/**
 * Stage 3c `[plain]` blocks on the navy level: a line too long to stay legible is wrapped at its ` — ` joints (the
 * §6.4 gate log lines are 50+ characters), continuation lines indented.
 */
function wrapDashes(lines: string[], max = 30): string[] {
  const out: string[] = [];
  for (const ln of lines) {
    if (ln.length <= max || !ln.includes(' — ')) { out.push(ln); continue; }
    const parts = ln.split(' — ');
    let cur = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const next = `${cur} — ${parts[i]}`;
      if (next.length <= max) cur = next;
      else { out.push(cur + ' —'); cur = '  ' + parts[i]; }
    }
    out.push(cur);
  }
  return out;
}

const overlays = new Map<string, HTMLCanvasElement>();
function overlay(W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`;
  let o = overlays.get(key);
  if (o) return o;
  o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // RGB sub-pixel columns + row gaps (multiply)
  const img = g.getImageData(0, 0, W, H); const d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const row = y % 3 === 2 ? 0.55 : 1.0;
    const c = x % 3;
    d[i] = 255 * row * (c === 0 ? 1 : 0.72);
    d[i + 1] = 255 * row * (c === 1 ? 1 : 0.72);
    d[i + 2] = 255 * row * (c === 2 ? 1 : 0.72);
  }
  g.putImageData(img, 0, 0);
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  overlays.set(key, o);
  return o;
}

function glare(g: CanvasRenderingContext2D, W: number, H: number) {
  g.globalCompositeOperation = 'lighter';
  const lg = g.createLinearGradient(0, 0, W * 0.6, H);
  lg.addColorStop(0, 'rgba(255,255,255,0.05)'); lg.addColorStop(0.35, 'rgba(255,255,255,0.015)'); lg.addColorStop(0.36, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

/** Stage 3b: `terminal_idle` / `terminal_alert` text starting with this shows only that text (no log, no footer). */
export const PLAIN = '[plain]';

export class ScreenManager {
  private screens: Screen[] = [];
  private byMat = new WeakMap<THREE.Material, Screen>();
  private frame = 0;
  private cursor = 0;
  private seedCounter = 1;

  /** Level-specific chrome (REVISION 4; §8.1 from `LEVELS`): header / camera labels, terminal_idle shows its `text`. */
  private header: string;
  private camLabel: string;
  private idleText: boolean;
  /**
   * @param navy stage 3c: the navy dock's screen chrome (with its material set, from level `NAVY_FROM`): `terminal_idle`
   *   in navy glass, a log in which CHOIR only ever appears as the facility system that requests maintenance (§1: no
   *   navy screen says CHOIR controls anyone), and long `[plain]` lines wrapped at ` — ` instead of shrunk.
   */
  constructor(private track: (m: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial, level: Pick<LevelInfo, 'screenHeader' | 'camLabel' | 'idleText'>, private navy = false,
    /** stage 3d: the trunk level — screens carry the feed OSD patch (screens6.ts), wide trunk boards are mip-mapped */
    private trunk = false) {
    this.header = level.screenHeader;
    this.camLabel = level.camLabel;
    this.idleText = level.idleText;
  }

  create(kind: ScreenKind, opts?: { text?: string; aspect?: number; texture?: THREE.Texture }): THREE.MeshStandardMaterial {
    const aspect = opts?.aspect ?? (kind.startsWith('door') ? 2 : kind === 'badge' ? 0.75 : 1.6);
    const [W, H] = sizeFor(kind, aspect);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: false })!;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    tex.anisotropy = 4;
    if (W > 1024 && TRUNK_KINDS.has(kind)) { tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8; }
    const mat = new THREE.MeshStandardMaterial({
      name: `screen_${kind}`,
      color: 0x040505, roughness: 0.12, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: INTENSITY[kind],
      // a screen always sits in a bezel / on a panel: it wins the depth test against it (REVISION 5.1)
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    const seed = this.seedCounter++ * 7919;
    const s: Screen = {
      mat, kind, text: opts?.text, cv, g, tex, W, H, aspect,
      // (the stage 3b kinds count from their text: their clock starts at 0)
      t: kind === 'containment' || kind === 'video_log' || kind === 'theatre_cam' || CLOCKED_3C.has(kind) ? 0 : Math.random() * 10, since: 1, lastSeen: -100, drawn: false,
      seed, rand: rng(seed), lines: [], lineTimer: 0, scroll: 0, noise: null, noiseCv: null, ext: null, aux: {},
    };
    mat.onBeforeRender = () => { s.lastSeen = this.frame; };
    if (this.trunk) patchOsd(mat, tex);
    mat.userData.screenKind = kind; mat.userData.screenText = opts?.text ?? ''; // what it shows (tests, debugging)
    this.bindFeed(s, opts?.texture);
    this.prime(s);
    this.draw(s);
    this.screens.push(s);
    this.byMat.set(mat, s);
    return this.track(mat);
  }

  set(mat: THREE.MeshStandardMaterial, kind: ScreenKind, opts?: { text?: string; texture?: THREE.Texture }) {
    const s = this.byMat.get(mat);
    if (!s) { console.warn('[materials] setScreen: not a screen material'); return; }
    // the same card with another number (the unit count changed): redraw, keep its animation clock
    const same = s.kind === kind && kind.startsWith('choice');
    // the video log eases each line's pose from where the figure is now
    if (s.kind === 'video_log' && kind === 'video_log') videoLogBeforeSet(this.s4(s));
    // theatre_cam may be re-written every cue (or every frame): no immediate redraw, the update loop picks it up
    const lazy = s.kind === 'theatre_cam' && kind === 'theatre_cam';
    // stage 3c: the counter rolls from the number it showed (and a board flips from its old text)
    if (s.kind === kind) s.aux.prev = s.text;
    else delete s.aux.key6;   // (stage 3d kinds skip unchanged redraws: another kind drew over the canvas)
    s.kind = kind; s.text = opts?.text;
    mat.userData.screenKind = kind; mat.userData.screenText = opts?.text ?? '';
    if (!same) { s.t = 0; mat.emissiveIntensity = INTENSITY[kind]; }
    // a kind with another canvas size (waveform ↔ option card on the core's side walls): re-allocate
    const [W, H] = sizeFor(kind, s.aspect);
    if (W !== s.W || H !== s.H) {
      s.cv.width = W; s.cv.height = H; s.W = W; s.H = H;
      s.noise = null; s.noiseCv = null;
      // mip-mapped when wall-sized (read at a slant from the door); the GL texture is re-created on the next upload
      const big = W > 1024;
      s.tex.generateMipmaps = big; s.tex.minFilter = big ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; s.tex.anisotropy = big ? 8 : 4;
      s.tex.dispose();
    }
    this.bindFeed(s, opts?.texture);
    this.prime(s);
    if (!lazy) this.draw(s);
  }

  /** The view of a screen the stage 3c kinds draw with. */
  private s5(s: Screen) {
    return { g: s.g, W: s.W, H: s.H, t: s.t, text: s.text, seed: s.seed, rand: s.rand, aux: s.aux, header: this.header };
  }

  /** The view of a screen the stage 3b kinds draw with. */
  private s4(s: Screen) {
    return { g: s.g, W: s.W, H: s.H, t: s.t, text: s.text, seed: s.seed, rand: s.rand, aux: s.aux };
  }

  /**
   * `feed` with a texture: the live image IS the emissive map (the CCTV resolve — exposure, ACES, grain, scanlines,
   * overlay — is done by the feed's own pass, so nothing is drawn over it here). Any other kind, or no texture, uses
   * the screen's canvas again. A `feed` without a texture keeps a texture already bound (re-sending the text only).
   */
  private bindFeed(s: Screen, tex: THREE.Texture | undefined) {
    if (s.kind !== 'feed') s.ext = null;
    else if (tex) s.ext = tex;
    const want = s.ext ?? s.tex;
    if (s.mat.emissiveMap !== want) s.mat.emissiveMap = want;
    s.mat.roughness = s.ext ? 0.2 : 0.12;
  }

  private prime(s: Screen) {
    s.lines.length = 0;
    if (s.kind === 'terminal_idle') for (let i = 0; i < 24; i++) s.lines.push(this.navy ? navyLogLine(s.rand) : logLine(s.rand));
    if (s.kind === 'static' && !s.noise) {
      s.noiseCv = document.createElement('canvas');
      s.noiseCv.width = Math.ceil(s.W / 2); s.noiseCv.height = Math.ceil(s.H / 2);
      s.noise = s.noiseCv.getContext('2d')!.createImageData(s.noiseCv.width, s.noiseCv.height);
    }
  }

  update(dt: number) {
    this.frame++;
    const n = this.screens.length;
    if (!n) return;
    for (let i = 0; i < n; i++) { const s = this.screens[i]; s.t += dt; s.since += dt; }
    let draws = 0;
    for (let k = 0; k < n && draws < MAX_DRAWS_PER_UPDATE; k++) {
      const s = this.screens[(this.cursor + k) % n];
      if (this.frame - s.lastSeen > 3 && s.drawn) continue;
      if (s.since < 1 / RATE[s.kind]) continue;
      if (s.ext && !(this.trunk && s.text)) { s.since = 0; continue; }     // a live feed: the feed pass updates the texture itself (stage 3d: its OSD is drawn)
      this.draw(s);
      draws++;
    }
    this.cursor = (this.cursor + 1) % n;
  }

  private draw(s: Screen) {
    const { g, W, H } = s;
    s.since = 0; s.drawn = true;
    if (this.trunk) setOsd(s.mat, s.kind === 'feed' && !!s.ext && !!s.text);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    switch (s.kind) {
      case 'terminal_idle': this.terminal(s); break;
      case 'terminal_alert': this.alert(s); break;
      case 'static': this.staticNoise(s); break;
      case 'choir': this.choir(s); break;
      case 'camera_feed': this.camera(s); break;
      case 'vitals': this.vitals(s); break;
      case 'door_locked': this.door(s, false); break;
      case 'door_open': this.door(s, true); break;
      case 'door_cycling': this.door(s, 'cycling'); break;
      case 'choice_stop': this.choice(s, true); break;
      case 'choice_command': this.choice(s, false); break;
      case 'palm': this.palm(s); break;
      case 'pressure': this.pressure(s); break;
      case 'habitat_status': this.habitatStatus(s); break;
      case 'badge': this.badge(s); break;
      case 'feed': if (this.trunk && s.ext) { if (!feedOsd(this.s5(s))) return; } else this.noSignal(s); break;
      case 'cctv': this.camera(s); break;    // §8.4 fallback not taken (the live feed was accepted): plain CCTV loop
      case 'containment': containment(this.s4(s)); break;
      case 'video_log': videoLog(this.s4(s)); break;
      case 'roster': roster(this.s4(s)); break;
      case 'theatre_cam': theatreCam(this.s4(s)); break;
      // stage 3c §8.9 (screens5.ts)
      case 'keypad': keypad(this.s5(s)); break;
      case 'launch': launch(this.s5(s)); break;
      case 'dock_status': dockStatus(this.s5(s)); break;
      case 'onpost': onpost(this.s5(s)); break;
      // stage 3d §8.8 (screens6.ts; each returns false when nothing changed: no upload)
      case 'mimic': if (!mimic(this.s5(s))) return; break;
      case 'manifest': if (!manifest(this.s5(s))) return; break;
      case 'interlock': if (!interlock(this.s5(s))) return; break;
      case 'dock_board': if (!dockBoard(this.s5(s))) return; break;
      case 'gauge': if (!gauge(this.s5(s))) return; break;
    }
    g.globalAlpha = 1;
    // (the wall-sized cards are seen from far and at a slant: a sub-pixel grid would only alias into moiré)
    if (W <= 1024) {
      g.globalCompositeOperation = 'multiply';
      g.drawImage(overlay(W, H), 0, 0);
      g.globalCompositeOperation = 'source-over';
    }
    glare(g, W, H);
    s.tex.needsUpdate = true;
  }

  // ───────────────────────────── kinds
  private terminal(s: Screen) {
    const { g, W, H } = s;
    const amber = (s.seed & 1) === 0;
    // (stage 3c: one navy palette — cool white on navy glass)
    const fg = this.navy ? '#bcd6ea' : amber ? '#ffb347' : '#7dff9a';
    const dim = this.navy ? 'rgba(156,186,208,0.5)' : amber ? 'rgba(255,179,71,0.45)' : 'rgba(125,255,154,0.45)';
    const bgc = this.navy ? NAVY_INK.bg : amber ? '#0d0702' : '#020b05';
    g.fillStyle = bgc; g.fillRect(0, 0, W, H);
    const fs = Math.max(9, Math.round(H / 22));
    g.font = `${fs}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left';
    // header
    g.fillStyle = this.navy ? '#16324a' : fg; g.fillRect(0, 0, W, fs * 1.5);
    g.fillStyle = this.navy ? NAVY_INK.text : bgc;
    g.fillText(this.header, fs * 0.5, fs * 0.25);
    // stage 3b (B3/B8): text starting `[plain]` is the whole content — large, no scrolling log, no footer chatter
    if (s.text?.startsWith(PLAIN)) { this.plainBlock(s, s.text.slice(PLAIN.length).replace(/^\n/, ''), fg, fs * 1.8, H - fs * 0.8); return; }
    // advance log
    const step = 0.45;
    while (s.t - s.lineTimer > step) { s.lineTimer += step; s.lines.push(this.navy ? navyLogLine(s.rand) : logLine(s.rand)); if (s.lines.length > 40) s.lines.shift(); }
    const frac = (s.t - s.lineTimer) / step;
    // level 2: a pinned message block (the screen's `text`) above the scrolling log
    let top = fs * 1.8;
    if (this.idleText && s.text) {
      const msg = this.navy ? wrapDashes(s.text.split('\n'), 34) : s.text.split('\n');
      const big =Math.max(fs, Math.min(Math.round(H / (msg.length * 1.6 + 4)), Math.round(fs * 2.4)));
      g.save();
      g.shadowColor = fg; g.shadowBlur = big * 0.5;
      g.fillStyle = '#f2f6ee';
      msg.forEach((ln, i) => {
        let sz = big; g.font = `700 ${sz}px ${MONO}`;
        while (g.measureText(ln).width > W - fs && sz > 8) { sz -= 1; g.font = `700 ${sz}px ${MONO}`; }
        g.fillText(ln, fs * 0.5, top + fs * 0.4 + i * big * 1.25);
      });
      g.restore();
      top += fs * 0.8 + msg.length * big * 1.25;
      g.fillStyle = dim; g.fillRect(fs * 0.5, top - fs * 0.3, W - fs, 1);
      g.font = `${fs}px ${MONO}`;
    }
    const rows = Math.floor((H - top - fs * 1.7) / (fs * 1.18));
    const start = Math.max(0, s.lines.length - rows);
    g.save();
    g.beginPath(); g.rect(0, top, W, H - top - fs * 1.8); g.clip();
    g.shadowColor = fg; g.shadowBlur = fs * 0.6;
    for (let i = start; i < s.lines.length; i++) {
      const y = top + fs * 0.2 + (i - start) * fs * 1.18 - frac * fs * 1.18 * 0.0;
      const ln = s.lines[i];
      g.fillStyle = ln.startsWith('> CHOIR') ? '#e8f4ff' : (i === s.lines.length - 1 ? fg : dim);
      g.fillText(ln, fs * 0.5, y);
    }
    g.restore();
    // footer + cursor
    g.fillStyle = dim; g.fillRect(0, H - fs * 1.6, W, 1);
    g.fillStyle = fg;
    const blink = Math.floor(s.t * 2) % 2 === 0;
    g.fillText(this.navy ? `근무: ---   지상: 무통신   ${blink ? '█' : ' '}` : `운용자: ---   링크: 무통신   ${blink ? '█' : ' '}`, fs * 0.5, H - fs * 1.35);
  }

  /** Stage 3b: a pinned message filling (top … bottom), lines sized to fit, the first line brightest. */
  private plainBlock(s: Screen, text: string, fg: string, top: number, bottom: number) {
    const { g, W } = s;
    const msg = this.navy ? wrapDashes(text.split('\n')) : text.split('\n');
    const avail = bottom - top;
    const big = Math.max(10, Math.min(avail / (msg.length * 1.3 + 0.4), W / 12));
    g.save();
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.shadowColor = fg; g.shadowBlur = big * 0.4;
    msg.forEach((ln, i) => {
      let sz = big; g.font = `700 ${sz}px ${MONO}`;
      while (g.measureText(ln).width > W - big && sz > 8) { sz -= 1; g.font = `700 ${sz}px ${MONO}`; }
      g.fillStyle = i === 0 ? '#f2f6ee' : fg;
      g.fillText(ln, big * 0.5, top + big * 0.4 + i * big * 1.3);
    });
    g.restore();
  }

  private alert(s: Screen) {
    const { g, W, H } = s;
    const plain = !!s.text?.startsWith(PLAIN);
    const on = Math.floor(s.t * 2.2) % 2 === 0;
    g.fillStyle = on ? '#3a0302' : '#120000'; g.fillRect(0, 0, W, H);
    // hazard border
    const b = Math.max(8, H * 0.07);
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.rect(b, b, W - 2 * b, H - 2 * b); g.clip('evenodd');
    g.fillStyle = on ? '#ff2a1a' : '#5a0805'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#100000';
    for (let x = -H; x < W + H; x += b * 2) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + b, H); g.lineTo(x + b + H, 0); g.lineTo(x + H, 0); g.closePath(); g.fill(); }
    g.restore();
    const msg = (plain ? s.text!.slice(PLAIN.length).replace(/^\n/, '') : s.text ?? '경고').toUpperCase();
    const lines = msg.split('\n');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = on ? '#ffd8d0' : '#ff3a28';
    g.shadowColor = '#ff2010'; g.shadowBlur = H * 0.06;
    const fs = Math.min(H * 0.3 / lines.length, H * 0.26);
    lines.forEach((ln, i) => {
      let sz = fs; g.font = `900 ${sz}px ${SANS}`;
      while (g.measureText(ln).width > W - b * 4 && sz > 8) { sz -= 2; g.font = `900 ${sz}px ${SANS}`; }
      g.fillText(ln, W / 2, H * 0.45 + (i - (lines.length - 1) / 2) * fs * 1.1);
    });
    g.shadowBlur = 0;
    if (plain) return;
    g.font = `${Math.round(H * 0.06)}px ${MONO}`; g.fillStyle = '#ff6a50';
    g.fillText(`CHOIR 우선 재정의  ·  코드 ${(s.seed % 900 + 100)}-R`, W / 2, H - b * 2.2);
  }

  private staticNoise(s: Screen) {
    const { g, W, H } = s;
    const img = s.noise!; const d = img.data; const r = s.rand;
    const roll = (s.t * 37) % img.height;
    for (let y = 0; y < img.height; y++) {
      const band = Math.abs(y - roll) < 4 ? 70 : 0;
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const v = (r() * 200 + band) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v + 10; d[i + 3] = 255;
      }
    }
    s.noiseCv!.getContext('2d')!.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(s.noiseCv!, 0, 0, W, H);
    g.imageSmoothingEnabled = true;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
  }

  /** CHOIR's face: dozens of waveform lines pinched into an almond eye, an iris of circular waveforms. */
  private choir(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    g.fillStyle = 'rgba(0,2,4,0.55)'; g.fillRect(0, 0, W, H); // persistence trail
    const cx = W / 2, cy = H / 2;
    const breath = 0.85 + 0.15 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 2.3);
    const eyeW = W * 0.44 * breath, eyeH = H * 0.34 * breath;
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = 1.2;
    const N = 44, M = 110;
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1) * 2 - 1; // -1..1
      const off = Math.sign(v) * Math.pow(Math.abs(v), 0.8);
      const a = 0.18 + 0.5 * (1 - Math.abs(v));
      g.strokeStyle = i % 7 === 3 ? `rgba(235,250,255,${a})` : `rgba(60,220,255,${a * 0.8})`;
      g.beginPath();
      for (let j = 0; j <= M; j++) {
        const u = j / M * 2 - 1; // -1..1 across
        const x = cx + u * W * 0.5;
        const ex = Math.abs(u * W * 0.5) / eyeW;
        // almond envelope: lines open around the eye, pinch together at its corners and beyond
        const env = ex < 1 ? Math.sqrt(1 - ex * ex) : 0;
        const pinch = Math.exp(-Math.pow(Math.max(0, ex - 1) * 2.2, 2));
        const spread = (eyeH * env + H * 0.04 * (1 - pinch) + H * 0.012) * off;
        const amp = (0.25 + 0.75 * (1 - env)) * pinch * H * 0.035 * (0.6 + 0.4 * Math.sin(t * 3 + i));
        const wave = Math.sin(u * 22 + t * 5 + i * 0.7) * 0.6 + Math.sin(u * 61 - t * 9 + i * 1.3) * 0.3 + Math.sin(u * 7 + t * 1.3 + i) * 0.4;
        const y = cy + spread + amp * wave * (1 - Math.abs(off) * 0.4);
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // iris: concentric circular waveforms
    const R = eyeH * 0.62;
    for (let k = 0; k < 9; k++) {
      const rr = R * (0.35 + k * 0.08);
      g.strokeStyle = k === 4 ? 'rgba(240,252,255,0.85)' : `rgba(70,225,255,${0.25 + 0.06 * k})`;
      g.lineWidth = k === 4 ? 1.8 : 1;
      g.beginPath();
      for (let j = 0; j <= 96; j++) {
        const a = j / 96 * Math.PI * 2;
        const w = Math.sin(a * (5 + k) + t * (1.5 + k * 0.4)) * 0.06 + Math.sin(a * 17 - t * 4) * 0.025 * (k % 3);
        const r2 = rr * (1 + w) * (0.92 + 0.08 * Math.sin(t * 1.7 + k));
        const x = cx + Math.cos(a) * r2, y = cy + Math.sin(a) * r2;
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // pupil: dark void with a hot white core that dilates
    const pr = R * (0.22 + 0.06 * Math.sin(t * 0.7));
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(0,0,0,0.85)'; g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'lighter';
    const cg = g.createRadialGradient(cx, cy, 0, cx, cy, pr * 0.9);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(0.15, 'rgba(180,245,255,0.5)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, pr * 0.9, 0, Math.PI * 2); g.fill();
    // glitch rows
    g.globalCompositeOperation = 'source-over';
    if (s.rand() < 0.25) {
      const y = s.rand() * H, h = 2 + s.rand() * 10;
      g.drawImage(s.cv, 0, y, W, h, (s.rand() - 0.5) * 30, y, W, h);
    }
    g.fillStyle = 'rgba(120,230,255,0.6)';
    g.font = `${Math.round(H * 0.045)}px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    if (Math.floor(t * 1.5) % 2 === 0) g.fillText('듣고 있습니다', W * 0.04, H * 0.95);
  }

  private camera(s: Screen) {
    const { g, W, H } = s;
    const t = s.t; const r = s.rand;
    g.fillStyle = '#0b0f0d'; g.fillRect(0, 0, W, H);
    // abstract corridor in perspective
    const vx = W * 0.55 + Math.sin(t * 0.2) * 4, vy = H * 0.45;
    g.strokeStyle = 'rgba(150,180,160,0.5)'; g.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      const f = Math.pow(0.68, k); const w = W * 0.9 * f, h = H * 0.95 * f;
      g.strokeRect(vx - w / 2, vy - h / 2, w, h);
    }
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(vx, vy); g.stroke(); }
    // ceiling lights
    for (let k = 1; k < 6; k++) {
      const f = Math.pow(0.68, k); const ly = vy - H * 0.95 * f / 2 + 3;
      const lit = (Math.floor(t * 3 + k * 7) % 11) !== 0;
      g.fillStyle = lit ? 'rgba(210,235,215,0.8)' : 'rgba(60,70,65,0.6)';
      g.fillRect(vx - W * 0.1 * f, ly, W * 0.2 * f, Math.max(1, 4 * f));
    }
    // floor gradient + a shape that is not supposed to be there
    const fg = g.createLinearGradient(0, vy, 0, H); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(120,150,130,0.25)');
    g.fillStyle = fg; g.fillRect(0, vy, W, H - vy);
    const phase = (t * 0.05) % 1;
    if (phase > 0.55 && phase < 0.75) {
      const f = 0.25 + (phase - 0.55) * 1.5;
      g.fillStyle = 'rgba(5,8,6,0.9)';
      g.beginPath(); g.ellipse(vx - W * 0.05, vy + H * 0.25 * f, W * 0.03 * f * 2, H * 0.2 * f * 2, 0, 0, Math.PI * 2); g.fill();
    }
    // grain
    for (let i = 0; i < 900; i++) { const v = (r() * 255) | 0; g.fillStyle = `rgba(${v},${v},${v},0.12)`; g.fillRect(r() * W, r() * H, 2, 2); }
    // scan roll bar
    const ry = (t * 40) % (H + 60) - 30;
    const rb = g.createLinearGradient(0, ry - 30, 0, ry + 30); rb.addColorStop(0, 'rgba(255,255,255,0)'); rb.addColorStop(0.5, 'rgba(200,230,210,0.08)'); rb.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rb; g.fillRect(0, ry - 30, W, 60);
    // OSD
    const fs = Math.max(10, Math.round(H / 18));
    g.font = `${fs}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = 'rgba(230,240,232,0.9)';
    const sec = Math.floor(t + 11647);
    const hh = String(Math.floor(sec / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(sec / 60) % 60).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
    g.fillText(`CAM ${String((s.seed % 16) + 1).padStart(2, '0')}  ${this.camLabel}`, fs * 0.6, fs * 0.5);
    g.fillText(`2091-03-14  ${hh}:${mm}:${ss}`, fs * 0.6, H - fs * 1.6);
    if (Math.floor(t * 1.4) % 2 === 0) {
      g.fillStyle = '#ff2a20'; g.beginPath(); g.arc(W - fs * 3.6, fs * 1.05, fs * 0.38, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(230,240,232,0.9)'; g.fillText('REC', W - fs * 3.0, fs * 0.5);
    }
    // monochrome tint
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#b8d8c0'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  private vitals(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    g.fillStyle = '#020605'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(40,90,70,0.35)'; g.lineWidth = 1;
    const gs = H / 10;
    for (let x = 0; x < W; x += gs) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += gs) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const traceW = W * 0.68;
    const traces: [string, number, number][] = [['#4dff7a', H * 0.22, 1.0], ['#40d8ff', H * 0.47, 0.5], ['#ffe14d', H * 0.72, 0.3]];
    const sweep = (t * traceW * 0.25) % traceW;
    for (const [col, y0, noiseAmp] of traces) {
      g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 6;
      g.beginPath();
      for (let x = 0; x < traceW; x += 3) {
        if (Math.abs(x - sweep) < 10) { g.stroke(); g.beginPath(); continue; }
        const y = y0 + Math.sin(x * 0.9 + t * 13) * noiseAmp * 0.8 + Math.sin(x * 0.13 + t) * noiseAmp * 0.6;
        if (x === 0 || Math.abs(x - sweep - 12) < 3) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.shadowBlur = 0;
    const fs = Math.round(H * 0.075);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const x0 = traceW + W * 0.03;
    const blink = Math.floor(t * 2) % 2 === 0;
    g.font = `700 ${fs * 0.6}px ${SANS}`; g.fillStyle = '#4dff7a'; g.fillText('심박', x0, H * 0.13);
    g.font = `700 ${fs * 1.5}px ${SANS}`; g.fillText('0', x0, H * 0.24);
    g.font = `700 ${fs * 0.6}px ${SANS}`; g.fillStyle = '#40d8ff'; g.fillText('SpO₂', x0, H * 0.4);
    g.font = `700 ${fs * 1.3}px ${SANS}`; g.fillText('--', x0, H * 0.5);
    g.font = `700 ${fs * 0.6}px ${SANS}`; g.fillStyle = '#ffe14d'; g.fillText('호흡', x0, H * 0.65);
    g.font = `700 ${fs * 1.3}px ${SANS}`; g.fillText('0', x0, H * 0.75);
    if (blink) { g.fillStyle = '#ff2a1a'; g.fillRect(0, H * 0.86, W, H * 0.14); g.fillStyle = '#fff'; } else g.fillStyle = '#ff2a1a';
    g.font = `800 ${fs * 0.85}px ${SANS}`; g.textAlign = 'center';
    g.fillText(s.text ?? '심정지  ·  환자 반응 없음', W / 2, H * 0.93);
    g.font = `${fs * 0.45}px ${MONO}`; g.fillStyle = 'rgba(160,220,190,0.7)'; g.textAlign = 'left';
    g.fillText('의무 3-A  병상 4   레예스, S.   진정 펌프: 비어 있음', W * 0.02, H * 0.04 + fs * 0.3);
  }

  private door(s: Screen, mode: boolean | 'cycling') {
    const { g, W, H } = s;
    const t = s.t;
    const open = mode === true, cyc = mode === 'cycling';
    const pulse = open ? 1 : cyc ? 0.55 + 0.45 * Math.abs(Math.sin(t * 2.6)) : 0.75 + 0.25 * Math.sin(t * 4);
    g.fillStyle = open ? '#011006' : cyc ? '#140b01' : '#140101'; g.fillRect(0, 0, W, H);
    const col = open ? `rgba(60,255,110,${pulse})` : cyc ? `rgba(255,170,30,${pulse})` : `rgba(255,40,24,${pulse})`;
    g.strokeStyle = col; g.lineWidth = Math.max(3, H * 0.05);
    g.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
    // icon
    const ix = H * 0.55, iy = H / 2, sz = H * 0.36;
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = sz * 0.16;
    if (open) {
      g.beginPath(); g.moveTo(ix - sz * 0.5, iy); g.lineTo(ix - sz * 0.1, iy + sz * 0.4); g.lineTo(ix + sz * 0.55, iy - sz * 0.45); g.stroke();
    } else if (cyc) {
      // a turning arc: the interlock is working on it
      const a0 = t * 4;
      g.beginPath(); g.arc(ix, iy, sz * 0.42, a0, a0 + Math.PI * 1.4); g.stroke();
    } else {
      g.fillRect(ix - sz * 0.5, iy - sz * 0.05, sz, sz * 0.75);
      g.beginPath(); g.arc(ix, iy - sz * 0.05, sz * 0.33, Math.PI, 0); g.stroke();
    }
    g.font = `800 ${Math.round(H * 0.34)}px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = col;
    let label = (s.text ?? (open ? '열림' : cyc ? '순환 중' : '잠김')).toUpperCase();
    let sz2 = H * 0.34;
    while (g.measureText(label).width > W - H * 1.1 && sz2 > 8) { sz2 -= 2; g.font = `800 ${Math.round(sz2)}px ${SANS}`; }
    g.fillText(label, H * 0.98, H / 2);
    label = '';
  }
  // ───────────────────────────── REVISION 6: the core's option cards and palm plates

  /**
   * One service unit as a pictogram, feet at (x, y), `h` tall. `up`: awake, head up, lit (filled); otherwise
   * switched off: head on its chest, arms hanging, a dim outline. `dir` = which way it faces (+1 right, −1 left).
   */
  private unit(g: CanvasRenderingContext2D, x: number, y: number, h: number, up: boolean, dir: number, col: string, dim: string) {
    const hw = h * 0.15, legW = h * 0.105;
    g.lineWidth = Math.max(1, h * 0.035);
    g.fillStyle = col; g.strokeStyle = up ? col : dim;
    const part = (px: number, py: number, w: number, hh: number) => { if (up) g.fillRect(px, py, w, hh); else g.strokeRect(px, py, w, hh); };
    // legs, torso, arms
    part(x - hw, y - h * 0.4, legW, h * 0.4); part(x + hw - legW, y - h * 0.4, legW, h * 0.4);
    part(x - hw, y - h * 0.74, hw * 2, h * 0.32);
    const drop = up ? 0 : h * 0.05;
    part(x - hw - legW * 0.95, y - h * 0.73 + drop, legW * 0.7, h * 0.34); part(x + hw + legW * 0.25, y - h * 0.73 + drop, legW * 0.7, h * 0.34);
    // head: up and looking `dir`, or dropped forward onto the chest
    const hr = h * 0.105;
    const hx = up ? x : x + dir * h * 0.07, hy = up ? y - h * 0.88 : y - h * 0.775;
    g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2);
    if (up) {
      g.fill();
      // the visor: a dark slot on the side it faces
      g.fillStyle = 'rgba(0,0,0,0.85)';
      g.fillRect(hx + (dir > 0 ? hr * 0.1 : -hr * 0.95), hy - hr * 0.22, hr * 0.85, hr * 0.44);
    } else g.stroke();
  }

  /**
   * Option card of the core (REVISION 6 / 6.1). `text` = the number of units left on the line.
   * Two layouts: WIDE (the 12 × 3.6 m side walls) — headline block at the card's NORTH end (the end the door sees
   * head-on: right on the west wall = STOP, left on the east wall = COMMAND), pictogram toward the south — and
   * COMPACT (the eye above the pedestal, the pedestal screen), everything stacked.
   */
  private choice(s: Screen, stop: boolean) {
    const { g, W, H } = s;
    const t = s.t;
    const nRaw = parseInt(s.text ?? '32', 10);
    const n = Math.max(0, Math.min(32, Number.isFinite(nRaw) ? nRaw : 32));
    const rgb = stop ? '255,158,44' : '244,247,250';
    const C = (a: number) => `rgba(${rgb},${a})`;
    const bg = stop ? '#0d0702' : '#06070a';
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const wide = W / H >= 2.4;
    const head = stop ? '정지' : '명령';
    const sub = stop ? '노드 5 꺼짐' : '관리자: 레예스, S.';
    const fate = stop ? '그들은 깨어나지 않습니다' : '그들은 깨어 있습니다';
    const count = stop ? `이 라인의 유닛: ${n} → 0` : `명령 대기 유닛: ${n}`;
    const plate = stop ? '황색 플레이트' : '백색 플레이트';
    // The pictogram's clock: the units go dark one after another (STOP) / a glance runs down the row (COMMAND).
    const P = 8, ph = (t % P) / P;
    const litCount = !stop ? n : ph < 0.14 ? n : ph < 0.68 ? Math.round(n * (1 - (ph - 0.14) / 0.54)) : 0;
    const fit = (txt: string, weight: number, size: number, maxW: number) => {
      let sz = size; g.font = `${weight} ${Math.round(sz)}px ${SANS}`;
      while (g.measureText(txt).width > maxW && sz > 8) { sz -= Math.max(1, sz * 0.03); g.font = `${weight} ${Math.round(sz)}px ${SANS}`; }
      return sz;
    };
    /** n units in rows inside a box; `toward` = the side (+1 right / −1 left) the awake ones look to. */
    const rows = (x0: number, y0: number, w: number, h: number, toward: number) => {
      const perRow = n > 16 ? 16 : Math.max(1, n), nRows = n > 16 ? 2 : 1;
      const cell = w / (n > 16 ? 16 : Math.max(8, perRow));
      const fh = Math.min(h / nRows * 0.88, cell * 2.5);
      const rowW = cell * perRow;
      for (let i = 0; i < n; i++) {
        // column 0 stands next to the node / the supervisor (the side they face); a short row closes up to it.
        // STOP: the ones furthest away go dark first. COMMAND: a glance runs out from the supervisor.
        const r = Math.floor(i / perRow), c = i % perRow;
        const k = toward > 0 ? perRow - 1 - c : c;
        const x = x0 + (w - rowW) / 2 + (k + 0.5) * cell;
        const y = y0 + (h / nRows) * (r + 1) - (h / nRows - fh) * 0.5;
        const idx = r * perRow + c;
        const up = stop ? idx < litCount : true;
        let a = 1;
        if (!stop) { const wave = ((ph * 2.2 - c / perRow * 0.7 - r * 0.08) % 1 + 1) % 1; a = 0.72 + 0.28 * Math.max(0, 1 - Math.abs(wave - 0.1) * 6); }
        this.unit(g, x, y, fh, up, toward, C(a), C(0.34));
      }
    };
    /** The thing the row answers to: NODE 5 (a box that goes dark) / one larger outlined person. */
    const anchor = (cx: number, y0: number, h: number) => {
      g.lineWidth = Math.max(2, h * 0.022);
      if (stop) {
        const on = litCount > 0;
        const bw = h * 0.62, bh = h * 0.62, bx = cx - bw / 2, by = y0 + h * 0.1;
        g.strokeStyle = C(on ? 1 : 0.4); g.strokeRect(bx, by, bw, bh);
        if (on) { g.fillStyle = C(0.16); g.fillRect(bx, by, bw, bh); }
        // power symbol
        const r = bh * 0.24, py = by + bh * 0.56;
        g.beginPath(); g.arc(cx, py, r, -Math.PI * 0.32, Math.PI * 1.32); g.stroke();
        g.beginPath(); g.moveTo(cx, py - r * 1.35); g.lineTo(cx, py - r * 0.2); g.stroke();
        g.fillStyle = C(on ? 1 : 0.5); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `800 ${Math.round(h * 0.13)}px ${SANS}`;
        g.fillText('노드 5', cx, by + bh + h * 0.13);
      } else {
        // a person, outlined, taller than the units: head, shoulders, body — and a raised open hand
        const ph2 = h * 0.86, fy = y0 + h * 0.94, hw = ph2 * 0.17;
        g.strokeStyle = C(1);
        g.beginPath(); g.arc(cx, fy - ph2 * 0.88, ph2 * 0.11, 0, Math.PI * 2); g.stroke();
        g.strokeRect(cx - hw, fy - ph2 * 0.74, hw * 2, ph2 * 0.34);
        g.strokeRect(cx - hw, fy - ph2 * 0.4, hw * 0.8, ph2 * 0.4); g.strokeRect(cx + hw * 0.2, fy - ph2 * 0.4, hw * 0.8, ph2 * 0.4);
        g.fillStyle = C(1); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `800 ${Math.round(h * 0.1)}px ${SANS}`;
        g.fillText('당신', cx, fy - ph2 * 0.57);
      }
    };
    g.textBaseline = 'middle';
    if (wide) {
      const m = H * 0.06;
      g.strokeStyle = C(0.85); g.lineWidth = Math.max(3, H * 0.012);
      g.strokeRect(m * 0.5, m * 0.5, W - m, H - m);
      // north-origin spans → canvas x (the west wall's north end is on the right of its screen)
      // (seen from inside the room, north is on the LEFT of the west wall's screen and on the RIGHT of the east wall's)
      const span = (u0: number, u1: number): [number, number] => (stop ? [u0 * W, u1 * W] : [(1 - u1) * W, (1 - u0) * W]);
      // pictogram at the north end, the words from the centre on: what the door sees without turning (z < −78.7)
      const [px0, px1] = span(0.03, 0.385);
      const [hx0, hx1] = span(0.42, 0.965);
      const hw = hx1 - hx0;
      // divider
      const dx = stop ? hx0 - W * 0.0175 : hx1 + W * 0.0175;
      g.fillStyle = C(0.5); g.fillRect(dx - 1.5, m * 1.6, 3, H - m * 3.2);
      // headline block
      g.textAlign = 'left';
      g.fillStyle = C(1); g.fillRect(hx0, H * 0.085, H * 0.07, H * 0.07);
      g.font = `700 ${Math.round(H * 0.075)}px ${SANS}`; g.fillStyle = C(0.9);
      g.fillText(plate, hx0 + H * 0.1, H * 0.123);
      // both cards use the size at which COMMAND fits: the two words weigh the same
      const hs = fit('명령', 900, H * 0.42, hw * 0.98);
      g.font = `900 ${Math.round(hs)}px ${SANS}`;
      g.save(); g.shadowColor = C(0.9); g.shadowBlur = H * 0.05; g.fillStyle = C(1);
      g.fillText(head, hx0 - hs * 0.03, H * 0.385);
      g.restore();
      fit(sub, 700, H * 0.105, hw * 0.98); g.fillStyle = C(0.92);
      g.fillText(sub, hx0, H * 0.635);
      // the consequence, inverted: the line that must be read
      const fs = fit(fate, 900, H * 0.115, hw * 0.9);
      const fw = g.measureText(fate).width;
      g.fillStyle = C(1); g.fillRect(hx0, H * 0.745, fw + fs * 0.7, H * 0.165);
      g.fillStyle = bg; g.fillText(fate, hx0 + fs * 0.35, H * 0.832);
      // pictogram block: the anchor on the headline's side, the row beyond it
      const pw = px1 - px0, aw = pw * 0.2;
      const ax = stop ? px1 - aw / 2 : px0 + aw / 2;
      anchor(ax, H * 0.09, H * 0.6);
      rows(stop ? px0 : px0 + aw + pw * 0.02, H * 0.1, pw - aw - pw * 0.02, H * 0.58, stop ? 1 : -1);
      fit(count, 800, H * 0.115, pw * 0.98); g.fillStyle = C(1); g.textAlign = 'left';
      g.fillText(count, px0, H * 0.832);
    } else {
      const m = H * 0.05;
      g.strokeStyle = C(0.85); g.lineWidth = Math.max(2, H * 0.014);
      g.strokeRect(m * 0.5, m * 0.5, W - m, H - m);
      g.textAlign = 'center';
      const hs = fit('명령', 900, H * 0.3, W * 0.8);
      g.font = `900 ${Math.round(hs)}px ${SANS}`;
      g.save(); g.shadowColor = C(0.9); g.shadowBlur = H * 0.05; g.fillStyle = C(1);
      g.fillText(head, W / 2, H * 0.2);
      g.restore();
      fit(sub, 700, H * 0.085, W * 0.86); g.fillStyle = C(0.92);
      g.fillText(sub, W / 2, H * 0.385);
      rows(W * 0.07, H * 0.45, W * 0.86, H * 0.3, stop ? 1 : -1);
      fit(count, 800, H * 0.08, W * 0.88); g.fillStyle = C(1);
      g.fillText(count, W / 2, H * 0.825);
      const fs = fit(fate, 900, H * 0.08, W * 0.8);
      const fw = g.measureText(fate).width;
      g.fillStyle = C(1); g.fillRect(W / 2 - fw / 2 - fs * 0.4, H * 0.875, fw + fs * 0.8, H * 0.095);
      g.fillStyle = bg; g.fillText(fate, W / 2, H * 0.925);
    }
  }

  /**
   * Palm plate (REVISION 6). `text` = "<amber|white>|<state>|<LABEL>|<scan seconds>"; state: off, standby (not
   * yet armed), idle (armed: outline of a left hand, a slow scan line), scan (a bar fills over the scan time),
   * done (REYES, S. — LIVING — ROSTERED), fail (SCAN INCOMPLETE). The top of the canvas is the far edge of the
   * plate, so the fingers of the outline point away from whoever stands in front of it.
   * Stage 3c: a LABEL `<TITLE> — <status>` splits at its first ` — ` — the title on top, the rest in place of the
   * state's status line (`white|done|AAS, L. (LT.) — PALM — LIVE — 21:52`: someone else's palm was read;
   * `white|fail|NOT ROSTERED — REYES, S.`). A label too wide for the plate shrinks to fit.
   */
  private palm(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    const [colour = 'amber', state = 'idle', label = '', secs = '1.6'] = (s.text ?? '').split('|');
    const cut = label.indexOf(' — ');
    const title = cut < 0 ? label : label.slice(0, cut), sub = cut < 0 ? '' : label.slice(cut + 3);
    const rgb = colour === 'amber' ? '255,158,44' : '244,247,250';
    const C = (a: number) => `rgba(${rgb},${a})`;
    const bg = colour === 'amber' ? '#0b0602' : '#05060a';
    g.fillStyle = state === 'off' ? '#010101' : bg; g.fillRect(0, 0, W, H);
    if (state === 'off') return;
    const live = state !== 'standby';
    const blink = Math.floor(t * 3) % 2 === 0;
    const edge = state === 'standby' ? 0.3 : state === 'fail' ? (blink ? 1 : 0.35) : state === 'idle' ? 0.75 + 0.2 * Math.sin(t * 2.2) : 1;
    g.strokeStyle = C(edge); g.lineWidth = H * 0.018;
    g.strokeRect(H * 0.03, H * 0.03, W - H * 0.06, H - H * 0.06);
    // the hand (left, palm down, seen from above: thumb on the right). Units: plate height = 0.32 m.
    const u = H / 0.42, cx = W * 0.5, wy = H * 0.86;
    const shape = (grow: number) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      const fingers: [number, number, number, number][] = [[0.031, 0.163, 0.020, 0.06], [0.010, 0.178, 0.021, 0.02], [-0.011, 0.170, 0.020, -0.03], [-0.031, 0.146, 0.018, -0.09]];
      for (const [fx, len, w, lean] of fingers) {
        g.lineWidth = w * u + grow;
        g.beginPath(); g.moveTo(cx + fx * u, wy - 0.07 * u); g.lineTo(cx + (fx + lean * 0.35) * u, wy - len * u); g.stroke();
      }
      // thumb
      g.lineWidth = 0.023 * u + grow;
      g.beginPath(); g.moveTo(cx + 0.03 * u, wy - 0.035 * u); g.lineTo(cx + 0.079 * u, wy - 0.088 * u); g.stroke();
      // palm
      g.lineWidth = 0.03 * u + grow;
      g.beginPath(); g.moveTo(cx - 0.027 * u, wy - 0.02 * u); g.lineTo(cx + 0.027 * u, wy - 0.02 * u); g.lineTo(cx + 0.027 * u, wy - 0.085 * u); g.lineTo(cx - 0.027 * u, wy - 0.085 * u); g.closePath(); g.stroke(); g.fill();
    };
    const handA = state === 'standby' ? 0.3 : state === 'fail' ? (blink ? 0.9 : 0.3) : state === 'idle' ? 0.8 : 1;
    g.save(); g.shadowColor = C(0.9); g.shadowBlur = live ? H * 0.05 : 0;
    g.strokeStyle = C(handA); g.fillStyle = C(handA); shape(H * 0.034);
    g.restore();
    // an opaque inner pass over the bright outer one leaves an outline; reading / read: the inside fills
    const fillA = state === 'done' ? 0.5 : state === 'scan' ? 0.16 : 0;
    g.strokeStyle = bg; g.fillStyle = bg; shape(0);
    if (fillA > 0) { g.strokeStyle = C(fillA); g.fillStyle = C(fillA); shape(-1); }
    // scan line across the hand
    if (state === 'idle' || state === 'scan') {
      const k = state === 'scan' ? (t * 1.9) % 1 : 0.5 + 0.5 * Math.sin(t * 1.3);
      const y = H * 0.36 + k * H * 0.5;
      const lg = g.createLinearGradient(0, y - H * 0.05, 0, y + H * 0.05);
      lg.addColorStop(0, C(0)); lg.addColorStop(0.5, C(state === 'scan' ? 0.95 : 0.55)); lg.addColorStop(1, C(0));
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg; g.fillRect(W * 0.12, y - H * 0.05, W * 0.76, H * 0.1);
      g.globalCompositeOperation = 'source-over';
    }
    // the far edge of the plate stays in sight above the fingers: which option this is, and the status line
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = C(live ? 1 : 0.4);
    this.fit(g, title, 900, H * 0.125, W - H * 0.16, SANS);
    g.fillText(title, cx, H * 0.125);
    g.font = `800 ${Math.round(H * 0.06)}px ${SANS}`;
    const line = (txt: string, a = 1) => { g.fillStyle = C(a); g.fillText(txt, cx, H * 0.25); };
    if (state === 'standby') line('대기', 0.45);
    else if (state === 'idle') line('손바닥을 대세요', 0.6 + 0.4 * Math.abs(Math.sin(t * 1.6)));
    else if (state === 'fail') { if (sub) this.fit(g, sub, 800, H * 0.075, W - H * 0.2, SANS); line(sub || 'SCAN INCOMPLETE', blink ? 1 : 0.4); }
    else if (state === 'done') {
      // (stage 3c: someone else's read-out is seen through booth glass at ≥ 1.8 m — a taller bar, bigger type)
      g.fillStyle = C(1);
      if (sub) g.fillRect(H * 0.05, H * 0.19, W - H * 0.1, H * 0.15); else g.fillRect(H * 0.07, H * 0.2, W - H * 0.14, H * 0.1);
      g.fillStyle = bg;
      const read = sub || '레예스, S. — 생존 — 근무 편성';
      if (sub) this.fit(g, read, 900, H * 0.11, W - H * 0.16, SANS); else g.font = `900 ${Math.round(H * 0.054)}px ${SANS}`;
      g.fillText(read, cx, sub ? H * 0.268 : H * 0.252);
    } else if (state === 'scan') {
      const dur = Math.max(0.2, Number(secs) || 1.6), k = Math.min(1, t / dur);
      g.strokeStyle = C(1); g.lineWidth = H * 0.008;
      g.strokeRect(W * 0.12, H * 0.215, W * 0.76, H * 0.07);
      g.fillStyle = C(1); g.fillRect(W * 0.12, H * 0.215, W * 0.76 * k, H * 0.07);
    }
  }

  // ───────────────────────────── stage 3a (§8.5, §6.5): habitat screens

  /** Set `g.font` to the largest size ≤ `size` at which `txt` fits `maxW`; returns the size. */
  private fit(g: CanvasRenderingContext2D, txt: string, weight: number, size: number, maxW: number, family = HAB) {
    let sz = Math.max(6, size);
    g.font = `${weight} ${Math.round(sz)}px ${family}`;
    while (g.measureText(txt).width > maxW && sz > 6) { sz -= Math.max(1, sz * 0.04); g.font = `${weight} ${Math.round(sz)}px ${family}`; }
    return sz;
  }

  private lockIcon(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, col: string, open = false) {
    g.save();
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = sz * 0.13; g.lineCap = 'round';
    g.fillRect(cx - sz * 0.42, cy - sz * 0.05, sz * 0.84, sz * 0.62);
    g.beginPath();
    if (open) g.arc(cx + sz * 0.42, cy - sz * 0.05, sz * 0.28, Math.PI, Math.PI * 1.95);
    else g.arc(cx, cy - sz * 0.05, sz * 0.28, Math.PI, 0);
    g.stroke();
    g.restore();
  }

  /**
   * Pressure-door panel (§6.5): `text` = `TEST|hh:mm:ss` (the story writes the countdown once per second),
   * `등압 중`, `RELEASED|CHOIR`, `열림`, `구역 봉쇄됨`, `CLEAR THE DOOR`; anything else is shown as a notice.
   */
  private pressure(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    const [rawState = '시험', arg = ''] = (s.text ?? '시험|10:00:00').split('|');
    const state = rawState.trim().toUpperCase();
    const blink = Math.floor(t * 2) % 2 === 0;
    const AMBER = '#ffb347', CYAN = '#79dcff', GREEN = '#6dffa6', RED = '#ff4a36', WHITE = '#f4f1e8';
    const accent = state === '시험' ? AMBER : state === '등압 중' ? CYAN : state === '해제됨' || state === '열림' ? GREEN
      : state === '구역 봉쇄됨' ? RED : AMBER;
    const sealed = state === '구역 봉쇄됨';
    g.fillStyle = sealed ? (blink ? '#2a0605' : '#160303') : '#081219'; g.fillRect(0, 0, W, H);
    // header strip
    const hh = H * 0.13;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, W, hh);
    g.fillStyle = accent; g.fillRect(0, hh - 2, W, 2);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = 'rgba(244,241,232,0.75)';
    this.fit(g, '압력문 P-1  ·  주거 링 A', 600, hh * 0.46, W * 0.72);
    g.fillText('압력문 P-1  ·  주거 링 A', W * 0.035, hh * 0.52);
    g.textAlign = 'right'; g.fillStyle = accent;
    g.font = `700 ${Math.round(hh * 0.42)}px ${HAB}`;
    g.fillText(state === '시험' ? '시험' : state === '열림' || state === '해제됨' ? '지우기' : state === '등압 중' ? '사이클' : '경보', W * 0.965, hh * 0.52);
    const cx = W / 2;
    const glow = (col: string, f: () => void) => { g.save(); g.shadowColor = col; g.shadowBlur = H * 0.05; f(); g.restore(); };
    g.textAlign = 'center';
    if (state === '시험') {
      g.fillStyle = AMBER;
      this.fit(g, '압력 기밀 시험', 700, H * 0.085, W * 0.86);
      g.fillText('압력 기밀 시험', cx, H * 0.24);
      // the countdown
      const clock = (arg || '10:00:00').trim();
      const ds = this.fit(g, clock, 600, H * 0.3, W * 0.66, MONO);
      this.lockIcon(g, W * 0.1, H * 0.46, H * 0.13, AMBER);
      glow(AMBER, () => { g.fillStyle = WHITE; g.fillText(clock, cx + W * 0.04, H * 0.47); });
      g.fillStyle = 'rgba(244,241,232,0.6)'; g.font = `600 ${Math.round(H * 0.055)}px ${HAB}`;
      g.fillText('잔여', cx + W * 0.04, H * 0.47 + ds * 0.62);
      // 72 h bar with six-hour marks; filled = elapsed
      const m = /(\d+):(\d+):(\d+)/.exec(clock);
      const left = m ? Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600 : 10;
      const k = Math.max(0, Math.min(1, 1 - left / 72));
      const bx = W * 0.08, bw = W * 0.84, by = H * 0.74, bh = H * 0.05;
      g.strokeStyle = 'rgba(255,179,71,0.6)'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
      g.fillStyle = 'rgba(255,179,71,0.75)'; g.fillRect(bx + 2, by + 2, (bw - 4) * k, bh - 4);
      g.fillStyle = 'rgba(8,18,25,0.9)';
      for (let i = 1; i < 12; i++) g.fillRect(bx + bw * i / 12 - 1, by + 2, 2, bh - 4);
      g.fillStyle = 'rgba(244,241,232,0.55)'; g.font = `500 ${Math.round(H * 0.045)}px ${HAB}`;
      g.textAlign = 'left'; g.fillText('심박 0', bx, by + bh + H * 0.045);
      g.textAlign = 'right'; g.fillText('심박 72', bx + bw, by + bh + H * 0.045);
      g.textAlign = 'center'; g.fillStyle = 'rgba(244,241,232,0.7)';
      this.fit(g, '시험이 끝날 때까지 문 밀봉', 600, H * 0.05, W * 0.6);
      g.fillText('시험이 끝날 때까지 문 밀봉', cx, H * 0.93);
    } else if (state === '등압 중') {
      const dp = Math.max(0, 4.2 * Math.exp(-t / 2.5) - 0.01);
      glow(CYAN, () => { g.fillStyle = CYAN; this.fit(g, '등압 중', 800, H * 0.2, W * 0.86); g.fillText('등압 중', cx, H * 0.33); });
      // two columns converging: lock side and habitat side
      const bw = W * 0.12, base = H * 0.86, full = H * 0.36;
      const a = full * (0.55 + 0.45 * Math.min(1, dp / 4.2)), b = full * 0.55;
      g.fillStyle = 'rgba(121,220,255,0.18)'; g.fillRect(W * 0.2, base - full, bw, full); g.fillRect(W * 0.68, base - full, bw, full);
      g.fillStyle = CYAN; g.fillRect(W * 0.2, base - a, bw, a); g.fillRect(W * 0.68, base - b, bw, b);
      g.fillStyle = 'rgba(244,241,232,0.7)'; g.font = `600 ${Math.round(H * 0.045)}px ${HAB}`;
      g.fillText('잠금', W * 0.2 + bw / 2, base + H * 0.05); g.fillText('주거구역', W * 0.68 + bw / 2, base + H * 0.05);
      g.fillStyle = WHITE; g.font = `600 ${Math.round(H * 0.11)}px ${MONO}`;
      g.fillText(`Δp ${dp.toFixed(2)}`, cx, H * 0.62);
      g.font = `600 ${Math.round(H * 0.05)}px ${HAB}`; g.fillStyle = 'rgba(244,241,232,0.7)';
      g.fillText('kPa', cx, H * 0.72);
      const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
      g.fillText(`물러나세요${dots}`, cx, H * 0.82);
    } else if (state === '해제됨') {
      glow(GREEN, () => { g.fillStyle = GREEN; this.fit(g, '해제됨', 800, H * 0.24, W * 0.86); g.fillText('해제됨', cx, H * 0.38); });
      g.fillStyle = WHITE;
      const who = (arg || 'CHOIR').toUpperCase();
      this.fit(g, `인가됨: ${who}`, 700, H * 0.1, W * 0.86);
      g.fillText(`인가됨: ${who}`, cx, H * 0.6);
      g.fillStyle = 'rgba(244,241,232,0.65)'; this.fit(g, '시험 중단  ·  문 원격 제어 중', 600, H * 0.055, W * 0.86);
      g.fillText('시험 중단  ·  문 원격 제어 중', cx, H * 0.76);
      this.lockIcon(g, cx, H * 0.88, H * 0.08, GREEN, true);
    } else if (state === '열림') {
      glow(GREEN, () => { g.fillStyle = GREEN; this.fit(g, '열림', 800, H * 0.32, W * 0.6); g.fillText('열림', cx, H * 0.45); });
      const k = (t * 0.8) % 1;
      g.strokeStyle = GREEN; g.lineWidth = H * 0.03; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = cx + dir * (W * 0.27 + i * W * 0.045), y = H * 0.45, a = 0.25 + 0.75 * ((i / 3 + k) % 1);
        g.globalAlpha = a;
        g.beginPath(); g.moveTo(x - dir * H * 0.05, y - H * 0.08); g.lineTo(x + dir * H * 0.03, y); g.lineTo(x - dir * H * 0.05, y + H * 0.08); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(244,241,232,0.75)'; this.fit(g, '압력 동일  ·  발밑 주의', 600, H * 0.065, W * 0.86);
      g.fillText('압력 동일  ·  발밑 주의', cx, H * 0.74);
    } else if (sealed) {
      glow(RED, () => {
        g.fillStyle = blink ? '#ffd8d0' : RED;
        this.fit(g, '구역 봉쇄됨', 900, H * 0.2, W * 0.9); g.fillText('구역 봉쇄됨', cx, H * 0.42);
      });
      this.lockIcon(g, cx, H * 0.66, H * 0.13, RED);
      g.fillStyle = RED; this.fit(g, '압력 경보  ·  문 잠김', 700, H * 0.07, W * 0.86);
      g.fillText('압력 경보  ·  문 잠김', cx, H * 0.87);
    } else {
      // CLEAR THE DOOR (or any notice): amber chevron frame, flashing
      const on = Math.floor(t * 3) % 2 === 0;
      const b = H * 0.08;
      g.save();
      g.beginPath(); g.rect(0, hh, W, H - hh); g.rect(b, hh + b, W - 2 * b, H - hh - 2 * b); g.clip('evenodd');
      g.fillStyle = on ? AMBER : '#5a3a10'; g.fillRect(0, hh, W, H - hh);
      g.fillStyle = '#100800';
      for (let x = -H; x < W + H; x += b * 2) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + b, H); g.lineTo(x + b + H, hh); g.lineTo(x + H, hh); g.closePath(); g.fill(); }
      g.restore();
      const msg = rawState.toUpperCase();
      glow(AMBER, () => {
        g.fillStyle = on ? '#fff0d8' : AMBER;
        const lines = msg.split('\n');
        const fs = this.fit(g, lines.reduce((a, l) => (l.length > a.length ? l : a), ''), 900, H * 0.2 / Math.max(1, lines.length * 0.7), W - b * 4);
        lines.forEach((ln, i) => g.fillText(ln, cx, H * 0.56 + (i - (lines.length - 1) / 2) * fs * 1.1));
      });
      if (arg) { g.fillStyle = WHITE; this.fit(g, arg.toUpperCase(), 600, H * 0.06, W - b * 4); g.fillText(arg.toUpperCase(), cx, H * 0.8); }
    }
  }

  /**
   * Lobby status board (§6.5). `text` = `<clock>|<lamp>|<line>\n<line>…` e.g.
   * `WED 22:40|EVENING|NODES ONLINE: 5 OF 6\nNODE 2 — BIO-SYS\nNODE 5 — FAB L2: OFFLINE`. Each line gets a status dot
   * (red: ALARM / SEALED, amber: OFFLINE / SUPERVISED / TEST, green otherwise). A line starting with `!` is an alert:
   * it becomes a blinking red banner and turns the board's accent red (`!PRESSURE ALARM — SECTOR SEALED`).
   */
  private habitatStatus(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    const parts = (s.text ?? '').split('|');
    const [clockRaw, lamp, bodyRaw] = parts.length >= 3 ? [parts[0], parts[1], parts.slice(2).join('|')] : ['', '', parts.join('|')];
    const lines = bodyRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    const alerts = lines.filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
    const items = lines.filter((l) => !l.startsWith('!'));
    const alarm = alerts.length > 0;
    const blink = Math.floor(t * 1.6) % 2 === 0;
    const WARM = '#f6efe0', DIM = 'rgba(246,239,224,0.6)';
    const accent = alarm ? '#ff4a36' : '#e8b45a';
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, alarm ? '#220807' : '#0c1e25'); bg.addColorStop(1, alarm ? '#120303' : '#07131a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // top bar: header, and the band colours of the habitat's wayfinding
    const th = H * 0.1;
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, W, th);
    const bands = ['#4f8a4a', '#d0782e', '#3d6fa8', '#c49a3a', '#6a5aa0'];
    bands.forEach((c, i) => { g.fillStyle = alarm ? '#7a1a12' : c; g.fillRect(i * W / bands.length, th - 3, W / bands.length, 3); });
    g.fillStyle = DIM; g.textBaseline = 'middle'; g.textAlign = 'left';
    this.fit(g, this.header, 600, th * 0.42, W * 0.94);
    g.fillText(this.header, W * 0.03, th * 0.5);
    // left: the clock and the lamp setting
    const lx = W * 0.03, lw = W * 0.34;
    const clock = clockRaw.trim();
    const m = /^(\S+)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/.exec(clock);
    const day = m ? m[1] : '', time = m ? m[2] : clock;
    g.textAlign = 'left';
    if (day) { g.fillStyle = DIM; g.font = `600 ${Math.round(H * 0.07)}px ${HAB}`; g.fillText(day, lx, H * 0.21); }
    if (time) {
      this.fit(g, time, 500, H * 0.22, lw, HAB);
      g.save(); g.shadowColor = WARM; g.shadowBlur = H * 0.03; g.fillStyle = WARM; g.fillText(time, lx - 2, H * 0.36); g.restore();
    }
    if (lamp) {
      // lamp setting: a setting sun (EVENING), full sun (DAY), moon (NIGHT)
      const iy = H * 0.57, ir = H * 0.05, ix = lx + ir;
      const L = lamp.trim().toUpperCase();
      g.fillStyle = '#ffc58a'; g.strokeStyle = '#ffc58a'; g.lineWidth = 2;
      if (L.startsWith('밤')) {
        g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
        g.fillStyle = alarm ? '#1a0505' : '#0b1b22'; g.beginPath(); g.arc(ix + ir * 0.45, iy - ir * 0.3, ir * 0.85, 0, Math.PI * 2); g.fill();
      } else {
        const half = L.startsWith('저녁') || L.startsWith('아침');
        g.beginPath(); g.arc(ix, iy + (half ? ir * 0.3 : 0), ir * 0.75, half ? Math.PI : 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 7; k++) {
          const a = Math.PI + (k / 6) * Math.PI;
          g.beginPath(); g.moveTo(ix + Math.cos(a) * ir * 1.05, iy + (half ? ir * 0.3 : 0) + Math.sin(a) * ir * 1.05);
          g.lineTo(ix + Math.cos(a) * ir * 1.45, iy + (half ? ir * 0.3 : 0) + Math.sin(a) * ir * 1.45); g.stroke();
        }
        if (half) g.fillRect(ix - ir * 1.5, iy + ir * 0.36, ir * 3, 2);
      }
      g.fillStyle = '#ffc58a'; g.font = `600 ${Math.round(H * 0.065)}px ${HAB}`;
      g.fillText(L, lx + ir * 2.8, iy + 1);
      g.fillStyle = DIM; g.font = `500 ${Math.round(H * 0.045)}px ${HAB}`;
      g.fillText('조명 설정', lx, iy + H * 0.09);
    }
    // divider
    g.fillStyle = 'rgba(246,239,224,0.15)'; g.fillRect(W * 0.39, th + H * 0.05, 1.5, H * 0.72);
    // right: alerts on top, then the status lines
    const rx = W * 0.42, rw = W * 0.55;
    let y = th + H * 0.07;
    for (const a of alerts) {
      const bh = H * 0.12;
      g.fillStyle = blink ? '#ff3a28' : '#5a0d08'; g.fillRect(rx, y, rw, bh);
      g.fillStyle = blink ? '#fff4f0' : '#ff6a50'; g.textAlign = 'left';
      this.fit(g, a, 800, bh * 0.52, rw - bh * 0.4);
      g.fillText(a, rx + bh * 0.2, y + bh * 0.52);
      y += bh + H * 0.03;
    }
    const n = Math.max(1, items.length);
    const lh = Math.min(H * 0.12, (H * 0.86 - y) / n);
    for (const ln of items) {
      const U = ln.toUpperCase();
      const dot = /ALARM|SEALED|FAIL/.test(U) ? '#ff4a36' : /OFFLINE|SUPERVISED|TEST|STANDBY|NO /.test(U) ? '#ffb347' : '#6ddf8a';
      const r = lh * 0.17;
      g.fillStyle = dot; g.beginPath(); g.arc(rx + r, y + lh * 0.5, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = WARM; g.textAlign = 'left';
      this.fit(g, ln, 600, lh * 0.62, rw - r * 3.6);
      g.fillText(ln, rx + r * 3.2, y + lh * 0.52);
      y += lh;
    }
    // footer
    g.fillStyle = accent; g.fillRect(0, H * 0.9, W, 2);
    g.fillStyle = DIM; g.textAlign = 'left'; g.font = `500 ${Math.round(H * 0.045)}px ${HAB}`;
    g.fillText('주거 링 A  ·  로비', W * 0.03, H * 0.95);
    g.textAlign = 'right';
    g.fillText(alarm ? '직원의 안내를 따라 주세요' : 'CHOIR가 6시간마다 보고합니다', W * 0.97, H * 0.95);
  }

  /**
   * Badge reader (§6.5, `bio_reader`). `text` = `<state>|<LABEL>|<detail>`; state: off, idle (PRESENT BADGE, pulsing),
   * read (reading, spinner), accepted (green, detail = whose badge), denied (red, blinking, detail = the reason).
   */
  private badge(s: Screen) {
    const { g, W, H } = s;
    const t = s.t;
    const [stRaw = 'idle', label = '', detail = ''] = (s.text ?? '').split('|');
    const st = stRaw.trim().toLowerCase();
    g.fillStyle = st === 'off' ? '#010101' : '#070d12'; g.fillRect(0, 0, W, H);
    if (st === 'off') return;
    const blink = Math.floor(t * 3) % 2 === 0;
    const col = st === 'accepted' ? '#6dffa6' : st === 'denied' ? '#ff4a36' : st === 'read' ? '#ffb347' : '#cfe8ff';
    const C = (a: number) => {
      const c = st === 'accepted' ? '109,255,166' : st === 'denied' ? '255,74,54' : st === 'read' ? '255,179,71' : '207,232,255';
      return `rgba(${c},${a})`;
    };
    const m = W * 0.06;
    g.strokeStyle = C(st === 'denied' ? (blink ? 1 : 0.4) : 0.8); g.lineWidth = Math.max(2, W * 0.025);
    g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (label) { g.fillStyle = 'rgba(244,241,232,0.8)'; this.fit(g, label.toUpperCase(), 700, H * 0.07, W - m * 3); g.fillText(label.toUpperCase(), W / 2, H * 0.12); }
    const cx = W / 2, cy = H * 0.42, R = Math.min(W, H) * 0.24;
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (st === 'idle' || st === 'read') {
      // a badge with contactless arcs
      const p = st === 'idle' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 1.8)) : 1;
      g.strokeStyle = C(p); g.fillStyle = C(p * 0.2); g.lineWidth = Math.max(2, R * 0.09);
      const bw = R * 0.9, bh = R * 1.25;
      g.fillRect(cx - bw / 2 - R * 0.25, cy - bh / 2, bw, bh); g.strokeRect(cx - bw / 2 - R * 0.25, cy - bh / 2, bw, bh);
      g.fillStyle = C(p); g.beginPath(); g.arc(cx - R * 0.25, cy - bh * 0.15, R * 0.17, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - R * 0.25 - bw * 0.3, cy + bh * 0.12, bw * 0.6, R * 0.08);
      for (let k = 0; k < 3; k++) {
        const a = st === 'read' ? (Math.floor(t * 6) % 3 >= k ? 1 : 0.25) : p * (0.4 + 0.2 * k);
        g.strokeStyle = C(a); g.lineWidth = Math.max(2, R * 0.08);
        g.beginPath(); g.arc(cx + R * 0.3, cy, R * (0.3 + k * 0.22), -0.7, 0.7); g.stroke();
      }
      g.fillStyle = C(1);
      const msg = st === 'idle' ? '배지를 대세요' : `읽는 중${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`;
      this.fit(g, '배지를 대세요', 800, H * 0.085, W - m * 3); g.fillText(msg, cx, H * 0.75);
      if (detail) { g.fillStyle = 'rgba(244,241,232,0.6)'; this.fit(g, detail.toUpperCase(), 600, H * 0.055, W - m * 3); g.fillText(detail.toUpperCase(), cx, H * 0.86); }
    } else if (st === 'accepted') {
      g.save(); g.shadowColor = col; g.shadowBlur = R * 0.3;
      g.strokeStyle = col; g.lineWidth = R * 0.16;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx - R * 0.45, cy + R * 0.02); g.lineTo(cx - R * 0.1, cy + R * 0.36); g.lineTo(cx + R * 0.5, cy - R * 0.32); g.stroke();
      g.restore();
      g.fillStyle = col; this.fit(g, '승인됨', 800, H * 0.1, W - m * 3); g.fillText('승인됨', cx, H * 0.73);
      if (detail) { g.fillStyle = 'rgba(244,241,232,0.85)'; this.fit(g, detail.toUpperCase(), 600, H * 0.06, W - m * 3); g.fillText(detail.toUpperCase(), cx, H * 0.85); }
    } else {
      // denied (any other state reads as a refusal)
      const a = blink ? 1 : 0.45;
      g.save(); g.shadowColor = col; g.shadowBlur = R * 0.3;
      g.strokeStyle = C(a); g.lineWidth = R * 0.16;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx - R * 0.4, cy - R * 0.4); g.lineTo(cx + R * 0.4, cy + R * 0.4); g.moveTo(cx + R * 0.4, cy - R * 0.4); g.lineTo(cx - R * 0.4, cy + R * 0.4); g.stroke();
      g.restore();
      g.fillStyle = C(a); this.fit(g, '거부됨', 800, H * 0.1, W - m * 3); g.fillText('거부됨', cx, H * 0.73);
      if (detail) { g.fillStyle = 'rgba(244,241,232,0.85)'; this.fit(g, detail.toUpperCase(), 600, H * 0.06, W - m * 3); g.fillText(detail.toUpperCase(), cx, H * 0.85); }
    }
  }

  /** `feed` with no texture bound: NO SIGNAL card (`text` = the camera label, e.g. `CAM 01  GALLERY N`). */
  private noSignal(s: Screen) {
    const { g, W, H, rand } = s;
    g.fillStyle = '#05080b'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) { const v = (rand() * 90) | 0; g.fillStyle = `rgba(${v},${v},${v + 10},0.25)`; g.fillRect(rand() * W, rand() * H, 2, 2); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(220,230,240,0.85)';
    this.fit(g, '신호 없음', 700, H * 0.14, W * 0.7, MONO);
    if (Math.floor(s.t * 1.2) % 2 === 0) g.fillText('신호 없음', W / 2, H / 2);
    if (s.text) { g.font = `${Math.round(H * 0.06)}px ${MONO}`; g.textAlign = 'left'; g.fillText(s.text, W * 0.04, H * 0.08); }
  }
}
