/**
 * BIOLOGICAL SYSTEMS — entry and north (stage 3b §2.6, §2.7, §2.9; task D1a): the outer lock, gowning, the air shower,
 * the clean corridor (north), Wet Lab 1, the PI's office and the sealed Node 2 room.
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const ENTRY_DRESS: Partial<Record<RoomId4, RoomDress>>
 * The shell already made (not re-created here): screens decon_panel, shower_in_panel, shower_out_panel, fumig_status,
 * node2_screen, pi_video; interactables note4_signout, note4_gown, note4_wet, term4_pi, log4_video; markers mk4_start,
 * mk4_decon_panel, mk4_wet_win, mk4_video; the wet-lab and Node 2 panes; the stand-in colliders (gown bench, wet-lab
 * islands + hood counter, PI desk — their visuals are dropped and dressed over with `collide: false`, the colliders
 * stay); the sealed `d4_outer`.
 *
 * Look: the lock keeps 3a's BIO-lock look (it is a copy of the lock you latched behind you); from gowning on the clean
 * side is white HPL, gloss epoxy, #4 stainless, black resin, cold 6500 K light. What people left at 08:41 on Monday:
 * ten pairs of street shoes under the step-over bench and ten closed lockers (Sunde's open and empty); a sample trolley
 * in the corridor; open notebooks, a tipped stool and a centrifuge with its lid up in the wet lab; the PI's hood over her
 * chair, an empty coat hook and badge holder.
 *
 * Vignettes defined here: `decon_cycle` (12 ceiling nozzles mist for 8.0 s + `decon_hiss`), `shower_cycle` (24 side-wall
 * jets from +0.5 to +6.0 s + `shower_jets`). Their particles are bounded emitter sets registered with the fx volume
 * registry at load (`fx4_decon` rooms lock4, `fx4_shower` rooms shower), enabled only while the cycle runs.
 * Emergency lights (`<room>_emerg`, off until `lights_out4`) and floor strips (shared `stripMat`, switched by
 * `setStrips` in `lights_out4`) for gown, corr_n, wetlab, pi_office.
 */
import * as THREE from 'three';
import { rng, type Builder, type Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { FxSystemEx } from '../../fx';
import { placeLights, type LightRow } from '../l3/grey';
import { canvasMat, glassFront, isStandin, paint, paper, restyle, shoes } from '../l3/kit3';
import { D2, type RoomId4 } from './grey';
import type { RoomDress } from './index';
import {
  benchIsland, clinicalSign, filingWall, fumeHood, glow4, hepaDiffuser, jetPanel, labWhite, lockerBank,
  luminaire, nozzleGrid, rackLedMat, serverRack, stepOverBench, stripMat, styleDoors4, installPortalCull4, OPENINGS4, suitRack, ultFreezer, type Nozzles,
} from './kit4';
import { body } from './setpieces';

const PI = Math.PI;
const Y = D2;
const CLEAN = 0xeef4ff, EMERG = 0x9ec4ff, RED = 0xff3020;
type WallFace = '+x' | '-x' | '+z' | '-z';

// ───────────────────────────────────────────────────────────── helpers

/** Place a room's light rows; bind emissive fixtures ([row index, material, base]). */
function lit(L: LevelBuild, rows: LightRow[], binds: [number, THREE.MeshStandardMaterial, number][]) {
  const hs = placeLights(L, rows);
  for (const [i, m, base] of binds) hs[i].bindEmissive(m, base);
  return hs;
}
const emRow = (group: string, p: [number, number, number], i: number, d: number, color = EMERG, min?: 'medium' | 'high'): LightRow =>
  ({ group: `${group}_emerg`, type: 'point', p, color, i, d, off: true, ...(min ? { min } : {}) });

/** Local frame on a wall face (origin on the face, x along the wall, z out of it); `u(w)` converts a world coordinate along the wall. */
function onWall(b: Builder, face: WallFace, plane: number, fn: (u: (w: number) => number) => void) {
  if (face === '+z') b.push(0, Y, plane, 0);
  else if (face === '-z') b.push(0, Y, plane, PI);
  else if (face === '+x') b.push(plane, Y, 0, PI / 2);
  else b.push(plane, Y, 0, -PI / 2);
  const u = (w: number) => (face === '+z' ? w : face === '-z' ? -w : face === '+x' ? -w : w);
  fn(u);
  b.pop();
}

/** A dark bezel round a wall screen (wall-local frame: centre u, y; w × h of the screen). */
function bezel(b: Builder, u: number, y: number, w: number, h: number, t = 0.03, d = 0.025) {
  const K: Mat = 'plastic_dark';
  b.bx(K, u - w / 2 - t, y - h / 2 - t, 0, u + w / 2 + t, y - h / 2, d).bx(K, u - w / 2 - t, y + h / 2, 0, u + w / 2 + t, y + h / 2 + t, d);
  b.bx(K, u - w / 2 - t, y - h / 2, 0, u - w / 2, y + h / 2, d).bx(K, u + w / 2, y - h / 2, 0, u + w / 2 + t, y + h / 2, d);
}

/** Emergency light fitting on a ceiling (world): stainless body with a lens lit by `lens` (bound to the room's emerg light). */
function emergFitting(b: Builder, lens: Mat, x: number, yCeil: number, z: number, alongX = true) {
  const a = alongX ? 0.17 : 0.06, c = alongX ? 0.06 : 0.17;
  b.detail(() => {
    b.bx('stainless', x - a, yCeil - 0.06, z - c, x + a, yCeil, z + c);
    b.bx(lens, x - a + 0.02, yCeil - 0.066, z - c + 0.015, x + a - 0.02, yCeil - 0.06, z + c - 0.015);
  });
}

/** Crash / bumper rail along a wall run (wall-local u0 … u1): stainless brackets, a white rail at trolley height. */
function bumper(b: Builder, L: LevelBuild, u0: number, u1: number) {
  const W = labWhite(L);
  b.bx(W, u0, 0.27, 0.03, u1, 0.39, 0.07);
  b.detail(() => {
    b.bx('plastic_dark', u0, 0.31, 0.07, u1, 0.35, 0.074);
    for (let u = u0 + 0.25; u < u1 - 0.1; u += 1.2) b.bx('stainless', u - 0.03, 0.29, 0, u + 0.03, 0.37, 0.03);
  });
}

/**
 * Emergency floor strip (§8.11) on the shared `stripMat` lens (switched by `setStrips` in `lights_out4`): an aluminium
 * channel 6 cm wide and a lens standing 6 mm above it. (kit4 `floorStrip` puts the lens top 2 mm over the channel top:
 * check:zfight flags it — this local copy keeps the look with a clear step.)
 */
function strip(b: Builder, L: LevelBuild, ax: number, az: number, bx: number, bz: number) {
  const len = Math.hypot(bx - ax, bz - az);
  b.push((ax + bx) / 2, Y, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
  b.detail(() => {
    b.bx('stainless', -0.03, 0, -len / 2, 0.03, 0.005, len / 2);
    b.bx(stripMat(L), -0.02, 0.005, -len / 2 + 0.01, 0.02, 0.011, len / 2 - 0.01);
  });
  b.pop();
}

/** A floor grate over a dark sump in a raised frame (world box x0 … x1, z0 … z1 on the floor). */
function grateFloor(b: Builder, x0: number, z0: number, x1: number, z1: number, frame: Mat) {
  const f = 0.07;
  b.bx(frame, x0, Y, z0, x1, Y + 0.02, z0 + f).bx(frame, x0, Y, z1 - f, x1, Y + 0.02, z1);
  b.bx(frame, x0, Y, z0 + f, x0 + f, Y + 0.02, z1 - f).bx(frame, x1 - f, Y, z0 + f, x1, Y + 0.02, z1 - f);
  b.bx('plastic_dark', x0 + f, Y, z0 + f, x1 - f, Y + 0.006, z1 - f);
  b.quad('floor_grate', (x0 + x1) / 2, Y + 0.016, (z0 + z1) / 2, x1 - x0 - 2 * f, z1 - z0 - 2 * f, '+y', 0, 'box');
}

/** Lab hand sink (wall prop, back at z 0): stainless cabinet, inset bowl, gooseneck + wrist blades, towel and soap dispensers. */
function handSink(b: Builder, w: number) {
  const d = 0.6, h = 0.9, S: Mat = 'stainless', K: Mat = 'plastic_dark';
  b.bx(S, -w / 2 + 0.03, 0, 0.02, w / 2 - 0.03, 0.1, d - 0.06);
  b.bx(S, -w / 2, 0.1, 0, w / 2, h - 0.04, d - 0.02);
  const bx0 = -0.25, bx1 = 0.25, bz0 = 0.1, bz1 = 0.48;
  b.bx(S, -w / 2, h - 0.04, 0, bx0, h, d).bx(S, bx1, h - 0.04, 0, w / 2, h, d);
  b.bx(S, bx0, h - 0.04, 0, bx1, h, bz0).bx(S, bx0, h - 0.04, bz1, bx1, h, d);
  b.bx(S, bx0, h - 0.24, bz0, bx1, h - 0.22, bz1);
  b.bx(S, -w / 2, h, 0, w / 2, h + 0.3, 0.02);
  b.detail(() => {
    b.cyl(K, 0, h - 0.215, 0.3, 0.035, 0.006, 'y', 10);
    for (const s of [-1, 1]) b.bx(S, s < 0 ? -w / 2 + 0.01 : 0.004, 0.12, d - 0.02, s < 0 ? -0.004 : w / 2 - 0.01, h - 0.06, d - 0.008);
    b.rod(S, 0, h, 0.06, 0, h + 0.32, 0.06, 0.014, 8);
    const arc = [[0, h + 0.32, 0.06], [0, h + 0.38, 0.1], [0, h + 0.38, 0.16], [0, h + 0.33, 0.21], [0, h + 0.24, 0.23]] as const;
    for (let i = 0; i < arc.length - 1; i++) { const [p, q] = [arc[i], arc[i + 1]]; b.rod(S, p[0], p[1], p[2], q[0], q[1], q[2], 0.013, 8); }
    for (const s of [-1, 1]) { b.cyl(S, s * 0.1, h + 0.04, 0.06, 0.018, 0.08, 'y', 8); b.rbox(S, s * 0.16, h + 0.09, 0.06, 0.13, 0.012, 0.02, 0, 0, s * 0.25); }
    b.bx(K, -w / 2 + 0.12, h + 0.12, 0.02, -w / 2 + 0.24, h + 0.3, 0.1);
    b.bx(S, -0.17, h + 0.5, 0, 0.17, h + 0.92, 0.12);
    b.bx(K, -0.12, h + 0.49, 0.06, 0.12, h + 0.51, 0.11);
  });
  b.collide(-w / 2, 0, 0, w / 2, h, d, 'metal', true);
}

/** A laboratory stool (floor prop): stainless five-leg base on a column, round black seat; `tip` lays it on its side. */
function labStool(b: Builder, h = 0.62) {
  b.detail(() => {
    for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2; b.rod('stainless', 0, 0.06, 0, Math.sin(a) * 0.27, 0.03, Math.cos(a) * 0.27, 0.012, 5); }
    b.cyl('stainless', 0, h / 2, 0, 0.025, h - 0.06, 'y', 8);
    b.torus('stainless', 0, 0.2, 0, 0.17, 0.008, 'y', 14);
  });
  b.cyl('plastic_dark', 0, h, 0, 0.18, 0.06, 'y', 16);
}

/** Bench-top lab kit (local frame on a work surface, +z toward the user). All ≤ 0.3 m tall (§2.6: nothing above 1.2 m). */
const kit = {
  tubeRack(b: Builder, accent: Mat, n = 8, rows = 2) {
    b.bx('plastic_white', -0.13, 0, -0.05, 0.13, 0.05, 0.05);
    b.detail(() => {
      for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
        if ((i * 7 + r * 3) % 5 === 4) continue;
        const x = -0.105 + i * 0.03, z = -0.025 + r * 0.05;
        b.cyl('plastic_white', x, 0.075, z, 0.0055, 0.07, 'y', 6);
        b.cyl((i + r) % 3 ? accent : 'plastic_dark', x, 0.112, z, 0.0065, 0.012, 'y', 6);
      }
    });
  },
  pipette(b: Builder, ry = 0) {
    b.push(0, 0, 0, ry);
    b.detail(() => {
      b.rod('plastic_white', -0.11, 0.016, 0, 0.08, 0.016, 0, 0.012, 8);
      b.rod('plastic_white', 0.08, 0.016, 0, 0.15, 0.012, 0, 0.005, 5);
      b.rod('plastic_dark', -0.11, 0.016, 0, -0.15, 0.018, 0, 0.007, 6);
      b.box('plastic_dark', -0.04, 0.03, 0, 0.012, 0.02, 0.01);
    });
    b.pop();
  },
  microfuge(b: Builder, open: boolean) {
    b.cyl('plastic_white', 0, 0.065, 0, 0.13, 0.13, 'y', 18);
    b.bx('plastic_white', -0.13, 0, 0.0, 0.13, 0.11, 0.17);
    b.detail(() => {
      b.bx('screen_off', -0.06, 0.07, 0.169, 0.06, 0.1, 0.172);
      if (open) { b.push(0, 0.13, -0.12, 0, -1.2); b.cyl('plastic_dark', 0, 0.01, 0.12, 0.12, 0.02, 'y', 18); b.pop(); b.cyl('stainless', 0, 0.12, 0, 0.09, 0.02, 'y', 14); }
      else b.cyl('plastic_dark', 0, 0.14, 0, 0.12, 0.02, 'y', 18);
    });
  },
  vortex(b: Builder) {
    b.bx('plastic_white', -0.07, 0, -0.07, 0.07, 0.07, 0.07);
    b.detail(() => { b.cyl('plastic_dark', 0, 0.085, 0, 0.03, 0.03, 'y', 10); b.cyl('plastic_dark', 0.04, 0.03, 0.071, 0.012, 0.01, 'z', 8); });
  },
  iceBucket(b: Builder, accent: Mat) {
    b.cyl(accent, 0, 0.065, 0, 0.13, 0.13, 'y', 16, 0.14);
    b.detail(() => {
      b.cyl('plastic_white', 0, 0.128, 0, 0.12, 0.006, 'y', 16);
      for (let i = 0; i < 5; i++) b.rbox('plastic_white', -0.05 + i * 0.025, 0.14, 0.01 * (i % 2), 0.01, 0.06, 0.01, 0.2, 0, 0.1 * (i - 2));
    });
  },
  tipBox(b: Builder, accent: Mat) {
    b.bx(accent, -0.065, 0, -0.045, 0.065, 0.06, 0.045);
    b.detail(() => {
      b.bx('plastic_white', -0.06, 0.06, -0.04, 0.06, 0.065, 0.04);
      b.push(0, 0.065, -0.045, 0, -1.9); b.bx(accent, -0.065, 0, -0.09, 0.065, 0.006, 0); b.pop();
    });
  },
  bottle(b: Builder, h = 0.2, r = 0.045) {
    b.cyl('plastic_white', 0, h / 2, 0, r, h, 'y', 10);
    b.detail(() => b.cyl('plastic_dark', 0, h + 0.02, 0, r * 0.45, 0.04, 'y', 8));
  },
  gloves(b: Builder, accent: Mat) {
    b.bx('plastic_white', -0.125, 0, -0.06, 0.125, 0.065, 0.06);
    b.detail(() => { b.bx(accent, -0.125, 0.0, 0.0605, 0.125, 0.02, 0.0615); b.rbox(accent, 0.02, 0.07, 0, 0.06, 0.012, 0.05, 0.2, 0.4, 0); });
  },
  beaker(b: Builder, r = 0.05, h = 0.12) {
    b.cyl('plastic_white', 0, h / 2, 0, r, h, 'y', 12);
    b.detail(() => b.cyl('plastic_dark', 0, h - 0.005, 0, r * 0.85, 0.004, 'y', 12));
  },
};

