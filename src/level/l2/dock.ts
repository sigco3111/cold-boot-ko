/**
 * FREIGHT DOCK 5 — x -4…4, z -8…0, h 3.6. Clean, evenly lit, wrong: no barricade, no blood. Pallets of
 * finished shells, a sealed bay shutter, a floor polisher that a unit keeps running over the same square.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { bolts4, cableBundle, floorSlab, hazardStrip, ibeam, panel, pipe } from '../kit';
import { crate, fireExtinguisher, tablet } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';
import { glove, polisherBody, polisherPad, shellPallet } from './kit2';

const PI = Math.PI;

export function buildDock(L: LevelBuild) {
  const b = L.builder('dock');
  const R = rng(2101);
  const H = 3.6;
  L.room('dock', '화물 도크 5', -4, 4, -8, 0, H);

  floorSlab(b, 'floor_concrete', -4, -8, 4, 0, [], 'concrete');
  ceilingSlab(b, -4.2, -8, 4.2, 0, H, 'painted_white');
  wallFace(b, { n: '-z', plane: -0.2, from: -4, to: 4, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 201, trayY: 0, features: 0.2 });
  wallFace(b, { n: '+z', plane: -7.8, from: -4, to: 4, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 202, trayY: 0, features: 0.2 });
  wallFace(b, { n: '+x', plane: -4, from: -7.8, to: -0.2, h: H, seed: 203, features: 0, clear: [[-6.5, -1.5]], trayY: H - 0.45 });
  wallFace(b, { n: '-x', plane: 4, from: -7.8, to: -0.2, h: H, seed: 204, features: 0.25, trayY: H - 0.45 });
  for (const z of [-2, -4, -6]) ibeam(b, 'trim_steel', 'x', 0, H - 0.12, z, 8, 0.14, 0.24);

  // ── the bay shutter in the west wall: sealed, its leveller folded up ──
  b.at(-4, 0, -4, PI / 2, () => {
    const w = 3.4, h = 3.0;
    b.box('trim_steel', 0, h + 0.15, 0.12, w + 0.5, 0.3, 0.24);
    for (const s of [-1, 1]) { b.box('painted_yellow', s * (w / 2 + 0.12), h / 2, 0.08, 0.2, h, 0.16); b.box('hazard_stripes', s * (w / 2 + 0.12), 0.5, 0.165, 0.2, 1.0, 0.004); }
    b.detail(() => {
      for (let y = 0.06; y < h; y += 0.12) b.box('steel_raw', 0, y, 0.12 + (Math.round(y / 0.12) % 2) * 0.006, w - 0.02, 0.1, 0.03); // in front of the wall's pilasters and kick blocks
      b.box('painted_dark', 0, 0.04, 0.07, w, 0.08, 0.06);
      b.box('steel_raw', 0.6, 0.45, 0.08, 0.16, 0.05, 0.05);
      b.sign('도크 5 — CHOIR가 봉인', 'warning', 0, 1.65, 0.08, 1.4, 0.22, '+z', 0, true);
      b.sign('5', 'stencil', 0, 2.4, 0.075, 0.6, 0.7, '+z');
      // leveller plate stowed in front of the shutter
      b.box('floor_plate', 0, 0.06, 0.55, w - 0.2, 0.12, 0.8);
      hazardStrip(b, -w / 2, 0.15, w / 2, 0.95, 0.12);
      for (const s of [-1, 1]) b.box('rubber', s * (w / 2 - 0.1), 0.35, 0.27, 0.25, 0.4, 0.2);
    });
    b.collide(-w / 2, 0, 0, w / 2, 0.13, 0.95, 'metal', false);
  });

  // ── pallets of finished shells, in a dead-straight row along the east wall ──
  const pal = [-1.4, -2.75, -4.1, -5.45];
  pal.forEach((z, i) => b.at(3.2, 0, z, PI / 2, () => shellPallet(b, L, 3, 2, i === 2 ? 4 : 5, i === 1)));
  b.at(3.25, 0, -6.85, PI / 2, () => crate(b, 1.1, 0.8, 0.9, 'painted_white', '셸 세트 4-B'));
  b.at(3.25, 0.8, -6.85, PI / 2 + 0.02, () => crate(b, 0.9, 0.5, 0.7, 'painted_white', 'FASTENERS', false));
  // the delivery slate, squared up on top of the last pallet
  b.at(3.0, 0.142 + 5 * 0.15 + 0.03, -1.4, PI / 2, () => tablet(b, 'emissive_cyan', 0.26, 0.18));
  L.interact('note2_dock', 'log', '슬레이트 읽기', 3.0, 0.95, -1.4, true, 2.4);
  L.point('dock', 3.0, 1.1, -1.4, 0x40d8ff, 0.5, 1.2);
  // floor markings: bays and a walking lane
  b.detail(() => {
    for (const z of [-0.75, -7.25]) b.box(b.L.overlay('painted_yellow'), 2.9, 0.002, z, 2.0, 0.004, 0.08);
    b.box(b.L.overlay('painted_yellow'), 1.95, 0.002, -4, 0.08, 0.004, 6.5);
    for (const x of [-1.6, 1.6]) b.box(b.L.overlay('painted_white'), x, 0.002, -4, 0.08, 0.004, 7.4);
    for (let z = -1; z > -7.5; z -= 1.3) b.sign('▲', 'stencil', 0, 0.004, z, 0.5, 0.5, '+y', PI);
  });
  b.sign('앞을 비워 두세요', 'stencil', -2.9, 0.004, -4, 2.6, 0.45, '+y', -PI / 2);

  // ── wall furniture: dock board, extinguisher, bumpers, PPE station ──
  b.at(-4, 0, -6.6, PI / 2, () => {
    b.box('painted_dark', 0, 1.65, 0.04, 1.36, 0.86, 0.08);
    bolts4(b, -0.68, 1.22, 0.68, 2.08, 0.08);
  });
  L.screen('dock_board', 'terminal_idle', 1.24, 0.74, -3.9, 1.65, -6.6, '+x', { text: '도크 5 — 발신\n2번 라인: 유닛 31대 발송 완료\n수신: 예정 없음\n제작 하부층 — 봉쇄됨:\n압력 시험 72시간 — CHOIR가 보고' });
  b.sign('발송 게시판', 'label', -3.95, 2.2, -6.6, 0.8, 0.12, '+x');
  b.at(-4, 0, -1.2, PI / 2, () => {
    fireExtinguisher(b);
    b.box('painted_orange', 0, 1.2, 0.02, 0.3, 0.5, 0.04);
  });
  b.sign('이 지점 너머 보호구 착용', 'warning', -3.96, 1.75, -1.2, 0.9, 0.2, '+x', 0, true);
  b.at(-4, 0, -2.2, PI / 2, () => {
    // hooks with hi-vis vests, all present and hung the same way
    b.box('trim_steel', 0, 1.7, 0.03, 0.9, 0.05, 0.06);
    b.detail(() => {
      for (let i = 0; i < 4; i++) {
        const x = -0.33 + i * 0.22;
        b.rod('chrome', x, 1.7, 0.05, x, 1.68, 0.12, 0.008, 4);
        b.rbox('painted_yellow', x, 1.38, 0.1, 0.18, 0.55, 0.03, 0.04, 0, 0);
        b.box('plastic_white', x, 1.38, 0.118, 0.17, 0.035, 0.004);
      }
    });
  });
  for (const z of [-0.6, -7.4]) for (const x of [-3.7, 3.7]) b.at(x, 0, z, 0, () => {
    b.cyl('painted_yellow', 0, 0.5, 0, 0.08, 1.0, 'y', 12);
    b.detail(() => { b.cyl('painted_dark', 0, 0.8, 0, 0.083, 0.06, 'y', 12); b.cyl('painted_dark', 0, 0.6, 0, 0.083, 0.06, 'y', 12); });
    b.collide(-0.09, 0, -0.09, 0.09, 1.0, 0.09);
  });

  // services overhead
  b.detail(() => {
    pipe(b, 'copper', [[-3.75, H - 0.3, -0.3], [-3.75, H - 0.3, -7.7]], 0.045, { every: 2 });
    pipe(b, 'steel_raw', [[3.75, H - 0.55, -0.3], [3.75, H - 0.55, -7.7]], 0.06, { every: 2 });
    cableBundle(b, [-1.5, H - 0.25, -2.1], [-1.5, H - 0.25, -3.9], 3, 0.06, 0.014, 0.04, R);
    cableBundle(b, [1.5, H - 0.25, -4.1], [1.5, H - 0.25, -5.9], 3, 0.06, 0.014, 0.04, R);
  });
  b.sign('화물 도크 5', 'stencil', 0, 3.25, -7.596, 3.0, 0.42, '+z');
  b.sign('흡입구 ↓', 'directional', 2.3, 2.4, -7.586, 0.9, 0.2, '+z', 0, true);
  b.sign('무재해 412일', 'label', -2.3, 2.45, -7.594, 1.3, 0.16, '+z', 0, true);

  // ── lights: even, cold, everything working ──
  let gm: THREE.Material | undefined;
  for (const [x, z, cast] of [[-1.8, -1.6, true], [1.8, -1.6, false], [-1.8, -4.0, false], [1.8, -4.0, false], [-1.8, -6.4, false], [1.8, -6.4, true]] as const) {
    const h = troffer(b, L, { group: 'dock', x, y: H, z, axis: 'z', len: 1.2, intensity: 52, distance: 8, angle: 1.25, color: 0xe8f2f8, cast, glowMat: gm, priority: 2 });
    gm = (h as any)?.glowMat ?? gm;
  }
  L.point('dock', 0, 2.6, -4, 0xdfeaf0, 10, 8, { priority: 2 });

  // ── the polisher and the unit working it (g2_dock): a 1.6 m square of floor polished to a mirror ──
  const ux = -1.25, uz = -4.4;
  L.enemy('g2_dock', 'husk', 'dormant', ux, 0, uz, -PI / 2, 'polish', 'worker');
  b.detail(() => {
    // the same concrete, buffed to a mirror: no roughness map, a touch darker (wet sealant)
    const m = L.ctx.materials.clone('floor_concrete', { roughnessMap: null, roughness: 0.06, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.color.multiplyScalar(0.92);
    b.quad(m, ux + 1.2, 0.0015, uz + 0.1, 1.7, 1.7, '+y', 0, 'box');
  });
  b.at(ux + 1.4, 0, uz + 1.15, 0.6, () => glove(b));
  // (the unit brings its own polisher — enemies module; keep ~3 m clear ahead of it, towards +x)
  L.vignette('dock_polisher', () => { /* ambient: the worker unit's own loop (enemies 'polish' task) */ });
  L.objects.set('dock_polisher', Object.assign(new THREE.Object3D(), { name: 'dock_polisher' }));
  L.objects.get('dock_polisher')!.position.set(ux + 1, 0, uz);

  // pickups
  b.at(-3.3, 0, -7.25, 0.1, () => crate(b, 0.7, 0.5, 0.5, 'painted_dark', '반납 —\n할시온 바이오 시스템즈 사업부', false));
  b.collide(-3.65, 0, -7.5, -2.95, 0.5, -7.0);
  L.pickup('p2_dock_ammo', 'ammo_pistol', -3.35, 0.5, -7.25, 12, 0.3);

  void panel; void R;
}
