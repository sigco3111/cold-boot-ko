/**
 * The taken soldier's BODY (stage 3c §8.2.1, W3a): a sailor of the Post 4 detachment in navy fatigues with knee and
 * elbow pads, a plate carrier (pouches, name tape, a speaker-mic radio on the left shoulder strap with a green LED),
 * gloves, combat boots, a high-cut helmet with goggles over a knit balaclava — no face, no skin anywhere — and the
 * Clasp on the nape below the helmet rim (3b's geometry at 1:1). Smoothly skinned on the human skeleton (Tomas's
 * bone layout, `human/model.ts`), plus weapon / magazine / mark bones.
 *
 * Model space: feet on y = 0, facing +Z, his LEFT is +X (as Tomas). Bind pose: standing straight, arms hanging.
 *
 * Material keys (one skinned mesh each, LOD0): fatigue · vest · tape (the name tape, a per-soldier texture) · helmet
 * (shell + goggle lenses) · knit (balaclava) · boot (boots, gloves, pads, straps, goggle frame, the Clasp's body) ·
 * gun_c (carbine) · gun_p (pistol) — one of the two is hidden per soldier · glow (every dark-room mark). LOD1: fatigue ·
 * vest (+tape) · helmet (+knit, boot) · gun_c / gun_p (reduced) · glow. Shadow proxy: one position-only mesh.
 *
 * Marks (`RigBuilder.mark`, scale = brightness; no light, no extra draw call):
 *   mk_clasp   — the Clasp LED (4 mm) + its 4 cm halo, red, BLINKING 1 Hz / 0.12 s on (per-soldier phase via the
 *                instance's glow material) — never cyan
 *   mk_clasp_f — the same LED, steady red: the 'fail' pattern (3 fast blinks, CPU-driven) uses it
 *   mk_radio   — the radio's green LED (steady)
 *   mk_light_c / mk_light_p — the weapon light's lens glint (white, toward what the light faces), on with the light
 */
import * as THREE from 'three';
import type { GameContext, MaterialName } from '../../core/types';
import { buildRigLods, glowMaterial, tintOf, type RigBuilder, type RigTemplate } from '../shared/rig';
import { DETAIL, box, patch, type V3 } from '../shared/prims';
import { HUMAN_DIM, chain, ellip, headPoint, hdir, libOr, loft, R, rigid, sm, vnoise, type Ring } from '../human/model';
import { C_BORE, C_MUZZLE } from '../../player/viewmodels/carbine';
import { P_BORE, P_MUZZLE_S } from '../../player/viewmodels/pistol';

const K = HUMAN_DIM;
const D = Math.PI / 180;

/** The 19 linked sailors of the Post 4 detachment (materials/screens4.ts `CREW`, linked rows): name-tape surnames. */
export const SOLDIER_NAMES = ['브레케', '솔베르그', '트베이트', '닐센', '룬드', '비크', '홀테', '미레', '바케', '세테르', '피엘드', '니고르', '뢰닝', '스트룀', '아우네', '에이데', '스코그', '볼드', '그란'] as const;

/** Body measures the runtime needs (model space). */
export const SOLDIER_DIM = {
  ...HUMAN_DIM,
  /** Right (sighting) eye, bind pose. */
  eyeR: new THREE.Vector3(-0.0315, 1.641, 0.085),
  eyeMid: new THREE.Vector3(0, 1.641, 0.085),
  /** Clasp centre on the nape (bind) and its outward normal (−Z = his back). */
  clasp: new THREE.Vector3(0, 1.548, -0.074),
  /** Chest point (corpse / radio): front of the sternum under the plate. */
  chest: new THREE.Vector3(0, 1.27, 0.06),
  /** Front mag pouch (reload): where the support hand takes a fresh magazine (bind). */
  pouch: new THREE.Vector3(0.0, 1.14, 0.2),
};
const S = SOLDIER_DIM;

/** Gun-space points of the two weapons (origin = top of the pistol grip, −Z muzzle, +Y up, +X right). */
export const GUN = {
  carbine: {
    muzzle: new THREE.Vector3(0, C_BORE, -C_MUZZLE - 0.004),
    /** Firing-hand grip centre (palm), the fore-end grip, the butt plate centre. */
    grip: new THREE.Vector3(0, -0.045, 0.028),
    fore: new THREE.Vector3(0, C_BORE - 0.03, -0.19),
    butt: new THREE.Vector3(0, 0.01, 0.29),
    /** Rear sight (eye line). */
    sight: new THREE.Vector3(0, 0.096, -0.002),
    /** Weapon light: body on the right of the handguard, lens forward. */
    light: new THREE.Vector3(0.031, C_BORE - 0.004, -0.336),
    magSeat: new THREE.Vector3(0, -0.002, -0.114),
    magLen: 0.17,
    charger: new THREE.Vector3(-0.03, 0.057, -0.178),
  },
  pistol: {
    muzzle: new THREE.Vector3(0, P_BORE, -P_MUZZLE_S - 0.004),
    grip: new THREE.Vector3(0, -0.05, 0.03),
    fore: new THREE.Vector3(0, -0.05, 0.03),
    butt: new THREE.Vector3(0, -0.11, 0.045),
    sight: new THREE.Vector3(0, 0.035, 0.0),
    light: new THREE.Vector3(0, -0.004, -0.15),
    magSeat: new THREE.Vector3(0, -0.015, 0.01),
    magLen: 0.11,
    charger: new THREE.Vector3(0, 0.02, 0.02),
  },
};

export interface SoldierTemplate {
  rig: RigTemplate;
  /** Base materials by key (the tape is per soldier: `tapeMaterial`). */
  mats: Record<string, THREE.Material>;
  /** Per-name tape materials (cached, shared by soldiers of the same name). */
  tape(name: string): THREE.Material;
}

// ───────────────────────────────────────────────────────────── template

export function buildSoldierTemplate(ctx: GameContext): SoldierTemplate {
  const M = ctx.materials;
  // the library's navy (0x4a5563 albedo) reads pale blue-grey under a close lamp on a whole figure: tinted down to a
  // dark navy (×0.47 / 0.52 / 0.64); the helmet a little as well
  const fatigue = libOr(ctx, 'fatigue_navy', 'fabric', { vertexColors: true, color: 0x7884a4 }, { color: 0x2a3648, roughness: 0.92, metalness: 0 });
  fatigue.name = 'soldier_fatigue';
  // plate carrier: `webbing` (W5, on main); the fabric fallback until then
  const vest = libOr(ctx, 'webbing' as MaterialName, 'fabric', { vertexColors: true }, { color: 0x262b33, roughness: 0.88, metalness: 0 });
  vest.name = 'soldier_vest';
  const helmet = libOr(ctx, 'helmet_navy', 'plastic_dark', { vertexColors: true, color: 0x8c95a8 }, { color: 0x2c3440, roughness: 0.8, metalness: 0.0, map: null, roughnessMap: null, metalnessMap: null, envMapIntensity: 0.5 });
  helmet.name = 'soldier_helmet';
  const knit = libOr(ctx, 'knit_black', 'fabric', { vertexColors: true }, { color: 0x141518, roughness: 1, metalness: 0 });
  knit.name = 'soldier_knit';
  const boot = M.clone('rubber', { color: 0x1a1b1e, roughness: 0.7, vertexColors: true });
  boot.name = 'soldier_boot';
  const gun = M.clone('gunmetal', { vertexColors: true });
  gun.name = 'soldier_gun';
  const tapeBase = vest;
  const mats: Record<string, THREE.Material> = { glow: glowMaterial(), fatigue, vest, tape: tapeBase, helmet, knit, boot, gun_c: gun, gun_p: gun };
  const { template } = buildRigLods(authorSoldier, mats, {
    radius: 1.6, center: new THREE.Vector3(0, 0.9, 0),
    lod: { k: 0.45, minFeature: 0.012, remap: { tape: 'vest', boot: 'helmet', knit: 'helmet' } },   // boots, gloves, pads and the balaclava stay dark (not the vest's olive) beyond 12 m
    proxy: { k: 0.3, minFeature: 0.03, exclude: ['glow', 'tape', 'gun_c', 'gun_p'] },
    colorize: { fatigue: clothShade, vest: vestShade, helmet: helmetShade, knit: knitShade, boot: bootShade },
  });
  const tapes = new Map<string, THREE.Material>();
  return {
    rig: template, mats,
    tape(name: string) {
      let m = tapes.get(name);
      if (!m) { m = tapeMaterial(ctx, name); tapes.set(name, m); }
      return m;
    },
  };
}

