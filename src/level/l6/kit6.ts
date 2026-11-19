/**
 * THE TRUNK — dressing kit (stage 3d §8.8, task W8). Props for level 6: the cable tunnels, the repeater bend and the
 * jointer's tent, the joint bay, the head-end computer room, the cable vault (drums, dehumidifiers, nitrogen, trench),
 * the stair shaft and the moon-pool chamber (galleries, bar guards, the coaming, containers, slots, pumps, the dock
 * furniture, the loader's runway). Original designs, metres, y up.
 *
 * Conventions (kit4 / kit5 conventions — read before placing anything):
 *  - Every prop is authored in the builder's LOCAL frame and stamped with the transform stack:
 *    `b.at(x, y, z, ry, () => junctionBox(b, L, { shelf: true }))`. Wall-normal → ry: front +z: 0 · −z: π · +x: π/2 ·
 *    −x: −π/2. **Place props at multiples of π/2 only** (colliders are axis-aligned boxes in the prop's frame). Every
 *    prop takes `(b, L, o)` with an options object. The exceptions take world-style coordinates in the builder's frame
 *    and say so (`strip6`, `trenchGrating`, `galleryRun`, `rail6`, `barGuard`, `coaming`, `slotPaint`, `trunkRun`).
 *  - FLOOR props: origin on the floor; FRONT = local +z. WALL props ("wall prop"): origin on the WALL FACE at FLOOR
 *    level unless stated (room side of the wall = wall centre ± 0.2), back at local z = 0, front +z. CEILING props:
 *    origin on the ceiling, hanging −y.
 *  - Draw calls: the builder merges per material per zone, so a static prop costs one call per DISTINCT material it
 *    adds to its zone. **Every static prop uses ≤ 2 materials** ("Calls" in each doc). Text goes through the zone's sign
 *    atlas (`stencil6`, one call per sign style per zone, shared). Shared emissives (`stripMat6`, `lampLens6`, `ledMat6`)
 *    are one call per zone for all props using them. Moving parts are separate objects (+1 call each, stated).
 *  - Colliders: `collide` (default true unless stated) adds static boxes with `b.collide` (nav obstacles). Cover props
 *    have honest collider heights (the collider top is the visible top: JB 1.8, RH 2.0, crates 1.2, drum trolley 1.3).
 *    Turn colliders off (`collide: false`) where the W4a greybox already has them — never two colliders.
 *    **Move-only** colliders (rails, bar guards, mesh guards, the tent's tarp — D14: bodies stop, rounds and sight pass)
 *    go through `collideMoveOnly` into a per-level list; `moveOnlyColliders6(L)` returns them as ONE collider mesh with
 *    `userData.moveOnly = true` for the level's collider list (W4a / W4b append it to `L.colliderMeshes()`).
 *  - In the tunnels every collider-bearing prop is either a floor obstacle the plan names (JB, DT, RH) or starts at
 *    y 2.0 (trays, the trunk, fittings carry no collider).
 *  - Emissive: ≤ 0.35 by default; the exceptions are the strips (1.2 on), the LEDs (0.7, tiny) and a lamp being popped
 *    (a 1-frame surge). Lamps that must follow a light take its handle (`bind`).
 *  - Z-fight rule: no two same-facing faces overlap closer than 8 mm; flat things lying on a surface (paint, labels)
 *    use polygon-offset overlay materials.
 *  - Scare / set props (`cableDrum` turning with its ratchet, `landingLamp` popping, `liftingGrille`, `slackCoil`,
 *    `ammoLocker`, `tunnelFitting` hanging) expose triggers that return their duration and the times the vignette
 *    schedules its sounds at, and a pure `at(t)` (scrub / snap). **They play no sounds** and never call `ctx.audio` /
 *    `ctx.fx` (D25: a vignette's sounds are the level's): `cableDrum.run()` → `ratchet_run` from 0 (its `clacks` are
 *    the pawl drops), `drum_rumble` from `rumble`, `drum_brake` at `brake`; `landingLamp.pop()` → `bulb_pop` +
 *    `fx.bulbPop(point)` at `out`, `glass_tinkle` at `tinkle`; `liftingGrille.pop()` → `vent_grille` at 0,
 *    `drop()` → `sump_lift` (or a clank) at `impact`. `snap()` = the end state, instant and silent (`id:snap`).
 *  - Level-6 materials (`TrunkMaterialName`) are W5's; until a name is implemented `tmat6` draws a kit-local stand-in
 *    (same shape, plain colour) instead of the library's dark fallback.
 *
 *  materials   tmat6 · tint6 · stripMat6 / setStrips6 · lampLens6 · ledMat6 · collideMoveOnly / moveOnlyColliders6
 *  signs       stencil6
 *  tunnels     tunnelRing · cableTrays · trunkRun · junctionBox (+ shelf) · bracketShelf · drumTrolley · tunnelFitting
 *              (dead / hanging) · dewaterPipe · tunnelDrain · strip6
 *  repeater    repeaterBank · repeaterHousing (+ shelf) · cableDrum ('cradle' static | 'stand' turning: ratchet + brake)
 *              · slackCoil · jointerTent · splicingTable · crate6 · wallShelf6 · firstAidBox6
 *  joint bay   jointBox · spareCoil
 *  head-end    oltRack · mimicFrame · consoleDesk · wallLocker
 *  vault       dehumidifier · nitrogenRack (+ shelf) · trenchGrating · liftingGrille · hatchLid6 (+ HATCH6_VAULT / HE)
 *  shaft       landingLamp (breakable) · firePointCabinet · storeBox
 *  moon pool   galleryRun · rail6 · barGuard · coaming · cargoContainer / containerObject / containerInstances ·
 *              slotPaint · pumpHousing (+ toolShelf) · toolShelf · ammoLocker · hoseReel · fender · bollard · lifeRing ·
 *              festoon · runwayRail · amberBeacon
 */
import * as THREE from 'three';
import type { LightHandle, MaterialName, TrunkMaterialName } from '../../core/types';
import { aabbOf, mergeItems, unitBox, type Builder, type Face, type Mat } from '../builder';
import type { LevelBuild } from '../context';
import { curtainGeo } from '../props';
import { hose } from '../kit';
import { machinery, mat4, rotBeacon as rotBeacon4, type Beacon } from '../l4/kit4';

export type { Beacon };
const PI = Math.PI, TAU = 2 * PI;
export type WallFace = '+x' | '-x' | '+z' | '-z';

// ───────────────────────────────────────────────────────────── helpers

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Deterministic RNG (mulberry32). */
function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SANS = '"Arial Narrow", "Helvetica Neue", "Roboto Condensed", Arial, sans-serif';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** World matrix of a local frame under the builder's current transform. */
function worldOf(b: Builder, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  return b.m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
}
function dirOf(b: Builder, x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).transformDirection(b.m); }

/** A moving part: `mount` carries the world transform (tagged with the builder's rooms, child of the level root); `pivot`
 * (its child) is what moves; the geometry is authored relative to the pivot. `mover` registers it with physics (decals
 * ride it). */
export interface MovingPart6 { mount: THREE.Group; pivot: THREE.Group }
function part6(b: Builder, L: LevelBuild, name: string, px: number, py: number, pz: number, make: (p: Builder) => void, o: { pre?: THREE.Euler; mover?: boolean } = {}): MovingPart6 {
  const p = L.part(name);
  make(p);
  const g = p.build();
  const mount = new THREE.Group();
  mount.name = name;
  worldOf(b, px, py, pz).decompose(mount.position, mount.quaternion, mount.scale);
  if (o.pre) mount.quaternion.multiply(new THREE.Quaternion().setFromEuler(o.pre));
  mount.userData.rooms = b.rooms.slice();
  const pivot = new THREE.Group();
  pivot.name = `${name}:pivot`;
  pivot.add(g);
  mount.add(pivot);
  L.root.add(mount);
  if (o.mover) L.ctx.physics?.addMover?.(mount);
  return { mount, pivot };
}

/** A replayable timeline on the level clock: `play(from)` runs `pose(t)` each frame to `dur`; `at(t)` jumps there at once
 * (stops playback; silent, idempotent — snaps and dev scrubbing). */
export interface Timeline6 { readonly dur: number; readonly playing: boolean; readonly t: number; play(from?: number): number; at(t: number): void }
function timeline(L: LevelBuild, dur: number, pose: (t: number) => void): Timeline6 {
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

// ───────────────────────────────────────────────────────────── materials

const NOMAPS = { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null };
/** Stand-ins for W5's eight trunk materials while they are pending (shape-true colours on library bases). */
const STAND: Record<TrunkMaterialName, [MaterialName, Partial<THREE.MeshStandardMaterialParameters>]> = {
  tunnel_shotcrete: ['floor_concrete', { color: 0xa39f95, roughness: 0.96 }],
  cable_armour: ['steel_raw', { color: 0x9aa0a2, metalness: 0.7, roughness: 0.42 }],
  dock_steel: ['floor_plate', { color: 0x59636a }],
  dock_steel_wet: ['floor_plate', { color: 0x4a545a, roughness: 0.3 }],
  crane_yellow: ['painted_yellow', { color: 0xe0a91c }],
  rope_wire: ['steel_raw', { color: 0x5a5d5f, metalness: 0.8, roughness: 0.38 }],
  container_navy: ['painted_white', { color: 0x2b3b54, roughness: 0.62 }],
  container_orange: ['painted_white', { color: 0xb8531d, roughness: 0.6 }],
  coverall_orange: ['cloth_coverall', { color: 0xd9641c }],
};
/** A level-6 material: the library's once W5 implements it (`get` returns it under its own name), else a stand-in. */
export function tmat6(L: LevelBuild, name: TrunkMaterialName): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.get(name);
  if (m.name === name) return m;
  return mat4(L, `k6_stand_${name}`, () => { const [fb, o] = STAND[name]; const c = L.ctx.materials.clone(fb, o); c.name = `${name}_k6stand`; return c; });
}
/** A library material recoloured (keeps its maps), cached per key. */
export function tint6(L: LevelBuild, key: string, base: MaterialName, color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return mat4(L, `k6_t_${key}`, () => L.ctx.materials.clone(base, { color, ...extra }));
}
const fireRed = (L: LevelBuild) => tint6(L, 'fire_red', 'painted_white', 0xa3241c, { roughness: 0.45 });
/** Cable-drum steel (dark green, chipped). */
const drumPaint = (L: LevelBuild) => tint6(L, 'drum_green', 'painted_white', 0x3c5244, { roughness: 0.55 });
/** Olive transport cases, ammo lockers. */
const olive = (L: LevelBuild) => tint6(L, 'olive', 'painted_white', 0x59614c, { roughness: 0.62 });
/** Grey-white plant enclosures (dehumidifiers). */
const plantWhite = (L: LevelBuild) => tint6(L, 'plant_white', 'painted_white', 0xc9cdc9, { roughness: 0.5 });
/** Nitrogen cylinders (black-grey, glossy). */
const bottleGrey = (L: LevelBuild) => tint6(L, 'n2_grey', 'painted_white', 0x2f3337, { roughness: 0.35 });
/** First-aid green. */
const aidGreen = (L: LevelBuild) => tint6(L, 'aid_green', 'painted_white', 0x1f7a45, { roughness: 0.4 });
/** Yellow PVC tarp (double-sided: seen from inside the tent). */
const tarpMat = (L: LevelBuild) => mat4(L, 'k6_tarp', () => L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: 0xc8961a, roughness: 0.66, metalness: 0, side: THREE.DoubleSide }));

interface StripDef { color: number; lens: number; on: number }
const STRIPS: Record<StripChannel6, StripDef> = {
  /** Hard-wired emergency floor strips (tun6_b, galleries, the chamber): green-amber, ON from load. */
  emerg: { color: 0xc8ff3c, lens: 0xd9e6b8, on: 1 },
  /** Trench / crawl red LED strips: ON from load. */
  red: { color: 0xff2a14, lens: 0xc89a94, on: 1 },
  /** Amber stair nosings (shaft, chamber stairs): ON from load (hard-wired). */
  amber: { color: 0xffa23a, lens: 0xd8c4a4, on: 1 },
};
export type StripChannel6 = 'emerg' | 'red' | 'amber';
/** Strip lens material of a channel — ONE per channel per level (every strip of the channel switches together). */
export function stripMat6(L: LevelBuild, ch: StripChannel6 = 'emerg'): THREE.MeshStandardMaterial {
  return mat4(L, `k6_strip_${ch}`, () => {
    const d = STRIPS[ch];
    const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: d.lens, roughness: 0.3, metalness: 0 });
    m.emissive = new THREE.Color(d.color);
    m.emissiveIntensity = 1.2 * d.on;
    m.name = `k6_strip_${ch}`;
    return m;
  });
}
/** Strips of a channel on (k = 1 → 1.2) / off (0) / dimmed. */
export function setStrips6(L: LevelBuild, ch: StripChannel6, k: number) { stripMat6(L, ch).emissiveIntensity = 1.2 * Math.max(0, k); }

export type LampColor6 = 'white' | 'warm' | 'red' | 'amber' | 'cold';
const LAMP: Record<LampColor6, [number, number]> = { white: [0xeef4ff, 0xdfe6ee], warm: [0xffd9a0, 0xe8dccb], red: [0xff2412, 0x8a3a32], amber: [0xffa53a, 0xb88a52], cold: [0xd8ecff, 0xd5e2ec] };
function newLens(L: LevelBuild, color: LampColor6, intensity: number): THREE.MeshStandardMaterial {
  const [e, a] = LAMP[color];
  const m = L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: a, roughness: 0.25, metalness: 0 });
  m.emissive = new THREE.Color(e); m.emissiveIntensity = intensity;
  return m;
}
/** Shared lamp-lens material per colour + intensity (one call per zone). Intensity 0 = a dead fitting. */
export function lampLens6(L: LevelBuild, color: LampColor6 = 'white', intensity = 0.35): THREE.MeshStandardMaterial {
  return mat4(L, `k6_lens_${color}_${intensity}`, () => { const m = newLens(L, color, intensity); m.name = `k6_lens_${color}_${intensity}`; return m; });
}

/**
 * Equipment status LEDs: a 64 × 64 random field (green / amber / off, a few laser-green) on a 1 m tile, sampled by each
 * tiny LED quad at its world position (box UVs); every 0.2 s the field jumps by whole texels so each LED blinks on its
 * own rhythm. One material (and one updater) per level. Intensity 0.7 (tiny quads).
 */
export function ledMat6(L: LevelBuild, intensity = 0.7): THREE.MeshStandardMaterial {
  return mat4(L, 'k6_led', () => {
    const r = srand(61);
    const tex = canvasTex(64, 64, (g) => {
      g.fillStyle = '#040504'; g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const k = r();
        if (k < 0.55) g.fillStyle = '#26ff4e'; else if (k < 0.62) g.fillStyle = '#ffb020'; else if (k < 0.64) g.fillStyle = '#ff3020'; else continue;
        g.fillRect(x, y, 1, 1);
      }
    });
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const m = L.ctx.materials.clone('plastic_dark', { ...NOMAPS, color: 0x0a0b0b, roughness: 0.4 });
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = tex;
    m.emissiveIntensity = intensity;
    m.name = 'k6_led';
    let acc = 0;
    const rr = srand(5);
    L.updaters.push((dt) => {
      acc += dt;
      if (acc < 0.2) return;
      acc = 0;
      tex.offset.set(Math.floor(rr() * 64) / 64, Math.floor(rr() * 64) / 64);
    });
    return m;
  });
}

// ───────────────────────────────────────────────────────────── move-only colliders (D14)

const MOVE_ONLY = new WeakMap<LevelBuild, THREE.Matrix4[]>();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
/**
 * A MOVE-ONLY collision box (local coords, honours the transform): bodies stop, rounds and sight pass (rails, bar and
 * mesh guards, the tarp). Kept in a per-level list (see `moveOnlyColliders6`); `nav` (true) also makes it a nav
 * obstacle exactly like `b.collide` does.
 */
export function collideMoveOnly(b: Builder, L: LevelBuild, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, nav = true, cap = false) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = Math.abs(x1 - x0), sz = Math.abs(z1 - z0);
  // `cap` (rails, guards): a static collider's top is standable, so the top 0.3 m of a tall box is a NON-walkable dynamic
  // box (as W4a's `moveOnlyCollider` in grey.ts) and the static box stops 0.3 m below it.
  const capped = cap && y1 - y0 > 0.5;
  const sy1 = capped ? y1 - 0.3 : y1;
  const m = b.m.clone().multiply(new THREE.Matrix4().compose(_p.set(cx, (y0 + sy1) / 2, cz), _q.identity(), _s.set(sx, Math.abs(sy1 - y0), sz)));
  let list = MOVE_ONLY.get(L);
  if (!list) MOVE_ONLY.set(L, (list = []));
  list.push(m);
  if (capped) {
    const mc = b.m.clone().multiply(new THREE.Matrix4().compose(_p.set(cx, (sy1 + y1) / 2, cz), _q.identity(), _s.set(sx, y1 - sy1, sz)));
    const pb = L.ctx.physics.addBox(aabbOf(mc, new THREE.Box3()), 'metal');
    pb.walkable = false;
  }
  if (nav) {
    const box = aabbOf(b.m.clone().multiply(new THREE.Matrix4().compose(_p.set(cx, (y0 + y1) / 2, cz), _q.identity(), _s.set(sx, Math.abs(y1 - y0), sz))), new THREE.Box3());
    if (box.max.y > 0.2 && box.min.y < 1.5) L.obstacles.push(box.clone());
    L.navSolids.push(box);
  }
}
/** Every move-only box of the level as ONE invisible collider mesh (`userData.moveOnly`, surface 'metal'), or null. */
export function moveOnlyColliders6(L: LevelBuild): THREE.Mesh | null {
  const list = MOVE_ONLY.get(L);
  if (!list?.length) return null;
  const geo = mergeItems(list.map((m) => ({ geo: unitBox(), m, uv: 'box' as const, su: 1, sv: 1 })));
  geo.deleteAttribute('uv');
  const mesh = new THREE.Mesh(geo);
  mesh.name = 'collider:moveOnly';
  mesh.userData.surface = 'metal';
  mesh.userData.moveOnly = true;
  mesh.visible = false;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// ───────────────────────────────────────────────────────────── signs / strips

/** Stencil sign through the zone's atlas (W5's `navy` style by default): centre ON the surface, `face` = its normal. */
export function stencil6(b: Builder, text: string, x: number, y: number, z: number, w: number, h: number, face: Face, o: { plate?: boolean; rot?: number; style?: 'navy' | 'stencil' | 'warning' | 'danger' | 'label' } = {}) {
  b.detail(() => b.sign(text, o.style ?? 'navy', x, y, z, w, h, face, o.rot ?? 0, o.plate ?? false));
}

/**
 * Floor strip (emergency / trench LED / nosing) from (ax, az) to (bx, bz) at local `y` — builder-frame coordinates.
 * A U-channel (two 1 cm lips) with the lens between them, its top 5 mm proud of the lips. 5 cm wide. Run it ≥ 0.08 m off
 * a wall base. Calls: 1 (`channel`, steel_raw — pass the prop's own material to save it) + the channel's strip (shared).
 */
export function strip6(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number, o: { y?: number; ch?: StripChannel6; channel?: Mat } = {}) {
  const y = o.y ?? 0, len = Math.hypot(bx - ax, bz - az);
  if (len < 0.05) return;
  const M = stripMat6(L, o.ch ?? 'emerg');
  b.push((ax + bx) / 2, y, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
  b.detail(() => {
    for (const s of [-1, 1]) b.bx(o.channel ?? 'steel_raw', s * 0.015, 0, -len / 2, s * 0.025, 0.008, len / 2);
    b.bx(M, -0.015, 0, -len / 2 + 0.005, 0.015, 0.013, len / 2 - 0.005);
  });
  b.pop();
}

// ═════════════════════════════════════════════════════════════ TUNNELS

/**
 * Structural ring (§2.6.2: every 16 m in tun6_a / tun6_b; jambs 0.3 m proud, x ±2.0 … 2.3, z ±0.2, header y 3.4 … 4.0).
 * Floor prop, origin on the tunnel's centre line at floor level; the ring spans local x (`w` 4.6 between the lining
 * faces), `depth` (0.4) along z. A cast ring of shotcrete with 45° haunches in the header corners and chamfered inner
 * arrises; a steel ring beam (an H-section's flange) faces the inner perimeter, fish plates bolted at the header
 * corners, anchor-bolt heads, a stencilled ring number. Calls: 2 (tunnel_shotcrete + steel_raw) + atlas.
 * Collider: the two jambs (too shallow for cover; `collide`).
 */
export function tunnelRing(b: Builder, L: LevelBuild, o: { w?: number; h?: number; jamb?: number; depth?: number; header?: number; label?: string; collide?: boolean } = {}) {
  const w = o.w ?? 4.6, h = o.h ?? 4.0, j = o.jamb ?? 0.3, d = o.depth ?? 0.4, hy = o.header ?? 3.4, C = tmat6(L, 'tunnel_shotcrete'), S: Mat = 'steel_raw';
  const xi = w / 2 - j, dz = d / 2;
  for (const s of [-1, 1]) {
    b.bx(C, Math.min(s * xi, s * w / 2), 0, -dz, Math.max(s * xi, s * w / 2), hy, dz);
    // chamfered inner arrises (small 45° fillets along the jamb's inner corners)
    for (const zs of [-1, 1]) b.rbox(C, s * (xi + 0.012), hy / 2, zs * (dz - 0.012), 0.05, hy, 0.05, 0, PI / 4, 0);
    // header haunch (45°, 0.35 legs)
    b.rbox(C, s * (xi - 0.12), hy - 0.12, 0, 0.36, 0.36, d - 0.02, 0, 0, s * PI / 4);
  }
  b.bx(C, -w / 2, hy, -dz, w / 2, h, dz);
  // steel ring beam flange on the inner perimeter (2 cm proud, 0.22 wide), fish plates and anchor heads
  const fw = 0.11;
  for (const s of [-1, 1]) b.bx(S, Math.min(s * xi, s * (xi - 0.02)), 0.15, -fw, Math.max(s * xi, s * (xi - 0.02)), hy - 0.25, fw);
  b.bx(S, -xi + 0.25, hy - 0.02, -fw, xi - 0.25, hy, fw);
  b.detail(() => {
    for (const s of [-1, 1]) {
      for (const zs of [-1, 1]) b.bx(S, Math.min(s * xi, s * (xi - 0.03)), hy - 0.5, zs * dz - (zs > 0 ? 0.13 : -0.01), Math.max(s * xi, s * (xi - 0.03)), hy - 0.25, zs * dz - (zs > 0 ? 0.01 : -0.13));
      for (let y = 0.5; y < hy - 0.5; y += 0.7) b.cyl(S, s * (xi - 0.03), y, 0, 0.018, 0.02, 'x', 6);
    }
    for (let x = -xi + 0.5; x < xi - 0.4; x += 0.7) b.cyl(S, x, hy - 0.03, 0, 0.018, 0.02, 'y', 6);
  });
  if (o.label) stencil6(b, o.label, -xi - 0.15, 2.4, dz + 0.001, 0.26, 0.12, '+z');
  if (o.collide !== false) for (const s of [-1, 1]) b.collide(Math.min(s * xi, s * w / 2), 0, -dz, Math.max(s * xi, s * w / 2), hy, dz, 'concrete', true);
}

/**
 * Cable trays on a tunnel wall, merged per run (§2.6.2: west y 2.0 / 2.6 / 3.2, east 2.0 / 2.6). Wall prop, origin on
 * the wall face at FLOOR level; runs along local x from −len/2 to len/2. Strut-channel uprights every 1.5 m (one per
 * run, spanning every tier), a cantilever arm per tier per upright (braced under the lowest), galvanised ladder trays
 * `w` (0.45) wide at the `tiers` heights (tray bottom), rungs every 0.3, power cables laid in each tier (`fill`, per
 * tier, default 5), cable ties. `skip` [x0, x1][] leaves gaps (a ring, a door). Calls: 2 (steel_raw + rubber).
 * No collider (above the 2.0 m body corridor).
 */
export function cableTrays(b: Builder, L: LevelBuild, o: { len: number; tiers?: number[]; w?: number; fill?: number[]; skip?: [number, number][]; seed?: number }) {
  const len = o.len, tiers = o.tiers ?? [2.0, 2.6], w = o.w ?? 0.45, S: Mat = 'steel_raw', K: Mat = 'rubber', R = srand(o.seed ?? 17);
  const skip = o.skip ?? [];
  const runs: [number, number][] = [];
  { let u = -len / 2; for (const [a, c] of [...skip].sort((p, q) => p[0] - q[0])) { if (a > u + 0.1) runs.push([u, a]); u = Math.max(u, c); } if (len / 2 > u + 0.1) runs.push([u, len / 2]); }
  const lo = Math.min(...tiers), hi = Math.max(...tiers);
  for (const [r0, r1] of runs) {
    const rl = r1 - r0, rc = (r0 + r1) / 2;
    // uprights + arms
    for (let x = r0 + 0.25; x < r1 - 0.05; x += 1.5) {
      b.bx(S, x - 0.02, lo - 0.3, 0, x + 0.02, hi + 0.25, 0.04);
      b.detail(() => { for (let y = lo - 0.25; y < hi + 0.2; y += 0.1) b.bx(S, x - 0.008, y, 0.04, x + 0.008, y + 0.03, 0.041); });
      for (const y of tiers) b.bx(S, x - 0.02, y - 0.04, 0.04, x + 0.02, y, w + 0.1);
      b.rod(S, x, lo - 0.28, 0.04, x, lo - 0.04, w * 0.7, 0.012, 5);
    }
    for (const y of tiers) {
      // ladder tray side rails (C profile: web + top lip) and rungs
      for (const z of [0.06, w + 0.06]) {
        b.bx(S, r0, y, z - 0.003, r1, y + 0.1, z + 0.003);
        b.bx(S, r0, y + 0.094, Math.min(z, z + (z < 0.1 ? 0.02 : -0.02)), r1, y + 0.1, Math.max(z, z + (z < 0.1 ? 0.02 : -0.02)));
      }
      b.detail(() => { for (let x = r0 + 0.15; x < r1; x += 0.3) b.bx(S, x - 0.015, y, 0.063, x + 0.015, y + 0.012, w + 0.057); });
      const nc = (o.fill ?? [])[tiers.indexOf(y)] ?? 5;
      for (let i = 0; i < nc; i++) {
        const r = 0.014 + R() * 0.022, z = 0.09 + (i / Math.max(1, nc - 1)) * (w - 0.07), wob = (R() - 0.5) * 0.01;
        b.cyl(K, rc, y + 0.012 + r, z + wob, r, rl - 0.04, 'x', 8);
      }
      b.detail(() => { for (let x = r0 + 0.8; x < r1 - 0.3; x += 1.6) b.bx(K, x - 0.006, y + 0.012, 0.07, x + 0.006, y + 0.075, w + 0.05); });
    }
  }
}

/**
 * The trunk (§2.6: ⌀ 0.25 armoured sea-cable trunk, yellow bands every 2 m) along a polyline `pts` (builder-frame
 * [x, y, z]; give it a sag where it hangs), cleated every `cleats` (1.5) m with galvanised two-bolt cleats (`cleatDown`:
 * the cleat's base sits below the cable, on a tray). Calls: 2 (cable_armour + painted_yellow). No collider.
 */
export function trunkRun(b: Builder, L: LevelBuild, o: { pts: [number, number, number][]; r?: number; bands?: number; cleats?: number | null }) {
  const r = o.r ?? 0.125, every = o.bands ?? 2.0, pts = o.pts, A = tmat6(L, 'cable_armour'), Y: Mat = 'painted_yellow';
  hose(b, A, pts, r, 14, 4);
  let nextBand = every / 2, nextCleat = (o.cleats ?? 1.5) / 2, run = 0;
  const ce = o.cleats === null ? Infinity : o.cleats ?? 1.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), c = new THREE.Vector3(...pts[i + 1]), seg = a.distanceTo(c), dir = c.clone().sub(a).normalize();
    for (; nextBand < run + seg; nextBand += every) {
      const p = a.clone().addScaledVector(dir, nextBand - run);
      b.rod(Y, p.x - dir.x * 0.05, p.y - dir.y * 0.05, p.z - dir.z * 0.05, p.x + dir.x * 0.05, p.y + dir.y * 0.05, p.z + dir.z * 0.05, r + 0.006, 14);
    }
    for (; nextCleat < run + seg; nextCleat += ce) {
      const p = a.clone().addScaledVector(dir, nextCleat - run);
      const yaw = Math.atan2(dir.x, dir.z);
      b.push(p.x, p.y, p.z, yaw);
      b.detail(() => {
        b.torus(A, 0, 0, 0, r + 0.018, 0.012, 'z', 16);
        b.bx(A, -r - 0.05, -r - 0.03, -0.03, r + 0.05, -r - 0.012, 0.03);
        for (const s of [-1, 1]) b.cyl(A, s * (r + 0.035), -r - 0.01, 0, 0.012, 0.05, 'y', 6);
      });
      b.pop();
    }
    run += seg;
  }
}

