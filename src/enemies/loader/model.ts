/**
 * The dock loader's BODY (stage 3d §5.6.2, W3a): the moon pool's autonomous overhead gantry crane — a bridge of two
 * box girders on end trucks riding the wall runway rails, a trolley on the girders (hoist drum, gearbox, cabinet, PA
 * horn, two floods on its south corners), a control pod hanging under the trolley between the girders (louvred armour
 * cowl, red core, sensor cluster), four wire ropes, and a four-jaw grab with a hydraulic power pack and two jaw rams
 * (chrome rods, amber sight glasses) on its east and west sides; two more floods hang under the girders.
 *
 * MODEL SPACE = WORLD SPACE (the rig's root stays at the identity): the bind pose is the crane parked with the bridge
 * at `geom.bindZ`, the trolley at `geom.bindX` and the grab hanging straight with its top at `geom.grabTop`. Everything
 * the plan gives in world numbers (rails y −4.0, girders y −4.0 … −2.6, trolley −2.6 … −1.0, pod −5.0 … −4.0, grab
 * 2.4 × 2.4 × 1.6) is authored in those numbers. North = +z (the dock board wall), south = −z (the sea windows).
 *
 * Material keys (one skinned mesh each; LOD0 = 9 meshes + 1 shadow proxy):
 *   yellow (crane_yellow: girders, trucks, trolley frame, grab frame, jaws, cowl) · dark (painted machinery: pack,
 *   pod, motors, yokes, lamp housings) · steel (wheels, rails, sheaves, pins, fins) · chrome (ram rods) · rope
 *   (rope_wire: the four falls + the drum lay) · hazard (bands) · sign (the girder decals) · glass (lenses, sight
 *   glasses, the sensor dome) · glow (every emissive bit + the dark-room marks, bone-scaled on / off).
 * LOD1: yellow · dark (+glass) · steel (+chrome) · rope · glow — 5 meshes. Shadow proxy: the GRAB only (+ jaws, rams,
 * pack) — the girders and the trolley never cast (§5.6.2 "shadow proxy 1 (grab only)").
 */
import * as THREE from 'three';
import type { GameContext } from '../../core/types';
import { buildRigLods, glowMaterial, tintOf, type RigBuilder, type RigTemplate } from '../shared/rig';
import { DETAIL, bcyl, bolt, box, cyl, hlathe, patch, plate, rod, sphere, torus, wedge, xf } from '../shared/prims';
import { libOr } from '../human/model';
import { MARK_CYAN, MARK_RED } from '../husk/model';

const D = Math.PI / 180;

/** Where the crane runs (the level's rails; `DockArena.rails` gives travel + railY, the rest are §2.6.10 numbers). */
export interface LoaderGeom {
  /** Top of the runway rails (the end trucks' wheels sit on it). */
  railY: number;
  /** Runway rail centres (west / east wall corbels). */
  railXW: number; railXE: number;
  /** Bridge girder ends. */
  spanX0: number; spanX1: number;
  /** Grab-centre travel: trolley x, bridge z. */
  xMin: number; xMax: number; zMin: number; zMax: number;
  /** Bind pose (any point inside the travel). */
  bindX: number; bindZ: number;
  /** Grab top when raised (bind). */
  grabTop: number;
}

export const LOADER_GEOM: LoaderGeom = {
  railY: -4.0, railXW: -75.4, railXE: -28.6, spanX0: -75.0, spanX1: -29.0,
  xMin: -71, xMax: -33, zMin: -192, zMax: -153,
  bindX: -52, bindZ: -172, grabTop: -6.4,
};

/** Measures relative to the moving parts (the runtime needs them). Offsets: bridge (x world, y world, z rel. bridge). */
export const LOADER_DIM = {
  girderDZ: 1.35, girderW: 0.7, girderH: 1.4,
  truckLen: 4.0, truckW: 0.9, wheelR: 0.25,
  /** Rope sheaves under the trolley (pendulum pivot height, world y) and their x / z offsets. */
  sheaveY: -2.7, ropeX: 1.1, ropeZ: 0.5,
  /** Rope bind length (geometry from 0 to −ROPE along the bone's −y; the bone's y scale = length / ROPE). */
  rope: 10,
  /** Grab (local to the grab bone = grab top centre): frame half size, hinge radius / y, closed tip y. */
  grabHalf: 1.2, grabH: 1.6, hingeR: 1.02, hingeY: -0.95, tipY: -1.6,
  /** Grab-local sheave points (rope bottoms). */
  grabSheaveY: -0.05,
  /** Ram axis on the east (+x) / west (−x) face: cylinder top, rod tip retracted / extended (grab-local y). */
  ramX: 1.32, ramTop: -0.05, ramCylEnd: -0.62, ramRodIn: -0.72, ramStroke: 0.34,
  /** Pod (trolley-relative x / z, world y): centre and half sizes 1.6 × 1.0 × 1.2. */
  podY: -4.5, podHalf: [0.8, 0.5, 0.6] as [number, number, number],
  /** Pod sensor (eyes) relative to the pod centre (south-bottom chamfer). */
  sensor: [0, -0.42, -0.5] as [number, number, number],
  /** PA horn mouth (trolley-relative x, world y, z). */
  pa: [-1.2, -1.05, -1.75] as [number, number, number],
  /** Floods: yoke pivot (pan) and head centre (tilt). FL1/FL2 trolley-relative, FL3/FL4 world x / bridge-rel z. */
  floods: [
    { id: 1, on: 'trolley', pan: [-1.62, -2.5, -2.08], head: [-1.62, -2.92, -2.08] },
    { id: 2, on: 'trolley', pan: [1.62, -2.5, -2.08], head: [1.62, -2.92, -2.08] },
    { id: 3, on: 'bridge', pan: [-66, -4.12, -1.35], head: [-66, -4.58, -1.35] },
    { id: 4, on: 'bridge', pan: [-40, -4.12, 1.35], head: [-40, -4.58, 1.35] },
  ] as const,
  /** Lamp head: radius, lens offset along the beam (local −z). */
  headR: 0.3, lensZ: -0.262,
  louvres: 6,
  /** Grab status lamps (grab-local position, facing): four, one per pack face, a lamp housing each. */
  lamps: [[0, -0.24, 0.74, 0, 0, 1], [0, -0.24, -0.74, 0, 0, -1], [0.71, -0.24, 0, 1, 0, 0], [-0.71, -0.24, 0, -1, 0, 0]] as const,
  /** The pod's sensor-cluster mark centre (pod-local) — the dome's south-bottom face. */
  podMark: [0, -0.48, -0.53] as [number, number, number],
};
const K = LOADER_DIM;