/** Name tape: a small canvas (light stitched letters on the vest's navy) mapped on the tape's model-space UVs. */
function tapeMaterial(ctx: GameContext, name: string): THREE.Material {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#20252c'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(160,170,180,0.35)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(5, 5, 246, 54);
  g.fillStyle = '#b9c0c6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = 44;
  g.font = `700 ${px}px "Arial Narrow", Arial, sans-serif`;
  while (g.measureText(name).width > 226 && px > 20) { px -= 2; g.font = `700 ${px}px "Arial Narrow", Arial, sans-serif`; }
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // the tape's UVs are model-space metres (RigBuilder.projectUV): x −TAPE.w/2 … +w/2, y TAPE.y0 … y0 + h
  tex.repeat.set(1 / TAPE.w, 1 / TAPE.h);
  tex.offset.set(0.5, -TAPE.y0 / TAPE.h);
  const m = ctx.materials.clone('fabric', { color: 0xffffff, map: tex, roughness: 0.9, metalness: 0, normalMap: null, roughnessMap: null, aoMap: null, metalnessMap: null });
  m.name = 'soldier_tape_' + name;
  return m;
}
const TAPE = { w: 0.13, h: 0.032, y0: 1.354, z: 0.166 };

// ───────────────────────────────────────────────────────────── authoring

const MARK_RED = tintOf(0xff1a08, 3.6);
const MARK_GREEN = tintOf(0x30ff60, 2.2);
const MARK_LENS = tintOf(0xfff2dc, 4.5);

