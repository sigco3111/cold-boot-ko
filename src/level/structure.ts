/**
 * Architectural modules: modular wall faces, ceilings, light fixtures.
 */
import type * as THREE from 'three';
import type { FlickerMode, LightHandle, Surface } from '../core/types';
import { rng, type Builder, type Mat } from './builder';
import type { LevelBuild } from './context';
import { bolts4, ibeam, junctionBox, louvre, panel, pipe, valve } from './kit';

export interface Opening {
  /** World coordinate of the opening centre along the wall. */
  c: number; w: number; h: number;
  /** Sill height (0 = door). */
  y0?: number;
  /** Decoration margin kept clear on each side (door frame). */
  margin?: number;
}
export type WallStyle = 'panel' | 'dark' | 'medical' | 'ribbed' | 'plain';
export interface WallSpec {
  /** Interior normal of the face. */
  n: '+x' | '-x' | '+z' | '-z';
  /** World coordinate of the interior face plane. */
  plane: number;
  /** World extent along the wall (from < to). */
  from: number; to: number;
  h: number;
  y0?: number;
  /** Slab thickness behind the face. */
  t?: number;
  openings?: Opening[];
  style?: WallStyle;
  bay?: number;
  seed?: number;
  /** Cable tray along the top (height above floor; 0 = none). Default h - 0.42. */
  trayY?: number;
  /** Probability that a bay gets a random feature (vent / j-box / hatch / pipes). */
  features?: number;
  /** World ranges along the wall kept free of random features (props stand there). */
  clear?: [number, number][];
  /** Slab-only extension at the `from` / `to` ends (corner overlap). */
  ext?: [number, number];
  surface?: Surface;
  /** Heavy I-beam columns instead of slim pilasters. */
  columns?: boolean;
  /** No decoration at all above this height (hidden above something). */
  decoTop?: number;
  /** Panels starting above this height get no corner bolts (tall halls: bolts nobody can see). */
  boltsBelow?: number;
  /** Large viewing windows: no pilasters or dado rail across window openings (default: off, as level 1 was built). */
  clearWindows?: boolean;
}

const STYLE: Record<WallStyle, { panel: Mat; slab: Mat; trim: Mat; kick: Mat }> = {
  panel: { panel: 'wall_panel', slab: 'painted_dark', trim: 'trim_steel', kick: 'painted_dark' },
  dark: { panel: 'wall_panel_dark', slab: 'painted_dark', trim: 'trim_steel', kick: 'painted_dark' },
  medical: { panel: 'wall_medical', slab: 'trim_steel', trim: 'painted_white', kick: 'trim_steel' },
  ribbed: { panel: 'wall_panel', slab: 'painted_dark', trim: 'trim_steel', kick: 'painted_dark' },
  plain: { panel: 'wall_panel_dark', slab: 'wall_panel_dark', trim: 'trim_steel', kick: 'painted_dark' },
};

/**
 * One interior wall face: structural slab (with door / window openings + colliders) dressed with
 * pilasters, kick plate, dado rail, bevelled panels in tiers, a cable tray, and random service features.
 */
