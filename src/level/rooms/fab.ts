/**
 * FABRICATION HALL 3 — x -12…12, z -50…-26, h 8. The showpiece: assembly line, robot arms, overhead
 * android conveyor, gantry crane, catwalk, big status screen.
 */
import * as THREE from 'three';
import { rng, type Builder } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { cable, cableBundle, channel, ductRect, ductRound, floorSlab, grate, handrail, hazardStrip, hose, ibeam, pipe, trench, truss, valve } from '../kit';
import { Conveyor, LoopPath, ArmRig, RobotArm, armPedestal, type ArmSpec, type HookLoad } from '../machines';
import { androidArm, androidLeg, androidTorso, boots, cableCoil, crate, drapedBody, drum, floorCable, gasBottle, lockerRow, pallet, tablet, toolCart, tools, vise, workTable } from '../props';
import { beacon, bulkhead, ceilingSlab, highbay, wallFace, workLight } from '../structure';
import { tallyMaterial } from '../scrawl';

const PI = Math.PI;
const H = 8;

export function buildFab(L: LevelBuild) {
  L.room('fab', '제작 홀 3', -12, 12, -50, -26, H, 1.8);
  const R = rng(707);
  shell(L, R);
  const conv = line(L, R);
  dressing(L, R, conv);
}

// ───────────────────────────────────────────────────────────── shell

