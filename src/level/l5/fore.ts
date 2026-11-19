/**
 * POST 4 — the gate lock, the gatehouse, the duty room, the ready room (stage 3c §2.6, §2.7, §4.1, §5.5; task D1).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const FORE_DRESS: Partial<Record<RoomId5, RoomDress>>
 * for the rooms lock5, gate5, duty5, ready5. Per room: `build(L)` (runs after the room's shell, culled with the room),
 * `lights` (replaces `LIGHTS5[room]`; keep the §2.7.1 group names), `look` (shell face materials), `label: false`.
 *
 * The shell already made (do NOT re-create; restyle / hide the stand-in visuals — material `grey_standin` — and keep
 * exactly one collider per object):
 *  - lock5: the sealed `door5_tube` (z 6, panel `door5_tube_panel`), screen `gate_panel5` (lock face (−2.3, 1.6, 0.22)
 *    and a second face on the gatehouse side, one material), marker `mk5_start`. The gate `d5_gate` is a `wide` door
 *    (3.0 × 2.8, rises 2.4 s) that plays its own `gate_open_heavy` / `gate_close_heavy` (DoorSpec.sounds).
 *  - gate5: the guard booth stand-ins (kerb x 2.4 … 2.6 with the west ledge x 2.25 … 2.6 at y 1.0, south face,
 *    roof solid 2.6 … 3.4, inner counter x 4.4 … 5.6), the booth glass (x 2.485 … 2.515, y 1.0 … 2.4, `mk5_glass`
 *    pane `booth`), screens `aas_palm` (4.6, 1.1, −2.0) −x, `gate_log` 0.56 × 0.36 (4.38, 1.35, −1.1) −x and `onpost` (−4.0, 2.6,
 *    −0.22) −z; the turnstile line (tripods x −3.0 … −2.1 / −2.0 … −1.1 h 1.0, fences x 1.2 … 2.4 / −5.8 … −3.0 h 1.2,
 *    z −5.15 … −4.85), the clearing barrel (−5.2, −8.6), a shelf under `p5_gate_med`; interactable `note5_visitors`;
 *    markers `mk5_gate_panel`, `mk5_aas_palm`, `mk5_onpost`. The booth's back door is yours (a prop into solid).
 *  - duty5: watch desk x −3.0 … 0.0, z −16 … −15 (h 1.0), cabinets x 4.4 … 5.6, z −21.8 … −21.2 (h 1.3; cover
 *    `cv5_d2` stands east of them); screens `dock_status` (west wall), `key5_panel` (7.78, 1.35, −13.9) −x;
 *    interactables `note5_watch`, `note5_roster`, `key5_duty` (R8 eye gate x < 7.8); markers `mk5_keypad`,
 *    `mk5_c1_cam0/cam1/sol/door/end`; a shelf under `p5_duty_ammo`. The duty camera is yours.
 *  - ready5: locker rows L1 / L2 (h 2.0), crates C1 C2 C3 (h 1.2), the kit rack (h 2.2) — every one a cover object
 *    (§5.4 `cv5_r*`); interactables `note5_locker`, `radio5` (disabled; the story moves it to the corpse point);
 *    markers `mk5_locker_slam`, `mk5_helmet_rest`, `mk5_c1_out`, `mk5_duty_u1/u2`, `mk5_s1`; shelves under
 *    `p5_ready_med` / `p5_ready_ammo`. The ready-room camera (−10.0, 3.0, −22.25) −z with a red tally and the benches
 *    (h 0.45, walkable) are yours.
 * Vignettes this task defines (each with its `:snap`: `L.vignette(id, run, { snap })`; a greybox placeholder exists
 * until it does): `gate5_open`, `gate5_booth`, `v5_turnstile`, `v5_hull_groan`, `key5_power`. Their sounds are yours
 * (§8.11); the gate's two are the door's own, never the vignette's.
 * Puddles: add each wet patch's box with `addWet(L, box)` (grey.ts) — the same box you give `fx.wetPatch` — so
 * `level.regions.wet` (audio's `wet` footsteps) matches what is drawn.
 *
 * ── As built (D1) ──
 *  Every stand-in visual of the four rooms is hidden (`restyle(… isStandin, null)`) and replaced by a kit5 prop built
 *  with `collide: false` over the shell's collider (one collider per object; the watch desk's 1.25 m log rail is the
 *  only collider added, on top of the shell's 1.0 m desk box — the desk is honest cover to the helmet). Cover objects
 *  stand exactly on the shell's boxes: lockers 2.0, crates 1.2, kit rack 2.2, cabinets 1.3, desk 1.0 (+ rail 1.25).
 *  - Lights are placed here (each room's `lights: []`, rows through `placeLights5` inside `build`) so the luminaire
 *    lenses can be bound to their lamp (`bindEmissive`): a lens goes dark with its light. Groups as §2.7.1 (`lock5`,
 *    `gate5`, `duty5`, `ready5`) plus one red emergency point per room, OFF, in `<room>_emerg` (hard-wired emergency
 *    fittings with a red lens, bound): never switched by the level; they exist so a mains failure in these rooms
 *    (`FORE5_EMERG`) still leaves them followable without the flashlight (frames: lit / emergency / flashlight).
 *  - The booth (region `booth`, never entered): its own shell round the greybox pane (which stays as the glass;
 *    the pane's collider stays), a fascia to the ceiling over the roof, an inner counter of its own (shorter than the
 *    stand-in, z −2.7 … −0.35, so W7's back door at z −3.6 … −2.8 swings clear), Aas's palm on a pedestal behind the
 *    `aas_palm` screen, a monitor bezel round the shell's `gate_log` screen, a mug, the phone, a logbook, a stool, a
 *    running desk fan (silent: `fan_loop` belongs to `v5_galley_shape`), a booth luminaire (point `gate5`, medium+).
 *  - The ready room's scare locker is L2's west-face door at z −31.74 (kit pitch; the marker stays at −31.5), ajar
 *    0.3 rad, its neighbours movable for the rattle; Brekke's locker is L1's east-face door 7 at z −29.25 (name card +
 *    the taped note on its face 0.25 m from the `note5_locker` point).
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { FxSystemEx } from '../../fx/index';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { restyle, isStandin, paint, paper as paperMat } from '../l3/kit3';
import { deckLine, dialFaceMat, mat4 } from '../l4/kit4';
import {
  bench5, boardFrame, clearingBarrel, deskFan, drapeGeo, equipmentGate, fence, filingCabinets, firstAidCabinet, gearCrate,
  helmetRow, kitRack, lampLens5, lockerBank, looseHelmet, navySign, noticeBoard, serviceRun, turnstile, vesselRoom, wallCamera,
  wallShelf, watchDesk, type DeskFan, type LockerDoor, type LooseHelmet, type Turnstile,
} from './kit5';
import { boothBackDoor, gateLook } from './setpieces';
import { addWet, placeLights5, type LightRow5, type RoomId5 } from './grey';
import type { RoomDress } from './index';

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type Box6 = [number, number, number, number, number, number];

/** Warm-white 4000 K fluorescent (§2.6), the desk lamp, the emergency red. */
const WARM = 0xffe4c4, LAMP = 0xfff0d8, RED = 0xff2a18;

// ───────────────────────────────────────────────────────────── shared pieces

/** Emissive lens of a room's luminaires (own material per key: bound to that room's lamps). */
function lens(L: LevelBuild, key: string, color: number, albedo: number): THREE.MeshStandardMaterial {
  return mat4(L, `d1_lens_${key}`, () => {
    const m = L.ctx.materials.clone('plastic_white', { color: albedo, roughness: 0.3, map: null, normalMap: null, roughnessMap: null, aoMap: null });
    m.emissive = new THREE.Color(color);
    m.emissiveIntensity = 0.35;
    m.name = `d1_lens_${key}`;
    return m;
  });
}

