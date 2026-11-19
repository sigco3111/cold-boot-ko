/** EQUIPMENT STORAGE — x 3…10, z -21…-13, h 3.2. Shelving, crates, the shotgun cage. */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { cagePanel, floorSlab, ibeam, pipe } from '../kit';
import { cableCoil, clipboard, crate, drum, gasBottle, pallet, shelfRack, workTable } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';

const PI = Math.PI;

export function buildStorage(L: LevelBuild) {
  const b = L.builder('storage');
  const R = rng(505);
  const H = 3.2;
  L.room('storage', '장비 창고', 3, 10, -21, -13, H);

  floorSlab(b, 'floor_plate', 3, -21, 10, -13, [], 'metal');
  ceilingSlab(b, 3, -21.2, 10.2, -12.8, H);
  wallFace(b, { n: '+x', plane: 3.2, from: -21, to: -13, h: H, t: 0.2, openings: [{ c: -17, w: 1.6, h: 2.4 }], seed: 31, features: 0.3 });
  wallFace(b, { n: '-x', plane: 10, from: -21, to: -13, h: H, seed: 32, features: 0.4, clear: [[-16.2, -13]] });
  wallFace(b, { n: '+z', plane: -21, from: 3.2, to: 10, h: H, seed: 33, features: 0 });
  wallFace(b, { n: '-z', plane: -13, from: 3.2, to: 10, h: H, seed: 34, features: 0 });

  for (const z of [-15, -17, -19]) ibeam(b, 'trim_steel', 'x', 6.6, H - 0.1, z, 6.8, 0.12, 0.2);
  b.detail(() => {
    pipe(b, 'copper', [[3.5, H - 0.3, -20.8], [3.5, H - 0.3, -13.2]], 0.045, { every: 1.8 });
    pipe(b, 'painted_orange', [[9.6, H - 0.14, -20.8], [9.6, H - 0.14, -16.4]], 0.022, { flanges: false });
  });

  // ── racks ──
  b.at(6.9, 0, -20.66, 0, () => shelfRack(b, L, 5.2, 0.6, 2.5, 4, R, 0.8));
  b.at(7.2, 0, -19.0, 0, () => shelfRack(b, L, 4.6, 0.6, 2.5, 4, R, 0.7));
  b.at(5.3, 0, -13.34, PI, () => shelfRack(b, L, 3.6, 0.6, 2.5, 4, R, 0.8));
  b.sign('통로 1', 'label', 4.88, 2.2, -19.0, 0.4, 0.1, '-x', 0, true);
  b.sign('통로 2', 'label', 4.28, 2.2, -20.66, 0.4, 0.1, '-x', 0, true);

  // ── the cage (NE corner) ──
  const cg = L.doubleSided('floor_grate');
  const CH = 2.7;
  // south face z = -16.2, x 7.4…10
  // (cage ends stop 4 cm short of the wall kick plates: no shared faces)
  b.at(7.4, 0, -16.2, 0, () => { for (let i = 0; i < 2; i++) cagePanel(b, cg, i * 1.28, 0.05, (i + 1) * 1.28, CH, 0, 0.05); });
  b.collide(7.4, 0, -16.24, 10, CH, -16.16);
  // west face x = 7.4: fixed panels either side of the gate (gate z -15.75…-14.55)
  b.at(7.4, 0, -13, PI / 2, () => { cagePanel(b, cg, 0.09, 0.05, 1.55, CH, 0, 0.05); cagePanel(b, cg, 2.75, 0.05, 3.2, CH, 0, 0.05); cagePanel(b, cg, 1.55, 2.15, 2.75, CH, 0, 0.05); });
  b.collide(7.36, 0, -14.55, 7.44, CH, -13);
  b.collide(7.36, 0, -16.2, 7.44, CH, -15.75);
  b.box('trim_steel', 8.7, CH + 0.03, -16.2, 2.7, 0.06, 0.08).box('trim_steel', 7.4, CH + 0.03, -14.6, 0.08, 0.06, 3.3);
  // the gate, swung open into the room
  b.at(7.4, 0, -15.75, PI / 2 + 2.0, () => {
    cagePanel(b, cg, -1.18, 0.08, 0, 2.12, 0, 0.05);
    b.detail(() => { b.box('steel_raw', -1.08, 1.1, 0.04, 0.12, 0.2, 0.05); b.box('painted_dark', -1.08, 1.1, 0.08, 0.06, 0.1, 0.04); });
  });
  b.at(7.4, 0, -15.75, PI / 2 + 2.0, () => b.collide(-1.18, 0, -0.04, 0, 2.1, 0.04));
  b.sign('관리 물품 — 보안실 승인 시만 반출', 'danger', 7.37, 2.4, -14.0, 1.1, 0.16, '-x', 0, true);
  // inside: table with the shotgun, ammo, gas bottles chained to the wall
  b.at(9.62, 0, -14.6, 0, () => workTable(b, 0.7, 1.8, 0.9));
  b.detail(() => { b.box('rubber', 9.62, 0.903, -14.6, 0.5, 0.006, 1.3); b.box('painted_dark', 9.95, 1.5, -14.6, 0.06, 0.7, 1.6); for (let i = 0; i < 4; i++) b.box('steel_raw', 9.94, 1.3 + i * 0.15, -14.6, 0.06, 0.02, 1.5); });
  // (the shotgun that lived here was signed out — Hale took it to the pump room)
  b.detail(() => { b.box('painted_dark', 9.62, 0.908, -14.6, 0.16, 0.004, 1.0); b.sign('반출 — D. 헤일', 'label', 9.62, 0.911, -15.2, 0.3, 0.05, '+y', PI / 2); });
  L.pickup('p_storage_shells', 'ammo_shotgun', 9.6, 0.91, -13.95, 6, 0.3);
  for (let i = 0; i < 3; i++) b.at(7.75 + i * 0.26, 0, -13.22, i, () => gasBottle(b, i === 1 ? 'painted_orange' : 'painted_white'));
  b.detail(() => b.rod('steel_raw', 7.6, 0.9, -13.36, 8.45, 0.9, -13.36, 0.008, 4));
  b.collide(7.6, 0, -13.4, 8.45, 1.3, -13.05);
  b.at(8.9, 0, -15.5, 0.3, () => crate(b, 0.8, 0.5, 0.6, 'painted_dark', '에리두 SEC'));

  // ── floor stock ──
  b.at(4.3, 0, -15.3, 0.1, () => { pallet(b); b.at(0, 0.145, 0, 0, () => crate(b, 1.0, 0.7, 0.8, 'wall_panel', '예비품')); });
  b.at(4.3, 0, -15.3, 0.1, () => b.collide(-0.6, 0, -0.5, 0.6, 0.85, 0.5));
  b.at(4.25, 0.845, -15.3, 0.4, () => crate(b, 0.6, 0.4, 0.5, 'painted_yellow', undefined, false));
  b.at(6.2, 0, -16.6, -0.2, () => crate(b, 0.9, 0.6, 0.7, 'painted_dark', '할시온'));
  L.pickup('p_storage_med', 'medkit', 6.2, 0.6, -16.6, 35, 0.5);
  b.at(4.1, 0, -18.6, 0, () => crate(b, 0.7, 0.8, 0.6, 'wall_panel_dark', 'LOT 3-A'));
  b.at(4.1, 0.8, -18.6, 0.5, () => clipboard(b));
  L.interact('log_storage', 'log', '쪽지 읽기', 4.1, 0.85, -18.6);
  b.at(9.35, 0, -17.2, 0, () => drum(b, 'painted_orange'));
  b.at(9.4, 0, -17.85, 0, () => drum(b, 'painted_yellow'));
  b.at(8.75, 0, -17.5, 0, () => drum(b, 'painted_orange'));
  b.at(5.6, 0, -17.9, 0, () => cableCoil(b, 0.32, 5));
  b.decal('oil_stain', 0, 8.9, 0.002, -17.6, 1.6, 1.4, '+y', 0.4);
  b.decal('scratches', 3, 5.5, 0.002, -16.9, 1.4, 1.4, '+y', 0.9);
  b.decal('grime', 1, 7, 0.002, -19.85, 3, 0.9, '+y');

  // ── lights: one troffer by the door, an amber cage lamp throwing mesh shadows across the floor ──
  troffer(b, L, { group: 'storage', x: 5.0, y: H, z: -17.0, axis: 'z', intensity: 75, distance: 8, angle: 1.1, flicker: 'fluorescent', cast: true });
  troffer(b, L, { group: 'storage', x: 7.4, y: H, z: -19.8, axis: 'x', dead: true });
  const cage = L.spot('storage', 9.3, 2.85, -13.7, 6.2, 0, -17.2, 0xffa850, 60, 9, 0.95, { cast: true, priority: 2, penumbra: 0.7 });
  b.detail(() => { b.box('painted_dark', 9.3, 3.0, -13.7, 0.25, 0.2, 0.25); b.sphere(L.glow(cage, 'emissive_amber'), 9.3, 2.88, -13.7, 0.07, 8); for (let i = 0; i < 4; i++) b.rod('steel_raw', 9.3 + Math.cos(i * PI / 2) * 0.09, 2.95, -13.7 + Math.sin(i * PI / 2) * 0.09, 9.3 + Math.cos(i * PI / 2) * 0.09, 2.78, -13.7 + Math.sin(i * PI / 2) * 0.09, 0.005, 4); });
  L.point('storage', 8.0, 0.6, -19.85, 0xff3010, 1.2, 2.5, { flicker: 'pulse' });

  b.sign('장비 창고', 'stencil', 3.236, 2.3, -14.9, 1.4, 0.22, '+x');
  b.sign('최대 3단 적재', 'warning', 9.964, 1.8, -18.8, 0.7, 0.14, '-x', 0, true);
  L.navNode(8.7, -14.9, 'storage'); L.navNode(8.3, -15.2, 'storage'); L.navNode(6.5, -19.85, 'storage'); L.navNode(8.3, -19.85, 'storage'); L.navNode(5.0, -19.85, 'storage');

  // ── storage_canister: a gas canister on top of the middle rack walks itself off the edge ──
  {
    const def = L.instDefs.get('canister_grey')!;
    const mesh = new THREE.Mesh(def.geo, def.mat);
    mesh.position.y = -0.26; mesh.castShadow = true; mesh.receiveShadow = true;
    const can = new THREE.Group();
    can.name = 'storage_canister';
    can.add(mesh);
    const CX = 7.6, TOP = 2.495, Z0 = -18.84, RAD = 0.11, HALF = 0.26;
    can.position.set(CX, TOP + HALF, Z0);
    L.root.add(can);
    L.objects.set('storage_canister', can);
    const qLay = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, PI / 2)), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    const CAGE = -16.2 - RAD - 0.04;
    L.vignette('storage_canister', () => {
      // rocks twice on its base (tick… tick), tips over the edge, tumbles 2.5 m, lands, rolls across the aisle into the cage
      for (const d of [0.05, 0.45]) L.after(d, () => L.sfx('pipe_tick', CX, TOP, Z0, 0.5, 1.4));
      L.tween(0, 0.8, (k) => { can.rotation.x = Math.sin(k * PI * 4) * 0.05 * (0.4 + k); });
      const pz = Z0 + RAD; // pivot: the base's edge nearest the aisle
      L.tween(0.8, 0.42, (k) => {
        const a = 1.3 * k * k;
        can.rotation.x = a;
        can.position.set(CX, TOP + Math.cos(a) * HALF + Math.sin(a) * RAD, pz + Math.sin(a) * HALF - Math.cos(a) * RAD);
      }, () => {
        let vy = -1.2, vz = 0.55, t = 0, phase = 0, roll = 0, z0 = 0, bounce = 0;
        qA.copy(can.quaternion);
        const y0 = can.position.y, fall = Math.sqrt((2 * (y0 - RAD)) / 9.8) * 0.9;
        const ROLL = 2.75;
        L.sim((dt) => {
          t += dt;
          if (phase === 0) {
            vy -= 9.8 * dt;
            can.position.y += vy * dt; can.position.z += vz * dt;
            const k = Math.min(1, t / fall);
            qB.setFromAxisAngle(X, k * PI * 2).multiply(qLay);
            can.quaternion.slerpQuaternions(qA, qB, k);
            if (can.position.y <= RAD) {
              can.position.y = RAD; phase = 1; t = 0; z0 = can.position.z; bounce = 1;
              L.sfx('canister_roll', CX, 0.2, z0, 1, 1);
              L.ctx.fx.smoke(can.position, { count: 4, size: 0.3, color: 0x77797a, life: 1.2 });
            }
            return true;
          }
          if (phase === 1) {
            const u = Math.min(1, t / ROLL), D = CAGE - z0;
            const z = z0 + D * u * (1.55 - 0.55 * u);
            roll += (z - can.position.z) / RAD;
            can.position.z = z;
            // two dying hops after the landing
            bounce = Math.max(0, 1 - t / 0.55);
            can.position.y = RAD + Math.abs(Math.sin(t * 11)) * 0.09 * bounce * bounce;
            can.position.x = CX + Math.sin(t * 1.3) * 0.05 * u;
            can.quaternion.setFromAxisAngle(X, roll).multiply(qLay);
            if (u >= 1) { phase = 2; t = 0; L.sfx('metal_clang', CX, 0.3, -16.2, 0.35, 1.5); }
            return true;
          }
          // hits the mesh, comes back a hand's width, rocks to rest
          const back = 0.07 * (1 - Math.exp(-t * 4)) + Math.sin(t * 5) * 0.025 * Math.exp(-t * 1.3);
          const z = CAGE - back;
          roll += (z - can.position.z) / RAD;
          can.position.z = z;
          can.quaternion.setFromAxisAngle(X, roll).multiply(qLay);
          return t < 5;
        });
      });
    });
  }

  // ── a ceiling panel hanging by one edge, swinging in the draught from the open plenum ──
  {
    const pb = L.part('storage:panel');
    pb.box('ceiling_panel', 0, -0.3, 0, 0.6, 0.6, 0.02);
    pb.box('trim_steel', 0, -0.01, 0, 0.62, 0.02, 0.03);
    const panel = pb.build(false);
    panel.position.set(5.6, H - 0.02, -15.25);
    for (const m of panel.children) m.castShadow = true;
    L.root.add(panel);
    b.detail(() => { b.box('screen_off', 5.6, H - 0.003, -14.95, 0.6, 0.006, 0.6); for (const s of [-1, 1]) b.box('trim_steel', 5.6 + s * 0.31, H - 0.01, -14.95, 0.03, 0.02, 0.62); b.box('trim_steel', 5.6, H - 0.01, -14.64, 0.62, 0.02, 0.03); });
    let gust = 0, gv = 0, creak = 6;
    L.ambient('storage', (dt, t) => {
      // rest angle a little off vertical; slow breathing plus the odd shove
      if (Math.random() < dt * 0.12) gv += 0.5;
      gv += (-gust * 6 - gv * 0.6) * dt; gust += gv * dt;
      panel.rotation.x = -0.22 + Math.sin(t * 1.25) * 0.045 + Math.sin(t * 0.37) * 0.03 + gust * 0.2;
      creak -= dt;
      if (creak <= 0) { creak = 7 + Math.random() * 12; L.sfx('metal_groan', 5.6, H - 0.1, -15.2, 0.1, 2.1); }
    });
  }
  L.ctx.fx.emitter('dust', L.vec(6.5, 1.5, -16.5), L.vec(0, -1, 0), 4);
}