function shell(L: LevelBuild, R: ReturnType<typeof rng>) {
  const b = L.builder('fab_shell');
  const trenches: [number, number, number, number][] = [[3.45, -44.6, 4.05, -31.4], [-4.05, -44.6, -3.45, -31.4]];
  floorSlab(b, 'floor_concrete', -12, -50, 12, -26, trenches, 'concrete');
  for (const t of trenches) trench(b, t[0], t[1], t[2], t[3], 0.5, R, true);
  ceilingSlab(b, -12.4, -50, 12.2, -26, H);

  wallFace(b, { n: '-z', plane: -26.2, from: -12, to: 12, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], style: 'dark', seed: 51, bay: 4, columns: true, trayY: 3.3, features: 0.5 });
  wallFace(b, { n: '+z', plane: -49.8, from: -12, to: 12, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], style: 'dark', seed: 52, bay: 4, columns: true, trayY: 3.3, features: 0.5 });
  wallFace(b, { n: '-x', plane: 11.8, from: -49.8, to: -26.2, h: H, t: 0.2, openings: [{ c: -38, w: 1.6, h: 2.4 }], style: 'dark', seed: 53, bay: 4, columns: true, trayY: 3.3, features: 0.5 });
  wallFace(b, { n: '+x', plane: -12, from: -49.8, to: -26.2, h: H, style: 'dark', seed: 54, bay: 4, columns: true, trayY: 0, features: 0.3, openings: [{ c: -38, w: 1.6, h: 2.4 }], clear: [[-36.6, -33.2]] });

  // ── roof trusses + purlins ──
  for (let z = -28; z >= -48; z -= 4) {
    truss(b, 'trim_steel', 'x', 0, 7.6, z, 23.6, 0.7, 0.09, 1.2);
    b.detail(() => { for (const s of [-1, 1]) b.rbox('trim_steel', s * 11.2, 7.0, z, 1.3, 0.08, 0.1, 0, 0, s * 0.8); });
  }
  b.detail(() => { for (let x = -10; x <= 10; x += 4) b.box('trim_steel', x, 7.93, -38, 0.1, 0.1, 23.6); });

  // ── gantry crane: rails on corbels along both side walls, bridge parked at z = -41 ──
  for (const s of [-1, 1]) {
    const rx = s * 11.35;
    ibeam(b, 'painted_yellow', 'z', rx, 6.45, -38, 23.4, 0.22, 0.34, 0.025, 0.016);
    b.box('steel_raw', rx, 6.65, -38, 0.06, 0.06, 23.4);
    for (let z = -28; z >= -48; z -= 4) { b.box('trim_steel', s * 11.5, 6.2, z, 0.5, 0.14, 0.34); b.rbox('trim_steel', s * 11.55, 5.9, z, 0.08, 0.6, 0.1, 0, 0, s * 0.5); }
    b.box('hazard_stripes', rx, 6.5, -26.5, 0.3, 0.4, 0.12).box('hazard_stripes', rx, 6.5, -49.5, 0.3, 0.4, 0.12);
  }
  const gz = -41;
  for (const dz of [-0.5, 0.5]) {
    b.box('painted_yellow', 0, 7.0, gz + dz, 22.9, 0.62, 0.34);
    b.detail(() => { b.box('steel_raw', 0, 7.33, gz + dz, 22.6, 0.04, 0.06); for (let x = -10; x <= 10; x += 2.5) b.box('painted_yellow', x, 7.0, gz + dz + Math.sign(dz) * 0.18, 0.04, 0.6, 0.02); });
  }
  for (const s of [-1, 1]) {
    b.box('painted_yellow', s * 11.35, 6.86, gz, 0.4, 0.34, 1.9);
    b.detail(() => { for (const dz of [-0.75, 0.75]) b.cyl('steel_raw', s * 11.35, 6.72, gz + dz, 0.11, 0.08, 'x', 12); });
  }
  b.detail(() => {
    b.sign('할시온  20 t', 'stencil', -5.5, 7.0, gz + 0.672, 2.6, 0.36, '+z');
    b.sign('할시온  20 t', 'stencil', 5.5, 7.0, gz - 0.672, 2.6, 0.36, '-z');
    b.box('hazard_stripes', 0, 6.7, gz + 0.676, 22.9, 0.08, 0.004);
  });
  // trolley + hoist + hook block carrying a sealed fabricator head
  const tx = -7.4;
  b.box('painted_dark', tx, 7.42, gz, 1.3, 0.2, 1.5);
  b.cyl('steel_raw', tx, 7.62, gz, 0.22, 0.9, 'x', 14);
  b.box('painted_yellow', tx + 0.7, 7.62, gz, 0.4, 0.36, 0.5);
  b.detail(() => {
    for (const d of [-0.12, 0.12]) b.rod('steel_raw', tx + d, 7.45, gz, tx + d, 4.9, gz, 0.012, 5);
    b.box('painted_yellow', tx, 4.75, gz, 0.44, 0.34, 0.2);
    b.cyl('steel_raw', tx, 4.78, gz, 0.13, 0.22, 'z', 12);
    b.torus('steel_raw', tx, 4.45, gz, 0.11, 0.03, 'z', 12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod('steel_raw', tx, 4.4, gz, tx + sx * 0.6, 3.72, gz + sz * 0.45, 0.01, 4);
    cableBundle(b, [tx + 0.9, 7.5, gz], [8, 7.3, gz - 0.2], 3, 0.5, 0.02, 0.08, R);
  });
  b.at(tx, 2.5, gz, 0.12, () => crate(b, 1.4, 1.2, 1.1, 'wall_panel_dark', '팹 헤드 7', false));

  // ── catwalk along the west wall (y 3.7), decorative + bullet-solid ──
  const cy = 3.7;
  b.detail(() => { b.quad('floor_grate', -11.25, cy + 0.03, -38, 1.5, 21.6, '+y', 0, 'box'); });
  b.box('trim_steel', -10.52, cy - 0.07, -38, 0.06, 0.18, 21.6);
  b.box('trim_steel', -11.97, cy - 0.07, -38, 0.06, 0.18, 21.6);
  for (let z = -48; z <= -28; z += 2) {
    b.box('trim_steel', -11.25, cy - 0.04, z, 1.5, 0.1, 0.06);
    if (z % 4 === 0) b.rbox('trim_steel', -11.3, cy - 0.75, z, 0.07, 1.9, 0.07, 0, 0, -0.72);
  }
  handrail(b, 'painted_yellow', [[-10.52, cy + 0.03, -48.8], [-10.52, cy + 0.03, -30.2]], 1.05, 1.55);
  handrail(b, 'painted_yellow', [[-10.52, cy + 0.03, -48.8], [-11.9, cy + 0.03, -48.8]], 1.05, 1.4);
  handrail(b, 'painted_yellow', [[-10.52, cy + 0.03, -27.2], [-11.9, cy + 0.03, -27.2]], 1.05, 1.4);
  handrail(b, 'painted_yellow', [[-10.52, cy + 0.03, -27.2], [-10.52, cy + 0.03, -28.6]], 1.05, 1.4);
  b.collide(-12, cy - 0.1, -48.8, -10.5, cy + 0.03, -27.2, 'metal', false);
  // caged ladder up to the catwalk gap
  b.at(-10.42, 0, -29.4, PI / 2, () => {
    for (const s of [-1, 1]) b.box('painted_yellow', s * 0.24, 2.45, 0.03, 0.05, 4.9, 0.03);
    b.detail(() => {
      for (let y = 0.3; y < 4.8; y += 0.3) b.rod('steel_raw', -0.24, y, 0.03, 0.24, y, 0.03, 0.012, 5);
      for (let y = 2.2; y < 4.9; y += 0.65) { b.torus('painted_yellow', 0, y, 0.36, 0.36, 0.012, 'y', 14); }
      for (let i = 0; i < 5; i++) { const a = (i / 4) * PI; b.rod('painted_yellow', Math.cos(a) * 0.36, 2.2, 0.36 + Math.sin(a) * 0.36, Math.cos(a) * 0.36, 4.8, 0.36 + Math.sin(a) * 0.36, 0.008, 4); }
    });
  });
  b.collide(-10.5, 0, -29.7, -10.3, 4.8, -29.1);

  // ── the big status screen over the lobby door ──
  b.box('painted_dark', 0, 5.3, -49.62, 7.6, 3.5, 0.3);
  b.detail(() => {
    for (const s of [-1, 1]) { b.box('trim_steel', s * 3.74, 5.3, -49.45, 0.16, 3.56, 0.08); b.box('trim_steel', 0, 5.3 + s * 1.7, -49.45, 7.64, 0.16, 0.08); }
    for (const x of [-3, -1, 1, 3]) b.rbox('trim_steel', x, 7.3, -49.6, 0.08, 0.9, 0.08, 0.2, 0, 0);
    for (const x of [-3.4, 3.4]) cableBundle(b, [x, 3.55, -49.6], [x * 1.05, 3.3, -49.55], 3, 0.05, 0.02, 0.03, R);
    b.sign('라인 3 — 생산 현황', 'label', 0, 3.42, -49.76, 2.6, 0.14, '+z');
  });
  const screen = L.screen('fab_bigscreen', 'terminal_idle', 7.1, 3.1, 0, 5.3, -49.46, '+z');
  L.objects.set('fab_bigscreen', screen);
  L.point('fab_screen', 0, 5.0, -47.6, 0x58e0c8, 9, 11, { flicker: 'fluorescent' });

  // ── big services: round duct along the north wall with drops, risers on the east wall ──
  ductRound(b, 'steel_raw', 'x', 0.6, 6.9, -27.3, 21, 0.5, 2.1, 18);
  for (const x of [-7.5, 7.5]) {
    ductRound(b, 'steel_raw', 'y', x, 5.7, -27.3, 1.4, 0.32, 0.7, 14);
    b.detail(() => { b.cyl('painted_dark', x, 4.95, -27.3, 0.42, 0.1, 'y', 14, 0.34); });
  }
  ductRect(b, 'steel_raw', 'y', 11.35, 4.0, -30.5, 8, 0.7, 0.5, 2.0);
  ductRect(b, 'steel_raw', 'y', 11.35, 4.0, -46.5, 8, 0.7, 0.5, 2.0);
  b.collide(10.9, 0, -30.9, 11.8, 8, -30.1); b.collide(10.9, 0, -46.9, 11.8, 8, -46.1);
  // pipe rack along the east wall at 4.3 m
  for (const [y, r, m] of [[4.3, 0.09, 'steel_raw'], [4.55, 0.06, 'copper'], [4.75, 0.045, 'painted_orange']] as const) {
    pipe(b, m, [[11.45, y, -26.4], [11.45, y, -29.9], [10.7, y, -29.9], [10.7, y, -31.1], [11.45, y, -31.1], [11.45, y, -45.9], [10.7, y, -45.9], [10.7, y, -47.1], [11.45, y, -47.1], [11.45, y, -49.6]], r, { every: 2.4 });
  }
  b.detail(() => { valve(b, 11.45, 4.3, -35, 'z', 0.09, 'x', -1); valve(b, 11.45, 4.55, -42, 'z', 0.06, 'x', -1); });
  // west wall pipes under the catwalk
  pipe(b, 'copper', [[-11.75, 2.9, -49.6], [-11.75, 2.9, -26.4]], 0.07, { every: 2.4 });
  pipe(b, 'steel_raw', [[-11.75, 2.55, -49.6], [-11.75, 2.55, -40], [-11.75, 0.4, -40]], 0.05, { every: 2.0 });
  b.detail(() => valve(b, -11.75, 1.3, -40, 'y', 0.05, 'x', 1));

  // ── hanging cable bundles from the trusses ──
  b.detail(() => {
    cableBundle(b, [-6, 7.3, -32], [-6.4, 7.3, -36], 5, 1.3, 0.025, 0.12, R);
    cableBundle(b, [7.5, 7.3, -40], [8, 7.3, -44], 5, 1.6, 0.025, 0.12, R);
    cableBundle(b, [1.5, 7.3, -44], [-2.5, 7.3, -48], 4, 1.1, 0.025, 0.1, R);
    cableBundle(b, [9, 7.3, -28], [9.5, 7.3, -32], 4, 0.9, 0.02, 0.1, R);
    // one bundle torn loose, hanging to head height
    cable(b, 'rubber', [-8, 7.3, -44], [-8.3, 2.1, -46.6], 0.4, 0.03, 12, 6);
    cable(b, 'rubber', [-8.1, 7.3, -44], [-7.9, 2.6, -46.2], 0.3, 0.02, 12, 5);
    b.cyl('copper', -8.3, 2.07, -46.6, 0.02, 0.06, 'y', 5);
  });
  L.ctx.fx.emitter('sparks', L.vec(-8.3, 2.05, -46.6), L.vec(0, -1, 0), 0.5);

  // ── main lights (off until the breaker) + emergency beacons ──
  const mains: [number, number, boolean, boolean][] = [[-5.5, -30.5, false, true], [5.5, -30.5, false, false], [-5.5, -38, true, false], [5.5, -38, true, false], [-5.5, -45.5, false, false], [5.5, -45.5, false, true]];
  let gm: THREE.Material | undefined;
  for (const [x, z, cast, vol] of mains) gm = (highbay(b, L, { group: 'fab', x, y: 6.85, z, top: 7.25, intensity: 420, distance: 15, angle: 0.8, color: 0xd6ecff, cast, vol, enabled: false, priority: 2, glowMat: gm }) as any).glowMat;
  // Cold accents for the emergency state, so the hall is not a flat red monochrome and machines coming at
  // you read as silhouettes: one high-bay that keeps trying to strike, and the status screen washing the
  // south end. The level switches them itself: on while the beacons run and the mains are dead.
  const failing = L.spot('fab_accent', 5.5, 6.78, -38, 5.5, 0, -38, 0xd6ecff, 300, 15, 0.8,
    { cast: true, vol: true, flicker: 'broken', enabled: false, priority: 2, penumbra: 0.5 });
  b.detail(() => b.cyl(L.glow(failing, 'emissive_white'), 5.5, 6.82, -38, 0.2, 0.012, 'y', 12));
  L.spot('fab_accent', 0, 5.3, -49.0, 0, 0.5, -40.5, 0x8fe6ee, 110, 22, 1.0, { flicker: 'fluorescent', enabled: false, penumbra: 0.9 });
  let accentOn = false;
  L.updaters.push(() => {
    const mainLights = L.ctx.render.lights.group('fab'), emergencyLights = L.ctx.render.lights.group('fab_emergency');
    const want = emergencyLights.length > 0 && emergencyLights[0].enabled && mainLights.length > 0 && !mainLights[0].enabled;
    if (want !== accentOn) { accentOn = want; L.ctx.render.lights.setGroup('fab_accent', { enabled: want }); }
  });
  let bm: THREE.Material | undefined;
  for (const [x, z] of [[6.3, -33], [-6.3, -33], [6.3, -43], [-6.3, -43]]) bm = (beacon(b, L, 'fab_emergency', x, 4.3, z, 1, 0xff2a12, 95, 14, 'emissive_red', false, 'alarm', bm) as any).glowMat;
  b.at(0, 3.2, -49.8, 0, () => beacon(b, L, 'fab_emergency', 1.9, 0, 0.2, 1, 0xff2a12, 70, 12, 'emissive_red', false, 'alarm', bm));
  b.at(11.8, 2.9, -38, -PI / 2, () => beacon(b, L, 'fab_emergency', 0, 0, 0.2, 1, 0xff2a12, 70, 12, 'emissive_red', false, 'alarm', bm));

  // ── wall signage ──
  b.sign('제작 홀 3', 'stencil', 5.5, 5.2, -26.236, 5.2, 0.7, '-z');
  b.sign('할시온 다이내믹스', 'stencil', -11.964, 6.3, -38, 6.5, 0.8, '+x');
  b.sign('에리두', 'stencil', 11.764, 6.0, -42.5, 3.2, 0.9, '-x');
  b.sign('배전실 3 →', 'directional', 11.764, 2.2, -35.9, 1.4, 0.22, '-x', 0, true);
  b.sign('← 화물 로비', 'directional', 3.2, 2.2, -49.764, 1.3, 0.22, '+z', 0, true);
  b.sign('제작 출입 록 →', 'directional', -3.3, 2.2, -26.236, 1.3, 0.22, '-z', 0, true);
  b.sign('위험 — 자동화 셀 — 라인 가동 중 진입 금지', 'danger', -5.5, 3.0, -26.236, 2.4, 0.3, '-z', 0, true);
  b.sign('마지막 사고 이후 0일', 'warning', 6.6, 2.3, -49.764, 1.6, 0.2, '+z', 0, true);
}

