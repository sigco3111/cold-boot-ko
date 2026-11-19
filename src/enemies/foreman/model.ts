/**
 * FOREMAN — a line-supervisor unit CHOIR built from spares (REVISION 4 boss). 2.6 m.
 * Tracked utility base (yellow, hazard-striped) → turret ring → hydraulic column → hub; three husk upper bodies fused
 * back to back on the hub (A faces front, B / C back-left / back-right), each with its own head (the three weak points);
 * two heavy yellow manipulators on the hub's shoulders; B and C keep their two thin husk arms (four more arms).
 *
 * Model space: floor y = 0, facing +Z, left = +X. Rigid skinning like the other machines.
 */
import * as THREE from 'three';
import type { GameContext } from '../../core/types';
import { buildRigLods, glowMaterial, tintOf, type RigBuilder, type RigTemplate } from '../shared/rig';
import { bcyl, bolt, box, cyl, keyLerp, patch, plate, rod, shell, sphere, spow, torus, tube, wedge, xf } from '../shared/prims';
import { huskShell, MARK_RED, shellGrime } from '../husk/model';

export const FOREMAN_DIM = {
  turretY: 0.62, columnY: 0.66, hubY: 1.5,
  torsoOff: 0.19, torsoY: 1.62, spineY: 1.82, neckY: 2.3, headY: 2.36,
  mShoulderX: 0.47, mShoulderY: 1.74, mUpper: 0.72, mFore: 0.68, mClaw: 0.3,
  armShoulderX: 0.19, armShoulderY: 2.17, uarm: 0.29, larm: 0.29,
  wheels: [-0.6, -0.3, 0, 0.3, 0.6], trackX: 0.6, wheelR: 0.15,
};
const F = FOREMAN_DIM;
export const TORSOS = ['a', 'b', 'c'] as const;
export const TORSO_YAW: Record<string, number> = { a: 0, b: (120 * Math.PI) / 180, c: (240 * Math.PI) / 180 };

export interface ForemanTemplate {
  rig: RigTemplate;
}

const D = Math.PI / 180;
const _g = new THREE.Vector3();

export function buildForemanTemplate(ctx: GameContext): ForemanTemplate {
  const M = ctx.materials;
  const sign = M.sign('2번 라인 — 관리자', 'stencil', 4);
  const mats: Record<string, THREE.Material> = {
    glow: glowMaterial(), shell: huskShell(ctx), frame: M.get('robot_frame'), joint: M.get('robot_joint'), rubber: M.get('rubber'),
    steel: M.get('steel_raw'), yellow: M.get('painted_yellow'), dark: M.get('painted_dark'), hazard: M.get('hazard_stripes'),
    glass: M.get('screen_off'), chrome: M.get('chrome'), red: M.get('emissive_red'), amber: M.get('emissive_amber'), sign,
  };
  const { template } = buildRigLods(authorForeman, mats, {
    radius: 2.6, center: new THREE.Vector3(0, 1.3, 0),
    fold: { red: 'glow', amber: 'glow', chrome: 'steel' }, tint: { red: tintOf(0xff0702, 2.4), amber: tintOf(0xff8a10, 2.2) },
    lod: { k: 0.5, minFeature: 0.025, remap: { steel: 'joint', glass: 'frame', rubber: 'dark', sign: 'yellow', hazard: 'yellow' } },
    proxy: { k: 0.25, minFeature: 0.06, exclude: ['glass', 'red', 'amber', 'sign', 'chrome'] },
    colorize: { shell: (p, n, out) => shellGrime(_g.set(p.x, p.y - 1.2, p.z), n, out) },
  });
  return { rig: template };
}

/** Local (torso frame) → model space for torso yaw θ around the hub axis. */
function rotY(x: number, z: number, th: number): [number, number] {
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}

