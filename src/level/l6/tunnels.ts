/**
 * LEVEL 6 — dressing + lights of lock6, tun6_a, rep6 (the jointer's tent, the drums), bay6 and tun6_b (dark); vignettes
 * `v6_tent`, `tun6_far_out` (stage 3d §2.6.1–2.6.5, §2.7, §5.7 #2; task D1).
 *
 * Contract (`RoomDress`, l6/index.ts): per room `build(L)` (after the room's greybox shell, inside its build pass),
 * `lights: []` (every light of these rooms is made HERE through `placeLights6` — the handles are needed to bind the
 * fittings' lenses; the §2.7.1 group names are kept: `lock6`, `tun6_a`, `tun6_a_far`, `tun6_a_emerg`, `rep6`, `bay6`,
 * `tun6_b`), `look`, `label: false` (the shell's signs are skipped: every stencil the shell drew is redrawn here).
 * The shell keeps every collider, door, trigger, screen, interactable and marker; this file hides the stand-in visuals
 * (`restyle`) and dresses them with W8's kit (kit6.ts) — the kit props go over the shell's colliders with
 * `collide: false`. Colliders added here: the dewatering pipe's kerb (tun6_a, y ≤ 0.28), the wall shelves (lock6,
 * rep6, bay6), the first-aid box, the spare coil in bay6, the jointer's body + stool in the tent.
 *
 *  lock6   3c `tunnel5` look (navy plate, deck non-slip): trays both walls, the trunk on the west tray into the
 *          cable transit beside `d6_tube`, the tray-end shelf under `p6_lock_ammo`, the ceiling fitting.
 *  tun6_a  shotcrete, the centre-line drain, rings every 16 m (W8 `tunnelRing` over the shell's jambs), trays west
 *          2.0 / 2.6 / 3.2 and east 2.0 / 2.6, the trunk on the east tray (crossing overhead from the transit), JB1–4,
 *          DT1–2, caged fittings every 8 m (lenses bound: the far three to `tun6_a_far`), red emergency fittings at
 *          z −60 / −76, hard-wired emergency floor strips on both wall bases (the far half's guide after
 *          `tun6_far_out`), the dewatering pipe, chainage stencils.
 *  rep6    the bend: haunched vault + lattice ribs, RB, DS1 / DS2, LC1 / LC2, the trunk along the north and east walls
 *          into tunnel B, an overhead tray to the repeater bank, the jointer's tent (W8 `jointerTent`) with its hanging
 *          work lamp (the tent light follows it), a door flap, the splicing bench and **J. Rød** (Halcyon Subsea,
 *          orange coverall) seated, slumped over his work, face down; the job card on the front pole; the equipment
 *          shelf, the first-aid box, the ceiling vent's grille, a spare coil.
 *  tun6_b  as tun6_a with the mains dead (dark lenses, one fitting hanging by its cable at z −118), four red caged
 *          emergency fittings (z −100 / −116 / −132 / −148), continuous green-amber floor strips both sides (detouring
 *          round RH1–3 and the bay door), lit egress signs between the red pools, LED status panels on the housings,
 *          RH1–3 (W8 `repeaterHousing`), the trunk over `d6_bay`'s lintel and into the head-end's transit, the sentry
 *          dock.
 *  bay6    the joint box on trestles, the spare coil, the shelf under `p6_bay_plate` / `p6_bay_ammo`, the fitting.
 *
 * Vignettes (each with its `:snap`): `v6_tent` (§5.7 #2: the flap lifts and falls back, the work lamp swings on its hook
 * and its light swings with it over the boots under the bench; `tarp_flap`, `lamp_creak`; snap = flap down, lamp
 * still), `tun6_far_out` (§4.2: the far mains stutter and die, the red emergency points come on, `dark` gains
 * z < −52; `lights_out_dock`; snap = the end state).
 *
 * The two contractor bodies (§6.3 note): **J. Rød** is in this file (the tent, rep6). **M. Lie** lies in the trench at
 * the T-a / T-b corner — vault6's floors, task D2's file (`vault.ts`); `jointerBody(…, { pose: 'lying' })` below is
 * exported for D2 to reuse.
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { restyle, isStandin } from '../l3/kit3';
import { mat4 } from '../l4/kit4';
import { hose } from '../kit';
import { curtainGeo } from '../props';
import { box3, placeLights6, type LightRow6, type RoomId6 } from './grey';
import type { RoomDress } from './index';
import {
  cableDrum, cableTrays, crate6, drumTrolley, firstAidBox6, jointBox, jointerTent, junctionBox, lampLens6, ledMat6,
  repeaterBank, repeaterHousing, spareCoil, stencil6, strip6, tint6, tmat6, trunkRun, tunnelFitting, tunnelRing,
  wallShelf6, dewaterPipe,
} from './kit6';

const PI = Math.PI, TAU = 2 * PI;
type Box6 = [number, number, number, number, number, number];
type P3 = [number, number, number];

const WARM = 0xffe2c0, COOL = 0xdce8ff, RED = 0xff2a18;

// ───────────────────────────────────────────────────────────── helpers

/** Deterministic RNG (mulberry32). */
function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };

/** Hide the greybox visuals of a shell builder by material (colliders stay: they are not in the batches). */
function hide(L: LevelBuild, builder: string, names: string[], standin = true) {
  restyle(L, builder, (m) => (standin && isStandin(m)) || names.includes(m.name), null);
}

/** A moving part: `mount` at (x, y, z) (tagged with `rooms`), `pivot` its child that moves; geometry relative to the pivot. */
interface Part { mount: THREE.Group; pivot: THREE.Group }
function part(L: LevelBuild, name: string, rooms: string[], x: number, y: number, z: number, make: (p: Builder) => void): Part {
  const p = L.part(name);
  make(p);
  const g = p.build();
  const mount = new THREE.Group();
  mount.name = name;
  mount.position.set(x, y, z);
  mount.userData.rooms = rooms.slice();
  const pivot = new THREE.Group();
  pivot.name = `${name}:pivot`;
  pivot.add(g);
  mount.add(pivot);
  L.root.add(mount);
  return { mount, pivot };
}

/**
 * Floor strip along a wall base at `x` from z0 down to z1 (z0 > z1), detouring round obstacles standing against that
 * wall: each [zHi, zLo, xFace] makes the strip step out to `xFace` (0.08 m in front of the obstacle's face) and back.
 * Segment ends are kept 3.5 cm short of each corner (no two lenses overlap: no z-fight).
 */
function stripRun(b: Builder, L: LevelBuild, x: number, z0: number, z1: number, obs: [number, number, number][]) {
  const pts: [number, number][] = [[x, z0]];
  for (const [zHi, zLo, xf] of obs.slice().sort((p, q) => q[0] - p[0])) pts.push([x, zHi + 0.12], [xf, zHi + 0.12], [xf, zLo - 0.12], [x, zLo - 0.12]);
  pts.push([x, z1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.1) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len, s = i === 0 ? 0 : 0.035, e = i === pts.length - 2 ? 0 : 0.035;
    strip6(b, L, ax + ux * s, az + uz * s, bx - ux * e, bz - uz * e, { ch: 'emerg', channel: 'steel_raw' });
  }
}

/** A multi-cable transit (MCT) frame in a wall: steel frame, rubber packing blocks, compression plate. Centre on the
 * wall face, `face` = its normal; w × h. */
function transit(b: Builder, x: number, y: number, z: number, w: number, h: number, face: '+z' | '-z') {
  b.push(x, y, z, face === '+z' ? 0 : PI);
  b.bx('navy_grey', -w / 2, -h / 2, 0, w / 2, h / 2, 0.06);
  b.bx('rubber', -w / 2 + 0.05, -h / 2 + 0.05, 0.06, w / 2 - 0.05, h / 2 - 0.05, 0.075);
  b.detail(() => {
    const nx = Math.max(2, Math.round((w - 0.1) / 0.1)), ny = Math.max(2, Math.round((h - 0.1) / 0.1));
    for (let i = 1; i < nx; i++) { const u = -w / 2 + 0.05 + (i * (w - 0.1)) / nx; b.bx('navy_grey', u - 0.004, -h / 2 + 0.05, 0.075, u + 0.004, h / 2 - 0.05, 0.08); }
    for (let j = 1; j < ny; j++) { const v = -h / 2 + 0.05 + (j * (h - 0.1)) / ny; b.bx('navy_grey', -w / 2 + 0.05, v - 0.004, 0.075, w / 2 - 0.05, v + 0.004, 0.08); }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.cyl('steel_raw', sx * (w / 2 - 0.025), sy * (h / 2 - 0.025), 0.065, 0.012, 0.012, 'z', 6);
  });
  b.pop();
}