/** A stainless lab trolley (floor prop, front +z): two shelves, top at `h`, castors, push handle. */
function trolley(b: Builder, w = 0.8, d = 0.5, h = 0.9, collide = true) {
  const S: Mat = 'stainless';
  for (const y of [0.3, h - 0.025]) b.bx(S, -w / 2, y, -d / 2, w / 2, y + 0.025, d / 2);
  b.detail(() => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.rod(S, sx * (w / 2 - 0.02), 0.08, sz * (d / 2 - 0.02), sx * (w / 2 - 0.02), h, sz * (d / 2 - 0.02), 0.012, 6);
      b.cyl('plastic_dark', sx * (w / 2 - 0.04), 0.04, sz * (d / 2 - 0.04), 0.04, 0.025, 'x', 10);
    }
    for (const y of [0.3, h - 0.025]) for (const s of [-1, 1]) b.bx(S, -w / 2, y + 0.025, s * d / 2 - (s > 0 ? 0.008 : 0), w / 2, y + 0.05, s * d / 2 + (s < 0 ? 0.008 : 0));
    b.rod(S, -w / 2 - 0.06, h + 0.12, -d / 2 + 0.06, -w / 2 - 0.06, h + 0.12, d / 2 - 0.06, 0.012, 6);
    for (const s of [-1, 1]) b.rod(S, -w / 2 - 0.06, h + 0.12, s * (d / 2 - 0.06), -w / 2, h - 0.03, s * (d / 2 - 0.06), 0.01, 5);
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2, 'metal', true);
}

/** A laminated / printed sheet with writing (canvas), lying on a surface or on a wall. */
function sheetMat(L: LevelBuild, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  return canvasMat(L, `d1a_${key}`, w, h, draw);
}
const HAND = '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
const SANS = '"Helvetica Neue", Arial, sans-serif';

// ───────────────────────────────────────────────────────────── lock4 (outer lock, start)

const lock4: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    styleDoors4(L);
    installPortalCull4(L, OPENINGS4);
    const b = L.builder('lock4_dress');
    const H = Y + 3.0;
    const lum = glow4(L, 'lum_lock4', 0xeef4ff, 0.35);
    lit(L, [
      { group: 'lock4', type: 'spot', p: [0, H - 0.05, 2.1], t: [0, Y, 1.9], color: CLEAN, i: 14, d: 6, angle: 1.15, cast: true, min: 'medium' },
      { group: 'lock4', type: 'point', p: [0, H - 0.35, 2.0], color: CLEAN, i: 6, d: 6 },
    ], [[1, lum, 0.35]]);
    // ceiling: a square luminaire between two nozzle manifolds (12 nozzles, aimed down)
    b.at(0, H, 2.0, PI / 2, () => luminaire(b, L, { w: 0.6, len: 1.2, glow: lum }));
    const pts: THREE.Vector3[] = [];
    for (const x of [-0.95, 0.95]) {
      b.push(x, H - 0.002, 2.0, 0, PI / 2);
      const nz = nozzleGrid(b, L, { rows: 2, cols: 3, pitch: 0.45 });
      b.pop();
      pts.push(...nz.points);
      b.detail(() => b.rod('stainless', x, H - 0.03, 2.0, x * 1.75, H - 0.03, 2.0, 0.018, 8)); // feed to the wall
    }
    // decon grate in the floor over a dark sump, handrails, the inner reader bezel, signs
    grateFloor(b, -1.05, 0.95, 1.05, 3.05, 'trim_steel');
    for (const s of [-1, 1]) {
      b.rod('chrome', s * 1.72, Y + 1.0, 0.7, s * 1.72, Y + 1.0, 3.3, 0.02, 8);
      for (const z of [0.8, 3.2]) b.rod('chrome', s * 1.72, Y + 1.0, z, s * 1.8, Y + 1.0, z, 0.011, 6);
    }
    onWall(b, '-x', 1.8, () => bezel(b, 1.0, 1.3, 0.5, 0.3));
    clinicalSign(b, L, '생물 시스템 — 청정 구역', -1.795, Y + 2.3, 2.0, 2.6, 0.26, '+x');
    clinicalSign(b, L, '[bio] DECONTAMINATION ON ENTRY — 8 s — STAND ON THE GRATE', -1.795, Y + 1.95, 2.0, 2.6, 0.2, '+x');
    b.bx('hazard_stripes', -1.0, Y, 0.2, 1.0, Y + 0.004, 0.32);

    // decon mist (§2.9 fx4_decon): bounded set, off until the cycle. (Box to the ceiling: the nozzles are up there.)
    const fx = L.ctx.fx as FxSystemEx;
    const bounds = new THREE.Box3(new THREE.Vector3(-1.8, Y, 0.2), new THREE.Vector3(1.8, H - 0.02, 3.8));
    const mist = pts.map((p) => {
      const d = new THREE.Vector3((p.x > 0 ? -1 : 1) * 0.12, -1, (p.z - 2.0) * 0.2).normalize();
      const e = fx.emitter('steam', p, d, 40, { bounds, rooms: ['lock4'], seenFrom: ['gown'], id: 'fx4_decon', speed: 0.5, jet: true });
      e.enabled = false;
      return e;
    });
    L.vignette('decon_cycle', () => {
      L.sfx('decon_hiss', 0, Y + 2.2, 2.0, 1);
      for (const e of mist) e.enabled = true;
      L.after(8.0, () => { for (const e of mist) e.enabled = false; });
    });
  },
};

