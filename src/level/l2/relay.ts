/**
 * SECTION C RELAY — x 10…18, z -66…-56, h 3.6. Dark. Contactor cabinets, the section C switch, a slumped
 * unit, a floor trench (where the skitters come from). relay_arc: the contactor closes with an arc flash
 * and the cabinets light up one after another.
 */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { bolts4, cableBundle, floorSlab, hazardStrip, panel, pipe, trench } from '../kit';
import { switchgear } from '../props';
import { bulkhead, ceilingSlab, troffer, wallFace } from '../structure';
import { scrawlMaterial } from '../scrawl';
import { easeIn } from '../ambient';

const PI = Math.PI;
const H = 3.6;

export function buildRelay(L: LevelBuild) {
  const b = L.builder('relay');
  const R = rng(2701);
  L.room('relay', '구역 C 중계', 10, 18, -66, -56, H);
  const tr: [number, number, number, number] = [11.0, -57.6, 17.4, -57.0];
  floorSlab(b, 'floor_plate', 10, -66, 18, -56, [tr], 'metal');
  trench(b, tr[0], tr[1], tr[2], tr[3], 0.55, R, false);
  ceilingSlab(b, 10.0, -66.4, 18.4, -55.6, H); // behind the hall's wall face
  wallFace(b, { n: '+x', plane: 10.2, from: -65.8, to: -56.2, h: H, t: 0.2, seed: 271, openings: [{ c: -61, w: 1.6, h: 2.4 }], style: 'dark', features: 0.3 });
  wallFace(b, { n: '-x', plane: 18, from: -66, to: -56, h: H, seed: 272, style: 'dark', features: 0, clear: [[-65.8, -56.2]] });
  wallFace(b, { n: '-z', plane: -56, from: 10.2, to: 18, h: H, seed: 273, style: 'dark', features: 0, clear: [[10.2, 18]] });
  wallFace(b, { n: '+z', plane: -66, from: 10.2, to: 18, h: H, seed: 274, style: 'dark', features: 0.2, clear: [[11, 14]] });

  // ── contactor cabinets: a row on the north wall, a row on the east wall ──
  const cabinets: { x: number; z: number; ry: number }[] = [];
  for (let i = 0; i < 6; i++) cabinets.push({ x: 11.3 + i * 0.95, z: -56.4, ry: PI });
  for (let i = 0; i < 4; i++) cabinets.push({ x: 17.6, z: i < 2 ? -57.35 - i * 0.95 : -62.55 - (i - 2) * 0.95, ry: -PI / 2 });
  for (const c of cabinets) b.at(c.x, 0, c.z, c.ry, () => { switchgear(b, R, 0.9, 2.3, 0.7, 0.15); b.collide(-0.45, 0, -0.35, 0.45, 2.3, 0.35); });
  // light bars across every cabinet top (off until the arc)
  const bars: THREE.MeshStandardMaterial[] = [];
  for (const c of cabinets) {
    const m = L.ctx.materials.clone('emissive_green');
    m.emissiveIntensity = 0.0;
    bars.push(m);
    b.at(c.x, 0, c.z, c.ry, () => b.detail(() => { b.box('painted_dark', 0, 2.2, 0.39, 0.76, 0.06, 0.03); b.box(m, 0, 2.2, 0.408, 0.68, 0.025, 0.008); }));
  }
  // ── the section C switch: big two-handed contactor on the east wall ──
  const SX = 17.75, SZ = -60.9;
  b.at(SX, 0, SZ, -PI / 2, () => {
    b.box('wall_panel_dark', 0, 1.2, -0.15, 1.6, 2.4, 0.5);
    b.box('trim_steel', 0, 2.43, -0.15, 1.66, 0.06, 0.56);
    b.detail(() => {
      panel(b, 'painted_yellow', -0.6, 0.6, 0.6, 2.0, 0.1, 0.03, 0.03);
      b.box('hazard_stripes', 0, 1.3, 0.132, 0.9, 1.0, 0.004);
      b.box('painted_dark', 0, 1.3, 0.14, 0.34, 0.9, 0.02);
      b.sign('구역 C — 주 접촉기', 'danger', 0, 2.15, 0.102, 1.2, 0.16, '+z', 0, true);
      b.sign('닫힘', 'label', 0.32, 0.95, 0.134, 0.2, 0.07, '+z');
      b.sign('열림', 'label', 0.32, 1.65, 0.134, 0.2, 0.07, '+z');
      for (let i = 0; i < 5; i++) b.rod('rubber', -0.6 + i * 0.3, 2.45, -0.15, -0.6 + i * 0.3, H, -0.15, 0.035, 6);
      bolts4(b, -0.78, 0.05, 0.78, 2.35, 0.101);
    });
    b.collide(-0.8, 0, -0.4, 0.8, 2.4, 0.11);
  });
  const lever = new THREE.Group();
  lever.name = 'relay_switch';
  lever.position.set(SX - 0.22, 1.3, SZ);
  lever.rotation.y = -PI / 2;
  const lb = L.part('relay:lever');
  lb.cyl('steel_raw', 0, 0, 0, 0.07, 0.36, 'x', 12);
  for (const s of [-1, 1]) lb.box('steel_raw', s * 0.15, 0.32, 0, 0.035, 0.66, 0.06);
  lb.cyl('painted_orange', 0, 0.64, 0, 0.04, 0.46, 'x', 10);
  for (const s of [-1, 1]) lb.sphere('rubber', s * 0.24, 0.64, 0, 0.05, 8);
  const arm = lb.build(false);
  const OPEN = 0.6, CLOSED = 2.45;
  arm.rotation.x = OPEN;
  for (const m of arm.children) m.castShadow = true;
  lever.add(arm);
  lever.userData.rooms = ['relay'];
  L.root.add(lever);
  L.objects.set('relay_switch', lever);
  L.interact('relay_switch', 'lever', '구역 C 차단', SX - 0.45, 1.35, SZ, true, 2.4);
  const thrown = { v: false };
  L.ctx.events.on('interact', (e) => {
    if (e.id !== 'relay_switch' || thrown.v) return;
    thrown.v = true;
    L.tween(0.15, 0.5, (k) => { arm.rotation.x = OPEN + (CLOSED - OPEN) * (k < 0.8 ? easeIn(k / 0.8) : 1 + Math.sin(((k - 0.8) / 0.2) * PI) * 0.03); }, () => L.sfx('lever', SX, 1.3, SZ, 1));
  });
  L.screen('relay_panel', 'terminal_alert', 0.5, 0.3, SX - 0.19, 1.82, SZ + 0.55, '-x', { text: '구역 C\n무전압' });
  // ── the cabinet with its door open, a note taped inside ──
  const NX = 12.6, NZ = -65.6;
  b.at(NX, 0, NZ, 0, () => {
    switchgear(b, R, 0.9, 2.3, 0.7, 0.05);
    b.collide(-0.45, 0, -0.35, 0.45, 2.3, 0.35);
  });
  // open door hinged on its left edge, swung out ~110°
  b.push(NX - 0.45, 0, NZ + 0.36, -1.9);
  b.box('wall_panel_dark', 0.42, 1.2, -0.012, 0.84, 2.1, 0.024);
  b.detail(() => {
    b.box('trim_steel', 0.42, 1.2, -0.03, 0.8, 2.0, 0.008);
    b.quad(scrawlMaterial(['구역 C', '이걸 닫으면', '전부 열린다', '— T.'], { style: 'pen', aspect: 0.21 / 0.28, px: 512, seed: 77, bg: (g, W, H2) => { g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, W, H2); } }), 0.42, 1.45, -0.036, 0.21, 0.28, '-z', 0.04);
    b.box('plastic_white', 0.42, 1.6, -0.037, 0.06, 0.02, 0.002);
  });
  b.pop();
  L.interact('note2_relay', 'log', '쪽지 읽기', 12.95, 1.45, -65.3, true, 2.0);
  // ── the slumped unit (g2_relay) against the south wall; the skitters come out of the trench ──
  L.enemy('g2_relay', 'husk', 'dormant', 15.4, 0, -65.4, PI, 'slumped', 'watch');
  L.enemy('g2_relay', 'skitter', 'spawn', 12.2, -0.3, -57.3, PI / 2);
  L.enemy('g2_relay', 'skitter', 'spawn', 16.6, -0.3, -57.3, -PI / 2);
  b.decal('oil_stain', 2, 15.4, 0.003, -65.0, 1.4, 1.2, '+y', 0.3);
  b.decal('scorch', 1, 17.4, 1.3, -60.9, 1.2, 1.4, '-x');
  // ── services, cable runs in the ceiling, hazard markings ──
  b.detail(() => {
    for (let i = 0; i < 3; i++) pipe(b, i === 1 ? 'copper' : 'steel_raw', [[10.4, H - 0.25 - i * 0.18, -56.4], [17.6, H - 0.25 - i * 0.18, -56.4]], 0.05 - i * 0.01, { every: 1.8 });
    cableBundle(b, [12, H - 0.15, -58], [16, H - 0.15, -63], 5, 0.4, 0.025, 0.08, R);
    hazardStrip(b, 16.6, -62.0, 17.0, -59.8);
  });
  b.sign('구역 C 중계', 'stencil', 14.2, 2.9, -65.795, 2.6, 0.4, '+z');
  b.sign('11 kV — 인가된 인원만', 'danger', 10.22, 2.1, -58.4, 1.5, 0.2, '+x', 0, true);
  // pickups
  L.pickup('p2_relay_shells', 'ammo_shotgun', 11.0, 0, -63.0, 6, 0.4);
  L.pickup('p2_relay_med', 'medkit', 16.8, 0, -65.2, 35, 0.2);

  // ── light: off. A red standby lamp by the door; the main fittings wake with the contactor ──
  b.at(10.2, 0, -59.0, PI / 2, () => bulkhead(b, L, 'relay', 0, 2.5, 0, 0xff3018, 3.5, 5, 'emissive_red', { flicker: 'pulse' }));
  b.at(14.2, 0, -66, 0, () => bulkhead(b, L, 'relay', 0, 2.6, 0, 0xff3018, 2.5, 4.5, 'emissive_red', { flicker: 'pulse' }));
  const mains: ReturnType<LevelBuild['spot']>[] = [];
  for (const [x, z] of [[12.5, -59], [15.5, -59], [12.5, -63], [15.5, -63]] as const) {
    const h = troffer(b, L, { group: 'relay', x, y: H, z, axis: 'x', len: 1.2, intensity: 34, distance: 6.5, angle: 1.1, color: 0xd8ecff, enabled: false, cast: x === 15.5 && z === -63 });
    if (h) mains.push(h);
  }
  L.vignette('relay_arc', () => {
    const fx = L.ctx.fx, p = new THREE.Vector3(SX - 0.25, 1.35, SZ), q = new THREE.Vector3(SX - 0.25, 1.9, SZ - 0.4);
    fx.arc(p, q, 0.6);
    fx.flash(p, 0xbfe6ff, 220, 0.25, 9);
    fx.sparks(p, new THREE.Vector3(-1, 0.3, 0), 40, 6);
    fx.smoke(p, { count: 6, size: 0.4, color: 0x7a7670, rise: 0.5, life: 2.5 });
    L.sfx('contactor_arc', SX, 1.4, SZ, 1);
    L.ctx.player?.shake(0.35);
    L.ctx.materials.setScreen(L.screens.get('relay_panel')!, 'terminal_idle', { text: '구역 C\n급전됨 · 라인 리셋' });
    // cabinets come up one after another, away from the switch
    const order = cabinets.map((c, i) => ({ i, d: Math.hypot(c.x - SX, c.z - SZ) })).sort((a, c) => a.d - c.d);
    order.forEach((o, k) => L.after(0.25 + k * 0.16, () => { bars[o.i].emissiveIntensity = 2.5; L.sfx('button', cabinets[o.i].x, 2.1, cabinets[o.i].z, 0.4, 0.8 + k * 0.05); }));
    L.after(0.4 + order.length * 0.16, () => { for (const h of mains) h.enabled = true; L.sfx('power_up', 14, 3, -61, 0.7); });
  });
}
