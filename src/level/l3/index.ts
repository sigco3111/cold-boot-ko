/**
 * COLD BOOT — level 3 "고요한 쪽" (stage 3a, docs/plans/stage-3a.md §2–§3, §5, §7; task K5 greybox).
 *
 * Final coordinates, no dressing. Files:
 *   grey.ts    rooms (§2.1), the shell kernel (GreyGrid), one shell function per room, placeholder light tables
 *   phases.ts  regions, the phase table A … J + nostory with reach-check data, latches
 *   index.ts   doors (§2.2), triggers (§2.3), portals, pickups (§5.3), enemy spawns (§5.2), nav, dressing hook-up
 *
 * Dressing tasks (P3a north.ts / office.ts, P3b atrium.ts / kit3.ts, P3c south.ts) export a
 * `Partial<Record<RoomId3, RoomDress>>` and are listed in `DRESSING` below (one import + one array entry each).
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import { LevelBuild, roomFloor } from '../context';
import { pitProblems, type DoorImpl, type DoorSpec } from '../doors';
import { sealedDoor } from '../kit';
import { defineInstances } from '../props';
import { assembleLevel, buildRooms, type PortalSpec } from '../assemble';
import type { TriggerSpec } from '../triggers';
import type { Builder } from '../builder';
import {
  D2, GreyGrid, HW, LIGHTS3, ROOMS3, ROOM_IDS3, SHELLS3, STAIR_ATR, STAIR_W, flatMat, placeLights, stairLine,
  type LightRow, type Look, type RoomId3,
} from './grey';
import { REGIONS3, applyPhaseTo, installPhases3, type PhaseId3 } from './phases';
import { NORTH_DRESS } from './north';
import { OFFICE_DRESS } from './office';
import { ATRIUM_DRESS } from './atrium';
import { SOUTH_DRESS } from './south';

const PI = Math.PI;

// ───────────────────────────────────────────────────────────── dressing hook-up

/** What a dressing file may give a room (see grey.ts header). */
export interface RoomDress {
  /** Extra geometry / props / screens, run after the room's shell inside its build pass (culled with the room). */
  build?(L: LevelBuild): void;
  /** Replaces the room's placeholder light table (`LIGHTS3[room]`). */
  lights?: LightRow[];
  /** Materials of the shell faces looking into this room. */
  look?: Partial<Look>;
  /** false = no big greybox wayfinding label (the shell's `roomLabel`s are skipped). */
  label?: boolean;
}
/** Dressing tables, merged in order (later wins per room). P3a / P3b / P3c add theirs here. */
const DRESSING: Partial<Record<RoomId3, RoomDress>>[] = [NORTH_DRESS, OFFICE_DRESS, ATRIUM_DRESS, SOUTH_DRESS];

// ───────────────────────────────────────────────────────────── doors (§2.2)