export interface LoaderTemplate {
  rig: RigTemplate;
  geom: LoaderGeom;
  /** Bounding sphere of the whole travel (the meshes' fixed bounds). */
  center: THREE.Vector3; radius: number;
}

/** Tints of the folded emissive keys (linear HDR). */
const TINT = {
  lens: tintOf(0xf4f2ea, 9.0),
  amber: tintOf(0xff8a10, 3.4),
  core: tintOf(0xff2410, 4.0),
  ringw: tintOf(0xe6eeff, 3.2),
  ringr: tintOf(0xff1a08, 4.2),
  pa: tintOf(0x40ff70, 1.4),
};

/** LOD / proxy tessellation factors (the proxy pass authors the grab only — recognised by its k). */
const LOD_K = 0.5, PROXY_K = 0.3;

const _h = new THREE.Vector3();
/** Cheap value-noise mottling for the yellow paint (rust shadows low on the parts, wear spots). */
function yellowWear(p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color): void {
  const s = Math.sin(p.x * 3.1 + p.z * 1.7) * Math.sin(p.y * 4.3 - p.x * 0.9) * Math.sin(p.z * 2.3 + p.y * 1.3);
  let k = 0.9 + 0.1 * s;
  if (n.y < -0.5) k *= 0.72;                // undersides in their own grime
  out.setRGB(k, k * 0.97, k * 0.92);
}
function darkWear(p: THREE.Vector3, _n: THREE.Vector3, out: THREE.Color): void {
  _h.copy(p);
  const s = Math.sin(_h.x * 5.3 + _h.y * 2.1) * Math.sin(_h.z * 4.1 - _h.y * 3.3);
  const k = 0.85 + 0.15 * s;
  out.setRGB(k, k, k);
}

export function buildLoaderTemplate(ctx: GameContext, geom: LoaderGeom = LOADER_GEOM): LoaderTemplate {
  const M = ctx.materials;
  // W5 builds crane_yellow / rope_wire concurrently: until then the library's painted yellow / raw steel stand in
  const yellow = libOr(ctx, 'crane_yellow', 'painted_yellow', { vertexColors: true }, { color: 0xffd23a, roughness: 0.6 });
  yellow.name = 'loader_yellow';
  const dark = M.clone('painted_dark', { vertexColors: true }); dark.name = 'loader_dark';
  const steel = M.clone('steel_raw', {}); steel.name = 'loader_steel';
  const chrome = M.get('chrome');
  const rope = libOr(ctx, 'rope_wire', 'steel_raw', {}, { color: 0x4a4a48, roughness: 0.48, metalness: 0.9 });
  rope.name = 'loader_rope';
  const hazard = M.get('hazard_stripes');
  const sign = M.sign('할시온 도크 시스템즈  —  DL-2  —  SWL 32 T', 'stencil', 9);
  const glass = M.clone('screen_off', { roughness: 0.08, metalness: 0.2, color: 0x20262c }); glass.name = 'loader_glass';
  const mats: Record<string, THREE.Material> = { glow: glowMaterial(), yellow, dark, steel, chrome, rope, hazard, sign, glass };
  const cx = (geom.spanX0 + geom.spanX1) / 2, cz = (geom.zMin + geom.zMax) / 2;
  const center = new THREE.Vector3(cx, -14, cz);
  // the whole travel: bridge span × bridge travel (+ end trucks) × rails → the well's floor (cargo to −26, death −33)
  const radius = Math.hypot((geom.spanX1 - geom.spanX0) / 2 + 1, (geom.zMax - geom.zMin) / 2 + 2.5, 20);
  const { template } = buildRigLods((b) => authorLoader(b, geom), mats, {
    radius, center,
    fold: { lens: 'glow', amber: 'glow', core: 'glow', ringw: 'glow', ringr: 'glow', pa: 'glow' },
    tint: TINT,
    lod: { k: LOD_K, minFeature: 0.05, remap: { chrome: 'steel', glass: 'dark', hazard: 'yellow', sign: 'yellow' } },
    proxy: { k: PROXY_K, minFeature: 0.08, exclude: ['glow', 'lens', 'amber', 'core', 'ringw', 'ringr', 'pa', 'sign', 'glass'] },
    colorize: { yellow: yellowWear, dark: darkWear },
  });
  return { rig: template, geom, center, radius };
}

