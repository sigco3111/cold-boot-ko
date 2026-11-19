/**
 * BIOLOGICAL SYSTEMS — the phase table (stage 3b §3; R6): the single source of truth for door state per story phase.
 * The story calls `level.applyPhase(id)` (or `applyPhase4`) at every transition and in checkpoint fast-forward and
 * sets none of these doors by hand; `scripts/check-reach.mjs` applies the same phases and proves the `check` data.
 *
 *   A   decon (d4_inner CYCLING 8 s)        B   gowning (cp4_start)            S   shower cycle (latched in)
 *   C   clean side (cp4_clean, cp4_cold)    D   suite released (cp4_hold, cp4_lower, cp4_navy)
 *   D2  tube equalised (cp4_armed) — same doors as D (a flag, its own check row)
 *   E   tube released                       F   gate lock open                 G   sealed in the gate lock
 *   D_bay / D_store — D with the script-only spawn door held open for `g4_bay` / `g4_store`
 *   F_open — E with `d4_tube_s` held open while `g4_tube` walks out (then F: auto)
 *   nostory — `?nostory=1`: every door auto except d4_bay, d4_store (locked), d4_cold (open)
 *
 * `cycling` doors show the amber CYCLING panel and their `DoorSpec.cyclingPrompt` (index.ts): `d4_inner` (decon),
 * `d4_surg` "격리 유지", `d4_tube_n` "부스에서 해제", `d4_tube_s` "게이트 록 순환 중".
 * Machines `theatre_arm`, `cold_jam` run ('active') in every phase.
 *
 * Latches (REVISION 5.1 `closeBehind(door, keepSide)`): `LATCHES4` — door, the trigger that arms it (or the rule),
 * the phase it is armed in, the phase applied when it holds, the keep-side test on the player's feet.
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import type { MachineState } from '../context';
import { applyPhaseState, installPhaseTable, type DoorState, type Phase, type PhaseCheck } from '../phases';
import { BOOTH4, CAGE4, D2, ROOM_IDS4, SEA4, VOIDS4, type RoomId4 } from './grey';
export { inRegion } from '../phases';

export type PhaseId4 = 'A' | 'B' | 'S' | 'C' | 'D' | 'D2' | 'E' | 'F' | 'G' | 'D_bay' | 'D_store' | 'F_open' | 'nostory';

const b3 = (b: readonly number[]) => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));

/** §3 named regions (each room id is a region too, added by assembleLevel: floor − 0.5 … floor + h). */
export function REGIONS4(): Record<string, THREE.Box3[]> {
  return {
    voids: Object.values(VOIDS4).map(b3),
    outside: SEA4.map(b3),
    booth: [b3(BOOTH4)],
    cage: [b3(CAGE4)],
    // pickups collected on touch / at the cage wall have no interactable to test: reaching one = feet within ~1 m of it
    // on its floor (as level 3's p3_lock_med)
    p4_gown_med: [b3([2.6, D2 + 0.4, -2.5, 3.8, D2 + 1.6, -0.5])],
    p4_carbine: [b3([38.5, 0.4, -65.5, 39.6, 1.6, -63.5])],
    p4_vest_1: [b3([38.5, 0.4, -64.4, 39.6, 1.6, -62.8])],
    p4_vest_2: [b3([38.5, 0.4, -66.6, 39.6, 1.6, -64.6])],
  };
}
/** Forbidden in every phase (§3 `ALWAYS4`). */
export const ALWAYS4 = ['theatre', 'node2', 'voids', 'outside'];

export const DOOR_IDS4 = [
  'd4_inner', 'd4_shower_in', 'd4_shower_out', 'd4_wet_w', 'd4_wet_e', 'd4_pi', 'd4_viv', 'd4_cold', 'd4_rec', 'd4_bay',
  'd4_surg', 'd4_gal', 'd4_store', 'd4_gal_e', 'd4_stair_s', 'd4_chk', 'd4_guard', 'd4_plant', 'd4_tube_n', 'd4_tube_s',
] as const;
export type DoorId4 = (typeof DOOR_IDS4)[number];
type Doors = Record<DoorId4, DoorState>;

