/**
 * THE QUIET SIDE — south half (stage 3a §2.5, §2.6, §5; task P3c): the west stair, the canteen with its servery and
 * kitchen, the clinic, the Ring A quarters corridor, the BIOLOGICAL SYSTEMS outer lock and the ring-east stub.
 * Dressing only (rooms, doors, triggers, interactables, pickups and markers are the greybox's; see grey.ts).
 *
 * Warm and ordinary everywhere but the BIO lock: oak, carpet, tile, fabric, brass, plants, people's things left out.
 * The BIO lock is the one cold, clinical, navy-guarded room — white panels, a decon grate, purge nozzles, the
 * painted-over NAVAL SECURITY AREA, an empty rifle rack.
 *
 * Fights (§5.2): the canteen keeps two 1.8 m aisles from the stair door south and a clear 4 m lane from the garden
 * door west; nothing stands under the ceiling hatches H-A (−18, −41) / H-B (−14.5, −37.5) (their 1.2 m voids stay
 * open above the panels); the servery aisle (z −46 … −44.2) and its west gap stay empty for the kitchen husk; the
 * kitchen keeps x −22.4 … −19.6 clear round the spawn (−21, −47). Chairs, pram, airer, curtains have no colliders;
 * tables (0.74), the servery, cabinets, the vending machine, couches, a bench and pots do.
 *
 * Lights (§2.6, LOW = the first row of each room): warm, low, shaded fittings (fabric pendants, sconces) instead of
 * bare ceiling points — the canteen's glass front no longer shows white ceiling hot spots to the garden. The rooms'
 * emissive fixtures join the atrium lamp grid's takeover wave (`addFixture`, via `L.afterDoors`); they are not bound
 * to their lights. The BIO lock keeps its own power (not in the wave).
 *
 * Doors: `setDoorStyler` gives level 3's civilian doors the habitat leaf (doors.ts `style: 'habitat'`): veneered or
 * painted leaves with mouldings, glazed leaves in oak rails, cabin numbers, the child's drawing on A2 and the note on
 * A3 (they ride on the leaves). The pressure door, the shutter, the lift and the two BIO doors stay industrial.
 */
import * as THREE from 'three';
import { rng, type Builder } from '../builder';
import type { LevelBuild } from '../context';
import { setDoorStyler, type DoorSpec } from '../doors';
import { D2, STAIR_W, placeLights, stairLine, type LightRow, type RoomId3 } from './grey';
import type { RoomDress } from './index';
import {
  TINT, alongWall, artMat, bench3, cafeTable, canvasMat, childDrawingMat, curtain, defineLeaves, desk3, doorCasing,
  downlight, dryingRack, examCouch, eyeChartMat, fabric, filingCabinet, glassFront, isStandin, keyboard, kidScooter,
  kettle, mat3, medCabinet, mug, noticeBoard, nozzle, officeChair, paint, paper, papersFlat, pendant, pictureFrame,
  plantSmall, pottedPlant, pram, radio, restyle, shade, shoes, sideboard, stackChair, vendingMachine, vendingMat,
  visitorChair, wainscot, wallClock, wallSconce, wayfind,
} from './kit3';

const PI = Math.PI;
const Y = D2;
const WARM = 0xffd9b0, COLD = 0xc8e0ff, CURTAIN = 0xa9c6c4;
const isGlass = (L: LevelBuild) => (m: THREE.Material) => m === L.ctx.materials.get('glass');

// ───────────────────────────────────────────────────────────── shared: lamp-grid fixtures, door styles

const FIX = new WeakMap<LevelBuild, [THREE.MeshStandardMaterial, THREE.Vector3][]>();
/** Join an emissive fixture to the atrium lamp grid's takeover wave (hooked up once the atrium's fx exist). */
function fixture(L: LevelBuild, m: THREE.MeshStandardMaterial, x: number, y: number, z: number) {
  let a = FIX.get(L);
  if (!a) {
    FIX.set(L, (a = []));
    const list = a;
    L.afterDoors.push(() => {
      const lg = (L.objects.get('atrium_fx')?.userData as { lampGrid?: { addFixture(m: THREE.MeshStandardMaterial, p: THREE.Vector3, base?: number, em?: number): void } } | undefined)?.lampGrid;
      if (!lg) { console.warn('[l3 south] no atrium lamp grid: south fixtures stay lit at the takeover'); return; }
      const seen = new Set<THREE.Material>();
      for (const [mm, p] of list) { if (seen.has(mm)) continue; seen.add(mm); lg.addFixture(mm, p, mm.emissiveIntensity, 0); }
    });
  }
  a.push([m, new THREE.Vector3(x, y, z)]);
}

const CABINS: Record<string, { n: string; color: number }> = {
  d3_q1: { n: 'A 1', color: 0x6f8a7a }, d3_q2: { n: 'A 2', color: 0xc9a25a }, d3_q3: { n: 'A 3', color: 0x5d7088 },
  d3_q4: { n: 'A 4', color: 0x9a5a48 }, d3_q5: { n: 'A 5', color: 0x7d7a6c }, d3_q6: { n: 'A 6', color: 0x4f6a5e },
};
/** Level 3's civilian doors get habitat leaves (no chevrons); everything industrial stays as built. */
/** Frosted (acid-etched) glass: milky, opaque to the eye; `transparent` keeps the habitat leaf's glazed build. */
function frostedGlass(L: LevelBuild): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.clone('plastic_white', { color: 0xd3dcdb, map: null, normalMap: null, roughness: 0.42, metalness: 0, transparent: true, opacity: 1, depthWrite: true });
  m.name = 'd3_frosted_glass';
  return m;
}
function styleDoors(L: LevelBuild) {
  let frosted: THREE.MeshStandardMaterial | undefined;
  const veneer: Partial<DoorSpec> = { style: 'habitat', leafMat: 'wood_veneer' };
  setDoorStyler(L, (s) => {
    switch (s.id) {
      case 'd3_lobby': case 'd3_canteen_atr': case 'd3_quarters': return { style: 'habitat' };
      // (stage 3b B9: the clinic's glass is frosted — its portal is `see: false`, so a clear leaf showed the void where
      // the culled atrium should be; frosted = opaque to the eye, still the glazed habitat leaf)
      case 'd3_clinic': return { style: 'habitat', leafMat: frosted ??= frostedGlass(L) };
      case 'd3_lobby_inner': return { ...veneer, plates: [null, 'Staff'] };
      case 'd3_office': return { ...veneer, plates: ['P. Halvorsen', null] };
      case 'd3_stair_w': case 'd3_canteen': return { ...veneer, vision: true };
      case 'd3_kitchen': return { style: 'habitat', leafMat: paint(L, 0xe9e3d6, 0.45), plates: ['Staff only', null] };
      case 'd3_ring_e': return { style: 'habitat', leafMat: paint(L, 0x5a5550, 0.5) };
      default: break;
    }
    const cab = CABINS[s.id];
    if (!cab) return null;
    const north = s.z > -30; // north row: the corridor is on the door's −z side
    return {
      style: 'habitat', leafMat: paint(L, cab.color, 0.5), plates: north ? [null, cab.n] : [cab.n, null],
      leafDetail: s.id === 'd3_q2' ? childDrawing(L) : s.id === 'd3_q3' ? doorNote(L) : undefined,
    };
  });
}
/** A2 (Karlsen): the child's whale on the corridor face (−z) of the right-hand leaf. */
function childDrawing(L: LevelBuild) {
  return (b: Builder, side: -1 | 1) => {
    if (side !== 1) return;
    b.cast = false;
    b.quad(childDrawingMat(L), 0.42, 1.36, -0.054, 0.3, 0.225, '-z', 0.05);
    const tape = paper(L, 0xf3eed2);
    for (const [x, y] of [[0.29, 1.47], [0.56, 1.46]] as const) b.rbox(tape, x, y, -0.056, 0.06, 0.018, 0.002, 0, 0, 0.6);
  };
}
/** A3 (S. Vik): the note taped to the right-hand leaf (`note3_door`, world (23.35, 1.45, −28.09)). */
function doorNote(L: LevelBuild) {
  const note = canvasMat(L, 'door_note_vik', 160, 200, (g, W, H) => {
    g.fillStyle = '#f6efc8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1d3f73'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { g.beginPath(); const y = 26 + i * 19; g.moveTo(12, y); for (let x = 12; x < W - 14 - (i % 4) * 12; x += 6) g.lineTo(x, y + Math.sin(x * 0.7 + i * 2) * 2.4); g.stroke(); }
    g.fillStyle = '#1d3f73'; g.font = 'italic 700 20px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('시그리드 —', 12, 20);
  });
  return (b: Builder, side: -1 | 1) => {
    if (side !== 1) return;
    b.cast = false;
    b.quad(note, 0.35, 1.45, -0.054, 0.15, 0.19, '-z', -0.06);
    b.rbox(paper(L, 0xf3eed2), 0.35, 1.545, -0.056, 0.07, 0.02, 0.002, 0, 0, 0.1);
  };
}

