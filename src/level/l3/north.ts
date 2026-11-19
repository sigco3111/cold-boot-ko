/**
 * THE QUIET SIDE — north half, Deck 2 (stage 3a §2.5, task P3a): the service lift, the pressure lock, the north gallery,
 * the habitat lobby and the facilities offices. Dressing only (rooms, doors, triggers, interactables and markers are the
 * greybox's; see grey.ts). Lift and lock stay clean white steel (the way in); from the gallery on everything is warm:
 * stone, carpet, oak, plaster, brass, plants.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { cagePanel } from '../kit';
import { crate } from '../props';
import { D2, LIGHTS3, placeLights, type LightRow, type RoomId3 } from './grey';
import type { RoomDress } from './index';
import {
  TINT, alongWall, armchair, artMat, bench3, canvasMat, ceilingGrid, coffeeTable, defineLeaves, desk3, deskPhone, doorCasing,
  downlight, fabric, fern, filingCabinet, floorLamp, fridge, glassFront, isStandin, keyboard, kitchenette, mug, noticeBoard,
  officeChair, paint, paper, papersFlat, pendant, photoFrame, pictureFrame, plantSmall, pottedPlant, radio, restyle, rug, shade,
  sideboard, sofa, tableLamp, totem, visitorChair, wainscot, wayfind, whiteboard,
} from './kit3';

const PI = Math.PI;
const Y = D2;
const isGlass = (L: LevelBuild) => (m: THREE.Material) => m === L.ctx.materials.get('glass');

/** Place a room's light rows and bind emissive fixtures to the first light of each listed group. */
function lights(L: LevelBuild, rows: LightRow[], bind: [number, THREE.MeshStandardMaterial][]) {
  const hs = placeLights(L, rows);
  for (const [i, m] of bind) hs[i].bindEmissive(m, m.emissiveIntensity);
  return hs;
}

// ───────────────────────────────────────────────────────────── service lift

const lift3: RoomDress = {
  label: false,
  look: { wall: 'trim_steel', floor: 'floor_rubber', ceiling: 'painted_white' },
  lights: [],
  build(L) {
    const b = L.builder('lift3_dress');
    const glow = shade(L, 'lift_panel', 2.0, 0xe4ecff);
    lights(L, LIGHTS3.lift3, [[0, glow]]);
    b.bx(glow, -1.0, Y + 2.975, 1.6, 1.0, Y + 2.995, 3.6);
    b.bx('chrome', -1.06, Y + 2.97, 1.54, 1.06, Y + 2.998, 1.6).bx('chrome', -1.06, Y + 2.97, 3.6, 1.06, Y + 2.998, 3.66);
    // handrails on three walls, kick plates
    for (const s of [-1, 1]) {
      b.rod('chrome', s * 1.74, Y + 0.95, 0.6, s * 1.74, Y + 0.95, 4.4, 0.022, 8);
      for (const z of [0.7, 4.3]) b.rod('chrome', s * 1.74, Y + 0.95, z, s * 1.8, Y + 0.95, z, 0.012, 6);
      b.bx('steel_raw', s > 0 ? 1.78 : -1.8, Y, 0.2, s > 0 ? 1.8 : -1.78, Y + 0.25, 4.8);
    }
    b.rod('chrome', -1.4, Y + 0.95, 4.74, 1.4, Y + 0.95, 4.74, 0.022, 8);
    b.bx('steel_raw', -1.8, Y, 4.78, 1.8, Y + 0.25, 4.8);
    // the lift panel's bezel
    b.bx('plastic_dark', 1.765, Y + 1.32, 1.1, 1.8, Y + 1.34, 1.7).bx('plastic_dark', 1.765, Y + 1.66, 1.1, 1.8, Y + 1.68, 1.7);
    b.bx('plastic_dark', 1.765, Y + 1.34, 1.1, 1.8, Y + 1.66, 1.13).bx('plastic_dark', 1.765, Y + 1.34, 1.67, 1.8, Y + 1.66, 1.7);
    wayfind(b, '서비스 리프트 — 하부층', 1.795, Y + 2.15, 3.4, 1.2, 0.3, '-x');
  },
};

// ───────────────────────────────────────────────────────────── pressure lock

