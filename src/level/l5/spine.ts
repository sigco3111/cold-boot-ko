/**
 * POST 4 — the spine, the crawlway, the armoury and the magazine (stage 3c §2.6, §2.7, §4.6, §4.7, §5.5; task D2a).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const SPINE_DRESS: Partial<Record<RoomId5, RoomDress>>
 * for spine5 (+ the crawl: its floors) and arm5 (+ the magazine: its floors). The shell (grey.ts) keeps every collider,
 * door, trigger, screen, interactable and marker; this file hides the stand-in visuals and dresses them:
 *
 *  spine5   hull ribs every 3 m from x 9.5, pipe risers R1 … R7 on the shell's colliders, the bar grating over the crawl,
 *           the hatch pit (W7 `hatchLid`, 8 mm proud of the stair's top tread; rails; a stop frame for the open lid),
 *           Kessler's door (W7 `cmdDoor`: port, silhouette, camera + tally, yellow line) with its collider re-cut so the
 *           port is the `mk5_glass` `port` pane, ceiling fittings bound to the lights, emergency strips (off until
 *           `lights_out5`), fire hose box, cable tray, stencils; the vent grille (`vent5_spine`).
 *  crawl    joists under the grating, pipe bundles on both walls, red LED strips on both floor edges and the stair
 *           nosings, two red wall LEDs (`crawl5`), wet patches + drips (`fx5_drips_crawl`).
 *  arm5     cage rack (23 slots, 4 carbines + the pickup's slot), issue desk, shelves under the pickups, the vest
 *           shelf, the magazine hatch (W7 `hatchLid`, plate lamp red → green), its rails, fittings.
 *  magazine ammo-tin racks with per-shelf colliders (the stand-in blocks' colliders are removed), issue ledges under the
 *           pickups at the rack faces, the plate bench, the caged emergency lamp that pops (`mag5`), the fire-party
 *           board, the tally board, the exit stencil, the flooded corner + drips (`fx5_drips_mag`).
 *
 * Lights (§2.7.1, S5 floor bounds) are made here (handles needed for fittings / the lamp pop); the `lights` tables are
 * empty. Groups: `spine5` (3 points + the grating spot), `spine5_emerg` (2 red, off), `crawl5` (2 red), `arm5` (point +
 * cage spot), `mag5` (1 caged point).
 *
 * Vignettes (each with its `:snap`): `hatch5_spine_open`, `hatch5_mag_open`, `v5_magazine`, `cmd5_line` (toggle),
 * `cmd5_port_look` (toggle), `vent5_spine`; the spine half of `lights_out5` and the `v5_body` smear are HOOKS on those
 * ids (`hookVignette`): whoever registers `lights_out5` (D3's bay half) or `v5_body` (D2b) — before or after this file,
 * or the greybox placeholder — gets this file's half run after its own. `lights_out5` works by light-group names only.
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { FxSystemEx } from '../../fx';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { StairDef } from '../l3/grey';
import { isStandin, restyle } from '../l3/kit3';
import {
  LIGHTS_OUT5, PANES5, STAIR5_HATCH, STAIR5_MAG_IN, STAIR5_MAG_OUT, addWet, box3, placeLights5, type LightRow5, type RoomId5,
} from './grey';
import type { RoomDress } from './index';
import {
  ammoTinRack, bulkheadLamp, cableTray, cageRack, crawlJoists, fireBoard, fireHoseBox, grating, hullNumber, hullRib,
  issueDesk, navyBody, navySign, openShelf, pipeBundle, pipeRiser, rail, stairDressing, strip5, stripMat5, wallShelf,
  type BulkheadLamp,
} from './kit5';
import { HATCH5_MAG, HATCH5_SPINE, cmdDoor, hatchLid, minJerk } from './setpieces';
import { emergStrips5 } from './bay';
import { installPortalCull4 } from '../l4/kit4';

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type Box6 = [number, number, number, number, number, number];

// ───────────────────────────────────────────────────────────── shared helpers

const WARM = 0xffe2c0, RED = 0xff2a18;
/** S5: the spine's and the armoury's lights stay above their floors; the crawl's in the crawl; `mag5` below −0.1. */
const SPINE_B: Box6 = [7.9, -0.02, -18.1, 44.1, 3.4, -13.9];
const ARM_B: Box6 = [13.9, -0.02, -28.1, 22.1, 3.4, -17.9];
const CRAWL_B: Box6 = [16.3, -1.5, -18.1, 38.7, -0.04, -15.3];
const MAG_B: Box6 = [14.1, -2.7, -27.9, 21.9, -0.1, -20.0];
/** The grating lamp reaches through the grating into the crawl (bars, MEDIUM+). */
const GRATE_SPOT_B: Box6 = [8, -1.5, -18.1, 44, 3.4, -13.9];

function lightRow(L: LevelBuild, r: LightRow5): LightHandle { return placeLights5(L, [r])[0]; }

/**
 * Remove a collider the shell made (a stand-in replaced by a prop with its own colliders): every collider item, solid,
 * nav solid and obstacle whose box equals `bx` (± 1 mm). Returns how many collider items went.
 */
function dropCollider(L: LevelBuild, bx: Box6): number {
  const want = box3(bx), tmp = new THREE.Box3(), unit = new THREE.Box3(V(-0.5, -0.5, -0.5), V(0.5, 0.5, 0.5));
  const same = (b: THREE.Box3) => b.min.distanceTo(want.min) < 2e-3 && b.max.distanceTo(want.max) < 2e-3;
  const items = (L as unknown as { colliderItems: Record<string, { m: THREE.Matrix4 }[]> }).colliderItems;
  let n = 0;
  for (const k of Object.keys(items)) {
    const list = items[k];
    for (let i = list.length - 1; i >= 0; i--) if (same(tmp.copy(unit).applyMatrix4(list[i].m))) { list.splice(i, 1); n++; }
  }
  for (const arr of [L.solids, L.navSolids, L.obstacles]) for (let i = arr.length - 1; i >= 0; i--) if (same(arr[i])) arr.splice(i, 1);
  if (!n) console.warn(`[spine5] dropCollider: no collider at [${bx.join(', ')}]`);
  return n;
}

