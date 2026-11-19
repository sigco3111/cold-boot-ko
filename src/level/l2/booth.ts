/**
 * LINE CONTROL — x -17…-10, z -50…-42, h 3.0. Tomas's booth. Thick glass to the hall (east) and a long
 * window to the spine (west). A low operator console under the glass so whoever sits there is seen from
 * the hall, the e-stop he hit, monitors on the side wall, an intercom, and a nest: a coverall on the
 * floor, an empty bottle, the marker. Warm light inside — the only friendly light in section C.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { cable, floorSlab, panelOn, pipe } from '../kit';
import { chair, monitorBezel, mug, papers } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';
import { scrawlMaterial } from '../scrawl';
import { clothHeap, revealable } from './kit2';
import { BOOTH_HALL_Z, GLASS } from './hall';

const PI = Math.PI;
const H = 3.0;
/**
 * The two spine windows (glass at x = -17). REVISION 5.1: shortened so the open leaves of `d2_booth`
 * (z -47.64 … -44.36) slide into solid wall: south window z -49.5 … -47.8, north window z -44.2 … -42.5.
 */
export const SPINE_WINDOWS = [{ c: -48.65, w: 1.7 }, { c: -43.35, w: 1.7 }];
/** Tomas's marks at the spine windows: 0.5 m inside the glass, window centres (REVISION 5.1). */
export const BOOTH_MARKS: [number, number][] = [[-16.5, -48.65], [-16.5, -43.35]];