/** Phase A (decon): everything the story has not opened yet. */
const A: Doors = {
  d4_inner: 'cycling', d4_shower_in: 'locked', d4_shower_out: 'locked',
  d4_wet_w: 'auto', d4_wet_e: 'auto', d4_pi: 'auto', d4_viv: 'auto', d4_rec: 'auto',
  d4_cold: 'open', d4_bay: 'locked', d4_surg: 'cycling',
  d4_gal: 'auto', d4_gal_e: 'auto', d4_stair_s: 'auto', d4_chk: 'auto', d4_guard: 'auto', d4_plant: 'auto',
  d4_store: 'locked', d4_tube_n: 'cycling', d4_tube_s: 'cycling',
};
const B: Doors = { ...A, d4_inner: 'auto', d4_shower_in: 'auto' };
/** The shower cycle: latched in (both shower doors locked); `d4_shower_out` opens at the cycle end → C. */
const S: Doors = { ...B, d4_shower_in: 'locked' };
const C: Doors = { ...S, d4_shower_out: 'auto' };
const D: Doors = { ...C, d4_surg: 'auto' };
const D2_: Doors = { ...D };
const E: Doors = { ...D2_, d4_tube_n: 'auto' };
const F: Doors = { ...E, d4_tube_s: 'auto' };
const G: Doors = { ...F, d4_tube_s: 'locked' };
const NOSTORY: Doors = Object.fromEntries(DOOR_IDS4.map((id) => [id, 'auto'])) as Doors;
Object.assign(NOSTORY, { d4_bay: 'locked', d4_store: 'locked', d4_cold: 'open' });

const MACHINES: Record<string, MachineState> = { theatre_arm: 'active', cold_jam: 'active' };

/** §3 check rows. `stressFloors`: the decks that get wreck-box jumps (floor-relative). */
type Check4 = PhaseCheck & { stressFloors?: number[] };
const ck = (c: Check4): Check4 => ({ ...c, forbid: [...new Set([...c.forbid, ...ALWAYS4])] });
const but = (...keep: RoomId4[]) => ROOM_IDS4.filter((r) => !keep.includes(r));
const CORR: RoomId4[] = ['corr_n', 'corr_w', 'corr_e', 'corr_s'];
const C_GOALS = [...CORR, 'wetlab', 'pi_office', 'vivarium', 'cold', 'records', 'shower'];

const P = (id: PhaseId4, label: string, doors: Doors, check?: Check4): Phase => ({ id, label, doors, machines: MACHINES, ...(check ? { check } : {}) });

export const PHASES4: Phase[] = [
  P('A', 'decon: sealed in the outer lock (d4_inner CYCLING 8 s)', A, ck({ start: [0, D2, 2.6], forbid: but('lock4'), goal: ['lock4'], stressFloors: [D2] })),
  P('B', 'gowning (cp4_start): lock, gowning, the shower', B, ck({
    start: [0, D2, -2.5],
    forbid: [...CORR, 'wetlab', 'pi_office', 'vivarium', 'cold', 'records', 'bay', 'scrub', 'store4', 'gallery', 'stair4', 'lcorr', 'chk', 'guard', 'plant4', 'tube', 'gatel'],
    goal: ['lock4', 'gown', 'shower', 'p4_gown_med'], use: ['note4_signout', 'note4_gown'], stressFloors: [D2],
  })),
  P('S', 'shower cycle: latched in the air shower', S, ck({ start: [0, D2, -7.6], forbid: but('shower'), goal: ['shower'], stressFloors: [D2] })),
  P('C', 'clean side (cp4_clean, cp4_cold): the loop and the labs; the suite held', C, ck({
    start: [0, D2, -10.5],
    forbid: ['lock4', 'gown', 'bay', 'scrub', 'store4', 'gallery', 'stair4', 'lcorr', 'chk', 'guard', 'plant4', 'tube', 'gatel'],
    goal: C_GOALS,
    use: ['note4_cards', 'log4_viv', 'note4_wet', 'term4_pi', 'log4_video', 'note4_consent', 'note4_tveit', 'cold_ack'],
    stressFloors: [D2],
  })),
  P('D', 'suite released (cp4_hold, cp4_lower, cp4_navy): down to the navy level; tube refused', D, ck({
    start: [0, D2, -35.5], forbid: ['lock4', 'gown', 'tube', 'gatel'],
    goal: [...C_GOALS, 'scrub', 'gallery', 'stair4', 'lcorr', 'chk', 'booth', 'cage', 'guard', 'plant4', 'p4_carbine', 'p4_vest_1', 'p4_vest_2'],
    use: ['note4_list', 'sign4_theatre', 'term4_ctrl', 'booth_release', 'valve4', 'note4_guard', 'note4_bunk'],
    stressFloors: [0, D2],
  })),
  P('D2', 'tube equalised (cp4_armed): the booth releases', D2_, ck({
    start: [50, 0, -59], forbid: ['lock4', 'gown', 'tube', 'gatel'], goal: ['plant4', 'guard', 'chk', 'booth'], use: ['booth_release'], stressFloors: [0, D2],
  })),
  P('E', 'tube released: d4_tube_n auto; the gate lock cycling', E, ck({
    start: [28, 0, -61], forbid: ['lock4', 'gown', 'gatel'], goal: ['tube', 'chk', 'plant4'], stressFloors: [0, D2],
  })),
  P('F', 'gate lock open', F, ck({ start: [32, 0, -90], forbid: ['lock4', 'gown'], goal: ['gatel', 'tube'], stressFloors: [0] })),
  P('G', 'sealed in the gate lock (latched)', G, ck({ start: [32, 0, -110], forbid: but('gatel'), goal: ['gatel'], stressFloors: [0] })),
  // script-only spawn doors standing open for their groups (§5.1) and the tube group's exit — no player checks
  P('D_bay', 'D with d4_bay opened by the script for g4_bay', { ...D, d4_bay: 'open' }),
  P('D_store', 'D with d4_store opened by the script for g4_store', { ...D, d4_store: 'open' }),
  P('F_open', 'E with d4_tube_s opened by the script for g4_tube (then F)', { ...E, d4_tube_s: 'open' }),
  P('nostory', '?nostory=1: every door auto except d4_bay, d4_store (locked), d4_cold (open)', NOSTORY),
];

