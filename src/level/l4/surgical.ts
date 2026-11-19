/**
 * BIOLOGICAL SYSTEMS — the surgical suite (stage 3b §2.6, §2.7, §2.8, §4.4; task D2).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const SURGICAL_DRESS: Partial<Record<RoomId4, RoomDress>>
 * for the rooms scrub, store4, gallery, theatre, stair4. Per room: build(L) / lights / look / label as in entry.ts.
 * The shell already made (NOT re-created here): screens theatre_screen, theatre_cam; interactables note4_list,
 *   sign4_theatre; markers mk4_gallery_spk, mk4_store_door; the gallery glazing; stand-ins: bench tier (two blocks,
 *   0.9 m) and camera desk (1.0 m) — their colliders force the path and stay; only their grey visuals are replaced;
 *   the stair (`STAIR4`, colliders + nav) and its landing; the sealed theatre lower door `door4_theatre`.
 *
 * The centrepiece (§1 beat 8, §4.4, §13 B3/S4/S5): the theatre is lit by ONE surgical lamp on the table (the
 * flashlight is the view's other shadow slot), a dim cool fill keeps the bath, bin, gurneys and the wall screen as
 * shapes; the gallery stays dim so the glazing reads as a window onto a lit stage. W9a's `theatreArm` replaces the
 * greybox placeholder (same `userData` API); this file drives `theatre_cam` and `theatre_screen` from the arm's cycle
 * (`cycle.cue`, `cycle.led`, `cycle.attempt` — polled every frame, so `setTime` on a restore re-syncs too), the
 * wisp (`fx4_wisp`, two puffs per fit), and the theatre sounds (servo loop pitched down, `clasp_click`, `gel_dip`).
 *
 * Stair: steel treads, BIO-SYS white above mid-flight, NAVAL grey below (`바이오시스 ┃ 해군` at the line, z −51.5);
 * Eng's trail = a broken smear down the treads by the east rail, a dragged handprint at the foot, his respirator on
 * the bottom landing (11.0, 0, −57.5) (§13 S6).
 */
import * as THREE from 'three';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { LightRow } from '../l3/grey';
import { isStandin, restyle } from '../l3/kit3';
import type { FxSystemEx } from '../../fx';
import { D2, STAIR4, type RoomId4 } from './grey';
import type { RoomDress } from './index';
import { claspBin, gelBath, orTable, body, setpieceMats, theatreArm, type ArmCue, type ArmCycle } from './setpieces';
import { clinicalSign, deckLine, floorStrip, glow4, hepaDiffuser, labWhite, luminaire, mat4, scrubSink, stencil, sticker } from './kit4';

const PI = Math.PI;
const CLEAN = 0xeef4ff, EMERG = 0x9ec4ff, NAVY = 0xffe2c0;
const S: Mat = 'stainless';
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const em = (group: string, p: [number, number, number], i: number, d: number): LightRow =>
  ({ group: `${group}_emerg`, type: 'point', p, color: EMERG, i, d, off: true });

/** Bind emissive fixture materials to the first (all-quality) light of a group once every room's lights exist. */
function bindTo(L: LevelBuild, group: string, mats: [THREE.MeshStandardMaterial, number][]) {
  L.afterDoors.push(() => {
    const h = L.ctx.render.lights.group(group).find((x) => !x.desc.minQuality) ?? L.ctx.render.lights.group(group)[0];
    if (h) for (const [m, base] of mats) h.bindEmissive(m, base);
  });
}
/** A private luminaire diffuser that follows its room light (lights-out dims it with the room). */
const lumMat = (L: LevelBuild, key: string, i = 0.3, color = 0xe8f0ff) => glow4(L, `d2_${key}`, color, i);

// ───────────────────────────────────────────────────────────── shared small props

/** Ceiling speaker grille (ceiling prop, origin on the ceiling surface). */
function ceilingSpeaker(b: Builder) {
  b.detail(() => {
    b.cyl('plastic_white', 0, -0.01, 0, 0.13, 0.02, 'y', 18);
    b.cyl('plastic_dark', 0, -0.021, 0, 0.1, 0.003, 'y', 18);
  });
}

/** Wall clock (wall prop: back on the wall face, local +z out), hands at h:m. */
function wallClock(b: Builder, h: number, m: number, r = 0.16) {
  b.detail(() => {
    b.cyl(S, 0, 0, 0.02, r, 0.04, 'z', 24);
    b.cyl('plastic_white', 0, 0, 0.041, r - 0.015, 0.003, 'z', 24);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * PI; b.box('plastic_dark', Math.sin(a) * (r - 0.035), Math.cos(a) * (r - 0.035), 0.044, 0.008, 0.02, 0.002); }
    const ah = ((h % 12) + m / 60) / 12 * 2 * PI, am = (m / 60) * 2 * PI;
    b.rbox('plastic_dark', Math.sin(ah) * 0.04, Math.cos(ah) * 0.04, 0.047, 0.012, 0.09, 0.003, 0, 0, -ah);
    b.rbox('plastic_dark', Math.sin(am) * 0.055, Math.cos(am) * 0.055, 0.05, 0.008, 0.125, 0.003, 0, 0, -am);
  });
}

// ───────────────────────────────────────────────────────────── scrub (§2.6)

