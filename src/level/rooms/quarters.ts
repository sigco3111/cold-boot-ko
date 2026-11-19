/**
 * CREW QUARTERS 3 — x -9.5…-1.5 (wall to the corridor is 0.4 thick: clear space ends at -1.92), z -11…-3, h 3.0.
 * Nobody is here. One pendant lamp swings; everything else is dark. Bunks behind curtains, lockers, a
 * canteen corner where somebody laid the night shift's badges out in a row.
 */
import * as THREE from 'three';
import { rng, type Builder, type Rng } from '../builder';
import type { LevelBuild } from '../context';
import { Curtains, Swing, easeInOut, easeOut, unitCurtain } from '../ambient';
import { ductRect, floorSlab, louvre, panel } from '../kit';
import { bench, boots, counter, locker, mug, papers, tablet, wallCabinet } from '../props';
import { scrawlMaterial } from '../scrawl';
import { ceilingSlab, troffer, wallFace } from '../structure';

const PI = Math.PI;
const H = 3.0;
const _v = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);

/** Two-tier steel bunk. Local frame: long axis X (-1…1), wall side -Z, open side +Z. */
function bunk(b: Builder, R: Rng, made: [boolean, boolean], ladder: 1 | -1) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('trim_steel', sx * 0.975, 0.97, sz * 0.425, 0.05, 1.94, 0.05);
  [0.32, 1.32].forEach((y, tier) => {
    b.box('painted_dark', 0, y + 0.02, 0, 1.96, 0.04, 0.86);
    for (const sz of [-1, 1]) b.box('trim_steel', 0, y + 0.03, sz * 0.43, 1.96, 0.1, 0.03);
    for (const sx of [-1, 1]) b.box('trim_steel', sx * 0.975, y + 0.2, 0, 0.03, 0.44, 0.84);
    b.box('fabric', 0, y + 0.1, 0, 1.88, 0.12, 0.8);
    b.detail(() => {
      // pillow + blanket: tucked flat, or left the way somebody got out of it in a hurry
      b.rbox('plastic_white', -0.68, y + 0.2, R.range(-0.05, 0.05), 0.42, 0.09, 0.56, 0, R.range(-0.15, 0.15), 0);
      if (made[tier]) b.box('painted_dark', 0.28, y + 0.175, 0, 1.25, 0.03, 0.8);
      else {
        b.rbox('painted_dark', 0.35, y + 0.2, 0.12, 0.95, 0.07, 0.6, 0.05, R.range(-0.3, 0.3), 0.04);
        b.sphere('painted_dark', 0.1, y + 0.2, 0.2, 0.22, 8, 0.45, 1.3, 0.9);
        b.rbox('painted_dark', 0.75, y + 0.05, 0.47, 0.5, 0.42, 0.03, 0, 0, 0.12); // blanket corner hanging over the side
      }
    });
  });
  b.detail(() => {
    // guard rail (top tier), curtain rail, ladder
    b.rod('trim_steel', -0.975, 1.66, 0.43, 0.25, 1.66, 0.43, 0.014, 5);
    b.rod('trim_steel', 0.25, 1.66, 0.43, 0.25, 1.4, 0.43, 0.014, 5);
    b.rod('chrome', -0.99, 1.95, 0.5, 0.99, 1.95, 0.5, 0.011, 5);
    for (const sx of [-1, 1]) b.rod('chrome', sx * 0.975, 1.95, 0.42, sx * 0.975, 1.95, 0.5, 0.011, 5);
    for (let i = 0; i < 9; i++) b.torus('chrome', -0.9 + i * 0.225, 1.95, 0.5, 0.02, 0.004, 'x', 8);
    const lx = ladder * 0.78;
    for (const s of [-1, 1]) b.rod('trim_steel', lx + s * 0.15, 0.05, 0.47, lx + s * 0.15, 1.7, 0.47, 0.014, 5);
    for (let y = 0.38; y < 1.5; y += 0.3) b.rod('trim_steel', lx - 0.15, y, 0.47, lx + 0.15, y, 0.47, 0.012, 5);
  });
  b.collide(-1.0, 0, -0.45, 1.0, 1.94, 0.47, 'metal');
}

