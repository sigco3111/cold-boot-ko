/**
 * LINE TWO — x -10…10, z -70…-22, h 9. The showpiece hall: the line runs N→S along the east side (see
 * line.ts); the west side is the walkway, with LINE CONTROL's thick glass front at z -50…-44 (its warm
 * window the only friendly light), the big status screen over the core door, trusses, trays, a catwalk.
 */
import * as THREE from 'three';
import { rng, type Builder } from '../builder';
import type { LevelBuild } from '../context';
import { cable, cableBundle, ductRect, ductRound, floorSlab, handrail, hazardStrip, ibeam, pipe, trench, truss, valve } from '../kit';
import { androidLeg, androidTorso, cableCoil, crate, drum, floorCable, gasBottle, lockerRow, pallet, shelfRack, switchgear, toolCart, tools, workTable } from '../props';
import { beacon, bulkhead, ceilingSlab, highbay, wallFace, workLight } from '../structure';
import { BELT, buildLine } from './line';
import { intercomPanel, shellPallet } from './kit2';

const PI = Math.PI;
const H = 9;
// REVISION 5.1: the north end of the glass stops at -44.75 so the open south leaf of `d2_booth_hall` (to -44.64)
// slides into solid wall, not into the pane
export const GLASS = { x: -10, z0: -49.85, z1: -44.85, y0: 0.88, y1: 2.72, mullions: [-49.8, -48.0, -46.1, -44.9] };
/** d2_booth_hall's centre (REVISION 5.1: 0.1 m south of -43 so its frame clears the booth's north wall face). */
export const BOOTH_HALL_Z = -43.12;

export function buildHall(L: LevelBuild) {
  L.room('line', '2번 라인', -10, 10, -70, -22, H, 1.8);
  const R = rng(2301);
  const b = L.builder('hall');
  shell(L, b, R);
  glassFront(L, b);
  // g2_foreman (REVISION 5.1): spawn-mode — nothing of it exists before `l2_foreman`. The foreman is lowered
  // folded by the monorail trolley (vignette `foreman_arrive`) to (-3.5, 0, -66.5): pose 'hoist'. Its two husks
  // drop from the parking spur's hooks (yokes at y 6.14, see line.ts): pose 'drop'.
  L.enemy('g2_foreman', 'foreman', 'spawn', -3.5, 0, -66.5, 0, 'hoist');
  buildLine(L, b);
  // the 2.3 m strip between the tunnel and the east wall falls between nav grid columns: hand-placed nodes
  // (south of the partition only: a link across it would run through the fence)
  for (let z = -51.0; z >= -67.5; z -= 1.5) L.navNode(8.65, z, 'line');
  // g2_hall_mid: skitters from under the line (beside the tunnel), a sentry from the roof trusses
  L.enemy('g2_hall_mid', 'skitter', 'spawn', 2.05, 0, -52.6, PI / 2);
  L.enemy('g2_hall_mid', 'skitter', 'spawn', 2.05, 0, -55.4, PI / 2);
  L.enemy('g2_hall_mid', 'sentry', 'spawn', -1.0, 7.4, -53.0, 0);
  // g2_unit32: the next unit off the line, INSIDE the tunnel behind d2_exit (story spawns it after the ride; the
  // exit opens for it because it is inside within 2 m)
  L.enemy('g2_unit32', 'husk', 'spawn', 5.0, BELT.y, -60.5, PI);
  // g2_escort (REVISION 5.1, used when cp2_taken is loaded): the two escorts as real husks in the hall by the booth door
  L.enemy('g2_escort', 'husk', 'spawn', -7.5, 0, -43.4, -PI / 2);
  L.enemy('g2_escort', 'husk', 'spawn', -6.5, 0, -44.4, -PI / 2);
  // g2_unit14: Okafor's limp, standing in front of the core door (never wakes unless damaged)
  L.enemy('g2_unit14', 'husk', 'spawn', 1.6, 0, -68.5, PI, 'standing', 'watch');
  dressing(L, b, R);
  machinery(L, b, R);
  lights(L, b);
}