export function wallFace(b: Builder, s: WallSpec) {
  const L = s.to - s.from, h = s.h, t = s.t ?? 0.4, y0 = s.y0 ?? 0;
  const st = STYLE[s.style ?? 'panel'];
  const R = rng((s.seed ?? 1) * 7919 + Math.round(s.plane * 31 + s.from * 17));
  const toLocal = (c: number) => (s.n === '+z' || s.n === '-x' ? c - s.from : s.to - c);
  if (s.n === '+z') b.push(s.from, y0, s.plane, 0);
  else if (s.n === '-z') b.push(s.to, y0, s.plane, Math.PI);
  else if (s.n === '+x') b.push(s.plane, y0, s.to, Math.PI / 2);
  else b.push(s.plane, y0, s.from, -Math.PI / 2);
  // `from` end in local x:
  const fromIsZero = s.n === '+z' || s.n === '-x';
  const ext = s.ext ?? [0.2, 0.2];
  const e0 = fromIsZero ? ext[0] : ext[1], e1 = fromIsZero ? ext[1] : ext[0];

  const ops = (s.openings ?? []).map((o) => ({ x0: toLocal(o.c) - o.w / 2, x1: toLocal(o.c) + o.w / 2, y0: o.y0 ?? 0, y1: (o.y0 ?? 0) + o.h, margin: o.margin ?? ((o.y0 ?? 0) > 0 ? 0.08 : 0.34) }))
    .sort((p, q) => p.x0 - q.x0);
  const surf = s.surface ?? 'metal';

  // ── slab + colliders ──
  let x = -e0;
  const slab = (x0: number, ya: number, x1: number, yb: number) => {
    if (x1 - x0 < 0.001 || yb - ya < 0.001) return;
    b.bx(st.slab, x0, ya, -t, x1, yb, 0);
    b.collide(x0, ya, -t, x1, yb, 0, surf);
  };
  for (const o of ops) {
    slab(x, 0, o.x0, h);
    slab(o.x0, o.y1, o.x1, h);
    slab(o.x0, 0, o.x1, o.y0);
    x = o.x1;
  }
  slab(x, 0, L + e1, h);

  // ── decoration spans (between openings, minus frame margins) ──
  const spans: { a: number; b: number; pa: boolean; pb: boolean }[] = [];
  let a = 0, pa = true;
  for (const o of ops) {
    if (o.y0 > 0) continue; // windows don't break the bay rhythm; handled per-panel below
    spans.push({ a, b: o.x0 - o.margin, pa, pb: false });
    a = o.x1 + o.margin; pa = false;
  }
  spans.push({ a, b: L, pa, pb: true });
  const windows = ops.filter((o) => o.y0 > 0);
  const hitsWindow = (x0: number, x1: number, ya: number, yb: number) => windows.some((w) => x0 < w.x1 + 0.1 && x1 > w.x0 - 0.1 && ya < w.y1 + 0.1 && yb > w.y0 - 0.1);
  const clearLocal = (s.clear ?? []).map(([p, q]) => { const u = toLocal(p), v = toLocal(q); return [Math.min(u, v), Math.max(u, v)] as [number, number]; });
  const isClear = (x0: number, x1: number) => clearLocal.some(([p, q]) => x0 < q && x1 > p);

  const bay = s.bay ?? 2;
  const pw = s.columns ? 0.3 : 0.14, pd = s.columns ? 0.3 : 0.07;
  const trayY = s.trayY ?? h - 0.42;
  const top = s.decoTop ?? (trayY > 0 && trayY > h - 0.8 ? trayY - 0.16 : h - 0.14);
  const featP = s.features ?? 0.45;
  const pd0 = 0.035;

  for (const sp of spans) {
    const len = sp.b - sp.a;
    if (len < 0.25) continue;
    const n = Math.max(1, Math.round(len / bay));
    const bw = len / n;
    // continuous horizontals
    b.bx(st.kick, sp.a, 0, 0, sp.b, 0.22, 0.05);
    b.detail(() => {
      b.bx(st.kick, sp.a, 0.22, 0, sp.b, 0.245, 0.03);
      if (!s.clearWindows) b.bx(st.trim, sp.a, 1.05, 0, sp.b, 1.11, 0.045);
      else {
        // dado rail broken by every window it would cross
        let ra = sp.a;
        for (const w of windows) {
          if (w.x1 <= sp.a || w.x0 >= sp.b || w.y0 > 1.11 || w.y1 < 1.05) continue;
          if (w.x0 - 0.05 > ra) b.bx(st.trim, ra, 1.05, 0, w.x0 - 0.05, 1.11, 0.045);
          ra = Math.max(ra, w.x1 + 0.05);
        }
        if (sp.b > ra) b.bx(st.trim, ra, 1.05, 0, sp.b, 1.11, 0.045);
      }
      b.bx(st.trim, sp.a, h - 0.1, 0, sp.b, h, 0.05);
    });
    // pilasters
    for (let i = 0; i <= n; i++) {
      if ((i === 0 && !sp.pa) || (i === n && !sp.pb)) continue;
      const px = sp.a + i * bw;
      if (s.clearWindows && windows.some((w) => px > w.x0 - pw && px < w.x1 + pw)) continue;
      if (s.columns) {
        ibeam(b, st.trim, 'y', px, h / 2, pd / 2, h, pw, pd, 0.02, 0.015);
        b.box(st.trim, px, 0.02, pd / 2, pw + 0.16, 0.04, pd + 0.1);
        b.detail(() => { for (const bx of [-1, 1]) for (const bz of [-1, 1]) b.inst('bolt', px + bx * (pw / 2 + 0.04), 0.04, pd / 2 + bz * (pd / 2 + 0.02), -Math.PI / 2, 0, 0, 1.6); });
      } else {
        b.bx(st.trim, px - pw / 2, 0, 0, px + pw / 2, h, pd);
        b.detail(() => {
          b.bx(st.kick, px - pw / 2 - 0.03, 0, 0, px + pw / 2 + 0.03, 0.3, pd + 0.03);
          b.bx(st.trim, px - pw / 2 - 0.02, h - 0.16, 0, px + pw / 2 + 0.02, h, pd + 0.03);
        });
      }
    }
    // bays
    for (let i = 0; i < n; i++) {
      const x0 = sp.a + i * bw + (i === 0 && !sp.pa ? 0.02 : pw / 2 + 0.025);
      const x1 = sp.a + (i + 1) * bw - (i === n - 1 && !sp.pb ? 0.02 : pw / 2 + 0.025);
      if (x1 - x0 < 0.12) continue;
      const feat = !isClear(x0, x1) && R.chance(featP) ? R.pick(['vent', 'jbox', 'hatch', 'pipes', 'jbox', 'vent'] as const) : 'none';
      b.detail(() => {
        if (s.style === 'ribbed') {
          for (let y = 0.3; y + 0.24 < top; y += 0.29) if (!hitsWindow(x0, x1, y, y + 0.24)) panel(b, st.panel, x0, y, x1, y + 0.24, 0, 0.055, 0.045);
        } else {
          // lower panel / vent
          if (feat === 'vent' && x1 - x0 > 0.5) {
            const vw = Math.min(0.9, x1 - x0 - 0.1), vc = (x0 + x1) / 2;
            panel(b, st.panel, x0, 0.28, x1, 1.01, 0, pd0 * 0.5);
            louvre(b, vc - vw / 2, 0.38, vc + vw / 2, 0.9, pd0 * 0.5);
          } else if (!hitsWindow(x0, x1, 0.28, 1.01)) {
            panel(b, st.panel, x0, 0.28, x1, 1.01, 0, pd0);
            if (x1 - x0 > 0.4) bolts4(b, x0, 0.28, x1, 1.01, pd0);
          }
          // upper tiers
          const nT = Math.max(1, Math.ceil((top - 1.15) / 2.6));
          const th = (top - 1.15) / nT;
          for (let k = 0; k < nT; k++) {
            const ya = 1.15 + k * th + (k ? 0.04 : 0), yb = 1.15 + (k + 1) * th - 0.02;
            if (hitsWindow(x0, x1, ya, yb)) continue;
            panel(b, st.panel, x0, ya, x1, yb, 0, pd0);
            if (x1 - x0 > 0.4 && ya < (s.boltsBelow ?? Infinity)) bolts4(b, x0, ya, x1, yb, pd0);
            if (k) b.bx(st.trim, x0 - 0.02, ya - 0.06, 0, x1 + 0.02, ya - 0.02, 0.05);
          }
          const cx = (x0 + x1) / 2;
          if (feat === 'jbox') {
            junctionBox(b, cx + R.range(-0.2, 0.2) * (x1 - x0), 1.5, pd0, 0.3, 0.4, trayY > 0 ? trayY : top, R.chance(0.6) ? (R.chance(0.5) ? 'emissive_green' : 'emissive_amber') : null);
          } else if (feat === 'hatch' && x1 - x0 > 0.8) {
            const hx = cx + R.range(-0.1, 0.1);
            panel(b, st.trim, hx - 0.3, 1.3, hx + 0.3, 2.05, pd0, 0.02, 0.015);
            bolts4(b, hx - 0.3, 1.3, hx + 0.3, 2.05, pd0 + 0.02, 0.035);
            b.box('steel_raw', hx + 0.22, 1.67, pd0 + 0.04, 0.025, 0.16, 0.03);
            b.sign(R.pick(['고압', '출입 3-' + R.int(10, 99), '냉각수', '데이터 트렁크']), 'warning', hx - 0.04, 1.86, pd0 + 0.02, 0.3, 0.1, '+z');
          } else if (feat === 'pipes') {
            const px = x0 + 0.14, topY = trayY > 0 ? trayY - 0.05 : top;
            pipe(b, 'copper', [[px, 0.05, 0.1], [px, topY, 0.1]], 0.035, { every: 1.4 });
            pipe(b, 'steel_raw', [[px + 0.13, 0.05, 0.09], [px + 0.13, topY, 0.09]], 0.025, { every: 0 });
            valve(b, px, 1.25, 0.1, 'y', 0.035, 'z', 1);
            for (const by of [0.6, 1.8, topY - 0.3]) if (by < topY) b.bx('steel_raw', px - 0.07, by, 0, px + 0.2, by + 0.03, 0.15);
            if (R.chance(0.7)) b.decal('water_stain', R.int(0, 3), px + 0.05, 0.75, pd0, 0.5, 1.3, '+z');
          }
          if (R.chance(0.55)) b.decal('grime', R.int(0, 3), cx, 0.3, pd0, Math.min(x1 - x0, 1.8), 0.6, '+z');
          if (R.chance(0.12)) b.decal('scratches', R.int(0, 3), cx + R.range(-0.3, 0.3), 1.1 + R.range(0, 0.5), pd0, 0.6, 0.6, '+z');
        }
      });
    }
    // cable tray
    if (trayY > 0 && trayY < h - 0.1) {
      b.detail(() => {
        b.bx('trim_steel', sp.a, trayY, 0.05, sp.b, trayY + 0.015, 0.3);
        b.bx('trim_steel', sp.a, trayY, 0.29, sp.b, trayY + 0.06, 0.3);
        b.bx('trim_steel', sp.a, trayY, 0.05, sp.b, trayY + 0.06, 0.06);
        for (let i = 0; i <= n; i++) {
          const px = Math.min(sp.b - 0.02, Math.max(sp.a + 0.02, sp.a + i * bw));
          b.bx('trim_steel', px - 0.02, trayY - 0.04, 0.05, px + 0.02, trayY, 0.3); // stands off the raised panels
          b.rbox('trim_steel', px, trayY - 0.12, 0.12, 0.02, 0.02, 0.3, 0.6, 0, 0);
        }
        const nc = 3 + R.int(0, 2);
        for (let c = 0; c < nc; c++) {
          const cr = R.range(0.012, 0.026), cz = 0.085 + c * 0.045;
          b.rod(c % 3 === 1 ? 'plastic_dark' : 'rubber', sp.a, trayY + 0.015 + cr, cz, sp.b, trayY + 0.015 + cr, cz, cr, 5);
        }
      });
    }
  }
  b.pop();
}

