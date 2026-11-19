/**
 * World pickups: weapon props lying on their side, labelled ammo boxes, medkits, keycards.
 * Weapons/keycards are interactables ("권총 가져가기"); ammo/medkits are collected on touch when needed.
 * Idle highlight: a soft, slowly twinkling glint — no arcade spinning.
 */
import * as THREE from 'three';
import type { GameContext, PickupKind, PickupSpawn } from '../core/types';
import { levelOf } from '../core/progress';
import type { VmMats } from './viewmodels/mats';
import { buildPistol } from './viewmodels/pistol';
import { buildShotgun } from './viewmodels/shotgun';
import { buildCarbine, buildCarbineMag } from './viewmodels/carbine';
import { buildShell, buildCasingGeo } from './viewmodels/props';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, Parts, rbox, cylY, cylX, sweep } from './geom';

export interface PickupHost {
  /** Would the player take this right now (auto-collect kinds)? */
  wants(kind: PickupKind): boolean;
  give(kind: PickupKind, amount: number): void;
  addKey(key: string): void;
  /**
   * Stage 3b §8.2: "방탄복 입기" — start the 0.8 s strap; `take` is called when it completes (the vest is collected
   * then). Returns false when refused (armour full: the host shows `방탄복이 가득 찼습니다`); a cancelled strap leaves the vest.
   */
  vest(take: () => void): boolean;
}

interface Item {
  spawn: PickupSpawn;
  obj: THREE.Object3D;
  glint: THREE.Sprite;
  center: THREE.Vector3;
  phase: number;
  auto: boolean;
  taken: boolean;
}

const PROMPTS: Partial<Record<PickupKind, string>> = { pistol: '권총 가져가기', shotgun: '산탄총 가져가기', carbine: '카빈 가져가기', keycard: '키카드 가져가기', vest: '방탄복 입기' };
/** Kinds whose prop hangs from its spawn point (top at the point) instead of resting on it. */
/** Pickups farther than this from the camera are not drawn (squared metres). */
const FAR2 = 50 * 50;

const HANGS: Partial<Record<PickupKind, true>> = { vest: true };

/** Key name carried by a keycard pickup id: the id without its `p_` / `p2_` prefix. */
export function keyOf(id: string): string { return id.replace(/^p\d*_/, ''); }

