/**
 * COLD BOOT — level 5 "초소 4" (stage 3c, docs/plans/stage-3c.md §2–§3, §5, §8.3–§8.7, §8.10; task W4 greybox).
 *
 * Final coordinates, no dressing. Files:
 *   grey.ts    rooms (§2.1), one shell per room (structure, crawl + magazine, stairs, hatch lids, stand-ins, screens,
 *              interactables, markers), lights (§2.7), greybox placeholders for every vignette (+ `:snap`) / machine /
 *              object that other tasks own
 *   phases.ts  regions, the phase table A … X (+ variants, nostory, check-only S_out / S_up) with reach-check data,
 *              the interactables a phase switches, latches
 *   cover.ts   the 41 cover points (§5.4) as `level.cover` + their self-test (§8.3)
 *   index.ts   doors (§2.2), triggers (§2.3), portals, pickups (§5.2), enemy spawns (§5.1), nav cases (§10.3),
 *              markers list, self-test
 *
 * Dressing tasks export a `Partial<Record<RoomId5, RoomDress>>` from their file and are listed in `DRESSING`:
 *   fore.ts (D1)      lock5, gate5, duty5, ready5
 *   spine.ts (D2a)    spine5 (+ the crawl), arm5 (+ the magazine)
 *   quarters.ts (D2b) berths5, heads5, mess5, galley5
 *   bay.ts (D3)       sub5, dive5, lockacc5, tunnel5
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import { LevelBuild, roomFloor } from '../context';
import type { DoorImpl, DoorSpec } from '../doors';
import { defineInstances } from '../props';
import { assembleLevel, buildRooms, type PortalSpec } from '../assemble';
import type { TriggerSpec } from '../triggers';
import type { Builder } from '../builder';
import { GreyGrid, flatMat, type Look } from '../l3/grey';
import {
  ENVELOPE5, EXIT_MAG, EXIT_SPINE, LIGHTS5, MAGHATCH5, PANES5, PIT5, ROOMS5, ROOM_IDS5, SHELLS5, STAIR5_E, STAIR5_W, box3,
  lidK, placeLights5, placeholders5, stairLine, wetOf, type LightRow5, type RoomId5,
} from './grey';
import { REGIONS5, applyPhaseTo5, installPhases5, type PhaseId5 } from './phases';
import { COVER5, COVER_SPAWNS5, selfTestCover } from './cover';
import { FORE_DRESS } from './fore';
import { SPINE_DRESS } from './spine';
import { QUARTERS_DRESS } from './quarters';
import { BAY_DRESS } from './bay';

const PI = Math.PI;

// ───────────────────────────────────────────────────────────── dressing hook-up

/** What a dressing file may give a room (same contract as levels 3 / 4; see grey.ts header). */
export interface RoomDress {
  /** Extra geometry / props / screens / vignettes, run after the room's shell inside its build pass (culled with the room). */
  build?(L: LevelBuild): void;
  /** Replaces the room's placeholder light table (`LIGHTS5[room]`); keep the §2.7 group names (and the floor bounds, S5). */
  lights?: LightRow5[];
  /** Materials of the shell faces looking into this room. */
  look?: Partial<Look>;
  /** false = no big greybox wayfinding label (the shell's `roomLabel`s are skipped). */
  label?: boolean;
}
/** Dressing tables, merged in order (later wins per room). */
const DRESSING: Partial<Record<RoomId5, RoomDress>>[] = [FORE_DRESS, SPINE_DRESS, QUARTERS_DRESS, BAY_DRESS];

// ───────────────────────────────────────────────────────────── doors (§2.2)

/** Labels name the room on the other side (front = seen from +z / +x). */
export function doors5(): DoorSpec[] {
  const nv = { frameStyle: 'navy' as const, leafMat: 'navy_grey' as const, signStyle: 'navy' as const };
  const z = (id: string, x: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x, y: 0, z: zz, wall: 'z', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...nv, ...o });
  const x = (id: string, xx: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x: xx, y: 0, z: zz, wall: 'x', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...nv, ...o });
  return [
    // the pressure gate: `wide` (3.0 × 2.8 as built — the plan's 2.4 × 2.6 is not a size kind `wide` has), rises in
    // 2.4 s; the gate owns both of its sounds (S1o)
    z('d5_gate', 0, 0, '초소 4 — 게이트하우스', '초소 4 — 게이트 록', ['lock5', 'gate5'], {
      kind: 'wide', frameStyle: 'industrial', leafMat: 'navy_grey', auto: false, duration: 2.4,
      sounds: { open: 'gate_open_heavy', close: 'gate_close_heavy' },
    }),
    z('d5_duty', 0, -10, '당직실', '게이트하우스', ['gate5', 'duty5'], { auto: false }),
    z('d5_ready', -4, -22, '대기실', '당직실', ['duty5', 'ready5']),
    x('d5_key', 8, -16, '당직실', '스파인 — 인가된 인원', ['duty5', 'spine5']),
    z('d5_berth', 18, -14, '스파인', '침실구역 1', ['spine5', 'berths5']),
    z('d5_mess', 31, -14, '스파인', '식당', ['spine5', 'mess5']),
    x('d5_berth_mess', 24, -8, '침실구역 1', '식당', ['berths5', 'mess5']),
    z('d5_heads', 16, -2, '침실구역 1', 'WASHROOM', ['berths5', 'heads5']),
    z('d5_galley', 33, -2, '식당', '갤리', ['mess5', 'galley5']),
    z('d5_arm', 17, -18, '무기고', '스파인', ['spine5', 'arm5']),
    x('d5_arm_bay', 22, -23, '무기고', '서브베이', ['arm5', 'sub5']),
    z('d5_bay', 34, -18, '서브베이', '스파인', ['spine5', 'sub5']),
    x('d5_dive', 46, -34, '서브베이', '잠수 장비함', ['sub5', 'dive5'], { auto: false }),
    z('d5_lockside', 42, -56, '발사 록 — 출입', '서브베이', ['sub5', 'lockacc5'], { auto: false }),
    x('d5_tunnel', 22, -53, '트렁크 터널', '서브베이', ['sub5', 'tunnel5'], { frameStyle: 'industrial', cyclingPrompt: '유압 차단됨 — 갤러리 휠' }),
  ];
}

