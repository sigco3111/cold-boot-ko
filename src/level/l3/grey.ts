/**
 * THE QUIET SIDE — level 3 greybox shell (stage 3a, docs/plans/stage-3a.md §2; task K5).
 *
 * What lives here:
 *  - `ROOMS3`: every room's plan box, floor and height (the §2.1 table, final coordinates).
 *  - `GreyGrid`: the shell kernel. The level is one solid block; rooms, door openings (+ the slots their leaves
 *    slide into), glazing slots, voids and pits are carved out of it as air, slabs (balcony, landing) are put back.
 *    From that cell grid it emits ONLY the faces that look into a room (greedy-merged quads, one builder per set
 *    of rooms that can see the face, so portal culling is exact), and box colliders for every solid that touches
 *    air. No two rendered faces can coincide (no z-fight by construction); every wall is as thick as the plan says.
 *  - `SHELLS3`: one function per room: carves its air, adds what is not grid (glass panes, stairs, balustrades,
 *    hatch panels, the few stand-in blocks the plan dimensions — office desk, servery counter), its wayfinding
 *    label, screens, interactables, pickups, markers. Lights come from `LIGHTS3` (one table per room).
 *
 * How dressing extends it (P3a/P3b/P3c): a dressing file exports a `Partial<Record<RoomId3, RoomDress>>` and
 * `l3/index.ts` lists it in `DRESSING`. Per room it can add geometry (`build`, run after the shell, inside the
 * room's build pass so it is culled with the room), replace the placeholder light table (`lights`), restyle the
 * shell faces (`look`: floor / wall / ceiling material) and drop the greybox label (`label: false`). It never
 * edits the shell, the colliders, the doors, the triggers or the phase table.
 */
import * as THREE from 'three';
import type { LightHandle, Quality, Surface } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';

const PI = Math.PI;
/** Deck-2 floor. */
export const D2 = 4.8;
/** Half the standard wall thickness (walls are 0.4 m, centred on the room boundaries). */
export const HW = 0.2;

// ───────────────────────────────────────────────────────────── rooms (§2.1)

export type RoomId3 =
  | 'lift3' | 'lock' | 'gallery_n' | 'lobby' | 'admin' | 'office' | 'stair_w' | 'canteen' | 'atrium' | 'clinic'
  | 'quarters' | 'bio_lock' | 'kitchen' | 'ring_e' | 'feed_l2';

export interface RoomDef3 {
  name: string; x0: number; x1: number; z0: number; z1: number; y0: number; h: number;
  floors?: { y: number; box: [number, number, number, number] }[];
}

/**
 * §2.1. `kitchen` and `ring_e` are the plan's "non-room spaces" made real rooms (a husk spawns in each and must path
 * out through a door; nav v2 only has nodes in rooms). Their interiors (box inset 0.2) equal the plan's regions.
 * `feed_l2` is the hidden CAM 04 set (no portal: never drawn by the main view, never reached).
 */
export const ROOMS3: Record<RoomId3, RoomDef3> = {
  lift3: { name: '서비스 리프트', x0: -2, x1: 2, z0: 0, z1: 5, y0: D2, h: 3.0 },
  lock: { name: '압력 록', x0: -3, x1: 3, z0: -7, z1: 0, y0: D2, h: 3.4 },
  gallery_n: { name: '북쪽 갤러리', x0: -12, x1: 12, z0: -12, z1: -7, y0: D2, h: 3.2 },
  lobby: { name: '주거 로비', x0: -20, x1: -12, z0: -14, z1: -4, y0: D2, h: 3.6 },
  admin: { name: '시설팀 사무실', x0: -34, x1: -20, z0: -20, z1: -2, y0: D2, h: 3.2 },
  office: { name: '관리자 — 시설팀', x0: -34, x1: -26, z0: -28, z1: -20, y0: D2, h: 2.9 },
  // top landing (Deck 2) as an extra floor; ceiling 8.0 over the whole stairwell (3.2 above the top landing)
  stair_w: { name: '서쪽 계단', x0: -20, x1: -15, z0: -34, z1: -16, y0: 0, h: 8.0, floors: [{ y: D2, box: [-20, -15, -22, -16] }] },
  canteen: { name: '식당', x0: -24, x1: -12, z0: -46, z1: -34, y0: 0, h: 3.6 },
  atrium: {
    name: '정원 아트리움', x0: -12, x1: 12, z0: -44, z1: -12, y0: 0, h: 13.5,
    floors: [{ y: D2, box: [9, 12, -40, -12] }, { y: D2, box: [5.5, 12, -32, -29] }],
  },
  clinic: { name: '진료실', x0: 12, x1: 20, z0: -24, z1: -14, y0: 0, h: 3.0 },
  quarters: { name: '거주자 숙소 — 링 A', x0: 12, x1: 28, z0: -34, z1: -28, y0: 0, h: 3.0 },
  bio_lock: { name: '생물 시스템 — 외부 록', x0: 12, x1: 16, z0: -40, z1: -36, y0: D2, h: 3.0 },
  kitchen: { name: 'KITCHEN', x0: -24, x1: -18, z0: -48, z1: -46, y0: 0, h: 3.0 },
  ring_e: { name: '링 A — 동측', x0: 28, x1: 31.2, z0: -33.2, z1: -28.8, y0: 0, h: 3.0 },
  feed_l2: { name: '', x0: 60, x1: 72, z0: -10, z1: 0, y0: 0, h: 6.0 },
};
export const ROOM_IDS3 = Object.keys(ROOMS3) as RoomId3[];

/** Air (interior clear space) of a room: its box inset by half a wall, floor … floor + h. */
export function airOf(id: RoomId3): Box6 {
  const r = ROOMS3[id];
  return [r.x0 + HW, r.y0, r.z0 + HW, r.x1 - HW, r.y0 + r.h, r.z1 - HW];
}

// ───────────────────────────────────────────────────────────── the stairs (§2.1)

/**
 * 16 risers × 0.30, treads 0.5625 (28.07°). Visual steps are solid blocks from the floor (no colliders); walking is on
 * one slope collider through the tread midpoints (feet exactly on the treads), built `nav = false`; the mass under
 * the slope gets stepped colliders 0.15 m below the slope so nothing can get under the flight.
 * `dir` = +1: rises toward +z (west stair), −1: rises toward −z (feature stair). `z0` = foot of the first riser.
 */