/**
 * Small bracket shelf (§5.2: the JB / RH / NR pickups at y 1.0, ≤ 0.3 m from the face). Wall prop, origin on the face at
 * FLOOR level: a 3 mm shelf plate `w` (0.5) × `d` (0.3) with its top at `top` (1.0), a 3 cm front lip, two triangular
 * gusset brackets and a back strap. Returns the world point of the item spot (on the plate, `item` (d / 2) out).
 * Calls: 1 (`mat`, navy_grey). No collider (below the parent's collider face? no: it stands proud — `collide` adds a
 * thin box under the plate so a body cannot stand inside it).
 */
export function bracketShelf(b: Builder, L: LevelBuild, o: { w?: number; d?: number; top?: number; item?: number; mat?: Mat; collide?: boolean } = {}): THREE.Vector3 {
  const w = o.w ?? 0.5, d = o.d ?? 0.3, t = o.top ?? 1.0, M: Mat = o.mat ?? 'navy_grey';
  b.bx(M, -w / 2, t - 0.004, 0.003, w / 2, t, d);
  b.bx(M, -w / 2, t - 0.004, d - 0.004, w / 2, t + 0.03, d); // lip
  b.bx(M, -w / 2 + 0.03, t - 0.2, 0, w / 2 - 0.03, t - 0.004, 0.006); // back strap
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.06);
    b.bx(M, x - 0.004, t - 0.03, 0.006, x + 0.004, t - 0.004, d - 0.02);
    b.rbox(M, x, t - 0.11, d * 0.42, 0.008, 0.025, Math.hypot(0.19, d * 0.84), Math.atan2(0.19, d * 0.84), 0, 0);
  }
  b.detail(() => { for (const s of [-1, 1]) b.cyl(M, s * (w / 2 - 0.12), t - 0.1, 0.008, 0.012, 0.008, 'z', 6); });
  if (o.collide !== false) b.collide(-w / 2, t - 0.2, 0, w / 2, t, d, 'metal', false);
  return b.world(0, t, o.item ?? d * 0.5);
}

/**
 * Junction box (§2.6.2 JB1–JB4: 0.9 deep from the wall × 1.6 long, h 1.8, HIGH cover). Wall prop, origin on the wall face
 * at floor level, `len` (1.6) along x, `d` (0.9) out (+z = the corridor face). A haze-grey floor-standing steel
 * enclosure on a dark plinth: two doors (1 cm proud, hinged on the outer edges) either side of a fixed centre mullion,
 * three-point T-handles and a padlock hasp, a drip canopy at 1.8, louvres on the ends, three conduits rising from its top
 * to the tray at 2.0, an earth bar, a rating plate and a `위험 — 400 V` sign. `shelf` hangs a bracket shelf on the
 * mullion with its plate top at 1.0 (the §5.2 pickups: item 0.15 m out of the face). Calls: 2 (navy_grey +
 * painted_dark) + atlas. Collider: exactly `len` × `d` × 1.8 (+ the shelf's thin box).
 */
export function junctionBox(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; label?: string; shelf?: boolean; collide?: boolean } = {}): { shelf: THREE.Vector3 | null } {
  const len = o.len ?? 1.6, d = o.d ?? 0.9, h = o.h ?? 1.8, N: Mat = 'navy_grey', K: Mat = 'painted_dark';
  b.bx(K, -len / 2 + 0.03, 0, 0.03, len / 2 - 0.03, 0.1, d - 0.03);
  b.bx(N, -len / 2, 0.1, 0, len / 2, h - 0.05, d - 0.02);
  b.bx(N, -len / 2 - 0.02, h - 0.05, 0, len / 2 + 0.02, h, d + 0.01); // canopy (the collider top)
  const mx = 0.04;
  b.bx(N, -mx, 0.14, d - 0.02, mx, h - 0.09, d - 0.004); // mullion
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -len / 2 + 0.04 : mx + 0.008, xb = s < 0 ? -mx - 0.008 : len / 2 - 0.04;
    b.bx(N, xa, 0.16, d - 0.02, xb, h - 0.11, d - 0.008);
    b.detail(() => {
      // door stiffener seam, hinges, T-handle, louvres on the end
      b.bx(K, xa + 0.04, 0.2, d - 0.008, xb - 0.04, 0.205, d - 0.004);
      for (const y of [0.4, h - 0.4]) b.cyl(K, s < 0 ? xa - 0.006 : xb + 0.006, y, d - 0.012, 0.012, 0.1, 'y', 8);
      const hx = s < 0 ? xb - 0.07 : xa + 0.07;
      b.cyl(K, hx, 1.25, d - 0.004, 0.022, 0.03, 'z', 10);
      b.bx(K, hx - 0.012, 1.13, d + 0.006, hx + 0.012, 1.37, d + 0.026);
      for (let k = 0; k < 6; k++) b.bx(N, s * (len / 2) + (s < 0 ? -0.006 : 0), h - 0.55 + k * 0.06, d * 0.3, s * (len / 2) + (s < 0 ? 0 : 0.006), h - 0.53 + k * 0.06, d * 0.7);
    });
  }
  b.detail(() => {
    b.bx(K, -0.03, 1.36, d - 0.004, 0.03, 1.44, d + 0.01); // hasp
    b.bx(K, -len / 2 + 0.1, 0.12, d - 0.02, -len / 2 + 0.5, 0.15, d + 0.005); // earth bar
    for (const x of [-0.45, 0.0, 0.45]) { b.cyl(K, x, h + 0.02, 0.18, 0.04, 0.04, 'y', 10); b.cyl(K, x, h + 0.13, 0.12, 0.028, 0.22, 'y', 8); b.rod(K, x, h + 0.24, 0.12, x, h + 0.3, 0.04, 0.028, 8); }
  });
  stencil6(b, o.label ?? 'JB 24', -len / 4, h - 0.2, d - 0.007, 0.3, 0.09, '+z');
  stencil6(b, '위험 — 400 V', len / 4, h - 0.22, d - 0.007, 0.36, 0.1, '+z', { style: 'danger' });
  let shelf: THREE.Vector3 | null = null;
  if (o.shelf) b.at(0, 0, d - 0.004, 0, () => { shelf = bracketShelf(b, L, { w: 0.42, d: 0.3, top: 1.0, collide: o.collide }); });
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
  return { shelf };
}

/**
 * Drum trolley (§2.6.2 DT1 / DT2: a ⌀ 1.2 cable drum on a 0.1 m trolley, h 1.3, footprint 1.6 × 1.0, LOW cover).
 * Floor prop, origin = floor centre, footprint `len` 1.6 (x) × 1.0 (z), the drum's axis along local z. A low yellow
 * trolley frame on four castors with a tow bar at +x; the steel drum sits in chocks on it: two ribbed flanges (⌀ 1.2)
 * with an arbor hub, the cable wound in an outer layer of turns between them, its tail taped down to the flange.
 * Calls: 2 (painted_yellow + rubber). Collider: footprint to 1.3.
 */
export function drumTrolley(b: Builder, L: LevelBuild, o: { len?: number; d?: number; collide?: boolean } = {}) {
  const len = o.len ?? 1.6, d = o.d ?? 1.0, Y: Mat = 'painted_yellow', K: Mat = 'rubber', R = 0.6, cy = 0.1 + R, fz = d / 2 - 0.06;
  // trolley
  for (const s of [-1, 1]) b.bx(Y, -len / 2, 0.05, s * (d / 2) - (s > 0 ? 0.06 : 0), len / 2 - 0.15, 0.1, s * (d / 2) + (s < 0 ? 0.06 : 0));
  for (const x of [-len / 2 + 0.03, -0.25, 0.25, len / 2 - 0.18]) b.bx(Y, x, 0.05, -d / 2 + 0.06, x + 0.12, 0.1, d / 2 - 0.06);
  for (const x of [-len / 2 + 0.14, len / 2 - 0.3]) for (const s of [-1, 1]) { b.cyl(K, x, 0.04, s * (d / 2 - 0.08), 0.04, 0.03, 'z', 10); b.bx(Y, x - 0.03, 0.045, s * (d / 2 - 0.08) - 0.03, x + 0.03, 0.05, s * (d / 2 - 0.08) + 0.03); }
  b.rod(Y, len / 2 - 0.15, 0.08, -0.25, len / 2 + 0.0, 0.08, 0, 0.02, 6);
  b.rod(Y, len / 2 - 0.15, 0.08, 0.25, len / 2 + 0.0, 0.08, 0, 0.02, 6);
  b.torus(Y, len / 2 + 0.04, 0.08, 0, 0.04, 0.012, 'y', 10);
  // chocks
  for (const s of [-1, 1]) for (const zs of [-1, 1]) b.rbox(Y, s * 0.42, 0.16, zs * fz, 0.18, 0.1, 0.08, 0, 0, -s * 0.5);
  // drum: flanges (with radial ribs on the outer faces), barrel, wound cable, arbor hub
  for (const zs of [-1, 1]) {
    b.cyl(Y, 0, cy, zs * fz, R, 0.03, 'z', 28);
    b.detail(() => {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; b.push(0, cy, zs * (fz + 0.025), 0, 0, a); b.bx(Y, 0.12, -0.012, -0.01, R - 0.04, 0.012, 0.01); b.pop(); }
      b.cyl(Y, 0, cy, zs * (fz + 0.04), 0.11, 0.05, 'z', 14);
      b.cyl(K, 0, cy, zs * (fz + 0.066), 0.045, 0.004, 'z', 10);
    });
  }
  b.cyl(K, 0, cy, 0, 0.5, 2 * fz - 0.07, 'z', 24);
  for (let k = 0; k < 9; k++) { const z = -fz + 0.07 + k * ((2 * fz - 0.14) / 8); b.torus(K, 0, cy, z, 0.5, 0.034, 'z', 28); }
  b.detail(() => { b.rod(K, 0.42, cy + 0.28, fz - 0.05, 0.36, cy + 0.42, fz - 0.03, 0.03, 8); b.bx(Y, 0.3, cy + 0.36, fz + 0.015, 0.44, cy + 0.44, fz + 0.02); });
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, 1.3, d / 2, 'metal', true);
}

/**
 * Tunnel light fitting (§2.6.2: caged fluorescents every 8 m; tun6_b: dead, one hanging by its cable at z −118).
 * CEILING prop by default (origin on the ceiling, hanging −y; `mount: 'wall'` = origin on the wall face at the fitting's
 * height, lamp axis along x). A 1.2 m steel batten on drop rods with an opal diffuser and a four-rod wire guard, end
 * caps, a conduit. `lit` (true) = the shared `lampLens6(color, 0.35)`; false = the dead lens (intensity 0); `lens`
 * overrides (e.g. `L.glow(handle, …)`). `hanging: true` = the fitting has torn off one drop rod and hangs by its
 * cable from the other end (a moving part that sways slowly; `sway(on)`). Calls: 1 static (steel_raw) + the lens;
 * hanging: 1 static (the rod + hook) + 2 moving (steel + lens).
 */
export function tunnelFitting(b: Builder, L: LevelBuild, o: { len?: number; drop?: number; mount?: 'ceiling' | 'wall'; lit?: boolean; color?: LampColor6; lens?: THREE.MeshStandardMaterial; hanging?: boolean; name?: string } = {}): { lens: THREE.MeshStandardMaterial; centre: THREE.Vector3; sway?: (on: boolean) => void; part?: MovingPart6 } {
  const len = o.len ?? 1.2, drop = o.drop ?? 0.25, S: Mat = 'steel_raw';
  const lens = o.lens ?? lampLens6(L, o.color ?? 'white', o.lit === false ? 0 : 0.35);
  const fitting = (p: Builder, y: number) => {
    p.bx(S, -len / 2, y - 0.03, -0.06, len / 2, y + 0.03, 0.06);
    p.bx(lens, -len / 2 + 0.04, y - 0.09, -0.045, len / 2 - 0.04, y - 0.03, 0.045);
    for (const s of [-1, 1]) p.bx(S, s * (len / 2) - (s > 0 ? 0.04 : 0), y - 0.1, -0.06, s * (len / 2) + (s < 0 ? 0.04 : 0), y + 0.03, 0.06);
    p.detail(() => {
      for (const z of [-0.06, 0.06]) p.rod(S, -len / 2 + 0.04, y - 0.1, z, len / 2 - 0.04, y - 0.1, z, 0.004, 4);
      p.rod(S, -len / 2 + 0.04, y - 0.125, 0, len / 2 - 0.04, y - 0.125, 0, 0.004, 4);
      for (let x = -len / 2 + 0.2; x < len / 2 - 0.1; x += 0.2) for (const s of [-1, 1]) p.rod(S, x, y - 0.03, s * 0.06, x, y - 0.1, s * 0.06, 0.004, 4), p.rod(S, x, y - 0.1, s * 0.06, x, y - 0.125, 0, 0.004, 4);
    });
  };
  if (o.mount === 'wall') {
    b.push(0, 0, 0.12, 0);
    b.bx(S, -0.05, -0.06, -0.12, 0.05, 0.06, -0.06);
    fitting(b, 0.06);
    const centre = b.world(0, 0, 0);
    b.pop();
    return { lens, centre };
  }
  if (!o.hanging) {
    for (const s of [-1, 1]) b.rod(S, s * (len / 2 - 0.15), 0, 0, s * (len / 2 - 0.15), -drop + 0.03, 0, 0.008, 6);
    b.detail(() => b.rod(S, -len / 2 - 0.4, -0.02, 0.05, -len / 2, -0.02, 0.05, 0.012, 6));
    fitting(b, -drop);
    return { lens, centre: b.world(0, -drop - 0.06, 0) };
  }
  // hanging by its cable from the −x end: the torn rod stays on the ceiling, the fitting dangles
  b.rod(S, len / 2 - 0.15, 0, 0, len / 2 - 0.15, -drop * 0.5, 0, 0.008, 6);
  b.rod(S, -len / 2 + 0.15, 0, 0, -len / 2 + 0.15, -drop + 0.03, 0, 0.008, 6);
  const hx = -len / 2 + 0.15, hy = -drop + 0.03;
  const part = part6(b, L, o.name ?? 'fitting6_hang', hx, hy, 0, (p) => {
    p.rod(S, 0, 0, 0, 0, -0.35, 0, 0.007, 5);
    p.push(0, -0.35, 0, 0, 0, -PI / 2 + 0.12);
    p.push(len / 2 - 0.15, 0.03, 0, 0);
    fitting(p, 0);
    p.pop(); p.pop();
  });
  let on = true, t = 0;
  L.updaters.push((dt) => { if (!on) return; t += dt; part.pivot.rotation.z = Math.sin(t * 1.3) * 0.04; part.pivot.rotation.x = Math.sin(t * 0.9 + 1) * 0.03; });
  return { lens, centre: b.world(hx, hy - 0.9, 0), part, sway: (v) => { on = v; if (!v) part.pivot.rotation.set(0, 0, 0); } };
}

/**
 * Dewatering pipe on the tunnel wall at y 0.2 (§2.6.2: ⌀ 0.15, a walkable kerb). Wall prop, origin on the wall face at
 * floor level, along x (`len`): the pipe on saddle clamps every 3 m, flanged joints every 6 m. Calls: 1 (`mat`,
 * painted_dark). Collider: none (W4a's kerb collider; `collide` adds a 0.15 box if you need it).
 */
export function dewaterPipe(b: Builder, L: LevelBuild, o: { len: number; r?: number; y?: number; mat?: Mat; collide?: boolean }) {
  const r = o.r ?? 0.075, y = o.y ?? 0.2, M: Mat = o.mat ?? tint6(L, 'pipe_green', 'painted_white', 0x4d5d52, { roughness: 0.55 }), len = o.len;
  b.cyl(M, 0, y, r + 0.005, r, len, 'x', 14);
  b.detail(() => {
    for (let x = -len / 2 + 1.5; x < len / 2; x += 3) { b.torus(M, x, y, r + 0.005, r + 0.008, 0.008, 'x', 14); b.bx(M, x - 0.025, y - r - 0.04, 0, x + 0.025, y - r + 0.01, r * 2 + 0.01); }
    for (let x = -len / 2 + 3; x < len / 2; x += 6) b.cyl(M, x, y, r + 0.005, r + 0.03, 0.04, 'x', 14);
  });
  if (o.collide) b.collide(-len / 2, 0, 0, len / 2, y + r, 2 * r + 0.01, 'metal', false);
}

/**
 * Flush grated drain on the tunnel's centre line (§2.6.2). Floor prop along local z (`len`), `w` (0.3): a galvanised
 * bar grating in an angle frame flush with the invert, a dark channel 0.15 below it (no collider: the greybox floor
 * carries the walk). Calls: 2 (deck_grate + steel_raw).
 */
export function tunnelDrain(b: Builder, L: LevelBuild, o: { len: number; w?: number }) {
  const w = o.w ?? 0.3, len = o.len, G: Mat = 'deck_grate', S: Mat = 'steel_raw';
  b.solid(() => b.quad(G, 0, 0.004, 0, w, len, '+y', 0, 'box'));
  for (const s of [-1, 1]) b.bx(S, s * (w / 2) - (s > 0 ? 0 : 0.03), -0.04, -len / 2, s * (w / 2) + (s < 0 ? 0 : 0.03), 0.006, len / 2);
  b.bx(S, -w / 2, -0.16, -len / 2, w / 2, -0.15, len / 2);
}

// ═════════════════════════════════════════════════════════════ REPEATER 2 / JOINT BAY

/**
 * Repeater bank (§2.6.3 RB: line-amplifier cabinets against rep6's west wall, 1.2 deep × 8.0 long, h 2.2). Wall prop,
 * origin on the wall face at floor level, `len` along x, `d` out. A row of 0.8 m steel cabinets on a dark plinth:
 * each door has a wired window onto an amplifier card cage with status LEDs (the shared `ledMat6`), louvres low, a
 * swing handle and a label (`LA 2-01` …); a cable ladder runs along the top and back to the wall where the trunk
 * enters. Calls: 2 (navy_grey + painted_dark) + LEDs (shared) + atlas. Collider: `len` × `d` × `h`.
 */
export function repeaterBank(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; prefix?: string; collide?: boolean } = {}) {
  const len = o.len ?? 8.0, d = o.d ?? 1.2, h = o.h ?? 2.2, N: Mat = 'navy_grey', K: Mat = 'painted_dark', LED = ledMat6(L);
  const n = Math.max(1, Math.round(len / 0.8)), cw = len / n;
  b.bx(K, -len / 2 + 0.02, 0, 0.04, len / 2 - 0.02, 0.1, d - 0.04);
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * cw, x1 = x0 + cw, xc = (x0 + x1) / 2;
    b.bx(N, x0 + 0.004, 0.1, 0, x1 - 0.004, h, d - 0.02);
    b.bx(N, x0 + 0.02, 0.14, d - 0.02, x1 - 0.02, h - 0.06, d - 0.008); // door
    b.bx(K, x0 + 0.1, 1.05, d - 0.008, x1 - 0.1, 1.95, d - 0.004); // window (dark glass onto the cage)
    b.detail(() => {
      for (let k = 0; k < 4; k++) {
        const y = 1.12 + k * 0.21;
        b.bx(N, x0 + 0.12, y, d - 0.004, x1 - 0.12, y + 0.012, d - 0.0); // card cage rails behind the glass
        for (let c = 0; c < 6; c++) b.bx(LED, x0 + 0.16 + c * ((cw - 0.32) / 5) - 0.006, y + 0.06, d - 0.004, x0 + 0.16 + c * ((cw - 0.32) / 5) + 0.006, y + 0.075, d + 0.0015);
      }
      for (let k = 0; k < 6; k++) b.bx(K, x0 + 0.14, 0.3 + k * 0.05, d - 0.008, x1 - 0.14, 0.32 + k * 0.05, d + 0.002);
      b.bx(K, x1 - 0.09, 0.95, d - 0.008, x1 - 0.06, 1.2, d + 0.02);
      for (const y of [0.35, h - 0.35]) b.cyl(K, x0 + 0.025, y, d - 0.012, 0.012, 0.09, 'y', 8);
    });
    stencil6(b, `${o.prefix ?? 'LA 2-'}${String(i + 1).padStart(2, '0')}`, xc, h - 0.16, d - 0.007, 0.28, 0.08, '+z');
  }
  // cable ladder on top, back to the wall
  b.detail(() => {
    for (const z of [0.15, 0.55]) b.bx(K, -len / 2, h + 0.15, z, len / 2, h + 0.2, z + 0.01);
    for (let x = -len / 2 + 0.2; x < len / 2; x += 0.3) b.bx(K, x - 0.012, h + 0.15, 0.15, x + 0.012, h + 0.165, 0.56);
    for (let x = -len / 2 + 0.4; x < len / 2; x += 1.6) b.bx(K, x - 0.02, h, 0.3, x + 0.02, h + 0.15, 0.34);
  });
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
}

/**
 * Repeater housing (§2.6.4 RH1–RH3: 1.4 m deep from the wall × 2.0 long, h 2.0, HIGH cover). Wall prop, origin on the
 * wall face at floor level, `len` (2.0) along x, `d` (1.4) out. A horizontal cylindrical pressure housing (⌀ 1.1, domed
 * ends, a bolted mid flange, lifting lugs) on two saddles of a steel stand; the trunk enters both ends through bend
 * restrictors; a steel back frame to the wall and a front frame (posts + a rail at 0.95) carrying the optional bracket
 * shelf (`shelf`: plate top 1.0, item 0.15 m out of the 1.4 face); a nameplate. Calls: 2 (navy_grey + steel_raw) +
 * atlas. Collider: `len` × `d` × 2.0.
 */
