/**
 * COLD BOOT — level 6 "간선" (stage 3d, docs/plans/stage-3d.md §2–§3, §5.1–§5.4, §8.5, §8.11; task W4a greybox).
 *
 * Final coordinates, no dressing. Files:
 *   grey.ts    rooms (§2.1), one shell per room (structure, the trench + the under-wall crossing, the shaft's landings,
 *              flights and closed well, the chamber's decks / wet dock / well / coaming + 2.4 m guards / cage / stairs /
 *              windows, stand-ins, screens, interactables, markers), lights (§2.7), greybox placeholders for every
 *              set-piece object / vignette (+ `:snap`) / machine that other tasks own
 *   phases.ts  regions, the phase table A … K_end (+ variants, nostory) with reach-check data, latches
 *   cover.ts   the 75 cover points (§5.4) as `level.cover` + their self-test
 *   index.ts   doors (§2.2), triggers (§2.3), portals (§2.7.4), pickups (§5.2), enemy spawns (§5.1), nav cases (§10.3),
 *              marker / screen / interactable / vignette lists, self-test
 *   water.ts / dock.ts (W4b)  `Level.water` (+ the ray-only surfaces) and `Level.dock` (slots, containers)
 *
 * Dressing tasks export a `Partial<Record<RoomId6, RoomDress>>` from their file and are listed in `DRESSING`:
 *   tunnels.ts (D1)  lock6, tun6_a, rep6, bay6, tun6_b     headend.ts (D2)  he6     vault.ts (D2)  vault6, hold6
 *   pool.ts (D3a)    pool6 (structure look, lights)        shaft.ts (D3b)   shaft6
 *   dockdress.ts (D3b)  pool6 (dressing), stores6, feed6
 */
import * as THREE from 'three';
import type { GameContext, Level } from '../../core/types';
import { LevelBuild, roomFloor } from '../context';
import type { DoorImpl, DoorSpec } from '../doors';
import { defineInstances } from '../props';
import { assembleLevel, buildRooms, type PortalSpec } from '../assemble';
import type { TriggerSpec } from '../triggers';
import type { Builder } from '../builder';
import { GreyGrid, flatMat, type Look } from '../l3/grey';
import {
  ENVELOPE6, EXIT_HE, EXIT_VAULT, LIGHTS6, PANE6, PIT_HE6, PIT_VAULT6, ROOMS6, ROOM_IDS6, SHAFT_WELL6, SHELLS6,
  lidK, placeLights6, placeholders6, type LightRow6, type RoomId6,
} from './grey';
import { REGIONS6, T6_CAGE, T6_CONSOLE, applyPhaseTo6, installPhases6, type PhaseId6 } from './phases';
import { makeCover6, selfTestCover6 } from './cover';
import { NAV_CASES6, buildWater6 } from './water';
import { moveOnlyColliders6 as kitMoveOnly6 } from './kit6';
import { moveOnlyColliders6 as pieceMoveOnly6 } from './setpieces6';
import { buildDock6 } from './dock';
import { TUNNELS_DRESS } from './tunnels';
import { HEADEND_DRESS } from './headend';
import { VAULT_DRESS } from './vault';
import { POOL_DRESS } from './pool';
import { SHAFT_DRESS } from './shaft';
import { DOCK_DRESS } from './dockdress';

const PI = Math.PI;

// ───────────────────────────────────────────────────────────── dressing hook-up

/** What a dressing file may give a room (same contract as levels 3–5; see grey.ts header and tunnels.ts). */
export interface RoomDress {
  /** Extra geometry / props / screens / vignettes, run after the room's shell inside its build pass (culled with the room). */
  build?(L: LevelBuild): void;
  /** Replaces the room's placeholder light table (`LIGHTS6[room]`); keep the §2.7 group names (and the floor bounds, S5). */
  lights?: LightRow6[];
  /** Materials of the shell faces looking into this room. */
  look?: Partial<Look>;
  /** false = no big greybox wayfinding label (the shell's `roomLabel`s are skipped). */
  label?: boolean;
}
/** Dressing tables in order: `build`s of two files dressing one room both run (in this order); other fields: later wins. */
const DRESSING: Partial<Record<RoomId6, RoomDress>>[] = [TUNNELS_DRESS, HEADEND_DRESS, VAULT_DRESS, POOL_DRESS, SHAFT_DRESS, DOCK_DRESS];

function mergeDress(): Partial<Record<RoomId6, RoomDress>> {
  const out: Partial<Record<RoomId6, RoomDress>> = {};
  for (const t of DRESSING) for (const [k, v] of Object.entries(t) as [RoomId6, RoomDress][]) {
    const was = out[k];
    const b0 = was?.build, b1 = v.build;
    out[k] = { ...was, ...v, ...(b0 && b1 ? { build: (L: LevelBuild) => { b0(L); b1(L); } } : {}) };
  }
  return out;
}

// ───────────────────────────────────────────────────────────── doors (§2.2)

/** A porthole glow in a leaf (§2.8: the warm glow only — `d6_he` backlights F3, `d6_pool` the chamber's light). */
const porthole = (b: Builder, side: -1 | 1) => { if (side > 0) b.bx('emissive_warm', 0.22, 1.45, -0.074, 0.52, 1.75, 0.074); };

/** Labels name the room on the other side (front = seen from +z / +x). */
export function doors6(): DoorSpec[] {
  const nv = { frameStyle: 'navy' as const, leafMat: 'navy_grey' as const, signStyle: 'navy' as const };
  const pr = { frameStyle: 'industrial' as const, leafMat: 'navy_grey' as const };
  const z = (id: string, x: number, y: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x, y, z: zz, wall: 'z', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...nv, ...o });
  const x = (id: string, xx: number, y: number, zz: number, front: string, back: string, rooms: [string, string], o: Partial<DoorSpec> = {}): DoorSpec =>
    ({ id, x: xx, y, z: zz, wall: 'x', kind: 'std', locked: true, labelFront: front, labelBack: back, rooms, ...nv, ...o });
  return [
    z('d6_tube', 0, 0, 0, '헤드엔드 튜브', '트렁크 터널', ['lock6', 'tun6_a'], { ...pr, cyclingPrompt: '튜브 순환 중' }),
    x('d6_bay', 14.5, 0, -102, '케이블 터널', '조인트 베이 2', ['tun6_b', 'bay6'], { auto: false }),
    z('d6_he', 12, 0, -160, '트렁크 헤드엔드', '케이블 터널', ['tun6_b', 'he6'], { leafDetail: porthole }),
    x('d6_vault', 2, 0, -168, '케이블 볼트 — 건조 유지', '트렁크 헤드엔드', ['he6', 'vault6']),
    z('d6_hold', -14, 0, -148, '케이블 볼트', '케이블 저장고', ['vault6', 'hold6'], { auto: false }),
    x('d6_shaft', -22, 0, -169.8, '문풀 출입', '케이블 볼트', ['vault6', 'shaft6'], { ...pr }),
    x('d6_pool', -28, -12, -169.8, '문풀', '계단실', ['shaft6', 'pool6'], { ...pr, leafDetail: porthole }),
    z('d6_stores', -70, -12, -148, '문풀', '도크 저장고', ['pool6', 'stores6'], { auto: false }),
  ];
}

const HW = 0.2;
/** Carve a door's opening through its 0.4 m wall and (std) the slots its leaves slide into (as levels 3–5). */
function carveDoor(G: GreyGrid, s: DoorSpec) {
  const std = s.kind === 'std';
  const w = std ? s.w ?? 1.6 : 3.0, h = std ? s.h ?? 2.4 : 2.8, y = s.y ?? 0;
  const def = { rooms: [...new Set(s.rooms)], look: 'reveal' as const };
  const put = (u0: number, u1: number, y0: number, y1: number, v0: number, v1: number) => {
    G.air(`door:${s.id}`, s.wall === 'z' ? [s.x + u0, y0, s.z + v0, s.x + u1, y1, s.z + v1] : [s.x + v0, y0, s.z + u0, s.x + v1, y1, s.z + u1], def);
  };
  put(-w / 2, w / 2, y, y + h, -HW, HW);
  if (!std) return;
  const end = w + 0.075;
  put(-end, -w / 2, y, y + h, -0.07, 0.07);
  put(w / 2, end, y, y + h, -0.07, 0.07);
}

