/**
 * POST 4 — dressing kit (stage 3c §8.9, task W8). Props for level 5's navy dock: the gatehouse and duty room, the ready
 * room, the spine and its crawlway, the magazine and armoury, berthing / heads / mess / galley, and the sub bay (galleries,
 * cradle-side boxes, crates, forklift, gas racks), the dive locker and the trunk tunnel. Original designs, metres, y up.
 *
 * Conventions (same as `l4/kit4.ts` — read before placing anything):
 *  - Every prop is authored in the builder's LOCAL frame and stamped with the transform stack:
 *    `b.at(x, y, z, ry, () => lockerBank(b, L, { len: 7 }))`. Wall-normal → ry: front +z: 0 · −z: π · +x: π/2 · −x: −π/2.
 *    **Place props at multiples of π/2 only** (colliders are axis-aligned boxes in the prop's frame; any other angle
 *    inflates them to the rotated box's world AABB). Every prop's own arguments are `(b, L, o)`: an options object, no
 *    positional sizes (3b lesson: argument order caused placement bugs). The exceptions take world-style coordinates
 *    in the builder's frame and say so (`grating`, `galleryDeck`, `rail`, `strip5`, `stairDressing`).
 *  - FLOOR props: origin on the floor; FRONT = local +z. WALL props ("wall prop"): origin on the WALL FACE (room side of
 *    the wall = wall centre ± 0.2), back at local z = 0, front +z. CEILING props: origin on the ceiling, hanging −y.
 *  - Draw calls: the builder merges per material per zone, so a prop costs one call per DISTINCT material it adds to
 *    its zone. Every static prop uses ≤ 2 materials ("Calls" in each doc). Text goes through the zone's sign atlas
 *    (`navySign`, one call per sign style per zone, shared). Shared emissives (`stripMat5`, `nightLightMat`, `lampLens5`)
 *    are one call per zone for all props using them. Moving parts are separate objects (+1 call each, stated).
 *  - Colliders: `collide` (default true unless stated) adds static boxes with `b.collide` (nav obstacles). **Cover
 *    props have honest collider heights**: the collider top is the visible top (crates 1.2, equipment boxes and filing
 *    cabinets 1.3, parapets 1.1, risers / lockers / forklift / gas racks full height). A crouched soldier's eye is at
 *    0.85, his helmet top ≈ 1.0 — every `low` cover object here is ≥ 1.1. Turn colliders off (`collide: false`) where
 *    the W4 greybox already has them — never two colliders.
 *  - Emissive: ≤ 0.35 by default (nothing reads as a white bar through glass); the exceptions are the strips (1.2 on)
 *    and a lamp being popped (a 1-frame surge). Lamps that must follow a light take its handle (`bind`) or hand their
 *    lens to `handle.bindEmissive(lens, 0.35)`.
 *  - Z-fight rule used throughout: no two same-facing faces overlap closer than 8 mm (the sub bay's depth tolerance is
 *    7.6 mm); flat things lying on a surface (papers, mats, paint) use polygon-offset overlay materials.
 *  - Scare props (`lockerBank` doors, `looseHelmet`, `trayStack`, `bulkheadLamp` breakable, `turnstile`, `oilskin`) expose
 *    `play`-style triggers that return their duration and a pure `at(t)` (scrub / snap): **they play no sounds** — the
 *    vignette owns its sounds (§8.11) and schedules them from the returned impact times — `trayStack.fall()` → `impact`
 *    `tray_crash`, `bin` `cutlery_scatter`; `LockerDoor.rattle()` → `locker_rattle` at 0, `bang()` → `locker_bang` at
 *    `impact`; `looseHelmet.fall()` → `helmet_roll` at `impact`; `bulkheadLamp.pop()` → `bulb_pop` + `fx.bulbPop(point)`
 *    at `out`, `glass_tinkle` at `tinkle`; `oilskin.swing()` → `hook_creak` at `creak`; `turnstile.click()` →
 *    `turnstile_click` at 0. None of the props calls `ctx.audio` or `ctx.fx`. `snap()` = the end state,
 *    instant and silent (the `id:snap` convention, §8.7).
 *  - Navy-dock materials are W5's (`hull_white`, `deck_grate`, `helmet_navy`, `webbing`, `rubber_mat`, …); the dev page
 *    draws stand-ins only if a name is still missing.
 *
 *  materials   stripMat5 / setStrips5 · nightLightMat · lampLens5 · tint5
 *  signs       navySign · hullNumber
 *  gatehouse   turnstile (rotor) · fence · equipmentGate · guardBooth · boothCounter (+ deskFan) · deskFan · boardFrame ·
 *              noticeBoard · firstAidCabinet · clearingBarrel
 *  duty        watchDesk · filingCabinets · wallCamera (tally) · wallShelf
 *  ready       lockerBank (+ LockerDoor) · looseHelmet · bench5 · gearCrate · kitRack · helmetRow · floorMat
 *  spine       pipeRiser · hullRib · grating · rail · fireHoseBox · strip5
 *  crawl       pipeBundle · crawlJoists (+ strip5 'red')
 *  magazine    ammoTinRack (per-shelf colliders) · bulkheadLamp (breakable) · fireBoard
 *  armoury     cageRack (23 slots) · issueDesk
 *  quarters    tripleBunk · bunkRadio (dial) · openShelf · messTable · servingCounter · trayStack (falls) · galleyRange ·
 *              prepTable · frostedWindow · oilskin (swings) · sinkRow · showerStalls · drainGrate · drainGrille
 *  sub bay     galleryDeck · stairDressing · crateStack · equipmentBox · forklift · gasBottleRack · rotBeacon
 *  dive/tunnel diveSuits · decompressionChamber · cableTray · trunkCable
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import { unitBox, type Builder, type Face, type Mat } from '../builder';
import type { LevelBuild } from '../context';
import { curtainGeo } from '../props';
import { hose } from '../kit';
import { mat4, rotBeacon as rotBeacon4, sumpGrille, type Beacon, type SumpHatch } from '../l4/kit4';

export type { Beacon, SumpHatch };
const PI = Math.PI;
export type WallFace = '+x' | '-x' | '+z' | '-z';

// ───────────────────────────────────────────────────────────── materials

const NOMAPS = { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null };
/** A flat paint (no maps), cached per key. */
function paint5(L: LevelBuild, key: string, color: number, rough: number, metal = 0): THREE.MeshStandardMaterial {
  return mat4(L, `k5_${key}`, () => L.ctx.materials.clone('painted_white', { ...NOMAPS, color, roughness: rough, metalness: metal }));
}
/** A library material recoloured (keeps its maps: chips, grain), cached per key. */
export function tint5(L: LevelBuild, key: string, base: 'painted_white' | 'fabric' | 'plastic_white' | 'rubber' | 'navy_grey', color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return mat4(L, `k5_t_${key}`, () => L.ctx.materials.clone(base, { color, ...extra }));
}
/** Olive-drab transport cases, ammo tins. */
const olive = (L: LevelBuild) => tint5(L, 'olive', 'painted_white', 0x59614c, { roughness: 0.62 });
/** Fire-equipment red. */
const fireRed = (L: LevelBuild) => tint5(L, 'fire_red', 'painted_white', 0xa3241c, { roughness: 0.45 });
/** Sea-water / service pipe paint (navy green-grey). */
const pipePaint = (L: LevelBuild) => tint5(L, 'pipe', 'painted_white', 0x5f6f66, { roughness: 0.5, metalness: 0.1 });
/** Yellow oilskin (galley cold room coat). */
const oilskinMat = (L: LevelBuild) => tint5(L, 'oilskin', 'plastic_white', 0xc99a1e, { roughness: 0.38 });

interface StripDef { color: number; lens: number; on: number }
const STRIPS: Record<string, StripDef> = {
  /** Emergency (IB5b B2: the bay's red, one channel for the whole level): OFF until the emergency groups → `setStrips5(L, 'emerg', k)`. */
  emerg: { color: 0xff2a14, lens: 0x8a3a32, on: 0 },
  /** Crawlway / magazine stair red LED strips: ON from load. */
  red: { color: 0xff2a14, lens: 0xc89a94, on: 1.0 },
  /** Amber (stair nosings that must read in the lit level too). */
  amber: { color: 0xffa23a, lens: 0xd8c4a4, on: 0 },
};
export type StripChannel = 'emerg' | 'red' | 'amber';
/**
 * Strip lens material of a channel — ONE material per channel per level, so every strip of the channel switches
 * together. `emerg` (red, off) for the spine / bay / dive-locker strips that light with the emergency groups; `red` (on, ≈ 1.2) for
 * the crawl and magazine strips; `amber` (off) spare.
 */
export function stripMat5(L: LevelBuild, ch: StripChannel = 'emerg'): THREE.MeshStandardMaterial {
  return mat4(L, `k5_strip_${ch}`, () => {
    const d = STRIPS[ch];
    const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: d.lens, roughness: 0.3, metalness: 0 });
    m.emissive = new THREE.Color(d.color);
    m.emissiveIntensity = 1.2 * d.on;
    m.name = `k5_strip_${ch}`;
    return m;
  });
}
/** Strips of a channel on (k = 1 → emissive 1.2) / off (0) / dimmed. */
export function setStrips5(L: LevelBuild, ch: StripChannel, k: number) { stripMat5(L, ch).emissiveIntensity = 1.2 * Math.max(0, k); }

/** Red "darken ship" night-light lens of the bunks (shared; 0.35). Bind it to the berth's red points if they flicker. */
export function nightLightMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'k5_nightlight', () => {
    const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: 0x6a2420, roughness: 0.3 });
    m.emissive = new THREE.Color(0xff2a18); m.emissiveIntensity = 0.35;
    m.name = 'k5_nightlight';
    return m;
  });
}
export type LampColor = 'white' | 'warm' | 'red' | 'amber';
const LAMP: Record<LampColor, [number, number]> = { white: [0xeef4ff, 0xdfe6ee], warm: [0xffe2b8, 0xe8dccb], red: [0xff2412, 0x8a3a32], amber: [0xffa53a, 0xb88a52] };
/** Shared lamp-lens material per colour (+ intensity): one call per zone; hand it to `handle.bindEmissive(m, i)`. */
export function lampLens5(L: LevelBuild, color: LampColor = 'white', intensity = 0.35): THREE.MeshStandardMaterial {
  return mat4(L, `k5_lens_${color}_${intensity}`, () => { const m = newLens(L, color, intensity); m.name = `k5_lens_${color}_${intensity}`; return m; });
}
function newLens(L: LevelBuild, color: LampColor, intensity: number): THREE.MeshStandardMaterial {
  const [e, a] = LAMP[color];
  const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: a, roughness: 0.25, metalness: 0 });
  m.emissive = new THREE.Color(e); m.emissiveIntensity = intensity;
  return m;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Deterministic RNG (mulberry32). */
function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────────────────────────────────────────────────────────── helpers

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const easeOut = (x: number) => { const k = clamp01(x); return 1 - (1 - k) * (1 - k); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** World matrix of a local frame under the builder's current transform. */
function worldOf(b: Builder, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  return b.m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
}
/** World direction of a local direction under the builder's current transform. */
function dirOf(b: Builder, x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).transformDirection(b.m); }

/** A moving part: `mount` carries the world transform (tagged with the builder's rooms, child of the level root);
 * `pivot` (its child) is what moves; the geometry is authored relative to the pivot. */
export interface MovingPart5 { mount: THREE.Group; pivot: THREE.Group }
function part5(b: Builder, L: LevelBuild, name: string, px: number, py: number, pz: number, make: (p: Builder) => void, pre?: THREE.Euler): MovingPart5 {
  const p = L.part(name);
  make(p);
  const g = p.build();
  const mount = new THREE.Group();
  mount.name = name;
  worldOf(b, px, py, pz).decompose(mount.position, mount.quaternion, mount.scale);
  if (pre) mount.quaternion.multiply(new THREE.Quaternion().setFromEuler(pre));
  mount.userData.rooms = b.rooms.slice();
  const pivot = new THREE.Group();
  pivot.name = `${name}:pivot`;
  pivot.add(g);
  mount.add(pivot);
  L.root.add(mount);
  return { mount, pivot };
}

/**
 * A replayable timeline on the level clock: `play(from)` runs `pose(t)` every frame from `from` to `dur`; `at(t)`
 * jumps there at once (stops playback; silent, idempotent — use it for snaps and for scrubbing in the dev page).
 */
export interface Timeline { readonly dur: number; readonly playing: boolean; readonly t: number; play(from?: number): number; at(t: number): void }
function timeline(L: LevelBuild, dur: number, pose: (t: number) => void): Timeline {
  let t = 0, run = false;
  L.updaters.push((dt) => {
    if (!run) return;
    t = Math.min(dur, t + dt);
    pose(t);
    if (t >= dur) run = false;
  });
  return {
    dur,
    get playing() { return run; },
    get t() { return t; },
    play(from = 0) { t = Math.max(0, from); run = true; pose(t); return dur - t; },
    at(x) { run = false; t = Math.max(0, Math.min(dur, x)); pose(t); },
  };
}

// ───────────────────────────────────────────────────────────── signs

/**
 * Navy stencil sign (white on haze grey, W5's `navy` style; until W5 lands drawn like `stencil`) through the zone's sign
 * atlas: centre ON the surface, `face` = its outward normal. `plate` adds a thin dark backing plate. Calls: atlas only
 * (+ painted_dark with a plate).
 */
export function navySign(b: Builder, text: string, x: number, y: number, z: number, w: number, h: number, face: Face, o: { plate?: boolean; rot?: number } = {}) {
  b.detail(() => b.sign(text, 'navy', x, y, z, w, h, face, o.rot ?? 0, o.plate ?? false));
}
/** Hull frame number (`FR 112`) / big hull marking painted straight on the plating. Atlas only. */
export function hullNumber(b: Builder, text: string, x: number, y: number, z: number, face: Face, h = 0.22) {
  b.detail(() => b.sign(text, 'navy', x, y, z, Math.max(0.3, h * 0.62 * text.length), h, face));
}

/**
 * Floor strip (emergency / crawl LED) from (ax, az) to (bx, bz) at local `y` (0) — builder-frame coordinates. A U-channel
 * (two 1 cm lips, steel) with the lens between them, its top 5 mm proud of the lips — no lens face lies over a channel
 * face (3b lesson: the lens z-fought its channel). 5 cm wide overall. Run it ≥ 0.08 m off a wall base.
 * Calls: 1 (`channel`, steel_raw — pass the prop's own material to save it) + the channel's strip material (shared).
 */
export function strip5(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number, o: { y?: number; ch?: StripChannel; channel?: Mat } = {}) {
  const y = o.y ?? 0, len = Math.hypot(bx - ax, bz - az);
  if (len < 0.05) return;
  const M = stripMat5(L, o.ch ?? 'emerg');
  b.push((ax + bx) / 2, y, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
  b.detail(() => {
    for (const s of [-1, 1]) b.bx(o.channel ?? 'steel_raw', s * 0.015, 0, -len / 2, s * 0.025, 0.008, len / 2);
    b.bx(M, -0.015, 0, -len / 2 + 0.005, 0.015, 0.013, len / 2 - 0.005);
  });
  b.pop();
}

// ═════════════════════════════════════════════════════════════ GATEHOUSE

/** Rotor of `turnstile`. `click(frac)` turns it by `frac` of a turn (1/3 = one arm) with a ratchet overshoot and returns
 * the duration (0.42 s; the vignette plays `turnstile_click` at 0). `at(k)` sets the rotor's absolute turn (0 … n). */
export interface Turnstile extends MovingPart5 { click(frac?: number): number; at(turns: number): void; readonly turns: number }
/**
 * Tripod turnstile (§2.6 gate5: two at x −3.0 … −2.1 and −2.0 … −1.1 on the line z −5.0 → origins (−2.55, 0, −5.0)
 * and (−1.55, 0, −5.0), ry 0). Floor prop, origin = floor centre of the unit's footprint `lane` (0.9, x) × 0.8 (z);
 * people pass along ±z. A stainless cabinet (0.26 wide, 0.95 high) on the −x side with a card-reader face on both
 * ends, the tripod head on its lane-side top; three 0.53 m arms on a cone round an axis pointing down into the lane, the
 * barring arm horizontal across the lane at 0.95 m, the other two angled down to the entry and exit sides (as real
 * tripods). The ROTOR is a moving part (`click()`). Calls: 2 static (stainless + painted_dark) + 1 moving (stainless).
 * Collider: cabinet + the lane to 1.05 (the arms bar it; `collide`).
 */
export function turnstile(b: Builder, L: LevelBuild, o: { lane?: number; name?: string; collide?: boolean } = {}): Turnstile {
  const lane = o.lane ?? 0.9, S: Mat = 'stainless', K: Mat = 'painted_dark';
  const cx0 = -lane / 2, cx1 = cx0 + 0.26, top = 0.95;
  b.bx(S, cx0, 0.04, -0.4, cx1, top, 0.4);
  b.bx(K, cx0 - 0.005, 0, -0.38, cx1 + 0.005, 0.04, 0.38); // plinth (recessed: the stainless sides stand on it)
  b.bx(S, cx0 - 0.01, top, -0.41, cx1 + 0.01, top + 0.03, 0.41); // top cap
  // head housing on the lane-side top (the hub sits 6 cm off its face)
  b.bx(S, cx1 - 0.06, top - 0.1, -0.11, cx1 + 0.03, top + 0.06, 0.11);
  b.detail(() => {
    for (const s of [-1, 1]) {
      b.bx(K, cx0 + 0.04, 0.55, s * 0.4, cx1 - 0.04, 0.85, s * 0.41); // card-reader face on each end
      b.bx(K, cx0 + 0.07, 0.72, s * 0.41, cx1 - 0.07, 0.8, s * 0.42); // reader window
    }
    b.bx(K, cx0 + 0.02, top + 0.03, -0.3, cx0 + 0.12, top + 0.04, 0.3); // top inspection plate
  });
  // rotor: mount at the hub, pre-tilted so the rotor's local +y = the axis (down into the lane at 45°)
  const hubX = cx1 + 0.09, R = 0.53;
  const part = part5(b, L, o.name ?? 'turnstile_rotor', hubX, top - 0.02, 0, (p) => {
    p.cyl(S, 0, 0, 0, 0.065, 0.09, 'y', 14);
    p.cyl(S, 0, 0.05, 0, 0.05, 0.012, 'y', 14);
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * PI) / 3, c = Math.cos(a), s = Math.sin(a);
      // arm k: (−0.707, 0.707, 0) rotated about +y by a
      const dx = -0.7071 * c, dy = 0.7071, dz = 0.7071 * s;
      p.rod(S, dx * 0.05, dy * 0.05, dz * 0.05, dx * R, dy * R, dz * R, 0.019, 8);
      p.sphere(S, dx * R, dy * R, dz * R, 0.022, 8);
    }
  }, new THREE.Euler(0, 0, -3 * PI / 4));
  let turns = 0;
  const pose = (tt: number) => { part.pivot.rotation.y = tt * 2 * PI; };
  pose(0);
  let from = 0, to = 0;
  const tl = timeline(L, 0.42, (t) => {
    // fast push to 110 % then the ratchet pulls it back to the detent
    const k = t < 0.2 ? easeOut(t / 0.2) * 1.1 : 1.1 - 0.1 * smooth((t - 0.2) / 0.22);
    turns = from + (to - from) * k; pose(turns);
  });
  if (o.collide !== false) {
    b.collide(cx0, 0, -0.41, cx1, top + 0.06, 0.41, 'metal', true);
    b.collide(cx1, 0, -0.32, lane / 2 - 0.02, 1.05, 0.32, 'metal', true);
  }
  return { ...part, get turns() { return turns; }, click(frac = 1 / 3) { from = turns; to = turns + frac; return tl.play(0); }, at(n) { turns = n; from = to = n; pose(n); } };
}

/**
 * Gatehouse fence (§2.6: x 1.2 … 2.4 and −5.8 … −3.0 on the turnstile line, h 1.2). Builder-frame prop: runs along local
 * +x from 0 to `len`, centred on z 0: square posts at both ends and every ≤ 1.4 m, a top rail, a kick rail and steel
 * balusters every 0.12 m. Calls: 2 (navy_grey + steel_raw). Collider: 0.06 thick, to `h` (`collide`).
 */
export function fence(b: Builder, L: LevelBuild, o: { len: number; h?: number; collide?: boolean }) {
  const len = o.len, h = o.h ?? 1.2, N: Mat = 'navy_grey', S: Mat = 'steel_raw';
  const n = Math.max(1, Math.ceil(len / 1.4));
  for (let i = 0; i <= n; i++) { const x = Math.min(len - 0.03, Math.max(0.03, (i * len) / n)); b.bx(N, x - 0.03, 0, -0.03, x + 0.03, h, 0.03); }
  b.bx(N, 0.03, h - 0.05, -0.025, len - 0.03, h - 0.01, 0.025);
  b.bx(N, 0.03, 0.08, -0.02, len - 0.03, 0.14, 0.02);
  b.detail(() => { for (let x = 0.12; x < len - 0.06; x += 0.12) b.bx(S, x - 0.006, 0.14, -0.006, x + 0.006, h - 0.05, 0.006); });
  if (o.collide !== false) b.collide(0, 0, -0.03, len, h, 0.03, 'metal', true);
}

/**
 * The open equipment gate (§2.6: x −1.0 … 1.2 on z −5.0, the route). Floor prop, origin = floor centre of the opening
 * `w` (2.2): two hinge posts at ±w/2 and two leaves of w/2 (fence pattern, `h` 1.2) swung open by `open` (π/2) toward
 * local −z (pick ry so that is away from where people come from); with π/2 they stand along the lane edges and leave the
 * whole width clear. A drop bolt and a chained padlock hang off the right leaf. Calls: 2 (navy_grey + steel_raw).
 * Collider: posts + each leaf (only at open = 0 or π/2: other angles get none).
 */
export function equipmentGate(b: Builder, L: LevelBuild, o: { w?: number; h?: number; open?: number; collide?: boolean } = {}) {
  const w = o.w ?? 2.2, h = o.h ?? 1.2, ang = o.open ?? PI / 2, N: Mat = 'navy_grey', S: Mat = 'steel_raw', lw = w / 2 - 0.08;
  for (const s of [-1, 1]) {
    b.bx(N, s * w / 2 - 0.05, 0, -0.05, s * w / 2 + 0.05, h + 0.12, 0.05);
    b.cyl(N, s * w / 2, h + 0.14, 0, 0.055, 0.04, 'y', 10);
    // leaf hinged at the post's inner face, swinging toward −z (left leaf runs +x from its hinge, right leaf −x)
    b.push(s * (w / 2 - 0.06), 0, 0, s < 0 ? ang : -ang);
    const xa = s < 0 ? 0.02 : -lw, xb = s < 0 ? lw : -0.02, hs = s < 0 ? xa : xb - 0.05, ls = s < 0 ? xb - 0.05 : xa;
    b.bx(N, xa, 0.08, -0.025, xb, 0.13, 0.025).bx(N, xa, h - 0.06, -0.025, xb, h - 0.01, 0.025);
    b.bx(N, hs, 0.13, -0.025, hs + 0.05, h - 0.06, 0.025).bx(N, ls, 0.13, -0.025, ls + 0.05, h - 0.06, 0.025);
    b.detail(() => { for (let x = xa + 0.12; x < xb - 0.08; x += 0.12) b.bx(S, x - 0.006, 0.13, -0.006, x + 0.006, h - 0.06, 0.006); });
    if (s > 0) b.detail(() => { b.rod(S, -lw + 0.1, 0.05, 0.03, -lw + 0.1, 0.55, 0.03, 0.012, 6); b.torus(S, -lw + 0.04, 0.95, 0.04, 0.03, 0.006, 'z', 10); b.box(S, -lw + 0.04, 0.89, 0.04, 0.05, 0.06, 0.02); });
    if (o.collide !== false && (Math.abs(ang) < 1e-3 || Math.abs(Math.abs(ang) - PI / 2) < 1e-3)) b.collide(xa, 0, -0.03, xb, h, 0.03, 'metal', true);
    b.pop();
  }
  if (o.collide !== false) for (const s of [-1, 1]) b.collide(s * w / 2 - 0.05, 0, -0.05, s * w / 2 + 0.05, h + 0.12, 0.05, 'metal', true);
}

/**
 * Guard booth shell (§2.6 gate5: x 2.4 … 5.8, z −4.0 … −0.2, glazed west face, roof 2.6 → origin (4.1, 0, −2.1),
 * ry −π/2). Floor prop, origin = floor centre, `w` (3.8, local x) × `d` (3.4, local z); FRONT (+z) = the glazed face: a
 * 1.0 m steel kerb, bullet-proof glass 1.04 … 2.4 in three panes with mullions, a header to 2.6, a deal tray in the middle
 * pane and an OUTSIDE ledge (kerb cap 0.2 m proud, top 1.04: `note5_visitors` sits on it at local (0.1, 1.05, 1.8));
 * a solid side wall on each face listed in `sides` (default ['-x'] = the plan's south wall); the back (−z) and the other
 * side are the room's walls (left open — the back door into solid is W7's set piece); roof slab 2.6 … 2.72.
 * Calls: 2 (navy_grey + glass_thick). Collider: kerb, glass ('glass': bullets star it), header, side walls, roof.
 */
export function guardBooth(b: Builder, L: LevelBuild, o: { w?: number; d?: number; sides?: ('-x' | '+x')[]; collide?: boolean } = {}) {
  const w = o.w ?? 3.8, d = o.d ?? 3.4, N: Mat = 'navy_grey', G: Mat = 'glass_thick', kerb = 1.0, cap = 1.04, gt = 2.4, roof = 2.6, t = 0.15;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, zg = z1 - t / 2, sides = o.sides ?? ['-x'];
  b.bx(N, x0, 0, z1 - t, x1, kerb, z1);
  b.bx(N, x0 - 0.02, kerb, z1 - t - 0.05, x1 + 0.02, cap, z1 + 0.2); // kerb cap + outside ledge
  b.bx(N, x0, gt, z1 - t, x1, roof, z1); // header
  // glass panes between mullions
  const panes = 3, mw = 0.08;
  for (let i = 0; i <= panes; i++) { const x = lerp(x0 + mw / 2, x1 - mw / 2, i / panes); b.bx(N, x - mw / 2, cap, z1 - t, x + mw / 2, gt, z1); }
  for (let i = 0; i < panes; i++) {
    const a = lerp(x0 + mw / 2, x1 - mw / 2, i / panes) + mw / 2, c = lerp(x0 + mw / 2, x1 - mw / 2, (i + 1) / panes) - mw / 2;
    b.quad(G, (a + c) / 2, (cap + gt) / 2, zg, c - a, gt - cap, '+z');
  }
  for (const sd of sides) { const xs = sd === '-x' ? x0 : x1 - t; b.bx(N, xs, 0, z0, xs + t, roof, z1 - t); }
  b.bx(N, x0 - 0.05, roof, z0, x1 + 0.05, roof + 0.12, z1 + 0.05);
  b.detail(() => {
    // deal tray through the middle pane's cap, speaking grille above it
    b.bx(N, -0.3, cap, z1 - t - 0.16, 0.3, cap + 0.06, z1 - t - 0.05).bx(N, -0.3, cap, z1 + 0.2, 0.3, cap + 0.05, z1 + 0.24);
    b.cyl(N, 0.0, 1.55, z1 - t / 2, 0.1, t + 0.03, 'z', 16);
    for (let k = -3; k <= 3; k++) b.bx(N, -0.08, 1.55 + k * 0.024 - 0.004, z1 + 0.015, 0.08, 1.55 + k * 0.024 + 0.004, z1 + 0.022);
    // rain/condensation gutter strip along the header, stencilled booth number
    b.bx(N, x0, gt - 0.03, z1, x1, gt, z1 + 0.04);
  });
  navySign(b, '게이트 4 — 보초', 0, 2.5, z1 + 0.001, 1.4, 0.16, '+z');
  if (o.collide !== false) {
    b.collide(x0, 0, z1 - t, x1, cap, z1 + 0.2, 'metal', true);
    b.collide(x0, cap, z1 - t, x1, gt, z1, 'glass', true);
    b.collide(x0, gt, z1 - t, x1, roof + 0.12, z1, 'metal', true);
    for (const sd of sides) { const xs = sd === '-x' ? x0 : x1 - t; b.collide(xs, 0, z0, xs + t, roof, z1 - t, 'metal', true); }
    b.collide(x0 - 0.05, roof, z0, x1 + 0.05, roof + 0.12, z1 - t, 'metal', true);
  }
}

/** Blades of `deskFan`: `spin(on)` spins them up / down (0.8 s ramps, 6 rev/s), `at(rps)` sets the speed at once. */
export interface DeskFan extends MovingPart5 { spin(on: boolean): void; at(rps: number): void }
/**
 * Desk fan (the booth's, §2.6: "a desk fan running"). Floor/desk prop, origin = bottom centre, blows along +z: a weighted
 * base, a stem to 0.3, a wire guard (static) and the 4-blade ROTOR (moving part). Starts running when `running` (true).
 * Calls: 1 static (painted_dark) + 1 moving (plastic_white).
 */
export function deskFan(b: Builder, L: LevelBuild, o: { name?: string; running?: boolean } = {}): DeskFan {
  const K: Mat = 'painted_dark', hy = 0.3;
  b.cyl(K, 0, 0.015, 0, 0.09, 0.03, 'y', 16);
  b.rod(K, 0, 0.03, -0.02, 0, hy - 0.03, -0.04, 0.012, 6);
  b.cyl(K, 0, hy, -0.07, 0.04, 0.08, 'z', 10); // motor
  b.detail(() => {
    b.torus(K, 0, hy, 0.0, 0.13, 0.004, 'z', 24).torus(K, 0, hy, -0.04, 0.13, 0.004, 'z', 24);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * PI; b.rod(K, 0, hy, 0.005, Math.cos(a) * 0.13, hy + Math.sin(a) * 0.13, 0.0, 0.002, 3); }
    b.cyl(K, 0, hy, 0.006, 0.025, 0.006, 'z', 10);
  });
  const part = part5(b, L, o.name ?? 'desk_fan_rotor', 0, hy, -0.02, (p) => {
    p.cyl('plastic_white', 0, 0, 0, 0.022, 0.03, 'z', 10);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 2 * PI; p.rbox('plastic_white', Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0, 0.1, 0.045, 0.004, 0.0, 0.35, a); }
  });
  let rps = 0, target = o.running === false ? 0 : 6;
  L.updaters.push((dt) => {
    rps += Math.sign(target - rps) * Math.min(Math.abs(target - rps), dt * 7.5);
    if (rps > 0) part.pivot.rotation.z -= dt * rps * 2 * PI;
  });
  return { ...part, spin(on) { target = on ? 6 : 0; }, at(v) { rps = target = v; } };
}