/** The egress signs' texture: two rows (0 = `HEAD-END →`, 1 = `← HEAD-END`), one material for every sign. */
const EGRESS = ['헤드엔드  →', '←  HEAD-END', '조인트 베이 2', '트렁크 헤드엔드'];
function egressMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd1_egress', () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80 * EGRESS.length;
    const g = c.getContext('2d')!;
    EGRESS.forEach((text, i) => {
      const y0 = i * 80;
      g.fillStyle = '#0f8a3a'; g.fillRect(0, y0, 256, 80);
      g.strokeStyle = '#e8f6ea'; g.lineWidth = 4; g.strokeRect(5, y0 + 5, 246, 70);
      g.fillStyle = '#f4fff4';
      g.font = 'bold 34px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, y0 + 42);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = L.ctx.materials.clone('plastic_white', { map: t, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, color: 0xffffff, roughness: 0.35, metalness: 0 });
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = t;
    m.emissiveIntensity = 0.8;
    m.name = 'd1_egress';
    return m;
  });
}
const egressGeo: THREE.PlaneGeometry[] = [];
/** A lit egress sign (green, white lettering), emissive only: a plate on the wall at (x, y, z) facing `face`. */
function egressSign(b: Builder, L: LevelBuild, row: 0 | 1 | 2 | 3, x: number, y: number, z: number, face: '+x' | '-x' | '+z') {
  if (!egressGeo[row]) {
    const g = new THREE.PlaneGeometry(0.6, 0.19);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // canvas row 0 is the TOP band (flipY): row r spans v 1 − (r + 1) / n … 1 − r / n
    const n = EGRESS.length;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + 1) / n + uv.getY(i) / n);
    egressGeo[row] = g;
  }
  const ry = face === '+x' ? PI / 2 : face === '-x' ? -PI / 2 : 0;
  b.at(x, y, z, ry, () => {
    b.bx('painted_dark', -0.33, -0.12, 0, 0.33, 0.12, 0.03);
    b.geo(egressMat(L), egressGeo[row], 'keep', new THREE.Matrix4().makeTranslation(0, 0, 0.032));
  });
}

// ───────────────────────────────────────────────────────────── the jointer (copied from kit5's navyBody construction)

/** One ring of a `drapeGeo` tube (kit5, copied — rule 9). */
interface DRing { c: [number, number, number]; rx: number; rz: number; fold?: number; nf?: number; ph?: number }
/** Soft cloth tube through rings (kit5 `drapeGeo`, copied — rule 9). */
function drapeGeo(rings: DRing[], seg: number, seed: number, cap: { top?: number; bottom?: number } = {}): THREE.BufferGeometry {
  const R = srand(seed), pos: number[] = [], idx: number[] = [];
  const jit = rings.map(() => Array.from({ length: seg }, () => (R() - 0.5) * 0.3));
  const ringPts = (shrink: number) => rings.map((r, i) => {
    const out: [number, number, number][] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * 2 * PI, f = r.fold ?? 0, nf = r.nf ?? 9, ph = r.ph ?? 0;
      const d = f * (0.62 * Math.sin(nf * a + ph) + 0.38 * Math.sin(2.2 * nf * a + ph * 1.7 + 0.5) + jit[i][j]);
      out.push([r.c[0] + Math.cos(a) * (r.rx + d - shrink), r.c[1], r.c[2] + Math.sin(a) * (r.rz + d * 0.8 - shrink)]);
    }
    return out;
  });
  const layer = (pts: [number, number, number][][], flip: boolean) => {
    const base = pos.length / 3;
    for (const ring of pts) for (const v of ring) pos.push(...v);
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const capAt = (i: number, dy: number, down: boolean) => {
      const r = rings[i], ci = pos.length / 3;
      pos.push(r.c[0], r.c[1] + dy, r.c[2]);
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg);
        if (down !== flip) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    if (!flip && cap.top !== undefined) capAt(0, cap.top, false);
    if (!flip && cap.bottom !== undefined) capAt(pts.length - 1, -cap.bottom, true);
  };
  layer(ringPts(0), false);
  if (cap.top === undefined || cap.bottom === undefined) layer(ringPts(0.006), true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Frame for a tube from A down to B (local −y → B − A), local x as close to `side` as possible (kit5, copied). */
function tubeFrame(A: P3, B: P3, side: P3 = [1, 0, 0]): THREE.Matrix4 {
  const y = new THREE.Vector3(A[0] - B[0], A[1] - B[1], A[2] - B[2]).normalize();
  const x = new THREE.Vector3(...side).addScaledVector(y, -new THREE.Vector3(...side).dot(y));
  if (x.lengthSq() < 1e-6) x.set(0, 0, 1).addScaledVector(y, -y.z);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(A[0], A[1], A[2]);
}
/** A cloth / flesh tube from A to B with bunching and creases (kit5 `limb`, copied). */
function limb(b: Builder, M: Mat, A: P3, B: P3, ra: number, rb: number, o: { seed: number; bunch?: number; flat?: number; side?: P3; ends?: boolean; seg?: number }) {
  const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), bunch = o.bunch ?? 0, flat = o.flat ?? 1, R = srand(o.seed);
  const rings: DRing[] = [];
  const ends = o.ends !== false;
  if (ends) for (const [k, s] of [[0.85, 0.35], [0.5, 0.72]] as const) rings.push({ c: [0, ra * k, 0], rx: ra * s, rz: ra * s * flat });
  const n = Math.max(3, Math.round(len / 0.03)), ph = R() * 6.28, fr = (2 * PI) / (0.07 + R() * 0.03);
  for (let i = 0; i <= n; i++) {
    const k = i / n, y = -k * len;
    const r = (ra + (rb - ra) * k) * (1 + bunch * 0.07 * Math.sin(-y * fr + ph) * (0.6 + 0.4 * Math.sin(k * 7 + ph)));
    rings.push({ c: [0, y, 0], rx: r, rz: r * flat, fold: bunch * r * 0.09, nf: 4 + (i % 3), ph: ph + k * 2.4 });
  }
  if (ends) for (const [k, s] of [[0.5, 0.72], [0.85, 0.35]] as const) rings.push({ c: [0, -len - rb * k, 0], rx: rb * s, rz: rb * s * flat });
  b.geo(M, drapeGeo(rings, o.seg ?? 14, o.seed, ends ? { top: ra * 0.1, bottom: rb * 0.1 } : {}), 'box', tubeFrame(A, B, o.side));
}
/** A dead hand: palm + four curled fingers + thumb from the wrist W toward `dir`, palm facing `palm` (kit5, copied). */
function deadHand(b: Builder, M: Mat, W: P3, dir: P3, palm: P3, curl: number, seed: number) {
  const d = new THREE.Vector3(...dir).normalize(), pn = new THREE.Vector3(...palm).normalize();
  const sd = new THREE.Vector3().crossVectors(d, pn).normalize();
  const at = (u: number, v: number, w: number): P3 => { const p = new THREE.Vector3(...W).addScaledVector(d, u).addScaledVector(sd, v).addScaledVector(pn, w); return [p.x, p.y, p.z]; };
  limb(b, M, at(-0.005, 0, 0), at(0.085, 0, 0.002), 0.03, 0.036, { seed, flat: 0.45, side: [sd.x, sd.y, sd.z], seg: 10 });
  const R = srand(seed);
  for (let i = 0; i < 4; i++) {
    const v = -0.03 + i * 0.02, l1 = 0.042 - Math.abs(i - 1.3) * 0.005, c = curl * (0.7 + R() * 0.6);
    const k1 = at(0.09, v, 0.004), k2 = at(0.09 + l1 * Math.cos(c * 0.6), v, 0.004 + l1 * Math.sin(c * 0.6));
    const k3 = at(0.09 + l1 * Math.cos(c * 0.6) + 0.03 * Math.cos(c * 1.4), v, 0.004 + l1 * Math.sin(c * 0.6) + 0.03 * Math.sin(c * 1.4));
    limb(b, M, k1, k2, 0.0095, 0.009, { seed: seed + i, seg: 6 });
    limb(b, M, k2, k3, 0.009, 0.0075, { seed: seed + i + 9, seg: 6 });
  }
  limb(b, M, at(0.02, 0.038, 0.004), at(0.065, 0.052, 0.02 + 0.02 * curl), 0.012, 0.009, { seed: seed + 20, seg: 6 });
}
function jointerMats(L: LevelBuild) {
  return {
    cloth: tmat6(L, 'coverall_orange') as Mat,
    band: 'plastic_white' as Mat,
    boot: 'rubber' as Mat,
    skin: tint6(L, 'd1_skin', 'painted_white', 0x9c8b80, { roughness: 0.72, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null }) as Mat,
    hair: 'painted_dark' as Mat,
  };
}
/** A point `k` (0 … 1) of the way from A to B. */
const along = (A: P3, B: P3, k: number): P3 => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];

/**
 * A Halcyon Subsea cable jointer (§6.3: contractors in orange coveralls, not on the navy roster), dead at his work.
 * `pose 'seated'` (J. Rød, the tent): origin on the floor under a stool's centre, facing −z — slumped forward over a
 * bench whose top is at 0.85 and whose near edge is 0.35 m in front (−z), head down between his forearms, the forearms
 * flat on the bench, the boots under it; `'lying'` (for D2's M. Lie in the trench): face down along local z, head −z.
 * One-piece coverall (tubes with creases), silver reflective bands round the shins and across the back, a hood-less
 * collar, work boots, skin only at the hands and the nape. Calls: 5 (coverall, band, boot, skin, hair).
 * Collider: none (the caller adds what it needs).
 */
