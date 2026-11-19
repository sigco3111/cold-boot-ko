/**
 * POST 4 — the sub bay, the dive locker, the launch-lock access, the trunk tunnel (stage 3c §2.6, §2.7, §2.9, §4.8,
 * §5.5; task D3).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const BAY_DRESS: Partial<Record<RoomId5, RoomDress>>
 * for the rooms sub5, dive5, lockacc5, tunnel5. Per room: `build(L)`, `lights` (empty here: every light of these rooms
 * is made in `build` so its fixture can be bound to it — the group names are §2.7.1's: `sub5`, `sub5_emerg`, `dive5`,
 * `lockacc5`, `tunnel5`; the boat's two are W7's group `tern`), `look`, `label: false`.
 *
 * What this file does (the shell's colliders, doors, triggers, screens, interactables and markers are kept):
 *  - sub5: every stand-in visual of the shell is hidden (`restyle`); the greybox hull / sail / cradle colliders are
 *    dropped in favour of W7's `tern` (one collider set — its cradle box, hull planks, sail, tanks); the rest of the
 *    shell's colliders stay and the dressing draws over them with `collide: false` (decks, parapets, stairs, crates,
 *    boxes, forklift, gas racks, lockers). W7: `tern` (boat + cradle; rails drawn here without a collider — the
 *    shell's rails are walkable dynamic boxes), `launchLockDoor` (own colliders here: the port is a bore with the
 *    shell's glass pane in it), `launchConsole` (the shell's two console screens are removed, `launch5_palm`'s use
 *    point moves to the plate), `wheel5`. W8: gallery decks, rails, stair dressing, equipment boxes, crate stacks,
 *    forklift, gas rack, beacons, drain grilles. W6: the lock-port viewport, drips, ballast mist, wet patches.
 *  - Lights (§2.7.1): `sub5` 2 high-bay spots (cast, medium+) + 4 pendant points (all) — `sub5_emerg` 2 amber
 *    beacons (alarm) + the red point over the tunnel door (all) + 2 red points (medium+). Lights-out is driven by
 *    group NAMES only: the beacons spin, their sounder runs and the bay's red edge strips go bright whenever
 *    `sub5_emerg` is on, whoever switched it (the spine's half, the greybox, a checkpoint).
 *  - Vignettes: `v5_sub_check` (drives `tern.userData.check()`; sounds on its cues; mist; boards), `wheel5_turn`,
 *    `drain5_a`, `drain5_b`, the bay half of `lights_out5` (chained after any half already registered), `dark5_on`.
 */
import * as THREE from 'three';
import type { LightHandle, LoopHandle, MaterialName } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { FxSystemEx } from '../../fx';
import { isStandin, restyle } from '../l3/kit3';
import { GAL, ROOMS5, STAIR5_E, STAIR5_W, addWet, box3, type RoomId5 } from './grey';
import type { RoomDress } from './index';
import {
  cableTray, crateStack, decompressionChamber, diveSuits, drainGrille, equipmentBox, forklift, galleryDeck, gasBottleRack,
  hullNumber, lampLens5, navySign, rail, rotBeacon, setStrips5, stairDressing, strip5, stripMat5, trunkCable, wallShelf, type Beacon, type SumpHatch,
} from './kit5';
import { TERN5, TERN_CHECK_LEN, launchConsole, launchLockDoor, tern, wheel5, WHEEL5, type TernCue } from './setpieces';

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type B6 = [number, number, number, number, number, number];

// ───────────────────────────────────────────────────────────── shared state (per level build)

interface BayState {
  beacons: Beacon[];
  drains: Partial<Record<'drain5_a' | 'drain5_b', SumpHatch>>;
  mist: { stop(): void; enabled: boolean }[];
  jets: { stop(): void; enabled: boolean }[];
}
const STATE = new WeakMap<LevelBuild, BayState>();
function st(L: LevelBuild): BayState {
  let s = STATE.get(L);
  if (!s) STATE.set(L, (s = { beacons: [], drains: {}, mist: [], jets: [] }));
  return s;
}

// ───────────────────────────────────────────────────────────── emergency strips (B2: one colour, one driver)

/** `setStrips5(L, 'emerg', k)`: a faint trim while the level is lit, bright once any emergency group is on. */
const STRIP_LIT = 0.1, STRIP_DARK = 1.25;
const STRIP_DRIVEN = new WeakSet<LevelBuild>();
/**
 * IB5b (integration B2): every emergency strip of level 5 — spine walls, bay decks / nosings / exits, dive locker —
 * is ONE material, the kit's `emerg` channel, in the bay's red (the crawl / magazine / berths keep the `red` channel,
 * same red, on from load). One driver for the whole level: `setStrips5(L, 'emerg', …)` follows the emergency groups
 * (`spine5_emerg`, `sub5_emerg`) whoever switched them — the vignette halves, a snap, a checkpoint restore. Idempotent;
 * the spine and the bay both call it. (kit5's `STRIPS.emerg` is still yellow-green: recoloured here until IB5a's
 * kit change lands — then the recolour is a no-op.)
 */
export function emergStrips5(L: LevelBuild) {
  // (IA-5: the no-op recolour to kit5's own `STRIPS.emerg` lens / colour removed — one strip colour, B2)
  if (STRIP_DRIVEN.has(L)) return;
  STRIP_DRIVEN.add(L);
  const lm = L.ctx.render.lights;
  let k = 0;
  setStrips5(L, 'emerg', STRIP_LIT);
  L.updaters.push((dt) => {
    const on = lm.group('spine5_emerg').some((h) => h.enabled) || lm.group('sub5_emerg').some((h) => h.enabled);
    const k2 = Math.max(0, Math.min(1, k + (on ? dt / 0.5 : -dt / 0.3)));
    if (k2 === k) return;
    k = k2;
    setStrips5(L, 'emerg', STRIP_LIT + (STRIP_DARK - STRIP_LIT) * k);
  });
}

// ───────────────────────────────────────────────────────────── helpers

/** Remove one greybox collider (exact box) — its visual is replaced by a set piece that brings its own colliders. */
function dropCollider(L: LevelBuild, bx: B6): boolean {
  const items = (L as unknown as { colliderItems: Record<string, { m: THREE.Matrix4 }[]> }).colliderItems;
  const want = box3(bx);
  const near = (b: THREE.Box3) => b.min.distanceTo(want.min) < 1e-3 && b.max.distanceTo(want.max) < 1e-3;
  let hit = false;
  for (const s of Object.keys(items ?? {})) {
    const list = items[s];
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i].m.elements;
      const c = V(e[12], e[13], e[14]), h = V(Math.abs(e[0]) / 2, Math.abs(e[5]) / 2, Math.abs(e[10]) / 2);
      if (near(new THREE.Box3(c.clone().sub(h), c.clone().add(h)))) { list.splice(i, 1); hit = true; }
    }
  }
  for (const arr of [L.solids, L.obstacles, L.navSolids]) for (let i = arr.length - 1; i >= 0; i--) if (near(arr[i])) arr.splice(i, 1);
  if (!hit) console.warn(`[bay] greybox collider ${bx.join(',')} not found`);
  return hit;
}
const bounds = (b: B6) => box3(b);
/** A room's light box (room ± 0.1, y limited — S5). */
const rbox = (id: RoomId5, y0: number, y1: number) => { const r = ROOMS5[id]; return box3([r.x0 - 0.1, y0, r.z0 - 0.1, r.x1 + 0.1, y1, r.z1 + 0.1]); };
const SUB_B = rbox('sub5', -0.05, 12.05);
/** Rooms the sub bay's fx volumes are seen from (through its five doors). */
const SUB_SEEN = ['spine5', 'arm5', 'dive5', 'lockacc5', 'tunnel5'];