/**
 * The booth's inner counter (§2.6: Aas's palm plate `mk5_aas_palm` (4.6, 1.1, −2.0) facing −x, the `gate_log` monitor,
 * a mug, the desk fan). Wall prop (back at z 0 on the room wall, the glass is at +z) → origin (5.8, 0, −2.1), ry −π/2.
 * A standing-height gate-control desk `len` (3.5, x) × `d` (1.25) at 1.0 with a kick recess, a sloped pedestal for the
 * palm plate on its front edge (plate plane at local (0.1, 1.1, 1.2) — the plan's point with these defaults), a 0.7 × 0.42
 * monitor on a stand facing the glass, a desk phone, a mug and a `deskFan`. The SCREENS are D1's (`L.screen` at the
 * returned points, facing the returned normal). Calls: 2 (navy_grey + painted_dark) + the fan (1 static, 1 moving).
 * Collider: the desk to 1.0 (`collide`).
 */
export function boothCounter(b: Builder, L: LevelBuild, o: { len?: number; d?: number; fanName?: string; collide?: boolean } = {}): {
  palm: THREE.Vector3; monitor: THREE.Vector3; monitorSize: [number, number]; normal: THREE.Vector3; mug: THREE.Vector3; fan: DeskFan;
} {
  const len = o.len ?? 3.5, d = o.d ?? 1.25, N: Mat = 'navy_grey', K: Mat = 'painted_dark', top = 1.0;
  b.bx(N, -len / 2, 0.1, 0, len / 2, top - 0.03, d - 0.04);
  b.bx(K, -len / 2 + 0.02, 0, 0, len / 2 - 0.02, 0.1, d - 0.1); // kick recess
  b.bx(K, -len / 2 - 0.01, top - 0.03, 0, len / 2 + 0.01, top, d); // top
  // palm pedestal: sloped block whose face (toward +z) carries the plate at (0.1, 1.1, 1.195)
  b.bx(N, -0.05, top, d - 0.24, 0.25, 1.2, d - 0.06); // (face 1 cm behind the plate's plane)
  // monitor on a stand at x −0.9, screen plane z 0.62 (+z)
  const mx = -0.9, my = 1.42, mz = 0.6, mw = 0.7, mh = 0.42;
  b.bx(K, mx - 0.1, top, mz - 0.2, mx + 0.1, top + 0.015, mz - 0.02);
  b.bx(K, mx - 0.03, top, mz - 0.1, mx + 0.03, my - 0.1, mz - 0.06);
  b.bx(K, mx - mw / 2 - 0.02, my - mh / 2 - 0.02, mz - 0.05, mx + mw / 2 + 0.02, my + mh / 2 + 0.02, mz);
  b.detail(() => {
    // desk phone + handset in its cradle, logbook
    b.rbox(K, 0.7, top + 0.03, 0.45, 0.2, 0.06, 0.2, 0.15, 0.3, 0);
    b.rbox(K, 0.7, top + 0.075, 0.42, 0.21, 0.04, 0.06, 0, 0.3, 0);
    b.rbox(N, -0.2, top + 0.012, 0.7, 0.3, 0.024, 0.22, 0, -0.15, 0);
    // mug (navy, on the desk)
    b.cyl(K, 0.45, top + 0.05, 0.95, 0.04, 0.1, 'y', 12); b.torus(K, 0.5, top + 0.05, 0.95, 0.028, 0.007, 'z', 8);
    // cable from the monitor down the back
    b.rod(K, mx, my - 0.1, mz - 0.08, mx + 0.1, top, 0.15, 0.008, 4);
  });
  let fan!: DeskFan;
  b.at(1.15, top, 0.55, -0.35, () => { fan = deskFan(b, L, { name: o.fanName ?? 'gate5_booth_fan' }); });
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, top, d, 'metal', true);
  return { palm: b.world(0.1, 1.1, d - 0.05), monitor: b.world(mx, my, mz + 0.01), monitorSize: [mw, mh], normal: dirOf(b, 0, 0, 1), mug: b.world(0.45, top, 0.95), fan };
}

/**
 * Screen frame for a board screen (duty board `dock_status` 3.0 × 1.2, `onpost`, the sub bay's `TERN` board). Wall prop,
 * origin = the SCREEN's centre on the wall face: a dark back plate (0 … 0.02) and a 4 cm lip round the opening (to
 * 0.06). Returns `screen` = the world point for `L.screen(…, w, h, p.x, p.y, p.z, face)` (plane 0.03: 1 cm in front of
 * the plate, never coplanar). Calls: 1 (painted_dark).
 */
export function boardFrame(b: Builder, L: LevelBuild, o: { w: number; h: number }): { screen: THREE.Vector3 } {
  const { w, h } = o, K: Mat = 'painted_dark', f = 0.05;
  b.bx(K, -w / 2 - f, -h / 2 - f, 0, w / 2 + f, h / 2 + f, 0.02);
  b.bx(K, -w / 2 - f, -h / 2 - f, 0.02, w / 2 + f, -h / 2, 0.06).bx(K, -w / 2 - f, h / 2, 0.02, w / 2 + f, h / 2 + f, 0.06);
  b.bx(K, -w / 2 - f, -h / 2, 0.02, -w / 2, h / 2, 0.06).bx(K, w / 2, -h / 2, 0.02, w / 2 + f, h / 2, 0.06);
  return { screen: b.world(0, 0, 0.03) };
}

/**
 * Notice board (gatehouse notices, mess board, dive board). Wall prop, origin = board centre on the wall face, `w` × `h`
 * (1.2 × 0.9): a steel board with a frame and `notices` (default three) printed via the atlas in a non-overlapping grid,
 * with magnets. Calls: 1 (navy_grey) + atlas.
 */
export function noticeBoard(b: Builder, L: LevelBuild, o: { w?: number; h?: number; notices?: string[] } = {}) {
  const w = o.w ?? 1.2, h = o.h ?? 0.9, N: Mat = 'navy_grey';
  const notes = o.notices ?? ['근무 명단 — 초소 4\n월  0800–1200  모듈', '경계 상태\n브라보', '개인 기기\n이 지점 너머 반입 금지'];
  b.bx(N, -w / 2, -h / 2, 0, w / 2, h / 2, 0.015);
  for (const s of [-1, 1]) { b.bx(N, -w / 2 - 0.02, s > 0 ? h / 2 : -h / 2 - 0.02, 0, w / 2 + 0.02, s > 0 ? h / 2 + 0.02 : -h / 2, 0.03); b.bx(N, s > 0 ? w / 2 : -w / 2 - 0.02, -h / 2, 0, s > 0 ? w / 2 + 0.02 : -w / 2, h / 2, 0.03); }
  const cols = notes.length > 2 ? 2 : notes.length, rows = Math.ceil(notes.length / cols), cw = (w - 0.1) / cols, rh = (h - 0.1) / rows;
  b.detail(() => notes.forEach((t, i) => {
    const cx = -w / 2 + 0.05 + cw * (i % cols + 0.5), cy = h / 2 - 0.05 - rh * (Math.floor(i / cols) + 0.5);
    b.sign(t, 'label', cx, cy, 0.016, cw - 0.08, Math.min(rh - 0.06, (cw - 0.08) * 0.72), '+z', (i % 3 - 1) * 0.02);
    b.cyl(N, cx, cy + Math.min(rh - 0.06, (cw - 0.08) * 0.72) / 2 - 0.02, 0.03, 0.012, 0.008, 'z', 8);
  }));
}

/**
 * First-aid cabinet (§2.6 gate5: `p5_gate_med` (5.4, 1.0, −6.0) on the east wall → origin (5.8, 1.0, −6.0), ry −π/2).
 * Wall prop, origin = on the wall face at the height of the DROP-DOWN DOOR's top (the door hangs open as a shelf at y 0
 * reaching 0.45 out; a medkit pickup at local (0, 0, 0.4) sits on it). Cabinet 0.55 × 0.6 × 0.2 above the shelf with
 * dressings inside, chain stays, a green-cross plate. Calls: 2 (painted_white + steel_raw) + atlas.
 */
export function firstAidCabinet(b: Builder, L: LevelBuild) {
  const W: Mat = 'painted_white', S: Mat = 'steel_raw', w = 0.55;
  b.bx(W, -w / 2, -0.02, 0, w / 2, 0.6, 0.02); // back
  b.bx(W, -w / 2, -0.02, 0.02, -w / 2 + 0.02, 0.6, 0.2).bx(W, w / 2 - 0.02, -0.02, 0.02, w / 2, 0.6, 0.2);
  b.bx(W, -w / 2 + 0.02, 0.58, 0.02, w / 2 - 0.02, 0.6, 0.2).bx(W, -w / 2 + 0.02, -0.02, 0.02, w / 2 - 0.02, 0.0, 0.2);
  b.bx(W, -w / 2 + 0.02, 0.28, 0.02, w / 2 - 0.02, 0.295, 0.18); // inner shelf
  // the door, dropped open to horizontal: a shelf 0.45 out at y −0.02 … 0
  b.bx(W, -w / 2, -0.025, 0.2, w / 2, -0.005, 0.45);
  b.bx(W, -w / 2, -0.005, 0.43, w / 2, 0.025, 0.45); // its lip
  b.detail(() => {
    for (const s of [-1, 1]) b.rod(S, s * (w / 2 - 0.03), 0.3, 0.19, s * (w / 2 - 0.03), 0.0, 0.42, 0.004, 4); // chain stays
    for (const [x, y, ww, hh] of [[-0.14, 0.3, 0.16, 0.12], [0.08, 0.3, 0.2, 0.09], [-0.12, 0.0, 0.2, 0.15], [0.12, 0.0, 0.12, 0.2]] as const) b.bx(W, x - ww / 2, y, 0.05, x + ww / 2, y + hh, 0.16);
    b.bx(S, -0.06, 0.62, 0.0, 0.06, 0.64, 0.05);
  });
  navySign(b, '✚ FIRST AID', 0, 0.7, 0.002, 0.5, 0.12, '+z');
}

/**
 * Weapon-clearing barrel (§2.6 gate5 (−5.2, 0, −8.6)). Floor prop, origin = floor centre: a sand-filled yellow drum
 * (⌀ 0.58, 0.88 high) with a black band, a clearing tube angled 45° into its lid toward +z (the side you stand at),
 * a stencil. Calls: 2 (painted_yellow + painted_dark) + atlas. Collider: 0.58 square to 0.9 (`collide`).
 */
export function clearingBarrel(b: Builder, L: LevelBuild, o: { collide?: boolean } = {}) {
  const Y: Mat = 'painted_yellow', K: Mat = 'painted_dark', r = 0.29, h = 0.88;
  b.cyl(Y, 0, h / 2, 0, r, h, 'y', 20);
  for (const y of [0.25, 0.6]) b.cyl(Y, 0, y, 0, r + 0.008, 0.03, 'y', 20);
  b.cyl(K, 0, h - 0.12, 0, r + 0.004, 0.1, 'y', 20);
  b.cyl(K, 0, h + 0.01, 0, r - 0.02, 0.02, 'y', 20); // lid
  b.push(0, h + 0.02, 0.06, 0, -PI / 4, 0);
  b.cyl(K, 0, 0.12, 0, 0.075, 0.3, 'y', 12);
  b.cyl(K, 0, 0.27, 0, 0.09, 0.03, 'y', 12);
  b.pop();
  navySign(b, '여기서 총기 안전 처리', 0, 0.43, r + 0.012, 0.42, 0.09, '+z');
  if (o.collide !== false) b.collide(-r, 0, -r, r, h + 0.04, r, 'metal', true);
}

// ═════════════════════════════════════════════════════════════ DUTY ROOM

/**
 * Watch desk (§2.6 duty5: x −3.0 … 0.0, z −16.0 … −15.0, h 1.0; low cover `cv5_d1` at its south face). Floor prop,
 * origin = floor centre, `len` (3.0, x) × `d` (1.0, z), FRONT (+z) = the visitors' side: a standing-height steel watch
 * desk, top 1.0, with a raised log rail along the front edge to 1.25 (so a crouched soldier behind it is covered to the
 * helmet), a kick recess on the officer's side (−z), a logbook, the phone OFF THE HOOK (handset on the desk, cord
 * hanging), and a gooseneck desk lamp (`lamp` = its head and aim, for D1's spot; lens = `lampLens5('warm')`).
 * Returns `top` (world y of the desk top), `note` (world point for `note5_watch`: local (0.3, 1.0, 0)), `lamp`.
 * Calls: 2 (navy_grey + painted_dark) + the shared warm lens. Collider: footprint to 1.0 + the rail to 1.25.
 */
export function watchDesk(b: Builder, L: LevelBuild, o: { len?: number; d?: number; collide?: boolean } = {}): {
  top: number; note: THREE.Vector3; phone: THREE.Vector3; lamp: { pos: THREE.Vector3; target: THREE.Vector3 };
} {
  const len = o.len ?? 3.0, d = o.d ?? 1.0, N: Mat = 'navy_grey', K: Mat = 'painted_dark', top = 1.0;
  b.bx(N, -len / 2, 0.12, -d / 2 + 0.12, len / 2, top - 0.03, d / 2);
  b.bx(K, -len / 2 + 0.02, 0, -d / 2 + 0.14, len / 2 - 0.02, 0.12, d / 2 - 0.02); // plinth
  b.bx(N, -len / 2, 0.12, -d / 2, -len / 2 + 0.04, top - 0.03, -d / 2 + 0.12).bx(N, len / 2 - 0.04, 0.12, -d / 2, len / 2, top - 0.03, -d / 2 + 0.12);
  b.bx(K, -len / 2 - 0.01, top - 0.03, -d / 2 - 0.01, len / 2 + 0.01, top, d / 2 + 0.01); // top
  b.bx(N, -len / 2, top, d / 2 - 0.08, len / 2, 1.25, d / 2 + 0.01); // log rail / upstand
  b.bx(K, -len / 2, 1.25, d / 2 - 0.1, len / 2, 1.27, d / 2 + 0.02);
  b.detail(() => {
    // logbook open, a pen
    b.rbox(N, 0.3, top + 0.008, 0, 0.42, 0.016, 0.3, 0, 0.08, 0);
    b.rod(K, 0.58, top + 0.006, 0.05, 0.7, top + 0.006, 0.1, 0.004, 4);
    // phone base, the handset lying off its cradle, the coiled cord sagging over the front edge
    b.rbox(K, -0.9, top + 0.035, -0.15, 0.22, 0.07, 0.2, 0.15, 0.2, 0);
    b.rbox(K, -0.55, top + 0.025, -0.05, 0.22, 0.045, 0.06, 0, -0.6, 0.15);
    b.cyl(K, -0.66, top + 0.03, 0.02, 0.025, 0.04, 'y', 8);
    for (let i = 0; i < 10; i++) { const k = i / 9; b.sphere(K, lerp(-0.85, -0.6, k), top + 0.02 + Math.sin(k * PI) * 0.02, lerp(-0.1, -0.03, k), 0.008, 5); }
    // the duty mug and a stack of message forms
    b.cyl(K, 1.0, top + 0.05, -0.2, 0.04, 0.1, 'y', 12);
    b.bx(N, 0.95, top, 0.15, 1.2, top + 0.02, 0.32);
  });
  // gooseneck lamp at the −x end, head over the logbook
  const lx = -1.25, lz = -0.25;
  b.cyl(K, lx, top + 0.015, lz, 0.07, 0.03, 'y', 12);
  b.rod(K, lx, top + 0.03, lz, lx + 0.15, top + 0.42, lz + 0.05, 0.01, 6);
  b.rod(K, lx + 0.15, top + 0.42, lz + 0.05, lx + 0.42, top + 0.48, lz + 0.12, 0.01, 6);
  b.push(lx + 0.47, top + 0.46, lz + 0.12, 0, 0, -0.55);
  b.cyl(K, 0, 0, 0, 0.04, 0.12, 'x', 12, 0.07);
  b.detail(() => b.cyl(lampLens5(L, 'warm'), 0.062, 0, 0, 0.064, 0.004, 'x', 12));
  b.pop();
  if (o.collide !== false) { b.collide(-len / 2, 0, -d / 2, len / 2, top, d / 2, 'metal', true); b.collide(-len / 2, top, d / 2 - 0.08, len / 2, 1.27, d / 2 + 0.02, 'metal', true); }
  return { top: b.world(0, top, 0).y, note: b.world(0.3, top, 0), phone: b.world(-0.55, top, -0.05), lamp: { pos: b.world(lx + 0.52, top + 0.43, lz + 0.12), target: b.world(0.2, top, 0) } };
}

/**
 * Filing cabinets (§2.6 duty5: x 4.4 … 5.6, z −21.8 … −21.2, h 1.3, low cover `cv5_d2` at their north face → origin
 * (5.0, 0, −21.8), ry 0). Wall prop (back at z 0), `n` (2) cabinets 0.6 wide × 0.6 deep × `h` (1.3), three drawers each
 * with a pull, a label slot and a lock; `open` = the index of one drawer pulled out 0.3 m (dressing; top drawer of the
 * first cabinet: 0). Calls: 2 (navy_grey + steel_raw). Collider: footprint to `h` (the open drawer excluded).
 */
export function filingCabinets(b: Builder, L: LevelBuild, o: { n?: number; h?: number; open?: number | null; collide?: boolean } = {}) {
  const n = o.n ?? 2, h = o.h ?? 1.3, N: Mat = 'navy_grey', S: Mat = 'steel_raw', cw = 0.6, d = 0.6, x0 = -n * cw / 2;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * cw + 0.005, c = a + cw - 0.01;
    b.bx(N, a, 0, 0, c, h, d - 0.02);
    const dh = (h - 0.08) / 3;
    for (let k = 0; k < 3; k++) {
      const y0 = 0.05 + k * dh, idx = i * 3 + (2 - k), out = o.open === idx ? 0.3 : 0;
      b.bx(N, a + 0.01, y0 + 0.005, d - 0.02 + out, c - 0.01, y0 + dh - 0.005, d + out);
      if (out) { b.bx(N, a + 0.03, y0 + 0.03, d - 0.02, a + 0.04, y0 + dh - 0.06, d - 0.02 + out); b.bx(N, c - 0.04, y0 + 0.03, d - 0.02, c - 0.03, y0 + dh - 0.06, d - 0.02 + out); }
      b.detail(() => {
        b.bx(S, (a + c) / 2 - 0.08, y0 + dh * 0.62, d + out, (a + c) / 2 + 0.08, y0 + dh * 0.62 + 0.025, d + out + 0.025);
        b.bx(S, (a + c) / 2 - 0.05, y0 + dh * 0.78, d + out, (a + c) / 2 + 0.05, y0 + dh * 0.78 + 0.035, d + out + 0.003);
      });
    }
    b.detail(() => b.cyl(S, c - 0.05, h - 0.04, d, 0.01, 0.01, 'z', 8));
  }
  if (o.collide !== false) b.collide(x0, 0, 0, -x0, h, d, 'metal', true);
}

/** CCTV camera of `wallCamera`: `setTally(color | null)` lights / darkens its tally LED (own material). */
export interface WallCamera { tally: THREE.MeshStandardMaterial; lens: THREE.Vector3; setTally(color: THREE.ColorRepresentation | null): void }
/**
 * Wall CCTV camera with a tally LED (duty room east wall; ready room `(−10.0, 3.0, −22.25)` facing −z — Kessler's "I can
 * see you on the camera"). Wall prop, origin on the wall face at the bracket: an arm 0.25 out, a housing 0.3 long with a
 * sun hood tilted `tilt` (0.35 rad) down, looking along +z; the TALLY (red, `on` true) is its own material.
 * Calls: 2 (painted_white + painted_dark) + 1 (tally).
 */
export function wallCamera(b: Builder, L: LevelBuild, o: { tilt?: number; on?: boolean; color?: THREE.ColorRepresentation } = {}): WallCamera {
  const W: Mat = 'painted_white', K: Mat = 'painted_dark', tilt = o.tilt ?? 0.35;
  b.bx(K, -0.06, -0.08, 0, 0.06, 0.08, 0.015);
  b.rod(K, 0, 0, 0.015, 0, 0.02, 0.22, 0.018, 8);
  b.push(0, 0.03, 0.24, 0, tilt, 0);
  b.bx(W, -0.055, -0.05, -0.06, 0.055, 0.05, 0.24);
  b.bx(W, -0.065, 0.05, -0.04, 0.065, 0.06, 0.28); // sun hood
  b.cyl(K, 0, -0.005, 0.245, 0.032, 0.01, 'z', 12);
  b.pop();
  const tally = newLens(L, 'red', 0);
  tally.name = 'k5_cam_tally';
  const setTally = (c: THREE.ColorRepresentation | null) => { if (c === null) tally.emissiveIntensity = 0; else { tally.emissive.set(c); tally.emissiveIntensity = 0.35; } };
  b.push(0, 0.03, 0.24, 0, tilt, 0);
  b.detail(() => b.sphere(tally, 0.035, -0.035, 0.242, 0.008, 6));
  const lens = b.world(0, -0.005, 0.25);
  b.pop();
  if (o.on !== false) setTally(o.color ?? 0xff2010);
  return { tally, lens, setTally };
}

/**
 * Steel wall shelf with two brackets (`p5_duty_ammo` (7.5, 1.2, −11.0) shelf, galley, dive locker). Wall prop, origin =
 * the shelf TOP's centre on the wall face: `w` (0.8) × `d` (0.3), a 2 cm front lip. Returns the world point of the
 * shelf top's centre. Calls: 1 (navy_grey).
 */
export function wallShelf(b: Builder, L: LevelBuild, o: { w?: number; d?: number } = {}): THREE.Vector3 {
  const w = o.w ?? 0.8, d = o.d ?? 0.3, N: Mat = 'navy_grey';
  b.bx(N, -w / 2, -0.02, 0, w / 2, 0, d);
  b.bx(N, -w / 2, 0, d - 0.012, w / 2, 0.02, d);
  for (const s of [-1, 1]) { b.bx(N, s * (w / 2 - 0.08) - 0.01, -0.22, 0, s * (w / 2 - 0.08) + 0.01, -0.02, 0.02); b.rbox(N, s * (w / 2 - 0.08), -0.12, d * 0.4, 0.015, 0.02, Math.hypot(0.2, d * 0.8), Math.atan2(0.2, d * 0.8) - PI, 0, 0); }
  return b.world(0, 0, d / 2);
}

// ═════════════════════════════════════════════════════════════ READY ROOM

/**
 * A locker door that moves (`lockerBank` `movable`). Hinged on its local −x edge, swings outward. `set(a)` = opening
 * angle (rad, 0 = shut); `rattle(dur, amp)` = it chatters on its latch (the rows' `locker_rattle` at +2.2 s of
 * `v5_hull_groan`); `bang()` = it flies open to the stop (`to`, 1.95 rad), slams (`impact` s after the call — play
 * `locker_bang` then), bounces twice and settles (`dur`); `at(t)` scrubs the bang; `snap(open)` = its end state.
 * `shelf` = world point on the locker's shelf (a `looseHelmet` starts there); `centre` / `normal` = the door's face.
 */
export interface LockerDoor extends MovingPart5 {
  readonly angle: number; shelf: THREE.Vector3; centre: THREE.Vector3; normal: THREE.Vector3;
  set(a: number): void; rattle(dur?: number, amp?: number): number; bang(o?: { to?: number }): { dur: number; impact: number }; at(t: number): void; snap(open?: boolean): void;
}
type LockerSide = '+z' | '-z';
/**
 * A bank of navy steel wardrobe lockers (§2.6 ready5: rows L1 x −8.0 … −7.4 and L2 x −0.4 … 0.2, z −33.0 … −26.0, h 2.0
 * → origins (−7.7, 0, −29.5) and (−0.1, 0, −29.5), ry π/2; high cover on their long faces). Floor prop, origin = floor
 * centre, long axis local x (`len` 7.0), depth `d` (0.6) along z. `sides` 2 = back-to-back (doors on +z and −z, 0.3 deep
 * each), 1 = doors on +z only (solid back at −z). `n` lockers per side (default round(len / 0.5) = 14), numbered on a
 * header band above the doors (atlas): +z side from `first['+z']` (1) at local −x, −z side from `first['-z']` (n + 1)
 * at local +x. Door faces are exactly at z = ±d/2 (`note5_locker` 2 cm in front of one sits on it). `ajar`: static doors
 * standing open by `ajarAngle` (0.35 rad), with shelf + coat hook inside; `movable`: doors built as moving parts
 * (`LockerDoor`, +1 call each — the scare door and, for the rattle, its neighbours), shut or at `open` angle.
 * Door centres along x: −len/2 + 0.015 + (i + 0.5)·pitch, pitch = (len − 0.03)/n (0.4979 for the defaults).
 * Calls: 2 (navy_grey + steel_raw) + atlas + 1 per movable door (navy_grey). Collider: the whole bank to `h` (2.0).
 */
export function lockerBank(b: Builder, L: LevelBuild, o: {
  len?: number; d?: number; h?: number; sides?: 1 | 2; n?: number; first?: Partial<Record<LockerSide, number>>;
  ajar?: [LockerSide, number][]; ajarAngle?: number; movable?: [LockerSide, number, number?][]; names?: Partial<Record<string, string>>;
  name?: string; collide?: boolean;
} = {}): { doors: Map<string, LockerDoor>; door(side: LockerSide, i: number): LockerDoor | undefined; centre(side: LockerSide, i: number): THREE.Vector3; pitch: number } {
  const len = o.len ?? 7.0, D = o.d ?? 0.6, h = o.h ?? 2.0, sides = o.sides ?? 2, n = o.n ?? Math.max(1, Math.round(len / 0.5));
  const N: Mat = 'navy_grey', S: Mat = 'steel_raw', p = (len - 0.03) / n, xi = (i: number) => -len / 2 + 0.015 + i * p, e = 0.015;
  const doorTop = h - 0.125, band = h - 0.12;
  const ajar = new Set((o.ajar ?? []).map(([s, i]) => `${s}${i}`)), mov = new Map((o.movable ?? []).map(([s, i, a]) => [`${s}${i}`, a ?? 0]));
  // shared shell: end panels (full depth), top, spine / back
  for (const s of [-1, 1]) b.bx(N, s < 0 ? -len / 2 : len / 2 - e, 0, -D / 2, s < 0 ? -len / 2 + e : len / 2, h, D / 2);
  b.bx(N, -len / 2 + e, h - 0.02, -D / 2, len / 2 - e, h, D / 2);
  if (sides === 2) b.bx(N, -len / 2 + e, 0, -0.01, len / 2 - e, h - 0.02, 0.01);
  else b.bx(N, -len / 2 + e, 0, -D / 2, len / 2 - e, h - 0.02, -D / 2 + e);
  const doors = new Map<string, LockerDoor>();
  const sideList: LockerSide[] = sides === 2 ? ['+z', '-z'] : ['+z'];
  const centres = new Map<string, THREE.Vector3>();
  for (const sd of sideList) {
    b.push(0, 0, 0, sd === '+z' ? 0 : PI);
    const zf = D / 2, zb = sides === 2 ? 0.01 : -D / 2 + e;
    b.bx(N, -len / 2 + e, 0, zb, len / 2 - e, 0.1, zf - 0.03); // plinth
    b.bx(N, -len / 2 + e, band, zb, len / 2 - e, h - 0.02, zf); // header band (numbers)
    for (let i = 1; i < n; i++) b.bx(N, xi(i) - 0.008, 0.1, zb, xi(i) + 0.008, band, zf - 0.02);
    const first = o.first?.[sd] ?? (sd === '+z' ? 1 : n + 1);
    for (let i = 0; i < n; i++) {
      const a = xi(i) + 0.004, w = p - 0.008, key = `${sd}${i}`, num = first + i;
      centres.set(key, b.world(a + w / 2, (0.1 + doorTop) / 2, zf));
      navySign(b, String(num), a + w / 2, band + 0.05, zf, 0.14, 0.07, '+z');
      const inside = ajar.has(key) || mov.has(key);
      if (inside) {
        b.bx(N, a + 0.004, h - 0.45, zb, a + w - 0.004, h - 0.435, zf - 0.03); // shelf
        b.detail(() => { b.rod(S, a + w / 2, h - 0.5, zb + 0.005, a + w / 2, h - 0.52, zb + 0.06, 0.006, 5); b.rod(S, a + 0.06, h - 0.58, zb + 0.08, a + w - 0.06, h - 0.58, zb + 0.08, 0.008, 6); });
      }
      if (mov.has(key)) {
        const part = part5(b, L, `${o.name ?? 'locker'}_${num}`, a, 0, zf - 0.01, (q) => lockerDoorGeo(q, N, w, 0.1, doorTop));
        const ld = lockerDoor(L, part, b.world(a + w / 2, h - 0.435, (zb + zf) / 2), centres.get(key)!, dirOf(b, 0, 0, 1));
        ld.set(mov.get(key)!);
        doors.set(key, ld);
      } else {
        const ang = ajar.has(key) ? o.ajarAngle ?? 0.35 : 0;
        b.push(a, 0, zf - 0.01, -ang);
        lockerDoorGeo(b, N, w, 0.1, doorTop);
        b.detail(() => b.bx(S, w / 2 - 0.06, 1.45, 0.01, w / 2 + 0.06, 1.52, 0.013)); // card holder
        const nm = o.names?.[key];
        if (nm) b.detail(() => b.sign(nm, 'label', w / 2, 1.485, 0.013, 0.11, 0.06, '+z'));
        b.pop();
      }
    }
    b.pop();
  }
  if (o.collide !== false) b.collide(-len / 2, 0, -D / 2, len / 2, h, D / 2, 'metal', true);
  return { doors, door: (s, i) => doors.get(`${s}${i}`), centre: (s, i) => centres.get(`${s}${i}`)!.clone(), pitch: p };
}
/** A locker door leaf in its hinge frame: x 0 … w, z −0.01 … +0.01 (outer face +0.01), stamped vents, a lever. */
function lockerDoorGeo(q: Builder, N: Mat, w: number, y0: number, y1: number) {
  q.bx(N, 0, y0, -0.01, w, y1, 0.01);
  q.detail(() => {
    for (const yb of [y1 - 0.32, y0 + 0.12]) for (let k = 0; k < 5; k++) q.bx(N, 0.1, yb + k * 0.035, 0.01, w - 0.1, yb + k * 0.035 + 0.012, 0.016);
    q.bx(N, w - 0.07, 0.95, 0.01, w - 0.045, 1.12, 0.04);
  });
}
function lockerDoor(L: LevelBuild, part: MovingPart5, shelf: THREE.Vector3, centre: THREE.Vector3, normal: THREE.Vector3): LockerDoor {
  let a = 0, base = 0, mode: 'idle' | 'rattle' | 'bang' = 'idle', t = 0, dur = 0, amp = 0, to = 1.95, from = 0;
  const apply = (x: number) => { a = x; part.pivot.rotation.y = -x; };
  const bangAt = (tt: number) => {
    if (tt < 0.16) return from + (to - from) * (tt / 0.16) * (tt / 0.16);
    const u = tt - 0.16;
    return to - 0.06 * (1 - Math.exp(-5 * u)) - 0.3 * Math.exp(-4.5 * u) * Math.abs(Math.sin((u * PI) / 0.2));
  };
  L.updaters.push((dt) => {
    if (mode === 'idle') return;
    t += dt;
    if (mode === 'rattle') {
      const env = smooth(t / 0.15) * smooth((dur - t) / 0.3);
      apply(base + amp * Math.abs(Math.sin(t * 2 * PI * 11)) * env * (0.7 + 0.3 * Math.sin(t * 17)));
    } else apply(bangAt(Math.min(t, dur)));
    if (t >= dur) { mode = 'idle'; if (dur > 0 && to) base = a; }
  });
  return {
    ...part, shelf, centre, normal,
    get angle() { return a; },
    set(x) { mode = 'idle'; base = x; apply(x); },
    rattle(d = 1.2, am = 0.045) { if (mode === 'bang') return 0; mode = 'rattle'; t = 0; dur = d; amp = am; return d; },
    bang(op = {}) { to = op.to ?? 1.95; from = a; mode = 'bang'; t = 0; dur = 1.25; return { dur, impact: 0.16 }; },
    at(tt) { mode = 'idle'; from = base; apply(bangAt(Math.max(0, Math.min(1.25, tt)))); },
    snap(open = true) { mode = 'idle'; base = open ? to - 0.06 : 0; apply(base); },
  };
}

