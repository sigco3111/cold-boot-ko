/**
 * COLD BOOT — level module: SUBLEVEL 3 of the ERIDU deep fabrication complex.
 * Everything is procedural; see docs/DESIGN.md for the authoritative layout, ids and light groups.
 */
import * as THREE from 'three';
import type { GameContext, Level, LevelId } from '../core/types';
import { LevelBuild } from './context';
import type { DoorSpec } from './doors';
import { defineInstances } from './props';
import { assembleLevel, buildRooms, type MachineLoop, type PortalSpec } from './assemble';
import { createLevel2 } from './l2';
import { createLevel3 } from './l3';
import { createLevel4 } from './l4';
import { createLevel5 } from './l5';
import { createLevel6 } from './l6';
import { buildMed } from './rooms/med';
import { buildCorridor } from './rooms/corridor';
import { buildQuarters } from './rooms/quarters';
import { buildPump } from './rooms/pump';
import { buildJunction } from './rooms/junction';
import { buildSecurity } from './rooms/security';
import { buildStorage } from './rooms/storage';
import { buildAirlock } from './rooms/airlock';
import { buildFab } from './rooms/fab';
import { buildGen } from './rooms/gen';
import { buildLobby } from './rooms/lobby';
import { buildElevator } from './rooms/elevator';
import { TRIGGERS } from './triggers';
import { installPhases1 } from './phases';

const DOORS: DoorSpec[] = [
  { id: 'd_med', x: 0, z: 0, wall: 'z', kind: 'std', locked: false, labelFront: '서비스 통로 A', labelBack: '의무실 3-A', rooms: ['med', 'corr_a'] },
  { id: 'd_sec', x: -3, z: -17, wall: 'x', kind: 'std', locked: false, labelFront: '보안실 3', labelBack: '정션 3', rooms: ['junction', 'sec'] },
  { id: 'd_quarters', x: -1.7, z: -6.5, wall: 'x', kind: 'std', locked: false, labelFront: '승조원 숙소 3', labelBack: '서비스 통로 A', rooms: ['corr_a', 'quarters'], ajar: 0.3 },
  { id: 'd_storage', x: 3, z: -17, wall: 'x', kind: 'std', locked: false, labelFront: '정션 3', labelBack: '장비 창고', rooms: ['junction', 'storage'] },
  { id: 'd_fab_outer', x: 0, z: -20, wall: 'z', kind: 'wide', locked: true, labelFront: '제작 출입 록', labelBack: '정션 3', leafMat: 'painted_yellow', rooms: ['junction', 'airlock'] },
  { id: 'd_fab_inner', x: 0, z: -26, wall: 'z', kind: 'wide', locked: false, labelFront: '제작 홀 3', labelBack: '제작 출입 록', leafMat: 'painted_yellow', windows: true, rooms: ['airlock', 'fab'] },
  { id: 'd_gen', x: 12, z: -38, wall: 'x', kind: 'std', locked: false, labelFront: '제작 홀 3', labelBack: '배전실 3', rooms: ['fab', 'gen'] },
  { id: 'd_pump', x: -12.2, z: -38, wall: 'x', kind: 'std', locked: true, labelFront: '냉각수 펌프실 3', labelBack: '제작 홀 3', rooms: ['fab', 'pump'] },
  { id: 'd_lobby', x: 0, z: -50, wall: 'z', kind: 'wide', locked: true, labelFront: '화물 로비', labelBack: '제작 홀 3', leafMat: 'wall_panel_dark', rooms: ['fab', 'lobby'] },
  { id: 'd_elev', x: 0, z: -58, wall: 'z', kind: 'cage', locked: true, labelFront: '화물 엘리베이터', labelBack: '화물 로비', rooms: ['lobby', 'elevator'] },
];