const glassLeaf = 'glass' as const;
export function doors3(L: LevelBuild): DoorSpec[] {
  const wood = flatMat(L, 0x8a6a4c, 'grey_wood');
  const cab = (id: string, x: number, z: number, name: string, north: boolean): DoorSpec => ({
    id, x, z, wall: 'z', kind: 'std', locked: true, leafMat: wood, rooms: ['quarters', 'quarters'],
    // north row: the quarters side is −z (labelBack); south row: +z (labelFront)
    labelFront: north ? '링 A' : name, labelBack: north ? name : '링 A',
  });
  return [
    { id: 'd3_lift', x: 0, y: D2, z: 0, wall: 'z', kind: 'std', locked: true, leafMat: 'painted_white', labelFront: '압력 록', labelBack: '서비스 리프트', rooms: ['lift3', 'lock'] },
    { id: 'd3_pressure', x: 0, y: D2, z: -7, wall: 'z', kind: 'wide', locked: true, leafMat: 'painted_yellow', duration: 2.6, auto: false, labelFront: '주거 링', labelBack: '압력 록', rooms: ['lock', 'gallery_n'] },
    { id: 'd3_lobby', x: -12, y: D2, z: -9.5, wall: 'x', kind: 'std', locked: true, leafMat: glassLeaf, labelFront: '주거 로비', labelBack: '북쪽 갤러리', rooms: ['gallery_n', 'lobby'] },
    { id: 'd3_lobby_inner', x: -20, y: D2, z: -9, wall: 'x', kind: 'std', locked: true, leafMat: wood, labelFront: '시설팀 — 직원', labelBack: '주거 로비', rooms: ['lobby', 'admin'] },
    { id: 'd3_office', x: -30, y: D2, z: -20, wall: 'z', kind: 'std', locked: true, leafMat: wood, labelFront: 'P. 할보센 — 시설팀', labelBack: '시설팀 사무실', rooms: ['admin', 'office'] },
    { id: 'd3_stair_w', x: -20, y: D2, z: -18.5, wall: 'x', kind: 'std', locked: true, labelFront: '시설팀 — 직원', labelBack: '서쪽 계단', rooms: ['stair_w', 'admin'] },
    { id: 'd3_canteen', x: -17.5, z: -34, wall: 'z', kind: 'std', locked: false, labelFront: '식당', labelBack: '서쪽 계단', rooms: ['stair_w', 'canteen'] },
    { id: 'd3_canteen_atr', x: -12, z: -39, wall: 'x', kind: 'std', w: 2.4, locked: false, leafMat: glassLeaf, labelFront: '식당', labelBack: '정원 아트리움', rooms: ['atrium', 'canteen'] },
    { id: 'd3_kitchen', x: -21, z: -46, wall: 'z', kind: 'std', locked: true, leafMat: 'painted_white', labelFront: '주방 — 직원 전용', labelBack: '식당', rooms: ['canteen', 'kitchen'] },
    {
      id: 'd3_shutter_ne', x: 10.5, y: D2, z: -12, wall: 'z', kind: 'std', w: 2.6, h: 2.8, duration: 1.8, frame: false, leafStyle: 'sheet', auto: false,
      panel: [0, 2.95, 0.215], locked: true, leafMat: 'painted_dark', labelFront: '', labelBack: '', rooms: ['gallery_n', 'atrium'],
    },
    { id: 'd3_clinic', x: 12, z: -19, wall: 'x', kind: 'std', locked: false, leafMat: 'glass_thick', labelFront: '정원 아트리움', labelBack: '진료실', rooms: ['clinic', 'atrium'] },
    { id: 'd3_quarters', x: 12, z: -31, wall: 'x', kind: 'std', locked: false, leafMat: glassLeaf, labelFront: '정원 아트리움', labelBack: '링 A', rooms: ['quarters', 'atrium'] },
    cab('d3_q1', 15, -28, 'L. 모엔', true), cab('d3_q2', 19, -28, 'A. & J. 칼센', true), cab('d3_q3', 23, -28, 'S. 비크', true),
    cab('d3_q4', 15, -34, 'D. 오예라란', false), cab('d3_q5', 19, -34, 'R. 브란트', false), cab('d3_q6', 23, -34, 'T. 할보센', false),
    { id: 'd3_ring_e', x: 28, z: -31, wall: 'x', kind: 'std', locked: true, leafMat: 'painted_dark', labelFront: '링 A', labelBack: '링 A — 동측', rooms: ['ring_e', 'quarters'] },
    { id: 'd3_bio', x: 12, y: D2, z: -38, wall: 'x', kind: 'std', locked: true, auto: false, leafMat: 'painted_white', labelFront: '주거 링', labelBack: '생물 시스템', rooms: ['bio_lock', 'atrium'] },
    // (stage 3b D4 / D19: the BIO lock's inner door never opens in 3a — `d3_bio_inner` is a static sealed prop now,
    // see `bioInner` below; 3b starts in its own copy of this lock)
  ];
}

/**
 * Stage 3b §8.8.4 (D19): the BIO lock's inner door (16, 4.8, −38) — a static `sealedDoor` (no Door, no phase state),
 * seen only from inside the lock; unpowered panels ("제염 — 대기 중" is the lock's own `bio_panel`).
 */
