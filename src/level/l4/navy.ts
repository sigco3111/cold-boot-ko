/**
 * BIOLOGICAL SYSTEMS — the navy level and the tube plant (stage 3b §2.6, §2.7, §4.5; task D3a).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const NAVY_DRESS: Partial<Record<RoomId4, RoomDress>>
 * for the rooms lcorr, chk, guard, plant4. Per room: build(L) / lights / look / label as in entry.ts.
 * The shell already made (do NOT re-create): screens roster, booth_panel, tube_n_panel, plant_gauge; interactables
 *   term4_ctrl, booth_release, note4_guard, note4_bunk, valve4; markers mk4_booth, mk4_roster, mk4_gauge, mk4_sump;
 *   the booth (kerb, glass, posts, headers, roof, console — stand-ins), the cage mesh + colliders (gap x 36.6 … 38.2),
 *   pump sets A / B, pipe trunk, supply crate (stand-ins); `plant_sump_grille` (`userData.open('lift')`);
 *   `valve4_lever` (L.objects; a stand-in handle the dressing may hide and replace).
 * Vignettes this task defines (greybox placeholders exist until it does): `valve_open`, `plant_sump`.
 * Light group `plant_beacon` (off at load, the story switches it) stays as named.
 *
 * Look (§1 item 9): down the stair the clinical white gives way to the navy's old haze grey — a guarded threshold that
 * nobody guards any more. lcorr is Bio's service run (white process pipes on navy steel, an empty fire-axe bracket:
 * Eng took the axe); the checkpoint has stencils, deck lines, a booth with its console and a cold mug, a raised boom,
 * the roster in a steel bezel, and an armoury cage pried open (bent leaf, torn hasp, Eng and the axe at its door) —
 * lit from inside so the carbine and the vests read as the reward; the guard room keeps the sailors' things (made
 * bunks, a letter, photos, a calendar stopped in March); the tube plant is a wet machine room (diamond plate, puddles,
 * pipe runs, crane beam) built for a 25 s holdout: pump sets A / B flank the door lane (cover), a spare-motor pallet
 * in the north-east corner (crouch cover, door + sump in sight), the valve and the Δp gauge face the door 10 m away.
 *
 * Moving parts (all from state the story already writes — no new story hooks):
 *  - running: the `plant_beacon` light group is on, or `plant_gauge` reads `EQUALISING…` → the four pump couplings
 *    spin (striped, jittering), the starters' RUN lamps light; 3 s wind-down when it stops (as `pump_loop.stop(3)`);
 *  - the Δp dial needle follows the number on `plant_gauge` (`Δp x.x`, else `EQUALISING nn` → 3.1·nn/25, else 3.1);
 *  - the beacon dome is bound to the `plant_beacon` light (its `alarm` flicker) and spins while that light is on.
 *
 * Lights (§2.7, LOW = the `all` rows): every point sits in a fitting (caged bulkhead lamps, pendants) whose lens is
 * bound to its light; chk's `high` point became an `all` lamp inside the cage (the reward lit on LOW), so chk has 3
 * points on LOW (view (c): 5 ≤ 6); descriptor counts per room unchanged.
 */
import * as THREE from 'three';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import type { LightHandle } from '../../core/types';
import type { RoomId4 } from './grey';
import type { RoomDress } from './index';
import { artMat, canvasMat, isStandin, mug, officeChair, paint, paper, radio, restyle, kettle, desk3 } from '../l3/kit3';
import {
  ammoCan, bentLeaf, boom, booth, boothConsole, bunk, cageMesh, deckLine, gaugePanel, machinery, mat4, navyLockers,
  pipeTrunk, pumpSet, rotBeacon, stencil, sumpGrille, valveLever, weaponRack,
} from './kit4';
import { body } from './setpieces';

const PI = Math.PI;
const NAVY_L = 0xffe2c0, AMBER = 0xffa020, LAMP = 0xfff0d8;

// ───────────────────────────────────────────────────────────── shared bits

/** Old haze grey for the navy walls (the library's `navy_grey` reads near-white under these lamps). */
function hazeGrey(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd3a_haze_grey', () => { const m = L.ctx.materials.clone('navy_grey', { color: 0x8f989e }); m.name = 'd3a_haze_grey'; return m; });
}
/** Give a room the darker haze-grey walls (`look` is read when the grid is built, after every room's build). */
function hazeWalls(L: LevelBuild, d: RoomDress) { Object.assign(d.look!, { wall: hazeGrey(L) }); } // (index.ts copies the RoomDress, not its look)

type Glow = THREE.MeshStandardMaterial;

/** Point light + its private lens material (bound: it goes out with the light). */
function lamp(L: LevelBuild, group: string, x: number, y: number, z: number, i: number, d: number, o: { min?: 'medium' | 'high'; color?: number; prio?: number } = {}): { h: LightHandle; glow: Glow } {
  const h = L.point(group, x, y, z, o.color ?? NAVY_L, i, d, { priority: o.prio });
  if (o.min) h.desc.minQuality = o.min;
  return { h, glow: L.glow(h, 'emissive_warm', 0.22) };
}

/** Ceiling bulkhead lamp (navy: oval base, ribbed glass lens, wire guard) under a ceiling at `y`. */
function bulkhead(b: Builder, glow: Mat, x: number, y: number, z: number, ry = 0) {
  b.push(x, y, z, ry);
  b.bx('navy_grey', -0.2, -0.06, -0.12, 0.2, 0, 0.12);
  b.bx(glow, -0.16, -0.12, -0.08, 0.16, -0.06, 0.08);
  b.detail(() => {
    for (const s of [-1, 1]) b.rod('steel_raw', -0.18, -0.06, s * 0.1, 0.18, -0.06, s * 0.1, 0.006, 4);
    for (const u of [-0.1, 0, 0.1]) {
      b.rod('steel_raw', u, -0.06, -0.1, u, -0.135, -0.05, 0.005, 4).rod('steel_raw', u, -0.135, -0.05, u, -0.135, 0.05, 0.005, 4).rod('steel_raw', u, -0.135, 0.05, u, -0.06, 0.1, 0.005, 4);
    }
  });
  b.pop();
}

/** Pendant cage lamp (machine room): conduit from the ceiling at `y` down to a lamp `drop` below it. */
function pendant(b: Builder, glow: Mat, x: number, y: number, z: number, drop = 0.3) {
  b.rod('steel_raw', x, y, z, x, y - drop + 0.08, z, 0.016, 6);
  b.cyl('navy_grey', x, y - drop + 0.06, z, 0.12, 0.05, 'y', 12, 0.06);
  b.cyl(glow, x, y - drop - 0.02, z, 0.075, 0.12, 'y', 10);
  b.detail(() => { for (let k = 0; k < 4; k++) { const a = (k / 4) * PI * 2; b.rod('steel_raw', x + Math.cos(a) * 0.1, y - drop + 0.04, z + Math.sin(a) * 0.1, x + Math.cos(a) * 0.085, y - drop - 0.09, z + Math.sin(a) * 0.085, 0.005, 4); } });
}

