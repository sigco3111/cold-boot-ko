/**
 * Props library. Every prop is authored in local space (origin on the floor, FRONT faces local +Z,
 * back towards -Z) and stamped via the builder's transform stack: `b.at(x, 0, z, ry, () => prop(b, ...))`.
 * Wall-normal → ry:  +z: 0,  -z: π,  +x: π/2,  -x: -π/2.
 */
import * as THREE from 'three';
import type { Builder, Mat, Rng } from './builder';
import type { LevelBuild } from './context';
import { bolts4, cable, cagePanel, hose, lathe, louvre, panel, panelOn, pipe } from './kit';

const PI = Math.PI;

export function defineInstances(L: LevelBuild) {
  const M = L.ctx.materials;
  L.defineInstance('bolt', M.get('steel_raw'), false, (b) => {
    b.cyl('steel_raw', 0, 0, 0.005, 0.013, 0.01, 'z', 6);
    b.cyl('steel_raw', 0, 0, 0.012, 0.007, 0.006, 'z', 6);
  });
  L.defineInstance('led_green', M.get('emissive_green'), false, (b) => b.box('emissive_green', 0, 0, 0, 0.018, 0.018, 0.008));
  L.defineInstance('led_amber', M.get('emissive_amber'), false, (b) => b.box('emissive_amber', 0, 0, 0, 0.018, 0.018, 0.008));
  L.defineInstance('led_red', M.get('emissive_red'), false, (b) => b.box('emissive_red', 0, 0, 0, 0.018, 0.018, 0.008));
  L.defineInstance('led_cyan', M.get('emissive_cyan'), false, (b) => b.box('emissive_cyan', 0, 0, 0, 0.018, 0.018, 0.008));
  // generic canister (0.3 dia × 0.45)
  L.defineInstance('canister', M.get('painted_orange'), true, (b) => {
    b.cyl('painted_orange', 0, 0.21, 0, 0.14, 0.42, 'y', 12);
    b.cyl('painted_orange', 0, 0.1, 0, 0.148, 0.02, 'y', 12).cyl('painted_orange', 0, 0.32, 0, 0.148, 0.02, 'y', 12);
    b.cyl('painted_orange', 0, 0.445, 0, 0.05, 0.05, 'y', 8);
  });
  L.defineInstance('canister_grey', M.get('steel_raw'), true, (b) => {
    b.cyl('steel_raw', 0, 0.26, 0, 0.11, 0.52, 'y', 12);
    b.cyl('steel_raw', 0, 0.5, 0, 0.118, 0.03, 'y', 12).cyl('steel_raw', 0, 0.03, 0, 0.118, 0.03, 'y', 12);
    b.cyl('steel_raw', 0, 0.56, 0, 0.035, 0.08, 'y', 8);
  });
  // small cardboard / plastic bin (0.4 × 0.25 × 0.3)
  L.defineInstance('bin', M.get('plastic_dark'), true, (b) => {
    b.box('plastic_dark', 0, 0.125, 0, 0.4, 0.25, 0.3);
    b.box('plastic_dark', 0, 0.245, 0, 0.43, 0.03, 0.33);
    b.box('plastic_dark', 0, 0.16, 0.155, 0.14, 0.04, 0.02);
  });
  L.defineInstance('bin_white', M.get('plastic_white'), true, (b) => {
    b.box('plastic_white', 0, 0.1, 0, 0.34, 0.2, 0.26);
    b.box('plastic_white', 0, 0.2, 0, 0.36, 0.025, 0.28);
  });
}

// ───────────────────────────────────────────────────────────── containers