export function repeaterHousing(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; label?: string; shelf?: boolean; collide?: boolean } = {}): { shelf: THREE.Vector3 | null } {
  const len = o.len ?? 2.0, d = o.d ?? 1.4, h = o.h ?? 2.0, N: Mat = 'navy_grey', S: Mat = 'steel_raw';
  const r = 0.55, cz = 0.76, cy = 1.3, body = len - 0.5;
  // stand: base frame, saddles, back frame, front posts + rail
  for (const z of [0.05, d - 0.05]) b.bx(N, -len / 2, 0, z - 0.05, len / 2, 0.1, z + 0.05);
  for (const x of [-len / 2 + 0.05, len / 2 - 0.05]) b.bx(N, x - 0.05, 0, 0.05, x + 0.05, 0.1, d - 0.05);
  for (const x of [-body / 2 + 0.25, body / 2 - 0.25]) {
    b.bx(N, x - 0.08, 0.1, cz - 0.42, x + 0.08, cy - 0.38, cz + 0.42);
    b.cyl(N, x, cy, cz, r + 0.02, 0.18, 'x', 24);
  }
  for (const x of [-len / 2 + 0.05, len / 2 - 0.05]) { b.bx(N, x - 0.04, 0.1, 0.0, x + 0.04, h - 0.04, 0.08); b.bx(N, x - 0.04, 0.1, d - 0.06, x + 0.04, 1.75, d); }
  b.bx(N, -len / 2, h - 0.08, 0.0, len / 2, h, 0.08);
  b.bx(N, -len / 2, 0.91, d - 0.05, len / 2, 0.95, d);
  // the housing
  b.cyl(N, 0, cy, cz, r, body, 'x', 28);
  for (const s of [-1, 1]) b.sphere(N, s * body / 2, cy, cz, r, 24, 1, 0.32, 1);
  b.cyl(S, 0, cy, cz, r + 0.03, 0.06, 'x', 28);
  b.detail(() => {
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; b.cyl(S, 0.04, cy + Math.cos(a) * (r + 0.015), cz + Math.sin(a) * (r + 0.015), 0.014, 0.03, 'x', 6); }
    for (const x of [-0.45, 0.45]) b.torus(S, x, cy + r + 0.05, cz, 0.05, 0.012, 'x', 10);
    for (let k = 0; k < 6; k++) b.bx(N, -0.6 + k * 0.24 - 0.008, cy + r - 0.02, cz - 0.25, -0.6 + k * 0.24 + 0.008, cy + r + 0.03, cz + 0.25); // cooling fins on top
  });
  // bend restrictors (cones) and the trunk in/out at both ends
  for (const s of [-1, 1]) b.cyl(S, s * (body / 2 + r * 0.32 + 0.12), cy, cz, 0.09, 0.26, 'x', 14, 0.15);
  stencil6(b, o.label ?? 'REPEATER HSG 2-B — HALCYON SUBSEA', 0, cy - 0.12, cz + r + 0.001, 0.8, 0.07, '+z');
  let shelf: THREE.Vector3 | null = null;
  if (o.shelf) b.at(0, 0, d, 0, () => { shelf = bracketShelf(b, L, { w: 0.45, d: 0.3, top: 1.0, collide: o.collide }); });
  if (o.collide !== false) b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true);
  return { shelf };
}

/** The drum's moving parts and its v6_drum timeline. */
export interface CableDrum {
  drum: MovingPart6;
  pawl: MovingPart6 | null;
  brake: MovingPart6 | null;
  /** Axis point (world). */
  axis: THREE.Vector3;
  /** v6_drum: starts to turn by itself, ratchet clacking faster, brakes with a bang, rocks still. Times in s from the call. */
  run(): { dur: number; rumble: number; brake: number; clacks: number[] };
  at(t: number): void;
  snap(): void;
  /** Turned angle (rad) so far. */
  readonly angle: number;
}
/**
 * Large cable drum (§2.6.3 DS1 / DS2 on a roller cradle: footprint 2.6 × 1.4, h 2.6; §2.6.7 CD1–CD3 on jack stands:
 * ⌀ 4.0, footprint 4.0 × 2.4, h 4.4). Floor prop, origin = floor centre, drum axis along local z, footprint x = the
 * diameter direction. `mount 'cradle'` (static): ⌀ 2.36 steel drum resting on four rollers of a low frame. `mount
 * 'stand'`: ⌀ 4.0 drum on a spindle between two A-frame jack stands; with `ratchet` (CD2, `v6_drum`) the DRUM is a moving
 * part (flanges, barrel, cable, the ratchet teeth on the +z flange's rim), and a brake post on the drum's +x side (the
 * plan's "east stand at x −16.5" for ry 0) carries the ratchet PAWL and the BRAKE lever (both moving). The sea cable
 * (cable armour) is wound in an outer layer of turns; a tail runs from under the drum to the floor (static: it stays
 * put while the drum turns). Calls — cradle: 2 (drum paint + cable_armour); stand: static 2 (navy_grey + cable_armour),
 * the drum 2 moving (drum paint + cable_armour), pawl 1, brake 1; without `ratchet` the drum is static (2 + 2 → the
 * stand's navy_grey + drum paint + cable_armour = 3; use `ratchet` or accept 3 — CD1 / CD3 pass `plain: true` for a
 * 2-call version with the drum in navy_grey). Collider: footprint to the top.
 */
export function cableDrum(b: Builder, L: LevelBuild, o: { mount?: 'cradle' | 'stand'; dia?: number; width?: number; ratchet?: boolean; plain?: boolean; tail?: boolean; name?: string; collide?: boolean } = {}): CableDrum {
  const mount = o.mount ?? 'stand', A = tmat6(L, 'cable_armour'), N: Mat = 'navy_grey';
  const D: Mat = mount === 'stand' && o.plain && !o.ratchet ? N : drumPaint(L);
  const R = (o.dia ?? (mount === 'stand' ? 4.0 : 2.36)) / 2, W = o.width ?? (mount === 'stand' ? 1.9 : 1.25);
  const cy = mount === 'stand' ? 2.4 : 1.3, fz = W / 2;
  const turns = Math.max(4, Math.floor((W - 0.12) / 0.13));
  const drumGeo = (p: Builder, y: number, teeth: boolean) => {
    for (const zs of [-1, 1]) {
      p.cyl(D, 0, y, zs * fz, R, 0.04, 'z', 40);
      p.detail(() => {
        // flange stiffeners + lightening holes (dark discs)
        for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; p.push(0, y, zs * (fz + 0.03), 0, 0, a); p.bx(D, R * 0.18, -0.02, -0.012, R - 0.06, 0.02, 0.012); p.pop(); }
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; p.cyl(A, Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, zs * (fz + 0.034), R * 0.14, 0.012, 'z', 16); }
        p.cyl(D, 0, y, zs * (fz + 0.05), R * 0.14, 0.08, 'z', 18);
      });
    }
    p.cyl(A, 0, y, 0, R - 0.1, W - 0.1, 'z', 36);
    for (let k = 0; k < turns; k++) { const z = -fz + 0.08 + k * ((W - 0.16) / Math.max(1, turns - 1)); p.torus(A, 0, y, z, R - 0.1, 0.062, 'z', 40); }
    if (teeth) {
      // ratchet teeth on the +z flange's rim (outer face): 72 saw teeth
      for (let k = 0; k < 72; k++) { const a = (k / 72) * TAU; p.push(0, y, fz + 0.035, 0, 0, a); p.rbox(D, R - 0.03, 0.0, 0, 0.07, 0.05, 0.03, 0, 0, 0.6); p.pop(); }
    }
  };
  const tail = o.tail ?? (mount === 'stand');
  if (mount === 'cradle') {
    const rr = 0.09, th = 25 * PI / 180, rx = Math.sin(th) * (R + rr), ry = cy - Math.cos(th) * (R + rr);
    for (const z of [-fz - 0.02, fz + 0.02]) b.bx(D, -1.2, 0, z - 0.04, 1.2, 0.06, z + 0.04);
    for (const x of [-1.15, 1.15]) b.bx(D, x - 0.05, 0, -fz - 0.06, x + 0.05, 0.06, fz + 0.06);
    for (const s of [-1, 1]) for (const zs of [-1, 1]) { b.cyl(D, s * rx, ry, zs * fz, rr, 0.12, 'z', 14); b.bx(D, s * rx - 0.06, 0.06, zs * fz - 0.07, s * rx + 0.06, ry, zs * fz - 0.05); b.bx(D, s * rx - 0.06, 0.06, zs * fz + 0.05, s * rx + 0.06, ry, zs * fz + 0.07); }
    drumGeo(b, cy, false);
    if (tail) hose(b, A, [[R * 0.2, cy - R + 0.08, 0.2], [R * 0.5, 0.08, 0.3], [R + 0.5, 0.07, 0.4]], 0.062, 10, 6);
    if (o.collide !== false) b.collide(-1.3, 0, -0.7, 1.3, cy + R, 0.7, 'metal', true);
    const axis = b.world(0, cy, 0);
    return { drum: { mount: new THREE.Group(), pivot: new THREE.Group() }, pawl: null, brake: null, axis, run: () => ({ dur: 0, rumble: 0, brake: 0, clacks: [] }), at() {}, snap() {}, angle: 0 };
  }
  // jack stands at both ends (z ±(fz + 0.15)): two splayed legs, a base beam, a bearing block on the spindle
  const sz = fz + 0.17, legX = R * 0.8;
  for (const zs of [-1, 1]) {
    const z = zs * sz;
    b.bx(N, -legX - 0.15, 0, z - 0.1, legX + 0.15, 0.14, z + 0.1);
    for (const s of [-1, 1]) b.rod(N, s * legX, 0.12, z, s * 0.08, cy - 0.12, z, 0.07, 8);
    b.bx(N, -0.16, cy - 0.22, z - 0.09, 0.16, cy + 0.14, z + 0.09);
    b.cyl(N, 0, cy, z, 0.12, 0.2, 'z', 14);
    b.bx(N, -legX * 0.6, 1.0, z - 0.03, legX * 0.6, 1.08, z + 0.03); // cross tie
  }
  b.cyl(N, 0, cy, 0, 0.08, 2 * sz + 0.25, 'z', 14); // spindle
  if (tail) hose(b, A, [[R * 0.25, cy - R + 0.12, -0.3], [R * 0.45, 0.6, -0.45], [R * 0.6, 0.07, -0.6], [R + 0.8, 0.07, -0.7]], 0.062, 10, 6);
  let drum: MovingPart6, pawl: MovingPart6 | null = null, brake: MovingPart6 | null = null;
  const axis = b.world(0, cy, 0);
  if (!o.ratchet) {
    drumGeo(b, cy, false);
    drum = { mount: new THREE.Group(), pivot: new THREE.Group() };
    if (o.collide !== false) b.collide(-R, 0, -fz - 0.27, R, cy + R, fz + 0.27, 'metal', true);
    return { drum, pawl, brake, axis, run: () => ({ dur: 0, rumble: 0, brake: 0, clacks: [] }), at() {}, snap() {}, angle: 0 };
  }
  const nm = o.name ?? 'drum6';
  drum = part6(b, L, nm, 0, cy, 0, (p) => drumGeo(p, 0, true), { mover: false });
  // brake post on the +x side by the +z flange: floor to y cy + 0.4; pawl at axis height on the rim; brake lever below
  const px = R + 0.12, pz = fz + 0.06;
  b.bx(N, px - 0.06, 0, pz - 0.1, px + 0.1, 0.1, pz + 0.12);
  b.bx(N, px - 0.04, 0.1, pz - 0.04, px + 0.04, cy + 0.4, pz + 0.04);
  b.bx(N, px - 0.18, cy + 0.06, pz - 0.04, px + 0.04, cy + 0.14, pz + 0.04); // pawl bracket arm
  b.detail(() => stencil6(b, '정지 시 브레이크 체결', px + 0.041, 1.55, pz, 0.36, 0.06, '+x'));
  const S: Mat = 'steel_raw';
  pawl = part6(b, L, `${nm}_pawl`, R + 0.06, cy + 0.1, fz + 0.035, (p) => {
    p.cyl(S, 0, 0, 0, 0.03, 0.05, 'z', 10);
    p.rbox(S, -0.06, -0.045, 0, 0.16, 0.035, 0.03, 0, 0, -0.55);
  });
  const brakeMat = fireRed(L);
  brake = part6(b, L, `${nm}_brake`, px + 0.06, 1.7, pz + 0.07, (p) => {
    p.cyl(brakeMat, 0, 0, 0, 0.04, 0.04, 'z', 10);
    p.bx(brakeMat, -0.02, -0.75, -0.015, 0.02, 0.05, 0.015);
    p.cyl(brakeMat, 0, -0.78, 0, 0.03, 0.14, 'z', 8);
    p.rbox(brakeMat, -0.14, 0.08, 0, 0.22, 0.04, 0.03, 0, 0, 0.5); // shoe link to the rim
  });
  const brakeOff = 0.6, brakeOn = 0.0; // lever angle (rad) about z: off = swung out (away from the drum), on = standing by the post
  brake.pivot.rotation.z = brakeOff;
  if (o.collide !== false) {
    b.collide(-R, 0, -fz - 0.27, R, cy + R, fz + 0.27, 'metal', true);
    b.collide(px - 0.06, 0, pz - 0.1, px + 0.1, cy + 0.4, pz + 0.12, 'metal', true);
  }
  // timeline: ω(t) = ωmax (t/TB)² to TB (∫ = 3 rad ≈ 6 m of cable at R − 0.1), the brake bangs on at TB, the drum rocks
  const TB = 4.6, DUR = TB + 2.2, WMAX = 3.0 * 3 / TB, TOOTH = TAU / 72;
  const angleAt = (t: number) => (t <= TB ? (WMAX * t * t * t) / (3 * TB * TB) : 3.0 + 0.05 * Math.exp(-(t - TB) * 2.2) * Math.sin((t - TB) * 9.0) * (1 - Math.exp(-(t - TB) * 40)));
  const clacks: number[] = [];
  for (let k = 1; ; k++) { const a = k * TOOTH; if (a > 3.0) break; clacks.push(Math.cbrt((a * 3 * TB * TB) / WMAX)); }
  let angle = 0;
  const pose = (t: number) => {
    angle = angleAt(t);
    drum.pivot.rotation.z = -angle; // pays out toward −x … the tail side
    const ph = (angle / TOOTH) % 1; // pawl rides up each tooth's ramp and drops
    pawl!.pivot.rotation.z = t <= TB ? 0.12 * ph : 0;
    const kb = t < TB ? 0 : smooth((t - TB) / 0.07);
    brake!.pivot.rotation.z = lerp(brakeOff, brakeOn, kb) + (t > TB ? 0.04 * Math.exp(-(t - TB) * 6) * Math.sin((t - TB) * 40) : 0);
  };
  pose(0);
  const tl = timeline(L, DUR, pose);
  return {
    drum, pawl, brake, axis,
    get angle() { return angle; },
    run() { tl.play(0); return { dur: DUR, rumble: 0.8, brake: TB, clacks: clacks.slice() }; },
    at(t) { tl.at(t); },
    snap() { tl.at(DUR); },
  };
}

/** A coil of slack cable that grows loop by loop (`v6_drum`'s 6 m on the floor). `set(k)` 0 … 1 (drawRange). */
export interface SlackCoil { obj: THREE.Object3D; set(k: number): void }
/**
 * Slack sea cable lying on the floor in loose loops (§5.7 #4: "6 m of cable slack on the floor"). Floor prop, origin on
 * the floor at the end nearest the drum, loops spreading along +x. A moving object (no collider): `set(k)` reveals the
 * cable from the drum end (k = metres paid out / `len`). Calls: 1 (cable_armour).
 */
export function slackCoil(b: Builder, L: LevelBuild, o: { len?: number; seed?: number; name?: string } = {}): SlackCoil {
  const len = o.len ?? 6.0, A = tmat6(L, 'cable_armour'), R = srand(o.seed ?? 3);
  const pts: [number, number, number][] = [[0, 0.07, 0]];
  let x = 0, z = 0, a = 0.2, run = 0;
  while (run < len) { a += 0.6 + R() * 0.5; const st = 0.25; x += Math.cos(a) * st + 0.12; z += Math.sin(a) * st; run += st; pts.push([x, 0.062 + (pts.length % 3 === 0 ? 0.004 : 0), z]); }
  const part = part6(b, L, o.name ?? 'slack6', 0, 0, 0, (p) => hose(p, A, pts, 0.062, 10, 6));
  let mesh: THREE.Mesh | null = null;
  part.pivot.traverse((m) => { if ((m as THREE.Mesh).isMesh) mesh = m as THREE.Mesh; });
  const total = (mesh as THREE.Mesh | null)?.geometry.index?.count ?? 0;
  const set = (k: number) => {
    const c = Math.floor((total / 3) * clamp01(k)) * 3;
    if (mesh) { (mesh as THREE.Mesh).geometry.setDrawRange(0, c); (mesh as THREE.Mesh).visible = c > 0; }
  };
  set(0);
  return { obj: part.mount, set };
}

/**
 * The jointer's tent (§2.6.3: x 12.4 … 14.8, z −85.6 … −83.2, h 2.2; yellow tarp on a pole frame, tarp walls MOVE-ONLY,
 * open north side, its work lamp still on). Floor prop, origin = floor centre, `w` (2.4, x) × `d` (2.4, z), open side
 * +z. A ridge tent: corner poles to 1.9, centre poles to the ridge at `h` along x, tarp walls (rippled, hemmed, eyelets)
 * on −z / ±x, two roof slopes, the +z door flap rolled up and tied under the eave, guy lines to sandbag-weighted pegs;
 * a tripod halogen work lamp in the back-left corner aimed at the splicing table's place (lens = shared
 * `lampLens6('warm', 0.35)` or `lens`). Returns the lamp head (world), its aim direction and the centre front pole
 * (where `note6_jobcard` hangs — §2.6.3 (13.6, 1.4, −83.15) = local (0, 1.4, d/2 + 0.05)). Calls: 2 (tarp + steel_raw)
 * + the lens. Collider: move-only tarp walls (to 2.0); the poles none.
 */
export function jointerTent(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; lens?: THREE.MeshStandardMaterial; collide?: boolean } = {}): { lamp: THREE.Vector3; aim: THREE.Vector3; pole: THREE.Vector3 } {
  const w = o.w ?? 2.4, d = o.d ?? 2.4, h = o.h ?? 2.2, eave = 1.9, T = tarpMat(L), S: Mat = 'steel_raw', lens = o.lens ?? lampLens6(L, 'warm', 0.35);
  const hw = w / 2, hd = d / 2;
  // poles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(S, sx * (hw - 0.02), eave / 2, sz * (hd - 0.02), 0.018, eave, 'y', 8);
  for (const sz of [-1, 1]) b.cyl(S, 0, h / 2, sz * (hd - 0.02), 0.02, h, 'y', 8);
  b.rod(S, -hw, eave, -hd + 0.02, -hw, eave, hd - 0.02, 0.015, 6).rod(S, hw, eave, -hd + 0.02, hw, eave, hd - 0.02, 0.015, 6);
  b.rod(S, 0, h, -hd + 0.02, 0, h, hd - 0.02, 0.018, 6);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.rod(S, sx * (hw - 0.02), eave, sz * (hd - 0.02), 0, h, sz * (hd - 0.02), 0.015, 6);
  // tarp walls: back (−z), sides (±x) — rippled sheets 3 cm outside the poles
  const wallH = eave - 0.02;
  const m = new THREE.Matrix4();
  b.geo(T, curtainGeo(w, wallH, 6, 0.025), 'keep', m.compose(new THREE.Vector3(0, wallH / 2 + 0.02, -hd - 0.03), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)).clone(), w, wallH);
  for (const s of [-1, 1]) b.geo(T, curtainGeo(d, wallH, 6, 0.025), 'keep', m.compose(new THREE.Vector3(s * (hw + 0.03), wallH / 2 + 0.02, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * PI / 2, 0)), new THREE.Vector3(1, 1, 1)).clone(), d, wallH);
  // gables (triangles under the ridge) back and front
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-hw - 0.03, 0, 0, hw + 0.03, 0, 0, 0, h - eave + 0.03, 0], 3));
  gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w, 0, w / 2, h - eave], 2));
  gable.setIndex([0, 1, 2]); gable.computeVertexNormals();
  for (const sz of [-1, 1]) b.geo(T, gable, 'keep', new THREE.Matrix4().makeTranslation(0, eave, sz * (hd + 0.03)));
  // roof slopes (slightly bellied) with an overhang
  const slope = Math.hypot(hw + 0.1, h - eave + 0.04);
  for (const s of [-1, 1]) {
    const ey = new THREE.Vector3(-s * (hw + 0.1), h - eave + 0.02, 0).normalize(), ez = new THREE.Vector3(s * (h - eave + 0.02), hw + 0.1, 0).normalize();
    const ex = new THREE.Vector3().crossVectors(ey, ez);
    b.geo(T, curtainGeo(d + 0.16, slope, 3, 0.015), 'keep', new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(s * (hw + 0.1) / 2, (eave - 0.02 + h + 0.02) / 2 + 0.012, 0), d + 0.16, slope);
  }
  b.detail(() => {
    // rolled door flap under the front eave, ties, hems and eyelets, guy lines with sandbags
    b.cyl(T, 0, eave - 0.07, hd + 0.05, 0.07, w - 0.1, 'x', 12);
    for (const x of [-0.7, 0.7]) b.rod(S, x, eave - 0.14, hd + 0.05, x, eave, hd + 0.03, 0.004, 4);
    for (const s of [-1, 1]) b.cyl(T, s * (hw + 0.035), 0.06, 0, 0.025, d, 'z', 6);
    b.cyl(T, 0, 0.06, -hd - 0.035, 0.025, w, 'x', 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const gx = sx * (hw + 0.55), gz = sz * (hd + 0.35);
      b.rod(S, sx * (hw + 0.03), eave - 0.02, sz * (hd - 0.05), gx, 0.12, gz, 0.004, 4);
      b.sphere(T, gx, 0.08, gz, 0.11, 8, 0.55, 1.3, 1.0);
    }
  });
  // work lamp: tripod in the back-left corner, head at 1.7 aimed at the table (centre-right, 0.9 high)
  const lx = -hw + 0.35, lz = -hd + 0.35, ly = 1.7;
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.4; b.rod(S, lx + Math.cos(a) * 0.35, 0, lz + Math.sin(a) * 0.35, lx, 0.8, lz, 0.012, 5); }
  b.cyl(S, lx, 1.25, lz, 0.014, 0.9, 'y', 6);
  const aimL = new THREE.Vector3(0.3 - lx, 0.85 - ly, 0.1 - lz).normalize();
  b.push(lx, ly, lz, Math.atan2(aimL.x, aimL.z), -Math.asin(aimL.y));
  b.bx(S, -0.13, -0.1, -0.06, 0.13, 0.1, 0.02);
  b.bx(lens, -0.11, -0.08, 0.02, 0.11, 0.08, 0.026);
  b.detail(() => { for (let k = 0; k < 4; k++) b.rod(S, -0.13, -0.06 + k * 0.04, 0.035, 0.13, -0.06 + k * 0.04, 0.035, 0.004, 4); b.bx(S, -0.02, 0.1, -0.04, 0.02, 0.16, 0.0); });
  b.pop();
  b.detail(() => b.rod(S, lx, 0.02, lz, lx + 0.1, 0.01, lz + 0.8, 0.008, 4));
  const lamp = b.world(lx, ly, lz), aim = dirOf(b, aimL.x, aimL.y, aimL.z);
  if (o.collide !== false) {
    collideMoveOnly(b, L, -hw - 0.05, 0, -hd - 0.05, hw + 0.05, 2.0, -hd);
    for (const s of [-1, 1]) collideMoveOnly(b, L, Math.min(s * hw, s * (hw + 0.05)), 0, -hd, Math.max(s * hw, s * (hw + 0.05)), 2.0, hd);
  }
  return { lamp, aim, pole: b.world(0, 1.4, hd + 0.03) };
}

/**
 * Cable splicing table (rep6, inside the tent). Floor prop, origin = floor centre, `len` (1.4, x) × 0.7 (z), top 0.85:
 * a steel folding table with a phenolic top; on it an open fibre splice enclosure (a canister with its trays fanned),
 * a fusion splicer (a box with a dark screen and a lid up), a cleaver, a tool roll, the two cable ends clamped in a
 * jig with their armour stripped back, a work stool at the +z side. Returns the top centre (world). Calls: 2
 * (steel_raw + painted_dark). Collider: the top to 0.88 (`collide`).
 */