/** Ceiling dock plate for a dormant sentry (visual only: the sentry docks by a ray to the ceiling collider). */
function sentryDock(b: Builder, x: number, y: number, z: number) {
  b.push(x, y, z, 0);
  for (const s of [-1, 1]) {
    b.bx('painted_dark', -0.36, -0.025, s * 0.36 - 0.03, 0.36, 0, s * 0.36 + 0.03);
    b.bx('painted_dark', s * 0.36 - 0.03, -0.025, -0.33, s * 0.36 + 0.03, 0, 0.33);
  }
  b.detail(() => {
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.bx('steel_raw', s * 0.36 - 0.04, -0.05, t * 0.36 - 0.04, s * 0.36 + 0.04, -0.025, t * 0.36 + 0.04);
    b.rod('rubber', 0.36, -0.01, 0, 0.9, -0.01, 0, 0.018, 5);
  });
  b.pop();
}

/**
 * Welded diamond wire mesh (galvanised) for the armoury cage — replaces the greybox's bar-grating look. 1 m tile, 16
 * diamonds; every mip level is drawn at its own resolution with ≥ 1 px wires, so the mesh greys out with distance
 * instead of dissolving under the alpha test.
 */
function weldMesh(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd3a_weld_mesh', () => {
    const levels: HTMLCanvasElement[] = [];
    for (let S = 512; S >= 1; S >>= 1) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d')!;
      const n = 16, p = S / n, lw = Math.max(1, (3 * S) / 512);
      g.strokeStyle = '#ffffff'; g.lineWidth = lw; g.lineCap = 'square';
      // (B4: a far mip of a 19 % wire mesh is mostly air — it must not turn into a solid grey wall that hides the issue
      // board: under the alpha test it drops out; the frame members still draw the cage)
      if (p < 6) { g.fillStyle = '#ffffff'; g.globalAlpha = 0.3; g.fillRect(0, 0, S, S); }
      else {
        for (let k = -n; k <= 2 * n; k++) {
          g.beginPath(); g.moveTo(k * p, 0); g.lineTo(k * p + S, S); g.stroke();
          g.beginPath(); g.moveTo(k * p, 0); g.lineTo(k * p - S, S); g.stroke();
        }
      }
      levels.push(c);
    }
    const t = new THREE.CanvasTexture(levels[0]);
    t.mipmaps = levels as unknown as THREE.CanvasTexture['mipmaps'];
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    const m = L.ctx.materials.clone('steel_raw', {
      map: t, color: 0xa4abaf, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: 0.45, metalness: 0.55,
      alphaTest: 0.45, side: THREE.DoubleSide, transparent: false,
    });
    m.name = 'd3a_weld_mesh';
    return m;
  });
}

/** Painted label-sheet on a canvas (orders, calendar, letter). */
function sheet(L: LevelBuild, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  return canvasMat(L, `d3a_${key}`, w, h, draw);
}
const type = (g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, weight = 400, color = '#222') => {
  g.fillStyle = color; g.font = `${weight} ${px}px "Courier New", monospace`; g.fillText(text, x, y);
};
function ordersMat(L: LevelBuild) {
  return sheet(L, 'orders', 256, 340, (g, W, H) => {
    g.fillStyle = '#ece6d2'; g.fillRect(0, 0, W, H);
    type(g, 'STANDING ORDERS', 18, 34, 22, 700);
    type(g, 'BIO CHECKPOINT 2', 18, 58, 16, 700);
    g.fillStyle = '#333'; g.fillRect(18, 68, W - 36, 2);
    g.fillStyle = 'rgba(40,40,40,0.75)';
    for (let i = 0; i < 12; i++) g.fillRect(18 + (i % 3 === 0 ? 0 : 14), 88 + i * 17, W - 50 - ((i * 37) % 70), 5);
    g.strokeStyle = '#1d3f73'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, 310); g.bezierCurveTo(160, 290, 180, 325, 230, 300); g.stroke();
  });
}
function letterMat(L: LevelBuild) {
  return sheet(L, 'letter', 200, 260, (g, W, H) => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,120,170,0.35)'; g.lineWidth = 1;
    for (let y = 30; y < H; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#22356b'; g.lineWidth = 1.6;
    g.fillStyle = '#22356b'; g.font = 'italic 600 18px "Segoe Script", "Comic Sans MS", cursive'; g.fillText('엄마 —', 14, 25);
    for (let i = 0; i < 8; i++) { g.beginPath(); const y = 45 + i * 18; g.moveTo(14, y); for (let x = 14; x < W - 16 - (i % 3) * 24; x += 5) g.lineTo(x, y + Math.sin(x * 0.8 + i * 3) * 2.2); g.stroke(); }
  });
}
function calendarMat(L: LevelBuild) {
  return sheet(L, 'calendar', 220, 300, (g, W, H) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#41526a'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#9fb3c8'; for (let i = 0; i < 6; i++) g.fillRect(14 + i * 34, 70 - (i % 3) * 14, 24, 40 + (i % 3) * 14); // a ship, abstract
    type(g, 'MARCH', 70, 148, 24, 700, '#203048');
    for (let d = 1; d <= 31; d++) {
      const c = (d + 4) % 7, r = Math.floor((d + 4) / 7);
      const x = 12 + c * 29, y = 170 + r * 24;
      type(g, String(d), x, y, 13, 400, '#333');
      if (d <= 8) { g.strokeStyle = '#a3221b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 2, y - 12); g.lineTo(x + 18, y + 4); g.moveTo(x + 18, y - 12); g.lineTo(x - 2, y + 4); g.stroke(); }
    }
  });
}
function watchBillMat(L: LevelBuild) {
  return sheet(L, 'watchbill', 256, 340, (g, W, H) => {
    g.fillStyle = '#e9e4d4'; g.fillRect(0, 0, W, H);
    type(g, 'WATCH BILL', 18, 32, 22, 700);
    type(g, 'CHECKPOINT 2 — FEB', 18, 54, 15, 700);
    g.fillStyle = '#333'; g.fillRect(18, 62, W - 36, 2);
    const names = ['BREKKE', 'SOLBERG', 'TVEIT', 'NILSEN', 'LUND', 'RISA', 'VIK', 'HOLTE', 'MYHRE', 'BAKKE', 'FJELD', 'SKOG'];
    names.forEach((n, i) => { type(g, `${String(i % 4 * 6).padStart(2, '0')}00`, 18, 86 + i * 20, 13); type(g, n, 80, 86 + i * 20, 13, 700); });
  });
}

/** A short pipe run through `pts` (rods + elbow spheres + flanges at the ends). */
function pipeRun(b: Builder, m: Mat, r: number, pts: [number, number, number][], flange: Mat = 'steel_raw') {
  for (let i = 0; i + 1 < pts.length; i++) b.rod(m, ...pts[i], ...pts[i + 1], r, r > 0.1 ? 14 : 10);
  for (let i = 1; i + 1 < pts.length; i++) b.sphere(m, ...pts[i], r * 1.02, 10);
  b.detail(() => {
    for (const k of [0, pts.length - 1]) {
      const [x, y, z] = pts[k], [nx, ny, nz] = pts[k === 0 ? 1 : k - 1];
      const ax = Math.abs(nx - x) > 1e-3 ? 'x' : Math.abs(ny - y) > 1e-3 ? 'y' : 'z';
      b.cyl(flange, x, y, z, r * 1.45, 0.04, ax, 14);
    }
  });
}

