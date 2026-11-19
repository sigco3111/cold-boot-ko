/**
 * BIOLOGICAL SYSTEMS — dressing kit (stage 3b §8.5, task W9b). Props for level 4's three looks: the clean side (a
 * working biotech lab: white HPL, stainless, black resin, glass), the navy checkpoint level and its tube plant room
 * (haze grey, steel, machinery paint), and the glass transfer tube. Original designs, metres, y up.
 *
 * Conventions (read before placing anything):
 *  - Every prop is authored in the builder's LOCAL frame and stamped with the transform stack:
 *    `b.at(x, y, z, ry, () => ultFreezer(b, L))`. Wall-normal → ry: face +z: 0 · −z: π · +x: π/2 · −x: −π/2.
 *  - FLOOR props: origin on the floor; FRONT = local +z.  WALL props (doc says "wall prop"): origin on the WALL FACE,
 *    back at local z = 0, front +z — put the origin on the room's interior wall face (wall centre ± 0.2).
 *    CEILING props: origin on the ceiling surface, hanging down (−y).
 *  - Draw calls: the builder merges per material per zone, so a prop costs one call per DISTINCT material it adds to
 *    its zone. Every static prop here uses ≤ 2 materials (listed as "calls" in each doc). Text goes through the zone's
 *    shared sign atlas (`b.sign`, one call per sign style per zone, shared by everything in the zone). Props with
 *    moving parts return them as separate objects (+1 call each, stated).
 *  - Colliders: `collide` (default true unless stated) adds static boxes with `b.collide` (nav obstacles). Glass
 *    collides as surface 'glass' (bullets star it). Turn colliders off where the W4 greybox already has them.
 *  - Emissive: everything glows ≤ 0.35 by default (lesson from 3a: nothing may read as a white bar through glass);
 *    the plan's exception is the emergency floor strip (1.2 when on, §8.11). Lamps that should follow a light take a
 *    `glow` material — pass `L.glow(handle, 'emissive_white', 0.09)` (≈ 0.35 of the library's 4.0) or `lumGlow(L)`.
 *  - Clean-side materials are the contract's `ClinicalMaterialName`s (W6). Until W6 lands they render as the dark
 *    fallback with a warning; the shapes are designed for the plan's look (white HPL, #4 stainless, frost, tyvek,
 *    haze grey 0x7b858c).
 *
 *  materials   mat4 · labWhite · binderBlue · machinery · glow4 · lumGlow · stripMat / setStrips · rackLedMat ·
 *              boomArmMat · dialFaceMat
 *  clean room  benchIsland · fumeHood · ultFreezer · labSink · penRow · sampleRack · cradleRack · lockerBank ·
 *              stepOverBench · suitRack · scrubSink · filingWall · serverRack · nozzleGrid · jetPanel · luminaire ·
 *              hepaDiffuser · floorStrip · clinicalSign · sticker
 *  navy        booth · boothConsole · boom · cageMesh · bentLeaf · weaponRack · vestHooks · ammoCan · bunk ·
 *              navyLockers · stencil · deckLine
 *  plant room  pumpSet · pipeTrunk · valveLever (moving handle) · sumpGrille (moving grille) · rotBeacon (moving
 *              rotor) · gaugePanel (moving needle)
 *  tube        tubeRib · tubeRoof (+ lit cable spine) · gratedDeck · bulkheadRing
 */
import * as THREE from 'three';
import type { Builder, Face, Mat, Rng } from '../builder';
import type { LevelBuild } from '../context';
import { extrude, lathe } from '../kit';
import { setDoorStyler } from '../doors';

export { alongWall, wallU } from '../l3/kit3';

const PI = Math.PI;
type WallFace = '+x' | '-x' | '+z' | '-z';

// ───────────────────────────────────────────────────────────── materials

const caches = new WeakMap<LevelBuild, Map<string, THREE.Material>>();
/** Per-level material cache (one material per key: props sharing a key share a draw call per zone). */
export function mat4<T extends THREE.Material>(L: LevelBuild, key: string, make: () => T): T {
  let c = caches.get(L);
  if (!c) caches.set(L, (c = new Map()));
  let m = c.get(key) as T | undefined;
  if (!m) { c.set(key, (m = make())); if (!m.name) m.name = key; }
  return m;
}
/** A flat paint (no maps), cached per colour + roughness. */
function paint4(L: LevelBuild, key: string, color: number, rough: number, metal = 0): THREE.MeshStandardMaterial {
  return mat4(L, `k4_${key}`, () => L.ctx.materials.clone('painted_white', {
    color, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: rough, metalness: metal,
  }));
}
/** Lab enamel white (cabinets, freezers, lockers, shelving) — clean, no chips; one material for the whole clean side. */
export const labWhite = (L: LevelBuild) => paint4(L, 'lab_white', 0xe6e9e8, 0.38);
/** Blue-grey binders and archive boxes (records). */
export const binderBlue = (L: LevelBuild) => paint4(L, 'binder_blue', 0x4f6378, 0.6);
/** Plant machinery paint (pumps, sea-water pipework, valve bodies): navy machinery green-grey. */
export const machinery = (L: LevelBuild) => paint4(L, 'machinery', 0x46594f, 0.5, 0.15);
/** Emissive panel material (cached per key): albedo pale, emissive `color` × `intensity` (≤ 0.35 by the rule). */
export function glow4(L: LevelBuild, key: string, color: number, intensity = 0.35, albedo = 0xdde4ea): THREE.MeshStandardMaterial {
  return mat4(L, `k4_glow_${key}`, () => {
    const m = L.ctx.materials.clone('emissive_white', { color: albedo });
    m.emissive = new THREE.Color(color);
    m.emissiveIntensity = intensity;
    return m;
  });
}
/** Default cool-white (6500 K) luminaire diffuser, 0.35. Bind it to a light yourself if it must go out with it. */
export const lumGlow = (L: LevelBuild, intensity = 0.35) => glow4(L, `lum_${intensity}`, 0xe8f0ff, intensity);

/**
 * Emergency floor-strip lens (§8.11): pale blue plastic, OFF (emissive 0) until `setStrips(L, 1)` = 0x6fa8ff at 1.2.
 * One material per level: every strip of every room switches together (`lights_out4`).
 */
export function stripMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'k4_strip', () => {
    const m = L.ctx.materials.clone('plastic_white', { color: 0xb9cbe0, roughness: 0.3, map: null, normalMap: null, roughnessMap: null, aoMap: null });
    m.emissive = new THREE.Color(0x6fa8ff);
    m.emissiveIntensity = 0;
    return m;
  });
}
/** Emergency strips on (k = 1 → 1.2) / off (0); any k in between dims them. */
export function setStrips(L: LevelBuild, k: number) { stripMat(L).emissiveIntensity = 1.2 * Math.max(0, k); }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, nearest = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}
function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Server-rack status LEDs: a 64 × 64 random field (green / amber / off) on a 1 m tile, sampled by each tiny LED quad
 * at its world position (box UVs); every 0.18 s the field jumps by whole texels, so each LED blinks on its own
 * rhythm. One material (and one updater) per level. Intensity ≤ 0.35 (seen through the Node 2 window).
 */
export function rackLedMat(L: LevelBuild, intensity = 0.7): THREE.MeshStandardMaterial {
  return mat4(L, 'k4_rack_led', () => {
    const r = srand(77);
    const tex = canvasTex(64, 64, (g) => {
      g.fillStyle = '#050605'; g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const k = r();
        if (k < 0.5) g.fillStyle = '#2bff5a'; else if (k < 0.58) g.fillStyle = '#ffae20'; else if (k < 0.62) g.fillStyle = '#3aa0ff'; else continue;
        g.fillRect(x, y, 1, 1);
      }
    }, true);
    const m = L.ctx.materials.clone('emissive_white', { color: 0x0a0b0b, map: null });
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = tex;
    m.emissiveIntensity = intensity;
    let acc = 0;
    const rr = srand(9);
    L.updaters.push((dt) => {
      acc += dt;
      if (acc < 0.18) return;
      acc = 0;
      tex.offset.set(Math.floor(rr() * 64) / 64, Math.floor(rr() * 64) / 64);
    });
    return m;
  });
}

/** Boom-barrier arm: white with red diagonal bands (box UVs, 1 m tile — reads the same raised or lowered). */
export function boomArmMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'k4_boom_arm', () => {
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#b8231c';
      // diagonal bands, 4 per tile (period 0.25 m along u + v), seamless
      for (let k = -8; k < 8; k++) {
        g.beginPath();
        const o = k * 64;
        g.moveTo(o, 0); g.lineTo(o + 32, 0); g.lineTo(o + 32 + 256, 256); g.lineTo(o + 256, 256); g.closePath(); g.fill();
      }
    });
    return L.ctx.materials.clone('plastic_white', { map: tex, color: 0xffffff, normalMap: null, roughnessMap: null, aoMap: null, roughness: 0.45, metalness: 0 });
  });
}

/** Δp dial face (0 … 4 bar, red sector above 3), for `gaugePanel`. */
export function dialFaceMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'k4_dial_face', () => {
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#ece9df'; g.fillRect(0, 0, 256, 256);
      const cx = 128, cy = 128, R = 104;
      const a0 = (-225 * PI) / 180, span = (270 * PI) / 180; // canvas angle: 0 = +x, clockwise
      const ang = (v: number) => a0 + (v / 4) * span;
      g.lineWidth = 14; g.strokeStyle = '#b3261c'; g.beginPath(); g.arc(cx, cy, R - 8, ang(3), ang(4)); g.stroke();
      g.lineWidth = 10; g.strokeStyle = '#2f7a3a'; g.beginPath(); g.arc(cx, cy, R - 8, ang(0), ang(0.3)); g.stroke();
      g.strokeStyle = '#151515'; g.fillStyle = '#151515';
      for (let i = 0; i <= 40; i++) {
        const a = ang(i / 10), big = i % 10 === 0, mid = i % 5 === 0;
        const r0 = R - (big ? 26 : mid ? 20 : 14);
        g.lineWidth = big ? 4 : 2;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
        if (big) { g.font = '700 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i / 10), cx + Math.cos(a) * (R - 44), cy + Math.sin(a) * (R - 44)); }
      }
      g.font = '700 20px Arial'; g.textAlign = 'center'; g.fillText('Δp  bar', cx, cy + 46);
      g.font = '600 13px Arial'; g.fillText('튜브 / 바다', cx, cy + 68);
    });
    return L.ctx.materials.clone('plastic_white', { map: tex, color: 0xffffff, normalMap: null, roughnessMap: null, aoMap: null, roughness: 0.3, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  });
}

// ───────────────────────────────────────────────────────────── helpers

const FACE_N: Record<Face, [number, number, number]> = {
  '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0],
};
/** World matrix of a local frame under the builder's current transform. */
function worldOf(b: Builder, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  return b.m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
}
/** World direction of a local direction under the builder's current transform. */
function dirOf(b: Builder, x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).transformDirection(b.m);
}

/** A moving part: `mount` carries the world transform (tagged with the builder's rooms, child of the level root);
 * `pivot` (its child) is what you rotate; the geometry is authored relative to the pivot. */
export interface MovingPart { mount: THREE.Group; pivot: THREE.Group }
function movingPart(b: Builder, L: LevelBuild, name: string, px: number, py: number, pz: number, make: (p: Builder) => void): MovingPart {
  const p = L.part(name);
  make(p);
  const g = p.build();
  const mount = new THREE.Group();
  mount.name = name;
  worldOf(b, px, py, pz).decompose(mount.position, mount.quaternion, mount.scale);
  mount.userData.rooms = b.rooms.slice();
  const pivot = new THREE.Group();
  pivot.name = `${name}:pivot`;
  pivot.add(g);
  mount.add(pivot);
  L.root.add(mount);
  return { mount, pivot };
}

// ═════════════════════════════════════════════════════════════ CLEAN ROOM

/**
 * Wet-lab bench island (§2.6 wetlab: nothing above 1.2 m). Floor prop, origin = floor centre, long axis local x,
 * working sides ±z (stools face it from both sides). Size `len` × `depth` (default 3.6 × 1.5), black resin worktops at
 * `top` (0.9), white base cabinets (doors, drawer stacks, one open knee space per side), a low service spine down the
 * middle to 1.15 m with power sockets, data ports and gas taps on both faces.
 * Calls: 2 (labWhite + plastic_dark). Collider: footprint to `top`, spine to 1.15 (`collide`).
 */
export function benchIsland(b: Builder, L: LevelBuild, o: { len?: number; depth?: number; top?: number; collide?: boolean } = {}) {
  const len = o.len ?? 3.6, d = o.depth ?? 1.5, h = o.top ?? 0.9, W = labWhite(L), K: Mat = 'plastic_dark';
  const sp = 0.1, edge = d / 2, cab = edge - 0.06; // spine half-width, worktop edge, cabinet front
  const n = Math.max(2, Math.round(len / 0.6)), uw = (len - 0.04) / n;
  for (const s of [-1, 1]) {
    // worktop (resin, 30 mm) with a 20 mm overhang, plinth recessed under the cabinets
    b.bx(K, -len / 2, h - 0.03, s * sp, len / 2, h, s * edge);
    b.bx(K, -len / 2 + 0.03, 0, s * (sp + 0.02), len / 2 - 0.03, 0.1, s * (cab - 0.06));
    // end panels
    for (const e of [-1, 1]) b.bx(W, e * len / 2 - (e > 0 ? 0.02 : 0), 0, s * sp, e * len / 2 + (e < 0 ? 0.02 : 0), h - 0.03, s * cab);
    for (let i = 0; i < n; i++) {
      const x0 = -len / 2 + 0.02 + i * uw, x1 = x0 + uw;
      const knee = i === (s > 0 ? n - 1 : 0) && n > 2;
      if (knee) { b.bx(W, x0, 0.1, s * sp, x1, h - 0.03, s * (sp + 0.02)); continue; } // knee space: modesty panel only
      b.bx(W, x0, 0.1, s * sp, x1, h - 0.03, s * (cab - 0.015));
      b.detail(() => {
        const zf = s * (cab - 0.015), zf1 = s * cab;
        const drawers = i % 3 === 1;
        if (drawers) {
          const hh = (h - 0.17) / 3;
          for (let k = 0; k < 3; k++) {
            const y0 = 0.11 + k * hh;
            b.bx(W, x0 + 0.003, y0 + 0.003, zf, x1 - 0.003, y0 + hh - 0.003, zf1);
            b.bx(K, (x0 + x1) / 2 - 0.07, y0 + hh - 0.05, zf1, (x0 + x1) / 2 + 0.07, y0 + hh - 0.035, zf1 + s * 0.018);
          }
        } else {
          b.bx(W, x0 + 0.003, 0.113, zf, x1 - 0.003, h - 0.063, zf1);
          b.bx(K, x1 - 0.05, h - 0.2, zf1, x1 - 0.035, h - 0.08, zf1 + s * 0.018);
        }
      });
    }
  }
  // service spine (to 1.15) with outlets on both faces
  b.bx(W, -len / 2 + 0.05, h, -sp, len / 2 - 0.05, 1.13, sp);
  b.bx(K, -len / 2 + 0.04, 1.13, -sp - 0.01, len / 2 - 0.04, 1.15, sp + 0.01);
  b.detail(() => {
    for (const s of [-1, 1]) {
      for (let x = -len / 2 + 0.45; x < len / 2 - 0.3; x += 0.9) {
        b.bx(K, x - 0.09, h + 0.07, s * sp, x + 0.09, h + 0.15, s * (sp + 0.008)); // double socket
        b.bx(K, x + 0.16, h + 0.08, s * sp, x + 0.22, h + 0.14, s * (sp + 0.008)); // data
        // gas tap: body, nozzle, lever
        b.cyl(K, x + 0.38, h + 0.11, s * (sp + 0.025), 0.018, 0.05, 'z', 8);
        b.rod(K, x + 0.38, h + 0.11, s * (sp + 0.05), x + 0.38, h + 0.06, s * (sp + 0.08), 0.006, 5);
        b.rbox(K, x + 0.38, h + 0.15, s * (sp + 0.04), 0.012, 0.06, 0.012, 0, 0, 0.7);
      }
    }
  });
  if (o.collide !== false) {
    b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'concrete', true);
    b.collide(-len / 2 + 0.05, h, -sp, len / 2 - 0.05, 1.15, sp, 'concrete', true);
  }
}

/**
 * Fume hood with a vertical glass sash (§2.6 wetlab, south wall). Wall prop: back at z 0, width `w` (1.8), depth 0.9,
 * body to 2.35 m; vented base cabinet, stainless work surface with an airfoil sill, slotted back baffle, sash raised
 * `sash` m above the work surface (0.3), exhaust duct to `ceil` (3.4, local height of the ceiling; 0 = no duct).
 * `glow` (optional) adds the hood's interior light strip (+1 call; use ≤ 0.35). `label` is the fascia plate text.
 * Calls: 2 (stainless + glass_clear: the sash is ONE pane = one transparent layer). Collider: the whole body
 * (the sash is solid: nothing in a hood is reachable through it, R8).
 */