/** Reinforced equipment crate, origin = bottom centre. */
export function crate(b: Builder, w: number, h: number, d: number, mat: Mat = 'painted_dark', label?: string, collide = true) {
  const e = 0.04;
  b.box(mat, 0, h / 2, 0, w - e, h - e, d - e);
  // edge frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('trim_steel', sx * (w / 2 - e / 2), h / 2, sz * (d / 2 - e / 2), e, h, e);
  for (const sy of [0, 1]) {
    const y = sy ? h - e / 2 : e / 2;
    for (const sz of [-1, 1]) b.box('trim_steel', 0, y, sz * (d / 2 - e / 2), w, e, e);
    for (const sx of [-1, 1]) b.box('trim_steel', sx * (w / 2 - e / 2), y, 0, e, e, d);
  }
  b.detail(() => {
    // latches + handles + ribs
    for (const sx of [-1, 1]) {
      b.box('steel_raw', sx * w * 0.28, h - 0.12, d / 2 + 0.005, 0.06, 0.1, 0.02);
      b.box('rubber', sx * (w / 2 + 0.005), h * 0.6, 0, 0.02, 0.04, Math.min(0.2, d * 0.4));
    }
    if (h > 0.5) b.box('trim_steel', 0, h / 2, d / 2 - e / 2 + 0.004, w - e, 0.03, e).box('trim_steel', 0, h / 2, -d / 2 + e / 2 - 0.004, w - e, 0.03, e);
    if (label) b.sign(label, 'stencil', 0, h * 0.5 + (h > 0.5 ? 0.14 : 0), d / 2 - e / 2 + 0.001, Math.min(w * 0.7, 0.6), Math.min(0.14, h * 0.3), '+z');
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

export function pallet(b: Builder, w = 1.2, d = 1.0) {
  const m: Mat = 'rust';
  for (let i = 0; i < 5; i++) b.box(m, -w / 2 + 0.07 + (i * (w - 0.14)) / 4, 0.13, 0, 0.12, 0.022, d);
  for (const z of [-d / 2 + 0.05, 0, d / 2 - 0.05]) b.box(m, 0, 0.065, z, w, 0.09, 0.09);
  for (let i = 0; i < 3; i++) b.box(m, -w / 2 + 0.07 + (i * (w - 0.14)) / 2, 0.011, 0, 0.12, 0.022, d);
}

/** 200 L drum. */
export function drum(b: Builder, mat: Mat = 'painted_orange', collide = true) {
  b.cyl(mat, 0, 0.44, 0, 0.29, 0.88, 'y', 16);
  for (const y of [0.03, 0.3, 0.58, 0.85]) b.cyl(mat, 0, y, 0, 0.3, 0.035, 'y', 16); // rolling hoops clear of the lid / base planes
  b.detail(() => { b.cyl('steel_raw', 0.14, 0.89, 0, 0.035, 0.02, 'y', 8); b.cyl('steel_raw', -0.1, 0.89, 0.1, 0.02, 0.015, 'y', 6); });
  if (collide) b.collide(-0.26, 0, -0.26, 0.26, 0.88, 0.26);
}

/** Tall gas bottle. */
export function gasBottle(b: Builder, mat: Mat = 'painted_white') {
  lathe(b, mat, [[0.001, 0], [0.1, 0], [0.11, 0.02], [0.11, 1.1], [0.09, 1.2], [0.04, 1.27], [0.035, 1.3]], 0, 0, 0, 12);
  b.cyl('brass', 0, 1.34, 0, 0.022, 0.08, 'y', 8);
  b.box('brass', 0.03, 1.36, 0, 0.06, 0.025, 0.025);
  b.cyl('painted_dark', 0, 1.36, 0, 0.06, 0.02, 'y', 8);
}

// ───────────────────────────────────────────────────────────── furniture

export function desk(b: Builder, w = 1.6, d = 0.8, h = 0.76, collide = true) {
  b.box('trim_steel', 0, h - 0.02, 0, w, 0.04, d);
  b.box(b.L.overlay('rubber'), 0, h + 0.002, 0, w - 0.06, 0.004, d - 0.06);
  // drawer pedestal (right) + panel leg (left) + modesty panel
  b.box('painted_dark', w / 2 - 0.24, (h - 0.04) / 2, 0, 0.42, h - 0.04, d - 0.08);
  b.box('painted_dark', -w / 2 + 0.03, (h - 0.04) / 2, 0, 0.04, h - 0.04, d - 0.08);
  b.box('painted_dark', 0, h * 0.6, -d / 2 + 0.06, w - 0.1, h * 0.5, 0.02);
  b.detail(() => {
    for (let i = 0; i < 3; i++) {
      panelOn(b, 'trim_steel', w / 2 - 0.24, 0.14 + i * 0.2, d / 2 - 0.04, 0.38, 0.18, '+z', 0.015, 0.012);
      b.box('steel_raw', w / 2 - 0.24, 0.19 + i * 0.2, d / 2 - 0.02, 0.12, 0.015, 0.02);
    }
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

/** Office swivel chair (seat faces +Z). No collider (clutter). */
export function chair(b: Builder, mat: Mat = 'fabric') {
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * PI) / 5;
    b.rod('painted_dark', 0, 0.09, 0, Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3, 0.02, 5);
    b.sphere('rubber', Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, 0.03, 6);
  }
  b.cyl('chrome', 0, 0.27, 0, 0.025, 0.36, 'y', 8);
  b.box('painted_dark', 0, 0.45, 0, 0.3, 0.04, 0.3);
  b.box(mat, 0, 0.5, 0, 0.46, 0.08, 0.44);
  b.rbox('painted_dark', 0, 0.68, -0.22, 0.06, 0.4, 0.03, 0.12, 0, 0);
  b.rbox(mat, 0, 0.85, -0.24, 0.42, 0.42, 0.07, 0.12, 0, 0);
  for (const s of [-1, 1]) {
    b.box('painted_dark', s * 0.25, 0.6, 0, 0.03, 0.2, 0.03);
    b.box('rubber', s * 0.25, 0.71, 0.02, 0.05, 0.03, 0.26);
  }
}

/** Steel bench. */
export function bench(b: Builder, w = 1.4) {
  b.box('trim_steel', 0, 0.44, 0, w, 0.04, 0.36);
  for (const s of [-1, 1]) { b.box('painted_dark', s * (w / 2 - 0.1), 0.21, 0, 0.05, 0.42, 0.3); b.box('painted_dark', s * (w / 2 - 0.1), 0.02, 0, 0.08, 0.04, 0.4); }
  b.collide(-w / 2, 0, -0.18, w / 2, 0.46, 0.18);
}

/**
 * Tall locker (0.5 w × 2.0 h × 0.5 d). `open` = door swing angle (0 = shut). Returns nothing;
 * shelves at y = 0.45, 1.1, 1.6 inside when open.
 */
export function locker(b: Builder, open = 0, mat: Mat = 'wall_panel', w = 0.5, h = 2.0, d = 0.5, collide = true) {
  const t = 0.02;
  b.box(mat, -w / 2 + t / 2, h / 2, 0, t, h, d).box(mat, w / 2 - t / 2, h / 2, 0, t, h, d);
  b.box(mat, 0, h / 2, -d / 2 + 0.04, w, h, 0.08); // thick back: its inside face clears a wall's kick plate and pilasters
  b.box(mat, 0, h - t / 2, 0, w, t, d).box(mat, 0, 0.06, 0, w, 0.12, d);
  if (open > 0) {
    b.detail(() => {
      for (const y of [0.45, 1.1, 1.6]) b.box('trim_steel', 0, y, 0, w - 2 * t, 0.015, d - 2 * t);
      b.rod('chrome', -w / 2 + t, 1.9, 0, w / 2 - t, 1.9, 0, 0.01, 5);
    });
  }
  // door hinged on the left edge (x = -w/2, z = +d/2)
  b.push(-w / 2, 0, d / 2, -open);
  b.box(mat, w / 2, h / 2 + 0.06, 0.01, w - 0.01, h - 0.14, 0.02);
  b.detail(() => {
    panel(b, mat, 0.05, 0.25, w - 0.05, h - 0.5, 0.02, 0.012, 0.02);
    louvre(b, 0.1, h - 0.42, w - 0.1, h - 0.14, 0.02, 0.02, mat);
    b.box('steel_raw', w - 0.07, 1.05, 0.04, 0.03, 0.14, 0.03);
    b.box('painted_dark', w - 0.07, 1.22, 0.035, 0.05, 0.05, 0.02);
  });
  b.pop();
  if (collide && open > 0) {
    // an open locker is hollow: what is inside (a pickup on the shelf) is in plain reach / sight
    b.collide(-w / 2, 0, -d / 2, -w / 2 + t, h, d / 2).collide(w / 2 - t, 0, -d / 2, w / 2, h, d / 2);
    b.collide(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + t).collide(-w / 2, h - t, -d / 2, w / 2, h, d / 2).collide(-w / 2, 0, -d / 2, w / 2, 0.12, d / 2);
  } else if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

/** Row of n shut lockers along +X starting at x=0 (left edge). */
export function lockerRow(b: Builder, n: number, R: Rng, mat: Mat = 'wall_panel') {
  for (let i = 0; i < n; i++) b.at(0.25 + i * 0.5, 0, 0, 0, () => locker(b, R.chance(0.2) ? R.range(0.2, 0.9) : 0, mat, 0.5, 2.0, 0.5, false));
  b.collide(0, 0, -0.25, n * 0.5, 2.0, 0.25);
}

/** Heavy shelving rack along X (width w, depth d, height h) with `levels` shelves; fills with stock. */
export function shelfRack(b: Builder, L: LevelBuild, w: number, d: number, h: number, levels: number, R: Rng, fill = 0.75) {
  const u = 0.05;
  const bays = Math.max(1, Math.round(w / 1.3));
  for (let i = 0; i <= bays; i++) for (const sz of [-1, 1]) {
    const x = -w / 2 + (i * w) / bays;
    b.box('painted_orange', x, h / 2, sz * (d / 2 - u / 2), u, h, u);
    b.box('painted_dark', x, 0.01, sz * (d / 2 - u / 2), u + 0.06, 0.02, u + 0.06);
  }
  b.detail(() => {
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + (i * w) / bays;
      for (let y = 0.2; y < h - 0.5; y += 0.9) {
        b.rod('painted_orange', x, y, -d / 2 + u, x, y + 0.45, d / 2 - u, 0.012, 4);
        b.rod('painted_orange', x, y + 0.45, d / 2 - u, x, y + 0.9, -d / 2 + u, 0.012, 4);
      }
    }
  });
  for (let l = 0; l < levels; l++) {
    const y = 0.15 + (l * (h - 0.25)) / levels;
    b.box('trim_steel', 0, y, 0, w, 0.035, d - 0.02);
    b.detail(() => { b.box('painted_orange', 0, y - 0.04, d / 2 - 0.04, w - 0.01, 0.08, 0.03); b.box('painted_orange', 0, y - 0.04, -d / 2 + 0.04, w - 0.01, 0.08, 0.03); });
    const clearH = (h - 0.25) / levels - 0.1;
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.3) {
      if (!R.chance(fill)) { x += R.range(0.3, 0.6); continue; }
      const k = R();
      const ys = y + 0.018;
      if (k < 0.3) {
        const cw = R.range(0.4, 0.7), ch = Math.min(clearH - 0.02, R.range(0.25, 0.5));
        if (x + cw > w / 2 - 0.05) break;
        b.at(x + cw / 2, ys, R.range(-0.04, 0.04), R.range(-0.08, 0.08), () => crate(b, cw, ch, d - 0.14, R.pick(['painted_dark', 'wall_panel', 'painted_yellow', 'wall_panel_dark'] as Mat[]), R.chance(0.5) ? R.pick(['할시온', '에리두', '예비품', '파손 주의', 'LOT ' + R.int(100, 999)]) : undefined, false));
        x += cw + R.range(0.04, 0.2);
      } else if (k < 0.55) {
        const n = R.int(1, 3);
        for (let i = 0; i < n && x < w / 2 - 0.2; i++) {
          b.inst(R.chance(0.5) ? 'canister' : 'canister_grey', x + 0.15, ys, R.range(-0.08, 0.08), 0, R.range(0, 6), 0);
          if (clearH > 0.3 && d > 0.75) b.inst('canister_grey', x + 0.15, ys, -0.22, 0, R.range(0, 6), 0);
          x += 0.32;
        }
        x += R.range(0.02, 0.15);
      } else if (k < 0.9) {
        const n = R.int(1, 3);
        for (let i = 0; i < n && x < w / 2 - 0.25; i++) {
          const stack = clearH > 0.56 && R.chance(0.5) ? 2 : 1;
          for (let s = 0; s < stack; s++) b.inst(R.chance(0.7) ? 'bin' : 'bin_white', x + 0.22, ys + s * 0.26, R.range(-0.05, 0.05), 0, R.range(-0.15, 0.15), 0);
          x += 0.46;
        }
        x += R.range(0.02, 0.2);
      } else {
        // coil of cable
        const r = 0.16;
        b.detail(() => { for (let i = 0; i < 4; i++) b.torus('rubber', x + r + 0.02, ys + 0.03 + i * 0.045, 0, r, 0.024, 'y', 12); });
        x += 2 * r + 0.15;
      }
    }
  }
  b.box('trim_steel', 0, h - 0.02, 0, w, 0.03, d);
  b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

// ───────────────────────────────────────────────────────────── medical

/** Hospital bed: length along Z (head at -Z), 0.95 × 2.1, mattress top ≈ 0.72. */
export function bed(b: Builder, o: { rails?: boolean; sheet?: boolean; pillow?: boolean; collide?: boolean; mess?: boolean } = {}) {
  const w = 0.95, l = 2.1;
  // undercarriage
  b.box('trim_steel', 0, 0.42, 0, w - 0.1, 0.06, l - 0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.1), z = sz * (l / 2 - 0.18);
    b.cyl('chrome', x, 0.26, z, 0.025, 0.3, 'y', 8);
    b.cyl('rubber', x, 0.06, z, 0.06, 0.04, 'x', 10);
    b.box('painted_dark', x, 0.1, z, 0.03, 0.1, 0.05);
  }
  b.detail(() => {
    b.rod('chrome', -w / 2 + 0.1, 0.2, -l / 2 + 0.18, w / 2 - 0.1, 0.2, -l / 2 + 0.18, 0.015, 6);
    b.rod('chrome', -w / 2 + 0.1, 0.2, l / 2 - 0.18, w / 2 - 0.1, 0.2, l / 2 - 0.18, 0.015, 6);
    b.rod('chrome', 0, 0.2, -l / 2 + 0.18, 0, 0.2, l / 2 - 0.18, 0.02, 6);
    b.box('painted_dark', 0, 0.3, 0.2, 0.25, 0.14, 0.5); // actuator
    b.rod('chrome', 0, 0.3, -0.05, 0, 0.42, -0.5, 0.018, 6);
  });
  // mattress platform: back section slightly raised
  b.box('plastic_white', 0, 0.47, 0.25, w, 0.04, l * 0.62);
  b.rbox('plastic_white', 0, 0.53, -0.72, w, 0.04, 0.72, 0.2, 0, 0);
  b.box('fabric', 0, 0.56, 0.27, w - 0.08, 0.14, l * 0.6);
  b.rbox('fabric', 0, 0.63, -0.7, w - 0.08, 0.14, 0.72, 0.2, 0, 0);
  if (o.pillow !== false) b.rbox('plastic_white', 0.03, 0.76, -0.84, 0.5, 0.09, 0.32, 0.2, o.mess ? 0.3 : 0, 0);
  // head & foot boards
  b.box('plastic_white', 0, 0.75, -l / 2, w + 0.04, 0.62, 0.05);
  b.box('plastic_white', 0, 0.62, l / 2, w + 0.04, 0.42, 0.05);
  b.detail(() => {
    b.box('trim_steel', 0, 0.75, -l / 2 - 0.03, w * 0.6, 0.3, 0.012);
    b.box('painted_dark', 0, 0.62, l / 2 + 0.03, 0.34, 0.2, 0.02); // chart holder
    b.box('plastic_white', 0, 0.65, l / 2 + 0.045, 0.28, 0.18, 0.006);
    if (o.sheet) {
      b.rbox('plastic_white', -0.05, 0.645, 0.5, w - 0.02, 0.02, 1.0, 0, 0.04, 0);
      b.rbox('plastic_white', w / 2 + 0.01, 0.48, 0.55, 0.02, 0.34, 0.8, 0, 0.04, 0.08);
    }
  });
  if (o.rails !== false) {
    b.detail(() => {
      for (const s of [-1, 1]) {
        const x = s * (w / 2 + 0.02);
        for (const z of [-0.55, -0.15, 0.25, 0.65]) b.rod('chrome', x, 0.5, z, x, 0.95, z, 0.012, 5);
        b.rod('chrome', x, 0.95, -0.6, x, 0.95, 0.7, 0.016, 6);
        b.rod('chrome', x, 0.73, -0.55, x, 0.73, 0.65, 0.01, 5);
      }
    });
  }
  if (o.collide !== false) b.collide(-w / 2, 0, -l / 2, w / 2, 0.8, l / 2, 'rubber');
}

/** Gurney / stretcher trolley (length along Z). */
export function gurney(b: Builder) {
  const w = 0.7, l = 1.95;
  b.box('trim_steel', 0, 0.78, 0, w, 0.04, l);
  b.box('fabric', 0, 0.84, 0, w - 0.06, 0.08, l - 0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.06), z = sz * (l / 2 - 0.25);
    b.rod('chrome', x, 0.76, z, x, 0.12, z, 0.018, 6);
    b.cyl('rubber', x, 0.07, z, 0.07, 0.04, 'x', 10);
  }
  b.detail(() => {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.06);
      b.rod('chrome', x, 0.3, -l / 2 + 0.25, x, 0.3, l / 2 - 0.25, 0.014, 5);
      b.rod('chrome', x, 0.76, -l / 2 + 0.25, x, 0.3, l / 2 - 0.25, 0.012, 5);
      b.rod('chrome', x * 1.15, 1.02, -0.5, x * 1.15, 1.02, 0.5, 0.014, 5);
      for (const z of [-0.5, 0, 0.5]) b.rod('chrome', x * 1.15, 0.8, z, x * 1.15, 1.02, z, 0.01, 5);
    }
    b.rod('chrome', -w / 2 + 0.06, 0.3, 0, w / 2 - 0.06, 0.3, 0, 0.014, 5);
    b.rod('chrome', -w / 2 + 0.06, 0.95, -l / 2 - 0.08, w / 2 - 0.06, 0.95, -l / 2 - 0.08, 0.016, 6);
    for (const sx of [-1, 1]) b.rod('chrome', sx * (w / 2 - 0.06), 0.8, -l / 2, sx * (w / 2 - 0.06), 0.95, -l / 2 - 0.08, 0.014, 5);
    b.box('rubber', 0, 0.9, 0.3, w - 0.02, 0.012, 0.06).box('rubber', 0, 0.9, -0.4, w - 0.02, 0.012, 0.06);
  });
}

