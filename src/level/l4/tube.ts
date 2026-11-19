/**
 * BIOLOGICAL SYSTEMS — the transfer tube and the Post 4 gate lock (stage 3b §2.6, §2.7, §2.9, §4.6; task D3b).
 *
 * Contract (see ./index.ts `RoomDress`, ./grey.ts header):
 *   export const TUBE_DRESS: Partial<Record<RoomId4, RoomDress>>
 * for the rooms tube, gatel. Per room: build(L) / lights / look / label as in entry.ts.
 * The shell already made (do NOT re-create): the panes (x 30 / 34, split at the ring), the sea voids (no faces), the
 *   bulkhead ring (solid grid structure at z −87.25 … −86.75, opening x 30.7 … 33.3, y 0 … 3.0 — build the kit ring
 *   1 cm proud of it, no colliders); screen gate_panel; marker mk4_gate_panel; the sealed gate `gate4` with its dogs
 *   `gate4_dogs` (L.objects; `userData.set(k)` 0 engaged … 1 retracted, `userData.edges`; each edge a registered mover);
 *   the placeholder end button `l4_stub_end` (K's stub story; removed at I1).
 * Vignette this task defines (greybox placeholder exists until it does): `gate_dogs`.
 * Viewports: `fx.viewport` west / east per §2.9 with `rooms: ['tube']`.
 *
 * As built (D3b):
 *  - tube: 8 ribs every 4 m from the ring (z −71 … −103, frame numbers stencilled), the arched roof with its cable spine,
 *    the grated deck (visual: the walk surface stays the shell floor 4 cm under it, so nav and doors are unchanged),
 *    base pipe runs under the glass, the kit bulkhead ring 1 cm proud of the shell ring (no colliders on the collar; the
 *    two emergency lockers that carry `p4_tube_plate` / `p4_tube_ammo` collide), and three 1.05 m wall cabinets
 *    (emergency air, fire hose, cable transit) as crouch cover for the tube fight, staggered so the 40 m line is never
 *    a clear lane and never a maze. The panes are restyled from the greybox `glass` (grimy, streaky — read as a smeared
 *    white blob where a spine light reflects) to a clean, faintly blue pressure-glass clone with a lower reflection gain.
 *  - the sea: the two §2.9 viewports (`fx4_sea_w`, `fx4_sea_e`), `rooms: ['tube']`, `seenFrom: ['chk', 'gatel']`; their
 *    handles on the level object `tube_fx` (`userData = { west, east }`) for the story (setState / summon).
 *  - gatel: navy grey lock, two steel benches on the side walls, a gauge board and pressure stencils, the hold-back line
 *    in front of the gate, a palm-reader plate under the `gate_panel` screen, a cable tray overhead.
 *  - `gate_dogs`: the four dog groups withdraw one edge after another on the sound's clacks (left, right, top, bottom,
 *    0.25 … 1.44 s), the seat lets go at 1.85 s (small camera trauma within 8 m, a puff of condensate at the seam).
 */
import * as THREE from 'three';
import type { LevelBuild } from '../context';
import type { Builder, Mat } from '../builder';
import type { FxSystemEx } from '../../fx/index';
import type { LightRow } from '../l3/grey';
import { restyle } from '../l3/kit3';
import { bulkheadRing, deckLine, dialFaceMat, glow4, gratedDeck, mat4, stencil, tubeRib, tubeRoof } from './kit4';
import type { RoomId4 } from './grey';
import type { RoomDress } from './index';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Tube geometry (§2.1): x 30 … 34 (interior 30.2 … 33.8), z −107 … −67, floor 0, panes y 0.4 … 3.0, ring at z −87. */
const TX = 32, RING_Z = -87, Z_N = -67.2, Z_S = -106.8;
/** Ribs every 4 m from the ring (the ring itself is the ninth frame). */
const RIBS = [-71, -75, -79, -83, -91, -95, -99, -103];

// ───────────────────────────────────────────────────────────── materials