// ───────────────────────────────────────────────────────────── assembly line, arms, conveyor

function jig(b: Builder, R: ReturnType<typeof rng>, stage: number) {
  // fixture pallet riding the rollers (origin: top of rollers)
  b.box('steel_raw', 0, 0.03, 0, 1.3, 0.06, 1.1);
  b.detail(() => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.inst('bolt', sx * 0.55, 0.06, sz * 0.45, -PI / 2, 0, 0, 2.2);
    b.box('hazard_stripes', 0, 0.062, 0.5, 1.3, 0.004, 0.08);
  });
  if (stage === 5) {
    // the line tried to finish someone
    b.at(0, 0.06, 0, PI / 2, () => drapedBody(b, 'fabric', 0.86));
    b.decal('blood_pool', 0, 0.2, 0.063, 0.1, 0.9, 0.8, '+y', 0.5);
    b.decal('blood_splat', 2, -0.4, 0.063, -0.3, 0.5, 0.5, '+y', 1.5);
    return;
  }
  // cradle: two posts with shoulder clamps
  for (const s of [-1, 1]) {
    b.box('painted_dark', s * 0.42, 0.42, -0.1, 0.07, 0.72, 0.07);
    b.detail(() => { b.box('robot_joint', s * 0.34, 0.74, -0.1, 0.14, 0.05, 0.1); b.rbox('painted_dark', s * 0.42, 0.25, -0.3, 0.05, 0.5, 0.05, 0.6, 0, 0); });
  }
  b.box('painted_dark', 0, 0.2, -0.1, 0.12, 0.3, 0.12);
  b.push(0, 0.36, -0.1, R.range(-0.1, 0.1));
  if (stage === 0) {
    b.sphere('robot_frame', 0, 0, 0, 0.15, 10, 0.6, 1, 0.7);
    for (let i = 0; i < 4; i++) b.cyl('robot_joint', 0, 0.09 + i * 0.065, -0.02, 0.045, 0.05, 'y', 8);
  } else androidTorso(b, stage >= 2, stage >= 4 ? 2 : stage === 3 ? 1 : 0, R);
  b.pop();
  if (stage >= 1) b.detail(() => {
    // loose parts on the pallet
    b.push(0.45, 0.1, 0.3, 0.5, 0, PI / 2); androidArm(b); b.pop();
    if (stage >= 3) { b.push(-0.5, 0.1, 0.32, -0.4, 0, -PI / 2); androidLeg(b); b.pop(); }
  });
}