const HW = 0.2;
/** Carve a door's opening through its 0.4 m wall and (std) the slots its leaves slide into (as levels 3 / 4). */
function carveDoor(G: GreyGrid, s: DoorSpec) {
  const std = s.kind === 'std';
  const w = std ? s.w ?? 1.6 : 3.0, h = std ? s.h ?? 2.4 : 2.8, y = s.y ?? 0;
  const def = { rooms: [...new Set(s.rooms)], look: 'reveal' as const };
  const put = (u0: number, u1: number, y0: number, y1: number, v0: number, v1: number) => {
    G.air(`door:${s.id}`, s.wall === 'z' ? [s.x + u0, y0, s.z + v0, s.x + u1, y1, s.z + v1] : [s.x + v0, y0, s.z + u0, s.x + v1, y1, s.z + u1], def);
  };
  put(-w / 2, w / 2, y, y + h, -HW, HW);
  if (!std) return;
  const end = w + 0.075;
  put(-end, -w / 2, y, y + h, -0.07, 0.07);
  put(w / 2, end, y, y + h, -0.07, 0.07);
}

// ───────────────────────────────────────────────────────────── triggers (§2.3)

const T = (id: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): TriggerSpec => ({ id, x0, x1, z0, z1, y0, y1 });
export const TRIGGERS5: TriggerSpec[] = [
  T('t5_lock', -2.8, 2.8, 0.2, 5.8, -1, 3),
  T('t5_gate', -5.8, 5.8, -9.8, -1.2, -1, 3),
  T('t5_turnstile', -3.0, 1.2, -5.8, -4.2, -1, 3),
  T('t5_dutydoor', -2.0, 2.0, -9.8, -8.0, -1, 3),
  T('t5_duty', -7.8, 7.8, -21.8, -10.2, -1, 3),
  T('t5_ready', -11.8, 3.8, -37.8, -24.0, -1, 3),
  T('t5_spine_w', 8.2, 22.0, -17.8, -14.2, -0.5, 3),
  T('t5_spine_mid', 22.0, 30.0, -17.8, -14.2, -0.5, 3),
  T('t5_cmd', 40.0, 43.8, -17.8, -14.2, -0.5, 3),
  T('t5_cmd_line', 41.9, 43.1, -17.4, -14.6, -0.5, 3),
  T('t5_hatch', 36.2, 38.6, -15.4, -14.2, -0.5, 3),
  T('t5_crawl_e', 33.0, 36.2, -16.6, -15.4, -1.6, -0.2),
  T('t5_landing', 36.2, 37.4, -17.6, -15.4, -1.6, -0.2),
  T('t5_mag', 14.2, 21.8, -27.8, -21.4, -2.8, -1.0),
  T('t5_berths', 12.2, 23.8, -13.8, -2.2, -1, 3),
  T('t5_heads', 12.2, 19.8, -1.8, 3.8, -1, 3),
  T('t5_mess', 24.2, 37.8, -13.8, -2.2, -1, 3),
  T('t5_galley', 28.2, 37.8, -1.8, 3.8, -1, 3),
  T('t5_arm', 14.2, 21.8, -27.8, -18.2, -0.5, 3),
  T('t5_bay', 22.2, 45.8, -55.8, -18.2, -0.5, 8),
  T('t5_bridge', 25.0, 43.0, -36.0, -34.0, 4.3, 7),
  T('t5_wheel', 22.2, 25.0, -53.0, -49.0, 4.3, 7),
  T('t5_tunnel', 14.2, 21.6, -55.8, -50.2, -1, 3),
];

// ───────────────────────────────────────────────────────────── visibility (portals, §2.7.4)

/**
 * Doors are `false` (drawn only through the open door). The crawl turn under `d5_arm` joins the spine's crawl to the
 * armoury's crawl / magazine below their floors: that pair is drawn within 6.5 m of the door (the turn and the
 * magazine stair lie inside it) — the door itself stands for the anchor.
 */
const PORTALS5: PortalSpec[] = [
  ['lock5', 'gate5', 'd5_gate', false],
  ['gate5', 'duty5', 'd5_duty', false],
  ['duty5', 'ready5', 'd5_ready', false],
  ['duty5', 'spine5', 'd5_key', false],
  ['spine5', 'berths5', 'd5_berth', false],
  ['spine5', 'mess5', 'd5_mess', false],
  ['berths5', 'mess5', 'd5_berth_mess', false],
  ['berths5', 'heads5', 'd5_heads', false],
  ['mess5', 'galley5', 'd5_galley', false],
  ['spine5', 'arm5', 'd5_arm', 6.5],
  ['arm5', 'sub5', 'd5_arm_bay', false],
  ['spine5', 'sub5', 'd5_bay', false],
  ['sub5', 'dive5', 'd5_dive', false],
  ['sub5', 'lockacc5', 'd5_lockside', false],
  ['sub5', 'tunnel5', 'd5_tunnel', false],
];
/** §2.7.4: the five sub-bay doors share one frame zone; the rest one per room pair. */
const SUB_DOORS = ['d5_arm_bay', 'd5_bay', 'd5_dive', 'd5_lockside', 'd5_tunnel'];
const SUB_ZONE_ROOMS = ['sub5', 'arm5', 'spine5', 'dive5', 'lockacc5', 'tunnel5'];