/** A ceiling-mounted emergency light box (lens down) under a ceiling at y; its light sits inside it. */
function emergBox(b: Builder, x: number, y: number, z: number) {
  b.bx('plastic_white', x - 0.18, y - 0.075, z - 0.07, x + 0.18, y, z + 0.07);
  b.bx('plastic_dark', x - 0.15, y - 0.079, z - 0.05, x + 0.15, y - 0.075, z + 0.05);
  b.bx('emissive_green', x + 0.13, y - 0.05, z + 0.07, x + 0.16, y - 0.035, z + 0.074);
}

/** Place a room's rows; returns the handles. */
function lightsOf(L: LevelBuild, rows: LightRow[]) { return placeLights(L, rows); }

// ───────────────────────────────────────────────────────────── west stair

const stair_w: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    styleDoors(L);
    const R = rng(3701);
    const b = L.builder('stair_w_dress');
    defineLeaves(L);
    // the greybox steps become oak treads with a carpet runner and brass nosings
    restyle(L, 'stair_w_grey', isStandin, L.ctx.materials.get('wood_veneer'));
    // (every point light sits inside a closed shade or fitting: no bare light core in the haze)
    lightsOf(L, [
      { group: 'stair_w', type: 'point', p: [-17.5, 7.2, -22.4], color: WARM, i: 12, d: 13 },
      { group: 'stair_w', type: 'point', p: [-19.67, 2.15, -32.5], color: WARM, i: 5, d: 7, min: 'medium' },
      { group: 'stair_w_emerg', type: 'point', p: [-17.5, 7.45, -26.6], color: COLD, i: 6, d: 16, off: true }, // (I1: 3 → 6: the flight read black after the takeover)
    ]);
    const s = STAIR_W, top = 8.0;
    const run = shade(L, 'stair_pendant', 1.7, 0xffcf96), low = shade(L, 'stair_sconce', 1.6, 0xffcf96);
    // drum pendants over the head and the middle of the flight, downlights over the top landing, an emergency box
    pendant(b, L, run, -17.5, top, -22.4, 0.66, 0.34, TINT.cream);
    pendant(b, L, run, -17.5, top, -26.0, 0.9, 0.3, TINT.cream);
    fixture(L, run, -17.5, 7.0, -22.4);
    for (const z of [-17.4, -19.8]) downlight(b, run, -17.5, top, z, 0.07);
    emergBox(b, -17.5, top, -26.6);
    // treads: runner (x −18.3 … −16.7) on each tread and riser, brass nosing on the front edge
    const rx0 = -18.3, rx1 = -16.7, carpet = 'carpet';
    b.detail(() => {
      for (let k = 0; k < s.risers; k++) {
        const za = s.z0 + s.tread * k, zb = za + s.tread, y = s.rise * (k + 1);
        b.bx(carpet, rx0, y, za + 0.035, rx1, y + 0.008, zb);
        b.bx(carpet, rx0, y - s.rise + 0.008, za - 0.008, rx1, y - 0.025, za);
        b.bx('brass', s.x0 + 0.08, y - 0.025, za - 0.009, s.x1 - 0.08, y + 0.012, za + 0.035);
      }
    });
    // handrails on both walls, 0.9 above the pitch line, brackets every ~1.6 m, returns on the landings
    const { a, b: e } = stairLine(s);
    for (const [x, xw] of [[-19.72, -19.8], [-15.28, -15.2]] as const) {
      const p0 = new THREE.Vector3(x, a[1] + 0.9, a[2] - 0.35), p1 = new THREE.Vector3(x, e[1] + 0.9, e[2] + 0.35);
      b.rod('brass', x, p0.y, p0.z - 0.5, x, p0.y, p0.z, 0.022, 8);
      b.rod('brass', p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, 0.022, 8);
      b.rod('brass', x, p1.y, p1.z, x, p1.y, p1.z + 0.6, 0.022, 8);
      for (let t = 0.08; t <= 0.95; t += 0.21) {
        const q = p0.clone().lerp(p1, t);
        b.rod('brass', xw, q.y - 0.05, q.z, x, q.y - 0.02, q.z, 0.008, 5);
      }
    }
    // walls: oak wainscot on both landings
    alongWall(b, '+x', -19.8, Y, () => wainscot(b, 16.2, 22.0, 0.9, [[17.35, 19.65]]));
    alongWall(b, '-z', -16.2, Y, () => wainscot(b, 15.2, 19.8, 0.9));
    alongWall(b, '-x', -15.2, Y, () => wainscot(b, -22.0, -16.2, 0.9));
    alongWall(b, '+z', -33.8, 0, () => wainscot(b, -19.8, -15.2, 0.9, [[-18.65, -16.35]]));
    alongWall(b, '+x', -19.8, 0, () => wainscot(b, 31.0, 33.8, 0.9));
    alongWall(b, '-x', -15.2, 0, () => wainscot(b, -33.8, -31.0, 0.9));
    // door casings on the stair side
    doorCasing(b, L, { x: -20, y: Y, z: -18.5, wall: 'x', front: 'Facilities Offices', sides: [1] });
    doorCasing(b, L, { x: -17.5, z: -34, wall: 'z', front: 'Canteen', sides: [1] });
    // the fjord print on the top landing, the sea at the bottom; sconces at the bottom landing
    alongWall(b, '-x', -15.2, Y, () => pictureFrame(b, artMat(L, 'fjord', 21), -19.1, 1.65, 1.2, 0.85));
    alongWall(b, '+x', -19.8, 0, () => pictureFrame(b, artMat(L, 'seabed', 22), 32.4, 1.42, 0.75, 0.55));
    for (const [face, plane] of [['+x', -19.8], ['-x', -15.2]] as const) {
      alongWall(b, face, plane, 0, () => b.at(face === '+x' ? 32.5 : -32.5, 2.05, 0, 0, () => wallSconce(b, L, low)));
    }
    fixture(L, low, -17.5, 2.1, -32.5);
    pottedPlant(b, -15.65, Y, -16.65, 'palm', 1.0, R, 'stone_pale');
    wayfind(b, 'Canteen · Garden ↓', -17.5, Y + 2.3, -16.205, 1.6, 0.3, '-z');
    alongWall(b, '-x', -15.2, 0, () => wayfind(b, 'Facilities Offices ↑', -32.5, 2.75, 0.005, 1.5, 0.28, '+z'));
  },
};

// ───────────────────────────────────────────────────────────── canteen

/** Tables [x, z] (1.2 × 0.75, long axis x) — see the header for the lanes they keep. */
const TABLES: [number, number][] = [[-20.9, -36.0], [-20.9, -39.6], [-20.9, -42.15], [-17.9, -37.4], [-14.6, -35.35], [-13.9, -41.95]];