export function jointerBody(b: Builder, L: LevelBuild, o: { pose?: 'seated' | 'lying'; seed?: number } = {}) {
  const M = jointerMats(L), seed = o.seed ?? 6101;
  const lying = o.pose === 'lying';
  const J = lying ? {
    sh: [0, 0.12, -0.52] as P3, chest: [0, 0.125, -0.32] as P3, waist: [0.004, 0.115, -0.1] as P3, hip: [0, 0.115, 0.06] as P3,
    neck: [0.012, 0.1, -0.64] as P3, head: [0.035, 0.1, -0.78] as P3,
    shL: [0.2, 0.115, -0.52] as P3, elL: [0.36, 0.075, -0.3] as P3, wrL: [0.33, 0.045, -0.05] as P3,
    shR: [-0.2, 0.115, -0.52] as P3, elR: [-0.34, 0.07, -0.78] as P3, wrR: [-0.3, 0.045, -1.04] as P3,
    hiL: [0.095, 0.1, 0.1] as P3, knL: [0.16, 0.075, 0.52] as P3, anL: [0.2, 0.078, 0.94] as P3,
    hiR: [-0.095, 0.1, 0.1] as P3, knR: [-0.12, 0.074, 0.53] as P3, anR: [-0.1, 0.082, 0.95] as P3,
  } : {
    sh: [0, 1.06, -0.4] as P3, chest: [0, 0.98, -0.24] as P3, waist: [0, 0.8, -0.07] as P3, hip: [0, 0.67, 0.03] as P3,
    neck: [0.01, 1.0, -0.55] as P3, head: [0.03, 0.955, -0.66] as P3,
    shL: [0.2, 1.04, -0.42] as P3, elL: [0.3, 0.905, -0.62] as P3, wrL: [0.13, 0.905, -0.86] as P3,
    shR: [-0.2, 1.04, -0.42] as P3, elR: [-0.29, 0.905, -0.63] as P3, wrR: [-0.11, 0.905, -0.87] as P3,
    hiL: [0.1, 0.67, 0.0] as P3, knL: [0.13, 0.58, -0.42] as P3, anL: [0.15, 0.11, -0.47] as P3,
    hiR: [-0.1, 0.67, 0.0] as P3, knR: [-0.14, 0.58, -0.41] as P3, anR: [-0.15, 0.11, -0.45] as P3,
  };
  // torso: the coverall's back (bunched across the shoulders where he slumped), the waist, the seat
  limb(b, M.cloth, J.sh, J.chest, 0.205, 0.188, { seed: seed + 1, bunch: 1.3, flat: 0.56, side: [1, 0, 0], seg: 24 });
  limb(b, M.cloth, J.chest, J.waist, 0.188, 0.168, { seed: seed + 2, bunch: 0.9, flat: 0.6, side: [1, 0, 0], seg: 24, ends: false });
  limb(b, M.cloth, J.waist, J.hip, 0.168, 0.182, { seed: seed + 3, bunch: 0.6, flat: 0.68, side: [1, 0, 0], seg: 24 });
  // the reflective band across the back (a broad hoop round the chest) and the belt line
  limb(b, M.band, along(J.chest, J.waist, 0.12), along(J.chest, J.waist, 0.3), 0.192, 0.186, { seed: seed + 4, flat: 0.6, side: [1, 0, 0], seg: 24, ends: false });
  limb(b, M.cloth, along(J.waist, J.hip, 0.2), along(J.waist, J.hip, 0.32), 0.176, 0.177, { seed: seed + 5, bunch: 0.2, flat: 0.68, side: [1, 0, 0], seg: 24, ends: false });
  // collar, neck, head (the nape and the back of the skull; the face is in his arms / the floor), hair
  limb(b, M.cloth, along(J.sh, J.neck, -0.05), along(J.sh, J.neck, 0.35), 0.1, 0.075, { seed: seed + 6, bunch: 0.8, flat: 0.8, side: [1, 0, 0], seg: 16 });
  limb(b, M.skin, along(J.sh, J.neck, 0.2), J.neck, 0.058, 0.055, { seed: seed + 7, seg: 12 });
  b.sphere(M.skin, J.head[0], J.head[1], J.head[2], 0.1, 16, 0.9, 0.88, 1.06);
  b.sphere(M.hair, J.head[0] - 0.003, J.head[1] + 0.024, J.head[2] + 0.008, 0.097, 16, 0.8, 0.9, 1.03);
  b.rbox(M.skin, J.head[0] + 0.083, J.head[1] + 0.004, J.head[2] + 0.012, 0.018, 0.055, 0.035, 0, 0, 0.2); // ear
  // arms
  limb(b, M.cloth, J.shL, J.elL, 0.07, 0.06, { seed: seed + 10, bunch: 1.1, side: [0, 1, 0] });
  limb(b, M.cloth, J.elL, J.wrL, 0.062, 0.055, { seed: seed + 11, bunch: 1.4, side: [0, 1, 0] });
  limb(b, M.cloth, J.shR, J.elR, 0.07, 0.06, { seed: seed + 12, bunch: 1.1, side: [0, 1, 0] });
  limb(b, M.cloth, J.elR, J.wrR, 0.062, 0.055, { seed: seed + 13, bunch: 1.4, side: [0, 1, 0] });
  const dirL: P3 = [J.wrL[0] - J.elL[0], 0, J.wrL[2] - J.elL[2]], dirR: P3 = [J.wrR[0] - J.elR[0], 0, J.wrR[2] - J.elR[2]];
  const nL = Math.hypot(dirL[0], dirL[2]), nR = Math.hypot(dirR[0], dirR[2]);
  const wL: P3 = [J.wrL[0] + (dirL[0] / nL) * 0.02, J.wrL[1] - 0.03, J.wrL[2] + (dirL[2] / nL) * 0.02];
  const wR: P3 = [J.wrR[0] + (dirR[0] / nR) * 0.02, J.wrR[1] - 0.03, J.wrR[2] + (dirR[2] / nR) * 0.02];
  deadHand(b, M.skin, wL, dirL, [0, -1, 0], 0.7, seed + 16);
  deadHand(b, M.skin, wR, dirR, [0, -1, 0], 0.5, seed + 17);
  // legs: coverall legs, bands round the shins, the boots
  limb(b, M.cloth, J.hiL, J.knL, 0.095, 0.072, { seed: seed + 20, bunch: 0.9, side: [1, 0, 0] });
  limb(b, M.cloth, J.knL, J.anL, 0.072, 0.064, { seed: seed + 21, bunch: 1.2, side: [1, 0, 0] });
  limb(b, M.cloth, J.hiR, J.knR, 0.095, 0.072, { seed: seed + 22, bunch: 0.9, side: [1, 0, 0] });
  limb(b, M.cloth, J.knR, J.anR, 0.072, 0.064, { seed: seed + 23, bunch: 1.2, side: [1, 0, 0] });
  for (const [kn, an] of [[J.knL, J.anL], [J.knR, J.anR]] as const) {
    limb(b, M.band, along(kn, an, 0.52), along(kn, an, 0.62), 0.072, 0.071, { seed: seed + 24, side: [1, 0, 0], seg: 16, ends: false });
  }
  for (const [an, sx] of [[J.anL, 0.012], [J.anR, -0.01]] as const) {
    if (lying) {
      limb(b, M.boot, [an[0], an[1], an[2] - 0.09], [an[0], an[1] + 0.005, an[2] + 0.05], 0.064, 0.06, { seed: seed + 30, seg: 12 });
      limb(b, M.boot, [an[0], an[1] + 0.012, an[2] + 0.03], [an[0] + sx, 0.045, an[2] + 0.21], 0.06, 0.046, { seed: seed + 31, flat: 0.78, side: [1, 0, 0], seg: 12 });
      b.sphere(M.boot, an[0], an[1] + 0.045, an[2] + 0.02, 0.052, 10, 0.8, 0.9, 1.0);
    } else {
      // boot shaft round the ankle, the foot flat on the floor pointing forward (−z), the heel behind
      limb(b, M.boot, [an[0], an[1] + 0.1, an[2] + 0.005], [an[0], 0.06, an[2]], 0.066, 0.064, { seed: seed + 30, seg: 12 });
      b.rbox(M.boot, an[0] + sx, 0.055, an[2] - 0.09, 0.11, 0.11, 0.27, 0, 0, 0);
      b.sphere(M.boot, an[0] + sx, 0.07, an[2] - 0.2, 0.06, 10, 0.75, 0.95, 1.0); // toe cap
      b.bx(M.boot, an[0] + sx - 0.058, 0.004, an[2] - 0.235, an[0] + sx + 0.058, 0.022, an[2] + 0.045); // sole
    }
  }
}