/**
 * Pressure glass: clean, a little blue-green in its thickness. The probe reflection stays (the tube's ribs and lamps
 * mirrored over the black water: it reads as glass); the spine lamps' PUNCTUAL highlight is scaled to 3 % — a point lamp
 * 2 m from a 0.12-rough pane peaks at ≈ 60 × its irradiance and printed a hard white "moon" on both faces of each pane
 * (still saturated at 20 %), which read as glare, not as a reflection of the dim spine lens.
 * (glass_clear's roughness lives in its map, ≈ 0.01, and the `roughness` factor multiplies it: the map is dropped for a
 * flat 0.12 so what is left of the highlight is a soft sheen.)
 */
function tubeGlass(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd3b_tube_glass', () => {
    const m = L.ctx.materials.clone('glass_clear', { color: 0xa9c4c8, roughnessMap: null, roughness: 0.12 }) as THREE.MeshStandardMaterial;
    const base = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      base.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.directSpecular *= 0.03;');
    };
    m.customProgramCacheKey = () => `${key.call(m)}-d3b-tube-glass`;
    return m;
  });
}
/** The palm reader's glass: near-black, a faint cyan hand outline and a scan bar (emissive map, ≤ 0.35 by the kit rule). */
function palmMat(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd3b_palm', () => {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, 160, 192);
    g.strokeStyle = '#6fe0ee'; g.lineWidth = 4; g.lineJoin = 'round';
    g.strokeRect(6, 6, 148, 180);
    // palm + four fingers + thumb as rounded strokes
    const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke(); };
    rr(46, 92, 70, 70, 18);
    for (const [x, top] of [[46, 30], [64, 20], [82, 24], [100, 38]] as const) rr(x, top, 15, 96 - top, 7);
    g.save(); g.translate(46, 120); g.rotate(-0.7); rr(-14, -6, 15, 46, 7); g.restore();
    g.globalAlpha = 0.5; g.fillStyle = '#6fe0ee'; g.fillRect(14, 104, 132, 3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return L.ctx.materials.clone('screen_off', { map: null, color: 0x0a0d0e, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.3 }) as THREE.MeshStandardMaterial;
  });
}
const kick = (L: LevelBuild) => mat4(L, 'd3b_kick', () => L.ctx.materials.clone('painted_dark', { color: 0x2c3236 }));

// ───────────────────────────────────────────────────────────── tube