const canteen: RoomDress = {
  label: false,
  look: { floor: 'tile_ceramic', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    styleDoors(L);
    const R = rng(3801);
    const b = L.builder('canteen_dress');
    defineLeaves(L);
    restyle(L, 'canteen_grey', isStandin, null); // the counter stand-in (its collider stays; rebuilt below)
    restyle(L, 'canteen_grey', isGlass(L), glassFront(L));
    const hatchMat = paint(L, 0xe6dfd0, 0.6);
    for (const id of ['canteen_hatch_a', 'canteen_hatch_b']) L.objects.get(id)?.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = hatchMat; });
    // lights: low and shaded — the fill hangs among the pendants, well under the ceiling (no hot spot to the garden)
    lightsOf(L, [
      // (inside the drums of the pendants over tables 4, 1 and 6; the emergency lights inside their ceiling boxes)
      { group: 'canteen', type: 'point', p: [-17.9, 2.52, -37.4], color: 0xffd2a4, i: 7, d: 10, prio: 0.5 },
      { group: 'canteen', type: 'point', p: [-20.9, 2.52, -36.0], color: 0xffd2a4, i: 3.5, d: 6, min: 'medium', prio: 0.5 },
      { group: 'canteen', type: 'point', p: [-13.9, 2.52, -41.95], color: 0xffd2a4, i: 3.5, d: 6, min: 'medium', prio: 0.5 },
      { group: 'canteen_emerg', type: 'point', p: [-18, 3.1, -39.2], color: COLD, i: 3.5, d: 11, off: true },
      { group: 'canteen_emerg', type: 'point', p: [-13.6, 3.1, -35.8], color: COLD, i: 2.5, d: 7, min: 'medium', off: true },
    ]);
    const H = 3.6;
    const pend = shade(L, 'canteen_pendant', 1.25, 0xffc890);

    // ── walls: wainscot, cornice, the small viewport's oak surround and sill
    alongWall(b, '-z', -34.2, 0, () => wainscot(b, 12.2, 23.8, 0.75, [[16.35, 18.65]]));
    alongWall(b, '+x', -23.8, 0, () => wainscot(b, 34.2, 43.8, 0.7, [[35.25, 36.95]]));
    alongWall(b, '+z', -45.8, 0, () => wainscot(b, -23.8, -12.2, 0.75, [[-22.15, -19.85]]));
    b.bx('wood_dark', -23.8, H - 0.12, -45.8, -23.76, H - 0.02, -34.2).bx('wood_dark', -23.76, H - 0.12, -34.24, -12.2, H - 0.02, -34.2);
    b.bx('wood_dark', -23.76, H - 0.12, -45.8, -12.2, H - 0.02, -45.76);
    const vp = { z0: -42, z1: -37, y0: 0.8, y1: 3.0 };
    b.bx('wood_veneer', -23.8, vp.y0 - 0.02, vp.z0 - 0.1, -23.62, vp.y0 + 0.02, vp.z1 + 0.1); // sill
    b.bx('wood_dark', -23.8, vp.y1, vp.z0 - 0.1, -23.76, vp.y1 + 0.1, vp.z1 + 0.1);
    for (const z of [vp.z0 - 0.1, vp.z1]) b.bx('wood_dark', -23.8, vp.y0 + 0.02, z, -23.76, vp.y1, z + 0.1);
    b.detail(() => { b.at(-23.7, vp.y0 + 0.02, -41.2, 0, () => plantSmall(b, R)); b.at(-23.7, vp.y0 + 0.02, -37.8, 0, () => plantSmall(b, R, paint(L, 0xb85c3c, 0.6))); });

    // ── door casings on the canteen side
    doorCasing(b, L, { x: -17.5, z: -34, wall: 'z', back: 'West Stair · Offices', sides: [-1] });
    doorCasing(b, L, { x: -12, z: -39, wall: 'x', w: 2.4, back: 'Garden Atrium', sides: [-1] });
    doorCasing(b, L, { x: -21, z: -46, wall: 'z', front: 'Kitchen — staff only', sides: [1] });

    // ── ceiling: drum pendants over the tables, oak trims round the two hatches (their voids stay open)
    for (const [x, z] of TABLES) pendant(b, L, pend, x, H, z, 0.95, 0.24, TINT.mustard);
    fixture(L, pend, -18, 2.4, -39);
    emergBox(b, -18, H, -39.2); emergBox(b, -13.6, H, -35.8);
    for (const [cx, cz] of [[-18, -41], [-14.5, -37.5]] as const) {
      const o = 0.6, t = 0.06;
      b.bx('wood_dark', cx - o - t, H - 0.025, cz - o - t, cx + o + t, H, cz - o).bx('wood_dark', cx - o - t, H - 0.025, cz + o, cx + o + t, H, cz + o + t);
      b.bx('wood_dark', cx - o - t, H - 0.025, cz - o, cx - o, H, cz + o).bx('wood_dark', cx + o, H - 0.025, cz - o, cx + o + t, H, cz + o);
    }

    // ── servery (x −22.8 … −12.6, z −44.2 … −43.4; collider from the greybox, top raised to 0.95 here)
    const c = { x0: -22.8, x1: -12.6, z0: -44.2, z1: -43.4 };
    b.bx('wood_veneer', c.x0, 0.08, c.z0, c.x1, 0.9, c.z1);
    b.bx('painted_dark', c.x0 + 0.05, 0, c.z0 + 0.05, c.x1 - 0.05, 0.08, c.z1 - 0.06);
    b.bx('stone_pale', c.x0 - 0.04, 0.9, c.z0 - 0.04, c.x1 + 0.04, 0.95, c.z1 + 0.06);
    b.collide(c.x0 - 0.04, 0.9, c.z0 - 0.04, c.x1 + 0.04, 0.95, c.z1 + 0.06, 'concrete', true);
    b.detail(() => {
      for (let x = c.x0 + 0.15; x < c.x1 - 0.1; x += 0.3) b.bx('wood_dark', x - 0.02, 0.12, c.z1, x + 0.02, 0.86, c.z1 + 0.012);
      // staff side: cupboard doors with chrome pulls
      for (let x = c.x0 + 0.02; x < c.x1 - 0.5; x += 0.6) { b.bx('painted_white', x + 0.005, 0.12, c.z0 - 0.012, x + 0.595, 0.86, c.z0); b.bx('chrome', x + 0.25, 0.78, c.z0 - 0.03, x + 0.35, 0.795, c.z0 - 0.012); }
    });
    // tray slide on brackets (customer side)
    for (const z of [-43.27, -43.16]) b.rod('chrome', c.x0 + 0.2, 0.84, z, c.x1 - 0.2, 0.84, z, 0.012, 6);
    for (let x = c.x0 + 0.3; x < c.x1; x += 1.6) b.rod('chrome', x, 0.84, c.z1, x, 0.84, -43.16, 0.01, 5);
    const T = 0.95;
    // sneeze guard over the hot wells (x −19.0 … −15.9; clear of the two pickups at −19.5 and −15.0)
    for (const x of [-18.95, -17.45, -15.95]) b.rod('chrome', x, T, -43.78, x, 1.5, -43.62, 0.012, 6);
    b.push(-17.45, 1.42, -43.62, 0, -0.35);
    b.bx(glassFront(L), -1.55, -0.12, -0.006, 1.55, 0.12, 0.006);
    b.pop();
    b.detail(() => {
      for (const x of [-18.3, -17.45, -16.6]) {
        b.bx('steel_raw', x - 0.36, T, -44.05, x + 0.36, T + 0.012, -43.6);
        b.bx('painted_dark', x - 0.32, T + 0.012, -44.0, x + 0.32, T + 0.017, -43.65);
      }
      // trays (clean, stacked), cutlery, napkins at the west end; the till at the east end
      b.at(-22.25, T, -43.82, 0, () => { for (let i = 0; i < 9; i++) b.bx(paint(L, 0x8a5a3a, 0.4), -0.2, i * 0.013, -0.15, 0.2, i * 0.013 + 0.011, 0.15); });
      b.at(-21.55, T, -43.85, 0.1, () => { b.bx('chrome', -0.18, 0, -0.1, 0.18, 0.1, 0.1); for (let i = 0; i < 3; i++) b.bx('painted_dark', -0.16 + i * 0.11, 0.1, -0.08, -0.07 + i * 0.11, 0.102, 0.08); });
      b.at(-21.05, T, -43.8, -0.2, () => { b.bx('chrome', -0.07, 0, -0.06, 0.07, 0.12, 0.06); b.bx(paper(L), -0.06, 0.12, -0.05, 0.06, 0.135, 0.05); });
      b.at(-19.95, T, -43.86, 0.25, () => radio(b, L));
      b.at(-13.4, T, -43.85, 0, () => {
        b.rbox('plastic_dark', 0, 0.06, 0, 0.36, 0.12, 0.3, 0, 0, 0);
        b.rbox('plastic_dark', 0, 0.2, -0.08, 0.3, 0.16, 0.04, -0.3, 0, 0);
        b.rbox('screen_off', 0, 0.2, -0.057, 0.26, 0.12, 0.004, -0.3, 0, 0);
      });
      b.at(-14.2, T, -43.75, 0, () => { mug(b, L, 1); });
      b.at(-16.2, T, -43.62, 0.3, () => { for (let i = 0; i < 6; i++) b.cyl(paint(L, 0xf2efe6, 0.25), 0.0, 0.006 + i * 0.012, 0, 0.12, 0.01, 'y', 16); });
    });
    // the kitchen hatch (roller shutter down) and the tray return shelf, south wall east of the kitchen door
    b.bx('wood_dark', -19.6, 0.96, -45.8, -18.3, 1.95, -45.76);
    b.detail(() => { for (let y = 1.0; y < 1.9; y += 0.06) b.bx('trim_steel', -19.52, y, -45.76, -18.38, y + 0.05, -45.752); });
    b.bx('chrome', -19.65, 0.93, -45.8, -18.25, 0.96, -45.55);
    wayfind(b, 'Trays & cutlery here — thank you!', -18.95, 2.15, -45.795, 1.5, 0.22, '+z');
    // chalk menu over the servery
    const menu = canvasMat(L, 'canteen_chalk', 512, 288, (g, W, Hh) => {
      g.fillStyle = '#1f2421'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#f2ead8'; g.textAlign = 'center'; g.font = '700 40px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('오늘', W / 2, 52);
      g.font = '500 30px "Marker Felt", "Comic Sans MS", sans-serif';
      g.fillText('생선 수프 ........ 3.20', W / 2, 110); g.fillText('렌즈콩 카레 ...... 2.80', W / 2, 152);
      g.fillStyle = '#d9a75a'; g.font = '500 24px "Marker Felt", "Comic Sans MS", sans-serif';
      g.fillText('빵과 버터  ·  과일  ·  차 / 커피', W / 2, 200); g.fillStyle = '#c9e0c0'; g.fillText('목요일: 당근 케이크 (퀴즈의 밤!)', W / 2, 246);
    });
    alongWall(b, '+z', -45.8, 0, () => { b.bx('wood_dark', -17.45, 1.72, 0.0, -14.15, 2.68, 0.03); b.quad(menu, -15.8, 2.2, 0.036, 3.2, 0.88, '+z'); });
    // the canteen_menu screen in a wood bezel (north wall), a wall clock
    alongWall(b, '-z', -34.2, 0, () => {
      b.bx('wood_dark', 13.82, 2.11, 0.0, 15.18, 2.15, 0.03).bx('wood_dark', 13.82, 2.85, 0.0, 15.18, 2.89, 0.03);
      b.bx('wood_dark', 13.82, 2.15, 0.0, 13.86, 2.85, 0.03).bx('wood_dark', 15.14, 2.15, 0.0, 15.18, 2.85, 0.03);
      b.at(20.0, 2.6, 0, 0, () => wallClock(b, L, 0.17, 10, 40));
      // notice board (note3_canteen) with the kitchen's handwritten note; the quiz poster (note3_quiz)
      noticeBoard(b, L, 22.0, 1.6, 0.8, 0.62, R, 6);
      b.quad(paper(L, 0xf4e7a6), 22.15, 1.52, 0.03, 0.2, 0.24, '+z', -0.05, 'unit', 0.004);
      const quiz = canvasMat(L, 'canteen_quiz', 256, 352, (g, W) => {
        g.fillStyle = '#2f5f8a'; g.fillRect(0, 0, W, 352);
        g.fillStyle = '#f2c230'; g.textAlign = 'center'; g.font = '800 34px Arial'; g.fillText('목요일', W / 2, 60); g.fillText('퀴즈의 밤', W / 2, 100);
        g.fillStyle = '#f4efe2'; g.font = '600 20px Arial'; ['Teams of four', 'Prize: a day on', 'the surface rota', '', 'Question master:', 'Halvorsen'].forEach((t, i) => g.fillText(t, W / 2, 160 + i * 28));
        g.fillStyle = '#f2c230'; g.font = 'italic 600 16px Arial'; g.fillText('CHOIR에게 묻기 금지.', W / 2, 336);
      });
      pictureFrame(b, quiz, 20.9, 1.6, 0.42, 0.58, 'chrome', false);
    });

    // ── tables and chairs (chairs: no colliders); a little of the day left on them
    const shell = paint(L, 0xb98a5a, 0.45), pad = fabric(L, TINT.rust);
    TABLES.forEach(([x, z], i) => {
      b.at(x, 0, z, 0, () => cafeTable(b, 1.2, 0.75));
      const seats: [number, number, number][] = [[-0.3, 0.6, PI], [0.32, 0.62, PI], [-0.31, -0.62, 0], [0.3, -0.6, 0]];
      seats.forEach(([dx, dz, ry], k) => {
        const pulled = (i + k) % 5 === 0 ? 0.25 : 0;
        b.at(x + dx + R.range(-0.04, 0.04), 0, z + dz + Math.sign(dz) * pulled, ry + R.range(-0.18, 0.18) + (pulled ? 0.4 : 0), () => stackChair(b, shell, k % 2 ? pad : null));
      });
      const top = 0.74;
      b.detail(() => {
        // napkin holder, salt & pepper in the middle of every table
        b.at(x + 0.05, top, z, 0, () => { b.bx('chrome', -0.05, 0, -0.03, 0.05, 0.09, 0.03); b.bx(paper(L), -0.045, 0.012, -0.02, 0.045, 0.085, 0.02); });
        b.cyl(paint(L, 0xf2efe6, 0.3), x - 0.08, top + 0.04, z, 0.016, 0.08, 'y', 8);
        b.cyl(paint(L, 0x3a3634, 0.3), x - 0.12, top + 0.04, z + 0.02, 0.016, 0.08, 'y', 8);
        if (i === 1) { // a tray left with a mug and a plate
          b.at(x + 0.3, top, z - 0.12, 0.2, () => { b.bx(paint(L, 0x8a5a3a, 0.4), -0.2, 0, -0.15, 0.2, 0.012, 0.15); b.at(-0.06, 0.012, 0, 0, () => mug(b, L, 2)); b.cyl(paint(L, 0xf2efe6, 0.25), 0.08, 0.018, 0.02, 0.1, 0.012, 'y', 16); });
        }
        if (i === 3) { // the crossword, folded, with a pen
          b.at(x - 0.28, top, z + 0.1, -0.4, () => { b.bx(paper(L, 0xe9e4d6), -0.15, 0.002, -0.2, 0.15, 0.006, 0.2); b.quad(artMat(L, 'map', 31), 0, 0.007, 0.06, 0.16, 0.14, '+y', 0, 'unit', 0.001); });
          b.rbox('plastic_dark', x - 0.06, top + 0.012, z + 0.18, 0.14, 0.008, 0.008, 0, 0.7, 0);
          b.at(x + 0.3, top, z - 0.15, 0, () => mug(b, L, 0));
        }
        if (i === 4) { // a birthday card standing open, a bud vase
          b.at(x + 0.25, top, z + 0.05, 0.3, () => { b.rbox(paper(L, 0xe6c3c0), -0.055, 0.075, 0, 0.12, 0.15, 0.002, 0, 0.35, 0); b.rbox(paper(L, 0xf2efe6), 0.055, 0.075, 0, 0.12, 0.15, 0.002, 0, -0.35, 0); });
          b.cyl(glassFront(L), x - 0.3, top + 0.07, z - 0.05, 0.025, 0.14, 'y', 10);
          b.rod('bark', x - 0.3, top + 0.1, z - 0.05, x - 0.31, top + 0.3, z - 0.04, 0.003, 4);
          b.sphere(paint(L, 0xd8a83a, 0.6), x - 0.31, top + 0.3, z - 0.04, 0.025, 8);
        }
        if (i === 0) b.at(x, top, z, 0, () => papersFlat(b, L, 2, 0.2, R));
      });
    });
    // a cardigan over a chair back (table 2)
    b.detail(() => b.rbox(fabric(L, TINT.sage), -20.6, 0.72, -39.0 + 0.04, 0.4, 0.36, 0.05, -0.12, 0, 0.05));

    // ── vending machine + drinks fridge on the west wall (north of the viewport)
    // (I1: 0.9 / 0.7 read as two white-hot bars with bloom through the canteen glass from the gallery and the garden)
    const vend = vendingMat(L, 0.32);
    b.at(-23.42, 0, -35.75, PI / 2, () => vendingMachine(b, vend, paint(L, 0x8a2f2a, 0.45)));
    fixture(L, vend, -23.0, 1.2, -35.75);
    const fridgeGlow = canvasMat(L, 'canteen_fridge', 128, 256, (g, W, Hh) => {
      g.fillStyle = '#e8f0f2'; g.fillRect(0, 0, W, Hh);
      const cols = ['#c0392b', '#3f7a58', '#f2f2f2', '#e2b65c', '#2e6fa8'];
      for (let r = 0; r < 4; r++) { g.fillStyle = '#b8c4c8'; g.fillRect(0, 60 + r * 60, W, 3); for (let c = 0; c < 6; c++) { g.fillStyle = cols[(r + c * 2) % cols.length]; g.fillRect(8 + c * 20, 22 + r * 60, 13, 38); } }
    }, 0.28);
    b.at(-23.47, 0, -36.58, PI / 2, () => {
      b.bx('plastic_white', -0.3, 0, -0.32, 0.3, 1.85, 0.3);
      b.bx('chrome', -0.29, 0.06, 0.3, 0.29, 1.8, 0.32);
      b.quad(fridgeGlow, 0, 0.95, 0.325, 0.5, 1.6, '+z');
      b.bx('chrome', 0.22, 0.8, 0.32, 0.24, 1.3, 0.345);
      b.collide(-0.3, 0, -0.32, 0.3, 1.85, 0.345, 'metal', true);
    });
    fixture(L, fridgeGlow, -23.1, 1.0, -36.58);
    L.marker('canteen_vending', -23.0, 1.0, -35.75).userData.glow = vend;
    L.marker('canteen_fridge', -23.1, 1.0, -36.58).userData.glow = fridgeGlow;
    // plants, a coat stand by the stair door
    pottedPlant(b, -23.4, 0, -34.7, 'palm', 1.0, R, 'stone_pale');
    pottedPlant(b, -12.7, 0, -34.75, 'fig', 1.1, R, paint(L, 0xb85c3c, 0.6));
    b.at(-19.4, 0, -34.55, 0, () => {
      b.cyl('wood_dark', 0, 0.015, 0, 0.2, 0.03, 'y', 12);
      b.rod('wood_dark', 0, 0.03, 0, 0, 1.75, 0, 0.02, 6);
      for (let i = 0; i < 4; i++) { const a2 = (i / 4) * PI * 2 + 0.4; b.rod('wood_dark', 0, 1.62, 0, Math.sin(a2) * 0.16, 1.72, Math.cos(a2) * 0.16, 0.01, 5); }
      b.rbox(fabric(L, TINT.slate), 0.1, 1.28, 0.08, 0.32, 0.7, 0.1, 0.05, 0.6, 0.08);
      b.collide(-0.2, 0, -0.2, 0.2, 1.75, 0.2, 'concrete', true);
    });
    alongWall(b, '+x', -23.8, 0, () => pictureFrame(b, artMat(L, 'photo', 33), 43.0, 1.75, 0.5, 0.38));
  },
};