function bioInner(L: LevelBuild, G: GreyGrid) {
  G.air('door:d3_bio_inner', [16 - HW, D2, -38.8, 16 + HW, D2 + 2.4, -37.2], { rooms: ['bio_lock'], look: 'reveal' });
  const b = L.namedBuilder('sealed:d3_bio_inner');
  b.rooms = ['bio_lock'];
  sealedDoor(L, b, {
    id: 'd3_bio_inner', x: 16, y: D2, z: -38, wall: 'x', kind: 'std', sides: 'back', status: 'dark', leafMat: 'painted_white',
    labelBack: '생물 시스템',
  });
}

/** Carve a door's opening through its 0.4 m wall, the slots its std leaves slide into, nothing else. */
function carveDoor(G: GreyGrid, s: DoorSpec) {
  const std = s.kind === 'std';
  const w = std ? s.w ?? 1.6 : 3.0, h = std ? s.h ?? 2.4 : 2.8, y = s.y ?? 0;
  const rooms = [...new Set(s.rooms)];
  const def = { rooms, look: 'reveal' as const };
  // (u along the opening, v across the wall) → world box
  const put = (u0: number, u1: number, y0: number, y1: number, v0: number, v1: number) => {
    G.air(`door:${s.id}`, s.wall === 'z' ? [s.x + u0, y0, s.z + v0, s.x + u1, y1, s.z + v1] : [s.x + v0, y0, s.z + u0, s.x + v1, y1, s.z + u1], def);
  };
  put(-w / 2, w / 2, y, y + h, -HW, HW);
  if (std) {
    // each leaf (w/2 + 0.02 wide) slides by w/2 + 0.02: slot to w + 0.075, ±0.07 thick, 6 cm above the opening
    // (the slot stops at the opening's head: the leaves' top 2 cm run inside the lintel, no thin strip above them)
    const end = w + 0.075;
    put(-end, -w / 2, y, y + h, -0.07, 0.07);
    put(w / 2, end, y, y + h, -0.07, 0.07);
  }
}

// ───────────────────────────────────────────────────────────── triggers (§2.3)

export const TRIGGERS3: TriggerSpec[] = [
  { id: 't3_lift', x0: -2, x1: 2, z0: 0.2, z1: 5, y0: 4, y1: 7 },
  { id: 't3_lock', x0: -3, x1: 3, z0: -6.6, z1: -0.8, y0: 4, y1: 7 },
  { id: 't3_pdoor', x0: -2.5, x1: 2.5, z0: -7, z1: -4.6, y0: 4, y1: 7 },
  { id: 't3_gallery', x0: -12, x1: 12, z0: -11.8, z1: -8.2, y0: 4, y1: 7 },
  { id: 't3_lobby', x0: -20, x1: -12.2, z0: -14, z1: -4, y0: 4, y1: 7 },
  { id: 't3_lobby_inner', x0: -20, x1: -18.4, z0: -10.6, z1: -7.4, y0: 4, y1: 7 },
  { id: 't3_admin', x0: -34, x1: -20.2, z0: -20, z1: -2, y0: 4, y1: 7 },
  { id: 't3_office', x0: -34, x1: -26, z0: -28, z1: -20.2, y0: 4, y1: 7 },
  { id: 't3_office_out', x0: -32, x1: -28, z0: -19.4, z1: -17, y0: 4, y1: 7 },
  { id: 't3_stair_w', x0: -20, x1: -15, z0: -34, z1: -16, y0: -1, y1: 7 },
  { id: 't3_canteen', x0: -24, x1: -12.2, z0: -46, z1: -34, y0: -1, y1: 3 },
  { id: 't3_garden', x0: -11.8, x1: 8.9, z0: -44, z1: -12, y0: -1, y1: 2.5 },
  { id: 't3_balcony', x0: 9, x1: 12, z0: -40, z1: -12, y0: 4, y1: 7 },
  { id: 't3_landing', x0: 5.5, x1: 12, z0: -32, z1: -29, y0: 4, y1: 7 },
  { id: 't3_bio_door', x0: 9, x1: 12, z0: -40, z1: -35, y0: 4, y1: 7 },
  { id: 't3_bio_lock', x0: 12.6, x1: 16, z0: -40, z1: -36, y0: 4, y1: 7 },
  { id: 't3_clinic', x0: 12.2, x1: 20, z0: -24, z1: -14, y0: -1, y1: 3 },
  { id: 't3_quarters', x0: 12.2, x1: 28, z0: -34, z1: -28, y0: -1, y1: 3 },
  { id: 't3_q3', x0: 21.5, x1: 24.5, z0: -30.5, z1: -28.2, y0: -1, y1: 3 },
  { id: 't3_viewport', x0: -8, x1: 8, z0: -44, z1: -40, y0: -1, y1: 3 },
];

