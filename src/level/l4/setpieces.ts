/**
 * LEVEL 4 set pieces (stage 3b §8.5 W9a, §4.4, §13 B3/S4/S5): the theatre's surgical arm with its 40 s cycle and
 * 7 cm status ring, the operating table + E. Strand's body, the gel bath, the FAILED bin, the Clasp prop (static,
 * instanced and the handled theatre Clasp with its 3 cm halo), and the dead scientists' bodies.
 *
 * Everything here is level-internal and procedural. Callers (the D-task dressings) place things from the plan's
 * coordinates; every helper takes world coordinates (or a builder transform) and never reads story state.
 *
 * LED vocabulary (D9): `amber` steady = powered, not linked · `red` blinking 1 Hz (0.12 s on, per-instance phase) =
 * linked · `red_solid` (handshake only) · `off` = unpowered / failed. One shared time uniform drives every static LED;
 * the theatre's ring, handled-Clasp LED and halo share ONE private uniform set driven by the arm's cycle.
 *
 * Draw calls: the arm is one skinned mesh per material (white shell, steel, dark, LED) + the halo quad = 5; its rail
 * goes into the caller's static builder. Static Clasps / bodies / table / bath / bin merge into the caller's builder
 * (library materials + a few private ones, cached per level: tyvek / nitrile / visor / skin / hair / gel / LED states).
 */
import * as THREE from 'three';
import type { GameContext, MaterialName } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { rng } from '../builder';
import { skinParts } from '../machines';

const PI = Math.PI;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

/** Min-jerk ease (zero velocity and acceleration at both ends). */
export const minJerk = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * k * (10 + k * (-15 + 6 * k)); };

// ───────────────────────────────────────────────────────────── materials (per level, cached)

interface Mats {
  tyvek: THREE.Material; stainless: THREE.Material; nitrile: THREE.Material; visor: THREE.Material; skin: THREE.Material;
  hair: THREE.Material; gel: THREE.Material; sole: THREE.Material; shirt: THREE.Material; pad: THREE.Material;
}
const MATS = new WeakMap<LevelBuild, Mats>();
/** A library material if it exists (shared → merges with the zone), else a private stand-in (W6 lands `tyvek`, `stainless`). */
function libOr(ctx: GameContext, name: MaterialName, fb: MaterialName, over: Partial<THREE.MeshStandardMaterialParameters>): THREE.Material {
  const m = ctx.materials.get(name);
  if (m.name === name) return m;
  const c = ctx.materials.clone(fb, over);
  c.name = `${name}_standin`;
  return c;
}
/** Short dark hair: dense strands along v (crown → hairline) over a near-black base, a few grey-brown highlights. */
function hairTexture(): THREE.Texture {
  const W = 256, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#17120f'; g.fillRect(0, 0, W, H);
  const R = rng(4471);
  for (let i = 0; i < 5200; i++) {
    const x = R() * W, y = R() * H, l = 5 + R() * 12, a = (R() - 0.5) * 0.5;
    g.strokeStyle = R() < 0.7 ? `rgba(8,6,5,${0.5 + R() * 0.4})` : `rgba(${90 + R() * 30 | 0},${76 + R() * 24 | 0},${64 + R() * 20 | 0},${0.25 + R() * 0.3})`;
    g.lineWidth = R() < 0.8 ? 1 : 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function setpieceMats(L: LevelBuild): Mats {
  let m = MATS.get(L);
  if (m) return m;
  const M = L.ctx.materials;
  const named = (mat: THREE.MeshStandardMaterial, n: string) => { mat.name = n; return mat; };
  m = {
    tyvek: libOr(L.ctx, 'tyvek', 'plastic_white', { color: 0xf1f2ee, roughness: 0.9, metalness: 0 }),
    stainless: libOr(L.ctx, 'stainless', 'plastic_white', { color: 0xb4babe, roughness: 0.3, metalness: 0 }),
    nitrile: named(M.clone('plastic_white', { color: 0x5f7fc4, roughness: 0.55, metalness: 0 }), 'sp4_nitrile'),
    // fogged visor: milky, slightly glossy, opaque (no transparent call, no face behind it)
    visor: named(M.clone('plastic_white', { color: 0xc6d0d4, roughness: 0.28, metalness: 0 }), 'sp4_visor'),
    // dead pallor: cold grey, not a warm doll tone (B1)
    skin: named(M.clone('plastic_white', { color: 0xb3aaa6, map: null, normalMap: null, roughness: 0.62, metalness: 0 }), 'sp4_skin'),
    // close-cropped dark hair: strands from the crown down (sphere v), never a smooth brown cap (B1)
    hair: named(M.clone('plastic_dark', { color: 0xffffff, map: hairTexture(), normalMap: null, roughness: 0.82, metalness: 0 }), 'sp4_hair'),
    gel: named(new THREE.MeshStandardMaterial({ color: 0x4f8796, roughness: 0.04, metalness: 0, emissive: 0x061418, emissiveIntensity: 1 }), 'sp4_gel'),
    sole: M.get('rubber'),
    shirt: M.get('cloth_coverall'),
    pad: named(M.clone('plastic_dark', { color: 0x3a4a5a, roughness: 0.6, metalness: 0 }), 'sp4_pad'),
  };
  MATS.set(L, m);
  return m;
}

// ───────────────────────────────────────────────────────────── LED material (D9)

export type LedState = 'amber' | 'red' | 'red_solid' | 'off';
const STATE_NUM: Record<LedState, number> = { off: 0, amber: 1, red: 2, red_solid: 3 };
export const LED_AMBER = new THREE.Color(0xff7414);
export const LED_RED = new THREE.Color(0xff1a08);
/** Emissive gain of a lit LED (bloom threshold 0.85: a 4 mm lens needs to be well over it to read). */
const LED_GAIN = 9;

interface LedKit { time: { value: number }; mats: Map<string, THREE.MeshStandardMaterial> }
const LEDS = new WeakMap<LevelBuild, LedKit>();
function ledKit(L: LevelBuild): LedKit {
  let k = LEDS.get(L);
  if (!k) {
    k = { time: { value: 0 }, mats: new Map() };
    const kit = k;
    LEDS.set(L, k);
    L.updaters.push((_dt, t) => { kit.time.value = t; });
  }
  return k;
}

const LED_GLSL = /* glsl */`
uniform float uLedTime;
uniform float uLedState;
varying float vLedPhase;
vec3 ledEmission() {
  float st = uLedState;
  if (st < 0.5) return vec3(0.0);
  if (st < 1.5) return vec3(${LED_AMBER.r.toFixed(4)}, ${LED_AMBER.g.toFixed(4)}, ${LED_AMBER.b.toFixed(4)}) * ${LED_GAIN.toFixed(1)};
  vec3 red = vec3(${LED_RED.r.toFixed(4)}, ${LED_RED.g.toFixed(4)}, ${LED_RED.b.toFixed(4)}) * ${LED_GAIN.toFixed(1)};
  if (st > 2.5) return red;
  float c = fract(uLedTime + vLedPhase);
  return c < 0.12 ? red : vec3(0.0);
}`;
const LED_DYN_GLSL = /* glsl */`
uniform vec3 uLedCol;
uniform float uLedI;
varying float vLedPhase;
vec3 ledEmission() { return uLedCol * uLedI; }`;
const LED_VERT = /* glsl */`
#ifdef USE_INSTANCING
  vLedPhase = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
#else
  vLedPhase = uv.x;
#endif`;

function ledBase(name: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name, color: 0x140a08, roughness: 0.22, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1 });
  // REVISION 5.1: lenses win their depth test against the shell they sit on
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  return m;
}
function patchLed(m: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>, frag: string) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLedPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LED_VERT}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${frag}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = ledEmission();');
  };
}

/** Shared LED lens material of one state (all static Clasps of that state; red blinks with a per-Clasp phase). */
export function ledMaterial(L: LevelBuild, state: LedState): THREE.MeshStandardMaterial {
  const k = ledKit(L);
  let m = k.mats.get(state);
  if (!m) {
    m = ledBase(`clasp_led_${state}`);
    patchLed(m, { uLedTime: k.time, uLedState: { value: STATE_NUM[state] } }, LED_GLSL);
    m.customProgramCacheKey = () => 'clasp_led_static';
    k.mats.set(state, m);
  }
  return m;
}

/** A driven LED: ONE uniform set shared by the theatre's ring, the handled Clasp's lens and its halo. */
export interface LedDriver { mat: THREE.MeshStandardMaterial; col: { value: THREE.Color }; i: { value: number }; set(state: LedState | 'blink_on', on?: boolean): void }
export function ledDriver(name: string): LedDriver {
  const col = { value: new THREE.Color(0, 0, 0) }, i = { value: 0 };
  const mat = ledBase(name);
  patchLed(mat, { uLedCol: col, uLedI: i }, LED_DYN_GLSL);
  mat.customProgramCacheKey = () => 'clasp_led_dyn';
  return {
    mat, col, i,
    set(state, on = true) {
      if (state === 'off' || !on) { i.value = 0; return; }
      col.value.copy(state === 'amber' ? LED_AMBER : LED_RED);
      i.value = LED_GAIN;
    },
  };
}

