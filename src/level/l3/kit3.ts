/**
 * THE QUIET SIDE — habitat props kit (stage 3a §8.6, task P3). Warm, ordinary, lived-in furniture and planting for
 * level 3; everything authored in the builder's local frame (origin on the floor, FRONT = local +z unless stated),
 * metres. Nothing here is industrial: wood veneer, fabric, plaster, stone, brass, plants.
 *
 *  materials   fabric(L, tint) · mat3 cache · shade (warm lamp emissive) · glassFront (clean glass, front-faced) ·
 *              canvasMat (procedural pictures: fjord print, abstract, family photos — no real people)
 *  shell       restyle (re-material / drop a greybox builder's batch: stand-in blocks, greybox glass)
 *  planting    defineLeaves (4 instanced leaf cards on the `leaf` atlas) · fern · grass · shrub · foliage · tree ·
 *              pot · pottedPlant · planterBed (raised bed: edging + soil + collider)
 *  furniture   sofa · armchair · coffeeTable · desk3 · officeChair · visitorChair · filingCabinet · bookcase ·
 *              bench3 · rug · sideboard · kitchenette · fridge · meetingTable
 *  small       deskPhone · monitor · keyboard · mug · papersFlat · photoFrame · tableLamp · bankersLamp · floorLamp ·
 *              radio · kettle · plantSmall · books
 *  wall        pictureFrame · noticeBoard · whiteboard · wainscot (on a wall run, with gaps) · wallFrame (alongWall)
 *  ceiling     ceilingGrid (acoustic T-bar) · downlight · pendant
 *  doors       doorCasing (wood casing over the industrial std frame, keeps its status panel; doormat over the
 *              hazard strips; brass label plate)
 *  signs       wayfind (wall plaque) · totem (free-standing, double-faced) · hangSign (from the ceiling)
 *
 * Draw-call discipline: every prop uses the builder's per-material batches (≤ 2 new materials per prop); leaves are
 * 4 instanced definitions shared by the whole level (one InstancedMesh per builder per card kind).
 */
import * as THREE from 'three';
import type { Builder, Face, Mat, Rng } from '../builder';
import type { LevelBuild } from '../context';
import { LEAF_ATLAS } from '../../materials/index';
import { lathe } from '../kit';

const PI = Math.PI;

// ───────────────────────────────────────────────────────────── materials