function authorSoldier(b: RigBuilder): void {
  // ── skeleton: Tomas's layout (human/model.ts) without face bones ────────────────────────────────────────
  b.bone('hips', null, 0, K.hipsY, 0);
  b.bone('spine1', 'hips', 0, 1.06, -0.005);
  b.bone('spine2', 'spine1', 0, 1.22, -0.01);
  b.bone('neck', 'spine2', 0, 1.47, -0.02);
  b.bone('head', 'neck', 0, 1.556, -0.006);
  for (const [sfx, s] of [['l', 1], ['r', -1]] as const) {
    b.bone('clav_' + sfx, 'spine2', 0.03 * s, 1.43, -0.02);
    b.bone('uarm_' + sfx, 'clav_' + sfx, K.shoulderX * s, K.shoulderY, K.shoulderZ);
    b.bone('larm_' + sfx, 'uarm_' + sfx, K.shoulderX * s, K.shoulderY - K.uarm, K.shoulderZ);
    const wy = K.shoulderY - K.uarm - K.larm;
    b.bone('hand_' + sfx, 'larm_' + sfx, K.shoulderX * s, wy, K.shoulderZ);
    b.bone('fing_' + sfx, 'hand_' + sfx, K.shoulderX * s, wy - 0.088, K.shoulderZ + 0.004);
    b.bone('fing2_' + sfx, 'fing_' + sfx, K.shoulderX * s, wy - 0.128, K.shoulderZ + 0.004);
    b.bone('trig_' + sfx, 'hand_' + sfx, K.shoulderX * s, wy - 0.088, K.shoulderZ + 0.032);
    b.bone('thumb_' + sfx, 'hand_' + sfx, (K.shoulderX - 0.008) * s, wy - 0.022, K.shoulderZ + 0.026);
    b.bone('thigh_' + sfx, 'hips', K.hipX * s, K.hipY, 0);
    b.bone('shin_' + sfx, 'thigh_' + sfx, K.hipX * s, K.hipY - K.thigh, 0.004);
    b.bone('foot_' + sfx, 'shin_' + sfx, K.hipX * s, K.ankle, -0.004);
  }
  // weapon + magazines: top-level bones whose bind frame is gun space at the model origin (the runtime sets them
  // in model space each frame); the magazine geometry is authored in gun space for all three
  b.bone('wpn', null, 0, 0, 0);
  b.bone('mag', null, 0, 0, 0);
  b.bone('magDrop', null, 0, 0, 0);
  b.bone('mag2', null, 0, 0, 0);
  b.bone('mk_light_c', 'wpn', 0, 0, 0);
  b.bone('mk_light_p', 'wpn', 0, 0, 0);
  b.bone('mk_clasp', 'neck', S.clasp.x, S.clasp.y, S.clasp.z);
  b.bone('mk_clasp_f', 'neck', S.clasp.x, S.clasp.y, S.clasp.z);
  b.bone('mk_radio', 'spine2', 0.094, 1.432, 0.105);

  const torsoW = chain(['hips', 'spine1', 'spine2', 'neck'], [[0, 0.85, 0], [0, 1.06, -0.005], [0, 1.22, -0.01], [0, 1.47, -0.02], [0, 1.6, -0.02]], [0, 0.06, 0.07, 0.025]);
  const shoulderBlend = (w0: (p: THREE.Vector3) => [string, number][]) => (p: THREE.Vector3): [string, number][] => {
    const base = w0(p);
    const side = p.x >= 0 ? 'l' : 'r';
    const w = sm(0.11, 0.17, Math.abs(p.x)) * sm(1.3, 1.4, p.y) * 0.55;
    if (w <= 0) return base;
    return [...base.map(([n, ww]) => [n, ww * (1 - w)] as [string, number]), ['uarm_' + side, w]];
  };

  // ── fatigues: blouse torso (mostly under the vest), collar, long sleeves with cuffs ──────────────────────
  b.use('spine2').mat('fatigue');
  b.addSkinned(creased(loft([
    R(0, 0.95, 0.0, 0.152, 0.1, 2.5), R(0, 1.05, 0.002, 0.146, 0.096, 2.5), R(0, 1.16, 0.01, 0.152, 0.1, 2.4), R(0, 1.27, 0.014, 0.165, 0.106, 2.5),
    R(0, 1.36, 0.008, 0.176, 0.104, 2.5), R(0, 1.41, 0.0, 0.18, 0.098, 2.4), R(0, 1.445, -0.008, 0.15, 0.086, 2.3), R(0, 1.475, -0.016, 0.085, 0.07, 2.2),
    R(0, 1.49, -0.018, 0.064, 0.06, 2.1)], 30, { sub: 4, capA: true, capB: false })), shoulderBlend(torsoW));
  // collar: a stand-up band round the balaclava's neck
  b.addSkinned(loft([R(0, 1.46, -0.016, 0.078, 0.072, 2.2), R(0, 1.5, -0.017, 0.07, 0.066, 2.2), R(0, 1.525, -0.018, 0.068, 0.064, 2.2)], 20, { sub: 2, capA: false, capB: false }),
    chain(['spine2', 'neck'], [[0, 1.4, -0.02], [0, 1.47, -0.02], [0, 1.6, -0.02]], [0, 0.03]));
  for (const s of [-1, 1]) {
    const sfx = s > 0 ? 'l' : 'r', x = K.shoulderX * s, z = K.shoulderZ;
    const wy = K.shoulderY - K.uarm - K.larm;
    const armW = chain(['spine2', 'uarm_' + sfx, 'larm_' + sfx, 'hand_' + sfx], [[0.06 * s, 1.44, z], [x, K.shoulderY, z], [x, K.shoulderY - K.uarm, z], [x, wy, z], [x, wy - 0.1, z]], [0, 0.055, 0.05, 0.03]);
    // the sleeve's cap is buried in the shoulder (deltoid); slightly baggy, gathered at the cuff
    b.addSkinned(creased(loft([R(x - 0.05 * s, 1.44, z, 0.03, 0.045), R(x - 0.012 * s, 1.425, z, 0.05, 0.058), R(x + 0.004 * s, 1.38, z, 0.056, 0.06), R(x + 0.002 * s, 1.3, z, 0.053, 0.056),
      R(x, 1.2, z - 0.002, 0.049, 0.052), R(x, 1.14, z - 0.004, 0.047, 0.05), R(x, 1.07, z, 0.046, 0.047), R(x, 0.99, z, 0.042, 0.04), R(x, 0.935, z, 0.036, 0.034), R(x, 0.915, z, 0.038, 0.036)], 18,
      { sub: 6, capA: true, capB: false })), armW);
    // shoulder pocket flap on the upper sleeve (outer face)
    b.addSkinned(box(0.012, 0.07, 0.06, 0.004), armW, new THREE.Matrix4().makeTranslation(x + 0.054 * s, 1.31, z + 0.004));
  }
  // ── trousers: pelvis, legs (baggy, cargo pockets), bloused at the boot ─────────────────────────────────
  {
    const pelvW = (p: THREE.Vector3): [string, number][] => {
      const sd = p.x >= 0 ? 'l' : 'r';
      const wt = sm(0.94, 0.8, p.y) * sm(0.01, 0.06, Math.abs(p.x)) * 0.85;
      return [['hips', 1 - wt], ['thigh_' + sd, wt]];
    };
    b.use('hips').mat('fatigue');
    b.addSkinned(creased(loft([R(0, 1.04, 0.0, 0.15, 0.098, 2.4), R(0, 0.98, 0.0, 0.16, 0.106, 2.4), R(0, 0.92, -0.004, 0.168, 0.112, 2.5), R(0, 0.86, -0.004, 0.162, 0.108, 2.5), R(0, 0.82, -0.002, 0.115, 0.084, 2.3)], 28, { sub: 5 })), pelvW);
  }
  for (const s of [-1, 1]) {
    const sfx = s > 0 ? 'l' : 'r', x = K.hipX * s;
    const legW = chain(['hips', 'thigh_' + sfx, 'shin_' + sfx, 'foot_' + sfx], [[x, 1.0, 0], [x, K.hipY, 0], [x, K.hipY - K.thigh, 0.004], [x, K.ankle, -0.004], [x, -0.05, 0]], [0, 0.07, 0.06, 0.05]);
    b.mat('fatigue');
    b.addSkinned(creased(loft([R(x + 0.006 * s, 0.92, -0.004, 0.09, 0.094), R(x + 0.002 * s, 0.8, 0.004, 0.086, 0.088), R(x, 0.66, 0.006, 0.077, 0.08), R(x, 0.53, 0.012, 0.069, 0.072), R(x, 0.47, 0.01, 0.067, 0.07),
      R(x, 0.36, -0.004, 0.066, 0.068), R(x, 0.27, -0.004, 0.068, 0.07), R(x, 0.215, 0.0, 0.072, 0.075), R(x, 0.19, 0.0, 0.064, 0.068)], 22, { sub: 6 })), legW);
    // cargo pocket with flap on the outer thigh
    b.addSkinned(loft([R(x + 0.078 * s, 0.73, 0.0, 0.014, 0.052, 3), R(x + 0.082 * s, 0.63, 0.002, 0.018, 0.055, 3), R(x + 0.078 * s, 0.575, 0.004, 0.012, 0.05, 3)], 12, { sub: 2 }), legW);
    b.addSkinned(box(0.02, 0.022, 0.115, 0.004), legW, new THREE.Matrix4().makeTranslation(x + 0.088 * s, 0.735, 0.001));
    // knee pad (rubber cap + strap)
    b.mat('boot');
    b.addSkinned(patch((u, v, out) => {
      const a = (-0.62 + 1.24 * u) * Math.PI / 2, y = 0.43 + v * 0.13;
      const r = 0.077 + 0.012 * Math.sin(v * Math.PI);
      out.set(x + Math.sin(a) * r, y, 0.012 + Math.cos(a) * r);
    }, { nu: 10, nv: 4, thickness: 0.012 }), legW);
    b.addSkinned(loft([R(x, 0.495, 0.004, 0.073, 0.076), R(x, 0.475, 0.004, 0.073, 0.076)], 16, { sub: 1, capA: false, capB: false }), legW);
  }
  // elbow pads
  for (const s of [-1, 1]) {
    const sfx = s > 0 ? 'l' : 'r', x = K.shoulderX * s, z = K.shoulderZ, ey = K.shoulderY - K.uarm;
    const elW = chain(['uarm_' + sfx, 'larm_' + sfx], [[x, K.shoulderY, z], [x, ey, z], [x, ey - 0.25, z]], [0, 0.035]);
    b.mat('boot');
    b.addSkinned(patch((u, v, out) => {
      const a = Math.PI + (-0.55 + 1.1 * u) * Math.PI / 2, y = ey - 0.06 + v * 0.12;
      const r = 0.053 + 0.008 * Math.sin(v * Math.PI);
      out.set(x + Math.sin(a) * r, y, z + Math.cos(a) * r);
    }, { nu: 8, nv: 4, thickness: 0.01 }), elW);
  }
  // ── boots: tall shaft, laces block, heavy sole ─────────────────────────────────────────────────────────
  b.mat('boot');
  for (const s of [-1, 1]) {
    const sfx = s > 0 ? 'l' : 'r', x = K.hipX * s;
    const bw = chain(['shin_' + sfx, 'foot_' + sfx], [[x, 0.35, 0], [x, K.ankle, -0.004], [x, 0, 0.2]], [0, 0.035]);
    b.addSkinned(loft([R(x, 0.235, -0.006, 0.058, 0.062), R(x, 0.17, -0.006, 0.055, 0.06), R(x, 0.1, -0.002, 0.056, 0.066), R(x, 0.06, 0.03, 0.054, 0.055, 2.6), R(x + 0.004 * s, 0.05, 0.09, 0.052, 0.046, 2.6),
      R(x + 0.006 * s, 0.043, 0.155, 0.047, 0.036, 2.4), R(x + 0.006 * s, 0.038, 0.185, 0.038, 0.012, 2.2)], 16, { sub: 3, front: new THREE.Vector3(0, 1, 0) }), bw);
    b.addSkinned(loft([R(x, 0.02, -0.085, 0.056, 0.02, 3), R(x + 0.004 * s, 0.018, 0.05, 0.061, 0.02, 3), R(x + 0.006 * s, 0.017, 0.18, 0.046, 0.017, 3)], 12, { sub: 2, front: new THREE.Vector3(0, 1, 0) }), rigid('foot_' + sfx));
    // blousing band at the shaft top
    b.addSkinned(loft([R(x, 0.245, -0.004, 0.064, 0.068), R(x, 0.228, -0.004, 0.064, 0.068)], 16, { sub: 1, capA: false, capB: false }), bw);
  }
  // ── gloves (hands) ──────────────────────────────────────────────────────────────────────────────────────
  b.mat('boot');
  for (const s of [-1, 1]) {
    const sfx = s > 0 ? 'l' : 'r', x = K.shoulderX * s, z = K.shoulderZ;
    const wy = K.shoulderY - K.uarm - K.larm;
    // cuff over the sleeve end
    b.addSkinned(loft([R(x, 0.95, z, 0.038, 0.036), R(x, 0.915, z, 0.035, 0.032), R(x, wy + 0.005, z + 0.002, 0.026, 0.03)], 14, { sub: 2, capA: false }),
      chain(['larm_' + sfx, 'hand_' + sfx], [[x, 1.0, z], [x, wy, z], [x, wy - 0.1, z]], [0, 0.015]));
    const handW = chain(['hand_' + sfx, 'fing_' + sfx], [[x, wy, z], [x, wy - 0.088, z], [x, wy - 0.2, z]], [0, 0.012]);
    b.addSkinned(loft([R(x, wy + 0.004, z + 0.003, 0.02, 0.024, 2.4), R(x, wy - 0.035, z + 0.004, 0.017, 0.045, 2.8), R(x + 0.002 * s, wy - 0.08, z + 0.004, 0.014, 0.046, 3), R(x + 0.002 * s, wy - 0.095, z + 0.004, 0.012, 0.043, 2.6)], 14, { sub: 2 }), handW);
    // knuckle guard on the back of the hand
    b.addSkinned(box(0.006, 0.03, 0.07, 0.003), handW, new THREE.Matrix4().makeTranslation(x + 0.016 * s, wy - 0.07, z + 0.004));
    const fz = [0.029, 0.0095, -0.009, -0.027], fl = [0.074, 0.082, 0.078, 0.062], fr = [0.0095, 0.0098, 0.0092, 0.0084];
    for (let i = 0; i < 4; i++) {
      const y0 = wy - 0.084, zz = z + 0.004 + fz[i], L = fl[i], r = fr[i];
      const bone = i === 0 ? 'trig_' + sfx : 'fing_' + sfx;
      const fW = i === 0
        ? chain(['hand_' + sfx, 'trig_' + sfx], [[x, wy, zz], [x, wy - 0.088, zz], [x, y0 - L - 0.02, zz]], [0, 0.008])
        : chain(['hand_' + sfx, bone, 'fing2_' + sfx], [[x, wy, zz], [x, wy - 0.088, zz], [x, wy - 0.128, zz], [x, y0 - L - 0.02, zz]], [0, 0.008, 0.008]);
      b.addSkinned(loft([R(x + 0.0012 * s, y0, zz, r * 1.05, r * 1.1), R(x + 0.001 * s, y0 - L * 0.5, zz, r * 0.95, r), R(x, y0 - L * 0.92, zz, r * 0.82, r * 0.86), R(x - 0.001 * s, y0 - L, zz, r * 0.45, r * 0.5)], 8, { sub: 2 }), fW);
    }
    const tw = chain(['hand_' + sfx, 'thumb_' + sfx], [[x, wy, z + 0.02], [x - 0.008 * s, wy - 0.022, z + 0.026], [x - 0.012 * s, wy - 0.08, z + 0.05]], [0, 0.01]);
    b.addSkinned(loft([R(x - 0.004 * s, wy - 0.012, z + 0.022, 0.012, 0.013), R(x - 0.01 * s, wy - 0.04, z + 0.036, 0.01, 0.0105), R(x - 0.013 * s, wy - 0.064, z + 0.046, 0.009, 0.0095), R(x - 0.014 * s, wy - 0.076, z + 0.05, 0.0045, 0.0045)], 8, { sub: 2, front: new THREE.Vector3(1, 0, 0) }), tw);
  }

  // ── head: knit balaclava over the skull (face shape softened), neck tube ───────────────────────────────
  const headW = (p: THREE.Vector3): [string, number][] => {
    const wn = sm(1.575, 1.53, p.y) * 0.7;
    return [['neck', wn], ['head', 1 - wn]];
  };
  b.use('head').mat('knit');
  b.addSkinned(patch((u, v, out) => {
    const a = (u * 2 - 1) * Math.PI, e = -1.15 + v * (Math.PI / 2 + 1.15 - 0.001);
    const p = headPoint(a, Math.min(Math.PI / 2 - 0.001, e), out);
    const n = hdir(a, e, new THREE.Vector3());
    // knit over it: thicker over the crown and the back, the face features soften
    p.addScaledVector(n, 0.004 + 0.002 * sm(0.0, 1.2, e));
    // the lower edge flares into the neck tube
    if (e < -0.6) { const k = sm(-0.6, -1.15, e); p.x *= 1 - 0.18 * k; p.z = p.z * (1 - 0.2 * k) - 0.012 * k; }
    return p;
  }, { nu: 40, nv: 22, thickness: 0.004 }), headW);
  b.addSkinned(loft([R(0, 1.45, -0.018, 0.064, 0.06), R(0, 1.5, -0.016, 0.058, 0.056), R(0, 1.56, -0.01, 0.054, 0.056), R(0, 1.6, -0.004, 0.056, 0.062)], 18, { sub: 2, capA: false, capB: false }),
    chain(['spine2', 'neck', 'head'], [[0, 1.3, -0.02], [0, 1.47, -0.02], [0, 1.556, -0.006], [0, 1.65, 0]], [0, 0.03, 0.03]));

  // ── goggles: rubber frame round both eyes, dark lenses with a grey sheen, strap round the helmet ─────────
  {
    const fy = 1.643, fz = 0.094;
    b.mat('boot');
    const fr: Ring[] = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = t * Math.PI * 2;
      // goggle outline: wide superellipse, a nose notch at the bottom middle
      const x = Math.sin(a) * 0.068, yy = Math.cos(a) * 0.027 * (1 - 0.35 * Math.exp(-((x / 0.012) ** 2)) * (Math.cos(a) < 0 ? 1 : 0));
      const zc = fz - 0.55 * x * x / 0.07 - 0.004;
      fr.push({ c: new THREE.Vector3(x, fy + yy, zc), rx: 0.006, rz: 0.008, n: 2.4 });
    }
    b.addSkinned(loft(fr, 6, { sub: 1, capA: false, capB: false, front: new THREE.Vector3(0, 0, 1) }), rigid('head'));
    // strap: from the frame's sides round the back of the helmet
    const st: Ring[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = 1.05 + (i / 16) * (Math.PI * 2 - 2.1);
      st.push({ c: new THREE.Vector3(Math.sin(a) * 0.112, 1.668 + 0.01 * Math.cos(a), Math.cos(a) * 0.118 - 0.006), rx: 0.0022, rz: 0.014, n: 2.6 });
    }
    b.addSkinned(loft(st, 6, { sub: 2, capA: false, capB: false, front: new THREE.Vector3(0, 1, 0) }), rigid('head'));
    // lenses (helmet key, coloured dark with a sheen by helmetShade)
    b.mat('helmet');
    for (const s of [-1, 1]) {
      b.addSkinned(patch((u, v, out) => {
        const x = s * (0.004 + u * 0.06), yy = (v - 0.5) * 0.048 * (1 - 0.3 * u * u);
        out.set(x, fy + yy, fz + 0.002 - 0.55 * x * x / 0.07);
      }, { nu: 6, nv: 3, thickness: 0.002, flip: s < 0 }), rigid('head'));
    }
  }

  // ── helmet: high-cut shell, rim trim, NVG shroud, side rails, chin strap ───────────────────────────────
  {
    b.mat('helmet');
    const rimE = (a: number) => {
      // elevation of the rim (rad on the head ellipsoid): high at the brow, cut over the ears, low at the back
      const c = Math.cos(a), sAbs = Math.abs(Math.sin(a));
      return 0.33 * Math.max(0, c) ** 1.4 - 0.16 * sAbs ** 2 * (c > -0.3 ? 1 : 0.4) - 0.2 * Math.max(0, -c) ** 1.2 + 0.05;
    };
    const off = (e: number) => 0.024 + 0.006 * sm(0.2, 1.4, e);
    b.addSkinned(patch((u, v, out) => {
      const a = (u * 2 - 1) * Math.PI, e0 = rimE(a), e = e0 + v * (Math.PI / 2 - 0.001 - e0);
      const p = headPoint(a, e, out);
      p.addScaledVector(hdir(a, e, new THREE.Vector3()), off(e));
      p.y += 0.004;
      return p;
    }, { nu: 40, nv: 12, thickness: 0.008 }), rigid('head'));
    // rim trim (rubber edge)
    b.mat('boot');
    const rim: Ring[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40 * 2 - 1) * Math.PI, e = rimE(a);
      const p = headPoint(a, e, new THREE.Vector3()).addScaledVector(hdir(a, e, new THREE.Vector3()), off(e) - 0.003);
      p.y += 0.004;
      rim.push({ c: p, rx: 0.0055, rz: 0.0055 });
    }
    b.addSkinned(loft(rim, 6, { sub: 1, capA: false, capB: false, front: new THREE.Vector3(0, 1, 0) }), rigid('head'));
    // NVG shroud on the brow, side rails, a small strobe box at the back
    b.mat('helmet');
    b.addSkinned(box(0.042, 0.034, 0.016, 0.005), rigid('head'), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.735, 0.118), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0)), new THREE.Vector3(1, 1, 1)));
    for (const s of [-1, 1]) b.addSkinned(box(0.012, 0.018, 0.085, 0.004), rigid('head'), new THREE.Matrix4().compose(new THREE.Vector3(s * 0.106, 1.69, 0.005), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, s * 0.06, s * -0.18)), new THREE.Vector3(1, 1, 1)));
    b.addSkinned(box(0.03, 0.022, 0.014, 0.004), rigid('head'), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.735, -0.13), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0)), new THREE.Vector3(1, 1, 1)));
    // chin strap (rubber key): from each side down under the jaw
    b.mat('boot');
    for (const s of [-1, 1]) {
      const pts: V3[] = [[s * 0.098, 1.648, 0.012], [s * 0.088, 1.6, 0.03], [s * 0.066, 1.558, 0.055], [s * 0.03, 1.538, 0.068], [0, 1.535, 0.07]];
      b.addSkinned(loft(pts.map((p) => ({ c: new THREE.Vector3(...p), rx: 0.0024, rz: 0.008, n: 2.6 })), 6, { sub: 2, capA: false, capB: false, front: new THREE.Vector3(1, 0, 0) }), rigid('head'));
    }
  }

  // ── the Clasp on the nape (3b's geometry at 1:1: 9 × 6 × 2 cm, curved r 6.5 cm round the neck) ─────────
  {
    b.mat('boot');
    const m = new THREE.Matrix4().compose(S.clasp, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new THREE.Vector3(1, 1, 1));
    for (const g of claspGeos()) b.addSkinned(g, rigid('neck'), m);
    // LED mark (the shared mark shader draws its glow): face his back, read within ±60° of behind (faceMin 0.05 → full from 60°)
    const led = new THREE.Vector3(0, 0.021, 0.0175 + 0.0015).applyMatrix4(m);
    const n = new THREE.Vector3(0, 0.15, -1);
    b.mark('mk_clasp', led, n, 0.0028, MARK_RED, 0.05, { blink: { hz: 1, on: 0.12 } });
    b.mark('mk_clasp_f', led, n, 0.0028, MARK_RED, 0.05);
  }

  // ── plate carrier ─────────────────────────────────────────────────────────────────────────────────────
  {
    b.use('spine2').mat('vest');
    const vw = (p: THREE.Vector3): [string, number][] => {
      // the carrier rides the chest; its lower edge follows the belly a little
      const wl = sm(1.2, 1.06, p.y) * 0.5;
      return [['spine2', 1 - wl], ['spine1', wl]];
    };
    // front + back plates (curved slabs)
    const plate = (zc: number, front: number) => patch((u, v, out) => {
      const x = (u - 0.5) * 0.29, y = 1.055 + v * 0.35;
      // rounded top corners (shooter's cut) by pulling the corners in
      const cut = sm(0.75, 1, v) * sm(0.32, 0.5, Math.abs(u - 0.5)) * 0.04;
      out.set(x * (1 - cut / 0.145), y - cut * 0.4, zc + front * (0.012 - 0.33 * x * x));
    }, { nu: 10, nv: 8, thickness: 0.034, flip: front < 0 });
    b.addSkinned(plate(0.166, 1), vw);
    b.addSkinned(plate(-0.124, -1), vw);
    // cummerbund: band round the flanks joining the plates
    b.addSkinned(loft([R(0, 1.06, 0.018, 0.172, 0.142, 3.2), R(0, 1.13, 0.018, 0.176, 0.146, 3.2), R(0, 1.2, 0.02, 0.18, 0.148, 3.2)], 28, { sub: 2, capA: false, capB: false }), vw);
    // shoulder straps: over the trapezius from the front plate's top to the back plate's top
    for (const s of [-1, 1]) {
      const pts: V3[] = [[s * 0.088, 1.39, 0.155], [s * 0.094, 1.445, 0.11], [s * 0.098, 1.478, 0.03], [s * 0.096, 1.468, -0.05], [s * 0.088, 1.41, -0.112]];
      b.addSkinned(loft(pts.map((p) => ({ c: new THREE.Vector3(...p), rx: 0.034, rz: 0.008, n: 3 })), 8, { sub: 3, capA: true, capB: true, front: new THREE.Vector3(1, 0, 0) }), (p) => {
        const w = sm(0.13, 0.17, Math.abs(p.x)) * 0.3;
        return [['spine2', 1 - w], ['uarm_' + (p.x >= 0 ? 'l' : 'r'), w]];
      });
    }
    // three magazine pouches on the front with flaps, an admin pouch above them
    for (const x of [-0.084, 0, 0.084]) {
      b.addSkinned(box(0.072, 0.105, 0.04, 0.008), vw, new THREE.Matrix4().makeTranslation(x, 1.135, 0.2));
      b.addSkinned(box(0.076, 0.026, 0.046, 0.006), vw, new THREE.Matrix4().makeTranslation(x, 1.195, 0.201));
    }
    b.addSkinned(box(0.15, 0.06, 0.022, 0.006), vw, new THREE.Matrix4().makeTranslation(0, 1.29, 0.188));
    // radio pouch on the back plate (left), antenna up past the shoulder
    b.addSkinned(box(0.062, 0.125, 0.044, 0.008), rigid('spine2'), new THREE.Matrix4().makeTranslation(0.075, 1.27, -0.163));
    b.mat('boot');
    b.addSkinned(loft([R(0.088, 1.33, -0.168, 0.006, 0.006), R(0.092, 1.45, -0.172, 0.0045, 0.0045), R(0.098, 1.58, -0.18, 0.0028, 0.0028)], 6, { sub: 2 }), rigid('spine2'));
    // speaker-mic clipped on the left shoulder strap + its coiled lead to the back
    b.addSkinned(box(0.036, 0.062, 0.022, 0.006), rigid('spine2'), new THREE.Matrix4().compose(new THREE.Vector3(0.094, 1.4, 0.132), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0)), new THREE.Vector3(1, 1, 1)));
    b.addSkinned(loft([R(0.105, 1.39, 0.12, 0.004, 0.004), R(0.13, 1.37, 0.06, 0.005, 0.005), R(0.14, 1.33, -0.04, 0.005, 0.005), R(0.1, 1.3, -0.15, 0.004, 0.004)], 6, { sub: 3 }), rigid('spine2'));
    b.mark('mk_radio', new THREE.Vector3(0.094, 1.432, 0.142), new THREE.Vector3(0, 0.6, 0.8), 0.0022, MARK_GREEN, -0.6);
    // belt with a pistol holster on the right hip and two pouches at the back
    b.use('hips').mat('vest');
    b.addSkinned(loft([R(0, 0.985, 0.0, 0.17, 0.114, 3), R(0, 1.03, 0.0, 0.165, 0.11, 3)], 28, { sub: 1, capA: false, capB: false }), rigid('hips'));
    b.addSkinned(box(0.04, 0.15, 0.07, 0.01), (p) => [['hips', sm(0.86, 0.98, p.y)], ['thigh_r', 1 - sm(0.86, 0.98, p.y)]], new THREE.Matrix4().compose(new THREE.Vector3(-0.185, 0.9, 0.01), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0.06)), new THREE.Vector3(1, 1, 1)));
    for (const x of [-0.07, 0.07]) b.addSkinned(box(0.07, 0.08, 0.04, 0.008), rigid('hips'), new THREE.Matrix4().makeTranslation(x, 0.98, -0.13));
    // name tape (its own key: the per-soldier texture)
    b.use('spine2').mat('tape');
    const tg = new THREE.PlaneGeometry(TAPE.w, TAPE.h).toNonIndexed();
    tg.translate(0, TAPE.y0 + TAPE.h / 2, TAPE.z + 0.014);
    b.addSkinned(tg, rigid('spine2'));
  }

  // ── weapons (gun space on the 'wpn' bone), their magazines on mag / magDrop / mag2, the lights' glints ──
  for (const kind of ['carbine', 'pistol'] as const) {
    const key = kind === 'carbine' ? 'gun_c' : 'gun_p';
    const parts = weaponGeos(kind);
    b.use('wpn').mat(key);
    for (const g of parts.body) b.addL(g);
    for (const bone of ['mag', 'magDrop', 'mag2']) { b.use(bone).mat(key); for (const g of parts.mag) b.addL(g.clone()); }
    for (const g of parts.mag) g.dispose();
    const G = GUN[kind];
    const lens = G.light.clone().add(new THREE.Vector3(0, 0, -0.004));
    b.use('wpn');
    // the lit lens seen from in front of it flares (12 cm disc: ≈ 11 px at 8 m, 6 px at 15 m, 3.5 px at 25 m in 1080p), dims off-axis
    b.mark(kind === 'carbine' ? 'mk_light_c' : 'mk_light_p', lens, new THREE.Vector3(0, 0, -1), 0.06, MARK_LENS, 0.45);
  }
}