export function splicingTable(b: Builder, L: LevelBuild, o: { len?: number; d?: number; stool?: boolean; collide?: boolean } = {}): { top: THREE.Vector3 } {
  const len = o.len ?? 1.4, d = o.d ?? 0.7, top = 0.85, S: Mat = 'steel_raw', K: Mat = 'painted_dark';
  b.bx(K, -len / 2, top - 0.025, -d / 2, len / 2, top, d / 2);
  b.bx(S, -len / 2 + 0.03, top - 0.07, -d / 2 + 0.03, len / 2 - 0.03, top - 0.025, d / 2 - 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(S, sx * (len / 2 - 0.08), (top - 0.07) / 2, sz * (d / 2 - 0.08), 0.016, top - 0.07, 'y', 8);
  for (const sx of [-1, 1]) b.rod(S, sx * (len / 2 - 0.08), 0.15, -d / 2 + 0.08, sx * (len / 2 - 0.08), 0.15, d / 2 - 0.08, 0.01, 5);
  b.detail(() => {
    // splice enclosure: a dark canister on its side with fanned trays
    b.cyl(K, -0.35, top + 0.11, -0.08, 0.11, 0.42, 'x', 16);
    for (let k = 0; k < 5; k++) b.rbox(S, -0.18 + k * 0.006, top + 0.13 + k * 0.012, -0.08 + k * 0.02, 0.22, 0.008, 0.16, -0.25 + k * 0.12, 0, 0);
    // fusion splicer
    b.bx(K, 0.1, top, -0.2, 0.36, top + 0.12, 0.04);
    b.rbox(K, 0.23, top + 0.2, -0.21, 0.24, 0.16, 0.012, -0.25, 0, 0);
    b.rbox(S, 0.23, top + 0.2, -0.203, 0.2, 0.12, 0.004, -0.25, 0, 0);
    // jig with the two cable ends
    b.bx(S, -0.62, top, 0.12, 0.62, top + 0.03, 0.2);
    for (const s of [-1, 1]) { b.cyl(K, s * 0.45, top + 0.08, 0.16, 0.06, 0.3, 'x', 12); b.cyl(S, s * 0.27, top + 0.08, 0.16, 0.03, 0.08, 'x', 10); b.bx(S, s * 0.52 - 0.03, top + 0.03, 0.12, s * 0.52 + 0.03, top + 0.15, 0.2); }
    // tool roll + cleaver
    b.bx(K, 0.42, top, 0.0, 0.62, top + 0.02, 0.14);
    b.bx(S, 0.0, top, 0.24, 0.07, top + 0.04, 0.3);
    // cables down to the floor from both ends
    for (const s of [-1, 1]) b.rod(K, s * 0.62, top + 0.08, 0.16, s * (len / 2 + 0.15), 0.06, 0.25, 0.055, 10);
  });
  if (o.stool !== false) {
    b.cyl(K, 0.15, 0.58, d / 2 + 0.35, 0.17, 0.05, 'y', 14);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; b.rod(S, 0.15 + Math.cos(a) * 0.2, 0, d / 2 + 0.35 + Math.sin(a) * 0.2, 0.15, 0.56, d / 2 + 0.35, 0.012, 5); }
  }
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, top + 0.03, d / 2, 'metal', true);
  return { top: b.world(0, top, 0) };
}

/**
 * Transport crate / stores case (§2.6.3 LC1 / LC2, §2.6.9 MC1 / MC2: h 1.2, LOW cover; pickups on the top at the
 * approach edge). Floor prop, origin = floor centre, `w` (x) × `d` (z) × `h` (1.2): an olive steel-framed case on skid
 * runners — angle-iron edges and corners, a lid with recessed latches and lifting handles, end ribs, a stencilled
 * label. The lid top is flat at `h` (items lie on it). Calls: 2 (olive + painted_dark) + atlas. Collider: exactly
 * `w` × `d` × `h`.
 */
export function crate6(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; label?: string; collide?: boolean } = {}) {
  const w = o.w ?? 1.4, d = o.d ?? 1.2, h = o.h ?? 1.2, O = olive(L), K: Mat = 'painted_dark';
  for (const z of [-d / 2 + 0.06, d / 2 - 0.18]) b.bx(K, -w / 2, 0, z, w / 2, 0.08, z + 0.12);
  b.bx(O, -w / 2 + 0.02, 0.08, -d / 2 + 0.02, w / 2 - 0.02, h - 0.06, d / 2 - 0.02);
  b.bx(O, -w / 2, h - 0.06, -d / 2, w / 2, h, d / 2); // lid
  // angle-iron vertical corners and the top / bottom edge bands (1 cm proud)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(K, Math.min(sx * w / 2 - sx * 0.06, sx * w / 2 + sx * 0.01), 0.08, Math.min(sz * d / 2 - sz * 0.06, sz * d / 2 + sz * 0.01), Math.max(sx * w / 2 - sx * 0.06, sx * w / 2 + sx * 0.01), h - 0.06, Math.max(sz * d / 2 - sz * 0.06, sz * d / 2 + sz * 0.01));
  for (const y of [0.08, h - 0.11]) for (const sz of [-1, 1]) b.bx(K, -w / 2 + 0.06, y, Math.min(sz * d / 2 - sz * 0.01, sz * d / 2 + sz * 0.012), w / 2 - 0.06, y + 0.04, Math.max(sz * d / 2 - sz * 0.01, sz * d / 2 + sz * 0.012));
  b.detail(() => {
    for (const sz of [-1, 1]) for (const x of [-w / 4, w / 4]) { b.bx(K, x - 0.05, h - 0.2, sz * (d / 2 + 0.012) - (sz > 0 ? 0 : 0.02), x + 0.05, h - 0.12, sz * (d / 2 + 0.012) + (sz > 0 ? 0.02 : 0)); }
    for (const sx of [-1, 1]) { b.rod(K, sx * (w / 2 + 0.03), h * 0.6, -0.15, sx * (w / 2 + 0.03), h * 0.6, 0.15, 0.014, 6); for (const z of [-0.15, 0.15]) b.rod(K, sx * (w / 2 + 0.012), h * 0.6, z, sx * (w / 2 + 0.03), h * 0.6, z, 0.012, 5); }
  });
  stencil6(b, o.label ?? '할시온 서브시 — 조인팅 키트', 0, h * 0.5, d / 2 + 0.013, Math.min(0.9, w * 0.7), 0.08, '+z', { style: 'stencil' });
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}

/**
 * Wall shelf for pickups (§2.6.3 rep6 east wall, §2.6.5 bay6, §2.6.6 he6 west wall, §2.6.7 vault east wall: 0.4 deep,
 * 2.0–2.4 long, the item shelf at 1.0). Wall prop, origin on the wall face at floor level, `w` along x, `d` out.
 * Slotted wall uprights, cantilever brackets, a plate shelf at `top` (1.0; kept CLEAR — the pickups lie there), a
 * second shelf at 1.6 and a bottom one at 0.35 with stores on them (boxes of cable ties, a jerrycan, rope). Returns the
 * item shelf's centre (world). Calls: 2 (navy_grey + painted_dark). Collider: the unit (`collide`).
 */
export function wallShelf6(b: Builder, L: LevelBuild, o: { w?: number; d?: number; top?: number; seed?: number; collide?: boolean } = {}): { shelf: THREE.Vector3 } {
  const w = o.w ?? 2.0, d = o.d ?? 0.4, top = o.top ?? 1.0, N: Mat = 'navy_grey', K: Mat = 'painted_dark', R = srand(o.seed ?? 23);
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) { b.bx(N, x - 0.02, 0.2, 0, x + 0.02, 1.95, 0.025); }
  for (const y of [0.35, top, 1.6]) {
    b.bx(N, -w / 2, y - 0.025, 0.02, w / 2, y, d);
    b.bx(N, -w / 2, y - 0.06, d - 0.012, w / 2, y + 0.015, d);
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) b.rbox(N, x, y - 0.12, d * 0.45, 0.01, 0.03, d * 1.05, Math.atan2(0.2, d * 0.9), 0, 0);
  }
  b.detail(() => {
    // stores: upper and lower shelves only
    for (let x = -w / 2 + 0.15; x < w / 2 - 0.3;) { const bw = 0.18 + R() * 0.22, bh = 0.12 + R() * 0.18; b.bx(K, x, 1.6, 0.05 + R() * 0.05, x + bw, 1.6 + bh, d - 0.04); x += bw + 0.04 + R() * 0.1; }
    b.bx(K, -w / 2 + 0.15, 0.35, 0.06, -w / 2 + 0.5, 0.75, 0.3);
    b.torus(K, w / 2 - 0.35, 0.42, d / 2, 0.15, 0.03, 'y', 14);
    b.torus(K, w / 2 - 0.35, 0.46, d / 2, 0.13, 0.03, 'y', 14);
  });
  if (o.collide !== false) b.collide(-w / 2, 0.3, 0, w / 2, 1.95, d, 'metal', false);
  return { shelf: b.world(0, top, d / 2) };
}

/**
 * First-aid cabinet (§2.6.3 rep6 west wall (−5.6, 1.0, −82.0), §2.6.6 he6 east wall: the medkit at y 1.0, 0.25 m from
 * the wall). Wall prop, origin on the wall face at floor level: a green steel cabinet 0.6 × 0.55 × 0.32 hung with its
 * floor at 0.95, the door open 100° (white cross), an inner shelf; the item's place on its floor (1.0) is kept clear.
 * Returns that point (0.25 out). Calls: 2 (aid green + painted_white) + atlas. Collider: the box (`collide`).
 */
export function firstAidBox6(b: Builder, L: LevelBuild, o: { collide?: boolean } = {}): THREE.Vector3 {
  const G = aidGreen(L), Wt: Mat = 'painted_white', w = 0.6, h = 0.55, d = 0.32, y0 = 0.95;
  b.bx(G, -w / 2, y0, 0, w / 2, y0 + 0.03, d).bx(G, -w / 2, y0 + h - 0.02, 0, w / 2, y0 + h, d);
  for (const s of [-1, 1]) b.bx(G, s * w / 2 - (s > 0 ? 0.02 : 0), y0, 0, s * w / 2 + (s < 0 ? 0.02 : 0), y0 + h, d);
  b.bx(Wt, -w / 2 + 0.02, y0 + 0.03, 0, w / 2 - 0.02, y0 + h - 0.02, 0.008);
  b.bx(Wt, -w / 2 + 0.02, y0 + 0.3, 0.008, w / 2 - 0.02, y0 + 0.315, d - 0.02);
  // the open door (hinged on +x, swung 100°)
  b.push(w / 2, y0, d, PI * 0.55);
  b.bx(G, 0, 0.0, -0.02, w, h, 0);
  b.detail(() => { b.bx(Wt, w / 2 - 0.12, h / 2 - 0.035, 0.0, w / 2 + 0.12, h / 2 + 0.035, 0.004); b.bx(Wt, w / 2 - 0.035, h / 2 - 0.12, 0.0, w / 2 + 0.035, h / 2 + 0.12, 0.004); });
  b.pop();
  b.detail(() => { b.bx(Wt, -0.22, y0 + 0.315, 0.04, -0.06, y0 + 0.42, 0.2); b.cyl(Wt, 0.12, y0 + 0.37, 0.15, 0.04, 0.11, 'y', 10); });
  stencil6(b, '응급처치', 0, y0 + h + 0.08, 0.001, 0.36, 0.08, '+z');
  if (o.collide !== false) b.collide(-w / 2, y0, 0, w / 2, y0 + h, d, 'metal', false);
  return b.world(0, 1.0, 0.25);
}

/**
 * Cable joint box on trestles (§2.6.5 bay6: x 16.0 … 18.0, z −103.0 … −101.0, h 1.2). Floor prop, origin = floor
 * centre, footprint `w` (2.0) × `d` (2.0): a long steel joint housing (1.8 × 0.6 × 0.45, bolted lid, gland bosses both
 * ends) on two A-trestles, the trunk entering both ends in bights, a loop of spare on the floor. Calls: 2 (navy_grey +
 * cable_armour) + atlas. Collider: footprint to `h` (1.2).
 */
export function jointBox(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; collide?: boolean } = {}) {
  const w = o.w ?? 2.0, d = o.d ?? 2.0, h = o.h ?? 1.2, N: Mat = 'navy_grey', A = tmat6(L, 'cable_armour');
  const by = h - 0.45;
  for (const x of [-0.6, 0.6]) {
    b.bx(N, x - 0.05, by - 0.06, -0.35, x + 0.05, by, 0.35);
    for (const s of [-1, 1]) b.rbox(N, x, by / 2 - 0.03, s * 0.25, 0.05, by, 0.05, s * 0.28, 0, 0);
  }
  b.bx(N, -0.9, by, -0.3, 0.9, h - 0.04, 0.3);
  b.bx(N, -0.92, h - 0.04, -0.32, 0.92, h, 0.32);
  b.detail(() => { for (let x = -0.8; x <= 0.81; x += 0.2) for (const s of [-1, 1]) b.cyl(N, x, h + 0.006, s * 0.29, 0.015, 0.012, 'y', 6); });
  for (const s of [-1, 1]) {
    b.cyl(N, s * 0.98, by + 0.2, 0, 0.11, 0.16, 'x', 14);
    hose(b, A, [[s * 1.06, by + 0.2, 0], [s * 1.25, by + 0.05, 0.1], [s * 1.0, 0.07, 0.6], [s * 0.4, 0.07, 0.85], [-s * 0.3, 0.07, 0.75]], 0.062, 10, 6);
  }
  stencil6(b, '조인트 2-B — 젖은 상태 개봉 금지', 0, by + 0.2, 0.301, 0.8, 0.07, '+z');
  if (o.collide !== false) b.collide(-w / 2 + 0.05, 0, -0.4, w / 2 - 0.05, h, 0.4, 'metal', true);
}

/** A coil of spare sea cable on a pallet (§2.6.5 bay6). Floor prop: ~⌀ 1.3 flat coil, 6 turns high. Calls: 2 (cable_armour
 * + painted_dark). Collider: to 0.55 (`collide`). */
export function spareCoil(b: Builder, L: LevelBuild, o: { r?: number; turns?: number; collide?: boolean } = {}) {
  const r = o.r ?? 0.6, n = o.turns ?? 6, A = tmat6(L, 'cable_armour'), K: Mat = 'painted_dark';
  b.bx(K, -0.75, 0, -0.75, 0.75, 0.12, 0.75);
  for (let k = 0; k < n; k++) b.torus(A, 0, 0.18 + k * 0.062 * 1.7, 0, r - (k % 2) * 0.03, 0.062, 'y', 36);
  b.detail(() => { for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; b.rod(K, Math.cos(a) * (r + 0.07), 0.12, Math.sin(a) * (r + 0.07), Math.cos(a) * (r + 0.07), 0.12 + n * 0.106, Math.sin(a) * (r + 0.07), 0.01, 4); } });
  if (o.collide !== false) b.collide(-0.75, 0, -0.75, 0.75, 0.15 + n * 0.106, 0.75, 'metal', true);
}

// ═════════════════════════════════════════════════════════════ HEAD-END

/**
 * OLT rack row (§2.6.6 R1 / R2: 10 × 0.6, h 2.2; green laser LEDs, fibre patch panels). Floor prop, origin = floor
 * centre, `len` along x, `d` 0.6, FRONT +z (the patched side; the back is dense cable). 0.6 m 19-inch racks bolted in a
 * row: perforated-door frames, OLT chassis (line cards with LEDs — the shared `ledMat6`), patch panels with yellow
 * patch cords looping into ring managers, a yellow fibre raceway on top, end panels, cable bundles at the back.
 * Calls: 2 (painted_dark + painted_yellow) + LEDs (shared) + atlas. Collider: `len` × `d` × `h`.
 */
export function oltRack(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; prefix?: string; seed?: number; collide?: boolean } = {}) {
  const len = o.len ?? 10, d = o.d ?? 0.6, h = o.h ?? 2.2, K: Mat = 'painted_dark', Y: Mat = 'painted_yellow', LED = ledMat6(L), R = srand(o.seed ?? 41);
  const n = Math.max(1, Math.round(len / 0.6)), rw = len / n, fz = d / 2;
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * rw, x1 = x0 + rw, xc = (x0 + x1) / 2;
    b.bx(K, x0 + 0.003, 0, -fz, x1 - 0.003, h, fz - 0.04);
    for (const s of [-1, 1]) b.bx(K, s < 0 ? x0 + 0.003 : x1 - 0.05, 0.05, fz - 0.04, s < 0 ? x0 + 0.05 : x1 - 0.003, h - 0.05, fz); // front posts
    b.bx(K, x0 + 0.003, h - 0.12, fz - 0.04, x1 - 0.003, h, fz).bx(K, x0 + 0.003, 0, fz - 0.04, x1 - 0.003, 0.1, fz);
    // equipment: 3 OLT chassis + 2 patch panels, front faces 1 cm behind the posts' front
    let y = 0.18;
    const kinds = i % 3 === 1 ? ['patch', 'olt', 'patch', 'olt', 'olt'] : ['olt', 'patch', 'olt', 'olt', 'patch'];
    for (const k of kinds) {
      const hh = k === 'olt' ? 0.34 : 0.13;
      b.bx(K, x0 + 0.05, y, fz - 0.08, x1 - 0.05, y + hh, fz - 0.012);
      b.detail(() => {
        if (k === 'olt') {
          for (let c = 0; c < 8; c++) { const cx = x0 + 0.08 + c * ((rw - 0.16) / 7); b.bx(K, cx - 0.012, y + 0.02, fz - 0.012, cx + 0.012, y + hh - 0.02, fz - 0.006); b.bx(LED, cx - 0.005, y + hh - 0.06, fz - 0.006, cx + 0.005, y + hh - 0.05, fz - 0.003); b.bx(LED, cx - 0.005, y + hh - 0.09, fz - 0.006, cx + 0.005, y + hh - 0.08, fz - 0.003); }
        } else {
          for (let c = 0; c < 12; c++) {
            const cx = x0 + 0.08 + c * ((rw - 0.16) / 11);
            b.bx(Y, cx - 0.006, y + 0.05, fz - 0.012, cx + 0.006, y + 0.08, fz + 0.01);
            if (R() < 0.75) { const drop = 0.08 + R() * 0.12; b.rod(Y, cx, y + 0.065, fz + 0.01, cx + (R() - 0.5) * 0.04, y - drop, fz + 0.05, 0.0035, 4); b.rod(Y, cx + (R() - 0.5) * 0.04, y - drop, fz + 0.05, x1 - 0.045, y - drop * 0.6, fz + 0.03, 0.0035, 4); }
          }
        }
      });
      y += hh + 0.07;
    }
    b.detail(() => { for (const yy of [0.5, 1.1, 1.7]) b.torus(K, x1 - 0.03, yy, fz + 0.03, 0.035, 0.006, 'y', 8); });
    if (i % 4 === 0) stencil6(b, `${o.prefix ?? 'OLT 1-'}${String(i / 4 + 1).padStart(2, '0')}`, xc, h - 0.06, fz + 0.001, 0.3, 0.07, '+z');
  }
  // raceway on top, end panels, the back's cable bundles
  b.bx(Y, -len / 2, h + 0.18, -0.15, len / 2, h + 0.3, 0.15);
  b.detail(() => { for (let x = -len / 2 + 0.6; x < len / 2; x += 1.8) b.bx(Y, x - 0.08, h, -0.04, x + 0.08, h + 0.18, 0.04); });
  for (const s of [-1, 1]) b.bx(K, s * len / 2 - (s > 0 ? 0 : 0.02), 0, -fz, s * len / 2 + (s < 0 ? 0 : 0.02), h, fz);
  b.detail(() => { for (let x = -len / 2 + 0.3; x < len / 2; x += 0.6) b.cyl(K, x, h / 2 + 0.1, -fz - 0.04, 0.04, h - 0.4, 'y', 8); });
  if (o.collide !== false) b.collide(-len / 2 - 0.02, 0, -fz - 0.08, len / 2 + 0.02, h, fz + 0.02, 'metal', true);
}

/**
 * Mimic board frame (§2.6.6: on the south wall x 7 … 17, y 1.6 … 3.6, facing +z; W5's `mimic` screen goes inside). Wall
 * prop, origin on the wall face at the SCREEN CENTRE: a heavy haze-grey bezel frame around `w` × `h` (10 × 2), the
 * screen area tiled by thin dark tile bezels every 2.5 m (in front of the screen plane), a title plate above, conduit
 * up to the ceiling. Returns the screen quad's centre (world; place `L.screen(…, face '+z')` there) and its size.
 * Calls: 2 (navy_grey + painted_dark) + atlas.
 */
export function mimicFrame(b: Builder, L: LevelBuild, o: { w?: number; h?: number; title?: string; tiles?: number } = {}): { screen: THREE.Vector3; w: number; h: number } {
  const w = o.w ?? 10, h = o.h ?? 2, N: Mat = 'navy_grey', K: Mat = 'painted_dark', f = 0.12, dep = 0.1;
  b.bx(K, -w / 2, -h / 2, 0, w / 2, h / 2, 0.02); // backing panel (the screen sits at z 0.03)
  for (const s of [-1, 1]) {
    b.bx(N, -w / 2 - f, s > 0 ? h / 2 : -h / 2 - f, 0, w / 2 + f, s > 0 ? h / 2 + f : -h / 2, dep);
    b.bx(N, s > 0 ? w / 2 : -w / 2 - f, -h / 2, 0, s > 0 ? w / 2 + f : -w / 2, h / 2, dep);
  }
  const nt = o.tiles ?? Math.round(w / 2.5);
  b.detail(() => {
    for (let k = 1; k < nt; k++) { const x = -w / 2 + (k * w) / nt; b.bx(K, x - 0.008, -h / 2, 0.035, x + 0.008, h / 2, 0.045); }
    b.bx(K, -w / 2, -0.008, 0.035, w / 2, 0.008, 0.045);
    b.bx(N, -1.4, h / 2 + f, 0, 1.4, h / 2 + f + 0.24, 0.05);
    b.cyl(K, w / 2 - 0.3, h / 2 + 0.8, 0.05, 0.025, 1.4, 'y', 8);
  });
  stencil6(b, o.title ?? '헤드엔드 — 트렁크 1 — 미믹', 0, h / 2 + f + 0.12, 0.051, 2.4, 0.16, '+z');
  return { screen: b.world(0, 0, 0.03), w, h };
}

/**
 * Head-end console desk (§2.6.6: along the south wall x 8 … 16, z −179.8 … −178.8, desk h 1.0; the outbound-queue screen
 * at (9.0, 1.25, −179.0); two carbine boxes on its east end at the north edge). Wall prop, origin on the wall face at
 * floor level, `len` along x, `d` (1.0) out, top at `h` (1.0). A standing operator console: steel pedestals with
 * drawers and a recessed kick space, a dark worktop with a 2 cm front nosing, a vertical upstand at the back (z 0 … 0.25,
 * to 1.45) carrying dark monitor bezels at `bezels` (x list; return their screen centres, facing +z, 1 cm proud),
 * keyboards and a handset cradle. The front 0.5 m of the top stays clear. Calls: 2 (navy_grey + painted_dark) +
 * atlas. Collider: desk to `h`, upstand to 1.45.
 */
export function consoleDesk(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; bezels?: number[]; collide?: boolean } = {}): { screens: THREE.Vector3[]; top: number } {
  const len = o.len ?? 8, d = o.d ?? 1.0, h = o.h ?? 1.0, N: Mat = 'navy_grey', K: Mat = 'painted_dark', up = 0.25, upH = 1.45;
  const peds = Math.max(2, Math.round(len / 1.6));
  for (let i = 0; i < peds; i++) {
    const x = -len / 2 + 0.3 + i * ((len - 0.6) / (peds - 1));
    b.bx(N, x - 0.25, 0.08, 0.02, x + 0.25, h - 0.04, d - 0.06);
    b.bx(K, x - 0.24, 0, 0.1, x + 0.24, 0.08, d - 0.14); // kick recess
    b.detail(() => { for (let k = 0; k < 3; k++) { const y = 0.2 + k * 0.24; b.bx(N, x - 0.23, y, d - 0.06, x + 0.23, y + 0.22, d - 0.05); b.bx(K, x - 0.08, y + 0.15, d - 0.05, x + 0.08, y + 0.17, d - 0.035); } });
  }
  b.bx(N, -len / 2, 0.08, 0.0, len / 2, h - 0.04, 0.06); // back panel
  b.bx(K, -len / 2, h - 0.04, 0, len / 2, h, d);
  b.bx(K, -len / 2, h - 0.06, d - 0.02, len / 2, h + 0.0, d); // nosing
  b.bx(N, -len / 2, h, 0, len / 2, upH, up);
  b.bx(K, -len / 2, upH, 0, len / 2, upH + 0.02, up + 0.02);
  const screens: THREE.Vector3[] = [];
  for (const x of o.bezels ?? [-len / 2 + 1.0, -0.6, 0.6, len / 2 - 1.0]) {
    b.bx(K, x - 0.36, h + 0.06, up, x + 0.36, upH - 0.04, up + 0.012);
    screens.push(b.world(x, (h + 0.06 + upH - 0.04) / 2, up + 0.022));
  }
  b.detail(() => {
    for (let x = -len / 2 + 1.0; x < len / 2 - 0.5; x += 1.6) { b.bx(K, x - 0.22, h, up + 0.12, x + 0.22, h + 0.025, up + 0.28); }
    b.bx(K, len / 2 - 0.5, h, up + 0.02, len / 2 - 0.25, h + 0.09, up + 0.14);
  });
  stencil6(b, '헤드엔드 제어 — 트렁크 1', 0, upH - 0.025 + 0.0, up + 0.013, 1.3, 0.035, '+z');
  if (o.collide !== false) { b.collide(-len / 2, 0, 0, len / 2, h, d, 'metal', true); b.collide(-len / 2, h, 0, len / 2, upH, up, 'metal', false); }
  return { screens, top: h };
}