/** Fire axe (red head, yellow haft), lying flat; local: haft along +x from 0 to 0.9, head at the +x end. */
function fireAxe(b: Builder, L: LevelBuild) {
  const red = paint(L, 0xa3221b, 0.45), haft = paint(L, 0xc9a227, 0.5);
  b.cyl(haft, 0.42, 0.022, 0, 0.018, 0.84, 'x', 8);
  b.bx(red, 0.82, 0.008, -0.03, 0.9, 0.04, 0.03);
  b.rbox(red, 0.86, 0.022, 0.12, 0.08, 0.02, 0.2, 0, 0.12, 0);
  b.rbox('steel_raw', 0.86, 0.022, 0.225, 0.11, 0.021, 0.02, 0, 0.12, 0);
  b.rbox(red, 0.86, 0.022, -0.1, 0.04, 0.02, 0.15, 0, -0.1, 0);
}

/** Small CRT-style terminal on a stand (front +z). */
function terminal(b: Builder) {
  b.bx('painted_dark', -0.1, 0, -0.08, 0.1, 0.03, 0.08);
  b.bx('painted_dark', -0.03, 0.03, -0.03, 0.03, 0.12, 0.03);
  b.bx('plastic_dark', -0.27, 0.12, -0.12, 0.27, 0.48, 0.05);
  b.detail(() => b.bx('plastic_dark', -0.2, 0.17, -0.2, 0.2, 0.43, -0.12));
}

// ───────────────────────────────────────────────────────────── lcorr (x 4 … 24, z −63 … −59, h 3.2)

const lcorr: RoomDress = {
  label: false,
  look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    hazeWalls(L, lcorr);
    const b = L.builder('lcorr_dress');
    // lights in caged bulkheads (§2.7: 2 all + 1 medium)
    for (const [x, min] of [[8, undefined], [19.5, undefined], [13.5, 'medium']] as const) {
      const { glow } = lamp(L, 'lcorr', x, 2.72, -61, min ? 5 : 8, min ? 6 : 9, { min });
      bulkhead(b, glow, x, 3.2, -61, PI / 2);
    }
    // south wall: Bio's service runs on navy brackets (white process water, sea water, a red fire main)
    const sea = machinery(L), white = paint(L, 0xd9dcda, 0.45), fire = paint(L, 0x8a2a22, 0.5);
    b.cyl(white, 14, 2.95, -62.6, 0.07, 19.6, 'x', 10);
    b.cyl(sea, 14, 2.62, -62.5, 0.11, 19.6, 'x', 14);
    b.cyl(fire, 14, 2.35, -62.66, 0.06, 19.6, 'x', 10);
    for (let x = 5.2; x < 23.6; x += 2.4) {
      b.bx('steel_raw', x - 0.03, 2.2, -62.8, x + 0.03, 3.15, -62.74);
      b.bx('steel_raw', x - 0.03, 2.47, -62.8, x + 0.03, 2.5, -62.32);
      b.detail(() => { b.torus('steel_raw', x, 2.62, -62.5, 0.12, 0.008, 'x', 12); b.cyl('steel_raw', x, 2.95, -62.6, 0.085, 0.03, 'x', 12); });
    }
    b.detail(() => {
      for (const x of [9.6, 19.2]) {
        b.cyl('steel_raw', x, 2.62, -62.36, 0.025, 0.12, 'z', 6);
        b.torus(fire, x, 2.62, -62.29, 0.14, 0.012, 'z', 14);
        for (let k = 0; k < 3; k++) { const a = (k / 3) * PI * 2; b.rod(fire, x, 2.62, -62.29, x + Math.cos(a) * 0.14, 2.62 + Math.sin(a) * 0.14, -62.29, 0.008, 4); }
      }
      b.sign('BIO-SYS PROCESS WATER →', 'label', 7.0, 2.95, -62.525, 0.9, 0.07, '+z');
      b.sign('SEA WATER — TUBE PLANT →', 'label', 11.0, 2.62, -62.385, 0.95, 0.08, '+z');
      b.sign('FIRE MAIN', 'label', 16.8, 2.35, -62.595, 0.45, 0.06, '+z');
    });
    // north wall: cable tray over both doors
    b.bx('steel_raw', 4.2, 2.86, -59.62, 23.8, 2.88, -59.2);
    b.detail(() => {
      b.bx('steel_raw', 4.2, 2.86, -59.64, 23.8, 2.95, -59.62);
      for (let k = 0; k < 4; k++) b.cyl('rubber', 14, 2.905, -59.3 - k * 0.07, 0.025, 19.6, 'x', 6);
    });
    // the Bio sentry's ceiling dock (16.5, −61)
    sentryDock(b, 16.5, 3.2, -61);
    // emergency locker (south wall, x 19.7 … 20.7): `p4_lcorr_med` / `p4_lcorr_ammo` on its shelf (y 1.2)
    {
      const N = 'navy_grey', y0 = 0.85, y1 = 1.75, zf = -62.48, zw = -62.8;
      b.bx(N, 19.7, y0, zw, 20.7, y0 + 0.02, zf).bx(N, 19.7, y1 - 0.02, zw, 20.7, y1, zf);
      b.bx(N, 19.7, y0, zw, 19.72, y1, zf).bx(N, 20.68, y0, zw, 20.7, y1, zf);
      b.bx('painted_dark', 19.72, y0 + 0.02, zw, 20.68, y1 - 0.02, zw + 0.01);
      b.bx(N, 19.72, 1.18, zw + 0.01, 20.68, 1.195, zf);
      b.bx(N, 19.72, y1 - 0.09, zf - 0.02, 20.68, y1 - 0.02, zf); // header lip
      // the door swung right back along the wall (not a slab across the corridor)
      b.push(20.7, y0 + 0.01, zf, PI - 0.3);
      b.bx(N, -1.0, 0, 0, 0, y1 - y0 - 0.02, 0.02);
      b.pop();
      b.detail(() => b.sign('EMERGENCY LOCKER', 'stencil', 20.2, y1 - 0.04, zf + 0.002, 0.6, 0.05, '+z'));
      b.detail(() => b.sign('+  FIRST AID', 'label', 20.2, 1.85, -62.795, 0.5, 0.1, '+z'));
      b.collide(19.7, y0, zw, 20.7, y1, zf, 'metal', true);
    }
    // the empty fire-axe bracket by the stair (Eng took it): outline, two clips
    b.push(15.6, 1.45, -59.2, PI);
    b.bx(paint(L, 0xa3221b, 0.5), -0.5, -0.17, 0, 0.5, 0.17, 0.008);
    b.bx(paint(L, 0xd9d4c4, 0.6), -0.46, -0.13, 0.008, 0.46, 0.13, 0.012);
    b.detail(() => {
      b.sign('FIRE AXE', 'stencil', 0, 0.21, 0.004, 0.4, 0.07, '+z');
      for (const x of [-0.25, 0.2]) b.bx('steel_raw', x - 0.02, -0.03, 0.012, x + 0.02, 0.03, 0.05);
      b.bx(paint(L, 0x8c8a80, 0.6), -0.4, -0.012, 0.012, 0.3, 0.012, 0.017); // the haft's clean outline
      b.bx(paint(L, 0x8c8a80, 0.6), 0.3, -0.1, 0.012, 0.38, 0.1, 0.017);
    });
    b.pop();
    // stencils, wayfinding, the deck warning before the checkpoint
    b.detail(() => {
      b.sign('BIO-SYS SERVICE LEVEL — DECK 1', 'stencil', 8.5, 2.45, -59.205, 2.4, 0.16, '-z');
      b.sign('TRANSFER TUBE — POST 4 →', 'directional', 16.2, 1.95, -62.795, 2.4, 0.26, '+z');
      b.sign('FR 31', 'stencil', 4.205, 2.6, -62.0, 0.4, 0.14, '+x');
      b.sign('FR 36', 'stencil', 22.0, 2.45, -59.205, 0.4, 0.14, '-z');
      b.sign('NAVAL AREA — STOP AT CHECKPOINT', 'stencil', 21.6, 0.004, -61.0, 2.6, 0.32, '+y', -PI / 2);
    });
    deckLine(b, L, 4.4, -62.55, 23.6, -62.55, { w: 0.06 });
    b.detail(() => {
      b.decal('water_stain', 1, 11.0, 1.8, -62.795, 1.4, 1.1, '+z');
      b.decal('grime', 0, 5.5, 0.4, -59.205, 2.0, 0.8, '-z');
    });
  },
};