function buildScrub(L: LevelBuild) {
  const b = L.builder('scrub_dress');
  const M = setpieceMats(L);
  const y = D2;
  // west wall (face x −3.8, +x): three scrub stations, a stainless ledge along their back (the medkit and the shells
  // the plan leaves at (−3.6, 5.7, −38.0 / −38.4) rest on it), Foss slumped against the gown hamper beside them
  b.at(-3.8, y, -38.55, PI / 2, () => {
    scrubSink(b, L, { stations: 3 });
    b.bx(S, -1.26, 0.875, 0.03, 1.26, 0.9, 0.32); // back ledge (rim height)
  });
  clinicalSign(b, L, '수술 손소독 — 3분 — 팔꿈치 들기', -3.79, y + 1.95, -38.55, 1.4, 0.18, '+x');
  // Foss (§2.6 (−3.2, 4.8, −40.5)): sat down against the hamper, facing the room
  const foss = body(L, b, 'slumped_wall', '포스', { x: -3.2, y, z: -40.5, ry: PI / 2, collider: 'none' });
  // his walkable 0.15 m box, stopped 0.1 m short of the nav grid node at x −2.5 (a node may not stand under a floor)
  b.collide(foss.box.min.x, y, foss.box.min.z, Math.min(foss.box.max.x, -2.6), y + 0.15, foss.box.max.z, 'flesh', true);
  const back = Math.max(-3.75, Math.min(-3.4, foss.box.min.x + 0.02));
  b.bx(labWhite(L), -3.8, y, -41.0, back, y + 0.72, -40.0); // soiled-gown hamper
  b.bx(S, -3.8, y + 0.72, -41.02, back + 0.02, y + 0.75, -39.98);
  b.collide(-3.8, y, -41.0, back, y + 0.75, -40.0, 'metal', true);
  b.sign('사용한 가운', 'label', back + 0.001, y + 0.55, -40.5, 0.34, 0.06, '+x');
  // gown hooks along the west wall south of him, two gowns left on them
  b.bx(S, -3.8, y + 1.62, -42.6, -3.77, y + 1.68, -41.2);
  for (let i = 0; i < 4; i++) {
    const z = -41.35 - i * 0.4;
    b.rod(S, -3.77, y + 1.65, z, -3.66, y + 1.69, z, 0.008, 5);
    if (i === 1 || i === 2) {
      // a hanging gown: a tapered slab with the shoulders on the hook
      b.rbox(M.tyvek, -3.69, y + 1.12, z, 0.06, 1.0, 0.34, 0, 0, 0.03);
      b.rbox(M.tyvek, -3.7, y + 1.58, z, 0.08, 0.12, 0.44, 0, 0, 0.0);
    }
  }
  // south wall (face z −42.8, +z), west of the gallery door: glove dispensers, a waste bin
  for (let i = 0; i < 3; i++) {
    const x = -3.3 + i * 0.32;
    b.bx('plastic_white', x - 0.13, y + 1.25, -42.8, x + 0.13, y + 1.39, -42.71);
    b.bx(i === 1 ? 'plastic_dark' : M.nitrile, x - 0.08, y + 1.27, -42.709, x + 0.08, y + 1.29, -42.705);
  }
  b.sign('장갑  S · M · L', 'label', -2.98, y + 1.47, -42.795, 0.6, 0.06, '+z');
  // theatre "in use" light box over the gallery door's west side
  const inUse = lumMat(L, 'inuse', 0.3, 0xff5a3a);
  b.bx('plastic_dark', -2.6, y + 2.5, -42.8, -1.85, y + 2.72, -42.74);
  b.bx(inUse, -2.56, y + 2.53, -42.739, -1.89, y + 2.69, -42.735);
  b.sign('수술실 1 — 사용 중', 'label', -2.225, y + 2.61, -42.733, 0.62, 0.11, '+z');
  // north wall (face z −37.2, −z): wall clock, east of the suite door
  b.at(2.75, y + 2.25, -37.2, PI, () => wallClock(b, 8, 41));
  // east wall (face x 3.8, −x): the theatre list board (note4_list at (3.78, 6.2, −38.4))
  b.bx(S, 3.765, y + 1.05, -38.95, 3.8, y + 1.75, -37.85);
  b.bx('plastic_white', 3.755, y + 1.08, -38.92, 3.765, y + 1.72, -37.88);
  b.sign('수술실 1 — 일정', 'label', 3.753, y + 1.66, -38.4, 0.7, 0.07, '-x');
  const red = mat4(L, 'd2_marker_red', () => L.ctx.materials.clone('plastic_white', { color: 0xb3261e, map: null, normalMap: null }));
  for (let i = 0; i < 10; i++) {
    const w = 0.42 + ((i * 37) % 23) / 100;
    b.bx(i === 2 ? red : 'plastic_dark', 3.752, y + 1.58 - i * 0.05, -38.83, 3.754, y + 1.592 - i * 0.05, -38.83 + w);
  }
  clinicalSign(b, L, '손소독실', 3.79, y + 2.2, -38.4, 0.9, 0.18, '-x');
  // ceiling: two flush luminaires on the room light, one HEPA terminal
  const lum = lumMat(L, 'scrub', 0.32);
  for (const z of [-38.9, -41.3]) b.at(0, y + 3.0, z, 0, () => luminaire(b, L, { glow: lum }));
  b.at(-2.3, y + 3.0, -40.0, 0, () => hepaDiffuser(b, L));
  bindTo(L, 'scrub', [[lum, 0.32], [inUse, 0.3]]);
  // emergency floor strips along the walkway (§8.11)
  floorStrip(b, L, -1.15, -37.7, -1.15, -42.3, { y });
  floorStrip(b, L, 1.15, -37.7, 1.15, -42.3, { y });
  sticker(b, 1.45, y + 1.5, -42.795, '+z');
}

// ───────────────────────────────────────────────────────────── store4 (sterile store; spawn room, script-only door)

function buildStore(L: LevelBuild) {
  const b = L.builder('store4_dress');
  const y = D2;
  const wrap = mat4(L, 'd2_wrap', () => L.ctx.materials.clone('plastic_white', { color: 0x5d88a3, roughness: 0.75, map: null, normalMap: null }));
  const R = (() => { let a = 0x51a7e; return () => { a = (a * 1103515245 + 12345) >>> 0; return (a >>> 8) / 16777216; }; })();
  /** Wire shelving bay (wall prop on the transform): len × 0.4 deep × 2.0 high, 4 shelves of sterile packs. */
  const shelving = (len: number) => {
    for (const x of [-len / 2 + 0.02, len / 2 - 0.02]) for (const z of [0.02, 0.38]) b.box(S, x, 1.0, z, 0.025, 2.0, 0.025);
    for (let k = 0; k < 4; k++) {
      const sy = 0.12 + k * 0.55;
      b.box(S, 0, sy, 0.2, len - 0.02, 0.02, 0.4);
      b.detail(() => {
        let x = -len / 2 + 0.08;
        while (x < len / 2 - 0.25) {
          const w = 0.18 + R() * 0.2, h = 0.06 + R() * 0.16;
          if (R() > 0.2) b.box(R() > 0.3 ? wrap : 'plastic_white', x + w / 2, sy + 0.01 + h / 2, 0.2, w - 0.02, h, 0.3);
          x += w;
        }
      });
    }
    b.collide(-len / 2, 0, 0, len / 2, 2.02, 0.4, 'metal', true);
  };
  b.at(7.8, y, -41.0, -PI / 2, () => shelving(3.4));     // east wall
  b.at(5.5, y, -39.2, PI, () => shelving(2.2));          // north wall (husk at (5.4, −40.2) stands 0.6 clear)
  clinicalSign(b, L, '무균 물품 — 선입선출', 6.0, y + 2.45, -42.79, 1.8, 0.16, '+z');
  // a dark luminaire (the store has no light of its own: the husks come out of the dark)
  b.at(6.0, y + 3.0, -41.0, PI / 2, () => luminaire(b, L, { glow: lumMat(L, 'store_off', 0.02) }));
  sticker(b, 4.21, y + 1.55, -39.6, '+x');
  // the steriliser's standby panel (the store's only glow, B7)
  b.bx('painted_dark', 6.2, y + 0.75, -42.8, 7.0, y + 1.05, -42.76);
  b.bx(glow4(L, 'd2_store_standby', 0x7fa8ff, 0.25), 6.28, y + 0.85, -42.76, 6.6, y + 0.95, -42.75);
}

