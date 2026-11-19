/**
 * LEVEL 6 — dressing + lights of vault6 (the cable vault: drums, the beach-joint enclosure, the sea-cable penetrator,
 * dehumidifiers, nitrogen), the cable trench T-a / T-b with the reward, and hold6 (the cable store); vignettes
 * `v6_drum`, `v6_ring`, `v6_thud`, `bj6_open`, `bj6_strain`, `bj6_rip`, the two hatch lids' `*_open`, and the `ping6`
 * machine (stage 3d §2.6.7, §2.7, §4.6, §5.7, §8.12; task D2). he6 and the trench's end T-c are `headend.ts`.
 *
 * Contract: `RoomDress` (l6/index.ts, tunnels.ts header). Stand-ins: every `grey_standin` visual of the vault / hold
 * shells is dropped and a kit prop (W8) drawn over the shell's collider with `collide: false` (one collider per object);
 * the greybox pit rails are repainted safety yellow; the trench gratings become W5's `deck_grate` (see-through bar
 * grating: the red strips below read from the vault floor). Containment, doors, triggers, screens, interactables and
 * markers stay the shell's.
 *
 * Lights (§2.7.1): `vault6` = 2 spots (down the drum row, onto the enclosure) + 1 point, all qualities (§2.7.2 (e): the
 * spots are lit on LOW and cast only on MEDIUM+ — the shadow request is switched here per frame by quality and by the
 * vault being drawn, since a light's `minQuality` would also drop the light); `trench6` = 2 red points bounded to the
 * trench boxes; `bj6_glow` = the loom's green spill (1 point, MEDIUM+, on from `bj6_open`, dies in `bj6_rip`);
 * `hold6` = 1 point.
 *
 * Vignettes (sounds played here exactly once, D25; every one has a silent `:snap`):
 *  - `v6_drum` — CD2 (kit `cableDrum` with the ratchet) turns by itself 3 rad over 4.6 s, the slack pays out loop by
 *    loop toward the trench; `ratchet_run` + `drum_rumble` at 0 (W2b: "together, 4.6 s"), `drum_brake` + a small shake at
 *    the brake. Snap: drum stopped, the 6 m of slack on the floor.
 *  - `v6_ring` — `ping_close` at the hull transducer, `hull_ring`, `dust_sift` from the cable trays (fx `dustSift` over
 *    both tray runs), a 0.06 shake, the vault's lights shiver. Silences the `ping6` ping that falls within 1.2 s of it.
 *  - `v6_thud` — `far_lock_flood` 8 m under the player (thud at 0, the water from 1.2 s), shake 0.25, `lights_dip` at
 *    0.15 s with the he6 / vault6 / trench lights dipping to 35 % and back over 0.7 s.
 *  - `bj6_open` — (the story has turned Key A: `castell_turn`, `bj6.unlock`) the leaves part (`bj_doors`, 0 … 1.2 s),
 *    the green spill rises with them. Snap: unlocked, open, green on.
 *  - `bj6_strain` (toggle) — the story drives `bj6.strain(k)` and plays `fibre_strain`; from this call until the rip the
 *    green spill flickers while the strain is ≥ 0.7. Snap: the follower stops.
 *  - `bj6_rip` — `bj6.rip()`: `fibre_rip` on its `tear` cue, the green light fades with the cascade (0.1 … 0.9 s), the
 *    head-end desk screens go to `TRUNK FIBRE — LOS`, Key B is taken from its barrel at 1.1 s. Snap: the same end state
 *    (incl. the leaves open — a restore past the pull never needs `bj6_open:snap` first).
 *  - `hatch6_vault_open` — the lid's dog wheel spins free (0 … 0.4 s, `hatch_unlatch`), the lid swings up (0.3 … 1.5 s).
 *
 * Machine `ping6` (§3, §8.12, W2b): 'idle' = a ping every 20 s, 'active' / 'frenzy' = every 4 s (the first one 4.4 s after
 * the switch, so the story's `v6_ring` at pull + 4.0 s carries it), 'off' = none. Starts 'idle' at load. In pool6 /
 * shaft6 it is `ping_near` at the well; anywhere else `ping_far` at the hull transducer under the vault (−8, −2.6, −166).
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { FxSystemEx } from '../../fx';
import type { Builder, Mat } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { isStandin, paper, restyle } from '../l3/kit3';
import { mat4 } from '../l4/kit4';
import { hose } from '../kit';
import { LIGHTS6, STAIR6_T, STOPPER_VAULT6, box3, placeLights6, type LightRow6, type RoomId6 } from './grey';
import type { RoomDress } from './index';
import { jointerBody } from './tunnels';
import {
  HATCH6_VAULT, cableDrum, cableTrays, crate6, dehumidifier, hatchLid6, nitrogenRack, slackCoil, spareCoil,
  stencil6, storeBox, strip6, tmat6, trunkRun, wallShelf6, type CableDrum, type SlackCoil,
} from './kit6';

const PI = Math.PI;
export type Box6 = [number, number, number, number, number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
export const fxOf = (L: LevelBuild) => L.ctx.fx as FxSystemEx;

// ───────────────────────────────────────────────────────────── shared helpers (he6 uses them too)

/**
 * Drop render items of a (shell) builder whose transform origin lies within `tol` of one of `pts` — a single greybox
 * visual (a disc, a bracket, a room label's plate and text) that shares its material batch with things that must stay.
 * Colliders are untouched. Must run inside the room's build pass (the builder is not merged yet).
 */
