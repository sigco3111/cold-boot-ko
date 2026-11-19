/** JUNCTION 3 — x -3…3, z -20…-14, h 3.2. Signage hub; the slumped android sits against the east wall. */
import * as THREE from 'three';
import { rng } from '../builder';
import { hangingBundle } from '../ambient';
import type { LevelBuild } from '../context';
import { cableBundle, floorSlab, ibeam, pipe, trench } from '../kit';
import { bench, crate, fireExtinguisher } from '../props';
import { bulkhead, ceilingSlab, troffer, wallFace } from '../structure';

const PI = Math.PI;

export function buildJunction(L: LevelBuild) {
  const b = L.builder('junction');
  const R = rng(303);
  const H = 3.2;
  L.room('junction', '정션 3', -3, 3, -20, -14, H);

  floorSlab(b, 'floor_plate', -3, -20, 3, -14, [[-0.5, -17.5, 0.5, -16.5]], 'metal');
  trench(b, -0.5, -17.5, 0.5, -16.5, 0.4, R, true);
  // ceiling with a square opening for the ventilation shaft (fan + light above it)
  const FX = 0, FZ = -15.4, FR = 1.0;
  ceilingSlab(b, -3, -20, 3, FZ - FR, H); ceilingSlab(b, -3, FZ + FR, 3, -13.6, H);
  ceilingSlab(b, -3, FZ - FR, FX - FR, FZ + FR, H); ceilingSlab(b, FX + FR, FZ - FR, 3, FZ + FR, H);
  const SH = 2.0; // shaft height above the ceiling
  for (const s of [-1, 1]) {
    // (the shaft starts on top of the ceiling slab: no face shared with the slab's underside)
    b.box('painted_dark', FX + s * (FR + 0.1), H + 0.3 + (SH - 0.3) / 2, FZ, 0.2, SH - 0.3, 2 * FR + 0.4);
    b.box('painted_dark', FX, H + 0.3 + (SH - 0.3) / 2, FZ + s * (FR + 0.1), 2 * FR, SH - 0.3, 0.2);
  }
  b.box('painted_dark', FX, H + SH + 0.1, FZ, 2 * FR + 0.4, 0.2, 2 * FR + 0.4);
  {
    // shroud: square plate with a round hole, so light only gets past through the fan disc
    const sh = new THREE.Shape([new THREE.Vector2(-FR, -FR), new THREE.Vector2(FR, -FR), new THREE.Vector2(FR, FR), new THREE.Vector2(-FR, FR)]);
    const hole = new THREE.Path(); hole.absarc(0, 0, FR - 0.08, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 20 });
    b.geo('trim_steel', g, 'box', new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(FX, H + 0.22, FZ));
    // guard: ring + three bars under the blades (their shadows stand still while the blades' sweep)
    b.torus('trim_steel', FX, H + 0.02, FZ, FR - 0.06, 0.03, 'y', 24);
    for (let i = 0; i < 3; i++) b.rbox('trim_steel', FX, H + 0.02, FZ, 2 * FR - 0.1, 0.03, 0.035, 0, (i * Math.PI) / 3, 0);
    b.detail(() => { for (const s of [-1, 1]) { b.box('trim_steel', FX + s * (FR + 0.02), H - 0.02, FZ, 0.1, 0.05, 2 * FR + 0.14); b.box('trim_steel', FX, H - 0.02, FZ + s * (FR + 0.02), 2 * FR + 0.14, 0.05, 0.1); } });
  }
  const fb = L.part('junction:fan');
  fb.cyl('painted_dark', 0, 0, 0, 0.17, 0.2, 'y', 12);
  for (let i = 0; i < 4; i++) { fb.push(0, 0, 0, (i * Math.PI) / 2, 0, 0); fb.rbox('painted_dark', 0.53, 0, 0, 0.78, 0.02, 0.34, 0.42, 0, 0); fb.pop(); }
  const fan = fb.build(false);
  fan.position.set(FX, H + 0.45, FZ);
  for (const m of fan.children) m.castShadow = true;
  L.root.add(fan);
  L.objects.set('junction_fan', fan);
  const fanLight = L.spot('junction', FX, H + SH - 0.15, FZ, FX, 0, FZ + 0.5, 0xcfe2ff, 260, 9, 0.6, { cast: true, vol: true, priority: 3, penumbra: 0.25 });
  b.detail(() => b.box(L.glow(fanLight, 'emissive_white'), FX, H + SH - 0.02, FZ, 0.7, 0.03, 0.7));
  let fanA = 0;
  L.ambient('junction', (dt, t) => { fanA += dt * (0.85 + Math.sin(t * 0.21) * 0.12); fan.rotation.y = fanA; });
  let fanHum: { stop(f?: number): void } | null = null;
  L.updaters.push(() => { if (!fanHum && L.ctx.state === 'playing') { try { fanHum = L.ctx.audio.loop('machine_loop', { position: new THREE.Vector3(FX, H + 0.4, FZ), volume: 0.1, pitch: 0.6 }); } catch { fanHum = { stop() {} }; } } });
  // cables hanging out of the ceiling by the storage door
  hangingBundle(L, 'junction', 1.9, H - 0.02, -18.9, [{ dx: 0, dz: 0, len: 1.05 }, { dx: 0.05, dz: 0.03, len: 0.8, r: 0.01 }, { dx: -0.04, dz: 0.05, len: 1.25, r: 0.009, bow: 0.1 }], { amp: 0.05, period: 3.8 });

  wallFace(b, { n: '-z', plane: -14, from: -2.8, to: 2.8, h: H, t: 0.4, openings: [{ c: 0, w: 3.0, h: 3.0, margin: 0.1 }], seed: 11, trayY: 0 });
  wallFace(b, { n: '+z', plane: -19.8, from: -2.8, to: 2.8, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 12, trayY: 0 });
  wallFace(b, { n: '+x', plane: -2.8, from: -19.8, to: -14, h: H, t: 0.2, openings: [{ c: -17, w: 1.6, h: 2.4 }], seed: 13, features: 0.3, ext: [0, 0.2] });
  wallFace(b, { n: '-x', plane: 2.8, from: -19.8, to: -14, h: H, t: 0.2, openings: [{ c: -17, w: 1.6, h: 2.4 }], seed: 14, features: 0, ext: [0, 0.2] });

  // archway portal frame
  // (archway frame 1 cm inside the opening and under the corridor ceiling: no shared planes)
  b.box('trim_steel', -1.56, 1.5, -14.0, 0.14, 3.0, 0.5).box('trim_steel', 1.56, 1.5, -14.0, 0.14, 3.0, 0.5);
  b.box('trim_steel', 0, 3.06, -14.0, 3.3, 0.14, 0.5);
  b.detail(() => {
    for (const s of [-1, 1]) b.bx('hazard_stripes', s * 1.64 - 0.05, 0.3, -14.26, s * 1.64 + 0.05, 2.6, -14.25);
    b.bx('hazard_stripes', -1.5, -0.01, -14.3, 1.5, 0.004, -14.0);
  });

  // ── ceiling: cross of beams, ring of conduit around the sign hub ──
  ibeam(b, 'trim_steel', 'x', 0, H - 0.11, -17, 5.6, 0.14, 0.22);
  ibeam(b, 'trim_steel', 'z', 0, H - 0.11, -17.9, 2.8, 0.14, 0.22); // stops clear of d_fab_outer's rising leaf
  b.box('trim_steel', 0, H - 0.06, -18.7, 5.6, 0.12, 0.1);
  b.detail(() => {
    pipe(b, 'copper', [[-2.6, H - 0.2, -14.3], [-2.6, H - 0.2, -19.5]], 0.05, { every: 1.8 });
    pipe(b, 'steel_raw', [[2.55, H - 0.2, -14.3], [2.55, H - 0.2, -15.6], [1.7, H - 0.2, -15.6], [1.7, H - 0.2, -19.5]], 0.04, { every: 1.5 });
    cableBundle(b, [-1.2, H - 0.12, -14.2], [-1.2, H - 0.12, -16.9], 3, 0.12, 0.014, 0.05, R);
    cableBundle(b, [-1.2, H - 0.12, -17.1], [-1.2, H - 0.12, -19.6], 3, 0.1, 0.014, 0.05, R);
    cableBundle(b, [0.15, H - 0.12, -17.2], [2.6, H - 0.12, -17.2], 4, 0.14, 0.014, 0.05, R);
  });

  // ── hanging signage hub ──
  const hy = 2.62;
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.55, 0.55]) b.rod('steel_raw', sx, H - 0.2, -17 + sz, sx, hy + 0.2, -17 + sz, 0.012, 5);
  b.box('painted_dark', 0, hy, -17, 1.5, 0.44, 1.5);
  b.detail(() => {
    b.box('trim_steel', 0, hy + 0.23, -17, 1.56, 0.03, 1.56).box('trim_steel', 0, hy - 0.23, -17, 1.56, 0.03, 1.56);
    // seen arriving from the corridor (facing +Z)
    b.sign('제작 홀 3 ^', 'directional', 0, hy + 0.1, -16.25, 1.4, 0.18, '+z');
    b.sign('← 보안실 3      창고 →', 'directional', 0, hy - 0.11, -16.25, 1.4, 0.16, '+z');
    // seen coming back from the fab lock
    b.sign('의무실 3-A ^', 'directional', 0, hy + 0.1, -17.75, 1.4, 0.18, '-z');
    b.sign('← 창고      보안실 3 →', 'directional', 0, hy - 0.11, -17.75, 1.4, 0.16, '-z');
    b.sign('← 제작 홀 3    의무실 →', 'directional', 0.75, hy, -17, 1.4, 0.18, '+x');
    b.sign('← 의무실    제작 홀 3 →', 'directional', -0.75, hy, -17, 1.4, 0.18, '-x');
    b.box('emissive_cyan', 0, hy - 0.25, -17, 1.3, 0.012, 0.03).box('emissive_cyan', 0, hy - 0.25, -17, 0.03, 0.012, 1.3);
  });

  // ── lights ──
  troffer(b, L, { group: 'junction', x: 0, y: H, z: -18.7, axis: 'x', intensity: 30, distance: 6.5, angle: 1.0, flicker: 'broken' });
  L.point('junction', 0, hy - 0.5, -17, 0x60e0ff, 2.5, 4.5);
  b.at(-2.8, 0, -18.45, PI / 2, () => bulkhead(b, L, 'junction', 0, 2.2, 0.04, 0xffb070, 5, 4.5));

  // ── props: bench + crates on the west side; east wall north bay stays clear for the android ──
  b.at(-2.4, 0, -15.1, PI / 2, () => bench(b, 1.3));
  b.at(-2.35, 0, -19.2, 0.15, () => crate(b, 0.7, 0.6, 0.6, 'painted_dark', '할시온'));
  b.at(-2.4, 0.6, -19.25, -0.3, () => crate(b, 0.5, 0.35, 0.45, 'wall_panel', undefined, false));
  b.at(2.8, 0.55, -19.1, -PI / 2, () => fireExtinguisher(b));
  // android spot: oil underneath + scrape marks leading from the storage door
  b.decal('oil_stain', 2, 2.3, 0.002, -15.1, 1.2, 1.2, '+y', 0.8);
  b.decal('oil_drip', 0, 2.764, 0.5, -15.1, 0.4, 0.8, '-x');
  b.decal('scratches', 0, 2.2, 0.002, -16.0, 0.9, 1.3, '+y', 0.2);
  b.decal('scratches', 2, 2.764, 0.9, -15.0, 0.6, 0.6, '-x');

  // ── wall signs ──
  b.sign('정션 3', 'stencil', -2.764, 2.3, -15.4, 1.1, 0.24, '+x');
  b.sign('보안실 3', 'directional', -2.764, 1.75, -15.8, 0.55, 0.14, '+x', 0, true);
  b.sign('장비 창고', 'directional', 2.764, 1.75, -18.3, 0.75, 0.14, '-x', 0, true);
  b.sign('인가된 인원 — 제작 출입 록', 'warning', 2.15, 1.75, -19.764, 0.9, 0.14, '+z', 0, true);
  b.sign('이 지점 너머 비무장 구역', 'danger', -2.15, 1.75, -19.764, 0.9, 0.14, '+z', 0, true);
  b.sign('3', 'stencil', 0, 0.003, -15.4, 0.9, 1.2, '+y');
  b.decal('grime', 0, -1.6, 0.002, -18.2, 2.0, 2.0, '+y', 1.0);
  b.decal('blood_smear', 2, 0.6, 0.002, -14.6, 0.5, 1.2, '+y', -0.5);
  b.decal('blood_smear', 0, -0.9, 0.002, -16.2, 0.5, 1.4, '+y', -1.2);
  b.decal('blood_smear', 1, -2.1, 0.002, -16.9, 0.5, 1.2, '+y', -1.5);

  L.enemy('g_junction', 'husk', 'dormant', 2.3, 0, -15.1, PI / 2, 'slumped', 'watch');
}
