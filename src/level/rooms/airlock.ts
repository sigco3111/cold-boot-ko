/** FAB ACCESS LOCK — x -2…2, z -26…-20, h 3.2. Decon lock: grated floor, nozzle arrays, beacons. */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { floorSlab, hazardStrip, louvre, pipe, trench, valve } from '../kit';
import { beacon, ceilingSlab, wallFace } from '../structure';

const PI = Math.PI;

export function buildAirlock(L: LevelBuild) {
  const b = L.builder('airlock');
  const R = rng(606);
  const H = 3.2, Z0 = -25.8, Z1 = -20.2;
  L.room('airlock', '제작 출입 록', -2, 2, -26, -20, H);

  floorSlab(b, 'floor_plate', -2.4, -26, 2.4, -20, [[-1.3, -25.1, 1.3, -20.9]], 'metal');
  trench(b, -1.3, -25.1, 1.3, -20.9, 0.55, R, true);
  hazardStrip(b, -1.55, -25.1, -1.3, -20.9); hazardStrip(b, 1.3, -25.1, 1.55, -20.9);
  ceilingSlab(b, -2.4, -26, 2.4, -20, H);

  wallFace(b, { n: '-z', plane: Z1, from: -2, to: 2, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 41, trayY: 0, style: 'ribbed' });
  wallFace(b, { n: '+z', plane: Z0, from: -2, to: 2, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 42, trayY: 0, style: 'ribbed' });
  wallFace(b, { n: '+x', plane: -2, from: Z0, to: Z1, h: H, seed: 43, trayY: 0, style: 'ribbed', bay: 1.4, features: 0 });
  wallFace(b, { n: '-x', plane: 2, from: Z0, to: Z1, h: H, seed: 44, trayY: 0, style: 'ribbed', bay: 1.4, features: 0 });

  // ── decon hoops: pipe arches with nozzles at every pilaster ──
  const n = 4, step = (Z1 - Z0) / n;
  for (let i = 0; i <= n; i++) {
    const z = Z0 + i * step + (i === 0 ? 0.12 : i === n ? -0.12 : 0);
    b.detail(() => {
      pipe(b, 'chrome', [[-1.82, 0.3, z], [-1.82, H - 0.22, z], [1.82, H - 0.22, z], [1.82, 0.3, z]], 0.03, { flanges: false, elbow: 1.3 });
      for (let y = 0.6; y < 2.7; y += 0.42) for (const s of [-1, 1]) {
        b.cyl('brass', s * 1.76, y, z, 0.022, 0.08, 'x', 6);
        b.cyl('brass', s * 1.71, y, z, 0.03, 0.02, 'x', 8);
      }
      for (let x = -1.4; x <= 1.41; x += 0.56) { b.cyl('brass', x, H - 0.28, z, 0.022, 0.08, 'y', 6); b.cyl('brass', x, H - 0.33, z, 0.03, 0.02, 'y', 8); }
    });
  }
  // feed manifold along the ceiling + valves on the left wall
  pipe(b, 'steel_raw', [[-1.5, H - 0.12, Z0 + 0.1], [-1.5, H - 0.12, Z1 - 0.1]], 0.05, { every: 1.4 });
  pipe(b, 'copper', [[1.5, H - 0.12, Z0 + 0.1], [1.5, H - 0.12, Z1 - 0.1]], 0.04, { every: 1.4 });
  b.detail(() => {
    valve(b, -1.5, H - 0.12, -23, 'z', 0.05, 'y', -1);
    // big extraction fan grille in the ceiling
    b.cyl('painted_dark', 0, H - 0.03, -23, 0.62, 0.06, 'y', 20);
    b.torus('trim_steel', 0, H - 0.07, -23, 0.6, 0.035, 'y', 20);
    for (let i = 0; i < 6; i++) b.rbox('trim_steel', 0, H - 0.08, -23, 1.16, 0.02, 0.05, 0, (i * PI) / 6, 0);
    b.cyl('trim_steel', 0, H - 0.09, -23, 0.12, 0.05, 'y', 10);
    // control box + status
    b.at(2, 0, -21.6, -PI / 2, () => {
      b.box('painted_dark', 0, 1.4, 0.07, 0.4, 0.55, 0.1);
      b.box('emissive_amber', -0.1, 1.55, 0.125, 0.06, 0.06, 0.01).box('emissive_red', 0.05, 1.55, 0.125, 0.06, 0.06, 0.01);
      b.box('steel_raw', 0, 1.3, 0.13, 0.2, 0.12, 0.02);
      louvre(b, -0.5, 0.35, 0.5, 0.95, 0.075, 0.04);
    });
    b.at(-2, 0, -24.4, PI / 2, () => louvre(b, -0.5, 0.35, 0.5, 0.95, 0.075, 0.04));
  });

  // ── lights: one hard overhead key through the fan grille, cold strips, an amber beacon turning ──
  L.spot('airlock', 0, H - 0.12, -23, 0, 0, -23, 0xc6ecff, 70, 6, 0.95, { cast: true, vol: true, priority: 2, flicker: 'fluorescent' });
  for (const [x, z] of [[-1.9, -21.2], [1.9, -24.8]] as const) {
    const h = L.point('airlock', x * 0.9, 1.5, z, 0x7fe4ff, 4, 3.5);
    b.detail(() => { b.box('painted_dark', x, 1.5, z, 0.08, 1.5, 0.1); b.box(L.glow(h, 'emissive_cyan'), x * 0.975, 1.5, z, 0.02, 1.4, 0.05); });
  }
  const beacons = [beacon(b, L, 'airlock', 1.6, H, -20.6, -1, 0xff9a20, 14, 6, 'emissive_amber', true, 'alarm'),
    beacon(b, L, 'airlock', -1.6, H, -25.4, -1, 0xff9a20, 14, 6, 'emissive_amber', true, 'alarm')];

  // ── airlock_cycle: the decon cycle runs by itself; when the steam clears there is a hand on the glass ──
  let print: THREE.Mesh | null = null;
  L.afterDoors.push(() => {
    const d = L.doors.get('d_fab_inner');
    if (!d) return;
    // a wet palm print: pale condensation smeared on cold steel and glass, with runs
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 160;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(205,222,228,0.62)';
    g.beginPath(); g.ellipse(64, 104, 30, 34, 0, 0, 6.3); g.fill();
    const fingers: [number, number, number, number][] = [[30, 62, -0.32, 30], [48, 46, -0.1, 38], [66, 42, 0.04, 40], [84, 50, 0.2, 34], [104, 96, 1.0, 26]];
    for (const [x, y, a, len] of fingers) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 7.5, len / 2, 0, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(0, -len / 2 + 4, 8.5, 9, 0, 0, 6.3); g.fill(); g.restore(); }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 240; i++) { g.globalAlpha = 0.25 + Math.random() * 0.5; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 160, 0.6 + Math.random() * 2.2, 0, 6.3); g.fill(); }
    g.globalAlpha = 0.5; g.lineWidth = 2; for (let y = 78; y < 130; y += 7) { g.beginPath(); g.moveTo(38, y); g.quadraticCurveTo(64, y - 6, 90, y); g.stroke(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.strokeStyle = 'rgba(205,222,228,0.8)'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const [x, y, l] of [[52, 136, 20], [70, 138, 14], [80, 134, 22]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + l); g.stroke(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.12, metalness: 0, opacity: 0 });
    mat.name = 'airlock_print';
    print = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.31), mat);
    print.position.set(0.62, 2.2, 0.112);
    print.rotation.z = 0.2;
    print.visible = false;
    d.leaf(0).add(print);
  });
  L.vignette('airlock_cycle', () => {
    const fx = L.ctx.fx;
    const jets: { stop(): void }[] = [];
    const jet = (x: number, y: number, z: number, dx: number, dy: number) => jets.push(fx.emitter('steam', new THREE.Vector3(x, y, z), new THREE.Vector3(dx, dy, 0), 75));
    L.sfx('alarm_blip', 0, 2.6, -23, 0.6, 1);
    for (const bc of beacons) bc.intensityScale = 3.2;
    // nozzles open in sequence down the lock, hiss for ~2.5 s, shut together
    [-21.6, -23, -24.4].forEach((z, i) => L.after(0.35 + i * 0.22, () => {
      L.sfx('steam_burst', 0, 1.6, z, 0.8, 0.9 + i * 0.08);
      jet(-1.68, 1.02, z, 1, 0.15); jet(1.68, 1.44, z, -1, 0.1); if (i !== 1) jet(i ? -0.84 : 0.84, H - 0.36, z, 0, -1);
    }));
    L.after(3.1, () => { for (const j of jets) j.stop(); L.sfx('alarm_blip', 0, 2.6, -23, 0.4, 0.7); });
    L.tween(3.1, 1.5, (k) => { for (const bc of beacons) bc.intensityScale = 3.2 - 2.2 * k; });
    // silence while it thins… then the slap
    L.after(4.9, () => {
      const d = L.doors.get('d_fab_inner');
      L.sfx('glass_thump', 0.62, 2.2, -25.9, 1, 1);
      d?.shake(0.014, 0.55);
      fx.smoke(new THREE.Vector3(0.62, 2.2, -25.75), { count: 3, size: 0.25, color: 0xc8d4d8, rise: 0.15, life: 1.4 });
      if (print) {
        const m = print.material as THREE.MeshStandardMaterial;
        print.visible = true; m.opacity = 1;
        // pressed hard, dragged down a little as it leaves, then the print slowly dries
        L.tween(0.12, 0.5, (k) => { print!.position.y = 2.2 - 0.035 * k * (2 - k); print!.scale.y = 1 + 0.2 * k; });
        L.tween(4, 40, (k) => { m.opacity = 1 - 0.45 * k; });
      }
    });
  });

  b.sign('제염 록', 'stencil', -1.94, 2.55, -23, 1.6, 0.22, '+x');
  b.sign('사이클 중 노즐에서 떨어지세요', 'warning', 1.925, 1.75, -23.4, 0.95, 0.14, '-x', 0, true);
  b.sign('사이클 고장 — 수동 조작 걸림', 'danger', 1.925, 2.05, -21.6, 0.7, 0.1, '-x', 0, true);
  b.decal('water_stain', 0, -1.94, 1.2, -22.2, 0.7, 1.8, '+x');
  b.decal('water_stain', 3, 1.94, 1.1, -24.9, 0.7, 1.8, '-x');
  b.decal('handprint', 1, 0.9, 1.3, Z0 + 0.34, 0.24, 0.24, '+z', 0.2);
  b.decal('blood_smear', 0, 0.4, 0.004, -25.5, 0.6, 0.9, '+y', 0.1);
  L.ctx.fx.emitter('steam', L.vec(-1.45, 3.0, -24.4), L.vec(0.3, -1, 0), 45);
  L.ctx.fx.emitter('drip', L.vec(0.84, H - 0.36, -21.6), L.vec(0, -1, 0), 1.5);
}