// ───────────────────────────────────────────────────────────── gallery (§2.6 B3 layout)

function buildGallery(L: LevelBuild) {
  // the stand-in visuals go (their colliders stay: bench tier 0.9 m, camera desk 1.0 m)
  restyle(L, 'gallery_grey', isStandin, null);
  // B3 / §2.8: the glazing reflects the bright gallery (bench tops, ceiling) through the probe as pale wavy bands that
  // read as smoke in the theatre — keep the reflection a faint sheen (the library re-applies its own env multiplier on
  // every env-map change, so the value is held here)
  const pane = L.ctx.materials.clone('glass_clear', { side: THREE.FrontSide });
  pane.name = 'd2_gallery_pane';
  L.updaters.push(() => { if (pane.envMapIntensity !== 0.22) pane.envMapIntensity = 0.22; });
  restyle(L, 'gallery_grey', (m) => m === L.ctx.materials.get('glass'), pane);
  const b = L.builder('gallery_dress');
  const M = setpieceMats(L);
  const y = D2;
  const W = labWhite(L);
  // ── bench tier: two steps (front row 0.45, back row 0.9) inside the stand-in's 0.9 m box, a stainless rail at
  //    0.9 along its front (the collider face); the door-side ends step round d4_gal's jamb (x ±1.0 … ±1.15)
  const tier = (x0: number, x1: number, doorEnd: 'x0' | 'x1') => {
    const n0 = doorEnd === 'x0' ? x0 + 0.15 : x0, n1 = doorEnd === 'x1' ? x1 - 0.15 : x1;
    b.bx(W, x0, y, -44.8, x1, y + 0.41, -44.0);                       // front step
    b.bx(W, x0, y, -44.0, x1, y + 0.86, -43.36);                      // back step
    b.bx(W, n0, y, -43.36, n1, y + 0.86, -43.2);                      // back step, wall strip (clear of the jamb)
    b.bx(S, x0, y + 0.385, -44.815, x1, y + 0.415, -44.785);          // nosings
    b.bx(S, x0, y + 0.835, -44.015, x1, y + 0.865, -43.985);
    b.bx('plastic_dark', x0 + 0.02, y, -44.81, x1 - 0.02, y + 0.08, -44.8); // kick
    // seat pads in 0.6 m bays
    const bays = Math.floor((x1 - x0 - 0.1) / 0.62);
    const bw = (x1 - x0 - 0.1) / bays;
    for (let i = 0; i < bays; i++) {
      const a = x0 + 0.05 + i * bw, c = a + bw - 0.03;
      b.bx(M.pad, a, y + 0.41, -44.72, c, y + 0.45, -44.08);
      b.bx(M.pad, Math.max(a, n0 + 0.02), y + 0.86, -43.92, Math.min(c, n1 - 0.02), y + 0.9, -43.28);
    }
    // front rail on posts (the stand-in's collider face is the rail line: it is not walked over)
    b.rod(S, x0 + 0.06, y + 0.88, -44.78, x1 - 0.06, y + 0.88, -44.78, 0.022, 8);
    const posts = Math.max(2, Math.round((x1 - x0) / 1.5) + 1);
    for (let i = 0; i < posts; i++) { const x = x0 + 0.06 + (i * (x1 - x0 - 0.12)) / (posts - 1); b.rod(S, x, y + 0.41, -44.78, x, y + 0.88, -44.78, 0.018, 8); }
  };
  tier(-9.8, -1.0, 'x1');
  tier(1.0, 8.0, 'x0');
  // ── camera desk (x 3 … 5, z −46.8 … −46.4, 1.0) + the theatre_cam monitor's housing (screen (4.0, 6.0, −46.5), tilted 30° up)
  b.bx(W, 3.02, y + 0.1, -46.8, 4.98, y + 0.96, -46.42);
  b.bx('plastic_dark', 3.06, y, -46.78, 4.94, y + 0.1, -46.46);
  b.bx(S, 3.0, y + 0.96, -46.8, 5.0, y + 1.0, -46.4);
  b.detail(() => {
    b.bx('plastic_dark', 3.24, y + 1.0, -46.62, 3.72, y + 1.018, -46.46); // keyboard
    b.bx('plastic_dark', 4.5, y + 1.0, -46.7, 4.85, y + 1.06, -46.5); // camera control unit
    b.box('emissive_green', 4.8, y + 1.035, -46.499, 0.012, 0.01, 0.002);
    b.sign('수술실 카메라 1 — 필드', 'label', 4.0, y + 0.8, -46.419, 0.6, 0.07, '+z');
  });
  b.push(4.0, 6.0, -46.5, 0, -PI / 6, 0);
  b.box('plastic_dark', 0, 0, -0.03, 0.68, 0.48, 0.05);
  b.box('plastic_dark', 0, -0.08, -0.08, 0.14, 0.3, 0.06);
  b.pop();
  // ── glazing trim on the gallery side (2 mm off the pane: never coplanar), two mullions (x ±3.8, off the door → table ray)
  b.bx(S, -7.6, 5.0, -46.983, 7.6, 5.03, -46.8);
  b.bx(S, -7.6, 7.57, -46.983, 7.6, 7.6, -46.8);
  for (const x of [-7.6, 7.57]) b.bx(S, x, 5.03, -46.983, x + 0.03, 7.57, -46.8);
  for (const x of [-3.8, 3.8]) b.bx(S, x - 0.025, 5.03, -46.983, x + 0.025, 7.57, -46.93);
  // decorative rail on brackets 0.1 m inside the glass, at 0.4 m (below every eye → nape ray from the path)
  for (const [a, c] of [[-7.45, 2.9], [5.1, 7.45]] as const) {
    b.rod(S, a, y + 0.4, -46.9, c, y + 0.4, -46.9, 0.02, 8);
    const n = Math.max(2, Math.round((c - a) / 1.6) + 1);
    for (let i = 0; i < n; i++) { const x = a + 0.1 + (i * (c - a - 0.2)) / (n - 1); b.rod(S, x, y + 0.4, -46.9, x, y + 0.14, -46.8, 0.012, 6); }
    b.collide(a, y + 0.37, -46.93, c, y + 0.43, -46.87, 'metal', false);
  }
  // ── placard (sign4_theatre (−6.0, 5.9, −43.22), north wall, facing −z)
  b.bx(S, -6.32, y + 0.96, -43.2, -5.68, y + 1.24, -43.212);
  b.detail(() => {
    b.sign('수술실 1 — 관람 갤러리', 'clinical', -6.0, y + 1.17, -43.214, 0.6, 0.08, '-z');
    b.sign('시술 내용은 갤러리 스피커로 안내됩니다.', 'label', -6.0, y + 1.07, -43.214, 0.56, 0.04, '-z');
    b.sign('유리를 두드리지 마세요.', 'label', -6.0, y + 1.02, -43.214, 0.36, 0.035, '-z');
  });
  clinicalSign(b, L, '서비스 계단 B →', 8.9, y + 2.05, -43.21, 1.1, 0.16, '-z');
  clinicalSign(b, L, '수술실 1 — 관람', -5.2, y + 2.2, -43.21, 1.4, 0.18, '-z');
  // ── ceiling: speaker (mk4_gallery_spk (0, 7.55, −45.0)), luminaires on the gallery light, one HEPA terminal
  b.at(0, y + 3.0, -45.0, 0, () => ceilingSpeaker(b));
  const lum = lumMat(L, 'gallery', 0.22);
  for (const x of [-7.0, -3.0, 0.8, 7.2]) b.at(x, y + 3.0, -43.95, 0, () => luminaire(b, L, { glow: lum, len: 1.2, w: 0.3 }));
  b.at(-1.8, y + 3.0, -45.4, 0, () => hepaDiffuser(b, L));
  bindTo(L, 'gallery', [[lum, 0.22]]);
  // (B9: fx now stars every pane itself — the gallery's own star ring would double it)
  void glassStars;
  // ── emergency strips (§8.11): along the glass base and the bench fronts
  for (const [a, c] of [[-7.5, 2.95], [5.05, 9.5]] as const) floorStrip(b, L, a, -46.7, c, -46.7, { y });
  for (const [a, c] of [[-9.7, -1.05], [1.05, 7.95]] as const) floorStrip(b, L, a, -44.9, c, -44.9, { y });
}