/**
 * The jointer's bench in the tent (§2.6.3: the shell's table collider x 13.0 … 14.4, z −86.1 … −85.3, top 0.85).
 * Floor prop, origin = floor centre, len 1.4 (x) × d 0.8 (z), the near side (his stool) +z. Built for the seated body:
 * his work pushed to the far side and the ends — the splice jig with the two stripped cable ends across the far edge,
 * the fusion splicer (lid up, screen dark) at the left, the open splice enclosure with its trays fanned at the right,
 * a cleaver, a tool roll, a mug; the middle (his arms, his head) kept clear. A tripod work stool. Calls: 2
 * (steel_raw + painted_dark) + the coverall-orange... no: the hard hat on the floor is painted_white (3).
 */
function spliceBench(b: Builder) {
  const len = 1.4, d = 0.8, top = 0.85, S: Mat = 'steel_raw', K: Mat = 'painted_dark';
  b.bx(K, -len / 2, top - 0.025, -d / 2, len / 2, top, d / 2);
  b.bx(S, -len / 2 + 0.03, top - 0.07, -d / 2 + 0.03, len / 2 - 0.03, top - 0.025, d / 2 - 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(S, sx * (len / 2 - 0.08), (top - 0.07) / 2, sz * (d / 2 - 0.08), 0.016, top - 0.07, 'y', 8);
  for (const sx of [-1, 1]) b.rod(S, sx * (len / 2 - 0.08), 0.15, -d / 2 + 0.08, sx * (len / 2 - 0.08), 0.15, d / 2 - 0.08, 0.01, 5);
  b.rod(S, -len / 2 + 0.08, 0.15, -d / 2 + 0.08, len / 2 - 0.08, 0.15, -d / 2 + 0.08, 0.01, 5);
  // far edge: the jig and the two cable ends, their armour stripped back; the cables down to the floor at both ends
  const zj = -d / 2 + 0.08;
  b.bx(S, -0.62, top, zj - 0.04, 0.62, top + 0.03, zj + 0.04);
  for (const s of [-1, 1]) {
    b.cyl(K, s * 0.47, top + 0.085, zj, 0.058, 0.3, 'x', 12);
    b.cyl(S, s * 0.3, top + 0.085, zj, 0.034, 0.06, 'x', 10);
    b.bx(S, s * 0.56 - 0.03, top + 0.03, zj - 0.04, s * 0.56 + 0.03, top + 0.15, zj + 0.04);
    b.detail(() => {
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; b.rod('painted_yellow', s * 0.27, top + 0.085 + Math.cos(a) * 0.012, zj + Math.sin(a) * 0.012, s * (0.08 + 0.02 * k), top + 0.04 + 0.01 * (k % 3), zj + 0.05 + 0.015 * k, 0.0025, 4); }
    });
    hose(b, K, [[s * 0.62, top + 0.085, zj], [s * 0.78, top - 0.05, zj + 0.02], [s * 0.86, 0.3, zj + 0.08], [s * 0.9, 0.06, zj + 0.25], [s * 0.82, 0.06, zj + 0.6]], 0.056, 10, 6);
  }
  b.detail(() => {
    // fusion splicer at the left: body, lid up toward the far side, a dark screen; a cleaver beside it
    b.bx(K, -0.66, top, -0.18, -0.42, top + 0.12, 0.06);
    b.rbox(K, -0.54, top + 0.2, -0.19, 0.24, 0.16, 0.012, -0.3, 0, 0);
    b.rbox(S, -0.54, top + 0.2, -0.182, 0.2, 0.12, 0.004, -0.3, 0, 0);
    b.bx(S, -0.62, top, 0.14, -0.55, top + 0.04, 0.2);
    // the splice enclosure at the right: a dark canister on its side, lid off, trays fanned out of it
    b.cyl(K, 0.54, top + 0.105, -0.06, 0.1, 0.34, 'z', 16);
    for (let k = 0; k < 5; k++) b.rbox(S, 0.5 + k * 0.012, top + 0.03 + k * 0.012, 0.18 + k * 0.006, 0.18, 0.008, 0.14, 0, -0.35 + k * 0.14, 0);
    // a tool roll unrolled at the near right, a mug
    b.bx(K, 0.36, top, 0.2, 0.66, top + 0.012, 0.36);
    for (let k = 0; k < 5; k++) b.rbox(S, 0.4 + k * 0.05, top + 0.02, 0.28, 0.012, 0.012, 0.13, 0, 0.1 * (k - 2), 0);
    b.cyl('plastic_white', 0.3, top + 0.045, -0.24, 0.04, 0.09, 'y', 12);
  });
  // stool (his): a tripod work stool at the near side
  const zs = d / 2 + 0.35;
  b.cyl(K, 0, 0.58, zs, 0.17, 0.05, 'y', 16);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; b.rod(S, Math.cos(a) * 0.21, 0, zs + Math.sin(a) * 0.21, 0, 0.56, zs, 0.013, 5); }
  b.detail(() => b.torus(S, 0, 0.25, zs, 0.13, 0.008, 'y', 14));
  // his hard hat, fallen to the floor beside the stool
  b.sphere('plastic_white', 0.42, 0.0, zs + 0.12, 0.135, 14, 0.72, 1.0, 1.1);
  b.cyl('plastic_white', 0.42, 0.014, zs + 0.12, 0.16, 0.012, 'y', 18);
}

// ───────────────────────────────────────────────────────────── lock6

const LOCK_ROWS: LightRow6[] = [{ group: 'lock6', type: 'point', p: [0, 2.65, 3.0], color: WARM, i: 9, d: 8 }];

function buildLock(L: LevelBuild) {
  hide(L, 'lock6_grey', ['grey_dark']);
  const b = L.builder('lock6_dress');
  const [h] = placeLights6(L, LOCK_ROWS);
  b.at(0, 3.0, 3.0, PI / 2, () => tunnelFitting(b, L, { len: 1.2, drop: 0.3, lens: L.glow(h, 'emissive_warm', 1.0) }));
  // trays both walls (y 2.0 / 2.6), skipping the stub button's panel area is not needed (it is at 1.0 … 1.4)
  b.at(-3.8, 0, 3.0, PI / 2, () => cableTrays(b, L, { len: 5.6, tiers: [2.0, 2.6], fill: [3, 5], seed: 61 }));
  b.at(3.8, 0, 3.0, -PI / 2, () => cableTrays(b, L, { len: 5.6, tiers: [2.0, 2.6], fill: [4, 4], seed: 62 }));
  // the trunk: through the north wall (from 3c's tunnel) onto the west tray, round the corner into the transit
  transit(b, -3.55, 2.35, 5.8, 0.36, 0.5, '-z');
  transit(b, -2.35, 2.3, 0.2, 0.7, 0.6, '+z');
  trunkRun(b, L, { pts: [[-3.55, 2.3, 5.75], [-3.52, 2.2, 5.2], [-3.52, 2.2, 1.4], [-3.3, 2.24, 0.75], [-2.7, 2.3, 0.42], [-2.35, 2.3, 0.26]], bands: 2.0, cleats: 1.5 });
  // the tray-end shelf under p6_lock_ammo (item (3.4, 1.0, 1.2), 0.2 behind the shelf's west face x 3.2)
  b.at(3.8, 0, 1.2, -PI / 2, () => { wallShelf6(b, L, { w: 0.8, d: 0.6, top: 0.97, seed: 63, collide: false }); b.collide(-0.8 / 2, 0, 0, 0.8 / 2, 0.97, 0.6, 'metal', false); });
  // stencils (the shell's are skipped with `label: false`): the trunk's run, the sealed door's label
  stencil6(b, '트렁크 — 헤드엔드 200 M', -3.79, 1.5, 3.0, 1.8, 0.2, '+x', { style: 'navy' });
  stencil6(b, '트렁크 터널', 0, 2.555, 5.674, 1.38, 0.13, '-z');
  stencil6(b, '헤드엔드 튜브', 0, 2.75, 0.205, 1.4, 0.16, '+z', { style: 'navy' });
  stencil6(b, '압력문 — 접근 금지', -2.6, 1.55, 0.205, 1.0, 0.1, '+z', { style: 'navy' });
  // hazard paint in front of the tube door, a drip tray of oil-dark under the transit
  b.detail(() => b.quad(L.overlay('hazard_stripes'), 0, 0.002, 0.75, 3.4, 0.5, '+y', 0, 'box'));
}

// ───────────────────────────────────────────────────────────── tun6_a

const TUN_A_ROWS: LightRow6[] = [
  ...[-8, -24, -40].map((z): LightRow6 => ({ group: 'tun6_a', type: 'point', p: [0, 3.6, z], color: COOL, i: 9, d: 14 })),
  ...[-56, -72].map((z): LightRow6 => ({ group: 'tun6_a_far', type: 'point', p: [0, 3.6, z], color: COOL, i: 9, d: 14 })),
  ...[-60, -76].map((z): LightRow6 => ({ group: 'tun6_a_emerg', type: 'point', p: [0, 3.5, z], color: RED, i: 2.5, d: 10, off: true })),
];
const RINGS_A = [-16, -32, -48, -64];