// ───────────────────────────────────────────────────────────── triggers (§2.3)

const T = (id: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): TriggerSpec => ({ id, x0, x1, z0, z1, y0, y1 });
const TB = (id: string, b: readonly number[]): TriggerSpec => T(id, b[0], b[3], b[2], b[5], b[1], b[4]);
export const TRIGGERS6: TriggerSpec[] = [
  T('t6_lock', -3.8, 3.8, 0.2, 5.8, -1, 3),
  T('t6_tube', -2.3, 2.3, -8.0, -1.0, -1, 3),
  T('t6_tun_mid', -2.3, 2.3, -26.0, -18.0, -1, 3),
  T('t6_tun_end', -2.3, 2.3, -79.8, -70.0, -1, 3),
  T('t6_rep', -5.8, 15.8, -91.8, -80.2, -1, 4),
  T('t6_rep_in', -5.8, 15.8, -91.8, -81.5, -1, 4),
  T('t6_tunb', 9.7, 14.3, -159.8, -92.2, -1, 3),
  T('t6_tunb_dark', 9.7, 14.3, -159.8, -96.0, -1, 3),
  T('t6_tunb_sentry', 9.7, 14.3, -132.0, -124.0, -1, 3),
  T('t6_bay', 14.7, 20.3, -105.8, -98.2, -1, 3),
  T('t6_he', 2.2, 21.8, -179.8, -160.2, -0.5, 3),
  T('t6_phone', 18.8, 21.8, -166.5, -161.5, -0.5, 3),
  T('t6_vault', -21.8, 1.8, -179.8, -148.2, -0.5, 5),
  T('t6_trench', -13.0, 3.6, -179.4, -158.0, -1.6, -0.2),
  T('t6_hatch_v', -13.6, -11.2, -158.0, -156.4, -0.5, 3),
  T('t6_shaft', -27.8, -22.2, -171.8, -162.2, -12.5, 3),
  T('t6_shaft_l1', -27.8, -22.2, -171.8, -162.2, -12.5, -2.5),
  T('t6_shaft_bot', -27.8, -22.2, -171.8, -162.2, -12.5, -10.0),
  T('t6_reveal', -31.2, -28.2, -172.0, -167.0, -12.5, -9.0),
  T('t6_floor', -75.8, -28.2, -195.8, -148.2, -21.6, -13.5),
  TB('t6_cage', T6_CAGE),
  T('t6_wet', -66.0, -38.0, -194.0, -182.4, -21.6, -19.5),
  T('t6_windows', -66.0, -38.0, -195.8, -190.0, -21.6, -19.0),
  TB('t6_console', T6_CONSOLE),
];

// ───────────────────────────────────────────────────────────── visibility (portals, §2.7.4)

/**
 * Doors are `false` (drawn only through the open door) except: `d6_he` (porthole: 1 m), and `d6_vault` drawn within 12 m
 * when shut — the trench crosses under the he6 / vault6 wall 10.8 m south of it (as 3c drew the crawl turn under
 * `d5_arm` within 6.5 m of that door). The tunnels' open frames are permanent (null).
 */
const PORTALS6: PortalSpec[] = [
  ['lock6', 'tun6_a', 'd6_tube', false],
  ['tun6_a', 'rep6', null, 85],
  ['rep6', 'tun6_b', null, 70],
  ['tun6_b', 'bay6', 'd6_bay', false],
  ['tun6_b', 'he6', 'd6_he', 1],
  ['he6', 'vault6', 'd6_vault', 12],
  ['vault6', 'hold6', 'd6_hold', false],
  ['vault6', 'shaft6', 'd6_shaft', false],
  ['shaft6', 'pool6', 'd6_pool', false],
  ['pool6', 'stores6', 'd6_stores', false],
];
/**
 * Screen-space portal culling on top of the graph (IB6): the open frames, the trench's under-wall crossing and the
 * `d6_he` porthole (a 0.3 m pane in a leaf: the door's width at its height) are the non-door openings; doors pass only
 * while open. From tun6_a the graph reaches tun6_b through rep6, but tun6_b's mouth (x 9.7 … 14.3 at z −92) is out of
 * line with tun6_a's (x ±2.3 at z −80) from anywhere north of z ≈ −72, so tun6_b (its dressing, pickups, lights) and
 * the rooms behind it are drawn only from near the tunnel's end.
 */
const OPENINGS6: Opening6[] = [
  { a: 'tun6_a', b: 'rep6', wall: 'z', at: -80, u0: -2.3, u1: 2.3, y0: 0, y1: 4.0 },
  { a: 'rep6', b: 'tun6_b', wall: 'z', at: -92, u0: 9.7, u1: 14.3, y0: 0, y1: 4.0 },
  // the crossing under the he6 / vault6 wall is seen only from the trench or from over its gratings near the wall (from
  // anywhere else in either room it sits below the floor — portal culling is not occlusion, so it is gated by distance)
  { a: 'he6', b: 'vault6', wall: 'x', at: 2.0, u0: -179.4, u1: -178.2, y0: -1.4, y1: -0.05, near: { x: 2.0, z: -178.8, r: 6.0 } },
  { a: 'tun6_b', b: 'he6', wall: 'z', at: -160, u0: 11.2, u1: 12.8, y0: 1.45, y1: 1.75 },
];

/** A see-through opening between two rooms that is not a door: world rectangle in a wall plane. */
interface Opening6 {
  a: string; b: string; wall: 'x' | 'z'; at: number; u0: number; u1: number; y0: number; y1: number;
  /** Counted only with the eye below the floor (y < −0.2) or within `r` m (plan) of (x, z). */
  near?: { x: number; z: number; r: number };
}

/**
 * Level 6's view culling on top of the level's portal graph — a COPY of level 4's `installPortalCull4` (kit4.ts; rule 9:
 * copied, not shared) with one change: level 4 widens every portal's screen rectangle by 0.12 NDC, which compounds over
 * a chain of distant openings (tun6_a → rep6 → tun6_b: both mouths ~80–90 m away are a few hundredths of the screen
 * wide, so that margin passed tun6_b on from the whole of tun6_a). Here the turning margin is applied once, to the
 * screen, and each opening is grown by PAD6 metres in the world instead (the parallax of a frame of movement and the
 * view bob — large for a near opening, small for a far one). Walks the portals from the camera's room through openings
 * whose screen rectangle overlaps the one it came through and moves every room-tagged group of the level root whose
 * rooms it did not reach to the render's view-cull layer (30): `visible` stays the level's (checks and feeds walk it),
 * probe captures and the feed pass still see them, shadow passes do not. Lights, enemies, pickups and fx volumes follow
 * through `roomVisible`, narrowed to the same set. Only ever hides what the graph shows; never shows anything.
 */