function tubeBuild(L: LevelBuild) {
  const b = L.builder('tube_dress');
  // the shell's panes → pressure glass
  const grey = L.ctx.materials.get('glass');
  restyle(L, 'tube_grey', (m) => m === grey, tubeGlass(L));

  // ribs (frame numbers counted from the checkpoint end), roof segments between them, grated deck
  RIBS.forEach((z, i) => {
    // (ridge 1 cm low: the kit rib's crown splice plate shared the y 3.40 plane with the roof's cable tray underside)
    b.at(TX, 0, z, 0, () => tubeRib(b, L, { ridge: 3.59 }));
    const n = i < 4 ? i + 1 : i + 2; // the ring is frame 5
    for (const s of [-1, 1]) stencil(b, `F${String(n).padStart(2, '0')}`, TX + s * 1.79, 2.55, z + 0.105, 0.14, 0.08, '+z');
  });
  // the spine's lens: dim and dark-bodied (the kit's 0.3 on a pale lens, 13 cm above the spine lamp, blew out to a white bar)
  const spine = glow4(L, 'd3b_spine', 0xcfe4ff, 0.06, 0x0e1012);
  const cuts = [Z_N, ...RIBS, Z_S].sort((a, c) => c - a);
  for (let i = 0; i < cuts.length - 1; i++) {
    const z0 = cuts[i], z1 = cuts[i + 1], len = z0 - z1;
    b.at(TX, 0, (z0 + z1) / 2, 0, () => tubeRoof(b, L, { len, spine }));
  }
  for (let z = Z_N; z > Z_S + 1e-3; z -= 3.96) b.at(TX, 0, z - 1.98, 0, () => gratedDeck(b, L, { len: 3.96, collide: false }));

  // kick plates under the glass (y 0 … 0.4 is wall), two pipe runs at their foot, broken by the ring
  const K = kick(L);
  for (const s of [-1, 1]) {
    const xw = TX + s * 1.8; // interior wall face
    b.bx(K, Math.min(xw, xw - s * 0.012), 0.05, Z_S, Math.max(xw, xw - s * 0.012), 0.38, Z_N);
    for (const [za, zb] of [[Z_N, RING_Z + 0.75], [RING_Z - 0.3, Z_S]] as const) {
      b.cyl('steel_raw', xw - s * 0.09, 0.13, (za + zb) / 2, 0.045, za - zb, 'z', 8);
      b.detail(() => {
        b.cyl('painted_dark', xw - s * 0.2, 0.09, (za + zb) / 2, 0.028, za - zb, 'z', 6);
        for (let z = za - 1.0; z > zb + 0.5; z -= 2.0) b.cyl('steel_raw', xw - s * 0.09, 0.13, z, 0.058, 0.03, 'z', 10); // flanges
      });
    }
    // pipe ends at the ring: flange caps
    b.detail(() => { for (const z of [RING_Z + 0.75, RING_Z - 0.3]) b.cyl('steel_raw', xw - s * 0.09, 0.13, z, 0.06, 0.03, 'z', 10); });
  }

  // the bulkhead ring: kit collar 1 cm proud of the shell's ring on both faces (no collider), its lockers collide
  // (opening 1 cm inside the shell's 2.6 × 3.0 on the jambs and the header: their faces were coplanar)
  b.at(TX, 0, RING_Z, 0, () => bulkheadRing(b, L, { depth: 0.52, opening: [2.58, 2.99], collide: false }));
  for (const sx of [-1, 1]) b.collide(TX + sx * 1.4 - 0.3, 0, RING_Z + 0.28, TX + sx * 1.4 + 0.3, 0.38, RING_Z + 0.58, 'metal', true);
  stencil(b, '프레임 05 — 격벽', TX, 3.23, RING_Z + 0.3, 1.0, 0.1, '+z');
  stencil(b, '수심 2 104 M', TX, 3.23, RING_Z - 0.3, 0.8, 0.1, '-z');

  // cover: three wall cabinets (1.05 m), staggered between frames
  cabinet(b, L, -1, -81.0, '비상 공기', 'eba');
  cabinet(b, L, 1, -93.0, '소화 호스', 'hose');
  cabinet(b, L, -1, -99.0, '케이블 관통구 — 열지 마세요', 'mct');

  // end-wall stencils
  stencil(b, '이송 튜브 T-4 — 40 M — 초소 4 →', TX + 1.0, 3.1, Z_N - 0.005, 1.4, 0.09, '-z');
  stencil(b, '← 해군 검문소 2', TX - 1.1, 3.1, Z_S + 0.005, 1.0, 0.09, '+z');

  // the tube's steel a shade darker than the checkpoint's haze grey: 1–2 m from the spine lamps the kit's navy_grey went
  // pale and the frames read as lit showroom columns against the water
  restyle(L, 'tube_dress', (m) => m.name === 'navy_grey', mat4(L, 'd3b_tube_steel', () => L.ctx.materials.clone('navy_grey', { color: 0x9aa4ac })));

  // the sea (§2.9): two viewports, drawn only while the tube is drawn and only along rays through their panes
  const fx = L.ctx.fx as FxSystemEx;
  const common = { width: 34, height: 2.6, depth: 12, spread: 0.1, visibility: 6, seabed: -2, shapes: 1, shapeGap: 90, state: 'cold' as const, rooms: ['tube'], seenFrom: ['chk', 'gatel'], heads: 0.6, desat: 0.7 };
  const west = fx.viewport({
    ...common, id: 'fx4_sea_w', position: V(30.0, 1.7, RING_Z), normal: V(1, 0, 0), cable: null,
    // (B8: the flood heads stand 2.5 m out in the water at y ≈ 2.6, inside the pane's view — each beam starts at a lamp
    // you can see; at 1 m out and 3.9 high they hid above the pane and the cones read as unexplained glows)
    floods: [{ at: [0, 0.9, 2.5], dir: [0, -1, 0.55], intensity: 0.55 }, { at: [-12, 0.9, 2.5], dir: [0.1, -1, 0.55], intensity: 0.45 }],
  });
  const east = fx.viewport({
    ...common, id: 'fx4_sea_e', position: V(34.0, 1.7, RING_Z), normal: V(-1, 0, 0),
    cable: { from: V(40, -3, -101), to: V(44, 30, -112), radius: 0.08, markers: 3 },
    floods: [{ at: [-8, 0.8, 3.0], dir: [0.2, -1, 0.65], intensity: 0.7 }, { at: [10, 0.9, 2.5], dir: [0, -1, 0.55], intensity: 0.45 }],
  });
  const o = L.marker('tube_fx', TX, 1.7, RING_Z);
  o.userData = { west, east };
}

