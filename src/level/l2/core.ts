/**
 * CHOIR — NODE 5 — x -8…8, z -88…-72, h 6. One cold, clean, bright room: three tall cell columns (CHOIR's power),
 * the pedestal, CHOIR's waveform on the end walls — and the choice (REVISION 6 / 6.1): two palm-scanner stations,
 * STOP (west, amber) and COMMAND (east, plain white), each under its option card on the long wall behind it.
 * And the SERVICE LIFT behind it (x -2…2, z -93…-88) — the way out.
 *
 * The level only SHOWS the choice. The story owns it: it computes the focus, runs the scan (player.palm) and tells
 * this room through vignettes — never the raw `interact` press:
 *   core_cards_on                       the cards are on the side walls (story sets the screens): rings to neutral
 *   core_live                           scanners armed (plates leave STANDBY)
 *   core_focus_stop | core_focus_command   the latched option: its card and ring brighten, the other dims
 *   core_scan_stop | core_scan_command  a scan started on that plate      core_scan_cancel   abandoned
 *   core_scan_done                      completed: REYES, S. — LIVING — ROSTERED; the other plate goes dark
 *   core_cell_out                       the next cell dies (on CHOIR's count); core_cells_out = all three, timed
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { cableBundle, floorSlab, handrail, lathe, panelOn } from '../kit';
import { wallTerminal } from '../props';
import { ceilingSlab, wallFace } from '../structure';
import { easeInOut } from '../ambient';

const PI = Math.PI;
const H = 6;
const CELLS: [number, number][] = [[-4.6, -83.2], [0, -84.6], [4.6, -83.2]];
/** Scan time shown by the plate's bar (the story passes the same number to `player.palm`). */
const SCAN_SECONDS = 1.6;

type Side = 'stop' | 'command';
interface Station {
  side: Side;
  label: string;
  colour: 'amber' | 'white';
  ring: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  card: string;
  state: string;
  failT: number;
  x: number;
}

