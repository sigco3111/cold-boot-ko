/**
 * COLD BOOT — level 4 "생물 시스템" (stage 3b, docs/plans/stage-3b.md §2–§3, §5, §8.8; task W4 greybox).
 *
 * Final coordinates, no dressing. Files:
 *   grey.ts    rooms (§2.1), one shell per room (structure, stand-ins, screens, interactables, markers), lights (§2.7),
 *              greybox placeholders for vignettes / machines / the arm cycle that other tasks own
 *   phases.ts  regions, the phase table A … G (+ D2, variants, nostory) with reach-check data, latches
 *   index.ts   doors (§2.2), triggers (§2.3), portals, pickups (§5.2), enemy spawns (§5.1), nav cases (§10.3)
 *
 * Dressing tasks export a `Partial<Record<RoomId4, RoomDress>>` from their file and are listed in `DRESSING`:
 *   entry.ts (D1a)  lock4, gown, shower, corr_n, wetlab, pi_office, node2
 *   clean.ts (D1b)  vivarium, cold, records, bay, corr_w, corr_s, corr_e (+ lights_out4)
 *   surgical.ts (D2) scrub, store4, gallery, theatre, stair4
 *   navy.ts (D3a)   lcorr, chk, guard, plant4
 *   tube.ts (D3b)   tube, gatel
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import { LevelBuild, roomFloor } from '../context';
import type { DoorImpl, DoorSpec } from '../doors';
import { defineInstances } from '../props';
import { assembleLevel, buildRooms, type PortalSpec } from '../assemble';
import type { TriggerSpec } from '../triggers';
import type { Builder } from '../builder';
import { GreyGrid, flatMat, placeLights, type LightRow, type Look } from '../l3/grey';
import {
  BODIES4, D2, ENVELOPE4, LIGHTS4, PANES4, ROOMS4, ROOM_IDS4, SHELLS4, STAIR4, placeholders4, stairLine, type RoomId4,
} from './grey';
import { REGIONS4, applyPhaseTo4, installPhases4, type PhaseId4 } from './phases';
import { ENTRY_DRESS } from './entry';
import { CLEAN_DRESS } from './clean';
import { SURGICAL_DRESS } from './surgical';
import { NAVY_DRESS } from './navy';
import { TUBE_DRESS } from './tube';

const PI = Math.PI;

// ───────────────────────────────────────────────────────────── dressing hook-up

/** What a dressing file may give a room (same contract as level 3; see grey.ts header). */
export interface RoomDress {
  /** Extra geometry / props / screens / vignettes, run after the room's shell inside its build pass (culled with the room). */
  build?(L: LevelBuild): void;
  /** Replaces the room's placeholder light table (`LIGHTS4[room]`); keep the §2.7 group names. */
  lights?: LightRow[];
  /** Materials of the shell faces looking into this room. */
  look?: Partial<Look>;
  /** false = no big greybox wayfinding label (the shell's `roomLabel`s are skipped). */
  label?: boolean;
}
/** Dressing tables, merged in order (later wins per room). */
const DRESSING: Partial<Record<RoomId4, RoomDress>>[] = [ENTRY_DRESS, CLEAN_DRESS, SURGICAL_DRESS, NAVY_DRESS, TUBE_DRESS];

// ───────────────────────────────────────────────────────────── doors (§2.2)