/** The 3 cm additive halo (B3): a camera-facing quad that never shrinks below `minPx` pixels (half-size). */
export function ledHalo(drv: LedDriver, size = 0.03, minPx = 8, gain = 1): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.5);
  const pxScale = { value: 0.0015 };
  const mat = new THREE.ShaderMaterial({
    name: 'clasp_halo',
    uniforms: { uLedCol: drv.col, uLedI: drv.i, uSize: { value: size }, uMinPx: { value: minPx }, uPxScale: pxScale, uGain: { value: gain } },
    vertexShader: /* glsl */`
      uniform float uSize; uniform float uMinPx; uniform float uPxScale;
      varying vec2 vQ;
      void main() {
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float d = max(0.05, -mv.z);
        float s = max(uSize, uMinPx * uPxScale * d);
        // pulled toward the eye by its own size: the quad clears the neck / tool it sits on from any angle
        mv.xyz += normalize(-mv.xyz) * max(0.035, 1.1 * s);
        d = max(0.05, -mv.z);
        mv.xy += position.xy * s;
        vQ = position.xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLedCol; uniform float uLedI; uniform float uGain;
      varying vec2 vQ;
      void main() {
        float r2 = dot(vQ, vQ);
        float a = exp(-r2 * 5.0) * (1.0 - smoothstep(0.7, 1.0, r2)) + 0.6 * exp(-r2 * 40.0);
        gl_FragColor = vec4(uLedCol * (uLedI * 0.22 * uGain * a), 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'clasp_halo';
  mesh.renderOrder = 10;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.onBeforeRender = (r, _s2, cam) => {
    const pc = cam as THREE.PerspectiveCamera;
    const h = r.getRenderTarget()?.height ?? r.domElement.height;
    pxScale.value = (2 * Math.tan(((pc.fov ?? 60) * PI) / 360)) / Math.max(1, h) / (pc.zoom ?? 1);
  };
  return mesh;
}

// ───────────────────────────────────────────────────────────── the Clasp (9 × 6 × 2 cm collar)

/**
 * Local frame: origin = centre of the pad's contact face; +z = outward (the shell's back); x = the 9 cm side
 * (wraps round the neck); y = the 6 cm side (along the neck). Curved round y with radius 6.5 cm.
 */
export const CLASP = { w: 0.09, h: 0.06, d: 0.02, R: 0.065, led: new THREE.Vector3(0, 0.021, 0.0175) } as const;

/** Bend a geometry round the y axis: x → arc length at radius R (+z); centre of curvature at (0, 0, −R). */
function bend(g: THREE.BufferGeometry, R: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = x / R, r = R + z;
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), Math.cos(a) * r - R);
  }
  g.computeVertexNormals();
  return g;
}
function roundedSlab(w: number, h: number, d: number, sx: number, sy: number): THREE.BufferGeometry {
  // a box with chamfered outer edges (top face inset), subdivided along x for bending
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) > 0) { p.setX(i, p.getX(i) * (1 - 0.12 * 0.02 / w * 10)); p.setY(i, p.getY(i) * (1 - 0.18 * 0.02 / h * 10)); }
  }
  return g;
}
interface ClaspGeo { shell: THREE.BufferGeometry; pad: THREE.BufferGeometry; pins: THREE.BufferGeometry; led: THREE.BufferGeometry }
let _clasp: ClaspGeo | null = null;
function claspGeo(): ClaspGeo {
  if (_clasp) return _clasp;
  const { w, h, R } = CLASP;
  // shell: 1.4 cm graphite body + a 4 mm raised spine with the LED, all curved to the neck
  const body = roundedSlab(w, h, 0.014, 12, 1); body.translate(0, 0, 0.0035 + 0.007);
  const spine = roundedSlab(w * 0.62, h * 0.38, 0.004, 8, 1); spine.translate(0, 0.006, 0.0175 + 0.002 - 0.004);
  const lugs: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) { const l = new THREE.BoxGeometry(0.008, 0.03, 0.01); l.translate(s * (w / 2 + 0.003), 0, 0.011); lugs.push(l); }
  const shell = bend(mergeGeos([body, spine, ...lugs]), R);
  // ribbed pad: 3.5 mm rubber base + 7 ribs along y
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.BoxGeometry(w * 0.92, h * 0.86, 0.0025, 10, 1, 1); base.translate(0, 0, 0.0025 + 0.00125); parts.push(base);
  for (let i = 0; i < 7; i++) { const r = new THREE.BoxGeometry(0.0035, h * 0.78, 0.0025); r.translate(-w * 0.39 + (i * w * 0.78) / 6, 0, 0.00125); parts.push(r); }
  const pad = bend(mergeGeos(parts), R);
  // two prongs (1.6 mm, 9 mm long) into the neck, either side of the midline
  const pins: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const c = new THREE.CylinderGeometry(0.0008, 0.0016, 0.009, 6); c.rotateX(PI / 2); c.translate(s * 0.012, -0.004, -0.0045); pins.push(c);
  }
  const pinG = mergeGeos(pins);
  // LED: 4 mm lens on the spine's top edge
  const led = new THREE.CylinderGeometry(0.002, 0.002, 0.0015, 10); led.rotateX(PI / 2);
  led.translate(CLASP.led.x, CLASP.led.y, CLASP.led.z);
  const uv = led.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 1, 1); // uv = (1,1): the builder scales it by (phase, 0) → per-Clasp blink phase
  _clasp = { shell, pad, pins: pinG, led };
  return _clasp;
}
function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // non-indexed merge keeping position/normal/uv (all inputs are three primitives)
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of out) n += g.getAttribute('position').count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
  let o = 0;
  for (const g of out) {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const c = g.getAttribute('position').count;
    P.set((g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array, o * 3);
    N.set((g.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array, o * 3);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (uv) U.set(uv.array as Float32Array, o * 2);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  return g;
}

/** Shell / pad / prong materials of a Clasp (graphite, rubber, steel). */
const CLASP_SHELL: MaterialName = 'plastic_dark';
const CLASP_PAD: MaterialName = 'rubber';
const CLASP_PIN: MaterialName = 'chrome';

/**
 * A static Clasp into builder `b` under its current transform (local frame: see `CLASP`). `state` picks the shared
 * LED material; `phase` (0..1) offsets a red blink. `led` = a private LED material instead (the theatre's driver).
 */
export function clasp(b: Builder, L: LevelBuild, state: LedState, phase = 0, led?: THREE.Material, mono?: Mat) {
  const g = claspGeo();
  b.geo(CLASP_SHELL, g.shell, 'box');
  b.detail(() => {
    b.geo(mono ?? CLASP_PAD, g.pad, 'box');
    b.geo(mono ?? CLASP_PIN, g.pins, 'box');
    b.geo(led ?? ledMaterial(L, state), g.led, 'keep', undefined, phase, 0);
  });
}

/** Instanced Clasps: define once per level, then `claspInst(b, …)` stamps one (2 calls per builder + state). */
export function defineClaspInstances(L: LevelBuild) {
  if (L.instDefs.has('clasp4_shell')) return;
  const g = claspGeo();
  L.defineInstance('clasp4_shell', L.ctx.materials.get(CLASP_SHELL), true, (b) => { b.geo(CLASP_SHELL, g.shell, 'box'); b.geo(CLASP_SHELL, g.pad, 'box'); b.geo(CLASP_SHELL, g.pins, 'box'); });
  for (const s of Object.keys(STATE_NUM) as LedState[]) L.defineInstance(`clasp4_led_${s}`, ledMaterial(L, s), false, (b) => b.geo(ledMaterial(L, s), g.led, 'keep'));
}
/** Stamp one instanced Clasp (local frame of `CLASP`; Euler YXZ like `Builder.inst`). Call `defineClaspInstances` first. */
export function claspInst(b: Builder, x: number, y: number, z: number, rx: number, ry: number, rz: number, state: LedState) {
  b.inst('clasp4_shell', x, y, z, rx, ry, rz);
  b.inst(`clasp4_led_${state}`, x, y, z, rx, ry, rz);
}

// ───────────────────────────────────────────────────────────── geometry helpers

/** Capsule along +y from 0 to `len` (radii r0 at the bottom, r1 at the top), lathe-built (uv in metres). */
function capsule(r0: number, r1: number, len: number, radial = 10, step = 0): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 4;
  for (let i = 0; i <= n; i++) { const a = -PI / 2 + (i / n) * (PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r0), Math.sin(a) * r0)); }
  // (cloth: extra rings along the straight part so the folds have vertices to live on)
  if (step > 0) { const k = Math.floor(len / step); for (let i = 1; i < k; i++) { const t = i / k; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, len * t)); } }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), len + Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(pts, radial);
}

/**
 * Cloth folds (integration B1: "bodies read as smooth mannequins"). A displaced copy of `g`: sharp creases along a few
 * random directions (the slack of a baggy coverall) + compression rings round the local y axis (sleeves and legs
 * bunched at the joints). Displacement along the normal in geometry units; normals bent by the displacement's
 * gradient (analytic, so the lathe / sphere seams stay smooth).
 */
function folded(g: THREE.BufferGeometry, seed: number, amp: number, freq: number, ringAmp = 0, ringFreq = 0): THREE.BufferGeometry {
  const out = g.clone();
  const pos = out.getAttribute('position') as THREE.BufferAttribute;
  const nor = out.getAttribute('normal') as THREE.BufferAttribute;
  const R = rng(seed);
  const K = 5;
  const dirs: THREE.Vector3[] = [], fr: number[] = [], ph: number[] = [], am: number[] = [];
  for (let k = 0; k < K; k++) {
    dirs.push(new THREE.Vector3(R.range(-1, 1), R.range(-0.6, 0.6), R.range(-1, 1)).normalize());
    fr.push(freq * R.range(0.6, 1.4)); ph.push(R.range(0, 6.28)); am.push(R.range(0.5, 1));
  }
  const rph = R.range(0, 6.28), rtw = R.range(-1, 1);
  const disp = (x: number, y: number, z: number) => {
    let c = 0;
    for (let k = 0; k < K; k++) {
      const s = Math.abs(Math.sin((x * dirs[k].x + y * dirs[k].y + z * dirs[k].z) * fr[k] + ph[k]));
      const r = 1 - s; c += am[k] * (r * r * r - 0.25);
    }
    let d = amp * c;
    if (ringAmp) { const s = Math.abs(Math.sin(y * ringFreq + Math.atan2(z, x) * rtw + rph)); d += ringAmp * (s ** 8 - 0.12); }
    return d;
  };
  const e = 0.25 / Math.max(freq, ringFreq, 1);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), gr = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    const d = disp(p.x, p.y, p.z);
    gr.set(
      (disp(p.x + e, p.y, p.z) - disp(p.x - e, p.y, p.z)) / (2 * e),
      (disp(p.x, p.y + e, p.z) - disp(p.x, p.y - e, p.z)) / (2 * e),
      (disp(p.x, p.y, p.z + e) - disp(p.x, p.y, p.z - e)) / (2 * e),
    );
    gr.addScaledVector(n, -gr.dot(n));
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
    n.sub(gr).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return out;
}
/** Matrix placing a +y-aligned primitive from A towards B (optional scale on x/z for an elliptic section). */
function alignAB(A: THREE.Vector3, B: THREE.Vector3, sx = 1, sz = 1, roll?: THREE.Vector3): THREE.Matrix4 {
  const d = _v.subVectors(B, A).normalize();
  _q.setFromUnitVectors(UP, d);
  if (roll) {
    // twist so local +z points as close as possible to `roll`
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
    const want = roll.clone().addScaledVector(d, -roll.dot(d)).normalize();
    if (want.lengthSq() > 0.5) {
      const ang = Math.atan2(new THREE.Vector3().crossVectors(z, want).dot(d), z.dot(want));
      _q.premultiply(new THREE.Quaternion().setFromAxisAngle(d, ang));
    }
  }
  return new THREE.Matrix4().compose(A, _q, _w.set(sx, 1, sz));
}

// ───────────────────────────────────────────────────────────── bodies (D7: the ten in Bio; hooded, no faces)

export type BodyPose = 'slumped_wall' | 'lying_back' | 'lying_side' | 'sitting_desk' | 'prone_table' | 'covered_gurney';
export const BODY_POSES: readonly BodyPose[] = ['slumped_wall', 'lying_back', 'lying_side', 'sitting_desk', 'prone_table', 'covered_gurney'];

export interface BodyOpts {
  /** Floor point under the body's origin (world) and its yaw (rad; the body faces local +z before yaw). */
  x: number; y: number; z: number; ry?: number;
  /** Eng: suit peeled to the waist (undershirt, bare head, no mask). */
  suitHalfOff?: boolean;
  /** Holm: world point the right hand reaches to (2-bone IK; the hand lies flat there). */
  armOut?: readonly [number, number, number];
  /** 'walk' = one box 0.15 m high over the footprint (surface flesh), 'none' (default for table / gurney / chair). */
  collider?: 'walk' | 'none';
  /** prone_table: world point the nape must land on (overrides x/y/z; the body lies along −x, head at −x). */
  nape?: readonly [number, number, number];
  /** sitting_desk: desk top height above the floor (0.75) and the chair (true). */
  deskY?: number; chair?: boolean;
  /** Hood + visor + mask (default true; prone_table and suitHalfOff force false). */
  hood?: boolean;
  /** Variation seed (limb splay, head roll). */
  seed?: number;
  /** Name tape on the chest (default true). */
  tape?: boolean;
}
export interface BodyInfo { name: string; pose: BodyPose; position: [number, number, number]; ry: number; box: THREE.Box3; nape?: THREE.Vector3 }

/** Joint table of the mannequin (origin = the pelvis; standing it faces +z, feet 0.92 below; +x = the body's left). */
const SK = {
  pelvis: [null, 0, 0, 0], spine: ['pelvis', 0, 0.1, 0], chest: ['spine', 0, 0.22, 0], neck: ['chest', 0, 0.25, -0.01],
  head: ['neck', 0, 0.11, 0.01],
  shoulder_l: ['chest', 0.185, 0.2, -0.01], elbow_l: ['shoulder_l', 0, -0.29, 0], wrist_l: ['elbow_l', 0, -0.26, 0],
  shoulder_r: ['chest', -0.185, 0.2, -0.01], elbow_r: ['shoulder_r', 0, -0.29, 0], wrist_r: ['elbow_r', 0, -0.26, 0],
  hip_l: ['pelvis', 0.095, -0.06, 0], knee_l: ['hip_l', 0, -0.44, 0], ankle_l: ['knee_l', 0, -0.42, 0],
  hip_r: ['pelvis', -0.095, -0.06, 0], knee_r: ['hip_r', 0, -0.44, 0], ankle_r: ['knee_r', 0, -0.42, 0],
} as const;
type Joint = keyof typeof SK;
/** Pose = root (position + Euler YXZ) + joint Euler XYZ (x = flexion: + bends a limb's far end towards −z / back). */
interface PoseDef { root: [number, number, number, number, number, number]; j: Partial<Record<Joint, [number, number, number]>> }

const deg = PI / 180;
/**
 * Poses. Signs: hip/shoulder x < 0 swings the limb forward (+z); knee x > 0 bends the shin back; elbow x < 0 bends
 * the forearm forward; z on a left joint (+) abducts outward, on a right joint (−) abducts outward.
 */
const POSES: Record<Exclude<BodyPose, 'covered_gurney'>, PoseDef> = {
  // back to a wall at local z < 0, knees drawn up, head dropped onto the chest, hands on the floor
  slumped_wall: {
    root: [0, 0.14, 0.16, 0, -16 * deg, 0],
    j: {
      spine: [14 * deg, 0, 0], chest: [16 * deg, 0, 4 * deg], neck: [38 * deg, 0, 8 * deg], head: [22 * deg, 12 * deg, 10 * deg],
      shoulder_l: [-10 * deg, 0, 14 * deg], elbow_l: [-28 * deg, 0, 0], wrist_l: [0, 0, 0],
      shoulder_r: [-4 * deg, 0, -10 * deg], elbow_r: [-18 * deg, 0, 0],
      hip_l: [-119 * deg, 0, 14 * deg], knee_l: [93 * deg, 0, 0], ankle_l: [42 * deg, 0, 0],
      hip_r: [-110 * deg, 0, -12 * deg], knee_r: [88 * deg, 0, 0], ankle_r: [38 * deg, 0, 0],
    },
  },
  // on the back, head at local −z, arms loose at the sides, feet rolled out, head turned
  lying_back: {
    root: [0, 0.135, 0, 0, -90 * deg, 0],
    j: {
      spine: [-3 * deg, 0, 0], chest: [-2 * deg, 0, 0], neck: [6 * deg, 0, 0], head: [8 * deg, 34 * deg, 12 * deg],
      shoulder_l: [6 * deg, 0, 24 * deg], elbow_l: [-24 * deg, 0, 0],
      shoulder_r: [2 * deg, 0, -18 * deg], elbow_r: [-12 * deg, 0, 0],
      hip_l: [-4 * deg, 22 * deg, 7 * deg], knee_l: [8 * deg, 0, 0], ankle_l: [30 * deg, 0, 0],
      hip_r: [-6 * deg, -26 * deg, -6 * deg], knee_r: [12 * deg, 0, 0], ankle_r: [30 * deg, 0, 0],
    },
  },
  // three-quarter on the right side, knees drawn, arms forward, face towards the floor
  lying_side: {
    root: [0, 0.2, 0, 0, -90 * deg, 0],
    j: {
      pelvis: [0, -62 * deg, 0], spine: [8 * deg, -6 * deg, 0], chest: [10 * deg, -10 * deg, 0], neck: [16 * deg, -20 * deg, 0], head: [10 * deg, -30 * deg, 0],
      shoulder_l: [-64 * deg, 0, 6 * deg], elbow_l: [-40 * deg, 0, 0],
      shoulder_r: [-84 * deg, 0, -10 * deg], elbow_r: [-20 * deg, 0, 0],
      hip_l: [-48 * deg, 0, 4 * deg], knee_l: [66 * deg, 0, 0], ankle_l: [24 * deg, 0, 0],
      hip_r: [-22 * deg, 0, -4 * deg], knee_r: [40 * deg, 0, 0], ankle_r: [24 * deg, 0, 0],
    },
  },
  // seated, folded over the desk at local +z, head on the forearms (face down into them)
  sitting_desk: {
    root: [0, 0.6, 0, 0, 0, 0],
    j: {
      pelvis: [8 * deg, 0, 0], spine: [26 * deg, 0, 0], chest: [30 * deg, 0, 0], neck: [18 * deg, 0, 0], head: [30 * deg, -10 * deg, 6 * deg],
      shoulder_l: [-114 * deg, 0, 16 * deg], elbow_l: [-40 * deg, 0, 0], wrist_l: [0, 0, 0],
      shoulder_r: [-110 * deg, 0, -20 * deg], elbow_r: [-46 * deg, 0, 0],
      hip_l: [-88 * deg, 0, 8 * deg], knee_l: [84 * deg, 0, 0], ankle_l: [-4 * deg, 0, 0],
      hip_r: [-86 * deg, 0, -6 * deg], knee_r: [96 * deg, 0, 0], ankle_r: [6 * deg, 0, 0],
    },
  },
  // face down on the operating table, arms tucked at the sides, face in the cradle (head at local −z before yaw)
  prone_table: {
    root: [0, 0, 0, -90 * deg, 90 * deg, 0],
    j: {
      neck: [6 * deg, 0, 0], head: [12 * deg, 0, 0],
      shoulder_l: [4 * deg, 0, 3 * deg], elbow_l: [-6 * deg, 0, 0],
      shoulder_r: [4 * deg, 0, -3 * deg], elbow_r: [-6 * deg, 0, 0],
      hip_l: [0, 0, 2 * deg], knee_l: [4 * deg, 0, 0], ankle_l: [62 * deg, 0, 0],
      hip_r: [0, 0, -2 * deg], knee_r: [4 * deg, 0, 0], ankle_r: [62 * deg, 0, 0],
    },
  },
};

interface Skel { o: Record<Joint, THREE.Object3D>; root: THREE.Object3D }
function skeleton(def: PoseDef, R: ReturnType<typeof rng>): Skel {
  const o = {} as Record<Joint, THREE.Object3D>;
  const root = new THREE.Object3D();
  for (const k of Object.keys(SK) as Joint[]) {
    const [parent, x, y, z] = SK[k];
    const j = new THREE.Object3D();
    j.position.set(x, y, z);
    const r = def.j[k];
    // small per-body variation on the limbs (never on the spine chain: the poses' contact points rely on it)
    const jit = /elbow|shoulder|ankle/.test(k) ? 3 * deg : /hip|knee/.test(k) ? 1.5 * deg : 0;
    if (r) j.rotation.set(r[0] + R.range(-jit, jit), r[1] + R.range(-jit, jit), r[2] + R.range(-jit, jit), 'XYZ');
    (parent ? o[parent as Joint] : root).add(j);
    o[k] = j;
  }
  const [px, py, pz, ry, rx, rz] = def.root;
  root.position.set(px, py, pz);
  root.rotation.set(rx, ry, rz, 'YXZ');
  root.updateMatrixWorld(true);
  return { o, root };
}
const wp = (j: THREE.Object3D, x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(j.matrixWorld);
const wd = (j: THREE.Object3D, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).transformDirection(j.matrixWorld);

/** A capsule list (body-local) for sheets / footprints: [A, B, rA, rB]. */
type Cap = [THREE.Vector3, THREE.Vector3, number, number];

/** 2-bone IK in body space: elbow towards `pole`; returns [elbow, wrist]. */
function ik2(S: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const d = new THREE.Vector3().subVectors(T, S);
  const D = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  d.normalize();
  const W = S.clone().addScaledVector(d, D);
  const a = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D);
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  const E = S.clone().addScaledVector(d, l1 * a).addScaledVector(p, l1 * Math.sqrt(Math.max(0, 1 - a * a)));
  return [E, W];
}

/**
 * A dead scientist (§8.5.4): Tyvek suit, hood + fogged visor (no face), respirator, taped nitrile gloves, overboots,
 * name tape. Static geometry into builder `b` (world). Registers the body in `mk4_bodies.userData.list`.
 */
export function body(L: LevelBuild, b: Builder, pose: BodyPose, name: string, opts: BodyOpts): BodyInfo {
  const M = setpieceMats(L);
  const R = rng(opts.seed ?? hashStr(name));
  const ry = opts.ry ?? 0;
  let ox = opts.x, oy = opts.y, oz = opts.z;
  const caps: Cap[] = [];
  const box = new THREE.Box3();
  let nape: THREE.Vector3 | undefined;

  if (pose === 'covered_gurney') {
    b.push(ox, oy, oz, ry);
    const sk = skeleton(POSES.lying_back, R);
    sk.root.position.y += 0.86 - 0.0; // on the mattress
    sk.root.updateMatrixWorld(true);
    collectCaps(sk, caps, false);
    gurney4(b, M);
    sheet(b, L, M, caps, name);
    b.pop();
    box.setFromCenterAndSize(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0.8, 1.2, 2.1));
    box.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(ox, oy, oz));
    return register(L, { name, pose, position: [ox, oy, oz], ry, box });
  }

  const def = POSES[pose];
  // a bare head (no hood) must never show a face: on its side the body rolls nearly prone, face into the floor
  const sk = skeleton(pose === 'lying_side' && opts.suitHalfOff ? {
    root: def.root,
    j: { ...def.j, pelvis: [0, -84 * deg, 0], chest: [10 * deg, -4 * deg, 0], neck: [10 * deg, 0, 0], head: [6 * deg, 0, 0] },
  } : def, R);
  const halfOff = !!opts.suitHalfOff;
  const hood = opts.hood ?? !(pose === 'prone_table' || halfOff);
  if (!hood && pose !== 'prone_table') {
    // B1: a bare head lies face down — the face pressed into the floor, the crown and the back of the head up; seen
    // from any side it is hair, an ear and the nape, never a face
    const head = sk.o.head;
    const f = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
    const q = new THREE.Quaternion().setFromUnitVectors(f, new THREE.Vector3(0.15, -1, 0).normalize());
    const wq = head.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
    const pq = head.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    head.quaternion.copy(pq.multiply(wq));
    sk.root.updateMatrixWorld(true);
    // lift the whole body until the skull clears the floor (skull centre 0.1 up the head, radius ≈ 0.105)
    const c = wp(head, 0, 0.1, 0.015);
    if (c.y < 0.1) { sk.root.position.y += 0.1 - c.y; sk.root.updateMatrixWorld(true); }
  }

  if (pose === 'prone_table') {
    // lay the body on its front at table height, then slide it so the nape lands on the requested point
    sk.root.position.set(0, 0, 0); sk.root.updateMatrixWorld(true);
    const n0 = napePoint(sk);
    const target = opts.nape ? new THREE.Vector3(...opts.nape) : new THREE.Vector3(opts.x, opts.y + 1.08, opts.z);
    // body yaw: default lies along −x (head at −x); body-local → world is T(origin) · Ry(ry)
    const rot = new THREE.Matrix4().makeRotationY(ry);
    const n0w = n0.clone().applyMatrix4(rot);
    ox = target.x - n0w.x; oy = target.y - n0w.y; oz = target.z - n0w.z;
  }

  // world → body-local for IK targets
  const toLocal = new THREE.Matrix4().copy(b.m).multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(ox, oy, oz)).invert();
  let armR: [THREE.Vector3, THREE.Vector3] | null = null;
  if (opts.armOut) {
    const S = wp(sk.o.shoulder_r);
    const T = new THREE.Vector3(...opts.armOut).applyMatrix4(toLocal);
    T.y = Math.max(T.y, 0.035); // the glove lies on the floor
    const pole = wd(sk.o.chest, -0.6, 0.0, 0).add(new THREE.Vector3(0, 0.5, 0));
    armR = ik2(S, T.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.29, 0.26 + 0.07, pole);
  }

  b.push(ox, oy, oz, ry);
  if (pose === 'sitting_desk' && opts.chair !== false) b.at(0, 0, -0.02, PI, () => labChair(b, M));
  drawBody(b, L, M, sk, { hood, halfOff, armR, name, tape: opts.tape !== false, caps, prone: pose === 'prone_table' });
  if (pose === 'prone_table') nape = napePoint(sk).applyMatrix4(new THREE.Matrix4().copy(b.m));
  b.pop();

  // footprint (world) from the capsules
  const toWorld = new THREE.Matrix4().copy(b.m).multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(ox, oy, oz));
  for (const [A, B, ra, rb] of caps) {
    box.expandByPoint(A.clone().applyMatrix4(toWorld).addScalar(ra)).expandByPoint(A.clone().applyMatrix4(toWorld).addScalar(-ra));
    box.expandByPoint(B.clone().applyMatrix4(toWorld).addScalar(rb)).expandByPoint(B.clone().applyMatrix4(toWorld).addScalar(-rb));
  }
  const col = opts.collider ?? (pose === 'prone_table' || pose === 'sitting_desk' ? 'none' : 'walk');
  if (col === 'walk') {
    // one walkable box, 0.15 m high, over the footprint (world-aligned: the builder transform is identity for zones)
    b.push(0, 0, 0).m.identity();
    b.collide(box.min.x, opts.y, box.min.z, box.max.x, opts.y + 0.15, box.max.z, 'flesh', true);
    b.pop();
  }
  return register(L, { name, pose, position: [ox, oy, oz], ry, box, nape });
}

function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function register(L: LevelBuild, info: BodyInfo): BodyInfo {
  let mk = L.objects.get('mk4_bodies');
  if (!mk) { mk = L.marker('mk4_bodies', 0, 0, 0); mk.userData.list = []; }
  (mk.userData.list as unknown[]).push({ name: info.name, pose: info.pose, position: info.position, ry: info.ry, box: [info.box.min.toArray(), info.box.max.toArray()] });
  return info;
}

/** The nape: back of the neck, 4 cm above its base (body-local). */
function napePoint(sk: Skel): THREE.Vector3 {
  return wp(sk.o.neck, 0, 0.045, -0.058);
}

function collectCaps(sk: Skel, caps: Cap[], _arms: boolean) {
  const o = sk.o;
  caps.push([wp(o.pelvis, 0, -0.02, 0), wp(o.chest, 0, 0.16, 0), 0.16, 0.17]);
  caps.push([wp(o.neck), wp(o.head, 0, 0.1, 0), 0.07, 0.12]);
  for (const s of ['l', 'r'] as const) {
    caps.push([wp(o[`shoulder_${s}`]), wp(o[`elbow_${s}`]), 0.07, 0.06]);
    caps.push([wp(o[`elbow_${s}`]), wp(o[`wrist_${s}`], 0, -0.12, 0), 0.06, 0.045]);
    caps.push([wp(o[`hip_${s}`]), wp(o[`knee_${s}`]), 0.1, 0.075]);
    caps.push([wp(o[`knee_${s}`]), wp(o[`ankle_${s}`]), 0.07, 0.06]);
    caps.push([wp(o[`ankle_${s}`]), wp(o[`ankle_${s}`], 0, -0.03, 0.17), 0.06, 0.05]);
  }
}

interface DrawOpts { hood: boolean; halfOff: boolean; armR: [THREE.Vector3, THREE.Vector3] | null; name: string; tape: boolean; caps: Cap[]; prone: boolean }

function drawBody(b: Builder, L: LevelBuild, M: Mats, sk: Skel, o: DrawOpts) {
  const J = sk.o;
  const suit = M.tyvek;
  const top = o.halfOff ? M.shirt : suit;
  // cloth (Tyvek, the undershirt) gets folds: denser tessellation + creases + bunching rings (B1)
  let foldSeed = hashStr(o.name) & 0xffff;
  const cloth = (mat: Mat) => mat === suit || mat === M.shirt;
  const seg = (mat: Mat, A: THREE.Vector3, B: THREE.Vector3, ra: number, rb: number, radial = 10, cap = true) => {
    const len = A.distanceTo(B);
    if (len < 1e-4) return;
    const g = cloth(mat) && ra > 0.03
      ? folded(capsule(ra, rb, len, Math.max(radial, 16), 0.035), ++foldSeed * 7919, 0.0032, 60, 0.0055, 62)
      : capsule(ra, rb, len, radial);
    b.geo(mat, g, 'box', alignAB(A, B));
    if (cap) o.caps.push([A.clone(), B.clone(), ra, rb]);
  };
  const ell = (mat: Mat, j: THREE.Object3D, cx: number, cy: number, cz: number, rx: number, ryy: number, rz: number, seg2 = 14, rot?: THREE.Euler) => {
    const m = new THREE.Matrix4().copy(j.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(rot ?? _e.set(0, 0, 0)), new THREE.Vector3(rx, ryy, rz)));
    const g = cloth(mat) && Math.max(rx, ryy, rz) > 0.05 ? folded(sphereGeo(Math.max(seg2, 26)), ++foldSeed * 7919, 0.03, 7.5) : sphereGeo(seg2);
    b.geo(mat, g, 'box', m);
  };

  // ── torso: pelvis, waist, chest (baggy suit: generous radii), zip
  ell(suit, J.pelvis, 0, 0.0, 0, 0.188, 0.14, 0.138, 16);
  ell(top, J.spine, 0, 0.1, 0.005, 0.178, 0.16, 0.132, 16);
  ell(top, J.chest, 0, 0.11, 0, 0.2, 0.178, 0.138, 16);
  ell(top, J.chest, 0, 0.2, -0.005, 0.218, 0.075, 0.12, 14); // shoulder yoke
  o.caps.push([wp(J.pelvis, 0, -0.03, 0), wp(J.chest, 0, 0.2, 0), 0.15, 0.16]);
  if (o.halfOff) {
    // the suit's top half hangs from the waist: a bunched skirt of Tyvek round the hips + the empty sleeves
    ell(suit, J.pelvis, 0, 0.07, 0, 0.2, 0.08, 0.15, 14);
    for (const s of [-1, 1]) {
      const A = wp(J.pelvis, s * 0.16, 0.06, -0.02), B = wp(J.pelvis, s * 0.22, -0.2, 0.05);
      seg(suit, A, B, 0.05, 0.035, 8, false);
    }
  }
  b.detail(() => {
    if (!o.halfOff) {
      // zip placket + collar
      const z0 = wp(J.spine, 0, 0.0, 0.122), z1 = wp(J.chest, 0, 0.24, 0.1);
      seg(suit, z0, z1, 0.012, 0.012, 6, false);
    }
    // waist elastic
    const w = new THREE.Matrix4().copy(J.spine.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, -0.02, 0), new THREE.Quaternion().setFromEuler(_e.set(PI / 2, 0, 0)), new THREE.Vector3(0.165, 0.123, 0.165)));
    b.geo(suit, torusGeo(0.11), 'box', w);
  });

  // ── neck + head
  const nb = wp(J.neck), nt = wp(J.head, 0, 0.0, 0);
  if (o.hood) {
    seg(suit, nb, nt, 0.075, 0.07, 10);
    // hood: a baggy cowl over the head, elastic face opening holding the visor
    ell(suit, J.head, 0, 0.1, -0.015, 0.13, 0.155, 0.142, 16);
    ell(suit, J.head, 0, -0.05, -0.02, 0.155, 0.1, 0.14, 14); // hood skirt over the neck and shoulders
    // visor: a fogged curved lens over the face, framed by the hood's elastic
    ell(M.visor, J.head, 0, 0.1, 0.075, 0.098, 0.085, 0.08, 16);
    b.detail(() => {
      const fr = new THREE.Matrix4().copy(J.head.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.1, 0.112), new THREE.Quaternion(), new THREE.Vector3(0.1, 0.088, 0.1)));
      b.geo(suit, torusGeo(0.09), 'box', fr);
      // respirator: a rubber snout under the visor with two filter discs
      ell('rubber', J.head, 0, -0.005, 0.11, 0.055, 0.045, 0.045, 12);
      for (const s of [-1, 1]) {
        const c0 = wp(J.head, s * 0.045, -0.02, 0.12), c1 = wp(J.head, s * 0.07, -0.03, 0.125);
        b.geo('plastic_dark', new THREE.CylinderGeometry(0.032, 0.032, 0.022, 14), 'box', alignAB(c0, c1).multiply(_m.makeTranslation(0, 0.011, 0)));
      }
    });
  } else {
    // bare head (face never shown: the poses keep it down / away): skin neck, skull, short hair, ears
    seg(M.skin, nb, nt, 0.058, 0.055, 12);
    ell(M.skin, J.head, 0, 0.1, 0.015, 0.088, 0.112, 0.102, 18);
    // hair: a lumpy cap over the crown and the back of the skull down to the nape (never a smooth egg)
    b.geo(M.hair, folded(sphereGeo(26), hashStr(o.name) * 31, 0.035, 9), 'box',
      new THREE.Matrix4().copy(J.head.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.12, -0.014), new THREE.Quaternion(), new THREE.Vector3(0.093, 0.1, 0.1))));
    b.geo(M.hair, folded(sphereGeo(20), hashStr(o.name) * 37, 0.04, 10), 'box',
      new THREE.Matrix4().copy(J.head.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.065, -0.034), new THREE.Quaternion().setFromEuler(_e.set(0.35, 0, 0)), new THREE.Vector3(0.084, 0.07, 0.078))));
    b.detail(() => {
      for (const s of [-1, 1]) ell(M.skin, J.head, s * 0.084, 0.088, -0.004, 0.009, 0.024, 0.015, 8);
    });
    // the suit's collar, turned down (prone: hood cut away; half-off: the undershirt's neckband)
    const cm = new THREE.Matrix4().copy(J.neck.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.0, -0.005), new THREE.Quaternion().setFromEuler(_e.set(PI / 2, 0, 0)), new THREE.Vector3(0.082, 0.082, 0.07)));
    b.geo(o.halfOff ? M.shirt : suit, torusGeo(0.22), 'box', cm);
  }
  o.caps.push([nb, wp(J.head, 0, 0.1, 0), 0.07, 0.12]);

  // ── arms (gloves taped at the cuff)
  for (const s of ['l', 'r'] as const) {
    const sh = wp(J[`shoulder_${s}`]);
    let el = wp(J[`elbow_${s}`]), wr = wp(J[`wrist_${s}`]);
    if (s === 'r' && o.armR) [el, wr] = o.armR;
    const sleeve = o.halfOff ? M.shirt : suit;
    ell(sleeve, J[`shoulder_${s}`], 0, -0.02, 0, 0.088, 0.092, 0.088, 12);
    seg(sleeve, sh, el, 0.08, 0.068, 10);
    const cuff = wr.clone().lerp(el, 0.12);
    seg(sleeve, el, cuff, 0.068, 0.056, 10);
    if (o.halfOff) seg(M.skin, cuff, wr, 0.04, 0.034, 8, false);
    else b.detail(() => seg(M.nitrile, cuff.clone().lerp(el, 0.06), wr, 0.052, 0.046, 10, false)); // glove gauntlet + tape
    // hand: flat mitten along the forearm, thumb to the inside
    const dir = new THREE.Vector3().subVectors(wr, el).normalize();
    const hand = o.halfOff ? M.skin : M.nitrile;
    const side = s === 'l' ? 1 : -1;
    const palmN = wd(J.chest, side, 0, 0).cross(dir).normalize();
    const hm = alignAB(wr, wr.clone().add(dir), 1, 1, palmN);
    b.geo(hand, sphereGeo(10), 'box', hm.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.072, 0), new THREE.Quaternion(), new THREE.Vector3(0.04, 0.08, 0.019))));
    b.geo(hand, sphereGeo(8), 'box', hm.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(-side * 0.035, 0.05, 0.012), new THREE.Quaternion().setFromEuler(_e.set(0, 0, side * 0.5)), new THREE.Vector3(0.015, 0.045, 0.015))));
    o.caps.push([wr, wr.clone().addScaledVector(dir, 0.18), 0.045, 0.03]);
  }

  // ── legs + overboots
  for (const s of ['l', 'r'] as const) {
    const hp = wp(J[`hip_${s}`]), kn = wp(J[`knee_${s}`]), an = wp(J[`ankle_${s}`]);
    ell(suit, J[`hip_${s}`], 0, -0.03, 0, 0.118, 0.125, 0.115, 12);
    seg(suit, hp, kn, 0.112, 0.086, 10);
    seg(suit, kn, an.clone().lerp(kn, 0.2), 0.084, 0.072, 10);
    // overboot: tyvek upper over a rubber sole, elastic at the calf
    const A = J[`ankle_${s}`];
    ell(suit, A, 0, -0.005, 0.045, 0.068, 0.08, 0.145, 12);
    b.detail(() => {
      const sm = new THREE.Matrix4().copy(A.matrixWorld).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, -0.062, 0.05), new THREE.Quaternion(), new THREE.Vector3(0.105, 0.018, 0.27)));
      b.geo(M.sole, boxGeo(), 'box', sm);
    });
    o.caps.push([an, wp(A, 0, -0.03, 0.17), 0.065, 0.05]);
  }

  // ── name tape (chest; on the back of the shoulders too, so a prone body still reads)
  if (o.tape) {
    const tape = (j: THREE.Object3D, x: number, y: number, z: number, back: boolean) => {
      const m = new THREE.Matrix4().copy(j.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(x, y, z));
      if (back) m.multiply(new THREE.Matrix4().makeRotationY(PI));
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      m.decompose(p, q, sc);
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      b.push(p.x, p.y, p.z, e.y, e.x, e.z);
      b.sign(o.name.toUpperCase(), 'label', 0, 0, 0, 0.13, 0.032, '+z');
      b.pop();
    };
    if (!o.halfOff) {
      tape(J.chest, 0.085, 0.13, 0.124, false);
      tape(J.chest, 0, 0.17, -0.127, true);
    }
  }
}

const _geoCache = new Map<string, THREE.BufferGeometry>();
function sphereGeo(seg: number) { const k = `s${seg}`; let g = _geoCache.get(k); if (!g) _geoCache.set(k, (g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))))); return g; }
function torusGeo(tube: number) { const k = `t${tube}`; let g = _geoCache.get(k); if (!g) _geoCache.set(k, (g = new THREE.TorusGeometry(1, tube, 6, 18))); return g; }
function boxGeo() { let g = _geoCache.get('b'); if (!g) _geoCache.set('b', (g = new THREE.BoxGeometry(1, 1, 1))); return g; }

/** Stainless lab chair (seat 0.48) — the sitting body's chair, origin on the floor under the seat, back at −z. */
function labChair(b: Builder, M: Mats) {
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * PI) / 5 + 0.3;
    b.rod(M.stainless, 0, 0.08, 0, Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28, 0.016, 6);
    b.sphere('rubber', Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28, 0.028, 6);
  }
  b.cyl(M.stainless, 0, 0.26, 0, 0.022, 0.38, 'y', 8);
  b.box('plastic_dark', 0, 0.46, 0, 0.42, 0.05, 0.4);
  b.rod(M.stainless, 0, 0.45, 0.17, 0, 0.82, 0.2, 0.014, 6);
  b.rbox('plastic_dark', 0, 0.82, 0.21, 0.38, 0.2, 0.04, -0.1, 0, 0);
}

/** Clinical stainless gurney (top of the mattress y 0.86), long axis local z; origin on the floor. */
function gurney4(b: Builder, M: Mats) {
  const w = 0.64, l = 2.0;
  b.box(M.stainless, 0, 0.78, 0, w, 0.035, l);
  b.box(M.pad, 0, 0.82, 0, w - 0.04, 0.07, l - 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.07), z = sz * (l / 2 - 0.22);
    b.rod(M.stainless, x, 0.77, z, x, 0.13, z, 0.02, 8);
    b.cyl('rubber', x, 0.065, z, 0.06, 0.035, 'x', 12);
    b.box('plastic_dark', x, 0.12, z, 0.05, 0.03, 0.07);
  }
  b.detail(() => {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.07);
      b.rod(M.stainless, x, 0.3, -l / 2 + 0.22, x, 0.3, l / 2 - 0.22, 0.014, 6);
      b.rod(M.stainless, sx * (w / 2 + 0.02), 0.8, -0.6, sx * (w / 2 + 0.02), 0.8, 0.6, 0.012, 6); // lowered side rails
    }
    b.rod(M.stainless, -w / 2 + 0.07, 0.3, 0, w / 2 - 0.07, 0.3, 0, 0.014, 6);
    b.box(M.stainless, 0, 0.36, 0, w - 0.14, 0.01, l - 0.6); // lower shelf
  });
}

/** A sheet draped over the capsules (body-local): heightfield over the mattress, hanging edges, soft folds. */
function sheet(b: Builder, L: LevelBuild, M: Mats, caps: Cap[], name: string) {
  const NX = 22, NZ = 48, X0 = -0.47, X1 = 0.47, Z0 = -1.12, Z1 = 1.12, TOP = 0.865, HW = 0.31, HL = 0.99;
  const H = new Float32Array((NX + 1) * (NZ + 1));
  const idx = (i: number, k: number) => k * (NX + 1) + i;
  const P = new THREE.Vector3(), AB = new THREE.Vector3(), AP = new THREE.Vector3();
  for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
    const x = X0 + ((X1 - X0) * i) / NX, z = Z0 + ((Z1 - Z0) * k) / NZ;
    let h = TOP + 0.01;
    for (const [A, B, ra, rb] of caps) {
      // top of the capsule above (x, z): closest point on the axis in plan
      P.set(x, 0, z);
      AB.set(B.x - A.x, 0, B.z - A.z); AP.set(x - A.x, 0, z - A.z);
      const t = AB.lengthSq() > 1e-8 ? Math.min(1, Math.max(0, AP.dot(AB) / AB.lengthSq())) : 0;
      const cx = A.x + (B.x - A.x) * t, cz = A.z + (B.z - A.z) * t, cy = A.y + (B.y - A.y) * t, r = ra + (rb - ra) * t;
      const d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 < r * r) h = Math.max(h, cy + Math.sqrt(r * r - d2) + 0.012);
    }
    H[idx(i, k)] = h;
  }
  // drape: the cloth bridges between high points (tent), relaxed a few times
  for (let it = 0; it < 10; it++) {
    const C = H.slice();
    for (let k = 1; k < NZ; k++) for (let i = 1; i < NX; i++) {
      const avg = (C[idx(i - 1, k)] + C[idx(i + 1, k)] + C[idx(i, k - 1)] + C[idx(i, k + 1)]) / 4;
      H[idx(i, k)] = Math.max(H[idx(i, k)], avg - 0.008);
    }
  }
  // hang over the edges + folds
  const R = rng(hashStr(name) ^ 0x51ee7);
  const ph = [R.range(0, 6), R.range(0, 6), R.range(0, 6)];
  const pos: number[] = [];
  for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
    let x = X0 + ((X1 - X0) * i) / NX, z = Z0 + ((Z1 - Z0) * k) / NZ;
    let y = H[idx(i, k)];
    const ex = Math.max(0, Math.abs(x) - HW), ez = Math.max(0, Math.abs(z) - HL);
    const e = Math.hypot(ex, ez);
    if (e > 0) {
      const edgeH = Math.max(TOP + 0.01, y);
      y = edgeH - e * 2.6;
      // pull the hanging part in towards the frame so it falls, not flares
      const pull = Math.min(e, 0.16) * 0.55;
      if (ex > 0) x = Math.sign(x) * (Math.abs(x) - pull);
      if (ez > 0) z = Math.sign(z) * (Math.abs(z) - pull);
      y += Math.sin(z * 9 + ph[0]) * 0.012 * Math.min(1, e * 6) + Math.sin(x * 11 + ph[1]) * 0.01 * Math.min(1, e * 6);
    } else {
      y += Math.sin(z * 5.5 + x * 3 + ph[2]) * 0.004;
    }
    pos.push(x, y, z);
  }
  const ind: number[] = [];
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const a = idx(i, k), b2 = idx(i + 1, k), c = idx(i, k + 1), d = idx(i + 1, k + 1);
    ind.push(a, c, b2, b2, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((NX + 1) * (NZ + 1) * 2), 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  b.geo(M.tyvek, g, 'box');
  // a paper tag on the sheet with the name, at the foot end
  b.detail(() => {
    const k = Math.round(NZ * 0.9), i = Math.round(NX * 0.62);
    const y = H[idx(i, k)];
    b.push(X0 + ((X1 - X0) * i) / NX, y + 0.004, Z0 + ((Z1 - Z0) * k) / NZ, 0.25, -PI / 2, 0);
    b.box('plastic_white', 0, 0, -0.002, 0.11, 0.05, 0.003);
    b.sign(name.toUpperCase(), 'label', 0, 0, 0.0, 0.1, 0.03, '+z');
    b.pop();
  });
}

// ───────────────────────────────────────────────────────────── table, gel bath, bin

/**
 * Operating table, origin on the floor at the table centre, long axis x, face cradle at −x (top of the pad y 0.9,
 * cradle pad y 0.86 at x −0.95). Matches `body('prone_table')` with the plan's nape (−0.7, 1.08) from table (0, −53.5).
 */
export function orTable(b: Builder, L: LevelBuild) {
  const M = setpieceMats(L);
  const x0 = -0.78, x1 = 1.22, w = 0.56;
  // base + column
  b.box(M.stainless, 0.15, 0.04, 0, 0.95, 0.08, 0.5);
  b.box('plastic_dark', 0.15, 0.085, 0, 0.9, 0.012, 0.46);
  b.box(M.stainless, 0.15, 0.45, 0, 0.32, 0.74, 0.24);
  b.box('plastic_dark', 0.15, 0.45, 0.121, 0.2, 0.5, 0.004);
  // top: frame + segmented pad
  b.box(M.stainless, (x0 + x1) / 2, 0.82, 0, x1 - x0, 0.04, w);
  const segs = [[x0, -0.2], [-0.19, 0.55], [0.56, x1]];
  for (const [a, c] of segs) b.box(M.pad, (a + c) / 2, 0.87, 0, c - a - 0.008, 0.06, w - 0.02);
  b.detail(() => {
    for (const s of [-1, 1]) b.box(M.stainless, (x0 + x1) / 2, 0.82, s * (w / 2 + 0.012), x1 - x0, 0.03, 0.012); // side rails
    // face cradle: horseshoe pad on a bracket, open towards the floor
    b.box(M.stainless, -0.9, 0.79, 0, 0.26, 0.025, 0.1);
    const R2 = 0.105, n = 10;
    for (let i = 0; i <= n; i++) {
      const a = -PI * 0.85 + (i / n) * PI * 1.7;
      const x = -0.95 - Math.cos(a) * R2 * 0.95, z = Math.sin(a) * R2;
      b.box(M.pad, x, 0.835, z, 0.05, 0.045, 0.05);
    }
  });
}

/** Gel bath (§2.6): stainless tank on legs, top rim y 1.0, gel at y 0.92, lid hinged open at −z. Origin on the floor. */
export const GEL_SURFACE_Y = 0.92;
export function gelBath(b: Builder, L: LevelBuild) {
  const M = setpieceMats(L);
  const w = 0.62, d = 0.42, t = 0.02, y0 = 0.72, y1 = 1.0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.stainless, sx * (w / 2 - 0.04), y0 / 2, sz * (d / 2 - 0.04), 0.035, y0, 0.035);
  b.box(M.stainless, 0, 0.18, 0, w - 0.08, 0.02, d - 0.08);
  b.box(M.stainless, 0, y0 + 0.01, 0, w, 0.02, d);
  b.box(M.stainless, 0, (y0 + y1) / 2, d / 2 - t / 2, w, y1 - y0, t).box(M.stainless, 0, (y0 + y1) / 2, -d / 2 + t / 2, w, y1 - y0, t);
  b.box(M.stainless, w / 2 - t / 2, (y0 + y1) / 2, 0, t, y1 - y0, d - 2 * t).box(M.stainless, -w / 2 + t / 2, (y0 + y1) / 2, 0, t, y1 - y0, d - 2 * t);
  b.box(M.gel, 0, GEL_SURFACE_Y - 0.09, 0, w - 2 * t, 0.18, d - 2 * t);
  b.detail(() => {
    // rolled rim, lid open past vertical against the back, chiller box, label
    b.box(M.stainless, 0, y1 + 0.006, d / 2 - 0.006, w + 0.012, 0.012, 0.024).box(M.stainless, 0, y1 + 0.006, -d / 2 + 0.006, w + 0.012, 0.012, 0.024);
    b.box(M.stainless, w / 2 - 0.006, y1 + 0.006, 0, 0.024, 0.012, d).box(M.stainless, -w / 2 + 0.006, y1 + 0.006, 0, 0.024, 0.012, d);
    b.rbox(M.stainless, 0, y1 + 0.2, -d / 2 - 0.045, w, 0.4, 0.012, -0.22, 0, 0);
    b.box('plastic_white', w / 2 + 0.09, 0.45, 0, 0.16, 0.3, 0.3);
    b.box('emissive_green', w / 2 + 0.171, 0.55, 0.08, 0.003, 0.012, 0.012);
    b.sign('클라스프 젤 — 배치 41 — −20 °C', 'label', 0, 0.86, d / 2 + 0.001, 0.36, 0.05, '+z');
  });
}

/**
 * The FAILED bin (§2.6, S4: static): a lined stainless bin, top y 0.7, ~`n` spoiled Clasps heaped in it (LEDs off),
 * label on the front (+z). Origin on the floor.
 */
export function claspBin(b: Builder, L: LevelBuild, n = 30) {
  const M = setpieceMats(L);
  const w = 0.52, d = 0.42, h = 0.7, t = 0.015;
  b.box(M.stainless, 0, 0.02, 0, w, 0.04, d);
  b.box(M.stainless, 0, h / 2, d / 2 - t / 2, w, h, t).box(M.stainless, 0, h / 2, -d / 2 + t / 2, w, h, t);
  b.box(M.stainless, w / 2 - t / 2, h / 2, 0, t, h, d - 2 * t).box(M.stainless, -w / 2 + t / 2, h / 2, 0, t, h, d - 2 * t);
  b.box('plastic_white', 0, h - 0.18, 0, w - 2 * t - 0.004, 0.3, d - 2 * t - 0.004); // the heap's bed inside the liner
  b.detail(() => {
    // liner folded over the rim
    b.box('plastic_white', 0, h - 0.02, d / 2 + 0.003, w + 0.01, 0.06, 0.006).box('plastic_white', 0, h - 0.02, -d / 2 - 0.003, w + 0.01, 0.06, 0.006);
    b.box('plastic_white', w / 2 + 0.003, h - 0.02, 0, 0.006, 0.06, d).box('plastic_white', -w / 2 - 0.003, h - 0.02, 0, 0.006, 0.06, d);
    b.sign('실패', 'danger', 0, 0.42, d / 2 + 0.001, 0.3, 0.1, '+z');
    b.sign('맥박 없음 — 재사용 금지', 'label', 0, 0.3, d / 2 + 0.001, 0.36, 0.04, '+z');
    // the heap: Clasps tumbled in, the top layer over the rim line
    const R = rng(0xc1a5b);
    const hw = (w - 0.1) / 2, hd = (d - 0.1) / 2;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const x = R.range(-hw, hw), z = R.range(-hd, hd);
      const crown = 1 - (x * x) / (hw * hw * 1.6) - (z * z) / (hd * hd * 1.6);
      const y = h - 0.02 + k * 0.09 * Math.max(0.2, crown) + R.range(0, 0.015);
      b.push(x, y, z, R.range(0, 2 * PI), R.range(-1.2, 1.2) + (R.chance(0.5) ? PI : 0), R.range(-0.6, 0.6));
      clasp(b, L, 'off');
      b.pop();
    }
  });
}

// ───────────────────────────────────────────────────────────── the surgical arm (§8.5.1, §4.4)

export type ArmCue = 'approach' | 'fit' | 'handshake' | 'fail' | 'remove' | 'regel' | 'return' | 'idle';
export const ARM_CUES: readonly ArmCue[] = ['approach', 'fit', 'handshake', 'fail', 'remove', 'regel', 'return', 'idle'];
/** Cycle state the story / screens read (`theatre_arm.userData.cycle`). `led` = the ring / Clasp LED right now. */
export interface ArmCycle { t: number; n: number; cue: ArmCue; attempt: number; period: number; led: 'off' | 'amber' | 'red' }

export interface TheatreArmOpts {
  /** Static builder for the rail (the theatre's zone); default: a builder of its own. */
  builder?: Builder;
  /** World nape (fit target) and its outward normal. Default: the plan's (−0.7, 1.08, −53.5), normal tilted to the head. */
  nape?: readonly [number, number, number];
  napeNormal?: readonly [number, number, number];
  /** World centre of the gel bath's surface (default (−2.5, 0.92, −56.8)). */
  bath?: readonly [number, number, number];
  /** Rail x and its z extent (default −1.7, −50.4 … −58.4); rail underside y = `at.y` (9.2). */
  railX?: number; railZ?: readonly [number, number];
  /** §4.4: max(2.5, dur(l4_unit_theatre_2) + 0.5) — the story sets it with `setFailHold`. */
  failHold?: number;
  /** Attempts before this level load (D20). Default from `facts.testHour` (62:10 → 5,593). */
  attempt0?: number;
  /** Cycle time at load (default 0 = `approach`). */
  startT?: number;
  /** Room the arm is drawn in (bones are only posed while it is visible). Default 'theatre'. */
  room?: string;
}

/** Joint vector: carriage z, hub y, yaw, link angles from straight down (a1, a2, a3), tool roll. */
type Q = [number, number, number, number, number, number, number];
interface KeyPose { cz: number; hy: number; T: THREE.Vector3; n: THREE.Vector3; roll: number }
interface Seg { t0: number; t1: number; kind: 'joint' | 'line' | 'hold'; a: string; b: string; cue?: ArmCue }

const L1 = 1.2, L2 = 1.0, L3 = 0.5, TOOL = 0.165, SHOULDER_DROP = 0.15;

/**
 * The theatre's ceiling-rail surgical robot: carriage on a rail at y 9.2, a 3 m mast with a telescoping column, a
 * yawing hub, three pitch links (1.2, 1.0, 0.5 m), a rolling tool head with a two-jaw gripper holding ONE Clasp, and
 * a 7 cm status ring. Registers machine + object `theatre_arm`. `at` = rail underside at its middle (x is ignored if
 * `railX` is given). The cycle runs from level load; cue callbacks fire on every transition.
 */
export function theatreArm(L: LevelBuild, at: THREE.Vector3, opts: TheatreArmOpts = {}): THREE.Object3D {
  const RX = opts.railX ?? at.x;
  const RY = at.y;
  const [rz0, rz1] = opts.railZ ?? [at.z + 4.1, at.z - 3.9];
  const nape = new THREE.Vector3(...(opts.nape ?? [-0.7, 1.08, -53.5]));
  const nn = new THREE.Vector3(...(opts.napeNormal ?? [-0.36, 1, 0])).normalize();
  const bath = new THREE.Vector3(...(opts.bath ?? [-2.5, GEL_SURFACE_Y, -56.8]));
  const room = opts.room ?? 'theatre';
  const testHour = typeof L.ctx.facts?.testHour === 'number' ? (L.ctx.facts.testHour as number) : 62 + 10 / 60;
  const attempt0 = opts.attempt0 ?? Math.floor((testHour * 3600 - 60) / 40);

  // ── IK: a Cartesian key pose → joints
  const ik = (k: KeyPose, out: Q = [0, 0, 0, 0, 0, 0, 0]): Q => {
    const S = new THREE.Vector3(RX, k.hy - SHOULDER_DROP, k.cz);
    let dx = k.T.x - RX, dz = k.T.z - k.cz;
    const hl = Math.hypot(dx, dz);
    if (hl < 1e-3) { dx = 1; dz = 0; } else { dx /= hl; dz /= hl; }
    const yaw = Math.atan2(-dx, -dz);
    const W = k.T.clone().addScaledVector(k.n, L3 + TOOL);
    const wh = (W.x - S.x) * dx + (W.z - S.z) * dz, wv = W.y - S.y;
    let D = Math.hypot(wh, wv);
    D = Math.min(Math.max(D, Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3);
    const beta = Math.atan2(wh, -wv);
    const gamma = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
    const a1 = beta + gamma;
    const eh = L1 * Math.sin(a1), ev = -L1 * Math.cos(a1);
    const a2 = Math.atan2(wh - eh, -(wv - ev));
    const nh = k.n.x * dx + k.n.z * dz;
    const a3 = Math.atan2(-nh, k.n.y);
    out[0] = k.cz; out[1] = k.hy; out[2] = yaw; out[3] = a1; out[4] = a2; out[5] = a3; out[6] = k.roll;
    return out;
  };

  // ── key poses (world). The fit plane holds the nape and its normal: carriage z = nape z.
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const fitHy = nape.y + 2.05;
  const K: Record<string, KeyPose> = {
    HOME: { cz: nape.z, hy: 5.25, T: v3(nape.x - 0.25, 3.15, nape.z), n: v3(-0.15, 1, 0).normalize(), roll: 0 },
    PRE_A: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, 0.14).add(v3(0, 0, 0)), n: nn.clone(), roll: 0.09 },
    PRE: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, 0.12), n: nn.clone(), roll: 0 },
    SEAT: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, -0.002), n: nn.clone(), roll: 0 },
    SEAT_L: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, -0.003), n: nn.clone(), roll: 0.035 },
    SEAT_R: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, -0.003), n: nn.clone(), roll: -0.035 },
    LIFT: { cz: nape.z, hy: fitHy, T: nape.clone().addScaledVector(nn, 0.42), n: v3(-0.2, 1, 0).normalize(), roll: 0 },
    BPRE: { cz: bath.z, hy: bath.y + 2.45, T: v3(bath.x, bath.y + 0.3, bath.z), n: v3(0, 1, 0), roll: 0 },
    DIP: { cz: bath.z, hy: bath.y + 2.45, T: v3(bath.x, bath.y - 0.032, bath.z), n: v3(0, 1, 0), roll: 0 },
    PARK: { cz: rz1 + 0.6, hy: 6.0, T: v3(RX + 0.55, 4.7, rz1 + 0.6), n: v3(0, 1, 0), roll: 0 },
  };
  const QK: Record<string, Q> = {};
  for (const k of Object.keys(K)) QK[k] = ik(K[k]);

  // ── the timeline (§4.4): built from failHold
  let failHold = Math.max(2.5, opts.failHold ?? 2.5);
  let segs: Seg[] = [];
  let period = 40;
  const cueAt = {} as Record<ArmCue, number>;
  const ledAt = { amber: 9.45, red: 12, blink: 13, off: 14.5 };
  const wisps = [9.5, 10.75];
  const build = () => {
    const F = failHold, R0 = 14.5 + F, G0 = R0 + 5, T0 = G0 + 6, I0 = T0 + 5;
    segs = [
      { t0: 0, t1: 5.4, kind: 'joint', a: 'HOME', b: 'PRE_A', cue: 'approach' },
      { t0: 5.4, t1: 6, kind: 'hold', a: 'PRE_A', b: 'PRE_A' },
      { t0: 6, t1: 7.0, kind: 'joint', a: 'PRE_A', b: 'PRE', cue: 'fit' },
      { t0: 7.0, t1: 9.4, kind: 'line', a: 'PRE', b: 'SEAT' },
      { t0: 9.4, t1: 9.9, kind: 'hold', a: 'SEAT', b: 'SEAT' },
      { t0: 9.9, t1: 10.4, kind: 'joint', a: 'SEAT', b: 'SEAT_L' },
      { t0: 10.4, t1: 11.0, kind: 'joint', a: 'SEAT_L', b: 'SEAT_R' },
      { t0: 11.0, t1: 11.5, kind: 'joint', a: 'SEAT_R', b: 'SEAT' },
      { t0: 11.5, t1: 12, kind: 'hold', a: 'SEAT', b: 'SEAT' },
      { t0: 12, t1: 14.5, kind: 'hold', a: 'SEAT', b: 'SEAT', cue: 'handshake' },
      { t0: 14.5, t1: R0, kind: 'hold', a: 'SEAT', b: 'SEAT', cue: 'fail' },
      { t0: R0, t1: R0 + 1.8, kind: 'line', a: 'SEAT', b: 'LIFT', cue: 'remove' },
      // one unbroken move to the bath across the `regel` cue (no stop half-way: a surgical arm does not hurry)
      { t0: R0 + 1.8, t1: G0 + 2.2, kind: 'joint', a: 'LIFT', b: 'BPRE' },
      { t0: G0, t1: G0, kind: 'hold', a: 'BPRE', b: 'BPRE', cue: 'regel' },
      { t0: G0 + 2.2, t1: G0 + 3.1, kind: 'line', a: 'BPRE', b: 'DIP' },
      { t0: G0 + 3.1, t1: G0 + 3.9, kind: 'hold', a: 'DIP', b: 'DIP' },
      { t0: G0 + 3.9, t1: G0 + 4.9, kind: 'line', a: 'DIP', b: 'BPRE' },
      { t0: G0 + 4.9, t1: T0, kind: 'hold', a: 'BPRE', b: 'BPRE' },
      { t0: T0, t1: I0, kind: 'joint', a: 'BPRE', b: 'HOME', cue: 'return' },
      { t0: I0, t1: I0 + 7, kind: 'hold', a: 'HOME', b: 'HOME', cue: 'idle' },
    ];
    period = I0 + 7;
    for (const s of segs) if (s.cue) cueAt[s.cue] = s.t0;
  };
  build();

  // per-joint stagger inside a joint move: carriage leads, mast next, the links follow, the wrist settles last
  const STAG: [number, number][] = [[0, 0.94], [0.03, 0.96], [0.04, 0.97], [0.06, 0.98], [0.08, 0.99], [0.1, 1], [0.12, 1]];
  const tmpK: KeyPose = { cz: 0, hy: 0, T: new THREE.Vector3(), n: new THREE.Vector3(), roll: 0 };
  const poseAt = (t: number, out: Q): Q => {
    let s = segs[segs.length - 1];
    for (const g of segs) if (t < g.t1 && g.t1 > g.t0) { s = g; break; }
    const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0);
    if (s.kind === 'hold') { for (let i = 0; i < 7; i++) out[i] = QK[s.b][i]; return out; }
    if (s.kind === 'line') {
      const a = K[s.a], b2 = K[s.b], k = minJerk(u);
      tmpK.cz = a.cz + (b2.cz - a.cz) * k; tmpK.hy = a.hy + (b2.hy - a.hy) * k;
      tmpK.T.lerpVectors(a.T, b2.T, k); tmpK.n.lerpVectors(a.n, b2.n, k).normalize(); tmpK.roll = a.roll + (b2.roll - a.roll) * k;
      return ik(tmpK, out);
    }
    const qa = QK[s.a], qb = QK[s.b];
    for (let i = 0; i < 7; i++) {
      const [s0, s1] = STAG[i];
      out[i] = qa[i] + (qb[i] - qa[i]) * minJerk((u - s0) / (s1 - s0));
    }
    return out;
  };
  const ledAtT = (t: number): ArmCycle['led'] | 'blink_off' => {
    if (t < ledAt.amber || t >= ledAt.off) return 'off';
    if (t < ledAt.red) return 'amber';
    if (t < ledAt.blink) return 'red';
    return ((t - ledAt.blink) % 0.5) < 0.25 ? 'red' : 'blink_off';
  };

  // ── rig: bones + parts (authored in bone space), skinned per material
  const M = setpieceMats(L);
  const rigRoot = new THREE.Group();
  rigRoot.name = 'theatre_arm';
  L.root.add(rigRoot);
  const names = ['carriage', 'column', 'hub', 'shoulder', 'elbow', 'wrist', 'tool', 'jaw_l', 'jaw_r'] as const;
  const B: Record<(typeof names)[number], THREE.Bone> = {} as never;
  for (const n of names) { B[n] = new THREE.Bone(); B[n].name = `arm_${n}`; }
  rigRoot.add(B.carriage);
  B.carriage.add(B.column); B.column.add(B.hub); B.hub.add(B.shoulder); B.shoulder.add(B.elbow); B.elbow.add(B.wrist);
  B.wrist.add(B.tool); B.tool.add(B.jaw_l); B.tool.add(B.jaw_r);
  const bones = names.map((n) => B[n]);
  const drv = ledDriver('theatre_led');
  const q: Q = [0, 0, 0, 0, 0, 0, 0];
  const applyQ = (qq: Q) => {
    B.carriage.position.set(RX, RY, qq[0]);
    B.column.position.set(0, qq[1] - RY, 0);
    B.hub.rotation.set(0, qq[2], 0);
    B.shoulder.position.set(0, -SHOULDER_DROP, 0); B.shoulder.rotation.set(qq[3], 0, 0);
    B.elbow.position.set(0, -L1, 0); B.elbow.rotation.set(qq[4] - qq[3], 0, 0);
    B.wrist.position.set(0, -L2, 0); B.wrist.rotation.set(qq[5] - qq[4], 0, 0);
    B.tool.position.set(0, -L3, 0); B.tool.rotation.set(0, qq[6], 0);
    B.jaw_l.position.set(0.052, -0.118, 0); B.jaw_r.position.set(-0.052, -0.118, 0);
  };
  applyQ(QK.HOME);
  rigRoot.updateMatrixWorld(true);

  const white: Mat = 'plastic_white', steel: Mat = M.stainless, dark: Mat = 'plastic_dark';
  const parts: { b: Builder; bone: number }[] = [];
  const part = (bone: (typeof names)[number], fn: (b: Builder) => void) => { const b = L.part(`arm_${bone}`); fn(b); parts.push({ b, bone: names.indexOf(bone) }); };
  // carriage (rides under the rail) + the fixed 3 m mast
  part('carriage', (b) => {
    b.box(white, 0, -0.11, 0, 0.36, 0.2, 0.46);
    b.box(dark, 0, -0.005, 0, 0.3, 0.03, 0.4);
    for (const s of [-1, 1]) b.box(steel, s * 0.19, -0.1, 0, 0.02, 0.14, 0.4);
    b.cyl(white, 0, -0.22 - 1.45, 0, 0.125, 2.9, 'y', 18);
    b.cyl(steel, 0, -0.24, 0, 0.14, 0.05, 'y', 18);
    b.cyl(dark, 0, -3.1, 0, 0.13, 0.05, 'y', 18);
    b.cyl(steel, 0, -3.14, 0, 0.11, 0.03, 'y', 18);
    // cable carrier down the mast's back + a service plate
    b.box(dark, 0, -1.7, -0.14, 0.07, 2.8, 0.03);
    b.box(steel, 0.0, -0.9, 0.126, 0.12, 0.3, 0.004);
  });
  // telescoping column: 3.2 m polished tube up into the mast + the yaw drive at its foot (hub y = 0)
  part('column', (b) => {
    b.cyl(steel, 0, 1.6, 0, 0.088, 3.2, 'y', 18);
    b.cyl(dark, 0, 0.05, 0, 0.1, 0.03, 'y', 18);
  });
  part('hub', (b) => {
    b.cyl(white, 0, -0.03, 0, 0.15, 0.17, 'y', 22);
    b.cyl(dark, 0, -0.125, 0, 0.142, 0.02, 'y', 22);
    // shoulder clevis + pitch drive (axis x)
    b.cyl(white, 0, -SHOULDER_DROP, 0, 0.115, 0.3, 'x', 22);
    for (const s of [-1, 1]) b.cyl(dark, s * 0.155, -SHOULDER_DROP, 0, 0.09, 0.012, 'x', 22);
  });
  // link 1 (1.2 m): tapered, flattened shell, cable loop on its back (local −y = along the link)
  part('shoulder', (b) => {
    b.geo(white, capsule(0.075, 0.064, L1, 16), 'box', new THREE.Matrix4().makeRotationX(PI).multiply(new THREE.Matrix4().makeScale(0.82, 1, 1)));
    b.box(dark, 0, -L1 / 2, 0.066, 0.05, L1 * 0.7, 0.012);
    b.cyl(white, 0, -L1, 0, 0.088, 0.24, 'x', 20);
    for (const s of [-1, 1]) b.cyl(dark, s * 0.124, -L1, 0, 0.07, 0.01, 'x', 20);
    b.rod(dark, 0.0, -0.12, -0.08, 0, -L1 + 0.12, -0.075, 0.016, 6);
  });
  // link 2 (1.0 m)
  part('elbow', (b) => {
    b.geo(white, capsule(0.06, 0.05, L2, 14), 'box', new THREE.Matrix4().makeRotationX(PI).multiply(new THREE.Matrix4().makeScale(0.82, 1, 1)));
    b.box(dark, 0, -L2 / 2, 0.053, 0.04, L2 * 0.66, 0.01);
    b.cyl(white, 0, -L2, 0, 0.065, 0.18, 'x', 18);
    for (const s of [-1, 1]) b.cyl(dark, s * 0.094, -L2, 0, 0.052, 0.008, 'x', 18);
    b.rod(dark, 0, -0.1, -0.062, 0, -L2 + 0.1, -0.058, 0.013, 6);
  });
  // link 3 (0.5 m): wrist, slimmer, steel collar
  part('wrist', (b) => {
    b.geo(white, capsule(0.045, 0.04, L3 - 0.05, 14), 'box', new THREE.Matrix4().makeRotationX(PI));
    b.cyl(steel, 0, -L3 + 0.03, 0, 0.042, 0.06, 'y', 16);
  });
  // tool head: roll drive, the 7 cm status ring, gripper body; the Clasp (pad at −TOOL, outer face up the tool)
  part('tool', (b) => {
    b.cyl(dark, 0, -0.025, 0, 0.034, 0.05, 'y', 18);
    b.cyl(white, 0, -0.07, 0, 0.033, 0.04, 'y', 18);
    b.detail(() => b.torus(drv.mat, 0, -0.058, 0, 0.037, 0.008, 'y', 28)); // ring (7 cm across, 1.6 cm thick: B3)
    b.box(steel, 0, -0.1, 0, 0.11, 0.024, 0.03);
    b.push(0, -TOOL, 0, 0, -PI / 2, 0);
    clasp(b, L, 'off', 0, drv.mat, dark); // one material for shell, pad and prongs: the arm stays at 4 skinned calls
    b.pop();
  });
  for (const s of [1, -1] as const) {
    part(s > 0 ? 'jaw_l' : 'jaw_r', (b) => {
      // jaw: down past the Clasp's end lug, a pad pressing on it
      b.box(steel, 0, -0.02, 0, 0.008, 0.05, 0.026);
      b.box(dark, -s * 0.005, -0.05, 0, 0.006, 0.02, 0.022);
    });
  }
  // the halo sits just off the LED, riding the tool bone
  const halo = ledHalo(drv);
  halo.position.set(CLASP.led.x, -TOOL + CLASP.led.z + 0.004, -CLASP.led.y);
  B.tool.add(halo);
  // the ring's own glow (same uniforms): 7 cm is ~5 px from the gallery's far end — it must not shrink below that
  // (B3: from the gallery path the 7 cm ring is the lesson — its glow is a soft 16 cm disc, never under 13 px)
  const ringHalo = ledHalo(drv, 0.1, 16, 1.25);
  ringHalo.position.set(0, -0.058, 0);
  B.tool.add(ringHalo);

  const bc = new THREE.Vector3(RX, (RY + 1) / 2, (rz0 + rz1) / 2);
  const meshes = skinParts(rigRoot, bones, parts, (m) => m !== drv.mat, bc, Math.max(6, (RY - 0.5) / 2 + 3));
  for (const m of meshes) m.frustumCulled = true;

  // ── the rail (static, the caller's zone)
  const rb = opts.builder ?? L.builder('theatre_arm_rail');
  rb.box(steel, RX, RY + 0.09, (rz0 + rz1) / 2, 0.22, 0.05, Math.abs(rz0 - rz1));
  rb.box(white, RX, RY + 0.15, (rz0 + rz1) / 2, 0.3, 0.07, Math.abs(rz0 - rz1) + 0.1);
  for (const z of [rz0, rz1]) rb.box(dark, RX, RY + 0.06, z, 0.26, 0.1, 0.06); // end stops
  for (let z = Math.min(rz0, rz1) + 0.6; z < Math.max(rz0, rz1); z += 1.6) rb.box(steel, RX, RY + 0.21, z, 0.08, 0.06, 0.08);

  // ── runtime
  const cbs: ((cue: ArmCue, c: ArmCycle) => void)[] = [];
  const wispCbs: ((p: THREE.Vector3) => void)[] = [];
  const cycle: ArmCycle = { t: 0, n: 0, cue: 'approach', attempt: attempt0, period, led: 'off' };
  let t = opts.startT ?? 0;
  let running = true;
  let park = 0; // 0 = cycling … 1 = parked
  let pendingFail: (() => void) | null = null;
  const qa: Q = [0, 0, 0, 0, 0, 0, 0];
  const cueOf = (tt: number): ArmCue => { let c: ArmCue = 'approach'; for (const s of segs) { if (s.cue && tt >= s.t0) c = s.cue; } return c; };
  cycle.cue = cueOf(t);
  const fire = (cue: ArmCue) => { for (const cb of cbs) { try { cb(cue, cycle); } catch (e) { console.warn('[theatre_arm] cue callback failed', e); } } };
  const pose = () => {
    poseAt(t, qa);
    if (park > 0) {
      const k = minJerk(park);
      for (let i = 0; i < 7; i++) q[i] = qa[i] + (QK.PARK[i] - qa[i]) * k;
    } else for (let i = 0; i < 7; i++) q[i] = qa[i];
    applyQ(q);
    const led = park > 0 ? 'off' : ledAtT(t);
    cycle.led = led === 'blink_off' ? 'red' : led;
    if (led === 'off' || led === 'blink_off') drv.set('off'); else drv.set(led);
    halo.visible = ringHalo.visible = drv.i.value > 0;
  };
  const step = (dt: number) => {
    if (running) {
      park = Math.max(0, park - dt / 3);
      const prev = t;
      t += dt;
      for (const w of wisps) if (prev < w && t >= w && park === 0) { const p = B.tool.localToWorld(new THREE.Vector3(0, -TOOL, 0)); for (const cb of wispCbs) cb(p); }
      if (t >= period) { t -= period; cycle.n++; cycle.attempt = attempt0 + cycle.n; if (pendingFail) { pendingFail(); pendingFail = null; } }
      const c = cueOf(t);
      if (c !== cycle.cue) { cycle.cue = c; cycle.t = t; fire(c); }
    } else park = Math.min(1, park + dt / 3);
    cycle.t = t; cycle.period = period;
  };
  L.updaters.push((dt) => {
    step(dt);
    if (L.isVisible(room)) pose();
  });
  L.machines.set('theatre_arm', (s: MachineState) => { running = s !== 'off'; });
  pose();

  const ud = rigRoot.userData;
  ud.cycle = cycle;
  ud.attempt0 = attempt0;
  /** §4.4: the story sets it at level start (applies now if the cycle is before `fail`, else from the next cycle). */
  ud.setFailHold = (s: number) => {
    const F = Math.max(2.5, s);
    if (F === failHold) return;
    const apply = () => { failHold = F; build(); cycle.period = period; };
    if (t < 14.5) apply(); else pendingFail = apply;
  };
  /** Register a cue callback (`approach | fit | handshake | fail | remove | regel | return | idle`). Returns an unsubscribe. */
  ud.onCue = (cb: (cue: ArmCue, c: ArmCycle) => void) => { cbs.push(cb); return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }; };
  /** fx4_wisp: called twice per `fit` with the Clasp's world position (D2 spawns the puffs). */
  ud.onWisp = (cb: (p: THREE.Vector3) => void) => { wispCbs.push(cb); };
  /** Cycle-time of each cue under the current failHold, and seconds until the next `cue`. */
  ud.cueTimes = () => ({ ...cueAt, period });
  ud.timeTo = (cue: ArmCue) => { const c = cueAt[cue]; return ((c - t) % period + period) % period; };
  /** Dev / restore: jump the cycle to time `s` (no cue callbacks) and pose now. */
  ud.setTime = (s: number) => { t = ((s % period) + period) % period; cycle.t = t; cycle.cue = cueOf(t); pose(); };
  /** World position of the Clasp's pad centre (the theatre_cam / wisp origin). */
  ud.claspWorld = (out = new THREE.Vector3()) => B.tool.localToWorld(out.set(0, -TOOL, 0));
  ud.bones = B;
  L.objects.set('theatre_arm', rigRoot);
  return rigRoot;
}
