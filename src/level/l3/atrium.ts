/**
 * GARDEN ATRIUM (stage 3a §2.5, §2.6, §2.7, §8.7; task P3b) — the showpiece: x −12 … 12, z −44 … −12, 13.5 m high.
 *
 * Terrazzo paths between raised beds of ferns, sedges and flowering shrubs; four fig trees; a pool fed by a falling
 * sheet off a low stone wall; benches; growing racks with purple grow-lights on the west wall; Ring B's cabin windows
 * (blinds lit) high on the west wall; the colonnade and café kiosk under the east balcony; the feature stair in stone
 * with brass nosings; the 16 × 9 m sea viewport with its ribs and sill bench; a daylight lamp grid (6 × 8 panels) at
 * y 13.2. The P2 effects (`ctx.fx`): viewport, falls, pool, lampGrid — handles on the level object `atrium_fx`
 * (`userData = { viewport, falls, pool, lampGrid, water }`) for the story's takeover; all hidden while the atrium is culled.
 *
 * Sight lines (§2.8): no trunk within ±2.5 m of the lock → beacon ray (x ≈ 0 … 1.5); from the canteen garden door the
 * fan of rays to the pressure door (0, −7) and to the shutter (10.5, −12) is free of trunks (the plan's tree at
 * (−8, −34) stood in it, it moved to (−10.2, −30.5); the one at (4.5, −16) moved to (3.5, −15.5), 3.1 m off the
 * shutter ray).
 */
import * as THREE from 'three';
import { rng, type Builder, type Rng } from '../builder';
import type { LevelBuild } from '../context';
import { extrude } from '../kit';
import type { FxSystemEx } from '../../fx';
import { D2, LIGHTS3, STAIR_ATR, placeLights, type LightRow, type RoomId3 } from './grey';
import type { RoomDress } from './index';
import {
  TINT, alongWall, wainscot, pictureFrame, artMat, installLeafLod, bench3, canvasMat, defineLeaves, doorCasing, downlight, fern, foliage, glassFront, grass, isStandin, leaf,
  leafStats, mat3, paint, paper, planterBed, pottedPlant, restyle, shade, totem, tree, wayfind,
} from './kit3';

const PI = Math.PI;
const H = 13.5;
const WATER_Y = 0.25;
/** Pool (outer rim x −3 … 3, z −29.7 … −24) and its south wall (z −31 … −29.7, top 1.0, lip 0.88). */
const POOL = { x0: -3, x1: 3, z0: -29.7, z1: -24, rim: 0.3, wall: { x0: -3.3, x1: 3.3, z0: -31.0, top: 1.0, lip: 0.88 } };
/**
 * Raised beds [x0, z0, x1, z1], laid on a grid of ≥ 2.5 m paths (nav v2 needs them: a 1.5 m node grid, husk
 * capsules): the west path x −11.3 … −8.8 (racks on the wall), the pool ring (2.5 m), the cross path south of the
 * pool z −33.5 … −31, the promenade z −43.8 … −39.8, the north path z −14.7 … −12.2, a central vista from the pool
 * to the viewport (x −0.8 … 3.3), the stair foot and the colonnade left open.
 */
const BEDS: [number, number, number, number][] = [
  [-8.8, -21.5, -5.8, -14.7],  // W1 (fig at −7.3, −18)
  [-8.8, -31.0, -5.8, -24.0],  // W2 (fig at −8.2, −25)
  [-8.8, -37.4, -6.3, -33.5],  // SW (low planting by the canteen door)
  [-3.8, -39.8, -0.8, -33.5],  // S (fig at −2.3, −36.8)
  [3.3, -39.8, 7.3, -33.5],    // SE
  [-3.2, -21.5, -0.8, -14.7],  // N
  [1.8, -19.5, 4.4, -14.7],    // NE (fig at 3.3, −16.2)
];
/**
 * Trees [x, z, height, canopy radius]. Sight lines (§2.8): none within ±2.5 m of the lock → beacon ray (x ≈ 0 … 1.5);
 * from the canteen garden door (−12, −39) the rays to the pressure door (0, −7) and the shutter (10.5, −12) pass every
 * trunk by ≥ 1.5 m (the plan's (−8, −34) stood on the shutter ray).
 */
const TREES: [number, number, number, number][] = [[-7.3, -18, 7.6, 2.0], [3.3, -16.2, 6.8, 1.8], [-8.2, -25.0, 6.6, 1.8], [-2.3, -36.8, 7.2, 2.0]];

/**
 * check:fxleak (W7): rooms that look into the atrium through an opening — the gallery glazing (and the lobby through
 * the gallery), the canteen's glass front, the side doors, and the lock / lift axis through the pressure door (3a §2.8,
 * the beacon ray). The sea is still checked to show only through its pane from all of them.
 */
const ATRIUM_SEEN_FROM: string[] = ['gallery_n', 'lobby', 'lock', 'lift3', 'canteen', 'quarters', 'clinic', 'bio_lock'];