// ───────────────────────────────────────────────────────────── authoring

function authorLoader(b: RigBuilder, G: LoaderGeom): void {
  const proxy = Math.abs(DETAIL.k - PROXY_K) < 1e-6;
  const L = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => b.addL(geo, xf(x, y, z, rx, ry, rz, sx, sy, sz));
  const bx = G.bindX, bz = G.bindZ, ry0 = G.railY;
  const gTop = G.grabTop;

  // ── skeleton (identical in every pass) ────────────────────────────────
  b.bone('base', null, 0, 0, 0);
  b.bone('bridge', 'base', (G.spanX0 + G.spanX1) / 2, ry0, bz);
  for (const [i, x] of [[0, G.railXW], [1, G.railXE]] as const) for (const [j, s] of [[0, -1], [1, 1]] as const) b.bone(`bwheel_${i}${j}`, 'bridge', x, ry0 + K.wheelR, bz + s * 1.4);
  b.bone('trolley', 'bridge', bx, ry0 + K.girderH, bz);
  for (const [i, sx] of [[0, -1], [1, 1]] as const) for (const [j, sz] of [[0, -1], [1, 1]] as const) b.bone(`twheel_${i}${j}`, 'trolley', bx + sx * 1.25, -2.28, bz + sz * K.girderDZ);
  b.bone('drum', 'trolley', bx, -1.55, bz + 0.45);
  b.bone('pa', 'trolley', bx + K.pa[0], K.pa[1], bz + K.pa[2]);
  b.bone('pod', 'trolley', bx, K.podY, bz);
  for (let i = 0; i < K.louvres; i++) b.bone(`louvre_${i}`, 'pod', bx, K.podY + K.podHalf[1] - 0.08 - i * 0.145, bz - K.podHalf[2] - 0.05);
  b.bone('pod_core', 'pod', bx, K.podY, bz - K.podHalf[2] + 0.12);
  // mark bones sit AT their marks: scaling a bone dims its mark in place (a bone elsewhere would drag it inside the body)
  b.bone('mk_pod_c', 'pod', bx + K.podMark[0], K.podY + K.podMark[1], bz + K.podMark[2]);
  b.bone('mk_pod_r', 'pod', bx + K.podMark[0], K.podY + K.podMark[1], bz + K.podMark[2]);
  for (const f of K.floods) {
    const onT = f.on === 'trolley';
    const px = onT ? bx + f.pan[0] : f.pan[0], pz = bz + f.pan[2];
    const hx = onT ? bx + f.head[0] : f.head[0], hz = bz + f.head[2];
    b.bone(`fl${f.id}_pan`, onT ? 'trolley' : 'bridge', px, f.pan[1], pz);
    b.bone(`fl${f.id}_tilt`, `fl${f.id}_pan`, hx, f.head[1], hz);
    b.bone(`fl${f.id}_lens`, `fl${f.id}_tilt`, hx, f.head[1], hz);
    b.bone(`fl${f.id}_beam`, `fl${f.id}_tilt`, hx, f.head[1], hz);
  }
  for (let i = 0; i < 4; i++) {
    const sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1;
    b.bone(`rope_${i}`, 'trolley', bx + sx * K.ropeX, K.sheaveY, bz + sz * K.ropeZ);
  }
  b.bone('grab', 'base', bx, gTop, bz);
  // jaws: local +x = outward, hinge axis = local z; e +x (ry 0), w −x (ry 180), n +z (ry −90), s −z (ry +90)
  const JAW: [string, number, number, number][] = [['e', 0, 1, 0], ['w', 180 * D, -1, 0], ['n', -90 * D, 0, 1], ['s', 90 * D, 0, -1]];
  for (const [id, ry, ox, oz] of JAW) b.bone(`jaw_${id}`, 'grab', bx + ox * K.hingeR, gTop + K.hingeY, bz + oz * K.hingeR, ry);
  for (const [side, s] of [['e', 1], ['w', -1]] as const) {
    b.bone(`ram_${side}_cyl`, 'grab', bx + s * K.ramX, gTop + K.ramTop, bz);
    b.bone(`ram_${side}_rod`, `ram_${side}_cyl`, bx + s * K.ramX, gTop + K.ramRodIn, bz);
    b.bone(`glass_${side}`, `ram_${side}_cyl`, bx + s * K.ramX, gTop - 0.34, bz);
  }
  b.bone('ring_w', 'grab', bx, gTop, bz);
  b.bone('ring_r', 'grab', bx, gTop, bz);
  K.lamps.forEach(([x, y, z], k) => { b.bone(`mk_grab_c${k}`, 'grab', bx + x, gTop + y, bz + z); b.bone(`mk_grab_r${k}`, 'grab', bx + x, gTop + y, bz + z); });
  for (let i = 0; i < K.louvres; i++) b.debrisBones.add(`louvre_${i}`);

  authorGrab(b, G, L);
  if (proxy) return;
  authorBridge(b, G, L);
  authorTrolley(b, G, L);
  authorPod(b, G, L);
  authorFloods(b, G, L);
  // the four falls: unit bind length 10 m along −y from each sheave (the runtime aims + scales the bone)
  for (let i = 0; i < 4; i++) {
    b.use(`rope_${i}`).mat('rope');
    L(cyl(0.024, 0.024, K.rope, 7, true), 0, -K.rope / 2, 0);
  }
}