/**
 * Wall locker with its doors open (§2.6.6 NW locker x 2.4 … 4.0, z −160.8 … −160.2, h 2.0; a navy vest on a hook:
 * `p6_he_vest` at (3.2, 1.3, −160.75), 0.05 m inside the opening). Wall prop, origin on the wall face at floor level,
 * `w` (1.6) along x, `d` (0.6) out: a double-door steel locker on a plinth, both doors open (`open`, 100°), a hook rail at
 * 1.75 (the vest hangs from the centre hook), a hat shelf at 1.8 with a helmet box, a boot tray; a name plate.
 * Returns the hook point and the vest centre (world). Calls: 2 (navy_grey + painted_dark) + atlas. Collider: the
 * carcass (`collide`), the open doors none.
 */
export function wallLocker(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; open?: number; label?: string; collide?: boolean } = {}): { hook: THREE.Vector3; vest: THREE.Vector3 } {
  const w = o.w ?? 1.6, d = o.d ?? 0.6, h = o.h ?? 2.0, N: Mat = 'navy_grey', K: Mat = 'painted_dark', t = 0.02, ang = (o.open ?? 100) * PI / 180;
  b.bx(K, -w / 2 + 0.03, 0, 0.03, w / 2 - 0.03, 0.08, d - 0.03);
  b.bx(N, -w / 2, 0.08, 0, w / 2, 0.08 + t, d).bx(N, -w / 2, h - t, 0, w / 2, h, d); // bottom / top
  for (const s of [-1, 1]) b.bx(N, s * w / 2 - (s > 0 ? t : 0), 0.08, 0, s * w / 2 + (s < 0 ? t : 0), h, d);
  b.bx(K, -w / 2 + t, 0.08 + t, 0, w / 2 - t, h - t, 0.012); // back (dark inside)
  b.bx(N, -w / 2 + t, 1.8, 0.012, w / 2 - t, 1.8 + t, d - 0.04); // hat shelf
  b.bx(N, -0.01, 0.08 + t, 0.012, 0.01, 1.8, d - 0.04); // centre divider
  b.detail(() => {
    b.bx(K, -w / 2 + t, 1.72, 0.04, w / 2 - t, 1.74, 0.06);
    for (const x of [-0.5, -0.12, 0.12, 0.5]) b.rod(K, x, 1.73, 0.06, x, 1.66, d - 0.08, 0.008, 5);
    b.bx(K, -0.7, 1.8 + t, 0.05, -0.3, 1.95, 0.45);
    b.bx(K, 0.15, 0.08 + t, 0.05, 0.7, 0.13, 0.5);
  });
  for (const s of [-1, 1]) {
    // door hinged on the outer edge, swung `ang` outward
    b.push(s * w / 2, 0, d, s * ang);
    b.bx(N, -s * (w / 2 - 0.01), 0.1, 0, 0, h - 0.02, 0.02);
    b.detail(() => { for (let k = 0; k < 5; k++) b.bx(K, -s * 0.5 - 0.15, 1.6 + k * 0.04, 0.02, -s * 0.5 + 0.15, 1.615 + k * 0.04, 0.024); b.bx(K, -s * (w / 2 - 0.07) - 0.01, 0.9, 0.02, -s * (w / 2 - 0.07) + 0.01, 1.1, 0.04); });
    b.pop();
  }
  stencil6(b, o.label ?? 'VESTS — HEAD-END WATCH', 0, h + 0.08, 0.001, 0.9, 0.08, '+z');
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
  // the centre hook (the divider stops at 1.8; the vest hangs at x 0)
  return { hook: b.world(0, 1.73, d - 0.08), vest: b.world(0, 1.3, d - 0.05) };
}

// ═════════════════════════════════════════════════════════════ VAULT

/**
 * Desiccant dehumidifier (§2.6.7 DH1 / DH2: 2.0 × 0.8, h 2.0, against the vault's north wall). Wall prop, origin on the
 * wall face at floor level, `w` (2.0) along x, `d` (0.8) out: a grey-white plant cabinet on feet with lift-off panels,
 * a round process-air inlet grille and a rectangular louvre on the front, a control panel with a display and status
 * LEDs (shared), two insulated round ducts from its top rising and turning into the wall at 3.6, a drain hose to the
 * floor, a name plate. Calls: 2 (plant white + steel_raw) + LEDs + atlas. Collider: `w` × `d` × `h`.
 */
export function dehumidifier(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; ducts?: number; label?: string; collide?: boolean } = {}) {
  const w = o.w ?? 2.0, d = o.d ?? 0.8, h = o.h ?? 2.0, P = plantWhite(L), S: Mat = 'steel_raw', LED = ledMat6(L), dy = o.ducts ?? 3.6;
  for (const sx of [-1, 1]) for (const sz of [0.1, d - 0.1]) b.bx(S, sx * (w / 2 - 0.1) - 0.04, 0, sz - 0.04, sx * (w / 2 - 0.1) + 0.04, 0.08, sz + 0.04);
  b.bx(P, -w / 2, 0.08, 0, w / 2, h, d - 0.01);
  b.detail(() => {
    for (const x of [-w / 2 + 0.02, -0.33, 0.35]) b.bx(P, x, 0.12, d - 0.01, x + 0.62, h - 0.06, d - 0.002);
    b.cyl(S, -w / 2 + 0.33, 1.25, d + 0.008, 0.22, 0.02, 'z', 24);
    for (let k = 0; k < 6; k++) b.torus(S, -w / 2 + 0.33, 1.25, d + 0.02, 0.04 + k * 0.032, 0.005, 'z', 20);
    for (let k = 0; k < 10; k++) b.rbox(S, 0.02, 0.35 + k * 0.06, d + 0.004, 0.56, 0.012, 0.03, -0.6, 0, 0);
    b.bx(S, 0.4, 1.35, d + 0.004, 0.88, 1.75, d + 0.02);
    b.bx(LED, 0.46, 1.6, d + 0.02, 0.7, 1.68, d + 0.024);
    for (let k = 0; k < 3; k++) b.bx(LED, 0.48 + k * 0.08, 1.45, d + 0.02, 0.5 + k * 0.08, 1.47, d + 0.024);
    b.rod(S, w / 2 - 0.1, 0.25, d - 0.02, w / 2 + 0.1, 0.02, d + 0.15, 0.015, 6);
  });
  // ducts: up from the top and back into the wall
  for (const x of [-0.45, 0.45]) {
    b.cyl(S, x, h + 0.05, d * 0.45, 0.19, 0.1, 'y', 18);
    b.cyl(S, x, (h + dy) / 2, d * 0.45, 0.17, dy - h, 'y', 18);
    b.sphere(S, x, dy, d * 0.45, 0.17, 14);
    b.cyl(S, x, dy, d * 0.45 / 2, 0.17, d * 0.45, 'z', 18);
    b.detail(() => { for (let y = h + 0.3; y < dy - 0.1; y += 0.4) b.torus(S, x, y, d * 0.45, 0.172, 0.008, 'y', 18); });
  }
  stencil6(b, o.label ?? 'DH 1 — 건조제 — 문 닫아 둘 것', 0, h - 0.14, d - 0.001, 1.1, 0.07, '+z');
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
}

/**
 * Nitrogen rack (§2.6.7 NR: x −4.0 … −2.0, z −152.0 … −150.8, h 1.8; a bracket shelf on its north face at y 1.0 —
 * `p6_vault_plate` 0.15 m out of −150.8). Floor prop, origin = floor centre, `len` (2.0, x) × `d` (1.2, z), FRONT +z =
 * the shelf face. A navy steel frame with chain restraints holding two rows of black-grey dry-nitrogen cylinders
 * (valve guards, shoulder labels), a purge manifold with a regulator and gauges along the top, the bracket shelf on
 * the front frame. Returns the shelf point. Calls: 2 (navy_grey + bottle grey) + atlas. Collider: footprint to `h`.
 */
export function nitrogenRack(b: Builder, L: LevelBuild, o: { len?: number; d?: number; h?: number; shelf?: boolean; collide?: boolean } = {}): { shelf: THREE.Vector3 | null } {
  const len = o.len ?? 2.0, d = o.d ?? 1.2, h = o.h ?? 1.8, N: Mat = 'navy_grey', G = bottleGrey(L);
  b.bx(N, -len / 2, 0, -d / 2, len / 2, 0.05, d / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(N, sx * len / 2 - (sx > 0 ? 0.05 : 0), 0.05, sz * d / 2 - (sz > 0 ? 0.05 : 0), sx * len / 2 + (sx < 0 ? 0.05 : 0), h, sz * d / 2 + (sz < 0 ? 0.05 : 0));
  for (const sz of [-1, 1]) for (const y of [0.9, h - 0.05]) b.bx(N, -len / 2 + 0.05, y, sz * d / 2 - (sz > 0 ? 0.05 : 0), len / 2 - 0.05, y + 0.05, sz * d / 2 + (sz < 0 ? 0.05 : 0));
  b.bx(N, -0.03, 0.05, -d / 2 + 0.05, 0.03, h - 0.05, d / 2 - 0.05); // centre divider
  const nr = 3;
  for (const [z] of [[-d / 4], [d / 4]] as const) for (let i = 0; i < 2 * nr; i++) {
    const side = i < nr ? -1 : 1, k = i % nr, x = side * (0.17 + k * 0.29);
    b.cyl(G, x, 0.05 + 0.72, z, 0.115, 1.44, 'y', 14);
    b.sphere(G, x, 0.05 + 1.44, z, 0.115, 12, 0.45);
    b.cyl(G, x, 1.62, z, 0.03, 0.12, 'y', 8);
    b.detail(() => { b.cyl(N, x, 1.68, z, 0.06, 0.06, 'y', 10); b.rod(G, x, 1.64, z, x, 1.64, z + (z > 0 ? -0.18 : 0.18), 0.008, 5); });
  }
  b.detail(() => {
    for (const sz of [-1, 1]) for (const y of [0.55, 1.25]) for (let k = 0; k < 16; k++) b.torus(N, -len / 2 + 0.07 + k * ((len - 0.14) / 15), y - Math.sin((k / 15) * PI) * 0.05, sz * (d / 2 + 0.01), 0.016, 0.004, 'x', 6);
    b.rod(G, -len / 2 + 0.1, 1.64, 0, len / 2 - 0.1, 1.64, 0, 0.02, 8);
    b.bx(G, len / 2 - 0.35, 1.5, -0.08, len / 2 - 0.15, 1.75, 0.08);
    for (const s of [-1, 1]) b.cyl(N, len / 2 - 0.25 + s * 0.06, 1.62, 0.09, 0.04, 0.02, 'z', 12);
  });
  stencil6(b, '질소 — 건식 퍼지 — 볼트', 0, 1.4, d / 2 + 0.001, 1.0, 0.07, '+z');
  let shelf: THREE.Vector3 | null = null;
  if (o.shelf !== false) b.at(0, 0, d / 2, 0, () => { shelf = bracketShelf(b, L, { w: 0.5, d: 0.3, top: 1.0, collide: o.collide }); });
  if (o.collide !== false) b.collide(-len / 2, 0, -d / 2, len / 2, h, d / 2, 'metal', true);
  return { shelf };
}

/**
 * Trench grating (§2.6.7: the cable trench as a flush grating strip in the vault's epoxy floor). Builder-frame
 * coordinates: the strip x0 … x1, z0 … z1 at floor `y` (0), `holes` [x0, z0, x1, z1][] left open for the lifting
 * grilles / the hatch pit (`liftingGrille` / `hatchLid6` bring their own curbs). Galvanised bar grating in two layers (3 cm
 * deep), an angle-iron frame round the strip (a flange over the floor edge, its leg 4 mm inside the opening). Calls: 2 (deck_grate + steel_raw). Collider: the slab `y − 0.03 … y` minus the holes
 * (`collide`; the greybox floor is open below).
 */
export function trenchGrating(b: Builder, L: LevelBuild, o: { x0: number; z0: number; x1: number; z1: number; y?: number; holes?: [number, number, number, number][]; collide?: boolean }) {
  const y = o.y ?? 0, G: Mat = 'deck_grate', S: Mat = 'steel_raw', dp = 0.03;
  let rects: [number, number, number, number][] = [[Math.min(o.x0, o.x1), Math.min(o.z0, o.z1), Math.max(o.x0, o.x1), Math.max(o.z0, o.z1)]];
  for (const h of o.holes ?? []) {
    const [hx0, hz0, hx1, hz1] = [Math.min(h[0], h[2]), Math.min(h[1], h[3]), Math.max(h[0], h[2]), Math.max(h[1], h[3])];
    const next: [number, number, number, number][] = [];
    for (const r of rects) {
      if (hx0 >= r[2] || hx1 <= r[0] || hz0 >= r[3] || hz1 <= r[1]) { next.push(r); continue; }
      if (hz0 > r[1]) next.push([r[0], r[1], r[2], hz0]);
      if (hz1 < r[3]) next.push([r[0], hz1, r[2], r[3]]);
      const za = Math.max(r[1], hz0), zb = Math.min(r[3], hz1);
      if (hx0 > r[0]) next.push([r[0], za, hx0, zb]);
      if (hx1 < r[2]) next.push([hx1, za, r[2], zb]);
    }
    rects = next;
  }
  for (const [x0, z0, x1, z1] of rects) {
    b.solid(() => { b.quad(G, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box'); b.quad(G, (x0 + x1) / 2, y - dp, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box'); });
    if (o.collide !== false) b.collide(x0, y - dp, z0, x1, y, z1, 'metal', true);
  }
  // angle-iron frame: a top flange over the floor edge (y −0.006 … +0.004) and a leg 4 mm inside the opening, so no face
  // lies on the greybox opening's faces or the floor's top
  const frame = (x0: number, z0: number, x1: number, z1: number) => {
    b.bx(S, x0 - 0.03, y - 0.006, z0 - 0.03, x1 + 0.03, y + 0.004, z0 + 0.025).bx(S, x0 - 0.03, y - 0.006, z1 - 0.025, x1 + 0.03, y + 0.004, z1 + 0.03);
    b.bx(S, x0 - 0.03, y - 0.006, z0 + 0.025, x0 + 0.025, y + 0.004, z1 - 0.025).bx(S, x1 - 0.025, y - 0.006, z0 + 0.025, x1 + 0.03, y + 0.004, z1 - 0.025);
    b.bx(S, x0 + 0.004, y - dp - 0.012, z0 + 0.004, x1 - 0.004, y - 0.006, z0 + 0.012).bx(S, x0 + 0.004, y - dp - 0.012, z1 - 0.012, x1 - 0.004, y - 0.006, z1 - 0.004);
    b.bx(S, x0 + 0.004, y - dp - 0.012, z0 + 0.012, x0 + 0.012, y - 0.006, z1 - 0.012).bx(S, x1 - 0.012, y - dp - 0.012, z0 + 0.012, x1 - 0.004, y - 0.006, z1 - 0.012);
  };
  frame(Math.min(o.x0, o.x1), Math.min(o.z0, o.z1), Math.max(o.x0, o.x1), Math.max(o.z0, o.z1));
}

/** Moving grille of `liftingGrille`. */
export interface LiftGrille extends MovingPart6 {
  /** Pose 0 (shut) … 1 (flipped up 105°). */
  lift(k: number): void;
  /** A skitter bursts it open (fast flip, 0.3 s). Times from the call. */
  pop(): { dur: number };
  /** It drops shut under its weight with a bounce ("1.2 s after its skitter is out"). */
  drop(): { dur: number; impact: number };
  at(t: number): void;
  /** Shut, silent (the snap state). */
  snap(): void;
  readonly k: number;
}
/**
 * Lifting grille in the trench grating (§2.6.7 G1–G3: 0.8 × 0.8, 3b `sumpGrille` pattern; every grille drops shut 1.2 s
 * after its skitter is out, snap = shut). Floor prop, origin = centre of the opening on the floor: an angle-iron curb
 * (5 mm proud) round the opening and the GRILLE as a moving part (bar grating with a lifting ring, hinged on its −z
 * edge; `lift(k)` swings it up and over toward −z). `pop()` / `drop()` play the skitter's burst and the fall back.
 * Calls: 1 static (steel_raw) + 1 moving (steel_raw). No collider (the greybox owns the opening; the grille's walk
 * surface is the trench grating's business).
 */
export function liftingGrille(b: Builder, L: LevelBuild, o: { w?: number; d?: number; name?: string } = {}): LiftGrille {
  const w = o.w ?? 0.8, d = o.d ?? 0.8, S: Mat = 'steel_raw';
  b.bx(S, -w / 2 - 0.05, -0.006, -d / 2 - 0.05, w / 2 + 0.05, 0.004, -d / 2 + 0.012).bx(S, -w / 2 - 0.05, -0.006, d / 2 - 0.012, w / 2 + 0.05, 0.004, d / 2 + 0.05);
  b.bx(S, -w / 2 - 0.05, -0.006, -d / 2 + 0.012, -w / 2 + 0.012, 0.004, d / 2 - 0.012).bx(S, w / 2 - 0.012, -0.006, -d / 2 + 0.012, w / 2 + 0.05, 0.004, d / 2 - 0.012);
  b.bx(S, -w / 2 + 0.004, -0.05, -d / 2 + 0.004, w / 2 - 0.004, -0.006, -d / 2 + 0.008).bx(S, -w / 2 + 0.004, -0.05, d / 2 - 0.008, w / 2 - 0.004, -0.006, d / 2 - 0.004);
  const part = part6(b, L, o.name ?? 'grille6', 0, 0.0, -d / 2, (p) => {
    p.bx(S, -w / 2 + 0.02, -0.028, 0.02, w / 2 - 0.02, 0.0, 0.04).bx(S, -w / 2 + 0.02, -0.028, d - 0.04, w / 2 - 0.02, 0.0, d - 0.02);
    p.bx(S, -w / 2 + 0.02, -0.028, 0.04, -w / 2 + 0.04, 0.0, d - 0.04).bx(S, w / 2 - 0.04, -0.028, 0.04, w / 2 - 0.02, 0.0, d - 0.04);
    for (let x = -w / 2 + 0.07; x < w / 2 - 0.05; x += 0.035) p.bx(S, x - 0.003, -0.025, 0.04, x + 0.003, -0.002, d - 0.04);
    for (let z = 0.1; z < d - 0.05; z += 0.1) p.rod(S, -w / 2 + 0.025, -0.006, z, w / 2 - 0.025, -0.006, z, 0.004, 4);
    for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) p.cyl(S, x, -0.01, 0.0, 0.016, 0.08, 'x', 8);
    p.torus(S, 0, -0.002, d - 0.09, 0.035, 0.006, 'y', 10);
  }, { mover: true });
  let k = 0;
  const lift = (v: number) => { k = clamp01(v); part.pivot.rotation.x = -k * (105 * PI) / 180; };
  lift(0);
  let mode: 'pop' | 'drop' = 'pop';
  const pose = (t: number) => {
    if (mode === 'pop') lift(t < 0.18 ? Math.sin((t / 0.18) * PI / 2) : 1 - 0.04 * Math.sin(((t - 0.18) / 0.12) * PI) * (t < 0.3 ? 1 : 0));
    else {
      // tips over the dead centre slowly, then falls (g on a hinged plate), bounces twice
      const T1 = 0.35, T2 = 0.32;
      if (t < T1) lift(1 - 0.12 * smooth(t / T1));
      else if (t < T1 + T2) { const u = (t - T1) / T2; lift(0.88 * (1 - u * u)); }
      else { const u = t - T1 - T2; lift(Math.abs(Math.sin(u * 22)) * 0.06 * Math.exp(-u * 9)); }
    }
  };
  const tl = timeline(L, 1.2, pose);
  return {
    ...part, lift, get k() { return k; },
    pop() { mode = 'pop'; tl.play(0); return { dur: 0.3 }; },
    drop() { mode = 'drop'; tl.play(0); return { dur: 1.2, impact: 0.67 }; },
    at(t) { tl.at(t); },
    snap() { tl.at(0); mode = 'pop'; lift(0); },
  };
}

/** A floor hatch of level 6 (3c `HatchSpec` copied). */
export interface HatchSpec6 {
  name: string;
  /** Opening in plan (world): x0 … x1, z0 … z1; the lid's top is flush at `y`. */
  x0: number; x1: number; z0: number; z1: number; y?: number;
  /** Wheel on the top (opens from above) or on the underside (dogged from below). */
  wheel: 'top' | 'bottom';
  /** Painted on the lid top (≤ 3 lines, `\n`). */
  topText?: string;
  /** A status lamp on the top side by the hinge (red dogged → green open). */
  lamp?: boolean;
  /** W4a's stopper (grey.ts `STOPPER_*6`): a dynamic box over the exit stair's upper treads, enabled only while the lid is shut. */
  stopper?: [number, number, number, number, number, number];
  rooms?: string[];
}
/** §2.6.7: the vault's trench hatch (1.2 × 2.4, opens from above, two-way, hinged on its south edge). */
export const HATCH6_VAULT: HatchSpec6 = { name: 'hatch6_vault', x0: -13.0, x1: -11.8, z0: -160.4, z1: -158.0, wheel: 'top', topText: '케이블 트렌치\n헤드엔드 방면\n웅크리기', stopper: [-13.0, -1.4, -159.85, -11.8, -0.02, -158.0], rooms: ['vault6'] };
/** §2.6.6: the head-end's trench exit (1.2 × 2.2, dogged from below, hinged on its south edge). */
export const HATCH6_HE: HatchSpec6 = { name: 'hatch6_he', x0: 2.4, x1: 3.6, z0: -177.6, z1: -175.4, wheel: 'bottom', topText: '트렌치\n아래에서 잠김\n볼트 경유 출입', lamp: true, stopper: [2.4, -1.4, -177.05, 3.6, -0.02, -175.4], rooms: ['he6'] };

function handwheel(b: Builder, mat: Mat, R: number, t: number, spokes: number) {
  b.torus(mat, 0, 0, 0, R, t, 'z', 24);
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * TAU + 0.3; b.rod(mat, 0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0, t * 0.6, 6); }
  b.cyl(mat, 0, 0, 0, R * 0.18, t * 3, 'z', 12);
}
/**
 * A floor hatch lid hinged on its SOUTH (−z) edge — 3c's `hatchLid` (l5/setpieces.ts) COPIED for level 6 (§11 rule 9),
 * same API. Closed: the lid fills the opening, top flush at `y` (0), 0.08 thick, walkable. Open (`open(1)`): swung 90°
 * up about the hinge line, standing vertical on the south side z `z0 − 0.08` … `z0`. Built: the lid (a registered
 * mover), a flush angle-iron curb (zone), hinge knuckles (zone), the dog wheel (`dogs(k)`: 0 dogged … 1 free) on the top
 * or underside, a canvas top (non-slip, yellow / black border, the stencil), an optional status lamp. Physics: ONE
 * dynamic box (`userData.box`) following the lid. If W4a's greybox already registered a lid of the same name, this
 * builds nothing and returns that one. Calls: lid 2 (navy_grey + its top canvas) + wheel 1 (steel) + lamp 1 if any;
 * curb + hinges in the zone (steel_raw). `L.objects[name].userData`: `open(k)`, `dogs(k)`, `lamp(s)`, `k`, `box`,
 * `spec`, `underside`.
 */