/**
 * Surface-mount fluorescent batten on the ceiling at (x, ceil, z), long axis `along`: a white steel body with a prismatic
 * diffuser (the room's lens). The body's top sits 2 mm under the ceiling (no coplanar faces).
 */
function batten(b: Builder, x: number, ceil: number, z: number, along: 'x' | 'z', len: number, glass: Mat) {
  const w = 0.22, y1 = ceil - 0.002, y0 = ceil - 0.075;
  b.push(x, 0, z, along === 'x' ? 0 : PI / 2);
  b.bx('painted_white', -len / 2, y0, -w / 2, len / 2, y1, w / 2);
  b.detail(() => {
    b.bx(glass, -len / 2 + 0.04, y0 - 0.012, -w / 2 + 0.03, len / 2 - 0.04, y0, w / 2 - 0.03);
    for (const s of [-1, 1]) b.bx('painted_white', s * (len / 2 - 0.02) - 0.02, y0 - 0.016, -w / 2 + 0.01, s * (len / 2 - 0.02) + 0.02, y0, w / 2 - 0.01);
  });
  b.pop();
}

/** Hard-wired emergency fitting (wall prop on the face, front +z): a white box with a red lens (own material, bound). */
function emergFitting(b: Builder, glass: Mat) {
  b.bx('painted_white', -0.17, -0.06, 0, 0.17, 0.06, 0.09);
  b.detail(() => {
    b.bx(glass, -0.14, -0.04, 0.09, 0.14, 0.04, 0.1);
    b.bx('painted_dark', 0.12, -0.055, 0.09, 0.15, -0.045, 0.098); // test button
  });
}

/** A red emergency lens (own per room, dark until its light is on). */
function emergLens(L: LevelBuild, key: string) {
  return mat4(L, `d1_emerg_${key}`, () => {
    const m = L.ctx.materials.clone('plastic_white', { color: 0x7a2a24, roughness: 0.3, map: null, normalMap: null, roughnessMap: null, aoMap: null });
    m.emissive = new THREE.Color(RED);
    m.emissiveIntensity = 0;
    m.name = `d1_emerg_${key}`;
    return m;
  });
}

/** Overhead cable tray along x or z at height y (two side rails, a floor, a few cables). */
function cableTray(b: Builder, a: number, c: number, at: number, y: number, along: 'x' | 'z') {
  b.push(along === 'x' ? (a + c) / 2 : at, y, along === 'x' ? at : (a + c) / 2, along === 'x' ? 0 : PI / 2);
  const len = Math.abs(c - a);
  b.detail(() => {
    b.bx('navy_grey', -len / 2, 0, -0.17, len / 2, 0.015, 0.17);
    for (const s of [-1, 1]) b.bx('navy_grey', -len / 2, 0.015, s * 0.17 - 0.006, len / 2, 0.08, s * 0.17 + 0.006);
    for (let k = 0; k < 4; k++) b.cyl('rubber', 0, 0.035, -0.11 + k * 0.07, 0.022, len, 'x', 6);
  });
  b.pop();
}

/** A simple swivel / stool seat (floor prop, origin = floor centre): star base, column, seat; `back` adds a backrest (−z). */
function chair(b: Builder, o: { seat?: number; back?: boolean } = {}) {
  const sh = o.seat ?? 0.48;
  b.detail(() => {
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 2 * PI; b.rod('painted_dark', 0, 0.06, 0, Math.cos(a) * 0.28, 0.035, Math.sin(a) * 0.28, 0.016, 5); }
    b.cyl('painted_dark', 0, (sh - 0.05) / 2 + 0.05, 0, 0.025, sh - 0.05, 'y', 8);
  });
  b.cyl('rubber', 0, sh, 0, 0.23, 0.07, 'y', 14);
  if (o.back) {
    b.rbox('rubber', 0, sh + 0.32, -0.22, 0.4, 0.4, 0.06, -0.12, 0, 0);
    b.detail(() => b.rod('painted_dark', 0, sh, -0.15, 0, sh + 0.15, -0.21, 0.015, 5));
  }
}

/** A clipboard / card lying on a surface (top at y), facing up, `rot` about y. */
function paper(b: Builder, x: number, y: number, z: number, w: number, d: number, rot = 0) {
  b.detail(() => {
    b.push(x, y, z, rot);
    b.bx('painted_dark', -w / 2, 0, -d / 2, w / 2, 0.006, d / 2);
    b.bx('painted_white', -w / 2 + 0.012, 0.006, -d / 2 + 0.03, w / 2 - 0.012, 0.009, d / 2 - 0.012);
    b.bx('steel_raw', -0.05, 0.006, -d / 2 + 0.005, 0.05, 0.016, -d / 2 + 0.035);
    b.pop();
  });
}

/** A mug (navy enamel) standing at (x, y, z). */
function mug(b: Builder, x: number, y: number, z: number, rot = 0) {
  b.detail(() => {
    b.cyl('navy_grey', x, y + 0.05, z, 0.042, 0.1, 'y', 12);
    b.cyl('painted_dark', x, y + 0.097, z, 0.036, 0.004, 'y', 12); // coffee
    b.torus('navy_grey', x + Math.cos(rot) * 0.05, y + 0.05, z - Math.sin(rot) * 0.05, 0.026, 0.007, rot === 0 ? 'z' : 'x', 8);
  });
}

/** Hide every stand-in visual of a room's greybox zone (the shell keeps its colliders). */
function hideStandins(L: LevelBuild, room: RoomId5, alsoNamed: string[] = []) {
  restyle(L, `${room}_grey`, (m) => isStandin(m) || alsoNamed.includes(m.name), null);
}

/** Room lights placed here so the lenses can follow them. */
function lights(L: LevelBuild, rows: LightRow5[]): LightHandle[] { return placeLights5(L, rows); }

const emergRow = (group: string, x: number, y: number, z: number, i = 3.2, d = 10): LightRow5 => ({ group, type: 'point', p: [x, y, z], color: RED, i, d, off: true });

/**
 * The emergency groups of the four rooms (off; never switched by the level). A test or a later beat can run a room
 * on emergency light with `setGroup(room, { enabled: false })` + `setGroup(FORE5_EMERG[room], { enabled: true })`.
 */
export const FORE5_EMERG: Record<'lock5' | 'gate5' | 'duty5' | 'ready5', string> = { lock5: 'lock5_emerg', gate5: 'gate5_emerg', duty5: 'duty5_emerg', ready5: 'ready5_emerg' };

// ═════════════════════════════════════════════════════════════ LOCK5 (x −3 … 3, z 0 … 6, h 3.6)