// ───────────────────────────────────────────────────────────── weapons

const POLY: [number, number, number] = [0.2, 0.21, 0.22], METAL: [number, number, number] = [0.62, 0.64, 0.66], SMOKE: [number, number, number] = [0.38, 0.41, 0.44];
const SG_GRIP = [[0.008, -0.006], [0.002, -0.03], [-0.012, -0.07], [-0.022, -0.103], [-0.064, -0.098], [-0.058, -0.07], [-0.046, -0.03], [-0.04, -0.004]];
const SG_GUARD = [[0.012, -0.008], [0.076, -0.008], [0.078, -0.022], [0.072, -0.044], [0.055, -0.049], [0.018, -0.046], [0.006, -0.03]];
const P_GRIP = [[0.017, -0.009], [0.0145, -0.028], [0.004, -0.062], [-0.004, -0.097], [-0.0115, -0.1135], [-0.0595, -0.1075], [-0.0535, -0.068], [-0.0375, -0.021], [-0.0405, -0.0075], [-0.03, -0.0008], [0.0, -0.004]];

/** A prism from a side outline in (s, t) = (toward the muzzle, up), `w` wide across X, centred on x0. Gun space. */
function prism(pts: number[][], w: number, x0 = 0, bevel = 0): THREE.BufferGeometry {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 2 });
  // shape (x = s, y = t, z = depth) → gun (x = depth − w/2, y = t, z = −s)
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
  m.setPosition(x0 - w / 2 + bevel, 0, 0);
  g.applyMatrix4(m);
  const o = g.index ? g.toNonIndexed() : g;
  if (o !== g) g.dispose();
  o.deleteAttribute('uv'); o.computeVertexNormals();
  return o;
}
/** Box in gun space from s0…s1 (toward the muzzle), t0…t1, width w. */
function sbox(s0: number, s1: number, t0: number, t1: number, w: number, x = 0, ch = 0.002): THREE.BufferGeometry {
  const g = box(w, t1 - t0, s1 - s0, Math.min(ch, w * 0.3, (t1 - t0) * 0.3));
  g.translate(x, (t0 + t1) / 2, -(s0 + s1) / 2);
  return g;
}
/** Cylinder along the bore (−Z) from s0 to s1 at height t. */
function sbore(s0: number, s1: number, r: number, t: number, x = 0, segs = 10): THREE.BufferGeometry {
  return cylZ(r, s1 - s0, x, t, -(s0 + s1) / 2, segs);
}
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, Math.max(5, Math.round(8 * DETAIL.k)));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const o = g.toNonIndexed(); g.dispose();
  o.deleteAttribute('uv');
  return o;
}
function tint(g: THREE.BufferGeometry, c: [number, number, number]): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/**
 * World-scale weapons on the player's guns' dimensions (player/viewmodels carbine.ts "Halvard K5", pistol.ts "VK-12"):
 * the same outline, grip, sight line, muzzle and magazine seat, built low-poly (the viewmodels are 40–55 k triangles).
 * Gun space: origin = top of the pistol grip, −Z muzzle, +Y up, +X right. Vertex colours: polymer / steel / smoke.
 */
