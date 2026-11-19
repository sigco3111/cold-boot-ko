/**
 * SUPERVISOR — FACILITIES (Halvorsen's office), stage 3a §4.3 / §2.5, task P3a. x −34 … −26, z −28 … −20, floor 4.8.
 *
 * One man's long-used room: his walnut desk with an old oak desk pushed against its front (papers, memo tray, the
 * notepad, binders on the visitor's side), a monitor on a swivel arm, a cream desk phone and a banker's lamp within
 * his reach, family photos, a fig, filing, a credenza under a fjord print, an aquarium, a coat on the hook, the
 * schedule board and three wall monitors behind his chair, the ceiling speaker.
 *
 * C2 staging (character agent): seated, his position is the chair-seat centre `halv_h2` (−32.6, 4.8, −24.2), seat top
 * 0.47, reach 0.6–0.8 m. His desk's front edge is 0.32 m ahead of `halv_h2` (x −32.28); phone and monitor sit within
 * ≈ 0.75 m of his shoulders. The greybox desk stand-in (x −31.8 … −30.6) keeps its collider: the two desks cover it.
 * Markers moved here (old → new) are listed in MOVED below and in the P3 report.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { D2, type LightRow, type RoomId3 } from './grey';
import type { RoomDress } from './index';
import {
  TINT, alongWall, defineLeaves, artMat, bankersLamp, bookcase, canvasMat, ceilingGrid, desk3, deskPhone, doorCasing, downlight, fabric,
  filingCabinet, glassFront, isStandin, keyboard, mug, officeChair, paint, paper, papersFlat, photoFrame, pictureFrame,
  plantSmall, pottedPlant, radio, restyle, rug, shade, sideboard, visitorChair, wainscot,
} from './kit3';

const PI = Math.PI;
const Y = D2;
/** Seated Halvorsen (H2) and his desk. */
const HX = -32.6, HZ = -24.2;
const DESK = { x0: -32.28, x1: -31.38, x2: -30.58, z0: -25.62, z1: -22.78, top: Y + 0.76 };
/** Markers this file moves (old → new), applied in build(). */
export const MOVED_OFFICE: Record<string, { from: [number, number, number]; to: [number, number, number] }> = {
  // (the cradle point: where his receiver lies — the phone body is 0.065 m west of it, facing him, I1)
  office_phone: { from: [-31.3, 5.57, -25.3], to: [-31.955, 5.642, -24.86] },
  office_monitor_arm: { from: [-31.0, 5.88, -23.6], to: [-31.86, 5.97, -23.62] },
  office_lamp: { from: [-31.6, 7.5, -23.4], to: [-31.86, 5.92, -25.02] },
  // I1: the badge lands on the oak desk in the visitor's view (clear of the notepad, memo tray and monitor foot);
  // the visitor chair (and the C2 eye on it) 0.3 m nearer the desk: knees 0.75 m from the oak desk's edge, not 1.1
  office_badge: { from: [-30.75, 5.57, -23.9], to: [-31.05, 5.565, -24.0] },
  office_chair: { from: [-29.5, 4.8, -24.2], to: [-29.8, 4.8, -24.2] },
  c2_eye: { from: [-29.5, 6.0, -24.2], to: [-29.8, 6.0, -24.2] },
};
const VISITOR = MOVED_OFFICE.office_chair.to;
const LAMP = MOVED_OFFICE.office_lamp.to;

