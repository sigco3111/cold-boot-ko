/**
 * BIOLOGICAL SYSTEMS — level 4 greybox shell (stage 3b, docs/plans/stage-3b.md §2; task W4).
 *
 * Built on level 3's shell kernel (`GreyGrid`, `buildStair`, `block`, `placeLights`, `flatMat` from ../l3/grey):
 *  - `ROOMS4`: every room's plan box, floor and height (the §2.1 table, final coordinates).
 *  - `SHELLS4`: one function per room: carves its air (+ glazing slots, voids, door openings of the sealed props), puts
 *    back the structure that is not grid (glass panes, the stair, the booth, the cage mesh, the grille / sump panels),
 *    the few stand-in blocks the plan dimensions (bench tier, camera desk, pump sets, islands, pens, tables, crate), its
 *    wayfinding label, every named SCREEN of §6.4, every INTERACTABLE of §6.3, every MARKER of §8.10.
 *  - `LIGHTS4`: placeholder light tables per §2.7 (groups and `<room>_emerg` groups exactly as named there).
 *  - `placeholders4()`: greybox stand-ins for what the dressing / set-piece tasks own (vignettes, machines, the arm's
 *    cycle object) — registered only when nobody registered the id first, so the dressing always wins.
 *
 * How dressing extends it: see `RoomDress` in ./index.ts and the header of each dressing file (entry.ts, clean.ts,
 * surgical.ts, navy.ts, tube.ts). Dressing never edits the shell, the colliders, the doors, the triggers, the
 * phases, the screens / interactables / markers created here (it may restyle or hide stand-in visuals: every stand-in
 * block uses the material named `grey_standin`, see l3/kit3.ts `restyle` / `isStandin`).
 */
import * as THREE from 'three';
import type { Surface } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { cagePanel, sealedDoor } from '../kit';
import {
  GreyGrid, HW, block, buildStair, roomLabel, stairLine, type Box6, type LightRow, type RoomId3, type StairDef,
} from '../l3/grey';

const PI = Math.PI;
/** Deck-2 floor (the clean side). */
export const D2 = 4.8;
export { HW };

// ───────────────────────────────────────────────────────────── rooms (§2.1)

export type RoomId4 =
  | 'lock4' | 'gown' | 'shower' | 'corr_n' | 'corr_w' | 'corr_e' | 'corr_s' | 'wetlab' | 'pi_office' | 'node2' | 'cold'
  | 'records' | 'vivarium' | 'bay' | 'scrub' | 'store4' | 'gallery' | 'theatre' | 'stair4' | 'lcorr' | 'chk' | 'guard'
  | 'plant4' | 'tube' | 'gatel';

export interface RoomDef4 {
  name: string; x0: number; x1: number; z0: number; z1: number; y0: number; h: number;
  floors?: { y: number; box: [number, number, number, number] }[];
}

export const ROOMS4: Record<RoomId4, RoomDef4> = {
  lock4: { name: '생물 시스템 — 외부 록', x0: -2, x1: 2, z0: 0, z1: 4, y0: D2, h: 3.0 },
  gown: { name: '가운 착용실', x0: -4, x1: 4, z0: -6, z1: 0, y0: D2, h: 3.0 },
  shower: { name: '에어샤워', x0: -2, x1: 2, z0: -9, z1: -6, y0: D2, h: 2.8 },
  corr_n: { name: '청정 복도 — 북측', x0: -15, x1: 15, z0: -12, z1: -9, y0: D2, h: 3.0 },
  corr_w: { name: '청정 복도 — 서측', x0: -15, x1: -12, z0: -34, z1: -12, y0: D2, h: 3.0 },
  corr_e: { name: '청정 복도 — 동측', x0: 12, x1: 15, z0: -34, z1: -12, y0: D2, h: 3.0 },
  corr_s: { name: '청정 복도 — 남측', x0: -15, x1: 15, z0: -37, z1: -34, y0: D2, h: 3.0 },
  wetlab: { name: '습식 실험실 1', x0: -12, x1: 4, z0: -24, z1: -12, y0: D2, h: 3.4 },
  pi_office: { name: 'A. 순데 박사 — 책임 연구원', x0: 4, x1: 12, z0: -20, z1: -12, y0: D2, h: 3.0 },
  node2: { name: '노드 2 — 바이오시스', x0: 4, x1: 12, z0: -24, z1: -20, y0: D2, h: 3.0 },
  cold: { name: '냉장고 2', x0: -12, x1: 0, z0: -34, z1: -24, y0: D2, h: 3.0 },
  records: { name: '기록 및 동의', x0: 0, x1: 12, z0: -34, z1: -24, y0: D2, h: 3.0 },
  vivarium: { name: '생물사육실 — 실험실 2', x0: -27, x1: -15, z0: -30, z1: -14, y0: D2, h: 3.4 },
  bay: { name: '유닛 베이', x0: 15, x1: 21, z0: -22, z1: -16, y0: D2, h: 3.0 },
  scrub: { name: '손소독실', x0: -4, x1: 4, z0: -43, z1: -37, y0: D2, h: 3.0 },
  store4: { name: '무균 저장실', x0: 4, x1: 8, z0: -43, z1: -39, y0: D2, h: 3.0 },
  gallery: { name: '수술실 1 — 갤러리', x0: -10, x1: 10, z0: -47, z1: -43, y0: D2, h: 3.0 },
  theatre: { name: '수술실 1', x0: -8, x1: 8, z0: -59, z1: -47, y0: 0, h: 9.4 },
  stair4: { name: '서비스 계단 B', x0: 10, x1: 14, z0: -59, z1: -43, y0: 0, h: 8.0, floors: [{ y: D2, box: [10, 14, -47, -43] }] },
  lcorr: { name: '바이오시스 서비스층', x0: 4, x1: 24, z0: -63, z1: -59, y0: 0, h: 3.2 },
  chk: { name: '해군 검문소 2', x0: 24, x1: 40, z0: -67, z1: -55, y0: 0, h: 4.0 },
  guard: { name: '경비실', x0: 40, x1: 46, z0: -62, z1: -56, y0: 0, h: 3.0 },
  plant4: { name: '튜브 플랜트', x0: 46, x1: 56, z0: -64, z1: -54, y0: 0, h: 4.5 },
  tube: { name: '이송 튜브', x0: 30, x1: 34, z0: -107, z1: -67, y0: 0, h: 3.6 },
  gatel: { name: '초소 4 — 게이트 록', x0: 29, x1: 35, z0: -113, z1: -107, y0: 0, h: 3.6 },
};
export const ROOM_IDS4 = Object.keys(ROOMS4) as RoomId4[];

/** Air (interior clear space) of a room: its box inset by half a wall, floor … floor + h. */
export function airOf4(id: RoomId4): Box6 {
  const r = ROOMS4[id];
  return [r.x0 + HW, r.y0, r.z0 + HW, r.x1 - HW, r.y0 + r.h, r.z1 - HW];
}