/** Labels name the room on the other side (front = seen from +z / +x). */
export function doors4(): DoorSpec[] {
  const z = (id: string, x: number, y: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x, y, z: zz, wall: 'z', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...o });
  const x = (id: string, xx: number, y: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x: xx, y, z: zz, wall: 'x', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...o });
  return [
    z('d4_inner', 0, D2, 0, '가운 착용실', '외부 록', ['lock4', 'gown'], { leafMat: 'painted_white', auto: false }),
    z('d4_shower_in', 0, D2, -6, '에어샤워', '가운 착용실', ['gown', 'shower'], { leafMat: 'stainless', auto: false }),
    z('d4_shower_out', 0, D2, -9, '청정 복도', '에어샤워', ['shower', 'corr_n'], { leafMat: 'stainless', auto: false }),
    x('d4_wet_w', -12, D2, -18, '청정 복도 — 서측', '습식 실험실 1', ['corr_w', 'wetlab'], { leafMat: 'wall_clean' }),
    x('d4_wet_e', 4, D2, -16, '습식 실험실 1', '책임 연구원', ['wetlab', 'pi_office']),
    x('d4_pi', 12, D2, -16, 'A. 순데 박사', '청정 복도 — 동측', ['pi_office', 'corr_e']),
    x('d4_viv', -15, D2, -22, '생물사육실 — 실험실 2', '청정 복도 — 서측', ['corr_w', 'vivarium']),
    x('d4_cold', -12, D2, -29, '청정 복도 — 서측', '냉장고 2', ['corr_w', 'cold'], { leafMat: 'stainless' }),
    x('d4_rec', 12, D2, -29, '기록 및 동의', '청정 복도 — 동측', ['records', 'corr_e']),
    x('d4_bay', 15, D2, -19, '청정 복도 — 동측', '유닛 베이 — 정비 유닛 전용', ['corr_e', 'bay'], { leafMat: 'painted_dark', auto: false }),
    z('d4_surg', 0, D2, -37, '수술 구역', '청정 복도 — 남측', ['corr_s', 'scrub'], { cyclingPrompt: '격리 유지' }),
    z('d4_gal', 0, D2, -43, '수술실 1 — 갤러리', '손소독실', ['scrub', 'gallery']),
    x('d4_store', 4, D2, -41, '손소독실', '무균 저장실 — 직원', ['scrub', 'store4'], { auto: false }),
    x('d4_gal_e', 10, D2, -45, '수술실 1 — 갤러리', '서비스 계단 B', ['gallery', 'stair4']),
    z('d4_stair_s', 12, 0, -59, '바이오시스 서비스층', '서비스 계단 B', ['stair4', 'lcorr'], { leafMat: 'navy_grey' }),
    x('d4_chk', 24, 0, -61, '바이오시스 서비스층', '해군 검문소 2', ['lcorr', 'chk']),
    x('d4_guard', 40, 0, -59, '해군 검문소 2', '경비실', ['chk', 'guard'], { leafMat: 'navy_grey' }),
    x('d4_plant', 46, 0, -59, '경비실', '튜브 플랜트 — 인가된 인원', ['guard', 'plant4'], { leafMat: 'navy_grey' }),
    z('d4_tube_n', 32, 0, -67, '이송 튜브 — 초소 4', '해군 검문소 2', ['chk', 'tube'], { cyclingPrompt: '부스에서 해제' }),
    z('d4_tube_s', 32, 0, -107, '초소 4 — 게이트 록', '이송 튜브', ['tube', 'gatel'], { cyclingPrompt: '게이트 록 순환 중' }),
  ];
}

const HW = 0.2;
/** Carve a door's opening through its 0.4 m wall and the slots its std leaves slide into (as level 3). */
function carveDoor(G: GreyGrid, s: DoorSpec) {
  const w = s.w ?? 1.6, h = s.h ?? 2.4, y = s.y ?? 0;
  const def = { rooms: [...new Set(s.rooms)], look: 'reveal' as const };
  const put = (u0: number, u1: number, y0: number, y1: number, v0: number, v1: number) => {
    G.air(`door:${s.id}`, s.wall === 'z' ? [s.x + u0, y0, s.z + v0, s.x + u1, y1, s.z + v1] : [s.x + v0, y0, s.z + u0, s.x + v1, y1, s.z + u1], def);
  };
  put(-w / 2, w / 2, y, y + h, -HW, HW);
  const end = w + 0.075;
  put(-end, -w / 2, y, y + h, -0.07, 0.07);
  put(w / 2, end, y, y + h, -0.07, 0.07);
}

// ───────────────────────────────────────────────────────────── triggers (§2.3)