// ───────────────────────────────────────────────────────────── gown (gowning)

const SIGNOUT = ['베리', '달', '홀름', '모에', '네스', '포스', '엥', '스트란드', '하우겐', '리에'];

const gown: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const R = rng(4101);
    const b = L.builder('gown_dress');
    restyle(L, 'gown_grey', isStandin, null);
    const H = Y + 3.0;
    const lum = glow4(L, 'lum_gown', 0xe8f0ff, 0.35);
    const emL = glow4(L, 'em_gown', EMERG, 0.35);
    lit(L, [
      { group: 'gown', type: 'point', p: [0, H - 0.3, -3.4], color: CLEAN, i: 6.5, d: 8 },
      { group: 'gown', type: 'point', p: [-2.4, H - 0.3, -1.4], color: CLEAN, i: 3, d: 6, min: 'medium' },
      emRow('gown', [0, H - 0.2, -3.0], 1.4, 7),
    ], [[0, lum, 0.35], [2, emL, 0.35]]);
    for (const [x, z] of [[-2.0, -1.6], [2.0, -1.6], [-2.0, -4.4], [2.0, -4.4]] as const) b.at(x, H, z, 0, () => luminaire(b, L, { glow: lum }));
    for (const z of [-1.6, -4.4]) b.at(0, H, z, 0, () => hepaDiffuser(b, L));
    emergFitting(b, emL, 0, H, -3.0);

    // step-over bench on the stand-in's collider (x −3.8 … 2.6), the clean line through the 1.2 m gap at its end
    b.at(-0.6, Y, -3.0, 0, () => stepOverBench(b, L, { len: 6.4, collide: false }));
    b.detail(() => b.bx(paint(L, 0x3f78c8, 0.5), 2.6, Y, -3.03, 3.8, Y + 0.004, -2.97));
    clinicalSign(b, L, '[none] CLEAN SIDE — GOWNED ONLY ↓', 3.795, Y + 1.85, -3.0, 1.0, 0.22, '-x');
    // Monday's street shoes on the boot shelf (dirty side), one pair kicked off by the wall
    const shoeCols = [0x26262a, 0x4a3426, 0x8d939a];
    for (let i = 0; i < 10; i++) {
      const x = -3.35 + i * 0.58 + R.range(-0.06, 0.06);
      if (x > 2.3) continue;
      b.detail(() => b.at(x, Y + 0.14, -3.0 + R.range(-0.02, 0.02), PI + R.range(-0.25, 0.25), () => shoes(b, L, i % 4 === 2 ? 2 : i % 5 === 3 ? 1 : 0, shoeCols[i % 3])));
    }
    b.detail(() => b.at(3.1, Y, -2.2, 0.9, () => shoes(b, L, 2, shoeCols[2])));
    // a phone left on the bench (no personal items past this line)
    b.detail(() => b.at(-1.9, Y + 0.45, -2.92, 0.35, () => { b.rbox('plastic_dark', 0, 0.005, 0, 0.075, 0.009, 0.155, 0, 0, 0); b.quad('screen_off', 0, 0.0102, 0, 0.068, 0.145, '+y'); }));

    // lockers on the north wall either side of d4_inner (dirty side): the ten from the sheet, Sunde's open and empty
    const east = ['K. 베리', '달', '홀름', '모에', '네스', 'FOSS'];
    const west = ['엥', 'E. 스트란드', '하우겐', 'LIE', 'A. 순데', ''];
    b.at(2.75, Y, -0.2, PI, () => lockerBank(b, L, { names: east, w: 0.34, d: 0.48 }));
    b.at(-2.75, Y, -0.2, PI, () => lockerBank(b, L, { names: west, w: 0.34, d: 0.48, open: [4] }));
    clinicalSign(b, L, '[person] STAFF LOCKERS — STREET CLOTHES', 2.75, Y + 2.35, -0.205, 1.6, 0.2, '-z');
    clinicalSign(b, L, '[person] STAFF LOCKERS — STREET CLOTHES', -2.75, Y + 2.35, -0.205, 1.6, 0.2, '-z');

    // west wall: mirror, the sign-out sheet on a clipboard (note4_signout), PPE dispensers on the clean side
    onWall(b, '+x', -3.8, (u) => {
      b.bx('stainless', u(-0.85) - 0.03, 0.55, 0, u(-1.55) + 0.03, 1.95, 0.02);
      b.bx('chrome', u(-0.85), 0.58, 0.02, u(-1.55), 1.92, 0.024);
      // clipboard + sheet
      const sheet = sheetMat(L, 'signout', 384, 512, (g, W, Hh) => {
        g.fillStyle = '#f4f3ee'; g.fillRect(0, 0, W, Hh);
        g.fillStyle = '#20303c'; g.font = `700 22px ${SANS}`; g.fillText('방호복 착용실 — 슈트 출입 기록', 18, 34);
        g.font = `600 16px ${SANS}`; g.fillText('날짜: 월요일', 18, 58); g.fillText('이름        외출      복귀', 18, 92);
        g.strokeStyle = '#8b98a3'; g.lineWidth = 1;
        for (let i = 0; i <= 11; i++) { g.beginPath(); g.moveTo(14, 100 + i * 34); g.lineTo(W - 14, 100 + i * 34); g.stroke(); }
        const times = ['07:50', '07:52', '07:58', '08:01', '08:04', '08:07', '08:12', '08:15', '08:22', '08:30'];
        g.fillStyle = '#1d2f6b'; g.font = `500 21px ${HAND}`;
        SIGNOUT.forEach((n, i) => { g.fillText(n, 22, 126 + i * 34); g.fillText(times[i], 170, 126 + i * 34); g.fillText('—', 290, 126 + i * 34); });
      });
      b.bx('plastic_dark', u(-1.86), 1.02, 0, u(-2.14), 1.4, 0.012);
      b.quad(sheet, u(-2.0), 1.2, 0.014, 0.24, 0.32, '+z');
      b.bx('stainless', u(-1.95), 1.36, 0.012, u(-2.05), 1.39, 0.024);
      b.rod('plastic_dark', u(-2.12), 1.3, 0.02, u(-2.18), 0.95, 0.03, 0.004, 4);
      // dispensers: hoods, masks, gloves S/M/L, overshoes on a stainless shelf
      b.bx('stainless', u(-3.45), 1.02, 0, u(-5.45), 1.04, 0.3);
      const labels = ['후드', '마스크', '장갑 S', '장갑 M', '장갑 L', '덧신'];
      for (let i = 0; i < 6; i++) {
        const c = u(-3.6 - i * 0.33);
        b.bx('plastic_white', c - 0.14, 1.04, 0.03, c + 0.14, 1.32, 0.27);
        b.detail(() => b.sign(labels[i], 'label', c, 1.25, 0.271, 0.24, 0.05, '+z'));
      }
    });
    clinicalSign(b, L, '[none] SIGN OUT — SIGN IN', -3.795, Y + 1.58, -2.0, 0.5, 0.1, '+x', { plate: false });

    // south wall west: the suit rack (eight hangers bare — the suits went out Monday)
    b.at(-2.75, Y, -5.48, 0, () => suitRack(b, L, R, { len: 1.85, hangers: 10, suits: 2 }));
    // east wall: first-aid shelf (p4_gown_med, top at 1.2), the gowning-order poster (note4_gown)
    onWall(b, '-x', 3.8, (u) => {
      b.bx('stainless', u(-1.15), 1.17, 0, u(-1.85), 1.2, 0.24);
      b.detail(() => { for (const s of [-1, 1]) b.bx('stainless', u(-1.5) + s * 0.3 - 0.01, 0.98, 0, u(-1.5) + s * 0.3 + 0.01, 1.17, 0.18); });
      const poster = sheetMat(L, 'gown_order', 384, 544, (g, W, Hh) => {
        g.fillStyle = '#f6f7f8'; g.fillRect(0, 0, W, Hh);
        g.fillStyle = '#4c6274'; g.fillRect(0, 0, W, 64);
        g.fillStyle = '#ffffff'; g.font = `800 34px ${SANS}`; g.fillText('방호복 착용 순서', 24, 44);
        const steps = ['1  후드', '2  마스크', '3  슈트', '4  부츠', '5  장갑'];
        g.fillStyle = '#22303a'; g.font = `700 28px ${SANS}`;
        steps.forEach((s, i) => {
          g.fillText(s, 40, 120 + i * 58);
          g.strokeStyle = '#4c6274'; g.lineWidth = 3; g.strokeRect(W - 112, 88 + i * 58, 60, 44);
        });
        g.font = `600 20px ${SANS}`; g.fillStyle = '#22303a';
        g.fillText('벤치를 넘어갈 것.', 40, 418); g.fillText('에어 샤워: 6초.', 40, 446);
        g.fillStyle = '#b3261e'; g.font = `800 21px ${SANS}`;
        g.fillText('착용 후에는 절대', 40, 490); g.fillText('오염 구역으로 돌아가지 말 것.', 40, 516);
      });
      b.bx('stainless', u(-4.5) - 0.32, 0.9, 0, u(-4.5) + 0.32, 1.78, 0.01);
      b.quad(poster, u(-4.5), 1.34, 0.017, 0.6, 0.84, '+z');
    });
    clinicalSign(b, L, '[cross] 응급처치', 3.795, Y + 1.5, -1.5, 0.6, 0.14, '-x');
    // tacky mat at the shower door (gown side), a pedal bin
    b.detail(() => {
      b.bx(paint(L, 0x9cc0e2, 0.35), -0.75, Y, -5.78, 0.75, Y + 0.004, -4.75);
      b.bx('plastic_white', -0.74, Y + 0.004, -5.76, 0.6, Y + 0.009, -4.77);
    });
    b.at(3.35, Y, -5.4, 0, () => { b.cyl('stainless', 0, 0.25, 0, 0.17, 0.5, 'y', 14); b.detail(() => b.cyl('plastic_dark', 0, 0.505, 0, 0.17, 0.01, 'y', 14)); b.collide(-0.17, 0, -0.17, 0.17, 0.5, 0.17, 'metal', true); });
    clinicalSign(b, L, '[bio] AIR SHOWER →', -1.9, Y + 2.25, -5.795, 1.0, 0.2, '+z');
    onWall(b, '+z', -5.8, (u) => bezel(b, u(1.7), 1.5, 0.5, 0.3));
  },
};