function buildLock(L: LevelBuild) {
  const b = L.builder('lock5_d1');
  const N: Mat = 'navy_grey', H = 3.6;
  const glass = lens(L, 'lock5', WARM, 0xf0ece4), eglass = emergLens(L, 'lock5');

  // pressure-vessel frames on both side walls, steel benches between them (walkable 0.46), clear of the spawn (0, 3)
  // the hull's frames (B1): legs at z 1.0 / 5.0 (the benches stand between them), the middle beam on headers
  vesselRoom(b, L, { x0: -2.8, x1: 2.8, z0: 0.2, z1: 5.8, h: H, axis: 'z', at: [1.0, 3.0, 5.0], clear: [['x0', 1.5, 4.5], ['x1', 0.45, 4.5]], stiff: 0 });
  for (const s of [-1, 1]) {
    const xw = s * 2.8;
    const xi = xw - s * 0.42, x0 = Math.min(xw, xi), x1 = Math.max(xw, xi), z0 = 1.6, z1 = 4.4;
    for (let k = 0; k < 4; k++) {
      const za = z0 + 0.02 + k * ((z1 - z0) / 4), zb = za + (z1 - z0) / 4 - 0.04;
      b.bx('steel_raw', x0 + 0.02, 0.42, za, x1 - 0.02, 0.46, zb);
    }
    for (const z of [z0 + 0.1, (z0 + z1) / 2, z1 - 0.1]) {
      b.bx(N, x0 + 0.04, 0, z - 0.03, x0 + 0.08, 0.42, z + 0.03).bx(N, x1 - 0.08, 0, z - 0.03, x1 - 0.04, 0.42, z + 0.03);
      b.bx(N, x0 + 0.04, 0.38, z - 0.03, x1 - 0.04, 0.42, z + 0.03);
    }
    b.collide(x0, 0, z0, x1, 0.46, z1, 'metal', true);
  }

  // gauge board on the east wall by the gate: Δp across the gate (tube / Post 4)
  const xe = 2.8;
  b.bx(N, xe - 0.03, 1.35, 0.55, xe, 1.95, 1.65);
  const dial = dialFaceMat(L);
  b.detail(() => {
    for (const [z, t] of [[0.85, '튜브'], [1.35, '초소 4']] as const) {
      b.cyl('steel_raw', xe - 0.05, 1.7, z, 0.12, 0.04, 'x', 16);
      b.quad(dial, xe - 0.072, 1.7, z, 0.2, 0.2, '-x', 0, 'unit', 0.001);
      b.sign(t, 'navy', xe - 0.034, 1.47, z, 0.3, 0.07, '-x');
      b.cyl('steel_raw', xe - 0.04, 0.68, z, 0.012, 1.36, 'y', 6);
    }
    b.sign('Δp — BAR', 'navy', xe - 0.034, 1.88, 1.1, 0.5, 0.07, '-x');
  });

  // palm reader + the panel housing under / round `gate_panel5` (0.5 × 0.3 at (−2.3, 1.6, 0.22) +z; the wall face is z 0.2)
  b.bx('painted_dark', -2.6, 1.4, 0.2, -2.0, 1.8, 0.212);
  b.bx('painted_dark', -2.43, 1.0, 0.2, -2.17, 1.3, 0.225);
  b.detail(() => {
    b.quad(mat4(L, 'd1_palm_glass', () => L.ctx.materials.clone('screen_off', {})), -2.3, 1.15, 0.227, 0.2, 0.24, '+z', 0, 'unit', 0.001);
    b.sign('손바닥', 'label', -2.3, 1.035, 0.226, 0.12, 0.035, '+z');
    b.rod('painted_dark', -2.3, 1.8, 0.21, -2.3, 3.5, 0.21, 0.018, 6); // conduit to the ceiling
  });

  // stencils, the hold-back line, the lintel label of the sealed tube door (label: false drops the shell's signs)
  navySign(b, '초소 4 — 압력 게이트 — 해군 전용', 0, 3.27, 0.205, 2.6, 0.12, '+z');   // (IA-5: 3.4 → 3.27 — at 3.4 the HUD's location caption "초소 4 — 게이트 록" lay over it in the start view)
  navySign(b, '초소 4 — 게이트 록', 2.795, 2.35, 3.0, 0.95, 0.1, '-x');
  navySign(b, 'FR 4-001', -2.795, 2.35, 3.0, 0.5, 0.1, '+x');
  b.detail(() => b.sign('이송 튜브', 'label', 0, 2.555, 5.68, 1.4, 0.13, '-z'));
  deckLine(b, L, -1.9, 1.15, 1.9, 1.15, { w: 0.1 });
  b.detail(() => b.sign('게이트 앞에 서지 마세요', 'navy', 0, 0.003, 1.45, 1.4, 0.14, '+y'));

  // cable tray along the ceiling (nothing on the wall over the gate: the rising leaf's pocket, check:doors rule c)
  cableTray(b, 0.3, 5.7, 1.8, H - 0.3, 'z');

  // the luminaire over the middle, the emergency fitting over the gate
  batten(b, 0, H - 0.072, 2.0, 'x', 1.5, glass);
  b.at(2.25, 2.9, 0.2, 0, () => emergFitting(b, eglass));

  // a puddle where the tube's condensation runs down the north-east corner (wet steel; footsteps go wet)
  const wet: Box6 = [1.2, 0, 4.1, 2.6, 0.02, 5.6];
  (L.ctx.fx as FxSystemEx).wetPatch(new THREE.Box3(V(wet[0], wet[1], wet[2]), V(wet[3], wet[4], wet[5])), ['lock5'], { id: 'fx5_wet_lock', seenFrom: ['gate5', 'duty5'] });
  addWet(L, wet);
  b.decal('water_stain', 1, 2.795, 2.2, 5.2, 0.7, 1.6, '-x');

  // the gate's dog ring (3b `gate4`'s look), retracted: the gate was already opened by Aas's palm (§4.1)
  gateLook(L, 'd5_gate');
  L.afterDoors.push(() => (L.objects.get('d5_gate_dogs')?.userData.set as ((k: number) => void) | undefined)?.(1));

  const hs = lights(L, [
    { group: 'lock5', type: 'spot', p: [0, 3.3, 4.2], t: [0, 0.9, 0.4], color: WARM, i: 14, d: 7.5, angle: 1.05, cast: true, min: 'medium' },
    { group: 'lock5', type: 'point', p: [0, 3.2, 2.0], color: WARM, i: 9, d: 8.5 },
    emergRow('lock5_emerg', 2.25, 2.8, 0.6, 6, 10),
  ]);
  hs[1].bindEmissive(glass, 0.6);
  hs[2].bindEmissive(eglass, 1.2);
}

// ═════════════════════════════════════════════════════════════ GATE5 (x −6 … 6, z −10 … 0, h 3.4)

interface GateParts { left: Turnstile; right: Turnstile; fan: DeskFan }

