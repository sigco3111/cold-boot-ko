/**
 * POST 4 — berthing, the washroom, the mess, the galley (stage 3c §2.6, §2.7, §5.5; task D2b).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const QUARTERS_DRESS: Partial<Record<RoomId5, RoomDress>>
 * for the rooms berths5, heads5, mess5, galley5. Per room: `build(L)`, `lights: []` (each build places its own §2.7.1
 * rows through `placeLights5` and binds the fittings' lenses to them — group names unchanged), `look`, `label: false`.
 *
 * The level's quiet stretch: the living quarters of two dozen sailors who walked out mid-meal on Monday. Berthing under
 * red "darken ship" night lights (made and thrown-back bunks, photos, boots, a reading lamp still on in one bunk, a radio
 * on its bunk shelf); a washroom with four sinks and three showers; a mess with the trays still on the tables and the
 * cake order on the board; a galley with pots on the range and a walk-in cold room behind a frosted window.
 *
 * Stand-ins: every `grey_standin` visual of the four shells is replaced by a kit prop drawn with `collide: false` over the
 * shell's collider (one collider per object). Exceptions (decisions, see the report):
 *  - berths5: the east row's middle bunk stand-in (x 21.2 … 23.2, z −8.6 … −7.7) stood 0.6 m in front of `d5_berth_mess`
 *    (z −8.8 … −7.2): a 0.6 m slot is narrower than the 0.7 m capsule, so the berths ↔ mess door was unusable. Its
 *    collider is dropped and the bunk stands at z −6.4 … −5.5 (its own collider). The two north bunks face south (their
 *    backs to the north wall) with a sea-chest cabinet behind each — the bunk-end shelves of `p5_berth_shells` /
 *    `p5_berth_med` (tops 0.67).
 *  - heads5: the sink counter's collider (to 0.9) is replaced by a base to 0.72 plus the counter's rim strips: a solid
 *    top at 0.9 would cut the taps' streams off 16 cm above the basins.
 *
 * Vignettes (each fires once — the story's `scareOk` decides when; each has a silent `:snap` = its end state; every
 * sound is played here exactly once, §8.11; debris has no colliders):
 *  - `v5_bunk_radio` (berths5): click on (dial flickers up green) → static bed → the story speaks `l5_choir_names`
 *    positionally at `mk5_bunk_radio` at `RADIO5.voiceAt` (published on the marker's `userData.v5`) → at
 *    `RADIO5.offAt` (6.0 s) the knob clicks, the static cuts, the dial dies. Snap: radio off.
 *  - `v5_water` (heads5): a hammer-bang in the wall pipes, all four taps run (streams `fx5_taps`) 2.5 s while the mirror
 *    strip stutters, valves clack shut, the drains gurgle. Snap: taps off, mirror light steady.
 *  - `v5_trays` (mess5): the dock pump double-thumps behind the galley wall (shake 0.15, the mess lights dip), 0.55 s
 *    later thirty trays and the cutlery bin slide off the serving counter toward the player and crash across the deck
 *    (`trayStack.fall()` timings). Snap: trays on the floor.
 *  - `v5_galley_shape` (galley5): the cold-room fan spins up behind the frosted window; the draught takes the yellow
 *    oilskin on its hook — a man-sized shape swings across the frost and back, the hook creaks; the fan keeps running
 *    (`fan_loop`). Close to the glass its clear corner shows the sleeve. Snap: fan running (its loop starts when the
 *    player is next near the galley), oilskin swaying idle.
 *  - `v5_body` (berths5 → spine5): silent; the galley cook's body (kit5 `navyBody`, B4) vanishes from `mk5_body_a` and lies at `mk5_body_b`
 *    (walkable 0.15 m box moves with it); the berths half of the drag smear (A → `d5_berth`) appears. The spine half is
 *    D2a's: this vignette shows `L.objects.get('v5_body_smear')` (calls `userData.show()` if it has one, else sets it
 *    visible). Snap: the same.
 */
import * as THREE from 'three';
import type { LightHandle, LoopHandle } from '../../core/types';
import type { FxSystemEx } from '../../fx';
import type { Builder } from '../builder';
import type { LevelBuild } from '../context';
import { artMat, isStandin, mug, paint, paper, restyle } from '../l3/kit3';
import { addWet, box3, placeLights5, type LightRow5, type RoomId5 } from './grey';
import type { RoomDress } from './index';
import {
  bunkRadio, frostedWindow, navyBody, galleyRange, messTable, navySign, nightLightMat, noticeBoard, oilskin, openShelf, prepTable,
  drapeGeo, servingCounter, serviceRun, showerStalls, sinkRow, strip5, trayStack, tripleBunk, drainGrate, vesselRoom,
  type BunkRadio, type Oilskin, type TrayStack,
} from './kit5';

const PI = Math.PI;
type Box6 = [number, number, number, number, number, number];
const WARM = 0xffe2c0, RED = 0xff2a18, COOL = 0xdce8ff;

/** `v5_bunk_radio` timing (s from the vignette): the story starts `l5_choir_names` at `voiceAt`; the set clicks off at `offAt`. */
export const RADIO5 = { voiceAt: 0.9, offAt: 6.0 };

const fxOf = (L: LevelBuild) => L.ctx.fx as FxSystemEx;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────────────────────────────────────────────────────────── shared helpers

/**
 * Remove one shell collider (a stand-in this dressing replaces with its own, "replace both" — grey.ts header) from the
 * static collider set, the nav obstacles and the solids. Matches the world AABB exactly (1 mm).
 */
function dropCollider(L: LevelBuild, bx: Box6): number {
  const t = box3(bx), unit = new THREE.Box3(V(-0.5, -0.5, -0.5), V(0.5, 0.5, 0.5));
  const same = (b: THREE.Box3) => b.min.distanceTo(t.min) < 1e-3 && b.max.distanceTo(t.max) < 1e-3;
  let n = 0;
  const items = (L as unknown as { colliderItems: Record<string, { m: THREE.Matrix4 }[]> }).colliderItems;
  for (const list of Object.values(items)) for (let i = list.length - 1; i >= 0; i--) if (same(unit.clone().applyMatrix4(list[i].m))) { list.splice(i, 1); n++; }
  for (const arr of [L.solids, L.obstacles, L.navSolids]) for (let i = arr.length - 1; i >= 0; i--) if (same(arr[i])) arr.splice(i, 1);
  return n;
}

/**
 * A vignette's own clock: `at(delay, fn)` runs `fn` after `delay` unless the vignette was snapped in between (a checkpoint
 * restore mid-scare must not replay a later beat of it — a second crash, a click).
 */
function cues(L: LevelBuild) {
  let gen = 0;
  return {
    start() { return ++gen; },
    cancel() { gen++; },
    at(g: number, delay: number, fn: () => void) { L.after(delay, () => { if (g === gen) fn(); }); },
  };
}

/** Light rows for a room, placed here so the fittings can bind to them (index.ts gets `lights: []`). */
function lights(L: LevelBuild, rows: LightRow5[]): LightHandle[] { return placeLights5(L, rows); }

/** Fluorescent ceiling fitting under a ceiling at `y` (1.25 m tube, opal diffuser bound to `h`). */
function tubeFitting(b: Builder, L: LevelBuild, h: LightHandle, x: number, y: number, z: number, alongX: boolean, kind: 'emissive_white' | 'emissive_warm' = 'emissive_warm', len = 1.25) {
  const glow = L.glow(h, kind, 0.5);
  b.push(x, y, z, alongX ? 0 : PI / 2);
  b.bx('navy_grey', -len / 2, -0.07, -0.13, len / 2, 0, 0.13);
  b.bx(glow, -len / 2 + 0.04, -0.09, -0.09, len / 2 - 0.04, -0.07, 0.09);
  b.detail(() => { for (const s of [-1, 1]) b.bx('steel_raw', -len / 2 + 0.02, -0.095, s * 0.1 - 0.01, len / 2 - 0.02, -0.07, s * 0.1 + 0.01); });
  b.pop();
}