/**
 * Shots on the gallery glazing (§2.8: "stars, it holds"): fx's own impact decal is a dark pit, invisible against the
 * dark theatre behind the pane, so each hit on the pane also gets a pale crazed star on the gallery face (ring of 24,
 * one instanced call, lit — catches the gallery and lamp light, nothing glows after lights-out).
 */
function glassStars(L: LevelBuild) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.translate(64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 11; i++) {
    let a = (i / 11) * 2 * PI + r() * 0.4, x = 0, y = 0;
    g.lineWidth = 1.6 - i * 0.05;
    g.beginPath(); g.moveTo(0, 0);
    const len = 30 + r() * 30;
    for (let d = 0; d < len; d += 6) { a += (r() - 0.5) * 0.35; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
    g.stroke();
  }
  g.lineWidth = 1;
  for (const rad of [9, 17]) { g.beginPath(); for (let k = 0; k <= 24; k++) { const a = (k / 24) * 2 * PI; const q = rad * (0.85 + r() * 0.3); k ? g.lineTo(Math.cos(a) * q, Math.sin(a) * q) : g.moveTo(Math.cos(a) * q, Math.sin(a) * q); } g.stroke(); }
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 7);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(-8, -8, 16, 16);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    name: 'd2_glass_star', color: 0xeef4f8, map: tex, transparent: true, depthWrite: false, roughness: 0.2, metalness: 0,
    emissive: 0xc8d6de, emissiveMap: tex, emissiveIntensity: 0.32, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const N = 24;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, N);
  mesh.name = 'gallery_glass_stars';
  mesh.count = 0;
  mesh.visible = false; // (no draw call until the first hit)
  mesh.frustumCulled = false;
  L.root.add(mesh);
  let next = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
  L.ctx.events.on('bullet:impact', (ev) => {
    const p = ev.point;
    if (ev.surface !== 'glass' || Math.abs(p.z + 47) > 0.05 || p.x < -7.6 || p.x > 7.6 || p.y < 5.0 || p.y > 7.6) return;
    const front = ev.normal.z >= 0;
    pos.set(p.x, p.y, front ? -46.983 : -47.017);
    q.setFromEuler(e.set(0, front ? 0 : PI, Math.random() * 2 * PI));
    const s = 0.17 + Math.random() * 0.1;
    mesh.setMatrixAt(next, m.compose(pos, q, sc.set(s, s, s)));
    next = (next + 1) % N;
    mesh.count = Math.min(N, Math.max(mesh.count, next === 0 ? N : next));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = true;
  });
}

// ───────────────────────────────────────────────────────────── theatre (§2.6, §4.4, §8.5)

const NAPE: [number, number, number] = [-0.7, 1.08, -53.5];
/** The surgical lamp head (centre of the dish) and where it is aimed: the nape and the upper back. */
const LAMP = V(0.3, 3.35, -53.45), AIM = V(-0.45, 0.98, -53.5);