const lock: RoomDress = {
  label: false,
  look: { wall: 'wall_medical', floor: 'floor_rubber', ceiling: 'painted_white' },
  lights: [],
  build(L) {
    const R = rng(3101);
    const b = L.builder('lock_dress');
    defineLeaves(L);
    const glow = shade(L, 'lock_strip', 2.4, 0xf0f4ff);
    lights(L, LIGHTS3.lock, [[0, glow]]);
    // the two greybox benches: a wooden one (the medkit lies on it) and a white steel one with a plant
    restyle(L, 'lock_grey', isStandin, null);
    b.at(-2.45, Y, -3.0, PI / 2, () => bench3(b, 2.4, 'painted_white', 'wood_veneer', false));
    b.at(2.45, Y, -3.0, -PI / 2, () => bench3(b, 2.4, 'painted_white', 'painted_white', false));
    pottedPlant(b, 2.45, Y + 0.45, -1.95, 'fern', 0.6, R, 'plastic_white', false);
    // ceiling: two light strips, vents
    for (const x of [-1.2, 1.2]) { b.bx(glow, x - 0.08, Y + 3.38, -6.4, x + 0.08, Y + 3.396, -0.6); b.bx('chrome', x - 0.11, Y + 3.37, -6.43, x + 0.11, Y + 3.398, -6.4).bx('chrome', x - 0.11, Y + 3.37, -0.6, x + 0.11, Y + 3.398, -0.57); }
    for (const z of [-5.6, -1.4]) { b.bx('chrome', -0.4, Y + 3.385, z - 0.2, 0.4, Y + 3.399, z + 0.2); b.detail(() => { for (let i = 0; i < 7; i++) b.bx('painted_dark', -0.35, Y + 3.383, z - 0.17 + i * 0.055, 0.35, Y + 3.386, z - 0.15 + i * 0.055); }); }
    // floor drain, handrails along both side walls
    b.detail(() => { b.cyl('chrome', 0, Y + 0.004, -3.5, 0.2, 0.008, 'y', 18); b.cyl('painted_dark', 0, Y + 0.0085, -3.5, 0.16, 0.002, 'y', 18); });
    for (const s of [-1, 1]) {
      b.rod('chrome', s * 2.72, Y + 1.0, -6.3, s * 2.72, Y + 1.0, -4.5, 0.022, 8);
      for (const z of [-6.2, -4.6]) b.rod('chrome', s * 2.72, Y + 1.0, z, s * 2.8, Y + 1.0, z, 0.012, 6);
    }
    // the pressure panel's bezel, a gauge, the equalisation notice
    const px = 2.3, pz = -6.8;
    b.bx('plastic_dark', px - 0.29, Y + 1.36, pz, px + 0.29, Y + 1.39, pz + 0.035).bx('plastic_dark', px - 0.29, Y + 1.71, pz, px + 0.29, Y + 1.74, pz + 0.035);
    b.bx('plastic_dark', px - 0.29, Y + 1.39, pz, px - 0.26, Y + 1.71, pz + 0.035).bx('plastic_dark', px + 0.26, Y + 1.39, pz, px + 0.29, Y + 1.71, pz + 0.035);
    b.cyl('chrome', -2.3, Y + 1.6, -6.78, 0.14, 0.04, 'z', 20);
    b.cyl('plastic_white', -2.3, Y + 1.6, -6.755, 0.12, 0.004, 'z', 20);
    b.detail(() => b.rbox('painted_dark', -2.3, Y + 1.6 + 0.04, -6.75, 0.008, 0.09, 0.004, 0, 0, 0.7));
    wayfind(b, '주거 링\n등압이 끝날 때까지 기다려 주세요', -2.795, Y + 2.25, -3.4, 1.9, 0.5, '+x');
    wayfind(b, '압력 록', 2.795, Y + 2.25, -3.4, 1.2, 0.3, '-x');
  },
};

// ───────────────────────────────────────────────────────────── north gallery