/** Red "darken ship" ceiling lamp: round cast base, a red dome in a guard, its lens bound to `h`. */
function redDome(b: Builder, L: LevelBuild, h: LightHandle, x: number, y: number, z: number) {
  const glow = L.glow(h, 'emissive_red', 0.55);
  b.cyl('navy_grey', x, y - 0.02, z, 0.13, 0.04, 'y', 16);
  b.sphere(glow, x, y - 0.05, z, 0.09, 12, 0.6);
  b.detail(() => { b.torus('steel_raw', x, y - 0.06, z, 0.1, 0.006, 'y', 14); for (let k = 0; k < 4; k++) { const a = (k / 4) * PI; b.rod('steel_raw', x - Math.cos(a) * 0.1, y - 0.04, z - Math.sin(a) * 0.1, x + Math.cos(a) * 0.1, y - 0.04, z + Math.sin(a) * 0.1, 0.005, 4); } });
}

/** A stainless compartment tray on a table with the meal left in it (static), a mug or a fork beside it. */
function mealTray(b: Builder, L: LevelBuild, x: number, y: number, z: number, ry: number, k: number) {
  const food = [paint(L, 0x8a5a32, 0.7), paint(L, 0xc9b06a, 0.75), paint(L, 0x5e7a3a, 0.7), paint(L, 0xd8d0b8, 0.6)];
  b.push(x, y, z, ry);
  b.bx('stainless', -0.21, 0, -0.15, 0.21, 0.012, 0.15);
  b.detail(() => {
    for (const s of [-1, 1]) b.bx('stainless', -0.21, 0.012, s * 0.15 - (s > 0 ? 0.006 : 0), 0.21, 0.026, s * 0.15 + (s < 0 ? 0.006 : 0));
    b.bx('stainless', -0.21, 0.012, 0.025, 0.21, 0.022, 0.03);
    // the meal: a main portion, a side, bread; one tray half eaten, one barely touched
    const eaten = k % 3;
    b.rbox(food[k % 2], -0.09, 0.02, -0.06, eaten === 1 ? 0.12 : 0.18, 0.018, 0.13, 0, 0.2 * k, 0);
    b.rbox(food[2 + (k % 2)], 0.11, 0.019, -0.07, 0.12, 0.014, 0.1, 0, -0.3, 0);
    if (eaten !== 2) b.rbox(food[1], 0.1, 0.03, 0.09, 0.1, 0.04, 0.06, 0, 0.4, 0.1);
    b.rbox('stainless', -0.02, 0.016, 0.1, 0.18, 0.004, 0.016, 0, 0.25 - 0.5 * (k % 2), 0); // fork
  });
  b.pop();
  if (k % 2 === 0) b.at(x + Math.cos(ry) * 0.3, y, z - Math.sin(ry) * 0.3, 0.4 * k, () => mug(b, L, k));
}

/** Lying-on-the-floor clutter (boots, a kit bag). */
function boots(b: Builder, L: LevelBuild, x: number, z: number, ry: number) {
  b.at(x, 0, z, ry, () => { for (const s of [-1, 1]) { b.rbox('rubber', s * 0.07, 0.02, 0, 0.1, 0.04, 0.29, 0, 0, 0); b.rbox(paint(L, 0x1c1c1e, 0.5), s * 0.07, 0.11, -0.05, 0.09, 0.16, 0.13, 0, 0, 0); } });
}

/**
 * The kit's frost lets a lit shape behind it read almost sharp (alpha ≈ 0.74). Thicken it (≈ 0.88; the clear corner and
 * the condensation runs keep their lower alpha) so the coat is a soft dark shape against the back-lit cold room.
 */
function thickenFrost(L: LevelBuild, key: string) {
  let m: THREE.MeshStandardMaterial | undefined;
  const bs = (L as unknown as { builders: { batches: Map<string, { mat: THREE.Material }> }[] }).builders;
  for (const b of bs) for (const bt of b.batches.values()) if (bt.mat.name === 'k5_frost' && (bt.mat as THREE.MeshStandardMaterial).map) m = bt.mat as THREE.MeshStandardMaterial;
  const c = m?.map?.image as HTMLCanvasElement | undefined;
  if (!m || !c?.getContext) { console.warn(`[quarters] frost ${key} not found`); return; }
  const g = c.getContext('2d')!, img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 150) d[i] = Math.min(255, Math.round(d[i] * 1.12 + 18));
  g.putImageData(img, 0, 0);
  m.map!.needsUpdate = true;
}

// ───────────────────────────────────────────────────────────── berths5 (x 12 … 24, z −14 … −2, h 3.0)

/** The six bunks (x row, z centre, ry, curtains, made). North bunks face south (backs to the sea chests). */
const BUNKS: [number, number, number, number[], boolean[]][] = [
  [13.8, -12.35, 0, [1, 0.3, 0.75], [true, false, true]],
  [13.8, -8.15, 0, [0.85, 1, 0.2], [false, false, true]],   // the radio bunk: middle tier open, its reading lamp on
  [13.8, -3.65, PI, [0.4, 0.9, 1], [true, true, false]],
  [22.2, -12.35, PI, [0.6, 1, 0.3], [false, true, true]],
  [22.2, -5.95, PI, [1, 0.25, 0.9], [true, false, false]],  // moved off d5_berth_mess (see header)
  [22.2, -3.65, PI, [0.2, 0.7, 1], [true, true, true]],
];
const BUNK_MOVED: Box6 = [21.2, 0, -8.6, 23.2, 2.2, -7.7];
const BODY_A = { x: 19.6, z: -12.4, ry: PI / 2 };
/** (B4) Dragged out by the ankles, westward along the spine: the feet lead (local +z → −x), the head east. */
const BODY_B = { x: 14.2, z: -16.9, ry: -PI / 2 };

interface BodyParts { a: THREE.Group; b: THREE.Group; boxA: { enabled: boolean }; boxB: { enabled: boolean }; smear: THREE.Group }

function berthsBody(L: LevelBuild): BodyParts {
  // one body drawn once (a part), shown at A and — after `v5_body` — at B (a clone sharing its geometry)
  const part = L.part('v5_body');
  // (B4) a navy cook in working dress and a white apron, face down, in the dragged pose (kit5 `navyBody`; no longer
  // level 4's lab suit — and no `mk4_bodies` marker in level 5)
  const info = navyBody(part, L, { seed: 5150 });
  const g = part.build();
  const mount = (name: string, room: string, p: { x: number; z: number; ry: number }, src: THREE.Object3D) => {
    const m = new THREE.Group();
    m.name = name;
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.ry;
    m.userData.rooms = [room];
    m.add(src);
    L.root.add(m);
    return m;
  };
  const a = mount('v5_body_a', 'berths5', BODY_A, g);
  const bG = mount('v5_body_b', 'spine5', BODY_B, g.clone());
  bG.children[0].visible = false;
  // the walkable 0.15 m box over the footprint, moved with the body (§5.5: never a step on the route)
  const walk = (p: { x: number; z: number; ry: number }, on: boolean) => {
    const bb = info.box.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(p.ry).setPosition(p.x, 0, p.z));
    const d = L.ctx.physics.addBox(new THREE.Box3(V(bb.min.x, 0, bb.min.z), V(bb.max.x, 0.15, bb.max.z)), 'flesh');
    d.walkable = true;
    d.enabled = on;
    return d;
  };
  const boxA = walk(BODY_A, true), boxB = walk(BODY_B, false);
  // the berths half of the drag smear: from where it lay to the door threshold (hidden until it was dragged)
  const sm = L.part('v5_body_smear_berths');
  const pts: [number, number][] = [[19.4, -12.6], [19.0, -13.1], [18.5, -13.5], [18.1, -13.85]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az) + 0.25;
    sm.decal('blood_smear', i % 2, (ax + bx) / 2, 0.0, (az + bz) / 2, 0.42, len, '+y', Math.atan2(bx - ax, bz - az) + PI, 0.003 + i * 0.0006);
  }
  const smear = sm.build();
  smear.name = 'v5_body_smear_berths';
  const sMount = new THREE.Group();
  sMount.userData.rooms = ['berths5', 'spine5'];
  sMount.add(smear);
  smear.visible = false;
  L.root.add(sMount);
  return { a, b: bG, boxA, boxB, smear };
}

