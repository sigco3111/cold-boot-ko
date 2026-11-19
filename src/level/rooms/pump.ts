/**
 * COOLANT PUMP ROOM 3 — x -22…-12 (clear space ends at -12.42), z -44…-32, h 4.5. West of the fab hall.
 * A sump of black water crossed by one grated walkway, two dead pumps at the far end, lagged pipe runs,
 * one failing work light. The skitters nest here; Dana Hale died here with the lock-out key.
 */
import * as THREE from 'three';
import { rng, type Builder, type Rng } from '../builder';
import type { LevelBuild } from '../context';
import { drapeGeo, hangingBundle, easeInOut, easeOut } from '../ambient';
import { cagePanel, ductRound, floorSlab, grate, handrail, hazardStrip, ibeam, pipe, valve } from '../kit';
import { crate, drum, floorCable } from '../props';
import { bulkhead, ceilingSlab, wallFace, workLight } from '../structure';

const PI = Math.PI;
const H = 4.5;
const XE = -12.42;
/** Sump footprint and the walkway across it. */
const SX0 = -19, SX1 = -14.8, SZ0 = -42, SZ1 = -34, WZ0 = -38.7, WZ1 = -37.3;
const WATER_Y = -0.22;
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

/** Seamless tangent-space normal map of small standing-water ripples. */
function rippleNormals(size = 256): THREE.CanvasTexture {
  const R = rng(4177);
  const waves: number[] = [];
  for (let i = 0; i < 12; i++) {
    const kx = R.int(-4, 4), ky = R.int(-4, 4);
    if (!kx && !ky) continue;
    waves.push(kx, ky, R.range(0, 6.3), 1 / (0.6 + Math.hypot(kx, ky)));
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(size, size), d = img.data;
  const tau = (2 * PI) / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let dx = 0, dy = 0;
    for (let i = 0; i < waves.length; i += 4) {
      const c = Math.cos((waves[i] * x + waves[i + 1] * y) * tau + waves[i + 2]) * waves[i + 3];
      dx += c * waves[i]; dy += c * waves[i + 1];
    }
    const nx = -dx * 0.16, ny = -dy * 0.16, l = 1 / Math.hypot(nx, ny, 1);
    const o = (y * size + x) * 4;
    d[o] = (nx * l * 0.5 + 0.5) * 255; d[o + 1] = (ny * l * 0.5 + 0.5) * 255; d[o + 2] = (l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.name = 'sump_ripples';
  return t;
}

/** Centrifugal pump set. Local frame: shaft along X; flywheel + belt guard at -X, volute at +X. */
function pumpSet(b: Builder, label: string, live: boolean, f: 1 | -1) {
  const face = f > 0 ? '+z' : '-z';
  b.box('floor_concrete', -0.1, 0.12, 0, 2.7, 0.24, 1.5);
  b.box('painted_dark', -0.1, 0.29, 0, 2.5, 0.1, 1.1);
  // motor with cooling fins + terminal box
  b.cyl('painted_dark', -0.6, 0.9, 0, 0.42, 0.95, 'x', 18);
  b.cyl('painted_dark', -0.1, 0.9, 0, 0.3, 0.12, 'x', 14);
  b.box('wall_panel_dark', -0.6, 1.36, 0, 0.36, 0.2, 0.3);
  b.box('painted_dark', -0.6, 0.45, 0, 0.8, 0.24, 0.7);
  // volute casing + discharge neck
  b.cyl('wall_panel_dark', 0.62, 0.9, 0, 0.62, 0.4, 'x', 22);
  b.cyl('steel_raw', 0.84, 0.9, 0, 0.3, 0.1, 'x', 16);
  b.cyl('wall_panel_dark', 0.62, 1.55, f * 0.3, 0.2, 0.5, 'y', 14);
  b.cyl('steel_raw', 0.62, 1.8, f * 0.3, 0.27, 0.05, 'y', 14);
  b.box('painted_dark', 0.62, 0.42, 0, 0.5, 0.26, 0.9);
  // flywheel, belt, small pulley — behind a mesh guard
  b.cyl('steel_raw', -1.28, 0.9, 0, 0.5, 0.09, 'x', 22);
  b.cyl('steel_raw', -1.28, 0.9, 0, 0.1, 0.2, 'x', 10);
  b.cyl('steel_raw', -1.28, 0.42, 0.42, 0.13, 0.09, 'x', 12);
  b.detail(() => {
    for (let i = 0; i < 10; i++) b.cyl('painted_dark', -1.0 + i * 0.09, 0.9, 0, 0.455, 0.02, 'x', 18);
    for (let i = 0; i < 5; i++) { b.push(-1.28, 0.9, 0, 0, (i * 2 * PI) / 5, 0); b.box('steel_raw', 0, 0.26, 0, 0.1, 0.44, 0.07); b.pop(); }
    b.rbox('rubber', -1.28, 0.98, 0.37, 0.07, 0.03, 0.9, -0.95, 0, 0); b.rbox('rubber', -1.28, 0.42, 0.14, 0.07, 0.03, 0.5, -0.32, 0, 0);
    for (let i = 0; i < 8; i++) { const a = (i * PI) / 4; b.inst('bolt', 0.84 + 0.05, 0.9 + Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0, PI / 2, 0, 2); }
    // gauge + nameplate
    b.cyl('painted_dark', 0.62, 1.42, f * 0.52, 0.07, 0.03, 'z', 12); b.cyl('plastic_white', 0.62, 1.42, f * 0.537, 0.058, 0.004, 'z', 12);
    b.rod('copper', 0.62, 1.2, f * 0.5, 0.62, 1.36, f * 0.5, 0.008, 5);
    b.sign(label, 'stencil', -0.6, 0.92, f * 0.426, 0.5, 0.26, face);
    b.sign('할시온 CP-400  2.2 MW', 'label', -0.6, 1.36, f * 0.152, 0.28, 0.05, face);
    // control box on a post
    b.box('trim_steel', 0.15, 0.75, f * 0.66, 0.05, 1.0, 0.05);
    b.box('painted_dark', 0.15, 1.3, f * 0.69, 0.3, 0.4, 0.1);
    b.inst(live ? 'led_green' : 'led_red', 0.07, 1.42, f * 0.742, 0, f > 0 ? 0 : PI, 0).inst('led_amber', 0.12, 1.42, f * 0.742, 0, f > 0 ? 0 : PI, 0);
    b.cyl('emissive_red', 0.22, 1.24, f * 0.745, 0.025, 0.02, 'z', 10);
    b.box('plastic_white', 0.1, 1.24, f * 0.742, 0.1, 0.07, 0.004);
  });
  // belt guard: yellow frame, mesh sides
  const cg = b.L.doubleSided('floor_grate');
  b.push(-1.44, 0, 0, PI / 2); cagePanel(b, cg, -0.75, 0.25, 0.75, 1.5, 0, 0.04, 'painted_yellow'); b.pop();
  for (const sz of [-0.74, 0.74]) { b.push(-1.44, 0, sz, 0); cagePanel(b, cg, 0, 0.25, 0.38, 1.5, 0, 0.04, 'painted_yellow'); b.pop(); }
  b.box('painted_yellow', -1.25, 1.52, 0, 0.42, 0.04, 1.52);
  b.collide(-1.46, 0, -0.72, 1.2, 1.6, 0.72);
}

function puddle(L: LevelBuild, b: Builder, x: number, z: number, r: number, seed: number) {
  const R = rng(seed);
  const g = new THREE.CircleGeometry(1, 18);
  const p = g.getAttribute('position');
  for (let i = 1; i < p.count; i++) { const k = 0.7 + 0.5 * R(); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  p.setXYZ(p.count - 1, p.getX(1), p.getY(1), 0);
  g.rotateX(-PI / 2);
  b.detail(() => b.geo(L.puddleMat(), g, 'box', new THREE.Matrix4().makeScale(r, 1, r * R.range(0.6, 1)).setPosition(x, 0.004, z)));
}

/** Dana Hale. Local frame: her back is against the surface at z = 0, she faces +Z, floor at y = 0. */
function hale(b: Builder, cloth: THREE.Material, hv: THREE.Material) {
  // legs: left straight out, right knee drawn up
  b.sphere(cloth, 0, 0.13, 0.2, 0.17, 10, 0.75, 1.15, 1.0);
  b.rod(cloth, -0.09, 0.11, 0.28, -0.16, 0.1, 0.74, 0.085, 8).rod(cloth, -0.16, 0.1, 0.74, -0.21, 0.085, 1.13, 0.066, 8);
  b.sphere(cloth, -0.16, 0.1, 0.74, 0.088, 8);
  b.rod(cloth, 0.1, 0.13, 0.28, 0.17, 0.43, 0.58, 0.085, 8).rod(cloth, 0.17, 0.43, 0.58, 0.21, 0.09, 0.84, 0.066, 8);
  b.sphere(cloth, 0.17, 0.43, 0.58, 0.09, 8);
  // boots
  b.rbox('rubber', -0.215, 0.11, 1.2, 0.1, 0.24, 0.12, -0.25, 0.3, 0); b.rbox('rubber', -0.235, 0.05, 1.27, 0.1, 0.1, 0.2, 0.2, 0.3, 0);
  b.rbox('rubber', 0.215, 0.07, 0.9, 0.1, 0.13, 0.26, 0.1, -0.15, 0);
  // the hi-vis jacket pulled over head and shoulders like a blanket: she is a shape under cloth, turned to the wall
  const g = drapeGeo([
    [-0.14, 0.8, 0.19, 0.14, 0.15, 0.15], [-0.06, 0.6, 0.15, 0.3, 0.15, 0.16], [-0.04, 0.38, 0.17, 0.27, 0.36, 0.18],
    [0, 0.14, 0.38, 0.27, 0.2, 0.3], [0.17, 0.24, 0.56, 0.09, 0.22, 0.1], [0.3, 0.3, 0.24, 0.08, 0.2, 0.12],
  ], -0.62, 0.58, 0, 0.9, 30, 24, 5, 0);
  b.geo(hv, g, 'box');
  // right arm out from under it, gloved hand open on the floor
  b.rod(hv, 0.3, 0.42, 0.2, 0.42, 0.2, 0.3, 0.06, 8).rod(hv, 0.42, 0.2, 0.3, 0.5, 0.06, 0.42, 0.052, 8);
  b.sphere(hv, 0.42, 0.2, 0.3, 0.062, 8);
  b.box('chrome', 0.47, 0.1, 0.375, 0.11, 0.1, 0.02);
  b.sphere('rubber', 0.54, 0.035, 0.47, 0.055, 8, 0.5, 1.15, 1.25);
  for (let i = 0; i < 4; i++) b.rbox('rubber', 0.51 + i * 0.022, 0.022, 0.545 + (i === 1 || i === 2 ? 0.012 : 0), 0.018, 0.02, 0.07, 0, -0.25 + i * 0.16, 0);
  b.rbox('rubber', 0.6, 0.022, 0.48, 0.02, 0.02, 0.06, 0, -1.0, 0);
}

export function buildPump(L: LevelBuild) {
  const b = L.builder('pump');
  const R = rng(1313);
  L.room('pump', '냉각수 펌프실 3', -22, -12, -44, -32, H, 1.3);

  // ── floor: four slabs around the sump (a real hole), concrete sump walls, wading floor ──
  floorSlab(b, 'floor_concrete', -22, -44, SX0, -32, [], 'concrete');
  floorSlab(b, 'floor_concrete', SX1, -44, -12, -32, [[-14.0, -35.2, -13.0, -34.2]], 'concrete');
  floorSlab(b, 'floor_concrete', SX0, SZ1, SX1, -32, [], 'concrete');
  floorSlab(b, 'floor_concrete', SX0, -44, SX1, SZ0, [], 'concrete');
  b.collide(SX0, -0.7, SZ0, SX1, -0.5, SZ1, 'concrete', false);
  b.detail(() => {
    // tide line + kerb around the pit
    for (const [x0, z0, x1, z1] of [[SX0 - 0.12, SZ0 - 0.12, SX1 + 0.12, SZ0], [SX0 - 0.12, SZ1, SX1 + 0.12, SZ1 + 0.12], [SX0 - 0.12, SZ0, SX0, SZ1], [SX1, SZ0, SX1 + 0.12, SZ1]]) b.bx('hazard_stripes', x0, -0.01, z0, x1, 0.012, z1);
  });
  ceilingSlab(b, -22.2, -44.2, -12.4, -31.8, H);
  wallFace(b, { n: '-x', plane: XE, from: -44, to: -32, h: H, t: 0.03, openings: [{ c: -38, w: 1.6, h: 2.4 }], style: 'dark', seed: 91, trayY: 3.4, features: 0, clear: [[-37, -35]] });
  wallFace(b, { n: '+x', plane: -22, from: -44, to: -32, h: H, style: 'dark', seed: 92, trayY: 0, features: 0.3, bay: 3 });
  wallFace(b, { n: '+z', plane: -44, from: -22, to: XE, h: H, style: 'dark', seed: 93, trayY: 0, features: 0.25 });
  wallFace(b, { n: '-z', plane: -32, from: -22, to: XE, h: H, style: 'dark', seed: 94, trayY: 0, features: 0 });
  for (const x of [-19.7, -16.9, -14.2]) ibeam(b, 'trim_steel', 'z', x, H - 0.14, -38, 12, 0.16, 0.28);

  // ── the water ──
  const ripples = rippleNormals();
  ripples.repeat.set((SX1 - SX0) / 2.6, (SZ1 - SZ0) / 2.6);
  const waterMat = L.ctx.materials.clone('painted_dark', { color: 0x070b0c, roughness: 0.09, metalness: 0.55, map: null, normalMap: ripples, roughnessMap: null, metalnessMap: null, aoMap: null });
  waterMat.normalScale.set(0.3, 0.3);
  waterMat.name = 'sump_water';
  const NXW = 28, NZW = 52;
  const waterGeo = new THREE.PlaneGeometry(SX1 - SX0, SZ1 - SZ0, NXW, NZW);
  waterGeo.rotateX(-PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.name = 'pump_water';
  water.position.set((SX0 + SX1) / 2, WATER_Y, (SZ0 + SZ1) / 2);
  water.receiveShadow = true;
  L.root.add(water);
  L.objects.set('pump_water', water);
  L.ambient('pump', (_dt, t) => {
    // no flow: the surface just works — a slow drift with a circular wobble on top
    ripples.offset.set(t * 0.006 + Math.sin(t * 0.31) * 0.035, t * 0.004 + Math.cos(t * 0.27) * 0.035);
    waterMat.normalScale.setScalar(0.3 + Math.sin(t * 0.5) * 0.07);
  });

  // ── walkway across the sump + rails everywhere a foot could go over the edge ──
  grate(b, SX0, WZ0, SX1, WZ1, 0, 1.05);
  for (const z of [WZ0 + 0.04, WZ1 - 0.04]) ibeam(b, 'trim_steel', 'x', (SX0 + SX1) / 2, -0.12, z, SX1 - SX0, 0.1, 0.2);
  b.detail(() => { for (const x of [-17.6, -16.2]) for (const z of [WZ0 + 0.04, WZ1 - 0.04]) b.box('trim_steel', x, -0.45, z, 0.08, 0.5, 0.08); });
  b.collide(SX0, -0.1, WZ0, SX1, 0, WZ1, 'metal', false);
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    handrail(b, 'painted_yellow', [[x0, 0, z0], [x1, 0, z1]], 1.05, 1.2);
    b.collide(Math.min(x0, x1) - 0.03, 0, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, 0.56, Math.max(z0, z1) + 0.03, 'metal');
  };
  rail(SX0, WZ0, SX1, WZ0); rail(SX0, WZ1, SX1, WZ1);
  rail(SX0, SZ0, SX0, WZ0); rail(SX0, WZ1, SX0, SZ1);
  rail(SX0, SZ1, SX1, SZ1); rail(SX0, SZ0, SX1, SZ0);
  rail(SX1, SZ0 + 0.9, SX1, WZ0); rail(SX1, WZ1, SX1, SZ1 - 0.9);
  // service steps down into each half (the way back out if you go in)
  for (const zc of [SZ1 - 0.45, SZ0 + 0.45]) {
    b.push(SX1, 0, zc, 0, 0, 0.427); b.collide(-1.22, -0.1, -0.42, 0, 0, 0.42, 'metal', false); b.pop();
    for (let i = 0; i < 4; i++) b.box('trim_steel', SX1 - 0.16 - i * 0.29, -0.06 - i * 0.132, zc, 0.3, 0.03, 0.82);
    b.detail(() => { for (const s of [-1, 1]) b.rbox('painted_yellow', SX1 - 0.6, -0.3, zc + s * 0.42, 1.3, 0.14, 0.03, 0, 0, 0.427); hazardStrip(b, SX1 + 0.12, zc - 0.45, SX1 + 0.3, zc + 0.45); });
  }
  L.obstacles.push(new THREE.Box3(new THREE.Vector3(SX0, 0, SZ0), new THREE.Vector3(SX1, 1, WZ0)), new THREE.Box3(new THREE.Vector3(SX0, 0, WZ1), new THREE.Vector3(SX1, 1, SZ1)));
  for (const x of [-15.5, -16.9, -18.3]) L.navNode(x, -38, 'pump');
  for (const x of [-15.5, -17, -18.5]) { L.navNode(x, -33, 'pump'); L.navNode(x, -43, 'pump'); }
  for (const z of [-41, -39.5, -36.5, -35]) L.navNode(-19.55, z, 'pump');

  // ── the two pumps on the west platform (flywheel ends face the landing) ──
  const P1 = { x: -20.9, z: -35.3 }, P2 = { x: -20.9, z: -40.7 };
  let d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  b.at(P1.x, 0, P1.z, -PI / 2, () => { pumpSet(b, 'P1', false, -1); d1 = b.world(0.62, 1.82, -0.3); });
  b.at(P2.x, 0, P2.z, PI / 2, () => { pumpSet(b, 'P2', false, 1); d2 = b.world(0.62, 1.82, 0.3); });
  L.point('pump', -20.0, 1.35, -35.2, 0xff3018, 0.9, 2.4, { flicker: 'pulse' });
  L.point('pump', -20.0, 1.35, -40.8, 0xffa030, 0.7, 2.2);

  // ── pipework ──
  // discharge risers → header near the ceiling (the skitter's perch) → east wall
  const HX = -19.7, HY = 3.6;
  pipe(b, 'steel_raw', [[d1.x, d1.y, d1.z], [d1.x, HY, d1.z], [HX, HY, d1.z]], 0.17, { every: 1.2 });
  pipe(b, 'steel_raw', [[d2.x, d2.y, d2.z], [d2.x, HY, d2.z], [HX, HY, d2.z]], 0.17, { every: 1.2 });
  ductRound(b, 'painted_white', 'z', HX, HY, -38, 6.6, 0.21, 0.82, 14);
  ductRound(b, 'painted_white', 'x', -16.0, HY, -34.6, 7.2, 0.21, 0.9, 14);
  b.sphere('painted_white', HX, HY, -34.6, 0.26, 12); b.sphere('painted_white', HX, HY, -41.4, 0.26, 12);
  b.detail(() => {
    for (const z of [-40.4, -38.9, -37.1, -35.6]) { b.rod('steel_raw', HX - 0.22, HY, z, HX - 0.22, H - 0.28, z, 0.01, 4); b.rod('steel_raw', HX + 0.22, HY, z, HX + 0.22, H - 0.28, z, 0.01, 4); b.box('steel_raw', HX, HY - 0.23, z, 0.5, 0.03, 0.05); }
    for (const x of [-18.2, -16.6, -15.0, -13.4]) { b.rod('steel_raw', x, HY + 0.2, -34.6, x, H - 0.28, -34.6, 0.012, 4); b.torus('steel_raw', x, HY, -34.6, 0.225, 0.012, 'x', 12); }
    valve(b, HX, HY, -36.3, 'z', 0.2, 'x', 1);
  });
  // suction legs: out of each volute, under the mid rail, down into the water
  for (const p of [P1, P2]) {
    const zs = p === P1 ? p.z + 0.62 : p.z - 0.62;
    pipe(b, 'steel_raw', [[-20.25, 0.9, zs], [-19.8, 0.9, zs], [-19.8, 0.3, zs], [-18.5, 0.3, zs], [-18.5, -0.6, zs]], 0.14, { every: 0 });
    b.collide(-19.95, 0, zs - 0.16, -19.0, 0.46, zs + 0.16);
  }
  // the long lagged run on the north wall (this is the one that knocks) + a thinner one on the south wall
  const KZ = -32.5, KY = 2.5;
  ductRound(b, 'painted_white', 'x', -17.2, KY, KZ, 9.5, 0.2, 0.95, 14);
  ductRound(b, 'painted_white', 'x', -17.2, 3.05, -43.55, 9.5, 0.15, 1.1, 12);
  pipe(b, 'copper', [[-21.9, 2.7, -43.7], [XE - 0.1, 2.7, -43.7]], 0.045, { every: 1.9 });
  pipe(b, 'copper', [[-21.9, 2.05, -32.2], [XE - 0.1, 2.05, -32.2]], 0.04, { every: 1.9 });
  b.detail(() => {
    for (let x = -21; x < -12.8; x += 1.6) { b.box('steel_raw', x, 2.86, -43.72, 0.05, 0.5, 0.05); b.box('steel_raw', x, 2.86, -43.62, 0.05, 0.04, 0.3); }
    b.decal('water_stain', 1, -16.4, 1.4, -32.036, 0.9, 2.0, '-z'); b.decal('water_stain', 3, -19.3, 1.3, -32.036, 0.8, 1.9, '-z');
    b.decal('water_stain', 0, -21.964, 1.3, -38.6, 0.9, 2.2, '+x'); b.decal('water_stain', 2, -15.2, 1.5, -43.964, 0.8, 2.0, '+z');
  });
  // brackets of the knocking run: instanced so each can be shaken
  const bk = L.part('pump:bracket');
  bk.torus('trim_steel', 0, 0, 0, 0.214, 0.014, 'x', 14);
  bk.box('trim_steel', 0, -0.02, 0.33, 0.05, 0.05, 0.28).box('trim_steel', 0, -0.17, 0.42, 0.05, 0.3, 0.05).box('trim_steel', 0, 0.0, 0.485, 0.16, 0.5, 0.02);
  const BK: number[] = [];
  for (let x = -21.3; x < -12.6; x += 1.42) BK.push(x);
  const brackets = new THREE.InstancedMesh(bk.bake(), L.ctx.materials.get('trim_steel'), BK.length);
  brackets.name = 'pump:brackets';
  const bkShake = new Float32Array(BK.length).fill(9);
  const writeBracket = (i: number) => {
    const t = bkShake[i], k = t < 0.7 ? Math.exp(-t * 7) * Math.sin(t * 58) : 0;
    _q.setFromEuler(_e.set(k * 0.12, 0, k * 0.05));
    brackets.setMatrixAt(i, _m.compose(_v.set(BK[i], KY - k * 0.022, KZ + k * 0.006), _q, _s));
  };
  for (let i = 0; i < BK.length; i++) writeBracket(i);
  brackets.computeBoundingSphere(); brackets.computeBoundingBox();
  L.root.add(brackets);
  L.vignette('pump_knock', () => {
    const pl = L.ctx.player?.position;
    const fromWest = !pl || pl.x > -17.2;
    const fx = L.ctx.fx;
    let delay = 0;
    for (let n = 0; n < BK.length; n++) {
      const i = fromWest ? n : BK.length - 1 - n;
      const last = n === BK.length - 1;
      L.after(delay, () => {
        bkShake[i] = 0;
        L.sfx('pipe_knock', BK[i], KY, KZ, last ? 1 : 0.55 + n * 0.06);
        fx.smoke(_v.set(BK[i], KY - 0.25, KZ + 0.05), { count: 2, size: 0.16, color: 0x9a9d98, rise: -0.25, life: 1.4 });
      });
      // it comes in a walking rhythm, hesitates one beat before the last
      delay += last ? 0 : n === BK.length - 2 ? 1.05 : 0.5 - n * 0.025;
    }
    let t = 0;
    L.sim((dt) => {
      t += dt;
      for (let i = 0; i < BK.length; i++) if (bkShake[i] < 0.75) { bkShake[i] += dt; writeBracket(i); }
      brackets.instanceMatrix.needsUpdate = true;
      return t < delay + 1.5;
    });
  });

  // the valve that turns by itself: riser by the door, hand wheel at chest height facing the room
  const VX = -13.75, VZ = -32.62;
  pipe(b, 'steel_raw', [[VX, 0.02, VZ], [VX, KY - 0.1, VZ]], 0.09, { every: 0 });
  b.sphere('steel_raw', VX, 1.3, VZ, 0.17, 10);
  b.cyl('steel_raw', VX, 1.3, VZ + 0.2, 0.04, 0.4, 'z', 8);
  b.collide(VX - 0.15, 0, VZ - 0.15, VX + 0.15, 2.4, VZ + 0.2);
  const wb = L.part('pump:valve_wheel');
  wb.torus('painted_orange', 0, 0, 0, 0.21, 0.02, 'z', 18);
  wb.box('painted_orange', 0, 0, 0, 0.42, 0.03, 0.02).box('painted_orange', 0, 0, 0, 0.03, 0.42, 0.02);
  wb.cyl('painted_orange', 0, 0, 0, 0.04, 0.05, 'z', 8);
  const wheel = wb.build(false);
  wheel.position.set(VX, 1.3, VZ + 0.4);
  for (const m of wheel.children) m.castShadow = false;
  L.root.add(wheel);
  L.objects.set('pump_valve', wheel);
  let vWait = 7, vFrom = 0, vTo = 0, vT = 1, vAng = 0;
  L.ambient('pump', (dt) => {
    if (vT < 1) {
      vT = Math.min(1, vT + dt / 1.6);
      // sticks, gives, creeps to a stop
      vAng = vFrom + (vTo - vFrom) * (vT < 0.15 ? 0 : easeOut((vT - 0.15) / 0.85));
      wheel.rotation.z = vAng + (vT < 0.15 ? Math.sin(vT * 300) * 0.006 : 0);
      return;
    }
    vWait -= dt;
    if (vWait > 0) return;
    vWait = 9 + R() * 14;
    vFrom = vAng; vTo = vAng + (R.chance(0.75) ? 1 : -1) * R.range(0.12, 0.45); vT = 0;
    L.sfx('metal_groan', VX, 1.3, VZ + 0.4, 0.16, 1.9);
  });

  // ── east apron: door, control cabinet, the sump overflow grate the skitters come out of ──
  b.at(XE, 0, -36.0, -PI / 2, () => {
    b.box('wall_panel_dark', 0, 1.3, 0.12, 0.9, 1.3, 0.24);
    b.detail(() => {
      b.box('trim_steel', 0, 1.97, 0.12, 0.94, 0.04, 0.28);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) b.inst(c === 1 ? 'led_amber' : 'led_red', -0.3 + c * 0.15, 1.7 - r * 0.08, 0.243);
      b.box('screen_off', 0, 1.35, 0.243, 0.6, 0.3, 0.004);
      for (let c = 0; c < 4; c++) { b.box('plastic_dark', -0.27 + c * 0.18, 0.95, 0.25, 0.1, 0.16, 0.03); b.box('painted_white', -0.27 + c * 0.18, 0.99, 0.275, 0.03, 0.05, 0.02); }
      b.sign('냉각수 루프 3 — P1 / P2', 'label', 0, 1.88, 0.243, 0.6, 0.07, '+z');
      b.sign('주 전원 없음', 'danger', 0, 1.15, 0.243, 0.5, 0.09, '+z');
      for (const s of [-0.3, 0.3]) b.rod('rubber', s, 1.95, 0.1, s, 3.4, 0.1, 0.02, 5);
    });
  });
  b.at(XE, 0, -39.9, -PI / 2, () => bulkhead(b, L, 'pump', 0, 2.35, 0.03, 0xff3a20, 1.6, 4, 'emissive_red'));
  // overflow pit + hinged grate (flips open when the nest empties out through it)
  const GX0 = -14.0, GZ0 = -35.2, GX1 = -13.0, GZ1 = -34.2;
  b.detail(() => {
    b.bx('painted_dark', GX0 - 0.02, -0.5, GZ0 - 0.02, GX1 + 0.02, -0.45, GZ1 + 0.02);
    b.bx('screen_off', GX0, -0.449, GZ0, GX1, -0.445, GZ1);
    pipe(b, 'steel_raw', [[GX0, -0.3, -34.7], [GX1, -0.3, -34.7]], 0.09, { flanges: false });
    hazardStrip(b, GX0 - 0.1, GZ0 - 0.1, GX1 + 0.1, GZ0); hazardStrip(b, GX0 - 0.1, GZ1, GX1 + 0.1, GZ1 + 0.1);
  });
  const hb = L.part('pump:hatch');
  grate(hb, GX0 - GX0, GZ0 - GZ1, GX1 - GX0, 0, 0, 0.5);
  const hatch = hb.build(false);
  hatch.position.set(GX0, 0.012, GZ1);
  for (const m of hatch.children) m.castShadow = false;
  L.root.add(hatch);
  L.objects.set('pump_hatch', hatch);
  L.ctx.physics.addMover?.(hatch); // REVISION 5.2: decals on the grate flip over with it
  let hatchOpen = false;
  L.ctx.events.on('enemy:spawned', (e) => {
    if (hatchOpen || e.type !== 'skitter' || Math.abs(e.position.x - (GX0 + 0.5)) > 1.4 || Math.abs(e.position.z - (GZ0 + 0.5)) > 1.4) return;
    hatchOpen = true;
    // thrown open from below: over the top, slams flat on the far side, bounces once
    let a = 0, v = 9.5, t = 0, hits = 0;
    L.sfx('metal_clang', GX0 + 0.5, 0.1, GZ0 + 0.5, 0.9, 0.8);
    L.sim((dt) => {
      t += dt;
      v += (a < PI / 2 ? -4 : 9) * dt;
      a += v * dt;
      if (a >= PI - 0.02) {
        a = PI - 0.02;
        if (v > 1.2 && hits < 3) { L.sfx('metal_clang', GX0 + 0.5, 0.05, GZ1 + 0.6, 0.8 / (1 + hits), 1.1); L.ctx.fx.smoke(_v.set(GX0 + 0.5, 0.05, GZ1 + 0.6), { count: 3, size: 0.25, color: 0x77797a, life: 1 }); hits++; v = -v * 0.28; } else v = 0;
      }
      hatch.rotation.x = a;
      return t < 4 && !(a >= PI - 0.021 && v === 0);
    });
  });
  L.enemy('g_pump_b', 'skitter', 'spawn', -13.3, 0.05, -34.5, PI / 2);
  L.enemy('g_pump_b', 'skitter', 'spawn', -13.7, 0.05, -34.9, PI / 2);
  // the one on the pipe: straight above the far landing
  L.enemy('g_pump_a', 'skitter', 'spawn', HX, HY + 0.28, -38.0, -PI / 2);

  // stock by the door (kept well clear of the rails)
  b.at(-13.0, 0, -42.9, 0, () => drum(b, 'painted_yellow')); b.at(-13.6, 0, -43.3, 0, () => drum(b)); b.at(-12.95, 0, -43.55, 0, () => drum(b));
  b.at(-13.2, 0, -41.3, 0.2, () => crate(b, 0.9, 0.6, 0.7, 'wall_panel_dark', '글리콜'));
  floorCable(b, [[-12.7, -36.4], [-13.4, -36.9], [-14.2, -36.7], [-14.6, -37.0]], 0.03);

  // ── Dana Hale, against the belt guard of P2 ──
  const cloth = L.ctx.materials.clone('fabric', { color: 0x262b33 }); cloth.name = 'hale_cloth';
  const hv = L.ctx.materials.clone('fabric', { color: 0xa9a31c, side: THREE.DoubleSide }); hv.name = 'hale_hivis';
  const HAX = -21.0, HAZ = P2.z + 1.47, HRY = -0.22;
  const wp = { rec: new THREE.Vector3(), key: new THREE.Vector3(), gun: new THREE.Vector3(), torch: new THREE.Vector3(), aim: new THREE.Vector3() };
  b.at(HAX, 0, HAZ, HRY, () => {
    hale(b, cloth, hv);
    b.detail(() => {
      // recorder by her hand; hard hat rolled away; the torch she was reading by
      b.box('plastic_dark', 0.7, 0.017, 0.66, 0.065, 0.034, 0.115);
      b.box('steel_raw', 0.7, 0.036, 0.69, 0.045, 0.004, 0.04);
      b.inst('led_red', 0.7, 0.036, 0.625, -PI / 2, 0, 0, 0.8);
      b.sphere('painted_white', -0.62, 0.075, 1.05, 0.135, 10, 0.78); b.cyl('painted_white', -0.62, 0.015, 1.12, 0.15, 0.02, 'y', 12);
      b.push(0.86, 0.035, 1.05, 0.8); b.cyl('painted_yellow', 0, 0, 0, 0.03, 0.17, 'z', 8); b.cyl('painted_dark', 0, 0, -0.1, 0.04, 0.05, 'z', 10); b.pop();
    });
    b.world(0.7, 0.05, 0.66, wp.rec); b.world(0.58, 0.02, 0.33, wp.key); b.world(-0.5, 0.03, 0.66, wp.gun);
    b.push(0.86, 0.035, 1.05, 0.8); b.world(0, 0, -0.13, wp.torch); b.world(0, 0.12, -1.6, wp.aim); b.pop();
  });
  b.decal('blood_pool', 1, HAX - 0.1, 0.003, HAZ + 0.35, 1.1, 0.9, '+y', 0.6);
  b.decal('blood_smear', 0, HAX - 0.15, 0.55, HAZ + 0.012, 0.5, 0.7, '+z', 0.1);
  L.interact('log_pump', 'log', '녹음 재생', wp.rec.x, wp.rec.y, wp.rec.z, true, 2.3);
  L.point('pump', wp.rec.x, 0.12, wp.rec.z, 0xff2010, 0.35, 1.2, { flicker: 'pulse' });
  L.pickup('p_lockout_key', 'keycard', wp.key.x, wp.key.y, wp.key.z, 1, 0.6);
  L.pickup('p_shotgun', 'shotgun', wp.gun.x, wp.gun.y, wp.gun.z, 6, HRY + 0.2);
  const torch = L.spot('pump', wp.torch.x, wp.torch.y + 0.03, wp.torch.z, wp.aim.x, wp.aim.y, wp.aim.z, 0xffe2b8, 9, 3.2, 0.5, { flicker: 'pulse', penumbra: 0.8 });
  b.detail(() => b.sphere(L.glow(torch, 'emissive_warm', 0.8), wp.torch.x, wp.torch.y, wp.torch.z, 0.022, 6));

  // ── light: one tripod lamp at the far end, dying, aimed back along the walkway at the door ──
  const aim = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));
  const wl = workLight(b, L, 'pump', -21.3, -37.3, aim(-21.3, -37.3, -13, -38.3), { intensity: 190, distance: 13, angle: 0.62, cast: true, vol: true, pitch: 0.13, height: 1.6 });
  // failing, not dead: it holds for a few seconds, browns out, stutters, catches again
  let wlWait = 3, wlOut = 0, wlLvl = 1;
  L.ambient('pump', (dt, t) => {
    if (wlOut > 0) { wlOut -= dt; wlLvl = Math.sin(t * 61) > 0.55 ? 0.5 : 0.03; }
    else {
      wlLvl += (0.92 + Math.sin(t * 2.3) * 0.06 + Math.sin(t * 17) * 0.03 - wlLvl) * Math.min(1, dt * 6);
      wlWait -= dt;
      if (wlWait <= 0) { wlWait = 2.5 + Math.random() * 6; wlOut = Math.random() < 0.3 ? 0.9 + Math.random() * 0.9 : 0.12 + Math.random() * 0.3; }
    }
    wl.intensityScale = wlLvl;
  });
  floorCable(b, [[-21.45, -37.1], [-21.7, -36.6], [-21.8, -35.9]], 0.02);

  // ── chain hoist over the north pool: sways, and its shadow sways with it ──
  b.detail(() => { b.box('painted_yellow', -16.9, H - 0.4, -36.0, 0.5, 0.3, 0.36); b.rod('trim_steel', -16.9, H - 0.25, -36.0, -16.9, H - 0.28, -36.0, 0.03, 6); });
  hangingBundle(L, 'pump', -16.9, H - 0.55, -36.0, [{ dx: -0.04, dz: 0, len: 2.25, r: 0.012, bow: 0.01 }, { dx: 0.04, dz: 0, len: 2.25, r: 0.012, bow: 0.01 }, { dx: 0.16, dz: 0.05, len: 2.9, r: 0.009, bow: 0.12 }], {
    mat: 'steel_raw', amp: 0.03, period: 5.2, cast: true,
    weight: (w) => { w.box('steel_raw', 0, -2.33, 0, 0.16, 0.2, 0.08); w.torus('steel_raw', 0, -2.52, 0, 0.07, 0.018, 'z', 10); },
  });

  // ── signs, wet, fx ──
  b.sign('냉각수 펌프실 3', 'stencil', -21.964, 3.2, -38, 4.2, 0.5, '+x');
  b.sign('섬프 3 — 수심 4.5 m — 대기자 없이 진입 금지', 'danger', -15.2, 0.8, -33.96, 1.2, 0.16, '-z', 0, true);
  b.sign('밀폐 공간', 'warning', XE - 0.036, 1.8, -40.6, 0.7, 0.14, '-x', 0, true);
  b.sign('그레이팅 위에 물건 두지 마세요', 'stencil', -13.6, 0.004, -38, 1.5, 0.26, '+y', PI / 2);
  for (const [x, z, r, sd] of [[-13.5, -39.6, 0.9, 1], [-20.2, -38.4, 1.0, 2], [-16.6, -32.9, 0.8, 3], [-17.9, -43.0, 0.9, 4], [-13.4, -33.4, 0.6, 5], [-21.2, -43.1, 0.7, 6]] as const) puddle(L, b, x, z, r, sd);
  b.decal('grime', 2, -13.5, 0.003, -38, 2.2, 3, '+y', 0.4);
  b.decal('oil_stain', 1, -20.6, 0.003, -36.9, 1.4, 1.2, '+y', 1.0);
  b.decal('grime', 0, -20.6, 0.003, -41.5, 2.4, 2.4, '+y', 2.0);
  const fx = L.ctx.fx;
  fx.emitter('steam', L.vec(-16.3, KY - 0.1, KZ + 0.15), L.vec(0.2, -0.5, 1), 40);
  fx.emitter('steam', L.vec(HX, HY - 0.2, -40.9), L.vec(0.6, -1, 0.3), 30);
  fx.emitter('drip', L.vec(-17.4, HY - 0.3, -37.9), L.vec(0, -1, 0), 1.3);
  fx.emitter('drip', L.vec(-20.3, HY - 0.25, -37.3), L.vec(0, -1, 0), 0.9);
  fx.emitter('drip', L.vec(-13.4, KY - 0.22, KZ + 0.05), L.vec(0, -1, 0), 1.1);
  fx.emitter('drip', L.vec(-17.9, 2.9, -43.5), L.vec(0, -1, 0), 0.7);
  fx.emitter('dust', L.vec(-17, 1.4, -38), L.vec(3, 1.4, 3), 5);

  // ── pump_bubbles: something long passes under the walkway ──
  const wPos = waterGeo.getAttribute('position') as THREE.BufferAttribute;
  const wNor = waterGeo.getAttribute('normal') as THREE.BufferAttribute;
  const halfX = (SX1 - SX0) / 2, halfZ = (SZ1 - SZ0) / 2;
  L.vignette('pump_bubbles', () => {
    const pl = L.ctx.player?.position;
    // cross under the walkway a little ahead of wherever the player is standing on it
    const lx = Math.max(-halfX + 0.9, Math.min(halfX - 0.9, (pl && pl.x > SX0 && pl.x < SX1 ? pl.x - 0.9 : -16.6) - (SX0 + SX1) / 2));
    const fromNorth = !pl || pl.z < -38;
    const z0 = fromNorth ? halfZ - 0.3 : -halfZ + 0.3, z1 = -z0;
    const DUR = 5.2, SETTLE = 3.0;
    let t = 0, lastPuff = 0, under = false;
    const wx = (SX0 + SX1) / 2, wz = (SZ0 + SZ1) / 2;
    L.sfx('water_slosh', wx + lx, WATER_Y, wz + z0, 0.7, 0.9);
    L.sim((dt) => {
      t += dt;
      const k = Math.min(1, t / DUR);
      // glides, almost stops under the grating, moves on
      const e = k < 0.45 ? easeOut(k / 0.45) * 0.47 : k < 0.6 ? 0.47 + (k - 0.45) * 0.4 : 0.53 + easeInOut((k - 0.6) / 0.4) * 0.47;
      const hz = z0 + (z1 - z0) * e, dir = Math.sign(z1 - z0);
      const amp = t < DUR ? Math.min(1, t / 0.6) : Math.max(0, 1 - (t - DUR) / SETTLE);
      for (let i = 0; i < wPos.count; i++) {
        const x = wPos.getX(i) - lx, z = (wPos.getZ(i) - hz) * dir; // z > 0 = ahead of it
        // bow hump + a V of wake behind + rings left where it has been
        const r2 = x * x * 2.2 + z * z * 0.55;
        let h = 0.085 * Math.exp(-r2 * 1.6);
        if (z < 0) { const arm = Math.abs(x) + z * 0.5; h += 0.04 * Math.exp(-arm * arm * 7) * Math.exp(z * 0.5) * Math.cos(z * 9 - t * 6); }
        h += 0.014 * Math.exp(-(x * x) * 0.8) * Math.sin(z * 5 + t * 4) * Math.exp(-Math.abs(z) * 0.35);
        wPos.setY(i, h * amp);
      }
      wPos.needsUpdate = true;
      waterGeo.computeVertexNormals();
      wNor.needsUpdate = true;
      if (t < DUR && t - lastPuff > 0.28) {
        lastPuff = t;
        L.ctx.fx.smoke(_v.set(wx + lx + (Math.random() - 0.5) * 0.3, WATER_Y + 0.03, wz + hz - dir * 0.3), { count: 2, size: 0.1, color: 0x8fa3a0, rise: 0.05, life: 0.5 });
      }
      if (!under && Math.abs(wz + hz + 38) < 0.5) { under = true; L.sfx('water_slosh', wx + lx, WATER_Y, -38, 1, 0.75); }
      if (t >= DUR + SETTLE) {
        for (let i = 0; i < wPos.count; i++) wPos.setY(i, 0);
        wPos.needsUpdate = true; waterGeo.computeVertexNormals(); wNor.needsUpdate = true;
        return false;
      }
      return true;
    });
  });
}