export function fumeHood(b: Builder, L: LevelBuild, o: { w?: number; sash?: number; ceil?: number; glow?: Mat; label?: string; collide?: boolean } = {}) {
  const w = o.w ?? 1.8, d = 0.9, S: Mat = 'stainless', top = 2.35, ws = 0.9, open = Math.min(0.85, Math.max(0, o.sash ?? 0.3));
  // base: plinth, ventilated solvent cabinet (two doors)
  b.bx(S, -w / 2 + 0.04, 0, 0.02, w / 2 - 0.04, 0.1, d - 0.08);
  b.bx(S, -w / 2, 0.1, 0, w / 2, 0.85, d - 0.04);
  b.detail(() => {
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -w / 2 + 0.01 : 0.004, x1 = s < 0 ? -0.004 : w / 2 - 0.01;
      b.bx(S, x0, 0.12, d - 0.04, x1, 0.83, d - 0.025);
      b.bx(S, s < 0 ? x1 - 0.06 : x0 + 0.045, 0.62, d - 0.025, s < 0 ? x1 - 0.045 : x0 + 0.06, 0.78, d - 0.005);
      for (let k = 0; k < 4; k++) b.bx(S, x0 + 0.08, 0.2 + k * 0.035, d - 0.025, x1 - 0.08, 0.212 + k * 0.035, d - 0.02); // vent slots
    }
  });
  // work surface with a raised rim, airfoil sill rod along the front
  b.bx(S, -w / 2, 0.85, 0, w / 2, ws, d);
  b.rod(S, -w / 2 + 0.12, ws + 0.035, d - 0.03, w / 2 - 0.12, ws + 0.035, d - 0.03, 0.022, 8);
  // side posts, back wall + slotted baffle, ceiling, fascia
  for (const s of [-1, 1]) b.bx(S, s * w / 2 - (s > 0 ? 0.12 : 0), ws, 0, s * w / 2 + (s < 0 ? 0.12 : 0), top, d);
  b.bx(S, -w / 2 + 0.12, ws, 0, w / 2 - 0.12, top, 0.04);
  for (const [y0, y1] of [[ws + 0.05, ws + 0.12], [ws + 0.16, 1.62], [1.68, 2.2]] as const) b.bx(S, -w / 2 + 0.14, y0, 0.12, w / 2 - 0.14, y1, 0.14);
  b.bx(S, -w / 2 + 0.12, 2.2, 0.04, w / 2 - 0.12, top, d);
  b.bx(S, -w / 2 + 0.12, 1.85, d - 0.12, w / 2 - 0.12, 2.2, d);
  // sash: stiles in the post channels, bottom rail with a pull bar, one glass pane
  const sb = ws + 0.06 + open, zs = d - 0.06;
  b.bx(S, -w / 2 + 0.11, sb, zs - 0.02, w / 2 - 0.11, sb + 0.05, zs + 0.02);
  b.rod(S, -w / 2 + 0.3, sb + 0.025, zs + 0.05, w / 2 - 0.3, sb + 0.025, zs + 0.05, 0.012, 6);
  for (const s of [-1, 1]) b.rod(S, s * (w / 2 - 0.3), sb + 0.025, zs + 0.02, s * (w / 2 - 0.3), sb + 0.025, zs + 0.05, 0.008, 5);
  const gTop = Math.min(1.85, sb + 0.05 + 0.8);
  if (gTop > sb + 0.06) b.quad('glass_clear', 0, (sb + 0.05 + gTop) / 2, zs, w - 0.24, gTop - sb - 0.05, '+z');
  // airflow monitor on the right post, fascia plate
  b.detail(() => {
    b.bx(S, w / 2 - 0.1, 1.45, d, w / 2 - 0.02, 1.62, d + 0.02);
    b.sign('풍속\n0.5 m/s 정상', 'label', w / 2 - 0.06, 1.535, d + 0.021, 0.07, 0.14, '+z');
    if (o.label) b.sign(o.label, 'label', 0, 2.27, d + 0.002, Math.min(0.9, w * 0.5), 0.1, '+z');
  });
  if (o.glow) b.detail(() => b.bx(o.glow!, -w / 2 + 0.2, 2.17, d - 0.36, w / 2 - 0.2, 2.2, d - 0.2));
  const ceil = o.ceil ?? 3.4;
  if (ceil > top + 0.1) {
    b.cyl(S, 0, (top + ceil) / 2, 0.42, 0.15, ceil - top, 'y', 14);
    b.cyl(S, 0, top + 0.04, 0.42, 0.19, 0.08, 'y', 14);
  }
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, top, d, 'metal', true);
}

/**
 * Upright −80 °C freezer (ULT), 0.87 × 0.89 × 1.98. Wall prop (back at z 0, door +z). Insulated door with a gasket line,
 * a vertical lever handle and key lock, a control band with a dark display, kick grille, castors, side louvres, an
 * access port. `label` = the band's text (default "−80 °C"). Calls: 2 (labWhite + plastic_dark) + the zone's label
 * atlas. Collider: body.
 */
export function ultFreezer(b: Builder, L: LevelBuild, o: { label?: string; collide?: boolean } = {}) {
  const Wd = 0.87, D = 0.89, H = 1.98, W = labWhite(L), K: Mat = 'plastic_dark';
  b.bx(W, -Wd / 2, 0.08, 0, Wd / 2, H, D - 0.08);
  b.bx(W, -Wd / 2 + 0.012, 0.12, D - 0.08, Wd / 2 - 0.012, H - 0.22, D - 0.01); // door
  b.bx(W, -Wd / 2, H - 0.2, D - 0.08, Wd / 2, H, D - 0.03); // control band
  b.detail(() => {
    // gasket shadow line round the door
    b.bx(K, -Wd / 2 + 0.006, H - 0.222, D - 0.08, Wd / 2 - 0.006, H - 0.214, D - 0.012);
    b.bx(K, -Wd / 2 + 0.006, 0.112, D - 0.08, Wd / 2 - 0.006, 0.12, D - 0.012);
    // display + keys, label
    b.bx(K, -0.3, H - 0.15, D - 0.03, 0.02, H - 0.06, D - 0.022);
    for (let i = 0; i < 4; i++) b.bx(K, 0.08 + i * 0.045, H - 0.12, D - 0.03, 0.11 + i * 0.045, H - 0.09, D - 0.02);
    b.sign(o.label ?? '−80 °C', 'label', 0.3, H - 0.1, D - 0.029, 0.14, 0.07, '+z');
    // lever handle on two standoffs, key lock
    b.bx(K, Wd / 2 - 0.1, 0.78, D - 0.01, Wd / 2 - 0.06, 1.34, D + 0.05);
    for (const y of [0.82, 1.3]) b.bx(K, Wd / 2 - 0.095, y - 0.02, D - 0.01, Wd / 2 - 0.065, y + 0.02, D + 0.03);
    b.cyl(K, Wd / 2 - 0.08, 1.42, D - 0.005, 0.014, 0.012, 'z', 8);
    // kick grille, castors, side louvres, access port
    b.bx(K, -Wd / 2 + 0.03, 0.02, D - 0.1, Wd / 2 - 0.03, 0.08, D - 0.08);
    for (const sx of [-1, 1]) for (const z of [0.1, D - 0.18]) b.cyl(K, sx * (Wd / 2 - 0.08), 0.035, z, 0.035, 0.03, 'x', 8);
    for (let k = 0; k < 6; k++) b.bx(K, Wd / 2, 0.2 + k * 0.05, 0.15, Wd / 2 + 0.006, 0.225 + k * 0.05, 0.6);
    b.cyl(K, -Wd / 2 - 0.02, 1.45, 0.45, 0.04, 0.04, 'x', 10);
  });
  if (o.collide !== false) b.collide(-Wd / 2, 0, 0, Wd / 2, H, D, 'metal', true);
}

/**
 * Lab hand sink with gooseneck tap, wrist-blade levers, swing-arm eyewash, soap and towel dispensers. Wall prop
 * (back at z 0), `w` (1.2) × 0.6, worktop 0.9. Calls: 2 (stainless + plastic_dark). Collider: base cabinet.
 */
export function labSink(b: Builder, L: LevelBuild, o: { w?: number; eyewash?: boolean; collide?: boolean } = {}) {
  const w = o.w ?? 1.2, d = 0.6, h = 0.9, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  b.bx(S, -w / 2 + 0.03, 0, 0.02, w / 2 - 0.03, 0.1, d - 0.06);
  b.bx(S, -w / 2, 0.1, 0, w / 2, h - 0.04, d - 0.02);
  // top with an inset bowl (0.5 × 0.38, 0.22 deep), splashback
  const bx0 = -0.25, bx1 = 0.25, bz0 = 0.1, bz1 = 0.48;
  b.bx(S, -w / 2, h - 0.04, 0, bx0, h, d).bx(S, bx1, h - 0.04, 0, w / 2, h, d);
  b.bx(S, bx0, h - 0.04, 0, bx1, h, bz0).bx(S, bx0, h - 0.04, bz1, bx1, h, d);
  b.bx(S, bx0, h - 0.24, bz0, bx1, h - 0.22, bz1);
  b.bx(S, bx0 - 0.01, h - 0.24, bz0, bx0, h - 0.04, bz1).bx(S, bx1, h - 0.24, bz0, bx1 + 0.01, h - 0.04, bz1);
  b.bx(S, bx0, h - 0.24, bz0 - 0.01, bx1, h - 0.04, bz0).bx(S, bx0, h - 0.24, bz1, bx1, h - 0.04, bz1 + 0.01);
  b.bx(S, -w / 2, h, 0, w / 2, h + 0.3, 0.02);
  b.detail(() => {
    b.cyl(K, 0, h - 0.215, 0.3, 0.035, 0.006, 'y', 10); // drain
    // doors
    for (const s of [-1, 1]) b.bx(S, s < 0 ? -w / 2 + 0.01 : 0.004, 0.12, d - 0.02, s < 0 ? -0.004 : w / 2 - 0.01, h - 0.06, d - 0.008);
    // gooseneck + wrist blades
    b.rod(S, 0, h, 0.06, 0, h + 0.32, 0.06, 0.014, 8);
    const arc = [[0, h + 0.32, 0.06], [0, h + 0.38, 0.1], [0, h + 0.38, 0.16], [0, h + 0.33, 0.21], [0, h + 0.24, 0.23]] as const;
    for (let i = 0; i < arc.length - 1; i++) { const [p, q] = [arc[i], arc[i + 1]]; b.rod(S, p[0], p[1], p[2], q[0], q[1], q[2], 0.013, 8); }
    for (const s of [-1, 1]) { b.cyl(S, s * 0.1, h + 0.04, 0.06, 0.018, 0.08, 'y', 8); b.rbox(S, s * 0.16, h + 0.09, 0.06, 0.13, 0.012, 0.02, 0, 0, s * 0.25); }
    // soap (on the splashback), paper towels (on the wall above)
    b.bx(K, -w / 2 + 0.12, h + 0.12, 0.02, -w / 2 + 0.24, h + 0.3, 0.1);
    b.bx(S, -0.17, h + 0.5, 0, 0.17, h + 0.92, 0.12);
    b.bx(K, -0.12, h + 0.5, 0.06, 0.12, h + 0.52, 0.11);
    if (o.eyewash !== false) {
      // swing-arm eyewash on the right: post, arm, two cups, push flag
      const ex = w / 2 - 0.15;
      b.rod(S, ex, h, 0.1, ex, h + 0.12, 0.1, 0.012, 6);
      b.rod(S, ex, h + 0.12, 0.1, ex, h + 0.12, 0.38, 0.011, 6);
      for (const s of [-1, 1]) { b.cyl(K, ex + s * 0.05, h + 0.14, 0.38, 0.03, 0.04, 'y', 10, 0.04); b.rod(S, ex, h + 0.12, 0.38, ex + s * 0.05, h + 0.12, 0.38, 0.008, 5); }
      b.bx(K, ex - 0.06, h + 0.06, 0.24, ex + 0.06, h + 0.09, 0.3);
      b.sign('세안기', 'label', ex, h + 0.62, 0.0015, 0.2, 0.08, '+z');
    }
  });
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
}

/**
 * A row of `n` vivarium pens (§2.6 vivarium: row A 6 × 2.0 m against the wall, row B 5 pens glazed both faces). Floor
 * prop, origin = floor centre of the row, pens side by side along local x (`w` 2.0 each), depth `d` (2.4) along z,
 * height `h` (2.1, ≥ 1.75 = containment): stainless partitions, kerbs and top rails; a glazed front (+z) with a sliding
 * door, latch and track per pen; `back: 'wall'` (stainless sheet) or `'glass'` (glazed like the front); raised slatted
 * floors, drinker nipples, a cage-card holder on each front (`cards[i]`, 'label' atlas). All pens empty and clean.
 * Calls: 2 (stainless + glass_clear; one pane per face = one transparent layer per face). Collider: partitions and both
 * faces to `h` (glass = 'glass').
 */
export function penRow(b: Builder, L: LevelBuild, o: { n?: number; w?: number; d?: number; h?: number; back?: 'wall' | 'glass'; cards?: string[]; collide?: boolean } = {}) {
  const n = o.n ?? 6, w = o.w ?? 2.0, d = o.d ?? 2.4, h = o.h ?? 2.1, S: Mat = 'stainless', G: Mat = 'glass_clear';
  const x0 = -n * w / 2, len = n * w, back = o.back ?? 'wall';
  const face = (zf: number, sgn: number, cards: boolean) => {
    // kerb, top rail, sliding-door track
    b.bx(S, x0, 0, zf - 0.04, x0 + len, 0.25, zf + 0.04);
    b.bx(S, x0, h - 0.07, zf - 0.04, x0 + len, h, zf + 0.04);
    for (let i = 0; i < n; i++) {
      const a = x0 + i * w, c = a + w;
      b.quad(G, (a + c) / 2, (0.25 + h - 0.07) / 2, zf, w - 0.08, h - 0.32, sgn > 0 ? '+z' : '-z');
      b.detail(() => {
        // door: the pane's right half slides; mid stile, edge stile with a latch, track rail
        const m = a + w * 0.52;
        b.bx(S, m - 0.02, 0.25, zf - 0.025, m + 0.02, h - 0.07, zf + 0.025);
        b.bx(S, c - 0.11, 0.25, zf - 0.025, c - 0.07, h - 0.07, zf + 0.025);
        b.bx(S, c - 0.13, 1.0, zf + sgn * 0.025, c - 0.09, 1.16, zf + sgn * 0.05);
        b.bx(S, m, h - 0.1, zf + sgn * 0.04, c - 0.04, h - 0.07, zf + sgn * 0.06);
        if (cards) {
          const cx = a + w * 0.27;
          b.bx(S, cx - 0.1, 1.38, zf + sgn * 0.04, cx + 0.1, 1.52, zf + sgn * 0.046);
          const t = o.cards?.[i];
          if (t) b.sign(t, 'label', cx, 1.45, zf + sgn * 0.047, 0.17, 0.11, sgn > 0 ? '+z' : '-z');
        }
      });
    }
  };
  // partitions (n + 1), floor, faces
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * w;
    b.bx(S, x - 0.025, 0, -d / 2 + 0.04, x + 0.025, h, d / 2 - 0.04);
  }
  face(d / 2, 1, true);
  if (back === 'glass') face(-d / 2, -1, false);
  else b.bx(S, x0, 0, -d / 2, x0 + len, h, -d / 2 + 0.03);
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const a = x0 + i * w + 0.03, c = a + w - 0.06;
      for (let k = 0; k < 8; k++) { const z = -d / 2 + 0.08 + k * ((d - 0.16) / 8); b.bx(S, a, 0.03, z + 0.01, c, 0.055, z + (d - 0.16) / 8 - 0.015); }
      b.bx(S, a, 0, -d / 2 + 0.05, c, 0.03, d / 2 - 0.05);
      // drinker nipple on the left partition
      b.rod(S, a, 0.55, -0.3, a + 0.09, 0.5, -0.3, 0.008, 5);
      b.cyl(S, a + 0.01, 0.55, -0.3, 0.02, 0.03, 'x', 8);
    }
  });
  if (o.collide !== false) {
    for (let i = 0; i <= n; i++) { const x = x0 + i * w; b.collide(x - 0.025, 0, -d / 2, x + 0.025, h, d / 2, 'metal', true); }
    b.collide(x0, 0, d / 2 - 0.04, x0 + len, h, d / 2 + 0.04, 'glass', true);
    b.collide(x0, 0, -d / 2 - (back === 'glass' ? 0.04 : 0), x0 + len, h, -d / 2 + 0.04, back === 'glass' ? 'glass' : 'metal', true);
  }
}

/**
 * Wire sample-storage rack (cold store, freezer rooms): 4 posts, `shelves` wire shelves, stacks of 2-inch cryoboxes.
 * Wall prop (back at z 0), `w` × `d` × `h` (1.2 × 0.5 × 1.9). `frost` = boxes and shelf edges crusted with the
 * `frost` material (cold store); otherwise white boxes. Calls: 2 (stainless + plastic_white | frost). Collider: body.
 */
export function sampleRack(b: Builder, L: LevelBuild, R: Rng, o: { w?: number; d?: number; h?: number; shelves?: number; frost?: boolean; fill?: number; collide?: boolean } = {}) {
  const w = o.w ?? 1.2, d = o.d ?? 0.5, h = o.h ?? 1.9, ns = o.shelves ?? 5, S: Mat = 'stainless', B: Mat = o.frost ? 'frost' : 'plastic_white';
  for (const sx of [-1, 1]) for (const z of [0.03, d - 0.03]) b.rod(S, sx * (w / 2 - 0.02), 0, z, sx * (w / 2 - 0.02), h, z, 0.013, 6);
  for (let k = 0; k < ns; k++) {
    const y = 0.15 + k * ((h - 0.2) / (ns - 1));
    for (const z of [0.03, d - 0.03]) b.rod(S, -w / 2 + 0.02, y, z, w / 2 - 0.02, y, z, 0.007, 5);
    b.detail(() => {
      for (let x = -w / 2 + 0.06; x < w / 2 - 0.03; x += 0.05) b.rod(S, x, y + 0.006, 0.03, x, y + 0.006, d - 0.03, 0.003, 4);
      b.rod(S, -w / 2 + 0.02, y - 0.02, d / 2, w / 2 - 0.02, y - 0.02, d / 2, 0.006, 4);
      if (o.frost) b.bx(B, -w / 2 + 0.01, y + 0.005, d - 0.05, w / 2 - 0.01, y + 0.02, d - 0.012);
    });
    if (k === ns - 1 && h - y < 0.1) continue;
    const room = k < ns - 1 ? (h - 0.2) / (ns - 1) - 0.04 : 0.3;
    for (let x = -w / 2 + 0.05; x < w / 2 - 0.17; x += 0.145) {
      if (!R.chance(o.fill ?? 0.8)) continue;
      const stack = Math.max(1, Math.min(Math.floor(room / 0.055), R.int(1, 4)));
      const zc = R.chance(0.5) ? d * 0.32 : d * 0.66;
      for (let s = 0; s < stack; s++) b.box(B, x + 0.067 + R.range(-0.005, 0.005), y + 0.036 + s * 0.054, zc, 0.133, 0.052, 0.133);
    }
  }
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
}

