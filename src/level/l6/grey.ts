/**
 * THE TRUNK — level 6 greybox shell (stage 3d, docs/plans/stage-3d.md §2; task W4a).
 *
 * Built on level 3's shell kernel (`GreyGrid`, `buildStair`, `block`, `roomLabel`, `flatMat` from ../l3/grey) as levels
 * 4 / 5. Level-5 helpers (`hatchLid`, `eyeGate`, `grillePanel`, `airIn`, the rail) are COPIED here (rule 9: no import
 * from or edit in `src/level/l5`).
 *  - `ROOMS6`: every room's plan box, floor, height and extra floors (§2.1 — the cable trench is `nav: false` floors of
 *    the vault and the head-end with their `exits`; the shaft's landings, the chamber's wet dock, channel, mid deck, cage
 *    and galleries are floors of their rooms).
 *  - `SHELLS6`: one function per room: carves its air (+ the trench, the under-wall crossing, the wet dock, the well, the
 *    voids, the window slot, the sealed prop's opening), puts back the structure that is not grid (gratings / floor plates
 *    over the trench, landings, decks, galleries, the coaming and its 2.4 m bar guard, the mid deck's bar guard, the cage,
 *    the shaft's well guards, rails, parapets, the twelve stairs, the ramps and the channel's slope), the plan-dimensioned
 *    stand-in blocks WITH colliders (every cover object of §5.4 is one), every named SCREEN of §6.4, every INTERACTABLE of
 *    §6.3 / §8.5 (frame6_* with `requireRegion: 't6_cage'`), every MARKER of §8.11.
 *  - Rails, bar guards, mesh guards, the cage and the tent's tarp are MOVE-ONLY colliders (D14: bodies stop, rounds and
 *    sight pass): `L.flagged('moveOnly', …)` (level/context.ts). Solid plate (coaming, parapets, slabs) stops both.
 *  - `LIGHTS6`: placeholder light tables per §2.7.1 (groups as named there + the `_far` / `_emerg` / `_beacon` groups the
 *    vignettes switch), each row bounded to its room AND floor where floors stack (S5).
 *  - `placeholders6()`: greybox stand-ins for what other tasks own (W7's set-piece objects `switch6`, `bj6`, `shaft6`,
 *    `frame6`, `phone6`, `console6`, the hatch lids, the grilles; every vignette of §5.7 / §4 with its `:snap`; the
 *    machines `winch6` / `ping6` / `trench6`) — registered only when nobody registered the id first.
 *
 * Dressing never edits the shell, the colliders, the doors, the triggers, the phases, the screens / interactables / markers
 * made here; it may restyle or hide stand-in visuals (material `grey_standin`, named builders `grey6:<what>`) and must
 * then keep ONE collider per object (kit props with `collide: false` over a kept stand-in collider, or replace both).
 * Containment geometry (the coaming, both bar guards, the cage, the shaft's well guards) keeps its colliders HERE in every
 * build (B1 / D32): a set piece that draws the cage or the guards draws them without colliders.
 */
import * as THREE from 'three';
import type { FlickerMode, GameContext, Interactable, Quality, Surface } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { sealedDoor } from '../kit';
import { GreyGrid, HW, block, buildStair, roomLabel, stairLine, type Box6, type RoomId3, type StairDef } from '../l3/grey';
import { beachJoint6, console6, feed6, frame6, phone6, shaftLock6, switch6, well6 } from './setpieces6';

const PI = Math.PI;
export { HW, stairLine };

// ───────────────────────────────────────────────────────────── rooms (§2.1)

export type RoomId6 =
  | 'lock6' | 'tun6_a' | 'rep6' | 'tun6_b' | 'bay6' | 'he6' | 'vault6' | 'hold6' | 'shaft6' | 'pool6' | 'stores6' | 'feed6';

type XYZ = [number, number, number];
export interface FloorDef6 { y: number; box: [number, number, number, number]; nav?: false; exits?: XYZ[] }
export interface RoomDef6 { name: string; x0: number; x1: number; z0: number; z1: number; y0: number; h: number; floors?: FloorDef6[] }

/** §2.6.6 / §2.6.7: the standing points at the top of each way out of the trench (`mk6_exit_vault`, `mk6_exit_he`). */
export const EXIT_VAULT: XYZ = [-12.4, 0, -157.4];
export const EXIT_HE: XYZ = [3.0, 0, -174.8];
const TRENCH_EXITS: XYZ[] = [EXIT_VAULT, EXIT_HE];

/** Deck heights in the chamber (§2.6.9). */
export const DOCK = -20, WET = -20.8, CHANNEL = -21.3, MID = -16, GAL = -12;
/** Slab thickness of the mid deck and the galleries (3.7 m clear under them: the undercroft, `cv6_m3`). */
const SLAB = 0.3;

/** §2.6.9 gallery decks (y −12): east, west, north, and the two stair landings. */
export const GALLERIES6: [number, number, number, number][] = [
  [-31.2, -28.2, -195.8, -148.2], [-75.8, -72.8, -195.8, -148.2], [-72.8, -31.2, -151.2, -148.2],
  [-35.0, -31.2, -159.6, -157.6], [-72.8, -70.6, -159.6, -157.6],
];
/** Shaft landings (§2.6.8). */
export const LANDINGS6 = {
  L0: { y: 0, box: [-27.8, -22.2, -171.8, -168.4] as [number, number, number, number] },
  L1: { y: -3, box: [-27.8, -22.2, -164.4, -162.2] as [number, number, number, number] },
  L2: { y: -6, box: [-27.8, -22.2, -171.8, -168.4] as [number, number, number, number] },
  L3: { y: -9, box: [-27.8, -22.2, -164.4, -162.2] as [number, number, number, number] },
};

/**
 * §2.1 table. Floors as §2.1 / §2.6: the trench (T-a, T-b in the vault; T-c in the head-end) `nav: false` with its two
 * exits; the shaft's landings; the chamber's wet dock, channel (1.0 m of water: `nav: false` — no node where the depth
 * exceeds 0.6, D13), mid deck + the cage cantilever, galleries.
 */
export const ROOMS6: Record<RoomId6, RoomDef6> = {
  lock6: { name: '트렁크 터널 — 헤드엔드 튜브', x0: -4, x1: 4, z0: 0, z1: 6, y0: 0, h: 3.0 },
  tun6_a: { name: '케이블 터널 — 1구간', x0: -2.5, x1: 2.5, z0: -80, z1: 0, y0: 0, h: 4.0 },
  rep6: { name: '중계기 2', x0: -6, x1: 16, z0: -92, z1: -80, y0: 0, h: 5.0 },
  tun6_b: { name: '케이블 터널 — 2구간', x0: 9.5, x1: 14.5, z0: -160, z1: -92, y0: 0, h: 4.0 },
  bay6: { name: '조인트 베이 2', x0: 14.5, x1: 20.5, z0: -106, z1: -98, y0: 0, h: 3.2 },
  he6: {
    name: '트렁크 헤드엔드', x0: 2, x1: 22, z0: -180, z1: -160, y0: 0, h: 4.5,
    floors: [{ y: -1.4, box: [2.0, 3.6, -179.4, -175.4], nav: false, exits: [EXIT_HE] }],
  },
  vault6: {
    name: '케이블 볼트', x0: -22, x1: 2, z0: -180, z1: -148, y0: 0, h: 6.0,
    floors: [
      { y: -1.4, box: [-13.0, -11.8, -179.4, -158.0], nav: false, exits: TRENCH_EXITS },
      { y: -1.4, box: [-13.0, 2.0, -179.4, -178.2], nav: false, exits: TRENCH_EXITS },
    ],
  },
  hold6: { name: '케이블 저장고', x0: -22, x1: -8, z0: -148, z1: -140, y0: 0, h: 4.0 },
  shaft6: {
    name: '계단실 — 문풀', x0: -28, x1: -22, z0: -172, z1: -162, y0: -12, h: 15.2,
    floors: Object.values(LANDINGS6).map((l) => ({ y: l.y, box: l.box })),
  },
  pool6: {
    name: '문풀', x0: -76, x1: -28, z0: -196, z1: -148, y0: DOCK, h: 22.0,
    floors: [
      { y: WET, box: [-62.4, -41.6, -194.0, -185.5] },
      { y: CHANNEL, box: [-62.4, -41.6, -184.0, -182.4], nav: false },
      { y: MID, box: [-72.8, -31.2, -166.0, -148.2] },
      { y: MID, box: [-55.0, -49.0, -172.0, -166.0] },
      ...GALLERIES6.map((b) => ({ y: GAL, box: b })),
    ],
  },
  stores6: { name: '도크 저장고', x0: -76, x1: -64, z0: -148, z1: -140, y0: -12, h: 3.6 },
  feed6: { name: '초소 4 — 서브베이 (CAM 2)', x0: 100, x1: 124, z0: 0, z1: 24, y0: 0, h: 12.0 },
};
export const ROOM_IDS6 = Object.keys(ROOMS6) as RoomId6[];

/** Air (interior clear space) of a room: its box inset by half a wall, floor … floor + h. */
export function airOf6(id: RoomId6): Box6 {
  const r = ROOMS6[id];
  return [r.x0 + HW, r.y0, r.z0 + HW, r.x1 - HW, r.y0 + r.h, r.z1 - HW];
}

/** Grid envelope (§2.1). */
export const ENVELOPE6: Box6 = [-80, -36, -226, 128, 13, 28];

// ───────────────────────────────────────────────────────────── non-room spaces and named boxes (§2.1, §3)

/** The sea behind the chamber's south wall (the viewport proxy; `G.void`). */
export const OUTSIDE6: Box6 = [-66, -24, -222, -38, -10, -196.4];
/** The well's water (ALWAYS forbidden, the hazard of `check:reach`). */
export const DEEP6: Box6 = [-58, -34, -182, -46, -20.3, -170];
/** The beach joint's inside (ALWAYS forbidden). */
export const ENCLOSURE6: Box6 = [-13.0, 0, -179.8, -11.0, 2.2, -178.8];
export const VOIDS6 = {
  vent6_rep: [5.6, 5.0, -84.4, 6.4, 5.8, -83.6] as Box6,
  vent6_vault: [-6.4, 6.0, -160.4, -5.6, 6.8, -159.6] as Box6,
};
/** §2.1 `trench`: the vault / head-end floors at y −1.4 … −0.05 (incl. the under-wall crossing at x 2.0). */
export const TRENCH6: Box6[] = [
  [-13.0, -1.5, -179.4, -11.8, -0.05, -158.0],
  [-11.8, -1.5, -179.4, 3.6, -0.05, -178.2],
  [2.0, -1.5, -178.2, 3.6, -0.05, -175.4],
];
/** Crouch-only part of the trench (under the gratings / floor plates — not the pits, not the stairs). */
export const TRENCH_LOW6: Box6[] = [
  [-13.0, -1.5, -179.4, -11.8, -0.05, -160.5],
  [-11.8, -1.5, -179.4, 2.2, -0.05, -178.2],
  [2.2, -1.5, -179.4, 3.6, -0.05, -177.7],
];
/** The two hatch pits (nav obstacles from load, 3c S1m) — the stairs under the lids. */
export const PIT_VAULT6: Box6 = [-13.0, -1.4, -160.4, -11.8, 1.0, -158.0];
export const PIT_HE6: Box6 = [2.4, -1.4, -177.6, 3.6, 1.0, -175.4];
/** The shut lids' stoppers over the exit stairs' upper treads (see `hatchLid`; W7's lids need the same). */
export const STOPPER_VAULT6: Box6 = [-13.0, -1.4, -159.85, -11.8, -0.02, -158.0];
export const STOPPER_HE6: Box6 = [2.4, -1.4, -177.05, 3.6, -0.02, -175.4];
export const CAGE6: Box6 = [-55.0, -16.0, -172.0, -49.0, -14.0, -166.0];
export const UNDERCROFT6: Box6 = [-72.8, -20.0, -166.0, -31.2, -16.3, -148.2];
/** The wet dock (wading region; `t6_wet`). */
export const WETDOCK6: Box6 = [-66.0, -21.6, -194.0, -38.0, -19.5, -182.4];
/** The shaft's closed well (D32): the column between the flights, guarded on every side. */
export const SHAFT_WELL6: Box6 = [-25.8, -12, -168.4, -24.2, 3.2, -164.4];