/** IV stand with bag, drip line and (optionally) a sedation pump. */
export function ivStand(b: Builder, pump = false, bags = 1) {
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * PI) / 5;
    b.rod('chrome', 0, 0.1, 0, Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28, 0.014, 5);
    b.sphere('rubber', Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28, 0.03, 6);
  }
  b.cyl('chrome', 0, 1.0, 0, 0.016, 1.85, 'y', 8);
  b.cyl('chrome', 0, 0.12, 0, 0.04, 0.08, 'y', 8);
  b.detail(() => {
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2 + 0.4;
      b.rod('chrome', 0, 1.92, 0, Math.cos(a) * 0.14, 1.95, Math.sin(a) * 0.14, 0.006, 4);
      b.rod('chrome', Math.cos(a) * 0.14, 1.95, Math.sin(a) * 0.14, Math.cos(a) * 0.14, 1.9, Math.sin(a) * 0.14, 0.006, 4);
    }
    for (let i = 0; i < bags; i++) {
      const a = i * (PI / 2) + 0.4, x = Math.cos(a) * 0.14, z = Math.sin(a) * 0.14;
      b.box('plastic_white', x, 1.72, z, 0.12, 0.22, 0.035);
      b.rod('plastic_white', x, 1.61, z, x, 1.52, z, 0.012, 5);
      cable(b, 'plastic_white', [x, 1.52, z], [0.06, 1.12, 0.05], 0.05, 0.004, 6, 4);
    }
    if (pump) {
      b.box('plastic_white', 0, 1.1, 0.07, 0.22, 0.26, 0.12);
      b.box('screen_off', 0, 1.16, 0.131, 0.15, 0.08, 0.004);
      b.box('emissive_red', -0.07, 1.03, 0.131, 0.02, 0.012, 0.004);
      for (let i = 0; i < 4; i++) b.box('plastic_dark', -0.04 + i * 0.035, 1.03, 0.131, 0.022, 0.022, 0.006);
      cable(b, 'plastic_white', [0.05, 0.98, 0.1], [0.35, 0.75, 0.25], 0.15, 0.004, 8, 4);
    }
  });
}