// ───────────────────────────────────────────────────────────── pickups (§5.2) and enemy spawns (§5.1)

function gameplay(L: LevelBuild) {
  const p = (id: string, kind: Parameters<LevelBuild['pickup']>[1], x: number, y: number, z: number, n: number, yaw = 0) => L.pickup(id, kind, x, y, z, n, yaw);
  p('p5_gate_med', 'medkit', 5.4, 1.0, -6.0, 35);
  p('p5_duty_ammo', 'ammo_pistol', 7.5, 1.2, -11.0, 12);
  p('p5_ready_med', 'medkit', 3.4, 1.0, -23.0, 35);
  p('p5_ready_ammo', 'ammo_carbine', -11.4, 1.0, -30.0, 30);
  p('p5_berth_med', 'medkit', 23.4, 0.7, -3.0, 35);
  p('p5_berth_shells', 'ammo_shotgun', 13.8, 0.7, -2.9, 6);
  p('p5_mess_ammo', 'ammo_carbine', 37.4, 1.0, -13.4, 30);
  p('p5_galley_med', 'medkit', 28.6, 1.0, 3.4, 35);
  p('p5_arm_vest', 'vest', 21.4, 1.4, -19.4, 50, -PI / 2);
  p('p5_arm_carbine', 'carbine', 14.45, 1.3, -20.6, 30, PI / 2);
  p('p5_arm_ammo_1', 'ammo_carbine', 14.6, 1.0, -22.0, 30);
  p('p5_arm_ammo_2', 'ammo_carbine', 14.6, 1.0, -22.5, 30);
  p('p5_arm_shells', 'ammo_shotgun', 14.6, 1.0, -24.0, 12);
  p('p5_arm_plate', 'plate', 14.6, 0.4, -25.0, 15);
  p('p5_mag_ammo_1', 'ammo_carbine', 18.5, -1.8, -23.0, 30);
  p('p5_mag_ammo_2', 'ammo_carbine', 18.5, -1.8, -23.6, 30);
  p('p5_mag_ammo_3', 'ammo_carbine', 18.5, -1.8, -24.2, 30);
  p('p5_mag_pistol', 'ammo_pistol', 15.5, -1.8, -23.0, 24);
  p('p5_mag_plate_1', 'plate', 17.0, -2.2, -27.4, 15);
  p('p5_mag_plate_2', 'plate', 17.6, -2.2, -27.4, 15);
  p('p5_mag_med', 'medkit', 15.5, -1.8, -24.0, 35);
  p('p5_spine_ammo', 'ammo_carbine', 43.4, 1.0, -14.6, 30);
  p('p5_bay_med_1', 'medkit', 24.0, 1.0, -22.0, 35);
  p('p5_bay_ammo_1', 'ammo_carbine', 24.4, 1.0, -22.0, 30);
  p('p5_wheel_plate', 'plate', 22.6, 5.6, -50.6, 15);
  p('p5_wheel_ammo', 'ammo_carbine', 22.6, 5.6, -51.0, 30);
  p('p5_bay_med_2', 'medkit', 44.6, 1.0, -50.0, 35);
  p('p5_dive_shells', 'ammo_shotgun', 51.4, 1.0, -29.0, 6);
  p('p5_tunnel_med', 'medkit', 21.0, 1.0, -50.6, 35);

  const navy = { skin: 'navy' as const };
  // nothing hostile exists before its beat (R4) except g5_mag, dormant from load far below the armoury
  L.enemy('g5_duty', 'husk', 'spawn', -5.0, 0, -23.6, PI, undefined, undefined, navy);
  L.enemy('g5_duty', 'husk', 'spawn', -3.0, 0, -23.6, PI, undefined, undefined, navy);
  L.enemy('g5_s1', 'soldier', 'spawn', -4.0, 0, -36.6, PI, 'hold', undefined, { arms: 'pistol', cover: 'ready' });
  L.enemy('g5_spine', 'soldier', 'spawn', 48.0, 0, -34.0, PI / 2, undefined, undefined, { arms: 'pistol', cover: 'spine' });
  L.enemy('g5_spine', 'husk', 'spawn', 48.0, 0, -31.0, PI / 2, undefined, undefined, navy);
  L.enemy('g5_spine', 'husk', 'spawn', 50.0, 0, -31.0, PI / 2, undefined, undefined, navy);
  L.enemy('g5_patrol', 'soldier', 'spawn', 34.0, 0, -20.0, 0, 'hold', undefined, { arms: 'carbine', cover: 'spine' });
  L.enemy('g5_mag', 'husk', 'dormant', 15.85, -2.6, -26.0, -PI / 2, 'slumped', undefined, navy);
  // vent skitters beside the opening under the solid ceiling (ceiling 3.2: the emerge up-ray hits it at 0.1 m)
  L.enemy('g5_cmd', 'skitter', 'spawn', 29.4, 3.1, -16.0, 0);
  L.enemy('g5_cmd', 'skitter', 'spawn', 30.6, 3.1, -16.0, 0);
  L.enemy('g5_cmd', 'soldier', 'spawn', 42.0, 0, -60.0, 0, undefined, undefined, { arms: 'carbine', cover: 'floor' });
  L.enemy('g5_bay_a', 'soldier', 'spawn', 40.0, 0, -60.0, 0, undefined, undefined, { arms: 'carbine', cover: 'floor' });
  L.enemy('g5_bay_a', 'soldier', 'spawn', 44.0, 0, -60.0, 0, undefined, undefined, { arms: 'carbine', cover: 'gallery_e' });
  L.enemy('g5_bay_a', 'husk', 'spawn', 41.0, 0, -57.6, 0, undefined, undefined, navy);
  L.enemy('g5_bay_a', 'husk', 'spawn', 43.0, 0, -57.6, 0, undefined, undefined, navy);
  L.enemy('g5_bay_b', 'sentry', 'dormant', 34.0, 9.0, -45.0, 0, 'ceiling', undefined, navy);
  L.enemy('g5_bay_b', 'skitter', 'spawn', 28.0, -0.3, -48.0, 0);
  L.enemy('g5_bay_b', 'skitter', 'spawn', 39.0, -0.3, -36.5, 0);
  L.enemy('g5_bay_b', 'husk', 'spawn', 42.0, 0, -58.0, 0, undefined, undefined, navy);
}

