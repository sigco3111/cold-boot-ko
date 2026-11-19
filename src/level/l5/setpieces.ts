/**
 * LEVEL 5 set pieces (stage 3c §8.8, task W7). Everything procedural, level-internal, story-free: callers (the
 * D-task dressings) place each piece at the plan's coordinates (the defaults ARE the plan's coordinates) and drive
 * the moving parts from their vignettes. No set piece plays a sound (D25: the vignette that drives it owns its
 * sounds) — each exposes cue callbacks and the world points its sounds come from.
 *
 * | piece | function | default place (§2.2, §2.6) | object(s) | moving API |
 * |---|---|---|---|---|
 * | SDV *TERN* + cradle + rails | `tern(L, o)` | hull x 32.5 … 35.5, z −27 … −43, keel y 0.6; bow −z (toward the lock) | `tern` (+ machine `tern`) | `userData.check()` the pre-launch check (`TERN_CUES`), `snap()`, `setTime(t)`, `onCue(cb)`, `clamps(k)`, `hatch(k)` … |
 * | launch-lock door ⌀ 5.0 | `launchLockDoor(L, b, o)` | centre (34, 3.0, −56), faces +z, port ⌀ 0.6 at (34, 2.2, −55.9) | `lock5_launch` | static (sealed); `userData.pane` |
 * | command-module door | `cmdDoor(L, b, o)` | (44, 0, −16) wall x, spine side −x; port ⌀ 0.25 at (43.8, 1.62, −16); line x 42.5 | `door5_cmd` | `look(on)`, `tally(s)`, `watch(p)`, `pulse(on)`, `lineGlow(k)` |
 * | gate dog ring | `gateLook(L, id, o)` | on the `wide` door `d5_gate`'s leaves | `d5_gate_dogs` | `userData.set(k)` 0 engaged … 1 retracted |
 * | floor hatch lids (south hinge) | `hatchLid(L, b, spec)` + `HATCH5_SPINE`, `HATCH5_MAG` | pit x 36.2 … 38.6, z −17.6 … −15.4; magazine x 20.4 … 21.6, z −27.0 … −24.3 | `hatch5_spine`, `hatch5_mag` | `open(k)`, `dogs(k)`, `lamp(s)` |
 * | gallery wheel ⌀ 0.8 | `wheel5(L, b, o)` | `mk5_wheel` (22.25, 5.9, −52.0) facing +x | `wheel5` | `spin(t)` (0 … 4 s), `set(k)` |
 * | launch console | `launchConsole(L, b, o)` | `mk5_launch` (34.0, 4.8, −34.15) facing −z | `launch5_console` | screens `launch`, `launch5_palm`; `userData.palmPoint` |
 * | booth back door | `boothBackDoor(L, b, o)` | gatehouse east wall x 5.8, z −3.2, swings into the booth | `booth5_backdoor` | `set(k)`, `settle(s, onLatch)` |
 *
 * Conventions: metres, y up, −z forward (bow / "south" = −z). Every function takes the caller's STATIC zone builder
 * `b` (its `rooms` decide visibility; shared library materials merge into that zone's calls) and builds its moving
 * parts as separate groups under `L.root` tagged with `o.rooms ?? b.rooms`. Moving parts that carry decals are
 * registered movers (`physics.addMover`). Colliders are static `b.collide` boxes unless a piece says otherwise.
 *
 * Draw calls are listed in each function's doc ("own" = calls that exist only because of the piece; "zone" =
 * geometry in a library material that merges into the caller's zone at no extra call if the zone already uses it).
 */
import * as THREE from 'three';
import type { LightHandle, MaterialName } from '../../core/types';
import type { Builder, Mat } from '../builder';
import { rng } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import type { DoorImpl } from '../doors';
import { skinParts } from '../machines';

const PI = Math.PI;
const TAU = PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** Min-jerk ease (zero velocity and acceleration at both ends). */
export const minJerk = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * k * (10 + k * (-15 + 6 * k)); };
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };
function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
/** Piecewise key track [t, v][] with min-jerk between keys (holds outside). */
function track(keys: readonly (readonly [number, number])[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) { const [t0, v0] = keys[i - 1]; return v0 + (v1 - v0) * minJerk((t - t0) / (t1 - t0)); }
  }
  return keys[keys.length - 1][1];
}
/** ∫ of a raised-cosine speed window (peak `p` rad/s over [a, a + d]) from −∞ to t. */
function spinInt(t: number, a: number, d: number, p: number): number {
  const u = clamp01((t - a) / d);
  return p * d * 0.5 * (u - Math.sin(TAU * u) / TAU);
}

// ───────────────────────────────────────────────────────────── materials (private, cached per level)

const CACHE = new WeakMap<LevelBuild, Map<string, THREE.Material>>();
function mat5<T extends THREE.Material>(L: LevelBuild, key: string, make: () => T): T {
  let c = CACHE.get(L);
  if (!c) CACHE.set(L, (c = new Map()));
  let m = c.get(key) as T | undefined;
  if (!m) { c.set(key, (m = make())); if (!m.name) m.name = key; }
  return m;
}
/** A library material if it is implemented (`get` returns it under its own name), else a private stand-in. */
export function libOr(L: LevelBuild, name: MaterialName, fb: MaterialName, over: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.get(name);
  if (m.name === name) return m;
  return mat5(L, `sp5_standin_${name}`, () => { const c = L.ctx.materials.clone(fb, over); c.name = `${name}_standin`; return c; });
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const SANS = '"Arial Narrow", "Helvetica Neue", "Roboto Condensed", Arial, sans-serif';

/** Plain paint (no maps) — cached per key. */
function paint5(L: LevelBuild, key: string, color: number, rough: number, metal = 0): THREE.MeshStandardMaterial {
  return mat5(L, `sp5_${key}`, () => L.ctx.materials.clone('painted_white', {
    color, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: rough, metalness: metal,
  }));
}

/**
 * TERN's pressure-hull paint: UV u = round the hull (0 = top, 0.5 = keel), v = metres along / 4. Dark anechoic
 * grey above a red-oxide antifouling band (below ≈ 22° under the axis, y 1.63 on the cylinder) with a white
 * boot-top line, frame-ring and longitudinal welds, salt and rust streaks running down the sides, and a wet
 * roughness map (streaks are wetter).
 */
function hullPaint(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat5(L, 'sp5_tern_hull', () => {
    const W = 1024, H = 512, R = rng(9071);
    const band0 = (PI - 1.25) / TAU, band1 = (PI + 1.25) / TAU;
    const paint = (g: CanvasRenderingContext2D, rough: boolean) => {
      g.fillStyle = rough ? 'rgb(96,96,96)' : '#373e42'; g.fillRect(0, 0, W, H);
      if (!rough) {
        g.fillStyle = '#5a2e24'; g.fillRect(band0 * W, 0, (band1 - band0) * W, H);
        g.fillStyle = '#c9c6bb'; g.fillRect(band0 * W - 5, 0, 5, H); g.fillRect(band1 * W, 0, 5, H);
      }
      // mottling: old paint patches
      for (let i = 0; i < 260; i++) {
        const x = R() * W, y = R() * H, r = 8 + R() * 40;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const c = rough ? (R() < 0.5 ? '70,70,70' : '140,140,140') : (R() < 0.6 ? '0,0,0' : '120,125,120');
        gr.addColorStop(0, `rgba(${c},${rough ? 0.35 : 0.08 + R() * 0.07})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // weld seams: frame rings every 1.333 m (v), longitudinal at the sides (u 0.25 / 0.75)
      for (let k = 0; k < 3; k++) {
        const y = (k * H) / 3 + 3;
        g.fillStyle = rough ? 'rgba(170,170,170,0.9)' : 'rgba(0,0,0,0.55)'; g.fillRect(0, y, W, 3);
        if (!rough) { g.fillStyle = 'rgba(150,150,140,0.22)'; g.fillRect(0, y + 3, W, 1); }
      }
      for (const u of [0.25, 0.75]) {
        g.fillStyle = rough ? 'rgba(170,170,170,0.9)' : 'rgba(0,0,0,0.5)'; g.fillRect(u * W - 1, 0, 3, H);
      }
      // streaks: from the top (u 0 / 1) down the sides toward the keel (u 0.5)
      g.lineCap = 'round';
      for (let i = 0; i < 340; i++) {
        const side = R() < 0.5 ? 1 : -1, y = R() * H;
        const u0 = R() * 0.12, len = 0.08 + R() * 0.32;
        const x0 = side > 0 ? u0 * W : W - u0 * W, x1 = side > 0 ? (u0 + len) * W : W - (u0 + len) * W;
        const lg = g.createLinearGradient(x0, 0, x1, 0);
        const salt = R() < 0.65;
        const c = rough ? '40,40,40' : salt ? '160,164,158' : '90,50,30';
        const a = rough ? 0.5 : salt ? 0.05 + R() * 0.07 : 0.06 + R() * 0.08;
        lg.addColorStop(0, `rgba(${c},${a})`); lg.addColorStop(1, `rgba(${c},0)`);
        g.strokeStyle = lg; g.lineWidth = 1 + R() * 3;
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + (R() - 0.5) * 6); g.stroke();
      }
      // rust bleeds on the antifouling (darker, from the welds)
      if (!rough) for (let i = 0; i < 80; i++) {
        const y = R() * H, x0 = (band0 + R() * (band1 - band0)) * W;
        g.fillStyle = `rgba(30,14,8,${0.1 + R() * 0.15})`; g.fillRect(x0, y, 20 + R() * 60, 2);
      }
    };
    const map = canvasTex(W, H, (g) => paint(g, false));
    const rough = canvasTex(W, H, (g) => paint(g, true), false);
    const m = new THREE.MeshStandardMaterial({ name: 'tern_hull', color: 0xffffff, map, roughness: 0.62, roughnessMap: rough, metalness: 0.1, envMapIntensity: 1.2 });
    return m;
  });
}

/** Casing / sail / pods / fins paint (box-projected metres): darker grey GRP panels, flush fasteners, wet streaks. */
function casingPaint(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat5(L, 'sp5_tern_casing', () => {
    const W = 512, H = 512, R = rng(5503);
    const paint = (g: CanvasRenderingContext2D, rough: boolean) => {
      g.fillStyle = rough ? 'rgb(110,110,110)' : '#3b4245'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        const x = R() * W, y = R() * H, r = 6 + R() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const c = rough ? '160,160,160' : R() < 0.5 ? '0,0,0' : '110,118,118';
        gr.addColorStop(0, `rgba(${c},${rough ? 0.3 : 0.1})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // panel seams every 0.5 m + fasteners every 0.1 m
      g.fillStyle = rough ? 'rgba(200,200,200,0.8)' : 'rgba(0,0,0,0.6)';
      for (const p of [0, 256]) { g.fillRect(p, 0, 2, H); g.fillRect(0, p, W, 2); }
      for (const p of [0, 256]) for (let s = 0; s < W; s += 51) {
        g.fillStyle = rough ? 'rgba(60,60,60,0.9)' : 'rgba(150,155,150,0.35)';
        g.beginPath(); g.arc(p + 8, s + 25, 2.4, 0, TAU); g.fill();
        g.beginPath(); g.arc(s + 25, p + 8, 2.4, 0, TAU); g.fill();
      }
      for (let i = 0; i < 90; i++) {
        const x = R() * W, y0 = R() * H, len = 40 + R() * 200;
        const lg = g.createLinearGradient(0, y0, 0, y0 + len);
        const c = rough ? '40,40,40' : '150,155,150';
        lg.addColorStop(0, `rgba(${c},${rough ? 0.5 : 0.07})`); lg.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = lg; g.fillRect(x, y0, 1 + R() * 2.5, len);
      }
    };
    const map = canvasTex(W, H, (g) => paint(g, false));
    const rough = canvasTex(W, H, (g) => paint(g, true), false);
    return new THREE.MeshStandardMaterial({ name: 'tern_casing', color: 0xffffff, map, roughness: 0.55, roughnessMap: rough, metalness: 0.05, envMapIntensity: 1.1 });
  });
}

/**
 * Self-light (fake local lighting from the boat's own lamps): every lit fragment of a patched material receives
 * `col / (1 + d² / R²) × (0.15 + 0.85 · max(0, n·l))`, summed over 12 lamp sources — so in the dark the hull, sail
 * and cradle catch their own running lights without one extra real light. Works on skinned meshes.
 */
interface SelfLight { pos: THREE.Vector4[]; col: THREE.Vector3[] }
const SELF_N = 12;
function patchSelfLight(m: THREE.MeshStandardMaterial, s: SelfLight, key: string) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uSelfP = { value: s.pos };
    sh.uniforms.uSelfC = { value: s.col };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSelfW;\nvarying vec3 vSelfN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vSelfW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vSelfN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSelfW;\nvarying vec3 vSelfN;\nuniform vec4 uSelfP[${SELF_N}];\nuniform vec3 uSelfC[${SELF_N}];`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    vec3 sl = vec3(0.0);
    vec3 nn = normalize(vSelfN);
    for (int i = 0; i < ${SELF_N}; i++) {
      vec3 d = uSelfP[i].xyz - vSelfW;
      float r2 = dot(d, d);
      float R = uSelfP[i].w;
      float nl = max(0.0, dot(nn, d * inversesqrt(r2 + 1e-4)));
      sl += uSelfC[i] * (0.15 + 0.85 * nl) / (1.0 + r2 / (R * R));
    }
    totalEmissiveRadiance += sl * (diffuseColor.rgb + 0.025);
  }`);
  };
  m.customProgramCacheKey = () => `sp5_self_${key}`;
}

// ───────────────────────────────────────────────────────────── lamp sets (one call for many lamps)

const LAMP_GEO = new Map<string, THREE.BufferGeometry>();
/** Unit lamp geometry whose every uv = (index + 0.5, 0.5) — the lamp material reads its lamp from uv.x. */
function lampGeo(kind: 'sph' | 'cyl' | 'box' | 'hemi', i: number): THREE.BufferGeometry {
  const k = `${kind}${i}`;
  let g = LAMP_GEO.get(k);
  if (!g) {
    g = kind === 'sph' ? new THREE.SphereGeometry(1, 12, 8) : kind === 'hemi' ? new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, PI / 2)
      : kind === 'cyl' ? new THREE.CylinderGeometry(1, 1, 1, 16) : new THREE.BoxGeometry(1, 1, 1);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, i + 0.5, 0.5);
    LAMP_GEO.set(k, g);
  }
  return g;
}

/**
 * Many small lamps in ONE draw call (+ one for their halos): lamp `i`'s emission is `color[i] × level[i] × gain[i]`
 * through a uniform array (uv.x carries the index), its lens albedo `albedo[i]`. Halos are camera-facing additive
 * points that never shrink under `minPx` pixels (dark-room reading at 25 m, like the enemy marks).
 */
export class LampSet {
  readonly mat: THREE.MeshStandardMaterial;
  readonly color: THREE.Vector3[] = [];
  readonly albedo: THREE.Vector3[] = [];
  readonly gain: Float32Array;
  readonly level: Float32Array;
  private readonly E: THREE.Vector3[] = [];
  private halos: { p: THREE.Vector3; i: number; s: number; px: number }[] = [];
  points: THREE.Points | null = null;
  /** Global multiplier (machine power). */
  power = 1;
  constructor(readonly L: LevelBuild, readonly name: string, readonly n: number) {
    this.gain = new Float32Array(n).fill(6);
    this.level = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.color.push(new THREE.Vector3(1, 1, 1)); this.albedo.push(new THREE.Vector3(0.1, 0.1, 0.1)); this.E.push(new THREE.Vector3()); }
    const m = new THREE.MeshStandardMaterial({ name, color: 0xffffff, roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1 });
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    const E = this.E, A = this.albedo;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLampE = { value: E };
      sh.uniforms.uLampA = { value: A };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLampI;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLampI = uv.x;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying float vLampI;\nuniform vec3 uLampE[${n}];\nuniform vec3 uLampA[${n}];`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n  int lampI = int(vLampI);\n  diffuseColor.rgb = uLampA[lampI];')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = uLampE[lampI];');
    };
    m.customProgramCacheKey = () => `sp5_lamps_${n}`;
    this.mat = m;
    L.updaters.push(() => this.flush());
  }
  set(i: number, color: THREE.ColorRepresentation, gain: number, albedo?: THREE.ColorRepresentation) {
    const c = new THREE.Color(color);
    this.color[i].set(c.r, c.g, c.b);
    this.gain[i] = gain;
    const a = new THREE.Color(albedo ?? c.clone().multiplyScalar(0.25));
    this.albedo[i].set(a.r, a.g, a.b);
  }
  flush() {
    for (let i = 0; i < this.n; i++) this.E[i].copy(this.color[i]).multiplyScalar(Math.max(0, this.level[i]) * this.gain[i] * this.power);
  }
  /** Current emission of lamp i (linear RGB, already × level × gain × power). */
  emission(i: number): THREE.Vector3 { return this.E[i]; }
  sphere(b: Builder, i: number, x: number, y: number, z: number, r: number, sy = 1) { b.detail(() => b.geo(this.mat, lampGeo('sph', i), 'keep', trs(x, y, z, 0, 0, 0, r, r * sy, r))); }
  hemi(b: Builder, i: number, x: number, y: number, z: number, r: number, rx: number, ry: number, rz: number) { b.detail(() => b.geo(this.mat, lampGeo('hemi', i), 'keep', trs(x, y, z, rx, ry, rz, r, r, r))); }
  /** Disc lens: axis along local y of (rx, ry, rz). */
  disc(b: Builder, i: number, x: number, y: number, z: number, r: number, t: number, rx: number, ry: number, rz: number) { b.detail(() => b.geo(this.mat, lampGeo('cyl', i), 'keep', trs(x, y, z, rx, ry, rz, r, t, r))); }
  box(b: Builder, i: number, x: number, y: number, z: number, w: number, h: number, d: number) { b.detail(() => b.geo(this.mat, lampGeo('box', i), 'keep', trs(x, y, z, 0, 0, 0, w, h, d))); }
  /** A halo for lamp i at world point p: world size `s` (m, full width) never under `px` pixels. */
  halo(i: number, p: THREE.Vector3, s: number, px = 4) { this.halos.push({ p: p.clone(), i, s, px }); }
  /** Build the halo points (call once after every `halo`). */
  finish(rooms: string[], gain = 0.45): THREE.Points | null {
    if (!this.halos.length) return null;
    const n = this.halos.length;
    const pos = new Float32Array(n * 3), ai = new Float32Array(n), as = new Float32Array(n), ap = new Float32Array(n);
    this.halos.forEach((h, k) => { pos.set([h.p.x, h.p.y, h.p.z], k * 3); ai[k] = h.i + 0.5; as[k] = h.s; ap[k] = h.px; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aI', new THREE.BufferAttribute(ai, 1));
    g.setAttribute('aS', new THREE.BufferAttribute(as, 1));
    g.setAttribute('aP', new THREE.BufferAttribute(ap, 1));
    g.computeBoundingSphere();
    const halfH = { value: 450 };
    const mat = new THREE.ShaderMaterial({
      name: `${this.name}_halo`,
      uniforms: { uLampE: { value: this.E }, uHalfH: halfH, uGain: { value: gain } },
      vertexShader: /* glsl */`
        attribute float aI; attribute float aS; attribute float aP;
        uniform vec3 uLampE[${this.n}]; uniform float uHalfH;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = aS * projectionMatrix[1][1] * uHalfH / max(0.05, -mv.z);
          vec3 e = uLampE[int(aI)];
          float lum = max(e.r, max(e.g, e.b));
          gl_PointSize = lum > 0.002 ? max(px, aP) : 0.0;
          // a clamped (distant) halo keeps its energy per pixel (it must read in the dark), a near one fades a little
          vC = e;
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain;
        varying vec3 vC;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          float a = exp(-r2 * 5.0) * (1.0 - r2);
          gl_FragColor = vec4(vC * a * uGain, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.name = `${this.name}:halos`;
    pts.userData.rooms = rooms.slice();
    pts.renderOrder = 5;
    pts.onBeforeRender = (r) => { halfH.value = r.getDrawingBufferSize(_dbs).y / 2; };
    this.L.root.add(pts);
    this.points = pts;
    return pts;
  }
}
const _dbs = new THREE.Vector2();