function authorForeman(b: RigBuilder): void {
  const L = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => b.addL(geo, xf(x, y, z, rx, ry, rz, sx, sy, sz));

  // ── skeleton ───────────────────────────────────────────────────────────
  b.bone('base', null, 0, 0, 0);
  for (const [s, sfx] of [[1, 'l'], [-1, 'r']] as const) {
    F.wheels.forEach((wz, i) => b.bone(`wheel_${sfx}${i}`, 'base', F.trackX * s, F.wheelR + 0.02, wz));
  }
  b.bone('turret', 'base', 0, F.turretY, 0);
  b.bone('column', 'turret', 0, F.columnY, 0);
  b.bone('hub', 'column', 0, F.hubY, 0);
  for (const k of TORSOS) {
    const th = TORSO_YAW[k];
    const [ox, oz] = rotY(0, F.torsoOff, th);
    b.bone('torso_' + k, 'hub', ox, F.torsoY, oz, th);
    const [sx, sz] = rotY(0, F.torsoOff + 0.01, th);
    b.bone('spine_' + k, 'torso_' + k, sx, F.spineY, sz, th);
    const [nx, nz] = rotY(0, F.torsoOff + 0.03, th);
    b.bone('neck_' + k, 'spine_' + k, nx, F.neckY, nz, th);
    b.bone('head_' + k, 'neck_' + k, nx, F.headY, nz, th);
    const [ex, ez] = rotY(0.03, F.torsoOff + 0.03 + 0.08, th);
    b.bone('eye_' + k, 'head_' + k, ex, F.headY + 0.11, ez, th);
    if (k !== 'a') {
      for (const [s, sfx] of [[1, 'l'], [-1, 'r']] as const) {
        const [ax, az] = rotY(F.armShoulderX * s, F.torsoOff + 0.0, th);
        b.bone(`uarm_${k}_${sfx}`, 'spine_' + k, ax, F.armShoulderY, az, th);
        b.bone(`larm_${k}_${sfx}`, `uarm_${k}_${sfx}`, ax, F.armShoulderY - F.uarm, az, th);
        b.bone(`hand_${k}_${sfx}`, `larm_${k}_${sfx}`, ax, F.armShoulderY - F.uarm - F.larm, az, th);
      }
    }
  }
  for (const [s, sfx] of [[1, 'l'], [-1, 'r']] as const) {
    const x = F.mShoulderX * s;
    b.bone('msh_' + sfx, 'hub', x, F.mShoulderY, 0.02);
    b.bone('mup_' + sfx, 'msh_' + sfx, x + 0.09 * s, F.mShoulderY, 0.02);
    b.bone('mfo_' + sfx, 'mup_' + sfx, x + 0.09 * s, F.mShoulderY - F.mUpper, 0.02);
    b.bone('mcl_' + sfx, 'mfo_' + sfx, x + 0.09 * s, F.mShoulderY - F.mUpper - F.mFore, 0.02);
    b.bone('mja_' + sfx, 'mcl_' + sfx, x + 0.09 * s, F.mShoulderY - F.mUpper - F.mFore - 0.08, 0.07);
    b.bone('mjb_' + sfx, 'mcl_' + sfx, x + 0.09 * s, F.mShoulderY - F.mUpper - F.mFore - 0.08, -0.03);
  }
  // dark-room marks (RigBuilder.mark; scale = brightness): each head's sensor (rides on its eye bone) and a hull diode
  // front and rear (scaled with the eye glow in pose()) — the base still reads when heads are gone or face away
  for (const k of TORSOS) {
    const th = TORSO_YAW[k];
    const [ex, ez] = rotY(0.03, F.torsoOff + 0.03 + 0.08, th);
    b.bone('mk_eye_' + k, 'eye_' + k, ex, F.headY + 0.11, ez, th);
  }
  b.bone('mk_hull', 'base', 0, 0.3, 0);
  for (const n of ['head_a', 'head_b', 'head_c', 'mfo_l', 'mfo_r', 'mcl_l', 'mcl_r', 'larm_b_l', 'larm_b_r', 'larm_c_l', 'larm_c_r']) b.debrisBones.add(n);

  // ── tracked base ───────────────────────────────────────────────────────
  for (const z of [1, -1]) b.mark('mk_hull', new THREE.Vector3(0, 0.3, 0.744 * z), new THREE.Vector3(0, 0, z), 0.007, MARK_RED, -0.3);
  b.use('base').mat('yellow');
  L(box(0.9, 0.36, 1.46, 0.05), 0, 0.42, 0);                      // hull
  L(wedge(0.9, 0.5, 0.76, 0.34, 0.12), 0, 0.66, 0.0);              // top bevel
  b.mat('hazard');
  L(box(0.92, 0.12, 0.02), 0, 0.42, 0.735); L(box(0.92, 0.12, 0.02), 0, 0.42, -0.735);
  b.mat('dark');
  L(box(0.7, 0.05, 1.1, 0.01), 0, 0.73, 0);                        // deck plate
  for (const z of [-0.5, 0.5]) L(box(0.18, 0.06, 0.12, 0.01), 0.3 * Math.sign(z), 0.75, z);
  b.mat('steel');
  for (let i = 0; i < 4; i++) L(box(0.6, 0.012, 0.02), 0, 0.5 + i * 0.05, -0.75);   // radiator grille
  for (const s of [-1, 1]) {
    const x = F.trackX * s;
    // track pod: side frames, upper + lower run, tread blocks
    b.use('base').mat('dark');
    L(box(0.05, 0.22, 1.42, 0.01), x - 0.11 * s, 0.22, 0);
    L(box(0.05, 0.22, 1.42, 0.01), x + 0.11 * s, 0.22, 0);
    b.mat('rubber');
    L(box(0.26, 0.04, 1.36, 0.01), x, 0.36, 0);
    L(box(0.26, 0.04, 1.36, 0.01), x, 0.02, 0);
    for (const e of [-1, 1]) L(cyl(0.18, 0.18, 0.26, 16, false), x, 0.19, e * 0.68, 0, 0, 90 * D);
    for (let i = 0; i < 24; i++) {
      const z = -0.66 + i * 0.0574;
      L(box(0.27, 0.025, 0.028), x, 0.385, z);
      L(box(0.27, 0.025, 0.028), x, -0.003, z);
    }
    b.mat('amber');
    for (const e of [-1, 1]) L(box(0.06, 0.04, 0.03), x * 0.75, 0.62, e * 0.74);
    F.wheels.forEach((_, i) => {
      b.use(`wheel_${s > 0 ? 'l' : 'r'}${i}`).mat('joint');
      L(bcyl(F.wheelR, 0.2, 0.02, 16), 0, 0, 0, 0, 0, 90 * D);
      b.mat('frame');
      L(bcyl(0.06, 0.22, 0.01, 10), 0, 0, 0, 0, 0, 90 * D);
      for (let k = 0; k < 5; k++) L(box(0.21, 0.02, 0.05), 0, Math.cos(k * 72 * D) * 0.1, Math.sin(k * 72 * D) * 0.1, k * 72 * D);
    });
  }
  // ── turret + column ────────────────────────────────────────────────────
  b.use('turret').mat('joint');
  L(torus(0.34, 0.035, 8, 28), 0, 0.03, 0, 90 * D);
  b.mat('frame');
  L(bcyl(0.36, 0.08, 0.02, 24), 0, 0.03, 0);
  L(box(0.5, 0.22, 0.4, 0.03), 0, 0.17, -0.06);
  L(bcyl(0.16, 0.6, 0.02, 18), 0, 0.5, 0);                         // outer column sleeve
  b.mat('dark');
  for (const s of [-1, 1]) L(rod([0.2 * s, 0.1, -0.2], [0.12 * s, 0.8, -0.1], 0.03, 10));
  b.mat('rubber');
  for (const s of [-1, 1]) b.addL(tube([[0.18 * s, 0.1, 0.12], [0.24 * s, 0.4, 0.16], [0.2 * s, 0.75, 0.12], [0.14 * s, 1.1, 0.06]], 0.025, 6, 16));
  b.use('column').mat('chrome');
  L(cyl(0.11, 0.11, 0.9, 16), 0, 0.42, 0);
  b.mat('frame');
  L(bcyl(0.2, 0.12, 0.02, 18), 0, 0.84, 0);
  // ── hub ────────────────────────────────────────────────────────────────
  b.use('hub').mat('frame');
  L(bcyl(0.3, 0.2, 0.03, 20), 0, 0.05, 0);
  L(box(1.02, 0.18, 0.26, 0.04), 0, 0.24, -0.02);                   // shoulder beam
  b.mat('yellow');
  L(box(0.9, 0.06, 0.22, 0.02), 0, 0.35, -0.02);
  b.mat('joint');
  for (let i = 0; i < 10; i++) L(bolt(0.012, 0.01), -0.42 + i * 0.093, 0.38, 0.06);
  b.mat('sign');
  b.addL(new THREE.PlaneGeometry(0.4, 0.1).toNonIndexed(), xf(0, 0.24, 0.111), true);
  b.mat('rubber');
  for (const s of [-1, 1]) b.addL(tube([[0.12 * s, 0.1, -0.16], [0.3 * s, 0.18, -0.2], [0.42 * s, 0.24, -0.12]], 0.03, 6, 12));

  // ── three fused husk torsos + heads ───────────────────────────────────
  for (const k of TORSOS) {
    // geometry authored in the torso's own frame (facing local +Z)
    b.use('torso_' + k).mat('frame');
    for (let i = 0; i < 4; i++) { b.mat('joint'); L(bcyl(0.045, 0.03, 0.006, 12), 0, 0.02 + i * 0.05, -0.02); b.mat('frame'); L(box(0.12, 0.016, 0.03, 0.004), 0, 0.02 + i * 0.05, -0.02); }
    b.mat('rubber'); L(cyl(0.022, 0.022, 0.22, 8), 0.04, 0.1, 0.02); L(cyl(0.018, 0.018, 0.22, 8), -0.05, 0.1, 0.03);
    b.use('spine_' + k).mat('frame');
    const cRx: [number, number][] = [[0, 0.13], [0.45, 0.18], [0.8, 0.185], [1, 0.15]];
    const cRz: [number, number][] = [[0, 0.085], [0.45, 0.112], [0.8, 0.108], [1, 0.084]];
    L(shell({ y0: 0, y1: 0.42, rx: cRx.map(([t, v]) => [t, v - 0.018]), rz: cRz.map(([t, v]) => [t, v - 0.018]), a0: 0, a1: 360 * D, nu: 18, nv: 5, thickness: 0.005, n: 2.8 }));
    b.mat('shell');
    const seed = k.charCodeAt(0);
    L(shell({ y0: 0.04, y1: 0.42, rx: cRx, rz: cRz, a0: -95 * D, a1: 95 * D, nu: 24, nv: 14, n: 2.9, thickness: 0.01,
      mask: (u, v) => !(Math.hypot(u - (0.25 + (seed % 3) * 0.2), (v - 0.4) * 1.3) < 0.14 + 0.05 * Math.sin(u * 30 + seed)) && !(v < 0.18 && u > 0.6) }));
    b.mat('joint');
    for (const s of [-1, 1]) { L(bcyl(0.05, 0.08, 0.008, 12), 0.2 * s, 0.35, 0, 0, 0, 90 * D); L(torus(0.05, 0.007, 6, 14), 0.24 * s, 0.35, 0, 0, 90 * D, 0); }
    b.mat('red');
    for (let i = 0; i < 3; i++) L(box(0.008, 0.008, 0.005), -0.012 + i * 0.012, 0.3, 0.112);
    // neck
    b.use('neck_' + k).mat('joint');
    L(cyl(0.026, 0.032, 0.1, 12), 0, 0.03, 0);
    for (let i = 0; i < 3; i++) L(torus(0.033, 0.006, 5, 14), 0, 0.0 + i * 0.025, 0, 90 * D);
    // head: egg cranium with a cracked visor slot and one red sensor
    b.use('head_' + k);
    const hRx: [number, number][] = [[0, 0.032], [0.1, 0.055], [0.3, 0.075], [0.55, 0.086], [0.78, 0.08], [0.93, 0.052], [1, 0.006]];
    const hRz: [number, number][] = [[0, 0.04], [0.1, 0.068], [0.3, 0.09], [0.55, 0.104], [0.78, 0.098], [0.93, 0.065], [1, 0.006]];
    const HY0 = -0.025, HY1 = 0.23;
    const hs = (a0: number, a1: number, nu: number, nv: number, v0: number, v1: number, d: number, th: number, mask?: (u: number, v: number) => boolean) =>
      patch((u, v, out) => {
        const vv = v0 + (v1 - v0) * v, a = a0 + (a1 - a0) * u, e = 2 / 2.3;
        out.set((keyLerp(hRx, vv) - d) * spow(Math.sin(a), e), HY0 + (HY1 - HY0) * vv, 0.02 + (keyLerp(hRz, vv) - d) * spow(Math.cos(a), e));
      }, { nu, nv, thickness: th, mask });
    b.mat('frame'); L(hs(0, 360 * D, 16, 8, 0.02, 1, 0.012, 0.004));
    b.mat('glass'); L(hs(-70 * D, 70 * D, 14, 3, 0.47, 0.62, 0.006, 0.003));
    b.mat('shell');
    L(hs(-180 * D, 180 * D, 36, 22, 0, 1, 0, 0.008, (u, v) => {
      const a = (-180 + 360 * u) * D;
      if (Math.abs(a) < 60 * D && v > 0.5 && v < 0.6) return false;
      if (Math.hypot((a - (seed % 2 ? 40 : -50) * D) * 0.9, (v - 0.7) * 2.2) < 0.32) return false; // smashed panel
      return true;
    }));
    b.mat('frame');
    for (const s of [-1, 1]) L(bcyl(0.025, 0.014, 0.004, 12), 0.088 * s, 0.11, 0.0, 0, 0, 90 * D);
    L(rod([-0.09, 0.13, 0], [-0.1, 0.22, -0.04], 0.003, 5));
    b.use('eye_' + k).mat('red');
    L(sphere(0.014, 10, 6), 0, 0, 0, 0, 0, 0, 1, 1, 0.5);
    {
      const th = TORSO_YAW[k];
      const [ex, ez] = rotY(0.03, F.torsoOff + 0.03 + 0.08 + 0.01, th);
      b.mark('mk_eye_' + k, new THREE.Vector3(ex, F.headY + 0.11, ez), new THREE.Vector3(Math.sin(th), 0, Math.cos(th)), 0.008, MARK_RED, -0.15);
    }
    b.mat('joint'); L(bcyl(0.02, 0.025, 0.004, 12), 0, 0, -0.014, 90 * D);

    // B / C: the two thin husk arms with three-finger hands
    if (k !== 'a') {
      for (const [s, sfx] of [[1, 'l'], [-1, 'r']] as const) {
        b.use(`uarm_${k}_${sfx}`, s).mat('joint');
        L(sphere(0.045, 12, 8));
        b.mat('frame');
        L(wedge(0.042, 0.042, 0.052, 0.052, 0.22), 0, -0.14, 0);
        L(bcyl(0.03, 0.06, 0.005, 10), 0, -F.uarm, 0, 0, 0, 90 * D);
        b.mat('shell');
        L(shell({ y0: -0.25, y1: -0.06, rx: [[0, 0.04], [1, 0.052]], rz: [[0, 0.044], [1, 0.054]], a0: -40 * D, a1: 200 * D, nu: 12, nv: 6, n: 2.6 }));
        b.use(`larm_${k}_${sfx}`, s).mat('frame');
        L(rod([0.015, -0.02, 0.006], [0.013, -F.larm + 0.02, 0.004], 0.012, 8));
        L(rod([-0.015, -0.02, -0.004], [-0.013, -F.larm + 0.02, 0], 0.01, 8));
        b.mat('rubber'); b.addL(tube([[0, -0.03, 0.022], [0.004, -0.14, 0.03], [0, -F.larm + 0.03, 0.018]], 0.006, 5, 10));
        b.use(`hand_${k}_${sfx}`, s).mat('frame');
        L(box(0.06, 0.06, 0.025, 0.006), 0, -0.04, 0);
        for (let i = 0; i < 3; i++) L(wedge(0.014, 0.014, 0.01, 0.01, 0.09), -0.02 + i * 0.02, -0.115, 0.004 * i, 0.2);
      }
    }
  }

  // ── heavy manipulators ────────────────────────────────────────────────
  for (const [s, sfx] of [[1, 'l'], [-1, 'r']] as const) {
    b.use('msh_' + sfx, s).mat('joint');
    L(bcyl(0.13, 0.16, 0.02, 18), 0.05, 0, 0, 0, 0, 90 * D);
    b.mat('frame'); L(torus(0.13, 0.015, 6, 20), 0.14, 0, 0, 0, 90 * D, 0);
    b.use('mup_' + sfx, s).mat('yellow');
    L(box(0.15, F.mUpper - 0.06, 0.17, 0.025), 0, -F.mUpper / 2, 0);
    b.mat('hazard'); L(box(0.152, 0.08, 0.172), 0, -0.12, 0);
    b.mat('joint'); L(bcyl(0.1, 0.2, 0.015, 16), 0, -F.mUpper, 0, 0, 0, 90 * D);
    b.mat('frame'); L(rod([0, -0.1, -0.11], [0, -F.mUpper + 0.08, -0.1], 0.03, 10));
    b.mat('chrome'); L(rod([0, -F.mUpper + 0.1, -0.1], [0, -F.mUpper - 0.08, -0.08], 0.017, 8));
    b.mat('rubber'); b.addL(tube([[0.08, -0.05, 0.04], [0.11, -0.35, 0.06], [0.08, -F.mUpper + 0.05, 0.05]], 0.016, 6, 12));
    b.use('mfo_' + sfx, s).mat('yellow');
    L(wedge(0.14, 0.15, 0.11, 0.12, F.mFore - 0.08), 0, -F.mFore / 2, 0);
    b.mat('dark'); L(box(0.05, F.mFore - 0.2, 0.02), 0, -F.mFore / 2, 0.075);
    b.mat('joint'); L(bcyl(0.075, 0.12, 0.012, 16), 0, -F.mFore + 0.01, 0);
    b.use('mcl_' + sfx, s).mat('frame');
    L(box(0.16, 0.1, 0.13, 0.02), 0, -0.06, 0.02);
    b.mat('amber'); L(box(0.03, 0.02, 0.01), 0, -0.04, 0.088);
    const jaw: [number, number][] = [[-0.02, 0.01], [0.02, 0.012], [0.05, -0.05], [0.055, -0.16], [0.03, -0.22], [-0.01, -0.25], [-0.02, -0.22], [0.01, -0.17], [0.012, -0.08], [-0.02, -0.02]];
    b.use('mja_' + sfx, s).mat('steel');
    b.addL(plate(jaw, 0.05, 0.004), xf(0, 0, 0, 0, -90 * D, 0));
    b.use('mjb_' + sfx, s);
    b.addL(plate(jaw, 0.05, 0.004), xf(0, 0, 0, 0, 90 * D, 0));
  }
}