/** Helmet geometry: rim centre at (0, y0, 0), crown up, front +z (NVG mount, chin strap). ~0.27 × 0.31 × 0.14. */
function helmetGeo(p: Builder, M: Mat, y0 = 0) {
  const prof: [number, number][] = [[0.0, 0.145], [0.06, 0.138], [0.1, 0.11], [0.128, 0.065], [0.138, 0.015], [0.142, 0.0], [0.13, 0.0], [0.126, 0.012], [0.117, 0.06], [0.09, 0.1], [0.05, 0.123], [0.0, 0.13]];
  p.push(0, y0, 0).pushScale(1, 1, 1.12);
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), 18);
  p.geo(M, g, 'box');
  p.pop();
  p.bx(M, -0.03, y0 + 0.07, 0.135, 0.03, y0 + 0.11, 0.16); // NVG shroud
  p.rod(M, -0.12, y0 + 0.02, 0.0, -0.06, y0 - 0.09, 0.05, 0.006, 4).rod(M, 0.12, y0 + 0.02, 0.0, 0.06, y0 - 0.09, 0.05, 0.006, 4);
  p.pop();
}

/** The helmet of `looseHelmet`. `fall(to)` drops it from the shelf, it hits the floor (`impact` s), rolls on its side to
 * `to` (world point on the floor, ≈ 2.5 m away — `mk5_helmet_rest`), wobbles and stops (`stop` = the rocking's end,
 * `dur` = all); returns those times (the vignette plays `helmet_roll` at `impact`). `at(t)` scrubs, `snap(to)` = at rest. */
export interface LooseHelmet { obj: THREE.Group; fall(to: THREE.Vector3): { dur: number; impact: number; stop: number }; at(t: number): void; snap(to?: THREE.Vector3): void }
/**
 * A loose navy helmet (the ready room's `v5_hull_groan`: it sits on the shelf of the scare locker and comes out when the
 * door bangs). Shelf prop: origin = the shelf top under the helmet (pass `LockerDoor.shelf`: `b.at(s.x, s.y, s.z, 0, …)`
 * with b at identity). Moving part only (no static geometry). Calls: 1 moving (helmet_navy). No collider (debris).
 */
export function looseHelmet(b: Builder, L: LevelBuild, o: { name?: string } = {}): LooseHelmet {
  const cy = 0.065; // centroid above the rim
  const part = part5(b, L, o.name ?? 'loose_helmet', 0, cy, 0, (p) => helmetGeo(p, 'helmet_navy', -cy));
  const obj = part.mount, piv = part.pivot;
  const S = obj.position.clone(), q0 = obj.quaternion.clone();
  let to = S.clone().setY(S.y - 1.5), dir = new THREE.Vector3(0, 0, 1), P1 = S.clone();
  const tFall = () => Math.sqrt((2 * Math.max(0.05, S.y - to.y - 0.1)) / 9.81);
  const ROLL = 1.55, WOB = 1.0;
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), qside = new THREE.Quaternion(), qdown = new THREE.Quaternion();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qT = new THREE.Quaternion(), qR = new THREE.Quaternion();
  /** tumbling out of the locker */
  const orientA = (t: number, out: THREE.Quaternion) => out.setFromAxisAngle(side, 7.5 * t).multiply(q0);
  /** on its side, rolling about its crown axis like a wheel (r 0.135), the axis wobbling while it is fast */
  const orientB = (u: number, out: THREE.Quaternion) => {
    const k = easeOut(u / ROLL), dist = P1.distanceTo(to) * k;
    out.setFromAxisAngle(side, -dist / 0.135);
    qT.setFromAxisAngle(dir, Math.sin(u * 9) * 0.25 * (1 - k));
    return out.multiply(qT).multiply(qside);
  };
  const pose = (t: number) => {
    const T = tFall();
    if (t <= T) {
      obj.position.set(S.x + dir.x * 1.1 * t, Math.max(to.y + 0.1, S.y - 4.905 * t * t), S.z + dir.z * 1.1 * t);
      obj.quaternion.copy(orientA(t, qA));
      return;
    }
    const u = t - T;
    if (u <= ROLL) {
      const k = easeOut(u / ROLL), hop = u < 0.22 ? Math.sin((u / 0.22) * PI) * 0.07 : 0;
      obj.position.set(lerp(P1.x, to.x, k), to.y + 0.135 + hop, lerp(P1.z, to.z, k));
      orientB(u, qB);
      obj.quaternion.copy(u < 0.14 ? orientA(T, qA).slerp(qB, smooth(u / 0.14)) : qB);
      return;
    }
    // settles crown-down and rocks on its dome
    const w = Math.min(WOB, u - ROLL), k = smooth(w / 0.3), rock = 0.35 * Math.exp(-4.2 * w) * Math.sin(w * 10);
    obj.position.set(to.x, to.y + lerp(0.135, 0.075, k) + Math.abs(rock) * 0.02, to.z);
    qR.setFromAxisAngle(side, rock).multiply(qdown);
    obj.quaternion.copy(orientB(ROLL, qB).slerp(qR, k));
  };
  let tt = 0, run = false;
  const total = () => tFall() + ROLL + WOB;
  L.updaters.push((dt) => { if (!run) return; tt = Math.min(total(), tt + dt); pose(tt); if (tt >= total()) run = false; });
  const aim = (target: THREE.Vector3) => {
    to = target.clone();
    dir = new THREE.Vector3(to.x - S.x, 0, to.z - S.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    side.crossVectors(up, dir).normalize();
    qside.setFromUnitVectors(up, side);
    qdown.setFromAxisAngle(dir, PI);
    const T = tFall();
    P1 = new THREE.Vector3(S.x + dir.x * 1.1 * T, to.y, S.z + dir.z * 1.1 * T);
  };
  aim(to);
  return {
    obj,
    fall(target) { aim(target); tt = 0; run = true; pose(0); const T = tFall(); return { dur: total(), impact: T, stop: T + ROLL + 0.6 }; },
    at(t) { run = false; tt = t; pose(Math.max(0, Math.min(total(), t))); },
    snap(target) { if (target) aim(target); run = false; tt = total(); pose(tt); },
  };
}

/**
 * Locker-room bench (§2.6 ready5: between the rows, h 0.45, walkable). Floor prop, origin = floor centre, `len` (2.0, x)
 * × `w` (0.35): a rubber-padded steel top on two pedestals with bolted foot plates. Calls: 2 (navy_grey + rubber).
 * Collider: footprint to `h` (walkable top).
 */
export function bench5(b: Builder, L: LevelBuild, o: { len?: number; w?: number; h?: number; collide?: boolean } = {}) {
  const len = o.len ?? 2.0, w = o.w ?? 0.35, h = o.h ?? 0.45, N: Mat = 'navy_grey';
  b.bx('rubber', -len / 2, h - 0.03, -w / 2, len / 2, h, w / 2);
  b.bx(N, -len / 2 + 0.02, h - 0.07, -w / 2 + 0.02, len / 2 - 0.02, h - 0.03, w / 2 - 0.02);
  for (const s of [-1, 1]) {
    const x = s * (len / 2 - 0.3);
    b.bx(N, x - 0.04, 0.012, -0.04, x + 0.04, h - 0.07, 0.04);
    b.bx(N, x - 0.12, 0, -w / 2 + 0.04, x + 0.12, 0.012, w / 2 - 0.04);
    b.detail(() => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(N, x + sx * 0.09, 0.016, sz * (w / 2 - 0.08), 0.012, 0.008, 'y', 6); });
  }
  if (o.collide !== false) b.collide(-len / 2, 0, -w / 2, len / 2, h, w / 2, 'metal', true);
}

/** One transport case: body x0…x1 / y0…y1 / z0…z1 (lid overhangs 1 cm, ribs and corner caps ≥ 1 cm proud). */
function transportCase(b: Builder, O: Mat, S: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, label: string | null, R: () => number) {
  const lid = Math.min(0.14, (y1 - y0) * 0.25), lx0 = x0 - 0.01, lx1 = x1 + 0.01, lz0 = z0 - 0.01, lz1 = z1 + 0.01;
  b.bx(O, x0, y0 + 0.03, z0, x1, y1 - lid, z1);
  b.bx(S, x0 + 0.03, y0, z0 + 0.03, x1 - 0.03, y0 + 0.03, z1 - 0.03); // skid rails (recessed)
  b.bx(O, lx0, y1 - lid, lz0, lx1, y1, lz1); // lid
  const wx = x1 - x0, wz = z1 - z0;
  b.detail(() => {
    // ribs (1 cm proud) round the body
    const ry = (y0 + 0.03 + y1 - lid) / 2;
    b.bx(O, x0 - 0.01, ry - 0.02, z0 - 0.01, x1 + 0.01, ry + 0.02, z1 + 0.01);
    // corner caps (steel): on the base 1.2 cm proud of the body, on the lid 1.2 cm proud of the lid
    for (const cx of [x0, x1]) for (const cz of [z0, z1]) for (const [yy, pr] of [[y0 + 0.03, 0.012], [y1 - 0.065, 0.022]] as const) {
      const sx = cx === x0 ? -1 : 1, sz = cz === z0 ? -1 : 1;
      b.bx(S, Math.min(cx - sx * 0.07, cx + sx * pr), yy, Math.min(cz - sz * 0.07, cz + sz * pr), Math.max(cx - sx * 0.07, cx + sx * pr), yy + 0.06, Math.max(cz - sz * 0.07, cz + sz * pr));
    }
    // latches on both long faces, handles at the ends
    const nl = wx > 0.9 ? 3 : 2;
    for (const sz of [-1, 1]) for (let i = 0; i < nl; i++) { const x = lerp(x0 + 0.18, x1 - 0.18, i / (nl - 1)); b.bx(S, x - 0.035, y1 - lid - 0.07, sz < 0 ? z0 - 0.018 : z1, x + 0.035, y1 - lid + 0.03, sz < 0 ? z0 : z1 + 0.018); }
    for (const sx of [-1, 1]) { const x = sx < 0 ? x0 - 0.03 : x1 + 0.03, yy = (y0 + y1 - lid) / 2 + 0.05; b.rod(S, x, yy, (z0 + z1) / 2 - 0.12, x, yy, (z0 + z1) / 2 + 0.12, 0.01, 6); }
  });
  if (label && wx > 0.5) navySign(b, label, (x0 + x1) / 2 + (R() - 0.5) * 0.1, (y0 + y1 - lid) / 2 - 0.1, z1 + 0.011, Math.min(0.8, wx * 0.6), 0.09, '+z');
  void wz;
}
/**
 * Stack of steel / composite transport cases filling a footprint exactly (sub bay CA 2.0 × 2.0 h 1.2, CB 1.2 × 2.0 h 1.2,
 * CC 2.0 × 2.0 h 1.2, CD 1.4 × 2.0 h 2.0; ready-room crates C1–C3 are `gearCrate`). Floor prop, origin = floor centre,
 * `w` (x) × `d` (z) × `h`: `layers` (round(h / 0.6)) layers, each tiled `cols` × `rows` (from the footprint), cases inset
 * 2 cm in their cells; the top layer's lids are exactly at `h` (honest cover: crouched eye 0.85 + helmet < 1.2).
 * Labels (atlas) on the +z faces. `palette` 'olive' | 'grey'. Calls: 2 (case paint + steel_raw) + atlas.
 * Collider: the footprint to `h` (`collide`).
 */
export function crateStack(b: Builder, L: LevelBuild, o: { w: number; d: number; h: number; layers?: number; cols?: number; rows?: number; seed?: number; label?: string; palette?: 'olive' | 'grey'; collide?: boolean }) {
  const { w, d, h } = o, R = srand(o.seed ?? 7), O: Mat = o.palette === 'grey' ? 'navy_grey' : olive(L), S: Mat = 'steel_raw';
  const layers = o.layers ?? Math.max(1, Math.round(h / 0.6)), cols = o.cols ?? Math.max(1, Math.round(w / 1.0)), rows = o.rows ?? Math.max(1, Math.round(d / 0.9));
  const labels = [o.label ?? 'POST 4 — STORES', 'MK 3 — 2개', '예비품 — SDV', '취급 주의', '해군 보급품 1167'];
  const lh = h / layers;
  for (let k = 0; k < layers; k++) {
    const top = k === layers - 1;
    const c = cols; // (every layer full: the top is flat at `h` everywhere — honest cover on every face)
    for (let i = 0; i < c; i++) for (let j = 0; j < rows; j++) {
      const cw = w / c, cd = d / rows;
      const x0 = -w / 2 + i * cw + 0.02, x1 = x0 + cw - 0.04, z0 = -d / 2 + j * cd + 0.02, z1 = z0 + cd - 0.04;
      const y0 = k * lh, y1 = (k + 1) * lh;
      const sh = top ? (R() - 0.5) * 0.02 : 0;
      transportCase(b, O, S, x0 + sh + 0.01, y0, z0 + 0.01, x1 + sh - 0.01, y1, z1 - 0.01, j === rows - 1 ? labels[(i + k * 2 + Math.floor(R() * 5)) % labels.length] : null, R);
    }
  }
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}
/**
 * Ready-room gear crate (§2.6 ready5 C1–C3: 1.2 × 0.8, h 1.2, low cover). Floor prop, origin = floor centre, `w` (1.2, x)
 * × `d` (0.8, z) × `h` (1.2): two stacked olive cases (lower 0.65), lids flush at `h`, stencils on +z. Calls: 2 + atlas.
 * Collider: footprint to `h`.
 */
export function gearCrate(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; label?: string; seed?: number; collide?: boolean } = {}) {
  crateStack(b, L, { w: o.w ?? 1.2, d: o.d ?? 0.8, h: o.h ?? 1.2, layers: 2, cols: 1, rows: 1, label: o.label ?? '상시 사용 — 랙 2', seed: o.seed ?? 3, collide: o.collide });
}

/**
 * Ready-room kit rack (§2.6 ready5: along the south wall x −11.8 … 3.8, z −37.8 … −37.2, h 2.2). Wall prop (back at z 0),
 * `len` (15.6) in bays of ≈ 1.2 m × `d` (0.6) × `h` (2.2): uprights, three shelves (0.12 / 0.92 boards, 2.15 top),
 * per bay (seeded): boots and kit bags on the bottom, packs and pouches on the middle, assault vests hanging from a rail
 * at 1.9 above the packs. Helmets for the top shelf: `helmetRow` at the returned `top` points.
 * Calls: 2 (navy_grey + webbing). Collider: footprint to `h`. Returns `top` = world centre of each bay's top shelf.
 */
export function kitRack(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; seed?: number; collide?: boolean } = {}): { top: THREE.Vector3[] } {
  const len = o.len ?? 15.6, d = o.d ?? 0.6, h = o.h ?? 2.2, N: Mat = 'navy_grey', W: Mat = 'webbing', R = srand(o.seed ?? 11);
  const nb = Math.max(1, Math.round(len / 1.2)), bw = len / nb, top: THREE.Vector3[] = [];
  for (let i = 0; i <= nb; i++) { const x = -len / 2 + i * bw; for (const z of [0.03, d - 0.03]) b.bx(N, Math.max(-len / 2, x - 0.025), 0, z - 0.025, Math.min(len / 2, x + 0.025), h, z + 0.025); }
  const shelves = [0.12, 0.92, 2.15];
  for (const y of shelves) b.bx(N, -len / 2 + 0.025, y - 0.025, 0.055, len / 2 - 0.025, y, d - 0.055);
  for (let i = 0; i < nb; i++) {
    const x0 = -len / 2 + i * bw + 0.05, x1 = x0 + bw - 0.1, cx = (x0 + x1) / 2;
    top.push(b.world(cx, 2.15, d / 2));
    // bottom: boots in pairs + a kit bag
    b.detail(() => {
      for (let k = 0; k < 2; k++) {
        const bx = x0 + 0.12 + k * 0.32 + R() * 0.04;
        for (const s of [-1, 1]) { b.bx(W, bx + s * 0.055 - 0.045, 0.12, d - 0.34, bx + s * 0.055 + 0.045, 0.24, d - 0.06); b.bx(W, bx + s * 0.055 - 0.045, 0.24, d - 0.34, bx + s * 0.055 + 0.045, 0.42, d - 0.24); }
      }
      if (R() < 0.8) b.rbox(W, x1 - 0.22, 0.12 + 0.16, d / 2, 0.38, 0.32, 0.42, 0, (R() - 0.5) * 0.2, 0);
    });
    // middle: packs
    const np = 1 + Math.floor(R() * 2);
    for (let k = 0; k < np; k++) { const px = lerp(x0 + 0.25, x1 - 0.25, np === 1 ? 0.5 : k); const ph = 0.24 + R() * 0.08; b.bx(W, px - 0.18, 0.92, 0.12, px + 0.18, 0.92 + ph, 0.42); b.detail(() => b.bx(W, px - 0.13, 0.98, 0.42, px + 0.13, 0.92 + ph - 0.06, 0.5)); }
    // vests on hooks from the rail
    b.bx(N, x0, 1.88, d - 0.1, x1, 1.91, d - 0.07);
    const nv = 1 + Math.floor(R() * 2.6);
    for (let k = 0; k < nv; k++) {
      const vx = lerp(x0 + 0.22, x1 - 0.22, nv === 1 ? 0.5 : k / (nv - 1));
      b.push(vx, 1.86, d - 0.12, (R() - 0.5) * 0.25);
      b.bx(W, -0.18, -0.55, -0.05, 0.18, -0.06, 0.05);
      b.detail(() => {
        for (const s of [-1, 1]) b.bx(W, s * 0.11 - 0.035, -0.06, -0.03, s * 0.11 + 0.035, 0.0, 0.03); // shoulder straps
        for (let m = 0; m < 3; m++) b.bx(W, -0.15 + m * 0.105, -0.5, 0.05, -0.15 + m * 0.105 + 0.085, -0.33, 0.1); // magazine pouches
        b.bx(W, -0.19, -0.58, -0.055, 0.19, -0.5, 0.055); // cummerbund
      });
      b.pop();
    }
  }
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
  return { top };
}

/**
 * A row of navy helmets on a shelf (kit rack top shelf, guard room). Shelf prop, origin = shelf top centre, `n` (3)
 * helmets at `pitch` (0.34) along x, seeded small yaw. Calls: 1 (helmet_navy).
 */
export function helmetRow(b: Builder, L: LevelBuild, o: { n?: number; pitch?: number; seed?: number } = {}) {
  const n = o.n ?? 3, p = o.pitch ?? 0.34, R = srand(o.seed ?? 5);
  for (let i = 0; i < n; i++) b.at(-((n - 1) * p) / 2 + i * p, 0, 0, (R() - 0.5) * 0.8, () => helmetGeo(b, 'helmet_navy'));
}

/**
 * Rubber floor mat (ready room `rubber_mat`), builder-frame box x0…x1 / z0…z1, 8 mm thick, polygon-offset (never
 * z-fights the deck). Calls: 1 (rubber_mat overlay). No collider.
 */
export function floorMat(b: Builder, L: LevelBuild, o: { x0: number; z0: number; x1: number; z1: number; y?: number }) {
  const y = o.y ?? 0;
  b.detail(() => b.bx(L.overlay('rubber_mat'), o.x0, y, o.z0, o.x1, y + 0.008, o.z1));
}

// ═════════════════════════════════════════════════════════════ SPINE / CRAWL

/**
 * Pipe riser (§2.6 spine5: R1–R7, 0.6 wide × 0.5 deep, full height, colliding — the spine's HIGH cover). Wall prop (back
 * at z 0 on the wall face), `w` (0.6, x) × `d` (0.5, z) × `h` (3.2, to the ceiling): two big service pipes (⌀ 0.30 /
 * 0.22) and two small ones rising through deck sleeves into the deckhead, flanged every 1.1 m, strapped to the hull by
 * steel brackets, a gate valve with a hand wheel (facing +z) on the 0.22 pipe at 1.2, a tag plate. Calls: 2 (pipe paint +
 * steel_raw) + atlas. Collider: the full box `w` × `d` × `h` (`collide`).
 */
export function pipeRiser(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; tag?: string; collide?: boolean } = {}) {
  const w = o.w ?? 0.6, d = o.d ?? 0.5, h = o.h ?? 3.2, P = pipePaint(L), S: Mat = 'steel_raw';
  const sx = w / 0.6, sz = d / 0.5;
  const pipes: [number, number, number][] = [[-0.12 * sx, 0.24 * sz, 0.15], [0.15 * sx, 0.2 * sz, 0.11], [0.22 * sx, 0.42 * sz, 0.045], [-0.24 * sx, 0.43 * sz, 0.04]];
  for (const [x, z, r] of pipes) {
    b.cyl(P, x, h / 2, z, r, h, 'y', r > 0.08 ? 18 : 10);
    b.cyl(S, x, 0.05, z, r + 0.04, 0.1, 'y', r > 0.08 ? 18 : 10); // deck sleeve
    if (r > 0.08) for (let y = 0.5; y < h - 0.3; y += 1.1) b.cyl(S, x, y, z, r + 0.035, 0.045, 'y', 18);
  }
  // brackets: a wall plate + a strap round each big pipe
  for (const y of [0.9, 2.3]) {
    b.bx(S, -w / 2 + 0.02, y - 0.04, 0, w / 2 - 0.02, y + 0.04, 0.012);
    for (const [x, z, r] of pipes.slice(0, 2)) { b.bx(S, x - 0.02, y - 0.03, 0.012, x + 0.02, y + 0.03, z - r); b.torus(S, x, y, z, r + 0.01, 0.012, 'y', 16); }
  }
  // gate valve + hand wheel on pipe 2
  const [vx, vz, vr] = pipes[1];
  b.cyl(S, vx, 1.2, vz, vr + 0.05, 0.16, 'y', 14);
  b.cyl(S, vx, 1.2, vz + vr + 0.08, 0.025, 0.18, 'z', 8);
  b.torus(S, vx, 1.2, vz + vr + 0.17, 0.11, 0.012, 'z', 18);
  b.detail(() => {
    for (let k = 0; k < 4; k++) { const a = (k / 4) * PI; b.rod(S, vx + Math.cos(a) * 0.11, 1.2 + Math.sin(a) * 0.11, vz + vr + 0.17, vx - Math.cos(a) * 0.11, 1.2 - Math.sin(a) * 0.11, vz + vr + 0.17, 0.007, 4); }
    b.bx(S, -0.1, 1.62, 0.43 * sz + 0.05, 0.08, 1.72, 0.43 * sz + 0.056);
  });
  navySign(b, o.tag ?? '소화 주관 ↑', -0.01, 1.67, 0.43 * sz + 0.056, 0.17, 0.08, '+z');
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
}

/**
 * Hull rib frame (§2.6 spine5: every 3 m from x 9.5, 0.12 proud, visual). Floor prop, origin = floor centre of the
 * corridor section; the rib spans local x (wall faces at ±`w`/2, default 3.6 = the spine's interior), thin along z
 * (ry π/2 for a corridor running along x): a T-section (12 mm web, 0.1 m face flange) up each wall from 0.3 to `h` −
 * 0.45, a knee haunch, and along the deckhead `h` (3.2). `legs` drops one wall's leg where a door or a riser stands
 * (`'both' | '+x' | '-x' | 'none'`). Calls: 1 (navy_grey). No collider.
 */
export function hullRib(b: Builder, L: LevelBuild, o: { w?: number; h?: number; depth?: number; legs?: 'both' | '+x' | '-x' | 'none' } = {}) {
  const w = o.w ?? 3.6, h = o.h ?? 3.2, dp = o.depth ?? 0.12, N: Mat = 'navy_grey', legs = o.legs ?? 'both', kn = 0.42, wallH = h - kn;
  const web = 0.006, fl = 0.05, ft = 0.012;
  for (const s of [-1, 1]) {
    const has = legs === 'both' || (s < 0 ? legs === '-x' : legs === '+x');
    const xw = s * w / 2, xi = xw - s * dp;
    if (has) {
      b.bx(N, Math.min(xw, xi), 0.3, -web, Math.max(xw, xi), wallH, web);
      b.bx(N, Math.min(xi, xi - s * ft), 0.3, -fl, Math.max(xi, xi - s * ft), wallH, fl);
    }
    // knee haunch from the leg top to the deckhead, `kn` in from the wall
    const ax = xi - s * ft / 2, ay = wallH, bx = xw - s * (kn + 0.1), by = h - dp, len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
    b.rbox(N, (ax + bx) / 2, (ay + by) / 2, 0, len, ft, fl * 2, 0, 0, ang);
    b.push(xw, h, 0);
    b.bx(N, Math.min(0, -s * (kn + 0.1)), -dp, -web, Math.max(0, -s * (kn + 0.1)), 0, web);
    b.pop();
  }
  b.bx(N, -w / 2 + kn + 0.1, h - dp, -web, w / 2 - kn - 0.1, h, web);
  b.bx(N, -w / 2 + kn + 0.08, h - dp - ft, -fl, w / 2 - kn - 0.08, h - dp, fl);
}

/**
 * Bar grating panel (crawl strip over the crawlway x 16.4 … 36.2, z −16.6 … −15.4; galleries; landings) in the BUILDER's
 * frame: x0…x1 / z0…z1, top at `y` (0, flush with the deck), `depth` (0.03 = the 30 mm bearing bars): two `deck_grate`
 * layers (top and bottom of the bars — the 3 cm parallax reads as real bar depth from above and from the crawl), an
 * angle-iron frame (`frameMat`, steel_raw) on the `frame` edges (default all four), its top 1 cm proud and 3 cm over the deck round the edge.
 * Calls: 2 (deck_grate + steel_raw). Collider: the solid slab `y − depth … y` (D20: bullets, sight and nav stop at it).
 */
export function grating(b: Builder, L: LevelBuild, o: { x0: number; z0: number; x1: number; z1: number; y?: number; depth?: number; frame?: WallFace[]; frameMat?: Mat; collide?: boolean }) {
  const { x0, z0, x1, z1 } = o, y = o.y ?? 0, dp = o.depth ?? 0.03, G: Mat = 'deck_grate', S: Mat = o.frameMat ?? 'steel_raw';
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wx = Math.abs(x1 - x0), wz = Math.abs(z1 - z0);
  b.solid(() => { b.quad(G, cx, y, cz, wx, wz, '+y', 0, 'box'); b.quad(G, cx, y - dp, cz, wx, wz, '+y', 0, 'box'); });
  for (const f of o.frame ?? ['+x', '-x', '+z', '-z']) {
    if (f === '+z' || f === '-z') { const z = f === '+z' ? Math.max(z0, z1) : Math.min(z0, z1), s = f === '+z' ? 1 : -1; b.bx(S, Math.min(x0, x1) - 0.03, y - dp - 0.01, Math.min(z - s * 0.02, z + s * 0.03), Math.max(x0, x1) + 0.03, y + 0.01, Math.max(z - s * 0.02, z + s * 0.03)); }
    else { const x = f === '+x' ? Math.max(x0, x1) : Math.min(x0, x1), s = f === '+x' ? 1 : -1; b.bx(S, Math.min(x - s * 0.02, x + s * 0.03), y - dp - 0.01, Math.min(z0, z1), Math.max(x - s * 0.02, x + s * 0.03), y + 0.01, Math.max(z0, z1)); }
  }
  if (o.collide !== false) b.collide(Math.min(x0, x1), y - dp, Math.min(z0, z1), Math.max(x0, x1), y, Math.max(z0, z1), 'metal', true);
}

/**
 * Handrail along a polyline (hatch-pit rails 1.0, gallery rails 1.1, the magazine hatch rail) in the BUILDER's frame:
 * `pts` [x, z][] at floor `y`, posts at every vertex and every ≤ 1.5 m, a ⌀ 48 mm top rail at `h` (1.0), a mid rail,
 * an optional 0.1 m toe board (`toe`). Calls: 1 (`mat`, painted_yellow). Collider: a 6 cm box to `h` per AXIS-ALIGNED
 * segment (`collide`; diagonal segments get none).
 */
export function rail(b: Builder, L: LevelBuild, o: { pts: [number, number][]; y?: number; h?: number; toe?: boolean; mat?: Mat; collide?: boolean }) {
  const y = o.y ?? 0, h = o.h ?? 1.0, M = o.mat ?? 'painted_yellow', pts = o.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.02) continue;
    const n = Math.max(1, Math.ceil(len / 1.5));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) { const t = k / n, px = lerp(ax, bx, t), pz = lerp(az, bz, t); b.cyl(M, px, y + h / 2, pz, 0.022, h, 'y', 8); }
    b.rod(M, ax, y + h, az, bx, y + h, bz, 0.024, 8);
    b.rod(M, ax, y + h * 0.5, az, bx, y + h * 0.5, bz, 0.016, 6);
    if (o.toe) {
      b.push((ax + bx) / 2, y, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
      b.bx(M, -0.004, 0.012, -len / 2, 0.004, 0.11, len / 2);
      b.pop();
    }
    if (o.collide !== false && (Math.abs(ax - bx) < 1e-3 || Math.abs(az - bz) < 1e-3)) b.collide(Math.min(ax, bx) - 0.03, y, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, y + h, Math.max(az, bz) + 0.03, 'metal', true);
  }
  for (const [px, pz] of [pts[0], pts[pts.length - 1]]) b.sphere(M, px, y + h, pz, 0.03, 8);
}

/**
 * Fire-hose box (spine). Wall prop, origin = the box's centre on the wall face: a red steel box 0.7 × 0.8 × 0.25 with a
 * door, a wired-glass window (dark) showing the coiled hose, a pull handle, `소화 호스 4` stencil. Calls: 2 (fire red +
 * painted_dark) + atlas. Collider: the box (`collide`).
 */