/** Vitals monitor on a rolling stand. Screen centre ≈ (0, 1.38, 0.071) facing +Z, 0.36 × 0.26. */
export function vitalsStand(b: Builder) {
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2 + PI / 4;
    b.rod('painted_white', 0, 0.09, 0, Math.cos(a) * 0.26, 0.05, Math.sin(a) * 0.26, 0.016, 5);
    b.sphere('rubber', Math.cos(a) * 0.26, 0.03, Math.sin(a) * 0.26, 0.03, 6);
  }
  b.cyl('painted_white', 0, 0.62, 0, 0.022, 1.1, 'y', 8);
  b.box('plastic_white', 0, 1.38, 0, 0.46, 0.36, 0.14);
  b.detail(() => {
    b.box('plastic_dark', 0, 1.38, 0.073, 0.4, 0.3, 0.006);
    b.box('plastic_white', 0, 1.05, 0.02, 0.34, 0.03, 0.26);
    b.box('plastic_white', 0, 0.95, 0.02, 0.3, 0.16, 0.2);
    for (let i = 0; i < 5; i++) b.cyl('plastic_dark', 0.195, 1.26 + i * 0.05, 0.075, 0.012, 0.01, 'z', 6);
    hose(b, 'rubber', [[0.1, 0.95, 0.1], [0.2, 0.6, 0.2], [0.25, 0.25, 0.1], [0.4, 0.02, 0.2]], 0.006, 4);
    hose(b, 'plastic_white', [[-0.1, 0.95, 0.1], [-0.25, 0.7, 0.25], [-0.2, 0.4, 0.3], [-0.45, 0.02, 0.35]], 0.005, 4);
  });
}