function buildTunA(L: LevelBuild) {
  hide(L, 'tun6_a_grey', ['grey_dark', 'painted_yellow']);
  hide(L, 'grey6:tun6_a_cover', ['grey_dark']);
  const b = L.builder('tun6_a_dress');
  const H = placeLights6(L, TUN_A_ROWS);
  const near = L.glow(H[0], 'emissive_white', 1.0), far = L.glow(H[3], 'emissive_white', 1.0), emerg = L.glow(H[5], 'emissive_red', 1.0);
  // rings (W8 over the shell's jamb colliders)
  for (const z of RINGS_A) b.at(0, 0, z, 0, () => tunnelRing(b, L, { label: `RING A${RINGS_A.indexOf(z) + 1}`, collide: false }));
  // caged fittings every 8 m: on the ceiling (y 4.0) between the rings, under the ring headers (y 3.4) at them
  for (let z = -8; z >= -72; z -= 8) {
    const ring = RINGS_A.includes(z);
    b.at(0, ring ? 3.4 : 4.0, z, PI / 2, () => tunnelFitting(b, L, { len: 1.2, drop: ring ? 0.12 : 0.3, lens: z > -52 ? near : far }));
  }
  // red emergency fittings (z −60, −76: `tun6_a_emerg`, off until `tun6_far_out`)
  for (const z of [-60, -76]) b.at(0, 4.0, z, 0, () => tunnelFitting(b, L, { len: 0.5, drop: 0.3, lens: emerg }));
  // trays: west 2.0 / 2.6 / 3.2, east 2.0 / 2.6 (gaps at the rings); local x → world −z (west, ry π/2) / +z (east)
  const skipW = RINGS_A.map((z): [number, number] => [-(z + 40) - 0.32, -(z + 40) + 0.32]);
  const skipE = RINGS_A.map((z): [number, number] => [(z + 40) - 0.32, (z + 40) + 0.32]);
  b.at(-2.3, 0, -40, PI / 2, () => cableTrays(b, L, { len: 79.6, tiers: [2.0, 2.6, 3.2], fill: [5, 4, 3], skip: skipW, seed: 71 }));
  b.at(2.3, 0, -40, -PI / 2, () => cableTrays(b, L, { len: 79.6, tiers: [2.0, 2.6], fill: [2, 5], skip: skipE, seed: 72 }));
  // the trunk: out of the transit (west, z −0.2), over a crossing tray near the tube door, onto the east tray at 2.2,
  // through the rings (a sleeve each side), on into Repeater 2
  transit(b, -2.15, 2.3, -0.2, 0.3, 0.6, '-z');
  b.detail(() => {
    // the crossing ladder tray (y 3.45) on drop rods
    for (const z of [-1.45, -1.95]) b.bx('steel_raw', -2.3, 3.45, z - 0.003, 2.3, 3.55, z + 0.003);
    for (let x = -2.15; x < 2.3; x += 0.3) b.bx('steel_raw', x - 0.015, 3.45, -1.95, x + 0.015, 3.462, -1.45);
    for (const x of [-1.5, 0, 1.5]) for (const z of [-1.45, -1.95]) b.rod('steel_raw', x, 3.45, z, x, 4.0, z, 0.008, 5);
  });
  const ty = 2.155;
  trunkRun(b, L, { pts: [[-2.15, 2.3, -0.28], [-1.95, 2.9, -0.8], [-1.5, 3.6, -1.6], [1.5, 3.6, -1.75], [1.98, 2.9, -2.6], [2.0, ty, -3.6], [2.0, ty, -79.85]], bands: 2.0, cleats: 1.5 });
  for (const z of RINGS_A) for (const s of [-1, 1]) b.cyl('navy_grey', 2.0, ty, z + s * 0.205, 0.16, 0.02, 'z', 16);
  // JB1–JB4 (W8 over the shell's cover colliders), the pickups' bracket shelves on JB1–3
  const jb: [number, number, string, boolean][] = [[-2.3, -24, 'JB 1-24', true], [2.3, -40, 'JB 1-40', true], [-2.3, -56, 'JB 1-56', true], [2.3, -70, 'JB 1-70', false]];
  for (const [x, z, label, shelf] of jb) b.at(x, 0, z, x < 0 ? PI / 2 : -PI / 2, () => junctionBox(b, L, { label, shelf, collide: false }));
  // DT1 / DT2 (tow bars toward the centre line)
  b.at(1.2, 0, -30.0, PI, () => drumTrolley(b, L, { collide: false }));
  b.at(-1.2, 0, -62.0, 0, () => drumTrolley(b, L, { collide: false }));
  // the centre-line drain (overlay grating flush with the invert, angle edges)
  drainRun(b, L, 0, -0.4, -79.6);
  // the dewatering pipe on the west wall at y 0.2 (a walkable kerb: collider to its top), broken at JB1 / JB3
  const pipeRuns: [number, number][] = [[-0.3, -22.4], [-25.6, -54.4], [-57.6, -79.7]]; // breaks widened so cover cv6_t1/t1b/t3/t3b stand clear of the kerb ends
  for (const [z0, z1] of pipeRuns) {
    const len = z0 - z1, zc = (z0 + z1) / 2;
    b.at(-2.3, 0, zc, PI / 2, () => dewaterPipe(b, L, { len, mat: 'painted_dark', collide: true }));
  }
  // hard-wired emergency floor strips on both wall bases (their light is the far half's guide after `tun6_far_out`)
  const ringObs = (face: number) => RINGS_A.map((z): [number, number, number] => [z + 0.2, z - 0.2, face]);
  stripRun(b, L, -2.06, -0.5, -79.75, [...ringObs(-1.92), [-23.2, -24.8, -1.32], [-55.2, -56.8, -1.32]]);
  stripRun(b, L, 2.06, -0.5, -79.75, [...ringObs(1.92), [-39.2, -40.8, 1.32], [-69.2, -70.8, 1.32]]);
  // chainage stencils (west wall, every 16 m between the rings) and the section board
  for (let z = -8; z >= -72; z -= 16) stencil6(b, `CH 0+${String(Math.round(-z)).padStart(3, '0')}`, -2.29, 1.45, z, 0.5, 0.14, '+x', { style: 'navy' });
  stencil6(b, '케이블 터널 — 1구간', -2.29, 2.85 - 1.05, -5.0, 2.2, 0.2, '+x', { style: 'navy' });
  stencil6(b, '중계기 2  80 M  →', 2.29, 1.7, -4.0, 1.6, 0.16, '-x', { style: 'navy' });
}

/** Flush drain along the centre line from z0 to z1 (z0 > z1): an overlay grating on the invert, two angle edges. */
function drainRun(b: Builder, L: LevelBuild, x: number, z0: number, z1: number) {
  const len = z0 - z1, zc = (z0 + z1) / 2, w = 0.3;
  b.solid(() => b.quad(L.overlay('floor_grate'), x, 0.0, zc, w, len, '+y', 0, 'box', 0.002));
  for (const s of [-1, 1]) b.bx('steel_raw', x + s * (w / 2) - (s > 0 ? 0 : 0.03), -0.02, z1, x + s * (w / 2) + (s < 0 ? 0 : 0.03), 0.01, z0);
}

// ───────────────────────────────────────────────────────────── rep6

/** The tent's work lamp hook (on the ridge pole) and the lamp's hang below it. */
const HOOK: P3 = [13.8, 2.16, -85.3];
const HANG = 0.52;
const REP_ROWS: LightRow6[] = [
  { group: 'rep6', type: 'point', p: [2.0, 4.6, -86.0], color: WARM, i: 17, d: 16 },
  { group: 'rep6', type: 'point', p: [11.0, 4.6, -86.0], color: WARM, i: 17, d: 16 },
  // the tent's work lamp (medium+, pulse flicker): it hangs from the ridge and swings (`v6_tent`) — the light follows it
  { group: 'rep6', type: 'point', p: [HOOK[0], HOOK[1] - HANG - 0.1, HOOK[2]], color: 0xfff0d0, i: 3, d: 4, min: 'medium', flicker: 'pulse' },
];

interface TentRig { lamp: Part; flap: Part; light: LightHandle; pose(lampA: number, lampTwist: number, flapA: number): void }
const TENT = new WeakMap<LevelBuild, TentRig>();