// ───────────────────────────────────────────────────────────── shower (air shower, one way)

const shower: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const b = L.builder('shower_dress');
    const H = Y + 2.8;
    const lum = glow4(L, 'lum_shower', 0xe8f0ff, 0.35);
    lit(L, [{ group: 'shower', type: 'point', p: [0, H - 0.25, -7.5], color: CLEAN, i: 6, d: 5 }], [[0, lum, 0.35]]);
    b.at(0, H, -7.5, PI / 2, () => luminaire(b, L, { w: 0.5, len: 1.0, glow: lum }));
    for (const x of [-1.0, 1.0]) b.at(x, H, -7.5, 0, () => hepaDiffuser(b, L, { w: 0.5 }));
    // jet walls (3 × 4 each) on both side walls
    const jets: Nozzles[] = [];
    b.at(1.8, Y, -7.5, -PI / 2, () => jets.push(jetPanel(b, L, { w: 2.4, h: 2.2 })));
    b.at(-1.8, Y, -7.5, PI / 2, () => jets.push(jetPanel(b, L, { w: 2.4, h: 2.2 })));
    // grated floor over a dark return-air trough
    grateFloor(b, -1.78, -8.78, 1.78, -6.22, 'stainless');
    clinicalSign(b, L, '[bio] AIR SHOWER — ARMS RAISED — TURN SLOWLY', -1.795, Y + 2.45, -7.5, 2.2, 0.2, '+x');
    clinicalSign(b, L, '[warn] CLEAN SIDE — DO NOT RETURN GOWNED', 1.795, Y + 2.45, -7.5, 2.2, 0.2, '-x');
    onWall(b, '+z', -8.8, (u) => bezel(b, u(1.42), 1.5, 0.42, 0.26));

    // Dahl, against the east jet wall facing −x (§2.6: footprint x 1.3 … 1.8, passage x −1.8 … 1.3)
    const dahl = body(L, b, 'slumped_wall', '달', { x: 1.5, y: Y, z: -7.6, ry: -PI / 2 });

    // air jets (§2.9 fx4_shower): 24 bounded emitters, off until the cycle; the ones behind Dahl stay off
    const fx = L.ctx.fx as FxSystemEx;
    const bounds = new THREE.Box3(new THREE.Vector3(-1.8, Y, -8.8), new THREE.Vector3(1.8, Y + 2.6, -6.2));
    const hid = dahl.box.clone().expandByScalar(0.05);
    const ems: { stop(): void; enabled: boolean }[] = [];
    for (const nz of jets) for (const p of nz.points) {
      if (hid.containsPoint(p)) continue;
      const d = nz.dir.clone().add(new THREE.Vector3(0, -0.25, 0)).normalize();
      const e = fx.emitter('steam', p, d, 26, { bounds, rooms: ['shower'], seenFrom: ['corr_n'], id: 'fx4_shower', speed: 0.55, jet: true });
      e.enabled = false;
      ems.push(e);
    }
    L.vignette('shower_cycle', () => {
      L.sfx('shower_jets', 0, Y + 1.4, -7.5, 1);
      L.after(0.5, () => { for (const e of ems) e.enabled = true; });
      L.after(6.0, () => { for (const e of ems) e.enabled = false; });
    });
  },
};

// ───────────────────────────────────────────────────────────── corr_n (clean corridor, north)

const corr_n: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const R = rng(4301);
    const b = L.builder('corr_n_dress');
    restyle(L, 'corr_n_grey', (m) => m === L.ctx.materials.get('glass'), glassFront(L));
    const H = Y + 3.0;
    const lum = glow4(L, 'lum_corr_n', 0xe8f0ff, 0.35);
    const emL = glow4(L, 'em_corr_n', EMERG, 0.35);
    const emR = glow4(L, 'em_red_corr_n', 0xff3a24, 0.35, 0xc8b0ac);
    lit(L, [
      { group: 'corr_n', type: 'point', p: [-7, H - 0.55, -10.5], color: CLEAN, i: 10, d: 12 }, // (B10: ±7 — at ±5.5 the corners into corr_w / corr_e went black on LOW and MEDIUM)
      { group: 'corr_n', type: 'point', p: [7, H - 0.55, -10.5], color: CLEAN, i: 10, d: 12 },
      { group: 'corr_n', type: 'point', p: [-12.5, H - 0.55, -10.5], color: CLEAN, i: 6, d: 8, min: 'high' },
      emRow('corr_n', [0, H - 0.2, -10.5], 1.2, 9),
      emRow('corr_n', [-14.4, H - 0.4, -9.6], 2.5, 6, RED, 'medium'),
    ], [[0, lum, 0.35], [3, emL, 0.35], [4, emR, 0.35]]);
    for (let x = -13.5; x <= 13.6; x += 3) b.at(x, H, -10.5, 0, () => luminaire(b, L, { glow: lum }));
    for (const x of [-12, -6, 6, 12]) b.at(x, H, -10.5, 0, () => hepaDiffuser(b, L));
    emergFitting(b, emL, 0, H, -10.5);
    emergFitting(b, emL, -9, H, -10.5);
    emergFitting(b, emL, 9, H, -10.5);
    // red corner beacon (NW), dark until lights-out
    b.detail(() => { b.bx('stainless', -14.8, H - 0.5, -9.42, -14.62, H - 0.3, -9.22); b.bx(emR, -14.62, H - 0.48, -9.4, -14.6, H - 0.32, -9.24); });

    // bumper rails, emergency floor strips (off until lights-out, §8.11)
    onWall(b, '-z', -9.2, (u) => { bumper(b, L, u(14.7), u(1.3)); bumper(b, L, u(-1.3), u(-14.7)); });
    onWall(b, '+z', -11.8, (u) => bumper(b, L, u(-12.15), u(12.15)));
    for (const [a, c] of [[-14.7, -1.2], [1.2, 14.7]] as const) strip(b, L, a, -9.29, c, -9.29);
    strip(b, L, -12.1, -11.71, 12.1, -11.71);

    // wet-lab windows (x −11 … 3, y 5.7 … 7.0): stainless mullions through the slot, a sill on each side
    for (const x of [-11, -7.8, -4.6, -1.4, 3]) b.bx('stainless', x - 0.04, 5.69, -12.21, x + 0.04, 7.01, -11.79);
    b.bx('stainless', -11, 5.66, -11.8, 3, 5.7, -11.74);
    b.bx('stainless', -11, 5.66, -12.26, 3, 5.7, -12.2);
    b.sign('훈증 완료 — 월 08:41\n제거 금지', 'clinical', -10.55, 6.85, -11.784, 0.32, 0.12, '+z', 0.03);
    b.sign('훈증 완료 — 월 08:41\n제거 금지', 'clinical', 2.55, 6.85, -11.784, 0.32, 0.12, '+z', -0.02);
    clinicalSign(b, L, '습식 실험실 1 — BSL-2', -4, Y + 2.62, -11.8, 1.6, 0.2, '+z');

    // fumigation status screen on the pier (x 3.1 … 3.9): bezel
    onWall(b, '+z', -11.8, (u) => bezel(b, u(3.5), 1.4, 0.8, 1.2, 0.025));
    // the shower exit: no-return sign, a differential-pressure gauge, sanitiser
    clinicalSign(b, L, '[warn] AIR SHOWER — EXIT ONLY — NO RE-ENTRY', 0, Y + 2.7, -9.205, 2.2, 0.18, '-z');
    onWall(b, '-z', -9.2, (u) => {
      const gx = u(-1.9);
      b.cyl('stainless', gx, 1.55, 0.02, 0.085, 0.04, 'z', 20);
      b.detail(() => {
        b.cyl('plastic_white', gx, 1.55, 0.041, 0.072, 0.003, 'z', 20);
        b.rbox('plastic_dark', gx + 0.02, 1.565, 0.044, 0.006, 0.06, 0.003, 0, 0, -0.75);
        b.sign('Δp +15 Pa', 'label', gx, 1.4, 0.003, 0.18, 0.05, '+z');
      });
      const sx = u(2.0);
      b.bx('plastic_white', sx - 0.06, 1.15, 0, sx + 0.06, 1.42, 0.1);
      b.detail(() => { b.bx('stainless', sx - 0.035, 1.2, 0.1, sx + 0.035, 1.25, 0.12); b.sign('소독', 'label', sx, 1.35, 0.101, 0.1, 0.04, '+z'); });
    });
    // wayfinding: end walls (turns into the side corridors) and a hanging directory
    clinicalSign(b, L, '냉장고 2 · 생물사육실 →', -14.795, Y + 2.0, -10.5, 1.9, 0.24, '+x');
    clinicalSign(b, L, '수술 구역 →', -14.795, Y + 1.7, -10.5, 1.9, 0.24, '+x');
    clinicalSign(b, L, '← RECORDS · UNIT BAY', 14.795, Y + 2.0, -10.5, 1.9, 0.24, '-x');
    clinicalSign(b, L, '← SURGICAL SUITE', 14.795, Y + 1.7, -10.5, 1.9, 0.24, '-x');
    for (const [x, front, back] of [[-6, '← WET LAB 1 · COLD STORE 2', '에어샤워 출구 →'], [6, '책임연구원실 · 기록실 →', '← AIR SHOWER EXIT']] as const) {
      b.push(x, H - 0.5, -10.5, PI / 2);
      b.detail(() => {
        for (const s of [-1, 1]) b.rod('stainless', s * 0.55, 0.11, 0, s * 0.55, 0.5, 0, 0.005, 4);
        b.bx('stainless', -0.7, -0.12, -0.012, 0.7, 0.12, 0.012);
        b.sign(front, 'clinical', 0, 0, 0.013, 1.36, 0.2, '+z');
        b.sign(back, 'clinical', 0, 0, -0.013, 1.36, 0.2, '-z');
      });
      b.pop();
    }

    // a sample trolley pushed against the north wall on Monday morning: cool box, racks, a clipboard
    const accent = paint(L, 0x3f72c4, 0.5);
    b.at(-6.6, Y, -9.55, PI, () => {
      trolley(b, 0.8, 0.5, 0.9);
      b.at(-0.18, 0.9, 0, 0, () => { b.bx('plastic_white', -0.18, 0, -0.14, 0.18, 0.24, 0.14); b.bx(accent, -0.19, 0.24, -0.15, 0.19, 0.28, 0.15); b.detail(() => b.sign('생물학적 위험 — 배치 41', 'label', 0, 0.13, 0.141, 0.3, 0.05, '+z')); });
      b.at(0.22, 0.9, 0.05, 0.1, () => kit.tubeRack(b, accent, 8, 2));
      b.detail(() => b.at(0.2, 0.9, -0.12, -0.2, () => { b.bx('plastic_dark', -0.12, 0, -0.16, 0.12, 0.008, 0.16); b.rbox(paper(L), 0, 0.01, 0, 0.2, 0.002, 0.28, 0, 0, 0); }));
      b.at(0, 0.325, 0, 0, () => { kit.gloves(b, accent); b.at(0.25, 0, 0, 0.3, () => kit.bottle(b, 0.22)); });
    });
    // Monday's things in the corridor: a dropped mask by the shower exit
    b.detail(() => b.at(1.6 + R.range(-0.1, 0.1), Y + 0.01, -10.2, 0.7, () => { b.sphere('tyvek', 0, 0, 0, 0.08, 10, 0.18, 1.1, 0.7); b.rod('plastic_white', -0.08, 0.005, 0, -0.14, 0.003, 0.1, 0.002, 3); }));
  },
};