/** Folding privacy screen: n fabric panels of width pw in a slight zig-zag along X. */
export function privacyScreen(b: Builder, L: LevelBuild, n = 3, pw = 0.8, h = 1.8, zig = 0.25) {
  const cloth = L.doubleSided('fabric');
  let x = (-n * pw * Math.cos(zig)) / 2, z = 0;
  for (let i = 0; i < n; i++) {
    const a = i % 2 === 0 ? zig : -zig;
    const dx = Math.cos(a) * pw, dz = Math.sin(a) * pw;
    b.rod('chrome', x, 0.05, z, x, h, z, 0.014, 6);
    b.rod('chrome', x + dx, 0.05, z + dz, x + dx, h, z + dz, 0.014, 6);
    b.rod('chrome', x, h, z, x + dx, h, z + dz, 0.012, 5).rod('chrome', x, 0.3, z, x + dx, 0.3, z + dz, 0.012, 5);
    b.sphere('rubber', x, 0.03, z, 0.03, 6);
    b.push(x + dx / 2, (h + 0.3) / 2 + 0.01, z + dz / 2, -a);
    b.geo(cloth, curtainGeo(pw - 0.04, h - 0.34), 'keep', undefined, pw, h);
    b.pop();
    x += dx; z += dz;
  }
  b.sphere('rubber', x, 0.03, z, 0.03, 6);
}

const curtains = new Map<string, THREE.BufferGeometry>();
/** Rippled cloth sheet in XY, centred. */
export function curtainGeo(w: number, h: number, ripples = 7, amp = 0.02): THREE.BufferGeometry {
  const key = `${w.toFixed(2)}_${h.toFixed(2)}_${ripples}_${amp}`;
  let g = curtains.get(key);
  if (g) return g;
  g = new THREE.PlaneGeometry(w, h, ripples * 4, 3);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin((x / w) * ripples * 2 * PI) * amp * (0.6 + 0.4 * (0.5 - y / h)) + Math.sin(x * 3.1 + y * 2) * amp * 0.4);
  }
  g.computeVertexNormals();
  curtains.set(key, g);
  return g;
}

let bodyGeoCache: THREE.BufferGeometry | null = null;
/**
 * A body under a sheet / tarp: draped height field, 1.0 × 2.2 m footprint, head at -Z. Lies on y = 0 local.
 */
export function drapedBody(b: Builder, mat: Mat = 'fabric', scale = 1) {
  if (!bodyGeoCache) {
    const g = new THREE.PlaneGeometry(1.0, 2.2, 16, 34);
    g.rotateX(-PI / 2);
    const p = g.getAttribute('position');
    const bumps: [number, number, number, number, number][] = [
      // x, z, sx, sz, height
      [0, -0.82, 0.11, 0.12, 0.25], [0, -0.48, 0.24, 0.2, 0.25], [0.26, -0.3, 0.07, 0.28, 0.13], [-0.26, -0.3, 0.07, 0.28, 0.13],
      [0, -0.1, 0.2, 0.2, 0.2], [0.1, 0.35, 0.09, 0.3, 0.15], [-0.1, 0.35, 0.09, 0.3, 0.15], [0.11, 0.86, 0.07, 0.09, 0.24], [-0.11, 0.86, 0.07, 0.09, 0.22],
    ];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = 0;
      for (const [bx, bz, sx, sz, bh] of bumps) {
        const d = ((x - bx) * (x - bx)) / (sx * sx) + ((z - bz) * (z - bz)) / (sz * sz);
        h = Math.max(h, bh * Math.exp(-d * 0.6));
      }
      const edge = Math.min(1, Math.min(0.5 - Math.abs(x), 1.1 - Math.abs(z)) / 0.12);
      h = h * Math.max(0, edge) + 0.012 + 0.012 * Math.sin(x * 23 + z * 7) * Math.sin(z * 17 - x * 5);
      p.setY(i, Math.max(0.006, h));
    }
    g.computeVertexNormals();
    bodyGeoCache = g;
  }
  const m = new THREE.Matrix4().makeScale(scale, scale, scale);
  b.geo(mat, bodyGeoCache, 'keep', m, 1, 2.2);
}

/** Pair of work boots sticking out from under a tarp (toes up), at the local origin, soles towards +Z. */
export function boots(b: Builder) {
  for (const s of [-1, 1]) {
    b.rbox('rubber', s * 0.1, 0.13, 0, 0.1, 0.26, 0.12, 0, s * 0.25, 0);
    b.rbox('rubber', s * 0.1, 0.05, -0.12, 0.11, 0.1, 0.2, 0, s * 0.25, 0);
    b.rbox('plastic_dark', s * 0.1 + s * 0.03, 0.14, 0.062, 0.1, 0.27, 0.012, 0, s * 0.25, 0);
  }
}

/** Counter with cabinets, steel top, optional sink; runs along X, back at -Z. */
export function counter(b: Builder, w: number, sink = false, mat: Mat = 'painted_white') {
  const d = 0.6, h = 0.9;
  b.box(mat, 0, 0.5, 0, w, 0.78, d - 0.04);
  b.box('painted_dark', 0, 0.055, 0.02, w, 0.11, d - 0.1);
  b.box('steel_raw', 0, h - 0.015, 0.01, w + 0.02, 0.03, d + 0.02);
  b.box('steel_raw', 0, h + 0.05, -d / 2 + 0.01, w, 0.1, 0.02);
  const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * dw;
      panelOn(b, mat, x, 0.5, d / 2 - 0.02, dw - 0.03, 0.72, '+z', 0.015, 0.012);
      b.box('chrome', x + dw / 2 - 0.07, 0.72, d / 2 + 0.005, 0.015, 0.12, 0.02);
    }
    if (sink) {
      b.box('painted_dark', w / 4, h + 0.001, 0.02, 0.44, 0.004, 0.36);
      b.rod('chrome', w / 4, h, -0.2, w / 4, h + 0.25, -0.2, 0.014, 6);
      b.rod('chrome', w / 4, h + 0.25, -0.2, w / 4, h + 0.22, -0.02, 0.012, 6);
    }
  });
  b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