/** Bay red strip from a to b (on the floor / a deck at y). */
function bayStrip(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number, y = 0) {
  strip5(b, L, ax, az, bx, bz, { y, ch: 'emerg', channel: 'navy_grey' });
}

/** A parapet plate exactly over the shell's (h 1.1 from the deck, colliding there): plate, capping channel, stiffeners. */
function parapet(b: Builder, x0: number, z0: number, x1: number, z1: number, deckSide: 1 | -1) {
  const N: Mat = 'navy_grey', y0 = GAL - 0.15, y1 = GAL + 1.06;
  const alongZ = z1 - z0 > x1 - x0;
  if (alongZ) {
    b.bx(N, x0 + 0.01, y0, z0, x1 - 0.01, y1, z1);
    b.bx(N, x0 - 0.02, y1, z0 - 0.01, x1 + 0.02, GAL + 1.1, z1 + 0.01);
    const xs = deckSide < 0 ? x0 - 0.05 : x1;
    b.detail(() => { for (let z = z0 + 0.5; z < z1 - 0.2; z += 1.0) b.bx(N, xs, GAL + 0.02, z - 0.005, xs + 0.05, GAL + 1.0, z + 0.005); });
  } else {
    b.bx(N, x0, y0, z0 + 0.01, x1, y1, z1 - 0.01);
    b.bx(N, x0 - 0.01, y1, z0 - 0.02, x1 + 0.01, GAL + 1.1, z1 + 0.02);
    const zs = deckSide < 0 ? z0 - 0.05 : z1;
    b.detail(() => { for (let x = x0 + 0.5; x < x1 - 0.2; x += 1.0) b.bx(N, x - 0.005, GAL + 0.02, zs, x + 0.005, GAL + 1.0, zs + 0.05); });
  }
}

/** A handrail run (kit rail, navy, 1.1 m, toe board) — visual only: the shell's rail colliders stay. */
function railRun(b: Builder, L: LevelBuild, pts: [number, number][]) { rail(b, L, { pts, y: GAL, h: 1.1, toe: true, mat: 'navy_grey', collide: false }); }

/** Pendant high-bay lamp hanging from the ceiling (12 m) to `y`: drop rod, a reflector dome, a lens bound to `h`. */
function pendant(b: Builder, L: LevelBuild, x: number, y: number, z: number, h: LightHandle, lens: THREE.MeshStandardMaterial) {
  const K: Mat = 'painted_dark';
  b.rod('steel_raw', x, 12, z, x, y + 0.42, z, 0.015, 6);
  b.cyl(K, x, y + 0.36, z, 0.08, 0.12, 'y', 12);
  b.cyl(K, x, y + 0.12, z, 0.34, 0.3, 'y', 20, 0.12);
  b.detail(() => b.cyl(lens, x, y - 0.035, z, 0.27, 0.03, 'y', 20));
  void h;
}

// ───────────────────────────────────────────────────────────── the sub bay