function installPortalCull6(L: LevelBuild, openings: Opening6[]) {
  const cam = L.ctx.camera;
  const vp = new THREE.Matrix4();
  type Portal = { a: number; b: number; pts: THREE.Vector3[]; door: { t: number; ajar?: number } | null; near?: Opening6['near'] };
  let ready = false;
  const portals: Portal[] = [];
  let rooms: { id: string; x0: number; x1: number; z0: number; z1: number }[] = [];
  let tagged: { obj: THREE.Object3D; ids: number[]; culled: boolean; masks: Map<THREE.Object3D, number> }[] = [];
  const setCulled = (t: (typeof tagged)[number], on: boolean) => {
    if (t.culled === on) return;
    t.culled = on;
    if (on) t.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) { t.masks.set(o, o.layers.mask); o.layers.mask = 1 << 30; } });
    else { for (const [o, m] of t.masks) o.layers.mask = m; t.masks.clear(); }
  };
  let baseVisible: ((x: number, z: number) => boolean) | null = null;
  const reached = new Uint8Array(64);
  const rect = new Float32Array(64 * 4);
  const SCREEN_MARGIN = 0.12; // NDC, once: one frame of turning at ~400°/s
  const NDC_EPS = 0.01;
  const PAD6 = 0.3; // m, per opening: a frame of movement + the view bob
  const quad = (wall: 'x' | 'z', at: number, u0: number, u1: number, y0: number, y1: number) => {
    u0 -= PAD6; u1 += PAD6; y0 -= PAD6; y1 += PAD6;
    return wall === 'z'
      ? [new THREE.Vector3(u0, y0, at), new THREE.Vector3(u1, y0, at), new THREE.Vector3(u0, y1, at), new THREE.Vector3(u1, y1, at)]
      : [new THREE.Vector3(at, y0, u0), new THREE.Vector3(at, y0, u1), new THREE.Vector3(at, y1, u0), new THREE.Vector3(at, y1, u1)];
  };
  let active = false;
  const setup = () => {
    const level = L.ctx.level;
    if (!level?.doors?.length || !L.root.userData.roomVisible) return false;
    rooms = L.rooms.map((r) => ({ id: r.id, x0: r.bounds.min.x, x1: r.bounds.max.x, z0: r.bounds.min.z, z1: r.bounds.max.z }));
    const idx = new Map(rooms.map((r, i) => [r.id, i]));
    for (const d of level.doors) {
      const root = L.objects.get(d.id);
      const rs = root?.userData.rooms as string[] | undefined;
      if (!root || !rs || rs.length !== 2 || !idx.has(rs[0]) || !idx.has(rs[1])) continue;
      const impl = d as unknown as { width?: number; height?: number; t: number; ajar?: number };
      const w = impl.width ?? 1.6, h = impl.height ?? 2.4, y = d.position.y;
      const xWall = Math.abs(Math.sin(root.rotation.y)) > 0.5;
      const c = xWall ? d.position.z : d.position.x;
      portals.push({ a: idx.get(rs[0])!, b: idx.get(rs[1])!, pts: quad(xWall ? 'x' : 'z', xWall ? d.position.x : d.position.z, c - w / 2, c + w / 2, y, y + h), door: impl });
    }
    for (const o of openings) {
      if (!idx.has(o.a) || !idx.has(o.b)) continue;
      portals.push({ a: idx.get(o.a)!, b: idx.get(o.b)!, pts: quad(o.wall, o.at, o.u0, o.u1, o.y0, o.y1), door: null, near: o.near });
    }
    tagged = [];
    for (const o of L.root.children) {
      const rs = o.userData.rooms as string[] | undefined;
      const ids = (rs ?? []).map((r) => idx.get(r)).filter((i): i is number => i !== undefined);
      if (ids.length) tagged.push({ obj: o, ids, culled: false, masks: new Map() });
    }
    baseVisible = L.root.userData.roomVisible as (x: number, z: number) => boolean;
    const roomAt = (x: number, z: number) => {
      for (let i = 0; i < rooms.length; i++) { const r = rooms[i]; if (x > r.x0 + 0.05 && x < r.x1 - 0.05 && z > r.z0 + 0.05 && z < r.z1 - 0.05) return i; }
      return -1;
    };
    L.root.userData.roomVisible = (x: number, z: number): boolean => {
      if (!baseVisible!(x, z)) return false;
      if (!active) return true;
      const i = roomAt(x, z);
      return i < 0 || reached[i] === 1;
    };
    return true;
  };
  /** Screen rectangle of a portal ∩ `r` (x0, y0, x1, y1 in NDC), or null; conservative near / behind the camera. */
  const cv = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const NEAR_W = 0.05;
  const clip = (p: Portal, r: number[]): number[] | null => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, w: number) => {
      const px = x / w, py = y / w;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    };
    let behind = 0;
    for (let k = 0; k < 4; k++) { const q = p.pts[k]; cv[k].set(q.x, q.y, q.z, 1).applyMatrix4(vp); if (cv[k].w < NEAR_W) behind++; }
    if (behind === 4) {
      // wholly behind the eye: invisible, unless the eye stands in the opening (then it passes the whole rectangle on)
      const a = p.pts[0], d = p.pts[3], e = cam.position;
      const dx = Math.max(Math.min(a.x, d.x) - e.x, 0, e.x - Math.max(a.x, d.x));
      const dy = Math.max(Math.min(a.y, d.y) - e.y, 0, e.y - Math.max(a.y, d.y));
      const dz = Math.max(Math.min(a.z, d.z) - e.z, 0, e.z - Math.max(a.z, d.z));
      return dx * dx + dy * dy + dz * dz < 0.6 * 0.6 ? r.slice() : null;
    }
    const ring = [0, 1, 3, 2];
    for (let k = 0; k < 4; k++) {
      const A = cv[ring[k]], B = cv[ring[(k + 1) % 4]];
      if (A.w >= NEAR_W) add(A.x, A.y, A.w);
      if ((A.w >= NEAR_W) !== (B.w >= NEAR_W)) {
        const t = (A.w - NEAR_W) / (A.w - B.w);
        add(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t, NEAR_W);
      }
    }
    x0 = Math.max(x0 - NDC_EPS, r[0]); y0 = Math.max(y0 - NDC_EPS, r[1]); x1 = Math.min(x1 + NDC_EPS, r[2]); y1 = Math.min(y1 + NDC_EPS, r[3]);
    return x0 < x1 && y0 < y1 ? [x0, y0, x1, y1] : null;
  };
  L.updaters.push(() => {
    if (!ready) { ready = setup(); if (!ready) return; }
    cam.updateMatrixWorld();
    const p = cam.position;
    let start = -1;
    for (let i = 0; i < rooms.length; i++) { const r = rooms[i]; if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) { start = i; break; } }
    // (check:fxleak's magenta mode tests that walls hide a mis-gated volume: the walls must all be there for it)
    if ((L.ctx.fx as unknown as { volumesDebug?: boolean }).volumesDebug) start = -1;
    reached.fill(0);
    if (start < 0) { active = false; for (const t of tagged) setCulled(t, false); return; }
    active = true;
    vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const big = [-1 - SCREEN_MARGIN, -1 - SCREEN_MARGIN, 1 + SCREEN_MARGIN, 1 + SCREEN_MARGIN];
    reached[start] = 1;
    rect.set(big, start * 4);
    const queue = [start];
    let guard = 0;
    while (queue.length && guard++ < 400) {
      const i = queue.shift()!;
      const r = [rect[i * 4], rect[i * 4 + 1], rect[i * 4 + 2], rect[i * 4 + 3]];
      for (const q of portals) {
        const j = q.a === i ? q.b : q.b === i ? q.a : -1;
        if (j < 0 || !L.isVisible(rooms[j].id)) continue;
        if (q.door && !(q.door.t > (q.door.ajar ?? 0) + 1e-3)) continue;
        if (q.near && p.y >= -0.2 && (p.x - q.near.x) ** 2 + (p.z - q.near.z) ** 2 > q.near.r ** 2) continue;
        const c = clip(q, r);
        if (!c) continue;
        if (reached[j]) {
          const o = j * 4;
          const n0 = Math.min(rect[o], c[0]), n1 = Math.min(rect[o + 1], c[1]), n2 = Math.max(rect[o + 2], c[2]), n3 = Math.max(rect[o + 3], c[3]);
          if (n0 < rect[o] - 1e-3 || n1 < rect[o + 1] - 1e-3 || n2 > rect[o + 2] + 1e-3 || n3 > rect[o + 3] + 1e-3) { rect[o] = n0; rect[o + 1] = n1; rect[o + 2] = n2; rect[o + 3] = n3; queue.push(j); }
        } else { reached[j] = 1; rect.set(c, j * 4); queue.push(j); }
      }
    }
    for (const t of tagged) {
      let mine = false;
      for (const i of t.ids) if (reached[i]) { mine = true; break; }
      setCulled(t, !mine);
    }
  });
}

