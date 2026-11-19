/**
 * LEVEL 6 — dressing of shaft6 (stage 3d §2.6.8, §2.7.1, §2.7.3, §4.7, §5.7 #7; task D3b): the stair shaft from the cable
 * vault (L0, y 0) down 12 m to the moon-pool door (bottom, y −12).
 *
 * - Look: bare haze-grey painted steel (walls / ceiling `navy_grey`, bottom floor `deck_nonslip`); the greybox landings
 *   and flights are re-materialled dark steel with a `deck_grate` tread layer on every tread and landing; vertical
 *   wall stiffeners, a cable riser in the north-east corner; landing numbers (`label: false`: the greybox wayfinding
 *   label goes, the L0 sign replaces it).
 * - The closed well's mesh guards (D32; the colliders stay W4a's): the greybox visual is dropped and redrawn as yellow
 *   framed welded-mesh panels per storey (kit `barGuard` mesh style, `collide: false`), 12 mm inside the well so no
 *   panel is coplanar with a tread end or a slab edge.
 * - Light: the five caged landing lamps LL0–LL3 / LLB (kit `landingLamp`, breakable, bound to the room's `shaft6` lights —
 *   this file places the room's light table itself so the lamps get their handles); hard-wired emergency: amber
 *   nosing strips on all 40 treads, green-amber strips along the landing edges and round the well's foot, two red
 *   caged points (`shaft6_emerg`; moved from the placeholder spots onto walls: the east wall over the fire point at L2,
 *   the south wall over the bottom — the placeholder's bottom point sat inside F4's steps).
 * - The fire-point cabinet at L2 (`p6_shaft_ammo` in its niche) and the stores box at the bottom (`p6_shaft_med` on its
 *   lid), both `collide: false` over the greybox colliders.
 * - Vignette `v6_shaft_lights` (§4.7, §5.7 #7): LL2 pops (+0.0), LL3 (+0.7), LLB (+1.4), then above him LL1 (+3.0), LL0
 *   (+3.6); each pop's `bulb_pop` + `fx.bulbPop` at its glass-out moment and its `glass_tinkle` after (level-owned
 *   sounds, D25); then `shaft6_emerg` on and `regions.dark` += shaft6. Snap: every lamp dead, emergency on, dark.
 *
 * Contract: see `tunnels.ts`.
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import { aabbOf, type Mat } from '../builder';
import type { LevelBuild } from '../context';
import { isStandin, restyle } from '../l3/kit3';
import type { Box6 } from '../l3/grey';
import { LANDINGS6, LIGHTS6, SHAFT_FLIGHTS6, SHAFT_WELL6, box3, placeLights6, type LightRow6, type RoomId6 } from './grey';
import type { RoomDress } from './index';
import { barGuard, firePointCabinet, lampLens6, landingLamp, stencil6, storeBox, strip6, type LandingLamp } from './kit6';

const PI = Math.PI;

/** Interior (room box inset by the half wall). */
const X0 = -27.8, X1 = -22.2, Z0 = -171.8, Z1 = -162.2, YB = -12, YT = 3.2;

/**
 * Drop the render items (not the colliders) of a shell builder's batches whose material matches and whose box lies
 * inside one of `boxes` (± 2 cm): the greybox stand-in of one object, when its material batch also holds others.
 */
export function dropItems6(L: LevelBuild, builder: string, match: (m: THREE.Material) => boolean, boxes: readonly Box6[]): number {
  const b = L.namedBuilder(builder) as unknown as { batches: Map<string, { mat: THREE.Material; items: { m: THREE.Matrix4 }[] }> };
  const bb = new THREE.Box3(), e = 0.02;
  let n = 0;
  for (const bt of b.batches.values()) {
    if (!match(bt.mat)) continue;
    for (let i = bt.items.length - 1; i >= 0; i--) {
      aabbOf(bt.items[i].m, bb);
      if (boxes.some((q) => bb.min.x >= q[0] - e && bb.min.y >= q[1] - e && bb.min.z >= q[2] - e && bb.max.x <= q[3] + e && bb.max.y <= q[4] + e && bb.max.z <= q[5] + e)) { bt.items.splice(i, 1); n++; }
    }
  }
  return n;
}

/** `regions.dark` gains these boxes (idempotent; copied from the greybox placeholder). */
export function darkAdd6(L: LevelBuild, boxes: readonly Box6[]) {
  const regions = L.ctx.level?.regions as Record<string, THREE.Box3[]> | undefined;
  if (!regions) return;
  const list = (regions.dark ??= []);
  for (const bx of boxes) { const b3 = box3(bx); if (!list.some((q) => q.equals(b3))) list.push(b3); }
}

