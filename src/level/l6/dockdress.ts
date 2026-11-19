/**
 * LEVEL 6 — pool6's dressing (stage 3d §2.6.9, §5.2, §5.7, §11 D3b), stores6, and the chamber's vignettes `v6_well_eyes`,
 * `v6_window`, `loader_dead6` (+ snaps). pool6 is dressed by two files: `pool.ts` (D3a: structure, decks, galleries,
 * stairs, coaming + guards, wet dock, water, windows, rails, festoon, lights, strips, slot paint) first, then this one.
 *
 * pool6 (this file):
 *  - the four dock containers B-09 … B-12 (W4b's `cargo6_*` groups, dressed after the dock exists — `L.afterDoors`):
 *    their greybox box goes; the kit's corrugated body is drawn as ONE instanced mesh per paint (2 calls, matrices
 *    synced every frame from each group's world matrix — the loader may carry / drop / reparent them) and each group
 *    gets its stencils as a child (W5's container stencil atlas, one material);
 *  - the undercroft: pump housings P1 / P2 with their tool shelves (`p6_uc_*` on them), a hose reel, the drain sump
 *    grille, the dewatering panel (`note6_transfer`), a stencil;
 *  - the mid deck: crates MC1 / MC2 (`p6_mid_*` on their north edges); the cage's stores box (`p6_cage_*` on its lid);
 *  - the three dock ammo lockers `locker6_e/_w/_n` (kit `ammoLocker`; objects of the same ids for the story:
 *    `userData.{ open(k), swing(), set(full), isFull(), use, shelf }` — swing + set(false) on "탄약 가져가기", set(true) +
 *    open(0) at a re-arm); their side shelves carry `p6_ge_med` / `p6_gw_plate`;
 *  - the window-walk fire points (`p6_ww_ammo` / `p6_ww_med` in their niches), life rings, fenders on the wet dock kerbs;
 *  - the dock board's bezel and caption; signs (`문풀 — 2,140 M`, `화물 록 — 내부 문 닫힘`, `LOADER WORKING
 *    AREA — KEEP CLEAR` on the dock). The coaming's own `출입 금지 — 웨트웰` stencils are the coaming's (kit `coaming`).
 *  - Greybox visuals replaced here (colliders untouched, kit props drawn `collide: false` over them): the six shelves
 *    and the dewatering panel in `pool6_grey`, the locker boxes, `grey6:pool6_frame`'s stand-ins (MC1, MC2, the cage
 *    box), `grey6:pool6_undercroft`'s (P1, P2).
 *  - Vignettes: `v6_well_eyes` (§5.7 #8: four faint cyan points deep in the well in two pairs by the ladders; off at
 *    the hostile start, `boss:stage` ≥ 1; snap = gone), `v6_window` (§5.7 #9: the viewport's one large pass + the
 *    level-owned `sea_groan`; snap = nothing), `loader_dead6` (run = nothing: the live death is the rig's; snap = the
 *    dead crane as a static wreck — bridge in its south buffers, trolley over the well's line, pod blown, floods
 *    drooped and dark, the ropes run out — shown only once the live loader is gone, `removeSilently()`).
 *    The fx handles are looked up by object id: `L.objects.get('fx6_well' | 'fx6_sea').userData.handle` (D3a / pool.ts
 *    registers them; see the D3b report).
 *
 * stores6: shelving, crates, stores boxes, a hose reel, life jackets, its ceiling fitting; the spawn markers and the way
 * to `d6_stores` kept clear. feed6: W7's set, placed by the greybox shell (nothing to add).
 *
 * Contract: see `tunnels.ts`.
 */
import * as THREE from 'three';
import type { Mat } from '../builder';
import type { LevelBuild } from '../context';
import { isStandin, restyle } from '../l3/kit3';
import { stencilAtlas6 } from '../../materials/stencils6';
import type { RoomId6 } from './grey';
import type { RoomDress } from './index';
import {
  ammoLocker, containerInstances, spareCoil, crate6, fender, firePointCabinet, hoseReel, lampLens6, lifeRing, pumpHousing, stencil6,
  storeBox, tint6, tmat6, tunnelFitting, wallShelf6, type ContainerColor,
} from './kit6';
import { dropItems6 } from './shaft';

