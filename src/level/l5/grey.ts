/**
 * POST 4 — level 5 greybox shell (stage 3c, docs/plans/stage-3c.md §2; task W4).
 *
 * Built on level 3's shell kernel (`GreyGrid`, `buildStair`, `block`, `roomLabel`, `flatMat` from ../l3/grey), as
 * level 4:
 *  - `ROOMS5`: every room's plan box, floor, height and extra floors (§2.1 — the crawlway and the magazine are floors
 *    BELOW the spine / armoury, `nav: false`, with their `exits`; the sub-bay galleries are floors at y 4.8).
 *  - `SHELLS5`: one function per room: carves its air (+ the crawl, the pit, the magazine, voids, glazing slots, the
 *    openings of the sealed props), puts back the structure that is not grid (grating, gallery decks, rails, parapets,
 *    the four stairs, the hatch pit, glass panes), the plan-dimensioned stand-in blocks (WITH colliders — every cover
 *    object of §5.4 is one), its wayfinding label, every named SCREEN of §6.4, every INTERACTABLE of §6.3 / §8.5 / §8.6,
 *    every MARKER of §8.10.
 *  - `LIGHTS5`: placeholder light tables per §2.7.1 (groups and `_emerg` groups exactly as named there), each row
 *    bounded to its room AND floor (S5: spine / armoury y ≥ 0, crawl to the crawl, `mag5` y ≤ −0.1).
 *  - `hatchLid()`: the two hatch lids as working parts (dynamic boxes, walkable when shut, registered movers).
 *  - `placeholders5()`: greybox stand-ins for what other tasks own (every vignette of §8.7 with its `:snap`, the
 *    machines `tern` / `wheel5`, the object `tern`) — registered only when nobody registered the id first.
 *
 * Dressing never edits the shell, the colliders, the doors, the triggers, the phases, the screens / interactables /
 * markers created here; it may restyle or hide stand-in visuals (material `grey_standin`, l3/kit3.ts `restyle` /
 * `isStandin`) and must then keep ONE collider per object (kit props with `collide: false` over a kept stand-in collider,
 * or replace both). See the header of each dressing file (fore.ts, spine.ts, quarters.ts, bay.ts).
 */
import * as THREE from 'three';
import type { FlickerMode, GameContext, Interactable, Quality, Surface } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { sealedDoor } from '../kit';
import { GreyGrid, HW, block, buildStair, roomLabel, stairLine, type Box6, type RoomId3, type StairDef } from '../l3/grey';

const PI = Math.PI;
/** Sub-bay gallery deck. */
export const GAL = 4.8;
export { HW };

// ───────────────────────────────────────────────────────────── rooms (§2.1)

export type RoomId5 =
  | 'lock5' | 'gate5' | 'duty5' | 'ready5' | 'spine5' | 'berths5' | 'heads5' | 'mess5' | 'galley5' | 'arm5' | 'sub5'
  | 'dive5' | 'lockacc5' | 'tunnel5';

type XYZ = [number, number, number];
export interface FloorDef5 { y: number; box: [number, number, number, number]; nav?: false; exits?: XYZ[] }
export interface RoomDef5 { name: string; x0: number; x1: number; z0: number; z1: number; y0: number; h: number; floors?: FloorDef5[] }

/** §8.4: the standing points at the top of each way out of the crawl / magazine (`mk5_exit_*`). */
export const EXIT_SPINE: XYZ = [37.9, 0, -14.8];
/** Listed by `level.floorAt` only while the magazine hatch is open (index.ts filters it on `hatch5_mag`'s `userData.k`). */
export const EXIT_MAG: XYZ = [21.0, 0, -24.0];
const EXITS: XYZ[] = [EXIT_SPINE, EXIT_MAG];

/**
 * §2.1 table. Correction (W4): the armoury's first crawl floor runs to z −21.4 (plan −20.0) so that it also covers
 * `STAIR5_MAG_IN`'s footprint (z −21.4 … −20.0) — otherwise `level.floorAt` returns the armoury's main floor (nav
 * true) for a player on those steps.
 */
export const ROOMS5: Record<RoomId5, RoomDef5> = {
  lock5: { name: '초소 4 — 게이트 록', x0: -3, x1: 3, z0: 0, z1: 6, y0: 0, h: 3.6 },
  gate5: { name: '초소 4 — 게이트하우스', x0: -6, x1: 6, z0: -10, z1: 0, y0: 0, h: 3.4 },
  duty5: { name: '당직실', x0: -8, x1: 8, z0: -22, z1: -10, y0: 0, h: 3.4 },
  ready5: { name: '대기실', x0: -12, x1: 4, z0: -38, z1: -22, y0: 0, h: 3.4 },
  spine5: {
    name: '스파인', x0: 8, x1: 44, z0: -18, z1: -14, y0: 0, h: 3.2,
    floors: [
      { y: -1.4, box: [16.4, 36.2, -16.6, -15.4], nav: false, exits: EXITS },
      { y: -1.4, box: [36.2, 38.6, -17.6, -15.4], nav: false, exits: EXITS },
      { y: -1.4, box: [16.4, 17.6, -18.0, -16.6], nav: false, exits: EXITS },
    ],
  },
  berths5: { name: '침실구역 — 1', x0: 12, x1: 24, z0: -14, z1: -2, y0: 0, h: 3.0 },
  heads5: { name: 'WASHROOM', x0: 12, x1: 20, z0: -2, z1: 4, y0: 0, h: 2.8 },
  mess5: { name: '식당', x0: 24, x1: 38, z0: -14, z1: -2, y0: 0, h: 3.2 },
  galley5: { name: '갤리', x0: 28, x1: 38, z0: -2, z1: 4, y0: 0, h: 3.0 },
  arm5: {
    name: '무기고', x0: 14, x1: 22, z0: -28, z1: -18, y0: 0, h: 3.2,
    floors: [
      { y: -1.4, box: [16.4, 17.6, -21.4, -18.0], nav: false, exits: EXITS },
      { y: -2.6, box: [14.2, 21.8, -27.8, -21.4], nav: false, exits: EXITS },
    ],
  },
  sub5: {
    name: '서브베이', x0: 22, x1: 46, z0: -56, z1: -18, y0: 0, h: 12.0,
    floors: [
      { y: GAL, box: [22.2, 25.0, -55.8, -18.2] },
      { y: GAL, box: [43.0, 45.8, -55.8, -18.2] },
      { y: GAL, box: [25.0, 43.0, -21.0, -18.2] },
      { y: GAL, box: [25.0, 43.0, -36.0, -34.0] },
    ],
  },
  dive5: { name: '잠수 장비함', x0: 46, x1: 52, z0: -40, z1: -28, y0: 0, h: 3.2 },
  lockacc5: { name: '발사 록 — 출입', x0: 38, x1: 46, z0: -62, z1: -56, y0: 0, h: 3.2 },
  tunnel5: { name: '트렁크 터널 — 입구', x0: 14, x1: 22, z0: -56, z1: -50, y0: 0, h: 3.0 },
};
export const ROOM_IDS5 = Object.keys(ROOMS5) as RoomId5[];

/** Air (interior clear space) of a room: its box inset by half a wall, floor … floor + h. */
export function airOf5(id: RoomId5): Box6 {
  const r = ROOMS5[id];
  return [r.x0 + HW, r.y0, r.z0 + HW, r.x1 - HW, r.y0 + r.h, r.z1 - HW];
}

/** Grid envelope (§2.1). */
export const ENVELOPE5: Box6 = [-14, -3.2, -66, 54, 12.5, 8];

/** §2.1 non-room spaces (regions; the voids are carved air). */
export const VOIDS5 = {
  vent5_spine: [29.6, 3.2, -16.4, 30.4, 4.0, -15.6] as Box6,
  drain5_a: [27.5, -1.0, -48.5, 28.5, 0, -47.5] as Box6,
  drain5_b: [38.5, -1.0, -37.0, 39.5, 0, -36.0] as Box6,
};
export const CMD5: Box6 = [44, 0, -18, 52, 3.2, -8];
export const OUTSIDE5: Box6 = [30, -1, -64, 38, 6, -56.4];
export const BOOTH5: Box6 = [2.4, 0, -4.0, 5.8, 2.6, -0.2];
/** The walk-in cold room behind the galley's frosted window (never entered; sealed by the pane). */
export const COLDROOM5: Box6 = [38.2, 0, -0.2, 39.4, 2.2, 2.2];
/** §2.1 `crawl` (the spine floor boxes, y −1.4 … −0.05) and `magazine` (the armoury floor boxes, y −2.6 … −0.1). */
export const CRAWL5: Box6[] = [[16.4, -1.5, -16.6, 36.2, -0.05, -15.4], [36.2, -1.5, -17.6, 38.6, -0.05, -15.4], [16.4, -1.5, -18.0, 17.6, -0.05, -16.6]];
export const MAG5: Box6[] = [[16.4, -1.5, -21.4, 17.6, -0.05, -18.0], [14.2, -2.7, -27.8, 21.8, -0.1, -21.4]];
/** Crouch-only part of the crawl (under the grating / the spine and armoury floors — not the pit, not the stairs). */
export const CRAWL_LOW5: Box6[] = [[16.4, -1.5, -16.6, 36.15, -0.05, -15.4], [16.4, -1.5, -18.0, 17.6, -0.05, -16.6], [16.4, -1.5, -20.0, 17.6, -0.05, -18.0]];
/** The walkway beside the pit (§2.6; S1n: no enemy stands in it). */
export const WALKWAY5: Box6 = [36.2, 0, -15.4, 38.6, 3.2, -14.2];
/** The hatch pit and the magazine hatch (nav obstacles from load, S1m). */
export const PIT5: Box6 = [36.2, -1.4, -17.6, 38.6, 1.0, -15.4];
export const MAGHATCH5: Box6 = [20.4, -2.6, -27.0, 21.6, 1.0, -24.3];