export function hatchLid6(L: LevelBuild, b: Builder, s: HatchSpec6): THREE.Object3D {
  const prior = L.objects.get(s.name);
  if (prior) return prior;
  const y = s.y ?? 0, w = s.x1 - s.x0, d = s.z1 - s.z0, T = 0.08, xc = (s.x0 + s.x1) / 2;
  const rooms = s.rooms ?? b.rooms.slice();
  const body: Mat = 'navy_grey', steel: Mat = 'steel_raw';
  const c = 0.06;
  // (IA-6, D2's note: the curb's inner faces stand 4 mm INSIDE the opening — never coplanar with the pit walls — and its
  //  top 10 mm proud of the floor / lid; the lid's body starts 10 mm in, so the two never touch)
  const e = 0.004, ct = y + 0.01;
  b.bx(steel, s.x0 - c, y - 0.1, s.z0 - c, s.x1 + c, ct, s.z0 + e).bx(steel, s.x0 - c, y - 0.1, s.z1 - e, s.x1 + c, ct, s.z1 + c);
  b.bx(steel, s.x0 - c, y - 0.1, s.z0 + e, s.x0 + e, ct, s.z1 - e).bx(steel, s.x1 - e, y - 0.1, s.z0 + e, s.x1 + c, ct, s.z1 - e);
  const topMat = mat4(L, `k6_hatch_top_${s.name}`, () => {
    const pxW = 512, pxH = Math.round(512 * d / w), R = srand(77 + s.name.length);
    const tex = canvasTex(pxW, pxH, (g) => {
      g.fillStyle = '#6b7378'; g.fillRect(0, 0, pxW, pxH);
      for (let i = 0; i < pxW * pxH * 0.02; i++) { const v = 80 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v + 4},${v + 6},0.5)`; g.fillRect(R() * pxW, R() * pxH, 2, 2); }
      const bw = pxW * 0.05;
      g.save(); g.beginPath(); g.rect(0, 0, pxW, pxH); g.rect(bw, bw, pxW - bw * 2, pxH - bw * 2); g.clip('evenodd');
      for (let i = -pxH; i < pxW + pxH; i += bw * 1.6) { g.fillStyle = '#d6a31a'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + bw * 0.8, 0); g.lineTo(i + bw * 0.8 - pxH, pxH); g.lineTo(i - pxH, pxH); g.fill(); }
      g.restore();
      if (s.topText) {
        const lines = s.topText.split('\n');
        g.fillStyle = '#e4e0d4'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const lh = Math.min(pxH * 0.12, pxW * 0.1);
        lines.forEach((ln, i) => { let fs = lh; g.font = `900 ${fs}px ${SANS}`; while (g.measureText(ln).width > pxW * 0.8 && fs > 8) { fs--; g.font = `900 ${fs}px ${SANS}`; } g.fillText(ln, pxW / 2, pxH * 0.5 + (i - (lines.length - 1) / 2) * lh * 1.25 + (s.wheel === 'top' ? pxH * 0.28 : 0)); });
      }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(20,20,20,${R() * 0.25})`; g.fillRect(R() * pxW, R() * pxH, 1 + R() * 10, 1); }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return new THREE.MeshStandardMaterial({ name: `${s.name}_top`, map: tex, roughness: 0.85, metalness: 0.1 });
  });
  const lampMat = s.lamp ? mat4(L, `k6_hatch_lamp_${s.name}`, () => new THREE.MeshStandardMaterial({ name: `${s.name}_lamp`, color: 0x300806, emissive: 0xff1a0a, emissiveIntensity: 4, roughness: 0.2 })) : null;
  const mk = (name: string, make: (p: Builder) => void, mover: boolean) => {
    const p = L.part(name); make(p);
    const mount = new THREE.Group(); mount.name = name; mount.userData.rooms = rooms.slice();
    const pivot = new THREE.Group(); pivot.name = `${name}:pivot`; pivot.add(p.build()); mount.add(pivot); L.root.add(mount);
    if (mover) L.ctx.physics?.addMover?.(mount);
    return { mount, pivot };
  };
  const lid = mk(s.name, (p) => {
    p.bx(body, -w / 2 + 0.01, 0.0, 0.01, w / 2 - 0.01, T - 0.004, d - 0.01);
    p.quad(topMat, 0, T, d / 2, w - 0.02, d - 0.02, '+y', 0, 'unit', 0.0015);
    for (const fx of [-w / 4, w / 4]) p.bx(body, fx - 0.03, -0.06, 0.08, fx + 0.03, 0.0, d - 0.08);
    for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) p.cyl(body, x, 0.0, 0.0, 0.035, 0.22, 'x', 10);
    if (lampMat) p.cyl(lampMat, w / 2 - 0.16, T + 0.008, 0.22, 0.03, 0.016, 'y', 10);
  }, true);
  lid.mount.position.set(xc, y - T, s.z0);
  const wheelY = s.wheel === 'top' ? T + 0.07 : -0.1, wheelZ = s.wheel === 'top' ? d * 0.38 : d * 0.5;
  const wg = mk(`${s.name}_wheel`, (p) => {
    p.push(0, 0, 0, 0, -PI / 2); handwheel(p, steel, s.wheel === 'top' ? 0.22 : 0.18, 0.018, 4); p.pop();
    p.cyl(steel, 0, s.wheel === 'top' ? -0.04 : 0.04, 0, 0.035, 0.08, 'y', 8);
    for (const a of [0, PI]) p.rbox(steel, Math.cos(a) * 0.32, s.wheel === 'top' ? -0.07 - T : 0.0, Math.sin(a) * 0.32, 0.5, 0.025, 0.06, 0, -a, 0);
  }, false);
  L.root.remove(wg.mount);
  lid.pivot.add(wg.mount);
  wg.mount.position.set(0, wheelY, wheelZ);
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) b.bx(steel, xc + x - 0.12, y - 0.12, s.z0 - 0.07, xc + x + 0.12, y + 0.005, s.z0 + 0.01);
  const box = L.ctx.physics.addBox(new THREE.Box3(), 'metal');
  box.owner = lid.mount;
  box.walkable = true;
  const sb = s.stopper ? L.ctx.physics.addBox(new THREE.Box3(new THREE.Vector3(s.stopper[0], s.stopper[1], s.stopper[2]), new THREE.Vector3(s.stopper[3], s.stopper[4], s.stopper[5])), 'metal') : null;
  if (sb) sb.owner = lid.mount;
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  let k = 0, dk = 0;
  const apply = () => {
    lid.pivot.rotation.x = -k * PI / 2;
    wg.pivot.rotation.y = dk * 2.5 * PI;
    lid.mount.updateMatrixWorld(true);
    const mw = lid.pivot.matrixWorld;
    let i = 0;
    for (const xx of [-w / 2, w / 2]) for (const yy of [0, T]) for (const zz of [0, d]) corners[i++].set(xx, yy, zz).applyMatrix4(mw);
    box.box.setFromPoints(corners);
    if (k > 0.98) { box.box.min.z = s.z0 - T; box.box.max.z = s.z0; }
    box.walkable = k < 0.5;
    if (sb) sb.enabled = k < 0.5;
  };
  apply();
  const root = lid.mount, ud = root.userData;
  ud.spec = s; ud.box = box; ud.stopper = sb; ud.k = 0;
  ud.open = (v: number) => { k = clamp01(v); ud.k = k; apply(); };
  ud.dogs = (v: number) => { dk = clamp01(v); apply(); };
  ud.lamp = (st: 'red' | 'green' | 'off') => { if (!lampMat) return; lampMat.emissive.set(st === 'green' ? 0x30ff60 : 0xff1a0a); lampMat.emissiveIntensity = st === 'off' ? 0 : 4; lampMat.color.set(st === 'green' ? 0x08300f : 0x300806); };
  ud.underside = new THREE.Vector3(xc, y - T, (s.z0 + s.z1) / 2);
  L.objects.set(s.name, root);
  return root;
}

// ═════════════════════════════════════════════════════════════ SHAFT

/** A caged lamp; breakable ones pop (`v6_shaft_lights`). */
export interface LandingLamp { lens: THREE.MeshStandardMaterial; point: THREE.Vector3; readonly dead: boolean; pop(): { dur: number; out: number; tinkle: number }; at(t: number): void; snap(dead?: boolean): void }
/**
 * Caged landing lamp (§2.6.8 LL0–LL3, LLB: caged mains lamps that die one below the other; also tun6_b's red caged
 * emergency points and the shaft's red points, unbreakable). Wall prop (origin on the wall face at the lamp's height,
 * axis +z) or `mount: 'ceiling'` (axis −y): a cast base with a junction box and conduit, a ⌀ 0.15 well-glass globe in a
 * cast guard (four ribs + a ring), `color` ('warm') / `intensity` (0.35). Non-breakable: the shared `lampLens6`.
 * `breakable: true`: the globe is a moving part with its own lens; `bind` = the landing's light (the pop drives it: surge
 * → stutter → off, `enabled = false`); `floorY` = world y where the shards land. Calls: 1 static (navy_grey) + the lens;
 * breakable: + 1 moving (globe + rim) + 1 shard instancing (both rim and shards only drawn after the pop).
 */
export function landingLamp(b: Builder, L: LevelBuild, o: { color?: LampColor6; intensity?: number; mount?: 'wall' | 'ceiling'; breakable?: boolean; bind?: LightHandle; floorY?: number; name?: string } = {}): LandingLamp {
  const N: Mat = 'navy_grey', I = o.intensity ?? 0.35, color = o.color ?? 'warm', ceil = o.mount === 'ceiling';
  b.push(0, 0, 0, 0, ceil ? PI / 2 : 0, 0);
  b.cyl(N, 0, 0, 0.015, 0.11, 0.03, 'z', 16);
  b.cyl(N, 0, 0, 0.055, 0.095, 0.05, 'z', 16);
  if (!ceil) { b.bx(N, -0.06, 0.13, 0, 0.06, 0.25, 0.07); b.rod(N, 0, 0.25, 0.035, 0, 0.6, 0.035, 0.013, 6); }
  else { b.bx(N, 0.13, -0.06, 0, 0.25, 0.06, 0.07); b.rod(N, 0.25, 0, 0.035, 0.6, 0, 0.035, 0.013, 6); }
  b.detail(() => {
    b.torus(N, 0, 0, 0.085, 0.088, 0.008, 'z', 18);
    b.torus(N, 0, 0, 0.225, 0.03, 0.008, 'z', 10);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + PI / 4, c = Math.cos(a), s = Math.sin(a);
      b.rod(N, c * 0.088, s * 0.088, 0.085, c * 0.094, s * 0.094, 0.15, 0.008, 5);
      b.rod(N, c * 0.094, s * 0.094, 0.15, c * 0.03, s * 0.03, 0.225, 0.008, 5);
    }
  });
  const gz = 0.14;
  if (!o.breakable) {
    const lens = lampLens6(L, color, I);
    b.detail(() => b.sphere(lens, 0, 0, gz, 0.072, 12, 1, 1, 1.15));
    const point = b.world(0, 0, gz);
    b.pop();
    return { lens, point, dead: false, pop: () => ({ dur: 0, out: 0, tinkle: 0 }), at() {}, snap() {} };
  }
  const lens = newLens(L, color, I);
  lens.name = `${o.name ?? 'lamp6'}_lens`;
  const shardMat = mat4(L, 'k6_shard', () => L.ctx.materials.clone('plastic_white', { ...NOMAPS, color: 0xd8e4dc, roughness: 0.08, metalness: 0.35 }));
  const part = part6(b, L, o.name ?? 'lamp6_globe', 0, 0, gz, (p) => {
    p.sphere(lens, 0, 0, 0, 0.072, 12, 1, 1, 1.15);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; p.rbox(shardMat, Math.cos(a) * 0.066, Math.sin(a) * 0.066, -0.05, 0.04, 0.006, 0.02 + (k % 3) * 0.014, 0, 0, a + PI / 2); }
  });
  const meshes: THREE.Mesh[] = [];
  part.pivot.traverse((x) => { if ((x as THREE.Mesh).isMesh) meshes.push(x as THREE.Mesh); });
  const globe = meshes.filter((m) => m.material === lens), rim = meshes.filter((m) => m.material === shardMat);
  const origin = b.world(0, 0, gz), axis = dirOf(b, 0, 0, 1);
  b.pop();
  const floorY = o.floorY ?? origin.y - (ceil ? 2.4 : 2.3);
  const NS = 14, R = srand(37);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.02, 0.016, 0, 0.012, -0.014, 0, 0.014, 0, 0.003, -0.02, -0.014, 0.003, 0.014, 0.016, 0.003, 0.012], 3));
  sg.setIndex([0, 1, 2, 3, 4, 5, 0, 3, 5, 0, 5, 1, 1, 5, 4, 1, 4, 2, 2, 4, 3, 2, 3, 0]);
  sg.computeVertexNormals();
  const shards = new THREE.InstancedMesh(sg, shardMat, NS);
  shards.name = `${o.name ?? 'lamp6'}_shards`;
  shards.frustumCulled = false;
  shards.userData.rooms = b.rooms.slice();
  shards.visible = false;
  L.root.add(shards);
  const tr = Array.from({ length: NS }, () => ({ v: axis.clone().multiplyScalar(0.4 + R() * 0.9).add(new THREE.Vector3((R() - 0.5) * 1.4, R() * 0.8, (R() - 0.5) * 1.4)), spin: new THREE.Vector3(R() * 20, R() * 20, R() * 20), s: 0.6 + R() * 0.9, yaw: R() * TAU }));
  const T_OUT = 0.15, DUR = 1.6, _m = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _e = new THREE.Euler(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3();
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
      _qq.setFromEuler(_e);
      _m.compose(_pp.set(x, y, z), _qq, _ss.setScalar(s.s));
      shards.setMatrixAt(i, _m);
    });
    shards.instanceMatrix.needsUpdate = true;
  };
  for (const m of rim) m.visible = false;
  const tl = timeline(L, DUR, pose);
  return {
    lens, point: origin.clone(), get dead() { return dead; },
    pop() { tl.play(0); return { dur: DUR, out: T_OUT, tinkle: T_OUT + 0.45 }; },
    at(t) { tl.at(t); },
    snap(dd = true) {
      if (dd) { tl.at(DUR); if (o.bind) { o.bind.intensityScale = 0; o.bind.enabled = false; } }
      else { tl.at(0); lens.emissiveIntensity = I; for (const m of globe) m.visible = true; for (const m of rim) m.visible = false; shards.visible = false; dead = false; if (o.bind) { o.bind.intensityScale = 1; o.bind.enabled = true; } }
    },
  };
}

/**
 * Fire-point cabinet (§2.6.8 at L2: x −22.6 … −22.2 (0.4 deep), z 1.0, y −6 … −4.6, `p6_shaft_ammo` on its shelf 1.0
 * above L2, 0.2 m from the face; §5.2 window-walk fire points: `d` 0.45 → item 0.3 off the wall). Wall prop (back on
 * the wall), origin on the wall face at floor level, `w` (1.0) along x, `d` (0.4) out, `h` (1.4): a red steel cabinet
 * with double doors to 0.95, an open niche above with its shelf at `shelf` (1.0) — the pickup's place, kept clear —
 * a manual call point and a CO2 extinguisher on a side bracket, `FIRE POINT` sign. Returns the niche point (0.2 behind
 * the front face). Calls: 2 (fire red + painted_dark) + atlas. Collider: the cabinet (`collide`).
 */
export function firePointCabinet(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; shelf?: number; label?: string; collide?: boolean } = {}): { shelf: THREE.Vector3 } {
  const w = o.w ?? 1.0, d = o.d ?? 0.4, h = o.h ?? 1.4, sy = o.shelf ?? 1.0, F = fireRed(L), K: Mat = 'painted_dark';
  b.bx(K, -w / 2 + 0.03, 0, 0.03, w / 2 - 0.03, 0.06, d - 0.03);
  b.bx(F, -w / 2, 0.06, 0, w / 2, sy - 0.05, d - 0.02);
  for (const s of [-1, 1]) b.bx(F, s < 0 ? -w / 2 + 0.02 : 0.006, 0.1, d - 0.02, s < 0 ? -0.006 : w / 2 - 0.02, sy - 0.09, d - 0.008);
  b.bx(F, -w / 2, sy - 0.05, 0, w / 2, sy, d); // niche floor (the shelf)
  for (const s of [-1, 1]) b.bx(F, s * w / 2 - (s > 0 ? 0.02 : 0), sy, 0, s * w / 2 + (s < 0 ? 0.02 : 0), h, d);
  b.bx(F, -w / 2, h - 0.03, 0, w / 2, h, d);
  b.bx(K, -w / 2 + 0.02, sy, 0, w / 2 - 0.02, h - 0.03, 0.01); // niche back (dark)
  b.detail(() => {
    for (const s of [-1, 1]) b.bx(K, s * 0.06 - 0.012, sy - 0.32, d - 0.008, s * 0.06 + 0.012, sy - 0.18, d + 0.015);
    b.bx(F, w / 2 - 0.22, sy + 0.2, 0.01, w / 2 - 0.06, sy + 0.36, 0.07); // call point
    b.bx(K, w / 2 - 0.19, sy + 0.24, 0.07, w / 2 - 0.09, sy + 0.32, 0.074);
    // extinguisher on the −x side bracket
    b.bx(K, -w / 2 - 0.02, 0.5, 0.1, -w / 2, 0.7, 0.3);
    b.cyl(K, -w / 2 - 0.12, 0.42, 0.2, 0.08, 0.6, 'y', 14);
    b.cyl(K, -w / 2 - 0.12, 0.8, 0.2, 0.03, 0.12, 'y', 8);
    b.rod(K, -w / 2 - 0.12, 0.86, 0.2, -w / 2 - 0.22, 0.95, 0.26, 0.012, 5);
  });
  stencil6(b, o.label ?? 'FIRE POINT', 0, h + 0.1, 0.001, 0.5, 0.1, '+z', { style: 'danger' });
  if (o.collide !== false) b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
  return { shelf: b.world(0, sy, d - 0.2) };
}

/**
 * Stores box (§2.6.8: the shaft's bottom box 0.8 × 0.8 × 0.8 with `p6_shaft_med` on it; §2.6.9: the cage's box 0.6 ×
 * 1.0 × 1.0 holding `p6_cage_ammo` / `p6_cage_plate` on its lid). Floor prop, origin = floor centre, `w` × `d` × `h`: a
 * steel stores chest with a flat closed lid (items lie on it), hinge pins at the back, a hasp, side handles, ribs.
 * Calls: 2 (olive + painted_dark) + atlas. Collider: exact.
 */
export function storeBox(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; label?: string; collide?: boolean } = {}) {
  const w = o.w ?? 0.8, d = o.d ?? 0.8, h = o.h ?? 0.8, O = olive(L), K: Mat = 'painted_dark';
  b.bx(K, -w / 2 + 0.02, 0, -d / 2 + 0.02, w / 2 - 0.02, 0.04, d / 2 - 0.02);
  b.bx(O, -w / 2, 0.04, -d / 2, w / 2, h - 0.05, d / 2);
  b.bx(O, -w / 2 - 0.01, h - 0.05, -d / 2 - 0.01, w / 2 + 0.01, h, d / 2 + 0.01);
  b.detail(() => {
    for (const x of [-w / 4, w / 4]) b.bx(K, x - 0.02, 0.06, d / 2, x + 0.02, h - 0.07, d / 2 + 0.01);
    b.bx(K, -0.03, h - 0.12, d / 2 + 0.01, 0.03, h - 0.02, d / 2 + 0.025);
    for (const s of [-1, 1]) { b.bx(K, s * (w / 2) + (s > 0 ? 0 : -0.012), h * 0.55, -0.12, s * (w / 2) + (s > 0 ? 0.012 : 0), h * 0.6, 0.12); }
    for (const x of [-w / 3, w / 3]) b.cyl(K, x, h - 0.05, -d / 2 - 0.012, 0.014, 0.1, 'x', 8);
  });
  stencil6(b, o.label ?? 'STORES', 0, h * 0.45, d / 2 + 0.011, Math.min(0.5, w * 0.6), 0.08, '+z', { style: 'stencil' });
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}

// ═════════════════════════════════════════════════════════════ MOON POOL

/**
 * Handrail along a polyline (gallery rails 1.1, stair-head rails, the mid deck's 1.1 rails) in the BUILDER's frame:
 * `pts` [x, z][] at floor `y`, posts at every vertex and every ≤ 1.5 m, a ⌀ 48 mm top rail at `h` (1.1), a knee rail, a
 * 0.1 toe board (`toe`). Calls: 1 (`mat`, painted_yellow). Collider: MOVE-ONLY 6 cm boxes per axis-aligned segment
 * (D14: rounds and sight pass; `collide`).
 */
export function rail6(b: Builder, L: LevelBuild, o: { pts: [number, number][]; y?: number; h?: number; toe?: boolean; mat?: Mat; collide?: boolean }) {
  const y = o.y ?? 0, h = o.h ?? 1.1, M = o.mat ?? 'painted_yellow', pts = o.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.02) continue;
    const n = Math.max(1, Math.ceil(len / 1.5));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) { const t = k / n; b.cyl(M, lerp(ax, bx, t), y + h / 2, lerp(az, bz, t), 0.022, h, 'y', 8); }
    b.rod(M, ax, y + h, az, bx, y + h, bz, 0.024, 8);
    b.rod(M, ax, y + h * 0.5, az, bx, y + h * 0.5, bz, 0.016, 6);
    if (o.toe !== false) { b.push((ax + bx) / 2, y, (az + bz) / 2, Math.atan2(bx - ax, bz - az)); b.bx(M, -0.004, 0.012, -len / 2, 0.004, 0.11, len / 2); b.pop(); }
    if (o.collide !== false && (Math.abs(ax - bx) < 1e-3 || Math.abs(az - bz) < 1e-3)) collideMoveOnly(b, L, Math.min(ax, bx) - 0.03, y, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, y + h, Math.max(az, bz) + 0.03, true, true);
  }
  for (const [px, pz] of [pts[0], pts[pts.length - 1]]) b.sphere(M, px, y + h, pz, 0.03, 8);
}

/**
 * Gallery deck segment, merged per side (§2.6.9: the galleries at −12, 3.0 m wide; rails 1.1 move-only on the inner
 * edges, parapet plates h 1.1 solid — low cover — where the plan lists them). Builder-frame coordinates: the deck plan
 * box x0 … x1, z0 … z1 at `y`; `rails` = the open edges; `parapets` [edge, from, to] = solid plate along an edge (along x
 * for ±z edges, along z for ±x edges) where the rail is replaced; `wall` = the edge on the wall (diagonal struts under
 * it, every 3 m). Grating deck with a navy fascia channel and cross beams every 1.5 m, toe-boarded rails, the parapets
 * as stiffened plates with a cap, an emergency strip along each open edge (`strips`, 'emerg'; null = none). Calls: 2
 * (deck_grate + navy_grey) + the strip (shared). Colliders: the deck slab (`collide`), rails move-only, parapets
 * solid.
 */
export function galleryRun(b: Builder, L: LevelBuild, o: { x0: number; x1: number; z0: number; z1: number; y?: number; rails?: WallFace[]; parapets?: [WallFace, number, number][]; wall?: WallFace; strips?: StripChannel6 | null; collide?: boolean }) {
  const x0 = Math.min(o.x0, o.x1), x1 = Math.max(o.x0, o.x1), z0 = Math.min(o.z0, o.z1), z1 = Math.max(o.z0, o.z1), y = o.y ?? 0, N: Mat = 'navy_grey', G: Mat = 'deck_grate';
  const rails = o.rails ?? [], paras = o.parapets ?? [], dp = 0.03;
  b.solid(() => { b.quad(G, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box'); b.quad(G, (x0 + x1) / 2, y - dp, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box'); });
  if (o.collide !== false) b.collide(x0, y - dp, z0, x1, y, z1, 'metal', true);
  const alongX = x1 - x0 >= z1 - z0;
  if (alongX) for (let x = x0 + 0.3; x < x1 - 0.1; x += 1.5) b.bx(N, x - 0.06, y - 0.28, z0, x + 0.06, y - dp - 0.02, z1);
  else for (let z = z0 + 0.3; z < z1 - 0.1; z += 1.5) b.bx(N, x0, y - 0.28, z - 0.06, x1, y - dp - 0.02, z + 0.06);
  if (o.wall) b.detail(() => {
    const span = alongX ? z1 - z0 : x1 - x0;
    const at = (u: number) => {
      if (o.wall === '+z' || o.wall === '-z') { const zw = o.wall === '+z' ? z1 : z0, s = o.wall === '+z' ? -1 : 1; b.rod(N, u, y - 1.4, zw, u, y - 0.28, zw + s * span * 0.6, 0.04, 6); }
      else { const xw = o.wall === '+x' ? x1 : x0, s = o.wall === '+x' ? -1 : 1; b.rod(N, xw, y - 1.4, u, xw + s * span * 0.6, y - 0.28, u, 0.04, 6); }
    };
    if (alongX) for (let x = x0 + 0.3; x < x1 - 0.1; x += 3.0) at(x); else for (let z = z0 + 0.3; z < z1 - 0.1; z += 3.0) at(z);
  });
  for (const f of rails) {
    const isZ = f === '+z' || f === '-z', fixed = f === '+z' ? z1 : f === '-z' ? z0 : f === '+x' ? x1 : x0, s = f === '+z' || f === '+x' ? 1 : -1;
    const a = isZ ? x0 : z0, c = isZ ? x1 : z1, inset = 0.05;
    if (isZ) b.bx(N, x0, y - 0.3, Math.min(fixed, fixed - s * 0.012), x1, y - 0.055, Math.max(fixed, fixed - s * 0.012));
    else b.bx(N, Math.min(fixed, fixed - s * 0.012), y - 0.3, z0, Math.max(fixed, fixed - s * 0.012), y - 0.055, z1);
    const ps = paras.filter((p) => p[0] === f).map((p) => [Math.max(a, Math.min(p[1], p[2])), Math.min(c, Math.max(p[1], p[2]))] as [number, number]).sort((p, q) => p[0] - q[0]);
    let u = a;
    const runs: [number, number][] = [];
    for (const [p0, p1] of ps) { if (p0 > u + 0.05) runs.push([u, p0]); u = Math.max(u, p1); }
    if (c > u + 0.05) runs.push([u, c]);
    const line = fixed - s * inset;
    for (const [r0, r1] of runs) rail6(b, L, { pts: isZ ? [[r0, line], [r1, line]] : [[line, r0], [line, r1]], y, h: 1.1, toe: true, mat: N, collide: o.collide });
    for (const [p0, p1] of ps) {
      const t0 = line - s * 0.012, t1 = line + s * 0.008;
      if (isZ) { b.bx(N, p0, y - 0.05, Math.min(t0, t1), p1, y + 1.06, Math.max(t0, t1)); b.bx(N, p0 - 0.01, y + 1.06, line - 0.045, p1 + 0.01, y + 1.1, line + 0.045); }
      else { b.bx(N, Math.min(t0, t1), y - 0.05, p0, Math.max(t0, t1), y + 1.06, p1); b.bx(N, line - 0.045, y + 1.06, p0 - 0.01, line + 0.045, y + 1.1, p1 + 0.01); }
      b.detail(() => { for (let v = p0 + 0.5; v < p1 - 0.2; v += 1.0) { if (isZ) b.bx(N, v - 0.006, y + 0.05, Math.min(line - s * 0.012, line - s * 0.08), v + 0.006, y + 1.0, Math.max(line - s * 0.012, line - s * 0.08)); else b.bx(N, Math.min(line - s * 0.012, line - s * 0.08), y + 0.05, v - 0.006, Math.max(line - s * 0.012, line - s * 0.08), y + 1.0, v + 0.006); } });
      if (o.collide !== false) { if (isZ) b.collide(p0, y, line - 0.045, p1, y + 1.1, line + 0.045, 'metal', true); else b.collide(line - 0.045, y, p0, line + 0.045, y + 1.1, p1, 'metal', true); }
    }
    if (o.strips !== null) { const sl = fixed - s * 0.16; if (isZ) strip6(b, L, a + 0.1, sl, c - 0.1, sl, { y: y + 0.02, ch: o.strips ?? 'emerg', channel: N }); else strip6(b, L, sl, a + 0.1, sl, c - 0.1, { y: y + 0.02, ch: o.strips ?? 'emerg', channel: N }); }
  }
}