/** Ceiling slab with collider (underside at y = h). */
export function ceilingSlab(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, mat: Mat = 'ceiling_panel') {
  b.bx(mat, x0, h, z0, x1, h + 0.3, z1);
  b.collide(x0, h, z0, x1, h + 0.3, z1, 'metal', false);
}

// ───────────────────────────────────────────────────────────── fixtures

export interface FixtureOpts {
  group: string; x: number; y: number; z: number;
  axis?: 'x' | 'z'; len?: number; w?: number;
  color?: number; intensity?: number; distance?: number; angle?: number;
  flicker?: FlickerMode; cast?: boolean; vol?: boolean; enabled?: boolean; priority?: number;
  /** Fixture exists but has no light (dead tube). */
  dead?: boolean;
  glow?: 'emissive_white' | 'emissive_warm' | 'emissive_red' | 'emissive_amber' | 'emissive_cyan' | 'emissive_green';
  /** Share an existing emissive material (lights that always switch together). */
  glowMat?: THREE.Material;
  /** Aim point override. */
  target?: [number, number, number];
  /** Explicit light bounds (see LightOpts.bounds); default = the room the fixture sits in. */
  bounds?: THREE.Box3 | null;
}

/** Recessed / surface fluorescent troffer on a ceiling at height y, shining down. */
export function troffer(b: Builder, L: LevelBuild, o: FixtureOpts): LightHandle | null {
  const len = o.len ?? 1.2, w = o.w ?? 0.28, ax = o.axis ?? 'x';
  const sx = ax === 'x' ? len : w, sz = ax === 'x' ? w : len;
  let h: LightHandle | null = null;
  if (!o.dead) {
    const t = o.target ?? [o.x, 0, o.z];
    h = L.spot(o.group, o.x, o.y - 0.14, o.z, t[0], t[1], t[2], o.color ?? 0xcfe6f2, o.intensity ?? 45, o.distance ?? 7, o.angle ?? 1.05,
      { flicker: o.flicker, cast: o.cast, vol: o.vol, enabled: o.enabled, priority: o.priority, penumbra: 0.75, bounds: o.bounds });
  }
  b.detail(() => {
    b.box('trim_steel', o.x, o.y - 0.045, o.z, sx + 0.12, 0.09, sz + 0.12);
    b.box('painted_dark', o.x, o.y - 0.1, o.z, sx + 0.06, 0.03, sz + 0.06);
    const gm = h ? (o.glowMat ?? L.glow(h, o.glow ?? 'emissive_white')) : 'plastic_white';
    if (h) (h as any).glowMat = gm;
    b.box(gm, o.x, o.y - 0.118, o.z, sx, 0.02, sz);
    // louvre bars across the diffuser
    const n = Math.max(2, Math.round(len / 0.3));
    for (let i = 0; i <= n; i++) {
      const d = -len / 2 + (i * len) / n;
      if (ax === 'x') b.box('trim_steel', o.x + d, o.y - 0.125, o.z, 0.012, 0.03, sz + 0.02);
      else b.box('trim_steel', o.x, o.y - 0.125, o.z + d, sx + 0.02, 0.03, 0.012);
    }
  });
  return h;
}