type LFn = (geo: THREE.BufferGeometry, x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number) => RigBuilder;

/** Bridge: two box girders on end trucks; rails, stiffeners, the walkway on the south girder, decals, buffers. */
function authorBridge(b: RigBuilder, G: LoaderGeom, L: LFn): void {
  const cx = (G.spanX0 + G.spanX1) / 2, span = G.spanX1 - G.spanX0;
  const y0 = G.railY, h = K.girderH, gw = K.girderW;
  b.use('bridge');
  // in bridge-local: x relative to the span centre, y relative to the rail top, z relative to the bridge centre
  const X = (x: number) => x - cx;
  for (const s of [-1, 1]) {
    const z = s * K.girderDZ;
    b.mat('yellow');
    // (IA-6 zfight: the body sits INSIDE the flange lips — 0.04 shorter per end, 1 cm under each lip face)
    L(box(span - 0.08, h - 0.02, gw, 0.03), 0, h / 2, z);
    // flange lips top and bottom (the box girder reads as a fabricated section)
    L(box(span, 0.05, gw + 0.12, 0.01), 0, h - 0.025, z);
    L(box(span, 0.05, gw + 0.12, 0.01), 0, 0.025, z);
    // diaphragm stiffeners every 1.5 m on both faces
    const n = Math.floor(span / 1.5);
    for (let i = 1; i < n; i++) {
      const x = -span / 2 + i * (span / n);
      for (const f of [-1, 1]) L(box(0.06, h - 0.1, 0.04), x, h / 2, z + f * (gw / 2 + 0.02));
    }
    // trolley rail on top
    b.mat('steel');
    // (the base plate sinks 5 mm into the top lip, the rail sits 2 mm up inside the plate — its top where the wheels run)
    L(box(span - 0.6, 0.1, 0.09), 0, h + 0.052, z);
    L(box(span - 0.6, 0.03, 0.2), 0, h + 0.01, z);
    // the decal along the outer face (south face of the south girder, north face of the north girder)
    b.mat('sign');
    b.addL(new THREE.PlaneGeometry(6.3, 0.7).toNonIndexed(), xf(0, h / 2, z + s * (gw / 2 + 0.045), 0, s > 0 ? 0 : 180 * D, 0), true);
    // hazard bands at both ends
    b.mat('hazard');
    for (const e of [-1, 1]) L(box(1.2, h + 0.02, gw + 0.02), e * (span / 2 - 1.4), h / 2, z);
  }
  // cross ties between the girders at the ends and every 9 m (under the trolley's path they sit low)
  b.mat('dark');
  for (const x of [-span / 2 + 0.6, -span / 4, 0, span / 4, span / 2 - 0.6]) L(box(0.3, 0.25, 2 * K.girderDZ - gw + 0.04), x, 0.16, 0);   // (ends 2 cm into the girders: no shared face)
  // the maintenance walkway along the NORTH girder's top (the trolley floods hang on the south side): deck on
  // brackets, posts and a two-rail handrail on its outer edge
  {
    const z = K.girderDZ + gw / 2 + 0.36, y = h;
    b.mat('steel');
    L(box(span - 2, 0.04, 0.7), 0, y + 0.006, z);   // (deck top 2.6 cm over the girder's lip: never its plane)
    const n = Math.floor((span - 2) / 1.5);
    for (let i = 0; i <= n; i++) {
      const x = -(span - 2) / 2 + i * ((span - 2) / n);
      L(box(0.05, 1.05, 0.05), x, y + 0.5, z + 0.33);
      L(box(0.06, 0.06, 0.75), x, y - 0.07, z - 0.02);
    }
    L(box(span - 2, 0.05, 0.05), 0, y + 1.02, z + 0.33);
    L(box(span - 2, 0.04, 0.04), 0, y + 0.53, z + 0.33);
    b.mat('yellow');
    L(box(span - 2, 0.12, 0.02), 0, y + 0.04, z + 0.35);
  }
  // end trucks on the runway rails: body, wheel boxes, drive motors, rubber buffers facing ±z
  for (const xr of [G.railXW, G.railXE]) {
    const x = X(xr), inner = xr < cx ? 1 : -1;
    b.mat('yellow');
    L(box(K.truckW, 1.0, K.truckLen, 0.04), x, 0.8, 0);
    L(box(0.5, 0.7, 2 * K.girderDZ + gw + 0.3, 0.03), x + inner * 0.55, 1.0, 0);
    b.mat('hazard');
    for (const e of [-1, 1]) L(box(K.truckW + 0.02, 0.22, 0.4), x, 0.8, e * (K.truckLen / 2 - 0.2));
    b.mat('dark');
    for (const e of [-1, 1]) {
      L(bcyl(0.2, 0.5, 0.02, 14), x + inner * 0.62, 0.55, e * 1.0, 0, 0, 90 * D);            // drive motor
      L(box(0.34, 0.3, 0.34, 0.02), x + inner * 0.3, 0.55, e * 1.0);                           // gearbox
      b.mat('steel');
      L(bcyl(0.16, 0.2, 0.02, 12), x, 0.75, e * (K.truckLen / 2 + 0.1), 90 * D);                 // buffer plunger
      b.mat('dark');
      L(cyl(0.22, 0.22, 0.32, 14), x, 0.75, e * (K.truckLen / 2 + 0.36), 90 * D);              // rubber buffer
      L(box(0.6, 0.2, 0.08), x, 0.75, e * (K.truckLen / 2 + 0.02));
    }
    // a festoon clamp arm on the north truck end of the west truck (the level's festoon cable runs to it)
    if (inner > 0) { b.mat('dark'); L(box(0.12, 0.8, 0.12), x, 1.6, K.truckLen / 2 - 0.3); L(box(0.5, 0.1, 0.1), x + 0.2, 2.0, K.truckLen / 2 - 0.3); }
  }
  // wheels (spin with the bridge travel)
  for (const i of [0, 1]) for (const j of [0, 1]) {
    b.use(`bwheel_${i}${j}`).mat('steel');
    L(bcyl(K.wheelR, 0.2, 0.02, 18), 0, 0, 0, 0, 0, 90 * D);
    L(bcyl(K.wheelR + 0.04, 0.03, 0.005, 18), -0.11, 0, 0, 0, 0, 90 * D);
    b.mat('dark');
    for (let k = 0; k < 4; k++) L(box(0.22, 0.04, 0.05), 0, 0, 0, k * 45 * D);
  }
}