/**
 * Bar guard (§2.6.9: the well guard 1.6 m on the coaming, the mid deck's 2.4 m south-edge guard; §2.6.8 the shaft's
 * 2.4 m guards as `style: 'mesh'`). Builder-frame polyline `pts` [x, z][] (axis-aligned segments) at floor `y`, height
 * `h`: square posts (80 mm) at the vertices and every ≤ 2.0 m, a top and a bottom rail (60 mm RHS), and — `bars` —
 * vertical 25 mm square bars at `pitch` (0.11: 85 mm gaps) with NO horizontal mid-rail (nothing to climb), or —
 * `mesh` — welded-mesh infill panels (deck_grate, alpha) in the frames. Calls: 1 (`mat`, painted_yellow) bars;
 * mesh: 2 (`mat` + deck_grate). Collider: MOVE-ONLY 6 cm boxes per segment to `h` (D14; `collide`).
 */
export function barGuard(b: Builder, L: LevelBuild, o: { pts: [number, number][]; y?: number; h: number; pitch?: number; style?: 'bars' | 'mesh'; mat?: Mat; collide?: boolean }) {
  const y = o.y ?? 0, h = o.h, M: Mat = o.mat ?? 'painted_yellow', pitch = o.pitch ?? 0.11, pts = o.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    b.push((ax + bx) / 2, y, (az + bz) / 2, Math.atan2(bx - ax, bz - az) - PI / 2); // local x along the segment
    const n = Math.max(1, Math.ceil(len / 2.0));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) { const u = -len / 2 + (k / n) * len; b.bx(M, u - 0.04, 0, -0.04, u + 0.04, h, 0.04); }
    b.bx(M, -len / 2, h - 0.06, -0.03, len / 2, h, 0.03);
    b.bx(M, -len / 2, 0.05, -0.03, len / 2, 0.11, 0.03);
    if (o.style === 'mesh') {
      for (let k = 0; k < n; k++) { const u0 = -len / 2 + (k / n) * len + 0.04, u1 = -len / 2 + ((k + 1) / n) * len - 0.04; b.solid(() => b.quad('deck_grate', (u0 + u1) / 2, (h + 0.05) / 2, 0, u1 - u0, h - 0.17, '+z', 0, 'box')); }
    } else {
      b.detail(() => { for (let u = -len / 2 + pitch; u < len / 2 - pitch * 0.5; u += pitch) b.bx(M, u - 0.0125, 0.11, -0.0125, u + 0.0125, h - 0.06, 0.0125); });
    }
    b.pop();
    if (o.collide !== false) collideMoveOnly(b, L, Math.min(ax, bx) - 0.03, y, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, y + h, Math.max(az, bz) + 0.03, true, true);
  }
}

/**
 * The well's coaming with its bar guard (§2.6.9: 0.4 m thick, outer x −58.4 … −45.6, z −182.4 … −169.6, top 0.8 m above
 * the dock; a 1.6 m vertical-bar guard flush with its OUTER face; ladder gates 0.9 m wide at the two ladders; three
 * visual exit rungs down the outer face at each gate; sluice ports in the south face below the wet dock's water).
 * Builder-frame coordinates: the OUTER plan box x0 … x1, z0 … z1, dock floor `y`; `inner` (−20.4 abs → `depth` below the
 * floor, 0.6) = how far the inner lining runs down (into the water). Steel plate walls painted yellow with a worn
 * hazard band on the outer faces, a capping bar, stiffener ribs inside, `출입 금지 — 웨트웰` stencils; the guard
 * (painted yellow, merged) with `gates` [face, centre] gaps (the gates are W7's); the sluice ports as dark recessed
 * frames. Calls: 2 (painted_yellow + hazard_stripes) + atlas; `band: false` = 1 (the chamber budget's "coaming + rail 1"). Colliders (`collide`): the coaming solid (rounds stop),
 * the guard move-only.
 */
export function coaming(b: Builder, L: LevelBuild, o: { x0: number; x1: number; z0: number; z1: number; y?: number; h?: number; t?: number; depth?: number; guard?: number; gates?: [WallFace, number][]; gateW?: number; sluices?: number[]; band?: boolean; collide?: boolean }) {
  const x0 = Math.min(o.x0, o.x1), x1 = Math.max(o.x0, o.x1), z0 = Math.min(o.z0, o.z1), z1 = Math.max(o.z0, o.z1), y = o.y ?? 0, h = o.h ?? 0.8, t = o.t ?? 0.4, dep = o.depth ?? 0.6;
  const Y: Mat = 'painted_yellow', H: Mat = 'hazard_stripes', gh = o.guard ?? 1.6, gw = o.gateW ?? 0.9;
  const top = y + h;
  // four walls (outer to inner), running down `dep` below the dock on the inside
  b.bx(Y, x0, y - dep, z0, x1, top, z0 + t).bx(Y, x0, y - dep, z1 - t, x1, top, z1);
  b.bx(Y, x0, y - dep, z0 + t, x0 + t, top, z1 - t).bx(Y, x1 - t, y - dep, z0 + t, x1, top, z1 - t);
  b.detail(() => {
    // hazard band on the outer faces (0.3 high, 5 mm off), capping bar
    const band = (cx: number, cz: number, w: number, face: Face) => b.quad(H, cx, y + 0.35, cz, w, 0.3, face, 0, 'box', 0.005);
    if (o.band !== false) { band((x0 + x1) / 2, z0, x1 - x0, '-z'); band((x0 + x1) / 2, z1, x1 - x0, '+z'); band(x0, (z0 + z1) / 2, z1 - z0, '-x'); band(x1, (z0 + z1) / 2, z1 - z0, '+x'); }
    b.bx(Y, x0 - 0.015, top, z0 - 0.015, x1 + 0.015, top + 0.03, z0 + t + 0.015).bx(Y, x0 - 0.015, top, z1 - t - 0.015, x1 + 0.015, top + 0.03, z1 + 0.015);
    b.bx(Y, x0 - 0.015, top, z0 + t + 0.015, x0 + t + 0.015, top + 0.03, z1 - t - 0.015).bx(Y, x1 - t - 0.015, top, z0 + t + 0.015, x1 + 0.015, top + 0.03, z1 - t - 0.015);
    for (let x = x0 + 1.0; x < x1 - 0.5; x += 1.5) { b.bx(Y, x - 0.01, y - dep, z0 + t, x + 0.01, top - 0.05, z0 + t + 0.12); b.bx(Y, x - 0.01, y - dep, z1 - t - 0.12, x + 0.01, top - 0.05, z1 - t); }
    for (const x of o.sluices ?? []) { b.bx(o.band !== false ? H : Y, x - 0.45, y - 0.55, z0 - 0.012, x + 0.45, y - 0.1, z0 + 0.002); }
  });
  for (const [f, cx, cz] of [['-z', (x0 + x1) / 2, z0], ['+z', (x0 + x1) / 2, z1], ['-x', x0, (z0 + z1) / 2], ['+x', x1, (z0 + z1) / 2]] as [Face, number, number][]) stencil6(b, '출입 금지 — 웨트웰', cx, y + 0.65, cz, 1.6, 0.14, f, { style: 'danger' });
  if (o.collide !== false) {
    b.collide(x0, y - dep, z0, x1, top, z0 + t, 'metal', true).collide(x0, y - dep, z1 - t, x1, top, z1, 'metal', true);
    b.collide(x0, y - dep, z0 + t, x0 + t, top, z1 - t, 'metal', true).collide(x1 - t, y - dep, z0 + t, x1, top, z1 - t, 'metal', true);
  }
  // guard flush with the outer face (its outer bar face on the coaming's outer plane): split at the gates
  const gates = o.gates ?? [];
  const side = (f: WallFace, a: number, c: number, line: number) => {
    const gs = gates.filter((g) => g[0] === f).map((g) => [g[1] - gw / 2, g[1] + gw / 2] as [number, number]).sort((p, q) => p[0] - q[0]);
    let u = a;
    for (const [g0, g1] of gs) { if (g0 > u + 0.1) barGuard(b, L, { pts: f === '-z' || f === '+z' ? [[u, line], [g0, line]] : [[line, u], [line, g0]], y: top + 0.03, h: gh - 0.03, collide: o.collide }); u = g1; }
    if (c > u + 0.1) barGuard(b, L, { pts: f === '-z' || f === '+z' ? [[u, line], [c, line]] : [[line, u], [line, c]], y: top + 0.03, h: gh - 0.03, collide: o.collide });
    // exit rungs (visual) down the outer face at each gate
    b.detail(() => { for (const [g0, g1] of gs) { const m = (g0 + g1) / 2; for (let k = 0; k < 3; k++) { const yy = y + 0.18 + k * 0.22, out = f === '-z' || f === '-x' ? -0.12 : 0.12; if (f === '-z' || f === '+z') { b.rod(Y, m - 0.2, yy, line, m - 0.2, yy, line + out, 0.012, 5); b.rod(Y, m + 0.2, yy, line, m + 0.2, yy, line + out, 0.012, 5); b.rod(Y, m - 0.2, yy, line + out, m + 0.2, yy, line + out, 0.014, 6); } else { b.rod(Y, line, yy, m - 0.2, line + out, yy, m - 0.2, 0.012, 5); b.rod(Y, line, yy, m + 0.2, line + out, yy, m + 0.2, 0.012, 5); b.rod(Y, line + out, yy, m - 0.2, line + out, yy, m + 0.2, 0.014, 6); } } } });
  };
  side('-z', x0, x1, z0 + 0.04); side('+z', x0, x1, z1 - 0.04); side('-x', z0 + 0.08, z1 - 0.08, x0 + 0.04); side('+x', z0 + 0.08, z1 - 0.08, x1 - 0.04);
}

// ── cargo containers (6.0 × 2.4 × 2.6, long axis x) ─────────────────────────

export type ContainerColor = 'navy' | 'orange';
const CL = 6.0, CW = 2.4, CH = 2.6;
/** Build one container's body under `p` (origin floor centre, long axis x, doors at +x) — one material. */
function containerBody(p: Builder, M: Mat) {
  const hl = CL / 2, hw = CW / 2, rail = 0.16, post = 0.17, ins = 0.04;
  // bottom + top side rails, end rails, corner posts with castings
  for (const s of [-1, 1]) {
    p.bx(M, -hl, 0, s * hw - (s > 0 ? rail * 0.6 : 0), hl, rail, s * hw + (s < 0 ? rail * 0.6 : 0));
    p.bx(M, -hl, CH - 0.12, s * hw - (s > 0 ? 0.1 : 0), hl, CH, s * hw + (s < 0 ? 0.1 : 0));
  }
  for (const xs of [-1, 1]) {
    p.bx(M, xs * hl - (xs > 0 ? 0.12 : 0), 0, -hw, xs * hl + (xs < 0 ? 0.12 : 0), 0.22, hw);
    p.bx(M, xs * hl - (xs > 0 ? 0.12 : 0), CH - 0.2, -hw, xs * hl + (xs < 0 ? 0.12 : 0), CH, hw);
    for (const s of [-1, 1]) p.bx(M, xs * hl - (xs > 0 ? post : 0), 0, s * hw - (s > 0 ? post : 0), xs * hl + (xs < 0 ? post : 0), CH, s * hw + (s < 0 ? post : 0));
  }
  // corrugated side walls: alternating ridges (outer) and valleys (inner), trapezoid look from thin flanks
  const x0 = -hl + post, x1 = hl - post, pitch = 0.278, nr = Math.floor((x1 - x0) / pitch);
  for (const s of [-1, 1]) {
    const zo = s * (hw - 0.012), zi = s * (hw - 0.012 - ins);
    p.bx(M, x0, rail, Math.min(zi, zi - s * 0.01), x1, CH - 0.12, Math.max(zi, zi - s * 0.01)); // valley sheet
    for (let k = 0; k < nr; k++) {
      const xa = x0 + k * pitch + 0.03, xb = xa + pitch * 0.5;
      p.bx(M, xa, rail, Math.min(zo, zi), xb, CH - 0.12, Math.max(zo, zi));
    }
  }
  // corrugated front end (−x) (horizontal ribs) and roof (shallow ribs)
  { const zs0 = -hw + post, zs1 = hw - post; p.bx(M, -hl + 0.02, 0.22, zs0, -hl + 0.03, CH - 0.2, zs1); for (let y = 0.35; y < CH - 0.3; y += 0.3) p.bx(M, -hl - 0.0, y, zs0, -hl + 0.02, y + 0.15, zs1); }
  p.bx(M, x0, CH - 0.035, -hw + 0.1, x1, CH - 0.02, hw - 0.1);
  for (let x = x0 + 0.2; x < x1; x += 0.45) p.bx(M, x, CH - 0.04, -hw + 0.1, x + 0.22, CH - 0.012, hw - 0.1);
  // doors (+x end): two leaves, four locking bars with cam keepers and handles, hinge blocks
  const dx = hl - 0.02, zs = hw - post;
  p.bx(M, dx - 0.02, 0.22, -zs, dx, CH - 0.2, zs);
  for (const s of [-1, 1]) for (let y = 0.4; y < CH - 0.35; y += 0.55) p.bx(M, dx, y, Math.min(s * 0.04, s * (zs - 0.05)), dx + 0.012, y + 0.22, Math.max(s * 0.04, s * (zs - 0.05)));
  for (const z of [-zs + 0.18, -0.25, 0.25, zs - 0.18]) {
    p.cyl(M, dx + 0.05, CH / 2, z, 0.016, CH - 0.3, 'y', 6);
    for (const y of [0.28, CH - 0.28]) p.bx(M, dx + 0.0, y - 0.04, z - 0.04, dx + 0.07, y + 0.04, z + 0.04);
    p.bx(M, dx + 0.04, 1.1, z - 0.012, dx + 0.07, 1.14, z + 0.18 * Math.sign(z));
  }
  for (const s of [-1, 1]) for (const y of [0.45, 1.3, 2.15]) p.bx(M, dx - 0.01, y, s * zs - (s > 0 ? 0.03 : 0), dx + 0.04, y + 0.1, s * zs + (s < 0 ? 0.03 : 0));
  // fork pockets in the bottom rails (dark recesses suggested by inset blocks)
  for (const s of [-1, 1]) for (const x of [-1.0, 1.0]) p.bx(M, x - 0.18, 0.02, s * (hw + 0.002) - (s > 0 ? 0.05 : 0), x + 0.18, 0.13, s * (hw + 0.002) + (s < 0 ? 0.05 : 0));
}
const CONT_GEO = new WeakMap<LevelBuild, Map<string, THREE.BufferGeometry>>();
function containerGeo(L: LevelBuild, color: ContainerColor): { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial } {
  const mat = tmat6(L, color === 'navy' ? 'container_navy' : 'container_orange');
  let c = CONT_GEO.get(L);
  if (!c) CONT_GEO.set(L, (c = new Map()));
  let geo = c.get(color);
  if (!geo) { const p = L.part('container_geo'); containerBody(p, mat); geo = p.bake(); c.set(color, geo); }
  return { geo, mat };
}
/** Container label atlas: `B-01` … `B-14`, `할시온 바이오 시스템즈 사업부`, the owner code line. White stencil, alpha-tested. */
const LABELS = ['할시온 바이오 시스템즈 사업부', 'HBSU 640 112 3  22G1', ...Array.from({ length: 14 }, (_, i) => `B-${String(i + 1).padStart(2, '0')}`)];
function labelCell(i: number): [number, number, number, number] {
  // rows: 0 = wide text (1024 × 96), 1 = code (1024 × 64), then 14 numbers in a 4 × 4 grid of 256 × 160
  if (i === 0) return [0, 0, 1024, 96];
  if (i === 1) return [0, 96, 1024, 64];
  const k = i - 2, cx = k % 4, cy = Math.floor(k / 4);
  return [cx * 256, 192 + cy * 160, 256, 160];
}
function labelMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'k6_container_labels', () => {
    const tex = canvasTex(1024, 1024, (g) => {
      g.clearRect(0, 0, 1024, 1024);
      g.fillStyle = '#ece8dc'; g.textAlign = 'center'; g.textBaseline = 'middle';
      LABELS.forEach((t, i) => {
        const [x, y, w, h] = labelCell(i);
        let fs = h * 0.78; g.font = `900 ${fs}px ${SANS}`;
        while (g.measureText(t).width > w * 0.94 && fs > 8) { fs--; g.font = `900 ${fs}px ${SANS}`; }
        g.fillText(t, x + w / 2, y + h / 2 + 2);
      });
      // stencil bridges + wear
      const R = srand(12);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`; g.fillRect(R() * 1024, R() * 1024, 1 + R() * 5, 1 + R() * 2); }
      g.globalCompositeOperation = 'source-over';
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshStandardMaterial({ name: 'k6_container_labels', map: tex, alphaTest: 0.5, roughness: 0.7, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return m;
  });
}
const LABEL_GEO = new Map<number, THREE.PlaneGeometry>();
function labelGeo(i: number): THREE.PlaneGeometry {
  let g = LABEL_GEO.get(i);
  if (g) return g;
  g = new THREE.PlaneGeometry(1, 1);
  const [x, y, w, h] = labelCell(i), uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + uv.getX(k) * w) / 1024, 1 - (y + (1 - uv.getY(k)) * h) / 1024);
  LABEL_GEO.set(i, g);
  return g;
}
/** Label quads of a container numbered `n` (1 … 14) under `p` (same frame as `containerBody`). */
function containerLabels(p: Builder, L: LevelBuild, n: number | null) {
  const M = labelMat(L), hw = CW / 2, m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const put = (i: number, x: number, y: number, z: number, ry: number, w: number, h: number) => p.geo(M, labelGeo(i), 'keep', m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(w, h, 1)).clone());
  for (const s of [-1, 1]) {
    const z = s * (hw + 0.002), ry = s > 0 ? 0 : PI;
    put(0, -0.4 * s, 1.75, z, ry, 3.6, 0.34);
    if (n) put(n + 1, 2.0 * s, 1.0, z, ry, 0.9, 0.56);
  }
  const dx = CL / 2 + 0.014;
  put(1, dx, 2.15, -0.6, PI / 2, 1.0, 0.065);
  if (n) put(n + 1, dx, 1.75, 0.6, PI / 2, 0.8, 0.5);
}
/**
 * Static cargo container in a zone (§2.6.9: 6.0 × 2.4 × 2.6, long axis x, doors at +x; stencils `HALCYON BIO-SYSTEMS
 * DIV.`, `B-01 … B-14`). Floor prop, origin = floor centre: corrugated side walls, corner posts and castings, the
 * door end with four locking bars, cam keepers, hinge blocks, a ribbed roof, fork pockets; labels from the container
 * label atlas (alpha-tested, polygon-offset). Calls: 2 (container_navy | _orange + the label atlas). Collider: none by
 * default (the dock's containers are W4b's NON-WALKABLE dynamic boxes; `collide: true` for a static one).
 */
export function cargoContainer(b: Builder, L: LevelBuild, o: { color?: ContainerColor; n?: number | null; collide?: boolean } = {}) {
  const { geo, mat } = containerGeo(L, o.color ?? 'navy');
  b.geo(mat, geo, 'keep');
  b.detail(() => containerLabels(b, L, o.n ?? null));
  if (o.collide) b.collide(-CL / 2, 0, -CW / 2, CL / 2, CH, CW / 2, 'metal', true);
}
/**
 * A MOVABLE container (the loader carries B-14 and shifts / drops others): a Group (origin = floor centre, long axis
 * x) with two meshes — the shared body geometry (per colour, built once per level) and its label quads. Add it where
 * you need it (the caller owns it; tag `userData.rooms`). Calls: 2.
 */
export function containerObject(L: LevelBuild, o: { color?: ContainerColor; n?: number | null; name?: string; rooms?: string[] } = {}): THREE.Group {
  const { geo, mat } = containerGeo(L, o.color ?? 'navy');
  const g = new THREE.Group();
  g.name = o.name ?? `container6_${o.n ?? 'x'}`;
  g.userData.rooms = (o.rooms ?? []).slice();
  const body = new THREE.Mesh(geo, mat);
  body.name = `${g.name}:body`; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const p = L.part(`${g.name}_labels`);
  containerLabels(p, L, o.n ?? null);
  const lg = p.build();
  lg.traverse((m) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = false; } });
  g.add(lg);
  return g;
}
/**
 * Static containers drawn as instances: one InstancedMesh per colour (1 call each) + ONE merged label mesh for all of
 * them. `items` = world matrices (origin floor centre, long axis x) with colour and number. Returns the group (add it
 * to `L.root`; tag `userData.rooms`).
 */
export function containerInstances(L: LevelBuild, items: { m: THREE.Matrix4; color: ContainerColor; n?: number | null }[], o: { rooms?: string[] } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'containers6';
  g.userData.rooms = (o.rooms ?? []).slice();
  for (const color of ['navy', 'orange'] as ContainerColor[]) {
    const list = items.filter((i) => i.color === color);
    if (!list.length) continue;
    const { geo, mat } = containerGeo(L, color);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => im.setMatrixAt(i, it.m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere(); im.computeBoundingBox();
    im.name = `containers6:${color}`; im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }
  const p = L.part('containers6_labels');
  for (const it of items) { p.m.copy(it.m); containerLabels(p, L, it.n ?? null); }
  g.add(p.build());
  return g;
}

/**
 * Cargo slot paint (§2.6.9: painted yellow hatched outlines on the deck, stencil `CARGO SLOT n`). Builder-frame
 * coordinates: the slot box x0 … x1, z0 … z1 on the floor `y`; a 0.25 m hatched border band (yellow diagonal stripes on
 * a polygon-offset overlay, 3 mm above the deck) and the stencil inside at the −z end. Calls: 1 (the paint overlay) +
 * atlas.
 */
export function slotPaint(b: Builder, L: LevelBuild, o: { x0: number; x1: number; z0: number; z1: number; y?: number; n: number; band?: number }) {
  const x0 = Math.min(o.x0, o.x1), x1 = Math.max(o.x0, o.x1), z0 = Math.min(o.z0, o.z1), z1 = Math.max(o.z0, o.z1), y = o.y ?? 0, bw = o.band ?? 0.25;
  const P = mat4(L, 'k6_slot_paint', () => {
    const tex = canvasTex(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = '#d9a417';
      for (let i = -128; i < 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - 128, 128); g.lineTo(i - 128, 128); g.fill(); }
      const R = srand(8);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${R()})`; g.fillRect(R() * 128, R() * 128, 1 + R() * 6, 1 + R() * 2); }
    });
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ name: 'k6_slot_paint', map: tex, alphaTest: 0.4, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  });
  b.detail(() => {
    b.quad(P, (x0 + x1) / 2, y, z0 + bw / 2, x1 - x0, bw, '+y', 0, 'box', 0.003);
    b.quad(P, (x0 + x1) / 2, y, z1 - bw / 2, x1 - x0, bw, '+y', 0, 'box', 0.003);
    b.quad(P, x0 + bw / 2, y, (z0 + z1) / 2, bw, z1 - z0 - 2 * bw, '+y', 0, 'box', 0.003);
    b.quad(P, x1 - bw / 2, y, (z0 + z1) / 2, bw, z1 - z0 - 2 * bw, '+y', 0, 'box', 0.003);
  });
  stencil6(b, `화물 슬롯 ${o.n}`, (x0 + x1) / 2, y + 0.002, z0 + bw + 0.3, Math.min(2.4, x1 - x0 - 1), 0.36, '+y', { style: 'stencil' });
}

/**
 * Tool shelf (§2.6.9: on P1 / P2's north faces at 1.0 — the undercroft pickups at 0.2 m out, x ±0.4 of the centre).
 * Wall prop, origin on the face at FLOOR level, `w` (1.6) along x, `d` (0.35), top at `top`: a steel shelf with a
 * lip on knee brackets, a pegboard strip above with spanners, a pipe wrench and a grease gun at the ENDS (`clear`
 * ±0.6 of the centre stays free for the pickups). Returns the shelf's item points at x ±0.4 (world).
 * Calls: 1 (steel_raw; `toolMat` for the tools if you want them dark: +1). No collider (the parent's).
 */