/** Industrial high-bay pendant: drop rod, reflector dome, emissive lens. `y` = lens height, `top` = ceiling. */
export function highbay(b: Builder, L: LevelBuild, o: FixtureOpts & { top: number }): LightHandle {
  const t = o.target ?? [o.x, 0, o.z];
  const h = L.spot(o.group, o.x, o.y - 0.05, o.z, t[0], t[1], t[2], o.color ?? 0xd8ecff, o.intensity ?? 300, o.distance ?? 14, o.angle ?? 0.75,
    { flicker: o.flicker, cast: o.cast, vol: o.vol, enabled: o.enabled, priority: o.priority, penumbra: 0.5, bounds: o.bounds });
  b.detail(() => {
    b.rod('trim_steel', o.x, o.y + 0.45, o.z, o.x, o.top, o.z, 0.02, 6);
    b.box('painted_dark', o.x, o.y + 0.4, o.z, 0.22, 0.14, 0.22);
    b.cyl('trim_steel', o.x, o.y + 0.17, o.z, 0.32, 0.34, 'y', 16, 0.1);
    b.cyl('painted_dark', o.x, o.y + 0.005, o.z, 0.335, 0.03, 'y', 16);
    const gm = o.glowMat ?? L.glow(h, o.glow ?? 'emissive_white');
    (h as any).glowMat = gm;
    b.cyl(gm, o.x, o.y - 0.012, o.z, 0.27, 0.015, 'y', 16);
  });
  return h;
}