/** Heavier set dressing: the line's motor control centre, shell racks, a pallet truck, overhead signs. */
function machinery(L: LevelBuild, b: Builder, R: ReturnType<typeof rng>) {
  // motor control centre for line 2 along the east wall, south of the fence
  // (REVISION 5.1: kept ≥ 2 m clear of the partition — nothing climbable near it)
  // (1.9 m tall: its top is no step up onto the tunnel roof, 3.85 m)
  for (let i = 0; i < 6; i++) b.at(9.45, 0, -53.0 - i * 0.92, -PI / 2, () => { switchgear(b, R, 0.9, 1.9, 0.6, 0.45); });
  b.collide(9.1, 0, -58.1, 9.8, 1.9, -52.5);
  b.detail(() => {
    for (let i = 0; i < 8; i++) b.rod(i % 3 ? 'rubber' : 'plastic_dark', 9.5, 1.92, -52.8 - i * 0.65, 9.5, 5.0, -52.8 - i * 0.65 + 0.2, 0.03, 6);
    b.sign('라인 2 — MCC', 'label', 9.12, 2.55, -55.3, 1.2, 0.18, '-x', 0, true);
  });
  // shell racks: A-frames with torso shells hung on pegs, waiting to be fitted
  for (const [x, z] of [[-1.6, -29.0], [-1.6, -31.6]] as const) b.at(x, 0, z, 0, () => {
    for (const s of [-1, 1]) { b.rod('painted_yellow', -1.2, 0, s * 0.45, -1.2, 1.9, s * 0.05, 0.03, 6); b.rod('painted_yellow', 1.2, 0, s * 0.45, 1.2, 1.9, s * 0.05, 0.03, 6); }
    b.rod('painted_yellow', -1.25, 1.9, 0, 1.25, 1.9, 0, 0.04, 8);
    b.box('painted_dark', 0, 0.06, 0, 2.6, 0.12, 1.0);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const px = -0.9 + i * 0.45;
      b.detail(() => b.rod('steel_raw', px, 1.75, 0, px, 1.6, s * 0.2, 0.012, 4));
      b.inst('shell_torso', px, 1.12, s * 0.27, 0, s < 0 ? PI : 0, 0, 0.95);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('rubber', sx * 1.1, 0.05, sz * 0.4, 0.05, 0.04, 'x', 8);
    b.collide(-1.3, 0, -0.5, 1.3, 1.95, 0.5);
  });
  // a pallet truck left mid-aisle with a pallet of arms
  b.at(-7.6, 0, -38.2, 0.35, () => {
    b.box('painted_orange', 0, 0.09, 0.2, 0.55, 0.06, 1.15);
    for (const s of [-1, 1]) b.box('steel_raw', s * 0.18, 0.05, 0.2, 0.16, 0.06, 1.15);
    b.box('painted_orange', 0, 0.35, -0.45, 0.4, 0.5, 0.18);
    b.rod('painted_dark', 0, 0.5, -0.5, 0, 1.15, -0.75, 0.025, 6);
    b.rod('painted_dark', -0.15, 1.18, -0.77, 0.15, 1.18, -0.77, 0.02, 6);
    b.cyl('rubber', 0, 0.08, -0.5, 0.08, 0.1, 'x', 10);
    b.collide(-0.3, 0, -0.6, 0.3, 0.5, 0.8);
  });
  b.at(-7.4, 0.12, -37.3, 0.35, () => { pallet(b, 1.1, 1.0); b.detail(() => { for (let i = 0; i < 6; i++) { b.push(-0.4 + (i % 3) * 0.4, 0.2 + Math.floor(i / 3) * 0.12, -0.15 + Math.floor(i / 3) * 0.2, 0.2, 0, PI / 2); androidArmFlat(b); b.pop(); } }); });
  // overhead signs hung from the trusses
  b.detail(() => {
    for (const [x, z, t] of [[-3.0, -44.0, '적재 스테이션 2'], [-3.0, -60.0, '스테이징 · 노드 5'], [5.0, -48.9, '피팅 터널 2']] as const) {
      for (const s of [-1, 1]) b.rod('steel_raw', x + s * 1.2, 5.1, z, x + s * 1.2, 8.05, z, 0.008, 4);
      b.box('painted_dark', x, 4.9, z, 2.8, 0.5, 0.06);
      b.sign(t, 'label', x, 4.9, z + 0.032, 2.5, 0.36, '+z');
      b.sign(t, 'label', x, 4.9, z - 0.032, 2.5, 0.36, '-z');
    }
    // festoons of cable sagging between the trusses
    for (const z of [-30, -38, -58]) cable(b, 'rubber', [-8, 8.0, z], [1.5, 8.0, z], 1.6, 0.03, 16, 5);
    for (const z of [-34, -62]) cable(b, 'rubber', [-6, 8.0, z], [-0.5, 8.0, z + 3], 1.1, 0.025, 14, 5);
  });
}

function androidArmFlat(b: Builder) {
  b.sphere('robot_shell', 0, -0.17, 0, 0.055, 8, 2.9);
  b.sphere('robot_joint', 0, -0.36, 0, 0.045, 8);
  b.sphere('robot_shell', 0, -0.52, 0, 0.045, 8, 3.0);
}