function buildSub(L: LevelBuild) {
  const ctx = L.ctx, fx = ctx.fx as FxSystemEx;
  const S = st(L);
  // ── the shell's stand-ins out (their colliders stay), the boat stand-in colliders swapped for W7's ──
  restyle(L, 'sub5_grey', isStandin, null);
  restyle(L, 'sub5_grey', (m) => m.name === 'grey_dark', null);
  dropCollider(L, [31.8, 0, -43.4, 36.2, 0.6, -26.6]);
  dropCollider(L, [32.5, 0.6, -43.0, 35.5, 3.6, -27.0]);
  dropCollider(L, [33.4, 3.6, -32.5, 34.6, 4.5, -30.0]);

  // the deck a shade lighter than the library's (a 12 m hall lit from 9 m: the dark deck paint went near-black and the
  // puddles had nothing to read against)
  const deck = L.ctx.materials.clone('deck_nonslip', { color: new THREE.Color(1.45, 1.47, 1.5) });
  deck.name = 'd3_bay_deck';
  const look = BAY_DRESS.sub5?.look;
  if (look) look.floor = deck;
  const b = L.builder('sub5_dress');
  const N: Mat = 'navy_grey', K: Mat = 'painted_dark', ST: Mat = 'steel_raw', Y: Mat = 'painted_yellow';

  // ── lights (§2.7.1). sub5: high-bay spots (cast, medium+) on the boat and the bridge, four pendants (all) ──
  const lm = (h: LightHandle, q?: 'medium' | 'high') => { if (q) h.desc.minQuality = q; return h; };
  const COOL = 0xdfe9ff, WARM = 0xffe0bc, RED = 0xff2412, AMBER = 0xffa020;
  const hb1 = lm(L.spot('sub5', 34, 11.45, -25.5, 34, 2.0, -31.8, COOL, 220, 26, 0.6, { cast: true, priority: 0.8, penumbra: 0.55, bounds: SUB_B }), 'medium');
  const hb2 = lm(L.spot('sub5', 34, 11.45, -49.5, 34, 1.0, -42.5, COOL, 240, 26, 0.62, { cast: true, priority: 0.8, penumbra: 0.55, bounds: SUB_B }), 'medium');
  // flank floods on the gallery fascias (all qualities, no shadow): the hull's sides and the cradle read on LOW too
  const fl1 = L.spot('sub5', 25.25, 4.3, -30.5, 33.0, 1.9, -36.0, COOL, 150, 17, 0.5, { priority: 0.75, penumbra: 0.6, bounds: SUB_B });
  const fl2 = L.spot('sub5', 42.75, 4.3, -39.5, 35.0, 1.9, -34.0, COOL, 150, 17, 0.5, { priority: 0.75, penumbra: 0.6, bounds: SUB_B });
  const PEND: [number, number, number, number][] = [[29.4, 9.2, -26.0, 95], [38.6, 9.2, -26.0, 95], [29.4, 9.2, -47.0, 85], [38.6, 9.2, -47.0, 85]];
  const pend = PEND.map(([x, y, z, i]) => L.point('sub5', x, y, z, WARM, i, 22, { bounds: SUB_B }));
  // sub5_emerg: beacons (alarm) N / S, the red point over the tunnel door (all, S5), red pools at the two stair feet (medium+)
  // (IB5b B6: 230 cd 0.65 m off the wall swept a hot pool over the end walls — the light stands 1.3 m out, softer;
  // the red pools carry the floor)
  const bcN = L.point('sub5_emerg', 34, 9.0, -19.5, AMBER, 110, 30, { flicker: 'alarm', enabled: false, bounds: SUB_B });
  const bcS = L.point('sub5_emerg', 34, 9.0, -54.5, AMBER, 110, 30, { flicker: 'alarm', enabled: false, bounds: SUB_B });
  const redT = L.point('sub5_emerg', 23.0, 4.1, -52.8, RED, 14, 14, { enabled: false, bounds: SUB_B });
  const redW = L.point('sub5_emerg', 26.4, 2.6, -46.4, RED, 14, 14, { enabled: false, bounds: SUB_B });
  const redE = L.point('sub5_emerg', 41.6, 2.6, -23.6, RED, 14, 14, { enabled: false, bounds: SUB_B });
  // (IA-5: check:dark --level 5 — the walk-in from d5_bay and the north end read black with the lamp off between the
  // beacon's flashes: a red pool over the north walkway, by the bay door)
  const redN = L.point('sub5_emerg', 31.0, 3.0, -21.2, RED, 10, 12, { enabled: false, bounds: SUB_B });
  void redW; void redE; void redN;

  // fixtures: high-bay housings (lens bound to the spot), pendants (bound to their points)
  for (const [h, z] of [[hb1, -25.5], [hb2, -49.5]] as const) {
    const lens = lampLens5(L, 'white', 0.9);
    const m = lens.clone(); m.name = `d3_hb_lens${z}`;
    h.bindEmissive(m, 1.6);
    b.bx(K, 33.55, 11.55, z - 0.45, 34.45, 11.9, z + 0.45);
    b.rod(ST, 34, 12, z, 34, 11.9, z, 0.04, 8);
    b.detail(() => b.bx(m, 33.62, 11.5, z - 0.38, 34.38, 11.55, z + 0.38));
  }
  pend.forEach((h, k) => {
    const [x, y, z] = PEND[k];
    const m = lampLens5(L, 'warm', 0.9).clone(); m.name = `d3_pend_lens${k}`;
    h.bindEmissive(m, 1.4);
    pendant(b, L, x, y, z, h, m);
  });

  // flank flood fixtures under the gallery fascias (lens bound)
  for (const [h, x, z, s] of [[fl1, 25.25, -30.5, 1], [fl2, 42.75, -39.5, -1]] as const) {
    const m = lampLens5(L, 'white', 0.9).clone(); m.name = `d3_flank_lens${z}`;
    h.bindEmissive(m, 1.4);
    b.bx(K, Math.min(x - s * 0.24, x + s * 0.02), 4.18, z - 0.22, Math.max(x - s * 0.24, x + s * 0.02), 4.46, z + 0.22);
    b.detail(() => b.bx(m, Math.min(x + s * 0.02, x + s * 0.03), 4.22, z - 0.18, Math.max(x + s * 0.02, x + s * 0.03), 4.42, z + 0.18));
  }

  // ── the boat (W7) on its cradle; rails drawn here (the shell's walkable rail boxes stay) ──
  const boat = tern(L, { builder: b, rails: false });
  const ud = boat.userData as Record<string, unknown> & { check(): void; snap(): void; onCue(cb: (c: TernCue) => void): () => void; seq: { state: string; running: boolean }; vents: { p: THREE.Vector3; dir: THREE.Vector3 }[]; drips: THREE.Vector3[]; soundPoints: Record<'hull' | 'ballast' | 'hatch' | 'cradle', THREE.Vector3> };
  // wet black: the private hull / casing paint, darker and glossier (the self-light patch is untouched)
  for (const o of L.root.children) if (o.name === 'tern_body') o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
    if (m.name === 'tern_hull') { m.color.setRGB(0.62, 0.64, 0.66); m.roughness = 0.34; m.envMapIntensity = 1.7; }
    if (m.name === 'tern_casing') { m.color.setRGB(0.7, 0.72, 0.74); m.roughness = 0.4; m.envMapIntensity = 1.5; }
  });
  // rails x 33 / 35, z −55.6 … −19.0 (base, web, head, clips) — visual only
  {
    const R5 = TERN5.rails;
    for (const rx of R5.x) {
      b.bx(ST, rx - 0.1, 0, R5.z0, rx + 0.1, 0.03, R5.z1);
      b.bx(ST, rx - 0.022, 0.03, R5.z0, rx + 0.022, 0.12, R5.z1);
      b.bx(ST, rx - 0.04, 0.12, R5.z0, rx + 0.04, 0.15, R5.z1);
      b.detail(() => { for (let z = R5.z0 + 0.5; z < R5.z1; z += 1.5) b.bx(K, rx - 0.15, 0, z - 0.06, rx + 0.15, 0.045, z + 0.06); });
    }
    // the track bed: painted safety lines either side of the rail corridor, from the lock sill to the buffer stops
    const line = L.overlay('painted_yellow');
    for (const x of [32.15, 35.85]) b.detail(() => b.quad(line, x, 0, -37.4, 0.1, 35.6, '+y', 0, 'box', 0.003));
    navySign(b, 'SDV 트랙 — 접근 금지', 34, 0.004, -21.4, 1.6, 0.22, '+y', { rot: PI });
  }

  // ── galleries y 4.8 (decks, beams, knee braces), rails / parapets exactly over the shell's, red edge strips ──
  galleryDeck(b, L, { x0: 22.2, x1: 25.0, z0: -55.8, z1: -18.2, rails: [], wall: '-x', strips: null, collide: false, y: GAL - 0.01 });
  galleryDeck(b, L, { x0: 43.0, x1: 45.8, z0: -55.8, z1: -18.2, rails: [], wall: '+x', strips: null, collide: false, y: GAL - 0.01 });
  galleryDeck(b, L, { x0: 25.0, x1: 43.0, z0: -21.0, z1: -18.2, rails: [], wall: '+z', strips: null, collide: false, y: GAL - 0.01 });
  galleryDeck(b, L, { x0: 25.0, x1: 43.0, z0: -36.0, z1: -34.0, rails: [], strips: null, collide: false, y: GAL - 0.01 });
  // fascia channels on the open edges
  b.bx(N, 24.988, GAL - 0.24, -55.8, 25.0, GAL - 0.03, -36.0).bx(N, 24.988, GAL - 0.24, -34.0, 25.0, GAL - 0.03, -21.0);
  b.bx(N, 43.0, GAL - 0.24, -55.8, 43.012, GAL - 0.03, -36.0).bx(N, 43.0, GAL - 0.24, -34.0, 43.012, GAL - 0.03, -21.0);
  b.bx(N, 25.0, GAL - 0.24, -21.012, 43.0, GAL - 0.03, -21.0);
  // the bridge: two plate girders under its edges (clear of the hull top 3.66 and the sail)
  for (const z of [-35.95, -34.05]) b.bx(N, 25.0, GAL - 0.75, z - 0.05, 43.0, GAL - 0.24, z + 0.05);
  b.bx(N, 25.0, GAL - 0.78, -36.0, 43.0, GAL - 0.75, -34.0 - 0.0);
  // west
  for (const [z0, z1] of [[-55.8, -50], [-40, -36], [-34, -30], [-22, -21.0]] as const) railRun(b, L, [[25.025, z0 + 0.03], [25.025, z1 - 0.03]]);
  parapet(b, 25.0, -50, 25.08, -40, -1); parapet(b, 25.0, -30, 25.08, -22, -1);
  // east
  for (const [z0, z1] of [[-55.8, -48], [-38, -36], [-34, -30], [-22, -21.0]] as const) railRun(b, L, [[42.975, z0 + 0.03], [42.975, z1 - 0.03]]);
  parapet(b, 42.92, -48, 43.0, -38, 1); parapet(b, 42.92, -30, 43.0, -22, 1);
  // north gallery inner edge, bridge south / north edges
  railRun(b, L, [[25.08, -21.025], [42.92, -21.025]]);
  railRun(b, L, [[27.43, -36.025], [42.92, -36.025]]);
  for (const [x0, x1] of [[25.05, 28], [32, 33.3], [34.7, 36], [40, 40.6], [42.6, 42.95]] as const) railRun(b, L, [[x0 + 0.03, -33.975], [x1 - 0.03, -33.975]]);
  parapet(b, 28, -34.0, 32, -33.92, -1); parapet(b, 36, -34.0, 40, -33.92, -1);
  // red edge strips 0.14 inside every open deck edge (the route after lights-out)
  bayStrip(b, L, 24.86, -55.6, 24.86, -36.1, GAL + 0.01); bayStrip(b, L, 24.86, -33.9, 24.86, -21.15, GAL + 0.01);
  bayStrip(b, L, 43.14, -55.6, 43.14, -36.1, GAL + 0.01); bayStrip(b, L, 43.14, -33.9, 43.14, -21.15, GAL + 0.01);
  bayStrip(b, L, 25.1, -20.86, 42.9, -20.86, GAL + 0.01);
  bayStrip(b, L, 27.5, -35.86, 42.9, -35.86, GAL + 0.01);
  bayStrip(b, L, 25.1, -34.14, 33.1, -34.14, GAL + 0.01); bayStrip(b, L, 34.9, -34.14, 40.45, -34.14, GAL + 0.01);
  // stencils on the parapets (seen from the floor)
  navySign(b, '갤러리 W — SWL 500 KG', 25.085, GAL + 0.55, -45, 1.6, 0.14, '+x');
  navySign(b, '갤러리 E — SWL 500 KG', 42.915, GAL + 0.55, -43, 1.6, 0.14, '-x');
  navySign(b, '발사 브리지', 30, GAL + 0.55, -33.915, 1.4, 0.16, '+z');

  // ── the two long stairs: painted steel treads over the shell's (solid) mass, nosing strips, stringers, rails ──
  // (the shell's stair is solid underneath — under-mass colliders — so it is dressed as a plated stair tower: dark
  // side plates with vertical stiffeners, steel treads; never an open stair with invisible walls under it)
  const towerM = L.ctx.materials.clone('navy_grey', { color: 0x59626a });
  towerM.name = 'd3_stair_plate';
  for (const s of [STAIR5_W, STAIR5_E]) {
    for (let k = 0; k < s.risers; k++) {
      const za = s.z0 + s.dir * s.tread * k, zb = s.z0 + s.dir * s.tread * (k + 1), top = s.rise * (k + 1);
      const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
      b.bx(towerM, s.x0, 0, z0, s.x1, top - 0.03, z1);
      b.bx(ST, s.x0 + 0.004, top - 0.03, z0 + 0.004, s.x1 - 0.004, top, z1 - 0.004);
      // stiffeners on both side plates every second tread (flat bars 1.5 cm proud, to the tread line)
      if (k % 2 === 1) for (const x of [s.x0 - 0.015, s.x1]) b.bx(N, x, 0, (z0 + z1) / 2 - 0.03, x + 0.015, top - 0.06, (z0 + z1) / 2 + 0.03);
    }
    stairDressing(b, L, { stair: s, nosing: 'emerg', rails: 'both', stringers: true });
    const zl = s.z0 + s.dir * s.tread * 3;
    navySign(b, '계단 — 아래 적재 금지', s.x0 - 0.016, 0.55, zl, 1.1, 0.1, '-x');
  }

  // ── floor cover (§5.4) over the shell's colliders ──
  b.at(27.0, 0, -29.0, 0, () => crateStack(b, L, { w: 2.0, d: 2.0, h: 1.2, seed: 41, label: '예비품 — SDV', collide: false }));
  b.at(26.6, 0, -50.0, PI / 2, () => crateStack(b, L, { w: 2.0, d: 1.2, h: 1.2, seed: 42, collide: false }));
  b.at(39.0, 0, -45.0, 0, () => crateStack(b, L, { w: 2.0, d: 2.0, h: 1.2, seed: 43, palette: 'grey', collide: false }));
  b.at(44.3, 0, -23.0, -PI / 2, () => crateStack(b, L, { w: 2.0, d: 1.4, h: 2.0, seed: 44, collide: false }));
  b.at(38.3, 0, -26.8, 0, () => forklift(b, L, { collide: false }));
  b.at(39.4, 0, -52.0, 0, () => gasBottleRack(b, L, { collide: false }));
  for (const [x, z, ry, lab] of [[31.0, -32.0, PI / 2, '턴 — 지지대 1'], [31.0, -40.0, PI / 2, '턴 — 지지대 2'], [37.0, -32.0, -PI / 2, '턴 — 육상 전원'], [37.0, -40.0, -PI / 2, '턴 — 유압 팩']] as const) {
    b.at(x, 0, z, ry, () => equipmentBox(b, L, { label: lab, collide: false }));
  }
  // locker by d5_arm_bay (p5_bay_med_1 / _ammo_1 on its top at 0.95) and the gallery locker by the wheel (top 5.55)
  const cabinet = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, face: '+x' | '-z', text: string) => {
    b.bx(N, x0 + 0.01, y0, z0 + 0.01, x1 - 0.01, y1 - 0.02, z1 - 0.01);
    b.bx(N, x0, y1 - 0.02, z0, x1, y1, z1);
    b.detail(() => {
      if (face === '-z') { b.bx(K, x0 + 0.05, y0 + 0.08, z0 - 0.002, x1 - 0.05, y1 - 0.08, z0 + 0.01); navySign(b, text, (x0 + x1) / 2, y1 - 0.2, z0 - 0.004, 0.6, 0.09, '-z'); }
      else { b.bx(K, x1 - 0.01, y0 + 0.08, z0 + 0.05, x1 + 0.002, y1 - 0.08, z1 - 0.05); navySign(b, text, x1 + 0.004, y1 - 0.2, (z0 + z1) / 2, 0.6, 0.09, '+x'); }
    });
  };
  cabinet(23.7, 0, -22.3, 24.7, 0.95, -21.7, '-z', '응급처치 — 탄약');
  cabinet(22.2, GAL, -51.3, 22.9, GAL + 0.75, -50.3, '+x', '상시 사용');
  // shelf under p5_bay_med_2 (44.6, 1.0, −50.0) on the east wall
  b.at(45.8, 1.0, -50.0, -PI / 2, () => wallShelf(b, L, { w: 0.6, d: 0.45 }));
  b.at(45.79, 1.55, -50.0, -PI / 2, () => navySign(b, '✚ FIRST AID', 0, 0, 0.002, 0.5, 0.12, '+z'));

  // ── the launch lock (W7) — own colliders: the port is a bore with the shell's glass pane in it ──
  launchLockDoor(L, b, { collide: false });
  {
    // leaf + frame box x 31 … 37, y 0.5 … 5.5, z −55.8 … −55.3 minus the 0.6 m port (x 33.7 … 34.3, y 1.9 … 2.5)
    const z0 = -55.8, z1 = -55.3;
    b.collide(31.0, 0.0, z0, 37.0, 0.5, z1, 'metal', true);
    b.collide(31.0, 0.5, z0, 33.7, 5.5, z1, 'metal', true);
    b.collide(34.3, 0.5, z0, 37.0, 5.5, z1, 'metal', true);
    b.collide(33.7, 0.5, z0, 34.3, 1.9, z1, 'metal', true);
    b.collide(33.7, 2.5, z0, 34.3, 5.5, z1, 'metal', true);
    b.collide(33.7, 1.9, -55.915, 34.3, 2.5, -55.885, 'glass', true);
  }
  fx.viewport({
    id: 'fx5_lock_water', rooms: ['sub5'], cheap: true, state: 'dark', position: V(34, 2.2, -55.9), normal: V(0, 0, 1),
    width: 0.6, height: 0.6, depth: 5.6, spread: 0.45, seabed: null, cable: null, shapes: 0, floods: [],
  });

  // ── the launch console (W7) on the bridge; the shell's console screens go, the palm's use point moves to the plate ──
  for (const name of ['screen:launch', 'screen:launch5_palm']) { const o = L.root.children.find((c) => c.name === name); if (o) L.root.remove(o); }
  const con = launchConsole(L, b);
  const palmIt = ctx.interactables.get('launch5_palm');
  if (palmIt && con.userData.palmPoint) palmIt.position.copy(con.userData.palmPoint as THREE.Vector3);

  // ── the wheel (W7) over the tunnel door; a red lamp beside it (bound to the red point) ──
  wheel5(L, b);
  {
    const m = lampLens5(L, 'red', 0.9).clone(); m.name = 'd3_wheel_lamp';
    redT.bindEmissive(m, 1.6);
    b.bx(K, 22.2, 6.75, -52.75, 22.32, 6.95, -52.45);
    b.detail(() => b.sphere(m, 22.37, 6.85, -52.6, 0.06, 10));
    b.bx(K, 22.2, 6.58, -52.27, 22.24, 6.82, -51.73);
    b.detail(() => b.bx(m, 22.24, 6.6, -52.25, 22.25, 6.8, -51.75));
    b.bx(K, 22.2, 2.85, -53.95, 22.3, 3.05, -53.65);
    b.detail(() => b.sphere(m, 22.35, 2.95, -53.8, 0.06, 10));
  }

  // ── beacons (W8 / kit 4 rotBeacon) on the north and south walls; bound to the alarm points ──
  b.at(34, 9.0, -18.2, PI, () => S.beacons.push(rotBeacon(b, L, { name: 'beacon5_n', bind: (m) => bcN.bindEmissive(m, 0.7) })));
  b.at(34, 9.0, -55.8, 0, () => S.beacons.push(rotBeacon(b, L, { name: 'beacon5_s', bind: (m) => bcS.bindEmissive(m, 0.7) })));

  // ── the TERN board's frame (north wall over d5_bay), wall dressing: frames, pipe runs, hull numbers ──
  b.bx(K, 32.6, 6.66, -18.212, 35.4, 7.74, -18.2);
  b.bx(N, 32.55, 6.62, -18.27, 35.45, 6.68, -18.2).bx(N, 32.55, 7.72, -18.27, 35.45, 7.78, -18.2);
  navySign(b, 'SDV 베이 1 — 초소 4', 34, 8.15, -18.2, 2.2, 0.2, '-z');
  const ribZ = (x: number, z: number, sx: 1 | -1) => { b.bx(N, Math.min(x, x + sx * 0.18), 0, z - 0.05, Math.max(x, x + sx * 0.18), 12, z + 0.05); b.bx(N, Math.min(x + sx * 0.16, x + sx * 0.2), 0, z - 0.12, Math.max(x + sx * 0.16, x + sx * 0.2), 12, z + 0.12); };
  const ribX = (x: number, z: number, sz: 1 | -1) => { b.bx(N, x - 0.05, 0, Math.min(z, z + sz * 0.18), x + 0.05, 12, Math.max(z, z + sz * 0.18)); b.bx(N, x - 0.12, 0, Math.min(z + sz * 0.16, z + sz * 0.2), x + 0.12, 12, Math.max(z + sz * 0.16, z + sz * 0.2)); };
  for (const z of [-20, -26, -29, -32, -35, -38, -41, -44, -47, -50]) ribZ(22.2, z, 1);
  for (const z of [-20, -23, -26, -29, -38, -41, -44, -47, -50, -53]) ribZ(45.8, z, -1);
  for (const x of [25, 28, 31, 37, 40, 43]) ribX(x, -18.2, -1);
  for (const x of [25, 28, 39.4, 45]) ribX(x, -55.8, 1);
  // pipe runs: sea-water mains along the long walls under the galleries' knee braces and high up
  const pipe = (pts: [number, number, number][], r: number, m: Mat) => { for (let i = 0; i < pts.length - 1; i++) b.rod(m, ...pts[i], ...pts[i + 1], r, 10); };
  const pipeM = L.ctx.materials.clone('painted_white', { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, color: 0x5f6f66, roughness: 0.5, metalness: 0.1 });
  pipeM.name = 'd3_pipe';
  for (const [x, s] of [[22.2, 1], [45.8, -1]] as const) {
    pipe([[x + s * 0.32, 3.05, -54.9], [x + s * 0.32, 3.05, -19.1]], 0.12, pipeM);
    pipe([[x + s * 0.22, 3.4, -54.9], [x + s * 0.22, 3.4, -19.1]], 0.06, 'copper' as Mat);
    pipe([[x + s * 0.35, 10.6, -55.5], [x + s * 0.35, 10.6, -18.5]], 0.16, pipeM);
    b.detail(() => { for (let z = -53.5; z < -19; z += 3) { b.bx(ST, Math.min(x, x + s * 0.5), 2.85, z - 0.04, Math.max(x, x + s * 0.5), 2.9, z + 0.04); b.bx(ST, Math.min(x, x + s * 0.55), 10.38, z - 0.04, Math.max(x, x + s * 0.55), 10.43, z + 0.04); } });
  }
  hullNumber(b, 'FR 140', 22.21, 8.2, -24.5, '+x', 0.5);
  hullNumber(b, 'FR 152', 22.21, 8.2, -42.5, '+x', 0.5);
  hullNumber(b, 'FR 140', 45.79, 8.2, -24.5, '-x', 0.5);
  hullNumber(b, 'FR 152', 45.79, 8.2, -42.5, '-x', 0.5);
  navySign(b, '발사 록 1 ↓', 34, 7.0, -55.795, 2.4, 0.3, '+z');
  // the overhead crane: runway beams on the long walls, the bridge girder parked over the bow, a hook block
  for (const x of [22.75, 45.25]) { b.bx(N, x - 0.15, 11.0, -55.8, x + 0.15, 11.4, -18.2); b.bx(ST, x - 0.04, 11.4, -55.8, x + 0.04, 11.46, -18.2); }
  b.bx(Y, 22.75, 11.05, -53.9, 45.25, 11.7, -53.2);
  b.bx(K, 31.0, 10.7, -53.8, 32.0, 11.05, -53.3);
  b.rod(ST, 31.35, 10.7, -53.55, 31.35, 9.95, -53.55, 0.012, 4).rod(ST, 31.65, 10.7, -53.55, 31.65, 9.95, -53.55, 0.012, 4);
  b.bx(Y, 31.22, 9.55, -53.7, 31.78, 9.95, -53.4);
  b.detail(() => b.quad('hazard_stripes' as Mat, 31.5, 9.75, -53.4, 0.56, 0.4, '+z', 0, 'box', 0.003));
  b.detail(() => navySign(b, 'SWL 20 T', 28.0, 11.38, -53.195, 0.9, 0.22, '+z'));
  // roof frames: transverse I-beams every 4.5 m (catch the pendants' light; the roof is not a void)
  for (const z of [-20.5, -29.5, -34.0, -38.5, -43.0, -47.5]) { b.bx(N, 22.2, 11.82, z - 0.08, 45.8, 11.86, z + 0.08); b.bx(N, 22.2, 11.5, z - 0.01, 45.8, 11.82, z + 0.01); b.bx(N, 22.2, 11.46, z - 0.08, 45.8, 11.5, z + 0.08); }
  // the dock sentry's roof dock (34, 9, −45) — over the shell's collider (x 33.5 … 34.5, y 9.4 … 12)
  b.bx(K, 33.5, 9.4, -45.5, 34.5, 12.0, -44.5);
  b.detail(() => b.quad('hazard_stripes' as Mat, 34, 9.4, -45, 1.0, 1.0, '-y', 0, 'box', 0.003));
  b.detail(() => b.quad('hazard_stripes' as Mat, 34, 9.9, -44.5, 1.0, 0.25, '+z', 0, 'box', 0.003));

  // ── exits: strips across each door's approach (the route with the flashlight off) + a floor path to the stairs ──
  for (const [ax, az, bx, bz] of [
    [33.0, -18.75, 35.0, -18.75],            // d5_bay
    [22.75, -24.0, 22.75, -22.0],            // d5_arm_bay
    [22.75, -54.0, 22.75, -52.0],            // d5_tunnel
    [45.25, -35.0, 45.25, -33.0],            // d5_dive
    [41.0, -55.25, 43.0, -55.25],            // d5_lockside
  ] as const) bayStrip(b, L, ax, az, bx, bz);
  bayStrip(b, L, 29.5, -19.4, 29.5, -45.6);  // the floor walk west of the cradle, d5_bay → STAIR5_W foot
  bayStrip(b, L, 29.5, -45.6, 27.6, -45.6);
  bayStrip(b, L, 25.05, -46.2, 25.05, -53.0); // STAIR5_W foot → the tunnel door, under the west gallery
  bayStrip(b, L, 41.6, -19.4, 41.6, -24.6);  // d5_bay → STAIR5_E foot
  // the cradle's footprint outlined (the boat reads as a shape on the floor in the dark)
  for (const [ax, az, bx, bz] of [[31.65, -26.5, 31.65, -43.5], [36.35, -26.5, 36.35, -43.5]] as const) bayStrip(b, L, ax, az, bx, bz);
  // low-level wall-base strips round the floor and along the gallery walls (gaps at the doors, the lock, the locker)
  const runs = (fixed: number, alongX: boolean, a: number, c: number, gaps: [number, number][], y = 0) => {
    let u = a;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > u + 0.3) (alongX ? bayStrip(b, L, u, fixed, g0, fixed, y) : bayStrip(b, L, fixed, u, fixed, g0, y)); u = Math.max(u, g1); }
    if (c > u + 0.3) (alongX ? bayStrip(b, L, u, fixed, c, fixed, y) : bayStrip(b, L, fixed, u, fixed, c, y));
  };
  runs(22.5, false, -55.5, -18.5, [[-25.0, -21.0], [-55.0, -51.0]]);
  runs(45.5, false, -55.5, -18.5, [[-36.0, -32.0]]);
  runs(-18.5, true, 22.5, 45.5, [[32.0, 36.0]]);
  runs(-55.5, true, 22.5, 45.5, [[30.6, 37.4], [40.0, 44.0]]);
  runs(22.5, false, -55.5, -18.5, [[-51.5, -50.1], [-52.6, -51.4]], GAL + 0.01);
  runs(45.5, false, -55.5, -18.5, [], GAL + 0.01);
  runs(-18.5, true, 25.1, 42.9, [], GAL + 0.01);

  // ── the drains (W8 lifting grille over the shell's walkable panel, which is hidden) ──
  for (const [id, x, z] of [['drain5_a', 28.0, -48.0], ['drain5_b', 39.0, -36.5]] as const) {
    const g = L.objects.get(`${id}_grille`);
    if (g) g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = false; });
    b.at(x, 0, z, 0, () => { S.drains[id] = drainGrille(b, L, { name: `${id}_lid` }); });
  }

  // ── wet floor (≤ 8 patches, §2.9) where the lamps have something to mirror — the same boxes feed regions.wet ──
  const WET: B6[] = [
    [32.5, 0, -47.6, 35.5, 0.02, -44.0],    // the rail corridor under the bow (HB2, the lock door)
    [32.2, 0, -54.9, 35.8, 0.02, -51.8],    // at the lock sill
    [32.3, 0, -26.2, 35.7, 0.02, -22.4],    // astern (HB1, the TERN board)
    [29.9, 0, -38.6, 31.5, 0.02, -33.4],    // under the port ballast tank
    [36.5, 0, -38.6, 38.2, 0.02, -33.4],    // under the starboard tank
    [27.2, 0, -44.8, 29.2, 0.02, -41.6],    // by the STAIR5_W foot (drips off the bridge)
    [40.2, 0, -32.0, 42.2, 0.02, -29.0],    // by STAIR5_E
  ];
  WET.forEach((w, i) => { fx.wetPatch(box3(w), ['sub5'], { id: `fx5_wet_sub${i}`, seenFrom: SUB_SEEN }); addWet(L, w); });

  // ── drips (hull seams + the boat) — made on the first frame, when physics can find where they land; ballast mist ──
  const dripBox = bounds([22.2, 0, -55.8, 45.8, 9.0, -18.2]);
  let dripsMade = false;
  L.updaters.push(() => {
    if (dripsMade) return;
    dripsMade = true;
    const o = { bounds: dripBox, rooms: ['sub5'], id: 'fx5_drips_sub', seenFrom: SUB_SEEN };
    for (const x of [22.35, 45.65]) for (const z of [-24, -38, -50]) fx.emitter('drip', V(x, 8.0, z), undefined, 0.5, o);
    for (const p of (ud.drips ?? []).filter((_, i) => i === 1 || i === 3 || i === 7)) fx.emitter('drip', p, undefined, 0.35, o);
  });
  const mistBox = bounds([29.5, 0, -45.5, 38.5, 6.5, -25.0]);
  const mo = { bounds: mistBox, rooms: ['sub5'], id: 'fx5_mist_sub', seenFrom: SUB_SEEN };
  for (const v of ud.vents ?? []) {
    const e = fx.emitter('mist', v.p, v.dir, 24, { ...mo, speed: 0.75 });
    e.enabled = false;
    S.mist.push(e);
  }
  // the blow itself: two short steam jets out of the ballast-tank vents (first 1.4 s of the hiss)
  for (const v of (ud.vents ?? []).slice(6)) {
    const e = fx.emitter('steam', v.p, v.dir, 40, { ...mo, speed: 0.45 });
    e.enabled = false;
    S.jets.push(e);
  }

  emergStrips5(L);
  // the decks' galvanised grating a shade darker (under the high-bay lamps the bridge read as a white sheet)
  const grate = L.ctx.materials.get('deck_grate');
  const grateD = L.ctx.materials.clone('deck_grate', { color: new THREE.Color(0.62, 0.64, 0.66) });
  grateD.name = 'd3_bay_grate';
  restyle(L, 'sub5_dress', (m) => m === grate, grateD);

  bayVignettes(L, boat, ud);
}