/**
 * The height mist's floor (render `post.ts` rule, IB6): each frame, the lowest floor of the room the camera stands in
 * (`ROOMS6`: the main floor and every extra floor — the chamber's channel −21.3, the shaft's bottom −12, the trench −1.4)
 * goes to `render.settings.mistFloor`; outside every room NaN (the feet rule). Replaces pool.ts's per-room override.
 */
function installMistFloor6(L: LevelBuild) {
  const look = (L.ctx.render as unknown as { settings?: { mistFloor?: number } }).settings;
  if (!look) return;
  const rooms = ROOM_IDS6.map((id) => {
    const r = ROOMS6[id];
    return { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, low: Math.min(r.y0, ...(r.floors ?? []).map((f) => f.y)) };
  });
  L.updaters.push(() => {
    const p = L.ctx.camera.position;
    let low = NaN;
    for (const r of rooms) if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) { low = r.low; break; }
    look.mistFloor = low;
  });
}

/** §2.7.4: the chamber's two doors share one frame zone; the rest one per room pair. */
const POOL_DOORS = ['d6_pool', 'd6_stores'];
const POOL_ZONE_ROOMS = ['pool6', 'shaft6', 'stores6'];

// ───────────────────────────────────────────────────────────── pickups (§5.2) and enemy spawns (§5.1)

function gameplay(L: LevelBuild) {
  const p = (id: string, kind: Parameters<LevelBuild['pickup']>[1], x: number, y: number, z: number, n: number, yaw = 0) => L.pickup(id, kind, x, y, z, n, yaw);
  p('p6_lock_ammo', 'ammo_carbine', 3.4, 1.0, 1.2, 30);
  p('p6_tun_med', 'medkit', -1.25, 1.0, -24.0, 35);
  p('p6_tun_ammo', 'ammo_carbine', 1.25, 1.0, -40.0, 30);
  p('p6_tun_plate', 'plate', -1.25, 1.0, -56.0, 15);
  p('p6_rep_ammo_1', 'ammo_carbine', 15.6, 1.0, -89.5, 30);
  p('p6_rep_ammo_2', 'ammo_carbine', 15.6, 1.0, -88.6, 30);
  p('p6_rep_med', 'medkit', -5.55, 1.0, -82.0, 35);
  p('p6_rep_shells', 'ammo_shotgun', 7.6, 1.25, -82.6, 8);
  p('p6_bay_plate', 'plate', 20.1, 1.0, -104.4, 15);
  p('p6_bay_ammo', 'ammo_carbine', 20.1, 1.0, -103.6, 30);
  p('p6_tunb_ammo', 'ammo_carbine', 12.75, 1.0, -125.0, 30);
  p('p6_tunb_med', 'medkit', 11.25, 1.0, -141.0, 35);
  p('p6_he_vest', 'vest', 3.2, 1.3, -160.75, 50, PI);
  p('p6_he_ammo_1', 'ammo_carbine', 15.6, 1.05, -179.0, 30);
  p('p6_he_ammo_2', 'ammo_carbine', 15.0, 1.05, -179.0, 30);
  p('p6_he_med', 'medkit', 21.55, 1.0, -176.0, 35);
  p('p6_he_shells', 'ammo_shotgun', 2.4, 1.0, -172.0, 8);
  p('p6_he_pistol', 'ammo_pistol', 2.4, 1.0, -171.4, 24);
  p('p6_vault_ammo', 'ammo_carbine', 1.6, 1.0, -150.0, 30);
  p('p6_vault_med', 'medkit', 1.6, 1.0, -151.0, 35);
  p('p6_vault_plate', 'plate', -3.0, 1.0, -150.65, 15);
  p('p6_trench_plate_1', 'plate', -12.4, -1.25, -176.4, 15);
  p('p6_trench_plate_2', 'plate', -12.4, -1.25, -175.8, 15);
  p('p6_trench_ammo_1', 'ammo_carbine', -10.0, -1.25, -178.8, 30);
  p('p6_trench_ammo_2', 'ammo_carbine', -9.4, -1.25, -178.8, 30);
  p('p6_trench_med', 'medkit', -8.6, -1.25, -178.8, 35);
  p('p6_shaft_ammo', 'ammo_carbine', -22.4, -5.0, -171.1, 30);
  p('p6_shaft_med', 'medkit', -27.4, -11.2, -171.4, 35);
  p('p6_ge_med', 'medkit', -28.5, -11.0, -193.6, 35);
  p('p6_gw_plate', 'plate', -75.5, -11.0, -193.6, 15);
  p('p6_mid_ammo', 'ammo_carbine', -65.4, -14.75, -159.0, 30);
  p('p6_mid_med', 'medkit', -39.8, -14.75, -159.0, 35);
  p('p6_mid_plate', 'plate', -39.0, -14.75, -159.0, 15);
  p('p6_uc_ammo_1', 'ammo_carbine', -63.4, -19.0, -153.8, 30);
  p('p6_uc_ammo_2', 'ammo_carbine', -62.6, -19.0, -153.8, 30);
  p('p6_uc_med', 'medkit', -41.4, -19.0, -153.8, 35);
  p('p6_uc_plate', 'plate', -40.6, -19.0, -153.8, 15);
  p('p6_ww_ammo', 'ammo_carbine', -70.0, -19.0, -195.5, 30);
  p('p6_ww_med', 'medkit', -34.0, -19.0, -195.5, 35);
  p('p6_cage_ammo', 'ammo_carbine', -54.5, -15.0, -167.0, 30);
  p('p6_cage_plate', 'plate', -54.5, -15.0, -166.5, 15);

  const navy = { skin: 'navy' as const };
  const carb = (cover: string) => ({ arms: 'carbine' as const, cover });
  // nothing hostile exists before its beat (R4) except the dormant dock sentry `g6_tunb_k` (harmless while dormant)
  L.enemy('g6_tun_s', 'soldier', 'spawn', 10.0, 0, -86.0, PI / 2, 'hold', undefined, carb('tunnel'));
  L.enemy('g6_tun_s', 'soldier', 'spawn', 12.0, 0, -87.5, PI / 2, 'hold', undefined, carb('tunnel'));
  L.enemy('g6_tun_u', 'husk', 'spawn', -1.2, 0, -91.3, PI, undefined, undefined, navy);
  L.enemy('g6_tun_u', 'husk', 'spawn', 0.0, 0, -91.3, PI, undefined, undefined, navy);
  L.enemy('g6_rep_s', 'soldier', 'spawn', 10.2, 0, -111.6, PI, undefined, undefined, carb('rep'));
  L.enemy('g6_rep_u', 'husk', 'spawn', 16.0, 0, -99.6, PI / 2, undefined, undefined, navy);
  L.enemy('g6_rep_u', 'husk', 'spawn', 18.6, 0, -99.6, PI / 2, undefined, undefined, navy);
  // vent skitters beside the opening under the solid ceiling (0.1 m under it, 3b S1)
  L.enemy('g6_rep_k', 'skitter', 'spawn', 5.6, 4.9, -84.0, 0);
  L.enemy('g6_rep_k', 'skitter', 'spawn', 6.4, 4.9, -84.0, 0);
  L.enemy('g6_tunb_s', 'soldier', 'spawn', 12.0, 0, -162.0, PI, 'hold', undefined, carb('tunb'));
  L.enemy('g6_tunb_k', 'sentry', 'dormant', 12.0, 3.9, -134.0, 0, 'ceiling', undefined, navy);
  for (const [g, set] of [['g6_he', 'he'], ['g6_vault', 'vault']] as const) {
    L.enemy(g, 'soldier', 'spawn', -16.0, 0, -143.0, 0, undefined, undefined, carb(set));
    L.enemy(g, 'husk', 'spawn', -19.0, 0, -144.0, 0, undefined, undefined, navy);
    L.enemy(g, 'husk', 'spawn', -13.0, 0, -144.0, 0, undefined, undefined, navy);
  }
  // F5's skitters: in the trench under G1 / G2 / G3 (player not in the trench) — or from vent6_vault (`g6_vault_kv`)
  L.enemy('g6_vault_k', 'skitter', 'spawn', -12.4, -1.0, -174.0, 0);
  L.enemy('g6_vault_k', 'skitter', 'spawn', -12.4, -1.0, -164.0, 0);
  L.enemy('g6_vault_k', 'skitter', 'spawn', -6.0, -1.0, -178.8, 0);
  L.enemy('g6_vault_kv', 'skitter', 'spawn', -5.6, 5.9, -160.0, 0);
  L.enemy('g6_vault_kv', 'skitter', 'spawn', -6.4, 5.9, -160.0, 0);
  L.enemy('g6_vault_kv', 'skitter', 'spawn', -6.0, 5.9, -159.4, 0);
  L.enemy('g6_shaft', 'husk', 'spawn', -26.8, -12, -162.8, PI, undefined, undefined, navy);
  // the loader: spawned when Key B turns (D31), never before; on its rails, the grab over the well
  L.enemy('g6_loader', 'loader', 'spawn', -52.0, -2.6, -176.0, 0, 'working');
  // boss waves and their restore twins (§5.5, D21)
  for (const g of ['g6_w1', 'g6_w1_r']) {
    L.enemy(g, 'soldier', 'spawn', -72.0, -12, -144.0, 0, undefined, undefined, carb('gal_n'));
    L.enemy(g, 'soldier', 'spawn', -68.0, -12, -144.0, 0, undefined, undefined, carb('gal_w'));
  }
  for (const g of ['g6_w2', 'g6_w2_r']) {
    L.enemy(g, 'husk', 'spawn', -57.3, -23.2, -176.4, -PI / 2, 'climb', undefined, navy);
    L.enemy(g, 'husk', 'spawn', -57.3, -24.4, -175.6, -PI / 2, 'climb', undefined, navy);
    L.enemy(g, 'husk', 'spawn', -46.7, -23.2, -176.4, PI / 2, 'climb', undefined, navy);
    L.enemy(g, 'husk', 'spawn', -46.7, -24.4, -175.6, PI / 2, 'climb', undefined, navy);
  }
  for (const g of ['g6_w3', 'g6_w3_r']) {
    L.enemy(g, 'soldier', 'spawn', -24.0, -12, -163.4, PI / 2, undefined, undefined, carb('gal_e'));
    L.enemy(g, 'soldier', 'spawn', -26.6, -12, -163.4, PI / 2, undefined, undefined, carb('gal_e'));
    L.enemy(g, 'husk', 'spawn', -26.8, -12, -170.8, PI / 2, undefined, undefined, navy);
  }
  // W3 from stores6 when the player is in the shaft (§5.1 "else in stores6") — its own group and twin
  for (const g of ['g6_w3_s', 'g6_w3_s_r']) {
    L.enemy(g, 'soldier', 'spawn', -72.0, -12, -144.0, 0, undefined, undefined, carb('gal_e'));
    L.enemy(g, 'soldier', 'spawn', -68.0, -12, -144.0, 0, undefined, undefined, carb('gal_e'));
    L.enemy(g, 'husk', 'spawn', -70.0, -12, -142.5, 0, undefined, undefined, navy);
  }
}

