/**
 * LEVEL 6 set pieces (stage 3d §8.7, task W7). Everything procedural, level-internal, story-free: the callers (W4a's
 * greybox, the D-task dressings) place each piece — the defaults ARE the plan's coordinates (§2.6) — and the story /
 * vignettes drive the moving parts through `L.objects.get(<name>).userData`. No set piece plays a sound (D25: the
 * vignette or story beat that drives it owns its sounds); timed animations report CUES (callback names + the world
 * points their sounds come from) so the owner can play them on the frame they happen.
 *
 * | piece | function | default place (§2.6) | object | moving API (userData) |
 * |---|---|---|---|---|
 * | changeover switch | `switch6(L, b)` | cabinet x 21.0 … 21.8, z −172 … −170 (he6 east wall); crank hub (20.95, 1.2, −171.0) | `switch6` | `setProgress(k)`, `keyOut(k)`, `grips()`, `hub`, `keyPoint` |
 * | beach joint | `beachJoint6(L, b)` | enclosure x −13.2 … −10.8, z −179.8 … −178.6 (vault south wall) | `bj6` | `unlock(k)`, `open(k)`, `strain(k)`, `rip(onCue)`, `ripped()`, `takeKeyB()`, `boxes` |
 * | shaft interlock | `shaftLock6(L, b)` | barrel `mk6_shaft_lock` (−21.78, 1.3, −167.6), facing +x | `shaft6` | `unlock(k)` |
 * | tether frame + cage + winch | `frame6(L, b)` | platform x −55 … −49, z −172 … −166, y −16; winch x −54 … −50, z −154 … −150 | `frame6` | `pin(k)`, `pump(k)`, `guard(k)`, `lever(k)`, `fire(onCue)`, `fired()`, `winch(w)`, `brake()`, `lamp(k)` |
 * | well furniture | `well6(L, b)` | ladders x −57.8 / −46.2 at z −176; gates in the guard; the inner lock door at y −34 | `well6`, `ladder6_w`, `ladder6_e` | ladder `{ foot, top, exit, gate: { open(k), settle(s, onLatch) } }`; `well6.lamps(k)` |
 * | dock console | `console6(L, b)` | desk x −46 … −42, z −158.6 … −157.8, y −16; screen plane z −157.9 | `console6` | `page(id, o)`, `screenMat`, `screenPoint` |
 * | phone station | `phone6(L, b)` | (21.78, 1.4, −164.0) facing −x; handset hanging at ≈ (21.55, 0.85, −164.3) | `phone6` | `lift(to?)`, `hold(p, q?)`, `drop()`, `handset` |
 * | the feed set | `feed6(L)` | room `feed6` x 100 … 124, z 0 … 24 (sealed); camera `mk6_feed_cam` | `feed6` | `beacons(on)`, `cam`, `target` |
 *
 * Draw calls: every moving part is built in ONE "rig" material per piece (`Rig6`: a palette of paints / metals / lens
 * emissions picked per vertex by uv.x, and up to 16 bone matrices picked by uv.y, applied in the vertex shader and in
 * the shadow-depth materials) — so a piece's cranks, keys, levers, needles and lamps cost one call together. Parts that
 * need a real transform (physics movers, dynamic boxes, decals: the sliding leaves, the handset) are their own meshes
 * in the same material. Static geometry goes into the caller's zone builder `b` (library materials merge there).
 *
 * Move-only colliders (D14: bars and gates — bodies stop, rounds and sight pass): `LevelBuild` has no move-only API, so
 * the pieces register their boxes here; the level adds ONE mesh after `assembleLevel`:
 * `level.colliders.push(...moveOnlyColliders6(L))` (W4a, `l6/index.ts`). Solid colliders use `b.collide` as usual.
 *
 * Conventions: metres, y up, −z = south. No two visible faces are coplanar: every plate / label / lens stands ≥ 3 mm
 * proud of what it is on, and touching boxes are staggered (the 3c z-fight lesson).
 */
import * as THREE from 'three';
import type { MaterialName, Surface } from '../../core/types';
import type { Builder, Mat } from '../builder';
import { rng, unitBox, unitCyl, unitSphere, unitTorus } from '../builder';
import type { LevelBuild } from '../context';

const PI = Math.PI;
const TAU = PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };
/** Min-jerk ease (zero velocity and acceleration at both ends). */
const minJerk = (t: number) => { const k = clamp01(t); return k * k * k * (10 + k * (-15 + 6 * k)); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SANS = '"Arial Narrow", "Helvetica Neue", "Roboto Condensed", Arial, sans-serif';

// ───────────────────────────────────────────────────────────── materials (private, cached per level)

const CACHE = new WeakMap<LevelBuild, Map<string, THREE.Material>>();
function mat6<T extends THREE.Material>(L: LevelBuild, key: string, make: () => T): T {
  let c = CACHE.get(L);
  if (!c) CACHE.set(L, (c = new Map()));
  let m = c.get(key) as T | undefined;
  if (!m) { c.set(key, (m = make())); if (!m.name) m.name = key; }
  return m;
}
/** A library material if it is implemented (`get` returns it under its own name), else a private stand-in (W5 builds concurrently). */
export function libOr6(L: LevelBuild, name: MaterialName, fb: MaterialName, over: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.get(name);
  if (m.name === name) return m;
  return mat6(L, `sp6_standin_${name}`, () => { const c = L.ctx.materials.clone(fb, over); c.name = `${name}_standin`; return c; });
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ───────────────────────────────────────────────────────────── move-only collider registry (D14)

const MOVE_ONLY = new WeakMap<LevelBuild, THREE.Box3[]>();
function moveOnly(L: LevelBuild, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  let a = MOVE_ONLY.get(L);
  if (!a) MOVE_ONLY.set(L, (a = []));
  a.push(new THREE.Box3(V(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), V(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1))));
}
/** Every move-only box the set pieces registered (bars, gates). */
export function moveOnlyBoxes6(L: LevelBuild): readonly THREE.Box3[] { return MOVE_ONLY.get(L) ?? []; }
/**
 * The registered move-only boxes as ONE invisible collider mesh (`userData.moveOnly = true`, surface `metal`) — the
 * level pushes it into `level.colliders` before `physics.build` (main.ts builds physics from that array). Empty → [].
 */
export function moveOnlyColliders6(L: LevelBuild): THREE.Mesh[] {
  const boxes = MOVE_ONLY.get(L);
  if (!boxes?.length) return [];
  const geos: THREE.BufferGeometry[] = [];
  const P: number[] = [], I: number[] = [];
  for (const bx of boxes) {
    const g = new THREE.BoxGeometry(bx.max.x - bx.min.x, bx.max.y - bx.min.y, bx.max.z - bx.min.z);
    g.translate((bx.min.x + bx.max.x) / 2, (bx.min.y + bx.max.y) / 2, (bx.min.z + bx.max.z) / 2);
    const pos = g.getAttribute('position'), idx = g.index!;
    const o = P.length / 3;
    for (let i = 0; i < pos.count; i++) P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    for (let i = 0; i < idx.count; i++) I.push(idx.getX(i) + o);
    geos.push(g);
  }
  for (const g of geos) g.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setIndex(I);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo);
  mesh.name = 'collider:moveOnly6';
  mesh.userData.surface = 'metal' satisfies Surface;
  mesh.userData.moveOnly = true;
  mesh.visible = false;
  mesh.matrixAutoUpdate = false;
  return [mesh];
}

// ═════════════════════════════════════════════════════════════ RIG: palette + bones in one material

/** Palette indices (uv.x). Colours are display (sRGB) hex; roughness, metalness. */
export const PAL = {
  navy: 0, dark: 1, steel: 2, brass: 3, red: 4, yellow: 5, rubber: 6, chrome: 7,
  orange: 8, white: 9, green: 10, tar: 11, galv: 12, black: 13, lensA: 14, lensB: 15,
} as const;
const PAL_DEF: readonly (readonly [number, number, number])[] = [
  [0x6c777e, 0.6, 0.12], // navy haze grey
  [0x25292c, 0.62, 0.2], // dark paint
  [0x8c9194, 0.34, 0.9], // bright steel
  [0xb08a36, 0.3, 0.95], // brass
  [0x8e1c14, 0.45, 0.08], // red paint
  [0xc9991a, 0.52, 0.08], // safety yellow
  [0x151515, 0.88, 0.0], // rubber
  [0xd5dadc, 0.1, 1.0], // chrome
  [0xbd531c, 0.5, 0.08], // orange
  [0xd6d3c9, 0.58, 0.04], // white enamel
  [0x2e5a39, 0.5, 0.08], // green paint
  [0x1c1b18, 0.72, 0.05], // tar serving / cable sheath
  [0x979d9d, 0.48, 0.8], // galvanised
  [0x060606, 0.35, 0.0], // black (ports, slots)
  [0x221d18, 0.18, 0.0], // lens A
  [0x221d18, 0.18, 0.0], // lens B
];
const PAL_N = 16;
const MAXB = 16;

const PAL_GEO = new Map<string, THREE.BufferGeometry>();
/** A cached unit geometry with every uv = (pi + 0.5, bone + 0.5). */
function palGeo(key: string, pi: number, bone: number, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const k = `${key}|${pi}|${bone}`;
  let g = PAL_GEO.get(k);
  if (!g) {
    g = make();
    const n = g.getAttribute('position').count;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = pi + 0.5; uv[i * 2 + 1] = bone + 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    PAL_GEO.set(k, g);
  }
  return g;
}