/** Locker shell without a door (0.5 × 2.0 × 0.5), shelves inside. */
function lockerShell(b: Builder, mat: 'wall_panel') {
  const w = 0.5, h = 2.0, d = 0.5, t = 0.02;
  b.box(mat, -w / 2 + t / 2, h / 2, 0, t, h, d).box(mat, w / 2 - t / 2, h / 2, 0, t, h, d);
  b.box(mat, 0, h / 2, -d / 2 + 0.04, w, h, 0.08); // thick back: clears the wall's kick plate and pilasters
  b.box(mat, 0, h - t / 2, 0, w, t, d).box(mat, 0, 0.06, 0, w, 0.12, d);
  b.detail(() => {
    for (const y of [0.45, 1.6]) b.box('trim_steel', 0, y, 0, w - 2 * t, 0.015, d - 2 * t);
    b.rod('chrome', -w / 2 + t, 1.5, 0, w / 2 - t, 1.5, 0, 0.01, 5);
    b.box('screen_off', 0, 1.0, -d / 2 + t + 0.002, w - 2 * t, 1.7, 0.002); // it is very dark in there
  });
}

/** Locker door: hinge at the local origin, door extends along +X, outside faces +Z. */
function lockerDoor(b: Builder, mat: 'wall_panel') {
  const w = 0.5, h = 2.0;
  b.box(mat, w / 2, h / 2 + 0.06, 0.01, w - 0.01, h - 0.14, 0.02);
  b.cast = false;
  panel(b, mat, 0.05, 0.25, w - 0.05, h - 0.5, 0.02, 0.012, 0.02);
  louvre(b, 0.1, h - 0.42, w - 0.1, h - 0.14, 0.02, 0.02, mat);
  b.box('steel_raw', w - 0.07, 1.05, 0.04, 0.03, 0.14, 0.03);
  b.box('painted_dark', w - 0.07, 1.22, 0.035, 0.05, 0.05, 0.02);
}

/** Strip of four booth photos. */
function photoStrip(): THREE.MeshStandardMaterial {
  return scrawlMaterial([], {
    style: 'pen', aspect: 0.27, px: 96, seed: 5,
    bg: (g, W, Hh) => {
      g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 4; i++) {
        const y = 6 + i * ((Hh - 8) / 4), fh = (Hh - 8) / 4 - 6;
        g.fillStyle = ['#3a2c24', '#2c3238', '#3b3026', '#262a30'][i]; g.fillRect(6, y, W - 12, fh);
        // two heads, closer in every frame
        g.fillStyle = '#b89a84';
        const off = 10 - i * 2.5;
        g.beginPath(); g.arc(W / 2 - off, y + fh * 0.45, fh * 0.2, 0, 6.3); g.fill();
        g.fillStyle = '#9c8270';
        g.beginPath(); g.arc(W / 2 + off, y + fh * 0.5, fh * 0.19, 0, 6.3); g.fill();
        g.fillStyle = '#1c2026'; g.fillRect(W / 2 - off - fh * 0.3, y + fh * 0.72, fh * 0.6, fh * 0.28);
        g.fillStyle = '#5a2a1c'; g.fillRect(W / 2 + off - fh * 0.28, y + fh * 0.76, fh * 0.56, fh * 0.24);
      }
    },
  });
}

/** A sheet of note paper with a few hand-written lines (contents are in the story's log, this is set dressing). */
export function notePaper(lines: string[], seed: number, aspect = 0.72): THREE.MeshStandardMaterial {
  return scrawlMaterial(lines, {
    style: 'pen', aspect, px: 256, seed, color: '#1b2130',
    bg: (g, W, Hh) => {
      g.fillStyle = '#cfc9b8'; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = 'rgba(70,90,130,0.35)'; g.lineWidth = 1;
      for (let y = Hh * 0.12; y < Hh; y += Hh * 0.085) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = 'rgba(60,40,20,0.12)'; g.beginPath(); g.arc(W * 0.8, Hh * 0.85, W * 0.22, 0, 6.3); g.fill();
    },
  });
}