// ───────────────────────────────────────────────────────────── level

export async function createLevel6(ctx: GameContext): Promise<Level> {
  const t0 = performance.now();
  const timings: string[] = [];
  let tl = performance.now();
  const lap = (name: string) => { const n = performance.now(); timings.push(`${name} ${(n - tl).toFixed(0)}`); tl = n; };
  const L = new LevelBuild(ctx);
  ctx.scene.add(L.root);
  defineInstances(L);
  const dress = mergeDress();

  const G = new GreyGrid(ENVELOPE6);
  const standin = flatMat(L, 0x7d8186, 'grey_standin');
  const glass = L.ctx.materials.get('glass');
  const dark = flatMat(L, 0x3a3f44, 'grey_dark');
  const yellow = flatMat(L, 0xd8b020, 'grey_yellow_line', { emissive: new THREE.Color(0x705800), emissiveIntensity: 0.6 });
  const grate = L.doubleSided('floor_grate');
  const mesh = L.doubleSided('floor_grate');
  const noLabel = (b: Builder) => new Proxy(b, { get: (t, p) => (p === 'sign' ? () => t : (t as unknown as Record<string | symbol, unknown>)[p as string]) }) as Builder;
  const specs = doors6();

  buildRooms(L, ROOM_IDS6.map((id) => [id, (l: LevelBuild) => {
    const r = ROOMS6[id];
    l.room(id, r.name, r.x0, r.x1, r.z0, r.z1, r.h, { y0: r.y0, floors: r.floors });
    const b = l.builder(`${id}_grey`);
    const d = dress[id];
    SHELLS6[id]({ L: l, G, b: d?.label === false ? noLabel(b) : b, standin, glass, dark, yellow, grate, mesh });
    d?.build?.(l);
    placeLights6(l, d?.lights ?? LIGHTS6[id]);
  }] as const), lap);
  for (const s of specs) carveDoor(G, s);
  // (the nav obstacles — both hatch pits, the shaft's well, the dock band, the slots — are W4b's: water.ts / dock.ts)
  gameplay(L);
  placeholders6(L, { standin, dark });

  const wall = flatMat(L, 0xc4c8cb, 'grey_wall'), ceil = flatMat(L, 0x93979b, 'grey_ceiling'), reveal = flatMat(L, 0xa4a7aa, 'grey_reveal');
  const floors = new Map<string, THREE.Material>();
  G.build(L, (room) => {
    if (room === 'reveal') return { floor: reveal, wall: reveal, ceiling: reveal };
    let f = floors.get(room);
    if (!f) floors.set(room, (f = flatMat(L, FLOOR_TINT6[room as unknown as RoomId6] ?? 0x8a8e92, `grey_floor_${room}`)));
    return { floor: f, wall, ceiling: ceil, ...dress[room as unknown as RoomId6]?.look };
  });
  lap('grey');

  // the move-only colliders the kit (W8: dressing rails / guards / tarp) and the set pieces (W7: the cage's bars, the
  // ladder gates) registered join the collider list as flagged meshes (`L.extraColliders`, appended by colliderMeshes)
  const kitMoveOnly = kitMoveOnly6(L);
  if (kitMoveOnly) L.extraColliders.push(kitMoveOnly);
  L.extraColliders.push(...pieceMoveOnly6(L));
  const cover = makeCover6();
  const level = assembleLevel(ctx, L, {
    doors: specs,
    frameZone: (s) => {
      if (POOL_DOORS.includes(s.id)) return { name: 'frames6_pool6', rooms: POOL_ZONE_ROOMS };
      const rooms = [...new Set(s.rooms)].sort();
      return { name: `frames6_${rooms.join('+')}`, rooms };
    },
    portals: PORTALS6,
    seeRange: 22,
    triggers: TRIGGERS6,
    navStep: (id) => (id === 'pool6' ? 1.25 : 1.0),
    navStart: { x: 0, y: 0, z: 3.0 },
    spawn: { position: new THREE.Vector3(0, 0, 3.0), yaw: 0 },
    startRoom: 'lock6',
    regions: REGIONS6(),
    cover,
    water: buildWater6(L),
    dock: buildDock6(L),
    killY: -36,
    timings, t0,
  });
  installPortalCull6(L, OPENINGS6);
  installMistFloor6(L);
  installPhases6(ctx, level);
  // initial door state: the story starts in phase A; `?nostory=1` follows the nostory column (§3)
  applyPhaseTo6(ctx, level, (ctx.debug.noStory ? 'nostory' : 'A') as PhaseId6);
  level.setMachine('trench6', 'active');

  // a trench exit is an exit only while its lid is open (as 3c's `mk5_exit_mag`)
  const floorAt0 = level.floorAt.bind(level);
  const exitOpen: [THREE.Vector3, string][] = [[new THREE.Vector3(...EXIT_VAULT), 'hatch6_vault'], [new THREE.Vector3(...EXIT_HE), 'hatch6_he']];
  (level as { floorAt: Level['floorAt'] }).floorAt = (p) => {
    const f = floorAt0(p);
    if (!f || f.nav) return f;
    return { ...f, exits: f.exits.filter((e) => { const x = exitOpen.find(([q]) => q.distanceToSquared(e) < 1e-6); return !x || lidK(L, x[1]) >= 0.98; }) };
  };
  const api = level as unknown as Record<string, unknown>;
  api.navCases = NAV_CASES6; // (W4b's §10.3 cases, l6/water.ts)
  api.reachHints = {
    carry: [],
    // §3: `hatch6_he` is one-way (trench → head-end): a body on the exit stair under the lid is let out on top
    oneway: [{ door: 'hatch6_he', machine: 'trench6', from: [2.4, -1.5, -177.6, 3.6, -0.3, -175.4], to: [...EXIT_HE] }],
    hazards: ['deep'],
  };
  api.selfTest = () => selfTest(ctx, L, level, specs, G);
  api.grey = G.stats;
  api.list = () => ({ vignettes: [...L.vignettes.keys()], screens: [...L.screens.keys()], objects: [...L.objects.keys()] });
  if (ctx.debug.verbose) console.info(`[level6] grey grid ${G.stats.cells} cells → ${G.stats.quads} quads, ${G.stats.colliders} colliders in ${G.stats.ms.toFixed(0)} ms`);
  return level;
}