/** §8.10 markers that are lists, not points. */
function storyMarkers(L: LevelBuild) {
  // `{ id, p, box }`: p = the pane's centre (the point a test shoots), box = its world box
  L.marker('mk5_glass', 0, 0, 0).userData.panes = PANES5.map((q) => ({ id: q.id, p: [(q.box[0] + q.box[3]) / 2, (q.box[1] + q.box[4]) / 2, (q.box[2] + q.box[5]) / 2], box: [...q.box] }));
}

// ───────────────────────────────────────────────────────────── nav cases (scripts/check-nav.mjs, §10.3)

/**
 * §10.3 cases at real speeds: husks RUSHED (4.0 m/s — `rush: true` calls `enemies.rush` as the story does), skitters
 * 4.4 m/s, soldiers 1.6 m/s (`type: 'soldier'`: until W3b registers the soldier the manager builds a husk that walks
 * 1.3 m/s, so those bounds carry a note). `arrive` = success when the enemy is within that many metres of the player
 * (a soldier stops at range, a husk attacks).
 * Correction (W4): lockacc → north gallery via STAIR5_E is 71 m on the built graph (floor 34 m to the stair foot at
 * the NORTH end, the flight 10 m, the bridge to the east gallery, 15 m north, 10 m west): 44 s at 1.6 m/s — the plan's
 * 40 s cannot hold; the bound is 50 s.
 */