let glintTex: THREE.Texture | null = null;
function makeGlintTexture(): THREE.Texture {
  const S = 64, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const rad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rad.addColorStop(0, 'rgba(255,255,255,1)');
  rad.addColorStop(0.12, 'rgba(220,235,255,0.6)');
  rad.addColorStop(1, 'rgba(160,190,255,0)');
  g.fillStyle = rad; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[S, 2], [2, S]]) {
    const lg = g.createLinearGradient(0, 0, w > h ? S : 0, w > h ? 0 : S);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect((S - w) / 2, (S - h) / 2, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Pickups {
  readonly root = new THREE.Group();
  private items: Item[] = [];
  private glintMat: THREE.SpriteMaterial;
  private protos = new Map<PickupKind, THREE.Object3D>();
  private seq = 0;

  constructor(private ctx: GameContext, private m: VmMats, private host: PickupHost) {
    this.root.name = 'pickups';
    ctx.scene.add(this.root);
    glintTex ??= makeGlintTexture();
    this.glintMat = new THREE.SpriteMaterial({ map: glintTex, color: new THREE.Color(1.6, 1.7, 2.0), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  }

  private proto(kind: PickupKind): THREE.Object3D {
    let p = this.protos.get(kind);
    if (p) return p;
    const m = this.m, lib = this.ctx.materials;
    const g = new THREE.Group();
    switch (kind) {
      case 'pistol': {
        const gun = buildPistol(m).root;
        gun.rotation.set(0, 0, Math.PI / 2);
        g.add(gun);
        break;
      }
      case 'shotgun': {
        const gun = buildShotgun(m).root;
        gun.rotation.set(0, 0, Math.PI / 2);
        g.add(gun);
        break;
      }
      case 'carbine': {
        const gun = buildCarbine(m).root;
        gun.rotation.set(0, 0, Math.PI / 2);
        g.add(gun);
        break;
      }
      case 'ammo_carbine': {
        // two loaded magazines, rubber-banded, lying on their sides
        for (let i = 0; i < 2; i++) {
          const mag = buildCarbineMag(m);
          mag.root.rotation.set(0, i ? 0.08 : 0, Math.PI / 2);
          mag.root.position.set(0, 0.012 + i * 0.024, i * 0.004);
          g.add(mag.root);
        }
        const pp = new Parts();
        for (const z of [-0.03, 0.03]) pp.add(rbox(0.19, 0.052, 0.006, 0.003), m.rubber, M(-0.07, 0.024, z - 0.11));
        pp.build(g);
        break;
      }
      case 'vest': {
        buildVest(m, g);
        break;
      }
      case 'plate': {
        // a ceramic plate insert: curved, edged in tape, with its label strip
        const pp = new Parts();
        const st = [] as { z: number; w: number; h: number; n: number; y: number }[];
        for (let i = 0; i <= 8; i++) { const z = -0.15 + i * 0.0375; st.push({ z, w: 0.125 - (Math.abs(z) > 0.12 ? (Math.abs(z) - 0.12) * 1.2 : 0), h: 0.011, n: 6, y: -(z * z) * 0.35 }); }
        pp.add(sweep(st, 24), m.plasticDark, M(0, 0.011, 0));
        pp.add(rbox(0.07, 0.002, 0.03, 0.001), m.plasticWhite, M(0, 0.0215, 0.02));
        pp.build(g);
        break;
      }
      case 'ammo_pistol':
      case 'ammo_shotgun': {
        const pistol = kind === 'ammo_pistol';
        const w = pistol ? 0.15 : 0.16, h = pistol ? 0.055 : 0.075, d = pistol ? 0.095 : 0.105;
        const pp = new Parts();
        pp.add(rbox(w, h * 0.78, d, 0.004), m.polymer, M(0, h * 0.39, 0));
        pp.add(rbox(w + 0.004, h * 0.26, d + 0.004, 0.004), m.polymer, M(0, h * 0.87, 0)); // lid
        pp.add(rbox(w * 0.3, 0.004, 0.012, 0.0015), m.rubber, M(0, h + 0.002, 0)); // lid tab
        pp.build(g);
        const label = lib.sign(pistol ? '9MM  FMJ  ×24' : '12게이지  00 벅', 'label', 3.2);
        const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, w * 0.86 / 3.2), label);
        front.position.set(0, h * 0.42, d / 2 + 0.0012);
        g.add(front);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, w * 0.7 / 3.2), label);
        top.rotation.x = -Math.PI / 2;
        top.position.set(0, h + 0.0012, 0.01);
        g.add(top);
        // a few loose rounds beside the box
        if (pistol) {
          const cg = buildCasingGeo();
          for (let i = 0; i < 3; i++) {
            const c = new THREE.Mesh(cg, m.brass);
            c.rotation.set(Math.PI / 2, 0, 0.4 + i * 0.9);
            c.position.set(w / 2 + 0.03 + i * 0.014, 0.005, -0.02 + i * 0.022);
            g.add(c);
          }
        } else {
          const sh = buildShell(m);
          for (let i = 0; i < 2; i++) {
            const s = sh.clone();
            s.rotation.set(Math.PI / 2, 0, 0.3 + i * 1.1);
            s.position.set(w / 2 + 0.035 + i * 0.03, 0.011, -0.025 + i * 0.04);
            g.add(s);
          }
        }
        break;
      }
      case 'medkit': {
        const pp = new Parts();
        const W = 0.3, H = 0.1, D = 0.2;
        pp.add(rbox(W, H * 0.55, D, 0.012, 3), m.plasticWhite, M(0, H * 0.275, 0));
        pp.add(rbox(W + 0.004, H * 0.45, D + 0.004, 0.012, 3), m.plasticWhite, M(0, H * 0.775, 0));
        pp.add(rbox(W + 0.006, 0.008, D + 0.006, 0.003), m.polymer, M(0, H * 0.55, 0)); // seam band
        for (const sx of [-1, 1]) {
          pp.add(rbox(0.03, 0.03, 0.012, 0.003), m.steel, M(sx * 0.09, H * 0.55, D / 2 + 0.006)); // latches
          pp.add(rbox(0.02, 0.022, 0.02, 0.004), m.polymer, M(sx * 0.07, H + 0.012, 0)); // handle posts
        }
        pp.add(rbox(0.16, 0.014, 0.022, 0.006), m.rubber, M(0, H + 0.026, 0)); // handle
        // emissive cross on the lid + side
        pp.add(new THREE.BoxGeometry(0.075, 0.003, 0.022), m.emGreen, M(0, H + 0.0005, -0.02));
        pp.add(new THREE.BoxGeometry(0.022, 0.003, 0.075), m.emGreen, M(0, H + 0.0005, -0.02));
        pp.add(new THREE.BoxGeometry(0.05, 0.015, 0.002), m.emRed, M(-0.08, H * 0.3, D / 2 + 0.002));
        pp.add(new THREE.BoxGeometry(0.015, 0.05, 0.002), m.emRed, M(-0.08, H * 0.3, D / 2 + 0.002));
        pp.build(g);
        const label = lib.sign('외상 키트', 'label', 3);
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), label);
        lab.position.set(0.05, H * 0.3, D / 2 + 0.0015);
        g.add(lab);
        break;
      }
      case 'keycard': {
        const pp = new Parts();
        pp.add(rbox(0.086, 0.0022, 0.054, 0.001), m.plasticWhite, M(0, 0.0011, 0));
        pp.add(new THREE.BoxGeometry(0.086, 0.0004, 0.01), m.emCyan, M(0, 0.0024, -0.016));
        pp.add(new THREE.BoxGeometry(0.012, 0.0006, 0.01), m.brass, M(-0.026, 0.0025, 0.008));
        pp.add(cylY(0.0035, 0.0006, 12), m.polymer, M(0.032, 0.0025, 0.014));
        pp.build(g);
        break;
      }
    }
    // rest on y = 0 (a hanging prop: its top at y = 0)
    const bb = new THREE.Box3().setFromObject(g);
    const holder = new THREE.Group();
    g.position.y = HANGS[kind] ? -bb.max.y : -bb.min.y;
    holder.add(g);
    flattenByMaterial(holder);
    holder.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.protos.set(kind, holder);
    return holder;
  }

  spawn(sp: PickupSpawn) {
    const obj = this.proto(sp.kind).clone();
    obj.position.copy(sp.position);
    obj.rotation.y = sp.yaw ?? 0;
    obj.name = `pickup_${sp.id}`;
    this.root.add(obj);
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const center = bb.getCenter(new THREE.Vector3());
    const glint = new THREE.Sprite(this.glintMat);
    glint.position.set(center.x, bb.max.y + 0.01, center.z);
    glint.scale.setScalar(0.0001);
    glint.renderOrder = 5;
    this.root.add(glint);
    const auto = !(sp.kind in PROMPTS);
    let prompt = PROMPTS[sp.kind] ?? '가져가기';
    // Levels with a named keycard (2+): it is named after its key ('p2_section_pass' → "Take section pass").
    if (sp.kind === 'keycard' && levelOf(this.ctx).keycardName !== null) prompt = `${keyOf(sp.id).replace(/_/g, ' ')} 가져가기`;
    const item: Item = { spawn: sp, obj, glint, center, phase: Math.random() * 10, auto, taken: false };
    this.items.push(item);
    if (!auto) {
      this.ctx.interactables.add({
        id: sp.id, kind: 'pickup', position: center, radius: 2.2, prompt, enabled: true,
        // §8.2: the vest is strapped on first (0.8 s); it is only taken when that completes
        onUse: () => { if (sp.kind === 'vest') this.host.vest(() => this.collect(item)); else this.collect(item); },
      });
    }
  }

  /** Spawn a pickup at runtime (debug / story). */
  add(kind: PickupKind, position: THREE.Vector3, amount = 0, yaw = 0, id?: string) {
    this.spawn({ id: id ?? `pk_${kind}_${this.seq++}`, kind, position: position.clone(), amount, yaw });
  }

  /** Checkpoints: ids of every pickup collected so far (level spawns and runtime ones alike). */
  readonly collected: string[] = [];

  /** Checkpoints: silently remove already-collected pickups (no give, no events). */
  restoreCollected(ids: readonly string[]) {
    // Ids of another level's spawns (a save carried across levels) are dropped; runtime ids are kept.
    const mine = new Set(this.ctx.level?.pickupSpawns?.map((p) => p.id) ?? []);
    // §8.1: "this level's ids or runtime ids" — a level spawn id looks like `p_…` / `p2_…` / `p3_…`.
    const levelSpawn = /^p\d*_/;
    ids = ids.filter((id) => typeof id === 'string' && (mine.has(id) || !levelSpawn.test(id)));
    const want = new Set(ids);
    for (const it of this.items) {
      if (it.taken || !want.has(it.spawn.id)) continue;
      it.taken = true;
      this.root.remove(it.obj, it.glint);
      if (!it.auto) this.ctx.interactables.remove(it.spawn.id);
    }
    for (const id of ids) if (!this.collected.includes(id)) this.collected.push(id);
  }

  private collect(it: Item) {
    if (it.taken) return;
    it.taken = true;
    const sp = it.spawn;
    this.collected.push(sp.id);
    if (sp.kind === 'keycard') {
      this.host.addKey(sp.id);
      // the key a door / story asks for: 'p2_section_pass' → 'section_pass' (level 1: 'lockout_key', unused)
      const k = keyOf(sp.id);
      if (k && k !== sp.id) this.host.addKey(k);
    }
    this.host.give(sp.kind, sp.amount);
    this.ctx.events.emit('pickup', { kind: sp.kind, amount: sp.amount, position: it.center.clone() });
    this.root.remove(it.obj, it.glint);
    if (!it.auto) this.ctx.interactables.remove(sp.id);
  }

  private _o = new THREE.Vector3();
  private _d = new THREE.Vector3();

  update(dt: number, t: number, feet: THREE.Vector3, alive: boolean) {
    const cam = this.ctx.camera.position;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.taken) { this.items.splice(i, 1); continue; }
      // far pickups are not drawn (a 0.3 m box beyond 50 m is a few fogged pixels; stage 3d IB6: long straight runs)
      const far = it.center.distanceToSquared(cam) > FAR2;
      it.obj.visible = !far;
      it.glint.visible = !far;
      // glint: brief soft twinkle every few seconds
      const cyc = (t * 0.32 + it.phase) % 1;
      const k = cyc < 0.12 ? Math.sin((cyc / 0.12) * Math.PI) : 0;
      it.glint.scale.setScalar(0.02 + k * 0.11);
      it.glint.material.rotation = t * 0.3;
      if (!alive || !it.auto) continue;
      const dx = it.center.x - feet.x, dz = it.center.z - feet.z, dy = it.center.y - feet.y;
      if (dx * dx + dz * dz < 1.0 && dy > -0.6 && dy < 1.4 && this.host.wants(it.spawn.kind)) {
        // R8: no collecting through glass / walls / closed doors (chest height → item, 0.4 m tolerance).
        const o = this._o.set(feet.x, feet.y + 0.9, feet.z);
        const d = this._d.set(it.center.x - o.x, it.center.y - o.y, it.center.z - o.z);
        const len = d.length();
        if (len > 0.3 && this.ctx.physics.raycast(o, d.multiplyScalar(1 / len), len - 0.4)) continue;
        this.collect(it);
      }
    }
    void dt;
  }

  /** Is `id` still lying in the world (not collected)? */
  has(id: string) { return this.items.some((i) => i.spawn.id === id && !i.taken); }

  get remaining() { return this.items.filter((i) => !i.taken).map((i) => i.spawn); }
}