/**
 * `level.regions.wet` (audio: the `wet` footstep variant on puddle patches; a box counts when the feet are within
 * ±0.5 m of its y range). Dressing files add their puddle boxes here during their `build(L)` — the same boxes they
 * give `fx.wetPatch` — with `addWet(L, [x0, y0, z0, x1, y1, z1])`; index.ts publishes the list as `regions.wet`.
 * Empty in the greybox.
 */
const WET = new WeakMap<LevelBuild, THREE.Box3[]>();
export function addWet(L: LevelBuild, b: Box6): void {
  let list = WET.get(L);
  if (!list) WET.set(L, (list = []));
  list.push(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])));
}
export function wetOf(L: LevelBuild): THREE.Box3[] { return WET.get(L) ?? []; }

// ───────────────────────────────────────────────────────────── stairs (§2.6)

export const STAIR5_W: StairDef = { room: 'sub5' as RoomId3, x0: 25.4, x1: 27.4, z0: -45, dir: 1, risers: 16, rise: 0.3, tread: 0.5625 };
export const STAIR5_E: StairDef = { room: 'sub5' as RoomId3, x0: 40.6, x1: 42.6, z0: -25, dir: -1, risers: 16, rise: 0.3, tread: 0.5625 };
export const STAIR5_HATCH: StairDef = { room: 'spine5' as RoomId3, x0: 37.4, x1: 38.6, z0: -17.6, dir: 1, risers: 5, rise: 0.28, tread: 0.42, y0: -1.4, nav: false };
export const STAIR5_MAG_IN: StairDef = { room: 'arm5' as RoomId3, x0: 16.4, x1: 17.6, z0: -21.4, dir: 1, risers: 4, rise: 0.3, tread: 0.35, y0: -2.6, nav: false };
export const STAIR5_MAG_OUT: StairDef = { room: 'arm5' as RoomId3, x0: 20.4, x1: 21.6, z0: -27.0, dir: 1, risers: 9, rise: 0.2889, tread: 0.3, y0: -2.6, nav: false };
export { stairLine };

// ───────────────────────────────────────────────────────────── glass (markers the story reads)

/** `mk5_glass.userData.panes` (§8.10): booth glass, the command-module port, the launch-lock port — world boxes. */
export const PANES5: { id: 'booth' | 'port' | 'lock_port' | 'cold'; box: Box6 }[] = [
  { id: 'booth', box: [2.485, 1.0, -4.0, 2.515, 2.4, -0.2] },
  { id: 'port', box: [43.83, 1.495, -16.125, 43.86, 1.745, -15.875] },
  { id: 'lock_port', box: [33.7, 1.9, -55.915, 34.3, 2.5, -55.885] },
  { id: 'cold', box: [37.765, 1.0, 0.0, 37.795, 2.0, 2.0] },
];

// ───────────────────────────────────────────────────────────── lights (§2.7.1) — placeholder tables

/** A placeholder light row (l3 `LightRow` + explicit world `bounds` and a flicker mode). */
export interface LightRow5 {
  group: string; type: 'point' | 'spot'; p: XYZ; t?: XYZ; color: number; i: number; d: number; angle?: number;
  cast?: boolean; min?: Quality; prio?: number; off?: boolean; flicker?: FlickerMode;
  /** World box the light is confined to (S5: by floor). Absent = the room it sits in (unbounded in y). */
  bounds?: Box6;
}
const WARM = 0xffe2c0, RED = 0xff2a18, AMBER = 0xffa020, COOL = 0xdce8ff;
/** Room box ± 0.1, y limited (S5: a room's lights by floor). */
const rb = (id: RoomId5, y0: number, y1: number): Box6 => { const r = ROOMS5[id]; return [r.x0 - 0.1, y0, r.z0 - 0.1, r.x1 + 0.1, y1, r.z1 + 0.1]; };
const SPINE_B = rb('spine5', -0.02, 3.4), ARM_B = rb('arm5', -0.02, 3.4);
const CRAWL_B: Box6 = [16.3, -1.5, -18.1, 38.7, -0.04, -15.3];
const MAG_B: Box6 = [14.1, -2.7, -27.9, 21.9, -0.1, -20.0];

export const LIGHTS5: Record<RoomId5, LightRow5[]> = {
  lock5: [
    { group: 'lock5', type: 'spot', p: [0, 3.45, 3.6], t: [0, 0, 2.0], color: WARM, i: 16, d: 7, angle: 1.1, cast: true, min: 'medium' },
    { group: 'lock5', type: 'point', p: [0, 3.3, 3.0], color: WARM, i: 9, d: 8 },
  ],
  gate5: [
    { group: 'gate5', type: 'point', p: [-2.5, 3.2, -3.0], color: WARM, i: 10, d: 10 },
    { group: 'gate5', type: 'point', p: [0, 3.2, -7.5], color: WARM, i: 10, d: 10 },
    { group: 'gate5', type: 'point', p: [4.2, 2.45, -2.0], color: WARM, i: 4, d: 4, min: 'medium' },
  ],
  duty5: [
    { group: 'duty5', type: 'point', p: [-3.5, 3.2, -14.5], color: WARM, i: 10, d: 10 },
    { group: 'duty5', type: 'point', p: [3.5, 3.2, -18.5], color: WARM, i: 10, d: 10 },
    { group: 'duty5', type: 'spot', p: [-1.5, 2.0, -15.4], t: [-1.5, 1.0, -15.6], color: 0xfff0d8, i: 6, d: 4, angle: 1.0, cast: true, prio: 0.8, min: 'medium' },
  ],
  ready5: [
    { group: 'ready5', type: 'point', p: [-4.0, 3.2, -27.0], color: WARM, i: 10, d: 11 },
    { group: 'ready5', type: 'point', p: [-2.0, 3.2, -34.5], color: WARM, i: 10, d: 11 },
    { group: 'ready5', type: 'point', p: [-9.5, 3.2, -32.0], color: WARM, i: 6, d: 8, min: 'medium' },
  ],
  spine5: [
    { group: 'spine5', type: 'point', p: [13, 3.0, -16], color: WARM, i: 9, d: 10, bounds: SPINE_B },
    { group: 'spine5', type: 'point', p: [25, 3.0, -16], color: WARM, i: 9, d: 10, bounds: SPINE_B },
    { group: 'spine5', type: 'point', p: [37, 3.0, -16], color: WARM, i: 9, d: 10, bounds: SPINE_B },
    // the grating lamp (casts bars into the crawl, medium+)
    { group: 'spine5', type: 'spot', p: [28, 3.05, -16], t: [28, -1.4, -16], color: WARM, i: 10, d: 6, angle: 0.8, cast: true, prio: 0.6, min: 'medium', bounds: [8, -1.5, -18.1, 44, 3.4, -13.9] },
    { group: 'spine5_emerg', type: 'point', p: [16, 2.9, -16], color: RED, i: 3, d: 10, off: true, bounds: SPINE_B },
    { group: 'spine5_emerg', type: 'point', p: [34, 2.9, -16], color: RED, i: 3, d: 10, off: true, bounds: SPINE_B },
    { group: 'crawl5', type: 'point', p: [22, -0.4, -16], color: RED, i: 2.5, d: 7, bounds: CRAWL_B },
    { group: 'crawl5', type: 'point', p: [32, -0.4, -16], color: RED, i: 2.5, d: 7, bounds: CRAWL_B },
  ],
  berths5: [
    { group: 'berths5', type: 'point', p: [18, 2.7, -11], color: RED, i: 3.5, d: 9 },
    { group: 'berths5', type: 'point', p: [18, 2.7, -5], color: RED, i: 3.5, d: 9 },
    { group: 'berths5', type: 'point', p: [14.0, 1.8, -7.0], color: 0xffd8a0, i: 2.5, d: 4, min: 'medium' },
  ],
  heads5: [{ group: 'heads5', type: 'point', p: [16, 2.6, 1], color: COOL, i: 9, d: 8 }],
  mess5: [
    { group: 'mess5', type: 'point', p: [28, 3.0, -8], color: WARM, i: 10, d: 10 },
    { group: 'mess5', type: 'point', p: [34, 3.0, -8], color: WARM, i: 10, d: 10 },
    { group: 'mess5', type: 'point', p: [31, 3.0, -3.5], color: WARM, i: 6, d: 7, min: 'medium' },
  ],
  galley5: [
    { group: 'galley5', type: 'point', p: [33, 2.8, 1], color: WARM, i: 10, d: 9 },
    { group: 'galley5', type: 'point', p: [38.8, 1.8, 1.0], color: 0xcfe4ff, i: 3, d: 3, min: 'medium', bounds: [37.7, 0, -0.3, 39.5, 2.3, 2.3] },
  ],
  arm5: [
    { group: 'arm5', type: 'point', p: [18, 3.0, -23], color: WARM, i: 10, d: 10, bounds: ARM_B },
    { group: 'arm5', type: 'spot', p: [16.5, 3.0, -21.0], t: [14.6, 1.0, -22.5], color: 0xfff0d8, i: 8, d: 6, angle: 0.9, cast: true, prio: 0.7, min: 'medium', bounds: ARM_B },
    { group: 'mag5', type: 'point', p: [17.0, -0.45, -24.5], color: 0xffd0a0, i: 3.5, d: 8, bounds: MAG_B },
  ],
  sub5: [
    { group: 'sub5', type: 'spot', p: [34, 11.6, -26], t: [34, 2.5, -33], color: COOL, i: 60, d: 18, angle: 0.7, cast: true, prio: 0.8, min: 'medium' },
    { group: 'sub5', type: 'spot', p: [34, 11.6, -44], t: [34, 4.8, -35], color: COOL, i: 60, d: 18, angle: 0.7, cast: true, prio: 0.8, min: 'medium' },
    { group: 'sub5', type: 'point', p: [23.8, 8.0, -19.8], color: WARM, i: 22, d: 16 },
    { group: 'sub5', type: 'point', p: [44.2, 8.0, -19.8], color: WARM, i: 22, d: 16 },
    { group: 'sub5', type: 'point', p: [23.8, 8.0, -54], color: WARM, i: 16, d: 14, min: 'medium' },
    { group: 'sub5', type: 'point', p: [44.2, 8.0, -54], color: WARM, i: 16, d: 14, min: 'medium' },
    { group: 'sub5', type: 'point', p: [34, 4.0, -31.2], color: 0xffd8a0, i: 3, d: 4, min: 'medium' },
    { group: 'sub5_emerg', type: 'point', p: [34, 9, -18.6], color: AMBER, i: 14, d: 22, off: true, flicker: 'alarm' },
    { group: 'sub5_emerg', type: 'point', p: [34, 9, -55.4], color: AMBER, i: 14, d: 22, off: true, flicker: 'alarm' },
    { group: 'sub5_emerg', type: 'point', p: [22.8, 3.0, -53], color: RED, i: 4, d: 9, off: true },
  ],
  dive5: [{ group: 'dive5', type: 'point', p: [49, 3.0, -33], color: RED, i: 3.5, d: 9 }],
  lockacc5: [{ group: 'lockacc5', type: 'point', p: [42, 3.0, -59], color: WARM, i: 8, d: 8 }],
  tunnel5: [{ group: 'tunnel5', type: 'point', p: [18, 2.8, -53], color: WARM, i: 9, d: 9 }],
};
/** §4.7 `lights_out5`: the groups that die (spine, sub bay mains) and the emergency groups that come on. */
export const LIGHTS_OUT5 = {
  off: ['spine5', 'sub5'], emerg: ['spine5_emerg', 'sub5_emerg'],
  /** The breaker thunk travels from the sub bay to the spine: origin (x, z), seconds per metre, dim time. */
  origin: [34, -45] as [number, number], perMetre: 0.025, dim: 1.2,
};