const berths5: RoomDress = {
  label: false,
  look: { floor: 'lino_navy', wall: 'hull_white', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    restyle(L, 'berths5_grey', isStandin, null);
    dropCollider(L, BUNK_MOVED);
    const b = L.builder('berths5_dress');
    // ── the hull (B1): frames at the spine's pitch across the room, plate-and-beam deckhead, overhead services ──
    {
      const st = vesselRoom(b, L, {
        x0: 12.2, x1: 23.8, z0: -13.8, z1: -2.2, h: 3.0, axis: 'z', web: 0.14,
        clear: [['x1', -11.6, -6.3], ['z1', 14.2, 17.8], ['z0', 16.2, 19.8]],
      });
      const ceil = 3.0 - 0.152;
      serviceRun(b, L, { along: 'z', a: -13.8, b: -2.2, c: 16.2, ceil, hangers: st, pipes: [[0.05, 0, 0.03, 'pipe'], [0.035, -0.17, 0.05, 'steel']] });
      serviceRun(b, L, { along: 'z', a: -13.8, b: -2.2, c: 19.9, ceil, hangers: st, pipes: [[0.06, 0, 0.03, 'lagged']], tray: { w: 0.3, c: 0.3, drop: 0.08 } });
    }
    // ── lights (§2.7.1: 2 red points all + the reading lamp medium+) ──
    // (IB5c: the reds hang 0.4 m below the deckhead's beams (2.85 − 0.4 ≈ 2.05 under the domes' pools, no hot disc on the
    // plating) and a dim third red between them, every quality, so the aisle between the two pools does not go black)
    const [r1, r2, reading] = lights(L, [
      { group: 'berths5', type: 'point', p: [18, 2.05, -11], color: RED, i: 7.5, d: 11 },
      { group: 'berths5', type: 'point', p: [18, 2.05, -5], color: RED, i: 7.5, d: 11 },
      { group: 'berths5', type: 'point', p: [14.05, 1.5, -8.0], color: 0xffd8a0, i: 2.2, d: 4, min: 'medium' },
      { group: 'berths5', type: 'point', p: [18, 2.1, -8.0], color: RED, i: 2.6, d: 6.5, prio: 0.7 },
    ]);
    redDome(b, L, r1, 18, 3.0, -11);
    redDome(b, L, r2, 18, 3.0, -5);
    // bunk night lights follow the reds
    r1.bindEmissive(nightLightMat(L), 1.0);
    // ── six triple bunks ──
    BUNKS.forEach(([x, z, ry, curtains, made], i) => b.at(x, 0, z, ry, () => tripleBunk(b, L, { w: 0.9, curtains, made, collide: i === 4 })));
    // the reading lamp in the radio bunk (middle tier, head end): a clip lamp lit, bound to its light (medium+)
    {
      const lens = L.glow(reading, 'emissive_warm', 0.6);
      b.bx('painted_dark', 12.86, 1.36, -8.35, 12.92, 1.46, -8.2);
      b.rod('painted_dark', 12.9, 1.46, -8.27, 13.1, 1.56, -8.15, 0.008, 5);
      b.cyl('painted_dark', 13.15, 1.55, -8.12, 0.05, 0.07, 'x', 10, 0.035);
      b.bx(lens, 13.19, 1.52, -8.15, 13.2, 1.58, -8.09);
    }
    // the radio on its bunk shelf (front of the middle tier, facing the aisle): `mk5_bunk_radio` (13.6, 1.3, −7.6)
    b.bx('navy_grey', 13.45, 1.2, -7.66, 13.78, 1.215, -7.4);
    b.detail(() => { for (const x of [13.48, 13.75]) b.rod('steel_raw', x, 1.2, -7.42, x, 1.07, -7.64, 0.006, 4); });
    let radio!: BunkRadio;
    b.at(13.6, 1.215, -7.53, PI / 2, () => { radio = bunkRadio(b, L, { on: false }); });
    const mk = L.objects.get('mk5_bunk_radio');
    if (mk) mk.userData.v5 = { ...RADIO5 };
    // ── sea chests behind the north bunks (the bunk-end shelves of the two pickups, tops 0.67) ──
    for (const [x0, x1] of [[12.8, 14.8], [21.2, 23.8]] as const) {
      b.bx('navy_grey', x0, 0, -3.15, x1, 0.64, -2.22);
      b.bx('steel_raw', x0 - 0.01, 0.64, -3.16, x1 + 0.01, 0.67, -2.2);
      b.detail(() => { for (let x = x0 + 0.1; x < x1 - 0.3; x += 0.66) { b.bx('navy_grey', x, 0.06, -3.16, x + 0.56, 0.58, -3.15); b.bx('steel_raw', x + 0.22, 0.48, -3.18, x + 0.34, 0.5, -3.16); } });
      b.collide(x0, 0, -3.16, x1, 0.67, -2.2, 'metal', true);
    }
    // ── the sailors' things: photos on the head panels, names, boots, a kit bag, a paperback, a towel ──
    b.detail(() => {
      const ph = [[12.83, 1.25, -8.35, 3], [12.83, 1.32, -8.05, 7], [12.83, 0.5, -12.5, 2], [23.17, 1.3, -12.2, 5], [23.17, 0.52, -5.75, 9], [23.17, 1.27, -3.8, 4]] as const;
      for (const [x, y, z, s] of ph) b.quad(artMat(L, 'photo', s), x, y, z, 0.1, 0.13, x < 18 ? '+x' : '-x', (s % 3 - 1) * 0.06);
      b.sign('수병 닐센 K.', 'label', 13.35, 0.985, -7.7, 0.3, 0.05, '+z');
      b.sign('선임수병 룬드 P.', 'label', 13.35, 0.235, -11.9, 0.3, 0.05, '+z');
      b.sign('수병 솔베르그 T.', 'label', 22.65, 0.985, -12.8, 0.3, 0.05, '-z');
      b.sign('침실구역 1 — 2200–0600 소등', 'stencil', 23.79, 2.35, -10.5, 2.2, 0.14, '-x');
      b.sign('FR 44', 'stencil', 12.21, 2.6, -10.0, 0.4, 0.14, '+x');
      b.quad(paper(L, 0xd9cfb4), 13.9, 1.08, -8.05, 0.2, 0.13, '+y', 0.5);          // a paperback face down on the radio bunk
      b.quad(paper(L, 0xb8c4cc), 22.4, 0.333, -12.1, 0.7, 0.4, '+y', -0.3);        // a towel thrown on a bottom bunk
    });
    boots(b, L, 15.25, -11.55, 0.15);
    boots(b, L, 20.85, -6.6, -0.3);
    boots(b, L, 15.2, -4.5, 3.0);
    b.cyl(paint(L, 0x26324a, 0.85), 22.2, 2.3, -3.55, 0.17, 0.75, 'x', 10);       // a kit bag on a top bunk's canopy
    // ── a red floor strip along both aisle edges (the room reads with the lamp off) ──
    strip5(b, L, 15.0, -13.4, 15.0, -2.6, { ch: 'red' });
    strip5(b, L, 21.0, -13.4, 21.0, -9.4, { ch: 'red' });
    strip5(b, L, 21.0, -6.6, 21.0, -2.6, { ch: 'red' });
    // the old stain under where the body lies (seen once it has been dragged away)
    b.decal('blood_pool', 0, 19.7, 0.0, -12.5, 0.9, 0.7, '+y', 0.4, 0.0025);
    // ── the body (v5_body) ──
    const bp = berthsBody(L);

    // ── v5_bunk_radio ──
    let staticBed: LoopHandle | null = null;
    const rc = cues(L);
    const radioOff = (silent: boolean) => {
      staticBed?.stop(silent ? 0 : 0.12);
      staticBed = null;
      radio.at(0);
    };
    L.vignette('v5_bunk_radio', () => {
      const p = V(13.6, 1.3, -7.6);
      L.sfx('radio_on_click', p.x, p.y, p.z, 0.9);
      // the dial warms up with a stutter, then holds
      L.tween(0.04, 0.5, (k) => radio.at(k < 0.3 ? (Math.random() < 0.5 ? k * 2 : 0.15) : 0.6 + 0.4 * k));
      const g = rc.start();
      rc.at(g, 0.12, () => { if (!L.silent) staticBed = L.ctx.audio.loop('radio_static_bed', { position: p, volume: 0.85 }); });
      // under the names the static ducks a little
      rc.at(g, RADIO5.voiceAt - 0.1, () => staticBed?.setVolume(0.55, 0.3));
      rc.at(g, RADIO5.offAt, () => { L.sfx('radio_on_click', p.x, p.y, p.z, 0.8, 0.92); radioOff(false); });
    }, { snap: () => { rc.cancel(); radioOff(true); } });

    // ── v5_body ──
    const moved = () => {
      bp.a.children[0].visible = false;
      bp.b.children[0].visible = true;
      bp.boxA.enabled = false;
      bp.boxB.enabled = true;
      bp.smear.visible = true;
      const sm = L.objects.get('v5_body_smear');
      if (sm) { const show = sm.userData.show as (() => void) | undefined; if (show) show(); else sm.visible = true; }
    };
    L.vignette('v5_body', moved, { snap: moved });
  },
};