export function fireHoseBox(b: Builder, L: LevelBuild, o: { label?: string; collide?: boolean } = {}) {
  const F = fireRed(L), K: Mat = 'painted_dark', w = 0.7, h = 0.8, d = 0.25;
  b.bx(F, -w / 2, -h / 2, 0, w / 2, h / 2, d - 0.02);
  b.bx(F, -w / 2 + 0.01, -h / 2 + 0.01, d - 0.02, w / 2 - 0.01, h / 2 - 0.01, d); // door
  b.bx(K, -0.2, -0.05, d, 0.2, 0.3, d + 0.01); // window
  b.detail(() => {
    b.torus(F, 0, 0.12, d + 0.002, 0.13, 0.03, 'z', 16); // hose coil seen through
    b.bx(K, w / 2 - 0.08, -0.2, d, w / 2 - 0.05, 0.0, d + 0.03);
  });
  navySign(b, o.label ?? '소화 호스 4', 0, -0.25, d + 0.001, 0.4, 0.1, '+z');
  if (o.collide !== false) b.collide(-w / 2, -h / 2, 0, w / 2, h / 2, d + 0.03, 'metal', true);
}

/**
 * Pipe bundle along a wall (crawlway side walls, spine pipe runs, tunnel). Wall prop, origin on the wall face; runs along
 * local x from −len/2 to len/2. `pipes` = [radius, height y, offset from the wall z][] (default three, low: the crawl's
 * 1.2 m width keeps ≥ 0.96 m clear between two bundles), steel straps every 1.2 m, flanges every 3 m. `mat` ('copper' or
 * pipe paint). Calls: 2 (`mat` + steel_raw). No collider (dressing; keep it out of a walkway or add your own).
 */
export function pipeBundle(b: Builder, L: LevelBuild, o: { len: number; pipes?: [number, number, number][]; mat?: Mat }) {
  const len = o.len, M = o.mat ?? pipePaint(L), S: Mat = 'steel_raw';
  const pipes = o.pipes ?? [[0.045, 0.35, 0.07], [0.03, 0.5, 0.05], [0.055, 0.66, 0.075]];
  for (const [r, y, z] of pipes) b.cyl(M, 0, y, z, r, len, 'x', r > 0.04 ? 12 : 8);
  for (let x = -len / 2 + 0.3; x < len / 2 - 0.1; x += 1.2) {
    const ys = pipes.map((p) => p[1]), y0 = Math.min(...ys) - 0.08, y1 = Math.max(...ys) + 0.08;
    b.bx(S, x - 0.02, y0, 0, x + 0.02, y1, 0.012);
    for (const [r, y, z] of pipes) b.bx(S, x - 0.015, y - 0.008, 0.012, x + 0.015, y + 0.008, z + r + 0.01);
  }
  b.detail(() => { for (let x = -len / 2 + 1.5; x < len / 2 - 0.5; x += 3) for (const [r, y, z] of pipes) b.cyl(S, x, y, z, r + 0.02, 0.03, 'x', r > 0.04 ? 12 : 8); });
}

/**
 * Steel joists under the spine grating (the crawlway's deckhead). Ceiling prop, origin = the centre of the grating's
 * UNDERSIDE (y −0.03 for the plan's strip); `len` along x, the joists span `w` (1.2) along z every `every` (0.6), I-section
 * `depth` (0.12) down from the origin (crawl clear stays 1.35 − 0.15 = 1.2 > the crouched 1.1). Calls: 1 (steel_raw).
 * No collider (above a crouched head).
 */
export function crawlJoists(b: Builder, L: LevelBuild, o: { len: number; w?: number; depth?: number; every?: number }) {
  const len = o.len, w = o.w ?? 1.2, dp = o.depth ?? 0.12, ev = o.every ?? 0.6, S: Mat = 'steel_raw';
  for (let x = -len / 2 + ev / 2; x < len / 2; x += ev) {
    b.bx(S, x - 0.03, -0.008, -w / 2, x + 0.03, 0, w / 2);
    b.bx(S, x - 0.004, -dp + 0.008, -w / 2, x + 0.004, -0.008, w / 2);
    b.bx(S, x - 0.03, -dp, -w / 2, x + 0.03, -dp + 0.008, w / 2);
  }
  // edge angles along both sides
  for (const s of [-1, 1]) b.bx(S, -len / 2, -0.05, s * w / 2 - (s > 0 ? 0.04 : 0), len / 2, -0.008, s * w / 2 + (s < 0 ? 0.04 : 0));
}

// ═════════════════════════════════════════════════════════════ MAGAZINE

/**
 * Steel rack of ammunition tins (§2.6 magazine: west rack x 14.4 … 15.4, z −27.4 … −22.4; east rack x 18.6 … 19.6, z −26.2
 * … −22.4; h 2.0; **per-shelf colliders with an open front**). Floor prop, origin = floor centre, `len` (x) × `depth`
 * (1.0, z) × `h` (2.0), OPEN FRONT = +z (west rack ry π/2 → faces +x; east rack ry −π/2). Uprights every ≤ 1.25 m, a
 * mesh-less steel back, shelf decks at `shelves` (0.08, 0.6, 1.12, 1.64, top 1.98), tins (0.29 × 0.19 × 0.155, stacked
 * ≤ 2) set back 0.12 from the front edge, some stencilled. Colliders: each deck (3 cm), the back, the uprights, and each
 * shelf's tin block set back 0.12 — the front strip of every shelf is open (pickups at the rack face have a clear ray).
 * Returns `shelves` (world y of each deck top) and `front(i, u)` = world point on deck i's front edge at local x `u`.
 * Calls: 2 (steel_raw + olive) + atlas.
 */
export function ammoTinRack(b: Builder, L: LevelBuild, o: { len: number; depth?: number; h?: number; shelves?: number[]; fill?: number; seed?: number; collide?: boolean }): { shelves: number[]; front(i: number, u: number): THREE.Vector3 } {
  const len = o.len, dd = o.depth ?? 1.0, h = o.h ?? 2.0, S: Mat = 'steel_raw', O = olive(L), R = srand(o.seed ?? 21), fill = o.fill ?? 0.85;
  const decks = o.shelves ?? [0.08, 0.6, 1.12, 1.64, h - 0.02];
  const nb = Math.max(1, Math.ceil(len / 1.25)), bw = len / nb, zf = dd / 2, zb = -dd / 2;
  for (let i = 0; i <= nb; i++) { const x = Math.min(len / 2 - 0.025, Math.max(-len / 2 + 0.025, -len / 2 + i * bw)); for (const z of [zb + 0.035, zf - 0.025]) b.bx(S, x - 0.025, 0, z - 0.025, x + 0.025, h, z + 0.025); }
  b.bx(S, -len / 2 + 0.05, 0.02, zb, len / 2 - 0.05, h - 0.02, zb + 0.008);
  for (const y of decks) {
    b.bx(S, -len / 2 + 0.05, y - 0.03, zb + 0.06, len / 2 - 0.05, y, zf - 0.05);
    b.bx(S, -len / 2 + 0.05, y - 0.06, zf - 0.05, len / 2 - 0.05, y, zf - 0.035); // front beam lip
  }
  const tw = 0.29, td = 0.19, th = 0.155;
  for (let s = 0; s < decks.length - 1; s++) {
    const y = decks[s], gap = decks[s + 1] - 0.03 - y, tiers = gap > 2 * (th + 0.02) + 0.04 ? 2 : 1;
    for (let bi = 0; bi < nb; bi++) {
      const x0 = -len / 2 + bi * bw + 0.06, n = Math.floor((bw - 0.1) / (tw + 0.02));
      for (let k = 0; k < n; k++) for (let row = 0; row < 3; row++) for (let tier = 0; tier < tiers; tier++) {
        if (R() > fill) continue;
        const cx = x0 + (k + 0.5) * (tw + 0.02) + (R() - 0.5) * 0.01, cz = zf - 0.12 - td / 2 - row * (td + 0.03), cy = y + tier * (th + 0.022);
        b.bx(O, cx - tw / 2, cy, cz - td / 2, cx + tw / 2, cy + th, cz + td / 2);
        b.bx(O, cx - tw / 2 - 0.004, cy + th, cz - td / 2 - 0.004, cx + tw / 2 + 0.004, cy + th + 0.018, cz + td / 2 + 0.004);
        b.detail(() => { b.bx(S, cx + tw / 2 + 0.004, cy + th - 0.05, cz - 0.03, cx + tw / 2 + 0.012, cy + th + 0.018, cz + 0.03); b.rod(S, cx - 0.06, cy + th + 0.026, cz, cx + 0.06, cy + th + 0.026, cz, 0.006, 4); });
        if (row === 0 && R() < 0.5) navySign(b, R() < 0.5 ? '5.56 — 840' : '9 MM — 1000', cx, cy + th * 0.5, cz + td / 2 + 0.002, 0.22, 0.05, '+z');
      }
      if (o.collide !== false) b.collide(x0 - 0.02, y, zb + 0.06, x0 + bw - 0.08, y + tiers * (th + 0.022) - 0.004, zf - 0.12, 'metal', true);
    }
  }
  if (o.collide !== false) {
    for (const y of decks) b.collide(-len / 2, y - 0.06, zb, len / 2, y, zf, 'metal', true);
    b.collide(-len / 2, 0, zb, len / 2, h, zb + 0.06, 'metal', true);
    for (let i = 0; i <= nb; i++) { const x = Math.min(len / 2 - 0.025, Math.max(-len / 2 + 0.025, -len / 2 + i * bw)); b.collide(x - 0.025, 0, zf - 0.05, x + 0.025, h, zf, 'metal', true); }
  }
  return { shelves: decks.map((y) => b.world(0, y, 0).y), front: (i, u) => b.world(u, decks[Math.max(0, Math.min(decks.length - 1, i))], zf - 0.04) };
}

/** A bulkhead lamp. `pop()` (breakable only) = surge, two stutters, the globe bursts (`out` s: play `bulb_pop`) and the
 * shards fall (`tinkle` s: `glass_tinkle`); `at(t)` scrubs; `snap(dead)` = dead (globe gone, shards on the floor, light
 * off) or whole and lit. `lens` = its lens material (shared for non-breakable lamps); `point` = the globe centre (world)
 * for the vignette's `fx.bulbPop(point)` at `out`. The lamp plays NO sound and NO fx: `v5_magazine` owns `bulb_pop`,
 * `glass_tinkle` and the fx flash (one owner, §8.11). */
export interface BulkheadLamp { lens: THREE.MeshStandardMaterial; point: THREE.Vector3; readonly dead: boolean; pop(): { dur: number; out: number; tinkle: number }; at(t: number): void; snap(dead?: boolean): void }
/**
 * Caged bulkhead lamp (emergency fittings with red lenses; the magazine's caged emergency lamp that POPS for
 * `v5_magazine`). Wall prop (origin on the wall face, lamp axis +z) or `mount: 'ceiling'` (origin on the ceiling, axis
 * −y): cast base, a glass globe (⌀ 0.13) in a 4-bar wire cage, a junction box and conduit. `color` ('white') and
 * `intensity` (0.35) set the lens. Non-breakable: the lens is the shared `lampLens5(color, intensity)` (bind it to the
 * light yourself). `breakable: true`: the globe is a moving part with its own lens; pass the room light as `bind` and the
 * pop drives it (surge → stutter → off; `enabled = false` at the end); `floorY` = world y where the shards land.
 * Calls: 1 static (navy_grey) + 1 lens; breakable: + the broken rim and the shards (both drawn only after the pop, when the globe is gone).
 */
export function bulkheadLamp(b: Builder, L: LevelBuild, o: { color?: LampColor; intensity?: number; mount?: 'wall' | 'ceiling'; caged?: boolean; breakable?: boolean; bind?: LightHandle; floorY?: number; name?: string } = {}): BulkheadLamp {
  const N: Mat = 'navy_grey', I = o.intensity ?? 0.35, color = o.color ?? 'white', ceil = o.mount === 'ceiling';
  b.push(0, 0, 0, 0, ceil ? PI / 2 : 0, 0);
  b.cyl(N, 0, 0, 0.015, 0.1, 0.03, 'z', 16);
  b.cyl(N, 0, 0, 0.05, 0.085, 0.04, 'z', 16);
  if (!ceil) { b.bx(N, -0.05, 0.12, 0, 0.05, 0.22, 0.06); b.rod(N, 0, 0.22, 0.03, 0, 0.5, 0.03, 0.012, 6); b.rod(N, 0, 0.07, 0.03, 0, 0.12, 0.03, 0.01, 6); }
  else { b.bx(N, 0.12, -0.05, 0, 0.22, 0.05, 0.06); b.rod(N, 0.22, 0, 0.03, 0.5, 0, 0.03, 0.012, 6); }
  if (o.caged !== false) b.detail(() => {
    b.torus(N, 0, 0, 0.075, 0.08, 0.005, 'z', 16);
    b.torus(N, 0, 0, 0.2, 0.025, 0.005, 'z', 10);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * 2 * PI + PI / 4, c = Math.cos(a), s = Math.sin(a);
      b.rod(N, c * 0.08, s * 0.08, 0.075, c * 0.085, s * 0.085, 0.135, 0.005, 4);
      b.rod(N, c * 0.085, s * 0.085, 0.135, c * 0.025, s * 0.025, 0.2, 0.005, 4);
    }
  });
  const gz = 0.125;
  if (!o.breakable) {
    const lens = lampLens5(L, color, I);
    b.detail(() => b.sphere(lens, 0, 0, gz, 0.064, 12, 1, 1, 1.15));
    const point = b.world(0, 0, gz);
    b.pop();
    return { lens, point, dead: false, pop: () => ({ dur: 0, out: 0, tinkle: 0 }), at() {}, snap() {} };
  }
  // breakable: globe (own lens) + broken rim as a moving part; shards as an instanced mesh
  const lens = newLens(L, color, I);
  lens.name = `${o.name ?? 'lamp5'}_lens`;
  const shardMat = mat4(L, 'k5_shard', () => L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: 0xcfe2de, roughness: 0.08, metalness: 0.35 }));
  const part = part5(b, L, o.name ?? 'lamp5_globe', 0, 0, gz, (p) => {
    p.sphere(lens, 0, 0, 0, 0.064, 12, 1, 1, 1.15);
    // jagged rim left in the base when it bursts
    for (let k = 0; k < 9; k++) { const a = (k / 9) * 2 * PI; p.rbox(shardMat, Math.cos(a) * 0.058, Math.sin(a) * 0.058, -0.045, 0.035, 0.006, 0.02 + (k % 3) * 0.012, 0, 0, a + PI / 2); }
  });
  const meshes: THREE.Mesh[] = [];
  part.pivot.traverse((x) => { if ((x as THREE.Mesh).isMesh) meshes.push(x as THREE.Mesh); });
  const globe = meshes.filter((m) => m.material === lens), rim = meshes.filter((m) => m.material === shardMat);
  const origin = b.world(0, 0, gz), axis = dirOf(b, 0, 0, 1);
  b.pop();
  const floorY = o.floorY ?? origin.y - (ceil ? 2.4 : 1.8);
  const NS = 12, R = srand(31);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.02, 0.016, 0, 0.012, -0.014, 0, 0.014, 0, 0.003, -0.02, -0.014, 0.003, 0.014, 0.016, 0.003, 0.012], 3));
  sg.setIndex([0, 1, 2, 3, 4, 5, 0, 3, 5, 0, 5, 1, 1, 5, 4, 1, 4, 2, 2, 4, 3, 2, 3, 0]);
  sg.computeVertexNormals();
  const shards = new THREE.InstancedMesh(sg, shardMat, NS);
  shards.name = `${o.name ?? 'lamp5'}_shards`;
  shards.frustumCulled = false;
  shards.userData.rooms = b.rooms.slice();
  shards.visible = false;
  L.root.add(shards);
  const tr = Array.from({ length: NS }, () => {
    const out = axis.clone().multiplyScalar(0.4 + R() * 0.9).add(new THREE.Vector3((R() - 0.5) * 1.4, R() * 0.8, (R() - 0.5) * 1.4));
    return { v: out, spin: new THREE.Vector3(R() * 20, R() * 20, R() * 20), s: 0.6 + R() * 0.9, yaw: R() * 2 * PI };
  });
  const T_OUT = 0.15, DUR = 1.6, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  let dead = false;
  const lightK = (t: number) => (t < 0.05 ? 1.8 : t < 0.11 ? 0 : t < T_OUT ? 0.6 : 0);
  const pose = (t: number) => {
    const k = lightK(t);
    lens.emissiveIntensity = I * k;
    if (o.bind) { o.bind.intensityScale = k; o.bind.enabled = t < T_OUT + 0.3 || k > 0; }
    const broken = t >= T_OUT;
    for (const m of globe) m.visible = !broken;
    for (const m of rim) m.visible = broken;
    shards.visible = broken;
    dead = broken;
    if (!broken) return;
    const u = t - T_OUT;
    tr.forEach((s, i) => {
      // ballistic to the floor, one small bounce, then lying flat
      const tHit = (s.v.y + Math.sqrt(s.v.y * s.v.y + 2 * 9.81 * Math.max(0.01, origin.y - floorY))) / 9.81;
      let x: number, y: number, z: number, lying = 0;
      if (u < tHit) { x = origin.x + s.v.x * u; z = origin.z + s.v.z * u; y = origin.y + s.v.y * u - 4.905 * u * u; }
      else {
        const w = u - tHit, hx = origin.x + s.v.x * tHit, hz = origin.z + s.v.z * tHit, sk = 0.15 * (1 - Math.exp(-6 * w));
        x = hx + s.v.x * sk; z = hz + s.v.z * sk; y = floorY + 0.002 + Math.max(0, Math.sin(Math.min(1, w / 0.12) * PI) * 0.03 * Math.exp(-w * 2));
        lying = smooth(w / 0.15);
      }
      const ru = Math.min(u, tHit);
      _e.set(s.spin.x * ru * (1 - lying), s.yaw + s.spin.y * ru, s.spin.z * ru * (1 - lying));
      _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s.setScalar(s.s));
      shards.setMatrixAt(i, _m);
    });
    shards.instanceMatrix.needsUpdate = true;
  };
  const tl = timeline(L, DUR, pose);
  return {
    lens, point: origin.clone(), get dead() { return dead; },
    pop() { tl.play(0); return { dur: DUR, out: T_OUT, tinkle: T_OUT + 0.45 }; },
    at(t) { tl.at(t); },
    snap(d = true) {
      if (d) { tl.at(DUR); if (o.bind) { o.bind.intensityScale = 0; o.bind.enabled = false; } }
      else { tl.at(0); lens.emissiveIntensity = I; for (const m of globe) m.visible = true; for (const m of rim) m.visible = false; shards.visible = false; dead = false; if (o.bind) { o.bind.intensityScale = 1; o.bind.enabled = true; } }
    },
  };
}

/**
 * Fire-party board (magazine). Wall prop, origin = board centre on the wall face, 1.2 × 0.9: a steel board with a red
 * border, a fire axe, a hook spanner, an extinguisher on its bracket below, a breathing-set bag, `화재반 — 탄약고`.
 * Calls: 2 (fire red + steel_raw) + atlas.
 */
export function fireBoard(b: Builder, L: LevelBuild, o: { label?: string } = {}) {
  const F = fireRed(L), S: Mat = 'steel_raw', w = 1.2, h = 0.9;
  b.bx(S, -w / 2, -h / 2, 0, w / 2, h / 2, 0.012);
  for (const s of [-1, 1]) { b.bx(F, -w / 2 - 0.03, s > 0 ? h / 2 : -h / 2 - 0.03, 0, w / 2 + 0.03, s > 0 ? h / 2 + 0.03 : -h / 2, 0.022); b.bx(F, s > 0 ? w / 2 : -w / 2 - 0.03, -h / 2, 0, s > 0 ? w / 2 + 0.03 : -w / 2, h / 2, 0.022); }
  // axe: haft + head
  b.rbox(F, -0.35, 0.0, 0.04, 0.035, 0.7, 0.025, 0, 0, 0.15);
  b.rbox(S, -0.41, 0.33, 0.04, 0.18, 0.08, 0.012, 0, 0, 0.15);
  // hook spanner, breathing-set bag
  b.rod(S, 0.0, -0.3, 0.03, 0.0, 0.25, 0.03, 0.012, 6); b.torus(S, 0.0, 0.29, 0.03, 0.04, 0.01, 'z', 10);
  b.bx(F, 0.2, -0.3, 0.012, 0.5, 0.12, 0.13);
  // extinguisher below on a bracket
  b.cyl(F, 0.35, -0.8, 0.1, 0.075, 0.5, 'y', 14); b.sphere(F, 0.35, -0.55, 0.1, 0.075, 12, 0.6);
  b.cyl(S, 0.35, -0.48, 0.1, 0.02, 0.06, 'y', 8); b.bx(S, 0.3, -0.75, 0, 0.4, -0.7, 0.04);
  navySign(b, o.label ?? '화재반 — 탄약고', 0, h / 2 - 0.08, 0.013, 0.8, 0.09, '+z');
}

// ═════════════════════════════════════════════════════════════ ARMOURY

/**
 * Armoury cage rack (§2.6 arm5: west wall, "19 gaps of 23"). Wall prop (back at z 0), `slots` (23) at `pitch` (0.12)
 * → len = slots·pitch + 0.16 (2.92): back panel, side posts, butt tray with a cup per slot, a padded barrel rail with
 * clips at 1.25, a header; carbines (gunmetal, standing butt-down) in `filled` slots (default 4, seeded), the rest empty;
 * a pair of WELDED-MESH doors (50 mm wire grid, real rods: reads as mesh, not bar grating) hinged at the outer posts and
 * standing open by `open` (1.9 rad), a cut padlock hanging on the right leaf. Slot centres (z 0.18) are returned in
 * world space at the barrel-clip height (1.25; put `p5_arm_carbine` in an EMPTY slot's point — (14.45, 1.3, −20.6) is
 * one with the rack along the west wall). Calls: 2 (navy_grey + gunmetal). Collider: back, posts, header, butt tray (to
 * 0.28); the slot space and the open leaves are free.
 */
export function cageRack(b: Builder, L: LevelBuild, o: { slots?: number; pitch?: number; filled?: number[]; open?: number; h?: number; seed?: number; collide?: boolean } = {}): { slots: THREE.Vector3[]; len: number } {
  const n = o.slots ?? 23, p = o.pitch ?? 0.12, len = n * p + 0.16, h = o.h ?? 2.1, d = 0.32, N: Mat = 'navy_grey', G: Mat = 'gunmetal', R = srand(o.seed ?? 23);
  const filled = new Set(o.filled ?? [3, 4, 11, 19]);
  b.bx(N, -len / 2, 0, 0, len / 2, h, 0.012);
  for (const s of [-1, 1]) b.bx(N, s < 0 ? -len / 2 : len / 2 - 0.06, 0, 0.012, s < 0 ? -len / 2 + 0.06 : len / 2, h, d);
  b.bx(N, -len / 2 + 0.06, h - 0.16, 0.012, len / 2 - 0.06, h, d); // header
  b.bx(N, -len / 2 + 0.06, 0, 0.012, len / 2 - 0.06, 0.2, d); // butt tray
  b.bx(N, -len / 2 + 0.06, 1.2, 0.26, len / 2 - 0.06, 1.24, d - 0.02); // barrel rail
  b.bx(N, -len / 2 + 0.06, 1.24, 0.27, len / 2 - 0.06, 1.25, d - 0.03);
  const slots: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.08 + (i + 0.5) * p;
    slots.push(b.world(x, 1.25, 0.18));
    b.detail(() => {
      b.bx(N, x - 0.035, 0.2, 0.1, x + 0.035, 0.24, 0.26); // cup
      for (const s of [-1, 1]) b.bx(N, x + s * 0.035 - 0.004, 1.2, d - 0.04, x + s * 0.035 + 0.004, 1.3, d - 0.02); // clip
    });
    if (filled.has(i)) {
      // carbine: stock in the cup, receiver, magazine, handguard, barrel, sling
      b.push(x, 0.2, 0.18, (R() - 0.5) * 0.1);
      b.bx(G, -0.02, 0.02, -0.07, 0.02, 0.3, 0.05);
      b.bx(G, -0.025, 0.3, -0.05, 0.025, 0.58, 0.04);
      b.rbox(G, 0, 0.47, 0.08, 0.03, 0.2, 0.06, 0.25, 0, 0);
      b.bx(G, -0.022, 0.58, -0.035, 0.022, 0.92, 0.035);
      b.cyl(G, 0, 1.0, 0, 0.009, 0.18, 'y', 6);
      b.bx(G, -0.018, 0.48, -0.06, 0.018, 0.56, -0.03);
      b.detail(() => b.rod(N, 0.0, 0.12, -0.075, 0.0, 0.85, -0.045, 0.008, 4));
      b.pop();
    }
  }
  // mesh doors
  const lw = len / 2 - 0.02, ang = o.open ?? 1.9, y0 = 0.22, y1 = h - 0.18;
  for (const s of [-1, 1]) {
    b.push(s * (len / 2 - 0.01), 0, d + 0.01, s < 0 ? -ang : ang);
    const xa = s < 0 ? 0 : -lw, xb = s < 0 ? lw : 0;
    b.bx(N, xa, y0, -0.012, xb, y0 + 0.03, 0.012).bx(N, xa, y1 - 0.03, -0.012, xb, y1, 0.012);
    b.bx(N, xa, y0, -0.012, xa + 0.03, y1, 0.012).bx(N, xb - 0.03, y0, -0.012, xb, y1, 0.012);
    b.detail(() => {
      for (let x = xa + 0.05; x < xb - 0.03; x += 0.05) b.bx(N, x - 0.002, y0 + 0.03, -0.002, x + 0.002, y1 - 0.03, 0.002);
      for (let y = y0 + 0.08; y < y1 - 0.03; y += 0.05) b.bx(N, xa + 0.03, y - 0.002, 0.002, xb - 0.03, y + 0.002, 0.006);
      if (s > 0) { b.torus(N, xa + 0.05, 1.05, 0.04, 0.025, 0.005, 'z', 8); b.bx(N, xa + 0.03, 0.96, 0.03, xa + 0.07, 1.01, 0.05); }
    });
    b.pop();
  }
  navySign(b, '소화기 — 카빈 5.56 — 23', 0, h - 0.08, d + 0.001, 1.6, 0.1, '+z');
  if (o.collide !== false) {
    b.collide(-len / 2, 0, 0, len / 2, h, 0.06, 'metal', true);
    for (const s of [-1, 1]) b.collide(s < 0 ? -len / 2 : len / 2 - 0.06, 0, 0, s < 0 ? -len / 2 + 0.06 : len / 2, h, d, 'metal', true);
    b.collide(-len / 2, h - 0.16, 0, len / 2, h, d, 'metal', true);
    b.collide(-len / 2, 0, 0, len / 2, 0.28, d, 'metal', true);
  }
  return { slots, len };
}

/**
 * Armoury issue desk (§2.6 arm5: `note5_arm` (15.0, 1.0, −19.6) on it). Floor prop, origin = floor centre, `len` (1.8,
 * x) × `d` (0.7), counter top 1.0, FRONT (+z) = the customer side (closed panel), shelves on the armourer's side (−z),
 * a ledger with a pen on a chain, a returned-items tray, `ISSUE / RETURN` plate. Returns `top` (world point, centre of
 * the top). Calls: 2 (navy_grey + painted_dark) + atlas. Collider: footprint to 1.0.
 */
export function issueDesk(b: Builder, L: LevelBuild, o: { len?: number; d?: number; collide?: boolean } = {}): { top: THREE.Vector3 } {
  const len = o.len ?? 1.8, d = o.d ?? 0.7, N: Mat = 'navy_grey', K: Mat = 'painted_dark', top = 1.0;
  b.bx(N, -len / 2, 0, d / 2 - 0.03, len / 2, top - 0.03, d / 2); // front panel
  for (const s of [-1, 1]) b.bx(N, s < 0 ? -len / 2 : len / 2 - 0.03, 0, -d / 2, s < 0 ? -len / 2 + 0.03 : len / 2, top - 0.03, d / 2 - 0.03);
  for (const y of [0.1, 0.5]) b.bx(N, -len / 2 + 0.03, y - 0.02, -d / 2 + 0.02, len / 2 - 0.03, y, d / 2 - 0.03);
  b.bx(K, -len / 2 - 0.02, top - 0.03, -d / 2 - 0.02, len / 2 + 0.02, top, d / 2 + 0.04);
  b.detail(() => {
    b.rbox(N, -0.4, top + 0.012, 0.05, 0.45, 0.024, 0.32, 0, 0.06, 0);
    b.rod(K, -0.1, top + 0.01, 0.15, 0.05, top + 0.01, 0.2, 0.004, 4);
    b.bx(K, 0.35, top, -0.2, 0.75, top + 0.06, 0.1);
    for (const y of [0.1, 0.5]) for (let k = 0; k < 3; k++) b.bx(K, -0.7 + k * 0.5, y, -d / 2 + 0.05, -0.4 + k * 0.5, y + 0.18, -d / 2 + 0.3);
  });
  navySign(b, '지급 / 반납 — 모든 물품 서명', 0, 0.75, d / 2 + 0.001, 1.2, 0.1, '+z');
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, top, d / 2 + 0.04, 'metal', true);
  return { top: b.world(0, top, 0) };
}

// ═════════════════════════════════════════════════════════════ QUARTERS

/**
 * Navy triple bunk (§2.6 berths5: 6 bunks in rows x 12.8 … 14.8 and 21.2 … 23.2, z −12.8 … −3.2). Floor prop, origin =
 * floor centre, `len` (2.0, x) × `w` (0.8, z), FRONT (+z) = the access side; mattress pans at `tiers` (0.22 / 0.97 /
 * 1.72), corner posts to 2.12, a solid HEAD panel at −x with a red night light per tier (shared `nightLightMat`), a
 * rung ladder in the foot frame (+x), drawer fronts under the bottom tier, a curtain per tier on a front rail —
 * `curtains[i]` = open fraction (0 drawn shut … 1 bunched at the foot; default [1, 0.35, 0.8]) — mattress, pillow and a
 * made / thrown-back blanket per tier (`made`). Returns `tiers` (world y of each mattress top) and `head` (world points
 * of the night lights). Calls: 2 (navy_grey + fabric, double-sided) + the shared night-light lens. Collider: footprint
 * to the top (2.12).
 */