function buildGate(L: LevelBuild): GateParts {
  hideStandins(L, 'gate5', ['grey_dark']);
  const b = L.builder('gate5_d1');
  const N: Mat = 'navy_grey', K: Mat = 'painted_dark', H = 3.4;
  const glass = lens(L, 'gate5', WARM, 0xf0ece4), eglass = emergLens(L, 'gate5');

  // ── the guard booth (x 2.4 … 5.8, z −4.0 … −0.2), its own shell round the shell's pane (x 2.485 … 2.515, y 1.0 … 2.4:
  // the greybox `glass` block stays as the booth glass, look and collider): kerb 1.0 with a cap and an outside ledge,
  // three mullions, a header to 2.6, the south wall, the roof slab, a fascia to the ceiling. (Kit `guardBooth` was
  // tried: its glass reads as no glass from the gatehouse and its speaking grille floats behind the pane.)
  b.bx(N, 2.4, 0, -4.0, 2.6, 1.0, -0.2);
  b.bx(N, 2.2, 1.0, -4.0, 2.6, 1.04, -0.2);
  b.detail(() => b.bx('steel_raw', 2.21, 0.97, -4.0, 2.23, 1.0, -0.2)); // ledge lip
  for (const z of [-3.96, -2.7, -1.46, -0.24]) b.bx(N, 2.4, 1.04, z - 0.045, 2.6, 2.4, z + 0.045);
  b.bx(N, 2.4, 2.4, -4.0, 2.6, 2.6, -0.2);
  b.bx(N, 2.6, 0, -4.0, 5.8, 2.6, -3.85);
  b.bx(N, 2.35, 2.6, -4.05, 5.8, 2.72, -0.2);
  navySign(b, '게이트 4 — 보초', 2.395, 2.5, -2.1, 1.4, 0.16, '-x');
  // deal tray through the cap under the north pane (the visitors' clipboard lies under the middle one)
  b.bx('steel_raw', 2.18, 1.04, -1.05, 2.62, 1.052, -0.65);
  b.bx(N, 2.6, 0.98, -1.05, 2.75, 1.04, -0.65);
  b.bx(N, 2.36, 2.725, -4.03, 5.79, H - 0.01, -0.21);
  b.detail(() => b.bx('steel_raw', 2.345, 2.73, -4.03, 2.36, 2.79, -0.21)); // drip edge
  // the inner counter (its own, z −2.7 … −0.35: W7's back door at z −3.6 … −2.8 swings clear of it)
  const top = 0.95;
  b.bx(N, 4.44, 0.1, -2.7, 5.78, top - 0.03, -0.35);
  b.bx(K, 4.5, 0, -2.66, 5.78, 0.1, -0.39); // kick recess
  b.bx(K, 4.42, top - 0.03, -2.72, 5.785, top, -0.33);
  // Aas's palm plate: a pedestal behind the `aas_palm` screen (0.22 × 0.28 at (4.6, 1.1, −2.0), facing −x)
  b.bx(N, 4.61, top, -2.14, 4.84, 1.27, -1.86);
  b.detail(() => b.bx(K, 4.605, 1.245, -2.13, 4.61, 1.265, -1.87));
  // the monitor round the shell's `gate_log` screen (0.56 × 0.36 at (4.38, 1.35, −1.1), facing −x; IA5): a 3 cm bezel
  // (y 1.14 … 1.56, z −1.41 … −0.79), its back box, a short neck to the foot on the counter
  b.bx(K, 4.386, 1.14, -1.41, 4.46, 1.56, -0.79);
  b.bx(K, 4.46, 1.18, -1.2, 4.52, 1.46, -1.0);
  b.bx(K, 4.46, top, -1.25, 4.68, top + 0.012, -0.95);
  b.bx(K, 4.47, top + 0.012, -1.12, 4.51, 1.18, -1.08);
  b.detail(() => {
    b.rbox(K, 5.25, top + 0.035, -0.75, 0.2, 0.07, 0.22, 0, 0.2, 0); // desk phone
    b.rbox(K, 5.2, top + 0.08, -0.78, 0.06, 0.04, 0.21, 0, 0.2, 0);
    b.rbox(N, 4.95, top + 0.012, -1.55, 0.3, 0.024, 0.42, 0, 0.35, 0); // gate logbook
    b.rod(K, 5.06, top + 0.026, -1.45, 5.0, top + 0.026, -1.3, 0.004, 4); // pen
  });
  mug(b, 4.72, top, -1.62);
  // the stool the sentry left (between the glass and the counter)
  b.at(3.6, 0, -1.5, 0.6, () => chair(b, { seat: 0.72 }));
  // the desk fan on the counter, blowing toward the glass, running (silent: `fan_loop` is the galley's)
  let fan!: DeskFan;
  b.at(5.25, top, -2.35, -PI / 2 + 0.35, () => { fan = deskFan(b, L, { name: 'gate5_booth_fan', running: true }); });
  // booth luminaire under the roof
  batten(b, 4.1, 2.6, -2.0, 'z', 1.2, glass); // (its lens follows the gatehouse lamps: the booth lamp itself is medium+)
  // the booth's back door into solid (W7): ajar at load, `gate5_booth` lets it settle shut
  boothBackDoor(L, b);
  // the visitors' clipboard on the outside ledge (kit cap top 1.04; `note5_visitors` (2.3, 1.05, −2.0))
  paper(b, 2.34, 1.04, -2.0, 0.22, 0.32, 0.12);
  b.detail(() => b.sign('방문자 — 출입 기록', 'label', 2.36, 1.06, -2.0, 0.2, 0.04, '+y', PI / 2 + 0.12));

  // ── the turnstile line z −5.0: two tripods, the open equipment gate (the route), fences ──
  let left!: Turnstile, right!: Turnstile;
  b.at(-2.55, 0, -5.0, 0, () => { left = turnstile(b, L, { name: 'gate5_turnstile_l', collide: false }); });
  b.at(-1.55, 0, -5.0, 0, () => { right = turnstile(b, L, { name: 'gate5_turnstile_r', collide: false }); });
  b.at(-5.8, 0, -5.0, 0, () => fence(b, L, { len: 2.8, collide: false }));
  b.at(1.2, 0, -5.0, 0, () => fence(b, L, { len: 1.2, collide: false }));
  // equipment gate x −1.0 … 1.2, leaves swung open toward −z along the lane edges (posts + leaves collide: thin, beside the lane)
  b.at(0.1, 0, -5.0, 0, () => equipmentGate(b, L, { w: 2.2 }));
  deckLine(b, L, -0.95, -3.7, 1.15, -3.7, { w: 0.1 });
  b.detail(() => b.sign('여기서 대기', 'navy', 0.1, 0.003, -3.35, 0.9, 0.14, '+y'));
  deckLine(b, L, -5.75, -5.45, -3.0, -5.45, { w: 0.06, color: 'white' });
  deckLine(b, L, -5.75, -4.55, -3.0, -4.55, { w: 0.06, color: 'white' });
  b.detail(() => b.sign('입장 — 한 명씩', 'navy', -4.4, 1.0, -5.035, 1.2, 0.1, '-z', 0, true));

  // ── the ON POST board over the arrivals' side (screen 1.0 × 0.6 at (−4.0, 2.6, −0.22) facing −z) ──
  b.at(-4.0, 2.6, -0.19, PI, () => boardFrame(b, L, { w: 1.0, h: 0.6 }));
  navySign(b, '게이트 4 — 인원', -4.0, 2.16, -0.205, 1.0, 0.09, '-z');

  // ── east wall: first-aid cabinet (`p5_gate_med` (5.4, 1.0, −6.0) on its dropped door) ──
  b.at(5.8, 1.0, -6.0, -PI / 2, () => firstAidCabinet(b, L));
  // west wall: the gate notices; the weapon-clearing barrel in the south-west corner (the shell's box is its collider)
  b.at(-5.8, 1.55, -3.65, PI / 2, () => noticeBoard(b, L, { notices: ['경계 상태\n브라보', '모든 방문객\n부스에 서명하세요', '개인 기기\n이 지점 너머 반입 금지', '모든 총기 안전 처리\n당직실 입실 전'] }));
  b.at(-5.2, 0, -8.6, PI / 2, () => clearingBarrel(b, L, { collide: false }));
  deckLine(b, L, -5.8, -7.85, -4.45, -7.85, { w: 0.06 });
  deckLine(b, L, -4.45, -9.8, -4.45, -7.85, { w: 0.06 });

  // ── structure: frames on the side walls, cable tray, pipes, two luminaires, the emergency fitting ──
  const st = vesselRoom(b, L, {
    x0: -5.8, x1: 5.8, z0: -9.8, z1: -0.2, h: H, axis: 'z', frameNo: 2,
    clear: [['x1', -4.1, -0.1], ['z0', -3.6, -2.0], ['z0', -1.8, 1.8], ['z1', -4.7, -3.3], ['z1', -1.7, 1.7], ['z1', 2.3, 5.8]],
  });
  const ceil = H - 0.172;
  serviceRun(b, L, { along: 'z', a: -9.8, b: -0.2, c: -5.05, ceil, hangers: st, pipes: [[0.05, 0, 0.04, 'pipe'], [0.03, 0.17, 0.06, 'steel']], tray: { w: 0.34, c: -4.45, drop: 0.12 } });
  serviceRun(b, L, { along: 'z', a: -9.8, b: -4.1, c: 5.1, ceil, hangers: st, pipes: [[0.06, 0, 0.04, 'lagged'], [0.035, -0.2, 0.06, 'pipe']] });
  batten(b, -2.5, H - 0.072, -1.3, 'x', 1.5, glass);
  batten(b, 0.5, H - 0.072, -7.0, 'x', 1.5, glass);
  b.at(-3.2, 2.6, -9.8, 0, () => emergFitting(b, eglass));
  b.at(-5.8, 2.6, -2.2, PI / 2, () => emergFitting(b, eglass));
  navySign(b, '당직실 →', -2.6, 2.1, -9.795, 0.8, 0.1, '+z');
  b.decal('scratches', 2, 0.6, 0.002, -6.8, 1.6, 1.2, '+y', 0.3);
  b.decal('grime', 1, -4.2, 0.002, -2.6, 1.8, 1.4, '+y', 1.2);

  const hs = lights(L, [
    { group: 'gate5', type: 'point', p: [-2.5, 3.1, -1.3], color: WARM, i: 10, d: 10 },
    { group: 'gate5', type: 'point', p: [0.5, 3.1, -7.0], color: WARM, i: 10, d: 10 },
    // the booth lamp (medium+, §2.7.1): on LOW the booth reads by the gatehouse lamps through the glass
    { group: 'gate5', type: 'point', p: [4.1, 2.45, -2.0], color: WARM, i: 3.5, d: 4.2, min: 'medium' },
    emergRow('gate5_emerg', -3.2, 2.45, -9.4, 8, 14),
    emergRow('gate5_emerg', -5.4, 2.45, -2.2, 8, 14),
  ]);
  hs[0].bindEmissive(glass, 0.6);
  hs[3].bindEmissive(eglass, 1.2);
  return { left, right, fan };
}