export interface StairDef {
  room: RoomId3; x0: number; x1: number; z0: number; dir: 1 | -1; risers: number; rise: number; tread: number;
  /** Stage 3c §2.1 (S1m): y of the floor the flight starts from (default 0); the top lands at y0 + risers · rise. */
  y0?: number;
  /** Stage 3c (S1m): false = no `navStair` (enemies never use it: ship stairs to `nav: false` floors). Default true. */
  nav?: false;
}
export const STAIR_W: StairDef = { room: 'stair_w', x0: -19.8, x1: -15.2, z0: -31, dir: 1, risers: 16, rise: 0.3, tread: 0.5625 };
export const STAIR_ATR: StairDef = { room: 'atrium', x0: 5.5, x1: 8.5, z0: -20, dir: -1, risers: 16, rise: 0.3, tread: 0.5625 };
/** Slope line (bottom, top) of a stair — the navStair ends and the ramp collider. */
export function stairLine(s: StairDef): { a: [number, number, number]; b: [number, number, number] } {
  const cx = (s.x0 + s.x1) / 2, k = s.rise / s.tread, top = s.risers * s.rise, y0 = s.y0 ?? 0;
  const d0 = -(s.rise / 2) / k, d1 = (top - s.rise / 2) / k; // y = rise/2 + k·d through the tread midpoints
  return { a: [cx, y0, s.z0 + s.dir * d0], b: [cx, y0 + top, s.z0 + s.dir * d1] };
}

// ───────────────────────────────────────────────────────────── looks (greybox materials)

export interface Look { floor: Mat; wall: Mat; ceiling: Mat }
export function flatMat(L: LevelBuild, color: number, name: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.clone('painted_white', {
    color, map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: 0.88, metalness: 0, ...extra,
  });
  m.name = name;
  return m;
}

// ───────────────────────────────────────────────────────────── grid kernel

export type Box6 = [number, number, number, number, number, number];
/** A carved air label: the rooms that can see its faces (builder visibility) and whose look its faces wear. */
export interface AirDef { rooms: string[]; look: RoomId3 | 'reveal' }

const q = (v: number) => Math.round(v * 1000);

/**
 * Solid block minus air, as a cell grid over the union of every box's coordinates (mm). Ops apply in order
 * (later wins). Label 0 = solid, 1 = void (air nobody looks into: behind the viewports), ≥ 2 = room air.
 */
export class GreyGrid {
  private ops: { b: Box6; l: number }[] = [];
  private names: string[] = ['solid', 'void'];
  private defs: (AirDef | null)[] = [null, null];
  private ids = new Map<string, number>();
  stats = { cells: 0, quads: 0, colliders: 0, ms: 0 };

  constructor(envelope: Box6) { this.ops.push({ b: envelope, l: 0 }); }

  private label(name: string, def: AirDef): number {
    let id = this.ids.get(name);
    if (id === undefined) {
      if (this.names.length >= 255) throw new Error('[l3] grey grid: too many air labels');
      id = this.names.length;
      this.names.push(name); this.defs.push(def); this.ids.set(name, id);
    }
    return id;
  }
  /** Carve air seen from `def.rooms` (default: the room `name` itself). */
  air(name: string, b: Box6, def?: AirDef): this {
    this.ops.push({ b, l: this.label(name, def ?? { rooms: [name], look: name as RoomId3 }) });
    return this;
  }
  solid(b: Box6): this { this.ops.push({ b, l: 0 }); return this; }
  void(b: Box6): this { this.ops.push({ b, l: 1 }); return this; }

  /**
   * Emit faces + colliders. `look(room)` gives the materials of faces looking into that room's air (horizontal faces
   * facing up = floor, down = ceiling, vertical = wall). Builders are created per rooms-set (`grey:<rooms>`).
   */
  build(L: LevelBuild, look: (room: RoomId3 | 'reveal') => Look, surface: Surface = 'concrete'): void {
    const t0 = performance.now();
    const env = this.ops[0].b;
    const axis = (k0: number, k1: number) => {
      const s = new Set<number>();
      const lo = q(env[k0]), hi = q(env[k1]);
      for (const o of this.ops) for (const v of [q(o.b[k0]), q(o.b[k1])]) if (v >= lo && v <= hi) s.add(v);
      return [...s].sort((a, b) => a - b);
    };
    const X = axis(0, 3), Y = axis(1, 4), Z = axis(2, 5);
    const nx = X.length - 1, ny = Y.length - 1, nz = Z.length - 1;
    const ix = new Map(X.map((v, i) => [v, i])), iy = new Map(Y.map((v, i) => [v, i])), iz = new Map(Z.map((v, i) => [v, i]));
    const cells = new Uint8Array(nx * ny * nz);
    const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
    const clampIdx = (m: Map<number, number>, arr: number[], v: number) => m.get(Math.min(arr[arr.length - 1], Math.max(arr[0], q(v))))!;
    for (const o of this.ops) {
      const i0 = clampIdx(ix, X, o.b[0]), i1 = clampIdx(ix, X, o.b[3]);
      const j0 = clampIdx(iy, Y, o.b[1]), j1 = clampIdx(iy, Y, o.b[4]);
      const k0 = clampIdx(iz, Z, o.b[2]), k1 = clampIdx(iz, Z, o.b[5]);
      for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) { const base = nx * (j + ny * k); cells.fill(o.l, base + i0, base + i1); }
    }
    this.stats.cells = cells.length;
    const m = (v: number) => v / 1000;

