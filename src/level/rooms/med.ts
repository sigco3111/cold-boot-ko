/** MEDICAL 3-A — the start room. x -5…5, z 0…10, h 3.2. */
import * as THREE from 'three';
import { rng } from '../builder';
import { Curtains, Swing, hangingBundle, easeInOut } from '../ambient';
import { scrawlMaterial } from '../scrawl';
import type { LevelBuild } from '../context';
import { cable, ductRect, floorSlab, hose, lathe, pipe, trench } from '../kit';
import { bed, boots, counter, curtainGeo, drapedBody, fireExtinguisher, gurney, ivStand, locker, mug, papers, privacyScreen, tablet, vitalsStand, wallCabinet, wallTerminal } from '../props';
import { ceilingSlab, troffer, wallFace } from '../structure';

const PI = Math.PI;

export function buildMed(L: LevelBuild) {
  const b = L.builder('med');
  const R = rng(101);
  const H = 3.2;
  L.room('med', '의무실 3-A', -5, 5, 0, 10, H);

  floorSlab(b, 'floor_rubber', -5, 0, 5, 10, [[-2.3, 4.7, -1.7, 5.3]], 'rubber');
  trench(b, -2.3, 4.7, -1.7, 5.3, 0.3, R, true);
  ceilingSlab(b, -5.2, 0, 5.2, 10.2, H);

  wallFace(b, { n: '+z', plane: 0.2, from: -5, to: 5, h: H, t: 0.2, openings: [{ c: 0, w: 1.6, h: 2.4 }], style: 'medical', seed: 1, clear: [[1.2, 2.4]] });
  wallFace(b, { n: '-z', plane: 10, from: -5, to: 5, h: H, style: 'medical', seed: 2, features: 0 });
  wallFace(b, { n: '+x', plane: -5, from: 0.2, to: 10, h: H, style: 'medical', seed: 3, features: 0.25 });
  wallFace(b, { n: '-x', plane: 5, from: 0.2, to: 10, h: H, style: 'medical', seed: 4, features: 0.25 });

  // ── ceiling: beams, duct, curtain rails ──
  for (const z of [2.5, 5.0, 7.5]) b.box('trim_steel', 0, H - 0.08, z, 10, 0.16, 0.12);
  ductRect(b, 'steel_raw', 'z', -3.6, H - 0.19, 5.1, 9.6, 0.6, 0.3, 1.6);
  b.detail(() => {
    for (const z of [2.0, 6.2]) { b.box('painted_dark', -3.6, H - 0.36, z, 0.5, 0.04, 0.5); b.box('trim_steel', -3.6, H - 0.385, z, 0.4, 0.012, 0.4); }
    // curtain rails
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      b.rod('chrome', x0, 2.25, z0, x1, 2.25, z1, 0.012, 5);
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2));
      for (let i = 0; i <= n; i++) { const t = i / n; b.rod('chrome', x0 + (x1 - x0) * t, 2.25, z0 + (z1 - z0) * t, x0 + (x1 - x0) * t, H, z0 + (z1 - z0) * t, 0.006, 4); }
    };
    rail(-4.95, 3.1, -2.7, 3.1); rail(-4.95, 5.7, -2.7, 5.7); rail(-2.7, 0.5, -2.7, 8.4);
    rail(4.95, 3.1, 2.7, 3.1); rail(2.7, 0.5, 2.7, 5.6); rail(4.95, 5.6, 2.7, 5.6);
    // the privacy curtains are one instanced mesh that breathes (see ambient.ts)
    const cur = new Curtains(L, 'med', L.doubleSided('fabric'));
    cur.add(-4.3, 2.23, 3.1, 0, 1.2, 1.9).add(-3.85, 2.23, 5.7, 0, 2.1, 1.9, 1.3).add(-2.7, 2.23, 7.5, PI / 2, 1.6, 1.9);
    cur.add(4.45, 2.23, 3.1, 0, 0.9, 1.9).add(2.7, 2.23, 1.2, PI / 2, 1.2, 1.9, 1.2);
    cur.finish();
    // sprinkler pipe
    pipe(b, 'painted_orange', [[4.2, H - 0.12, 0.3], [4.2, H - 0.12, 9.9]], 0.022, { flanges: false });
    for (const z of [1.5, 4.0, 6.5, 9.0]) { b.cyl('brass', 4.2, H - 0.18, z, 0.012, 0.08, 'y', 6); b.cyl('brass', 4.2, H - 0.23, z, 0.03, 0.006, 'y', 8); }
  });

  // ── lights: one working fixture near the door, one dying at the back, monitor glow ──
  troffer(b, L, { group: 'med', x: 0, y: H, z: 2.4, axis: 'z', intensity: 120, distance: 10.5, angle: 1.15, flicker: 'fluorescent', cast: true, priority: 3 });
  troffer(b, L, { group: 'med', x: -2.6, y: H, z: 8.8, axis: 'x', intensity: 55, distance: 7.5, angle: 1.05, flicker: 'broken' });
  for (const [x, z, ax] of [[-2.6, 2.4, 'x'], [2.6, 2.4, 'x'], [0, 6.3, 'z'], [2.6, 8.8, 'x'], [-2.6, 5.6, 'x']] as const) troffer(b, L, { group: 'med', x, y: H, z, axis: ax, dead: true });
  L.point('med', 0.45, 1.45, 8.25, 0x58ffb0, 4, 5, { flicker: 'pulse' });
  L.point('med', 1.7, 1.45, 0.75, 0xffb060, 2.0, 3.2);

  // ── the player's bay (bed in the middle of the ward, by the spawn) ──
  b.at(1.3, 0, 7.2, PI, () => bed(b, { sheet: true, mess: true }));
  L.marker('med_bed', 1.3, 0.72, 7.2, PI);
  b.at(2.05, 0, 8.15, 0.6, () => ivStand(b, true, 2));
  b.at(0.45, 0, 8.7, PI, () => vitalsStand(b));
  L.screen(null, 'vitals', 0.38, 0.28, 0.45, 1.38, 8.626, '-z');
  b.at(2.75, 0, 7.6, PI / 2 + 0.12, () => privacyScreen(b, L, 3, 0.8, 1.8));
  b.at(1.2, 0, 9.0, 0.1, () => privacyScreen(b, L, 2, 0.8, 1.8));
  b.collide(2.6, 0, 6.4, 2.9, 1.8, 8.8, 'rubber');
  // sedation line pulled out, lying across the mattress to the floor
  b.detail(() => {
    hose(b, 'plastic_white', [[1.95, 1.1, 8.1], [1.7, 0.8, 7.8], [1.3, 0.74, 7.5], [0.9, 0.7, 7.3], [0.75, 0.3, 7.2], [0.6, 0.01, 7.0]], 0.005, 4);
    // overhead exam lamp (dead), arm from the ceiling
    b.rod('painted_white', 1.9, H, 6.9, 1.9, 2.75, 6.9, 0.025, 6);
    b.sphere('painted_white', 1.9, 2.75, 6.9, 0.045, 8);
    b.rod('painted_white', 1.9, 2.75, 6.9, 1.45, 2.45, 7.15, 0.02, 6);
    b.sphere('painted_white', 1.45, 2.45, 7.15, 0.04, 8);
    b.push(1.45, 2.4, 7.15, 0, 0.35, 0.2);
    lathe(b, 'painted_white', [[0.03, 0.04], [0.1, 0.02], [0.26, -0.06], [0.28, -0.09], [0.26, -0.09]], 0, 0, 0, 16);
    b.cyl('screen_off', 0, -0.07, 0, 0.22, 0.01, 'y', 16);
    b.pop();
    b.decal('water_stain', 0, 0.55, 0.002, 6.9, 0.5, 0.5, '+y');
  });

  // ── west ward: three beds, heads to the wall ──
  b.at(-3.9, 0, 1.8, PI / 2, () => bed(b, { rails: true }));
  b.at(-3.9, 0, 4.4, PI / 2, () => bed(b, { rails: false, pillow: false }));
  b.at(-3.9, 0, 7.0, PI / 2, () => bed(b, { rails: true, sheet: true, mess: true }));
  // the body under the sheet
  b.at(-3.86, 0.61, 4.4, PI / 2, () => { b.push(0, 0, 0, 0, -0.03); drapedBody(b, 'fabric', 0.9); b.pop(); });
  b.decal('blood_pool', 0, -3.2, 0.001, 5.15, 1.0, 0.8, '+y', 0.4);
  b.decal('blood_splat', 1, -4.2, 0.002, 4.95, 0.5, 0.5, '+y', 1.2);
  b.decal('blood_smear', 0, -3.9, 0.84, 4.63, 0.6, 0.35, '+y', 0.2);
  b.at(-4.55, 0, 3.6, 0.3, () => ivStand(b, false, 1));
  b.at(-4.6, 0, 5.2, 0.5, () => vitalsStand(b));
  b.at(-4.5, 0, 7.9, 0.5, () => ivStand(b, true, 1));
  b.at(-4.55, 0, 0.9, 0.4, () => { vitalsStand(b); b.box('screen_off', 0, 1.38, 0.072, 0.38, 0.28, 0.004); });

  // ── east ward ──
  b.at(3.9, 0, 1.9, -PI / 2, () => bed(b, { rails: true, sheet: true }));
  b.at(3.9, 0, 4.4, -PI / 2 + 0.06, () => bed(b, { rails: false, pillow: true, mess: true }));
  b.at(4.55, 0, 3.2, -0.4, () => ivStand(b, false, 1));
  // IV stand knocked over
  b.push(2.2, 0.03, 3.5, 0.9, 0, PI / 2 - 0.02); ivStand(b, false, 1); b.pop();

  // ── the overturned gurney + drag marks to the door ──
  b.push(-1.25, 0.36, 2.9, 0.55, 0, PI / 2); gurney(b); b.pop();
  b.at(-1.25, 0, 2.9, 0.55, () => b.collide(-0.5, 0, -1.0, 0.45, 0.7, 1.0, 'metal'));
  b.decal('blood_pool', 1, -0.75, 0.001, 2.5, 1.1, 0.9, '+y', 2.0);
  b.decal('blood_smear', 0, -0.45, 0.002, 1.75, 0.8, 1.5, '+y', 0.25);
  b.decal('blood_smear', 1, -0.15, 0.002, 0.75, 0.7, 1.5, '+y', 0.1);
  b.decal('handprint', 0, -1.25, 1.15, 0.236, 0.24, 0.24, '+z', 0.4);
  b.decal('blood_smear', 2, -1.3, 0.75, 0.236, 0.4, 0.7, '+z', 0.1);
  b.at(0.6, 0, 3.6, 0, () => papers(b, 7, 0.7, R));
  b.at(-0.9, 0, 6.2, 0, () => papers(b, 4, 0.5, R));

  // ── back wall: counter, sink, cabinets, drug lockers ──
  b.at(-1.6, 0, 9.7, PI, () => counter(b, 4.2, true));
  b.at(-1.6, 0, 10, PI, () => wallCabinet(b, 4.2, 1.5, 0.75));
  b.at(1.2, 0, 10, PI, () => wallCabinet(b, 0.6, 1.45, 0.6, true));
  for (let i = 0; i < 3; i++) b.at(3.2 + i * 0.52, 0, 9.74, PI, () => locker(b, i === 1 ? 1.1 : 0, 'painted_white'));
  b.at(-2.6, 0.9, 9.6, 0.4, () => mug(b));
  b.at(-0.4, 0.9, 9.62, -0.3, () => tablet(b, 'screen_off'));
  b.detail(() => {
    for (let i = 0; i < 6; i++) b.cyl(i % 2 ? 'plastic_white' : 'glass', -1.5 + i * 0.11 + R.range(-0.02, 0.02), 0.96, 9.75 + R.range(-0.05, 0.05), 0.025, 0.12, 'y', 6);
    b.box('plastic_white', -3.2, 0.95, 9.7, 0.3, 0.1, 0.22);
    b.sign('생물학적 위험', 'danger', -3.55, 1.25, 9.999, 0.36, 0.14, '-z');
    b.sign('손 씻기', 'label', -0.55, 1.25, 9.999, 0.3, 0.1, '-z');
  });

  // ── terminal by the door ──
  b.at(1.75, 0, 0.2, 0, () => wallTerminal(b, 1.35));
  L.screen('med_terminal', 'terminal_idle', 0.44, 0.3, 1.75, 1.43, 0.333, '+z', { tilt: -0.18 });
  L.interact('log_med', 'log', '단말기 읽기', 1.75, 1.42, 0.38);

  // ── signage / misc ──
  b.sign('의무실 3-A', 'stencil', -3.2, 2.35, 0.236, 1.5, 0.28, '+z');
  b.sign('← 서비스 통로 A', 'directional', -1.9, 1.75, 0.236, 0.9, 0.16, '+z', 0, true);
  b.sign('진정제 사용 중 — 분리 금지', 'warning', 4.964, 1.9, 7.6, 0.9, 0.14, '-x', 0, true);
  b.sign('할시온 다이내믹스 — 산업 보건', 'label', 0, 2.5, 9.964, 1.6, 0.12, '-z');
  b.sign('병상 4', 'label', 1.3, 0.72, 6.115, 0.2, 0.07, '-z');
  b.at(-1.3, 0.55, 0.2, 0, () => fireExtinguisher(b));
  b.decal('grime', 2, 0, 0.002, 4.5, 3.5, 3.5, '+y', 0.7);
  b.decal('scratches', 1, 0.2, 0.002, 1.2, 1.4, 1.4, '+y', 0.3);
  // boots left by the bed
  b.at(0.55, 0, 7.75, 2.2, () => boots(b));
  // loose cable from the ceiling by the dead fixture
  hangingBundle(L, 'med', 0.3, H - 0.02, 5.7, [{ dx: 0, dz: 0, len: 0.95, r: 0.012, bow: 0.1 }, { dx: 0.04, dz: -0.03, len: 0.7, r: 0.008 }], { amp: 0.06, period: 3.4 });

  // ── marker on the privacy screen by the player's bed ──
  b.push(2.75, 0, 7.6, PI / 2 + 0.12); b.push(0, 1.06, 0.099, 0.25);
  b.detail(() => b.quad(scrawlMaterial(['그들이', '아난드를 밖으로 옮겼다.', '그는', '아직도', '말하고 있었다.'], { style: 'marker', aspect: 0.6, seed: 11, px: 512, color: '#07080b' }), 0, 0.04, 0, 0.74, 1.23, '-z', 0.02, 'unit', 0.075));
  b.pop(); b.pop();

  // ── the flat monitor beside the sheeted body: one green line (med_monitor_spike draws two beats on it) ──
  const mcv = document.createElement('canvas');
  mcv.width = 256; mcv.height = 192;
  const mg = mcv.getContext('2d')!;
  const mtex = new THREE.CanvasTexture(mcv);
  mtex.colorSpace = THREE.SRGBColorSpace;
  const mmat = L.ctx.materials.clone('emissive_green', { emissiveMap: mtex, emissive: 0xffffff, emissiveIntensity: 1.6 });
  mmat.name = 'med_flatline';
  /** QRS complex, `d` = pixels past the start of the beat. Returns upward deflection in pixels. */
  const qrs = (d: number) => (d < 0 || d > 40 ? 0 : d < 8 ? Math.sin((d / 8) * PI) * 6 : d < 12 ? 0 : d < 14 ? -(d - 12) * 5 : d < 17 ? -10 + (d - 14) * 27 : d < 20 ? 71 - (d - 17) * 30 : d < 23 ? -19 + (d - 20) * 6.3 : d < 27 ? 0 : Math.sin(((d - 27) / 13) * PI) * 11);
  /** `head` = sweep position 0..1 (0 = idle flat line); beats = sweep positions where a complex starts. */
  const drawTrace = (head: number, beats: number[]) => {
    mg.fillStyle = '#020503'; mg.fillRect(0, 0, 256, 192);
    mg.strokeStyle = 'rgba(40,120,70,0.25)'; mg.lineWidth = 1;
    for (let x = 0; x < 256; x += 32) { mg.beginPath(); mg.moveTo(x, 0); mg.lineTo(x, 192); mg.stroke(); }
    for (let y = 0; y < 192; y += 32) { mg.beginPath(); mg.moveTo(0, y); mg.lineTo(256, y); mg.stroke(); }
    mg.strokeStyle = '#52ff9a'; mg.lineWidth = 2.5; mg.lineJoin = 'round';
    mg.beginPath(); mg.moveTo(0, 110);
    for (let x = 0; x <= 256; x += 1) {
      let y = 0;
      if (x <= head * 256) for (const bt of beats) y += qrs(x - bt * 256);
      mg.lineTo(x, 110 - y);
    }
    mg.stroke();
    const live = head > 0 && head < 1;
    if (live) { mg.fillStyle = '#d8ffe6'; mg.beginPath(); mg.arc(head * 256, 110, 3.5, 0, 6.3); mg.fill(); }
    const beating = live && beats.length > 0;
    mg.fillStyle = beating ? '#52ff9a' : '#ff5540'; mg.font = 'bold 26px monospace';
    mg.fillText(beats.length > 1 && live ? '41' : '--', 10, 34);
    mg.font = '13px monospace'; mg.fillText(beating ? '심박' : '심정지', 60, 30);
    mtex.needsUpdate = true;
  };
  drawTrace(0, []);
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), mmat);
    m.position.set(-4.6 + Math.sin(0.5) * 0.0725, 1.38, 5.2 + Math.cos(0.5) * 0.0725);
    m.rotation.y = 0.5;
    m.name = 'screen:med_flatline';
    L.root.add(m);
  }
  const mglow = L.point('med', -4.45, 1.4, 5.45, 0x58ffa0, 0.35, 2.4);
  L.vignette('med_monitor_spike', () => {
    const beats = [0.22, 0.56];
    let t = 0, n = 0;
    const DUR = 2.8;
    L.sim((dt) => {
      t += dt;
      const head = Math.min(1, t / DUR);
      let shown = 0;
      for (const bt of beats) if (head > bt + 0.06) shown++;
      if (shown > n) { n = shown; L.sfx('monitor_beep', -4.6, 1.4, 5.2, 0.8, 1); mglow.intensityScale = 3.5; }
      mglow.intensityScale += (1 - mglow.intensityScale) * Math.min(1, dt * 5);
      drawTrace(head, beats);
      if (t > DUR + 0.8) { drawTrace(0, []); mglow.intensityScale = 1; L.sfx('monitor_beep', -4.6, 1.4, 5.2, 0.45, 0.5); return false; }
      return true;
    });
  });

  // ── med_arm_drop: the arm of the body under the sheet slides off the mattress and hangs ──
  const skin = L.ctx.materials.clone('plastic_white', { color: 0x9c8a80 }); skin.name = 'med_skin';
  const ab = L.part('med:arm');
  ab.rod('fabric', 0, 0, 0, 0, -0.3, 0, 0.05, 8); // sleeve of the gown
  ab.rod(skin, 0, -0.28, 0, 0, -0.54, 0.01, 0.036, 8);
  ab.sphere(skin, 0, -0.6, 0.015, 0.045, 8, 1.5, 1.0, 0.5);
  for (let i = 0; i < 4; i++) ab.rod(skin, -0.03 + i * 0.02, -0.65, 0.015, -0.034 + i * 0.023, -0.725, 0.03, 0.0085, 5);
  ab.rod(skin, 0.04, -0.6, 0.02, 0.07, -0.66, 0.035, 0.009, 5);
  const arm = ab.build(false);
  // shoulder at the room-side edge of the mattress (the body lies head to the west wall); at rest the arm
  // lies along the body, on the mattress, hand towards the foot of the bed
  const SHX = -4.2, SHY = 0.8, SHZ = 4.86;
  const REST = PI / 2 - 0.04;
  arm.position.set(SHX, SHY, SHZ - 0.12);
  arm.rotation.z = REST;
  for (const m of arm.children) m.castShadow = true;
  L.root.add(arm);
  L.objects.set('med_arm', arm);
  L.vignette('med_arm_drop', () => {
    // creeps to the edge, a beat, then gravity takes it: it swings from the shoulder, knuckles tick the frame
    L.tween(0, 1.4, (k) => { arm.position.z = SHZ - 0.12 + 0.14 * easeInOut(k); arm.rotation.z = REST - 0.05 * k; arm.rotation.x = 0.25 * easeInOut(k); });
    const sw = new Swing(0, 15, 0.9, REST - 0.05);
    let t = 0, ticked = false;
    L.after(1.9, () => L.sim((dt) => {
      t += dt;
      const a = sw.step(dt);
      arm.rotation.z = a;
      arm.rotation.x = 0.25 * Math.max(0, 1 - t * 1.5) + Math.sin(t * 2.3) * 0.07 * Math.exp(-t * 0.45);
      if (!ticked && a < 0.15) { ticked = true; L.sfx('body_fall', SHX, 0.5, SHZ, 0.3, 1.3); }
      return t < 12;
    }));
  });

  L.ctx.fx.emitter('drip', L.vec(-0.55, 1.14, 9.7), L.vec(0, -1, 0), 1.2);

  L.ctx.fx.emitter('dust', L.vec(0, 2.0, 2.4), L.vec(0, -1, 0), 6);
}