/**
 * Clasp cradle rack (`mk4_cold_rack`, §2.6 cold: 24 slots, 5.0 × 1.2 on the north wall at y 5.4 … 6.6). Wall prop,
 * origin = bottom centre on the wall face. `cols` × `rows` docking bays (8 × 3): stainless back plate and shelves, a
 * black moulded U-cradle with a contact block per bay, a power bus along the top with a lead to every cradle.
 * Returns each slot's WORLD frame (`slots[i]`, matrix: origin = where a Clasp's centre sits, +z out of the wall,
 * +y up — a 9 cm Clasp lies along x in the cradle, LED facing +z) — W9a's Clasp goes there (instanced), row-major
 * from the top-left as seen from the room. Calls: 2 (stainless + plastic_dark). Collider: the plate (0.14 deep).
 */
export function cradleRack(b: Builder, L: LevelBuild, o: { cols?: number; rows?: number; w?: number; h?: number; collide?: boolean } = {}): { slots: THREE.Matrix4[] } {
  const cols = o.cols ?? 8, rows = o.rows ?? 3, w = o.w ?? 5.0, h = o.h ?? 1.2, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  const px = w / cols, py = h / rows;
  b.bx(S, -w / 2, 0, 0, w / 2, h, 0.015);
  b.bx(S, -w / 2 - 0.03, -0.03, 0, w / 2 + 0.03, 0, 0.06).bx(S, -w / 2 - 0.03, h, 0, w / 2 + 0.03, h + 0.03, 0.06);
  for (const s of [-1, 1]) b.bx(S, s * (w / 2) - (s > 0 ? 0 : 0.03), 0, 0, s * (w / 2) + (s > 0 ? 0.03 : 0), h, 0.06);
  // power bus along the top
  b.bx(K, -w / 2 + 0.05, h - 0.07, 0.015, w / 2 - 0.05, h - 0.02, 0.06);
  const slots: THREE.Matrix4[] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = h - (r + 1) * py; // bottom of this row's bay
    // shelf lip
    b.bx(S, -w / 2, y0 + 0.02, 0.015, w / 2, y0 + 0.035, 0.14);
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (c + 0.5) * px, yc = y0 + 0.035 + 0.075;
      // U-cradle: base, two cheeks, a back pad with the contact block
      b.bx(K, x - 0.075, y0 + 0.035, 0.03, x + 0.075, y0 + 0.06, 0.12);
      for (const s of [-1, 1]) b.bx(K, x + s * 0.075 - (s > 0 ? 0.018 : 0), y0 + 0.06, 0.03, x + s * 0.075 + (s < 0 ? 0.018 : 0), y0 + 0.13, 0.12);
      b.bx(K, x - 0.057, y0 + 0.06, 0.015, x + 0.057, y0 + 0.16, 0.035);
      b.detail(() => {
        b.bx(S, x - 0.02, y0 + 0.1, 0.035, x + 0.02, y0 + 0.13, 0.045);
        // lead up to the bus
        if (r === 0) b.rod(K, x + 0.04, y0 + 0.16, 0.03, x + 0.04, h - 0.07, 0.03, 0.006, 4);
        else b.rod(K, x + 0.04, y0 + 0.16, 0.03, x + 0.04, y0 + py, 0.03, 0.006, 4);
      });
      slots.push(worldOf(b, x, yc, 0.075));
    }
  }
  if (o.collide !== false) b.collide(-w / 2 - 0.03, -0.03, 0, w / 2 + 0.03, h + 0.03, 0.14, 'metal', true);
  return { slots };
}

/**
 * Clean-room locker bank (§2.6 gown: 10 lockers, names = the sign-out list; Sunde's open and empty). Wall prop, origin
 * = floor centre of the bank's back, lockers along x (`w` 0.4 each, `d` 0.5, `h` 1.9) under a 25° dust-shedding sloped
 * top; louvred doors, stainless pulls, a name holder per door (`names[i]`, 'label' atlas; '' = blank). `open` = indices
 * of open lockers (door swung ~110°, hollow inside: shelf, empty hook — reachable). Calls: 2 (labWhite + stainless).
 * Collider: closed runs as boxes, open lockers hollow.
 */
export function lockerBank(b: Builder, L: LevelBuild, o: { names: string[]; open?: number[]; w?: number; d?: number; h?: number; collide?: boolean }) {
  const n = o.names.length, w = o.w ?? 0.4, d = o.d ?? 0.5, h = o.h ?? 1.9, W = labWhite(L), S: Mat = 'stainless';
  const x0 = -n * w / 2, open = new Set(o.open ?? []), t = 0.018;
  b.bx(S, x0 + 0.01, 0, 0.02, -x0 - 0.01, 0.1, d - 0.04); // kick
  b.bx(W, x0, 0.1, 0, -x0, 0.12, d).bx(W, x0, h - t, 0, -x0, h, d).bx(W, x0, 0.1, 0, -x0, h, t);
  for (let i = 0; i <= n; i++) { const x = x0 + i * w; b.bx(W, x - t / 2, 0.1, 0, x + t / 2, h, d); }
  // sloped top + end cheeks
  const rise = Math.tan((25 * PI) / 180) * d, slope = Math.hypot(d, rise);
  b.rbox(W, 0, h + rise / 2, d / 2, n * w + 0.01, 0.015, slope, Math.atan2(rise, d), 0, 0);
  for (const e of [-1, 1]) extrude(b, W, [[0, h], [d, h], [0, h + rise]], 0.018, e < 0 ? x0 + 0.018 : -x0, 0, 0, -PI / 2);
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w + 0.003, c = a + w - 0.006;
    const op = open.has(i);
    b.detail(() => {
      if (op) { // inside: shelf, hook, nothing else
        b.bx(W, a + t / 2, 1.55, t, c - t / 2, 1.565, d - 0.02);
        b.rod(S, (a + c) / 2, 1.42, t, (a + c) / 2, 1.42, 0.08, 0.005, 5);
        b.rod(S, (a + c) / 2, 1.42, 0.08, (a + c) / 2, 1.46, 0.09, 0.005, 5);
      }
      b.push(a, 0, d, op ? -1.9 : 0);
      const dw = c - a;
      b.bx(W, 0, 0.13, 0, dw, h - 0.02, 0.018);
      for (let k = 0; k < 5; k++) b.bx(S, 0.08, h - 0.32 + k * 0.035, 0.018, dw - 0.08, h - 0.31 + k * 0.035, 0.022);
      b.bx(S, dw - 0.055, 0.95, 0.018, dw - 0.035, 1.15, 0.04);
      b.bx(S, dw / 2 - 0.08, 1.4, 0.018, dw / 2 + 0.08, 1.48, 0.022);
      const nm = o.names[i];
      if (nm) b.sign(nm, 'label', dw / 2, 1.44, 0.0225, 0.14, 0.06, '+z');
      b.pop();
    });
  }
  if (o.collide !== false) {
    let run = -1;
    const flush = (end: number) => { if (run >= 0) b.collide(x0 + run * w, 0, 0, x0 + end * w, h, d + 0.02, 'metal', true); run = -1; };
    for (let i = 0; i < n; i++) {
      if (open.has(i)) {
        flush(i);
        const a = x0 + i * w, c = a + w;
        b.collide(a, 0, 0, a + t, h, d, 'metal', true).collide(c - t, 0, 0, c, h, d, 'metal', true);
        b.collide(a, 0, 0, c, 0.12, d, 'metal', true).collide(a, h - t, 0, c, h, d, 'metal', true).collide(a, 0, 0, c, h, t, 'metal', true);
      } else if (run < 0) run = i;
    }
    flush(n);
  }
}

/**
 * Step-over bench (gowning: dirty side / clean side). Floor prop, origin = floor centre, along x, `len` (6.4) × 0.36,
 * seat `h` (0.45): white HPL seat on a stainless frame, perforated boot shelf beneath. Calls: 2 (labWhite + stainless).
 * Collider: footprint to the seat.
 */
export function stepOverBench(b: Builder, L: LevelBuild, o: { len?: number; h?: number; collide?: boolean } = {}) {
  const len = o.len ?? 6.4, h = o.h ?? 0.45, d = 0.36, W = labWhite(L), S: Mat = 'stainless';
  b.bx(W, -len / 2, h - 0.03, -d / 2, len / 2, h, d / 2);
  b.bx(S, -len / 2 + 0.03, h - 0.06, -d / 2 + 0.03, len / 2 - 0.03, h - 0.03, d / 2 - 0.03);
  const nl = Math.max(2, Math.round(len / 1.2) + 1);
  for (let i = 0; i < nl; i++) {
    const x = -len / 2 + 0.06 + (i * (len - 0.12)) / (nl - 1);
    for (const s of [-1, 1]) b.bx(S, x - 0.02, 0, s * (d / 2 - 0.05) - 0.02, x + 0.02, h - 0.06, s * (d / 2 - 0.05) + 0.02);
    b.bx(S, x - 0.02, 0.1, -d / 2 + 0.05, x + 0.02, 0.13, d / 2 - 0.05);
  }
  b.detail(() => { for (let k = 0; k < 6; k++) { const z = -d / 2 + 0.07 + k * 0.045; b.bx(S, -len / 2 + 0.06, 0.13, z, len / 2 - 0.06, 0.14, z + 0.025); } });
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'metal', true);
}

/**
 * Free-standing suit rack (gowning, east wall): two stainless end frames, a rail at 1.85, `hangers` (10) evenly spaced,
 * `suits` of them carrying a hung tyvek coverall (hood, sleeves, legs; the rest bare hangers — the suits went out
 * Monday), a shelf of overshoe boxes on top. Floor prop, origin = floor centre, rail along x, `len` (2.4) × 0.55.
 * Calls: 2 (stainless + tyvek). Collider: footprint to 1.95.
 */
export function suitRack(b: Builder, L: LevelBuild, R: Rng, o: { len?: number; hangers?: number; suits?: number; collide?: boolean } = {}) {
  const len = o.len ?? 2.4, nh = o.hangers ?? 10, ns = Math.min(nh, o.suits ?? 3), S: Mat = 'stainless', T: Mat = 'tyvek', rail = 1.85;
  for (const s of [-1, 1]) {
    const x = s * len / 2;
    b.rod(S, x, 0.04, -0.27, x, 0.04, 0.27, 0.016, 6);
    b.rod(S, x, 0.04, 0, x, 1.95, 0, 0.018, 6);
    for (const z of [-0.27, 0.27]) b.sphere(S, x, 0.025, z, 0.025, 6);
  }
  b.rod(S, -len / 2, rail, 0, len / 2, rail, 0, 0.014, 8);
  b.bx(S, -len / 2, 1.94, -0.2, len / 2, 1.955, 0.2);
  b.detail(() => {
    for (let i = 0; i < 4; i++) b.box(T, -len / 2 + 0.3 + i * 0.36 + R.range(-0.04, 0.04), 2.0, R.range(-0.06, 0.06), 0.3, 0.09, 0.22);
    const pick = new Set<number>();
    while (pick.size < ns) pick.add(R.int(0, nh - 1));
    for (let i = 0; i < nh; i++) {
      const x = -len / 2 + 0.15 + (i * (len - 0.3)) / Math.max(1, nh - 1);
      // hanger: hook + triangle
      b.rod(S, x, rail + 0.04, 0, x, rail - 0.04, 0, 0.004, 4);
      b.rod(S, x - 0.2, rail - 0.12, 0, x, rail - 0.04, 0, 0.004, 4).rod(S, x + 0.2, rail - 0.12, 0, x, rail - 0.04, 0, 0.004, 4);
      b.rod(S, x - 0.2, rail - 0.12, 0, x + 0.2, rail - 0.12, 0, 0.004, 4);
      if (!pick.has(i)) continue;
      const yaw = R.range(-0.25, 0.25);
      b.push(x, 0, 0, yaw);
      // hung coverall: hood folded over the hanger, shoulders, torso, sleeves, legs (front ±z of the rack)
      b.sphere(T, 0, rail - 0.06, 0.02, 0.13, 8, 0.75, 1, 0.55);
      b.rbox(T, 0, rail - 0.2, 0, 0.48, 0.1, 0.13, 0, 0, 0);
      b.rbox(T, 0, rail - 0.58, 0, 0.44, 0.7, 0.12, 0.02, 0, 0);
      for (const s of [-1, 1]) {
        b.rbox(T, s * 0.27, rail - 0.55, 0.01, 0.1, 0.62, 0.09, 0, 0, s * 0.08);
        b.rbox(T, s * 0.11, rail - 1.22, 0.0, 0.19, 0.66, 0.1, 0.01, 0, s * 0.02);
      }
      b.box(T, 0, rail - 0.62, 0.065, 0.02, 0.55, 0.01); // zip flap
      b.pop();
    }
  });
  if (o.collide !== false) b.collide(-len / 2 - 0.02, 0, -0.3, len / 2 + 0.02, 1.95, 0.3, 'rubber', true);
}

/**
 * Surgical scrub trough (scrub room, west wall): `stations` (3) stations at 0.8 m, each with a wall-fed gooseneck, a
 * knee paddle under the apron, a soap dispenser and a 3-minute scrub timer on the splashback. Wall prop (back at z 0),
 * 0.62 deep, rim 0.9, splashback to 1.5. Calls: 2 (stainless + plastic_dark). Collider: trough to the floor.
 */
export function scrubSink(b: Builder, L: LevelBuild, o: { stations?: number; collide?: boolean } = {}) {
  const n = o.stations ?? 3, len = n * 0.8 + 0.2, d = 0.62, h = 0.9, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  // trough: apron, ends, sloped basin, splashback, skirt to the floor
  b.bx(S, -len / 2, 0.62, d - 0.03, len / 2, h, d);
  for (const s of [-1, 1]) b.bx(S, s * len / 2 - (s > 0 ? 0.03 : 0), 0.62, 0, s * len / 2 + (s < 0 ? 0.03 : 0), h, d);
  b.rbox(S, 0, 0.66, d / 2, len - 0.06, 0.02, d - 0.04, 0.12, 0, 0);
  b.bx(S, -len / 2, 0.62, 0, len / 2, 1.5, 0.03);
  b.bx(S, -len / 2, 0.2, 0.02, len / 2, 0.62, 0.06);
  b.detail(() => {
    b.rod(S, -len / 2 + 0.02, h + 0.005, d - 0.015, len / 2 - 0.02, h + 0.005, d - 0.015, 0.016, 6); // rolled rim
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + 0.5 + i * 0.8;
      b.cyl(K, x, 0.645, d / 2 + 0.05, 0.03, 0.006, 'y', 8); // drain
      // wall-fed gooseneck
      b.rod(S, x, 1.28, 0.03, x, 1.28, 0.12, 0.015, 8);
      b.rod(S, x, 1.28, 0.12, x, 1.25, 0.25, 0.014, 8).rod(S, x, 1.25, 0.25, x, 1.15, 0.3, 0.013, 8);
      // knee paddle under the apron
      b.rod(S, x, 0.6, d - 0.02, x, 0.5, d + 0.03, 0.008, 5);
      b.bx(K, x - 0.09, 0.42, d + 0.02, x + 0.09, 0.52, d + 0.04);
      // soap dispenser + scrub timer
      b.bx(K, x + 0.22, 1.18, 0.03, x + 0.32, 1.42, 0.12);
      b.bx(K, x - 0.33, 1.32, 0.03, x - 0.17, 1.42, 0.06);
      b.cyl(S, x - 0.25, 1.37, 0.065, 0.03, 0.01, 'z', 10);
    }
  });
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d + 0.04, 'metal', true);
}

/**
 * Records filing wall: `len` (4.0) of steel shelving (bays 1.0 m, `h` 2.2, 0.42 deep) with lever-arch binders,
 * archive boxes, gaps and a lateral-file drawer bay at the bottom. Wall prop (back at z 0). Calls: 2 (labWhite +
 * binderBlue). Collider: body.
 */
export function filingWall(b: Builder, L: LevelBuild, R: Rng, o: { len?: number; h?: number; fill?: number; collide?: boolean } = {}) {
  const len = o.len ?? 4.0, h = o.h ?? 2.2, d = 0.42, W = labWhite(L), B = binderBlue(L);
  const nb = Math.max(1, Math.round(len / 1.0)), bw = len / nb, levels = 6, lh = (h - 0.12) / levels;
  for (let i = 0; i <= nb; i++) { const x = -len / 2 + i * bw; b.bx(W, x - 0.015, 0, 0, x + 0.015, h, d); }
  b.bx(W, -len / 2, 0, 0, len / 2, h, 0.01);
  for (let k = 0; k <= levels; k++) { const y = 0.08 + k * lh; b.bx(W, -len / 2, y - 0.012, 0.01, len / 2, y, d); }
  for (let i = 0; i < nb; i++) {
    const a = -len / 2 + i * bw + 0.02, c = a + bw - 0.04;
    // bottom level: two lateral-file drawers
    b.detail(() => {
      for (let k = 0; k < 2; k++) {
        const y0 = 0.085 + k * (lh / 2);
        b.bx(W, a, y0, d - 0.03, c, y0 + lh / 2 - 0.008, d);
        b.bx(W, (a + c) / 2 - 0.08, y0 + lh / 4 - 0.01, d, (a + c) / 2 + 0.08, y0 + lh / 4 + 0.01, d + 0.02);
      }
    });
    for (let k = 1; k < levels; k++) {
      const y = 0.08 + k * lh;
      let x = a;
      const fill = o.fill ?? 0.85;
      while (x < c - 0.06) {
        if (!R.chance(fill)) { x += R.range(0.1, 0.25); continue; }
        if (R.chance(0.35)) { // archive box
          const bwid = 0.1;
          if (x + bwid > c) break;
          b.box(B, x + bwid / 2, y + 0.13, d / 2 + 0.02, bwid - 0.004, 0.26, 0.33);
          x += bwid;
        } else { // a run of binders, the last ones leaning
          const k2 = R.int(3, 9);
          for (let j = 0; j < k2 && x + 0.06 < c; j++) {
            const lean = j === k2 - 1 && R.chance(0.4) ? 0.25 : 0;
            b.rbox(B, x + 0.03 + lean * 0.14, y + 0.15, d / 2 + 0.03, 0.055, 0.3, 0.28, 0, 0, -lean);
            x += 0.058 + lean * 0.16;
          }
        }
      }
    }
  }
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
}

