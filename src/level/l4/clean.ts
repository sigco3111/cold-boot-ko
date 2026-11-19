/**
 * BIOLOGICAL SYSTEMS — west, south and east of the clean loop (stage 3b §2.6, §2.7, §2.9, §8.11; task D1b): the
 * vivarium, Cold Store 2 (fog, breath, the jammed door), records & consent, the unit bay and the corridor legs
 * corr_w / corr_s / corr_e. Dressing only: rooms, doors, triggers, screens, interactables, markers, grille panels and
 * stand-in colliders are the greybox's (grey.ts); this file restyles / replaces stand-in visuals, adds props, lights,
 * fx, the vignettes `viv_vent`, `vent_s_a`, `vent_s_b`, `lights_out4` and the machine `cold_jam`.
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const CLEAN_DRESS: Partial<Record<RoomId4, RoomDress>>
 *
 * Look: white HPL, epoxy, stainless, black resin, glass; flush 6500 K luminaires bound to each room's first light (they
 * go out with it at lights-out); no warm light, no wood. Each corridor leg has its own landmarks so the 104 m loop
 * reads by position, lit and by flashlight:
 *   corr_w  — the held-open cold-store door: frost on the floor, fog spilling out, the cold-room controller (red
 *             −20 °C readout, amber DOOR OPEN beacon blinking), an LN2 dewar on its trolley; a green emergency
 *             shower + eyewash station opposite; the vivarium door.
 *   corr_s  — the surgical-suite door with its red/white HOLD line on the floor, the amber hold screen, two louvred
 *             ceiling vents, a parked transfer gurney and a sterile-supply cart.
 *   corr_e  — the Node 2 window (cyan, CHOIR's waveform), the dark unit-bay door with hazard hatching and the yellow
 *             SERVICE UNIT lane on the floor running to the corridor corner, a fire point (extinguishers, hose reel).
 *   every corner — a ceiling-hung double-faced clinical sign facing both approaches.
 *
 * Lights (§2.7, LOW = rows without `min`): corridor points 0.55 m under the ceiling (no hot spots); emergency points
 * at mid-height of the corridor (2.25 m) — their fittings (twin-head battery units with a green charge LED) are on the
 * walls; the red corner lights (medium+) have a fitting whose lens follows the cold emergency light (so LOW still shows
 * a red lamp, emissive only). After `lights_out4`: floor strips both sides of every corridor and lab aisle (§8.11).
 *
 * lights_out4 (§4.3) works on the plan's group NAMES only (`LIGHTS_OUT4` in grey.ts: every Deck-2 group but theatre,
 * node2, lock4, and their `<room>_emerg` groups): every handle of a dark group fades in a wave from (−6, −29) at
 * 0.04 s/m over 1.5 s with a short stutter, then is disabled; each room's `<room>_emerg` group comes on 0.35 s after its
 * own lights die (flicker-start); the shared strip material ramps on. Fixtures bound with `bindEmissive` (any room's
 * dressing) follow their lights. Checkpoint restore: `L.settle` runs the tweens to the end silently.
 *
 * Decisions the plan did not spell out are listed in the task report (D1b).
 */