function surgicalLamp(b: Builder, L: LevelBuild) {
  const white: Mat = 'plastic_white';
  const lens = glow4(L, 'd2_lamp_lens', 0xf2f7ff, 2.4, 0xffffff);
  const mount = V(2.6, 9.4, -52.6), knee = V(2.6, 6.1, -52.6), elbow = V(0.95, 4.55, -53.2);
  b.detail(() => {
    b.cyl(S, mount.x, 9.33, mount.z, 0.2, 0.14, 'y', 20);
    b.rod(white, mount.x, 9.3, mount.z, knee.x, knee.y, knee.z, 0.055, 12);
    b.sphere(white, knee.x, knee.y, knee.z, 0.08, 12);
    b.rod(white, knee.x, knee.y, knee.z, elbow.x, elbow.y, elbow.z, 0.05, 12);
    b.sphere(white, elbow.x, elbow.y, elbow.z, 0.07, 12);
    // yoke from the spring arm to the head
    b.rod(S, elbow.x, elbow.y, elbow.z, LAMP.x + 0.12, LAMP.y + 0.42, LAMP.z, 0.03, 8);
  });
  // head: a dish tilted to its aim (local −y = the beam)
  const d = AIM.clone().sub(LAMP).normalize();
  const tilt = Math.atan2(-d.x, -d.y);
  b.push(LAMP.x, LAMP.y, LAMP.z, 0, 0, -tilt);
  b.detail(() => {
    b.cyl(white, 0, 0.05, 0, 0.38, 0.12, 'y', 28, 0.3);
    b.cyl(S, 0, -0.015, 0, 0.385, 0.02, 'y', 28);
    b.cyl(lens, 0, -0.026, 0, 0.32, 0.004, 'y', 28);
    b.cyl(white, 0, 0.13, 0, 0.07, 0.08, 'y', 12);
    b.rod(S, 0, 0.17, 0, 0, 0.42, 0, 0.03, 8);
    b.cyl('rubber', 0, -0.1, 0, 0.04, 0.12, 'y', 10); // sterile handle
    // the field camera on the rim (the gallery's close-up)
    b.box('plastic_dark', 0.3, -0.02, 0.18, 0.07, 0.05, 0.1);
    b.cyl('chrome', 0.3, -0.05, 0.18, 0.02, 0.02, 'y', 10);
  });
  b.pop();
  return lens;
}

function buildTheatre(L: LevelBuild) {
  const b = L.builder('theatre_dress');
  const M = setpieceMats(L);
  // ── the set (§2.6): table, Strand, gel bath, the FAILED bin, Haugen and Lie under sheets
  b.at(0, 0, -53.5, 0, () => orTable(b, L));
  body(L, b, 'prone_table', '스트란드', { x: 0, y: 0, z: -53.5, nape: NAPE });
  b.at(-2.5, 0, -56.8, 0, () => gelBath(b, L));
  b.at(2.2, 0, -51.5, 0, () => claspBin(b, L, 30));
  body(L, b, 'covered_gurney', '하우겐', { x: 5.5, y: 0, z: -50.2, ry: 0.06 });
  body(L, b, 'covered_gurney', '리에', { x: 5.5, y: 0, z: -56.0, ry: -0.04 });
  // ── the arm (W9a): replaces the greybox placeholder; its rail goes into this zone
  const arm = theatreArm(L, V(-1.7, 9.2, -54.5), { builder: b });
  // ── surgical lamp (the theatre's one cast light) + its field camera
  const lens = surgicalLamp(b, L);
  // ── laminar-flow canopy over the field (clear of the arm rail at x −1.7)
  b.detail(() => {
    b.bx(S, -1.2, 9.33, -55.2, 2.4, 9.4, -51.8);
    b.bx('plastic_dark', -1.1, 9.32, -55.1, 2.3, 9.325, -51.9);
    for (let i = 1; i < 9; i++) b.bx(S, -1.1 + i * 0.378, 9.31, -55.1, -1.08 + i * 0.378, 9.33, -51.9);
  });
  // ── instrument trolley at the table's foot, a vitals monitor on its pole at the head side
  b.push(1.85, 0, -55.25, 0.1);
  b.detail(() => {
    for (const x of [-0.32, 0.32]) for (const z of [-0.22, 0.22]) { b.rod(S, x, 0.08, z, x, 0.9, z, 0.012, 6); b.sphere('rubber', x, 0.04, z, 0.035, 6); }
    b.box(S, 0, 0.3, 0, 0.7, 0.02, 0.5);
    b.box(S, 0, 0.9, 0, 0.72, 0.025, 0.52);
    b.box(M.pad, 0, 0.915, 0, 0.6, 0.006, 0.42); // green-grey drape
    for (let i = 0; i < 5; i++) b.box('chrome', -0.2 + i * 0.09, 0.922, 0.05, 0.012, 0.008, 0.18);
    b.box('chrome', 0.2, 0.93, -0.1, 0.12, 0.02, 0.08); // gel applicator
  });
  b.pop();
  b.push(-3.3, 0, -51.6, 0.5);
  b.detail(() => {
    b.cyl(S, 0, 0.03, 0, 0.3, 0.04, 'y', 5);
    b.rod(S, 0, 0.05, 0, 0, 1.75, 0, 0.022, 8);
    b.box('plastic_dark', 0, 1.52, 0.06, 0.44, 0.34, 0.1);
  });
  b.pop();
  const vit = L.screen(null, 'vitals', 0.38, 0.27, -3.3 + Math.sin(0.5) * 0.112, 1.52, -51.6 + Math.cos(0.5) * 0.112, '+z');
  vit.rotation.y = 0.5;
  // ── floor: the sterile-field line round the table (four quads, no overlaps), a drain
  const f = { x0: -2.1, x1: 2.6, z0: -55.6, z1: -51.9, w: 0.06 };
  deckLine(b, L, f.x0, f.z0, f.x1, f.z0, { color: 'white', w: f.w });
  deckLine(b, L, f.x0, f.z1, f.x1, f.z1, { color: 'white', w: f.w });
  deckLine(b, L, f.x0 + f.w / 2, f.z0 + f.w / 2, f.x0 + f.w / 2, f.z1 - f.w / 2, { color: 'white', w: f.w });
  deckLine(b, L, f.x1 - f.w / 2, f.z0 + f.w / 2, f.x1 - f.w / 2, f.z1 - f.w / 2, { color: 'white', w: f.w });
  b.bx(S, 0.6, 0, -54.9, 0.9, 0.006, -54.6);
  // ── walls: stainless bumper rail at 0.9 round the room, cabinets and the gas panel on the west wall, the screen's
  //    bezel, a wall clock and the room sign on the south wall
  b.detail(() => {
    b.bx(S, -7.8, 0.85, -58.75, -7.76, 0.97, -47.25);
    b.bx(S, 7.76, 0.85, -58.75, 7.8, 0.97, -47.25);
    b.bx(S, -7.75, 0.85, -58.8, 4.8, 0.97, -58.76);
  });
  for (const z of [-49.4, -51.2, -55.8, -57.6]) {
    b.bx(S, -7.8, 1.0, z - 0.85, -7.35, 2.3, z + 0.85);
    b.bx('plastic_dark', -7.349, 1.06, z - 0.01, -7.346, 2.24, z + 0.01);
    b.bx(S, -7.344, 1.6, z - 0.12, -7.33, 1.7, z - 0.09).bx(S, -7.344, 1.6, z + 0.09, -7.33, 1.7, z + 0.12);
  }
  b.bx(S, -7.8, 1.3, -54.1, -7.72, 1.9, -52.9); // medical gas panel
  b.detail(() => {
    const cols = ['painted_white', 'painted_dark', 'painted_yellow', 'plastic_white'] as Mat[];
    cols.forEach((c, i) => b.cyl(c, -7.7, 1.6, -53.85 + i * 0.25, 0.04, 0.04, 'x', 10));
    b.sign('O₂ · 공기 · 진공 · N₂O', 'label', -7.718, 1.78, -53.5, 0.8, 0.07, '+x');
  });
  b.bx('plastic_dark', -2.1, 2.92, -58.8, 2.1, 4.48, -58.785); // theatre_screen bezel (screen at z −58.78)
  b.at(-3.6, 3.7, -58.8, 0, () => wallClock(b, 8, 41, 0.22));
  clinicalSign(b, L, '수술실 1', 3.6, 4.0, -58.79, 1.4, 0.24, '+z');
  // ── ceiling luminaires: OFF for the procedure (the field lamp is the light); one HEPA grid each side
  const offLum = lumMat(L, 'theatre_off', 0.04);
  for (const [x, z] of [[-5, -50], [-5, -57], [5, -50], [5, -57]] as const) b.at(x, 9.4, z, 0, () => luminaire(b, L, { glow: offLum }));
  bindTo(L, 'theatre', [[lens, 2.4]]);

  driveArm(L, arm);
  wisp(L, arm);
}