// ───────────────────────────────────────────────────────────── geometry helpers

/**
 * Surface of revolution about an axis along z through (cx, cy). `prof` = [z, r] in traversal order (outward normal
 * = left of the tangent in the (z, r) plane: z increasing with r constant faces outward; r increasing at constant z
 * faces −z). uv: u = u0 + uSpan × (angle / 2π) (angle 0 = top, clockwise seen from +z … i.e. toward +x first),
 * v = z / vTile, or r / vTile with `vFromR`.
 */
function revolve(prof: readonly (readonly [number, number])[], seg: number, cx: number, cy: number,
  o: { u0?: number; uSpan?: number; vTile?: number; vFromR?: boolean; phi0?: number; phiLen?: number } = {}): THREE.BufferGeometry {
  const n = prof.length, cols = seg + 1;
  const u0 = o.u0 ?? 0, us = o.uSpan ?? 1, vt = o.vTile ?? 4, phi0 = o.phi0 ?? 0, phiLen = o.phiLen ?? TAU;
  const P = new Float32Array(n * cols * 3), N = new Float32Array(n * cols * 3), U = new Float32Array(n * cols * 2);
  for (let i = 0; i < n; i++) {
    const [z, r] = prof[i];
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(n - 1, i + 1)];
    let tz = b[0] - a[0], tr = b[1] - a[1];
    const tl = Math.hypot(tz, tr) || 1; tz /= tl; tr /= tl;
    const nz = -tr, nr = tz;
    for (let j = 0; j < cols; j++) {
      const f = j / seg, ph = phi0 + f * phiLen;
      const s = Math.sin(ph), c = Math.cos(ph);
      const k = (i * cols + j) * 3;
      P[k] = cx + r * s; P[k + 1] = cy + r * c; P[k + 2] = z;
      N[k] = nr * s; N[k + 1] = nr * c; N[k + 2] = nz;
      const kk = (i * cols + j) * 2;
      U[kk] = u0 + us * (ph / TAU); U[kk + 1] = (o.vFromR ? r : z) / vt;
    }
  }
  const I: number[] = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * cols + j, b = (i + 1) * cols + j, c = i * cols + j + 1, d = (i + 1) * cols + j + 1;
    I.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
}
/** Open tube seen from inside (normals inward), axis along local y, from y0 to y1. */
function tubeIn(r: number, y0: number, y1: number, seg = 20): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true);
  g.translate(0, (y0 + y1) / 2, 0);
  return flipped(g);
}
/** Same geometry with faces and normals turned inside out. */
function flipped(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
/** A flat bezel ring round a local z axis through (cx, cy): front face at z + d (faces +z), outer band, inner bore. */
function bezel(b: Builder, mat: Mat, cx: number, cy: number, z: number, r0: number, r1: number, d: number, seg = 32) {
  b.geo(mat, revolve([[z + d, r1], [z + d, r0]], seg, cx, cy, { vFromR: true, vTile: 1 }), 'box');
  b.geo(mat, revolve([[z, r1], [z + d, r1]], seg, cx, cy, { vTile: 1 }), 'box');
  b.geo(mat, revolve([[z + d, r0], [z, r0]], seg, cx, cy, { vTile: 1 }), 'box');
}
/** Rounded rectangle path (centre-origin) for shapes. */
function roundRect(p: THREE.Path, w: number, h: number, r: number, cx = 0, cy = 0, ccw = true) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  if (ccw) {
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -PI / 2, 0, false);
    p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, PI / 2, false);
    p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, PI / 2, PI, false);
    p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, PI, PI * 1.5, false);
  } else {
    p.moveTo(x0 + r, y0); p.absarc(x0 + r, y0 + r, r, PI * 1.5, PI, true);
    p.lineTo(x0, y1 - r); p.absarc(x0 + r, y1 - r, r, PI, PI / 2, true);
    p.lineTo(x1 - r, y1); p.absarc(x1 - r, y1 - r, r, PI / 2, 0, true);
    p.lineTo(x1, y0 + r); p.absarc(x1 - r, y0 + r, r, 0, -PI / 2, true);
  }
}
/** Spoked handwheel in the local xy plane (axis z): rim radius R, tube t, `spokes`, hub; + a knob at the top. */
function handwheel(b: Builder, mat: Mat, R: number, t: number, spokes: number, knob = true) {
  b.torus(mat, 0, 0, 0, R, t, 'z', 24);
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * TAU + 0.3; b.rod(mat, 0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0, t * 0.6, 6); }
  b.cyl(mat, 0, 0, 0, R * 0.18, t * 3, 'z', 12);
  if (knob) b.cyl(mat, 0, R, t * 2, t * 0.9, t * 4, 'z', 8);
}
/** A propeller blade at angle `a` round the local z axis: radial centre `rm`, length `len`, chord, thickness, pitched about its own radial axis. */
function blade(b: Builder, mat: Mat, a: number, rm: number, len: number, chord: number, thick: number, pitch: number) {
  const m = new THREE.Matrix4().makeTranslation(Math.sin(a) * rm, Math.cos(a) * rm, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(-a))
    .multiply(new THREE.Matrix4().makeRotationY(pitch))
    .multiply(new THREE.Matrix4().makeScale(thick, len, chord));
  b.geo(mat, new THREE.BoxGeometry(1, 1, 1), 'box', m);
}
/** A moving group under L.root (rooms tagged) built from a part builder; optional mover registration. */
function movingGroup(L: LevelBuild, name: string, rooms: string[], make: (p: Builder) => void, mover = true): { mount: THREE.Group; pivot: THREE.Group } {
  const p = L.part(name);
  make(p);
  const g = p.build();
  const mount = new THREE.Group(); mount.name = name; mount.userData.rooms = rooms.slice();
  const pivot = new THREE.Group(); pivot.name = `${name}:pivot`;
  pivot.add(g); mount.add(pivot); L.root.add(mount);
  if (mover) L.ctx.physics?.addMover?.(mount);
  return { mount, pivot };
}

// ───────────────────────────────────────────────────────────── markings atlas (TERN)