// ───────────────────────────────────────────────────────────── kitchen (seen only through d3_kitchen)

const kitchen: RoomDress = {
  label: false,
  look: { floor: 'tile_ceramic', wall: 'tile_ceramic', ceiling: 'painted_white' },
  // IB5b (3b carry-over B8): pitch black after the takeover with the lamp off — the night strip under the shelf
  // gives a dim pool, on the canteen's emergency circuit (the story switches `canteen_emerg` at the takeover)
  lights: [{ group: 'canteen_emerg', type: 'point', p: [-21.0, 1.45, -47.45], color: 0xffc890, i: 0.9, d: 4, prio: 0.4, off: true }],
  build(L) {
    const b = L.builder('kitchen_dress');
    const R = rng(3851);
    // range at the west end, sink worktop at the east end (x −22.4 … −19.6 stays clear round the spawn)
    b.bx('steel_raw', -23.8, 0.08, -47.8, -22.55, 0.9, -47.15);
    b.bx('painted_dark', -23.75, 0, -47.75, -22.6, 0.08, -47.2);
    b.bx('painted_dark', -23.8, 0.9, -47.8, -22.55, 0.93, -47.15);
    b.detail(() => {
      for (const [x, z] of [[-23.45, -47.35], [-22.9, -47.35], [-23.45, -47.62], [-22.9, -47.62]] as const) b.cyl('painted_dark', x, 0.935, z, 0.1, 0.01, 'y', 14);
      b.cyl('steel_raw', -23.45, 1.06, -47.35, 0.15, 0.24, 'y', 16);
      b.bx('chrome', -23.7, 0.3, -47.15, -22.65, 0.75, -47.13);
    });
    b.collide(-23.8, 0, -47.8, -22.55, 0.93, -47.15, 'metal', true);
    b.bx('steel_raw', -23.85, 1.9, -47.8, -22.5, 2.3, -47.25); // hood
    b.bx('steel_raw', -19.45, 0.08, -47.8, -18.2, 0.9, -47.2);
    b.bx('chrome', -19.5, 0.9, -47.8, -18.2, 0.93, -47.15);
    b.detail(() => {
      b.bx('painted_dark', -19.1, 0.926, -47.65, -18.5, 0.936, -47.3);
      b.rod('chrome', -18.8, 0.93, -47.75, -18.8, 1.2, -47.75, 0.012, 6);
      b.rod('chrome', -18.8, 1.2, -47.75, -18.8, 1.18, -47.55, 0.011, 6);
      kettle(b, -19.25, 0.93, -47.4);
    });
    b.collide(-19.5, 0, -47.8, -18.2, 0.93, -47.15, 'metal', true);
    // open shelves over the middle (above head height of the spawn lane: depth 0.28)
    for (const y of [1.55, 1.95]) b.bx('steel_raw', -22.4, y - 0.02, -47.8, -19.6, y, -47.52);
    b.detail(() => {
      for (let x = -22.3; x < -19.7; x += R.range(0.18, 0.3)) {
        if (R.chance(0.5)) for (let k = 0; k < 5; k++) b.cyl(paint(L, 0xf2efe6, 0.25), x + 0.1, 1.56 + k * 0.012, -47.66, 0.1, 0.01, 'y', 14);
        else b.cyl(R.chance(0.5) ? 'steel_raw' : 'chrome', x + 0.08, 1.96 + 0.09, -47.66, 0.09, 0.18, 'y', 12);
      }
    });
    // a night strip under the lower shelf (what the canteen sees when the door opens) and the green exit sign
    b.bx(shade(L, 'kitchen_night', 0.9, 0xffc890), -22.3, 1.515, -47.76, -19.7, 1.53, -47.72);
    const exit = mat3(L, 'kitchen_exit', () => L.ctx.materials.clone('emissive_green', { emissiveIntensity: 0.9 }));
    b.bx(exit, -21.3, 2.78, -46.215, -20.7, 2.92, -46.2);
  },
};