/** Cycle → screens + sounds (polled: cue changes, LED changes, attempt changes and time jumps all re-sync). */
function driveArm(L: LevelBuild, arm: THREE.Object3D) {
  const ud = arm.userData as { cycle: ArmCycle; cueTimes(): Record<ArmCue | 'period', number>; claspWorld(out?: THREE.Vector3): THREE.Vector3 };
  const cyc = ud.cycle;
  const fmt = (n: number) => n.toLocaleString('en-GB');
  // B3: the desk monitor sits under the bright gallery — its glossy face mirrored the bench and ceiling as a grey veil
  // over the nape picture. Matte the two theatre screens' reflection (the library re-applies env on every env change)
  {
    const mats = ['theatre_cam', 'theatre_screen'].map((n) => L.screens.get(n)).filter((m): m is THREE.MeshStandardMaterial => !!m);
    L.updaters.push(() => { for (const m of mats) if (m.envMapIntensity !== 0.08) m.envMapIntensity = 0.08; });
  }
  let parked = false;
  const machine = L.machines.get('theatre_arm');
  if (machine) L.machines.set('theatre_arm', (s) => { machine(s); parked = s === 'off'; });
  const setScr = (name: string, kind: 'theatre_cam' | 'terminal_idle' | 'terminal_alert', text: string) => {
    const m = L.screens.get(name);
    if (m) L.ctx.materials.setScreen(m, kind, { text });
  };
  const linkOf = (c: ArmCue) => (c === 'handshake' ? '핸드셰이크' : c === 'fail' || c === 'remove' || c === 'regel' || c === 'return' || c === 'idle' ? '실패' : '—');
  const wall = (c: ArmCue) => {
    if (parked) { setScr('theatre_screen', 'terminal_idle', '[plain]수술실 1 — 처치 없음\n암 주차됨'); return; }
    if (c === 'fail') { setScr('theatre_screen', 'terminal_alert', `[plain]링크 실패\n맥박 없음 — 시도 ${fmt(cyc.attempt)}`); return; }
    setScr('theatre_screen', 'terminal_idle', `[plain]수술실 1 — 피팅 31 — 시도 ${fmt(cyc.attempt)}\n호스트: 스트란드, E.\n맥박: 없음\n링크: ${linkOf(c)}\n대기열: 자동 — 오더 0031-H (수율)`);
  };
  const cam = () => {
    if (parked) { setScr('theatre_cam', 'theatre_cam', 'off'); return; }
    const at = ud.cueTimes()[cyc.cue] ?? 0;
    setScr('theatre_cam', 'theatre_cam', `${cyc.cue}|${Math.max(0, cyc.t - at).toFixed(2)}|${cyc.attempt}`);
  };
  let last = { cue: '', led: '', attempt: -1, t: -1, parked: false };
  // sounds (§8.5, SOUNDS.md): the level-1 servo loop pitched down while the arm moves, the collar's click as it seats
  // (sound's close at 0.14 s → cycle 9.26 for the seat at 9.4), the gel as the Clasp goes in (regel + 2.2 … 3.1)
  const MOVING: Record<ArmCue, number> = { approach: 1, fit: 0.6, handshake: 0, fail: 0, remove: 1, regel: 0.8, return: 1, idle: 0 };
  let servo: { setVolume(v: number, f?: number): void; setPosition(p: THREE.Vector3): void; stop(f?: number): void } | null = null;
  let servoVol = -1, posT = 0;
  const hub = new THREE.Vector3();
  L.updaters.push((dt) => {
    const t = cyc.t;
    const jumped = last.t >= 0 && !(t >= last.t && t - last.t < 0.5) && !(t < last.t && last.t - t > cyc.period - 1);
    if (cyc.cue !== last.cue || cyc.attempt !== last.attempt || parked !== last.parked) wall(cyc.cue);
    if (cyc.cue !== last.cue || cyc.led !== last.led || cyc.attempt !== last.attempt || parked !== last.parked || jumped) cam();
    const vis = L.isVisible('theatre');
    if (vis && !parked && !jumped && last.t >= 0) {
      const cross = (at: number) => (t >= last.t ? last.t < at && t >= at : last.t < at || t >= at);
      const ct = ud.cueTimes();
      const p = ud.claspWorld(hub);
      if (cross(9.26)) L.sfx('clasp_click', p.x, p.y, p.z, 0.9, 0.92);
      if (cross(ct.regel + 2.75)) L.sfx('gel_dip', -2.5, 0.95, -56.8, 0.9);
    }
    // servo loop: created the first time the theatre is drawn, silent while hidden / parked / holding
    const want = vis && !parked ? 0.32 * (MOVING[cyc.cue] ?? 0) : 0;
    if (!servo && vis && L.ctx.audio) {
      try { servo = L.ctx.audio.loop('arm_servo_loop', { position: V(-1.7, 6.5, -53.5), volume: 0, pitch: 0.62 }); } catch { servo = null; }
    }
    if (servo) {
      if (Math.abs(want - servoVol) > 1e-3) { servo.setVolume(want, 0.5); servoVol = want; }
      posT -= dt;
      if (vis && posT <= 0) { posT = 0.25; servo.setPosition(ud.claspWorld(hub).setY(Math.max(hub.y + 1.2, 2.5))); }
    }
    last = { cue: cyc.cue, led: cyc.led, attempt: cyc.attempt, t, parked };
  });
}

