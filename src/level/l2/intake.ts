/**
 * INTAKE — x -5…5, z -22…-8, h 3.2. Where the staff were received. Everything squared, labelled, clean:
 * queue rails, a bench, 31 pairs of shoes in a perfect row, coveralls folded in cubbies, a tray of
 * badges, a height gauge, and the processing arch in front of the door to the hall.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { floorSlab, hazardStrip, panelOn, pipe } from '../kit';
import { androidArm, bench, papers, wallTerminal } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';
import { easeInOut, easeOut } from '../ambient';

const PI = Math.PI;

export function buildIntake(L: LevelBuild) {
  const b = L.builder('intake');
  const R = rng(2201);
  const H = 3.2;
  L.room('intake', '흡입구', -5, 5, -22, -8, H);

  floorSlab(b, 'floor_rubber', -5, -22, 5, -8, [], 'rubber');
  ceilingSlab(b, -5.2, -22, 5.2, -8, H, 'wall_medical');
  wallFace(b, { n: '-z', plane: -8.2, from: -5, to: 5, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], style: 'medical', seed: 221, trayY: 0, features: 0 });
  wallFace(b, { n: '+z', plane: -21.8, from: -5, to: 5, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], style: 'medical', seed: 222, trayY: 0, features: 0 });
  wallFace(b, { n: '+x', plane: -5, from: -21.8, to: -8.2, h: H, style: 'medical', seed: 223, features: 0, trayY: 0 });
  wallFace(b, { n: '-x', plane: 5, from: -21.8, to: -8.2, h: H, style: 'medical', seed: 224, features: 0, trayY: 0 });

  // ── lighting: a regular grid, every tube working ──
  let gm: THREE.Material | undefined;
  for (let i = 0; i < 3; i++) for (const x of [-2.5, 2.5]) {
    const z = -10.5 - i * 4.4;
    const h = troffer(b, L, { group: 'intake', x, y: H, z, axis: 'z', len: 1.5, intensity: 50, distance: 7.5, angle: 1.3, color: 0xeef6fa, cast: i === 1 && x < 0, glowMat: gm, priority: 2 });
    gm = (h as any)?.glowMat ?? gm;
  }

  L.point('intake', 0, 1.9, -12, 0xe8f2f8, 7, 8, { priority: 2 });
  L.point('intake', 0, 1.9, -18, 0xe8f2f8, 7, 8, { priority: 2 });
  // ── floor: painted lanes, footprints-stencils towards the arch ──
  b.detail(() => {
    for (const x of [-1.4, 1.4]) b.box(b.L.overlay('painted_white'), x, 0.002, -15, 0.07, 0.004, 13);
    for (let z = -9.5; z > -20; z -= 1.1) b.sign('▼', 'stencil', 0, 0.004, z, 0.4, 0.4, '+y');
    hazardStrip(b, -1.6, -20.2, 1.6, -19.95);
  });
  b.sign('표시 위에 서세요', 'stencil', 0, 0.004, -18.6, 2.2, 0.36, '+y', PI);

  // ── queue rails: three lanes, posts and belts, perfectly straight ──
  const post = (x: number, z: number) => {
    b.cyl('chrome', x, 0.48, z, 0.03, 0.96, 'y', 10);
    b.cyl('painted_dark', x, 0.015, z, 0.16, 0.03, 'y', 16);
    b.cyl('chrome', x, 0.97, z, 0.045, 0.04, 'y', 10);
  };
  const lanes = [-0.9, 0.9];
  for (const x of [-1.8, ...lanes, 1.8]) for (const z of [-9.4, -11.0, -12.6]) post(x, z);
  for (const x of [-1.8, ...lanes, 1.8]) for (const [z0, z1] of [[-9.4, -11.0], [-11.0, -12.6]]) {
    if ((x === -0.9 && z0 === -9.4) || (x === 0.9 && z0 === -11.0)) continue; // the zig-zag gaps
    b.detail(() => { b.box('painted_dark', x, 0.88, (z0 + z1) / 2, 0.012, 0.06, z1 - z0 + 0.0); b.box('painted_yellow', x, 0.88, (z0 + z1) / 2, 0.026, 0.012, z1 - z0); });
    b.collide(x - 0.05, 0, Math.min(z0, z1), x + 0.05, 0.95, Math.max(z0, z1));
  }
  b.sign('호출될 때까지 기다려 주세요', 'label', -3.1, 1.95, -8.4, 1.3, 0.16, '-z'); // beside the door, not in its leaves' path

  // ── west wall: coverall cubbies (31, filled in order, then the empty ones) and the folding table ──
  const cubX = -4.78, cub0 = -9.3, cubW = 0.4, cols = 13, rows = 4;
  b.at(cubX, 0, 0, 0, () => {
    // open cubbies: back panel, top, ends (the folded coveralls sit IN them, not flush with a solid block)
    b.box('painted_white', 0.015, 1.15, cub0 - (cols * cubW) / 2, 0.03, 2.3, cols * cubW + 0.04);
    b.box('painted_white', 0.2, 2.24, cub0 - (cols * cubW) / 2, 0.4, 0.12, cols * cubW + 0.04);
    b.box('painted_white', 0.2, 0.15, cub0 - (cols * cubW) / 2, 0.4, 0.3, cols * cubW + 0.04);
    for (const e of [cub0 + 0.02, cub0 - cols * cubW - 0.02]) b.box('painted_white', 0.2, 1.15, e, 0.4, 2.3, 0.04);
    b.detail(() => {
      for (let r = 0; r <= rows; r++) b.box('trim_steel', 0.2, 0.3 + r * 0.45, cub0 - (cols * cubW) / 2, 0.38, 0.02, cols * cubW + 0.04);
      for (let c = 0; c <= cols; c++) b.box('trim_steel', 0.2, 1.2, cub0 - c * cubW, 0.38, 1.8, 0.015);
    });
  });
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const z = cub0 - (c + 0.5) * cubW, y = 0.31 + r * 0.45;
    if (n < 31) {
      b.inst('coverall', cubX + 0.2, y, z, 0, PI / 2, 0);
      b.inst('coverall', cubX + 0.2, y + 0.1, z, 0, PI / 2 + 0.01, 0); // one folded on another: shirt, coverall
      b.detail(() => b.sign(String(31 - n).padStart(2, '0'), 'label', cubX + 0.385, y + 0.37, z, 0.12, 0.06, '+x'));
    }
    n++;
  }
  b.collide(-5, 0, cub0 - cols * cubW - 0.05, -4.4, 2.3, cub0 + 0.05);
  b.sign('지급 — 반납 — 개어두기', 'label', -4.42, 2.45, cub0 - (cols * cubW) / 2, 1.4, 0.16, '+x');
  // folding table with a half-done stack
  b.at(-3.25, 0, -14.1, PI / 2, () => {
    b.box('trim_steel', 0, 0.98, 0, 2.4, 0.04, 0.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('painted_white', sx * 1.12, 0.48, sz * 0.34, 0.05, 0.96, 0.05);
    b.box('painted_white', 0, 0.18, 0, 2.3, 0.02, 0.7);
    b.inst('coverall', -0.6, 1.0, 0.05, 0, 0, 0); b.inst('coverall', -0.6, 1.1, 0.05, 0, 0.01, 0); b.inst('coverall', -0.6, 1.2, 0.05, 0, -0.01, 0);
    b.inst('coverall', 0.5, 1.0, -0.05, 0, 0, 0);
    // one coverall laid out flat, arms spread, being folded
    b.detail(() => {
      b.box('cloth_coverall', 0.5, 1.005, 0.1, 0.5, 0.012, 0.62);
      for (const s of [-1, 1]) b.rbox('cloth_coverall', 0.5 + s * 0.4, 1.005, -0.08, 0.38, 0.01, 0.12, 0, s * 0.35, 0);
      b.box('chrome', 0.5, 1.013, 0.1, 0.012, 0.004, 0.45);
      for (let i = 0; i < 6; i++) b.inst('badge', -0.05 + (i % 3) * 0.07, 1.01, -0.25 + Math.floor(i / 3) * 0.1, 0, 0, 0);
    });
    b.collide(-1.2, 0, -0.4, 1.2, 1.0, 0.4);
  });
  L.enemy('g2_intake', 'husk', 'dormant', -2.35, 0, -13.5, PI / 2, 'fold', 'worker');
  L.enemy('g2_intake', 'husk', 'dormant', -2.35, 0, -14.9, PI / 2, 'fold', 'worker');

  // ── east wall: the bench and the shoes. 31 pairs, toes out, 33 cm apart, one pair out of line ──
  b.at(4.62, 0, -14.6, -PI / 2, () => bench(b, 10.4));
  const shoe0 = -9.6, pitch = 0.33;
  const loose = 30; // the pair at the south end (next to the open shelf) sits askew
  for (let i = 0; i < 31; i++) {
    if (i === loose) continue;
    b.at(4.22, 0, shoe0 - i * pitch, -PI / 2, () => {
      const kind = ['shoe', 'shoe', 'shoe_b', 'shoe', 'shoe_w', 'shoe_b', 'shoe'][(i * 5 + (i >> 2)) % 7];
      b.inst(kind, -0.065, 0, 0, 0, 0, 0); b.inst(kind, 0.065, 0, 0, 0, 0, 0);
      b.inst('shoe_lace', -0.065, 0, 0, 0, 0, 0); b.inst('shoe_lace', 0.065, 0, 0, 0, 0, 0);
    });
  }
  // number tags on the bench edge above each pair
  b.detail(() => { for (let i = 0; i < 31; i++) b.sign(String(i + 1), 'label', 4.42, 0.44, shoe0 - i * pitch, 0.08, 0.045, '-x'); });
  // the note, folded into one shoe
  const noteZ = shoe0 - 17 * pitch;
  b.detail(() => { b.rbox('plastic_white', 4.2, 0.12, noteZ + 0.065, 0.06, 0.004, 0.09, 0.9, 0.3, 0.2); });
  L.interact('note2_intake', 'log', '쪽지 읽기', 4.2, 0.35, noteZ, true, 2.2);
  L.objects.set('intake_shoes', Object.assign(new THREE.Object3D(), { name: 'intake_shoes' }));
  L.objects.get('intake_shoes')!.position.set(4.22, 0, shoe0 - 15 * pitch);
  L.root.add(L.objects.get('intake_shoes')!);
  // the loose pair: separate meshes so they can be put straight
  const lp = L.part('intake:loose');
  for (const s of [-1, 1]) { lp.push(s * 0.065, 0, 0); lp.box('rubber', 0, 0.015, 0, 0.1, 0.03, 0.29); lp.sphere('rubber', 0.004, 0.06, 0.075, 0.055, 8, 0.85, 0.92, 1.25); lp.box('rubber', 0, 0.07, -0.06, 0.09, 0.09, 0.17); lp.cyl('rubber', 0, 0.12, -0.075, 0.048, 0.06, 'y', 8); lp.pop(); }
  const looseG = lp.build(false);
  const looseZ = shoe0 - loose * pitch;
  looseG.position.set(4.12, 0, looseZ + 0.06);
  looseG.rotation.y = -PI / 2 + 0.38;
  for (const m of looseG.children) m.castShadow = true;
  L.root.add(looseG);
  // open-backed shelf right after the row (the arm comes from behind it)
  b.at(4.45, 0, -20.55, -PI / 2, () => {
    for (const s of [-1, 1]) b.box('painted_white', s * 0.55, 1.0, 0, 0.04, 2.0, 0.5);
    for (const y of [0.05, 0.6, 1.15, 1.7]) b.box('trim_steel', 0, y, 0, 1.1, 0.025, 0.5);
    b.detail(() => {
      for (let i = 0; i < 4; i++) b.inst('coverall', -0.35 + (i % 2) * 0.55, 0.62 + Math.floor(i / 2) * 0.55, 0, 0, 0, 0);
      b.box('plastic_white', 0, 1.2, -0.22, 0.5, 0.14, 0.04);
    });
    b.collide(-0.6, 0, -0.27, 0.6, 2.0, 0.27);
  });
  const armB = L.part('intake:arm');
  armB.push(0, 0, 0, 0, 0, 0); androidArm(armB); armB.pop();
  const armG = armB.build(false);
  for (const m of armG.children) m.castShadow = true;
  const armPivot = new THREE.Group();
  armPivot.position.set(4.55, 0.42, -20.3); // behind the bottom shelf
  armPivot.add(armG);
  armG.rotation.set(0, 0, PI / 2); // lying along -x (out of the shelf) when extended
  armPivot.visible = false;
  L.root.add(armPivot);
  L.vignette('intake_shoe', () => {
    armPivot.visible = true;
    armPivot.position.set(4.75, 0.08, -20.25);
    armPivot.rotation.set(0, -0.35, 0);
    L.sfx('servo', 4.6, 0.3, -20.2, 0.5, 1.2);
    // reach out under the shelf, nudge the pair square, withdraw
    L.tween(0, 1.1, (k) => { const e = easeInOut(k); armPivot.position.x = 4.75 - e * 0.55; armPivot.rotation.y = -0.35 + e * 0.15; });
    L.tween(1.25, 0.9, (k) => {
      const e = easeOut(k);
      looseG.rotation.y = -PI / 2 + 0.38 * (1 - e);
      looseG.position.set(4.12 + 0.1 * e, 0, looseZ + 0.06 * (1 - e));
      armPivot.position.z = -20.25 + e * 0.12;
    }, () => L.sfx('shoe_slide', 4.2, 0.05, looseZ, 0.7));
    L.tween(2.4, 1.2, (k) => { const e = easeInOut(k); armPivot.position.x = 4.2 + e * 0.6; armPivot.position.z = -20.13 - e * 0.1; }, () => { armPivot.visible = false; });
  });

  // ── tray of badges on the receiving counter (south-east), 31 in a grid ──
  b.at(2.7, 0, -19.2, PI, () => {
    b.box('painted_white', 0, 0.45, 0, 1.6, 0.9, 0.6);
    b.box('trim_steel', 0, 0.915, 0.02, 1.66, 0.03, 0.68);
    b.detail(() => { for (let i = 0; i < 3; i++) panelOn(b, 'painted_white', -0.52 + i * 0.52, 0.45, 0.302, 0.48, 0.8, '+z', 0.01, 0.01); });
    // the tray
    b.box('painted_dark', 0.2, 0.945, 0.05, 0.62, 0.03, 0.46);
    b.detail(() => {
      for (let i = 0; i < 31; i++) {
        const c = i % 7, r = Math.floor(i / 7);
        b.inst('badge', 0.2 - 0.25 + c * 0.075, 0.962, 0.05 - 0.17 + r * 0.095, 0, PI, 0);
        b.inst('badge_photo', 0.2 - 0.25 + c * 0.075, 0.962, 0.05 - 0.17 + r * 0.095, 0, PI, 0);
      }
    });
    papers(b, 3, 0.15, R);
    b.collide(-0.8, 0, -0.3, 0.8, 0.95, 0.3);
  });
  b.sign('접수됨', 'label', 2.9, 1.08, -19.2 + 0.33, 0.38, 0.08, '+z');
  // receiving terminal by the arch
  b.at(1.95, 0, -21.8, 0, () => wallTerminal(b, 1.35));
  L.screen('intake_terminal', 'terminal_idle', 0.44, 0.3, 1.95, 1.43, -21.8 + 0.126, '+z', { tilt: -0.18, text: '흡입구 — 2번 라인\n접수: 31 / 31' });
  L.interact('term2_intake', 'terminal', '단말기 읽기', 1.95, 1.4, -21.4, true, 2.2);

  // ── height gauge: west wall by the arch ──
  const gz = -19.4;
  b.at(-5, 0, gz, PI / 2, () => {
    b.box('painted_white', 0, 1.25, 0.04, 0.22, 2.1, 0.04); // clear of the wall's kick plate face
    b.detail(() => {
      for (let cm = 100; cm <= 220; cm += 2) {
        const major = cm % 10 === 0;
        b.box('painted_dark', -0.07 + (major ? 0.02 : 0), cm / 100, 0.052, major ? 0.07 : 0.035, 0.004, 0.002);
        if (cm % 20 === 0) b.sign(String(cm), 'label', 0.06, cm / 100, 0.052, 0.07, 0.035, '+z');
      }
      b.box('trim_steel', 0.13, 1.25, 0.04, 0.02, 2.1, 0.02);
      // footprints painted on the floor in front of it
      for (const s of [-1, 1]) b.rbox('painted_white', s * 0.1, 0.002, 0.3, 0.1, 0.004, 0.27, 0, s * 0.08, 0);
    });
  });
  const slider = L.part('intake:gauge');
  slider.box('trim_steel', 0, 0, 0.11, 0.3, 0.025, 0.2);
  slider.box('painted_dark', -0.13, 0, 0.03, 0.05, 0.08, 0.06);
  slider.box('emissive_red', 0.0, 0.0, 0.212, 0.06, 0.008, 0.004);
  const sliderG = slider.build(false);
  const sliderPivot = new THREE.Group();
  sliderPivot.position.set(-5, 2.12, gz); sliderPivot.rotation.y = PI / 2;
  sliderPivot.add(sliderG);
  L.root.add(sliderPivot);
  L.vignette('intake_gauge', () => {
    L.sfx('servo', -4.9, 2.0, gz, 0.35, 1.6);
    L.tween(0, 0.9, (k) => { sliderPivot.position.y = 2.12 - (2.12 - 1.78) * (k < 0.85 ? easeInOut(k / 0.85) * 1.02 : 1.02 - (k - 0.85) / 0.15 * 0.02); },
      () => { sliderPivot.position.y = 1.78; L.sfx('button', -4.9, 1.78, gz, 0.8, 1.4); });
  });
  b.sign('높이', 'label', -4.94, 2.42, gz, 0.3, 0.07, '+x');

  // ── processing arch ──
  const AZ = -20.7;
  b.at(0, 0, AZ, 0, () => {
    for (const s of [-1, 1]) {
      b.box('painted_white', s * 1.22, 1.3, 0, 0.32, 2.6, 0.7);
      b.box('trim_steel', s * 1.22, 0.04, 0, 0.42, 0.08, 0.8);
      b.detail(() => {
        for (let i = 0; i < 9; i++) b.box('painted_dark', s * 1.05, 0.35 + i * 0.24, 0, 0.012, 0.16, 0.5);
        panelOn(b, 'trim_steel', s * 1.39, 1.3, 0, 0.6, 2.2, s > 0 ? '+x' : '-x', 0.015, 0.02);
      });
      b.collide(s * 1.22 - 0.16, 0, -0.35, s * 1.22 + 0.16, 2.6, 0.35);
    }
    b.box('painted_white', 0, 2.75, 0, 2.76, 0.3, 0.7);
    b.detail(() => {
      b.box('painted_dark', 0, 2.59, 0, 2.1, 0.02, 0.5);
      b.sign('처리 중', 'label', 0, 2.75, 0.352, 1.0, 0.16, '+z');
      b.sign('처리 중', 'label', 0, 2.75, -0.352, 1.0, 0.16, '-z');
    });
  });
  const archLight = L.spot('intake', 0, 2.55, AZ, 0, 0, AZ, 0xbfeaff, 30, 4, 0.9, { priority: 2 });
  const archGlow = L.glow(archLight, 'emissive_cyan', 1.2);
  b.detail(() => {
    for (const s of [-1, 1]) for (const dz of [-0.22, 0.22]) b.box(archGlow, s * 1.035, 1.3, AZ + dz, 0.025, 2.1, 0.035);
    b.box(archGlow, 0, 2.58, AZ, 1.9, 0.02, 0.05);
    // emitter grid on the inner faces, a scanner head under the lintel
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.inst(i % 2 ? 'led_cyan' : 'led_green', s * 1.04, 0.5 + i * 0.35, AZ, 0, s * PI / 2);
    b.box('painted_dark', 0, 2.5, AZ, 0.6, 0.12, 0.3);
    b.cyl('screen_off', 0, 2.43, AZ, 0.08, 0.03, 'y', 12);
  });
  const archObj = new THREE.Object3D(); archObj.name = 'intake_arch'; archObj.position.set(0, 0, AZ); L.root.add(archObj); L.objects.set('intake_arch', archObj);

  // services above the ceiling grid line, wall clock (stopped), signage
  b.detail(() => {
    pipe(b, 'steel_raw', [[-4.8, H - 0.18, -8.4], [-4.8, H - 0.18, -21.6]], 0.03, { every: 0 });
    // (beside the doorway, not in it: the open blast door's leaves pass through the door plane)
    b.cyl('painted_white', 3.3, 2.45, -8.225, 0.17, 0.05, 'z', 20);
    b.cyl('plastic_white', 3.3, 2.45, -8.195, 0.15, 0.01, 'z', 20);
    b.rbox('painted_dark', 3.34, 2.48, -8.187, 0.012, 0.11, 0.004, 0, 0, -0.7);
    b.rbox('painted_dark', 3.28, 2.43, -8.187, 0.012, 0.07, 0.004, 0, 0, 2.2);
  });
  b.sign('흡입구', 'stencil', -2.9, 2.6, -8.21, 1.6, 0.36, '-z');
  b.sign('2번 라인', 'directional', 2.9, 2.2, -21.785, 0.9, 0.2, '+z', 0, true);
  b.sign('신발을 벗으세요', 'label', 4.97, 1.6, -14.6, 1.2, 0.16, '-x', 0, true);
  b.sign('개인 물품은 두고 가세요', 'label', -4.97, 2.55, -12.0, 1.4, 0.16, '+x', 0, true);

  L.pickup('p2_intake_med', 'medkit', 2.4, 0.95, -19.25, 35, 0.2);
  void R;
}