export function tripleBunk(b: Builder, L: LevelBuild, o: { len?: number; w?: number; tiers?: number[]; curtains?: number[]; made?: boolean[]; collide?: boolean } = {}): { tiers: number[]; head: THREE.Vector3[] } {
  const len = o.len ?? 2.0, w = o.w ?? 0.8, ys = o.tiers ?? [0.22, 0.97, 1.72], top = ys[ys.length - 1] + 0.4, N: Mat = 'navy_grey', F = L.doubleSided('fabric'), NL = nightLightMat(L);
  const curt = o.curtains ?? [1, 0.35, 0.8], R = srand(Math.round(len * 100 + ys.length));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(N, sx * len / 2 - (sx > 0 ? 0.04 : 0), 0, sz * w / 2 - (sz > 0 ? 0.04 : 0), sx * len / 2 + (sx < 0 ? 0.04 : 0), top, sz * w / 2 + (sz < 0 ? 0.04 : 0));
  b.bx(N, -len / 2 + 0.005, 0.1, -w / 2 + 0.04, -len / 2 + 0.02, top - 0.04, w / 2 - 0.04); // head panel
  b.bx(N, -len / 2 + 0.04, top - 0.04, -w / 2, len / 2 - 0.04, top, w / 2); // canopy
  b.detail(() => { for (let k = 1; k <= 6; k++) b.rod(N, len / 2 - 0.02, k * 0.3, -w / 2 + 0.04, len / 2 - 0.02, k * 0.3, w / 2 - 0.04, 0.012, 5); });
  // drawers under the bottom tier
  b.bx(N, -len / 2 + 0.04, 0.02, -w / 2 + 0.04, len / 2 - 0.04, ys[0] - 0.06, w / 2 - 0.03);
  b.detail(() => { for (const x of [-len / 4, len / 4]) { b.bx(N, x - len / 4 + 0.03, 0.04, w / 2 - 0.03, x + len / 4 - 0.03, ys[0] - 0.08, w / 2 - 0.015); b.bx(N, x - 0.08, ys[0] - 0.13, w / 2 - 0.015, x + 0.08, ys[0] - 0.11, w / 2 + 0.005); } });
  const head: THREE.Vector3[] = [], tiers: THREE.Vector3[] = [];
  ys.forEach((y, i) => {
    b.bx(N, -len / 2 + 0.04, y - 0.06, -w / 2 + 0.04, len / 2 - 0.04, y - 0.03, w / 2 - 0.04); // pan
    b.bx(N, -len / 2 + 0.04, y - 0.03, -w / 2 + 0.005, len / 2 - 0.04, y + 0.12, -w / 2 + 0.02); // back rail
    b.bx(N, -len / 2 + 0.04, y - 0.03, w / 2 - 0.02, len / 2 - 0.04, y + 0.06, w / 2 - 0.005); // front lip
    b.bx(F, -len / 2 + 0.05, y - 0.03, -w / 2 + 0.03, len / 2 - 0.05, y + 0.1, w / 2 - 0.03); // mattress
    tiers.push(b.world(0, y + 0.1, 0));
    const made = o.made?.[i] ?? i !== 1;
    b.detail(() => {
      if (made) {
        b.bx(F, -len / 2 + 0.45, y + 0.1, -w / 2 + 0.04, len / 2 - 0.06, y + 0.125, w / 2 - 0.04);
        b.rbox(F, len / 2 - 0.25, y + 0.15, 0, 0.3, 0.05, w - 0.12, 0, 0, 0);
      } else {
        b.rbox(F, 0.2, y + 0.15, 0.05, 1.0, 0.09, w - 0.1, 0.06, 0.25 + R() * 0.2, 0.08);
        b.rbox(F, 0.75, y + 0.13, -0.1, 0.4, 0.06, 0.5, -0.1, -0.5, 0.05);
      }
      b.rbox(F, -len / 2 + 0.25, y + 0.16, (R() - 0.5) * 0.06, 0.28, 0.08, 0.5, 0, 0.04, 0.06); // pillow
    });
    // night light on the head panel
    b.detail(() => { b.bx(N, -len / 2 + 0.02, y + 0.26, -w / 2 + 0.1, -len / 2 + 0.045, y + 0.33, -w / 2 + 0.22); b.bx(NL, -len / 2 + 0.045, y + 0.275, -w / 2 + 0.115, -len / 2 + 0.055, y + 0.315, -w / 2 + 0.205); });
    head.push(b.world(-len / 2 + 0.06, y + 0.3, -w / 2 + 0.16));
    // curtain on a rail under the tier above (or the canopy)
    const ry = (i + 1 < ys.length ? ys[i + 1] - 0.08 : top - 0.06), cy0 = y + 0.02, ch = ry - cy0, k = clamp01(curt[i] ?? 1);
    const cw = Math.max(0.25, (len - 0.1) * (1 - 0.8 * k)), cx = len / 2 - 0.05 - cw / 2;
    b.rod(N, -len / 2 + 0.04, ry + 0.01, w / 2 + 0.03, len / 2 - 0.04, ry + 0.01, w / 2 + 0.03, 0.008, 5);
    const geo = curtainGeo(+cw.toFixed(2), +ch.toFixed(2), Math.round(5 + k * 10), 0.02 + k * 0.03);
    b.geo(F, geo, 'box', new THREE.Matrix4().makeTranslation(cx, cy0 + ch / 2, w / 2 + 0.04));
  });
  if (o.collide !== false) b.collide(-len / 2, 0, -w / 2, len / 2, top, w / 2, 'metal', true);
  return { tiers: tiers.map((p) => p.y), head };
}

/** Dial of `bunkRadio`: `set(on)` lights (0.35, green) or darkens it; `at(k)` sets the glow (0 … 1). */
export interface BunkRadio { dial: THREE.MeshStandardMaterial; set(on: boolean): void; at(k: number): void; speaker: THREE.Vector3 }
/**
 * A sailor's bunk radio (`mk5_bunk_radio` (13.6, 1.3, −7.6), `v5_bunk_radio`). Shelf prop, origin = bottom centre, front
 * +z: a 0.26 × 0.15 × 0.08 black transistor set with a speaker grille, two knobs, a tuning-dial window (its OWN green
 * emissive, off) and a raised telescopic aerial. Returns `speaker` (world, for the positional line). Calls: 1
 * (painted_dark) + 1 (dial).
 */
export function bunkRadio(b: Builder, L: LevelBuild, o: { on?: boolean } = {}): BunkRadio {
  const K: Mat = 'painted_dark', w = 0.26, h = 0.15, d = 0.08;
  b.bx(K, -w / 2, 0.005, -d / 2, w / 2, h, d / 2);
  b.bx(K, -w / 2 + 0.01, 0, -d / 2 + 0.01, w / 2 - 0.01, 0.005, d / 2 - 0.01);
  b.detail(() => {
    for (let k = 0; k < 6; k++) b.bx(K, -w / 2 + 0.02, 0.03 + k * 0.016, d / 2, -0.01, 0.038 + k * 0.016, d / 2 + 0.004);
    for (const x of [0.04, 0.095]) b.cyl(K, x, 0.05, d / 2 + 0.008, 0.014, 0.016, 'z', 10);
    b.rod(K, w / 2 - 0.03, h, -0.02, w / 2 + 0.05, h + 0.32, -0.04, 0.003, 4);
    b.rbox(K, 0, h + 0.012, 0, 0.12, 0.012, 0.025, 0, 0, 0); // carry handle
  });
  const dial = newLens(L, 'white', 0);
  dial.emissive.set(0x4dff7a); dial.name = 'k5_radio_dial';
  b.detail(() => b.bx(dial, 0.01, 0.09, d / 2, w / 2 - 0.02, 0.125, d / 2 + 0.004));
  const at = (k: number) => { dial.emissiveIntensity = 0.35 * clamp01(k); };
  at(o.on ? 1 : 0);
  return { dial, set: (on) => at(on ? 1 : 0), at, speaker: b.world(-w / 4, h / 2, d / 2) };
}

/**
 * Small open shelf unit (the bunk-end shelf for `p5_berth_shells` (13.8, 0.7, −2.9) and `p5_berth_med`; heads; galley).
 * Wall prop (back at z 0), `w` (0.6) × `d` (0.35) × `h` (1.3), shelves at `shelves` (0.3 / 0.7 / 1.1) with 2 cm lips.
 * Returns the world point on each shelf top's centre. Calls: 1 (navy_grey). Collider: the carcass (`collide`).
 */
export function openShelf(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; shelves?: number[]; collide?: boolean } = {}): THREE.Vector3[] {
  const w = o.w ?? 0.6, d = o.d ?? 0.35, h = o.h ?? 1.3, N: Mat = 'navy_grey', sh = o.shelves ?? [0.3, 0.7, 1.1];
  for (const s of [-1, 1]) b.bx(N, s < 0 ? -w / 2 : w / 2 - 0.02, 0, 0, s < 0 ? -w / 2 + 0.02 : w / 2, h, d);
  b.bx(N, -w / 2 + 0.02, h - 0.02, 0, w / 2 - 0.02, h, d);
  for (const y of sh) { b.bx(N, -w / 2 + 0.02, y - 0.02, 0, w / 2 - 0.02, y, d); b.bx(N, -w / 2 + 0.02, y, d - 0.012, w / 2 - 0.02, y + 0.025, d); }
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
  return sh.map((y) => b.world(0, y, d / 2 - 0.02));
}

/**
 * Fixed mess table with bench seats (§2.6 mess5: 4 tables 1.0 × 2.4, h 0.75 at x 27/31 × z −10/−6 → ry π/2: the long
 * axis along z). Floor prop, origin = floor centre, `len` (2.4, x) × `w` (1.0, z), top 0.75 with a 1.5 cm fiddle edge,
 * two bolted pedestals, and (`benches`, true) fixed bench seats 0.35 wide at 0.45 on both long sides, hung off the
 * pedestals (footprint with benches: `len` × (`w` + 0.9)). Calls: 2 (navy_grey + laminate). Collider: table to 0.75,
 * benches to 0.45.
 */
export function messTable(b: Builder, L: LevelBuild, o: { len?: number; w?: number; h?: number; benches?: boolean; collide?: boolean } = {}) {
  const len = o.len ?? 2.4, w = o.w ?? 1.0, h = o.h ?? 0.75, N: Mat = 'navy_grey', T = tint5(L, 'laminate', 'plastic_white', 0x9ea6a8, { roughness: 0.45 });
  b.bx(T, -len / 2, h - 0.03, -w / 2, len / 2, h, w / 2);
  for (const s of [-1, 1]) { b.bx(T, -len / 2, h, s * w / 2 - (s > 0 ? 0.012 : 0), len / 2, h + 0.015, s * w / 2 + (s < 0 ? 0.012 : 0)); b.bx(T, s * len / 2 - (s > 0 ? 0.012 : 0), h, -w / 2 + 0.012, s * len / 2 + (s < 0 ? 0.012 : 0), h + 0.015, w / 2 - 0.012); }
  b.bx(N, -len / 2 + 0.05, h - 0.08, -w / 2 + 0.06, len / 2 - 0.05, h - 0.03, w / 2 - 0.06); // under-frame
  const bench = o.benches !== false, bz = w / 2 + 0.1 + 0.175;
  for (const x of [-len / 2 + 0.45, len / 2 - 0.45]) {
    b.bx(N, x - 0.06, 0.012, -0.06, x + 0.06, h - 0.08, 0.06);
    b.bx(N, x - 0.2, 0, -0.3, x + 0.2, 0.012, 0.3);
    if (bench) b.bx(N, x - 0.04, 0.34, -bz, x + 0.04, 0.39, bz); // seat arms
  }
  if (bench) for (const s of [-1, 1]) {
    b.bx(T, -len / 2 + 0.05, 0.42, s * bz - 0.175, len / 2 - 0.05, 0.45, s * bz + 0.175);
    b.bx(N, -len / 2 + 0.08, 0.39, s * bz - 0.15, len / 2 - 0.08, 0.42, s * bz + 0.15);
  }
  if (o.collide !== false) {
    b.collide(-len / 2, 0, -w / 2, len / 2, h + 0.015, w / 2, 'metal', true);
    if (bench) for (const s of [-1, 1]) b.collide(-len / 2 + 0.05, 0, s * bz - 0.175, len / 2 - 0.05, 0.45, s * bz + 0.175, 'metal', true);
  }
}

/**
 * Serving counter (§2.6 mess5: along the north wall x 26 … 36, z −2.8 … −2.2, h 1.0, tray stacks at `mk5_trays` (30.0,
 * 1.0, −2.5) → origin (31.0, 0, −2.2), ry π). Wall prop (back at z 0), `len` (10, x) × `d` (0.6) × `h` (1.0): a navy
 * base with a kick recess, a stainless top with `wells` (4) covered bain-marie wells in the +x part (`wellsFrom`, local x
 * of the first well: 0.0 — the −x half stays clear for the trays), a heat-lamp gantry over the wells (warm lens,
 * shared). Calls: 2 (stainless + navy_grey) + the shared warm lens. Collider: footprint to `h`.
 */
export function servingCounter(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; wells?: number; wellsFrom?: number; collide?: boolean } = {}): { top: number } {
  const len = o.len ?? 10, d = o.d ?? 0.6, h = o.h ?? 1.0, S: Mat = 'stainless', N: Mat = 'navy_grey', nw = o.wells ?? 4, wf = o.wellsFrom ?? 0.0;
  b.bx(N, -len / 2, 0.1, 0, len / 2, h - 0.04, d - 0.03);
  b.bx(N, -len / 2 + 0.02, 0, 0, len / 2 - 0.02, 0.1, d - 0.1);
  // top: back strip, front strip, pieces between the wells
  const ww = 0.55, wd = 0.32, wz0 = 0.14, wz1 = wz0 + wd, gap = 0.18;
  const xs = Array.from({ length: nw }, (_, i) => wf + gap + i * (ww + gap));
  b.bx(S, -len / 2, h - 0.04, 0, len / 2, h, wz0);
  b.bx(S, -len / 2, h - 0.04, wz1, len / 2, h, d);
  let px = -len / 2;
  for (const x of xs) { b.bx(S, px, h - 0.04, wz0, x, h, wz1); px = x + ww; }
  b.bx(S, px, h - 0.04, wz0, len / 2, h, wz1);
  b.bx(S, -len / 2, h - 0.12, d - 0.03, len / 2, h - 0.04, d); // front apron
  for (const x of xs) {
    // well walls, bottom, and a lid on half of it
    b.bx(S, x, h - 0.2, wz0, x + 0.01, h - 0.04, wz1).bx(S, x + ww - 0.01, h - 0.2, wz0, x + ww, h - 0.04, wz1);
    b.bx(S, x + 0.01, h - 0.2, wz0, x + ww - 0.01, h - 0.04, wz0 + 0.01).bx(S, x + 0.01, h - 0.2, wz1 - 0.01, x + ww - 0.01, h - 0.04, wz1);
    b.bx(S, x + 0.01, h - 0.2, wz0 + 0.01, x + ww - 0.01, h - 0.19, wz1 - 0.01);
    b.bx(S, x + 0.02, h - 0.015, wz0 + 0.02, x + ww / 2, h - 0.005, wz1 - 0.02);
    b.detail(() => b.rbox(S, x + ww * 0.75, h + 0.02, (wz0 + wz1) / 2, 0.05, 0.008, 0.3, 0, 0.4, 0.7)); // ladle
  }
  // heat-lamp gantry over the wells
  if (nw > 0) {
    const g0 = xs[0] - 0.1, g1 = xs[nw - 1] + ww + 0.1, gy = h + 0.55;
    for (const x of [g0, g1]) b.bx(S, x - 0.02, h, 0.04, x + 0.02, gy, 0.08);
    b.bx(S, g0 - 0.02, gy, 0.04, g1 + 0.02, gy + 0.06, wz1);
    b.detail(() => { for (const x of xs) b.bx(lampLens5(L, 'warm'), x + 0.05, gy - 0.012, wz0 + 0.04, x + ww - 0.05, gy, wz1 - 0.04); });
  }
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
  return { top: b.world(0, h, 0).y };
}

/** The trays of `trayStack`. `fall()` runs the slide-off-and-crash (returns `impact` = first tray on the floor: play
 * `tray_crash`; `bin` = the cutlery bin hits: `cutlery_scatter`; `dur`). `at(t)` scrubs, `snap()` = all on the floor. */
export interface TrayStack { group: THREE.Group; readonly state: 'stacked' | 'falling' | 'down'; fall(): { dur: number; impact: number; bin: number }; at(t: number): void; snap(): void }
/**
 * Tray stacks + cutlery bin on the serving counter that slide off and crash across the floor (`v5_trays`). Counter-top
 * prop: origin = on the counter TOP at the stacks' centre (`mk5_trays`), the counter's free edge at local z = `edge`
 * (0.3 = half the counter depth) — so ry π for the north-wall counter (free edge toward −z); the floor at local y =
 * `floor` (−1.0). `n` (30) stainless compartment trays in `stacks` (2) stacks and a cutlery bin with 36 pieces; all are
 * debris (no colliders). Each tray slides to the edge, tips nose-down and tumbles off, slaps the deck, hops and skids to
 * a seeded rest pose inside `area` (local [x0, z0, x1, z1], default [−1.8, edge + 0.2, 1.8, edge + 2.8]) avoiding
 * `keepOut` rectangles (table footprints) and each other (trays that cannot find room lie tilted on another — never two
 * flat trays coplanar). The bin tips over and the cutlery sprays out when it lands. Calls: 3 (instanced:
 * tray bodies (stainless) · tray rims (`k5_tray_rim`, same matrices) · bin + cutlery), static none.
 */
export function trayStack(b: Builder, L: LevelBuild, o: { n?: number; stacks?: number; edge?: number; floor?: number; area?: [number, number, number, number]; keepOut?: [number, number, number, number][]; seed?: number; name?: string } = {}): TrayStack {
  const n = o.n ?? 30, ns = o.stacks ?? 2, edge = o.edge ?? 0.3, floor = o.floor ?? -1.0, R = srand(o.seed ?? 17), g = 9.81;
  const area = o.area ?? [-1.8, edge + 0.2, 1.8, edge + 2.8], keep = o.keepOut ?? [];
  const P = 0.0275, TH = 0.013, TW = 0.42, TD = 0.3;
  // geometry: tray centred (y −0.013 … 0.013), cutlery / bin panel = unit box
  // IB5c: the tray body (base + compartment walls) and its RIM (side walls + a rolled lip) are two instanced meshes on
  // ONE matrix buffer: a darker body, a bright rim — on the deck each tray reads as a framed tray, not a pale sheet
  const RW = 0.009, LIP = 0.006;
  const tp = L.part('tray5');
  tp.bx('stainless', -TW / 2 + RW, -TH, -TD / 2 + RW, TW / 2 - RW, -TH + 0.01, TD / 2 - RW); // (1 cm base: never within the depth tolerance of what it lies on)
  tp.bx('stainless', -TW / 2 + RW, -TH + 0.01, 0.028, TW / 2 - RW, TH - 0.006, 0.032);
  tp.bx('stainless', -0.072, -TH + 0.01, -TD / 2 + RW, -0.068, TH - 0.006, 0.028);
  const trayGeo = tp.bake();
  const rp = L.part('tray5_rim');
  rp.bx('stainless', -TW / 2, -TH, TD / 2 - RW, TW / 2, TH - LIP, TD / 2).bx('stainless', -TW / 2, -TH, -TD / 2, TW / 2, TH - LIP, -TD / 2 + RW);
  rp.bx('stainless', -TW / 2, -TH, -TD / 2 + RW, -TW / 2 + RW, TH - LIP, TD / 2 - RW).bx('stainless', TW / 2 - RW, -TH, -TD / 2 + RW, TW / 2, TH - LIP, TD / 2 - RW);
  // the rolled lip: 6 mm proud of the walls all round (stays inside the 2.6 cm a tray occupies in its stack)
  rp.bx('stainless', -TW / 2 - LIP, TH - LIP, TD / 2 - RW, TW / 2 + LIP, TH, TD / 2 + LIP).bx('stainless', -TW / 2 - LIP, TH - LIP, -TD / 2 - LIP, TW / 2 + LIP, TH, -TD / 2 + RW);
  rp.bx('stainless', -TW / 2 - LIP, TH - LIP, -TD / 2 + RW, -TW / 2 + RW, TH, TD / 2 - RW).bx('stainless', TW / 2 - RW, TH - LIP, -TD / 2 + RW, TW / 2 + LIP, TH, TD / 2 - RW);
  const rimGeo = rp.bake();
  const mat = L.ctx.materials.get('stainless');
  const rimMat = mat4(L, 'k5_tray_rim', () => {
    const m = L.ctx.materials.clone('stainless', { color: 0xe4e9ec, roughness: 0.22, metalness: 0.7 });
    m.name = 'k5_tray_rim';
    return m;
  });
  const group = new THREE.Group();
  group.name = o.name ?? 'trays5';
  worldOf(b, 0, 0, 0).decompose(group.position, group.quaternion, group.scale);
  group.userData.rooms = b.rooms.slice();
  L.root.add(group);
  const trays = new THREE.InstancedMesh(trayGeo, mat, n);
  trays.name = `${group.name}:trays`;
  const rims = new THREE.InstancedMesh(rimGeo, rimMat, n);
  rims.name = `${group.name}:rims`;
  rims.instanceMatrix = trays.instanceMatrix; // one buffer: every pose write moves both
  const NC = 36, small = new THREE.InstancedMesh(unitBox(), mat, NC + 5);
  small.name = `${group.name}:cutlery`;
  for (const m of [trays, rims, small]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  const inArea = (x: number, z: number) => x > area[0] && x < area[2] && z > area[1] && z < area[3] && !keep.some((k) => x > k[0] - 0.25 && x < k[2] + 0.25 && z > k[1] - 0.25 && z < k[3] + 0.25);
  interface Item { x0: number; y0: number; z0: number; yaw0: number; d: number; ts: number; vx: number; v: number; T: number; px: number; pz: number; rx: number; rz: number; tk: number; ry: number; spin: number; w: number; fin: number; pile: number; tilt: number; end: number }
  const rests: [number, number][] = [];
  const per = Math.ceil(n / ns);
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i / per), k = i % per, x0 = (j - (ns - 1) / 2) * 0.46, z0 = -0.02 + (R() - 0.5) * 0.01, y0 = k * P + TH;
    const d = (per - 1 - k) * 0.03 + j * 0.07 + R() * 0.05, a = 5 + R() * 3, dist = Math.max(0.05, edge - z0), ts = Math.sqrt((2 * dist) / a), v = a * ts * (0.75 + R() * 0.5);
    const vx = (R() - 0.5) * 2.6 + x0 * 0.8, T = Math.sqrt((2 * (y0 - floor - TH)) / g), px = x0 + vx * (ts * 0.5 + T), pz = edge + v * T;
    const spin = 3 + R() * 6, tk = spin * T, fin = Math.round(tk / PI) * PI;
    const hd = Math.hypot(vx, v), ux = vx / hd, uz = v / hd;
    let sk = 0.2 + R() * 1.0, rx = px + ux * sk, rz = pz + uz * sk, pile = 0, tilt = 0;
    const ok = (x: number, z: number) => inArea(x, z) && rests.every(([qx, qz]) => Math.hypot(qx - x, qz - z) > 0.53);
    const cands = [sk, sk * 0.5, sk * 1.5, 0.05, sk * 2.2, sk * 3.0];
    const c = cands.find((s) => ok(px + ux * s, pz + uz * s));
    if (c !== undefined) { sk = c; rx = px + ux * sk; rz = pz + uz * sk; }
    else {
      // no room: lies tilted against / on another tray, nudged into the area
      // the freest spot of 24 seeded tries inside the area (it skids there)
      let best = -1;
      for (let k = 0; k < 24; k++) {
        const qx = lerp(area[0] + 0.3, area[2] - 0.3, R()), qz = lerp(area[1] + 0.3, area[3] - 0.3, R());
        if (!inArea(qx, qz)) continue;
        const dmin = Math.min(9, ...rests.map(([a, c]) => Math.hypot(a - qx, c - qz)));
        if (dmin > best) { best = dmin; rx = qx; rz = qz; }
      }
      pile = 0.03 + R() * 0.03; tilt = 0.12 + R() * 0.12;
    }
    rests.push([rx, rz]);
    const w = 0.25 + R() * 0.35;
    items.push({ x0, y0, z0, yaw0: (R() - 0.5) * 0.04, d, ts, vx, v, T, px, pz, rx, rz, tk, ry: (R() - 0.5) * 3.5, spin, w, fin, pile, tilt, end: d + ts + T + w + 0.15 });
  }
  // the cutlery bin (+x of the stacks) and its pieces
  const bin = { x0: (ns / 2) * 0.46 + 0.2, z0: 0.0, d: 0.18, ts: 0.28, v: 1.6, vx: 0.4 };
  const binT = Math.sqrt((2 * (0.08 - floor)) / g), binLand = bin.d + bin.ts + binT;
  const binP1 = { x: bin.x0 + bin.vx * (bin.ts * 0.5 + binT), z: edge + bin.v * binT };
  const pieces = Array.from({ length: NC }, (_, i) => ({
    lx: ((i % 6) - 2.5) * 0.045, lz: (Math.floor(i / 6) - 2.5) * 0.02,
    vx: (R() - 0.3) * 2.2, vy: 0.6 + R() * 1.2, vz: 0.4 + R() * 2.0, sp: R() * 30, yaw: R() * 2 * PI, len: i % 3 === 0 ? 0.2 : 0.18, wid: i % 3 === 1 ? 0.03 : 0.018,
  }));
  const pieceEnd = (q: (typeof pieces)[number]) => binLand + (q.vy + Math.sqrt(q.vy * q.vy + 2 * g * 0.06)) / g;
  const dur = Math.max(...items.map((it) => it.end), binLand + 1.6);
  const impact = Math.min(...items.map((it) => it.d + it.ts + it.T));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _b = new THREE.Matrix4(), _l = new THREE.Matrix4();
  const trayAt = (it: Item, t: number) => {
    const u = t - it.d;
    let x = it.x0, y = it.y0, z = it.z0, rx = 0, ry = it.yaw0, rz = 0;
    if (u > 0 && u <= it.ts) { const k = u / it.ts; z = it.z0 + (edge - it.z0) * k * k; x = it.x0 + it.vx * 0.5 * u * k; }
    else if (u > it.ts && u <= it.ts + it.T) {
      const f = u - it.ts;
      x = it.x0 + it.vx * (it.ts * 0.5 + f); z = edge + it.v * f; y = it.y0 - 0.5 * g * f * f;
      rx = it.spin * f; ry = it.yaw0 + it.ry * f; rz = Math.sin(f * 7) * 0.15;
      y = Math.max(y, floor + TH + Math.abs(Math.sin(rx)) * TD * 0.5);
    } else if (u > it.ts + it.T) {
      const f = u - it.ts - it.T, k = easeOut(f / it.w), hop = f < 0.12 ? Math.sin((f / 0.12) * PI) * 0.035 : 0;
      x = lerp(it.px, it.rx, k); z = lerp(it.pz, it.rz, k);
      rx = lerp(it.tk, it.fin + it.tilt, smooth(f / 0.12)); ry = it.yaw0 + it.ry * it.T + it.ry * 0.3 * k; rz = Math.sin(f * 30) * 0.06 * (1 - smooth(f / 0.2));
      y = floor + TH + hop + it.pile * smooth(f / 0.2) + Math.abs(Math.sin(rx - it.fin)) * TD * 0.3;
    }
    _e.set(rx, ry, rz);
    return _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, 1));
  };
  const binAt = (t: number) => {
    const u = t - bin.d;
    let x = bin.x0, y = 0.08, z = bin.z0, rx = 0, rz = 0;
    if (u > 0 && u <= bin.ts) { const k = u / bin.ts; z = bin.z0 + (edge - bin.z0) * k * k; }
    else if (u > bin.ts && u <= bin.ts + binT) { const f = u - bin.ts; x = bin.x0 + bin.vx * f; z = edge + bin.v * f; y = 0.08 - 0.5 * g * f * f; rx = 4 * f; rz = 1.5 * f; }
    else if (u > bin.ts + binT) { const f = u - bin.ts - binT, k = easeOut(f / 0.5); x = lerp(binP1.x, binP1.x + 0.25, k); z = lerp(binP1.z, binP1.z + 0.35, k); rx = lerp(4 * binT, PI / 2, smooth(f / 0.15)); rz = lerp(1.5 * binT, 0.3, smooth(f / 0.15)); y = floor + 0.075; }
    _e.set(rx, 0.2, rz);
    return _b.compose(_p.set(x, Math.max(y, floor + 0.075), z), _q.setFromEuler(_e), _s.set(1, 1, 1));
  };
  const BIN: [number, number, number, number, number, number][] = [[0, -0.075, 0, 0.32, 0.01, 0.14], [0, 0, -0.07, 0.32, 0.16, 0.008], [0, 0, 0.07, 0.32, 0.16, 0.008], [-0.16, 0, 0, 0.008, 0.16, 0.14], [0.16, 0, 0, 0.008, 0.16, 0.14]];
  let state: 'stacked' | 'falling' | 'down' = 'stacked';
  const pose = (t: number) => {
    items.forEach((it, i) => trays.setMatrixAt(i, trayAt(it, t)));
    const bm = binAt(t).clone();
    BIN.forEach(([x, y, z, sx, sy, sz], i) => { _l.compose(_p.set(x, y, z), _q.identity(), _s.set(sx, sy, sz)); small.setMatrixAt(i, _m.multiplyMatrices(bm, _l)); });
    pieces.forEach((q, i) => {
      if (t < binLand) { _l.compose(_p.set(q.lx, 0.03, q.lz), _q.setFromEuler(_e.set(0, 0, 0.05 * (q.lx > 0 ? 1 : -1))), _s.set(q.wid, q.len, 0.004)); small.setMatrixAt(5 + i, _m.multiplyMatrices(bm, _l)); return; }
      const f = t - binLand, te = pieceEnd(q) - binLand, ff = Math.min(f, te);
      const x = binP1.x + q.vx * ff * 0.6 + (f > te ? q.vx * 0.05 * smooth((f - te) / 0.2) : 0), z = binP1.z + q.vz * ff * 0.6;
      const y = Math.max(floor + 0.003 + (i % 7) * 0.0006, floor + 0.08 + q.vy * ff - 0.5 * g * ff * ff);
      const lie = smooth((f - te) / 0.1);
      _e.set(lerp(q.sp * ff, PI / 2, lie), q.yaw + q.sp * 0.2 * ff, lerp(q.sp * 0.7 * ff, 0, lie));
      _l.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(q.wid, q.len, 0.004));
      small.setMatrixAt(5 + i, _l);
    });
    trays.instanceMatrix.needsUpdate = true; small.instanceMatrix.needsUpdate = true;
    state = t <= 0 ? 'stacked' : t >= dur ? 'down' : 'falling';
    const moving = state === 'falling';
    trays.frustumCulled = rims.frustumCulled = small.frustumCulled = !moving;
    if (!moving) for (const m of [trays, rims, small]) { m.computeBoundingSphere(); m.computeBoundingBox(); }
  };
  pose(0);
  const tl = timeline(L, dur, pose);
  return {
    group, get state() { return state; },
    fall() { tl.play(0); return { dur, impact, bin: binLand }; },
    at(t) { tl.at(t); },
    snap() { tl.at(dur); },
  };
}

/**
 * Galley range (§2.6 galley5: "ranges"). Wall prop (back at z 0), `len` (1.8) × `d` (0.85) × 0.9: six solid hot plates
 * with sea rails (fiddles) and pot clamps on top, two oven doors with bar handles, a control strip with knobs, a kick
 * plinth, and an extractor hood on the wall above (1.9 … 2.35). Calls: 2 (stainless + painted_dark). Collider: body.
 */