const office: RoomDress = {
  label: false,
  look: { floor: 'carpet', wall: 'plaster_warm', ceiling: 'plaster_warm' },
  lights: [],
  build(L: LevelBuild) {
    const R = rng(3301);
    const b = L.builder('office_dress');
    defineLeaves(L);
    // the greybox desk block gives way to the two desks below (its collider stays, covered by them)
    restyle(L, 'office_grey', isStandin, null);

    // ── lights: the banker's lamp is Halvorsen's key (C2), a ceiling fill; emergency off
    const lampGlow = shade(L, 'office_bankers', 2.2, 0xffd6a0);
    const rows: LightRow[] = [
      { group: 'office', type: 'spot', p: LAMP, t: [HX, Y + 1.32, HZ + 0.05], color: 0xffc890, i: 9, d: 4.5, angle: 0.95, cast: true },
      { group: 'office', type: 'point', p: [-29.0, Y + 2.6, -24.0], color: 0xffd9b0, i: 4.5, d: 7 },
      { group: 'office_emerg', type: 'point', p: [-30, Y + 2.6, -24], color: 0xc8e0ff, i: 2.5, d: 7, off: true },
    ];
    const hs = rows.map((r) => r.type === 'spot'
      ? L.spot(r.group, r.p[0], r.p[1], r.p[2], r.t![0], r.t![1], r.t![2], r.color, r.i, r.d, r.angle ?? 0.9, { cast: !!r.cast, enabled: !r.off })
      : L.point(r.group, r.p[0], r.p[1], r.p[2], r.color, r.i, r.d, { enabled: !r.off }));
    hs[0].bindEmissive(lampGlow, lampGlow.emissiveIntensity);
    const ceilGlow = shade(L, 'office_down', 1.6, 0xffe2bc);
    hs[1].bindEmissive(ceilGlow, ceilGlow.emissiveIntensity);

    // ── shell: wainscot, ceiling grid, downlights, the speaker grille
    alongWall(b, '-z', -20.2, Y, () => wainscot(b, 26.2, 33.8, 1.0, [[28.85, 31.15]]));
    alongWall(b, '+x', -33.8, Y, () => wainscot(b, 20.2, 27.8, 1.0));
    alongWall(b, '-x', -26.2, Y, () => wainscot(b, -27.8, -20.2, 1.0));
    alongWall(b, '+z', -27.8, Y, () => wainscot(b, -33.8, -26.2, 1.0));
    ceilingGrid(b, L, -33.8, -26.2, -27.8, -20.2, Y + 2.9);
    for (const [x, z] of [[-28.8, -26.4], [-28.8, -21.8], [-31.6, -21.8], [-33.0, -26.6]] as const) downlight(b, ceilGlow, x, Y + 2.9, z, 0.07);
    // ceiling speaker grille (office_speaker)
    b.cyl('chrome', -30.5, Y + 2.9 - 0.006, -22.6, 0.13, 0.012, 'y', 18);
    b.cyl('painted_dark', -30.5, Y + 2.9 - 0.0125, -22.6, 0.11, 0.002, 'y', 18);
    b.detail(() => { for (let i = -3; i <= 3; i++) b.box('chrome', -30.5 + i * 0.03, Y + 2.9 - 0.015, -22.6, 0.006, 0.002, 0.2 * Math.sqrt(1 - (i / 3.6) ** 2)); });

    // ── door: wood casing (admin side carries the nameplate on the door's own lintel label)
    doorCasing(b, L, { x: -30, y: Y, z: -20, wall: 'z', back: 'Facilities Offices', sides: [-1] });

    // ── the desks
    // his: walnut, 2.84 × 0.9, knee hole centred on his chair, front (his side) at x −32.28
    b.at((DESK.x0 + DESK.x1) / 2, Y, (DESK.z0 + DESK.z1) / 2, -PI / 2, () => desk3(b, DESK.z1 - DESK.z0, DESK.x1 - DESK.x0, 0.76, 'wood_dark', 'wood_dark', 'both', true));
    // the old oak desk pushed against its front (visitor's side)
    b.at((DESK.x1 + DESK.x2) / 2, Y, (DESK.z0 + DESK.z1) / 2, PI / 2, () => desk3(b, DESK.z1 - DESK.z0, DESK.x2 - DESK.x1, 0.76, 'wood_veneer', 'wood_veneer', null, true));
    const top = DESK.top;
    // his chair (no collider: the story's dynamic body box covers him), the visitor chair (no collider, §2.9)
    b.at(HX, Y, HZ, PI / 2, () => officeChair(b, L, TINT.plum));
    b.at(VISITOR[0], Y, VISITOR[2], -PI / 2, () => visitorChair(b, L, TINT.sage));
    b.at(-29.35, Y, -24.15, 0, () => rug(b, L, 2.2, 1.6, TINT.rust, TINT.charcoal));

    // on his desk: phone (left), lamp (left front), keyboard, mug, photos, a plant, the in-tray
    // the phone faces him (its user side, local −z, toward +z: he sits north-west of it) with the cradle along z —
    // the axis his own receiver lies on (the actor draws the receiver and its cord; the cradle here is empty). I1:
    // it faced the visitor (keypad upside down from his chair) and kept its own handset while he held his.
    const phx = MOVED_OFFICE.office_phone.to[0] - 0.065, phz = MOVED_OFFICE.office_phone.to[2];
    b.at(phx, top, phz, PI, () => deskPhone(b, L, false));
    b.detail(() => {
      b.rod('plastic_dark', phx + 0.05, top + 0.02, phz - 0.12, -31.75, top + 0.01, -25.1, 0.004, 4); // wall cord
      b.at(LAMP[0] + 0.12, top, LAMP[2] - 0.2, PI / 2 + 0.2, () => bankersLamp(b, L, lampGlow));
      b.at(-32.0, top, -24.15, -PI / 2, () => keyboard(b));
      b.at(-31.95, top, -23.15, 0.4, () => mug(b, L, 1));
      b.at(-31.6, top, -22.98, -PI / 2 - 0.35, () => photoFrame(b, L, 1));
      b.at(-31.62, top, -25.42, -PI / 2 + 0.3, () => photoFrame(b, L, 2, 0.12, 0.16));
      b.at(-31.62, top, -23.35, 0, () => plantSmall(b, R));
      b.at(-32.05, top, -25.35, -0.1, () => papersFlat(b, L, 4, 0.08, R));
      // pen pot + pens
      b.cyl('brass', -31.6, top + 0.05, -23.75, 0.035, 0.1, 'y', 10);
      for (let i = 0; i < 4; i++) b.rod(i % 2 ? 'plastic_dark' : 'chrome', -31.6, top + 0.05, -23.75, -31.6 + R.range(-0.03, 0.03), top + 0.16, -23.75 + R.range(-0.03, 0.03), 0.004, 4);
    });

    // the oak desk: notepad (note3_pad), memo tray (note3_memo), binders, a fan of papers, the badge lands at (−30.75, −23.9)
    b.detail(() => {
      const legal = paper(L, 0xf3e58e);
      b.rbox(legal, -31.2, top + 0.006, -24.4, 0.22, 0.012, 0.3, 0, 0.12, 0);
      b.rbox('plastic_dark', -31.08, top + 0.014, -24.32, 0.14, 0.008, 0.008, 0, 0.6, 0); // pen
      b.at(-31.25, top, -23.0, 0.05, () => {
        b.bx('wood_dark', -0.17, 0, -0.13, 0.17, 0.012, 0.13);
        for (const s of [-1, 1]) b.bx('wood_dark', -0.17, 0, s * 0.13 - 0.006, 0.17, 0.06, s * 0.13 + 0.006);
        b.bx('wood_dark', -0.17, 0, -0.13, -0.164, 0.06, 0.13);
        for (let i = 0; i < 4; i++) b.rbox(paper(L), 0, 0.016 + i * 0.004, 0, 0.21, 0.003, 0.25, 0, R.range(-0.06, 0.06), 0);
      });
      for (let i = 0; i < 4; i++) b.rbox(fabric(L, [TINT.slate, TINT.rust, TINT.charcoal, TINT.sage][i]), -30.86, top + 0.15, -25.45 + i * 0.07, 0.29, 0.3, 0.06, 0, 0, 0);
      b.at(-30.9, top, -24.95, 0.2, () => papersFlat(b, L, 5, 0.12, R));
      b.at(-30.95, top, -22.95, -0.5, () => mug(b, L, 0));
    });

    // monitor on its swivel arm: clamp + pole on the far edge of his desk, link to a pivot under the screen; the
    // bezel rides the arm object (C2 `turn_monitor` swivels it about its own vertical axis)
    const arm = L.objects.get('office_monitor_arm')!;
    const [ax, ay, az] = MOVED_OFFICE.office_monitor_arm.to;
    arm.position.set(ax, ay, az);
    b.bx('painted_dark', -31.5, top - 0.06, -23.3, -31.38, top + 0.02, -23.18);
    b.cyl('chrome', -31.44, top + 0.2, -23.24, 0.016, 0.4, 'y', 8);
    b.rod('chrome', -31.44, top + 0.38, -23.24, ax + 0.02, ay - 0.215, az, 0.014, 8);
    b.sphere('painted_dark', ax + 0.02, ay - 0.215, az, 0.025, 8);
    const part = L.part('office_monitor_bezel');
    part.bx('plastic_dark', 0.002, -0.19, -0.3, 0.032, 0.19, 0.3);
    part.bx('plastic_dark', 0.032, -0.08, -0.08, 0.06, 0.08, 0.08);
    part.rod('chrome', 0.02, -0.19, 0, 0.02, -0.215, 0, 0.012, 6);
    const bezel = part.build();
    bezel.name = 'office_monitor_bezel';
    arm.add(bezel);

    // ── west wall: the three wall monitors on a shelf bracket behind his head (office_thumb_1..3)
    for (const z of [-25.4, -24.2, -23.0]) {
      b.bx('plastic_dark', -33.8, 6.5 - 0.21, z - 0.33, -33.765, 6.5 - 0.18, z + 0.33);
      b.bx('plastic_dark', -33.8, 6.5 + 0.18, z - 0.33, -33.765, 6.5 + 0.21, z + 0.33);
      b.bx('plastic_dark', -33.8, 6.5 - 0.18, z - 0.33, -33.765, 6.5 + 0.18, z - 0.3);
      b.bx('plastic_dark', -33.8, 6.5 - 0.18, z + 0.3, -33.765, 6.5 + 0.18, z + 0.33);
    }
    // a framed habitat map between the monitors and the corner, low bookshelf in the north-west corner
    alongWall(b, '+x', -33.8, Y, () => pictureFrame(b, artMat(L, 'map', 3), 21.3, 1.65, 0.6, 0.45));
    b.at(-32.4, Y, -20.42, PI, () => sideboard(b, 1.6, 0.75, 'wood_dark'));
    b.detail(() => {
      b.at(-32.9, Y + 0.75, -20.5, PI + 0.2, () => radio(b, L));
      for (let i = 0; i < 6; i++) b.rbox(fabric(L, [TINT.slate, TINT.charcoal, TINT.rust][i % 3]), -32.2 + i * 0.075, Y + 0.75 + 0.16, -20.48, 0.06, 0.32, 0.26, 0, 0, i === 5 ? -0.25 : 0);
      b.at(-31.75, Y + 0.75, -20.5, PI, () => papersFlat(b, L, 3, 0.06, R));
    });

    // ── north wall: schedule board (note3_schedule) over the sideboard, coat hook by the door
    const sched = canvasMat(L, 'office_schedule', 640, 400, (g, W, H) => {
      g.fillStyle = '#f7f6f1'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1d3f73'; g.font = '700 34px "Marker Felt", "Comic Sans MS", sans-serif'; g.fillText('시설팀 — 46주차', 24, 46);
      g.strokeStyle = '#3a3a3a'; g.lineWidth = 2;
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      for (let i = 0; i < 7; i++) { const y = 74 + i * 44; g.beginPath(); g.moveTo(16, y); g.lineTo(W - 16, y); g.stroke(); g.fillStyle = '#333'; g.font = '600 20px Arial'; g.fillText(days[i], 24, y + 30); }
      g.beginPath(); g.moveTo(96, 74); g.lineTo(96, 74 + 7 * 44); g.stroke();
      const r = (s: number) => { const x = Math.sin(s * 91.7) * 4371.3; return x - Math.floor(x); };
      for (let i = 0; i < 7; i++) for (let k = 0; k < 2 + Math.floor(r(i) * 3); k++) {
        g.strokeStyle = ['#1d3f73', '#222', '#a12a2a'][(i + k) % 3]; g.lineWidth = 3; g.beginPath();
        const x0 = 112 + k * 150, y = 74 + i * 44 + 26; g.moveTo(x0, y);
        for (let x = x0; x < x0 + 110 + r(i * 7 + k) * 60; x += 8) g.lineTo(x, y + Math.sin(x * 0.4 + i) * 3);
        g.stroke();
      }
      g.strokeStyle = '#a12a2a'; g.lineWidth = 4; g.strokeRect(104, 78, W - 130, 40); // the test, boxed in red on Monday
      g.strokeStyle = '#a12a2a'; g.beginPath(); g.moveTo(104, 98); g.lineTo(W - 30, 98 + 3 * 44); g.stroke();
    });
    alongWall(b, '-z', -20.2, Y, () => b.at(32.6, 0, 0, 0, () => { b.bx('chrome', -0.72, 1.12, 0.002, 0.72, 2.0, 0.016); b.quad(sched, 0, 1.56, 0.023, 1.4, 0.84, '+z'); b.bx('chrome', -0.6, 1.08, 0.016, 0.6, 1.1, 0.07); }));
    // coat on a hook east of the door (navy wool)
    b.cyl('brass', -28.5, Y + 1.78, -20.25, 0.012, 0.1, 'z', 6);
    b.detail(() => {
      const coat = fabric(L, 0x2f3a52);
      b.rbox(coat, -28.5, Y + 1.25, -20.33, 0.5, 0.95, 0.14, 0.04, 0, 0.03);
      b.rbox(coat, -28.5, Y + 1.7, -20.33, 0.34, 0.12, 0.12, 0, 0, 0);
      b.rbox(fabric(L, TINT.rust), -28.42, Y + 1.5, -20.42, 0.06, 0.6, 0.02, 0.05, 0, 0.12); // a scarf
    });

    // ── east wall: bookcase, filing cabinets by the door, credenza with the aquarium
    b.at(-26.36, Y, -23.0, -PI / 2, () => bookcase(b, L, 1.2, 2.05, R));
    b.at(-26.51, Y, -21.0, -PI / 2, () => filingCabinet(b, 4, paint(L, 0x8a8f86, 0.5)));
    b.at(-26.51, Y, -21.5, -PI / 2, () => filingCabinet(b, 3, paint(L, 0x8a8f86, 0.5)));
    b.detail(() => b.at(-26.55, Y + 1.04, -21.5, 0, () => plantSmall(b, R, paint(L, 0xb85c3c, 0.6))));
    b.at(-26.43, Y, -26.4, -PI / 2, () => sideboard(b, 2.2, 0.72));
    // the aquarium (pump and plant; the story stops it at the takeover: object `office_aquarium`)
    const aqGlow = mat3Aqua(L);
    b.detail(() => {
      const ax0 = -26.75, ay0 = Y + 0.72;
      b.bx('painted_dark', ax0 - 0.2, ay0, -26.85, ax0 + 0.2, ay0 + 0.04, -25.95);
      b.bx('painted_dark', ax0 - 0.2, ay0 + 0.5, -26.85, ax0 + 0.2, ay0 + 0.54, -25.95);
      b.bx(aqGlow, ax0 - 0.18, ay0 + 0.04, -26.83, ax0 + 0.18, ay0 + 0.44, -25.97);
      b.bx('soil', ax0 - 0.175, ay0 + 0.04, -26.825, ax0 + 0.175, ay0 + 0.09, -25.975);
      for (let i = 0; i < 6; i++) b.inst('l3_leaf_blade', ax0 + R.range(-0.1, 0.1), ay0 + 0.08, -26.4 + R.range(-0.3, 0.3), R.range(0, 0.3), R.range(0, 6), 0, 0.12, 0.3, 0.12);
      b.cyl('plastic_dark', ax0 + 0.1, ay0 + 0.3, -25.99, 0.02, 0.18, 'y', 8);
    });
    const aq = L.marker('office_aquarium', -26.75, Y + 0.95, -26.4);
    aq.userData.glow = aqGlow;
    b.bx(glassFront(L), -26.95, Y + 0.76, -26.85, -26.55, Y + 1.22, -25.95);

    // ── south wall: the fjord print, a fig in each corner
    alongWall(b, '+z', -27.8, Y, () => pictureFrame(b, artMat(L, 'fjord', 7), -30.4, 1.65, 1.0, 0.72));
    pottedPlant(b, -33.25, Y, -27.25, 'fig', 1.0, R, paint(L, 0xb85c3c, 0.6));
    pottedPlant(b, -27.2, Y, -27.3, 'palm', 0.8, R, 'stone_pale');
    b.at(-29.9, Y, -27.48, 0, () => filingCabinet(b, 2, 'wood_veneer'));
    b.detail(() => b.at(-29.9, Y + 0.71, -27.48, 0.3, () => photoFrame(b, L, 3, 0.18, 0.13)));
  },
};