// ───────────────────────────────────────────────────────────── visibility (portals)

const PORTALS3: PortalSpec[] = [
  ['lift3', 'lock', 'd3_lift', false],
  ['lock', 'gallery_n', 'd3_pressure', false],
  // the gallery glazing: the garden and the balcony are always in view from the gallery, and the reverse
  ['gallery_n', 'atrium', null, true],
  ['gallery_n', 'lobby', 'd3_lobby', 22], // glass doors
  ['lobby', 'admin', 'd3_lobby_inner', false],
  ['admin', 'office', 'd3_office', false],
  ['admin', 'stair_w', 'd3_stair_w', false],
  ['stair_w', 'canteen', 'd3_canteen', false],
  ['canteen', 'atrium', 'd3_canteen_atr', 22], // the canteen's glass front, within 22 m
  ['canteen', 'kitchen', 'd3_kitchen', false],
  ['atrium', 'clinic', 'd3_clinic', false], // frosted
  ['atrium', 'quarters', 'd3_quarters', 22],
  ['quarters', 'ring_e', 'd3_ring_e', false],
  ['atrium', 'bio_lock', 'd3_bio', false],
];

// ───────────────────────────────────────────────────────────── pickups (§5.3) and enemy spawns (§5.2)

function gameplay(L: LevelBuild) {
  L.pickup('p3_lock_med', 'medkit', -2.4, 5.25, -3.0, 35);
  L.pickup('p3_admin_ammo', 'ammo_pistol', -22.6, 5.75, -15.0, 12);
  L.pickup('p3_admin_ammo2', 'ammo_pistol', -22.6, 5.75, -14.6, 12);
  L.pickup('p3_admin_shells', 'ammo_shotgun', -22.6, 5.35, -15.4, 6);
  L.pickup('p3_canteen_med', 'medkit', -15.0, 0.95, -43.8, 35);
  L.pickup('p3_canteen_ammo', 'ammo_pistol', -19.5, 0.95, -43.8, 12);
  L.pickup('p3_clinic_med_1', 'medkit', 19.6, 1.3, -16.05, 35);
  L.pickup('p3_clinic_med_2', 'medkit', 19.6, 1.3, -16.35, 35);
  L.pickup('p3_clinic_ammo', 'ammo_pistol', 16.0, 0.8, -22.8, 12);
  L.pickup('p3_garden_shells', 'ammo_shotgun', 10.4, 1.05, -15.4, 6);
  L.pickup('p3_bio_med', 'medkit', 11.4, 5.7, -39.25, 35);
  L.pickup('p3_bio_ammo', 'ammo_pistol', 11.4, 5.7, -39.6, 12);
  // spawn mode only (R4: nothing hostile exists before its beat). g3_admin are the C2 puppets promoted (story).
  // g3_canteen (2 husks): the story spawns two of these three — hatch A (or hatch B when the player is within 3 m of
  // H-A) and the kitchen husk (or the other hatch when the player waits at the kitchen door).
  // (y = the canteen floor: the husk's 'drop' pose starts it 4 m up, in the hatch void)
  L.enemy('g3_canteen_ha', 'husk', 'spawn', -18, 0, -41, PI, 'drop');
  L.enemy('g3_canteen_hb', 'husk', 'spawn', -14.5, 0, -37.5, PI, 'drop');
  L.enemy('g3_canteen_k', 'husk', 'spawn', -21, 0, -47.0, PI);
  // g3_breach: inside the windowless lock, facing the pressure door
  L.enemy('g3_breach', 'husk', 'spawn', -1.2, D2, -2.0, 0);
  L.enemy('g3_breach', 'husk', 'spawn', 0, D2, -3.4, 0);
  L.enemy('g3_breach', 'husk', 'spawn', 1.2, D2, -2.0, 0);
  // g3_garden: the sentry in the roof hatch void, its whole body (r 0.42) above the closed panel (13.5 … 13.56);
  // 0.84 m over the panel (its spawn hover bump fires under 0.8 m and would lift it into the slab above the void)
  L.enemy('g3_garden', 'sentry', 'spawn', 0, 14.4, -30, 0);
  // g3_breach_2: behind d3_ring_e
  L.enemy('g3_breach_2', 'husk', 'spawn', 29.5, 0, -30.4, PI / 2);
  L.enemy('g3_breach_2', 'husk', 'spawn', 29.5, 0, -31.6, PI / 2);
}