export function galleyRange(b: Builder, L: LevelBuild, o: { len?: number; d?: number; hood?: boolean; collide?: boolean } = {}) {
  const len = o.len ?? 1.8, d = o.d ?? 0.85, S: Mat = 'stainless', K: Mat = 'painted_dark', h = 0.9;
  b.bx(S, -len / 2, 0.1, 0, len / 2, h - 0.04, d - 0.02);
  b.bx(K, -len / 2 + 0.03, 0, 0, len / 2 - 0.03, 0.1, d - 0.08);
  b.bx(S, -len / 2 - 0.01, h - 0.04, 0, len / 2 + 0.01, h, d + 0.01);
  for (let i = 0; i < 6; i++) { const x = -len / 2 + 0.2 + (i % 3) * ((len - 0.4) / 2), z = i < 3 ? 0.25 : 0.58; b.cyl(K, x, h + 0.012, z, 0.15, 0.024, 'y', 20); }
  // sea rails: a bar round the top on posts
  for (const z of [0.05, d - 0.03]) b.rod(S, -len / 2 + 0.02, h + 0.1, z, len / 2 - 0.02, h + 0.1, z, 0.01, 6);
  for (const x of [-len / 2 + 0.02, len / 2 - 0.02]) b.rod(S, x, h + 0.1, 0.05, x, h + 0.1, d - 0.03, 0.01, 6);
  b.detail(() => {
    for (const x of [-len / 2 + 0.02, 0, len / 2 - 0.02]) for (const z of [0.05, d - 0.03]) b.rod(S, x, h, z, x, h + 0.1, z, 0.008, 5);
    // ovens + knobs
    for (const s of [-1, 1]) { const x0 = s < 0 ? -len / 2 + 0.05 : 0.03, x1 = s < 0 ? -0.03 : len / 2 - 0.05; b.bx(S, x0, 0.15, d - 0.02, x1, 0.62, d); b.rod(S, x0 + 0.05, 0.58, d + 0.04, x1 - 0.05, 0.58, d + 0.04, 0.012, 6); b.bx(K, x0 + 0.1, 0.3, d, x1 - 0.1, 0.48, d + 0.01); }
    for (let i = 0; i < 8; i++) b.cyl(K, -len / 2 + 0.15 + i * ((len - 0.3) / 7), 0.76, d + 0.015, 0.022, 0.03, 'z', 10);
  });
  if (o.hood !== false) {
    b.bx(S, -len / 2 - 0.05, 2.25, 0, len / 2 + 0.05, 2.4, 0.9);
    b.push(0, 2.25, 0.9, 0, 0.5, 0);
    b.bx(S, -len / 2 - 0.05, -0.3, -0.02, len / 2 + 0.05, 0, 0.0);
    b.pop();
    b.detail(() => { for (let x = -len / 2 + 0.1; x < len / 2 - 0.05; x += 0.08) b.bx(K, x - 0.02, 2.234, 0.15, x + 0.02, 2.25, 0.75); });
  }
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h + 0.1, d + 0.04, 'metal', true);
}

/**
 * Galley prep table (steel bench) with an undershelf, a cutting board (plastic), a stock pot, a colander. Floor prop,
 * origin = floor centre, `len` (1.8) × `d` (0.75) × 0.9. Calls: 2 (stainless + plastic_white). Collider: to 0.9.
 */
export function prepTable(b: Builder, L: LevelBuild, o: { len?: number; d?: number; collide?: boolean } = {}) {
  const len = o.len ?? 1.8, d = o.d ?? 0.75, S: Mat = 'stainless', h = 0.9;
  b.bx(S, -len / 2, h - 0.04, -d / 2, len / 2, h, d / 2);
  b.bx(S, -len / 2 + 0.04, h, -d / 2, len / 2 - 0.04, h + 0.06, -d / 2 + 0.012); // upstand
  b.bx(S, -len / 2 + 0.04, 0.2, -d / 2 + 0.04, len / 2 - 0.04, 0.22, d / 2 - 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(S, sx * (len / 2 - 0.04) - 0.02, 0, sz * (d / 2 - 0.04) - 0.02, sx * (len / 2 - 0.04) + 0.02, h - 0.04, sz * (d / 2 - 0.04) + 0.02);
  b.detail(() => {
    b.bx('plastic_white', -0.6, h, -0.1, -0.15, h + 0.02, 0.2);
    b.cyl(S, 0.45, h + 0.15, 0.0, 0.16, 0.3, 'y', 18); b.torus(S, 0.45, h + 0.3, 0.0, 0.16, 0.008, 'y', 18);
    for (const s of [-1, 1]) b.torus(S, 0.45 + s * 0.17, h + 0.25, 0, 0.03, 0.006, 'z', 8);
    b.cyl(S, 0.3, 0.27, 0.1, 0.18, 0.1, 'y', 16);
  });
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'metal', true);
}

/**
 * Frosted cold-room window (§2.6 galley5: x 37.78, z 0.0 … 2.0, y 1.0 … 2.0 → origin (37.8, 1.5, 1.0), ry −π/2).
 * Wall prop, origin = the WINDOW's centre on the wall face (the opening through the wall is the level's): a stainless
 * frame 4 cm proud, the pane 5 cm into the opening — frosted (translucent: light and shapes behind read as a soft blur),
 * condensation runs, and ONE CLEAR CORNER (`corner` 'bl' | 'br', 0.22 × 0.16) where the glass shows what hangs behind it
 * sharp (`clear`, the returned world point: hang `oilskin` at x = clear + 0.31 along the window, y = clear.y + 1.05,
 * 0.4 … 0.6 m behind the pane — its left cuff then hangs in the clear corner and its shape reads through the frost). Calls: 2 (stainless + frost, transparent:
 * one layer). Collider: the pane ('glass').
 */
export function frostedWindow(b: Builder, L: LevelBuild, o: { w?: number; h?: number; corner?: 'bl' | 'br'; collide?: boolean } = {}): { clear: THREE.Vector3 } {
  const w = o.w ?? 2.0, h = o.h ?? 1.0, S: Mat = 'stainless', f = 0.06, corner = o.corner ?? 'bl';
  // frame on the wall face (0 … 0.04) round the opening, and a 1 cm lining INSIDE the opening (its room-side faces 1 cm
  // inside the opening's own faces: nothing lies on the wall's planes)
  b.bx(S, -w / 2 - f, -h / 2 - f, 0, w / 2 + f, -h / 2 + 0.01, 0.04).bx(S, -w / 2 - f, h / 2 - 0.01, 0, w / 2 + f, h / 2 + f, 0.04);
  b.bx(S, -w / 2 - f, -h / 2 + 0.01, 0, -w / 2 + 0.01, h / 2 - 0.01, 0.04).bx(S, w / 2 - 0.01, -h / 2 + 0.01, 0, w / 2 + f, h / 2 - 0.01, 0.04);
  b.bx(S, -w / 2, -h / 2, -0.07, w / 2, -h / 2 + 0.01, -0.001).bx(S, -w / 2, h / 2 - 0.01, -0.07, w / 2, h / 2, -0.001);
  b.bx(S, -w / 2, -h / 2 + 0.01, -0.07, -w / 2 + 0.01, h / 2 - 0.01, -0.001).bx(S, w / 2 - 0.01, -h / 2 + 0.01, -0.07, w / 2, h / 2 - 0.01, -0.001);
  b.bx(S, -w / 2 - f - 0.02, -h / 2 - f - 0.04, 0.04, w / 2 + f + 0.02, -h / 2 - f, 0.12); // sill
  const cw = 0.22, ch = 0.16, cu = corner === 'bl' ? 0.04 + cw / 2 : w - 0.04 - cw / 2, cv = 0.04 + ch / 2;
  const frost = mat4(L, `k5_frost_${w}_${h}_${corner}`, () => {
    const px = 256, py = Math.round((256 * h) / w);
    const R = srand(41);
    const tex = canvasTex(px, py, (g) => {
      g.clearRect(0, 0, px, py);
      const img = g.createImageData(px, py);
      for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) {
        const u = (x / px) * w, v = (1 - y / py) * h;
        const dx = Math.max(0, Math.abs(u - cu) - cw / 2), dy = Math.max(0, Math.abs(v - cv) - ch / 2), dc = Math.hypot(dx, dy);
        let a = 0.74 + (R() - 0.5) * 0.1 - Math.max(0, 0.12 - v) * 0.6;
        a = a * smooth(dc / 0.05) + 0.1 * (1 - smooth(dc / 0.05));
        const i = (y * px + x) * 4, c = 226 + Math.round((R() - 0.5) * 16);
        img.data[i] = c; img.data[i + 1] = c + 4; img.data[i + 2] = c + 8; img.data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
      }
      g.putImageData(img, 0, 0);
      // condensation runs: clearer streaks from the top edge
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 7; k++) {
        let x = R() * px, y = R() * py * 0.3;
        const l = py * (0.15 + R() * 0.45);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        for (let t = 0; t < l; t += 2) { x += (R() - 0.5) * 0.9; g.fillRect(x, y + t, 1.1, 2); }
        g.beginPath(); g.arc(x, y + l, 1.6, 0, 2 * Math.PI); g.fill();
      }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, map: tex, color: 0xffffff, transparent: true, opacity: 1, roughness: 0.9, metalness: 0, depthWrite: false, side: THREE.FrontSide });
    m.name = 'k5_frost';
    return m;
  });
  b.detail(() => b.quad(frost, 0, 0, -0.05, w, h, '+z'));
  if (o.collide !== false) b.collide(-w / 2, -h / 2, -0.06, w / 2, h / 2, -0.04, 'glass', true);
  return { clear: b.world(cu - w / 2, cv - h / 2, -0.05) };
}

/** The coat of `oilskin`: `swing()` = the draught takes it — a big pendulum swing across the window and back with a twist
 * (returns `dur`; the vignette plays `hook_creak` at `creak`); `sway(on)` = an idle sway; `at(t)` scrubs the swing; `snap()`
 * = swaying idle. */
export interface Oilskin extends MovingPart5 { swing(): { dur: number; creak: number }; sway(on: boolean): void; at(t: number): void; snap(): void }
/** One ring of a `drapeGeo` tube: centre, half-widths, vertical fold amplitude (m) and count, phase. */
interface DRing { c: [number, number, number]; rx: number; rz: number; fold?: number; nf?: number; ph?: number }
/**
 * Soft cloth tube through horizontal rings (a hanging coat body, a sleeve, a hood): elliptic sections with vertical drape
 * folds (two sine families + a little noise, growing with `fold`), smooth normals, an optional cap at the first / last
 * ring, and an inner layer (reversed, 6 mm in) so an open hem or cuff reads as cloth from below.
 */
export function drapeGeo(rings: DRing[], seg: number, seed: number, cap: { top?: number; bottom?: number } = {}): THREE.BufferGeometry {
  const R = srand(seed), pos: number[] = [], idx: number[] = [];
  const jit = rings.map(() => Array.from({ length: seg }, () => (R() - 0.5) * 0.3));
  const ringPts = (shrink: number) => rings.map((r, i) => {
    const out: [number, number, number][] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * 2 * PI, f = r.fold ?? 0, nf = r.nf ?? 9, ph = r.ph ?? 0;
      const d = f * (0.62 * Math.sin(nf * a + ph) + 0.38 * Math.sin(2.2 * nf * a + ph * 1.7 + 0.5) + jit[i][j]);
      out.push([r.c[0] + Math.cos(a) * (r.rx + d - shrink), r.c[1], r.c[2] + Math.sin(a) * (r.rz + d * 0.8 - shrink)]);
    }
    return out;
  });
  const layer = (pts: [number, number, number][][], flip: boolean) => {
    const base = pos.length / 3;
    for (const ring of pts) for (const v of ring) pos.push(...v);
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const capAt = (i: number, dy: number, down: boolean) => {
      const r = rings[i], ci = pos.length / 3;
      pos.push(r.c[0], r.c[1] + dy, r.c[2]);
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg);
        if (down !== flip) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    if (!flip && cap.top !== undefined) capAt(0, cap.top, false);
    if (!flip && cap.bottom !== undefined) capAt(pts.length - 1, -cap.bottom, true);
  };
  layer(ringPts(0), false);
  if (cap.top === undefined || cap.bottom === undefined) layer(ringPts(0.006), true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Yellow oilskin coat on a hanger on a hook (`mk5_oilskin`, behind the frosted window; `v5_galley_shape`; B3). Hook prop:
 * origin = the hook point, the coat hangs 1.36 m down −y, its FRONT +z (face the window), swinging about local z (= across
 * a window lying in local x-y). Built as cloth, not blocks: a steel hanger whose neck and hook show above a stand-up
 * collar; sloping shoulders (no head: the HOOD hangs empty down the back); a body widening to the hem in soft vertical
 * drape folds; a placket with toggles, pocket flaps; the sleeves hang slightly forward, bunched at the elbow, their
 * cuffs at the window's clear corner. At rest the shape is a coat; when the draught takes it (`swing()`) it swings and
 * twists and the sleeves lag a beat behind the shoulders — only then does it move like someone.
 * Calls: 1 static (steel_raw hook) + 3 moving (coat yellow + hanger steel + the sleeves on their own pivot).
 */
export function oilskin(b: Builder, L: LevelBuild, o: { name?: string } = {}): Oilskin {
  const S: Mat = 'steel_raw', Y = oilskinMat(L), name = o.name ?? 'oilskin5';
  b.bx(S, -0.03, 0.0, -0.03, 0.03, 0.04, 0.03);
  b.rod(S, 0, 0, 0, 0, -0.08, 0.02, 0.006, 5).rod(S, 0, -0.08, 0.02, 0, -0.05, 0.06, 0.006, 5);
  const SH = -0.215; // the shoulder line (pivot space): the sleeves' own pivot
  const part = part5(b, L, name, 0, -0.06, 0.04, (p) => {
    // the hanger: hook over the peg, neck, arms inside the shoulders
    p.torus(S, 0, -0.025, 0, 0.022, 0.004, 'z', 10);
    p.rod(S, 0, -0.045, 0, 0, -0.1, 0, 0.004, 5);
    for (const s of [-1, 1]) p.rod(S, 0, -0.1, 0, s * 0.2, -0.175, 0, 0.006, 5);
    // collar (stand-up, open) and the body (capped inside at the collar's base)
    p.geo(Y, drapeGeo([{ c: [0, -0.085, 0.004], rx: 0.07, rz: 0.06 }, { c: [0, -0.13, 0.002], rx: 0.078, rz: 0.068 }], 20, 3), 'box');
    p.geo(Y, drapeGeo([
      { c: [0, -0.125, 0], rx: 0.08, rz: 0.07 },
      { c: [0, -0.15, 0], rx: 0.165, rz: 0.1 },
      { c: [0, -0.185, 0], rx: 0.215, rz: 0.118 },
      { c: [0, -0.24, 0], rx: 0.245, rz: 0.13, fold: 0.003, nf: 5 },
      { c: [0, -0.4, 0.003], rx: 0.24, rz: 0.138, fold: 0.007, nf: 7, ph: 0.4 },
      { c: [0, -0.62, 0.006], rx: 0.245, rz: 0.142, fold: 0.012, nf: 8, ph: 0.9 },
      { c: [0.004, -0.88, 0.008], rx: 0.262, rz: 0.15, fold: 0.019, nf: 9, ph: 1.3 },
      { c: [0.008, -1.12, 0.01], rx: 0.282, rz: 0.158, fold: 0.026, nf: 9, ph: 1.6 },
      { c: [0.012, -1.3, 0.012], rx: 0.298, rz: 0.165, fold: 0.031, nf: 10, ph: 1.9 },
      { c: [0.012, -1.355, 0.012], rx: 0.3, rz: 0.166, fold: 0.031, nf: 10, ph: 2.0 },
    ], 36, 7, { top: 0.012 }), 'box');
    // the hood, empty, hanging down the back from the collar (a soft peaked bag against the back)
    p.geo(Y, drapeGeo([
      // (it starts BELOW the shoulder line at the back: seen from the front, nothing rises above the collar but the hook)
      { c: [0, -0.15, -0.09], rx: 0.07, rz: 0.03 },
      { c: [0, -0.23, -0.155], rx: 0.14, rz: 0.055, fold: 0.006, nf: 4 },
      { c: [0.005, -0.35, -0.175], rx: 0.155, rz: 0.06, fold: 0.01, nf: 5, ph: 1 },
      { c: [0.01, -0.47, -0.17], rx: 0.12, rz: 0.05, fold: 0.008, nf: 4, ph: 2 },
      { c: [0.015, -0.54, -0.155], rx: 0.045, rz: 0.02 },
    ], 20, 11, { bottom: 0.03 }), 'box');
    // placket, toggles, pocket flaps (on the front, following the drape)
    p.rbox(Y, 0.006, -0.73, 0.15, 0.05, 1.18, 0.012, 0, 0, 0.01);
    for (let k = 0; k < 4; k++) p.cyl('painted_dark', 0.006, -0.3 - k * 0.22, 0.158, 0.013, 0.012, 'z', 8);
    for (const s of [-1, 1]) p.rbox(Y, s * 0.15, -0.82, 0.155, 0.17, 0.07, 0.014, -0.08, 0, s * 0.12);
  });
  // the sleeves on their own pivot at the shoulder line (they lag the swing)
  const sl = L.part(`${name}:sleeves`);
  for (const s of [-1, 1]) {
    const A: [number, number, number] = [s * 0.225, -0.02, 0.0], B: [number, number, number] = [s * 0.3, -0.79, 0.045];
    const at = (k: number, r: number, f = 0, ph = 0): DRing => ({ c: [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k], rx: r, rz: r * 0.92, fold: f, nf: 5, ph });
    sl.geo(Y, drapeGeo([at(0, 0.07), at(0.12, 0.078, 0.003), at(0.35, 0.074, 0.006, 1), at(0.5, 0.079, 0.01, 2), at(0.58, 0.072, 0.006, 3), at(0.8, 0.068, 0.006, 4), at(0.96, 0.064, 0.004, 5), at(1, 0.07)], 16, 17 + s, { top: 0.0, bottom: 0.02 }), 'box');
  }
  const sPivot = new THREE.Group();
  sPivot.name = `${name}:sleeves`;
  sPivot.position.set(0, SH, 0);
  sPivot.add(sl.build());
  part.pivot.add(sPivot);

  let sway = false, st = 0;
  const env = (t: number) => smooth(t / 0.35) * Math.exp(-0.75 * Math.max(0, t));
  const swingZ = (t: number) => 0.6 * Math.sin((2 * PI * t) / 2.3) * env(t);
  const swingY = (t: number) => 0.45 * Math.sin((2 * PI * t) / 1.7) * env(t);
  const swingAt = (t: number) => {
    part.pivot.rotation.set(0, swingY(t), swingZ(t), 'YXZ');
    // the sleeves trail the shoulders by ~0.2 s and swing out on the turn
    sPivot.rotation.set(0.25 * (swingY(Math.max(0, t - 0.15)) - swingY(t)), 0, 0.8 * (swingZ(Math.max(0, t - 0.2)) - swingZ(t)), 'XYZ');
  };
  const DUR = 4.2, tl = timeline(L, DUR, swingAt);
  L.updaters.push((dt) => {
    if (!sway || tl.playing) return;
    st += dt;
    part.pivot.rotation.set(0, 0.06 * Math.sin(st * 1.9), 0.05 * Math.sin((2 * PI * st) / 2.3), 'YXZ');
    sPivot.rotation.set(0, 0, 0.02 * Math.sin((2 * PI * st) / 2.3) - 0.02 * Math.sin((2 * PI * (st - 0.2)) / 2.3), 'XYZ');
  });
  return { ...part, swing() { sway = true; st = 0; tl.play(0); return { dur: DUR, creak: 0.35 }; }, sway(on) { sway = on; }, at(t) { tl.at(t); }, snap() { tl.at(DUR); sway = true; } };
}

/**
 * Sinks with mirror (§2.6 heads5: 4 sinks + mirror on the west wall; `mk5_taps` (12.4, 1.0, 1.0)). Wall prop (back at z
 * 0), `n` (4) basins at `pitch` (0.85) in a stainless counter `d` (0.55) at `top` (0.85) with a front apron, waste
 * traps under, pillar taps whose spouts end `spoutH` (0.13; IB5c: a tall swan-neck tap at 0.3 — its stream reads over the
 * counter front from across the room) above the counter over each basin, a full-width mirror (chrome)
 * 1.15 … 1.95, and the mirror's LIGHT STRIP above it (its own emissive, 0.35 — flicker it for `v5_water`, or pass
 * `light`). Returns `spouts` (world tip of each tap) and `light`. Calls: 2 (stainless + chrome) + 1 (light strip).
 * Collider: the counter (`collide`).
 */
export function sinkRow(b: Builder, L: LevelBuild, o: { n?: number; pitch?: number; d?: number; top?: number; spoutH?: number; light?: THREE.MeshStandardMaterial; collide?: boolean } = {}): { spouts: THREE.Vector3[]; light: THREE.MeshStandardMaterial } {
  const n = o.n ?? 4, p = o.pitch ?? 0.85, d = o.d ?? 0.55, top = o.top ?? 0.85, S: Mat = 'stainless', C: Mat = 'chrome', len = n * p;
  const bw = 0.42, bd = 0.3, bz0 = 0.14, bz1 = bz0 + bd, t = 0.03, e = Math.max(0, (o.spoutH ?? 0.13) - 0.13);
  const xs = Array.from({ length: n }, (_, i) => -len / 2 + (i + 0.5) * p);
  b.bx(S, -len / 2, top - t, 0, len / 2, top, bz0);
  b.bx(S, -len / 2, top - t, bz1, len / 2, top, d);
  let px = -len / 2;
  for (const x of xs) { b.bx(S, px, top - t, bz0, x - bw / 2, top, bz1); px = x + bw / 2; }
  b.bx(S, px, top - t, bz0, len / 2, top, bz1);
  b.bx(S, -len / 2, top - 0.16, d - 0.02, len / 2, top - t, d); // apron
  b.bx(S, -len / 2, top, 0, len / 2, top + 0.12, 0.012); // splashback
  const spouts: THREE.Vector3[] = [];
  for (const x of xs) {
    // bowl: four walls inside the hole + a bottom (each face once)
    b.bx(S, x - bw / 2, top - 0.17, bz0, x - bw / 2 + 0.008, top - t, bz1).bx(S, x + bw / 2 - 0.008, top - 0.17, bz0, x + bw / 2, top - t, bz1);
    b.bx(S, x - bw / 2 + 0.008, top - 0.17, bz0, x + bw / 2 - 0.008, top - t, bz0 + 0.008).bx(S, x - bw / 2 + 0.008, top - 0.17, bz1 - 0.008, x + bw / 2 - 0.008, top - t, bz1);
    b.bx(S, x - bw / 2 + 0.008, top - 0.17, bz0 + 0.008, x + bw / 2 - 0.008, top - 0.16, bz1 - 0.008);
    b.detail(() => {
      b.cyl(C, x, top - 0.158, (bz0 + bz1) / 2, 0.025, 0.004, 'y', 10);
      b.cyl(C, x, top - 0.3, (bz0 + bz1) / 2, 0.02, 0.26, 'y', 8); // waste
      b.torus(C, x, top - 0.43, (bz0 + bz1) / 2 - 0.05, 0.05, 0.018, 'x', 10);
      b.rod(C, x, top - 0.43, (bz0 + bz1) / 2 - 0.1, x, top - 0.43, 0.0, 0.02, 8);
      // pillar tap behind the bowl, spout arching forward over it
      b.cyl(C, x, top + (0.12 + e) / 2, 0.07, 0.018, 0.12 + e, 'y', 10);
      b.rod(C, x, top + 0.12 + e, 0.07, x, top + 0.17 + e, 0.12, 0.012, 6);
      b.rod(C, x, top + 0.17 + e, 0.12, x, top + 0.15 + e, 0.24, 0.011, 6);
      b.cyl(C, x, top + 0.14 + e, 0.24, 0.013, 0.02, 'y', 8);
      for (const s of [-1, 1]) b.rbox(C, x + s * 0.07, top + 0.11, 0.07, 0.07, 0.015, 0.02, 0, 0, s * 0.3);
    });
    spouts.push(b.world(x, top + 0.13 + e, 0.24));
  }
  b.bx(C, -len / 2 + 0.05, 1.15, 0, len / 2 - 0.05, 1.95, 0.012);
  const light = o.light ?? newLens(L, 'white', 0.35);
  if (!o.light) light.name = 'k5_mirror_light';
  b.bx(S, -len / 2 + 0.05, 1.98, 0, len / 2 - 0.05, 2.06, 0.09);
  b.detail(() => b.bx(light, -len / 2 + 0.1, 1.966, 0.01, len / 2 - 0.1, 1.98, 0.08));
  if (o.collide !== false) b.collide(-len / 2, top - 0.16, 0, len / 2, top, d, 'metal', true);
  return { spouts, light };
}

/**
 * Shower stalls (§2.6 heads5: 3 stalls on the east wall). Wall prop (back at z 0), `n` (3) stalls `w` (0.9) wide × `d`
 * (0.95) deep × `h` (2.0) partitions (shared between neighbours — each panel built once), a low kerb at the front, a
 * tray and a drain grate per stall, a riser pipe and head at 1.95, a mixer valve, a curtain on a front rail per stall
 * (`curtains[i]` open fraction, default [0.2, 1, 0.6]). Returns `heads` (world points of the shower heads). Calls: 2
 * (plastic_white, double-sided + chrome). Collider: partitions.
 */
export function showerStalls(b: Builder, L: LevelBuild, o: { n?: number; w?: number; d?: number; h?: number; curtains?: number[]; collide?: boolean } = {}): { heads: THREE.Vector3[] } {
  const n = o.n ?? 3, w = o.w ?? 0.9, d = o.d ?? 0.95, h = o.h ?? 2.0, P = L.doubleSided('plastic_white'), C: Mat = 'chrome', len = n * w;
  const curt = o.curtains ?? [0.2, 1, 0.6];
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + i * w;
    b.bx(P, x - 0.015, 0.12, -0.01, x + 0.015, h, d); // (1 cm into the wall: no face on the wall plane)
    if (o.collide !== false) b.collide(x - 0.015, 0, 0, x + 0.015, h, d, 'metal', true);
  }
  const heads: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * w + 0.015, x1 = x0 + w - 0.03, cx = (x0 + x1) / 2;
    b.bx(P, x0, -0.01, d - 0.05, x1, 0.06, d); // kerb
    b.bx(P, x0, -0.01, -0.01, x1, 0.02, d - 0.04); // tray (sunk 1 cm into deck, wall and kerb: no shared faces)
    b.detail(() => {
      b.cyl(C, cx, 0.022, d / 2, 0.06, 0.004, 'y', 14);
      b.rod(C, cx + 0.2, 0.9, 0.03, cx + 0.2, 1.95, 0.03, 0.012, 6);
      b.rod(C, cx + 0.2, 1.95, 0.03, cx, 1.95, 0.2, 0.01, 6);
      b.cyl(C, cx, 1.93, 0.2, 0.06, 0.03, 'y', 14, 0.04);
      b.cyl(C, cx + 0.2, 1.05, 0.03, 0.05, 0.05, 'z', 12);
      b.rbox(C, cx + 0.2, 1.05, 0.065, 0.1, 0.015, 0.02, 0, 0, 0.4);
    });
    heads.push(b.world(cx, 1.91, 0.2));
    // curtain rail + curtain
    b.rod(C, x0, h - 0.05, d + 0.02, x1, h - 0.05, d + 0.02, 0.01, 6);
    const k = clamp01(curt[i] ?? 0.5), cw = Math.max(0.15, (w - 0.05) * (1 - 0.82 * k)), chh = h - 0.3;
    b.geo(P, curtainGeo(+cw.toFixed(2), +chh.toFixed(2), Math.round(4 + k * 8), 0.015 + k * 0.025), 'box', new THREE.Matrix4().makeTranslation(x1 - cw / 2, 0.22 + chh / 2, d + 0.03));
  }
  return { heads };
}

/**
 * Small floor drain grate (showers, galley, heads). Floor prop, origin = centre: a `w` (0.25) square frame 6 mm proud and
 * bars. Calls: 1 (steel_raw). No collider.
 */
export function drainGrate(b: Builder, L: LevelBuild, o: { w?: number } = {}) {
  const w = o.w ?? 0.25, S: Mat = 'steel_raw';
  b.detail(() => {
    for (const s of [-1, 1]) { b.bx(S, -w / 2, 0, s * w / 2 - (s > 0 ? 0.02 : 0), w / 2, 0.006, s * w / 2 + (s < 0 ? 0.02 : 0)); b.bx(S, s * w / 2 - (s > 0 ? 0.02 : 0), 0, -w / 2 + 0.02, s * w / 2 + (s < 0 ? 0.02 : 0), 0.006, w / 2 - 0.02); }
    for (let x = -w / 2 + 0.045; x < w / 2 - 0.03; x += 0.025) b.bx(S, x - 0.004, 0, -w / 2 + 0.02, x + 0.004, 0.005, w / 2 - 0.02);
  });
}

/**
 * Floor drain grille that LIFTS (sub-bay `drain5_a` / `drain5_b`, 1.0 × 1.0 voids, y −1.0 … 0; vignettes `drain5_a/b`
 * lift it for the spawns). Kit 4's `sumpGrille` with level-5 defaults (`w` 1.0, `d` 1.0, `depth` 0.95: the pit lining
 * stays 2 cm inside the void, never coplanar with it). Floor prop, origin = centre of the opening; `lift(k)`.
 * Calls: 2 static (steel_raw + painted_dark) + 1 moving. No colliders (the greybox owns the walk surface).
 */
export function drainGrille(b: Builder, L: LevelBuild, o: { w?: number; d?: number; depth?: number; name?: string } = {}): SumpHatch {
  return sumpGrille(b, L, { w: o.w ?? 1.0, d: o.d ?? 1.0, depth: o.depth ?? 0.95, name: o.name ?? 'drain5_grille' });
}

// ═════════════════════════════════════════════════════════════ SUB BAY

/**
 * Gallery deck segment (§2.6 sub5: galleries at y 4.8 — west x 22.2 … 25.0, east 43.0 … 45.8, north z −21.0 … −18.2,
 * the bridge z −36 … −34 — "merged per side": build each side in ONE call into its zone) in the BUILDER's frame: x0…x1
 * / z0…z1 at deck `y` (4.8): a `grating` deck (solid collider slab), a 0.2 m fascia channel along each `rails` edge,
 * cross beams every 1.5 m spanning the short side, knee braces down to the `wall` side (if given), 1.1 m handrails with
 * toe boards on the `rails` edges except where `parapets` [edge, u0, u1] (u = x along ±z edges, z along ±x edges) stand —
 * solid 1.1 m steel plates with a capping channel (LOW cover, colliding) — and emergency strips (`strips`, channel
 * 'emerg') 0.1 m inside each rail edge. Calls: 2 (deck_grate + navy_grey) + the shared strip. Colliders: deck, rails,
 * parapets.
 */
