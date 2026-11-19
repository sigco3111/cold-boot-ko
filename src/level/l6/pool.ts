/**
 * LEVEL 6 — pool6's structure look (decks, galleries, stairs, coaming + guard look, wet dock, water surfaces with W6, sea
 * windows, rails + festoon), its lights and groups (`lights_out6`, `beacons6`), emergency strips, the slots' paint.
 * Task D3a (stage 3d §2.6.9, §2.6.10, §2.7, §2.8, §2.9, §11).
 *
 * Contract: see `tunnels.ts`. pool6 is dressed by two files: this one first, then `dockdress.ts` (both `build`s run).
 * This file owns STRUCTURE and LIGHT; `dockdress.ts` (D3b) owns the dressing objects (containers, pumps, console
 * placement, cage dressing, signs, the dock board, the undercroft panel, lockers' look) and the vignettes
 * `v6_well_eyes`, `v6_window`, `loader_dead6`.
 *
 * Stand-ins: the shell's (`grey.ts` SHELLS6.pool6) visuals of the sub-builders this task owns are removed — their
 * COLLIDERS stay (every collider here is the shell's; this file adds none):
 *   grey6:pool6_wetdock (ramps, channel side: restyled `dock_steel_wet`), grey6:pool6_coaming, grey6:pool6_guard_well,
 *   grey6:pool6_decks (mid deck, cage platform, galleries, the four stairs), grey6:pool6_rails, grey6:pool6_guard_mid;
 *   in `pool6_grey`: the two runway bars and the window mullions (by box).
 * Drawn here instead: the mid deck (plate + navy slab + undercroft beams), the cage platform (grating), galleries and
 * landings (kit `galleryRun`, emergency strips on every open edge), the 1.1 m rails (`rail6`), the 2.4 m mid-deck bar guard
 * and the coaming's 1.6 m bar guard (`barGuard`: vertical bars, no mid-rail — a moon pool's railing, not a wall), the
 * coaming (yellow plate, hazard band, capping, NO ENTRY stencils; the ladders, gates, exit rungs and sluice ports are
 * W7's `well6`), closed steel stairs with amber nosings, hull frames above head height and roof girders, 14 high-bay
 * fixtures, the runway rails (kit), the festoon on the west wall (follows the loader's bridge), the sea-window frame, the
 * wet dock's kerb facings, the water quads, slot paint, keep-clear bands, amber strips (coaming foot, guard base, kerbs,
 * mid-deck edge, stair nosings).
 *
 * Lights (§2.7.1; this file places them, `lights: []` replaces the shell's table — group names unchanged):
 *   `pool6`        high-bays HB1 (−62, −0.8, −160) all · HB2 (−42, −0.8, −184) all · HB3 (−42, −0.8, −160) medium+ ·
 *                  HB4 (−62, −0.8, −184) medium+. DECISION (plan: HB1/HB2 both at z −160 on LOW, y −2): one north and
 *                  one south lamp on LOW, so the reveal / the wet dock are not unlit on LOW; y −0.8 because the loader's
 *                  trolley (top −1.0) runs under the roof at −2. Bounds by floor (S5): the north pair's box starts above
 *                  the mid deck (y −16.2, never into the undercroft), the south pair's ends at the mid deck's edge
 *                  (z −166.05) and reaches the wet dock (y −21.5). Their 14 fixture lenses share one material bound to
 *                  HB1 (dark after `lights_out6`).
 *   `pool6_frame`  the frame's work lamp (spot, ALL qualities, prio 0.7, casts on MEDIUM+ only) from W7's
 *                  `frame6.userData.lampPoint` → `lampTarget`.
 *   `pool6_uc`     the undercroft refuge (point, all, hard-wired; on after `lights_out6`), bounded y ≤ −16.3.
 *   `pool6_beacon` BC1 (−52, −4.3, −148.6) / BC2 (−52, −6, −195.4) amber `alarm` (from the hostile start: `beacons6`).
 *                  DECISION: BC1 at −4.3, not −6 — at −6 its dome sat in front of the dock board (y −8 … −5).
 *   `pool6_emerg`  ER1 (−73, −10, −150) / ER2 (−31, −10, −194) red (on at `lights_out6`).
 * The loader's four floods are its own lights (W3a / W3b).
 *
 * FX (§2.9, D23 — all registered with rooms ['pool6'], seenFrom ['shaft6', 'stores6']): `fx6_well` (`fx.well`, the surface quad
 * here is the opaque `water` material), `fx6_sea` (`fx.viewport` behind the pane, the tether outside lit by the outside
 * floods), `fx6_wet` (the wake rings' registry entry), `fx6_mist` (cold mist over the well).
 * Handles for D3b / ST (the vignettes `v6_well_eyes`, `v6_window`): `L.objects` 'fx6_well' / 'fx6_sea' (`userData.handle`),
 * also `level.root.userData.pool6fx = { well, sea, mist }`
 * (`well.eyes(on, list)`, `sea.pass(s)`). The shear is watched here: once `frame6.state().fired`, the sea's tether is
 * cut (`cutCable(6)`, or at once when the frame was snapped fired).
 *
 * Vignettes owned here: `lights_out6` (stage 2: HB1–4 off, ER1/ER2 on, the sea's outside floods off — the tether
 * beacon stays —, the well 'dark', `regions.dark` gains the chamber; sound `lights_out_dock`) and `beacons6` (the
 * beacons on and turning). Both with silent snaps.
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { FxSystemEx, ViewportHandle, WellHandle } from '../../fx';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { isStandin, restyle } from '../l3/kit3';
import { box3, placeLights6, POOL_STAIRS6, type LightRow6, type RoomId6 } from './grey';
import type { RoomDress } from './index';
import {
  amberBeacon, barGuard, festoon, galleryRun, lampLens6, rail6, runwayRail, slotPaint, stencil6, strip6, stripMat6, tint6, tmat6,
  type Beacon, type WallFace,
} from './kit6';

const PI = Math.PI;
type Box6 = [number, number, number, number, number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────────────────────────────────────────────────────────── the chamber's numbers (§2.6.9)

/** Interior faces of the chamber's walls; roof. */
const WX0 = -75.8, WX1 = -28.2, WZ0 = -195.8, WZ1 = -148.2, ROOF = 2.0;
const DOCK = -20, WET = -20.8, CHANNEL = -21.3, MID = -16, GAL = -12, WATER = -20.3;
/** The well opening and the coaming's outer box (0.4 m plate, top −19.2) + guard top −17.6. */
const WELL = { x0: -58, x1: -46, z0: -182, z1: -170 } as const;
const CM = { x0: -58.4, x1: -45.6, z0: -182.4, z1: -169.6, top: -19.2, t: 0.4, guardTop: -17.6 } as const;
/** The ladder gates (W7's `well6`): gaps in the guard on the W / E faces at z −176 (posts at ±0.48). */
const GATE_Z = -176, GATE_HALF = 0.5;
/** The wet dock recess and the window walk. */
const WD = { x0: -66, x1: -38, z0: -194, z1: -182.4 } as const;
/** Sea windows (pane at z −196, opening x −64 … −40, y −19.6 … −16.0; mullions x −56, −48). */
const WIN = { x0: -64, x1: -40, y0: -19.6, y1: -16.0, pane: -196.0, wall: -196.4 } as const;
/** Roof girders (z) and the high-bay fixtures' columns (x). */
const GIRDERS_Z = [-154, -160, -166, -172, -178, -184, -190];
const HB_X = [-62, -42];
const SLOTS: [number, number, number, number, number, number][] = [
  [1, -74, -68, -182.0, -179.6, DOCK], [2, -74, -68, -176.4, -174.0, DOCK], [3, -36, -30, -182.0, -179.6, DOCK],
  [4, -36, -30, -176.4, -174.0, DOCK], [5, -60, -54, -192.0, -189.6, WET], [6, -50, -44, -192.0, -189.6, WET],
];