// ───────────────────────────────────────────────────────────── stairs (§2.6)

const st = (s: Omit<StairDef, 'room'> & { room: RoomId6 }): StairDef => ({ ...s, room: s.room as unknown as RoomId3 });
/** Trench exits (ship stairs, `nav: false`). */
/**
 * Trench exits (ship stairs, `nav: false`). W4a: treads 0.35 (not §2.6's 0.42; 38.7°) so each flight's foot stands 0.45 m
 * clear of the pit's south edge — with 0.42 the foot met the overhang (the grating / plate and the open lid's edge) on
 * the slope and a crouched body could not get under it into the trench (measured: stuck at y −1.02).
 */
export const STAIR6_T = st({ room: 'vault6', x0: -13.0, x1: -11.8, z0: -159.95, dir: 1, risers: 5, rise: 0.28, tread: 0.35, y0: -1.4, nav: false });
export const STAIR6_HE = st({ room: 'he6', x0: 2.4, x1: 3.6, z0: -177.15, dir: 1, risers: 5, rise: 0.28, tread: 0.35, y0: -1.4, nav: false });
/** The shaft's four flights (rise 0.3 × 10, tread 0.4, 36.9°). */
export const SHAFT_FLIGHTS6: StairDef[] = [
  st({ room: 'shaft6', x0: -27.8, x1: -25.8, z0: -164.4, dir: -1, risers: 10, rise: 0.3, tread: 0.4, y0: -3 }),  // F1 L1 → L0
  st({ room: 'shaft6', x0: -24.2, x1: -22.2, z0: -168.4, dir: 1, risers: 10, rise: 0.3, tread: 0.4, y0: -6 }),   // F2 L2 → L1
  st({ room: 'shaft6', x0: -27.8, x1: -25.8, z0: -164.4, dir: -1, risers: 10, rise: 0.3, tread: 0.4, y0: -9 }),  // F3 L3 → L2
  st({ room: 'shaft6', x0: -24.2, x1: -22.2, z0: -168.4, dir: 1, risers: 10, rise: 0.3, tread: 0.4, y0: -12 }),  // F4 bottom → L3
];
/** The chamber's four stairs (rise 0.2857 × 14 = 4.0, tread 0.4, run 5.6, 35.5°). */
export const ST6_NE = st({ room: 'pool6', x0: -35.0, x1: -33.2, z0: -152.0, dir: -1, risers: 14, rise: 0.2857, tread: 0.4, y0: MID });
export const ST6_W = st({ room: 'pool6', x0: -72.6, x1: -70.8, z0: -152.0, dir: -1, risers: 14, rise: 0.2857, tread: 0.4, y0: MID });
export const ST6_M = st({ room: 'pool6', x0: -72.0, x1: -70.0, z0: -171.6, dir: 1, risers: 14, rise: 0.2857, tread: 0.4, y0: DOCK });
export const ST6_M2 = st({ room: 'pool6', x0: -34.0, x1: -32.0, z0: -171.6, dir: 1, risers: 14, rise: 0.2857, tread: 0.4, y0: DOCK });
export const POOL_STAIRS6 = [ST6_NE, ST6_W, ST6_M, ST6_M2];

/** The sea-window pane (§2.6.9, §2.8): a glass collider in the south wall (z −196 ± 0.015). */
export const PANE6: Box6 = [-64, -19.6, -196.015, -40, -16.0, -195.985];

// ───────────────────────────────────────────────────────────── lights (§2.7.1) — placeholder tables

/** A placeholder light row (explicit world `bounds` where floors stack, a flicker mode). */
export interface LightRow6 {
  group: string; type: 'point' | 'spot'; p: XYZ; t?: XYZ; color: number; i: number; d: number; angle?: number;
  cast?: boolean; min?: Quality; prio?: number; off?: boolean; flicker?: FlickerMode;
  /** World box the light is confined to (S5: by floor). Absent = the room it sits in (unbounded in y). */
  bounds?: Box6;
}
const WARM = 0xffe2c0, COOL = 0xdce8ff, RED = 0xff2a18, AMBER = 0xffa020;
/** Room box ± 0.1, y limited (S5: a room's lights by floor). */
const rb = (id: RoomId6, y0: number, y1: number): Box6 => { const r = ROOMS6[id]; return [r.x0 - 0.1, y0, r.z0 - 0.1, r.x1 + 0.1, y1, r.z1 + 0.1]; };
const TRENCH_B: Box6 = [-13.1, -1.5, -179.5, 3.7, -0.04, -158.0];
const POOL_UP: Box6 = [-76.1, -19.95, -196.1, -27.9, 2.1, -147.9];

/**
 * §2.7.1. Group names the vignettes switch: `tun6_a_far` (z −56, −72; off at `tun6_far_out`) / `tun6_a_emerg` (on);
 * `shaft6` (the five landing lamps, `v6_shaft_lights`) / `shaft6_emerg`; `pool6` (the high-bays, off at `lights_out6`) /
 * `pool6_emerg` (on); `pool6_beacon` (from the hostile start); `pool6_uc` (the undercroft refuge, hard-wired, all
 * qualities); `pool6_frame` (the frame's work lamp); `feed6` (pinned by the feed pass only).
 */
export const LIGHTS6: Record<RoomId6, LightRow6[]> = {
  lock6: [{ group: 'lock6', type: 'point', p: [0, 2.65, 3.0], color: WARM, i: 9, d: 8 }],
  tun6_a: [
    ...[-8, -24, -40].map((z): LightRow6 => ({ group: 'tun6_a', type: 'point', p: [0, 3.6, z], color: COOL, i: 9, d: 14 })),
    ...[-56, -72].map((z): LightRow6 => ({ group: 'tun6_a_far', type: 'point', p: [0, 3.6, z], color: COOL, i: 9, d: 14 })),
    ...[-60, -76].map((z): LightRow6 => ({ group: 'tun6_a_emerg', type: 'point', p: [0, 3.5, z], color: RED, i: 2.5, d: 10, off: true })),
  ],
  rep6: [
    { group: 'rep6', type: 'point', p: [2.0, 4.6, -86.0], color: WARM, i: 12, d: 14 },
    { group: 'rep6', type: 'point', p: [11.0, 4.6, -86.0], color: WARM, i: 12, d: 14 },
    { group: 'rep6', type: 'point', p: [13.6, 1.9, -85.2], color: 0xfff0d0, i: 3, d: 4, min: 'medium', flicker: 'pulse' },
  ],
  tun6_b: [-100, -116, -132, -148].map((z): LightRow6 => ({ group: 'tun6_b', type: 'point', p: [12.0, 3.5, z], color: RED, i: 2.5, d: 11 })),
  bay6: [{ group: 'bay6', type: 'point', p: [17.5, 2.8, -102.0], color: WARM, i: 8, d: 8 }],
  he6: [
    { group: 'he6', type: 'point', p: [8.0, 4.2, -166.5], color: COOL, i: 12, d: 14, bounds: rb('he6', -0.02, 4.6) },
    { group: 'he6', type: 'point', p: [16.0, 4.2, -174.0], color: COOL, i: 12, d: 14, bounds: rb('he6', -0.02, 4.6) },
    { group: 'he6', type: 'point', p: [12.0, 4.2, -176.5], color: COOL, i: 6, d: 9, min: 'medium', bounds: rb('he6', -0.02, 4.6) },
  ],
  vault6: [
    { group: 'vault6', type: 'spot', p: [-12.0, 5.8, -152.0], t: [-18.5, 0, -160.0], color: COOL, i: 26, d: 16, angle: 0.8, cast: true, prio: 0.7, min: 'medium', bounds: rb('vault6', -0.02, 6.1) },
    { group: 'vault6', type: 'spot', p: [-8.0, 5.8, -170.0], t: [-12.0, 0.5, -179.0], color: COOL, i: 22, d: 14, angle: 0.8, cast: true, prio: 0.7, min: 'medium', bounds: rb('vault6', -0.02, 6.1) },
    { group: 'vault6', type: 'point', p: [-6.0, 5.6, -164.0], color: COOL, i: 10, d: 18, bounds: rb('vault6', -0.02, 6.1) },
    { group: 'trench6', type: 'point', p: [-12.4, -0.3, -170.0], color: RED, i: 1.8, d: 8, bounds: TRENCH_B },
    { group: 'trench6', type: 'point', p: [-4.0, -0.3, -178.8], color: RED, i: 1.8, d: 8, bounds: TRENCH_B },
  ],
  hold6: [{ group: 'hold6', type: 'point', p: [-15.0, 3.6, -144.0], color: WARM, i: 8, d: 10 }],
  shaft6: [
    { group: 'shaft6', type: 'point', p: [-27.7, 2.4, -170.6], color: WARM, i: 6, d: 8, bounds: rb('shaft6', -0.1, 3.3) },
    { group: 'shaft6', type: 'point', p: [-27.7, -0.6, -163.3], color: WARM, i: 6, d: 8, min: 'medium', bounds: rb('shaft6', -3.1, 0.0) },
    { group: 'shaft6', type: 'point', p: [-27.7, -3.6, -170.6], color: WARM, i: 6, d: 8, bounds: rb('shaft6', -6.1, -0.3) },
    { group: 'shaft6', type: 'point', p: [-27.7, -6.6, -163.3], color: WARM, i: 6, d: 8, min: 'medium', bounds: rb('shaft6', -9.1, -3.3) },
    { group: 'shaft6', type: 'point', p: [-27.7, -9.6, -166.0], color: WARM, i: 6, d: 9, bounds: rb('shaft6', -12.1, -6.3) },
    { group: 'shaft6_emerg', type: 'point', p: [-23.0, -3.9, -170.0], color: RED, i: 2.2, d: 7, off: true, bounds: rb('shaft6', -6.1, -0.3) },
    { group: 'shaft6_emerg', type: 'point', p: [-23.0, -9.9, -166.0], color: RED, i: 2.2, d: 7, off: true, bounds: rb('shaft6', -12.1, -6.3) },
  ],
  pool6: [
    { group: 'pool6', type: 'point', p: [-62, -2, -160], color: COOL, i: 60, d: 34, bounds: POOL_UP },
    { group: 'pool6', type: 'point', p: [-42, -2, -160], color: COOL, i: 60, d: 34, bounds: POOL_UP },
    { group: 'pool6', type: 'point', p: [-62, -2, -186], color: COOL, i: 60, d: 34, min: 'medium', bounds: POOL_UP },
    { group: 'pool6', type: 'point', p: [-42, -2, -186], color: COOL, i: 60, d: 34, min: 'medium', bounds: POOL_UP },
    { group: 'pool6_frame', type: 'spot', p: [-52, -13.8, -166.2], t: [-52, -16, -168.5], color: 0xfff0d8, i: 14, d: 8, angle: 0.9, cast: true, prio: 0.7, min: 'medium' },
    { group: 'pool6_uc', type: 'point', p: [-52, -16.7, -157.0], color: WARM, i: 6, d: 18, bounds: [-73, -20.1, -166.2, -31, -16.3, -148.1] },
    { group: 'pool6_beacon', type: 'point', p: [-52, -6, -148.6], color: AMBER, i: 10, d: 30, off: true, flicker: 'alarm' },
    { group: 'pool6_beacon', type: 'point', p: [-52, -6, -195.4], color: AMBER, i: 10, d: 30, off: true, flicker: 'alarm' },
    { group: 'pool6_emerg', type: 'point', p: [-73, -10, -150], color: RED, i: 4.5, d: 22, off: true },
    { group: 'pool6_emerg', type: 'point', p: [-31, -10, -194], color: RED, i: 4.5, d: 22, off: true },
  ],
  stores6: [{ group: 'stores6', type: 'point', p: [-70.0, -9.0, -144.0], color: WARM, i: 8, d: 9 }],
  feed6: [
    { group: 'feed6', type: 'point', p: [106, 6, 6], color: AMBER, i: 10, d: 20, off: true },
    { group: 'feed6', type: 'point', p: [118, 6, 6], color: AMBER, i: 10, d: 20, off: true },
    { group: 'feed6', type: 'point', p: [112, 6, 1.0], color: RED, i: 4, d: 10, off: true },
  ],
};

