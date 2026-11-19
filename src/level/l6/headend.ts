/**
 * LEVEL 6 — dressing + lights of he6, the trunk head-end (stage 3d §2.6.6, §2.7, §4.5, §5.7 #3; task D2): a raised-floor
 * computer room under cold white light — the two OLT rack rows, the console with the outbound-queue monitor and three
 * desk screens, the mimic board's frame, the changeover switch's mat and conduit, the phone station's call lamp, the
 * vest locker, the west shelf, the first-aid box, the yellow fibre raceway from the trench up to the racks; the trench's
 * end T-c (lining, strips, the trunk), its exit ship stair and the dogged hatch lid. The vault and the rest of the
 * trench are `vault.ts` (its helpers are shared from there).
 *
 * Stand-ins: the shell's rack / console / locker / shelf stand-ins and the greybox stair are dropped; kit props (W8)
 * are drawn over the kept colliders with `collide: false`. The plates over T-c become raised-floor tiles; the pit rails
 * are repainted safety yellow. Set pieces (W7's `switch6`, `phone6`) are the shell's.
 *
 * Lights (§2.7.1, group `he6`): 2 points (all) + 1 (MEDIUM+), as the greybox rows; twenty LED bar fittings in four rows
 * carry the room's look, their lenses bound to the two all-quality points (so they never go dark on LOW).
 *
 * Vignettes (sounds here, once — D25; each has a silent `:snap`). The story speaks the lines (`l6_aas_*`, fx `phone`),
 * enables `he6_phone` and moves the handset; the level does the howler and the lamp:
 *  - `v6_handset` (toggle: once per ring) — the howler (`phone_howler`: one call = the three buzzes, 0–0.9 / 1.5–2.4 /
 *    3.0–3.9 s) and the station's amber call lamp flashing with them. The story lifts / holds / drops the handset
 *    (`phone6`) and plays `handset_drop`, `phone_dead_click`, `line_hiss`. Snap: howler silent, lamp off, the handset
 *    hanging free on its cord (phone6 has no on-hook pose: the empty hook is part of the scare).
 *  - `hatch6_he_open` — the underside dogs spin free (`hatch_unlatch`), the status lamp goes green, the lid swings up.
 */
import * as THREE from 'three';
import type { LightHandle } from '../../core/types';
import type { Builder, Mat } from '../builder';
import type { LevelBuild } from '../context';
import { isStandin, restyle } from '../l3/kit3';
import { mat4 } from '../l4/kit4';
import { LIGHTS6, STAIR6_HE, STOPPER_HE6, placeLights6, type RoomId6 } from './grey';
import type { RoomDress } from './index';
import {
  HATCH6_HE, consoleDesk, firstAidBox6, hatchLid6, mimicFrame, oltRack, stencil6, strip6, trunkRun, wallLocker, wallShelf6,
} from './kit6';
import { brackets, cues, dropLabel, dropNear, fixLid, hatchVignette, isGreyDark, isMat, shipStair, trenchLining } from './vault';

const PI = Math.PI;

/** Where the station's call lamp sits (beside W7's `phone6` box). */
const CALL_LAMP: [number, number, number] = [21.7, 1.7, -164.3];
/** The howler's three buzzes (s), as W2b's `phone_howler`. */
const BUZZ: [number, number][] = [[0.0, 0.9], [1.5, 2.4], [3.0, 3.9]];

// ───────────────────────────────────────────────────────────── materials