/** Trolley: frame on four wheels, hoist drum with the rope lay, gearbox + motor, cabinet, PA horn, sheave blocks, rail. */
function authorTrolley(b: RigBuilder, G: LoaderGeom, L: LFn): void {
  b.use('trolley');
  const yb = G.railY + K.girderH;   // the trolley bone sits at the girder top (−2.6); local y 0 = there
  const Y = (y: number) => y - yb;
  const dz = K.girderDZ;
  b.mat('yellow');
  for (const s of [-1, 1]) L(box(3.3, 0.4, 0.42, 0.03), 0, Y(-2.15), s * dz);                 // side beams over the wheels
  for (const x of [-1.45, 1.45]) L(box(0.36, 0.36, 2 * dz + 0.36, 0.03), x, Y(-2.15), 0);      // end beams (ends inside the side beams)
  L(box(3.2, 0.06, 2 * dz - 0.1), 0, Y(-1.92), 0);                                            // deck plate
  b.mat('hazard');
  for (const x of [-1.668, 1.668]) L(box(0.03, 0.38, 2 * dz + 0.46), x, Y(-2.15), 0);          // (3 mm clear of the beam ends)
  // sheave blocks under the deck (the ropes leave from their bottoms at sheaveY)
  b.mat('dark');
  for (let i = 0; i < 4; i++) {
    const sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1;
    L(box(0.3, 0.42, 0.16, 0.02), sx * K.ropeX, Y(K.sheaveY + 0.22), sz * K.ropeZ);
    b.mat('steel'); L(bcyl(0.15, 0.06, 0.01, 14), sx * K.ropeX, Y(K.sheaveY + 0.15), sz * K.ropeZ, 90 * D); b.mat('dark');
  }
  L(box(2.6, 0.12, 0.2), 0, Y(-2.42), 0);
  // drum pedestals, gearbox, hoist motor with a brake disc, the electrical cabinet, guard rails
  const dzD = 0.45;
  L(box(0.18, 0.55, 0.7, 0.02), -1.12, Y(-1.62), dzD);
  L(box(0.18, 0.55, 0.7, 0.02), 1.0, Y(-1.62), dzD);
  L(box(0.5, 0.62, 0.66, 0.03), 1.35, Y(-1.55), dzD);                                           // gearbox
  L(bcyl(0.26, 0.7, 0.03, 18), 1.35, Y(-1.5), dzD - 0.75, 90 * D);                               // motor (axis z)
  b.mat('steel'); L(bcyl(0.3, 0.05, 0.01, 18), 1.35, Y(-1.5), dzD - 0.38, 90 * D); b.mat('dark');
  for (let k = 0; k < 8; k++) L(box(0.03, 0.5, 0.62), 1.35 + Math.cos(k * 45 * D) * 0.27, Y(-1.5) + Math.sin(k * 45 * D) * 0.27, dzD - 0.78, 0, 0, k * 45 * D);
  L(box(0.75, 0.95, 0.5, 0.03), -1.15, Y(-1.42), -0.95);                                         // cabinet
  b.mat('steel');
  for (let k = 0; k < 6; k++) L(box(0.6, 0.02, 0.02), -1.15, Y(-1.2) - k * 0.08, -1.21);          // cabinet vents
  b.mat('yellow');
  for (const [x, z] of [[-1.55, -1.5], [1.55, -1.5], [-1.55, 1.5], [1.55, 1.5]]) L(box(0.05, 0.9, 0.05), x, Y(-1.45), z);
  for (const z of [-1.5, 1.5]) L(box(3.15, 0.05, 0.05), 0, Y(-1.02), z);
  for (const x of [-1.55, 1.55]) L(box(0.05, 0.05, 3.0), x, Y(-1.02), 0);
  // PA horn bracket on the cabinet's south-west corner
  b.mat('dark');
  L(box(0.08, 0.4, 0.08), K.pa[0], Y(K.pa[1] + 0.08), K.pa[2] + 0.35);
  b.use('pa').mat('dark');
  L(hlathe([[0.0, -0.28], [0.06, -0.28], [0.07, -0.12], [0.13, 0.0], [0.24, 0.12], [0.22, 0.12], [0.11, 0.0], [0.0, -0.1]], 14), 0, 0, 0.1, -100 * D);
  b.mat('pa'); L(sphere(0.012, 6, 4), 0.1, 0.18, 0.2);                                          // the PA's live LED
  // drum + rope lay
  b.use('drum').mat('dark');
  L(bcyl(0.44, 1.9, 0.03, 24), 0, 0, 0, 0, 0, 90 * D);
  for (const x of [-0.98, 0.98]) L(bcyl(0.55, 0.06, 0.01, 24), x, 0, 0, 0, 0, 90 * D);
  b.mat('rope');
  for (let k = 0; k < 14; k++) L(torus(0.46, 0.028, 5, 22), -0.85 + k * 0.13, 0, 0, 0, 90 * D, 0);
  b.mat('steel');
  for (let k = 0; k < 6; k++) L(box(0.04, 0.06, 0.06), -0.99, Math.cos(k * 60 * D) * 0.45, Math.sin(k * 60 * D) * 0.45);
  // wheels
  for (const i of [0, 1]) for (const j of [0, 1]) {
    // axle along z (the trolley rolls along x); the flange on the girder's inner side
    b.use(`twheel_${i}${j}`).mat('steel');
    L(bcyl(0.22, 0.16, 0.02, 16), 0, 0, 0, 90 * D);
    L(bcyl(0.25, 0.025, 0.005, 16), 0, 0, (j ? -1 : 1) * 0.09, 90 * D);
    b.mat('dark');
    for (let k = 0; k < 3; k++) L(box(0.04, 0.2, 0.17), 0, 0, 0, 0, 0, k * 60 * D);
  }
}