// ───────────────────────────────────────────────────────────── sub-bay vignettes, group-driven state

function bayVignettes(L: LevelBuild, boat: THREE.Object3D, ud: Record<string, any>) {
  const ctx = L.ctx, S = st(L), lmgr = ctx.render.lights;
  const text = (screen: string, kind: 'dock_status' | 'launch' | 'terminal_idle', t: string) => { const m = L.screens.get(screen); if (m) ctx.materials.setScreen(m, kind, { text: t }); };

  // ── v5_sub_check: the pre-launch check (19.4 s), sounds on its cues (the boat plays none), mist, boards ──
  const sp = ud.soundPoints as Record<'hull' | 'ballast' | 'hatch' | 'cradle', THREE.Vector3>;
  const at = (id: string, p: THREE.Vector3, v = 1) => L.sfx(id, p.x, p.y, p.z, v);
  let checking = false;
  (ud.onCue as (cb: (c: TernCue) => void) => void)((c) => {
    if (!checking) return;
    switch (c) {
      case 'ballast':
        at('sub_ballast_hiss', sp.ballast);
        for (const e of S.mist) e.enabled = true;
        for (const e of S.jets) e.enabled = true;
        L.after(1.4, () => { for (const e of S.jets) e.enabled = false; });
        break;
      case 'ballast_end': L.after(0.6, () => { for (const e of S.mist) e.enabled = false; }); break;
      case 'clang': at('sub_hatch_clang', sp.hatch); break;
      case 'latch': at('sub_hatch_clang', sp.hatch, 0.55); break;
      case 'clamps': case 'clamps_home': at('clamp_cycle', sp.cradle); break;
      case 'complete':
        checking = false;
        text('tern_board', 'dock_status', '완료 — 장교 손바닥 인증 대기');
        text('launch', 'launch', 'complete');
        break;
    }
  });
  const snapCheck = () => {
    checking = false;
    (ud.snap as () => void)();
    for (const e of [...S.mist, ...S.jets]) e.enabled = false;
    text('tern_board', 'dock_status', '완료 — 장교 손바닥 인증 대기');
    text('launch', 'launch', 'complete');
  };
  L.vignette('v5_sub_check', () => {
    checking = true;
    text('tern_board', 'dock_status', '발사 전 점검 — 진행 중');
    text('launch', 'launch', `running|${(TERN_CHECK_LEN - 0.8).toFixed(1)}`);
    (ud.check as () => void)();
  }, { snap: snapCheck });
  // the boat's systems hum (loop) once powered by the check, while it is drawn
  let hum: LoopHandle | null = null;
  L.updaters.push(() => {
    const on = ud.seq.state !== 'rest' && ctx.state === 'playing';
    if (on && !hum) { try { hum = ctx.audio.loop('sub_systems_hum', { position: sp.hull.clone(), volume: 0.55 }); } catch { hum = null; } }
  });

  // ── wheel5_turn: 4.0 s on a fixed clock (wheel_crank, then hydraulic_release at the tunnel door) ──
  const wheel = L.objects.get('wheel5');
  const spin = (t: number) => (wheel?.userData.spin as ((t: number) => void) | undefined)?.(t);
  L.vignette('wheel5_turn', () => {
    L.sfx('wheel_crank', 22.6, 5.9, -52.0);
    L.tween(0, WHEEL5.duration, (k) => spin(k * WHEEL5.duration), () => spin(WHEEL5.duration));
    L.after(WHEEL5.duration - 0.4, () => L.sfx('hydraulic_release', 22.5, 2.0, -53.0));
  }, { snap: () => spin(WHEEL5.duration) });

  // ── drains: the grille lifts (the shell's panel opens with it: collider off, its own sump_lift) ──
  for (const id of ['drain5_a', 'drain5_b'] as const) {
    const panel = () => L.objects.get(`${id}_grille`)?.userData as { open?: (m: string, snap?: boolean) => void } | undefined;
    // (the shell's walkable panel is invisible under the kit grille; once lifted it is hidden whole — with any decal on it)
    const hidePanel = () => { const g = L.objects.get(`${id}_grille`); if (g) g.visible = false; };
    L.vignette(id, () => {
      panel()?.open?.('lift');
      L.tween(0, 0.7, (k) => S.drains[id]?.lift(1 - (1 - k) * (1 - k)), () => { S.drains[id]?.lift(1); hidePanel(); });
    }, { snap: () => { panel()?.open?.('lift', true); S.drains[id]?.lift(1); hidePanel(); } });
  }

  // ── lights_out5, the bay half (by group names): sub5 dims out from the bay's middle, then sub5_emerg ──
  const ORIGIN = [34, -40] as const, PER_M = 0.02, DIM = 1.2;
  const bayOut = (instant: boolean) => {
    for (const h of lmgr.group('sub5')) {
      if (instant) { h.enabled = false; h.intensityScale = 1; continue; }
      if (!h.enabled) continue;
      const d = Math.hypot(h.position.x - ORIGIN[0], h.position.z - ORIGIN[1]) * PER_M;
      L.tween(d, DIM, (k) => { h.intensityScale = (1 - k) * (k < 0.15 ? 1 : 0.85 + 0.15 * Math.sin(k * 40)); }, () => { h.enabled = false; h.intensityScale = 1; });
    }
    if (instant) lmgr.setGroup('sub5_emerg', { enabled: true });
    else L.after(DIM + 0.25, () => lmgr.setGroup('sub5_emerg', { enabled: true }));
  };
  const prev = L.vignettes.get('lights_out5');
  /** Only when the spine registered no half of its own (D2a): its mains die and `spine5_emerg` comes on, as the greybox did. */
  const spineOut = (instant: boolean) => {
    for (const h of lmgr.group('spine5')) {
      if (instant || !h.enabled) { h.enabled = false; h.intensityScale = 1; continue; }
      const d = Math.hypot(h.position.x - ORIGIN[0], h.position.z - ORIGIN[1]) * PER_M;
      L.tween(d, DIM, (k) => { h.intensityScale = 1 - k; }, () => { h.enabled = false; h.intensityScale = 1; });
    }
    if (instant) lmgr.setGroup('spine5_emerg', { enabled: true });
    else L.after(DIM + 0.6, () => lmgr.setGroup('spine5_emerg', { enabled: true }));
  };
  L.vignette('lights_out5', () => {
    if (prev && !prev.fired) { prev.fired = true; prev.run(); }
    L.sfx('lights_out_dock', 34, 8, -40, 1.0);
    bayOut(false);
    if (!prev) { L.after(0.6, () => L.sfx('lights_out_dock', 30, 2.5, -16, 0.8)); spineOut(false); }
  }, { snap: () => { if (prev?.snap) { prev.fired = true; prev.snap(); } bayOut(true); if (!prev) spineOut(true); } });

  // ── dark5_on (§2.7.3): regions.dark gains spine5 and sub5 (idempotent) ──
  const darkOn = () => {
    const regions = ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
    if (!regions) return;
    const list = (regions.dark ??= []);
    for (const id of ['spine5', 'sub5'] as const) {
      const r = ROOMS5[id];
      const bx = box3([r.x0 - 0.1, r.y0 - 0.5, r.z0 - 0.1, r.x1 + 0.1, r.y0 + r.h, r.z1 + 0.1]);
      if (!list.some((q) => q.equals(bx))) list.push(bx);
    }
  };
  L.vignette('dark5_on', darkOn, { snap: darkOn });

  // ── whatever switched it: the emergency state drives the beacons, their sounder and the bay's red strips ──
  const emergOn = () => lmgr.group('sub5_emerg').some((h) => h.enabled);
  let k = 0, beaconsOn = false;
  const sounders: (LoopHandle | null)[] = [];
  L.updaters.push((dt) => {
    const on = emergOn();
    k = Math.max(0, Math.min(1, k + (on ? dt / 0.5 : -dt / 0.3)));
    if (on !== beaconsOn) { beaconsOn = on; for (const bc of S.beacons) bc.set(on); if (!on) { for (const s of sounders) s?.stop(0.3); sounders.length = 0; } }
    if (on && !sounders.length && ctx.state === 'playing') {
      for (const p of [V(34, 9.1, -18.5), V(34, 9.1, -55.5)]) { try { sounders.push(ctx.audio.loop('alarm_beacon', { position: p, volume: 0.32 })); } catch { sounders.push(null); } }
    }
  });

  // ── the tunnel door's panel follows the door (CO's authority → isolated → restored), once restored it stays ──
  let shown = '';
  L.updaters.push(() => {
    const d = L.doors.get('d5_tunnel');
    if (!d) return;
    const s = d.shown === 'cycling' ? 'cycling' : d.shown === 'open' || shown === 'open' ? 'open' : 'locked';
    if (s === shown) return;
    shown = s;
    text('tunnel_panel', 'terminal_idle', s === 'open' ? '유압 복구됨 — 열림' : s === 'cycling' ? '함장 해제 — 유압 차단됨 ↑' : "트렁크 터널 — 함장 권한");
  });
  void boat;
}