const gallery_n: RoomDress = {
  label: false,
  look: { floor: 'stone_pale', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    const R = rng(3201);
    const b = L.builder('gallery_dress');
    defineLeaves(L);
    restyle(L, 'gallery_n_grey', isGlass(L), glassFront(L));
    const cove = shade(L, 'gallery_cove', 2.0, 0xffcf96);
    const down = shade(L, 'gallery_down', 1.5, 0xffe0b8);
    const hs = lights(L, LIGHTS3.gallery_n, [[0, cove]]);
    hs[1].bindEmissive(down, down.emissiveIntensity);
    const H = Y + 3.2;
    // timber batten ceiling (z −11.7 … −7.3), a warm cove along the north wall, downlights between battens
    b.detail(() => { for (let z = -11.65; z <= -7.5; z += 0.22) b.bx('wood_veneer', -11.8, H - 0.07, z - 0.03, 11.8, H - 0.005, z + 0.03); });
    for (let x = -10.5; x <= 10.5; x += 3) downlight(b, down, x, H - 0.07, -9.0 - (Math.round(x) % 2 ? 0.11 : 0), 0.06);
    b.bx(cove, -11.8, H - 0.36, -7.21, 11.8, H - 0.33, -7.19 - 0.01);
    b.bx('wood_dark', -11.8, H - 0.42, -7.36, 11.8, H - 0.3, -7.3);
    // carpet runner, a stone kerb along the glass
    b.detail(() => {
      b.bx(fabric(L, TINT.charcoal), -11.2, Y, -10.3, 8.8, Y + 0.008, -8.7);
      b.bx('carpet', -11.05, Y + 0.008, -10.15, 8.65, Y + 0.012, -8.85);
    });
    b.bx('stone_pale', -11.8, Y, -11.98, 6, Y + 0.06, -11.74);
    // mullions every 2 m with brass caps (both faces of the glass), a brass rail on brackets
    for (let x = -10; x <= 4; x += 2) {
      b.bx('painted_dark', x - 0.035, Y + 0.06, -11.975, x + 0.035, H, -11.9);
      b.bx('brass', x - 0.02, Y + 0.06, -11.9, x + 0.02, H, -11.89);
      b.bx('painted_dark', x - 0.035, Y, -12.1, x + 0.035, H, -12.025);
      b.rod('brass', x, Y + 1.0, -11.9, x, Y + 1.0, -11.8, 0.012, 6);
    }
    b.rod('brass', -11.75, Y + 1.0, -11.79, 5.95, Y + 1.0, -11.79, 0.022, 8);
    // benches facing the glass (back to the corridor)
    for (const x of [-8.0, -3.0, 2.6]) b.at(x, Y, -11.0, PI, () => bench3(b, 1.8, 'wood_dark', 'wood_veneer', true, true));
    // six fern planters along the north wall
    for (const x of [-10.4, -7.4, -4.4, 4.4, 7.4, 10.4]) {
      b.bx('wood_dark', x - 0.5, Y, -7.88, x + 0.5, Y + 0.55, -7.42);
      b.bx('soil', x - 0.46, Y + 0.55, -7.84, x + 0.46, Y + 0.565, -7.46);
      b.collide(x - 0.5, Y, -7.88, x + 0.5, Y + 0.55, -7.42, 'concrete', true);
      for (const dx of [-0.28, 0.02, 0.3]) fern(b, x + dx, Y + 0.55, -7.65 + R.range(-0.05, 0.05), R.range(0.55, 0.8), R, 9);
    }
    // pictures over the planters: the habitat's history (prints), and the sea at the east end
    alongWall(b, '-z', -7.2, Y, () => {
      for (const [x, k] of [[7.4, 1], [4.4, 2], [-4.4, 3], [-7.4, 4]] as const) pictureFrame(b, artMat(L, 'abstract', k), -x, 1.75, 0.8, 0.6, 'wood_dark');
    });
    alongWall(b, '-x', 11.8, Y, () => pictureFrame(b, artMat(L, 'seabed', 2), -9.5, 1.6, 1.6, 1.1, 'wood_dark'));
    // placard on the solid section (x 6 … 9.2) beside the shutter, the totem by the shutter
    b.bx('brass', 6.85, Y + 1.38, -11.8, 8.35, Y + 1.82, -11.788);
    b.sign('주거 아트리움 — 2031년 개장', 'wayfinding', 7.6, Y + 1.6, -11.788, 1.4, 0.36, '+z');
    totem(b, 8.0, Y, -10.95, -PI / 2, '정원 아트리움\n생물 시스템\n→', '주거 로비\n접수\n↑', 0.55, 0.9);
    nightSign(L, Y);
    wayfind(b, '주거 로비 ←', -9.5, Y + 2.35, -7.205, 1.3, 0.3, '-z');
    // the lobby's glass door: wood casing on the gallery side
    doorCasing(b, L, { x: -12, y: Y, z: -9.5, wall: 'x', front: '주거 로비', sides: [1] });
    pottedPlant(b, -11.3, Y, -7.75, 'palm', 0.9, R, 'stone_pale');
    pottedPlant(b, 11.25, Y, -7.75, 'fig', 1.0, R, paint(L, 0xb85c3c, 0.6));
  },
};

// ───────────────────────────────────────────────────────────── habitat lobby