const COOL = 0xc8e2e6, WARM = 0xffe2c0, RED = 0xff2a18, AMBER = 0xffa020;
/** Light boxes by floor (S5). */
const NORTH_UP: Box6 = [-76.1, -16.2, -196.1, -27.9, 2.1, -147.9];
const SOUTH: Box6 = [-76.1, -21.5, -196.1, -27.9, 2.1, -166.05];
const UNDER: Box6 = [-73, -20.1, -166.2, -31, -16.3, -148.1];

/** The chamber's light table (§2.7.1 groups; see the header for the decisions). */
const LIGHTS: LightRow6[] = [
  { group: 'pool6', type: 'point', p: [-62, -0.8, -160], color: COOL, i: 160, d: 40, bounds: NORTH_UP },
  { group: 'pool6', type: 'point', p: [-42, -0.8, -184], color: COOL, i: 180, d: 42, bounds: SOUTH },
  { group: 'pool6', type: 'point', p: [-42, -0.8, -160], color: COOL, i: 160, d: 40, min: 'medium', bounds: NORTH_UP },
  { group: 'pool6', type: 'point', p: [-62, -0.8, -184], color: COOL, i: 180, d: 42, min: 'medium', bounds: SOUTH },
  { group: 'pool6_uc', type: 'point', p: [-52, -16.75, -157.0], color: WARM, i: 30, d: 22, bounds: UNDER },
  { group: 'pool6_beacon', type: 'point', p: [-52, -4.3, -148.6], color: AMBER, i: 150, d: 48, off: true, flicker: 'alarm' },
  { group: 'pool6_beacon', type: 'point', p: [-52, -6, -195.4], color: AMBER, i: 150, d: 48, off: true, flicker: 'alarm' },
  { group: 'pool6_emerg', type: 'point', p: [-73, -10, -150], color: RED, i: 220, d: 60, off: true },
  { group: 'pool6_emerg', type: 'point', p: [-31, -10, -194], color: RED, i: 220, d: 60, off: true },
];

// ───────────────────────────────────────────────────────────── helpers

const fxOf = (L: LevelBuild) => L.ctx.fx as unknown as FxSystemEx;
interface ItemLike { geo: THREE.BufferGeometry; m: THREE.Matrix4 }
interface BatchLike { mat: THREE.Material; items: ItemLike[] }
/** Remove a builder's visual items whose world AABB lies inside `bx` (± 2 cm). Colliders are untouched. */
function dropItems(L: LevelBuild, builder: string, bx: Box6): number {
  const b = L.namedBuilder(builder) as unknown as { batches: Map<string, BatchLike> };
  const lim = box3(bx).expandByScalar(0.02), t = new THREE.Box3();
  let n = 0;
  for (const bt of b.batches.values()) for (let i = bt.items.length - 1; i >= 0; i--) {
    const it = bt.items[i];
    if (!it.geo.boundingBox) it.geo.computeBoundingBox();
    t.copy(it.geo.boundingBox!).applyMatrix4(it.m);
    if (lim.containsBox(t)) { bt.items.splice(i, 1); n++; }
  }
  return n;
}
/** A private material (cached on the LevelBuild). */
const MATS = new WeakMap<LevelBuild, Map<string, THREE.MeshStandardMaterial>>();
function mat(L: LevelBuild, key: string, make: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  let m = MATS.get(L);
  if (!m) MATS.set(L, (m = new Map()));
  let r = m.get(key);
  if (!r) { m.set(key, (r = make())); r.name = `d3a_${key}`; }
  return r;
}

// ───────────────────────────────────────────────────────────── build