export function dropNear(L: LevelBuild, builder: string, pts: readonly (readonly [number, number, number])[], tol = 0.03): number {
  const b = L.namedBuilder(builder) as unknown as { batches: Map<string, { items: { m: THREE.Matrix4 }[] }> };
  let n = 0;
  for (const bt of b.batches.values()) {
    for (let i = bt.items.length - 1; i >= 0; i--) {
      const e = bt.items[i].m.elements;
      if (pts.some((p) => Math.hypot(e[12] - p[0], e[13] - p[1], e[14] - p[2]) < tol)) { bt.items.splice(i, 1); n++; }
    }
  }
  return n;
}
/** A room label of the shell (`roomLabel`: plate + text centred on the wall at `p`, facing along `n`). */
export function dropLabel(L: LevelBuild, builder: string, p: readonly [number, number, number], n: readonly [number, number, number]) {
  const at = (o: number): [number, number, number] => [p[0] + n[0] * o, p[1] + n[1] * o, p[2] + n[2] * o];
  return dropNear(L, builder, [at(0.006), at(0.014)], 0.004);
}
export const isGreyDark = (m: THREE.Material) => m.name === 'grey_dark';
export const isMat = (x: THREE.Material) => (m: THREE.Material) => m === x;

/** A vignette's own clock: `at(g, delay, fn)` runs unless the vignette was snapped / restarted since (level 5 pattern). */
export function cues(L: LevelBuild) {
  let gen = 0;
  return {
    start() { return ++gen; },
    cancel() { gen++; },
    alive(g: number) { return g === gen; },
    at(g: number, delay: number, fn: () => void) { L.after(delay, () => { if (g === gen) fn(); }); },
  };
}

/**
 * W8's `hatchLid6` lid made safe for the trench (W4a's measured trap): the shut lid is a WALKABLE box (the kit's box is
 * not — a body on it was shoved off sideways), and a stopper box over the exit stair's upper treads, enabled only
 * while shut, meets a crouched climber front-on before his head meets the lid (grey.ts `hatchLid`, `STOPPER_*6`).
 */
export function fixLid(L: LevelBuild, id: string, stopper: Box6) {
  const o = L.objects.get(id);
  if (!o || o.userData.placeholder) return;
  const u = o.userData as { k: number; open: (k: number) => void; box: { walkable?: boolean }; stopper?: unknown };
  const sb = L.ctx.physics.addBox(box3(stopper), 'metal');
  sb.owner = o;
  const open0 = u.open;
  const sync = () => { const shut = u.k < 0.5; u.box.walkable = shut; sb.enabled = shut; };
  u.open = (k: number) => { open0(k); sync(); };
  u.stopper = sb;
  sync();
}
/** The trench hatch vignette: dogs spin free (`hatch_unlatch`), the lid swings up on its south hinge. */
export function hatchVignette(L: LevelBuild, id: string, sound: [number, number, number]) {
  const obj = () => L.objects.get(id)?.userData as { open?: (k: number) => void; dogs?: (k: number) => void; lamp?: (s: string) => void; k?: number } | undefined;
  const c = cues(L);
  const end = () => { const u = obj(); u?.dogs?.(1); u?.open?.(1); u?.lamp?.('green'); };
  L.vignette(`${id}_open`, () => {
    const u = obj();
    if (!u?.open || (u.k ?? 0) > 0) return;
    const g = c.start();
    L.sfx('hatch_unlatch', ...sound);
    L.tween(0, 0.4, (k) => { if (c.alive(g)) u.dogs?.(smooth(k)); });
    c.at(g, 0.35, () => u.lamp?.('green'));
    L.tween(0.3, 1.2, (k) => { if (c.alive(g)) u.open!(smooth(k)); }, () => { if (c.alive(g)) u.open!(1); });
  }, { snap: () => { c.cancel(); end(); } });
}

/** Visual ship stair over a greybox `StairDef` (grating treads, flat-bar stringers, nosing strips); colliders stay the shell's. */
export function shipStair(b: Builder, L: LevelBuild, s: { x0: number; x1: number; z0: number; dir: number; risers: number; rise: number; tread: number; y0?: number }) {
  const y0 = s.y0 ?? 0, G: Mat = 'deck_grate', S: Mat = 'steel_raw';
  for (let k = 0; k < s.risers; k++) {
    const za = s.z0 + s.dir * s.tread * k, zb = s.z0 + s.dir * s.tread * (k + 1), top = y0 + s.rise * (k + 1);
    if (k === s.risers - 1 && Math.abs(top) < 1e-3) continue; // the top "tread" is the floor itself
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    // (the grating stops where the nosing bar starts: no shared faces)
    b.bx(G, s.x0 + 0.06, top - 0.035, s.dir > 0 ? z0 + 0.01 : z0 + 0.058, s.x1 - 0.06, top - 0.004, s.dir > 0 ? z1 - 0.058 : z1 - 0.01);
    // nosing bar + amber nosing strip (hard-wired, §2.7.3)
    const zn = s.dir > 0 ? z1 - 0.01 : z0 + 0.01;
    b.bx(S, s.x0 + 0.06, top - 0.045, Math.min(zn, zn - s.dir * 0.04), s.x1 - 0.06, top - 0.002, Math.max(zn, zn - s.dir * 0.04));
    strip6(b, L, s.x0 + 0.12, zn - s.dir * 0.02, s.x1 - 0.12, zn - s.dir * 0.02, { y: top - 0.002, ch: 'amber', channel: S });
  }
  // stringers (flat bar along the slope) on both sides
  const run = s.tread * s.risers, h = s.rise * s.risers, len = Math.hypot(run, h), ang = Math.atan2(h, run);
  const zc = s.z0 + s.dir * run / 2;
  for (const x of [s.x0 + 0.03, s.x1 - 0.03]) b.rbox(S, x, y0 + h / 2 - 0.08, zc, 0.012, 0.16, len, s.dir > 0 ? -ang : ang, 0, 0);
}

/** Small red caged trench lamp, its lens bound to `h` (wall prop authored at the wall face, facing local +z). */
function trenchLamp(b: Builder, glow: Mat) {
  b.bx('navy_grey', -0.09, -0.06, 0, 0.09, 0.06, 0.05);
  b.bx(glow, -0.065, -0.04, 0.05, 0.065, 0.04, 0.075);
  b.detail(() => { for (const x of [-0.05, 0, 0.05]) b.bx('steel_raw', x - 0.004, -0.05, 0.078, x + 0.004, 0.05, 0.086); });
}