export function placeLights5(L: LevelBuild, rows: LightRow5[]) {
  return rows.map((r) => {
    const bounds = r.bounds ? new THREE.Box3(new THREE.Vector3(r.bounds[0], r.bounds[1], r.bounds[2]), new THREE.Vector3(r.bounds[3], r.bounds[4], r.bounds[5])) : undefined;
    const o = { cast: !!r.cast, priority: r.prio, enabled: !r.off, flicker: r.flicker, bounds };
    const h = r.type === 'spot'
      ? L.spot(r.group, r.p[0], r.p[1], r.p[2], r.t![0], r.t![1], r.t![2], r.color, r.i, r.d, r.angle ?? 0.9, o)
      : L.point(r.group, r.p[0], r.p[1], r.p[2], r.color, r.i, r.d, o);
    if (r.min) h.desc.minQuality = r.min;
    return h;
  });
}

// ───────────────────────────────────────────────────────────── helpers

export const box3 = (b: readonly number[]) => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));

/** Stand-in block (material `grey_standin`) with a collider: the plan-dimensioned obstacles the dressing dresses. */
function stand(b: Builder, m: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: Surface = 'metal') {
  block(b, m, x0, y0, z0, x1, y1, z1, surface, true);
}
/** Glass pane block (collider, surface glass). */
function pane(b: Builder, glass: Mat, bx: Box6) { block(b, glass, bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 'glass', true); }
/** A small shelf plate under a pickup (visual only). */
function shelf(b: Builder, m: Mat, x: number, y: number, z: number, w = 0.5, d = 0.35) { b.bx(m, x - w / 2, y - 0.06, z - d / 2, x + w / 2, y - 0.03, z + d / 2); }
/**
 * Guard rail (collider, `h` tall from `y`): two bars and posts. Rails are 1.0 / 1.1 m — NOT containment (a body can be
 * jumped over them, §9 #18).
 */
function rail(b: Builder, m: Mat, x0: number, z0: number, x1: number, z1: number, y: number, h: number) {
  const alongX = x1 - x0 > z1 - z0;
  b.bx(m, x0, y + h - 0.05, z0, x1, y + h, z1);
  b.bx(m, x0, y + h * 0.5 - 0.025, z0, x1, y + h * 0.5 + 0.025, z1);
  const len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.ceil(len / 1.4));
  for (let i = 0; i <= n; i++) {
    const u = (alongX ? x0 : z0) + (len * i) / n;
    if (alongX) b.bx(m, Math.min(x1 - 0.05, Math.max(x0, u - 0.025)), y, z0, Math.min(x1, Math.max(x0 + 0.05, u + 0.025)), y + h, z1);
    else b.bx(m, x0, y, Math.min(z1 - 0.05, Math.max(z0, u - 0.025)), x1, y + h, Math.min(z1, Math.max(z0 + 0.05, u + 0.025)));
  }
  b.collide(x0, y, z0, x1, y + h, z1, 'metal', true);
}
/** Carve the opening of a sealed prop through its wall (w × h, the wall's full thickness). */
function sealedOpening(G: GreyGrid, id: string, x: number, y: number, z: number, wall: 'x' | 'z', w: number, h: number, rooms: string[]) {
  const bx: Box6 = wall === 'z' ? [x - w / 2, y, z - HW, x + w / 2, y + h, z + HW] : [x - HW, y, z - w / 2, x + HW, y + h, z + w / 2];
  G.air(`door:${id}`, bx, { rooms, look: 'reveal' });
}

/**
 * A dynamic grille closing a void (vent in a ceiling, drain in a floor): mesh + physics box (walkable), `L.objects[id]`
 * with `userData.open(mode, silent?)` — 'drop' falls out of a ceiling, 'lift' rises out of a floor and lies beside the
 * opening — and `userData.isOpen()`. A registered mover (decals ride it). The vignettes that open it belong to the
 * dressing (§11); `placeholders5` registers greybox ones.
 */
function grillePanel(L: LevelBuild, id: string, x0: number, z0: number, x1: number, z1: number, yBottom: number, mat: Mat, sound: string, rooms: string[]) {
  // (built about the opening's centre: the 'drop' tilt turns about the grille itself, not the world origin — B5)
  // (the meshes keep world x / z and sit at (−cx, 0, −cz) in the group, so a dressing that already re-centred them the
  // same way — spine.ts sets each child to (−30, 0, 16) — stays right)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const part = L.part(`${id}:panel`);
  part.bx(mat, x0, 0, z0, x1, 0.06, z1);
  const g = part.build();
  for (const c of g.children) c.position.set(-cx, 0, -cz);
  g.position.set(cx, yBottom, cz);
  g.name = id;
  g.userData.rooms = rooms;
  L.root.add(g);
  L.objects.set(id, g);
  L.ctx.physics.addMover?.(g);
  const pb = L.ctx.physics.addBox(box3([x0, yBottom, z0, x1, yBottom + 0.06, z1]), 'metal');
  pb.walkable = true;
  pb.owner = g;
  g.userData.box = pb;
  g.userData.isOpen = () => !pb.enabled;
  g.userData.open = (mode: 'drop' | 'lift' = 'drop', snap = false) => {
    if (!pb.enabled) return;
    pb.enabled = false;
    const end = (k: number) => {
      if (mode === 'drop') { g.position.y = yBottom - 2.9 * k * k; g.rotation.x = 0.5 * k; if (k >= 1) g.visible = false; }
      else { g.position.y = yBottom + 0.12 * Math.min(1, k * 3); g.position.x = cx + 1.3 * Math.max(0, k * 1.5 - 0.5); }
    };
    if (snap) { end(1); return; }
    L.sfx(sound, cx, yBottom, cz, 0.8);
    L.tween(0, mode === 'drop' ? 0.55 : 0.7, (k) => end(k));
  };
}