// ── vignette hooks: a second half that runs after whatever owner registers the id ──
interface VigEntry { run: () => void; toggle: boolean; fired: boolean; snap?: () => void; d2a?: boolean; base?: () => void }
interface Hook { run: () => void; snap: () => void }
const HOOKS = new WeakMap<LevelBuild, Map<string, Hook>>();
function wrapEntry(v: VigEntry, h: Hook | undefined): VigEntry {
  if (!h || v.d2a) return v;
  return {
    ...v, d2a: true, base: v.run,
    run: () => { try { v.run(); } finally { h.run(); } },
    snap: () => { try { v.snap?.(); } finally { h.snap(); } },
  };
}
/**
 * Make `run` / `snap` the second half of vignette `id`, whoever registers it and whenever (the registry's `set` is
 * wrapped once per level, so a later registration — D3, D2b, the greybox placeholder — keeps this half).
 */
function hookVignette(L: LevelBuild, id: string, run: () => void, snap: () => void) {
  const map = L.vignettes as unknown as Map<string, VigEntry>;
  let hooks = HOOKS.get(L);
  if (!hooks) {
    const hk = (hooks = new Map());
    HOOKS.set(L, hk);
    const set0 = map.set.bind(map);
    (map as { set: (k: string, v: VigEntry) => Map<string, VigEntry> }).set = (k, v) => set0(k, wrapEntry(v, hk.get(k)));
  }
  hooks.set(id, { run, snap });
  const cur = map.get(id);
  if (cur && !cur.d2a) map.set(id, cur);
}
/** The owner's own run of a hooked vignette (null when nobody but this file registered it). */
const baseOf = (L: LevelBuild, id: string) => (L.vignettes.get(id) as VigEntry | undefined)?.base ?? null;

/** Ship-stair treads + closed risers over a W4 stair's (invisible) collider; `skipTop` leaves the tread under a lid. */
function shipTreads(b: Builder, s: StairDef, M: Mat, skipTop: boolean) {
  const y0 = s.y0 ?? 0, n = skipTop ? s.risers - 1 : s.risers;
  for (let k = 0; k < n; k++) {
    // (the top tread under a lid sits 12 mm below the deck: the shut lid's body bottoms out 4 mm above it otherwise)
    const za = s.z0 + s.dir * s.tread * k, zb = za + s.dir * s.tread, top = y0 + s.rise * (k + 1) - (k === s.risers - 1 ? 0.012 : 0);
    b.bx(M, s.x0 + 0.018, top - 0.04, Math.min(za, zb), s.x1 - 0.018, top, Math.max(za, zb));
    // riser plate at the nose (closed stair), 1 cm behind the nose so its face never meets the tread's front face
    const zr = za + s.dir * 0.01;
    b.bx(M, s.x0 + 0.018, top - s.rise, Math.min(zr, zr + s.dir * 0.012), s.x1 - 0.018, top - 0.04, Math.max(zr, zr + s.dir * 0.012));
  }
}
/** Red nosing strips on a stair (skipping the top tread when a lid lies over it). */
function nosings(b: Builder, L: LevelBuild, s: StairDef, skipTop: boolean) {
  const y0 = s.y0 ?? 0, n = skipTop ? s.risers - 1 : s.risers;
  for (let k = 0; k < n; k++) { const zn = s.z0 + s.dir * s.tread * k + s.dir * 0.045; strip5(b, L, s.x0 + 0.1, zn, s.x1 - 0.1, zn, { y: y0 + s.rise * (k + 1), ch: 'red', channel: 'navy_grey' }); }
}
/** Lid swing: dogs first (0.5 s), the lid up over 1.2 s. Sounds are the vignette's (§8.11). */
function swingLid(L: LevelBuild, lid: THREE.Object3D, at: THREE.Vector3, onOpen?: () => void) {
  const ud = lid.userData as { k: number; open(k: number): void; dogs(k: number): void };
  if (ud.k >= 0.99) return;
  L.sfx('hatch_unlatch', at.x, at.y, at.z, 0.9);
  L.tween(0, 0.5, (k) => ud.dogs(minJerk(k)), () => ud.dogs(1));
  L.after(0.45, () => { L.sfx('hatch_open', at.x, at.y + 0.3, at.z, 1.0); onOpen?.(); });
  L.tween(0.45, 1.2, (k) => ud.open(minJerk(k)), () => ud.open(1));
}
/** W7 lid (its deck curb sits outside the opening and its box is walkable while shut — IB5b moved both into the set piece). */
function lidOf(L: LevelBuild, b: Builder, spec: typeof HATCH5_SPINE): THREE.Object3D { return hatchLid(L, b, spec); }

// ───────────────────────────────────────────────────────────── spine5 + the crawl

/** Pipe risers (§2.6): [x0, south]. */
const RISERS: [number, boolean][] = [[11.7, true], [13.7, false], [21.7, true], [25.7, false], [27.7, true], [34.7, false], [40.7, true]];