/** fx4_wisp (§2.9): two cold puffs off the gel as each fit seats; a bounded set drawn only with the theatre. */
function wisp(L: LevelBuild, arm: THREE.Object3D) {
  const fx = L.ctx.fx as FxSystemEx;
  if (!fx?.emitter) return;
  const box = new THREE.Box3(V(-1.5, 0.9, -55), V(1.5, 2.2, -52));
  const h = fx.emitter('steam', V(NAPE[0] + 0.02, NAPE[1] + 0.05, NAPE[2]), V(0.15, 1, 0), 12, { bounds: box, rooms: ['theatre'], id: 'fx4_wisp', speed: 0.05 });
  h.enabled = false;
  let off = 0;
  (arm.userData.onWisp as ((cb: (p: THREE.Vector3) => void) => void) | undefined)?.(() => { h.enabled = true; off = 0.16; });
  L.updaters.push((dt) => { if (off > 0) { off -= dt; if (off <= 0) h.enabled = false; } });
}

// ───────────────────────────────────────────────────────────── stair4 (§2.6: white → navy at mid-flight, Eng's trail)

/** Mid-flight: the paint line (z) where BIO-SYS ends and the naval level begins. */
const LINE_Z = -51.5;

function respirator(b: Builder, L: LevelBuild) {
  // half-face mask lying on its side, two pink P100 cartridges, the head harness splayed on the floor
  const pink = mat4(L, 'd2_p100', () => L.ctx.materials.clone('plastic_white', { color: 0xd16a8e, roughness: 0.6, map: null, normalMap: null }));
  b.detail(() => {
    b.sphere('rubber', 0, 0.06, 0, 0.075, 12, 0.75, 1.0, 0.9);
    b.box('plastic_dark', 0, 0.06, 0.07, 0.05, 0.05, 0.03);
    for (const s of [-1, 1]) {
      b.cyl(pink, s * 0.085, 0.045, 0.025, 0.045, 0.03, 'x', 14);
      b.cyl('plastic_white', s * 0.101, 0.045, 0.025, 0.03, 0.002, 'x', 12);
    }
    b.rod('rubber', -0.06, 0.006, -0.05, -0.18, 0.006, -0.22, 0.006, 4).rod('rubber', -0.18, 0.006, -0.22, 0.05, 0.006, -0.3, 0.006, 4);
    b.rod('rubber', 0.06, 0.006, -0.05, 0.14, 0.006, -0.25, 0.006, 4).rod('rubber', 0.14, 0.006, -0.25, 0.05, 0.006, -0.3, 0.006, 4);
  });
}