const T = (id: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): TriggerSpec => ({ id, x0, x1, z0, z1, y0, y1 });
export const TRIGGERS4: TriggerSpec[] = [
  T('t4_lock', -1.8, 1.8, 0.2, 3.8, 4, 7),
  T('t4_gown', -3.8, 3.8, -5.8, -0.2, 4, 7),
  T('t4_shower', -1.8, 1.8, -8.8, -6.6, 4, 7),
  T('t4_clean', -14.8, 14.8, -11.8, -9.2, 4, 7),
  T('t4_wetwin', -11, 3, -11.8, -10.2, 4, 7),
  T('t4_viv', -26.8, -15.2, -29.8, -14.2, 4, 7),
  T('t4_viv_deep', -24.4, -21.4, -29.8, -14.2, 4, 7),
  T('t4_wet', -11.8, 3.8, -23.8, -12.2, 4, 7),
  T('t4_pi', 4.2, 11.8, -19.8, -12.2, 4, 7),
  T('t4_node2win', 12.2, 14.8, -24.5, -19.5, 4, 7),
  T('t4_cold', -11.8, -0.2, -33.8, -24.2, 4, 7),
  T('t4_rec', 0.2, 11.8, -33.8, -24.2, 4, 7),
  T('t4_surg_door', -2, 2, -36.8, -35.0, 4, 7),
  T('t4_scrub', -3.8, 3.8, -42.8, -37.2, 4, 7),
  T('t4_gallery', -9.8, 9.8, -46.8, -43.2, 4, 7),
  T('t4_stair_top', 10.2, 13.8, -46.8, -43.2, 4, 7),
  T('t4_stair_foot', 10.2, 13.8, -58.8, -56.0, -1, 3),
  T('t4_lcorr', 4.2, 23.8, -62.8, -59.2, -1, 3),
  T('t4_chk', 24.2, 39.8, -66.8, -55.2, -1, 3),
  T('t4_booth', 26.2, 29.8, -58.2, -55.4, -1, 3),
  T('t4_guard', 40.2, 45.8, -61.8, -56.2, -1, 3),
  T('t4_plant', 46.2, 55.8, -63.8, -54.2, -1, 4),
  T('t4_tube_0', 30.2, 33.8, -72, -67.2, -1, 3),
  T('t4_tube_1', 30.2, 33.8, -80, -72, -1, 3),
  T('t4_gatel', 29.2, 34.8, -112.8, -107.6, -1, 3),
];

// ───────────────────────────────────────────────────────────── visibility (portals)

const PORTALS4: PortalSpec[] = [
  ['lock4', 'gown', 'd4_inner', false],
  ['gown', 'shower', 'd4_shower_in', false],
  ['shower', 'corr_n', 'd4_shower_out', false],
  // the corridor loop's corners (always open)
  ['corr_n', 'corr_w', null, true], ['corr_n', 'corr_e', null, true], ['corr_s', 'corr_w', null, true], ['corr_s', 'corr_e', null, true],
  // glass (§8.8.3: corr_n–wetlab within 18 m, corr_e–node2 within 12 m). assemble.ts measures a see-through distance
  // from a door only: the nearest doors stand in as anchors (d4_shower_out 4 m from the windows' midpoint, d4_pi 6 m
  // from the Node 2 window) — when that door is open the far room is drawn anyway.
  ['corr_n', 'wetlab', 'd4_shower_out', 18],
  ['corr_e', 'node2', 'd4_pi', 12],
  ['gallery', 'theatre', null, true],
  ['corr_w', 'wetlab', 'd4_wet_w', false],
  ['wetlab', 'pi_office', 'd4_wet_e', false],
  ['pi_office', 'corr_e', 'd4_pi', false],
  ['corr_w', 'vivarium', 'd4_viv', false],
  ['corr_w', 'cold', 'd4_cold', false],
  ['records', 'corr_e', 'd4_rec', false],
  ['corr_e', 'bay', 'd4_bay', false],
  ['corr_s', 'scrub', 'd4_surg', false],
  ['scrub', 'gallery', 'd4_gal', false],
  ['scrub', 'store4', 'd4_store', false],
  ['gallery', 'stair4', 'd4_gal_e', false],
  ['stair4', 'lcorr', 'd4_stair_s', false],
  ['lcorr', 'chk', 'd4_chk', false],
  ['chk', 'guard', 'd4_guard', false],
  ['guard', 'plant4', 'd4_plant', false],
  ['chk', 'tube', 'd4_tube_n', false],
  ['tube', 'gatel', 'd4_tube_s', false],
];
/** Nav links through the four open corridor corners (door centres are added by assembleLevel). */
const NAV_PORTALS4 = [{ x: -13.5, y: D2, z: -12 }, { x: 13.5, y: D2, z: -12 }, { x: -13.5, y: D2, z: -34 }, { x: 13.5, y: D2, z: -34 }];