function weaponGeos(kind: 'carbine' | 'pistol'): { body: THREE.BufferGeometry[]; mag: THREE.BufferGeometry[] } {
  const body: THREE.BufferGeometry[] = [], mag: THREE.BufferGeometry[] = [];
  const P = (g: THREE.BufferGeometry) => body.push(tint(g, POLY));
  const Mt = (g: THREE.BufferGeometry) => body.push(tint(g, METAL));
  if (kind === 'carbine') {
    const RT = 0.071;
    P(prism([[-0.036, 0.029], [0.172, 0.029], [0.175, 0.006], [0.148, -0.034], [0.08, -0.034], [0.078, -0.012], [-0.012, -0.012], [-0.03, -0.002]], 0.03, 0, 0.002));
    P(prism(SG_GRIP, 0.031, 0, 0.003));
    P(prism(SG_GUARD, 0.012));
    Mt(sbox(-0.045, 0.205, 0.028, RT, 0.032));                       // upper
    Mt(sbox(-0.035, 0.325, RT, RT + 0.007, 0.019));                  // carry rail
    Mt(sbox(-0.006, 0.014, RT + 0.007, RT + 0.026, 0.018));          // rear sight
    Mt(sbox(0.304, 0.326, RT + 0.007, RT + 0.031, 0.016));           // front sight
    P(sbox(0.205, 0.34, C_BORE - 0.026, C_BORE + 0.024, 0.045, 0, 0.008)); // handguard
    Mt(sbox(0.342, 0.362, C_BORE - 0.006, C_BORE + 0.024, 0.022));   // gas block
    Mt(sbore(0.335, 0.447, 0.0082, C_BORE));
    Mt(sbore(0.445, C_MUZZLE, 0.0108, C_BORE));                      // flash hider
    Mt(sbox(-0.06, -0.045, -0.002, 0.062, 0.03));                    // stock hinge block
    Mt(strut(new THREE.Vector3(0, 0.054, 0.058), new THREE.Vector3(0, 0.022, 0.288), 0.0074));
    Mt(strut(new THREE.Vector3(0, 0.006, 0.058), new THREE.Vector3(0, -0.088, 0.27), 0.0064));
    P(sbox(-0.232, -0.148, 0.028, 0.044, 0.026, 0, 0.004));          // cheek pad
    P(sbox(-0.298, -0.278, -0.118, 0.038, 0.034, 0, 0.005));         // butt plate
    Mt(sbox(0.165, 0.19, 0.045, 0.069, 0.004, -0.0175));            // charging handle (left)
    // magazine: curved 30-rounder, three straight segments down its curve (seat (0, −0.002, −0.114))
    const segs: [number, number][] = [[0, 0.06], [0.06, 0.115], [0.115, 0.168]];
    for (const [a0, a1] of segs) {
      const sh = (t: number) => 0.036 * (t / 0.168) ** 2 + 0.006 * (t / 0.168);
      const g = box(0.0225, a1 - a0 + 0.004, 0.057, 0.003);
      const mid = (a0 + a1) / 2, ang = Math.atan2(0.036 * 2 * mid / 0.168 ** 2 + 0.006 / 0.168, 1);
      g.rotateX(-ang);
      g.translate(0, -0.002 - mid, -(0.114 + sh(mid)));
      mag.push(tint(g, SMOKE));
    }
  } else {
    Mt(sbox(-0.029, 0.169, 0.0005, 0.031, 0.0245, 0, 0.004));       // slide
    P(prism([[-0.03, 0.0005], [0.161, 0.0005], [0.1635, -0.005], [0.159, -0.0168], [0.058, -0.0168], [0.05, -0.0142], [0.012, -0.0142], [-0.031, -0.009]], 0.022));
    P(prism(P_GRIP, 0.03, 0, 0.003));
    P(prism([[0.012, -0.0125], [0.0715, -0.0135], [0.0755, -0.02], [0.0745, -0.0405], [0.0605, -0.0468], [0.0185, -0.0452], [0.0075, -0.0405]], 0.01));
    Mt(sbox(0.155, 0.165, 0.031, 0.036, 0.004));                    // front sight
    Mt(sbox(-0.024, -0.012, 0.031, 0.037, 0.016));                  // rear sight
    // magazine (inside the grip; seen when it drops): base plate + a body raked like the grip
    const g = box(0.022, 0.108, 0.032, 0.003);
    g.rotateX(-0.28);
    g.translate(0, -0.015 - 0.054, 0.01 + 0.015);
    mag.push(tint(g, METAL));
  }
  // the weapon light: a short tube with a bezel and a mount
  const G = GUN[kind];
  const light = kind === 'carbine'
    ? [cylZ(0.012, 0.075, G.light.x, G.light.y, G.light.z + 0.04), cylZ(0.0145, 0.016, G.light.x, G.light.y, G.light.z + 0.004), boxAt(0.014, 0.012, 0.03, G.light.x - 0.012, G.light.y, G.light.z + 0.045)]
    : [boxAt(0.026, 0.022, 0.052, 0, G.light.y - 0.004, G.light.z + 0.03), cylZ(0.0105, 0.01, 0, G.light.y - 0.004, G.light.z + 0.002)];
  for (const l of light) body.push(tint(l, [0.22, 0.22, 0.22]));
  return { body, mag };
}
function cylZ(r: number, len: number, x: number, y: number, z: number, segs = 14): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, Math.max(6, Math.round(segs * DETAIL.k)));
  g.rotateX(Math.PI / 2); g.translate(x, y, z);
  const o = g.toNonIndexed(); g.dispose();
  for (const a of Object.keys(o.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') o.deleteAttribute(a);
  return o;
}
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = box(w, h, d, Math.min(w, h, d) * 0.2);
  g.translate(x, y, z);
  return g;
}