export function buildBooth(L: LevelBuild) {
  const b = L.builder('booth');
  const R = rng(2501);
  L.room('booth', '라인 관제', -17, -10, -50, -42, H);
  floorSlab(b, 'floor_rubber', -17, -50, -10, -42, [], 'rubber');
  ceilingSlab(b, -17.0, -50.2, -10.0, -41.8, H); // inside the hall's / spine's wall faces
  wallFace(b, { n: '-x', plane: -10.2, from: -49.8, to: -42.2, h: H, t: 0.2, seed: 251, trayY: 0, features: 0, clearWindows: true, ext: [0, 0],
    openings: [{ c: (GLASS.z0 + GLASS.z1) / 2, w: GLASS.z1 - GLASS.z0, h: GLASS.y1 - GLASS.y0, y0: GLASS.y0 }, { c: BOOTH_HALL_Z, w: 1.6, h: 2.4 }] });
  const SW = SPINE_WINDOWS;
  wallFace(b, { n: '+x', plane: -16.8, from: -49.8, to: -42.2, h: H, t: 0.2, seed: 252, trayY: 0, features: 0, clearWindows: true,
    openings: [...SW.map((w) => ({ ...w, h: 1.5, y0: 0.95 })), { c: -46, w: 1.6, h: 2.4 }] });
  // (no extension past x -10.2: the closed north leaf of d2_booth_hall stands there)
  wallFace(b, { n: '-z', plane: -42.2, from: -16.8, to: -10.2, h: H, t: 0.2, seed: 253, trayY: 0, features: 0, ext: [0.2, 0] });
  wallFace(b, { n: '+z', plane: -49.8, from: -16.8, to: -10.2, h: H, t: 0.2, seed: 254, trayY: 0, features: 0.3 });

  // d2_booth_hall's north leaf pocket: solid wall on the booth side too (outside the room)
  b.bx('wall_panel_dark', -10.3, 0, -42.0, -10.0, 2.6, -41.3);

  // ── spine window: thick glass, frames ──
  const glass = L.ctx.materials.get('glass_thick');
  for (const w of SW) {
    b.detail(() => b.quad(glass, -17, 0.95 + 0.75, w.c, w.w, 1.5, '+x', 0, 'box'));
    b.collide(-17.05, 0.95, w.c - w.w / 2, -16.95, 2.45, w.c + w.w / 2, 'glass');
    for (const s of [-1, 1]) {
      b.box('trim_steel', -17 + s * 0.17, 0.95, w.c, 0.14, 0.06, w.w + 0.1);
      b.box('trim_steel', -17 + s * 0.17, 2.45, w.c, 0.14, 0.06, w.w + 0.1);
      b.box('trim_steel', -17, 1.7, w.c + s * (w.w / 2), 0.36, 1.6, 0.06);
    }
  }
  const sw = new THREE.Object3D(); sw.name = 'booth_window_spine'; sw.position.set(-17, 1.7, -46); L.root.add(sw); L.objects.set('booth_window_spine', sw);

  // ── the operator console: low, along the glass, the operator faces the hall ──
  // short console at the south end of the glass: the rest of the glass (z -48…-44.3) is open floor, so a
  // person can stand right at it (0.42 m from the pane) to bang on it or write on it
  const cx = -10.75, cz0 = -49.6, cz1 = -47.95, cw = cz1 - cz0, czc = (cz0 + cz1) / 2;
  b.bx('painted_dark', cx - 0.4, 0, cz0, cx + 0.45, 0.72, cz1);
  b.bx('wall_panel_dark', cx - 0.45, 0, cz0 - 0.03, cx + 0.5, 0.08, cz1 + 0.03);
  b.push(cx - 0.05, 0.74, czc, -PI / 2, 0.16, 0);
  b.box('trim_steel', 0, 0, 0, cw + 0.02, 0.035, 0.95);
  b.pop();
  b.box('painted_dark', cx + 0.42, 0.84, czc, 0.12, 0.22, cw - 0.03); // riser under the sill
  b.detail(() => {
    // button fields, the console screen bezel, labels
    for (let i = 0; i < 2; i++) {
      const z = cz0 + 0.4 + i * (cw - 0.8);
      b.push(cx - 0.02, 0.765, z, -PI / 2, 0.16, 0);
      b.box('plastic_dark', 0, 0.01, 0, 0.62, 0.012, 0.5);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (R.chance(0.7)) {
        const k = R();
        b.inst(k < 0.4 ? 'led_green' : k < 0.65 ? 'led_amber' : k < 0.8 ? 'led_red' : 'led_cyan', -0.22 + c * 0.11, 0.02, -0.15 + r * 0.1, -PI / 2, 0, 0, 1.3);
      }
      b.pop();
    }
    for (let i = 0; i < 2; i++) panelOn(b, 'trim_steel', cx - 0.41, 0.38, cz0 + 0.4 + i * (cw - 0.8), 0.7, 0.55, '-x', 0.012, 0.012);
    for (let i = 0; i < 4; i++) b.rod('rubber', cx + 0.3, 0.05, cz0 + 0.3 + i * 0.07, cx + 0.3, 0.7, cz0 + 0.3 + i * 0.07, 0.016, 5);
    b.sign('라인 2 — 현장 제어', 'label', cx + 0.36, 0.9, czc, 1.2, 0.09, '-x');
  });
  b.collide(cx - 0.45, 0, cz0, cx + 0.5, 0.95, cz1);
  // main console screen, sunk into the desk at the operator's left hand (seen from the hall, glowing)
  b.box('plastic_dark', cx - 0.03, 0.8, -48.75, 0.4, 0.06, 0.6);
  const scr = L.screen('booth_console', 'terminal_idle', 0.52, 0.3, cx - 0.02, 0.86, -48.75, '-x', { text: '오더 0031-H  (본사)\n인원 0으로 수율 유지\n상태: 실행 중' });
  scr.rotation.set(-1.15, -PI / 2, 0, 'YXZ');
  scr.position.set(cx - 0.03, 0.85, -48.75);
  const co = new THREE.Object3D(); co.name = 'booth_console'; co.position.set(cx - 0.05, 0.85, -48.75); L.root.add(co); L.objects.set('booth_console', co);
  // disabled until Tomas is gone (story enables it — REVISION 5.1)
  L.interact('term2_booth', 'terminal', '콘솔 읽기', cx - 0.15, 0.95, -48.75, false, 2.0);
  // the e-stop he hit: mushroom head pressed down in its yellow collar
  b.at(cx - 0.02, 0.78, -48.22, 0, () => {
    b.box('painted_yellow', 0, 0.04, 0, 0.16, 0.08, 0.16);
    b.cyl('painted_dark', 0, 0.09, 0, 0.045, 0.04, 'y', 12);
    b.detail(() => b.sign('비상 정지', 'label', 0.11, 0.06, 0, 0.14, 0.03, '-x'));
  });
  const est = L.part('booth:estop');
  est.cyl('emissive_red', 0, 0.0, 0, 0.065, 0.04, 'y', 16);
  est.sphere('emissive_red', 0, 0.02, 0, 0.065, 12, 0.35);
  const estG = est.build(false);
  estG.position.set(cx - 0.02, 0.88, -48.22);
  estG.userData.rooms = ['booth'];
  L.root.add(estG); L.objects.set('booth_estop', estG);
  // intercom with gooseneck mic
  b.at(cx - 0.12, 0.78, -49.35, -PI / 2, () => {
    b.box('painted_dark', 0, 0.05, 0, 0.26, 0.1, 0.18);
    b.detail(() => {
      for (let i = 0; i < 5; i++) b.box('trim_steel', -0.05, 0.102, -0.06 + i * 0.03, 0.12, 0.004, 0.012);
      b.cyl('emissive_green', 0.08, 0.105, 0.04, 0.015, 0.01, 'y', 8);
      b.rod('chrome', 0.06, 0.1, -0.05, 0.08, 0.32, -0.12, 0.008, 5);
      b.rod('chrome', 0.08, 0.32, -0.12, 0.08, 0.36, -0.22, 0.008, 5);
      b.cyl('rubber', 0.08, 0.36, -0.25, 0.018, 0.06, 'z', 8);
    });
  });
  // the marker, the bottle, a cup, papers he wrote on
  b.detail(() => {
    b.rbox('painted_dark', cx - 0.15, 0.775, -48.1, 0.13, 0.018, 0.018, 0, 0.4, 0);
    b.rbox('painted_white', cx - 0.07, 0.775, -48.06, 0.02, 0.014, 0.014, 0, 0.4, 0);
  });
  b.at(cx - 0.3, 0.765, -49.45, 0, () => mug(b));
  b.detail(() => b.rbox('plastic_white', -10.32, 0.95, -46.6, 0.12, 0.002, 0.21, 0, 0.1, 0)); // a sheet on the sill
  // ── chair, angled as he left it ──
  const chB = L.part('booth:chair');
  chair(chB, 'fabric');
  const chG = chB.build(false);
  chG.position.set(-11.75, 0, -48.7); chG.rotation.y = PI / 2 + 0.2;
  for (const m of chG.children) m.castShadow = true;
  chG.userData.rooms = ['booth'];
  L.root.add(chG); L.objects.set('booth_chair', chG);
  // ── side desk on the north wall with the monitors ──
  b.bx('trim_steel', -16.6, 0.72, -42.85, -12.2, 0.76, -42.2);
  b.bx('painted_dark', -16.6, 0, -42.8, -16.2, 0.72, -42.25);
  b.bx('painted_dark', -12.6, 0, -42.8, -12.2, 0.72, -42.25);
  b.collide(-16.6, 0, -42.85, -12.2, 0.76, -42.2);
  for (let i = 0; i < 3; i++) {
    const mx = -15.7 + i * 1.15;
    b.at(0, 0, -42.2, PI, () => monitorBezel(b, -mx, 1.45, 0.9, 0.55, 0.12));
    L.screen(`booth_monitor_${i + 1}`, 'camera_feed', 0.9, 0.55, mx, 1.45, -42.2 - 0.121, '-z');
  }
  b.detail(() => {
    b.box('plastic_dark', -14.5, 0.785, -42.55, 0.5, 0.02, 0.18);
    for (let i = 0; i < 3; i++) cable(b, 'plastic_dark', [-15.7 + i * 1.15, 1.2, -42.25], [-15.4 + i * 1.15, 0.76, -42.3], 0.08, 0.008, 6, 4);
    b.sign('CAM 01 · 02 · 03', 'label', -14.55, 1.85, -42.215, 0.8, 0.07, '-z');
  });
  // ── the nest: coverall heap, cardboard to sleep on, a water bottle, wrappers ──
  b.detail(() => {
    b.rbox('plastic_white', -15.6, 0.006, -48.8, 1.9, 0.012, 0.85, 0, 0.12, 0);
    b.rbox('rust', -15.6, 0.014, -48.75, 1.7, 0.006, 0.7, 0, 0.12, 0);
  });
  b.at(-16.1, 0.02, -49.2, 0.4, () => clothHeap(b));
  b.at(-14.5, 0, -49.3, 0, () => {
    b.detail(() => {
      b.rbox('plastic_white', 0, 0.035, 0, 0.07, 0.07, 0.24, 0, 0.9, PI / 2);
      b.cyl('plastic_dark', 0.12 * Math.cos(0.9), 0.035, -0.12 * Math.sin(0.9), 0.018, 0.03, 'x', 8);
      for (let i = 0; i < 3; i++) b.rbox(i % 2 ? 'painted_orange' : 'plastic_white', 0.3 + i * 0.12, 0.004, 0.2 - i * 0.07, 0.12, 0.006, 0.08, 0, i * 1.3, 0);
    });
  });
  // his recorder on the floor by the chair (REVISION 5.1: the floor item is a recorder, id kept; story enables it)
  b.at(-12.4, 0, -45.6, 0.7, () => {
    b.detail(() => {
      b.rbox('plastic_dark', 0, 0.018, 0, 0.07, 0.036, 0.13, 0, 0, 0);
      b.rbox('trim_steel', 0, 0.037, 0.03, 0.05, 0.002, 0.05, 0, 0, 0);
      b.box('emissive_red', 0.022, 0.0375, -0.045, 0.008, 0.002, 0.008);
      for (let i = 0; i < 3; i++) b.box('plastic_white', -0.02 + i * 0.02, 0.0372, -0.03, 0.012, 0.0015, 0.008);
      b.cyl('steel_raw', 0, 0.018, 0.068, 0.012, 0.01, 'z', 8);
    });
  });
  L.interact('booth_headset', 'log', '녹음기 줍기', -12.4, 0.12, -45.6, false, 2.0);
  const rec = new THREE.Object3D(); rec.name = 'booth_recorder'; rec.position.set(-12.4, 0.04, -45.6); L.root.add(rec); L.objects.set('booth_recorder', rec);
  // supplies (REVISION 5.1): a medkit and shells on the side desk
  L.pickup('p2_booth_med', 'medkit', -12.9, 0.77, -42.55, 35, 0.2);
  L.pickup('p2_booth_shells', 'ammo_shotgun', -13.7, 0.77, -42.5, 6, -0.3);
  // the window marks Tomas goes to (story reads them with level.object)
  BOOTH_MARKS.forEach(([mx, mz], i) => L.marker(`booth_mark_${i + 1}`, mx, 0, mz, -PI / 2));

  // ── warm light: a ceiling fitting and a desk lamp ──
  // a lit room seen from the dark: two warm ceiling fittings, a warm wash on the back (west) wall so a
  // figure at the glass is silhouetted against light, and a soft frontal key just inside the glass
  const BB = new THREE.Box3(new THREE.Vector3(-17.1, -1, -50.1), new THREE.Vector3(-9.95, 4, -41.9));
  let tg: THREE.Material | undefined;
  for (const z of [-48.0, -44.8]) {
    const h = troffer(b, L, { group: 'booth', x: -12.2, y: H, z, axis: 'z', len: 1.2, intensity: 75, distance: 7, angle: 1.35, color: 0xffc890, cast: z === -48.0, glow: 'emissive_warm', glowMat: tg, priority: 3, target: [-11.6, 0.6, z], bounds: BB });
    tg = (h as any)?.glowMat ?? tg;
  }
  L.spot('booth', -11.0, 2.8, -46.2, -16.8, 1.4, -46.2, 0xffb070, 70, 8, 1.0, { priority: 3, penumbra: 0.9, bounds: BB });
  // the key: from the ceiling right behind the glass, angled back and down onto a face 0.4 m inside it
  const key = L.spot('booth', -10.15, 2.75, -46.4, -10.75, 1.45, -46.4, 0xffd2a6, 30, 3.2, 1.25, { priority: 3, penumbra: 0.95, bounds: BB });
  const km = L.glow(key, 'emissive_warm', 0.6);
  b.detail(() => { b.box('painted_dark', -10.3, 2.86, -46.4, 0.12, 0.06, 3.0); b.box(km, -10.32, 2.825, -46.4, 0.06, 0.012, 2.9); });
  const lamp = L.point('booth', cx - 0.2, 1.25, -49.2, 0xffb060, 8, 4.5, { priority: 3 });
  const lm = L.glow(lamp, 'emissive_warm', 1.2);
  b.at(cx - 0.15, 0.765, -49.25, 0, () => {
    b.cyl('painted_dark', 0, 0.01, 0, 0.08, 0.02, 'y', 12);
    b.rod('painted_dark', 0, 0.02, 0, -0.08, 0.36, 0.05, 0.008, 5);
    b.rod('painted_dark', -0.08, 0.36, 0.05, -0.05, 0.48, 0.12, 0.008, 5);
    b.cyl('painted_dark', -0.05, 0.47, 0.13, 0.07, 0.09, 'y', 12, 0.03);
    b.cyl(lm, -0.05, 0.425, 0.13, 0.055, 0.005, 'y', 12);
  });
  // face light: a warm sill lamp just inside the glass, low, aimed back into the room at head height — whoever
  // stands or sits facing the hall is lit from the front and reads from 8–10 m out there
  const face = L.spot('booth', -10.38, 0.98, -46.4, -11.4, 1.6, -46.8, 0xffc08a, 45, 4, 1.1, { priority: 3, penumbra: 0.8, bounds: BB });
  const fm = L.glow(face, 'emissive_warm', 0.7);
  b.detail(() => { b.box('painted_dark', -10.36, 0.93, -46.2, 0.07, 0.05, 3.6); b.box(fm, -10.4, 0.95, -46.2, 0.012, 0.018, 3.4); });
  L.point('booth', -10.9, 1.6, -46.0, 0xffb878, 8, 3.4, { priority: 3, bounds: BB });
  // spine window: a warm point inside so the window reads from the dark spine
  L.point('booth', -15.4, 2.2, -46, 0xffb070, 9, 5, { priority: 3, bounds: BB });
  // the vents and pipe above the door; a calendar
  b.detail(() => {
    pipe(b, 'copper', [[-16.6, H - 0.25, -42.4], [-10.4, H - 0.25, -42.4]], 0.035, { every: 1.5 });
    b.box('plastic_white', -13.6, 1.75, -49.78, 0.32, 0.44, 0.005);
    b.box('painted_orange', -13.6, 1.93, -49.775, 0.32, 0.08, 0.005);
  });
  b.sign('라인 관제', 'stencil', -13.4, 2.5, -49.79, 1.8, 0.3, '+z');

  // ── a small face light at each spine-window mark (own group: booth_light_fail does not kill them). From the
  //    window head on the booth side, angled back onto a face 0.5 m inside the glass, seen from the spine ──
  BOOTH_MARKS.forEach(([, mz], i) => {
    const fl = L.spot('booth_marks', -16.86, 2.36, mz, -16.45, 1.55, mz, 0xffd6b0, 16, 2.4, 0.75, { priority: 4, penumbra: 0.8, bounds: BB });
    const gm = L.glow(fl, 'emissive_warm', 0.5);
    b.detail(() => { b.box('painted_dark', -16.86, 2.39, mz, 0.06, 0.05, 0.5); b.box(gm, -16.86, 2.362, mz, 0.04, 0.006, 0.44); });
    void i;
  });

  // booth_light_fail: the booth's lights drop to emergency red (a power event)
  L.vignette('booth_light_fail', () => {
    const lm2 = L.ctx.render.lights;
    lm2.setGroup('booth', { flicker: 'broken' });
    L.sfx('power_down', -13.5, 2.5, -46, 0.8);
    L.after(0.7, () => lm2.setGroup('booth', { color: 0xff2010, intensityScale: 0.45, flicker: 'pulse' }));
  });

  writing(L);
}