function buildStair(L: LevelBuild) {
  // the shell's grey steps go (their slope / under-mass colliders and the nav stair stay)
  restyle(L, 'stair4_grey', isStandin, null);
  const b = L.builder('stair4_dress');
  const { x0, x1, z0, risers, rise, tread } = STAIR4;
  const ix0 = x0 + 0.02, ix1 = x1 - 0.02;
  const white = labWhite(L);
  // ── steps: a painted body per step (white above the line, navy grey below), a steel tread plate, a nosing
  for (let k = 0; k < risers; k++) {
    const za = z0 + tread * k, zb = za + tread, top = rise * (k + 1);
    const navy = zb <= LINE_Z + 1e-6;
    b.bx(navy ? 'navy_grey' : white, ix0, 0, za, ix1, top - 0.02, zb);
    b.bx('floor_plate', ix0, top - 0.02, za, ix1, top, zb);
    b.bx(navy ? 'painted_yellow' : S, ix0, top - 0.035, za - 0.012, ix1, top + 0.004, za + 0.03);
  }
  // ── walls: naval grey cladding south of the line (1 cm off the walls), the line itself, the jurisdiction stencils
  const CL = 'navy_grey';
  b.bx(CL, 10.2, 0, -58.8, 10.21, 7.99, LINE_Z);
  b.bx(CL, 13.79, 0, -58.8, 13.8, 7.99, LINE_Z);
  // south wall round d4_stair_s's frame (x 12 ± 1.13, to y 2.75)
  b.bx(CL, 10.21, 0, -58.8, 10.85, 7.99, -58.79);
  b.bx(CL, 13.15, 0, -58.8, 13.79, 7.99, -58.79);
  b.bx(CL, 10.85, 2.78, -58.8, 13.15, 7.99, -58.79);
  for (const [x, face] of [[10.211, '+x'], [13.789, '-x']] as const) {
    b.bx('painted_dark', face === '+x' ? 10.21 : 13.786, 0, LINE_Z - 0.05, face === '+x' ? 10.214 : 13.79, 7.99, LINE_Z + 0.05);
    const sy = 0.15 + (rise / tread) * (LINE_Z - z0) + 1.5;
    b.sign('바이오시스 ┃ 해군', 'stencil', x + (face === '+x' ? 0.004 : -0.004), sy, LINE_Z, 1.3, 0.2, face);
  }
  stencil(b, '바이오시스 서비스층 — 해군 검문소 2 →', 12, 3.95, -58.784, 2.4, 0.2, '+z');
  clinicalSign(b, L, '서비스 계단 B — 서비스층으로 하행', 12.0, D2 + 2.35, -43.21, 2.0, 0.18, '-z');
  // ── handrails on both walls, 0.9 above the pitch line, 0.3 m level run-outs at both ends
  const k = rise / tread, pitch = (z: number) => rise / 2 + k * (z - z0);
  for (const xr of [10.27, 13.73]) {
    const zA = z0 - 0.3, zB = z0 + tread * risers + 0.3;
    const yA = pitch(z0) + 0.9, yB = pitch(z0 + tread * risers) + 0.9;
    b.rod('trim_steel', xr, yA, zA, xr, yA, z0, 0.022, 8);
    b.rod('trim_steel', xr, yA, z0, xr, yB, z0 + tread * risers, 0.022, 8);
    b.rod('trim_steel', xr, yB, z0 + tread * risers, xr, yB, zB, 0.022, 8);
    const wx = xr < 12 ? 10.21 : 13.79;
    for (let z = z0 + 0.4; z < z0 + tread * risers; z += 1.8) b.rod('trim_steel', xr, pitch(z) + 0.9, z, wx, pitch(z) + 0.84, z, 0.012, 6);
  }
  // ── landings: deck plate on the bottom landing (12 mm proud), wall lights on the stair lights
  b.bx('deck_nonslip', 10.22, 0, -58.3, 13.78, 0.012, z0 - 0.01); // (clear of the door's threshold + hazard band)
  const topLum = lumMat(L, 'stair_top', 0.3), botLum = lumMat(L, 'stair_bot', 0.3, 0xffe8cc);
  b.at(12, 8.0, -45.2, PI / 2, () => luminaire(b, L, { glow: topLum }));
  b.detail(() => {
    b.bx('navy_grey', 11.8, 3.3, -58.79, 12.2, 3.55, -58.62);
    b.bx(botLum, 11.83, 3.29, -58.77, 12.17, 3.3, -58.64);
    for (let i = 0; i < 3; i++) b.bx('steel_raw', 11.82 + i * 0.17, 3.27, -58.78, 11.84 + i * 0.17, 3.29, -58.63);
    // the flight's own bulkhead lamp on the east wall (the stair4 light at (13.45, 4.3, −53.8))
    b.bx('navy_grey', 13.62, 4.15, -54.0, 13.79, 4.45, -53.6);
    b.bx(botLum, 13.6, 4.18, -53.97, 13.62, 4.42, -53.63);
  });
  bindTo(L, 'stair4', [[topLum, 0.3], [botLum, 0.3]]);
  // ── Eng's trail (S6): a broken smear down the treads by the east rail, dragged hand at the foot, the respirator
  for (let s = risers - 2; s >= 1; s -= 1) {
    if (s % 3 === 1) continue;
    const zc = z0 + tread * (s + 0.5), top = rise * (s + 1);
    const x = 13.25 - (risers - s) * 0.012 + ((s * 7) % 5) * 0.02;
    b.decal('blood_smear', 0, x, top, zc + 0.05, 0.24 + (s % 3) * 0.06, 0.46, '+y', 0.2 + (s % 4) * 0.25); // (B9: wider — it read faint on the dark treads)
  }
  // his hand on the east wall below the rail, all the way down (white wall, then the naval grey)
  for (let z = z0 + tread * risers - 0.6; z > z0 + 0.3; z -= 1.15) {
    const wx = z < LINE_Z ? 13.786 : 13.796;
    b.decal('blood_smear', 0, wx, pitch(z) + 0.8 + ((z * 13) % 3) * 0.03, z, 0.5, 0.12, '-x', -0.49 + ((z * 7) % 2) * 0.1);
  }
  b.decal('handprint', 0, 13.786, 1.05, -56.35, 0.16, 0.22, '-x', 0.25);
  b.decal('blood_smear', 0, 12.2, 0.012, -56.6, 0.28, 0.5, '+y', 0.9);
  b.at(11.0, 0.012, -57.5, 2.2, () => respirator(b, L));
}

// ───────────────────────────────────────────────────────────── the table

export const SURGICAL_DRESS: Partial<Record<RoomId4, RoomDress>> = {
  scrub: {
    build: buildScrub,
    look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
    label: false,
    lights: [
      { group: 'scrub', type: 'point', p: [0, 7.55, -40], color: CLEAN, i: 6, d: 8 },
      { group: 'scrub', type: 'point', p: [-2, 7.55, -38.5], color: CLEAN, i: 3, d: 6, min: 'medium' },
      em('scrub', [3.3, 7.4, -42.5], 0.9, 6), // IB5b (B8): in the corner, off the room's probe (was at it: the IBL lit the room)
    ],
  },
  store4: {
    build: buildStore,
    look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
    label: false,
    // B7: no light of its own, but not a black hole either — the dim blue of the steriliser's standby panel low on
    // the south wall gives the shelves an edge for the flashlight to work from (prio low: loses its slot first)
    lights: [{ group: 'store4', type: 'point', p: [6.6, D2 + 0.9, -42.4], color: 0x7fa8ff, i: 0.5, d: 4, prio: 0.3 }],
  },
  gallery: {
    build: buildGallery,
    look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
    label: false,
    // dim by design (the glazing must read as a window onto a lit stage): one low point over the benches near the
    // path's middle, a second on HIGH over the west benches
    lights: [
      { group: 'gallery', type: 'point', p: [0.8, 7.55, -44.2], color: CLEAN, i: 4, d: 11 },
      { group: 'gallery', type: 'point', p: [-5, 7.55, -44.2], color: CLEAN, i: 3, d: 8, min: 'high' },
      em('gallery', [2.5, 7.55, -44.6], 1.4, 10),
    ],
  },
  theatre: {
    build: buildTheatre,
    look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
    label: false,
    lights: [
      // the field lamp: the theatre's light (cast on every quality, prio 2.0 — the flashlight is the other slot)
      { group: 'theatre', type: 'spot', p: [LAMP.x - 0.03, LAMP.y - 0.1, LAMP.z], t: [AIM.x, AIM.y, AIM.z], color: 0xf3f7ff, i: 15, d: 6.5, angle: 0.55, cast: true, prio: 2.0 },
      // a dim cold fill from the canopy: the bath, the bin, the gurneys and the walls as shapes
      { group: 'theatre', type: 'point', p: [-0.6, 7.0, -54.8], color: 0xbfd0e6, i: 9, d: 14 },
      { group: 'theatre', type: 'point', p: [-4.5, 5.0, -56], color: 0xbfd0e6, i: 3, d: 8, min: 'high' },
    ],
  },
  stair4: {
    build: buildStair,
    look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
    label: false,
    lights: [
      { group: 'stair4', type: 'point', p: [12, 7.7, -46.6], color: CLEAN, i: 10, d: 12 },
      { group: 'stair4', type: 'point', p: [13.45, 4.3, -53.8], color: NAVY, i: 11, d: 12 },
    ],
  },
};