// ═════════════════════════════════════════════════════════════ DUTY5 (x −8 … 8, z −22 … −10, h 3.4)

interface DutyParts { led: THREE.MeshStandardMaterial }

function buildDuty(L: LevelBuild): DutyParts {
  hideStandins(L, 'duty5');
  const b = L.builder('duty5_d1');
  const N: Mat = 'navy_grey', K: Mat = 'painted_dark', H = 3.4;
  const glass = lens(L, 'duty5', WARM, 0xf0ece4), eglass = emergLens(L, 'duty5');

  // ── the watch desk (x −3 … 0, z −16 … −15): kit desk over the shell's 1.0 m box + its 1.25 m log rail (honest cover) ──
  let desk!: ReturnType<typeof watchDesk>;
  b.at(-1.5, 0, -15.5, 0, () => { desk = watchDesk(b, L, { collide: false }); });
  b.collide(-3.0, 1.0, -15.08, 0.0, 1.27, -14.98, 'metal', false);
  // the duty officer's chair, pushed back and turned (clear of `cv5_d1` at (−1.5, −16.55))
  b.at(-2.55, 0, -16.75, 2.4, () => chair(b, { back: true }));
  b.collide(-2.8, 0, -17.0, -2.3, 0.55, -16.5, 'metal', true);

  // ── west wall: the duty board (`dock_status` 3.0 × 1.2 at (−7.78, 1.7, −18.0) facing +x), the module-watch card ──
  b.at(-7.81, 1.7, -18.0, PI / 2, () => boardFrame(b, L, { w: 3.0, h: 1.2 }));
  navySign(b, '초소 4 — 상태 보드', -7.795, 2.42, -18.0, 1.6, 0.11, '+x');
  b.bx(N, -7.8, 1.15, -14.35, -7.785, 1.65, -13.65);
  b.detail(() => {
    b.bx('painted_white', -7.785, 1.28, -14.12, -7.78, 1.52, -13.88);
    b.sign('모듈 당직\n월 0800–1200', 'label', -7.779, 1.42, -14.0, 0.2, 0.09, '+x');
    b.bx('painted_white', -7.785, 1.22, -14.32, -7.781, 1.42, -14.18);
    b.bx('painted_white', -7.785, 1.36, -13.84, -7.781, 1.6, -13.68);
  });
  navySign(b, 'WATCH CARDS', -7.795, 1.72, -14.0, 0.6, 0.08, '+x');

  // ── south wall: filing cabinets (x 4.4 … 5.6, z −21.8 … −21.2, h 1.3; `cv5_d2` north of them) ──
  b.at(5.0, 0, -21.8, 0, () => filingCabinets(b, L, { open: null, collide: false }));
  paper(b, 4.75, 1.3, -21.5, 0.24, 0.32, -0.2);

  // ── east wall: the keypad bezel round `key5_panel` (0.22 × 0.3 at (7.78, 1.35, −13.9) facing −x) and its power LED ──
  b.bx(K, 7.786, 1.16, -14.06, 7.8, 1.54, -13.74);
  for (const [y0, y1, z0, z1] of [[1.16, 1.19, -14.06, -13.74], [1.51, 1.54, -14.06, -13.74], [1.19, 1.51, -14.06, -14.02], [1.19, 1.51, -13.78, -13.74]]) b.bx(K, 7.765, y0, z0, 7.786, y1, z1);
  const led = mat4(L, 'd1_key_led', () => {
    const m = L.ctx.materials.clone('plastic_white', { color: 0x2a3a2a, roughness: 0.3, map: null, normalMap: null, roughnessMap: null, aoMap: null });
    m.emissive = new THREE.Color(0x40ff70); m.emissiveIntensity = 0; m.name = 'd1_key_led';
    return m;
  });
  b.detail(() => {
    b.sphere(led, 7.768, 1.575, -13.9, 0.012, 8);
    b.bx(K, 7.775, 1.55, -13.95, 7.8, 1.6, -13.85);
    b.rod(K, 7.79, 1.6, -13.9, 7.79, 3.38, -13.9, 0.015, 6); // conduit
  });
  navySign(b, '스파인 — 인가된 출입 — 코드', 7.795, 1.72, -13.9, 0.9, 0.07, '-x');
  // the duty camera, east wall high (its tally red: the cameras are on)
  b.at(7.8, 2.6, -19.2, -PI / 2, () => wallCamera(b, L, { tilt: 0.38 }));
  // the shelf under `p5_duty_ammo` (7.5, 1.2, −11.0)
  b.at(7.8, 1.17, -11.0, -PI / 2, () => wallShelf(b, L, { w: 0.6, d: 0.4 }));
  // the brew table in the north-east corner: kettle, mugs (nobody has been here since Monday)
  b.bx(N, 3.0, 0.86, -10.75, 4.6, 0.9, -10.2);
  for (const x of [3.05, 4.5]) b.bx(N, x, 0, -10.7, x + 0.05, 0.86, -10.25);
  b.collide(3.0, 0, -10.75, 4.6, 0.9, -10.2, 'metal', true);
  b.detail(() => {
    b.cyl('stainless', 3.35, 1.0, -10.45, 0.08, 0.2, 'y', 14);
    b.cyl(K, 3.35, 1.11, -10.45, 0.03, 0.03, 'y', 8);
    b.rbox(K, 3.47, 1.0, -10.45, 0.03, 0.12, 0.08, 0, 0, 0.3);
    b.bx(K, 3.2, 0.9, -10.6, 3.5, 0.91, -10.3);
  });
  mug(b, 3.8, 0.9, -10.5); mug(b, 3.95, 0.9, -10.38, PI / 2); mug(b, 4.25, 0.9, -10.55);
  // north wall, west of the door: the watch bill board
  b.at(-4.6, 1.6, -10.2, PI, () => noticeBoard(b, L, { w: 1.4, notices: ['근무 명단\n당직실 — 월', '링크 훈련\n전 근무지 08:40', '대비 훈련\n9일차', 'SDV 턴\n잠항 — 다이브 보드 참조'] }));

  // ── structure: frames, cable tray, pipes, luminaires, emergency fitting ──
  const st = vesselRoom(b, L, {
    x0: -7.8, x1: 7.8, z0: -21.8, z1: -10.2, h: H, axis: 'z', frameNo: 6,
    clear: [['x0', -19.7, -16.3], ['x1', -17.8, -13.4], ['z1', -1.8, 1.8], ['z1', -5.4, -3.8], ['z1', 2.9, 4.7], ['z0', -5.8, -2.2], ['z0', 4.3, 5.7]],
  });
  const ceil = H - 0.172, HB = H - 0.072;
  cableTray(b, -7.7, 7.7, -12.9, ceil - 0.1, 'x');
  serviceRun(b, L, { along: 'z', a: -21.8, b: -10.2, c: 7.1, ceil, hangers: st, pipes: [[0.05, 0, 0.04, 'pipe'], [0.035, -0.18, 0.06, 'steel'], [0.06, -0.42, 0.04, 'lagged']] });
  serviceRun(b, L, { along: 'z', a: -21.8, b: -10.2, c: -7.1, ceil, hangers: st, pipes: [[0.04, 0, 0.05, 'pipe']], tray: { w: 0.3, c: 0.45, drop: 0.1 } });
  batten(b, -2.6, HB, -18.2, 'x', 1.5, glass);
  batten(b, 3.6, HB, -14.0, 'x', 1.5, glass);
  batten(b, -4.6, HB, -12.8, 'x', 1.5, glass);
  batten(b, 4.6, HB, -19.0, 'x', 1.5, glass);
  b.at(-3.0, HB, -18.9, 0, () => { b.push(0, 0, 0, 0, PI / 2); emergFitting(b, eglass); b.pop(); }); // (ceiling fittings)
  b.at(4.0, HB, -13.4, 0, () => { b.push(0, 0, 0, 0, PI / 2); emergFitting(b, eglass); b.pop(); });
  b.decal('scratches', 1, -1.5, 0.002, -14.2, 2.6, 1.2, '+y');

  const hs = lights(L, [
    // over the soldier's mark / the ready door (the cutscene), and over the entry + the desk's front (the door opens on it)
    { group: 'duty5', type: 'point', p: [-2.6, 3.1, -18.2], color: WARM, i: 15, d: 12.5 },
    { group: 'duty5', type: 'point', p: [3.6, 3.1, -14.0], color: WARM, i: 15, d: 12.5 },
    { group: 'duty5', type: 'spot', p: [desk.lamp.pos.x, desk.lamp.pos.y - 0.04, desk.lamp.pos.z], t: desk.lamp.target.toArray() as [number, number, number], color: LAMP, i: 6, d: 4, angle: 1.0, cast: true, prio: 0.8, min: 'medium' },
    emergRow('duty5_emerg', -3.0, 3.1, -18.9, 10, 14),
    emergRow('duty5_emerg', 4.0, 3.1, -13.4, 10, 14),
  ]);
  hs[0].bindEmissive(glass, 0.6);
  hs[3].bindEmissive(eglass, 1.2);
  return { led };
}