/**
 * §8.4: GREYBOX PLACEHOLDER of a hatch lid hinged on its south (−z) edge, with the API of W7's `hatchLid(L, b,
 * HATCH5_SPINE | HATCH5_MAG)` (setpieces.ts) — registered by `placeholders5` only when that set piece did not register
 * the id (`hatch5_spine` / `hatch5_mag`), so there is never a second lid or collider. Shut = a slab flush with the
 * floor (y −0.08 … 0, walkable dynamic box), open = standing up at the hinge (z0 − 0.08 … z0). `L.objects[id].userData`:
 * `open(k)` (0 shut … 1 open, instant), `k`, `box`, `dogs(k)` / `lamp(s)` (no-ops), `underside`. A registered mover.
 */
export function hatchLid(L: LevelBuild, id: string, x0: number, x1: number, zHinge: number, length: number, mat: Mat, rooms: string[]) {
  const T = 0.08;
  const pivot = new THREE.Group();
  pivot.name = id;
  pivot.position.set((x0 + x1) / 2, -T + 0.008, zHinge); // (8 mm proud: the ship stair's top tread lies under the shut lid)
  pivot.userData.rooms = rooms;
  const part = L.part(`${id}:slab`);
  part.bx(mat, -(x1 - x0) / 2 + 0.006, 0, 0.006, (x1 - x0) / 2 - 0.006, T, length - 0.006); // (6 mm in from the opening's sides)
  part.bx(mat, -0.25, T, length * 0.5 - 0.25, 0.25, T + 0.04, length * 0.5 + 0.25); // (the wheel boss)
  pivot.add(part.build());
  L.root.add(pivot);
  L.objects.set(id, pivot);
  L.ctx.physics.addMover?.(pivot);
  const shutBox = box3([x0, -T, zHinge, x1, 0, zHinge + length]);
  const openBox = box3([x0, -T, zHinge - T, x1, length - T, zHinge]);
  const pb = L.ctx.physics.addBox(shutBox.clone(), 'metal');
  pb.walkable = true;
  pb.owner = pivot;
  const u = pivot.userData;
  u.placeholder = true;
  u.box = pb;
  u.k = 0;
  u.underside = new THREE.Vector3((x0 + x1) / 2, -T, zHinge + length / 2);
  u.open = (k: number) => {
    k = Math.min(1, Math.max(0, k));
    u.k = k;
    pivot.rotation.x = -(PI / 2) * k;
    pb.box.copy(k < 0.5 ? shutBox : openBox);
    pb.walkable = k < 0.5;
  };
  u.dogs = () => { /* greybox */ };
  u.lamp = () => { /* greybox */ };
  return pivot;
}
/** A hatch lid's openness 0 … 1 (W7's lid or the placeholder; 0 when neither exists). */
export function lidK(L: LevelBuild, id: string): number {
  const k = L.objects.get(id)?.userData.k;
  return typeof k === 'number' ? k : 0;
}

/**
 * R8 eye gate on an interactable (stage 3c §2.6 / §8.5): the interactable is enabled only while the player's eye
 * satisfies `test` — on top of whatever the story sets (`enabled` keeps the story's value; the getter ANDs the gate).
 * `gate` is also published on the interactable (`eyeGate`) so scripts/check-reach.mjs models it.
 */
export function eyeGate(ctx: GameContext, it: Interactable, gate: { axis: 'x' | 'y' | 'z'; min?: number; max?: number }, extra?: () => boolean) {
  let base = it.enabled;
  Object.defineProperty(it, 'enabled', {
    configurable: true,
    get: () => {
      if (!base) return false;
      if (extra && !extra()) return false;
      const e = ctx.player?.eye;
      if (!e) return true;
      const v = e[gate.axis];
      return (gate.min === undefined || v >= gate.min) && (gate.max === undefined || v < gate.max);
    },
    set: (v: boolean) => { base = v; },
  });
  (it as Interactable & { eyeGate?: unknown }).eyeGate = gate;
  return it;
}

// ───────────────────────────────────────────────────────────── shells (one per room)

export interface ShellCtx5 { L: LevelBuild; G: GreyGrid; b: Builder; standin: Mat; glass: Mat; dark: Mat; yellow: Mat; grate: Mat }
type Shell = (s: ShellCtx5) => void;
const air = (G: GreyGrid, id: RoomId5) => G.air(id, airOf5(id), { rooms: [id], look: id as RoomId3 });
const airIn = (G: GreyGrid, name: string, bx: Box6, rooms: RoomId5[], look: RoomId5) => G.air(name, bx, { rooms, look: look as RoomId3 });