/**
 * 42U server rack, open front (Node 2: 6 racks; seen through its window): frame, mixed 1U/2U servers with vent
 * grooves and drive bays, blanking panels, cable management, per-unit status LEDs on `rackLedMat` (blinking, shared).
 * Floor prop, origin = floor centre, front +z, 0.6 × 1.07 × 2.0. Calls: 2 (plastic_dark + LED). Collider: body.
 */
export function serverRack(b: Builder, L: LevelBuild, R: Rng, o: { led?: Mat; collide?: boolean } = {}) {
  const w = 0.6, d = 1.07, h = 2.0, K: Mat = 'plastic_dark', LED = o.led ?? rackLedMat(L), zf = d / 2;
  b.bx(K, -w / 2, 0, -d / 2, w / 2, 0.06, d / 2); // base
  b.bx(K, -w / 2, h - 0.04, -d / 2, w / 2, h, d / 2);
  for (const s of [-1, 1]) b.bx(K, s * w / 2 - (s > 0 ? 0.02 : 0), 0.06, -d / 2, s * w / 2 + (s < 0 ? 0.02 : 0), h - 0.04, d / 2);
  b.bx(K, -w / 2 + 0.02, 0.06, -d / 2, w / 2 - 0.02, h - 0.04, -d / 2 + 0.02);
  // rails + the stack of units
  for (const s of [-1, 1]) b.bx(K, s * 0.24 - 0.012, 0.08, zf - 0.08, s * 0.24 + 0.012, h - 0.06, zf - 0.05);
  const U = 0.0445;
  let y = 0.1;
  while (y < h - 0.12) {
    const u = R.pick([1, 1, 2, 2, 2, 3, 4]), hh = u * U;
    if (y + hh > h - 0.08) break;
    const blank = R.chance(0.14);
    const proud = blank ? 0 : R.range(0.0, 0.02);
    b.bx(K, -0.225, y + 0.002, -d / 2 + 0.12, 0.225, y + hh - 0.002, zf - 0.06 + proud);
    if (!blank) b.detail(() => {
      const zz = zf - 0.06 + proud;
      for (let g = 0; g < u * 2; g++) b.bx(K, -0.2, y + 0.008 + g * (hh / (u * 2)), zz, -0.02, y + 0.012 + g * (hh / (u * 2)), zz + 0.003);
      if (u >= 2) for (let k = 0; k < 4; k++) b.bx(K, 0.01 + k * 0.05, y + 0.01, zz, 0.055 + k * 0.05, y + hh - 0.012, zz + 0.004);
      const nl = R.int(2, 5);
      for (let k = 0; k < nl; k++) b.quad(LED, 0.2 - k * 0.012, y + hh - 0.012, zz + 0.0045, 0.006, 0.006, '+z', 0, 'box');
    });
    y += hh;
  }
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}

/** Spray nozzle frames returned by `nozzleGrid` / `jetPanel`: world tip positions and the (shared) world spray direction. */
export interface Nozzles { points: THREE.Vector3[]; dir: THREE.Vector3 }

/**
 * Decon nozzle grid (lock4: 12 nozzles = e.g. two grids of 2 × 3). Wall prop, origin = centre of the grid on the wall:
 * a stainless manifold plate, a feed pipe across each row, `rows` × `cols` nozzle stubs at `pitch` (0.5) with dark
 * orifices. Returns world tip points + spray direction (for fx emitters). Calls: 2 (stainless + plastic_dark). No collider.
 */
export function nozzleGrid(b: Builder, L: LevelBuild, o: { rows?: number; cols?: number; pitch?: number } = {}): Nozzles {
  const rows = o.rows ?? 2, cols = o.cols ?? 3, p = o.pitch ?? 0.5, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  const w = (cols - 1) * p + 0.2, h = (rows - 1) * p + 0.2;
  b.bx(S, -w / 2, -h / 2, 0, w / 2, h / 2, 0.008);
  const points: THREE.Vector3[] = [];
  for (let r = 0; r < rows; r++) {
    const y = -((rows - 1) * p) / 2 + r * p;
    b.rod(S, -w / 2 + 0.03, y, 0.03, w / 2 - 0.03, y, 0.03, 0.016, 8);
    for (let c = 0; c < cols; c++) {
      const x = -((cols - 1) * p) / 2 + c * p;
      b.cyl(S, x, y, 0.06, 0.014, 0.05, 'z', 8);
      b.cyl(S, x, y, 0.095, 0.024, 0.026, 'z', 10, 0.016);
      b.detail(() => b.cyl(K, x, y, 0.109, 0.009, 0.002, 'z', 8));
      points.push(b.world(x, y, 0.11));
    }
  }
  return { points, dir: dirOf(b, 0, 0, 1) };
}

/**
 * Air-shower jet wall (shower side walls: 3 × 4 jets each). Wall prop, origin = bottom centre on the wall face:
 * perforated stainless panel `w` × `h` (2.4 × 2.2) — fine horizontal perforation bands over a dark plenum — with
 * `cols` × `rows` ball-socket jets (flanged, aimable) between 0.45 and 2.0 m. Returns world jet points + direction.
 * Calls: 2 (stainless + plastic_dark). No collider (the wall is the collider).
 */
export function jetPanel(b: Builder, L: LevelBuild, o: { w?: number; h?: number; cols?: number; rows?: number } = {}): Nozzles {
  const w = o.w ?? 2.4, h = o.h ?? 2.2, cols = o.cols ?? 3, rows = o.rows ?? 4, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  b.bx(K, -w / 2 + 0.06, 0.06, 0, w / 2 - 0.06, h - 0.06, 0.006);
  // frame + perforation bands (slats 18 mm with 12 mm gaps)
  b.bx(S, -w / 2, 0, 0, w / 2, 0.06, 0.03).bx(S, -w / 2, h - 0.06, 0, w / 2, h, 0.03);
  b.bx(S, -w / 2, 0.06, 0, -w / 2 + 0.06, h - 0.06, 0.03).bx(S, w / 2 - 0.06, 0.06, 0, w / 2, h - 0.06, 0.03);
  b.detail(() => { for (let y = 0.075; y < h - 0.08; y += 0.03) b.bx(S, -w / 2 + 0.06, y, 0.012, w / 2 - 0.06, y + 0.018, 0.016); });
  const points: THREE.Vector3[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + 0.3 + (c * (w - 0.6)) / Math.max(1, cols - 1), y = 0.45 + (r * 1.55) / Math.max(1, rows - 1);
    b.bx(S, x - 0.06, y - 0.06, 0.016, x + 0.06, y + 0.06, 0.028);
    b.sphere(S, x, y, 0.035, 0.035, 10);
    b.detail(() => b.cyl(K, x, y, 0.069, 0.011, 0.004, 'z', 8));
    points.push(b.world(x, y, 0.072));
  }
  return { points, dir: dirOf(b, 0, 0, 1) };
}

/**
 * Flush sealed clean-room luminaire (6500 K). Ceiling prop, origin on the ceiling surface: stainless frame `w` × `len`
 * (0.6 × 1.2, long axis x), opal diffuser recessed 5 mm (`glow`, default `lumGlow(L)` = 0.35; pass the room light's
 * bound material to make it go out at lights-out). Calls: 2 (stainless + glow). No collider.
 */
export function luminaire(b: Builder, L: LevelBuild, o: { w?: number; len?: number; glow?: Mat } = {}) {
  const w = o.w ?? 0.6, len = o.len ?? 1.2, S: Mat = 'stainless', G = o.glow ?? lumGlow(L), f = 0.035;
  b.detail(() => {
    b.bx(S, -len / 2, -0.025, -w / 2, len / 2, 0, -w / 2 + f).bx(S, -len / 2, -0.025, w / 2 - f, len / 2, 0, w / 2);
    b.bx(S, -len / 2, -0.025, -w / 2 + f, -len / 2 + f, 0, w / 2 - f).bx(S, len / 2 - f, -0.025, -w / 2 + f, len / 2, 0, w / 2 - f);
    b.bx(G, -len / 2 + f, -0.02, -w / 2 + f, len / 2 - f, -0.004, w / 2 - f);
  });
}

/**
 * HEPA terminal diffuser (0.6 × 0.6): perforated stainless face over a dark plenum, a centre deflector. Ceiling prop.
 * Calls: 2 (stainless + plastic_dark). No collider.
 */
export function hepaDiffuser(b: Builder, L: LevelBuild, o: { w?: number } = {}) {
  const w = o.w ?? 0.6, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  b.detail(() => {
    b.bx(K, -w / 2 + 0.04, -0.006, -w / 2 + 0.04, w / 2 - 0.04, -0.002, w / 2 - 0.04);
    b.bx(S, -w / 2, -0.03, -w / 2, w / 2, 0, -w / 2 + 0.04).bx(S, -w / 2, -0.03, w / 2 - 0.04, w / 2, 0, w / 2);
    b.bx(S, -w / 2, -0.03, -w / 2 + 0.04, -w / 2 + 0.04, 0, w / 2 - 0.04).bx(S, w / 2 - 0.04, -0.03, -w / 2 + 0.04, w / 2, 0, w / 2 - 0.04);
    for (let k = 1; k < 12; k++) {
      const t = -w / 2 + 0.04 + (k * (w - 0.08)) / 12;
      b.bx(S, t - 0.006, -0.012, -w / 2 + 0.04, t + 0.006, -0.006, w / 2 - 0.04);
      b.bx(S, -w / 2 + 0.04, -0.012, t - 0.006, w / 2 - 0.04, -0.006, t + 0.006);
    }
    b.cyl(S, 0, -0.03, 0, 0.12, 0.012, 'y', 16);
  });
}

/**
 * Emergency floor strip (§8.11: 4 cm lens, 0x6fa8ff, emissive 1.2 after lights-out via `setStrips`), from (ax, az) to
 * (bx, bz) on the floor at local `y` (0): an aluminium channel 6 cm wide, 9 mm high, with the lens on top. Run it 0.08 m
 * off the wall base (clear of the coving). Calls: 2 (stainless + stripMat, shared by every strip of the level).
 */
export function floorStrip(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number, o: { y?: number; mat?: Mat } = {}) {
  const y = o.y ?? 0, len = Math.hypot(bx - ax, bz - az);
  if (len < 0.05) return;
  const ry = Math.atan2(bx - ax, bz - az), M = o.mat ?? stripMat(L);
  b.push((ax + bx) / 2, y, (az + bz) / 2, ry);
  b.detail(() => {
    b.bx('stainless', -0.03, 0, -len / 2, 0.03, 0.007, len / 2);
    b.bx(M, -0.02, 0.006, -len / 2 + 0.01, 0.02, 0.012, len / 2 - 0.01); // (lens 5 mm proud of the channel: B5)
  });
  b.pop();
}

/**
 * Bio-Sys wall sign (blue-grey `clinical` style, W6): text on a stainless backing plate 6 mm proud. Same placement
 * arguments as `b.sign` (centre on the wall surface, `face` = its outward normal); arrows inside the text as the
 * signs module parses them (e.g. '← COLD STORE 2 · VIVARIUM'). Calls: 1 (stainless) + the clinical atlas.
 */
export function clinicalSign(b: Builder, L: LevelBuild, text: string, x: number, y: number, z: number, w: number, h: number, face: Face, o: { plate?: boolean } = {}) {
  const n = FACE_N[face];
  b.detail(() => {
    if (o.plate !== false) {
      const t = 0.006, cx = x + n[0] * t / 2, cy = y + n[1] * t / 2, cz = z + n[2] * t / 2;
      const ax = Math.abs(n[0]) > 0.5, az = Math.abs(n[2]) > 0.5;
      b.box('stainless', cx, cy, cz, ax ? t : w + 0.03, az || ax ? h + 0.03 : t, az ? t : ax ? w + 0.03 : h + 0.03);
      b.sign(text, 'clinical', x + n[0] * t, y + n[1] * t, z + n[2] * t, w, h, face);
    } else b.sign(text, 'clinical', x, y, z, w, h, face);
  });
}

/** A stuck-on label sticker (default `FUMIGATED — MON 08:41`, yellow 'warning' style), slightly askew. Atlas only. */
export function sticker(b: Builder, x: number, y: number, z: number, face: Face, o: { text?: string; w?: number; h?: number; rot?: number } = {}) {
  b.detail(() => b.sign(o.text ?? 'FUMIGATED — MON 08:41', 'warning', x, y, z, o.w ?? 0.3, o.h ?? 0.1, face, o.rot ?? 0.03));
}

// ═════════════════════════════════════════════════════════════ NAVY

/**
 * Guard booth (§2.6 chk: x 26.0 … 30.0, z −58.4 … −55.2 → place at (28.0, 0, −56.8), ry 0). Floor prop, origin =
 * floor centre, `w` (4.0, x) × `d` (3.2, z). Faces: −z (south) and +x (east) = 1.0 m steel kerb + bulletproof glass to
 * 2.4 (mullions every ~1.3 m, a speaking grille and a document deal tray in the south pane); −x (west) = solid wall with
 * a doorway `door` = [z0, z1] local (default −0.6 … 0.4 = the plan's z −57.4 … −56.4); +z (north) is open (the room
 * wall); roof slab at 2.6 (the navy sentry dock sits over it at 3.6). Calls: 2 (navy_grey + glass_thick: one pane per
 * face = one layer). Collider: kerbs, glass ('glass'), west wall, roof.
 */
export function booth(b: Builder, L: LevelBuild, o: { w?: number; d?: number; door?: [number, number]; collide?: boolean } = {}) {
  const w = o.w ?? 4.0, d = o.d ?? 3.2, N: Mat = 'navy_grey', G: Mat = 'glass_thick', kerb = 1.0, gt = 2.4, roof = 2.6;
  const [dz0, dz1] = o.door ?? [-0.6, 0.4];
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, t = 0.12;
  // south (−z) and east (+x) kerbs + header band 2.4 … 2.6
  b.bx(N, x0, 0, z0, x1, kerb, z0 + t).bx(N, x1 - t, 0, z0 + t, x1, kerb, z1);
  b.bx(N, x0, gt, z0, x1, roof, z0 + t).bx(N, x1 - t, gt, z0 + t, x1, roof, z1);
  // kerb cap (a sill the guard leans on)
  b.bx(N, x0, kerb, z0 - 0.03, x1 + 0.03, kerb + 0.03, z0 + t + 0.08).bx(N, x1 - t - 0.08, kerb, z0 + t + 0.08, x1 + 0.03, kerb + 0.03, z1);
  // glass + mullions
  const zs = z0 + t / 2, xs = x1 - t / 2;
  b.quad(G, (x0 + 0.06 + x1 - 0.06) / 2, (kerb + 0.03 + gt) / 2, zs, w - 0.12, gt - kerb - 0.03, '-z');
  b.quad(G, xs, (kerb + 0.03 + gt) / 2, (z0 + 0.06 + z1) / 2, d - 0.06, gt - kerb - 0.03, '+x');
  const posts = (a: number, c: number, along: 'x' | 'z') => {
    const n = Math.max(1, Math.round((c - a) / 1.3));
    for (let i = 0; i <= n; i++) {
      const u = a + (i * (c - a)) / n;
      if (along === 'x') b.bx(N, u - 0.04, kerb, z0, u + 0.04, gt, z0 + t);
      else b.bx(N, x1 - t, kerb, u - 0.04, x1, gt, u + 0.04);
    }
  };
  posts(x0 + 0.04, x1 - 0.04, 'x');
  posts(z0 + 0.04, z1 - 0.04, 'z');
  // west wall with the doorway (to 2.1), roof slab
  b.bx(N, x0, 0, z0, x0 + t, roof, dz0).bx(N, x0, 0, dz1, x0 + t, roof, z1).bx(N, x0, 2.1, dz0, x0 + t, roof, dz1);
  b.bx(N, x0 - 0.05, roof, z0 - 0.05, x1 + 0.05, roof + 0.12, z1);
  b.detail(() => {
    // speaking grille (round) + deal tray in the south pane, door casing
    const gx = 0.6;
    b.cyl(N, gx, 1.55, zs, 0.11, t + 0.02, 'z', 16);
    for (let k = -3; k <= 3; k++) b.bx(N, gx - 0.09, 1.55 + k * 0.025 - 0.004, zs - t / 2 - 0.012, gx + 0.09, 1.55 + k * 0.025 + 0.004, zs - t / 2 - 0.005);
    b.bx(N, gx - 0.25, kerb - 0.12, z0 - 0.12, gx + 0.25, kerb - 0.02, z0 + t + 0.12);
    for (const z of [dz0, dz1]) b.bx(N, x0 - 0.03, 0, z - (z === dz0 ? 0.06 : 0), x0 + t + 0.03, 2.16, z + (z === dz1 ? 0.06 : 0));
    b.bx(N, x0 - 0.03, 2.1, dz0 - 0.06, x0 + t + 0.03, 2.18, dz1 + 0.06);
  });
  if (o.collide !== false) {
    b.collide(x0, 0, z0, x1, kerb, z0 + t, 'metal', true).collide(x1 - t, 0, z0 + t, x1, kerb, z1, 'metal', true);
    b.collide(x0, kerb, z0, x1, roof, z0 + t, 'glass', true).collide(x1 - t, kerb, z0 + t, x1, roof, z1, 'glass', true);
    b.collide(x0, 0, z0, x0 + t, roof, dz0, 'metal', true).collide(x0, 0, dz1, x0 + t, roof, z1, 'metal', true).collide(x0, 2.1, dz0, x0 + t, roof, dz1, 'metal', true);
    b.collide(x0 - 0.05, roof, z0 - 0.05, x1 + 0.05, roof + 0.12, z1, 'metal', true);
  }
}