// ───────────────────────────────────────────────────────────── dive locker, lock access, tunnel

function buildDive(L: LevelBuild) {
  restyle(L, 'dive5_grey', isStandin, null);
  const b = L.builder('dive5_dress');
  const fx = L.ctx.fx as FxSystemEx;
  // (IB5b B6: a pure-red 7 cd lamp turned the whole locker one red: an orange-red, weaker; the suits keep their colour)
  const h = L.point('dive5', 49.0, 2.95, -33.0, 0xff9a7a, 5.0, 10, { bounds: rbox('dive5', -0.05, 3.3) });
  const m = lampLens5(L, 'red', 0.9).clone(); m.name = 'd3_dive_lamp';
  h.bindEmissive(m, 1.2);
  b.bx('painted_dark', 48.8, 3.08, -33.15, 49.2, 3.2, -32.85);
  b.detail(() => b.bx(m, 48.85, 3.05, -33.1, 49.15, 3.08, -32.9));
  b.at(48.9, 0, -28.2, PI, () => diveSuits(b, L, { n: 6, pitch: 0.6, seed: 31 }));
  b.at(50.3, 0, -37.8, 0, () => decompressionChamber(b, L, { panel: '+x', collide: false }));
  // the shells' shelf (51.4, 1.0, −29.0) and the dive board's frame
  b.at(51.8, 1.0, -29.0, -PI / 2, () => wallShelf(b, L, { w: 0.6, d: 0.45 }));
  b.bx('painted_dark', 51.79, 1.0, -31.0, 51.8, 2.2, -29.6);
  // a bench and fins, a wet floor under the suits
  b.bx('navy_grey', 46.6, 0, -31.9, 47.0, 0.45, -29.2).bx('steel_raw', 46.55, 0.45, -31.95, 47.05, 0.48, -29.15);
  const w: B6 = [47.4, 0, -29.9, 50.6, 0.02, -28.8];
  fx.wetPatch(box3(w), ['dive5'], { id: 'fx5_wet_dive', seenFrom: ['sub5'] });
  addWet(L, w);
  navySign(b, '잠수 장비함 — SDV 턴', 46.21, 2.3, -30.5, 1.6, 0.16, '+x');
  // red wall-base strips (the bay's) on the free walls and across the door's approach
  for (const [ax, az, bx, bz] of [[46.5, -39.5, 46.5, -36.0], [46.5, -32.0, 46.5, -29.6], [46.9, -39.5, 48.6, -39.5], [51.5, -35.5, 51.5, -31.2], [46.6, -35.0, 46.6, -33.0]] as const) bayStrip(b, L, ax, az, bx, bz);
  emergStrips5(L);
}