function buildRep(L: LevelBuild) {
  hide(L, 'rep6_grey', ['grey_dark', 'painted_white']);
  hide(L, 'grey6:rep6_cover', ['grey_dark']);
  restyle(L, 'grey6:rep6_tent', (m) => isStandin(m) || m === L.doubleSided('floor_grate'), null);
  const b = L.builder('rep6_dress');
  const H = placeLights6(L, REP_ROWS);
  const lens = L.glow(H[0], 'emissive_warm', 1.0);
  for (const x of [2.0, 11.0]) b.at(x, 5.0, -86.0, 0, () => tunnelFitting(b, L, { len: 1.2, drop: 0.32, lens }));
  // the vault: 45° haunches along the long walls (y 4.0 … 5.0, clear of both tunnel mouths' 4.0 m) and lattice ribs
  const C = tmat6(L, 'tunnel_shotcrete');
  for (const [z, s] of [[-80.2, 1], [-91.8, -1]] as const) b.rbox(C, 5.0, 4.62, z - s * 0.12, 21.6, 1.0, 1.0, PI / 4, 0, 0);
  for (const [x, s] of [[-5.8, 1], [15.8, -1]] as const) b.rbox(C, x + s * 0.12, 4.62, -86.0, 1.0, 1.0, 11.6, 0, 0, PI / 4);
  b.detail(() => {
    for (const x of [-3.0, 1.0, 5.0, 9.0, 13.0]) {
      // a lattice girder rib across the vault (z): two chords under the ceiling and down the haunches, diagonals
      b.bx('steel_raw', x - 0.06, 4.9, -90.6, x + 0.06, 4.96, -81.4);
      b.bx('steel_raw', x - 0.06, 4.7, -90.6, x + 0.06, 4.74, -81.4);
      for (let z = -90.4; z < -81.5; z += 0.6) b.rod('steel_raw', x, 4.74, z, x, 4.9, z + 0.3, 0.012, 4);
      for (const [z0, s] of [[-80.2, 1], [-91.8, -1]] as const) b.rod('steel_raw', x, 4.0, z0 - s * 0.06, x, 4.93, z0 - s * 1.2, 0.035, 6);
    }
  });
  // RB (W8 over the shell's collider), its cable ladder up to an overhead tray along the north wall
  b.at(-5.8, 0, -87.0, PI / 2, () => repeaterBank(b, L, { len: 8.0, collide: false }));
  b.detail(() => {
    for (const z of [-80.45, -80.9]) b.bx('steel_raw', -5.6, 3.6, z - 0.003, 15.6, 3.68, z + 0.003);
    for (let x = -5.5; x < 15.6; x += 0.3) b.bx('steel_raw', x - 0.015, 3.6, -80.9, x + 0.015, 3.612, -80.45);
    for (let x = -5.0; x < 15.6; x += 2.0) b.rod('steel_raw', x, 3.6, -80.68, x, 5.0, -80.68, 0.01, 5);
  });
  for (let i = 0; i < 4; i++) b.cyl('rubber', 5.0, 3.63 + (i % 2) * 0.02, -80.53 - i * 0.1, 0.018, 21.0, 'x', 6);
  for (let i = 0; i < 4; i++) hose(b, 'rubber', [[-5.3 + i * 0.08, 3.62, -80.6 - i * 0.08], [-5.1 + i * 0.06, 3.0, -82.0], [-5.15 + i * 0.06, 2.42, -83.4 - i * 0.2]], 0.02, 6, 6);
  // the trunk: in from tunnel A's east tray, along the north wall (y 2.3), down the east wall behind the tent and the
  // shelf, into tunnel B's east tray; cleats on wall brackets
  trunkRun(b, L, { pts: [[2.0, 2.155, -79.75], [2.5, 2.25, -80.3], [3.2, 2.3, -80.48], [15.1, 2.3, -80.48], [15.5, 2.3, -80.9], [15.52, 2.3, -91.0], [15.1, 2.25, -91.6], [14.4, 2.2, -91.85], [14.0, 2.155, -92.3]], bands: 2.0, cleats: 1.5 });
  b.detail(() => {
    for (let x = 4.0; x < 15.0; x += 1.5) b.bx('navy_grey', x - 0.04, 2.13, -80.2, x + 0.04, 2.17, -80.62);
    for (let z = -82.0; z > -91.0; z -= 1.5) b.bx('navy_grey', 15.38, 2.13, z - 0.04, 15.8, 2.17, z + 0.04);
  });
  // DS1, DS2 (static drums on roller cradles), LC1, LC2 (crates), over the shell's colliders
  b.at(10.3, 0, -82.3, 0, () => cableDrum(b, L, { mount: 'cradle', collide: false }));
  b.at(-0.7, 0, -89.7, 0, () => cableDrum(b, L, { mount: 'cradle', collide: false }));
  stencil6(b, '예비 트렁크 — 2.1 KM 구간', 10.3, 0.55, -81.53, 0.9, 0.08, '+z', { style: 'navy' });
  b.at(5.7, 0, -89.0, 0, () => crate6(b, L, { w: 1.4, d: 1.2, label: '할시온 서브시 — 조인팅 키트', collide: false }));
  b.at(7.6, 0, -82.2, PI, () => crate6(b, L, { w: 1.2, d: 1.2, label: '접속 소모품', collide: false }));
  // a spare coil off the route (≥ 3 m from the line between the two mouths)
  b.at(-3.4, 0, -83.0, 0, () => spareCoil(b, L, {}));
  // the equipment shelf (east wall, z −90 … −88; items at x 15.6, 0.2 behind its face 15.4), the first-aid box
  b.at(15.8, 0, -89.0, -PI / 2, () => { wallShelf6(b, L, { w: 2.0, d: 0.4, top: 0.97, seed: 64, collide: false }); b.collide(-2.0 / 2, 0, 0, 2.0 / 2, 0.97, 0.4, 'metal', false); });
  b.at(-5.8, 0, -82.0, PI / 2, () => { firstAidBox6(b, L, { collide: false }); b.collide(-0.3, 0.95, 0, 0.3, 1.5, 0.2, 'metal', false); });
  // the ceiling vent `vent6_rep`: a duct collar round the opening; the grille's stand-in visual → a steel grating
  b.detail(() => {
    for (const [x0, z0, x1, z1] of [[5.5, -84.5, 6.5, -84.4], [5.5, -83.6, 6.5, -83.5], [5.5, -84.4, 5.6, -83.6], [6.4, -84.4, 6.5, -83.6]] as const) b.bx('navy_grey', x0, 4.93, z0, x1, 5.0, z1);
  });
  const grille = L.objects.get('vent6_rep_grille');
  const gm = L.doubleSided('floor_grate');
  grille?.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = gm; });
  // stencils
  stencil6(b, '중계기 2 — 1.1 KM', -4.2, 3.2, -80.21, 2.2, 0.24, '-z', { style: 'navy' });
  stencil6(b, '헤드엔드  70 M  ↓', 6.0, 3.2, -91.79, 1.8, 0.2, '+z', { style: 'navy' });
  stencil6(b, '라인 증폭기 — 차단 금지', -4.59, 2.45, -87.0, 1.6, 0.1, '+x', { style: 'navy' });
  buildTent(L, b, H[2]);
}