const PI = Math.PI;
const DOCK = -20, MID = -16, GAL = -12;

// ───────────────────────────────────────────────────────────── fx handles (D3a's)

interface WellFx { eyes(on: boolean, list?: readonly { position: THREE.Vector3; color?: THREE.ColorRepresentation }[]): void }
interface SeaFx { pass(seconds?: number): void }
/** A handle D3a registered as `L.objects.set(id, obj)` with `obj.userData.handle` (or the handle methods on userData). */
function fxHandle<T>(L: LevelBuild, id: string, method: string): T | null {
  const u = L.objects.get(id)?.userData as Record<string, unknown> | undefined;
  if (!u) return null;
  const h = (u.handle ?? u.fx ?? u) as Record<string, unknown>;
  return typeof h[method] === 'function' ? (h as unknown as T) : null;
}
const warned = new Set<string>();
function warnOnce(id: string, msg: string) { if (!warned.has(id)) { warned.add(id); console.warn(`[level6] ${msg}`); } }

// ───────────────────────────────────────────────────────────── containers (W4b's groups, dressed)

const PAINT: Record<string, ContainerColor> = { 'B-09': 'navy', 'B-10': 'orange', 'B-11': 'navy', 'B-12': 'orange' };
const CL = 6.0, CW = 2.4;

/** Stencil quads of one container (W5's atlas) as a group in the container's frame (origin floor centre, long axis x, doors +x). */
function containerStencils(L: LevelBuild, label: string): THREE.Object3D {
  const a = stencilAtlas6();
  const p = L.part(`cargo6_${label}_stencils`);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const put = (text: string, x: number, y: number, z: number, ry: number, h: number) => {
    const g = a.apply(new THREE.PlaneGeometry(1, 1), text);
    p.geo(a.material, g, 'keep', m.compose(v.set(x, y, z), q.setFromEuler(new THREE.Euler(0, ry, 0)), s.set(h * a.aspect(text), h, 1)).clone());
  };
  const hw = CW / 2 + 0.004, dx = CL / 2 + 0.016;
  for (const sd of [-1, 1]) {
    const z = sd * hw, ry = sd > 0 ? 0 : PI;
    put('할시온 바이오 시스템즈 사업부', -0.5 * sd, 1.85, z, ry, 0.42);
    put(label, 2.05 * sd, 1.05, z, ry, 0.5);
    put('HBSU 140 031 [4]', -0.5 * sd, 1.5, z, ry, 0.16);
  }
  put('HBSU 140 031 [4]', dx, 2.2, -0.55, PI / 2, 0.11);
  put(label, dx, 1.75, 0.6, PI / 2, 0.42);
  put('최대 총중량 30,480 KG', dx, 1.2, -0.6, PI / 2, 0.12);
  put('공차중량 2,250 KG', dx, 1.05, -0.6, PI / 2, 0.12);
  const g = p.build();
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
  return g;
}

function dressContainers(L: LevelBuild) {
  const groups = Object.keys(PAINT).map((id) => ({ id, g: L.objects.get(`cargo6_${id}`) })).filter((x): x is { id: string; g: THREE.Object3D } => !!x.g);
  if (!groups.length) return;
  for (const { id, g } of groups) {
    // the greybox box goes (the dock keeps its dynamic box; decals ride the group)
    for (const c of g.children.slice()) if ((c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry) { g.remove(c); (c as THREE.Mesh).geometry.dispose(); }
    g.add(containerStencils(L, id));
  }
  const items = groups.map(({ id, g }) => ({ m: g.matrixWorld.clone(), color: PAINT[id], n: null }));
  const inst = containerInstances(L, items, { rooms: ['pool6'] });
  // (the kit's own label mesh is not used: the stencils ride each container)
  for (const c of inst.children.slice()) if (!(c as THREE.InstancedMesh).isInstancedMesh) inst.remove(c);
  L.root.add(inst);
  const per: { im: THREE.InstancedMesh; i: number; g: THREE.Object3D }[] = [];
  for (const color of ['navy', 'orange'] as ContainerColor[]) {
    const im = inst.children.find((c) => c.name === `containers6:${color}`) as THREE.InstancedMesh | undefined;
    if (!im) continue;
    im.frustumCulled = false;
    groups.filter((x) => PAINT[x.id] === color).forEach((x, i) => per.push({ im, i, g: x.g }));
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const shown = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible && p !== inst) return false; return true; };
  const sync = () => {
    for (const { im, i, g } of per) {
      g.updateWorldMatrix(true, false);
      im.setMatrixAt(i, g.parent && shown(g) ? g.matrixWorld : zero);
      im.instanceMatrix.needsUpdate = true;
    }
  };
  sync();
  L.updaters.push(sync);
}