// ───────────────────────────────────────────────────────────── shell

function shell(L: LevelBuild, b: Builder, R: ReturnType<typeof rng>) {
  const tr: [number, number, number, number] = [0.9, -41.0, 1.5, -25.0];
  floorSlab(b, 'floor_concrete', -10, -70, 10, -22, [tr], 'concrete');
  trench(b, tr[0], tr[1], tr[2], tr[3], 0.5, R, true);
  ceilingSlab(b, -10.2, -70, 10.2, -22, H);
  const common = { h: H, t: 0.2, style: 'dark' as const, bay: 4, columns: true, trayY: 5.0, features: 0.45, boltsBelow: 2.5 };
  wallFace(b, { ...common, n: '-z', plane: -22.2, from: -10, to: 10, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 231 });
  wallFace(b, { ...common, n: '+z', plane: -69.8, from: -10, to: 10, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 232, clear: [[-4.5, 4.5]] });
  wallFace(b, {
    ...common, n: '+x', plane: -9.8, from: -69.8, to: -22.2, seed: 233, features: 0.3, trayY: 0, clearWindows: true,
    openings: [{ c: (GLASS.z0 + GLASS.z1) / 2, w: GLASS.z1 - GLASS.z0, h: GLASS.y1 - GLASS.y0, y0: GLASS.y0 }, { c: BOOTH_HALL_Z, w: 1.6, h: 2.4 }, { c: -66, w: 1.6, h: 2.4 }],
    clear: [[-51, -41]],
  });
  wallFace(b, { ...common, n: '-x', plane: 9.8, from: -69.8, to: -22.2, seed: 234, openings: [{ c: -34, w: 1.6, h: 2.4 }, { c: -61, w: 1.6, h: 2.4 }] });

  // ── roof: trusses every 4 m, purlins, a monorail hoist beam ──
  for (let z = -24; z >= -68; z -= 4) {
    truss(b, 'trim_steel', 'x', 0, 8.45, z, 19.6, 0.8, 0.09, 1.2);
    b.detail(() => { for (const s of [-1, 1]) b.rbox('trim_steel', s * 9.3, 7.7, z, 1.2, 0.08, 0.1, 0, 0, s * 0.8); });
  }
  b.detail(() => { for (let x = -8; x <= 8; x += 4) b.box('trim_steel', x, 8.92, -46, 0.1, 0.1, 47.6); });
  ibeam(b, 'painted_yellow', 'z', -3.5, 7.8, -46, 46, 0.18, 0.3, 0.02, 0.014);
  b.detail(() => {
    // a chain hoist parked on it, hook high
    b.box('painted_yellow', -3.5, 7.45, -36.5, 0.4, 0.4, 0.5);
    for (const d of [-0.06, 0.06]) b.rod('steel_raw', -3.5 + d, 7.3, -36.5, -3.5 + d, 5.4, -36.5, 0.01, 4);
    b.torus('steel_raw', -3.5, 5.3, -36.5, 0.09, 0.025, 'z', 10);
  });
  // ── catwalk along the west wall, over the booth, at 4.4 m ──
  const cy = 4.4;
  // REVISION 5.1: cut at the partition (z -50.35) — two separate runs, each ends at the partition mesh
  const CW: [number, number][] = [[-50.5, -68.8], [-23.2, -50.2]];
  for (const [za, zb] of CW) {
    const zc = (za + zb) / 2, len = Math.abs(za - zb);
    b.detail(() => b.quad('floor_grate', -9.1, cy + 0.03, zc, 1.4, len, '+y', 0, 'box'));
    b.box('trim_steel', -8.37, cy - 0.06, zc, 0.06, 0.18, len);
    b.collide(-9.8, cy - 0.1, Math.min(za, zb), -8.35, cy + 0.03, Math.max(za, zb), 'metal', false);
  }
  for (let z = -68; z <= -24; z += 2) {
    b.box('trim_steel', -9.1, cy - 0.04, z, 1.4, 0.1, 0.06);
    if (z % 4 === 0) b.rbox('trim_steel', -9.2, cy - 0.75, z, 0.07, 1.9, 0.07, 0, 0, -0.72);
  }
  handrail(b, 'painted_yellow', [[-8.4, cy + 0.03, -68.6], [-8.4, cy + 0.03, -50.6]], 1.05, 1.6);
  handrail(b, 'painted_yellow', [[-8.4, cy + 0.03, -50.1], [-8.4, cy + 0.03, -23.4]], 1.05, 1.6);
  b.at(-8.3, 0, -24.4, PI / 2, () => {
    for (const s of [-1, 1]) b.box('painted_yellow', s * 0.24, 2.7, 0.03, 0.05, 5.4, 0.03);
    b.detail(() => { for (let y = 0.3; y < 5.3; y += 0.3) b.rod('steel_raw', -0.24, y, 0.03, 0.24, y, 0.03, 0.012, 5); for (let y = 2.4; y < 5.4; y += 0.65) b.torus('painted_yellow', 0, y, 0.36, 0.36, 0.012, 'y', 14); });
  });
  b.collide(-8.4, 0, -24.7, -8.2, 5.4, -24.1);
  // cable trays slung over the line from the trusses, with drops to the tunnel
  b.detail(() => {
    for (const x of [2.2, 8.2]) {
      b.box('trim_steel', x, 6.0, -46, 0.5, 0.02, 44);
      b.box('trim_steel', x - 0.24, 6.04, -46, 0.02, 0.08, 44).box('trim_steel', x + 0.24, 6.04, -46, 0.02, 0.08, 44);
      for (let i = 0; i < 4; i++) b.rod(i % 2 ? 'rubber' : 'plastic_dark', x - 0.15 + i * 0.1, 6.04, -24.2, x - 0.15 + i * 0.1, 6.04, -67.8, 0.025, 5);
      for (let z = -24; z >= -68; z -= 4) b.rod('trim_steel', x, 6.0, z, x, 8.05, z, 0.015, 4);
    }
    for (const z of [-51, -55, -59]) cableBundle(b, [2.2, 6.0, z], [3.2, 3.85, z + 0.3], 3, 0.25, 0.022, 0.05, R);
    // big services: a round duct along the north wall, a rect riser in the north-east corner
    ductRound(b, 'steel_raw', 'x', -1, 7.4, -23.0, 17.6, 0.45, 2.1, 18);
    ductRect(b, 'steel_raw', 'y', 9.3, 4.5, -23.0, 9, 0.7, 0.5, 2.0);
    for (const [y, r, m] of [[3.5, 0.09, 'steel_raw'], [3.75, 0.06, 'copper'], [3.95, 0.045, 'painted_orange']] as const) {
      pipe(b, m, [[9.5, y, -22.6], [9.5, y, -32.6], [9.0, y, -32.6], [9.0, y, -35.4], [9.5, y, -35.4], [9.5, y, -59.6], [9.0, y, -59.6], [9.0, y, -62.4], [9.5, y, -62.4], [9.5, y, -69.4]], r, { every: 2.4 });
    }
    valve(b, 9.5, 3.5, -46, 'z', 0.09, 'x', -1);
  });
  b.collide(8.95, 0, -23.35, 9.8, 9, -22.65);
}