function buildTent(L: LevelBuild, b: Builder, light: LightHandle) {
  // the tent (W8) over the shell's move-only tarp colliders (x 12.4 … 14.8, z −86.4 … −84.0 — W4a moved it 0.8 m
  // south of the plan's place), the tripod halogen dead: the lamp still burning is the one he hung from the ridge
  b.at(13.6, 0, -85.2, 0, () => jointerTent(b, L, { lens: L.ctx.materials.get('painted_dark'), collide: false }));
  // the bench over the shell's table collider (x 13.0 … 14.4, z −86.1 … −85.3), its stool, J. Rød on it
  b.at(13.7, 0, -85.7, 0, () => spliceBench(b));
  b.at(13.7, 0, -84.95, 0, () => jointerBody(b, L, { pose: 'seated', seed: 6101 }));
  b.collide(13.38, 0, -85.3, 14.02, 1.1, -84.72, 'flesh', true);
  // the job card on the front pole (§6.3: (13.6, 1.4, −83.15) facing +z; the pole stands at z −84.02 — W4a's place)
  b.detail(() => {
    b.bx('plastic_white', 13.52, 1.29, -83.995, 13.68, 1.51, -83.99);
    b.bx('steel_raw', 13.58, 1.5, -84.0, 13.62, 1.53, -83.985);
    b.rod('rubber', 13.58, 1.52, -83.99, 13.6, 1.56, -84.03, 0.003, 4);
  });
  stencil6(b, '작업 카드', 13.6, 1.46, -83.987, 0.13, 0.03, '+z', { style: 'navy' });
  stencil6(b, 'J. RØD  MON 07:30', 13.6, 1.4, -83.987, 0.13, 0.025, '+z', { style: 'navy' });

  // the hanging work lamp (a caged inspection lamp on its cord from a hook on the ridge) — moving part
  b.detail(() => { b.torus('steel_raw', HOOK[0], HOOK[1] + 0.02, HOOK[2], 0.025, 0.005, 'x', 10); });
  const lampLens = L.glow(light, 'emissive_warm', 1.2);
  const lamp = part(L, 'v6_tent_lamp', ['rep6'], HOOK[0], HOOK[1], HOOK[2], (p) => {
    p.rod('rubber', 0, 0, 0, 0, -HANG + 0.1, 0, 0.005, 5);
    p.cyl('rubber', 0, -HANG + 0.04, 0, 0.022, 0.12, 'y', 10);
    p.sphere(lampLens, 0, -HANG - 0.06, 0, 0.04, 12);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; p.rod('steel_raw', Math.cos(a) * 0.025, -HANG - 0.02, Math.sin(a) * 0.025, Math.cos(a) * 0.055, -HANG - 0.08, Math.sin(a) * 0.055, 0.003, 4); p.rod('steel_raw', Math.cos(a) * 0.055, -HANG - 0.08, Math.sin(a) * 0.055, 0, -HANG - 0.135, 0, 0.003, 4); }
    p.torus('steel_raw', 0, -HANG - 0.08, 0, 0.055, 0.004, 'y', 12);
    p.bx('steel_raw', -0.004, -HANG + 0.12, -0.003, 0.004, -HANG + 0.2, 0.003);
  });
  // the door flap: the west quarter of the open side, a loose tarp hanging from the eave (moving part, no collider)
  const tarp = mat4(L, 'k6_tarp', () => L.ctx.materials.clone('plastic_white', { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, color: 0xc8961a, roughness: 0.66, metalness: 0, side: THREE.DoubleSide }));
  const FW = 0.62, FH = 1.72;
  const flap = part(L, 'v6_tent_flap', ['rep6'], 12.43 + FW / 2, 1.9, -83.95, (p) => {
    p.geo(tarp, curtainGeo(FW, FH, 3, 0.02), 'keep', new THREE.Matrix4().makeTranslation(0, -FH / 2, 0), FW, FH);
    p.cyl(tarp, 0, -FH + 0.02, 0, 0.018, FW, 'x', 6);
  });
  const lampLocal = new THREE.Vector3();
  const pose = (a: number, tw: number, fa: number) => {
    lamp.pivot.rotation.set(a, tw, a * 0.12);
    flap.pivot.rotation.x = -fa;
    lampLocal.set(0, -HANG - 0.1, 0).applyEuler(lamp.pivot.rotation);
    light.position.set(HOOK[0] + lampLocal.x, HOOK[1] + lampLocal.y, HOOK[2] + lampLocal.z);
  };
  pose(0, 0, 0);
  TENT.set(L, { lamp, flap, light, pose });
}

// ───────────────────────────────────────────────────────────── tun6_b (dark)

const TUN_B_ROWS: LightRow6[] = [-100, -116, -132, -148].map((z): LightRow6 => ({ group: 'tun6_b', type: 'point', p: [12.0, 3.5, z], color: RED, i: 3.6, d: 12 }));
const RINGS_B = [-120, -136, -152];

function buildTunB(L: LevelBuild) {
  hide(L, 'tun6_b_grey', ['grey_dark', 'painted_yellow']);
  hide(L, 'grey6:tun6_b_cover', ['grey_dark']);
  const b = L.builder('tun6_b_dress');
  const H = placeLights6(L, TUN_B_ROWS);
  const red = L.glow(H[0], 'emissive_red', 1.4);
  // rings (flush: the shell has no ring colliders here — the jamb is a 4 cm steel-faced band; header above 3.4)
  for (const z of RINGS_B) b.at(12.0, 0, z, 0, () => tunnelRing(b, L, { w: 4.6, jamb: 0.04, label: `RING B${RINGS_B.indexOf(z) + 1}`, collide: false }));
  // dead mains: fittings every 8 m (lens dark), one hanging by its cable at z −118
  const dead = lampLens6(L, 'white', 0);
  for (const z of [-96, -104, -112, -128, -144]) b.at(12.0, 4.0, z, PI / 2, () => tunnelFitting(b, L, { len: 1.2, drop: 0.3, lens: dead }));
  for (const z of [-120, -136, -152]) b.at(12.0, 3.4, z, PI / 2, () => tunnelFitting(b, L, { len: 1.2, drop: 0.12, lens: dead }));
  b.at(12.0, 4.0, -118.0, PI / 2, () => tunnelFitting(b, L, { len: 1.2, drop: 0.3, hanging: true, name: 'fitting6_hang_b', lens: dead }));
  // the red caged emergency fittings (hard-wired, on from load)
  for (const z of [-100, -116, -132, -148]) b.at(12.0, 4.0, z + 1.2, 0, () => tunnelFitting(b, L, { len: 0.5, drop: 0.45, lens: red }));
  // trays (west 2.0 / 2.6 / 3.2, east 2.0 / 2.6, the east broken at d6_bay's opening)
  const zc = -126, skipW = RINGS_B.map((z): [number, number] => [-(z - zc) - 0.32, -(z - zc) + 0.32]);
  b.at(9.7, 0, zc, PI / 2, () => cableTrays(b, L, { len: 67.6, tiers: [2.0, 2.6, 3.2], fill: [5, 4, 3], skip: skipW, seed: 81 }));
  const skipE: [number, number][] = [...RINGS_B.map((z): [number, number] => [(z - zc) - 0.32, (z - zc) + 0.32]), [-103.9 - zc, -100.1 - zc]];
  b.at(14.3, 0, zc, -PI / 2, () => cableTrays(b, L, { len: 67.6, tiers: [2.0, 2.6], fill: [2, 5], skip: skipE, seed: 82 }));
  // the trunk on the east tray, up and over d6_bay's lintel, into the head-end's transit at the far end; tails down
  // into RH2's bend restrictors
  const ty = 2.155;
  trunkRun(b, L, { pts: [[14.0, ty, -92.15], [14.0, ty, -99.4], [14.02, 2.7, -99.9], [14.05, 3.25, -100.5], [14.05, 3.25, -103.5], [14.02, 2.7, -104.1], [14.0, ty, -104.6], [14.0, ty, -159.0], [14.0, 2.3, -159.75]], bands: 2.0, cleats: 1.5 });
  transit(b, 14.0, 2.3, -159.8, 0.5, 0.6, '+z');
  for (const z of RINGS_B) for (const s of [-1, 1]) b.cyl('navy_grey', 14.0, ty, z + s * 0.205, 0.16, 0.02, 'z', 16);
  // RH1–RH3 (W8 over the shell's cover colliders), shelves on RH2 / RH3 (the pickups)
  const rh: [number, number, string, boolean][] = [[9.7, -109, '중계기 하우징 2-B1 — 할시온 서브시', false], [14.3, -125, '중계기 하우징 2-B2 — 할시온 서브시', true], [9.7, -141, '중계기 하우징 2-B3 — 할시온 서브시', true]];
  const led = ledMat6(L, 0.9);
  for (const [x, z, label, shelf] of rh) {
    const ry = x < 12 ? PI / 2 : -PI / 2;
    b.at(x, 0, z, ry, () => {
      repeaterHousing(b, L, { label, shelf, collide: false });
      // a status panel on the housing's front frame (lit: amber / green LEDs), the cable tails into both restrictors
      b.bx('painted_dark', 0.55, 1.45, 1.36, 0.92, 1.68, 1.4);
      b.bx(led, 0.58, 1.48, 1.4, 0.89, 1.65, 1.402);
      for (const s of [-1, 1]) hose(b, x > 12 ? tmat6(L, 'cable_armour') : 'rubber', [[s * 1.05, 1.3, 0.76], [s * 1.25, 1.5, 0.6], [s * 1.25, 1.95, 0.35], [s * 1.2, 2.13, 0.3]], x > 12 ? 0.07 : 0.045, 10, 6);
    });
  }
  // the sentry dock in the ceiling (12.0, 3.9, −134.0): a recessed docking hatch with a hazard border
  b.bx('navy_grey', 11.5, 3.93, -134.5, 12.5, 3.995, -133.5);
  b.bx('painted_dark', 11.65, 3.92, -134.35, 12.35, 3.93, -133.65);
  b.detail(() => { for (const [x0, z0, x1, z1] of [[11.45, -134.55, 12.55, -134.47], [11.45, -133.53, 12.55, -133.45], [11.45, -134.47, 11.53, -133.53], [12.47, -134.47, 12.55, -133.53]] as const) b.bx('hazard_stripes', x0, 3.935, z0, x1, 3.99, z1); });
  stencil6(b, '센트리 도크 — 접근 금지', 9.71, 2.35 - 0.5, -134.0, 1.4, 0.12, '+x', { style: 'navy' });
  // the floor strips (green-amber, hard-wired, continuous), detouring round RH1–3 and the bay door's frame
  stripRun(b, L, 9.82, -92.4, -159.6, [[-108, -110, 11.18], [-140, -142, 11.18]]);
  stripRun(b, L, 14.18, -92.4, -159.6, [[-100.2, -103.8, 13.98], [-124, -126, 12.82]]);
  // lit egress signs between the red pools (no unreadable run > 8 m with the lamp off)
  egressSign(b, L, 0, 14.29, 1.7, -108.0, '-x');
  egressSign(b, L, 1, 9.71, 1.7, -124.0, '+x');
  egressSign(b, L, 0, 14.29, 1.7, -140.0, '-x');
  egressSign(b, L, 1, 9.71, 1.7, -155.0, '+x');
  // a lit plate over d6_bay (the door reads with the lamp off, §2.7.3)
  egressSign(b, L, 2, 14.29, 2.88, -102.0, '-x');
  egressSign(b, L, 3, 12.0, 2.88, -159.79, '+z');
  // drainage, dewatering pipe (west, broken at RH1 / RH3), chainage
  drainRun(b, L, 12.0, -92.4, -159.6);
  for (const [z0, z1] of [[-92.4, -107.9], [-110.1, -139.9], [-142.1, -159.7]] as const) b.at(9.7, 0, (z0 + z1) / 2, PI / 2, () => dewaterPipe(b, L, { len: z0 - z1, mat: 'painted_dark', collide: true }));
  for (const z of [-100, -116, -132, -148]) stencil6(b, `CH 0+${String(Math.round(4 - z)).padStart(3, '0')}`, 9.71, 1.15, z + 4, 0.5, 0.14, '+x', { style: 'navy' });
  stencil6(b, '케이블 터널 — 2구간', 9.71, 2.85 - 1.05, -94.5, 2.2, 0.2, '+x', { style: 'navy' });
  stencil6(b, '비상 조명만', 14.29, 2.85 - 1.05, -94.5, 1.8, 0.14, '-x', { style: 'navy' });
}