export function galleryDeck(b: Builder, L: LevelBuild, o: { x0: number; x1: number; z0: number; z1: number; y?: number; rails?: WallFace[]; parapets?: [WallFace, number, number][]; wall?: WallFace; strips?: StripChannel | null; collide?: boolean }) {
  const x0 = Math.min(o.x0, o.x1), x1 = Math.max(o.x0, o.x1), z0 = Math.min(o.z0, o.z1), z1 = Math.max(o.z0, o.z1), y = o.y ?? 4.8, N: Mat = 'navy_grey';
  const rails = o.rails ?? [], paras = o.parapets ?? [];
  grating(b, L, { x0, z0, x1, z1, y, frame: rails, frameMat: N, collide: o.collide });
  const alongX = x1 - x0 >= z1 - z0; // long axis
  // cross beams spanning the short side
  if (alongX) for (let x = x0 + 0.3; x < x1 - 0.1; x += 1.5) b.bx(N, x - 0.05, y - 0.22, z0, x + 0.05, y - 0.04, z1);
  else for (let z = z0 + 0.3; z < z1 - 0.1; z += 1.5) b.bx(N, x0, y - 0.22, z - 0.05, x1, y - 0.04, z + 0.05);
  if (o.wall) b.detail(() => {
    const span = alongX ? z1 - z0 : x1 - x0;
    const at = (u: number) => {
      // diagonal strut from the wall 1.0 m down to mid-span under the beam
      if (o.wall === '+z' || o.wall === '-z') { const zw = o.wall === '+z' ? z1 : z0, s = o.wall === '+z' ? -1 : 1; b.rod(N, u, y - 1.1, zw, u, y - 0.22, zw + s * span * 0.55, 0.035, 6); }
      else { const xw = o.wall === '+x' ? x1 : x0, s = o.wall === '+x' ? -1 : 1; b.rod(N, xw, y - 1.1, u, xw + s * span * 0.55, y - 0.22, u, 0.035, 6); }
    };
    if (alongX) for (let x = x0 + 0.3; x < x1 - 0.1; x += 3.0) at(x); else for (let z = z0 + 0.3; z < z1 - 0.1; z += 3.0) at(z);
  });
  for (const f of rails) {
    const isZ = f === '+z' || f === '-z', fixed = f === '+z' ? z1 : f === '-z' ? z0 : f === '+x' ? x1 : x0, s = f === '+z' || f === '+x' ? 1 : -1;
    const a = isZ ? x0 : z0, c = isZ ? x1 : z1, inset = 0.05;
    // fascia channel (outside face at the edge)
    if (isZ) b.bx(N, x0, y - 0.24, Math.min(fixed, fixed - s * 0.012), x1, y - 0.03, Math.max(fixed, fixed - s * 0.012));
    else b.bx(N, Math.min(fixed, fixed - s * 0.012), y - 0.24, z0, Math.max(fixed, fixed - s * 0.012), y - 0.03, z1);
    // rail runs between parapets
    const ps = paras.filter((p) => p[0] === f).map((p) => [Math.max(a, Math.min(p[1], p[2])), Math.min(c, Math.max(p[1], p[2]))] as [number, number]).sort((p, q) => p[0] - q[0]);
    let u = a;
    const runs: [number, number][] = [];
    for (const [p0, p1] of ps) { if (p0 > u + 0.05) runs.push([u, p0]); u = Math.max(u, p1); }
    if (c > u + 0.05) runs.push([u, c]);
    const line = fixed - s * inset;
    for (const [r0, r1] of runs) rail(b, L, { pts: isZ ? [[r0, line], [r1, line]] : [[line, r0], [line, r1]], y, h: 1.1, toe: true, mat: N, collide: o.collide });
    for (const [p0, p1] of ps) {
      const t0 = line - s * 0.012, t1 = line + s * 0.008;
      if (isZ) { b.bx(N, p0, y - 0.045, Math.min(t0, t1), p1, y + 1.06, Math.max(t0, t1)); b.bx(N, p0 - 0.01, y + 1.06, line - 0.04, p1 + 0.01, y + 1.1, line + 0.04); }
      else { b.bx(N, Math.min(t0, t1), y - 0.045, p0, Math.max(t0, t1), y + 1.06, p1); b.bx(N, line - 0.04, y + 1.06, p0 - 0.01, line + 0.04, y + 1.1, p1 + 0.01); }
      b.detail(() => { for (let v = p0 + 0.5; v < p1 - 0.2; v += 1.0) { if (isZ) b.bx(N, v - 0.005, y + 0.05, Math.min(line - s * 0.012, line - s * 0.07), v + 0.005, y + 1.0, Math.max(line - s * 0.012, line - s * 0.07)); else b.bx(N, Math.min(line - s * 0.012, line - s * 0.07), y + 0.05, v - 0.005, Math.max(line - s * 0.012, line - s * 0.07), y + 1.0, v + 0.005); } });
      if (o.collide !== false) { if (isZ) b.collide(p0, y, line - 0.04, p1, y + 1.1, line + 0.04, 'metal', true); else b.collide(line - 0.04, y, p0, line + 0.04, y + 1.1, p1, 'metal', true); }
    }
    if (o.strips !== null) { const sl = fixed - s * 0.14; if (isZ) strip5(b, L, a + 0.1, sl, c - 0.1, sl, { y: y + 0.01, ch: o.strips ?? 'emerg', channel: N }); else strip5(b, L, sl, a + 0.1, sl, c - 0.1, { y: y + 0.01, ch: o.strips ?? 'emerg', channel: N }); }
  }
}

/** A stair as W4 builds it (`StairDef` of `l3/grey.ts` + 3c's `y0`): treads from z0 along `dir`, `risers` × `rise` / `tread`. */
export interface StairSpec { x0: number; x1: number; z0: number; dir: 1 | -1; risers: number; rise: number; tread: number; y0?: number }
/**
 * Stair dressing for a W4 stair (sub-bay `STAIR5_W` / `STAIR5_E`, the crawl and magazine stairs): a nosing strip on
 * every tread's nose (channel `nosing`: 'emerg' in the bay — lit at lights-out —, 'red' in the crawl / magazine; null =
 * none), sloped stringer plates both sides just outside the treads, and handrails (`rails`, 1.0 m over the nosing line)
 * on posts every 4 treads. Builder-frame coordinates (pass the StairDef as is). Calls: 1 (navy_grey) + the shared strip.
 * No collider (W4's stair has them; add `rail` colliders yourself where a side is open over a drop).
 */
export function stairDressing(b: Builder, L: LevelBuild, o: { stair: StairSpec; nosing?: StripChannel | null; rails?: 'both' | '+x' | '-x' | 'none'; stringers?: boolean }) {
  const s = o.stair, y0 = s.y0 ?? 0, N: Mat = 'navy_grey', ch = o.nosing === undefined ? 'emerg' : o.nosing;
  const zAt = (k: number) => s.z0 + s.dir * s.tread * k, top = (k: number) => y0 + s.rise * (k + 1);
  if (ch) for (let k = 0; k < s.risers; k++) { const zn = zAt(k) + s.dir * 0.045; strip5(b, L, s.x0 + 0.08, zn, s.x1 - 0.08, zn, { y: top(k), ch, channel: N }); }
  const za = zAt(0), zb = zAt(s.risers), ya = y0, yb = y0 + s.rise * s.risers, run = Math.abs(zb - za), slope = Math.atan2(yb - ya, run);
  const len = Math.hypot(run, yb - ya), cz = (za + zb) / 2, cy = (ya + yb) / 2;
  const sides = o.rails ?? 'both';
  for (const side of [-1, 1]) {
    const x = side < 0 ? s.x0 - 0.012 : s.x1 + 0.012;
    if (o.stringers !== false) b.rbox(N, x, cy + 0.05, cz, 0.02, 0.34, len + 0.2, s.dir > 0 ? -slope : slope, 0, 0);
    if (sides === 'none' || (sides === '+x' && side < 0) || (sides === '-x' && side > 0)) continue;
    const xr = side < 0 ? s.x0 + 0.05 : s.x1 - 0.05;
    for (let k = 0; k < s.risers; k += 4) { const z = zAt(k) + s.dir * s.tread * 0.5; b.cyl(N, xr, top(k) + 0.5, z, 0.022, 1.0, 'y', 8); }
    const zl = zAt(s.risers - 1) + s.dir * s.tread * 0.5;
    b.cyl(N, xr, top(s.risers - 1) + 0.5, zl, 0.022, 1.0, 'y', 8);
    b.rod(N, xr, top(0) + 1.0, zAt(0) + s.dir * s.tread * 0.5, xr, top(s.risers - 1) + 1.0, zl, 0.024, 8);
    b.rod(N, xr, top(0) + 0.5, zAt(0) + s.dir * s.tread * 0.5, xr, top(s.risers - 1) + 0.5, zl, 0.016, 6);
  }
}

/**
 * Cradle-side equipment box (§2.6 sub5 EW1/EW2 x 30.4 … 31.6 and EE1/EE2 x 36.4 … 37.6, z −33.0 … −31.0 / −41.0 … −39.0,
 * h 1.3, LOW cover `cv5_f14`–`f17` at their outer faces — S1b). Floor prop, origin = floor centre, `len` (2.0, local x)
 * × `d` (1.2, z) × `h` (1.3), FRONT +z = a long side with double doors (EW: ry π/2 → front +x, toward the cradle; EE: ry
 * −π/2): a yellow skid with fork pockets, a haze-grey steel cabinet, a lid flush at `h` (nothing stands above it),
 * yellow corner guards, T-handles, louvres, lifting eyes on the side faces, stencils (`label`). Calls: 2 (navy_grey +
 * painted_yellow) + atlas. Collider: exactly `len` × `d` × `h`.
 */
export function equipmentBox(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; label?: string; collide?: boolean } = {}) {
  const len = o.len ?? 2.0, d = o.d ?? 1.2, h = o.h ?? 1.3, N: Mat = 'navy_grey', Y: Mat = 'painted_yellow';
  for (const x of [-len / 2, -0.08, len / 2 - 0.16]) b.bx(Y, x, 0, -d / 2, x + 0.16, 0.13, d / 2); // skid runners (fork pockets between)
  b.bx(Y, -len / 2, 0.13, -d / 2, len / 2, 0.16, d / 2);
  b.bx(N, -len / 2 + 0.02, 0.16, -d / 2 + 0.02, len / 2 - 0.02, h - 0.03, d / 2 - 0.02);
  b.bx(N, -len / 2, h - 0.03, -d / 2, len / 2, h, d / 2); // lid
  // doors on the front (+z), 1 cm proud
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -len / 2 + 0.1 : 0.01, xb = s < 0 ? -0.01 : len / 2 - 0.1;
    b.bx(N, xa, 0.22, d / 2 - 0.02, xb, h - 0.1, d / 2 - 0.01);
    b.detail(() => {
      for (let k = 0; k < 5; k++) b.bx(N, xa + 0.12, h - 0.4 + k * 0.05, d / 2 - 0.01, xb - 0.12, h - 0.38 + k * 0.05, d / 2 + 0.002);
      const hx = s < 0 ? xb - 0.08 : xa + 0.08;
      b.cyl(Y, hx, 0.7, d / 2 + 0.01, 0.025, 0.04, 'z', 8); b.bx(Y, hx - 0.012, 0.62, d / 2 + 0.02, hx + 0.012, 0.78, d / 2 + 0.04);
      for (const yy of [0.35, h - 0.25]) b.cyl(N, s < 0 ? xa - 0.015 : xb + 0.015, yy, d / 2 - 0.01, 0.015, 0.1, 'y', 8);
    });
  }
  // yellow corner guards (1.2 cm proud) and side lifting eyes
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(Y, Math.min(sx * len / 2 - sx * 0.08, sx * len / 2 + sx * 0.012), 0.16, Math.min(sz * d / 2 - sz * 0.08, sz * d / 2 + sz * 0.012), Math.max(sx * len / 2 - sx * 0.08, sx * len / 2 + sx * 0.012), h - 0.03, Math.max(sz * d / 2 - sz * 0.08, sz * d / 2 + sz * 0.012));
  b.detail(() => { for (const sx of [-1, 1]) for (const sz of [-0.3, 0.3]) b.torus(Y, sx * (len / 2 + 0.02), h - 0.12, sz * d, 0.04, 0.01, 'x', 10); });
  navySign(b, o.label ?? '턴 — 지지대 1', 0, h - 0.06, d / 2 + 0.001, 0.9, 0.07, '+z');
  navySign(b, '밟지 마세요', -len / 2 + 0.3, h + 0.001, 0, 0.36, 0.08, '+y');
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'metal', true);
}

/**
 * Dock forklift with an enclosed steel cab and a load (§2.6 sub5: x 37.6 … 39.0, z −28.0 … −25.6, h 2.2, HIGH cover
 * `cv5_f11` (west face) / `f12` (south face) → origin (38.3, 0, −26.8), ry 0: forks toward −25.6). Floor prop, origin =
 * floor centre of the footprint `w` 1.4 (x) × 2.4 (z), FRONT +z = mast + forks: counterweight at the rear, an enclosed
 * cab (solid steel sides with a porthole, a dark windscreen and rear window, roof at 2.2), the mast to 2.2, and a
 * pallet + tall case on the forks to 1.75. Honest collider: chassis + cab x ±0.7, z −1.2 … 0.2 to 2.2; mast + load
 * z 0.2 … 1.2 to 1.75 (uprights to 2.2). Calls: 2 (painted_yellow + painted_dark) + atlas.
 */
export function forklift(b: Builder, L: LevelBuild, o: { load?: boolean; collide?: boolean } = {}) {
  const Y: Mat = 'painted_yellow', K: Mat = 'painted_dark', W = 0.7;
  // wheels
  for (const z of [-0.85, 0.02]) for (const s of [-1, 1]) { b.cyl(K, s * 0.56, 0.28, z, 0.28, 0.2, 'x', 18); b.cyl(Y, s * 0.665, 0.28, z, 0.13, 0.012, 'x', 12); }
  b.bx(Y, -0.44, 0.14, -1.2, 0.44, 0.62, 0.2); // chassis
  for (const s of [-1, 1]) for (const [za, zb] of [[-1.15, -0.55], [-0.3, 0.2]] as const) b.bx(Y, Math.min(s * 0.44, s * W), 0.6, za, Math.max(s * 0.44, s * W), 0.64, zb); // fenders
  b.bx(Y, -W, 0.64, -1.2, W, 1.25, -0.72); // counterweight
  b.bx(Y, -W, 0.62, -0.72, W, 0.66, 0.2); // cab floor
  // cab: solid sides, rear wall over the counterweight, windscreen frame, roof
  for (const s of [-1, 1]) {
    b.bx(Y, Math.min(s * (W - 0.04), s * W), 0.66, -0.72, Math.max(s * (W - 0.04), s * W), 2.06, 0.2);
    b.bx(K, Math.min(s * W, s * (W + 0.01)), 1.3, -0.4, Math.max(s * W, s * (W + 0.01)), 1.75, -0.05); // side window (dark)
  }
  b.bx(Y, -W + 0.04, 1.25, -0.76, W - 0.04, 2.06, -0.72);
  b.bx(K, -0.45, 1.45, -0.77, 0.45, 1.9, -0.76);
  b.bx(Y, -W + 0.04, 0.66, 0.16, W - 0.04, 1.0, 0.2).bx(Y, -W + 0.04, 1.96, 0.16, W - 0.04, 2.06, 0.2);
  for (const s of [-1, 1]) b.bx(Y, Math.min(s * (W - 0.12), s * (W - 0.04)), 1.0, 0.16, Math.max(s * (W - 0.12), s * (W - 0.04)), 1.96, 0.2);
  b.bx(K, -W + 0.12, 1.0, 0.17, W - 0.12, 1.96, 0.19); // windscreen (dark)
  b.bx(Y, -W - 0.02, 2.06, -0.8, W + 0.02, 2.2, 0.24); // roof
  b.detail(() => {
    b.cyl(K, 0.45, 2.24, -0.6, 0.05, 0.08, 'y', 10); // beacon base
    b.bx(K, -0.3, 1.25, -1.22, 0.3, 1.0 - 0.0, -1.2); // tow pin plate (rear)
    b.cyl(K, 0, 0.9, -1.22, 0.04, 0.06, 'z', 8);
    b.bx(K, Math.min(W, W + 0.012), 0.75, -0.55, Math.max(W, W + 0.012), 0.9, -0.3); // step
  });
  // mast
  for (const s of [-1, 1]) { b.bx(K, s * 0.32 - (s > 0 ? 0 : 0.1), 0.1, 0.2, s * 0.32 + (s > 0 ? 0.1 : 0), 2.17, 0.32); b.rod(K, s * 0.3, 0.8, 0.18, s * 0.3, 1.2, 0.26, 0.03, 8); }
  for (const y of [0.15, 1.15, 2.15]) b.bx(K, -0.32, y - 0.04, 0.22, 0.32, y + 0.04, 0.3);
  b.bx(K, -0.55, 0.25, 0.32, 0.55, 0.75, 0.38); // carriage
  b.detail(() => { for (let x = -0.5; x <= 0.51; x += 0.125) b.bx(K, x - 0.012, 0.75, 0.33, x + 0.012, 1.3, 0.36); b.bx(K, -0.55, 1.28, 0.33, 0.55, 1.32, 0.37); });
  for (const s of [-1, 1]) { b.bx(K, s * 0.25 - 0.05, 0.25, 0.38, s * 0.25 + 0.05, 0.3, 1.2); b.bx(K, s * 0.25 - 0.05, 0.3, 0.38, s * 0.25 + 0.05, 0.7, 0.42); }
  if (o.load !== false) {
    b.bx(K, -0.56, 0.3, 0.44, 0.56, 0.42, 1.18); // pallet
    b.bx(K, -0.52, 0.42, 0.46, 0.52, 1.75, 1.16); // case
    b.detail(() => { for (const y of [0.8, 1.4]) b.bx(K, -0.53, y - 0.02, 0.45, 0.53, y + 0.02, 1.17); });
    navySign(b, 'SDV 예비품 — 1/3', 0, 1.1, 1.161, 0.7, 0.1, '+z');
  }
  navySign(b, 'FLT 04', W + 0.005, 1.6, -0.95, 0.3, 0.12, '+x');
  if (o.collide !== false) {
    b.collide(-W, 0, -1.2, W, 2.2, 0.2, 'metal', true);
    b.collide(-0.6, 0, 0.2, 0.6, o.load !== false ? 1.75 : 0.75, 1.2, 'metal', true);
    for (const s of [-1, 1]) b.collide(s * 0.32 - (s > 0 ? 0 : 0.1), 0, 0.2, s * 0.32 + (s > 0 ? 0.1 : 0), 2.2, 0.32, 'metal', true);
  }
}

/**
 * Gas bottle rack (§2.6 sub5: x 38.4 … 40.4, z −52.4 … −51.6, h 1.8, HIGH cover `cv5_f13` at its north face → origin
 * (39.4, 0, −52.0), ry π: front −z... pick the front as you need; both long faces are dense). Floor prop, origin = floor
 * centre, `len` (2.0, x) × `d` (0.8) × `h` (1.8): a yellow frame (base, posts, top rails, a mesh back), two restraint
 * chains across the front, two rows of ⌀ 0.23 bottles (1.5 m) with valve guards and shoulder bands, stencils. Calls: 2
 * (painted_yellow + bottle grey) + atlas. Collider: footprint to `h`.
 */
export function gasBottleRack(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; seed?: number; collide?: boolean } = {}) {
  const len = o.len ?? 2.0, d = o.d ?? 0.8, h = o.h ?? 1.8, Y: Mat = 'painted_yellow', G = tint5(L, 'gas_grey', 'painted_white', 0x6b7477, { roughness: 0.4 }), R = srand(o.seed ?? 13);
  b.bx(Y, -len / 2, 0, -d / 2, len / 2, 0.05, d / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(Y, sx * len / 2 - (sx > 0 ? 0.05 : 0), 0.05, sz * d / 2 - (sz > 0 ? 0.05 : 0), sx * len / 2 + (sx < 0 ? 0.05 : 0), h, sz * d / 2 + (sz < 0 ? 0.05 : 0));
  for (const sz of [-1, 1]) b.bx(Y, -len / 2 + 0.05, h - 0.05, sz * d / 2 - (sz > 0 ? 0.05 : 0), len / 2 - 0.05, h, sz * d / 2 + (sz < 0 ? 0.05 : 0));
  b.detail(() => {
    for (let x = -len / 2 + 0.15; x < len / 2 - 0.1; x += 0.15) b.bx(Y, x - 0.004, 0.05, -d / 2 + 0.01, x + 0.004, h - 0.05, -d / 2 + 0.018);
    for (const y of [0.6, 1.3]) for (const sz of [-1, 1]) for (let k = 0; k < 20; k++) b.torus(Y, -len / 2 + 0.07 + k * ((len - 0.14) / 19), y - Math.sin((k / 19) * PI) * 0.06, sz * (d / 2 + 0.01), 0.018, 0.004, 'x', 6);
  });
  const nr = Math.floor((len - 0.1) / 0.25);
  for (const [z, off] of [[-d / 4 + 0.02, 0], [d / 4 - 0.02, 0.125]] as const) for (let i = 0; i < nr - (off ? 1 : 0); i++) {
    const x = -len / 2 + 0.17 + off + i * 0.25, hh = 1.45 + R() * 0.06;
    b.cyl(G, x, 0.05 + hh / 2, z, 0.115, hh, 'y', 14);
    b.sphere(G, x, 0.05 + hh, z, 0.115, 12, 0.45);
    b.cyl(Y, x, 0.05 + hh - 0.08, z, 0.117, 0.1, 'y', 14);
    b.cyl(Y, x, 0.05 + hh + 0.09, z, 0.05, 0.1, 'y', 10);
  }
  navySign(b, '고압 가스 — 체인 2개로 고정', 0, 1.65, d / 2 + 0.012, 1.0, 0.08, '+z');
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'metal', true);
}

/** Amber rotating beacon (kit 4's `rotBeacon` with a level-5 name): `set(on)`, `bind` to the `alarm` light. Wall prop. */
export function rotBeacon(b: Builder, L: LevelBuild, o: { name?: string; intensity?: number; bind?: (m: THREE.MeshStandardMaterial) => void } = {}): Beacon {
  return rotBeacon4(b, L, { ...o, name: o.name ?? 'beacon5_dome' });
}

// ═════════════════════════════════════════════════════════════ DIVE LOCKER / TUNNEL

/**
 * Dive suits on hooks with hard hats on a shelf above (§2.6 dive5: 6 suits). Wall prop (back at z 0), `n` (6) at `pitch`
 * (0.6): a yellow hook rail at 1.95, empty black dry suits hanging from it (shoulders, torso, arms, legs, boots, neck
 * seal, chest valve) — person-sized, seeded hang — and a shelf at 2.3 with a yellow commercial dive helmet over each
 * (dark face port). Calls: 2 (rubber + painted_yellow). Collider: 0.4 deep to 2.4 (`collide`).
 */
export function diveSuits(b: Builder, L: LevelBuild, o: { n?: number; pitch?: number; seed?: number; collide?: boolean } = {}) {
  const n = o.n ?? 6, p = o.pitch ?? 0.6, R = srand(o.seed ?? 29), K: Mat = 'rubber', Y: Mat = 'painted_yellow', len = n * p;
  b.bx(Y, -len / 2, 1.93, 0, len / 2, 1.98, 0.04);
  b.bx(Y, -len / 2, 2.28, 0, len / 2, 2.3, 0.38);
  for (let i = 0; i <= n; i += Math.max(1, Math.floor(n / 3))) { const x = Math.min(len / 2 - 0.03, -len / 2 + i * p + 0.03); b.bx(Y, x - 0.015, 2.12, 0, x + 0.015, 2.28, 0.3); }
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * p;
    b.rod(Y, x, 1.95, 0.04, x, 1.92, 0.14, 0.008, 5);
    b.push(x, 1.88, 0.2, (R() - 0.5) * 0.3);
    b.bx(K, -0.21, -0.12, -0.1, 0.21, 0.0, 0.1); // shoulders
    b.bx(K, -0.19, -0.75, -0.11, 0.19, -0.12, 0.11); // torso
    b.cyl(K, 0, 0.0, 0, 0.07, 0.04, 'y', 10); // neck seal
    b.cyl(Y, 0.07, -0.25, 0.115, 0.03, 0.03, 'z', 8); // inflator valve
    for (const s of [-1, 1]) {
      b.rod(K, s * 0.2, -0.08, 0, s * (0.24 + R() * 0.04), -0.7, 0.03, 0.055, 8);
      b.rod(K, s * 0.09, -0.75, 0, s * 0.1, -1.55, 0.02 + R() * 0.03, 0.075, 8);
      b.bx(K, s * 0.1 - 0.06, -1.7, -0.04, s * 0.1 + 0.06, -1.55, 0.16); // boots
    }
    b.pop();
    // helmet on the shelf
    b.push(x, 2.3, 0.2, (R() - 0.5) * 0.4);
    b.sphere(Y, 0, 0.17, 0, 0.17, 14, 1.05, 0.95, 1.1);
    b.cyl(Y, 0, 0.03, 0, 0.15, 0.06, 'y', 14);
    b.cyl(K, 0, 0.17, 0.16, 0.08, 0.04, 'z', 14);
    b.detail(() => { b.torus(Y, 0, 0.17, 0.175, 0.085, 0.012, 'z', 14); for (const s of [-1, 1]) b.cyl(K, s * 0.15, 0.2, 0.02, 0.03, 0.05, 'x', 8); });
    b.pop();
  }
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, 2.4, 0.4, 'metal', true);
}

/**
 * Dry decompression chamber (§2.6 dive5: ⌀ 1.8, x 49 … 51.6, z −39.6 … −36.0 → origin (50.2, 0, −37.8), ry 0, panel at
 * +x). Floor prop, origin = floor centre, long axis local z (`len` 3.6), hull ⌀ `dia` (1.8) on two saddles, axis at
 * 1.05: domed ends, the entry door on the +z end (hinged disc, dogs, hand wheel, viewport), two side viewports, a
 * control panel on a stand at the `panel` side (+x) with gauges, pipework into the hull, stencils. Calls: 2
 * (painted_white + painted_dark) + atlas. Collider: hull box ±dia/2 to 1.95 + the panel.
 */
export function decompressionChamber(b: Builder, L: LevelBuild, o: { len?: number; dia?: number; panel?: '+x' | '-x'; collide?: boolean } = {}) {
  const len = o.len ?? 3.6, r = (o.dia ?? 1.8) / 2, W: Mat = 'painted_white', K: Mat = 'painted_dark', cy = r + 0.15, px = (o.panel ?? '+x') === '+x' ? 1 : -1;
  const body = len - 2 * r * 0.38;
  b.cyl(W, 0, cy, 0, r, body, 'z', 28);
  for (const s of [-1, 1]) b.sphere(W, 0, cy, s * body / 2, r, 24, 1, 1, 0.38);
  for (const z of [-len * 0.25, len * 0.25]) { b.bx(K, -r * 0.7, 0, z - 0.12, r * 0.7, 0.35, z + 0.12); b.cyl(K, 0, cy, z, r + 0.012, 0.1, 'z', 28); }
  // entry door on +z
  const ez = body / 2 + r * 0.38;
  b.cyl(K, 0, cy - 0.05, ez - 0.02, 0.42, 0.08, 'z', 22);
  b.cyl(W, 0, cy - 0.05, ez + 0.03, 0.38, 0.05, 'z', 22);
  b.detail(() => {
    b.torus(K, 0, cy - 0.05, ez + 0.12, 0.16, 0.014, 'z', 18);
    b.cyl(K, 0, cy - 0.05, ez + 0.08, 0.025, 0.08, 'z', 8);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * PI; b.bx(K, Math.cos(a) * 0.41 - 0.02, cy - 0.05 + Math.sin(a) * 0.41 - 0.02, ez - 0.03, Math.cos(a) * 0.41 + 0.02, cy - 0.05 + Math.sin(a) * 0.41 + 0.02, ez + 0.06); }
    b.cyl(K, 0.18, cy + 0.12, ez + 0.06, 0.055, 0.02, 'z', 12);
  });
  // side viewports (dark, ringed)
  for (const s of [-1, 1]) for (const z of [-0.5, 0.5]) { b.push(s * (r - 0.02), cy + 0.25, z, s * PI / 2); b.cyl(K, 0, 0, 0.02, 0.09, 0.05, 'z', 14); b.pop(); }
  // control panel on a stand
  b.push(px * (r + 0.32), 0, 0.2, px > 0 ? -PI / 2 : PI / 2);
  b.bx(K, -0.45, 0, -0.08, 0.45, 0.9, 0.08);
  b.rbox(K, 0, 1.15, 0.02, 0.9, 0.55, 0.12, -0.35, 0, 0);
  b.detail(() => { for (let k = 0; k < 4; k++) { b.push(-0.3 + k * 0.2, 1.15, 0.09, 0, -0.35, 0); b.cyl(W, 0, 0, 0, 0.06, 0.012, 'z', 14); b.pop(); } });
  b.pop();
  b.detail(() => { for (const z of [-0.3, 0.1]) b.rod(K, px * (r + 0.25), 1.0, z, px * (r * 0.75), cy + 0.5, z, 0.02, 6); });
  navySign(b, 'DDC 1 — 최대 50 MSW', 0, cy + 0.55, ez - 0.3, 0.8, 0.1, '+z');
  if (o.collide !== false) { b.collide(-r, 0, -len / 2, r, cy + r, len / 2, 'metal', true); b.collide(Math.min(px * r, px * (r + 0.5)), 0, -0.3, Math.max(px * r, px * (r + 0.5)), 1.45, 0.7, 'metal', true); }
}

/**
 * Cable tray along a wall (tunnel5 both walls, the spine). Wall prop, origin on the wall face at the tray's floor height;
 * runs along local x from −len/2 to len/2: brackets every 1.5 m, a ladder tray `w` (0.4) wide, `cables` (6) laid in it,
 * optional `led` lamps under the tray every 2 m (shared `lampLens5(led)`; the tunnel's "tray LEDs"). Calls: 2 (steel_raw
 * + rubber) + the shared lens. No collider (above head height).
 */
export function cableTray(b: Builder, L: LevelBuild, o: { len: number; w?: number; cables?: number; led?: LampColor | null; seed?: number }) {
  const len = o.len, w = o.w ?? 0.4, S: Mat = 'steel_raw', K: Mat = 'rubber', R = srand(o.seed ?? 19), nc = o.cables ?? 6;
  for (const z of [0.05, w + 0.05]) b.bx(S, -len / 2, 0, z - 0.004, len / 2, 0.08, z + 0.004);
  b.detail(() => { for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3) b.bx(S, x - 0.015, 0, 0.054, x + 0.015, 0.012, w + 0.046); });
  for (let x = -len / 2 + 0.3; x < len / 2; x += 1.5) { b.bx(S, x - 0.02, -0.25, 0, x + 0.02, 0.0, 0.015); b.rbox(S, x, -0.12, 0.2, 0.03, 0.02, 0.42, -0.55, 0, 0); b.bx(S, x - 0.02, -0.03, 0.015, x + 0.02, 0.0, w + 0.08); }
  for (let i = 0; i < nc; i++) { const r = 0.015 + R() * 0.02, z = 0.09 + (i / Math.max(1, nc - 1)) * (w - 0.08); b.cyl(K, 0, 0.012 + r, z, r, len, 'x', 8); }
  if (o.led) { const M = lampLens5(L, o.led); b.detail(() => { for (let x = -len / 2 + 1.0; x < len / 2; x += 2.0) b.bx(M, x - 0.04, -0.012, w - 0.1, x + 0.04, -0.03 + 0.0, w); }); }
}