export function buildQuarters(L: LevelBuild) {
  const b = L.builder('quarters');
  const R = rng(1212);
  const XE = -1.92;
  L.room('quarters', '승조원 숙소 3', -9.5, -1.5, -11, -3, H, 1.4);

  floorSlab(b, 'floor_rubber', -9.5, -11, -1.5, -3, [], 'rubber');
  ceilingSlab(b, -9.7, -11.2, -1.9, -2.8, H);
  wallFace(b, { n: '-x', plane: XE, from: -11, to: -3, h: H, t: 0.03, openings: [{ c: -6.5, w: 1.6, h: 2.4 }], seed: 81, features: 0, trayY: 0 });
  wallFace(b, { n: '+x', plane: -9.5, from: -11, to: -3, h: H, seed: 82, features: 0.2, trayY: 0, clear: [[-11, -9.8]] });
  wallFace(b, { n: '+z', plane: -11, from: -9.5, to: XE, h: H, seed: 83, features: 0, trayY: 0 });
  wallFace(b, { n: '-z', plane: -3, from: -9.5, to: XE, h: H, seed: 84, features: 0, trayY: 0 });

  // ── ceiling: beams, a duct over the canteen, two dead fixtures ──
  for (const z of [-5.0, -8.9]) b.box('trim_steel', -5.7, H - 0.08, z, 7.56, 0.16, 0.12);
  ductRect(b, 'steel_raw', 'x', -6.1, H - 0.19, -10.35, 6.6, 0.5, 0.3, 1.65);
  b.detail(() => {
    for (const x of [-7.4, -4.4]) { b.box('painted_dark', x, H - 0.36, -10.35, 0.44, 0.04, 0.44); for (let k = -2; k <= 2; k++) b.box('trim_steel', x + k * 0.08, H - 0.385, -10.35, 0.02, 0.012, 0.4); }
    b.rod('painted_orange', -2.4, H - 0.1, -10.9, -2.4, H - 0.1, -3.1, 0.02, 5);
    for (const z of [-9.5, -6.9, -4.2]) { b.cyl('brass', -2.4, H - 0.16, z, 0.012, 0.08, 'y', 6); b.cyl('brass', -2.4, H - 0.21, z, 0.03, 0.006, 'y', 8); }
  });
  troffer(b, L, { group: 'quarters', x: -7.3, y: H, z: -7.0, axis: 'z', dead: true });
  troffer(b, L, { group: 'quarters', x: -3.6, y: H, z: -7.0, axis: 'z', dead: true });

  // ── bunks: two on the west wall, two on the south wall ──
  const BX = -8.96, SZ = -3.54;
  b.at(BX, 0, -4.12, PI / 2, () => bunk(b, R, [false, true], 1));   // A
  b.at(BX, 0, -6.36, PI / 2, () => bunk(b, R, [true, false], -1));  // B — its curtain is the one that moves
  b.at(-6.6, 0, SZ, PI, () => bunk(b, R, [false, true], -1));       // C — Tomas (lower)
  b.at(-4.3, 0, SZ, PI, () => bunk(b, R, [true, true], 1));         // D
  const cloth = L.ctx.materials.clone('fabric', { side: THREE.DoubleSide, color: 0x8f9a94 });
  cloth.name = 'quarters_curtain';
  const cur = new Curtains(L, 'quarters', cloth);
  const CH = 1.68, CY = 1.93;
  cur.add(BX + 0.5, CY, -4.12, PI / 2, 1.9, CH, 1.5);     // A: shut — and it breathes
  cur.add(-6.6 + 0.8, CY, SZ - 0.5, PI, 0.36, CH, 0.6);   // C: pushed back to both ends
  cur.add(-6.6 - 0.8, CY, SZ - 0.5, PI, 0.36, CH, 0.6);
  cur.add(-4.3 + 0.42, CY, SZ - 0.5, PI, 1.05, CH, 1.0);  // D: half drawn
  cur.finish();

  // B's curtain: bunched at the south end until `quarters_curtain` drags it shut
  const cB = new THREE.Mesh(unitCurtain(), cloth);
  cB.name = 'quarters:curtain_b';
  cB.castShadow = true; cB.receiveShadow = true;
  const cBz0 = -6.36 + 0.95; // rail end (south)
  const setCurtain = (w: number, depth: number, swing: number) => {
    cB.position.set(BX + 0.5, CY, cBz0 - w / 2);
    cB.rotation.set(swing, PI / 2, 0, 'YXZ');
    cB.scale.set(w, CH, depth);
  };
  setCurtain(0.4, 1.5, 0);
  L.root.add(cB);
  L.vignette('quarters_curtain', () => {
    const z = (w: number) => cBz0 - w;
    let w = 0.4;
    const sw = new Swing(0, 30, 2.2);
    const tug = (delay: number, to: number, dur: number, vol: number) => {
      const from = { w: 0 };
      L.tween(delay, dur, (k) => { if (k === 0 || from.w === 0) from.w = w; w = from.w + (to - from.w) * easeOut(k); }, () => { sw.v += 1.4; });
      L.after(delay, () => L.sfx('curtain_rail', BX + 0.5, 1.9, z(w), vol, 0.95 + R() * 0.1));
    };
    // a short testing pull — stillness — then the whole length in one drag
    tug(0, 0.72, 0.28, 0.6);
    tug(1.15, 1.9, 0.5, 1);
    let t = 0;
    L.sim((dt) => {
      t += dt;
      const a = sw.step(dt);
      // hem lags the rings: the cloth trails behind the pull, then swings to rest
      setCurtain(w, 1.5 - (w - 0.4) * 0.42 + Math.sin(t * 1.1) * 0.05, a * 0.06);
      return t < 9;
    });
  });

  // Tomas's bunk: notebook on the mattress, photo strip taped to the wall, reading lamp (dead)
  b.detail(() => {
    b.at(-6.35, 0.5, SZ - 0.1, 0.35, () => { b.box('painted_dark', 0, 0.006, 0, 0.3, 0.012, 0.21); b.quad(notePaper(['밤에 그가', '걷는 소리가', '들려'], 7, 1.4), 0.0, 0.0125, 0, 0.28, 0.2, '+y'); b.rod('steel_raw', -0.15, 0.02, -0.1, 0.02, 0.02, -0.11, 0.004, 4); });
    b.quad(photoStrip(), -5.95, 0.98, -3.085, 0.05, 0.185, '-z', 0.12, 'unit', 0.004);
    b.box('plastic_white', -5.95, 1.085, -3.082, 0.03, 0.012, 0.002);
    b.rod('painted_dark', -5.7, 1.27, -3.1, -5.7, 1.18, -3.25, 0.008, 4); b.cyl('painted_dark', -5.7, 1.16, -3.27, 0.035, 0.05, 'y', 8, 0.015);
    b.at(-7.2, 0.5, SZ + 0.1, 0.8, () => mug(b));
  });
  L.interact('note_quarters_bunk', 'log', '노트 읽기', -6.35, 0.55, SZ - 0.1, true, 2.3);
  b.at(-5.65, 0, SZ - 0.75, 2.6, () => boots(b));
  b.at(-8.2, 0, -5.2, 0.9, () => boots(b));

  // ── canteen corner (north-west). The corner itself — about x < -8.4, z < -9.9 — stays empty. ──
  const TX = -7.25, TZ = -9.25;
  b.at(TX, 0, TZ, 0, () => {
    b.box('painted_white', 0, 0.745, 0, 1.6, 0.03, 0.8);
    b.box('trim_steel', 0, 0.715, 0, 1.52, 0.03, 0.72);
    for (const sx of [-1, 1]) { b.box('trim_steel', sx * 0.62, 0.36, 0, 0.05, 0.7, 0.05); b.box('trim_steel', sx * 0.62, 0.02, 0, 0.06, 0.04, 0.66); }
    b.box('trim_steel', 0, 0.2, 0, 1.24, 0.03, 0.04);
    b.collide(-0.8, 0, -0.4, 0.8, 0.76, 0.4);
    b.detail(() => {
      // the badges: nine of them, clips to the north, squared up like cutlery
      for (let i = 0; i < 9; i++) {
        const x = -0.6 + i * 0.15;
        b.box('plastic_white', x, 0.762, 0.14, 0.056, 0.003, 0.088);
        b.box(i % 3 === 0 ? 'painted_orange' : i % 3 === 1 ? 'painted_yellow' : 'painted_dark', x, 0.7645, 0.176, 0.056, 0.001, 0.014);
        b.box('painted_dark', x - 0.008, 0.7645, 0.13, 0.03, 0.001, 0.038);
        b.box('steel_raw', x, 0.765, 0.09, 0.02, 0.006, 0.014);
        b.box('rubber', x, 0.7615, -0.06, 0.009, 0.002, 0.29);
      }
      b.at(0.62, 0.76, -0.22, 0.4, () => mug(b));
      b.at(-0.66, 0.76, 0.3, 2.0, () => mug(b));
      b.rbox('plastic_dark', 0.45, 0.765, 0.3, 0.3, 0.012, 0.22, 0, 0.2, 0); // tray
      b.cyl('steel_raw', 0.5, 0.79, 0.32, 0.05, 0.04, 'y', 10);
    });
  });
  L.interact('note_quarters_badges', 'log', '배지 보기', TX, 0.8, TZ + 0.12, true, 2.4);
  b.at(TX + 0.05, 0, TZ + 0.68, 0, () => bench(b, 1.4));
  b.at(TX + 0.2, 0, TZ - 0.72, 0.16, () => bench(b, 1.4));

  // kitchenette along the north wall + a dead cooler
  b.at(-4.95, 0, -10.67, 0, () => counter(b, 2.5, true));
  b.at(-4.95, 0, -11, 0, () => wallCabinet(b, 2.5, 1.5, 0.6));
  b.at(-3.08, 0, -10.62, 0, () => {
    b.box('painted_white', 0, 0.95, 0, 0.7, 1.9, 0.66);
    b.detail(() => { b.box('screen_off', -0.05, 1.1, 0.332, 0.48, 1.3, 0.004); b.box('chrome', 0.27, 1.1, 0.35, 0.02, 0.5, 0.03); louvre(b, -0.3, 0.06, 0.3, 0.32, 0.33, 0.02); });
    b.collide(-0.35, 0, -0.33, 0.35, 1.9, 0.33);
  });
  b.detail(() => {
    b.at(-5.7, 0.9, -10.6, 0.5, () => mug(b));
    b.at(-5.52, 0.9, -10.72, 2.5, () => mug(b));
    // kettle, hot-drinks dispenser with one LED still lit
    b.cyl('steel_raw', -5.2, 1.0, -10.72, 0.08, 0.2, 'y', 12, 0.065); b.torus('plastic_dark', -5.2, 1.03, -10.63, 0.05, 0.008, 'x', 8);
    b.box('painted_dark', -4.5, 1.12, -10.76, 0.34, 0.44, 0.3);
    b.box('screen_off', -4.5, 1.2, -10.608, 0.22, 0.1, 0.004);
    b.inst('led_green', -4.38, 1.03, -10.606);
    b.sign('온수만 나옴 — 시럽 라인 고장', 'label', -4.5, 1.37, -10.609, 0.3, 0.05, '+z');
    b.at(-6.9, 0, -10.4, 0, () => papers(b, 3, 0.4, R));
  });
  L.point('quarters', -4.4, 1.15, -10.4, 0x58ffb0, 0.3, 2.2);
  L.pickup('p_quarters_med', 'medkit', -4.0, 0.92, -10.62, 35, 0.4);

  // ── lockers on the east wall, north of the door ──
  const LX = XE - 0.26, LZ0 = -10.2;
  const BANG = 1, OPEN = 3;
  for (let i = 0; i < 5; i++) {
    const z = LZ0 + 0.25 + i * 0.5;
    b.at(LX, 0, z, -PI / 2, () => {
      if (i === BANG) lockerShell(b, 'wall_panel');
      else locker(b, i === OPEN ? 1.75 : 0, 'wall_panel', 0.5, 2.0, 0.5, false);
    });
  }
  b.collide(LX - 0.25, 0, LZ0, LX + 0.25, 2.0, LZ0 + 2.5);
  const oz = LZ0 + 0.25 + OPEN * 0.5, bz = LZ0 + 0.25 + BANG * 0.5;
  b.detail(() => {
    // inside the open one: a folded overall, a helmet, a box of 9 mm on the shelf
    b.box('fabric', LX + 0.02, 0.5, oz, 0.34, 0.07, 0.36);
    b.sphere('painted_yellow', LX + 0.02, 1.68, oz, 0.12, 10, 0.75);
    b.sign('T. 베리', 'label', LX - 0.251, 1.75, oz + 0.5, 0.16, 0.035, '-x');
    b.sign('M. 오카포', 'label', LX - 0.266, 1.75, bz, 0.16, 0.035, '-x');
    b.decal('scratches', 2, LX - 0.266, 0.9, bz + 0.5, 0.4, 0.5, '-x');
  });
  L.pickup('p_quarters_ammo', 'ammo_pistol', LX - 0.04, 1.11, oz, 12, PI / 2);

  // the locker that bangs: its door is a separate part hinged on the north edge
  const door = L.part('quarters:locker_door');
  lockerDoor(door, 'wall_panel');
  const doorObj = door.build(false);
  doorObj.position.set(LX - 0.25, 0, bz - 0.25);
  const DRY = -PI / 2;
  doorObj.rotation.y = DRY;
  L.root.add(doorObj);
  L.objects.set('quarters_locker', doorObj);
  L.ctx.physics.addMover?.(doorObj); // REVISION 5.2: holes shot into the closed door swing open with it
  // story markers: where the standing figure goes (facing into the corner), and the curtain that moves
  L.marker('quarters_figure', -8.95, 0, -10.45, PI / 4);
  L.marker('quarters_curtain', BX + 0.5, 1.0, -6.36, -PI / 2);
  L.vignette('quarters_locker_bang', () => {
    const fx = L.ctx.fx, px = LX - 0.3, pz = bz;
    let open = 0, vel = 0, hold = true;
    const bang = (delay: number, force: number) => L.after(delay, () => {
      vel = force;
      L.sfx('locker_bang', px, 1.1, pz, 0.7 + force * 0.08, 0.92 + R() * 0.12);
      fx.smoke(_v.set(px - 0.05, 1.75, pz), { count: 3, size: 0.18, color: 0x8a8f8c, rise: -0.1, life: 1.2 });
    });
    // two, a breath, then the hard one
    bang(0, 2.6); bang(0.5, 3.0); bang(1.25, 4.6);
    L.after(2.6, () => { hold = false; vel = 0.5; L.sfx('metal_groan', px, 1.2, pz, 0.35, 1.5); });
    let t = 0;
    L.sim((dt) => {
      t += dt;
      if (hold) {
        // the latch holds: the door kicks out a few degrees and slams back against the frame
        vel += (-open * 900 - vel * 9) * dt;
        open = Math.max(0, open + vel * dt);
        if (open === 0 && vel < 0) vel = -vel * 0.3;
      } else {
        // latch gone: it swings open under its own weight, slows, and keeps drifting
        const target = 1.5 + Math.sin(t * 0.7) * 0.05 * Math.max(0, 1 - (t - 2.6) / 14);
        vel += ((target - open) * 2.2 - vel * 1.5) * dt;
        open += vel * dt;
      }
      doorObj.rotation.y = DRY - open;
      return t < 18;
    });
  });

  // ── coat hooks south of the door: one jacket still on its hook ──
  b.at(XE, 0, -4.35, -PI / 2, () => {
    b.detail(() => {
      b.box('trim_steel', 0, 1.72, 0.015, 1.7, 0.07, 0.03);
      for (let i = 0; i < 5; i++) { const x = -0.7 + i * 0.35; b.rod('steel_raw', x, 1.72, 0.03, x, 1.7, 0.1, 0.008, 5); b.rod('steel_raw', x, 1.7, 0.1, x, 1.76, 0.12, 0.008, 5); }
      // jacket (hi-vis), hanging by its collar
      b.sphere('painted_orange', 0, 1.3, 0.11, 0.25, 10, 1.6, 1, 0.34);
      for (const s of [-1, 1]) b.sphere('painted_orange', s * 0.26, 1.22, 0.1, 0.07, 8, 4.4, 1, 0.9);
      b.sphere('painted_orange', 0, 1.66, 0.1, 0.1, 8, 0.9, 1.2, 0.7);
      for (const y of [1.08, 1.26]) b.box('chrome', 0, y, 0.196, 0.46, 0.035, 0.006);
      for (const s of [-1, 1]) b.box('chrome', s * 0.26, 1.02, 0.166, 0.13, 0.03, 0.006);
      b.sign('정숙 — 야간조 수면 중', 'warning', -1.05, 1.5, 0.036, 0.5, 0.1, '+z', 0, true);
    });
    b.at(-0.35, 0, 0.2, 0.3, () => boots(b));
    // duffel bag
    b.cyl('fabric', 0.55, 0.16, 0.22, 0.16, 0.6, 'x', 10);
    b.detail(() => { for (const s of [-1, 1]) b.torus('rubber', 0.55 + s * 0.12, 0.16, 0.22, 0.165, 0.012, 'x', 10); });
  });

  // ── signs, stains ──
  b.sign('승조원 숙소 3', 'stencil', -2.9, 2.5, -10.964, 1.5, 0.24, '+z');
  b.sign('B조', 'stencil', -9.464, 2.45, -8.7, 0.9, 0.22, '+x');
  b.detail(() => {
    // notice board: rota, a child's drawing, somebody's lost-cat joke
    b.box('rust', -9.455, 1.5, -8.7, 0.02, 0.7, 1.0);
    for (let i = 0; i < 5; i++) b.box('plastic_white', -9.442, 1.36 + (i % 2) * 0.26 + R.range(-0.03, 0.03), -9.08 + i * 0.19, 0.003, 0.24, 0.16);
    b.sign('근무표 — 31주차', 'label', -9.44, 1.8, -8.7, 0.34, 0.06, '+x');
  });
  b.decal('grime', 1, -5.5, 0.002, -6.9, 3.2, 3.2, '+y', 0.4);
  b.decal('scratches', 0, -3.3, 0.002, -9.5, 1.1, 1.1, '+y', 0.6);
  b.decal('water_stain', 2, -4.4, 0.002, -10.0, 0.8, 0.8, '+y');
  b.decal('oil_stain', 3, -8.9, 0.002, -10.4, 1.1, 1.1, '+y', 0.3);

  // ── the pendant lamp: the only light, and it will not hang still ──
  const AX = -5.4, AZ = -6.9, LEN = 0.92;
  b.detail(() => { b.cyl('painted_dark', AX, H - 0.03, AZ, 0.06, 0.06, 'y', 10); });
  const lamp = L.spot('quarters', AX, H - LEN - 0.06, AZ, AX, 0, AZ, 0xffd7a0, 170, 9.5, 1.05, { cast: true, vol: true, priority: 3, penumbra: 0.75 });
  const lp = L.part('quarters:lamp');
  lp.rod('painted_dark', 0, 0, 0, 0, -LEN + 0.12, 0, 0.006, 5);
  lp.cyl('painted_dark', 0, -LEN + 0.11, 0, 0.03, 0.06, 'y', 8);
  lp.cyl('painted_dark', 0, -LEN + 0.04, 0, 0.2, 0.13, 'y', 16, 0.04);
  lp.sphere(L.glow(lamp, 'emissive_warm', 1.3), 0, -LEN + 0.02, 0, 0.04, 8);
  const lampObj = lp.build(false);
  lampObj.position.set(AX, H - 0.06, AZ);
  for (const m of lampObj.children) m.castShadow = false;
  L.root.add(lampObj);
  L.objects.set('quarters_lamp', lampObj);
  // swing plane: the diagonal towards the canteen corner, so its far edge of light keeps brushing that corner
  const dX = -0.70, dZ = -0.714, w1 = (2 * PI) / 3.5, w2 = (2 * PI) / 3.72;
  let swingK = 0;
  L.ambient('quarters', (_dt, t) => {
    const a1 = Math.sin(t * w1) * 0.2 + Math.sin(t * w1 * 2.71 + 1.0) * 0.012, a2 = Math.sin(t * w2 + 0.8) * 0.055;
    const s1 = Math.sin(a1), s2 = Math.sin(a2);
    const hx = s1 * dX + s2 * -dZ, hz = s1 * dZ + s2 * dX;
    _v.set(hx, -Math.sqrt(Math.max(0, 1 - hx * hx - hz * hz)), hz);
    lampObj.quaternion.setFromUnitVectors(_down, _v);
    lamp.position.set(AX + _v.x * LEN, H - 0.06 + _v.y * LEN, AZ + _v.z * LEN);
    lamp.target.set(AX + _v.x * 4, H - 0.06 + _v.y * 4, AZ + _v.z * 4);
    swingK = s1;
  });

  // light falling through the gap of the door into the corridor (a slab that widens as the door opens)
  const slab = new THREE.Box3(new THREE.Vector3(-2.05, -1, -7.0), new THREE.Vector3(1.9, 3.4, -6.0));
  const spill = L.spot('quarters', -2.7, 1.75, -6.5, 1.4, 0.5, -6.5, 0xffd7a0, 30, 6.5, 0.85, { penumbra: 0.9, bounds: slab });
  L.updaters.push(() => {
    const d = L.doors.get('d_quarters');
    if (!d) return;
    const e = d.t * d.t * (3 - 2 * d.t), hw = 0.42 + e * 0.75;
    slab.min.z = -6.5 - hw; slab.max.z = -6.5 + hw;
    // brighter when the lamp swings towards the door
    spill.intensityScale = d.locked ? 0 : 0.8 - swingK * 1.6;
  });

  L.ctx.fx.emitter('dust', L.vec(AX, 1.5, AZ), L.vec(2.5, 1.2, 2.5), 6);
  void tablet; void easeInOut;
}