export function placeLights6(L: LevelBuild, rows: LightRow6[]) {
  return rows.map((r) => {
    const bounds = r.bounds ? box3(r.bounds) : undefined;
    const o = { cast: !!r.cast, priority: r.prio, enabled: !r.off, flicker: r.flicker, bounds };
    const h = r.type === 'spot'
      ? L.spot(r.group, r.p[0], r.p[1], r.p[2], r.t![0], r.t![1], r.t![2], r.color, r.i, r.d, r.angle ?? 0.9, o)
      : L.point(r.group, r.p[0], r.p[1], r.p[2], r.color, r.i, r.d, o);
    if (r.min) h.desc.minQuality = r.min;
    return h;
  });
}

// ───────────────────────────────────────────────────────────── helpers (copied from level 5, rule 9)

export const box3 = (b: readonly number[]) => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));

/** Stand-in block (material `grey_standin`) with a collider: the plan-dimensioned obstacles the dressing dresses. */
function stand(b: Builder, m: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: Surface = 'metal') {
  block(b, m, x0, y0, z0, x1, y1, z1, surface, true);
}
/**
 * Containment (W4b's hazard check, B1): the top of a rail / bar guard must not be a floor — a body on a 1.1 m rail's
 * flat top crouch-jumps onto a 2.4 m guard's top and walks along it to the well. A static collider's top is always
 * standable for the capsule (an apex too: the push-out from an edge points up), so the top 0.3 m of every rail / guard
 * is a NON-walkable dynamic box instead (as the containers, B2: a capsule cannot rest on one — it is pushed off
 * horizontally). The static MOVE-ONLY collider runs below it.
 */
const CAP = 0.3;
function moveOnlyCollider(L: LevelBuild, b: Builder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cap: boolean) {
  const capped = cap && y1 - y0 > CAP + 0.2;
  L.flagged('moveOnly', () => b.collide(x0, y0, z0, x1, capped ? y1 - CAP : y1, z1, 'metal', true));
  if (capped) {
    const pb = L.ctx.physics.addBox(box3([x0, y1 - CAP, z0, x1, y1, z1]), 'metal');
    pb.walkable = false;
    // (the band is in `L.solids` too: the dock's target test and the build-time checks see the whole guard)
    L.solids.push(box3([x0, y1 - CAP, z0, x1, y1, z1]));
  }
}
/** A MOVE-ONLY block (D14): bars, mesh, rails, tarp — bodies stop, rounds and sight pass. Nav obstacle. `cap` = see `CAP`. */
function guard(L: LevelBuild, b: Builder, m: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cap = true) {
  const e = 0.003; // (visual 3 mm inside the collider on every side: no face coplanar with the floor / wall / neighbour it touches)
  b.bx(m, x0 + e, y0 + e, z0 + e, x1 - e, y1 - e, z1 - e);
  moveOnlyCollider(L, b, x0, y0, z0, x1, y1, z1, cap);
}
/** The collider of a MOVE-ONLY guard without its greybox visual (a set piece draws it). */
function guardCollider(L: LevelBuild, b: Builder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cap = true) {
  moveOnlyCollider(L, b, x0, y0, z0, x1, y1, z1, cap);
}
/** Glass pane block (collider, surface glass). */
function pane(b: Builder, glass: Mat, bx: Box6) { block(b, glass, bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 'glass', true); }
/** A small shelf plate under a pickup (visual only). */
function shelf(b: Builder, m: Mat, x: number, y: number, z: number, w = 0.5, d = 0.35) { b.bx(m, x - w / 2, y - 0.06, z - d / 2, x + w / 2, y - 0.03, z + d / 2); }
/**
 * Guard rail (MOVE-ONLY collider, `h` tall from `y`): two bars and posts (D14). Rails 1.0 / 1.1 m are NOT containment
 * (a body can be jumped over them; §2.10 keeps every rail ≥ 10.3 m from the well).
 */
function rail(L: LevelBuild, b: Builder, m: Mat, x0: number, z0: number, x1: number, z1: number, y: number, h: number) {
  const alongX = x1 - x0 > z1 - z0;
  // (visual staggered against everything it touches — floors, walls, guards, its own posts: no coplanar faces, 3c lesson)
  const e = 0.003, t = 0.006;
  const [bx0, bx1, bz0, bz1] = alongX ? [x0 + e, x1 - e, z0 + t, z1 - t] : [x0 + t, x1 - t, z0 + e, z1 - e];
  b.bx(m, bx0, y + h - 0.05, bz0, bx1, y + h - e, bz1);
  b.bx(m, bx0, y + h * 0.5 - 0.025, bz0, bx1, y + h * 0.5 + 0.025, bz1);
  const len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.ceil(len / 1.4));
  for (let i = 0; i <= n; i++) {
    const u = (alongX ? x0 : z0) + (len * i) / n;
    const a0 = Math.min((alongX ? x1 : z1) - 0.05, Math.max((alongX ? x0 : z0) + e, u - 0.025)), a1 = a0 + 0.05 - e;
    if (alongX) b.bx(m, a0, y + e, z0 + e, a1, y + h - 0.052, z1 - e);
    else b.bx(m, x0 + e, y + e, a0, x1 - e, y + h - 0.052, a1);
  }
  moveOnlyCollider(L, b, x0, y, z0, x1, y + h, z1, true);
}
/** A rail run along x at z (on the slab edge: z … z + dz) or along z at x. */
const railX = (L: LevelBuild, b: Builder, m: Mat, x0: number, x1: number, z: number, y: number, h = 1.1, dz = 0.05) => rail(L, b, m, x0, Math.min(z, z + dz), x1, Math.max(z, z + dz), y, h);
const railZ = (L: LevelBuild, b: Builder, m: Mat, z0: number, z1: number, x: number, y: number, h = 1.1, dx = 0.05) => rail(L, b, m, Math.min(x, x + dx), z0, Math.max(x, x + dx), z1, y, h);
/** Carve the opening of a sealed prop through its wall (w × h, the wall's full thickness). */
function sealedOpening(G: GreyGrid, id: string, x: number, y: number, z: number, wall: 'x' | 'z', w: number, h: number, rooms: string[]) {
  const bx: Box6 = wall === 'z' ? [x - w / 2, y, z - HW, x + w / 2, y + h, z + HW] : [x - HW, y, z - w / 2, x + HW, y + h, z + w / 2];
  G.air(`door:${id}`, bx, { rooms, look: 'reveal' });
}
/**
 * A sloped walking slab (ramp / channel side): a 0.4 m box whose top face runs from (u0, y0) to (u1, y1) along `axis`,
 * across [c0, c1]. Collider built `nav = false` (as a stair's slope; nav links it through `navStair` where enemies may
 * walk it).
 */
function slope(b: Builder, m: Mat, axis: 'x' | 'z', u0: number, y0: number, u1: number, y1: number, c0: number, c1: number) {
  const du = u1 - u0, dy = y1 - y0, len = Math.hypot(du, dy), ang = Math.atan2(dy, du);
  const cu = (u0 + u1) / 2, cy = (y0 + y1) / 2, cc = (c0 + c1) / 2, w = Math.abs(c1 - c0);
  if (axis === 'x') b.push(cu, cy, cc, 0, 0, ang);
  else b.push(cc, cy, cu, 0, -ang, 0);
  const ext = 0.02;
  if (axis === 'x') b.bx(m, -len / 2 - ext, -0.4, -w / 2, len / 2 + ext, 0, w / 2).collide(-len / 2 - ext, -0.4, -w / 2, len / 2 + ext, 0, w / 2, 'metal', false);
  else b.bx(m, -w / 2, -0.4, -len / 2 - ext, w / 2, 0, len / 2 + ext).collide(-w / 2, -0.4, -len / 2 - ext, w / 2, 0, len / 2 + ext, 'metal', false);
  b.pop();
}
/**
 * A dynamic grille closing a void (vent in a ceiling, trench grille in a floor): mesh + physics box (walkable),
 * `L.objects[id]` with `userData.open(mode, snap?)` — 'drop' falls out of a ceiling, 'lift' rises out of a floor and lies
 * beside the opening — `userData.shut(snap?)` (a trench grille drops shut again, §2.6.7) and `userData.isOpen()`. A
 * registered mover (decals ride it). Level 5's `grillePanel` + `shut`.
 */
function grillePanel(L: LevelBuild, id: string, x0: number, z0: number, x1: number, z1: number, yBottom: number, mat: Mat, sound: string, rooms: string[]) {
  const part = L.part(`${id}:panel`);
  // (the visual panel stands 6 mm inside the opening's walls — never their planes; the collider fills it)
  part.bx(mat, x0 + 0.006, 0, z0 + 0.006, x1 - 0.006, 0.06, z1 - 0.006);
  const g = part.build();
  g.position.y = yBottom;
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
  const place = (mode: 'drop' | 'lift', k: number) => {
    if (mode === 'drop') { g.position.y = yBottom - 2.9 * k * k; g.rotation.x = 0.5 * k; g.visible = k < 1; }
    else { g.position.y = yBottom + 0.12 * Math.min(1, k * 3); g.position.x = 1.0 * Math.max(0, k * 1.5 - 0.5); }
  };
  g.userData.open = (mode: 'drop' | 'lift' = 'drop', snap = false) => {
    if (!pb.enabled) return;
    pb.enabled = false;
    if (snap) { place(mode, 1); return; }
    L.sfx(sound, (x0 + x1) / 2, yBottom, (z0 + z1) / 2, 0.8);
    L.tween(0, mode === 'drop' ? 0.55 : 0.7, (k) => place(mode, k));
  };
  g.userData.shut = (snap = false) => {
    if (pb.enabled) return;
    const fin = () => { g.position.set(0, yBottom, 0); g.rotation.set(0, 0, 0); g.visible = true; pb.enabled = true; };
    if (snap) { fin(); return; }
    L.tween(0, 0.3, (k) => { g.position.x *= 1 - k; }, () => { fin(); L.sfx('vent_grille', (x0 + x1) / 2, yBottom, (z0 + z1) / 2, 0.7); });
  };
}

/**
 * §2.6.6 / §2.6.7: GREYBOX PLACEHOLDER of a hatch lid hinged on its south (−z) edge (level 5's `hatchLid`, copied), with
 * the API of a set-piece lid: registered by `placeholders6` only when no set piece registered the id (`hatch6_vault` /
 * `hatch6_he`), so there is never a second lid or collider. Shut = a slab flush with the floor (y −0.08 … 0, walkable
 * dynamic box), open = standing up at the hinge (z0 − 0.08 … z0). `L.objects[id].userData`: `open(k)` (0 shut … 1 open,
 * instant), `k`, `box`, `dogs(k)` / `lamp(s)` (no-ops), `underside`. A registered mover.
 */