/**
 * The trunk cable (§2.6 tunnel5: ⌀ 0.25, armoured, yellow bands, from the sub-bay wall west to `door5_headend`) along a
 * polyline `pts` (builder-frame [x, y, z]; give it a sag where it hangs), bands every `bands` (1.0) m.
 * Calls: 2 (rubber + painted_yellow). No collider (lay it beside the walkway or add one).
 */
export function trunkCable(b: Builder, L: LevelBuild, o: { pts: [number, number, number][]; r?: number; bands?: number }) {
  const r = o.r ?? 0.125, every = o.bands ?? 1.0, pts = o.pts;
  hose(b, 'rubber', pts, r, 12, 4);
  let next = every / 2, run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), c = new THREE.Vector3(...pts[i + 1]), seg = a.distanceTo(c), dir = c.clone().sub(a).normalize();
    for (; next < run + seg; next += every) {
      const p = a.clone().addScaledVector(dir, next - run);
      b.rod('painted_yellow', p.x - dir.x * 0.04, p.y - dir.y * 0.04, p.z - dir.z * 0.04, p.x + dir.x * 0.04, p.y + dir.y * 0.04, p.z + dir.z * 0.04, r + 0.01, 12);
    }
    run += seg;
  }
}

// ═════════════════════════════════════════════════════════════ VESSEL SHELL (IB5a, B1)

/** A wall of a rectangular compartment: x0 / x1 (the west / east wall faces), z0 / z1 (the south / north wall faces). */
export type VWall = 'x0' | 'x1' | 'z0' | 'z1';
export interface VesselRoom {
  /** Interior wall faces (room box ± 0.2 for the 0.4 m greybox walls) and the deckhead height. */
  x0: number; x1: number; z0: number; z1: number; h: number;
  /** The frames stand on the walls PARALLEL to this axis; the deck beams span across it. */
  axis: 'x' | 'z';
  /** Frame stations along the axis (world). Default: the spine's 3 m grid (≡ 0.5 mod 3), ≥ 0.45 m from the end walls. */
  at?: number[];
  /** Wall spans with no frame leg / stiffener (doors and their pockets, boards, shelves): [wall, from, to] along the wall. */
  clear?: [VWall, number, number][];
  /** Deck-beam depth (0.16). */
  web?: number;
  /** Deckhead longitudinals (flat bars) between the beams every `lon` m across the room (0.75; 0 = none). */
  lon?: number;
  /** Vertical stiffeners on the END bulkheads (the walls across the axis) every `stiff` m (1.5; 0 = none). */
  stiff?: number;
  /** A rubbing strip / stringer along the side walls at this height (null = none). */
  stringer?: number | null;
  /** Frame numbers painted on the second side wall's plating (the first station's number; null = none). */
  frameNo?: number | null;
  mat?: Mat;
}
/**
 * The inside of the hull for a compartment the greybox built as a box (B1: the gatehouse, duty, ready room, berths, heads,
 * mess and galley read as the spine and the sub bay do): transverse FRAMES at the spine's 3 m pitch — a T-section leg on
 * each side wall (web 0.11, face flange 0.09), a knee bracket into the deck beam, the DECK BEAM spanning the deckhead
 * (web `web`, flanged) — plus deckhead longitudinals (plate-and-beam deckhead), vertical stiffeners on the end
 * bulkheads, an optional stringer, painted frame numbers. A leg is dropped where `clear` spans a wall (the beam then
 * lands on a short header plate). Builder frame = world (zone builders). Visual only (no colliders, no shadow casting:
 * `detail`). Calls: 1 (`mat`, navy_grey — shared with the zone's other navy_grey detail) + the sign atlas.
 * Returns the stations (place ceiling fittings between them).
 */
export function vesselRoom(b: Builder, L: LevelBuild, o: VesselRoom): number[] {
  void L;
  const N: Mat = o.mat ?? 'navy_grey', web = o.web ?? 0.16, h = o.h, t = 0.012, fl = 0.045, dp = 0.11, kn = 0.36;
  const ax = o.axis, a0 = ax === 'x' ? o.x0 : o.z0, a1 = ax === 'x' ? o.x1 : o.z1, c0 = ax === 'x' ? o.z0 : o.x0, c1 = ax === 'x' ? o.z1 : o.x1;
  const st = o.at ?? (() => { const r: number[] = []; for (let s = Math.ceil((a0 + 0.45 - 0.5) / 3) * 3 + 0.5; s <= a1 - 0.45; s += 3) r.push(s); return r; })();
  const sideW: [VWall, VWall] = ax === 'x' ? ['z0', 'z1'] : ['x0', 'x1'];
  const endW: [VWall, VWall] = ax === 'x' ? ['x0', 'x1'] : ['z0', 'z1'];
  const clear = (w: VWall, u: number, half: number) => (o.clear ?? []).some(([cw, p, q]) => cw === w && u + half > Math.min(p, q) && u - half < Math.max(p, q));
  // a box in (along-axis a, up y, across c)
  const B = (aa0: number, y0: number, cc0: number, aa1: number, y1: number, cc1: number) => {
    if (ax === 'x') b.bx(N, Math.min(aa0, aa1), y0, Math.min(cc0, cc1), Math.max(aa0, aa1), y1, Math.max(cc0, cc1));
    else b.bx(N, Math.min(cc0, cc1), y0, Math.min(aa0, aa1), Math.max(cc0, cc1), y1, Math.max(aa0, aa1));
  };
  // a flat bar in the frame plane from (c, y) = (ca, ya) to (cb, yb), `w` wide along the axis
  const bar = (a: number, ca: number, ya: number, cb: number, yb: number, w: number) => {
    const dc = cb - ca, dy = yb - ya, len = Math.hypot(dc, dy), cm = (ca + cb) / 2, ym = (ya + yb) / 2;
    if (ax === 'x') b.rbox(N, a, ym, cm, w, t, len, Math.atan2(-dy, dc), 0, 0);
    else b.rbox(N, cm, ym, a, len, t, w, 0, 0, Math.atan2(dy, dc));
  };
  b.detail(() => {
    for (const s of st) {
      // the deck beam: web + bottom flange, wall to wall
      B(s - t / 2, h - web, c0, s + t / 2, h, c1);
      B(s - fl, h - web - t, c0 + 0.002, s + fl, h - web, c1 - 0.002);
      sideW.forEach((w, i) => {
        const sg = i === 0 ? 1 : -1, cw = i === 0 ? c0 : c1, ci = cw + sg * dp;
        if (clear(w, s, fl + 0.02)) {
          // no leg here (a door / a board): the beam lands on a short header plate on the wall
          B(s - 0.12, h - web - 0.05, cw, s + 0.12, h - web, cw + sg * 0.03);
          return;
        }
        const top = h - web - kn;
        B(s - t / 2, 0, cw, s + t / 2, top, ci);                  // web
        B(s - fl, 0, ci, s + fl, top, ci + sg * t);               // face flange
        // knee bracket: the web plate (stepped triangle) + its sloping face bar from the leg top to the beam
        for (let k = 0; k < 4; k++) B(s - t / 2, top + kn * (k / 4), cw, s + t / 2, top + kn * ((k + 1) / 4), ci + sg * (kn - dp) * ((k + 0.5) / 4));
        bar(s, ci + sg * t / 2, top, cw + sg * (kn + 0.02), h - web - t, fl * 2);
      });
    }
    // deckhead longitudinals between the beams
    const lon = o.lon ?? 0.75;
    if (lon > 0) for (let c = c0 + lon; c < c1 - 0.2; c += lon) B(a0 + 0.004, h - 0.07, c - 0.005, a1 - 0.004, h, c + 0.005);
    // end-bulkhead stiffeners (vertical flat bars with a face), clear of doors / boards
    const sp = o.stiff ?? 1.5;
    if (sp > 0) endW.forEach((w, i) => {
      const sg = i === 0 ? 1 : -1, aw = i === 0 ? a0 : a1;
      for (let c = c0 + sp; c < c1 - 0.3; c += sp) {
        if (clear(w, c, 0.04)) continue;
        B(aw, 0.1, c - 0.005, aw + sg * 0.075, h - 0.002, c + 0.005);
        B(aw + sg * 0.075, 0.1, c - 0.03, aw + sg * 0.085, h - 0.072, c + 0.03);
      }
    });
    // stringer (a flat bar on edge with a capping flat) along the side walls, broken at the clear spans
    if (o.stringer != null) {
      const y = o.stringer;
      sideW.forEach((w, i) => {
        const sg = i === 0 ? 1 : -1, cw = i === 0 ? c0 : c1;
        const cuts = (o.clear ?? []).filter(([w2]) => w2 === w).map(([, p, q]) => [Math.min(p, q), Math.max(p, q)] as [number, number]).sort((p, q) => p[0] - q[0]);
        let a = a0 + 0.004;
        for (const [p, q] of [...cuts, [a1 - 0.004, 1e9] as [number, number]]) {
          const e = Math.min(p, a1 - 0.004);
          if (e - a > 0.15) { B(a, y - 0.05, cw, e, y + 0.05, cw + sg * 0.012); B(a, y + 0.038, cw + sg * 0.012, e, y + 0.05, cw + sg * 0.055); }
          a = Math.max(a, q);
        }
      });
    }
  });
  // frame numbers on the second side wall's plating, beside every other leg
  if (o.frameNo != null) {
    const w = sideW[1], cw = c1, face: Face = ax === 'x' ? '-z' : '-x';
    st.forEach((s, i) => {
      if (i % 2 || clear(w, s + 0.45, 0.3)) return;
      const text = `FR ${o.frameNo! + i}`;
      if (ax === 'x') hullNumber(b, text, s + 0.45, h - web - 0.6, cw - 0.002, face, 0.14);
      else hullNumber(b, text, cw - 0.002, h - web - 0.6, s + 0.45, face, 0.14);
    });
  }
  return st;
}

/**
 * An overhead service run under the deck beams (B1: pipes and a cable tray in every compartment), along x or z from `a`
 * to `b` at `c` across, under the beams' underside `ceil`: `pipes` [r, offset across, drop below `ceil` to the pipe's
 * top, kind] (painted service pipe / lagged / bare steel, flanged every 3 m), an optional cable tray {w, c, drop} with
 * four cables, all hung on drop rods + straps at `hangers` (stations along the run). Builder frame = world. Visual only.
 * Calls: steel_raw + pipe paint (+ lagging) + rubber — materials the zones already draw.
 */
export function serviceRun(b: Builder, L: LevelBuild, o: { along: 'x' | 'z'; a: number; b: number; c: number; ceil: number; hangers?: number[]; pipes?: [number, number, number, 'pipe' | 'lagged' | 'steel'][]; tray?: { w: number; c: number; drop: number } | null }) {
  const P = pipePaint(L), S: Mat = 'steel_raw';
  const lo = Math.min(o.a, o.b), hi = Math.max(o.a, o.b), len = hi - lo, mid = (lo + hi) / 2;
  const pipes = o.pipes ?? [[0.05, 0, 0.06, 'pipe'], [0.035, 0.16, 0.08, 'steel']];
  const at = (u: number, c: number): [number, number] => (o.along === 'x' ? [u, c] : [c, u]);
  const box = (u0: number, y0: number, cc0: number, u1: number, y1: number, cc1: number) => {
    const [xa, za] = at(u0, cc0), [xb, zb] = at(u1, cc1);
    b.bx(S, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb));
  };
  b.detail(() => {
    for (const [r, dc, drop, k] of pipes) {
      const y = o.ceil - drop - r, [x, z] = at(mid, o.c + dc);
      const m: Mat = k === 'pipe' ? P : k === 'lagged' ? tint5(L, 'lagging', 'painted_white', 0xd4d0c4, { roughness: 0.85 }) : S;
      b.cyl(m, x, y, z, k === 'lagged' ? r + 0.02 : r, len, o.along, 10);
      for (let u = lo + 1.5; u < hi - 0.3; u += 3) { const [fx, fz] = at(u, o.c + dc); b.cyl(S, fx, y, fz, r + (k === 'lagged' ? 0.035 : 0.022), 0.03, o.along, 10); }
    }
    if (o.tray) {
      const { w, c, drop } = o.tray, y = o.ceil - drop;
      for (const s of [-1, 1]) box(lo, y, c + s * w / 2 - 0.004, hi, y + 0.07, c + s * w / 2 + 0.004);
      for (let u = lo + 0.15; u < hi; u += 0.3) box(u - 0.012, y, c - w / 2, u + 0.012, y + 0.01, c + w / 2);
      for (let i = 0; i < 4; i++) { const [x, z] = at(mid, c - w / 2 + 0.06 + i * (w - 0.12) / 3); b.cyl('rubber', x, y + 0.026 + (i % 2) * 0.01, z, 0.016 + (i % 3) * 0.004, len, o.along, 6); }
    }
    for (const u of o.hangers ?? []) {
      if (u < lo + 0.1 || u > hi - 0.1) continue;
      for (const [r, dc, drop, k] of pipes) {
        const rr = k === 'lagged' ? r + 0.02 : r, yb = o.ceil - drop - r - rr - 0.01, [x0, z0] = at(u, o.c + dc);
        b.rod(S, x0, o.ceil, z0, x0, yb + 0.01, z0, 0.006, 4);
        box(u - 0.015, yb, o.c + dc - rr - 0.02, u + 0.015, yb + 0.01, o.c + dc + rr + 0.02);
      }
      if (o.tray) {
        const { w, c, drop } = o.tray;
        for (const s of [-1, 1]) { const [x0, z0] = at(u, c + s * (w / 2 + 0.02)); b.rod(S, x0, o.ceil, z0, x0, o.ceil - drop, z0, 0.006, 4); }
        box(u - 0.02, o.ceil - drop - 0.02, c - w / 2 - 0.03, u + 0.02, o.ceil - drop, c + w / 2 + 0.03);
      }
    }
  });
}

// ═════════════════════════════════════════════════════════════ NAVY BODY (IB5a, B4)

type P3 = [number, number, number];
/** Frame for a cloth / limb tube from A down to B (local −y → B − A), local x as close to `side` as possible. */
function tubeFrame(A: P3, B: P3, side: P3 = [1, 0, 0]): THREE.Matrix4 {
  const y = new THREE.Vector3(A[0] - B[0], A[1] - B[1], A[2] - B[2]).normalize();
  const x = new THREE.Vector3(...side).addScaledVector(y, -new THREE.Vector3(...side).dot(y));
  if (x.lengthSq() < 1e-6) x.set(0, 0, 1).addScaledVector(y, -y.z);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(A[0], A[1], A[2]);
}
/**
 * A cloth / flesh tube from A to B (radii ra → rb, section `flat` = depth / width), rounded ends, with `bunch` (0 … 1)
 * horizontal bunching rings and vertical creases (cloth), as one `drapeGeo` placed by `tubeFrame`.
 */
function limb(b: Builder, M: Mat, A: P3, B: P3, ra: number, rb: number, o: { seed: number; bunch?: number; flat?: number; side?: P3; ends?: boolean; seg?: number }) {
  const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), bunch = o.bunch ?? 0, flat = o.flat ?? 1, R = srand(o.seed);
  const rings: DRing[] = [];
  const ends = o.ends !== false;
  if (ends) for (const [k, s] of [[0.85, 0.35], [0.5, 0.72]] as const) rings.push({ c: [0, ra * k, 0], rx: ra * s, rz: ra * s * flat });
  const n = Math.max(3, Math.round(len / 0.03)), ph = R() * 6.28, fr = (2 * PI) / (0.07 + R() * 0.03);
  for (let i = 0; i <= n; i++) {
    const k = i / n, y = -k * len;
    const r = (ra + (rb - ra) * k) * (1 + bunch * 0.07 * Math.sin(-y * fr + ph) * (0.6 + 0.4 * Math.sin(k * 7 + ph)));
    rings.push({ c: [0, y, 0], rx: r, rz: r * flat, fold: bunch * r * 0.09, nf: 4 + (i % 3), ph: ph + k * 2.4 });
  }
  if (ends) for (const [k, s] of [[0.5, 0.72], [0.85, 0.35]] as const) rings.push({ c: [0, -len - rb * k, 0], rx: rb * s, rz: rb * s * flat });
  b.geo(M, drapeGeo(rings, o.seg ?? 14, o.seed, ends ? { top: ra * 0.1, bottom: rb * 0.1 } : {}), 'box', tubeFrame(A, B, o.side));
}

/** Materials of the navy body: working-dress navy, boots, skin, hair, the cook's white apron. */
function bodyMats(L: LevelBuild) {
  return {
    cloth: 'fatigue_navy' as Mat,
    boot: tint5(L, 'body_boot', 'rubber', 0x1c1d20, { roughness: 0.65 }) as Mat,
    skin: paint5(L, 'body_skin', 0x9a8a80, 0.72) as Mat,
    hair: tint5(L, 'body_hair', 'fabric', 0x2b231d, { roughness: 0.95 }) as Mat,
    apron: paint5(L, 'body_apron', 0xcdc9bd, 0.93) as Mat,
  };
}

/** A hand (skin): palm block + four curled fingers + thumb, from the wrist W toward `dir`, palm facing `palm`. */
function deadHand(b: Builder, M: Mat, W: P3, dir: P3, palm: P3, curl: number, seed: number) {
  const d = new THREE.Vector3(...dir).normalize(), pn = new THREE.Vector3(...palm).normalize();
  const sd = new THREE.Vector3().crossVectors(d, pn).normalize();
  const at = (u: number, v: number, w: number): P3 => { const p = new THREE.Vector3(...W).addScaledVector(d, u).addScaledVector(sd, v).addScaledVector(pn, w); return [p.x, p.y, p.z]; };
  limb(b, M, at(-0.005, 0, 0), at(0.085, 0, 0.002), 0.03, 0.036, { seed, flat: 0.45, side: [sd.x, sd.y, sd.z], seg: 10 });
  const R = srand(seed);
  for (let i = 0; i < 4; i++) {
    const v = -0.03 + i * 0.02, l1 = 0.042 - Math.abs(i - 1.3) * 0.005, c = curl * (0.7 + R() * 0.6);
    const k1 = at(0.09, v, 0.004), k2 = at(0.09 + l1 * Math.cos(c * 0.6), v, 0.004 + l1 * Math.sin(c * 0.6));
    const k3 = at(0.09 + l1 * Math.cos(c * 0.6) + 0.03 * Math.cos(c * 1.4), v, 0.004 + l1 * Math.sin(c * 0.6) + 0.03 * Math.sin(c * 1.4));
    limb(b, M, k1, k2, 0.0095, 0.009, { seed: seed + i, seg: 6 });
    limb(b, M, k2, k3, 0.009, 0.0075, { seed: seed + i + 9, seg: 6 });
  }
  limb(b, M, at(0.02, 0.038, 0.004), at(0.065, 0.052, 0.02 + 0.02 * curl), 0.012, 0.009, { seed: seed + 20, seg: 6 });
}

/**
 * The navy body (B4: `v5_body` — one of the Post 4 galley crew, a cook in navy working dress with a white apron — and the
 * dead hand on the stair). Floor prop, origin = under the pelvis, lying FACE DOWN along local z, head toward −z, feet
 * +z. Pose `dragged`: pulled by the ankles — legs straight and together, toes trailing, arms dragged up past the head
 * (one palm up), the shirt ridden up to the shoulder blades (a band of bare back above the belt), the sleeves rucked,
 * the apron's strings tied at the back and the apron bunched out from under the hips, the face into the deck (hair,
 * an ear, the nape — never a face). Cloth (shirt, trousers, apron) is tubes with bunching and creases (the lab suits'
 * lesson); 2.25 m long from boots to fingertips, 0.75 m wide. Returns the footprint box (builder frame, 0.18 high).
 * Calls: 5 (fatigue, boot, skin, hair, apron). Collider: none (the caller adds the walkable 0.15 m box).
 */
export function navyBody(b: Builder, L: LevelBuild, o: { seed?: number } = {}): { box: THREE.Box3 } {
  const M = bodyMats(L), seed = o.seed ?? 5150, R = srand(seed);
  const J = {
    sh: [0, 0.118, -0.52] as P3, chest: [0.0, 0.12, -0.36] as P3, waist: [0.005, 0.105, -0.08] as P3, hip: [0.0, 0.112, 0.06] as P3,
    neck: [0.012, 0.1, -0.62] as P3, head: [0.035, 0.1, -0.775] as P3,
    shL: [0.19, 0.115, -0.53] as P3, elL: [0.27, 0.068, -0.83] as P3, wrL: [0.245, 0.042, -1.09] as P3,
    shR: [-0.19, 0.115, -0.53] as P3, elR: [-0.33, 0.07, -0.76] as P3, wrR: [-0.37, 0.048, -1.02] as P3,
    hiL: [0.095, 0.1, 0.1] as P3, knL: [0.115, 0.074, 0.53] as P3, anL: [0.125, 0.078, 0.94] as P3,
    hiR: [-0.095, 0.1, 0.1] as P3, knR: [-0.13, 0.074, 0.52] as P3, anR: [-0.115, 0.082, 0.93] as P3,
  };
  // ── torso: the shirt ridden up (bunched at the shoulder blades), bare back above the belt, trousers, belt
  limb(b, M.cloth, J.sh, J.chest, 0.2, 0.185, { seed: seed + 1, bunch: 1.6, flat: 0.55, side: [1, 0, 0], seg: 24 });
  limb(b, M.cloth, J.chest, [0.004, 0.11, -0.16], 0.185, 0.165, { seed: seed + 2, bunch: 1.0, flat: 0.6, side: [1, 0, 0], seg: 24, ends: false });
  // the rucked hem: a thick roll of cloth
  b.geo(M.cloth, drapeGeo([{ c: [0, 0.012, 0], rx: 0.17, rz: 0.1, fold: 0.008, nf: 7 }, { c: [0, -0.02, 0], rx: 0.178, rz: 0.108, fold: 0.01, nf: 9, ph: 1 }, { c: [0, -0.05, 0], rx: 0.166, rz: 0.1 }], 24, seed + 3), 'box', tubeFrame([0.004, 0.11, -0.15], [0.004, 0.11, -0.2], [1, 0, 0]));
  limb(b, M.skin, [0.004, 0.106, -0.17], J.waist, 0.155, 0.152, { seed: seed + 4, flat: 0.58, side: [1, 0, 0], seg: 22, ends: false });
  limb(b, M.cloth, [0.005, 0.106, -0.09], J.hip, 0.162, 0.175, { seed: seed + 5, bunch: 0.6, flat: 0.62, side: [1, 0, 0], seg: 24 });
  limb(b, 'painted_dark', [0.005, 0.107, -0.095], [0.005, 0.107, -0.055], 0.166, 0.166, { seed: seed + 6, flat: 0.64, side: [1, 0, 0], seg: 24, ends: false });
  // apron strings tied in a bow over the belt, the apron bunched out from under the hips on both sides
  b.detail(() => {
    b.rbox(M.apron, 0.0, 0.178, -0.075, 0.33, 0.006, 0.018, 0, 0.02, 0);
    for (const s of [-1, 1]) b.rbox(M.apron, s * 0.035, 0.182, -0.072, 0.06, 0.012, 0.035, 0.2, s * 0.5, 0);
    b.rbox(M.apron, 0.02, 0.18, -0.04, 0.012, 0.006, 0.09, 0, 0.3, 0);
    b.rbox(M.apron, -0.015, 0.18, -0.035, 0.012, 0.006, 0.1, 0, -0.25, 0);
  });
  // (the apron's skirt, out from under the hips beside the thighs — clear of them)
  for (const s of [-1, 1]) b.geo(M.apron, drapeGeo([{ c: [0, 0, 0], rx: 0.045, rz: 0.008, fold: 0.004, nf: 3 }, { c: [0, -0.14, 0], rx: 0.06, rz: 0.008, fold: 0.008, nf: 4, ph: 1 }, { c: [0, -0.27, 0], rx: 0.075, rz: 0.007, fold: 0.01, nf: 5, ph: 2 }], 16, seed + 7 + s), 'box',
    tubeFrame([s * 0.235, 0.012, -0.06], [s * (0.27 + 0.03 * R()), 0.01, 0.2], [1, 0, 0]));
  // ── neck, head (face down, turned a little: crown, back of the skull, an ear), hair
  limb(b, M.skin, [0.004, 0.11, -0.54], J.neck, 0.058, 0.055, { seed: seed + 8, seg: 12 });
  b.sphere(M.skin, J.head[0], J.head[1], J.head[2], 0.1, 16, 0.92, 0.88, 1.06);
  b.sphere(M.hair, J.head[0] - 0.004, J.head[1] + 0.022, J.head[2] - 0.012, 0.096, 16, 0.78, 0.9, 1.04);
  b.rbox(M.skin, J.head[0] + 0.083, J.head[1] + 0.005, J.head[2] + 0.01, 0.018, 0.055, 0.035, 0, 0, 0.2); // ear
  // ── arms: dragged up past the head, sleeves rucked toward the wrists; left palm down, right palm up and curled
  limb(b, M.cloth, J.shL, J.elL, 0.068, 0.058, { seed: seed + 10, bunch: 1.2, side: [0, 1, 0] });
  limb(b, M.cloth, J.elL, J.wrL, 0.06, 0.054, { seed: seed + 11, bunch: 1.6, side: [0, 1, 0] });
  limb(b, M.cloth, J.shR, J.elR, 0.068, 0.058, { seed: seed + 12, bunch: 1.2, side: [0, 1, 0] });
  limb(b, M.cloth, J.elR, J.wrR, 0.06, 0.054, { seed: seed + 13, bunch: 1.6, side: [0, 1, 0] });
  limb(b, M.skin, [J.wrL[0] + 0.004, J.wrL[1] - 0.006, J.wrL[2] + 0.04], [J.wrL[0] - 0.004, J.wrL[1] - 0.012, J.wrL[2] - 0.04], 0.03, 0.028, { seed: seed + 14, flat: 0.75, seg: 10 });
  limb(b, M.skin, [J.wrR[0] + 0.006, J.wrR[1] - 0.006, J.wrR[2] + 0.04], [J.wrR[0] - 0.006, J.wrR[1] - 0.01, J.wrR[2] - 0.04], 0.03, 0.028, { seed: seed + 15, flat: 0.75, seg: 10 });
  deadHand(b, M.skin, [J.wrL[0] - 0.006, 0.028, J.wrL[2] - 0.04], [-0.05, 0, -1], [0, -1, 0], 0.5, seed + 16);
  deadHand(b, M.skin, [J.wrR[0] - 0.01, 0.034, J.wrR[2] - 0.04], [-0.15, 0, -1], [0, 1, 0], 1.1, seed + 17);
  // ── legs together, straight, trousers bunched at the knees and ridden up the boots; toes trailing
  limb(b, M.cloth, J.hiL, J.knL, 0.092, 0.07, { seed: seed + 20, bunch: 0.9, side: [1, 0, 0] });
  limb(b, M.cloth, J.knL, J.anL, 0.07, 0.062, { seed: seed + 21, bunch: 1.4, side: [1, 0, 0] });
  limb(b, M.cloth, J.hiR, J.knR, 0.092, 0.07, { seed: seed + 22, bunch: 0.9, side: [1, 0, 0] });
  limb(b, M.cloth, J.knR, J.anR, 0.07, 0.062, { seed: seed + 23, bunch: 1.4, side: [1, 0, 0] });
  for (const [an, sx] of [[J.anL, 0.01], [J.anR, -0.02]] as const) {
    // boot shaft up the shin, then the foot: toes down on the deck, the sole facing back (+z, up)
    limb(b, M.boot, [an[0], an[1], an[2] - 0.09], [an[0], an[1] + 0.005, an[2] + 0.05], 0.06, 0.058, { seed: seed + 30, seg: 12 });
    limb(b, M.boot, [an[0], an[1] + 0.012, an[2] + 0.03], [an[0] + sx, 0.045, an[2] + 0.2], 0.058, 0.044, { seed: seed + 31, flat: 0.78, side: [1, 0, 0], seg: 12 });
    b.sphere(M.boot, an[0], an[1] + 0.045, an[2] + 0.02, 0.05, 10, 0.8, 0.9, 1.0); // the heel, up
  }
  return { box: new THREE.Box3(new THREE.Vector3(-0.47, 0, -1.25), new THREE.Vector3(0.36, 0.2, 1.24)) };
}

/**
 * The dead hand on the stair (B4; §2.7.3 / §2.8: "a hand on the stair (flashlight)"): the navy body's forearm and hand
 * only — the rest is below the stair's edge, out of sight. Origin = the wrist on the tread, the forearm going back down
 * along local −z (into the dark, 0.32 m shown, sleeve with a cuff), the hand along +z, palm down, the fingers curled
 * over the nosing at local z = `over` (0.1) and hanging down. Calls: 2 (fatigue, skin).
 */
export function navyHand(b: Builder, L: LevelBuild, o: { over?: number; seed?: number } = {}) {
  const M = bodyMats(L), seed = o.seed ?? 77, over = o.over ?? 0.1;
  limb(b, M.cloth, [0.005, 0.03, -0.38], [0, 0.034, -0.06], 0.058, 0.052, { seed, bunch: 1.4, side: [0, 1, 0] });
  limb(b, M.skin, [0, 0.03, -0.07], [0, 0.026, 0.0], 0.03, 0.028, { seed: seed + 1, flat: 0.75, seg: 10 });
  // the palm flat on the tread, the thumb along its edge, the fingers over the nosing (last joints down the riser)
  limb(b, M.skin, [0, 0.022, -0.005], [0.002, 0.02, 0.08], 0.03, 0.036, { seed: seed + 2, flat: 0.45, side: [1, 0, 0], seg: 10 });
  limb(b, M.skin, [0.034, 0.02, 0.015], [0.05, 0.012, 0.06], 0.012, 0.009, { seed: seed + 3, seg: 6 });
  for (let i = 0; i < 4; i++) {
    const v = 0.028 - i * 0.019, z = Math.max(0.09, over) + 0.004 * Math.sin(i * 2);
    limb(b, M.skin, [v, 0.016, 0.082], [v, 0.012, z], 0.0095, 0.009, { seed: seed + 5 + i, seg: 6 });
    limb(b, M.skin, [v, 0.012, z], [v + 0.002, -0.028 - 0.006 * (i % 2), z + 0.012], 0.0088, 0.0072, { seed: seed + 9 + i, seg: 6 });
  }
}