/** Concrete lining of a trench box face (10 mm in front of the grid face, so the vault / head-end wall looks stop above). */
function lining(b: Builder, m: Mat, face: '+x' | '-x' | '+z' | '-z' | '+y' | '-y', at: number, u0: number, u1: number, v0: number, v1: number) {
  const o = 0.01, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, du = u1 - u0, dv = v1 - v0;
  if (face === '+x' || face === '-x') b.quad(m, at + (face === '+x' ? o : -o), cv, cu, du, dv, face, 0, 'box');
  else if (face === '+z' || face === '-z') b.quad(m, cu, cv, at + (face === '+z' ? o : -o), du, dv, face, 0, 'box');
  else b.quad(m, cu, at + (face === '+y' ? o : -o), cv, du, dv, face, 0, 'box');
}
export { lining as trenchLining };

/** Cable brackets (steel L-arms) along a trench wall: `axis` the run direction, `w` the wall coordinate, `n` its normal sign. */
export function brackets(b: Builder, axis: 'x' | 'z', a0: number, a1: number, w: number, n: 1 | -1, ys: number[], every = 1.2) {
  for (let a = a0; a <= a1 + 1e-6; a += every) for (const y of ys) {
    if (axis === 'z') { b.bx('steel_raw', Math.min(w, w + n * 0.16), y - 0.025, a - 0.02, Math.max(w, w + n * 0.16), y - 0.012, a + 0.02); b.bx('steel_raw', Math.min(w, w + n * 0.012), y - 0.1, a - 0.02, Math.max(w, w + n * 0.012), y + 0.03, a + 0.02); }
    else { b.bx('steel_raw', a - 0.02, y - 0.025, Math.min(w, w + n * 0.16), a + 0.02, y - 0.012, Math.max(w, w + n * 0.16)); b.bx('steel_raw', a - 0.02, y - 0.1, Math.min(w, w + n * 0.012), a + 0.02, y + 0.03, Math.max(w, w + n * 0.012)); }
  }
}

// ───────────────────────────────────────────────────────────── vault6

/** Hull transducer under the vault (the ping's source before the chamber) and the well (in the chamber). */
const TRANSDUCER: [number, number, number] = [-8.0, -2.6, -166.0];
const WELL: [number, number, number] = [-52.0, -21.0, -176.0];

const TRENCH_B: Box6 = [-13.1, -1.5, -179.5, 3.7, -0.04, -158.0];

/** Shared state between the vault's vignettes and the ping machine (one level at a time). */
const PING = new WeakMap<LevelBuild, { clock: number; ringAt: number }>();
const pingState = (L: LevelBuild) => { let s = PING.get(L); if (!s) PING.set(L, (s = { clock: 0, ringAt: -1e9 })); return s; };

function vaultFloor(L: LevelBuild) {
  return mat4(L, 'd2_vault_epoxy', () => { const m = L.ctx.materials.clone('floor_epoxy', { color: 0xa9afb2, roughness: 0.32 }); m.name = 'd2_vault_epoxy'; return m; });
}

function pingMachine(L: LevelBuild) {
  const st = pingState(L);
  let mode: MachineState = 'idle', next = 7.0;
  const rate = () => (mode === 'idle' ? 20 : 4);
  L.machines.set('ping6', (s) => {
    if (s === mode) return;
    const was = mode;
    mode = s;
    if (s === 'off') return;
    // speeding up: the first fast ping 4.4 s after the switch (the story's v6_ring at pull + 4.0 carries the first one)
    if (s !== 'idle' && was === 'idle') next = st.clock + 4.4;
    else if (s === 'idle') next = st.clock + 20;
    else if (was === 'off') next = st.clock + 4.4;
  });
  L.updaters.push((dt) => {
    st.clock += dt;
    if (mode === 'off' || st.clock < next) return;
    next = st.clock + rate();
    if (Math.abs(st.clock - st.ringAt) < 1.2) return; // v6_ring played this one
    const p = L.ctx.player?.position;
    const r = p ? L.ctx.level?.roomAt(p) : null;
    const inPool = !!r && (r.id === 'pool6' || r.id === 'shaft6');
    if (inPool) L.sfx('ping_near', ...WELL, 1.0);
    else L.sfx('ping_far', ...TRANSDUCER, 1.0);
  });
}