// ───────────────────────────────────────────────────────────── pickups (§5.2) and enemy spawns (§5.1)

function gameplay(L: LevelBuild) {
  L.pickup('p4_gown_med', 'medkit', 3.6, 6.0, -1.5, 35);
  L.pickup('p4_viv_ammo', 'ammo_pistol', -25.0, 5.7, -16.6, 12);
  L.pickup('p4_wet_ammo', 'ammo_pistol', 2.5, 5.75, -14.0, 12);
  L.pickup('p4_pi_med', 'medkit', 10.5, 5.7, -13.5, 35);
  L.pickup('p4_rec_ammo', 'ammo_pistol', 2.4, 5.6, -26.6, 12);
  L.pickup('p4_rec_shells', 'ammo_shotgun', 3.6, 5.6, -26.6, 6);
  L.pickup('p4_cold_med', 'medkit', -11.55, 6.0, -27.2, 35);
  L.pickup('p4_scrub_med', 'medkit', -3.6, 5.7, -38.0, 35);
  L.pickup('p4_scrub_shells', 'ammo_shotgun', -3.6, 5.7, -38.4, 6);
  L.pickup('p4_lcorr_med', 'medkit', 20.0, 1.2, -62.75, 35);
  L.pickup('p4_lcorr_ammo', 'ammo_pistol', 20.4, 1.2, -62.75, 12);
  L.pickup('p4_booth_med', 'medkit', 27.0, 1.3, -55.6, 35);
  // the carbine: "clip 30 + 60" — the amount is the rounds it brings (W1's give() fills the clip first)
  L.pickup('p4_carbine', 'carbine', 39.55, 1.2, -64.5, 90, PI / 2);
  L.pickup('p4_vest_1', 'vest', 39.55, 1.4, -63.4, 50, PI / 2);
  L.pickup('p4_vest_2', 'vest', 39.55, 1.4, -65.6, 50, PI / 2);
  L.pickup('p4_cage_ammo', 'ammo_carbine', 38.0, 0.9, -66.5, 30);
  L.pickup('p4_cage_plate', 'plate', 36.0, 0.4, -66.4, 15);
  L.pickup('p4_guard_plate', 'plate', 44.0, 0.9, -56.4, 15);
  L.pickup('p4_guard_shells', 'ammo_shotgun', 44.4, 0.9, -56.4, 6);
  L.pickup('p4_plant_plate', 'plate', 54.8, 0.9, -61.6, 15);
  L.pickup('p4_plant_ammo', 'ammo_carbine', 55.2, 0.9, -61.6, 30);
  L.pickup('p4_plant_med', 'medkit', 54.8, 0.9, -62.1, 35);
  L.pickup('p4_tube_plate', 'plate', 30.6, 0.4, -86.6, 15);
  L.pickup('p4_tube_ammo', 'ammo_carbine', 33.4, 0.4, -86.6, 30);

  const lab = { skin: 'lab' as const }, navy = { skin: 'navy' as const };
  // dormant from load (R4: harmless until their rules)
  L.enemy('g4_wet', 'husk', 'dormant', -6.0, D2, -22.6, 0, 'bench', 'worker', lab);
  L.enemy('g4_rec', 'husk', 'dormant', 6.5, D2, -33.4, PI, 'slumped', undefined, lab);
  L.enemy('g4_lower', 'sentry', 'dormant', 16.5, 2.85, -61.0, 0, 'ceiling', undefined, lab);
  L.enemy('g4_chk_sentry', 'sentry', 'dormant', 28.0, 3.6, -56.8, 0, 'ceiling', undefined, navy);
  // spawn mode only (nothing hostile exists before its beat)
  // vivarium skitters under the solid ceiling beside the vent (ceiling 8.2: emerge's 0.9 m up-ray hits it at 0.05 m)
  L.enemy('g4_viv', 'skitter', 'spawn', -23.7, 8.1, -22.0, 0);
  L.enemy('g4_viv', 'skitter', 'spawn', -22.1, 8.1, -22.0, 0);
  for (const [px, pz] of [[17.0, -18.2], [18.6, -19.6], [17.0, -20.6]] as const) L.enemy('g4_bay', 'husk', 'spawn', px, D2, pz, PI / 2, undefined, undefined, lab);
  // g4_vent_a / g4_vent_b: the story spawns the pair at the vent farther from the player (§4.3)
  L.enemy('g4_vent_a', 'skitter', 'spawn', -6.8, 7.7, -35.5, 0);
  L.enemy('g4_vent_a', 'skitter', 'spawn', -5.2, 7.7, -35.5, 0);
  L.enemy('g4_vent_b', 'skitter', 'spawn', 5.2, 7.7, -35.5, 0);
  L.enemy('g4_vent_b', 'skitter', 'spawn', 6.8, 7.7, -35.5, 0);
  L.enemy('g4_store', 'husk', 'spawn', 5.4, D2, -40.2, PI / 2, undefined, undefined, lab);
  L.enemy('g4_store', 'husk', 'spawn', 6.8, D2, -41.8, PI / 2, undefined, undefined, lab);
  // plant-room skitters in the floor sump (emerge, as l2/relay.ts)
  L.enemy('g4_plant', 'skitter', 'spawn', 51.8, -0.3, -62.0, 0);
  L.enemy('g4_plant', 'skitter', 'spawn', 52.2, -0.3, -62.0, 0);
  for (const [px, pz] of [[31.0, -110.0], [33.0, -110.0], [32.0, -111.6]] as const) L.enemy('g4_tube', 'husk', 'spawn', px, 0, pz, PI, undefined, undefined, navy);
  L.enemy('g4_tube', 'skitter', 'spawn', 30.6, 0, -112.2, PI);
  L.enemy('g4_tube', 'skitter', 'spawn', 33.4, 0, -112.2, PI);
}