export const SHELLS5: Record<RoomId5, Shell> = {
  lock5: ({ L, G, b }) => {
    air(G, 'lock5');
    // door5_tube (0, 0, 6): sealed, seen from the lock (D2: 3b's tube is behind it)
    sealedOpening(G, 'door5_tube', 0, 0, 6, 'z', 1.6, 2.4, ['lock5']);
    sealedDoor(L, b, {
      id: 'door5_tube', x: 0, y: 0, z: 6, wall: 'z', kind: 'std', sides: 'back', leafMat: 'navy_grey', labelBack: '이송 튜브',
      panel: { text: '이송 튜브 — 순환 중', side: 'back' },
    });
    roomLabel(b, '초소 4 — 게이트 록', -2.8, 2.5, 3.2, '+x', 3.0);
    // gate_panel5 (§6.4): one screen, two faces — the lock side (seen at arrival) and the gatehouse side (after the
    // latch, `mk5_gate_panel`, where `l5_unit_gate` is spoken)
    L.screen('gate_panel5', 'terminal_idle', 0.5, 0.3, -2.3, 1.6, 0.22, '+z', { text: '인가됨: 아스, L. (중위) — 손바닥 — 생존' });
    L.marker('mk5_start', 0, 0, 3.0, 0);
  },

  gate5: ({ L, G, b, standin, glass, dark }) => {
    air(G, 'gate5');
    // the gate panel's second face (the same material as `gate_panel5`, made in lock5's shell)
    const gpm = L.screens.get('gate_panel5');
    if (gpm) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), gpm);
      m.position.set(-2.3, 1.6, -0.22); m.rotation.y = PI; m.name = 'screen:gate_panel5:gatehouse';
      L.root.add(m);
    }
    L.marker('mk5_gate_panel', -2.3, 1.6, -0.22, PI);
    // ── the guard booth x 2.4 … 5.8, z −4.0 … −0.2: kerb 1.0, bullet-proof glass to 2.4 on its west face, roof 2.6 (solid
    // to the ceiling above it: nothing to stand on); south face solid; back door (east, into solid) is a prop ──
    stand(b, standin, 2.4, 0, -4.0, 2.6, 1.0, -0.2);                 // west kerb
    stand(b, standin, 2.25, 0.95, -4.0, 2.6, 1.0, -0.2);             // the west ledge (note5_visitors lies on it)
    pane(b, glass, PANES5[0].box);                                   // west glass
    stand(b, standin, 2.4, 1.0, -4.0, 2.6, 2.4, -3.85);              // south-west post
    stand(b, standin, 2.4, 2.4, -4.0, 2.6, 2.6, -0.2);               // west header
    stand(b, standin, 2.4, 0, -4.0, 5.8, 2.6, -3.8);                 // south face
    stand(b, standin, 2.4, 2.6, -4.0, 5.8, 3.4, -0.2);               // roof (to the ceiling)
    stand(b, standin, 4.4, 0, -3.6, 5.6, 0.95, -0.4);                // inner counter (the palm plate, the monitor, the mug)
    L.screen('aas_palm', 'palm', 0.22, 0.28, 4.6, 1.1, -2.0, '-x', { text: 'white|done|아스, L. (중위) — 손바닥 — 생존' });
    L.marker('mk5_aas_palm', 4.6, 1.1, -2.0, -PI / 2);
    L.screen('gate_log', 'terminal_idle', 0.56, 0.36, 4.38, 1.35, -1.1, '-x', { text: '게이트 4 — 최종 인가: 아스, L. (중위) — 손바닥 — 생존' });
    L.interact('note5_visitors', 'log', '기록 읽기', 2.3, 1.05, -2.0);
    // ── turnstile line z −5.0: two tripods, the open equipment gate x −1.0 … 1.2 (the route), fences h 1.2 ──
    stand(b, standin, -3.0, 0, -5.15, -2.1, 1.0, -4.85);
    stand(b, standin, -2.0, 0, -5.15, -1.1, 1.0, -4.85);
    stand(b, standin, 1.2, 0, -5.05, 2.4, 1.2, -4.95);
    stand(b, standin, -5.8, 0, -5.05, -3.0, 1.2, -4.95);
    L.screen('onpost', 'onpost', 1.0, 0.6, -4.0, 2.6, -0.22, '-z', { text: '26' });
    L.marker('mk5_onpost', -4.0, 2.6, -0.22, PI);
    stand(b, dark, -5.5, 0, -8.9, -4.9, 0.9, -8.3);                  // weapon-clearing barrel
    shelf(b, standin, 5.4, 1.0, -6.0, 0.35, 0.5);                    // first-aid cabinet (east wall)
    roomLabel(b, '초소 4 — 게이트하우스', -5.8, 2.5, -7.0, '+x', 3.0);
  },

  duty5: ({ L, G, b, standin }) => {
    air(G, 'duty5');
    stand(b, standin, -3.0, 0, -16.0, 0.0, 1.0, -15.0);              // watch desk (h 1.0)
    stand(b, standin, 4.4, 0, -21.8, 5.6, 1.3, -21.2);               // filing cabinets (h 1.3, low cover)
    L.interact('note5_watch', 'log', '당직 일지 읽기', -1.2, 1.02, -15.5);
    L.screen('dock_status', 'dock_status', 3.0, 1.2, -7.78, 1.7, -18.0, '+x', { text: 'SDV 턴 — 크레이들 — 발사 준비\n트렁크 — 정상\n지휘 모듈 — 밀봉됨 (내부)\n링크 훈련 — 진행 중' });
    L.interact('note5_roster', 'log', '카드 읽기', -7.78, 1.4, -14.0);
    // the keypad (§8.5): panel `key5_panel` on the duty side of d5_key, north of its pocket; interactable 0.3 m out,
    // radius 1.2, usable only with the eye at x < 7.8 (R8: never from the spine side / the doorway)
    L.screen('key5_panel', 'keypad', 0.22, 0.3, 7.78, 1.35, -13.9, '-x', { text: '권한 없음' });
    L.marker('mk5_keypad', 7.78, 1.35, -13.9, -PI / 2);
    eyeGate(L.ctx, L.interact('key5_duty', 'keypad', '키패드 — 전원 없음', 7.48, 1.35, -13.9, true, 1.2), { axis: 'x', max: 7.8 });
    shelf(b, standin, 7.5, 1.2, -11.0, 0.45, 0.4);
    roomLabel(b, '당직실', 7.8, 2.6, -19.5, '-x', 2.4);
    // the cutscene markers (§4.2)
    L.marker('mk5_c1_cam0', 0, 1.65, -8.6, 0);
    L.marker('mk5_c1_cam1', 0.4, 1.65, -13.8, 0);
    L.marker('mk5_c1_sol', -3.6, 0, -19.2, PI / 2);
    L.marker('mk5_c1_door', -4.0, 0, -21.4, 0);
    L.marker('mk5_c1_end', 0.4, 0, -13.8, 0);
  },

  ready5: ({ L, G, b, standin }) => {
    air(G, 'ready5');
    stand(b, standin, -8.0, 0, -33.0, -7.4, 2.0, -26.0);             // locker row L1
    stand(b, standin, -0.4, 0, -33.0, 0.2, 2.0, -26.0);              // locker row L2
    stand(b, standin, -4.6, 0, -29.9, -3.4, 1.2, -29.1);             // crate C1
    stand(b, standin, -4.6, 0, -34.4, -3.4, 1.2, -33.6);             // crate C2
    stand(b, standin, 1.4, 0, -35.6, 2.6, 1.2, -34.8);               // crate C3
    stand(b, standin, -11.8, 0, -37.8, 3.8, 2.2, -37.2);             // kit rack (south wall)
    L.interact('note5_locker', 'log', '쪽지 읽기', -7.38, 1.5, -29.0);
    L.marker('mk5_locker_slam', -0.4, 0, -31.5, -PI / 2);
    L.marker('mk5_helmet_rest', -2.9, 0, -31.5, 0);
    L.marker('mk5_c1_out', -4.0, 0, -23.2, 0);
    L.marker('mk5_duty_u1', -5.0, 0, -23.6, PI);
    L.marker('mk5_duty_u2', -3.0, 0, -23.6, PI);
    L.marker('mk5_s1', -4.0, 0, -36.6, PI);
    shelf(b, standin, 3.4, 1.0, -23.0, 0.45, 0.4);
    shelf(b, standin, -11.4, 1.0, -30.0, 0.4, 0.45);
    // the radio (§4.3): created disabled at the soldier's mark; the story moves it to `corpsePoint` and enables it
    L.interact('radio5', 'radio', '무전기 가져가기', -4.0, 0.3, -36.6, false, 1.6);
    roomLabel(b, '대기실', -11.8, 2.6, -24.5, '+x', 2.4);
  },

  spine5: ({ L, G, b, standin, glass, dark, yellow, grate }) => {
    air(G, 'spine5');
    // ── the crawl (§2.6): strip under the grating, the hatch pit, the turn south under d5_arm ──
    airIn(G, 'crawl5', [16.4, -1.4, -16.6, 36.2, 0, -15.4], ['spine5'], 'spine5');
    airIn(G, 'crawl5', [36.2, -1.4, -17.6, 38.6, 0, -15.4], ['spine5'], 'spine5');
    // (ceiling −0.07 here: d5_arm's threshold above reaches down to −0.05 — its underside then lies inside the slab)
    airIn(G, 'crawlturn5', [16.4, -1.4, -20.0, 17.6, -0.07, -16.6], ['spine5', 'arm5'], 'spine5');
    // grating strip x 16.4 … 36.2 (flush, colliding: bullets, sight and bodies stop on it; the crawl ceiling y −0.05)
    b.bx(grate, 16.41, -0.05, -16.59, 36.19, 0, -15.41).collide(16.4, -0.05, -16.6, 36.2, 0, -15.4, 'metal', true); // (visual 1 cm in from the crawl walls: no coplanar sides)
    // the hatch pit's stair (z −17.6 → −15.5, y −1.4 → 0; its top meets the walkway edge z −15.4)
    buildStair(L, b, STAIR5_HATCH, standin, false);
    // (the flight's foot is against the pit's south wall, so the landing meets it from the SIDE: its two lowest treads
    // are also walkable dynamic boxes — a body steps up 0.28 / 0.56 onto them sideways instead of hitting the slope's edge)
    for (let k = 0; k < 2; k++) {
      const s = STAIR5_HATCH, z0 = s.z0 + s.tread * k;
      const tb = L.ctx.physics.addBox(box3([s.x0, s.y0!, z0, s.x1, s.y0! + s.rise * (k + 1), z0 + s.tread]), 'concrete');
      tb.walkable = true;
    }
    // rails 1.0 m on the pit's west, east and north-over-the-landing sides; the stair top x 37.4 … 38.6 is the entry
    rail(b, dark, 36.15, -17.6, 36.2, -15.4, 0, 1.0);
    rail(b, dark, 38.6, -17.6, 38.65, -15.4, 0, 1.0);
    rail(b, dark, 36.2, -15.4, 37.4, -15.35, 0, 1.0);
    b.sign('빌지 출입 — 탄약고 연결 통로 — 웅크리기', 'stencil', 36.8, 0.72, -15.345, 1.1, 0.16, '+z');
    // (IA-5: radius 1.4 → 1.8 — the use point lies 0.3 m up by the walkway, so at 1.4 a standing eye (1.35 m above it)
    // had to be within ≈ 0.3 m of it horizontally: from the walkway or the lid's edge the hatch could not be opened)
    L.interact('hatch5_spine', 'hatch', '해치 열기', 37.0, 0.3, -14.9, true, 1.8);
    // (nav: the 4 m spine samples rows at z −16.5 / −15.5 only; hand nodes down the 1.2 m walkway beside the pit)
    for (const x of [35.9, 36.8, 37.7, 38.6, 39.4]) L.navNode(x, -14.8, 'spine5', 0);
    // ── pipe risers (0.6 × 0.5, full height: the spine's high cover), clear of every door pocket ──
    const S0 = -17.8, S1 = -17.3, N0 = -14.7, N1 = -14.2;
    for (const [x0, south] of [[11.7, true], [13.7, false], [21.7, true], [25.7, false], [27.7, true], [34.7, false], [40.7, true]] as const) {
      stand(b, standin, x0, 0, south ? S0 : N0, x0 + 0.6, 3.2, south ? S1 : N1);
    }
    // ── the ceiling vent (30.0, 3.2, −16.0): a void above the ceiling closed by a grille (`vent5_spine`) ──
    airIn(G, 'spine5', VOIDS5.vent5_spine, ['spine5'], 'spine5');
    grillePanel(L, 'vent5_spine_grille', 29.6, -16.4, 30.4, -15.6, 3.2, standin, 'vent_grille', ['spine5']);
    L.marker('mk5_vent_spine', 30.0, 3.2, -16.0, 0);
    // ── Kessler's door (sealed; W7 dresses it): 2.0 × 2.6, the port, the yellow stand line at x 42.5 ──
    // (the 2.5 × 3.0 opening W7's `cmdDoor` frames; the greybox door in it is a placeholder, `placeholders5`)
    sealedOpening(G, 'door5_cmd', 44, 0, -16, 'x', 2.5, 3.0, ['spine5']);
    L.marker('mk5_port', 43.8, 1.62, -16.0, -PI / 2);
    b.bx(yellow, 42.45, 0, -17.4, 42.55, 0.006, -14.6);              // the yellow line (W7 makes it pulse)
    shelf(b, standin, 43.4, 1.0, -14.6, 0.4, 0.35);
    L.marker('mk5_exit_spine', ...EXIT_SPINE, 0);
    L.marker('mk5_body_b', 14.2, 0, -16.9, 0);
    L.marker('mk5_boots_stop', 26.0, 0, -16.0, 0);
    L.marker('mk5_patrol_end', 40.5, 0, -14.9, PI / 2);
    roomLabel(b, '스파인', 10.6, 2.5, -14.2, '-z', 2.4);
    roomLabel(b, '지휘 모듈 →', 42.0, 2.75, -14.2, '-z', 2.6);
  },

  berths5: ({ L, G, b, standin }) => {
    air(G, 'berths5');
    // 6 triple bunks (2.0 × 0.9, h 2.2) in two rows, aisle x 14.8 … 21.2
    for (const [x0, x1] of [[12.8, 14.8], [21.2, 23.2]] as const) for (const [z0, z1] of [[-12.8, -11.9], [-8.6, -7.7], [-4.1, -3.2]] as const) stand(b, standin, x0, 0, z0, x1, 2.2, z1);
    L.marker('mk5_bunk_radio', 13.6, 1.3, -7.6, 0);
    L.marker('mk5_body_a', 19.6, 0, -12.4, 0);
    shelf(b, standin, 23.4, 0.7, -3.0, 0.4, 0.35);
    shelf(b, standin, 13.8, 0.7, -2.9, 0.4, 0.3);
    roomLabel(b, '침실구역 — 1', 23.8, 2.4, -12.0, '-x', 2.4);
  },

  heads5: ({ L, G, b, standin }) => {
    air(G, 'heads5');
    stand(b, standin, 12.2, 0, -1.0, 12.8, 0.9, 3.0);                // sinks (west wall)
    for (const z of [0.4, 1.9]) stand(b, standin, 18.4, 0, z - 0.03, 19.8, 2.0, z + 0.03); // shower partitions (east)
    L.marker('mk5_taps', 12.4, 1.0, 1.0, PI / 2);
    roomLabel(b, 'WASHROOM', 19.8, 2.2, -0.8, '-x', 2.0);
  },

  mess5: ({ L, G, b, standin }) => {
    air(G, 'mess5');
    for (const x of [27, 31]) for (const z of [-10, -6]) stand(b, standin, x - 0.5, 0, z - 1.2, x + 0.5, 0.75, z + 1.2);
    // serving counter (north wall) — correction: §2.6's x 26 … 36 runs across d5_galley (x 32.2 … 33.8): split, 3.6 m free
    stand(b, standin, 26.0, 0, -2.8, 31.2, 1.0, -2.2);
    stand(b, standin, 34.8, 0, -2.8, 36.0, 1.0, -2.2);
    L.marker('mk5_trays', 30.0, 1.0, -2.5, 0);
    L.interact('note5_mess', 'log', '게시판 읽기', 24.22, 1.6, -4.0);
    shelf(b, standin, 37.4, 1.0, -13.4, 0.4, 0.4);
    roomLabel(b, '식당', 37.8, 2.5, -9.0, '-x', 2.0);
  },

  galley5: ({ L, G, b, standin, glass }) => {
    air(G, 'galley5');
    stand(b, standin, 28.2, 0, -0.5, 29.0, 0.9, 2.5);                // ranges (west)
    stand(b, standin, 32.0, 0, 2.9, 36.0, 0.9, 3.8);                 // steel bench (north wall)
    // the walk-in cold room behind the frosted window (east wall, x 37.78, z 0 … 2, y 1 … 2): a shallow box, never entered
    airIn(G, 'coldroom5', COLDROOM5, ['galley5'], 'galley5');
    airIn(G, 'coldroom5', [37.8, 1.0, 0.0, 38.2, 2.0, 2.0], ['galley5'], 'galley5');
    pane(b, glass, PANES5[3].box);
    L.marker('mk5_oilskin', 38.8, 1.4, 1.0, -PI / 2);
    shelf(b, standin, 28.6, 1.0, 3.4, 0.4, 0.35);
    roomLabel(b, '갤리', 28.2, 2.3, 3.0, '+x', 2.0);
  },

  arm5: ({ L, G, b, standin, dark }) => {
    air(G, 'arm5');
    // ── the magazine (y −2.6, standing 2.5 m), its stair in from the crawl, its stair out to the hatch ──
    airIn(G, 'mag5', [14.2, -2.6, -27.8, 21.8, -0.1, -21.4], ['arm5'], 'arm5');
    airIn(G, 'mag5', [16.4, -2.6, -21.4, 17.6, -0.1, -20.0], ['arm5', 'spine5'], 'arm5');
    airIn(G, 'arm5', [20.4, -0.1, -27.0, 21.6, 0, -24.3], ['arm5'], 'arm5');   // the hatch hole in the armoury floor
    buildStair(L, b, STAIR5_MAG_IN, standin, false);
    buildStair(L, b, STAIR5_MAG_OUT, standin, false);
    // ammo-tin racks (h 2.0; the dressing gives them per-shelf colliders with open fronts)
    stand(b, standin, 14.4, -2.6, -27.4, 15.4, -0.6, -22.4);
    stand(b, standin, 18.6, -2.6, -26.2, 19.6, -0.6, -22.4);
    L.interact('note5_mag', 'log', '계수표 읽기', 19.0, -1.4, -22.0);
    for (const [x, y, z] of [[17.0, -2.2, -27.4], [17.6, -2.2, -27.4]] as const) shelf(b, standin, x, y, z, 0.35, 0.3);
    // ── the magazine hatch (x 20.4 … 21.6, z −27.0 … −24.3) in the armoury's south-east corner: lid hinged on its south
    // edge, dogged from below; rail 1.0 m on its west (x 20.2) and south (z −27.2) sides, the wall x 21.8 its east ──
    rail(b, dark, 20.15, -27.2, 20.2, -24.3, 0, 1.0);
    rail(b, dark, 20.15, -27.25, 21.8, -27.2, 0, 1.0);
    const lidShut = () => !(lidK(L, 'hatch5_mag') > 0);
    // underside interact: use point on the lid underside, usable only with the eye below y −0.2 while the lid is shut
    eyeGate(L.ctx, L.interact('hatch5_mag', 'hatch', '해치 열기', 21.0, -0.08, -26.4, true, 1.6), { axis: 'y', max: -0.2 }, lidShut);
    // top side: the plate (prompt only; pressing it toasts the same)
    const plate = L.interact('hatch5_mag_plate', 'hatch', '해치가 아래에서 잠겨 있다', 21.0, 0.05, -25.4, true, 1.6);
    plate.onUse = () => L.ctx.events.emit('story:toast', { text: '해치가 아래에서 잠겨 있다' });
    eyeGate(L.ctx, plate, { axis: 'y', min: -0.2 }, lidShut);
    b.sign('탄약고 — 아래에서 잠김 — 스파인 통로로 출입', 'stencil', 21.79, 1.15, -25.65, 1.9, 0.2, '-x', 0, true);
    // ── the armoury above: cage racks (west wall), issue desk ──
    stand(b, standin, 14.2, 0, -27.4, 14.45, 2.0, -20.9);
    stand(b, standin, 14.2, 0, -20.2, 16.0, 0.95, -19.0);
    L.interact('note5_arm', 'log', '지급 전표 읽기', 15.0, 1.0, -19.6);
    shelf(b, standin, 21.4, 1.4, -19.4, 0.5, 0.4);
    L.marker('mk5_exit_mag', ...EXIT_MAG, 0);
    roomLabel(b, '무기고', 21.8, 2.5, -20.5, '-x', 2.0);
  },

  sub5: ({ L, G, b, standin, glass, dark }) => {
    air(G, 'sub5');
    const deck = (x0: number, x1: number, z0: number, z1: number) => stand(b, standin, x0, GAL - 0.15, z0, x1, GAL, z1);
    // ── gallery decks y 4.8 (west, east, north) and the bridge over the boat ──
    deck(22.2, 25.0, -55.8, -18.2);
    deck(43.0, 45.8, -55.8, -18.2);
    deck(25.0, 43.0, -21.0, -18.2);
    deck(25.0, 43.0, -36.0, -34.0);
    // rails 1.1 m on the inner edges (gaps where the bridge joins and where the stairs land); steel parapet plates
    // (h 1.1, colliding — low cover) on the west gallery z −50 … −40 / −30 … −22, the east −48 … −38 / −30 … −22, the
    // bridge's north edge x 28 … 32 / 36 … 40
    const R = 1.1;
    const plate = (x0: number, z0: number, x1: number, z1: number) => stand(b, standin, x0, GAL - 0.15, z0, x1, GAL + R, z1);
    const westRuns: [number, number][] = [[-55.8, -50], [-40, -36], [-34, -30], [-22, -21.0]];
    for (const [z0, z1] of westRuns) rail(b, dark, 25.0, z0, 25.05, z1, GAL, R);
    plate(25.0, -50, 25.08, -40); plate(25.0, -30, 25.08, -22);
    const eastRuns: [number, number][] = [[-55.8, -48], [-38, -36], [-34, -30], [-22, -21.0]];
    for (const [z0, z1] of eastRuns) rail(b, dark, 42.95, z0, 43.0, z1, GAL, R);
    plate(42.92, -48, 43.0, -38); plate(42.92, -30, 43.0, -22);
    rail(b, dark, 25.05, -21.05, 42.95, -21.0, GAL, R);              // north gallery inner edge
    rail(b, dark, 27.4, -36.05, 42.95, -36.0, GAL, R);               // bridge south edge (STAIR5_W lands x 25.4 … 27.4)
    rail(b, dark, 25.05, -36.05, 25.4, -36.0, GAL, R);
    for (const [x0, x1] of [[25.05, 28], [32, 33.3], [34.7, 36], [40, 40.6], [42.6, 42.95]] as const) rail(b, dark, x0, -34.0, x1, -33.95, GAL, R);
    plate(28, -34.0, 32, -33.92); plate(36, -34.0, 40, -33.92);
    // ── the two long stairs ──
    buildStair(L, b, STAIR5_W, standin, false);
    buildStair(L, b, STAIR5_E, standin, false);
    // ── the boat (W7: SDV TERN) on its cradle (stand-ins), rails x 33 / 35 (0.15, walkable) ──
    stand(b, standin, 31.8, 0, -43.4, 36.2, 0.6, -26.6);             // cradle
    stand(b, dark, 32.5, 0.6, -43.0, 35.5, 3.6, -27.0);              // hull (⌀ 3.0 as a box)
    stand(b, dark, 33.4, 3.6, -32.5, 34.6, 4.5, -30.0);              // sail
    // (the rails are walkable dynamic boxes: bodies step over them — a 0.15 m static ledge snagged a walking husk)
    for (const x of [33.0, 35.0]) for (const [z0, z1] of [[-55.6, -43.4], [-26.6, -19.0]] as const) {
      b.bx(dark, x - 0.06, 0, z0, x + 0.06, 0.15, z1);
      const rb2 = L.ctx.physics.addBox(box3([x - 0.06, 0, z0, x + 0.06, 0.15, z1]), 'metal');
      rb2.walkable = true;
    }
    // ── floor cover (§5.4) ──
    stand(b, standin, 26.0, 0, -30.0, 28.0, 1.2, -28.0);             // CA
    stand(b, standin, 26.0, 0, -51.0, 27.2, 1.2, -49.0);             // CB
    stand(b, standin, 38.0, 0, -46.0, 40.0, 1.2, -44.0);             // CC
    stand(b, standin, 43.6, 0, -24.0, 45.0, 2.0, -22.0);             // CD
    stand(b, standin, 37.6, 0, -28.0, 39.0, 2.2, -25.6);             // forklift
    stand(b, standin, 38.4, 0, -52.4, 40.4, 1.8, -51.6);             // gas bottle racks
    stand(b, standin, 30.4, 0, -33.0, 31.6, 1.3, -31.0);             // EW1
    stand(b, standin, 30.4, 0, -41.0, 31.6, 1.3, -39.0);             // EW2
    stand(b, standin, 36.4, 0, -33.0, 37.6, 1.3, -31.0);             // EE1
    stand(b, standin, 36.4, 0, -41.0, 37.6, 1.3, -39.0);             // EE2
    stand(b, standin, 23.7, 0, -22.3, 24.7, 0.95, -21.7);            // locker by d5_arm_bay (p5_bay_*)
    stand(b, standin, 22.2, GAL, -51.3, 22.9, GAL + 0.75, -50.3);    // gallery locker by the wheel (p5_wheel_*)
    shelf(b, standin, 44.6, 1.0, -50.0, 0.4, 0.4);
    // ── launch console on the bridge (h 1.1), the palm plate (R8: from the bridge only), the `launch` screen ──
    stand(b, standin, 33.3, GAL, -34.3, 34.7, GAL + 1.1, -34.0);
    L.marker('mk5_launch', 34.0, GAL, -34.15, PI);
    L.screen('launch', 'launch', 0.6, 0.36, 33.75, GAL + 1.35, -34.12, '+z', { text: 'SDV 턴 — 발사 관제' });
    L.screen('launch5_palm', 'palm', 0.2, 0.26, 34.4, GAL + 1.25, -34.12, '+z', { text: 'white|standby|발사' });
    L.interact('launch5_palm', 'palm', '손바닥을 대세요 — 발사', 34.4, GAL + 1.2, -34.3, true, 1.6);
    // ── the wheel (W7, west wall over the tunnel door, on the west gallery) ──
    L.marker('mk5_wheel', 22.25, 5.9, -52.0, PI / 2);
    L.interact('wheel5', 'wheel', '바퀴 돌리기', 22.25, 5.9, -52.0, false, 1.2);
    // ── floor drains (voids under grilles flush with the floor) ──
    for (const [id, bx] of [['drain5_a', VOIDS5.drain5_a], ['drain5_b', VOIDS5.drain5_b]] as const) {
      airIn(G, 'sub5', bx, ['sub5'], 'sub5');
      grillePanel(L, `${id}_grille`, bx[0], bx[2], bx[3], bx[5], -0.06, standin, 'sump_lift', ['sub5']);
      L.obstacles.push(box3([bx[0], -1.0, bx[2], bx[3], 1.0, bx[5]])); // (no nav node on a hole)
    }
    L.marker('mk5_drain_a', 28.0, 0, -48.0, 0);
    L.marker('mk5_drain_b', 39.0, 0, -36.5, 0);
    // ── the dock sentry's roof dock (34, 9, −45) ──
    stand(b, dark, 33.5, 9.4, -45.5, 34.5, 12.0, -44.5);
    // ── the launch lock (W7: 5.0 m round door at (34, 3.0, −56)) — a frame ring stand-in and its 0.6 m port ──
    airIn(G, 'sub5', [33.7, 1.9, -56.4, 34.3, 2.5, -55.8], ['sub5'], 'sub5');
    G.void(OUTSIDE5);
    // (the round door, its port glass: W7's `launchLockDoor`; a greybox placeholder in `placeholders5`)
    L.screen('tern_board', 'dock_status', 2.4, 0.8, 34.0, 7.2, -18.22, '-z', { text: '턴 — 크레이들 — 발사 준비' });
    L.marker('mk5_tern_board', 34.0, 7.2, -18.22, PI);
    L.screen('tunnel_panel', 'terminal_idle', 0.5, 0.3, 22.22, 1.6, -50.9, '+x', { text: "트렁크 터널 — 함장 권한" });
    L.marker('mk5_lockside_door', 42, 0, -56, 0);
    L.marker('mk5_dive_door', 46, 0, -34, -PI / 2);
    roomLabel(b, '서브베이', 22.2, 2.6, -30.0, '+x', 2.4);
    roomLabel(b, '서브베이 — 갤러리', 22.2, GAL + 2.2, -40.0, '+x', 3.0);
  },

  dive5: ({ L, G, b, standin }) => {
    air(G, 'dive5');
    stand(b, standin, 49.0, 0, -39.6, 51.6, 2.0, -36.0);             // decompression chamber (prop)
    L.interact('note5_dive', 'log', '게시판 읽기', 51.78, 1.6, -30.0);
    shelf(b, standin, 51.4, 1.0, -29.0, 0.4, 0.4);
    roomLabel(b, '잠수 장비함', 51.8, 2.5, -33.0, '-x', 2.4);
  },

  lockacc5: ({ G, b }) => {
    air(G, 'lockacc5');
    b.sign('발사 록 — 침수 — 210 BAR', 'stencil', 38.22, 1.6, -59.0, 1.6, 0.22, '+x');
    roomLabel(b, '발사 록 — 출입', 45.8, 2.5, -59.0, '-x', 2.8);
  },

  tunnel5: ({ L, G, b, dark }) => {
    air(G, 'tunnel5');
    sealedOpening(G, 'door5_headend', 14, 0, -53, 'x', 1.6, 2.4, ['tunnel5']);
    sealedDoor(L, b, {
      id: 'door5_headend', x: 14, y: 0, z: -53, wall: 'x', kind: 'std', sides: 'front', leafMat: 'navy_grey', labelFront: '트렁크 — 헤드엔드',
      panel: { text: '트렁크 — 헤드엔드 200 M — 순환 중', side: 'front' },
    });
    b.bx(dark, 14.2, 2.2, -50.4, 21.8, 2.28, -50.3);                 // cable tray (north wall)
    b.bx(dark, 14.2, 0.35, -50.45, 21.8, 0.6, -50.2);                // the trunk cable (⌀ 0.25), along the north wall
    shelf(b, dark, 21.0, 1.0, -50.6, 0.4, 0.4);
    b.sign('트렁크 — 헤드엔드 200 M ←', 'stencil', 18.0, 1.5, -55.78, 2.0, 0.22, '+z');
    roomLabel(b, '트렁크 터널', 18.0, 2.4, -55.8, '+z', 2.4);
  },
};