const atrium: RoomDress = {
  label: false,
  look: { floor: 'terrazzo', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    const R = rng(3601);
    const b = L.builder('atrium_dress');
    const g = L.builder('atrium_garden');
    defineLeaves(L);
    installLeafLod(L, 0.55);
    const leaves0 = leafStats();
    // greybox stand-ins: the feature stair in pale stone, clean architectural glass (viewport, balustrades, stair)
    restyle(L, 'atrium_grey', isStandin, L.ctx.materials.get('stone_pale'));
    restyle(L, 'atrium_grey', (m) => m === L.ctx.materials.get('glass'), glassFront(L));
    L.objects.get('atr_roof_hatch_panel')?.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = paint(L, 0xd9d1c2, 0.7); });

    // ── lights (§2.6): the evening key spots + fills follow the lamp grid; the emergency set comes on with it
    const rows: LightRow[] = LIGHTS3.atrium.map((r) => {
      if (r.group !== 'atrium_day') return { ...r };
      // evening: warm keys a little stronger; the fills warm-neutral instead of sky blue (no grey walls)
      return r.type === 'spot' ? { ...r, i: 120, color: 0xffc58a } : { ...r, color: 0xffe2c4, i: r.min ? 16 : 30, d: r.min ? 16 : 20 };
    });
    const hs = placeLights(L, rows);
    // uplights washing the living wall (follow the lamp grid with the day lights)
    for (const x of [-7.0, -2.8]) {
      const h = L.spot('atrium_day', x, 0.25, -13.4, x, 3.6, -12.2, 0xffd7a0, 14, 6, 0.75, { cast: false });
      hs.push(h); rows.push({ group: 'atrium_day', type: 'spot', p: [x, 0.25, -13.4], color: 0, i: 0, d: 0 });
    }
    const day = hs.filter((_, i) => rows[i].group === 'atrium_day');
    const emerg = hs.filter((_, i) => rows[i].group === 'atrium_emerg');

    shell(L, b, R);
    stair(L, b);
    const water = pool(L, b);
    viewportWall(L, b, R);
    colonnade(L, b, R);
    balcony(L, b, R);
    garden(L, g, R);
    westWall(L, b, g, R);

    // ── P2 effects
    const fx = L.ctx.fx as FxSystemEx;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const beacon = V(1.5, 5.2, -62);
    const from = V(2.6, -8, -66);
    const dir = beacon.clone().sub(from).normalize();
    const viewport = fx.viewport({
      // (I1: spread 1.4 grew the sea's coverage proxy far behind the canteen and kitchen (x −33 at its 18 m depth); seen
      // through gaps in that geometry from the gallery and the garden it drew the flood-lit water there — a large white
      // glow toward the canteen that turned into "sparkles" (marine snow) close up. The shader marches every ray from the
      // glass outward on its own, the proxy only has to be closed behind the pane: 0.2 keeps it inside x ±11.6.)
      position: V(0, 5.1, -44.0), normal: V(0, 0, 1), width: 16, height: 9, spread: 0.2,
      // stage 3b D21 (W7): registered — drawn only while the atrium is drawn, never in a probe, seen only through its pane
      id: 'fx3_sea', rooms: ['atrium'], seenFrom: ATRIUM_SEEN_FROM,
      cable: { from, to: beacon.clone().addScaledVector(dir, 60), radius: 0.55, beacon, markers: 2 },
      floods: [{ at: [-6.5, 4.6, 0.6], dir: [0.15, -1.3, 1], intensity: 0.12 }, { at: [6.5, 4.6, 0.6], dir: [-0.15, -1.3, 1], intensity: 0.1 }],
    });
    const falls = fx.falls({ top: V(0, POOL.wall.lip, POOL.z0), dir: V(0, 0, 1), width: 4.4, drop: POOL.wall.lip - WATER_Y, material: water });
    const poolFx = fx.pool({
      center: V(0, WATER_Y, (POOL.z0 + POOL.z1) / 2 + 0.15), size: [POOL.x1 - POOL.x0 - 2 * POOL.rim, POOL.z1 - POOL.z0 - POOL.rim], rim: 0.2,
      falls, material: water, glow: 0.07,
      caustics: [{ position: V(0, 0.57, POOL.z0 + 0.004), normal: V(0, 0, 1), width: 5.4, height: 0.62 }],
    });
    const lampGrid = fx.lampGrid({ center: V(0, 13.2, -28), cols: 6, rows: 8, pitch: [4.0, 3.9], panel: [2.6, 2.6], lights: day, emergencyLights: emerg, emergencyIntensity: 0.9 });
    // grow-light strips and the café menu glow join the takeover wave by position
    for (const [m, p] of FIXTURES.get(L) ?? []) lampGrid.addFixture(m, p, m.emissiveIntensity, 0);
    const fxObj = L.marker('atrium_fx', 0, 0, -28);
    fxObj.userData = { viewport, falls, pool: poolFx, lampGrid, water };
    // Stage 3b D21 (W7): the fx-volume registry. Each is drawn only while the atrium is drawn; render.prepare (the
    // load-time probe bake) and the probe re-captures hide them all (the I1 glare: the sea's floods and beacon baked
    // into the atrium probe showed as a white glare and "sparkles" on every glass surface reflecting it).
    fx.volume({ id: 'fx3_lamps', object: lampGrid.mesh, rooms: ['atrium'], seenFrom: ATRIUM_SEEN_FROM });
    fx.volume({ id: 'fx3_falls', object: falls.mesh, rooms: ['atrium'], seenFrom: ATRIUM_SEEN_FROM });
    fx.volume({ id: 'fx3_pool', object: poolFx.mesh, rooms: ['atrium'], seenFrom: ATRIUM_SEEN_FROM });
    L.ctx.render.post.grade?.(0.35, 0);
    // lamp-grid hangers (two rods per panel)
    b.detail(() => {
      for (let c = 0; c < 6; c++) for (let r = 0; r < 8; r++) {
        const x = (c - 2.5) * 4.0, z = -28 + (r - 3.5) * 3.9;
        for (const s of [-1, 1]) b.rod('painted_dark', x + s * 1.1, 13.21, z + s * 1.1, x + s * 1.1, H, z + s * 1.1, 0.008, 4);
      }
    });
    if (L.ctx.debug.verbose) console.info(`[l3 atrium] leaf cards ${leafStats() - leaves0} (level total ${leafStats()})`);
    (L.objects.get('atrium_fx')!.userData as Record<string, unknown>).leafCards = leafStats() - leaves0;
  },
};