export const NAV_CASES5 = {
  reach: [
    { id: 'ready_duty', label: 'g5_duty husk (rushed) from the ready-room spawn → player in the duty room', type: 'husk', rush: true, spawn: [-4, 0, -23.6], player: [0, 0, -13], within: 6 },
    { id: 'dive_spine_husk', phase: 'S_dive', label: 'g5_spine husk (rushed) from the dive locker → spine mid (sub bay, d5_bay)', type: 'husk', rush: true, spawn: [49, 0, -31], player: [26, 0, -16], within: 12 },
    { id: 'dive_spine_soldier', phase: 'S_dive', label: 'g5_spine soldier (1.6 m/s) from the dive locker → spine mid', type: 'soldier', spawn: [48, 0, -34], player: [26, 0, -16], within: 30, arrive: 8 },
    // (IA5: a soldier does not climb to a player he can see on a gallery — a 1.1 m parapet is no cover against the same
    // deck (§8.2.4 safety rule), so he fights from floor cover below; the case is his engagement time. The stair route
    // itself is proved by `lockacc_wheel` (STAIR5_W) and the drain cases.)
    { id: 'lockacc_north', phase: 'V_lock', label: 'soldier from the launch-lock access engages a player on the north gallery (from floor cover)', type: 'soldier', spawn: [42, 0, -58], player: [34, 4.8, -20], within: 50 },
    { id: 'lockacc_wheel', phase: 'W_lock', label: 'g5_bay_b husk (rushed) from the launch-lock access → the wheel on the west gallery via STAIR5_W', type: 'husk', rush: true, spawn: [41, 0, -57.6], player: [23.6, 4.8, -52], within: 15, via: ['stair'] },
    { id: 'drain_a_bridge', phase: 'V', label: 'drain A skitter (landed) → player on the bridge', type: 'skitter', spawn: [28, 0, -48], player: [34, 4.8, -35], within: 14 },
    { id: 'drain_b_bridge', phase: 'V', label: 'drain B skitter (landed) → player on the bridge', type: 'skitter', spawn: [39, 0, -36.5], player: [34, 4.8, -35], within: 14 },
    { id: 'vent_cmd', phase: 'V', label: 'vent skitter (landed) → player at Kessler\'s door', type: 'skitter', spawn: [30, 0, -16], player: [42, 0, -16], within: 4 },
  ],
  /** Sealed: the player latched in the tunnel (d5_tunnel locked): a husk in the sub bay stands off, comes when it opens. */
  standOff: { id: 'standoff_tunnel', label: 'd5_tunnel locked, player in the tunnel: husk in the sub bay stands off, comes when it opens', door: 'd5_tunnel', spawn: [30, 0, -50], player: [17, 0, -53], hold: 20, within: 20 },
  ramps: [STAIR5_W, STAIR5_E].map((s, i) => {
    const { a, b } = stairLine(s);
    const mid = [a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const dir = Math.sign(b[2] - a[2]);
    return { stair: i, standAt: mid, top: [a[0], 4.8, b[2] + dir * 0.9], bottom: [a[0], 0, a[2] - dir * 0.9], trips: 3, away: [17, 0, -53] };
  }),
  /** §8.4 / §10.3: the ship stairs to the `nav: false` floors — the PLAYER capsule climbs them (lids open). */
  shipStairs: [
    { id: 'hatch_stair', label: 'STAIR5_HATCH: pit landing → walkway (spine lid open)', snaps: ['hatch5_spine_open'], from: [36.8, -1.4, -17.3], via: [38.0, -1.0, -17.3], to: [38.0, 0, -14.8], yawUp: PI },
    { id: 'mag_out_stair', label: 'STAIR5_MAG_OUT: magazine → armoury (magazine lid open)', snaps: ['hatch5_mag_open'], from: [19.8, -2.6, -27.4], via: [21.0, -2.6, -27.4], to: [21.0, 0, -23.8], yawUp: PI },
  ],
  /** No nav node may stand in these (obstacles from load, S1m) — and none on a `nav: false` floor. */
  noNodes: [{ id: 'hatch pit', box: [PIT5[0], -2, PIT5[2], PIT5[3], 1.5, PIT5[5]] }, { id: 'magazine hatch', box: [MAGHATCH5[0], -3, MAGHATCH5[2], MAGHATCH5[3], 1.5, MAGHATCH5[5]] }],
  /** The lower stairs carry no navStair: only STAIR5_W / STAIR5_E are nav stairs. */
  navStairs: 2,
  /** Cover: every `cv5_*` reachable from its set's soldier spawn (§8.3). */
  cover: COVER5.map((c) => ({ id: c.id, set: c.set, p: c.position.toArray(), from: COVER_SPAWNS5[c.set] })),
  exits: { spine: EXIT_SPINE, mag: EXIT_MAG },
  ignoreFloors: [] as string[],
};

// ───────────────────────────────────────────────────────────── level

export async function createLevel5(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  const L = new LevelBuild(ctx);
  ctx.scene.add(L.root);
  defineInstances(L);

  const dress: Partial<Record<RoomId5, RoomDress>> = {};
  for (const t of DRESSING) for (const [k, v] of Object.entries(t)) dress[k as RoomId5] = { ...dress[k as RoomId5], ...v };

  const G = new GreyGrid(ENVELOPE5);
  const standin = flatMat(L, 0x7d8186, 'grey_standin');
  const glass = L.ctx.materials.get('glass');
  const dark = flatMat(L, 0x3a3f44, 'grey_dark');
  const yellow = flatMat(L, 0xd8b020, 'grey_yellow_line', { emissive: new THREE.Color(0x705800), emissiveIntensity: 0.6 });
  const grate = L.doubleSided('floor_grate');
  const noLabel = (b: Builder) => new Proxy(b, { get: (t, p) => (p === 'sign' ? () => t : (t as unknown as Record<string | symbol, unknown>)[p as string]) }) as Builder;
  const specs = doors5();

  buildRooms(L, ROOM_IDS5.map((id) => [id, (l: LevelBuild) => {
    const r = ROOMS5[id];
    l.room(id, r.name, r.x0, r.x1, r.z0, r.z1, r.h, { y0: r.y0, floors: r.floors });
    const b = l.builder(`${id}_grey`);
    const d = dress[id];
    SHELLS5[id]({ L: l, G, b: d?.label === false ? noLabel(b) : b, standin, glass, dark, yellow, grate });
    d?.build?.(l);
    placeLights5(l, d?.lights ?? LIGHTS5[id]);
  }] as const), lap);
  for (const s of specs) carveDoor(G, s);
  // nav obstacles from load (S1m): the hatch pit and the magazine hatch — lid open or shut, no node in them
  L.obstacles.push(box3(PIT5), box3(MAGHATCH5));
  gameplay(L);
  storyMarkers(L);
  placeholders5(L, { standin, dark, glass });

  const wall = flatMat(L, 0xc4c8cb, 'grey_wall'), ceil = flatMat(L, 0x93979b, 'grey_ceiling'), reveal = flatMat(L, 0xa4a7aa, 'grey_reveal');
  const floors = new Map<string, THREE.Material>();
  G.build(L, (room) => {
    if (room === 'reveal') return { floor: reveal, wall: reveal, ceiling: reveal };
    let f = floors.get(room);
    if (!f) floors.set(room, (f = flatMat(L, FLOOR_TINT5[room as unknown as RoomId5] ?? 0x8a8e92, `grey_floor_${room}`)));
    return { floor: f, wall, ceiling: ceil, ...dress[room as unknown as RoomId5]?.look };
  });
  lap('grey');

  const level = assembleLevel(ctx, L, {
    doors: specs,
    frameZone: (s) => {
      if (SUB_DOORS.includes(s.id)) return { name: 'frames5_sub5', rooms: SUB_ZONE_ROOMS };
      const rooms = [...new Set(s.rooms)].sort();
      return { name: `frames5_${rooms.join('+')}`, rooms };
    },
    portals: PORTALS5,
    seeRange: 22,
    triggers: TRIGGERS5,
    navStep: (id) => (id === 'sub5' ? 1.25 : 1.0),
    navStart: { x: 0, y: 0, z: 3.0 },
    spawn: { position: new THREE.Vector3(0, 0, 3.0), yaw: 0 },
    startRoom: 'lock5',
    regions: REGIONS5(wetOf(L)),
    cover: COVER5,
    timings, t0,
  });
  installPhases5(ctx, level);
  // initial door state: the story starts in phase A; `?nostory=1` follows the nostory column (§3)
  applyPhaseTo5(ctx, level, (ctx.debug.noStory ? 'nostory' : 'A') as PhaseId5);
  level.setMachine('tern', 'active');

  // §8.4 (W3b): `mk5_exit_mag` is an exit only while the magazine hatch is open
  const floorAt0 = level.floorAt.bind(level);
  const magOpen = () => lidK(L, 'hatch5_mag') >= 0.98;
  const exitMag = new THREE.Vector3(...EXIT_MAG);
  (level as { floorAt: Level['floorAt'] }).floorAt = (p) => {
    const f = floorAt0(p);
    if (!f || f.nav || magOpen()) return f;
    return { ...f, exits: f.exits.filter((e) => e.distanceToSquared(exitMag) > 1e-6) };
  };
  const api = level as unknown as Record<string, unknown>;
  api.navCases = NAV_CASES5;
  api.reachHints = {
    carry: [],
    // §3: `hatch5_mag` is one-way (magazine → armoury): a body on the exit stair / at its foot is let out on top
    oneway: [{ door: 'hatch5_mag', machine: 'tern', from: [20.3, -2.7, -27.8, 21.7, -0.3, -24.3], to: [21.0, 0, -23.8] }],
  };
  api.selfTest = () => selfTest(ctx, L, level, specs, G);
  api.grey = G.stats;
  api.list = () => ({ vignettes: [...L.vignettes.keys()], screens: [...L.screens.keys()], objects: [...L.objects.keys()] });
  if (ctx.debug.verbose) console.info(`[level5] grey grid ${G.stats.cells} cells → ${G.stats.quads} quads, ${G.stats.colliders} colliders in ${G.stats.ms.toFixed(0)} ms`);
  return level;
}

/** Floor tints per room (greybox readability). */
const FLOOR_TINT5: Record<RoomId5, number> = {
  lock5: 0x737b82, gate5: 0x7a8288, duty5: 0x80868a, ready5: 0x6c7377, spine5: 0x7b858c, berths5: 0x5e5a58, heads5: 0xb8bcbe,
  mess5: 0x86807a, galley5: 0x9aa0a2, arm5: 0x6e7478, sub5: 0x5f686e, dive5: 0x58606a, lockacc5: 0x5a6066, tunnel5: 0x666a6c,
};

/** Every §8.10 level marker (the playthrough asserts each exists; `mk5_radio` is the story's). */
export const MARKERS5 = [
  'mk5_start', 'mk5_gate_panel', 'mk5_aas_palm', 'mk5_c1_cam0', 'mk5_c1_cam1', 'mk5_c1_sol', 'mk5_c1_door', 'mk5_c1_out', 'mk5_c1_end',
  'mk5_duty_u1', 'mk5_duty_u2', 'mk5_s1', 'mk5_keypad', 'mk5_port', 'mk5_launch', 'mk5_wheel', 'mk5_tern_board', 'mk5_bunk_radio', 'mk5_onpost',
  'mk5_locker_slam', 'mk5_helmet_rest', 'mk5_trays', 'mk5_oilskin', 'mk5_taps', 'mk5_body_a', 'mk5_body_b', 'mk5_boots_stop', 'mk5_patrol_end',
  'mk5_exit_spine', 'mk5_exit_mag', 'mk5_vent_spine', 'mk5_drain_a', 'mk5_drain_b', 'mk5_dive_door', 'mk5_lockside_door', 'mk5_glass', 'tern',
];
/** Markers mounted on a wall / in a door plane / in a void (checked inside the room's bounds, not its 0.3 m inset). */
const WALL_MARKERS5 = new Set(['mk5_gate_panel', 'mk5_keypad', 'mk5_port', 'mk5_wheel', 'mk5_tern_board', 'mk5_onpost', 'mk5_dive_door', 'mk5_lockside_door', 'mk5_oilskin', 'mk5_glass', 'mk5_vent_spine', 'mk5_locker_slam', 'mk5_taps']);
/** Every §6.4 screen. */
export const SCREENS5 = ['gate_panel5', 'gate_log', 'aas_palm', 'onpost', 'dock_status', 'key5_panel', 'launch', 'launch5_palm', 'tern_board', 'tunnel_panel', 'cmd_panel'];
/** Every interactable the level makes (§6.3 readables, §8.4–§8.6). */
export const INTERACTABLES5 = [
  'note5_visitors', 'note5_watch', 'note5_roster', 'note5_locker', 'note5_mess', 'note5_arm', 'note5_mag', 'note5_dive',
  'key5_duty', 'radio5', 'wheel5', 'launch5_palm', 'hatch5_spine', 'hatch5_mag', 'hatch5_mag_plate',
];
/** Every vignette of §8.7 (each must have a snap). */
export const VIGNETTES5 = [
  'v5_turnstile', 'v5_hull_groan', 'v5_bunk_radio', 'v5_trays', 'v5_galley_shape', 'v5_water', 'v5_body', 'v5_boots', 'v5_magazine', 'v5_sub_check',
  'hatch5_spine_open', 'hatch5_mag_open', 'gate5_open', 'gate5_booth', 'lights_out5', 'dark5_on', 'key5_power', 'wheel5_turn', 'drain5_a', 'drain5_b',
  'cmd5_line', 'cmd5_port_look', 'vent5_spine',
];

// ───────────────────────────────────────────────────────────── self-test (check-reach runs it)

function selfTest(ctx: GameContext, L: LevelBuild, level: Level, specs: DoorSpec[], G: GreyGrid): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const t = (name: string, pass: boolean, detail = '') => { if (!pass) ok = false; lines.push(`${pass ? ' ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  t('14 rooms (< the 31-room visibility bitmask; §2.1 says 13 but lists 14)', level.rooms.length === 14, `${level.rooms.length}`);
  for (const id of ROOM_IDS5) {
    const r = level.rooms.find((q) => q.id === id), d = ROOMS5[id];
    const low = Math.min(d.y0, ...(d.floors ?? []).map((f) => f.y));
    t(`room ${id} floor ${d.y0}, bounds y ${low - 0.5} … ${d.y0 + d.h}`, !!r && roomFloor(r) === d.y0 && Math.abs(r.bounds.min.y - (low - 0.5)) < 1e-6 && Math.abs(r.bounds.max.y - (d.y0 + d.h)) < 1e-6);
    for (const [i, f] of (d.floors ?? []).entries()) {
      const rf = r?.floors?.[i];
      if (f.nav === false) t(`${id} floor ${i} (y ${f.y}) nav: false with ${f.exits?.length ?? 0} exits`, !!rf && rf.nav === false && (rf.exits?.length ?? 0) === (f.exits?.length ?? 0));
    }
  }
  for (const s of specs) {
    const d = L.doors.get(s.id) as DoorImpl | undefined;
    t(`${s.id}: floor ${s.y ?? 0}`, !!d && d.floor === (s.y ?? 0));
  }
  // walkable floor under every room / extra floor
  const down = V(0, -1, 0);
  const probe = (name: string, x: number, y: number, z: number) => {
    const h = ctx.physics.raycast(V(x, y + 1.0, z), down, 1.5);
    t(`${name}: walkable floor at (${x}, ${y}, ${z})`, !!h && Math.abs(h.point.y - y) < 0.02, h ? h.point.y.toFixed(3) : 'no hit');
  };
  const PROBE_AT: Partial<Record<RoomId5, [number, number]>> = { duty5: [2, -13], gate5: [-4, -2], ready5: [-4, -24], sub5: [24, -30], berths5: [18, -8], dive5: [47.5, -32], arm5: [18, -21], spine5: [10, -16], heads5: [15, -1], mess5: [29, -8], galley5: [31, 1] };
  for (const id of ROOM_IDS5) {
    const d = ROOMS5[id];
    const [cx, cz] = PROBE_AT[id] ?? [(d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2];
    probe(id, cx, d.y0, cz);
  }
  probe('crawl strip', 26, -1.4, -16);
  probe('crawl turn', 17, -1.4, -17.3);
  probe('armoury crawl', 17, -1.4, -19.2);
  probe('pit landing', 36.8, -1.4, -16.5);
  probe('magazine', 17, -2.6, -24.5);
  probe('west gallery', 23.6, 4.8, -30);
  probe('east gallery', 44.4, 4.8, -30);
  probe('north gallery', 34, 4.8, -19.6);
  probe('bridge', 30, 4.8, -35.5);
  probe('the shut spine lid (walkable)', 37.4, 0, -16.5);
  probe('the shut magazine lid (walkable)', 21.0, 0, -25.6);
  // the crawl: 1.35 m clear under the grating (crouch 1.1 ✓, stand 1.8 ✗); the grating is solid
  const up = V(0, 1, 0);
  const clear = (name: string, x: number, y: number, z: number, want: number) => {
    const h = ctx.physics.raycast(V(x, y + 0.05, z), up, 3);
    t(`${name}: head room ${want} m`, !!h && Math.abs(h.point.y - y - want) < 0.03, h ? `${(h.point.y - y).toFixed(3)} m` : 'none');
  };
  clear('crawl strip under the grating', 26, -1.4, -16, 1.35);
  clear('crawl turn under the spine floor', 17, -1.4, -17.3, 1.33);
  clear('armoury crawl', 17, -1.4, -19.2, 1.33);
  clear('magazine', 17, -2.6, -24.5, 2.5);
  const grating = ctx.physics.raycast(V(26, 1.2, -16), down, 3);
  t('the grating stops a ray (bullets, sight)', !!grating && Math.abs(grating.point.y) < 0.01, grating ? `${grating.surface} at y ${grating.point.y.toFixed(3)}` : 'no hit');
  const glassAt = (name: string, o: THREE.Vector3, dir: THREE.Vector3, want: number, axis: 'x' | 'z') => {
    const h = ctx.physics.raycast(o, dir, 6);
    t(`${name} is a glass collider`, !!h && h.surface === 'glass' && Math.abs(h.point[axis] - want) < 0.03, h ? `${h.surface} at ${axis} ${h.point[axis].toFixed(3)}` : 'no hit');
  };
  glassAt('booth glass (x 2.4)', V(1.0, 1.7, -2.0), V(1, 0, 0), 2.485, 'x');
  glassAt('the module port', V(42.5, 1.62, -16.0), V(1, 0, 0), 43.83, 'x');
  glassAt('the launch-lock port', V(34, 2.2, -54.0), V(0, 0, -1), -55.885, 'z');
  glassAt('the cold-room window', V(36.0, 1.5, 1.0), V(1, 0, 0), 37.765, 'x');
  const sealed = (name: string, o: THREE.Vector3, dir: THREE.Vector3) => { const h = ctx.physics.raycast(o, dir, 3); t(`${name} is solid`, !!h && h.distance < 2.0, h ? `hit at ${h.distance.toFixed(2)} m` : 'no hit'); };
  sealed('door5_tube', V(0, 1.2, 4.5), V(0, 0, 1));
  sealed('door5_cmd', V(42.5, 1.0, -16.6), V(1, 0, 0));
  sealed('door5_headend', V(15.5, 1.2, -53), V(-1, 0, 0));
  // markers / screens / interactables / vignettes (+ snaps) / machines
  const inside = (p: THREE.Vector3, inset: number) => {
    const r = level.roomAt(p);
    if (!r) return null;
    const b = r.bounds;
    return p.x >= b.min.x + inset && p.x <= b.max.x - inset && p.z >= b.min.z + inset && p.z <= b.max.z - inset ? r.id : null;
  };
  for (const m of MARKERS5) {
    const o = L.objects.get(m);
    if (!o) { t(`marker ${m}`, false, 'missing'); continue; }
    if (m === 'mk5_glass' || m === 'tern') { t(`marker ${m}`, true); continue; }
    if (m === 'mk5_oilskin') { const p = o.position; t('marker mk5_oilskin behind the galley window (cold room)', p.x > 38.2 && p.x < 39.4 && p.z > -0.2 && p.z < 2.2); continue; }
    const wallM = WALL_MARKERS5.has(m);
    const id = inside(o.position, wallM ? -0.05 : 0.5);
    t(`marker ${m} inside a room${wallM ? ' (wall / door mounted)' : ' interior (0.3 m inset)'}`, !!id, `${id ?? 'outside'} (${o.position.toArray().map((v) => +v.toFixed(2)).join(', ')})`);
  }
  for (const s of SCREENS5) t(`screen ${s}`, L.screens.has(s) || (s === 'cmd_panel' && L.screens.has('door5_cmd_panel')));
  for (const id of INTERACTABLES5) t(`interactable ${id}`, !!ctx.interactables.get(id));
  for (const v of VIGNETTES5) {
    const e = L.vignettes.get(v);
    t(`vignette ${v} (+ :snap)`, !!e && typeof e.snap === 'function', e ? (e.snap ? '' : 'no snap') : 'missing');
  }
  for (const m of ['tern', 'wheel5']) t(`machine ${m}`, L.machines.has(m));
  for (const id of ['hatch5_spine', 'hatch5_mag', 'vent5_spine_grille', 'drain5_a_grille', 'drain5_b_grille']) {
    const o = L.objects.get(id);
    t(`${id} is a registered mover`, !!o && !!ctx.physics.movers?.includes(o));
  }
  // spawns and pickups inside rooms (spawns 0.3 m inside the interior; pickups may sit at a wall face)
  for (const e of level.enemySpawns) t(`spawn ${e.id} (${e.type}) inside a room interior`, !!inside(e.position, 0.5), inside(e.position, 0.5) ?? 'outside');
  for (const pk of level.pickupSpawns) t(`pickup ${pk.id} inside a room`, !!inside(pk.position, 0.2), inside(pk.position, 0.2) ?? 'outside');
  // the crawl floors and the lower stairs are not nav: no node on a nav:false floor, none in the pit / mag hatch
  const navNo = level.nav.filter((n) => { const f = level.floorAt(n.position); return !!f && !f.nav && Math.abs(f.y - n.position.y) < 0.3; });
  t('no nav node on a nav: false floor (crawl, magazine)', navNo.length === 0, navNo.slice(0, 3).map((n) => `#${n.id} ${n.position.toArray().map((v) => v.toFixed(1))}`).join(' '));
  const inBox = (p: THREE.Vector3, b: number[]) => p.x > b[0] && p.x < b[3] && p.y > b[1] - 0.01 && p.y < b[4] && p.z > b[2] && p.z < b[5];
  const pitNodes = level.nav.filter((n) => inBox(n.position, PIT5) || inBox(n.position, MAGHATCH5));
  t('no nav node in the hatch pit / the magazine hatch', pitNodes.length === 0, `${pitNodes.length}`);
  const fa = level.floorAt(V(26, -1.4, -16)), fm = level.floorAt(V(17, -2.6, -24)), fs = level.floorAt(V(17, -2.0, -20.7));
  t('floorAt(crawl) → nav false + the spine exit only (magazine hatch shut)', !!fa && !fa.nav && fa.exits.length === 1 && fa.room === 'spine5', fa ? `${fa.room} floor ${fa.floor} y ${fa.y}` : 'null');
  t('floorAt(magazine) → nav false + one exit while the hatch is shut', !!fm && !fm.nav && fm.exits.length === 1 && fm.room === 'arm5', fm ? `${fm.room} floor ${fm.floor} y ${fm.y}` : 'null');
  t('floorAt(on STAIR5_MAG_IN) → nav false', !!fs && !fs.nav, fs ? `${fs.room} floor ${fs.floor} y ${fs.y}` : 'null');
  const fw = level.floorAt(V(37.9, 0, -14.8));
  t('floorAt(walkway) → the spine main floor (nav)', !!fw && fw.nav && fw.floor === -1);
  const cov = selfTestCover(ctx, level);
  if (!cov.ok) ok = false;
  lines.push(...cov.lines);
  t('grey grid built', G.stats.quads > 0 && G.stats.colliders > 0, `${G.stats.cells} cells, ${G.stats.quads} quads, ${G.stats.colliders} colliders, ${G.stats.ms.toFixed(0)} ms`);
  return { ok, lines };
}