function buildPool(L: LevelBuild) {
  const ctx = L.ctx;
  const b = L.builder('pool6_d3a');
  b.rooms = ['pool6'];
  const navy: Mat = 'navy_grey';
  const plate = tmat6(L, 'dock_steel');
  const wetPlate = tmat6(L, 'dock_steel_wet');
  const steel: Mat = 'steel_raw';
  const dark: Mat = 'painted_dark';
  LOOK.wall = tint6(L, 'pool_wall', 'hull_white', 0x7c878b, { roughness: 0.5 });
  LOOK.ceiling = tint6(L, 'pool_roof', 'navy_grey', 0x3b444a, { roughness: 0.7 });

  // ── 0. the shell's stand-in visuals this task replaces (colliders stay) ──
  restyle(L, 'grey6:pool6_wetdock', isStandin, wetPlate);
  for (const n of ['grey6:pool6_coaming', 'grey6:pool6_guard_well', 'grey6:pool6_decks', 'grey6:pool6_rails', 'grey6:pool6_guard_mid']) restyle(L, n, () => true, null);
  dropItems(L, 'pool6_grey', [-75.7, -4.4, -194.1, -75.1, -3.9, -149.9]);
  dropItems(L, 'pool6_grey', [-28.9, -4.4, -194.1, -28.3, -3.9, -149.9]);
  for (const x of [-56, -48]) dropItems(L, 'pool6_grey', [x - 0.2, WIN.y0 - 0.05, WIN.wall - 0.05, x + 0.2, WIN.y1 + 0.05, -195.75]);
  dropItems(L, 'pool6_grey', [-28.4, -11.5, -182.0, -28.0, -8.0, -178.0]);   // the greybox wayfinding label

  // ── 1. lights ──
  const hl = placeLights6(L, LIGHTS);
  const hb = hl.filter((h) => h.desc.group === 'pool6');
  const uc = hl.find((h) => h.desc.group === 'pool6_uc')!;
  const bcs = hl.filter((h) => h.desc.group === 'pool6_beacon');
  const ers = hl.filter((h) => h.desc.group === 'pool6_emerg');
  const frame = L.objects.get('frame6');
  const fu = frame?.userData as { lampPoint?: THREE.Vector3; lampTarget?: THREE.Vector3; lamp?: (k: number) => void; state?: () => { fired: boolean; fireT: number } } | undefined;
  const lp = fu?.lampPoint ?? V(-52, -13.8, -166.2), lt = fu?.lampTarget ?? V(-52, -16, -168.5);
  const fl = L.spot('pool6_frame', lp.x, lp.y, lp.z, lt.x, lt.y, lt.z, 0xffe6c4, 40, 9, 0.85, { cast: ctx.render.quality !== 'low', priority: 0.7, penumbra: 0.6 });
  fu?.lamp?.(1);
  void fl;

  // ── 2. walls, frames, roof ──
  hull(L, b);
  // ── 3. decks, galleries, stairs, rails, guards ──
  decks(L, b, plate, navy);
  galleries(L, b);
  for (const s of POOL_STAIRS6) stair(L, b, s);
  edgeRails(L, b);
  edgeStuds(L, b);
  // ── 4. the well: coaming + guard, keep-clear band, strips ──
  coaming6(L, b);
  // ── 5. the wet dock: kerb facings, hazard paint under the water, strips ──
  wetDock(L, b, wetPlate);
  // ── 6. slots' paint ──
  for (const [n, x0, x1, z0, z1, y] of SLOTS) slotPaint(b, L, { x0, x1, z0, z1, y: y === WET ? WET + 0.02 : y, n });   // (wet slots: on the wet plate)
  // ── 7. sea windows: frame, mullions, sill ──
  windows(L, b, dark);
  // ── 8. the loader's runway rails, the festoon, the high-bay fixtures, beacons, emergency lamps, the undercroft lamp ──
  b.at(WX0, -4.0, -172, PI / 2, () => runwayRail(b, L, { len: 44, out: 0.4 }));
  b.at(WX1, -4.0, -172, -PI / 2, () => runwayRail(b, L, { len: 44, out: 0.4 }));
  const fest = festoon6(L, b);
  fixtures(L, b, hb[0], steel, dark);
  const beacons: Beacon[] = [];
  b.at(-52, -4.4, WZ1, PI, () => beacons.push(amberBeacon(b, L, { name: 'beacon6_n', bind: (m) => bcs[0]?.bindEmissive(m, 0.8) })));
  b.at(-52, -6.0, WZ0, 0, () => beacons.push(amberBeacon(b, L, { name: 'beacon6_s', bind: (m) => bcs[1]?.bindEmissive(m, 0.8) })));
  wallLamp(L, b, -73, -9.8, WZ1, PI, 'red', ers[0]);
  wallLamp(L, b, -31, -9.8, WZ0, 0, 'red', ers[1]);
  ceilingLamp(L, b, -52, -16.3, -157.0, uc);

  // ── 9. water surfaces + fx ──
  const water = ctx.materials.get('water');
  b.detail(() => {
    b.quad(water, (WELL.x0 + WELL.x1) / 2, WATER, (WELL.z0 + WELL.z1) / 2, WELL.x1 - WELL.x0, WELL.z1 - WELL.z0, '+y', 0, 'box');
    b.quad(water, (WD.x0 + WD.x1) / 2, WATER, (WD.z0 + WD.z1) / 2, WD.x1 - WD.x0, WD.z1 - WD.z0, '+y', 0, 'box');
  });
  const fx = fxOf(L);
  let well: WellHandle | null = null, sea: ViewportHandle | null = null, mist: { mesh: THREE.Object3D } | null = null;
  try {
    well = fx.well({
      id: 'fx6_well', rooms: ['pool6'], seenFrom: ['shaft6', 'stores6'],
      box: new THREE.Box3(V(WELL.x0, -34, WELL.z0), V(WELL.x1, WATER, WELL.z1)),
      tether: { top: V(-52, WATER, -171.9), bottom: V(-52, -34, -171.9), radius: 0.11 },
      gate: { center: V(-52, -34, -176), radius: 4.6, lamps: 8 },
      ladders: [V(-57.8, -34, GATE_Z), V(-46.2, -34, GATE_Z)],
    });
    sea = fx.viewport({
      id: 'fx6_sea', rooms: ['pool6'], seenFrom: ['shaft6', 'stores6'],
      position: V(-52, (WIN.y0 + WIN.y1) / 2, WIN.pane - 0.1), normal: V(0, 0, 1), width: WIN.x1 - WIN.x0, height: WIN.y1 - WIN.y0,
      depth: 26, spread: 0.9, seabed: -24, heads: 0.6, desat: 0.3, state: 'calm',
      cable: { from: V(-50.5, -40, -200.5), to: V(-53, 18, -206), radius: 0.35, beacon: V(-51.2, -12, -203.1), markers: 2 },
      // the outside floods aimed at the tether (W6 note): two from the pane's sides crossing on it, one low and centred
      floods: [
        { at: [-8, -1.4, 2.0], dir: [0.62, 0.12, 1], intensity: 1.1 },
        { at: [8, -1.4, 2.0], dir: [-0.5, 0.12, 1], intensity: 1.0 },
        { at: [0, -2.4, 2.0], dir: [0.05, -0.4, 1], intensity: 0.7 },
      ],
    });
    fx.waterFx({ id: 'fx6_wet', rooms: ['pool6'], seenFrom: ['shaft6', 'stores6'] });
    mist = fx.fog({ id: 'fx6_mist', box: new THREE.Box3(V(WELL.x0, WATER, WELL.z0), V(WELL.x1, -18.6, WELL.z1)), color: 0xa9bac4, density: 0.22, height: 0.9, rooms: ['pool6'], seenFrom: ['shaft6', 'stores6'], lowHalf: true });
  } catch (e) { console.error('[level6] pool6 fx failed', e); }
  L.root.userData.pool6fx = { well, sea, mist };
  // D3b's vignettes (`v6_well_eyes`, `v6_window`) find the handles as objects (`userData.handle`)
  for (const [id, h] of [['fx6_well', well], ['fx6_sea', sea]] as const) {
    if (!h) continue;
    const o = new THREE.Object3D(); o.name = id; o.userData.handle = h; o.userData.rooms = ['pool6'];
    L.objects.set(id, o);
  }

  // ── 10. the shear → the tether outside (cut), the festoon follows the bridge ──
  let cut = false, loader: THREE.Object3D | null = null, seek = 0, span = -1;
  L.updaters.push((dt) => {
    if (!cut && fu?.state) {
      const s = fu.state();
      if (s.fired) { cut = true; sea?.cutCable(s.fireT < 1.5 ? 6 : 0); }
    }
    if (loader && !loader.parent) loader = null;
    if (!loader && (seek -= dt) <= 0) { seek = 0.5; loader = ctx.scene.getObjectByName('loader') ?? null; }
    const rig = loader?.userData.loaderRig as { bridgeZ?: number } | undefined;
    const want = rig && Number.isFinite(rig.bridgeZ) ? FEST.anchor - (rig.bridgeZ! + 1.7) : 0;
    if (Math.abs(want - span) > 0.005) { span = want; fest.set(want); }
    // (the height mist's base in the chamber: render's `mistFloor` rule, set by the level's index — IB6)
  });

  // ── 11. vignettes: beacons6 (hostile start), lights_out6 (stage 2) ──
  const lm = ctx.render.lights;
  const beaconsOn = () => { lm.setGroup('pool6_beacon', { enabled: true }); for (const bc of beacons) bc.set(true); };
  L.vignette('beacons6', beaconsOn, { snap: beaconsOn });
  const darkAdd = () => {
    const regions = ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
    if (!regions) return;
    const list = (regions.dark ??= []);
    const b3 = box3([-76, -21.8, -196, -28, 2.0, -148]);
    if (!list.some((q) => q.equals(b3))) list.push(b3);
  };
  const out = (snap: boolean) => {
    lm.setGroup('pool6', { enabled: false });
    lm.setGroup('pool6_emerg', { enabled: true });
    sea?.setState('dark', snap ? 0.01 : 1.2);
    well?.setState('dark', snap ? 0.01 : 1.5);
    (L.objects.get('well6')?.userData.lamps as ((k: number) => void) | undefined)?.(0.3);   // W7's gate lenses dim with the fx
    darkAdd();
  };
  L.vignette('lights_out6', () => { L.sfx('lights_out_dock', -52, -4, -170, 1.0); out(false); }, { snap: () => out(true) });
}