// ───────────────────────────────────────────────────────────── heads5 (x 12 … 20, z −2 … 4, h 2.8)

const heads5: RoomDress = {
  label: false,
  look: { floor: 'tile_ceramic', wall: 'hull_white', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    restyle(L, 'heads5_grey', isStandin, null);
    const b = L.builder('heads5_dress');
    const fx = fxOf(L);
    // the hull (B1): two frames across the washroom, the beams over the showers; services along the north side
    const st = vesselRoom(b, L, {
      x0: 12.2, x1: 19.8, z0: -1.8, z1: 3.8, h: 2.8, axis: 'x', web: 0.14, stiff: 0,
      clear: [['z0', 14.2, 17.8], ['z1', 14.2, 16.95]],
    });
    serviceRun(b, L, { along: 'x', a: 12.2, b: 19.8, c: 3.3, ceil: 2.8 - 0.152, hangers: st, pipes: [[0.04, 0, 0.03, 'pipe'], [0.03, -0.14, 0.04, 'steel'], [0.05, -0.32, 0.03, 'lagged']] });
    const [lamp] = lights(L, [{ group: 'heads5', type: 'point', p: [16, 2.45, 1], color: COOL, i: 9, d: 8, flicker: 'fluorescent' }]);
    tubeFitting(b, L, lamp, 16, 2.8 - 0.072, 1.0, false, 'emissive_white');
    // ── four sinks + mirror on the west wall (origin on the wall face x 12.2, front +x) ──
    // the sink counter's collider: a base to 0.72 + the rim strips (see header) instead of the slab to 0.9
    dropCollider(L, [12.2, 0, -1.0, 12.8, 0.9, 3.0]);
    let sinks!: { spouts: THREE.Vector3[]; light: THREE.MeshStandardMaterial };
    b.at(12.2, 0, 1.0, PI / 2, () => { sinks = sinkRow(b, L, { n: 4, pitch: 0.85, d: 0.6, top: 0.9, spoutH: 0.3, collide: false }); });
    b.collide(12.2, 0, -1.0, 12.8, 0.72, 3.0, 'metal', true);
    b.collide(12.2, 0.72, -1.0, 12.34, 0.9, 3.0, 'metal', false);
    b.collide(12.64, 0.72, -1.0, 12.8, 0.9, 3.0, 'metal', false);
    // the cabinet under the counter (the kit leaves it open to the traps; a kick panel and two doors)
    b.bx('navy_grey', 12.22, 0.02, -0.7, 12.7, 0.72, 2.7);
    b.detail(() => { for (const z of [-0.2, 0.65, 1.5, 2.35]) b.bx('steel_raw', 12.705, 0.5, z - 0.06, 12.72, 0.53, z + 0.06); });
    // ── three shower stalls on the east wall (origin on the wall face x 19.8, front −x; inner partitions = the shell's) ──
    b.at(19.8, 0, 1.15, -PI / 2, () => showerStalls(b, L, { n: 3, w: 1.5, d: 1.4, h: 2.0, curtains: [0.25, 1, 0.55], collide: false }));
    for (const z of [-1.1, 3.4]) b.collide(18.4, 0, z - 0.015, 19.8, 2.0, z + 0.015, 'metal', true);
    for (const z of [-0.35, 1.15, 2.65]) b.at(17.95, 0, z, 0, () => drainGrate(b, L, { w: 0.22 }));
    // towel hooks, a towel dropped on the deck, soap, a razor; stencils
    b.detail(() => {
      for (const z of [-0.6, -0.2]) b.rod('chrome', 15.2, 1.6, 3.79, 15.2, 1.6, 3.7, 0.008, 5).cyl('chrome', 15.2, 1.6, 3.7, 0.012, 0.01, 'z', 6);
      b.quad(paper(L, 0xc8d2d8), 15.6, 0.004, 2.6, 0.55, 0.35, '+y', 0.7);
      b.quad(paper(L, 0xc8d2d8), 15.2, 1.25, 3.785, 0.32, 0.6, '-z', 0.02);
      for (const [z, c] of [[-0.45, 0xe8e4d0], [0.4, 0x6a8aa8], [1.25, 0xe8e4d0]] as const) b.bx(paint(L, c, 0.4), 12.42, 0.9, z, 12.5, 0.93, z + 0.06);
      b.sign('세면실 — 담수 절약', 'stencil', 15.6, 2.3, 3.79, 2.6, 0.14, '-z');
      b.sign('FR 46', 'stencil', 19.79, 2.45, -1.4, 0.4, 0.14, '-x');
    });
    // ── wet deck in front of the showers and under the sinks (fx overlay + audio's wet footsteps) ──
    const wet: Box6[] = [[17.0, 0, -0.8, 18.35, 0.005, 3.0], [12.85, 0, 0.0, 13.9, 0.005, 1.9]];
    for (const w of wet) { fx.wetPatch(box3(w), ['heads5'], { id: 'fx5_wet_heads', seenFrom: ['berths5'] }); addWet(L, w); }
    // ── the four tap streams (fx5_taps): built now (registered), off until v5_water ──
    const bounds = box3([12.2, 0.74, -0.75, 12.85, 1.3, 2.75]);
    const taps = sinks.spouts.map((p) => {
      const e = fx.emitter('stream', p.clone(), V(0, -1, 0), 50, { bounds, rooms: ['heads5'], id: 'fx5_taps', seenFrom: ['berths5'] });
      e.enabled = false;
      return e;
    });
    // the water columns themselves (the streak streams are thin at 3 m): one translucent part, shown while the taps run.
    // IB5c: swan-neck taps (spouts 0.3 over the counter) so 0.3 m of each column stands clear of the counter front, a
    // thicker column, and a splash crown spraying up out of each basin over the rim (read at 4 m)
    const colMat = new THREE.MeshStandardMaterial({ color: 0xe6f1f7, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.7, depthWrite: false, emissive: 0xb8d0de, emissiveIntensity: 0.5 });
    colMat.name = 'd2b_tap_water';
    const cp = L.part('fx5_tap_columns');
    for (const p of sinks.spouts) {
      const len = p.y - 0.74;
      cp.cyl(colMat, p.x, p.y - len / 2, p.z, 0.016, len, 'y', 8, 0.012);
      cp.cyl(colMat, p.x, 0.915, p.z, 0.03, 0.05, 'y', 12, 0.075);   // the splash crown (opens upward)
      cp.cyl(colMat, p.x, 0.95, p.z, 0.075, 0.025, 'y', 12, 0.1);    // its spray lip
    }
    const cols = cp.build();
    const colMount = new THREE.Group();
    colMount.userData.rooms = ['heads5'];
    colMount.add(cols);
    cols.visible = false;
    L.root.add(colMount);
    const mirror = sinks.light, mirrorBase = mirror.emissiveIntensity;
    const water = (on: boolean) => { for (const e of taps) e.enabled = on; cols.visible = on; };
    // running water shimmers (opacity / glow jitter while the columns show)
    L.updaters.push(() => { if (!cols.visible) return; colMat.opacity = 0.55 + Math.random() * 0.3; colMat.emissiveIntensity = 0.35 + Math.random() * 0.35; });
    const steady = () => { water(false); mirror.emissiveIntensity = mirrorBase; };
    const wc = cues(L);
    L.vignette('v5_water', () => {
      const g = wc.start();
      L.sfx('water_hammer', 12.1, 2.25, 1.0, 1.0);
      L.ctx.player?.shake(0.05);
      wc.at(g, 0.07, () => water(true));
      wc.at(g, 0.05, () => L.sfx('taps_run', 12.5, 1.0, 1.0, 1.0));
      // the mirror strip stutters on the surge, settles, blinks once more as the valves shut
      L.tween(0, 2.75, (k) => { const t = k * 2.75; mirror.emissiveIntensity = mirrorBase * (t < 0.9 ? (Math.random() < 0.45 ? 0.05 : 1.15) : t > 2.45 && t < 2.6 ? 0.1 : 1); }, () => { mirror.emissiveIntensity = mirrorBase; });
      wc.at(g, 2.55, () => water(false));
      wc.at(g, 2.75, () => L.sfx('drain_gurgle', 12.5, 0.6, 1.0, 1.0));
    }, { snap: () => { wc.cancel(); steady(); } });
  },
};