/** §2.1 non-room spaces (regions only): the vent / sump voids, the sea, the booth and the cage inside `chk`. */
export const VOIDS4: Record<'vent_viv' | 'vent_s_a' | 'vent_s_b' | 'sump4', Box6> = {
  vent_viv: [-23.4, 8.2, -22.5, -22.4, 9.2, -21.5],
  vent_s_a: [-6.5, 7.8, -36.0, -5.5, 8.8, -35.0],
  vent_s_b: [5.5, 7.8, -36.0, 6.5, 8.8, -35.0],
  sump4: [51.4, -1.2, -62.6, 52.6, 0, -61.4],
};
export const SEA4: Box6[] = [[18, -3, -105.2, 29.8, 4, -68.8], [34.2, -3, -105.2, 46, 4, -68.8]];
export const BOOTH4: Box6 = [26.2, 0, -58.2, 29.8, 2.6, -55.4];
export const CAGE4: Box6 = [35.2, 0, -66.6, 39.6, 4, -62.8];
/** Grid envelope (§2.1). */
export const ENVELOPE4: Box6 = [-30, -3.2, -116, 58, 11, 6];

// ───────────────────────────────────────────────────────────── the stair (§2.1)

/** Service stair B: flight z −56 (y 0) → −47 (y 4.8), 16 × 0.30 / 0.5625 (as level 3's stairs). */
export const STAIR4: StairDef = { room: 'stair4' as RoomId3, x0: 10.2, x1: 13.8, z0: -56, dir: 1, risers: 16, rise: 0.3, tread: 0.5625 };
export { stairLine };

// ───────────────────────────────────────────────────────────── glass, bodies (markers the story reads)

/** `mk4_glass.userData.panes` (§8.10): every pane the story watches for hits — world boxes (x0, y0, z0, x1, y1, z1). */
export const PANES4: { id: 'theatre' | 'tube_w' | 'tube_e' | 'node2' | 'wet' | 'booth'; box: Box6 }[] = [
  { id: 'theatre', box: [-7.6, 5.0, -47.015, 7.6, 7.6, -46.985] },
  { id: 'tube_w', box: [29.985, 0.4, -104, 30.015, 3.0, -87.25] },
  { id: 'tube_w', box: [29.985, 0.4, -86.75, 30.015, 3.0, -70] },
  { id: 'tube_e', box: [33.985, 0.4, -104, 34.015, 3.0, -87.25] },
  { id: 'tube_e', box: [33.985, 0.4, -86.75, 34.015, 3.0, -70] },
  { id: 'node2', box: [11.985, 5.5, -23.4, 12.015, 7.3, -20.6] },
  { id: 'wet', box: [-11, 5.7, -12.015, 3, 7.0, -11.985] },
  { id: 'booth', box: [26.2, 1.0, -58.315, 29.8, 2.4, -58.285] },
  { id: 'booth', box: [29.885, 1.0, -58.2, 29.915, 2.4, -55.4] },
];

/** `mk4_bodies.userData.list` (§8.10, §2.6): the ten dead (feet / body centre). W9a / the dressing place the bodies. */
export const BODIES4: { name: string; p: [number, number, number] }[] = [
  { name: '달', p: [1.5, D2, -7.6] },
  { name: '베리', p: [-23.5, D2, -27.5] },
  { name: '홀름', p: [-10.25, D2, -29.0] },
  { name: '네스', p: [3.0, D2, -28.0] },
  { name: '모에', p: [8.5, D2, -32.8] },
  { name: '포스', p: [-3.2, D2, -40.5] },
  { name: '스트란드', p: [0, 0, -53.5] },
  { name: '하우겐', p: [5.5, 0, -50.2] },
  { name: '리에', p: [5.5, 0, -56.0] },
  { name: '엥', p: [36.2, 0, -62.32] },
];

// ───────────────────────────────────────────────────────────── lights (§2.7) — placeholder tables

const CLEAN = 0xeef4ff, EMERG = 0x9ec4ff, RED = 0xff3020, NAVY = 0xffe2c0, AMBER = 0xffa020;
const em = (group: string, p: [number, number, number], i = 3.5, d = 12, color = EMERG, min?: 'medium' | 'high'): LightRow =>
  ({ group: `${group}_emerg`, type: 'point', p, color, i, d, off: true, ...(min ? { min } : {}) });
/**
 * §2.7: `<room>` groups lit at load, `<room>_emerg` groups off until lights-out (`lights_out4`). On LOW only the rows
 * without `min` exist. The dressing tasks replace a room's table (`RoomDress.lights`) and must keep the group names.
 */