// ───────────────────────────────────────────────────────────── walls, frames, roof

/**
 * Hull frames (T-section ribs) — only where no body can touch them (≥ 2.8 m over the galleries; over the window on the
 * south wall), a stringer belt at −9.0 on the gallery walls, a dark dado on the dock walls, roof girders and purlins.
 */
function hull(L: LevelBuild, b: Builder) {
  const R = tint6(L, 'hull_rib', 'navy_grey', 0x6d7880, { roughness: 0.62 });
  const D = 0.32, top = ROOF - 0.01;
  const ribX = (x: number, z: number, y0: number, s: 1 | -1) => {
    const xi = x + s * D;
    b.bx(R, Math.min(x, xi), y0, z - 0.05, Math.max(x, xi), top, z + 0.05);
    b.bx(R, Math.min(xi, xi + s * 0.03), y0, z - 0.16, Math.max(xi, xi + s * 0.03), top, z + 0.16);
  };
  const ribZ = (x: number, z: number, y0: number, s: 1 | -1) => {
    const zi = z + s * D;
    b.bx(R, x - 0.05, y0, Math.min(z, zi), x + 0.05, top, Math.max(z, zi));
    b.bx(R, x - 0.16, y0, Math.min(zi, zi + s * 0.03), x + 0.16, top, Math.max(zi, zi + s * 0.03));
  };
  const BELT = -9.0;
  // east / west walls: frames at the runway corbels (every 4 m), from the belt up; east skips the d6_pool door
  for (let z = -150.5; z >= -190.6; z -= 4) {
    ribX(WX0, z, BELT, 1);
    if (Math.abs(z - -169.8) > 2.2) ribX(WX1, z, BELT, -1);
  }
  // north wall (the dock board x −58 … −46, d6_stores x −70): from the belt up
  for (let x = -73.5; x <= -30; x += 4) if (x < -60 || x > -44) if (Math.abs(x - -70) > 2.2) ribZ(x, WZ1, BELT, -1);
  // south wall: over the window band only (y −15.4 up; the window walk is below)
  for (let x = -73.5; x <= -30; x += 4) ribZ(x, WZ0, -15.1, 1);
  // stringer belts (0.14 deep) at −9.0 on E / W / N; a heavier one on the south wall over the window
  b.bx(R, WX0, BELT - 0.25, WZ0 + 0.01, WX0 + 0.14, BELT, WZ1 - 0.01).bx(R, WX1 - 0.14, BELT - 0.25, WZ0 + 0.01, WX1, BELT, WZ1 - 0.01);
  b.bx(R, WX0 + 0.14, BELT - 0.25, WZ1 - 0.14, WX1 - 0.14, BELT, WZ1);
  b.bx(R, WX0 + 0.01, -15.4, WZ0, WX1 - 0.01, -15.1, WZ0 + 0.2);
  // dado: dark painted lining 1.2 m on the dock walls (window walk, undercroft back wall, the dock's E / W walls), 12 mm off
  const dado = tint6(L, 'dado', 'navy_grey', 0x2c353c, { roughness: 0.55 });
  b.detail(() => {
    b.bx(dado, WX0 + 0.06, DOCK, WZ0, WIN.x0 - 0.47, DOCK + 1.2, WZ0 + 0.025).bx(dado, WIN.x1 + 0.47, DOCK, WZ0, WX1 - 0.06, DOCK + 1.2, WZ0 + 0.025);
    b.bx(dado, WX0 + 0.06, DOCK, WZ1 - 0.025, WX1 - 0.06, DOCK + 1.2, WZ1);
    b.bx(dado, WX0, DOCK, WZ0 + 0.06, WX0 + 0.025, DOCK + 1.2, WZ1 - 0.06);
    b.bx(dado, WX1 - 0.025, DOCK, WZ0 + 0.06, WX1, DOCK + 1.2, WZ1 - 0.06);
  });
  // roof: box girders across x (0.5 × 1.3) at GIRDERS_Z, purlins along z, a ridge beam
  for (const z of GIRDERS_Z) {
    b.bx(R, WX0, ROOF - 1.3, z - 0.25, WX1, ROOF - 0.01, z + 0.25);
    b.detail(() => { for (let x = WX0 + 2; x < WX1 - 1; x += 3) b.bx(R, x - 0.015, ROOF - 1.28, z - 0.27, x + 0.015, ROOF - 0.03, z + 0.27); });
  }
  for (const x of [-70, -58, -46, -34]) b.bx(R, x - 0.12, ROOF - 0.55, WZ0 + 0.01, x + 0.12, ROOF - 0.02, WZ1 - 0.01);
}