// ═════════════════════════════════════════════════════════════ READY5 (x −12 … 4, z −38 … −22, h 3.4)

interface ReadyParts { doors: LockerDoor[]; slam: LockerDoor; helmet: LooseHelmet; lights: LightHandle[] }

function buildReady(L: LevelBuild): ReadyParts {
  hideStandins(L, 'ready5');
  const b = L.builder('ready5_d1');
  const N: Mat = 'navy_grey', H = 3.4;
  const glass = lens(L, 'ready5', WARM, 0xf0ece4), eglass = emergLens(L, 'ready5');

  // ── locker rows (h 2.0, the shell's boxes are the colliders) ──
  // L1 x −8.0 … −7.4: Brekke's locker 7 on its east face (door centre z −29.25)
  b.at(-7.7, 0, -29.5, PI / 2, () => lockerBank(b, L, { name: 'ready5_l1', names: { '+z6': '브레케' }, collide: false }));
  // his note, taped on the door (`note5_locker` (−7.38, 1.5, −29.0) facing +x)
  b.detail(() => {
    b.bx('painted_white', -7.39, 1.42, -29.2, -7.385, 1.6, -29.06);
    b.bx('plastic_white', -7.386, 1.585, -29.17, -7.383, 1.605, -29.09);
  });
  // L2 x −0.4 … 0.2: the scare locker (`mk5_locker_slam`) on its west face at z −31.74, ajar; its neighbours movable
  let l2!: ReturnType<typeof lockerBank>;
  b.at(-0.1, 0, -29.5, PI / 2, () => { l2 = lockerBank(b, L, { name: 'ready5_l2', movable: [['-z', 1], ['-z', 2, 0.3], ['-z', 3]], collide: false }); });
  const slam = l2.door('-z', 2)!, doors = [l2.door('-z', 1)!, slam, l2.door('-z', 3)!];
  let helmet!: LooseHelmet;
  b.push(); b.m.identity();
  b.at(slam.shelf.x, slam.shelf.y, slam.shelf.z, PI / 2, () => { helmet = looseHelmet(b, L, { name: 'ready5_loose_helmet' }); });
  b.pop();

  // ── gear crates (h 1.2), the kit rack along the south wall (h 2.2) with helmets on its top shelf ──
  b.at(-4.0, 0, -29.5, 0, () => gearCrate(b, L, { seed: 3, collide: false }));
  b.at(-4.0, 0, -34.0, PI, () => gearCrate(b, L, { seed: 8, label: '상시 사용 — 랙 1', collide: false }));
  b.at(2.0, 0, -35.2, 0, () => gearCrate(b, L, { seed: 13, label: '배터리 — 무기 조명', collide: false }));
  let rack!: ReturnType<typeof kitRack>;
  b.at(-4.0, 0, -37.8, 0, () => { rack = kitRack(b, L, { len: 15.6, collide: false }); });
  rack.top.forEach((p, i) => { if (i % 3 !== 1) { b.push(); b.m.identity(); b.at(p.x, p.y, p.z, 0, () => helmetRow(b, L, { n: 2, seed: 5 + i })); b.pop(); } });

  // ── benches (h 0.45, walkable): along L1's east face south of Brekke's door, along L2's east face north ──
  b.at(-6.9, 0, -31.6, PI / 2, () => bench5(b, L, { len: 1.8 }));
  b.at(0.72, 0, -27.6, PI / 2, () => bench5(b, L, { len: 1.8 }));

  // ── rubber mats in the aisles (overlay, no collider) ──
  const mat = L.overlay('rubber_mat');
  b.detail(() => {
    b.bx(mat, -7.3, 0, -32.6, -6.3, 0.008, -30.6);
    b.bx(mat, 0.3, 0, -28.6, 1.3, 0.008, -26.6);
  });

  // ── the camera high on the north wall (Kessler: "I can see you on the camera"), shelves under the pickups ──
  b.at(-10.0, 3.0, -22.2, PI, () => wallCamera(b, L, { tilt: 0.42 }));
  b.at(3.8, 0.97, -23.0, -PI / 2, () => wallShelf(b, L, { w: 0.6, d: 0.4 }));
  b.at(-11.8, 0.97, -30.0, PI / 2, () => wallShelf(b, L, { w: 0.6, d: 0.4 }));
  navySign(b, '의무', 3.795, 1.35, -23.0, 0.5, 0.08, '-x');
  navySign(b, '5.56 — 상시 사용', -11.795, 1.35, -30.0, 0.7, 0.08, '+x');
  // the west wall board: kit check, the collar check (Brekke's note answers it)
  b.at(-11.8, 1.6, -25.6, PI / 2, () => noticeBoard(b, L, { notices: ['대기실\n장비 점검 매일 07:30', '칼라 점검\n월 08:40 — 전원', '무기 조명\n켬 — 함 소등'] }));
  navySign(b, '대기실 — 파견대', -4.0, 2.75, -37.795, 2.2, 0.14, '+z');

  // ── lived in (B1): a carbine stripped for cleaning on C1, the radio chargers on C2, weapon lights on C3, kit bags,
  // boots and a towel by the benches, jackets and a vest on hooks on the east wall, the team board on the west wall
  {
    const K: Mat = 'painted_dark', cloth = paint(L, 0x26324a, 0.85), olive = paint(L, 0x4d5442, 0.8), rag = paperMat(L, 0xd9d4c6);
    const top = 1.2;
    // C1 (x −4.6 … −3.4, z −29.9 … −29.1): a cleaning mat, the carbine in pieces, a rod, rags, an oil bottle, a mug
    b.detail(() => {
      b.bx(mat, -4.45, top, -29.82, -3.55, top + 0.006, -29.18);
      b.rbox(K, -4.05, top + 0.03, -29.5, 0.55, 0.045, 0.07, 0, 0.12, 0);              // upper receiver + barrel
      b.rbox(K, -3.72, top + 0.03, -29.33, 0.24, 0.06, 0.07, 0, -0.3, 0);              // lower + grip
      b.rbox(K, -3.83, top + 0.025, -29.68, 0.2, 0.05, 0.035, 0, 0.5, 0);              // bolt carrier
      b.rbox(K, -4.32, top + 0.02, -29.32, 0.13, 0.04, 0.05, 0, -0.9, 0);              // magazine
      b.rod('steel_raw', -4.4, top + 0.012, -29.75, -3.65, top + 0.012, -29.8, 0.004, 4);  // cleaning rod
      b.quad(rag, -3.68, top + 0.008, -29.62, 0.16, 0.13, '+y', 0.5);
      b.quad(rag, -4.3, top + 0.008, -29.6, 0.12, 0.1, '+y', -0.7);
      b.cyl(paint(L, 0x8a3b2e, 0.35), -3.62, top + 0.06, -29.24, 0.022, 0.11, 'y', 8);
    });
    // C2 (x −4.6 … −3.4, z −34.4 … −33.6): the radio charger rack, six bays, four sets in, their LEDs
    {
      const led = lampLens5(L, 'red', 0.5), ledG = lampLens5(L, 'warm', 0.45);
      b.bx(K, -4.5, top, -34.25, -3.5, top + 0.08, -33.75);
      b.detail(() => {
        for (let i = 0; i < 6; i++) {
          const x = -4.42 + i * 0.165;
          b.bx(i % 3 === 2 ? led : ledG, x + 0.06, top + 0.06, -33.749, x + 0.08, top + 0.07, -33.745);
          if (i === 1 || i === 4) continue;
          b.bx(K, x - 0.03, top + 0.08, -34.08, x + 0.03, top + 0.28, -33.98).rod(K, x + 0.015, top + 0.28, -34.06, x + 0.015, top + 0.42, -34.06, 0.005, 4);
        }
        b.sign('무전기 — 반출 기록', 'label', -4.0, top + 0.04, -33.745, 0.5, 0.04, '+z');
      });
    }
    // C3 (x 1.4 … 2.6, z −35.6 … −34.8): weapon lights and battery packs laid out
    b.detail(() => {
      for (let i = 0; i < 5; i++) b.cyl(K, 1.6 + i * 0.12, top + 0.02, -35.35, 0.018, 0.14, 'z', 8);
      for (let i = 0; i < 6; i++) b.bx(olive, 1.62 + (i % 3) * 0.11, top, -35.05 + Math.floor(i / 3) * 0.1, 1.7 + (i % 3) * 0.11, top + 0.05, -34.98 + Math.floor(i / 3) * 0.1);
    });
    // benches: a kit bag, a helmet, a towel; boots under them; a bag on the deck by L1
    b.cyl(cloth, -6.9, 0.6, -32.1, 0.16, 0.6, 'z', 12);
    b.detail(() => { b.quad(rag, -6.9, 0.452, -31.0, 0.35, 0.6, '+y', 0.1); b.quad(paperMat(L, 0xb8c4cc), 0.72, 0.452, -28.1, 0.3, 0.5, '+y', -0.2); });
    b.push(); b.m.identity();
    b.at(0.72, 0.45, -27.1, 0.5, () => helmetRow(b, L, { n: 1, seed: 21 }));
    b.pop();
    const boots = (x: number, z: number, ry: number) => b.at(x, 0, z, ry, () => { for (const s of [-1, 1]) { b.rbox('rubber', s * 0.07, 0.02, 0, 0.1, 0.04, 0.29, 0, 0, 0); b.rbox(K, s * 0.07, 0.11, -0.05, 0.09, 0.16, 0.13, 0, 0, 0); } });
    boots(-6.75, -30.6, 1.4); boots(0.95, -26.9, -1.6); boots(-7.15, -27.0, 0.2);
    b.cyl(olive, -7.1, 0.17, -33.6, 0.17, 0.62, 'x', 12);
    // the east wall between the frames at −29.5 and −26.5: a hook rail, two jackets and a plate carrier hanging
    b.bx('steel_raw', 3.76, 1.78, -29.2, 3.8, 1.82, -26.8);
    for (const [z, k] of [[-28.8, 0], [-28.0, 1], [-27.2, 2]] as const) {
      b.rod('steel_raw', 3.78, 1.8, z, 3.7, 1.83, z, 0.008, 4);
      if (k === 1) {
        // the plate carrier on its shoulder straps
        b.rbox('webbing', 3.62, 1.5, z, 0.08, 0.36, 0.3, 0, 0, 0.04);
        b.detail(() => { for (const dz of [-0.09, 0.0, 0.09]) b.bx('webbing', 3.55, 1.38, z + dz - 0.035, 3.58, 1.5, z + dz + 0.035); });
        b.rod('webbing', 3.7, 1.8, z - 0.1, 3.64, 1.68, z - 0.1, 0.012, 4).rod('webbing', 3.7, 1.8, z + 0.1, 3.64, 1.68, z + 0.1, 0.012, 4);
      } else {
        b.geo(k ? olive : 'fatigue_navy', drapeGeo([
          { c: [0, -0.02, 0], rx: 0.04, rz: 0.06 }, { c: [0, -0.1, 0], rx: 0.07, rz: 0.2, fold: 0.004, nf: 4 },
          { c: [0, -0.35, 0], rx: 0.08, rz: 0.21, fold: 0.012, nf: 6, ph: k }, { c: [0, -0.7, 0.005], rx: 0.09, rz: 0.22, fold: 0.018, nf: 7, ph: 1 + k },
        ], 18, 30 + k, { top: 0.01 }), 'box', new THREE.Matrix4().makeTranslation(3.69, 1.82, z));
      }
    }
    // the team board on the west wall between the frames at −35.5 and −32.5
    b.bx('painted_white', -11.8, 1.15, -35.2, -11.78, 2.05, -33.8);
    b.bx('steel_raw', -11.8, 1.12, -35.22, -11.77, 1.15, -33.78);
    b.detail(() => b.sign('링크 훈련 08:40\nA조 — 스파인 · B조 — 베이\n장비 점검 07:30 — 전원', 'label', -11.776, 1.62, -34.5, 1.3, 0.75, '+x'));
  }

  // ── structure: frames, cable trays, pipes, luminaires, emergency fitting ──
  const st = vesselRoom(b, L, {
    x0: -11.8, x1: 3.8, z0: -37.8, z1: -22.2, h: H, axis: 'z', frameNo: 10,
    clear: [['z1', -5.8, -2.2], ['z1', -10.4, -9.6], ['z0', -5.2, -2.8], ['x0', -26.3, -24.9]],
  });
  const ceil = H - 0.172, HB = H - 0.072;
  cableTray(b, -11.7, 3.7, -24.2, ceil - 0.1, 'x');
  serviceRun(b, L, { along: 'z', a: -37.8, b: -22.2, c: -10.9, ceil, hangers: st, pipes: [[0.05, 0, 0.04, 'pipe'], [0.035, 0.17, 0.06, 'steel']], tray: { w: 0.34, c: -9.6, drop: 0.12 } });
  serviceRun(b, L, { along: 'z', a: -37.8, b: -22.2, c: 3.1, ceil, hangers: st, pipes: [[0.06, 0, 0.04, 'lagged'], [0.035, -0.2, 0.06, 'pipe']] });
  batten(b, -4.0, HB, -28.5, 'x', 1.5, glass); // (one lamp per aisle: a lamp lights the locker faces either side of it)
  batten(b, 2.0, HB, -31.0, 'z', 1.5, glass);
  batten(b, -9.9, HB, -31.0, 'z', 1.5, glass);
  batten(b, -4.0, HB, -25.0, 'x', 1.5, glass);
  batten(b, -4.0, HB, -34.9, 'x', 1.5, glass);
  batten(b, 2.0, HB, -25.0, 'z', 1.5, glass);
  b.at(-6.0, HB, -28.0, 0, () => { b.push(0, 0, 0, 0, PI / 2); emergFitting(b, eglass); b.pop(); }); // (ceiling fittings over the aisles)
  b.at(1.2, HB, -31.6, 0, () => { b.push(0, 0, 0, 0, PI / 2); emergFitting(b, eglass); b.pop(); });
  b.decal('scratches', 3, -6.0, 0.012, -29.5, 1.4, 3.0, '+y');

  const hs = lights(L, [
    { group: 'ready5', type: 'point', p: [-4.0, 3.1, -28.5], color: WARM, i: 12, d: 12 },
    { group: 'ready5', type: 'point', p: [2.0, 3.1, -31.0], color: WARM, i: 11, d: 11 },
    { group: 'ready5', type: 'point', p: [-9.9, 3.1, -31.0], color: WARM, i: 8, d: 9, min: 'medium' },
    emergRow('ready5_emerg', -6.0, 3.1, -28.0, 10, 14),
    emergRow('ready5_emerg', 1.2, 3.1, -31.6, 10, 14),
  ]);
  hs[0].bindEmissive(glass, 0.6);
  hs[3].bindEmissive(eglass, 1.2);
  return { doors, slam, helmet, lights: hs.slice(0, 3) };
}

