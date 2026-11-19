/**
 * FITTING BAYS — x 10…20, z -40…-28, h 4. Four treadmill rigs where units walk human gaits under
 * motion-capture rings (cold blue-white), one empty calibration rig with a brass tag, the supervisor's
 * desk with the section pass, two charging alcoves.
 */
import * as THREE from 'three';
import { rng, type Builder } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { cable, floorSlab, hazardStrip, panelOn, pipe } from '../kit';
import { chair, clipboard, desk, monitorBezel, mug, papers, tablet } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';
import { engravedMat, scrollMat } from './kit2';
import { easeInOut } from '../ambient';

const PI = Math.PI;
const H = 4;
const RIG_X = 17.2;
const TREAD_Z = [-29.9, -32.5, -35.1, -37.7];
const REF = { x: 13.5, z: -37.5 };

export function buildFitting(L: LevelBuild) {
  const b = L.builder('fitting');
  const R = rng(2601);
  L.room('fitting', '장착 베이', 10, 20, -40, -28, H);
  floorSlab(b, 'floor_rubber', 10, -40, 20, -28, [], 'rubber');
  ceilingSlab(b, 10.0, -40.4, 20.4, -27.6, H); // starts behind the hall's wall face (x 9.8): no coplanar end face
  wallFace(b, { n: '+x', plane: 10.2, from: -39.8, to: -28.2, h: H, t: 0.2, seed: 261, openings: [{ c: -34, w: 1.6, h: 2.4 }], features: 0.2, trayY: H - 0.45 });
  wallFace(b, { n: '-x', plane: 20, from: -39.8, to: -28.2, h: H, seed: 262, features: 0.15, trayY: H - 0.45 });
  wallFace(b, { n: '-z', plane: -28.2, from: 10.2, to: 20, h: H, seed: 263, features: 0, trayY: H - 0.45, clear: [[13, 16.5]] });
  wallFace(b, { n: '+z', plane: -39.8, from: 10.2, to: 20, h: H, seed: 264, features: 0.3, trayY: H - 0.45 });
  // floor: rig zones, walking lanes
  b.detail(() => {
    for (const z of TREAD_Z) hazardStrip(b, RIG_X - 1.6, z - 1.1, RIG_X + 1.6, z - 1.02);
    hazardStrip(b, REF.x - 1.4, REF.z - 1.1, REF.x + 1.4, REF.z - 1.02);
    b.box(L.overlay('painted_white'), 15.0, 0.002, -34, 0.08, 0.004, 11.4);
  });
  b.sign('걸음걸이 캡처', 'stencil', 15.6, 0.004, -28.9, 2.0, 0.36, '+y', PI);

  // ── treadmills ──
  const belt = scrollMat(L, 'conveyor_belt', 'u');
  const beltB = L.part('fitting:belts');
  for (const z of TREAD_Z) treadmill(L, b, beltB, belt.mat, RIG_X, z, R, false);
  treadmill(L, b, beltB, belt.mat, REF.x, REF.z, R, true);
  const bg = beltB.build(false);
  for (const m of bg.children) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; }
  L.root.add(bg);
  // units walking three of them; the fourth is free (Unit 14 is placed there by the story)
  for (let i = 0; i < 3; i++) L.enemy('g2_fit_tread', 'husk', 'dormant', RIG_X, 0.21, TREAD_Z[i], PI / 2, 'treadmill', 'worker');
  L.marker('rig_unit14', RIG_X, 0.22, TREAD_Z[3], PI / 2);
  // rings
  const rings: { g: THREE.Group; mat: THREE.MeshStandardMaterial; base: number; light: ReturnType<LevelBuild['spot']> }[] = [];
  const ringMat = L.ctx.materials.clone('emissive_white');
  ringMat.emissive.set(0xcfe8ff);
  const ringBase = ringMat.emissiveIntensity;
  for (const [i, [x, z]] of [...TREAD_Z.map((z) => [RIG_X, z]), [REF.x, REF.z]].entries()) {
    const ref = i === 4;
    const light = L.spot('fitting', x, 3.3, z, x, 0, z, 0xd8ecff, ref ? 50 : 70, 5.5, 0.85, { cast: i === 1 || i === 4, priority: 2, penumbra: 0.5 });
    const m = ref ? L.ctx.materials.clone('emissive_white') : ringMat;
    if (ref) { m.emissive.set(0xcfe8ff); m.emissiveIntensity = ringBase * 0.25; }
    const rb = L.part('fitting:ring');
    rb.torus(m, 0, 0, 0, 1.15, 0.02, 'y', 40);
    rb.torus('painted_dark', 0, 0.035, 0, 1.15, 0.035, 'y', 40);
    for (let k = 0; k < 8; k++) {
      const a = (k * PI) / 4;
      rb.push(Math.cos(a) * 1.15, -0.04, Math.sin(a) * 1.15, -a + PI / 2);
      rb.box('painted_dark', 0, 0, 0, 0.1, 0.08, 0.12);
      rb.cyl('screen_off', 0, -0.02, -0.065, 0.025, 0.02, 'z', 8);
      rb.box('emissive_red', 0.035, 0.025, -0.062, 0.012, 0.012, 0.004);
      rb.pop();
    }
    const g = rb.build(false);
    g.position.set(x, 3.25, z);
    g.userData.rooms = ['fitting'];
    for (const mm of g.children) mm.castShadow = false;
    L.root.add(g);
    rings.push({ g, mat: m, base: m.emissiveIntensity, light });
    // hangers to the ceiling
    b.detail(() => { for (let k = 0; k < 4; k++) { const a = (k * PI) / 2 + PI / 4; b.rod('trim_steel', x + Math.cos(a) * 1.15, 3.3, z + Math.sin(a) * 1.15, x + Math.cos(a) * 0.9, H, z + Math.sin(a) * 0.9, 0.012, 4); } });
  }
  // ── the calibration rig: brass tag, its screen ──
  b.at(REF.x - 0.15, 0, REF.z + 0.85, 0, () => {
    b.box('brass', 0, 1.18, 0.016, 0.34, 0.12, 0.012);
    b.detail(() => { for (const s of [-1, 1]) b.cyl('steel_raw', s * 0.15, 1.18, 0.024, 0.007, 0.006, 'z', 6); });
  });
  b.detail(() => b.quad(engravedMat(['기준 패턴 00', '레예스, S.'], 0.34 / 0.12, { px: 512 }), REF.x - 0.15, 1.18, REF.z + 0.85 + 0.0225, 0.32, 0.11, '+z'));
  L.interact('tag2_rig', 'log', '태그 읽기', REF.x - 0.15, 1.18, REF.z + 0.9, true, 1.9);
  const ro = new THREE.Object3D(); ro.name = 'rig_ref'; ro.position.set(REF.x, 0, REF.z); L.root.add(ro); L.objects.set('rig_ref', ro);
  L.screen('fitting_rig_screen', 'terminal_idle', 0.42, 0.28, REF.x - 1.06, 1.37, REF.z, '+x', { tilt: 0, text: '기준 00 — 마스터\n잠김 · 덮어쓰기 금지' });
  // the ring's projection of a walking outline (fitting_rig_wake)
  void walkingOutline; // retired, see fitting_rig_wake

  // ── supervisor's desk (north-west), the pass, the note ──
  b.at(12.0, 0, -29.4, PI, () => desk(b, 1.6, 0.8, 0.76));
  b.at(12.0, 0, -30.3, PI + 0.2, () => chair(b, 'fabric'));
  b.at(11.6, 0.76, -29.25, 0.1, () => papers(b, 5, 0.18, R));
  b.at(12.55, 0.76, -29.3, 0.4, () => mug(b));
  b.at(11.4, 0.76, -29.4, -0.3, () => clipboard(b));
  b.at(12.3, 0.76, -29.55, 0.2, () => tablet(b, 'emissive_cyan'));
  L.interact('note2_fitting', 'log', '쪽지 읽기', 11.4, 0.85, -29.4, true, 2.0);
  L.pickup('p2_section_pass', 'keycard', 12.15, 0.78, -29.15, 1, 0.3);
  b.at(0, 0, -28.2, PI, () => monitorBezel(b, -12.0, 1.55, 0.7, 0.42, 0.1));
  L.screen(null, 'terminal_idle', 0.7, 0.42, 12.0, 1.55, -28.2 - 0.101, '-z', { text: '걸음걸이 라이브러리\n패턴 31개 + 기준 00' });
  // charging alcoves (g2_fit_wake: two units standing in them, eyes dark)
  for (const x of [13.9, 15.5]) {
    b.at(x, 0, -28.2, PI, () => {
      b.box('painted_dark', 0, 1.2, 0.05, 1.0, 2.4, 0.1);
      for (const s of [-1, 1]) b.box('trim_steel', s * 0.5, 1.25, 0.25, 0.08, 2.5, 0.5);
      b.box('trim_steel', 0, 2.48, 0.25, 1.08, 0.08, 0.5);
      b.detail(() => {
        b.box('robot_frame', 0, 1.5, 0.12, 0.3, 0.4, 0.06);
        b.inst('led_green', 0.08, 1.75, 0.155); b.inst('led_amber', -0.08, 1.75, 0.155);
        cable(b, 'rubber', [0, 1.35, 0.14], [0.05, 1.0, 0.3], 0.1, 0.02, 8, 5);
        b.sign('충전', 'label', 0, 2.25, 0.105, 0.3, 0.07, '+z');
        hazardStrip(b, -0.45, 0.05, 0.45, 0.5);
      });
      b.collide(-0.55, 0, 0, 0.55, 2.5, 0.5);
    });
    L.enemy('g2_fit_wake', 'husk', 'dormant', x, 0, -28.95, 0, 'standing', 'twitch');
  }
  // ── wall stuff: a whiteboard of gait plots, cable drops, cabinets ──
  b.at(20, 0, -34, -PI / 2, () => {
    b.box('painted_white', 0, 1.63, 0.035, 2.4, 1.1, 0.05);
    b.detail(() => {
      for (let k = 0; k < 4; k++) for (let i = 0; i < 12; i++) b.rbox('painted_dark', -1.05 + i * 0.18, 1.95 - k * 0.24 + Math.sin(i * 1.3 + k) * 0.04, 0.062, 0.17, 0.008, 0.002, 0, 0, Math.cos(i * 1.3 + k) * 0.4);
      b.box('trim_steel', 0, 1.03, 0.075, 2.4, 0.03, 0.08);
    });
  });
  b.sign('걸음걸이 라이브러리 — 패턴 01–31(직원), 00(기준)', 'label', 19.97, 2.3, -34, 2.2, 0.12, '-x');
  b.detail(() => {
    pipe(b, 'steel_raw', [[10.4, H - 0.3, -39.6], [19.8, H - 0.3, -39.6]], 0.04, { every: 2 });
    for (const z of TREAD_Z) cable(b, 'rubber', [RIG_X + 0.9, H, z + 0.3], [RIG_X + 1.2, 0.9, z + 0.6], 0.3, 0.022, 10, 5);
  });
  b.sign('장착 베이', 'stencil', 15.1, 3.1, -39.795, 2.4, 0.4, '+z');
  b.sign('유닛 교정 중 — 건드리지 마세요', 'warning', 10.22, 2.3, -31.0, 1.5, 0.2, '+x', 0, true);
  // pickups
  L.pickup('p2_fitting_ammo', 'ammo_pistol', 19.4, 0, -39.3, 12, 0.4);
  L.pickup('p2_fitting_shells', 'ammo_shotgun', 10.8, 0, -39.3, 6, 0.2);
  L.pickup('p2_fitting_med', 'medkit', 19.4, 0, -28.8, 35, 1.2);
  // room fill (very little: the rings are the light), a cold wash on the walls
  troffer(b, L, { group: 'fitting', x: 11.6, y: H, z: -34, axis: 'z', len: 1.2, intensity: 20, distance: 6.5, angle: 1.25, color: 0xd8e8ff });
  L.point('fitting', 15, 2.6, -34, 0x9fc4ff, 6, 9, { priority: 1 });
  // ── motion-capture camera tripods around the rigs, calibration boards, overhead trays ──
  const tripod = (x: number, z: number, ry: number, h: number) => b.at(x, 0, z, ry, () => {
    for (let i = 0; i < 3; i++) { const a = (i * 2 * PI) / 3; b.rod('painted_dark', 0, h * 0.55, 0, Math.cos(a) * 0.35, 0.01, Math.sin(a) * 0.35, 0.012, 5); }
    b.rod('trim_steel', 0, h * 0.5, 0, 0, h, 0, 0.015, 6);
    b.push(0, h + 0.06, 0, 0, 0.35);
    b.box('painted_dark', 0, 0, 0, 0.14, 0.1, 0.18);
    b.cyl('screen_off', 0, 0, -0.1, 0.04, 0.03, 'z', 10);
    b.detail(() => { for (let k = 0; k < 6; k++) { const a = (k * PI) / 3; b.inst('led_red', Math.cos(a) * 0.055, Math.sin(a) * 0.055, -0.116); } });
    b.pop();
  });
  for (const [x, z, ry] of [[15.2, -29.0, PI * 0.75], [15.2, -31.2, PI * 0.6], [15.2, -36.4, PI * 0.4], [19.5, -33.8, -PI / 2], [11.6, -36.0, -PI * 0.7], [15.4, -39.4, PI * 0.15], [11.6, -39.3, -PI * 0.25]] as const) tripod(x, z, ry, 1.9);
  // the calibration boards on the south wall behind the reference rig: checkerboards and a scale
  const chk = L.ctx.materials.clone('painted_white');
  b.at(REF.x, 0, -39.8, 0, () => {
    // (the board stands 2.5 cm proud of the wall's raised panels, 3.5 cm deep)
    b.box('painted_dark', 0, 1.5, 0.035, 2.6, 2.2, 0.05);
    b.detail(() => {
      for (let i = 0; i < 10; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) b.box(chk, -1.17 + i * 0.26, 0.56 + j * 0.26, 0.063, 0.25, 0.25, 0.006);
      for (let cm = 0; cm <= 200; cm += 10) b.box('painted_yellow', 1.36, 0.4 + cm / 100, 0.063, cm % 50 === 0 ? 0.14 : 0.07, 0.008, 0.006);
      b.sign('REF 00 · 교정', 'label', 0, 2.75, 0.062, 1.4, 0.16, '+z');
    });
  });
  b.detail(() => {
    for (const z of [-30.5, -35.6]) { b.box('trim_steel', 15, H - 0.25, z, 9.4, 0.02, 0.4); for (let i = 0; i < 3; i++) b.rod(i % 2 ? 'rubber' : 'plastic_dark', 10.4, H - 0.22, z - 0.1 + i * 0.1, 19.8, H - 0.22, z - 0.1 + i * 0.1, 0.02, 5); }
    // painted footprints on the reference deck: where the subject stood
    for (const s of [-1, 1]) b.rbox('brass', REF.x + 0.05, 0.215, REF.z + s * 0.12, 0.27, 0.004, 0.1, 0, 0, 0);
  });

  // ── machine: l2_treadmills ──
  let state: MachineState = 'off', speed = 0, sync = 0;
  L.machines.set('l2_treadmills', (s) => { state = s; });
  L.updaters.push((dt, t) => {
    const target = state === 'active' ? 1.15 : state === 'frenzy' ? 2.4 : state === 'idle' ? 0.4 : 0;
    speed += (target - speed) * Math.min(1, dt * 1.5);
    belt.offset.value -= speed * dt;
    if (!L.isVisible('fitting')) return;
    // rings breathe; during fitting_sync they pulse together on every step
    for (let i = 0; i < 4; i++) {
      const r = rings[i];
      const k = sync > 0 ? 0.5 + 0.5 * Math.max(0, Math.cos(sync * PI * 2 * 1.8)) : 0.85 + 0.15 * Math.sin(t * 1.7 + i * 2.1);
      r.mat.emissiveIntensity = r.base * k;
      r.g.rotation.y += dt * 0.05 * (i % 2 ? 1 : -1);
    }
    if (sync > 0) { sync -= dt; if (sync <= 0) sync = 0; }
  });
  L.vignette('fitting_sync', () => {
    sync = 4 / 1.8;
    for (let i = 0; i < 4; i++) L.after(i / 1.8, () => { for (const z of TREAD_Z) L.sfx('metal_clang', RIG_X, 0.2, z, 0.18, 1.7); });
  });
  // fitting_rig_wake: the empty rig's ring spins up and projects a walking outline
  const refRing = rings[4];
  L.vignette('fitting_rig_wake', () => {
    L.sfx('power_up', REF.x, 3.2, REF.z, 0.5, 1.4);
    let spin = 0, t = 0;
    // The level's own stick-figure outline is retired (REVISION 5: the pattern is the `holo_tech` actor the story
    // puts on this rig). Showing both drew a second, mismatched figure through the hologram.
    L.sim((dt) => {
      t += dt;
      spin = Math.min(6, spin + dt * 3);
      refRing.g.rotation.y += spin * dt;
      refRing.mat.emissiveIntensity = refRing.base * Math.min(4, 1 + t * 2) * (0.85 + 0.15 * Math.sin(t * 25));
      return true;
    });
  });
}