// ───────────────────────────────────────────────────────────── decks

function decks(L: LevelBuild, b: Builder, plate: Mat, navy: Mat) {
  // mid deck: plate (5 cm) on a navy slab, beams under (the undercroft's ceiling)
  b.bx(plate, -72.8, MID - 0.05, -166.0, -31.2, MID, -148.2);
  b.bx(navy, -72.8, MID - 0.3, -166.0, -31.2, MID - 0.05, -148.2);
  b.detail(() => {
    for (let x = -71.3; x < -31.5; x += 3) b.bx(navy, x - 0.1, MID - 0.62, -166.0, x + 0.1, MID - 0.3, -148.21);
    b.bx(navy, -72.8, MID - 0.6, -165.9, -31.2, MID - 0.3, -165.6);
  });
  // walkway paint on the mid deck (the route console ↔ cage ↔ stairs): two yellow lines along x at z −163.5 / −161.5
  const P = L.overlay('painted_yellow');
  b.detail(() => {
    for (const z of [-164.2, -161.8]) b.quad(P, -52, MID, z, 36, 0.08, '+y', 0, 'box', 0.003);
  });
  // the cage platform: open grating over the well's north edge on two navy edge beams
  const G: Mat = 'deck_grate';
  b.solid(() => {
    b.quad(G, -52, MID, -169, 6, 6, '+y', 0, 'box');
    b.quad(G, -52, MID - 0.03, -169, 6, 6, '+y', 0, 'box');
  });
  b.bx(navy, -55.0, MID - 0.4, -172.0, -54.8, MID - 0.045, -166.0).bx(navy, -49.2, MID - 0.4, -172.0, -49.0, MID - 0.045, -166.0);
  b.bx(navy, -54.8, MID - 0.4, -172.0, -49.2, MID - 0.045, -171.8);
  b.detail(() => { for (let z = -171.0; z < -166.1; z += 1.0) b.bx(navy, -54.8, MID - 0.2, z - 0.05, -49.2, MID - 0.045, z + 0.05); });
  // the cage platform's front edge: amber strip on the mid deck's south edge either side of it
  strip6(b, L, -72.6, -165.8, -55.1, -165.8, { y: MID + 0.002, ch: 'amber', channel: navy });
  strip6(b, L, -48.9, -165.8, -31.4, -165.8, { y: MID + 0.002, ch: 'amber', channel: navy });
}

/** Galleries (y −12) and the two landings — kit `galleryRun` (no colliders: the shell's slabs, rails, parapets). */
function galleries(L: LevelBuild, b: Builder) {
  const run = (x0: number, x1: number, z0: number, z1: number, rails: WallFace[], parapets: [WallFace, number, number][] = [], wall?: WallFace) =>
    galleryRun(b, L, { x0, x1, z0, z1, y: GAL, rails, parapets, wall, collide: false });
  // east (inner edge x −31.2 = '-x'): split at the landing join z −159.6 … −157.6 and the NE corner (z > −151.2)
  run(-31.2, WX1, WZ0, -159.6, ['-x'], [['-x', -192, -184], ['-x', -182, -174]], '+x');
  run(-31.2, WX1, -159.6, -157.6, [], [], '+x');
  run(-31.2, WX1, -157.6, -151.2, ['-x'], [], '+x');
  run(-31.2, WX1, -151.2, WZ1, [], [], '+x');
  // west (inner edge x −72.8 = '+x')
  run(WX0, -72.8, WZ0, -159.6, ['+x'], [['+x', -192, -184], ['+x', -182, -174], ['+x', -168, -160]], '-x');
  run(WX0, -72.8, -159.6, -157.6, [], [], '-x');
  run(WX0, -72.8, -157.6, -151.2, ['+x'], [], '-x');
  run(WX0, -72.8, -151.2, WZ1, [], [], '-x');
  // north (inner edge z −151.2 = '-z'), parapets x −66 … −58 and −46 … −38
  run(-72.8, -31.2, -151.2, WZ1, ['-z'], [['-z', -66, -58], ['-z', -46, -38]], '+z');
  // the landings (the stairs arrive from the north at x −35 … −33.2 / −72.6 … −70.8)
  run(-35.0, -31.2, -159.6, -157.6, ['-z', '-x']);
  rail6(b, L, { pts: [[-33.2, -157.65], [-31.2, -157.65]], y: GAL, mat: 'navy_grey', collide: false });
  run(-72.8, -70.6, -159.6, -157.6, ['-z', '+x']);
  rail6(b, L, { pts: [[-70.8, -157.65], [-70.6, -157.65]], y: GAL, mat: 'navy_grey', collide: false });
}