/** Apply a phase to a level object directly (build time, before `ctx.level` is set). */
export function applyPhaseTo4(level: Level, id: PhaseId4, snap = true) {
  const p = PHASES4.find((x) => x.id === id)!;
  applyPhaseState({ level } as unknown as GameContext, p, { snap });
}

/** THE call the story makes at each transition (`{ snap: true }` in checkpoint fast-forward). */
export function applyPhase4(ctx: GameContext, id: PhaseId4, opts: { snap?: boolean } = {}): boolean {
  const p = PHASES4.find((x) => x.id === id);
  if (!p) { console.warn(`[phases] unknown phase "${id}"`); return false; }
  applyPhaseState(ctx, p, opts);
  return true;
}

// ───────────────────────────────────────────────────────────── latches (§3)

export interface Latch4 {
  door: DoorId4;
  /** Trigger that arms it (`trigger:enter`), or the rule (story) for the spawn doors; and the phase it is armed in. */
  armedBy: string; phase: PhaseId4;
  /** Phase applied when the latch holds. */
  then: PhaseId4;
  /** Feet on the keep side (the side the player must end up on). */
  keepSide: (p: THREE.Vector3) => boolean;
  /** On fail (what the story does). */
  onFail: string;
  note: string;
}
export const LATCHES4: Latch4[] = [
  { door: 'd4_shower_in', armedBy: 't4_shower', phase: 'B', then: 'S', keepSide: (p) => p.z < -6.4, onFail: 'reopen, re-arm; panel CLEAR THE DOOR', note: '§4.2: beat l4_shower, jets +0.3 s' },
  { door: 'd4_tube_s', armedBy: 't4_gatel', phase: 'F', then: 'G', keepSide: (p) => p.z < -107.4, onFail: 'reopen, re-arm', note: '§4.6: beat l4_gatelock' },
  { door: 'd4_bay', armedBy: 'last g4_bay member at x < 14.6, or 10 s', phase: 'D_bay', then: 'D', keepSide: (p) => p.x < 14.6, onFail: 'stays open, retries every 2 s', note: '§4.3 (after the spawn)' },
  { door: 'd4_store', armedBy: 'last g4_store member at x < 3.6, or 10 s', phase: 'D_store', then: 'D', keepSide: (p) => p.x < 3.6, onFail: 'stays open, retries every 2 s', note: '§4.5 (after the spawn)' },
];

export function installPhases4(ctx: GameContext, level: Level) {
  installPhaseTable(ctx, level, PHASES4);
  (level as unknown as { latches: Latch4[] }).latches = LATCHES4;
}