// ───────────────────────────────────────────────────────────── the booth's glass front (hall side)

function glassFront(L: LevelBuild, b: Builder) {
  const { x, z0, z1, y0, y1, mullions } = GLASS;
  const glass = L.ctx.materials.get('glass_thick');
  // two thick panes (laminated look: two quads 4 cm apart)
  b.detail(() => {
    b.quad(glass, x, (y0 + y1) / 2, (z0 + z1) / 2, z1 - z0, y1 - y0, '+x', 0, 'box');
  });
  b.collide(x - 0.05, y0, z0, x + 0.05, y1, z1, 'glass');
  // frame: sill ledge, head, mullions with rubber gaskets; the hall side is the "outside"
  b.box('trim_steel', x + 0.1, y0, (z0 + z1) / 2, 0.22, 0.06, z1 - z0 + 0.2);
  b.box('trim_steel', x + 0.08, y1 + 0.03, (z0 + z1) / 2, 0.2, 0.12, z1 - z0 + 0.2);
  for (const mz of mullions) {
    b.box('trim_steel', x, (y0 + y1) / 2, mz, 0.2, y1 - y0, mz === mullions[2] ? 0.09 : 0.055);
    b.detail(() => { b.box('rubber', x + 0.105, (y0 + y1) / 2, mz, 0.01, y1 - y0, 0.08); for (let y = y0 + 0.2; y < y1; y += 0.45) b.inst('bolt', x + 0.13, y, mz, 0, PI / 2, 0, 1.6); });
  }
  b.detail(() => {
    b.box('rubber', x + 0.07, y0 + 0.045, (z0 + z1) / 2, 0.02, 0.03, z1 - z0);
    b.box('rubber', x + 0.07, y1 - 0.05, (z0 + z1) / 2, 0.02, 0.03, z1 - z0);
    b.sign('라인 관제', 'label', x + 0.14, y1 + 0.32, (z0 + z1) / 2, 1.8, 0.24, '+x', 0, true);
    b.sign('출입 금지 — 조작자만', 'warning', x + 0.1, 2.05, -41.0, 0.9, 0.2, '+x', 0, true);
    b.sign('인터록 — 라인 가동/정지', 'danger', x + 0.12, 2.75, -43, 1.3, 0.18, '+x', 0, true);
    // a smear where someone leaned on the glass from this side
    b.decal('handprint', 1, x + 0.06, 1.55, -47.6, 0.22, 0.22, '+x', 0.2);
    b.decal('grime', 2, x + 0.18, 0.9, (z0 + z1) / 2, z1 - z0, 0.3, '+y');
  });
  // the intercom on the mullion between pane 2 and 3
  const mz = mullions[2];
  b.at(x + 0.135, 0, mz, PI / 2, () => intercomPanel(b, 1.45));
  b.sign('인터컴', 'label', x + 0.18, 1.73, mz, 0.22, 0.05, '+x');
  L.interact('intercom_hall', 'button', '인터컴 사용', x + 0.45, 1.4, mz, true, 2.2); // in front of the panel: never reachable through the glass (R8)
  const o = new THREE.Object3D(); o.name = 'intercom_hall'; o.position.set(x + 0.2, 1.45, mz); L.root.add(o); L.objects.set('intercom_hall', o);
  const g = new THREE.Object3D(); g.name = 'booth_glass'; g.position.set(x + 0.05, (y0 + y1) / 2, (z0 + z1) / 2); L.root.add(g); L.objects.set('booth_glass', g);
}