function mat3Aqua(L: LevelBuild): THREE.MeshStandardMaterial {
  const m = L.ctx.materials.clone('emissive_cyan', { color: 0x1d3a36, emissive: new THREE.Color(0x2f7d74), emissiveIntensity: 0.12, roughness: 0.1 });
  m.name = 'office_aquarium_water';
  return m;
}

/** Move the C2 markers the office layout changed (see MOVED_OFFICE); Halvorsen's body box stays clear of his desk. */
function moveMarkers(L: LevelBuild) {
  for (const [id, mv] of Object.entries(MOVED_OFFICE)) {
    if (id === 'office_monitor_arm') continue; // set in build
    L.objects.get(id)?.position.set(...mv.to);
  }
  // his desk's front edge / top relative to his seat (the actor's `desk` prop; the story reads it from the marker)
  const h2 = L.objects.get('halv_h2');
  if (h2) h2.userData.desk = { front: +(DESK.x0 - h2.position.x).toFixed(3), top: +(DESK.top - Y).toFixed(3) };
  const hb = L.objects.get('halv_body_box');
  if (hb) hb.userData.box = [-33.2, D2, -24.8, -32.3, 6.2, -23.6];
}

export const OFFICE_DRESS: Partial<Record<RoomId3, RoomDress>> = {
  office: { ...office, build(L) { office.build!(L); moveMarkers(L); } },
};