/** A 1.05 m wall cabinet on side `s` (−1 west, +1 east) centred at z: steel carcass, door with a stencil, a collider. */
function cabinet(b: Builder, L: LevelBuild, s: number, z: number, label: string, kind: 'eba' | 'hose' | 'mct') {
  // (carcass 1.5 cm off the wall, clear of the kick plate's face; it stands on its plinth, not on the floor plane)
  const xw = TX + s * 1.785, d = 0.445, len = 1.3, h = 1.05;
  const xi = xw - s * d, x0 = Math.min(xw, xi), x1 = Math.max(xw, xi);
  const N: Mat = 'navy_grey';
  b.bx(N, x0, 0.05, z - len / 2, x1, h, z + len / 2);
  b.detail(() => {
    const face = s < 0 ? '+x' : '-x';
    const xf = xi - s * 0.012;
    // door panels, hinges, latch
    for (const zz of [z - len / 4, z + len / 4]) {
      b.bx('steel_raw', Math.min(xi, xf), 0.08, zz - len / 4 + 0.03, Math.max(xi, xf), h - 0.06, zz + len / 4 - 0.03);
    }
    const xl = xi + s * 0.01, xL = xf - s * 0.02;
    b.bx('painted_dark', Math.min(xl, xL), 0.5, z - 0.05, Math.max(xl, xL), 0.62, z + 0.05);
    // plinth and top lip (proud on the room side only: the wall side stays flush with the carcass, off the kick plate)
    const xp = xi - s * 0.01, xq = xi - s * 0.015;
    const xb = xw - s * 0.006;
    b.bx('painted_dark', Math.min(xb, xp), 0, z - len / 2 - 0.01, Math.max(xb, xp), 0.06, z + len / 2 + 0.01);
    b.bx(N, Math.min(xw, xq), h, z - len / 2 - 0.015, Math.max(xw, xq), h + 0.025, z + len / 2 + 0.015);
    b.sign(label, 'stencil', xf - s * 0.004, h - 0.2, z, Math.min(1.1, 0.07 * label.length + 0.2), 0.09, face);
    if (kind === 'hose') b.bx('painted_orange', Math.min(xf, xf - s * 0.006), h - 0.36, z - 0.5, Math.max(xf, xf - s * 0.006), h - 0.3, z + 0.5);
    if (kind === 'eba') b.bx('painted_yellow', Math.min(xf, xf - s * 0.006), h - 0.36, z - 0.5, Math.max(xf, xf - s * 0.006), h - 0.3, z + 0.5);
  });
  b.collide(x0, 0, z - len / 2, x1, h, z + len / 2, 'metal', true);
}

/** §2.7 tube: two spine points (all) at z −78 / −96, two more (medium+) at the ends. Cold, low, bounded to the tube. */
const TUBE_LIGHTS: LightRow[] = [
  // (LOW has only these two: at the plan's −78 / −96 with d 12 the last 8 m before the gate lock went near-black on LOW;
  // −76 / −98 with d 14 keep the whole walk readable, the ring between them in their overlap)
  { group: 'tube', type: 'point', p: [TX, 3.15, -79], color: 0xc4dcf4, i: 8, d: 14 }, // (B10: 7 m either side of the ring — the fight's centre was the darkest stretch)
  { group: 'tube', type: 'point', p: [TX, 3.15, -93], color: 0xc4dcf4, i: 8, d: 14 },
  { group: 'tube', type: 'point', p: [TX, 3.15, -70], color: 0xc4dcf4, i: 4, d: 8, min: 'medium' },
  { group: 'tube', type: 'point', p: [TX, 3.15, -104], color: 0xc4dcf4, i: 4, d: 8, min: 'medium' },
];

// ───────────────────────────────────────────────────────────── gate lock