const RIG_VERT_HEAD = `#include <common>
varying float vPal6;
varying float vOrd6;
varying vec3 vObj6;
uniform mat4 uBone6[${MAXB}];`;
const RIG_NORMAL = `#include <beginnormal_vertex>
{ int bi6 = uv.y < ${MAXB - 0.5} ? int(uv.y) : 0; vec3 nn6 = mat3(uBone6[bi6]) * objectNormal; objectNormal = dot(nn6, nn6) > 1e-10 ? normalize(nn6) : objectNormal; }`;
const RIG_POS = `#include <begin_vertex>
{ int bi6 = uv.y < ${MAXB - 0.5} ? int(uv.y) : 0; transformed = (uBone6[bi6] * vec4(transformed, 1.0)).xyz; }
vPal6 = uv.x; vOrd6 = uv.y; vObj6 = position;`;
const RIG_FRAG_HEAD = `#include <common>
varying float vPal6;
varying float vOrd6;
varying vec3 vObj6;
uniform vec3 uCol6[${PAL_N}];
uniform vec2 uRM6[${PAL_N}];
uniform vec3 uE6[${PAL_N}];
uniform float uCut6;
uniform float uStrain6;
uniform float uTime6;
float h6(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n6(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h6(i), h6(i + vec3(1, 0, 0)), f.x), mix(h6(i + vec3(0, 1, 0)), h6(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h6(i + vec3(0, 0, 1)), h6(i + vec3(1, 0, 1)), f.x), mix(h6(i + vec3(0, 1, 1)), h6(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;
const RIG_COLOR = `#include <color_fragment>
int pI6 = int(vPal6);
float w6 = n6(vObj6 * 9.0) * 0.6 + n6(vObj6 * 37.0) * 0.4;
diffuseColor.rgb = uCol6[pI6] * (0.84 + 0.3 * w6);`;
const RIG_ROUGH = `float roughnessFactor = clamp(uRM6[pI6].x + (w6 - 0.5) * 0.18, 0.04, 1.0);`;
const RIG_METAL = `float metalnessFactor = uRM6[pI6].y;`;
// cascade parts (the loom's fibres): uv.y = 20 + order along the tray (0 … 1), fract(uv.x) = the fibre's id
const RIG_EMIT = `#include <emissivemap_fragment>
{
  vec3 e6 = uE6[pI6];
  if (vOrd6 > 19.5) {
    float o6 = vOrd6 - 20.0;
    float id6 = floor(fract(vPal6) * 1000.0);
    e6 *= step(uCut6, o6);
    if (uStrain6 > 0.0) {
      float fl6 = h6(vec3(id6, floor(uTime6 * 17.0), 2.0));
      e6 *= mix(1.0, 0.15 + 0.85 * step(0.32, fl6), smoothstep(0.62, 1.0, uStrain6));
      e6 *= 1.0 - step(h6(vec3(id6, 5.0, 9.0)), (uStrain6 - 0.7) * 1.2);
    }
  }
  totalEmissiveRadiance = e6;
}`;

/**
 * One material for a piece's moving parts (palette by uv.x, bone by uv.y; module doc). `b` is a part builder in that
 * material (use `box` / `bx` / `cyl` / `rod` / `torus` / `sph` / `geo`); `build(name, rooms)` makes the static-pose
 * mesh whose bones the piece then moves. `part(name)` returns a further builder in the same material for parts that
 * need their own transform (movers), built with `buildPart`.
 */
export class Rig6 {
  readonly mat: THREE.MeshStandardMaterial;
  readonly col: THREE.Vector3[] = [];
  readonly rm: THREE.Vector2[] = [];
  readonly em: THREE.Vector3[] = [];
  readonly bones: THREE.Matrix4[] = [];
  readonly cut = { value: -1 };
  readonly strain = { value: 0 };
  private readonly time = { value: 0 };
  readonly b: Builder;
  private readonly depth: THREE.MeshDepthMaterial;
  private readonly dist: THREE.MeshDistanceMaterial;
  constructor(readonly L: LevelBuild, readonly name: string) {
    for (let i = 0; i < PAL_N; i++) {
      const [hex, r, m] = PAL_DEF[i];
      const c = new THREE.Color(hex);
      this.col.push(new THREE.Vector3(c.r, c.g, c.b));
      this.rm.push(new THREE.Vector2(r, m));
      this.em.push(new THREE.Vector3());
    }
    for (let i = 0; i < MAXB; i++) this.bones.push(new THREE.Matrix4());
    const m = L.ctx.materials.clone('painted_white', {
      color: 0xffffff, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, emissiveMap: null,
      emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.5, metalness: 0,
    });
    m.name = `sp6_rig_${name}`;
    const bones = this.bones, col = this.col, rm = this.rm, em = this.em, cut = this.cut, strain = this.strain, time = this.time;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uBone6: { value: bones }, uCol6: { value: col }, uRM6: { value: rm }, uE6: { value: em }, uCut6: cut, uStrain6: strain, uTime6: time });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', RIG_VERT_HEAD).replace('#include <beginnormal_vertex>', RIG_NORMAL).replace('#include <begin_vertex>', RIG_POS);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', RIG_FRAG_HEAD).replace('#include <color_fragment>', RIG_COLOR)
        .replace('#include <roughnessmap_fragment>', RIG_ROUGH).replace('#include <metalnessmap_fragment>', RIG_METAL)
        .replace('#include <emissivemap_fragment>', RIG_EMIT);
    };
    m.customProgramCacheKey = () => 'sp6_rig';
    this.mat = m;
    const patchDepth = (sh: THREE.WebGLProgramParametersWithUniforms) => {
      sh.uniforms.uBone6 = { value: bones };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', RIG_VERT_HEAD).replace('#include <begin_vertex>', RIG_POS);
    };
    this.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.depth.onBeforeCompile = patchDepth;
    this.depth.customProgramCacheKey = () => 'sp6_rig_depth';
    this.dist = new THREE.MeshDistanceMaterial();
    this.dist.onBeforeCompile = patchDepth;
    this.dist.customProgramCacheKey = () => 'sp6_rig_dist';
    this.b = L.part(name);
    L.updaters.push((_dt, t) => { time.value = t; });
  }
  /** Set palette entry `pi`'s albedo (hex), and optionally roughness / metalness. */
  paint(pi: number, hex: number, rough?: number, metal?: number) {
    const c = new THREE.Color(hex);
    this.col[pi].set(c.r, c.g, c.b);
    if (rough !== undefined) this.rm[pi].x = rough;
    if (metal !== undefined) this.rm[pi].y = metal;
  }
  /** Emission of palette entry `pi` (linear colour × gain). */
  emit(pi: number, color: THREE.ColorRepresentation, gain: number) {
    const c = new THREE.Color(color);
    this.em[pi].set(c.r * gain, c.g * gain, c.b * gain);
  }
  /** Bone `i` = a rotation (Euler YXZ) about world pivot `p`, then a translation `t`. */
  pivot(i: number, px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0) {
    const m = this.bones[i];
    m.makeTranslation(-px, -py, -pz);
    _rm.makeRotationFromEuler(_re.set(rx, ry, rz, 'YXZ'));
    m.premultiply(_rm);
    _rm.makeTranslation(px + tx, py + ty, pz + tz);
    m.premultiply(_rm);
  }
  /** Bone `i` = an arbitrary matrix (world rest pose → posed). */
  setBone(i: number, m: THREE.Matrix4) { this.bones[i].copy(m); }
  /** Collapse bone `i` (its parts vanish) or restore identity. */
  hide(i: number, hidden = true) { if (hidden) this.bones[i].makeScale(0, 0, 0); else this.bones[i].identity(); }

  // ── part helpers (palette pi, bone; geometry under `p`'s current transform)
  box(pi: number, bone: number, cx: number, cy: number, cz: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0, p: Builder = this.b) {
    p.geo(this.mat, palGeo('box', pi, bone, () => unitBox().clone()), 'keep', trs(cx, cy, cz, rx, ry, rz, w, h, d));
    return this;
  }
  bx(pi: number, bone: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, p: Builder = this.b) {
    return this.box(pi, bone, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, 0, 0, p);
  }
  cyl(pi: number, bone: number, cx: number, cy: number, cz: number, r: number, len: number, axis: 'x' | 'y' | 'z' = 'y', seg = 12, p: Builder = this.b) {
    const rx = axis === 'z' ? PI / 2 : 0, rz = axis === 'x' ? -PI / 2 : 0;
    p.geo(this.mat, palGeo(`cyl${seg}`, pi, bone, () => unitCyl(seg).clone()), 'keep', trs(cx, cy, cz, rx, 0, rz, r, len, r));
    return this;
  }
  rod(pi: number, bone: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, seg = 8, p: Builder = this.b) {
    const d = _ra.set(bx - ax, by - ay, bz - az), len = d.length();
    if (len < 1e-5) return this;
    _rq.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
    const m = new THREE.Matrix4().compose(_rb.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _rq, _rs.set(r, len, r));
    p.geo(this.mat, palGeo(`cyl${seg}`, pi, bone, () => unitCyl(seg).clone()), 'keep', m);
    return this;
  }
  sph(pi: number, bone: number, cx: number, cy: number, cz: number, r: number, seg = 10, sy = 1, p: Builder = this.b) {
    p.geo(this.mat, palGeo(`sph${seg}`, pi, bone, () => unitSphere(seg).clone()), 'keep', trs(cx, cy, cz, 0, 0, 0, r, r * sy, r));
    return this;
  }
  /** Torus of radius R, tube t, axis = its symmetry axis. */
  torus(pi: number, bone: number, cx: number, cy: number, cz: number, R: number, t: number, axis: 'x' | 'y' | 'z' = 'y', seg = 16, p: Builder = this.b) {
    const rx = axis === 'y' ? PI / 2 : 0, ry = axis === 'x' ? PI / 2 : 0;
    const ratio = Math.round((t / R) * 1000) / 1000;
    p.geo(this.mat, palGeo(`tor${seg}_${ratio}`, pi, bone, () => unitTorus(seg, ratio).clone()), 'keep', trs(cx, cy, cz, rx, ry, 0, R, R, R));
    return this;
  }
  /** Any geometry: its uv is overwritten to (pi, bone) unless `keepUv` (cascade parts set their own). */
  geo(g: THREE.BufferGeometry, pi: number, bone: number, m?: THREE.Matrix4, keepUv = false, p: Builder = this.b) {
    if (!keepUv) {
      const n = g.getAttribute('position').count, uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { uv[i * 2] = pi + 0.5; uv[i * 2 + 1] = bone + 0.5; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    p.geo(this.mat, g, 'keep', m);
    return this;
  }
  /** A further builder in this material (its own mesh; build it with `buildPart`). */
  part(name: string): Builder { return this.L.part(`${this.name}_${name}`); }
  /** The rig's main mesh (bones apply), tagged `rooms`, bounding sphere grown by `margin` (bones move parts). */
  build(rooms: string[], margin = 1.0, cast = true): THREE.Mesh | null {
    return this.finish(this.b, rooms, margin, cast);
  }
  buildPart(p: Builder, rooms: string[], cast = true): THREE.Mesh | null { return this.finish(p, rooms, 0.05, cast, false); }
  private finish(p: Builder, rooms: string[], margin: number, cast: boolean, add = true): THREE.Mesh | null {
    const g = p.build();
    const mesh = g.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh) ?? null;
    if (!mesh) return null;
    g.remove(mesh);
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere!.radius += margin;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = this.depth;
    mesh.customDistanceMaterial = this.dist;
    mesh.userData.rooms = rooms.slice();
    mesh.name = `${p.name}:rig`;
    mesh.matrixAutoUpdate = true;
    if (add) this.L.root.add(mesh);
    return mesh;
  }
}
const _rm = new THREE.Matrix4();
const _re = new THREE.Euler();
const _ra = new THREE.Vector3(), _rb = new THREE.Vector3(), _rs = new THREE.Vector3();
const _rq = new THREE.Quaternion();

/** A mover group under L.root (rooms tagged) holding one rig-material part mesh; registered with physics for decals. */
function moverPart(L: LevelBuild, rig: Rig6, p: Builder, name: string, rooms: string[], mover = true): { mount: THREE.Group; mesh: THREE.Mesh | null } {
  const mesh = rig.buildPart(p, rooms);
  const mount = new THREE.Group(); mount.name = name; mount.userData.rooms = rooms.slice();
  if (mesh) { mesh.matrixAutoUpdate = true; mount.add(mesh); }
  L.root.add(mount);
  if (mover) L.ctx.physics?.addMover?.(mount);
  return { mount, mesh };
}

// ═════════════════════════════════════════════════════════════ TUBES (the tether, the phone cord)

/** A polyline sampled by arc length. */
class Path6 {
  readonly pts: THREE.Vector3[];
  readonly acc: number[] = [0];
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++) this.acc.push(this.acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  get length() { return this.acc[this.acc.length - 1]; }
  /** Point at arc length a (clamped; beyond the end it extrapolates along the last segment). */
  at(a: number, out: THREE.Vector3): THREE.Vector3 {
    const acc = this.acc, n = acc.length;
    if (a <= 0) return out.copy(this.pts[0]);
    if (a >= acc[n - 1]) {
      const p1 = this.pts[n - 1], p0 = this.pts[n - 2];
      return out.copy(p1).addScaledVector(_pd.subVectors(p1, p0).normalize(), a - acc[n - 1]);
    }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (acc[mid] <= a) lo = mid; else hi = mid; }
    const k = (a - acc[lo]) / Math.max(1e-6, acc[hi] - acc[lo]);
    return out.lerpVectors(this.pts[lo], this.pts[hi], k);
  }
}
const _pd = new THREE.Vector3();

/** Smooth a coarse control polyline into a dense one (Catmull-Rom, centripetal). */
function densePath(ctrl: THREE.Vector3[], step = 0.04): THREE.Vector3[] {
  const c = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const n = Math.max(8, Math.ceil(c.getLength() / step));
  return c.getSpacedPoints(n);
}

/**
 * A tube of fixed capacity whose centre line is rewritten on demand (`set(points)`), parallel-transport frames,
 * uv = (arc metres, angle × r metres). Index buffer fixed; `drawRange` covers the used segments.
 */
class Tube6 {
  readonly geo = new THREE.BufferGeometry();
  private readonly P: Float32Array;
  private readonly N: Float32Array;
  private readonly U: Float32Array;
  constructor(readonly maxPts: number, readonly radial: number, public r: number, readonly uvMode: 'metres' | 'pal' = 'metres', readonly palUv: [number, number] = [0.5, 0.5]) {
    const cols = radial + 1, nv = maxPts * cols;
    this.P = new Float32Array(nv * 3); this.N = new Float32Array(nv * 3); this.U = new Float32Array(nv * 2);
    const I: number[] = [];
    for (let i = 0; i < maxPts - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * cols + j, b = (i + 1) * cols + j, c = i * cols + j + 1, d = (i + 1) * cols + j + 1;
      I.push(a, c, b, b, c, d);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.P, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.N, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.U, 2));
    this.geo.setIndex(I);
    if (uvMode === 'pal') for (let i = 0; i < nv; i++) { this.U[i * 2] = palUv[0]; this.U[i * 2 + 1] = palUv[1]; }
  }
  set(pts: readonly THREE.Vector3[], a0 = 0) {
    const n = Math.min(pts.length, this.maxPts), cols = this.radial + 1;
    if (n < 2) { this.geo.setDrawRange(0, 0); return; }
    const T = _t6, Nn = _n6, B = _b6;
    T.subVectors(pts[1], pts[0]).normalize();
    Nn.set(0, 1, 0); if (Math.abs(T.y) > 0.9) Nn.set(1, 0, 0);
    B.crossVectors(T, Nn).normalize(); Nn.crossVectors(B, T).normalize();
    let arc = a0;
    for (let i = 0; i < n; i++) {
      if (i > 0) arc += pts[i].distanceTo(pts[i - 1]);
      const tn = _t7.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
      if (tn.lengthSq() > 1e-12) {
        tn.normalize();
        // parallel transport: rotate the frame from T to tn
        const axis = _a6.crossVectors(T, tn), s = axis.length();
        if (s > 1e-6) { const ang = Math.atan2(s, T.dot(tn)); axis.multiplyScalar(1 / s); Nn.applyAxisAngle(axis, ang); B.applyAxisAngle(axis, ang); }
        T.copy(tn);
      }
      for (let j = 0; j <= this.radial; j++) {
        const ph = (j / this.radial) * TAU, c = Math.cos(ph), s = Math.sin(ph);
        const k = (i * cols + j) * 3;
        const nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s;
        this.N[k] = nx; this.N[k + 1] = ny; this.N[k + 2] = nz;
        this.P[k] = pts[i].x + nx * this.r; this.P[k + 1] = pts[i].y + ny * this.r; this.P[k + 2] = pts[i].z + nz * this.r;
        if (this.uvMode === 'metres') { const u = (i * cols + j) * 2; this.U[u] = arc; this.U[u + 1] = ph * this.r; }
      }
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('uv') as THREE.BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * this.radial * 6);
    this.geo.computeBoundingSphere();
  }
}
const _t6 = new THREE.Vector3(), _n6 = new THREE.Vector3(), _b6 = new THREE.Vector3(), _t7 = new THREE.Vector3(), _a6 = new THREE.Vector3();

/** Cue callback of a timed animation: `name` at the world point its sound comes from. */
export type Cue6 = (name: string, at: THREE.Vector3) => void;

// ═════════════════════════════════════════════════════════════ 1. CHANGEOVER SWITCH (he6 east wall)

export interface PieceOpts { rooms?: string[]; collide?: boolean }
/** §2.6.6: cabinet SW x 21.0 … 21.8, z −172 … −170, h 2.0; the crank hub on its west face; five turns AUTO → MANUAL. */
export const SWITCH6 = { x0: 21.0, x1: 21.8, z0: -172.0, z1: -170.0, h: 2.0, hub: [20.95, 1.2, -171.0], turns: 5, gripR: 0.32 } as const;

/**
 * The head-end changeover switch `switch6` (§2.6.6, §8.5, §8.7.1). A navy cabinet against the east wall (face x 21.0,
 * facing −x), a white mode plate `헤드엔드 모드` with AUTO / MANUAL and a travelling pointer, a big two-handed crank
 * (hub at (20.95, 1.2, −171.0), arm 0.72 m, rubber grips 0.22 m long at radius 0.32), the Castell key barrel beside it
 * (z −170.38, `KEY A — RELEASED IN MANUAL ONLY`) holding KEY A, the `switch6` status screen (`terminal_idle`, text
 * `헤드엔드 모드: 자동`; the story writes it). Moving: `setProgress(k)` 0 … 1 = five turns clockwise as seen by the
 * operator, the pointer travelling AUTO → MANUAL over k 0.1 … 0.92 and clunking over; `keyOut(k)` 0 in … 0.4 turned
 * … 0.8 drawn out 5 cm … 1 gone (taken). Calls: ONE rig mesh (crank, pointer, key) + the screen; the cabinet, plate,
 * barrel and labels in the zone. Collider: the cabinet (nav). `userData`: `setProgress`, `keyOut`, `k`, `keyK`,
 * `grips()` (world centres of both grips now — W1's hand IK), `hub`, `keyPoint`.
 */
export function switch6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const rooms = o.rooms ?? b.rooms.slice();
  const navy: Mat = libOr6(L, 'navy_grey', 'wall_panel_dark'), dark: Mat = 'painted_dark', steel: Mat = 'steel_raw';
  const F = SWITCH6.x0, [HX, HY, HZ] = SWITCH6.hub, KZ = -170.38, KY = 1.2;
  // cabinet (back 1 cm off the wall face), toe recess, raised frame, louvres, hinges
  b.bx(navy, F, 0.1, -172.0, 21.79, 2.0, -170.0);
  b.bx(dark, F + 0.03, 0, -171.97, 21.79, 0.1, -170.03);
  b.bx(navy, F - 0.012, 1.96, -171.98, F, 1.985, -170.02).bx(navy, F - 0.012, 0.12, -171.98, F, 0.145, -170.02);
  b.bx(navy, F - 0.012, 0.145, -171.98, F, 1.96, -171.955).bx(navy, F - 0.012, 0.145, -170.045, F, 1.96, -170.02);
  for (let i = 0; i < 6; i++) b.bx(dark, F - 0.004, 0.22 + i * 0.045, -171.7, F, 0.245 + i * 0.045, -171.3);
  for (const y of [0.5, 1.7]) b.cyl(steel, F - 0.012, y, -171.99, 0.012, 0.12, 'y', 8);
  b.sign('절체 스위치 CS-1\n헤드엔드 보호', 'label', F - 0.002, 0.62, -171.0, 0.5, 0.12, '-x');
  b.sign('위험 — 10 kV DC — 급전', 'warning', F - 0.002, 0.42, -171.0, 0.5, 0.1, '-x');
  // mode plate + labels (the pointer pivots at y 1.90 and points down)
  b.bx('painted_white', F - 0.01, 1.54, -171.3, F, 1.96, -170.7);
  b.sign('헤드엔드 모드', 'stencil', F - 0.01, 1.585, -171.0, 0.34, 0.05, '-x');
  b.sign('자동', 'label', F - 0.01, 1.72, -171.124, 0.13, 0.05, '-x');
  b.sign('수동', 'label', F - 0.01, 1.72, -170.876, 0.15, 0.05, '-x');
  // crank boss flange
  b.cyl(steel, F - 0.015, HY, HZ, 0.13, 0.03, 'x', 24);
  // Castell barrel + slot + label
  b.cyl('brass', F - 0.025, KY, KZ, 0.05, 0.05, 'x', 18);
  b.cyl(steel, F - 0.004, KY, KZ, 0.068, 0.008, 'x', 18);
  b.bx('painted_dark', F - 0.054, KY - 0.03, KZ - 0.004, F - 0.05, KY + 0.03, KZ + 0.004);
  b.sign('키 A — 해제됨\n수동 모드에서만', 'warning', F - 0.002, 1.04, KZ, 0.3, 0.1, '-x');
  // status screen bezel
  b.bx(dark, F - 0.006, 1.41, -170.53, F, 1.59, -170.27);
  const scr = L.screen('switch6', 'terminal_idle', 0.24, 0.15, F - 0.01, 1.5, -170.4, '-x', { text: '헤드엔드 모드: 자동' });
  scr.userData.rooms = rooms.slice();
  if (o.collide !== false) b.collide(F, 0, -172.0, 21.8, 2.0, -170.0, 'metal', true);

  // ── rig: crank (bone 1), pointer (2), key A (3)
  const R = new Rig6(L, 'switch6');
  R.cyl(PAL.steel, 1, F - 0.075, HY, HZ, 0.03, 0.09, 'x', 12);
  R.cyl(PAL.steel, 1, HX - 0.09, HY, HZ, 0.065, 0.06, 'x', 16);
  R.box(PAL.navy, 1, HX - 0.115, HY, HZ, 0.035, 0.72, 0.07);
  for (const s of [1, -1]) {
    const gy = HY + s * SWITCH6.gripR;
    R.cyl(PAL.steel, 1, HX - 0.14, gy, HZ, 0.03, 0.02, 'x', 12);
    R.cyl(PAL.rubber, 1, HX - 0.26, gy, HZ, 0.024, 0.22, 'x', 12);
    R.sph(PAL.steel, 1, HX - 0.375, gy, HZ, 0.03, 10);
  }
  R.box(PAL.red, 2, F - 0.016, 1.83, -171.0, 0.004, 0.14, 0.012);
  R.cyl(PAL.dark, 2, F - 0.016, 1.9, -171.0, 0.02, 0.008, 'x', 12);
  R.cyl(PAL.brass, 3, F - 0.075, KY, KZ, 0.008, 0.05, 'x', 8);
  R.box(PAL.brass, 3, F - 0.115, KY, KZ, 0.03, 0.065, 0.01);
  R.torus(PAL.steel, 3, F - 0.135, KY - 0.04, KZ, 0.012, 0.0025, 'z', 10);
  R.box(PAL.red, 3, F - 0.135, KY - 0.075, KZ, 0.004, 0.05, 0.035);
  R.build(rooms, 0.6);

  let k = 0, kk = 0;
  const setProgress = (v: number) => {
    k = clamp01(v);
    const a = k * SWITCH6.turns * TAU + 0.05 * Math.sin(k * SWITCH6.turns * TAU * 2) * Math.sin(k * PI);
    R.pivot(1, HX, HY, HZ, a, 0, 0);
    const u = smooth(ramp(k, 0.1, 0.92)), over = 0.06 * Math.sin(PI * ramp(k, 0.92, 1.0));
    R.pivot(2, F - 0.016, 1.9, -171.0, lerp(0.6, -0.6, u) - over, 0, 0);
  };
  const keyOut = (v: number) => {
    kk = clamp01(v);
    if (kk >= 0.999) { R.hide(3); return; }
    R.pivot(3, F - 0.05, KY, KZ, (PI / 2) * smooth(ramp(kk, 0, 0.4)), 0, 0, -0.05 * smooth(ramp(kk, 0.4, 0.8)), 0, 0);
  };
  setProgress(0); keyOut(0);
  const root = new THREE.Object3D(); root.name = 'switch6'; root.position.set(F, 0, HZ);
  const ud = root.userData;
  ud.setProgress = setProgress;
  ud.keyOut = keyOut;
  Object.defineProperty(ud, 'k', { get: () => k, enumerable: true });
  Object.defineProperty(ud, 'keyK', { get: () => kk, enumerable: true });
  ud.grips = (): [THREE.Vector3, THREE.Vector3] => {
    const a = k * SWITCH6.turns * TAU, r = SWITCH6.gripR;
    return [V(HX - 0.26, HY + r * Math.cos(a), HZ + r * Math.sin(a)), V(HX - 0.26, HY - r * Math.cos(a), HZ - r * Math.sin(a))];
  };
  ud.hub = V(HX, HY, HZ);
  ud.keyPoint = V(F - 0.06, KY, KZ);
  L.root.add(root); L.objects.set('switch6', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ 2. BEACH JOINT (vault south wall)

/** §2.6.7: enclosure x −13.2 … −10.8, z −179.8 … −178.6, h 2.2; two 1.2 m sliding leaves in the channel z −178.6 … −178.5. */
export const BJ6 = {
  x0: -13.2, x1: -10.8, zWall: -179.8, zFront: -178.6, h: 2.2, leaf: 1.2, travel: 1.2, zLeaf: -178.555, leafT: 0.05,
  barrel: [-12.0, 1.2, -178.55], connector: [-12.0, 1.09, -179.0], keyB: [-11.5, 0.78, -178.95],
} as const;

/**
 * The beach joint `bj6` (§2.6.7, §4.6, §8.7.2, S1j). Static (zone): the enclosure's side walls and roof, the 5.1 m
 * track header over the channel (with the `bj6` interlock screen on its face, `비치 조인트 — 인터록 키 A`), the
 * floor guide (12 mm), the joint housing inside (x −12.9 … −11.1, to z −178.95, top y 0.95) with the splice tray on it,
 * the sea cable rising into its breakout, the connector receptacle, Key B's barrel and lamp. Moving: two **bi-parting
 * sliding leaves** (1.2 × 2.0 m, z −178.58 … −178.53; registered movers; one dynamic box each, following the leaf in
 * every state — closed they shut the front, open they stand at x −14.4 … −13.2 and −10.8 … −9.6), Key A in the
 * Castell lock on the east leaf's meeting stile (it rides with the leaf) and the lock's bolt into the west leaf, the
 * 96 laser-green fibres (emissive, the cascade + strain flicker in the shader), the multi-pin connector with its
 * T-handle, Key B. API: `unlock(k)` Key A appears in the barrel and turns (k 0 … 0.6), the bolt withdraws (0.5 … 1);
 * `open(k)` the leaves part (0 shut … 1 open); `strain(k)` the connector creeps out (≤ 14 mm, a shudder from 0.3) and
 * the fibres flicker from 0.6, the first snap past 0.7; `rip(onCue?)` (1.05 s: the connector tears out and drops to
 * hang by its stubs, the green dies in a cascade from the connector along the tray over 0.8 s, Key B's barrel frees at
 * 0.2 s — cues `tear` (0), `keyB` (0.2), `dark` (0.9)); `ripped()` = the end state at once (no cues); `takeKeyB()`
 * hides Key B. Calls: 3 (two leaves + the loom rig) + the screen. Colliders: side walls (nav), roof / header (no
 * nav), the joint housing (to y 1.05: the enclosure region cannot be entered with the doors open — 0.95 m headroom
 * over it). `userData`: the methods, `boxes` (the two dynamic boxes), `glowPoint` (inside, for the D-task's green
 * light), `lockPoint`, `loomPoint`, `keyBPoint`.
 */
export function beachJoint6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const rooms = o.rooms ?? b.rooms.slice();
  const navy: Mat = libOr6(L, 'navy_grey', 'wall_panel_dark'), dark: Mat = 'painted_dark', steel: Mat = 'steel_raw';
  const { x0, x1, zWall, zFront, h, leaf, zLeaf, leafT } = BJ6;
  const xm = (x0 + x1) / 2;
  // (IA-6, check:nav: the leaves are dynamic boxes, so no nav node knew the enclosure — nodes 3 cm in front of the shut
  //  leaves, links along its face stopped; the enclosure's footprint is a nav obstacle)
  L.obstacles.push(new THREE.Box3(new THREE.Vector3(x0, 0.3, zWall), new THREE.Vector3(x1, 2.0, zLeaf + leafT / 2)));
  // ── static shell
  b.bx(navy, x0, 0, zWall + 0.01, x0 + 0.2, h, zFront - 0.02).bx(navy, x1 - 0.2, 0, zWall + 0.01, x1, h, zFront - 0.02);
  b.bx(navy, x0, 2.0, zWall + 0.01, x1, h - 0.02, zFront - 0.02);
  b.bx(dark, x0 + 0.2, 0, zWall + 0.01, x1 - 0.2, 2.0, zWall + 0.04);
  b.bx(navy, x0 - 1.35, 2.04, zFront - 0.06, x1 + 1.35, 2.44, zFront + 0.16);
  b.bx(steel, x0 - 1.35, 0, zFront - 0.01, x1 + 1.35, 0.012, zFront + 0.11);
  b.sign('비치 조인트 2 — 96F 해저 케이블', 'stencil', x0 - 0.55, 2.24, zFront + 0.16, 1.1, 0.1, '+z');
  b.sign('인터록 — 키 A', 'stencil', x1 + 0.55, 2.24, zFront + 0.16, 1.0, 0.1, '+z');
  const scr = L.screen('bj6', 'interlock', 0.46, 0.26, xm, 2.24, zFront + 0.165, '+z', { text: '비치 조인트 — 인터록 키 A' });
  scr.userData.rooms = rooms.slice();
  b.sign('키 B', 'label', BJ6.keyB[0], BJ6.keyB[1] + 0.1, -178.95, 0.12, 0.05, '+z');
  if (o.collide !== false) {
    b.collide(x0, 0, zWall, x0 + 0.2, h, zFront - 0.02, 'metal', true).collide(x1 - 0.2, 0, zWall, x1, h, zFront - 0.02, 'metal', true);
    b.collide(x0, 2.0, zWall, x1, h, zFront - 0.02, 'metal', false).collide(x0 - 1.35, 2.04, zFront - 0.06, x1 + 1.35, 2.44, zFront + 0.16, 'metal', false);
    b.collide(x0 + 0.2, 0, zWall, x1 - 0.2, 1.05, -178.95, 'metal', true);
  }

  // ── rig (bones: 1 key A, 2 bolt — leaf-local; 3 connector, 4 key B — world)
  const R = new Rig6(L, 'bj6');
  R.emit(PAL.lensB, 0x3dff6a, 3.2);
  R.emit(PAL.lensA, 0xff2a14, 3.0);
  // joint housing + tray
  R.bx(PAL.navy, 0, -12.9, 0, zWall + 0.05, -11.1, 0.95, -178.95);
  R.bx(PAL.dark, 0, -12.88, 0, -178.97, -11.12, 0.1, -178.94);
  R.bx(PAL.dark, 0, -12.86, 0.95, -179.72, -11.14, 0.965, -179.0);
  R.bx(PAL.steel, 0, -12.86, 0.965, -179.72, -11.14, 0.995, -179.71).bx(PAL.steel, 0, -12.86, 0.965, -179.01, -11.14, 0.99, -179.0);
  R.bx(PAL.steel, 0, -12.87, 0.965, -179.72, -12.86, 0.995, -179.0).bx(PAL.steel, 0, -11.14, 0.965, -179.72, -11.13, 0.995, -179.0);
  for (let i = 0; i < 5; i++) R.bx(PAL.white, 0, -12.5 + i * 0.26, 0.965, -179.46, -12.32 + i * 0.26, 0.978, -179.38);
  // sea cable up the west side into the breakout
  R.cyl(PAL.tar, 0, -12.95, 0.51, -179.6, 0.042, 1.02, 'y', 14);
  R.rod(PAL.tar, 0, -12.95, 1.0, -179.6, -12.83, 0.99, -179.6, 0.038, 12);
  R.cyl(PAL.steel, 0, -12.84, 0.99, -179.6, 0.05, 0.04, 'x', 14);
  R.box(PAL.dark, 0, -12.77, 0.985, -179.6, 0.08, 0.04, 0.09);
  // connector receptacle (static)
  R.bx(PAL.dark, 0, -12.12, 0.965, -179.13, -11.88, 1.2, -179.075);
  R.torus(PAL.steel, 0, -12.0, 1.09, -179.07, 0.068, 0.008, 'z', 18);
  // fibres: 96, breakout → fanned across the tray → converging into the connector's rear; cascade order from the connector
  const rnd = rng(9601);
  for (let i = 0; i < 96; i++) {
    const s = i / 95, u = (i % 12) / 11, lane = Math.floor(i / 12) / 7;
    const ctrl = [
      V(-12.75, 0.987, -179.6 + (s - 0.5) * 0.05),
      V(-12.55 + u * 0.15, 0.976, -179.66 + lane * 0.08),
      V(-12.3 + u * 1.05, 0.974 + lane * 0.002, -179.6 + lane * 0.12 + (rnd() - 0.5) * 0.02),
      V(-12.25 + u * 0.95 + (rnd() - 0.5) * 0.04, 0.976, -179.22 + (rnd() - 0.5) * 0.03),
      V(-12.0 + (u - 0.5) * 0.22, 1.02 + lane * 0.005, -179.14),
      V(-12.0 + (u - 0.5) * 0.05, 1.09 + (lane - 0.5) * 0.04, -179.08),
    ];
    const pts = densePath(ctrl, 0.05);
    const path = new Path6(pts), len = path.length, stagger = rnd() * 0.18;
    const t = new Tube6(pts.length, 3, 0.0028, 'pal');
    t.set(pts);
    const uv = t.geo.getAttribute('uv') as THREE.BufferAttribute;
    const idf = PAL.lensB + 0.05 + 0.9 * ((i + 0.5) / 96);
    for (let j = 0; j < pts.length; j++) {
      const ord = Math.min(0.999, (1 - path.acc[j] / len) * 0.8 + stagger);
      for (let r = 0; r <= 3; r++) uv.setXY(j * 4 + r, idf, 20 + ord);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', t.geo.getAttribute('position').clone());
    g.setAttribute('normal', t.geo.getAttribute('normal').clone());
    g.setAttribute('uv', uv.clone());
    const idx = t.geo.index!, n = (pts.length - 1) * 3 * 6;
    g.setIndex(Array.from(idx.array as ArrayLike<number>).slice(0, n));
    R.geo(g, PAL.lensB, 0, undefined, true);
  }
  // connector (bone 3) + T-handle
  const [CX, CY, CZ] = BJ6.connector;
  R.cyl(PAL.steel, 3, CX, CY, CZ, 0.055, 0.12, 'z', 18);
  R.torus(PAL.dark, 3, CX, CY, CZ + 0.035, 0.058, 0.01, 'z', 18);
  R.cyl(PAL.rubber, 3, CX, CY, CZ - 0.07, 0.03, 0.04, 'z', 12);
  R.rod(PAL.steel, 3, CX, CY, CZ + 0.06, CX, CY, CZ + 0.18, 0.012, 8);
  R.cyl(PAL.rubber, 3, CX, CY, CZ + 0.18, 0.016, 0.24, 'x', 12);
  R.box(PAL.yellow, 3, CX, CY + 0.058, CZ, 0.03, 0.004, 0.06);
  // key B barrel + lamp (static) and key B (bone 4)
  const [KBX, KBY, KBZ] = BJ6.keyB;
  R.cyl(PAL.brass, 0, KBX, KBY, KBZ + 0.02, 0.04, 0.04, 'z', 16);
  R.bx(PAL.black, 0, KBX - 0.004, KBY - 0.026, KBZ + 0.04, KBX + 0.004, KBY + 0.026, KBZ + 0.044);
  R.cyl(PAL.lensA, 0, KBX + 0.14, KBY, KBZ + 0.0075, 0.015, 0.015, 'z', 12);
  R.torus(PAL.steel, 0, KBX + 0.14, KBY, KBZ + 0.012, 0.018, 0.004, 'z', 12);
  R.cyl(PAL.brass, 4, KBX, KBY, KBZ + 0.06, 0.008, 0.04, 'z', 8);
  R.box(PAL.brass, 4, KBX, KBY, KBZ + 0.09, 0.06, 0.03, 0.01);
  R.torus(PAL.steel, 4, KBX + 0.04, KBY, KBZ + 0.09, 0.012, 0.0025, 'z', 10);
  R.box(PAL.green, 4, KBX + 0.07, KBY - 0.02, KBZ + 0.09, 0.035, 0.05, 0.004);
  R.build(rooms, 0.8);

  // ── the two leaves (own meshes, movers, dynamic boxes)
  const leafPart = (name: string, east: boolean) => {
    const p = R.part(name);
    const w = leaf / 2, T = leafT / 2;
    // (the west leaf is 4 mm narrower on its meeting side: the east leaf's astragal overlaps it — zfight)
    if (east) R.box(PAL.navy, 0, 0, 1.02, 0, leaf, 2.0, leafT, 0, 0, 0, p);
    else R.box(PAL.navy, 0, -0.002, 1.02, 0, leaf - 0.004, 2.0, leafT, 0, 0, 0, p);
    for (const y of [0.62, 1.42]) R.box(PAL.navy, 0, 0, y, T + 0.006, leaf - 0.14, 0.05, 0.012, 0, 0, 0, p);
    for (const sx of [-1, 1]) R.box(PAL.navy, 0, sx * (w - 0.03), 1.02, T + 0.006, 0.06, 1.98, 0.012, 0, 0, 0, p);
    R.box(PAL.dark, 0, 0, 0.016, 0, leaf - 0.2, 0.008, leafT - 0.01, 0, 0, 0, p);
    // pull handle on the outer half
    const hx = east ? 0.36 : -0.36;
    for (const y of [0.85, 1.25]) R.cyl(PAL.steel, 0, hx, y, T + 0.03, 0.012, 0.04, 'z', 8, p);
    R.cyl(PAL.steel, 0, hx, 1.05, T + 0.055, 0.016, 0.46, 'y', 10, p);
    // laser warning triangle
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.09, -0.07, 0, 0.09, -0.07, 0, 0, 0.09, 0], 3));
    tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    R.geo(tri, PAL.yellow, 0, trs(east ? -0.15 : 0.15, 1.7, T + 0.004), false, p);
    R.box(PAL.black, 0, east ? -0.15 : 0.15, 1.69, T + 0.006, 0.012, 0.07, 0.003, 0, 0, 0, p);
    if (east) {
      // Castell lock on the meeting stile (local x −0.6 = world −12.0), key A (bone 1), the bolt (bone 2), the astragal
      R.box(PAL.dark, 0, -0.51, 1.2, T + 0.02, 0.18, 0.24, 0.04, 0, 0, 0, p);
      R.cyl(PAL.brass, 0, -0.53, 1.2, T + 0.06, 0.045, 0.04, 'z', 16, p);
      R.box(PAL.black, 0, -0.53, 1.2, T + 0.082, 0.008, 0.05, 0.004, 0, 0, 0, p);
      R.cyl(PAL.brass, 1, -0.53, 1.2, T + 0.1, 0.008, 0.04, 'z', 8, p);
      R.box(PAL.brass, 1, -0.53, 1.2, T + 0.13, 0.06, 0.012, 0.03, 0, 0, 0, p);
      R.box(PAL.red, 1, -0.53, 1.165, T + 0.13, 0.03, 0.04, 0.004, 0, 0, 0, p);
      R.box(PAL.steel, 2, -0.64, 1.165, T + 0.025, 0.08, 0.025, 0.02, 0, 0, 0, p);
      R.box(PAL.rubber, 0, -0.6, 1.02, T + 0.0095, 0.06, 1.96, 0.011, 0, 0, 0, p);
    } else {
      R.box(PAL.steel, 0, 0.555, 1.165, T + 0.025, 0.07, 0.07, 0.04, 0, 0, 0, p);
    }
    return p;
  };
  const W = moverPart(L, R, leafPart('leafW', false), 'bj6_leafW', rooms);
  const E = moverPart(L, R, leafPart('leafE', true), 'bj6_leafE', rooms);
  const xW = x0 + leaf / 2, xE = x1 - leaf / 2;
  W.mount.position.set(xW, 0, zLeaf); E.mount.position.set(xE, 0, zLeaf);
  const boxW = L.ctx.physics.addBox(new THREE.Box3(), 'metal'), boxE = L.ctx.physics.addBox(new THREE.Box3(), 'metal');
  boxW.owner = W.mount; boxE.owner = E.mount;
  let ko = 0, ku = 0, ks = 0, ripState = 0;
  const setBox = (bx: typeof boxW, x: number) => { bx.box.min.set(x - leaf / 2, 0.02, zLeaf - leafT / 2); bx.box.max.set(x + leaf / 2, 2.02, zLeaf + leafT / 2); };
  const open = (v: number) => {
    ko = clamp01(v);
    const e = minJerk(ko) * BJ6.travel;
    W.mount.position.x = xW - e; E.mount.position.x = xE + e;
    W.mount.updateMatrixWorld(true); E.mount.updateMatrixWorld(true);
    setBox(boxW, xW - e); setBox(boxE, xE + e);
  };
  const T = leafT / 2;
  const unlock = (v: number) => {
    ku = clamp01(v);
    if (ku <= 0) { R.hide(1); R.hide(2, false); return; }
    R.pivot(1, -0.53, 1.2, 0, 0, 0, (PI / 2) * smooth(ramp(ku, 0.05, 0.6)));
    R.pivot(2, -0.64, 1.165, T + 0.025, 0, 0, 0, 0.075 * smooth(ramp(ku, 0.5, 1.0)), 0, 0);
  };
  const connector = (tx: number, ty: number, tz: number, rx: number, rz = 0) => R.pivot(3, CX, CY, CZ, rx, 0, rz, tx, ty, tz);
  const strain = (v: number) => {
    ks = clamp01(v);
    if (ripState) return;
    R.strain.value = ks;
    const sh = ramp(ks, 0.3, 1.0);
    connector(0.0015 * Math.sin(ks * 97) * sh, 0.001 * Math.sin(ks * 131) * sh, 0.014 * smooth(ks) + 0.002 * Math.sin(ks * 73) * sh, -0.02 * sh * Math.sin(ks * 41), 0.03 * sh * Math.sin(ks * 59));
  };
  const keyBFree = (k: number) => R.pivot(4, KBX, KBY, KBZ, 0, 0, 0, 0, 0, 0.016 * smooth(k));
  const ripKeys: readonly (readonly [number, number, number, number, number])[] = [
    [0.0, 0, 0, 0.014, 0], [0.12, 0.015, 0.03, 0.27, -0.35], [0.3, 0.02, -0.12, 0.31, -0.95], [0.55, 0.0, -0.31, 0.19, -1.52], [0.8, 0.0, -0.345, 0.165, -1.44], [1.05, 0.0, -0.335, 0.168, -1.49],
  ];
  const ripPose = (t: number) => {
    let i = 1; while (i < ripKeys.length - 1 && t > ripKeys[i][0]) i++;
    const a = ripKeys[i - 1], c = ripKeys[i], u = minJerk((t - a[0]) / (c[0] - a[0]));
    connector(lerp(a[1], c[1], u), lerp(a[2], c[2], u), lerp(a[3], c[3], u), lerp(a[4], c[4], u), 0.12 * Math.sin(t * 9) * Math.exp(-t * 3));
    R.cut.value = t < 0.1 ? -1 : ramp(t, 0.1, 0.9) * 1.02;
    R.strain.value = t < 0.1 ? 1 : 0;
    keyBFree(ramp(t, 0.2, 0.3));
    if (t >= 0.2) R.emit(PAL.lensA, 0x30ff60, 3.0);
  };
  const ripped = () => { ripState = 2; ripPose(1.05); R.cut.value = 2; R.strain.value = 0; R.emit(PAL.lensA, 0x30ff60, 3.0); };
  const rip = (cue?: Cue6) => {
    if (ripState) return;
    ripState = 1;
    cue?.('tear', V(CX, CY, CZ + 0.1));
    let keyed = false, darked = false;
    L.tween(0, 1.05, (k) => {
      if (ripState !== 1) return;
      const t = k * 1.05;
      ripPose(t);
      if (!keyed && t >= 0.2) { keyed = true; cue?.('keyB', V(KBX, KBY, KBZ)); }
      if (!darked && t >= 0.9) { darked = true; cue?.('dark', V(-12.3, 0.98, -179.35)); }
    }, () => { if (ripState === 1) ripped(); });
  };
  open(0); unlock(0); strain(0); keyBFree(0);
  const root = new THREE.Object3D(); root.name = 'bj6'; root.position.set(xm, 0, zFront);
  const ud = root.userData;
  Object.assign(ud, { open, unlock, strain, rip, ripped, takeKeyB: () => R.hide(4), boxes: [boxW, boxE] });
  Object.defineProperty(ud, 'k', { get: () => ({ open: ko, unlock: ku, strain: ks, ripped: ripState === 2 }), enumerable: true });
  ud.glowPoint = V(xm, 1.35, -179.3);
  ud.lockPoint = V(...BJ6.barrel);
  ud.loomPoint = V(CX, CY, CZ + 0.18);
  ud.keyBPoint = V(KBX, KBY, KBZ + 0.06);
  L.root.add(root); L.objects.set('bj6', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ 3. SHAFT INTERLOCK (vault west wall, beside d6_shaft)

export const SHAFT6 = { x: -21.8, y: 1.3, z: -167.6 } as const;
/**
 * The stair-door interlock `shaft6` (§4.6, §8.7.3): a navy panel on the vault's west wall (face x −21.8, facing +x)
 * beside `d6_shaft`, the `shaft6_panel` interlock screen (`문풀 출입 — 인터록 키 B`), the Castell barrel at
 * `mk6_shaft_lock` (−21.78, 1.3, −167.6) with a red / green bolt lamp, a conduit to the door frame. `unlock(k)`: Key B
 * appears in the barrel and turns 90° (k 0.05 … 0.6), the lamp goes green at 0.6. Calls: one rig mesh (key + lamp) +
 * the screen; the rest zone. No collider (6 cm proud). `userData`: `unlock`, `k`, `keyPoint`.
 */
export function shaftLock6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const rooms = o.rooms ?? b.rooms.slice();
  const navy: Mat = libOr6(L, 'navy_grey', 'wall_panel_dark');
  const F = SHAFT6.x + 0.05, Y = SHAFT6.y, Z = SHAFT6.z;
  b.bx(navy, SHAFT6.x + 0.005, 0.9, Z - 0.32, F, 1.84, Z + 0.32);
  b.bx('painted_dark', F, 1.49, Z - 0.19, F + 0.004, 1.71, Z + 0.19);
  const scr = L.screen('shaft6_panel', 'interlock', 0.34, 0.2, F + 0.009, 1.6, Z, '+x', { text: '문풀 출입 — 인터록 키 B' });
  scr.userData.rooms = rooms.slice();
  b.cyl('brass', F + 0.025, Y, Z, 0.045, 0.05, 'x', 18);
  b.cyl('steel_raw', F + 0.004, Y, Z, 0.062, 0.008, 'x', 18);
  b.bx('painted_dark', F + 0.05, Y - 0.026, Z - 0.004, F + 0.054, Y + 0.026, Z + 0.004);
  b.cyl('steel_raw', F + 0.005, Y, Z + 0.2, 0.022, 0.01, 'x', 12);
  b.sign('문풀 출입\n인터록 키 B', 'warning', F + 0.002, 1.05, Z, 0.5, 0.14, '+x');
  b.rod('steel_raw', SHAFT6.x + 0.016, 1.78, Z - 0.32, SHAFT6.x + 0.016, 1.78, -168.75, 0.014, 8);
  const R = new Rig6(L, 'shaft6');
  R.emit(PAL.lensA, 0xff2a14, 3.0);
  R.cyl(PAL.lensA, 0, F + 0.012, Y, Z + 0.2, 0.014, 0.008, 'x', 12);
  R.cyl(PAL.brass, 1, F + 0.075, Y, Z, 0.008, 0.05, 'x', 8);
  R.box(PAL.brass, 1, F + 0.11, Y, Z, 0.01, 0.012, 0.06);
  R.torus(PAL.steel, 1, F + 0.125, Y, Z + 0.04, 0.012, 0.0025, 'x', 10);
  R.box(PAL.green, 1, F + 0.125, Y - 0.02, Z + 0.07, 0.004, 0.05, 0.035);
  R.build(rooms, 0.3);
  let k = 0;
  const unlock = (v: number) => {
    k = clamp01(v);
    if (k <= 0) { R.hide(1); R.emit(PAL.lensA, 0xff2a14, 3.0); return; }
    R.pivot(1, F + 0.05, Y, Z, (PI / 2) * smooth(ramp(k, 0.05, 0.6)), 0, 0);
    R.emit(PAL.lensA, k >= 0.6 ? 0x30ff60 : 0xff2a14, 3.0);
  };
  unlock(0);
  const root = new THREE.Object3D(); root.name = 'shaft6'; root.position.set(SHAFT6.x, Y, Z);
  root.userData.unlock = unlock;
  Object.defineProperty(root.userData, 'k', { get: () => k, enumerable: true });
  root.userData.keyPoint = V(F + 0.06, Y, Z);
  L.root.add(root); L.objects.set('shaft6', root);
  return root;
}
// ═════════════════════════════════════════════════════════════ 4. TETHER FRAME, CAGE, WINCH, TETHER (pool6 mid deck)

/** §2.6.9: the frame platform, the 2.6 m cage, the shear / pump / lever, the sheave, the winch, the tether's run. */
export const FRAME6 = {
  x0: -55, x1: -49, z0: -172, z1: -166, y: -16, roof: -13.4, openX: [-53.0, -51.0],
  shear: [-52.6, -51.4, -169.0, -168.0], shearTop: -14.6, pump: [-54.2, -53.4, -169.0, -168.2], lever: [-50.5, -50.0, -169.0, -168.4],
  pin: [-51.38, -15.0, -168.5], sheave: [-52.0, -15.2, -171.6], sheaveR: 0.3, tx: -52.0, cutZ: -168.5, hangZ: -171.9,
  winch: [-54.0, -50.0, -154.0, -150.0], winchTop: -13.0, drum: [-52.0, -14.6, -152.0], drumR: 0.75,
  lamp: [-52.0, -13.8, -166.2], water: -20.3, tetherR: 0.055, whip: 1.5, strokes: 12,
} as const;

/**
 * The tether frame `frame6` (§2.6.9, §4.8, §4.8.1, §8.7.4). Static (zone): the 2.6 m bar cage on the platform's W, E
 * and S sides and the N side either side of the 2 m opening (x −53 … −51), round bars ⌀ 25 mm at 125 mm, posts, rails,
 * a bar roof at y −13.4 — ONE merged alpha-free mesh in the zone's `steel_raw` / `painted_yellow`; its move-only boxes
 * (5 faces + roof) go to the registry; the lit instruction plate `TETHER SHEAR — 1 PIN — 2 PRESSURE 210 BAR — 3 FIRE`
 * on the north bars facing +z; the trough (x −52.3 … −51.7, h 0.25, from the winch's south face z −154 to the sheave,
 * broken under the shear); the shear's frame, crosshead and cylinder; the pump pedestal with its reservoir and hose; the
 * lever post; the sheave's stand and the deck fairlead; the winch (skid, end frames, motor, the ridged hood with corner
 * posts, top y −13.0); the work-lamp fixture over the frame. Moving (ONE rig mesh, bones): the shear blade (1), the
 * safety pin (2), the pump handle (3), the pump's dial needle (4), the firing lever (5), its hinged guard (6), the
 * sheave wheel (7), the winch drum with its wound cable (8), the brake lever (9); the lamp lens (emission). The
 * **tether** (`cable_armour`, ⌀ 110 mm): TWO meshes split at the shear (z −168.5) — winch side: drum → trough →
 * shear; well side: shear → over the sheave → down the well at z −171.9 into the water and on to y −28.
 * API: `pin(k)` (0 in … 0.85 drawn 0.33 m … 1 dropped on the deck), `pump(k)` (12 strokes over k 0 … 1; the needle
 * 0 → 210 bar; with `screenAuto` the `gauge6` screen reads `0 BAR — 펌프` / `n BAR` / `210 BAR — READY` once the pin
 * is out), `guard(k)` (0 shut … 1 sprung open), `lever(k)` (0 safe … 1 thrown), `fire(onCue?)` — the §4.8.1 timeline:
 * cue `fire` 0.0 (lever), `slam` 0.05 (the blade drops), `part` 0.25 (the tether parts: the winch end whips back 1.5 m
 * along the trough with a decaying S-wave, the drum spins free; the well end slips over the sheave and falls), `splash`
 * when its free end meets the water (≈ 0.9 s), `brake` 1.4 (the drum brakes over 0.35 s) — each with its world point;
 * `fired()` = the end state at once (no cues); `winch(w)` drum speed in rad/s while paying out (0 = still); `brake()`;
 * `lamp(k)` the work-lamp lens. Calls: rig 1 + tether 2 + the `gauge6` screen = 4 (cage, trough, frames in the zone).
 * Colliders (solid, nav): shear, pump pedestal, lever post, sheave stand, winch (to y −13.0, its ridge standable);
 * trough (no nav). `userData`: the methods, `state()`, `pinPoint`, `pumpGrip()`, `leverGrip()`, `shearPoint`,
 * `sheavePoint`, `wellPoint`, `winchPoint`, `lampPoint`, `lampTarget`, `screenAuto`.
 */
export function frame6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const F = FRAME6, rooms = o.rooms ?? b.rooms.slice();
  const Y = F.y, steel: Mat = 'steel_raw', dark: Mat = 'painted_dark';
  const yellow: Mat = libOr6(L, 'crane_yellow', 'painted_yellow'), navy: Mat = libOr6(L, 'navy_grey', 'wall_panel_dark');
  const col = o.collide !== false;

  // ── the cage: bars ⌀ 25 mm @ 125 mm, posts 60 mm, flat-bar rails, bar roof
  const BR = 0.0125, H0 = Y + 0.06, H1 = F.roof - 0.04;
  const posts: [number, number][] = [];
  const bars = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.125);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = lerp(ax, bx, u), z = lerp(az, bz, u);
      if (posts.some(([px, pz]) => Math.abs(px - x) < 0.06 && Math.abs(pz - z) < 0.06)) continue;
      b.cyl(steel, x, (H0 + H1) / 2, z, BR, H1 - H0, 'y', 6);
    }
    b.bx(yellow, Math.min(ax, bx) - 0.015, Y, Math.min(az, bz) - 0.015, Math.max(ax, bx) + 0.015, H0, Math.max(az, bz) + 0.015);
    b.bx(yellow, Math.min(ax, bx) - 0.015, H1, Math.min(az, bz) - 0.015, Math.max(ax, bx) + 0.015, F.roof, Math.max(az, bz) + 0.015);
    b.bx(yellow, Math.min(ax, bx) - 0.012, -14.73, Math.min(az, bz) - 0.012, Math.max(ax, bx) + 0.012, -14.67, Math.max(az, bz) + 0.012);
  };
  const xw = F.x0 + 0.025, xe = F.x1 - 0.025, zs = F.z0 + 0.025, zn = F.z1 - 0.025;
  for (const z of [zs, -170.5, -169.0, -167.5, zn]) posts.push([xw, z], [xe, z]);
  for (const x of [-53.5, -52.0, -50.5]) posts.push([x, zs]);
  posts.push([F.openX[0], zn], [F.openX[1], zn], [-54.0, zn], [-50.0, zn]);
  for (const [x, z] of posts) b.bx(yellow, x - 0.03, Y, z - 0.03, x + 0.03, F.roof + 0.003, z + 0.03);
  bars(xw, zs, xw, zn); bars(xe, zs, xe, zn); bars(xw, zs, xe, zs);
  bars(xw, zn, F.openX[0], zn); bars(F.openX[1], zn, xe, zn);
  // roof: bars along x @ 125 mm under a perimeter frame
  for (let z = F.z0 + 0.0625; z < F.z1; z += 0.125) b.cyl(steel, (F.x0 + F.x1) / 2, F.roof - 0.02, z, BR, F.x1 - F.x0 - 0.06, 'x', 6);
  for (const x of [-53.5, -52.0, -50.5]) b.bx(yellow, x - 0.02, F.roof - 0.045, F.z0, x + 0.02, F.roof + 0.012, F.z1);
  // the instruction plate on the north bars (west of the opening), facing +z
  b.bx(dark, -54.64, -14.68, zn + BR + 0.002, -53.36, -14.02, zn + BR + 0.016);
  b.sign('테더 전단\n1  핀 — 2  압력 210 BAR — 3  발사', 'warning', -54.0, -14.35, zn + BR + 0.016, 1.2, 0.58, '+z');
  b.sign('케이지 너머 출입 금지 — 웨트 웰', 'danger', -50.0, -14.35, zn + BR + 0.016, 1.0, 0.16, '+z');
  b.bx(dark, -50.52, -14.45, zn + BR + 0.002, -49.48, -14.25, zn + BR + 0.016);
  moveOnly(L, F.x0, Y, F.z0, F.x0 + 0.05, F.roof, F.z1);
  moveOnly(L, F.x1 - 0.05, Y, F.z0, F.x1, F.roof, F.z1);
  moveOnly(L, F.x0, Y, F.z0, F.x1, F.roof, F.z0 + 0.05);
  moveOnly(L, F.x0, Y, F.z1 - 0.05, F.openX[0], F.roof, F.z1);
  moveOnly(L, F.openX[1], Y, F.z1 - 0.05, F.x1, F.roof, F.z1);
  moveOnly(L, F.x0, F.roof - 0.05, F.z0, F.x1, F.roof + 0.02, F.z1);

  // ── the trough (winch south face → sheave), broken under the shear
  const trough = (za: number, zb: number) => {
    // (IA-6: the trough was a 0.25 m kerb across the mid deck and the cage's opening — no body steps 0.25 (a capsule
    //  rides ≤ ~0.12), so husks / soldiers were cut off and nav nodes stood under its top. Now 0.14 m walls with a
    //  0.08 m collider every body rides over; the tether (⌀ 110 mm) still lies inside it.)
    b.bx(steel, -52.3, Y, zb, -52.27, Y + 0.14, za).bx(steel, -51.73, Y, zb, -51.7, Y + 0.14, za);
    b.bx(steel, -52.27, Y, zb, -51.73, Y + 0.015, za);
    if (col) b.collide(-52.3, Y, zb, -51.7, Y + 0.08, za, 'metal', false);
  };
  trough(-154.0, F.shear[3]); trough(F.shear[2], -171.2);

  // ── shear (static frame)
  const [sx0, sx1, sz0, sz1] = F.shear, sxm = (sx0 + sx1) / 2, szm = (sz0 + sz1) / 2;
  b.bx(steel, sx0, Y, sz0, sx1, Y + 0.05, sz1);
  b.bx(yellow, sx0, Y + 0.05, sz0, sx0 + 0.18, -14.95, sz1).bx(yellow, sx1 - 0.18, Y + 0.05, sz0, sx1, -14.95, sz1);
  b.bx(yellow, sx0, -14.95, sz0, sx1, -14.75, sz1);
  b.bx(dark, sx0 + 0.18, Y + 0.05, szm - 0.075, sx0 + 0.19, -14.95, szm + 0.075).bx(dark, sx1 - 0.19, Y + 0.05, szm - 0.075, sx1 - 0.18, -14.95, szm + 0.075);
  b.cyl(steel, sxm, -14.68, szm, 0.2, 0.14, 'y', 20).cyl(dark, sxm, F.shearTop - 0.01, szm, 0.16, 0.02, 'y', 20);
  b.sign('위험 — 전단 장치', 'danger', sx1 + 0.002, -15.62, sz0 + 0.2, 0.3, 0.09, '+x');
  // gauge housing + the gauge6 screen on the shear's north face
  b.bx(dark, sxm - 0.2, -14.95, sz1, sxm + 0.2, -14.62, sz1 + 0.08);
  const gscr = L.screen('gauge6', 'gauge', 0.3, 0.26, sxm, -14.785, sz1 + 0.085, '+z', { text: '핀 삽입됨' });
  gscr.userData.rooms = rooms.slice();
  // hose pump → shear, pin anchor block
  b.rod('rubber', -53.42, Y + 0.12, -168.6, sx0, Y + 0.12, -168.6, 0.02, 8);
  b.bx(steel, sx1, -15.12, F.pin[2] - 0.06, sx1 + 0.03, -14.88, F.pin[2] + 0.06);
  if (col) b.collide(sx0, Y, sz0, sx1, F.shearTop, sz1 + 0.08, 'metal', true);

  // ── pump pedestal
  const [px0, px1, pz0, pz1] = F.pump, pxm = (px0 + px1) / 2;
  b.bx(navy, px0 + 0.05, Y + 0.03, pz0 + 0.05, px1 - 0.05, -15.3, pz1 - 0.05);
  b.bx(dark, px0, Y, pz0, px1, Y + 0.06, pz1);
  b.cyl('painted_orange', pxm, -15.18, -168.6, 0.13, 0.62, 'x', 16);
  b.bx(steel, pxm - 0.15, -15.32, -168.75, pxm + 0.15, -15.0, -168.45);
  b.cyl('painted_white', pxm, -15.45, pz1 - 0.044, 0.07, 0.012, 'z', 20);
  b.torus(steel, pxm, -15.45, pz1 - 0.036, 0.072, 0.006, 'z', 20);
  b.sign('유압 수동 펌프 — 210 BAR', 'label', pxm, -15.7, pz1 - 0.048, 0.5, 0.07, '+z');
  if (col) b.collide(px0, Y, pz0, px1, -15.0, pz1, 'metal', true);

  // ── lever post
  const [lx0, lx1, lz0, lz1] = F.lever, lxm = (lx0 + lx1) / 2;
  b.bx(navy, lx0 + 0.05, Y + 0.03, lz0 + 0.05, lx1 - 0.05, -14.75, lz1 - 0.05);
  b.bx(dark, lx0, Y, lz0, lx1, Y + 0.06, lz1);
  b.bx(steel, lxm - 0.06, -14.88, lz1 - 0.05, lxm + 0.06, -14.76, lz1 - 0.02);
  b.sign('화재', 'danger', lxm, -15.05, lz1 - 0.048, 0.24, 0.08, '+z');
  if (col) b.collide(lx0, Y, lz0, lx1, -14.75, lz1, 'metal', true);

  // ── sheave stand + fairlead
  const [shx, shy, shz] = F.sheave;
  for (const x of [shx - 0.195, shx + 0.195]) { b.bx(yellow, x - 0.025, Y, shz - 0.09, x + 0.025, shy + 0.09, shz + 0.09); b.rod(yellow, x, Y + 0.05, -171.9, x, shy - 0.05, shz, 0.025, 8).rod(yellow, x, Y + 0.05, -171.3, x, shy - 0.05, shz, 0.025, 8); }
  b.bx(dark, shx - 0.25, Y, -171.94, shx + 0.25, Y + 0.05, -171.26);
  b.cyl(steel, shx, shy, shz, 0.04, 0.48, 'x', 12);
  b.torus(steel, F.tx, Y + 0.02, F.hangZ, 0.1, 0.022, 'y', 16).torus(steel, F.tx, Y - 0.33, F.hangZ, 0.1, 0.022, 'y', 16);
  if (col) b.collide(shx - 0.25, Y, -171.94, shx + 0.25, -14.83, -171.26, 'metal', true);

  // ── winch: skid, end frames, motor, hood on corner posts (ridge y −13.0)
  const [wx0, wx1, wz0, wz1] = F.winch, [dx, dy, dz] = F.drum;
  b.bx(steel, wx0, Y, wz0, wx1, Y + 0.15, wz1);
  for (const x of [wx0 + 0.05, wx1 - 0.25]) b.bx(yellow, x, Y + 0.15, -153.4, x + 0.2, -13.9, -150.6);
  b.cyl(steel, dx, dy, dz, 0.09, wx1 - wx0 - 0.1, 'x', 14);
  b.bx(navy, -53.5, Y + 0.15, -150.55, -52.0, -15.2, -150.08);
  for (let i = 0; i < 6; i++) b.bx(dark, -53.42 + i * 0.24, -15.4, -150.09, -53.36 + i * 0.24, -15.25, -150.06);
  for (const x of [wx0 + 0.04, wx1 - 0.04]) for (const z of [wz0 + 0.04, wz1 - 0.04]) b.bx(yellow, x - 0.04, Y + 0.15, z - 0.04, x + 0.04, -13.28, z + 0.04);
  {
    const slope = Math.atan2(0.3, 2.0), half = Math.hypot(2.0, 0.3);
    for (const s of [-1, 1]) {
      const cz = (wz0 + wz1) / 2 + s * 1.0, cy = -13.15;
      b.rbox(yellow, (wx0 + wx1) / 2, cy, cz, wx1 - wx0 + 0.1, 0.02, half, s * slope, 0, 0);
      for (let i = 0; i < 9; i++) b.push((wx0 + wx1) / 2 - 1.8 + i * 0.45, cy, cz, 0, s * slope).box(yellow, 0, 0.022, 0, 0.05, 0.025, half - 0.04).pop();
    }
    b.bx(yellow, wx0 - 0.05, -13.03, -152.04, wx1 + 0.05, F.winchTop, -151.96);
  }
  b.sign('테더 윈치 TW-1 — 22 t SWL', 'stencil', -52.0, Y + 0.075, wz0, 1.2, 0.1, '-z');
  if (col) b.collide(wx0, Y, wz0, wx1, F.winchTop, wz1, 'metal', true);

  // ── work lamp fixture over the frame (hung from the roof's north edge)
  const [lpx, lpy, lpz] = F.lamp;
  b.rod(steel, lpx, F.roof - 0.02, lpz, lpx, lpy + 0.12, lpz, 0.015, 8);
  b.bx(dark, lpx - 0.16, lpy - 0.02, lpz - 0.09, lpx + 0.16, lpy + 0.12, lpz + 0.09);

  // ── rig
  const R = new Rig6(L, 'frame6');
  R.emit(PAL.lensA, 0xfff0d8, 5.0);
  // lamp lens (tilted toward the shear)
  R.box(PAL.lensA, 0, lpx, lpy - 0.024, lpz, 0.28, 0.008, 0.15);
  // blade (bone 1)
  R.bx(PAL.steel, 1, sx0 + 0.2, -15.42, szm - 0.06, sx1 - 0.2, -14.97, szm + 0.06);
  R.bx(PAL.chrome, 1, sx0 + 0.21, -15.44, szm - 0.03, sx1 - 0.21, -15.41, szm + 0.03);
  R.bx(PAL.yellow, 1, sx0 + 0.25, -15.2, szm + 0.06, sx1 - 0.25, -15.12, szm + 0.064);
  // safety pin (bone 2): shaft through the cheek, ring + red tag outside
  const [pnx, pny, pnz] = F.pin;
  R.cyl(PAL.chrome, 2, pnx - 0.13, pny, pnz, 0.018, 0.32, 'x', 12);
  R.torus(PAL.steel, 2, pnx + 0.065, pny, pnz, 0.035, 0.007, 'x', 14);
  R.box(PAL.red, 2, pnx + 0.08, pny - 0.075, pnz, 0.004, 0.08, 0.05);
  // pump handle (bone 3, authored horizontal along +z from the pivot) + needle (bone 4)
  const PV = V(pxm, -15.05, -168.42);
  R.box(PAL.steel, 3, PV.x, PV.y, PV.z + 0.03, 0.06, 0.06, 0.08);
  R.rod(PAL.steel, 3, PV.x, PV.y, PV.z, PV.x, PV.y, PV.z + 0.62, 0.02, 10);
  R.cyl(PAL.rubber, 3, PV.x, PV.y, PV.z + 0.71, 0.026, 0.2, 'z', 12);
  R.box(PAL.red, 4, pxm, -15.45 + 0.025, pz1 - 0.03, 0.006, 0.05, 0.003);
  for (let i = 0; i <= 10; i++) { const a = (-135 + i * 27) * PI / 180; R.box(PAL.black, 0, pxm + Math.sin(a) * 0.058, -15.45 + Math.cos(a) * 0.058, pz1 - 0.035, 0.003, 0.012, 0.002, 0, 0, -a); }
  // firing lever (bone 5) + guard (bone 6)
  const LV = V(lxm, -14.82, lz1 - 0.035);
  R.cyl(PAL.steel, 5, LV.x, LV.y, LV.z, 0.03, 0.1, 'x', 12);
  R.box(PAL.red, 5, LV.x, LV.y + 0.14, LV.z + 0.01, 0.03, 0.28, 0.03);
  R.sph(PAL.red, 5, LV.x, LV.y + 0.3, LV.z + 0.01, 0.035, 12);
  const GH = V(lxm, -14.45, lz1 - 0.02);
  R.bx(PAL.yellow, 6, lx0 + 0.02, -14.46, lz1 - 0.02, lx1 - 0.02, -14.44, lz1 + 0.34);
  R.bx(PAL.yellow, 6, lx0 + 0.02, -14.86, lz1 + 0.32, lx1 - 0.02, -14.46, lz1 + 0.34);
  for (const x of [lx0 + 0.02, lx1 - 0.04]) R.bx(PAL.yellow, 6, x, -14.86, lz1 - 0.02, x + 0.02, -14.46, lz1 + 0.32);
  R.bx(PAL.black, 6, lx0 + 0.05, -14.7, lz1 + 0.341, lx1 - 0.05, -14.62, lz1 + 0.345);
  R.cyl(PAL.steel, 6, GH.x, GH.y, GH.z, 0.015, 0.44, 'x', 8);
  // sheave wheel (bone 7)
  R.cyl(PAL.dark, 7, shx, shy, shz, 0.245, 0.14, 'x', 28);
  for (const s of [-1, 1]) {
    R.cyl(PAL.yellow, 7, shx + s * 0.075, shy, shz, 0.37, 0.012, 'x', 32);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; R.cyl(PAL.black, 7, shx + s * 0.0825, shy + Math.cos(a) * 0.2, shz + Math.sin(a) * 0.2, 0.045, 0.003, 'x', 12); }
  }
  // winch drum (bone 8): wound cable core, lay ridges, flanges with bolt marks; brake drum; brake lever (bone 9)
  R.cyl(PAL.tar, 8, dx, dy, dz, F.drumR - 0.02, 2.6, 'x', 32);
  for (let i = 0; i < 22; i++) R.torus(PAL.tar, 8, dx - 1.26 + i * 0.12, dy, dz, F.drumR - 0.01, 0.05, 'x', 28);
  for (const x of [dx - 1.33, dx + 1.33]) {
    R.cyl(PAL.yellow, 8, x, dy, dz, 0.95, 0.05, 'x', 36);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; R.box(PAL.black, 8, x + Math.sign(x - dx) * 0.0275, dy + Math.cos(a) * 0.78, dz + Math.sin(a) * 0.78, 0.004, 0.09, 0.09, a, 0, 0); }
    R.box(PAL.white, 8, x + Math.sign(x - dx) * 0.0275, dy + 0.55, dz, 0.004, 0.4, 0.05);
  }
  R.cyl(PAL.steel, 8, -50.45, dy, dz, 0.5, 0.22, 'x', 28);
  const BKP = V(-50.45, dy - 0.56, dz + 0.55);
  R.torus(PAL.dark, 9, -50.45, dy, dz, 0.52, 0.018, 'x', 28);
  R.box(PAL.red, 9, BKP.x, BKP.y - 0.22, BKP.z, 0.06, 0.5, 0.06);
  R.build(rooms, 2.0);

  // ── the tether: path, two tubes
  const ctrl: [number, number][] = [[-152.0, -15.35], [-153.0, -15.4], [-154.2, -15.62], [-155.4, -15.855], [-156.6, -15.89], [-166.4, -15.89], [-167.6, -15.83],
    [-168.5, -15.66], [-169.4, -15.47], [-170.4, -15.2], [-171.1, -14.99], [-171.45, -14.915], [-171.6, -14.9]];
  const pts = densePath(ctrl.map(([z, y]) => V(F.tx, y, z)), 0.05);
  for (let i = 1; i <= 12; i++) { const ph = (i / 12) * (PI / 2); pts.push(V(F.tx, shy + F.sheaveR * Math.cos(ph), shz - F.sheaveR * Math.sin(ph))); }
  for (let y = shy - 0.1; y >= -28.0; y -= 0.25) pts.push(V(F.tx, y, F.hangZ));
  const path = new Path6(pts);
  const aOf = (pred: (p: THREE.Vector3) => boolean) => { for (let i = 0; i < pts.length; i++) if (pred(pts[i])) return path.acc[i]; return path.length; };
  const aCut = aOf((p) => p.z <= F.cutZ), aWater = aOf((p) => p.z <= F.hangZ + 0.01 && p.y <= F.water), aEnd = path.length;
  const cableMat = libOr6(L, 'cable_armour', 'rubber', { color: 0x2c2b27, roughness: 0.55, metalness: 0.2 });
  const tubeMesh = (name: string, maxPts: number) => {
    const t = new Tube6(maxPts, 10, F.tetherR);
    const m = new THREE.Mesh(t.geo, cableMat); m.name = name; m.castShadow = true; m.receiveShadow = true;
    m.userData.rooms = rooms.slice(); m.frustumCulled = false;
    L.root.add(m);
    return { t, m };
  };
  const TW = tubeMesh('frame6_tether_winch', Math.ceil(aCut / 0.05) + 8), TL = tubeMesh('frame6_tether_well', Math.ceil((aEnd - aCut) / 0.05) + 40);
  const sample = (a0: number, a1: number, off?: (a: number, p: THREE.Vector3) => void): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [], n = Math.max(2, Math.ceil((a1 - a0) / 0.05) + 1);
    for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / (n - 1)); const p = path.at(a, new THREE.Vector3()); off?.(a, p); out.push(p); }
    return out;
  };
  const winchSide = (w: number, amp: number, phase: number) => {
    const end = aCut - w;
    TW.t.set(sample(0, end, amp ? (a, p) => {
      const e = smooth(ramp(a, end - 3.5, end)), s = Math.sin((end - a) * 3.2 - phase);
      p.x += amp * e * s; p.y += 0.35 * amp * e * Math.abs(s);
    } : undefined));
  };
  const wellSide = (s: number) => {
    const a0 = aCut + s;
    if (a0 >= aWater + 0.6) { TL.m.visible = false; return; }
    TL.m.visible = true;
    TL.t.set(sample(a0, aEnd + s), a0);
  };

  // ── state
  let kPin = 0, kPump = 0, kGuard = 0, kLever = 0, fireT = -1, drumA = 0, winchW = 0, braked = false, sheaveA = 0;
  const st = { screenAuto: true };
  const setGauge = (text: string) => { if (st.screenAuto) try { L.ctx.materials.setScreen(gscr.material as THREE.MeshStandardMaterial, 'gauge', { text }); } catch { /* materials not ready */ } };
  let gaugeText = '핀 삽입됨';
  const gauge = (t: string) => { if (t !== gaugeText) { gaugeText = t; setGauge(t); } };
  const blade = (k: number) => R.pivot(1, 0, 0, 0, 0, 0, 0, 0, -0.42 * k, 0);
  const pin = (v: number) => {
    kPin = clamp01(v);
    const out = 0.33 * smooth(ramp(kPin, 0, 0.85)), drop = smooth(ramp(kPin, 0.85, 1));
    // drawn: slides +x; dropped: falls to lie on the deck east of the shear
    R.pivot(2, pnx, pny, pnz, 0, lerp(0, 0.6, drop), lerp(0, 0.05, drop), out + 0.18 * drop, lerp(0, Y + 0.04 - pny, drop * drop), 0.2 * drop);
    if (kPin >= 1 && gaugeText === '핀 삽입됨') gauge('0 BAR — 펌프');
  };
  const pump = (v: number) => {
    kPump = clamp01(v);
    const s = kPump * F.strokes, ph = s - Math.floor(s);
    const a = kPump >= 1 ? -0.45 : lerp(-0.45, 0.1, ph < 0.55 ? smooth(ph / 0.55) : 1 - smooth((ph - 0.55) / 0.45));
    R.pivot(3, PV.x, PV.y, PV.z, a, 0, 0);
    const bar = 210 * kPump;
    R.pivot(4, pxm, -15.45, pz1 - 0.03, 0, 0, (135 - (bar / 250) * 270) * PI / 180);
    if (kPin >= 1 && fireT < 0) gauge(kPump >= 1 ? '210 BAR — READY' : kPump <= 0 ? '0 BAR — 펌프' : `${Math.round(bar)} BAR`);
  };
  const guard = (v: number) => { kGuard = clamp01(v); const u = kGuard; R.pivot(6, GH.x, GH.y, GH.z, -1.9 * smooth(u) - 0.12 * Math.sin(PI * ramp(u, 0.7, 1.0)), 0, 0); };
  const lever = (v: number) => { kLever = clamp01(v); R.pivot(5, LV.x, LV.y, LV.z, 1.0 * minJerk(kLever), 0, 0); };
  const drum = () => { R.pivot(8, dx, dy, dz, -drumA, 0, 0); };
  const brakeK = (k: number) => R.pivot(9, -50.45, dy, dz, -0.18 * k, 0, 0);
  const sheave = () => R.pivot(7, shx, shy, shz, sheaveA, 0, 0);
  const w = (t: number) => (t <= 0 ? 0 : F.whip * (1 - Math.exp(-9 * t) * (Math.cos(11 * t) + 0.82 * Math.sin(11 * t))));
  const poseFire = (t: number) => {
    lever(Math.max(kLever, ramp(t, 0, 0.05)));
    blade(t < 0.05 ? 0 : smooth(ramp(t, 0.05, 0.11)) - 0.03 * Math.sin(PI * ramp(t, 0.11, 0.2)));
    const tau = t - 0.25;
    if (tau < 0) { winchSide(0, 0, 0); wellSide(0); return; }
    const amp = 0.32 * Math.exp(-3.2 * tau) * Math.min(1, tau * 12);
    winchSide(w(tau), amp, tau * 22);
    wellSide(0.5 * 26 * tau * tau);
  };
  // drum: winds the whip in, spins free, brakes at 1.4 s over 0.35 s; the sheave turns with the falling end
  const drumAt = (t: number) => {
    const tau = Math.max(0, t - 0.25);
    const free = (tt: number) => 3.2 * (1 - Math.exp(-tt * 1.6)) / 1.6;
    const tb = 1.4 - 0.25, base = w(tau) / F.drumR;
    if (tau <= tb) return base + free(tau);
    const v0 = 3.2 * Math.exp(-tb * 1.6), u = Math.min(tau - tb, 0.35);
    return base + free(tb) + v0 * u - (v0 / (2 * 0.35)) * u * u;
  };
  const fired = () => {
    fireT = 9;
    lever(1); guard(1); blade(1);
    winchSide(F.whip, 0, 0); TL.m.visible = false;
    drumA = drumAt(9); drum(); braked = true; winchW = 0; brakeK(1);
    if (st.screenAuto) gauge('발사됨');
  };
  const fire = (cue?: Cue6) => {
    if (fireT >= 0) return;
    fireT = 0;
    const shear = V(sxm, -15.6, szm), drum0 = drumA, sheave0 = sheaveA;
    const fired_: Record<string, boolean> = {};
    const once = (n: string, at: THREE.Vector3) => { if (!fired_[n]) { fired_[n] = true; cue?.(n, at); } };
    once('fire', LV.clone());
    L.tween(0, 2.0, (k) => {
      if (fireT < 0 || fireT > 5) return;
      const t = k * 2.0; fireT = t;
      poseFire(t);
      drumA = drum0 + drumAt(t); drum();
      const s = Math.max(0, t - 0.25); sheaveA = sheave0 + Math.min(0.5 * 26 * s * s, aWater + 0.6 - aCut) / 0.3; sheave();
      if (t >= 0.05) { once('slam', shear); if (st.screenAuto) gauge('발사됨'); }
      if (t >= 0.25 && !fired_.part) {
        once('part', shear);
        try { L.ctx.fx?.sparks?.(shear.clone().add(V(0, 0.05, 0.08)), V(0, 0.3, 1).normalize(), 28, 5); } catch { /* fx not ready */ }
      }
      if (t >= 0.25 && aCut + 0.5 * 26 * s * s >= aWater) once('splash', V(F.tx, F.water, F.hangZ));
      if (t >= 1.4) { once('brake', V(-50.45, dy, dz)); braked = true; brakeK(ramp(t, 1.4, 1.5)); }
    }, () => { if (fireT >= 0 && fireT <= 5) fired(); });
  };
  L.updaters.push((dt) => { if (winchW && !braked && fireT < 0) { drumA += winchW * dt; drum(); } });
  pin(0); pump(0); guard(0); lever(0); blade(0); drum(); brakeK(0); sheave(); winchSide(0, 0, 0); wellSide(0);

  const root = new THREE.Object3D(); root.name = 'frame6'; root.position.set((F.x0 + F.x1) / 2, Y, (F.z0 + F.z1) / 2);
  const ud = root.userData;
  Object.assign(ud, {
    pin, pump, guard, lever, fire, fired, gauge,
    winch: (v: number) => { winchW = v; if (v) { braked = false; brakeK(0); } },
    brake: () => { braked = true; winchW = 0; brakeK(1); },
    lamp: (k: number) => R.emit(PAL.lensA, 0xfff0d8, 5.0 * clamp01(k)),
    state: () => ({ pin: kPin, pump: kPump, guard: kGuard, lever: kLever, fired: fireT >= 0, fireT, drum: drumA, braked }),
    pumpGrip: () => { const s = kPump * F.strokes, ph = s - Math.floor(s); const a = lerp(-0.45, 0.1, ph < 0.55 ? smooth(ph / 0.55) : 1 - smooth((ph - 0.55) / 0.45)); return V(PV.x, PV.y - Math.sin(a) * 0.71, PV.z + Math.cos(a) * 0.71); },
    leverGrip: () => { const a = minJerk(kLever); return V(LV.x, LV.y + Math.cos(a) * 0.3, LV.z + 0.01 + Math.sin(a) * 0.3); },
    pinPoint: V(pnx + 0.065, pny, pnz), shearPoint: V(sxm, -15.6, szm), sheavePoint: V(shx, shy, shz), wellPoint: V(F.tx, F.water, F.hangZ),
    winchPoint: V(dx, dy, dz), lampPoint: V(lpx, lpy - 0.05, lpz), lampTarget: V(sxm, -15.3, szm),
  });
  Object.defineProperty(ud, 'screenAuto', { get: () => st.screenAuto, set: (v: boolean) => { st.screenAuto = v; }, enumerable: true });
  L.root.add(root); L.objects.set('frame6', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ 5. WELL FURNITURE (ladders, gates, inner lock door, sluice ports)

/** §2.6.9: the well x −58 … −46, z −182 … −170; coaming 0.4 m (top y −19.2); guard to −17.6; lock door at y −34. */
export const WELL6 = { x0: -58, x1: -46, z0: -182, z1: -170, coaming: 0.4, top: -19.2, guardTop: -17.6, water: -20.3, lock: -34, ladderZ: -176 } as const;

/**
 * The well's furniture `well6` (§2.6.9, D12, B1, §8.7.5). Two ladders on the well's inner walls (west x −57.82, east
 * x −46.18, at z −176; rails ⌀ 40 mm 0.44 m apart, rungs every 0.3 m, from the lock door y −34 to 0.7 m over the
 * coaming top, stand-offs to the wall), each with a **self-closing ladder gate** in the bar guard (0.9 m, the guard's
 * full height y −19.2 … −17.6, bars flush with the coaming's outer face, hinged at its south end, swinging only toward
 * the well — the player never opens it: its gap is a move-only box in the registry), gate posts, and three **exit
 * rungs** down the coaming's outer face (visual only, no collider — B1). The inner door of the cargo lock at y −34 (a
 * floor plate over the 12 × 12 well, an iris ⌀ 8.4 with pinwheel blade seams, the ring of eight amber lamps — rig
 * emission, `lamps(k)` — and the tether's pressure gland at (−52, −34, −171.9)): geometry for the probe; the fx draws
 * the look under water. Three sluice ports in the coaming's south face below the water (x −56, −52, −48; y −21.2 …
 * −20.8). Calls: one rig (both gates + the lamp lenses) + the zone. Objects: `ladder6_w`, `ladder6_e` with `userData =
 * { foot, top, exit, gate: { open(k), settle(seconds?, onLatch?), k, hinge } }` (foot = the climber's body line on the
 * ladder at y −34; top = his feet on the coaming top; exit = `mk6_lw_exit` / `mk6_le_exit`), and `well6` with
 * `lamps(k)`, `gland`.
 */
export function well6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const W = WELL6, rooms = o.rooms ?? b.rooms.slice(), steel: Mat = 'steel_raw', dark: Mat = 'painted_dark';
  const yellow: Mat = libOr6(L, 'crane_yellow', 'painted_yellow');
  const R = new Rig6(L, 'well6');
  R.emit(PAL.lensB, 0xffa028, 4.0);
  const zc = W.ladderZ, xc = (W.x0 + W.x1) / 2, zm = (W.z0 + W.z1) / 2;
  const gates: { open(k: number): void; settle(s?: number, cb?: () => void): void; k: number; hinge: THREE.Vector3 }[] = [];
  for (const side of [-1, 1] as const) {
    // side −1 = west (wall x −58, well toward +x), +1 = east (wall x −46, well toward −x)
    const wall = side < 0 ? W.x0 : W.x1, inward = -side, rx = wall + inward * 0.18, outer = wall + side * W.coaming;
    // ladder
    for (const dz of [-0.22, 0.22]) {
      b.cyl(steel, rx, (W.lock + W.top + 0.7) / 2, zc + dz, 0.02, W.top + 0.7 - W.lock, 'y', 8);
      for (let y = W.lock + 1.0; y < W.top; y += 2.0) b.bx(steel, Math.min(wall, rx) + 0.0, y - 0.03, zc + dz - 0.02, Math.max(wall, rx), y + 0.03, zc + dz + 0.02);
    }
    for (let y = W.lock + 0.3; y < W.top + 0.05; y += 0.3) b.cyl(steel, rx, y, zc, 0.016, 0.44, 'z', 8);
    // exit rungs on the coaming's outer face (visual only)
    for (const y of [W.top - 0.22, W.top - 0.42, W.top - 0.62]) {
      for (const dz of [-0.18, 0.18]) b.rod(steel, outer, y, zc + dz, outer + side * 0.15, y, zc + dz, 0.014, 6);
      b.cyl(steel, outer + side * 0.15, y, zc, 0.014, 0.36, 'z', 6);
    }
    // gate posts (the guard's ends at the gap)
    const gx = outer - side * 0.0125;
    for (const z of [zc - 0.48, zc + 0.48]) b.bx(yellow, gx - 0.025, W.top, z - 0.025, gx + 0.025, W.guardTop + 0.02, z + 0.025);
    moveOnly(L, gx - 0.0125, W.top, zc - 0.45, gx + 0.0125, W.guardTop, zc + 0.45);
    // the gate (bone 1 west, 2 east): authored closed, hinged at its south end (z −176.45)
    const bone = side < 0 ? 1 : 2, hz = zc - 0.45;
    for (let i = 0; i < 7; i++) R.cyl(PAL.galv, bone, gx, (W.top + W.guardTop) / 2, hz + 0.1125 + i * 0.1125, 0.0125, 1.5, 'y', 6);
    for (const y of [W.top + 0.03, W.guardTop - 0.03]) R.box(PAL.yellow, bone, gx, y, zc, 0.03, 0.05, 0.88);
    R.box(PAL.yellow, bone, gx, (W.top + W.guardTop) / 2, hz + 0.02, 0.03, 1.6, 0.035);
    R.box(PAL.yellow, bone, gx, (W.top + W.guardTop) / 2, zc + 0.43, 0.03, 1.6, 0.035);
    for (const y of [W.top + 0.25, W.guardTop - 0.25]) R.cyl(PAL.steel, bone, gx, y, hz - 0.01, 0.022, 0.12, 'y', 10);
    R.rod(PAL.steel, bone, gx + inward * 0.03, W.guardTop - 0.15, hz + 0.05, gx + inward * 0.03, W.guardTop - 0.5, hz + 0.35, 0.012, 6);
    R.box(PAL.red, bone, gx + side * 0.02, W.guardTop - 0.4, zc + 0.36, 0.006, 0.1, 0.06);
    const hinge = V(gx, W.top, hz);
    let k = 0, settling = 0;
    const open = (v: number) => { k = clamp01(v); R.pivot(bone, hinge.x, hinge.y, hinge.z, 0, inward * (PI / 2) * k, 0); };
    const settle = (s = 0.9, cb?: () => void) => {
      const k0 = k, id = ++settling;
      L.tween(0, s, (u) => {
        if (id !== settling) return;
        const a = u < 0.85 ? k0 * (1 - (u / 0.85) * (u / 0.85)) : 0.035 * Math.sin(PI * (u - 0.85) / 0.15);
        open(Math.max(0, a));
      }, () => { if (id === settling) { open(0); cb?.(); } });
    };
    open(0);
    gates.push({ open: (v) => { settling++; open(v); }, settle, get k() { return k; }, hinge });
    const lad = new THREE.Object3D(); lad.name = side < 0 ? 'ladder6_w' : 'ladder6_e';
    lad.position.set(rx, W.lock, zc);
    lad.userData.foot = V(rx + inward * 0.35, W.lock, zc);
    lad.userData.top = V(wall + side * 0.2, W.top, zc);
    lad.userData.exit = V(outer + side * 0.9, -20, zc);
    lad.userData.gate = gates[gates.length - 1];
    L.root.add(lad); L.objects.set(lad.name, lad);
  }
  // the inner lock door at y −34
  b.bx(dark, W.x0, W.lock - 0.25, W.z0, W.x1, W.lock - 0.02, W.z1);   // (top 2 cm under the well's floor plane at −34: no z-fight)
  // (IA-6: the door's furniture stands 2 cm proud of the well floor's plane at −34 — its bottoms sat ON it: z-fight)
  b.cyl(navyOr(L), xc, W.lock + 0.05, zm, 4.2, 0.06, 'y', 48);
  b.torus(steel, xc, W.lock + 0.07, zm, 4.3, 0.12, 'y', 48);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    b.push(xc, W.lock + 0.084, zm, a).box(dark, 0.55, 0, 2.05, 0.03, 0.006, 4.0).pop();
  }
  b.cyl(steel, xc, W.lock + 0.10, zm, 0.45, 0.04, 'y', 24);
  b.cyl(steel, W.x0 + 6, W.lock + 0.195, -171.9, 0.28, 0.35, 'y', 18).cyl(steel, W.x0 + 6, W.lock + 0.04, -171.9, 0.42, 0.04, 'y', 18);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + PI / 8, x = xc + Math.sin(a) * 4.75, z = zm + Math.cos(a) * 4.75;
    b.cyl(steel, x, W.lock + 0.04, z, 0.13, 0.04, 'y', 14);
    R.cyl(PAL.lensB, 0, x, W.lock + 0.09, z, 0.09, 0.06, 'y', 14);
  }
  // sluice ports in the coaming's south (outer) face, under the water
  const zf = W.z0 - W.coaming;
  for (const x of [-56, -52, -48]) {
    b.bx(dark, x - 0.3, -21.2, zf - 0.004, x + 0.3, -20.8, zf);
    b.bx(steel, x - 0.34, -21.24, zf - 0.02, x + 0.34, -21.2, zf).bx(steel, x - 0.34, -20.8, zf - 0.02, x + 0.34, -20.76, zf);
    for (let i = 0; i < 6; i++) b.cyl(steel, x - 0.25 + i * 0.1, -21.0, zf - 0.015, 0.01, 0.4, 'y', 6);
  }
  R.build(rooms, 1.2);
  const lamps = (k: number) => R.emit(PAL.lensB, 0xffa028, 4.0 * clamp01(k));
  const root = new THREE.Object3D(); root.name = 'well6'; root.position.set(xc, W.lock, zm);
  root.userData.lamps = lamps;
  root.userData.gland = V(W.x0 + 6, W.lock, -171.9);
  L.root.add(root); L.objects.set('well6', root);
  return root;
}
function navyOr(L: LevelBuild): Mat { return libOr6(L, 'navy_grey', 'wall_panel_dark'); }

// ═════════════════════════════════════════════════════════════ 6. DOCK CONSOLE (mid deck)

export const CONSOLE6 = { x0: -46.0, x1: -42.0, z0: -158.6, z1: -157.8, y: -16, h: 1.0, screen: [-44.0, -14.2, -157.9], w: 3.2, sh: 1.4 } as const;
/** Idle page: the dock board's lines (§6.4). */
export const CONSOLE6_IDLE = 'HEAD-END REPEATER — DOCK\nMOON POOL — DOCK — 2,140 M\nCARGO LOCK: INNER DOOR CLOSED\nDEWATERING: 34 % — STOPPED\nTETHER: TAUT — BUOY: STANDBY';
export type ConsolePage6 = 'idle' | 'manifest' | 'feed' | 'cctv' | 'static' | 'choir' | 'black';

/**
 * The dock console `console6` (§2.6.9, §4.9, §8.7.6, S1h): a navy desk x −46 … −42, z −158.6 … −157.8 (top y −15.0)
 * with keyboard, trackball, lamp buttons; a 3.2 × 1.4 m screen on a stand above the desk's north edge (screen plane
 * z −157.9 facing −z, centre `mk6_end_screen` (−44.0, −14.2, −157.9)), labelled `헤드엔드 중계기 — 도크`, behind a
 * pane of bullet-resistant glass (a `glass` collider: rounds star it, it holds). `page(id, o?)`: `idle` (the dock board's
 * lines, or `o.text`), `manifest` (`o.text` = the E1 scroll, `\n` lines), `feed` (`o.texture` = the feed handle's
 * texture, `o.text` = the OSD; no texture → `cctv`), `cctv`, `static`, `choir`, `black` (the screen off). Calls: the
 * screen + the glass (transparent) + the zone. Colliders: desk (nav), screen housing + glass (`glass`, no nav).
 * `userData`: `page`, `pageId`, `screenMat`, `screenMesh`, `screenPoint`, `screenNormal`.
 */
export function console6(L: LevelBuild, b: Builder, o: PieceOpts & { glass?: boolean } = {}): THREE.Object3D {
  const C = CONSOLE6, rooms = o.rooms ?? b.rooms.slice(), Y = C.y;
  const navy = navyOr(L), dark: Mat = 'painted_dark';
  const [scx, scy, scz] = C.screen;
  // desk
  b.bx(navy, C.x0 + 0.02, Y, C.z0 + 0.06, C.x1 - 0.02, Y + 0.95, C.z1);
  b.bx(dark, C.x0 + 0.06, Y, C.z0 + 0.03, C.x1 - 0.06, Y + 0.1, C.z0 + 0.045);
  b.bx('plastic_dark', C.x0, Y + 0.95, C.z0 - 0.03, C.x1, Y + C.h, C.z1 + 0.02);
  const top = Y + C.h;
  b.bx('plastic_dark', scx - 0.24, top, -158.42, scx + 0.24, top + 0.025, -158.26);
  for (let i = 0; i < 12; i++) b.bx('steel_raw', scx - 0.22 + i * 0.04, top + 0.025, -158.4, scx - 0.195 + i * 0.04, top + 0.032, -158.28);
  b.sphere('plastic_dark', scx + 0.45, top + 0.02, -158.34, 0.04, 12);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) b.bx(i % 3 === 0 ? 'emissive_amber' : i % 3 === 1 ? 'emissive_green' : 'plastic_white', C.x0 + 0.3 + i * 0.09, top, -158.45 + r * 0.1, C.x0 + 0.36 + i * 0.09, top + 0.012, -158.41 + r * 0.1);
  b.bx('plastic_dark', C.x1 - 0.55, top, -158.48, C.x1 - 0.25, top + 0.05, -158.28);
  b.sign('DL-2 도크 관제', 'label', scx, Y + 0.8, C.z0 + 0.055, 0.6, 0.08, '-z');
  // screen housing, bezel lip, stand posts
  const hx0 = scx - C.w / 2 - 0.12, hx1 = scx + C.w / 2 + 0.12, hy0 = scy - C.sh / 2 - 0.08, hy1 = scy + C.sh / 2 + 0.12;
  b.bx(dark, hx0, hy0, scz + 0.007, hx1, hy1, scz + 0.18);
  b.bx(dark, hx0, hy0, scz - 0.016, hx0 + 0.07, hy1, scz + 0.007).bx(dark, hx1 - 0.07, hy0, scz - 0.016, hx1, hy1, scz + 0.007);
  b.bx(dark, hx0 + 0.07, hy0, scz - 0.016, hx1 - 0.07, hy0 + 0.05, scz + 0.007).bx(dark, hx0 + 0.07, hy1 - 0.09, scz - 0.016, hx1 - 0.07, hy1, scz + 0.007);
  b.sign('헤드엔드 중계기 — 도크', 'stencil', scx, hy1 - 0.045, scz - 0.016, 1.6, 0.07, '-z');
  for (const x of [scx - 1.25, scx + 1.25]) b.bx('steel_raw', x - 0.05, Y, scz + 0.18, x + 0.05, hy0 + 0.3, scz + 0.24);
  const scr = L.screen('console6', 'manifest', C.w, C.sh, scx, scy, scz, '-z', { text: CONSOLE6_IDLE });
  scr.userData.rooms = rooms.slice();
  if (o.glass !== false) {
    // not a library clone: no probe reflection (the dock's yellow frame mirrored over the E2 feed), only the lights' glints
    const gm = mat6(L, 'sp6_console_glass', () => new THREE.MeshStandardMaterial({ name: 'console6_glass', color: 0x0c1012, transparent: true, opacity: 0.1, roughness: 0.12, metalness: 0, depthWrite: false }));
    const g = new THREE.Mesh(new THREE.PlaneGeometry(C.w + 0.06, C.sh + 0.06), gm);
    g.position.set(scx, scy, scz - 0.011); g.rotation.y = PI; g.name = 'console6:glass'; g.userData.rooms = rooms.slice(); g.renderOrder = 2;
    L.root.add(g);
  }
  if (o.collide !== false) {
    b.collide(C.x0, Y, C.z0 - 0.03, C.x1, top, C.z1 + 0.02, 'metal', true);
    b.collide(hx0, hy0, scz - 0.016, hx1, hy1, scz + 0.18, 'glass', false);
  }
  const mat = scr.material as THREE.MeshStandardMaterial;
  let pageId: string = 'idle';
  const page = (id: ConsolePage6 | string, po: { text?: string; texture?: THREE.Texture } = {}) => {
    pageId = id;
    scr.visible = id !== 'black';
    if (id === 'black') return;
    const M = L.ctx.materials;
    try {
      if (id === 'idle') M.setScreen(mat, 'manifest', { text: po.text ?? CONSOLE6_IDLE });
      else if (id === 'feed') { if (po.texture) M.setScreen(mat, 'feed', { texture: po.texture, text: po.text }); else M.setScreen(mat, 'cctv', { text: po.text }); }
      else M.setScreen(mat, id as never, { text: po.text });
    } catch (e) { console.warn('[console6] page failed', id, e); }
  };
  const root = new THREE.Object3D(); root.name = 'console6'; root.position.set(scx, Y, (C.z0 + C.z1) / 2);
  Object.assign(root.userData, { page, screenMat: mat, screenMesh: scr, screenPoint: V(scx, scy, scz), screenNormal: V(0, 0, -1) });
  Object.defineProperty(root.userData, 'pageId', { get: () => pageId, enumerable: true });
  L.root.add(root); L.objects.set('console6', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ 7. PHONE STATION (he6 east wall)

export const PHONE6 = { x: 21.78, y: 1.4, z: -164.0, anchor: [21.62, 1.12, -164.2], rest: 0.3 } as const;
/**
 * The sound-powered phone `phone6` (§2.6.6, §4.5, §8.7.7): a navy phone box on the east wall (face x 21.6, facing −x)
 * with the selector dial `HEAD-END / POST 4 / DOCK / CMD` (set to POST 4), the howler (a horn above it), a label, the
 * empty hook — and the handset OFF the hook, hanging on its coiled cord below the box (≈ (21.62, 0.8, −164.2)). The cord
 * is a 12-node chain (anchor fixed, the handset on the end), drawn as a coiled tube; it contracts to 0.3 m when free
 * and stretches to whatever the handset is held at. `lift(to?, seconds = 0.35)`: the handset rises to `to` (default
 * (21.25, 1.5, −164.05), in front of the box) and is held there; `hold(p, q?)`: the held handset follows `p` (the
 * story: the player's ear) and, with `q`, turns; `drop()`: let go — it falls on the cord, bounces and swings to rest.
 * Calls: handset + cord (2) + the zone. No collider. `userData`: `lift`, `hold`, `drop`, `state`, `handset` (world
 * point now), `anchor`.
 */
export function phone6(L: LevelBuild, b: Builder, o: PieceOpts = {}): THREE.Object3D {
  const P6 = PHONE6, rooms = o.rooms ?? b.rooms.slice(), F = 21.6, Z = P6.z;
  const navy = navyOr(L), dark: Mat = 'painted_dark', steel: Mat = 'steel_raw';
  b.bx(navy, F, 1.12, Z - 0.2, 21.79, 1.66, Z + 0.2);
  b.bx(navy, F - 0.012, 1.14, Z - 0.18, F, 1.64, Z - 0.17).bx(navy, F - 0.012, 1.14, Z + 0.17, F, 1.64, Z + 0.18);
  b.cyl('painted_white', F - 0.004, 1.44, Z + 0.04, 0.07, 0.008, 'x', 24);
  b.cyl(steel, F - 0.02, 1.44, Z + 0.04, 0.022, 0.03, 'x', 12);
  b.push(F - 0.036, 1.44, Z + 0.04, 0, 0.35).box(dark, 0, 0.03, 0, 0.008, 0.06, 0.012).pop();
  const labels: [string, number][] = [['헤드엔드', -0.95], ['초소 4', -0.32], ['DOCK', 0.32], ['CMD', 0.95]];
  for (const [t, a] of labels) b.sign(t, 'label', F - 0.009, 1.44 + Math.cos(a) * 0.1, Z + 0.04 + Math.sin(a) * 0.1, 0.075, 0.022, '-x');
  b.sign('무전원 전화 — JX 회선', 'label', F - 0.002, 1.6, Z, 0.34, 0.04, '-x');
  b.sign('수화기를 들고 — 버튼을 눌러 통화', 'stencil', F - 0.002, 1.24, Z + 0.04, 0.3, 0.04, '-x');
  // howler: wall base + horn (mouth −x) + dark throat
  b.bx(navy, 21.68, 1.74, Z - 0.08, 21.79, 1.9, Z + 0.08);
  b.cyl(navy, 21.6, 1.82, Z, 0.11, 0.16, 'x', 20, 0.04);
  b.cyl(dark, 21.528, 1.82, Z, 0.095, 0.004, 'x', 20);
  // the empty hook on the box's south side + the cord gland under the box
  b.rod(steel, 21.66, 1.3, Z - 0.2, 21.66, 1.3, Z - 0.25, 0.008, 6).rod(steel, 21.66, 1.3, Z - 0.25, 21.66, 1.36, Z - 0.26, 0.008, 6);
  const [ax, ay, az] = P6.anchor;
  b.cyl('rubber', ax, ay - 0.0, az, 0.014, 0.03, 'y', 10);

  const R = new Rig6(L, 'phone6');
  // the handset, authored with its cord end at the origin, hanging along −y, the cups facing −x
  const hp = R.part('handset');
  R.cyl(PAL.rubber, 0, 0, -0.012, 0, 0.012, 0.025, 'y', 10, hp);
  R.box(PAL.black, 0, 0, -0.11, 0, 0.032, 0.17, 0.028, 0, 0, 0, hp);
  R.box(PAL.navy, 0, 0, -0.11, 0.016, 0.026, 0.07, 0.006, 0, 0, 0, hp);
  for (const y of [-0.03, -0.205]) { R.cyl(PAL.black, 0, -0.025, y, 0, 0.034, 0.03, 'x', 16, hp); R.cyl(PAL.dark, 0, -0.041, y, 0, 0.026, 0.003, 'x', 16, hp); }
  const hs = moverPart(L, R, hp, 'phone6_handset', rooms, false);
  const cord = new Tube6(360, 4, 0.0045, 'pal', [PAL.black + 0.5, 0.5]);
  const cordMesh = new THREE.Mesh(cord.geo, R.mat); cordMesh.name = 'phone6_cord'; cordMesh.userData.rooms = rooms.slice(); cordMesh.frustumCulled = false; cordMesh.castShadow = false;
  L.root.add(cordMesh);
  R.build(rooms, 0.2);

  // ── chain sim
  const N = 12, A = V(ax, ay - 0.015, az);
  const X: THREE.Vector3[] = [], Xp: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) { const p = A.clone().add(V(0, -(P6.rest * i) / (N - 1), 0)); X.push(p); Xp.push(p.clone()); }
  let Lc: number = P6.rest, mode: 'free' | 'held' | 'lift' = 'free', calm = 0, active = true;
  const target = V(0, 0, 0), held = new THREE.Quaternion(), liftFrom = V(0, 0, 0);
  let liftT = 0, liftDur = 0.35, hasQ = false;
  const qRest = new THREE.Quaternion();
  const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _u = new THREE.Vector3();
  const helix: THREE.Vector3[] = [];
  for (let i = 0; i < 360; i++) helix.push(new THREE.Vector3());
  const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _B = new THREE.Vector3(), _c = new THREE.Vector3();
  const draw = () => {
    // handset pose: along the last segment (hanging) or as held
    const end = X[N - 1];
    hs.mount.position.copy(end);
    if (mode === 'free') {
      _d.subVectors(X[N - 1], X[N - 2]).normalize();
      _q.setFromUnitVectors(_u.set(0, -1, 0), _d);
      hs.mount.quaternion.copy(_q).multiply(qRest);
    } else hs.mount.quaternion.copy(hasQ ? held : _q.setFromUnitVectors(_u.set(0, -1, 0), _d.subVectors(X[N - 1], X[N - 2]).normalize()));
    hs.mount.updateMatrixWorld(true);
    // coiled cord along the chain (Catmull-Rom through the nodes, a helix round it)
    const curve = new THREE.CatmullRomCurve3(X, false, 'centripetal');
    const M = 340, coils = 34, rc = 0.008 * Math.min(1, Math.max(0.3, P6.rest / Math.max(Lc, 1e-3)));
    _N.set(1, 0, 0);
    for (let i = 0; i < M; i++) {
      const u = i / (M - 1);
      curve.getPointAt(u, _c);
      curve.getTangentAt(u, _T);
      _B.crossVectors(_T, _N); if (_B.lengthSq() < 1e-8) _B.crossVectors(_T, _u.set(0, 0, 1));
      _B.normalize(); _N.crossVectors(_B, _T).normalize();
      const ph = u * coils * TAU, taper = Math.min(1, u * 20, (1 - u) * 20);
      helix[i].copy(_c).addScaledVector(_N, Math.cos(ph) * rc * taper).addScaledVector(_B, Math.sin(ph) * rc * taper);
    }
    cord.set(helix.slice(0, M));
  };
  const step = (dt: number) => {
    const h = Math.min(dt, 1 / 30), g = 9.8;
    if (mode === 'lift') {
      liftT += h;
      const k = minJerk(liftT / liftDur);
      X[N - 1].lerpVectors(liftFrom, liftTo, k);
      if (liftT >= liftDur) mode = 'held';
    } else if (mode === 'held') X[N - 1].copy(target);
    const want = mode === 'free' ? P6.rest : Math.max(P6.rest, A.distanceTo(X[N - 1]) * 1.03);
    Lc = mode === 'free' ? Math.max(want, Lc - 0.9 * h) : want;
    const seg = Lc / (N - 1);
    for (let i = 1; i < N; i++) {
      if (i === N - 1 && mode !== 'free') { Xp[i].copy(X[i]); continue; }
      const p = X[i], v = _d.subVectors(p, Xp[i]).multiplyScalar(0.985);
      Xp[i].copy(p);
      p.add(v).add(_u.set(0, -g * h * h * (i === N - 1 ? 1 : 0.6), 0));
    }
    X[0].copy(A);
    for (let it = 0; it < 10; it++) {
      for (let i = 0; i < N - 1; i++) {
        const a = X[i], c = X[i + 1];
        _d.subVectors(c, a); const l = _d.length() || 1e-6, diff = (l - seg) / l;
        // the anchor is fixed; the handset is 6× the weight of a cord node; a held end is fixed
        const wa = i === 0 ? 0 : 1, wc = i + 1 === N - 1 ? (mode === 'free' ? 1 / 6 : 0) : 1, ws = wa + wc;
        if (ws <= 0) continue;
        a.addScaledVector(_d, (wa / ws) * diff); c.addScaledVector(_d, -(wc / ws) * diff);
      }
      // the wall (x 21.79) and the floor (y 0.02): keep the cord off them
      for (let i = 1; i < N; i++) { if (X[i].x > 21.76) X[i].x = 21.76; if (X[i].y < 0.03) X[i].y = 0.03; }
    }
    let mv = 0;
    for (let i = 1; i < N; i++) mv = Math.max(mv, X[i].distanceToSquared(Xp[i]));
    calm = mode === 'free' && mv < 1e-9 ? calm + h : 0;
  };
  const liftTo = V(21.25, 1.5, -164.05);
  L.updaters.push((dt) => {
    if (!active && mode === 'free') return;
    step(dt); draw();
    if (calm > 1.0) active = false;
  });
  // settle the rest pose once (hang straight, then a little sway)
  for (let i = 0; i < 240; i++) step(1 / 60);
  X[N - 1].x -= 0.03; draw();
  const root = new THREE.Object3D(); root.name = 'phone6'; root.position.set(P6.x, P6.y, P6.z);
  Object.assign(root.userData, {
    lift: (to?: THREE.Vector3, s = 0.35) => { liftFrom.copy(X[N - 1]); liftTo.copy(to ?? V(21.25, 1.5, -164.05)); target.copy(liftTo); liftT = 0; liftDur = Math.max(0.05, s); mode = 'lift'; active = true; calm = 0; },
    hold: (p: THREE.Vector3, q?: THREE.Quaternion) => { target.copy(p); if (mode === 'lift') liftTo.copy(p); else mode = 'held'; hasQ = !!q; if (q) held.copy(q); active = true; calm = 0; },
    drop: () => { mode = 'free'; hasQ = false; active = true; calm = 0; },
    state: () => mode,
    anchor: A.clone(),
  });
  Object.defineProperty(root.userData, 'handset', { get: () => X[N - 1].clone(), enumerable: true });
  L.root.add(root); L.objects.set('phone6', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ 8. THE FEED SET (Post 4 — sub bay, CAM 2; sealed room feed6)

/** §8.7.8: room feed6 x 100 … 124, z 0 … 24, h 12 = 3c's sub bay (x + 78, z + 56): south end, the lock at z 0. */
export const FEED6 = {
  x0: 100, x1: 124, z0: 0, z1: 24, h: 12, cam: [112, 7.2, 21.5], target: [112, 1.0, 8.0], fov: 52,
  lock: [112, 3.0, 0.2], lockR: 2.5, exposure: 1.8, gallery: 4.8, rails: [110.8, 113.2], saddles: [13.5, 17.5, 21.5],
} as const;

/**
 * The feed set `feed6` (§8.7.8, §8.9, D16, §2.7.1): 3c's sub-bay south end rebuilt cheaply in the sealed room `feed6`
 * — hull-white walls with ribs, the deck, both side galleries (y 4.8) with rails, the bridge (z 20 … 22), the **empty
 * cradle** (two rails, three saddles shaped for the 3 m hull with rubber pads, the hydraulic clamps standing open), wet
 * patches on the deck and a run of water from the lock, two equipment boxes, the shore-power cable, the 5 m
 * **launch-lock door** shut (frame ring, dogs, its port black), the red `FLOODED` lamp above it and its signs, two
 * rotating amber beacons on the south wall, the board `feed6_board` (`dock_status`: `TERN — CRADLE — EMPTY` / `LAUNCH
 * LOCK — FLOODED`). Lights (group `feed6`, pinned only by the feed pass): 2 amber points at the beacons (`alarm`
 * flicker) + 1 red point over the lock. The camera marker `mk6_feed_cam` (112, 7.2, 21.5), `userData.target`
 * (112, 1.0, 8.0), if the level has not placed one. Builds its own zone `feed6_set` (rooms ['feed6']). Calls ≤ 20 (the
 * zone's library materials + one rig (beacons, lamp) + the board). `userData`: `beacons(on)`, `lamp(on)`, `cam`,
 * `target`, `fov`, `lights`.
 */
export function feed6(L: LevelBuild, o: { rooms?: string[]; lights?: boolean } = {}): THREE.Object3D {
  const S = FEED6, rooms = o.rooms ?? ['feed6'];
  const b = L.builder('feed6_set'); b.rooms = rooms.slice();
  const hull = libOr6(L, 'hull_white', 'wall_medical', { color: 0xcfcbc0, roughness: 0.55 });
  const deck = libOr6(L, 'deck_nonslip', 'floor_plate'), grate = libOr6(L, 'deck_grate', 'floor_grate'), navy = navyOr(L);
  const steel: Mat = 'steel_raw', dark: Mat = 'painted_dark', yellow: Mat = 'painted_yellow';
  const { x0, x1, z0, z1, h } = S, G = S.gallery;
  // shell
  b.bx(deck, x0, -0.2, z0, x1, 0, z1);
  b.bx(hull, x0 - 0.2, 0, z0 - 0.2, x0 + 0.2, h, z1 + 0.2).bx(hull, x1 - 0.2, 0, z0 - 0.2, x1 + 0.2, h, z1 + 0.2);
  b.bx(hull, x0 + 0.2, 0, z0 - 0.2, x1 - 0.2, h, z0 + 0.2).bx(hull, x0 + 0.2, 0, z1 - 0.2, x1 - 0.2, h, z1 + 0.2);
  b.bx('ceiling_panel', x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.3, z1 + 0.2);
  for (let z = 2; z <= 22; z += 3) for (const x of [x0 + 0.26, x1 - 0.26]) b.box(navy, x, h / 2, z, 0.12, h, 0.3);
  // galleries + bridge (grating decks, steel stringers, rails)
  // each deck runs 0.05 into the hull (W4a's grey wall face is 0.1 in; or 0.1 under the neighbouring gallery) so no end face is coplanar with a wall or a deck's side
  const gal = (ax: number, bx: number, az: number, bz: number, dy = 0) => { b.bx(grate, ax, G - 0.05 + dy, az, bx, G + dy, bz); b.bx(steel, ax, G - 0.22 + dy, az, bx, G - 0.18 + dy, bz); };
  gal(x0 + 0.15, x0 + 3.0, z0 + 0.15, z1 - 0.15); gal(x1 - 3.0, x1 - 0.15, z0 + 0.15, z1 - 0.15); gal(x0 + 2.9, x1 - 2.9, 20.0, 22.0, -0.02); // the bridge deck sits 2 cm lower where it overlaps the galleries' ends
  const rail = (ax: number, az: number, bx2: number, bz: number) => {
    b.rod('trim_steel', ax, G + 1.1, az, bx2, G + 1.1, bz, 0.025, 6).rod('trim_steel', ax, G + 0.55, az, bx2, G + 0.55, bz, 0.02, 6);
    const n = Math.max(1, Math.round(Math.hypot(bx2 - ax, bz - az) / 1.5));
    for (let i = 0; i <= n; i++) { const x = lerp(ax, bx2, i / n), z = lerp(az, bz, i / n); b.rod('trim_steel', x, G, z, x, G + 1.1, z, 0.02, 5); }
  };
  rail(x0 + 3.0, z0 + 0.2, x0 + 3.0, 20.0); rail(x1 - 3.0, z0 + 0.2, x1 - 3.0, 20.0); rail(x0 + 3.0, 20.0, x1 - 3.0, 20.0);
  // the empty cradle: rails, saddles (arches for r 1.5 at axis y 2.1), pads, clamps open
  for (const x of S.rails) { b.bx(steel, x - 0.06, 0, 4.0, x + 0.06, 0.15, z1 - 0.2); b.bx(dark, x - 0.12, 0, 4.0, x + 0.12, 0.03, z1 - 0.2); }
  const cx = 112, ay = 2.1, rr = 1.56;
  for (const z of S.saddles) {
    b.bx(navy, cx - 1.7, 0.15, z - 0.25, cx + 1.7, 0.45, z + 0.25);
    for (let i = 0; i < 10; i++) {
      const a0 = -1.0 + (i / 10) * 2.0, a1 = -1.0 + ((i + 1) / 10) * 2.0, am = (a0 + a1) / 2;
      const px = cx + Math.sin(am) * (rr + 0.1), py = ay - Math.cos(am) * (rr + 0.1);
      b.push(px, py, z, 0, 0, am).box(navy, 0, 0, 0, (a1 - a0) * (rr + 0.1) + 0.02, 0.2, 0.36).box('rubber', 0, 0.11, 0, (a1 - a0) * rr - 0.02, 0.025, 0.3).pop();
      if (i === 0 || i === 9 || i === 3 || i === 6) b.bx(navy, px - 0.06, 0.45, z - 0.15, px + 0.06, py, z + 0.15);
    }
    for (const s of [-1, 1]) {
      const bx2 = cx + s * 1.62;
      b.bx(yellow, bx2 - 0.1, 0.45, z - 0.12, bx2 + 0.1, 1.2, z + 0.12);
      b.push(bx2, 1.2, z, 0, 0, -s * 0.95).box(yellow, 0, 0.45, 0, 0.12, 0.9, 0.2).box('rubber', 0, 0.9, 0, 0.16, 0.05, 0.22).pop();
      b.rod('chrome', bx2 + s * 0.08, 0.6, z, bx2 + s * 0.55, 1.45, z, 0.03, 8);
    }
  }
  b.sign('턴 — SDV-07 — 크레이들', 'stencil', cx, 0.32, S.saddles[0] - 0.255, 1.4, 0.12, '-z');
  // equipment boxes, shore-power cable, a hose
  for (const [ex0, ex1, ez0, ez1] of [[108.4, 109.6, 15, 17], [114.4, 115.6, 15, 17]]) b.bx(dark, ex0, 0, ez0, ex1, 1.3, ez1);
  b.rod('rubber', 101.0, 0.05, 6.0, 108.4, 0.05, 15.6, 0.04, 8).rod('rubber', 108.4, 0.05, 15.6, 108.4, 0.4, 16.0, 0.04, 8);
  b.rod('rubber', 115.6, 0.04, 16.4, 119.0, 0.04, 9.0, 0.03, 8).rod('rubber', 119.0, 0.04, 9.0, 117.5, 0.04, 3.0, 0.03, 8);
  // wet patches + the water run from the lock (thin overlays)
  const pud = L.puddleMat(), rnd = rng(606);
  const disc = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < 9; i++) {
    const x = 106 + rnd() * 12, z = 1.2 + rnd() * 16, sx = 0.3 + rnd() * 0.8, sz = 0.2 + rnd() * 0.5;
    b.detail(() => b.geo(pud, disc, 'keep', trs(x, 0.003 + i * 0.0004, z, -PI / 2, 0, rnd() * PI, sx, sz, 1)));
  }
  b.detail(() => b.geo(pud, disc, 'keep', trs(112, 0.004, 1.6, -PI / 2, 0, 0, 2.2, 1.3, 1)));
  b.detail(() => b.geo(L.overlay('hazard_stripes'), new THREE.PlaneGeometry(1, 1), 'box', trs(112, 0.002, 0.9, -PI / 2, 0, 0, 7.0, 1.2, 1)));
  // the launch-lock door (shut), dogs, hinge blocks, the black port
  const [lx, ly, lz] = S.lock;
  b.cyl(navy, lx, ly, lz + 0.06, S.lockR, 0.12, 'z', 48);
  b.torus(steel, lx, ly, lz + 0.1, S.lockR + 0.12, 0.16, 'z', 48);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.push(lx + Math.cos(a) * 2.28, ly + Math.sin(a) * 2.28, lz + 0.14, 0, 0, a).box(steel, 0, 0, 0, 0.32, 0.1, 0.08).pop(); }
  for (const y of [ly - 1.4, ly + 1.4]) b.bx(steel, lx - S.lockR - 0.5, y - 0.2, lz + 0.0, lx - S.lockR + 0.1, y + 0.2, lz + 0.3);
  b.torus(steel, lx, 2.2, lz + 0.155, 0.33, 0.045, 'z', 24);
  b.bx(dark, lx - 0.25, 3.6, lz + 0.12, lx + 0.25, 3.9, lz + 0.135);
  b.sign('발사 록 — 침수', 'danger', lx, 6.65, lz + 0.01, 2.4, 0.3, '+z');
  b.sign('열지 마세요 — 해수 압력', 'warning', lx, 6.25, lz + 0.01, 1.8, 0.18, '+z');
  // board + bezel
  b.bx(dark, 102.95, 5.6, lz, 106.05, 6.8, lz + 0.02);
  const board = L.screen('feed6_board', 'dock_status', 2.8, 1.0, 104.5, 6.2, lz + 0.025, '+z', { text: '턴 — 크레이들 — 비어 있음\n발사 록 — 침수' });
  board.userData.rooms = rooms.slice();
  // rig: the black port, the FLOODED lamp, two beacons (domes + rotating reflectors)
  const R = new Rig6(L, 'feed6');
  R.emit(PAL.lensA, 0xff1a0a, 5.0);
  R.emit(PAL.lensB, 0xff9a20, 1.6);
  R.emit(PAL.yellow, 0xffb030, 7.0);
  R.paint(PAL.black, 0x020304, 0.05, 0.6);
  R.cyl(PAL.black, 0, lx, 2.2, lz + 0.14, 0.3, 0.02, 'z', 24);
  R.cyl(PAL.dark, 0, lx, 6.0, lz + 0.06, 0.16, 0.12, 'z', 18);
  R.sph(PAL.lensA, 0, lx, 6.0, lz + 0.17, 0.13, 14, 0.9);
  // on the side walls over the galleries, mid-bay, so their sweep lights the cradle for the camera
  const beaconAt: THREE.Vector3[] = [V(x0 + 0.55, 7.6, 12.0), V(x1 - 0.55, 7.6, 12.0)];
  beaconAt.forEach((p, i) => {
    const wx = i ? x1 - 0.2 : x0 + 0.2; b.bx(steel, Math.min(wx, p.x + (i ? -0.12 : 0.12)), p.y - 0.3, p.z - 0.12, Math.max(wx, p.x + (i ? -0.12 : 0.12)), p.y - 0.11, p.z + 0.12);
    R.cyl(PAL.dark, 0, p.x, p.y - 0.06, p.z, 0.14, 0.1, 'y', 18);
    R.sph(PAL.lensB, 0, p.x, p.y + 0.12, p.z, 0.13, 16, 1.3);
    R.box(PAL.yellow, 1 + i, p.x, p.y + 0.12, p.z + 0.06, 0.16, 0.2, 0.01);
    R.box(PAL.dark, 1 + i, p.x, p.y + 0.12, p.z - 0.002, 0.18, 0.22, 0.01);
  });
  R.build(rooms, 0.6);
  let on = true;
  L.updaters.push((_dt, t) => {
    beaconAt.forEach((p, i) => R.pivot(1 + i, p.x, p.y, p.z, 0, on ? t * 7.5 + i * 1.7 : 0, 0));
  });
  const lights: ReturnType<LevelBuild['point']>[] = [];
  if (o.lights !== false) {
    const was = L.currentRoom; L.currentRoom = rooms[0];
    lights.push(L.point('feed6', beaconAt[0].x + 0.4, beaconAt[0].y, beaconAt[0].z, 0xffa040, 70, 26));
    lights.push(L.point('feed6', beaconAt[1].x - 0.4, beaconAt[1].y, beaconAt[1].z, 0xffa040, 70, 26));
    lights.push(L.point('feed6', lx, 6.4, 1.2, 0xff2a18, 12, 16));
    L.currentRoom = was;
  }
  if (!L.objects.has('mk6_feed_cam')) L.marker('mk6_feed_cam', ...S.cam, 0);
  L.objects.get('mk6_feed_cam')!.userData.target = V(...S.target);
  const root = new THREE.Object3D(); root.name = 'feed6'; root.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  Object.assign(root.userData, {
    beacons: (v: boolean) => { on = v; R.emit(PAL.lensB, 0xff9a20, v ? 1.6 : 0); R.emit(PAL.yellow, 0xffb030, v ? 7 : 0); },
    lamp: (v: boolean) => R.emit(PAL.lensA, 0xff1a0a, v ? 5 : 0),
    cam: V(...S.cam), target: V(...S.target), fov: S.fov, lights,
  });
  L.root.add(root); L.objects.set('feed6', root);
  return root;
}