/**
 * Booth console (along the booth's north side). Wall prop (back at z 0 on the wall, the operator stands at +z):
 * desk `len` (3.2) × 0.6 at 0.78 with a lino top, an instrument riser 0.35 deep to 1.9 with a sloped lower face, a desk
 * phone and a gooseneck microphone (both facing the operator). Recesses (local, on the riser) for what W4/D3a mount:
 * `term4_ctrl` terminal at (+0.8, 1.05, 0.35), `booth_panel` status screen at (0, 1.5, 0.35), `booth_release` guarded
 * button at (−0.8, 1.0, 0.36) — with origin (28.0, 0, −55.2) and ry π these land on the plan's coordinates.
 * Returns those three local points in WORLD space. Calls: 2 (navy_grey + plastic_dark). Collider: desk + riser.
 */
export function boothConsole(b: Builder, L: LevelBuild, o: { len?: number; collide?: boolean } = {}): { terminal: THREE.Vector3; panel: THREE.Vector3; release: THREE.Vector3 } {
  const len = o.len ?? 3.2, N: Mat = 'navy_grey', K: Mat = 'plastic_dark', top = 0.78;
  b.bx(N, -len / 2, 0, 0, len / 2, top - 0.03, 0.55);
  b.bx(K, -len / 2 - 0.01, top - 0.03, 0, len / 2 + 0.01, top, 0.6);
  // riser: vertical upper face (z 0.35) from 1.2 to 1.9, sloped lower face from the desk (z 0.42) up to it
  b.bx(N, -len / 2, top, 0, len / 2, 1.9, 0.3);
  b.bx(N, -len / 2, 1.2, 0.3, len / 2, 1.9, 0.35);
  const sl = Math.hypot(1.2 - top, 0.12);
  b.rbox(N, 0, (top + 1.2) / 2, 0.36, len, sl, 0.05, -Math.atan2(0.12, 1.2 - top), 0, 0);
  b.detail(() => {
    // modesty panel + drawer pedestal
    b.bx(N, len / 2 - 0.45, 0.04, 0.55, len / 2 - 0.02, top - 0.04, 0.57);
    for (let k = 0; k < 3; k++) b.bx(K, len / 2 - 0.3, 0.15 + k * 0.22, 0.57, len / 2 - 0.17, 0.17 + k * 0.22, 0.59);
    // recess frames (dark bezels): terminal, status screen, release guard
    b.bx(K, 0.8 - 0.3, 1.05 - 0.2, 0.34, 0.8 + 0.3, 1.05 + 0.2, 0.365);
    b.bx(K, -0.45, 1.5 - 0.25, 0.35, 0.45, 1.5 + 0.25, 0.356);
    b.bx(K, -0.8 - 0.1, 1.0 - 0.1, 0.36, -0.8 + 0.1, 1.0 + 0.1, 0.375);
    for (const s of [-1, 1]) b.bx(K, -0.8 + s * 0.095 - 0.01, 0.9, 0.375, -0.8 + s * 0.095 + 0.01, 1.1, 0.43); // guard cheeks
    // desk phone (keypad rising away from the operator at +z) and its cord
    b.push(0.35, top, 0.45, 0);
    b.rbox(K, 0, 0.03, 0, 0.2, 0.06, 0.2, 0.15, 0, 0);
    b.rbox(K, -0.065, 0.085, 0, 0.06, 0.045, 0.21, 0, 0, 0);
    for (let i = 0; i < 12; i++) b.box(N, 0.01 + (i % 3) * 0.035, 0.068 + Math.floor(i / 3) * 0.006, 0.05 - Math.floor(i / 3) * 0.032, 0.022, 0.006, 0.02);
    b.pop();
    // gooseneck microphone on a base, head toward the operator
    b.cyl(K, -0.25, top + 0.01, 0.4, 0.05, 0.02, 'y', 10);
    b.rod(K, -0.25, top + 0.02, 0.4, -0.25, top + 0.25, 0.44, 0.007, 5);
    b.rod(K, -0.25, top + 0.25, 0.44, -0.25, top + 0.3, 0.52, 0.007, 5);
    b.cyl(K, -0.25, top + 0.3, 0.54, 0.014, 0.05, 'z', 8);
    // logbook + pen
    b.rbox(N, -1.1, top + 0.012, 0.42, 0.3, 0.024, 0.22, 0, 0.1, 0);
  });
  if (o.collide !== false) { b.collide(-len / 2, 0, 0, len / 2, top, 0.6, 'metal', true); b.collide(-len / 2, top, 0, len / 2, 1.9, 0.38, 'metal', true); }
  return { terminal: b.world(0.8, 1.05, 0.37), panel: b.world(0, 1.5, 0.357), release: b.world(-0.8, 1.0, 0.376) };
}

/**
 * Raised boom barrier (§2.6 chk, (30.5, 0, −65.5)). Floor prop, origin = floor centre of the housing; arm (`len` 3.0)
 * pivots at 1.0 m and points along local +x when lowered, raised `angle` (65°; keep the tip, 1.0 + len·sin(angle),
 * under the ceiling); counterweight on the short side, a rest post at `len` for the lowered state (`rest`).
 * Calls: 2 (navy_grey + boomArmMat). Collider: the housing.
 */
export function boom(b: Builder, L: LevelBuild, o: { len?: number; angle?: number; rest?: boolean; collide?: boolean } = {}) {
  const len = o.len ?? 3.0, ang = ((o.angle ?? 65) * PI) / 180, N: Mat = 'navy_grey', A = boomArmMat(L);
  b.bx(N, -0.2, 0, -0.2, 0.2, 0.06, 0.2);
  b.bx(N, -0.16, 0.06, -0.16, 0.16, 0.95, 0.16);
  b.bx(N, -0.17, 0.95, -0.17, 0.17, 1.0, 0.17);
  b.detail(() => {
    b.bx(N, -0.14, 0.3, 0.16, 0.14, 0.75, 0.175); // service door
    b.cyl(N, 0, 1.0, 0.0, 0.07, 0.4, 'z', 10); // pivot hub
  });
  b.push(0, 1.0, 0.0, 0, 0, ang);
  b.bx(A, 0.05, -0.05, -0.04, len, 0.05, 0.04);
  b.bx(N, -0.75, -0.08, -0.06, -0.08, 0.08, 0.06); // counterweight
  b.bx(N, -0.08, -0.06, -0.05, 0.12, 0.06, 0.05);
  b.pop();
  if (o.rest) {
    b.bx(N, len - 0.06, 0, -0.06, len + 0.06, 0.95, 0.06);
    b.bx(N, len - 0.1, 0.95, -0.06, len + 0.1, 1.0, 0.06);
  }
  if (o.collide !== false) b.collide(-0.2, 0, -0.2, 0.2, 1.0, 0.2, 'metal', true);
}

/**
 * Armoury cage mesh (§2.6 chk cage x 35.0 … 39.8, z −66.8 … −62.6, mesh to the ceiling). Coordinates in the builder's
 * frame (pass world values with b at identity). `faces` = which sides get mesh (default all four; for the plan's cage
 * only '+z' (north) and '-x' (west) — the others are room walls); `gaps` = openings [face, u0, u1] in world x/z along
 * that face (the plan's door gap: ['+z', 36.6, 38.2]); posts every ~1.2 m, a mid rail and a head rail.
 * Calls: 2 (floor_grate mesh, alpha-tested + navy_grey frame). Collider: every mesh panel to `h` (containment).
 */
export function cageMesh(b: Builder, L: LevelBuild, o: { x0: number; x1: number; z0: number; z1: number; h?: number; faces?: WallFace[]; gaps?: [WallFace, number, number][]; collide?: boolean }) {
  const h = o.h ?? 4.0, N: Mat = 'navy_grey', M: Mat = 'floor_grate', faces = o.faces ?? ['+z', '-z', '+x', '-x'];
  const t = 0.05;
  for (const f of faces) {
    const alongX = f === '+z' || f === '-z';
    const a = alongX ? o.x0 : o.z0, c = alongX ? o.x1 : o.z1, fixed = f === '+z' ? o.z1 : f === '-z' ? o.z0 : f === '+x' ? o.x1 : o.x0;
    // runs between gaps
    const gaps = (o.gaps ?? []).filter((g) => g[0] === f).map((g) => [Math.min(g[1], g[2]), Math.max(g[1], g[2])] as [number, number]).sort((p, q) => p[0] - q[0]);
    const runs: [number, number][] = [];
    let u = a;
    for (const [g0, g1] of gaps) { if (g0 > u) runs.push([u, g0]); u = Math.max(u, g1); }
    if (u < c) runs.push([u, c]);
    const at = (u0: number, u1: number, y0: number, y1: number, th = t) => alongX ? b.bx(N, u0, y0, fixed - th / 2, u1, y1, fixed + th / 2) : b.bx(N, fixed - th / 2, y0, u0, fixed + th / 2, y1, u1);
    for (const [r0, r1] of runs) {
      const n = Math.max(1, Math.round((r1 - r0) / 1.2));
      for (let i = 0; i <= n; i++) { const p = r0 + (i * (r1 - r0)) / n; at(p - 0.04, p + 0.04, 0, h, 0.08); }
      at(r0, r1, 0, 0.08); at(r0, r1, 1.1, 1.16); at(r0, r1, 2.3, 2.36); at(r0, r1, h - 0.08, h);
      const mid = (r0 + r1) / 2, len = r1 - r0;
      b.solid(() => { if (alongX) b.quad(M, mid, h / 2, fixed, len, h, '+z', 0, 'box'); else b.quad(M, fixed, h / 2, mid, len, h, '+x', 0, 'box'); });
      if (o.collide !== false) {
        if (alongX) b.collide(r0, 0, fixed - 0.03, r1, h, fixed + 0.03, 'metal', true);
        else b.collide(fixed - 0.03, 0, r0, fixed + 0.03, h, r1, 'metal', true);
      }
    }
    // door frame at each gap (posts + head at 2.2)
    for (const [g0, g1] of gaps) { at(g0 - 0.05, g0 + 0.03, 0, h, 0.1); at(g1 - 0.03, g1 + 0.05, 0, h, 0.1); at(g0, g1, 2.2, 2.28, 0.1); }
  }
}

/**
 * The cage's door leaf, pried open and bent (Eng's fire axe). Floor prop, origin = the hinge foot; closed, the leaf runs
 * along local +x for `w` (1.6) at height 0.05 … 2.15; it stands swung open by `open` (1.9 rad, outward = toward −z of
 * the local frame — pick ry so that is out of the cage), its free bottom corner folded out along a diagonal crease,
 * the lock hasp torn and hanging. Calls: 2 (floor_grate + navy_grey). No collider (decor; the gap stays clear).
 */
export function bentLeaf(b: Builder, L: LevelBuild, o: { w?: number; open?: number } = {}) {
  const w = o.w ?? 1.6, N: Mat = 'navy_grey', M: Mat = 'floor_grate', y0 = 0.05, y1 = 2.15;
  b.push(0, 0, 0, o.open ?? 1.9);
  // hinges on the post side
  b.detail(() => { for (const y of [0.3, 1.1, 1.9]) b.cyl(N, 0, y, 0, 0.025, 0.12, 'y', 8); });
  // upper part: full width from 0.9 up
  const fr = (x0: number, x1: number, a: number, c: number) => {
    b.bx(N, x0, a, -0.02, x1, a + 0.04, 0.02).bx(N, x0, c - 0.04, -0.02, x1, c, 0.02);
    b.bx(N, x0, a, -0.02, x0 + 0.04, c, 0.02).bx(N, x1 - 0.04, a, -0.02, x1, c, 0.02);
    b.solid(() => b.quad(M, (x0 + x1) / 2, (a + c) / 2, 0, x1 - x0 - 0.04, c - a - 0.04, '+z', 0, 'box'));
  };
  fr(0.02, w, 0.9, y1);
  fr(0.02, w * 0.45, y0, 0.9);
  // the bent corner: lower outer panel folded 40° out about a vertical crease at 0.45 w and buckled down
  b.push(w * 0.45, 0, 0, -0.7, 0, -0.06);
  fr(0.0, w * 0.55, y0 + 0.04, 0.9);
  b.pop();
  // hasp torn off, hanging from the free edge on a bent tab
  b.detail(() => { b.rbox(N, w - 0.04, 1.05, 0.04, 0.03, 0.14, 0.012, 0, 0, 0.5); b.torus(N, w - 0.01, 0.95, 0.05, 0.03, 0.006, 'z', 10); });
  b.pop();
}

/**
 * Armoury weapon rack (cage, east wall). Wall prop (back at z 0), `w` (1.2): three tiers of padded pegs at 0.75 / 1.15
 * / 1.55 m (a carbine lies across a tier — `p4_carbine` at 1.2 rests on the middle one), a hinged lock bar swung up,
 * a broken padlock, butt mat at the bottom. Calls: 2 (gunmetal + rubber). Collider: thin (0.24 deep) to 1.8.
 */
export function weaponRack(b: Builder, L: LevelBuild, o: { w?: number; collide?: boolean } = {}) {
  const w = o.w ?? 1.2, G: Mat = 'gunmetal', R: Mat = 'rubber';
  // open frame on the wall: two uprights, a wall rail behind each tier, the wall shows through
  for (const s of [-1, 1]) b.bx(G, s * w / 2 - (s > 0 ? 0.05 : 0), 0.0, 0, s * w / 2 + (s < 0 ? 0.05 : 0), 1.8, 0.07);
  b.bx(G, -w / 2, 1.74, 0, w / 2, 1.8, 0.07);
  for (const y of [0.75, 1.15, 1.55]) {
    b.bx(G, -w / 2, y - 0.07, 0, w / 2, y - 0.02, 0.04);
    // padded J-pegs: arm out, upturned tip, rubber sleeve
    for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) {
      b.rod(G, x, y - 0.045, 0.04, x, y - 0.03, 0.2, 0.014, 6);
      b.rod(G, x, y - 0.03, 0.2, x, y + 0.04, 0.23, 0.012, 6);
      b.cyl(R, x, y - 0.035, 0.14, 0.024, 0.12, 'z', 8);
    }
  }
  // lock bar swung up on its hinge, broken padlock hanging from the hasp
  b.rbox(G, -w / 2 + 0.55, 1.88, 0.12, 1.1, 0.04, 0.02, 0, 0, 0.5);
  b.detail(() => {
    b.box(G, w / 2 - 0.06, 1.3, 0.09, 0.03, 0.08, 0.04);
    b.box(G, w / 2 - 0.06, 1.2, 0.1, 0.05, 0.06, 0.025);
    b.torus(G, w / 2 - 0.06, 1.25, 0.1, 0.018, 0.004, 'z', 8);
    b.bx(R, -w / 2 + 0.05, 0, 0.0, w / 2 - 0.05, 0.03, 0.3);
  });
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, 1.8, 0.24, 'metal', true);
}

/**
 * Body-armour hooks (cage). Wall prop (back at z 0): a rail at `y` (1.75) with `n` (3) J-hooks at `pitch` (0.6); the
 * vest pickups (§2.6: centre y 1.4) hang from them. A stencil `방탄복` above. Calls: 1 (navy_grey) + stencil atlas.
 */
export function vestHooks(b: Builder, L: LevelBuild, o: { n?: number; pitch?: number; y?: number } = {}) {
  const n = o.n ?? 3, p = o.pitch ?? 0.6, y = o.y ?? 1.75, N: Mat = 'navy_grey', w = (n - 1) * p + 0.3;
  b.bx(N, -w / 2, y - 0.05, 0, w / 2, y + 0.05, 0.02);
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * p) / 2 + i * p;
      b.rod(N, x, y, 0.02, x, y - 0.02, 0.12, 0.01, 6).rod(N, x, y - 0.02, 0.12, x, y + 0.04, 0.15, 0.01, 6);
    }
    b.sign('방탄복', 'stencil', 0, y + 0.22, 0.002, Math.min(w, 1.0), 0.14, '+z');
  });
}

/**
 * Steel ammunition can (dressing, not a pickup): 0.29 × 0.19 × 0.155, lid latch, carry handle, stencilled `label`
 * (default '7.62 × 39 — 420발') on the long side (+z). Floor/shelf prop, origin = bottom centre. `open` = lid
 * flipped back, empty. Calls: 2 (painted olive + steel_raw) + stencil atlas. Collider: optional (`collide`, off).
 */
export function ammoCan(b: Builder, L: LevelBuild, o: { label?: string | null; open?: boolean; collide?: boolean } = {}) {
  const O = paint4(L, 'ammo_olive', 0x4d5545, 0.55), S: Mat = 'steel_raw', w = 0.29, h = 0.155, d = 0.19;
  b.bx(O, -w / 2, 0, -d / 2, w / 2, h, d / 2);
  if (o.open) b.rbox(O, 0, h + 0.07, -d / 2 - 0.02, w, 0.02, 0.15, -1.3, 0, 0);
  else b.bx(O, -w / 2 - 0.004, h, -d / 2 - 0.004, w / 2 + 0.004, h + 0.02, d / 2 + 0.004);
  b.detail(() => {
    if (!o.open) { b.bx(S, w / 2 + 0.004, h - 0.05, -0.03, w / 2 + 0.012, h + 0.02, 0.03); b.rod(S, -0.06, h + 0.025, 0, 0.06, h + 0.025, 0, 0.007, 5); }
    for (const s of [-1, 1]) b.bx(O, -w / 2, 0.03 + (s > 0 ? 0.07 : 0), d / 2, w / 2, 0.04 + (s > 0 ? 0.07 : 0), d / 2 + 0.004);
    if (o.label !== null) b.sign(o.label ?? '7.62 × 39 — 420발', 'stencil', 0, 0.075, d / 2 + 0.005, 0.24, 0.05, '+z');
  });
  if (o.collide) b.collide(-w / 2, 0, -d / 2, w / 2, h + 0.02, d / 2, 'metal', true);
}