/** Floor tints per room (greybox readability). */
const FLOOR_TINT6: Record<RoomId6, number> = {
  lock6: 0x737b82, tun6_a: 0x7a7670, rep6: 0x7e7a72, tun6_b: 0x5c5a56, bay6: 0x6c7377, he6: 0x9aa0a6, vault6: 0x8a9096, hold6: 0x6e7478,
  shaft6: 0x5f686e, pool6: 0x5a6066, stores6: 0x666a6c, feed6: 0x585c60,
};

/** Every §8.11 level marker (the playthrough asserts each exists). */
export const MARKERS6 = [
  'mk6_start', 'mk6_tube_panel', 'mk6_cross_0', 'mk6_cross_1', 'mk6_tun_s1', 'mk6_tun_s2', 'mk6_tun_u1', 'mk6_tun_u2',
  'mk6_rep_s', 'mk6_bay_u1', 'mk6_bay_u2', 'mk6_vent_rep', 'mk6_he_s', 'mk6_tunb_hold', 'mk6_sentry',
  'mk6_switch', 'mk6_queue', 'mk6_handset', 'mk6_phone',
  'mk6_hold_1', 'mk6_hold_2', 'mk6_hold_3', 'mk6_bj', 'mk6_loom', 'mk6_shaft_lock', 'mk6_grille_1', 'mk6_grille_2', 'mk6_grille_3', 'mk6_vent_vault',
  'mk6_exit_vault', 'mk6_exit_he', 'mk6_drum',
  'mk6_shaft_u', 'mk6_ll0', 'mk6_ll1', 'mk6_ll2', 'mk6_ll3', 'mk6_llb',
  'mk6_reveal', 'mk6_boss_safe', 'mk6_boss_safe_w', 'mk6_w1_a', 'mk6_w1_b', 'mk6_w3_a', 'mk6_w3_b', 'mk6_w3_u', 'mk6_lw_exit', 'mk6_le_exit',
  'mk6_ladder_w', 'mk6_ladder_e', 'mk6_cage', 'mk6_pin', 'mk6_pump', 'mk6_lever', 'mk6_sheave', 'mk6_horn',
  'mk6_console', 'mk6_end_stand', 'mk6_end_cam0', 'mk6_end_cam1', 'mk6_end_screen', 'mk6_feed_cam', 'mk6_windows',
];
/** Markers mounted on a wall / in a ceiling / on a device / in the air (checked inside the room's bounds, not its inset). */
const WALL_MARKERS6 = new Set([
  'mk6_tube_panel', 'mk6_vent_rep', 'mk6_sentry', 'mk6_switch', 'mk6_queue', 'mk6_handset', 'mk6_phone', 'mk6_bj', 'mk6_loom', 'mk6_shaft_lock',
  'mk6_vent_vault', 'mk6_drum', 'mk6_ll0', 'mk6_ll1', 'mk6_ll2', 'mk6_ll3', 'mk6_llb', 'mk6_ladder_w', 'mk6_ladder_e', 'mk6_pin', 'mk6_pump',
  'mk6_lever', 'mk6_sheave', 'mk6_horn', 'mk6_console', 'mk6_end_cam0', 'mk6_end_cam1', 'mk6_end_screen', 'mk6_windows', 'mk6_grille_1',
  'mk6_grille_2', 'mk6_grille_3',
]);
/** Standing markers (feet): a solid floor (`raycastSolid`) under each, within 5 cm (the rescue lands on three of them). */
const STAND_MARKERS6 = [
  'mk6_start', 'mk6_cross_0', 'mk6_cross_1', 'mk6_tun_s1', 'mk6_tun_s2', 'mk6_tun_u1', 'mk6_tun_u2', 'mk6_rep_s', 'mk6_bay_u1', 'mk6_bay_u2', 'mk6_he_s',
  'mk6_tunb_hold', 'mk6_hold_1', 'mk6_hold_2', 'mk6_hold_3', 'mk6_exit_vault', 'mk6_exit_he', 'mk6_shaft_u', 'mk6_reveal', 'mk6_boss_safe',
  'mk6_boss_safe_w', 'mk6_w1_a', 'mk6_w1_b', 'mk6_w3_a', 'mk6_w3_b', 'mk6_w3_u', 'mk6_lw_exit', 'mk6_le_exit', 'mk6_cage', 'mk6_end_stand',
];
/** Every §6.4 screen (the feed set's board included). */
export const SCREENS6 = ['tube_panel6', 'mimic6', 'queue6', 'switch6', 'bj6', 'shaft6_panel', 'dock_board', 'gauge6', 'console6', 'feed6_board'];
/** Every interactable the level makes (§6.3 readables, §8.5 objectives, the hatches, the dock lockers). */
export const INTERACTABLES6 = [
  'note6_jobcard', 'note6_queue', 'note6_jointer', 'note6_transfer', 'he6_switch', 'he6_phone', 'vault6_lock', 'vault6_loom', 'shaft6_lock',
  'frame6_pin', 'frame6_pump', 'frame6_lever', 'console6', 'hatch6_vault', 'hatch6_he', 'hatch6_he_plate', 'locker6_e', 'locker6_w', 'locker6_n',
];
/** Every level vignette (each must have a snap). */
export const VIGNETTES6 = [
  'tun6_far_out', 'v6_tent', 'vent6_rep', 'v6_handset', 'v6_drum', 'v6_ring', 'v6_thud', 'bj6_open', 'bj6_rip', 'hatch6_vault_open', 'hatch6_he_open',
  'vent6_vault', 'grille6_1', 'grille6_2', 'grille6_3', 'v6_shaft_lights', 'v6_well_eyes', 'v6_window', 'beacons6', 'lights_out6', 'loader_dead6',
];
/** Set-piece objects (W7's API or the greybox placeholder). */
export const OBJECTS6 = ['ladder6_w', 'ladder6_e', 'switch6', 'bj6', 'shaft6', 'frame6', 'phone6', 'console6', 'hatch6_vault', 'hatch6_he'];

// ───────────────────────────────────────────────────────────── self-test (check-reach runs it)

