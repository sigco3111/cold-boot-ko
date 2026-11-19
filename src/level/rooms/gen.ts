/** POWER DISTRIBUTION 3 — x 12…22, z -44…-32, h 4.5. Switchgear, bus bars, the turbine and the main breaker. */
import * as THREE from 'three';
import { rng } from '../builder';
import type { LevelBuild, MachineState } from '../context';
import { cableBundle, ductRect, floorSlab, hazardStrip, ibeam, lathe, panel, pipe, trench, valve } from '../kit';
import { crate, floorCable, switchgear, wallTerminal } from '../props';
import { beacon, ceilingSlab, troffer, wallFace } from '../structure';
import { scrawlMaterial } from '../scrawl';

const PI = Math.PI;

export function buildGen(L: LevelBuild) {
  const b = L.builder('gen');
  const R = rng(808);
  const H = 4.5;
  L.room('gen', '배전실 3', 12, 22, -44, -32, H, 1.7);

  const holes: [number, number, number, number][] = [[13.4, -35.4, 18.0, -34.8], [13.4, -41.2, 18.0, -40.6]];
  floorSlab(b, 'floor_plate', 12, -44, 22, -32, holes, 'metal');
  for (const h of holes) trench(b, h[0], h[1], h[2], h[3], 0.45, R);
  ceilingSlab(b, 12, -44.2, 22.2, -31.8, H);
  wallFace(b, { n: '+x', plane: 12.2, from: -44, to: -32, h: H, t: 0.2, openings: [{ c: -38, w: 1.6, h: 2.4 }], style: 'dark', seed: 61, trayY: 3.5, features: 0.3, clear: [[-36, -34]] });
  wallFace(b, { n: '-x', plane: 22, from: -44, to: -32, h: H, style: 'dark', seed: 62, trayY: 3.5, features: 0.6 });
  wallFace(b, { n: '+z', plane: -44, from: 12.2, to: 22, h: H, style: 'dark', seed: 63, trayY: 3.5, features: 0 });
  wallFace(b, { n: '-z', plane: -32, from: 12.2, to: 22, h: H, style: 'dark', seed: 64, trayY: 3.5, features: 0 });

  for (const x of [14.5, 17, 19.5]) ibeam(b, 'trim_steel', 'z', x, H - 0.14, -38, 12, 0.16, 0.28);
  ductRect(b, 'steel_raw', 'x', 17, H - 0.5, -36.2, 9.4, 0.6, 0.4, 1.8);

  // ── switchgear rows + bus bars ──
  for (const [z, ry, s] of [[-32.4, PI, 1], [-43.6, 0, -1]] as const) {
    for (let i = 0; i < 8; i++) {
      const x = 13.3 + i * 0.82;
      b.at(x, 0, z, ry, () => switchgear(b, R, 0.8, 2.2, 0.7, i === 5 ? 0.9 : 0.4));
      b.detail(() => { b.cyl('plastic_white', x, 2.36, z, 0.05, 0.2, 'y', 8); b.cyl('plastic_white', x, 2.36, z, 0.075, 0.03, 'y', 8); b.cyl('plastic_white', x, 2.42, z, 0.075, 0.03, 'y', 8); });
    }
    b.collide(12.9, 0, z - 0.36, 19.5, 2.25, z + 0.36);
    for (let k = 0; k < 3; k++) b.box('copper', 16.2 + (19.2 - 16.2) / 2 - 0.05, 2.5 + k * 0.0, z + (k - 1) * 0.12, 6.7, 0.02, 0.07);
    // risers from the bar to the overhead run to the turbine
    for (let k = 0; k < 3; k++) {
      const zz = z + (k - 1) * 0.12;
      b.box('copper', 19.55, 3.05, zz, 0.07, 1.12, 0.02);
      b.box('copper', 19.55, 3.6, zz - s * (Math.abs(z + 38) - 1.2) / 2, 0.07, 0.02, Math.abs(z + 38) - 1.2);
    }
    b.detail(() => { for (let zz = z - s * 1.2; Math.abs(zz + 38) > 1.3; zz -= s * 1.3) { b.rod('plastic_white', 19.55, 3.62, zz, 19.55, H - 0.3, zz, 0.04, 8); b.box('trim_steel', 19.55, 3.6, zz, 0.2, 0.03, 0.4); } });
    b.detail(() => { b.sign('위험  11 kV', 'danger', 16.2, 2.75, z - s * 0.02, 1.2, 0.16, s > 0 ? '-z' : '+z', 0, true); });
  }
  // one cabinet stands open, arcing
  b.at(17.4 + 0.41, 0, -43.24, 0.9, () => { b.box('wall_panel_dark', 0.4, 1.1, 0, 0.78, 2.0, 0.03); });
  b.decal('scorch', 2, 17.4, 1.3, -43.23, 0.9, 0.9, '+z');
  b.decal('scorch', 0, 17.5, 0.003, -42.6, 1.3, 1.3, '+y');
  L.ctx.fx.emitter('sparks', L.vec(17.4, 1.35, -43.2), L.vec(0, 0.2, 1), 0.4);

  // ── transformer in the SW corner ──
  b.at(13.4, 0, -42.2, PI / 2, () => {
    b.box('wall_panel_dark', 0, 0.95, 0, 1.3, 1.7, 1.0);
    b.box('painted_dark', 0, 0.06, 0, 1.4, 0.12, 1.1);
    b.detail(() => {
      for (let i = 0; i < 9; i++) { b.box('painted_dark', -0.56 + i * 0.14, 0.95, 0.56, 0.02, 1.4, 0.14); }
      for (let i = 0; i < 3; i++) { lathe(b, 'plastic_white', [[0.04, 0], [0.08, 0.04], [0.04, 0.08], [0.08, 0.12], [0.04, 0.16], [0.07, 0.2], [0.03, 0.26], [0.03, 0.34]], -0.4 + i * 0.4, 1.8, 0, 10); }
      b.sign('TX-3  11 kV / 690 V', 'label', 0.662, 1.5, 0, 0.7, 0.1, '+x');
    });
  });
  b.collide(12.8, 0, -42.95, 14.0, 1.9, -41.45);

  // ── the turbine / flywheel set-piece (axis along X; the flywheel faces the door) ──
  const TX = 18.9, TY = 1.45, TZ = -38;
  b.box('painted_dark', 20.2, 0.15, TZ, 3.4, 0.3, 2.6);
  b.detail(() => { hazardStrip(b, 18.1, -39.7, 21.9, -39.55); hazardStrip(b, 18.1, -36.45, 21.9, -36.3); hazardStrip(b, 18.1, -39.7, 18.25, -36.3); });
  // generator housing
  b.cyl('wall_panel_dark', 20.55, TY, TZ, 1.0, 2.3, 'x', 24);
  b.cyl('painted_dark', 19.35, TY, TZ, 1.05, 0.12, 'x', 24).cyl('painted_dark', 21.72, TY, TZ, 1.05, 0.12, 'x', 24);
  b.detail(() => {
    for (let i = 0; i < 11; i++) b.cyl('painted_dark', 19.6 + i * 0.19, TY, TZ, 1.04, 0.03, 'x', 24);
    b.box('painted_yellow', 20.55, TY + 1.05, TZ, 0.9, 0.3, 0.7);
    b.sign('GT-3', 'stencil', 20.55, TY + 0.2, TZ + 1.01, 1.1, 0.4, '+z');
    for (const s of [-1, 1]) { b.box('painted_dark', 19.7, 0.6, TZ + s * 0.8, 0.3, 0.9, 0.3); b.box('painted_dark', 21.4, 0.6, TZ + s * 0.8, 0.3, 0.9, 0.3); }
    pipe(b, 'copper', [[21.0, TY + 0.95, TZ - 0.4], [21.0, 3.4, TZ - 0.4], [21.9, 3.4, TZ - 0.4]], 0.07, { every: 1 });
    pipe(b, 'steel_raw', [[20.2, TY - 0.9, TZ + 1.0], [20.2, 0.35, TZ + 1.5], [20.2, 0.35, TZ + 5.5]], 0.08, { every: 1.4 });
    valve(b, 20.2, 0.35, TZ + 3, 'z', 0.08, 'y', 1);
    cableBundle(b, [19.55, 3.55, TZ], [20.3, TY + 1.2, TZ], 4, -0.1, 0.03, 0.08, R);
  });
  // bearing pedestals + guard cage around the flywheel
  for (const x of [18.35, 19.25]) { b.box('painted_yellow', x, 0.75, TZ, 0.2, 1.5, 0.7); b.cyl('steel_raw', x, TY, TZ, 0.2, 0.24, 'x', 12); }
  b.detail(() => {
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI; b.rod('painted_yellow', 18.55, TY + Math.sin(a) * 1.42, TZ + Math.cos(a) * 1.42, 19.2, TY + Math.sin(a) * 1.42, TZ + Math.cos(a) * 1.42, 0.014, 5); }
    for (const x of [18.55, 19.2]) for (let i = 0; i < 10; i++) { const a0 = (i / 10) * PI, a1 = ((i + 1) / 10) * PI; b.rod('painted_yellow', x, TY + Math.sin(a0) * 1.42, TZ + Math.cos(a0) * 1.42, x, TY + Math.sin(a1) * 1.42, TZ + Math.cos(a1) * 1.42, 0.02, 5); }
    for (const s of [-1, 1]) for (const x of [18.55, 19.2]) b.rod('painted_yellow', x, 0, TZ + s * 1.42, x, TY, TZ + s * 1.42, 0.02, 5);
  });
  b.collide(18.2, 0, -39.5, 21.9, 2.9, -36.5);
  // rotor (dynamic): flywheel with spokes and painted balance marks
  const rb = L.part('gen_turbine');
  rb.cyl('steel_raw', 0, 0, 0, 1.25, 0.24, 'x', 32);
  rb.cyl('steel_raw', 0, 0, 0, 0.12, 1.4, 'x', 12);
  rb.cyl('painted_dark', -0.13, 0, 0, 1.05, 0.02, 'x', 32);
  rb.cyl('steel_raw', -0.15, 0, 0, 0.3, 0.06, 'x', 16);
  for (let i = 0; i < 6; i++) { const a = (i * PI) / 3; rb.push(-0.16, 0, 0, 0, a, 0); rb.box('steel_raw', 0, 0.62, 0, 0.05, 0.75, 0.16); rb.pop(); }
  for (let i = 0; i < 3; i++) { const a = (i * 2 * PI) / 3 + 0.3; rb.push(-0.125, 0, 0, 0, a, 0); rb.box('painted_orange', 0, 1.12, 0, 0.012, 0.2, 0.3); rb.box('painted_orange', 0.125, 1.251, 0, 0.24, 0.006, 0.3); rb.pop(); }
  const rotor = rb.build(false);
  rotor.position.set(TX, TY, TZ);
  L.root.add(rotor);
  L.objects.set('gen_turbine', rotor);
  let tState: MachineState = 'off', omega = 0, ang = 0;
  L.machines.set('gen_turbine', (s) => { tState = s; });
  L.updaters.push((dt, t) => {
    const target = tState === 'off' ? 0 : tState === 'idle' ? 0.6 : tState === 'active' ? 15 : 24;
    if (omega === 0 && target === 0) return;
    omega += (target - omega) * Math.min(1, dt * (target > omega ? 0.35 : 0.25));
    if (target === 0 && omega < 0.01) omega = 0;
    ang += omega * dt;
    rotor.rotation.x = ang;
    const wob = tState === 'frenzy' ? 0.012 : omega > 8 ? 0.002 : 0;
    rotor.position.y = TY + Math.sin(t * 47) * wob;
    rotor.position.z = TZ + Math.sin(t * 39) * wob;
  });

  // ── main breaker panel with the big lever (faces the door) ──
  const LX = 16.3, LZ = -38;
  b.at(LX, 0, LZ, -PI / 2, () => {
    b.box('wall_panel_dark', 0, 1.05, -0.2, 1.3, 2.1, 0.4);
    b.box('painted_dark', 0, 0.06, -0.2, 1.4, 0.12, 0.5);
    b.box('trim_steel', 0, 2.13, -0.2, 1.36, 0.06, 0.46);
    b.detail(() => {
      panel(b, 'painted_yellow', -0.36, 0.75, 0.36, 1.8, 0, 0.03, 0.03);
      b.box('hazard_stripes', 0, 1.275, 0.032, 0.72, 1.05, 0.004);
      b.box('painted_dark', 0, 1.275, 0.04, 0.3, 0.9, 0.02);
      b.box('painted_dark', 0, 1.275, 0.06, 0.06, 0.74, 0.03);
      b.sign('주 차단기', 'danger', 0, 1.95, 0.002, 0.8, 0.14, '+z', 0, true);
      b.sign('켜짐', 'label', 0.27, 0.9, 0.034, 0.14, 0.08, '+z');
      b.sign('꺼짐', 'label', 0.27, 1.65, 0.034, 0.14, 0.08, '+z');
      for (const s of [-1, 1]) { b.cyl('painted_dark', s * 0.5, 1.5, 0.02, 0.07, 0.04, 'z', 12); b.cyl('plastic_white', s * 0.5, 1.5, 0.042, 0.058, 0.004, 'z', 12); }
      for (let i = 0; i < 4; i++) b.rod('rubber', -0.45 + i * 0.3, 2.15, -0.2, -0.45 + i * 0.3, H - 0.3, -0.2, 0.03, 6);
      b.box('trim_steel', 0, 0.45, 0.01, 1.0, 0.4, 0.02);
    });
    b.collide(-0.68, 0, -0.42, 0.68, 2.15, 0.02);
  });
  const lever = new THREE.Group();
  lever.name = 'gen_lever';
  lever.position.set(LX - 0.07, 1.275, LZ);
  lever.rotation.y = -PI / 2;
  const lb = L.part('gen_lever');
  lb.cyl('steel_raw', 0, 0, 0, 0.06, 0.2, 'x', 12);
  lb.box('steel_raw', -0.08, 0.3, 0, 0.03, 0.62, 0.05).box('steel_raw', 0.08, 0.3, 0, 0.03, 0.62, 0.05);
  lb.cyl('painted_orange', 0, 0.6, 0, 0.035, 0.34, 'x', 10);
  lb.sphere('painted_orange', -0.18, 0.6, 0, 0.045, 8).sphere('painted_orange', 0.18, 0.6, 0, 0.045, 8);
  const arm = lb.build(false);
  const OFF = 0.62, ON = 2.5; // arm tilts up-and-out when off, slams down when on
  arm.rotation.x = OFF;
  lever.add(arm);
  const lampRed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), L.ctx.materials.get('emissive_red'));
  const lampGreen = new THREE.Mesh(lampRed.geometry, L.ctx.materials.get('emissive_green'));
  lampRed.position.set(-0.27, 0.55, 0.0); lampGreen.position.set(-0.27, 0.42, 0.0); lampGreen.visible = false;
  lever.add(lampRed, lampGreen);
  L.root.add(lever);
  L.objects.set('gen_lever', lever);
  const it = L.interact('gen_lever', 'lever', '주 차단기', LX - 0.25, 1.35, LZ, true, 2.4);

  // Hale's lock-out: a hasp through the lever with her padlock on it, and the tag. Named `gen_lockout`.
  const tagMat = scrawlMaterial(['D. 헤일', '닫지', '마세요', '아무도', '못 닫아요'], {
    style: 'pen', aspect: 0.56, px: 256, seed: 9, color: '#161a22', top: 0.3,
    bg: (g, W, Hh) => {
      g.fillStyle = '#d9d4c6'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#a3170f'; g.fillRect(0, 0, W, Hh * 0.27);
      g.fillStyle = '#efe9da'; g.font = `bold ${Math.round(W * 0.2)}px sans-serif`; g.textAlign = 'center';
      g.fillText('위험', W / 2, Hh * 0.13); g.font = `bold ${Math.round(W * 0.115)}px sans-serif`; g.fillText('로크아웃', W / 2, Hh * 0.235);
      g.fillStyle = '#222'; g.beginPath(); g.arc(W / 2, Hh * 0.045, W * 0.035, 0, 6.3); g.fill();
    },
  });
  const kb = L.part('gen_lockout');
  kb.box('painted_orange', 0, 0.02, 0, 0.012, 0.16, 0.05);                       // hasp plate through the lever cheek
  kb.box('painted_orange', 0.02, -0.04, 0, 0.05, 0.03, 0.05);
  kb.box('brass', 0.045, -0.115, 0, 0.022, 0.06, 0.055);                         // padlock body
  kb.torus('steel_raw', 0.045, -0.075, 0, 0.02, 0.005, 'x', 10);                 // shackle
  kb.rod('steel_raw', 0.03, -0.06, 0.02, 0.0, -0.165, 0.085, 0.0025, 4);         // tag wire
  const lockout = kb.build(false);
  lockout.name = 'gen_lockout';
  L.ctx.physics.addMover?.(lockout); // REVISION 5.2: a decal on the hasp falls off with it
  {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.178), tagMat);
    tag.position.set(0.0, -0.25, 0.085); tag.rotation.set(0.12, 0.25, 0.09);
    lockout.add(tag);
  }
  // hangs on the lever arm, half way up, on the side facing the door
  lockout.position.set(0.105, Math.cos(OFF) * 0.3, Math.sin(OFF) * 0.3 + 0.01);
  lockout.scale.setScalar(1.45);
  for (const m of lockout.children) m.castShadow = false;
  lever.add(lockout);
  L.objects.set('gen_lockout', lockout);

  // gen_lever_throw (story, once the player has the key): padlock off, lever down, breaker closed
  L.vignette('gen_lever_throw', () => {
    it.enabled = false;
    const wp = new THREE.Vector3();
    lever.updateMatrixWorld(true);
    L.root.attach(lockout);
    lockout.userData.rooms = ['gen'];
    lockout.getWorldPosition(wp);
    L.sfx('pipe_tick', wp.x, wp.y, wp.z, 0.8, 1.6);
    // the shackle springs, the lock swings clear, drops, rings on the plate floor and lies there
    let vy = 0.6, vx = -0.5, vz = 0.25, t = 0, hits = 0;
    L.tween(0, 0.28, (k) => { lockout.rotation.z = -0.5 * k; });
    L.after(0.3, () => L.sim((dt) => {
      t += dt;
      vy -= 9.8 * dt;
      lockout.position.x += vx * dt; lockout.position.y += vy * dt; lockout.position.z += vz * dt;
      lockout.rotation.x += 7 * dt * (hits ? 0.4 : 1); lockout.rotation.z -= 4 * dt * (hits ? 0.3 : 1);
      if (lockout.position.y < 0.04) {
        lockout.position.y = 0.04;
        L.sfx('metal_clang', lockout.position.x, 0.05, lockout.position.z, 0.35 / (1 + hits), 2.2);
        if (++hits > 2 || Math.abs(vy) < 0.8) { lockout.rotation.set(PI / 2, 0, lockout.rotation.z); return false; }
        vy = -vy * 0.35; vx *= 0.5; vz *= 0.5;
      }
      return t < 4;
    }));
    // a breath — then the bar comes down: accelerates, hits the stop, a tiny bounce
    L.tween(1.0, 0.45, (k) => {
      const e = k < 0.8 ? (k / 0.8) * (k / 0.8) : 1 + Math.sin(((k - 0.8) / 0.2) * PI) * 0.035;
      arm.rotation.x = OFF + (ON - OFF) * e;
      if (k > 0.8 && lampRed.visible) { lampRed.visible = false; lampGreen.visible = true; L.sfx('metal_clang', LX, 1.2, LZ, 0.7, 0.7); }
    });
  });

  // gen_ripple: the indicator bars along the tops of the switchgear follow whoever walks past
  const LEDS: number[] = [];
  for (const [z, s] of [[-32.4, -1], [-43.6, 1]] as const) for (let i = 0; i < 8; i++) for (let k = 0; k < 6; k++) LEDS.push(13.3 + i * 0.82 - 0.25 + k * 0.1, z + s * 0.372);
  const NLED = LEDS.length / 2;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  ledMat.name = 'gen_leds';
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.022, 0.012), ledMat, NLED);
  leds.name = 'gen:leds';
  const ledLvl = new Float32Array(NLED).fill(0.05);
  const lm = new THREE.Matrix4(), lc = new THREE.Color();
  const ledWrite = (i: number) => { const v = ledLvl[i]; leds.setColorAt(i, lc.setRGB(v * 1.9, v * (0.55 + v * 0.25), v * 0.1 + Math.max(0, v - 1) * 0.5)); };
  for (let i = 0; i < NLED; i++) { leds.setMatrixAt(i, lm.makeTranslation(LEDS[i * 2], 2.225, LEDS[i * 2 + 1])); ledWrite(i); }
  leds.computeBoundingSphere(); leds.computeBoundingBox();
  L.root.add(leds);
  let rippleT = -1, tick = 0;
  L.vignette('gen_ripple', () => { if (rippleT < 0) { rippleT = 0; tick = 0; } }, true);
  L.ambient('gen', (dt, t) => {
    const pl = L.ctx.player?.position;
    if (rippleT < 0 || !pl) {
      // idle: an occasional single LED blinks awake and dies again
      if (Math.random() < dt * 1.5) { const i = (Math.random() * NLED) | 0; ledLvl[i] = 0.5; }
      let dirty = false;
      for (let i = 0; i < NLED; i++) if (ledLvl[i] > 0.05) { ledLvl[i] = Math.max(0.05, ledLvl[i] - dt * 0.8); ledWrite(i); dirty = true; }
      if (dirty) leds.instanceColor!.needsUpdate = true;
      return;
    }
    rippleT += dt;
    const DUR = 9, env = Math.min(1, rippleT / 0.5) * Math.min(1, (DUR - rippleT) / 1.5);
    const north = pl.z > -38;
    // a wave runs the length of the row once, then a patch of light keeps pace with the player
    const front = 12.6 + rippleT * 7;
    for (let i = 0; i < NLED; i++) {
      const x = LEDS[i * 2], mine = (LEDS[i * 2 + 1] > -38) === north;
      const dx = x - pl.x;
      let v = Math.exp(-dx * dx * 1.1) * (0.75 + 0.25 * Math.sin(t * 14 - Math.abs(dx) * 6)) * 2.2;
      const df = x - front;
      v += Math.exp(-df * df * 2.5) * 1.6;
      if (!mine) v *= 0.12;
      ledLvl[i] = 0.05 + v * env;
      ledWrite(i);
    }
    leds.instanceColor!.needsUpdate = true;
    tick -= dt;
    if (tick <= 0 && env > 0.5) { tick = 0.16 + Math.random() * 0.2; L.sfx('pipe_tick', Math.max(13, Math.min(19.5, pl.x)), 2.1, north ? -32.8 : -43.2, 0.22, 1.8 + Math.random() * 0.5); }
    if (rippleT >= DUR) rippleT = -1;
  });

  // ── engineer's terminal by the door ──
  b.at(12.2, 0, -35.0, PI / 2, () => wallTerminal(b, 1.35));
  // dead until the power comes back: black glass, no prompt. The story enables `log_gen` (and may setScreen);
  // the moment it does, the tube warms up by itself.
  const gscr = L.screen('gen_terminal', 'terminal_idle', 0.44, 0.3, 12.333, 1.43, -35.0, '+x', { tilt: -0.18 });
  const gmat = gscr.material as THREE.MeshStandardMaterial;
  const gFull = gmat.emissiveIntensity;
  gmat.emissiveIntensity = 0;
  const gIt = L.interact('log_gen', 'log', '단말기 읽기', 12.4, 1.42, -35.0, false);
  const gGlow = L.point('gen', 12.8, 1.45, -35.0, 0x60ffb0, 1.5, 3, { enabled: false });
  let gBoot = -1;
  L.updaters.push((dt) => {
    if (gBoot < 0) { if (!gIt.enabled) return; gBoot = 0; gGlow.enabled = true; L.sfx('terminal_beep', 12.35, 1.43, -35.0, 0.7, 0.8); }
    if (gBoot >= 1.6) return;
    gBoot += dt;
    // cold start: a flash, a stutter, then steady
    const k = Math.min(1, gBoot / 1.6);
    const f = k < 0.08 ? 1.6 : k < 0.3 ? 0.08 : k < 0.75 ? (Math.sin(gBoot * 55) > 0 ? 0.9 : 0.25) : 1;
    gmat.emissiveIntensity = gFull * f;
    gGlow.intensityScale = f;
  });
  b.at(12.75, 0, -33.5, 0.2, () => crate(b, 0.8, 0.6, 0.6, 'painted_dark', 'PPE'));
  L.pickup('p_gen_med', 'medkit', 12.75, 0.6, -33.5, 35, 0.3);
  b.at(21.3, 0, -33.3, -0.3, () => crate(b, 0.9, 0.7, 0.7, 'wall_panel', 'FUSES'));
  L.pickup('p_gen_ammo', 'ammo_pistol', 21.3, 0.7, -33.3, 12, 0.5);
  floorCable(b, [[16.9, -38.6], [17.5, -39.6], [18.0, -40.9]], 0.045);
  floorCable(b, [[16.9, -37.4], [17.4, -36.2], [18.0, -35.1]], 0.045);
  floorCable(b, [[15.6, -38.3], [14.6, -39.4], [14.2, -40.9]], 0.035);

  // ── lights: dark except indicator glow until the story enables the group ──
  let gm: THREE.Material | undefined;
  for (const [x, z, cast] of [[14.8, -38, true], [18.2, -34.6, false], [18.2, -41.4, false]] as const) {
    const h = troffer(b, L, { group: 'gen', x, y: H - 0.28, z, axis: 'z', len: 1.6, intensity: 95, distance: 9, angle: 1.0, cast, enabled: false, glowMat: gm });
    gm = (h as any).glowMat;
  }
  L.spot('gen', 17.6, 0.4, TZ, 19.2, 2.2, TZ, 0xffa040, 40, 6, 0.9, { enabled: false, vol: true });
  L.point('gen', 16.0, 1.5, -33.4, 0x50ff80, 3.5, 5);
  L.point('gen', 16.0, 1.5, -42.6, 0xffb040, 3.5, 5, { flicker: 'pulse' });
  let bm: THREE.Material | undefined;
  for (const [x, z] of [[12.2, -33], [12.2, -43], [22, -35], [22, -41]] as const) {
    b.at(x, 0, z, x < 13 ? PI / 2 : -PI / 2, () => { bm = (beacon(b, L, 'gen_emergency', 0, 3.2, 0.1, 1, 0xff2a12, 60, 11, 'emissive_red', false, 'alarm', bm) as any).glowMat; });
  }

  b.sign('배전실 3', 'stencil', 21.964, 3.0, -38, 3.4, 0.4, '-x');
  b.sign('아크 플래시 위험 — 이 선 너머 PPE CAT 4 착용', 'warning', 12.236, 1.9, -40.2, 1.3, 0.16, '+x', 0, true);
  b.sign('회전 기계', 'danger', 18.24, 1.0, -36.28, 1.2, 0.16, '+z', 0, true);
  b.decal('oil_stain', 3, 19, 0.003, -35.6, 1.8, 1.6, '+y', 0.5);
  b.decal('grime', 0, 15, 0.003, -38, 3, 3, '+y', 1.2);
  b.decal('scorch', 1, 12.236, 1.3, -36.4, 0.7, 0.7, '+x'); // the arc-flash that put you in medical
  L.ctx.fx.emitter('steam', L.vec(20.2, 0.45, -35), L.vec(0, 1, 0.2), 45);
}