/**
 * Navy two-tier bunk (guard room). Floor prop, origin = floor centre, long axis x, `len` 2.0 × 0.85, tiers at 0.42 and
 * 1.45 (`tiers` 1 | 2), tubular haze-grey frame, end ladder, rails on the upper tier, mattresses, a folded blanket
 * and pillow on each `made` tier (others bare, blanket thrown back). Calls: 2 (navy_grey + fabric). Collider:
 * footprint to the top rail.
 */
export function bunk(b: Builder, L: LevelBuild, o: { len?: number; tiers?: 1 | 2; made?: boolean[]; collide?: boolean } = {}) {
  const len = o.len ?? 2.0, w = 0.85, N: Mat = 'navy_grey', F: Mat = 'fabric', tiers = o.tiers ?? 2;
  const ys = tiers === 2 ? [0.42, 1.45] : [0.42], topY = ys[ys.length - 1] + 0.35;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(N, sx * (len / 2 - 0.02), 0, sz * (w / 2 - 0.02), sx * (len / 2 - 0.02), topY, sz * (w / 2 - 0.02), 0.022, 8);
  ys.forEach((y, i) => {
    for (const sz of [-1, 1]) b.rod(N, -len / 2, y - 0.04, sz * (w / 2 - 0.02), len / 2, y - 0.04, sz * (w / 2 - 0.02), 0.018, 6);
    for (const sx of [-1, 1]) { b.rod(N, sx * (len / 2 - 0.02), y - 0.04, -w / 2, sx * (len / 2 - 0.02), y - 0.04, w / 2, 0.018, 6); b.bx(N, sx * (len / 2 - 0.02) - 0.01, y, -w / 2 + 0.02, sx * (len / 2 - 0.02) + 0.01, y + 0.3, w / 2 - 0.02); }
    b.bx(N, -len / 2 + 0.03, y - 0.05, -w / 2 + 0.03, len / 2 - 0.03, y - 0.03, w / 2 - 0.03); // spring deck
    b.bx(F, -len / 2 + 0.05, y - 0.03, -w / 2 + 0.05, len / 2 - 0.05, y + 0.1, w / 2 - 0.05); // mattress
    const made = o.made?.[i] ?? i === 0;
    b.detail(() => {
      if (made) {
        b.bx(F, -len / 2 + 0.06, y + 0.1, -w / 2 + 0.06, len / 2 - 0.45, y + 0.13, w / 2 - 0.06);
        b.rbox(F, -len / 2 + 0.25, y + 0.17, 0, 0.3, 0.08, 0.55, 0, 0, 0.05);
      } else {
        b.rbox(F, len / 2 - 0.35, y + 0.14, 0.05, 0.55, 0.1, w - 0.12, 0, 0.15, 0);
        b.rbox(F, -len / 2 + 0.25, y + 0.15, -0.1, 0.32, 0.08, 0.5, 0.1, 0.4, 0.05);
      }
    });
    if (i > 0) for (const sz of [-1, 1]) b.rod(N, -len / 2 + 0.1, y + 0.32, sz * (w / 2 - 0.02), len / 2 - 0.1, y + 0.32, sz * (w / 2 - 0.02), 0.014, 6);
  });
  // ladder at the +x end
  if (tiers === 2) b.detail(() => { for (let k = 1; k <= 4; k++) b.rod(N, len / 2 - 0.02, k * 0.28, -w / 2 + 0.15, len / 2 - 0.02, k * 0.28, w / 2 - 0.15, 0.012, 5); });
  if (o.collide !== false) b.collide(-len / 2, 0, -w / 2, len / 2, topY, w / 2, 'rubber', true);
}

/**
 * A row of navy steel lockers (guard room). Wall prop (back at z 0), `n` (2) lockers 0.45 × 0.5 × 1.85 along x, haze
 * grey with vent slots, a lever handle and a card holder each; `open` = indices standing ajar (empty inside).
 * Calls: 2 (navy_grey + steel_raw). Collider: one box over the row (ajar doors included).
 */
export function navyLockers(b: Builder, L: LevelBuild, o: { n?: number; open?: number[]; collide?: boolean } = {}) {
  const n = o.n ?? 2, w = 0.45, d = 0.5, h = 1.85, N: Mat = 'navy_grey', S: Mat = 'steel_raw', x0 = -n * w / 2, open = new Set(o.open ?? []);
  b.bx(N, x0, 0, 0, -x0, 0.08, d - 0.02).bx(N, x0, h - 0.02, 0, -x0, h, d).bx(N, x0, 0, 0, -x0, h, 0.02);
  for (let i = 0; i <= n; i++) { const x = x0 + i * w; b.bx(N, x - 0.01, 0, 0, x + 0.01, h, d); }
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w + 0.004, dw = w - 0.008, ajar = open.has(i);
    b.push(a, 0, d, ajar ? -0.55 : 0);
    b.bx(N, 0, 0.09, 0, dw, h - 0.03, 0.02);
    b.detail(() => {
      for (let k = 0; k < 5; k++) b.bx(S, 0.1, h - 0.3 + k * 0.03, 0.02, dw - 0.1, h - 0.29 + k * 0.03, 0.024);
      for (let k = 0; k < 5; k++) b.bx(S, 0.1, 0.2 + k * 0.03, 0.02, dw - 0.1, 0.21 + k * 0.03, 0.024);
      b.bx(S, dw - 0.07, 0.9, 0.02, dw - 0.04, 1.08, 0.05);
      b.bx(S, dw / 2 - 0.06, 1.4, 0.02, dw / 2 + 0.06, 1.46, 0.024);
    });
    b.pop();
  }
  if (o.collide !== false) b.collide(x0, 0, 0, -x0, h, d + 0.05, 'metal', true);
}

/** Spray-painted stencil (navy markings: frame numbers, `해군 검문소 2`, `NO WEAPONS BEYOND THIS POINT`). Atlas only. */
export function stencil(b: Builder, text: string, x: number, y: number, z: number, w: number, h: number, face: Face, rot = 0) {
  b.detail(() => b.sign(text, 'stencil', x, y, z, w, h, face, rot));
}
/**
 * Painted deck line (walkway edge / hold-back line) from (ax, az) to (bx, bz) on the floor at `y` (0): `w` (0.08) wide,
 * yellow (`color` 'yellow' | 'white' | 'red'), polygon-offset overlay paint (no z-fight). Calls: 1 per colour.
 */
export function deckLine(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number, o: { w?: number; y?: number; color?: 'yellow' | 'white' | 'red' } = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.02) return;
  const col = { yellow: 0xc9a227, white: 0xd6d8d4, red: 0xa3221b }[o.color ?? 'yellow'];
  const m = mat4(L, `k4_deckline_${o.color ?? 'yellow'}`, () => L.ctx.materials.clone('painted_white', { color: col, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  b.push((ax + bx) / 2, o.y ?? 0, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
  b.detail(() => b.quad(m, 0, 0.001, 0, o.w ?? 0.08, len, '+y', 0, 'box'));
  b.pop();
}

// ═════════════════════════════════════════════════════════════ PLANT ROOM

/**
 * Tube-plant pump set (§2.6 plant4: A x 47.0 … 50.0, z −63.0 … −60.0 / B x 47 … 50, z −58 … −55, h 1.6, cover for
 * the holdout). Floor prop, origin = floor centre, `w` × `d` (3.0 × 3.0), nothing above `h` (1.6): a channel-steel skid,
 * two motor–pump trains along x (duty / standby) — finned motors with fan cowls, coupling guards, centrifugal volutes —
 * suction and discharge pipework rising into a common header along z at 1.35 with flanged gate valves, a local starter
 * box. Calls: 2 (machinery + steel_raw). Collider: one box `w` × `d` × `h` (cover).
 */
export function pumpSet(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; collide?: boolean } = {}) {
  const w = o.w ?? 3.0, d = o.d ?? 3.0, h = o.h ?? 1.6, P = machinery(L), S: Mat = 'steel_raw';
  // skid
  b.bx(S, -w / 2, 0, -d / 2, w / 2, 0.06, d / 2);
  for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) b.bx(S, -w / 2, 0.06, z - 0.05, w / 2, 0.2, z + 0.05);
  for (const zc of [-0.65, 0.55]) {
    b.bx(S, -w / 2 + 0.1, 0.06, zc - 0.32, w / 2 - 0.3, 0.2, zc + 0.32); // plinth
    // motor (finned), fan cowl at −x
    const my = 0.55, mx0 = -w / 2 + 0.25, mx1 = -0.1;
    b.cyl(P, (mx0 + mx1) / 2, my, zc, 0.3, mx1 - mx0, 'x', 16);
    b.detail(() => { for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; b.rbox(P, (mx0 + mx1) / 2, my + Math.sin(a) * 0.31, zc + Math.cos(a) * 0.31, mx1 - mx0 - 0.1, 0.04, 0.012, a, 0, 0); } });
    b.cyl(P, mx0 - 0.06, my, zc, 0.27, 0.14, 'x', 16, 0.3);
    b.bx(P, mx0 + 0.15, 0.2, zc - 0.28, mx1 - 0.15, 0.3, zc + 0.28); // feet
    b.bx(P, (mx0 + mx1) / 2 - 0.12, my + 0.3, zc - 0.1, (mx0 + mx1) / 2 + 0.12, my + 0.42, zc + 0.1); // terminal box
    // coupling guard, pump volute + bearing frame
    b.bx(P, mx1, my - 0.12, zc - 0.12, mx1 + 0.35, my + 0.12, zc + 0.12);
    b.cyl(S, mx1 + 0.45, my, zc, 0.12, 0.25, 'x', 12);
    const vx = mx1 + 0.8;
    b.cyl(P, vx, my, zc, 0.36, 0.3, 'x', 18);
    b.sphere(P, vx, my, zc, 0.32, 14, 1, 0.55, 1);
    b.bx(P, vx - 0.2, 0.2, zc - 0.22, vx + 0.2, my - 0.2, zc + 0.22);
    // suction (end, +x) and discharge (top) pipework to the header
    b.cyl(P, vx + 0.3, my, zc, 0.12, 0.3, 'x', 12);
    b.cyl(S, vx + 0.47, my, zc, 0.17, 0.04, 'x', 14);
    b.cyl(P, vx, my + 0.48, zc, 0.1, 0.3, 'y', 12);
    b.cyl(S, vx, my + 0.65, zc, 0.15, 0.04, 'y', 14);
    b.cyl(P, vx, my + 0.72, zc, 0.11, 0.12, 'y', 12);
    // gate valve on the discharge with a hand wheel
    b.cyl(S, vx, 1.42, zc + 0.0, 0.06, 0.1, 'y', 8);
  }
  // header along z at 1.35 (top 1.5) over both discharges, suction header along z at the +x end
  const vx = -0.1 + 0.8; // = the volutes' x (motor end mx1 −0.1 + 0.8)
  b.cyl(P, vx, 1.35, -0.05, 0.13, 1.9, 'z', 14);
  for (const z of [-1.0, 0.9]) b.cyl(S, vx, 1.35, z, 0.18, 0.05, 'z', 14);
  b.cyl(P, w / 2 - 0.18, 0.55, -0.05, 0.15, 1.9, 'z', 14);
  for (const zc of [-0.65, 0.55]) b.cyl(P, (vx + 0.47 + w / 2 - 0.18) / 2, 0.55, zc, 0.12, w / 2 - 0.18 - vx - 0.47, 'x', 12);
  b.detail(() => {
    for (const zc of [-0.65, 0.55]) { b.torus(S, vx, 1.49, zc, 0.12, 0.012, 'y', 14); b.rod(S, vx - 0.12, 1.49, zc, vx + 0.12, 1.49, zc, 0.008, 4); }
    // local starter box on a stand at the −x end, gauges on the header
    b.bx(S, -w / 2 + 0.05, 0.2, d / 2 - 0.25, -w / 2 + 0.1, 1.5, d / 2 - 0.2);
    b.bx(P, -w / 2 + 0.1, 1.0, d / 2 - 0.42, -w / 2 + 0.35, 1.45, d / 2 - 0.12);
    b.cyl(S, -w / 2 + 0.36, 1.32, d / 2 - 0.27, 0.025, 0.03, 'x', 8);
    for (const z of [-0.6, 0.5]) { b.rod(S, vx, 1.48, z, vx, 1.55, z, 0.01, 5); b.cyl(S, vx, 1.59, z, 0.045, 0.03, 'z', 12); }
  });
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}

/**
 * Pipe trunk through the deck (§2.6 plant4, (53.0, −56.0)). Floor prop, origin = floor centre of the trunk: three
 * sea-water risers (r 0.2 / 0.15 / 0.1) from deck penetration sleeves to the ceiling `h` (4.5), flanged every ~1.5 m,
 * a two-level support frame clamping them, green sea-water bands and a stencilled flow arrow. Calls: 2 (machinery +
 * steel_raw) + stencil atlas. Collider: the cluster's box to `h`.
 */
export function pipeTrunk(b: Builder, L: LevelBuild, o: { h?: number; collide?: boolean } = {}) {
  const h = o.h ?? 4.5, P = machinery(L), S: Mat = 'steel_raw';
  const pipes: [number, number, number][] = [[-0.28, -0.05, 0.2], [0.22, 0.12, 0.15], [0.2, -0.28, 0.1]];
  for (const [x, z, r] of pipes) {
    b.cyl(P, x, h / 2, z, r, h, 'y', r > 0.12 ? 16 : 12);
    b.cyl(S, x, 0.06, z, r + 0.08, 0.12, 'y', 16); // deck sleeve
    for (let y = 1.2; y < h - 0.3; y += 1.5) b.cyl(S, x, y, z, r * 1.4, 0.05, 'y', 16);
  }
  for (const y of [1.0, 3.0]) {
    b.bx(S, -0.6, y - 0.04, -0.45, 0.5, y + 0.04, -0.38).bx(S, -0.6, y - 0.04, 0.32, 0.5, y + 0.04, 0.39);
    b.bx(S, -0.6, y - 0.04, -0.45, -0.53, y + 0.04, 0.39).bx(S, 0.43, y - 0.04, -0.45, 0.5, y + 0.04, 0.39);
  }
  b.detail(() => {
    for (const [x, z, r] of pipes) b.cyl(S, x, 1.8, z, r + 0.004, 0.12, 'y', 16); // band
    b.sign('해수 ↑ 튜브 Δp', 'stencil', -0.28, 2.2, -0.05 + 0.205, 0.3, 0.12, '+z', -PI / 2);
  });
  if (o.collide !== false) b.collide(-0.6, 0, -0.45, 0.5, h, 0.39, 'metal', true);
}

/** Handle of `valveLever`: rotate with `set(k)` (0 = shut, 1 = open). */
export interface ValveHandle extends MovingPart { set(k: number): void }
/**
 * Equalising valve with a 1.2 m lever (`valve4`, §2.6: (55.75, 1.2, −59.0) facing −x; vignette `valve_open`). Wall
 * prop (back at z 0 on the wall, origin on the floor below the valve): a horizontal sea-water pipe along the wall at
 * 0.95 (0.28 out), elbowing into the wall at ±`span`/2 (0.8), a flanged quarter-turn ball valve whose stem rises to the
 * lever pivot at 1.2; a stencil and an OPEN / SHUT quadrant plate. The LEVER is a moving part (`handle.pivot` rotates
 * about y): shut = pointing straight out into the room (+z, 1.2 m — across the flow), open = swung 90° to lie along
 * the pipe (toward local −x). `set(k)` interpolates. Calls: 2 static (machinery + steel_raw) + 2 moving (steel_raw +
 * painted_orange grip). No collider on the lever (the player walks through its arc); pipe collider optional (off).
 */
export function valveLever(b: Builder, L: LevelBuild, o: { name?: string; span?: number; collide?: boolean } = {}): ValveHandle {
  const P = machinery(L), S: Mat = 'steel_raw', span = o.span ?? 1.6, py = 0.95, pz = 0.28, piv = 1.2;
  for (const s of [-1, 1]) {
    b.cyl(P, s * span / 4 + s * 0.08, py, pz, 0.09, span / 2 - 0.16, 'x', 14);
    b.sphere(P, s * span / 2, py, pz, 0.1, 12);
    b.cyl(P, s * span / 2, py, pz / 2, 0.09, pz, 'z', 14);
    b.cyl(S, s * span / 2, py, 0.03, 0.15, 0.04, 'z', 14); // wall flange
    b.cyl(S, s * 0.2, py, pz, 0.15, 0.05, 'x', 16); // valve flanges
  }
  b.sphere(P, 0, py, pz, 0.17, 16, 0.9, 1.1, 0.9);
  b.cyl(S, 0, py + 0.17, pz, 0.07, 0.06, 'y', 12); // bonnet
  b.cyl(S, 0, (py + 0.2 + piv) / 2, pz, 0.025, piv - py - 0.2, 'y', 8);
  b.detail(() => {
    // quadrant plate under the pivot (stops at shut / open), stencils
    b.cyl(S, 0, piv - 0.04, pz, 0.16, 0.012, 'y', 16);
    b.sign('등압 밸브\n튜브 ⇄ 해수', 'stencil', 0, 1.75, 0.002, 0.9, 0.3, '+z');
    b.sign('닫힘', 'stencil', 0.32, 1.32, 0.002, 0.22, 0.08, '+z');
    b.sign('열림', 'stencil', -0.32, 1.32, 0.002, 0.22, 0.08, '+z');
  });
  if (o.collide) b.collide(-span / 2 - 0.1, py - 0.12, 0, span / 2 + 0.1, py + 0.2, pz + 0.18, 'metal', true);
  const part = movingPart(b, L, o.name ?? 'valve4_handle', 0, piv, pz, (p) => {
    p.cyl(S, 0, 0.0, 0, 0.05, 0.06, 'y', 10);
    p.bx(S, -0.025, -0.015, 0, 0.025, 0.015, 0.9);
    p.cyl('painted_orange', 0, 0, 1.05, 0.03, 0.32, 'z', 10);
    p.sphere('painted_orange', 0, 0, 1.21, 0.035, 8);
  });
  const set = (k: number) => { part.pivot.rotation.y = -Math.max(0, Math.min(1, k)) * PI / 2; };
  set(0);
  return { ...part, set };
}