// ───────────────────────────────────────────────────────────── clinic

const clinic: RoomDress = {
  label: false,
  look: { floor: 'linoleum', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    styleDoors(L);
    const R = rng(3901);
    const b = L.builder('clinic_dress');
    defineLeaves(L);
    lightsOf(L, [
      // (inside the ceiling luminaires / the emergency box: no bare light core in the haze)
      { group: 'clinic', type: 'point', p: [14.6, 2.66, -19.0], color: 0xfff0dc, i: 8, d: 10 },
      { group: 'clinic', type: 'point', p: [18.1, 2.66, -16.2], color: 0xfff0dc, i: 4, d: 6, min: 'medium' },
      { group: 'clinic_emerg', type: 'point', p: [16.8, 2.5, -20.6], color: COLD, i: 2.5, d: 8, off: true },
    ]);
    const H = 3.0;
    const panel = shade(L, 'clinic_panel', 1.5, 0xfff2e2);
    // suspended luminaires (body 2.62 … 2.70 on two rods; the lights sit inside the bodies and wash the ceiling)
    for (const [x, z, w, d] of [[14.6, -19.0, 1.2, 0.5], [18.1, -16.2, 1.2, 0.3], [18.6, -21.7, 1.2, 0.3]] as const) {
      b.bx(paint(L, 0xece8df, 0.4), x - w / 2 - 0.03, 2.62, z - d / 2 - 0.03, x + w / 2 + 0.03, 2.7, z + d / 2 + 0.03);
      b.bx(panel, x - w / 2, 2.616, z - d / 2, x + w / 2, 2.62, z + d / 2);
      for (const s of [-1, 1]) b.rod('chrome', x + s * (w / 2 - 0.1), 2.7, z, x + s * (w / 2 - 0.1), H, z, 0.004, 4);
    }
    fixture(L, panel, 16.0, 2.9, -19.0);
    emergBox(b, 16.8, H, -20.6);
    // walls: a pale sage painted dado, door casing
    const dado = paint(L, 0xc9d6c4, 0.55), rail = paint(L, 0xf2efe6, 0.4);
    alongWall(b, '+x', 12.2, 0, () => wainscot(b, 14.2, 23.8, 1.0, [[17.85, 20.15], [21.75, 23.05]], dado, rail));
    alongWall(b, '-z', -14.2, 0, () => wainscot(b, -19.8, -12.2, 1.0, [], dado, rail));
    alongWall(b, '-x', 19.8, 0, () => wainscot(b, -23.8, -14.2, 1.0, [], dado, rail));
    alongWall(b, '+z', -23.8, 0, () => wainscot(b, 12.2, 19.8, 1.0, [], dado, rail));
    doorCasing(b, L, { x: 12, z: -19, wall: 'x', front: 'Garden Atrium', sides: [1] });

    // ── the desk on the south wall: sick-call clipboard (note3_clinic_post4), remote-patients printout
    //    (note3_clinic_reyes), the found-property tray (p3_clinic_ammo), the wall monitor (clinic_monitor)
    const top = 0.78;
    b.at(15.6, 0, -23.275, 0, () => desk3(b, 3.0, 1.05, top, 'wood_veneer', paint(L, 0xece8df, 0.5), 'l'));
    alongWall(b, '+z', -23.8, 0, () => {
      b.bx('plastic_dark', 16.12, 1.17, 0.0, 16.68, 1.2, 0.03).bx('plastic_dark', 16.12, 1.5, 0.0, 16.68, 1.53, 0.03);
      b.bx('plastic_dark', 16.12, 1.2, 0.0, 16.15, 1.5, 0.03).bx('plastic_dark', 16.65, 1.2, 0.0, 16.68, 1.5, 0.03);
    });
    const sick = canvasMat(L, 'clinic_sickcall', 256, 340, (g, W) => {
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, W, 340);
      g.fillStyle = '#1f2a44'; g.fillRect(0, 0, W, 46);
      g.fillStyle = '#f4f1e8'; g.font = '700 17px Arial'; g.fillText('진료 — 4번 초소 (해군)', 12, 29);
      g.strokeStyle = '#9aa6b8'; g.lineWidth = 1; for (let i = 0; i < 11; i++) { g.beginPath(); g.moveTo(8, 72 + i * 24); g.lineTo(W - 8, 72 + i * 24); g.stroke(); }
      g.strokeStyle = '#22325a'; g.lineWidth = 2;
      for (let i = 0; i < 11; i++) { g.beginPath(); const y = 66 + i * 24; for (let x = 14; x < W - 20 - ((i * 37) % 60); x += 5) g.lineTo(x, y + Math.sin(x * 0.8 + i) * 2.2); g.stroke(); }
      g.fillStyle = 'rgba(242,194,48,0.45)'; g.fillRect(120, 182, 90, 16); // a highlighter on one line
      g.fillStyle = '#a12a2a'; g.font = 'italic 700 18px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('→ 바이오시스?', 140, 330);
    });
    b.detail(() => {
      // clipboard
      b.at(14.8, top, -23.3, 0.12, () => {
        b.bx('wood_dark', -0.12, 0, -0.165, 0.12, 0.008, 0.165);
        b.quad(sick, 0, 0.0095, 0.01, 0.21, 0.28, '+y', 0, 'unit', 0.001);
        b.bx('chrome', -0.05, 0.008, -0.165, 0.05, 0.02, -0.13);
      });
      // a navy folder under it, the printout (continuous paper, perforated edges) by the monitor
      b.at(14.55, top, -23.55, -0.25, () => b.bx(fabric(L, 0x1f2a44), -0.16, 0, -0.12, 0.16, 0.012, 0.12));
      b.at(15.6, top, -23.3, -0.08, () => {
        b.bx(paper(L, 0xeef2e6), -0.14, 0.001, -0.19, 0.14, 0.004, 0.19);
        for (let i = 0; i < 6; i++) b.bx(paper(L, 0xd6e6cf), -0.125, 0.0045, -0.17 + i * 0.065, 0.125, 0.0048, -0.14 + i * 0.065);
      });
      b.at(16.35, top, -23.0, 0, () => keyboard(b));
      b.at(17.0, top, -23.55, 0.5, () => mug(b, L, 3));
      b.cyl('brass', 14.25, top + 0.05, -23.6, 0.035, 0.1, 'y', 10);
      for (let i = 0; i < 3; i++) b.rod(i % 2 ? 'plastic_dark' : 'chrome', 14.25, top + 0.05, -23.6, 14.25 + R.range(-0.03, 0.03), top + 0.16, -23.6 + R.range(-0.03, 0.03), 0.004, 4);
      // found property: a low card tray (the ammo box lies in it), a pair of glasses, a key on a ring
      b.at(16.0, top, -22.95, 0, () => {
        const card = paint(L, 0xc9b48a, 0.8);
        b.bx(card, -0.22, 0, -0.15, 0.22, 0.006, 0.15);
        for (const s of [-1, 1]) { b.bx(card, -0.22, 0, s * 0.15 - 0.004, 0.22, 0.04, s * 0.15 + 0.004); b.bx(card, s * 0.22 - 0.004, 0, -0.146, s * 0.22 + 0.004, 0.04, 0.146); }
        b.torus('painted_dark', 0.15, 0.012, 0.08, 0.022, 0.003, 'y', 10);
        b.torus('painted_dark', 0.15, 0.012, 0.035, 0.022, 0.003, 'y', 10);
        b.torus('brass', -0.15, 0.008, 0.09, 0.015, 0.002, 'y', 10);
      });
      b.sign('FOUND PROPERTY', 'label', 16.0, top + 0.05, -22.8, 0.2, 0.03, '+z');
    });
    b.at(15.6, 0, -22.25, PI + 0.2, () => officeChair(b, L, TINT.teal));
    b.at(16.85, 0, -22.05, PI - 0.3, () => visitorChair(b, L, TINT.sage));
    b.at(13.6, 0, -23.45, 0, () => filingCabinet(b, 4, paint(L, 0xd9d6cc, 0.5)));
    b.detail(() => b.at(13.6, 1.37, -23.5, 0.3, () => plantSmall(b, R)));

    // ── the locked drugs cabinet on the west wall over a base cupboard with a hand basin
    alongWall(b, '+x', 12.2, 0, () => {
      b.at(22.4, 0, 0.227, 0, () => sideboard(b, 1.2, 0.9, paint(L, 0xece8df, 0.5)));
      b.at(22.4, 1.25, 0, 0, () => medCabinet(b, L, 1.1, 0.8, R));
      b.bx(paint(L, 0xf4f2ee, 0.25), 21.95, 0.9, 0.06, 22.35, 0.95, 0.4);
      b.bx('painted_dark', 22.0, 0.95, 0.1, 22.3, 0.952, 0.36);
      b.rod('chrome', 22.15, 0.95, 0.07, 22.15, 1.12, 0.07, 0.01, 6);
      b.rod('chrome', 22.15, 1.12, 0.07, 22.15, 1.1, 0.2, 0.009, 6);
      b.sign('CONTROLLED DRUGS — KEEP LOCKED', 'label', 22.4, 2.15, 0.0, 0.9, 0.1, '+z', 0, true);
      // eye chart and a hand-sanitiser by the door, a health poster
      pictureFrame(b, eyeChartMat(L), 15.9, 1.55, 0.36, 0.56, 'chrome', false);
      b.bx('plastic_white', 20.7, 1.1, 0.0, 20.82, 1.32, 0.09);
    });
    const poster = canvasMat(L, 'clinic_poster', 256, 340, (g, W) => {
      g.fillStyle = '#e7efe9'; g.fillRect(0, 0, W, 340);
      g.fillStyle = '#2f5f6a'; g.textAlign = 'center'; g.font = '800 26px Arial'; g.fillText('잘 자요', W / 2, 52); g.fillText('링에서', W / 2, 84);
      g.fillStyle = '#3d4a4f'; g.font = '500 17px Arial';
      ['Keep a surface clock', 'Lamps to EVENING by 21:00', 'Headaches, ear pressure,', 'stiff neck? Come and see us.', '', '— Dr. Lund, Clinic'].forEach((t, i) => g.fillText(t, W / 2, 140 + i * 30));
    });
    alongWall(b, '+z', -23.8, 0, () => pictureFrame(b, poster, 18.6, 1.65, 0.45, 0.6, 'chrome', false));

    // ── waiting: three chairs on the north wall, a low table with magazines, a snake plant
    for (const x of [13.0, 13.6, 14.2]) b.at(x, 0, -14.66, PI + R.range(-0.08, 0.08), () => visitorChair(b, L, TINT.slate));
    b.at(13.6, 0, -15.45, 0, () => { b.bx('wood_veneer', -0.45, 0.38, -0.25, 0.45, 0.42, 0.25); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.bx('wood_dark', sx * 0.4 - 0.02, 0, sz * 0.2 - 0.02, sx * 0.4 + 0.02, 0.38, sz * 0.2 + 0.02); b.collide(-0.45, 0, -0.25, 0.45, 0.42, 0.25, 'concrete', true); });
    b.detail(() => {
      for (let i = 0; i < 3; i++) b.rbox(paper(L, [0xd9cbb0, 0xc9d8e2, 0xe6c3c0][i]), 13.45 + i * 0.16, 0.425 + i * 0.004, -15.45, 0.21, 0.004, 0.28, 0, R.range(-0.4, 0.4), 0);
    });
    pottedPlant(b, 12.62, 0, -16.2, 'snake', 0.9, R, 'plastic_white');

    // ── exam bay 1 (north-east): couch on the north wall, curtains, the medkit wall box (p3_clinic_med_1/2)
    b.at(18.0, 0, -14.62, 0, () => examCouch(b, L));
    b.detail(() => b.at(17.35, 0.723, -14.62, 0, () => { b.torus(fabric(L, 0xd8cbb0), 0, 0.03, 0, 0.07, 0.03, 'y', 14); })); // a soft neck collar
    b.at(16.4, 0, -17.9, -PI / 2, () => curtain(b, L, 0, 3.7, 2.82, 2.35, CURTAIN, 0.75, 3.7));
    b.at(16.4, 0, -17.9, 0, () => curtain(b, L, 0, 3.4, 2.82, 2.35, CURTAIN, 0.35, 3.4));
    alongWall(b, '-x', 19.8, 0, () => {
      // wall box: back, top, bottom shelf (top 1.29), sides; the two trauma kits sit on the shelf
      const wb = paint(L, 0xece8df, 0.5);
      b.bx(wb, -16.62, 1.2, 0.0, -15.78, 1.29, 0.3).bx(wb, -16.62, 1.62, 0.0, -15.78, 1.68, 0.3);
      b.bx(wb, -16.62, 1.29, 0.0, -16.58, 1.62, 0.3).bx(wb, -15.82, 1.29, 0.0, -15.78, 1.62, 0.3);
      b.bx(wb, -16.58, 1.29, 0.0, -15.82, 1.62, 0.012);
      b.sign('FIRST AID', 'label', -16.2, 1.75, 0.0, 0.4, 0.1, '+z', 0, true);
    });
    // ── exam bay 2 (south-east): couch on the east wall, curtains, a drip stand and a stool
    b.at(19.42, 0, -21.4, -PI / 2, () => examCouch(b, L, 0x6a7f5a));
    b.at(17.4, 0, -23.8, -PI / 2, () => curtain(b, L, 0, 4.2, 2.82, 2.35, CURTAIN, 0.7, 4.2));
    b.at(17.4, 0, -19.6, 0, () => curtain(b, L, 0, 2.4, 2.82, 2.35, CURTAIN, 0.2, 2.4));
    b.at(18.3, 0, -23.2, 0, () => {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; b.rod('chrome', 0, 0.06, 0, Math.sin(a) * 0.25, 0.03, Math.cos(a) * 0.25, 0.01, 5); }
      b.rod('chrome', 0, 0.06, 0, 0, 1.95, 0, 0.012, 6);
      b.rod('chrome', -0.15, 1.95, 0, 0.15, 1.95, 0, 0.008, 5);
    });
    b.at(18.4, 0, -20.4, 0, () => { b.cyl('chrome', 0, 0.28, 0, 0.02, 0.5, 'y', 8); b.cyl(fabric(L, TINT.charcoal), 0, 0.55, 0, 0.17, 0.06, 'y', 14); for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; b.rod('chrome', 0, 0.05, 0, Math.sin(a) * 0.22, 0.03, Math.cos(a) * 0.22, 0.01, 5); } });
    wayfind(b, 'Clinic — Dr. Lund · surgery 08:00–12:00', 15.2, 2.35, -14.205, 2.2, 0.26, '-z');
  },
};