export function hatchLid(L: LevelBuild, id: string, x0: number, x1: number, zHinge: number, length: number, mat: Mat, rooms: string[], stopper?: Box6) {
  const T = 0.08;
  const pivot = new THREE.Group();
  pivot.name = id;
  pivot.position.set((x0 + x1) / 2, -T + 0.008, zHinge);
  pivot.userData.rooms = rooms;
  const part = L.part(`${id}:slab`);
  part.bx(mat, -(x1 - x0) / 2 + 0.006, 0, 0.006, (x1 - x0) / 2 - 0.006, T, length - 0.006);
  part.bx(mat, -0.25, T, length * 0.5 - 0.25, 0.25, T + 0.04, length * 0.5 + 0.25);
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
  // W4a (measured): a crouched body climbing the exit stair under the SHUT lid met the lid's box with its head, and a
  // dynamic box resolves horizontally only — it was shoved through the pit's side into the wall (out of the level). A
  // `stopper` (a dynamic box over the stair's upper treads, only while shut) meets him FRONT-on first and holds him
  // where his head stays under the lid.
  const sb = stopper ? L.ctx.physics.addBox(box3(stopper), 'metal') : null;
  if (sb) sb.owner = pivot;
  u.stopper = sb;
  u.open = (k: number) => {
    k = Math.min(1, Math.max(0, k));
    u.k = k;
    pivot.rotation.x = -(PI / 2) * k;
    pb.box.copy(k < 0.5 ? shutBox : openBox);
    pb.walkable = k < 0.5;
    if (sb) sb.enabled = k < 0.5;
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
 * R8 eye gate on an interactable (level 5's `eyeGate`, copied): enabled only while the player's eye satisfies the gate,
 * on top of whatever the story sets. `gate` is published on the interactable (`eyeGate`) so check-reach models it.
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

export interface ShellCtx6 { L: LevelBuild; G: GreyGrid; b: Builder; standin: Mat; glass: Mat; dark: Mat; yellow: Mat; grate: Mat; mesh: Mat }
type Shell = (s: ShellCtx6) => void;
const air = (G: GreyGrid, id: RoomId6) => G.air(id, airOf6(id), { rooms: [id], look: id as unknown as RoomId3 });
const airIn = (G: GreyGrid, name: string, bx: Box6, rooms: RoomId6[], look: RoomId6) => G.air(name, bx, { rooms, look: look as unknown as RoomId3 });
/** A named sub-builder of the current room (so dressing can find / hide a group of stand-ins). */
const sub = (L: LevelBuild, name: string, rooms: RoomId6[]) => { const b = L.builder(`grey6:${name}`); b.rooms = rooms; return b; };

/** Floor plates over a trench strip [x0, x1] × [z0, z1] (y −0.05 … 0), leaving `holes` [x0, x1, z0, z1] open. */
function plates(b: Builder, m: Mat, x0: number, x1: number, z0: number, z1: number, holes: [number, number, number, number][]) {
  // cut along z only (holes span less than the strip's width: plate the sides of each hole too)
  const hs = holes.slice().sort((a, c) => a[2] - c[2]);
  let z = z0;
  const put = (a0: number, a1: number, c0: number, c1: number) => {
    if (a1 - a0 < 1e-3 || c1 - c0 < 1e-3) return;
    b.bx(m, a0 + 0.01, -0.05, c0 + 0.01, a1 - 0.01, -0.004, c1 - 0.01).collide(a0, -0.05, c0, a1, 0, c1, 'metal', true);
  };
  for (const h of hs) {
    put(x0, x1, z, h[2]);
    put(x0, h[0], h[2], h[3]);
    put(h[1], x1, h[2], h[3]);
    z = h[3];
  }
  put(x0, x1, z, z1);
}

export const SHELLS6: Record<RoomId6, Shell> = {
  lock6: ({ L, G, b, standin, dark }) => {
    air(G, 'lock6');
    // door6_tunnel (0, 0, 6): 3c's tunnel door, this side — sealed (the way back is latched in 3c too)
    sealedOpening(G, 'door6_tunnel', 0, 0, 6, 'z', 1.6, 2.4, ['lock6']);
    sealedDoor(L, b, {
      id: 'door6_tunnel', x: 0, y: 0, z: 6, wall: 'z', kind: 'std', sides: 'back', leafMat: 'navy_grey', labelBack: '트렁크 터널',
      panel: { text: '트렁크 터널 — 밀봉됨 — 함장 해제', side: 'back' },
    });
    // the cable transit beside d6_tube (in the south wall) and the trays (start at y 2.0)
    b.bx(dark, -2.7, 2.0, 0.2, -2.0, 2.6, 0.32);
    b.bx(dark, -3.8, 2.0, 0.2, -3.6, 2.06, 5.8);
    b.bx(dark, 3.6, 2.0, 0.2, 3.8, 2.06, 5.8);
    b.sign('트렁크 — 헤드엔드 200 M', 'stencil', -3.79, 1.5, 3.0, 1.8, 0.2, '+x');
    // `tube_panel6` (§6.4) beside the tube door, lock side — the tube line's source `mk6_tube_panel`
    L.screen('tube_panel6', 'terminal_idle', 0.5, 0.3, 1.2, 1.4, 0.22, '+z', { text: '헤드엔드 튜브 — 순환 중' });
    L.marker('mk6_tube_panel', 1.2, 1.4, 0.22, 0);
    shelf(b, standin, 3.4, 1.0, 1.2, 0.4, 0.4);
    L.marker('mk6_start', 0, 0, 3.0, 0);
    roomLabel(b, '헤드엔드 튜브', 3.8, 2.4, 3.0, '-x', 2.4);
  },

  tun6_a: ({ L, G, b, standin, dark }) => {
    air(G, 'tun6_a');
    // the far end opens into rep6 through the full tunnel width (no door)
    airIn(G, 'open:tun6_a+rep6', [-2.3, 0, -80.2, 2.3, 4.0, -79.8], ['tun6_a', 'rep6'], 'tun6_a');
    // structural rings every 16 m (jambs 0.3 m proud: colliders; headers visual)
    for (const z of [-16, -32, -48, -64]) {
      stand(b, standin, -2.3, 0, z - 0.2, -2.0, 3.4, z + 0.2, 'concrete');
      stand(b, standin, 2.0, 0, z - 0.2, 2.3, 3.4, z + 0.2, 'concrete');
      b.bx(standin, -2.3, 3.4, z - 0.2, 2.3, 4.0, z + 0.2);
    }
    // cover (§2.6.2): junction boxes (h 1.8, high) and drum trolleys (h 1.3, low)
    const jb = sub(L, 'tun6_a_cover', ['tun6_a']);
    stand(jb, standin, -2.3, 0, -24.8, -1.4, 1.8, -23.2);   // JB1
    stand(jb, standin, 1.4, 0, -40.8, 2.3, 1.8, -39.2);     // JB2
    stand(jb, standin, -2.3, 0, -56.8, -1.4, 1.8, -55.2);   // JB3
    stand(jb, standin, 1.4, 0, -70.8, 2.3, 1.8, -69.2);     // JB4
    stand(jb, dark, 0.4, 0, -30.5, 2.0, 1.3, -29.5);        // DT1
    stand(jb, dark, -2.0, 0, -62.5, -0.4, 1.3, -61.5);      // DT2
    // bracket shelves on the JBs' corridor faces at y 1.0 (S1b)
    shelf(b, standin, -1.25, 1.0, -24.0, 0.3, 0.4);
    shelf(b, standin, 1.25, 1.0, -40.0, 0.3, 0.4);
    shelf(b, standin, -1.25, 1.0, -56.0, 0.3, 0.4);
    // trays (y 2.0 / 2.6 west, the trunk on the east tray at 2.2) — the body corridor is the full width up to 2.0
    b.bx(dark, -2.3, 2.0, -79.8, -2.05, 2.05, -0.2).bx(dark, 2.05, 2.0, -79.8, 2.3, 2.05, -0.2);
    b.bx('painted_yellow', 2.08, 2.07, -79.8, 2.28, 2.3, -0.2);
    roomLabel(b, '케이블 터널 — 1구간', -2.3, 2.6, -6.0, '+x', 3.0);
  },

  rep6: ({ L, G, b, standin, dark, mesh }) => {
    air(G, 'rep6');
    airIn(G, 'open:rep6+tun6_b', [9.7, 0, -92.2, 14.3, 4.0, -91.8], ['rep6', 'tun6_b'], 'rep6');
    const cv = sub(L, 'rep6_cover', ['rep6']);
    stand(cv, dark, -5.8, 0, -91.0, -4.6, 2.2, -83.0);      // RB repeater bank
    stand(cv, standin, 9.0, 0, -83.0, 11.6, 2.6, -81.6);    // DS1
    stand(cv, standin, -2.0, 0, -90.4, 0.6, 2.6, -89.0);    // DS2
    stand(cv, standin, 5.0, 0, -89.6, 6.4, 1.2, -88.4);     // LC1
    stand(cv, standin, 7.0, 0, -82.8, 8.2, 1.2, -81.6);     // LC2
    // the jointer's tent x 12.4 … 14.8, h 2.2, open north side: tarp walls + roof MOVE-ONLY (D14). W4a: 0.8 m further
    // south than §2.6.3 (z −86.4 … −84.0, not −85.6 … −83.2): at the plan's place it closed, with DS1 (south face −83.0,
    // 0.2 m away) and the walls, the pocket north of it — no nav node, and the job card behind a 0.8 m diagonal gap
    const tent = sub(L, 'rep6_tent', ['rep6']);
    guard(L, tent, mesh, 12.4, 0, -86.4, 12.45, 2.2, -84.0);
    guard(L, tent, mesh, 14.75, 0, -86.4, 14.8, 2.2, -84.0);
    guard(L, tent, mesh, 12.4, 0, -86.4, 14.8, 2.2, -86.35);
    guard(L, tent, mesh, 12.4, 2.15, -86.4, 14.8, 2.2, -84.0, false);
    stand(tent, standin, 13.0, 0, -86.1, 14.4, 0.85, -85.3); // splicing table
    // the job card on the pole at the open north side (§6.3): use point 0.45 m off it
    b.bx(dark, 13.55, 0, -84.0, 13.65, 2.2, -83.9);
    L.interact('note6_jobcard', 'log', '카드 읽기', 13.6, 1.4, -83.45, true, 1.6);
    // equipment shelf (east wall), first-aid box (west wall)
    shelf(b, standin, 15.6, 1.0, -89.0, 0.4, 2.0);
    b.bx('painted_white', -5.8, 0.75, -82.3, -5.55, 1.0, -81.7);
    // the ceiling vent (6.0, 5.0, −84.0): a void above the ceiling closed by a grille
    airIn(G, 'rep6', VOIDS6.vent6_rep, ['rep6'], 'rep6');
    grillePanel(L, 'vent6_rep_grille', 5.6, -84.4, 6.4, -83.6, 5.0, standin, 'vent_grille', ['rep6']);
    L.marker('mk6_vent_rep', 6.0, 5.0, -84.0, 0);
    // F1 / F2 markers (§4.2, §4.3)
    L.marker('mk6_tun_s1', 10.0, 0, -86.0, PI / 2);
    L.marker('mk6_tun_s2', 12.0, 0, -87.5, PI / 2);
    L.marker('mk6_cross_0', 10.0, 0, -86.0, PI / 2);
    L.marker('mk6_cross_1', -3.0, 0, -86.0, PI / 2);
    L.marker('mk6_tun_u1', -1.2, 0, -91.3, PI);
    L.marker('mk6_tun_u2', 0.0, 0, -91.3, PI);
    b.sign('중계기 2 — 1.1 KM', 'stencil', -4.2, 3.2, -80.22, 2.2, 0.24, '-z');
    b.sign('헤드엔드 ↓', 'stencil', 3.4, 3.2, -80.22, 1.4, 0.24, '-z');
    roomLabel(b, '중계기 2', -5.8, 3.0, -81.0, '+x', 2.4);
  },

  tun6_b: ({ L, G, b, standin, dark }) => {
    air(G, 'tun6_b');
    const cv = sub(L, 'tun6_b_cover', ['tun6_b']);
    stand(cv, dark, 9.7, 0, -110, 11.1, 2.0, -108);    // RH1
    stand(cv, dark, 12.9, 0, -126, 14.3, 2.0, -124);   // RH2
    stand(cv, dark, 9.7, 0, -142, 11.1, 2.0, -140);    // RH3
    shelf(b, standin, 12.75, 1.0, -125.0, 0.3, 0.4);
    shelf(b, standin, 11.25, 1.0, -141.0, 0.3, 0.4);
    b.bx(dark, 9.7, 2.0, -159.8, 9.95, 2.05, -92.2);
    // (the east tray and the trunk break round d6_bay's opening, z −103.8 … −100.2)
    for (const [z0, z1] of [[-159.8, -103.8], [-100.2, -92.2]] as const) b.bx(dark, 14.05, 2.0, z0, 14.3, 2.05, z1).bx('painted_yellow', 14.08, 2.07, z0, 14.28, 2.3, z1);
    // the sentry dock in the ceiling (12.0, 3.9, −134.0) — visual
    b.bx(dark, 11.6, 3.94, -134.4, 12.4, 4.0, -133.6);
    L.marker('mk6_sentry', 12.0, 3.9, -134.0, 0);
    L.marker('mk6_rep_s', 10.2, 0, -111.6, PI);
    L.marker('mk6_tunb_hold', 12.0, 0, -153.0, PI);
    roomLabel(b, '케이블 터널 — 2구간', 9.7, 2.6, -96.0, '+x', 3.0);
  },

  bay6: ({ L, G, b, standin }) => {
    air(G, 'bay6');
    stand(b, standin, 16.0, 0, -103.0, 18.0, 1.2, -101.0);  // the joint box on trestles
    // (the joint box stands 1.5 m inside `d6_bay`: the grid's first column falls in the jamb's margin, so no grid node
    //  links the door to the bay — a column of nodes in the gap between the door and the box)
    for (const z of [-103.5, -102.0, -100.5]) L.navNode(15.15, z, 'bay6', 0);
    shelf(b, standin, 20.1, 1.0, -104.0, 0.4, 2.0);
    L.marker('mk6_bay_u1', 16.0, 0, -99.6, PI / 2);
    L.marker('mk6_bay_u2', 18.6, 0, -99.6, PI / 2);
    roomLabel(b, '조인트 베이 2', 20.3, 2.3, -102.0, '-x', 2.2);
  },

  he6: ({ L, G, b, standin, dark, grate }) => {
    air(G, 'he6');
    // ── the trench's end T-c (y −1.4, 1.35 m clear) and the under-wall crossing from T-b (x 1.8 … 2.2, below the
    //    wall's foot: its ceiling −0.05, the wall stays solid above — 3c's crawl-under-a-wall, as a grid air box over
    //    both rooms) ──
    // (the pit x 2.4 … 3.6 only: a 0.2 m slot between the stair and the west wall let a body be pushed into the wall)
    airIn(G, 'trench6_he', [2.2, -1.4, -179.4, 3.6, 0, -177.6], ['he6'], 'he6');
    airIn(G, 'trench6_he', [2.4, -1.4, -177.6, 3.6, 0, -175.4], ['he6'], 'he6');
    airIn(G, 'trenchx6', [1.8, -1.4, -179.4, 2.2, -0.05, -178.2], ['he6', 'vault6'], 'he6');
    // floor plates over T-c (raised tiles), the pit x 2.4 … 3.6, z −177.6 … −175.4 left open for the lid
    plates(b, grate, 2.2, 3.6, -179.4, -177.6, []);
    buildStair(L, b, STAIR6_HE, standin, false);
    // rails 1.0 m on the pit's east (x 3.6) and south (z −177.6) sides; the west wall is 0.2 m away; exit north
    railZ(L, b, dark, -177.6, -175.4, 3.6, 0, 1.0);
    railX(L, b, dark, 2.2, 3.65, -177.65, 0, 1.0);
    b.sign('트렌치 — 아래에서 잠김 — 볼트로 출입', 'stencil', 3.0, 0.72, -177.66, 1.1, 0.16, '-z');
    const lidShut = () => !(lidK(L, 'hatch6_he') > 0);
    // underside interact: use point on the lid underside, usable only with the eye below y −0.2 while the lid is shut
    eyeGate(L.ctx, L.interact('hatch6_he', 'hatch', '해치 열기', 3.0, -0.08, -177.3, true, 1.6), { axis: 'y', max: -0.2 }, lidShut);
    const plate = L.interact('hatch6_he_plate', 'hatch', '해치가 아래에서 잠겨 있다', 3.0, 0.05, -176.4, true, 1.6);
    plate.onUse = () => L.ctx.events.emit('story:toast', { text: '해치가 아래에서 잠겨 있다' });
    eyeGate(L.ctx, plate, { axis: 'y', min: -0.2 }, lidShut);
    L.marker('mk6_exit_he', ...EXIT_HE, 0);
    // ── racks R1 / R2 (h 2.2), the console (desk h 1.0) and the mimic board above it ──
    const cv = sub(L, 'he6_cover', ['he6']);
    stand(cv, dark, 5, 0, -164.6, 15, 2.2, -164.0);     // R1
    stand(cv, dark, 5, 0, -169.6, 15, 2.2, -169.0);     // R2
    stand(cv, standin, 8, 0, -179.8, 16, 1.0, -178.8);  // console desk
    L.screen('mimic6', 'mimic', 10.0, 2.0, 12.0, 2.6, -179.78, '+z', { text: '헤드엔드 — 볼트 (비치 조인트) — 수면 2.1 KM\n문풀 — 테더 — 음향 부이: 대기\n모드: 자동' });
    // the outbound queue screen on the console (§6.3) — interactable at its use point
    b.bx(dark, 8.6, 1.0, -179.3, 9.4, 1.05, -179.0);
    L.screen('queue6', 'manifest', 0.6, 0.4, 9.0, 1.25, -179.0, '+z', { text: '헤드엔드 — 발신 대기열' });
    L.marker('mk6_queue', 9.0, 1.25, -179.0, 0);
    L.interact('note6_queue', 'terminal', '대기열 읽기', 9.0, 1.25, -178.4, true, 1.3);
    // ── the changeover switch SW (east wall x 21.0 … 21.8, z −172 … −170, h 2.0): crank on its west face ──
    switch6(L, b);   // W7's set piece: cabinet (+ its collider), crank, Castell barrel, the `switch6` screen
    L.marker('mk6_switch', 20.95, 1.2, -171.0, -PI / 2);
    L.interact('he6_switch', 'lever', '수동으로 전환', 20.5, 1.2, -171.0, true, 1.3);
    // ── the phone station (east wall), its handset hanging off the hook ──
    phone6(L, b);    // W7's set piece: station, howler, the handset on its cord
    L.marker('mk6_phone', 21.78, 1.4, -164.0, -PI / 2);
    L.marker('mk6_handset', 21.55, 0.85, -164.3, 0);
    L.interact('he6_phone', 'phone', '수화기 들기', 21.2, 1.1, -164.0, false, 1.5);
    // ── the wall locker NW (door open: back, sides, top — the vest hangs in its open front) ──
    stand(b, standin, 2.4, 0, -160.45, 4.0, 2.0, -160.2);
    stand(b, standin, 2.4, 0, -160.8, 2.45, 2.0, -160.45);
    stand(b, standin, 3.95, 0, -160.8, 4.0, 2.0, -160.45);
    stand(b, standin, 2.45, 1.95, -160.8, 3.95, 2.0, -160.45);
    // shelves: west wall (x 2.2 … 2.6, z −173 … −171, y 1.0), first-aid box (east wall)
    shelf(b, standin, 2.4, 1.0, -172.0, 0.4, 2.0);
    b.bx('painted_white', 21.55, 0.75, -176.3, 21.8, 1.0, -175.7);
    // F3's soldier spawns here (2 m clear of R1's north face, S1a)
    L.marker('mk6_he_s', 12.0, 0, -162.0, PI);
    roomLabel(b, '트렁크 헤드엔드', 2.2, 3.0, -163.0, '+x', 2.6);
  },

  vault6: ({ L, G, b, standin, dark, grate }) => {
    air(G, 'vault6');
    // ── the cable trench (3c crawl mechanism): T-a (x −13 … −11.8) and T-b (z −179.4 … −178.2) at y −1.4 ──
    airIn(G, 'trench6_vault', [-13.0, -1.4, -179.4, -11.8, 0, -158.0], ['vault6'], 'vault6');
    airIn(G, 'trench6_vault', [-11.8, -1.4, -179.4, 1.8, 0, -178.2], ['vault6'], 'vault6');
    // gratings (flush, colliding: bodies, rounds and sight stop on them) with the three grille holes; the pit open
    const G1: [number, number, number, number] = [-12.8, -12.0, -174.4, -173.6];
    const G2: [number, number, number, number] = [-12.8, -12.0, -164.4, -163.6];
    plates(b, grate, -13.0, -11.8, -179.4, -160.4, [G1, G2]);
    // T-b: along x (cut by the G3 hole x −6.4 … −5.6, z −179.2 … −178.4)
    b.bx(grate, -11.79, -0.05, -179.39, -6.41, -0.004, -178.21).collide(-11.8, -0.05, -179.4, -6.4, 0, -178.2, 'metal', true);
    b.bx(grate, -5.59, -0.05, -179.39, 1.79, -0.004, -178.21).collide(-5.6, -0.05, -179.4, 1.8, 0, -178.2, 'metal', true);
    b.bx(grate, -6.39, -0.05, -179.39, -5.61, -0.004, -179.21).collide(-6.4, -0.05, -179.4, -5.6, 0, -179.2, 'metal', true);
    b.bx(grate, -6.39, -0.05, -178.39, -5.61, -0.004, -178.21).collide(-6.4, -0.05, -178.4, -5.6, 0, -178.2, 'metal', true);
    for (const [id, x, z] of [['grille6_1', -12.4, -174.0], ['grille6_2', -12.4, -164.0], ['grille6_3', -6.0, -178.8]] as const) {
      grillePanel(L, id, x - 0.4, z - 0.4, x + 0.4, z + 0.4, -0.06, standin, 'sump_lift', ['vault6']);
    }
    L.marker('mk6_grille_1', -12.4, 0, -174.0, 0);
    L.marker('mk6_grille_2', -12.4, 0, -164.0, 0);
    L.marker('mk6_grille_3', -6.0, 0, -178.8, 0);
    // the pit's ship stair (z −159.95 → −158.2, y −1.4 → 0; its top meets the floor edge z −158.0, the exit north)
    buildStair(L, b, STAIR6_T, standin, false);
    railZ(L, b, dark, -160.4, -158.0, -13.05, 0, 1.0);
    railZ(L, b, dark, -160.4, -158.0, -11.8, 0, 1.0);
    railX(L, b, dark, -13.05, -11.75, -160.45, 0, 1.0);
    b.sign('케이블 트렌치 — 헤드엔드 방향 — 웅크리기', 'stencil', -12.4, 0.72, -160.39, 1.1, 0.16, '+z');
    L.interact('hatch6_vault', 'hatch', '해치 열기', -12.4, 0.3, -157.5, true, 1.4);
    L.marker('mk6_exit_vault', ...EXIT_VAULT, 0);
    // ── cable drums CD1 … CD3 (Ø 4.0 on stands, h 4.4) ──
    const cv = sub(L, 'vault6_cover', ['vault6']);
    stand(cv, standin, -20.5, 0, -158.2, -16.5, 4.4, -155.8);  // CD1
    stand(cv, standin, -20.5, 0, -164.2, -16.5, 4.4, -161.8);  // CD2 (v6_drum)
    stand(cv, standin, -20.5, 0, -152.2, -16.5, 4.4, -149.8);  // CD3
    L.marker('mk6_drum', -18.5, 2.2, -163.0, 0);
    // ── the beach joint enclosure BJ (x −13.2 … −10.8, z −179.8 … −178.6, h 2.2): body + the loom rack inside; the
    //    bi-parting doors are movers (W7's `bj6`, or the placeholder) ──
    // W7's set piece: walls, roof, the joint housing (to y 1.05: the enclosure region cannot be entered), the sliding
    // leaves (movers + dynamic boxes), the loom, the `bj6` screen
    beachJoint6(L, b);
    L.marker('mk6_bj', -12.0, 1.2, -178.55, 0);
    L.marker('mk6_loom', -12.0, 1.1, -179.0, 0);
    L.interact('vault6_lock', 'lock', '키 A 삽입', -12.0, 1.2, -178.1, true, 1.3);
    L.interact('vault6_loom', 'lever', '광케이블 당기기', -12.0, 1.1, -178.75, false, 1.3);
    // ── the sea cable penetrator (south wall) and its dark port; dehumidifiers, nitrogen rack, shelves ──
    b.cyl(dark, -8.0, 1.0, -179.7, 0.6, 0.2, 'z', 14);
    stand(cv, standin, -6.0, 0, -149.0, -4.0, 2.0, -148.2);   // DH1
    stand(cv, standin, -2.0, 0, -149.0, 0.0, 2.0, -148.2);    // DH2
    stand(cv, standin, -4.0, 0, -152.0, -2.0, 1.8, -150.8);   // NR
    shelf(b, standin, -3.0, 1.0, -150.65, 0.5, 0.3);
    shelf(b, standin, 1.6, 1.0, -150.5, 0.4, 2.4);
    // ── the ceiling vent (−6.0, 6.0, −160.0) ──
    airIn(G, 'vault6', VOIDS6.vent6_vault, ['vault6'], 'vault6');
    grillePanel(L, 'vent6_vault_grille', -6.4, -160.4, -5.6, -159.6, 6.0, standin, 'vent_grille', ['vault6']);
    L.marker('mk6_vent_vault', -6.0, 6.0, -160.0, 0);
    // ── the stair door's interlock (vault side only: feet in vault6) ──
    shaftLock6(L, b);   // W7's set piece: panel, barrel, the `shaft6_panel` screen
    L.marker('mk6_shaft_lock', -21.78, 1.3, -167.6, PI / 2);
    L.interact('shaft6_lock', 'lock', '인터록 — 키 B', -21.3, 1.3, -167.6, true, 1.3, { requireRegion: 'vault6' });
    // the reward at the T-a / T-b corner: M. Lie's notebook on a cable bracket (§6.3)
    b.bx(dark, -12.99, -1.0, -176.6, -12.9, -0.95, -176.2);
    L.interact('note6_jointer', 'log', '노트 읽기', -12.4, -0.9, -176.4, true, 1.3);
    // F4 / F5 spawn markers (hold6, north of d6_hold)
    L.marker('mk6_hold_1', -16.0, 0, -143.0, 0);
    L.marker('mk6_hold_2', -19.0, 0, -144.0, 0);
    L.marker('mk6_hold_3', -13.0, 0, -144.0, 0);
    roomLabel(b, '케이블 볼트 — 건조 유지', 1.8, 3.0, -160.0, '-x', 3.0);
  },

  hold6: ({ G, b }) => {
    air(G, 'hold6');
    roomLabel(b, '케이블 저장고', -8.2, 2.6, -144.0, '-x', 2.2);
  },

  shaft6: ({ L, G, b, standin, mesh, dark }) => {
    air(G, 'shaft6');
    // landings (0.3 m slabs: 5.7 m clear under each)
    for (const l of Object.values(LANDINGS6)) {
      const [x0, x1, z0, z1] = l.box;
      stand(b, standin, x0, l.y - SLAB, z0, x1, l.y, z1);
    }
    for (const f of SHAFT_FLIGHTS6) buildStair(L, b, f, standin, false);
    // the closed well (D32): MOVE-ONLY mesh guards on every side of the column between the flights, full height (no
    // drop anywhere; the look down the well stays — rays pass), and over L0's open north edge on the east half (6 m over
    // F2's foot). (L2's east-half north edge is F2's foot — a guard there would close the route; see the W4a notes.)
    const wg = sub(L, 'shaft6_guards', ['shaft6']);
    const [wx0, wy0, wz0, wx1, wy1, wz1] = SHAFT_WELL6;
    guard(L, wg, mesh, wx0 - 0.03, wy0, wz0, wx0 + 0.02, wy1, wz1, false);
    guard(L, wg, mesh, wx1 - 0.02, wy0, wz0, wx1 + 0.03, wy1, wz1, false);
    guard(L, wg, mesh, wx0, wy0, wz0 - 0.03, wx1, wy1, wz0 + 0.02, false);
    guard(L, wg, mesh, wx0, wy0, wz1 - 0.02, wx1, wy1, wz1 + 0.03, false);
    guard(L, wg, mesh, -24.2, 0, -168.43, -22.2, 2.4, -168.38);
    // a fire-point cabinet on the east wall at L2 (p6_shaft_ammo on its shelf), a box at the bottom south-west
    // (open front: back, sides, top — the pickup sits on its shelf inside, 0.2 m behind the face x −22.6)
    stand(b, dark, -22.3, -6, -171.6, -22.2, -4.6, -170.6);
    stand(b, dark, -22.6, -6, -171.6, -22.3, -4.6, -171.55);
    stand(b, dark, -22.6, -6, -170.65, -22.3, -4.6, -170.6);
    stand(b, dark, -22.6, -4.65, -171.55, -22.3, -4.6, -170.65);
    shelf(b, standin, -22.45, -5.0, -171.1, 0.3, 0.9);
    stand(b, standin, -27.8, -12, -171.8, -27.0, -11.2, -171.0);
    // landing lamps (the ones that die) and F6 / W3 markers
    L.marker('mk6_ll0', -27.7, 2.4, -170.6, 0);
    L.marker('mk6_ll1', -27.7, -0.6, -163.3, 0);
    L.marker('mk6_ll2', -27.7, -3.6, -170.6, 0);
    L.marker('mk6_ll3', -27.7, -6.6, -163.3, 0);
    L.marker('mk6_llb', -27.7, -9.6, -166.0, 0);
    L.marker('mk6_shaft_u', -26.8, -12, -162.8, PI);
    L.marker('mk6_w3_a', -24.0, -12, -163.4, PI / 2);
    L.marker('mk6_w3_b', -26.6, -12, -163.4, PI / 2);
    L.marker('mk6_w3_u', -26.8, -12, -170.8, PI / 2);
    roomLabel(b, '문풀 ↓', -22.2, 1.8, -165.5, '-x', 2.2);
  },

  pool6: ({ L, G, b, standin, glass, dark, yellow, grate, mesh }) => {
    air(G, 'pool6');
    // ── the wet dock (recessed: flat floor −20.8, ramps W / E from −20.0, the sluice channel −21.3 with a sloped south
    //    side) ──
    airIn(G, 'pool6', [-66.0, WET, -194.0, -38.0, DOCK, -182.4], ['pool6'], 'pool6');
    airIn(G, 'pool6', [-62.4, CHANNEL, -185.5, -41.6, WET, -182.4], ['pool6'], 'pool6');
    const wd = sub(L, 'pool6_wetdock', ['pool6']);
    slope(wd, standin, 'x', -66.0, DOCK, -62.4, WET, -194.0, -182.4);
    slope(wd, standin, 'x', -41.6, WET, -38.0, DOCK, -194.0, -182.4);
    slope(wd, standin, 'z', -185.5, WET, -184.0, CHANNEL, -62.4, -41.6);
    // enemies walk the ramps (nav links the wet floor to the dock through them; the channel's slope is not nav: > 0.6 m)
    // (the nav stairs are as wide as the slabs, z −194 … −182.4: a body anywhere on a ramp stands on a declared floor)
    L.navStair('pool6', [-62.4, WET, -188.2], [-66.0, DOCK, -188.2], 11.6);
    L.navStair('pool6', [-41.6, WET, -188.2], [-38.0, DOCK, -188.2], 11.6);
    // ── the well: 12 × 12 m opening down to the cargo lock's inner door (y −34) ──
    airIn(G, 'pool6', [-58, -34, -182, -46, DOCK, -170], ['pool6'], 'pool6');
    // the coaming (0.4 m, top −19.2, solid: stops rounds) and the 1.6 m vertical-bar guard flush with its outer face
    // (MOVE-ONLY, top −17.6 = 2.4 m above the dock — B1); ladder gates are part of the guard (W7 draws them)
    const cm = sub(L, 'pool6_coaming', ['pool6']);
    stand(cm, yellow, -58.4, DOCK, -170.0, -45.6, -19.2, -169.6);
    stand(cm, yellow, -58.4, DOCK, -182.4, -45.6, -19.2, -182.0);
    stand(cm, yellow, -58.4, DOCK, -182.0, -58.0, -19.2, -170.0);
    stand(cm, yellow, -46.0, DOCK, -182.0, -45.6, -19.2, -170.0);
    const bg = sub(L, 'pool6_guard_well', ['pool6']);
    guard(L, bg, mesh, -58.4, -19.2, -169.65, -45.6, -17.6, -169.6);
    guard(L, bg, mesh, -58.4, -19.2, -182.4, -45.6, -17.6, -182.35);
    guard(L, bg, mesh, -58.4, -19.2, -182.35, -58.35, -17.6, -169.65);
    guard(L, bg, mesh, -45.65, -19.2, -182.35, -45.6, -17.6, -169.65);
    well6(L, b);   // W7's set piece: the ladders `ladder6_w/e` + gates in the guard, exit rungs, the inner lock door, sluice ports
    L.marker('mk6_ladder_w', -57.75, -19.2, -176.0, PI / 2);
    L.marker('mk6_ladder_e', -46.25, -19.2, -176.0, -PI / 2);
    L.marker('mk6_lw_exit', -59.3, DOCK, -176.0, PI / 2);
    L.marker('mk6_le_exit', -44.7, DOCK, -176.0, -PI / 2);
    // ── the mid deck (y −16, 0.3 slab) + the cage cantilever; galleries (y −12, 0.3 slabs) ──
    const dk = sub(L, 'pool6_decks', ['pool6']);
    stand(dk, standin, -72.8, MID - SLAB, -166.0, -31.2, MID, -148.2);
    stand(dk, standin, -55.0, MID - SLAB, -172.0, -49.0, MID, -166.0);
    for (const [x0, x1, z0, z1] of GALLERIES6) stand(dk, standin, x0, GAL - SLAB, z0, x1, GAL, z1);
    for (const s of POOL_STAIRS6) buildStair(L, dk, s, standin, false);
    // ── edges of the mid deck: south — 1.1 m rails beside the stair heads, the 2.4 m bar guard (MOVE-ONLY) x −68 … −55
    //    and −49 … −36, the cage between; east / west — 1.1 m rails (the drop to the dock under the side galleries) ──
    const ed = sub(L, 'pool6_rails', ['pool6']);
    for (const [x0, x1] of [[-72.8, -72.0], [-70.0, -68.0], [-36.0, -34.0], [-32.0, -31.2]] as const) railX(L, ed, dark, x0, x1, -166.0, MID, 1.1);
    const mg = sub(L, 'pool6_guard_mid', ['pool6']);
    guard(L, mg, mesh, -68.0, MID, -166.0, -55.0, MID + 2.4, -165.95);
    guard(L, mg, mesh, -49.0, MID, -166.0, -36.0, MID + 2.4, -165.95);
    railZ(L, ed, dark, -166.0, -148.2, -31.25, MID, 1.1);
    railZ(L, ed, dark, -166.0, -148.2, -72.8, MID, 1.1);
    // ── the cage (MOVE-ONLY bars 2.6 m on W, E, S, a bar roof at −13.4; north side open x −53 … −51) ──
    const cg = sub(L, 'pool6_cage', ['pool6']);
    guardCollider(L, cg, -55.0, MID, -172.0, -54.95, -13.4, -166.0);
    guardCollider(L, cg, -49.05, MID, -172.0, -49.0, -13.4, -166.0);
    guardCollider(L, cg, -55.0, MID, -172.0, -49.0, -13.4, -171.95);
    guardCollider(L, cg, -55.0, -13.45, -172.0, -49.0, -13.4, -166.0, false);
    guardCollider(L, cg, -55.0, MID, -166.05, -53.0, -13.4, -166.0);
    guardCollider(L, cg, -51.0, MID, -166.05, -49.0, -13.4, -166.0);
    // the frame inside the cage: shear SH on the trough, hand pump PS, firing lever LV, a box with the cage pickups
    const fr = sub(L, 'pool6_frame', ['pool6']);
    // W7's frame6: the cage bars (+ its move-only boxes), the instruction plate, the trough, shear, pump, lever, sheave,
    // the winch (with their colliders), the tether, the `gauge6` screen, the work lamp fixture
    frame6(L, b);
    stand(fr, standin, -54.8, MID, -167.2, -54.2, MID + 1.0, -166.2); // the cage box
    const cageOnly = { requireRegion: 't6_cage' };
    L.interact('frame6_pin', 'pin', '안전핀 뽑기', -51.0, -15.0, -168.5, true, 1.2, cageOnly);
    L.interact('frame6_pump', 'pump', '펌프', -53.8, -15.0, -167.8, true, 1.2, cageOnly);
    L.interact('frame6_lever', 'lever', '전단 장치 발사', -50.25, -14.8, -167.9, true, 1.2, cageOnly);
    L.marker('mk6_cage', -52.0, MID, -168.8, 0);
    L.marker('mk6_pin', -51.38, -15.0, -168.5, -PI / 2);
    L.marker('mk6_pump', -53.8, -15.0, -168.6, 0);
    L.marker('mk6_lever', -50.25, -14.8, -168.7, 0);
    L.marker('mk6_sheave', -52.0, -15.2, -171.6, 0);
    // the winch WI (h 3.0, a ridged hood — standable, harmless at 15.6 m from the well) and the tether trough (h 0.25,
    // walkable over: a walkable dynamic box, as 3c's boat rails)
    // crates MC1 / MC2 (h 1.2), the dock console (desk h 1.0) and its screen above the desk's north edge
    stand(fr, standin, -66.0, MID, -160.0, -64.8, MID + 1.2, -158.8);
    stand(fr, standin, -40.0, MID, -160.0, -38.8, MID + 1.2, -158.8);
    console6(L, b);   // W7's set piece: desk (+ collider), the screen stand, the `console6` screen (bullet-resistant glass)
    L.interact('console6', 'terminal', '콘솔 사용', -44.0, -15.0, -159.1, false, 1.3, { requireRegion: 't6_console' });
    L.marker('mk6_console', -44.0, -15.0, -158.2, PI);
    L.marker('mk6_end_stand', -44.0, MID, -159.6, PI);
    L.marker('mk6_end_cam0', -44.0, -14.35, -159.4, PI);
    L.marker('mk6_end_cam1', -44.0, -14.3, -159.0, PI);
    L.marker('mk6_end_screen', -44.0, -14.2, -157.9, PI);
    // ── galleries: inner-edge rails (1.1 m, MOVE-ONLY) and parapet plates (h 1.1, solid — low cover) ──
    const R = 1.1;
    const parapetZ = (z0: number, z1: number, x0: number, x1: number) => stand(ed, standin, x0, GAL, z0, x1, GAL + R, z1);
    // east gallery inner edge x −31.2 (the landing joins at z −159.6 … −157.6)
    for (const [z0, z1] of [[-195.8, -192], [-184, -182], [-174, -159.6], [-157.6, -151.2]] as const) railZ(L, ed, dark, z0, z1, -31.25, GAL, R);
    parapetZ(-192, -184, -31.28, -31.2); parapetZ(-182, -174, -31.28, -31.2);
    // west gallery inner edge x −72.8
    for (const [z0, z1] of [[-195.8, -192], [-184, -182], [-174, -168], [-160, -159.6], [-157.6, -151.2]] as const) railZ(L, ed, dark, z0, z1, -72.8, GAL, R);
    parapetZ(-192, -184, -72.8, -72.72); parapetZ(-182, -174, -72.8, -72.72); parapetZ(-168, -160, -72.8, -72.72);
    // north gallery inner edge z −151.2
    for (const [x0, x1] of [[-72.8, -66], [-58, -46], [-38, -31.2]] as const) railX(L, ed, dark, x0, x1, -151.25, GAL, R);
    stand(ed, standin, -66, GAL, -151.28, -58, GAL + R, -151.2); stand(ed, standin, -46, GAL, -151.28, -38, GAL + R, -151.2);
    // the landings' open edges (the stairs arrive from the north)
    railX(L, ed, dark, -35.0, -31.2, -159.6, GAL, R); railZ(L, ed, dark, -159.6, -157.6, -35.0, GAL, R); railX(L, ed, dark, -33.2, -31.2, -157.65, GAL, R);
    railX(L, ed, dark, -72.8, -70.6, -159.6, GAL, R); railZ(L, ed, dark, -159.6, -157.6, -70.65, GAL, R); railX(L, ed, dark, -70.8, -70.6, -157.65, GAL, R);
    // ── the undercroft: pump housings P1 / P2 (h 1.8) with tool shelves on their north faces, the dewatering panel ──
    const uc = sub(L, 'pool6_undercroft', ['pool6']);
    stand(uc, standin, -64.0, DOCK, -156.0, -62.0, DOCK + 1.8, -154.0);   // P1
    stand(uc, standin, -42.0, DOCK, -156.0, -40.0, DOCK + 1.8, -154.0);   // P2
    shelf(b, standin, -63.0, -19.0, -153.8, 1.6, 0.3);
    shelf(b, standin, -41.0, -19.0, -153.8, 1.6, 0.3);
    b.bx(dark, -48.6, -19.0, -148.197, -47.4, -18.0, -148.15);
    L.interact('note6_transfer', 'log', '기록 읽기', -48.0, -18.5, -148.7, true, 1.4);
    // ── window walk fire points (south wall, y −19.0 shelves), the dock ammo lockers on the galleries ──
    shelf(b, standin, -70.0, -19.0, -195.5, 0.5, 0.5);
    shelf(b, standin, -34.0, -19.0, -195.5, 0.5, 0.5);
    for (const [id, x, z, ux, uz, face] of [
      ['locker6_e', -28.4, -194.6, -28.9, -194.6, '-x'], ['locker6_w', -75.6, -194.6, -75.1, -194.6, '+x'], ['locker6_n', -52.0, -148.4, -52.0, -148.9, '-z'],
    ] as const) {
      const bx: Box6 = face === '-x' ? [x - 0.2, -12, z - 0.4, x + 0.2, -10.4, z + 0.4] : face === '+x' ? [x - 0.2, -12, z - 0.4, x + 0.2, -10.4, z + 0.4] : [x - 0.4, -12, z - 0.2, x + 0.4, -10.4, z + 0.2];
      b.bx('painted_orange', bx[0], bx[1], bx[2], bx[3], bx[4], bx[5]);
      L.interact(id, 'locker', '탄약 가져가기', ux, -11.0, uz, true, 1.3);
    }
    shelf(b, standin, -28.5, -11.0, -193.6, 0.4, 0.4);
    shelf(b, standin, -75.5, -11.0, -193.6, 0.4, 0.4);
    // ── the sea windows (24 × 3.6 viewport, two 0.3 m mullions, a thick frame): the slot through the south wall into the
    //    sea void; the pane is a glass collider ──
    airIn(G, 'pool6', [-64, -19.6, -196.4, -40, -16.0, -195.8], ['pool6'], 'pool6');
    G.void(OUTSIDE6);
    pane(b, glass, PANE6);
    for (const x of [-56, -48]) stand(b, dark, x - 0.15, -19.6, -196.4, x + 0.15, -16.0, -195.8);
    L.marker('mk6_windows', -52.0, -17.8, -195.8, 0);
    // ── the dock board (north wall above the north gallery, readable from everywhere) ──
    L.screen('dock_board', 'dock_board', 12.0, 3.0, -52.0, -6.5, -148.22, '-z', { text: '문풀 — 도크 — 2,140 M\n이송 B-14: 하강 중\n화물 록: 내부 문 닫힘\n배수: 34 % — 정지됨\n테더: 팽팽함 — 부이: 대기\n로더 DL-2: 작동 중' });
    // ── the loader's runway rails on corbels (y −4.0, x −75.4 / −28.6, z −194 … −150) — visual; the loader is rail-bound ──
    b.bx(dark, -75.6, -4.3, -194.0, -75.2, -4.0, -150.0).bx(dark, -28.8, -4.3, -194.0, -28.4, -4.0, -150.0);
    // ── markers: the reveal, the restore points, the waves, the horn (the trolley's start over the well) ──
    L.marker('mk6_reveal', -29.7, GAL, -169.8, PI / 2);
    L.marker('mk6_boss_safe', -30.0, GAL, -166.0, PI / 2);
    L.marker('mk6_boss_safe_w', -74.3, GAL, -170.0, -PI / 2);
    L.marker('mk6_horn', -52.0, -2.0, -176.0, 0);
    roomLabel(b, '문풀 — 2,140 M', -28.2, -9.8, -180.0, '-x', 3.4);
  },

  stores6: ({ L, G, b }) => {
    air(G, 'stores6');
    L.marker('mk6_w1_a', -72.0, GAL, -144.0, 0);
    L.marker('mk6_w1_b', -68.0, GAL, -144.0, 0);
    roomLabel(b, '도크 저장고', -64.2, -9.6, -144.0, '-x', 2.2);
  },

  feed6: ({ L, G }) => {
    // the sealed feed set (no doors, no portals; W7 builds the sub bay's south end in it, drawn only by the feed pass)
    // (air 0.1 m bigger than the usual box on every side: W7's set draws its own floor, walls, ceiling — the grid's stay behind)
    G.air('feed6', [100.1, -0.1, 0.1, 123.9, 12.1, 23.9], { rooms: ['feed6'], look: 'feed6' as unknown as RoomId3 });
    feed6(L, { rooms: ['feed6'] });   // W7's sealed feed set (cradle, rails, launch-lock door, beacons, `feed6_board`)
    L.marker('mk6_feed_cam', 112, 7.2, 21.5, 0);
  },
};

// ───────────────────────────────────────────────────────────── greybox placeholders (set pieces / dressing win)

/**
 * Stand-ins for what other tasks own, so the story runs on the bare greybox: registered after every room is built and
 * only when the id is still free. Every vignette has its `:snap` (3c §8.7). Sounds are the vignette's own (D25).
 * Objects (W7's API, §8.7 / §8.5) as `L.objects[id].userData`: `switch6 { setProgress(k), keyOut() }`, `bj6 { unlock(),
 * open(k), strain(k), rip(), k }`, `shaft6 { unlock() }`, `frame6 { pin(k), pump(k), fire() }`, `phone6 { lift(), drop() }`,
 * `console6 { page(id) }`.
 */
export function placeholders6(L: LevelBuild, m: { standin: Mat; dark: Mat }): void {
  const ctx = L.ctx;
  const obj = (id: string) => L.objects.get(id)?.userData as Record<string, (...a: unknown[]) => unknown> | undefined;
  const text = (screen: string, kind: Parameters<GameContext['materials']['setScreen']>[1], t: string) => {
    const s = L.screens.get(screen);
    if (s) ctx.materials.setScreen(s, kind, { text: t });
  };
  const ph = (id: string, x: number, y: number, z: number, api: Record<string, unknown>) => {
    if (L.objects.has(id)) return;
    const o = L.marker(id, x, y, z, 0);
    o.userData.placeholder = true;
    Object.assign(o.userData, api);
  };
  // ── hatch lids (movers) ──
  if (!L.objects.has('hatch6_vault')) hatchLid(L, 'hatch6_vault', -13.0, -11.8, -160.4, 2.4, m.standin, ['vault6'], STOPPER_VAULT6);
  if (!L.objects.has('hatch6_he')) hatchLid(L, 'hatch6_he', 2.4, 3.6, -177.6, 2.2, m.standin, ['he6'], STOPPER_HE6);
  // ── the enclosure's bi-parting sliding doors (two 1.2 m leaves in a guide channel z −178.6 … −178.5; colliders in every
  //    state, no sweep — S1j) ──
  if (!L.objects.has('bj6')) {
    const g = new THREE.Group();
    g.name = 'bj6';
    g.userData.rooms = ['vault6'];
    L.root.add(g);
    L.objects.set('bj6', g);
    const leaves = [-1, 1].map((s) => {
      const part = L.part(`bj6:leaf${s}`);
      part.bx(m.standin, s < 0 ? -1.2 : 0, 0, -0.05, s < 0 ? 0 : 1.2, 2.0, 0.05);
      const leaf = part.build();
      leaf.position.set(-12.0, 0, -178.55);
      g.add(leaf);
      ctx.physics.addMover?.(leaf);
      const pb = ctx.physics.addBox(box3(s < 0 ? [-13.2, 0, -178.6, -12.0, 2.0, -178.5] : [-12.0, 0, -178.6, -10.8, 2.0, -178.5]), 'metal');
      pb.owner = leaf;
      return { leaf, pb, s };
    });
    const u = g.userData;
    u.placeholder = true;
    u.k = 0;
    u.open = (k: number) => {
      k = Math.min(1, Math.max(0, k));
      u.k = k;
      for (const { leaf, pb, s } of leaves) {
        leaf.position.x = -12.0 + s * 1.2 * k;
        const x0 = s < 0 ? -13.2 - 1.2 * k : -12.0 + 1.2 * k;
        pb.box.min.x = x0; pb.box.max.x = x0 + 1.2;
      }
    };
    u.unlock = () => text('bj6', 'interlock', '키 A 삽입 — 열림');
    u.strain = () => { /* greybox */ };
    u.rip = () => text('bj6', 'interlock', '광케이블 — 신호 손실');
  }
  // the well's ladders (W7's set piece; W3c's climbers read `foot` → `top` (the coaming top, feet −19.2) → `exit`, and open
  // the self-closing `gate` in the bar guard as they pass — the greybox has no gate: the climb is kinematic)
  for (const [id, x, top, exit] of [['ladder6_w', -57.6, -58.2, [-59.3, DOCK, -176.0]], ['ladder6_e', -46.4, -45.8, [-44.7, DOCK, -176.0]]] as const) {
    ph(id, x, -19.2, -176.0, {
      foot: new THREE.Vector3(x, -34, -176.0), top: new THREE.Vector3(top, -19.2, -176.0), exit: new THREE.Vector3(...exit),
      gate: { open: () => { /* greybox: no gate */ }, k: 0 },
    });
  }
  ph('switch6', 20.95, 1.2, -171.0, { setProgress: () => { /* greybox */ }, keyOut: () => text('switch6', 'terminal_idle', '수동 — 키 A 분리') });
  ph('shaft6', -21.78, 1.3, -167.6, { unlock: () => text('shaft6_panel', 'interlock', '키 B 삽입 — 열림') });
  ph('frame6', -52.0, -16, -168.5, { pin: () => { /* greybox */ }, pump: () => { /* greybox */ }, fire: () => text('gauge6', 'gauge', '발사됨') });
  ph('phone6', 21.78, 1.4, -164.0, { lift: () => { /* greybox */ }, drop: () => { /* greybox */ } });
  ph('console6', -44.0, -14.2, -157.9, { page: (id: unknown) => text('console6', 'manifest', String(id)) });

  const vig = (id: string, run: () => void, snap: () => void, toggle = false) => { if (!L.vignettes.has(id)) L.vignette(id, run, { toggle, snap }); };
  const none = () => { /* greybox: nothing to show (the dressing task owns this vignette) */ };
  const lm = ctx.render.lights;
  const groups = (off: string[], on: string[]) => { for (const g of off) lm.setGroup(g, { enabled: false }); for (const g of on) lm.setGroup(g, { enabled: true }); };
  /** `regions.dark` gains these boxes (idempotent). */
  const darkAdd = (boxes: Box6[]) => {
    const regions = ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
    if (!regions) return;
    const list = (regions.dark ??= []);
    for (const bx of boxes) { const b3 = box3(bx); if (!list.some((q) => q.equals(b3))) list.push(b3); }
  };
  const swing = (id: string) => { const o = obj(id)?.open as ((k: number) => void) | undefined; if (o && lidK(L, id) === 0) L.tween(0.3, 1.2, (k) => o(k * k * (3 - 2 * k)), () => o(1)); };
  const lidOpen = (id: string) => (obj(id)?.open as ((k: number) => void) | undefined)?.(1);

  // tunnels (D1)
  const farOut = () => { groups(['tun6_a_far'], ['tun6_a_emerg']); darkAdd([[-2.5, -0.5, -80, 2.5, 4.0, -52]]); };
  vig('tun6_far_out', () => { L.sfx('lights_out_dock', 0, 3.6, -64, 0.6); farOut(); }, farOut);
  vig('v6_tent', () => L.sfx('tarp_flap', 13.6, 1.4, -85.2, 0.8), none);
  vig('vent6_rep', () => obj('vent6_rep_grille')?.open('drop'), () => obj('vent6_rep_grille')?.open('drop', true));
  // head-end, vault, trench (D2)
  vig('v6_handset', () => L.sfx('phone_howler', 21.78, 1.4, -164.0), none);
  vig('v6_drum', () => L.sfx('ratchet_run', -16.5, 1.2, -163.0), none);
  vig('v6_ring', () => L.sfx('hull_ring', -8.0, 2.0, -170.0), none);
  vig('v6_thud', () => L.sfx('far_lock_flood', -8.0, 2.0, -170.0), none);
  vig('bj6_open', () => { const o = obj('bj6')?.open as ((k: number) => void) | undefined; if (o) L.tween(0, 1.2, (k) => o(k), () => o(1)); }, () => lidOpen('bj6'));
  vig('bj6_rip', () => obj('bj6')?.rip(), () => obj('bj6')?.rip());
  vig('hatch6_vault_open', () => { L.sfx('hatch_unlatch', -12.4, 0.2, -159.2); swing('hatch6_vault'); }, () => lidOpen('hatch6_vault'));
  vig('hatch6_he_open', () => { L.sfx('hatch_unlatch', 3.0, -0.2, -176.5); swing('hatch6_he'); }, () => lidOpen('hatch6_he'));
  vig('vent6_vault', () => obj('vent6_vault_grille')?.open('drop'), () => obj('vent6_vault_grille')?.open('drop', true));
  for (const n of [1, 2, 3]) {
    const id = `grille6_${n}`;
    // a trench grille lifts (`sump_lift`) and drops shut 1.2 s after its skitter is out; its snap state is SHUT (§2.6.7)
    vig(id, () => { obj(id)?.open('lift'); L.after(1.6, () => obj(id)?.shut()); }, () => obj(id)?.shut(true), true);
  }
  // shaft (D3b)
  const shaftOut = () => { groups(['shaft6'], ['shaft6_emerg']); darkAdd([rb('shaft6', -12.5, 3.2)]); };
  vig('v6_shaft_lights', () => {
    const lamps = lm.group('shaft6').slice().sort((a, c) => a.position.y - c.position.y);
    // LL2, LL3, LLB pop first (below him), then LL1, LL0 above — the plan's order by height bands
    const order = [...lamps.filter((h) => h.position.y < -2), ...lamps.filter((h) => h.position.y >= -2)];
    const at = [0.0, 0.7, 1.4, 3.0, 3.6];
    order.forEach((h, i) => L.after(at[Math.min(i, at.length - 1)], () => { h.enabled = false; L.sfx('bulb_pop', h.position.x, h.position.y, h.position.z, 0.8); }));
    L.after(3.7, shaftOut);
  }, shaftOut);
  // the chamber (D3a / D3b)
  vig('v6_well_eyes', none, none);
  vig('v6_window', () => L.sfx('sea_groan', -52, -18, -200, 0.8), none);
  vig('beacons6', () => groups([], ['pool6_beacon']), () => groups([], ['pool6_beacon']));
  const lightsOut = () => { groups(['pool6'], ['pool6_emerg']); darkAdd([rb('pool6', -21.8, 2.0)]); };
  vig('lights_out6', () => { L.sfx('lights_out_dock', -52, -4, -170, 1.0); lightsOut(); }, lightsOut);
  vig('loader_dead6', none, none);
  // check-only (check-reach `snaps`): what the story enables in a state — the loom once the enclosure is open, the console
  // once the ending is pending (never fired by the story)
  const enable = (id: string) => { const it = ctx.interactables.get(id); if (it) it.enabled = true; };
  vig('check6_loom', () => enable('vault6_loom'), () => enable('vault6_loom'));
  vig('check6_console', () => enable('console6'), () => enable('console6'));
  // (not in any check row yet: check-reach keeps a snap's state for the phases that follow on the same page, so an enabled
  // loom leaked into B's `mustNotUse`; for a row that needs one, check-reach should reload the page first — W4b)

  if (!L.machines.has('winch6')) L.machines.set('winch6', () => { /* greybox (W7) */ });
  if (!L.machines.has('ping6')) L.machines.set('ping6', () => { /* greybox (W2b / D2) */ });
  // `trench6`: always 'active' — check-reach's one-way edge for `hatch6_he` keys on a running machine (as 3c's `tern`)
  if (!L.machines.has('trench6')) L.machines.set('trench6', () => { /* no world change */ });
  // the feed set's board (W7 places the set; the screen exists for the story / tests)
  if (!L.screens.has('feed6_board')) L.screen('feed6_board', 'dock_status', 2.4, 0.8, 112.0, 6.0, 0.22, '+z', { text: '턴 — 크레이들 — 비어 있음\n발사 록 — 침수' }).userData.rooms = ['feed6'];
}