function selfTest(ctx: GameContext, L: LevelBuild, level: Level, specs: DoorSpec[], G: GreyGrid): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const t = (name: string, pass: boolean, detail = '') => { if (!pass) ok = false; lines.push(`${pass ? ' ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const ph = ctx.physics;
  t('12 rooms (< the 31-room visibility bitmask)', level.rooms.length === 12, `${level.rooms.length}`);
  t('kill height −36 (B6)', level.killY === -36 && ph.killY === -36, `level ${level.killY}, physics ${ph.killY}`);
  for (const id of ROOM_IDS6) {
    const r = level.rooms.find((q) => q.id === id), d = ROOMS6[id];
    const low = Math.min(d.y0, ...(d.floors ?? []).map((f) => f.y));
    t(`room ${id} floor ${d.y0}, bounds y ${low - 0.5} … ${d.y0 + d.h}`, !!r && roomFloor(r) === d.y0 && Math.abs(r.bounds.min.y - (low - 0.5)) < 1e-6 && Math.abs(r.bounds.max.y - (d.y0 + d.h)) < 1e-6);
    for (const [i, f] of (d.floors ?? []).entries()) {
      const rf = r?.floors?.[i];
      if (f.nav === false) t(`${id} floor ${i} (y ${f.y}) nav: false with ${f.exits?.length ?? 0} exits`, !!rf && rf.nav === false && (rf.exits?.length ?? 0) === (f.exits?.length ?? 0));
    }
  }
  for (const s of specs) {
    const d = L.doors.get(s.id) as DoorImpl | undefined;
    t(`${s.id}: floor ${s.y ?? 0}`, !!d && d.floor === (s.y ?? 0));
  }
  // walkable floor (the moves set: water never a floor) under every room and every extra floor
  const down = V(0, -1, 0), up = V(0, 1, 0);
  const probe = (name: string, x: number, y: number, z: number) => {
    const h = ph.raycastSolid(V(x, y + 1.0, z), down, 1.5);
    t(`${name}: walkable floor at (${x}, ${y}, ${z})`, !!h && Math.abs(h.point.y - y) < 0.02, h ? h.point.y.toFixed(3) : 'no hit');
  };
  const PROBE_AT: Partial<Record<RoomId6, [number, number]>> = { rep6: [4, -86], he6: [12, -174], vault6: [-8, -166], pool6: [-66, -170], shaft6: [-26.8, -166], feed6: [112, 12] };
  // (feed6: the sealed feed set, never entered — W7's set draws its floor, the grid's lies 0.1 m under it)
  for (const id of ROOM_IDS6) {
    if (id === 'feed6') continue;
    const d = ROOMS6[id];
    const [cx, cz] = PROBE_AT[id] ?? [(d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2];
    probe(id, cx, d.y0, cz);
  }
  probe('trench T-a', -12.4, -1.4, -170);
  probe('trench T-b', -4, -1.4, -178.8);
  probe('trench under the wall', 2.0, -1.4, -178.8);
  probe('trench T-c', 3.0, -1.4, -178.8);
  probe('vault grating over T-a', -12.4, 0, -168);
  probe('he6 plates over T-c', 3.0, 0, -178.8);
  probe('the shut vault lid (walkable)', -12.4, 0, -159.2);
  probe('the shut he6 lid (walkable)', 3.0, 0, -176.5);
  for (const [k, l] of Object.entries({ L0: [-25, 0, -170], L1: [-25, -3, -163.3], L2: [-25, -6, -170], L3: [-25, -9, -163.3] })) probe(`shaft ${k}`, l[0], l[1], l[2]);
  probe('wet dock floor', -52, -20.8, -188);
  probe('channel bottom', -52, -21.3, -183.2);
  probe('window walk', -52, -20, -195.0);
  probe('mid deck', -60, -16, -158);
  probe('cage floor', -54.5, -16, -170.5);
  probe('undercroft', -52, -20, -158);
  probe('east gallery', -29.7, -12, -180);
  probe('west gallery', -74.3, -12, -180);
  probe('north gallery', -52, -12, -149.7);
  // the trench: 1.35 m clear under the gratings / plates (crouch 1.1 ✓, stand 1.8 ✗) incl. under the wall
  const clear = (name: string, x: number, y: number, z: number, want: number) => {
    const h = ph.raycastSolid(V(x, y + 0.05, z), up, 5);
    t(`${name}: head room ${want} m`, !!h && Math.abs(h.point.y - y - want) < 0.03, h ? `${(h.point.y - y).toFixed(3)} m` : 'none');
  };
  clear('T-a under the grating', -12.4, -1.4, -170, 1.35);
  clear('T-b under the grating', -4, -1.4, -178.8, 1.35);
  clear('under the he6 / vault6 wall', 2.0, -1.4, -178.8, 1.35);
  clear('T-c under the plates', 3.0, -1.4, -178.8, 1.35);
  clear('the undercroft', -52, -20, -158, 3.7);
  clear('under the north gallery (cv6_m3)', -50.25, -16, -149.45, 3.7);
  const crossing = ph.raycastSolid(V(1.0, -0.8, -178.8), V(1, 0, 0), 2.0);
  t('the under-wall crossing is open (T-b → T-c)', !crossing, crossing ? `blocked at x ${crossing.point.x.toFixed(2)}` : '');
  const wallAbove = ph.raycast(V(1.0, 1.0, -178.8), V(1, 0, 0), 2.0);
  t('the he6 / vault6 wall is solid above the crossing', !!wallAbove && Math.abs(wallAbove.point.x - 1.8) < 0.03, wallAbove ? `x ${wallAbove.point.x.toFixed(3)}` : 'no hit');
  const grating = ph.raycast(V(-12.4, 1.2, -168), down, 3);
  t('the trench grating stops a ray (bullets, sight)', !!grating && Math.abs(grating.point.y) < 0.01, grating ? `${grating.surface} at y ${grating.point.y.toFixed(3)}` : 'no hit');
  const pane = ph.raycast(V(-52, -17.8, -194.5), V(0, 0, -1), 4);
  t('the sea window is a glass collider', !!pane && pane.surface === 'glass' && Math.abs(pane.point.z - PANE6[5]) < 0.03, pane ? `${pane.surface} at z ${pane.point.z.toFixed(3)}` : 'no hit');
  const sealed = ph.raycast(V(0, 1.2, 4.5), V(0, 0, 1), 3);
  t('door6_tunnel is solid', !!sealed && sealed.distance < 2.0, sealed ? `hit at ${sealed.distance.toFixed(2)} m` : 'no hit');
  // containment (B1, D32, D14): move-only guards stop bodies (raycastSolid) and pass rounds (raycast)
  const moveOnly = (name: string, o: THREE.Vector3, dir: THREE.Vector3, axis: 'x' | 'y' | 'z', want: number, len = 3) => {
    const s = ph.raycastSolid(o, dir, len), r = ph.raycast(o, dir, len);
    t(`${name}: stops bodies`, !!s && Math.abs(s.point[axis] - want) < 0.06, s ? `${axis} ${s.point[axis].toFixed(3)}` : 'no hit');
    t(`${name}: rounds pass`, !r || Math.abs(r.point[axis] - want) > 0.1, r ? `ray hit at ${axis} ${r.point[axis].toFixed(3)}` : '');
  };
  moveOnly('coaming bar guard (west, y −18)', V(-60, -18, -176), V(1, 0, 0), 'x', -58.4);
  moveOnly('coaming bar guard (north, y −18.5)', V(-52, -18.5, -168), V(0, 0, -1), 'z', -169.6);
  const over = ph.raycastSolid(V(-60, -17.5, -176), V(1, 0, 0), 3);
  t('coaming guard top at −17.6 (2.4 m above the dock)', !over || over.point.x > -58.0, over ? `hit at x ${over.point.x.toFixed(2)}` : '');
  const coam = ph.raycast(V(-60, -19.5, -176), V(1, 0, 0), 3);
  t('the coaming is solid plate (stops rounds)', !!coam && Math.abs(coam.point.x + 58.4) < 0.03, coam ? `x ${coam.point.x.toFixed(3)}` : 'no hit');
  moveOnly('mid-deck bar guard (y −14.5)', V(-60, -14.5, -164), V(0, 0, -1), 'z', -165.95);
  moveOnly('cage bars (west)', V(-53.5, -15, -170.5), V(-1, 0, 0), 'x', -54.95);
  moveOnly('cage bars (south)', V(-53.5, -15, -170.5), V(0, 0, -1), 'z', -171.95, 4);
  moveOnly('cage bar roof', V(-53.5, -15, -170.5), V(0, 1, 0), 'y', -13.45);
  moveOnly('shaft well guard (west)', V(-26.8, 1.0, -166.4), V(1, 0, 0), 'x', -25.83);
  moveOnly('shaft well guard (west, at the bottom)', V(-26.8, -11.0, -166.4), V(1, 0, 0), 'x', -25.83);
  moveOnly('L0 north edge guard (east half)', V(-23.2, 1.0, -170.0), V(0, 0, 1), 'z', -168.43);
  // no rail / guard top is a floor (the top 0.3 m is a non-walkable dynamic box): a body dropped onto the mid-deck guard
  const tops: [string, THREE.Vector3][] = [['mid-deck bar guard', V(-60, -13.0, -165.975)], ['coaming guard', V(-52, -17.0, -169.625)], ['a mid-deck rail', V(-69.0, -14.5, -165.975)]];
  for (const [name, at] of tops) {
    const h = ph.raycastSolid(at, down, 1.0);
    t(`${name}: its top is a non-walkable dynamic band`, !!h && 'owner' in h, h ? `top y ${h.point.y.toFixed(2)}${'owner' in h ? '' : ' (static: standable)'}` : 'no hit');
  }
  // markers / screens / interactables / vignettes (+ snaps) / objects / machines
  const inside = (p: THREE.Vector3, inset: number) => {
    const r = level.roomAt(p);
    if (!r) return null;
    const b = r.bounds;
    return p.x >= b.min.x + inset && p.x <= b.max.x - inset && p.z >= b.min.z + inset && p.z <= b.max.z - inset ? r.id : null;
  };
  for (const m of MARKERS6) {
    const o = L.objects.get(m);
    if (!o) { t(`marker ${m}`, false, 'missing'); continue; }
    const wallM = WALL_MARKERS6.has(m);
    const id = inside(o.position, wallM ? -0.05 : 0.5);
    t(`marker ${m} inside a room${wallM ? ' (wall / device mounted)' : ' interior (0.3 m inset)'}`, !!id, `${id ?? 'outside'} (${o.position.toArray().map((v) => +v.toFixed(2)).join(', ')})`);
  }
  for (const m of STAND_MARKERS6) {
    const o = L.objects.get(m);
    if (!o) continue;
    const p = o.position, h = ph.raycastSolid(V(p.x, p.y + 0.6, p.z), down, 1.0);
    t(`marker ${m} stands on a solid floor`, !!h && Math.abs(h.point.y - p.y) < 0.05, h ? `floor y ${h.point.y.toFixed(3)}` : 'no floor');
  }
  for (const s of SCREENS6) t(`screen ${s}`, L.screens.has(s));
  for (const id of INTERACTABLES6) t(`interactable ${id}`, !!ctx.interactables.get(id));
  for (const v of VIGNETTES6) {
    const e = L.vignettes.get(v);
    t(`vignette ${v} (+ :snap)`, !!e && typeof e.snap === 'function', e ? (e.snap ? '' : 'no snap') : 'missing');
  }
  for (const o of OBJECTS6) t(`object ${o}`, L.objects.has(o));
  for (const m of ['winch6', 'ping6', 'trench6']) t(`machine ${m}`, L.machines.has(m));
  for (const id of ['hatch6_vault', 'hatch6_he', 'vent6_rep_grille', 'vent6_vault_grille', 'grille6_1', 'grille6_2', 'grille6_3']) {
    const o = L.objects.get(id);
    t(`${id} is a registered mover`, !!o && !!ph.movers?.includes(o));
  }
  // requireRegion (S8g): the frame only from inside the cage, the console only from its stand
  const reg = ctx.interactables;
  for (const [id, region, inP, outP] of [
    ['frame6_pin', 't6_cage', V(-51.0, -16, -168.0), V(-51.0, -16, -165.0)],
    ['frame6_pump', 't6_cage', V(-53.8, -16, -167.4), V(-56.0, -16, -167.4)],
    ['frame6_lever', 't6_cage', V(-50.2, -16, -167.4), V(-48.0, -16, -167.4)],
    ['console6', 't6_console', V(-44.0, -16, -159.6), V(-44.0, -16, -161.5)],
  ] as const) {
    const it = reg.get(id);
    t(`${id} requireRegion ${region}: usable inside, not outside`, !!it && it.requireRegion === region && reg.allowedAt(it, inP) && !reg.allowedAt(it, outP));
  }
  const sl = reg.get('shaft6_lock');
  t('shaft6_lock usable from the vault side only', !!sl && sl.requireRegion === 'vault6' && reg.allowedAt(sl, V(-21.0, 0, -167.6)) && !reg.allowedAt(sl, V(-23.0, 0, -167.6)));
  // use points never inside a static collider (3c B2: the ray must end in air)
  const inSolid = (p: THREE.Vector3) => L.solids.find((b) => p.x > b.min.x + 0.01 && p.x < b.max.x - 0.01 && p.y > b.min.y + 0.01 && p.y < b.max.y - 0.01 && p.z > b.min.z + 0.01 && p.z < b.max.z - 0.01);
  // (hatch6_he: its use point is on the lid's underside, above the exit stair whose rotated slope's AABB contains it)
  for (const id of INTERACTABLES6) {
    const it = reg.get(id);
    if (!it || id === 'hatch6_he') continue;
    const b = inSolid(it.position);
    t(`use point ${id} in air`, !b, b ? `inside collider [${b.min.toArray().map((v) => v.toFixed(2))} … ${b.max.toArray().map((v) => v.toFixed(2))}]` : '');
  }
  // spawns and pickups inside rooms (spawns 0.3 m inside the interior; pickups may sit at a wall face)
  for (const e of level.enemySpawns) t(`spawn ${e.id} (${e.type}) inside a room interior`, !!inside(e.position, 0.5), inside(e.position, 0.5) ?? 'outside');
  for (const pk of level.pickupSpawns) {
    const b = inSolid(pk.position);
    t(`pickup ${pk.id} inside a room, in air`, !!inside(pk.position, 0.2) && !b, `${inside(pk.position, 0.2) ?? 'outside'}${b ? ' (inside a collider)' : ''}`);
  }
  // the trench is not nav: no node on a nav: false floor, none in either hatch pit
  const navNo = level.nav.filter((n) => { const f = level.floorAt(n.position); return !!f && !f.nav && Math.abs(f.y - n.position.y) < 0.3; });
  t('no nav node on a nav: false floor (trench, channel)', navNo.length === 0, navNo.slice(0, 3).map((n) => `#${n.id} ${n.position.toArray().map((v) => v.toFixed(1))}`).join(' '));
  const inBox = (p: THREE.Vector3, b: readonly number[]) => p.x > b[0] && p.x < b[3] && p.y > b[1] - 0.01 && p.y < b[4] && p.z > b[2] && p.z < b[5];
  const pitNodes = level.nav.filter((n) => inBox(n.position, PIT_VAULT6) || inBox(n.position, PIT_HE6) || inBox(n.position, SHAFT_WELL6));
  t('no nav node in a hatch pit / the shaft well', pitNodes.length === 0, `${pitNodes.length}`);
  const fa = level.floorAt(V(-12.4, -1.4, -170)), fb = level.floorAt(V(-4, -1.4, -178.8)), fc = level.floorAt(V(3.0, -1.4, -178.8));
  t('floorAt(T-a) → vault6, nav false, no exit while both lids are shut', !!fa && !fa.nav && fa.room === 'vault6' && fa.exits.length === 0, fa ? `${fa.room} floor ${fa.floor} exits ${fa.exits.length}` : 'null');
  t('floorAt(T-b) → vault6, nav false', !!fb && !fb.nav && fb.room === 'vault6');
  t('floorAt(T-c) → he6, nav false', !!fc && !fc.nav && fc.room === 'he6');
  const fv = level.floorAt(V(-8, 0, -166));
  t('floorAt(vault floor) → the main floor (nav)', !!fv && fv.nav && fv.floor === -1);
  const cov = selfTestCover6(ctx, level);
  if (!cov.ok) ok = false;
  lines.push(...cov.lines);
  t('grey grid built', G.stats.quads > 0 && G.stats.colliders > 0, `${G.stats.cells} cells, ${G.stats.quads} quads, ${G.stats.colliders} colliders, ${G.stats.ms.toFixed(0)} ms`);
  return { ok, lines };
}