const NAVY = 0xffe2c0;
const GATEL_LIGHTS: LightRow[] = [
  { group: 'gatel', type: 'spot', p: [TX, 3.4, -108.4], t: [TX, 0.9, -112.6], color: NAVY, i: 12, d: 7, angle: 0.95, cast: true, min: 'medium' },
  { group: 'gatel', type: 'point', p: [TX, 3.3, -109.6], color: NAVY, i: 8, d: 8 },
];

function gatelBuild(L: LevelBuild) {
  const b = L.builder('gatel_dress');
  const N: Mat = 'navy_grey';
  // benches on the side walls (steel frame, slatted seat), clear of the spawns (x ≥ 30.6 / ≤ 33.4) and the door
  for (const s of [-1, 1]) {
    const xw = TX + s * 2.8, xi = xw - s * 0.42, x0 = Math.min(xw, xi), x1 = Math.max(xw, xi), z0 = -111.7, z1 = -108.3;
    for (let k = 0; k < 4; k++) {
      const za = z0 + 0.02 + k * ((z1 - z0) / 4), zb = za + (z1 - z0) / 4 - 0.04;
      b.bx('steel_raw', x0 + 0.02, 0.42, za, x1 - 0.02, 0.46, zb);
    }
    for (const z of [z0 + 0.1, (z0 + z1) / 2, z1 - 0.1]) {
      b.bx(N, x0 + 0.04, 0, z - 0.03, x0 + 0.08, 0.42, z + 0.03).bx(N, x1 - 0.08, 0, z - 0.03, x1 - 0.04, 0.42, z + 0.03);
      b.bx(N, x0 + 0.04, 0.38, z - 0.03, x1 - 0.04, 0.42, z + 0.03);
    }
    b.detail(() => b.bx(N, Math.min(xw, xw - s * 0.03), 0.75, z0, Math.max(xw, xw - s * 0.03), 0.85, z1)); // back rail
    b.collide(x0, 0, z0, x1, 0.46, z1, 'metal', true);
  }

  // gauge board on the west wall by the gate: two dials (tube / Post 4) and a stencil
  const xw = TX - 2.8;
  b.bx(N, xw, 1.35, -112.45, xw + 0.03, 1.95, -111.35);
  const dial = dialFaceMat(L);
  b.detail(() => {
    for (const [z, t] of [[-112.15, '튜브'], [-111.65, '초소 4']] as const) {
      b.cyl('steel_raw', xw + 0.05, 1.7, z, 0.12, 0.04, 'x', 16);
      b.quad(dial, xw + 0.072, 1.7, z, 0.2, 0.2, '+x', 0, 'unit', 0.001);
      b.sign(t, 'stencil', xw + 0.034, 1.47, z, 0.3, 0.07, '+x');
    }
    b.sign('Δp — BAR', 'stencil', xw + 0.034, 1.88, -111.9, 0.5, 0.07, '+x');
    // gauge lines down to the floor
    for (const z of [-112.15, -111.65]) b.cyl('steel_raw', xw + 0.04, 0.68, z, 0.012, 1.36, 'y', 6);
  });

  // palm reader under the gate panel (screen 0.4 × 0.26 at (34.1, 1.6, −112.78)): housings behind both
  const zf = -112.8;
  b.bx('painted_dark', 33.86, 1.44, zf, 34.34, 1.76, zf + 0.015);
  b.bx('painted_dark', 33.97, 1.0, zf, 34.23, 1.3, zf + 0.025);
  b.detail(() => {
    b.quad(palmMat(L), 34.1, 1.15, zf + 0.027, 0.2, 0.24, '+z', 0, 'unit', 0.001);
    b.sign('손바닥', 'label', 34.1, 1.035, zf + 0.026, 0.12, 0.035, '+z');
  });
  // (label: false also drops the shell builder's signs — the sealed gate's lintel label is put back here, as kit.ts lays it)
  b.detail(() => b.sign('초소 4', 'label', TX, 2.8 + 0.155, -113 + 0.32, 0.84, 0.13, '+z'));
  stencil(b, '초소 4 — 압력 게이트 — 해군 전용', TX, 3.35, zf + 0.005, 2.6, 0.12, '+z');
  stencil(b, '초소 4 — 게이트 록', TX + 2.79, 2.3, -109.6, 0.95, 0.1, '-x');

  // the lock is a pressure vessel: frames on the side walls (channel posts + a header), a rub rail
  for (const s of [-1, 1]) {
    const xw2 = TX + s * 2.8, xi = xw2 - s * 0.1, x0 = Math.min(xw2, xi), x1 = Math.max(xw2, xi);
    for (const z of [-108.6, -110.9]) {
      b.bx(N, x0, 0, z - 0.07, x1, 3.6, z + 0.07);
      b.detail(() => b.bx('steel_raw', Math.min(xi, xi - s * 0.01), 0, z - 0.05, Math.max(xi, xi - s * 0.01), 3.6, z + 0.05));
    }
    b.bx(N, x0, 3.2, -112.8, x1, 3.36, -107.2);
    b.detail(() => b.bx(N, Math.min(xw2, xw2 - s * 0.05), 1.12, -112.8, Math.max(xw2, xw2 - s * 0.05), 1.2, -107.2));
  }

  // hold-back line and keep-clear stencil in front of the gate
  deckLine(b, L, TX - 1.9, -112.1, TX + 1.9, -112.1, { w: 0.1 });
  stencil(b, '앞을 비워 두세요', TX, 0.003, -111.75, 1.0, 0.16, '+y');

  // cable tray along the ceiling (north–south) and the gate's hydraulic lines across the south wall top
  b.detail(() => {
    b.bx(N, TX + 1.6, 3.4, -112.8, TX + 1.95, 3.42, -107.2);
    for (const s of [-1, 1]) b.bx(N, TX + 1.775 + s * 0.175 - 0.006, 3.42, -112.8, TX + 1.775 + s * 0.175 + 0.006, 3.5, -107.2);
    for (let k = 0; k < 4; k++) b.cyl('rubber', TX + 1.66 + k * 0.08, 3.45, -110, 0.022, 5.6, 'z', 6);
    for (const y of [3.05, 3.16]) b.cyl('steel_raw', TX, y, -112.72, 0.03, 5.5, 'x', 8);
  });
}