function treadmill(L: LevelBuild, b: Builder, beltB: Builder, beltMat: THREE.Material, x: number, z: number, R: ReturnType<typeof rng>, ref: boolean) {
  b.at(x, 0, z, 0, () => {
    const len = 2.2, w = 0.95, top = 0.2;
    b.box('painted_dark', 0, top / 2 - 0.02, 0, len + 0.1, top - 0.04, w + 0.2);
    for (const s of [-1, 1]) b.box(ref ? 'brass' : 'trim_steel', 0, top, s * (w / 2 + 0.06), len + 0.1, 0.03, 0.14); // side rails 9 mm above the belt
    b.cyl('steel_raw', -len / 2, top - 0.06, 0, 0.06, w, 'z', 12).cyl('steel_raw', len / 2, top - 0.06, 0, 0.06, w, 'z', 12);
    // front console (the walker faces -x) with handrails
    b.push(-len / 2 - 0.05, 0, 0);
    for (const s of [-1, 1]) b.rod('trim_steel', 0, top, s * 0.4, 0, 1.25, s * 0.4, 0.03, 8);
    b.box('painted_dark', -0.02, 1.3, 0, 0.12, 0.3, 0.8);
    b.detail(() => {
      for (const s of [-1, 1]) b.rod('chrome', 0, 1.0, s * 0.42, 0.85, 1.0, s * 0.48, 0.018, 6);
      b.inst('led_green', 0.045, 1.38, -0.25, 0, PI / 2); b.inst('led_amber', 0.045, 1.38, -0.2, 0, PI / 2);
      b.sign(ref ? 'REF 00' : '리그 0' + (TREAD_Z.indexOf(z) + 1), 'label', 0.045, 1.22, 0.15, 0.24, 0.07, '+x');
    });
    b.pop();
    if (!ref) L.screen(null, 'terminal_idle', 0.36, 0.22, x - len / 2 - 0.005, 1.33, z + 0.12, '+x', { text: '걸음 ' + String(Math.round(R.range(1, 31))).padStart(2, '0') });
    // safety tether rail + harness hanging over the belt (the empty rig's harness dangles)
    b.detail(() => {
      b.rod('trim_steel', -len / 2, 2.6, 0, len / 2, 2.6, 0, 0.02, 6);
      for (const s of [-1, 1]) b.rod('trim_steel', s * len / 2, 2.6, 0, s * len / 2, 4, 0, 0.02, 6);
      if (ref) { cable(b, 'painted_yellow', [0.1, 2.6, 0], [0.15, 1.35, 0.05], 0.05, 0.012, 8, 4); b.box('painted_yellow', 0.15, 1.3, 0.05, 0.22, 0.12, 0.06); }
    });
    b.collide(-len / 2 - 0.05, 0, -w / 2 - 0.15, len / 2 + 0.05, top, w / 2 + 0.15, 'rubber');
    b.collide(-len / 2 - 0.15, 0, -0.45, -len / 2 + 0.05, 1.45, 0.45);
  });
  beltB.box(beltMat, x, 0.2, z, 2.2, 0.012, 0.95);
  void panelOn;
}