// ───────────────────────────────────────────────────────────── bay6

const BAY_ROWS: LightRow6[] = [{ group: 'bay6', type: 'point', p: [17.5, 2.8, -102.0], color: WARM, i: 8, d: 8 }];

function buildBay(L: LevelBuild) {
  hide(L, 'bay6_grey', []);
  const b = L.builder('bay6_dress');
  const [h] = placeLights6(L, BAY_ROWS);
  b.at(17.5, 3.2, -102.0, 0, () => tunnelFitting(b, L, { len: 1.2, drop: 0.3, lens: L.glow(h, 'emissive_warm', 1.0) }));
  // the joint box on its trestles (W8 over the shell's collider), a hard hat and an OTDR case on its lid
  b.at(17.0, 0, -102.0, 0, () => jointBox(b, L, { collide: false }));
  b.detail(() => {
    b.bx('painted_yellow', 16.3, 1.2, -102.2, 16.75, 1.42, -101.85);
    b.bx('painted_dark', 16.36, 1.42, -102.15, 16.69, 1.43, -101.9);
    b.sphere('painted_white', 17.6, 1.2, -102.0, 0.135, 14, 0.72, 1.0, 1.1);
    b.cyl('painted_white', 17.6, 1.21, -102.0, 0.16, 0.012, 'y', 18);
  });
  // the spare coil (SW corner, clear of the door and the spawn markers), the shelf (east wall) under the pickups
  b.at(15.5, 0, -105.0, 0, () => spareCoil(b, L, {}));
  b.at(20.3, 0, -104.0, -PI / 2, () => { wallShelf6(b, L, { w: 2.0, d: 0.4, top: 0.97, seed: 65, collide: false }); b.collide(-2.0 / 2, 0, 0, 2.0 / 2, 0.97, 0.4, 'metal', false); });
  // trays (north and south walls, y 2.0 / 2.6), the trunk's spare tail from the joint into the wall transit
  b.at(17.5, 0, -98.2, PI, () => cableTrays(b, L, { len: 5.4, tiers: [2.0, 2.6], fill: [3, 2], seed: 91 }));
  b.at(17.5, 0, -105.8, 0, () => cableTrays(b, L, { len: 5.4, tiers: [2.0], fill: [3], seed: 92 }));
  stencil6(b, '조인트 베이 2', 20.29, 2.3, -100.2, 1.6, 0.24, '-x', { style: 'navy' });
  stencil6(b, '할시온 서브시 — 예비품', 20.29, 1.6, -100.2, 1.2, 0.1, '-x', { style: 'navy' });
  stencil6(b, '노화 금지 — 케이블 조인팅', 17.5, 1.35, -98.21, 2.0, 0.12, '-z', { style: 'navy' });
}

// ───────────────────────────────────────────────────────────── vignettes

/** `regions.dark` gains these boxes (idempotent). */
function darkAdd(L: LevelBuild, boxes: Box6[]) {
  const regions = L.ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
  if (!regions) return;
  const list = (regions.dark ??= []);
  for (const bx of boxes) { const b3 = box3(bx); if (!list.some((q) => q.equals(b3))) list.push(b3); }
}

function vignettes(L: LevelBuild) {
  const lm = L.ctx.render.lights;
  // ── tun6_far_out (§4.2, §2.7.1): the far mains (z −56, −72) stutter and die, the red emergency points come on
  const FAR_DARK: Box6 = [-2.5, -0.5, -80, 2.5, 4.0, -52];
  let farTok = 0;
  const farEnd = () => {
    farTok++;
    lm.setGroup('tun6_a_far', { enabled: false, intensityScale: 1 });
    lm.setGroup('tun6_a_emerg', { enabled: true });
    darkAdd(L, [FAR_DARK]);
  };
  L.vignette('tun6_far_out', () => {
    const tok = ++farTok;
    L.sfx('lights_out_dock', 0, 3.6, -64, 0.6);
    // stutter (0.7 s): off / on / dim / off, then the reds 0.4 s later
    const seq: [number, number][] = [[0.0, 0.15], [0.08, 1.0], [0.2, 0.0], [0.3, 0.6], [0.36, 0.0], [0.52, 0.35], [0.6, 0.0]];
    for (const [t, k] of seq) L.after(t, () => { if (tok === farTok) lm.setGroup('tun6_a_far', { intensityScale: k }); });
    L.after(0.7, () => { if (tok !== farTok) return; lm.setGroup('tun6_a_far', { enabled: false, intensityScale: 1 }); darkAdd(L, [FAR_DARK]); });
    L.after(1.1, () => { if (tok === farTok) lm.setGroup('tun6_a_emerg', { enabled: true }); });
  }, { snap: farEnd });

  // ── v6_tent (§5.7 #2): the draught lifts the flap and drops it back; the hanging work lamp swings on its hook (its
  //    light swinging with it, over the boots under the bench), then hangs still
  const rig = TENT.get(L);
  let tentTok = 0;
  const DUR = 7.5;
  L.vignette('v6_tent', () => {
    if (!rig) return;
    const tok = ++tentTok;
    L.sfx('tarp_flap', 12.74, 1.3, -83.95, 0.8);
    L.after(0.35, () => { if (tok === tentTok) L.sfx('lamp_creak', HOOK[0], HOOK[1], HOOK[2], 0.75); });
    L.after(2.1, () => { if (tok === tentTok) L.sfx('lamp_creak', HOOK[0], HOOK[1], HOOK[2], 0.45, 1.1); });
    L.after(1.3, () => { if (tok === tentTok) L.sfx('tarp_flap', 12.74, 1.3, -83.95, 0.4, 1.15); });
    const w = Math.sqrt(9.81 / (HANG + 0.1));
    L.tween(0, DUR, (k) => {
      if (tok !== tentTok) return;
      const t = k * DUR;
      // lamp: pushed by the gust (rise 0.3 s), then a damped pendulum; a slow twist on its cord
      const gust = smooth(t / 0.3);
      const a = 0.42 * gust * Math.exp(-t / 2.2) * Math.sin(w * t + 0.25);
      const tw = 0.5 * Math.exp(-t / 3.0) * Math.sin(1.3 * t) * gust;
      // flap: lifts outward over 0.45 s, hangs on the gust, falls back with two small slaps
      const fa = t < 0.45 ? 0.85 * smooth(t / 0.45) : t < 0.9 ? 0.85 - 0.08 * Math.sin((t - 0.45) * 9) : 0.85 * Math.exp(-(t - 0.9) * 3.2) * Math.abs(Math.cos((t - 0.9) * 6.5));
      rig.pose(a, tw, Math.max(0, fa));
    }, () => { if (tok === tentTok) rig.pose(0, 0, 0); });
  }, { snap: () => { tentTok++; rig?.pose(0, 0, 0); } });
}

// ───────────────────────────────────────────────────────────── the table

const TUNNEL_LOOK = { floor: 'floor_concrete', wall: 'tunnel_shotcrete', ceiling: 'tunnel_shotcrete' } as const;

export const TUNNELS_DRESS: Partial<Record<RoomId6, RoomDress>> = {
  lock6: { build: buildLock, lights: [], look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'painted_dark' }, label: false },
  tun6_a: { build: buildTunA, lights: [], look: TUNNEL_LOOK, label: false },
  rep6: { build: (L) => { buildRep(L); vignettes(L); }, lights: [], look: TUNNEL_LOOK, label: false },
  tun6_b: { build: buildTunB, lights: [], look: TUNNEL_LOOK, label: false },
  bay6: { build: buildBay, lights: [], look: TUNNEL_LOOK, label: false },
};