// ───────────────────────────────────────────────────────────── the dead loader (loader_dead6:snap)

/** §5.6.8 end state as a static wreck: bridge in its south buffers (z −192), trolley at the well's line (x −52). */
function buildWreck(L: LevelBuild): THREE.Object3D {
  const p = L.part('loader6_wreck');
  const Y = tmat6(L, 'crane_yellow'), K: Mat = 'painted_dark', S: Mat = 'steel_raw', R = tmat6(L, 'rope_wire');
  const soot = tint6(L, 'soot6', 'painted_dark', 0x161412, { roughness: 0.95 });
  const deadLens = lampLens6(L, 'white', 0);
  const bz = -192, tx = -52;
  // two box girders + end trucks with wheels and buffers
  for (const s of [-1, 1]) {
    const zc = bz + s * 1.35;
    p.bx(Y, -75.0, -4.0, zc - 0.35, -29.0, -2.6, zc + 0.35);
    p.detail(() => { for (let x = -74; x < -29.5; x += 2.0) p.bx(Y, x - 0.03, -3.96, Math.min(zc + s * 0.35, zc + s * 0.37), x + 0.03, -2.64, Math.max(zc + s * 0.35, zc + s * 0.37)); });
    p.bx('hazard_stripes', -75.0, -3.6, Math.min(zc + s * 0.351, zc + s * 0.356), -73.0, -3.0, Math.max(zc + s * 0.351, zc + s * 0.356));
    p.bx('hazard_stripes', -31.0, -3.6, Math.min(zc + s * 0.351, zc + s * 0.356), -29.0, -3.0, Math.max(zc + s * 0.351, zc + s * 0.356));
  }
  for (const x of [-75.4, -28.6]) {
    p.bx(Y, x - 0.45, -3.72, bz - 2.0, x + 0.45, -2.62, bz + 2.0);
    for (const z of [bz - 1.5, bz + 1.5]) p.cyl(S, x, -3.75, z, 0.25, 0.22, 'x', 16);
    p.cyl(K, x, -3.2, bz - 2.15, 0.14, 0.3, 'z', 12);
  }
  p.sign('도크 로더 DL-2 — SWL 32 T', 'stencil', -52, -3.3, bz - 1.703, 6.0, 0.5, '-z');
  // trolley on the girders: frame, hoist drum, gearbox, cabinet, the PA horn
  p.bx(Y, tx - 1.8, -2.6, bz - 1.75, tx + 1.8, -2.3, bz + 1.75);
  p.cyl(S, tx, -1.85, bz - 0.7, 0.45, 2.6, 'x', 20);
  p.bx(K, tx + 1.3, -2.3, bz - 1.3, tx + 1.75, -1.5, bz - 0.1);
  p.bx(K, tx - 1.4, -2.3, bz + 0.2, tx + 1.0, -1.0, bz + 1.6);
  p.cyl(K, tx - 1.2, -1.05, bz - 1.6, 0.13, 0.4, 'z', 12, 0.24);
  // the pod (blown): scorched box under the trolley, the cowl louvres hanging open, hanger rods
  p.bx(soot, tx - 0.8, -5.0, bz - 0.6, tx + 0.8, -4.0, bz + 0.6);
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.45, 0.45]) p.rod(K, tx + sx, -4.0, bz + sz, tx + sx, -2.6, bz + sz, 0.03, 6);
  for (let i = 0; i < 6; i++) p.rbox(Y, tx - 0.62 + i * 0.25, -4.55, bz - 0.64, 0.2, 0.7, 0.025, 0.9 + (i % 2) * 0.35, 0, (i % 3 - 1) * 0.12);
  p.detail(() => { p.rbox(soot, tx + 0.5, -5.12, bz - 0.2, 0.5, 0.03, 0.4, 0.4, 0.3, 0.2); p.rbox(soot, tx - 0.45, -5.08, bz + 0.25, 0.4, 0.03, 0.3, -0.3, 0.8, -0.25); });
  // rope stubs at the trolley sheaves (the falls ran out into the well)
  for (const sx of [-1.1, 1.1]) for (const sz of [-0.5, 0.5]) p.rod(R, tx + sx, -2.7, bz + sz, tx + sx * 1.05, -3.5 - Math.abs(sx * sz), bz + sz * 1.1, 0.02, 6);
  // floods drooped on their yokes, lenses dead: FL1 / FL2 on the trolley, FL3 / FL4 under the girders
  const head = (px: number, py: number, pz: number, hy: number) => {
    p.rod(K, px, py, pz, px, hy + 0.2, pz, 0.04, 8);
    p.cyl(K, px, hy, pz, 0.3, 0.42, 'y', 16);
    p.cyl(deadLens, px, hy - 0.215, pz, 0.26, 0.012, 'y', 16);
  };
  head(tx - 1.62, -2.5, bz - 2.08, -3.05); head(tx + 1.62, -2.5, bz - 2.08, -3.05);
  head(-66, -4.12, bz - 1.35, -4.75); head(-40, -4.12, bz + 1.35, -4.75);
  const g = p.build();
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = false; (o as THREE.Mesh).receiveShadow = true; } });
  const holder = new THREE.Group();
  holder.name = 'loader6_wreck_zone';
  holder.userData.rooms = ['pool6'];
  g.visible = false;
  holder.add(g);
  L.root.add(holder);
  return g;
}

