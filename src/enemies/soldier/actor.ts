/**
 * The soldier as a cutscene PUPPET (stage 3c §8.2.8, W3a): `enemies.actor('soldier', pos, yaw, pose, { name })`.
 * Same rig as the enemy (rig.ts), never perceives, never fires, not in `all`.
 *
 *   moveTo(point, speed = 1.4)  — turns toward the point (unhurried), then walks there upright (planted feet), resolves
 *   setPose('hold' | 'walk' | 'idle' | any SoldierPose) — 'idle' = 'hold'
 *   lookAt(point)               — pinned frozen point; lookAt(object) — live (see `puppetLookObject`); null = ahead
 *   speak(seconds)              — head / shoulder micro-motion (no jaw)
 *   setEyes(on)                 — the Clasp LED on ('red', blinking) / off
 *   prop('led', 'red' | 'fail' | 'off') · prop('name', text) · prop('light', bool)
 *   prop('face', yaw | Vector3 | { to: yaw | Vector3, seconds })  — turn on the spot (default 0.45 + 0.55 · |Δ|/π s)
 *   object.rotation.y = yaw     — (Human convention) read as "face this way"; he turns to it
 *
 * Facing: `object.rotation.y` = game yaw (0 faces −Z), as the soldier enemy.
 */
import * as THREE from 'three';
import type { EnemyType } from '../../core/types';
import { EnemyBase, type EnemyWorld, type HitBurst } from '../ai';
import type { FactoryOpts } from '../manager';
import type { HitVolume } from '../shared/hit';
import { angleDiff, smooth } from '../shared/ik';
import type { SoldierTemplate } from './model';
import { createSoldierRig, type SoldierPose, type SoldierRigEx } from './rig';

const POSES: readonly string[] = ['hold', 'walk', 'walk_aim', 'aim', 'crouch', 'rise_aim', 'lean_l', 'lean_r', 'reload', 'flinch', 'stagger'];

export interface SoldierActorOpts extends FactoryOpts {
  /** Name tape (ActorOpts.name). */
  name?: string;
  arms?: 'pistol' | 'carbine';
}

export class SoldierActor extends EnemyBase {
  readonly type = 'soldier' as EnemyType;
  readonly rig: SoldierRigEx;
  private moving = false;
  private readonly target = new THREE.Vector3();
  private speed = 1.4;
  private curSpeed = 0;
  private done: (() => void) | null = null;
  private turn: { from: number; to: number; t: number; dur: number } | null = null;
  private rotOut = NaN;
  private basePose: SoldierPose = 'hold';
  private pinObj: THREE.Object3D | null = null;
  private readonly pin = new THREE.Vector3();
  private pinned = false;

  constructor(world: EnemyWorld, tpl: SoldierTemplate, position: THREE.Vector3, yaw: number, o: SoldierActorOpts) {
    super(world, '', position, yaw, 0.32, 1.8);
    this.isActor = true;
    this.awake = false;
    this.state = 'idle';
    this.body.gravityScale = 0;
    this.rig = createSoldierRig(world.ctx, tpl, { arms: o.arms ?? 'pistol', name: o.name ?? '브레케', seed: this.id * 3.17 + 0.5 });
    this.object.add(this.rig.root);
    this.lodRig = this.rig.lodRig;
    this.volumes = this.rig.volumes;
    this.boundCenterY = 0.9; this.boundRadius = 1.2;
    this.puppetPose(o.pose ?? 'hold');
    this.sync();
    this.rig.update(0);
  }

  // ── EnemyBase plumbing (puppet only)
  protected enterAlert(): void { /* never */ }
  applyDamage(_v: HitVolume, _a: number, _p: THREE.Vector3, _d: THREE.Vector3): void { /* never */ }
  protected hitFx(_b: HitBurst): void { /* never */ }

  override puppetMove(point: THREE.Vector3, speed: number | undefined, done: () => void): void {
    if (this.done) this.arrive();
    this.target.copy(point);
    this.speed = THREE.MathUtils.clamp(speed ?? 1.4, 0.3, 3.0);
    this.moving = true; this.done = done; this.turn = null;
  }
  override puppetPose(pose: string): void {
    const p = (pose === 'idle' || pose === 'standing' || !POSES.includes(pose) ? 'hold' : pose) as SoldierPose;
    if (p !== 'flinch' && p !== 'stagger') this.basePose = p;
    this.rig.setPose(p);
  }
  override puppetLook(point: THREE.Vector3 | null): void {
    this.pinObj = null;
    if (!point) { this.pinned = false; return; }
    this.pin.copy(point); this.pinned = true;
  }
  /** Live pin on an object's world position (the manager's `lookAt(object)` should route here). */
  puppetLookObject(o: THREE.Object3D): void { this.pinObj = o; this.pinned = true; }
  override puppetEyes(on: boolean): void { this.rig.setLed(on ? 'red' : 'off'); }
  override puppetStop(): void { if (this.done) this.arrive(); this.moving = false; }
  override puppetSpeak(seconds: number): void { this.rig.speak(seconds); }