/** The trench T-a / T-b (vault6's floors at y −1.4): lining, water film, red strips, lamps, brackets, cables, drips. */
function trenchVault(L: LevelBuild, b: Builder, red: [LightHandle, LightHandle]) {
  const C: Mat = 'floor_concrete', Y = -1.4, top = -0.05;
  // lining (floor, walls) — the grid faces carry the vault's look
  lining(b, C, '+y', Y, -13.0, -11.8, -179.4, -159.95);
  lining(b, C, '+y', Y, -11.8, 1.8, -179.4, -178.2);
  lining(b, C, '+x', -13.0, -179.4, -158.0, Y, top);
  lining(b, C, '-x', -11.8, -178.2, -158.0, Y, top);
  lining(b, C, '+z', -179.4, -13.0, 1.8, Y, top);
  lining(b, C, '-z', -178.2, -11.8, 1.8, Y, top);
  // 3 cm water film: glossy patches (the shared puddle overlay)
  const wet = L.puddleMat();
  for (const [x0, x1, z0, z1] of [[-12.95, -11.85, -172.4, -169.2], [-12.9, -11.9, -166.5, -165.1], [-12.95, -11.85, -179.35, -177.6], [-9.2, -6.6, -179.3, -178.3], [-3.0, -1.1, -179.3, -178.4]]) {
    b.quad(wet, (x0 + x1) / 2, Y + 0.012, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box');
  }
  // red LED strips at both floor edges (hard-wired, on from load: the trench reads by them alone, §2.7.3)
  const sy = Y + 0.011;
  strip6(b, L, -12.9, -179.3, -12.9, -160.05, { y: sy, ch: 'red' });
  strip6(b, L, -11.9, -178.3, -11.9, -160.05, { y: sy, ch: 'red' });
  strip6(b, L, -12.8, -179.3, 1.8, -179.3, { y: sy, ch: 'red' });
  strip6(b, L, -11.8, -178.3, 1.8, -178.3, { y: sy, ch: 'red' });
  // the two red trench lamps (on the T-a east wall, on the T-b north wall), lenses bound to their points
  const g0 = L.glow(red[0], 'emissive_red', 0.9), g1 = L.glow(red[1], 'emissive_red', 0.9);
  b.at(-11.8, -0.32, -170.0, -PI / 2, () => trenchLamp(b, g0));
  b.at(-4.0, -0.32, -178.2, PI, () => trenchLamp(b, g1));
  // brackets: T-a west wall (a spare cable), T-b south wall (the sea cable), T-b north wall (the trunk to the head-end)
  brackets(b, 'z', -178.0, -161.0, -13.0, 1, [-1.0]);
  brackets(b, 'x', -12.4, 1.4, -179.4, 1, [-1.05]);
  brackets(b, 'x', -11.2, 1.4, -178.2, -1, [-0.72]);
  // the sea cable: out of the penetrator's gland, down into T-b, west along its south wall, up into the beach joint
  hose(b, tmat6(L, 'cable_armour'), [
    [-8.0, 1.0, -179.35], [-8.0, 0.75, -179.05], [-8.05, 0.2, -178.95], [-8.15, -0.4, -179.05], [-8.35, -0.92, -179.2],
    [-9.2, -0.98, -179.25], [-11.0, -0.98, -179.26], [-12.35, -0.96, -179.26], [-12.75, -0.7, -179.3], [-12.85, -0.2, -179.36], [-12.9, 0.2, -179.5],
  ], 0.075, 12, 6);
  // the trunk (the fibre side): out of the beach joint, east along T-b's north wall to the head-end (headend.ts takes it on)
  trunkRun(b, L, { pts: [[-12.3, -0.06, -178.9], [-11.6, -0.6, -178.4], [-10.6, -0.67, -178.32], [1.79, -0.67, -178.32]], r: 0.05, cleats: null });
  // a spare earthing cable along T-a's west wall
  hose(b, 'rubber', [[-12.86, -0.97, -160.6], [-12.86, -0.97, -170.0], [-12.86, -0.97, -177.8], [-12.6, -0.98, -179.2], [-11.6, -1.02, -179.28]], 0.028, 6, 4);
  // drips through the gratings (fx6_drips_trench, 3 in the trench)
  const fx = fxOf(L), db = box3(TRENCH_B);
  for (const [x, z] of [[-12.2, -168.3], [-12.6, -171.4], [-7.2, -178.7]]) fx.emitter('drip', V(x, -0.08, z), V(0, -1, 0), 0.45, { bounds: db, rooms: ['vault6'], id: 'fx6_drips_trench' });
}

/** The reward at the T-a / T-b corner (§2.6.7): M. Lie (lying), his kit bag, a tool tray, his notebook on a cable bracket. */
function reward(L: LevelBuild, b: Builder) {
  const Y = -1.4;
  // M. Lie lying face down along T-a, head to the corner (south), feet toward the hatch (D1's `jointerBody`)
  b.at(-12.4, Y + 0.011, -177.35, 0, () => jointerBody(b, L, { pose: 'lying', seed: 6202 }));
  // a LOW walkable collider over him (walked over crouched). IA-6: at 0.15 m its edge met the capsule's lower sphere at
  // exactly the slide/ground limit (push-out y 0.5): a crouched player stopped dead at z −176.1 and T-b, the T-b pickups
  // and the trench exit under he6 were unreachable (check:reach T … U_pull; a real crouch-walk probe). 0.08 m rides over.
  b.collide(-12.78, Y, -178.45, -12.02, Y + 0.08, -176.4, 'flesh', false);
  // his kit bag under the plates (visual: the pickups lie on it, 0.15 above the floor)
  const bag = tmat6(L, 'coverall_orange');
  b.rbox('painted_dark', -12.4, Y + 0.08, -175.9, 0.5, 0.14, 0.95, 0, 0.04, 0);
  b.detail(() => { b.rbox(bag, -12.4, Y + 0.163, -175.9, 0.4, 0.006, 0.85, 0, 0.04, 0); b.rod('rubber', -12.58, Y + 0.18, -176.25, -12.58, Y + 0.18, -175.55, 0.015, 5); });
  // the tool tray in T-b under the ammo and the medkit
  b.bx('painted_dark', -10.3, Y + 0.011, -179.08, -8.3, Y + 0.14, -178.52);
  b.detail(() => {
    b.bx('steel_raw', -10.28, Y + 0.14, -179.06, -8.32, Y + 0.148, -178.54);
    b.rbox('painted_yellow', -9.0, Y + 0.17, -179.0, 0.22, 0.04, 0.08, 0, 0.3, 0); // a fusion splicer case's lid
  });
  // his notebook on a cable bracket (−12.85, −0.9, −176.4) facing +x — note6_jointer (§6.3)
  b.bx('steel_raw', -12.99, -1.0, -176.55, -12.83, -0.985, -176.25);
  b.bx('steel_raw', -12.99, -1.1, -176.55, -12.975, -0.985, -176.25);
  b.rbox(paper(L, 0xe8e0c8), -12.88, -0.9, -176.4, 0.02, 0.19, 0.14, 0, 0, -0.18);
  b.rbox('painted_dark', -12.893, -0.9, -176.4, 0.004, 0.195, 0.145, 0, 0, -0.18);
  stencil6(b, 'M. 리에 — 할시온 서브시', -12.99 + 0.002, -0.72, -176.4, 0.3, 0.045, '+x', { style: 'label' });
}

const vault6: RoomDress = {
  look: { floor: 'floor_epoxy', wall: 'wall_panel', ceiling: 'ceiling_panel' },
  lights: [],
  build(L) {
    const ctx = L.ctx;
    // ── greybox visuals out (colliders stay): drums / DH / NR stand-ins, the stair, shelves, the penetrator disc, the
    //    notebook bracket, the room label; the pit rails repainted; the gratings become bar grating ──
    restyle(L, 'grey6:vault6_cover', isStandin, null);
    restyle(L, 'vault6_grey', isStandin, null);
    dropNear(L, 'vault6_grey', [[-8.0, 1.0, -179.7], [-12.945, -0.975, -176.4]], 0.02);
    dropLabel(L, 'vault6_grey', [1.8, 3.0, -160.0], [-1, 0, 0]);
    restyle(L, 'vault6_grey', isGreyDark, ctx.materials.get('painted_yellow'));
    restyle(L, 'vault6_grey', isMat(L.doubleSided('floor_grate')), ctx.materials.get('deck_grate'));
    // (the look's floor: a mid-grey gloss epoxy — the library's is near white)
    (vault6.look as { floor: Mat }).floor = vaultFloor(L);
    // (each grille's mesh shrunk 6 mm a side about its own centre: its sides sat on the opening's faces — z-fight)
    for (const id of ['grille6_1', 'grille6_2', 'grille6_3', 'vent6_vault_grille']) {
      L.objects.get(id)?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = ctx.materials.get('deck_grate');
        m.geometry = m.geometry.clone();
        m.geometry.computeBoundingBox();
        const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3()), sz = m.geometry.boundingBox!.getSize(new THREE.Vector3());
        m.geometry.translate(-c.x, -c.y, -c.z).scale((sz.x - 0.012) / sz.x, 1, (sz.z - 0.012) / sz.z).translate(c.x, c.y, c.z);
      });
    }
    const b = L.builder('vault6_dress');

    // ── lights (§2.7.1): rows of LIGHTS6.vault6, the spots lit at every quality (cast switched below) ──
    // (intensities ×4 over the greybox rows: the 6 m deckhead and the dark drums swallowed the placeholder values)
    const rows: LightRow6[] = LIGHTS6.vault6.map((r) => (r.type === 'spot' ? { ...r, min: undefined, cast: false, i: r.i * 4.2, d: r.d + 6 } : r.group === 'vault6' ? { ...r, i: 55, d: 22 } : { ...r }));
    rows.push({ group: 'bj6_glow', type: 'point', p: [-12.0, 1.45, -178.75], color: 0x3dff6a, i: 2.2, d: 5.5, min: 'medium', off: true, bounds: [-17.0, -0.02, -179.81, -7.0, 3.0, -172.0] });
    const hs = placeLights6(L, rows);
    const spots = hs.filter((h) => h.desc.type === 'spot'), point = hs.find((h) => h.desc.group === 'vault6' && h.desc.type === 'point')!;
    const red = hs.filter((h) => h.desc.group === 'trench6') as [LightHandle, LightHandle];
    const green = hs.find((h) => h.desc.group === 'bj6_glow')!;
    L.updaters.push(() => { const cast = ctx.render.quality !== 'low' && L.isVisible('vault6'); for (const h of spots) h.desc.castShadow = cast; });
    // fittings: two spot heads aimed at their targets, a high-bay dome on the point and four more domes bound to it
    for (const h of spots) {
      const g = L.glow(h, 'emissive_white', 0.8), p = h.position, d = h.target.clone().sub(p).normalize();
      b.rod('steel_raw', p.x, 6.0, p.z, p.x, p.y + 0.12, p.z, 0.015, 5);
      b.rod('navy_grey', p.x - d.x * 0.12, p.y - d.y * 0.12, p.z - d.z * 0.12, p.x + d.x * 0.2, p.y + d.y * 0.2, p.z + d.z * 0.2, 0.17, 14);
      b.rod(g, p.x + d.x * 0.2, p.y + d.y * 0.2, p.z + d.z * 0.2, p.x + d.x * 0.215, p.y + d.y * 0.215, p.z + d.z * 0.215, 0.145, 14);
    }
    const dome = L.glow(point, 'emissive_white', 0.7);
    for (const [x, z] of [[-6.0, -164.0], [-16.0, -170.5], [-3.5, -174.0], [-3.5, -155.0], [-10.0, -156.0]]) {
      b.rod('steel_raw', x, 6.0, z, x, 5.55, z, 0.012, 5);
      b.cyl('navy_grey', x, 5.5, z, 0.32, 0.12, 'y', 18, 0.12);
      b.cyl(dome, x, 5.43, z, 0.26, 0.02, 'y', 18);
    }

    // ── cable drums CD1 / CD3 (plain, navy) and CD2 (the one that turns: ratchet, pawl, brake) ──
    for (const z of [-157.0, -151.0]) {
      b.at(-18.5, 0, z, 0, () => cableDrum(b, L, { mount: 'stand', plain: true, collide: false, tail: false }));
    }
    let drum: CableDrum = null as unknown as CableDrum;
    b.at(-18.5, 0, -163.0, 0, () => { drum = cableDrum(b, L, { mount: 'stand', ratchet: true, collide: false, name: 'cd2_drum6' }); });
    stencil6(b, 'CD 2 — 예비 해저 케이블 96F', -16.49, 0.6, -163.6, 0.9, 0.08, '+x', { style: 'stencil' });
    // the brake post stands 0.22 m proud of the shell's drum collider: its own collider
    b.collide(-16.44, 0, -162.09, -16.36, 2.8, -161.87, 'metal', true);
    let slack: SlackCoil = null as unknown as SlackCoil;
    b.at(-15.7, 0.004, -163.45, -0.3, () => { slack = slackCoil(b, L, { len: 6.0, seed: 7, name: 'v6_drum_slack' }); });
    stencil6(b, 'BRAKE ON — CD 2 — JOB 6-114 (RØD)', -16.32, 1.95, -161.86, 0.5, 0.06, '+z', { style: 'label' });

    // ── the beach joint enclosure (W7's bj6): its laser and hull plates; the green spill is `bj6_glow` ──
    stencil6(b, '레이저 방사선 — 클래스 1M\n파이버 단면을 들여다보지 마세요', -9.0, 2.15, -179.79, 0.62, 0.16, '+z', { style: 'warning' });

    // ── the sea-cable penetrator (−8.0, 1.0, −179.8): flange Ø 1.2, bolts, the gland, the bellmouth; the dark port ──
    b.cyl('navy_grey', -8.0, 1.0, -179.76, 0.6, 0.08, 'z', 32);
    b.detail(() => { for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2; b.cyl('steel_raw', -8.0 + Math.cos(a) * 0.52, 1.0 + Math.sin(a) * 0.52, -179.71, 0.025, 0.03, 'z', 6); } });
    b.cyl('steel_raw', -8.0, 1.0, -179.57, 0.3, 0.3, 'z', 24);
    b.cyl('navy_grey', -8.0, 1.0, -179.4, 0.2, 0.06, 'z', 20, 0.1);
    b.detail(() => { for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2 + 0.2; b.cyl('steel_raw', -8.0 + Math.cos(a) * 0.26, 1.0 + Math.sin(a) * 0.26, -179.41, 0.02, 0.02, 'z', 6); } });
    stencil6(b, '선체 관통구 HP-2\n해저 케이블 — 건드리지 마세요', -8.0, 1.85, -179.79, 0.7, 0.14, '+z', { style: 'stencil' });
    b.cyl('steel_raw', -7.2, 1.0, -179.74, 0.17, 0.12, 'z', 20);
    b.cyl('navy_grey', -7.2, 1.0, -179.675, 0.15, 0.012, 'z', 20, 0.13);
    b.cyl('screen_off', -7.2, 1.0, -179.69, 0.125, 0.012, 'z', 20);
    {
      // one slow fleck of marine snow drifting past in the black (an emissive card just in front of the dark lens)
      const fm = mat4(L, 'd2_fleck', () => { const m = ctx.materials.clone('emissive_cyan'); m.emissiveIntensity = 0.35; m.color.set(0x0c1416); return m; });
      const fleck = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), fm);
      fleck.name = 'd2_port_fleck';
      fleck.userData.rooms = ['vault6'];
      fleck.position.set(-7.2, 1.0, -179.682);
      L.root.add(fleck);
      L.ambient('vault6', (_dt, t) => {
        const u = (t * 0.018) % 1;          // ~55 s to cross the port top to bottom
        const y = 0.1 - 0.2 * u, x = 0.06 * Math.sin(t * 0.21) - 0.02;
        const r = Math.hypot(x, y);
        fleck.visible = r < 0.11;
        fleck.position.set(-7.2 + x, 1.0 + y, -179.682);
      });
    }

    // ── dehumidifiers DH1 / DH2 (north wall), nitrogen rack NR, the east shelf ──
    b.at(-5.0, 0, -148.2, PI, () => dehumidifier(b, L, { collide: false, label: 'DH 1 — 건조제 — 문 닫아 둘 것' }));
    b.at(-1.0, 0, -148.2, PI, () => dehumidifier(b, L, { collide: false, label: 'DH 2 — 건조제 — 문 닫아 둘 것' }));
    stencil6(b, 'CABLE VAULT — RH < 30 % — KEEP DRY', -3.0, 4.3, -148.21, 1.8, 0.14, '-z', { style: 'stencil' });
    b.at(-3.0, 0, -151.4, 0, () => nitrogenRack(b, L, { collide: false }));
    b.at(1.8, 0, -150.8, -PI / 2, () => wallShelf6(b, L, { w: 2.4, d: 0.4, collide: false, seed: 31 }));
    b.collide(1.4, 0, -152.0, 1.8, 0.97, -149.6, 'metal', true);

    // ── cable trays high on the west and south walls (the dust of `v6_ring` sifts from them) ──
    b.at(-21.8, 0, -164.0, PI / 2, () => cableTrays(b, L, { len: 30.4, tiers: [4.7], fill: [6], seed: 61 }));
    b.at(-6.0, 0, -179.8, 0, () => cableTrays(b, L, { len: 14.0, tiers: [4.5], fill: [5], seed: 62, skip: [[-6.8, -5.2]] }));

    // ── the trench: gratings' frames, the grille curbs, then T-a / T-b and the reward ──
    {
      const S: Mat = 'steel_raw', y0 = 0.002, y1 = 0.01, w = 0.035;
      // the L outline of the strip on the vault floor (T-a x −13 … −11.8 north to the pit; T-b to the head-end wall)
      const run = (x0: number, z0: number, x1: number, z1: number) => b.bx(S, x0, y0, z0, x1, y1, z1);
      // (the corner under the enclosure and its floor guide gets no frame: x −13.2 … −10.8, z −179.8 … −178.45)
      run(-13.0 - w, -178.45, -13.0, -160.4);
      run(-11.8, -178.2 + w, -11.8 + w, -160.4);
      run(-11.8 + w, -178.2, 1.8, -178.2 + w);
      run(-10.75, -179.4 - w, 1.8, -179.4);
      for (const [x, z] of [[-12.4, -174.0], [-12.4, -164.0], [-6.0, -178.8]]) {
        const h = 0.4, c = 0.03;
        b.bx(S, x - h - c, y0, z - h - c, x + h + c, y1, z - h).bx(S, x - h - c, y0, z + h, x + h + c, y1, z + h + c);
        b.bx(S, x - h - c, y0, z - h, x - h, y1, z + h).bx(S, x + h, y0, z - h, x + h + c, y1, z + h);
      }
    }
    trenchVault(L, b, red);
    reward(L, b);
    shipStair(b, L, STAIR6_T);
    stencil6(b, '트렌치 해치 — 위에서 열림 — 양방향', -12.4, 1.15, -160.43, 0.9, 0.08, '+z', { style: 'stencil' });
    // the hatch lid (kit, two-way, wheel on top) + the stopper over the exit stair (W4a's trap)
    hatchLid6(L, b, HATCH6_VAULT);
    // (the kit curb's north bar sits on the pit's end wall face at z −158: dropped, the floor edge needs none)
    dropNear(L, 'vault6_dress', [[-12.4, -0.0475, -157.97]], 0.01);
    fixLid(L, 'hatch6_vault', STOPPER_VAULT6);
    hatchVignette(L, 'hatch6_vault', [-12.4, 0.2, -159.2]);

    // ── dust in the lamp cones (fx6_vault_dust): a thin haze with slow motes ──
    fxOf(L).fog({
      id: 'fx6_vault_dust', box: box3([-21.0, 0, -179.0, 1.0, 6.0, -149.0]), color: 0xaab8c6, density: 0.035, height: 6.0, drift: [0.03, 0.012],
      glints: { count: 160, box: box3([-20.0, 0.4, -178.0, 0.0, 5.6, -150.0]) }, rooms: ['vault6'], seenFrom: ['he6', 'hold6', 'shaft6'], lowHalf: true,
    });

    // ═══ vignettes ═══
    const pst = pingState(L);
    // v6_drum — CD2 turns by itself, pays out slack, brakes with a bang and rocks still
    {
      const dc = cues(L);
      const pawl = V(-16.44, 2.5, -161.95), axis = drum.axis.clone(), post = V(-16.36, 1.7, -161.9);
      L.vignette('v6_drum', () => {
        const g = dc.start();
        const t = drum.run();
        L.sfx('ratchet_run', pawl.x, pawl.y, pawl.z, 1.0);
        L.sfx('drum_rumble', axis.x, axis.y, axis.z, 1.0);
        L.tween(0, t.dur, () => { if (dc.alive(g)) slack.set(drum.angle / 3.0); });
        dc.at(g, t.brake, () => { L.sfx('drum_brake', post.x, post.y, post.z, 1.0); L.ctx.player?.shake(0.12); });
      }, { snap: () => { dc.cancel(); drum.snap(); slack.set(1); } });
    }
    // v6_ring — the first fast ping after the pull: the vault rings like a bell, dust sifts from the trays
    {
      const rc = cues(L);
      const vaultLights = [...hs.filter((h) => h.desc.group === 'vault6')];
      L.vignette('v6_ring', () => {
        const g = rc.start();
        pst.ringAt = pst.clock;
        L.sfx('ping_close', ...TRANSDUCER, 1.0);
        rc.at(g, 0.08, () => L.sfx('hull_ring', -10.0, 3.0, -164.0, 1.0));
        rc.at(g, 0.1, () => L.ctx.player?.shake(0.06));
        rc.at(g, 0.35, () => {
          L.sfx('dust_sift', -20.0, 4.6, -164.0, 0.9);
          const fx = fxOf(L);
          fx.dustSift(box3([-21.6, 0, -176.0, -21.0, 4.6, -152.0]), { amount: 1.0 });
          fx.dustSift(box3([-12.0, 0, -179.7, 1.0, 4.4, -179.2]), { amount: 0.7 });
        });
        L.tween(0.05, 1.4, (k) => { if (!rc.alive(g)) return; const s = 1 - 0.18 * Math.sin(k * PI * 9) * (1 - k); for (const h of vaultLights) h.intensityScale = s; }, () => { for (const h of vaultLights) h.intensityScale = 1; });
      }, { snap: () => { rc.cancel(); for (const h of vaultLights) h.intensityScale = 1; } });
    }
    // v6_thud — Post 4's launch lock flooding, felt through the structure; the lights dip once
    {
      const tc = cues(L);
      const dipGroups = ['he6', 'vault6', 'trench6'];
      const set = (s: number) => { for (const gname of dipGroups) for (const h of ctx.render.lights.group(gname)) h.intensityScale = s; };
      L.vignette('v6_thud', () => {
        const g = tc.start();
        const p = ctx.player?.position ?? V(-8, 0, -166);
        L.sfx('far_lock_flood', p.x, p.y - 8.0, p.z, 1.0);
        ctx.player?.shake(0.25);
        tc.at(g, 0.15, () => {
          const q = ctx.player?.position ?? p;
          L.sfx('lights_dip', q.x, q.y + 3.0, q.z, 1.0);
          L.tween(0, 0.7, (k) => { if (tc.alive(g)) set(k < 0.25 ? 1 - 0.65 * (k / 0.25) : 0.35 + 0.65 * smooth((k - 0.25) / 0.75)); }, () => set(1));
        });
      }, { snap: () => { tc.cancel(); set(1); } });
    }
    // the beach joint: open (Key A), strain (follows the grip), rip (Key B)
    {
      type BJ = { open(k: number): void; unlock(k: number): void; strain(k: number): void; rip(cue?: (n: string, at: THREE.Vector3) => void): void; ripped(): void; takeKeyB(): void; k: { ripped: boolean } };
      const bj = () => L.objects.get('bj6')?.userData as BJ | undefined;
      const oc = cues(L), rc = cues(L);
      let glowK = 0;
      const glow = (k: number) => { glowK = k; green.enabled = k > 0.001; green.intensityScale = k; };
      // (the story turns Key A itself — `castell_turn` and `bj6.unlock` are its; the doors and the green are the level's)
      L.vignette('bj6_open', () => {
        const u = bj();
        if (!u) return;
        const g = oc.start();
        u.unlock(1);
        L.sfx('bj_doors', -12.0, 1.1, -178.5, 1.0);
        L.tween(0, 1.2, (k) => { if (!oc.alive(g)) return; u.open(k); glow(smooth(k)); }, () => { if (oc.alive(g)) { u.open(1); glow(1); } });
      }, { snap: () => { oc.cancel(); const u = bj(); u?.unlock(1); u?.open(1); if (!u?.k?.ripped) glow(1); } });
      // strain: the story drives `bj6.strain(k)` and plays `fibre_strain`; the level's part is the green spill flickering
      // once the strain passes 0.7 (read off the set piece), from the first bj6_strain call until the rip
      let following = false;
      L.updaters.push(() => {
        if (!following) return;
        const u = bj() as unknown as { k?: { strain?: number } } | undefined;
        const k = u?.k?.strain ?? ctx.player?.gripProgress ?? 0;
        green.setFlicker(k >= 0.7 ? 'fluorescent' : 'none');
      });
      L.vignette('bj6_strain', () => { following = true; }, { toggle: true, snap: () => { following = false; } });
      const losScreens = () => { for (const n of ['he6_desk_1', 'he6_desk_2', 'he6_desk_3']) { const s = L.screens.get(n); if (s) ctx.materials.setScreen(s, 'terminal_alert', { text: '트렁크 파이버 — 신호 손실\n백업 링크 — 음향 부이 — 활성' }); } };
      L.vignette('bj6_rip', () => {
        const u = bj();
        if (!u) return;
        following = false;
        oc.cancel();
        u.unlock(1); u.open(1);
        const g = rc.start();
        green.setFlicker('none');
        u.rip((name, at) => {
          if (!rc.alive(g)) return;
          if (name === 'tear') L.sfx('fibre_rip', at.x, at.y, at.z, 1.0);
        });
        const from = glowK;
        L.tween(0.1, 0.8, (k) => { if (rc.alive(g)) glow(from * (1 - smooth(k))); }, () => { if (rc.alive(g)) glow(0); });
        rc.at(g, 0.6, losScreens);
        rc.at(g, 1.1, () => u.takeKeyB());
      }, { snap: () => { rc.cancel(); following = false; const u = bj(); if (u) { u.unlock(1); u.open(1); u.ripped(); u.takeKeyB(); } green.setFlicker('none'); glow(0); losScreens(); } });
    }
    pingMachine(L);
  },
};