// ───────────────────────────────────────────────────────────── dressing

function dressing(L: LevelBuild, b: Builder, R: ReturnType<typeof rng>) {
  // ── floor: walkway lanes, staging boxes, stencils ──
  b.detail(() => {
    // painted lines: overlay materials (they lie on the concrete; REVISION 5.1 z-fight rule)
    const Y = L.overlay('painted_yellow'), W = L.overlay('painted_white');
    b.box(Y, 2.0, 0.002, -46, 0.1, 0.004, 47);
    b.box(Y, -9.0, 0.002, -46, 0.1, 0.004, 47);
    for (let z = -25; z > -68; z -= 3) b.box(W, -3.5, 0.002, z, 0.08, 0.004, 1.6);
    // staging box at the south end, where finished units used to stand
    for (const [x, z, w, d] of [[2.0, -67.8, 3.6, 0.1], [2.0, -64.2, 3.6, 0.1]] as const) b.box(W, x, 0.002, z, w, 0.004, d);
  });
  b.sign('라인 2', 'stencil', -5.5, 0.004, -26.0, 3.2, 1.4, '+y', PI);
  b.sign('스테이징', 'stencil', 2.0, 0.004, -66.0, 2.4, 0.5, '+y', PI);
  b.sign('통로', 'stencil', -3.5, 0.004, -38.0, 1.8, 0.36, '+y', PI / 2);
  b.sign('통로', 'stencil', -3.5, 0.004, -58.0, 1.8, 0.36, '+y', PI / 2);
  hazardStrip(b, -9.0, -70.0 + 0.3, 9.0, -70.0 + 0.45);

  // ── north: parts racks, spare frames, a tug ──
  b.at(-9.2, 0, -27.5, PI / 2, () => shelfRack(b, L, 5.0, 0.9, 3.4, 4, R, 0.8));
  b.at(-6.2, 0, -24.4, 0, () => shellPallet(b, L, 3, 2, 4));
  b.at(-4.8, 0, -24.4, 0.04, () => shellPallet(b, L, 3, 2, 3, true));
  b.at(-7.9, 0, -32.6, 0.2, () => crate(b, 1.4, 1.1, 1.1, 'wall_panel_dark', '액추에이터 세트'));
  b.at(-8.7, 0, -34.2, -0.1, () => { pallet(b, 1.3, 1.1); for (let i = 0; i < 3; i++) { b.push(-0.35 + i * 0.35, 0.3, 0, 0, 0, PI / 2); androidLeg(b); b.pop(); } });
  b.collide(-9.35, 0, -34.75, -8.05, 0.45, -33.65);
  L.pickup('p2_hall_shells_n', 'ammo_shotgun', -7.6, 1.1, -32.5, 6, 0.3);
  // coffee machine and a bin by the booth door (the night shift's corner)
  b.at(-9.45, 0, -40.6, PI / 2, () => {
    b.box('painted_dark', 0, 0.9, 0, 0.62, 1.8, 0.6);
    b.detail(() => {
      b.box('painted_orange', 0, 1.55, 0.31, 0.56, 0.4, 0.016);
      b.sign('뜨거운 음료', 'label', 0, 1.55, 0.31, 0.4, 0.09, '+z');
      b.box('painted_dark', 0, 0.85, 0.24, 0.3, 0.3, 0.14);
      b.box('screen_off', 0.18, 1.2, 0.302, 0.12, 0.08, 0.01);
      for (let i = 0; i < 6; i++) b.box('plastic_white', -0.2 + (i % 3) * 0.1, 1.1 - Math.floor(i / 3) * 0.06, 0.305, 0.06, 0.03, 0.01);
      b.inst('led_amber', 0.18, 1.3, 0.305);
      b.cyl('plastic_white', 0, 0.76, 0.24, 0.035, 0.09, 'y', 10);
    });
    b.collide(-0.31, 0, -0.3, 0.31, 1.8, 0.3);
  });
  b.at(-9.45, 0, -39.7, 0, () => { b.cyl('painted_dark', 0, 0.35, 0, 0.22, 0.7, 'y', 14); b.detail(() => { for (let i = 0; i < 7; i++) b.cyl('plastic_white', R.range(-0.1, 0.1), 0.72 + i * 0.012, R.range(-0.1, 0.1), 0.035, 0.09, 'y', 8); }); });
  b.collide(-9.7, 0, -39.95, -9.2, 0.7, -39.45);
  // ── near the glass: an operator's stool knocked over, cable to the intercom ──
  b.push(-8.9, 0.2, -45.4, 0.6, PI / 2, 0); b.cyl('painted_dark', 0, 0, 0, 0.18, 0.05, 'y', 12); b.cyl('chrome', 0, -0.3, 0, 0.025, 0.6, 'y', 8); b.pop();
  // ── middle (hall_mid fight): cover between the gate and the line south ──
  b.at(-7.0, 0, -53.2, 0.1, () => shellPallet(b, L, 3, 2, 5)); // ≥ 2 m from the partition
  b.at(-7.4, 0, -55.5, -0.2, () => crate(b, 1.6, 1.2, 1.2, 'painted_white', '셸 세트 4-B'));
  b.at(-3.0, 0, -54.0, 0.3, () => { pallet(b, 1.3, 1.1); b.at(0, 0.145, 0, 0, () => crate(b, 1.2, 0.8, 1.0, 'wall_panel_dark', '조인트 R2', false)); b.collide(-0.65, 0, -0.55, 0.65, 0.95, 0.55); });
  b.at(-0.3, 0, -57.6, -0.1, () => workTable(b, 2.0, 0.8, 0.92));
  b.at(-0.6, 0.92, -57.6, 0.3, () => { b.push(0, 0.05, 0, 0, 0, PI / 2); androidTorso(b, true, 1, R); b.pop(); });
  b.at(-8.7, 0, -55.0, 0, () => drum(b)); b.at(-8.1, 0, -54.4, 0, () => drum(b, 'painted_yellow')); b.at(-8.8, 0, -54.0, 0, () => drum(b));
  b.at(-8.8, 0, -59.4, PI / 2, () => toolCart(b, R));
  b.at(-8.2, 0, -61.0, 0, () => tools(b, 4, 0.5, R));
  for (let i = 0; i < 4; i++) b.at(-9.55, 0, -56.6 - i * 0.3, i, () => gasBottle(b, i % 2 ? 'painted_orange' : 'painted_white'));
  b.collide(-9.75, 0, -57.6, -9.35, 1.4, -56.4);
  b.at(-9.5, 0, -63.0, PI / 2, () => lockerRow(b, 4, R, 'wall_panel_dark'));
  b.at(-6.6, 0, -64.6, 0.15, () => cableCoil(b, 0.4, 5));
  // south pickups (before the foreman)
  L.pickup('p2_hall_shells_s1', 'ammo_shotgun', -7.0, 1.0, -55.2, 6, 0.2);
  L.pickup('p2_hall_shells_s2', 'ammo_shotgun', -9.0, 0, -61.6, 6, 1.0);
  L.pickup('p2_hall_ammo_s1', 'ammo_pistol', -0.9, 0.92, -57.3, 12, 0.1);
  L.pickup('p2_hall_ammo_s2', 'ammo_pistol', -8.4, 0.9, -54.6, 12, 0.6);
  L.pickup('p2_hall_med_s1', 'medkit', -9.2, 0, -64.6, 35, 0.3);
  L.pickup('p2_hall_med_s2', 'medkit', -2.6, 0.95, -54.2, 35, 0.2);
  // ── the big status screen over the core door ──
  b.box('painted_dark', 0, 5.6, -69.62, 8.4, 3.76, 0.3);
  b.detail(() => {
    for (const s of [-1, 1]) { b.box('trim_steel', s * 4.14, 5.6, -69.45, 0.16, 3.86, 0.08); b.box('trim_steel', 0, 5.6 + s * 1.85, -69.45, 8.44, 0.16, 0.08); }
    for (const x of [-3, -1, 1, 3]) b.rbox('trim_steel', x, 8.0, -69.6, 0.08, 1.2, 0.08, 0.2, 0, 0);
    b.sign('라인 2 — 생산 현황', 'label', 0, 3.55, -69.76, 2.6, 0.14, '+z');
  });
  L.screen('line_bigscreen', 'terminal_idle', 7.9, 3.4, 0, 5.6, -69.46, '+z', { text: '2번 라인 — 구역 C\n수율   31 / 31\n인원   0' });
  const bigscreen = L.screens.get('line_bigscreen')!;
  L.vignette('hall_screen_count', () => {
    let n = 28;
    const tick = () => {
      L.ctx.materials.setScreen(bigscreen, 'terminal_idle', { text: `LINE TWO — SECTION C\nYIELD   ${n} / 31\nHEADCOUNT   0` });
      L.sfx('terminal_beep', 0, 5, -69, 0.6);
      if (n < 31) { n++; L.after(0.6, tick); } else L.after(1.4, () => { L.ctx.materials.setScreen(bigscreen, 'terminal_alert', { text: '정지됨 — 현장 정지:\n라인 관제' }); L.sfx('alarm_blip', 0, 5, -69, 0.8); });
    };
    tick();
  });
  // ── floor clutter: cables, oil, stains ──
  floorCable(b, [[-8.2, -45.2], [-9.5, -45.6], [-9.7, -46.0]], 0.02, 'plastic_dark');
  floorCable(b, [[1.0, -46.2], [1.6, -48.6], [2.2, -52.0], [2.4, -58.0]], 0.035);
  for (let i = 0; i < 14; i++) {
    const x = R.range(-9, 1.5), z = R.range(-68, -24);
    b.decal(R.chance(0.6) ? 'oil_stain' : 'grime', R.int(0, 3), x, 0.003, z, R.range(1.2, 2.6), R.range(1.2, 2.6), '+y', R.range(0, 6));
  }
  b.decal('oil_stain', 2, 5, 0.003, -64.8, 2.2, 1.6, '+y', 0.2);
  // ── signs ──
  b.sign('2번 라인', 'stencil', 5.0, 7.0, -22.236, 6.0, 1.0, '-z');
  b.sign('할시온 다이내믹스', 'stencil', 9.764, 7.2, -46, 7.0, 0.8, '-x');
  b.sign('구역 C', 'stencil', -9.764, 6.6, -36, 4.0, 0.8, '+x');
  b.sign('장착 베이 →', 'directional', 9.764, 2.2, -36.0, 1.2, 0.22, '-x', 0, true);
  b.sign('구역 C 중계 →', 'directional', 9.764, 2.2, -63.0, 1.4, 0.22, '-x', 0, true);
  b.sign('← 서비스 스파인', 'directional', -9.764, 2.2, -63.8, 1.3, 0.22, '+x', 0, true);
  b.sign('노드 5 — 인가된 인원만 출입', 'danger', 3.3, 2.6, -69.764, 1.8, 0.24, '+z', 0, true);
  b.sign('수율이 곧 안전', 'label', -6.0, 3.2, -69.764, 1.6, 0.2, '+z', 0, true);
  void cable; void ibeam;
}