// ───────────────────────────────────────────────────────────── quarters (Ring A)

const quarters: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    styleDoors(L);
    const R = rng(4001);
    const b = L.builder('quarters_dress');
    defineLeaves(L);
    lightsOf(L, [
      // (inside three flush drum fittings on the ceiling)
      { group: 'quarters', type: 'point', p: [20, 2.92, -31], color: WARM, i: 9, d: 12 },
      { group: 'quarters', type: 'point', p: [14.2, 2.92, -31], color: WARM, i: 4, d: 7, min: 'medium' },
      { group: 'quarters', type: 'point', p: [25.8, 2.92, -31], color: WARM, i: 4, d: 7, min: 'medium' },
      // (I1: the emergency lights hang 0.45 m under the ceilings — at 4 cm their hot spot on the ceiling read as a
      // glaring white blob from across the atrium after the takeover)
      // I1: the corridor had no emergency light — black after the takeover (breach 2 runs through it)
      { group: 'quarters_emerg', type: 'point', p: [20, 2.45, -31], color: COLD, i: 3, d: 11, off: true },
    ]);
    const H = 3.0;
    const sc = shade(L, 'quarters_sconce', 1.6, 0xffcb90), dl = shade(L, 'quarters_down', 1.3, 0xffdcb4);
    for (const x of [12.9, 16.0, 17.6, 22.4, 24.0, 27.1]) downlight(b, dl, x, H, -31, 0.06);
    for (const x of [14.2, 20, 25.8]) {
      b.cyl('brass', x, H - 0.008, -31, 0.27, 0.016, 'y', 24);
      b.cyl(fabric(L, TINT.cream), x, H - 0.075, -31, 0.25, 0.12, 'y', 24);
      b.cyl(dl, x, H - 0.1365, -31, 0.235, 0.003, 'y', 24);
    }
    fixture(L, dl, 20, 2.9, -31);
    // walls: wainscot with gaps at the doors, a cornice, sconces between the cabin doors
    const gapsN: [number, number][] = [15, 19, 23].map((x) => [-(x + 1.15), -(x - 1.15)]);
    const gapsS: [number, number][] = [15, 19, 23].map((x) => [x - 1.15, x + 1.15]);
    alongWall(b, '-z', -28.2, 0, () => wainscot(b, -27.8, -12.2, 0.95, gapsN));
    alongWall(b, '+z', -33.8, 0, () => wainscot(b, 12.2, 27.8, 0.95, gapsS));
    alongWall(b, '+x', 12.2, 0, () => wainscot(b, 28.2, 33.8, 0.95, [[29.85, 32.15]]));
    alongWall(b, '-x', 27.8, 0, () => wainscot(b, -33.8, -28.2, 0.95, [[-32.15, -29.85]]));
    b.bx('wood_dark', 12.2, H - 0.1, -28.24, 27.8, H - 0.02, -28.2).bx('wood_dark', 12.2, H - 0.1, -33.8, 27.8, H - 0.02, -33.76);
    for (const x of [13.0, 17.0, 21.0, 25.3]) {
      alongWall(b, '-z', -28.2, 0, () => b.at(-x, 1.95, 0, 0, () => wallSconce(b, L, sc)));
      alongWall(b, '+z', -33.8, 0, () => b.at(x, 1.95, 0, 0, () => wallSconce(b, L, sc)));
    }
    fixture(L, sc, 20, 2.0, -31);
    // carpet runner down the middle
    b.detail(() => {
      b.bx(fabric(L, TINT.charcoal), 12.7, 0, -31.75, 27.3, 0.008, -30.25);
      b.bx(fabric(L, TINT.rust), 12.85, 0.008, -31.6, 27.15, 0.012, -30.4);
    });
    // casings: cabins (name on the casing head, number on the leaf), the garden door, ring east
    const names: Record<string, string> = { d3_q1: 'L. Moen', d3_q2: 'A. & J. Karlsen', d3_q3: 'S. Vik', d3_q4: 'D. Oyelaran', d3_q5: 'R. Brandt', d3_q6: 'T. Halvorsen' };
    for (const [id, x, north] of [['d3_q1', 15, true], ['d3_q2', 19, true], ['d3_q3', 23, true], ['d3_q4', 15, false], ['d3_q5', 19, false], ['d3_q6', 23, false]] as const) {
      doorCasing(b, L, north ? { x, z: -28, wall: 'z', back: names[id], sides: [-1] } : { x, z: -34, wall: 'z', front: names[id], sides: [1] });
    }
    doorCasing(b, L, { x: 12, z: -31, wall: 'x', front: 'Garden Atrium', sides: [1] });
    doorCasing(b, L, { x: 28, z: -31, wall: 'x', back: 'Ring A — East', sides: [-1] });

    // ── lived-in: shoes by the doors, a pram, a scooter, an airer, plants, umbrellas, a bench and the residents' board
    // north row (corridor face z −28.2; things stand within 0.9 m of the wall), toes toward the door
    b.at(16.55, 0, -28.55, PI - 0.2, () => shoes(b, L, 1, 0x3a2e26));                       // A1 Moen: boots
    b.at(13.65, 0, -28.5, 0, () => { b.cyl(paint(L, 0x2f3a52, 0.5), 0, 0.25, 0, 0.11, 0.5, 'y', 12, 0.1); b.rod('painted_dark', 0.02, 0.3, 0, 0.05, 0.9, 0.02, 0.012, 5); b.rod(paint(L, 0x8a3b2e, 0.5), -0.03, 0.3, 0.02, -0.06, 0.85, 0.03, 0.012, 5); });
    b.at(20.6, 0, -28.6, PI + 0.15, () => shoes(b, L, 3, 0xd8a83a));                       // A2 Karlsen: a child's wellies
    b.at(20.95, 0, -28.55, PI - 0.25, () => shoes(b, L, 0, 0x6d4a32));
    b.at(17.4, 0, -28.75, 0, () => pram(b, L, TINT.slate));
    b.at(21.4, 0, -28.47, 0.0, () => kidScooter(b, L, 0x3f7a78));
    b.at(24.55, 0, -28.55, PI + 0.1, () => shoes(b, L, 2, 0xe8e2d6));                       // A3 Vik: trainers
    pottedPlant(b, 25.2, 0, -28.6, 'fern', 0.7, R, paint(L, 0xb85c3c, 0.6));
    // south row (corridor face z −33.8)
    b.at(13.45, 0, -33.45, 0.15, () => shoes(b, L, 0, 0x2a2a2a));                          // A4 Oyelaran
    b.at(17.1, 0, -33.35, 0, () => dryingRack(b, L, R, 1.0));
    b.at(20.55, 0, -33.45, -0.2, () => shoes(b, L, 1, 0x4a3a2a));                          // A5 Brandt
    b.at(21.25, 0, -33.55, 0, () => {
      // a crate of empty bottles for the recycling
      b.bx(paint(L, 0x3f5a78, 0.6), -0.2, 0, -0.15, 0.2, 0.28, 0.15);
      b.detail(() => { for (let i = 0; i < 6; i++) b.cyl(glassFront(L), -0.13 + (i % 3) * 0.13, 0.36, -0.06 + Math.floor(i / 3) * 0.12, 0.03, 0.18, 'y', 8); });
    });
    b.at(24.6, 0, -33.45, 0.1, () => shoes(b, L, 0, 0x5a3a2a));                            // A6 Halvorsen: his good shoes
    b.at(21.65, 0, -33.4, 0.4, () => shoes(b, L, 0, 0x7a4a5a));
    pottedPlant(b, 12.62, 0, -28.62, 'fig', 1.1, R, 'stone_pale');
    pottedPlant(b, 12.62, 0, -33.38, 'palm', 0.9, R, paint(L, 0xb85c3c, 0.6));
    b.at(26.1, 0, -33.48, 0, () => bench3(b, 1.5, 'wood_dark', 'wood_veneer', true, true));
    alongWall(b, '+z', -33.8, 0, () => {
      noticeBoard(b, L, 26.1, 1.55, 1.1, 0.75, R, 9);
      pictureFrame(b, artMat(L, 'photo', 41), 13.5, 1.65, 0.45, 0.34);
    });
    alongWall(b, '-z', -28.2, 0, () => pictureFrame(b, artMat(L, 'fjord', 42), -26.2, 1.65, 0.9, 0.62));
    wayfind(b, 'Ring A · cabins 1–6', 27.795, 2.45, -33.0, 1.3, 0.26, '-x');
  },
};