/** Grille of `sumpGrille`: `lift(k)` swings it open about its hinge (0 = shut, 1 = up, 105°). */
export interface SumpHatch extends MovingPart { lift(k: number): void }
/**
 * Floor sump hatch (§2.6 plant4: (52.0, 0, −62.0), 1.2 × 1.2; vignette `plant_sump` lifts it; void `sump4` below).
 * Floor prop, origin = centre of the opening on the floor: a flush angle-iron curb (top 1 cm proud), the pit lined in
 * dark steel 2 cm inside the opening down `depth` (1.2; never coplanar with the greybox void faces), and the GRILLE as a
 * moving part (bar grating hinged on its −z edge; `lift(k)` swings it up and over toward −z). Calls: 2 static
 * (steel_raw + painted_dark) + 1 moving (steel_raw). No colliders (W4's greybox owns the hatch's walk surface).
 */
export function sumpGrille(b: Builder, L: LevelBuild, o: { w?: number; d?: number; depth?: number; name?: string } = {}): SumpHatch {
  const w = o.w ?? 1.2, d = o.d ?? 1.2, depth = o.depth ?? 1.2, S: Mat = 'steel_raw', K: Mat = 'painted_dark';
  // curb (angle iron) around the opening
  b.bx(S, -w / 2 - 0.06, -0.04, -d / 2 - 0.06, w / 2 + 0.06, 0.01, -d / 2).bx(S, -w / 2 - 0.06, -0.04, d / 2, w / 2 + 0.06, 0.01, d / 2 + 0.06);
  b.bx(S, -w / 2 - 0.06, -0.04, -d / 2, -w / 2, 0.01, d / 2).bx(S, w / 2, -0.04, -d / 2, w / 2 + 0.06, 0.01, d / 2);
  // pit lining (2 cm inside the opening), a bottom, a step iron
  const i = 0.02;
  b.bx(K, -w / 2 + i, -depth, -d / 2 + i, w / 2 - i, -0.04, -d / 2 + i + 0.01).bx(K, -w / 2 + i, -depth, d / 2 - i - 0.01, w / 2 - i, -0.04, d / 2 - i);
  b.bx(K, -w / 2 + i, -depth, -d / 2 + i, -w / 2 + i + 0.01, -0.04, d / 2 - i).bx(K, w / 2 - i - 0.01, -depth, -d / 2 + i, w / 2 - i, -0.04, d / 2 - i);
  b.bx(K, -w / 2 + i, -depth, -d / 2 + i, w / 2 - i, -depth + 0.02, d / 2 - i);
  b.detail(() => { for (const y of [-0.35, -0.7]) b.rod(S, -0.2, y, -d / 2 + i + 0.12, 0.2, y, -d / 2 + i + 0.12, 0.012, 5); });
  const part = movingPart(b, L, o.name ?? 'plant_sump_grille', 0, 0.0, -d / 2, (p) => {
    // bearing bars along z, cross rods, frame; hinge knuckles at the pivot edge
    p.bx(S, -w / 2 + 0.005, -0.03, 0.005, w / 2 - 0.005, 0.01, 0.03).bx(S, -w / 2 + 0.005, -0.03, d - 0.03, w / 2 - 0.005, 0.01, d - 0.005);
    p.bx(S, -w / 2 + 0.005, -0.03, 0.03, -w / 2 + 0.03, 0.01, d - 0.03).bx(S, w / 2 - 0.03, -0.03, 0.03, w / 2 - 0.005, 0.01, d - 0.03);
    for (let x = -w / 2 + 0.06; x < w / 2 - 0.04; x += 0.035) p.bx(S, x - 0.003, -0.025, 0.03, x + 0.003, 0.008, d - 0.03);
    for (let z = 0.12; z < d - 0.05; z += 0.1) p.rod(S, -w / 2 + 0.03, 0.0, z, w / 2 - 0.03, 0.0, z, 0.004, 4);
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) p.cyl(S, x, 0.0, 0.0, 0.02, 0.1, 'x', 8);
  });
  const lift = (k: number) => { part.pivot.rotation.x = -Math.max(0, Math.min(1, k)) * (105 * PI) / 180; };
  lift(0);
  return { ...part, lift };
}

/** Rotor of `rotBeacon`. `set(on)` starts / stops the spin and lights / darkens the dome (unless `bind` took it). */
export interface Beacon extends MovingPart { mat: THREE.MeshStandardMaterial; set(on: boolean): void }
/**
 * Amber rotating beacon on a wall bracket (§2.6 plant4: over the gauge; `plant_beacon`'s light is D3a's). Wall prop,
 * origin on the wall face at the bracket's height: a bracket arm 0.18 out, a base, and the DOME as a moving part — an
 * amber lens whose emissive map carries one bright reflector sector, so spinning it reads as the turning beam (1.5 rev/s
 * while on). `intensity` (0.35) = the dome's emissive when on; off = dark amber plastic. Pass `bind` to hand the
 * material to the light (`(m) => h.bindEmissive(m, 0.35)`), then the light's `alarm` flicker drives it and `set` only
 * spins. Calls: 1 static (painted_dark) + 1 moving (the dome).
 */