/** Wall cabinet (upper) on a +Z wall: bottom at y, glass or solid doors. */
export function wallCabinet(b: Builder, w: number, y = 1.45, h = 0.7, cross = false) {
  b.box('painted_white', 0, y + h / 2, 0.16, w, h, 0.32);
  const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * dw;
      panelOn(b, 'painted_white', x, y + h / 2, 0.32, dw - 0.03, h - 0.04, '+z', 0.014, 0.012);
      b.box('chrome', x + dw / 2 - 0.06, y + 0.12, 0.34, 0.015, 0.1, 0.015);
    }
    if (cross) { b.box('emissive_red', 0, y + h / 2, 0.337, 0.2, 0.06, 0.004); b.box('emissive_red', 0, y + h / 2, 0.337, 0.06, 0.2, 0.004); }
  });
}

// ───────────────────────────────────────────────────────────── tech

/** Wall-mounted terminal on a +Z surface. Screen centre (0, y+0.08, 0.125), 0.44 × 0.3, tilted back 0.18 rad. */
export function wallTerminal(b: Builder, y = 1.35) {
  b.box('painted_dark', 0, y + 0.05, 0.05, 0.62, 0.62, 0.1);
  b.rbox('plastic_dark', 0, y + 0.08, 0.1, 0.54, 0.4, 0.05, -0.18, 0, 0);
  b.detail(() => {
    b.rbox('trim_steel', 0, y - 0.23, 0.2, 0.52, 0.03, 0.24, 0.25, 0, 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) b.rbox('plastic_dark', -0.2 + c * 0.044, y - 0.212 - (r - 1.5) * 0.012, 0.2 + (r - 1.5) * 0.045, 0.034, 0.012, 0.034, 0.25, 0, 0);
    b.box('steel_raw', 0.26, y + 0.3, 0.105, 0.05, 0.03, 0.01);
    b.inst('led_green', -0.26, y + 0.32, 0.104).inst('led_amber', -0.22, y + 0.32, 0.104);
    b.rod('rubber', 0.2, y + 0.36, 0.05, 0.2, y + 1.2, 0.05, 0.015, 5);
    b.rod('rubber', 0.16, y + 0.36, 0.05, 0.16, y + 1.2, 0.05, 0.01, 5);
  });
}

/** Flat monitor bezel on a +Z surface, centred at (x, y): screen w × h; mount arm depth `d`. */
export function monitorBezel(b: Builder, x: number, y: number, w: number, h: number, d = 0.08) {
  b.box('plastic_dark', x, y, d - 0.025, w + 0.07, h + 0.07, 0.05);
  b.detail(() => {
    b.box('painted_dark', x, y, (d - 0.05) / 2, Math.min(0.2, w * 0.4), Math.min(0.2, h * 0.5), Math.max(0.01, d - 0.05));
    b.inst('led_green', x + w / 2, y - h / 2 - 0.02, d + 0.001);
  });
}

/**
 * Sloped operator console running along X (width w), operator stands at +Z.
 * Desk surface at 0.95 m sloping up to a riser at the back. Buttons / LEDs instanced.
 */
export function console(b: Builder, w: number, R: Rng, collide = true) {
  b.box('painted_dark', 0, 0.42, -0.1, w, 0.84, 0.7);
  b.box('wall_panel_dark', 0, 0.06, 0.02, w + 0.04, 0.12, 0.9);
  b.rbox('trim_steel', 0, 0.93, 0.12, w, 0.04, 0.62, 0.22, 0, 0);
  b.box('painted_dark', 0, 1.15, -0.36, w, 0.62, 0.18);
  b.detail(() => {
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n, pwid = w / n - 0.05;
      panelOn(b, 'trim_steel', x, 0.45, 0.25, pwid, 0.6, '+z', 0.015, 0.015);
      // button field on the sloped desk
      b.push(x, 0.955, 0.12, 0, 0.22);
      b.box('plastic_dark', 0, 0.004, 0.05, pwid - 0.06, 0.008, 0.36);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        if (R.chance(0.3)) continue;
        const k = R();
        b.inst(k < 0.35 ? 'led_green' : k < 0.6 ? 'led_amber' : k < 0.75 ? 'led_red' : 'led_cyan', -pwid / 2 + 0.08 + (c * (pwid - 0.16)) / 5, 0.012, -0.08 + r * 0.07, -PI / 2, 0, 0, 1.2);
      }
      b.box('plastic_dark', 0, 0.012, 0.27, pwid * 0.5, 0.012, 0.1);
      b.pop();
    }
    b.box('trim_steel', 0, 1.47, -0.36, w + 0.02, 0.03, 0.22);
    for (let i = 0; i < 3; i++) b.rod('rubber', -w / 2 + 0.2 + i * 0.07, 0.05, -0.5, -w / 2 + 0.2 + i * 0.07, 1.3, -0.5, 0.018, 5);
  });
  if (collide) b.collide(-w / 2, 0, -0.45, w / 2, 1.1, 0.42);
}

/** Tablet / PDA lying on a surface at local origin (screen up). */
export function tablet(b: Builder, glow: Mat = 'emissive_cyan', w = 0.24, d = 0.17) {
  b.detail(() => {
    b.box('plastic_dark', 0, 0.008, 0, w, 0.016, d);
    b.box(glow, 0, 0.017, 0, w - 0.03, 0.002, d - 0.03);
  });
}

export function clipboard(b: Builder) {
  b.detail(() => {
    b.box('rust', 0, 0.005, 0, 0.23, 0.01, 0.32);
    b.box('plastic_white', 0, 0.012, 0.01, 0.2, 0.004, 0.27);
    b.box('steel_raw', 0, 0.018, -0.135, 0.1, 0.012, 0.03);
  });
}

/** Scattered paper sheets on the floor around the local origin. */
export function papers(b: Builder, n: number, spread: number, R: Rng) {
  b.detail(() => {
    const m = b.L.overlay('plastic_white'); // sheets lie on desks / mats: never fight them
    for (let i = 0; i < n; i++) b.rbox(m, R.range(-spread, spread), 0.0065 + i * 0.0015, R.range(-spread, spread), 0.21, 0.001, 0.297, 0, R.range(0, 6), 0);
  });
}

export function mug(b: Builder) {
  b.detail(() => { b.cyl('painted_white', 0, 0.05, 0, 0.04, 0.1, 'y', 10); b.torus('painted_white', 0.05, 0.05, 0, 0.028, 0.007, 'z', 8); });
}

export function fireExtinguisher(b: Builder) {
  b.detail(() => {
    lathe(b, 'painted_orange', [[0.001, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.42], [0.05, 0.5], [0.025, 0.53]], 0, 0, 0.09, 10);
    b.box('painted_dark', 0, 0.56, 0.09, 0.04, 0.06, 0.1);
    hose(b, 'rubber', [[0, 0.55, 0.14], [0.06, 0.45, 0.17], [0.07, 0.25, 0.16]], 0.01, 4);
    b.box('steel_raw', 0, 0.3, 0.01, 0.12, 0.04, 0.02);
  });
}