/**
 * booth_write_1, booth_write_2: marker text appearing on the booth side of the hall glass, readable from the
 * hall. booth_wipe (REVISION 5.1): Tomas wipes both away with his sleeve when the first talk starts — the
 * letters smear sideways and fade to a grey ghost. (Writing 3 is dropped.)
 */
function writing(L: LevelBuild) {
  const x = GLASS.x - 0.035;
  const items: [string, string, number, number, number, number, number][] = [
    // id, text, z centre, y centre, width, height, write seconds
    ['booth_write_1', "들리지 않습니다", -47.05, 1.95, 1.6, 0.5, 2.6],
    ['booth_write_2', '인터컴 →', -45.43, 1.55, 1.15, 0.34, 2.0], // north of the intercom mullion (-46.1): the arrow points at it
  ];
  const wipes: (() => void)[] = [];
  items.forEach(([id, text, z, y, w, h, dur], i) => {
    const mat = scrawlMaterial([text], { style: 'marker', aspect: w / h, seed: 41 + i * 7, color: '#101318', px: 1024 });
    mat.side = THREE.DoubleSide;
    const reveal = revealable(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.name = `booth:${id}`;
    m.position.set(x, y, z);
    m.rotation.set(0.0, PI / 2, i === 1 ? 0.04 : -0.03, 'YXZ');
    m.userData.rooms = ['line', 'booth'];
    m.visible = false;
    m.renderOrder = 2;
    L.root.add(m);
    let written = false;
    L.vignette(id, () => {
      m.visible = true;
      written = true;
      let t = 0;
      L.sim((dt) => {
        t += dt;
        reveal.value = Math.min(1.02, t / dur);
        if (Math.floor(t * 3.3) !== Math.floor((t - dt) * 3.3) && t < dur) L.sfx('marker_squeak', x, y, z, 0.55, 0.9 + (t % 0.3));
        return t < dur + 0.1;
      });
    });
    wipes.push(() => {
      if (!written || !m.visible) return;
      // the sleeve drags across: the text shears and stretches toward the wipe, fades to a smear
      const op0 = mat.opacity, x0 = m.scale.x;
      L.tween(i * 0.5, 1.1, (k) => {
        const e = k * k * (3 - 2 * k);
        m.scale.x = x0 * (1 + e * 0.35);
        m.position.z = z - e * 0.18 * (i ? -1 : 1);
        m.rotation.z = (i === 1 ? 0.04 : -0.03) + e * 0.05;
        mat.opacity = op0 * (1 - e * 0.86);
        if (k > 0.1 && Math.floor(k * 6) !== Math.floor((k - 0.05) * 6)) L.sfx('marker_squeak', x, y, z, 0.25, 0.5);
      }, () => { mat.opacity = op0 * 0.14; });
    });
  });
  L.vignette('booth_wipe', () => { for (const f of wipes) f(); });
}
