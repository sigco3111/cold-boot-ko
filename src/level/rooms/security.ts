/** SECURITY 3 — x -11…-3, z -21…-13, h 3.2. Monitor wall, console, weapon locker (pistol), ceiling vent. */
import * as THREE from 'three';
import { rng } from '../builder';
import { Swing } from '../ambient';
import type { LevelBuild } from '../context';
import { cableBundle, ductRect, floorSlab, louvre, pipe, trench } from '../kit';
import { bench, chair, console, crate, desk, fireExtinguisher, locker, lockerRow, monitorBezel, mug, papers, switchgear, tablet } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';

const PI = Math.PI;

export function buildSecurity(L: LevelBuild) {
  const b = L.builder('sec');
  const R = rng(404);
  const H = 3.2;
  L.room('sec', '보안실 3', -11, -3, -21, -13, H);

  floorSlab(b, 'floor_rubber', -11, -21, -3, -13, [[-9.4, -19.6, -8.8, -14.4]], 'rubber');
  trench(b, -9.4, -19.6, -8.8, -14.4, 0.4, R);
  ceilingSlab(b, -11.2, -21.2, -3, -12.8, H);

  wallFace(b, { n: '-x', plane: -3.2, from: -21, to: -13, h: H, t: 0.2, openings: [{ c: -17, w: 1.6, h: 2.4 }], seed: 21, features: 0.3 });
  wallFace(b, { n: '+x', plane: -11, from: -21, to: -13, h: H, seed: 22, features: 0, trayY: 0, style: 'dark' });
  wallFace(b, { n: '+z', plane: -21, from: -11, to: -3.2, h: H, seed: 23, features: 0.3, clear: [[-9.4, -6.2]] });
  wallFace(b, { n: '-z', plane: -13, from: -11, to: -3.2, h: H, seed: 24, features: 0.2, clear: [[-11, -3.4]] });

  // ── ceiling ──
  for (const x of [-9, -7, -5]) b.box('trim_steel', x, H - 0.08, -17, 0.12, 0.16, 8);
  ductRect(b, 'steel_raw', 'x', -8.3, H - 0.2, -18.0, 4.2, 0.55, 0.32, 1.4);
  b.detail(() => {
    cableBundle(b, [-10.8, H - 0.15, -15.2], [-7.1, H - 0.15, -15.2], 4, 0.16, 0.014, 0.05, R);
    cableBundle(b, [-6.9, H - 0.15, -15.2], [-5.1, H - 0.15, -15.2], 3, 0.1, 0.014, 0.05, R);
    pipe(b, 'painted_orange', [[-3.6, H - 0.12, -20.8], [-3.6, H - 0.12, -13.2]], 0.022, { flanges: false });
  });

  // ── the open ceiling vent (sec_vent): dark shaft + grille hanging by one hinge ──
  const vx = -6.0, vz = -18.0;
  b.box('painted_dark', vx, H - 0.2, vz, 0.9, 0.4, 0.9);
  b.detail(() => {
    b.box('screen_off', vx, H - 0.405, vz, 0.74, 0.012, 0.74);
    for (const s of [-1, 1]) { b.box('trim_steel', vx + s * 0.4, H - 0.41, vz, 0.08, 0.03, 0.88); b.box('trim_steel', vx, H - 0.41, vz + s * 0.4, 0.88, 0.03, 0.08); }
    b.decal('scratches', 1, vx - 0.9, H - 0.001, vz, 0.8, 0.8, '-y');
    b.decal('oil_drip', 1, vx, 0.002, vz + 0.2, 0.7, 0.7, '+y');
  });
  // the grille: shut until `sec_vent_drop` — hinge along X at the origin, hangs down -Y once it lets go
  const vent = L.part('sec_vent');
  for (const s of [-1, 1]) vent.box('trim_steel', s * 0.36, -0.37, 0, 0.03, 0.74, 0.03);
  vent.box('trim_steel', 0, -0.015, 0, 0.75, 0.03, 0.03).box('trim_steel', 0, -0.725, 0, 0.75, 0.03, 0.03);
  for (let i = 0; i < 9; i++) vent.rbox('trim_steel', 0, -0.075 - i * 0.075, 0, 0.7, 0.055, 0.008, 0.65, 0, 0);
  const ventObj = vent.build(false);
  ventObj.position.set(vx, H - 0.43, vz - 0.37);
  const SHUT = -PI / 2;
  ventObj.rotation.x = SHUT;
  for (const m of ventObj.children) (m as THREE.Mesh).castShadow = true;
  L.root.add(ventObj);
  L.objects.set('sec_vent', ventObj);
  L.ctx.physics.addMover?.(ventObj); // REVISION 5.2: decals on the grille drop with it
  L.vignette('sec_vent_drop', () => {
    const fx = L.ctx.fx, p = new THREE.Vector3();
    const dust = (n: number, y: number) => fx.smoke(p.set(vx + (Math.random() - 0.5) * 0.4, y, vz + (Math.random() - 0.5) * 0.4), { count: n, size: 0.3, color: 0x8d8a80, rise: -0.5, life: 2.2 });
    // one fastener gives: the free edge sags a finger's width and ticks. Then nothing. Then it lets go.
    L.sfx('pipe_tick', vx, H - 0.4, vz + 0.3, 0.7, 1.2);
    L.tween(0, 0.12, (k) => { ventObj.rotation.x = SHUT + 0.07 * k; });
    dust(2, H - 0.5);
    const sw = new Swing(0, 19.5, 0.5, SHUT + 0.07);
    let t = 0, prev = SHUT, first = true, last = 0;
    L.after(1.1, () => {
      L.sfx('metal_clang', vx, H - 0.5, vz, 1, 0.9);
      dust(6, H - 0.45);
      L.sim((dt) => {
        t += dt;
        const a = sw.step(dt);
        ventObj.rotation.x = a;
        ventObj.rotation.z = Math.sin(t * 5.1) * 0.05 * Math.exp(-t * 0.35);
        if (prev < 0 !== a < 0) {
          // every pass through the bottom: the hinge complains, quieter each time
          const e = Math.min(1, Math.abs(sw.v) / 5);
          if (first) { first = false; dust(4, H - 0.6); }
          if (e > 0.06 && t - last > 0.3) { last = t; L.sfx('metal_groan', vx, H - 0.45, vz - 0.37, 0.12 + e * 0.45, 1.5 + e * 0.5); }
        }
        if (t < 2.5 && Math.random() < dt * 5) dust(1, H - 0.5);
        prev = a;
        return t < 30 && sw.energy > 0.004;
      });
    });
  });

  // ── monitor wall + main console (west) ──
  b.at(-11, 0, -17, PI / 2, () => {
    b.box('painted_dark', 0, 2.28, 0.03, 2.7, 1.55, 0.06);
    b.detail(() => {
      b.box('trim_steel', 0, 3.07, 0.05, 2.8, 0.05, 0.1).box('trim_steel', 0, 1.49, 0.05, 2.8, 0.05, 0.1);
      for (const s of [-1, 1]) b.box('trim_steel', s * 1.38, 2.28, 0.05, 0.05, 1.6, 0.1);
      for (const s of [-1, 1]) for (const k of [0, 1, 2]) b.rod('rubber', s * 1.5 + k * 0.04 * s, 0.1, 0.05, s * 1.5 + k * 0.04 * s, 3.1, 0.05, 0.014, 5);
    });
    for (const [lx, y] of [[-0.62, 2.63], [0.62, 2.63], [-0.62, 1.92], [0.62, 1.92]]) monitorBezel(b, lx, y, 1.1, 0.6, 0.11);
  });
  const kinds = ['camera_feed', 'static', 'static', 'camera_feed'] as const;
  const monitors = [[-16.38, 2.63], [-17.62, 2.63], [-16.38, 1.92], [-17.62, 1.92]].map(([z, y], i) => L.screen(`sec_monitor_${i + 1}`, kinds[i], 1.1, 0.6, -10.888, y, z, '+x'));
  // monitor 4 has lost vertical hold: every so often the picture rolls, tears, and catches again
  {
    const W = 1.1, Hh = 0.6, GAP = 0.035;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(24), uv = new Float32Array(16), nor = new Float32Array(24);
    for (let i = 0; i < 8; i++) nor[i * 3 + 2] = 1;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
    const quad = (o: number, y0: number, y1: number, v0: number, v1: number, skew: number) => {
      const xs = [-W / 2, W / 2, -W / 2, W / 2], ys = [y0, y0, y1, y1], vs = [v0, v0, v1, v1];
      for (let i = 0; i < 4; i++) { pos[(o + i) * 3] = xs[i] + (i > 1 ? skew : 0); pos[(o + i) * 3 + 1] = ys[i]; uv[(o + i) * 2] = i % 2; uv[(o + i) * 2 + 1] = vs[i]; }
    };
    const set = (r: number, skew: number) => {
      const split = -Hh / 2 + (1 - r) * Hh;
      quad(0, -Hh / 2, Math.max(-Hh / 2, split - (r > 0 ? GAP / 2 : 0)), r, r > 0 ? 1 - GAP / (2 * Hh) : 1, 0);
      quad(4, Math.min(Hh / 2, split + GAP / 2), Hh / 2, 0, Math.max(0, r - GAP / (2 * Hh)), skew);
      g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    };
    set(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.7);
    monitors[3].geometry = g;
    let wait = 3, r = 0, v = 0, rolling = false, hold = 0, tear = 0;
    L.ambient('sec', (dt, t) => {
      if (!rolling) {
        wait -= dt;
        if (tear > 0) { tear -= dt; set(0.93, Math.sin(t * 90) * 0.03); if (tear <= 0) set(0, 0); }
        else if (Math.random() < dt * 0.25) tear = 0.09;
        if (wait <= 0) { rolling = true; hold = 1.2 + Math.random() * 2.6; v = 0.2; }
        return;
      }
      hold -= dt;
      v += ((hold > 0 ? 1.7 + Math.sin(t * 3.1) * 0.6 : 0.25) - v) * Math.min(1, dt * 3);
      r += v * dt;
      if (r >= 1) { r -= 1; if (hold <= 0) { rolling = false; r = 0; wait = 5 + Math.random() * 9; set(0, 0); return; } }
      set(r, Math.sin(t * 37) * 0.012 + (Math.sin(t * 5.3) > 0.8 ? 0.05 : 0));
    });
  }
  b.at(-10.15, 0, -17, PI / 2, () => console(b, 3.6, R));
  L.screen('sec_console', 'terminal_idle', 1.0, 0.42, -10.418, 1.17, -17, '+x');
  L.interact('term_sec_unlock', 'terminal', '보안 콘솔 사용', -9.95, 1.05, -17);
  b.sign('보안실 3 — 당직 데스크', 'label', -10.418, 1.43, -15.9, 0.8, 0.07, '+x');
  // operator chair, pushed back
  b.at(-8.4, 0, -16.4, PI / 2 + 0.9, () => chair(b));
  b.collide(-8.65, 0, -16.65, -8.15, 0.9, -16.15, 'rubber');

  // ── recorder racks in the NW corner ──
  b.at(-10.4, 0, -13.42, PI, () => switchgear(b, R, 0.8, 2.1, 0.7, 0.7));
  b.at(-9.55, 0, -13.42, PI, () => switchgear(b, R, 0.8, 2.1, 0.7, 0.6));
  b.collide(-10.8, 0, -13.8, -9.15, 2.1, -13.05);

  // ── duty officer's desk (north wall), chair knocked over, tablet ──
  b.at(-6.6, 0, -13.5, PI, () => desk(b, 1.7, 0.85));
  b.at(-6.9, 0.765, -13.55, 0.3, () => tablet(b, 'emissive_cyan'));
  L.interact('log_sec', 'log', '태블릿 읽기', -6.9, 0.8, -13.55);
  b.at(-6.1, 0.765, -13.4, 0, () => mug(b));
  b.push(-6.3, 0.27, -14.75, 2.3, -PI / 2, 0); chair(b); b.pop();
  b.at(-6.9, 0, -14.6, 0, () => papers(b, 6, 0.6, R));
  b.detail(() => {
    // desk lamp
    b.cyl('painted_dark', -7.25, 0.775, -13.3, 0.07, 0.02, 'y', 10);
    b.rod('painted_dark', -7.25, 0.78, -13.3, -7.25, 1.1, -13.25, 0.01, 5);
    b.rod('painted_dark', -7.25, 1.1, -13.25, -7.05, 1.18, -13.4, 0.01, 5);
  });
  const lamp = L.spot('sec', -7.05, 1.15, -13.42, -6.8, 0.76, -13.6, 0xffc27a, 14, 3.5, 0.9, { penumbra: 0.8 });
  b.detail(() => { b.cyl('painted_dark', -7.03, 1.17, -13.42, 0.06, 0.07, 'y', 10, 0.03); b.cyl(L.glow(lamp, 'emissive_warm'), -7.03, 1.132, -13.42, 0.045, 0.006, 'y', 10); });
  b.decal('blood_pool', 0, -6.2, 0.002, -15.2, 1.2, 1.0, '+y', 1.0);
  b.decal('blood_smear', 1, -5.3, 0.002, -15.9, 0.6, 1.6, '+y', -1.0);
  b.decal('blood_smear', 0, -4.2, 0.002, -16.7, 0.6, 1.4, '+y', -1.3);
  L.pickup('p_sec_ammo', 'ammo_pistol', -6.3, 0.765, -13.6, 12, 0.4);

  // ── lockers (north-east) ──
  b.at(-3.5, 0, -13.27, PI, () => lockerRow(b, 3, R));

  // ── weapon lockers (south wall) ──
  b.at(-8.0, 0, -20.72, 0, () => {
    locker(b, 1.95, 'wall_panel_dark', 0.9, 2.0, 0.5);
    b.detail(() => {
      b.box('emissive_red', 0, 1.97, 0.2, 0.5, 0.012, 0.012);
      b.box('rubber', 0, 1.112, 0, 0.8, 0.008, 0.4);
      for (let i = 0; i < 3; i++) b.box('painted_dark', -0.25 + i * 0.2, 0.5, -0.05, 0.12, 0.08, 0.2);
      b.rod('steel_raw', -0.4, 1.75, -0.1, 0.4, 1.75, -0.1, 0.008, 5);
    });
  });
  L.pickup('p_pistol', 'pistol', -8.0, 1.11, -20.7, 12, PI / 2);
  b.at(-7.0, 0, -20.72, 0, () => { locker(b, 0, 'wall_panel_dark', 0.9, 2.0, 0.5); b.detail(() => b.box('emissive_red', 0, 1.97, 0.26, 0.5, 0.012, 0.012)); });
  b.at(-9.0, 0, -20.72, 0, () => { locker(b, 0.35, 'wall_panel_dark', 0.9, 2.0, 0.5); });
  b.sign('무기고 — 모든 권총 반출 기록', 'danger', -8.0, 2.35, -20.964, 1.3, 0.16, '+z', 0, true);
  b.decal('handprint', 0, -7.5, 1.3, -20.44, 0.24, 0.24, '+z', -0.3);
  b.decal('blood_smear', 2, -7.6, 0.002, -19.9, 0.5, 1.0, '+y', 0.2);
  b.detail(() => { for (let i = 0; i < 9; i++) b.rbox('brass', -8.3 + R.range(-0.6, 0.9), 0.006, -19.8 + R.range(-0.5, 0.5), 0.02, 0.01, 0.01, 0, R.range(0, 6), 0); });

  // ── east side: bench, crate, extinguisher ──
  b.at(-3.65, 0, -19.6, -PI / 2, () => bench(b, 1.5));
  b.at(-4.0, 0, -20.5, 0.2, () => crate(b, 0.6, 0.5, 0.5, 'painted_dark', '진압 장비'));
  b.at(-3.2, 0.55, -18.4, -PI / 2, () => fireExtinguisher(b));

  // ── lights: the monitor wall is the key light; one tired troffer by the lockers ──
  L.spot('sec', -10.7, 2.3, -17, -5.5, 0.6, -17, 0x9fc4ff, 190, 10, 1.1, { cast: true, flicker: 'fluorescent', priority: 3, penumbra: 0.9 });
  L.point('sec', -9.6, 1.5, -17, 0x58e8c0, 4, 3.5);
  troffer(b, L, { group: 'sec', x: -7.6, y: H, z: -19.6, axis: 'x', intensity: 60, distance: 7.5, angle: 1.05, flicker: 'broken' });
  troffer(b, L, { group: 'sec', x: -5.2, y: H, z: -15.6, axis: 'z', dead: true });
  troffer(b, L, { group: 'sec', x: -9.0, y: H, z: -14.6, axis: 'x', dead: true });

  // ── signs ──
  b.sign('보안실 3', 'stencil', -3.236, 2.3, -19.6, 1.1, 0.24, '-x');
  b.sign('모든 피드 녹화 중 — CHOIR 감시 가동', 'label', -10.964, 3.0, -14.6, 1.3, 0.09, '+x');
  b.sign('교대 근무표', 'label', -4.6, 1.9, -20.964, 0.5, 0.1, '+z', 0, true);
  b.detail(() => b.box('plastic_white', -4.6, 1.5, -20.955, 0.8, 0.6, 0.01));
  b.decal('grime', 3, -5, 0.002, -18, 2.6, 2.6, '+y', 0.4);
  L.ctx.fx.emitter('dust', L.vec(-8.5, 1.6, -17), L.vec(1, 0, 0), 4);
}