// ───────────────────────────────────────────────────────────── wetlab (Wet Lab 1)

const wetlab: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const R = rng(4401);
    const b = L.builder('wetlab_dress');
    restyle(L, 'wetlab_grey', isStandin, null);
    const H = Y + 3.4;
    const lum = glow4(L, 'lum_wetlab', 0xe8f0ff, 0.35);
    const hoodGlow = glow4(L, 'hood_wetlab', 0xf0f6ff, 0.3);
    const emL = glow4(L, 'em_wetlab', EMERG, 0.35);
    lit(L, [
      { group: 'wetlab', type: 'point', p: [-7.0, H - 0.8, -14.9], color: CLEAN, i: 8, d: 11 },
      { group: 'wetlab', type: 'point', p: [-2.0, H - 0.8, -21.1], color: CLEAN, i: 8, d: 11 },
      { group: 'wetlab', type: 'spot', p: [-6, Y + 2.2, -22.85], t: [-6, Y + 0.9, -23.4], color: 0xf4fbff, i: 5, d: 3, angle: 1.0, min: 'medium' },
      emRow('wetlab', [-4, H - 0.2, -18], 1.6, 10),
    ], [[0, lum, 0.35], [0, hoodGlow, 0.3], [3, emL, 0.35]]);
    for (const x of [-9.5, -4.5, 0.5]) for (const z of [-14.2, -18.0, -21.6]) b.at(x, H, z, 0, () => luminaire(b, L, { glow: lum }));
    for (const x of [-7, -2]) for (const z of [-16.1, -19.8]) b.at(x, H, z, 0, () => hepaDiffuser(b, L));
    emergFitting(b, emL, -4, H, -18);
    const accent = paint(L, 0x3f72c4, 0.5);

    // two double islands on the stand-in colliders (x −10 … −6 and −3 … 1, z −20 … −16): benches either side of a
    // shared resin strip, nothing above 1.2 m (§2.6)
    for (const cx of [-8, -1]) {
      b.at(cx, Y, -16.75, 0, () => benchIsland(b, L, { len: 4.0, depth: 1.5, collide: false }));
      b.at(cx, Y, -19.25, 0, () => benchIsland(b, L, { len: 4.0, depth: 1.5, collide: false }));
      b.bx(labWhite(L), cx - 1.98, Y + 0.1, -18.49, cx + 1.98, Y + 0.87, -17.51);
      b.bx('plastic_dark', cx - 2.0, Y + 0.87, -18.495, cx + 2.0, Y + 0.9, -17.505);
      b.bx('plastic_dark', cx - 1.95, Y, -18.45, cx + 1.95, Y + 0.1, -17.55);
    }
    const T = Y + 0.9;
    // island A (x −10 … −6): north face — pipetting interrupted; south face — the tipped stool's station
    b.at(-9.2, T, -16.35, 0, () => kit.tubeRack(b, accent, 8, 2));
    b.at(-8.8, T, -16.3, 0, () => kit.pipette(b, 0.5));
    b.at(-8.2, T, -16.4, 0, () => kit.tipBox(b, accent));
    b.at(-7.4, T, -16.4, 0, () => kit.vortex(b));
    b.at(-6.7, T, -16.45, 0.1, () => kit.gloves(b, accent));
    b.at(-9.0, T, -18.0, 0, () => kit.microfuge(b, true));
    b.at(-7.6, T, -18.0, 0.2, () => kit.iceBucket(b, accent));
    b.at(-6.5, T, -18.0, 0, () => { kit.bottle(b, 0.22); b.at(0.14, 0, 0.05, 0, () => kit.bottle(b, 0.16, 0.035)); });
    b.at(-8.6, T, -19.65, PI, () => kit.tubeRack(b, accent, 6, 2));
    b.at(-7.9, T, -19.6, PI, () => kit.beaker(b));
    b.at(-6.9, T, -19.6, PI, () => kit.pipette(b, -0.4));
    // island B (x −3 … 1): the batch-41 protocol (note4_wet at −2.0, −19.0), gel tubes on a cold block, a notebook
    const proto = sheetMat(L, 'gel_protocol', 384, 512, (g, W, Hh) => {
      g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#4c6274'; g.fillRect(0, 0, W, 58);
      g.fillStyle = '#fff'; g.font = `800 26px ${SANS}`; g.fillText('클라스프 젤 — 41번 배치', 18, 39);
      g.fillStyle = '#1f2b33'; g.font = `600 19px ${SANS}`;
      ['−20 °C에 보관.', '살아 있는 숙주에만 착석:', 'it needs body heat and a pulse.', '', 'Dead tissue will not link.'].forEach((t, i) => g.fillText(t, 18, 104 + i * 32));
      g.fillStyle = '#b3261e'; g.font = `800 30px ${SANS}`; g.fillText('시도 금지.', 18, 300);
      g.strokeStyle = '#b3261e'; g.lineWidth = 3; g.strokeRect(10, 266, W - 20, 48);
      g.fillStyle = '#56636c'; g.font = `500 15px ${SANS}`; g.fillText('바이오시스 SOP 41 rev. 3 — A. 순데', 18, Hh - 22);
    });
    b.detail(() => {
      b.at(-2.0, T, -19.0, 0.08, () => { b.bx('plastic_white', -0.115, 0, -0.155, 0.115, 0.003, 0.155); b.quad(proto, 0, 0.008, 0, 0.21, 0.29, '+y'); });
    });
    b.at(-1.55, T, -19.05, 0, () => { b.bx('stainless', -0.12, 0, -0.08, 0.12, 0.05, 0.08); b.detail(() => { for (let i = 0; i < 6; i++) b.cyl('plastic_white', -0.09 + i * 0.036, 0.075, 0, 0.007, 0.06, 'y', 6); }); });
    b.at(-0.6, T, -19.0, 0.0, () => kit.tubeRack(b, accent, 6, 1));
    const book = sheetMat(L, 'wet_notebook', 512, 352, (g, W, Hh) => {
      g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = '#a9c0d6'; g.lineWidth = 1;
      for (let y = 40; y < Hh; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = '#555'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, Hh); g.stroke();
      g.fillStyle = '#1d2f6b'; g.font = `500 17px ${HAND}`;
      ['월', '07:55 해동 b.41 (x12)', '08:10 분주 50 µl', '08:26 → 냉장고 2', '        (홀름이 가져감)', '08:38 후드 2 — P2 페어링', '        14.08 준비'].forEach((t, i) => g.fillText(t, 14, 36 + i * 24));
      g.fillText('08:4', W / 2 + 14, 36);
    });
    b.detail(() => b.at(-2.2, T, -16.35, -0.15, () => { b.bx('plastic_dark', -0.22, 0, -0.15, 0.22, 0.012, 0.15); b.quad(book, 0, 0.017, 0, 0.42, 0.29, '+y'); b.rod('plastic_dark', 0.25, 0.006, 0.02, 0.3, 0.006, 0.12, 0.004, 4); }));
    b.at(-1.0, T, -16.4, 0, () => kit.vortex(b));
    b.at(-0.2, T, -16.4, 0, () => kit.microfuge(b, false));
    b.at(0.6, T, -16.45, 0, () => kit.tipBox(b, accent));
    b.at(-2.2, T, -18.0, 0, () => { kit.beaker(b, 0.07, 0.16); b.at(0.3, 0, 0, 0, () => kit.bottle(b)); b.at(0.55, 0, 0.05, 0, () => kit.bottle(b, 0.16, 0.035)); });
    b.at(0.2, T, -18.0, 0, () => kit.iceBucket(b, accent));
    // stools: two tucked in, one pulled out, one on its side
    for (const [x, z] of [[-9.0, -15.55], [-1.5, -15.55], [0.4, -20.5]] as const) b.at(x, Y, z, R.range(0, 6), () => labStool(b));
    b.at(-7.3, Y + 0.18, -20.45, 0.4, () => { b.push(0, 0, 0, 0, 0, PI / 2); labStool(b); b.pop(); });

    // fume hoods on the south wall over the stand-in counter (x −10 … −2, z −23.8 … −23.1). Depth 0.7 (the kit hood
    // scaled 0.78 in z): sash plane z ≈ −23.15, work surface 0.9, hood 2's sash up to 1.3 (W5's bench worker).
    const hoods: [number, number, number, string][] = [[-9.2, 1.5, 0.05, '후드 1'], [-6.0, 1.8, 0.34, '후드 2'], [-4.325, 1.45, 0.0, '후드 3'], [-2.825, 1.45, 0.12, '후드 4']];
    for (const [x, w, sash, label] of hoods) {
      b.push(x, Y, -23.8, 0); b.pushScale(1, 1, 0.78);
      fumeHood(b, L, { w, sash, ceil: 3.4, glow: hoodGlow, label, collide: false });
      b.pop(); b.pop();
      b.collide(x - w / 2, Y + 0.9, -23.8, x + w / 2, Y + 2.35, -23.16, 'metal', true);
    }
    // the bench between hood 1 and hood 2, a reagent shelf above it
    b.bx(labWhite(L), -8.45, Y + 0.1, -23.8, -6.9, Y + 0.87, -23.12);
    b.bx('plastic_dark', -8.45, Y + 0.87, -23.8, -6.9, Y + 0.9, -23.1);
    b.bx('plastic_dark', -8.4, Y, -23.75, -6.95, Y + 0.1, -23.2);
    b.bx('stainless', -8.4, Y + 1.55, -23.8, -6.95, Y + 1.57, -23.5);
    b.detail(() => { for (let i = 0; i < 6; i++) b.at(-8.25 + i * 0.25, Y + 1.57, -23.65, 0, () => kit.bottle(b, 0.18 + (i % 3) * 0.03, 0.04)); });
    b.at(-7.7, T, -23.4, 0, () => kit.tubeRack(b, accent, 8, 2));
    b.at(-7.1, T, -23.4, 0, () => kit.beaker(b));
    // inside the hoods: hood 2 the worker's rack and tips; hood 1 / 4 bottles
    b.at(-6.15, T, -23.45, 0, () => kit.tubeRack(b, accent, 8, 2));
    b.at(-5.5, T, -23.45, 0, () => kit.tipBox(b, accent));
    b.at(-6.65, T, -23.5, 0, () => kit.beaker(b));
    b.at(-9.4, T, -23.5, 0, () => { kit.bottle(b); b.at(0.3, 0, 0, 0, () => kit.bottle(b, 0.15)); });
    b.at(-2.9, T, -23.5, 0, () => kit.beaker(b, 0.06, 0.14));
    clinicalSign(b, L, '[warn] SASH BELOW 40 cm WHEN IN USE', -7.675, Y + 2.0, -23.795, 1.3, 0.13, '+z');

    // west wall: −80 °C and +4 °C upright freezers; FUMIGATED stickers and BSL-2 signs by both doors
    b.at(-11.8, Y, -21.35, PI / 2, () => ultFreezer(b, L, { label: '−80 °C' }));
    b.at(-11.8, Y, -22.85, PI / 2, () => ultFreezer(b, L, { label: '+4 °C' }));
    b.sign('훈증 완료 — 월 08:41\n제거 금지', 'clinical', -11.784, Y + 1.55, -15.85, 0.32, 0.12, '+x', 0.03);
    clinicalSign(b, L, '[bio] WET LAB 1 — BSL-2 — AUTHORISED STAFF', -11.795, Y + 2.0, -14.7, 1.6, 0.2, '+x');
    b.sign('훈증 완료 — 월 08:41\n제거 금지', 'clinical', 3.784, Y + 1.85, -14.1, 0.32, 0.12, '-x', -0.02);
    // east wall: hand sink (north), safety shower + eyewash station (south)
    b.at(3.8, Y, -13.2, -PI / 2, () => handSink(b, 1.2));
    b.at(3.8, Y, -20.4, -PI / 2, () => {
      b.detail(() => {
        b.rod('stainless', 0, 3.4, 0.25, 0, 2.3, 0.25, 0.02, 8);
        b.cyl('stainless', 0, 2.26, 0.25, 0.14, 0.05, 'y', 16, 0.03);
        b.rod('stainless', 0.18, 2.2, 0.25, 0.18, 1.55, 0.25, 0.006, 4);
        b.rbox('stainless', 0.18, 1.52, 0.25, 0.08, 0.06, 0.01, 0, 0, 0);
      });
      b.sign('[cross] 안전 샤워', 'clinical', 0, 2.0, 0.003, 0.6, 0.14, '+z');
    });
    // a trolley by the east door (p4_wet_ammo on its top at 0.95), a biohazard bin, a sharps box
    b.at(2.5, Y, -14.0, PI / 2, () => {
      trolley(b, 0.8, 0.5, 0.95);
      b.at(0.25, 0.95, 0.05, 0, () => kit.gloves(b, accent));
      b.at(-0.25, 0.325, 0, 0, () => kit.bottle(b));
    });
    b.at(2.9, Y, -22.9, 0, () => {
      b.bx(labWhite(L), -0.25, 0, -0.25, 0.25, 0.75, 0.25);
      b.detail(() => { b.bx('plastic_dark', -0.26, 0.75, -0.26, 0.26, 0.78, 0.26); b.sign('[bio] 생물학적 폐기물', 'clinical', 0, 0.5, 0.251, 0.44, 0.14, '+z'); });
      b.collide(-0.26, 0, -0.26, 0.26, 0.78, 0.26, 'metal', true);
    });
    // south wall east of the hoods: a balance bench and a CO2-incubator stack
    b.bx(labWhite(L), -1.9, Y + 0.1, -23.8, 0.85, Y + 0.87, -23.12);
    b.bx('plastic_dark', -1.92, Y + 0.87, -23.8, 0.87, Y + 0.9, -23.1);
    b.bx('plastic_dark', -1.85, Y, -23.75, 0.8, Y + 0.1, -23.2);
    b.detail(() => { for (let x = -1.85; x < 0.8; x += 0.55) { b.bx(labWhite(L), x + 0.01, Y + 0.12, -23.121, x + 0.53, Y + 0.85, -23.115); b.bx('stainless', x + 0.45, Y + 0.62, -23.115, x + 0.47, Y + 0.78, -23.1); } });
    b.collide(-1.92, Y, -23.8, 0.87, Y + 0.9, -23.1, 'metal', true);
    b.at(-1.3, T, -23.45, 0, () => {
      b.bx('plastic_white', -0.17, 0, -0.2, 0.17, 0.09, 0.2);
      b.detail(() => {
        b.bx('screen_off', -0.1, 0.03, 0.2, 0.1, 0.07, 0.202);
        for (const s2 of [-1, 1]) b.bx('stainless', s2 * 0.16 - 0.01, 0.09, -0.18, s2 * 0.16 + 0.01, 0.3, 0.14);
        b.bx('stainless', -0.17, 0.3, -0.18, 0.17, 0.31, 0.14);
        b.cyl('stainless', 0, 0.1, -0.02, 0.06, 0.006, 'y', 14);
      });
    });
    b.at(-0.35, T, -23.45, 0, () => { b.bx('stainless', -0.3, 0, -0.2, 0.3, 0.2, 0.2); b.detail(() => { b.bx('stainless', -0.3, 0.2, -0.2, 0.3, 0.215, 0.2); b.bx('plastic_dark', -0.08, 0.06, 0.2, 0.08, 0.13, 0.205); }); });
    b.at(0.55, T, -23.4, 0.3, () => kit.tubeRack(b, accent, 6, 2));
    b.at(1.4, Y, -23.8, 0, () => {
      for (const y0 of [0.05, 0.98]) {
        b.bx('stainless', -0.38, y0, 0, 0.38, y0 + 0.9, 0.72);
        b.detail(() => {
          b.bx('stainless', -0.36, y0 + 0.04, 0.72, 0.36, y0 + 0.86, 0.735);
          b.bx('plastic_dark', -0.3, y0 + 0.66, 0.735, -0.05, y0 + 0.78, 0.738);
          b.bx('stainless', 0.28, y0 + 0.3, 0.735, 0.31, y0 + 0.6, 0.76);
          b.sign('CO₂ 5.0 %  37.0 °C', 'label', -0.175, y0 + 0.72, 0.739, 0.22, 0.05, '+z');
        });
      }
      b.collide(-0.38, 0, 0, 0.38, 1.88, 0.72, 'metal', true);
    });
    // floor strips: under the windows (north wall) and along the hood fronts (§8.11)
    strip(b, L, -11.7, -12.29, 3.7, -12.29);
    strip(b, L, -10.0, -22.95, -2.0, -22.95);
    b.detail(() => b.at(-5.3, Y + 0.006, -21.0, 1.2, () => kit.pipette(b, 0)));
  },
};