export function buildCore(L: LevelBuild) {
  const b = L.builder('core');
  const R = rng(2901);
  L.room('core', 'CHOIR — 노드 5', -8, 8, -88, -72, H);
  floorSlab(b, 'wall_medical', -8, -88, 8, -72, [], 'metal');
  ceilingSlab(b, -8.2, -88, 8.2, -72, H, 'painted_white');
  const st = { h: H, t: 0.2, style: 'medical' as const, trayY: 0, features: 0, bay: 2.0 };
  wallFace(b, { ...st, n: '-z', plane: -72.2, from: -8, to: 8, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 291 });
  wallFace(b, { ...st, n: '+z', plane: -87.8, from: -8, to: 8, openings: [{ c: 0, w: 1.6, h: 2.4 }], seed: 292 });
  wallFace(b, { ...st, n: '+x', plane: -8, from: -87.8, to: -72.2, seed: 293 });
  wallFace(b, { ...st, n: '-x', plane: 8, from: -87.8, to: -72.2, seed: 294 });
  // vestibule from the hall door to the room (not a room itself)
  const vb = L.builder('core_vest');
  vb.rooms = ['line', 'core'];
  floorSlab(vb, 'wall_medical', -1.9, -72.2, 1.9, -70.0, [], 'metal');
  ceilingSlab(vb, -1.9, -72.0, 1.9, -70.0, 3.0, 'painted_white'); // ends inside the core's wall, not flush with its face
  for (const [x, n] of [[-1.7, '+x'], [1.7, '-x']] as const) wallFace(vb, { n, plane: x, from: -72.2, to: -70.2, h: 3.0, t: 0.25, style: 'medical', trayY: 0, features: 0, seed: 295 });
  L.navNode(0, -71.1, 'core');
  // the luminous ceiling: a grid of light panels, bound to the room's lights
  const mains: ReturnType<LevelBuild['point']>[] = [];
  for (const [x, z] of [[-4.5, -76], [4.5, -76], [-4.5, -83], [4.5, -83], [0, -79.5], [0, -86.5], [0, -74]] as const) mains.push(L.point('core', x, H - 0.6, z, 0xe8f4ff, 22, 13, { priority: 2 }));
  const ceilGlow = L.glow(mains[4], 'emissive_white', 0.9);
  b.detail(() => {
    for (let x = -6.6; x <= 6.61; x += 2.2) for (let z = -86.6; z <= -73.39; z += 2.2) {
      b.box(ceilGlow, x, H - 0.02, z, 1.9, 0.02, 1.9);
      b.box('trim_steel', x, H - 0.03, z + 1.1, 2.2, 0.03, 0.04);
    }
  });
  // floor: a ring of light around the pedestal (cyan — neutral once the option cards are on: REVISION 6.1), seams
  const ringMat = L.ctx.materials.clone('emissive_cyan');
  ringMat.emissiveIntensity = 1.6;
  const RING_CYAN = ringMat.emissive.clone(), RING_NEUTRAL = new THREE.Color(0x9aa3ab);
  b.detail(() => {
    b.torus(ringMat, 0, 0.005, -79.4, 2.6, 0.025, 'y', 64);
    b.torus(ringMat, 0, 0.005, -79.4, 3.1, 0.012, 'y', 64);
    for (let x = -6; x <= 6; x += 2) b.box(b.L.overlay('trim_steel'), x, 0.002, -80, 0.02, 0.004, 15.6);
  });
  // battery fallback (amber, off until core_cells_out)
  for (const [x, z] of [[-6, -74], [6, -74], [-6, -86], [6, -86]] as const) L.point('core_battery', x, 4.5, z, 0xffa040, 10, 10, { enabled: false, flicker: 'pulse' });

  // ── the walls: CHOIR's waveform north and south; the long side walls carry the option cards once inside ──
  // (each display stands SCR m proud of its wall, in a dark housing: in front of the wall's pilasters, which would cut the text)
  const SCR = 0.1;
  L.screen('core_wall_1', 'choir', 9.0, 2.6, 0, 4.4, -72.2 - SCR, '-z');
  const cardE = L.screen('core_wall_2', 'choir', 12.0, 3.6, 8 - SCR, 3.3, -80, '-x');
  L.screen('core_wall_3', 'choir', 9.0, 2.6, 0, 4.4, -87.8 + SCR, '+z');
  const cardW = L.screen('core_wall_4', 'choir', 12.0, 3.6, -8 + SCR, 3.3, -80, '+x');
  // the option cards are read at a slant and under seven ceiling lamps: a matt face, no hot spots over the words
  for (const m of [cardE, cardW]) (m.material as THREE.MeshStandardMaterial).roughness = 0.62;
  for (const [x, z, w, h, ry] of [[0, -72.2, 9.2, 2.8, PI], [8, -80, 12.2, 3.8, -PI / 2], [0, -87.8, 9.2, 2.8, 0], [-8, -80, 12.2, 3.8, PI / 2]] as const) {
    const cy = w > 10 ? 3.3 : 4.4;
    b.at(x, 0, z, ry, () => { b.box('painted_dark', 0, cy, (SCR - 0.008) / 2, w, h, SCR - 0.008); b.box('trim_steel', 0, cy - h / 2 - 0.04, 0.075, w + 0.07, 0.06, 0.15); });
  }
  L.marker('core_card_stop', -8 + SCR, 3.3, -80);
  L.marker('core_card_command', 8 - SCR, 3.3, -80);
  // the eye above the pedestal: turns to the player on core_bow; mirrors the latched option
  const eyePivot = new THREE.Group();
  eyePivot.position.set(0, 3.7, -79.4);
  const eyeScr = L.screen('core_eye', 'choir', 2.2, 1.3, 0, 0, 0, '+z', { parent: eyePivot });
  (eyeScr.material as THREE.MeshStandardMaterial).roughness = 0.5; // it carries words now: no lamp glare on them
  const eyeBack = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 0.08), L.ctx.materials.get('painted_white'));
  eyeBack.position.z = -0.05;
  eyePivot.add(eyeBack);
  eyePivot.userData.rooms = ['core'];
  L.root.add(eyePivot);
  b.detail(() => { for (const s of [-1, 1]) b.rod('trim_steel', s * 0.9, 4.4, -79.4, s * 0.6, H, -79.4, 0.012, 4); });

  // ── the three cell columns: CHOIR's power. Nothing on them is a control (REVISION 6). ──
  const cellMats: THREE.MeshStandardMaterial[] = [];
  CELLS.forEach(([x, z], i) => {
    const m = L.ctx.materials.clone('emissive_cyan');
    m.emissive.set(0x9fe8ff);
    m.emissiveIntensity = 2.2;
    cellMats.push(m);
    b.at(x, 0, z, 0, () => {
      lathe(b, 'painted_white', [[0.001, 0], [0.95, 0], [0.95, 0.2], [0.8, 0.35], [0.7, 0.6], [0.001, 0.62]], 0, 0, 0, 32);
      lathe(b, 'painted_white', [[0.001, H + 0.03], [0.85, H + 0.03], [0.85, H - 0.25], [0.7, H - 0.5], [0.001, H - 0.52]], 0, 0, 0, 32); // cap buried in the ceiling
      // stacked cells inside a glass sleeve
      b.detail(() => {
        for (let k = 0; k < 11; k++) {
          const y = 0.8 + k * 0.42;
          b.cyl(m, 0, y, 0, 0.42, 0.26, 'y', 24);
          b.cyl('trim_steel', 0, y + 0.18, 0, 0.46, 0.06, 'y', 24);
        }
        for (let k = 0; k < 6; k++) { const a = (k * PI) / 3; b.rod('chrome', Math.cos(a) * 0.62, 0.6, Math.sin(a) * 0.62, Math.cos(a) * 0.62, H - 0.5, Math.sin(a) * 0.62, 0.025, 6); }
      });
      b.detail(() => b.cyl(L.ctx.materials.get('glass'), 0, (H - 1.1) / 2 + 0.6, 0, 0.6, H - 1.1, 'y', 32));
      // a name plate on the plinth, facing the pedestal
      b.push(0, 0, 0, Math.atan2(-x, -79.4 - z));
      b.detail(() => {
        b.rbox('painted_dark', 0, 0.47, 0.775, 0.4, 0.15, 0.03, -0.38, 0, 0);
        b.push(0, 0.47, 0.775, 0, -0.38);
        b.sign('셀 ' + (i + 1), 'label', 0, 0, 0.015, 0.34, 0.085, '+z');
        b.pop();
      });
      b.pop();
      b.collide(-0.9, 0, -0.9, 0.9, H, 0.9);
    });
    cableBundle(b, [x, H - 0.1, z], [x * 0.4, H - 0.05, -79.4], 3, 0.3, 0.03, 0.06, R, ['plastic_dark', 'rubber', 'plastic_dark']);
  });
  L.marker('core_cells', 0, 1.2, -84);

  // ── the pedestal: CHOIR's lectern. Not a control (REVISION 6): its screen mirrors the option being looked at. ──
  b.at(0, 0, -79.4, 0, () => {
    lathe(b, 'painted_white', [[0.001, 0], [0.7, 0], [0.72, 0.08], [0.45, 0.2], [0.32, 0.9], [0.4, 1.0], [0.001, 1.02]], 0, 0, 0, 32);
    b.rbox('painted_white', 0, 1.08, 0.08, 0.8, 0.08, 0.6, 0.5, 0, 0);
    b.collide(-0.5, 0, -0.5, 0.5, 1.1, 0.5);
  });
  const ped = L.screen('core_pedestal', 'choir', 0.66, 0.42, 0, 1.135, -79.3, '+z');
  (ped.material as THREE.MeshStandardMaterial).roughness = 0.5;
  ped.rotation.set(-1.07, 0, 0, 'YXZ');
  ped.position.set(0, 1.125, -79.3);
  L.marker('core_pedestal', 0, 1.1, -79.4);

  // ── side terminal: PATTERN LIBRARY — north wall, west of the door (off the west option card: REVISION 6.1) ──
  b.at(-4.9, 0, -72.2, PI, () => wallTerminal(b, 1.35));
  L.screen(null, 'terminal_idle', 0.44, 0.3, -4.9, 1.43, -72.2 - 0.126, '-z', { tilt: -0.18, text: 'PATTERN LIBRARY\n00  REYES, S.  (REF)' });
  L.interact('term2_core', 'terminal', '단말기 읽기', -4.9, 1.4, -72.6, true, 2.2);
  b.sign('패턴 라이브러리', 'label', -4.9, 2.25, -72.23, 0.9, 0.12, '-z');
  b.sign('노드 5', 'stencil', 0, 5.4, -72.21, 2.0, 0.42, '-z');

  // ── the two palm-scanner stations (REVISION 6 / 6.1): symmetric, 10.4 m apart, each facing the room's centre ──
  const TILT = 0.5; // the plate leans toward whoever stands in front of it
  const stations: Station[] = [];
  const station = (side: Side, x: number, ry: number, face: '+x' | '-x', colour: 'amber' | 'white', label: string, card: string) => {
    const ring = L.ctx.materials.clone(colour === 'amber' ? 'emissive_amber' : 'emissive_white');
    const trim = L.ctx.materials.clone(colour === 'amber' ? 'emissive_amber' : 'emissive_white');
    if (colour === 'amber') { ring.emissive.set(0xff9a26); trim.emissive.set(0xff9a26); } else { ring.emissive.set(0xffffff); trim.emissive.set(0xffffff); }
    ring.emissiveIntensity = 1.2; trim.emissiveIntensity = 1.6;
    // local frame: +z = toward the user, origin on the floor
    const sn = Math.sin(TILT), cs = Math.cos(TILT);
    const hy = 0.985, hz = 0.05; // centre of the head slab
    b.at(x, 0, -80, ry, () => {
      // plinth with a hazard band, tapered body, dark service panel
      b.box('hazard_stripes', 0, 0.07, 0, 0.66, 0.14, 0.5);
      b.box('painted_white', 0, 0.5, -0.02, 0.5, 0.72, 0.36);
      b.box('painted_white', 0, 0.9, -0.04, 0.56, 0.1, 0.4);
      b.detail(() => {
        b.box('painted_dark', 0, 0.5, 0.162, 0.36, 0.5, 0.012);
        b.sign(label, 'label', 0, 0.62, 0.169, 0.3, 0.085, '+z');
        b.box(trim, 0, 0.3, 0.17, 0.3, 0.02, 0.008);
        for (const sx of [-1, 1]) b.box('trim_steel', sx * 0.255, 0.5, 0.0, 0.012, 0.7, 0.3);
      });
      // the head: a slab leaning toward the user, the plate set into its top, a lit lip along its near edge
      b.rbox('painted_white', 0, hy, hz, 0.68, 0.08, 0.56, TILT, 0, 0);
      b.detail(() => {
        b.rbox('painted_dark', 0, hy + cs * 0.041, hz + sn * 0.041, 0.54, 0.004, 0.48, TILT, 0, 0);
        b.rbox(trim, 0, hy - sn * 0.292 + cs * 0.02, hz + cs * 0.292 + sn * 0.02, 0.68, 0.03, 0.024, TILT, 0, 0);
        for (const sx of [-1, 1]) b.rbox('trim_steel', sx * 0.345, hy, hz, 0.012, 0.09, 0.56, TILT, 0, 0);
      });
      // on the floor: a dark mat, on it a raised ring in the option's colour (r 0.70 on a 0.75 mat: clear of the floor seams at
      // x ±4 / ±6 and of the pedestal's rings), and a lit line from the ring to the foot of the option's card
      b.detail(() => {
        b.cyl('painted_dark', 0, 0.004, 0, 0.75, 0.008, 'y', 56);
        b.torus(ring, 0, 0.024, 0, 0.7, 0.024, 'y', 56);
        b.box('painted_dark', 0, 0.004, -1.8, 0.2, 0.008, 1.9);
        b.box(ring, 0, 0.012, -1.8, 0.07, 0.012, 1.9);
      });
      b.collide(-0.34, 0, -0.25, 0.34, 0.96, 0.3);
      b.collide(-0.34, 0.9, -0.22, 0.34, 1.14, 0.1);
    });
    // plate centre (world): on top of the slab
    const local = new THREE.Vector3(0, hy + cs * 0.047, hz + sn * 0.047);
    const dir = face === '+x' ? 1 : -1; // local +z → world ±x; local +x → world ∓z
    const wx = x + dir * local.z, wy = local.y, wz = -80;
    const mesh = L.screen(`core_plate_${side}`, 'palm', 0.5, 0.44, wx, wy, wz, face, { tilt: -(PI / 2 - TILT), text: `${colour}|standby|${label}|${SCAN_SECONDS}` });
    (mesh.material as THREE.MeshStandardMaterial).roughness = 0.5; // no lamp glare in the middle of the hand outline
    // marker for the story / player: local +Z = the plate's normal, +Y = up the plate (away from the user)
    const mk = L.marker(`core_plate_${side}`, wx, wy, wz);
    mk.quaternion.copy(mesh.quaternion);
    // the use point floats above the plate, outside the console's collider: in the cone whether the player looks at
    // the plate or straight at the card behind it. Radius ≈ the scan's start distance (1.0 m on the floor).
    L.interact(side === 'stop' ? 'core_shutdown' : 'core_rewrite', 'palm', `손바닥을 대세요 — ${label}`, wx, 1.3, wz, true, 1.05);
    const light = L.point('core', x + dir * 0.35, 1.7, -80, colour === 'amber' ? 0xff9a26 : 0xffffff, 5, 3.2, { priority: 1 });
    void light;
    stations.push({ side, label, colour, ring, trim, plate: L.screens.get(`core_plate_${side}`)!, card, state: 'standby', failT: 0, x });
  };
  station('stop', -5.2, PI / 2, '+x', 'amber', '정지', 'core_wall_4');
  station('command', 5.2, -PI / 2, '-x', 'white', '명령', 'core_wall_2');

  // ── machine l2_core + vignettes ──
  let state: MachineState = 'off', bow = false, out = 0, cards = false, live = false, chosen: Side | null = null, scanning: Side | null = null;
  let focus: Side | null = null;
  const lights = L.ctx.render.lights;
  const mats = L.ctx.materials;
  const plateSet = (s: Station, st: string) => { if (s.state === st) return; s.state = st; mats.setScreen(s.plate, 'palm', { text: `${s.colour}|${st}|${s.label}|${SCAN_SECONDS}` }); };
  const stationOf = (side: Side) => stations.find((s) => s.side === side)!;
  const armed = (s: Station) => (state === 'off' || out >= 3 ? 'off' : chosen ? (chosen === s.side ? 'done' : 'off') : live ? 'idle' : 'standby');
  L.machines.set('l2_core', (s) => {
    state = s;
    if (s === 'frenzy') lights.setGroup('core', { flicker: 'broken' });
    else if (s === 'active') lights.setGroup('core', { flicker: 'none' });
    if (s === 'off') { for (const m of cellMats) m.emissiveIntensity = 0; ringMat.emissiveIntensity = 0; for (const q of stations) { q.ring.emissiveIntensity = 0; q.trim.emissiveIntensity = 0; plateSet(q, 'off'); } }
  });
  const target = new THREE.Vector3();
  const BASE = 2.2; // emissive level of a card nobody is looking at
  L.ambient('core', (dt, t) => {
    const on = state === 'active' || state === 'frenzy';
    if (on) {
      cellMats.forEach((m, i) => {
        if (i < out) return;
        const k = state === 'frenzy' ? (Math.sin(t * 37 + i * 3) > 0.2 ? 2.8 : 0.4) : 2.0 + 0.4 * Math.sin(t * 1.6 + i * 2.1);
        m.emissiveIntensity = k;
      });
      // the pedestal's rings: CHOIR's cyan until the cards are on, then a quiet neutral — the two options are the
      // only coloured things at floor level
      const want = cards ? RING_NEUTRAL : RING_CYAN;
      ringMat.emissive.lerp(want, Math.min(1, dt * 3));
      const lvl = out >= 3 ? 0 : cards ? 0.5 : 1.4 + 0.3 * Math.sin(t * 1.6);
      ringMat.emissiveIntensity += (lvl - ringMat.emissiveIntensity) * Math.min(1, dt * 4);
      for (const s of stations) {
        // rings and cards: the latched option bright, the other dim; a scan pulses its ring; after the choice only the chosen one stays
        const mine = chosen ? chosen === s.side : focus === s.side;
        const other = chosen ? chosen !== s.side : focus !== null && focus !== s.side;
        let ring = !cards ? 0.5 : mine ? 2.6 : other ? 0.55 : 1.3;
        if (scanning === s.side) ring = 2.2 + 1.6 * Math.abs(Math.sin(t * 9));
        if (out >= 3) ring = 0;
        s.ring.emissiveIntensity += (ring - s.ring.emissiveIntensity) * Math.min(1, dt * 8);
        s.trim.emissiveIntensity = Math.min(2.4, 0.6 + s.ring.emissiveIntensity * 0.6) * (out >= 3 ? 0 : 1);
        const card = L.screens.get(s.card);
        if (card && cards && !chosen && out === 0) {
          const lv = BASE * (mine ? 1.25 : other ? 0.42 : 0.9);
          card.emissiveIntensity += (lv - card.emissiveIntensity) * Math.min(1, dt * 6);
        }
        if (s.failT > 0) { s.failT -= dt; if (s.failT <= 0) plateSet(s, armed(s)); }
      }
    }
    // the eye hangs facing the door; after core_bow it turns to whoever is in the room
    const p = L.ctx.player?.eye;
    if (bow && p) {
      target.set(p.x, eyePivot.position.y, p.z);
      const want = Math.atan2(target.x - eyePivot.position.x, target.z - eyePivot.position.z);
      let d = want - eyePivot.rotation.y;
      while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI;
      eyePivot.rotation.y += d * Math.min(1, dt * 1.2);
      eyePivot.rotation.x += (Math.atan2(eyePivot.position.y - p.y, Math.hypot(p.x - eyePivot.position.x, p.z - eyePivot.position.z)) * 0.6 - eyePivot.rotation.x) * Math.min(1, dt);
    } else eyePivot.position.y = 3.7 + Math.sin(t * 0.7) * 0.04;
  });
  L.vignette('core_bow', () => {
    bow = true;
    L.sfx('glitch', 0, 3.5, -79.4, 0.6);
    try { L.ctx.render.post.glitch(0.35); } catch { /* post */ }
  });
  // ── the choice, as the story tells it (toggles: each may be fired any number of times) ──
  L.vignette('core_cards_on', () => { cards = true; }, true);
  L.vignette('core_live', () => {
    if (live) return;
    live = true;
    for (const s of stations) { plateSet(s, armed(s)); L.sfx('terminal_beep', s.x, 1.1, -80, 0.5, s.side === 'stop' ? 0.9 : 1.1); }
  }, true);
  const setFocus = (side: Side) => {
    if (focus === side || chosen) return;
    focus = side;
    L.sfx('ui_hover', stationOf(side).x * 0.3, 2.5, -79.4, 0.5, side === 'stop' ? 0.8 : 1.15);
  };
  L.vignette('core_focus_stop', () => setFocus('stop'), true);
  L.vignette('core_focus_command', () => setFocus('command'), true);
  const scanStart = (side: Side) => {
    if (chosen) return;
    const s = stationOf(side);
    scanning = side; s.failT = 0;
    s.state = ''; plateSet(s, 'scan'); // (restart the bar even if the plate still showed a scan)
    L.sfx('power_up', s.x, 1.1, -80, 0.55, 1.5);
  };
  L.vignette('core_scan_stop', () => scanStart('stop'), true);
  L.vignette('core_scan_command', () => scanStart('command'), true);
  L.vignette('core_scan_cancel', () => {
    if (!scanning || chosen) return;
    const s = stationOf(scanning);
    scanning = null;
    plateSet(s, 'fail'); s.failT = 1.8;
    L.sfx('denied', s.x, 1.1, -80, 0.5);
  }, true);
  L.vignette('core_scan_done', () => {
    if (!scanning || chosen) return;
    chosen = scanning; scanning = null; focus = chosen;
    for (const s of stations) { s.failT = 0; plateSet(s, armed(s)); }
    L.sfx('terminal_beep', stationOf(chosen).x, 1.1, -80, 0.9);
  }, true);
  // ── STOP: the cells die one by one on CHOIR's count; after the third the room is on its battery ──
  const cellOut = () => {
    if (out >= 3) return;
    const i = out++;
    const [x, z] = CELLS[i];
    const from = cellMats[i].emissiveIntensity;
    L.tween(0, 0.5, (k) => { cellMats[i].emissiveIntensity = from * (1 - easeInOut(k)); });
    L.sfx('cell_pull', x, 1.2, z, 0.9);
    L.sfx('power_down', x, 3, z, 0.8, 0.9 - i * 0.1);
    if (out < 3) return;
    L.after(0.4, () => {
      lights.setGroup('core', { enabled: false });
      lights.setGroup('core_battery', { enabled: true });
      ringMat.emissiveIntensity = 0;
      for (const s of stations) { s.ring.emissiveIntensity = 0; s.trim.emissiveIntensity = 0; plateSet(s, 'off'); }
      const all = ['core_wall_1', 'core_wall_2', 'core_wall_3', 'core_wall_4', 'core_eye', 'core_pedestal'];
      for (const n of all) { const m = L.screens.get(n); if (m) L.ctx.materials.setScreen(m, 'static'); }
      L.after(1.5, () => { for (const n of all) { const m = L.screens.get(n); if (m) m.emissiveIntensity = 0; } });
    });
  };
  L.vignette('core_cell_out', cellOut, true);
  L.vignette('core_cells_out', () => { for (let i = 0; i < 3; i++) L.after(i * 1.4, cellOut); });

  buildLift(L);
}