/** Emissive fixtures that should join the lamp grid's wave (per level). */
const FIXTURES = new WeakMap<LevelBuild, [THREE.MeshStandardMaterial, THREE.Vector3][]>();
function fixture(L: LevelBuild, m: THREE.MeshStandardMaterial, p: THREE.Vector3) {
  let a = FIXTURES.get(L);
  if (!a) FIXTURES.set(L, (a = []));
  a.push([m, p]);
}

// ───────────────────────────────────────────────────────────── walls, ceiling

function shell(L: LevelBuild, b: Builder, R: Rng) {
  // oak batten cladding high on the east wall (above the balcony doors) and the north wall (above the gallery glass)
  b.detail(() => {
    for (let z = -39.7; z <= -12.5; z += 0.24) b.bx('wood_veneer', 11.74, 8.6, z - 0.045, 11.8, 13.3, z + 0.045);
    for (let x = -11.6; x <= 11.6; x += 0.24) b.bx('wood_veneer', x - 0.045, 8.6, -12.26, x + 0.045, 13.3, -12.2);
    // cornice round the top, a dark shadow gap at 8.5
    b.bx('wood_dark', 11.7, 8.5, -43.8, 11.8, 8.6, -12.2).bx('wood_dark', -11.8, 8.5, -12.3, 11.8, 8.6, -12.2);
  });
  b.bx('plaster_warm', -11.8, H - 0.25, -43.8, -11.7, H, -12.2).bx('plaster_warm', 11.7, H - 0.25, -43.8, 11.8, H, -12.2);
  // oak wainscot round the garden (gaps: canteen front, doors, viewport surround, living wall, kiosk) and the balcony
  alongWall(b, '+x', -11.8, 0, () => wainscot(b, 12.2, 43.8, 1.0, [[34.1, 43.8]]));
  alongWall(b, '-x', 11.8, 0, () => wainscot(b, -43.8, -12.2, 1.0, [[-20.15, -17.85], [-32.15, -29.85], [-16.7, -13.3]]));
  alongWall(b, '+z', -43.8, 0, () => wainscot(b, -11.8, 11.8, 1.0, [[-8.8, 8.8]]));
  alongWall(b, '-z', -12.2, 0, () => wainscot(b, -11.8, 11.8, 1.0, [[1.1, 8.7]]));
  alongWall(b, '-x', 11.8, D2, () => wainscot(b, -40.0, -12.2, 0.9, [[-39.95, -36.8], [-26.0, -13.0]]));
  // the slab edge under the gallery glass (atrium side): an oak fascia band
  b.bx('wood_dark', -11.8, 4.42, -12.26, 6.0, 4.8, -12.2);
  // living wall on the north wall below the gallery (x −8.6 … −1.2, y 0.35 … 4.2)
  const lw = { x0: -8.6, x1: -1.2, y0: 0.35, y1: 4.2, z: -12.2 };
  b.bx('wood_dark', lw.x0 - 0.08, 0, lw.z - 0.25, lw.x1 + 0.08, lw.y0, lw.z);
  b.bx(paint(L, 0x2c3d22, 0.9), lw.x0, lw.y0, lw.z - 0.08, lw.x1, lw.y1, lw.z - 0.005);
  b.bx('wood_dark', lw.x0 - 0.08, lw.y1, lw.z - 0.12, lw.x1 + 0.08, lw.y1 + 0.08, lw.z);
  for (const x of [lw.x0 - 0.04, lw.x1 + 0.04]) b.bx('wood_dark', x - 0.04, lw.y0, lw.z - 0.12, x + 0.04, lw.y1, lw.z);
  b.collide(lw.x0 - 0.08, 0, lw.z - 0.25, lw.x1 + 0.08, lw.y0, lw.z, 'concrete', true);
  for (let i = 0; i < 980; i++) {
    const x = R.range(lw.x0 + 0.1, lw.x1 - 0.1), y = R.range(lw.y0 + 0.05, lw.y1 - 0.25);
    const k = R();
    if (k < 0.45) leaf(b, 'frond', x, y, lw.z - 0.09, PI + R.range(-0.8, 0.8), R.range(1.2, 2.0), R.range(-0.4, 0.4), R.range(0.45, 0.7), R.range(0.55, 0.8));
    else if (k < 0.88) leaf(b, 'broad', x, y, lw.z - 0.09, PI + R.range(-0.9, 0.9), R.range(1.0, 1.9), R.range(-0.6, 0.6), R.range(0.24, 0.36));
    else leaf(b, R.chance(0.5) ? 'flower' : 'blade', x, y, lw.z - 0.09, PI + R.range(-0.6, 0.6), R.range(0.9, 1.5), 0, 0.16, 0.22);
  }
  for (const x of [-7.0, -2.8]) { b.cyl('brass', x, 0.06, -13.4, 0.07, 0.12, 'y', 10); b.cyl(shade(L, 'atr_uplight', 2.0), x, 0.121, -13.4, 0.05, 0.004, 'y', 10); }
  fixture(L, shade(L, 'atr_uplight', 2.0), new THREE.Vector3(-5, 0.2, -13.4));
  wayfind(b, 'Garden Atrium', 3.0, 3.1, -12.205, 1.7, 0.42, '-z');
  wayfind(b, 'Canteen ←   Clinic · Quarters →', 3.0, 2.55, -12.205, 2.1, 0.32, '-z');
  // bicycle rack + two bicycles against the north wall
  b.bx('painted_dark', 5.6, 0, -12.75, 8.4, 0.05, -12.65);
  for (let x = 5.8; x <= 8.2; x += 0.6) b.rod('painted_dark', x, 0.05, -12.7, x, 0.75, -12.7, 0.018, 6);
  b.rod('painted_dark', 5.8, 0.75, -12.7, 8.2, 0.75, -12.7, 0.018, 6);
  b.collide(5.6, 0, -12.9, 8.4, 0.8, -12.5, 'metal', true);
  for (const [x, c] of [[6.3, 0x8a3b2e], [7.5, 0x3f5a78]] as const) bicycle(b, L, x, -12.95, c);
  // a totem by the foot of the feature stair
  totem(b, 4.95, 0, -20.4, 0, 'Balcony\nBiological Systems\n↑', null, 0.55, 0.9);
}