// ───────────────────────────────────────────────────────────── lights

function lights(L: LevelBuild, b: Builder) {
  // amber sodium high-bays: pools on the walkway and along the line, darkness between them
  let gm: THREE.Material | undefined;
  const bays: [number, number, boolean, boolean][] = [
    [-5, -26.5, false, true], [-5.5, -33.5, true, false], [-5, -40, false, false], [-5.5, -54.5, true, true], [-4.5, -61, false, false], [-5, -67, false, true],
    [5, -27.5, false, false], [5, -35, true, true], [5, -42, false, false], [5, -65.5, true, false], [8.8, -31, false, false], [8.8, -58, false, true],
  ];
  // over the tunnel roof: only the hanging units and the roof machinery (never inside the machine)
  L.spot('line', 5, 8.0, -56, 5, 3.6, -56, 0xffa24a, 260, 12, 0.6, { priority: 2, vol: true, bounds: new THREE.Box3(new THREE.Vector3(-10, 3.75, -70), new THREE.Vector3(10, 10, -22)) });
  // lamps whose cone would reach into the fitting tunnel stop at its faces (no shadows: they would shine through the shell)
  const tunnelSafe = (x: number, z: number) => (x < 2 || x > 7.6 ? undefined : z > -50 ? new THREE.Box3(new THREE.Vector3(-10.4, -1, -49.95), new THREE.Vector3(10.4, 1e4, -21.6)) : new THREE.Box3(new THREE.Vector3(-10.4, -1, -70.4), new THREE.Vector3(10.4, 1e4, -62.05)));
  for (const [x, z, cast, vol] of bays) {
    gm = (highbay(b, L, { group: 'line', x, y: 8.0, z, top: 8.45, intensity: 300, distance: 14, angle: 0.62, color: 0xffa24a, cast, vol, priority: 2, glowMat: gm, glow: 'emissive_amber', bounds: tunnelSafe(x, z) }) as any).glowMat;
  }
  // amber wall packs high on the columns (glow only, plus two that really light)
  b.detail(() => {
    for (let z = -26; z >= -66; z -= 8) for (const [x, f] of [[-9.55, 1], [9.55, -1]] as const) {
      b.box('painted_dark', x, 6.2, z, 0.2, 0.26, 0.46);
      b.box(gm!, x + f * 0.105, 6.18, z, 0.02, 0.16, 0.26);
    }
  });
  L.point('line', -9.0, 6.0, -42, 0xff9a40, 10, 9, { priority: 1 });
  L.point('line', 9.0, 6.0, -50, 0xff9a40, 10, 9, { priority: 1 });
  // the booth window's warm spill onto the walkway (switches with the booth)
  L.spot('booth', -10.6, 2.3, -47, -7.0, 0, -47, 0xffb26a, 46, 8, 0.95, { priority: 3, penumbra: 0.9, vol: true, bounds: null });
  // big screen wash
  L.point('line', 0, 5.0, -67.4, 0x58e0c8, 8, 11, { flicker: 'fluorescent' });
  // small practical lamps at the doors
  // the fitting door's blue lamp IS that door's status light (REVISION 5.1): dark until Tomas unlocks it
  let fitLamp: ReturnType<typeof bulkhead> | null = null;
  b.at(9.77, 0, -32.6, -PI / 2, () => { fitLamp = bulkhead(b, L, 'fitting_door', 0, 2.6, 0, 0x9fd8ff, 4, 4.5, 'emissive_cyan', { flicker: 'fluorescent', enabled: false }); });
  L.afterDoors.push(() => {
    const d = L.doors.get('d2_fitting');
    if (!d || !fitLamp) return;
    const h = fitLamp;
    const set = (st: string) => { h.enabled = st === 'open'; };
    d.statusListeners.push(set);
    set(d.shown);
  });
  b.at(-9.77, 0, -64.6, PI / 2, () => bulkhead(b, L, 'line', 0, 2.6, 0, 0xffb070, 3, 4, 'emissive_warm'));
  b.at(9.77, 0, -59.6, -PI / 2, () => bulkhead(b, L, 'line', 0, 2.6, 0, 0xff4020, 2.5, 4, 'emissive_red', { flicker: 'pulse' }));
  workLight(b, L, 'line', -7.8, -29.6, Math.atan2(-(-5 + 7.8), -(-26 + 29.6)), { intensity: 70, distance: 9, angle: 0.8, pitch: 0.4 });
  // emergency beacons on the columns (off until the line starts / story)
  let bm: THREE.Material | undefined;
  for (const [x, z] of [[-9.6, -30], [-9.6, -54], [9.6, -42], [9.6, -54], [-9.6, -66], [9.6, -26]] as const) {
    bm = (beacon(b, L, 'line_emergency', x, 5.6, z, -1, 0xff2a12, 70, 13, 'emissive_red', false, 'alarm', bm) as any).glowMat;
  }
  // dust in the light shafts
  L.ctx.fx.emitter('dust', L.vec(-5, 3.0, -35), L.vec(0, -1, 0), 6);
  L.ctx.fx.emitter('dust', L.vec(-5.5, 3.0, -55.5), L.vec(0, -1, 0), 6);
  L.ctx.fx.emitter('steam', L.vec(7.3, 3.0, -56), L.vec(1, 0.5, 0), 25);
  L.ctx.fx.emitter('drip', L.vec(-2.5, 8.6, -48), L.vec(0, -1, 0), 1.0);
  void ductRect;
}