const ROOM_OF: Record<string, string> = { med: 'med', corr: 'corr_a', quarters: 'quarters', pump: 'pump', junction: 'junction', sec: 'sec', storage: 'storage', airlock: 'airlock', fab: 'fab', gen: 'gen', lobby: 'lobby', elevator: 'elevator' };
/**
 * Portal graph for room visibility: [room A, room B, door id | null (always open), see-through when shut].
 * See-through: true = SEE_RANGE, or the distance (m) from the door within which the far side is drawn.
 */
const PORTALS: PortalSpec[] = [
  ['med', 'corr_a', 'd_med', false], ['corr_a', 'quarters', 'd_quarters', 11], ['fab', 'pump', 'd_pump', false], ['corr_a', 'junction', null, true], ['junction', 'sec', 'd_sec', false], ['junction', 'storage', 'd_storage', false],
  ['junction', 'airlock', 'd_fab_outer', false], ['airlock', 'fab', 'd_fab_inner', false], ['fab', 'gen', 'd_gen', false], ['fab', 'lobby', 'd_lobby', false],
  ['lobby', 'elevator', 'd_elev', true],
];
const MACHINE_LOOPS: Record<string, MachineLoop> = {
  fab_arms: { id: 'arm_servo_loop', pos: [0, 1.5, -38], vol: { idle: 0.25, active: 0.7, frenzy: 1 } },
  fab_conveyor: { id: 'conveyor_loop', pos: [0, 5.5, -38], vol: { idle: 0.2, active: 0.7, frenzy: 1 } },
  gen_turbine: { id: 'machine_loop', pos: [19, 1.5, -38], vol: { idle: 0.25, active: 0.8, frenzy: 1 } },
};

/** Dispatch on the level this page load runs (REVISION 4; §8.1: one entry per built level). */
const LEVEL_BUILDERS: Partial<Record<LevelId, (ctx: GameContext) => Promise<Level>>> = { 1: createLevel1, 2: createLevel2, 3: createLevel3, 4: createLevel4, 5: createLevel5, 6: createLevel6 };

export async function createLevel(ctx: GameContext): Promise<Level> {
  // dev only (stage 3a K3): `?greybox=deck2` loads the two-deck test greybox (lazy chunk; not a level)
  if (new URLSearchParams(location.search).get('greybox') === 'deck2') return (await import('./dev/deck2')).createGreyboxDeck2(ctx);
  const build = LEVEL_BUILDERS[ctx.levelId];
  if (!build) throw new Error(`[level] no level ${ctx.levelId} in LEVEL_BUILDERS`);
  return build(ctx);
}

async function createLevel1(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const L = new LevelBuild(ctx);
  ctx.scene.add(L.root);
  defineInstances(L);

  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  buildRooms(L, ([['med', buildMed], ['corr', buildCorridor], ['quarters', buildQuarters], ['junction', buildJunction], ['sec', buildSecurity], ['storage', buildStorage],
    ['airlock', buildAirlock], ['fab', buildFab], ['pump', buildPump], ['gen', buildGen], ['lobby', buildLobby], ['elevator', buildElevator]] as const).map(([k, fn]) => [ROOM_OF[k], fn] as const), lap);

  const level = assembleLevel(ctx, L, {
    doors: DOORS,
    portals: PORTALS,
    seeRange: 22,
    triggers: TRIGGERS,
    navPortals: [{ x: 0, z: -13.8 }],
    navStep: (id) => (id === 'fab' ? 1.7 : id === 'storage' ? 0.7 : id === 'gen' ? 1.25 : id === 'quarters' ? 0.8 : 1.0),
    navStart: { x: 0, z: 7 },
    // fab hall is big: extra reflection probes
    extraProbes: [new THREE.Vector3(-6, 1.8, -32), new THREE.Vector3(6, 1.8, -44)],
    spawn: { position: new THREE.Vector3(0, 0, 7), yaw: 0 },
    startRoom: 'med',
    machineLoops: MACHINE_LOOPS,
    timings, t0,
  });
  installPhases1(ctx, L, level);
  return level;
}