/** A closed steel stair (the shell's stepped collider shape): navy body, diamond-plate treads, side stringers, amber nosings. */
function stair(L: LevelBuild, b: Builder, s: (typeof POOL_STAIRS6)[number]) {
  const { x0, x1, z0, dir, risers, rise, tread } = s;
  const y0 = s.y0 ?? 0, N: Mat = 'navy_grey', T: Mat = 'floor_plate';
  for (let k = 0; k < risers; k++) {
    const za = z0 + dir * tread * k, zb = z0 + dir * tread * (k + 1), top = y0 + rise * (k + 1);
    const lo = Math.min(za, zb), hi = Math.max(za, zb);
    b.bx(N, x0 + 0.004, y0 + 0.004, lo, x1 - 0.004, top - 0.03, hi);
    b.bx(T, x0 + 0.004, top - 0.03, lo, x1 - 0.004, top, hi);
    strip6(b, L, x0 + 0.1, za + dir * 0.05, x1 - 0.1, za + dir * 0.05, { y: top, ch: 'amber', channel: N });
  }
  // side stringers: a sloped plate along each side, its top 3 cm over the nosing line
  const run = tread * risers, hgt = rise * risers, len = Math.hypot(run, hgt), ang = Math.atan2(hgt, run);
  const zc = z0 + dir * run / 2, yc = y0 + hgt / 2 + rise - 0.12;
  for (const x of [x0 - 0.012, x1 + 0.012]) b.rbox(N, x, yc, zc, 0.024, 0.3, len, dir > 0 ? -ang : ang, 0, 0);
}

/** The mid deck's 1.1 m rails and 2.4 m bar guard (south edge), its E / W rails — visuals over the shell's colliders. */
function edgeRails(L: LevelBuild, b: Builder) {
  const N: Mat = 'navy_grey';
  for (const [x0, x1] of [[-72.8, -72.0], [-70.0, -68.0], [-36.0, -34.0], [-32.0, -31.2]] as const) rail6(b, L, { pts: [[x0, -165.975], [x1, -165.975]], y: MID, mat: N, collide: false });
  rail6(b, L, { pts: [[-31.225, -166.0], [-31.225, -148.3]], y: MID, mat: N, collide: false });
  rail6(b, L, { pts: [[-72.775, -166.0], [-72.775, -148.3]], y: MID, mat: N, collide: false });
  for (const [x0, x1] of [[-68.0, -55.0], [-49.0, -36.0]] as const) {
    barGuard(b, L, { pts: [[x0, -165.975], [x1, -165.975]], y: MID, h: 2.4, collide: false });
  }
}

/**
 * Edge marker studs (hard-wired, the amber strip channel: on in every state): a dotted line every 1.5 m on the fascia
 * of every open deck edge — the galleries' inner edges, the landings, the mid deck's edges — so the decks' outlines read
 * from across the chamber in the dark (§2.7.3: gallery edges readable lamp-off after `lights_out6`).
 */
function edgeStuds(L: LevelBuild, b: Builder) {
  const M = stripMat6(L, 'amber');
  const along = (x0: number, z0: number, x1: number, z1: number, y: number, nx: number, nz: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / 1.5));
    b.detail(() => {
      for (let i = 0; i <= n; i++) {
        const t = (i + 0.5) / (n + 1), x = x0 + (x1 - x0) * t + nx * 0.02, z = z0 + (z1 - z0) * t + nz * 0.02;
        b.bx(M, x - (nz ? 0.05 : 0.012), y - 0.16, z - (nx ? 0.05 : 0.012), x + (nz ? 0.05 : 0.012), y - 0.12, z + (nx ? 0.05 : 0.012));
      }
    });
  };
  // galleries (fascia at y −12 − 0.3 … −12.05; studs just under the deck), inner edges
  along(-31.2, WZ0 + 0.3, -31.2, -159.6, GAL, -1, 0); along(-31.2, -157.6, -31.2, -151.2, GAL, -1, 0);
  along(-72.8, WZ0 + 0.3, -72.8, -159.6, GAL, 1, 0); along(-72.8, -157.6, -72.8, -151.2, GAL, 1, 0);
  along(-72.8, -151.2, -31.2, -151.2, GAL, 0, -1);
  along(-35.0, -159.6, -31.2, -159.6, GAL, 0, -1); along(-72.8, -159.6, -70.6, -159.6, GAL, 0, -1);
  // the mid deck's south edge (beside the cage) and its east / west edges
  along(-72.8, -166.0, -55.0, -166.0, MID, 0, -1); along(-49.0, -166.0, -31.2, -166.0, MID, 0, -1);
  along(-31.2, -166.0, -31.2, -148.4, MID, 1, 0); along(-72.8, -166.0, -72.8, -148.4, MID, -1, 0);
}

// ───────────────────────────────────────────────────────────── the well

/**
 * The coaming (0.4 m yellow plate, top −19.2, the inner lining down into the water) and its 1.6 m bar guard flush with
 * the outer face (vertical bars @ 0.11, no mid-rail), split at W7's ladder gates; hazard band, capping, stencils; a
 * hatched keep-clear band on the dock round it and an amber strip at the guard's foot.
 */