/** Emergency rotating beacon on a surface. `up` = +1 standing on top of something, -1 hanging. */
export function beacon(b: Builder, L: LevelBuild, group: string, x: number, y: number, z: number, up: 1 | -1, color = 0xff2a12,
  intensity = 26, distance = 9, glow: 'emissive_red' | 'emissive_amber' = 'emissive_red', enabled = false, flicker: FlickerMode = 'alarm', glowMat?: THREE.Material): LightHandle {
  const h = L.point(group, x, y + up * 0.14, z, color, intensity, distance, { flicker, enabled, priority: 2 });
  b.detail(() => {
    b.cyl('painted_dark', x, y + up * 0.03, z, 0.085, 0.06, 'y', 10);
    const gm = glowMat ?? L.glow(h, glow, 1.5);
    (h as any).glowMat = gm;
    b.cyl(gm, x, y + up * 0.12, z, 0.06, 0.12, 'y', 10);
    b.sphere(gm, x, y + up * 0.18, z, 0.06, 8);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, cx = x + Math.cos(a) * 0.075, cz = z + Math.sin(a) * 0.075;
      b.rod('steel_raw', cx, y + up * 0.05, cz, cx, y + up * 0.2, cz, 0.005, 4);
    }
    b.torus('steel_raw', x, y + up * 0.2, z, 0.075, 0.006, 'y', 10);
  });
  return h;
}