function bicycle(b: Builder, L: LevelBuild, x: number, z: number, color: number) {
  const fr = paint(L, color, 0.35);
  b.push(x, 0, z, PI / 2);
  for (const s of [-0.52, 0.52]) { b.torus('rubber', s, 0.34, 0, 0.32, 0.018, 'x', 18); b.cyl('chrome', s, 0.34, 0, 0.02, 0.06, 'x', 6); }
  b.detail(() => {
    b.rod(fr, -0.52, 0.34, 0, -0.05, 0.36, 0, 0.016, 5); b.rod(fr, -0.05, 0.36, 0, 0.42, 0.75, 0, 0.016, 5);
    b.rod(fr, -0.52, 0.34, 0, -0.12, 0.78, 0, 0.014, 5); b.rod(fr, -0.12, 0.78, 0, 0.42, 0.75, 0, 0.016, 5);
    b.rod(fr, -0.05, 0.36, 0, -0.14, 0.82, 0, 0.016, 5); b.rod(fr, 0.42, 0.75, 0, 0.52, 0.34, 0, 0.016, 5);
    b.box('plastic_dark', -0.15, 0.86, 0, 0.22, 0.04, 0.1); b.rod('chrome', 0.42, 0.75, 0, 0.4, 0.95, 0, 0.012, 5);
    b.rod('plastic_dark', 0.4, 0.95, -0.22, 0.4, 0.95, 0.22, 0.012, 5);
  });
  b.pop();
}

// ───────────────────────────────────────────────────────────── the feature stair

function stair(L: LevelBuild, b: Builder) {
  const s = STAIR_ATR;
  // stringers: oak panels covering both stepped sides (outline in the stair's local run / rise)
  const run = s.tread * s.risers, top = s.rise * s.risers;
  const outline: [number, number][] = [[0, 0], [run, 0], [run, top + 0.06], [run - s.tread, top + 0.06], [0, s.rise + 0.06]];
  for (const x of [s.x0 - 0.045, s.x1 + 0.01]) extrude(b, 'wood_veneer', outline, 0.035, x, 0, s.z0, PI / 2);
  // brass nosings on each tread
  b.detail(() => {
    for (let k = 0; k < s.risers; k++) {
      const zf = s.z0 + s.dir * s.tread * k, y = s.rise * (k + 1);
      b.bx('brass', s.x0 + 0.06, y - 0.025, zf - 0.035, s.x1 - 0.06, y + 0.009, zf + 0.009);
    }
  });
  void L;
}

// ───────────────────────────────────────────────────────────── pool and falling water