/** §8.10 markers that are lists, not points. */
function storyMarkers(L: LevelBuild) {
  // where the dressing really put each body (setpieces `body()` registers `{ name, position }`); the plan's point
  // only for a body no dressing placed
  const placed = new Map<string, number[]>();
  for (const e of (L.objects.get('mk4_bodies')?.userData.list ?? []) as { name?: string; position?: number[] }[]) {
    if (e?.name && Array.isArray(e.position) && e.position.length >= 3) placed.set(e.name, e.position.slice(0, 3));
  }
  L.marker('mk4_bodies', 0, 0, 0).userData.list = BODIES4.map((b) => ({ name: b.name, p: placed.get(b.name) ?? [...b.p] }));
  L.marker('mk4_glass', 0, 0, 0).userData.panes = PANES4.map((p) => ({ id: p.id, box: [...p.box] }));
}

// ───────────────────────────────────────────────────────────── nav cases (scripts/check-nav.mjs, §10.3)

/**
 * §10.3 cases. Time bounds (correction): the plan's bounds assume running husks; an alerted husk here WALKS (1.3 m/s,
 * husk.ts — it runs only within 7.5 m with sight, or raged, which the story's `rouse` does). Bounds = shortest path
 * at walk speed + door / turn margin: bay → cold 53 m (wet-lab cross-link) 50 s; bay → scrub 37 m 40 s;
 * store → plant 69 m 65 s; gate lock → tube mid 30 m 32 s; worker → corr_n 28 m 28 s; vivarium (round pen row B,
 * 22 m) 22 s; records → corr_e 15 s as planned.
 */
