/** SERVICE CORRIDOR A — x -1.5…1.5, z -14…0, h 3.0. Failing lights, trench grates, pipes. */
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { cable, cableBundle, ductRect, floorSlab, pipe, trench, valve } from '../kit';
import { fireExtinguisher, toolCart, tools } from '../props';
import { beacon, ceilingSlab, troffer, wallFace } from '../structure';
import { scrawlMaterial } from '../scrawl';
import type { LightHandle } from '../../core/types';

export function buildCorridor(L: LevelBuild) {
  const b = L.builder('corr_a');
  const R = rng(202);
  const H = 3.0, Z0 = -13.6, Z1 = -0.2;
  L.room('corr_a', '서비스 통로 A', -1.5, 1.5, -14, 0, H);

  const holes: [number, number, number, number][] = [[-0.45, -12.6, 0.45, -9.3], [-0.45, -8.7, 0.45, -5.3], [-0.45, -4.7, 0.45, -1.6]];
  floorSlab(b, 'floor_plate', -1.5, -14, 1.5, 0, holes, 'metal');
  for (const h of holes) trench(b, h[0], h[1], h[2], h[3], 0.5, R, true);
  ceilingSlab(b, -1.9, -13.4, 1.9, 0, H); // ends behind the junction's wall, not flush with any face

  wallFace(b, { n: '-z', plane: Z1, from: -1.5, to: 1.5, h: H, t: 0.2, openings: [{ c: 0, w: 1.6, h: 2.4 }], seed: 5, trayY: 0 });
  wallFace(b, { n: '+x', plane: -1.5, from: Z0, to: Z1, h: H, seed: 6, bay: 1.9, ext: [0, 0.2], features: 0.5, trayY: 2.2, openings: [{ c: -6.5, w: 1.6, h: 2.4 }] });
  wallFace(b, { n: '-x', plane: 1.5, from: Z0, to: Z1, h: H, seed: 7, bay: 1.9, ext: [0, 0.2], features: 0.5, trayY: 0, clear: [[-7.6, -5.4]] });

  // ── portal frames (pilasters continue across the ceiling) ──
  const n = 7, step = (Z1 - Z0) / n;
  for (let i = 0; i <= n; i++) {
    const z = Z1 - i * step;
    b.box('trim_steel', 0, H - 0.09, z, 3.0, 0.18, 0.14);
    b.detail(() => {
      for (const s of [-1, 1]) {
        b.rbox('trim_steel', s * 1.3, H - 0.26, z, 0.36, 0.05, 0.1, 0, 0, s * 0.78);
        b.box('painted_dark', s * 1.43, H - 0.2, z, 0.12, 0.4, 0.24);
      }
    });
  }

  // ── ceiling services: duct on the right, pipes on the left, cables down the middle ──
  ductRect(b, 'steel_raw', 'z', 0.95, H - 0.36, (Z0 + Z1) / 2, Z1 - Z0 - 0.2, 0.55, 0.3, 1.9);
  b.detail(() => {
    for (const z of [-3.5, -10.5]) { b.box('painted_dark', 0.95, H - 0.53, z, 0.4, 0.04, 0.6); for (let k = -2; k <= 2; k++) b.box('trim_steel', 0.95, H - 0.555, z + k * 0.1, 0.36, 0.012, 0.02); }
    // duct hangers
    for (let i = 0; i < n; i++) { const z = Z1 - (i + 0.5) * step; for (const s of [-1, 1]) b.rod('steel_raw', 0.95 + s * 0.3, H, z, 0.95 + s * 0.3, H - 0.53, z, 0.006, 4); b.box('steel_raw', 0.95, H - 0.53, z, 0.66, 0.02, 0.03); }
  });
  pipe(b, 'copper', [[-1.2, H - 0.38, Z1], [-1.2, H - 0.38, Z0]], 0.06, { every: 1.9 });
  pipe(b, 'steel_raw', [[-1.02, H - 0.34, Z1], [-1.02, H - 0.34, -7.5], [-1.02, H - 0.55, -7.9], [-1.02, H - 0.55, Z0]], 0.04, { every: 1.9 });
  pipe(b, 'painted_orange', [[-0.86, H - 0.3, Z1], [-0.86, H - 0.3, Z0]], 0.022, { flanges: false });
  b.detail(() => {
    valve(b, -1.2, H - 0.38, -4.3, 'z', 0.06, 'y', -1);
    valve(b, -1.02, H - 0.55, -10.9, 'z', 0.04, 'x', 1);
    for (let i = 0; i < n; i++) { const z = Z1 - (i + 0.5) * step; b.box('steel_raw', -1.04, H - 0.2, z, 0.5, 0.025, 0.04); b.rod('steel_raw', -1.25, H, z, -1.25, H - 0.2, z, 0.006, 4); b.rod('steel_raw', -0.82, H, z, -0.82, H - 0.2, z, 0.006, 4); }
    for (let i = 0; i < n; i++) {
      const z0 = Z1 - i * step - 0.07, z1 = Z1 - (i + 1) * step + 0.07;
      cableBundle(b, [-0.25, H - 0.2, z0], [-0.25, H - 0.2, z1], 3, 0.1, 0.014, 0.05, R);
    }
    // water stains under the copper line, drip puddle
    b.decal('water_stain', 1, -1.464, 1.9, -9.9, 0.7, 1.6, '+x');
    b.decal('water_stain', 2, -1.464, 1.7, -4.4, 0.6, 1.4, '+x');
    b.decal('oil_stain', 0, -0.9, 0.002, -10.0, 1.1, 1.1, '+y', 0.5);
  });

  // ── lights: four troffers, mostly failing ──
  const tubes: { h: LightHandle; z: number; flicker: 'broken' | 'fluorescent' }[] = [
    { h: troffer(b, L, { group: 'corr_a', x: -0.1, y: H, z: -2.2, axis: 'z', intensity: 50, distance: 7.5, flicker: 'broken', cast: true, vol: true, priority: 2 })!, z: -2.2, flicker: 'broken' },
    { h: troffer(b, L, { group: 'corr_a', x: -0.1, y: H, z: -9.4, axis: 'z', intensity: 42, distance: 7, flicker: 'broken', vol: true })!, z: -9.4, flicker: 'broken' },
    { h: troffer(b, L, { group: 'corr_a', x: -0.1, y: H, z: -12.8, axis: 'z', intensity: 36, distance: 6.5, flicker: 'fluorescent' })!, z: -12.8, flicker: 'fluorescent' },
  ];
  troffer(b, L, { group: 'corr_a', x: -0.1, y: H, z: -5.9, axis: 'z', dead: true });
  b.at(-1.5, 0, -4.95, Math.PI / 2, () => beacon(b, L, 'corr_a_emergency', 0, 2.5, 0.1, 1, 0xff2a12, 50, 9));

  // corr_lights_chase: the tubes die one by one from the junction end towards whoever is walking down it,
  // the corridor holds its breath in the dark, then they stutter back.
  L.vignette('corr_lights_chase', () => {
    const order = tubes.slice().sort((p, q) => p.z - q.z);
    const was = order.map((o) => o.h.enabled);
    order.forEach((o, i) => {
      L.after(i * 0.35, () => {
        if (!o.h.enabled) return;
        // a last over-bright gasp, then out
        o.h.intensityScale = 1.8; o.h.setFlicker('strobe');
        L.sfx('spark_zap', -0.1, H - 0.2, o.z, 0.35, 0.8 + i * 0.12);
        L.after(0.12, () => { o.h.enabled = false; o.h.intensityScale = 1; });
      });
    });
    const dark = (order.length - 1) * 0.35 + 0.12 + 1.5;
    L.after((order.length - 1) * 0.35 + 0.3, () => L.sfx('power_down', 0, 1.5, -7, 0.5));
    // return: nearest the player first, each one strobing before it settles into its usual bad habits
    order.slice().reverse().forEach((o, i) => {
      L.after(dark + i * 0.22, () => {
        if (!was[order.indexOf(o)]) return;
        o.h.enabled = true; o.h.setFlicker('strobe'); o.h.intensityScale = 0.6;
        L.sfx('spark_zap', -0.1, H - 0.2, o.z, 0.2, 1.5);
        L.tween(0.5 + i * 0.15, 0.6, (k) => { o.h.intensityScale = 0.6 + 0.4 * k; }, () => { o.h.setFlicker(o.flicker); o.h.intensityScale = 1; });
      });
    });
  });
  b.at(1.5, 0, -11.4, -Math.PI / 2, () => beacon(b, L, 'corr_a_emergency', 0, 2.5, 0.1, 1, 0xff2a12, 50, 9));

  // ── dropped tool cart, spilled tools, a cut cable sparking ──
  b.at(0.92, 0, -8.3, 0.5, () => toolCart(b, R));
  b.at(0.2, 0, -7.6, 0, () => tools(b, 6, 0.55, R));
  b.decal('oil_stain', 1, 0.5, 0.002, -7.7, 1.2, 1.0, '+y', 1.1);
  b.detail(() => {
    cable(b, 'rubber', [0.3, H - 0.1, -5.9], [0.45, 1.75, -5.5], 0.05, 0.016, 8, 5);
    b.cyl('copper', 0.45, 1.73, -5.5, 0.009, 0.05, 'y', 5);
    // open ceiling panel where it was pulled down
    b.rbox('ceiling_panel', 0.45, H - 0.25, -6.4, 0.6, 0.02, 0.6, 0.9, 0, 0);
  });
  L.ctx.fx.emitter('sparks', L.vec(0.45, 1.7, -5.5), L.vec(0, -1, 0), 0.6);
  L.ctx.fx.emitter('steam', L.vec(-1.2, H - 0.45, -10.2), L.vec(0.5, -1, 0.1), 45);
  L.ctx.fx.emitter('drip', L.vec(-1.2, H - 0.45, -4.3), L.vec(0, -1, 0), 0.8);

  // ── drag marks continue from the med bay ──
  b.decal('blood_smear', 1, 0.1, 0.002, -0.9, 0.6, 1.5, '+y', -0.05);
  b.decal('blood_smear', 2, 0.55, 0.002, -2.6, 0.5, 1.4, '+y', -0.3);
  b.decal('blood_smear', 0, 0.8, 0.002, -4.0, 0.45, 1.1, '+y', -0.1);
  b.decal('handprint', 1, 1.464, 1.0, -4.5, 0.22, 0.22, '-x', 0.6);

  // ── signs ──
  b.sign('서비스 통로 A', 'stencil', -1.464, 2.0, -2.9, 1.3, 0.2, '+x');
  b.sign('정션 3 ^', 'directional', 1.464, 1.75, -1.4, 0.7, 0.16, '-x', 0, true);
  b.sign('← 의무실 3-A', 'directional', 1.464, 1.75, -12.4, 0.8, 0.16, '-x', 0, true);
  b.sign('주의 — 그레이팅 아래 활선 트렌치', 'warning', -1.464, 1.45, -8.6, 0.9, 0.14, '+x', 0, true);
  b.sign('A', 'stencil', 0.95, 0.003, -13.2, 0.5, 0.6, '+y');
  // scratched into the paint opposite the quarters door, where the light from that door falls
  b.quad(scrawlMaterial(["그들이", '너를', '업어 가게 두지 마'], { style: 'scratch', aspect: 1.25, seed: 3 }), 1.465, 1.66, -6.3, 0.9, 0.72, '-x', 0.03, 'unit', 0.004);
  b.decal('scratches', 3, 1.464, 1.0, -6.0, 0.5, 0.5, '-x', 1.0);
  b.sign('에리두 심해 제작 — 하부 3층', 'label', 1.464, 2.35, -7.0, 1.4, 0.1, '-x');
  b.at(1.5, 0.6, -3.2, -Math.PI / 2, () => fireExtinguisher(b));
  b.decal('grime', 1, 0, 0.002, -11.5, 2.4, 2.4, '+y', 0.3);
}