function coaming6(L: LevelBuild, b: Builder) {
  const Y = tmat6(L, 'crane_yellow'), H: Mat = 'hazard_stripes';
  const { x0, x1, z0, z1, top, t } = CM, dep = 0.6, y = DOCK;
  b.bx(Y, x0, y, z0, x1, top, z0 + t).bx(Y, x0, y, z1 - t, x1, top, z1);
  b.bx(Y, x0, y, z0 + t, x0 + t, top, z1 - t).bx(Y, x1 - t, y, z0 + t, x1, top, z1 - t);
  // the lining down into the water: plates 25 mm in front of the well's walls (no face on the grid's)
  const li = 0.025, ix0 = x0 + t, ix1 = x1 - t, iz0 = z0 + t, iz1 = z1 - t;
  b.bx(Y, ix0, y - dep, iz0, ix1, y - 0.004, iz0 + li).bx(Y, ix0, y - dep, iz1 - li, ix1, y - 0.004, iz1);
  b.bx(Y, ix0, y - dep, iz0 + li, ix0 + li, y - 0.004, iz1 - li).bx(Y, ix1 - li, y - dep, iz0 + li, ix1, y - 0.004, iz1 - li);
  b.detail(() => {
    // hazard band on the outer faces (the south face is the wet dock's kerb: band above its water)
    const band = (cx: number, cz: number, w: number, face: '+x' | '-x' | '+z' | '-z') => b.quad(H, cx, y + 0.42, cz, w, 0.28, face, 0, 'box', 0.006);
    band((x0 + x1) / 2, z0, x1 - x0, '-z'); band((x0 + x1) / 2, z1, x1 - x0, '+z'); band(x0, (z0 + z1) / 2, z1 - z0, '-x'); band(x1, (z0 + z1) / 2, z1 - z0, '+x');
    // inner stiffeners down the lining
    for (let x = x0 + 1.0; x < x1 - 0.5; x += 1.5) { b.bx(Y, x - 0.012, y - dep, z0 + t + 0.025, x + 0.012, top - 0.05, z0 + t + 0.1); b.bx(Y, x - 0.012, y - dep, z1 - t - 0.1, x + 0.012, top - 0.05, z1 - t - 0.025); }
  });
  // capping bar (behind the guard: the guard stands on the outer 8 cm, the cap on the rest)
  b.bx(Y, x0 + 0.09, top, z0 + 0.09, x1 - 0.09, top + 0.025, z0 + t + 0.012).bx(Y, x0 + 0.09, top, z1 - t - 0.012, x1 - 0.09, top + 0.025, z1 - 0.09);
  b.bx(Y, x0 + 0.09, top, z0 + t + 0.012, x0 + t + 0.012, top + 0.025, z1 - t - 0.012).bx(Y, x1 - t - 0.012, top, z0 + t + 0.012, x1 - 0.09, top + 0.025, z1 - t - 0.012);
  for (const [f, cx, cz] of [['-z', (x0 + x1) / 2, z0], ['+z', -55.0, z1], ['+z', -49.0, z1], ['-x', x0, -179.5], ['-x', x0, -172.5], ['+x', x1, -179.5], ['+x', x1, -172.5]] as const) {
    stencil6(b, '출입 금지 — 웨트웰', cx, y + 0.7, cz, 1.6, 0.14, f, { style: 'danger' });
  }
  // the guard: bars on the outer line (outer bar face on the coaming's outer plane), gaps at the ladder gates
  const gh = CM.guardTop - top, gy = top, inset = 0.04;
  const side = (pts: [number, number][]) => barGuard(b, L, { pts, y: gy, h: gh, collide: false });
  side([[x0, z0 + inset], [x1, z0 + inset]]);
  side([[x0, z1 - inset], [x1, z1 - inset]]);
  for (const x of [x0 + inset, x1 - inset]) {
    side([[x, z0 + inset], [x, GATE_Z - GATE_HALF]]);
    side([[x, GATE_Z + GATE_HALF], [x, z1 - inset]]);
  }
  // the keep-clear band on the dock (N, W, E sides; the south side is the wet dock) and the amber strip at the guard's foot
  const K = L.overlay('hazard_stripes');
  b.detail(() => {
    b.quad(K, (x0 + x1) / 2, y, z1 + 0.45, x1 - x0 + 1.4, 0.6, '+y', 0, 'box', 0.003);
    b.quad(K, x0 - 0.45, y, (z0 + z1 + 0.15) / 2, 0.6, z1 - z0 + 0.15, '+y', 0, 'box', 0.003);
    b.quad(K, x1 + 0.45, y, (z0 + z1 + 0.15) / 2, 0.6, z1 - z0 + 0.15, '+y', 0, 'box', 0.003);
  });
  strip6(b, L, x0 - 0.1, z1 + 0.12, x1 + 0.1, z1 + 0.12, { y, ch: 'amber' });
  for (const x of [x0 - 0.12, x1 + 0.12]) {
    strip6(b, L, x, z0 + 0.1, x, GATE_Z - 0.8, { y, ch: 'amber' });
    strip6(b, L, x, GATE_Z + 0.8, x, z1 + 0.05, { y, ch: 'amber' });
  }
}

// ───────────────────────────────────────────────────────────── the wet dock

function wetDock(L: LevelBuild, b: Builder, wetPlate: Mat) {
  const K: Mat = tint6(L, 'kerb', 'navy_grey', 0x343d44, { roughness: 0.4 });
  // kerb facings (12 mm off the recess walls): north kerb (beside the coaming) and south kerb (the window walk)
  b.bx(K, CM.x0, CHANNEL, WD.z1 - 0.025, CM.x1, WET + 0.18, WD.z1 - 0.004);   // the channel's north face under the coaming's lining
  for (const [a, c] of [[WD.x0, CM.x0], [CM.x1, WD.x1]] as const) b.bx(K, a, CHANNEL, WD.z1 - 0.025, c, DOCK - 0.004, WD.z1 - 0.004);
  b.bx(K, WD.x0, WET, WD.z0 + 0.004, WD.x1, DOCK - 0.004, WD.z0 + 0.025);
  b.bx(K, -62.37, CHANNEL, -185.5, -62.35, WET - 0.004, WD.z1 - 0.025).bx(K, -41.65, CHANNEL, -185.5, -41.63, WET - 0.004, WD.z1 - 0.025);
  // the wet floor itself: wet plate over the grid's floor (8 mm up) and faded hazard paint along the channel's edge
  b.detail(() => {
    b.bx(wetPlate, -62.4, WET + 0.005, WD.z0 + 0.025, -41.6, WET + 0.02, -185.5);
    b.bx(wetPlate, -62.37, CHANNEL + 0.005, -184.0, -41.63, CHANNEL + 0.02, WD.z1 - 0.025);
    b.quad(L.overlay('hazard_stripes'), -52, WET + 0.02, -185.85, 20.4, 0.5, '+y', 0, 'box', 0.003);
  });
  // amber kerb strips on the dry side: north (beside the coaming) and the window walk's edge
  for (const [a, c] of [[WD.x0 + 0.1, CM.x0 - 0.3], [CM.x1 + 0.3, WD.x1 - 0.1]] as const) strip6(b, L, a, WD.z1 + 0.14, c, WD.z1 + 0.14, { y: DOCK, ch: 'amber' });
  strip6(b, L, WD.x0 + 0.1, WD.z0 - 0.14, WD.x1 - 0.1, WD.z0 - 0.14, { y: DOCK, ch: 'amber' });
  // the ramps' outer edges (where the dry dock meets them)
  for (const x of [WD.x0 - 0.14, WD.x1 + 0.14]) strip6(b, L, x, WD.z0 + 0.1, x, WD.z1 - 0.1, { y: DOCK, ch: 'amber' });
}

// ───────────────────────────────────────────────────────────── sea windows

