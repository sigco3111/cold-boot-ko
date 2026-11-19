/**
 * COLD BOOT — level 2 "2번 라인" (REVISION 4 in docs/DESIGN.md: room ids/bounds, doors, triggers, ids).
 * Built with the same kits as level 1; only the data and the rooms differ.
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import { LevelBuild } from '../context';
import type { DoorSpec } from '../doors';
import { defineInstances } from '../props';
import { assembleLevel, buildRooms, type MachineLoop, type PortalSpec } from '../assemble';
import type { TriggerSpec } from '../triggers';
import { buildCab } from '../rooms/elevator';
import { defineInstances2 } from './kit2';
import { buildDock } from './dock';
import { buildIntake } from './intake';
import { buildHall } from './hall';
import { buildBooth } from './booth';
import { buildFitting } from './fitting';
import { buildRelay } from './relay';
import { buildSpine } from './spine';
import { buildCore } from './core';
import { BELT, GATE, PARTITION_Z, SHUTTER } from './line';
import { REGIONS2, installPhases } from './phases';
import { BOOTH_HALL_Z } from './hall';

const PI = Math.PI;

export const DOORS2: DoorSpec[] = [
  { id: 'd2_cab', x: 0, z: 0, wall: 'z', kind: 'cage', locked: true, labelFront: '화물 도크 5', labelBack: '화물 엘리베이터', rooms: ['cab', 'dock'] },
  { id: 'd2_intake', x: 0, z: -8, wall: 'z', kind: 'wide', locked: false, labelFront: '흡입구', labelBack: '화물 도크 5', leafMat: 'painted_white', rooms: ['dock', 'intake'] },
  { id: 'd2_line', x: 0, z: -22, wall: 'z', kind: 'wide', locked: false, labelFront: '2번 라인', labelBack: '흡입구', leafMat: 'painted_white', windows: true, rooms: ['intake', 'line'] },
  // REVISION 5.1: locked and dark at load; Tomas unlocks it in the first talk (its blue lamp is its status light)
  { id: 'd2_fitting', x: 10, z: -34, wall: 'x', kind: 'std', locked: true, status: 'dark', labelFront: '2번 라인', labelBack: '장착 베이', rooms: ['line', 'fitting'] },
  { id: 'd2_relay', x: 10, z: -61, wall: 'x', kind: 'std', locked: true, labelFront: '2번 라인', labelBack: '구역 C 중계', leafMat: 'painted_yellow', rooms: ['line', 'relay'] },
  { id: 'd2_spine', x: -10, z: -66, wall: 'x', kind: 'std', locked: true, labelFront: '서비스 스파인', labelBack: '2번 라인', rooms: ['line', 'spine'] },
  { id: 'd2_bulkhead_s', x: -19, z: -56, wall: 'z', kind: 'std', locked: true, labelFront: '스파인 — 남측', labelBack: '스파인 — 라인 관제', leafMat: 'painted_yellow', rooms: ['spine', 'spine'] },
  { id: 'd2_bulkhead_n', x: -19, z: -36, wall: 'z', kind: 'std', locked: true, labelFront: '스파인 — 라인 관제', labelBack: '구역 B', leafMat: 'painted_yellow', rooms: ['spine', 'spine'] },
  { id: 'd2_booth', x: -17, z: -46, wall: 'x', kind: 'std', locked: true, labelFront: '서비스 스파인', labelBack: '라인 관제', rooms: ['booth', 'spine'] },
  { id: 'd2_booth_hall', x: -10, z: BOOTH_HALL_Z, wall: 'x', kind: 'std', locked: true, labelFront: '라인 관제', labelBack: '2번 라인', rooms: ['line', 'booth'] },
  { id: 'd2_core', x: 0, z: -70, wall: 'z', kind: 'wide', locked: true, labelFront: '노드 5', labelBack: '2번 라인', leafMat: 'painted_white', rooms: ['line', 'core'] },
  { id: 'd2_lift', x: 0, z: -88, wall: 'z', kind: 'std', locked: true, labelFront: '서비스 리프트', labelBack: '노드 5', leafMat: 'painted_white', rooms: ['core', 'lift'] },
  // ── REVISION 5.1: the hall partition's barriers are real doors (non-auto; scripts / phases.ts drive them) ──
  { id: 'd2_gate', x: GATE.x, z: PARTITION_Z, wall: 'z', kind: 'std', w: GATE.w, h: GATE.h, duration: 2.4, frame: false, leafStyle: 'sheet', auto: false,
    panel: [GATE.w / 2 + 0.55, 1.45, 0.15], locked: false, labelFront: '', labelBack: '', leafMat: 'painted_yellow', rooms: ['line', 'line'] },
  { id: 'd2_mouth', x: 5, z: SHUTTER.mouthZ, wall: 'z', kind: 'std', w: SHUTTER.w, h: SHUTTER.h - 0.035, y0: BELT.y + 0.035, duration: 1.6, frame: false, leafStyle: 'sheet', auto: false,
    panel: [1.85, 1.0, 0.15], locked: true, labelFront: '', labelBack: '', leafMat: 'wall_panel_dark', rooms: ['line', 'line'] },
  { id: 'd2_exit', x: 5, z: SHUTTER.exitZ, wall: 'z', kind: 'std', w: SHUTTER.w, h: SHUTTER.h - 0.035, y0: BELT.y + 0.035, duration: 1.2, frame: false, leafStyle: 'sheet', auto: false,
    panel: [1.85, 1.0, 0.15], locked: true, labelFront: '', labelBack: '', leafMat: 'wall_panel_dark', rooms: ['line', 'line'] },
];

const FRAME_ZONE: Record<string, { name: string; rooms: string[] }> = {
  a: { name: 'frames2_a', rooms: ['cab', 'dock', 'intake', 'line'] },
  b: { name: 'frames2_b', rooms: ['line', 'fitting', 'relay', 'spine', 'booth', 'core'] },
  c: { name: 'frames2_c', rooms: ['spine', 'booth', 'core', 'lift'] },
};
const zoneOf = (s: DoorSpec) => (['d2_cab', 'd2_intake', 'd2_line'].includes(s.id) ? FRAME_ZONE.a : ['d2_bulkhead_s', 'd2_bulkhead_n', 'd2_booth', 'd2_lift'].includes(s.id) ? FRAME_ZONE.c : FRAME_ZONE.b);

const PORTALS: PortalSpec[] = [
  ['cab', 'dock', 'd2_cab', true], ['dock', 'intake', 'd2_intake', false], ['intake', 'line', 'd2_line', false],
  ['line', 'fitting', 'd2_fitting', false], ['line', 'relay', 'd2_relay', false],
  // the booth's thick glass and its spine window are always see-through
  ['line', 'booth', 'd2_booth_hall', 20], ['booth', 'spine', 'd2_booth', 13], ['line', 'spine', 'd2_spine', false],
  ['line', 'core', 'd2_core', false], ['core', 'lift', 'd2_lift', true],
];

export const TRIGGERS2: TriggerSpec[] = [
  { id: 't2_dock', x0: -4, x1: 4, z0: -7.75, z1: -0.25 },
  { id: 't2_intake', x0: -5, x1: 5, z0: -22, z1: -8.25 },
  { id: 't2_intake_arch', x0: -5, x1: 5, z0: -22, z1: -19 },
  { id: 't2_line_enter', x0: -10, x1: 10, z0: -26, z1: -22.25 },
  { id: 't2_glass', x0: -10, x1: -6, z0: -50, z1: -41 },
  { id: 't2_fitting', x0: 10.25, x1: 20, z0: -40, z1: -28 },
  { id: 't2_fitting_rig', x0: 12.0, x1: 15.0, z0: -39.6, z1: -35.4 },
  { id: 't2_line_south', x0: -10, x1: 2.5, z0: -70, z1: -54 },
  { id: 't2_relay', x0: 10.25, x1: 18, z0: -66, z1: -56 },
  { id: 't2_spine', x0: -21, x1: -17, z0: -68, z1: -30 },
  { id: 't2_spine_window', x0: -21, x1: -17, z0: -52, z1: -44 },
  // REVISION 5.1: the trap latch — spine, fully north of d2_bulkhead_s (its leaves are at z -56 ± 0.11)
  { id: 't2_spine_trap', x0: -21, x1: -17, z0: -55.4, z1: -51 },
  { id: 't2_booth', x0: -17, x1: -10.25, z0: -50, z1: -42 },
  { id: 't2_load', x0: 1, x1: 8, z0: -47, z1: -42 },
  // the belt up to the exit shutter (the tail past the exit, beside the apron, is not "on the belt")
  { id: 't2_belt', x0: 4.05, x1: 5.95, z0: SHUTTER.exitZ, z1: -36.5 },
  { id: 't2_tunnel_in', x0: 2.5, x1: 7.5, z0: -52, z1: -50 },
  { id: 't2_tunnel_mid', x0: 2.5, x1: 7.5, z0: -57, z1: -55 },
  { id: 't2_tunnel_out', x0: 2.5, x1: 7.5, z0: -66, z1: -62.5 },
  { id: 't2_core_door', x0: -10, x1: 10, z0: -70, z1: -66 },
  { id: 't2_core', x0: -8, x1: 8, z0: -88, z1: -72 },
  { id: 't2_lift', x0: -2, x1: 2, z0: -93, z1: -88.25 },
];

const MACHINE_LOOPS: Record<string, MachineLoop> = {
  l2_line: { id: 'belt_loop', pos: [5, 1.2, -40], vol: { idle: 0.3, active: 0.9, frenzy: 1 } },
  l2_tunnel: { id: 'machine_loop', pos: [5, 1.5, -56], vol: { idle: 0.35, active: 0.9, frenzy: 1 } },
  l2_treadmills: { id: 'treadmill_loop', pos: [16, 0.5, -34], vol: { idle: 0.3, active: 0.6, frenzy: 0.9 } },
  l2_core: { id: 'core_hum', pos: [0, 2, -80], vol: { idle: 0.5, active: 0.8, frenzy: 1 } },
  l2_lift: { id: 'lift_loop', pos: [0, 1.5, -90.5], vol: { idle: 0.3, active: 0.8, frenzy: 1 } },
  l2_elevator: { id: 'elevator_loop', pos: [0, 1.5, 2.5], vol: { idle: 0.2, active: 0.8, frenzy: 1 } },
};

export async function createLevel2(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const L = new LevelBuild(ctx);
  // permanent openings: the cage gate both ways
  L.lightSpill = { cab: [1.6, 1.6, 3.4, 2.6], dock: [0, 0, 0, 5.6] };
  ctx.scene.add(L.root);
  defineInstances(L);
  defineInstances2(L);

  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  buildRooms(L, [
    ['cab', (l) => buildCab(l, {
      room: { id: 'cab', name: '화물 엘리베이터', x0: -2.5, x1: 2.5, z0: 0, z1: 5 }, group: 'cab', doorId: 'd2_cab', screen: 'cab_panel',
      machine: 'l2_elevator', mode: 'arrive', lit: true, extras: false, place: { gateZ: 0, ry: PI }, panelText: '하부 5층\n2번 라인',
    })],
    ['dock', buildDock], ['intake', buildIntake], ['line', buildHall], ['booth', buildBooth], ['fitting', buildFitting],
    ['relay', buildRelay], ['spine', buildSpine], ['core', buildCore],
  ], lap);

  const level = assembleLevel(ctx, L, {
    doors: DOORS2,
    frameZone: zoneOf,
    portals: PORTALS,
    seeRange: 22,
    triggers: TRIGGERS2,
    // the spine link passage and the core vestibule are not rooms: hand-placed nav
    navStep: (id) => (id === 'line' ? 1.6 : id === 'spine' ? 1.0 : id === 'core' ? 1.5 : id === 'fitting' ? 1.1 : 1.0),
    navStart: { x: 0, z: 2.5 },
    extraProbes: [new THREE.Vector3(-4, 2.0, -30), new THREE.Vector3(-4, 2.0, -58), new THREE.Vector3(5, 1.6, -56), new THREE.Vector3(-19, 1.5, -60), new THREE.Vector3(-19, 1.5, -36)],
    spawn: { position: new THREE.Vector3(0, 0, 3.2), yaw: 0 },
    startRoom: 'cab',
    machineLoops: MACHINE_LOOPS,
    regions: REGIONS2(),
    timings, t0,
  });

  L.setMachine = (n, s) => level.setMachine(n, s);
  // nostory (REVISION 5.1): line held, gate open, mouth and exit shut, every other door unlocked
  if (ctx.debug.noStory) {
    const g = L.doors.get('d2_gate');
    if (g) { g.unlock(); g.open(); g.snap(); }
    for (const id of ['d2_fitting', 'd2_booth', 'd2_booth_hall']) L.doors.get(id)?.setStatus(null);
  } else {
    // at load the gate stands open (line held); the shutters are shut
    const g = L.doors.get('d2_gate');
    if (g) { g.open(); g.snap(); }
  }
  installPhases(ctx, L, level);
  // ── defaults (REVISION 4 → light groups / machines): nothing else may need to call these ──
  level.setMachine('l2_treadmills', 'active');
  level.setMachine('l2_core', 'active');
  level.setMachine('l2_tunnel', 'idle');

  // ── debug: switch machines / fire vignettes from the console ──
  (level as unknown as { list: () => unknown }).list = () => ({ machines: [...L.machines.keys()], vignettes: [...L.vignettes.keys()], screens: [...L.screens.keys()], objects: [...L.objects.keys()] });
  return level;
}