import * as THREE from 'three';
import { rng, type Builder, type Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { LightHandle } from '../../core/types';
import type { FxSystemEx } from '../../fx';
import { isStandin, restyle } from '../l3/kit3';
import { placeLights, type LightRow, type Look } from '../l3/grey';
import { D2, LIGHTS_OUT4, type RoomId4 } from './grey';
import type { RoomDress } from './index';
import {
  binderBlue, clinicalSign, cradleRack, filingWall, hepaDiffuser, labWhite, luminaire, mat4, penRow,
  sampleRack, setStrips, sticker, stripMat, ultFreezer,
} from './kit4';
import { body, claspInst, defineClaspInstances } from './setpieces';

const PI = Math.PI;
const Y = D2;
const CLEAN = 0xeef4ff, COLDW = 0xdff0ff, EMERG = 0x9ec4ff, RED = 0xff3020;
const LOOK: Partial<Look> = { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const B3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(V(x0, y0, z0), V(x1, y1, z1));
const FACE_RY: Record<'+x' | '-x' | '+z' | '-z', number> = { '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 };

// ───────────────────────────────────────────────────────────── materials

/** A flat paint (no maps), cached per key. */
function paintD(L: LevelBuild, key: string, color: number, rough = 0.5, metal = 0): THREE.MeshStandardMaterial {
  return mat4(L, `d1b_${key}`, () => L.ctx.materials.clone('painted_white', {
    color, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: rough, metalness: metal,
  }));
}
/** Thin floor overlays (paint, frost): polygon offset so they always win against the floor they lie on. */
function floorPaint(L: LevelBuild, key: string, src: 'painted_white' | 'frost' | 'hazard_stripes', o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return mat4(L, `d1b_fp_${key}`, () => L.ctx.materials.clone(src, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...o }));
}
/** Irregular frost crust on a floor (soft-edged textured quad, flat at y = Y + 3 mm); `v` picks one of 4 variants. */
function frostPatch(b: Builder, L: LevelBuild, x: number, z: number, w: number, d: number, rot: number, v: number, lift = 0) {
  const k = ((v % 2) + 2) % 2;
  const m = mat4(L, `d1b_frostpatch_${k}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const R = rng(900 + k);
    for (let i = 0; i < 90; i++) {
      const px = 128 + R.range(-90, 90) * (0.4 + R() * 0.6), py = 128 + R.range(-90, 90) * (0.4 + R() * 0.6), r = R.range(14, 46);
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, 'rgba(236,244,255,0.42)'); gr.addColorStop(1, 'rgba(236,244,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      const px = 128 + R.range(-80, 80), py = 128 + R.range(-80, 80), a = R.range(0, PI), l = R.range(3, 11);
      if (Math.hypot(px - 128, py - 128) > 95) continue;
      g.beginPath(); g.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return L.ctx.materials.clone('plastic_white', {
      map: t, color: 0xffffff, normalMap: null, roughnessMap: null, aoMap: null, roughness: 0.55, metalness: 0,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
  });
  b.detail(() => b.quad(m, x, Y, z, w, d, '+y', rot, 'unit', 0.003 + lift));
}
/** A private emissive kept in sync with a light (its base glow × the light's factor). */
function boundGlow(L: LevelBuild, key: string, h: LightHandle | undefined, color: number, base: number, albedo = 0xdfe6ee): THREE.MeshStandardMaterial {
  const m = mat4(L, `d1b_glow_${key}`, () => {
    const g = L.ctx.materials.clone('emissive_white', { color: albedo });
    g.emissive = new THREE.Color(color);
    g.emissiveIntensity = base;
    return g;
  });
  h?.bindEmissive(m, base);
  return m;
}
/** Canvas-texture material (cached per key). */
function canvasMatD(L: LevelBuild, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, emissive = false): THREE.MeshStandardMaterial {
  return mat4(L, `d1b_cv_${key}`, () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const m = L.ctx.materials.clone(emissive ? 'emissive_white' : 'plastic_white', {
      map: t, color: 0xffffff, normalMap: null, roughnessMap: null, aoMap: null, roughness: 0.5, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    if (emissive) { m.emissiveMap = t; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.55; }
    return m;
  });
}

// ───────────────────────────────────────────────────────────── small helpers

/** Wall prop at a world point on a wall face (`face` = the face's outward normal). */
function onWall(b: Builder, face: '+x' | '-x' | '+z' | '-z', x: number, y: number, z: number, fn: () => void) { b.at(x, y, z, FACE_RY[face], fn); }

/** Lights through the manager (§2.7 rows); returns the handles in row order. */
const lightsOf = (L: LevelBuild, rows: LightRow[]) => placeLights(L, rows);

/**
 * PVC crash rail (clean corridors): a 140 mm pale blue-grey profile on stainless stand-offs, end caps. Wall prop in local
 * frame: runs along local x from u0 to u1 on the wall face (z 0 → 0.05).
 */
function crashRail(b: Builder, L: LevelBuild, u0: number, u1: number) {
  if (u1 - u0 < 0.3) return;
  const P: Mat = 'plastic_white';
  b.bx(P, u0, 0.86, 0.02, u1, 1.0, 0.055);
  b.detail(() => {
    b.bx(P, u0 - 0.015, 0.855, 0.0, u0, 1.005, 0.058).bx(P, u1, 0.855, 0.0, u1 + 0.015, 1.005, 0.058);
    for (let u = u0 + 0.2; u < u1 - 0.1; u += 1.2) b.bx('stainless', u - 0.03, 0.9, 0.0, u + 0.03, 0.96, 0.02);
  });
}
/** Silicone-coved stainless kick plate at the wall base (local frame, u0 … u1). */
function kickPlate(b: Builder, u0: number, u1: number) {
  if (u1 - u0 < 0.2) return;
  b.detail(() => b.bx('stainless', u0, 0, 0.0, u1, 0.1, 0.006));
}

/** Corridor run of rails + kick plates on a wall face along world z (face ±x) or x (face ±z), skipping `gaps`. */
function wallRun(b: Builder, L: LevelBuild, face: '+x' | '-x' | '+z' | '-z', plane: number, a: number, c: number, gaps: [number, number][], rail = true) {
  const segs: [number, number][] = [];
  let s = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }
  if (c > s) segs.push([s, c]);
  for (const [s0, s1] of segs) {
    // local x of a wall prop: face +z → +x world; −z → −x; +x → −z; −x → +z
    const sign = face === '+z' || face === '-x' ? 1 : -1;
    const u0 = Math.min(sign * s0, sign * s1), u1 = Math.max(sign * s0, sign * s1);
    if (face === '+x' || face === '-x') b.at(plane, Y, 0, FACE_RY[face], () => { if (rail) crashRail(b, L, u0, u1); kickPlate(b, u0, u1); });
    else b.at(0, Y, plane, FACE_RY[face], () => { if (rail) crashRail(b, L, u0, u1); kickPlate(b, u0, u1); });
  }
}

/**
 * Emergency floor strip (§8.11) on the shared `stripMat` lens (0x6fa8ff, 1.2 after `setStrips`): a 4 cm lens between
 * two 1 cm aluminium side rails (no coplanar overlap with the rails, unlike kit4's channel-under-lens build).
 */
function floorStripD(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.05) return;
  const ry = Math.atan2(bx - ax, bz - az), M = stripMat(L);
  b.push((ax + bx) / 2, Y, (az + bz) / 2, ry);
  b.detail(() => {
    b.bx('stainless', -0.03, 0, -len / 2, -0.02, 0.009, len / 2).bx('stainless', 0.02, 0, -len / 2, 0.03, 0.009, len / 2);
    b.bx(M, -0.02, 0, -len / 2 + 0.01, 0.02, 0.007, len / 2 - 0.01);
  });
  b.pop();
}
/** Floor strips along a line at fixed x (from z0 to z1) or fixed z (x0 to x1), skipping `gaps`. */
function stripRun(b: Builder, L: LevelBuild, axis: 'x' | 'z', fixed: number, a: number, c: number, gaps: [number, number][] = []) {
  let s = a;
  const put = (p: number, q: number) => { if (q - p < 0.1) return; if (axis === 'z') floorStripD(b, L, fixed, p, fixed, q); else floorStripD(b, L, p, fixed, q, fixed); };
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) put(s, g0); s = Math.max(s, g1); }
  if (c > s) put(s, c);
}

/** Ceiling-hung double-faced clinical sign (two hanger rods), centre (x, y, z), faces ±z (axis 'z') or ±x (axis 'x'). */
function hangingSign(b: Builder, L: LevelBuild, x: number, yCeil: number, z: number, axis: 'x' | 'z', front: string, back: string, w = 1.5, h = 0.24) {
  const y = yCeil - 0.42;
  b.push(x, y, z, axis === 'z' ? 0 : PI / 2);
  b.bx('stainless', -w / 2 - 0.02, -h / 2 - 0.02, -0.012, w / 2 + 0.02, h / 2 + 0.02, 0.012);
  b.detail(() => {
    b.sign(front, 'clinical', 0, 0, 0.0125, w, h, '+z');
    b.sign(back, 'clinical', 0, 0, -0.0125, w, h, '-z');
    for (const s of [-1, 1]) b.rod('stainless', s * (w / 2 - 0.1), h / 2 + 0.02, 0, s * (w / 2 - 0.1), 0.42, 0, 0.004, 4);
  });
  b.pop();
  void L;
}

/**
 * Twin-head battery emergency luminaire (wall prop, local frame): white housing 0.38 × 0.12, two adjustable lamp heads
 * (lenses = `lens`, bound to the emergency light), a green charge LED (always on: battery), a test button.
 */
function emergUnit(b: Builder, L: LevelBuild, lens: Mat) {
  const W: Mat = 'plastic_white';
  b.bx(W, -0.19, -0.06, 0, 0.19, 0.06, 0.08);
  b.detail(() => {
    for (const s of [-1, 1]) {
      b.cyl(W, s * 0.13, -0.085, 0.09, 0.045, 0.07, 'z', 12);
      b.bx('plastic_dark', s * 0.13 - 0.012, -0.07, 0.05, s * 0.13 + 0.012, -0.06, 0.08);
      b.cyl(lens, s * 0.13, -0.085, 0.126, 0.036, 0.004, 'z', 12);
    }
    b.bx(mat4(L, 'd1b_led_green', () => { const m = L.ctx.materials.clone('emissive_green'); m.emissiveIntensity = 1.4; return m; }), -0.03, 0.025, 0.08, -0.015, 0.04, 0.083);
    b.bx('plastic_dark', 0.01, 0.022, 0.08, 0.04, 0.042, 0.084);
  });
}
/** Red corner emergency lamp (wall prop): a domed red lens on a short bracket. */
function redLamp(b: Builder, lens: Mat) {
  b.bx('plastic_white', -0.09, -0.09, 0, 0.09, 0.09, 0.05);
  b.detail(() => { b.cyl(lens, 0, 0, 0.09, 0.07, 0.08, 'z', 14, 0.05); b.cyl('stainless', 0, 0, 0.055, 0.078, 0.012, 'z', 14); });
}

/** Restyle a greybox grille panel (L.objects id) as a stainless louvred vent face; dark duct liner in its void. */
function dressVent(b: Builder, L: LevelBuild, id: string, x0: number, z0: number, x1: number, z1: number, yCeil: number) {
  const g = L.objects.get(id);
  const grille = mat4(L, 'd1b_vent_grille', () => L.ctx.materials.clone('floor_grate', { side: THREE.FrontSide, color: 0xc9ced2 }));
  g?.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = grille; });
  const K: Mat = 'plastic_dark';
  const e = 0.012, top = yCeil + 0.98;
  b.detail(() => {
    // duct liner (inside the 1 m void, 12 mm off its faces)
    b.bx(K, x0 + e, yCeil + 0.07, z0 + e, x0 + e + 0.01, top, z1 - e).bx(K, x1 - e - 0.01, yCeil + 0.07, z0 + e, x1 - e, top, z1 - e);
    b.bx(K, x0 + e + 0.01, yCeil + 0.07, z0 + e, x1 - e - 0.01, top, z0 + e + 0.01).bx(K, x0 + e + 0.01, yCeil + 0.07, z1 - e - 0.01, x1 - e - 0.01, top, z1 - e);
    b.bx(K, x0 + e, top, z0 + e, x1 - e, top + 0.01, z1 - e);
    // stainless trim frame on the ceiling round the opening
    const f = 0.06, t = 0.014;
    b.bx('stainless', x0 - f, yCeil - t, z0 - f, x1 + f, yCeil, z0).bx('stainless', x0 - f, yCeil - t, z1, x1 + f, yCeil, z1 + f);
    b.bx('stainless', x0 - f, yCeil - t, z0, x0, yCeil, z1).bx('stainless', x1, yCeil - t, z0, x1 + f, yCeil, z1);
  });
}

/** Ceiling grid of flush luminaires (long axis along `axis`), every `step` from a to c at the fixed coordinate. */
function lumRow(b: Builder, L: LevelBuild, glow: Mat, axis: 'x' | 'z', fixed: number, yCeil: number, a: number, c: number, step: number, skip: (p: number) => boolean = () => false) {
  for (let p = a; p <= c + 1e-6; p += step) {
    if (skip(p)) continue;
    if (axis === 'x') b.at(p, yCeil, fixed, 0, () => luminaire(b, L, { glow }));
    else b.at(fixed, yCeil, p, PI / 2, () => luminaire(b, L, { glow }));
  }
}

// ───────────────────────────────────────────────────────────── corridor props

/** Emergency shower + eyewash station (wall prop, local frame, origin on the floor at the wall). */
function safetyShower(b: Builder, L: LevelBuild) {
  const G = paintD(L, 'safety_green', 0x1f9a54, 0.45), Yl = paintD(L, 'safety_yellow', 0xe7c21a, 0.5);
  // riser pipe, head, pull rod with a triangle handle
  b.rod(G, 0.0, 0.0, 0.07, 0.0, 2.75, 0.07, 0.024, 10);
  b.rod(G, 0.0, 2.6, 0.07, 0.0, 2.6, 0.55, 0.02, 8);
  b.cyl(G, 0.0, 2.52, 0.6, 0.13, 0.08, 'y', 18, 0.04);
  b.detail(() => {
    b.rod('stainless', 0.0, 2.6, 0.3, 0.0, 1.95, 0.3, 0.006, 4);
    b.rod(Yl, -0.09, 1.82, 0.3, 0.09, 1.82, 0.3, 0.012, 5).rod(Yl, -0.09, 1.82, 0.3, 0.0, 1.97, 0.3, 0.012, 5).rod(Yl, 0.09, 1.82, 0.3, 0.0, 1.97, 0.3, 0.012, 5);
    for (const y of [0.25, 2.2]) b.bx('stainless', -0.04, y - 0.03, 0.0, 0.04, y + 0.03, 0.08);
  });
  // eyewash bowl on an arm at 1.0, push flag
  b.rod(G, 0.0, 1.0, 0.07, 0.0, 1.0, 0.3, 0.016, 8);
  b.cyl('stainless', 0.0, 1.02, 0.36, 0.14, 0.06, 'y', 18, 0.18);
  b.detail(() => {
    for (const s of [-1, 1]) b.cyl(G, s * 0.04, 1.07, 0.36, 0.015, 0.03, 'y', 8);
    b.bx(Yl, 0.13, 0.92, 0.2, 0.2, 1.0, 0.24);
  });
  // floor: a grated drain with the green square painted round it
  b.detail(() => { b.bx(floorPaint(L, 'safety_sq', 'painted_white', { color: 0x1f9a54, map: null, normalMap: null }), -0.6, 0.0, 0.02, 0.6, 0.003, 1.2); b.bx('stainless', -0.15, 0.0, 0.5, 0.15, 0.005, 0.8); });
  b.sign('비상 샤워 · 세안기', 'clinical', 0, 2.95, 0.004, 0.9, 0.12, '+z', 0);
  b.collide(-0.05, 0, 0, 0.05, 2.75, 0.12, 'metal', true);
}

/** LN2 dewar on a wheeled trolley (floor prop, centre). Collider. */
function dewarTrolley(b: Builder, L: LevelBuild) {
  const S: Mat = 'stainless';
  b.bx(S, -0.26, 0.08, -0.26, 0.26, 0.11, 0.26);
  b.detail(() => { for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]] as const) b.cyl('plastic_dark', x, 0.045, z, 0.045, 0.03, 'x', 10); });
  b.rod(S, -0.24, 0.11, -0.24, -0.24, 0.95, -0.24, 0.012, 6).rod(S, 0.24, 0.11, -0.24, 0.24, 0.95, -0.24, 0.012, 6).rod(S, -0.24, 0.95, -0.24, 0.24, 0.95, -0.24, 0.012, 6);
  b.cyl(S, 0, 0.11, 0, 0.22, 0.72, 'y', 20);
  b.cyl(S, 0, 0.83, 0, 0.22, 0.08, 'y', 20, 0.12);
  b.detail(() => {
    b.cyl('stainless', 0, 0.91, 0, 0.05, 0.06, 'y', 10);
    b.cyl('plastic_dark', 0.0, 0.97, 0, 0.03, 0.03, 'y', 8);
    b.rod('stainless', 0.05, 0.94, 0, 0.16, 0.94, 0.0, 0.01, 6);
    b.cyl('stainless', 0.0, 0.97, 0.06, 0.03, 0.02, 'z', 10);
    b.sign('LN₂ — 극저온', 'warning', 0, 0.55, 0.222, 0.3, 0.1, '+z');
  });
  b.collide(-0.27, 0, -0.27, 0.27, 1.0, 0.27, 'metal', true);
  void L;
}

/** Cold-room controller (wall prop): grey box, red −20 °C readout, alarm keypad, an amber DOOR OPEN lamp above. */
function coldController(b: Builder, L: LevelBuild, lamp: Mat) {
  const readout = canvasMatD(L, 'cold_readout', 256, 128, (g, W, H) => {
    g.fillStyle = '#0b0606'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff3a26'; g.font = '700 64px "Courier New", monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText('-20.4', W - 50, H / 2 + 12);
    g.font = '700 26px Arial'; g.fillText('°C', W - 14, H / 2 - 14);
    g.fillStyle = '#ffb030'; g.font = '700 18px Arial'; g.textAlign = 'left'; g.fillText('문 열림', 10, 22);
  }, true);
  b.bx('plastic_white', -0.17, -0.22, 0, 0.17, 0.22, 0.07);
  b.detail(() => {
    b.quad(readout, 0, 0.1, 0.0705, 0.24, 0.12, '+z');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.bx('plastic_dark', -0.09 + c * 0.065, -0.17 + r * 0.05, 0.07, -0.045 + c * 0.065, -0.135 + r * 0.05, 0.078);
    b.sign('냉장고 2', 'clinical', 0, 0.265, 0.004, 0.32, 0.06, '+z', 0);
    // the alarm beacon above (amber dome on a base)
    b.cyl('plastic_dark', 0.3, 0.62, 0.035, 0.06, 0.04, 'z', 14);
    b.cyl(lamp, 0.3, 0.62, 0.075, 0.05, 0.06, 'z', 14, 0.035);
    b.rod('plastic_dark', 0.17, 0.1, 0.03, 0.3, 0.56, 0.03, 0.006, 4);
  });
}

/** Wall-mounted fire point: two extinguishers on brackets, a hose-reel cabinet, a sign (local frame). */
function firePoint(b: Builder, L: LevelBuild) {
  const R = paintD(L, 'fire_red', 0xb11d17, 0.4);
  b.bx(R, -0.35, 0.95, 0, 0.35, 1.75, 0.22);
  b.detail(() => {
    b.torus('plastic_dark', 0, 1.35, 0.27, 0.2, 0.04, 'z', 18);
    b.cyl('stainless', 0, 1.35, 0.24, 0.05, 0.08, 'z', 10);
    b.sign('소화 호스', 'clinical', 0, 1.85, 0.004, 0.5, 0.1, '+z', 0);
  });
  for (const x of [-0.6, 0.6]) {
    b.cyl(R, x, 0.12, 0.12, 0.08, 0.55, 'y', 14);
    b.detail(() => {
      b.cyl('plastic_dark', x, 0.67, 0.12, 0.025, 0.06, 'y', 8);
      b.rod('plastic_dark', x, 0.72, 0.12, x + 0.08, 0.6, 0.18, 0.01, 4);
      b.bx('stainless', x - 0.05, 0.48, 0.0, x + 0.05, 0.54, 0.05);
    });
  }
  b.collide(-0.7, 0, 0, 0.7, 1.75, 0.22, 'metal', true);
}

/** Wall-mounted glove / sanitiser station (local frame). */
function gloveStation(b: Builder, L: LevelBuild) {
  b.bx('stainless', -0.32, 1.1, 0, 0.32, 1.42, 0.1);
  b.detail(() => {
    const cols = [0x3c6fd8, 0x7a4bd0, 0x2f9c8a];
    for (let i = 0; i < 3; i++) {
      const x = -0.21 + i * 0.21;
      b.bx('plastic_white', x - 0.095, 1.14, 0.1, x + 0.095, 1.38, 0.105);
      b.bx(paintD(L, 'glove', cols[0], 0.55), x - 0.04, 1.33, 0.102, x + 0.04, 1.36, 0.112);
    }
    b.bx('plastic_white', -0.06, 1.55, 0, 0.06, 1.8, 0.1);
    b.bx('plastic_dark', -0.02, 1.53, 0.07, 0.02, 1.56, 0.1);
  });
}

/** Stainless instrument / supply trolley (floor prop, centre): three shelves, push handle, castors. */
function supplyCart(b: Builder, L: LevelBuild, R: ReturnType<typeof rng>, w = 0.9, d = 0.5) {
  const S: Mat = 'stainless';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(S, sx * (w / 2 - 0.02), 0.1, sz * (d / 2 - 0.02), sx * (w / 2 - 0.02), 1.0, sz * (d / 2 - 0.02), 0.012, 6);
  for (const y of [0.18, 0.55, 0.92]) b.bx(S, -w / 2, y, -d / 2, w / 2, y + 0.02, d / 2);
  b.detail(() => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('plastic_dark', sx * (w / 2 - 0.05), 0.05, sz * (d / 2 - 0.05), 0.05, 0.03, 'x', 10);
    b.rod(S, -w / 2 - 0.05, 0.95, -d / 2 + 0.06, -w / 2 - 0.05, 0.95, d / 2 - 0.06, 0.012, 6);
    // sterile packs (blue wrap) and boxed gloves
    const blue = paintD(L, 'mattress', 0x4d6e86, 0.7);
    for (let i = 0; i < 6; i++) b.rbox(blue, -w / 2 + 0.12 + (i % 3) * 0.26, 0.6 + Math.floor(i / 3) * 0.045, R.range(-0.08, 0.08), 0.22, 0.04, 0.3, 0, R.range(-0.1, 0.1), 0);
    for (let i = 0; i < 3; i++) b.box('plastic_white', -0.3 + i * 0.3, 0.255, 0, 0.25, 0.13, 0.13);
  });
  b.collide(-w / 2 - 0.06, 0, -d / 2, w / 2, 1.0, d / 2, 'metal', true);
}

/** Patient transfer trolley parked (floor prop, centre, long axis x): frame, mattress, rails up. */
function gurney(b: Builder, L: LevelBuild) {
  const S: Mat = 'stainless', M = paintD(L, 'mattress', 0x4d6e86, 0.7);
  b.bx(S, -0.95, 0.55, -0.32, 0.95, 0.6, 0.32);
  b.bx(M, -0.93, 0.6, -0.3, 0.93, 0.7, 0.3);
  b.bx('plastic_white', -0.75, 0.15, -0.25, 0.75, 0.3, 0.25);
  b.detail(() => {
    for (const x of [-0.8, 0.8]) for (const z of [-0.24, 0.24]) b.rod(S, x, 0.1, z, x, 0.55, z, 0.016, 6);
    for (const x of [-0.8, 0.8]) for (const z of [-0.24, 0.24]) b.cyl('plastic_dark', x, 0.06, z, 0.06, 0.04, 'z', 10);
    for (const z of [-0.33, 0.33]) { b.rod(S, -0.7, 0.92, z, 0.7, 0.92, z, 0.012, 6); for (const x of [-0.6, 0, 0.6]) b.rod(S, x, 0.6, z, x, 0.92, z, 0.008, 4); }
    b.bx('plastic_white', -0.4, 0.7, -0.28, 0.6, 0.715, 0.28);
    b.rod(S, 0.95, 0.75, -0.25, 0.95, 0.75, 0.25, 0.014, 6);
  });
  b.collide(-0.98, 0, -0.35, 0.98, 0.95, 0.35, 'metal', true);
}

/** Unit charging dock (wall prop, local frame): back plate, contact arms, floor footplate, a dark standby lamp. */
function chargingDock(b: Builder, L: LevelBuild, led: Mat) {
  const K = paintD(L, 'dock_dark', 0x2a2e33, 0.55, 0.2), S: Mat = 'stainless';
  b.bx(K, -0.45, 0.0, 0, 0.45, 2.3, 0.12);
  b.bx(S, -0.55, 0.0, 0.0, 0.55, 0.04, 1.1);
  b.detail(() => {
    b.bx('hazard_stripes', -0.55, 0.04, 0.95, 0.55, 0.045, 1.1);
    for (const s of [-1, 1]) {
      b.bx(K, s * 0.3 - 0.04, 1.1, 0.12, s * 0.3 + 0.04, 1.2, 0.42);
      b.bx('stainless', s * 0.3 - 0.03, 1.12, 0.42, s * 0.3 + 0.03, 1.18, 0.45);
    }
    b.bx(K, -0.2, 1.75, 0.12, 0.2, 1.85, 0.3);
    b.bx(led, -0.05, 2.12, 0.12, 0.05, 2.17, 0.13);
    b.rod('plastic_dark', 0.38, 2.3, 0.06, 0.38, 0.6, 0.06, 0.018, 6);
    b.cyl('plastic_dark', 0.38, 0.6, 0.06, 0.03, 0.08, 'y', 8);
  });
  b.collide(-0.45, 0, 0, 0.45, 2.3, 0.45, 'metal', true);
}

/** Ceiling cable reel (ceiling prop, origin on the ceiling). */
function cableReel(b: Builder, L: LevelBuild) {
  const K = paintD(L, 'reel_yellow', 0xcaa520, 0.5);
  b.bx('stainless', -0.12, -0.08, -0.06, 0.12, 0, 0.06);
  b.cyl(K, 0, -0.25, 0, 0.17, 0.16, 'x', 18);
  b.detail(() => { b.rod('plastic_dark', 0, -0.42, 0.0, 0.0, -1.1, 0.02, 0.012, 6); b.cyl('plastic_dark', 0, -1.15, 0.02, 0.03, 0.1, 'y', 8); });
}

/** Stacking chair (floor prop, faces +z). No collider. */
function labChairD(b: Builder, L: LevelBuild) {
  const P: Mat = 'plastic_dark';
  b.bx(P, -0.22, 0.44, -0.2, 0.22, 0.47, 0.22);
  b.bx(P, -0.22, 0.5, -0.24, 0.22, 0.86, -0.21);
  b.detail(() => {
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) b.rod('stainless', x, 0, z, x, 0.44, z, 0.01, 5);
    for (const x of [-0.2, 0.2]) b.rod('stainless', x, 0.44, -0.22, x, 0.86, -0.22, 0.009, 5);
  });
}

/** Wire rack / lab trolley of stacked Bio forms (floor prop) — archive trolley in records. */
function archiveTrolley(b: Builder, L: LevelBuild, R: ReturnType<typeof rng>) {
  const S: Mat = 'stainless', Bl = binderBlue(L);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(S, sx * 0.43, 0.1, sz * 0.23, sx * 0.43, 1.0, sz * 0.23, 0.01, 5);
  for (const y of [0.15, 0.55, 0.95]) b.bx(S, -0.45, y, -0.25, 0.45, y + 0.015, 0.25);
  b.detail(() => {
    for (const y of [0.165, 0.565]) for (let i = 0; i < 6; i++) if (R.chance(0.85)) b.box(i % 2 ? Bl : 'plastic_white', -0.36 + i * 0.145, y + 0.13, R.range(-0.04, 0.04), 0.13, 0.26, 0.38);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('plastic_dark', sx * 0.4, 0.05, sz * 0.2, 0.05, 0.03, 'x', 10);
  });
  b.collide(-0.46, 0, -0.26, 0.46, 1.0, 0.26, 'metal', true);
}

/** Paper stack (floor of a tray / table): `n` sheets offset (local, on a surface at y). */
function papers(b: Builder, L: LevelBuild, x: number, y: number, z: number, n: number, R: ReturnType<typeof rng>, ry = 0) {
  const P = mat4(L, 'd1b_paper', () => L.ctx.materials.clone('plastic_white', { color: 0xf3f4f1, roughness: 0.9, map: null, normalMap: null, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  b.detail(() => { for (let i = 0; i < n; i++) b.rbox(P, x + R.range(-0.01, 0.01), y + 0.002 + i * 0.0025, z + R.range(-0.01, 0.01), 0.21, 0.002, 0.297, 0, ry + R.range(-0.08, 0.08), 0); });
}

// ───────────────────────────────────────────────────────────── corridors

function corrLights(L: LevelBuild, room: string, pts: [number, number, number][], high: [number, number, number], emerg: [number, number, number], red: [number, number, number]) {
  const rows: LightRow[] = [
    ...pts.map((p): LightRow => ({ group: room, type: 'point', p, color: CLEAN, i: 9, d: 12 })),
    { group: room, type: 'point', p: high, color: CLEAN, i: 6, d: 8, min: 'high' },
    { group: `${room}_emerg`, type: 'point', p: emerg, color: EMERG, i: 1.3, d: 8, off: true }, // (B7: a pool round the unit, dark between — a blackout, not a blue-lit corridor)
    // (D1b: all qualities, lowest priority — it loses its slot first; on LOW it keeps the corridor corners from going black)
    { group: `${room}_emerg`, type: 'point', p: red, color: RED, i: 0.9, d: 4.5, off: true, prio: 0.15 }, // (B7: was a red wash over the corner walls)
  ];
  const hs = lightsOf(L, rows);
  return { main: hs[0], emerg: hs[pts.length + 1] };
}

const corr_w: RoomDress = {
  label: false,
  look: LOOK,
  lights: [],
  build(L) {
    const b = L.builder('corr_w_dress');
    const R = rng(4101);
    const H = Y + 3.0;
    const { main, emerg } = corrLights(L, 'corr_w', [[-13.5, H - 0.55, -16], [-13.5, H - 0.55, -30]], [-13.5, H - 0.55, -23], [-13.5, Y + 2.45, -24.5], [-14.3, Y + 2.4, -33.2]);
    const lum = boundGlow(L, 'lum_corr_w', main, 0xe8f0ff, 0.38);
    const eLens = boundGlow(L, 'elens_corr_w', emerg, 0xcfe2ff, 2.2);
    const rLens = boundGlow(L, 'rlens_corr_w', emerg, 0xff2a18, 1.6, 0xb02018);
    lumRow(b, L, lum, 'z', -13.5, H, -32.5, -14.5, 3.0);
    for (const z of [-16.0, -22.0, -28.0]) b.at(-13.5, H, z, 0, () => hepaDiffuser(b, L));
    // emergency units on the west wall facing the corridor, red lamp in the south-west corner
    onWall(b, '+x', -14.8, Y + 2.35, -24.5, () => emergUnit(b, L, eLens));
    onWall(b, '+x', -14.8, Y + 2.4, -33.2, () => redLamp(b, rLens));
    // rails, kick plates, floor strips (gaps at the doors: frames span ±1.1)
    wallRun(b, L, '+x', -14.8, -33.8, -12.2, [[-23.2, -20.8], [-27.3, -25.7]]);
    wallRun(b, L, '-x', -12.2, -33.8, -12.2, [[-30.15, -27.85], [-19.15, -16.85]]);
    stripRun(b, L, 'z', -14.72, -34.0, -12.2, [[-23.15, -20.85]]);
    stripRun(b, L, 'z', -12.28, -34.28, -12.2, [[-30.15, -27.85], [-19.15, -16.85]]);
    // corners: ceiling-hung signs facing both approaches
    hangingSign(b, L, -13.5, H, -13.0, 'z', '냉장고 2 · 생물사육실 · 습식 실험실 1 ↓', '청정 복도 — 북측 ↑', 1.9, 0.22);
    hangingSign(b, L, -13.5, H, -33.0, 'z', '수술 구역 · 기록실 ↓', '냉장고 2 · 생물사육실 ↑', 1.9, 0.22);
    // ── the held-open cold-store door (east wall, z −29): controller + beacon north of it, frost on the floor
    const beacon = mat4(L, 'd1b_cold_beacon', () => { const m = L.ctx.materials.clone('emissive_amber', { color: 0xffb040 }); m.emissiveIntensity = 0.3; return m; });
    onWall(b, '-x', -12.2, Y + 1.55, -27.3, () => coldController(b, L, beacon));
    clinicalSign(b, L, '냉장고 2 — −20 °C · snowflake', -12.205, Y + 2.62, -29.0, 1.4, 0.2, '-x');
    sticker(b, -12.205, Y + 1.6, -30.35, '-x', { text: '문을 닫아 두세요', w: 0.34, h: 0.1, rot: -0.02 });
    // frost tongue out of the doorway, fading out ≤ 1.3 m into the corridor
    frostPatch(b, L, -12.75, -29.0, 1.3, 1.9, 0.1, 0);
    frostPatch(b, L, -13.3, -29.1, 0.9, 1.1, 0.8, 0, 0.004);
    // LN2 dewar parked against the east wall south of the door; spill kit
    b.at(-12.55, Y, -31.6, 0.3, () => dewarTrolley(b, L));
    onWall(b, '-x', -12.2, Y, -33.0, () => {
      b.bx(paintD(L, 'safety_yellow', 0xe7c21a, 0.5), -0.35, 0.5, 0, 0.35, 1.2, 0.18);
      b.detail(() => b.sign('오염 처리 키트 — 생물학적', 'warning', 0, 0.95, 0.181, 0.6, 0.12, '+z'));
      b.collide(-0.35, 0.5, 0, 0.35, 1.2, 0.18, 'metal', true);
    });
    // ── west wall: emergency shower + eyewash opposite the cold store; glove station by the vivarium door
    onWall(b, '+x', -14.8, Y, -26.5, () => safetyShower(b, L));
    onWall(b, '+x', -14.8, Y, -19.4, () => gloveStation(b, L));
    clinicalSign(b, L, '[biohazard] VIVARIUM — LAB 2 · ANIMAL HOLDING', -14.795, Y + 2.62, -22.0, 1.6, 0.2, '+x');
    sticker(b, -14.795, Y + 1.55, -23.35, '+x', { rot: 0.04 });
    // wet-lab door, north stretch: a notice board with biosafety posters
    onWall(b, '-x', -12.2, Y + 1.55, -23.5, () => noticeBoard(b, L, R));
    sticker(b, -12.205, Y + 1.55, -16.65, '-x', { rot: -0.03 });
    clinicalSign(b, L, '습식 실험실 1', -12.205, Y + 2.62, -18.0, 0.9, 0.18, '-x');
    // fumigation tape: the cold-store door has a FUMIGATED sticker too
    sticker(b, -12.205, Y + 1.45, -27.65, '-x', { rot: 0.05, w: 0.26 });
    void R;
  },
};

/** Lab notice board: aluminium frame, cork-white board, pinned A4 posters (wall prop, centre). */
function noticeBoard(b: Builder, L: LevelBuild, R: ReturnType<typeof rng>) {
  const poster = canvasMatD(L, 'biosafety_posters', 512, 256, (g, W, H) => {
    g.fillStyle = '#eef1f2'; g.fillRect(0, 0, W, H);
    const sheet = (x: number, y: number, title: string, col: string, lines: number) => {
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 110, 150); g.fillStyle = col; g.fillRect(x, y, 110, 26);
      g.fillStyle = '#ffffff'; g.font = '700 11px Arial'; g.fillText(title, x + 6, y + 17);
      g.fillStyle = '#5a646c'; for (let i = 0; i < lines; i++) g.fillRect(x + 8, y + 36 + i * 9, 70 + ((i * 37) % 26), 3);
    };
    sheet(14, 20, 'BSL-2 규칙', '#2b5d8a', 11);
    sheet(136, 40, '유출 대응', '#c9a21a', 9);
    sheet(258, 18, '2단계 — 근무표', '#3d7a5a', 12);
    sheet(380, 52, '화재 집결지', '#b2261c', 8);
    g.fillStyle = '#c62d23'; for (const [x, y] of [[69, 24], [191, 44], [313, 22], [435, 56]]) { g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); }
  });
  b.bx('stainless', -0.62, -0.34, 0, 0.62, 0.34, 0.02);
  b.detail(() => b.quad(poster, 0, 0, 0.0205, 1.18, 0.6, '+z'));
  void R;
}

const corr_s: RoomDress = {
  label: false,
  look: LOOK,
  lights: [],
  build(L) {
    const b = L.builder('corr_s_dress');
    const R = rng(4102);
    const H = Y + 3.0;
    const { main, emerg } = corrLights(L, 'corr_s', [[-9.5, H - 0.55, -35.5], [9.5, H - 0.55, -35.5]], [0, H - 0.55, -35.5], [-1.0, Y + 2.45, -35.5], [14.3, Y + 2.4, -36.3]);
    const lum = boundGlow(L, 'lum_corr_s', main, 0xe8f0ff, 0.38);
    const eLens = boundGlow(L, 'elens_corr_s', emerg, 0xcfe2ff, 2.2);
    const rLens = boundGlow(L, 'rlens_corr_s', emerg, 0xff2a18, 1.6, 0xb02018);
    lumRow(b, L, lum, 'x', -35.5, H, -13.5, 13.5, 3.0);
    for (const x of [-12.0, 12.0]) b.at(x, H, -35.5, 0, () => hepaDiffuser(b, L));
    onWall(b, '-z', -1.0, Y + 2.35, -34.2, () => emergUnit(b, L, eLens));
    onWall(b, '-x', 14.8, Y + 2.4, -36.3, () => redLamp(b, rLens));
    // the two ceiling vents (grilles restyled, duct liners, trim)
    dressVent(b, L, 'vent_s_a_grille', -6.5, -36.0, -5.5, -35.0, H);
    dressVent(b, L, 'vent_s_b_grille', 5.5, -36.0, 6.5, -35.0, H);
    // rails / plates / strips (d4_surg at x 0 on the south wall; the corners are open to corr_w / corr_e)
    wallRun(b, L, '-z', -34.2, -12.2, 12.2, []);
    wallRun(b, L, '+z', -36.8, -14.8, 14.8, [[-1.25, 1.25]]);
    wallRun(b, L, '+x', -14.8, -36.8, -34.0, [], false);
    wallRun(b, L, '-x', 14.8, -36.8, -34.0, [], false);
    stripRun(b, L, 'x', -36.72, -14.72, 14.72, [[-1.15, 1.15]]);
    stripRun(b, L, 'x', -34.28, -12.28, 12.28);
    stripRun(b, L, 'z', -14.72, -36.72, -34.0);
    stripRun(b, L, 'z', 14.72, -36.72, -34.0);
    // the hold line: red/white chevron band across the corridor in front of d4_surg, stencilled
    const hold = floorPaint(L, 'hold_band', 'painted_white', { color: 0xb8231c, map: null, normalMap: null, roughness: 0.6 });
    const white = floorPaint(L, 'hold_white', 'painted_white', { color: 0xe8eaea, map: null, normalMap: null, roughness: 0.6 });
    b.detail(() => {
      for (let i = 0; i < 16; i++) b.bx(i % 2 ? white : hold, -1.6 + i * 0.2, Y, -35.95, -1.4 + i * 0.2, Y + 0.002, -35.8);
    });
    clinicalSign(b, L, '수술 구역 · 수술실 1', 0, Y + 2.75, -36.795, 2.0, 0.22, '+z');
    sticker(b, 1.45, Y + 1.5, -36.795, '+z', { text: '무균 구역 — 가운 착용 직원만', w: 0.42, h: 0.13, rot: -0.02 });
    // the corners: hanging signs; the junction walls carry wayfinding
    hangingSign(b, L, -13.5, H, -35.5, 'x', '냉장고 2 · 생물사육실 ↑', '수술 구역 →', 1.7, 0.22);
    hangingSign(b, L, 13.5, H, -35.5, 'x', '← SURGICAL SUITE', '기록실 · 유닛 베이 ↑', 1.7, 0.22);
    clinicalSign(b, L, '수술 구역 →', -14.795, Y + 2.0, -35.5, 1.3, 0.2, '+x');
    clinicalSign(b, L, '← SURGICAL SUITE', 14.795, Y + 2.0, -35.5, 1.3, 0.2, '-x');
    // parked transfer gurney and a sterile-supply cart on the north wall (cover in the ambush, nav keeps 1.8 m)
    b.at(-9.6, Y, -34.62, 0.02, () => gurney(b, L));
    b.at(9.3, Y, -34.52, PI, () => supplyCart(b, L, R));
    // north wall: a stopped clock over the door axis, an alcohol-gel station; south wall: a waste bin pair
    onWall(b, '-z', 3.2, Y + 2.35, -34.2, () => {
      b.cyl('plastic_white', 0, 0, 0.02, 0.17, 0.04, 'z', 24);
      b.detail(() => {
        b.cyl('plastic_white', 0, 0, 0.041, 0.15, 0.002, 'z', 24);
        b.rbox('plastic_dark', 0, 0.045, 0.045, 0.012, 0.11, 0.003, 0, 0, 0.0);
        b.rbox('plastic_dark', 0.04, -0.03, 0.046, 0.009, 0.14, 0.003, 0, 0, 2.2);
      });
    });
    onWall(b, '-z', -4.5, Y, -34.2, () => gloveStation(b, L));
    for (const x of [-4.6, 4.4]) b.at(x, Y, -36.5, 0, () => {
      b.cyl(paintD(L, 'safety_yellow', 0xe7c21a, 0.5), 0, 0, 0, 0.2, 0.62, 'y', 16);
      b.detail(() => { b.cyl(paintD(L, 'safety_yellow', 0xe7c21a, 0.5), 0, 0.62, 0, 0.21, 0.03, 'y', 16); b.sign('의료 폐기물', 'warning', 0, 0.38, 0.201, 0.3, 0.09, '+z'); });
      b.collide(-0.2, 0, -0.2, 0.2, 0.65, 0.2, 'metal', true);
    });
  },
};

const corr_e: RoomDress = {
  label: false,
  look: LOOK,
  lights: [],
  build(L) {
    const b = L.builder('corr_e_dress');
    const R = rng(4103);
    const H = Y + 3.0;
    const { main, emerg } = corrLights(L, 'corr_e', [[13.5, H - 0.55, -16], [13.5, H - 0.55, -30]], [13.5, H - 0.55, -23], [13.5, Y + 2.45, -25.5], [14.3, Y + 2.4, -12.8]);
    const lum = boundGlow(L, 'lum_corr_e', main, 0xe8f0ff, 0.38);
    const eLens = boundGlow(L, 'elens_corr_e', emerg, 0xcfe2ff, 2.2);
    const rLens = boundGlow(L, 'rlens_corr_e', emerg, 0xff2a18, 1.6, 0xb02018);
    lumRow(b, L, lum, 'z', 13.5, H, -32.5, -14.5, 3.0);
    for (const z of [-16.0, -22.0, -28.0]) b.at(13.5, H, z, 0, () => hepaDiffuser(b, L));
    onWall(b, '-x', 14.8, Y + 2.35, -25.5, () => emergUnit(b, L, eLens));
    onWall(b, '-x', 14.8, Y + 2.4, -12.8, () => redLamp(b, rLens));
    wallRun(b, L, '+x', 12.2, -33.8, -12.2, [[-30.15, -27.85], [-23.6, -20.4], [-17.15, -14.85]]);
    wallRun(b, L, '-x', 14.8, -33.8, -12.2, [[-20.15, -17.85], [-27.3, -25.7]]);
    stripRun(b, L, 'z', 12.28, -34.28, -12.2, [[-30.15, -27.85], [-17.15, -14.85]]);
    stripRun(b, L, 'z', 14.72, -34.0, -12.2, [[-20.15, -17.85]]);
    hangingSign(b, L, 13.5, H, -13.0, 'z', '기록실 · 유닛 베이 · 노드 2 ↓', '청정 복도 — 북측 ↑', 1.9, 0.22);
    hangingSign(b, L, 13.5, H, -33.0, 'z', '수술 구역 ↓', '기록실 · 책임연구원실 ↑', 1.9, 0.22);
    // ── the Node 2 window: stainless frame on the corridor face, a plate and a dead badge reader
    const fx0 = 12.2, w0 = -23.4, w1 = -20.6, y0 = 5.5, y1 = 7.3, f = 0.06;
    b.detail(() => {
      b.bx('stainless', fx0, y0 - f, w0 - f, fx0 + 0.03, y0, w1 + f).bx('stainless', fx0, y1, w0 - f, fx0 + 0.03, y1 + f, w1 + f);
      b.bx('stainless', fx0, y0, w0 - f, fx0 + 0.03, y1, w0).bx('stainless', fx0, y0, w1, fx0 + 0.03, y1, w1 + f);
      b.bx('stainless', fx0, y0 - f - 0.012, w0 - f, fx0 + 0.09, y0 - f, w1 + f); // sill
    });
    clinicalSign(b, L, '노드 2 — 바이오시스 · 인가된 IT 직원', 12.205, Y + 0.42, -22.0, 1.6, 0.16, '+x');
    onWall(b, '+x', 12.2, Y + 1.3, -24.0, () => {
      b.bx('plastic_dark', -0.06, -0.1, 0, 0.06, 0.1, 0.035);
      b.detail(() => b.bx('stainless', -0.045, -0.02, 0.035, 0.045, 0.07, 0.037));
    });
    // ── the unit bay door (east wall, z −19): hazard hatching on the floor, a lane line to the corridor corner
    const hatch = floorPaint(L, 'bay_hatch', 'hazard_stripes');
    const lane = floorPaint(L, 'unit_lane', 'painted_white', { color: 0xd8b21a, map: null, normalMap: null, roughness: 0.55 });
    b.detail(() => {
      b.bx(hatch, 13.6, Y, -19.85, 14.78, Y + 0.002, -18.15);
      for (let z = -21.0; z > -33.4; z -= 0.9) b.bx(lane, 14.18, Y, z - 0.5, 14.3, Y + 0.002, z);
    });
    clinicalSign(b, L, '유닛 베이 — 정비 유닛 전용', 14.795, Y + 2.62, -19.0, 1.7, 0.2, '-x');
    L.screen(null, 'terminal_idle', 0.36, 0.22, 14.795, Y + 1.5, -20.6, '-x', { text: '유닛 베이 — 3대 도킹 · 대기' });
    // fire point on the east wall; a sharps / waste pair by the records door
    onWall(b, '-x', 14.8, Y, -26.5, () => firePoint(b, L));
    clinicalSign(b, L, '기록 및 동의', 12.205, Y + 2.62, -29.0, 1.2, 0.18, '+x');
    clinicalSign(b, L, 'A. 순데 박사 — 책임 연구원', 12.205, Y + 2.62, -16.0, 1.1, 0.18, '+x');
    sticker(b, 12.205, Y + 1.55, -27.65, '+x', { rot: 0.03 });
    sticker(b, 12.205, Y + 1.5, -14.75, '+x', { rot: -0.04 });
    onWall(b, '+x', 12.2, Y, -32.4, () => gloveStation(b, L));
    void R;
  },
};

// ───────────────────────────────────────────────────────────── vivarium

const vivarium: RoomDress = {
  label: false,
  look: LOOK,
  lights: [],
  build(L) {
    const b = L.builder('vivarium_dress');
    const R = rng(4201);
    const H = Y + 3.4;
    restyle(L, 'vivarium_grey', isStandin, null); // pens + procedure table rebuilt below (the stand-in colliders stay)
    const hs = lightsOf(L, [
      { group: 'vivarium', type: 'point', p: [-21.5, H - 0.6, -18.5], color: CLEAN, i: 11, d: 10 },
      { group: 'vivarium', type: 'point', p: [-21.5, H - 0.6, -26], color: CLEAN, i: 11, d: 10 },
      { group: 'vivarium', type: 'point', p: [-17, H - 0.6, -22], color: CLEAN, i: 6, d: 8, min: 'medium' },
      // IB5b (B8): at its wall unit, a pool — not beside the room's probe (a lamp 1 m from the probe lit the whole room by IBL)
      { group: 'vivarium_emerg', type: 'point', p: [-21.0, Y + 2.35, -14.6], color: EMERG, i: 1.2, d: 7, off: true },
    ]);
    const lum = boundGlow(L, 'lum_viv', hs[0], 0xe8f0ff, 0.38);
    const eLens = boundGlow(L, 'elens_viv', hs[3], 0xcfe2ff, 2.2);
    lumRow(b, L, lum, 'z', -25.6, H, -28.0, -16.0, 3.0);
    lumRow(b, L, lum, 'z', -20.2, H, -26.5, -18.5, 2.67);
    lumRow(b, L, lum, 'z', -16.6, H, -28.0, -16.0, 4.0);
    for (const z of [-17.0, -27.0]) b.at(-22.9, H, z, 0, () => hepaDiffuser(b, L));
    onWall(b, '-z', -21.0, Y + 2.5, -14.2, () => emergUnit(b, L, eLens));
    dressVent(b, L, 'vent_viv_grille', -23.4, -22.5, -22.4, -21.5, H);

    // pen row A (6, against the west wall; fronts 4 cm proud of the stand-in) and row B (5, glazed both faces)
    const cardsA = ['P-01  클라스프 · 순응', 'P-02  클라스프 · 순응', 'P-03  클라스프 · 순응', 'P-04  클라스프 · 순응', 'P-05  클라스프 · 순응', 'P-06  클라스프 · 순응'];
    const cardsB = ['P-07  순응', 'P-08  순응', 'P-09  순응', 'P-10  순응', 'P-11  안락사'];
    const pb = L.builder('vivarium_pens');
    pb.at(-25.56, Y, -23.6, PI / 2, () => penRow(pb, L, { n: 6, w: 2.0, d: 2.4, cards: cardsA }));
    pb.at(-20.2, Y, -22.6, PI / 2, () => penRow(pb, L, { n: 5, w: 2.0, d: 2.44, back: 'glass', cards: cardsB }));
    restyle(L, 'vivarium_pens', (m) => m === L.ctx.materials.get('stainless'), paintD(L, 'pen_panel', 0xc9d0d5, 0.3, 0.35));
    // pen interiors: feed hoppers on the back walls of row A, a hose on each, wood-free enrichment (a steel chain + ball)
    const feed = paintD(L, 'feed_grey', 0x9aa3a8, 0.55);
    for (let i = 0; i < 6; i++) {
      const z = -29.6 + 1.0 + i * 2.0;
      b.detail(() => {
        b.bx(feed, -26.72, Y + 0.45, z - 0.25, -26.45, Y + 0.95, z + 0.25);
        b.bx('stainless', -26.72, Y + 0.3, z - 0.22, -26.4, Y + 0.45, z + 0.22);
        b.rod('stainless', -26.0, Y + 2.05, z + 0.3, -26.0, Y + 1.3, z + 0.3, 0.006, 4);
        b.sphere('plastic_white', -26.0, Y + 1.24, z + 0.3, 0.07, 10);
      });
    }
    // husbandry station by the north end of row A: stainless table (tablet log4_viv, ammo p4_viv_ammo), a hose reel
    b.at(-25.3, Y, -16.25, 0, () => steelTable(b, L, 2.0, 1.4, 0.9));
    b.detail(() => {
      b.rbox('plastic_dark', -25.5, Y + 0.905, -16.0, 0.26, 0.012, 0.19, 0, 0.3, 0); // the tablet
      b.rbox('screen_off', -25.5, Y + 0.912, -16.0, 0.23, 0.002, 0.16, 0, 0.3, 0);
      papers(b, L, -26.0, Y + 0.9, -16.6, 5, R, 0.2);
      b.cyl('plastic_white', -24.7, Y + 0.9, -15.8, 0.05, 0.12, 'y', 10);
    });
    onWall(b, '-z', -26.0, Y, -14.2, () => hoseReel(b, L));
    // cage cards (note4_cards): a stainless wall rack of clip boards on the north wall → moved onto a mobile stand
    b.at(-21.0, Y, -15.55, 0, () => cardStand(b, L, R));
    // procedure table (stand-in footprint x −18.3 … −16.7, z −27.6 … −26.4, top 0.85) + exam lamp + the Clasp tray
    b.at(-17.5, Y, -27.0, PI / 2, () => procTable(b, L));
    defineClaspInstances(L);
    b.detail(() => {
      b.bx('stainless', -17.82, Y + 0.85, -27.28, -17.18, Y + 0.87, -26.72);
      b.bx('stainless', -17.82, Y + 0.87, -27.28, -17.8, Y + 0.9, -26.72).bx('stainless', -17.2, Y + 0.87, -27.28, -17.18, Y + 0.9, -26.72);
      b.bx('stainless', -17.8, Y + 0.87, -27.28, -17.2, Y + 0.9, -27.26).bx('stainless', -17.8, Y + 0.87, -26.74, -17.2, Y + 0.9, -26.72);
    });
    for (let i = 0; i < 12; i++) {
      const c = i % 4, r = Math.floor(i / 4);
      claspInst(b, -17.68 + c * 0.12, Y + 0.873 + 0.01, -27.15 + r * 0.15, -PI / 2, R.range(-0.08, 0.08), 0, 'off');
    }
    // vivarium extras: a scale platform, a feed bin, a wash-down trench drain along row A's fronts, a door dip tray
    b.detail(() => {
      b.bx('stainless', -24.25, Y, -29.6, -24.05, Y + 0.004, -17.6); // trench grate
      b.bx('stainless', -15.9, Y, -22.8, -15.25, Y + 0.025, -21.2); // boot dip tray inside the door
      b.bx(paintD(L, 'dip_blue', 0x3a6f9a, 0.3), -15.85, Y + 0.025, -22.75, -15.3, Y + 0.028, -21.25);
    });
    b.at(-16.2, Y, -29.0, PI, () => {
      b.bx('stainless', -0.6, 0, -0.4, 0.6, 0.08, 0.4);
      b.bx('plastic_dark', -0.1, 0.08, 0.35, 0.1, 1.0, 0.4);
      b.detail(() => { b.bx('screen_off', -0.12, 1.0, 0.33, 0.12, 1.14, 0.41); b.sign('저울 0.00 kg', 'clinical', 0, 1.18, 0.41, 0.2, 0.04, '+z'); });
      b.collide(-0.6, 0, -0.4, 0.6, 0.08, 0.4, 'metal', true);
      b.collide(-0.1, 0, 0.35, 0.1, 1.14, 0.41, 'metal', true);
    });
    b.at(-16.0, Y, -15.2, 0, () => {
      b.cyl(paintD(L, 'feedbin', 0x4d6a8a, 0.5), 0, 0, 0, 0.32, 0.8, 'y', 18);
      b.detail(() => { b.cyl(paintD(L, 'feedbin', 0x4d6a8a, 0.5), 0, 0.8, 0, 0.34, 0.04, 'y', 18); b.sign('사료 — 펠릿', 'clinical', 0, 0.5, 0.321, 0.36, 0.08, '+z'); });
      b.collide(-0.32, 0, -0.32, 0.32, 0.84, 0.32, 'rubber');
    });
    // signage
    clinicalSign(b, L, '펜 열 A', -24.37, Y + 2.35, -17.2, 0.6, 0.12, '+z', { plate: false });
    clinicalSign(b, L, '[biohazard] ANIMAL HOLDING — PPE REQUIRED', -15.205, Y + 2.7, -25.6, 1.8, 0.2, '-x');
    clinicalSign(b, L, '2단계 페어링 — 14.08', -26.795, Y + 2.55, -15.6, 1.1, 0.16, '+x');
    // Berg: on his side in the aisle at the south end, an arm towards the pens
    body(L, b, 'lying_side', '베리', { x: -23.5, y: Y, z: -27.5, ry: 0.35, collider: 'walk' });
    // floor strips both sides of the aisle (§8.11) and along the east aisle
    stripRun(b, L, 'z', -24.24, -29.7, -17.4);
    stripRun(b, L, 'z', -21.6, -27.9, -17.4);
    stripRun(b, L, 'z', -18.82, -27.9, -17.4);
    stripRun(b, L, 'x', -14.28, -26.7, -15.3);
  },
};

/** Stainless work table (floor prop, centre, top at h): undershelf, four legs. */
function steelTable(b: Builder, L: LevelBuild, w: number, d: number, h: number) {
  const S: Mat = 'stainless';
  b.bx(S, -w / 2, h - 0.04, -d / 2, w / 2, h, d / 2);
  b.bx(S, -w / 2 + 0.05, 0.18, -d / 2 + 0.05, w / 2 - 0.05, 0.2, d / 2 - 0.05);
  b.detail(() => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(S, sx * (w / 2 - 0.05) - 0.02, 0, sz * (d / 2 - 0.05) - 0.02, sx * (w / 2 - 0.05) + 0.02, h - 0.04, sz * (d / 2 - 0.05) + 0.02); });
  b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
  void L;
}
/** Veterinary procedure table matching the stand-in (1.6 × 1.2, top 0.85; collider is the stand-in's), with an exam lamp. */
function procTable(b: Builder, L: LevelBuild) {
  const S: Mat = 'stainless';
  b.bx(S, -0.8, 0.81, -0.6, 0.8, 0.85, 0.6);
  b.bx(S, -0.75, 0.835, -0.55, 0.75, 0.84, 0.55); // drain dish (just under the top's rim)
  b.bx(S, -0.12, 0.08, -0.12, 0.12, 0.81, 0.12);
  b.bx(S, -0.5, 0, -0.35, 0.5, 0.08, 0.35);
  b.detail(() => {
    // exam lamp on an articulated arm from the table's end (off)
    b.rod(S, 0.7, 0.85, 0.5, 0.7, 1.7, 0.5, 0.015, 6);
    b.rod(S, 0.7, 1.7, 0.5, 0.25, 1.85, 0.2, 0.012, 6);
    b.cyl('plastic_white', 0.22, 1.82, 0.18, 0.13, 0.08, 'y', 16, 0.06);
    b.cyl('screen_off', 0.22, 1.779, 0.18, 0.11, 0.004, 'y', 16);
    b.rod('plastic_dark', -0.8, 0.83, -0.5, -0.8, 0.4, -0.5, 0.012, 5);
  });
  void L;
}
/** Wall hose reel (vivarium wash-down). */
function hoseReel(b: Builder, L: LevelBuild) {
  b.bx('stainless', -0.25, 0.9, 0, 0.25, 1.45, 0.05);
  b.cyl(paintD(L, 'hose_green', 0x2e6b48, 0.6), 0, 1.18, 0.16, 0.22, 0.14, 'z', 18);
  b.detail(() => { b.cyl('stainless', 0, 1.18, 0.08, 0.06, 0.18, 'z', 10); b.rod('plastic_dark', 0.2, 1.1, 0.2, 0.2, 0.25, 0.25, 0.018, 6); b.cyl('stainless', 0.2, 0.2, 0.25, 0.025, 0.1, 'y', 8); });
  b.collide(-0.25, 0.9, 0, 0.25, 1.45, 0.25, 'metal', true);
}
/** Mobile stand with the pen-row-B cage cards on a slanted clip board (top at 1.2; note4_cards). */
function cardStand(b: Builder, L: LevelBuild, R: ReturnType<typeof rng>) {
  const S: Mat = 'stainless';
  b.bx(S, -0.3, 0, -0.25, 0.3, 0.04, 0.25);
  b.rod(S, 0, 0.04, 0, 0, 1.1, 0, 0.02, 8);
  b.rbox(S, 0, 1.16, 0, 0.6, 0.02, 0.42, -0.45, 0, 0);
  b.detail(() => {
    const card = mat4(L, 'd1b_cagecard', () => L.ctx.materials.clone('plastic_white', { color: 0xf7e9a8, roughness: 0.85, map: null, normalMap: null, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    for (let i = 0; i < 12; i++) {
      const c = i % 4, r = Math.floor(i / 4);
      b.push(0, 1.16, 0, 0, -0.45, 0);
      b.rbox(card, -0.21 + c * 0.14 + R.range(-0.006, 0.006), 0.013, -0.13 + r * 0.13, 0.12, 0.002, 0.08, 0, R.range(-0.05, 0.05), 0);
      b.pop();
    }
  });
  b.collide(-0.3, 0, -0.25, 0.3, 1.2, 0.25, 'metal', true);
}

// ───────────────────────────────────────────────────────────── cold store

const cold: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'frost', ceiling: 'frost' },
  lights: [],
  build(L) {
    const b = L.builder('cold_dress');
    const R = rng(4301);
    const H = Y + 3.0;
    const hs = lightsOf(L, [
      { group: 'cold', type: 'point', p: [-6, H - 0.55, -29], color: COLDW, i: 10, d: 10 },
      { group: 'cold', type: 'point', p: [-9.5, H - 0.55, -26.2], color: COLDW, i: 6, d: 7, min: 'medium' },
      // IB5b (B8): at its wall unit (was at the room's probe: the IBL lit the whole store)
      { group: 'cold_emerg', type: 'point', p: [-9.0, Y + 2.2, -33.4], color: 0x7fb0ff, i: 1.2, d: 7, off: true },
    ]);
    const lum = boundGlow(L, 'lum_cold', hs[0], 0xdcecff, 0.38);
    const eLens = boundGlow(L, 'elens_cold', hs[2], 0xb8d4ff, 2.0);
    // vapour-proof luminaires (frost on the frames), two rows along x
    for (const z of [-26.6, -31.4]) lumRow(b, L, lum, 'x', z, H, -9.5, -2.5, 3.5);
    onWall(b, '+z', -9.0, Y + 2.35, -33.8, () => emergUnit(b, L, eLens));
    // the evaporator (fan coil) under the ceiling on the south wall: finned block, three fans, frost, drip tray
    onWall(b, '+z', -6.0, H - 0.55, -33.8, () => evaporator(b, L));
    // Clasp rack on the north wall (mk4_cold_rack): 24 cradles, 18 Clasps (amber), 6 empty
    const { slots } = cradleAt(b, L);
    defineClaspInstances(L);
    const empty = new Set([2, 7, 11, 12, 19, 21]);
    const _p = V(0, 0, 0), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _e = new THREE.Euler();
    // each cradle's charge pip on the shelf lip: amber where a Clasp sits (powered, not linked — D9), dark where empty
    const pipOn = mat4(L, 'd1b_pip_amber', () => { const m = L.ctx.materials.clone('emissive_amber', { color: 0xffa040 }); m.emissive = new THREE.Color(0xff8a1c); m.emissiveIntensity = 2.4; return m; });
    slots.forEach((m, i) => {
      m.decompose(_p, _q, _s);
      const pip = V(0, -0.0825, 0.066).applyMatrix4(m);
      b.detail(() => b.bx(empty.has(i) ? 'plastic_dark' : pipOn, pip.x - 0.035, pip.y - 0.008, pip.z - 0.004, pip.x + 0.035, pip.y + 0.008, pip.z + 0.001));
      if (empty.has(i)) return;
      _e.setFromQuaternion(_q, 'YXZ');
      claspInst(b, _p.x, _p.y, _p.z, _e.x, _e.y, _e.z, 'amber');
    });
    clinicalSign(b, L, '클라스프 — 크레이들 랙 2 · 전원 유지', -5.5, Y + 2.05, -24.205, 2.2, 0.16, '-z');
    b.detail(() => { b.bx('frost', -8.03, Y + 1.83, -24.34, -2.97, Y + 1.86, -24.2); });
    // sample racks: west wall south of the door, south wall, east wall either side of the panel
    const rack = (x: number, z: number, face: '+x' | '-x' | '+z' | '-z', w = 1.2) => onWall(b, face, x, Y, z, () => sampleRack(b, L, R, { w, frost: true, fill: 0.75 }));
    rack(-11.8, -32.6, '+x'); rack(-11.8, -31.2, '+x');
    rack(-10.2, -33.8, '+z'); rack(-8.8, -33.8, '+z'); rack(-3.4, -33.8, '+z'); rack(-2.0, -33.8, '+z');
    rack(-0.2, -32.6, '-x'); rack(-0.2, -25.6, '-x');
    // gel cartons (CLASP GEL — BATCH 41) stacked on a pallet rack by the north-west corner
    b.at(-10.6, Y, -24.75, 0, () => {
      b.bx('stainless', -0.9, 0, -0.45, 0.9, 0.12, 0.45);
      b.collide(-0.9, 0, -0.45, 0.9, 1.06, 0.45, 'rubber', true);
      const box: Mat = 'plastic_white';
      for (let i = 0; i < 9; i++) { const c = i % 3, r = Math.floor(i / 3); b.rbox(box, -0.55 + c * 0.55, 0.12 + 0.155 + r * 0.31, 0, 0.5, 0.3, 0.6, 0, R.range(-0.05, 0.05), 0); }
      b.detail(() => {
        b.bx('frost', -0.85, 1.05, -0.32, 0.85, 1.07, 0.32);
        for (let r = 0; r < 3; r++) b.sign('클라스프 젤 — 배치 41 · −20 °C', 'clinical', -0.55 + r * 0.55, 0.32 + r * 0.31, 0.305, 0.42, 0.07, '+z');
      });
    });
    // a −80 freezer in the cold store's east end (back-up for the gel), frosted
    onWall(b, '-x', -0.2, Y, -27.6, () => ultFreezer(b, L, { label: '−80 °C · BACK-UP' }));
    // first-aid box on the west wall north of the door (p4_cold_med on its shelf)
    onWall(b, '+x', -11.8, Y + 1.15, -27.2, () => {
      b.bx(paintD(L, 'aid_green', 0x1f8a4c, 0.45), -0.25, 0.08, 0, 0.25, 0.48, 0.14);
      b.bx('stainless', -0.27, -0.02, 0, 0.27, 0.0, 0.32);
      b.detail(() => { b.sign('응급처치', 'clinical', 0, 0.36, 0.141, 0.3, 0.07, '+z'); b.bx('plastic_white', -0.04, 0.22, 0.14, 0.04, 0.3, 0.145).bx('plastic_white', -0.012, 0.19, 0.14, 0.012, 0.33, 0.145); });
      b.collide(-0.27, -0.02, 0, 0.27, 0.48, 0.32, 'metal', true);
    });
    // frost on the floor in drifts along the walls, ice on the threshold
    for (let i = 0; i < 9; i++) frostPatch(b, L, -10.8 + i * 1.25, i % 2 ? -24.75 : -33.25, 1.15, 0.9, 0, i, (i % 3) * 0.003);
    frostPatch(b, L, -11.35, -29.0, 0.9, 2.2, 0, 3, 0.009);
    // Holm: on his back, head towards the door, right arm stretched to the threshold; a dropped cryobox in the
    // threshold breaks the door's low safety beam (it sits under the door check's 6 cm floor band; D1b decision)
    const holm = body(L, b, 'lying_back', '홀름', { x: -10.25, y: Y, z: -29.0, ry: PI / 2, armOut: [-11.39, Y + 0.0, -29.15], collider: 'walk', seed: 36 });
    if (L.ctx.debug.verbose) console.info('[d1b] Holm box', holm.box.min.toArray(), holm.box.max.toArray());
    b.detail(() => {
      b.rbox('frost', -11.72, Y + 0.026, -28.86, 0.133, 0.052, 0.133, 0, 0.5, 0);
      for (const [x, z, a] of [[-11.5, -28.55, 0.4], [-11.28, -28.7, 1.9], [-11.62, -28.32, 2.6]] as const) b.rbox('plastic_white', x, Y + 0.008, z, 0.012, 0.016, 0.048, PI / 2, a, 0);
    });
    // fog (§2.9: room box + spill out of the door, ≤ 1.2 m into corr_w) and the breath zone
    const fx = L.ctx.fx as FxSystemEx;
    if (typeof fx.fog === 'function') {
      fx.fog({
        id: 'fx4_cold_fog', rooms: ['cold', 'corr_w'], glintRooms: ['cold'], seenFrom: ['corr_w'],
        box: B3(-11.8, Y, -33.8, -0.2, Y + 0.65, -24.2), spill: B3(-14.8, Y, -30.0, -12.2, Y + 0.4, -28.0),
        color: 0xc4d4e2, density: 1.3, drift: [0.06, 0.015], glints: 300,
      });
      fx.breathZone(B3(-11.8, Y, -33.8, -0.2, Y + 3.0, -24.2), { id: 'fx4_breath', rooms: ['cold'] });
    }
    // floor strips (aisle along the racks)
    stripRun(b, L, 'z', -11.72, -33.7, -29.9);
    stripRun(b, L, 'z', -11.72, -28.1, -24.3);
    stripRun(b, L, 'x', -24.28, -11.7, -0.3);
    stripRun(b, L, 'x', -33.72, -11.7, -0.3);
    clinicalSign(b, L, '격리 인터록 — 패널에서 확인', -0.205, Y + 2.15, -29.0, 1.6, 0.14, '-x');
  },
};

/** The cradle rack placed on the north wall (origin bottom centre on the wall face, front −z). */
function cradleAt(b: Builder, L: LevelBuild) {
  let out: { slots: THREE.Matrix4[] } = { slots: [] };
  b.at(-5.5, Y + 0.6, -24.2, PI, () => { out = cradleRack(b, L, { cols: 8, rows: 3, w: 5.0, h: 1.2 }); });
  return out;
}

/** Ceiling-hung evaporator unit (wall prop under the ceiling): finned coil, 3 fans, drip tray, frost (local frame). */
function evaporator(b: Builder, L: LevelBuild) {
  const W = labWhite(L);
  b.bx(W, -1.4, 0, 0, 1.4, 0.5, 0.55);
  b.detail(() => {
    for (let i = 0; i < 3; i++) {
      const x = -0.9 + i * 0.9;
      b.cyl('plastic_dark', x, 0.25, 0.555, 0.2, 0.01, 'z', 18);
      b.torus('stainless', x, 0.25, 0.56, 0.2, 0.012, 'z', 18);
      for (let k = 0; k < 4; k++) b.rbox('stainless', x, 0.25, 0.57, 0.36, 0.012, 0.004, 0, 0, (k * PI) / 4);
    }
    b.bx('stainless', -1.45, -0.06, -0.0, 1.45, 0.0, 0.62);
    b.bx('frost', -1.38, 0.5, 0.02, 1.38, 0.52, 0.53);
    b.bx('frost', -1.4, -0.08, 0.6, 1.4, -0.06, 0.64);
    for (let i = 0; i < 9; i++) b.cyl('frost', -1.3 + i * 0.32, -0.12, 0.6, 0.012, 0.06, 'y', 5, 0.002);
    b.rod('stainless', 1.25, 0.25, 0.1, 1.25, 0.55, 0.1, 0.02, 6);
  });
  void L;
}

// ───────────────────────────────────────────────────────────── records

const records: RoomDress = {
  label: false,
  look: LOOK,
  lights: [],
  build(L) {
    const b = L.builder('records_dress');
    const R = rng(4401);
    const H = Y + 3.0;
    restyle(L, 'records_grey', isStandin, null); // the reading table (its collider stays) is rebuilt below
    const hs = lightsOf(L, [
      { group: 'records', type: 'point', p: [6, H - 0.55, -29], color: CLEAN, i: 8, d: 10 },
      { group: 'records', type: 'spot', p: [3.2, Y + 1.55, -26.75], t: [3.1, Y + 0.75, -27.1], color: 0xf4f6ff, i: 5, d: 3.5, angle: 0.9, min: 'medium' },
      // IB5b (B8): at its wall unit (was at the room's probe)
      { group: 'records_emerg', type: 'point', p: [2.0, Y + 2.2, -33.4], color: EMERG, i: 1.2, d: 7, off: true },
    ]);
    const lum = boundGlow(L, 'lum_rec', hs[0], 0xe8f0ff, 0.38);
    const lamp = boundGlow(L, 'lamp_rec', hs[1] ?? hs[0], 0xf4f6ff, 0.6);
    const eLens = boundGlow(L, 'elens_rec', hs[2], 0xcfe2ff, 2.2);
    for (const z of [-26.5, -31.5]) lumRow(b, L, lum, 'x', z, H, 1.5, 10.5, 3.0);
    onWall(b, '+z', 2.0, Y + 2.35, -33.8, () => emergUnit(b, L, eLens));
    // filing walls: west wall (back to the cold store), north wall, south-west run
    b.at(0.2, Y, -29.0, PI / 2, () => filingWall(b, L, R, { len: 8.0, h: 2.2, fill: 0.85 }));
    b.at(4.5, Y, -24.2, PI, () => filingWall(b, L, R, { len: 6.0, h: 2.2, fill: 0.7 }));
    b.at(2.6, Y, -33.8, 0, () => filingWall(b, L, R, { len: 4.0, h: 2.2, fill: 0.9 }));
    // the reading table (stand-in 2.0 … 4.4 × −27.6 … −26.4, top 0.75): black resin top on white legs; a desk lamp
    b.push(3.2, Y, -27.0, 0);
    b.bx('plastic_dark', -1.2, 0.72, -0.6, 1.2, 0.75, 0.6);
    b.bx(labWhite(L), -1.15, 0.6, -0.55, 1.15, 0.72, 0.55);
    b.detail(() => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(labWhite(L), sx * 1.1 - 0.03, 0, sz * 0.5 - 0.03, sx * 1.1 + 0.03, 0.6, sz * 0.5 + 0.03);
      // articulated desk lamp at the table's back, head over the forms
      b.cyl('plastic_dark', 0.0, 0.75, 0.5, 0.07, 0.02, 'y', 12);
      b.rod('stainless', 0.0, 0.77, 0.5, 0.0, 1.25, 0.35, 0.01, 5);
      b.rod('stainless', 0.0, 1.25, 0.35, 0.0, 1.55, 0.25, 0.01, 5);
      b.cyl('plastic_dark', 0.0, 1.52, 0.25, 0.08, 0.1, 'y', 12, 0.04);
      b.cyl(lamp, 0.0, 1.469, 0.25, 0.065, 0.003, 'y', 12);
    });
    b.pop();
    papers(b, L, 3.0, Y + 0.75, -27.0, 14, R, 0.1);
    papers(b, L, 2.55, Y + 0.75, -26.75, 6, R, -0.3);
    b.detail(() => {
      // the consent box: archive box with its lid off, stacks of signed forms, a pen
      b.box(binderBlue(L), 4.0, Y + 0.75 + 0.13, -27.2, 0.33, 0.26, 0.42);
      b.rbox('plastic_white', 4.05, Y + 0.765, -26.8, 0.34, 0.03, 0.43, 0, 0.25, 0);
      b.rod('plastic_dark', 3.3, Y + 0.757, -26.9, 3.42, Y + 0.757, -26.82, 0.004, 5);
      b.sign('동의서 — 초소 4 — 23', 'clinical', 4.0, Y + 0.88, -26.99, 0.28, 0.07, '+z');
    });
    // Ness: at the reading table, folded over it (desk front edge 0.4 m ahead of her origin; wave-1 note)
    body(L, b, 'sitting_desk', '네스', { x: 3.0, y: Y, z: -28.0, ry: 0, deskY: 0.75, chair: true, collider: 'none' });
    b.collide(2.62, Y, -28.45, 3.38, Y + 1.15, -27.62, 'flesh', true);
    // Moe: on his back by the south wall
    body(L, b, 'lying_back', '모에', { x: 8.5, y: Y, z: -32.8, ry: PI / 2 + 0.2, collider: 'walk', seed: 31 });
    // the briefing corner: four stacking chairs in a row facing a whiteboard easel (where the detachment signed)
    for (let i = 0; i < 4; i++) b.at(7.2 + i * 0.6, Y, -27.4 + R.range(-0.05, 0.05), R.range(-0.12, 0.12), () => labChairD(b, L));
    b.at(8.1, Y, -25.0, PI, () => whiteboardEasel(b, L));
    // lateral file under note4_tveit (10.8, 5.9, −24.4); a shredder, an archive trolley by the door
    b.at(10.85, Y, -24.6, PI, () => {
      b.bx(labWhite(L), -0.6, 0, -0.25, 0.6, 1.08, 0.25);
      b.detail(() => { for (let k = 0; k < 3; k++) b.bx('stainless', -0.1, 0.25 + k * 0.33, 0.25, 0.1, 0.28 + k * 0.33, 0.27); });
      b.collide(-0.6, 0, -0.25, 0.6, 1.08, 0.25, 'metal', true);
    });
    papers(b, L, 10.8, Y + 1.08, -24.45, 3, R, 0.4);
    b.at(11.2, Y, -32.7, -PI / 2, () => archiveTrolley(b, L, R));
    b.at(11.35, Y, -26.6, -PI / 2, () => {
      b.bx('plastic_dark', -0.22, 0, -0.18, 0.22, 0.62, 0.18);
      b.detail(() => b.bx('stainless', -0.18, 0.62, -0.06, 0.18, 0.64, 0.06));
      b.collide(-0.22, 0, -0.18, 0.22, 0.64, 0.18, 'rubber', true);
    });
    clinicalSign(b, L, '[document] RECORDS & CONSENT — PHASE 2', 11.795, Y + 2.55, -31.6, 1.9, 0.2, '-x');
    sticker(b, 11.795, Y + 1.5, -30.4, '-x', { rot: 0.04 });
    stripRun(b, L, 'z', 11.72, -33.7, -30.2);
    stripRun(b, L, 'z', 11.72, -27.8, -24.3);
  },
};

/** Whiteboard on an easel (floor prop, face +z): "2단계 — 지원자 브리핑". */
function whiteboardEasel(b: Builder, L: LevelBuild) {
  const board = canvasMatD(L, 'briefing_board', 512, 320, (g, W, H) => {
    g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1b3f8f'; g.fillStyle = '#1b3f8f'; g.lineWidth = 3;
    g.font = '700 30px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('2단계 — 자원자 설명회', 22, 46);
    g.font = '24px "Marker Felt", "Comic Sans MS", sans-serif';
    g.fillText('1. 클라스프 = 조언 전용', 30, 100);
    g.fillText('2. 호박색 LED = 전원 켜짐', 30, 140);
    g.fillText('3. 제어자: 추후 배정 (운영본부)', 30, 180);
    g.fillStyle = '#b12a22'; g.fillText('23/23 서명 ✓', 30, 236);
    g.strokeStyle = '#b12a22'; g.beginPath(); g.ellipse(262, 172, 120, 26, 0, 0, 6.3); g.stroke();
  });
  const S: Mat = 'stainless';
  b.rod(S, -0.55, 0, -0.25, -0.5, 1.9, 0.0, 0.015, 6).rod(S, 0.55, 0, -0.25, 0.5, 1.9, 0.0, 0.015, 6).rod(S, 0, 0, -0.55, 0, 1.7, -0.05, 0.012, 6);
  b.bx(S, -0.62, 0.95, -0.02, 0.62, 1.75, 0.0);
  b.detail(() => { b.quad(board, 0, 1.35, 0.001, 1.2, 0.76, '+z'); b.bx(S, -0.6, 0.93, 0.0, 0.6, 0.95, 0.06); });
  b.collide(-0.62, 0, -0.3, 0.62, 1.9, 0.06, 'metal', true);
}

// ───────────────────────────────────────────────────────────── unit bay

const bay: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const b = L.builder('bay_dress');
    const H = Y + 3.0;
    // three dark charging docks on the east wall, standby LEDs dim red (the bay has no lights of its own: §2.7)
    // (IB5b, B8: on every quality — on LOW the bay was pitch black under lights-out)
    lightsOf(L, [{ group: 'bay', type: 'point', p: [19.6, Y + 2.3, -19.0], color: 0xff2414, i: 1.8, d: 6.5, prio: 0.3 }]);
    const led = mat4(L, 'd1b_dock_led', () => { const m = L.ctx.materials.clone('emissive_red'); m.emissiveIntensity = 0.5; return m; });
    for (const z of [-17.3, -19.0, -20.7]) {
      onWall(b, '-x', 20.8, Y, z, () => chargingDock(b, L, led));
      b.at(20.0, H, z, PI / 2, () => cableReel(b, L));
    }
    b.detail(() => {
      b.sign('유닛 베이', 'stencil', 15.205, Y + 2.3, -17.2, 1.2, 0.3, '+x');
      for (const [z, n] of [[-17.3, '도크 1'], [-19.0, '도크 2'], [-20.7, '도크 3']] as const) b.sign(n, 'stencil', 20.795, Y + 2.55, z, 0.6, 0.14, '-x');
      // tyre marks / scuffs from the units' feet along the lane to the door
      b.bx(floorPaint(L, 'bay_lane', 'painted_white', { color: 0xd8b21a, map: null, normalMap: null }), 15.25, Y, -19.06, 19.6, Y + 0.002, -18.94);
    });
    // a spare-parts cabinet and a tool chest along the north wall
    b.at(17.2, Y, -16.45, PI, () => {
      b.bx(paintD(L, 'cab_grey', 0x50565c, 0.5, 0.2), -0.6, 0, -0.25, 0.6, 1.9, 0.25);
      b.detail(() => { b.bx('stainless', -0.02, 0.8, 0.25, 0.02, 1.1, 0.27); b.sign('예비품 — 유닛 S시리즈', 'clinical', 0, 1.6, 0.252, 0.6, 0.08, '+z'); });
      b.collide(-0.6, 0, -0.25, 0.6, 1.9, 0.25, 'metal', true);
    });
    stripRun(b, L, 'x', -16.28, 15.3, 20.7);
  },
};

// ───────────────────────────────────────────────────────────── vignettes + machines (registered from corr_s's build)

/**
 * `lights_out4` (§4.3), the three vent grilles (`viv_vent`, `vent_s_a`, `vent_s_b`) and the `cold_jam` machine.
 * Runs once (from corr_s's build). Everything acts through group names / L.objects / the door API.
 */
function installScripted(L: LevelBuild) {
  const lm = L.ctx.render.lights;
  L.vignette('lights_out4', () => {
    const [ox, oz] = LIGHTS_OUT4.origin;
    let last = 0;
    const roomDelay = new Map<string, number>();
    for (const g of LIGHTS_OUT4.off) {
      for (const h of lm.group(g)) {
        const delay = Math.hypot(h.position.x - ox, h.position.z - oz) * LIGHTS_OUT4.perMetre;
        roomDelay.set(g, Math.max(roomDelay.get(g) ?? 0, delay));
        last = Math.max(last, delay);
        // a short stutter as the supply drops, then the fade
        L.tween(delay, LIGHTS_OUT4.dim, (k) => {
          const stutter = k < 0.22 ? (Math.sin(k * 90) > 0.2 ? 1 : 0.35) : 1;
          h.intensityScale = Math.max(0, 1 - k * k) * stutter;
        }, () => { h.enabled = false; h.intensityScale = 1; });
      }
    }
    // each room's emergency group comes on 0.35 s after its own lights died, with a flicker-start
    for (const eg of LIGHTS_OUT4.emerg) {
      const room = eg.replace(/_emerg$/, '');
      const at = (roomDelay.get(room) ?? last) + LIGHTS_OUT4.dim + 0.35;
      L.after(at, () => {
        for (const h of lm.group(eg)) { h.enabled = true; h.intensityScale = 0.2; }
        L.tween(0, 0.5, (k) => { const v = k < 0.6 ? (Math.sin(k * 70) > 0 ? 0.9 : 0.15) : 1; for (const h of lm.group(eg)) h.intensityScale = v; }, () => { for (const h of lm.group(eg)) h.intensityScale = 1; });
      });
    }
    // the floor strips (one material for the level) ramp on with the first emergency lights
    L.tween(LIGHTS_OUT4.dim + 0.3, 0.8, (k) => setStrips(L, k), () => setStrips(L, 1));
    L.sfx('power_down', ox, Y + 1.7, oz, 0.9);
    L.after(LIGHTS_OUT4.dim * 0.6, () => L.sfx('lights_thunk', ox, Y + 2.6, oz, 1.0));
    L.after(LIGHTS_OUT4.dim + 0.35, () => { L.sfx('lights_thunk', -13.5, Y + 2.4, -23, 0.6, 1.2); L.sfx('lights_thunk', 13.5, Y + 2.4, -23, 0.6, 1.2); });
  });

  const fx = L.ctx.fx;
  const vent = (id: string, grille: string, x: number, y: number, z: number) => L.vignette(id, () => {
    (L.objects.get(grille)?.userData.open as ((m: string) => void) | undefined)?.('drop');
    if (L.silent) return;
    try {
      fx.smoke(V(x, y - 0.15, z), { count: 16, size: 0.55, color: 0x8d9296, rise: -0.25, life: 1.8 });
      L.after(0.25, () => fx.smoke(V(x, y - 0.9, z), { count: 8, size: 0.7, color: 0x9a9fa3, rise: -0.1, life: 1.6 }));
    } catch { /* fx not ready */ }
  });
  vent('viv_vent', 'vent_viv_grille', -22.9, Y + 3.4, -22.0);
  vent('vent_s_a', 'vent_s_a_grille', -6.0, Y + 3.0, -35.5);
  vent('vent_s_b', 'vent_s_b_grille', 6.0, Y + 3.0, -35.5);

  // cold_jam (D26): while 'active', the held-open d4_cold twitches toward closed every 6–9 s (sometimes twice), its
  // beam finds the cryobox again and it rolls back; the controller's amber DOOR OPEN beacon blinks (and flares at a twitch)
  const beacon = mat4(L, 'd1b_cold_beacon', () => L.ctx.materials.clone('emissive_amber', { color: 0xffb040 }));
  let on = false, t = 0, next = 7.0, flare = 0;
  const R = rng(4501);
  L.machines.set('cold_jam', (s) => { on = s === 'active' || s === 'frenzy'; t = 0; });
  L.updaters.push((dt, time) => {
    flare = Math.max(0, flare - dt);
    beacon.emissiveIntensity = on ? (Math.sin(time * PI * 2 * 0.8) > 0.1 ? 1.6 : 0.12) + flare * 2.5 : 0.1;
    if (!on) return;
    t += dt;
    if (t < next) return;
    t = 0;
    next = R.range(6, 9);
    const d = L.doors.get('d4_cold');
    if (!d || !d.isOpen) return;
    d.nudge(0.13, 0.65);
    flare = 0.6;
    L.sfx('cold_jam_beep', -12.25, Y + 2.15, -27.3, 0.7);
    if (R.chance(0.35)) L.after(0.8, () => { d.nudge(0.08, 0.45); L.sfx('cold_jam_beep', -12.25, Y + 2.15, -27.3, 0.5); });
  });
}

const _corr_s_build = corr_s.build!;
corr_s.build = (L) => { _corr_s_build(L); installScripted(L); };

export const CLEAN_DRESS: Partial<Record<RoomId4, RoomDress>> = { vivarium, cold, records, bay, corr_w, corr_s, corr_e };