export function toolShelf(b: Builder, L: LevelBuild, o: { w?: number; d?: number; top?: number; tools?: boolean; toolMat?: Mat } = {}): THREE.Vector3[] {
  const w = o.w ?? 1.6, d = o.d ?? 0.35, top = o.top ?? 1.0, S: Mat = 'steel_raw', K: Mat = o.toolMat ?? S;
  b.bx(S, -w / 2, top - 0.006, 0.003, w / 2, top, d);
  b.bx(S, -w / 2, top - 0.006, d - 0.004, w / 2, top + 0.04, d);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b.rbox(S, x, top - 0.12, d * 0.45, 0.008, 0.03, d * 1.05, Math.atan2(0.22, d * 0.9), 0, 0);
  b.bx(S, -w / 2, top + 0.3, 0, w / 2, top + 0.62, 0.012);
  if (o.tools !== false) b.detail(() => {
    for (const x of [-w / 2 + 0.12, w / 2 - 0.25]) { for (let k = 0; k < 4; k++) b.bx(K, x + k * 0.03, top + 0.34 + k * 0.03, 0.012, x + k * 0.03 + 0.015, top + 0.56, 0.02); }
    b.rbox(K, -w / 2 + 0.25, top + 0.025, d * 0.5, 0.5, 0.04, 0.05, 0, 0.2, 0); // pipe wrench
    b.cyl(K, w / 2 - 0.2, top + 0.05, d * 0.5, 0.04, 0.3, 'x', 10); // grease gun
  });
  return [b.world(-0.4, top, 0.2), b.world(0.4, top, 0.2)];
}

/**
 * Dewatering pump housing (§2.6.9 undercroft P1 / P2: 2.0 × 2.0, h 1.8, a tool shelf on each north face at 1.0). Floor
 * prop, origin = floor centre, FRONT +z = the north (shelf) face. A machinery-green acoustic enclosure on a skid with
 * lift-off panels, intake louvres, a discharge pipe out of the top with a flanged gate valve (handwheel) and a gauge,
 * the pipe rising to the mid-deck slab (`pipeTo`, 3.6), a suction pipe to the floor sump, a name plate, the tool
 * shelf. Returns the two pickup points. Calls: 2 (machinery + steel_raw) + atlas. Collider: footprint to `h`.
 */
export function pumpHousing(b: Builder, L: LevelBuild, o: { w?: number; d?: number; h?: number; label?: string; pipeTo?: number; collide?: boolean } = {}): { shelf: THREE.Vector3[] } {
  const w = o.w ?? 2.0, d = o.d ?? 2.0, h = o.h ?? 1.8, M = machinery(L), S: Mat = 'steel_raw', pt = o.pipeTo ?? 3.6;
  b.bx(S, -w / 2, 0, -d / 2, w / 2, 0.1, d / 2);
  b.bx(M, -w / 2 + 0.03, 0.1, -d / 2 + 0.03, w / 2 - 0.03, h - 0.04, d / 2 - 0.03);
  b.bx(M, -w / 2, h - 0.04, -d / 2, w / 2, h, d / 2);
  b.detail(() => {
    for (const s of [-1, 1]) for (const x of [-w / 4, w / 4]) b.bx(M, x - w / 4 + 0.04, 0.16, s * (d / 2 - 0.03) - (s > 0 ? 0 : 0.008), x + w / 4 - 0.04, h - 0.1, s * (d / 2 - 0.03) + (s > 0 ? 0.008 : 0));
    for (let k = 0; k < 8; k++) b.rbox(S, -w / 2 + 0.002, 0.4 + k * 0.08, 0, 0.012, 0.04, d * 0.6, 0, 0, 0.5);
    for (const s of [-1, 1]) for (const z of [-d / 2 + 0.25, d / 2 - 0.25]) b.torus(S, s * (w / 2 - 0.25), h + 0.03, z, 0.05, 0.012, 'z', 10);
  });
  // discharge: up from the top, a gate valve, on to the slab
  const px = 0.45, pz = -0.4;
  b.cyl(S, px, h + 0.15, pz, 0.12, 0.3, 'y', 16);
  b.cyl(S, px, h + 0.31, pz, 0.2, 0.03, 'y', 16);
  b.cyl(M, px, h + 0.5, pz, 0.16, 0.34, 'y', 14);
  b.cyl(S, px, h + 0.69, pz, 0.2, 0.03, 'y', 16);
  b.cyl(S, px, h + 0.62, pz, 0.025, 0.5, 'y', 8);
  b.push(px, h + 0.9, pz, 0); b.torus(S, 0, 0, 0, 0.18, 0.015, 'y', 18); for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; b.rod(S, 0, 0, 0, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, 0.01, 5); } b.pop();
  b.cyl(S, px, (h + 0.7 + pt) / 2, pz, 0.12, pt - h - 0.7, 'y', 16);
  b.cyl(S, px, pt - 0.1, pz, 0.2, 0.04, 'y', 16);
  b.detail(() => { b.cyl(S, px + 0.22, h + 0.25, pz, 0.07, 0.03, 'x', 14); b.rod(S, px + 0.12, h + 0.25, pz, px + 0.2, h + 0.25, pz, 0.012, 5); });
  stencil6(b, o.label ?? 'DEWATERING PUMP P1 — 340 M³/H', 0, h - 0.25, d / 2 - 0.021, 1.2, 0.08, '+z');
  let shelf: THREE.Vector3[] = [];
  b.at(0, 0, d / 2, 0, () => { shelf = toolShelf(b, L, { w: 1.6, d: 0.35, top: 1.0 }); });
  if (o.collide !== false) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
  return { shelf };
}

/** Door + contents of `ammoLocker`. */
export interface AmmoLocker { door: MovingPart6; open(k: number): void; swing(): { dur: number }; set(full: boolean): void; readonly full: boolean; shelf: THREE.Vector3; use: THREE.Vector3 }
/**
 * Dock ammo locker (§2.6.9 `locker6_e/_w/_n`: fire-point lockers on the gallery walls, "탄약 가져가기", re-armed at every
 * boss restore; beside each a medkit / plate on the locker's shelf at 1.0, 0.3 m from the face). Wall prop, origin on
 * the wall face at floor level: an olive steel wall cabinet (0.8 × 0.75 × 0.32, floor at 0.7) with a yellow-banded door
 * hinged on −x (a moving part: `open(k)`, `swing()` 0.5 s), stacked ammo cans inside (`set(full)` shows / hides them —
 * full at build), a side bracket shelf (0.42 deep, top 1.0) `shelfX` (1.0; −1.0 for the other side) along the wall for
 * the §5.2 medkit / plate (item 0.3 m out of the wall), a stencil (`AMMUNITION — 5.56`). Returns the shelf item point and
 * the use point (0.5 out at 1.0), world.
 * Calls: 2 static (olive + painted_dark) + door 1 + cans 1. Collider: the cabinet + shelf (`collide`).
 */
export function ammoLocker(b: Builder, L: LevelBuild, o: { label?: string; shelf?: boolean; shelfX?: number; name?: string; collide?: boolean } = {}): AmmoLocker {
  const O = olive(L), K: Mat = 'painted_dark', w = 0.8, h = 0.75, d = 0.32, y0 = 0.7, nm = o.name ?? 'locker6';
  b.bx(O, -w / 2, y0, 0, w / 2, y0 + 0.02, d).bx(O, -w / 2, y0 + h - 0.02, 0, w / 2, y0 + h, d);
  for (const s of [-1, 1]) b.bx(O, s * w / 2 - (s > 0 ? 0.02 : 0), y0, 0, s * w / 2 + (s < 0 ? 0.02 : 0), y0 + h, d);
  b.bx(K, -w / 2 + 0.02, y0 + 0.02, 0, w / 2 - 0.02, y0 + h - 0.02, 0.01);
  b.bx(O, -w / 2 + 0.02, y0 + 0.36, 0.01, w / 2 - 0.02, y0 + 0.38, d - 0.02);
  stencil6(b, o.label ?? '탄약 — 5.56 — 사격 지점', 0, y0 + h + 0.09, 0.001, 0.8, 0.08, '+z', { style: 'warning' });
  const sx = o.shelfX ?? 1.0;
  let shelf = b.world(sx, 1.0, 0.3);
  if (o.shelf !== false) {
    b.at(sx, 0, 0, 0, () => { shelf = bracketShelf(b, L, { w: 0.5, d: 0.42, top: 1.0, item: 0.3, mat: O, collide: o.collide }); });
  }
  const cans = part6(b, L, `${nm}_cans`, 0, y0, 0.0, (p) => {
    for (const [yy, n] of [[0.02, 3], [0.38, 3]] as const) for (let i = 0; i < n; i++) {
      const x = -0.25 + i * 0.25;
      p.bx(O, x - 0.1, yy, 0.06, x + 0.1, yy + 0.18, 0.28);
      p.bx(K, x - 0.1, yy + 0.18, 0.06, x + 0.1, yy + 0.2, 0.28);
      p.bx(K, x - 0.03, yy + 0.2, 0.15, x + 0.03, yy + 0.215, 0.19);
    }
  });
  const door = part6(b, L, `${nm}_door`, -w / 2, y0, d, (p) => {
    p.bx(O, 0.005, 0.005, 0, w - 0.005, h - 0.005, 0.02);
    p.bx(K, 0.01, h / 2 - 0.05, 0.02, w - 0.01, h / 2 + 0.05, 0.022);
    p.bx(K, w - 0.08, h / 2 - 0.12, 0.02, w - 0.06, h / 2 + 0.12, 0.05);
    for (const yy of [0.1, h - 0.1]) p.cyl(K, 0, yy, 0.01, 0.012, 0.08, 'y', 8);
  }, { mover: true });
  let full = true;
  const openK = (k: number) => { door.pivot.rotation.y = -clamp01(k) * 1.9; };
  const tl = timeline(L, 0.5, (t) => openK(smooth(t / 0.5)));
  if (o.collide !== false) b.collide(-w / 2, y0, 0, w / 2, y0 + h, d + 0.02, 'metal', false);
  return {
    door, open: openK, swing() { tl.play(0); return { dur: 0.5 }; },
    set(v) { full = v; cans.mount.visible = v; }, get full() { return full; },
    shelf, use: b.world(0, 1.0, 0.5),
  };
}

/**
 * Hose reel (dock wash-down / fire). Wall prop, origin on the wall face at the reel's axis height: a red steel drum on a
 * swing bracket with 20 m of rubber hose wound on it, the hose end and a brass-look nozzle hanging in a clip, a feed
 * valve. Calls: 2 (fire red + rubber). Collider: none (wall-hung, above the walk band? no: add `collide`).
 */
export function hoseReel(b: Builder, L: LevelBuild, o: { collide?: boolean } = {}) {
  const F = fireRed(L), K: Mat = 'rubber', r = 0.32;
  b.bx(F, -0.08, -0.3, 0, 0.08, 0.3, 0.02);
  b.cyl(F, 0, 0, 0.1, 0.05, 0.18, 'z', 10);
  for (const z of [0.12, 0.38]) b.cyl(F, 0, 0, z, r, 0.015, 'z', 28);
  for (let k = 0; k < 4; k++) b.torus(K, 0, 0, 0.15 + k * 0.055, r - 0.06, 0.026, 'z', 28);
  b.cyl(K, 0, 0, 0.25, r - 0.09, 0.24, 'z', 20);
  b.detail(() => {
    hose(b, K, [[r - 0.05, -0.15, 0.35], [r + 0.05, -0.45, 0.42], [r + 0.12, -0.75, 0.3]], 0.026, 8, 6);
    b.cyl(F, r + 0.12, -0.85, 0.3, 0.03, 0.2, 'y', 10);
    b.bx(F, r + 0.06, -0.95, 0.0, r + 0.18, -0.78, 0.02);
    b.rod(F, -0.05, -0.3, 0.01, -0.05, -0.6, 0.01, 0.02, 6);
    b.torus(F, -0.05, -0.62, 0.06, 0.05, 0.01, 'z', 10);
  });
  if (o.collide) b.collide(-0.4, -r, 0, 0.4, r, 0.45, 'metal', false);
}

/**
 * Rubber fender hung on a kerb / quay face (the wet dock's kerbs, the window walk). Wall prop, origin on the face at the
 * fender's top chain height: a ⌀ 0.3 × `len` (1.0) cylindrical fender with end caps, hung by two chains from eyes.
 * Calls: 2 (rubber + steel_raw). No collider.
 */
export function fender(b: Builder, L: LevelBuild, o: { len?: number; drop?: number } = {}) {
  const len = o.len ?? 1.0, r = 0.15, dr = o.drop ?? 0.35, K: Mat = 'rubber', S: Mat = 'steel_raw';
  b.cyl(K, 0, -dr - r, r + 0.01, r, len, 'x', 16);
  for (const s of [-1, 1]) b.sphere(K, s * len / 2, -dr - r, r + 0.01, r, 12, 1, 0.35, 1);
  b.detail(() => { for (const s of [-1, 1]) { b.torus(S, s * len * 0.35, 0, 0.03, 0.03, 0.008, 'x', 8); for (let k = 0; k < 5; k++) b.torus(S, s * len * 0.35, -0.05 - k * (dr - 0.02) / 5, 0.04 + k * (r - 0.03) / 5, 0.022, 0.006, k % 2 ? 'z' : 'x', 6); } });
}

/**
 * Mooring bollard (double bitt) on the dock. Floor prop, origin = floor centre: a base plate and two ⌀ 0.3 posts 0.55
 * high with flared caps, painted dark with yellow caps. Calls: 2 (painted_dark + painted_yellow). Collider: the posts
 * (`collide`).
 */
export function bollard(b: Builder, L: LevelBuild, o: { collide?: boolean } = {}) {
  const K: Mat = 'painted_dark', Y: Mat = 'painted_yellow';
  b.bx(K, -0.55, 0, -0.25, 0.55, 0.05, 0.25);
  for (const s of [-1, 1]) { b.cyl(K, s * 0.3, 0.3, 0, 0.15, 0.5, 'y', 18, 0.13); b.cyl(Y, s * 0.3, 0.57, 0, 0.19, 0.06, 'y', 18); b.cyl(Y, s * 0.3, 0.62, 0, 0.17, 0.04, 'y', 18, 0.12); }
  b.detail(() => { for (const s of [-1, 1]) for (const x of [-0.48, 0.48]) b.cyl(K, x, 0.055, s * 0.18, 0.025, 0.02, 'y', 6); });
  if (o.collide !== false) b.collide(-0.5, 0, -0.2, 0.5, 0.66, 0.2, 'metal', true);
}

/**
 * Life ring in a wall holder (window walk, galleries). Wall prop, origin on the wall face at the ring's centre: a
 * ⌀ 0.75 orange ring with four white reflective bands and a grab line, on two hooks, a stencil `ERIDU DEEP — MOON
 * POOL`. Calls: 2 (painted_orange + painted_white) + atlas.
 */
export function lifeRing(b: Builder, L: LevelBuild, o: { label?: string } = {}) {
  const Or: Mat = 'painted_orange', Wt: Mat = 'painted_white', r = 0.3, tube = 0.07;
  b.torus(Or, 0, 0, tube + 0.02, r, tube, 'z', 28);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + PI / 4; b.push(Math.cos(a) * r, Math.sin(a) * r, tube + 0.02, 0, 0, a); b.cyl(Wt, 0, 0, 0, tube + 0.004, 0.06, 'x', 12); b.pop(); }
  b.detail(() => {
    for (let k = 0; k < 8; k++) { const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU, R2 = r + tube + 0.015, sag = 0.03; b.rod(Wt, Math.cos(a0) * R2, Math.sin(a0) * R2, tube + 0.02, Math.cos((a0 + a1) / 2) * (R2 + sag), Math.sin((a0 + a1) / 2) * (R2 + sag), tube + 0.02, 0.006, 4); b.rod(Wt, Math.cos((a0 + a1) / 2) * (R2 + sag), Math.sin((a0 + a1) / 2) * (R2 + sag), tube + 0.02, Math.cos(a1) * R2, Math.sin(a1) * R2, tube + 0.02, 0.006, 4); }
    for (const s of [-1, 1]) { b.bx(Wt, s * 0.2 - 0.02, r + 0.02, 0, s * 0.2 + 0.02, r + 0.1, 0.12); }
  });
  stencil6(b, o.label ?? 'ERIDU DEEP — MOON POOL', 0, -r - 0.18, 0.001, 0.6, 0.07, '+z');
}

/** Festoon control: `set(span)` moves the last trolley (the bridge's end) to `span` metres from the anchor. */
export interface Festoon { obj: THREE.Group; set(span: number): void; readonly max: number }
/**
 * Festoon cable system (§2.6.10: the flat power cable feeding the loader's bridge, hung in loops from trolleys on a
 * track). Wall prop, origin on the wall face at the TRACK's height, the track along local x from 0 (the anchor) to `len`
 * (the full travel); `n` (10) trolleys share the cable. The track (an I-beam on wall brackets every 3 m) is static;
 * the trolleys and the cable loops are two InstancedMeshes (`set(span)` spaces the trolleys evenly from the anchor to
 * `span` and re-hangs every loop: shorter spans hang deeper, as a fixed cable length does). Calls: static 1
 * (steel_raw) + 2 (trolleys steel_raw, loops rubber).
 */
export function festoon(b: Builder, L: LevelBuild, o: { len: number; n?: number; loop?: number; name?: string; span?: number }): Festoon {
  const len = o.len, n = o.n ?? 10, S: Mat = 'steel_raw', loopLen = o.loop ?? Math.max(1.0, (len / n) * 1.12), off = 0.35;
  for (let x = 0; x <= len + 0.01; x += 3) { b.bx(S, x - 0.05, -0.08, 0, x + 0.05, 0.08, off - 0.05); }
  b.bx(S, -0.2, -0.004, off - 0.07, len + 0.2, 0.004, off + 0.07);
  b.bx(S, -0.2, -0.1, off - 0.005, len + 0.2, 0.1, off + 0.005);
  b.bx(S, -0.2, -0.104, off - 0.07, len + 0.2, -0.096, off + 0.07);
  // instanced parts (geometry authored for unit loops)
  const tp = L.part('festoon_trolley');
  tp.bx(S, -0.09, -0.24, -0.06, 0.09, -0.12, 0.06);
  for (const z of [-0.05, 0.05]) for (const x of [-0.05, 0.05]) tp.cyl(S, x, -0.085, z, 0.03, 0.02, 'z', 10);
  tp.cyl(S, 0, -0.27, 0, 0.012, 0.06, 'y', 6);
  const tGeo = tp.bake();
  // a unit loop: span 1 along x, sag 1 (a catenary-ish curve), a flat cable 6 × 2.5 cm
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => { const u = i / 12; return new THREE.Vector3(u, -Math.sin(u * PI) * 1.0 - 0.0, 0); }));
  const lGeo = new THREE.TubeGeometry(curve, 24, 1, 4, false);
  const ps = lGeo.getAttribute('position') as THREE.BufferAttribute;
  // flatten the tube's cross-section to a flat cable (radius 1 → scaled later per instance is wrong for the profile; so
  // rebuild positions: keep the centre line, put a fixed 0.03 × 0.012 profile around it)
  const cen = curve.getSpacedPoints(24);
  for (let i = 0; i < ps.count; i++) {
    const seg = Math.floor(i / 5), c = cen[Math.min(seg, cen.length - 1)];
    const k = i % 5, a = (k / 4) * TAU;
    ps.setXYZ(i, c.x, c.y + Math.sin(a) * 0.012, Math.cos(a) * 0.03);
  }
  lGeo.computeVertexNormals();
  const tMat = L.ctx.materials.get('steel_raw'), lMat = L.ctx.materials.get('rubber');
  const trolleys = new THREE.InstancedMesh(tGeo, tMat, n + 1), loops = new THREE.InstancedMesh(lGeo, lMat, n);
  const obj = new THREE.Group();
  obj.name = o.name ?? 'festoon6';
  obj.userData.rooms = b.rooms.slice();
  worldOf(b, 0, 0, off).decompose(obj.position, obj.quaternion, obj.scale);
  trolleys.name = `${obj.name}:trolleys`; loops.name = `${obj.name}:loops`;
  for (const m of [trolleys, loops]) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; obj.add(m); }
  L.root.add(obj);
  const _mm = new THREE.Matrix4();
  const set = (span: number) => {
    const sp = Math.max(n * 0.25, Math.min(len, span)), gap = sp / n;
    // fixed cable length per loop: sag from the chord (parabola approximation: l ≈ g + 8 s² / (3 g))
    const sag = Math.sqrt(Math.max(0.0001, (loopLen - gap) * 3 * gap / 8));
    for (let i = 0; i <= n; i++) trolleys.setMatrixAt(i, _mm.makeTranslation(i * gap, 0, 0));
    for (let i = 0; i < n; i++) loops.setMatrixAt(i, _mm.makeTranslation(i * gap, -0.27, 0).multiply(new THREE.Matrix4().makeScale(gap, sag, 1)));
    trolleys.instanceMatrix.needsUpdate = true; loops.instanceMatrix.needsUpdate = true;
  };
  set(o.span ?? len);
  return { obj, set, max: len };
}

/**
 * Crane runway (§2.6.10: runway rails on corbels along both side walls at y −4.0, z −194 … −150, end-stop buffers).
 * Wall prop, origin on the wall face at the RAIL TOP's height, along local x (`len`): a 0.6 m plate-girder runway beam
 * 0.55 out from the wall on welded corbels (gusseted brackets) every `every` (4) m, a crane rail (head, web, foot) on
 * its top flange with clips, a walkway-free underside, and an end-stop at both ends — a stop block with a yellow
 * hydraulic buffer pointing inward. Calls: 2 (navy_grey + crane_yellow). No collider (out of reach).
 */
export function runwayRail(b: Builder, L: LevelBuild, o: { len: number; every?: number; out?: number; buffers?: boolean }) {
  const len = o.len, N: Mat = 'navy_grey', Y = tmat6(L, 'crane_yellow'), oz = o.out ?? 0.55, ev = o.every ?? 4, gh = 0.6, rh = 0.12;
  const yTop = -rh; // girder top flange under the rail
  // girder: top + bottom flanges, web
  b.bx(N, -len / 2, yTop - 0.03, oz - 0.17, len / 2, yTop, oz + 0.17);
  b.bx(N, -len / 2, yTop - gh, oz - 0.17, len / 2, yTop - gh + 0.03, oz + 0.17);
  b.bx(N, -len / 2, yTop - gh + 0.03, oz - 0.008, len / 2, yTop - 0.03, oz + 0.008);
  b.detail(() => { for (let x = -len / 2 + 0.5; x < len / 2; x += 1.0) for (const s of [-1, 1]) b.bx(N, x - 0.006, yTop - gh + 0.03, oz + s * 0.008 - (s < 0 ? 0.15 : 0), x + 0.006, yTop - 0.03, oz + s * 0.008 + (s > 0 ? 0.15 : 0)); });
  // rail
  b.bx(N, -len / 2, yTop, oz - 0.07, len / 2, yTop + 0.02, oz + 0.07);
  b.bx(N, -len / 2, yTop + 0.02, oz - 0.012, len / 2, yTop + rh - 0.035, oz + 0.012);
  b.bx(N, -len / 2, yTop + rh - 0.035, oz - 0.035, len / 2, yTop + rh, oz + 0.035);
  b.detail(() => { for (let x = -len / 2 + 0.3; x < len / 2; x += 0.6) for (const s of [-1, 1]) b.bx(N, x - 0.04, yTop, oz + s * 0.09 - 0.025, x + 0.04, yTop + 0.035, oz + s * 0.09 + 0.025); });
  // corbels
  for (let x = -len / 2 + 0.5; x < len / 2; x += ev) {
    b.bx(N, x - 0.2, yTop - gh - 0.5, 0, x + 0.2, yTop - gh, 0.05);
    b.bx(N, x - 0.15, yTop - gh - 0.04, 0.05, x + 0.15, yTop - gh, oz + 0.2);
    for (const s of [-1, 1]) b.rbox(N, x + s * 0.1, yTop - gh - 0.28, 0.26, 0.015, 0.5, 0.45, -0.75, 0, 0);
  }
  if (o.buffers !== false) for (const s of [-1, 1]) {
    const xe = s * (len / 2);
    b.bx(Y, Math.min(xe + s * 0.025, xe - s * 0.4), yTop - 0.065, oz - 0.21, Math.max(xe + s * 0.025, xe - s * 0.4), yTop + 0.5, oz + 0.21);
    b.cyl(Y, xe - s * 0.54, yTop + 0.25, oz, 0.11, 0.32, 'x', 16);
    b.cyl(N, xe - s * 0.76, yTop + 0.25, oz, 0.06, 0.24, 'x', 12);
    b.cyl(Y, xe - s * 0.88, yTop + 0.25, oz, 0.14, 0.04, 'x', 16);
    b.detail(() => { for (let k = 0; k < 3; k++) b.rbox(N, xe - s * 0.41, yTop + 0.05 + k * 0.17, oz, 0.012, 0.06, 0.4, PI / 4, 0, 0); });
  }
}

/** Amber rotating beacon (kit 4's `rotBeacon`, level-6 name): `set(on)`, `bind` to an `alarm` light. Wall prop. */
export function amberBeacon(b: Builder, L: LevelBuild, o: { name?: string; intensity?: number; bind?: (m: THREE.MeshStandardMaterial) => void } = {}): Beacon {
  return rotBeacon4(b, L, { ...o, name: o.name ?? 'beacon6_dome' });
}