// ───────────────────────────────────────────────────────────── chk (x 24 … 40, z −67 … −55, h 4.0)

const chk: RoomDress = {
  label: false,
  look: { floor: 'deck_nonslip', wall: 'navy_grey', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    hazeWalls(L, chk);
    const b = L.builder('chk_dress');
    const glass = L.ctx.materials.get('glass'), grate = L.doubleSided('floor_grate'), trim = L.ctx.materials.get('trim_steel');
    // greybox stand-ins out (their colliders stay): booth blocks + panes, cage grating + frames
    restyle(L, 'chk_grey', isStandin, null);
    restyle(L, 'chk_grey', (m) => m === glass || m === grate || m === trim, null);

    // ── lights (§2.7: 2 points all, booth spot cast medium+, 1 more point — now the cage lamp, all) ──
    // (B7: the light points hang 0.45 m under their fittings — at 0.22 m the ceiling took a blown hot spot)
    const p1 = lamp(L, 'chk', 29.0, 3.4, -61.5, 12, 12);
    bulkhead(b, p1.glow, 29.0, 4.0, -61.5);
    // B4: inside the cage, over its door: the contents are lit and the mesh is back-lit (it reads as a screen you see
    // through, not a lit grey wall); its spill still lights Eng at the door
    const p2 = lamp(L, 'chk', 37.4, 3.5, -63.6, 13, 12);
    bulkhead(b, p2.glow, 37.4, 4.0, -63.6);
    const bs = L.spot('chk', 28.0, 2.5, -56.5, 28.0, 0.9, -56.0, LAMP, 6, 4, 1.1, { cast: true });
    bs.desc.minQuality = 'medium';
    const bsGlow = L.glow(bs, 'emissive_warm', 0.2);
    b.bx('navy_grey', 27.75, 2.55, -56.75, 28.25, 2.6, -56.25).bx(bsGlow, 27.8, 2.535, -56.7, 28.2, 2.55, -56.3);
    // the cage lamp (all qualities — the reward must read on LOW too; chk keeps 4 descriptors: 3 points + the spot)
    const cl = lamp(L, 'chk', 38.5, 3.45, -64.6, 8, 6, { color: LAMP });
    bulkhead(b, cl.glow, 38.5, 4.0, -64.6, PI / 2);

    // ── the booth (W9b kit on the greybox colliders: glass planes matched to the collider centres) ──
    b.at(27.98, 0, -56.78, 0, () => booth(b, L, { w: 3.96, d: 3.16, door: [-0.62, 0.38], collide: false }));
    b.at(28.0, 0, -55.2, PI, () => boothConsole(b, L, { collide: false }));
    // the controller terminal (term4_ctrl) stands on the desk in front of the riser; the release button proud of it
    b.at(27.2, 0.78, -55.66, PI, () => terminal(b));
    L.screen(null, 'terminal_idle', 0.46, 0.3, 27.2, 1.08, -55.715, '-z', { text: 'CLASP LINK ROSTER — POST 4 DETACHMENT' });
    b.push(28.8, 0, -55.2, PI);
    b.bx('painted_dark', -0.11, 0.9, 0.38, 0.11, 1.1, 0.44);
    b.cyl(paint(L, 0xb3261c, 0.35), 0, 1.0, 0.465, 0.045, 0.05, 'z', 14);
    b.detail(() => {
      for (const s of [-1, 1]) b.bx('steel_raw', s * 0.1 - 0.012, 0.92, 0.44, s * 0.1 + 0.012, 1.08, 0.5);
      b.sign('TUBE RELEASE', 'label', 0, 1.15, 0.445, 0.22, 0.04, '+z');
    });
    b.pop();
    // the medkit shelf over the terminal (`p4_booth_med` at y 1.3)
    b.bx('navy_grey', 26.5, 1.275, -55.86, 27.3, 1.295, -55.55);
    b.detail(() => b.rbox('navy_grey', 26.54, 1.2, -55.62, 0.015, 0.16, 0.1, 0.6, 0, 0));
    // what the last watch left: a mug, the pass log, a jacket on its hook, the chair pushed back
    b.at(28.5, 0.78, -55.72, 0, () => mug(b, L, 2));
    b.at(29.25, 0, -57.55, 2.6, () => officeChair(b, L, 0x2e3a4a));
    b.push(26.12, 1.75, -55.55, PI / 2);
    b.detail(() => {
      b.cyl('steel_raw', 0, 0, 0.03, 0.01, 0.06, 'z', 6);
      b.rbox(paint(L, 0x1f2b3d, 0.85), 0, -0.36, 0.08, 0.42, 0.66, 0.1, 0.05, 0, 0);
      b.rbox(paint(L, 0x1f2b3d, 0.85), 0, -0.05, 0.08, 0.2, 0.1, 0.12, 0, 0, 0);
    });
    b.pop();
    b.detail(() => {
      b.sign('ALL PERSONNEL SHOW PASS', 'warning', 25.985, 1.6, -55.85, 0.7, 0.32, '-x', 0, true);
      b.sign('STOP — SHOW PASS', 'stencil', 28.0, 0.62, -58.365, 1.4, 0.16, '-z');
    });
    sentryDock(b, 28.0, 4.0, -56.8);

    // ── the roster in a steel bezel (screen at z −55.22, 2.4 × 1.2) ──
    for (const [x0, y0, x1, y1] of [[31.9, 1.5, 34.5, 1.6], [31.9, 2.8, 34.5, 2.9], [31.9, 1.6, 32.0, 2.8], [34.4, 1.6, 34.5, 2.8]] as const) b.bx('painted_dark', x0, y0, -55.27, x1, y1, -55.2);
    b.detail(() => { for (const x of [32.05, 34.35]) for (const y of [1.55, 2.85]) b.cyl('steel_raw', x, y, -55.272, 0.012, 0.006, 'z', 6); });
    b.detail(() => { b.rod('steel_raw', 34.2, 2.88, -55.24, 34.2, 4.0, -55.24, 0.02, 6); b.decal('grime', 2, 33.2, 1.28, -55.205, 2.8, 0.4, '-z'); });

    // ── the boom (raised) by the tube door ──
    b.at(30.5, 0, -65.5, 0, () => boom(b, L, { angle: 65 }));

    // ── the armoury cage: weld mesh + navy frame on the greybox colliders, the bent leaf, contents ──
    const wm = weldMesh(L);
    const cb = L.builder('chk_cage');
    cageMesh(cb, L, { x0: 35.0, x1: 39.8, z0: -66.8, z1: -62.6, h: 3.995, faces: ['+z', '-x'], gaps: [['+z', 36.6, 38.2]], collide: false });
    cb.at(38.2, 0, -62.6, PI, () => bentLeaf(cb, L, { open: 2.5 }));
    // (the kit leaves the door gap open to the ceiling: mesh + head rail over it, on the greybox collider)
    cb.solid(() => cb.quad('floor_grate', 37.4, (2.28 + 3.995) / 2, -62.6, 1.6, 3.995 - 2.28, '+z', 0, 'box'));
    cb.bx('navy_grey', 36.6, 3.915, -62.625, 38.2, 3.995, -62.575);
    restyle(L, 'chk_cage', (m) => m === L.ctx.materials.get('floor_grate'), wm);
    b.detail(() => {
      b.sign('ARMOURY — ISSUE ON AUTHORITY ONLY', 'warning', 37.4, 2.75, -62.54, 1.4, 0.22, '+z', 0, true);
      b.decal('scratches', 1, 38.21, 1.15, -62.535, 0.07, 0.4, '+z');
      b.decal('scratches', 2, 36.59, 1.0, -62.535, 0.06, 0.3, '+z');
    });
    // padlock torn off, on the floor by the door
    b.detail(() => { b.box('gunmetal', 37.95, 0.02, -62.25, 0.06, 0.04, 0.03); b.torus('steel_raw', 37.95, 0.045, -62.25, 0.022, 0.005, 'z', 8); });
    // weapon rack (one carbine left: `p4_carbine` on the middle tier), vest hooks either side
    // B4: a pale issue board behind the rack and the vests — the carbine and the vests read as dark shapes on it from
    // the checkpoint door (they were black on haze grey), stencilled outlines of the missing rifles
    const board = paint(L, 0xc9cdc6, 0.7);
    b.bx(board, 39.79, 0.45, -66.1, 39.8, 2.15, -62.9);
    b.detail(() => {
      for (const z of [-63.95, -65.05]) b.bx('painted_dark', 39.786, 0.95, z - 0.012, 39.79, 2.0, z + 0.012);
      b.sign('ISSUE BOARD — SIGN FOR EVERY ITEM', 'stencil', 39.786, 2.05, -64.5, 1.6, 0.08, '-x');
    });
    b.at(39.8, 0, -64.5, -PI / 2, () => weaponRack(b, L));
    for (const z of [-63.4, -65.6]) {
      b.push(39.8, 1.45, z, -PI / 2);
      b.bx('navy_grey', -0.18, -0.04, 0, 0.18, 0.04, 0.02);
      b.rod('steel_raw', 0, 0, 0.02, 0, -0.02, 0.13, 0.012, 6).rod('steel_raw', 0, -0.02, 0.13, 0, 0.05, 0.17, 0.012, 6);
      b.detail(() => b.sign('BODY ARMOUR', 'stencil', 0, 0.3, 0.003, 0.5, 0.09, '+z'));
      b.pop();
    }
    b.detail(() => b.sign('SMALL ARMS', 'stencil', 39.795, 2.3, -64.5, 0.8, 0.13, '-x'));
    // shelving on the south wall (x 36.6 … 39.4): `p4_cage_ammo` on the 0.9 shelf; the rest emptied in March
    {
      const N = 'navy_grey', z0 = -66.8, z1 = -66.35;
      for (const x of [36.6, 38.0, 39.37]) b.bx(N, x, 0, z0, x + 0.03, 1.95, z0 + 0.03).bx(N, x, 0, z1 - 0.03, x + 0.03, 1.95, z1);
      for (const y of [0.37, 0.88, 1.39, 1.9]) b.bx(N, 36.6, y, z0, 39.4, y + 0.015, z1);
      b.detail(() => {
        b.at(37.0, 0.385, -66.58, 0.1, () => ammoCan(b, L, { open: true, label: null }));
        b.at(39.0, 1.405, -66.58, -0.15, () => ammoCan(b, L, { open: true, label: null }));
        b.at(36.95, 1.405, -66.58, 0.05, () => ammoCan(b, L, { open: true, label: null }));
        b.at(38.6, 1.915, -66.58, 0.2, () => ammoCan(b, L, { open: true, label: null }));
        b.sign('7.62 — ISSUE', 'stencil', 38.0, 1.1, -66.343, 0.5, 0.08, '+z');
      });
      b.collide(36.6, 0, z0, 39.4, 1.95, z1, 'metal', true);
    }
    // the plate crate (top 0.39): `p4_cage_plate`
    {
      const O = paint(L, 0x4d5545, 0.6);
      b.bx(O, 35.55, 0, -66.78, 36.45, 0.37, -66.0);
      b.bx('steel_raw', 35.53, 0.37, -66.8, 36.47, 0.39, -65.98);
      b.rbox(O, 36.0, 0.62, -66.74, 0.9, 0.5, 0.025, 0.12, 0, 0); // lid up against the wall
      b.detail(() => b.sign('ARMOUR PLATES', 'stencil', 36.0, 0.2, -65.995, 0.6, 0.08, '+z'));
      b.collide(35.53, 0, -66.8, 36.47, 0.39, -65.98, 'metal', true);
    }
    // Eng at the cage door (§2.6): on his side, suit peeled to the waist, the fire axe beside him
    // (pelvis (36.2, −62.32), not the plan's (37.4, −61.9): his 0.15 m walk box (x 35.35 … 37.26, z −62.47 … −61.54,
    // arms splayed toward the room) must not cover a nav node — the 1 m grid rows z −61.5 / −62.5 and W4's hand nodes
    // through the cage door at x 37.4 — so he lies along the mesh west of the gap, feet in the doorway)
    const eng = body(L, b, 'lying_side', 'Eng', { x: 36.2, y: 0, z: -62.32, ry: PI / 2, suitHalfOff: true });
    if (L.ctx.debug.verbose || eng.box.max.x > 37.3 || eng.box.max.z > -61.52 || eng.box.min.z < -62.48) console.warn('[l4 navy] Eng footprint', eng.box.min.x.toFixed(2), eng.box.max.x.toFixed(2), eng.box.min.z.toFixed(2), eng.box.max.z.toFixed(2));
    b.at(38.35, 0, -61.05, -0.55, () => fireAxe(b, L));
    b.detail(() => b.decal('scratches', 3, 37.4, 0.006, -62.3, 1.4, 0.5, '+y'));

    // ── stencils, deck lines, a bench ──
    b.detail(() => {
      b.sign('NAVAL CHECKPOINT 2', 'stencil', 24.205, 3.25, -61.0, 3.2, 0.36, '+x');
      b.sign('TRANSFER TUBE — POST 4', 'stencil', 32.0, 3.25, -66.795, 3.0, 0.3, '+z');
      b.sign('NAVAL SECURITY AREA', 'stencil', 37.4, 3.3, -55.205, 2.6, 0.3, '-z');
      b.sign('AUTHORISED PERSONNEL ONLY', 'warning', 39.795, 1.9, -61.6, 1.2, 0.32, '-x', 0, true);
      b.sign('FR 38', 'stencil', 24.205, 2.6, -65.8, 0.4, 0.14, '+x');
      b.sign('FR 44', 'stencil', 39.795, 3.1, -57.2, 0.4, 0.14, '-x');
      b.sign('WAIT HERE', 'stencil', 28.0, 0.004, -59.3, 1.4, 0.22, '+y');
    });
    deckLine(b, L, 25.2, -59.0, 30.8, -59.0, { w: 0.1 });
    deckLine(b, L, 29.7, -64.6, 34.3, -64.6, { w: 0.12, color: 'red' });
    for (const x of [30.0, 34.0]) deckLine(b, L, x, -64.5, x, -66.3, { w: 0.08 });
    deckLine(b, L, 24.4, -62.4, 34.6, -62.4, { w: 0.06, color: 'white' });
    {
      // a bench on the west wall south of the door (where the passes were checked)
      const N = 'navy_grey';
      b.bx(N, 24.2, 0.42, -66.3, 24.62, 0.46, -63.2);
      for (const z of [-66.1, -64.75, -63.4]) b.bx(N, 24.25, 0, z - 0.03, 24.57, 0.42, z + 0.03);
      b.collide(24.2, 0, -66.3, 24.62, 0.46, -63.2, 'metal', true);
    }
    b.detail(() => {
      b.decal('grime', 1, 32.0, 0.005, -61.0, 5.0, 3.0, '+y');
      b.decal('oil_stain', 0, 30.5, 0.006, -65.1, 0.8, 0.6, '+y');
    });
  },
};