// ───────────────────────────────────────────────────────────── mess5 (x 24 … 38, z −14 … −2, h 3.2)

const mess5: RoomDress = {
  label: false,
  look: { floor: 'lino_navy', wall: 'hull_white', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    restyle(L, 'mess5_grey', isStandin, null);
    const b = L.builder('mess5_dress');
    const fx = fxOf(L);
    // ── the hull (B1): frames across the mess, plate-and-beam deckhead, services along both sides ──
    const st = vesselRoom(b, L, {
      x0: 24.2, x1: 37.8, z0: -13.8, z1: -2.2, h: 3.2, axis: 'z',
      clear: [['x0', -9.7, -6.3], ['x0', -4.7, -3.3], ['z1', 26.9, 30.3], ['z1', 31.1, 36.0], ['z0', 29.2, 32.8], ['z0', 33.6, 35.4], ['z0', 36.1, 36.8]],
    });
    {
      const ceil = 3.2 - 0.172;
      serviceRun(b, L, { along: 'z', a: -13.8, b: -2.2, c: 37.0, ceil, hangers: st, pipes: [[0.05, 0, 0.04, 'pipe'], [0.035, -0.17, 0.06, 'steel'], [0.07, -0.42, 0.04, 'lagged']] });
      serviceRun(b, L, { along: 'z', a: -13.8, b: -2.2, c: 25.0, ceil, hangers: st, pipes: [[0.04, 0, 0.05, 'pipe']], tray: { w: 0.34, c: 0.5, drop: 0.1 } });
    }
    const HB = 3.2 - 0.072;
    const hs = lights(L, [
      // (the LOW pair lights the tables AND the serving counter — the trays must read when they go)
      { group: 'mess5', type: 'point', p: [28, 2.95, -8.0], color: WARM, i: 10, d: 10 },
      { group: 'mess5', type: 'point', p: [31.5, 2.95, -4.6], color: WARM, i: 9, d: 9 },
      { group: 'mess5', type: 'point', p: [34.5, 2.95, -11.0], color: WARM, i: 7, d: 8, min: 'medium' },
    ]);
    tubeFitting(b, L, hs[0], 28, HB, -8.0, false);
    tubeFitting(b, L, hs[1], 31.5, HB, -4.6, true);
    tubeFitting(b, L, hs[2], 34.5, HB, -11.0, false);
    // ── four fixed tables with their benches (the tables' colliders are the shell's; the benches get theirs) ──
    const meals: [number, number, number][] = [];
    for (const x of [27, 31]) for (const z of [-10, -6]) {
      b.at(x, 0, z, PI / 2, () => messTable(b, L, { collide: false }));
      for (const s of [-1, 1]) b.collide(x + s * 0.775 - 0.175, 0, z - 1.15, x + s * 0.775 + 0.175, 0.45, z + 1.15, 'metal', true);
      // the meal left on the table: trays in front of four or five places, mugs, a jug
      const R = (x * 7 + z * 13) & 7;
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1, zz = z - 0.85 + i * 0.42;
        if ((i + R) % 4 === 3) continue;
        meals.push([x + side * 0.27, zz, side > 0 ? PI / 2 : -PI / 2]);
      }
    }
    meals.forEach(([x, z, ry], i) => mealTray(b, L, x, 0.765, z, ry, i));
    b.detail(() => {
      b.cyl('stainless', 31.0, 0.86, -6.2, 0.07, 0.19, 'y', 12, 0.06);   // a water jug
      b.cyl('stainless', 27.05, 0.85, -9.6, 0.065, 0.17, 'y', 12, 0.055);
    });
    // ── the serving counter (two runs, W4): hot wells at the west end, the trays on the free part by mk5_trays ──
    b.at(28.6, 0, -2.2, PI, () => servingCounter(b, L, { len: 5.2, d: 0.6, wells: 3, wellsFrom: 0, collide: false }));
    b.at(35.4, 0, -2.2, PI, () => servingCounter(b, L, { len: 1.2, d: 0.6, wells: 0, collide: false }));
    let trays!: TrayStack;
    // origin on the counter top at the stacks (ry π: the free edge toward −z, the room); landing area clear of the tables
    b.at(30.0, 1.0, -2.5, PI, () => {
      trays = trayStack(b, L, { n: 30, stacks: 2, edge: 0.3, floor: -1.0, area: [-1.9, 0.5, 1.9, 3.0], keepOut: [[-1.9, 2.3, -0.1, 4.7]], seed: 23, name: 'trays5' });
    });
    // (IB5c: the pale body read as blank sheets on the deck — the body is now a darker, worn steel and the kit's bright
    // rolled rims (`k5_tray_rim`) frame each tray; tray bodies only)
    const trayMesh = trays.group.children.find((c) => c.name.endsWith(':trays')) as THREE.Mesh | undefined;
    if (trayMesh) {
      const tm = L.ctx.materials.clone('stainless', { color: 0x7d878d, roughness: 0.48, metalness: 0.55 });
      tm.name = 'd2b_tray_steel';
      trayMesh.material = tm;
    }
    // the menu over the counter and the scullery hatch sign
    b.detail(() => {
      b.sign('월 — 아침 0630 · 점심 1130 · 저녁 1730', 'stencil', 28.6, 2.45, -2.21, 3.2, 0.14, '-z');
      b.sign('긁고 · 쌓고 · 트레이 반납', 'stencil', 35.4, 1.7, -2.21, 1.1, 0.12, '-z');
      b.sign('FR 52', 'stencil', 37.79, 2.6, -11.0, 0.4, 0.14, '-x');
    });
    // ── the mess board (`note5_mess` reads it): the cake order ──
    b.at(24.2, 1.6, -4.0, PI / 2, () => noticeBoard(b, L, { w: 1.2, h: 0.9, notices: ['식당 게시판', '대비 훈련\n9일차\n모두 수고했습니다', '케이크 15:00 월\n함장이 쏩니다', '갤리 휴무\n화 1400–1600'] }));
    // ── the ready-use ammunition locker by the spine door (`p5_mess_ammo` (37.4, 1.0, −13.4) on its shelf) ──
    b.at(37.8, 0, -13.4, -PI / 2, () => openShelf(b, L, { w: 0.6, d: 0.55, h: 1.6, shelves: [0.45, 0.97, 1.4] }));
    b.detail(() => b.sign('상시 사용 — 5.56', 'stencil', 37.79, 1.75, -12.95, 0.6, 0.08, '-x'));
    // ── lived in (B1): the tea counter and the telly, the stopped clock, darts, the card game, caps and jackets left behind
    {
      const red = paint(L, 0x8a3b2e, 0.35), cream = paint(L, 0xe8e2d6, 0.3), dark = 'painted_dark' as const;
      // the tea counter between the east frames (x 37.2 … 37.8, z −9.25 … −6.75, top 0.9): urn, mug tree, sugar, plates, toaster
      b.bx('navy_grey', 37.22, 0.08, -9.25, 37.8, 0.88, -6.75).bx('painted_dark', 37.26, 0, -9.2, 37.8, 0.08, -6.8);
      b.bx('stainless', 37.18, 0.88, -9.27, 37.8, 0.905, -6.73);
      b.collide(37.18, 0, -9.27, 37.8, 0.905, -6.73, 'metal', true);
      b.detail(() => {
        b.cyl('stainless', 37.5, 1.13, -8.8, 0.16, 0.45, 'y', 16).cyl(dark, 37.5, 1.37, -8.8, 0.12, 0.03, 'y', 14).cyl(dark, 37.5, 1.4, -8.8, 0.025, 0.04, 'y', 8);
        b.bx(dark, 37.31, 1.0, -8.82, 37.35, 1.03, -8.78).bx(dark, 37.28, 0.98, -8.84, 37.31, 1.05, -8.76); // the urn's tap
        b.bx('stainless', 37.3, 0.905, -8.95, 37.42, 0.91, -8.65); // drip tray
        b.cyl('stainless', 37.5, 1.08, -7.95, 0.012, 0.36, 'y', 6).cyl('stainless', 37.5, 0.91, -7.95, 0.09, 0.012, 'y', 12); // mug tree
        for (let k = 0; k < 4; k++) { const a = (k / 4) * 2 * PI + 0.4; b.rod('stainless', 37.5, 1.0 + k * 0.06, -7.95, 37.5 + Math.cos(a) * 0.1, 1.04 + k * 0.06, -7.95 + Math.sin(a) * 0.1, 0.005, 4); }
        for (let i = 0; i < 9; i++) b.cyl(cream, 37.48, 0.913 + i * 0.009, -7.4, 0.11, 0.008, 'y', 18); // a stack of plates
        b.cyl(cream, 37.62, 0.96, -7.15, 0.05, 0.11, 'y', 12).cyl(dark, 37.62, 1.02, -7.15, 0.052, 0.012, 'y', 12); // sugar tin
        b.bx('stainless', 37.35, 0.905, -9.2, 37.62, 1.07, -9.02).bx(dark, 37.4, 1.07, -9.17, 37.57, 1.075, -9.05); // toaster
        b.sign('차 · 커피 · 컵은 헹궈 주세요', 'stencil', 37.79, 1.35, -8.0, 1.6, 0.1, '-x');
      });
      for (const [z, k] of [[-7.8, 1], [-8.08, 2], [-7.68, 3]] as const) b.at(37.42 + (k === 2 ? 0.12 : 0), 0.905, z, 0.3 * k, () => mug(b, L, k));
      // the telly on its bracket over the counter (off: its glass catches the lamps)
      b.bx(dark, 37.72, 2.05, -8.05, 37.8, 2.15, -7.95).rod(dark, 37.74, 2.1, -8.0, 37.55, 2.1, -8.0, 0.02, 6);
      b.bx(dark, 37.47, 1.88, -8.42, 37.55, 2.32, -7.58);
      b.detail(() => b.quad(paint(L, 0x101214, 0.12), 37.469, 2.1, -8.0, 0.78, 0.4, '-x', 0, 'unit', 0.001));
      // the clock over the counter's end of the north wall, stopped at 08:41 (the link drill was at 08:40)
      b.cyl('navy_grey', 30.75, 2.62, -2.23, 0.17, 0.035, 'z', 24);
      b.detail(() => {
        b.cyl(cream, 30.75, 2.62, -2.265, 0.15, 0.006, 'z', 24);
        for (let h = 0; h < 12; h++) { const a = (h / 12) * 2 * PI; b.bx(dark, 30.75 + Math.sin(a) * 0.13 - 0.004, 2.62 + Math.cos(a) * 0.13 - 0.012, -2.272, 30.75 + Math.sin(a) * 0.13 + 0.004, 2.62 + Math.cos(a) * 0.13 + 0.012, -2.268); }
        const hand = (a: number, l: number, w: number, z: number) => b.rbox(dark, 30.75 + Math.sin(a) * l / 2, 2.62 + Math.cos(a) * l / 2, z, w, l, 0.003, 0, 0, -a);
        hand(((8 + 41 / 60) / 12) * 2 * PI, 0.085, 0.012, -2.274);
        hand((41 / 60) * 2 * PI, 0.12, 0.008, -2.278);
        hand((14 / 60) * 2 * PI, 0.125, 0.003, -2.281); // the second hand, never moved again
      });
      // darts on the south wall west of the door: board, three darts in it, the oche line
      b.cyl(dark, 26.4, 1.73, -13.775, 0.23, 0.05, 'z', 24);
      b.detail(() => {
        b.cyl(cream, 26.4, 1.73, -13.748, 0.2, 0.005, 'z', 24).cyl(red, 26.4, 1.73, -13.744, 0.13, 0.005, 'z', 24).cyl(dark, 26.4, 1.73, -13.74, 0.085, 0.005, 'z', 20).cyl(red, 26.4, 1.73, -13.736, 0.018, 0.005, 'z', 10);
        for (const [dx, dy] of [[0.04, 0.06], [-0.07, -0.02], [0.11, -0.09]] as const) b.rod('steel_raw', 26.4 + dx, 1.73 + dy, -13.735, 26.4 + dx + 0.01, 1.73 + dy + 0.015, -13.62, 0.004, 4).cyl(red, 26.4 + dx + 0.01, 1.73 + dy + 0.015, -13.6, 0.012, 0.04, 'z', 6);
        b.sign('투구선', 'stencil', 26.4, 0.004, -11.3, 0.6, 0.08, '+y');
      });
      // a photograph of the detachment and the post's crest plaque on the south wall east of the door
      b.bx('navy_grey', 34.3, 1.35, -13.8, 35.3, 2.05, -13.78);
      b.detail(() => { b.quad(artMat(L, 'photo', 11), 34.8, 1.7, -13.775, 0.9, 0.6, '+z'); b.sign('초소 4 — 파견대 — 1일차', 'label', 34.8, 1.31, -13.778, 0.9, 0.06, '+z'); });
      b.bx('navy_grey', 36.2, 1.55, -13.8, 36.7, 2.1, -13.77).cyl('painted_yellow', 36.45, 1.86, -13.765, 0.15, 0.01, 'z', 6);
      b.detail(() => b.sign('초소 4', 'navy', 36.45, 1.64, -13.764, 0.4, 0.07, '+z'));
      // the fire extinguisher by the spine door
      b.bx(dark, 33.65, 1.15, -13.8, 33.85, 1.2, -13.74);
      b.cyl(red, 33.75, 0.88, -13.66, 0.08, 0.52, 'y', 14).cyl(dark, 33.75, 1.18, -13.66, 0.03, 0.08, 'y', 8).rod(dark, 33.75, 1.2, -13.66, 33.85, 1.15, -13.55, 0.012, 5);
      // on the tables: a condiment caddy on each, a card game abandoned on one, a cap, a paperback, a jacket over a bench
      for (const x of [27, 31]) for (const z of [-10, -6]) {
        b.bx('stainless', x - 0.1, 0.765, z - 0.05, x + 0.1, 0.775, z + 0.05);
        b.detail(() => {
          b.cyl(red, x - 0.06, 0.84, z, 0.025, 0.13, 'y', 8).cyl(dark, x - 0.06, 0.915, z, 0.012, 0.025, 'y', 6);
          b.cyl(cream, x, 0.81, z - 0.02, 0.016, 0.07, 'y', 8).cyl(dark, x + 0.03, 0.81, z + 0.02, 0.016, 0.07, 'y', 8);
          b.bx(cream, x + 0.05, 0.775, z - 0.035, x + 0.09, 0.84, z + 0.035);
        });
      }
      b.detail(() => {
        const R = (k: number) => Math.sin(k * 12.9898) * 0.5;
        for (let i = 0; i < 9; i++) b.quad(paper(L, 0xf2efe6), 31.0 + R(i) * 0.4, 0.767 + i * 0.0006, -5.3 + R(i + 9) * 0.3, 0.063, 0.088, '+y', R(i + 3) * 3);
        b.bx(paper(L, 0xf2efe6), 30.85, 0.765, -5.75, 30.92, 0.79, -5.66); // the deck, squared
        b.quad(paper(L, 0xf2efe6), 30.55, 0.004, -4.9, 0.063, 0.088, '+y', 0.7);  // one on the deck
        b.quad(paper(L, 0xb8c4cc), 26.8, 0.767, -6.6, 0.13, 0.19, '+y', 0.4);       // a paperback, face down
        b.cyl(paint(L, 0x26324a, 0.85), 27.3, 0.79, -9.3, 0.09, 0.05, 'y', 14).rbox(dark, 27.36, 0.77, -9.22, 0.12, 0.008, 0.08, 0, 0.6, 0); // a ship's cap
      });
      // a working-dress jacket thrown over the end of a bench
      b.geo('fatigue_navy', drapeGeo([
        { c: [0, 0.03, 0], rx: 0.2, rz: 0.05, fold: 0.01, nf: 4 }, { c: [0, -0.12, 0.02], rx: 0.22, rz: 0.06, fold: 0.016, nf: 5, ph: 1 },
        { c: [0, -0.32, 0.05], rx: 0.21, rz: 0.04, fold: 0.02, nf: 6, ph: 2 },
      ], 18, 41), 'box', new THREE.Matrix4().makeTranslation(31.775, 0.45, -11.0));
    }
    // ── v5_trays ──
    const dip = (k: number) => { const s = k < 0.3 ? 1 - 0.5 * (k / 0.3) : 0.5 + 0.5 * ((k - 0.3) / 0.7); for (const h of hs) h.intensityScale = s; };
    const tc = cues(L);
    L.vignette('v5_trays', () => {
      const g = tc.start();
      L.sfx('pump_thump', 31.0, 1.0, -1.7, 1.0);
      tc.at(g, 0.05, () => L.ctx.player?.shake(0.15));
      L.tween(0.05, 0.3, dip, () => { for (const h of hs) h.intensityScale = 1; });
      tc.at(g, 0.45, () => L.ctx.player?.shake(0.08));
      const T0 = 0.55;
      tc.at(g, T0, () => {
        const t = trays.fall();
        tc.at(g, t.impact, () => {
          L.sfx('tray_crash', 30.0, 0.3, -3.8, 1.0);
          fx.dustFall(V(30.2, 0, -3.6), { size: 0.5 });
          fx.dustFall(V(29.3, 0, -4.4), { size: 0.4 });
        });
        tc.at(g, t.bin, () => L.sfx('cutlery_scatter', 28.9, 0.2, -3.3, 1.0));
      });
    }, { snap: () => { tc.cancel(); trays.snap(); } });
  },
};