    // ── faces: per axis-aligned boundary plane, greedy rectangles of one label ──
    const builders = new Map<string, Builder>();
    const builderOf = (def: AirDef) => {
      const key = [...new Set(def.rooms)].sort().join('+');
      let b = builders.get(key);
      if (!b) { b = L.builder(`grey:${key}`); b.rooms = [...new Set(def.rooms)]; builders.set(key, b); }
      return b;
    };
    const looks = new Map<string, Look>();
    const lookOf = (r: RoomId3 | 'reveal') => { let l = looks.get(r); if (!l) looks.set(r, (l = look(r))); return l; };
    // axis 0 = x (u = z, v = y), 1 = y (u = x, v = z), 2 = z (u = x, v = y)
    const dims = [nx, ny, nz], coords = [X, Y, Z];
    const cellAt = (a: number, c: number, u: number, v: number) => (a === 0 ? cells[at(c, v, u)] : a === 1 ? cells[at(u, c, v)] : cells[at(u, v, c)]);
    for (let a = 0; a < 3; a++) {
      const ua = a === 0 ? 2 : 0, va = a === 1 ? 2 : 1;
      const nu = dims[ua], nv = dims[va], U = coords[ua], Vv = coords[va], C = coords[a];
      const mask = new Int16Array(nu * nv);
      for (let c = 1; c < dims[a]; c++) {
        for (const dir of [1, -1]) {
          let any = false;
          for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
            const s = cellAt(a, dir > 0 ? c - 1 : c, u, v), r = cellAt(a, dir > 0 ? c : c - 1, u, v);
            const lab = s === 0 && r >= 2 ? r : -1;
            mask[u + nu * v] = lab;
            if (lab >= 0) any = true;
          }
          if (!any) continue;
          for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
            const lab = mask[u + nu * v];
            if (lab < 0) continue;
            let u1 = u + 1;
            while (u1 < nu && mask[u1 + nu * v] === lab) u1++;
            let v1 = v + 1;
            grow: while (v1 < nv) { for (let w = u; w < u1; w++) if (mask[w + nu * v1] !== lab) break grow; v1++; }
            for (let vv = v; vv < v1; vv++) for (let w = u; w < u1; w++) mask[w + nu * vv] = -1;
            const def = this.defs[lab]!;
            const lk = lookOf(def.look);
            const p = m(C[c]), u0m = m(U[u]), u1m = m(U[u1]), v0m = m(Vv[v]), v1m = m(Vv[v1]);
            const b = builderOf(def);
            const cu = (u0m + u1m) / 2, cv = (v0m + v1m) / 2, du = u1m - u0m, dv = v1m - v0m;
            if (a === 0) b.quad(lk.wall, p, cv, cu, du, dv, dir > 0 ? '+x' : '-x', 0, 'box');
            else if (a === 1) b.quad(dir > 0 ? lk.floor : lk.ceiling, cu, p, cv, du, dv, dir > 0 ? '+y' : '-y', 0, 'box');
            else b.quad(lk.wall, cu, cv, p, du, dv, dir > 0 ? '+z' : '-z', 0, 'box');
            this.stats.quads++;
          }
        }
      }
    }

    // ── colliders: greedy boxes of solid cells, kept where they touch room air ──
    const used = new Uint8Array(cells.length);
    const solidFree = (i: number, j: number, k: number) => cells[at(i, j, k)] === 0 && !used[at(i, j, k)];
    const cb = L.part('grey:colliders');
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!solidFree(i, j, k)) continue;
      let i1 = i + 1;
      while (i1 < nx && solidFree(i1, j, k)) i1++;
      let k1 = k + 1;
      growZ: while (k1 < nz) { for (let x = i; x < i1; x++) if (!solidFree(x, j, k1)) break growZ; k1++; }
      let j1 = j + 1;
      growY: while (j1 < ny) { for (let z = k; z < k1; z++) for (let x = i; x < i1; x++) if (!solidFree(x, j1, z)) break growY; j1++; }
      for (let z = k; z < k1; z++) for (let y = j; y < j1; y++) for (let x = i; x < i1; x++) used[at(x, y, z)] = 1;
      // touches room air on any side?
      let touch = false;
      const air = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz && cells[at(x, y, z)] >= 2;
      for (let z = k; z < k1 && !touch; z++) for (let y = j; y < j1 && !touch; y++) if (air(i - 1, y, z) || air(i1, y, z)) touch = true;
      for (let z = k; z < k1 && !touch; z++) for (let x = i; x < i1 && !touch; x++) if (air(x, j - 1, z) || air(x, j1, z)) touch = true;
      for (let y = j; y < j1 && !touch; y++) for (let x = i; x < i1 && !touch; x++) if (air(x, y, k - 1) || air(x, y, k1)) touch = true;
      if (!touch) continue;
      cb.collide(m(X[i]), m(Y[j]), m(Z[k]), m(X[i1]), m(Y[j1]), m(Z[k1]), surface, true);
      this.stats.colliders++;
    }
    this.stats.ms = performance.now() - t0;
  }
}

// ───────────────────────────────────────────────────────────── lights (§2.6) — one table per room