// ───────────────────────────────────────────────────────────── pi_office (Dr. A. Sunde)

const pi_office: RoomDress = {
  label: false,
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const R = rng(4501);
    const b = L.builder('pi_dress');
    restyle(L, 'pi_office_grey', isStandin, null);
    const H = Y + 3.0;
    const lum = glow4(L, 'lum_pi', 0xe8f0ff, 0.35);
    const lamp = glow4(L, 'lamp_pi', 0xfff2dc, 0.35, 0xf4efe6);
    const emL = glow4(L, 'em_pi', EMERG, 0.35);
    lit(L, [
      { group: 'pi_office', type: 'spot', p: [7.0, 6.6, -12.9], t: [7.4, 5.55, -13.4], color: 0xfff2dc, i: 8, d: 5, angle: 1.0, cast: true, prio: 0.8 },
      { group: 'pi_office', type: 'point', p: [8, H - 0.65, -16.5], color: CLEAN, i: 4.5, d: 8 },
      emRow('pi_office', [8, H - 0.2, -16], 1.4, 8),
    ], [[0, lamp, 0.35], [1, lum, 0.35], [2, emL, 0.35]]);
    for (const [x, z] of [[6.2, -15.0], [9.8, -15.0], [6.2, -18.0], [9.8, -18.0]] as const) b.at(x, H, z, 0, () => luminaire(b, L, { glow: lum }));
    b.at(8, H, -13.4, 0, () => hepaDiffuser(b, L));
    emergFitting(b, emL, 8, H, -16.6);

    // desk on the stand-in collider (x 5.4 … 9.0, z −13.0 … −12.2, top 0.75): white laminate, steel legs, a pedestal
    const W = labWhite(L);
    b.bx(W, 5.4, Y + 0.72, -13.0, 9.0, Y + 0.75, -12.2);
    b.bx('stainless', 5.42, Y, -12.96, 5.47, Y + 0.72, -12.24).bx('stainless', 8.93, Y, -12.96, 8.98, Y + 0.72, -12.24);
    b.bx(W, 5.47, Y + 0.3, -12.26, 8.93, Y + 0.7, -12.22);
    b.bx(W, 8.45, Y + 0.02, -12.95, 8.93, Y + 0.7, -12.26);
    b.detail(() => { for (let k = 0; k < 3; k++) { b.bx(W, 8.46, Y + 0.05 + k * 0.22, -12.97, 8.92, Y + 0.25 + k * 0.22, -12.95); b.bx('stainless', 8.62, Y + 0.2 + k * 0.22, -12.99, 8.76, Y + 0.215 + k * 0.22, -12.97); } });
    const top = Y + 0.75;
    // a year planner over the desk: Monday's week ringed, the pairing date marked
    const plan = sheetMat(L, 'pi_planner', 768, 384, (g, Wc, Hc) => {
      g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, Wc, Hc);
      g.fillStyle = '#4c6274'; g.fillRect(0, 0, Wc, 40);
      g.fillStyle = '#fff'; g.font = `800 24px ${SANS}`; g.fillText('바이오시스 — 연구 일정표', 14, 28);
      const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      g.font = `600 13px ${SANS}`;
      for (let m = 0; m < 12; m++) {
        const y = 52 + m * 27;
        g.fillStyle = '#26323b'; g.fillText(months[m], 10, y + 17);
        for (let d = 0; d < 31; d++) { g.strokeStyle = '#c3ccd3'; g.strokeRect(52 + d * 22.5, y, 22.5, 25); }
      }
      const block = (m: number, d0: number, d1: number, c: string) => { g.fillStyle = c; g.fillRect(53 + d0 * 22.5, 53 + m * 27, (d1 - d0) * 22.5 - 2, 23); };
      block(4, 2, 30, 'rgba(76,98,116,0.35)'); block(5, 0, 29, 'rgba(76,98,116,0.35)'); block(6, 0, 20, 'rgba(224,123,22,0.45)');
      block(7, 13, 14, 'rgba(176,30,30,0.85)');
      g.fillStyle = '#b01e1e'; g.font = `700 18px ${HAND}`; g.fillText('2단계 페어링', 52 + 15 * 22.5, 53 + 7 * 27 + 18);
      g.fillStyle = '#26323b'; g.font = `500 15px ${HAND}`; g.fillText('돼지 P-01..12', 52 + 3 * 22.5, 53 + 4 * 27 + 17); g.fillText('동의서 — 4번 초소 (23)', 52 + 2 * 22.5, 53 + 6 * 27 + 17);
    });
    onWall(b, '-z', -12.2, (u) => {
      b.bx('stainless', u(7.2) - 0.82, 1.52, 0, u(7.2) + 0.82, 2.36, 0.012);
      b.quad(plan, u(7.2), 1.94, 0.018, 1.6, 0.8, '+z');
    });
    // monitors: the video-log screen (pi_video, 8.0) and the terminal (term4_pi, 6.2)
    const mon = (x: number, w: number, h: number, yc: number, zf: number) => {
      b.bx('plastic_dark', x - w / 2 - 0.02, yc - h / 2 - 0.02, zf + 0.004, x + w / 2 + 0.02, yc + h / 2 + 0.02, zf + 0.05);
      b.bx('plastic_dark', x - 0.03, top, zf + 0.05, x + 0.03, yc - h / 2, zf + 0.08);
      b.bx('plastic_dark', x - 0.12, top, zf + 0.02, x + 0.12, top + 0.012, zf + 0.2);
    };
    mon(8.0, 0.6, 0.38, 5.95, -12.45);
    mon(6.2, 0.5, 0.3, 5.93, -12.5);
    L.screen(null, 'terminal_idle', 0.5, 0.3, 6.2, 5.93, -12.505, '-z', { text: '순데 → 할시온 운영본부' });
    b.detail(() => {
      b.at(6.25, top, -12.75, PI, () => { b.rbox('plastic_dark', 0, 0.012, 0, 0.42, 0.02, 0.14, 0.05, 0, 0); });
      b.at(6.65, top, -12.72, 0, () => b.rbox('plastic_dark', 0, 0.015, 0, 0.06, 0.03, 0.1, 0, 0, 0));
      b.at(7.95, top, -12.75, PI, () => b.rbox('plastic_dark', 0, 0.012, 0, 0.36, 0.02, 0.12, 0.05, 0, 0));
      // papers, a mug gone cold, a framed photo turned face down
      b.at(5.75, top, -12.7, 0.3, () => { for (let i = 0; i < 4; i++) b.rbox(paper(L), R.range(-0.04, 0.04), 0.002 + i * 0.0015, R.range(-0.03, 0.03), 0.21, 0.0015, 0.297, 0, R.range(-0.3, 0.3), 0); });
      b.at(8.75, top, -12.75, 0, () => { b.cyl('plastic_white', 0, 0.05, 0, 0.04, 0.1, 'y', 12); b.cyl('plastic_dark', 0, 0.098, 0, 0.034, 0.003, 'y', 12); b.torus('plastic_white', 0.045, 0.05, 0, 0.022, 0.006, 'z', 8); });
      b.at(5.7, top, -12.4, 0.2, () => { b.bx('stainless', -0.09, 0, -0.07, 0.09, 0.01, 0.07); });
    });
    // the desk lamp (head at the spot: 7.0, 6.6, −12.9), its shade glows with it
    b.detail(() => {
      b.cyl('plastic_dark', 6.85, top + 0.015, -12.42, 0.09, 0.03, 'y', 14);
      b.rod('stainless', 6.85, top + 0.03, -12.42, 6.78, 6.3, -12.55, 0.012, 6);
      b.rod('stainless', 6.78, 6.3, -12.55, 6.98, 6.66, -12.86, 0.011, 6);
      b.sphere('stainless', 6.78, 6.3, -12.55, 0.022, 8);
    });
    b.push(7.0, 6.6, -12.9, 0.38, -0.85);
    b.cyl('plastic_dark', 0, 0, 0, 0.075, 0.13, 'y', 14, 0.03);
    b.detail(() => b.cyl(lamp, 0, -0.066, 0, 0.068, 0.004, 'y', 14));
    b.pop();
    // her chair, pushed back; her hood draped over the back
    b.at(7.3, Y, -13.75, 0.35, () => {
      b.detail(() => {
        for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2; b.rod('stainless', 0, 0.06, 0, Math.sin(a) * 0.3, 0.04, Math.cos(a) * 0.3, 0.014, 5); }
        b.cyl('stainless', 0, 0.27, 0, 0.025, 0.42, 'y', 8);
      });
      b.bx('plastic_dark', -0.25, 0.46, -0.24, 0.25, 0.52, 0.24);
      b.rbox('plastic_dark', 0, 0.85, -0.25, 0.46, 0.55, 0.05, -0.12, 0, 0);
      b.sphere('tyvek', 0, 1.12, -0.26, 0.16, 10, 0.55, 1.3, 0.75);
      b.rbox('tyvek', 0, 0.98, -0.32, 0.36, 0.3, 0.03, 0.15, 0, 0);
      b.rbox('tyvek', 0, 1.0, -0.2, 0.3, 0.2, 0.02, -0.4, 0, 0);
    });

    // south wall: the whiteboard (CLASP — CONTROLLER = ?), the couch, a schematic poster of the Clasp
    const ink = canvasMat(L, 'd1a_pi_board', 1024, 512, (g, Wc, Hc) => {
      g.clearRect(0, 0, Wc, Hc);
      g.fillStyle = '#1d3f73'; g.font = `800 72px ${HAND}`; g.fillText('클라스프 — 제어자 = ?', 40, 100);
      g.strokeStyle = '#1d3f73'; g.lineWidth = 5;
      const box = (x: number, y: number, t: string) => { g.strokeRect(x, y, 170, 70); g.font = `600 34px ${HAND}`; g.fillText(t, x + 18, y + 47); };
      box(50, 170, 'host'); box(330, 170, '클라스프'); box(610, 170, 'link');
      const arrow = (x0: number, x1: number, y: number) => { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.lineTo(x1 - 16, y - 12); g.moveTo(x1, y); g.lineTo(x1 - 16, y + 12); g.stroke(); };
      arrow(225, 325, 205); arrow(505, 605, 205); arrow(785, 880, 205);
      g.font = `700 70px ${HAND}`; g.fillText('?', 900, 232);
      g.font = `600 32px ${HAND}`; g.fillText('"조언한다" — P-01…P-10은 시키지 않으면 먹지 않음', 50, 320);
      g.fillText('P-11 ✗   페어링 14.08 — 연기?', 50, 366);
      g.fillStyle = '#b01e1e'; g.font = `800 62px ${HAND}`; g.fillText('누가 대답하는가?', 560, 455);
      g.strokeStyle = '#b01e1e'; g.lineWidth = 9; g.beginPath(); g.ellipse(745, 435, 225, 66, -0.04, 0, PI * 2); g.stroke();
      g.beginPath(); g.ellipse(748, 438, 232, 62, -0.08, 0.3, PI * 1.9); g.stroke();
    });
    ink.transparent = true;
    onWall(b, '+z', -19.8, (u) => {
      const x = u(6.6), w = 2.4, h = 1.2, y = 1.5;
      b.bx('stainless', x - w / 2 - 0.02, y - h / 2 - 0.02, 0.002, x + w / 2 + 0.02, y + h / 2 + 0.02, 0.018);
      b.bx(paint(L, 0xf6f7f6, 0.15), x - w / 2, y - h / 2, 0.018, x + w / 2, y + h / 2, 0.022);
      b.bx('stainless', x - w / 2, y - h / 2 - 0.05, 0.02, x + w / 2, y - h / 2 - 0.03, 0.08);
      b.quad(ink, x, y, 0.022, w - 0.06, h - 0.06, '+z', 0, 'unit', 0.007);
      b.detail(() => { for (const [dx, c] of [[-0.9, 'plastic_dark'], [-0.8, 'plastic_dark']] as const) b.rod(c, x + dx, y - h / 2 - 0.025, 0.05, x + dx + 0.12, y - h / 2 - 0.025, 0.05, 0.008, 6); });
      // a schematic poster of the collar over the couch
      const sch = canvasMat(L, 'd1a_clasp_schematic', 512, 384, (g, Wc, Hc) => {
        g.fillStyle = '#f5f6f7'; g.fillRect(0, 0, Wc, Hc);
        g.fillStyle = '#4c6274'; g.fillRect(0, 0, Wc, 46);
        g.fillStyle = '#fff'; g.font = `800 24px ${SANS}`; g.fillText('클라스프 — 경부 인터페이스  (rev. 7)', 16, 31);
        g.strokeStyle = '#26323b'; g.lineWidth = 4;
        g.beginPath(); g.roundRect(150, 120, 210, 130, 30); g.stroke();
        g.beginPath(); g.moveTo(190, 250); g.lineTo(190, 300); g.moveTo(320, 250); g.lineTo(320, 300); g.stroke();
        g.fillStyle = '#e07b16'; g.beginPath(); g.arc(255, 160, 9, 0, PI * 2); g.fill();
        g.fillStyle = '#26323b'; g.font = `500 17px ${SANS}`;
        g.fillText('상태 LED', 380, 150); g.fillText('골진 접촉 패드', 380, 210); g.fillText('C3–C4 핀', 380, 296);
        g.fillText('호박색: 전원 켜짐, 미연결', 16, 340); g.fillText('빨간색 (점멸): 연결됨', 16, 364);
      });
      b.bx('stainless', u(9.8) - 0.42, 1.36, 0.002, u(9.8) + 0.42, 2.0, 0.014);
      b.quad(sch, u(9.8), 1.68, 0.02, 0.8, 0.6, '+z');
    });
    b.at(9.8, Y, -19.38, 0, () => {
      const V = paint(L, 0x3d4954, 0.42);
      b.bx('stainless', -1.0, 0, -0.38, 1.0, 0.12, 0.38);
      b.bx(V, -1.0, 0.12, -0.38, 1.0, 0.42, 0.38);
      b.rbox(V, 0, 0.66, -0.31, 2.0, 0.5, 0.14, -0.1, 0, 0);
      for (const s of [-1, 1]) b.bx(V, s * 1.0 - (s > 0 ? 0.12 : 0), 0.12, -0.38, s * 1.0 + (s < 0 ? 0.12 : 0), 0.6, 0.38);
      b.detail(() => { for (const s of [-1, 1]) b.rbox(V, s * 0.44, 0.47, 0.02, 0.84, 0.1, 0.6, 0, 0, 0); b.rbox(paint(L, 0xd8dadb, 0.8), -0.6, 0.53, 0.1, 0.45, 0.04, 0.32, 0.05, 0.4, 0); });
      b.collide(-1.0, 0, -0.38, 1.0, 0.6, 0.38, 'rubber', true);
    });
    // standing table (p4_pi_med on its top at 0.9): the consent paperwork in two piles
    b.at(10.5, Y, -13.5, 0, () => {
      b.bx(W, -0.4, 0.87, -0.4, 0.4, 0.9, 0.4);
      b.detail(() => { b.cyl('stainless', 0, 0.44, 0, 0.035, 0.86, 'y', 10); b.cyl('stainless', 0, 0.01, 0, 0.26, 0.02, 'y', 16); });
      b.collide(-0.4, 0, -0.4, 0.4, 0.9, 0.4, 'metal', true);
      b.detail(() => { for (const [x, z, n] of [[-0.2, -0.15, 6], [0.15, -0.2, 3]] as const) for (let i = 0; i < n; i++) b.rbox(paper(L), x + R.range(-0.01, 0.01), 0.902 + i * 0.002, z, 0.21, 0.0018, 0.297, 0, R.range(-0.08, 0.08), 0); });
    });
    // west wall north: a filing wall (binders); north-east: the empty coat hook and the empty badge holder
    b.at(4.2, Y, -13.25, PI / 2, () => filingWall(b, L, R, { len: 2.0, h: 2.0, fill: 0.8 }));
    onWall(b, '-x', 11.8, (u) => {
      b.bx('stainless', u(-13.3) - 0.25, 1.68, 0, u(-13.3) + 0.25, 1.72, 0.02);
      b.detail(() => { for (const dz of [-0.15, 0.15]) { b.rod('stainless', u(-13.3) + dz, 1.7, 0.02, u(-13.3) + dz, 1.7, 0.09, 0.008, 6); b.rod('stainless', u(-13.3) + dz, 1.7, 0.09, u(-13.3) + dz, 1.76, 0.11, 0.008, 6); } });
      b.bx('plastic_white', u(-13.95) - 0.06, 1.38, 0, u(-13.95) + 0.06, 1.55, 0.015);
      b.detail(() => b.sign('A. 순데', 'label', u(-13.95), 1.57, 0.002, 0.12, 0.03, '+z'));
    });
    clinicalSign(b, L, '[person] DR. A. SUNDE — PRINCIPAL INVESTIGATOR', 4.205, Y + 2.2, -18.75, 1.7, 0.18, '+x');
    b.sign('훈증 완료 — 월 08:41\n제거 금지', 'clinical', 11.784, Y + 1.5, -18.1, 0.32, 0.12, '-x', 0.02);
    strip(b, L, 4.3, -19.71, 11.7, -19.71);
  },
};