// ───────────────────────────────────────────────────────────── galley5 (x 28 … 38, z −2 … 4, h 3.0)

const galley5: RoomDress = {
  label: false,
  look: { floor: 'deck_nonslip', wall: 'hull_white', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    const glass = L.ctx.materials.get('glass');
    restyle(L, 'galley5_grey', isStandin, null);
    restyle(L, 'galley5_grey', (m) => m === glass, null); // the cold-room pane's visual (the frosted window draws it; its collider stays)
    const b = L.builder('galley5_dress');
    const fx = fxOf(L);
    const [main, cold] = lights(L, [
      // (bounded to the galley side of the window: the coat behind the frost stays a silhouette)
      // (IB5c: brighter — the deck read near-black on LOW)
      { group: 'galley5', type: 'point', p: [33, 2.65, 1], color: WARM, i: 13, d: 10, bounds: [27.9, -0.1, -2.1, 37.9, 3.1, 4.1] },
      // the cold room's glow, every quality (IB5c): it stands just inside the galley (x 37.85 < 37.95 — a point beyond
      // x 38 is in no room, so the portal pass never culls it) and its bounds keep it to the window reveal + the cold room
      // (from x 38.3: neither the galley face of the wall nor the coat on its hook (x 38.1) gets any — the coat stays a
      // silhouette against the lit back of the cold room)
      { group: 'galley5', type: 'point', p: [37.85, 1.6, 1.0], color: 0xcfe4ff, i: 3.2, d: 3.4, prio: 0.6, bounds: [38.3, 0, -0.3, 39.5, 2.3, 2.3] },
    ]);
    tubeFitting(b, L, main, 33, 3.0 - 0.152, 1.0, true, 'emissive_white');
    // ── the hull (B1): three frames across the galley (the range end wall and the cold-room wall are bulkheads) ──
    {
      const st = vesselRoom(b, L, {
        x0: 28.2, x1: 37.8, z0: -1.8, z1: 3.8, h: 3.0, axis: 'x', web: 0.14,
        clear: [['z0', 31.2, 34.8], ['z1', 28.2, 29.0], ['z1', 31.7, 34.3], ['x0', -0.6, 2.6], ['x1', -0.15, 3.65]],
      });
      serviceRun(b, L, { along: 'x', a: 28.2, b: 37.8, c: 3.25, ceil: 3.0 - 0.152, hangers: st, pipes: [[0.05, 0, 0.03, 'pipe'], [0.035, -0.17, 0.05, 'steel']], tray: { w: 0.3, c: -1.2, drop: 0.08 } });
    }
    // ── the range on the west wall (origin on the wall face x 28.2, front +x), pots on it ──
    b.at(28.2, 0, 1.0, PI / 2, () => galleyRange(b, L, { len: 3.0, d: 0.8, collide: false }));
    b.detail(() => {
      b.cyl('stainless', 28.55, 1.04, 0.2, 0.18, 0.26, 'y', 16).torus('stainless', 28.55, 1.17, 0.2, 0.18, 0.008, 'y', 16);
      b.cyl('stainless', 28.6, 0.99, 1.5, 0.16, 0.16, 'y', 16);
      b.cyl('painted_dark', 28.55, 0.95, 2.15, 0.14, 0.07, 'y', 14);              // a frying pan, its handle over the rail
      b.rod('painted_dark', 28.55, 0.96, 2.15, 29.0, 0.98, 2.3, 0.012, 5);
      // utensil rail with ladles over the range
      b.rod('stainless', 28.24, 1.75, -0.3, 28.24, 1.75, 2.3, 0.01, 6);
      for (let z = -0.1; z < 2.2; z += 0.38) b.rod('stainless', 28.26, 1.75, z, 28.27, 1.35, z, 0.006, 4).cyl('stainless', 28.27, 1.33, z, 0.04, 0.03, 'y', 8);
    });
    // ── the steel bench on the north wall (prep table, upstand to the wall), a tray of rolls, a cleaver ──
    b.at(34.0, 0, 3.35, PI, () => prepTable(b, L, { len: 4.0, d: 0.9, collide: false }));
    b.detail(() => {
      b.bx('stainless', 32.5, 0.9, 3.05, 33.3, 0.915, 3.55);
      for (let i = 0; i < 12; i++) b.sphere(paint(L, 0xc9a060, 0.8), 32.6 + (i % 4) * 0.19, 0.94, 3.13 + Math.floor(i / 4) * 0.16, 0.06, 8, 0.55);
      b.rbox('steel_raw', 35.3, 0.912, 3.2, 0.26, 0.004, 0.09, 0, 0.5, 0);
    });
    // ── the medkit shelf (`p5_galley_med` (28.6, 1.0, 3.4)) in the north-west corner ──
    b.at(28.6, 0, 3.8, PI, () => openShelf(b, L, { w: 0.7, d: 0.6, h: 1.8, shelves: [0.4, 0.97, 1.45] }));
    b.detail(() => b.sign('+  응급처치', 'label', 28.6, 1.95, 3.79, 0.5, 0.1, '-z'));
    // ── the walk-in cold room behind the frosted window (x 38.2 … 39.4, never entered) ──
    let clear!: THREE.Vector3;
    b.at(37.8, 1.5, 1.0, -PI / 2, () => { clear = frostedWindow(b, L, { w: 2.0, h: 1.0, corner: 'bl', collide: false }).clear; });
    thickenFrost(L, 'k5_frost_2_1_bl');
    // its back wall glows (a cold white panel: what the coat is silhouetted against, on every quality)
    const panel = paint(L, 0xdfe9f2, 0.5).clone();
    panel.emissive = new THREE.Color(0xcfe0ff);
    panel.emissiveIntensity = 1.4;
    panel.name = 'd2b_coldroom_panel';
    b.bx(panel, 39.37, 0.6, -0.15, 39.39, 2.15, 2.15);
    // shelves with stock in the cold room (blurred through the frost)
    b.bx('stainless', 38.8, 0.4, 1.75, 39.38, 0.43, 2.18).bx('stainless', 38.8, 1.0, 1.75, 39.38, 1.03, 2.18);
    b.detail(() => { for (let i = 0; i < 6; i++) b.bx(paint(L, [0x9aa6a0, 0xb8a888, 0xd8d8d0][i % 3], 0.8), 38.85 + (i % 3) * 0.17, i < 3 ? 0.43 : 1.03, 1.8, 39.0 + (i % 3) * 0.17, (i < 3 ? 0.43 : 1.03) + 0.2 + (i % 2) * 0.08, 2.1); });
    // the oilskin on its hook: its cuff hangs in the clear corner (kit: x = clear + 0.31 along the window, y = clear + 1.05)
    let coat!: Oilskin;
    // (0.25 m behind the pane, hook at 2.07: from a standing eye 0.7 … 1.0 m off the glass the sightline through the clear
    // corner meets the cuff)
    b.at(38.1, 2.07, clear.z + 0.31, -PI / 2, () => { coat = oilskin(b, L, { name: 'oilskin5' }); });
    // the cold-room fan (high on the back wall; a moving part)
    const fanPart = L.part('v5_coldfan');
    fanPart.cyl('steel_raw', 0, 0, 0, 0.2, 0.06, 'x', 18);
    for (let k = 0; k < 4; k++) fanPart.rbox('steel_raw', -0.04, 0, 0, 0.012, 0.16, 0.055, (k / 4) * PI * 2, 0, 0.3);
    const fan = fanPart.build();
    const fanMount = new THREE.Group();
    fanMount.position.set(39.2, 1.9, 0.35);
    fanMount.userData.rooms = ['galley5'];
    fanMount.add(fan);
    L.root.add(fanMount);
    b.cyl('navy_grey', 39.33, 1.9, 0.35, 0.24, 0.06, 'x', 18);
    b.detail(() => { for (const r of [0.1, 0.2]) b.torus('steel_raw', 39.17, 1.9, 0.35, r, 0.004, 'x', 18); });
    // the cold room's door on the galley wall beside the window (sealed: a padlocked hasp), its sign
    b.bx('stainless', 37.74, 0.02, 2.45, 37.8, 2.05, 3.55);
    b.detail(() => {
      b.bx('stainless', 37.7, 0.95, 3.35, 37.74, 1.25, 3.42);
      b.bx('steel_raw', 37.71, 1.4, 3.3, 37.74, 1.46, 3.5);
      b.bx('painted_dark', 37.69, 1.34, 3.44, 37.71, 1.42, 3.48);
      b.sign('냉장실  +2 °C', 'stencil', 37.735, 1.75, 3.0, 0.8, 0.12, '-x');
    });
    // the cold mist behind the pane (fx5_galley_mist)
    fx.fog({ box: box3([38.22, 0, -0.18, 39.38, 2.2, 2.18]), color: 0xd8e6f0, density: 0.9, height: 1.2, drift: [0, 0.05], rooms: ['galley5'], seenFrom: ['mess5'], id: 'fx5_galley_mist' });
    b.detail(() => {
      b.sign('갤리 — 무단 출입 금지', 'stencil', 33.0, 2.5, 3.79, 2.4, 0.14, '-z');
      b.sign('FR 52', 'stencil', 28.21, 2.6, -1.3, 0.4, 0.14, '+x');
    });
    // ── v5_galley_shape ──
    let fanRps = 0, fanTarget = 0, loop: LoopHandle | null = null, running = false;
    L.updaters.push((dt) => {
      fanRps += (fanTarget - fanRps) * Math.min(1, dt * 0.9);
      fan.rotation.x += fanRps * dt * PI * 2;
      // a running fan is heard whenever the player comes back near it (the snap starts it silently)
      if (running && !loop && !L.silent) {
        const e = L.ctx.player?.eye;
        if (e && Math.hypot(e.x - 38.8, e.z - 1.0) < 14) loop = L.ctx.audio.loop('fan_loop', { position: V(39.0, 1.9, 0.6), volume: 0.8 });
      }
    });
    const gc = cues(L);
    L.vignette('v5_galley_shape', () => {
      const g = gc.start();
      L.sfx('fan_start', 39.0, 1.9, 0.6, 1.0);
      fanTarget = 9;
      cold.intensityScale = 1.15;
      gc.at(g, 0.9, () => {
        const s = coat.swing();
        gc.at(g, s.creak, () => L.sfx('hook_creak', 38.1, 2.07, 0.46, 1.0));
      });
      gc.at(g, 3.0, () => { running = true; });
    }, {
      snap: () => { gc.cancel(); fanTarget = 9; fanRps = 9; running = true; cold.intensityScale = 1.15; coat.snap(); },
    });
  },
};

export const QUARTERS_DRESS: Partial<Record<RoomId5, RoomDress>> = { berths5, heads5, mess5, galley5 };