export const LIGHTS4: Record<RoomId4, LightRow[]> = {
  lock4: [
    { group: 'lock4', type: 'spot', p: [0, 7.6, 2.4], t: [0, D2, 1.6], color: CLEAN, i: 18, d: 6, angle: 1.1, cast: true, min: 'medium' },
    { group: 'lock4', type: 'point', p: [0, 7.5, 1.2], color: CLEAN, i: 9, d: 7 },
  ],
  gown: [
    { group: 'gown', type: 'point', p: [0, 7.6, -3.4], color: CLEAN, i: 10, d: 8 },
    { group: 'gown', type: 'point', p: [-2.6, 7.6, -1.4], color: CLEAN, i: 6, d: 6, min: 'medium' },
    em('gown', [0, 7.6, -3.0], 2.5, 8),
  ],
  shower: [{ group: 'shower', type: 'point', p: [0, 7.4, -7.5], color: CLEAN, i: 8, d: 5 }],
  corr_n: [
    { group: 'corr_n', type: 'point', p: [-8, 7.6, -10.5], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_n', type: 'point', p: [8, 7.6, -10.5], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_n', type: 'point', p: [0, 7.6, -10.5], color: CLEAN, i: 7, d: 8, min: 'high' },
    em('corr_n', [0, 7.6, -10.5], 3.5, 16),
    em('corr_n', [-14.4, 7.4, -9.6], 2.5, 6, RED, 'medium'),
  ],
  corr_w: [
    { group: 'corr_w', type: 'point', p: [-13.5, 7.6, -17], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_w', type: 'point', p: [-13.5, 7.6, -29], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_w', type: 'point', p: [-13.5, 7.6, -23], color: CLEAN, i: 7, d: 8, min: 'high' },
    em('corr_w', [-13.5, 7.6, -23], 3.5, 16),
    em('corr_w', [-14.4, 7.4, -33.4], 2.5, 6, RED, 'medium'),
  ],
  corr_e: [
    { group: 'corr_e', type: 'point', p: [13.5, 7.6, -17], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_e', type: 'point', p: [13.5, 7.6, -29], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_e', type: 'point', p: [13.5, 7.6, -23], color: CLEAN, i: 7, d: 8, min: 'high' },
    em('corr_e', [13.5, 7.6, -23], 3.5, 16),
    em('corr_e', [14.4, 7.4, -12.6], 2.5, 6, RED, 'medium'),
  ],
  corr_s: [
    { group: 'corr_s', type: 'point', p: [-8, 7.6, -35.5], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_s', type: 'point', p: [8, 7.6, -35.5], color: CLEAN, i: 10, d: 10 },
    { group: 'corr_s', type: 'point', p: [0, 7.6, -35.5], color: CLEAN, i: 7, d: 8, min: 'high' },
    em('corr_s', [0, 7.6, -35.5], 3.5, 16),
    em('corr_s', [14.4, 7.4, -36.4], 2.5, 6, RED, 'medium'),
  ],
  wetlab: [
    { group: 'wetlab', type: 'point', p: [-8, 8.0, -17.5], color: CLEAN, i: 11, d: 10 },
    { group: 'wetlab', type: 'point', p: [-1, 8.0, -17.5], color: CLEAN, i: 11, d: 10 },
    { group: 'wetlab', type: 'spot', p: [-6, 7.0, -22.6], t: [-6, 5.7, -23.4], color: 0xf4fbff, i: 6, d: 4, angle: 1.0, min: 'medium' },
    em('wetlab', [-4, 8.0, -18], 3, 14),
  ],
  pi_office: [
    { group: 'pi_office', type: 'spot', p: [7.0, 6.6, -12.9], t: [7.4, 5.55, -13.4], color: 0xfff2dc, i: 9, d: 5, angle: 1.0, cast: true, prio: 0.8 },
    { group: 'pi_office', type: 'point', p: [8, 7.6, -16.5], color: CLEAN, i: 7, d: 8, min: 'medium' },
    em('pi_office', [8, 7.6, -16], 2.5, 9),
  ],
  node2: [{ group: 'node2', type: 'point', p: [8, 7.4, -22], color: 0x40d8ff, i: 6, d: 7, prio: 0.4 }],
  vivarium: [
    { group: 'vivarium', type: 'point', p: [-21, 8.0, -18.5], color: CLEAN, i: 11, d: 10 },
    { group: 'vivarium', type: 'point', p: [-21, 8.0, -26], color: CLEAN, i: 11, d: 10 },
    { group: 'vivarium', type: 'point', p: [-17, 8.0, -22], color: CLEAN, i: 7, d: 8, min: 'medium' },
    em('vivarium', [-22, 8.0, -22], 3, 14),
  ],
  cold: [
    { group: 'cold', type: 'point', p: [-6, 7.6, -29], color: 0xdff0ff, i: 10, d: 10 },
    { group: 'cold', type: 'point', p: [-9, 7.6, -26], color: 0xdff0ff, i: 6, d: 7, min: 'medium' },
    em('cold', [-6, 7.6, -29], 3, 12, 0x7fb0ff),
  ],
  records: [
    { group: 'records', type: 'point', p: [6, 7.6, -29], color: CLEAN, i: 10, d: 10 },
    { group: 'records', type: 'spot', p: [3.2, 6.9, -27], t: [3.2, 5.55, -27], color: 0xfff2dc, i: 6, d: 4, angle: 1.0, min: 'medium' },
    em('records', [6, 7.6, -29], 3, 12),
  ],
  bay: [],
  scrub: [
    { group: 'scrub', type: 'point', p: [0, 7.6, -40], color: CLEAN, i: 10, d: 8 },
    { group: 'scrub', type: 'point', p: [-2, 7.6, -38.5], color: CLEAN, i: 6, d: 6, min: 'medium' },
    em('scrub', [0, 7.6, -40], 2.5, 9),
  ],
  store4: [],
  gallery: [
    { group: 'gallery', type: 'point', p: [-4, 7.6, -44.6], color: CLEAN, i: 5, d: 10 },
    { group: 'gallery', type: 'point', p: [5, 7.6, -44.6], color: CLEAN, i: 4, d: 8, min: 'high' },
    em('gallery', [0, 7.6, -44.6], 2.2, 12),
  ],
  theatre: [
    { group: 'theatre', type: 'spot', p: [0, 8.6, -53.5], t: [0, 1.0, -53.5], color: 0xf6fbff, i: 60, d: 12, angle: 0.55, cast: true, prio: 2.0 },
    { group: 'theatre', type: 'point', p: [0, 8.6, -50], color: CLEAN, i: 10, d: 14 },
    { group: 'theatre', type: 'point', p: [-5, 6.0, -56], color: CLEAN, i: 6, d: 9, min: 'high' },
  ],
  stair4: [
    { group: 'stair4', type: 'point', p: [12, 7.6, -45.5], color: CLEAN, i: 8, d: 8 },
    { group: 'stair4', type: 'point', p: [12, 3.6, -57.4], color: NAVY, i: 8, d: 9 },
  ],
  lcorr: [
    { group: 'lcorr', type: 'point', p: [8, 2.9, -61], color: NAVY, i: 8, d: 9 },
    { group: 'lcorr', type: 'point', p: [19.5, 2.9, -61], color: NAVY, i: 8, d: 9 },
    { group: 'lcorr', type: 'point', p: [13.5, 2.9, -61], color: NAVY, i: 5, d: 6, min: 'medium' },
  ],
  chk: [
    { group: 'chk', type: 'point', p: [28, 3.7, -62], color: NAVY, i: 12, d: 12 },
    { group: 'chk', type: 'point', p: [36, 3.7, -59], color: NAVY, i: 12, d: 12 },
    { group: 'chk', type: 'spot', p: [28, 2.45, -56.4], t: [28, 0.9, -56.0], color: 0xfff0d8, i: 6, d: 4, angle: 1.1, cast: true, min: 'medium' },
    { group: 'chk', type: 'point', p: [32, 3.7, -64.5], color: NAVY, i: 7, d: 8, min: 'high' },
  ],
  guard: [{ group: 'guard', type: 'point', p: [43, 2.7, -59], color: NAVY, i: 8, d: 8 }],
  plant4: [
    { group: 'plant4', type: 'point', p: [49, 4.2, -59], color: NAVY, i: 11, d: 10 },
    { group: 'plant4', type: 'point', p: [53.5, 4.2, -59], color: NAVY, i: 11, d: 10 },
    { group: 'plant4', type: 'spot', p: [54.2, 4.1, -59], t: [55.8, 2.4, -59], color: 0xfff0d8, i: 8, d: 4, angle: 0.9, cast: true, min: 'medium' },
    { group: 'plant_beacon', type: 'point', p: [55.5, 3.4, -59], color: AMBER, i: 8, d: 10, off: true },
  ],
  tube: [
    { group: 'tube', type: 'point', p: [32, 3.3, -78], color: 0xcfe6ff, i: 8, d: 12 },
    { group: 'tube', type: 'point', p: [32, 3.3, -96], color: 0xcfe6ff, i: 8, d: 12 },
    { group: 'tube', type: 'point', p: [32, 3.3, -70], color: 0xcfe6ff, i: 5, d: 8, min: 'medium' },
    { group: 'tube', type: 'point', p: [32, 3.3, -104], color: 0xcfe6ff, i: 5, d: 8, min: 'medium' },
  ],
  gatel: [
    { group: 'gatel', type: 'spot', p: [32, 3.4, -108.4], t: [32, 0.6, -111.8], color: NAVY, i: 12, d: 7, angle: 1.0, cast: true, min: 'medium' },
    { group: 'gatel', type: 'point', p: [32, 3.3, -110], color: NAVY, i: 8, d: 8 },
  ],
};
/** §4.3 `lights_out4`: the Deck-2 groups that go dark (all of §2.7 but theatre, node2, lock4) and the groups that come on. */
export const LIGHTS_OUT4 = {
  off: ['gown', 'shower', 'corr_n', 'corr_w', 'corr_e', 'corr_s', 'wetlab', 'pi_office', 'vivarium', 'cold', 'records', 'scrub', 'gallery'],
  emerg: ['gown_emerg', 'corr_n_emerg', 'corr_w_emerg', 'corr_e_emerg', 'corr_s_emerg', 'wetlab_emerg', 'pi_office_emerg', 'vivarium_emerg', 'cold_emerg', 'records_emerg', 'scrub_emerg', 'gallery_emerg'],
  /** The wave's origin (x, z) and speed (s per metre), dim time (s). */
  origin: [-6, -29] as [number, number], perMetre: 0.04, dim: 1.5,
};

// ───────────────────────────────────────────────────────────── helpers

export const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

/**
 * A dynamic grille / hatch panel closing a void (§2.1 voids): mesh + physics box, `L.objects[id]` with
 * `userData.open(mode)` ('drop' — falls out of a ceiling; 'lift' — rises out of a floor and slides aside) and
 * `userData.box` (the DynamicBox; disabled once open). Decals on it are transient (the box has no owner).
 * The vignettes that open it belong to the dressing (§11); `placeholders4` registers greybox ones.
 */
function grillePanel(L: LevelBuild, id: string, x0: number, z0: number, x1: number, z1: number, yBottom: number, mat: Mat) {
  const part = L.part(`${id}:panel`);
  part.bx(mat, x0, 0, z0, x1, 0.06, z1);
  const g = part.build();
  g.position.y = yBottom;
  g.name = id;
  L.root.add(g);
  L.objects.set(id, g);
  const pb = L.ctx.physics.addBox(box3(x0, yBottom, z0, x1, yBottom + 0.06, z1), 'metal');
  pb.walkable = true; // (a body walks over its edge instead of catching on it)
  g.userData.box = pb;
  g.userData.open = (mode: 'drop' | 'lift' = 'drop') => {
    if (!pb.enabled) return;
    pb.enabled = false;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    L.sfx('vent_grille', cx, yBottom, cz, 0.8);
    if (mode === 'drop') L.tween(0, 0.55, (k) => { g.position.y = yBottom - 2.9 * k * k; g.rotation.x = 0.5 * k; }, () => { g.visible = false; });
    else L.tween(0, 0.7, (k) => { g.position.y = yBottom + 0.12 * Math.min(1, k * 3); g.position.x = 1.3 * Math.max(0, k * 1.5 - 0.5); }, () => { /* lies beside the opening */ });
  };
}

/** Stand-in block (material `grey_standin`) with a collider: the plan-dimensioned obstacles the dressing dresses. */
function stand(b: Builder, standin: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: Surface = 'metal') {
  block(b, standin, x0, y0, z0, x1, y1, z1, surface, true);
}

/** Glass pane block (collider, surface glass) in a carved glazing slot. */
function pane(b: Builder, glass: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  block(b, glass, x0, y0, z0, x1, y1, z1, 'glass', true);
}

/** Carve the opening of a sealed prop through its wall (w × h, the wall's full thickness). */
function sealedOpening(G: GreyGrid, id: string, x: number, y: number, z: number, wall: 'x' | 'z', w: number, h: number, rooms: string[]) {
  const box: Box6 = wall === 'z' ? [x - w / 2, y, z - HW, x + w / 2, y + h, z + HW] : [x - HW, y, z - w / 2, x + HW, y + h, z + w / 2];
  G.air(`door:${id}`, box, { rooms, look: 'reveal' });
}

// ───────────────────────────────────────────────────────────── shells (one per room)

export interface ShellCtx4 { L: LevelBuild; G: GreyGrid; b: Builder; standin: Mat; glass: Mat }
type Shell = (s: ShellCtx4) => void;
const air = (G: GreyGrid, id: RoomId4) => G.air(id, airOf4(id), { rooms: [id], look: id as RoomId3 });
/** Air of an opening seen from two rooms (corridor junctions, glazing slots). */
const air2 = (G: GreyGrid, name: string, b: Box6, rooms: RoomId4[], look: RoomId4) => G.air(name, b, { rooms, look: look as RoomId3 });

export const SHELLS4: Record<RoomId4, Shell> = {
  lock4: ({ L, G, b }) => {
    air(G, 'lock4');
    // d4_outer: the habitat side, sealed (D19) — seen from inside the lock only
    sealedOpening(G, 'd4_outer', 0, D2, 4, 'z', 1.6, 2.4, ['lock4']);
    sealedDoor(L, b, {
      id: 'd4_outer', x: 0, y: D2, z: 4, wall: 'z', kind: 'std', sides: 'back', leafMat: 'painted_white', labelBack: '주거 링',
      panel: { text: '밀봉됨 — 주거구 측 — 구역 경보', side: 'back' },
    });
    roomLabel(b, '외부 록', -1.8, D2 + 2.3, 2.0, '+x', 2.4);
    L.screen('decon_panel', 'terminal_idle', 0.5, 0.3, 1.79, 6.1, 1.0, '-x', { text: '제염 08' });
    L.marker('mk4_decon_panel', 1.79, 6.1, 1.0, -PI / 2);
    L.marker('mk4_start', 0, D2, 2.6, 0);
  },

  gown: ({ L, G, b, standin }) => {
    air(G, 'gown');
    // step-over bench z −3.0, x −3.8 … 2.6, h 0.45 (gap x 2.6 … 3.8 at the east end)
    stand(b, standin, -3.8, D2, -3.2, 2.6, D2 + 0.45, -2.8);
    // (nav: the grid rows fall either side of the bench; hand nodes through its 1.2 m east gap)
    for (const z of [-4.3, -3.0, -1.7]) L.navNode(3.2, z, 'gown');
    roomLabel(b, '가운 착용실', 3.8, D2 + 2.4, -1.6, '-x', 2.0);
    L.screen('shower_in_panel', 'terminal_idle', 0.5, 0.3, 1.7, D2 + 1.5, -5.795, '+z', { text: '에어 샤워 — 들어가면 뒤의 문이 닫힙니다' });
    L.interact('note4_signout', 'log', '용지 읽기', -3.7, 6.0, -2.0);
    L.interact('note4_gown', 'log', '포스터 읽기', 3.79, 6.2, -4.5);
  },

  shower: ({ L, G }) => {
    air(G, 'shower');
    L.screen('shower_out_panel', 'terminal_idle', 0.42, 0.26, 1.42, D2 + 1.5, -8.795, '+z', { text: '에어 샤워 — 사이클' });
  },

  corr_n: ({ L, G, b, glass }) => {
    air(G, 'corr_n');
    // the corridor loop's two north corners (always open)
    air2(G, 'jn:nw', [-14.8, D2, -12.2, -12.2, D2 + 3.0, -11.8], ['corr_n', 'corr_w'], 'corr_n');
    air2(G, 'jn:ne', [12.2, D2, -12.2, 14.8, D2 + 3.0, -11.8], ['corr_n', 'corr_e'], 'corr_n');
    // wet-lab windows in the south wall: z −12, x −11 … 3, y 5.7 … 7.0
    air2(G, 'glz:wet', [-11, 5.7, -12.2, 3, 7.0, -11.8], ['corr_n', 'wetlab'], 'corr_n');
    pane(b, glass, -11, 5.7, -12.015, 3, 7.0, -11.985);
    roomLabel(b, '청정 복도', -8, D2 + 2.55, -9.2, '-z', 2.8);
    // fumigation status on the south-wall pier x 3.1 … 3.9, y 5.6 … 6.8, facing +z
    L.screen('fumig_status', 'terminal_alert', 0.8, 1.2, 3.5, 6.2, -11.795, '+z', { text: '청정 구역 — 훈증 완료' });
    L.marker('mk4_wet_win', -4, 6.35, -12, 0);
  },

  corr_w: ({ G, b }) => {
    air(G, 'corr_w');
    air2(G, 'jn:sw', [-14.8, D2, -34.2, -12.2, D2 + 3.0, -33.8], ['corr_w', 'corr_s'], 'corr_w');
    roomLabel(b, '← COLD STORE 2 · VIVARIUM', -14.8, D2 + 2.4, -15.2, '+x', 3.4);
  },

  corr_e: ({ L, G, b, glass }) => {
    air(G, 'corr_e');
    air2(G, 'jn:se', [12.2, D2, -34.2, 14.8, D2 + 3.0, -33.8], ['corr_e', 'corr_s'], 'corr_e');
    // the Node 2 window: x 12, z −23.4 … −20.6, y 5.5 … 7.3
    air2(G, 'glz:node2', [11.8, 5.5, -23.4, 12.2, 7.3, -20.6], ['corr_e', 'node2'], 'corr_e');
    pane(b, glass, 11.985, 5.5, -23.4, 12.015, 7.3, -20.6);
    roomLabel(b, '기록실 · 유닛 베이 →', 14.8, D2 + 2.4, -25.5, '-x', 3.0);
    L.marker('mk4_node2_win', 12, 6.4, -22, -PI / 2);
  },

  corr_s: ({ L, G, b, standin }) => {
    air(G, 'corr_s');
    // two ceiling vents (x −6 / 6, z −35.5): 1 × 1 voids above the 7.8 ceiling, each closed by a grille panel
    G.air('corr_s', VOIDS4.vent_s_a, { rooms: ['corr_s'], look: 'corr_s' as RoomId3 });
    G.air('corr_s', VOIDS4.vent_s_b, { rooms: ['corr_s'], look: 'corr_s' as RoomId3 });
    grillePanel(L, 'vent_s_a_grille', -6.5, -36.0, -5.5, -35.0, 7.8, standin);
    grillePanel(L, 'vent_s_b_grille', 5.5, -36.0, 6.5, -35.0, 7.8, standin);
    roomLabel(b, '수술 구역 ↓', -6, D2 + 2.5, -34.2, '-z', 2.8);
    L.screen('surg_hold', 'containment', 0.8, 0.5, -2.2, 6.2, -36.78, '+z', { text: '격리 유지' });
    L.marker('mk4_vent_s_a', -6, 7.8, -35.5, 0);
    L.marker('mk4_vent_s_b', 6, 7.8, -35.5, 0);
  },

  wetlab: ({ L, G, b, standin }) => {
    air(G, 'wetlab');
    // two bench islands (nothing above 1.2 m) and the fume-hood counter on the south wall (x −10 … −2)
    stand(b, standin, -10, D2, -20, -6, D2 + 0.9, -16);
    stand(b, standin, -3, D2, -20, 1, D2 + 0.9, -16);
    stand(b, standin, -10, D2, -23.8, -2, D2 + 0.9, -23.1);
    roomLabel(b, '습식 실험실 1', -11.8, D2 + 2.6, -14.2, '+x', 2.4);
    L.interact('note4_wet', 'log', '규정 읽기', -2.0, 5.75, -19.0);
  },

  pi_office: ({ L, G, b, standin }) => {
    air(G, 'pi_office');
    // desk on the north wall (the video log monitor and the terminal stand on it)
    stand(b, standin, 5.4, D2, -13.0, 9.0, D2 + 0.75, -12.2);
    roomLabel(b, 'A. 순데 박사', 11.8, D2 + 2.3, -18.6, '-x', 2.4);
    L.screen('pi_video', 'video_log', 0.6, 0.38, 8.0, 5.95, -12.45, '-z', { text: '순데 — 기록 41 — 일 23:10 — ▶' });
    L.interact('term4_pi', 'terminal', '단말기 읽기', 6.2, 5.9, -12.6);
    L.interact('log4_video', 'video', '기록 재생', 8.0, 5.95, -12.6);
    L.marker('mk4_video', 8.0, 5.95, -12.45, PI);
  },

  node2: ({ L, G }) => {
    air(G, 'node2');
    // sealed (no door): seen only through its window; the CHOIR waveform on the west wall, square to the window
    L.screen('node2_screen', 'choir', 1.6, 0.9, 4.22, 6.4, -22.0, '+x', { text: '노드 2 — 바이오시스' });
  },

  cold: ({ L, G, b }) => {
    air(G, 'cold');
    roomLabel(b, '냉장고 2', -11.8, D2 + 2.5, -25.6, '+x', 2.4);
    L.screen('cold_panel', 'containment', 0.7, 0.5, -0.205, 6.3, -29, '-x', { text: '격리 유지' });
    L.interact('cold_ack', 'button', '홀드 확인', -0.22, 6.2, -29, true, 2.0);
    L.marker('mk4_cold_panel', -0.22, 6.2, -29, -PI / 2);
    L.marker('mk4_cold_rack', -5.5, 6.0, -24.25, 0);
  },

  records: ({ L, G, b, standin }) => {
    air(G, 'records');
    // reading table (2.0 … 4.4, z −27.6 … −26.4)
    stand(b, standin, 2.0, D2, -27.6, 4.4, D2 + 0.75, -26.4);
    roomLabel(b, '기록 및 동의', 11.8, D2 + 2.4, -32.0, '-x', 3.0);
    L.interact('note4_consent', 'log', '서류 읽기', 3.0, 5.6, -27.0);
    L.interact('note4_tveit', 'log', '서식 읽기', 10.8, 5.9, -24.4);
  },

  vivarium: ({ L, G, b, standin }) => {
    air(G, 'vivarium');
    // the ceiling vent (−22.9, −22): a 1 × 1 void above the 8.2 ceiling, closed by a grille panel
    G.air('vivarium', VOIDS4.vent_viv, { rooms: ['vivarium'], look: 'vivarium' as RoomId3 });
    grillePanel(L, 'vent_viv_grille', -23.4, -22.5, -22.4, -21.5, 8.2, standin);
    // pen row A (west wall) and row B island, 1.2 m (glass fronts: dressing); procedure table
    stand(b, standin, -26.8, D2, -29.6, -24.4, D2 + 1.2, -17.6);
    stand(b, standin, -21.4, D2, -27.6, -19.0, D2 + 1.2, -17.6);
    stand(b, standin, -18.3, D2, -27.6, -16.7, D2 + 0.85, -26.4);
    roomLabel(b, '생물사육실 — 실험실 2', -15.2, D2 + 2.8, -26.5, '-x', 3.0);
    L.interact('note4_cards', 'log', '케이지 카드 읽기', -21.0, 6.0, -15.5);
    L.interact('log4_viv', 'log', '태블릿 읽기', -25.5, 5.75, -16.0);
    L.marker('mk4_vent_viv', -22.9, 8.2, -22, 0);
  },

  bay: ({ L, G, b }) => {
    air(G, 'bay');
    roomLabel(b, '유닛 베이', 20.8, D2 + 2.3, -19, '-x', 2.0);
    L.marker('mk4_bay_door', 15, D2, -19, -PI / 2);
  },

  scrub: ({ L, G, b }) => {
    air(G, 'scrub');
    roomLabel(b, '손소독실', -3.8, D2 + 2.4, -41.5, '+x', 2.2);
    L.interact('note4_list', 'log', '명단 읽기', 3.78, 6.2, -38.4);
    L.marker('mk4_store_door', 4, D2, -41, PI / 2);
  },

  store4: ({ G }) => { air(G, 'store4'); },

  gallery: ({ L, G, b, standin, glass }) => {
    air(G, 'gallery');
    // the glazing: south wall z −47, x −7.6 … 7.6, y 5.0 … 7.6, looking down into the theatre
    air2(G, 'glz:theatre', [-7.6, 5.0, -47.2, 7.6, 7.6, -46.8], ['gallery', 'theatre'], 'gallery');
    pane(b, glass, -7.6, 5.0, -47.015, 7.6, 7.6, -46.985);
    // B3 layout: the bench tier along the north wall (0.9 m: seat + back rail) and the camera desk force the path
    // along z ≈ −46 (0.8 m from the glass)
    stand(b, standin, -9.8, D2, -44.8, -1.0, D2 + 0.9, -43.2);
    stand(b, standin, 1.0, D2, -44.8, 8.0, D2 + 0.9, -43.2);
    stand(b, standin, 3.0, D2, -46.8, 5.0, D2 + 1.0, -46.4);
    // (screen 5 cm higher and 5 cm deeper than §2.6's (4.0, 5.95, −46.45): tilted 30° up, its lower edge then rests on
    // the desk top instead of hanging 2 cm below it in front of the desk)
    L.screen('theatre_cam', 'theatre_cam', 0.6, 0.4, 4.0, 6.0, -46.5, '+z', { tilt: -PI / 6 });
    L.interact('sign4_theatre', 'log', '표창 읽기', -6.0, 5.9, -43.22);
    L.marker('mk4_gallery_spk', 0, 7.55, -45.0, 0);
  },

  theatre: ({ L, G, b }) => {
    air(G, 'theatre');
    roomLabel(b, '수술실 1', -7.8, 3.0, -50.5, '+x', 2.2);
    L.screen('theatre_screen', 'terminal_alert', 4.0, 1.4, 0, 3.7, -58.78, '+z', { text: '수술실 1 — 장착 31' });
  },

  stair4: ({ L, G, b, standin }) => {
    air(G, 'stair4');
    // top landing (Deck 2, z −47 … −43) on solid structure; the flight descends south to the bottom landing (z −59 … −56)
    G.solid([10, -0.6, -47, 14, D2, -43]);
    buildStair(L, b, STAIR4, standin, false);
    roomLabel(b, '서비스 계단 B', 13.8, D2 + 2.3, -45, '-x', 2.6);
    roomLabel(b, '서비스 계단 B — 해군층', 13.8, 2.4, -57.5, '-x', 3.4);
  },

  lcorr: ({ L, G, b }) => {
    air(G, 'lcorr');
    // the theatre's lower door: sealed, seen from both sides (from the gallery above and from this corridor)
    sealedOpening(G, 'door4_theatre', 6, 0, -59, 'z', 1.6, 2.4, ['theatre', 'lcorr']);
    const sb = L.namedBuilder('sealed:door4_theatre');
    sb.rooms = ['theatre', 'lcorr'];
    sealedDoor(L, sb, {
      id: 'door4_theatre', x: 6, y: 0, z: -59, wall: 'z', kind: 'std', sides: 'both', leafMat: 'painted_white',
      labelFront: '바이오시스 서비스층', labelBack: '수술실 1',
      panel: { text: '수술실 1 — 무균 구역 — 출입 금지', side: 'back' },
    });
    roomLabel(b, '이송 튜브 — 초소 4 →', 16, 2.4, -62.8, '+z', 3.4);
  },

  chk: ({ L, G, b, standin, glass }) => {
    air(G, 'chk');
    // ── the booth (x 26.0 … 30.0, z −58.4 … −55.2): 1.0 m kerb + glass to 2.4 on the south and east faces, roof at
    // 2.6, a doorway in the west face (z −57.4 … −56.4); the north side is the checkpoint's north wall ──
    stand(b, standin, 26.0, 0, -58.4, 30.0, 1.0, -58.2);            // south kerb
    stand(b, standin, 29.8, 0, -58.2, 30.0, 1.0, -55.2);            // east kerb
    pane(b, glass, 26.2, 1.0, -58.315, 29.8, 2.4, -58.285);           // south glass
    pane(b, glass, 29.885, 1.0, -58.2, 29.915, 2.4, -55.2);           // east glass
    stand(b, standin, 26.0, 1.0, -58.4, 26.2, 2.4, -58.2);          // south-west post
    stand(b, standin, 29.8, 1.0, -58.4, 30.0, 2.4, -58.2);          // south-east post
    stand(b, standin, 26.0, 2.4, -58.4, 30.0, 2.6, -58.2);          // south header
    stand(b, standin, 29.8, 2.4, -58.2, 30.0, 2.6, -55.2);          // east header
    stand(b, standin, 26.0, 0, -58.2, 26.2, 2.6, -57.4);            // west face, south of the doorway
    stand(b, standin, 26.0, 0, -56.4, 26.2, 2.6, -55.2);            // west face, north of the doorway
    stand(b, standin, 26.0, 2.2, -57.4, 26.2, 2.6, -56.4);          // doorway head (2.2 m)
    stand(b, standin, 26.0, 2.6, -58.4, 30.0, 2.75, -55.2);         // roof
    stand(b, standin, 26.4, 0, -55.8, 29.6, 0.95, -55.2);           // console along the north side
    for (const [x, z] of [[25.3, -56.9], [26.1, -56.9], [26.9, -56.9], [28.0, -56.9], [29.1, -56.9]] as const) L.navNode(x, z, 'chk'); // (nav through the 1.0 m doorway)
    L.interact('term4_ctrl', 'terminal', '근무표 읽기', 27.2, 1.05, -55.55);
    L.interact('booth_release', 'button', '튜브 문 해제', 28.8, 1.0, -55.55, true, 1.8);
    L.screen('booth_panel', 'terminal_idle', 0.5, 0.3, 28.0, 1.5, -55.56, '-z', { text: '튜브 출입 — 부스에서 해제' });
    L.marker('mk4_booth', 28.0, 1.6, -56.8, 0);
    // ── the armoury cage (x 35.0 … 39.8, z −66.8 … −62.6), mesh to the ceiling; door gap x 36.6 … 38.2 on its north face
    // (2.2 m, mesh above it); the leaf bent open is the dressing's ──
    const mesh = L.doubleSided('floor_grate');
    b.push(35.0, 0, -64.7, PI / 2);
    cagePanel(b, mesh, -2.1, 0, 2.1, 4.0, 0);
    b.pop();
    b.collide(34.98, 0, -66.8, 35.02, 4.0, -62.6, 'metal', true);
    b.push(0, 0, -62.6, 0);
    cagePanel(b, mesh, 35.02, 0, 36.6, 4.0, 0);
    cagePanel(b, mesh, 38.2, 0, 39.8, 4.0, 0);
    cagePanel(b, mesh, 36.6, 2.2, 38.2, 4.0, 0);
    b.pop();
    b.collide(35.02, 0, -62.62, 36.6, 4.0, -62.58, 'metal', true);
    b.collide(38.2, 0, -62.62, 39.8, 4.0, -62.58, 'metal', true);
    b.collide(36.6, 2.2, -62.62, 38.2, 4.0, -62.58, 'metal', true);
    for (const z of [-61.6, -62.6, -63.6, -64.6]) L.navNode(37.4, z, 'chk'); // (nav through the cage's 1.6 m door gap)
    roomLabel(b, '해군 검문소 2', 24.2, 3.0, -57.4, '+x', 3.0);
    L.screen('roster', 'roster', 2.4, 1.2, 33.2, 2.2, -55.22, '-z', { text: '클라스프 링크 명단 — 초소 4 파견대' });
    L.screen('tube_n_panel', 'terminal_idle', 0.5, 0.3, 33.9, 1.6, -66.78, '+z', { text: '튜브 출입 — 부스에서 해제' });
    L.marker('mk4_roster', 33.2, 2.2, -55.22, PI);
  },

  guard: ({ L, G, b }) => {
    air(G, 'guard');
    roomLabel(b, '경비실', 42.5, 2.4, -61.8, '+z', 2.2);
    L.interact('note4_guard', 'log', '명령서 읽기', 45.6, 1.5, -58.0);
    L.interact('note4_bunk', 'log', '편지 읽기', 42.0, 0.6, -61.4);
  },

  plant4: ({ L, G, b, standin }) => {
    air(G, 'plant4');
    // the floor sump (52, −62), 1.2 × 1.2, 1.2 deep, under a grille flush with the floor
    G.air('plant4', VOIDS4.sump4, { rooms: ['plant4'], look: 'plant4' as RoomId3 });
    grillePanel(L, 'plant_sump_grille', 51.4, -62.6, 52.6, -61.4, -0.06, standin);
    // (nav keeps off the sump: it is a hole once `plant_sump` lifts the grille)
    L.obstacles.push(box3(51.4, -1.2, -62.6, 52.6, 1.0, -61.4));
    // pump sets A / B (h 1.6, cover for the holdout), the pipe trunk through the floor, the supply crate by the valve
    stand(b, standin, 47.0, 0, -63.0, 50.0, 1.6, -60.0);
    stand(b, standin, 47.0, 0, -58.0, 50.0, 1.6, -55.0);
    stand(b, standin, 52.7, 0, -56.3, 53.3, 4.5, -55.7);
    stand(b, standin, 54.5, 0, -62.4, 55.5, 0.85, -61.3);
    roomLabel(b, '튜브 플랜트', 46.2, 3.4, -55.6, '+x', 2.4);
    L.screen('plant_gauge', 'terminal_idle', 1.2, 0.8, 55.78, 2.4, -59.0, '-x', { text: '튜브 Δp 3.1 BAR — 등압 필요' });
    L.interact('valve4', 'lever', '등압 밸브 열기', 55.75, 1.2, -59.0, true, 2.0);
    L.marker('mk4_gauge', 55.78, 2.4, -59.0, -PI / 2);
    L.marker('mk4_sump', 52.0, 0, -62.0, 0);
    L.marker('mk4_pumps', 48.5, 1.0, -59.0, 0);   // the pump loop between pump sets A / B (§4.5)
    // the valve lever (vignette `valve_open` swings it; D3a dresses it)
    const lever = L.part('valve4:lever');
    lever.bx(standin, -0.04, -0.6, -0.04, 0.04, 0.0, 0.04);
    const lg = lever.build();
    lg.name = 'valve4_lever';
    lg.position.set(55.7, 1.6, -59.0);
    L.root.add(lg);
    L.objects.set('valve4_lever', lg);
  },

  tube: ({ G, b, glass }) => {
    air(G, 'tube');
    // the sea outside both glazed sides (void: no faces), panes x 30 / 34, z −104 … −70, y 0.4 … 3.0 — split by the
    // bulkhead ring at z −87 (0.5 m deep, opening 2.6 × 3.0: solid structure)
    for (const s of SEA4) G.void(s);
    for (const [x0, x1] of [[29.8, 30.2], [33.8, 34.2]] as const) {
      air2(G, 'glz:tube', [x0, 0.4, -104, x1, 3.0, -70], ['tube'], 'tube');
    }
    G.solid([29.8, 0, -87.25, 30.7, 3.6, -86.75]);
    G.solid([33.3, 0, -87.25, 34.2, 3.6, -86.75]);
    G.solid([30.7, 3.0, -87.25, 33.3, 3.6, -86.75]);
    for (const x of [30, 34]) {
      pane(b, glass, x - 0.015, 0.4, -104, x + 0.015, 3.0, -87.25);
      pane(b, glass, x - 0.015, 0.4, -86.75, x + 0.015, 3.0, -70);
    }
  },

  gatel: ({ L, G, b }) => {
    air(G, 'gatel');
    // the Post 4 gate: sealed in 3b (wide look, 12 radial dogs — `gate4_dogs`; the dressing owns `gate_dogs`)
    sealedOpening(G, 'gate4', 32, 0, -113, 'z', 3.0, 2.8, ['gatel']);
    sealedDoor(L, b, { id: 'gate4', x: 32, y: 0, z: -113, wall: 'z', kind: 'wide', sides: 'front', leafMat: 'navy_grey', labelFront: '초소 4', dogs: 12 });
    // gate panel (screen 0.2 m east of the marker: the wide frame's jamb ends at x 33.8)
    L.screen('gate_panel', 'terminal_idle', 0.4, 0.26, 34.1, 1.6, -112.78, '+z', { text: '초소 4 — 압력 게이트 — 해군 전용' });
    L.marker('mk4_gate_panel', 33.9, 1.6, -112.78, 0);
    roomLabel(b, '초소 4 — 게이트 록', 29.2, 2.4, -110, '+x', 2.8);
  },
};

// ───────────────────────────────────────────────────────────── greybox placeholders (dressing wins)

/**
 * Stand-ins for what other tasks own, so the story runs on the bare greybox: registered after every room is built and
 * only when the id is still free (a dressing / set-piece that registers the id — anywhere — replaces it).
 *  - vignettes `viv_vent`, `vent_s_a`, `vent_s_b` (drop the grille), `plant_sump` (lift the sump grille), `valve_open`
 *    (swing the lever), `gate_dogs` (retract the dogs), `lights_out4` (§4.3 wave), `decon_cycle`, `shower_cycle` (no-op);
 *  - machines `cold_jam` (twitches `d4_cold` through `DoorImpl.nudge` every ~7 s while 'active'), `theatre_arm`;
 *  - object `theatre_arm`: the §4.4 cycle without a body (`userData.cycle` { t, n, cue }, `setFailHold(s)`, `onCue(cb)`,
 *    `attempt0`) — W9a's `theatreArm` replaces it.
 */
export function placeholders4(L: LevelBuild): void {
  const vig = (id: string, fn: () => void, toggle = false) => { if (!L.vignettes.has(id)) L.vignette(id, fn, toggle); };
  const grille = (id: string, mode: 'drop' | 'lift') => () => (L.objects.get(id)?.userData.open as ((m: string) => void) | undefined)?.(mode);
  vig('viv_vent', grille('vent_viv_grille', 'drop'));
  vig('vent_s_a', grille('vent_s_a_grille', 'drop'));
  vig('vent_s_b', grille('vent_s_b_grille', 'drop'));
  vig('plant_sump', grille('plant_sump_grille', 'lift'));
  vig('valve_open', () => {
    const lv = L.objects.get('valve4_lever');
    if (lv) L.tween(0, 0.8, (k) => { lv.rotation.z = -1.4 * k; });
    L.sfx('valve_pull', 55.7, 1.2, -59.0);
  });
  vig('gate_dogs', () => {
    const d = L.objects.get('gate4_dogs')?.userData.set as ((k: number) => void) | undefined;
    if (d) L.tween(0, 0.9, (k) => d(k));
    L.sfx('gate_dogs', 32, 1.4, -112.6);
  });
  vig('decon_cycle', () => { /* greybox: no mist (D1a) */ });
  vig('shower_cycle', () => { /* greybox: no jets (D1a) */ });
  vig('lights_out4', () => {
    const lm = L.ctx.render.lights;
    const [ox, oz] = LIGHTS_OUT4.origin;
    for (const g of LIGHTS_OUT4.off) for (const h of lm.group(g)) {
      const delay = Math.hypot(h.position.x - ox, h.position.z - oz) * LIGHTS_OUT4.perMetre;
      L.tween(delay, LIGHTS_OUT4.dim, (k) => { h.intensityScale = 1 - k; }, () => { h.enabled = false; h.intensityScale = 1; });
    }
    L.after(LIGHTS_OUT4.dim, () => { for (const g of LIGHTS_OUT4.emerg) lm.setGroup(g, { enabled: true }); });
    L.sfx('power_down', -6, 6.5, -29, 0.9);
  });

  if (!L.machines.has('cold_jam')) {
    let on = false, t = 0;
    L.machines.set('cold_jam', (s) => { on = s === 'active' || s === 'frenzy'; t = 0; });
    L.updaters.push((dt) => {
      if (!on) return;
      t += dt;
      if (t < 7) return;
      t = 0;
      const d = L.doors.get('d4_cold');
      if (d && d.isOpen) d.nudge(0.12, 0.5);
    });
  }

  if (!L.objects.has('theatre_arm')) {
    // §4.4 cycle: approach 0–6 · fit 6–12 · handshake 12–14.5 · fail 14.5 + failHold · remove 5 · regel 6 · return 5 · idle 7
    const arm = L.marker('theatre_arm', 0, 9.2, -53.5, 0);
    const cbs: ((cue: string, n: number) => void)[] = [];
    const st = { t: 0, n: 0, cue: 'approach', failHold: 2.5 };
    const marks = () => [['approach', 0], ['fit', 6], ['handshake', 12], ['fail', 14.5], ['remove', 14.5 + st.failHold], ['regel', 19.5 + st.failHold],
      ['return', 25.5 + st.failHold], ['idle', 30.5 + st.failHold], ['', 37.5 + st.failHold]] as [string, number][];
    arm.userData.cycle = st;
    arm.userData.attempt0 = 5593;
    arm.userData.placeholder = true;
    arm.userData.setFailHold = (s: number) => { st.failHold = Math.max(2.5, s); };
    arm.userData.onCue = (cb: (cue: string, n: number) => void) => { cbs.push(cb); };
    let on = true;
    L.machines.set('theatre_arm', (s) => { on = s !== 'off'; });
    L.updaters.push((dt) => {
      if (!on) return;
      st.t += dt;
      const m = marks();
      const end = m[m.length - 1][1];
      if (st.t >= end) { st.t -= end; st.n++; }
      let cue = 'approach';
      for (const [c, at] of m) if (c && st.t >= at) cue = c;
      if (cue !== st.cue) { st.cue = cue; for (const cb of cbs) { try { cb(cue, st.n); } catch (e) { console.warn('[l4] theatre_arm cue', e); } } }
    });
  }
}