/**
 * A pickup prop is a static model: its meshes (a magazine is ~10 parts, a shell box ~24) are baked into ONE mesh per
 * material (+ attribute layout + layers), so each lying pickup costs a draw call per material, not per part (stage 3d
 * IB6: level 6 lays ~40 pickups along a straight run). The look is unchanged; anything that does not merge stays as is.
 */
function flattenByMaterial(holder: THREE.Group) {
  holder.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const groups = new Map<string, { mat: THREE.Material; layers: number; geos: THREE.BufferGeometry[]; src: THREE.Mesh[] }>();
  holder.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(mesh.material) || mesh.geometry.groups.length > 0 || mesh.geometry.morphAttributes.position) return;
    if (!mesh.visible) return;
    let geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const attrs = Object.keys(geo.attributes).sort().map((k) => `${k}${geo.attributes[k].itemSize}`).join(',');
    const key = `${mesh.material.uuid}|${mesh.layers.mask}|${attrs}`;
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    if (mesh.matrixWorld.determinant() < 0) geo = flipWinding(geo);
    let e = groups.get(key);
    if (!e) groups.set(key, (e = { mat: mesh.material, layers: mesh.layers.mask, geos: [], src: [] }));
    e.geos.push(geo);
    e.src.push(mesh);
  });
  for (const e of groups.values()) {
    if (e.src.length < 2) { for (const g of e.geos) g.dispose(); continue; }
    const merged = mergeGeometries(e.geos, false);
    for (const g of e.geos) g.dispose();
    if (!merged) continue;
    for (const m of e.src) m.removeFromParent();
    const mesh = new THREE.Mesh(merged, e.mat);
    mesh.layers.mask = e.layers;
    holder.add(mesh);
  }
}