/** Raised-floor tiles (600 mm, anti-static grey, perforated airflow tiles in the rows in front of the racks). */
function raisedFloor(L: LevelBuild): THREE.MeshStandardMaterial {
  return mat4(L, 'd2_raised_floor', () => {
    const N = 512, T = N / 2;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d')!;
    let seed = 6601;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * T, y0 = ty * T, v = 192 + Math.floor(rnd() * 10);
      g.fillStyle = `rgb(${v},${v + 4},${v + 6})`;
      g.fillRect(x0, y0, T, T);
      for (let i = 0; i < 900; i++) { const k = 150 + rnd() * 70 | 0; g.fillStyle = `rgba(${k},${k + 3},${k + 5},0.35)`; g.fillRect(x0 + rnd() * T, y0 + rnd() * T, 2, 2); }
      if (tx === 1 && ty === 0) {
        // perforated airflow tile
        g.fillStyle = '#6d7377';
        for (let yy = 22; yy < T - 18; yy += 11) for (let xx = 22; xx < T - 18; xx += 11) { g.beginPath(); g.arc(x0 + xx, y0 + yy, 3.2, 0, PI * 2); g.fill(); }
      }
      // bevel + seam
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0 + 3, y0 + 3, T - 6, 2); g.fillRect(x0 + 3, y0 + 3, 2, T - 6);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0 + 3, y0 + T - 5, T - 6, 2); g.fillRect(x0 + T - 5, y0 + 3, 2, T - 6);
      g.fillStyle = '#3f4447'; g.fillRect(x0, y0, T, 3); g.fillRect(x0, y0, 3, T);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,40,40,${rnd() * 0.18})`; g.fillRect(rnd() * N, rnd() * N, 4 + rnd() * 30, 1 + rnd() * 2); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / 1.2, 1 / 1.2);
    tex.anisotropy = 8;
    const m = L.ctx.materials.clone('painted_white', { map: tex, color: 0xffffff, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: 0.58, metalness: 0.04 });
    m.name = 'd2_raised_floor';
    return m;
  });
}

// ───────────────────────────────────────────────────────────── the trench's end T-c (he6's floor at y −1.4)

function trenchHe(L: LevelBuild, b: Builder) {
  const C: Mat = 'floor_concrete', Y = -1.4, top = -0.05;
  trenchLining(b, C, '+y', Y, 1.8, 3.6, -179.4, -177.6);
  trenchLining(b, C, '+y', Y, 2.4, 3.6, -177.6, -177.15);
  trenchLining(b, C, '+z', -179.4, 1.8, 3.6, Y, top);
  trenchLining(b, C, '-x', 3.6, -179.4, -175.4, Y, 0);
  trenchLining(b, C, '-z', -178.2, 1.8, 2.2, Y, top);
  trenchLining(b, C, '+x', 2.2, -178.2, -177.6, Y, top);
  trenchLining(b, C, '-z', -177.6, 2.2, 2.4, Y, top);
  trenchLining(b, C, '+x', 2.4, -177.6, -175.4, Y, 0);
  trenchLining(b, C, '-z', -175.4, 2.4, 3.6, Y, 0);
  trenchLining(b, C, '-y', top, 1.8, 2.2, -179.4, -178.2);
  b.quad(L.puddleMat(), 2.8, Y + 0.012, -178.6, 1.3, 1.1, '+y', 0, 'box');
  const sy = Y + 0.011;
  strip6(b, L, 1.8, -179.3, 3.5, -179.3, { y: sy, ch: 'red' });
  strip6(b, L, 3.5, -179.2, 3.5, -177.25, { y: sy, ch: 'red' });
  strip6(b, L, 1.8, -178.3, 2.12, -178.3, { y: sy, ch: 'red' });
  brackets(b, 'x', 1.9, 3.4, -179.4, 1, [-1.05]);
  // the trunk arrives under the wall (vault.ts ends it at x 1.79) and rises into the floor gland under the raceway
  trunkRun(b, L, { pts: [[1.79, -0.67, -178.32], [2.25, -0.68, -178.45], [2.38, -0.75, -179.05], [2.36, -0.25, -179.3], [2.33, -0.06, -179.34]], r: 0.05, cleats: null });
}

// ───────────────────────────────────────────────────────────── he6

const he6: RoomDress = {
  look: { floor: 'floor_epoxy', wall: 'wall_clean', ceiling: 'ceiling_clean' },
  lights: [],
  build(L) {
    const ctx = L.ctx;
    const floor = raisedFloor(L);
    (he6.look as { floor: Mat }).floor = floor;
    // ── greybox visuals out (colliders stay) ──
    restyle(L, 'grey6:he6_cover', (m) => isStandin(m) || isGreyDark(m), null);
    restyle(L, 'he6_grey', isStandin, null);
    dropNear(L, 'he6_grey', [[9.0, 1.025, -179.15], [21.675, 0.875, -176.0]], 0.02);
    dropLabel(L, 'he6_grey', [2.2, 3.0, -163.0], [1, 0, 0]);
    restyle(L, 'he6_grey', isGreyDark, ctx.materials.get('painted_yellow'));
    restyle(L, 'he6_grey', isMat(L.doubleSided('floor_grate')), floor);
    const b = L.builder('he6_dress');

    // ── lights: the greybox rows; fittings bound to the two all-quality points ──
    const hs = placeLights6(L, LIGHTS6.he6.map((r) => ({ ...r, i: r.min ? 20 : 42, d: r.min ? 12 : 18 })));
    const allQ = hs.filter((h) => !h.desc.minQuality) as LightHandle[];
    const gW = L.glow(allQ[0], 'emissive_white', 0.85), gE = L.glow(allQ[1] ?? allQ[0], 'emissive_white', 0.85);
    for (const z of [-162.4, -166.8, -171.8, -176.6]) for (const x of [4.5, 8.0, 11.5, 15.0, 18.5]) {
      const lens = x < 12 ? gW : gE;
      for (const s of [-1, 1]) b.rod('steel_raw', x + s * 0.55, 4.5, z, x + s * 0.55, 4.36, z, 0.006, 4);
      b.bx('painted_white', x - 0.72, 4.3, z - 0.085, x + 0.72, 4.36, z + 0.085);
      b.bx(lens, x - 0.68, 4.288, z - 0.06, x + 0.68, 4.3, z + 0.06);
    }

    // ── OLT racks: R1 fronts the door (+z), R2 the console (−z) ──
    b.at(10.0, 0, -164.3, 0, () => oltRack(b, L, { len: 10, d: 0.6, h: 2.2, prefix: 'OLT 1-', seed: 41, collide: false }));
    b.at(10.0, 0, -169.3, PI, () => oltRack(b, L, { len: 10, d: 0.6, h: 2.2, prefix: 'OLT 2-', seed: 43, collide: false }));
    stencil6(b, '열 1 — 트렁크 1 라인 단자', 10.0, 2.62, -163.92, 1.8, 0.1, '+z', { style: 'stencil' });

    // ── the yellow fibre raceway: up from the trench gland in the SW corner, along the ceiling, down onto both racks ──
    {
      const Y: Mat = 'painted_yellow', y0 = 3.9, y1 = 4.0;
      b.bx('painted_dark', 2.25, 0, -179.75, 2.5, 0.03, -179.5); // floor gland plate
      b.bx(Y, 2.27, 0.03, -179.77, 2.43, y1, -179.61);
      // (the north run rides over the rack ends at x 5: the risers drop straight onto the racks' own raceways)
      b.bx(Y, 2.43, y0, -179.77, 5.18, y1, -179.61);
      b.bx(Y, 5.0, y0, -179.61, 5.18, y1, -164.2);
      for (const z of [-164.3, -169.3]) b.bx(Y, 5.02, 2.505, z - 0.075, 5.16, y0, z + 0.075);
      b.detail(() => {
        for (let z = -178.5; z < -164.5; z += 1.5) b.rod('steel_raw', 5.09, y1, z, 5.09, 4.5, z, 0.006, 4);
        for (let x = 3.0; x < 5.0; x += 1.5) b.rod('steel_raw', x, y1, -179.69, x, 4.5, -179.69, 0.006, 4);
      });
    }

    // ── the console, its screens, the queue monitor (note6_queue's screen stands on the desk) ──
    let deskScreens: THREE.Vector3[] = [];
    b.at(12.0, 0, -179.8, 0, () => { deskScreens = consoleDesk(b, L, { len: 8, d: 1.0, h: 1.0, bezels: [-1.4, 0.4, 2.2], collide: false }).screens; });
    const texts = ['OLT 1 — 32/32 PON 정상\n트렁크 1 RX −11.4 dBm\n보호: 가동', '헤드엔드 모드: 자동\n비치 조인트 2: 밀봉됨\n볼트 RH 24 %', '음향 부이: 대기\n핑 20 s — 11.5 kHz\n링크 마진 6 dB'];
    deskScreens.forEach((p, i) => { L.screen(`he6_desk_${i + 1}`, 'terminal_idle', 0.66, 0.31, p.x, p.y, p.z, '+z', { text: texts[i] }); });
    b.bx('painted_dark', 8.68, 1.03, -179.1, 9.32, 1.47, -179.012);
    b.bx('painted_dark', 8.97, 1.002, -179.16, 9.03, 1.03, -179.1);
    b.bx('painted_dark', 8.82, 1.002, -179.26, 9.18, 1.014, -179.04);
    stencil6(b, '발송 대기열', 9.0, 1.5, -179.011, 0.26, 0.035, '+z', { style: 'label' });
    // a chair pushed back from the desk, a mug, a clipboard
    b.detail(() => {
      b.cyl('painted_dark', 13.2, 0.25, -177.9, 0.03, 0.5, 'y', 8);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2; b.rod('painted_dark', 13.2, 0.06, -177.9, 13.2 + Math.cos(a) * 0.3, 0.04, -177.9 + Math.sin(a) * 0.3, 0.015, 4); }
      b.rbox('painted_dark', 13.2, 0.52, -177.9, 0.46, 0.08, 0.44, 0, 0.5, 0);
      b.rbox('painted_dark', 13.22, 0.85, -177.66, 0.44, 0.5, 0.07, -0.12, 0.5, 0);
      b.cyl('painted_white', 10.4, 1.05, -179.25, 0.04, 0.1, 'y', 10);
      b.rbox('painted_dark', 14.0, 1.006, -179.15, 0.23, 0.012, 0.31, 0, 0.2, 0);
    });

    // ── the mimic board's frame on the south wall (W5's `mimic6` screen inside it, moved 15 mm off the backing) ──
    b.at(12.0, 2.6, -179.8, 0, () => mimicFrame(b, L, { w: 10, h: 2, title: '헤드엔드 — 트렁크 1 — 미믹' }));
    const mim = L.root.children.find((o) => o.name === 'screen:mimic6');
    if (mim) mim.position.z = -179.765;

    // ── the changeover switch: insulating mat, conduit to the deckhead, the plate ──
    b.bx('painted_dark', 19.75, 0, -171.8, 20.95, 0.012, -170.2);
    b.cyl('steel_raw', 21.55, 3.25, -171.6, 0.04, 2.5, 'y', 10);
    b.cyl('steel_raw', 21.55, 3.25, -170.4, 0.03, 2.5, 'y', 10);
    stencil6(b, '헤드엔드 보호 — 절체 CS-1', 21.79, 2.45, -171.0, 1.4, 0.12, '-x', { style: 'stencil' });

    // ── the phone station's call lamp (flashes with the howler) and its plate ──
    const callLamp = mat4(L, 'd2_call_lamp', () => new THREE.MeshStandardMaterial({ name: 'd2_call_lamp', color: 0x3a2206, emissive: 0xffa020, emissiveIntensity: 0, roughness: 0.25 }));
    b.bx('navy_grey', CALL_LAMP[0] - 0.02, CALL_LAMP[1] - 0.05, CALL_LAMP[2] - 0.05, 21.79, CALL_LAMP[1] + 0.05, CALL_LAMP[2] + 0.05);
    b.cyl(callLamp, CALL_LAMP[0] - 0.045, CALL_LAMP[1], CALL_LAMP[2], 0.032, 0.05, 'x', 12);

    // ── the vest locker (NW), the west shelf, the first-aid box ──
    b.at(3.2, 0, -160.2, PI, () => wallLocker(b, L, { w: 1.6, d: 0.6, h: 2.0, collide: false }));
    b.at(2.2, 0, -172.0, PI / 2, () => wallShelf6(b, L, { w: 2.0, d: 0.4, collide: false, seed: 29 }));
    b.collide(2.2, 0, -173.0, 2.6, 0.97, -171.0, 'metal', true);
    b.at(21.8, 0, -176.0, -PI / 2, () => firstAidBox6(b, L, { collide: false }));

    // ── the trench's end, its exit stair and the dogged lid ──
    trenchHe(L, b);
    shipStair(b, L, STAIR6_HE);
    hatchLid6(L, b, HATCH6_HE);
    fixLid(L, 'hatch6_he', STOPPER_HE6);
    hatchVignette(L, 'hatch6_he', [3.0, -0.2, -176.5]);

    // ═══ the call (level side of v6_handset, §4.5): the howler and the call lamp, per ring. The story lifts / holds /
    //     drops the handset itself (`phone6`) and plays `handset_drop`, `phone_dead_click`, `line_hiss` ═══
    const hc = cues(L);
    const lamp = (k: number) => { callLamp.emissiveIntensity = 3.2 * k; };
    L.vignette('v6_handset', () => {
      const g = hc.start();
      L.sfx('phone_howler', 21.6, 1.82, -164.0, 1.0);
      for (const [a, z] of BUZZ) {
        hc.at(g, a, () => lamp(1));
        hc.at(g, z, () => lamp(0.12));
      }
      hc.at(g, 4.0, () => lamp(0));
    }, { toggle: true, snap: () => { hc.cancel(); lamp(0); (L.objects.get('phone6')?.userData as { drop?: () => void } | undefined)?.drop?.(); } });
  },
};

export const HEADEND_DRESS: Partial<Record<RoomId6, RoomDress>> = { he6 };
