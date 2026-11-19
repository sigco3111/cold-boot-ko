/**
 * REVISION 5 — hologram looks for actors (`ActorOpts.look`):
 *
 *   holo_ghost — an apparition: pale blue-white additive projection with a fresnel rim, fine horizontal scan lines,
 *                a bright band drifting down, intermittent tearing (horizontal slices shoved sideways), row drop-outs,
 *                an afterimage trail while it moves, faint floor light, quiet carrier whine. Shot: a rippling hole tears
 *                open where the round went through, it glitches hard and collapses to a point (CRT power-off).
 *                Stared at from < 6 m for ~1.5 s it shudders and breaks up the same way.
 *   holo_tech  — the reference pattern: crisp cyan contour lines + faint fill + rim, joint markers, three measurement
 *                callouts with leader lines, a ground grid ring. Stable. Shot: flickers and resumes.
 *
 * Everything is a material on the actor's own skinned meshes (one ShaderMaterial per hologram, all keys) plus a few
 * sprites / one ring mesh — no extra render pass. Additive, no depth write, no shadow, fogged like the world.
 */
import * as THREE from 'three';
import type { LightHandle, LoopHandle } from '../../core/types';
import type { EnemyWorld } from '../ai';
import type { Rig, RigTemplate } from './rig';

export type HoloKind = 'ghost' | 'tech';

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uTear;
uniform float uCollapse;
uniform float uSeed;
uniform vec3 uCenter;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vV;
float h11(float n) { return fract(sin(n * 127.1 + uSeed * 17.0) * 43758.5453); }
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vObj = transformed;
  // tearing: horizontal slices shoved sideways for a few frames at a time
  if (uTear > 0.001) {
    float step = floor(uTime * 14.0);
    float row = floor(transformed.y * (7.0 + 9.0 * h11(step)) + h11(step + 3.0) * 13.0);
    float h = h11(row * 3.7 + step * 1.31);
    if (h > 1.0 - uTear * 0.45) transformed.x += (h11(row + step * 7.0) - 0.5) * 0.34 * uTear;
    transformed.x += (h11(step * 5.0 + floor(transformed.y * 40.0)) - 0.5) * 0.012 * uTear;
  }
  // collapse: squash to a horizontal line (toward the chest height), then to a point
  if (uCollapse > 0.0) {
    float c1 = smoothstep(0.0, 0.5, uCollapse), c2 = smoothstep(0.42, 0.95, uCollapse);
    transformed.y = mix(transformed.y, uCenter.y, c1 * 0.992);
    transformed.xz = mix(transformed.xz, uCenter.xz, c1 * 0.3);
    transformed.x *= 1.0 + c1 * 0.8 * (1.0 - c2);
    transformed.xz = mix(transformed.xz, uCenter.xz, c2);
  }
  vec3 transformedNormal = normalMatrix * objectNormal;
  vN = normalize(transformedNormal);
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uMode;      // 0 ghost, 1 tech
uniform vec3 uColor;
uniform float uGain;      // overall brightness (flicker / fade / trail)
uniform float uDrop;      // row drop-out amount
uniform float uCollapse;
uniform float uSeed;
uniform vec4 uHole;       // object-space hole centre + radius (w <= 0: none)
uniform float uHoleT;     // seconds since the hole was torn
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vV;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 13.0) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, normalize(vV)));
  float rim = pow(1.0 - ndv, 2.4);
  vec3 col;
  if (uMode < 0.5) {
    // ── ghost
    float step = floor(uTime * 11.0);
    float row = floor(vObj.y * 22.0);
    if (h21(vec2(row, step)) < uDrop) discard;
    // fine scan lines in screen space (no aliasing at range) + coarse bands drifting down the body
    float scan = 0.55 + 0.45 * sin(gl_FragCoord.y * 1.9 + uTime * 9.0);
    scan *= 0.8 + 0.2 * sin(vObj.y * 38.0 + uTime * 3.0);
    float band = fract(vObj.y * 0.55 + uTime * 0.23);
    band = smoothstep(0.86, 0.97, band) * (1.0 - smoothstep(0.97, 1.0, band));
    float fine = h21(floor(gl_FragCoord.xy * 0.5) + vec2(step)) * 0.25;
    float body = 0.045 + rim * 1.25 + band * 0.55 + fine * 0.06;
    // torn hole with ripples
    if (uHole.w > 0.0) {
      float d = distance(vObj, uHole.xyz);
      float r = uHole.w * (0.75 + 0.25 * sin(uHoleT * 9.0 + d * 30.0));
      if (d < r) discard;
      float edge = 1.0 - smoothstep(r, r + 0.05, d);
      float rip = sin(d * 70.0 - uHoleT * 26.0) * exp(-(d - r) * 9.0) * exp(-uHoleT * 1.2);
      body += edge * 2.2 + max(0.0, rip) * 0.9;
    }
    col = uColor * body * scan;
    // collapse: a hot line then a point
    col *= 1.0 + smoothstep(0.3, 0.7, uCollapse) * 3.0;
  } else {
    // ── tech: crisp contour lines in object height + sparse verticals, faint fill, rim
    float y = vObj.y / 0.045;
    float fy = fwidth(y);
    float ly = 1.0 - smoothstep(0.0, fy * 1.4, abs(fract(y) - 0.5) * 2.0 * 0.5 - (0.5 - fy * 0.75));
    ly = 1.0 - smoothstep(0.0, fy * 1.2, min(fract(y), 1.0 - fract(y)));
    float a = atan(vObj.x, vObj.z) / 6.2831853 * 28.0;
    float fa = fwidth(a);
    float la = 1.0 - smoothstep(0.0, fa * 1.2, min(fract(a), 1.0 - fract(a)));
    float major = 1.0 - smoothstep(0.0, fy * 1.2, min(fract(y / 5.0), 1.0 - fract(y / 5.0)) * 5.0);
    float sweep = smoothstep(0.0, 0.06, 0.06 - abs(fract(vObj.y * 0.35 - uTime * 0.18) - 0.5));
    float body = 0.07 + rim * 0.9 + ly * 0.75 + major * 0.6 + la * 0.22 + sweep * 0.35;
    col = uColor * body;
  }
  col *= uGain;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    col *= 1.0 - fogFactor;
  #endif
  gl_FragColor = vec4(col, 1.0);
}
`;

export function holoMaterial(kind: HoloKind, seed: number): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    name: 'holo_' + kind,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uTear: { value: 0 }, uCollapse: { value: 0 }, uSeed: { value: seed },
      uCenter: { value: new THREE.Vector3(0, 1.1, 0) },
      uMode: { value: kind === 'ghost' ? 0 : 1 },
      uColor: { value: kind === 'ghost' ? new THREE.Color(0.55, 0.78, 1.0) : new THREE.Color(0.1, 0.85, 1.0) },
      uGain: { value: 1 }, uDrop: { value: 0 },
      uHole: { value: new THREE.Vector4(0, 0, 0, 0) }, uHoleT: { value: 0 },
    }]),
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.FrontSide,
  });
  return m;
}

/** Material override record mapping every mesh key of a rig template to `mat`. */
export function holoOverride(tpl: RigTemplate, mat: THREE.Material): Record<string, THREE.Material> {
  const o: Record<string, THREE.Material> = {};
  for (const m of tpl.meshes) o[m.key] = mat;
  for (const m of tpl.lod1) o[m.key] = mat;
  return o;
}

/** Strip shadows from a rig instance (holograms cast nothing). */
export function holoRig(rig: Rig): void {
  rig.setShadow(false);
  if (rig.shadow) rig.shadow.visible = false;
  for (const m of rig.meshes) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 5; }
  for (const m of rig.lod1) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 5; }
}

// ───────────────────────────────────────────────────────────── tech dressing (sprites)

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let markerTex: THREE.CanvasTexture | null = null;
function marker(): THREE.CanvasTexture {
  return (markerTex ??= canvasTex(64, 64, (g) => {
    g.strokeStyle = '#7ff4ff'; g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[32, 2, 32, 12], [32, 52, 32, 62], [2, 32, 12, 32], [52, 32, 62, 32]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.fillStyle = '#c8fbff'; g.beginPath(); g.arc(32, 32, 3, 0, Math.PI * 2); g.fill();
  }));
}

interface Callout { bone: string; off: THREE.Vector3; sprite: THREE.Sprite; text: (h: Holo) => string; last: string; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; }

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

/**
 * One hologram attached to an actor's rig. The owner calls `update(dt)` after it has posed the rig (world matrices
 * current) and `shot(point)` when a round passes through.
 */
export class Holo {
  /** False once collapsed (until `appear()`); readable by the story through the actor handle. */
  present = true;
  /** Seconds the player has been staring at it from close (ghost). */
  private stareT = 0;
  private collapseT = -1;
  private tearT = 0; private tearNext: number;
  private flickT = 0;
  private holeT = -1;
  private appearT = -1;
  private stareCheck = 0;
  private light: LightHandle | null = null;
  private loop: LoopHandle | null = null;
  // afterimage
  private trail: { rig: Rig; mat: THREE.ShaderMaterial; hist: Float32Array[]; pos: Float32Array; times: Float32Array; head: number; n: number } | null = null;
  // tech dressing
  private markers: { bone: THREE.Bone; s: THREE.Sprite }[] = [];
  private callouts: Callout[] = [];
  private leaders: THREE.LineSegments | null = null;
  private ring: THREE.Mesh | null = null;
  private dressing: THREE.Group | null = null;
  private calloutT = 0;

  constructor(private world: EnemyWorld, readonly kind: HoloKind, readonly mat: THREE.ShaderMaterial, private rig: Rig, private object: THREE.Object3D, trailRig: Rig | null, private onGone?: () => void) {
    this.tearNext = 0.6 + world.rand() * 2.5;
    holoRig(rig);
    if (kind === 'ghost') {
      if (trailRig) {
        const tm = holoMaterial('ghost', Math.random() * 10);
        for (const m of [...trailRig.meshes, ...trailRig.lod1]) m.material = tm;
        holoRig(trailRig);
        trailRig.root.visible = false;
        world.ctx.scene.add(trailRig.root);
        trailRig.root.matrixAutoUpdate = true;
        const N = 24;
        this.trail = { rig: trailRig, mat: tm, hist: Array.from({ length: N }, () => rig.newPose()), pos: new Float32Array(N * 4), times: new Float32Array(N).fill(-1), head: 0, n: N };
      }
      try { this.light = world.ctx.render.lights.add({ type: 'point', position: object.position.clone(), color: 0x9cc6ff, intensity: 0.9, distance: 3.2, priority: 0.25 }); } catch { this.light = null; }
      try { this.loop = world.ctx.audio.loop('core_hum', { position: object.position, volume: 0.1, pitch: 2.7 }); } catch { this.loop = null; }
    } else {
      this.buildTech();
    }
  }

  /** Re-show after a collapse (flickers on). */
  appear(): void {
    this.present = true;
    this.collapseT = -1; this.holeT = -1; this.stareT = 0;
    this.mat.uniforms.uHole.value.w = 0;
    this.mat.uniforms.uCollapse.value = 0;
    this.appearT = 0;
    this.object.visible = true;
    if (this.light) this.light.enabled = true;
    if (this.loop) this.loop.setVolume(0.1, 0.4);
  }

  /** Glitch hard and collapse to a point (ghost). Tech holograms only flicker. */
  collapse(): void {
    if (this.kind === 'tech') { this.flickT = 0.6; return; }
    if (this.collapseT >= 0 || !this.present) return;
    this.collapseT = 0.0001;
    this.tearT = Math.max(this.tearT, 0.35);
    try { this.world.ctx.audio.play('intercom_static', { position: this.object.position, volume: 0.5 }); } catch { /* optional */ }
  }

  /** A round passed through at world `point`. */
  shot(point: THREE.Vector3): void {
    if (this.kind === 'tech') { this.flickT = 0.55; return; }
    if (!this.present) return;
    _v.copy(point);
    this.object.worldToLocal(_v);
    this.mat.uniforms.uHole.value.set(_v.x, _v.y, _v.z, 0.06);
    this.holeT = 0;
    this.tearT = 0.5;
    // the hole widens over a quarter second, then it goes
    if (this.collapseT < 0) this.collapseT = -0.5;
  }

  update(dt: number): void {
    const w = this.world, u = this.mat.uniforms, t = w.time;
    u.uTime.value = t;
    if (this.kind === 'tech') { this.updateTech(dt); return; }
    // ── ghost life
    let gain = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
    // intermittent tearing bursts
    this.tearNext -= dt;
    if (this.tearNext <= 0) { this.tearNext = 0.8 + w.rand() * 3.2; this.tearT = Math.max(this.tearT, 0.08 + w.rand() * 0.22); }
    let tear = 0;
    if (this.tearT > 0) { this.tearT -= dt; tear = 0.55 + 0.45 * w.rand(); gain *= 0.7 + w.rand() * 0.6; }
    let drop = 0.02 + (tear > 0 ? 0.18 : 0) + (w.rand() < 0.03 ? 0.4 : 0);
    // appear: flickers on over 0.6 s
    if (this.appearT >= 0) {
      this.appearT += dt;
      const k = Math.min(1, this.appearT / 0.6);
      gain *= k * (w.rand() < 0.5 + 0.5 * k ? 1 : 0.1);
      drop = Math.max(drop, (1 - k) * 0.7);
      if (this.appearT > 0.6) this.appearT = -1;
    }
    // stare: from < 6 m, looking straight at it, line of sight → shudder, then break up
    if (this.present && this.collapseT < 0) {
      this.stareCheck -= dt;
      if (this.stareCheck <= 0) {
        this.stareCheck = 0.1;
        const pl = w.ctx.player;
        _v.copy(this.object.position); _v.y += 1.2;
        _v2.copy(_v).sub(w.playerEye);
        const d = _v2.length();
        let staring = false;
        if (pl && pl.alive && d < 6 && d > 0.01) {
          const dot = pl.forward.dot(_v2) / d;
          staring = dot > 0.965 && w.ctx.physics.lineOfSight(w.playerEye, _v);
        }
        if (pl && pl.alive && d < 2.4) { this.collapse(); }
        this.stareT = staring ? this.stareT + 0.1 : Math.max(0, this.stareT - 0.05);
        if (this.stareT >= 1.5) this.collapse();
      }
      if (this.stareT > 0.4) { const k = (this.stareT - 0.4) / 1.1; tear = Math.max(tear, k * (0.4 + 0.6 * w.rand())); drop = Math.max(drop, k * 0.25); }
    }
    // hole + collapse
    if (this.holeT >= 0) { this.holeT += dt; u.uHoleT.value = this.holeT; u.uHole.value.w = 0.07 + Math.min(0.24, this.holeT * 0.6); }
    if (this.collapseT !== -1 && this.collapseT < 0) { this.collapseT = Math.min(0, this.collapseT + dt); if (this.collapseT >= 0) this.collapseT = 0.0001; }
    let col = 0;
    if (this.collapseT > 0) {
      this.collapseT += dt;
      tear = this.collapseT < 0.25 ? 1 : 0.3;
      col = THREE.MathUtils.clamp((this.collapseT - 0.25) / 0.7, 0, 1);
      if (this.collapseT > 1.0) {
        this.present = false;
        this.collapseT = -1;
        this.object.visible = false;
        if (this.trail) this.trail.rig.root.visible = false;
        if (this.light) this.light.enabled = false;
        if (this.loop) this.loop.setVolume(0, 0.2);
        u.uCollapse.value = 0;
        this.onGone?.();
        return;
      }
      if (this.collapseT > 0.88) {
        // the last point: a pin-prick flash
        _v.copy(this.object.position); _v.y += 1.1;
        if (this.collapseT - dt <= 0.88) { try { w.ctx.fx.flash(_v, 0x9cd0ff, 2.5, 0.12, 3); } catch { /* */ } }
      }
    }
    if (!this.present) return;
    // collapse centre: chest, in object space
    u.uCenter.value.set(0, 1.12, 0);
    u.uCollapse.value = col;
    u.uTear.value = tear;
    u.uDrop.value = drop;
    u.uGain.value = gain;
    // floor light + whine follow
    if (this.light) {
      this.light.position.copy(this.object.position); this.light.position.y += 0.5;
      this.light.intensityScale = gain * (1 - col) * (this.object.visible ? 1 : 0);
    }
    if (this.loop) this.loop.setPosition(this.object.position);
    this.updateTrail(dt, gain * (1 - col));
  }

  private updateTrail(dt: number, gain: number): void {
    const tr = this.trail;
    if (!tr) return;
    const w = this.world;
    // record (≈ 30 Hz)
    const last = tr.times[(tr.head + tr.n - 1) % tr.n];
    if (w.time - last >= 1 / 30) {
      this.rig.capture(tr.hist[tr.head]);
      const o = this.object;
      tr.pos[tr.head * 4] = o.position.x; tr.pos[tr.head * 4 + 1] = o.position.y; tr.pos[tr.head * 4 + 2] = o.position.z; tr.pos[tr.head * 4 + 3] = o.rotation.y;
      tr.times[tr.head] = w.time;
      tr.head = (tr.head + 1) % tr.n;
    }
    // show the pose from ~0.22 s ago, brightness by how far it is behind
    const want = w.time - 0.22;
    let best = -1;
    for (let k = 1; k <= tr.n; k++) {
      const i = (tr.head + tr.n - k) % tr.n;
      if (tr.times[i] < 0) break;
      best = i;
      if (tr.times[i] <= want) break;
    }
    if (best < 0 || !this.object.visible) { tr.rig.root.visible = false; return; }
    const dx = tr.pos[best * 4] - this.object.position.x, dz = tr.pos[best * 4 + 2] - this.object.position.z;
    const sep = Math.hypot(dx, dz);
    const k = THREE.MathUtils.clamp((sep - 0.04) / 0.25, 0, 1);
    tr.rig.root.visible = k > 0.01;
    if (!tr.rig.root.visible) return;
    tr.rig.apply(tr.hist[best]);
    tr.rig.root.position.set(tr.pos[best * 4], tr.pos[best * 4 + 1], tr.pos[best * 4 + 2]);
    tr.rig.root.rotation.set(0, tr.pos[best * 4 + 3], 0);
    tr.rig.root.updateMatrixWorld(true);
    const u = tr.mat.uniforms, mu = this.mat.uniforms;
    u.uTime.value = mu.uTime.value + 0.37;
    u.uGain.value = gain * 0.32 * k;
    u.uTear.value = mu.uTear.value * 0.5;
    u.uDrop.value = 0.25;
    void dt;
  }

  // ───────────────────────────────────────── tech

  private buildTech(): void {
    const B = this.rig.byName;
    const g = new THREE.Group();
    g.name = 'holo_tech_dressing';
    this.dressing = g;
    this.world.ctx.scene.add(g);
    const sm = new THREE.SpriteMaterial({ map: marker(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    for (const n of ['head', 'uarm_l', 'uarm_r', 'larm_l', 'larm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r', 'hips']) {
      if (!B[n]) continue;
      const s = new THREE.Sprite(sm);
      s.scale.setScalar(n === 'head' ? 0.085 : 0.06);
      s.renderOrder = 6;
      g.add(s);
      this.markers.push({ bone: B[n], s });
    }
    const mk = (bone: string, off: THREE.Vector3, text: (h: Holo) => string): void => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 64;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
      sprite.scale.set(0.5, 0.5 * 64 / 512, 1);
      sprite.center.set(0, 0.5);
      sprite.renderOrder = 6;
      g.add(sprite);
      this.callouts.push({ bone, off, sprite, text, last: '', canvas, tex });
    };
    mk('head', new THREE.Vector3(0.32, 0.22, 0), () => 'REF PATTERN 00 · REYES, S.');
    mk('shin_l', new THREE.Vector3(0.36, 0.05, 0), (h) => `무릎  ${h.kneeDeg().toFixed(0).padStart(3, ' ')}°`);
    mk('hips', new THREE.Vector3(0.4, -0.05, 0), (h) => `고관절  ${h.hipH().toFixed(3)} m`);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.callouts.length * 4 * 3), 3));
    this.leaders = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x4fe6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    this.leaders.frustumCulled = false;
    this.leaders.renderOrder = 6;
    g.add(this.leaders);
    // ground grid ring
    const rm = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uGain: { value: 1 } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vP;
        void main() { vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime; uniform float uGain;
        varying vec2 vP;
        float line(float x, float w) { float f = fwidth(x) * w; return 1.0 - smoothstep(0.0, f, abs(x)); }
        void main() {
          float r = length(vP), a = atan(vP.y, vP.x) + uTime * 0.25;
          float c = line(r - 0.9, 1.6) + line(r - 0.62, 1.2) * 0.6 + line(r - 0.3, 1.0) * 0.35;
          float ticks = step(0.86, r) * step(r, 0.97) * line(fract(a / 6.2831853 * 48.0) - 0.5, 2.0) * 0.0;
          float tk = (r > 0.82 && r < 0.9) ? (1.0 - smoothstep(0.0, 0.08, abs(fract(a / 6.2831853 * 36.0) - 0.5) * 2.0 - 0.9)) : 0.0;
          float grid = (line(fract(vP.x / 0.15) - 0.5, 1.0) * 0.0 + (1.0 - smoothstep(0.0, fwidth(vP.x / 0.15) * 1.2, min(fract(vP.x / 0.15), 1.0 - fract(vP.x / 0.15))))
                     + (1.0 - smoothstep(0.0, fwidth(vP.y / 0.15) * 1.2, min(fract(vP.y / 0.15), 1.0 - fract(vP.y / 0.15))))) * 0.22 * step(r, 0.9);
          float fill = 0.05 * step(r, 0.9);
          vec3 col = vec3(0.1, 0.85, 1.0) * (c + tk * 0.8 + grid + fill + ticks) * uGain * (1.0 - smoothstep(0.9, 0.96, r) * 0.0);
          #ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
            #else
              float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
            #endif
            col *= 1.0 - fogFactor;
          #endif
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rm);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 4;
    g.add(this.ring);
  }

  /** Live numbers for the callouts. */
  kneeDeg(): number { const s = this.rig.byName.shin_l; return s ? 2 * Math.acos(Math.min(1, Math.abs(s.quaternion.w))) * 180 / Math.PI : 0; }
  hipH(): number { const h = this.rig.byName.hips; return h ? h.position.y : 0; }

  private updateTech(dt: number): void {
    const w = this.world, u = this.mat.uniforms;
    let gain = 1;
    if (this.flickT > 0) {
      this.flickT -= dt;
      gain = w.rand() < 0.45 ? 0.08 : 0.6 + w.rand() * 0.8;
      u.uTear.value = 0.25 * w.rand();
    } else u.uTear.value = 0;
    u.uGain.value = gain;
    u.uDrop.value = 0;
    const g = this.dressing!;
    g.visible = this.object.visible;
    if (!g.visible) return;
    for (const m of this.markers) {
      m.s.position.setFromMatrixPosition(m.bone.matrixWorld);
      (m.s.material as THREE.SpriteMaterial).opacity = gain;
    }
    // callouts: anchored on the bone, label offset in the actor's frame (to its left side as seen from the front)
    this.calloutT -= dt;
    const redraw = this.calloutT <= 0;
    if (redraw) this.calloutT = 0.25;
    const pos = this.leaders!.geometry.getAttribute('position') as THREE.BufferAttribute;
    _q.setFromEuler(new THREE.Euler(0, this.object.rotation.y, 0));
    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      _v.setFromMatrixPosition(this.rig.byName[c.bone].matrixWorld);
      _v2.copy(c.off).applyQuaternion(_q).add(_v);
      c.sprite.position.copy(_v2);
      pos.setXYZ(i * 2, _v.x, _v.y, _v.z);
      pos.setXYZ(i * 2 + 1, _v2.x, _v2.y, _v2.z);
      (c.sprite.material as THREE.SpriteMaterial).opacity = gain;
      if (redraw) {
        const s = c.text(this);
        if (s !== c.last) {
          c.last = s;
          const x = c.canvas.getContext('2d')!;
          x.clearRect(0, 0, 512, 64);
          x.font = '600 34px ui-monospace, Menlo, monospace';
          const tw = Math.min(500, x.measureText(s).width + 22);
          x.fillStyle = 'rgba(40,200,255,0.16)'; x.fillRect(0, 6, tw, 52);
          x.fillStyle = '#9ff6ff'; x.fillRect(0, 6, 4, 52); x.fillRect(0, 56, tw, 2);
          x.fillStyle = '#c9fbff';
          x.textBaseline = 'middle';
          x.fillText(s, 14, 33);
          c.tex.needsUpdate = true;
        }
      }
    }
    pos.needsUpdate = true;
    (this.leaders!.material as THREE.LineBasicMaterial).opacity = gain;
    if (this.ring) {
      this.ring.position.copy(this.object.position); this.ring.position.y += 0.012;
      const rmat = this.ring.material as THREE.ShaderMaterial;
      rmat.uniforms.uTime.value = w.time; rmat.uniforms.uGain.value = gain;
    }
  }

  dispose(): void {
    if (this.light) { this.light.remove(); this.light = null; }
    if (this.loop) { try { this.loop.stop(0.2); } catch { /* */ } this.loop = null; }
    if (this.trail) { this.trail.rig.root.removeFromParent(); this.trail.rig.skeleton.dispose(); this.trail.mat.dispose(); this.trail = null; }
    if (this.dressing) {
      this.dressing.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && (o as THREE.Sprite).isSprite) { const sm = m as THREE.SpriteMaterial; if (sm.map && sm.map !== markerTex) sm.map.dispose(); } });
      this.dressing.removeFromParent();
      this.dressing = null;
    }
    this.mat.dispose();
  }
}