function pool(L: LevelBuild, b: Builder): THREE.MeshStandardMaterial {
  const water = L.ctx.materials.clone('water');
  water.name = 'atrium_water';
  const { x0, x1, z0, z1, rim, wall } = POOL;
  const rh = 0.45;
  // rim walls (west, east, north) with a stone coping; the low wall south
  b.bx('stone_pale', x0, 0, z0, x0 + rim, rh, z1).bx('stone_pale', x1 - rim, 0, z0, x1, rh, z1);
  b.bx('stone_pale', x0 + rim, 0, z1 - rim, x1 - rim, rh, z1);
  b.bx('stone_pale', x0 - 0.03, rh, z0, x0 + rim + 0.02, rh + 0.05, z1 + 0.03).bx('stone_pale', x1 - rim - 0.02, rh, z0, x1 + 0.03, rh + 0.05, z1 + 0.03);
  b.bx('stone_pale', x0 + rim + 0.02, rh, z1 - rim - 0.02, x1 - rim - 0.02, rh + 0.05, z1 + 0.03);
  b.bx('tile_ceramic', x0 + rim, 0.0, z0, x1 - rim, 0.02, z1 - rim);
  b.collide(x0, 0, z0, x0 + rim, rh + 0.05, z1, 'concrete', true);
  b.collide(x1 - rim, 0, z0, x1, rh + 0.05, z1, 'concrete', true);
  b.collide(x0 + rim, 0, z1 - rim, x1 - rim, rh + 0.05, z1, 'concrete', true);
  // the water (a level mesh; the fx pool adds its glow and caustics on top)
  b.quad(water, 0, WATER_Y, (z0 + z1 - rim) / 2, x1 - x0 - 2 * rim, z1 - z0 - rim, '+y', 0, 'box');
  // the low stone wall: a channel on top feeding the lip at z0, coping either side
  const cx0 = -2.3, cx1 = 2.3, ch = 0.32; // channel 0.32 m wide behind the lip
  b.bx('stone_pale', wall.x0, 0, wall.z0, wall.x1, wall.lip - 0.03, z0);
  b.bx('stone_pale', wall.x0, wall.lip - 0.03, wall.z0, cx0, wall.top, z0).bx('stone_pale', cx1, wall.lip - 0.03, wall.z0, wall.x1, wall.top, z0);
  b.bx('stone_pale', cx0, wall.lip - 0.03, wall.z0, cx1, wall.top, z0 - ch);
  b.bx('stone_pale', wall.x0 - 0.03, wall.top, wall.z0 - 0.03, wall.x1 + 0.03, wall.top + 0.05, z0 - ch + 0.02);
  for (const [a, c] of [[wall.x0 - 0.03, cx0 + 0.02], [cx1 - 0.02, wall.x1 + 0.03]] as const) b.bx('stone_pale', a, wall.top, z0 - ch + 0.02, c, wall.top + 0.05, z0 + 0.03);
  b.quad(water, 0, wall.lip - 0.005, z0 - ch / 2, cx1 - cx0, ch, '+y', 0, 'box');
  b.collide(wall.x0, 0, wall.z0, wall.x1, wall.top + 0.05, z0, 'concrete', true);
  // nav: nothing walks in the pool (its interior gets no nodes)
  const nb = new THREE.Box3(new THREE.Vector3(x0, 0.2, z0), new THREE.Vector3(x1, 1.0, z1));
  L.obstacles.push(nb.clone()); L.navSolids.push(nb.clone());
  // marker hooks (P2 / story)
  L.marker('fountain_top', 0, wall.lip, z0);
  L.marker('fountain_foot', 0, WATER_Y, z0 + 0.35);
  L.marker('pool_surface', 0, WATER_Y, (z0 + z1) / 2);
  // two benches facing the pool
  return water;
}

// ───────────────────────────────────────────────────────────── the sea viewport

function viewportWall(L: LevelBuild, b: Builder, R: Rng) {
  const z = -43.8;
  // stone surround
  b.bx('stone_pale', -8.75, 0, z, -8.02, 10.25, z + 0.35).bx('stone_pale', 8.02, 0, z, 8.75, 10.25, z + 0.35);
  b.bx('stone_pale', -8.02, 9.62, z, 8.02, 10.25, z + 0.35);
  b.detail(() => { b.bx('brass', -8.79, 10.25, z, 8.79, 10.3, z + 0.38); });
  b.collide(-8.75, 0, z, -8.02, 10.25, z + 0.35, 'concrete', true);
  b.collide(8.02, 0, z, 8.75, 10.25, z + 0.35, 'concrete', true);
  // ribs every 2 m (dark bronze with a brass edge), bowed slightly into the room at mid-height
  for (let x = -6; x <= 6; x += 2) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([0.6 + 9.0 * t, 0.08 * Math.sin(PI * t)]); }
    for (let i = 0; i < 6; i++) {
      const [ya, da] = pts[i], [yb, db] = pts[i + 1];
      b.rbox('painted_dark', x, (ya + yb) / 2, -43.92 + (da + db) / 2, 0.11, yb - ya + 0.02, 0.14, Math.atan2(db - da, yb - ya), 0, 0);
      b.detail(() => b.rbox('brass', x, (ya + yb) / 2, -43.848 + (da + db) / 2, 0.035, yb - ya + 0.02, 0.012, Math.atan2(db - da, yb - ya), 0, 0));
    }
  }
  // sill bench in two runs either side of the plaque plinth
  for (const [a, c] of [[-7.95, -0.6], [0.6, 7.95]] as const) {
    b.bx('stone_pale', a, 0, z, c, 0.4, z + 0.5);
    b.bx('wood_veneer', a + 0.02, 0.4, z + 0.02, c - 0.02, 0.45, z + 0.52);
    b.collide(a, 0, z, c, 0.45, z + 0.52, 'concrete', true);
  }
  // the plaque (sign3_viewport) on a stone plinth, slanted brass
  b.bx('stone_pale', -0.56, 0, z, 0.56, 0.78, z + 0.48);
  b.collide(-0.56, 0, z, 0.56, 0.82, z + 0.48, 'concrete', true);
  b.push(0, 0.8, z + 0.24, 0, -1.0);
  b.bx('brass', -0.42, -0.02, -0.17, 0.42, 0.0, 0.17);
  b.detail(() => b.sign('What you are looking at\n2,140 m of water · the trunk', 'wayfinding', 0, 0.002, 0, 0.74, 0.28, '+y', 0));
  b.pop();
  // viewport pane marker (hook) and promenade benches facing the glass
  L.marker('viewport_pane', 0, 5.1, -44.0);
  void R;
}