const spine: RoomDress = {
  label: false,
  look: { floor: 'deck_nonslip', wall: 'hull_white', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    const ctx = L.ctx, fx = ctx.fx as FxSystemEx;
    const b = L.builder('spine5_dress');
    // stand-in visuals out (their colliders stay): risers, the pit stair blocks, the shelf; the grey rails, the grey
    // yellow line, the greybox grating quad
    restyle(L, 'spine5_grey', isStandin, null);
    restyle(L, 'spine5_grey', (m) => m.name === 'grey_dark' || m.name === 'grey_yellow_line' || m === L.doubleSided('floor_grate'), null);

    // ── view culling (IB5b B6): level 4's portal culling on level 5's portal graph — rooms behind the walls of the
    // graph's set are not drawn and their lights score as hidden (on LOW the armoury's and the magazine's lamps took
    // slots from the spine through the shut d5_arm, which the graph keeps for the crawl turn). The one non-door
    // opening is that turn under the armoury floor.
    installPortalCull4(L, [{ a: 'spine5', b: 'arm5', wall: 'z', at: -18, u0: 16.4, u1: 17.6, y0: -1.4, y1: -0.07 }]);

    // ── lights (§2.7.1) ──
    const sp = [13, 25, 37].map((x) => lightRow(L, { group: 'spine5', type: 'point', p: [x, 2.68, -16], color: WARM, i: 9.5, d: 12, bounds: SPINE_B }));
    const gspot = lightRow(L, { group: 'spine5', type: 'spot', p: [28, 3.02, -16], t: [28, -1.4, -16], color: WARM, i: 9, d: 6.5, angle: 0.75, cast: true, prio: 0.6, min: 'medium', bounds: GRATE_SPOT_B });
    // (IB5b B6: + a third over the stand line — Kessler's door read black after lights-out, the nearest pool 10 m away)
    // (IA-5: + a fourth at x 25 — check:dark's lamp-off walk failed 14–16 m running between the pools at 16 and 34)
    const EM: [number, number][] = [[16, -16.9], [34, -15.1], [42.0, -17.3], [25, -16.9]];
    const em = EM.map(([x, z], i) => lightRow(L, { group: 'spine5_emerg', type: 'point', p: [x, 2.85, z], color: RED, i: i === 2 ? 2.4 : 3.2, d: i === 2 ? 7 : 11, off: true, bounds: SPINE_B }));
    const cr = [22, 32].map((x) => lightRow(L, { group: 'crawl5', type: 'point', p: [x, -0.42, -15.7], color: RED, i: 2.6, d: 7.5, prio: 1.3, bounds: CRAWL_B }));

    // fittings: fluorescent tubes on the deckhead centre line, each lens bound to the nearest main (dies with it)
    const lens = sp.map((h) => L.glow(h, 'emissive_warm', 0.75));
    for (const [x, i] of [[11, 0], [17, 0], [23, 1], [35, 2], [41, 2]] as const) {
      b.bx('navy_grey', x - 0.66, 3.11, -16.12, x + 0.66, 3.2, -15.88);
      b.bx(lens[i], x - 0.6, 3.09, -16.07, x + 0.6, 3.11, -15.93);
    }
    // the grating lamp: a downlight can over x 28 (its lens follows the spot)
    const glens = L.glow(gspot, 'emissive_warm', 0.6);
    b.cyl('navy_grey', 28, 3.125, -16, 0.15, 0.15, 'y', 16);
    b.cyl(glens, 28, 3.04, -16, 0.11, 0.02, 'y', 16);
    // emergency fittings (red lens, dark until lights-out) and the crawl's wall LEDs
    em.forEach((h, i) => {
      const m = L.glow(h, 'emissive_red', 1.0), [x, z] = EM[i];
      b.bx('navy_grey', x - 0.16, 3.12, z - 0.1, x + 0.16, 3.2, z + 0.1);
      b.bx(m, x - 0.12, 3.1, z - 0.06, x + 0.12, 3.12, z + 0.06);
    });
    cr.forEach((h, i) => {
      const m = L.glow(h, 'emissive_red', 1.2), x = i === 0 ? 22 : 32;
      b.bx('navy_grey', x - 0.12, -0.44, -15.46, x + 0.12, -0.3, -15.4);
      b.bx(m, x - 0.09, -0.42, -15.475, x + 0.09, -0.32, -15.46);
    });

    // ── hull ribs every 3 m from x 9.5 (legs dropped at doors and at the open lid's frame) ──
    const legs: Record<number, 'both' | '+x' | '-x' | 'none'> = { 15.5: '-x', 18.5: 'none', 30.5: '+x', 33.5: '-x', 36.5: '-x' };
    for (let x = 9.5; x < 43.8; x += 3) b.at(x, 0, -16, PI / 2, () => hullRib(b, L, { legs: legs[x] ?? 'both' }));
    // frame numbers on the plating
    for (const [x, t] of [[9.9, 'FR 104'], [24.9, 'FR 109'], [39.9, 'FR 114']] as const) hullNumber(b, t, x, 2.45, -14.205, '-z', 0.16);

    // ── pipe risers on the shell's colliders ──
    const tags = ['소화 주관 ↑', '냉수', '소화 주관 ↑', '해수 — 열지 마세요', '고압 공기', '소화 주관 ↑', '냉수'];
    RISERS.forEach(([x0, south], i) => b.at(x0 + 0.3, 0, south ? -17.8 : -14.2, south ? 0 : PI, () => pipeRiser(b, L, { collide: false, tag: tags[i] })));

    // ── the grating strip over the crawl (the shell's collider stays) + the crawl's deckhead joists ──
    grating(b, L, { x0: 16.4, z0: -16.6, x1: 36.2, z1: -15.4, frame: ['-x', '+z', '-z'], collide: false });
    b.at(26.3, -0.03, -16.0, 0, () => crawlJoists(b, L, { len: 19.7, w: 1.14, every: 1.2 }));

    // ── emergency strips along both walls (channel `emerg`, the level's one red: a trim while lit, bright at lights-out) ──
    emergStrips5(L);
    const runs = (z: number, cuts: [number, number][]) => {
      let a = 8.35;
      for (const [c0, c1] of [...cuts, [43.65, 99] as [number, number]]) { if (c0 - a > 0.2) strip5(b, L, a, z, c0, z, { ch: 'emerg', channel: 'navy_grey' }); a = c1; }
    };
    // (cut at the risers, the pit, and the door sills: a strip across a sill z-fights the frame)
    runs(-17.7, [[11.6, 12.4], [15.9, 18.1], [21.6, 22.4], [27.6, 28.4], [32.9, 35.1], [36.05, 38.75], [40.6, 41.4]]);
    runs(-14.3, [[13.6, 14.4], [16.9, 19.1], [25.6, 26.4], [29.9, 32.1], [34.6, 35.4]]);

    // ── the crawl: pipe bundles on both walls, red strips on both floor edges, the turn, the pit landing ──
    b.at(26.3, -1.4, -15.4, PI, () => pipeBundle(b, L, { len: 19.6 }));
    b.at(26.95, -1.4, -16.6, 0, () => pipeBundle(b, L, { len: 18.3, pipes: [[0.05, 0.42, 0.08], [0.035, 0.62, 0.06]] }));
    const red = (ax: number, az: number, bx: number, bz: number) => strip5(b, L, ax, az, bx, bz, { y: -1.4, ch: 'red', channel: 'navy_grey' });
    red(16.5, -15.5, 37.3, -15.5);              // north edge (crawl strip + landing)
    red(17.7, -16.5, 36.1, -16.5);              // south edge of the strip
    red(36.3, -17.5, 37.3, -17.5);              // landing, south
    red(36.3, -17.4, 36.3, -16.7);              // landing, west
    red(16.5, -15.6, 16.5, -17.95);             // the turn (spine part), both walls
    red(17.5, -16.7, 17.5, -17.95);
    // the pit's stair: ship treads + closed risers on W4's collider, red nosings, a stringer + handrail on the landing side
    shipTreads(b, STAIR5_HATCH, 'navy_grey', false);
    nosings(b, L, STAIR5_HATCH, true);
    // (no stair handrail: it would stand through the shut lid) — a grab rail on the pit's east wall below the lid
    b.rod('steel_raw', 38.53, -0.95, -17.3, 38.53, -0.2, -15.75, 0.02, 8);
    for (const [y, z] of [[-0.95, -17.3], [-0.2, -15.75]] as const) b.bx('steel_raw', 38.52, y - 0.02, z - 0.02, 38.6, y + 0.02, z + 0.02);
    {
      const s = STAIR5_HATCH, run = s.tread * s.risers, rise = s.rise * s.risers, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
      b.rbox('navy_grey', s.x0 - 0.012, -1.4 + rise / 2 + 0.05, s.z0 + run / 2, 0.02, 0.34, len + 0.2, -ang, 0, 0);
    }
    // wet patches + drips through the grating (§2.9 fx5_drips_crawl)
    const wetBoxes: Box6[] = [[22.5, -1.4, -16.5, 24.7, -1.39, -15.5], [29.4, -1.4, -16.55, 31.1, -1.39, -15.45], [36.3, -1.4, -17.5, 37.3, -1.39, -16.4]];
    for (const w of wetBoxes) { fx.wetPatch(box3(w), ['spine5'], { id: 'wet5_crawl' }); addWet(L, w); }
    const dripBox = box3([16.4, -1.4, -16.6, 36.2, -0.05, -15.4]);
    for (const [x, z] of [[20, -16.0], [28, -15.8], [34, -16.2]]) fx.emitter('drip', V(x, -0.09, z), V(0, -1, 0), 0.6, { bounds: dripBox, rooms: ['spine5'], id: 'fx5_drips_crawl' });
    b.detail(() => {
      b.decal('water_stain', 0, 21.2, -0.8, -15.405, 1.6, 1.0, '-z');
      b.decal('water_stain', 2, 30.6, -0.9, -16.595, 1.8, 1.0, '+z');
      b.decal('grime', 1, 19.2, -1.394, -16.0, 4.4, 1.0, '+y');
    });

    // ── the hatch pit: the W7 lid (8 mm proud: the stair's top tread lies under it), rails, the stop frame ──
    const lidS = lidOf(L, b, { ...HATCH5_SPINE, y: 0.008 });
    rail(b, L, { pts: [[36.175, -17.6], [36.175, -15.375], [37.4, -15.375]], h: 1.0, collide: false });
    rail(b, L, { pts: [[38.625, -17.6], [38.625, -15.4]], h: 1.0, collide: false });
    b.bx('navy_grey', 36.22, 0.6, -15.392, 37.38, 0.84, -15.36);   // the stencil's backing plate on the north rail
    for (const x of [36.3, 38.5]) b.bx('steel_raw', x - 0.03, 0, -17.79, x + 0.03, 2.24, -17.73);
    b.bx('steel_raw', 36.27, 2.18, -17.79, 38.53, 2.24, -17.73);
    b.bx('painted_yellow', 37.33, 1.9, -17.73, 37.47, 1.96, -17.68);  // the stay hook the open lid rests against
    navySign(b, '빌지 출입 ↓ — 탄약고 연결 통로', 37.4, 2.5, -17.795, 1.9, 0.16, '+z');
    L.vignette('hatch5_spine_open', () => swingLid(L, lidS, V(37.4, 0.1, -16.5)), {
      snap: () => { const u = lidS.userData; u.dogs(1); u.open(1); },
    });

    // ── Kessler's door (W7): hardened leaf, the port, the camera + tally, the intercom, the yellow line ──
    const door = cmdDoor(L, b, {});
    const du = door.userData as { look(on: boolean): void; tally(s: 'red' | 'amber' | 'white' | 'off'): void; watch(p: THREE.Vector3 | null): void; pulse(on: boolean): void; lineGlow(k: number): void };
    // the set piece's collider leaves the port open in front of the `mk5_glass` pane (`port`, x 43.83 … 43.86): the
    // pane's glass collider goes in it — a round from the line through the port stars the glass, not the frame
    { const p = PANES5.find((q) => q.id === 'port')!.box; b.collide(p[0], p[1], p[2], p[3], p[4], p[5], 'glass', false); }
    // where to stand: the line (glowing, under the rib arch at x 42.5, the camera turning to it) and a deck stencil
    b.detail(() => b.sign('선에서 정지', 'stencil', 41.7, 0.006, -16.0, 1.6, 0.26, '+y', -PI / 2));
    navySign(b, '지휘 모듈 — 인가된 인원만', 38.4, 1.95, -14.205, 2.6, 0.16, '-z');
    // the door camera watches whoever is in the east half of the spine (else the line)
    let cmdLine = false, cmdLook = false, watchT = 0;
    const linePt = V(42.5, 1.6, -16);
    L.updaters.push((dt) => {
      if ((watchT -= dt) > 0) return;
      watchT = 0.2;
      const e = ctx.player?.eye;
      du.watch(e && e.x > 30 && e.x < 44 && e.z > -18 && e.z < -14 && e.y > -0.2 ? e : linePt);
    });
    const tallyNow = () => du.tally(cmdLook ? 'white' : cmdLine ? 'amber' : 'red');
    L.vignette('cmd5_line', () => { cmdLine = !cmdLine; du.pulse(cmdLine); tallyNow(); }, { toggle: true, snap: () => { cmdLine = false; du.pulse(false); tallyNow(); } });
    L.vignette('cmd5_port_look', () => { cmdLook = !cmdLook; du.look(cmdLook); tallyNow(); }, { toggle: true, snap: () => { cmdLook = false; du.look(false); tallyNow(); } });

    // ── the ceiling vent (30.0, 3.2, −16.0): a grating grille over the void; it drops (`vent5_spine`) and lies on the deck ──
    const grille = L.objects.get('vent5_spine_grille');
    if (grille) {
      // (tag it with its room: untagged root children get the last-built room at assembly and would be culled here)
      grille.userData.rooms = ['spine5'];
      // a dark louvred grille (a grating texture aliases away at 3 m): the panel dark, steel louvres under it
      grille.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ctx.materials.get('painted_dark'); });
      // pivot about its own centre: the greybox panel's geometry is in world x / z about an origin at (0, y, 0) — shift
      // it by whatever offset it has from the grille's origin (0 once grey.ts builds it centred, as reported to IA5)
      {
        grille.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(grille);
        const dx = (bb.min.x + bb.max.x) / 2 - grille.position.x, dz = (bb.min.z + bb.max.z) / 2 - grille.position.z;
        if (Number.isFinite(dx) && Number.isFinite(dz)) for (const c of grille.children) { c.position.x -= dx; c.position.z -= dz; }
      }
      grille.position.set(30, 3.2, -16);
      const lv = L.part('vent5_spine_louvres');
      lv.bx('steel_raw', -0.4, -0.025, -0.4, 0.4, 0, -0.36).bx('steel_raw', -0.4, -0.025, 0.36, 0.4, 0, 0.4);
      lv.bx('steel_raw', -0.4, -0.025, -0.36, -0.36, 0, 0.36).bx('steel_raw', 0.36, -0.025, -0.36, 0.4, 0, 0.36);
      for (let i = 0; i < 7; i++) { const z = -0.3 + i * 0.1; lv.rbox('steel_raw', 0, -0.02, z, 0.72, 0.008, 0.06, 0.6, 0, 0); }
      grille.add(lv.build());
      const pb = grille.userData.box as { enabled: boolean };
      const rest = () => { grille.position.set(30.35, 0.068, -15.85); grille.rotation.set(PI - 0.03, 0.5, 0.02); grille.visible = true; };
      for (const [x0, z0, x1, z1] of [[29.5, -16.5, 30.5, -16.4], [29.5, -15.6, 30.5, -15.5], [29.5, -16.4, 29.6, -15.6], [30.4, -16.4, 30.5, -15.6]]) b.bx('steel_raw', x0, 3.17, z0, x1, 3.2, z1);
      L.vignette('vent5_spine', () => {
        if (!pb.enabled) return;
        pb.enabled = false;
        L.sfx('vent_grille', 30, 3.2, -16, 0.9);
        fx.dustSift?.(box3([29.4, 2.6, -16.6, 30.6, 3.2, -15.4]), { amount: 1.2 });
        L.tween(0, 0.62, (k) => { grille.position.set(30 + 0.35 * k, 3.2 - 3.132 * k * k, -16 + 0.15 * k); grille.rotation.set((PI - 0.03) * k, 0.5 * k, 0.02 * k); }, () => { rest(); fx.dustFall?.(V(30.35, 0.02, -15.85), { size: 0.8 }); });
      }, { snap: () => { pb.enabled = false; rest(); } });
    }

    // ── the rest of the corridor: fire hose box, cable tray, the ammo shelf by the door, stencils ──
    b.at(23.1, 1.35, -14.2, PI, () => fireHoseBox(b, L, { label: '소화 호스 4' }));
    for (const [x0, x1] of [[9.0, 13.5], [14.5, 25.5], [26.5, 34.5], [35.5, 43.2]] as const) b.at((x0 + x1) / 2, 2.86, -14.2, PI, () => cableTray(b, L, { len: x1 - x0, w: 0.34, cables: 5, seed: Math.round(x0) }));
    b.at(43.4, 1.0, -14.2, PI, () => wallShelf(b, L, { w: 0.6, d: 0.45 }));
    navySign(b, '← DUTY ROOM · KEYPAD', 9.2, 1.9, -17.795, 1.4, 0.13, '+z');
    navySign(b, '탄약고 출입 빌지 통로 경유 — FR 112', 30.4, 2.3, -17.795, 2.6, 0.13, '+z');
    b.detail(() => {
      b.decal('grime', 0, 28.5, 0.006, -14.7, 3.0, 0.7, '+y');
      b.decal('scratches', 2, 34.0, 0.006, -17.2, 1.4, 0.6, '+y');
      b.decal('water_stain', 1, 27.0, 2.2, -17.795, 1.4, 1.6, '+z');
      b.decal('water_stain', 3, 15.0, 2.4, -14.205, 1.2, 1.4, '-z');
    });

    // ── v5_body (D2b moves the body): the drag smear from the berths door to B and the older trail toward the sub-bay
    // door; hidden until the vignette (or its snap) runs ──
    const smear = L.part('v5_body_smear');
    const drag = (ax: number, az: number, bx2: number, bz: number, w: number, v: number) => {
      const dx = bx2 - ax, dz = bz - az, len = Math.hypot(dx, dz);
      smear.decal('blood_smear', v, (ax + bx2) / 2, 0, (az + bz) / 2, len, w, '+y', Math.atan2(-dz, dx), 0.007);
    };
    drag(18.1, -14.62, 16.9, -15.25, 0.4, 0);
    drag(16.9, -15.25, 16.0, -16.3, 0.4, 1);
    drag(16.0, -16.3, 15.4, -16.85, 0.36, 2);
    // B: under the body (the navy body lies at B x 13.0 … 15.4, z −16.9, head east — dragged feet first, west)
    smear.decal('blood_smear', 3, 14.25, 0, -16.9, 2.3, 0.5, '+y', 0, 0.008);
    drag(19.6, -14.75, 21.2, -14.8, 0.22, 2);                                       // the trail they came by (east)
    drag(23.6, -14.85, 24.6, -14.9, 0.16, 0);
    const smearG = smear.build();
    smearG.name = 'v5_body_smear';
    smearG.userData.rooms = ['spine5'];
    L.root.add(smearG);
    const smearOn = (on: boolean) => { for (const c of smearG.children) c.visible = on; };
    smearOn(false);
    hookVignette(L, 'v5_body', () => smearOn(true), () => smearOn(true));

    // ── lights_out5, the spine half (by group names; the bay half is D3's — the greybox's if nobody registers it) ──
    const [ox, oz] = LIGHTS_OUT5.origin;
    const out = (groups: { off: string; emerg: string }, instant: boolean) => {
      const lm = ctx.render.lights;
      for (const h of lm.group(groups.off)) {
        if (instant) { h.enabled = false; h.intensityScale = 1; continue; }
        const delay = Math.hypot(h.position.x - ox, h.position.z - oz) * LIGHTS_OUT5.perMetre;
        // the tubes stutter once, then fade with the ballast
        L.tween(delay, LIGHTS_OUT5.dim, (k) => { h.intensityScale = (1 - k) * (k > 0.08 && k < 0.16 ? 0.25 : 1); }, () => { h.enabled = false; h.intensityScale = 1; });
      }
      const on = () => lm.setGroup(groups.emerg, { enabled: true });
      if (instant) on(); else L.after(LIGHTS_OUT5.dim + 0.15, on);
    };
    let spineOut = 0;
    const spineHalf = (instant: boolean) => {
      // (the strips follow the emergency groups — `emergStrips5`, one driver for the level)
      if (instant) { out({ off: 'spine5', emerg: 'spine5_emerg' }, true); du.lineGlow(1); spineOut = 2; return; }
      if (spineOut) return;
      spineOut = 1;
      L.sfx('lights_out_dock', 33, 2.8, -16, 1.0);
      out({ off: 'spine5', emerg: 'spine5_emerg' }, false);
      L.tween(LIGHTS_OUT5.dim + 0.1, 0.5, (k) => du.lineGlow(k), () => { spineOut = 2; });
    };
    // the bay's half only while nobody else owns lights_out5 (the greybox did both halves)
    const bayFallback = (instant: boolean) => out({ off: 'sub5', emerg: 'sub5_emerg' }, instant);
    const bayRun = () => { if (baseOf(L, 'lights_out5') === bayRun) bayFallback(false); };
    const baySnap = () => { if (baseOf(L, 'lights_out5') === bayRun) bayFallback(true); };
    if (!L.vignettes.has('lights_out5')) L.vignette('lights_out5', bayRun, { snap: baySnap });
    hookVignette(L, 'lights_out5', () => spineHalf(false), () => spineHalf(true));
  },
};