type MarkKey = 'n07' | 'tern' | 'draught' | 'nostep' | 'lift' | 'rescue' | 'thruster' | 'hatchring' | 'sdv' | 'vent' | 'shore';
const MARK_RECT: Record<MarkKey, [number, number, number, number]> = {
  n07: [0, 0, 256, 256], tern: [256, 0, 512, 128], draught: [768, 0, 128, 256], nostep: [256, 128, 256, 64],
  lift: [512, 128, 128, 128], rescue: [640, 128, 128, 128], thruster: [256, 192, 256, 64], hatchring: [0, 256, 256, 256],
  sdv: [256, 256, 512, 64], vent: [256, 320, 256, 64], shore: [512, 320, 256, 64],
};
function markMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat5(L, 'sp5_tern_marks', () => {
    const W = 1024, H = 512, R = rng(313);
    const tex = canvasTex(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      const white = '#d9d6cc', yellow = '#d9a514', red = '#b8321e';
      const text = (k: MarkKey, s: string, col: string, size: number, weight = '900') => {
        const [x, y, w, h] = MARK_RECT[k];
        g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
        let fs = size; g.font = `${weight} ${fs}px ${SANS}`;
        while (g.measureText(s).width > w * 0.94 && fs > 8) { fs--; g.font = `${weight} ${fs}px ${SANS}`; }
        g.fillText(s, x + w / 2, y + h / 2 + fs * 0.04);
      };
      text('n07', '07', white, 230);
      text('tern', 'TERN', white, 120);
      text('nostep', '밟지 마세요', white, 50);
      text('thruster', '위험 — 추진기', yellow, 44);
      text('sdv', 'SDV-07  턴  ·  에리두 심해 파견대', white, 40, '700');
      text('vent', '벤트 ▲ 접근 금지', white, 40, '700');
      text('shore', '육상 전원 440 V', yellow, 40, '700');
      // draught marks: a vertical scale, numbers every 0.5 m
      { const [x, y, w, h] = MARK_RECT.draught; g.fillStyle = white; g.font = `900 40px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        for (let k = 0; k < 4; k++) { const yy = y + h - 30 - k * 62; g.fillRect(x + 6, yy - 3, 30, 6); g.fillText(String(k + 1), x + 46, yy); } }
      // lifting point: ring + LIFT
      { const [x, y, w, h] = MARK_RECT.lift; g.strokeStyle = yellow; g.lineWidth = 12; g.beginPath(); g.arc(x + w / 2, y + h / 2, w * 0.4, 0, TAU); g.stroke();
        g.fillStyle = yellow; g.font = `900 30px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('리프트', x + w / 2, y + h / 2); }
      // rescue arrow
      { const [x, y, w, h] = MARK_RECT.rescue; g.fillStyle = red; g.fillRect(x + 10, y + 50, w - 50, 28);
        g.beginPath(); g.moveTo(x + w - 44, y + 30); g.lineTo(x + w - 6, y + 64); g.lineTo(x + w - 44, y + 98); g.fill();
        g.font = `900 26px ${SANS}`; g.textAlign = 'center'; g.fillText('구조', x + w / 2 - 10, y + 22); }
      // hatch ring: yellow / black chevron annulus
      { const [x, y, w] = MARK_RECT.hatchring; const cx = x + w / 2, cy = y + w / 2, r0 = w * 0.41, r1 = w * 0.49;
        for (let i = 0; i < 24; i++) { const a0 = (i / 24) * TAU, a1 = ((i + 1) / 24) * TAU;
          g.fillStyle = i % 2 ? '#141414' : yellow; g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fill(); } }
      // wear: knock holes through every marking
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1400; i++) { const x = R() * W, y = R() * H, r = 0.5 + R() * 3.5; g.fillStyle = `rgba(0,0,0,${0.4 + R() * 0.6})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshStandardMaterial({ name: 'tern_marks', map: tex, alphaTest: 0.45, roughness: 0.6, metalness: 0 });
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4;
    return m;
  });
}
/** A marking quad centred at p with outward normal n and "up" direction u (both world), size w × h. */
function mark(b: Builder, L: LevelBuild, key: MarkKey, p: THREE.Vector3, n: THREE.Vector3, u: THREE.Vector3, w: number, h: number) {
  const [x, y, rw, rh] = MARK_RECT[key];
  const g = new THREE.PlaneGeometry(1, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * rw) / 1024, 1 - (y + (1 - uv.getY(i)) * rh) / 512);
  const zz = n.clone().normalize(), xx = new THREE.Vector3().crossVectors(u, zz).normalize(), yy = new THREE.Vector3().crossVectors(zz, xx);
  const m = new THREE.Matrix4().makeBasis(xx, yy, zz).scale(new THREE.Vector3(w, h, 1)).setPosition(p.x + zz.x * 0.004, p.y + zz.y * 0.004, p.z + zz.z * 0.004);
  b.detail(() => b.geo(markMat(L), g, 'keep', m));
}

// ═════════════════════════════════════════════════════════════ SDV TERN

/** TERN's numbers (world). Bow at z −43 faces the launch lock (−z); stern / main thruster at z −27. */
export const TERN5 = {
  x: 34, zMid: -35, zBow: -43, zStern: -27, keel: 0.6, r: 1.5, axisY: 2.1,
  sail: { z0: -32.5, z1: -30.0, w: 0.95, y0: 3.4, top: 4.5 },
  hatch: { x: 34, y: 4.5, z: -31.4, r: 0.36 },
  cradle: { x0: 31.8, x1: 36.2, top: 0.6, z0: -42.7, z1: -27.3, saddles: [-41.3, -38.3, -35.3, -32.3, -29.3] },
  rails: { x: [33.0, 35.0], z0: -55.6, z1: -19.0, h: 0.15 },
} as const;

/** Pre-launch check cues, in order, with their sequence times (s). Sounds per cue: see `tern`'s doc. */
export const TERN_CUES = {
  power: 0, lights: 1.6, floods: 3.0, ballast: 4.0, ballast_end: 7.0, dog: 7.2, hatch_open: 8.5, clang: 9.42,
  thrusters: 10.2, clamps: 13.4, clamps_home: 16.0, hatch_shut: 16.7, latch: 17.42, complete: 18.6,
} as const;
export type TernCue = keyof typeof TERN_CUES;
/** Total length of the check (s): the end state is reached here. */
export const TERN_CHECK_LEN = 19.4;

/** `tern.userData.seq` — the check's state (read-only; `t` −1 = never run). */
export interface TernSeq { t: number; running: boolean; cue: TernCue | 'rest'; state: 'rest' | 'running' | 'complete'; duration: number }

export interface TernOpts {
  /** Static zone the boat's shared-material parts, cradle and rails go into (default: own zone `tern_static`, rooms `rooms`). */
  builder?: Builder;
  /** Rooms the boat is drawn in (default ['sub5']). */
  rooms?: string[];
  /** Build the rails x 33 / 35, z −55.6 … −19.0 (default true). */
  rails?: boolean;
  /** Shore-power umbilical from the port flank to this world point (default (31.62, 1.08, −32.0) = equipment box EW1's top). false = none. */
  umbilical?: readonly [number, number, number] | false;
  /** Halos on the lamps (1 transparent call; default true). */
  halos?: boolean;
  /** Light group of the two real lights the boat owns (interior glow, bow flood spot). Default 'tern' (NOT 'sub5': lights_out5 must not touch them). */
  lightGroup?: string;
  /** The bow flood spot during the check (non-shadow spot, medium+, toward the lock door). Default true. */
  floodSpot?: boolean;
  /** Initial state: 'rest' (before the check; default) or 'complete' (as after it). */
  state?: 'rest' | 'complete';
}

/**
 * SDV *TERN* (§2.6 sub5, §5.5 #10, §8.8.1) — a swimmer-delivery / work submersible on its yellow cradle.
 *
 * **Shape** (world, defaults = the plan): pressure hull ⌀ 3.0, axis (34, 2.1, z), hull z −27.0 (stern) … −43.0
 * (bow); keel (lowest point) y 0.6 on the cradle. Bow faces −z, toward the launch lock: a faired nose with an acrylic
 * dome port ⌀ 1.5 (lit pilot console behind it), two bow floodlights, bow tunnel-thruster grilles. Sail (hatch trunk)
 * z −32.5 … −30.0, ⌀ 0.95 wide, top y 4.5, with the top hatch ⌀ 0.72 (hinged aft, a dog handwheel on it), red / green
 * nav lights on its sides, stern light + strobe aft on top, a status strip (6 LEDs a side), hull number `07`, a
 * whip mast that rises during the check. Free-flood deck casing with lifting lugs; two side ballast tanks; two azimuth
 * thruster pods (z −30.8) and a ducted main thruster in an X-tail ring (z −27). Markings: TERN, SDV-07, draught
 * marks, LIFT, NO STEP, RESCUE, DANGER — THRUSTER, SHORE POWER. Cradle x 31.8 … 36.2, top y 0.6, five saddles
 * (z −41.3 … −29.3) with clamp arms; bogies on the rails x 33 / 35 (z −55.6 … −19.0, 0.15 high, walkable).
 *
 * **Colliders** (static): cradle box x 31.8 … 36.2, y 0 … 0.6, z −42.7 … −27.3; the hull as a 16-sided prism of
 * oriented planks (≤ 3 cm outside the skin; the visible hull is a registered mover so bullet decals snap onto it); the
 * sail box; the side tanks; rails 0.15 high (nav: false — walkable). No collider on the moving parts.
 *
 * **Draw calls** — own: hull (1), casing (1), dome glass (1, transparent), markings (1), lamps (1), halos (1,
 * transparent additive; `halos: false` drops it), skinned casing / steel / cradle-yellow (3 — pods, props, tail
 * flaps, whip mast, clamp arms), hatch lid + its dog wheel (2) = **11** (9 opaque); the cradle's static yellow
 * (`tern_cradle`, self-lit, 1). Zone (merged into `builder`): `steel_raw` (rails, bogies, fittings), `painted_dark`
 * (cockpit, housings), `rubber`, `hazard_stripes`. ≈ 16 k triangles. Shadow: hull, casing, the zone proxy, 3 skinned,
 * the hatch (2). Real lights (group `lightGroup`): interior glow point (medium+, on only while the hatch is open,
 * inside the trunk) and the bow flood spot (medium+, non-shadow, only from `floods` to `complete`). Self-light: hull,
 * casing and cradle catch the boat's own lamps in a shader (no real light) — that is what makes it read in the dark.
 *
 * **The pre-launch check** (`userData.check()`, for `v5_sub_check`; 19.4 s, nobody aboard):
 * `power` 0.0 status strip steps on LED by LED (amber), cockpit glow · `lights` 1.6 nav red, green, stern step on,
 * strobe from 2.5, pod ready-LEDs 2.7 · `floods` 3.0 bow floods strike and settle · `ballast` 4.0 … `ballast_end`
 * 7.0 blow (mist from `userData.vents`) · `dog` 7.2 the hatch's dog wheel turns 1.5 turns · `hatch_open` 8.5 the
 * lid swings up and back, `clang` 9.42 when it hits its stop; warm glow up the trunk · `thrusters` 10.2 the pods
 * twitch left / right and back, props bump, tail flaps cycle, the whip mast rises · `clamps` 13.4 the clamp arms
 * release saddle by saddle, `clamps_home` 16.0 they bite again (the last at 16.6) · `hatch_shut` 16.7 lid down, `latch` 17.42 it seats,
 * dog wheel back · `complete` 18.6 floods off, strip steps to green, umbilical LED green. End state = 'complete'
 * (nav + strobe on, hatch shut). Sounds (the vignette's, D25): `power` → `sub_systems_hum` at `soundPoints.hull`;
 * `ballast` → `sub_ballast_hiss` at `soundPoints.ballast`; `clang` (and `latch`, quieter) → `sub_hatch_clang` at
 * `soundPoints.hatch`; `clamps` / `clamps_home` → `clamp_cycle` at `soundPoints.cradle`.
 *
 * **userData API** (`L.objects.get('tern').userData`):
 * - `check()` — start the check (ignored while running; re-runs from 0 once complete). `snap()` — end state, silent.
 * - `setTime(t)` — pose the check at time t (no callbacks; t < 0 = rest). `seq` (`TernSeq`), `cueTimes` (= TERN_CUES).
 * - `onCue(cb(cue, seq))` → unsubscribe. `vents: { p, dir }[]` (8 world points + direction for the ballast mist),
 *   `drips: Vector3[]` (hull-bottom drip points), `soundPoints: { hull, ballast, hatch, cradle }`.
 * - Direct (dev, other vignettes): `clamps(k)` 0 clamped … 1 released, `hatch(k)` 0 shut … 1 open, `dog(k)`,
 *   `lamps` (the LampSet), `bones`.
 * Machine `tern`: 'off' = dead (every lamp out, the check frozen); any other state = powered.
 */
export function tern(L: LevelBuild, o: TernOpts = {}): THREE.Object3D {
  const X = TERN5.x, ZM = TERN5.zMid, AY = TERN5.axisY, HR = TERN5.r;
  const rooms = o.rooms ?? ['sub5'];
  const zb = o.builder ?? (() => { const b = L.builder('tern_static'); b.rooms = rooms.slice(); return b; })();
  const lightGroup = o.lightGroup ?? 'tern';
  const hull = hullPaint(L), casing = casingPaint(L);
  const steel: Mat = 'steel_raw', dark: Mat = 'painted_dark';
  const W = (x: number, y: number, z: number) => new THREE.Vector3(X + x, y, ZM + z);

  // ── profile (boat-local z: bow −8 … stern +8)
  const NOSE0 = -5.6, NOSE_L = 2.4, CUT = -7.35, ST0 = 5.0, ST1 = 7.6, RT = 0.45;
  const hullR = (z: number) => {
    if (z < NOSE0) { const u = (NOSE0 - z) / NOSE_L; return HR * Math.sqrt(Math.max(0, 1 - u * u)); }
    if (z <= ST0) return HR;
    if (z <= ST1) { const k = (z - ST0) / (ST1 - ST0); return RT + (HR - RT) * (1 + Math.cos(PI * k)) / 2; }
    return RT;
  };
  const rCut = hullR(CUT), DOME_R = 0.75;

  // ── self-light (8 sources, world)
  const self: SelfLight = { pos: [], col: [] };
  for (let i = 0; i < SELF_N; i++) { self.pos.push(new THREE.Vector4(0, -100, 0, 1)); self.col.push(new THREE.Vector3()); }
  const hullMat = mat5(L, 'sp5_tern_hull_self', () => { const m = hull.clone(); m.name = 'tern_hull'; patchSelfLight(m, self, 'hull'); return m; });
  const casMat = mat5(L, 'sp5_tern_casing_self', () => { const m = casing.clone(); m.name = 'tern_casing'; patchSelfLight(m, self, 'casing'); return m; });
  const yelMat = mat5(L, 'sp5_tern_yellow_self', () => { const m = L.ctx.materials.clone('painted_yellow'); m.name = 'tern_cradle'; patchSelfLight(m, self, 'yellow'); return m; });
  const yellow: Mat = yelMat;

  // ── lamps
  const LP = { red: 0, green: 1, stern: 2, strobe: 3, floodL: 4, floodR: 5, strip: 6, cockpit: 12, trunk: 13, podL: 14, podR: 15, umb: 16, bellyF: 17, bellyA: 18 } as const;
  const lamps = new LampSet(L, 'tern_lamps', 19);
  lamps.set(LP.red, 0xff1a0a, 7, 0x3a0805); lamps.set(LP.green, 0x18ff50, 6, 0x07300f); lamps.set(LP.stern, 0xfff2dc, 5, 0x5a5650);
  lamps.set(LP.strobe, 0xffffff, 10, 0x6a6a6a); lamps.set(LP.floodL, 0xe8f0ff, 6, 0x8a8f95); lamps.set(LP.floodR, 0xe8f0ff, 6, 0x8a8f95);
  for (let i = 0; i < 6; i++) lamps.set(LP.strip + i, 0xff7a10, 5, 0x1a1208);
  lamps.set(LP.cockpit, 0x7fc8ff, 1.3, 0x0a1218); lamps.set(LP.trunk, 0xff9a48, 1.3, 0x40281a);
  lamps.set(LP.podL, 0x8fc0ff, 5, 0x10141a); lamps.set(LP.podR, 0x8fc0ff, 5, 0x10141a); lamps.set(LP.umb, 0xff8a14, 5, 0x1a1208);
  lamps.set(LP.bellyF, 0xcfe4ff, 4, 0x50565c); lamps.set(LP.bellyA, 0xcfe4ff, 4, 0x50565c);

  // ── the body (a registered mover that never moves: bullet decals on the plank colliders snap onto the skin)
  const body = L.part('tern_body');
  // pressure hull: nose, cylinder, stern taper, tail
  const prof: [number, number][] = [];
  for (let k = 0; k <= 14; k++) { const z = CUT + (NOSE0 - CUT) * (k / 14); prof.push([ZM + z, hullR(z)]); }
  for (const z of [-3.6, -1.6, 0.4, 2.4, 4.4, ST0]) prof.push([ZM + z, HR]);
  for (let k = 1; k <= 14; k++) { const z = ST0 + (ST1 - ST0) * (k / 14); prof.push([ZM + z, hullR(z)]); }
  prof.push([ZM + 7.85, 0.36], [ZM + 7.98, 0.2], [ZM + 8.0, 0.0]);
  body.geo(hullMat, revolve(prof, 64, X, AY, { vTile: 4 }), 'keep');
  // nose face: annulus round the dome (faces −z) + dome bezel
  body.geo(casMat, revolve([[ZM + CUT, DOME_R + 0.02], [ZM + CUT, rCut + 0.005]], 48, X, AY, { vFromR: true, vTile: 1 }), 'keep');
  zb.torus(steel, X, AY, ZM + CUT - 0.01, DOME_R + 0.03, 0.045, 'z', 40);
  // cockpit seen through the dome: a dark tub, a seat back, a console arc whose screens are lamp `cockpit`
  zb.geo(dark, tubeIn(DOME_R, 0, 0.7, 24), 'box', trs(X, AY, ZM + CUT, PI / 2));
  zb.geo(dark, revolve([[ZM + CUT + 0.7, 0], [ZM + CUT + 0.7, DOME_R + 0.01]], 24, X, AY), 'box');
  zb.box(dark, X, AY - 0.42, ZM + CUT + 0.35, 1.0, 0.3, 0.55);
  zb.box(dark, X, AY + 0.05, ZM + CUT + 0.58, 0.42, 0.55, 0.12);
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.42;
    zb.box(dark, X + Math.sin(a) * 0.5, AY - 0.18, ZM + CUT + 0.18 + (1 - Math.cos(a)) * 0.2, 0.34, 0.22, 0.04);
    lamps.box(body, LP.cockpit, X + Math.sin(a) * 0.5, AY - 0.16, ZM + CUT + 0.155 + (1 - Math.cos(a)) * 0.2, 0.28, 0.16, 0.01);
  }
  lamps.box(body, LP.cockpit, X - 0.32, AY - 0.3, ZM + CUT + 0.08, 0.05, 0.03, 0.01);
  lamps.box(body, LP.strip + 5, X + 0.32, AY - 0.3, ZM + CUT + 0.08, 0.05, 0.03, 0.01);
  // casing deck on top + lifting lugs + vent slots
  const C0 = -5.2, C1 = 2.6;
  body.bx(casMat, X - 0.42, AY + HR - 0.12, ZM + C0, X + 0.42, AY + HR + 0.06, ZM + C1);
  for (const s of [-1, 1]) body.rbox(casMat, X + s * 0.47, AY + HR - 0.05, ZM + (C0 + C1) / 2, 0.1, 0.16, C1 - C0, 0, 0, -s * 0.5);
  body.geo(casMat, new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16, 1, false, 0, PI), 'box', trs(X, AY + HR - 0.03, ZM + C0, 0, PI / 2, 0));
  for (const z of [-4.2, -1.0, 1.6]) {
    for (const s of [-1, 1]) {
      zb.bx(steel, X + s * 0.3 - 0.03, AY + HR + 0.06, ZM + z - 0.09, X + s * 0.3 + 0.03, AY + HR + 0.2, ZM + z + 0.09);
      zb.cyl(steel, X + s * 0.3, AY + HR + 0.17, ZM + z, 0.045, 0.07, 'x', 10);
      mark(body, L, 'lift', W(s * 0.3, AY + HR + 0.062, z + 0.3), UP, new THREE.Vector3(0, 0, -1), 0.26, 0.26);
    }
  }
  mark(body, L, 'nostep', W(0, AY + HR + 0.062, -2.6), UP, new THREE.Vector3(0, 0, -1), 0.55, 0.14);
  for (const z of [-3.6, -0.6, 2.0]) for (const s of [-1, 1]) {
    zb.detail(() => { for (let k = 0; k < 4; k++) zb.bx(dark, X + s * 0.43 - 0.012, AY + HR - 0.02, ZM + z + k * 0.09, X + s * 0.43 + 0.012, AY + HR + 0.01, ZM + z + k * 0.09 + 0.05); });
  }
  // safety track down the casing centre
  zb.bx(steel, X - 0.03, AY + HR + 0.06, ZM + C0 + 0.3, X + 0.03, AY + HR + 0.085, ZM + C1 - 0.2);
  // sail (hatch trunk): stadium planform, rounded forward, tapered aft, a hole for the trunk
  const S = TERN5.sail, SW = S.w / 2, sz0 = S.z0 - ZM, sz1 = S.z1 - ZM, hz = TERN5.hatch.z - ZM;
  {
    const sh = new THREE.Shape();
    // planform in (x, −z) → extruded along +y after rotation: shape y = −z(local)
    const zf = sz0 + SW; // centre of the forward semicircle
    sh.moveTo(SW, -zf);
    sh.absarc(0, -zf, SW, 0, PI, false);
    sh.lineTo(-SW, -(sz1 - 0.9));
    sh.lineTo(-0.08, -sz1);
    sh.lineTo(0.08, -sz1);
    sh.lineTo(SW, -(sz1 - 0.9));
    sh.lineTo(SW, -zf);
    const hole = new THREE.Path(); hole.absarc(0, -hz, TERN5.hatch.r, 0, TAU, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: S.top - S.y0 - 0.04, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2, curveSegments: 20 });
    // shape xy → world: x = x, z(local) = −y, extrude +z → +y  (rotate −90° about x)
    body.geo(casMat, g, 'box', trs(X, S.y0, ZM, -PI / 2));
    // the fairing: a wide, low, well-rounded collar the sail grows out of (blends sail and casing into one shape)
    const fw = SW + 0.32, fz0 = sz0 - 0.55, fz1 = sz1 + 0.5, fzc = fz0 + fw;
    const fs = new THREE.Shape();
    fs.moveTo(fw, -fzc); fs.absarc(0, -fzc, fw, 0, PI, false);
    fs.lineTo(-fw, -(fz1 - 1.3)); fs.lineTo(-0.1, -fz1); fs.lineTo(0.1, -fz1); fs.lineTo(fw, -(fz1 - 1.3)); fs.lineTo(fw, -fzc);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.3, bevelSegments: 4, curveSegments: 20 });
    body.geo(casMat, fg, 'box', trs(X, 3.38, ZM, -PI / 2));
  }
  // trunk interior: rungs, a lower hatch ring, the warm lit shaft (lamp `trunk`)
  for (let k = 0; k < 3; k++) zb.rod(steel, X - 0.16, 3.85 + k * 0.2, ZM + hz + TERN5.hatch.r - 0.05, X + 0.16, 3.85 + k * 0.2, ZM + hz + TERN5.hatch.r - 0.05, 0.015, 6);
  zb.torus(steel, X, 3.7, ZM + hz, TERN5.hatch.r - 0.04, 0.035, 'y', 20);
  lamps.disc(body, LP.trunk, X, 3.66, ZM + hz, TERN5.hatch.r - 0.02, 0.02, 0, 0, 0);
  mark(body, L, 'hatchring', W(0, S.top + 0.002, hz), UP, new THREE.Vector3(0, 0, -1), 0.92, 0.92);
  // sail fittings: nav lights (red port −x, green starboard +x) on the sides near the top of the forward round
  const zf = sz0 + SW;
  for (const s of [-1, 1]) {
    zb.bx(dark, X + s * (SW + 0.005), 4.22, ZM + zf - 0.12, X + s * (SW + 0.07), 4.4, ZM + zf + 0.12);
    lamps.hemi(body, s < 0 ? LP.red : LP.green, X + s * (SW + 0.07), 4.31, ZM + zf, 0.065, 0, 0, -s * PI / 2);
    // status strip: 6 LEDs on each straight side
    zb.bx(dark, X + s * (SW + 0.002), 3.72, ZM + zf + 0.62, X + s * (SW + 0.02), 3.84, ZM + zf + 1.12);
    for (let i = 0; i < 6; i++) lamps.box(body, LP.strip + i, X + s * (SW + 0.024), 3.78, ZM + zf + 0.67 + i * 0.09, 0.008, 0.035, 0.05);
    // hull number + rescue arrow + step rungs
    mark(body, L, 'n07', W(s * (SW + 0.006), 4.1, zf + 0.25), new THREE.Vector3(s, 0, 0), UP, 0.5, 0.5);
    mark(body, L, 'rescue', W(s * (SW + 0.006), 3.68, zf + 0.05), new THREE.Vector3(s, 0, 0), UP, 0.22, 0.22);
  }
  for (let k = 0; k < 3; k++) zb.bx(steel, X - SW - 0.05, 3.75 + k * 0.24, ZM + zf - 0.35 - 0.11, X - SW - 0.02, 3.77 + k * 0.24, ZM + zf - 0.35 + 0.11);
  // stern light + strobe aft on top (in a little guard), the whip mast's housing
  zb.bx(dark, X - 0.07, S.top, ZM + sz1 - 0.55, X + 0.07, S.top + 0.06, ZM + sz1 - 0.33);
  lamps.sphere(body, LP.stern, X, S.top + 0.105, ZM + sz1 - 0.44, 0.05);
  zb.cyl(dark, X, S.top + 0.03, ZM + sz1 - 1.05, 0.06, 0.06, 'y', 12);
  lamps.sphere(body, LP.strobe, X, S.top + 0.1, ZM + sz1 - 1.05, 0.045, 1.4);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; zb.rod(steel, X + Math.cos(a) * 0.06, S.top + 0.05, ZM + sz1 - 1.05 + Math.sin(a) * 0.06, X + Math.cos(a) * 0.06, S.top + 0.16, ZM + sz1 - 1.05 + Math.sin(a) * 0.06, 0.006, 4); }
  zb.cyl(dark, X + 0.25, S.top + 0.025, ZM + sz1 - 0.95, 0.05, 0.05, 'y', 10);
  // dome port glass (transparent)
  const glass = mat5(L, 'sp5_tern_dome', () => new THREE.MeshStandardMaterial({ name: 'tern_dome', color: 0x9db6c4, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 2.2 }));
  {
    const g = new THREE.SphereGeometry(DOME_R, 32, 12, 0, TAU, 0, PI / 2);
    body.geo(glass, g, 'keep', trs(X, AY, ZM + CUT, -PI / 2));
  }
  // bow floodlights (pointing −z), tunnel-thruster grilles, draught marks
  const floodPts: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    const z = -6.75, r = hullR(z), a = s * 0.72;
    const px = Math.sin(a) * (r + 0.02), py = AY + Math.cos(a) * (r + 0.02);
    zb.cyl(dark, X + px, py, ZM + z, 0.13, 0.2, 'z', 16);
    zb.torus(steel, X + px, py, ZM + z - 0.1, 0.13, 0.015, 'z', 16);
    lamps.disc(body, s < 0 ? LP.floodL : LP.floodR, X + px, py, ZM + z - 0.105, 0.11, 0.01, PI / 2, 0, 0);
    floodPts.push(W(px, py, z - 0.12));
    // bow tunnel thruster grille (dark disc + bars) low on the nose
    const zt = -6.2, rt = hullR(zt), at = s * 1.75;
    const tx = Math.sin(at) * rt, ty = AY + Math.cos(at) * rt;
    zb.geo(dark, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), 'box', trs(X + tx, ty, ZM + zt, 0, 0, -at));
    for (let k = -2; k <= 2; k++) zb.rod(steel, X + tx, ty + k * 0.07, ZM + zt - 0.19, X + tx, ty + k * 0.07, ZM + zt + 0.19, 0.008, 4);
    mark(body, L, 'thruster', W(Math.sin(at) * (rt + 0.003), AY + Math.cos(at) * (rt + 0.003) + 0.32, zt), new THREE.Vector3(Math.sin(at), Math.cos(at), 0), UP, 0.6, 0.15);
    // draught marks fore and aft
    for (const zd of [-5.0, 4.6]) {
      const ad = s * 2.0, rd = hullR(zd);
      mark(body, L, 'draught', W(Math.sin(ad) * rd, AY + Math.cos(ad) * rd, zd), new THREE.Vector3(Math.sin(ad), Math.cos(ad), 0), new THREE.Vector3(0, 1, 0), 0.16, 0.32);
    }
    // name + number on the upper flank
    const an = s * 0.95;
    const nrm = new THREE.Vector3(Math.sin(an), Math.cos(an), 0);
    // "up" on the flank = the tangent toward the top of the hull: (−s·cos|a|, sin|a|)
    const upOn = (a: number) => new THREE.Vector3(-s * Math.cos(Math.abs(a)), Math.sin(Math.abs(a)), 0);
    mark(body, L, 'tern', W(Math.sin(an) * (HR + 0.002), AY + Math.cos(an) * (HR + 0.002), -1.4), nrm, upOn(an), 1.3, 0.32);
    const an2 = s * 1.2;
    mark(body, L, 'sdv', W(Math.sin(an2) * (HR + 0.002), AY + Math.cos(an2) * (HR + 0.002), -1.4), new THREE.Vector3(Math.sin(an2), Math.cos(an2), 0), upOn(an2), 1.5, 0.09);
    // vent label over the ballast blow vents
    mark(body, L, 'vent', W(s * 0.47, AY + HR - 0.05, -0.2), new THREE.Vector3(s, 0.6, 0).normalize(), new THREE.Vector3(0, 0, -1), 0.5, 0.12);
  }
  // side ballast tanks (antifouling band of the hull texture)
  const TX = 1.34, TY = 1.12, TR = 0.3, T0 = -3.4, T1 = 3.4;
  for (const s of [-1, 1]) {
    const tp: [number, number][] = [];
    for (let k = 0; k <= 6; k++) { const a = (k / 6) * (PI / 2); tp.push([ZM + T0 - Math.cos(a) * TR * 0.9, Math.sin(a) * TR]); }
    tp.push([ZM + T1, TR]);
    for (let k = 1; k <= 6; k++) { const a = (k / 6) * (PI / 2); tp.push([ZM + T1 + Math.sin(a) * TR * 0.9, Math.cos(a) * TR]); }
    body.geo(hullMat, revolve(tp, 24, X + s * TX, TY, { u0: 0.4, uSpan: 0.2, vTile: 4 }), 'keep');
    for (const z of [-2.5, 0, 2.5]) zb.torus(steel, X + s * TX, TY, ZM + z, TR + 0.012, 0.02, 'z', 20);
  }
  // keel strip + sacrificial anodes
  zb.bx(steel, X - 0.06, AY - HR - 0.005, ZM - 5.2, X + 0.06, AY - HR + 0.06, ZM + 4.6);
  for (const z of [-4.5, -1.5, 1.5]) for (const s of [-1, 1]) {
    const a = s * 2.55;
    zb.box(steel, X + Math.sin(a) * (HR + 0.02), AY + Math.cos(a) * (HR + 0.02), ZM + z, 0.12, 0.06, 0.34);
  }
  // belly work lights on the lower flanks (light the cradle in the dark: self-light), fore and aft, both sides
  const BELLY: [number, number, number][] = [];
  for (const [z, li] of [[-2.2, LP.bellyF], [1.2, LP.bellyA]] as const) for (const s of [-1, 1]) {
    const a = s * 2.35, r = HR + 0.03;
    const px = Math.sin(a) * r, py = AY + Math.cos(a) * r;
    zb.box(dark, X + px, py, ZM + z, 0.16, 0.08, 0.26);
    lamps.box(body, li, X + px, py - 0.045, ZM + z, 0.12, 0.012, 0.2);
    BELLY.push([X + px, py - 0.06, ZM + z]);
  }
  // X-tail: four fins into the duct ring (static), duct ring
  const PS = [PI / 4, (3 * PI) / 4, (5 * PI) / 4, (7 * PI) / 4];
  for (const ps of PS) {
    body.rbox(casMat, X + Math.sin(ps) * 0.76, AY + Math.cos(ps) * 0.76, ZM + 6.6, 0.055, 0.7, 0.8, 0, 0, -ps);
  }
  const DZ0 = 6.9, DZ1 = 7.75, DRI = 1.0, DRO = 1.11;
  body.geo(casMat, revolve([[ZM + DZ0, DRO], [ZM + DZ1, DRO]], 48, X, AY, { vTile: 1 }), 'keep');
  body.geo(casMat, revolve([[ZM + DZ1, DRI], [ZM + DZ0, DRI]], 48, X, AY, { vTile: 1 }), 'keep');
  body.geo(casMat, revolve([[ZM + DZ0, DRI], [ZM + DZ0 - 0.03, (DRI + DRO) / 2], [ZM + DZ0, DRO]], 48, X, AY, { vTile: 1 }), 'keep');
  body.geo(casMat, revolve([[ZM + DZ1, DRO], [ZM + DZ1, DRI]], 48, X, AY, { vTile: 1 }), 'keep');
  // stator vanes behind the prop
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; zb.rbox(steel, X + Math.sin(a) * 0.68, AY + Math.cos(a) * 0.68, ZM + 7.68, 0.03, 0.62, 0.1, 0, 0, -a); }
  // pod sponsons (static) — the pods themselves are skinned
  const PODZ = 4.2, PODX = 1.92, PODY = 1.98;
  for (const s of [-1, 1]) {
    zb.rbox(steel, X + s * 1.66, PODY + 0.42, ZM + PODZ, 0.62, 0.1, 0.28, 0, 0, 0);
    mark(body, L, 'thruster', W(s * 1.47, 1.75, PODZ), new THREE.Vector3(s, -0.3, 0).normalize(), UP, 0.55, 0.14);
  }
  // umbilical (shore power) from the port flank to the deck box
  let umbTop: THREE.Vector3 | null = null;
  if (o.umbilical !== false) {
    const [ex, ey, ez] = o.umbilical ?? [31.62, 1.08, -32.0];
    const a = -1.92, z = -2.8; const hx = Math.sin(a) * (HR + 0.03), hy = AY + Math.cos(a) * (HR + 0.03);
    zb.cyl(dark, X + hx - 0.06, hy, ZM + z, 0.11, 0.16, 'x', 14);
    lamps.box(body, LP.umb, X + hx - 0.06, hy + 0.12, ZM + z, 0.03, 0.02, 0.03);
    umbTop = W(hx - 0.06, hy + 0.13, z);
    let px = X + hx - 0.14, py = hy, pz = ZM + z;
    const N = 9;
    for (let k = 1; k <= N; k++) {
      const u = k / N;
      const qx = X + hx - 0.14 + (ex - (X + hx - 0.14)) * u, qz = ZM + z + (ez - (ZM + z)) * u;
      const qy = hy + (ey - hy) * u - Math.sin(PI * u) * 0.35;
      zb.rod('rubber', px, py, pz, qx, qy, qz, 0.045, 8);
      px = qx; py = qy; pz = qz;
    }
    zb.cyl(dark, ex, ey + 0.05, ez, 0.08, 0.1, 'y', 12);
    mark(body, L, 'shore', W(hx - 0.02, hy - 0.22, z), new THREE.Vector3(Math.sin(a), Math.cos(a), 0), UP, 0.5, 0.12);
  }
  const bodyG = body.build();
  bodyG.name = 'tern_body';
  bodyG.userData.rooms = rooms.slice();
  L.root.add(bodyG);
  L.ctx.physics?.addMover?.(bodyG);

  // ── cradle (self-lit yellow `tern_cradle`, in the zone builder): girders over the rails, cross beams, saddles, posts, bogies; draw-bar
  const CR = TERN5.cradle;
  for (const rx of TERN5.rails.x) {
    zb.bx(yellow, rx - 0.14, 0.32, CR.z0, rx + 0.14, 0.6, CR.z1);           // girder (box section)
    zb.bx(yellow, rx - 0.2, 0.3, CR.z0, rx + 0.2, 0.34, CR.z1);
    zb.bx(yellow, rx - 0.2, 0.58, CR.z0, rx + 0.2, 0.62, CR.z1);
    for (const z of [CR.z0 + 0.8, CR.z0 + 5.4, CR.z1 - 5.4, CR.z1 - 0.8]) {
      zb.bx(steel, rx - 0.17, 0.2, z - 0.45, rx + 0.17, 0.33, z + 0.45);    // bogie frame
      for (const dz of [-0.3, 0.3]) zb.cyl(steel, rx, 0.27, z + dz, 0.12, 0.1, 'x', 16);
    }
  }
  for (const zs of CR.saddles) {
    const lz = zs - ZM, r = hullR(lz), yb = AY - r;
    zb.bx(yellow, CR.x0, 0.3, zs - 0.2, CR.x1, 0.6, zs + 0.2);               // cross beam
    // saddle cup: a crescent block following the hull, rubber-lined
    const sh = new THREE.Shape();
    const half = 1.05, n = 16;
    sh.moveTo(-half, 0.58);
    sh.lineTo(half, 0.58);
    for (let k = 0; k <= n; k++) { const xx = half - (2 * half * k) / n; const yy = AY - Math.sqrt(Math.max(0, (r + 0.03) ** 2 - xx * xx)); sh.lineTo(xx, Math.max(0.6, yy)); }
    sh.lineTo(-half, 0.58);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false, curveSegments: 4 });
    zb.geo(yellow, g, 'box', trs(X, 0, zs - 0.18));
    for (let k = 0; k < n; k++) {
      const xa = half - (2 * half * k) / n, xb2 = half - (2 * half * (k + 1)) / n;
      const ya = AY - Math.sqrt(Math.max(0, (r + 0.01) ** 2 - xa * xa)), yb2 = AY - Math.sqrt(Math.max(0, (r + 0.01) ** 2 - xb2 * xb2));
      if (Math.max(ya, yb2) < 0.6) continue;
      zb.rod('rubber', X + xa, Math.max(0.6, ya), zs, X + xb2, Math.max(0.6, yb2), zs, 0.03, 6);
    }
    void yb;
    for (const s of [-1, 1]) {
      zb.bx(yellow, X + s * 1.98 - 0.11, 0.6, zs - 0.16, X + s * 1.98 + 0.11, 1.55, zs + 0.16);     // post
      zb.cyl(steel, X + s * 1.98, 1.62, zs, 0.1, 0.36, 'z', 14);                                // hinge drum
      zb.cyl(dark, X + s * 1.98, 1.62, zs, 0.06, 0.38, 'z', 10);
      // hydraulic ram housing (static) up the post's outer face
      zb.cyl(steel, X + s * 2.12, 1.0, zs, 0.05, 0.7, 'y', 10);
    }
  }
  // draw-bar + winch cable toward the lock sill (it says: this goes in there)
  zb.bx(yellow, X - 0.12, 0.36, CR.z0 - 0.9, X + 0.12, 0.54, CR.z0);
  zb.cyl(steel, X, 0.45, CR.z0 - 0.98, 0.1, 0.12, 'y', 14);
  zb.rod(steel, X, 0.45, CR.z0 - 1.0, X, 0.08, TERN5.rails.z0 + 0.4, 0.012, 5);
  // buffer stops at the north end of the rails
  for (const rx of TERN5.rails.x) { zb.bx(yellow, rx - 0.22, 0, TERN5.rails.z1 - 0.1, rx + 0.22, 0.45, TERN5.rails.z1 + 0.25); zb.bx('hazard_stripes', rx - 0.221, 0.2, TERN5.rails.z1 - 0.101, rx + 0.221, 0.34, TERN5.rails.z1 + 0.251); }
  // rails (steel, 0.15 high, walkable): base, web, head; clips every 1.5 m
  if (o.rails !== false) {
    const R5 = TERN5.rails;
    for (const rx of R5.x) {
      zb.bx(steel, rx - 0.1, 0, R5.z0, rx + 0.1, 0.03, R5.z1);
      zb.bx(steel, rx - 0.022, 0.03, R5.z0, rx + 0.022, 0.12, R5.z1);
      zb.bx(steel, rx - 0.04, 0.12, R5.z0, rx + 0.04, 0.15, R5.z1);
      zb.detail(() => { for (let z = R5.z0 + 0.5; z < R5.z1; z += 1.5) zb.bx(dark, rx - 0.15, 0, z - 0.06, rx + 0.15, 0.045, z + 0.06); });
      zb.collide(rx - 0.1, 0, R5.z0, rx + 0.1, 0.15, R5.z1, 'metal', false);
    }
  }

  // ── colliders: cradle, hull planks (16-gon, circumscribed), sail, tanks
  zb.collide(CR.x0, 0, CR.z0, CR.x1, 0.6, CR.z1, 'metal', true);
  {
    const N = 16, secs: [number, number][] = [[CUT, -6.9], [-6.9, -6.3], [-6.3, NOSE0], [NOSE0, ST0], [ST0, 5.9], [5.9, 6.8], [6.8, ST1]];
    for (const [za, zz] of secs) {
      const rr = Math.max(hullR(za), hullR(zz)) / Math.cos(PI / N);
      const side = 2 * rr * Math.tan(PI / N);
      for (let k = 0; k < N; k++) {
        const a = ((k + 0.5) / N) * TAU;
        const m = trs(X + Math.sin(a) * (rr * Math.cos(PI / N) - 0.05), AY + Math.cos(a) * (rr * Math.cos(PI / N) - 0.05), ZM + (za + zz) / 2, 0, 0, -a, side, 0.1, zz - za);
        L.addCollider(m, 'metal', true);
      }
    }
    zb.collide(X - SW, S.y0, S.z0, X + SW, S.top, S.z1, 'metal', true);
    for (const s of [-1, 1]) zb.collide(X + s * TX - TR, TY - TR, ZM + T0 - 0.25, X + s * TX + TR, TY + TR, ZM + T1 + 0.25, 'metal', true);
  }

  // ── skinned moving parts: pods (yaw) + props, main prop, tail flaps (2 pairs), whip mast, 10 clamp arms
  const rig = new THREE.Group(); rig.name = 'tern'; rig.userData.rooms = rooms.slice();
  L.root.add(rig);
  const boneNames = ['root', 'podL', 'podR', 'propL', 'propR', 'prop', 'flapA', 'flapB', 'mast',
    ...CR.saddles.flatMap((_, i) => [`clampL${i}`, `clampR${i}`])] as const;
  const B: Record<string, THREE.Bone> = {};
  for (const n of boneNames) { const b = new THREE.Bone(); b.name = `tern_${n}`; B[n] = b; }
  rig.add(B.root);
  for (const n of boneNames) if (n !== 'root' && !n.startsWith('prop')) B.root.add(B[n]);
  B.podL.add(B.propL); B.podR.add(B.propR); B.root.add(B.prop);
  B.podL.position.set(X - PODX, PODY, ZM + PODZ); B.podR.position.set(X + PODX, PODY, ZM + PODZ);
  B.propL.position.set(0, 0, 0.42); B.propR.position.set(0, 0, 0.42);
  B.prop.position.set(X, AY, ZM + 7.45);
  B.flapA.position.set(X, AY, ZM + 7.0); B.flapB.position.set(X, AY, ZM + 7.0);
  B.mast.position.set(X + 0.25, S.top, ZM + sz1 - 0.95);
  CR.saddles.forEach((zs, i) => { B[`clampL${i}`].position.set(X - 1.98, 1.62, zs); B[`clampR${i}`].position.set(X + 1.98, 1.62, zs); });
  const bones = boneNames.map((n) => B[n]);
  rig.updateMatrixWorld(true);
  const parts: { b: Builder; bone: number }[] = [];
  const part = (bone: (typeof boneNames)[number], fn: (b: Builder) => void) => { const b = L.part(`tern_${bone}`); fn(b); parts.push({ b, bone: boneNames.indexOf(bone) }); };
  for (const side of ['podL', 'podR'] as const) {
    part(side, (b) => {
      b.cyl(steel, 0, 0.29, 0, 0.05, 0.2, 'y', 10);                   // stem up to the sponson
      b.geo(casMat, revolve([[-0.42, 0], [-0.38, 0.1], [-0.3, 0.17], [-0.1, 0.2], [0.2, 0.2], [0.36, 0.14], [0.42, 0.06], [0.44, 0]], 18, 0, 0, { vTile: 1 }), 'keep');
      b.geo(casMat, revolve([[0.22, 0.29], [0.56, 0.29]], 24, 0, 0, { vTile: 1 }), 'keep');
      b.geo(casMat, revolve([[0.56, 0.26], [0.22, 0.26]], 24, 0, 0, { vTile: 1 }), 'keep');
      b.geo(casMat, revolve([[0.22, 0.26], [0.2, 0.275], [0.22, 0.29]], 24, 0, 0, { vTile: 1 }), 'keep');
      for (const a of [0, PI / 2, PI, PI * 1.5]) b.rbox(casMat, Math.sin(a) * 0.235, Math.cos(a) * 0.235, 0.32, 0.02, 0.09, 0.14, 0, 0, -a);
    });
  }
  // pod ready-LEDs ride the pods (static lamp geometry on the sponson underside instead: they must not cost a skinned lamp call)
  for (const s of [-1, 1]) lamps.box(body, s < 0 ? LP.podL : LP.podR, X + s * 1.85, PODY + 0.36, ZM + PODZ - 0.15, 0.03, 0.012, 0.03);
  for (const side of ['propL', 'propR'] as const) {
    part(side, (b) => {
      b.cyl(steel, 0, 0, 0, 0.06, 0.08, 'z', 10);
      for (let k = 0; k < 4; k++) blade(b, steel, (k / 4) * TAU, 0.14, 0.2, 0.07, 0.012, 0.6);
    });
  }
  part('prop', (b) => {
    b.cyl(steel, 0, 0, 0, 0.2, 0.3, 'z', 16);
    b.sphere(steel, 0, 0, 0.15, 0.2, 14, 1, 1, 0.8);
    for (let k = 0; k < 5; k++) blade(b, steel, (k / 5) * TAU, 0.58, 0.8, 0.26, 0.025, 0.55);
  });
  for (const [bn, pair] of [['flapA', [PS[0], PS[2]]], ['flapB', [PS[1], PS[3]]]] as const) {
    part(bn, (b) => { for (const ps of pair) b.rbox(casMat, Math.sin(ps) * 0.74, Math.cos(ps) * 0.74, 0.15, 0.045, 0.52, 0.3, 0, 0, -ps); });
  }
  part('mast', (b) => {
    b.cyl(casMat, 0, 0.0, 0, 0.022, 0.9, 'y', 8);
    b.cyl(casMat, 0, 0.47, 0, 0.035, 0.06, 'y', 8);
    b.cyl(steel, 0, 0.48, 0, 0.008, 0.5, 'y', 4);
  });
  CR.saddles.forEach((zs, i) => {
    const r = hullR(zs - ZM);
    for (const s of [-1, 1]) {
      const bn = (s < 0 ? `clampL${i}` : `clampR${i}`) as (typeof boneNames)[number];
      // pad target on the hull 58° off the top, minus the pad's thickness
      const ta = 1.22, tx = s * (Math.sin(ta) * (r + 0.07)) - s * 1.98, ty = AY + Math.cos(ta) * (r + 0.07) - 1.62;
      const ex = s * 0.06, ey = ty + 0.22;
      part(bn, (b) => {
        b.rod(yelMat, 0, 0, 0, ex, ey, 0, 0.085, 10);
        b.rod(yelMat, ex, ey, 0, tx + s * 0.04, ty, 0, 0.075, 10);
        b.sphere(yelMat, ex, ey, 0, 0.095, 10);
        b.box(yelMat, ex * 0.5, ey * 0.5, 0, 0.06, ey * 0.8, 0.22);
        b.cyl(yelMat, 0, 0, 0, 0.09, 0.2, 'z', 12);
        // pad: a block whose face sits on the hull, normal toward the axis
        const ang = Math.atan2(ty + 1.62 - AY, tx + s * 1.98) - PI / 2;
        b.rbox(yelMat, tx, ty, 0, 0.24, 0.05, 0.3, 0, 0, ang);
      });
    }
  });
  const meshes = skinParts(rig, bones, parts, () => true, new THREE.Vector3(X, 2.4, ZM), 9.5);
  for (const m of meshes) { m.frustumCulled = true; m.userData.rooms = rooms.slice(); }

  // ── hatch lid (registered mover): disc, rim, dog handwheel (its own pivot), hinge knuckles aft
  const H = TERN5.hatch;
  const hingeZ = H.z + H.r + 0.04;
  const lid = movingGroup(L, 'tern_hatch', rooms, (p) => {
    // authored relative to the hinge axis (y 0 = sail top, z 0 = hinge line; the lid extends to −z)
    p.cyl(casMat, 0, 0.04, -(H.r + 0.04), H.r + 0.04, 0.08, 'y', 28);
    p.torus(casMat, 0, 0.085, -(H.r + 0.04), H.r - 0.02, 0.018, 'y', 28);
    for (const x of [-0.2, 0.2]) p.cyl(casMat, x, 0.03, 0, 0.04, 0.14, 'x', 10);
  });
  lid.mount.position.set(X, H.y, hingeZ);
  const dogG = movingGroup(L, 'tern_hatch_dog', rooms, (p) => {
    p.push(0, 0, 0, 0, -PI / 2); handwheel(p, steel, 0.17, 0.016, 4, false); p.pop();
    p.cyl(steel, 0, -0.02, 0, 0.03, 0.06, 'y', 8);
  }, false);
  lid.pivot.add(dogG.mount);
  L.root.remove(dogG.mount);
  dogG.mount.position.set(0, 0.13, -(H.r + 0.04));
  zb.bx(steel, X - 0.28, S.top - 0.01, hingeZ - 0.05, X + 0.28, S.top + 0.05, hingeZ + 0.06);

  // ── real lights: interior glow (in the trunk, medium+), bow flood spot (medium+, non-shadow)
  const glow: LightHandle = L.point(lightGroup, X, H.y - 0.5, H.z, 0xff9a50, 1.0, 2.6, { enabled: false, priority: 0.55 });
  glow.desc.minQuality = 'medium';
  let flood: LightHandle | null = null;
  if (o.floodSpot !== false) {
    flood = L.spot(lightGroup, X, AY + 0.7, ZM + CUT - 0.3, X, 1.6, -55.8, 0xe8f0ff, 22, 16, 0.42, { enabled: false, priority: 0.6, penumbra: 0.5 });
    flood.desc.minQuality = 'medium';
  }

  // ── halos
  const sp = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  if (o.halos !== false) {
    lamps.halo(LP.red, sp(X - SW - 0.16, 4.31, ZM + zf), 0.36, 9);
    lamps.halo(LP.green, sp(X + SW + 0.16, 4.31, ZM + zf), 0.36, 9);
    lamps.halo(LP.stern, sp(X, S.top + 0.12, ZM + sz1 - 0.44), 0.3, 7);
    lamps.halo(LP.strobe, sp(X, S.top + 0.12, ZM + sz1 - 1.05), 0.45, 9);
    floodPts.forEach((p, k) => lamps.halo(k ? LP.floodR : LP.floodL, p.clone().add(sp(0, 0, -0.05)), 0.9, 7));
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) lamps.halo(LP.strip + i, sp(X + s * (SW + 0.05), 3.78, ZM + zf + 0.67 + i * 0.09), 0.08, 3);
    for (const s of [-1, 1]) lamps.halo(s < 0 ? LP.podL : LP.podR, sp(X + s * 1.85, PODY + 0.34, ZM + PODZ - 0.15), 0.1, 2.5);
    if (umbTop) lamps.halo(LP.umb, umbTop, 0.1, 2.5);
    lamps.finish(rooms);
  }

  // ── self-light sources (world): red, green, stern, strobe, flood L, flood R, trunk, strip
  const SRC: [number, THREE.Vector3, number, number][] = [
    [LP.red, sp(X - SW - 0.2, 4.31, ZM + zf), 1.1, 0.06],
    [LP.green, sp(X + SW + 0.2, 4.31, ZM + zf), 1.1, 0.06],
    [LP.stern, sp(X, S.top + 0.25, ZM + sz1 - 0.44), 1.4, 0.12],
    [LP.strobe, sp(X, S.top + 0.3, ZM + sz1 - 1.05), 2.6, 0.15],
    [LP.floodL, floodPts[0].clone().add(sp(0, 0.1, -0.3)), 0.8, 0.05],
    [LP.floodR, floodPts[1].clone().add(sp(0, 0.1, -0.3)), 0.8, 0.05],
    [LP.trunk, sp(X, H.y + 0.05, H.z), 0.5, 0.05],
    [LP.strip + 2, sp(X, 3.9, ZM + zf + 0.9), 0.9, 0.06],
    ...BELLY.map(([x, y, z], k) => [k < 2 ? LP.bellyF : LP.bellyA, sp(x + (x < X ? -0.25 : 0.25), y - 0.3, z), 1.4, 0.16] as [number, THREE.Vector3, number, number]),
  ];
  SRC.forEach(([, p, R], k) => self.pos[k].set(p.x, p.y, p.z, R));

  // ── the sequence
  const vents: { p: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  for (const z of [-3.6, -0.6, 2.0]) for (const s of [-1, 1]) vents.push({ p: W(s * 0.45, AY + HR + 0.02, z + 0.15), dir: new THREE.Vector3(s * 0.5, 1, 0).normalize() });
  for (const s of [-1, 1]) vents.push({ p: W(s * (TX + TR * 0.8), TY + TR * 0.6, 0), dir: new THREE.Vector3(s, 0.4, 0).normalize() });
  const drips: THREE.Vector3[] = [];
  for (const z of [-6.5, -4.0, -1.2, 1.8, 4.6, 6.4]) drips.push(W(0, AY - hullR(z) - 0.02, z));
  for (const s of [-1, 1]) drips.push(W(s * TX, TY - TR - 0.02, -1.5), W(s * TX, TY - TR - 0.02, 2.2));
  const soundPoints = { hull: W(0, AY, 0), ballast: W(0, AY + HR, -0.6), hatch: W(0, H.y, H.z - ZM), cradle: W(0, 0.8, 0) };

  const C = TERN_CUES;
  const seq: TernSeq = { t: o.state === 'complete' ? TERN_CHECK_LEN : -1, running: false, cue: o.state === 'complete' ? 'complete' : 'rest', state: o.state === 'complete' ? 'complete' : 'rest', duration: TERN_CHECK_LEN };
  const cbs: ((cue: TernCue, s: TernSeq) => void)[] = [];
  const cueList = (Object.keys(C) as TernCue[]).sort((a, b) => C[a] - C[b]);
  let powered = true, clock = 0;
  let overClamp: number | null = null, overHatch: number | null = null, overDog: number | null = null;

  const flick = (t: number, a: number, dur: number) => { // a short strike flicker from a, then steady
    if (t < a) return 0;
    if (t > a + dur) return 1;
    const u = (t - a) / dur;
    return (Math.sin(u * 61.0) > 0.2 - u ? 1 : 0.15) * (0.4 + 0.6 * u);
  };
  const clampK = (i: number, t: number) => {
    const a = C.clamps + i * 0.16, b = C.clamps_home - 1.0 + i * 0.16;
    if (t < a) return 0;
    if (t < a + 1.0) return minJerk((t - a) / 1.0);
    if (t < b) return 1;
    const u = (t - b) / 1.0;
    return u >= 1 ? 0 : 1 - minJerk(u);
  };
  const hatchK = (t: number) => {
    if (t < C.hatch_open) return 0;
    if (t < C.clang) { const u = (t - C.hatch_open) / (C.clang - C.hatch_open); return u * u * (1.6 - 0.6 * u); } // heavy lid: slow off the seat, falling open
    if (t < C.clang + 0.35) { const u = (t - C.clang) / 0.35; return 1 - Math.sin(u * PI) * 0.06 * (1 - u); } // bounce off the stop
    if (t < C.hatch_shut) return 1;
    if (t < C.latch) return 1 - minJerk((t - C.hatch_shut) / (C.latch - C.hatch_shut));
    return 0;
  };
  const dogK = (t: number) => {
    if (t < C.dog) return 0;
    if (t < C.dog + 1.2) return minJerk((t - C.dog) / 1.2);
    if (t < C.latch + 0.1) return 1;
    return 1 - minJerk((t - C.latch - 0.1) / 0.9);
  };
  const strobeOn = () => ((clock % 1.0) < 0.07 ? 1 : 0) + ((clock % 1.0) > 0.16 && (clock % 1.0) < 0.2 ? 0.6 : 0);

  const pose = (tt: number) => {
    const t = tt < 0 ? -1 : tt;
    const rest = t < 0, done = t >= C.complete;
    // lamps
    const lv = lamps.level;
    const nav = (a: number) => rest ? 0.22 : t < a ? 0.22 : t < a + 0.18 ? (Math.sin((t - a) * 90) > 0 ? 1 : 0.22) : 1;
    lv[LP.red] = nav(C.lights); lv[LP.green] = nav(C.lights + 0.3); lv[LP.stern] = nav(C.lights + 0.6);
    lv[LP.strobe] = !rest && t >= C.lights + 0.9 ? strobeOn() : 0;
    const fl = rest ? 0 : t < C.complete ? flick(t, C.floods, 0.3) * (0.55 + 0.45 * ramp(t, C.floods + 0.3, C.floods + 0.7)) : 1 - ramp(t, C.complete, C.complete + 0.35);
    lv[LP.floodL] = fl; lv[LP.floodR] = rest ? 0 : t < C.complete ? flick(t, C.floods + 0.12, 0.34) * (0.55 + 0.45 * ramp(t, C.floods + 0.4, C.floods + 0.8)) : lv[LP.floodL];
    for (let i = 0; i < 6; i++) {
      const on = !rest && t >= 0.3 + i * 0.22;
      const green = !rest && t >= C.complete + 0.1 + i * 0.09;
      lv[LP.strip + i] = on ? 1 : 0;
      lamps.color[LP.strip + i].set(green ? 0.12 : 1, green ? 1 : 0.42, green ? 0.28 : 0.05);
    }
    lv[LP.cockpit] = rest ? 0 : flick(t, 0.2, 0.6) * ramp(t, 0.2, 1.0);
    const gk = rest ? 0 : t < C.hatch_shut ? ramp(t, C.hatch_open + 0.4, C.clang + 0.4) : 1 - ramp(t, C.hatch_shut + 0.2, C.latch);
    lv[LP.trunk] = gk;
    lv[LP.podL] = lv[LP.podR] = rest ? 0 : t >= C.lights + 1.1 ? (done ? 0.5 : 1) : 0;
    lv[LP.umb] = 1;
    lv[LP.bellyF] = rest ? 0 : flick(t, C.lights + 1.3, 0.25) * (done ? 0.7 : 1);
    lv[LP.bellyA] = rest ? 0 : flick(t, C.lights + 1.45, 0.25) * (done ? 0.7 : 1);
    lamps.color[LP.umb].set(done ? 0.12 : 1, done ? 1 : 0.5, done ? 0.28 : 0.06);
    glow.enabled = gk > 0.01 && powered;
    glow.intensityScale = gk;
    if (flood) { flood.enabled = fl > 0.01 && powered; flood.intensityScale = fl; }
    // self-light colours follow the lamps
    SRC.forEach(([i, , , k], s) => self.col[s].copy(lamps.color[i]).multiplyScalar(Math.max(0, lv[i]) * lamps.gain[i] * k * lamps.power));
    // moving parts
    const tq = rest ? -1 : t;
    const yawL = track([[C.thrusters, 0], [C.thrusters + 0.6, 0.21], [C.thrusters + 1.1, 0.21], [C.thrusters + 1.7, -0.14], [C.thrusters + 2.2, -0.14], [C.thrusters + 2.8, 0]], tq);
    const yawR = track([[C.thrusters + 0.3, 0], [C.thrusters + 0.9, -0.21], [C.thrusters + 1.3, -0.21], [C.thrusters + 1.8, 0.14], [C.thrusters + 2.3, 0.14], [C.thrusters + 2.9, 0]], tq);
    B.podL.rotation.y = yawL; B.podR.rotation.y = yawR;
    const pL = spinInt(tq, C.thrusters + 0.2, 1.0, 22) + spinInt(tq, C.thrusters + 1.8, 0.8, 14);
    B.propL.rotation.z = pL; B.propR.rotation.z = -pL * 1.07;
    B.prop.rotation.z = spinInt(tq, C.thrusters + 0.8, 1.2, 5.5);
    const fa = track([[C.thrusters + 1.4, 0], [C.thrusters + 1.7, 0.2], [C.thrusters + 2.0, -0.2], [C.thrusters + 2.4, 0]], tq);
    const fb = track([[C.thrusters + 1.55, 0], [C.thrusters + 1.85, -0.2], [C.thrusters + 2.15, 0.2], [C.thrusters + 2.5, 0]], tq);
    B.flapA.quaternion.setFromAxisAngle(_v.set(Math.sin(PS[0]), Math.cos(PS[0]), 0), fa);
    B.flapB.quaternion.setFromAxisAngle(_v.set(Math.sin(PS[1]), Math.cos(PS[1]), 0), fb);
    B.mast.position.y = S.top - 0.42 + 0.42 * (rest ? 0 : smooth(ramp(t, C.thrusters - 0.4, C.thrusters + 0.8)));
    CR.saddles.forEach((_, i) => {
      const k = overClamp ?? (rest ? 0 : clampK(i, t));
      B[`clampL${i}`].rotation.z = 0.62 * k; B[`clampR${i}`].rotation.z = -0.62 * k;
    });
    const hk = overHatch ?? (rest ? 0 : hatchK(t));
    lid.pivot.rotation.x = hk * (112 * PI / 180);
    const dk = overDog ?? (rest ? 0 : dogK(t));
    dogG.pivot.rotation.y = -dk * 3 * PI;
    lamps.flush();
  };

  const fire = (cue: TernCue) => { for (const cb of cbs) { try { cb(cue, seq); } catch (e) { console.warn('[tern] cue callback failed', e); } } };
  L.updaters.push((dt) => {
    if (!powered) return;
    clock += dt;
    if (seq.running) {
      const prev = seq.t;
      seq.t += dt;
      for (const c of cueList) if (prev < C[c] && seq.t >= C[c]) { seq.cue = c; fire(c); }
      if (seq.t >= TERN_CHECK_LEN) { seq.t = TERN_CHECK_LEN; seq.running = false; seq.state = 'complete'; }
    }
    if (seq.running || L.isVisible(rooms[0])) pose(seq.t);
  });
  L.machines.set('tern', (s: MachineState) => {
    powered = s !== 'off';
    lamps.power = powered ? 1 : 0;
    if (!powered) { glow.enabled = false; if (flood) flood.enabled = false; for (const v of self.col) v.set(0, 0, 0); }
    lamps.flush();
  });
  pose(seq.t);

  const ud = rig.userData;
  ud.seq = seq;
  ud.cueTimes = { ...C };
  ud.check = () => {
    if (seq.running) return;
    seq.t = 0; seq.running = true; seq.state = 'running'; seq.cue = 'power';
    fire('power');
  };
  ud.snap = () => { seq.t = TERN_CHECK_LEN; seq.running = false; seq.state = 'complete'; seq.cue = 'complete'; pose(seq.t); };
  ud.setTime = (t: number) => {
    seq.t = t < 0 ? -1 : Math.min(t, TERN_CHECK_LEN); seq.running = false;
    seq.state = t < 0 ? 'rest' : t >= TERN_CHECK_LEN ? 'complete' : 'running';
    let c: TernCue | 'rest' = 'rest'; for (const k of cueList) if (t >= C[k]) c = k; seq.cue = c;
    pose(seq.t);
  };
  /** Let the sequence time advance from `setTime` (dev pages). */
  ud.play = () => { if (seq.t < 0) seq.t = 0; seq.running = true; seq.state = 'running'; };
  ud.onCue = (cb: (cue: TernCue, s: TernSeq) => void) => { cbs.push(cb); return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }; };
  ud.clamps = (k: number | null) => { overClamp = k === null ? null : clamp01(k); pose(seq.t); };
  ud.hatch = (k: number | null) => { overHatch = k === null ? null : clamp01(k); pose(seq.t); };
  ud.dog = (k: number | null) => { overDog = k === null ? null : clamp01(k); pose(seq.t); };
  ud.vents = vents;
  ud.drips = drips;
  ud.soundPoints = soundPoints;
  ud.lamps = lamps;
  ud.bones = B;
  ud.lights = { glow, flood };
  L.objects.set('tern', rig);
  return rig;
}

// ═════════════════════════════════════════════════════════════ LAUNCH-LOCK DOOR

export interface LockDoorOpts { x?: number; y?: number; z?: number; r?: number; dogs?: number; portY?: number; portR?: number; glass?: boolean; collide?: boolean }
/**
 * The launch-lock door `lock5_launch` (§2.2, §8.8.2): a sealed 5.0 m round pressure door in the sub bay's south wall,
 * faces +z (into the bay). Origin = door centre on the wall plane (34, 3.0, −56); the bay-side wall face is z −55.8.
 * Frame ring r 2.5 … 3.05 (proud 0.25, hazard chevron ring on it), leaf r 2.45 (front z −55.45, a raised hub with the
 * stencil `발사 록 1`), 16 engaged radial dogs, a hydraulic hinge arm on the +x side, a 0.5 m rail sill (x 31 …
 * 37, hazard-topped, two rail gates where the rails x 33 / 35 end at z −55.6), and the armoured port ⌀ `portR`·2
 * (0.6) at y 2.2: a bore through the leaf with a heavy bolted bezel and (optional) a dark glass disc at z −55.9 —
 * the cheap viewport (`fx5_lock_water`, W6) lives behind it. W4 carves the 0.6 m hole through the wall behind the
 * glass (z −55.8 … −56.2) if its greybox wall is solid there.
 * Colliders: leaf + frame box x 31 … 37, y 0.5 … 5.5, z −55.8 … −55.3; sill box y 0 … 0.5 (both nav). Draw calls:
 * own glass (1, transparent; `glass: false` drops it); zone `trim_steel`, `steel_raw`, `painted_dark`,
 * `hazard_stripes`, `navy_grey`, the sign atlas. `userData.pane = { center, normal, r }` for `mk5_glass`.
 */
export function launchLockDoor(L: LevelBuild, b: Builder, o: LockDoorOpts = {}): THREE.Object3D {
  const X = o.x ?? 34, Y = o.y ?? 3.0, Z = o.z ?? -56, R = o.r ?? 2.5, nd = o.dogs ?? 16;
  const PY = o.portY ?? 2.2, PR = o.portR ?? 0.3;
  const face = Z + 0.2; // bay-side wall face
  const leafMat: Mat = 'wall_panel_dark', frameMat: Mat = 'trim_steel', steel: Mat = 'steel_raw', dark: Mat = 'painted_dark';
  // frame ring (front face, outer band, inner reveal)
  b.geo(frameMat, revolve([[face + 0.25, R + 0.55], [face + 0.25, R + 0.02]], 64, X, Y, { vFromR: true, vTile: 1 }), 'keep');
  b.geo(frameMat, revolve([[face, R + 0.55], [face + 0.25, R + 0.55]], 64, X, Y, { vTile: 1 }), 'keep');
  b.geo(dark, revolve([[face + 0.25, R + 0.02], [face, R + 0.02]], 64, X, Y, { vTile: 1 }), 'keep');
  b.geo('hazard_stripes', revolve([[face + 0.253, R + 0.42], [face + 0.253, R + 0.14]], 64, X, Y, { vFromR: true, vTile: 1, uSpan: TAU * (R + 0.3) / 1.0 }), 'keep');
  // bolts round the frame
  b.detail(() => { for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; b.cyl(steel, X + Math.sin(a) * (R + 0.48), Y + Math.cos(a) * (R + 0.48), face + 0.27, 0.025, 0.04, 'z', 6); } });
  // leaf: flat slab with the port hole, bevelled edge
  {
    const sh = new THREE.Shape(); sh.absarc(0, 0, R - 0.05, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(0, PY - Y, PR, 0, TAU, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 2, curveSegments: 48 });
    b.geo(leafMat, g, 'box', trs(X, Y, face + 0.17));
    b.geo(leafMat, revolve([[face + 0.17, R - 0.05], [face, R - 0.05]], 64, X, Y, { vTile: 1 }), 'keep');
  }
  const lf = face + 0.30; // leaf front (extrude 0 … 0.1 + 3 cm bevels, placed at face + 0.17)
  // stiffening ribs (radial) + rings
  b.torus(leafMat, X, Y, lf, R * 0.62, 0.05, 'z', 48);
  b.torus(leafMat, X, Y, lf, R - 0.28, 0.045, 'z', 56);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + PI / 8;
    const r0 = 0.55, r1 = R - 0.3;
    const ax = Math.sin(a), ay = Math.cos(a);
    // keep the ribs off the port
    const mx = X + ax * (r0 + r1) / 2, my = Y + ay * (r0 + r1) / 2;
    if (Math.hypot(mx - X, my - PY) < PR + 0.45 && ay < 0) continue;
    b.rbox(leafMat, mx, my, lf + 0.02, 0.09, r1 - r0, 0.08, 0, 0, -a);
  }
  // hub with stencil + equalising valve boss
  b.cyl(leafMat, X, Y + 0.25, lf + 0.06, 0.5, 0.14, 'z', 32);
  b.cyl(steel, X, Y + 0.25, lf + 0.14, 0.16, 0.05, 'z', 16);
  b.sign('발사 록 1', 'stencil', X, Y + 0.95, lf + 0.005, 1.6, 0.3, '+z');
  b.sign('해수 압력 210 BAR — 열지 마세요', 'stencil', X, Y - 1.55, lf + 0.005, 2.0, 0.16, '+z');
  // dogs: engaged radial blocks bridging leaf rim and frame + their wedges
  for (let k = 0; k < nd; k++) {
    const a = (k / nd) * TAU;
    const ax = Math.sin(a), ay = Math.cos(a);
    b.rbox(steel, X + ax * (R - 0.08), Y + ay * (R - 0.08), lf + 0.03, 0.18, 0.42, 0.1, 0, 0, -a);
    b.rbox(dark, X + ax * (R + 0.16), Y + ay * (R + 0.16), face + 0.3, 0.24, 0.12, 0.1, 0, 0, -a);
    b.cyl(steel, X + ax * (R - 0.2), Y + ay * (R - 0.2), lf + 0.06, 0.05, 0.08, 'z', 8);
  }
  // hinge (+x): two knuckles, pin, hydraulic actuator
  for (const dy of [-1.3, 1.3]) b.box(frameMat, X + R + 0.62, Y + dy, face + 0.32, 0.4, 0.5, 0.36);
  b.cyl(steel, X + R + 0.7, Y, face + 0.38, 0.09, 3.2, 'y', 14);
  b.box(leafMat, X + R + 0.28, Y, lf + 0.03, 0.5, 3.0, 0.14); // (front lf + 0.10: 2 cm proud of the dog at 3 o'clock — was coplanar)
  b.rod(steel, X + R + 0.85, Y - 1.9, face + 0.12, X + R + 0.85, Y - 0.6, face + 0.42, 0.06, 10);
  b.cyl(dark, X + R + 0.85, Y - 2.15, face + 0.1, 0.1, 0.55, 'y', 12);
  // port: bezel, bolts, bore (inside), glass
  b.torus(steel, X, PY, lf + 0.05, PR + 0.07, 0.06, 'z', 32);
  bezel(b, frameMat, X, PY, lf - 0.03, PR + 0.005, PR + 0.18, 0.06, 40);
  b.detail(() => { for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; b.cyl(steel, X + Math.sin(a) * (PR + 0.13), PY + Math.cos(a) * (PR + 0.13), lf + 0.05, 0.02, 0.04, 'z', 6); } });
  b.geo(dark, tubeIn(PR, Z + 0.1, lf + 0.06, 28), 'box', trs(X, PY, 0, PI / 2));
  if (o.glass !== false) {
    const gm = mat5(L, 'sp5_lock_glass', () => new THREE.MeshStandardMaterial({ name: 'lock_port_glass', color: 0x203038, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false, envMapIntensity: 2 }));
    b.geo(gm, new THREE.CircleGeometry(PR, 28), 'keep', trs(X, PY, Z + 0.1));
  }
  // sill with rail gates + floor hazard band
  b.bx(frameMat, X - 3.0, 0, face, X + 3.0, 0.5, face + 0.5);
  b.bx('hazard_stripes', X - 3.0, 0.5, face + 0.3, X + 3.0, 0.505, face + 0.5);
  // rail gates stand 1 cm over the sill top and 1.5 cm proud of its face (they sat on the sill top, under the hazard band)
  for (const rx of TERN5.rails.x) b.bx(steel, rx - 0.14, 0.15, face + 0.0, rx + 0.14, 0.51, face + 0.515);
  b.detail(() => b.bx('hazard_stripes', X - 3.0, 0, face + 0.5, X + 3.0, 0.004, face + 0.9));
  if (o.collide !== false) {
    b.collide(X - 3.0, 0.5, face, X + 3.0, Y + R + 0.5, face + 0.5, 'metal', true);
    b.collide(X - 3.0, 0, face, X + 3.0, 0.5, face + 0.5, 'metal', true);
  }
  const root = new THREE.Object3D(); root.name = 'lock5_launch'; root.position.set(X, Y, Z);
  root.userData.sealed = true;
  root.userData.pane = { center: new THREE.Vector3(X, PY, Z + 0.1), normal: new THREE.Vector3(0, 0, 1), r: PR };
  L.root.add(root); L.objects.set('lock5_launch', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ COMMAND-MODULE DOOR

export type TallyState = 'red' | 'amber' | 'white' | 'off';
export interface CmdDoorOpts {
  x?: number; z?: number; lineX?: number; rooms?: string[];
  /** Text of the panel `door5_cmd_panel` (left of the door). */
  panel?: string;
}
/**
 * The command module's hardened door `door5_cmd` (§2.2, §2.8, §4.7, §8.8.3) — sealed, never opens. Origin = (44, 0,
 * −16) on the wall plane x 44; the spine (front) side is −x. Hardened leaf 2.0 × 2.6 (y 0.15 … 2.75, front face x
 * 43.8, 0.2 thick) with rounded corners, 16 engaged dogs round its edge, a central dog wheel (y 1.0), hinges on its
 * north side; a heavy frame 2.5 × 3.0 with a 0.15 coaming sill; the **armoured port** ⌀ 0.25 at (43.8, 1.62, −16.0),
 * 0.2 m bore, yellowed glass; behind it a warm-lit back box (in the void x 44 … 45) with Kessler's **silhouette** —
 * a 2-D card on a slow parallax track (paces at a distance; `look(true)` brings it close behind the port), never a
 * face. Door camera above-left (z −17.4, y 2.85) with a tally (red / amber / white); intercom grille right (z −14.5,
 * y 1.45); text panel `door5_cmd_panel` left (z −17.5, y 1.75, `terminal_idle`). The yellow stand line x 42.5 across
 * the spine floor (z −17.8 … −14.2, 0.12 wide), emissive paint.
 * Collider: the opening x 43.55 … 44.2, z −17.25 … −14.75, y 0 … 3.0 (nav), with a 0.3 × 0.3 hole in front of the
 * port down to x 43.83 (the level puts the `port` glass pane collider there). W4 carves the 2.5 × 3.0 opening.
 * Draw calls: own — back box (1), silhouette (1, alpha-tested), port glass (1, transparent), line (1), camera head
 * (2, mover-free group), lamps (1) + halos (1); zone — `navy_grey`, `painted_dark`, `steel_raw`, `trim_steel`,
 * `hazard_stripes`. `userData`: `look(on)` (`cmd5_port_look`), `tally(s)`, `watch(p | null)` (the camera head turns
 * toward a world point, slowly), `pulse(on)` (`cmd5_line`), `lineGlow(k)` (base glow: 0.12 lit … 1 emergency),
 * `pane` (`{ center, normal, r }` for `mk5_glass`), `portPoint`, `linePoints` ([z −17.8 … −14.2] endpoints).
 */
export function cmdDoor(L: LevelBuild, b: Builder, o: CmdDoorOpts = {}): THREE.Object3D {
  const X = o.x ?? 44, Z = o.z ?? -16, LX = o.lineX ?? 42.5, rooms = o.rooms ?? b.rooms.slice();
  const leafMat: Mat = libOr(L, 'navy_grey', 'wall_panel_dark'), dark: Mat = 'painted_dark', steel: Mat = 'steel_raw', frameMat: Mat = 'trim_steel';
  const RY = -PI / 2; // local +z → world −x (spine), local +x → world +z
  const LW = 2.0, LH = 2.6, LY0 = 0.15, PY = 1.62, PRr = 0.125;
  b.push(X, 0, Z, RY);
  // frame (extruded ring 2.5 × 3.0 with the leaf's opening), proud 0.28 of the wall face plane z 0.2 (local)
  {
    const sh = new THREE.Shape(); roundRect(sh, 2.5, 3.0, 0.12, 0, 1.5);
    const hole = new THREE.Path(); roundRect(hole, LW + 0.06, LH + 0.06, 0.28, 0, LY0 + LH / 2, false); sh.holes.push(hole);
    b.geo(frameMat, new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 }), 'box', trs(0, 0, 0.2));
  }
  b.bx(frameMat, -1.25, 0, 0.2, 1.25, LY0, 0.42); // coaming sill
  b.bx('hazard_stripes', -1.25, LY0, 0.36, 1.25, LY0 + 0.004, 0.42);
  // leaf with the port hole, proud 0.2 (z 0 … 0.2 local = world x 44 … 43.8)
  {
    const sh = new THREE.Shape(); roundRect(sh, LW, LH, 0.26, 0, LY0 + LH / 2);
    const hole = new THREE.Path(); hole.absarc(0, PY, PRr, 0, TAU, true); sh.holes.push(hole);
    b.geo(leafMat, new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 10 }), 'box', trs(0, 0, 0.005));
  }
  const lf = 0.2; // leaf front
  // stiffener frame on the leaf face + hazard border
  b.detail(() => {
    b.bx(leafMat, -0.85, 0.35, lf, 0.85, 0.42, lf + 0.04).bx(leafMat, -0.85, 2.5, lf, 0.85, 2.57, lf + 0.04);
    b.bx(leafMat, -0.85, 0.42, lf, -0.78, 2.5, lf + 0.04).bx(leafMat, 0.78, 0.42, lf, 0.85, 2.5, lf + 0.04);
    b.bx('hazard_stripes', -1.0, LY0 + 0.02, lf + 0.002, 1.0, LY0 + 0.12, lf + 0.006);
  });
  // 16 dogs: 5 per side, 3 top, 3 bottom (boss on the leaf, a lever over the frame, the frame wedge)
  const dogs: [number, number, number][] = [];
  for (let k = 0; k < 5; k++) { const y = LY0 + 0.35 + (k * (LH - 0.7)) / 4; dogs.push([-LW / 2 + 0.08, y, PI / 2], [LW / 2 - 0.08, y, -PI / 2]); }
  for (let k = 0; k < 3; k++) { const x = -0.55 + k * 0.55; dogs.push([x, LY0 + LH - 0.08, 0], [x, LY0 + 0.08, PI]); }
  for (const [x, y, a] of dogs) {
    b.cyl(steel, x, y, lf + 0.04, 0.035, 0.08, 'z', 8);
    b.rbox(steel, x - Math.sin(a) * 0.08, y + Math.cos(a) * 0.08, lf + 0.07, 0.05, 0.2, 0.035, 0, 0, a);
    b.rbox(dark, x - Math.sin(a) * 0.17, y + Math.cos(a) * 0.17, lf + 0.06, 0.12, 0.06, 0.08, 0, 0, a);
  }
  // dog wheel, hinges (north = local +x), the port bezel
  b.push(0, 1.0, lf + 0.12); handwheel(b, steel, 0.24, 0.022, 5); b.pop();
  b.cyl(steel, 0, 1.0, lf + 0.05, 0.05, 0.1, 'z', 10);
  for (const y of [0.6, 1.5, 2.4]) { b.box(frameMat, LW / 2 + 0.12, y, lf + 0.08, 0.16, 0.3, 0.16); b.cyl(steel, LW / 2 + 0.12, y, lf + 0.12, 0.05, 0.36, 'y', 10); }
  bezel(b, frameMat, 0, PY, lf, PRr + 0.005, PRr + 0.1, 0.045, 28);
  b.torus(steel, 0, PY, lf + 0.05, PRr + 0.035, 0.03, 'z', 28);
  b.detail(() => { for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2; b.cyl(steel, Math.sin(a) * (PRr + 0.075), PY + Math.cos(a) * (PRr + 0.075), lf + 0.05, 0.014, 0.03, 'z', 6); } });
  b.geo(steel, tubeIn(PRr, -0.02, lf + 0.06, 24), 'box', trs(0, PY, 0, PI / 2));
  // intercom (local +x 1.5 → world z −14.5), camera bracket (local x −1.42 → z −17.42)
  b.bx(dark, 1.38, 1.28, lf, 1.62, 1.62, lf + 0.05);
  b.detail(() => { for (let k = 0; k < 6; k++) b.bx(steel, 1.42, 1.38 + k * 0.035, lf + 0.05, 1.58, 1.39 + k * 0.035, lf + 0.056); });
  b.cyl('painted_orange', 1.5, 1.33, lf + 0.06, 0.022, 0.02, 'z', 10);
  b.bx(dark, -1.48, 2.7, lf, -1.36, 2.98, lf + 0.04);
  b.bx(steel, -1.45, 2.8, lf + 0.04, -1.39, 2.86, lf + 0.3);
  b.pop();

  // back box behind the port (void x 44.0 … 45.0) + port glass
  const backMat = mat5(L, 'sp5_cmd_back', () => new THREE.MeshBasicMaterial({
    name: 'cmd_port_back', map: canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(150, 110, 10, 128, 128, 190);
      gr.addColorStop(0, '#ffdca0'); gr.addColorStop(0.35, '#d4893f'); gr.addColorStop(1, '#2c1608');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(20,10,4,0.75)'; g.fillRect(14, 150, 70, 106); g.fillRect(190, 30, 18, 226); g.fillRect(0, 214, 256, 42);
      g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(30, 162, 8, 5); g.fillRect(44, 162, 8, 5);
    }),
  }));
  const back = L.part('door5_cmd_back');
  back.geo(backMat, flipped(new THREE.BoxGeometry(1.0, 2.4, 2.4)), 'keep', trs(X + 0.5, PY, Z));
  const portGlass = mat5(L, 'sp5_cmd_glass', () => new THREE.MeshStandardMaterial({ name: 'cmd_port_glass', color: 0xd6b35c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.5 }));
  back.geo(portGlass, new THREE.CircleGeometry(PRr, 24), 'keep', trs(X - 0.1, PY, Z, 0, -PI / 2));
  // the yellow stand line (emissive paint)
  const lineMat = mat5(L, 'sp5_cmd_line', () => { const m = L.ctx.materials.clone('painted_yellow', { color: 0xe2b21c, emissive: new THREE.Color(0xffc21e), emissiveIntensity: 0.12, roughness: 0.6 }); m.name = 'cmd_line'; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; });
  back.quad(lineMat, LX, 0.002, Z, 0.12, 3.6, '+y');
  const backG = back.build(); backG.name = 'door5_cmd_back'; backG.userData.rooms = rooms.slice(); L.root.add(backG);
  // silhouette card (alpha-tested), with a slow pacing track
  const silMat = mat5(L, 'sp5_cmd_sil', () => new THREE.MeshBasicMaterial({
    name: 'cmd_silhouette', alphaTest: 0.5, color: 0x0b0806, map: canvasTex(256, 320, (g) => {
      g.clearRect(0, 0, 256, 320);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(128, 96, 44, 56, 0, 0, TAU); g.fill();              // head (no face: a dark shape)
      g.beginPath(); g.moveTo(96, 140); g.lineTo(160, 140); g.lineTo(166, 172); g.lineTo(90, 172); g.fill(); // neck
      g.beginPath(); g.moveTo(20, 320); g.bezierCurveTo(20, 210, 60, 176, 128, 168); g.bezierCurveTo(196, 176, 236, 210, 236, 320); g.fill();
      g.fillRect(120, 30, 46, 8); // a strand of hair out of place
    }),
  }));
  const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), silMat);
  sil.name = 'door5_cmd_silhouette';
  sil.rotation.y = -PI / 2; // faces −x
  sil.userData.rooms = rooms.slice();
  L.root.add(sil);
  // door camera head (pivot yaws) with its tally
  const lamps = new LampSet(L, 'cmd_lamps', 2);
  lamps.set(0, 0xff1a0a, 8, 0x2a0806); lamps.set(1, 0x30ff60, 3, 0x0a2010);
  lamps.level[0] = 1; lamps.level[1] = 1;
  const camP = new THREE.Vector3(X - 0.42, 2.83, Z - 1.42);
  const cam = movingGroup(L, 'door5_cmd_camera', rooms, (p) => {
    p.box(dark, 0, 0, -0.04, 0.12, 0.11, 0.26);
    p.cyl(dark, 0, 0, -0.18, 0.04, 0.04, 'z', 12);
    p.box(dark, 0, 0.07, -0.02, 0.14, 0.02, 0.3);
    lamps.box(p, 0, 0.035, 0.035, -0.17, 0.018, 0.018, 0.01);
  }, false);
  cam.mount.position.copy(camP);
  lamps.box(b, 1, X - 0.2 - 0.065, 1.66, Z + 1.5, 0.01, 0.02, 0.02);
  lamps.halo(0, new THREE.Vector3(camP.x - 0.2, camP.y + 0.035, camP.z + 0.035), 0.05, 2.6);
  lamps.halo(1, new THREE.Vector3(X - 0.28, 1.66, Z + 1.5), 0.04, 2.0);
  lamps.finish(rooms);
  L.screen('door5_cmd_panel', 'terminal_idle', 0.42, 0.28, X - 0.205, 1.75, Z - 1.52, '-x', { text: o.panel ?? '지휘 모듈\n차폐됨\n내부에서 밀봉' });
  // collider across the opening, with the port left open in front of the pane (x X − 0.17 … X − 0.14 is the level's
  // `mk5_glass` `port` pane, a glass collider the level adds): a round fired through the port reaches the glass, a
  // sight ray reaches the pane — the frame no longer covers it (was one box from X − 0.45)
  b.collide(X - 0.14, 0, Z - 1.25, X + 0.2, 3.0, Z + 1.25, 'metal', true);
  {
    const x0 = X - 0.45, x1 = X - 0.17, y0 = PY - 0.15, y1 = PY + 0.15, z0 = Z - 0.15, z1 = Z + 0.15;
    b.collide(x0, 0, Z - 1.25, x1, y0, Z + 1.25, 'metal', true);
    b.collide(x0, y1, Z - 1.25, x1, 3.0, Z + 1.25, 'metal', true);
    b.collide(x0, y0, Z - 1.25, x1, y1, z0, 'metal', true);
    b.collide(x0, y0, z1, x1, y1, Z + 1.25, 'metal', true);
  }

  // runtime: silhouette track, camera watch, line pulse, tally
  let lookOn = false, lookK = 0, pulseOn = false, base = 0.12, t = 0;
  let watchP: THREE.Vector3 | null = new THREE.Vector3(LX, 1.6, Z);
  let yaw = 0, pitch = 0;
  const tallyCol: Record<TallyState, number> = { red: 0xff1a0a, amber: 0xff8a12, white: 0xf4f2ff, off: 0x000000 };
  const step = (dt: number) => {
    t += dt;
    lookK += ((lookOn ? 1 : 0) - lookK) * Math.min(1, dt * 1.6);
    const k = smooth(lookK);
    const pace = Math.sin(t * 0.21) * 0.32 + Math.sin(t * 0.53 + 1.3) * 0.06;
    sil.position.set(X + 0.62 - 0.36 * k, PY - 0.16 + 0.02 * Math.sin(t * 0.9) * k - 0.05 * (1 - k), Z + pace * (1 - k) + 0.02 * Math.sin(t * 0.7) * k);
    sil.rotation.z = 0.02 * Math.sin(t * 0.4);
    lineMat.emissiveIntensity = base + (pulseOn ? (0.5 + 0.5 * Math.sin(t * TAU * 1.1)) * 0.9 : 0);
    if (watchP) {
      const dx = watchP.x - camP.x, dz = watchP.z - camP.z, dy = watchP.y - camP.y;
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      let d = ty - yaw; while (d > PI) d -= TAU; while (d < -PI) d += TAU;
      yaw += d * Math.min(1, dt * 1.2); pitch += (tp - pitch) * Math.min(1, dt * 1.2);
      cam.pivot.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  };
  L.updaters.push((dt) => { if (L.isVisible(rooms[0] ?? '')) step(dt); else t += dt; });
  step(0);
  const root = new THREE.Object3D(); root.name = 'door5_cmd'; root.position.set(X, 0, Z); root.rotation.y = RY;
  root.userData.sealed = true;
  const ud = root.userData;
  ud.look = (on: boolean) => { lookOn = on; };
  ud.tally = (s: TallyState) => { lamps.set(0, tallyCol[s], s === 'white' ? 6 : 8, 0x2a0806); lamps.level[0] = s === 'off' ? 0 : 1; };
  ud.watch = (p: THREE.Vector3 | null) => { watchP = p ? p.clone() : null; };
  ud.pulse = (on: boolean) => { pulseOn = on; };
  ud.lineGlow = (k: number) => { base = 0.12 + Math.max(0, k) * 0.9; };
  ud.pane = { center: new THREE.Vector3(X - 0.2, PY, Z), normal: new THREE.Vector3(-1, 0, 0), r: PRr };
  ud.portPoint = new THREE.Vector3(X - 0.2, PY, Z);
  ud.linePoints = [new THREE.Vector3(LX, 0, -17.8), new THREE.Vector3(LX, 0, -14.2)];
  ud.camera = cam.mount;
  ud.silhouette = sil;
  L.root.add(root); L.objects.set('door5_cmd', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ GATE DOG RING (d5_gate)

/**
 * The gate `d5_gate`'s dog ring (§2.2, §8.8.4; 3b `gate4`'s look): `dogs` (12) locking dogs on both faces of a
 * `wide` door's leaves, near the opening's edge (4 per side, 2 top, 2 bottom), each in a guide; `set(k)` slides them
 * 0 = engaged (0.16 m out over the frame) … 1 = retracted by 0.15 m toward the leaf centre (decoration: the gate in 3c starts
 * engaged and `gate5_open` retracts them before the leaf moves). Each dog group is parented to the leaf it sits on
 * (a `wide` door's upper leaf = leaf(0) above y 1.4, lower = leaf(1); a one-leaf door: all on leaf(0)), so it rides
 * the leaf and its decals ride with it. Registered on `L.afterDoors` (call it while building; the door may not exist
 * yet). `L.objects['<id>_dogs']`: `userData.set(k)`, `userData.k`. Draw calls: 2 per leaf (steel_raw dogs + guides).
 */
export function gateLook(L: LevelBuild, id: string, o: { dogs?: number; rooms?: string[] } = {}) {
  const grp = new THREE.Object3D(); grp.name = `${id}_dogs`;
  const sets: { obj: THREE.Object3D; local: THREE.Vector3 }[] = [];
  grp.userData.k = 0;
  grp.userData.set = (k: number) => { const kk = clamp01(k); grp.userData.k = kk; for (const s of sets) s.obj.position.copy(s.local).multiplyScalar(0.15 * kk); };
  L.objects.set(grp.name, grp);
  L.afterDoors.push(() => {
    const door = L.doors.get(id) as DoorImpl | undefined;
    if (!door) { console.warn(`[setpieces5] gateLook: no door "${id}"`); return; }
    const w = door.width, h = door.height, n = Math.max(8, o.dogs ?? 12);
    const perV = Math.round(n / 3), perH = Math.max(1, Math.floor((n - 2 * perV) / 2));
    const pts: { x: number; y: number; dir: THREE.Vector3 }[] = [];
    for (let i = 0; i < perV; i++) { const y = 0.35 + ((h - 0.7) * (i + 0.5)) / perV; pts.push({ x: -w / 2 + 0.16, y, dir: new THREE.Vector3(1, 0, 0) }, { x: w / 2 - 0.16, y, dir: new THREE.Vector3(-1, 0, 0) }); }
    for (let i = 0; i < perH; i++) { const x = -w / 2 + (w * (i + 1)) / (perH + 1); pts.push({ x, y: h - 0.2, dir: new THREE.Vector3(0, -1, 0) }, { x, y: 0.24, dir: new THREE.Vector3(0, 1, 0) }); }
    const leaves = [door.leaf(0), door.leaf(1)].filter(Boolean) as THREE.Object3D[];
    const split = leaves.length > 1 ? 1.4 : -1e9;
    leaves.forEach((leaf, li) => {
      const mine = pts.filter((p) => (li === 0 ? p.y >= split : p.y < split));
      if (!mine.length) return;
      // guides (fixed to the leaf)
      const gp = L.part(`${id}:dogguides${li}`);
      // dogs grouped by retract direction so one set(k) slides each group along its own axis
      const byDir = new Map<string, typeof mine>();
      for (const p of mine) { const key = `${p.dir.x},${p.dir.y}`; (byDir.get(key) ?? byDir.set(key, []).get(key)!).push(p); }
      for (const sg of [1, -1]) for (const p of mine) {
        const z = sg * 0.1;
        const vert = p.dir.x !== 0;
        gp.box('painted_dark', p.x + p.dir.x * 0.1, p.y + p.dir.y * 0.1, z, vert ? 0.36 : 0.22, vert ? 0.22 : 0.36, 0.04);
      }
      const gg = gp.build(); leaf.add(gg);
      for (const [, list] of byDir) {
        const dp = L.part(`${id}:dogs${li}`);
        for (const sg of [1, -1]) for (const p of list) {
          const z = sg * 0.155, vert = p.dir.x !== 0;
          dp.box('steel_raw', p.x - p.dir.x * 0.02, p.y - p.dir.y * 0.02, z, vert ? 0.34 : 0.14, vert ? 0.14 : 0.34, 0.07);
          dp.cyl('steel_raw', p.x + p.dir.x * 0.1, p.y + p.dir.y * 0.1, z + sg * 0.04, 0.035, 0.03, 'z', 8);
        }
        const g = dp.build(); leaf.add(g);
        sets.push({ obj: g, local: list[0].dir.clone() });
      }
    });
    grp.userData.set(grp.userData.k);
  });
  return grp;
}

// ═════════════════════════════════════════════════════════════ FLOOR HATCH LIDS (south hinge)

export interface HatchSpec {
  name: string;
  /** Opening in plan (world): x0 … x1, z0 … z1; the lid's top is flush at `y`. */
  x0: number; x1: number; z0: number; z1: number; y?: number;
  /** Wheel on the top ('spine') or on the underside ('mag': dogged from below). */
  wheel: 'top' | 'bottom';
  /** Painted on the lid top (≤ 3 lines). */
  topText?: string;
  /** A status lamp on the top side by the hinge (the magazine hatch: red dogged → green open). */
  lamp?: boolean;
  rooms?: string[];
}
/** §2.6 / §8.4: the spine's crawlway hatch (2.4 × 2.2, wheel on top, opens from above). */
export const HATCH5_SPINE: HatchSpec = { name: 'hatch5_spine', x0: 36.2, x1: 38.6, z0: -17.6, z1: -15.4, wheel: 'top', topText: '빌지 출입\n연결 통로', rooms: ['spine5'] };
/** §2.6 / §8.4: the magazine hatch in the armoury floor (1.2 × 2.7, dogged from below, a plate + lamp on top). */
export const HATCH5_MAG: HatchSpec = { name: 'hatch5_mag', x0: 20.4, x1: 21.6, z0: -27.0, z1: -24.3, wheel: 'bottom', topText: '탄약고\n아래에서 잠김\n스파인 통로로 출입', lamp: true, rooms: ['arm5'] };

/**
 * A floor hatch lid hinged on its SOUTH (−z) edge (§8.4, §8.8.5). Closed: the lid fills the opening, top flush at
 * `y` (0), 0.08 thick (y −0.08 … 0), walkable. Open (`open(1)`): it has swung 90° up about the hinge line at its
 * bottom-south edge and stands vertical on the south side, z `z0 − 0.08` … `z0`, y −0.08 … `d − 0.08` (the plan's
 * "stands up against a frame on the pit's south side" / "stands at z −27.0 … −27.1"). Built: the lid (a registered
 * mover: decals ride it), a flush angle-iron curb round the opening, hinge knuckles, the dog wheel (`dogs(k)` turns
 * it 1.25 turns: 0 dogged … 1 free) on the top or underside, a canvas top (non-slip, yellow / black border, the
 * stencil), an optional status lamp (`lamp('red' | 'green' | 'off')`). Physics: ONE dynamic box (`userData.box`)
 * following the lid — closed = the slab (`walkable` while k < 0.5), open = the standing lid, in between = the moving lid's bounds.
 * No static collider (W4's pit / opening is empty below). Draw calls: lid body `navy_grey` + top canvas + steel
 * wheel/hinges (3), + lamp (1) if any; curb in the zone (`steel_raw`). `L.objects[name].userData`: `open(k)`,
 * `dogs(k)`, `lamp(s)`, `k`, `box`, `spec`, `underside` (world point at the lid's underside centre).
 */
export function hatchLid(L: LevelBuild, b: Builder, s: HatchSpec): THREE.Object3D {
  const y = s.y ?? 0, w = s.x1 - s.x0, d = s.z1 - s.z0, T = 0.08, xc = (s.x0 + s.x1) / 2;
  const rooms = s.rooms ?? b.rooms.slice();
  const body: Mat = libOr(L, 'navy_grey', 'wall_panel_dark'), steel: Mat = 'steel_raw';
  // deck curb round the opening, 1 cm outside it (its inner faces on the pit walls z-fought them) — a flat bar 1 cm
  // thick whose top is 2 mm under the shut lid's top (the lid is laid `y` proud of the deck: pass y 0.008 over a stair)
  const c = 0.07, g = 0.01, cy0 = y - 0.012, cy1 = y - 0.002;
  b.bx(steel, s.x0 - c, cy0, s.z0 - c, s.x1 + c, cy1, s.z0 - g).bx(steel, s.x0 - c, cy0, s.z1 + g, s.x1 + c, cy1, s.z1 + c);
  b.bx(steel, s.x0 - c, cy0, s.z0 - g, s.x0 - g, cy1, s.z1 + g).bx(steel, s.x1 + g, cy0, s.z0 - g, s.x1 + c, cy1, s.z1 + g);
  // top canvas
  const topMat = mat5(L, `sp5_hatch_top_${s.name}`, () => {
    const pxW = 512, pxH = Math.round(512 * d / w);
    const R = rng(77 + s.name.length);
    const tex = canvasTex(pxW, pxH, (g) => {
      g.fillStyle = '#6b7378'; g.fillRect(0, 0, pxW, pxH);
      for (let i = 0; i < pxW * pxH * 0.02; i++) { const v = 80 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v + 4},${v + 6},0.5)`; g.fillRect(R() * pxW, R() * pxH, 2, 2); }
      const bw = pxW * 0.05;
      g.save(); g.beginPath(); g.rect(0, 0, pxW, pxH); g.rect(bw, bw, pxW - bw * 2, pxH - bw * 2); g.clip('evenodd');
      for (let i = -pxH; i < pxW + pxH; i += bw * 1.6) { g.fillStyle = '#d6a31a'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + bw * 0.8, 0); g.lineTo(i + bw * 0.8 - pxH, pxH); g.lineTo(i - pxH, pxH); g.fill(); }
      g.restore();
      if (s.topText) {
        const lines = s.topText.split('\n');
        g.fillStyle = '#e4e0d4'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const lh = Math.min(pxH * 0.12, pxW * 0.1);
        lines.forEach((ln, i) => { let fs = lh; g.font = `900 ${fs}px ${SANS}`; while (g.measureText(ln).width > pxW * 0.8 && fs > 8) { fs--; g.font = `900 ${fs}px ${SANS}`; } g.fillText(ln, pxW / 2, pxH * 0.5 + (i - (lines.length - 1) / 2) * lh * 1.25 + (s.wheel === 'top' ? pxH * 0.28 : 0)); });
      }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(20,20,20,${R() * 0.25})`; g.fillRect(R() * pxW, R() * pxH, 1 + R() * 10, 1); }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return new THREE.MeshStandardMaterial({ name: `${s.name}_top`, map: tex, roughness: 0.85, metalness: 0.1 });
  });
  const lampMat = s.lamp ? mat5(L, `sp5_hatch_lamp_${s.name}`, () => new THREE.MeshStandardMaterial({ name: `${s.name}_lamp`, color: 0x300806, emissive: 0xff1a0a, emissiveIntensity: 4, roughness: 0.2 })) : null;
  // the lid, authored relative to the hinge line (bottom-south edge): x across, y up, z north (+)
  const lid = movingGroup(L, s.name, rooms, (p) => {
    p.bx(body, -w / 2 + 0.01, 0.0, 0.01, w / 2 - 0.01, T - 0.004, d - 0.01);
    p.quad(topMat, 0, T, d / 2, w - 0.02, d - 0.02, '+y', 0, 'unit', 0.0015);
    // stiffeners underneath
    for (const fx of [-w / 4, w / 4]) p.bx(body, fx - 0.03, -0.06, 0.08, fx + 0.03, 0.0, d - 0.08);
    for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) p.cyl(body, x, 0.0, 0.0, 0.035, 0.22, 'x', 10);
    if (lampMat) p.cyl(lampMat, w / 2 - 0.16, T + 0.008, 0.22, 0.03, 0.016, 'y', 10);
  });
  lid.mount.position.set(xc, y - T, s.z0);
  // wheel (own pivot; child of the lid)
  const wheelY = s.wheel === 'top' ? T + 0.07 : -0.1;
  const wheelZ = s.wheel === 'top' ? d * 0.38 : d * 0.5;
  const wg = movingGroup(L, `${s.name}_wheel`, rooms, (p) => {
    p.push(0, 0, 0, 0, -PI / 2); handwheel(p, steel, s.wheel === 'top' ? 0.22 : 0.18, 0.018, 4, false); p.pop();
    p.cyl(steel, 0, s.wheel === 'top' ? -0.04 : 0.04, 0, 0.035, 0.08, 'y', 8);
    // dog bars (rotate with the wheel)
    for (const a of [0, PI]) p.rbox(steel, Math.cos(a) * 0.32, s.wheel === 'top' ? -0.07 - T : 0.0, Math.sin(a) * 0.32, 0.5, 0.025, 0.06, 0, -a, 0);
    // a hatch dogged from below: a red luminous band on the rim and the hub (IB5b B6 — the underside read black from
    // the magazine floor before the lamp popped; the way out must read without the flashlight)
    if (s.wheel === 'bottom') {
      const lume = mat5(L, 'sp5_hatch_lume', () => new THREE.MeshStandardMaterial({ name: 'hatch_lume', color: 0x5a1a14, emissive: 0xff2a14, emissiveIntensity: 1.1, roughness: 0.5 }));
      p.torus(lume, 0, -0.01, 0, 0.152, 0.008, 'y', 24);
      p.cyl(lume, 0, -0.045, 0, 0.022, 0.012, 'y', 10);
    }
  }, false);
  L.root.remove(wg.mount);
  lid.pivot.add(wg.mount);
  wg.mount.position.set(0, wheelY, wheelZ);
  // hinge knuckles on the south curb (static; they stood in the pit wall)
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) b.bx(steel, xc + x - 0.11, cy1, s.z0 - 0.065, xc + x + 0.11, y + 0.042, s.z0 - g - 0.004);
  // physics
  const box = L.ctx.physics.addBox(new THREE.Box3(), 'metal');
  box.owner = lid.mount;
  const walk = box as unknown as { walkable: boolean };
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let k = 0, dk = 0;
  const apply = () => {
    lid.pivot.rotation.x = -k * PI / 2;
    wg.pivot.rotation.y = dk * 2.5 * PI;
    lid.mount.updateMatrixWorld(true);
    const mw = lid.pivot.matrixWorld;
    let i = 0;
    for (const xx of [-w / 2, w / 2]) for (const yy of [0, T]) for (const zz of [0, d]) corners[i++].set(xx, yy, zz).applyMatrix4(mw);
    box.box.setFromPoints(corners);
    if (k > 0.98) { box.box.min.z = s.z0 - T; box.box.max.z = s.z0; }
    walk.walkable = k < 0.5; // the shut lid is deck (the player and the nav stand on it)
  };
  apply();
  const root = lid.mount;
  const ud = root.userData;
  ud.spec = s;
  ud.box = box;
  ud.k = 0;
  ud.open = (v: number) => { k = clamp01(v); ud.k = k; apply(); };
  ud.dogs = (v: number) => { dk = clamp01(v); apply(); };
  ud.lamp = (st: 'red' | 'green' | 'off') => { if (!lampMat) return; lampMat.emissive.set(st === 'green' ? 0x30ff60 : 0xff1a0a); lampMat.emissiveIntensity = st === 'off' ? 0 : 4; lampMat.color.set(st === 'green' ? 0x08300f : 0x300806); };
  ud.underside = new THREE.Vector3(xc, y - T, (s.z0 + s.z1) / 2);
  L.objects.set(s.name, root);
  return root;
}

// ═════════════════════════════════════════════════════════════ GALLERY WHEEL

export interface WheelOpts { x?: number; y?: number; z?: number; face?: '+x' | '-x' | '+z' | '-z'; rooms?: string[]; label?: string }
/** Length of the wheel's turn (§4.8: 4.0 s on a fixed clock) and how far it turns. */
export const WHEEL5 = { duration: 4.0, turns: 2.5, barFrom: 210 } as const;
/**
 * The gallery wheel `wheel5` (§2.6, §4.8, §8.8.6): hydraulic isolation valve for the trunk-tunnel door, on the sub
 * bay's west wall above the west gallery. Origin = `mk5_wheel` (22.25, 5.9, −52.0), facing +x (into the bay). A
 * back plate 1.0 × 0.8 on the wall, a manifold block with three hydraulic lines up / down the wall, the valve stem,
 * the WHEEL ⌀ 0.8 (rim plane 0.34 m out from the origin, a spinner knob), two pressure gauges (needles 210 → 0 bar
 * as it turns), a label plate. `spin(t)`: pose at t s into the 4.0 s turn (2.5 turns anticlockwise as seen from
 * the bay, hand-over-hand surge; gauges fall); `set(k)` = `spin(k × 4)`. The wheel is a registered mover. Calls:
 * wheel (1, steel) + two needles (2); zone `painted_dark`, `steel_raw`, `painted_orange`, the sign atlas + the gauge
 * face (1). Collider: manifold box (no nav). `userData`: `spin(t)`, `set(k)`, `k`, `hub` (world point of the hub).
 */
export function wheel5(L: LevelBuild, b: Builder, o: WheelOpts = {}): THREE.Object3D {
  const X = o.x ?? 22.25, Y = o.y ?? 5.9, Z = o.z ?? -52.0, face = o.face ?? '+x', rooms = o.rooms ?? b.rooms.slice();
  const ry = face === '+z' ? 0 : face === '-z' ? PI : face === '+x' ? PI / 2 : -PI / 2;
  const dark: Mat = 'painted_dark', steel: Mat = 'steel_raw';
  const pipeMat = mat5(L, 'sp5_hyd_pipe', () => L.ctx.materials.clone('painted_dark', { color: 0x3c4a43, roughness: 0.5 }));
  const faceMat = mat5(L, 'sp5_gauge_face', () => new THREE.MeshStandardMaterial({
    name: 'wheel_gauge_face', roughness: 0.5, map: canvasTex(128, 128, (g) => {
      g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
      for (let i = 0; i <= 10; i++) { const a = (-225 + i * 27) * PI / 180; g.beginPath(); g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); g.stroke(); }
      g.strokeStyle = '#b8321e'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 52, (-225 + 230) * PI / 180, (-225 + 270) * PI / 180); g.stroke();
      g.fillStyle = '#1a1a1a'; g.font = `700 16px ${SANS}`; g.textAlign = 'center'; g.fillText('BAR', 64, 94);
    }),
  }));
  b.push(X, Y, Z, ry);
  b.bx(dark, -0.5, -0.45, -0.05, 0.5, 0.45, -0.02);
  b.bx(pipeMat, -0.22, -0.16, -0.02, 0.22, 0.16, 0.16);
  b.cyl(steel, 0, 0, 0.2, 0.06, 0.12, 'z', 12);
  b.cyl(steel, 0, 0, 0.3, 0.025, 0.1, 'z', 8);
  for (const [x, dir] of [[-0.14, 1], [0, 1], [0.14, -1]] as const) b.rod(pipeMat, x, dir * 0.16, 0.06, x, dir * 1.4, 0.06, 0.03, 8);
  for (const x of [-0.14, 0, 0.14]) for (const yy of [0.6, -0.6]) b.box(steel, x, yy, 0.03, 0.08, 0.04, 0.08);
  for (const sx of [-1, 1]) {
    b.cyl(dark, sx * 0.34, 0.24, 0.05, 0.085, 0.08, 'z', 18);
    b.quad(faceMat, sx * 0.34, 0.24, 0.091, 0.15, 0.15, '+z');
    b.torus(steel, sx * 0.34, 0.24, 0.092, 0.08, 0.008, 'z', 18);
    b.rod(steel, sx * 0.34, 0.16, 0.05, sx * 0.18, 0.06, 0.05, 0.012, 6);
  }
  b.sign(o.label ?? '유압 차단\n트렁크 터널 문', 'label', 0, -0.32, -0.015, 0.5, 0.14, '+z');
  b.sign('열림 ↺', 'stencil', 0.36, -0.06, -0.017, 0.18, 0.08, '+z');
  b.collide(-0.25, -0.2, -0.05, 0.25, 0.2, 0.2, 'metal', false);
  const hub = b.world(0, 0, 0.34);
  b.pop();
  const wheel = movingGroup(L, 'wheel5', rooms, (p) => {
    handwheel(p, steel, 0.4, 0.03, 5, true);
    p.cyl(steel, 0.0, 0.4, 0.12, 0.022, 0.16, 'z', 8);
  });
  wheel.mount.position.copy(hub);
  wheel.mount.rotation.y = ry;
  const needles: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const n = movingGroup(L, `wheel5_needle${sx}`, rooms, (p) => { p.rbox('painted_orange', 0, 0.03, 0, 0.006, 0.06, 0.003, 0, 0, 0); p.cyl('painted_orange', 0, 0, 0, 0.008, 0.006, 'z', 8); }, false);
    const wp = new THREE.Vector3(sx * 0.34, 0.24, 0.096).applyAxisAngle(UP, ry).add(new THREE.Vector3(X, Y, Z));
    n.mount.position.copy(wp); n.mount.rotation.y = ry;
    needles.push(n.pivot);
  }
  let k = 0;
  const spin = (t: number) => {
    const u = clamp01(t / WHEEL5.duration);
    k = u;
    const turn = WHEEL5.turns * (minJerk(u) * 0.85 + u * 0.15 + 0.018 * Math.sin(u * PI * 2 * WHEEL5.turns * 2) * Math.sin(u * PI));
    wheel.pivot.rotation.z = turn * TAU;
    const bar = WHEEL5.barFrom * (1 - smooth(ramp(u, 0.15, 0.95)));
    for (const [i, n] of needles.entries()) n.rotation.z = (135 * PI / 180) - (bar / 250) * (270 * PI / 180) + (i ? 0.02 : 0);
  };
  spin(0);
  const root = wheel.mount;
  root.userData.spin = spin;
  root.userData.set = (v: number) => spin(clamp01(v) * WHEEL5.duration);
  Object.defineProperty(root.userData, 'k', { get: () => k, enumerable: true });
  root.userData.hub = hub.clone();
  L.objects.set('wheel5', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ LAUNCH CONSOLE

export interface ConsoleOpts { x?: number; y?: number; z?: number; face?: '+z' | '-z'; rooms?: string[] }
/**
 * The launch console on the bridge (§2.6, D14, §8.8.7). Origin = `mk5_launch` (34.0, 4.8, −34.15): the floor point
 * at the console's BACK edge centre (on the bridge's north edge); `face` −z = the operator side, so the body
 * spans z −34.65 … −34.15 and its operator stands at z ≈ −35.0 looking north, over the console, down at TERN's sail.
 * A pedestal 1.4 wide, a sloped desk (h 0.95 front … 1.1 back), the `launch` screen 0.56 × 0.36 on the slope
 * (`L.screen('launch', 'launch', …)`, text `idle`; the story sets `running|<s>` / `complete`), the palm plate `launch5_palm` (`L.screen(…, 'palm', …)`, text
 * `white|standby|LAUNCH|1.6`) in a raised guard to its right, two guarded toggles, a key switch, a placard
 * `SDV 턴 — 발사 관제`. Collider: the pedestal (nav). Calls: zone only (`navy_grey`, `painted_dark`,
 * `steel_raw`, `painted_orange`, sign atlas) + the two screens. `userData`: `palmPoint` (world: the plate's centre,
 * 4 cm out — W4's interact goes here, R8 from the bridge), `screenPoint`, `palmNormal`.
 */
export function launchConsole(L: LevelBuild, b: Builder, o: ConsoleOpts = {}): THREE.Object3D {
  const X = o.x ?? 34.0, Y = o.y ?? 4.8, Z = o.z ?? -34.15, face = o.face ?? '-z';
  const ry = face === '-z' ? PI : 0; // local +z = operator side
  const body: Mat = libOr(L, 'navy_grey', 'wall_panel_dark'), dark: Mat = 'painted_dark', steel: Mat = 'steel_raw';
  const D = 0.5, Wd = 1.4, hf = 0.95, hb = 1.1, slope = Math.atan2(hb - hf, D - 0.08);
  b.push(X, Y, Z, ry);
  // pedestal (back at local z 0, front at z D)
  // (the toe kick is a 6 cm recess under the pedestal with side plinths — it stood 1 mm proud of the front: z-fight)
  b.bx(body, -Wd / 2, 0.12, 0, Wd / 2, hf - 0.02, D);
  b.bx(body, -Wd / 2, 0, 0, -Wd / 2 + 0.05, 0.12, D).bx(body, Wd / 2 - 0.05, 0, 0, Wd / 2, 0.12, D);
  b.bx(dark, -Wd / 2 + 0.05, 0, 0, Wd / 2 - 0.05, 0.12, D - 0.06); // toe kick
  b.bx(body, -Wd / 2, hf - 0.02, 0, Wd / 2, hb, 0.08);
  // sloped desk top
  b.push(0, (hf + hb) / 2, (D + 0.08) / 2, 0, slope);
  b.box(body, 0, 0, 0, Wd, 0.04, Math.hypot(D - 0.08, hb - hf) + 0.03);
  b.pop();
  const onSlope = (lx: number, along: number, off = 0.022) => {
    // along = 0 at the front edge … 1 at the back edge of the slope; returns local point + world
    const zz = D - along * (D - 0.08), yy = hf + along * (hb - hf);
    return new THREE.Vector3(lx, yy + off * Math.cos(slope), zz + off * Math.sin(slope));
  };
  // screen bezel + guarded palm + toggles + key
  const sc = onSlope(-0.18, 0.5, 0.025);
  b.push(sc.x, sc.y, sc.z, 0, slope); b.box(dark, 0, 0, 0, 0.64, 0.02, 0.44); b.pop();
  const pc = onSlope(0.42, 0.5, 0.03);
  b.push(pc.x, pc.y, pc.z, 0, slope);
  b.box(dark, 0, 0, 0, 0.26, 0.03, 0.32);
  b.box(steel, -0.14, 0.02, 0, 0.02, 0.05, 0.34).box(steel, 0.14, 0.02, 0, 0.02, 0.05, 0.34).box(steel, 0, 0.02, -0.16, 0.3, 0.05, 0.02);
  b.pop();
  for (const lx of [-0.58, -0.5]) {
    const t = onSlope(lx, 0.35, 0.03);
    b.push(t.x, t.y, t.z, 0, slope); b.box(dark, 0, 0, 0, 0.05, 0.03, 0.08); b.box('painted_orange', 0, 0.035, 0.0, 0.05, 0.035, 0.08); b.pop();
  }
  const kp = onSlope(0.42, 0.12, 0.03);
  b.push(kp.x, kp.y, kp.z, 0, slope); b.cyl(steel, 0, 0, 0, 0.03, 0.03, 'y', 12); b.box(steel, 0, 0.03, 0, 0.012, 0.03, 0.04); b.pop();
  b.sign('SDV 턴 — 발사 관제', 'label', 0, hb - 0.06, 0.081, 0.9, 0.09, '+z');
  b.sign('장교 손바닥 인증 — 함장/부함장', 'stencil', 0.42, hf - 0.15, D + 0.002, 0.42, 0.07, '+z');
  // bracket to the bridge edge
  b.bx(steel, -0.5, 0, -0.06, 0.5, 0.06, 0);
  b.collide(-Wd / 2, 0, 0, Wd / 2, hb, D, 'metal', true);
  const wsc = b.world(sc.x, sc.y + 0.012 * Math.cos(slope), sc.z + 0.012 * Math.sin(slope));
  const wpc = b.world(pc.x, pc.y + 0.018 * Math.cos(slope), pc.z + 0.018 * Math.sin(slope));
  b.pop();
  // screens: normal = local +z tilted up by (90° − slope)… i.e. the slope's normal
  const tilt = -(PI / 2 - slope);
  const sMesh = L.screen('launch', 'launch', 0.56, 0.36, wsc.x, wsc.y, wsc.z, face === '-z' ? '-z' : '+z', { tilt, text: 'idle' });
  const pMesh = L.screen('launch5_palm', 'palm', 0.2, 0.26, wpc.x, wpc.y, wpc.z, face === '-z' ? '-z' : '+z', { tilt, text: 'white|standby|LAUNCH|1.6' });
  for (const m of [sMesh, pMesh]) m.userData.rooms = o.rooms ?? b.rooms.slice();
  const n = new THREE.Vector3(0, Math.sin(PI / 2 - slope), Math.cos(PI / 2 - slope)).applyAxisAngle(UP, ry);
  const root = new THREE.Object3D(); root.name = 'launch5_console'; root.position.set(X, Y, Z); root.rotation.y = ry;
  root.userData.palmPoint = wpc.clone().addScaledVector(n, 0.04);
  root.userData.palmNormal = n;
  root.userData.screenPoint = wsc.clone();
  L.root.add(root); L.objects.set('launch5_console', root);
  return root;
}

// ═════════════════════════════════════════════════════════════ BOOTH BACK DOOR

export interface BoothDoorOpts { x?: number; y?: number; z?: number; w?: number; h?: number; rooms?: string[]; open?: number }
/**
 * The guard booth's back door (§2.6 gate5, D15, `gate5_booth`): a hinged steel door in the gatehouse's east wall
 * (face x 5.8) at z −3.2 that swings INTO the booth (toward −x) on its south hinge (z −3.6) and settles shut. Behind
 * it: black (a dark recess quad on the wall face — the corridor beyond is never lit and nobody is ever there). Origin
 * = the floor point on the wall face at the door's centre. Leaf 0.8 × 2.05, a lever, a closer arm, a small wired-glass
 * vision panel (dark). `set(k)`: 0 shut … 1 = 70° open. `settle(seconds = 1.2, onLatch?)`: from where it is, the closer
 * pulls it shut (accelerating, the last 10° checked), a 1.5° rebound at the latch; `onLatch` fires at the latch
 * moment (the vignette plays `booth_door_shut` there). Initial openness `open` (default 0.35 = ajar 25°). The leaf is a
 * registered mover. Calls: leaf (2: `navy_grey` + its dark vision panel) + frame / recess in the zone. No collider (the booth is never entered).
 */
export function boothBackDoor(L: LevelBuild, b: Builder, o: BoothDoorOpts = {}): THREE.Object3D {
  const X = o.x ?? 5.8, Y = o.y ?? 0, Z = o.z ?? -3.2, w = o.w ?? 0.8, h = o.h ?? 2.05, rooms = o.rooms ?? b.rooms.slice();
  const RY = -PI / 2; // local +z → world −x (into the booth), local +x → world +z
  const leafMat: Mat = libOr(L, 'navy_grey', 'wall_panel_dark'), dark: Mat = 'painted_dark';
  const black = mat5(L, 'sp5_black', () => new THREE.MeshBasicMaterial({ name: 'void_black', color: 0x000000 }));
  b.push(X, Y, Z, RY);
  b.quad(black, 0, h / 2, 0, w, h, '+z', 0, 'unit', 0.003);
  b.bx(leafMat, -w / 2 - 0.07, 0, 0, -w / 2, h + 0.07, 0.06).bx(leafMat, w / 2, 0, 0, w / 2 + 0.07, h + 0.07, 0.06).bx(leafMat, -w / 2, h, 0, w / 2, h + 0.07, 0.06);
  b.bx(dark, -w / 2, 0, 0, w / 2, 0.02, 0.05);
  b.pop();
  // the leaf (pivot on the south jamb = local x −w/2), authored from the hinge: extends +x
  const leaf = movingGroup(L, 'booth5_backdoor', rooms, (p) => {
    p.bx(leafMat, 0.005, 0.01, 0.012, w - 0.005, h - 0.01, 0.052);
    p.bx(dark, w * 0.35, h * 0.68, 0.052, w * 0.65, h * 0.85, 0.056);
    p.bx(leafMat, w - 0.12, 1.02, 0.052, w - 0.07, 1.06, 0.1);
    p.bx(leafMat, w - 0.22, 1.02, 0.09, w - 0.07, 1.05, 0.105);
    p.bx(leafMat, 0.06, h - 0.1, 0.052, 0.4, h - 0.07, 0.085);
    for (const yy of [0.3, h - 0.35]) p.cyl(leafMat, 0.0, yy, 0.03, 0.018, 0.14, 'y', 8);
  });
  const hp = new THREE.Vector3(-w / 2, 0, 0).applyAxisAngle(UP, RY).add(new THREE.Vector3(X, Y, Z));
  leaf.mount.position.copy(hp); leaf.mount.rotation.y = RY;
  let k = clamp01(o.open ?? 0.35);
  const MAXA = 70 * PI / 180;
  const set = (v: number) => { k = v; leaf.pivot.rotation.y = -k * MAXA; };
  set(k);
  const root = leaf.mount;
  root.userData.set = (v: number) => set(clamp01(v));
  root.userData.settle = (seconds = 1.2, onLatch?: () => void) => {
    const k0 = k, latchAt = 0.88;
    // the closer pulls (accelerating), checks over the last 15 %, a small rebound off the latch
    const pull = (q: number) => (q < 0.8 ? 0.85 * (q / 0.8) ** 2 : 0.85 + 0.15 * smooth((q - 0.8) / 0.2));
    L.tween(0, seconds, (u) => {
      if (u < latchAt) set(k0 * (1 - pull(u / latchAt)));
      else { const q = (u - latchAt) / (1 - latchAt); set(Math.sin(q * PI) * 0.022 * (1 - q)); }
    }, () => set(0));
    L.after(seconds * latchAt, () => { set(0); try { onLatch?.(); } catch (e) { console.warn('[booth5_backdoor] onLatch failed', e); } });
  };
  Object.defineProperty(root.userData, 'k', { get: () => k, enumerable: true });
  L.objects.set('booth5_backdoor', root);
  return root;
}