function line(L: LevelBuild, R: ReturnType<typeof rng>): Conveyor {
  const b = L.namedBuilder('fab_shell'); // one zone for the whole hall: one draw per material
  const zN = -31.6, zS = -44.4, len = zN - zS, zc = (zN + zS) / 2;
  // side beams, legs, cross members, rollers
  for (const s of [-1, 1]) {
    channel(b, 'painted_yellow', 'z', s * 1.0, 0.86, zc, len, 0.1, 0.2, 0.014);
    b.box('trim_steel', s * 1.0, 0.975, zc, 0.14, 0.03, len);
    b.detail(() => b.box('hazard_stripes', s * 1.058, 0.86, zc, 0.004, 0.12, len));
    for (let z = zN - 0.2; z >= zS; z -= 1.6) {
      b.box('painted_dark', s * 0.96, 0.38, z, 0.1, 0.76, 0.1);
      b.box('painted_dark', s * 0.96, 0.02, z, 0.22, 0.04, 0.22);
    }
  }
  b.detail(() => {
    for (let z = zN - 0.2; z >= zS; z -= 1.6) b.box('painted_dark', 0, 0.68, z, 1.9, 0.08, 0.08);
    for (let z = zN - 0.12; z >= zS + 0.05; z -= 0.26) b.cyl('steel_raw', 0, 0.9, z, 0.045, 1.84, 'x', 8);
    // cable tray slung underneath + drive motors
    b.box('trim_steel', 0.3, 0.62, zc, 0.4, 0.02, len - 0.6);
    for (let i = 0; i < 4; i++) b.rod(i % 2 ? 'rubber' : 'plastic_dark', 0.16 + i * 0.09, 0.65, zN - 0.3, 0.16 + i * 0.09, 0.65, zS + 0.3, 0.022, 5);
    for (const z of [zN - 0.5, zc, zS + 0.5]) { b.box('painted_dark', -0.5, 0.66, z, 0.5, 0.3, 0.36); b.cyl('robot_joint', -0.5, 0.66, z + 0.28, 0.1, 0.2, 'z', 10); }
  });
  // end stops + control pedestals
  for (const [z, s] of [[zN + 0.08, 1], [zS - 0.08, -1]]) {
    b.box('painted_yellow', 0, 0.78, z, 2.2, 0.42, 0.14);
    for (const sx of [-1, 1]) b.box('painted_dark', sx * 0.96, 0.3, z, 0.12, 0.6, 0.12);
    b.detail(() => { b.box('hazard_stripes', 0, 0.78, z + s * 0.073, 2.2, 0.3, 0.004); });
  }
  b.at(1.5, 0, zN + 0.5, -0.5, () => {
    b.box('painted_dark', 0, 0.5, 0, 0.36, 1.0, 0.3);
    b.rbox('trim_steel', 0, 1.06, 0.02, 0.44, 0.04, 0.4, 0.4, 0, 0);
    b.detail(() => { b.cyl('emissive_red', -0.1, 1.1, 0.04, 0.04, 0.05, 'y', 10); b.inst('led_green', 0.05, 1.1, 0.0, -PI / 2).inst('led_amber', 0.11, 1.08, 0.05, -PI / 2); });
    b.collide(-0.2, 0, -0.2, 0.2, 1.1, 0.2);
  });
  b.collide(-1.08, 0.6, zS - 0.15, 1.08, 1.02, zN + 0.15, 'metal');
  
  // jigs with androids at increasing stages of assembly
  const stages = [0, 1, 2, 3, 5, 4];
  stages.forEach((st, i) => b.at(0, 0.945, zN - 1.2 - i * 2.1, 0, () => jig(b, R, st)));
  // blood runs off the pallet of stage "5" and down the side of the line
  const bz = zN - 1.2 - 4 * 2.1;
  b.decal('blood_smear', 0, 1.062, 0.6, bz, 0.5, 0.7, '+x');
  b.decal('blood_pool', 1, 1.6, 0.003, bz + 0.2, 1.1, 0.9, '+y', 0.3);

  // ── robot arms ──
  const specs: ArmSpec[] = [
    { x: 2.6, z: -34, ry: -PI / 2, tool: 'welder', seed: 1, color: 'painted_yellow' },
    { x: -2.6, z: -34, ry: PI / 2, tool: 'gripper', seed: 2, color: 'painted_yellow' },
    { x: 2.6, z: -38, ry: -PI / 2, tool: 'probe', seed: 3, color: 'painted_orange' },
    { x: -2.6, z: -38.4, ry: PI / 2, tool: 'saw', seed: 4, color: 'painted_yellow' },
    { x: 2.6, z: -42, ry: -PI / 2, tool: 'gripper', seed: 5, color: 'painted_yellow' },
    { x: -2.6, z: -42, ry: PI / 2, tool: 'welder', seed: 6, color: 'painted_orange' },
  ];
  const rig = new ArmRig(L);
  const arms = specs.map((s) => { armPedestal(b, s.x, s.z); return new RobotArm(L, s, rig); });
  rig.finish();
  for (const a of arms) a.pose();
  const armGroup = new THREE.Group();
  armGroup.name = 'fab_arms';
  L.objects.set('fab_arms', armGroup); L.root.add(armGroup);
  let armState: MachineState = 'off';
  L.machines.set('fab_arms', (s) => { armState = s; });
  const ctx = L.ctx;
  // fab_arms_watch (toggle): while powered down, the arms bring their tool heads round to follow the player
  let watching = false;
  let servo: { stop(f?: number): void; setVolume(v: number, f?: number): void } | null = null;
  const eyeT = new THREE.Vector3();
  L.vignette('fab_arms_watch', () => {
    watching = !watching;
    try {
      if (watching && !servo) servo = ctx.audio.loop('arm_servo_loop', { position: new THREE.Vector3(0, 2, -38), volume: 0.16, pitch: 0.7 });
      else if (!watching && servo) { servo.stop(2.5); servo = null; }
    } catch { /* no audio */ }
  }, true);
  L.updaters.push((dt, t) => {
    if (armState !== 'off') { for (let i = 0; i < arms.length; i++) arms[i].update(dt, t, armState, ctx); return; }
    if (!L.isVisible('fab')) return;
    const pl = ctx.player;
    const tgt = watching && pl ? eyeT.copy(pl.position).setY(pl.position.y + 1.6) : null;
    for (let i = 0; i < arms.length; i++) arms[i].rest(dt, tgt);
  });
  // power umbilicals from the trenches to the pedestals, safety markings
  for (const s of specs) {
    const sg = Math.sign(s.x);
    floorCable(b, [[s.x + sg * 0.5, s.z + 0.2], [s.x + sg * 0.75, s.z + 0.5], [sg * 3.6, s.z + 0.55]], 0.035);
  }
  for (const s of [-1, 1]) { hazardStrip(b, s * 4.35 - 0.06, -45.6, s * 4.35 + 0.06, -30.4); }
  hazardStrip(b, -4.41, -30.52, 4.41, -30.4); hazardStrip(b, -4.41, -45.6, 4.41, -45.48);
  b.sign('로봇 셀 — 출입 금지', 'stencil', 0, 0.004, -29.9, 3.2, 0.36, '+y');
  b.sign('로봇 셀 — 출입 금지', 'stencil', 0, 0.004, -46.1, 3.2, 0.36, '+y', PI);

  // ── overhead conveyor ──
  const path = new LoopPath(4.5, -33, -43);
  const railY = 5.55;
  const loads: HookLoad[] = ['husk', 'husk', 'husk', 'empty', 'torso', 'legs', 'empty', 'torso_arm', 'husk', 'arms', 'husk', 'torso_head', 'empty', 'legs', 'torso', 'empty'];
  const conv = new Conveyor(L, b, path, railY, loads, 1.2);
  // support columns with cantilever arms + ceiling hangers on the curves
  for (const sx of [-1, 1]) for (const z of [-33, -38, -43]) {
    const x = sx * 6.2;
    ibeam(b, 'trim_steel', 'y', x, 2.95, z, 5.9, 0.26, 0.26, 0.022, 0.016, true);
    b.box('floor_concrete', x, 0.15, z, 0.7, 0.3, 0.7);
    b.box('hazard_stripes', x, 0.75, z, 0.3, 0.9, 0.3);
    b.box('trim_steel', x - sx * 0.85, railY + 0.22, z, 1.9, 0.14, 0.14);
    b.rbox('trim_steel', x - sx * 0.6, railY - 0.3, z, 1.3, 0.07, 0.07, 0, 0, sx * 0.72);
    b.box('trim_steel', sx * 4.5, railY + 0.14, z, 0.2, 0.08, 0.2);
    b.collide(x - 0.33, 0, z - 0.33, x + 0.33, 5.9, z + 0.33);
  }
  const pp = { x: 0, z: 0, tx: 0, tz: 0 };
  for (const s of [10 + 2.4, 10 + 7.07, 10 + 11.7, 34.14 + 2.4, 34.14 + 7.07, 34.14 + 11.7]) {
    path.at(s, pp);
    b.detail(() => { b.rod('trim_steel', pp.x, railY + 0.1, pp.z, pp.x, 7.25, pp.z, 0.025, 6); b.box('trim_steel', pp.x, railY + 0.13, pp.z, 0.2, 0.06, 0.2); });
  }
  // drive unit on the north curve + idler on the south, big sprockets that turn
  for (const [z, name] of [[-28.5 + 4.5, 'drive'], [-47.5 - 4.5, 'idler']] as const) {
    const cz = name === 'drive' ? -33 : -43;
    b.box('painted_dark', 0, railY + 0.5, cz, 0.9, 0.5, 0.9);
    b.box('trim_steel', 0, railY + 0.22, cz, 9.2, 0.12, 0.16);
    b.detail(() => { b.rod('trim_steel', 0, railY + 0.75, cz, 0, 7.25, cz, 0.04, 6); b.box('painted_yellow', 0.7, railY + 0.5, cz, 0.5, 0.4, 0.5); });
    const sp = L.part('sprocket');
    sp.cyl('robot_joint', 0, 0, 0, 0.75, 0.06, 'y', 24);
    sp.cyl('robot_joint', 0, 0, 0, 0.16, 0.2, 'y', 10);
    for (let i = 0; i < 12; i++) { const a = (i * PI) / 6; sp.box('robot_joint', Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78, 0.09, 0.06, 0.09); }
    sp.cast = false;
    for (let i = 0; i < 5; i++) { const a = (i * 2 * PI) / 5; sp.cyl('painted_dark', Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 0.13, 0.08, 'y', 8); }
    const g = sp.build(false);
    g.position.set(0, railY + 0.14, cz);
    L.root.add(g);
    conv.addSprocket(g);
    void z;
  }
  const convObj = new THREE.Object3D();
  convObj.name = 'fab_conveyor'; convObj.position.set(0, railY, -38);
  L.root.add(convObj); L.objects.set('fab_conveyor', convObj);
  L.machines.set('fab_conveyor', (s) => { conv.state = s; });
  L.ambient('fab', (dt, t) => conv.update(dt, t));
  // fab_conveyor_step: the dead conveyor advances one notch by itself
  let stepBusy = false;
  L.vignette('fab_conveyor_step', () => {
    if (stepBusy) return;
    stepBusy = true;
    const fx = L.ctx.fx, p = new THREE.Vector3();
    // the drive takes up slack with a creak, a held breath, then the clunk and everything swings
    L.sfx('metal_groan', 0, railY + 0.4, -33, 0.5, 0.7);
    L.after(0.9, () => {
      L.sfx('conveyor_clunk', 0, railY + 0.3, -33, 1, 1);
      conv.notch();
      for (const s of [3, 9, 15, 21, 27, 33]) { path.at(s, pp); fx.smoke(p.set(pp.x, railY - 0.2, pp.z), { count: 3, size: 0.35, color: 0x8a867c, rise: -0.7, life: 2.4 }); }
    });
    L.after(1.25, () => conv.notch());
    L.after(6, () => { stepBusy = false; });
  }, true);

  // husks hang from five hooks: feet 3.2 m above the floor
  for (const h of conv.hookPositions) if (h.load === 'husk') L.enemy('g_fab_rack', 'husk', 'dormant', h.x, 3.2, h.z, h.yaw, 'rack', 'twitch');
  return conv;
}