// ───────────────────────────────────────────────────────────── arm5 + the magazine

const arm: RoomDress = {
  label: false,
  look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    const ctx = L.ctx, fx = ctx.fx as FxSystemEx;
    const b = L.builder('arm5_dress');
    restyle(L, 'arm5_grey', isStandin, null);
    restyle(L, 'arm5_grey', (m) => m.name === 'grey_dark', null);

    // ── lights ──
    const ap = lightRow(L, { group: 'arm5', type: 'point', p: [18, 2.68, -23], color: WARM, i: 11, d: 11, bounds: ARM_B });
    const as = lightRow(L, { group: 'arm5', type: 'spot', p: [16.5, 3.0, -21.0], t: [14.6, 1.0, -22.5], color: 0xfff0d8, i: 8, d: 6, angle: 0.9, cast: true, prio: 0.7, min: 'medium', bounds: ARM_B });
    const mp = lightRow(L, { group: 'mag5', type: 'point', p: [17.0, -0.6, -24.5], color: 0xffd6a8, i: 15, d: 10, bounds: MAG_B });
    const al = L.glow(ap, 'emissive_warm', 0.75);
    b.bx('navy_grey', 17.34, 3.11, -23.12, 18.66, 3.2, -22.88);
    b.bx(al, 17.4, 3.09, -23.07, 18.6, 3.11, -22.93);
    const sl = L.glow(as, 'emissive_warm', 0.5);
    b.cyl('navy_grey', 16.5, 3.125, -21.0, 0.14, 0.15, 'y', 14);
    b.cyl(sl, 16.5, 3.04, -21.0, 0.1, 0.02, 'y', 14);

    // ── armoury: cage rack on the west wall (the shell's 0.25 m collider stays under it), issue desk, shelves ──
    b.at(14.2, 0, -21.71, PI / 2, () => cageRack(b, L, { slots: 23, filled: [6, 12, 17], collide: false, open: PI / 2 }));
    // (the pickup carbine `p5_arm_carbine` (14.45, 1.3, −20.6) stands in the north-most empty slot)
    b.bx('navy_grey', 14.45, 0.97, -22.75, 14.78, 1.0, -21.8);                                   // the magazine ledge
    for (const z of [-22.6, -21.95]) b.bx('steel_raw', 14.45, 0.86, z - 0.015, 14.75, 0.97, z + 0.015);
    b.at(14.2, 0, -24.45, PI / 2, () => openShelf(b, L, { w: 1.9, d: 0.5, h: 1.6, shelves: [0.4, 1.0], collide: false }));
    b.at(14.2, 0, -26.45, PI / 2, () => openShelf(b, L, { w: 1.7, d: 0.4, h: 1.9, shelves: [0.35, 0.95, 1.5], collide: false }));
    b.at(15.1, 0, -19.6, 0, () => issueDesk(b, L, { len: 1.8, d: 1.2, collide: false }));
    b.at(21.8, 1.4, -19.4, -PI / 2, () => wallShelf(b, L, { w: 0.7, d: 0.45 }));
    navySign(b, '소화기 — 함장 권한으로만 지급', 14.205, 2.35, -25.6, 2.6, 0.14, '+x');
    navySign(b, '방탄복', 21.795, 1.95, -19.4, 0.7, 0.11, '-x');
    // the magazine hatch (W7: dogged from below; its top plate lamp red → green) and its rail (west + south)
    const lidM = lidOf(L, b, { ...HATCH5_MAG, y: 0.008 });
    rail(b, L, { pts: [[20.175, -24.3], [20.175, -27.225], [21.8, -27.225]], h: 1.0, collide: false });
    b.detail(() => {
      b.decal('scratches', 1, 21.0, 0.012, -23.9, 1.0, 0.3, '+y');
      b.decal('grime', 2, 18.0, 0.006, -23.0, 3.0, 2.5, '+y');
    });

    // ── the crawl's turn under the armoury floor and the steps down (red strips) ──
    const red = (ax: number, az: number, bx2: number, bz: number, y = -1.4) => strip5(b, L, ax, az, bx2, bz, { y, ch: 'red', channel: 'navy_grey' });
    red(16.5, -18.05, 16.5, -19.95);
    red(17.5, -18.05, 17.5, -19.95);
    shipTreads(b, STAIR5_MAG_IN, 'navy_grey', false);
    nosings(b, L, STAIR5_MAG_IN, false);
    // B4 (IB5a's navy body): the dead hand on the stair — a sailor prone at the foot of the crawl stair, head north,
    // arms reaching for the first tread (the flashlight finds the hands coming down from the crawl). (`navyHand` on the
    // second tread was tried: on this closed stair its forearm floats over the tread below — the body alone reads.)
    b.at(17.0, -2.6, -22.6, PI, () => navyBody(b, L, { seed: 5211 }));
    red(16.5, -21.5, 17.5, -21.5, -2.6);
    shipTreads(b, STAIR5_MAG_OUT, 'navy_grey', true);
    nosings(b, L, STAIR5_MAG_OUT, true);
    // (the kit's handrail ran 1 m over the nosing line to the top tread: its top post and rail stood up through the shut
    // lid — the rail here stops at the 5th tread, under the coaming, and a grab bar under the coaming takes the hand on)
    stairDressing(b, L, { stair: STAIR5_MAG_OUT, nosing: null, rails: 'none', stringers: true });
    {
      const s = STAIR5_MAG_OUT, y0 = s.y0 ?? 0, xr = s.x0 + 0.05, zAt = (k: number) => s.z0 + s.dir * s.tread * (k + 0.5), top = (k: number) => y0 + s.rise * (k + 1);
      for (const k of [0, 4]) b.cyl('navy_grey', xr, top(k) + 0.5, zAt(k), 0.022, 1.0, 'y', 8);
      b.rod('navy_grey', xr, top(0) + 1.0, zAt(0), xr, top(4) + 1.0, zAt(4), 0.024, 8);
      b.rod('navy_grey', xr, top(0) + 0.5, zAt(0), xr, top(4) + 0.5, zAt(4), 0.016, 6);
      const xg = s.x0 - 0.12; // under the coaming's slab edge, not in the opening (west of the outline strip)
      b.rod('steel_raw', xg, -0.22, zAt(4) + 0.1, xg, -0.22, s.z0 + s.tread * 8.5, 0.018, 8);
      for (const z of [zAt(4) + 0.1, s.z0 + s.tread * 8.5]) b.bx('steel_raw', xg - 0.02, -0.22, z - 0.015, xg + 0.02, -0.1, z + 0.015);
    }
    red(20.5, -27.1, 21.5, -27.1, -2.6);

    // ── the magazine: racks with per-shelf colliders (the stand-in blocks' colliders go), issue ledges at the faces ──
    dropCollider(L, [14.4, -2.6, -27.4, 15.4, -0.6, -22.4]);
    dropCollider(L, [18.6, -2.6, -26.2, 19.6, -0.6, -22.4]);
    const decks = [0.08, 0.8, 1.45, 1.98];
    b.at(14.9, -2.6, -24.9, PI / 2, () => ammoTinRack(b, L, { len: 5.0, depth: 1.0, shelves: decks, fill: 0.8, seed: 51 }));
    b.at(19.1, -2.6, -24.3, -PI / 2, () => ammoTinRack(b, L, { len: 3.8, depth: 1.0, shelves: decks, fill: 0.55, seed: 52 }));
    // ledges under the pickups (`p5_mag_*` at x 15.5 / 18.5, y −1.8): pull-out issue trays, no collider
    for (const [x0, x1, z0, z1] of [[15.4, 15.76, -24.4, -22.6], [18.24, 18.6, -24.6, -22.6]] as const) {
      b.bx('steel_raw', x0, -1.83, z0, x1, -1.8, z1);
      const xl = x0 < 16 ? x1 - 0.015 : x0 + 0.015;
      b.bx('steel_raw', xl - 0.012, -1.8, z0, xl + 0.012, -1.76, z1);
      for (const z of [z0 + 0.1, z1 - 0.1]) b.bx('steel_raw', x0 < 16 ? x0 : x1 - 0.03, -1.98, z - 0.015, x0 < 16 ? x0 + 0.03 : x1, -1.83, z + 0.015);
    }
    // the plate bench on the south wall (`p5_mag_plate_*` at y −2.2)
    b.bx('steel_raw', 16.6, -2.24, -27.8, 18.0, -2.2, -27.15);
    for (const x of [16.65, 17.95]) b.bx('steel_raw', x - 0.03, -2.6, -27.75, x + 0.03, -2.24, -27.2);
    b.collide(16.6, -2.6, -27.8, 18.0, -2.2, -27.15, 'metal', true);
    navySign(b, '방탄복 — 플레이트', 17.3, -1.85, -27.795, 1.0, 0.1, '+z');
    // the tally board on the east rack's end (`note5_mag` (19.0, −1.4, −22.0))
    b.bx('navy_grey', 18.66, -1.75, -22.4, 19.54, -1.05, -22.37);
    b.bx(ctx.materials.get('painted_white'), 18.82, -1.62, -22.37, 19.18, -1.16, -22.355);
    b.detail(() => b.sign('탄약고 계수표', 'stencil', 19.0, -1.2, -22.353, 0.3, 0.05, '+z'));
    // the caged emergency lamp (the one that pops) over the aisle, the fire-party board, stencils
    b.push(17.0, -0.1, -24.5);
    const lamp: BulkheadLamp = bulkheadLamp(b, L, { mount: 'ceiling', breakable: true, bind: mp, color: 'warm', intensity: 1.4, floorY: -2.6, name: 'mag5_lamp' });
    b.pop();
    b.at(21.8, -1.35, -22.9, -PI / 2, () => fireBoard(b, L, { label: '화재반 — 탄약고' }));
    navySign(b, '탄약고 — 노화 금지 — 흡연 금지', 17.5, -0.55, -21.405, 2.6, 0.12, '-z');
    navySign(b, '탈출 ↑ 무기고 해치 — 아래에서 잠금 해제', 20.2, -1.15, -27.795, 2.2, 0.14, '+z');
    navySign(b, 'FR 112 — 빌지 통로 ↑', 17.0, -0.45, -21.405, 1.1, 0.1, '-z');
    // a red bar along the hatch coaming's underside (strip channel `red`, on from load, survives the pop): the way out
    // reads from the magazine floor without a lamp
    b.bx(stripMat5(L, 'red'), 20.45, -0.15, -27.09, 21.55, -0.125, -27.06);
    b.bx('navy_grey', 20.42, -0.125, -27.11, 21.58, -0.1, -27.04);
    // (IB5b B6: and along both long sides of the opening — the hatch's outline reads from the floor before the pop)
    for (const [x0, x1] of [[20.33, 20.36], [21.64, 21.67]] as const) {
      b.bx(stripMat5(L, 'red'), x0, -0.15, -26.95, x1, -0.125, -24.45);
      b.bx('navy_grey', x0 - 0.02, -0.125, -26.97, x1 + 0.02, -0.1, -24.43);
    }
    // the flooded corner (3 cm of water in front of the exit stair) + drips (§2.9 fx5_drips_mag)
    const wet: Box6 = [18.7, -2.6, -27.75, 20.35, -2.59, -26.3];
    fx.wetPatch(box3(wet), ['arm5'], { id: 'wet5_mag' });
    addWet(L, wet);
    const magBox = box3([14.2, -2.6, -27.8, 21.8, -0.1, -21.4]);
    for (const x of [15.0, 20.0]) fx.emitter('drip', V(x, -0.2, -26), V(0, -1, 0), 0.5, { bounds: magBox, rooms: ['arm5'], id: 'fx5_drips_mag' });
    b.detail(() => {
      b.decal('water_stain', 0, 21.795, -1.4, -26.0, 1.4, 1.8, '-x');
      b.decal('water_stain', 2, 14.205, -1.0, -21.9, 0.6, 1.2, '+x');
      b.decal('oil_stain', 1, 17.0, -2.594, -24.2, 1.6, 1.2, '+y');
    });

    // ── vignettes ──
    L.vignette('hatch5_mag_open', () => swingLid(L, lidM, V(21.0, -0.2, -25.6), () => lidM.userData.lamp('green')), {
      snap: () => { const u = lidM.userData; u.dogs(1); u.open(1); u.lamp('green'); },
    });
    L.vignette('v5_magazine', () => {
      const l = lamp;
      if (l.dead) return;
      const t = l.pop();
      L.after(t.out, () => { L.sfx('bulb_pop', l.point.x, l.point.y, l.point.z, 1.0); fx.bulbPop?.(l.point); });
      L.after(t.tinkle, () => L.sfx('glass_tinkle', l.point.x, -2.5, l.point.z, 0.8));
      L.after(t.dur, () => ctx.render.lights.setGroup('mag5', { enabled: false }));
    }, { snap: () => { lamp.snap(true); ctx.render.lights.setGroup('mag5', { enabled: false }); } });
  },
};

export const SPINE_DRESS: Partial<Record<RoomId5, RoomDress>> = { spine5: spine, arm5: arm };