const lobby: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    const R = rng(3401);
    const b = L.builder('lobby_dress');
    defineLeaves(L);
    const pend = shade(L, 'lobby_pendant', 1.8, 0xffcf96);
    const desk = shade(L, 'lobby_desklamp', 1.6, 0xffcf96);
    const rows: LightRow[] = [
      { group: 'lobby', type: 'point', p: [-16, Y + 3.0, -8.8], color: 0xffd9b0, i: 12, d: 10, prio: 0.5 },
      { group: 'lobby', type: 'spot', p: [-14.8, Y + 1.5, -11.85], t: [-16.0, Y + 1.05, -12.0], color: 0xffd9b0, i: 6, d: 4, angle: 1.0, min: 'medium', prio: 0.5 },
      { group: 'lobby_emerg', type: 'point', p: [-16, Y + 3.2, -9], color: 0xc8e0ff, i: 4, d: 10, off: true },
      // I1: a downlight over the staff door, aimed through it: C1's key on Halvorsen's face in the doorway (he stands
      // backlit by the open plan otherwise; the player's torch is off during the scenes)
      { group: 'lobby', type: 'spot', p: [-18.7, Y + 3.5, -9.0], t: [-21.0, Y + 1.55, -9.0], color: 0xffd9b0, i: 7, d: 6, angle: 0.55, prio: 0.5 },
    ];
    lights(L, rows, [[0, pend], [1, desk]]);
    const H = Y + 3.6;
    // walls: oak wainscot (gaps at the two doors), a cornice
    alongWall(b, '-x', -12.2, Y, () => wainscot(b, -13.8, -4.2, 1.05, [[-10.75, -8.25]]));
    alongWall(b, '+x', -19.8, Y, () => wainscot(b, 4.2, 13.8, 1.05, [[7.85, 10.15]]));
    alongWall(b, '-z', -4.2, Y, () => wainscot(b, 12.2, 19.8, 1.05));
    alongWall(b, '+z', -13.8, Y, () => wainscot(b, -19.8, -12.2, 1.05));
    b.bx('wood_dark', -19.8, H - 0.12, -13.8, -19.76, H - 0.02, -4.2).bx('wood_dark', -12.24, H - 0.12, -13.8, -12.2, H - 0.02, -4.2);
    b.bx('wood_dark', -19.76, H - 0.12, -4.24, -12.24, H - 0.02, -4.2).bx('wood_dark', -19.76, H - 0.12, -13.8, -12.24, H - 0.02, -13.76);
    // ceiling: a coffer of three drum pendants over the middle, downlights at the edges
    b.bx('plaster_warm', -18.3, H - 0.1, -11.2, -13.7, H - 0.02, -6.8);
    for (const z of [-10.4, -8.8, -7.2]) pendant(b, L, pend, -16.0, H - 0.1, z, 0.75, 0.32, TINT.cream);
    for (const [x, z] of [[-19.0, -5.0], [-18.7, -9.0], [-19.0, -13.0], [-13.0, -13.0], [-13.0, -5.0]] as const) downlight(b, pend, x, H, z, 0.06);
    // doors: casings on the lobby side
    doorCasing(b, L, { x: -12, y: Y, z: -9.5, wall: 'x', back: '북쪽 갤러리', sides: [-1] });
    doorCasing(b, L, { x: -20, y: Y, z: -9, wall: 'x', front: 'Facilities — Staff', sides: [1] });

    // reception desk (front faces north, visitors' ledge 1.05, staff work surface 0.75 behind)
    const dx0 = -17.6, dx1 = -14.3;
    b.bx('wood_veneer', dx0, Y, -11.76, dx1, Y + 1.0, -11.66);
    b.detail(() => { for (let x = dx0 + 0.06; x < dx1 - 0.02; x += 0.12) b.bx('wood_dark', x - 0.02, Y + 0.12, -11.66, x + 0.02, Y + 0.96, -11.645); });
    b.bx('painted_dark', dx0 + 0.04, Y, -11.7, dx1 - 0.04, Y + 0.1, -11.62);
    b.bx('stone_pale', dx0 - 0.03, Y + 1.0, -12.02, dx1 + 0.03, Y + 1.05, -11.6);
    b.bx('wood_veneer', dx0, Y + 0.71, -12.45, dx1, Y + 0.75, -11.76);
    for (const x of [dx0, dx1 - 0.04]) b.bx('wood_veneer', x, Y, -12.45, x + 0.04, Y + 0.71, -11.76);
    b.collide(dx0, Y, -12.45, dx1, Y + 1.05, -11.6, 'concrete', true);
    const top = Y + 1.05;
    b.detail(() => {
      // the visitors' book (note3_guestbook), a bell, a lamp, a pot of pens; behind: monitor, phone, papers
      b.at(-16.0, top, -11.84, 0.1, () => {
        b.bx(fabric(L, 0x5a2a2a), -0.22, 0, -0.16, 0.22, 0.012, 0.16);
        b.rbox(paper(L, 0xf3ecdc), -0.105, 0.016, 0, 0.2, 0.008, 0.29, 0, 0, 0.04);
        b.rbox(paper(L, 0xf3ecdc), 0.105, 0.016, 0, 0.2, 0.008, 0.29, 0, 0, -0.04);
        b.rod('plastic_dark', 0.05, 0.022, -0.05, 0.15, 0.022, 0.06, 0.004, 4);
      });
      b.cyl('brass', -16.55, top + 0.012, -11.8, 0.045, 0.024, 'y', 12); b.sphere('brass', -16.55, top + 0.04, -11.8, 0.035, 10, 0.7);
      b.at(-14.75, top, -11.82, 0, () => tableLamp(b, L, desk, 0.8));
      b.at(-15.6, Y + 0.75, -12.25, PI, () => mug(b, L, 2));
      b.at(-16.0, Y + 0.75, -12.15, PI, () => b.at(0, 0, 0, 0, () => { b.bx('plastic_dark', -0.27, 0.12, -0.03, 0.27, 0.48, 0.0); b.bx('plastic_dark', -0.02, 0, -0.08, 0.02, 0.13, -0.02); b.bx('plastic_dark', -0.1, 0, -0.12, 0.1, 0.012, 0.0); }));
      b.at(-16.95, Y + 0.75, -12.2, -0.3, () => deskPhone(b, L)); // (I1: faces the staff side, south)
      b.at(-14.9, Y + 0.75, -12.2, 0, () => papersFlat(b, L, 4, 0.1, R));
    });
    b.at(-16.0, Y, -13.1, 0, () => officeChair(b, L, TINT.slate));
    b.at(-15.3, Y, -13.45, 0, () => filingCabinet(b, 2, 'wood_veneer'));
    wayfind(b, '접수', -15.95, Y + 2.35, -13.795, 1.1, 0.3, '+z');
    // the notice board (note3_board) and a framed residents' map
    alongWall(b, '+z', -13.8, Y, () => { noticeBoard(b, L, -18.0, 1.55, 1.2, 0.9, R, 8); pictureFrame(b, artMat(L, 'map', 5), -13.3, 1.65, 0.8, 0.6); });

    // north wall: the status screen in a wood frame, the CHOIR plaque, the status kiosk (term3_lobby)
    b.bx('wood_dark', -18.27, Y + 1.36, -4.24, -16.53, Y + 1.4, -4.2).bx('wood_dark', -18.27, Y + 2.3, -4.24, -16.53, Y + 2.34, -4.2);
    b.bx('wood_dark', -18.27, Y + 1.4, -4.24, -18.23, Y + 2.3, -4.2).bx('wood_dark', -16.57, Y + 1.4, -4.24, -16.53, Y + 2.3, -4.2);
    b.bx('brass', -19.74, Y + 1.5, -4.212, -18.4, Y + 1.86, -4.2);
    b.sign('CHOIR가 6시간마다 보고합니다.\n문의: CHOIR에게 말씀하세요.', 'label', -19.07, Y + 1.68, -4.213, 1.26, 0.3, '-z');
    b.at(-14.6, Y, -4.5, PI, () => {
      b.bx('wood_dark', -0.3, 0, -0.2, 0.3, 0.06, 0.22);
      b.bx('wood_veneer', -0.22, 0.06, -0.12, 0.22, 0.95, 0.16);
      b.rbox('plastic_dark', 0, 1.05, 0.06, 0.48, 0.36, 0.06, -0.55, 0, 0);
      b.collide(-0.3, 0, -0.2, 0.3, 1.2, 0.3, 'concrete', true);
    });
    L.screen('lobby_kiosk', 'terminal_idle', 0.4, 0.28, -14.6, Y + 1.06, -4.6, '-z', { text: '제작 하부층 — 현황', tilt: -0.55 });

    // seating: sofa under the status screen, two armchairs, a coffee table on a rug; a sofa by the east wall
    b.at(-17.3, Y, -4.67, PI, () => sofa(b, L, 2.0, TINT.rust));
    for (const x of [-18.35, -16.25]) b.at(x, Y, -7.0, 0.12 * (x < -17 ? 1 : -1), () => armchair(b, L, TINT.mustard));
    b.at(-17.3, Y, -5.95, 0, () => { coffeeTable(b, 1.1, 0.55, 'wood_dark'); });
    b.detail(() => {
      b.at(-17.55, Y + 0.42, -5.95, 0.3, () => { b.bx(paper(L, 0xe6d6b8), -0.12, 0, -0.16, 0.12, 0.012, 0.16); b.bx(paper(L, 0xc9d8e2), -0.1, 0.012, -0.14, 0.14, 0.02, 0.14); });
      b.at(-17.0, Y + 0.42, -5.9, 0, () => plantSmall(b, R));
    });
    b.at(-17.3, Y, -5.8, 0, () => rug(b, L, 3.4, 2.7, TINT.cream, TINT.rust));
    b.at(-19.35, Y, -4.65, 0, () => floorLamp(b, L, pend));
    b.at(-12.67, Y, -6.6, -PI / 2, () => sofa(b, L, 2.0, TINT.sage));
    b.at(-12.62, Y, -5.1, 0, () => { coffeeTable(b, 0.5, 0.5, 'wood_dark', 0.55); });
    b.detail(() => b.at(-12.62, Y + 0.55, -5.1, 0, () => tableLamp(b, L, pend, 0.85)));
    // plants
    pottedPlant(b, -19.25, Y, -13.25, 'fig', 1.3, R, paint(L, 0xb85c3c, 0.6));
    pottedPlant(b, -12.8, Y, -13.25, 'palm', 1.1, R, 'stone_pale');
    pottedPlant(b, -19.3, Y, -11.4, 'snake', 0.9, R, 'plastic_white');
    pottedPlant(b, -13.3, Y, -4.75, 'fig', 0.9, R, 'stone_pale');
    alongWall(b, '-x', -12.2, Y, () => pictureFrame(b, artMat(L, 'fjord', 3), -12.3, 1.75, 1.1, 0.8));
    alongWall(b, '+x', -19.8, Y, () => { pictureFrame(b, artMat(L, 'photo', 4), 5.4, 1.7, 0.5, 0.38); pictureFrame(b, artMat(L, 'photo', 5), 6.1, 1.85, 0.42, 0.3); });
  },
};