function buildLockAcc(L: LevelBuild) {
  restyle(L, 'lockacc5_grey', isStandin, null);
  const b = L.builder('lockacc5_dress');
  const h = L.point('lockacc5', 42.0, 2.95, -59.2, 0xffe0bc, 8, 8, { bounds: rbox('lockacc5', -0.05, 3.3) });
  const m = lampLens5(L, 'warm', 0.9).clone(); m.name = 'd3_lockacc_lamp';
  h.bindEmissive(m, 1.4);
  b.bx('painted_dark', 41.4, 3.08, -59.4, 42.6, 3.2, -59.0);
  b.detail(() => b.bx(m, 41.45, 3.05, -59.35, 42.55, 3.08, -59.05));
  // flood valves: a 0.3 m main along the west wall (toward the lock), three valve wheels, gauges
  const P = L.ctx.materials.clone('painted_white', { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, color: 0x5f6f66, roughness: 0.5, metalness: 0.1 });
  P.name = 'd3_pipe_acc';
  b.rod(P, 38.45, 0.6, -61.8, 38.45, 0.6, -56.6, 0.15, 14);
  b.rod(P, 38.45, 0.6, -56.6, 38.45, 3.2, -56.6, 0.15, 14);
  for (const z of [-60.8, -59.2, -57.6]) {
    b.rod(P, 38.45, 0.6, z, 38.95, 0.6, z, 0.08, 10);
    b.cyl('steel_raw', 38.95, 0.6, z, 0.12, 0.2, 'x', 12);
    b.rod('steel_raw', 38.95, 0.6, z, 38.95, 1.15, z, 0.025, 6);
    b.torus('painted_yellow', 38.95, 1.2, z, 0.2, 0.02, 'y', 18);
  }
  b.collide(38.2, 0, -61.8, 39.15, 1.25, -56.4, 'metal', true);
  for (const z of [-60.8, -59.2]) { b.cyl('painted_dark', 38.22, 1.9, z, 0.12, 0.05, 'x', 16); b.detail(() => b.quad('painted_white' as Mat, 38.25, 1.9, z, 0.18, 0.18, '+x', 0, 'unit', 0.001)); }
  b.detail(() => b.quad('hazard_stripes' as Mat, 42, 0, -61.5, 7.4, 0.5, '+y', 0, 'box', 0.003));
}