// ═════════════════════════════════════════════════════════════ vignettes

function screen(L: LevelBuild, id: string, kind: 'onpost' | 'keypad', text: string) {
  const m = L.screens.get(id);
  if (m) L.ctx.materials.setScreen(m, kind, { text });
}

function arrivalVignettes(L: LevelBuild, g: GateParts) {
  // gate5_open (§4.1 t 0.4): the leaf rising is the door's (and both its sounds); the vignette only drives the dogs,
  // already retracted by Aas's palm — no sound of its own
  const dogs = () => L.objects.get('d5_gate_dogs')?.userData as { set?: (k: number) => void; k?: number } | undefined;
  L.vignette('gate5_open', () => {
    const d = dogs();
    const k0 = d?.k ?? 1;
    if (d?.set && k0 < 1) L.tween(0, 0.3, (k) => d.set!(k0 + (1 - k0) * k));
  }, { snap: () => dogs()?.set?.(1) });

  // gate5_booth (§4.1 t 1.2): the booth's back door settles shut (no figure, ever); `booth_door_shut` at the latch
  const door = () => L.objects.get('booth5_backdoor')?.userData as { set(k: number): void; settle(s: number, cb?: () => void): void } | undefined;
  L.vignette('gate5_booth', () => door()?.settle(1.2, () => L.sfx('booth_door_shut', 5.75, 1.1, -3.2, 0.9)), { snap: () => door()?.set(0) });

  // v5_turnstile (§5.5 #1): the left tripod clicks one arm round by itself; 0.4 s later the board ticks 26 → 27
  L.vignette('v5_turnstile', () => {
    g.left.click(1 / 3);
    L.sfx('turnstile_click', -2.55, 0.95, -5.0);
    L.after(0.4, () => { L.sfx('counter_tick', -4.0, 2.6, -0.3); screen(L, 'onpost', 'onpost', '27'); });
  }, { snap: () => { g.left.at(1 / 3); screen(L, 'onpost', 'onpost', '27'); } });
}