// ───────────────────────────────────────────────────────────── facilities offices

const admin: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L) {
    const R = rng(3501);
    const b = L.builder('admin_dress');
    defineLeaves(L);
    restyle(L, 'admin_grey', isGlass(L), glassFront(L));
    const panel = shade(L, 'admin_panel', 1.6, 0xfff0d8);
    const lamp = shade(L, 'admin_lamp', 1.5, 0xffcf96);
    const hs = lights(L, LIGHTS3.admin, [[0, panel]]);
    hs[1].bindEmissive(lamp, lamp.emissiveIntensity);
    const H = Y + 3.2;
    // ceiling: acoustic grid with light panels
    const panels: [number, number][] = [];
    for (const x of [-31.6, -27.4, -23.2]) for (const z of [-4.6, -8.2, -11.8, -15.4, -18.4]) panels.push([x, z]);
    ceilingGrid(b, L, -33.8, -20.2, -19.8, -2.2, H, panels.map(([x, z]) => [x - 0.62, x + 0.62, z - 0.32, z + 0.32]));
    for (const [x, z] of panels) { b.bx('chrome', x - 0.62, H - 0.035, z - 0.32, x + 0.62, H - 0.004, z + 0.32); b.bx(panel, x - 0.58, H - 0.039, z - 0.28, x + 0.58, H - 0.035, z + 0.28); }
    // walls: skirting / dado (low) round the room, gaps at doors
    alongWall(b, '+x', -33.8, Y, () => wainscot(b, 2.2, 19.8, 0.9));
    alongWall(b, '-z', -2.2, Y, () => wainscot(b, 20.2, 33.8, 0.9, [[26.0, 32.0]]));
    alongWall(b, '-x', -20.2, Y, () => wainscot(b, -19.8, -2.2, 0.9, [[-19.35, -17.65], [-10.15, -7.85], [-16.9, -13.3]]));
    alongWall(b, '+z', -19.8, Y, () => wainscot(b, -33.8, -20.2, 0.9, [[-31.15, -28.85]]));
    // door casings on the admin side
    doorCasing(b, L, { x: -20, y: Y, z: -9, wall: 'x', back: '주거 로비', sides: [-1] });
    doorCasing(b, L, { x: -30, y: Y, z: -20, wall: 'z', front: 'P. Halvorsen — Facilities', sides: [1] });
    doorCasing(b, L, { x: -20, y: Y, z: -18.5, wall: 'x', back: 'West Stair — Canteen', sides: [-1] });

    // eight desks along the west wall under the wall screens (admin_screen_1..8), dividers between them
    const people = [TINT.slate, TINT.rust, TINT.sage, TINT.charcoal, TINT.mustard, TINT.slate, TINT.plum, TINT.sage];
    for (let i = 0; i < 8; i++) {
      const z = -4 - 2 * i;
      b.at(-33.42, Y, z, PI / 2, () => desk3(b, 1.5, 0.75, 0.74, 'wood_veneer', 'painted_white', i % 2 ? 'l' : 'r'));
      b.at(-32.55 + R.range(-0.1, 0.15), Y, z + R.range(-0.3, 0.3), -PI / 2 + R.range(-0.5, 0.5), () => officeChair(b, L, people[i]));
      // screen bezel round the wall terminal
      b.bx('plastic_dark', -33.8, Y + 1.22, z - 0.28, -33.775, Y + 1.25, z + 0.28).bx('plastic_dark', -33.8, Y + 1.55, z - 0.28, -33.775, Y + 1.58, z + 0.28);
      b.bx('plastic_dark', -33.8, Y + 1.25, z - 0.28, -33.775, Y + 1.55, z - 0.25).bx('plastic_dark', -33.8, Y + 1.25, z + 0.25, -33.775, Y + 1.55, z + 0.28);
      const t = Y + 0.74;
      b.detail(() => {
        b.at(-33.3, t, z, PI / 2, () => keyboard(b));
        if (R.chance(0.7)) b.at(-33.15, t, z + 0.55, R.range(0, 6), () => mug(b, L, i));
        if (R.chance(0.6)) b.at(-33.45, t, z - 0.5, 0, () => papersFlat(b, L, R.int(2, 5), 0.1, R));
        if (i % 3 === 0) b.at(-33.6, t, z - 0.58, PI / 2, () => tableLamp(b, L, lamp, 0.7));
        if (i % 3 === 1) b.at(-33.6, t, z + 0.6, PI / 2 + 0.4, () => photoFrame(b, L, 10 + i));
        if (i % 3 === 2) b.at(-33.6, t, z - 0.55, 0, () => plantSmall(b, R, paint(L, 0xb85c3c, 0.6)));
        if (i === 5) b.at(-33.3, t, z - 0.3, -PI / 2, () => deskPhone(b, L)); // (I1: faces the user, east)
      });
      if (i < 7 && i !== 3) {
        const zd = z - 1.0;
        b.bx(fabric(L, TINT.oat), -33.8, Y + 0.0, zd - 0.025, -32.9, Y + 1.25, zd + 0.025);
        b.bx('chrome', -32.92, Y, zd - 0.03, -32.88, Y + 1.27, zd + 0.03);
        b.collide(-33.8, Y, zd - 0.03, -32.88, Y + 1.25, zd + 0.03, 'rubber', true);
      }
    }
    // the glass partitions get a wood base and a brass cap
    b.bx('wood_dark', -28.05, Y, -14.0, -27.95, Y + 0.1, -8.0).bx('brass', -28.025, Y + 1.8, -14.0, -27.975, Y + 1.83, -8.0);
    b.bx('wood_dark', -33.8, Y, -11.05, -30.0, Y + 0.1, -10.95).bx('brass', -33.8, Y + 1.8, -11.025, -30.0, Y + 1.83, -10.975);

    // north wall: kitchenette + fridge, the shift whiteboard over the meeting table
    b.at(-30.4, Y, -2.5, PI, () => kitchenette(b, L, 2.4, R));
    b.at(-28.75, Y, -2.55, PI, () => fridge(b));
    const ink = canvasMat(L, 'admin_shift', 512, 256, (g, W, H2) => {
      g.clearRect(0, 0, W, H2);
      g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, W, H2);
      g.fillStyle = '#1d3f73'; g.font = '700 38px "Marker Felt", "Comic Sans MS", sans-serif';
      g.fillText('근무자:', 24, 60);
      g.fillStyle = '#a12a2a'; g.fillText('할보센 (야간)', 24, 112);
      g.fillStyle = '#2a2a2a'; g.font = '500 24px "Marker Felt", "Comic Sans MS", sans-serif';
      g.fillText('주간: 모엔 / 비크', 24, 166); g.fillText('금요일 냉장고 청소!!', 24, 206);
    });
    ink.transparent = true; ink.color.set(0xffffff);
    alongWall(b, '-z', -2.2, Y, () => whiteboard(b, L, 24.6, 1.6, 1.8, 0.9, ink));
    // meeting table with six chairs
    b.at(-24.6, Y, -5.0, 0, () => desk3(b, 2.2, 1.0, 0.74, 'wood_veneer', 'wood_veneer', null));
    for (const x of [-25.3, -24.6, -23.9]) { b.at(x, Y, -4.2, PI, () => visitorChair(b, L, TINT.sage)); b.at(x + R.range(-0.1, 0.1), Y, -5.85, R.range(-0.2, 0.2), () => visitorChair(b, L, TINT.sage)); }
    b.detail(() => { b.at(-24.9, Y + 0.74, -5.0, 0.3, () => papersFlat(b, L, 3, 0.15, R)); b.at(-24.1, Y + 0.74, -4.9, 0, () => mug(b, L, 3)); });
    // the layout table in the middle of the room: drawings of the ring, rolled plans, a lamp
    b.at(-24.6, Y, -11.8, 0, () => desk3(b, 2.0, 1.1, 0.9, 'wood_veneer', 'wood_dark', 'both'));
    b.detail(() => {
      b.at(-24.6, Y + 0.9, -11.8, 0.04, () => { b.bx(paper(L, 0xe9e4d6), -0.6, 0.002, -0.42, 0.6, 0.005, 0.42); });
      b.quad(artMat(L, 'map', 9), -24.6, Y + 0.906, -11.8, 1.0, 0.75, '+y', 0.04, 'unit', 0.002);
      for (let i = 0; i < 4; i++) b.cyl(paper(L, 0xdcd6c4), -23.8 + i * 0.07, Y + 0.94, -12.15, 0.035, 0.7, 'x', 8);
      b.at(-25.45, Y + 0.9, -12.2, 0.4, () => mug(b, L, 1));
    });
    pottedPlant(b, -26.1, Y, -13.7, 'fig', 1.1, R, paint(L, 0xb85c3c, 0.6));
    // the printer (note3_desk) on a low cabinet
    b.at(-27.4, Y, -5.35, 0, () => sideboard(b, 1.0, 0.72, 'painted_white'));
    b.at(-27.4, Y + 0.72, -5.4, 0, () => {
      b.bx('plastic_white', -0.26, 0, -0.2, 0.26, 0.24, 0.18);
      b.bx('plastic_dark', -0.24, 0.24, -0.18, 0.24, 0.26, 0.1);
      b.bx('plastic_dark', -0.18, 0.1, 0.18, 0.18, 0.11, 0.3);
      b.rbox(paper(L), 0, 0.118, 0.24, 0.21, 0.003, 0.25, 0.05, 0, 0);
    });
    // filing cabinets along the south wall, plants, a water cooler
    for (let i = 0; i < 5; i++) b.at(-28.0 + i * 0.5, Y, -19.45, 0, () => filingCabinet(b, i === 2 ? 3 : 4, paint(L, 0x8a8f86, 0.5)));
    b.detail(() => b.at(-26.5, Y + 1.37, -19.5, 0.2, () => plantSmall(b, R)));
    pottedPlant(b, -33.25, Y, -19.25, 'fig', 1.1, R, paint(L, 0xb85c3c, 0.6));
    pottedPlant(b, -20.75, Y, -2.75, 'palm', 1.0, R, 'stone_pale');
    pottedPlant(b, -27.6, Y, -14.6, 'snake', 0.9, R, 'plastic_white');
    b.at(-20.6, Y, -11.2, -PI / 2, () => {
      b.bx('plastic_white', -0.17, 0, -0.17, 0.17, 1.0, 0.17);
      b.cyl(glassFront(L), 0, 1.22, 0, 0.14, 0.44, 'y', 14);
      b.collide(-0.17, 0, -0.17, 0.17, 1.44, 0.17, 'concrete', true);
    });

    // the radio (radio_admin) on a low cabinet by the inner door
    b.at(-22.0, Y, -7.0, PI, () => sideboard(b, 1.2, 0.9, 'wood_veneer'));
    b.detail(() => b.at(-22.0, Y + 0.9, -7.05, PI + 0.15, () => radio(b, L)));
    wayfind(b, '시설팀 사무실', -20.205, Y + 2.3, -11.8, 1.4, 0.3, '-x');

    // stores cage (NAVAL DETACHMENT — RETURNED STORES), door open; the pickups sit on its rack
    const mesh = L.ctx.materials.get('floor_grate');
    const cy = Y, ch = 2.2;
    b.push(0, cy, 0, 0);
    // north side (z −13.4), south side (z −16.8): panels along x
    for (const z of [-13.4, -16.8]) b.at(-22.1, 0, z, 0, () => cagePanel(b, mesh, -1.9, 0, 1.9, ch, 0, 0.04, 'painted_dark'));
    // west side (x −24) with the open door gap z −15.7 … −14.5
    b.at(-24, 0, -16.25, PI / 2, () => cagePanel(b, mesh, -0.55, 0, 0.55, ch, 0, 0.04, 'painted_dark'));
    b.at(-24, 0, -13.95, PI / 2, () => cagePanel(b, mesh, -0.55, 0, 0.55, ch, 0, 0.04, 'painted_dark'));
    b.at(-24.55, 0, -15.1, PI / 2 + 1.1, () => cagePanel(b, mesh, -0.6, 0.02, 0.6, ch - 0.05, 0, 0.04, 'painted_dark'));
    b.pop();
    b.collide(-24.0, cy, -13.42, -20.2, cy + ch, -13.38, 'metal', true);
    b.collide(-24.0, cy, -16.82, -20.2, cy + ch, -16.78, 'metal', true);
    b.collide(-24.02, cy, -16.8, -23.98, cy + ch, -15.7, 'metal', true);
    b.collide(-24.02, cy, -14.5, -23.98, cy + ch, -13.4, 'metal', true);
    b.sign('해군 파견대 — 반납 물자', 'label', -22.1, cy + 2.0, -13.37, 2.2, 0.2, '+z', 0, true);
    // the rack (shelf tops 0.53 / 0.93 / 1.33)
    b.at(-22.6, cy, -15.0, PI / 2, () => {
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.24, 0.24]) b.box('painted_dark', sx, 0.85, sz, 0.04, 1.7, 0.04);
      for (const y of [0.1, 0.53, 0.93, 1.33]) b.bx('steel_raw', -0.72, y - 0.025, -0.26, 0.72, y, 0.26);
      b.collide(-0.72, 0, -0.26, 0.72, 0.53, 0.26, 'metal', true);
    });
    b.detail(() => {
      b.at(-22.6, cy + 0.1, -15.45, 0.1, () => crate(b, 0.4, 0.3, 0.35, 'painted_dark', 'RN', false));
      b.at(-22.6, cy + 1.33, -14.8, -0.1, () => crate(b, 0.45, 0.32, 0.4, paint(L, 0x4a5a3a, 0.7), 'RETURN', false));
      b.at(-21.0, cy, -16.2, 0.2, () => crate(b, 0.6, 0.45, 0.5, paint(L, 0x4a5a3a, 0.7), 'BIO-SYS', false));
    });
    b.at(-21.0, cy, -16.2, 0.2, () => b.collide(-0.3, 0, -0.25, 0.3, 0.45, 0.25, 'metal', true));
  },
};

