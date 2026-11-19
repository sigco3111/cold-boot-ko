/**
 * SERVICE SPINE — x -21…-17, z -68…-30, h 3.0. A long, dark service corridor west of the booth: pipe
 * runs, cable trays, indicator strips along the floor, two bulkheads across it, the long window into
 * LINE CONTROL. Plus the short link passage from the hall's south-west door (not a room).
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { bolts4, cableBundle, floorSlab, grate, hazardStrip, panel, pipe, valve } from '../kit';
import { beacon, bulkhead, ceilingSlab, troffer, wallFace } from '../structure';
import { drum, crate } from '../props';
import { SPINE_WINDOWS } from './booth';

const PI = Math.PI;
const H = 3.0;

export function buildSpine(L: LevelBuild) {
  const b = L.builder('spine');
  const R = rng(2801);
  L.room('spine', '서비스 스파인', -21, -17, -68, -30, H);
  floorSlab(b, 'floor_plate', -21, -68, -17, -30, [[-19.4, -67.6, -18.6, -30.4]], 'metal');
  grate(b, -19.4, -67.6, -18.6, -30.4, 0, 1.2);
  b.detail(() => {
    b.bx('painted_dark', -19.45, -0.45, -67.6, -18.55, -0.4, -30.4);
    for (let i = 0; i < 4; i++) pipe(b, i % 2 ? 'copper' : 'steel_raw', [[-19.3 + i * 0.2, -0.3, -67.5], [-19.3 + i * 0.2, -0.3, -30.5]], 0.05, { every: 3 });
  });
  ceilingSlab(b, -21.2, -68, -16.8, -30, H);
  wallFace(b, { n: '+x', plane: -21, from: -67.8, to: -30.2, h: H, seed: 281, style: 'ribbed', trayY: 0, features: 0.35 });
  wallFace(b, {
    n: '-x', plane: -17.2, from: -67.8, to: -30.2, h: H, t: 0.2, seed: 282, style: 'ribbed', features: 0.2, clearWindows: true,
    openings: [...SPINE_WINDOWS.map((w) => ({ ...w, h: 1.5, y0: 0.95 })), { c: -46, w: 1.6, h: 2.4 }, { c: -66, w: 1.8, h: 2.6 }],
    clear: [[-50, -42]],
  });
  wallFace(b, { n: '-z', plane: -30.2, from: -21, to: -17, h: H, seed: 283, trayY: 0, features: 0, clear: [[-21, -17]] });
  wallFace(b, { n: '+z', plane: -67.8, from: -21, to: -17, h: H, seed: 284, trayY: 0, features: 0.4 });
  // the two bulkhead walls across the corridor
  for (const z of [-56, -36]) {
    wallFace(b, { n: '+z', plane: z + 0.2, from: -21, to: -17.2, h: H, t: 0.2, seed: 285, trayY: 0, features: 0, openings: [{ c: -19, w: 1.6, h: 2.4 }] });
    wallFace(b, { n: '-z', plane: z - 0.2, from: -21, to: -17.2, h: H, t: 0.2, seed: 286, trayY: 0, features: 0, openings: [{ c: -19, w: 1.6, h: 2.4 }] });
  }
  // ── the long pipe runs on the west wall, trays on the east ──
  b.detail(() => {
    for (const [y, r, m] of [[2.55, 0.11, 'steel_raw'], [2.25, 0.07, 'copper'], [2.02, 0.05, 'painted_orange'], [0.5, 0.08, 'steel_raw']] as const) {
      pipe(b, m, [[-20.75, y, -67.6], [-20.75, y, -56.6]], r, { every: 2.4 });
      pipe(b, m, [[-20.75, y, -55.4], [-20.75, y, -36.6]], r, { every: 2.4 });
      pipe(b, m, [[-20.75, y, -35.4], [-20.75, y, -30.4]], r, { every: 2.4 });
    }
    for (const z of [-62, -47, -33]) valve(b, -20.75, 2.55, z, 'z', 0.11, 'x', 1);
    for (let z = -67; z < -30.5; z += 1.6) b.box('steel_raw', -20.86, 1.5, z, 0.06, 1.6, 0.05);
    cableBundle(b, [-17.62, H - 0.2, -67.5], [-17.62, H - 0.2, -56.6], 4, 0.3, 0.02, 0.05, R);
    cableBundle(b, [-17.62, H - 0.2, -55.4], [-17.62, H - 0.2, -51], 4, 0.25, 0.02, 0.05, R);
    cableBundle(b, [-17.62, H - 0.2, -41], [-17.62, H - 0.2, -36.6], 4, 0.25, 0.02, 0.05, R);
  });
  // ── indicator strips along the floor: the only steady light in here ──
  const strip = L.ctx.materials.clone('emissive_green');
  strip.emissiveIntensity = 1.4;
  const stripA = L.ctx.materials.clone('emissive_amber');
  stripA.emissiveIntensity = 1.2;
  b.detail(() => {
    for (const x of [-20.93, -17.27]) for (let z = -67.5; z < -30.5; z += 0.9) {
      if ((z > -56.4 && z < -55.6) || (z > -36.4 && z < -35.6)) continue;
      if (x > -18 && ((z > -47.1 && z < -44.9) || (z > -67.2 && z < -64.8))) continue; // booth door, link opening
      b.box(Math.round(z * 10) % 7 === 0 ? stripA : strip, x, 0.12, z, 0.01, 0.025, 0.5);
    }
  });
  // ── doors' surrounds: hazard frames, labels ──
  for (const z of [-56, -36]) {
    b.detail(() => { hazardStrip(b, -20.9, z + 0.32, -17.3, z + 0.5); hazardStrip(b, -20.9, z - 0.5, -17.3, z - 0.32); });
    b.sign(z === -56 ? '격벽 C-2' : '격벽 C-1', 'stencil', -20.0 + 1.0, 2.75, z + 0.205, 1.2, 0.18, '+z');
  }
  // north end: a sealed blast door to section B (not a door anyone uses)
  b.at(-19, 0, -30.2, PI, () => {
    b.box('painted_yellow', 0, 1.35, 0.06, 2.6, 2.7, 0.12);
    b.detail(() => {
      for (let i = 0; i < 5; i++) b.box('hazard_stripes', -1.0 + i * 0.5, 1.35, 0.125, 0.18, 2.5, 0.004);
      panel(b, 'trim_steel', -1.1, 0.2, 1.1, 2.5, 0.12, 0.03, 0.03);
      b.sign('구역 B — 봉쇄됨', 'danger', 0, 1.6, 0.16, 1.4, 0.2, '+z', 0, true);
      bolts4(b, -1.25, 0.05, 1.25, 2.65, 0.12);
    });
  });
  // clutter: a drum, a crate, a dropped helmet
  b.at(-20.4, 0, -41.0, 0, () => drum(b, 'painted_yellow'));
  b.at(-20.35, 0, -60.5, 0.2, () => crate(b, 0.9, 0.7, 0.8, 'painted_dark', '예비품'));
  b.detail(() => b.sphere('painted_yellow', -18.0, 0.1, -52.6, 0.14, 10, 0.75));
  L.pickup('p2_spine_ammo', 'ammo_pistol', -20.4, 0.9, -41.0, 12, 0.2);
  b.sign('서비스 스파인 — 구역 C', 'stencil', -20.98, 2.0, -62, 2.6, 0.3, '+x');
  b.sign('라인 관제 →', 'directional', -20.98, 1.7, -52.5, 1.0, 0.2, '+x', 0, true);

  // ── light: a few dim fittings (some dead), red beacons for emergencies ──
  let gm: THREE.Material | undefined;
  for (const [z, dead] of [[-64, false], [-58.5, true], [-53, false], [-39, true], [-33, false]] as const) {
    const h = troffer(b, L, { group: 'spine', x: -19, y: H, z, axis: 'z', len: 1.2, intensity: 14, distance: 5.5, angle: 1.25, color: 0xbfd8e8, flicker: z === -53 ? 'fluorescent' : 'none', dead, glowMat: gm });
    gm = (h as any)?.glowMat ?? gm;
  }
  // amber service lamps low on the west wall: small pools you walk from one to the next
  for (const z of [-61, -50.5, -41.5, -33.5]) b.at(-21, 0, z, PI / 2, () => bulkhead(b, L, 'spine', 0, 1.9, 0, 0xffa050, 3.2, 4.2, 'emissive_amber', { flicker: z === -50.5 ? 'broken' : 'none' }));
  for (const z of [-60, -44, -32]) beacon(b, L, 'spine_emergency', -20.9, 2.5, z, -1, 0xff2a12, 34, 8, 'emissive_red', false, 'alarm');
  // the window from this side: the booth is warm; the spine is not
  b.at(-17.2, 0, -46, -PI / 2, () => b.detail(() => b.sign('라인 관제', 'label', 0, 2.62, 0.01, 1.0, 0.13, '+z')));

  // ── the link passage: hall door (x = -10) → spine (x = -17) at z ≈ -66 ──
  const lp = L.builder('spine_link');
  lp.rooms = ['line', 'spine'];
  floorSlab(lp, 'floor_plate', -17.2, -67.0, -10.0, -65.0, [], 'metal');
  ceilingSlab(lp, -17.0, -67.0, -10.0, -65.0, 2.8); // behind the spine's wall face
  wallFace(lp, { n: '-z', plane: -65.1, from: -17.2, to: -10.2, h: 2.8, t: 0.2, seed: 287, style: 'ribbed', trayY: 0, features: 0.2 });
  wallFace(lp, { n: '+z', plane: -66.9, from: -17.2, to: -10.2, h: 2.8, t: 0.2, seed: 288, style: 'ribbed', trayY: 0, features: 0.2 });
  // d2_spine's leaf pockets: solid wall behind the open leaves on the link side too
  for (const [za, zb] of [[-67.8, -67.1], [-64.9, -64.2]] as const) lp.bx('wall_panel_dark', -10.3, 0, za, -10.0, 2.8, zb);
  lp.at(-13.6, 0, -66.9, 0, () => bulkhead(lp, L, 'spine', 0, 2.2, 0, 0xffb070, 2.2, 4, 'emissive_warm', { flicker: 'broken' }));
  lp.detail(() => pipe(lp, 'copper', [[-17.2, 2.5, -65.35], [-10.2, 2.5, -65.35]], 0.04, { every: 1.5 }));
  for (const x of [-16.4, -14.8, -13.2, -11.6]) L.navNode(x, -66, 'spine');

  // (REVISION 5.1: g2_spine deleted — no fight on the way to the trap)

  // spine_bulkheads (REVISION 5.1): the SOUTH bulkhead grinds open (d2_bulkhead_n never opens again). Door
  // state itself belongs to phases.ts; this is the moment's shudder and sound (+ the opening, if unlocked).
  L.vignette('spine_bulkheads', () => {
    const d = L.doors.get('d2_bulkhead_s');
    if (!d) return;
    d.shake(0.02, 1.2);
    L.after(0.6, () => { if (!d.locked) d.open(); });
    L.sfx('bulkhead_grind', d.position.x, 1.4, d.position.z, 1);
  });
  void R;
}