// ───────────────────────────────────────────────────────────── colonnade, café kiosk, balcony

function colonnade(L: LevelBuild, b: Builder, R: Rng) {
  const cols: [number, number][] = [[9.3, -14], [9.3, -18], [9.3, -22.2], [9.3, -26.2], [9.3, -30.5], [9.3, -34.5], [9.3, -38.6], [5.85, -31.65]];
  for (const [x, z] of cols) {
    b.cyl('stone_pale', x, 0.06, z, 0.27, 0.12, 'y', 16);
    b.cyl('stone_pale', x, 2.25, z, 0.2, 4.3, 'y', 16);
    b.cyl('wood_dark', x, 4.42, z, 0.26, 0.16, 'y', 16);
    b.detail(() => b.cyl('brass', x, 0.135, z, 0.215, 0.03, 'y', 16));
    b.collide(x - 0.22, 0, z - 0.22, x + 0.22, 4.5, z + 0.22, 'concrete', true);
  }
  // balcony / landing fascias (oak), soffit downlights in the colonnade
  b.bx('wood_dark', 8.93, 4.4, -40.0, 8.99, 4.84, -12.2);
  b.bx('wood_dark', 5.43, 4.4, -32.06, 5.49, 4.84, -29.0);
  b.bx('wood_dark', 5.49, 4.4, -32.06, 8.93, 4.84, -32.0);
  const soff = shade(L, 'atr_soffit', 1.4, 0xffd7a8);
  for (let z = -16; z >= -38; z -= 4) downlight(b, soff, 10.5, 4.5, z, 0.07);
  fixture(L, soff, new THREE.Vector3(10.5, 4.5, -27));
  // a bench and a fig against the colonnade's east wall
  // (no planters in the colonnade: it is the husks' way from the quarters to the stair)
  // doors from the garden: wood casings on the atrium side
  doorCasing(b, L, { x: -12, z: -39, wall: 'x', w: 2.4, front: 'Canteen', sides: [1] });
  doorCasing(b, L, { x: 12, z: -19, wall: 'x', back: 'Clinic', sides: [-1] });
  doorCasing(b, L, { x: 12, z: -31, wall: 'x', back: 'Quarters — Ring A', sides: [-1] });

  // café kiosk (shutter down, chalkboard CLOSED — BACK 07:00); p3_garden_shells lies on its counter
  b.bx('wood_veneer', 10.95, 0, -16.6, 11.8, 2.6, -13.4);
  b.bx('wood_dark', 10.9, 2.6, -16.65, 11.8, 2.85, -13.35);
  b.detail(() => { for (let y = 1.08; y < 2.5; y += 0.09) b.bx('painted_white', 10.93, y, -16.4, 10.95, y + 0.07, -13.6); });
  b.bx('wood_dark', 10.15, 0, -16.4, 10.95, 0.98, -13.6);
  b.bx('stone_pale', 10.1, 0.98, -16.45, 10.97, 1.03, -13.55);
  b.collide(10.1, 0, -16.6, 11.8, 2.85, -13.4, 'concrete', true);
  const menu = canvasMat(L, 'cafe_board', 256, 340, (c, W, Hh) => {
    c.fillStyle = '#20231f'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#f2ead8'; c.font = '700 38px "Marker Felt", "Comic Sans MS", sans-serif'; c.textAlign = 'center';
    c.fillText('폐쇄', W / 2, 70); c.font = '500 30px "Marker Felt", "Comic Sans MS", sans-serif'; c.fillText('07:00 복귀', W / 2, 120);
    c.fillStyle = '#d9a75a'; c.font = '500 22px "Marker Felt", "Comic Sans MS", sans-serif';
    ['coffee  1.20', 'tea  0.90', 'cardamom bun  1.50', 'soup of the day'].forEach((t, i) => c.fillText(t, W / 2, 190 + i * 34));
  });
  b.at(9.95, 0, -17.0, -PI / 2 + 0.3, () => {
    b.push(0, 0, 0.12, 0, 0.18); b.bx('wood_dark', -0.27, 0, -0.02, 0.27, 0.85, 0.0); b.quad(menu, 0, 0.47, 0.008, 0.46, 0.66, '+z'); b.pop();
    b.push(0, 0, -0.12, 0, -0.18); b.bx('wood_dark', -0.27, 0, 0.0, 0.27, 0.85, 0.02); b.pop();
  });
  b.sign('Café', 'wayfinding', 10.895, 2.72, -15.0, 0.7, 0.2, '-x');
  b.at(10.55, 1.03, -14.2, 0, () => { b.cyl('chrome', 0, 0.18, 0, 0.09, 0.36, 'y', 12); b.cyl('painted_dark', 0, 0.38, 0, 0.05, 0.04, 'y', 10); });
}