// ───────────────────────────────────────────────────────────── node2 (sealed, seen through its window only)

const node2: RoomDress = {
  label: false,
  look: { floor: 'ceiling_clean', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const R = rng(4601);
    const b = L.builder('node2_dress');
    const H = Y + 3.0;
    lit(L, [{ group: 'node2', type: 'point', p: [8, H - 0.5, -22], color: 0x40d8ff, i: 6, d: 7.5, prio: 1.0 }], []);
    // two rows of three racks facing a centre aisle that leads the eye to the screen on the west wall
    for (const x of [7.0, 7.62, 8.24]) {
      b.at(x, Y, -20.74, PI, () => serverRack(b, L, R));
      b.at(x, Y, -23.26, 0, () => serverRack(b, L, R));
    }
    // overhead cable ladders, a cooling unit in the north-east corner, the header plate under the screen
    for (const z of [-20.75, -23.25]) b.bx('stainless', 6.2, H - 0.62, z - 0.2, 11.8, H - 0.6, z + 0.2);
    // end-of-row panels facing the window: row label and a status strip
    for (const [z, row] of [[-20.74, '열 A'], [-23.26, '열 B']] as const) {
      b.bx('stainless', 8.54, Y, z - 0.535, 8.58, Y + 2.0, z + 0.535);
      b.detail(() => {
        b.sign(`노드 2 — ${row}`, 'label', 8.581, Y + 1.75, z, 0.5, 0.08, '+x');
        b.quad(rackLedMat(L), 8.582, Y + 1.5, z, 0.03, 0.6, '+x', 0, 'box');
      });
    }
    b.detail(() => {
      for (const z of [-20.75, -23.25]) for (let x = 6.4; x < 11.7; x += 0.3) b.bx('stainless', x, H - 0.62, z - 0.2, x + 0.03, H - 0.58, z + 0.2);
      for (const z of [-20.75, -23.25]) for (const x of [7.0, 7.62, 8.24]) b.bx('plastic_dark', x - 0.1, Y + 2.0, z - 0.08, x + 0.1, H - 0.62, z + 0.08);
    });
    b.bx(labWhite(L), 4.2, Y, -21.0, 5.6, Y + 1.9, -20.2);
    b.detail(() => { for (let k = 0; k < 8; k++) b.bx('plastic_dark', 4.3, Y + 1.0 + k * 0.1, -21.01, 5.5, Y + 1.04 + k * 0.1, -21.0); });
    onWall(b, '+x', 4.2, (u) => bezel(b, u(-22.0), 1.6, 1.6, 0.9, 0.04));
    clinicalSign(b, L, '노드 2 — 바이오시스', 4.205, Y + 0.95, -22.0, 1.0, 0.16, '+x');
  },
};

export const ENTRY_DRESS: Partial<Record<RoomId4, RoomDress>> = { lock4, gown, shower, corr_n, wetlab, pi_office, node2 };