// ───────────────────────────────────────────────────────────── pool6

function buildPool(L: LevelBuild) {
  const b = L.builder('pool6_d3b');
  const K: Mat = 'painted_dark';
  const orange = L.ctx.materials.get('painted_orange');

  // ── greybox visuals that this file replaces ──
  restyle(L, 'pool6_grey', isStandin, null);                       // the six shelves (P1 / P2, window walk, lockers)
  restyle(L, 'grey6:pool6_frame', isStandin, null);                // MC1, MC2, the cage box
  restyle(L, 'grey6:pool6_undercroft', isStandin, null);           // P1, P2
  dropItems6(L, 'pool6_grey', (m) => m === orange, [
    [-28.6, -12, -195.0, -28.2, -10.4, -194.2], [-75.8, -12, -195.0, -75.4, -10.4, -194.2], [-52.4, -12, -148.6, -51.6, -10.4, -148.2],
  ]);
  dropItems6(L, 'pool6_grey', (m) => m.name === 'grey_dark', [[-48.6, -19.0, -148.2, -47.4, -18.0, -148.15]]);

  // ── the undercroft (dock level under the mid deck) ──
  b.at(-63.0, DOCK, -155.0, 0, () => pumpHousing(b, L, { label: 'DEWATERING PUMP P1 — 340 M³/H', pipeTo: 3.6, collide: false }));
  b.at(-41.0, DOCK, -155.0, 0, () => pumpHousing(b, L, { label: 'DEWATERING PUMP P2 — 340 M³/H', pipeTo: 3.6, collide: false }));
  // the pumps' discharge mains: on along the slab's underside to the north wall and down into the floor
  for (const px of [-62.55, -40.55]) {
    b.rod('steel_raw', px, -16.55, -155.4, px, -16.55, -148.42, 0.12, 14);
    b.sphere('steel_raw', px, -16.55, -155.4, 0.13, 12);
    b.rod('steel_raw', px, -16.55, -148.42, px, DOCK, -148.42, 0.12, 14);
    b.cyl('steel_raw', px, -16.55, -153.0, 0.18, 0.04, 'z', 16);
    b.cyl('steel_raw', px, -18.4, -148.42, 0.18, 0.04, 'y', 16);
  }
  b.at(-57.0, -18.85, -148.2, PI, () => hoseReel(b, L, { collide: true }));
  stencil6(b, '세척 호스 2', -57.0, -18.25, -148.2, 0.7, 0.08, '-z');
  // the drain sump grille (a dark recess plate with a grating over it, both lying on the deck)
  b.detail(() => {
    b.quad(L.overlay('painted_dark'), -52.0, DOCK, -152.6, 1.3, 1.3, '+y', 0, 'box', 0.004);
    b.quad(L.overlay('deck_grate'), -52.0, DOCK, -152.6, 1.1, 1.1, '+y', 0, 'box', 0.009);
  });
  stencil6(b, '섬프 2 — 배수', -52.0, DOCK + 0.006, -153.5, 0.8, 0.12, '+y', { style: 'stencil' });
  // the dewatering panel (`note6_transfer`, use point (−48.0, −18.5, −148.7)): a wall cabinet with a dim display
  // (IA-6: the cabinet was built INTO the wall — its face on the wall's plane (z-fight) and the screen hidden behind it;
  //  now on the room side of the wall face z −148.2)
  b.bx(K, -48.7, -19.1, -148.28, -47.3, -17.9, -148.2);
  b.bx('screen_off', -48.45, -18.75, -148.292, -47.55, -18.2, -148.278);
  const lcd = lampLens6(L, 'amber', 0.25);
  b.detail(() => { for (let i = 0; i < 4; i++) b.bx(lcd, -48.4 + i * 0.12, -18.85, -148.295, -48.33 + i * 0.12, -18.8, -148.284); });
  b.rod('steel_raw', -48.0, -17.9, -148.24, -48.0, -16.3, -148.24, 0.03, 8);
  stencil6(b, '배수 / 이송 기록 — DL-2', -48.0, -17.72, -148.2, 1.4, 0.1, '-z');
  stencil6(b, '언더크로프트 — 펌프실', -66.5, -17.6, -148.2, 2.2, 0.18, '-z');

  // ── the mid deck: crates MC1 / MC2, the cage's stores box ──
  b.at(-65.4, MID, -159.4, 0, () => crate6(b, L, { w: 1.2, d: 1.2, h: 1.2, label: '도크 예비품 — MC1', collide: false }));
  b.at(-39.4, MID, -159.4, 0, () => crate6(b, L, { w: 1.2, d: 1.2, h: 1.2, label: '도크 예비품 — MC2', collide: false }));
  b.at(-54.5, MID, -166.7, PI / 2, () => storeBox(b, L, { w: 1.0, d: 0.6, h: 1.0, label: '케이지 저장고', collide: false }));
  stencil6(b, '전단부 접근 금지', -53.5, MID + 0.006, -171.3, 1.2, 0.14, '+y', { style: 'warning' });

  // ── the dock ammo lockers (gallery walls; interactables are the shell's / the story's) ──
  const lockers: [string, number, number, number, number, boolean][] = [
    // id, wall x, wall z, ry, shelfX, shelf
    ['locker6_e', -28.2, -194.6, -PI / 2, 1.0, true],
    ['locker6_w', -75.8, -194.6, PI / 2, -1.0, true],
    ['locker6_n', -52.0, -148.2, PI, 1.0, false],
  ];
  for (const [id, x, z, ry, sx, shelf] of lockers) {
    b.at(x, GAL, z, ry, () => {
      const lk = ammoLocker(b, L, { name: id, shelf, shelfX: sx, label: '탄약 — 5.56 — 사격 지점' });
      const o = new THREE.Object3D();
      o.name = id;
      o.position.copy(lk.use);
      Object.assign(o.userData, { open: lk.open, swing: () => lk.swing(), set: (v: boolean) => lk.set(v), isFull: () => lk.full, use: lk.use, shelf: lk.shelf, door: lk.door });
      L.objects.set(id, o);
    });
  }

  // ── window walk: fire points (niche 0.3 m off the wall), life rings; fenders on the wet dock's kerbs ──
  // (collider: the closed lower cabinet only — the niche above it holds the pickup and must stay free)
  for (const x of [-70.0, -34.0]) b.at(x, DOCK, -195.8, 0, () => { firePointCabinet(b, L, { w: 0.8, d: 0.45, h: 1.4, shelf: 1.0, label: '사격 지점 — 창측 통로', collide: false }); b.collide(-0.4, 0, 0, 0.4, 0.95, 0.45, 'metal', true); });
  for (const x of [-67.0, -37.0]) b.at(x, -18.3, -195.8, 0, () => lifeRing(b, L));
  b.at(-28.2, -10.5, -178.0, -PI / 2, () => lifeRing(b, L));
  b.at(-75.8, -10.5, -178.0, PI / 2, () => lifeRing(b, L));
  for (const x of [-61.0, -59.5]) b.at(x, DOCK - 0.04, -182.4, PI, () => fender(b, L, { len: 1.0, drop: 0.3 }));
  for (const x of [-44.5, -43.0]) b.at(x, DOCK - 0.04, -182.4, PI, () => fender(b, L, { len: 1.0, drop: 0.3 }));
  for (const x of [-58.0, -52.0, -46.0]) b.at(x, DOCK - 0.04, -194.0, 0, () => fender(b, L, { len: 1.2, drop: 0.3 }));

  // ── the dock board (screen 12 × 3 at (−52, −6.5, −148.22), facing −z): backing plate, bezel, caption ──
  const W0 = -58, W1 = -46, H0 = -8, H1 = -5;
  b.bx(K, W0, H0, -148.2, W1, H1, -148.21);
  b.bx(K, W0 - 0.18, H1, -148.2, W1 + 0.18, H1 + 0.18, -148.28);
  b.bx(K, W0 - 0.18, H0 - 0.18, -148.2, W1 + 0.18, H0, -148.28);
  b.bx(K, W0 - 0.18, H0, -148.2, W0, H1, -148.28);
  b.bx(K, W1, H0, -148.2, W1 + 0.18, H1, -148.28);
  for (const x of [W0 + 1.0, W1 - 1.0]) b.rod('steel_raw', x, H1 + 0.18, -148.24, x, -2.0, -148.24, 0.025, 6);
  stencil6(b, '도크 상태 — 헤드엔드 중계기', -52.0, H1 + 0.42, -148.2, 4.0, 0.26, '-z', { plate: true });

  // ── signs ──
  stencil6(b, '문풀 — 2,140 M', -75.8, -8.4, -176.0, 7.0, 0.8, '+x');
  stencil6(b, '에리두 심해 — 도크', -75.8, -9.4, -176.0, 3.6, 0.36, '+x');
  b.sign('화물 록 — 내부 문 닫힘', 'danger', -61.5, -14.35, -166.075, 3.0, 0.32, '-z', 0, true);
  b.sign('화물 록 — 내부 문 닫힘', 'danger', -42.5, -14.35, -166.075, 3.0, 0.32, '-z', 0, true);
  for (const cx of [-61.5, -42.5]) for (const x of [cx - 1.3, cx + 1.3]) b.rod('steel_raw', x, -14.17, -166.08, x, -13.62, -166.02, 0.008, 4);
  for (const [x, z, rot] of [[-62.0, -168.0, 0], [-42.0, -168.0, 0], [-70.8, -188.5, PI / 2], [-33.2, -188.5, -PI / 2]] as const) {
    stencil6(b, '로더 작업 구역 — 접근 금지', x, DOCK + 0.006, z, 4.2, 0.34, '+y', { style: 'warning', rot });
  }

  // ── the containers (they exist once the dock is built: after the rooms, before the doors) ──
  L.afterDoors.push(() => dressContainers(L));

  // ── vignettes ──
  const ctx = L.ctx;
  const EYES = [
    { position: new THREE.Vector3(-56.95, -28.2, -176.12) }, { position: new THREE.Vector3(-56.95, -28.2, -175.9) },
    { position: new THREE.Vector3(-47.05, -29.4, -176.02) }, { position: new THREE.Vector3(-47.05, -29.4, -176.24) },
  ];
  const well = () => fxHandle<WellFx>(L, 'fx6_well', 'eyes');
  let unsub: (() => void) | null = null;
  const eyesOff = () => { well()?.eyes(false); unsub?.(); unsub = null; };
  L.vignette('v6_well_eyes', () => {
    const w = well();
    if (!w) { warnOnce('well', 'v6_well_eyes: no well fx handle (L.objects "fx6_well".userData.handle)'); return; }
    w.eyes(true, EYES);
    unsub ??= ctx.events.on('boss:stage', (e) => { if (e.stage >= 1) eyesOff(); });
  }, { snap: eyesOff });
  L.vignette('v6_window', () => {
    const s = fxHandle<SeaFx>(L, 'fx6_sea', 'pass');
    if (s) s.pass(4); else warnOnce('sea', 'v6_window: no viewport fx handle (L.objects "fx6_sea".userData.handle)');
    L.sfx('sea_groan', -52, -18, -204, 0.85);
  }, { snap: () => { /* nothing persists: the shape is gone */ } });
  const wreck = buildWreck(L);
  L.vignette('loader_dead6', () => { /* the live death is the rig's (W3a / W3b) */ }, {
    snap: () => {
      // the static wreck only once the live loader is gone (`boss.removeSilently()` first; a short wait covers the order)
      let t = 0;
      const show = () => { const live = ctx.enemies.boss('g6_loader'); if (!live) { wreck.visible = true; return true; } return false; };
      if (!show()) L.sim((dt) => { t += dt; return !(show() || t > 3); });
    },
  });
}