function balcony(L: LevelBuild, b: Builder, R: Rng) {
  const Y = D2;
  // planters along the east wall (ferns), a bench, wayfinding
  for (const z of [-15.6, -21.0, -26.4]) {
    b.bx('wood_dark', 11.36, Y, z - 0.7, 11.8, Y + 0.5, z + 0.7);
    b.bx('soil', 11.4, Y + 0.5, z - 0.66, 11.76, Y + 0.52, z + 0.66);
    b.collide(11.36, Y, z - 0.7, 11.8, Y + 0.5, z + 0.7, 'concrete', true);
    for (const dz of [-0.4, 0.05, 0.45]) fern(b, 11.58, Y + 0.5, z + dz, R.range(0.55, 0.75), R, 8);
  }
  b.at(11.5, Y, -34.0, -PI / 2, () => bench3(b, 1.8, 'wood_dark', 'wood_veneer', true, true));
  wayfind(b, 'Biological Systems →', 11.795, Y + 2.15, -30.5, 1.6, 0.36, '-x');
  wayfind(b, 'North Gallery ←', 11.795, Y + 2.15, -17.5, 1.3, 0.3, '-x');
  // pictures along the balcony wall (the habitat's own photo club, by the look of them)
  alongWall(b, '-x', 11.8, Y, () => {
    pictureFrame(b, artMat(L, 'fjord', 11), -23.7, 1.7, 1.4, 1.0);
    pictureFrame(b, artMat(L, 'abstract', 12), -19.0, 1.65, 0.9, 0.7);
    pictureFrame(b, artMat(L, 'seabed', 13), -28.4, 1.65, 0.9, 0.7);
    pictureFrame(b, artMat(L, 'photo', 14), -33.6, 1.7, 0.7, 0.52);
  });
  // sign3_bio: BIOLOGICAL SYSTEMS plate; NAVAL SECURITY AREA painted over; tape notice
  const sx = 11.8;
  b.bx('painted_white', sx - 0.012, Y + 1.15, -36.95, sx, Y + 1.85, -35.85);
  b.sign('BIOLOGICAL SYSTEMS', 'label', sx - 0.013, Y + 1.72, -36.4, 1.0, 0.16, '-x');
  b.bx(paint(L, 0x8d8a7e, 0.8), sx - 0.024, Y + 1.38, -36.86, sx - 0.012, Y + 1.6, -35.94);
  b.sign('NAVAL SECURITY AREA', 'stencil', sx - 0.025, Y + 1.49, -36.4, 0.85, 0.16, '-x');
  b.detail(() => {
    b.rbox(paper(L, 0xf1e6a0), sx - 0.032, Y + 1.3, -36.25, 0.003, 0.2, 0.32, 0, 0, 0.06);
    b.rbox(paper(L, 0xe8dcb5), sx - 0.034, Y + 1.27, -36.6, 0.003, 0.12, 0.08, 0, 0, -0.3);
  });
  // alcove cabinet under the reader (p3_bio_med / p3_bio_ammo sit on it)
  b.bx('painted_white', 11.25, Y, -39.9, 11.65, Y + 0.68, -39.15);
  b.bx('stone_pale', 11.23, Y + 0.68, -39.92, 11.67, Y + 0.7, -39.13);
  b.detail(() => b.sign('FIRST AID', 'label', 11.24, Y + 0.5, -39.52, 0.4, 0.1, '-x'));
  b.collide(11.23, Y, -39.92, 11.8, Y + 0.7, -39.13, 'metal', true);
  // reader bezel
  b.bx('plastic_dark', 11.77, Y + 0.98, -39.64, 11.8, Y + 1.32, -39.36);
}

// ───────────────────────────────────────────────────────────── the garden

function garden(L: LevelBuild, g: Builder, R: Rng) {
  for (const [x0, z0, x1, z1] of BEDS) planterBed(g, x0, z0, x1, z1, 0.45, 0, R, 'wood_dark', 1.75, 0.06);
  for (const [x, z, h, cr] of TREES) tree(g, x, 0.39, z, h, cr, R, 900);
  // a few big potted plants at path corners; benches on the promenade and the north path
  pottedPlant(g, -10.9, 0, -12.8, 'palm', 1.2, R, 'stone_pale');
  pottedPlant(g, 8.4, 0, -40.8, 'fig', 1.3, R, paint(L, 0xb85c3c, 0.6));
  pottedPlant(g, -11.0, 0, -42.9, 'fern', 1.2, R, 'stone_pale');
  // a watering can and a trowel left on the edge of a bed
  g.at(-6.05, 0.49, -26.5, 0.6, () => { g.cyl(paint(L, 0x3f7a58, 0.5), 0, 0.12, 0, 0.1, 0.24, 'y', 12); g.rod(paint(L, 0x3f7a58, 0.5), 0.08, 0.08, 0, 0.28, 0.24, 0, 0.015, 6); });
  void grass; void foliage;
}