/** Tool chest on casters (0.7 × 0.9 × 0.45). */
export function toolCart(b: Builder, R: Rng, collide = true) {
  const w = 0.7, d = 0.45;
  b.box('painted_orange', 0, 0.5, 0, w, 0.72, d);
  b.box('trim_steel', 0, 0.875, 0, w + 0.04, 0.03, d + 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('rubber', sx * (w / 2 - 0.07), 0.06, sz * (d / 2 - 0.07), 0.055, 0.04, 'x', 8);
  b.detail(() => {
    for (let i = 0; i < 5; i++) {
      const open = i === 1 ? 0.18 : i === 3 ? 0.07 : 0;
      b.box('painted_orange', 0, 0.2 + i * 0.135, d / 2 + 0.006 + open, w - 0.04, 0.12, 0.012 + open * 0.02);
      if (open) b.box('painted_dark', 0, 0.16 + i * 0.135, d / 2 + open / 2, w - 0.08, 0.02, open);
      b.box('steel_raw', 0, 0.235 + i * 0.135, d / 2 + 0.018 + open, w * 0.5, 0.014, 0.014);
    }
    b.rod('chrome', -w / 2 - 0.06, 0.8, -d / 2 + 0.05, -w / 2 - 0.06, 0.8, d / 2 - 0.05, 0.014, 6);
    // stuff on top
    b.box('painted_dark', -0.12, 0.94, 0, 0.3, 0.1, 0.2);
    b.rbox('steel_raw', 0.2, 0.9, 0.05, 0.22, 0.015, 0.03, 0, R.range(0, 3), 0);
    b.rbox('steel_raw', 0.15, 0.9, -0.1, 0.18, 0.012, 0.025, 0, R.range(0, 3), 0);
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, 0.9, d / 2);
}

/** Hand tools scattered on the floor. */
export function tools(b: Builder, n: number, spread: number, R: Rng) {
  b.detail(() => {
    for (let i = 0; i < n; i++) {
      const x = R.range(-spread, spread), z = R.range(-spread, spread), a = R.range(0, 6);
      b.push(x, 0, z, a);
      const k = R.int(0, 2);
      if (k === 0) { b.box('steel_raw', 0, 0.008, 0, 0.26, 0.012, 0.025); b.box('steel_raw', 0.14, 0.008, 0, 0.05, 0.014, 0.055); }
      else if (k === 1) { b.cyl('painted_orange', -0.06, 0.016, 0, 0.016, 0.11, 'x', 6); b.cyl('steel_raw', 0.06, 0.016, 0, 0.005, 0.14, 'x', 5); }
      else { b.box('painted_dark', 0, 0.02, 0, 0.16, 0.04, 0.05); b.cyl('steel_raw', 0.1, 0.02, 0, 0.012, 0.05, 'x', 6); }
      b.pop();
    }
  });
}

/** Heavy electrical switchgear cabinet (0.8 w × 2.2 h × 0.7 d) with meters, LEDs, handle. */
export function switchgear(b: Builder, R: Rng, w = 0.8, h = 2.2, d = 0.7, live = 0.5) {
  b.box('wall_panel_dark', 0, h / 2 + 0.04, 0, w, h - 0.08, d);
  b.box('painted_dark', 0, 0.05, 0, w + 0.02, 0.1, d + 0.02);
  b.box('trim_steel', 0, h + 0.02, 0, w + 0.03, 0.05, d + 0.03);
  b.detail(() => {
    const z = d / 2;
    panel(b, 'wall_panel_dark', -w / 2 + 0.04, 0.16, w / 2 - 0.04, 1.0, z, 0.02, 0.02);
    panel(b, 'trim_steel', -w / 2 + 0.04, 1.05, w / 2 - 0.04, h - 0.1, z, 0.02, 0.02);
    louvre(b, -w / 2 + 0.1, 0.25, w / 2 - 0.1, 0.6, z + 0.02, 0.025);
    b.box('steel_raw', w / 2 - 0.1, 0.82, z + 0.04, 0.03, 0.18, 0.03);
    // meters
    for (let i = 0; i < 2; i++) {
      const mx = -0.16 + i * 0.32;
      b.cyl('painted_dark', mx, h - 0.32, z + 0.03, 0.075, 0.03, 'z', 12);
      b.cyl('plastic_white', mx, h - 0.32, z + 0.047, 0.062, 0.004, 'z', 12);
      b.rbox('painted_dark', mx, h - 0.31, z + 0.051, 0.004, 0.05, 0.002, 0, 0, R.range(-0.9, 0.9));
    }
    // breaker row
    for (let i = 0; i < 5; i++) {
      b.box('plastic_dark', -0.24 + i * 0.12, 1.48, z + 0.035, 0.08, 0.16, 0.04);
      b.box('painted_white', -0.24 + i * 0.12, 1.48 + (R.chance(0.7) ? 0.03 : -0.03), z + 0.06, 0.03, 0.05, 0.02);
    }
    // LED matrix
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      if (!R.chance(live)) continue;
      const k = R();
      b.inst(k < 0.5 ? 'led_green' : k < 0.8 ? 'led_amber' : 'led_red', -0.25 + c * 0.1, 1.2 + r * 0.05, z + 0.022);
    }
    b.sign(R.pick(['11 kV', 'BUS A', 'BUS B', 'FEEDER ' + R.int(1, 9), '보조', 'TIE']), 'label', 0, h - 0.15, z + 0.02, 0.3, 0.08, '+z');
    bolts4(b, -w / 2 + 0.04, 1.05, w / 2 - 0.04, h - 0.1, z + 0.02, 0.03);
  });
}

/** Wire cage wall segment helper in the XY plane of the local frame (see kit.cagePanel). */
export { cagePanel };

// ───────────────────────────────────────────────────────────── android parts (fab hall)

/** Unfinished android torso: origin at the pelvis, y up, chest faces +Z. ~0.9 m tall with head. */
export function androidTorso(b: Builder, head = true, arms: 0 | 1 | 2 = 0, R?: Rng) {
  b.sphere('robot_frame', 0, 0, 0, 0.15, 10, 0.6, 1, 0.7);
  for (let i = 0; i < 4; i++) b.cyl('robot_joint', 0, 0.09 + i * 0.065, -0.02, 0.045 - i * 0.003, 0.05, 'y', 8);
  b.sphere('robot_shell', 0, 0.46, 0, 0.2, 12, 1.15, 1, 0.68);
  b.sphere('robot_frame', 0, 0.3, 0, 0.15, 10, 0.9, 1, 0.7);
  b.detail(() => {
    panelOn(b, 'robot_shell', 0, 0.5, 0.125, 0.24, 0.2, '+z', 0.02, 0.04);
    b.box('robot_frame', 0, 0.36, 0.11, 0.14, 0.05, 0.04);
    b.cyl('robot_joint', 0, 0.71, 0, 0.04, 0.1, 'y', 8);
    for (const s of [-1, 1]) {
      b.sphere('robot_joint', s * 0.23, 0.58, 0, 0.065, 8);
      b.cyl('robot_frame', s * 0.2, 0.58, 0, 0.05, 0.06, 'x', 8);
    }
    // dangling loom from the open abdomen
    for (let i = 0; i < 4; i++) {
      const x = -0.06 + i * 0.04;
      cable(b, i % 2 ? 'rubber' : 'copper', [x, 0.2, 0.08], [x * 1.6, -0.25 - (i % 3) * 0.08, 0.05], 0.03, 0.006, 5, 4);
    }
  });
  if (head) {
    b.sphere('robot_shell', 0, 0.86, 0.01, 0.1, 12, 1.2, 1, 1.1);
    b.detail(() => {
      b.sphere('painted_dark', 0, 0.85, 0.055, 0.075, 10, 1.15, 1.05, 0.9);
      b.sphere('screen_off', 0.03, 0.87, 0.118, 0.014, 6);
      b.sphere('screen_off', -0.03, 0.87, 0.118, 0.014, 6);
    });
  }
  for (let i = 0; i < arms; i++) {
    const s = i === 0 ? 1 : -1;
    b.push(s * 0.25, 0.58, 0, 0, R ? R.range(-0.3, 0.3) : 0, s * 0.08);
    androidArm(b);
    b.pop();
  }
}

/** Android arm hanging down from the origin (shoulder). */
export function androidArm(b: Builder) {
  b.sphere('robot_shell', 0, -0.17, 0, 0.055, 8, 2.9);
  b.sphere('robot_joint', 0, -0.36, 0, 0.045, 8);
  b.sphere('robot_shell', 0, -0.52, 0, 0.045, 8, 3.0);
  b.detail(() => {
    b.cyl('robot_joint', 0, -0.7, 0, 0.03, 0.05, 'y', 8);
    b.box('robot_frame', 0, -0.77, 0, 0.07, 0.1, 0.03);
    for (let i = 0; i < 3; i++) b.box('robot_frame', -0.025 + i * 0.025, -0.86, 0, 0.016, 0.09, 0.018);
  });
}

/** Android leg hanging down from the origin (hip). */
export function androidLeg(b: Builder) {
  b.sphere('robot_joint', 0, 0, 0, 0.07, 8);
  b.sphere('robot_shell', 0, -0.24, 0, 0.075, 10, 3.0);
  b.sphere('robot_joint', 0, -0.47, 0, 0.055, 8);
  b.sphere('robot_shell', 0, -0.7, 0, 0.058, 10, 3.4);
  b.detail(() => {
    b.cyl('robot_joint', 0, -0.91, 0, 0.035, 0.05, 'y', 8);
    b.box('robot_frame', 0, -0.96, 0.05, 0.09, 0.05, 0.24);
  });
}

/** Low steel work table (fab / storage), w × d, top at h. */
export function workTable(b: Builder, w: number, d: number, h = 0.9, collide = true) {
  b.box('steel_raw', 0, h - 0.025, 0, w, 0.05, d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('painted_dark', sx * (w / 2 - 0.05), (h - 0.05) / 2, sz * (d / 2 - 0.05), 0.06, h - 0.05, 0.06);
  b.box('trim_steel', 0, 0.2, 0, w - 0.1, 0.03, d - 0.1);
  b.detail(() => {
    b.box('painted_dark', 0, h - 0.1, d / 2 - 0.03, w - 0.12, 0.1, 0.03);
    b.box('painted_dark', 0, h - 0.1, -d / 2 + 0.03, w - 0.12, 0.1, 0.03);
  });
  if (collide) b.collide(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

/** Bench vise at the local origin (on a table top). */
export function vise(b: Builder) {
  b.detail(() => {
    b.box('painted_dark', 0, 0.03, 0, 0.14, 0.06, 0.2);
    b.box('painted_dark', 0, 0.11, -0.05, 0.12, 0.12, 0.05).box('painted_dark', 0, 0.11, 0.06, 0.12, 0.12, 0.04);
    b.cyl('steel_raw', 0, 0.08, 0.12, 0.012, 0.2, 'z', 6);
    b.rod('steel_raw', -0.09, 0.08, 0.21, 0.09, 0.08, 0.21, 0.006, 5);
  });
}

/** Coil of cable / hose pile on the floor. */
export function cableCoil(b: Builder, r = 0.3, turns = 4, mat: Mat = 'rubber') {
  b.detail(() => { for (let i = 0; i < turns; i++) b.torus(mat, (i % 2) * 0.02, 0.03 + i * 0.05, (i % 3) * 0.015, r - i * 0.012, 0.027, 'y', 14); });
}

/** Thick floor cable running through points (y is added automatically). */
export function floorCable(b: Builder, pts: [number, number][], r = 0.03, mat: Mat = 'rubber') {
  b.detail(() => hose(b, mat, pts.map((p) => [p[0], r * 0.9, p[1]] as [number, number, number]), r, 6, 5));
}

/** Welded steel plate (barricade) standing in the local XY plane, with braces behind (-Z). */
export function weldedPlate(b: Builder, w: number, h: number, R: Rng, mat: Mat = 'rust') {
  b.rbox(mat, 0, h / 2, 0, w, h, 0.02, R.range(-0.06, 0.06), 0, R.range(-0.04, 0.04));
  b.detail(() => {
    for (const s of [-1, 1]) b.rod('steel_raw', s * w * 0.3, h * 0.75, -0.02, s * w * 0.3, 0.02, -0.6, 0.025, 5);
    b.box('steel_raw', 0, h * 0.5, -0.02, w * 0.9, 0.05, 0.03);
    for (let i = 0; i < 5; i++) b.inst('bolt', R.range(-w / 2 + 0.05, w / 2 - 0.05), R.range(0.1, h - 0.1), 0.012, 0, 0, 0, 1.8);
    b.decal('scorch', R.int(0, 3), R.range(-w / 4, w / 4), h * 0.5, 0.011, 0.5, 0.5, '+z', R.range(0, 6));
  });
}

export { pipe };