function dutyVignettes(L: LevelBuild, d: DutyParts) {
  // key5_power (§4.4, at `l5_kes_4`'s end): the keypad wakes — ENTER CODE, its power LED green
  const on = () => { screen(L, 'key5_panel', 'keypad', '코드 입력'); d.led.emissiveIntensity = 0.9; };
  L.vignette('key5_power', () => { L.sfx('keypad_power_on', 7.78, 1.35, -13.9); on(); }, { snap: on });
}

function readyVignettes(L: LevelBuild, r: ReadyParts) {
  const rest = () => L.objects.get('mk5_helmet_rest')?.position.clone() ?? V(-2.9, 0, -31.5);
  // v5_hull_groan (§5.5 #2): a long groan through the hull; the rows rattle at +2.2; at +3.4 the ajar locker bangs
  // open and a helmet drops and rolls 2.5 m toward the player, wobbles, stops. Each sound once, from here.
  L.vignette('v5_hull_groan', () => {
    L.sfx('hull_groan_long', -4.0, 2.8, -30.0);
    // the lamps sag with the hull's flex, grit sifts from the deckhead
    L.tween(0.5, 1.8, (k) => { const s = 1 - 0.16 * Math.sin(k * PI); for (const h of r.lights) h.intensityScale = s; }, () => { for (const h of r.lights) h.intensityScale = 1; });
    L.after(0.8, () => (L.ctx.fx as FxSystemEx).dustSift?.(new THREE.Box3(V(-7.0, 3.2, -33.0), V(0.0, 3.4, -26.0)), { amount: 0.6 }));
    L.after(2.2, () => { for (const d of r.doors) d.rattle(1.2, 0.045); L.sfx('locker_rattle', -0.45, 1.2, -31.75); });
    L.after(3.4, () => {
      const t = r.slam.bang();
      L.after(t.impact, () => L.sfx('locker_bang', -0.45, 1.3, -31.75));
    });
    L.after(3.5, () => {
      const to = rest();
      const t = r.helmet.fall(to);
      L.after(t.impact, () => L.sfx('helmet_roll', -0.9, 0.1, -31.7));
      L.after(t.impact, () => (L.ctx.fx as FxSystemEx).dustFall?.(V(-0.9, 0, -31.7), { size: 0.3 }));
    });
  }, {
    snap: () => {
      for (const d of r.doors) if (d !== r.slam) d.set(0);
      r.slam.snap(true);
      r.helmet.snap(rest());
      for (const h of r.lights) h.intensityScale = 1;
    },
  });
}

// ═════════════════════════════════════════════════════════════ export

/** B1: the hull's plating on the walls, a plate deckhead between the beams, non-slip deck paint (ready room: + mats). */
const LOOK = { wall: 'hull_white' as Mat, ceiling: 'navy_grey' as Mat, floor: 'deck_nonslip' as Mat };

export const FORE_DRESS: Partial<Record<RoomId5, RoomDress>> = {
  lock5: { build: buildLock, lights: [], look: LOOK, label: false },
  gate5: { build(L) { arrivalVignettes(L, buildGate(L)); }, lights: [], look: LOOK, label: false },
  duty5: { build(L) { dutyVignettes(L, buildDuty(L)); }, lights: [], look: LOOK, label: false },
  ready5: { build(L) { readyVignettes(L, buildReady(L)); }, lights: [], look: LOOK, label: false },
};