function windows(L: LevelBuild, b: Builder, dark: Mat) {
  const F: Mat = 'gunmetal';
  const { x0, x1, y0, y1, wall } = WIN, face = WZ0;
  // reveal liners (the slot through the 0.6 m wall), 10 mm inside the opening
  b.bx(F, x0, y0 - 0.02, wall, x1, y0 + 0.02, face - 0.004).bx(F, x0, y1 - 0.02, wall, x1, y1 + 0.02, face - 0.004);
  b.bx(F, x0 - 0.02, y0, wall, x0 + 0.02, y1, face - 0.004).bx(F, x1 - 0.02, y0, wall, x1 + 0.02, y1, face - 0.004);
  // the heavy frame on the wall face (0.45 m), bolt rows, a sill shelf
  const fz0 = face, fz1 = face + 0.12;
  b.bx(F, x0 - 0.45, y1, fz0, x1 + 0.45, y1 + 0.45, fz1).bx(F, x0 - 0.45, y0 - 0.45, fz0, x1 + 0.45, y0, fz1);
  b.bx(F, x0 - 0.45, y0, fz0, x0, y1, fz1).bx(F, x1, y0, fz0, x1 + 0.45, y1, fz1);
  b.detail(() => {
    for (let x = x0 - 0.25; x <= x1 + 0.26; x += 0.5) { b.cyl('steel_raw', x, y1 + 0.22, fz1 + 0.01, 0.025, 0.02, 'z', 6); b.cyl('steel_raw', x, y0 - 0.22, fz1 + 0.01, 0.025, 0.02, 'z', 6); }
    for (let y = y0 + 0.2; y < y1; y += 0.5) for (const x of [x0 - 0.22, x1 + 0.22]) b.cyl('steel_raw', x, y, fz1 + 0.01, 0.025, 0.02, 'z', 6);
  });
  // mullions (0.34 × the wall + 0.12 proud) over the shell's 0.3 m ones
  for (const x of [-56, -48]) b.bx(F, x - 0.17, y0, wall - 0.01, x + 0.17, y1, fz1);
  // an amber marker line along the frame's sill (hard-wired: the window walk reads in the dark)
  b.detail(() => b.bx(stripMat6(L, 'amber'), x0 - 0.3, y0 - 0.3, fz1, x1 + 0.3, y0 - 0.26, fz1 + 0.02));
  stencil6(b, '관찰창 — 2,140 M — 충격 금지', -52, y1 + 0.22, fz1 + 0.002, 3.2, 0.2, '+z', { style: 'stencil' });
  void dark;
}

// ───────────────────────────────────────────────────────────── the festoon, fixtures, lamps

/** The bridge's festoon: along the west wall over the runway, anchored at the north end; its last trolley rides the
 *  bridge's clamp arm on the west end truck's north end (W3a's rig: bridge z + 1.7, y ≈ −2.0). */
const FEST = { anchor: -148.7, y: -1.55, len: 43 } as const;
function festoon6(L: LevelBuild, b: Builder) {
  let f!: ReturnType<typeof festoon>;
  // (0.36 m off the wall: in front of the hull frames' flanges)
  b.at(WX0 + 0.36, FEST.y, FEST.anchor, PI / 2, () => { f = festoon(b, L, { len: FEST.len, n: 10, name: 'festoon6', span: 2.5 }); });
  return f;
}

/** 14 high-bay fixtures under the roof girders (x −62 / −42 on every girder); one shared lens bound to HB1. */
function fixtures(L: LevelBuild, b: Builder, bind: LightHandle | undefined, steel: Mat, dark: Mat) {
  const lens = mat(L, 'hb_lens', () => { const m = lampLens6(L, 'cold', 1.6).clone(); return m; });
  bind?.bindEmissive(lens, 1.6);
  for (const z of GIRDERS_Z) for (const x of HB_X) {
    b.rod(steel, x, ROOF - 1.3, z, x, -0.05, z, 0.02, 6);
    b.cyl(dark, x, -0.12, z, 0.16, 0.22, 'y', 12);
    b.cyl(dark, x, -0.36, z, 0.42, 0.26, 'y', 16, 0.18);
    b.detail(() => b.cyl(lens, x, -0.5, z, 0.38, 0.02, 'y', 16));
  }
}

/** A wall lamp (bulkhead with a cage) bound to `h`. `ry` = the wall's facing (0: +z, π: −z, ±π/2: ±x). */
function wallLamp(L: LevelBuild, b: Builder, x: number, y: number, z: number, ry: number, color: 'red' | 'amber' | 'warm', h: LightHandle | undefined) {
  const lens = mat(L, `wl_${color}_${x}_${z}`, () => lampLens6(L, color, 1.4).clone());
  h?.bindEmissive(lens, 1.4);
  b.at(x, y, z, ry, () => {
    b.bx('painted_dark', -0.18, -0.12, 0, 0.18, 0.12, 0.08);
    b.detail(() => {
      b.cyl(lens, 0, 0, 0.12, 0.09, 0.08, 'z', 12);
      for (const dx of [-0.06, 0, 0.06]) b.bx('steel_raw', dx - 0.006, -0.1, 0.16, dx + 0.006, 0.1, 0.172);
    });
  });
}

/** The undercroft's caged bulkhead under the mid deck, bound to its point. */
function ceilingLamp(L: LevelBuild, b: Builder, x: number, y: number, z: number, h: LightHandle | undefined) {
  const lens = mat(L, 'uc_lens', () => lampLens6(L, 'warm', 1.2).clone());
  h?.bindEmissive(lens, 1.2);
  b.bx('painted_dark', x - 0.3, y - 0.1, z - 0.15, x + 0.3, y, z + 0.15);
  b.detail(() => {
    b.bx(lens, x - 0.25, y - 0.18, z - 0.1, x + 0.25, y - 0.1, z + 0.1);
    for (const dx of [-0.2, 0, 0.2]) b.bx('steel_raw', x + dx - 0.006, y - 0.22, z - 0.12, x + dx + 0.006, y - 0.1, z + 0.12);
  });
}

// ───────────────────────────────────────────────────────────── export

/** The shell faces' look; the tinted materials are filled in by `build` (it runs before the grid is built). */
const LOOK: { floor: Mat; wall: Mat; ceiling: Mat } = { floor: 'dock_steel', wall: 'hull_white', ceiling: 'navy_grey' };

/**
 * pool6's dressing entry (D3a): `build` (structure + lights + fx + vignettes), `lights: []` (placed by `build`, groups as
 * §2.7.1), `look` (shell faces: dock plate floor, hull white walls, dark roof). The shell's big greybox label is dropped
 * by box (`label: false` would also drop W7's signs, which the shell builder draws).
 */
export const POOL_DRESS: Partial<Record<RoomId6, RoomDress>> = {
  pool6: {
    build: buildPool,
    lights: [],
    look: LOOK,
  },
};