// ───────────────────────────────────────────────────────────── stores6 (x −76 … −64, z −148 … −140, y −12, h 3.6)

function buildStores(L: LevelBuild) {
  const b = L.builder('stores6_d3b');
  const y = GAL, X0 = -75.8, X1 = -64.2, Z1 = -140.2;
  // north wall: two shelving units; west wall: a shelf + life jackets; east: crates and a hose reel
  b.at(-73.4, y, Z1, PI, () => wallShelf6(b, L, { w: 2.4, d: 0.45, seed: 61 }));
  b.at(-66.8, y, Z1, PI, () => wallShelf6(b, L, { w: 2.4, d: 0.45, seed: 62 }));
  b.at(X0, y, -142.6, PI / 2, () => wallShelf6(b, L, { w: 2.0, d: 0.4, seed: 63 }));
  for (const z of [-144.9, -145.75, -146.6]) b.at(X0, y + 1.6, z, PI / 2, () => lifeRing(b, L, { label: '에리두 심해 — 도크 저장고' }));
  b.at(-65.0, y, -146.7, 0, () => crate6(b, L, { w: 1.2, d: 1.4, h: 1.2, label: '양중 장비 — 슬링 / 섀클' }));
  b.at(-65.0, y, -144.8, 0, () => crate6(b, L, { w: 1.2, d: 1.2, h: 0.9, label: '로프 — 32 MM 와이어' }));
  b.at(X1, y + 1.3, -142.0, -PI / 2, () => hoseReel(b, L, { collide: true }));
  b.at(-74.9, y, -147.2, 0, () => storeBox(b, L, { w: 1.0, d: 0.8, h: 0.8, label: 'OIL ABSORBENT' }));
  b.at(-74.9, y + 0.8, -147.25, 0, () => storeBox(b, L, { w: 0.8, d: 0.6, h: 0.5, label: 'SHACKLES' }));
  b.at(-66.4, y, -141.5, 0, () => spareCoil(b, L, { r: 0.55 }));
  // ceiling fitting at the room's light (−70, −9.0, −144): batten on drop rods
  b.at(-70.0, y + 3.6, -144.0, 0, () => tunnelFitting(b, L, { len: 1.2, drop: 0.45, color: 'warm' }));
  stencil6(b, '도크 저장고 — 노화 금지', -70.0, y + 2.75, Z1, 2.8, 0.22, '-z', { plate: true });
}

export const DOCK_DRESS: Partial<Record<RoomId6, RoomDress>> = {
  pool6: { build: buildPool },
  stores6: { build: buildStores, look: { wall: 'navy_grey', ceiling: 'ceiling_panel', floor: 'deck_nonslip' }, label: false },
};