export function rotBeacon(b: Builder, L: LevelBuild, o: { name?: string; intensity?: number; bind?: (m: THREE.MeshStandardMaterial) => void } = {}): Beacon {
  const K: Mat = 'painted_dark', I = o.intensity ?? 0.35;
  b.bx(K, -0.07, -0.1, 0, 0.07, 0.04, 0.012);
  b.bx(K, -0.03, -0.01, 0, 0.03, 0.03, 0.2);
  b.cyl(K, 0, 0.055, 0.2, 0.085, 0.05, 'y', 14);
  const tex = canvasTex(64, 8, (g) => {
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgb(70,40,10)'); gr.addColorStop(0.35, 'rgb(70,40,10)'); gr.addColorStop(0.45, 'rgb(255,190,90)');
    gr.addColorStop(0.55, 'rgb(255,190,90)'); gr.addColorStop(0.65, 'rgb(70,40,10)'); gr.addColorStop(1, 'rgb(70,40,10)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 8);
  });
  const mat = L.ctx.materials.clone('plastic_white', { color: 0xb8650f, map: null, normalMap: null, roughnessMap: null, aoMap: null, roughness: 0.25, metalness: 0 });
  mat.emissive = new THREE.Color(0xff8a1e);
  mat.emissiveMap = tex;
  mat.emissiveIntensity = 0;
  mat.name = `${o.name ?? 'beacon'}_dome`;
  if (o.bind) o.bind(mat);
  const part = movingPart(b, L, o.name ?? 'plant_beacon_dome', 0, 0.08, 0.2, (p) => {
    p.cyl(mat, 0, 0.07, 0, 0.075, 0.14, 'y', 16);
    p.sphere(mat, 0, 0.14, 0, 0.075, 12, 0.6);
  });
  let on = false;
  L.updaters.push((dt) => { if (on) part.pivot.rotation.y += dt * PI * 3; });
  const set = (v: boolean) => { on = v; if (!o.bind) mat.emissiveIntensity = v ? I : 0; };
  return { ...part, mat, set };
}

/** Needle of `gaugePanel`: `set(bar)` (0 … 4). */
export interface GaugeNeedle extends MovingPart { set(bar: number): void; screen: THREE.Vector3 }
/**
 * Δp gauge board (`plant_gauge` 1.2 × 0.8 at (55.78, 2.4, −59.0) facing −x: the SCREEN is D3a's `L.screen`; this is
 * its housing). Wall prop, origin = the screen's centre on the wall face: a black instrument board 2.3 × 1.2 (10 mm on the wall,
 * behind the screen plane at z 0.02), a frame 5 cm proud round the screen opening, a 0.36 m analog Δp dial to its right
 * (x +0.95) whose NEEDLE is a moving part (`set(bar)`: 0 … 4 bar over 270°), conduit up. Returns `screen`
 * = the world point where the 1.2 × 0.8 screen goes. Calls: 2 static (painted_dark + dialFaceMat) + 1 moving.
 */
export function gaugePanel(b: Builder, L: LevelBuild, o: { sw?: number; sh?: number; name?: string } = {}): GaugeNeedle {
  const sw = o.sw ?? 1.2, sh = o.sh ?? 0.8, N: Mat = 'painted_dark', F = dialFaceMat(L);
  b.bx(N, -sw / 2 - 0.3, -sh / 2 - 0.2, 0, sw / 2 + 0.75, sh / 2 + 0.2, 0.01);
  // frame round the screen (front at 0.05; the screen plane is 0.02)
  b.bx(N, -sw / 2 - 0.05, -sh / 2 - 0.05, 0.01, sw / 2 + 0.05, -sh / 2, 0.05).bx(N, -sw / 2 - 0.05, sh / 2, 0.01, sw / 2 + 0.05, sh / 2 + 0.05, 0.05);
  b.bx(N, -sw / 2 - 0.05, -sh / 2, 0.01, -sw / 2, sh / 2, 0.05).bx(N, sw / 2, -sh / 2, 0.01, sw / 2 + 0.05, sh / 2, 0.05);
  // dial: housing, face
  const dx = sw / 2 + 0.42, R = 0.18;
  b.cyl(N, dx, 0, 0.04, R + 0.03, 0.06, 'z', 24);
  b.quad(F, dx, 0, 0.0705, R * 2, R * 2, '+z');
  b.detail(() => {
    b.torus(N, dx, 0, 0.072, R + 0.012, 0.012, 'z', 24);
    b.rod(N, sw / 2 + 0.6, sh / 2 + 0.2, 0.03, sw / 2 + 0.6, sh / 2 + 1.2, 0.03, 0.02, 6);
    b.bx(N, sw / 2 + 0.52, sh / 2 + 0.05, 0.01, sw / 2 + 0.68, sh / 2 + 0.2, 0.08);
  });
  const part = movingPart(b, L, o.name ?? 'plant_gauge_needle', dx, 0, 0.074, (p) => {
    p.cyl('painted_orange', 0, 0, 0.004, 0.018, 0.008, 'z', 10);
    p.rbox('painted_orange', 0, 0.07, 0.006, 0.008, 0.15, 0.003, 0, 0, 0);
  });
  // canvas dial: 0 bar at −225° (canvas, clockwise from +x) = lower left; scene angle: needle up = 0, clockwise negative
  const set = (bar: number) => { const v = Math.max(0, Math.min(4, bar)); part.pivot.rotation.z = (135 * PI) / 180 - (v / 4) * (270 * PI) / 180; };
  set(0);
  return { ...part, set, screen: b.world(0, 0, 0.02) };
}

// ═════════════════════════════════════════════════════════════ TUBE

/** Tube cross-section (§2.1 tube x 30 … 34, h 3.6; panes y 0.4 … 3.0 at x 30 / 34): roof arc from `wallH` at the walls
 * (±w/2) to `ridge` at the centre. */
function arcY(x: number, w: number, wallH: number, ridge: number): number {
  const s = ridge - wallH, c = w / 2, R = (c * c + s * s) / (2 * s);
  return ridge - (R - Math.sqrt(Math.max(0, R * R - x * x)));
}

/**
 * Tube rib (every 4 m, §2.6 tube). Floor prop, origin = the tube's centre line on the floor at the rib, rib in the local
 * z = 0 plane, local x across the tube (±`w`/2 = the glass planes, 4.0): I-section posts straddling each glass plane
 * (0.12 inside, 0.08 outside) from the deck to `wallH` (3.0), haunch gussets, an arched rafter under the roof to the
 * `ridge` (3.6), bolted splice plates. Calls: 2 (navy_grey + steel_raw). Collider: none (inside the walls / roof).
 */
export function tubeRib(b: Builder, L: LevelBuild, o: { w?: number; wallH?: number; ridge?: number } = {}) {
  const w = o.w ?? 4.0, wallH = o.wallH ?? 3.0, ridge = o.ridge ?? 3.6, N: Mat = 'navy_grey', S: Mat = 'steel_raw';
  for (const s of [-1, 1]) {
    const xi = s * (w / 2 - 0.12), xo = s * (w / 2 + 0.08);
    // post: inner flange, web, outer flange (z ±0.1)
    b.bx(N, Math.min(xi, xi - s * 0.02), 0, -0.1, Math.max(xi, xi - s * 0.02), wallH, 0.1);
    b.bx(N, Math.min(xi, xo), 0, -0.012, Math.max(xi, xo), wallH, 0.012);
    b.bx(N, Math.min(xo, xo + s * 0.02), 0, -0.1, Math.max(xo, xo + s * 0.02), wallH, 0.1);
    // base plate + haunch gusset
    b.bx(N, Math.min(xi, xo) - 0.04, 0, -0.14, Math.max(xi, xo) + 0.04, 0.025, 0.14);
    b.detail(() => {
      for (const y of [0.9, 2.1]) for (const z of [-0.06, 0.06]) b.cyl(S, xi - s * 0.025, y, z, 0.014, 0.012, 'x', 6);
      b.rbox(N, s * (w / 2 - 0.35), wallH - 0.12, 0, 0.42, 0.012, 0.18, 0, 0, s * 0.6);
    });
  }
  // rafter: arc segments under the roof (0.12 deep), from the post tops to the ridge
  const n = 10;
  for (let i = 0; i < n; i++) {
    const xa = -w / 2 + (i * w) / n, xc = xa + w / n;
    const ya = arcY(xa, w, wallH, ridge), yc = arcY(xc, w, wallH, ridge);
    const len = Math.hypot(xc - xa, yc - ya), ang = Math.atan2(yc - ya, xc - xa);
    b.rbox(N, (xa + xc) / 2, (ya + yc) / 2 - 0.08, 0, len + 0.01, 0.14, 0.2, 0, 0, ang);
  }
  b.detail(() => b.bx(S, -0.12, ridge - 0.2, -0.113, 0.12, ridge - 0.04, 0.113)); // crown splice plate (13 mm off the rafter faces: B5)
}

/**
 * Tube roof segment (between ribs) with the lit cable spine (§2.6 tube: "curved solid roof with lit cable spine").
 * Floor prop, origin = centre line on the floor at the segment's middle, `len` (4.0) along z: the roof skin as 12
 * facets on the arc (wallH 3.0 → ridge 3.6, 2 cm under it), panel seam battens every 1 m, a cable tray along the
 * crown with a cable loom, and a continuous diffuser strip under the tray (`spine`, default 0.3 cool white on a dim lens — emissive
 * only; the spine's point lights are D3b's). Calls: 2 (navy_grey + spine glow). Collider: none.
 */
export function tubeRoof(b: Builder, L: LevelBuild, o: { len?: number; w?: number; wallH?: number; ridge?: number; spine?: Mat } = {}) {
  const len = o.len ?? 4.0, w = o.w ?? 4.0, wallH = o.wallH ?? 3.0, ridge = o.ridge ?? 3.6, N: Mat = 'navy_grey';
  const G = o.spine ?? glow4(L, 'tube_spine', 0xcfe4ff, 0.3, 0x59626a); // dim lens: never a white bar in the torch
  const n = 12;
  for (let i = 0; i < n; i++) {
    const xa = -w / 2 + 0.02 + (i * (w - 0.04)) / n, xc = xa + (w - 0.04) / n;
    const ya = arcY(xa, w, wallH, ridge) - 0.02, yc = arcY(xc, w, wallH, ridge) - 0.02;
    const l = Math.hypot(xc - xa, yc - ya), ang = Math.atan2(yc - ya, xc - xa);
    b.rbox(N, (xa + xc) / 2, (ya + yc) / 2 + 0.015, 0, l + 0.004, 0.03, len, 0, 0, ang);
  }
  b.detail(() => {
    for (let z = -len / 2 + 1; z < len / 2 - 0.01; z += 1) {
      for (let i = 0; i < n; i++) {
        const xa = -w / 2 + 0.02 + (i * (w - 0.04)) / n, xc = xa + (w - 0.04) / n;
        const ya = arcY(xa, w, wallH, ridge) - 0.02, yc = arcY(xc, w, wallH, ridge) - 0.02;
        b.rbox(N, (xa + xc) / 2, (ya + yc) / 2 - 0.004, z, Math.hypot(xc - xa, yc - ya), 0.012, 0.05, 0, 0, Math.atan2(yc - ya, xc - xa));
      }
    }
    // crown cable tray + loom + hangers
    const ty = ridge - 0.2;
    b.bx(N, -0.16, ty, -len / 2, 0.16, ty + 0.012, len / 2);
    for (const s of [-1, 1]) b.bx(N, s * 0.16 - 0.006, ty, -len / 2, s * 0.16 + 0.006, ty + 0.07, len / 2);
    for (let k = 0; k < 5; k++) b.cyl(N, -0.11 + k * 0.055, ty + 0.035, 0, 0.022, len, 'z', 6);
    for (let z = -len / 2 + 0.5; z < len / 2; z += 1.0) for (const s of [-1, 1]) b.rod(N, s * 0.15, ty, z, s * 0.15, ridge - 0.02, z, 0.008, 4);
    b.bx(G, -0.07, ty - 0.022, -len / 2 + 0.03, 0.07, ty - 0.004, len / 2 - 0.03);
  });
}

/**
 * Grated tube deck (§2.6 tube). Floor prop, origin = centre line on the floor, `len` (4.0) along z, `w` (3.6) across:
 * bar grating panels (1.0 m, top at 0.04) on stringers over a dark pan (polygon-offset, never fights the floor) with a
 * cable loom and pipes visible through the grating. Calls: 2 (floor_grate + painted_dark overlay). Collider: the walk
 * surface at 0.04 (`collide`, on — feet stand on the grate, not 4 cm into it).
 */
export function gratedDeck(b: Builder, L: LevelBuild, o: { len?: number; w?: number; collide?: boolean } = {}) {
  const len = o.len ?? 4.0, w = o.w ?? 3.6, K = L.overlay('painted_dark'), top = 0.04;
  b.detail(() => {
    b.bx(K, -w / 2, 0.002, -len / 2, w / 2, 0.006, len / 2);
    for (const x of [-0.6, -0.48, 0.55]) b.cyl(K, x, 0.018, 0, x > 0 ? 0.012 : 0.009, len, 'z', 6);
    b.cyl(K, 0.9, 0.022, 0, 0.016, len, 'z', 8);
    // stringers + panel cross bars
    for (const x of [-w / 2 + 0.03, -w / 4, 0, w / 4, w / 2 - 0.03]) b.bx(K, x - 0.02, 0.006, -len / 2, x + 0.02, top - 0.004, len / 2);
    for (let z = -len / 2; z <= len / 2 + 1e-6; z += 1.0) b.bx(K, -w / 2, 0.006, z - 0.02, w / 2, top - 0.004, z + 0.02);
  });
  b.solid(() => b.quad('floor_grate', 0, top, 0, w, len, '+y', 0, 'box'));
  if (o.collide !== false) b.collide(-w / 2, 0, -len / 2, w / 2, top, len / 2, 'metal', true);
}

/**
 * Bulkhead ring (§2.6 tube: at z −87, 0.5 m deep, opening 2.6 × 3.0). Floor prop, origin = centre line on the floor
 * at the ring's centre: a solid collar following the tube profile 0.15 m beyond it (side jambs, an arched header),
 * a 2.6 × 3.0 opening with chamfered top corners, a raised flange rim and bolt rows on both faces, two open dog levers,
 * and (`lockers`, on) a low emergency locker each side of the opening on the +z face: 0.6 × 0.38 × 0.3, tops at 0.38
 * — the tube pickups (§2.6: (30.6 | 33.4, 0.4, −86.6)) rest on them. Calls: 2 (navy_grey + steel_raw) + stencil
 * atlas. Collider: jambs, header, lockers.
 */
export function bulkheadRing(b: Builder, L: LevelBuild, o: { depth?: number; w?: number; wallH?: number; ridge?: number; opening?: [number, number]; lockers?: boolean; collide?: boolean } = {}) {
  const dep = o.depth ?? 0.5, w = o.w ?? 4.0, wallH = o.wallH ?? 3.0, ridge = o.ridge ?? 3.6, [ow, oh] = o.opening ?? [2.6, 3.0];
  const N: Mat = 'navy_grey', S: Mat = 'steel_raw', e = 0.15, ch = 0.2;
  // outline (x, y): outer profile (offset e) then the opening notch, CCW, extruded along z
  const outer: [number, number][] = [[-w / 2 - e, 0]];
  outer.push([-w / 2 - e, wallH]);
  const n = 12;
  for (let i = 0; i <= n; i++) { const x = -w / 2 + (i * w) / n; outer.push([x * (1 + e / (w / 2)), arcY(x, w, wallH, ridge) + e]); }
  outer.push([w / 2 + e, wallH], [w / 2 + e, 0], [ow / 2, 0], [ow / 2, oh - ch], [ow / 2 - ch, oh], [-ow / 2 + ch, oh], [-ow / 2, oh - ch], [-ow / 2, 0]);
  // ExtrudeGeometry wants CCW: the list above runs clockwise in (x, y) — reverse it
  extrude(b, N, outer.slice().reverse(), dep, 0, 0, -dep / 2);
  // flange rims round the opening on both faces + bolt rows
  for (const s of [-1, 1]) {
    const z = s * (dep / 2 + 0.02);
    b.bx(N, -ow / 2 - 0.1, 0, z - 0.02, -ow / 2, oh - ch, z + 0.02).bx(N, ow / 2, 0, z - 0.02, ow / 2 + 0.1, oh - ch, z + 0.02);
    b.bx(N, -ow / 2 + ch, oh, z - 0.02, ow / 2 - ch, oh + 0.1, z + 0.02);
    for (const sx of [-1, 1]) b.rbox(N, sx * (ow / 2 - ch / 2 + 0.04), oh - ch / 2 + 0.04, z, Math.SQRT2 * ch + 0.04, 0.1, 0.04, 0, 0, -sx * PI / 4);
    b.detail(() => {
      for (let y = 0.25; y < oh - ch; y += 0.3) for (const sx of [-1, 1]) b.cyl(S, sx * (ow / 2 + 0.05), y, z + s * 0.022, 0.016, 0.014, 'z', 6);
      for (let x = -ow / 2 + ch + 0.1; x < ow / 2 - ch; x += 0.3) b.cyl(S, x, oh + 0.05, z + s * 0.022, 0.016, 0.014, 'z', 6);
      // dog levers (open, hanging) on the jambs
      for (const sx of [-1, 1]) for (const y of [0.8, 2.2]) {
        b.cyl(S, sx * (ow / 2 + 0.06), y, z + s * 0.04, 0.03, 0.04, 'z', 8);
        b.rbox(S, sx * (ow / 2 + 0.06), y - 0.1, z + s * 0.06, 0.03, 0.22, 0.02, 0, 0, sx * 0.15);
      }
    });
  }
  if (o.lockers !== false) {
    for (const sx of [-1, 1]) {
      const xc = sx * 1.4, z0 = dep / 2 + 0.02;
      b.bx(N, xc - 0.3, 0, z0, xc + 0.3, 0.38, z0 + 0.3);
      b.detail(() => {
        b.bx(S, xc - 0.28, 0.33, z0 + 0.3, xc + 0.28, 0.345, z0 + 0.31);
        b.bx(S, xc - 0.05, 0.22, z0 + 0.3, xc + 0.05, 0.28, z0 + 0.32);
        b.sign('비상', 'stencil', xc, 0.14, z0 + 0.302, 0.4, 0.09, '+z');
      });
      if (o.collide !== false) b.collide(xc - 0.3, 0, z0, xc + 0.3, 0.38, z0 + 0.3, 'metal', true);
    }
  }
  if (o.collide !== false) {
    b.collide(-w / 2 - e, 0, -dep / 2, -ow / 2, ridge + e, dep / 2, 'metal', true);
    b.collide(ow / 2, 0, -dep / 2, w / 2 + e, ridge + e, dep / 2, 'metal', true);
    b.collide(-ow / 2, oh, -dep / 2, ow / 2, ridge + e, dep / 2, 'metal', true);
  }
}

// ───────────────────────────────────────────────────────────── portal culling (integration B6)

/** A see-through opening between two rooms that is not a door: world rectangle in a wall plane. */
export interface Opening4 { a: string; b: string; wall: 'x' | 'z'; at: number; u0: number; u1: number; y0: number; y1: number }

/**
 * Level 4 view culling on top of the level's portal graph (B6). The graph says which rooms MAY be seen (open doors,
 * the corridor loop's open corners, glass); from the shower exit that is the whole loop, the cold store and every door
 * frame on it (≈ 150 draw calls that sit behind walls). This walks the same portals from the camera's room, but only
 * through openings whose screen rectangle overlaps the rectangle it came through (classic portal culling, conservative:
 * an opening the camera stands in or behind passes the whole rectangle on), and hides every room-tagged group of the
 * level root whose rooms it did not reach. Lights, enemies, pickups and fx volumes follow through the level's
 * `roomVisible`, which is narrowed to the same set. Only ever hides what the graph shows; never shows anything.
 */
export function installPortalCull4(L: LevelBuild, openings: Opening4[]) {
  const cam = L.ctx.camera;
  const vp = new THREE.Matrix4();
  const v4 = new THREE.Vector4();
  type Portal = { a: number; b: number; pts: THREE.Vector3[]; door: { t: number; ajar?: number } | null };
  let ready = false, portals: Portal[] = [], rooms: { id: string; x0: number; x1: number; z0: number; z1: number }[] = [];
  let tagged: { obj: THREE.Object3D; ids: number[]; culled: boolean; masks: Map<THREE.Object3D, number> }[] = [];
  /**
   * Set aside / restore a group for the main view: its meshes move to the render's view-cull layer (30) — `visible`
   * stays the level's (checks and feeds walk it), probe captures still see them, shadow passes do not.
   */
  const setCulled = (t: (typeof tagged)[number], on: boolean) => {
    if (t.culled === on) return;
    t.culled = on;
    if (on) t.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) { t.masks.set(o, o.layers.mask); o.layers.mask = 1 << 30; } });
    else { for (const [o, m] of t.masks) o.layers.mask = m; t.masks.clear(); }
  };
  let baseVisible: ((x: number, z: number) => boolean) | null = null;
  const reached = new Uint8Array(64);
  const rect = new Float32Array(64 * 4);
  const MARGIN = 0.12; // NDC: one frame of turning at ~400°/s and the view bob
  const quad = (wall: 'x' | 'z', at: number, u0: number, u1: number, y0: number, y1: number) => wall === 'z'
    ? [new THREE.Vector3(u0, y0, at), new THREE.Vector3(u1, y0, at), new THREE.Vector3(u0, y1, at), new THREE.Vector3(u1, y1, at)]
    : [new THREE.Vector3(at, y0, u0), new THREE.Vector3(at, y0, u1), new THREE.Vector3(at, y1, u0), new THREE.Vector3(at, y1, u1)];
  const setup = () => {
    const level = L.ctx.level;
    if (!level?.doors?.length || !L.root.userData.roomVisible) return false;
    rooms = L.rooms.map((r) => ({ id: r.id, x0: r.bounds.min.x, x1: r.bounds.max.x, z0: r.bounds.min.z, z1: r.bounds.max.z }));
    const idx = new Map(rooms.map((r, i) => [r.id, i]));
    for (const d of level.doors) {
      const root = L.objects.get(d.id);
      const rs = root?.userData.rooms as string[] | undefined;
      if (!root || !rs || rs.length !== 2 || !idx.has(rs[0]) || !idx.has(rs[1])) continue;
      const impl = d as unknown as { width?: number; height?: number; t: number; ajar?: number };
      const w = impl.width ?? 1.6, h = impl.height ?? 2.4, y = d.position.y;
      const xWall = Math.abs(Math.sin(root.rotation.y)) > 0.5;
      const c = xWall ? d.position.z : d.position.x;
      portals.push({ a: idx.get(rs[0])!, b: idx.get(rs[1])!, pts: quad(xWall ? 'x' : 'z', xWall ? d.position.x : d.position.z, c - w / 2, c + w / 2, y, y + h), door: impl });
    }
    for (const o of openings) {
      if (!idx.has(o.a) || !idx.has(o.b)) continue;
      portals.push({ a: idx.get(o.a)!, b: idx.get(o.b)!, pts: quad(o.wall, o.at, o.u0, o.u1, o.y0, o.y1), door: null });
    }
    tagged = [];
    for (const o of L.root.children) {
      const rs = o.userData.rooms as string[] | undefined;
      const ids = (rs ?? []).map((r) => idx.get(r)).filter((i): i is number => i !== undefined);
      if (ids.length) tagged.push({ obj: o, ids, culled: false, masks: new Map() });
    }
    baseVisible = L.root.userData.roomVisible as (x: number, z: number) => boolean;
    const roomAt = (x: number, z: number) => {
      for (let i = 0; i < rooms.length; i++) { const r = rooms[i]; if (x > r.x0 + 0.05 && x < r.x1 - 0.05 && z > r.z0 + 0.05 && z < r.z1 - 0.05) return i; }
      return -1;
    };
    L.root.userData.roomVisible = (x: number, z: number): boolean => {
      if (!baseVisible!(x, z)) return false;
      if (!active) return true;
      const i = roomAt(x, z);
      return i < 0 || reached[i] === 1;
    };
    return true;
  };
  let active = false;
  /** Screen rectangle of a portal ∩ `r` (x0, y0, x1, y1 in NDC), or null; conservative near / behind the camera. */
  const cv = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const NEAR_W = 0.05;
  const clip = (p: Portal, r: number[]): number[] | null => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, w: number) => {
      const px = x / w, py = y / w;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    };
    let behind = 0;
    for (let k = 0; k < 4; k++) { const q = p.pts[k]; cv[k].set(q.x, q.y, q.z, 1).applyMatrix4(vp); if (cv[k].w < NEAR_W) behind++; }
    if (behind === 4) {
      // wholly behind the eye: invisible, unless the eye stands in the opening (then it passes the whole rectangle on)
      const a = p.pts[0], d = p.pts[3], e = cam.position;
      const dx = Math.max(Math.min(a.x, d.x) - e.x, 0, e.x - Math.max(a.x, d.x));
      const dy = Math.max(Math.min(a.y, d.y) - e.y, 0, e.y - Math.max(a.y, d.y));
      const dz = Math.max(Math.min(a.z, d.z) - e.z, 0, e.z - Math.max(a.z, d.z));
      return dx * dx + dy * dy + dz * dz < 0.6 * 0.6 ? r.slice() : null;
    }
    // the quad (corners 0 1 3 2 in order) clipped against the eye's near plane: the corners in front + the points where
    // its edges cross the plane (a far opening edge-on to the eye no longer passes the whole screen on)
    const ring = [0, 1, 3, 2];
    for (let k = 0; k < 4; k++) {
      const A = cv[ring[k]], B = cv[ring[(k + 1) % 4]];
      if (A.w >= NEAR_W) add(A.x, A.y, A.w);
      if ((A.w >= NEAR_W) !== (B.w >= NEAR_W)) {
        const t = (A.w - NEAR_W) / (A.w - B.w);
        add(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t, NEAR_W);
      }
    }
    x0 = Math.max(x0 - MARGIN, r[0]); y0 = Math.max(y0 - MARGIN, r[1]); x1 = Math.min(x1 + MARGIN, r[2]); y1 = Math.min(y1 + MARGIN, r[3]);
    return x0 < x1 && y0 < y1 ? [x0, y0, x1, y1] : null;
  };
  L.updaters.push(() => {
    if (!ready) { ready = setup(); if (!ready) return; }
    const level = L.ctx.level;
    cam.updateMatrixWorld();
    const p = cam.position;
    let start = -1;
    for (let i = 0; i < rooms.length; i++) { const r = rooms[i]; if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) { start = i; break; } }
    // (check:fxleak's magenta mode tests that walls hide a mis-gated volume: the walls must all be there for it)
    if ((L.ctx.fx as unknown as { volumesDebug?: boolean }).volumesDebug) start = -1;
    active = start >= 0;
    reached.fill(0);
    if (start < 0) { active = false; for (const t of tagged) setCulled(t, false); return; }
    vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const big = [-1 - MARGIN, -1 - MARGIN, 1 + MARGIN, 1 + MARGIN];
    reached[start] = 1;
    rect.set(big, start * 4);
    const queue = [start];
    let guard = 0;
    while (queue.length && guard++ < 400) {
      const i = queue.shift()!;
      const r = [rect[i * 4], rect[i * 4 + 1], rect[i * 4 + 2], rect[i * 4 + 3]];
      for (const q of portals) {
        const j = q.a === i ? q.b : q.b === i ? q.a : -1;
        if (j < 0 || !L.isVisible(rooms[j].id)) continue;
        if (q.door && !(q.door.t > (q.door.ajar ?? 0) + 1e-3)) continue;
        const c = clip(q, r);
        if (!c) continue;
        if (reached[j]) {
          // grow the room's rectangle (another way in); revisit only if it grew
          const o = j * 4;
          const n0 = Math.min(rect[o], c[0]), n1 = Math.min(rect[o + 1], c[1]), n2 = Math.max(rect[o + 2], c[2]), n3 = Math.max(rect[o + 3], c[3]);
          if (n0 < rect[o] - 1e-3 || n1 < rect[o + 1] - 1e-3 || n2 > rect[o + 2] + 1e-3 || n3 > rect[o + 3] + 1e-3) { rect[o] = n0; rect[o + 1] = n1; rect[o + 2] = n2; rect[o + 3] = n3; queue.push(j); }
        } else { reached[j] = 1; rect.set(c, j * 4); queue.push(j); }
      }
    }
    for (const t of tagged) {
      let mine = false;
      for (const i of t.ids) if (reached[i]) { mine = true; break; }
      setCulled(t, !mine);
    }
  });
}

/** Level 4's non-door openings (§2.1 corners carved open, §2.8 glass), for `installPortalCull4`. */
export const OPENINGS4: Opening4[] = [
  { a: 'corr_n', b: 'corr_w', wall: 'z', at: -12, u0: -15, u1: -12, y0: 4.8, y1: 7.8 },
  { a: 'corr_n', b: 'corr_e', wall: 'z', at: -12, u0: 12, u1: 15, y0: 4.8, y1: 7.8 },
  { a: 'corr_s', b: 'corr_w', wall: 'z', at: -34, u0: -15, u1: -12, y0: 4.8, y1: 7.8 },
  { a: 'corr_s', b: 'corr_e', wall: 'z', at: -34, u0: 12, u1: 15, y0: 4.8, y1: 7.8 },
  { a: 'corr_n', b: 'wetlab', wall: 'z', at: -12, u0: -11, u1: 3, y0: 5.7, y1: 7.0 },
  { a: 'corr_e', b: 'node2', wall: 'x', at: 12, u0: -23.4, u1: -20.6, y0: 5.5, y1: 7.3 },
  { a: 'gallery', b: 'theatre', wall: 'z', at: -47, u0: -7.6, u1: 7.6, y0: 5.0, y1: 7.6 },
];

// ───────────────────────────────────────────────────────────── door styling (integration B2)

/** Pressure doors keep the industrial hazard frame (outer lock, tube ends). */
const PRESSURE4 = new Set(['d4_inner', 'd4_tube_n', 'd4_tube_s']);
/**
 * Level 4's one door styler (B2): Deck 2 (the clean side, floor y 4.8) gets clinical frames and leaves, Deck 1 (the
 * navy level) navy frames and leaves; pressure doors keep their hazard markings. Call from any room's `build` (rooms
 * are built before the doors).
 */
export function styleDoors4(L: LevelBuild) {
  setDoorStyler(L, (s) => {
    if (PRESSURE4.has(s.id) || s.kind !== 'std') return null;
    return { frameStyle: (s.y ?? 0) > 2 ? 'clinical' : 'navy' };
  });
}