/** Control pod: stem through the girder gap, armoured body, the louvred cowl on its south face, core, sensor cluster. */
function authorPod(b: RigBuilder, G: LoaderGeom, L: LFn): void {
  b.use('trolley').mat('dark');
  const yb = G.railY + K.girderH;
  L(box(0.5, 1.6, 0.5, 0.03), 0, K.podY + K.podHalf[1] + 0.8 - yb, 0.05);
  b.mat('steel');
  for (let k = 0; k < 3; k++) b.addL(rod([0.28, K.podY + K.podHalf[1] + 0.1 - yb, 0.3 - k * 0.15], [0.32, -2.5 - yb, 0.3 - k * 0.15], 0.018, 6));
  const [hx, hy, hz] = K.podHalf;
  b.use('pod').mat('dark');
  L(box(2 * hx - 0.1, 2 * hy - 0.06, 0.92, 0.05), 0, 0, 0.11);                                  // body (recessed behind the louvres)
  // armour: yellow side and north plates, a chamfered bottom, the south face frame around the louvres
  b.mat('yellow');
  for (const s of [-1, 1]) L(box(0.06, 2 * hy, 2 * hz, 0.02), s * (hx - 0.03), 0, 0);
  L(box(2 * hx, 2 * hy, 0.06, 0.02), 0, 0, hz - 0.03);
  L(box(2 * hx, 0.06, 2 * hz - 0.3, 0.02), 0, -hy + 0.03, 0.15);
  L(wedge(2 * hx, 0.3, 2 * hx, 0.06, 0.24, -0.12), 0, -hy + 0.12, -hz + 0.15, 0, 0, 0);
  b.mat('hazard');
  L(box(2 * hx + 0.02, 0.1, 2 * hz + 0.02), 0, hy - 0.05, 0);
  b.mat('dark');
  for (const s of [-1, 1]) L(box(0.08, 2 * hy - 0.2, 0.08), s * (hx - 0.08), 0.02, -hz - 0.01);
  // inside behind the louvres: the red core (scaled in with the cowl)
  b.use('pod_core').mat('core');
  L(box(1.2, 0.6, 0.02), 0, 0.06, 0);
  b.mat('dark');
  for (let k = 0; k < 5; k++) L(box(0.03, 0.62, 0.06), -0.5 + k * 0.25, 0.06, -0.03);
  // the sensor cluster on the south-bottom chamfer: a dark dome and the marks (cyan + red sets, scaled by the runtime)
  b.use('pod').mat('glass');
  const sp = new THREE.Vector3(K.sensor[0], K.sensor[1], K.sensor[2]);
  L(sphere(0.15, 16, 10), sp.x, sp.y + 0.04, sp.z + 0.06, 0, 0, 0, 1, 0.75, 1);
  b.mat('dark');
  L(torus(0.15, 0.025, 6, 18), sp.x, sp.y + 0.04, sp.z + 0.06, -50 * D);
  const pw = (x: number, y: number, z: number) => new THREE.Vector3(G.bindX + x, K.podY + y, G.bindZ + z);
  const dir = new THREE.Vector3(0, -0.7, -1).normalize();
  const dome = new THREE.Vector3(...K.podMark);
  for (const [x, y] of [[-0.06, 0.03], [0.06, 0.03], [0, -0.04]] as const) {
    b.mark('mk_pod_r', pw(dome.x + x, dome.y + y, dome.z), dir, 0.06, MARK_RED, -2);
    b.mark('mk_pod_c', pw(dome.x + x, dome.y + y, dome.z), dir, 0.06, MARK_CYAN, -2);
  }
  // louvres: slats hinged at their top edge, rotating outward / up (cowl open)
  for (let i = 0; i < K.louvres; i++) {
    b.use(`louvre_${i}`).mat('yellow');
    L(box(1.36, 0.15, 0.035, 0.008), 0, -0.075, 0);
    b.mat('dark');
    L(cyl(0.016, 0.016, 1.42, 6), 0, 0, 0.0, 0, 0, 90 * D);
  }
}