// ───────────────────────────────────────────────────────────── guard (x 40 … 46, z −62 … −56, h 3.0)

const guard: RoomDress = {
  label: false,
  look: { floor: 'linoleum', wall: 'navy_grey', ceiling: 'navy_grey' },
  lights: [],
  build(L) {
    hazeWalls(L, guard);
    const b = L.builder('guard_dress');
    const { glow } = lamp(L, 'guard', 43, 2.52, -59, 8, 8);
    bulkhead(b, glow, 43, 3.0, -59, PI / 2);
    // two bunks along the south wall (the door lane z −59.9 … −58.1 stays clear)
    // (own colliders, not the kit's one box to the top rail: `note4_bunk` lies on the lower mattress and must be
    // usable from the room — the lower tier to 0.55, the upper tier 1.38 … 1.8, the end frames)
    for (const [x, made] of [[41.4, [true, false]], [44.0, [false, true]]] as const) {
      b.at(x, 0, -61.35, 0, () => bunk(b, L, { made: [...made], collide: false }));
      b.collide(x - 1.0, 0, -61.775, x + 1.0, 0.55, -60.925, 'rubber', true);
      b.collide(x - 1.0, 1.38, -61.775, x + 1.0, 1.8, -60.925, 'rubber', true);
      for (const e of [-1, 1]) b.collide(x + e * 0.98 - 0.03, 0, -61.775, x + e * 0.98 + 0.03, 1.8, -60.925, 'metal', true);
    }
    b.detail(() => {
      // Tveit's bunk: name tape, photos taped to the wall, the unsent letter on the blanket's foot (`note4_bunk`)
      b.sign('AB TVEIT J.', 'label', 40.395, 0.95, -61.35, 0.32, 0.06, '-x');
      b.quad(artMat(L, 'photo', 3), 40.9, 0.95, -61.795, 0.13, 0.1, '+z', 0.05);
      b.quad(artMat(L, 'photo', 7), 41.15, 0.93, -61.795, 0.1, 0.13, '+z', -0.08);
      b.quad(paper(L, 0xe9e2c8), 40.9, 1.005, -61.794, 0.04, 0.012, '+z', 0.05);
      b.quad(letterMat(L), 42.0, 0.528, -61.4, 0.2, 0.26, '+y', 0.35);
      b.quad(paper(L, 0xd9cfb4), 42.2, 0.526, -61.15, 0.22, 0.11, '+y', 0.3);
      // boots under the bunks, a kit bag on the upper bunk
      for (const [x, ry] of [[41.0, 0.1], [43.6, -0.2]] as const) b.at(x, 0, -60.85, ry, () => {
        for (const s of [-1, 1]) { b.rbox('rubber', s * 0.07, 0.02, 0, 0.1, 0.04, 0.29, 0, 0, 0); b.rbox(paint(L, 0x1c1c1e, 0.5), s * 0.07, 0.11, -0.05, 0.09, 0.16, 0.13, 0, 0, 0); }
      });
      b.cyl(paint(L, 0x26324a, 0.85), 44.3, 1.75, -61.4, 0.17, 0.7, 'x', 10);
    });
    // lockers (north wall), the ready-use cabinet: `p4_guard_plate` / `p4_guard_shells` on its top (0.9)
    b.at(41.45, 0, -56.2, PI, () => navyLockers(b, L, { n: 2, open: [1] }));
    {
      const N = 'navy_grey';
      b.bx(N, 43.6, 0, -56.7, 44.8, 0.88, -56.2);
      b.bx('steel_raw', 43.58, 0.88, -56.72, 44.82, 0.895, -56.2);
      b.detail(() => {
        b.bx(N, 43.62, 0.06, -56.71, 44.18, 0.84, -56.7).bx(N, 44.22, 0.06, -56.71, 44.78, 0.84, -56.7);
        for (const x of [44.12, 44.28]) b.bx('steel_raw', x - 0.015, 0.6, -56.73, x + 0.015, 0.72, -56.71);
        b.sign('READY USE', 'stencil', 44.2, 0.25, -56.715, 0.5, 0.09, '-z');
      });
      b.collide(43.58, 0, -56.72, 44.82, 0.895, -56.2, 'metal', true);
    }
    // the desk by the plant door (x 45.2 … 45.8, z −57.8 … −56.3); standing orders on the wall above (`note4_guard`)
    b.at(45.5, 0, -57.05, -PI / 2, () => desk3(b, 1.5, 0.6, 0.74, 'navy_grey', 'navy_grey', 'r'));
    b.at(44.8, 0, -57.3, PI / 2 + 0.3, () => officeChair(b, L, 0x2e3a4a));
    b.at(45.45, 0.74, -56.65, -PI / 2, () => radio(b, L));
    b.at(45.55, 0.74, -57.35, 0, () => mug(b, L, 0));
    kettle(b, 45.5, 0.74, -56.95);
    b.push(45.8, 1.5, -57.55, -PI / 2);
    b.bx('wood_dark', -0.19, -0.25, 0, 0.19, 0.25, 0.012);
    b.bx('steel_raw', -0.06, 0.2, 0.012, 0.06, 0.24, 0.025);
    b.quad(ordersMat(L), 0, -0.02, 0.019, 0.32, 0.42, '+z');
    b.pop();
    b.detail(() => {
      b.quad(calendarMat(L), 42.7, 1.6, -56.203, 0.32, 0.44, '-z');
      b.quad(watchBillMat(L), 45.795, 1.45, -60.5, 0.32, 0.42, '-x');
      b.sign('GUARD ROOM — CHECKPOINT 2', 'stencil', 40.205, 2.3, -60.9, 1.4, 0.16, '+x');
      b.sign('SECURITY IS EVERYONE\'S WATCH', 'warning', 42.7, 2.35, -56.205, 1.1, 0.3, '-z', 0, true);
    });
  },
};