// ───────────────────────────────────────────────────────────── hold6 (the cable store: F4 / F5 come out of it)

const hold6: RoomDress = {
  look: { floor: 'floor_concrete', wall: 'wall_panel_dark', ceiling: 'ceiling_panel' },
  lights: [],
  build(L) {
    dropLabel(L, 'hold6_grey', [-8.2, 2.6, -144.0], [-1, 0, 0]);
    const b = L.builder('hold6_dress');
    const [lamp] = placeLights6(L, LIGHTS6.hold6.map((r) => ({ ...r, i: 6, flicker: 'fluorescent' as const })));
    const lens = L.glow(lamp, 'emissive_warm', 0.9);
    // one caged bulkhead lamp hanging from the deckhead (y 4.0)
    b.rod('steel_raw', -15.0, 4.0, -144.0, -15.0, 3.72, -144.0, 0.012, 5);
    b.cyl('navy_grey', -15.0, 3.68, -144.0, 0.16, 0.08, 'y', 14);
    b.sphere(lens, -15.0, 3.6, -144.0, 0.11, 12, 0.7);
    b.detail(() => { for (let k = 0; k < 4; k++) { const a = (k / 4) * PI; b.rod('steel_raw', -15.0 - Math.cos(a) * 0.13, 3.64, -144.0 - Math.sin(a) * 0.13, -15.0 + Math.cos(a) * 0.13, 3.64, -144.0 + Math.sin(a) * 0.13, 0.006, 4); } });
    // (the spawn markers (−16, −143), (−19, −144), (−13, −144) and their walk to d6_hold (−14, −148) stay clear)
    // north wall: a spare drum on its cradle, coils, a stores chest
    b.at(-10.2, 0, -141.0, 0, () => cableDrum(b, L, { mount: 'cradle', name: 'hold6_drum' }));
    b.at(-20.6, 0, -141.1, 0, () => spareCoil(b, L, { r: 0.6, turns: 5 }));
    b.at(-9.3, 0, -146.7, 0, () => spareCoil(b, L, { r: 0.55, turns: 7 }));
    // west wall: a racking shelf of joint kits; crates in the south-west corner
    b.at(-21.8, 0, -144.6, PI / 2, () => wallShelf6(b, L, { w: 2.4, d: 0.45, seed: 41 }));
    b.at(-20.6, 0, -147.0, 0, () => crate6(b, L, { w: 1.4, d: 1.1, h: 1.2, label: '할시온 서브시 — 조인트 키트 96F' }));
    b.at(-17.6, 0, -140.65, PI, () => storeBox(b, L, { w: 1.0, d: 0.7, h: 0.8, label: '케이블 저장고 — 공구' }));
    stencil6(b, '케이블 저장고 — 예비품 — 트렁크 1', -15.0, 2.6, -140.21, 1.6, 0.14, '-z', { style: 'stencil' });
    stencil6(b, '노화 금지', -8.21, 1.8, -142.0, 0.5, 0.08, '-x', { style: 'warning' });
    // a torn-open joint-kit carton on the floor and a spilled reel of tape (no colliders)
    b.detail(() => {
      b.rbox('painted_dark', -12.0, 0.15, -141.0, 0.6, 0.3, 0.4, 0, 0.4, 0);
      b.rbox(paper(L, 0xc8b48a), -12.0, 0.305, -141.0, 0.6, 0.01, 0.4, 0, 0.4, 0);
      b.cyl('rubber', -11.2, 0.03, -142.2, 0.07, 0.05, 'y', 12);
    });
  },
};

export const VAULT_DRESS: Partial<Record<RoomId6, RoomDress>> = { vault6, hold6 };