/** A non-indexed geometry with every triangle's winding reversed (a mirrored part baked into an unmirrored mesh). */
function flipWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name] as THREE.BufferAttribute, n = a.itemSize, arr = a.array as Float32Array;
    for (let t = 0; t + 2 < a.count; t += 3) for (let k = 0; k < n; k++) {
      const i = (t + 1) * n + k, j = (t + 2) * n + k, v = arr[i]; arr[i] = arr[j]; arr[j] = v;
    }
  }
  return geo;
}

/** Plate carrier on a hanger loop: front panel with MOLLE rows, shoulder straps, cummerbund flaps, drag handle. */
function buildVest(m: VmMats, g: THREE.Group) {
  const pp = new Parts();
  const W = 0.36, H = 0.42, T = 0.05;
  // front + back panels (slightly apart, as it hangs), plate pockets bulging
  pp.add(rbox(W, H, T, 0.02, 3), m.vest, M(0, -H / 2 - 0.08, 0.035));
  pp.add(rbox(W * 0.94, H * 0.96, T * 0.8, 0.02, 3), m.vest, M(0, -H / 2 - 0.085, -0.035));
  // MOLLE webbing rows on the front
  for (let i = 0; i < 6; i++) pp.add(rbox(W * 0.86, 0.018, 0.006, 0.002), m.gloveStrap, M(0, -0.16 - i * 0.05, 0.063));
  for (let i = 0; i < 7; i++) pp.add(rbox(0.006, 0.27, 0.007, 0.002), m.gloveStrap, M(-0.15 + i * 0.05, -0.285, 0.064));
  // shoulder straps over the hanger
  for (const sx of [-1, 1]) {
    pp.add(rbox(0.06, 0.1, 0.075, 0.012), m.vest, M(sx * 0.11, -0.045, 0, 0, 0, sx * 0.12));
    pp.add(rbox(0.065, 0.02, 0.09, 0.008), m.gloveStrap, M(sx * 0.11, -0.005, 0));
  }
  // cummerbund flaps, a radio pouch and two magazine pouches
  for (const sx of [-1, 1]) pp.add(rbox(0.05, 0.16, 0.09, 0.012), m.vest, M(sx * (W / 2 + 0.01), -0.4, 0, 0, sx * 0.3, 0));
  for (const x of [-0.07, 0.0, 0.07]) pp.add(rbox(0.06, 0.13, 0.035, 0.008), m.vest, M(x, -0.42, 0.075));
  pp.add(rbox(0.07, 0.06, 0.03, 0.006), m.vest, M(0.11, -0.2, 0.078));
  // drag handle + the hanger loop it hangs by
  pp.add(new THREE.TorusGeometry(0.025, 0.006, 6, 14, Math.PI), m.gloveStrap, M(0, 0.0, -0.035));
  pp.add(cylX(0.004, 0.08, 8), m.steel, M(0, 0.02, 0));
  pp.build(g);
}