export const NAV_CASES4 = {
  reach: [
    { id: 'bay_cold', phase: 'D_bay', label: 'g4_bay husk → player at the cold-store back (bay, corr_e, corr_s, corr_w, cold)', spawn: [17, D2, -19], player: [-1, D2, -29], within: 50 },
    { id: 'bay_scrub', phase: 'D_bay', label: 'g4_bay husk → player in the scrub room (corr_e, corr_s, d4_surg)', spawn: [17, D2, -19], player: [0, D2, -40], within: 40 },
    { id: 'store_plant', phase: 'D_store', label: 'g4_store husk → player in the plant room (scrub, gallery, stair, lcorr, chk, guard)', spawn: [6, D2, -41], player: [50, 0, -59], within: 65, via: ['stair'] },
    { id: 'sump_valve', phase: 'D', label: 'sump skitter (landed) → player at the valve', spawn: [52, 0, -62], player: [55, 0, -59], within: 5 },
    { id: 'gatel_tube', phase: 'F_open', label: 'g4_tube husk in the gate lock → player mid-tube', spawn: [32, 0, -110], player: [32, 0, -80], within: 32 },
    { id: 'wet_corr', phase: 'D', label: 'g4_wet worker → player in corr_n (wetlab, d4_wet_w, corr_w)', spawn: [-6, D2, -22.6], player: [0, D2, -10.5], within: 28 },
    { id: 'rec_corr', phase: 'D', label: 'g4_rec husk → player in corr_e at the Node 2 window', spawn: [6.5, D2, -33.4], player: [13.5, D2, -20], within: 15 },
    { id: 'viv_corr', phase: 'D', label: 'g4_viv skitter (landed) → player in corr_w at the cold store', spawn: [-22.9, D2, -22], player: [-13.5, D2, -30], within: 22 },
  ],
  /** Sealed: the player latched in the gate lock (d4_tube_s locked): a husk in the tube stands off, comes when it opens. */
  standOff: { id: 'standoff_gatel', label: 'd4_tube_s locked, player in the gate lock: husk in the tube stands off, comes when it opens', door: 'd4_tube_s', spawn: [32, 0, -95], player: [32, 0, -110.5], hold: 20, within: 20 },
  sentries: [
    { id: 'sentry_lower', label: 'g4_lower (Bio sentry) from its dock → player at the stair foot', spawn: [16.5, 2.85, -61.0], player: [12, 0, -57.6], within: 20 },
    { id: 'sentry_chk', label: 'g4_chk_sentry from its dock over the booth → player in the plant room', spawn: [28.0, 3.6, -56.8], player: [50, 0, -59], within: 50 },
  ],
  ramp: (() => {
    const { a, b } = stairLine(STAIR4);
    const mid = [a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return { stair: 0, standAt: mid, top: [a[0], D2, -45.6], bottom: [a[0], 0, -57.6], trips: 5, away: [52, 0, -57] };
  })(),
  /** Never entered: the theatre floor and the sealed Node 2 room (seen through glass only). */
  ignoreFloors: ['theatre:main', 'node2:main'],
};

// ───────────────────────────────────────────────────────────── level

export async function createLevel4(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  const L = new LevelBuild(ctx);
  ctx.scene.add(L.root);
  defineInstances(L);

  const dress: Partial<Record<RoomId4, RoomDress>> = {};
  for (const t of DRESSING) for (const [k, v] of Object.entries(t)) dress[k as RoomId4] = { ...dress[k as RoomId4], ...v };

  const G = new GreyGrid(ENVELOPE4);
  const standin = flatMat(L, 0x7d8186, 'grey_standin');
  const glass = L.ctx.materials.get('glass');
  const noLabel = (b: Builder) => new Proxy(b, { get: (t, p) => (p === 'sign' ? () => t : (t as unknown as Record<string | symbol, unknown>)[p as string]) }) as Builder;
  const specs = doors4();

  buildRooms(L, ROOM_IDS4.map((id) => [id, (l: LevelBuild) => {
    const r = ROOMS4[id];
    l.room(id, r.name, r.x0, r.x1, r.z0, r.z1, r.h, { y0: r.y0, floors: r.floors });
    const b = l.builder(`${id}_grey`);
    const d = dress[id];
    SHELLS4[id]({ L: l, G, b: d?.label === false ? noLabel(b) : b, standin, glass });
    d?.build?.(l);
    placeLights(l, d?.lights ?? LIGHTS4[id]);
  }] as const), lap);
  for (const s of specs) carveDoor(G, s);
  gameplay(L);
  storyMarkers(L);
  placeholders4(L);

  const wall = flatMat(L, 0xc9cdd0, 'grey_wall'), ceil = flatMat(L, 0x9a9ea2, 'grey_ceiling'), reveal = flatMat(L, 0xa4a7aa, 'grey_reveal');
  const floors = new Map<string, THREE.Material>();
  G.build(L, (room) => {
    if (room === 'reveal') return { floor: reveal, wall: reveal, ceiling: reveal };
    let f = floors.get(room);
    if (!f) floors.set(room, (f = flatMat(L, FLOOR_TINT4[room as unknown as RoomId4] ?? 0x9a9a9a, `grey_floor_${room}`)));
    return { floor: f, wall, ceiling: ceil, ...dress[room as unknown as RoomId4]?.look };
  });
  lap('grey');

  const level = assembleLevel(ctx, L, {
    doors: specs,
    frameZone: (s) => { const rooms = [...new Set(s.rooms)].sort(); return { name: `frames4_${rooms.join('+')}`, rooms }; },
    portals: PORTALS4,
    seeRange: 22,
    triggers: TRIGGERS4,
    navPortals: NAV_PORTALS4,
    navStep: (id) => (id === 'theatre' ? 2.0 : 1.0),
    navStart: { x: 0, y: D2, z: 2.6 },
    spawn: { position: new THREE.Vector3(0, D2, 2.6), yaw: 0 },
    startRoom: 'lock4',
    regions: REGIONS4(),
    timings, t0,
  });
  installPhases4(ctx, level);
  // initial door state: the story starts in phase A; `?nostory=1` follows the nostory column (§3)
  applyPhaseTo4(level, (ctx.debug.noStory ? 'nostory' : 'A') as PhaseId4);
  for (const m of ['theatre_arm', 'cold_jam']) level.setMachine(m, 'active');

  const api = level as unknown as Record<string, unknown>;
  api.navCases = NAV_CASES4;
  api.selfTest = () => selfTest(ctx, L, level, specs, G);
  api.grey = G.stats;
  api.list = () => ({ vignettes: [...L.vignettes.keys()], screens: [...L.screens.keys()], objects: [...L.objects.keys()] });
  if (ctx.debug.verbose) console.info(`[level4] grey grid ${G.stats.cells} cells → ${G.stats.quads} quads, ${G.stats.colliders} colliders in ${G.stats.ms.toFixed(0)} ms`);
  return level;
}

/** Floor tints per room (greybox readability): white clean side, grey navy level. */
const FLOOR_TINT4: Record<RoomId4, number> = {
  lock4: 0xe2e4e6, gown: 0xd8dcde, shower: 0xc8ccd0, corr_n: 0xd4d8d8, corr_w: 0xd4d8d8, corr_e: 0xd4d8d8, corr_s: 0xd4d8d8,
  wetlab: 0xc9d4d6, pi_office: 0xb8b2a6, node2: 0x50585e, cold: 0xcfe0ec, records: 0xbcb8ae, vivarium: 0xc4ccc4, bay: 0x6a6e72,
  scrub: 0xc8d2d6, store4: 0xb0b4b8, gallery: 0xa8b0b6, theatre: 0x8a969c, stair4: 0x8e959a, lcorr: 0x7b858c, chk: 0x6f7a80,
  guard: 0x7a7670, plant4: 0x6a7076, tube: 0x5c666e, gatel: 0x66707a,
};

/** Every §8.10 marker (the playthrough asserts each exists). */
export const MARKERS4 = [
  'mk4_start', 'mk4_decon_panel', 'mk4_gate_panel', 'mk4_booth', 'mk4_gauge', 'mk4_bodies', 'mk4_wet_win', 'mk4_node2_win', 'mk4_roster',
  'mk4_video', 'mk4_cold_panel', 'mk4_gallery_spk', 'mk4_glass', 'mk4_vent_viv', 'mk4_vent_s_a', 'mk4_vent_s_b', 'mk4_sump', 'mk4_bay_door',
  'mk4_store_door', 'mk4_cold_rack', 'theatre_arm',
];
/** Every §6.4 screen. */
export const SCREENS4 = [
  'decon_panel', 'shower_in_panel', 'shower_out_panel', 'fumig_status', 'surg_hold', 'cold_panel', 'node2_screen', 'pi_video', 'theatre_screen',
  'theatre_cam', 'roster', 'booth_panel', 'tube_n_panel', 'plant_gauge', 'gate_panel',
];

// ───────────────────────────────────────────────────────────── self-test (check-reach runs it)

function selfTest(ctx: GameContext, L: LevelBuild, level: Level, specs: DoorSpec[], G: GreyGrid): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const t = (name: string, pass: boolean, detail = '') => { if (!pass) ok = false; lines.push(`${pass ? ' ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  t('25 rooms (< the 31-room visibility bitmask)', level.rooms.length === 25, `${level.rooms.length}`);
  for (const id of ROOM_IDS4) {
    const r = level.rooms.find((q) => q.id === id), d = ROOMS4[id];
    t(`room ${id} floor ${d.y0}`, !!r && roomFloor(r) === d.y0 && Math.abs(r.bounds.min.y - (d.y0 - 0.5)) < 1e-6 && Math.abs(r.bounds.max.y - (d.y0 + d.h)) < 1e-6);
  }
  for (const s of specs) {
    const d = L.doors.get(s.id) as DoorImpl | undefined;
    t(`${s.id}: floor ${s.y ?? 0}`, !!d && d.floor === (s.y ?? 0));
  }
  // walkable floor under every room / extra floor (the theatre and node2 too: they are floors, never entered)
  const down = V(0, -1, 0);
  const probe = (name: string, x: number, y: number, z: number) => {
    const h = ctx.physics.raycast(V(x, y + 1.0, z), down, 1.5);
    t(`${name}: walkable floor at (${x}, ${y}, ${z})`, !!h && Math.abs(h.point.y - y) < 0.02, h ? h.point.y.toFixed(3) : 'no hit');
  };
  for (const id of ROOM_IDS4) {
    const d = ROOMS4[id];
    // (the stair room's centre is the flight; probe its bottom landing; the gown's centre is the bench row)
    const cz = id === 'stair4' ? -57.5 : id === 'gown' ? -1.5 : id === 'plant4' ? -59 : (d.z0 + d.z1) / 2;
    const cx = id === 'chk' ? 32 : (d.x0 + d.x1) / 2;
    probe(id, cx, d.y0, cz);
    for (const f of d.floors ?? []) probe(`${id} (extra floor)`, (f.box[0] + f.box[1]) / 2, f.y, (f.box[2] + f.box[3]) / 2);
  }
  const glassAt = (name: string, o: THREE.Vector3, dir: THREE.Vector3, want: number, axis: 'x' | 'z') => {
    const h = ctx.physics.raycast(o, dir, 6);
    t(`${name} is a glass collider`, !!h && h.surface === 'glass' && Math.abs(h.point[axis] - want) < 0.03, h ? `${h.surface} at ${axis} ${h.point[axis].toFixed(3)}` : 'no hit');
  };
  glassAt('gallery glazing (z −47)', V(0, 6.45, -45), V(0, 0, -1), -46.985, 'z');
  glassAt('wet-lab windows (z −12)', V(-4, 6.35, -10.5), V(0, 0, -1), -11.985, 'z');
  glassAt('Node 2 window (x 12)', V(13.5, 6.4, -22), V(-1, 0, 0), 12.015, 'x');
  glassAt('tube west pane (x 30)', V(32, 1.7, -80), V(-1, 0, 0), 30.015, 'x');
  glassAt('tube east pane (x 34)', V(32, 1.7, -95), V(1, 0, 0), 33.985, 'x');
  glassAt('booth south glass', V(28, 1.7, -60), V(0, 0, 1), -58.315, 'z');
  // the sealed props stop a body; the bulkhead ring narrows the tube
  const sealed = (name: string, o: THREE.Vector3, dir: THREE.Vector3) => { const h = ctx.physics.raycast(o, dir, 3); t(`${name} is solid`, !!h && h.distance < 2.0, h ? `hit at ${h.distance.toFixed(2)} m` : 'no hit'); };
  sealed('d4_outer', V(0, D2 + 1.2, 2.6), V(0, 0, 1));
  sealed('door4_theatre', V(6, 1.2, -61), V(0, 0, 1));
  sealed('gate4', V(32, 1.2, -111), V(0, 0, -1));
  const ring = ctx.physics.raycast(V(30.45, 1.2, -85), V(0, 0, -1), 4);
  t('bulkhead ring at z −86.75 (opening 2.6 m)', !!ring && Math.abs(ring.point.z + 86.75) < 0.03, ring ? `z ${ring.point.z.toFixed(3)}` : 'no hit');
  for (const m of MARKERS4) t(`marker ${m}`, !!L.objects.get(m));
  for (const s of SCREENS4) t(`screen ${s}`, L.screens.has(s));
  t('mk4_bodies lists 10', (L.objects.get('mk4_bodies')?.userData.list as unknown[] | undefined)?.length === 10);
  t('grey grid built', G.stats.quads > 0 && G.stats.colliders > 0, `${G.stats.cells} cells, ${G.stats.quads} quads, ${G.stats.colliders} colliders, ${G.stats.ms.toFixed(0)} ms`);
  return { ok, lines };
}
