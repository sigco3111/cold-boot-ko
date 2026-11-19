/** FREIGHT LOBBY — x -4…4, z -58…-50, h 3.6. The staff's barricade, bodies under tarps, the lobby screen. */
import { rng } from '../builder';
import type { LevelBuild } from '../context';
import { cableBundle, floorSlab, ibeam, pipe } from '../kit';
import { bench, boots, chair, crate, desk, drapedBody, drum, locker, monitorBezel, papers, weldedPlate } from '../props';
import { beacon, ceilingSlab, troffer, wallFace, workLight } from '../structure';
import * as THREE from 'three';
import { scrawlMaterial } from '../scrawl';
import { notePaper } from './quarters';
import { drapeGeo, easeInOut } from '../ambient';

const PI = Math.PI;

export function buildLobby(L: LevelBuild) {
  const b = L.builder('lobby');
  const R = rng(909);
  const H = 3.6;
  L.room('lobby', '화물 로비', -4, 4, -58, -50, H);

  floorSlab(b, 'floor_plate', -4, -58, 4, -50, [], 'metal');
  ceilingSlab(b, -4.2, -58, 4.2, -50, H);
  wallFace(b, { n: '-z', plane: -50.2, from: -4, to: 4, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 71, trayY: 0 });
  wallFace(b, { n: '+z', plane: -57.8, from: -4, to: 4, h: H, t: 0.2, openings: [{ c: 0, w: 3.0, h: 2.8 }], seed: 72, trayY: 0 });
  wallFace(b, { n: '+x', plane: -4, from: -57.8, to: -50.2, h: H, seed: 73, features: 0.3, clear: [[-57, -54]] });
  wallFace(b, { n: '-x', plane: 4, from: -57.8, to: -50.2, h: H, seed: 74, features: 0.4 });
  for (const z of [-52, -54, -56]) ibeam(b, 'trim_steel', 'x', 0, H - 0.12, z, 8, 0.14, 0.24);
  b.detail(() => {
    pipe(b, 'copper', [[3.6, H - 0.35, -50.4], [3.6, H - 0.35, -57.6]], 0.05, { every: 1.8 });
    cableBundle(b, [-2, H - 0.26, -52.1], [-2, H - 0.26, -53.9], 3, 0.12, 0.015, 0.05, R);
    cableBundle(b, [-2, H - 0.26, -54.1], [-2, H - 0.26, -55.9], 3, 0.2, 0.015, 0.05, R);
  });

  // ── the barricade (faces the fab door, gap on the east side) ──
  const BZ = -53.2;
  b.push(-2.9, 0.25, BZ, 0.06, 0, PI / 2); locker(b, 0, 'wall_panel', 0.5, 2.0, 0.5, false); b.pop();          // locker on its side
  b.push(-2.6, 0.76, BZ - 0.05, -0.08, 0, PI / 2); locker(b, 0.3, 'wall_panel_dark', 0.5, 2.0, 0.5, false); b.pop();
  b.push(-0.6, 0.42, BZ + 0.1, 0.05, PI / 2, 0); desk(b, 1.7, 0.85, 0.76, false); b.pop();                       // desk tipped on its front
  b.push(1.15, 0.42, BZ - 0.02, -0.1, PI / 2, 0); desk(b, 1.6, 0.8, 0.76, false); b.pop();
  b.at(0.3, 0, BZ + 0.48, 0.04, () => weldedPlate(b, 1.7, 1.25, R, 'steel_raw'));
  b.at(-1.6, 0, BZ + 0.5, -0.05, () => weldedPlate(b, 1.4, 1.1, R));
  b.at(1.9, 0, BZ + 0.44, 0.1, () => weldedPlate(b, 1.2, 1.35, R, 'trim_steel'));
  b.at(2.25, 0, BZ - 0.1, 0.3, () => crate(b, 0.8, 0.7, 0.7, 'painted_dark', '할시온', false));
  b.at(2.2, 0.7, BZ - 0.1, -0.2, () => crate(b, 0.6, 0.45, 0.5, 'wall_panel', undefined, false));
  b.at(-3.65, 0, BZ + 0.1, 0, () => drum(b, 'painted_orange', false));
  b.push(-1.1, 1.05, BZ - 0.1, 0.8, 0.5, 2.6); chair(b); b.pop();
  b.push(0.9, 1.0, BZ, 2.2, -0.4, 1.9); chair(b); b.pop();
  b.detail(() => {
    // rebar / pipe spears through the pile, wire
    b.rod('rust', -2.2, 0.3, BZ - 0.5, -1.6, 1.5, BZ + 0.7, 0.02, 5);
    b.rod('rust', 0.2, 0.2, BZ - 0.6, 0.9, 1.45, BZ + 0.75, 0.02, 5);
    b.rod('steel_raw', 1.5, 0.3, BZ - 0.5, 1.2, 1.6, BZ + 0.7, 0.025, 5);
    cableBundle(b, [-3.6, 1.0, BZ + 0.3], [2.4, 1.2, BZ + 0.35], 2, 0.15, 0.008, 0.04, R, ['steel_raw']);
  });
  b.collide(-3.95, 0, BZ - 0.45, 2.65, 1.3, BZ + 0.5);
  b.sign('출입 금지', 'stencil', 0.3, 0.8, BZ + 0.5, 1.2, 0.3, '+z', 0.05);
  b.decal('scorch', 0, -1.0, 0.003, -51.8, 1.6, 1.6, '+y', 0.4);
  b.decal('scorch', 3, 1.4, 0.003, -52.0, 1.2, 1.2, '+y', 1.4);
  b.decal('scratches', 0, 3.3, 0.003, -53.2, 1.2, 1.6, '+y');

  // ── behind it: bodies under tarps, blood, last stand ──
  b.at(-1.9, 0, -55.3, 0.4, () => { drapedBody(b, 'fabric', 0.95); b.at(0, 0, 1.0, 0, () => boots(b)); });
  b.at(-0.7, 0, -55.6, 0.15, () => drapedBody(b, 'rubber', 0.9));
  b.at(0.2, 0, -55.75, -0.2, () => { drapedBody(b, 'fabric', 1.0); b.at(-0.02, 0, 1.06, 0, () => boots(b)); });
  b.decal('blood_pool', 0, -1.3, 0.003, -55.0, 1.8, 1.4, '+y', 0.3);
  b.decal('blood_pool', 1, 0.7, 0.003, -55.9, 1.3, 1.1, '+y', 2.0);
  b.decal('blood_smear', 0, 2.9, 0.003, -54.2, 0.7, 1.8, '+y', 0.2);
  b.decal('blood_smear', 1, 1.9, 0.003, -55.2, 0.7, 1.8, '+y', 1.1);
  b.decal('blood_splat', 2, -3.964, 1.3, -54.6, 0.9, 0.9, '+x');
  b.decal('handprint', 1, -3.964, 1.0, -55.3, 0.24, 0.24, '+x', 0.3);
  b.decal('blood_smear', 2, 0.9, 0.003, -57.2, 0.6, 1.2, '+y', 0.0);
  b.at(-3.6, 0, -56.6, PI / 2, () => bench(b, 1.6));
  L.pickup('p_lobby_med', 'medkit', -3.6, 0.46, -56.6, 35, 0.2);
  b.at(-3.3, 0, -54.5, 0.1, () => crate(b, 0.8, 0.6, 0.6, 'painted_dark', '에리두 SEC'));
  L.pickup('p_lobby_shells', 'ammo_shotgun', -3.3, 0.6, -54.5, 6, 0.4);
  b.at(3.2, 0, -56.8, -0.2, () => crate(b, 0.9, 0.5, 0.7, 'wall_panel_dark', 'FREIGHT'));
  L.pickup('p_lobby_ammo', 'ammo_pistol', 3.2, 0.5, -56.8, 12, 0.7);
  b.at(1.5, 0, -56.6, 0, () => papers(b, 8, 0.8, R));
  b.detail(() => { for (let i = 0; i < 22; i++) b.rbox('brass', R.range(-3, 2.5), 0.006, R.range(-55, -53.9), 0.02, 0.01, 0.01, 0, R.range(0, 6), 0); });
  // a work light they dragged in, fallen over and dead
  b.push(2.6, 0.2, -54.9, 1.0, 0, PI / 2 - 0.1);
  for (let i = 0; i < 3; i++) { const a = (i * 2 * PI) / 3; b.rod('painted_yellow', 0, 0.9, 0, Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5, 0.016, 6); }
  b.rod('steel_raw', 0, 0.85, 0, 0, 1.65, 0, 0.02, 6); b.box('painted_yellow', 0, 1.7, 0, 0.5, 0.24, 0.12); b.box('screen_off', 0, 1.7, -0.062, 0.44, 0.19, 0.008);
  b.pop();

  // ── lobby screen (west wall) ──
  b.at(-4, 0, -55.6, PI / 2, () => monitorBezel(b, 0, 2.05, 1.7, 0.95, 0.1));
  L.screen('lobby_screen', 'static', 1.7, 0.95, -3.898, 2.05, -55.6, '+x');
  L.point('lobby', -3.2, 2.0, -55.6, 0x8fb8ff, 3.5, 5.5, { flicker: 'broken' });

  // ── lights (dark until the story turns the group on) ──
  let gm: THREE.Material | undefined;
  gm = (troffer(b, L, { group: 'lobby', x: 0, y: H, z: -55.2, axis: 'x', intensity: 60, distance: 8, angle: 1.05, cast: true, enabled: false }) as any).glowMat;
  troffer(b, L, { group: 'lobby', x: 0, y: H, z: -51.6, axis: 'x', intensity: 40, distance: 7, angle: 1.0, enabled: false, flicker: 'broken' });
  let bm: THREE.Material | undefined;
  bm = (beacon(b, L, 'lobby_emergency', -3.6, H, -50.7, -1, 0xff2a12, 48, 9) as any).glowMat;
  beacon(b, L, 'lobby_emergency', 3.6, H, -57.3, -1, 0xff2a12, 48, 9, 'emissive_red', false, 'alarm', bm);
  beacon(b, L, 'lobby_emergency', 0, H, -54.4, -1, 0xff2a12, 40, 8, 'emissive_red', false, 'alarm', bm);
  void gm; void workLight;

  b.sign('화물 로비', 'stencil', 3.964, 2.5, -54, 2.0, 0.34, '-x');
  b.sign('화물 엘리베이터', 'stencil', 0, 0.004, -56.4, 3.0, 0.4, '+y');
  b.sign('최대 적재 12 t — 화물과 동승 금지', 'warning', 2.9, 2.5, -57.764, 1.1, 0.16, '+z', 0, true);
  // painted beside the gate, by somebody who rode it
  b.quad(scrawlMaterial(['위로 안 가.', '절대 위로 안 가.'], { style: 'paint', aspect: 1.9, seed: 21, color: '#a5241a' }), 2.92, 1.66, -57.762, 1.85, 0.97, '+z', -0.03, 'unit', 0.004);
  // note_lobby: a sheet taped to the inside of the barricade, on the crate by the gap
  b.detail(() => { b.push(2.18, 1.155, BZ - 0.12, -0.2); b.quad(notePaper(['엘리베이터', '이제는', '한 방향으로만', '간다'], 13, 0.75), 0, 0, 0, 0.2, 0.27, '+y', 0, 'unit', 0.003); b.box('steel_raw', 0.05, 0.012, -0.1, 0.06, 0.02, 0.04); b.pop(); });
  L.interact('note_lobby', 'log', '쪽지 읽기', 2.18, 1.2, BZ - 0.12, true, 2.3);
  b.sign('수면 수송 중단 — CHOIR 명령', 'danger', -2.6, 1.8, -57.764, 1.2, 0.16, '+z', 0, true);
  b.decal('grime', 2, 0, 0.003, -51.5, 3, 2, '+y');

  L.enemy('g_lobby', 'husk', 'dormant', -1.7, 0, -54.05, 0, 'slumped');
  const TXp = 1.3, TZp = -54.1, TRY = 0.25;
  L.enemy('g_lobby', 'husk', 'dormant', TXp, 0, TZp, TRY, 'slumped');

  // ── the tarp over that second android: one more covered shape among the dead, until it sits up ──
  {
    // tent over a seated figure. Local frame: +Z = behind it (the barricade), -Z = its legs.
    const g = drapeGeo([
      [0, 0.86, 0.6, 0.2, 0.24, 0.2], [0, 0.5, 0.52, 0.34, 0.5, 0.26], [0.14, 0.3, 0.05, 0.17, 0.42, 0.3], [-0.12, 0.14, -0.1, 0.17, 0.24, 0.5],
      [-0.15, 0.14, -0.58, 0.14, 0.24, 0.17], [0.2, 0.12, -0.45, 0.13, 0.2, 0.2], [0.38, 0.3, 0.45, 0.14, 0.3, 0.2], [-0.38, 0.28, 0.45, 0.14, 0.3, 0.22],
    ], -0.8, 0.8, -1.0, 0.95, 24, 28, 3.4);
    const tarpMat = L.ctx.materials.clone('fabric', { color: 0x4a5a60, side: THREE.DoubleSide }); tarpMat.name = 'lobby_tarp';
    const tarp = new THREE.Mesh(g, tarpMat);
    tarp.name = 'lobby_tarp';
    tarp.castShadow = true; tarp.receiveShadow = true;
    // the husk leans back to the barricade (see Husk.snapToWall): centre the tent between its head and feet
    const cs = Math.cos(TRY), sn = Math.sin(TRY);
    const place = (lx: number, lz: number) => tarp.position.set(TXp + lx * cs + lz * sn, 0, TZp - lx * sn + lz * cs);
    place(0, -0.42);
    tarp.rotation.y = TRY;
    L.root.add(tarp);
    L.objects.set('lobby_tarp', tarp);
    let off = false;
    // lobby_tarp: whatever is under it shifts its weight, and the cloth settles again
    L.vignette('lobby_tarp', () => {
      if (off) return;
      L.sfx('body_fall', TXp, 0.4, TZp, 0.25, 1.5);
      L.tween(0, 0.5, (k) => { const e = Math.sin(k * PI); tarp.scale.set(1 + e * 0.03, 1 + e * 0.09, 1 - e * 0.02); tarp.rotation.y = TRY + e * 0.07; tarp.rotation.z = e * 0.035; });
      L.tween(0.5, 1.6, (k) => { const e = Math.sin(k * PI * 3) * (1 - k) * (1 - k); tarp.scale.y = 1 + e * 0.035; tarp.rotation.y = TRY + e * 0.02 + 0.012 * k; tarp.rotation.z = e * 0.012; });
    });
    // it wakes: the tarp is shouldered up, slides off sideways and collapses flat beside it
    const slide = () => {
      if (off) return;
      off = true;
      L.sfx('body_fall', TXp, 0.5, TZp, 0.35, 1.2);
      L.tween(0, 0.45, (k) => { const e = easeInOut(k); tarp.scale.y = 1 + 0.16 * e; tarp.rotation.z = 0.1 * e; });
      L.tween(0.45, 1.0, (k) => {
        const e = k * k;
        place(-0.95 * easeInOut(k), -0.42 - 0.25 * e);
        tarp.scale.set(1 + 0.12 * e, Math.max(0.1, 1.16 - 1.06 * e), 1 - 0.1 * e);
        tarp.rotation.z = 0.1 + 0.3 * Math.sin(k * PI);
        tarp.rotation.y = TRY - 0.5 * e;
      }, () => { tarp.rotation.z = 0; });
      L.tween(1.45, 0.7, (k) => { tarp.scale.y = 0.1 + Math.sin(k * PI) * 0.03 * (1 - k); });
    };
    L.ctx.events.on('enemy:woke', (e) => { if (e.type === 'husk' && Math.abs(e.position.x - TXp) < 1.2 && Math.abs(e.position.z - TZp) < 1.2) slide(); });
    L.ctx.events.on('enemy:damaged', (e) => { if (e.type === 'husk' && Math.abs(e.point.x - TXp) < 1.0 && Math.abs(e.point.z - TZp + 0.3) < 1.3) slide(); });
  }
  L.enemy('g_lobby', 'sentry', 'dormant', 0, 3.0, -56.3, PI, 'ceiling');
  L.ctx.fx.emitter('dust', L.vec(0, 2, -55), L.vec(0, -1, 0), 4);
}