// ───────────────────────────────────────────────────────────── props, cover, story, work lights

function puddle(L: LevelBuild, b: Builder, x: number, z: number, r: number, seed: number) {
  const R = rng(seed);
  const g = new THREE.CircleGeometry(1, 18);
  const p = g.getAttribute('position');
  for (let i = 1; i < p.count; i++) { const k = 0.7 + 0.5 * R(); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  p.setXYZ(p.count - 1, p.getX(1), p.getY(1), 0);
  g.rotateX(-PI / 2);
  b.detail(() => b.geo(L.puddleMat(), g, 'box', new THREE.Matrix4().makeScale(r, 1, r * R.range(0.6, 1)).setPosition(x, 0.004, z)));
}

function dressing(L: LevelBuild, R: ReturnType<typeof rng>, conv: Conveyor) {
  const n = L.namedBuilder('fab_shell'), s = n;

  // ── workbench where the standing husk "works" (west of the line, centre) ──
  s.at(-5.0, 0, -37.2, PI / 2, () => {
    workTable(s, 2.0, 0.8, 0.92);
    s.at(-0.7, 0.92, -0.15, 0.2, () => vise(s));
    s.detail(() => {
      s.box('painted_dark', 0, 1.5, -0.38, 2.0, 1.1, 0.03);
      for (let i = 0; i < 7; i++) s.box('steel_raw', -0.8 + i * 0.26, 1.5 + (i % 3) * 0.12, -0.355, 0.04, 0.3, 0.02);
      s.push(0.3, 0.92, 0.05, 0.4, 0, PI / 2); androidArm(s); s.pop();
      s.box('robot_shell', -0.2, 0.99, 0.1, 0.22, 0.14, 0.2);
      s.sphere('robot_shell', 0.75, 1.03, -0.1, 0.1, 10, 1.2, 1, 1.1);
      s.sphere('painted_dark', 0.75, 1.02, -0.05, 0.075, 8, 1.15, 1.05, 0.9);
    });
  });
  L.pickup('p_fab_med', 'medkit', -5.05, 0.92, -36.55, 35, 0.3);
  L.enemy('g_fab_first', 'husk', 'dormant', -4.1, 0, -37.2, PI / 2, 'standing', 'work');
  // g_fab_return: an android slumped against the LOT 3-118 stack (seen, inert, on the way to the pump room) and
  // a skitter clinging to the west wall above the catwalk
  L.enemy('g_fab_return', 'husk', 'dormant', -8.2, 0, -34.78, PI, 'slumped', 'twitch');
  L.enemy('g_fab_return', 'skitter', 'spawn', -11.72, 5.0, -41.0, -PI / 2);
  s.decal('oil_stain', 3, -8.2, 0.003, -35.1, 1.3, 1.3, '+y', 1.4);
  s.decal('oil_drip', 1, -8.2, 0.5, -34.243, 0.4, 0.7, '+z');

  // ── the pump room door in the west wall: signposted, with its own small lamp ──
  n.sign('냉각수 펌프실 3', 'stencil', -11.964, 3.12, -38, 2.3, 0.26, '+x');
  n.sign('← 냉각수 펌프', 'directional', -11.964, 2.2, -40.0, 1.0, 0.2, '+x', 0, true);
  n.sign('냉각수 ←', 'stencil', -9.6, 0.004, -38.0, 1.9, 0.4, '+y', -PI / 2);
  n.sign('잠금 지점 — 기관장에게 문의', 'warning', -11.964, 1.75, -36.2, 0.8, 0.14, '+x', 0, true);
  hazardStrip(n, -11.2, -39.0, -11.05, -37.0);
  n.at(-12, 0, -36.55, PI / 2, () => bulkhead(n, L, 'fab', 0, 2.5, 0.04, 0x9fd8ff, 5, 4.5, 'emissive_cyan', { flicker: 'fluorescent' }));
  // "31": painted on the wall north of that door, over a field of tally marks
  n.quad(tallyMaterial(1.55), -11.962, 1.98, -34.75, 2.1, 1.35, '+x', -0.02, 'unit', 0.004);
  s.decal('oil_stain', 1, -4.2, 0.003, -37.3, 1.3, 1.3, '+y', 0.2);

  // ── the body at the line + PDA ──
  s.at(1.75, 0, -41.3, 0.25, () => { drapedBody(s, 'fabric', 0.95); s.at(0.02, 0, 1.0, 0, () => boots(s)); });
  s.decal('blood_pool', 0, 1.9, 0.003, -41.5, 1.5, 1.2, '+y', 1.2);
  s.decal('blood_smear', 1, 2.6, 0.003, -40.3, 0.7, 1.8, '+y', 0.7);
  s.at(2.45, 0, -41.0, 0.8, () => tablet(s, 'emissive_cyan'));
  L.interact('log_fab', 'log', 'PDA 읽기', 2.45, 0.1, -41.0, true, 2.4);
  L.point('fab_screen', 2.45, 0.25, -41.0, 0x40d8ff, 0.8, 1.6);
  L.pickup('p_fab_shells', 'ammo_shotgun', 1.5, 0, -43.9, 6, 0.6);

  // ── cover: crates, pallets, drums ──
  const stack = (b: Builder, x: number, z: number, ry: number, label?: string) => {
    b.at(x, 0, z, ry, () => { pallet(b, 1.3, 1.1); b.at(0, 0.145, 0, 0, () => crate(b, 1.2, 0.8, 1.0, R.pick(['painted_dark', 'wall_panel', 'wall_panel_dark'] as const), label, false)); b.collide(-0.65, 0, -0.55, 0.65, 0.95, 0.55); });
  };
  stack(n, 7.6, -29.4, 0.1, '할시온');
  n.at(7.5, 0.945, -29.4, 0.5, () => crate(n, 0.7, 0.5, 0.6, 'painted_yellow', undefined, false));
  L.pickup('p_fab_ammo', 'ammo_pistol', 8.05, 0.945, -29.2, 12, 0.2);
  stack(n, 9.2, -29.8, -0.2, '셸 4-B');
  n.at(9.6, 0, -31.6, 0, () => drum(n)); n.at(9.0, 0, -31.9, 0, () => drum(n, 'painted_yellow')); n.at(9.7, 0, -32.3, 0, () => drum(n));
  n.at(-7.4, 0, -30.2, 0.2, () => crate(n, 1.8, 1.4, 1.3, 'wall_panel_dark', '액추에이터 세트'));
  n.at(-8.9, 0, -29.4, -0.3, () => crate(n, 0.9, 0.7, 0.8, 'painted_dark', '에리두'));
  stack(n, -8.2, -33.6, 1.5, 'LOT 3-118');
  n.at(-9.6, 0, -35.4, 0.4, () => toolCart(n, R));
  n.at(-9.2, 0, -36.2, 0, () => tools(n, 5, 0.6, R));
  stack(s, 9.3, -41.6, 0.05, '조인트 R2');
  s.at(9.3, 0.945, -41.6, -0.3, () => crate(s, 0.8, 0.6, 0.7, 'painted_dark', undefined, false));
  stack(s, 8.0, -45.2, 1.4, '할시온');
  s.at(-7.2, 0, -45.6, -0.15, () => crate(s, 1.6, 1.2, 1.2, 'wall_panel', '냉각수'));
  s.at(-8.8, 0, -44.2, 0, () => drum(s)); s.at(-9.4, 0, -44.7, 0, () => drum(s, 'painted_yellow'));
  s.at(5.6, 0, -47.6, 0.3, () => crate(s, 1.0, 0.9, 0.9, 'painted_dark', '파손 주의'));
  s.at(-4.6, 0, -47.9, -0.4, () => { cableCoil(s, 0.4, 5); });
  // lockers + gas bottles under the catwalk
  n.at(-11.7, 0, -31, PI / 2, () => lockerRow(n, 4, R, 'wall_panel_dark'));
  for (let i = 0; i < 4; i++) s.at(-11.55, 0, -42.4 - i * 0.3, i, () => gasBottle(s, i % 2 ? 'painted_orange' : 'painted_white'));
  s.collide(-11.75, 0, -43.5, -11.35, 1.4, -42.2);
  // parts bins with unfinished shells near the line start
  n.at(4.9, 0, -30.9, 0.1, () => {
    crate(n, 1.4, 0.7, 1.0, 'painted_yellow', '셸');
    n.detail(() => { for (let i = 0; i < 5; i++) { n.push(R.range(-0.4, 0.4), 0.72, R.range(-0.25, 0.25), R.range(0, 6), R.range(-0.4, 0.4), 0); n.sphere('robot_shell', 0, 0, 0, 0.12, 8, 1.2, 1, 1.1); n.pop(); } });
  });
  n.at(-5.0, 0, -31.2, -0.1, () => {
    crate(n, 1.4, 0.7, 1.0, 'painted_yellow', 'LIMBS');
    n.detail(() => { for (let i = 0; i < 4; i++) { n.push(R.range(-0.4, 0.4), 0.8, R.range(-0.2, 0.2), R.range(0, 6), 0, PI / 2); androidLeg(n); n.pop(); } });
  });

  // ── floor: cables, oil, puddles, stains, walkway arrows ──
  floorCable(n, [[3.8, -28.4], [5.5, -28.9], [8, -28.2], [10.5, -28.6], [11.3, -30]], 0.03);
  floorCable(s, [[-7.9, -39.9], [-9.5, -40.4], [-11.2, -40.2]], 0.03);
  floorCable(s, [[8.7, -33.9], [10, -34.6], [11.2, -34.4], [11.4, -36.4]], 0.03);
  for (const [b, x, z, r, sd] of [[n, 2.2, -28.2, 0.9, 1], [n, -6.2, -34.6, 1.2, 2], [s, 7.4, -38.6, 1.3, 3], [s, -9.6, -46.8, 1.1, 4], [s, 3.2, -47.4, 0.8, 5], [n, 10.1, -33.5, 0.7, 6], [s, -2.2, -46.6, 0.7, 7]] as const) puddle(L, b, x, z, r, sd);
  for (let i = 0; i < 16; i++) {
    const x = R.range(-10.5, 10.5), z = R.range(-49, -27);
    (z > -38 ? n : s).decal(R.chance(0.6) ? 'oil_stain' : 'grime', R.int(0, 3), x, 0.003, z, R.range(1.2, 2.6), R.range(1.2, 2.6), '+y', R.range(0, 6));
  }
  n.decal('scorch', 0, 2.5, 0.003, -33.2, 1.2, 1.2, '+y', 0.3);
  s.decal('scorch', 1, -2.6, 0.003, -43.2, 1.4, 1.4, '+y', 1.3);
  n.sign('3', 'stencil', -8.5, 0.004, -27.8, 1.2, 1.6, '+y');
  s.sign('전력 →', 'stencil', 8.2, 0.004, -38.0, 2.2, 0.4, '+y');
  s.sign('로비 ^', 'stencil', 0, 0.004, -47.8, 1.8, 0.4, '+y');
  // drag marks: from the line to the lobby door
  s.decal('blood_smear', 2, 1.5, 0.003, -45.6, 0.7, 1.8, '+y', 0.3);
  s.decal('blood_smear', 0, 0.8, 0.003, -47.4, 0.7, 1.8, '+y', 0.2);
  s.decal('blood_smear', 1, 0.3, 0.003, -49.0, 0.7, 1.6, '+y', 0.1);
  s.decal('handprint', 0, 1.3, 1.2, -49.764, 0.24, 0.24, '+z', 0.5);

  // ── amber work lights (the only light before the breaker) ──
  const aim = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));
  workLight(n, L, 'fab', 3.7, -28.3, aim(3.7, -28.3, 0.5, -34), { intensity: 230, distance: 14, angle: 0.75, cast: true, vol: true, pitch: 0.2 });
  workLight(s, L, 'fab', -7.6, -39.8, aim(-7.6, -39.8, -4.2, -37.0), { intensity: 150, distance: 10, angle: 0.7, cast: true, pitch: 0.12 });
  workLight(s, L, 'fab', 8.6, -33.4, aim(8.6, -33.4, 4.5, -37.5), { intensity: 200, distance: 13, angle: 0.72, vol: true, pitch: -0.5 });
  workLight(s, L, 'fab', -3.6, -46.6, aim(-3.6, -46.6, 0, -50), { intensity: 110, distance: 9, angle: 0.8, pitch: 0.25 });
  // a hand lamp left on the line under the tarp-covered pallet
  L.point('fab', 1.3, 1.25, -40.2, 0xffb060, 3, 3.5, { flicker: 'fluorescent' });

  // ── fx ──
  L.ctx.fx.emitter('dust', L.vec(1.5, 2.2, -31.5), L.vec(0, -1, 0), 8);
  L.ctx.fx.emitter('dust', L.vec(6.5, 3.5, -35.5), L.vec(0, 1, 0), 8);
  L.ctx.fx.emitter('steam', L.vec(-11.7, 0.6, -40.1), L.vec(1, 0.7, -0.5), 40);
  L.ctx.fx.emitter('drip', L.vec(-6.2, 7.2, -34.6), L.vec(0, -1, 0), 1.5);
  L.ctx.fx.emitter('drip', L.vec(7.4, 7.2, -38.6), L.vec(0, -1, 0), 1.0);

  L.enemy('g_fab_sentry', 'sentry', 'spawn', 5.5, 5.9, -45.0, 0);
  // story marker: a figure standing in the beam of the far work light, facing back up the hall
  L.marker('fab_figure', -1.55, 0, -47.6, PI);
  void conv;
}