  prop(name: string, value: unknown): void {
    if (name === 'led') this.rig.setLed(value === 'fail' ? 'fail' : value === 'off' ? 'off' : 'red');
    else if (name === 'name') this.rig.setName(String(value));
    else if (name === 'light') this.rig.setLight(!!value);
    else if (name === 'face') {
      let to: unknown = value, seconds: number | undefined;
      if (value && typeof value === 'object' && 'to' in (value as Record<string, unknown>)) { to = (value as { to: unknown }).to; seconds = (value as { seconds?: number }).seconds; }
      const yaw = typeof to === 'number' ? to : (to as THREE.Vector3)?.isVector3 ? Math.atan2(-((to as THREE.Vector3).x - this.body.position.x), -((to as THREE.Vector3).z - this.body.position.z)) : NaN;
      if (Number.isFinite(yaw)) this.faceTo(yaw, seconds);
    } else console.warn(`[enemies] soldier actor: unknown prop '${name}'`);
  }

  private faceTo(yaw: number, seconds?: number): void {
    const d = angleDiff(yaw, this.yaw);
    this.turn = { from: this.yaw, to: this.yaw + d, t: 0, dur: seconds ?? 0.45 + 0.55 * Math.abs(d) / Math.PI };
  }

  private arrive(): void {
    this.moving = false;
    const d = this.done; this.done = null;
    if (this.basePose === 'hold' || this.basePose === 'walk') this.rig.setPose('hold');
    if (d) d();
  }

  private sync(): void {
    this.object.position.copy(this.body.position);
    this.object.rotation.y = this.rotOut = this.yaw;
    this.object.updateMatrixWorld(true);
  }

  update(dt: number): void {
    // a facing written into object.rotation.y by the story: turn to it
    const r = this.object.rotation.y;
    if (Number.isFinite(this.rotOut) && r !== this.rotOut) { this.object.rotation.y = this.rotOut; this.faceTo(r); }
    const p = this.body.position;
    if (this.moving) {
      const dx = this.target.x - p.x, dz = this.target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) this.arrive();
      else {
        const want = Math.atan2(-dx, -dz);
        const rem = angleDiff(want, this.yaw);
        // turn first (on the spot, ≈ 2.6 rad/s), then walk; small corrections while walking
        const rate = this.curSpeed < 0.2 ? 2.6 : 1.6;
        this.yaw += Math.sign(rem) * Math.min(Math.abs(rem), rate * dt);
        const al = Math.max(0, Math.cos(rem));
        const target = Math.abs(rem) > 0.5 && this.curSpeed < 0.2 ? 0 : this.speed * al * al;
        this.curSpeed += (Math.min(target, d * 2.2 + 0.1) - this.curSpeed) * (1 - Math.exp(-5 * dt));
        const k = Math.min(d, this.curSpeed * dt) / d;
        p.x += dx * k; p.z += dz * k;
        this.rig.setMove(this.curSpeed, this.yaw);
      }
    } else {
      this.curSpeed = 0;
      this.rig.setMove(0, this.yaw);
      if (this.turn) {
        this.turn.t += dt;
        const u = Math.min(1, this.turn.t / this.turn.dur);
        this.yaw = this.turn.from + (this.turn.to - this.turn.from) * smooth(u);
        if (u >= 1) this.turn = null;
      }
    }
    this.sync();
    // attention: pinned point / object; else ahead
    if (this.pinned) this.rig.aim(this.pinObj ? this.pinObj.getWorldPosition(this.pin) : this.pin);
    else this.rig.aim(null);
    this.rig.update(dt);
  }

  override dispose(): void {
    this.rig.dispose();
    super.dispose();
  }
}

/** Factory for `src/enemies/index.ts` (W3b): an actor-mode soldier on the shared template. */
export function createSoldierActor(world: EnemyWorld, tpl: SoldierTemplate, position: THREE.Vector3, yaw: number, o: SoldierActorOpts): SoldierActor {
  return new SoldierActor(world, tpl, position, yaw, o);
}