// ───────────────────────────────────────────────────────────── BIOLOGICAL SYSTEMS — outer lock (Deck 2)

const bio_lock: RoomDress = {
  label: false,
  look: { floor: 'floor_rubber', wall: 'wall_medical', ceiling: 'painted_white' },
  lights: [],
  build(L) {
    const b = L.builder('bio_dress');
    const hs = lightsOf(L, [
      { group: 'bio_lock', type: 'spot', p: [14, Y + 2.985, -38], t: [14, Y, -38], color: 0xf4f8ff, i: 16, d: 6, angle: 1.1, cast: true, min: 'medium' },
      { group: 'bio_lock', type: 'point', p: [14.3, Y + 2.985, -38.3], color: 0xeef4ff, i: 4, d: 5, prio: 0.5 },
    ]);
    const H = Y + 3.0;
    // a square ceiling luminaire (its own power: not in the habitat's takeover wave)
    const lum = shade(L, 'bio_panel_light', 2.0, 0xeef4ff);
    hs[1].bindEmissive(lum, lum.emissiveIntensity);
    b.bx('chrome', 13.3, H - 0.03, -38.7, 14.7, H - 0.002, -37.3);
    b.bx(lum, 13.35, H - 0.034, -38.65, 14.65, H - 0.03, -37.35);
    // decon grate in the floor, a drain, yellow "stand here" feet
    b.bx('trim_steel', 12.95, Y, -39.05, 15.05, Y + 0.006, -36.95);
    b.quad('floor_grate', 14, Y + 0.012, -38, 2.0, 2.0, '+y', 0, 'box');
    // purge nozzles: a ring in the ceiling, manifolds on the north and south walls (their positions are a hook)
    const pts: { p: [number, number, number]; d: [number, number, number] }[] = [];
    b.torus('chrome', 14, H - 0.12, -38, 1.15, 0.022, 'y', 28);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + PI / 8, x = 14 + Math.sin(a) * 1.15, z = -38 + Math.cos(a) * 1.15;
      b.rod('chrome', x, H - 0.12, z, x, H, z, 0.012, 5);
      b.push(x, H - 0.12, z, 0, PI / 2); nozzle(b, 0.05); b.pop();
      pts.push({ p: [x, H - 0.2, z], d: [0, -1, 0] });
    }
    for (const [face, plane, dz, xs] of [['-z', -36.2, -1, [13.0, 15.0]], ['+z', -39.8, 1, [14.3]]] as const) {
      for (const x of xs) {
        b.rod('chrome', x, Y + 0.3, plane + dz * 0.06, x, H, plane + dz * 0.06, 0.022, 8);
        for (const y of [0.6, 1.2, 1.8, 2.4]) {
          b.at(x, Y + y, plane + dz * 0.06, face === '-z' ? PI : 0, () => nozzle(b, 0.05));
          pts.push({ p: [x, Y + y, plane + dz * 0.14], d: [0, 0, dz] });
        }
        for (const y of [0.4, 2.85]) b.bx('steel_raw', x - 0.04, Y + y - 0.03, Math.min(plane, plane + dz * 0.08), x + 0.04, Y + y + 0.03, Math.max(plane, plane + dz * 0.08));
      }
    }
    L.marker('bio_nozzles', 14, Y + 1.5, -38).userData.points = pts;
    // BIOLOGICAL SYSTEMS stencil over the inner door's wall run (north wall), DECON panel bezel by the inner door
    b.sign('BIOLOGICAL SYSTEMS', 'stencil', 14, Y + 2.45, -36.205, 2.4, 0.3, '-z');
    b.sign('DECONTAMINATION ON ENTRY — WAIT FOR GREEN', 'label', 14, Y + 2.12, -36.205, 2.0, 0.12, '-z', 0, true);
    alongWall(b, '-x', 15.8, Y, () => {
      b.bx('plastic_dark', -37.0, 1.33, 0.0, -36.4, 1.36, 0.03).bx('plastic_dark', -37.0, 1.64, 0.0, -36.4, 1.67, 0.03);
      b.bx('plastic_dark', -37.0, 1.36, 0.0, -36.97, 1.64, 0.03).bx('plastic_dark', -36.43, 1.36, 0.0, -36.4, 1.64, 0.03);
      // the inner reader (dark in 3a) and a chevron band over the inner door's frame
      b.bx('plastic_dark', -39.58, 1.2, 0.0, -39.38, 1.5, 0.04);
      b.bx('screen_off', -39.55, 1.32, 0.04, -39.41, 1.46, 0.042);
      b.bx('hazard_stripes', -39.25, 2.76, 0.0, -36.75, 2.9, 0.012);
    });
    // the painted-over naval markings: a roller-painted patch on the south wall with the stencil ghosting through
    const ghost = canvasMat(L, 'bio_paintover', 512, 192, (g, W, Hh) => {
      g.fillStyle = '#8f8c82'; g.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.035)`; g.fillRect(i * 20, 0, 22, Hh); }
      g.fillStyle = 'rgba(40,40,36,0.085)'; g.textAlign = 'center'; g.font = '800 46px "Arial Black", Arial'; g.fillText('해군 보안 구역', W / 2, 78);
      g.font = '800 30px "Arial Black", Arial'; g.fillText('4번 초소 — 허가된 인원만', W / 2, 128);
      g.strokeStyle = 'rgba(40,40,36,0.07)'; g.lineWidth = 6; g.beginPath(); g.arc(W - 46, 150, 18, 0, PI * 2); g.moveTo(W - 46, 132); g.lineTo(W - 46, 182); g.stroke();
      for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(143,140,130,0.9)'; g.fillRect(30 + i * 67, Hh - 14, 6, 10 + (i % 3) * 4); }
    });
    alongWall(b, '+z', -39.8, Y, () => {
      b.quad(ghost, 14.0, 2.1, 0.003, 2.6, 0.95, '+z');
      // an empty rifle rack (two cradles, the chain hanging open), the guard's sign-in shelf
      b.bx('wood_dark', 12.6, 0.95, 0.0, 13.7, 1.55, 0.03);
      for (const x of [12.85, 13.45]) for (const y of [1.05, 1.42]) { b.bx('painted_dark', x - 0.06, y, 0.03, x + 0.06, y + 0.03, 0.1); b.bx('painted_dark', x - 0.06, y + 0.03, 0.08, x + 0.06, y + 0.07, 0.1); }
      b.rod('chrome', 12.7, 1.5, 0.05, 13.0, 1.28, 0.06, 0.006, 4); b.rod('chrome', 13.0, 1.28, 0.06, 13.2, 1.18, 0.07, 0.006, 4);
      b.bx('brass', 13.17, 1.12, 0.06, 13.23, 1.18, 0.08);
      b.bx('painted_dark', 14.9, 1.1, 0.0, 15.6, 1.13, 0.22);
      b.rbox(paper(L, 0xf1ece0), 15.2, 1.135, 0.12, 0.22, 0.004, 0.3, 0, 0.1, 0);
      b.sign('SIGN IN — ALL PERSONNEL', 'label', 15.25, 1.3, 0.0, 0.7, 0.1, '+z', 0, true);
    });
    // a small painted-over crest by the outer door
    alongWall(b, '-z', -36.2, Y, () => b.bx(paint(L, 0x8f8c82, 0.85), -12.95, 1.55, 0.0, -12.55, 1.95, 0.003));
  },
};

// ───────────────────────────────────────────────────────────── ring east stub (seen when d3_ring_e opens)

const ring_e: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  // IB5b (3b carry-over B8): the red strip now throws a dim red pool after the takeover (`quarters_emerg`)
  lights: [{ group: 'quarters_emerg', type: 'point', p: [29.6, 2.75, -31.0], color: 0xff3020, i: 1.1, d: 5, prio: 0.4, off: true }],
  build(L) {
    const b = L.builder('ring_e_dress');
    // the ring goes on east behind a lowered fire shutter; a red emergency strip is the only light
    b.bx('painted_dark', 30.97, 0, -32.6, 31.0, 2.7, -29.4);
    b.detail(() => { for (let y = 0.1; y < 2.6; y += 0.1) b.bx('trim_steel', 30.955, y, -32.5, 30.97, y + 0.07, -29.5); });
    b.sign('FIRE SHUTTER — KEEP CLEAR', 'label', 30.95, 2.85, -31.0, 1.6, 0.14, '-x', 0, true);
    const red = mat3(L, 'ring_e_red', () => L.ctx.materials.clone('emissive_red', { emissiveIntensity: 1.1 }));
    b.bx(red, 28.6, 2.97, -31.08, 30.6, 3.0, -30.92);
    alongWall(b, '-z', -29.0, 0, () => wainscot(b, -31.0, -28.2, 0.95));
    alongWall(b, '+z', -33.0, 0, () => wainscot(b, 28.2, 31.0, 0.95));
    wayfind(b, 'Ring A · cabins 7–12', 29.6, 2.2, -29.005, 1.3, 0.26, '-z');
  },
};

export const SOUTH_DRESS: Partial<Record<RoomId3, RoomDress>> = { stair_w, canteen, kitchen, clinic, quarters, bio_lock, ring_e };