// ───────────────────────────────────────────────────────────── plant4 (x 46 … 56, z −64 … −54, h 4.5)

const plant4: RoomDress = {
  label: false,
  look: { floor: 'floor_plate', wall: 'wall_panel', ceiling: 'ceiling_panel' },
  lights: [],
  build(L) {
    const b = L.builder('plant4_dress');
    restyle(L, 'plant4_grey', isStandin, null); // pumps, trunk, crate stand-ins (colliders stay)
    const P = machinery(L);

    // ── lights (§2.7): 2 pendants (all), gauge flood (cast, medium+), the amber beacon (alarm, off at load) ──
    const l1 = lamp(L, 'plant4', 49, 3.95, -59, 11, 10);
    pendant(b, l1.glow, 49, 4.5, -59);
    const l2 = lamp(L, 'plant4', 53.5, 3.95, -59, 11, 10);
    pendant(b, l2.glow, 53.5, 4.5, -59);
    const gs = L.spot('plant4', 54.2, 4.3, -59, 55.8, 2.3, -59, LAMP, 8, 4.5, 0.9, { cast: true });
    gs.desc.minQuality = 'medium';
    b.bx('painted_dark', 54.05, 4.36, -59.15, 54.35, 4.5, -58.85);
    b.rbox(L.glow(gs, 'emissive_warm', 0.18), 54.3, 4.34, -59, 0.04, 0.12, 0.22, 0, 0, -0.5);
    const beacon = L.point('plant_beacon', 55.55, 3.45, -59, AMBER, 8, 10, { flicker: 'alarm', enabled: false });

    // ── pump sets A / B (W9b), starters facing the door lane ──
    b.at(48.5, 0, -61.5, 0, () => pumpSet(b, L, { collide: false }));
    b.at(48.5, 0, -56.5, PI, () => pumpSet(b, L, { collide: false }));
    const run = mat4(L, 'd3a_run_lamp', () => { const m = L.ctx.materials.clone('emissive_green', { color: 0x2b4a30 }); m.emissiveIntensity = 0.05; return m; });
    for (const [x, z, ry] of [[47.23, -60.11, 0], [49.77, -57.89, PI]] as const) {
      b.push(x, 1.36, z, ry);
      b.cyl(run, 0, 0, 0.012, 0.025, 0.024, 'z', 10);
      b.detail(() => { b.cyl(paint(L, 0x5a1610, 0.4), 0.0, -0.08, 0.008, 0.02, 0.016, 'z', 10); b.sign('RUN', 'label', 0, 0.05, 0.002, 0.07, 0.025, '+z'); });
      b.pop();
    }
    // spinning couplings (moving parts): orange collar with a dark stripe + bolts on each pump train's shaft
    const couplings: THREE.Group[] = [];
    const orange: Mat = 'painted_orange';
    for (const [x, z] of [[48.85, -62.15], [48.85, -60.95], [48.15, -55.85], [48.15, -57.05]] as const) {
      const p = L.part(`plant4_coupling_${couplings.length}`);
      p.cyl(orange, 0, 0, 0, 0.135, 0.13, 'x', 16);
      p.bx('painted_dark', -0.068, -0.03, -0.137, 0.068, 0.03, 0.137);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; p.box('steel_raw', 0.066, Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.012, 0.022, 0.022); p.box('steel_raw', -0.066, Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.012, 0.022, 0.022); }
      const g = p.build();
      const mount = new THREE.Group();
      mount.name = `plant4_coupling_${couplings.length}`;
      mount.position.set(x, 0.55, z);
      mount.userData.rooms = ['plant4'];
      mount.add(g);
      L.root.add(mount);
      couplings.push(mount);
    }
    // risers from both headers up to the overhead runs, into the trunk
    pipeRun(b, P, 0.12, [[49.2, 1.5, -62.5], [49.2, 3.9, -62.5], [53.0, 3.9, -62.5], [53.0, 3.9, -56.6]]);
    pipeRun(b, P, 0.12, [[47.8, 1.5, -55.5], [47.8, 3.6, -55.5], [52.72, 3.6, -55.5], [52.72, 3.6, -55.85]]);
    b.collide(49.05, 1.6, -62.65, 49.35, 3.9, -62.35, 'metal', true);
    b.collide(47.65, 1.6, -55.65, 47.95, 3.6, -55.35, 'metal', true);
    for (const x of [50.5, 52.0]) b.detail(() => { b.bx('steel_raw', x - 0.03, 4.02, -62.56, x + 0.03, 4.5, -62.44); b.bx('steel_raw', x - 0.03, 3.72, -55.56, x + 0.03, 4.5, -55.44); });
    b.at(53.0, 0, -56.0, 0, () => pipeTrunk(b, L, { collide: false }));

    // ── east wall: Δp gauge board (+ needle), the beacon over it, the equalising valve (lever 1.08) under it ──
    let gauge!: ReturnType<typeof gaugePanel>;
    b.at(55.8, 2.4, -59.0, -PI / 2, () => { gauge = gaugePanel(b, L); });
    gauge.set(3.1);
    let bea!: ReturnType<typeof rotBeacon>;
    b.at(55.8, 3.37, -59.0, -PI / 2, () => { bea = rotBeacon(b, L, { bind: (m) => beacon.bindEmissive(m, 0.6) }); });
    let valve!: ReturnType<typeof valveLever>;
    b.at(55.8, -0.12, -59.0, -PI / 2, () => { valve = valveLever(b, L, { name: 'valve4_handle' }); });
    valve.set(0);
    const grey = L.objects.get('valve4_lever');
    if (grey) grey.parent?.remove(grey);
    L.objects.set('valve4_lever', valve.mount);
    b.detail(() => {
      b.sign('EQUALISE BEFORE EVERY TRANSFER', 'warning', 55.795, 1.55, -60.6, 0.9, 0.28, '-x', 0, true);
      b.sign('TUBE Δp — SEA', 'stencil', 55.795, 3.3, -60.6, 0.9, 0.12, '-x');
    });

    // ── the sump (52, −62): W9b hatch on the greybox walk box, the grey panel hidden ──
    let hatch!: ReturnType<typeof sumpGrille>;
    b.at(52.0, 0, -62.0, 0, () => { hatch = sumpGrille(b, L, { name: 'plant_sump_hatch' }); });
    // (detached, not hidden: the room visibility pass would show it again; its walk box stays in L.objects' userData)
    const gg = L.objects.get('plant_sump_grille');
    gg?.parent?.remove(gg);
    b.detail(() => b.sign('SUMP — KEEP CLEAR', 'stencil', 52.0, 0.004, -60.95, 1.2, 0.16, '+y'));

    // ── the supply chest by the valve (top 0.895): `p4_plant_plate`, `p4_plant_ammo`, `p4_plant_med` ──
    {
      const O = paint(L, 0x4d5545, 0.6);
      b.bx(O, 54.5, 0, -62.4, 55.5, 0.875, -61.3);
      b.bx('steel_raw', 54.48, 0.875, -62.42, 55.52, 0.895, -61.28);
      b.rbox(O, 55.68, 1.25, -61.85, 0.025, 0.72, 1.1, 0, 0, 0.12); // lid open against the wall
      b.detail(() => { b.sign('DAMAGE CONTROL — READY USE', 'stencil', 54.495, 0.5, -61.85, 0.9, 0.09, '-x'); b.sign('+', 'danger', 55.795, 2.0, -62.3, 0.22, 0.22, '-x'); });
    }
    // ── a spare motor on its pallet (NE corner, h 1.0): crouch cover with the door and the sump in sight ──
    {
      b.bx('wood_dark', 51.0, 0, -56.0, 52.2, 0.14, -54.8);
      b.cyl(P, 51.6, 0.5, -55.4, 0.34, 0.95, 'x', 16);
      b.cyl(P, 51.05, 0.5, -55.4, 0.3, 0.14, 'x', 16, 0.32);
      b.bx(P, 51.25, 0.14, -55.7, 51.95, 0.24, -55.1);
      b.bx(P, 51.45, 0.84, -55.55, 51.75, 1.0, -55.25);
      b.detail(() => { b.rod('steel_raw', 51.0, 0.14, -54.85, 52.2, 1.0, -54.85, 0.008, 4); b.sign('SPARE — PUMP MOTOR', 'stencil', 51.6, 0.07, -56.005, 0.9, 0.08, '-z'); });
      b.collide(51.0, 0, -56.0, 52.2, 1.0, -54.8, 'metal', true);
    }

    // ── crane beam with a parked chain block, stencils, the wet floor ──
    b.bx('steel_raw', 46.2, 4.3, -60.25, 55.8, 4.32, -60.05).bx('steel_raw', 46.2, 4.45, -60.25, 55.8, 4.47, -60.05).bx('steel_raw', 46.2, 4.32, -60.16, 55.8, 4.45, -60.14);
    b.detail(() => {
      b.bx('painted_yellow', 50.6, 4.18, -60.3, 51.0, 4.3, -60.0);
      b.rod('steel_raw', 50.8, 4.18, -60.15, 50.8, 3.1, -60.15, 0.01, 4);
      b.bx('painted_yellow', 50.7, 2.95, -60.22, 50.9, 3.1, -60.08);
      b.sign('SWL 2 T', 'stencil', 50.8, 4.38, -60.04, 0.3, 0.07, '+z');
    });
    b.detail(() => {
      b.sign('TUBE PLANT', 'stencil', 51.6, 2.6, -54.205, 2.6, 0.36, '-z');
      b.sign('PUMP SET A', 'stencil', 46.205, 2.2, -61.5, 1.0, 0.13, '+x');
      b.sign('PUMP SET B', 'stencil', 46.205, 2.2, -56.5, 1.0, 0.13, '+x');
      b.sign('HEARING PROTECTION MUST BE WORN', 'warning', 46.205, 3.0, -59.0, 1.4, 0.3, '+x', 0, true);
      b.sign('DANGER — SEA PRESSURE', 'danger', 54.0, 2.3, -54.205, 1.0, 0.3, '-z', 0, true);
      b.sign('FR 52', 'stencil', 55.795, 3.9, -63.0, 0.4, 0.14, '-x');
    });
    const wet = L.puddleMat();
    b.detail(() => {
      b.quad(wet, 51.6, 0.004, -63.25, 2.0, 0.9, '+y');
      b.quad(wet, 50.85, 0.004, -61.2, 0.8, 0.6, '+y', 0.3);
      b.quad(wet, 54.25, 0.004, -56.5, 0.8, 0.9, '+y', -0.3);
      b.decal('oil_stain', 1, 48.8, 0.006, -59.7, 1.2, 0.5, '+y');
      b.decal('oil_stain', 2, 48.3, 0.006, -58.3, 1.0, 0.5, '+y');
      b.decal('water_stain', 0, 55.795, 1.4, -56.3, 1.4, 2.4, '-x');
      b.decal('water_stain', 3, 52.4, 2.2, -63.795, 2.2, 3.0, '+z');
      b.decal('water_stain', 1, 49.3, 2.6, -54.205, 1.2, 2.0, '-z');
    });

    // ── vignettes (§4.5) ──
    L.vignette('valve_open', () => {
      L.tween(0, 0.9, (k) => valve.set(k < 0.15 ? 0.08 * (k / 0.15) : 0.08 + 0.92 * (1 - (1 - (k - 0.15) / 0.85) ** 2)));
      L.sfx('valve_pull', 55.5, 1.1, -59.0);
    });
    L.vignette('plant_sump', () => {
      const pb = gg?.userData.box as { enabled: boolean } | undefined;
      if (pb) pb.enabled = false;
      L.sfx('sump_lift', 52.0, 0, -62.0);
      L.tween(0, 0.8, (k) => hatch.lift(k < 0.2 ? 0.04 * (k / 0.2) : 0.04 + 0.96 * (1 - (1 - (k - 0.2) / 0.8) ** 3)));
    });

    // ── running state from what the story already drives: the beacon light and the gauge text ──
    const gaugeMat = L.screens.get('plant_gauge');
    let r = 0, needle = 3.1, t = 0;
    const target = () => {
      const s = String(gaugeMat?.userData.screenText ?? '');
      const dp = /Δp\s*(\d+(?:\.\d+)?)/.exec(s);
      if (dp) return Number(dp[1]);
      const eq = /EQUALISING\s*(\d+)/.exec(s);
      if (eq) return (3.1 * Math.min(25, Number(eq[1]))) / 25;
      return 3.1;
    };
    L.updaters.push((dt) => {
      t += dt;
      const on = beacon.enabled || /EQUALISING/.test(String(gaugeMat?.userData.screenText ?? ''));
      r = on ? Math.min(1, r + dt / 1.5) : Math.max(0, r - dt / 3);
      bea.set(beacon.enabled);
      run.emissiveIntensity = 0.05 + 0.9 * r;
      const w = 22 * r;
      for (let i = 0; i < couplings.length; i++) {
        const c = couplings[i];
        c.children[0].rotation.x += w * dt * (i % 2 ? 1 : 1.07);
        c.position.y = 0.55 + (r > 0.02 ? Math.sin(t * 93 + i * 1.7) * 0.0025 * r : 0);
      }
      needle += (target() + (r > 0.05 ? Math.sin(t * 37) * 0.04 * r : 0) - needle) * Math.min(1, dt * 4);
      gauge.set(needle);
    });
  },
};

export const NAVY_DRESS: Partial<Record<RoomId4, RoomDress>> = { lcorr, chk, guard, plant4 };