// ───────────────────────────────────────────────────────────── lights (§2.7.1; the greybox table, emergency moved)

/** LL0, LL1, LL2, LL3, LLB (as `LIGHTS6.shaft6`, rows 0–4) + the two red emergency points on walls. */
function shaftLights(): LightRow6[] {
  // (the mains lamps a little stronger than the greybox's: the shaft reads before the beat — 9 / 10 m)
  const rows = LIGHTS6.shaft6.map((r) => ({ ...r, p: [...r.p] as [number, number, number], ...(r.group === 'shaft6' ? { i: 9, d: 10 } : {}) }));
  const emerg = rows.filter((r) => r.group === 'shaft6_emerg');
  // L2: on the east wall above the fire point (the lamp at (−22.2, −3.9, −170.0) facing −x)
  if (emerg[0]) emerg[0].p = [-22.42, -3.9, -170.0];
  // bottom: on the south wall over the bottom floor, beside the chamber door (facing +z)
  if (emerg[1]) { emerg[1].p = [-26.2, -9.4, -171.58]; emerg[1].i = 3.0; }
  return rows;
}

// ───────────────────────────────────────────────────────────── build

function buildShaft(L: LevelBuild) {
  const b = L.builder('shaft6_d3b');
  const K: Mat = 'painted_dark', N: Mat = 'navy_grey', Y: Mat = 'painted_yellow';
  const grate = L.overlay('deck_grate');

  // ── greybox visuals: the stores box (re-built below) and the cabinet stand-ins go; landings + flights become dark
  //    steel; the mesh guards are redrawn ──
  dropItems6(L, 'shaft6_grey', isStandin, [[-27.8, -12, -171.8, -27.0, -11.2, -171.0]]);
  restyle(L, 'shaft6_grey', (m) => m.name === 'grey_dark', null);
  restyle(L, 'shaft6_grey', isStandin, L.ctx.materials.get('navy_grey'));
  restyle(L, 'grey6:shaft6_guards', () => true, null);

  // ── tread layer: grating on every landing and tread, amber nosings, landing-edge strips ──
  for (const l of Object.values(LANDINGS6)) {
    const [x0, x1, z0, z1] = l.box;
    b.solid(() => b.quad(grate, (x0 + x1) / 2, l.y, (z0 + z1) / 2, x1 - x0, z1 - z0, '+y', 0, 'box', 0.004));
    // the open edge (toward the flights / the well): south landings their north edge, north landings their south edge
    const north = z1 > -166;
    const ez = north ? z0 + 0.12 : z1 - 0.12;
    strip6(b, L, x0 + 0.1, ez, x1 - 0.1, ez, { y: l.y + 0.004, ch: 'emerg', channel: K });
  }
  for (const f of SHAFT_FLIGHTS6) {
    const y0 = f.y0 ?? 0;
    for (let k = 0; k < f.risers; k++) {
      const za = f.z0 + f.dir * f.tread * k, zb = f.z0 + f.dir * f.tread * (k + 1), top = y0 + f.rise * (k + 1);
      b.solid(() => b.quad(grate, (f.x0 + f.x1) / 2, top, (za + zb) / 2, f.x1 - f.x0, f.tread, '+y', 0, 'box', 0.004));
      const zn = za + f.dir * 0.05;
      strip6(b, L, f.x0 + 0.12, zn, f.x1 - 0.12, zn, { y: top + 0.004, ch: 'amber', channel: K });
    }
  }
  // round the well's foot on the bottom floor
  const [wx0, , wz0, wx1, , wz1] = SHAFT_WELL6;
  strip6(b, L, wx0 - 0.12, wz0 + 0.1, wx0 - 0.12, wz1 - 0.1, { y: YB + 0.002, ch: 'emerg', channel: K });
  // wall-base strips (lamp-off readability, §2.7.3): every landing along its walls, the bottom round its perimeter —
  // broken at the two doors, the fire point and the stores box, and never inside a flight's foot (F4 stands on the bottom)
  const run = (ax: number, az: number, bx: number, bz: number, y: number) => strip6(b, L, ax, az, bx, bz, { y: y + 0.004, ch: 'emerg', channel: K });
  const w = 0.1;
  run(X0 + w, Z0 + 0.2, X0 + w, -168.6, 0); run(X0 + 0.2, Z0 + w, X1 - 0.2, Z0 + w, 0); run(X1 - w, Z0 + 0.2, X1 - w, -170.75, 0);
  run(X0 + w, Z0 + 0.2, X0 + w, -168.6, -6); run(X0 + 0.2, Z0 + w, X1 - 0.2, Z0 + w, -6); run(X1 - w, -170.45, X1 - w, -168.6, -6);
  for (const y of [-3, -9]) { run(X0 + w, -164.2, X0 + w, Z1 - 0.2, y); run(X0 + 0.2, Z1 - w, X1 - 0.2, Z1 - w, y); run(X1 - w, -164.2, X1 - w, Z1 - 0.2, y); }
  run(-26.85, Z0 + w, X1 - 0.2, Z0 + w, YB); run(X0 + 0.2, Z1 - w, X1 - 0.2, Z1 - w, YB);
  run(X0 + w, -168.85, X0 + w, Z1 - 0.2, YB); run(X1 - w, Z0 + 0.2, X1 - w, -168.6, YB); run(X1 - w, -164.2, X1 - w, Z1 - 0.2, YB);
  // the chamber door's threshold (the leaf is in the wall: the strip lies 0.3 m in front of it)
  run(X0 + 0.3, -170.55, X0 + 0.3, -169.05, YB);

  // ── the closed well's mesh guards (look only: W4a's colliders stay) ──
  const e = 0.012, ins = 0.085;
  const gx0 = wx0 + e, gx1 = wx1 - e, gz0 = wz0 + e, gz1 = wz1 - e;
  const bands = [-12, -9, -6, -3, 0, YT - 0.01];
  for (let i = 0; i < bands.length - 1; i++) {
    const y = bands[i], h = bands[i + 1] - y;
    barGuard(b, L, { pts: [[gx0, gz0], [gx0, gz1], [gx1, gz1], [gx1, gz0]], y, h, style: 'mesh', mat: Y, collide: false });
    barGuard(b, L, { pts: [[gx0 + ins, gz0], [gx1 - ins, gz0]], y, h, style: 'mesh', mat: Y, collide: false });
  }
  // over L0's open north edge on the east half (y 0 … 2.4, over F2's foot)
  barGuard(b, L, { pts: [[wx1 + ins, -168.4 + e], [X1 - 0.05, -168.4 + e]], y: 0, h: 2.4, style: 'mesh', mat: Y, collide: false });
  stencil6(b, '출입 금지 — 계단실 샤프트', -24.9, 1.55, -168.4 + e - 0.05, 1.3, 0.12, '-z', { style: 'danger' });

  // ── walls: vertical stiffeners on the north / south walls, a cable riser in the north-east corner, a frame at each
  //    landing on the end walls ──
  for (const x of [-26.9, -23.1]) {
    b.bx(N, x - 0.05, YB, Z0, x + 0.05, YT, Z0 + 0.09);
    b.bx(N, x - 0.05, YB, Z1 - 0.09, x + 0.05, YT, Z1);
  }
  b.cyl('steel_raw', X1 - 0.08, (YB + YT) / 2, Z1 - 0.22, 0.05, YT - YB, 'y', 10);
  b.cyl('steel_raw', X1 - 0.2, (YB + YT) / 2, Z1 - 0.08, 0.035, YT - YB, 'y', 8);
  for (const y of [-11.0, -8.0, -5.0, -2.0, 1.0]) b.detail(() => b.bx(K, X1 - 0.3, y - 0.12, Z1 - 0.3, X1 - 0.01, y + 0.12, Z1 - 0.15));

  // ── signs (navy stencils; the L0 one replaces the greybox label) ──
  stencil6(b, 'MOON POOL ACCESS — DOCK GALLERY −12 M ↓', -25.0, 2.1, Z0, 3.6, 0.22, '+z', { plate: true });
  stencil6(b, 'LEVEL −3', -25.0, -1.0, Z1, 1.1, 0.2, '-z');
  stencil6(b, 'LEVEL −6', -25.0, -4.0, Z0, 1.1, 0.2, '+z');
  stencil6(b, 'LEVEL −9', -25.0, -7.0, Z1, 1.1, 0.2, '-z');
  stencil6(b, '도크 갤러리 — 문풀 ←', -24.4, -9.75, Z0, 2.2, 0.19, '+z', { plate: true });
  // a hard-wired lit sign over the chamber door (west wall; reads with every lamp dead)
  const lit = L.signMat('도크 갤러리', 'wayfinding', 1.4 / 0.26).clone();
  lit.emissive = new THREE.Color(0xffffff); lit.emissiveMap = lit.map; lit.emissiveIntensity = 0.6;
  b.bx(K, X0, -9.06, -170.55, X0 + 0.06, -8.68, -169.05);
  b.detail(() => b.quad(lit, X0 + 0.06, -8.87, -169.8, 1.4, 0.26, '+x', 0, 'unit', 0.004));
  stencil6(b, '접근 금지 — 난간 사용 필수', -25.0, -10.7, Z1, 2.4, 0.12, '-z', { style: 'warning' });

  // ── fire-point cabinet at L2 (east wall, x −22.6 … −22.2, z −171.6 … −170.6, y −6 … −4.6) ──
  b.at(X1, -6, -171.1, -PI / 2, () => firePointCabinet(b, L, { w: 1.0, d: 0.4, h: 1.4, shelf: 1.0, collide: false }));
  // ── the stores box at the bottom south-west (x −27.8 … −27.0, z −171.8 … −171.0, h 0.8), its front to the east ──
  b.at(-27.4, YB, -171.4, PI / 2, () => storeBox(b, L, { w: 0.8, d: 0.8, h: 0.8, label: '응급처치 — 저장고', collide: false }));

  // ── lights + lamps ──
  const rows = shaftLights();
  const handles = placeLights6(L, rows);
  const lampRows = rows.map((r, i) => ({ r, h: handles[i] })).filter((x) => x.r.group === 'shaft6');
  const floorOf = (y: number) => (y > -1 ? 0 : y > -4 ? -3 : y > -7 ? -6 : y > -10 ? -9 : YB);
  const lamps: LandingLamp[] = lampRows.map(({ r, h }, i) => {
    let lamp!: LandingLamp;
    // wall prop on the west wall (x −27.8), facing +x
    b.at(X0, r.p[1], r.p[2], PI / 2, () => { lamp = landingLamp(b, L, { color: 'warm', intensity: 0.5, breakable: true, bind: h as LightHandle, floorY: floorOf(r.p[1]), name: `shaft6_ll${i}` }); });
    return lamp;
  });
  const emerg = rows.map((r, i) => ({ r, h: handles[i] })).filter((x) => x.r.group === 'shaft6_emerg');
  const redLens = lampLens6(L, 'red', 0.02);
  if (emerg[0]) b.at(X1, -3.9, -170.0, -PI / 2, () => landingLamp(b, L, { color: 'red', intensity: 0.02 }));
  if (emerg[1]) b.at(-26.2, -9.4, Z0, 0, () => landingLamp(b, L, { color: 'red', intensity: 0.02 }));
  if (emerg[0]) emerg[0].h.bindEmissive(redLens, 1.1);

  // ── v6_shaft_lights (§4.7, §5.7 #7) ──
  // lamps in LIGHTS6 order: LL0, LL1, LL2, LL3, LLB → pop order LL2, LL3, LLB (below him), then LL1, LL0 (above)
  const ORDER = [2, 3, 4, 1, 0], AT = [0.0, 0.7, 1.4, 3.0, 3.6];
  const lm = L.ctx.render.lights;
  const out = () => {
    lm.setGroup('shaft6_emerg', { enabled: true });
    darkAdd6(L, [[X0 - 0.2, YB - 0.5, Z0 - 0.2, X1 + 0.2, YT, Z1 + 0.2]]);
  };
  const fx = L.ctx.fx as unknown as { bulbPop?(p: THREE.Vector3): void };
  L.vignette('v6_shaft_lights', () => {
    ORDER.forEach((li, k) => {
      const lamp = lamps[li];
      if (!lamp) return;
      L.after(AT[k], () => {
        if (lamp.dead) return;
        const t = lamp.pop(), p = lamp.point;
        L.after(t.out, () => { L.sfx('bulb_pop', p.x, p.y, p.z, 0.85); if (!L.silent) fx.bulbPop?.(p.clone()); });
        L.after(t.tinkle, () => L.sfx('glass_tinkle', p.x, p.y - 0.8, p.z, 0.55));
      });
    });
    L.after(AT[AT.length - 1] + 0.35, out);
  }, { snap: () => { for (const l of lamps) l?.snap(true); out(); } });
}

export const SHAFT_DRESS: Partial<Record<RoomId6, RoomDress>> = {
  shaft6: {
    build: buildShaft,
    lights: [],
    look: { wall: 'navy_grey', ceiling: 'navy_grey', floor: 'deck_nonslip' },
    label: false,
  },
};