// ───────────────────────────────────────────────────────────── gate_dogs (§4.6)

/** Withdraw the dogs on the sound's clacks (rev9 `gate_dogs`: 8 clacks 0.25 … 1.44 s, the seat lets go at 1.85 s). */
function gateDogs(L: LevelBuild) {
  L.vignette('gate_dogs', () => {
    L.sfx('gate_dogs', TX, 1.4, -112.6);
    const grp = L.objects.get('gate4_dogs');
    const edges = (grp?.userData.edges ?? []) as { obj: THREE.Object3D; dir: THREE.Vector3 }[];
    const travel = (grp?.userData.travel as number | undefined) ?? 0.1;
    const UP = V(0, 1, 0);
    // edges: left, right, top, bottom (kit order); each takes two clacks (0.34 s), eased in steps
    edges.forEach((e, i) => {
      const local = e.dir.clone().applyAxisAngle(UP, -(grp?.rotation.y ?? 0));
      L.tween(0.25 + i * 0.34, 0.34, (k) => {
        const q = k < 0.5 ? 0.55 * Math.min(1, k / 0.18) : 0.55 + 0.45 * Math.min(1, (k - 0.5) / 0.18);
        e.obj.position.copy(local).multiplyScalar(travel * q);
      });
    });
    L.after(1.85, () => {
      const p = L.ctx.player;
      if (p && p.position.distanceTo(V(TX, 0, -112.6)) < 8) p.shake(0.12);
      L.ctx.fx.smoke(V(TX, 2.75, -112.6), { count: 5, size: 0.35, color: 0xb8c4cc, rise: 0.15, life: 1.6 });
    });
  });
}

export const TUBE_DRESS: Partial<Record<RoomId4, RoomDress>> = {
  tube: {
    build: tubeBuild,
    lights: TUBE_LIGHTS,
    look: { wall: 'navy_grey', ceiling: 'navy_grey', floor: 'floor_plate' },
    label: false,
  },
  gatel: {
    build(L) { gatelBuild(L); gateDogs(L); },
    lights: GATEL_LIGHTS,
    look: { wall: 'navy_grey', ceiling: 'ceiling_panel', floor: 'deck_nonslip' },
    label: false,
  },
};