// ───────────────────────────────────────────────────────────── the Clasp (3b setpieces.ts claspGeo, 1:1)

const CL = { w: 0.09, h: 0.06, R: 0.065 };
function bendY(g: THREE.BufferGeometry, Rr: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = x / Rr, r = Rr + z;
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), Math.cos(a) * r - Rr);
  }
  g.computeVertexNormals();
  return g;
}
function slab(w: number, h: number, d: number, sx: number, sy: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) { p.setX(i, p.getX(i) * (1 - 0.12 * 0.02 / w * 10)); p.setY(i, p.getY(i) * (1 - 0.18 * 0.02 / h * 10)); }
  g.translate(x, y, z);
  const o = g.toNonIndexed(); g.dispose();
  return o;
}
function claspGeos(): THREE.BufferGeometry[] {
  const { w, h, R: Rr } = CL;
  const out: THREE.BufferGeometry[] = [];
  out.push(bendY(slab(w, h, 0.014, 12, 1, 0, 0, 0.0035 + 0.007), Rr));
  out.push(bendY(slab(w * 0.62, h * 0.38, 0.004, 8, 1, 0, 0.006, 0.0175 + 0.002 - 0.004), Rr));
  for (const s of [-1, 1]) out.push(bendY(slab(0.008, 0.03, 0.01, 1, 1, s * (w / 2 + 0.003), 0, 0.011), Rr));
  out.push(bendY(slab(w * 0.92, h * 0.86, 0.0025, 10, 1, 0, 0, 0.0025 + 0.00125), Rr));
  for (const g of out) { g.deleteAttribute('uv'); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2)); }
  return out;
}