/** Four lamp heads on pan / tilt yokes; FL3 / FL4 hang from brackets under the girders, FL1 / FL2 from the trolley. */
function authorFloods(b: RigBuilder, G: LoaderGeom, L: LFn): void {
  const yb = G.railY + K.girderH;
  for (const f of K.floods) {
    const onT = f.on === 'trolley';
    // bracket from the parent to the pan bearing
    if (onT) {
      b.use('trolley').mat('dark');
      L(box(0.12, 0.12, 0.62), f.pan[0], f.pan[1] + 0.2 - yb, f.pan[2] + 0.31);
      L(box(0.12, 0.3, 0.12), f.pan[0], f.pan[1] + 0.12 - yb, f.pan[2]);
    } else {
      b.use('bridge').mat('dark');
      const cx = (G.spanX0 + G.spanX1) / 2;
      L(box(0.5, 0.06, 0.5), f.pan[0] - cx, -0.03, f.pan[2]);
    }
    b.use(`fl${f.id}_pan`).mat('dark');
    L(bcyl(0.14, 0.1, 0.02, 14), 0, 0, 0);
    // U yoke from the bearing down to the head's trunnions
    const dy = f.head[1] - f.pan[1];
    L(box(0.84, 0.06, 0.12, 0.01), 0, -0.06, 0);
    for (const s of [-1, 1]) L(box(0.06, Math.abs(dy) + 0.06, 0.12, 0.01), s * 0.4, dy / 2 - 0.03, 0);
    b.use(`fl${f.id}_tilt`).mat('dark');
    // the head: housing along local −z (beam), a cooling-fin back, trunnion hubs, a visor
    const R = K.headR;
    L(bcyl(R, 0.5, 0.03, 22), 0, 0, 0, 90 * D);
    L(cyl(R * 0.8, R * 0.98, 0.14, 22), 0, 0, 0.3, 90 * D);
    b.mat('steel');
    for (let k = 0; k < 7; k++) L(box(0.03, 0.44, 0.1), -0.18 + k * 0.06, 0, 0.36);
    for (const s of [-1, 1]) L(bcyl(0.06, 0.06, 0.01, 10), s * (R + 0.04), 0, 0, 0, 0, 90 * D);
    b.mat('yellow');
    L(patch((u, v, out) => { const a = (-70 + 140 * u) * D; out.set(Math.sin(a) * (R + 0.02), Math.cos(a) * (R + 0.02), -0.2 - 0.16 * v); }, { nu: 8, nv: 1, thickness: 0.01 }));
    L(torus(R - 0.01, 0.025, 6, 24), 0, 0, -0.25);
    // lens glass (hidden when shattered) and the lit lens (scaled with the lamp)
    b.use(`fl${f.id}_lens`).mat('glass');
    L(cyl(R - 0.03, R - 0.03, 0.012, 22), 0, 0, K.lensZ + 0.008, 90 * D);
    b.use(`fl${f.id}_beam`).mat('lens');
    L(cyl(R - 0.05, R - 0.05, 0.01, 22), 0, 0, K.lensZ, 90 * D);
    // the dark reflector behind the glass (what a shattered lamp shows)
    b.use(`fl${f.id}_tilt`).mat('dark');
    L(cyl(R - 0.04, R * 0.3, 0.12, 18, true), 0, 0, K.lensZ + 0.1, -90 * D);
  }
}