/** Portable tripod work light (sodium amber) standing on the floor at (0,0,0), aimed along local -Z. */
export function workLight(b: Builder, L: LevelBuild, group: string, x: number, z: number, ry: number, o: { color?: number; intensity?: number; distance?: number; angle?: number; cast?: boolean; vol?: boolean; pitch?: number; height?: number; enabled?: boolean; flicker?: FlickerMode } = {}): LightHandle {
  const H = o.height ?? 1.75, pitch = o.pitch ?? 0.35;
  b.push(x, 0, z, ry);
  const pos = b.world(0, H, -0.1);
  const tgt = b.world(0, H - Math.sin(pitch) * 6, -0.1 - Math.cos(pitch) * 6);
  const h = L.spot(group, pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, o.color ?? 0xffa348, o.intensity ?? 160, o.distance ?? 13, o.angle ?? 0.7,
    { cast: o.cast, vol: o.vol, enabled: o.enabled, flicker: o.flicker, priority: 2, penumbra: 0.55 });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.5;
    b.rod('painted_yellow', 0, 0.9, 0, Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5, 0.016, 6);
    b.cyl('rubber', Math.cos(a) * 0.5, 0.015, Math.sin(a) * 0.5, 0.03, 0.03, 'y', 6);
  }
  b.rod('steel_raw', 0, 0.85, 0, 0, H - 0.1, 0, 0.02, 6);
  b.cyl('painted_dark', 0, 0.92, 0, 0.04, 0.1, 'y', 8);
  b.box('painted_dark', 0, H - 0.08, 0, 0.6, 0.04, 0.05);
  const lens = L.glow(h, 'emissive_amber', 1.4);
  for (const s of [-1, 1]) {
    b.push(s * 0.19, H, 0, 0, -pitch);
    b.box('painted_yellow', 0, 0, 0, 0.32, 0.24, 0.12);
    b.detail(() => {
      b.box(lens, 0, 0, -0.062, 0.27, 0.19, 0.008);
      for (let k = -1; k <= 1; k++) b.box('steel_raw', k * 0.09, 0, -0.07, 0.006, 0.2, 0.006);
      for (let k = 0; k < 4; k++) b.box('painted_dark', 0, 0.09 - k * 0.06, 0.075, 0.28, 0.02, 0.03);
    });
    b.pop();
  }
  b.collide(-0.15, 0, -0.15, 0.15, H, 0.15, 'metal');
  b.pop();
  return h;
}

/** Cage bulkhead lamp on a +Z facing wall surface (local coords). Returns the light. */
export function bulkhead(b: Builder, L: LevelBuild, group: string, x: number, y: number, z: number, color: number, intensity: number, distance: number,
  glow: 'emissive_white' | 'emissive_warm' | 'emissive_red' | 'emissive_amber' | 'emissive_cyan' | 'emissive_green' = 'emissive_warm', o: { flicker?: FlickerMode; enabled?: boolean } = {}): LightHandle {
  const p = b.world(x, y, z + 0.22);
  const h = L.point(group, p.x, p.y, p.z, color, intensity, distance, { flicker: o.flicker, enabled: o.enabled });
  b.detail(() => {
    b.box('painted_dark', x, y, z + 0.02, 0.2, 0.3, 0.04);
    b.box(L.glow(h, glow), x, y, z + 0.08, 0.12, 0.22, 0.09);
    for (let i = -1; i <= 1; i++) b.box('steel_raw', x, y + i * 0.08, z + 0.085, 0.16, 0.008, 0.11);
    b.box('steel_raw', x - 0.075, y, z + 0.085, 0.008, 0.26, 0.11).box('steel_raw', x + 0.075, y, z + 0.085, 0.008, 0.26, 0.11);
  });
  return h;
}