const caches = new WeakMap<LevelBuild, Map<string, THREE.Material>>();
/** Per-level material cache (one clone per key). */
export function mat3<T extends THREE.Material>(L: LevelBuild, key: string, make: () => T): T {
  let c = caches.get(L);
  if (!c) caches.set(L, (c = new Map()));
  let m = c.get(key) as T | undefined;
  if (!m) { c.set(key, (m = make())); if (!m.name) m.name = key; }
  return m;
}
/** Habitat upholstery colours. */
export const TINT = {
  oat: 0xbba78f, rust: 0xa8573a, sage: 0x7a8f6a, slate: 0x56688a, mustard: 0xc29a45, plum: 0x7a4a5a, cream: 0xd9ccb4,
  teal: 0x3f7a78, charcoal: 0x4a4644,
} as const;
/** `fabric_warm` tinted (cached per colour). */
export function fabric(L: LevelBuild, color: number): THREE.MeshStandardMaterial {
  return mat3(L, `fabric_${color.toString(16)}`, () => L.ctx.materials.clone('fabric_warm', { color }));
}
/** A lamp-shade / bulb emissive (warm, soft). Bind it to a light with `bindEmissive` if it should go out with it. */
export function shade(L: LevelBuild, key = 'shade', intensity = 1.4, color = 0xffc98e): THREE.MeshStandardMaterial {
  return mat3(L, `shade_${key}`, () => L.ctx.materials.clone('emissive_warm', { emissive: new THREE.Color(color), emissiveIntensity: intensity, color: 0xf2e2c8 }));
}
/** Clean architectural glass, single-sided (a closed box of it never shows coplanar back faces). */
export function glassFront(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat3(L, 'glass_clear_front', () => L.ctx.materials.clone('glass_clear', { side: THREE.FrontSide }));
}
/** A tinted painted surface (no maps). */
export function paint(L: LevelBuild, color: number, rough = 0.6): THREE.MeshStandardMaterial {
  return mat3(L, `paint_${color.toString(16)}_${rough}`, () => L.ctx.materials.clone('painted_white', {
    color, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: rough, metalness: 0,
  }));
}
/** Paper / thin overlays (polygon offset: wins against what it lies on). */
export function paper(L: LevelBuild, color = 0xf1ece0): THREE.MeshStandardMaterial {
  return mat3(L, `paper_${color.toString(16)}`, () => {
    const m = L.ctx.materials.clone('plastic_white', { color, map: null, normalMap: null, roughnessMap: null, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    return m;
  });
}

/** A material from a procedural canvas (pictures, photos, boards). `emissive` > 0 makes it self-lit (screens, blinds). */
export function canvasMat(L: LevelBuild, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, emissive = 0): THREE.MeshStandardMaterial {
  return mat3(L, `canvas_${key}`, () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const m = L.ctx.materials.clone('plastic_white', { map: t, color: 0xffffff, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: 0.75, metalness: 0 });
    if (emissive > 0) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t; m.emissiveIntensity = emissive; }
    return m;
  });
}
function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Pictures: a fjord print, abstract colour fields, a family snapshot (blurred figures as colour shapes — no faces). */
export function artMat(L: LevelBuild, kind: 'fjord' | 'abstract' | 'photo' | 'seabed' | 'map', seed = 1): THREE.MeshStandardMaterial {
  return canvasMat(L, `art_${kind}_${seed}`, 512, 384, (g, W, H) => {
    const r = srand(seed * 977 + 13);
    if (kind === 'fjord') {
      const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, '#9fb7c9'); sky.addColorStop(1, '#e9dcc2');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const ridge = (base: number, amp: number, col: string) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed) * Math.cos(x * 0.004 + r() * 0.2)) - (x < W * 0.3 ? (W * 0.3 - x) * 0.6 : 0) - (x > W * 0.75 ? (x - W * 0.75) * 0.5 : 0));
        g.lineTo(W, H); g.fill();
      };
      ridge(H * 0.5, 60, '#6d7f86'); ridge(H * 0.6, 40, '#4b5d5f');
      const sea = g.createLinearGradient(0, H * 0.62, 0, H);
      sea.addColorStop(0, '#7b95a0'); sea.addColorStop(1, '#2f4950');
      g.fillStyle = sea; g.fillRect(W * 0.28, H * 0.62, W * 0.5, H);
      ridge(H * 0.85, 30, '#33433d');
      g.fillStyle = '#c94a2e'; g.fillRect(W * 0.46, H * 0.7, 10, 6); // a red boathouse
    } else if (kind === 'abstract') {
      const pal = ['#c46b3e', '#e2b65c', '#5f7f86', '#2f3b46', '#d9cbb0', '#8a4b52', '#7e9a6a'];
      g.fillStyle = '#efe6d4'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { g.fillStyle = pal[Math.floor(r() * pal.length)]; g.globalAlpha = 0.85; const x = r() * W * 0.7, y = r() * H * 0.7; g.fillRect(x, y, W * (0.15 + r() * 0.35), H * (0.12 + r() * 0.4)); }
      g.globalAlpha = 1; g.strokeStyle = '#2b2b2b'; g.lineWidth = 3; g.beginPath(); g.arc(W * (0.3 + r() * 0.4), H * 0.5, H * 0.22, 0, PI * 2); g.stroke();
    } else if (kind === 'photo') {
      // a family snapshot, soft focus: sky, a shore, three figures as colour shapes (no faces)
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, ['#a9c3d6', '#d8b98f', '#b9c9b0'][seed % 3]); sky.addColorStop(1, '#e8e0cf');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = ['#6f8a6a', '#8a9aa6', '#a58a63'][seed % 3]; g.fillRect(0, H * 0.62, W, H);
      g.filter = 'blur(6px)';
      const n = 2 + (seed % 3);
      for (let i = 0; i < n; i++) {
        const x = W * (0.25 + 0.5 * (i + 0.5) / n), hgt = H * (0.32 + 0.18 * r() + (i === 0 ? 0.1 : 0));
        g.fillStyle = ['#b2483a', '#3e5a86', '#e0c060', '#4d6b4a', '#f0ece4'][Math.floor(r() * 5)];
        g.fillRect(x - 26, H * 0.85 - hgt, 52, hgt * 0.62);
        g.fillStyle = '#d9b49a'; g.beginPath(); g.arc(x, H * 0.85 - hgt - 10, 22, 0, PI * 2); g.fill();
        g.fillStyle = '#4a3a2e'; g.beginPath(); g.arc(x, H * 0.85 - hgt - 18, 22, PI, 0); g.fill();
      }
      g.filter = 'none';
      g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(0, 0, W, H);
    } else if (kind === 'seabed') {
      const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, '#0d2a33'); s.addColorStop(1, '#03090b');
      g.fillStyle = s; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#c94a2e'; g.lineWidth = 6; g.beginPath(); g.moveTo(W * 0.55, H); g.lineTo(W * 0.5, 0); g.stroke();
      g.fillStyle = '#e8dcc4'; g.font = '600 26px "Avenir Next", Arial'; g.fillText('에리두 심해 기지 — 2,140m', 24, H - 24);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(200,230,230,${0.2 + r() * 0.4})`; g.fillRect(r() * W, r() * H, 2, 2); }
    } else {
      g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#5a6a72'; g.lineWidth = 10; g.beginPath(); g.arc(W / 2, H / 2, H * 0.33, 0, PI * 2); g.stroke();
      g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * H * 0.33, H / 2 + Math.sin(a) * H * 0.33); g.lineTo(W / 2 + Math.cos(a) * H * 0.45, H / 2 + Math.sin(a) * H * 0.45); g.stroke(); }
      g.fillStyle = '#2b3236'; g.font = '700 24px "Avenir Next", Arial'; g.fillText('주거 링 A', 24, 36);
    }
  });
}

// ───────────────────────────────────────────────────────────── greybox restyle

interface BatchLike { mat: THREE.Material; items: unknown[] }
/**
 * Re-material (or, with `to = null`, drop the render geometry of) one material batch of a greybox shell builder —
 * the stand-in blocks and greybox glass. Colliders are untouched (they are not in the batch). Must run inside the
 * room's build pass (the shell builder `<room>_grey` exists, not yet merged).
 */
export function restyle(L: LevelBuild, builder: string, match: (m: THREE.Material) => boolean, to: THREE.Material | null): number {
  const b = L.namedBuilder(builder) as unknown as { batches: Map<string, BatchLike> };
  let n = 0;
  for (const bt of b.batches.values()) {
    if (!match(bt.mat)) continue;
    n += bt.items.length;
    if (to) bt.mat = to; else bt.items.length = 0;
  }
  return n;
}
export const isStandin = (m: THREE.Material) => m.name === 'grey_standin';

// ───────────────────────────────────────────────────────────── planting

export type LeafKind = 'broad' | 'frond' | 'blade' | 'flower';
const LEAF_CELL: Record<LeafKind, keyof typeof LEAF_ATLAS> = { broad: 'broadleaf', frond: 'frond', blade: 'blade', flower: 'flower' };
/** Unit leaf card (1 × 1, base at the origin, tip +y) with a slight V fold along its midrib (+z), on one atlas cell. */
function leafCardGeo(kind: LeafKind): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = LEAF_ATLAS[LEAF_CELL[kind]];
  const fold = kind === 'blade' ? 0.03 : kind === 'flower' ? 0.0 : 0.08;
  const P = [-0.5, 0, 0, 0, 0, fold, 0.5, 0, 0, -0.5, 1, 0, 0, 1, fold * 1.4, 0.5, 1, 0];
  const U = [u0, v0, (u0 + u1) / 2, v0, u1, v0, u0, v1, (u0 + u1) / 2, v1, u1, v1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]);
  g.computeVertexNormals();
  return g;
}
/** Define the four leaf-card instances once per level (`l3_leaf_<kind>`); leaves do not cast shadows. */
export function defineLeaves(L: LevelBuild) {
  if (L.instDefs.has('l3_leaf_broad')) return;
  const leaf = L.ctx.materials.get('leaf');
  for (const k of ['broad', 'frond', 'blade', 'flower'] as LeafKind[]) L.defineInstance(`l3_leaf_${k}`, leaf, false, (b) => b.geo(leaf, leafCardGeo(k), 'keep'));
}
let leafCount = 0;
/** Leaf cards stamped so far (all builders) — for the budget report. */
export const leafStats = () => leafCount;
/** One card: base at (x,y,z), pointing toward yaw `ry`, tilted `tilt` from vertical (π/2 = horizontal), roll, size. */
export function leaf(b: Builder, kind: LeafKind, x: number, y: number, z: number, ry: number, tilt: number, roll: number, w: number, h = w) {
  b.inst(`l3_leaf_${kind}`, x, y, z, tilt, ry, roll, w, h, w);
  leafCount++;
}
/**
 * Leaf LOD: once the level is built, shuffle every leaf InstancedMesh's instances (deterministic) and draw only a
 * share of them on LOW (`share.low`), all of them on medium and above; follows quality changes. Install once.
 */
export function installLeafLod(L: LevelBuild, lowShare = 0.62) {
  let last = '';
  let meshes: THREE.InstancedMesh[] | null = null;
  const m4a = new THREE.Matrix4(), m4b = new THREE.Matrix4();
  L.updaters.push(() => {
    const q = L.ctx.render.quality;
    if (q === last) return;
    last = q;
    if (!meshes) {
      meshes = [];
      L.root.traverse((o) => {
        const im = o as THREE.InstancedMesh;
        if (!im.isInstancedMesh || !/:inst:l3_leaf_/.test(im.name)) return;
        const r = srand(im.count * 31 + im.name.length);
        for (let i = im.count - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          im.getMatrixAt(i, m4a); im.getMatrixAt(j, m4b); im.setMatrixAt(i, m4b); im.setMatrixAt(j, m4a);
        }
        im.instanceMatrix.needsUpdate = true;
        im.userData.full = im.count;
        meshes!.push(im);
      });
    }
    const k = q === 'low' ? lowShare : 1;
    for (const im of meshes) im.count = Math.max(1, Math.floor((im.userData.full as number) * k));
  });
}
/** A fern: `n` fronds arching out of a crown at (x,y,z). */
export function fern(b: Builder, x: number, y: number, z: number, s: number, R: Rng, n = 9) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + R.range(-0.3, 0.3), t = R.range(0.55, 1.15) - (i % 3 === 0 ? 0.3 : 0);
    const k = s * R.range(0.75, 1.1);
    leaf(b, 'frond', x + Math.sin(a) * 0.04, y, z + Math.cos(a) * 0.04, a, t, R.range(-0.2, 0.2), k * 0.75, k);
  }
}
/** A grass / sedge clump of blade cards. */
export function grass(b: Builder, x: number, y: number, z: number, s: number, R: Rng, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = R.range(0, PI * 2);
    leaf(b, 'blade', x + R.range(-0.06, 0.06), y, z + R.range(-0.06, 0.06), a, R.range(0.05, 0.45), R.range(-0.3, 0.3), s * R.range(0.4, 0.6), s * R.range(0.8, 1.2));
  }
}
/**
 * A foliage mass: `n` cards of `kind` scattered through an ellipsoid (centre, radii), each pointing outward and a
 * little down (leaves hang), `size` ± 25 %. Flowers (`flowers` share) on the upper half.
 */
export function foliage(b: Builder, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, size: number, R: Rng, kind: LeafKind = 'broad', flowers = 0) {
  for (let i = 0; i < n; i++) {
    // direction: uniform on the sphere, biased up and outward
    const u = R.range(-0.55, 1), th = R.range(0, PI * 2), s = Math.sqrt(1 - u * u);
    const dx = s * Math.sin(th), dy = u, dz = s * Math.cos(th);
    const d = Math.cbrt(R.range(0.35, 1));
    const px = cx + dx * rx * d, py = cy + dy * ry * d, pz = cz + dz * rz * d;
    const fl = flowers > 0 && dy > 0.1 && R.chance(flowers);
    const elev = Math.asin(Math.max(-1, Math.min(1, dy)));
    const tilt = PI / 2 - elev * 0.6 + R.range(0.0, 0.5);
    const k = size * R.range(0.75, 1.25) * (fl ? 0.6 : 1);
    leaf(b, fl ? 'flower' : kind, px, py, pz, th + R.range(-0.4, 0.4), fl ? R.range(0.6, 1.2) : tilt, R.range(-0.6, 0.6), k, k);
  }
}
/** A low flowering / leafy shrub sitting on (x,y,z). */
export function shrub(b: Builder, x: number, y: number, z: number, r: number, R: Rng, flowers = 0, density = 1) {
  const n = Math.round(density * 70 * r * r + 12);
  foliage(b, x, y + r * 0.6, z, r, r * 0.75, r, n, Math.min(0.32, 0.14 + r * 0.2), R, 'broad', flowers);
}
/**
 * A fig-like tree (fiddle-leaf / weeping fig): trunk + 3–5 branches of `bark`, canopy of broadleaf clusters, height
 * `h`, canopy radius ≤ `cr`. Collider: the trunk (0.4 × 0.4 to 2.4 m). Returns the number of leaf cards.
 */
export function tree(b: Builder, x: number, y: number, z: number, h: number, cr: number, R: Rng, leaves = 650): number {
  const c0 = leafCount;
  const trunkTop = h * R.range(0.45, 0.55);
  const lean = R.range(0, PI * 2), lx = Math.sin(lean) * 0.25, lz = Math.cos(lean) * 0.25;
  b.cyl('bark', x, y + 0.35, z, 0.24, 0.7, 'y', 12, 0.17); // root flare
  b.rod('bark', x, y + 0.6, z, x + lx, y + trunkTop, z + lz, 0.16, 10);
  b.sphere('bark', x + lx, y + trunkTop, z + lz, 0.165, 10);
  const nb = R.int(3, 5);
  const blobs: [number, number, number, number][] = [];
  for (let i = 0; i < nb; i++) {
    const a = lean + (i / nb) * PI * 2 + R.range(-0.4, 0.4);
    const reach = cr * R.range(0.45, 0.75), up = h * R.range(0.25, 0.42);
    const ex = x + lx + Math.sin(a) * reach, ey = y + trunkTop + up, ez = z + lz + Math.cos(a) * reach;
    const mx = x + lx + Math.sin(a) * reach * 0.45, my = y + trunkTop + up * 0.55, mz = z + lz + Math.cos(a) * reach * 0.45;
    b.rod('bark', x + lx, y + trunkTop, z + lz, mx, my, mz, 0.1, 8);
    b.sphere('bark', mx, my, mz, 0.1, 8);
    b.rod('bark', mx, my, mz, ex, ey, ez, 0.065, 7);
    // twigs
    for (let t = 0; t < 2; t++) { const ta = a + R.range(-0.9, 0.9); b.rod('bark', ex, ey, ez, ex + Math.sin(ta) * 0.5, ey + R.range(0.2, 0.6), ez + Math.cos(ta) * 0.5, 0.03, 5); }
    blobs.push([ex, ey + 0.1, ez, cr * R.range(0.42, 0.58)]);
  }
  // a crown cluster over the top
  blobs.push([x + lx, y + h - cr * 0.55, z + lz, cr * 0.6]);
  b.rod('bark', x + lx, y + trunkTop, z + lz, x + lx, y + h - cr * 0.55, z + lz, 0.09, 8);
  const per = Math.floor(leaves / blobs.length);
  for (const [bx, by, bz, br] of blobs) foliage(b, bx, by, bz, br, br * 0.8, br, per, 0.34, R, 'broad');
  b.collide(x - 0.2, y, z - 0.2, x + 0.2, y + 2.4, z + 0.2, 'concrete', true);
  return leafCount - c0;
}

/** A pot: lathe profile, radius r at the rim, height h, with a soil top. */
export function pot(b: Builder, x: number, y: number, z: number, r: number, h: number, mat: Mat = 'stone_pale') {
  lathe(b, mat, [[r * 0.72, 0], [r * 0.95, h * 0.85], [r, h * 0.88], [r, h], [r * 0.9, h]], x, y, z, 16);
  b.cyl('soil', x, y + h - 0.04, z, r * 0.9, 0.02, 'y', 14);
}
/** A potted plant: 'fig' (rubber plant: stems + big leaves), 'fern', 'palm' (fronds on a cane), 'snake' (blades). */
export function pottedPlant(b: Builder, x: number, y: number, z: number, kind: 'fig' | 'fern' | 'palm' | 'snake', s: number, R: Rng, potMat: Mat = 'stone_pale', collide = true) {
  const pr = 0.16 + 0.12 * s, ph = 0.28 + 0.22 * s;
  pot(b, x, y, z, pr, ph, potMat);
  const top = y + ph - 0.03;
  if (kind === 'fig') {
    for (let i = 0; i < 3; i++) {
      const a = R.range(0, PI * 2), hh = s * R.range(0.8, 1.5);
      const ex = x + Math.sin(a) * 0.15, ez = z + Math.cos(a) * 0.15;
      b.rod('bark', x + Math.sin(a) * 0.05, top, z + Math.cos(a) * 0.05, ex, top + hh, ez, 0.018, 5);
      for (let k = 0; k < 9; k++) {
        const t = 0.25 + (k / 9) * 0.75, la = a + k * 2.4;
        leaf(b, 'broad', x + (ex - x) * t, top + hh * t, z + (ez - z) * t, la, R.range(0.9, 1.5), R.range(-0.3, 0.3), 0.26 * s + 0.08);
      }
    }
  } else if (kind === 'fern') fern(b, x, top, z, 0.45 + 0.4 * s, R, 11);
  else if (kind === 'palm') {
    const hh = 0.6 + s * 0.9;
    b.rod('bark', x, top, z, x + 0.05, top + hh, z, 0.03, 6);
    for (let i = 0; i < 8; i++) leaf(b, 'frond', x + 0.05, top + hh, z, (i / 8) * PI * 2 + R.range(-0.2, 0.2), R.range(0.6, 1.3), 0, 0.6 * s + 0.3, 0.8 * s + 0.4);
    fern(b, x, top, z, 0.35, R, 5);
  } else grass(b, x, top, z, 0.5 + 0.5 * s, R, 9);
  if (collide) b.collide(x - pr, y, z - pr, x + pr, y + ph, z + pr, 'concrete', true);
}
/**
 * Raised bed (box x0…x1, z0…z1, top `h`): edging of `edge` (0.12 thick), soil top at h − 0.06, collider to h (you can
 * stand on it). `fill` plants it (density per m²: ferns, grasses, shrubs with flowers).
 */
export function planterBed(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, y: number, R: Rng, edge: Mat = 'wood_dark', fill = 1, flowers = 0.12, collide = true) {
  const t = 0.12;
  b.bx(edge, x0, y, z0, x1, y + h, z0 + t).bx(edge, x0, y, z1 - t, x1, y + h, z1);
  b.bx(edge, x0, y, z0 + t, x0 + t, y + h, z1 - t).bx(edge, x1 - t, y, z0 + t, x1, y + h, z1 - t);
  // coping 2 cm proud of the edging on top (a cap rail)
  b.detail(() => {
    b.bx('stone_pale', x0 - 0.02, y + h, z0 - 0.02, x1 + 0.02, y + h + 0.04, z0 + t + 0.02).bx('stone_pale', x0 - 0.02, y + h, z1 - t - 0.02, x1 + 0.02, y + h + 0.04, z1 + 0.02);
    b.bx('stone_pale', x0 - 0.02, y + h, z0 + t + 0.02, x0 + t + 0.02, y + h + 0.04, z1 - t - 0.02).bx('stone_pale', x1 - t - 0.02, y + h, z0 + t + 0.02, x1 + 0.02, y + h + 0.04, z1 - t - 0.02);
  });
  b.bx('soil', x0 + t, y, z0 + t, x1 - t, y + h - 0.06, z1 - t);
  if (collide) b.collide(x0, y, z0, x1, y + h, z1, 'concrete', true);
  if (fill <= 0) return;
  const sy = y + h - 0.06;
  const area = (x1 - x0 - 2 * t) * (z1 - z0 - 2 * t);
  const n = Math.round(area * 1.6 * fill);
  // jittered grid (no bald patches), big plants toward the middle, low ones at the edges
  const nx = Math.max(1, Math.round(Math.sqrt(n * (x1 - x0) / (z1 - z0)))), nz = Math.max(1, Math.round(n / nx));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 - t, hz = (z1 - z0) / 2 - t;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const px = x0 + t + ((i + R.range(0.15, 0.85)) / nx) * (x1 - x0 - 2 * t), pz = z0 + t + ((j + R.range(0.15, 0.85)) / nz) * (z1 - z0 - 2 * t);
    const edge = Math.max(Math.abs(px - cx) / hx, Math.abs(pz - cz) / hz);
    const k = R();
    if (edge > 0.75 && k < 0.5) grass(b, px, sy, pz, R.range(0.35, 0.6), R, R.int(5, 7));
    else if (k < 0.42) fern(b, px, sy, pz, R.range(0.6, 1.1), R, R.int(7, 10));
    else if (k < 0.55) grass(b, px, sy, pz, R.range(0.5, 0.9), R, R.int(5, 8));
    else shrub(b, px, sy, pz, R.range(0.35, 0.75) * (edge < 0.6 ? 1.3 : 1), R, flowers, 0.7);
  }
}

// ───────────────────────────────────────────────────────────── furniture (front = +z)

/** Sofa w wide, 0.88 deep; seat 0.44, back 0.82; three cushions; collider. */
export function sofa(b: Builder, L: LevelBuild, w: number, tint: number, collide = true) {
  const f = fabric(L, tint), d = 0.88;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('wood_dark', sx * (w / 2 - 0.08), 0.06, sz * (d / 2 - 0.08), 0.025, 0.12, 'y', 6, 0.018);
  b.bx(f, -w / 2, 0.12, -d / 2, w / 2, 0.32, d / 2);
  const n = w > 1.6 ? 3 : 2, cw = (w - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + 0.18 + i * cw;
    b.bx(f, x0 + 0.01, 0.32, -d / 2 + 0.2, x0 + cw - 0.01, 0.44, d / 2 - 0.02);
    b.rbox(f, x0 + cw / 2, 0.62, -d / 2 + 0.16, cw - 0.03, 0.4, 0.16, -0.12, 0, 0);
  }
  b.bx(f, -w / 2, 0.32, -d / 2, w / 2, 0.82, -d / 2 + 0.16);
  for (const s of [-1, 1]) b.bx(f, s > 0 ? w / 2 - 0.18 : -w / 2, 0.32, -d / 2 + 0.16, s > 0 ? w / 2 : -w / 2 + 0.18, 0.62, d / 2);
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, 0.62, d / 2, 'rubber', true);
}
export function armchair(b: Builder, L: LevelBuild, tint: number, collide = true) { sofa(b, L, 0.86, tint, collide); }
export function coffeeTable(b: Builder, w: number, d: number, top: Mat = 'wood_dark', h = 0.42, collide = true) {
  b.bx(top, -w / 2, h - 0.04, -d / 2, w / 2, h, d / 2);
  b.bx(top, -w / 2 + 0.06, 0.12, -d / 2 + 0.06, w / 2 - 0.06, 0.14, d / 2 - 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx(top, sx * (w / 2 - 0.05) - 0.025, 0, sz * (d / 2 - 0.05) - 0.025, sx * (w / 2 - 0.05) + 0.025, h - 0.04, sz * (d / 2 - 0.05) + 0.025);
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'concrete', true);
}
/**
 * Office desk w × d, top h; the user sits at local +z (front). `ped` = drawer pedestal side(s); a modesty panel at the
 * back (−z). Collider over the whole footprint (you cannot crawl under a desk in this game anyway).
 */
export function desk3(b: Builder, w: number, d: number, h = 0.75, top: Mat = 'wood_veneer', body: Mat = 'wood_veneer', ped: 'l' | 'r' | 'both' | null = 'r', collide = true) {
  b.bx(top, -w / 2, h - 0.035, -d / 2, w / 2, h, d / 2);
  b.detail(() => b.bx('wood_dark', -w / 2 - 0.004, h - 0.031, d / 2, w / 2 + 0.004, h - 0.004, d / 2 + 0.006)); // edge band
  const sides = ped === 'both' ? [-1, 1] : ped === 'l' ? [-1] : ped === 'r' ? [1] : [];
  for (const s of [-1, 1]) {
    if (sides.includes(s)) {
      const x0 = s > 0 ? w / 2 - 0.42 : -w / 2, x1 = s > 0 ? w / 2 : -w / 2 + 0.42;
      b.bx(body, x0, 0.02, -d / 2 + 0.02, x1, h - 0.035, d / 2 - 0.03);
      b.detail(() => {
        for (let k = 0; k < 3; k++) {
          const y0 = 0.06 + k * ((h - 0.12) / 3), y1 = y0 + (h - 0.12) / 3 - 0.02;
          b.bx(body, x0 + 0.02, y0, d / 2 - 0.03, x1 - 0.02, y1, d / 2 - 0.012);
          b.bx('brass', (x0 + x1) / 2 - 0.06, y1 - 0.06, d / 2 - 0.012, (x0 + x1) / 2 + 0.06, y1 - 0.045, d / 2 + 0.008);
        }
      });
    } else b.bx(body, s > 0 ? w / 2 - 0.04 : -w / 2, 0, -d / 2 + 0.02, s > 0 ? w / 2 : -w / 2 + 0.04, h - 0.035, d / 2 - 0.02);
  }
  b.bx(body, -w / 2 + 0.04, 0.3, -d / 2 + 0.02, w / 2 - 0.04, h - 0.035, -d / 2 + 0.05); // modesty panel
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'concrete', true);
}
/** Swivel office chair (seat 0.47), facing +z. No collider by default. */
export function officeChair(b: Builder, L: LevelBuild, tint: number, collide = false) {
  const f = fabric(L, tint);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    b.rod('plastic_dark', 0, 0.08, 0, Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3, 0.018, 5);
    b.sphere('plastic_dark', Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, 0.028, 6);
  }
  b.cyl('chrome', 0, 0.26, 0, 0.025, 0.36, 'y', 8);
  b.bx('plastic_dark', -0.2, 0.42, -0.2, 0.2, 0.44, 0.2);
  b.bx(f, -0.24, 0.44, -0.22, 0.24, 0.5, 0.24);
  b.rod('plastic_dark', 0, 0.44, -0.2, 0, 0.62, -0.26, 0.02, 5);
  b.rbox(f, 0, 0.82, -0.27, 0.44, 0.5, 0.06, -0.12, 0, 0);
  for (const s of [-1, 1]) { b.rod('plastic_dark', s * 0.24, 0.5, -0.1, s * 0.25, 0.66, -0.05, 0.015, 5); b.box('plastic_dark', s * 0.25, 0.67, 0.02, 0.05, 0.025, 0.24); }
  if (collide) b.collide(-0.3, 0, -0.3, 0.3, 0.6, 0.3, 'concrete', true);
}
/** Wooden visitor chair, upholstered seat and back pad (seat 0.47), facing +z. */
export function visitorChair(b: Builder, L: LevelBuild, tint: number, collide = false) {
  const f = fabric(L, tint);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx('wood_dark', sx * 0.21 - 0.02, 0, sz * 0.2 - 0.02, sx * 0.21 + 0.02, 0.42, sz * 0.2 + 0.02);
  for (const sx of [-1, 1]) b.bx('wood_dark', sx * 0.21 - 0.02, 0.42, -0.22, sx * 0.21 + 0.02, 0.9, -0.18);
  b.bx('wood_dark', -0.24, 0.4, -0.24, 0.24, 0.43, 0.24);
  b.bx(f, -0.23, 0.43, -0.2, 0.23, 0.48, 0.23);
  b.bx(f, -0.19, 0.55, -0.235, 0.19, 0.86, -0.19);
  b.bx('wood_dark', -0.21, 0.86, -0.225, 0.21, 0.9, -0.18);
  if (collide) b.collide(-0.25, 0, -0.25, 0.25, 0.48, 0.25, 'concrete', true);
}
/** Filing cabinet (n drawers, 0.47 wide, 0.62 deep), front +z. */
export function filingCabinet(b: Builder, n: number, mat: Mat = 'painted_white', collide = true) {
  const h = 0.05 + n * 0.33;
  b.bx(mat, -0.235, 0, -0.31, 0.235, h, 0.29);
  b.detail(() => {
    for (let k = 0; k < n; k++) {
      const y0 = 0.05 + k * 0.33;
      b.bx(mat, -0.22, y0 + 0.01, 0.29, 0.22, y0 + 0.31, 0.305);
      b.bx('chrome', -0.07, y0 + 0.22, 0.305, 0.07, y0 + 0.24, 0.322);
      b.bx('plastic_white', -0.04, y0 + 0.26, 0.305, 0.04, y0 + 0.29, 0.309);
    }
  });
  if (collide) b.collide(-0.235, 0, -0.31, 0.235, h, 0.31, 'metal', true);
}
/** Book spines along local x (bottom at y, spines facing +z at z), filling `len`. */
export function books(b: Builder, L: LevelBuild, x0: number, len: number, y: number, z: number, maxH: number, R: Rng) {
  const mats: Mat[] = [fabric(L, TINT.rust), fabric(L, TINT.slate), fabric(L, TINT.sage), fabric(L, TINT.cream), 'wood_dark', fabric(L, TINT.mustard), fabric(L, TINT.plum)];
  let x = x0;
  while (x < x0 + len - 0.03) {
    if (R.chance(0.06)) { x += R.range(0.05, 0.15); continue; }
    const t = R.range(0.02, 0.05), h = maxH * R.range(0.7, 1), d = R.range(0.14, 0.22);
    if (x + t > x0 + len) break;
    const lean = R.chance(0.08) ? R.range(0.1, 0.25) : 0;
    b.rbox(R.pick(mats), x + t / 2 + lean * h * 0.5, y + h / 2, z - d / 2 - 0.005, t, h, d, 0, 0, -lean);
    x += t + 0.002 + lean * h;
  }
}
/** Bookcase w × h × 0.32, open shelves with books and a few objects. Front +z. */
export function bookcase(b: Builder, L: LevelBuild, w: number, h: number, R: Rng, mat: Mat = 'wood_veneer', collide = true) {
  const d = 0.32, t = 0.025;
  b.bx(mat, -w / 2, 0, -d / 2, -w / 2 + t, h, d / 2).bx(mat, w / 2 - t, 0, -d / 2, w / 2, h, d / 2);
  b.bx(mat, -w / 2, h - t, -d / 2, w / 2, h, d / 2).bx(mat, -w / 2 + t, 0, -d / 2, w / 2 - t, 0.08, d / 2);
  b.bx('wood_dark', -w / 2 + t, 0.08, -d / 2, w / 2 - t, h - t, -d / 2 + 0.01);
  const n = Math.max(2, Math.round((h - 0.1) / 0.36));
  const sh = (h - 0.08 - t) / n;
  for (let i = 1; i < n; i++) b.bx(mat, -w / 2 + t, 0.08 + i * sh - 0.012, -d / 2 + 0.01, w / 2 - t, 0.08 + i * sh + 0.012, d / 2);
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const y = 0.08 + i * sh + 0.012;
      const fill = R.range(0.45, 0.95);
      books(b, L, -w / 2 + t + 0.01, (w - 2 * t - 0.02) * fill, y, d / 2 - 0.02, Math.min(0.3, sh - 0.04), R);
      if (fill < 0.8 && R.chance(0.6)) b.box(R.pick<Mat>(['brass', 'stone_pale', 'plastic_white']), w / 2 - t - 0.12, y + 0.06, 0, 0.1, 0.12, 0.1);
    }
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'concrete', true);
}
/** Wooden slatted bench on two stone/steel legs, seat 0.45, len along x, 0.46 deep. Collider. */
export function bench3(b: Builder, len: number, legs: Mat = 'stone_pale', slats: Mat = 'wood_veneer', collide = true, back = false) {
  for (const s of [-1, 1]) b.bx(legs, s * (len / 2 - 0.25) - 0.06, 0, -0.2, s * (len / 2 - 0.25) + 0.06, 0.39, 0.2);
  b.bx('painted_dark', -len / 2 + 0.1, 0.39, -0.18, len / 2 - 0.1, 0.41, 0.18);
  for (let i = 0; i < 5; i++) { const z = -0.2 + i * 0.1; b.bx(slats, -len / 2, 0.41, z - 0.035, len / 2, 0.45, z + 0.035); }
  if (back) {
    for (const s of [-1, 1]) b.bx('painted_dark', s * (len / 2 - 0.25) - 0.02, 0.41, -0.23, s * (len / 2 - 0.25) + 0.02, 0.85, -0.19);
    for (let i = 0; i < 3; i++) b.bx(slats, -len / 2, 0.55 + i * 0.11, -0.25, len / 2, 0.62 + i * 0.11, -0.21);
  }
  if (collide) b.collide(-len / 2, 0, -0.23, len / 2, 0.45, 0.23, 'concrete', true);
}
/** A rug lying on the floor (1.2 cm, border band). */
export function rug(b: Builder, L: LevelBuild, w: number, d: number, tint: number, border: number) {
  b.detail(() => {
    b.bx(fabric(L, border), -w / 2, 0, -d / 2, w / 2, 0.01, d / 2);
    b.bx(fabric(L, tint), -w / 2 + 0.12, 0.01, -d / 2 + 0.12, w / 2 - 0.12, 0.013, d / 2 - 0.12);
  });
}
/** Low sideboard / credenza w × 0.45 × h, sliding doors. Front +z. */
export function sideboard(b: Builder, w: number, h = 0.75, mat: Mat = 'wood_veneer', collide = true) {
  b.bx(mat, -w / 2, 0.08, -0.225, w / 2, h, 0.225);
  b.bx('painted_dark', -w / 2 + 0.05, 0, -0.18, w / 2 - 0.05, 0.08, 0.18);
  b.detail(() => {
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + 0.02 + i * ((w - 0.04) / n), x1 = x0 + (w - 0.04) / n - 0.008;
      b.bx(mat, x0, 0.1, 0.225, x1, h - 0.02, 0.236);
      b.bx('brass', x1 - 0.05, h * 0.45, 0.236, x1 - 0.035, h * 0.45 + 0.12, 0.246);
    }
  });
  if (collide) b.collide(-w / 2, 0, -0.225, w / 2, h, 0.225, 'concrete', true);
}
/** Kitchenette run w long, against a wall behind (−z): base units, worktop, sink, upper cabinets, kettle and mugs. */
export function kitchenette(b: Builder, L: LevelBuild, w: number, R: Rng, collide = true) {
  const d = 0.6;
  b.bx('painted_white', -w / 2, 0.1, -d / 2, w / 2, 0.88, d / 2 - 0.02);
  b.bx('painted_dark', -w / 2, 0, -d / 2, w / 2, 0.1, d / 2 - 0.08);
  b.bx('stone_pale', -w / 2 - 0.01, 0.88, -d / 2, w / 2 + 0.01, 0.92, d / 2 + 0.01);
  b.detail(() => {
    const n = Math.round(w / 0.6);
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + i * (w / n) + 0.004, x1 = x0 + w / n - 0.008;
      b.bx('wood_veneer', x0, 0.12, d / 2 - 0.02, x1, 0.86, d / 2 - 0.004);
      b.bx('chrome', (x0 + x1) / 2 - 0.08, 0.8, d / 2 - 0.004, (x0 + x1) / 2 + 0.08, 0.815, d / 2 + 0.016);
      b.bx('wood_veneer', x0, 1.45, -d / 2, x1, 2.15, -d / 2 + 0.34);
      b.bx('chrome', (x0 + x1) / 2 - 0.06, 1.5, -d / 2 + 0.34, (x0 + x1) / 2 + 0.06, 1.515, -d / 2 + 0.36);
    }
    // sink + tap
    b.bx('chrome', -w / 4 - 0.25, 0.921, -0.2, -w / 4 + 0.25, 0.925, 0.2);
    b.bx('painted_dark', -w / 4 - 0.21, 0.925, -0.17, -w / 4 + 0.21, 0.927, 0.17);
    b.rod('chrome', -w / 4, 0.92, -0.25, -w / 4, 1.2, -0.25, 0.015, 6);
    b.rod('chrome', -w / 4, 1.2, -0.25, -w / 4, 1.2, -0.08, 0.013, 6);
    kettle(b, w / 4, 0.92, -0.1);
    for (let i = 0; i < 4; i++) b.at(w / 4 + 0.25 + i * 0.1, 0.92, 0.05 + R.range(-0.05, 0.08), R.range(0, 6), () => mug(b, L, i));
    // microwave
    b.bx('plastic_white', w / 2 - 0.55, 0.92, -0.28, w / 2 - 0.05, 1.2, 0.08);
    b.bx('screen_off', w / 2 - 0.5, 0.96, 0.08, w / 2 - 0.2, 1.16, 0.085);
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, 0.92, d / 2, 'concrete', true);
}
export function fridge(b: Builder, h = 1.8, collide = true) {
  b.bx('plastic_white', -0.3, 0, -0.32, 0.3, h, 0.3);
  b.detail(() => { b.bx('plastic_white', -0.29, h * 0.62, 0.3, 0.29, h - 0.01, 0.32); b.bx('plastic_white', -0.29, 0.01, 0.3, 0.29, h * 0.62 - 0.01, 0.32); b.bx('chrome', 0.22, h * 0.66, 0.32, 0.24, h * 0.8, 0.345); b.bx('chrome', 0.22, h * 0.4, 0.32, 0.24, h * 0.56, 0.345); });
  if (collide) b.collide(-0.3, 0, -0.32, 0.3, h, 0.34, 'metal', true);
}

// ───────────────────────────────────────────────────────────── small objects (origin on the surface)

export function mug(b: Builder, L: LevelBuild, k = 0) {
  const m = [paint(L, 0xe8e2d6, 0.3), paint(L, 0x8a3b2e, 0.35), paint(L, 0x3f5a78, 0.35), paint(L, 0xd7a53b, 0.35)][k % 4];
  b.cyl(m, 0, 0.05, 0, 0.04, 0.1, 'y', 10);
  b.cyl('painted_dark', 0, 0.096, 0, 0.034, 0.004, 'y', 10);
  b.torus(m, 0.046, 0.05, 0, 0.025, 0.007, 'z', 8);
}
export function kettle(b: Builder, x: number, y: number, z: number) {
  b.cyl('chrome', x, y + 0.02, z, 0.1, 0.04, 'y', 12);
  b.cyl('chrome', x, y + 0.13, z, 0.085, 0.18, 'y', 12, 0.07);
  b.rod('plastic_dark', x - 0.06, y + 0.2, z, x - 0.1, y + 0.12, z, 0.012, 5);
}
/**
 * Desk phone: the user sits on its −z side (keypad rows run along z, rising away from them); the cradle with the
 * handset along z on its −x side. `handset: false` leaves the cradle empty (an actor draws his own receiver there).
 */
export function deskPhone(b: Builder, L: LevelBuild, handset = true) {
  const cream = paint(L, 0xe6dcc3, 0.45);
  b.rbox(cream, 0, 0.03, 0, 0.2, 0.06, 0.22, -0.15, 0, 0);
  b.detail(() => { for (let i = 0; i < 12; i++) b.box('plastic_dark', -0.04 + (i % 3) * 0.04, 0.066 - Math.floor(i / 3) * 0.006, 0.05 - Math.floor(i / 3) * 0.035, 0.025, 0.006, 0.022); });
  if (handset) {
    b.rbox(cream, -0.065, 0.085, 0, 0.06, 0.05, 0.22, 0, 0, 0);
    b.sphere(cream, -0.065, 0.085, 0.1, 0.035, 8); b.sphere(cream, -0.065, 0.085, -0.1, 0.035, 8);
  } else {
    // the empty cradle: two rests and the hook switch between them
    for (const z of [-0.075, 0.075]) b.rbox(cream, -0.065, 0.07, z, 0.06, 0.03, 0.045, 0, 0, 0);
    b.box('plastic_dark', -0.065, 0.072, 0, 0.012, 0.012, 0.02);
  }
}
/** Monitor w × h on a foot; screen face +z (a dead `screen_off` face unless a screen quad is put on it). */
export function monitor(b: Builder, w = 0.52, h = 0.32, screen = true) {
  b.bx('plastic_dark', -0.1, 0, -0.08, 0.1, 0.015, 0.06);
  b.bx('plastic_dark', -0.025, 0.015, -0.04, 0.025, 0.16, -0.02);
  b.bx('plastic_dark', -w / 2 - 0.015, 0.12, -0.03, w / 2 + 0.015, 0.12 + h + 0.03, 0.0);
  if (screen) b.bx('screen_off', -w / 2, 0.135, 0.0, w / 2, 0.135 + h, 0.004);
}
export function keyboard(b: Builder) { b.rbox('plastic_dark', 0, 0.012, 0, 0.42, 0.02, 0.14, 0.05, 0, 0); b.box('plastic_white', 0.3, 0.012, 0.02, 0.06, 0.02, 0.1); }
/** Loose sheets on a surface (overlay paper, polygon offset). */
export function papersFlat(b: Builder, L: LevelBuild, n: number, spread: number, R: Rng) {
  const p = paper(L);
  b.detail(() => { for (let i = 0; i < n; i++) b.rbox(p, R.range(-spread, spread), 0.002 + i * 0.0015, R.range(-spread, spread) * 0.7, 0.21, 0.0015, 0.297, 0, R.range(-0.5, 0.5), 0); });
}
/** A standing photo frame (photo face +z). */
export function photoFrame(b: Builder, L: LevelBuild, seed: number, w = 0.15, h = 0.11) {
  b.push(0, 0, 0, 0, -0.18);
  b.bx('wood_dark', -w / 2 - 0.012, 0, -0.008, w / 2 + 0.012, h + 0.024, 0.006);
  b.quad(artMat(L, 'photo', seed), 0, h / 2 + 0.012, 0.011, w, h, '+z');
  b.pop();
  b.rod('wood_dark', 0, 0.0, -0.07, 0, h * 0.7, -0.01, 0.004, 4);
}
/** Table lamp: ceramic base, fabric drum shade (emissive inside). */
export function tableLamp(b: Builder, L: LevelBuild, glow: Mat, s = 1) {
  lathe(b, paint(L, 0x9a7a5a, 0.35), [[0.07 * s, 0], [0.09 * s, 0.08 * s], [0.06 * s, 0.2 * s], [0.015 * s, 0.24 * s], [0.012 * s, 0.32 * s]], 0, 0, 0, 12);
  b.cyl(glow, 0, 0.36 * s, 0, 0.15 * s, 0.16 * s, 'y', 16, 0.12 * s);
}
/** Banker's lamp: brass base and stem, green glass shade, a glowing underside (`glow`). */
export function bankersLamp(b: Builder, L: LevelBuild, glow: Mat) {
  const green = mat3(L, 'bankers_green', () => L.ctx.materials.clone('glass_thick', { color: 0x1f6a3a, emissive: new THREE.Color(0x0b3a18), emissiveIntensity: 0.25, transparent: false, opacity: 1, roughness: 0.15, metalness: 0.1 }));
  b.box('brass', 0, 0.012, 0, 0.26, 0.024, 0.14);
  b.rod('brass', 0.08, 0.024, 0, 0.08, 0.34, 0, 0.008, 6);
  b.rod('brass', 0.08, 0.34, 0, 0.0, 0.34, 0, 0.007, 6);
  b.push(0, 0.33, 0, 0, 0, 0);
  b.cyl(green, 0, 0.0, 0, 0.075, 0.33, 'x', 12);
  b.bx('brass', -0.17, -0.005, -0.075, 0.17, 0.005, 0.075);
  b.box(glow, 0, -0.03, 0, 0.3, 0.012, 0.09);
  b.pop();
}
/** Floor lamp: brass pole, linen shade (emissive inside). */
export function floorLamp(b: Builder, L: LevelBuild, glow: Mat) {
  b.cyl('brass', 0, 0.015, 0, 0.16, 0.03, 'y', 14);
  b.rod('brass', 0, 0.03, 0, 0, 1.45, 0, 0.012, 6);
  b.cyl(glow, 0, 1.48, 0, 0.2, 0.3, 'y', 16, 0.17);
  b.cyl(fabric(L, TINT.cream), 0, 1.63, 0, 0.172, 0.006, 'y', 16);
}
export function radio(b: Builder, L: LevelBuild) {
  const body = paint(L, 0x6d4a32, 0.4);
  b.bx(body, -0.16, 0, -0.06, 0.16, 0.17, 0.06);
  b.bx(fabric(L, TINT.cream), -0.14, 0.03, 0.06, 0.02, 0.15, 0.064);
  b.cyl('brass', 0.08, 0.1, 0.065, 0.025, 0.012, 'z', 10);
  b.cyl('brass', 0.08, 0.04, 0.065, 0.015, 0.012, 'z', 8);
  b.rod('chrome', 0.13, 0.17, -0.03, 0.2, 0.55, -0.05, 0.004, 4);
}
export function plantSmall(b: Builder, R: Rng, mat: Mat = 'stone_pale') {
  pot(b, 0, 0, 0, 0.07, 0.11, mat);
  for (let i = 0; i < 9; i++) leaf(b, R.chance(0.5) ? 'broad' : 'blade', R.range(-0.02, 0.02), 0.1, R.range(-0.02, 0.02), R.range(0, PI * 2), R.range(0.4, 1.1), 0, 0.12, 0.16);
}

// ───────────────────────────────────────────────────────────── on walls (local frame: wall plane z = 0, face +z)

/**
 * Run `fn` in a wall's frame: local x along the wall, y up, z out of the wall face. `face` is the direction the
 * wall face looks (into the room); `plane` its coordinate. For '+z': local x = world x; '-z': local x = −world x;
 * '+x': local x = −world z; '-x': local x = world z. Use `wallU(face, worldCoord)` to convert.
 */
export function alongWall(b: Builder, face: '+x' | '-x' | '+z' | '-z', plane: number, y: number, fn: () => void) {
  if (face === '+z') b.push(0, y, plane, 0);
  else if (face === '-z') b.push(0, y, plane, PI);
  else if (face === '+x') b.push(plane, y, 0, PI / 2);
  else b.push(plane, y, 0, -PI / 2);
  fn();
  b.pop();
}
export const wallU = (face: '+x' | '-x' | '+z' | '-z', w: number) => (face === '+z' ? w : face === '-z' ? -w : face === '+x' ? -w : w);

export function pictureFrame(b: Builder, art: Mat, x: number, y: number, w: number, h: number, frame: Mat = 'wood_dark', mount = true) {
  const f = 0.035, d = 0.03;
  b.bx(frame, x - w / 2 - f, y - h / 2 - f, 0.002, x + w / 2 + f, y - h / 2, d).bx(frame, x - w / 2 - f, y + h / 2, 0.002, x + w / 2 + f, y + h / 2 + f, d);
  b.bx(frame, x - w / 2 - f, y - h / 2, 0.002, x - w / 2, y + h / 2, d).bx(frame, x + w / 2, y - h / 2, 0.002, x + w / 2 + f, y + h / 2, d);
  if (mount) b.bx('plastic_white', x - w / 2, y - h / 2, 0.004, x + w / 2, y + h / 2, 0.012);
  const m = mount ? 0.06 : 0;
  b.quad(art, x, y, mount ? 0.019 : 0.009, w - 2 * m, h - 2 * m, '+z');
}
/** Cork notice board w × h with pinned sheets (x,y = centre). */
export function noticeBoard(b: Builder, L: LevelBuild, x: number, y: number, w: number, h: number, R: Rng, sheets = 7) {
  const cork = paint(L, 0xa47b52, 0.9);
  b.bx('wood_dark', x - w / 2 - 0.03, y - h / 2 - 0.03, 0.002, x + w / 2 + 0.03, y + h / 2 + 0.03, 0.02);
  b.bx(cork, x - w / 2, y - h / 2, 0.02, x + w / 2, y + h / 2, 0.026);
  const tints = [0xf1ece0, 0xf4e7a6, 0xe8d0c8, 0xdfe7ee, 0xf1ece0];
  b.detail(() => {
    for (let i = 0; i < sheets; i++) {
      const pw = R.range(0.14, 0.24), ph = pw * R.range(1.2, 1.45);
      const px = x - w / 2 + pw / 2 + 0.04 + R() * (w - pw - 0.08), py = y - h / 2 + ph / 2 + 0.04 + R() * (h - ph - 0.08);
      b.quad(paper(L, R.pick(tints)), px, py, 0.026, pw, ph, '+z', R.range(-0.08, 0.08), 'unit', 0.003 + i * 0.0007);
      b.sphere(paint(L, R.pick([0xc0392b, 0x2e6fa8, 0xd8a83a]), 0.4), px, py + ph / 2 - 0.02, 0.034, 0.008, 5);
    }
  });
}
export function whiteboard(b: Builder, L: LevelBuild, x: number, y: number, w: number, h: number, ink: THREE.Material | null) {
  b.bx('chrome', x - w / 2 - 0.02, y - h / 2 - 0.02, 0.002, x + w / 2 + 0.02, y + h / 2 + 0.02, 0.018);
  b.bx(paint(L, 0xf6f6f2, 0.15), x - w / 2, y - h / 2, 0.018, x + w / 2, y + h / 2, 0.022);
  b.bx('chrome', x - w / 2, y - h / 2 - 0.05, 0.02, x + w / 2, y - h / 2 - 0.03, 0.08);
  if (ink) b.quad(ink, x, y, 0.022, w - 0.06, h - 0.06, '+z', 0, 'unit', 0.007);
}
/**
 * Wainscot on a wall run (local frame of `alongWall`): veneer panels from u0 to u1 up to `h`, a dado rail and a
 * skirting; `gaps` = [u0, u1] stretches left bare (doors, screens). Panels stand 2.5 cm proud of the wall.
 */
export function wainscot(b: Builder, u0: number, u1: number, h: number, gaps: [number, number][] = [], panel: Mat = 'wood_veneer', rail: Mat = 'wood_dark') {
  const runs: [number, number][] = [];
  const gs = gaps.map((g) => [Math.min(g[0], g[1]), Math.max(g[0], g[1])] as [number, number]).sort((a, c) => a[0] - c[0]);
  // (the start is trimmed 4.5 cm: runs going round a room butt their start against the previous wall's panels)
  let u = Math.min(u0, u1) + 0.045;
  const end = Math.max(u0, u1);
  for (const [g0, g1] of gs) { if (g0 > u) runs.push([u, Math.min(g0, end)]); u = Math.max(u, g1); }
  if (u < end) runs.push([u, end]);
  for (const [a, c] of runs) {
    if (c - a < 0.05) continue;
    b.bx(panel, a, 0.12, 0.002, c, h, 0.022);
    b.bx(rail, a, h, 0.002, c, h + 0.05, 0.04);
    b.bx(rail, a, 0, 0.002, c, 0.12, 0.03);
    b.detail(() => {
      const n = Math.max(1, Math.round((c - a) / 0.9));
      for (let i = 0; i <= n; i++) { const x = a + (i * (c - a)) / n; b.bx(rail, Math.max(a, x - 0.015), 0.12, 0.022, Math.min(c, x + 0.015), h, 0.034); }
    });
  }
}

// ───────────────────────────────────────────────────────────── ceilings

/** Acoustic T-bar grid under a ceiling at `y` (strips 2.2 cm wide hanging 2 cm under it), pitch 0.6 (x) × 1.2 (z). */
export function ceilingGrid(b: Builder, L: LevelBuild, x0: number, x1: number, z0: number, z1: number, y: number, skip: [number, number, number, number][] = []) {
  const m = paint(L, 0xece6da, 0.5);
  const inSkip = (x: number, z: number) => skip.some((s) => x > s[0] && x < s[1] && z > s[2] && z < s[3]);
  b.detail(() => {
    for (let x = x0 + 0.6; x < x1 - 0.05; x += 0.6) b.bx(m, x - 0.011, y - 0.022, z0, x + 0.011, y - 0.004, z1);
    for (let z = z0 + 1.2; z < z1 - 0.05; z += 1.2) {
      let a = x0;
      for (let x = x0; x <= x1; x += 0.3) { const s = inSkip(x, z); if (s && x > a) { b.bx(m, a, y - 0.02, z - 0.011, x, y - 0.006, z + 0.011); } if (s) a = x + 0.3; }
      if (a < x1) b.bx(m, a, y - 0.02, z - 0.011, x1, y - 0.006, z + 0.011);
    }
  });
}
/** Recessed downlight (bezel + glowing disc) under a ceiling at y. */
export function downlight(b: Builder, glow: Mat, x: number, y: number, z: number, r = 0.08) {
  b.cyl('chrome', x, y - 0.006, z, r + 0.02, 0.012, 'y', 14);
  b.cyl(glow, x, y - 0.0135, z, r, 0.003, 'y', 14);
}
/** Pendant: cord from the ceiling, fabric drum (emissive underside). */
export function pendant(b: Builder, L: LevelBuild, glow: Mat, x: number, yCeil: number, z: number, drop: number, r: number, tint: number = TINT.cream) {
  b.rod('painted_dark', x, yCeil, z, x, yCeil - drop, z, 0.005, 4);
  b.cyl('brass', x, yCeil - 0.01, z, 0.06, 0.02, 'y', 10);
  b.cyl(fabric(L, tint), x, yCeil - drop - 0.14, z, r, 0.28, 'y', 20);
  b.cyl(glow, x, yCeil - drop - 0.281, z, r * 0.94, 0.004, 'y', 20);
}

// ───────────────────────────────────────────────────────────── doors

export interface CasingSpec { x: number; y?: number; z: number; wall: 'x' | 'z'; w?: number; h?: number; front?: string; back?: string; sides?: (1 | -1)[]; mats?: boolean }
/**
 * Wood casing over a std door's industrial frame (doors.ts buildFrame: jambs 0.3 wide, 0.12 proud of a 0.2 wall face,
 * hazard chevrons, bolts, lintel label): jambs + head of veneer 0.155 proud of the wall (the frame's status-panel
 * housing pokes 5 mm through, so the status light stays visible), a brass name plate with the door's label on the
 * head, and a doormat over the floor hazard bands. Nothing enters the clear opening or the leaf pockets.
 * Door frame: local +z side = `front` label (world +z for 'z' walls, world +x for 'x' walls).
 */
export function doorCasing(b: Builder, L: LevelBuild, s: CasingSpec, wood: Mat = 'wood_veneer') {
  const w = s.w ?? 1.6, h = s.h ?? 2.4, y = s.y ?? 0;
  const T = 0.19, F = 0.37, J = 0.345, I = 0.045; // back 1 cm inside the wall, front 2 cm proud of the frame's parts
  const px0 = w / 2 + 0.05, px1 = w / 2 + 0.29, py0 = 1.22, py1 = 1.58; // window round the frame's status housing
  const mat = fabric(L, TINT.charcoal);
  b.push(s.x, y, s.z, s.wall === 'z' ? 0 : PI / 2);
  for (const sd of s.sides ?? [1, -1]) {
    const z0 = sd * T, z1 = sd * F;
    const za = Math.min(z0, z1), zb = Math.max(z0, z1);
    for (const side of [-1, 1]) {
      const xa = side > 0 ? w / 2 - I : -(w / 2 + J), xb = side > 0 ? w / 2 + J : -(w / 2 - I);
      if (side !== sd) { b.bx(wood, xa, 0, za, xb, h + 0.36, zb); continue; }
      // the jamb carrying the status panel (right-hand as seen from this side): leave its housing in view
      const wa = side > 0 ? px0 : -px1, wb = side > 0 ? px1 : -px0;
      b.bx(wood, xa, 0, za, xb, py0, zb).bx(wood, xa, py1, za, xb, h + 0.36, zb);
      b.bx(wood, xa, py0, za, wa, py1, zb).bx(wood, wb, py0, za, xb, py1, zb);
    }
    b.bx(wood, -(w / 2 - I), h + 0.01, za, w / 2 - I, h + 0.36, zb);
    b.detail(() => {
      // architrave lip and plinth blocks
      for (const side of [-1, 1]) {
        b.bx('wood_dark', side * (w / 2 + J) - 0.015, 0, za - (sd > 0 ? 0 : 0.012), side * (w / 2 + J) + 0.015, h + 0.38, zb + (sd > 0 ? 0.012 : 0));
        b.bx('wood_dark', side > 0 ? w / 2 - I - 0.005 : -(w / 2 + J), 0, sd > 0 ? zb : za - 0.012, side > 0 ? w / 2 + J : -(w / 2 - I - 0.005), 0.16, sd > 0 ? zb + 0.012 : za);
      }
      b.bx('wood_dark', -(w / 2 + J) - 0.015, h + 0.36, za - (sd > 0 ? 0 : 0.012), w / 2 + J + 0.015, h + 0.4, zb + (sd > 0 ? 0.012 : 0));
      const label = sd > 0 ? s.front : s.back;
      if (label) {
        const lw = Math.min(w + 0.4, 0.075 * label.length + 0.3);
        const face: Face = sd > 0 ? '+z' : '-z';
        b.bx('brass', -lw / 2 - 0.02, h + 0.08, sd > 0 ? zb : za - 0.008, lw / 2 + 0.02, h + 0.28, sd > 0 ? zb + 0.008 : za);
        b.sign(label, 'wayfinding', 0, h + 0.18, sd > 0 ? zb + 0.008 : za - 0.008, lw, 0.16, face);
      }
    });
    // doormat over the frame's hazard bands (z 0.35 … 0.65 from the wall centre, 4 mm high)
    if (s.mats !== false) b.detail(() => b.bx(mat, -(w / 2 + 0.24), 0, sd > 0 ? 0.358 : -0.7, w / 2 + 0.24, 0.014, sd > 0 ? 0.7 : -0.358));
  }
  b.pop();
}

// ───────────────────────────────────────────────────────────── signs

/** Wall-mounted wayfinding plaque (brass-edged), centre (x,y,z) on a wall face `face`. */
export function wayfind(b: Builder, text: string, x: number, y: number, z: number, w: number, h: number, face: Face) {
  b.detail(() => b.sign(text, 'wayfinding', x, y, z, w, h, face, 0, true));
}
/** Free-standing double-faced totem (oak post + plaque each side), plaques facing ±z of the local frame at ry. */
export function totem(b: Builder, x: number, y: number, z: number, ry: number, front: string, back: string | null, w = 0.55, h = 1.0, collide = true) {
  b.push(x, y, z, ry);
  b.bx('wood_dark', -w / 2 - 0.04, 0, -0.05, w / 2 + 0.04, 0.06, 0.05);
  b.bx('wood_veneer', -w / 2 - 0.03, 0.06, -0.035, w / 2 + 0.03, 0.55 + h + 0.05, 0.035);
  b.detail(() => {
    b.sign(front, 'wayfinding', 0, 0.55 + h / 2, 0.035, w, h, '+z');
    if (back) b.sign(back, 'wayfinding', 0, 0.55 + h / 2, -0.035, w, h, '-z');
  });
  if (collide) b.collide(-w / 2 - 0.04, 0, -0.06, w / 2 + 0.04, 0.6 + h, 0.06, 'concrete', true);
  b.pop();
}
/** Sign hung from the ceiling on two rods, double-faced, plaque w × h centred at (x, y, z), faces ±z of ry. */
export function hangSign(b: Builder, text: string, x: number, y: number, z: number, ry: number, yCeil: number, w: number, h: number, back = text) {
  b.push(x, y, z, ry);
  b.detail(() => {
    for (const s of [-1, 1]) b.rod('brass', s * (w / 2 - 0.08), h / 2, 0, s * (w / 2 - 0.08), yCeil - y, 0, 0.005, 4);
    b.bx('wood_dark', -w / 2 - 0.02, -h / 2 - 0.02, -0.018, w / 2 + 0.02, h / 2 + 0.02, 0.018);
    b.sign(text, 'wayfinding', 0, 0, 0.018, w, h, '+z');
    b.sign(back, 'wayfinding', 0, 0, -0.018, w, h, '-z');
  });
  b.pop();
}

// ───────────────────────────────────────────────────────────── P3c additions (south half: canteen, clinic, quarters, BIO lock)

/** Café table w × d (top `h`) on two steel pedestals with flat feet; collider = the top's footprint to its height. */
export function cafeTable(b: Builder, w: number, d: number, top: Mat = 'wood_veneer', h = 0.74, collide = true) {
  b.bx(top, -w / 2, h - 0.03, -d / 2, w / 2, h, d / 2);
  b.detail(() => b.bx('wood_dark', -w / 2 - 0.004, h - 0.028, -d / 2 - 0.004, w / 2 + 0.004, h - 0.006, d / 2 + 0.004)); // edge band
  b.bx('painted_dark', -w / 2 + 0.12, h - 0.06, -0.04, w / 2 - 0.12, h - 0.03, 0.04);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.3);
    b.cyl('painted_dark', x, (h - 0.06) / 2 + 0.02, 0, 0.03, h - 0.1, 'y', 8);
    b.bx('painted_dark', x - 0.03, 0, -d / 2 + 0.08, x + 0.03, 0.03, d / 2 - 0.08);
  }
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'concrete', true);
}
/** Stacking chair (moulded ply shell on a chrome frame), seat 0.46, facing +z; optional seat pad. No collider. */
export function stackChair(b: Builder, shell: Mat, pad: Mat | null = null) {
  for (const sx of [-1, 1]) {
    b.rod('chrome', sx * 0.2, 0, 0.2, sx * 0.19, 0.44, 0.17, 0.011, 5);
    b.rod('chrome', sx * 0.2, 0, -0.2, sx * 0.19, 0.44, -0.17, 0.011, 5);
    b.rod('chrome', sx * 0.19, 0.44, -0.17, sx * 0.19, 0.44, 0.17, 0.011, 5);
  }
  b.rbox(shell, 0, 0.46, 0.0, 0.44, 0.022, 0.42, -0.04, 0, 0);
  b.rbox(shell, 0, 0.7, -0.215, 0.42, 0.3, 0.022, -0.16, 0, 0);
  for (const sx of [-1, 1]) b.rod('chrome', sx * 0.17, 0.44, -0.17, sx * 0.17, 0.62, -0.2, 0.009, 5);
  if (pad) b.rbox(pad, 0, 0.476, 0.01, 0.4, 0.012, 0.38, -0.04, 0, 0);
}
/**
 * Drinks vending machine 0.9 × 1.85 × 0.75, front +z: lit window of cans / bottles (`glow`, see vendingMat), coin
 * panel, delivery flap. Collider.
 */
export function vendingMachine(b: Builder, glow: Mat, body: Mat, collide = true) {
  const w = 0.9, h = 1.85, d = 0.75;
  b.bx(body, -w / 2, 0.06, -d / 2, w / 2, h, d / 2);
  b.bx('painted_dark', -w / 2 + 0.03, 0, -d / 2 + 0.03, w / 2 - 0.03, 0.06, d / 2 - 0.05);
  b.detail(() => {
    b.bx('plastic_dark', -w / 2 + 0.04, 0.5, d / 2, 0.18, h - 0.08, d / 2 + 0.012);
    b.quad(glow, (-w / 2 + 0.04 + 0.18) / 2, (0.5 + h - 0.08) / 2, d / 2 + 0.016, 0.18 + w / 2 - 0.08, h - 0.66, '+z');
    b.bx('plastic_dark', 0.22, 0.95, d / 2, 0.41, 1.45, d / 2 + 0.02);
    b.bx('chrome', 0.27, 1.32, d / 2 + 0.02, 0.36, 1.4, d / 2 + 0.026);
    for (let i = 0; i < 9; i++) b.box('plastic_white', 0.29 + (i % 3) * 0.025, 1.24 - Math.floor(i / 3) * 0.035, d / 2 + 0.023, 0.018, 0.022, 0.006);
    b.bx('plastic_dark', -w / 2 + 0.08, 0.14, d / 2, w / 2 - 0.08, 0.38, d / 2 + 0.02);
    b.bx('painted_dark', -w / 2 + 0.12, 0.18, d / 2 + 0.02, w / 2 - 0.12, 0.34, d / 2 + 0.024);
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2 + 0.02, 'metal', true);
}
/** The vending window: rows of drinks on a lit back (emissive canvas). */
export function vendingMat(L: LevelBuild, intensity = 0.9): THREE.MeshStandardMaterial {
  return canvasMat(L, 'vending_window', 256, 384, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f6efe0'); bg.addColorStop(1, '#d9cdb4');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const cols = ['#c0392b', '#2e6fa8', '#e2b65c', '#3f7a58', '#f2f2f2', '#7a4a5a', '#d26b2a'];
    for (let r = 0; r < 6; r++) {
      const y = 20 + r * 60;
      g.fillStyle = '#9a8f80'; g.fillRect(6, y + 46, W - 12, 4);
      for (let c = 0; c < 5; c++) {
        const x = 14 + c * 48, col = cols[(r * 3 + c * 2) % cols.length], tall = (r + c) % 3 === 0;
        if (r === 4 && c === 2) continue; // sold out
        g.fillStyle = col; g.fillRect(x, y + (tall ? 0 : 12), 30, tall ? 46 : 34);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 4, y + (tall ? 4 : 16), 5, tall ? 36 : 24);
      }
    }
  }, intensity);
}
/**
 * A curtain hanging from a ceiling rail along local x (x0 … x1), top `yTop`, length `drop`, in vertical zig-zag folds
 * (± depth, 8 mm cloth); `gather` 0 … 1 bunches it toward x0 (the rail still runs `railLen`). No collider.
 */
export function curtain(b: Builder, L: LevelBuild, x0: number, x1: number, yTop: number, drop: number, tint: number, gather = 0, railLen = x1 - x0) {
  const f = paint(L, tint, 0.92); // (cloth read as a flat matt paint: the fabric shader goes too dark on thin folds)
  b.rod('chrome', x0, yTop + 0.06, 0, x0 + railLen, yTop + 0.06, 0, 0.014, 6);
  const len = (x1 - x0) * (1 - gather * 0.8);
  const n = Math.max(4, 2 * Math.round(len / 0.22)), dz = 0.04 + gather * 0.05;
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step;
    const za = i % 2 ? dz : -dz, zc = i % 2 ? -dz : dz;
    const ang = Math.atan2(zc - za, step), lenP = Math.hypot(step, zc - za);
    b.push(a + step / 2, yTop - drop / 2, (za + zc) / 2, -ang);
    b.bx(f, -lenP / 2, -drop / 2, -0.004, lenP / 2, drop / 2, 0.004);
    b.pop();
  }
  b.detail(() => { for (let i = 0; i <= n; i += 2) b.cyl('chrome', x0 + i * step, yTop + 0.03, 0, 0.012, 0.05, 'y', 6); });
}
/** Examination couch 1.9 (local x, head end +x raised) × 0.68, pad top 0.72, paper roll at the foot; collider. */
export function examCouch(b: Builder, L: LevelBuild, tint = 0x5a7a86, collide = true) {
  const pad = paint(L, tint, 0.55), white = paint(L, 0xece8df, 0.5), len = 1.9, wd = 0.68, h = 0.72;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('chrome', sx * (len / 2 - 0.1), 0.3, sz * (wd / 2 - 0.08), 0.022, 0.6, 'y', 8);
  b.bx(white, -len / 2 + 0.05, 0.6, -wd / 2 + 0.04, len / 2 - 0.05, h - 0.1, wd / 2 - 0.04);
  b.bx(white, -len / 2 + 0.1, 0.12, -wd / 2 + 0.06, len / 2 - 0.1, 0.16, wd / 2 - 0.06);
  b.bx(pad, -len / 2, h - 0.1, -wd / 2, len / 2 - 0.55, h, wd / 2);
  b.rbox(pad, len / 2 - 0.3, h + 0.04, 0, 0.56, 0.1, wd, 0, 0, 0.3);
  b.detail(() => {
    const p = paper(L, 0xf4f2ec);
    b.bx(p, -len / 2 + 0.05, h, -wd / 2 + 0.12, len / 2 - 0.62, h + 0.003, wd / 2 - 0.12);
    b.cyl(p, -len / 2 - 0.06, h - 0.04, 0, 0.06, wd - 0.16, 'z', 12);
    for (const s of [-1, 1]) b.rod('chrome', -len / 2 - 0.06, h - 0.04, s * (wd / 2 - 0.05), -len / 2, h - 0.04, s * (wd / 2 - 0.05), 0.008, 5);
  });
  if (collide) b.collide(-len / 2 - 0.12, 0, -wd / 2, len / 2, h + 0.1, wd / 2, 'rubber', true);
}
/** Snellen eye chart (canvas). */
export function eyeChartMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return canvasMat(L, 'eye_chart', 256, 400, (g, W) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, W, 400);
    g.fillStyle = '#111'; g.textAlign = 'center';
    const rows = ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D', 'E D F C Z P', 'F E L O P Z D', 'D E F P O T E C'];
    let y = 70;
    rows.forEach((r, i) => { const s = Math.max(9, 72 - i * 9); g.font = `700 ${s}px Arial`; g.fillText(r, W / 2, y); y += s + 12; });
    g.strokeStyle = '#a12a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, y - 8); g.lineTo(W - 20, y - 8); g.stroke();
  });
}
/** Wall-hung medicine cabinet w × h, 0.22 deep (back on local z = 0, face +z), glass doors with a lock; bottles inside. */
export function medCabinet(b: Builder, L: LevelBuild, w: number, h: number, R: Rng) {
  const d = 0.22, white = paint(L, 0xece8df, 0.5);
  b.bx(white, -w / 2, 0, 0, w / 2, h, 0.012);
  b.bx(white, -w / 2, 0, 0.012, -w / 2 + 0.02, h, d).bx(white, w / 2 - 0.02, 0, 0.012, w / 2, h, d);
  b.bx(white, -w / 2 + 0.02, 0, 0.012, w / 2 - 0.02, 0.02, d).bx(white, -w / 2 + 0.02, h - 0.02, 0.012, w / 2 - 0.02, h, d);
  const shelves = Math.max(2, Math.round(h / 0.32));
  for (let i = 1; i < shelves; i++) b.bx(white, -w / 2 + 0.02, (i * h) / shelves - 0.006, 0.012, w / 2 - 0.02, (i * h) / shelves + 0.006, d - 0.025);
  b.detail(() => {
    const cols = [0xf2efe6, 0x8a5a2a, 0xd8e2e8, 0x3f5a78, 0xc0392b];
    for (let i = 0; i < shelves; i++) {
      const y = i === 0 ? 0.02 : (i * h) / shelves + 0.006;
      for (let x = -w / 2 + 0.06; x < w / 2 - 0.06; x += R.range(0.06, 0.1)) {
        if (R.chance(0.2)) continue;
        const r = R.range(0.018, 0.03), hh = R.range(0.06, Math.min(0.15, h / shelves - 0.05));
        if (R.chance(0.4)) b.box(paint(L, R.pick([0xf2efe6, 0xd9e6ef, 0xefe1c7]), 0.7), x, y + hh / 2, 0.1, r * 2.2, hh, r * 3);
        else { b.cyl(paint(L, R.pick(cols), 0.3), x, y + hh / 2, 0.1, r, hh, 'y', 8); b.cyl('plastic_white', x, y + hh + 0.01, 0.1, r * 0.7, 0.02, 'y', 8); }
      }
    }
  });
  // glass doors meeting at the middle, a chrome meeting strip, the brass lock
  b.bx(glassFront(L), -w / 2 + 0.02, 0.02, d - 0.012, w / 2 - 0.02, h - 0.02, d - 0.004);
  b.bx('chrome', -0.008, 0.02, d - 0.003, 0.008, h - 0.02, d + 0.004);
  b.cyl('brass', 0.03, h / 2, d + 0.006, 0.012, 0.012, 'z', 8);
}
/** Wall sconce (back plate on local z = 0, face +z): brass arm, fabric drum glowing at both openings (`glow`). */
export function wallSconce(b: Builder, L: LevelBuild, glow: Mat, tint: number = TINT.cream) {
  b.cyl('brass', 0, 0, 0.008, 0.05, 0.016, 'z', 12);
  b.rod('brass', 0, 0, 0.016, 0, 0.04, 0.1, 0.008, 6);
  b.cyl(fabric(L, tint), 0, 0.1, 0.13, 0.1, 0.16, 'y', 14, 0.08);
  b.cyl(glow, 0, 0.018, 0.13, 0.094, 0.004, 'y', 14);
  b.cyl(glow, 0, 0.182, 0.13, 0.074, 0.004, 'y', 14);
}
/** A pair of shoes on the floor, toes +z (kind 0 shoes, 1 boots, 2 trainers, 3 child's wellies). */
export function shoes(b: Builder, L: LevelBuild, kind: number, color: number) {
  const m = paint(L, color, kind === 2 ? 0.7 : 0.45);
  const s = kind === 3 ? 0.62 : 1;
  for (const sx of [-1, 1]) {
    const x = sx * 0.07 * s;
    b.rbox('rubber', x, 0.012 * s, 0, 0.09 * s, 0.024 * s, 0.27 * s, 0, 0, 0);
    b.rbox(m, x, 0.054 * s, 0.03 * s, 0.085 * s, 0.06 * s, 0.2 * s, 0.12, 0, 0);
    const shaft = kind === 1 ? 0.22 : kind === 3 ? 0.3 : 0.06;
    b.rbox(m, x, (0.05 + shaft / 2) * s, -0.07 * s, 0.084 * s, shaft * s, 0.1 * s, 0, 0, 0);
    if (kind === 2) b.rbox('plastic_white', x, 0.04, 0.1, 0.087, 0.012, 0.06, 0.2, 0, 0);
  }
}
/** Pram (carrycot with a hood on a chrome chassis), handle toward local −x. No collider by default. */
export function pram(b: Builder, L: LevelBuild, tint: number, collide = false) {
  const f = fabric(L, tint);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.torus('rubber', sx * 0.32, 0.13, sz * 0.25, 0.12, 0.022, 'z', 16);
    b.cyl('chrome', sx * 0.32, 0.13, sz * 0.25, 0.02, 0.04, 'z', 6);
  }
  for (const sz of [-1, 1]) {
    b.rod('chrome', -0.32, 0.13, sz * 0.25, 0.05, 0.5, sz * 0.22, 0.012, 5);
    b.rod('chrome', 0.32, 0.13, sz * 0.25, -0.05, 0.5, sz * 0.22, 0.012, 5);
    b.rod('chrome', -0.05, 0.5, sz * 0.22, -0.48, 1.0, sz * 0.2, 0.012, 5);
  }
  b.rod('plastic_dark', -0.48, 1.0, -0.22, -0.48, 1.0, 0.22, 0.02, 6);
  b.rbox(f, 0.02, 0.63, 0, 0.72, 0.26, 0.42, 0, 0, 0.04);
  b.sphere(f, 0.22, 0.78, 0, 0.21, 12, 0.7, 0.75, 1.0);
  b.detail(() => b.rbox(fabric(L, TINT.cream), -0.08, 0.77, 0, 0.4, 0.02, 0.36, 0, 0, 0.03));
  if (collide) b.collide(-0.5, 0, -0.3, 0.45, 1.0, 0.3, 'rubber', true);
}
/** Child's kick scooter lying against a wall, along local x. */
export function kidScooter(b: Builder, L: LevelBuild, color: number) {
  const m = paint(L, color, 0.35);
  for (const x of [-0.3, 0.3]) b.torus('rubber', x, 0.07, 0, 0.06, 0.015, 'z', 14);
  b.bx(m, -0.3, 0.08, -0.06, 0.24, 0.11, 0.06);
  b.rod(m, 0.3, 0.07, 0, 0.25, 0.72, 0, 0.016, 6);
  b.rod('plastic_dark', 0.25, 0.72, -0.18, 0.25, 0.72, 0.18, 0.016, 6);
}
/** Folding clothes airer (A-frame, 0.9 high) along local x with a few things drying. No collider. */
export function dryingRack(b: Builder, L: LevelBuild, R: Rng, len = 1.1) {
  for (const sx of [-1, 1]) { b.rod('plastic_white', sx * len / 2, 0, -0.3, sx * len / 2, 0.9, 0.0, 0.01, 5); b.rod('plastic_white', sx * len / 2, 0, 0.3, sx * len / 2, 0.9, 0.0, 0.01, 5); }
  const yAt = (z: number) => 0.9 * (1 - Math.abs(z) / 0.3);
  for (const z of [-0.24, -0.15, -0.06, 0.06, 0.15, 0.24]) b.rod('plastic_white', -len / 2, yAt(z), z, len / 2, yAt(z), z, 0.005, 4);
  const cols = [TINT.slate, TINT.cream, TINT.rust, 0xf2efe6, TINT.sage, TINT.mustard];
  b.detail(() => {
    for (let i = 0; i < 5; i++) {
      const x = -len / 2 + 0.15 + (i * (len - 0.3)) / 4, z = i % 2 ? 0.15 : -0.15, y = yAt(z);
      const hw = R.range(0.16, 0.26);
      b.rbox(fabric(L, R.pick(cols)), x, y - 0.13, z + (z > 0 ? 0.008 : -0.008), hw, 0.26, 0.006, 0, 0, 0);
    }
  });
}
/** Wall clock (back on local z = 0, face +z), hands at hh:mm. */
export function wallClock(b: Builder, L: LevelBuild, r = 0.16, hh = 10, mm = 40) {
  b.cyl('wood_dark', 0, 0, 0.02, r + 0.015, 0.04, 'z', 24);
  b.cyl(paint(L, 0xf4efe2, 0.4), 0, 0, 0.0415, r, 0.003, 'z', 24);
  b.detail(() => {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.rbox('painted_dark', Math.sin(a) * r * 0.85, Math.cos(a) * r * 0.85, 0.0445, 0.008, i % 3 ? 0.02 : 0.035, 0.002, 0, 0, -a); }
    const ah = (((hh % 12) + mm / 60) / 12) * PI * 2, am = (mm / 60) * PI * 2;
    b.rbox('painted_dark', Math.sin(ah) * r * 0.25, Math.cos(ah) * r * 0.25, 0.048, 0.012, r * 0.5, 0.002, 0, 0, -ah);
    b.rbox('painted_dark', Math.sin(am) * r * 0.36, Math.cos(am) * r * 0.36, 0.051, 0.008, r * 0.72, 0.002, 0, 0, -am);
  });
}
/** Decon spray nozzle on a stub (base on local z = 0, sprays +z). */
export function nozzle(b: Builder, len = 0.08) {
  b.cyl('chrome', 0, 0, len / 2, 0.018, len, 'z', 8);
  b.cyl('steel_raw', 0, 0, len + 0.012, 0.03, 0.024, 'z', 10, 0.022);
  b.cyl('painted_dark', 0, 0, len + 0.0245, 0.016, 0.002, 'z', 8);
}
/** A child's crayon drawing (canvas): a big blue whale under a sun, "for dad". */
export function childDrawingMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return canvasMat(L, 'child_whale', 256, 192, (g, W, H) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#3a7bc8'; g.lineWidth = 4;
    for (let y = 132; y < H; y += 16) { g.beginPath(); for (let x = 6; x < W; x += 12) g.lineTo(x, y + Math.sin(x * 0.15 + y) * 4); g.stroke(); }
    g.fillStyle = '#2f5fa8'; g.beginPath(); g.ellipse(120, 112, 72, 34, -0.08, 0, PI * 2); g.fill();
    g.beginPath(); g.moveTo(186, 106); g.lineTo(228, 80); g.lineTo(220, 114); g.lineTo(236, 134); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(78, 102, 6, 0, PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(79, 103, 3, 0, PI * 2); g.fill();
    g.strokeStyle = '#7fb4e8'; g.lineWidth = 3;
    for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(100, 78); g.lineTo(100 + dx, 54); g.stroke(); }
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(214, 34, 18, 0, PI * 2); g.fill();
    g.strokeStyle = '#f2c230';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; g.beginPath(); g.moveTo(214 + Math.cos(a) * 24, 34 + Math.sin(a) * 24); g.lineTo(214 + Math.cos(a) * 32, 34 + Math.sin(a) * 32); g.stroke(); }
    g.fillStyle = '#c0392b'; g.font = '700 26px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('아빠에게', 18, 40);
    g.fillStyle = '#3a8a3a'; g.font = '700 16px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('미아가', 22, 62);
  });
}