/** A placeholder light. `min` = LightDesc.minQuality (fill lights: 'medium' / 'high'); `off` = starts disabled. */
export interface LightRow {
  group: string; type: 'point' | 'spot'; p: [number, number, number]; t?: [number, number, number];
  color: number; i: number; d: number; angle?: number; cast?: boolean; min?: Quality; prio?: number; off?: boolean;
}
const WARM = 0xffd9b0, COLD = 0xc8e0ff, SKY = 0xbcd0ff, KEY = 0xffc58a;
export const LIGHTS3: Record<RoomId3, LightRow[]> = {
  lift3: [{ group: 'lift3', type: 'spot', p: [0, 7.6, 2.5], t: [0, D2, 2.5], color: 0xdfe8ff, i: 18, d: 6, angle: 1.1, cast: true }],
  lock: [
    { group: 'lock', type: 'spot', p: [0, 8.0, -5.6], t: [0, D2, -3.5], color: 0xf2f6ff, i: 22, d: 8, angle: 1.0, cast: true },
    { group: 'lock', type: 'point', p: [0, 7.8, -2.5], color: 0xf2f6ff, i: 8, d: 7, min: 'medium' },
  ],
  gallery_n: [
    { group: 'gallery_n', type: 'point', p: [-6, 7.6, -9.5], color: WARM, i: 12, d: 10 },
    { group: 'gallery_n', type: 'point', p: [2, 7.6, -9.5], color: WARM, i: 10, d: 9, min: 'medium' },
    { group: 'gallery_n', type: 'point', p: [9, 7.6, -9.5], color: WARM, i: 10, d: 9, min: 'medium' },
    { group: 'gallery_emerg', type: 'point', p: [0, 7.6, -9.5], color: COLD, i: 4, d: 14, off: true },
  ],
  lobby: [
    { group: 'lobby', type: 'point', p: [-16, 8.0, -9], color: WARM, i: 12, d: 10, prio: 0.5 },
    { group: 'lobby', type: 'spot', p: [-16, 6.6, -11.5], t: [-16, D2 + 0.9, -12.3], color: WARM, i: 8, d: 4, angle: 0.9, min: 'medium', prio: 0.5 },
    { group: 'lobby_emerg', type: 'point', p: [-16, 8.0, -9], color: COLD, i: 4, d: 10, off: true },
  ],
  admin: [
    { group: 'admin', type: 'point', p: [-30, 7.6, -7], color: WARM, i: 12, d: 10 },
    { group: 'admin', type: 'point', p: [-24, 7.6, -14], color: WARM, i: 12, d: 10 },
    { group: 'admin', type: 'point', p: [-24, 7.6, -6], color: WARM, i: 8, d: 8, min: 'medium' },
    { group: 'admin', type: 'point', p: [-30, 7.6, -16], color: WARM, i: 8, d: 8, min: 'medium' },
    { group: 'admin_emerg', type: 'point', p: [-30, 7.6, -10], color: COLD, i: 4.5, d: 11, off: true },
    { group: 'admin_emerg', type: 'point', p: [-24, 7.6, -16], color: COLD, i: 4.5, d: 11, off: true },
  ],
  office: [
    // Halvorsen's key light (banker's lamp, §4.3)
    { group: 'office', type: 'spot', p: [-31.6, 7.5, -23.4], t: [-32.6, 6.1, -24.2], color: 0xffc890, i: 14, d: 6, angle: 0.9, cast: true },
    { group: 'office', type: 'point', p: [-29, 7.4, -24], color: WARM, i: 6, d: 7 },
    { group: 'office_emerg', type: 'point', p: [-30, 7.4, -24], color: COLD, i: 2.5, d: 7, off: true },
  ],
  stair_w: [
    { group: 'stair_w', type: 'point', p: [-17.5, 7.6, -19], color: WARM, i: 10, d: 9 },
    { group: 'stair_w', type: 'point', p: [-17.5, 3.4, -32.5], color: WARM, i: 8, d: 8, min: 'medium' },
    { group: 'stair_w_emerg', type: 'point', p: [-17.5, 7.6, -25], color: COLD, i: 6, d: 16, off: true }, // (I1: 3 → 6: the flight read black)
  ],
  canteen: [
    { group: 'canteen', type: 'point', p: [-18, 3.3, -40], color: WARM, i: 12, d: 10, prio: 0.5 },
    { group: 'canteen', type: 'point', p: [-21.5, 3.3, -37], color: WARM, i: 8, d: 7, min: 'medium', prio: 0.5 },
    { group: 'canteen', type: 'point', p: [-15, 3.3, -43], color: WARM, i: 8, d: 7, min: 'medium', prio: 0.5 },
    { group: 'canteen_emerg', type: 'point', p: [-18, 3.3, -40], color: COLD, i: 3.5, d: 11, off: true }, // (I1: 3 → 3.5, reach 10 → 11)
    { group: 'canteen_emerg', type: 'point', p: [-14, 3.3, -36], color: COLD, i: 3, d: 8, min: 'medium', off: true },
  ],
  atrium: [
    { group: 'atrium_day', type: 'spot', p: [-4, 13.0, -19], t: [-4, 0, -22], color: KEY, i: 90, d: 22, angle: 0.75, cast: true },
    { group: 'atrium_day', type: 'spot', p: [4, 13.0, -37], t: [4, 0, -34], color: KEY, i: 90, d: 22, angle: 0.75, cast: true },
    { group: 'atrium_day', type: 'point', p: [-6, 8, -28], color: SKY, i: 24, d: 18 },
    { group: 'atrium_day', type: 'point', p: [6, 8, -22], color: SKY, i: 24, d: 18 },
    { group: 'atrium_day', type: 'point', p: [0, 6, -40], color: SKY, i: 14, d: 14, min: 'high' },
    { group: 'atrium_day', type: 'point', p: [0, 6, -16], color: SKY, i: 14, d: 14, min: 'high' },
    // (I1: after the takeover the garden read black beyond the torch: brighter, and one on the west wall)
    { group: 'atrium_emerg', type: 'point', p: [-8.0, 9.5, -26], color: COLD, i: 9, d: 22, off: true }, // (high, 4 m off the west wall: no hot spot)
    { group: 'atrium_emerg', type: 'point', p: [10.5, 7.0, -34], color: COLD, i: 8, d: 20, off: true },
    { group: 'atrium_emerg', type: 'point', p: [10.5, 3.5, -16], color: COLD, i: 5, d: 12, min: 'medium', off: true },
    { group: 'atrium_emerg', type: 'point', p: [-4, 3.5, -40], color: COLD, i: 5, d: 12, min: 'medium', off: true },
  ],
  clinic: [
    { group: 'clinic', type: 'point', p: [16, 2.8, -18], color: 0xf4f6ff, i: 10, d: 8 },
    { group: 'clinic', type: 'point', p: [16, 2.8, -22], color: 0xf4f6ff, i: 6, d: 6, min: 'medium' },
    { group: 'clinic_emerg', type: 'point', p: [16, 2.8, -19], color: COLD, i: 2.5, d: 8, off: true },
  ],
  quarters: [
    { group: 'quarters', type: 'point', p: [20, 2.8, -31], color: WARM, i: 10, d: 10 },
    { group: 'quarters', type: 'point', p: [14.5, 2.2, -31], color: WARM, i: 4, d: 5, min: 'medium' },
    { group: 'quarters', type: 'point', p: [25.5, 2.2, -31], color: WARM, i: 4, d: 5, min: 'medium' },
    // I1: the corridor had no emergency light — black after the takeover (breach 2 runs through it)
    { group: 'quarters_emerg', type: 'point', p: [20, 2.8, -31], color: COLD, i: 3, d: 11, off: true },
  ],
  bio_lock: [{ group: 'bio_lock', type: 'spot', p: [14, 7.6, -38], t: [14, D2, -38], color: 0xf4f8ff, i: 16, d: 6, angle: 1.1, cast: true, min: 'medium' }],
  kitchen: [],
  ring_e: [],
  feed_l2: [{ group: 'feed_l2', type: 'point', p: [66, 4.5, -5], color: 0xffb070, i: 10, d: 12, off: true }],
};