// ───────────────────────────────────────────────────────────── vertex colours

// ───────────────────────────────────────────────────────────── fatigue folds (IB5a, B4: as level 4's suits got)

/** Abs-sine ridge: 1 on the crease line, falling off to 0 (cloth folds are sharp valleys between soft rolls). */
const ridge = (u: number) => { const r = 1 - Math.abs(Math.sin(u)); return r * r * r; };
const ELBOW_Y = K.shoulderY - K.uarm, KNEE_Y = K.hipY - K.thigh;
/**
 * Fold displacement (m, along the normal; − = into a crease) of the fatigues at a bind-pose model point: bunching rings
 * at the elbows and the knees, the blousing above the boots, gathers under the belt, diagonal drag lines from the crotch
 * and across the seat, the inside of the elbow and behind the knee pinched, slack sleeve twists, plus a fine ridge
 * noise all over (the poplin's own wrinkles). Shared by the geometry (`creased`) and the shading (`clothShade`).
 */
function creaseD(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = 0;
  // fine all-over wrinkles (three ridge families, slanted)
  d += 0.002 * (ridge(x * 31 + y * 19 + z * 7) + ridge(y * 26 - z * 22 + x * 5 + 1.3) + ridge(x * 13 - y * 33 + z * 17 + 2.1) - 0.7);
  if (ax > 0.12 && y > 0.9 && y < 1.45) {
    // sleeves: bunching round the elbow, twist creases down the forearm, the inner elbow pinched
    const e = sm(0.11, 0.0, Math.abs(y - ELBOW_Y));
    d += e * (0.0085 * (ridge((y - ELBOW_Y) * 52 + ax * 9) - 0.35) - 0.004 * sm(0.0, 0.03, z - K.shoulderZ));
    d += 0.004 * sm(1.12, 0.95, y) * (ridge(y * 40 + Math.atan2(z - K.shoulderZ, ax - K.shoulderX) * 2.2) - 0.3);
    d += 0.0035 * sm(1.42, 1.3, y) * sm(1.2, 1.3, y) * (ridge(y * 34 - z * 30) - 0.3); // under the shoulder
  } else if (y < 1.06) {
    if (y > 0.9) d += 0.005 * sm(1.05, 0.98, y) * (ridge(Math.atan2(x, z) * 9) - 0.35);            // gathers under the belt
    if (y > 0.6 && y < 0.9 && ax < 0.17) {
      // crotch drag lines (front: down and out from the fly; back: across the seat)
      const t = (0.86 - y) * 1.6 + ax * (z > 0 ? 2.4 : -1.5);
      d += 0.006 * sm(0.6, 0.78, y) * sm(0.17, 0.05, ax) * (ridge(t * 22) - 0.3);
    }
    // knees: stacked rings, deeper behind (the back of the knee folds when he walks)
    const kn = sm(0.12, 0.0, Math.abs(y - KNEE_Y));
    d += kn * (0.0085 * (ridge((y - KNEE_Y) * 46 + x * 6) - 0.35) - (z < 0 ? 0.003 : 0));
    // bloused over the boots: tight, irregular rolls
    const bl = sm(0.33, 0.27, y) * sm(0.18, 0.21, y);
    d += bl * 0.009 * (ridge(y * 70 + Math.sin(Math.atan2(x - Math.sign(x) * K.hipX, z) * 3) * 1.4) - 0.3);
    // slack down the shins: long vertical-ish wrinkles
    d += 0.003 * sm(0.42, 0.34, y) * sm(0.27, 0.33, y) * (ridge(Math.atan2(x - Math.sign(x) * K.hipX, z) * 5 + y * 6) - 0.4);
  }
  return d;
}
/** Bake `creaseD` into a fatigue loft: move each vertex along its normal, tilt the normal by the fold's slope. */
function creased(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const p = new THREE.Vector3(), n = new THREE.Vector3(), gr = new THREE.Vector3(), e = 0.004;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    const d = creaseD(p.x, p.y, p.z);
    gr.set(
      (creaseD(p.x + e, p.y, p.z) - creaseD(p.x - e, p.y, p.z)) / (2 * e),
      (creaseD(p.x, p.y + e, p.z) - creaseD(p.x, p.y - e, p.z)) / (2 * e),
      (creaseD(p.x, p.y, p.z + e) - creaseD(p.x, p.y, p.z - e)) / (2 * e),
    );
    gr.addScaledVector(n, -gr.dot(n));
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
    n.sub(gr).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  return g;
}