function westWall(L: LevelBuild, b: Builder, g: Builder, R: Rng) {
  // growing racks (herbs, lettuces) with purple grow-light strips, z −24 … −14.4
  const grow = mat3(L, 'atr_growlight', () => L.ctx.materials.clone('emissive_red', { emissive: new THREE.Color(0xb24cff), emissiveIntensity: 0.45, color: 0x2a1030 }));
  fixture(L, grow, new THREE.Vector3(-11.5, 1.5, -19.2));
  for (const [z0, z1] of [[-24.0, -19.4], [-19.0, -14.4]] as const) {
    const rack = paint(L, 0xd9d3c6, 0.55);
    for (const z of [z0, z1]) b.bx(rack, -11.8, 0, z - 0.02, -11.3, 2.1, z + 0.02);
    for (const y of [0.3, 0.8, 1.3, 1.8]) {
      b.bx(rack, -11.8, y - 0.03, z0, -11.3, y, z1);
      b.bx('soil', -11.75, y, z0 + 0.03, -11.35, y + 0.06, z1 - 0.03);
      b.bx(grow, -11.7, y + 0.42, z0 + 0.1, -11.66, y + 0.43, z1 - 0.1);
      for (let z = z0 + 0.15; z < z1 - 0.1; z += 0.22) {
        const lettuce = R.chance(0.5);
        for (let k = 0; k < 5; k++) leaf(g, lettuce ? 'broad' : 'blade', -11.55 + R.range(-0.08, 0.08), y + 0.05, z + R.range(-0.05, 0.05), R.range(0, PI * 2), lettuce ? R.range(0.8, 1.3) : R.range(0.1, 0.5), 0, lettuce ? 0.14 : 0.1, lettuce ? 0.14 : 0.22);
      }
    }
    b.collide(-11.8, 0, z0 - 0.02, -11.3, 2.1, z1 + 0.02, 'metal', true);
  }
  b.detail(() => b.sign('Kitchen garden — please ask before picking', 'wayfinding', -11.795, 2.4, -19.2, 1.9, 0.26, '+x'));
  // Ring B's cabin windows high on the west wall: blinds lit warm (or dark), one on its own material (`atr_blind`)
  const blind = (key: string, lit: number, seed: number) => canvasMat(L, `atr_blind_${key}`, 128, 160, (c, W, Hh) => {
    const r = (k: number) => { const x = Math.sin((k + seed) * 78.233) * 43758.5; return x - Math.floor(x); };
    c.fillStyle = lit > 0 ? '#e9b77a' : '#1b1a19'; c.fillRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y += 8) { c.fillStyle = lit > 0 ? `rgba(120,70,30,${0.25 + 0.1 * r(y)})` : 'rgba(255,255,255,0.04)'; c.fillRect(0, y, W, 2); }
    if (lit > 0 && seed % 2) { c.fillStyle = 'rgba(80,40,20,0.35)'; c.fillRect(W * 0.6, Hh * 0.35, W * 0.25, Hh * 0.65); }
  }, lit);
  const mats = [blind('a', 0.9, 1), blind('b', 0.55, 2), blind('c', 0, 3), blind('d', 0.75, 4)];
  const special = blind('vignette', 0.85, 5);
  const wins: [number, number, THREE.MeshStandardMaterial][] = [];
  let i = 0;
  for (const y of [6.5, 9.6]) for (const z of [-16.0, -20.4, -24.8, -29.2, -33.6, -38.0]) {
    const m = i === 7 ? special : mats[(i * 5 + 3) % mats.length];
    wins.push([y, z, m]); i++;
  }
  for (const [y, z, m] of wins) {
    const w = 1.3, h = 1.6;
    b.bx('wood_dark', -11.8, y - h / 2 - 0.07, z - w / 2 - 0.07, -11.74, y - h / 2, z + w / 2 + 0.07);
    b.bx('wood_dark', -11.8, y + h / 2, z - w / 2 - 0.07, -11.74, y + h / 2 + 0.07, z + w / 2 + 0.07);
    b.bx('wood_dark', -11.8, y - h / 2, z - w / 2 - 0.07, -11.74, y + h / 2, z - w / 2);
    b.bx('wood_dark', -11.8, y - h / 2, z + w / 2, -11.74, y + h / 2, z + w / 2 + 0.07);
    b.bx('stone_pale', -11.8, y - h / 2 - 0.1, z - w / 2 - 0.1, -11.66, y - h / 2 - 0.06, z + w / 2 + 0.1);
    b.quad(m, -11.79, y, z, w, h, '+x', 0, 'unit');
    if (m.emissiveIntensity > 0 && m !== special) fixture(L, m, new THREE.Vector3(-11.8, y, z));
  }
  // atr_blind: someone up in Ring B switches their light off
  const base = special.emissiveIntensity;
  L.vignette('atr_blind', () => L.tween(0, 0.25, (k) => { special.emissiveIntensity = base * (1 - k); }));
  void g;
}

export const ATRIUM_DRESS: Partial<Record<RoomId3, RoomDress>> = { atrium };