export function placeLights(L: LevelBuild, rows: LightRow[]): LightHandle[] {
  return rows.map((r) => {
    const h = r.type === 'spot'
      ? L.spot(r.group, r.p[0], r.p[1], r.p[2], r.t![0], r.t![1], r.t![2], r.color, r.i, r.d, r.angle ?? 0.9, { cast: !!r.cast, priority: r.prio, enabled: !r.off })
      : L.point(r.group, r.p[0], r.p[1], r.p[2], r.color, r.i, r.d, { cast: !!r.cast, priority: r.prio, enabled: !r.off });
    if (r.min) h.desc.minQuality = r.min; // §8.14 (honoured once render implements it, P2)
    return h;
  });
}

// ───────────────────────────────────────────────────────────── helpers

/** Box + collider (stand-in blocks the plan dimensions, glass, slabs outside the grid). */
export function block(b: Builder, mat: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: Surface | null = 'concrete', nav = true) {
  b.bx(mat, x0, y0, z0, x1, y1, z1);
  if (surface) b.collide(x0, y0, z0, x1, y1, z1, surface, nav);
}

/** Visual steps + slope collider + under-mass colliders + the top filler (see StairDef). */
export function buildStair(L: LevelBuild, b: Builder, s: StairDef, mat: Mat, glassSides: boolean) {
  const { x0, x1, z0, dir, risers, rise, tread } = s;
  const y0 = s.y0 ?? 0;
  const glass = L.ctx.materials.get('glass');
  for (let k = 0; k < risers; k++) {
    const za = z0 + dir * tread * k, zb = z0 + dir * tread * (k + 1), top = y0 + rise * (k + 1);
    b.bx(mat, x0, y0, Math.min(za, zb), x1, top, Math.max(za, zb));
    if (k > 0) b.collide(x0, y0, Math.min(za, zb), x1, y0 + rise * k, Math.max(za, zb), 'concrete', true);
    if (glassSides) for (const [ga, gb] of [[x0 + 0.02, x0 + 0.05], [x1 - 0.05, x1 - 0.02]] as const) {
      b.bx(glass, ga, top, Math.min(za, zb), gb, top + 1.1, Math.max(za, zb));
      b.bx('brass', ga - 0.01, top + 1.1, Math.min(za, zb), gb + 0.01, top + 1.14, Math.max(za, zb));
      // (stepped panels: neighbours share only an edge plane, opposite-facing)
      b.collide(ga, top, Math.min(za, zb), gb, top + 1.14, Math.max(za, zb), 'glass', true);
    }
  }
  const { a, b: e } = stairLine(s);
  const run = Math.abs(e[2] - a[2]), len = Math.hypot(run, e[1] - a[1]), ang = Math.atan2(e[1] - a[1], run);
  b.push((x0 + x1) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2, 0, dir > 0 ? -ang : ang);
  // (the slab runs 0.3 m on under the lower floor at its foot: a ray down at the foot node meets the slope, not its end cap)
  b.collide(-(x1 - x0) / 2, -0.2, -len / 2 - (dir > 0 ? 0.3 : 0), (x1 - x0) / 2, 0, len / 2 + (dir > 0 ? 0 : 0.3), 'concrete', false);
  b.pop();
  // filler between the slope's top end and the first collider of the upper floor (the top tread)
  const zt = z0 + dir * tread * risers;
  // (2 mm proud of the landing level and starting exactly at the slope's top end: a ray down at the top node meets its
  // flat top, never the slab's end cap; no ledge a husk could catch on)
  const zf = e[2];
  b.collide(x0, y0 + risers * rise - 0.3, Math.min(zf, zt + dir * 0.05), x1, y0 + risers * rise + 0.002, Math.max(zf, zt + dir * 0.05), 'concrete', false); // (2 mm proud: the ray meets it first)
  if (s.nav !== false) L.navStair(s.room, a, e, Math.min(2.6, x1 - x0 - 0.9));
}

/** Glass balustrade run (glass + brass rail, collider 1.45 m: NOT containment, §2.9 / D24). */
export function balustrade(L: LevelBuild, b: Builder, x0: number, z0: number, x1: number, z1: number, y = D2, h = 1.4) {
  b.bx(L.ctx.materials.get('glass'), x0, y, z0, x1, y + h, z1);
  // the rail is 1 cm wider than the glass across the run only (never longer: corners stay clean)
  const ex = x1 - x0 < 0.1 ? 0.01 : 0, ez = z1 - z0 < 0.1 ? 0.01 : 0;
  b.bx('brass', x0 - ex, y + h, z0 - ez, x1 + ex, y + h + 0.05, z1 + ez);
  b.collide(x0, y, z0, x1, y + h + 0.05, z1, 'glass', true);
}

/** Big wayfinding label on a wall face (greybox readability). `face` = the direction the sign looks. */
export function roomLabel(b: Builder, text: string, x: number, y: number, z: number, face: '+x' | '-x' | '+z' | '-z', w = 3.2) {
  const h = 0.42;
  b.sign(text, 'label', x, y, z, Math.max(w, 0.16 * text.length + 0.4), h, face, 0, true);
}

export { PI };

// ───────────────────────────────────────────────────────────── shells (one per room)

/** What a shell gets: the build, the grid it carves into, and its room's builder (culled with the room). */
export interface ShellCtx { L: LevelBuild; G: GreyGrid; b: Builder; standin: Mat; glass: Mat }
type Shell = (s: ShellCtx) => void;

const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

/**
 * A dynamic hatch panel closing a ceiling void (canteen H-A / H-B, the atrium roof hatch): mesh + physics box,
 * registered as `L.objects[id]`; vignette `vignette` drops it (canteen) or lifts it into the void (roof), then the box
 * goes away (the void is open). Decals on the panel are transient (the box has no owner).
 */
function hatchPanel(L: LevelBuild, id: string, vignette: string, x0: number, z0: number, x1: number, z1: number, y: number, mode: 'drop' | 'open', mat: Mat) {
  const part = L.part(`${id}:panel`);
  part.bx(mat, x0, 0, z0, x1, 0.06, z1);
  const g = part.build();
  g.position.y = y;
  g.name = id;
  L.root.add(g);
  L.objects.set(id, g);
  const pb = L.ctx.physics.addBox(box3(x0, y, z0, x1, y + 0.06, z1), 'metal');
  L.vignette(vignette, () => {
    pb.enabled = false;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    L.sfx('door_open', cx, y, cz, 0.7);
    if (mode === 'drop') L.tween(0, 0.55, (k) => { g.position.y = y - 3.4 * k * k; g.rotation.x = 0.5 * k; }, () => { g.visible = false; });
    else L.tween(0, 0.6, (k) => { g.position.y = y + 0.9 * k; }, () => { g.visible = false; });
  });
}