/** The service lift (room `lift`, door `d2_lift` at z −88). Stage 3a §8.9: `y0` = its floor (default 0). */
export function buildLift(L: LevelBuild, o: { y0?: number } = {}) {
  const y0 = o.y0 ?? 0;
  const b = L.builder('lift');
  const Hh = 3.0;
  L.room('lift', '서비스 리프트', -2, 2, -93, -88, Hh, { y0 });
  b.push(0, y0, 0, 0);
  floorSlab(b, 'floor_plate', -2, -93, 2, -88, [], 'metal', 0.3);
  ceilingSlab(b, -2.2, -93.2, 2.2, -88, Hh, 'trim_steel');
  const st = { h: Hh, t: 0.2, style: 'plain' as const, trayY: 0, features: 0, bay: 1.2 };
  wallFace(b, { ...st, n: '-z', plane: -88.2, from: -2, to: 2, openings: [{ c: 0, w: 1.6, h: 2.4 }], seed: 296 });
  wallFace(b, { ...st, n: '+z', plane: -93, from: -2, to: 2, seed: 297 });
  wallFace(b, { ...st, n: '+x', plane: -2, from: -93, to: -88.2, seed: 298 });
  wallFace(b, { ...st, n: '-x', plane: 2, from: -93, to: -88.2, seed: 299 });
  // the cab interior (dynamic, so it can rattle)
  const cb = L.part('lift:cab');
  cb.push(0, y0, 0, 0);
  for (const x of [-1.85, 1.85]) handrail(cb, 'chrome', [[x, 0, -88.7], [x, 0, -92.6]], 1.0, 1.4, false);
  handrail(cb, 'chrome', [[-1.85, 0, -92.75], [1.85, 0, -92.75]], 1.0, 1.4, false);
  cb.box('hazard_stripes', 0, 0.003, -88.55, 1.8, 0.006, 0.18);
  for (const [x, f] of [[-1.94, '+x'], [1.94, '-x']] as const) for (let z = -88.8; z > -92.9; z -= 0.8) panelOn(cb, 'trim_steel', x, 1.5, z - 0.4, 0.72, 2.6, f, 0.012, 0.02);
  // control panel (east wall)
  cb.box('painted_dark', 1.89, 1.42, -89.4, 0.1, 0.74, 0.7);
  cb.cyl('emissive_green', 1.83, 1.15, -89.4, 0.035, 0.03, 'x', 12);
  const cab = cb.build(false);
  cab.name = 'lift_cab';
  cab.userData.rooms = ['lift'];
  for (const m of cab.children) m.castShadow = true;
  L.root.add(cab);
  L.objects.set('lift_cab', cab);
  L.ctx.physics.addMover?.(cab); // REVISION 5.2: decals on the cab panels rattle with it
  // (in FRONT of its housing — it used to sit inside the box — and large enough to read from the cab's middle:
  // after the choice it carries the node line, REVISION 6)
  L.screen('lift_panel', 'terminal_idle', 0.6, 0.36, 1.84 - 0.008, y0 + 1.55, -89.4, '-x', { text: '서비스 리프트\n상행' });
  L.interact('lift_button', 'button', '리프트 호출', 1.75, y0 + 1.15, -89.4, true, 1.8);
  const lamp = L.spot('lift', 0, y0 + Hh - 0.15, -90.5, 0, y0, -90.5, 0xeef4ff, 26, 5, 1.2, { cast: true });
  const lm = L.glow(lamp, 'emissive_white');
  b.detail(() => b.box(lm, 0, Hh - 0.03, -90.5, 1.4, 0.03, 1.4));
  b.pop();
  let state: MachineState = 'off';
  L.machines.set('l2_lift', (s) => { state = s; });
  L.ambient('lift', (_dt, t) => {
    if (state !== 'active' && state !== 'frenzy') { if (cab.position.y !== 0) cab.position.set(0, 0, 0); return; }
    const k = state === 'frenzy' ? 2 : 1;
    cab.position.set(Math.sin(t * 53) * 0.002 * k, Math.sin(t * 41) * 0.004 * k, 0);
    lamp.intensityScale = 0.85 + 0.15 * Math.sin(t * 13);
  });
}