// ───────────────────────────────────────────────────────────── greybox placeholders (dressing wins)

/**
 * Stand-ins for what other tasks own, so the story runs on the bare greybox: registered after every room is built and
 * only when the id is still free (a dressing / set-piece that registers the id — anywhere — replaces it). Every
 * vignette has its `:snap` (§8.7). Sounds are the vignette's own (§8.11 "level vignettes").
 */
export function placeholders5(L: LevelBuild, m: { standin: Mat; dark: Mat; glass: Mat }): void {
  const ctx = L.ctx;
  // ── structure the set pieces (W7) own: built here only when no set piece registered the id ──
  const pb = (name: string, rooms: string[]) => { const b = L.builder(name); b.rooms = rooms; return b; };
  if (!L.objects.has('hatch5_spine')) hatchLid(L, 'hatch5_spine', 36.2, 38.6, -17.6, 2.2, m.standin, ['spine5']);
  if (!L.objects.has('hatch5_mag')) hatchLid(L, 'hatch5_mag', 20.4, 21.6, -27.0, 2.7, m.standin, ['arm5']);
  if (!L.objects.has('door5_cmd')) {
    const b = pb('ph5:door5_cmd', ['spine5']);
    // a plain slab in the 2.5 × 3.0 opening (the hardened door is W7's)
    stand(b, m.dark, 43.86, 0, -17.25, 44.2, 3.0, -14.75);
    const o = L.marker('door5_cmd', 44, 0, -16, -PI / 2); o.userData.placeholder = true; o.userData.sealed = true;
    pane(b, m.glass, PANES5[1].box);
    // (W7's door names its panel `door5_cmd_panel`; the greybox one keeps §6.4's `cmd_panel`)
    L.screen('cmd_panel', 'terminal_idle', 0.42, 0.28, 43.78, 1.75, -17.5, '-x', { text: '지휘 모듈 — 차폐됨 — 내부에서 밀봉' });
  }
  if (!L.objects.has('lock5_launch')) {
    const b = pb('ph5:lock5_launch', ['sub5']);
    pane(b, m.glass, PANES5[2].box);
    for (const bx of [[31.4, 0.4, 36.6, 0.6], [31.4, 5.4, 36.6, 5.6]] as const) b.bx(m.dark, bx[0], bx[1], -55.8, bx[2], bx[3], -55.7);
    for (const x of [31.4, 36.4]) b.bx(m.dark, x, 0.6, -55.8, x + 0.2, 5.4, -55.7);
    const lr = L.marker('lock5_launch', 34, 3.0, -55.8, 0); lr.userData.placeholder = true;
  }
  if (!L.objects.has('wheel5')) {
    const b = pb('ph5:wheel5', ['sub5']);
    stand(b, m.standin, 22.2, 5.5, -52.4, 22.3, 6.3, -51.6);          // manifold plate
  }
  const vig = (id: string, run: () => void, snap: () => void, toggle = false) => { if (!L.vignettes.has(id)) L.vignette(id, run, { toggle, snap }); };
  const none = () => { /* greybox: nothing to show (the dressing task owns this vignette) */ };
  const text = (screen: string, kind: Parameters<GameContext['materials']['setScreen']>[1], t: string) => {
    const m = L.screens.get(screen);
    if (m) ctx.materials.setScreen(m, kind, { text: t });
  };
  const obj = (id: string) => L.objects.get(id)?.userData as Record<string, (...a: unknown[]) => unknown> | undefined;

  // arrival (D1)
  vig('gate5_open', none, none);
  vig('gate5_booth', () => L.sfx('booth_door_shut', 5.7, 1.1, -1.6, 0.8), none);
  vig('v5_turnstile', () => { L.sfx('turnstile_click', -2.55, 0.9, -5.0); L.after(0.4, () => { L.sfx('counter_tick', -4.0, 2.6, -0.3); text('onpost', 'onpost', '27'); }); }, () => text('onpost', 'onpost', '27'));
  vig('v5_hull_groan', () => { L.sfx('hull_groan_long', -4, 2.5, -30); L.after(3.4, () => L.sfx('locker_bang', -0.4, 1.2, -31.5)); }, none);
  vig('key5_power', () => { L.sfx('keypad_power_on', 7.78, 1.35, -13.9); text('key5_panel', 'keypad', '코드 입력'); }, () => text('key5_panel', 'keypad', '코드 입력'));
  // spine, crawl, armoury / magazine (D2a)
  const lidOpen = (id: string) => L.objects.get(id)?.userData.open as ((k: number) => void) | undefined;
  const swing = (id: string) => { const o = lidOpen(id); if (o && lidK(L, id) === 0) L.tween(0.3, 1.2, (k) => o(k * k * (3 - 2 * k)), () => o(1)); };
  vig('hatch5_spine_open', () => { L.sfx('hatch_unlatch', 37.4, 0.2, -16.5); L.after(0.3, () => L.sfx('hatch_open', 37.4, 0.4, -16.5)); swing('hatch5_spine'); }, () => lidOpen('hatch5_spine')?.(1));
  vig('hatch5_mag_open', () => { L.sfx('hatch_unlatch', 21.0, -0.2, -25.6); L.after(0.3, () => L.sfx('hatch_open', 21.0, 0.2, -25.6)); swing('hatch5_mag'); }, () => lidOpen('hatch5_mag')?.(1));
  vig('v5_magazine', () => { L.sfx('bulb_pop', 17.0, -0.45, -24.5); L.sfx('glass_tinkle', 17.0, -2.4, -24.5, 0.6); ctx.render.lights.setGroup('mag5', { enabled: false }); }, () => ctx.render.lights.setGroup('mag5', { enabled: false }));
  vig('cmd5_line', none, none, true);
  vig('cmd5_port_look', none, none, true);
  vig('vent5_spine', () => obj('vent5_spine_grille')?.open('drop'), () => obj('vent5_spine_grille')?.open('drop', true));
  vig('v5_boots', none, none);
  // quarters (D2b)
  vig('v5_bunk_radio', () => L.sfx('radio_on_click', 13.6, 1.3, -7.6), none);
  vig('v5_water', () => L.sfx('water_hammer', 12.6, 1.4, 1.0), none);
  vig('v5_trays', () => { L.sfx('pump_thump', 31, 1.0, -2.2); L.after(0.3, () => L.sfx('tray_crash', 30, 1.0, -2.6)); }, none);
  vig('v5_galley_shape', () => L.sfx('fan_start', 38.8, 1.8, 1.0), none);
  vig('v5_body', none, none);
  // sub bay (D3)
  vig('v5_sub_check', () => {
    (L.objects.get('tern')?.userData.check as (() => void) | undefined)?.();
  }, () => text('tern_board', 'dock_status', '완료 — 장교 손바닥 인증 대기'));
  vig('wheel5_turn', () => { L.sfx('wheel_crank', 22.4, 5.9, -52.0); L.after(3.6, () => L.sfx('hydraulic_release', 22.4, 3.0, -53.0)); }, none);
  vig('drain5_a', () => obj('drain5_a_grille')?.open('lift'), () => obj('drain5_a_grille')?.open('lift', true));
  vig('drain5_b', () => obj('drain5_b_grille')?.open('lift'), () => obj('drain5_b_grille')?.open('lift', true));
  // the dark (D2a + D3 own the halves; the greybox does both)
  const lightsOut = (instant: boolean) => {
    const lm = ctx.render.lights;
    const [ox, oz] = LIGHTS_OUT5.origin;
    for (const g of LIGHTS_OUT5.off) for (const h of lm.group(g)) {
      if (instant) { h.enabled = false; continue; }
      const delay = Math.hypot(h.position.x - ox, h.position.z - oz) * LIGHTS_OUT5.perMetre;
      L.tween(delay, LIGHTS_OUT5.dim, (k) => { h.intensityScale = 1 - k; }, () => { h.enabled = false; h.intensityScale = 1; });
    }
    if (instant) for (const g of LIGHTS_OUT5.emerg) lm.setGroup(g, { enabled: true });
    else L.after(LIGHTS_OUT5.dim, () => { for (const g of LIGHTS_OUT5.emerg) lm.setGroup(g, { enabled: true }); });
  };
  vig('lights_out5', () => { L.sfx('lights_out_dock', 34, 8, -40, 1.0); L.after(0.6, () => L.sfx('lights_out_dock', 30, 2.5, -16, 0.8)); lightsOut(false); }, () => lightsOut(true));
  // `dark5_on` (§2.7.3): `regions.dark` gains spine5 and sub5 (idempotent)
  const darkOn = () => {
    const regions = ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
    if (!regions) return;
    const list = (regions.dark ??= []);
    for (const id of ['spine5', 'sub5'] as const) {
      const b = box3(rb(id, ROOMS5[id].y0 - 0.5, ROOMS5[id].y0 + ROOMS5[id].h));
      if (!list.some((q) => q.equals(b))) list.push(b);
    }
  };
  vig('dark5_on', darkOn, darkOn);

  if (!L.machines.has('tern')) L.machines.set('tern', () => { /* greybox: no hum, no nav lights (W7) */ });
  if (!L.machines.has('wheel5')) L.machines.set('wheel5', () => { /* greybox (W7) */ });
  if (!L.objects.has('tern')) {
    // W7's `tern(L, at)` replaces it: `userData.check()` runs the pre-launch sequence (board RUNNING → COMPLETE)
    const t = L.marker('tern', 34.0, 0.6, -35.0, 0);
    t.userData.placeholder = true;
    t.userData.check = () => {
      text('tern_board', 'dock_status', '발사 전 점검 — 진행 중');
      L.sfx('sub_ballast_hiss', 34, 1.2, -35);
      L.after(6, () => text('tern_board', 'dock_status', '완료 — 장교 손바닥 인증 대기'));
    };
  }
}