export const SHELLS3: Record<RoomId3, Shell> = {
  lift3: ({ L, G, b }) => {
    G.air('lift3', airOf('lift3'));
    roomLabel(b, '서비스 리프트', 1.8, 7.2, 2.6, '-x', 2.4);
    L.screen('lift3_panel', 'terminal_idle', 0.5, 0.3, 1.795, D2 + 1.5, 1.4, '-x', { text: '주거 링' });
    L.marker('lift3_spawn', 0, D2, 3.2, 0);
  },

  lock: ({ L, G, b, standin }) => {
    G.air('lock', airOf('lock'));
    // the pressure door's sinking bottom leaf: a solid pit in the Deck-2 structure (§2.1 / §8.9; deeper than the
    // plan's 3.0 so the sunk leaf, bottom at 2.9, never enters the pit floor)
    G.air('pit:d3_pressure', [-1.7, 2.8, -7.3, 1.7, D2, -6.7], { rooms: ['lock', 'gallery_n'], look: 'reveal' });
    // walking surface over the pit slot (invisible; the door's threshold plate covers it visually)
    L.part('lock:threshold').collide(-1.7, D2 - 0.02, -7.3, 1.7, D2, -6.7, 'metal', false);
    roomLabel(b, '압력 록', -2.8, D2 + 2.6, -3.4, '+x', 2.6);
    // two benches (stand-ins: the medkit sits on the west one)
    block(b, standin, -2.8, D2, -4.2, -2.1, D2 + 0.45, -1.8);
    block(b, standin, 2.1, D2, -4.2, 2.8, D2 + 0.45, -1.8);
    L.screen('pdoor_panel', 'pressure', 0.5, 0.32, 2.3, D2 + 1.55, -6.795, '+z', { text: '시험|10:00:00' });
    L.marker('lock_eye_release', 0, D2 + 1.65, -3.5, 0);
    // the three C2 puppets wait here (sealed) in single file, facing the door
    for (const [i, z] of [-5.6, -4.2, -2.8].entries()) L.marker(`puppet_lock_${i + 1}`, 0, D2, z, 0);
  },

  gallery_n: ({ L, G, b, glass }) => {
    G.air('gallery_n', airOf('gallery_n'));
    // south face z = −12: glass full height x −11.8 … 6; solid x 6 … 9.2 (shutter pocket); shutter opening 9.2 … 11.8
    G.air('glz:gallery', [-11.8, D2, -12.2, 6, D2 + 3.2, -11.8], { rooms: ['gallery_n', 'atrium'], look: 'gallery_n' });
    block(b, glass, -11.8, D2, -12.015, 6, D2 + 3.2, -11.985, 'glass', true);
    roomLabel(b, '북쪽 갤러리', -7.5, D2 + 2.5, -7.2, '-z', 3.0);
    roomLabel(b, '생물 시스템 →', 7.6, D2 + 2.1, -7.2, '-z', 3.4);
    L.screen('pdoor_panel_out', 'pressure', 0.5, 0.32, -2.3, D2 + 1.55, -7.205, '-z', { text: '시험|10:00:00' });
    // CAM 01 (§8.4): high in the gallery's south side, the glazing (and the atrium) behind it; the pressure door at
    // ≈ 25° off its axis, 5 m away, the units' walk west to the lobby door going away from it (I1: was (9, 7.5,
    // −11.5), grazing the door from 10 m — the units read as specks)
    L.marker('cam01', 1.8, 7.6, -11.6, 0);
    L.marker('cam01_look', -1.6, 5.7, -7.4, 0);
    // C2 puppet walk (§4.3): out of the lock, west along the gallery, into the lobby
    L.marker('puppet_path_0', 0, D2, -8.6, PI / 2);
    L.marker('puppet_path_1', -11.0, D2, -9.5, PI / 2);
    // C1 (I1: he comes to meet the player in the gallery): the nominal body / eye a few steps out of the lock, facing
    // west down the gallery (the story clamps the real body x to −7.5 … −1 from where the player is); Halvorsen's start
    // just inside the lobby's glass door, where he stops (`halv_c1_meet`, ≈ 4 m short of the body), his walk back
    L.marker('c1_body', -2.0, D2, -9.4, PI / 2);
    L.marker('c1_eye', -2.0, D2 + 1.65, -9.4, PI / 2);
    L.marker('c1_look', -8.0, 6.35, -9.45, 0);
    L.marker('c1_dolly', -4.4, D2 + 1.65, -9.4, PI / 2);
    L.marker('halv_h1', -13.4, D2, -9.5, -PI / 2);
    L.marker('halv_c1_meet', -6.2, D2, -9.45, -PI / 2);
    L.marker('halv_c1_walk', -15.2, D2, -9.3, PI / 2);
  },

  lobby: ({ L, G, b }) => {
    G.air('lobby', airOf('lobby'));
    roomLabel(b, '주거 로비', -19.8, D2 + 2.6, -12.4, '+x', 2.6);
    L.screen('lobby_status', 'habitat_status', 1.6, 0.9, -17.4, D2 + 1.85, -4.205, '-z', { text: '주거 링 A' });
    L.interact('term3_lobby', 'terminal', '화면 읽기', -14.6, 5.9, -4.5);
    L.interact('note3_guestbook', 'log', '책 읽기', -16.0, D2 + 1.05, -12.0);
    L.interact('note3_board', 'log', '공지 읽기', -18.0, D2 + 1.5, -13.77);
    // the puppets' end marks at the inner door (C2)
    for (const [i, [x, z]] of ([[-18.6, -8.2], [-18.4, -9.8], [-17.2, -9.0]] as const).entries()) L.marker(`puppet_end_${i + 1}`, x, D2, z, PI / 2);
  },

  admin: ({ L, G, b, glass }) => {
    G.air('admin', airOf('admin'));
    roomLabel(b, '시설팀 사무실', -27, D2 + 2.4, -2.2, '-z', 3.2);
    // glass partitions 1.8 m (§2.9: not containment, crouch-jumpable; nothing behind them is forbidden)
    block(b, glass, -28.015, D2, -14.0, -27.985, D2 + 1.8, -8.0, 'glass', true);
    block(b, glass, -33.8, D2, -11.015, -30.0, D2 + 1.8, -10.985, 'glass', true);
    for (let i = 0; i < 8; i++) L.screen(`admin_screen_${i + 1}`, 'terminal_idle', 0.5, 0.3, -33.795, D2 + 1.4, -4 - 2 * i, '+x', { text: '시설팀' });
    L.interact('note3_desk', 'log', '출력물 읽기', -27.4, 5.6, -5.2);
    // the radio behind the inner door (§2.5)
    L.marker('radio_admin', -22, 5.8, -8, 0);
    L.marker('stores_cage', -22.6, D2, -15.0, 0);
  },

  office: ({ L, G, b, standin }) => {
    G.air('office', airOf('office'));
    roomLabel(b, '관리자 — 시설팀', -26.2, D2 + 2.0, -25.4, '-x', 3.2);
    // §4.3 desk (stand-in): x −31.8 … −30.6, z −25.6 … −22.8, top 5.56
    block(b, standin, -31.8, D2, -25.6, -30.6, 5.56, -22.8);
    // the monitor on its swivel arm (C2 turns it): the screen hangs on the arm object
    const arm = new THREE.Object3D();
    arm.name = 'office_monitor_arm';
    arm.position.set(-31.0, 5.88, -23.6);
    L.root.add(arm);
    L.objects.set('office_monitor_arm', arm);
    L.screen('office_monitor', 'feed', 0.55, 0.33, 0, 0, 0, '-x', { parent: arm });
    for (const [i, z] of [-25.4, -24.2, -23.0].entries()) L.screen(`office_thumb_${i + 1}`, 'camera_feed', 0.6, 0.36, -33.795, 6.5, z, '+x');
    // readables (schedule board 3 cm off the north wall's office face z −20.2; the plan's −20.02 is inside the wall)
    L.interact('note3_schedule', 'log', '게시판 읽기', -32.6, 6.2, -20.23);
    L.interact('note3_pad', 'log', '수첩 읽기', -31.2, 5.57, -24.4);
    L.interact('note3_memo', 'log', '메모 읽기', -31.25, 5.57, -23.0);
    // §4.3 marks
    L.marker('halv_h2', -32.6, D2, -24.2, -PI / 2);
    L.marker('office_chair', -29.5, D2, -24.2, PI / 2);
    L.marker('office_phone', -31.3, 5.57, -25.3, 0);
    L.marker('office_badge', -30.75, 5.57, -23.9, 0);
    L.marker('office_speaker', -30.5, 7.62, -22.6, 0);
    L.marker('office_lamp', -31.6, 7.5, -23.4, 0);
    L.marker('c2_eye', -29.5, 6.0, -24.2, PI / 2);
    L.marker('c2_end', -29.4, D2, -23.6, 3.02);
    // Halvorsen's seated body collider (§2.9, D23): the story / enemies build the dynamic box from this
    const hb = L.marker('halv_body_box', -32.6, D2, -24.2, 0);
    hb.userData.box = [-33.2, D2, -24.8, -32.0, 6.2, -23.6];
  },

  stair_w: ({ L, G, b, standin }) => {
    G.air('stair_w', airOf('stair_w'));
    // top landing (Deck 2) on solid structure; the flight rises north from the bottom landing
    G.solid([-20, -0.6, -22, -15, D2, -16]);
    buildStair(L, b, STAIR_W, standin, false);
    roomLabel(b, '서쪽 계단', -19.8, D2 + 2.2, -21.0, '+x', 2.4);
    roomLabel(b, '서쪽 계단 — 식당', -19.8, 2.4, -32.6, '+x', 2.6);
  },

  canteen: ({ L, G, b, glass, standin }) => {
    G.air('canteen', airOf('canteen'));
    // east face x = −12: glazed except d3_canteen_atr and its piers (z −41.5 … −40.2, −37.8 … −36.5)
    G.air('glz:canteen', [-12.2, 0, -43.8, -11.8, 3.6, -41.5], { rooms: ['canteen', 'atrium'], look: 'canteen' });
    G.air('glz:canteen', [-12.2, 0, -36.5, -11.8, 3.6, -34.2]);
    block(b, glass, -12.015, 0, -43.8, -11.985, 3.6, -41.5, 'glass', true);
    block(b, glass, -12.015, 0, -36.5, -11.985, 3.6, -34.2, 'glass', true);
    // small viewport, west wall x = −24, z −42 … −37, y 0.8 … 3.0 (black water behind: a void nobody looks into)
    G.air('glz:canteen', [-24.2, 0.8, -42, -23.8, 3.0, -37]);
    G.void([-30, 0.8, -42, -24.2, 3.0, -37]);
    block(b, glass, -24.015, 0.8, -42, -23.985, 3.0, -37, 'glass', true);
    // servery counter x −22.8 … −12.6, z −44.2 … −43.4 (aisle behind it z −46 … −44.2, west gap x −24 … −22.8)
    block(b, standin, -22.8, 0, -44.2, -12.6, 0.9, -43.4);
    for (const x of [-22, -21, -19.5, -18, -16.5, -15, -13.5]) L.navNode(x, -45.0, 'canteen');
    for (const z of [-45.0, -43.8, -42.6]) L.navNode(-23.3, z, 'canteen');
    // ceiling hatches H-A / H-B (1.2 × 1.2) with their voids (y 3.6 … 6.0)
    G.air('canteen', [-18.6, 3.6, -41.6, -17.4, 6.0, -40.4]);
    G.air('canteen', [-15.1, 3.6, -38.1, -13.9, 6.0, -36.9]);
    hatchPanel(L, 'canteen_hatch_a', 'canteen_hatch_a', -18.6, -41.6, -17.4, -40.4, 3.6, 'drop', standin);
    hatchPanel(L, 'canteen_hatch_b', 'canteen_hatch_b', -15.1, -38.1, -13.9, -36.9, 3.6, 'drop', standin);
    roomLabel(b, '식당', -23.8, 2.7, -35.6, '+x', 2.0);
    L.screen('canteen_menu', 'terminal_idle', 1.2, 0.7, -14.5, 2.5, -34.205, '-z', { text: '오늘 — 생선 수프 / 렌틸 커리' });
    L.interact('note3_canteen', 'log', '공지 읽기', -22.0, 1.6, -34.23);
    L.interact('note3_quiz', 'log', '포스터 읽기', -20.9, 1.6, -34.23);
    L.marker('canteen_hatch_a_drop', -18, 4.0, -41, 0);
    L.marker('canteen_hatch_b_drop', -14.5, 4.0, -37.5, 0);
    L.marker('kitchen_spawn', -21, 0, -47.0, 0);
    L.marker('canteen_radio', -19.5, 0.95, -43.8, 0);
  },

  atrium: ({ L, G, b, glass, standin }) => {
    G.air('atrium', airOf('atrium'));
    // east balcony (x 9 … 12, z −40 … −12) + stair landing (x 5.5 … 12, z −32 … −29): slab top 4.8, soffit 4.5
    G.solid([9, D2 - 0.3, -40, 11.8, D2, -12.2]);
    G.solid([5.5, D2 - 0.3, -32, 11.8, D2, -29]);
    // sea viewport z = −44, x −8 … 8, y 0.6 … 9.6
    G.air('atrium', [-8, 0.6, -44.2, 8, 9.6, -43.8]);
    G.void([-8, 0.6, -52, 8, 9.6, -44.2]);
    block(b, glass, -8, 0.6, -44.015, 8, 9.6, -43.985, 'glass', true);
    // roof hatch (0, 13.5, −30): void up to 15 (the sentry's spawn), panel in the ceiling
    G.air('atrium', [-0.7, 13.5, -30.7, 0.7, 15, -29.3]);
    hatchPanel(L, 'atr_roof_hatch_panel', 'atr_roof_hatch', -0.7, -30.7, 0.7, -29.3, 13.5, 'open', standin);
    // feature stair x 5.5 … 8.5, bottom z −20 (y 0) → top z −29 (y 4.8); glass sides 1.1 m (not containment)
    buildStair(L, b, STAIR_ATR, standin, true);
    // balustrades 1.4 m glass (§2.9: NOT containment; no invisible extension)
    balustrade(L, b, 9.02, -29.0, 9.05, -12.2);           // balcony edge x = 9, north part
    balustrade(L, b, 9.02, -39.95, 9.05, -32.0);          // balcony edge x = 9, south part
    balustrade(L, b, 9.05, -39.98, 11.8, -39.95);         // balcony south end z = −40 (added: the alcove's open end)
    balustrade(L, b, 5.52, -31.98, 5.55, -29.0);          // landing x = 5.5
    balustrade(L, b, 5.55, -31.98, 9.02, -31.95);         // landing z = −32
    balustrade(L, b, 8.48, -29.03, 9.02, -29.0);          // landing z = −29 between the stair and the balcony
    roomLabel(b, '정원 아트리움', 0, 3.2, -12.2, '-z', 3.6);
    roomLabel(b, '발코니 — 생물 시스템', 11.8, D2 + 2.6, -30.5, '-x', 4.2);
    L.interact('sign3_viewport', 'log', '명판 읽기', 0, 0.9, -43.6);
    L.interact('sign3_bio', 'log', '표지 읽기', 11.78, 6.3, -36.4);
    L.interact('bio_reader', 'reader', '배지 리더', 11.78, 5.95, -39.5);
    L.screen('bio_reader', 'badge', 0.16, 0.22, 11.795, 5.95, -39.5, '-x');
    L.marker('roof_hatch', 0, 13.5, -30, 0);
    L.marker('trunk_beacon', 1.5, 5.2, -62, 0);
  },

  clinic: ({ L, G, b }) => {
    G.air('clinic', airOf('clinic'));
    roomLabel(b, '진료실', 19.8, 2.2, -19.0, '-x', 2.0);
    L.screen('clinic_monitor', 'vitals', 0.5, 0.3, 16.4, 1.35, -23.795, '+z');
    L.interact('note3_clinic_post4', 'log', '클립보드 읽기', 14.8, 0.95, -23.3);
    L.interact('note3_clinic_reyes', 'log', '출력물 읽기', 15.6, 0.95, -23.3);
  },

  quarters: ({ L, G, b }) => {
    G.air('quarters', airOf('quarters'));
    // cabins: the 0.5 m reveals behind the six cabin doors (never open; region `cabins`)
    for (const x of [15, 19, 23]) {
      G.air('cabins', [x - 0.8, 0, -27.8, x + 0.8, 2.4, -27.3], { rooms: ['quarters'], look: 'reveal' });
      G.air('cabins', [x - 0.8, 0, -34.7, x + 0.8, 2.4, -34.2]);
    }
    roomLabel(b, '숙소 — 링 A', 25.95, 2.45, -33.8, '+z', 3.0); // (between d3_q6's jamb, x 24.1, and the east wall)
    L.interact('note3_door', 'log', '쪽지 읽기', 23.35, 1.45, -28.09);
  },

  bio_lock: ({ L, G, b }) => {
    G.air('bio_lock', airOf('bio_lock'));
    roomLabel(b, '생물 시스템 — 외부 록', 14, D2 + 2.3, -39.8, '+z', 3.4);
    L.screen('bio_panel', 'terminal_idle', 0.5, 0.3, 15.795, D2 + 1.5, -36.7, '-x', { text: '제염 — 대기 중' });
  },

  kitchen: ({ L, G }) => {
    G.air('kitchen', airOf('kitchen'));
    L.navNode(-21, -47.0, 'kitchen'); // (1.6 m deep: its grid nodes sit too close to the walls)
  },

  ring_e: ({ G }) => { G.air('ring_e', airOf('ring_e')); },

  feed_l2: ({ L, G, b, standin }) => {
    G.air('feed_l2', airOf('feed_l2'));
    // CAM 04 diorama (greybox): 12 m of apron, the belt, the hook rail
    block(b, standin, 60.6, 0, -7.6, 71.4, 0.55, -6.6);
    b.bx(standin, 60.2, 4.2, -7.15, 71.8, 4.32, -7.05);
    for (let i = 0; i < 8; i++) L.marker(`feed_l2_unit_${i + 1}`, 61.8 + 1.2 * i, 0, -5.0, PI);
    L.marker('feed_l2_walk_a', 60.8, 0, -3.0, -PI / 2);
    L.marker('feed_l2_walk_b', 71.2, 0, -3.0, -PI / 2);
    // CAM 04: low and close, the eight units across the frame (I1: was (66, 3.5, −1) → (66, 1, −8): small at the bottom)
    L.marker('cam04', 66, 2.4, -0.4, 0);
    L.marker('cam04_look', 66, 1.1, -6.0, 0);
  },
};