/** The grab: power pack, square frame, sheave blocks, four jaws, two rams with sight glasses, ring light, marks. */
function authorGrab(b: RigBuilder, G: LoaderGeom, L: LFn): void {
  const H = K.grabHalf;
  b.use('grab').mat('yellow');
  L(box(2 * H, 0.3, 2 * H, 0.04), 0, -0.75, 0);                                                   // frame
  L(box(2 * H - 0.5, 0.32, 2 * H - 0.5, 0.02), 0, -0.75, 0);
  b.mat('hazard');
  for (const s of [-1, 1]) { L(box(2 * H + 0.02, 0.1, 0.3), 0, -0.68, s * (H - 0.14)); L(box(0.3, 0.1, 2 * H + 0.02), s * (H - 0.14), -0.68, 0); }
  b.mat('dark');
  L(box(1.34, 0.5, 1.34, 0.04), 0, -0.35, 0);                                                     // power pack
  L(bcyl(0.2, 0.36, 0.02, 14), -0.35, -0.0, -0.35);                                               // tank
  L(bcyl(0.15, 0.3, 0.02, 14), 0.35, -0.02, 0.35);                                                // pump motor
  b.mat('steel');
  for (let k = 0; k < 7; k++) L(box(1.0, 0.02, 0.02), 0, -0.2 - k * 0.04, -0.68);                   // cooler fins
  for (const [x, z] of [[-0.67, -0.67], [0.67, -0.67], [-0.67, 0.67], [0.67, 0.67]]) L(bolt(0.03, 0.03), x, -0.6, z);
  // rope sheave blocks
  b.mat('dark');
  for (let i = 0; i < 4; i++) {
    const sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1;
    L(box(0.26, 0.5, 0.18, 0.02), sx * K.ropeX, -0.32, sz * K.ropeZ);
    b.mat('steel'); L(bcyl(0.13, 0.07, 0.01, 12), sx * K.ropeX, -0.16, sz * K.ropeZ, 90 * D); b.mat('dark');
  }
  // hydraulic lines from the pack to the rams
  b.mat('dark');
  for (const s of [-1, 1]) {
    b.addL(rod([s * 0.67, -0.25, 0.1], [s * (K.ramX - 0.08), -0.12, 0.12], 0.02, 6));
    b.addL(rod([s * 0.67, -0.35, -0.1], [s * (K.ramX - 0.08), -0.28, -0.12], 0.02, 6));
  }
  // ring light round the frame bottom (two sets: white work ring, red telegraph ring)
  for (const [bone, mat] of [['ring_w', 'ringw'], ['ring_r', 'ringr']] as const) {
    b.use(bone).mat(mat);
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      const r = H - 0.08, c = Math.cos(a), s = Math.sin(a);
      const k2 = Math.max(Math.abs(c), Math.abs(s));
      L(box(0.16, 0.04, 0.08), (c / k2) * r, -0.92, (s / k2) * r, 0, -a, 0);
    }
  }
  // status lamp housings on the pack (north and south faces) + the marks
  b.use('grab').mat('dark');
  const gw = (x: number, y: number, z: number) => new THREE.Vector3(G.bindX + x, G.grabTop + y, G.bindZ + z);
  K.lamps.forEach(([x, y, z, nx, ny, nz], k) => {
    b.use('grab').mat('dark');
    L(box(nz ? 0.18 : 0.06, 0.18, nz ? 0.06 : 0.18, 0.01), x - nx * 0.03, y, z - nz * 0.03);
    const n = new THREE.Vector3(nx, ny, nz);
    b.mark(`mk_grab_r${k}`, gw(x + nx * 0.01, y, z + nz * 0.01), n, 0.12, MARK_RED, -0.6);
    b.mark(`mk_grab_c${k}`, gw(x + nx * 0.01, y, z + nz * 0.01), n, 0.12, MARK_CYAN, -0.6);
  });
  // jaws (authored in the jaw frame: +x outward, hinge axis z, origin on the hinge pin)
  const P0 = new THREE.Vector2(0.0, -0.02), P1 = new THREE.Vector2(0.1, -0.72), P2 = new THREE.Vector2(-0.88, -0.65);
  const bez = (v: number, out: THREE.Vector2) => {
    const a = (1 - v) * (1 - v), m = 2 * (1 - v) * v, c = v * v;
    return out.set(a * P0.x + m * P1.x + c * P2.x, a * P0.y + m * P1.y + c * P2.y);
  };
  const q = new THREE.Vector2();
  for (const id of ['e', 'w', 'n', 's']) {
    b.use(`jaw_${id}`).mat('yellow');
    // orange-peel petal: tapers so the four close without meeting (half width ≤ distance from the grab axis)
    L(patch((u, v, out) => { bez(v, q); const hw = 0.8 - 0.66 * v; out.set(q.x, q.y, (u * 2 - 1) * hw); }, { nu: 6, nv: 9, thickness: 0.045 }));
    // cheek plates, hinge knuckles, the pin, the ram ear, a toothed lip
    b.mat('dark');
    const cheek: [number, number][] = [[0.05, 0.05], [0.14, -0.32], [0.07, -0.5], [-0.1, -0.45], [-0.05, -0.2], [-0.06, 0.05]];
    for (const s of [-1, 1]) b.addL(plate(cheek, 0.04, 0.008), xf(0, 0, s * 0.62));
    b.mat('steel');
    L(cyl(0.05, 0.05, 1.9, 10), 0, 0, 0, 90 * D);
    for (const z of [-0.6, 0, 0.6]) L(bcyl(0.085, 0.16, 0.01, 12), 0, 0, z, 90 * D);
    L(box(0.14, 0.2, 0.14, 0.01), 0.14, 0.06, 0);
    bez(1, q);
    for (const z of [-0.07, 0.07]) L(wedge(0.1, 0.05, 0.03, 0.03, 0.1), q.x - 0.02, q.y - 0.02, z, 0, 0, 70 * D);
  }
  // rams: cylinder (dark, with the amber sight glass) bound to the grab, rod (chrome) sliding out
  for (const [side, s] of [['e', 1], ['w', -1]] as const) {
    b.use(`ram_${side}_cyl`).mat('dark');
    const len = K.ramTop - K.ramCylEnd;
    L(bcyl(0.1, len, 0.015, 16), 0, -len / 2, 0);
    L(bcyl(0.13, 0.08, 0.01, 16), 0, -0.03, 0);
    L(bcyl(0.12, 0.06, 0.01, 16), 0, -len + 0.03, 0);
    L(box(0.16, 0.14, 0.24, 0.01), -s * 0.12, -0.02, 0);                                          // clevis to the pack
    b.mat('steel');
    for (const z of [-0.06, 0.06]) L(box(0.24, 0.02, 0.02), 0, -0.08 - (z + 0.06) * 2, z);
    b.use(`glass_${side}`).mat('glass');
    L(box(0.04, 0.12, 0.08, 0.005), s * 0.09, 0, 0);
    b.mat('amber');
    L(box(0.012, 0.1, 0.066), s * 0.112, 0, 0);
    b.use(`ram_${side}_rod`).mat('chrome');
    L(cyl(0.045, 0.045, 0.55, 12), 0, 0.2, 0);
    b.mat('steel');
    L(box(0.1, 0.12, 0.16, 0.01), 0, -0.06, 0);                                                    // rod eye
    L(cyl(0.03, 0.03, 0.22, 8), 0, -0.08, 0, 90 * D);
  }
}