// ───────────────────────────────────────────────────────────── nav cases (scripts/check-nav.mjs)

/**
 * §8.10 cases for level 3 (real husks, real physics): each planned spawn → the player where that beat puts them, in
 * that beat's phase; one stand-off (sealed); the sentry from the roof void; the feature stair ramp tests.
 */
export const NAV_CASES3 = {
  reach: [
    { id: 'canteen_kitchen', phase: 'F_kitchen', label: 'g3_canteen kitchen husk → player at the canteen garden door (F)', spawn: [-21, 0, -47.0], player: [-13.2, 0, -39], within: 25 },
    { id: 'canteen_hatch_a', phase: 'F', label: 'g3_canteen hatch-A husk (landed) → player at the stair door (F)', spawn: [-18, 0, -41], player: [-17.5, 0, -35.2], within: 20 },
    { id: 'breach_garden', phase: 'G', label: 'g3_breach husk in the lock → player in the garden (G): gallery, shutter, balcony, feature stair', spawn: [0, D2, -3.4], player: [0, 0, -22], within: 50, via: ['stair'] },
    { id: 'breach_canteen', phase: 'G', label: 'g3_breach husk in the lock → player at the canteen garden door (G)', spawn: [1.2, D2, -2.0], player: [-10.5, 0, -39], within: 80, via: ['stair'] },
    { id: 'breach2_bio', phase: 'H_ring', label: 'g3_breach_2 husk behind d3_ring_e → player at the BIO door on the balcony (H): quarters, garden, stair', spawn: [29.5, 0, -30.4], player: [10.5, D2, -37.5], within: 50, via: ['stair'] },
    { id: 'admin_office_door', phase: 'F', label: 'g3_admin husk at the inner door → player at the west stair door (F)', spawn: [-18.4, D2, -9.8], player: [-21.2, D2, -18.5], within: 25 },
    { id: 'admin_canteen', phase: 'F', label: 'g3_admin husk in the lobby → player in the canteen (F): admin, west stair down', spawn: [-17.2, D2, -9.0], player: [-18, 0, -38], within: 45, via: ['stair'] },
    { id: 'garden_balcony', phase: 'H', label: 'husk in the garden → player in the BIO alcove (H), up the feature stair', spawn: [-4, 0, -30], player: [11, D2, -39.2], within: 40, via: ['stair'] },
  ],
  /** Sealed: the player in the office (E, d3_office locked for the test): a husk in admin stands off, comes when it opens. */
  standOff: { id: 'standoff_office', label: 'd3_office locked, player in the office: husk in admin stands off, comes when it opens', door: 'd3_office', spawn: [-27, D2, -12], player: [-30, D2, -24.5], hold: 20, within: 20 },
  /** (high in the atrium under the roof hatch; its descent from the void is tested with the hatch opened by k5 tests) */
  sentry: { id: 'sentry_atrium', label: 'sentry high under the roof hatch → player on the balcony behind the balustrade', spawn: [0, 10.5, -30], player: [10.5, D2, -24], within: 25 },
  ramp: (() => {
    const { a, b } = stairLine(STAIR_ATR);
    const mid = [a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return { stair: 1, standAt: mid, top: [a[0], D2, -29.8], bottom: [a[0], 0, -18.6], trips: 5, away: [-10.5, 0, -42.5] };
  })(),
  /** The CAM 04 set is never reached (no portal, no door): its floor is not part of the walkable layout. */
  ignoreFloors: ['feed_l2:main'],
};

// ───────────────────────────────────────────────────────────── level

export async function createLevel3(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  const L = new LevelBuild(ctx);
  ctx.scene.add(L.root);
  defineInstances(L);

  const dress: Partial<Record<RoomId3, RoomDress>> = {};
  for (const t of DRESSING) for (const [k, v] of Object.entries(t)) dress[k as RoomId3] = { ...dress[k as RoomId3], ...v };

  // the shell kernel: one solid block (the whole ring + the CAM 04 set at x 60 … 72) carved into rooms
  const G = new GreyGrid([-35, -0.6, -49, 73, 20, 6]);
  const standin = flatMat(L, 0x7d8186, 'grey_standin');
  const glass = L.ctx.materials.get('glass');
  const noLabel = (b: Builder) => new Proxy(b, { get: (t, p) => (p === 'sign' ? () => t : (t as unknown as Record<string | symbol, unknown>)[p as string]) }) as Builder;
  const specs = doors3(L);

  buildRooms(L, ROOM_IDS3.map((id) => [id, (l: LevelBuild) => {
    const r = ROOMS3[id];
    l.room(id, r.name, r.x0, r.x1, r.z0, r.z1, r.h, { y0: r.y0, floors: r.floors });
    const b = l.builder(`${id}_grey`);
    const d = dress[id];
    SHELLS3[id]({ L: l, G, b: d?.label === false ? noLabel(b) : b, standin, glass });
    d?.build?.(l);
    placeLights(l, d?.lights ?? LIGHTS3[id]);
  }] as const), lap);
  for (const s of specs) carveDoor(G, s);
  bioInner(L, G);
  gameplay(L);

  // shell faces: neutral walls / ceilings, a faint floor tint per room (dressing may restyle a room's faces)
  const wall = flatMat(L, 0xb9bcbf, 'grey_wall'), ceil = flatMat(L, 0x8e9296, 'grey_ceiling'), reveal = flatMat(L, 0x9a9da0, 'grey_reveal');
  const floors = new Map<string, THREE.Material>();
  G.build(L, (room) => {
    if (room === 'reveal') return { floor: reveal, wall: reveal, ceiling: reveal };
    let f = floors.get(room);
    if (!f) floors.set(room, (f = flatMat(L, FLOOR_TINT3[room], `grey_floor_${room}`)));
    return { floor: f, wall, ceiling: ceil, ...dress[room]?.look };
  });
  lap('grey');

  const level = assembleLevel(ctx, L, {
    doors: specs,
    frameZone: (s) => { const rooms = [...new Set(s.rooms)].sort(); return { name: `frames3_${rooms.join('+')}`, rooms }; },
    portals: PORTALS3,
    seeRange: 22,
    triggers: TRIGGERS3,
    navStep: (id) => (id === 'atrium' ? 1.5 : id === 'admin' ? 1.2 : id === 'feed_l2' ? 2.0 : 1.0),
    navStart: { x: 0, y: D2, z: 3 },
    spawn: { position: new THREE.Vector3(0, D2, 3.2), yaw: 0 },
    startRoom: 'lift3',
    regions: REGIONS3(),
    timings, t0,
  });
  installPhases3(ctx, level);
  // initial door state: the story starts in phase A; `?nostory=1` follows the nostory column (§3)
  applyPhaseTo(level, (ctx.debug.noStory ? 'nostory' : 'A') as PhaseId3);

  const api = level as unknown as Record<string, unknown>;
  api.navCases = NAV_CASES3;
  api.selfTest = () => selfTest(ctx, L, level, specs, G);
  api.grey = G.stats;
  api.list = () => ({ vignettes: [...L.vignettes.keys()], screens: [...L.screens.keys()], objects: [...L.objects.keys()] });
  if (ctx.debug.verbose) console.info(`[level3] grey grid ${G.stats.cells} cells → ${G.stats.quads} quads, ${G.stats.colliders} colliders in ${G.stats.ms.toFixed(0)} ms`);
  return level;
}

/** Floor tints per room (greybox readability). */
const FLOOR_TINT3: Record<RoomId3, number> = {
  lift3: 0x9aa3ad, lock: 0xc8ccd0, gallery_n: 0xb8a58c, lobby: 0xc2a27a, admin: 0x9fae8f, office: 0xa98c74,
  stair_w: 0x9b9a92, canteen: 0xc8c0a6, atrium: 0x8fa486, clinic: 0xa9c4bf, quarters: 0xb59a8a, bio_lock: 0xe2e4e6,
  kitchen: 0x8c8c8c, ring_e: 0x6f7378, feed_l2: 0x585c60,
};

// ───────────────────────────────────────────────────────────── self-test (check-reach runs it)

function selfTest(ctx: GameContext, L: LevelBuild, level: Level, specs: DoorSpec[], G: GreyGrid): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const t = (name: string, pass: boolean, detail = '') => { if (!pass) ok = false; lines.push(`${pass ? ' ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // rooms at their floors
  for (const id of ROOM_IDS3) {
    const r = level.rooms.find((q) => q.id === id), d = ROOMS3[id];
    t(`room ${id} floor ${d.y0}, bounds y ${d.y0 - 0.5} … ${d.y0 + d.h}`, !!r && roomFloor(r) === d.y0 && Math.abs(r.bounds.min.y - (d.y0 - 0.5)) < 1e-6 && Math.abs(r.bounds.max.y - (d.y0 + d.h)) < 1e-6);
  }
  // doors on their floors; the pressure door's sinking leaf has its pit
  for (const s of specs) {
    const d = L.doors.get(s.id) as DoorImpl | undefined;
    t(`${s.id}: floor ${s.y ?? 0}`, !!d && d.floor === (s.y ?? 0));
  }
  const pd = specs.find((s) => s.id === 'd3_pressure')!;
  const pit = pitProblems(L, pd, D2);
  t('d3_pressure: solid pit for the sunk bottom leaf (≥ 1.9 m)', pit.length === 0, pit.slice(0, 3).join('; '));
  // floor colliders under every room / extra floor
  const down = V(0, -1, 0);
  for (const id of ROOM_IDS3) {
    const d = ROOMS3[id];
    const pts: [number, number, number][] = [[(d.x0 + d.x1) / 2, d.y0, (d.z0 + d.z1) / 2]];
    for (const f of d.floors ?? []) pts.push([(f.box[0] + f.box[1]) / 2, f.y, (f.box[2] + f.box[3]) / 2]);
    for (const [x, y, z] of pts) {
      // (the feature stair and pool stand where the atrium's centre is: probe off the stair)
      const h = ctx.physics.raycast(V(x, y + 1.0, z), down, 1.5);
      t(`${id}: walkable floor at (${x}, ${y}, ${z})`, !!h && Math.abs(h.point.y - y) < 0.02, h ? h.point.y.toFixed(3) : 'no hit');
    }
  }
  // the glazing stops a body and shows glass
  const gl = ctx.physics.raycast(V(0, D2 + 1.6, -9.5), V(0, 0, -1), 4);
  t('gallery glazing is a glass collider at z −12', !!gl && gl.surface === 'glass' && Math.abs(gl.point.z + 11.985) < 0.02, gl ? `${gl.surface} at z ${gl.point.z.toFixed(3)}` : 'no hit');
  const vp = ctx.physics.raycast(V(0, 2, -40), V(0, 0, -1), 6);
  t('sea viewport is a glass collider at z −44', !!vp && vp.surface === 'glass', vp ? `${vp.surface} at z ${vp.point.z.toFixed(3)}` : 'no hit');
  // the balcony balustrade is 1.45 m (not containment) — a ray 1.5 m above the balcony passes over it
  const over = ctx.physics.raycast(V(10.5, D2 + 1.5, -20), V(-1, 0, 0), 4);
  const under = ctx.physics.raycast(V(10.5, D2 + 1.3, -20), V(-1, 0, 0), 4);
  t('balcony balustrade: glass up to 1.45 m, nothing above it', !over && !!under && under.surface === 'glass', `${over ? 'hit above' : 'clear above'}, ${under ? under.surface : 'no hit'} below`);
  t('grey grid built', G.stats.quads > 0 && G.stats.colliders > 0, `${G.stats.cells} cells, ${G.stats.quads} quads, ${G.stats.colliders} colliders, ${G.stats.ms.toFixed(0)} ms`);
  return { ok, lines };
}

export { STAIR_W };