function clothShade(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color): void {
  const big = vnoise(p.x * 8 + p.z * 3, p.y * 7), fine = vnoise(p.x * 41 + 3, p.y * 37 + p.z * 23);
  let k = 1.03 - big * 0.08 - fine * 0.05;
  // the folds' valleys hold shadow, their crests catch a little light (as the lab suits')
  { const c = creaseD(p.x, p.y, p.z); k += c < 0 ? Math.max(-0.2, c * 30) : Math.min(0.06, c * 8); }
  k -= Math.max(0, -n.y) * 0.16;
  // creases behind the knees and at the elbows' inside, the crotch
  if (p.y < 0.55 && p.y > 0.42 && p.z < 0) k -= 0.1;
  if (p.y < 0.86 && p.y > 0.8 && Math.abs(p.x) < 0.04) k -= 0.08;
  // grime toward the boots, salt-dull at the cuffs
  k -= (1 - sm(0.2, 0.5, p.y)) * 0.12;
  k = Math.min(1.1, Math.max(0.5, k));
  out.setRGB(k, k, k * 1.02);
}
function vestShade(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color): void {
  const f = vnoise(p.x * 55 + 1, p.y * 52 + p.z * 31) * 0.06 + vnoise(p.x * 9, p.y * 11) * 0.07;
  let k = 1.0 - f - Math.max(0, -n.y) * 0.2;
  // MOLLE webbing rows on the cummerbund / plates: dark bands
  if (Math.abs(n.y) < 0.6 && Math.sin(p.y * 2 * Math.PI / 0.025) > 0.55) k -= 0.12;
  // worn edges
  k += Math.max(0, n.y) * 0.06;
  out.setRGB(k, k * 1.01, k * 1.04);
}
function helmetShade(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color): void {
  // goggle lenses: near black with a faint grey sheen on their upper half
  if (p.y > 1.61 && p.y < 1.675 && p.z > 0.075 && Math.abs(p.x) < 0.07 && n.z > 0.3) {
    const sheen = sm(1.638, 1.664, p.y) * (0.5 + 0.5 * Math.sin(p.x * 60)) * 0.18;
    out.setRGB(0.05 + sheen, 0.055 + sheen, 0.06 + sheen);
    return;
  }
  const scuff = vnoise(p.x * 70, p.y * 60 + p.z * 40);
  let k = 1.0 - vnoise(p.x * 9 + 2, p.z * 9) * 0.1;
  if (scuff > 0.82) k += 0.25 * (scuff - 0.82) / 0.18;
  out.setRGB(k, k, k * 1.03);
}
function knitShade(p: THREE.Vector3, _n: THREE.Vector3, out: THREE.Color): void {
  // rib knit: fine vertical ribs, a little lint-grey
  const rib = 0.5 + 0.5 * Math.sin(Math.atan2(p.x, p.z) * 90);
  const k = 0.85 + rib * 0.2 + vnoise(p.x * 120, p.y * 120) * 0.1;
  out.setRGB(k, k, k);
}
function bootShade(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color): void {
  let k = 0.95 - vnoise(p.x * 40, p.y * 40 + p.z * 30) * 0.12;
  // salt-scuffed toes and sole edges
  if (p.y < 0.06 && n.y < 0.3) k += 0.15;
  out.setRGB(k, k, k);
}
void D;