/** A walking human outline drawn by the calibration ring: emissive limb segments, one instanced mesh. */
function walkingOutline(L: LevelBuild, x: number, y: number, z: number): { show(on: boolean): void; step(dt: number, alpha: number): void } {
  const mat = L.ctx.materials.clone('emissive_cyan', { transparent: true, opacity: 0, depthWrite: false });
  mat.emissive.set(0x9fe6ff);
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, -0.5, 0); // hangs down from its joint
  const N = 12;
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.name = 'fitting:outline';
  im.userData.rooms = ['fitting'];
  im.visible = false;
  im.frustumCulled = false;
  L.root.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let ph = 0;
  const put = (i: number, px: number, py: number, pz: number, rx: number, rz: number, len: number, r: number) => {
    q.setFromEuler(e.set(rx, PI / 2, rz, 'YXZ'));
    m4.compose(p.set(x + px, y + py, z + pz), q, s.set(r, len, r));
    im.setMatrixAt(i, m4);
  };
  return {
    show(on) { im.visible = on; },
    step(dt, alpha) {
      mat.opacity = alpha * (0.75 + 0.25 * Math.sin(ph * 9));
      ph += dt * 1.05 * PI * 2 * 0.5;
      const c = Math.sin(ph), c2 = Math.sin(ph + PI);
      const bob = Math.abs(Math.cos(ph)) * 0.035;
      const hip = 0.96 + bob;
      // the subject walks towards -x (rotation y = π/2 maps local -z to world -x); rx swings fore/aft
      let i = 0;
      for (const [sgn, sw] of [[-1, c], [1, c2]] as const) {
        const knee = 0.15 + Math.max(0, Math.sin(ph + (sgn < 0 ? 0 : PI) + 1.2)) * 0.9;
        put(i++, 0, hip, sgn * 0.1, -sw * 0.45, 0, 0.46, 0.035);
        const kx = Math.sin(sw * 0.45) * 0.46, ky = hip - Math.cos(sw * 0.45) * 0.46;
        put(i++, -kx, ky, sgn * 0.1, -sw * 0.45 + knee, 0, 0.45, 0.03);
      }
      // spine, neck, head
      put(i++, 0, hip + 0.58, 0, 0.05, 0, 0.58, 0.05);
      put(i++, 0, hip + 0.72, 0, 0, 0, 0.12, 0.025);
      put(i++, 0, hip + 0.92, 0, 0, 0, 0.2, 0.09);
      // shoulders, arms swinging against the legs
      put(i++, 0, hip + 0.56, -0.2, 0, PI / 2, 0.4, 0.025);
      for (const [sgn, sw] of [[-1, c2], [1, c]] as const) {
        put(i++, 0, hip + 0.55, sgn * 0.2, -sw * 0.35, 0, 0.3, 0.025);
        const ex = Math.sin(sw * 0.35) * 0.3, ey = hip + 0.55 - Math.cos(sw * 0.35) * 0.3;
        put(i++, -ex, ey, sgn * 0.2, -sw * 0.35 - 0.35, 0, 0.27, 0.022);
      }
      while (i < N) put(i++, 0, -10, 0, 0, 0, 0.01, 0.01);
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

void easeInOut;