/**
 * I1: the shutter at the gallery's east end is down until the breach (night setting) — a friendly stand in front of
 * it says so. No collider (the breach group comes through here); the story hides it (`shutter_night_sign`) when the
 * shutter goes up.
 */
function nightSign(L: LevelBuild, Y: number) {
  const face = canvasMat(L, 'atrium_night', 512, 640, (g, W, H) => {
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f5a3a'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#f4efe2'; g.font = '700 50px Georgia, serif'; g.textAlign = 'center';
    g.fillText('정원 아트리움', W / 2, 78);
    g.fillStyle = '#26302a'; g.font = '600 46px Georgia, serif';
    g.fillText('야간 폐쇄', W / 2, 205);
    g.font = '700 82px Georgia, serif'; g.fillText('22:00 – 06:00', W / 2, 330);
    g.font = 'italic 38px Georgia, serif'; g.fillStyle = '#4b5a50';
    g.fillText('야간 설정 — 조명은 켜 둠', W / 2, 430);
    g.fillText('식물을 위해.', W / 2, 476);
    g.font = '600 34px Georgia, serif'; g.fillStyle = '#2f5a3a';
    g.fillText('잘 자요. — 시설팀', W / 2, 580);
  });
  const p = L.part('shutter_night_sign');
  // a brass stanchion with a framed board at reading height, turned to the walk from the lobby / the lock
  p.cyl('brass', 0, 0.012, 0, 0.2, 0.024, 'y', 18);
  p.cyl('brass', 0, 0.55, 0, 0.018, 1.08, 'y', 8);
  p.bx('wood_dark', -0.34, 0.98, -0.03, 0.34, 1.82, 0.0);
  p.quad(face, 0, 1.4, 0.004, 0.62, 0.78, '+z');
  const o = p.build();
  o.position.set(10.5, Y, -10.9);
  o.rotation.y = -0.5;
  L.root.add(o);
  L.objects.set('shutter_night_sign', o);
}

export const NORTH_DRESS: Partial<Record<RoomId3, RoomDress>> = { lift3, lock, gallery_n, lobby, admin };