function buildTunnel(L: LevelBuild) {
  restyle(L, 'tunnel5_grey', (m) => m.name === 'grey_dark' || isStandin(m), null);
  const b = L.builder('tunnel5_dress');
  const fx = L.ctx.fx as FxSystemEx;
  const h = L.point('tunnel5', 18.0, 2.75, -53.0, 0xffe0bc, 9, 9, { bounds: rbox('tunnel5', -0.05, 3.1) });
  const m = lampLens5(L, 'warm', 0.9).clone(); m.name = 'd3_tunnel_lamp';
  h.bindEmissive(m, 1.4);
  b.bx('painted_dark', 17.4, 2.88, -53.2, 18.6, 3.0, -52.8);
  b.detail(() => b.bx(m, 17.45, 2.85, -53.15, 18.55, 2.88, -52.85));
  // cable trays both walls (tray LEDs amber), the trunk cable from the bay wall west into the head-end door's gland
  b.at(18.0, 2.2, -50.2, PI, () => cableTray(b, L, { len: 7.6, led: 'amber', seed: 21 }));
  b.at(18.0, 2.2, -55.8, 0, () => cableTray(b, L, { len: 7.6, led: 'amber', seed: 22 }));
  b.at(14.2, 0.95, -51.0, PI / 2, () => { b.cyl('painted_dark', 0, 0, 0.06, 0.22, 0.12, 'z', 16); b.cyl('steel_raw', 0, 0, 0.13, 0.17, 0.04, 'z', 16); });
  b.at(21.8, 0.5, -50.55, -PI / 2, () => { b.cyl('painted_dark', 0, 0, 0.06, 0.22, 0.12, 'z', 16); b.cyl('steel_raw', 0, 0, 0.13, 0.17, 0.04, 'z', 16); });
  trunkCable(b, L, { pts: [[21.7, 0.5, -50.55], [20.5, 0.42, -50.55], [16.0, 0.42, -50.55], [14.8, 0.6, -50.8], [14.3, 0.95, -51.0]], r: 0.125, bands: 1.0 });
  for (const x of [20.0, 17.5, 15.2]) b.bx('steel_raw', x - 0.05, 0, -50.75, x + 0.05, 0.3, -50.35);
  // the medkit shelf (21.0, 1.0, −50.6)
  b.at(21.0, 1.0, -50.2, PI, () => wallShelf(b, L, { w: 0.6, d: 0.45 }));
  b.detail(() => b.quad('hazard_stripes' as Mat, 21.5, 0, -53.0, 0.5, 3.0, '+y', 0, 'box', 0.003));
  const w: B6 = [15.2, 0, -55.4, 17.8, 0.02, -53.8];
  fx.wetPatch(box3(w), ['tunnel5'], { id: 'fx5_wet_tunnel', seenFrom: ['sub5'] });
  addWet(L, w);
}

// ───────────────────────────────────────────────────────────── the table

const hull: MaterialName = 'hull_white';
export const BAY_DRESS: Partial<Record<RoomId5, RoomDress>> = {
  sub5: { build: buildSub, lights: [], look: { floor: 'deck_nonslip', wall: hull, ceiling: 'painted_dark' }, label: false },
  dive5: { build: buildDive, lights: [], look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'painted_dark' }, label: false },
  lockacc5: { build: buildLockAcc, lights: [], look: { floor: 'deck_nonslip', wall: hull, ceiling: 'painted_dark' }, label: false },
  tunnel5: { build: buildTunnel, lights: [], look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'painted_dark' }, label: false },
};
