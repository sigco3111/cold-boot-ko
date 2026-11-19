/**
 * Level 5 — the cutscene "Under control" (stage 3c §4.2; D6, D7), first person, non-interactive, ≤ 25 s.
 *
 * The duty-room door opens on a sailor in fatigues, helmet and balaclava. Reyes reports; the sailor only looks; then,
 * in CHOIR's voice through his throat mic, the situation is under control (Technician / Supervisor by the stored
 * choice), put the weapon down. He turns away: on his nape the Clasp's red light blinks (the shot is held where the
 * mark shows — only from behind the neck, W3a). He walks out through the ready-room door, which shuts behind him.
 * Hand-back at `mk5_c1_end`, weapon raised from lowered, `cp5_duty`; two units come through that door 2.5 s later.
 *
 * Every time is a cue on the scene clock computed from the RECORDED line durations (`lineDuration` = the manifest's,
 * less the lead the audio skips): each line starts on its cue's frame with `SayOpts.now` (lines decoded before the
 * camera is taken, `linesReady`), and every gesture is on the same cue as its line. The end state (`sceneEnd`) is
 * applied by a natural end, a skip and a `cp5_duty` load alike. Every position is a marker.
 */
import * as THREE from 'three';
import type { EnemyActor } from '../../core/types';
import type { CamCue, CamShot, CutResult } from '../cutscene';
import { lineDuration } from '../voice';
import { Base5, V } from './base';

type V3 = THREE.Vector3;

/** The cue names of §4.2 (debugState.scene.times). */
export type SceneCue = 'S1' | 'S2' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10' | 'H';
export const SCENE_ID5 = 'l5_c1';
/** §4.2: the scene's longest allowed run (s). */
export const SCENE_MAX5 = 25.0;

export abstract class Scenes5 extends Base5 {
  protected sol: EnemyActor | null = null;
  protected sceneTimes: Record<string, number> | null = null;
  protected sceneResult: 'played' | 'skipped' | null = null;
  private _h = new THREE.Vector3();
  private _n = new THREE.Vector3();
  private _c = new THREE.Vector3();

  /** Every line the scene may say (both variants). */
  protected sceneLines(): string[] {
    return ['l5_reyes_c1_1', 'l5_reyes_c1_2', 'l5_reyes_c1_3', 'l5_reyes_c1_4', 'l5_sol_c1_1_stop', 'l5_sol_c1_1_command', 'l5_sol_c1_2', 'l5_reyes_c1_5'];
  }

  /**
   * §4.2 schedule from the recorded durations. Cap: if H passes 25.0 s the gaps after T3 and T6 shrink first (to
   * 0.6 / 0.3), then the T8 hold (to 1.2 s).
   */
  protected sceneSchedule(): Record<SceneCue, number> & { d5: number } {
    const d = lineDuration;
    const d1 = d('l5_reyes_c1_1'), d2 = d('l5_reyes_c1_2'), d3 = d('l5_reyes_c1_3'), d4 = d('l5_reyes_c1_4');
    const d5 = d(this.choiceId('l5_sol_c1_1')), d6 = d('l5_sol_c1_2');
    const build = (g3: number, g6: number, hold8: number) => {
      const T = { S1: 0, S2: 0.6, T1: 2.2 } as Record<SceneCue, number>;
      T.T2 = T.T1 + d1 + 0.35;
      T.T3 = T.T2 + d2 + 0.30;
      T.T4 = T.T3 + d3 + g3;
      T.T5 = T.T4 + d4 + 0.90;
      T.T6 = T.T5 + d5 + 0.50;
      T.T7 = T.T6 + d6 + g6;
      T.T8 = T.T7 + 1.60;
      T.T9 = T.T8 + hold8;
      // (as built: the actor eases into his walk — 2.3 s left him in the doorway when the leaves closed; 2.9 s puts
      // him ≈ 0.55 m past the door plane, measured on the real body)
      T.T10 = T.T9 + 2.90;
      T.H = T.T10 + 0.30;
      return T;
    };
    let T = build(1.2, 0.6, 1.6);
    if (T.H > SCENE_MAX5) T = build(0.6, 0.3, 1.6);
    if (T.H > SCENE_MAX5) T = build(0.6, 0.3, 1.2);
    if (T.H > SCENE_MAX5) console.error(`[story] the level-5 scene runs ${T.H.toFixed(2)} s (> ${SCENE_MAX5})`);
    return Object.assign(T, { d5 });
  }

  // ── the actor's points (bones by name, fallbacks by height) ──
  protected solHead = (): V3 => this.bonePoint(this.sol?.object, ['head'], 1.62, this._h);
  protected solNape = (): V3 => {
    const o = this.sol?.object;
    const neck = this.bonePoint(o, ['neck'], 1.5, this._n);
    if (o) {
      // a hand's breadth behind the neck bone, on his back (the Clasp's halo)
      const yaw = o.rotation.y;
      neck.x += Math.sin(yaw) * 0.06; neck.z += Math.cos(yaw) * 0.06;
    }
    return neck;
  };
  protected solChest = (): V3 => this.bonePoint(this.sol?.object, ['spine2', 'chest'], 1.3, this._c);

  /** The actor is through a door: his capsule (r 0.32) clear of its 0.4 m wall on the far side from the camera. */
  protected solClear(d: { position: THREE.Vector3 }): boolean {
    const o = this.sol?.object;
    if (!o) return true;
    return o.position.z <= d.position.z - 0.2 - 0.35;
  }

  protected makeSoldierActor(): EnemyActor | null {
    this.dropSoldierActor();
    let a: EnemyActor | null = null;
    try {
      const p = this.mk('mk5_c1_sol');
      // yaw +π/2: he stands side-on, facing −x (§4.2), then turns to the camera
      a = this.ctx.enemies.actor('soldier', p, Math.PI / 2, 'hold', { name: '브레케' }) ?? null;
    } catch (e) { console.warn('[story] soldier actor failed', e); }
    if (!a) return null;
    this.actors.add(a);
    this.sol = a;
    this.talk.bindActor('soldier', () => this.sol);
    try { a.prop?.('led', 'red'); } catch { /* ignore */ }
    return a;
  }
  protected dropSoldierActor(): void {
    if (this.sol) this.drop(this.sol);
    this.sol = null;
  }
  /** Turn the actor on the spot to face a point over `seconds` (W3a `prop('face')`; the stub rig: its yaw). */
  protected faceTo(a: EnemyActor | null, p: V3, seconds: number): void {
    if (!a) return;
    try {
      if (typeof a.prop === 'function') a.prop('face', { to: p.clone(), seconds });
    } catch { /* ignore */ }
  }

  /** The scene's precondition (§4.2, S2): B2, no awake hostile, none hunting, none in gate5 / duty5 / ready5. */
  protected sceneReady(): boolean {
    if (this.phase !== 'B2') return false;
    let bad = false;
    try {
      bad = this.ctx.enemies.activeCount > 0 || this.ctx.enemies.all.some((e) => e.alive && (e.state !== 'dormant'
        || ['gate5', 'duty5', 'ready5'].includes(this.roomOf(e.position) ?? '')));
    } catch { /* ignore */ }
    return !bad;
  }

  /** The scene "Under control". Resolves with the result (the end state is applied by both endings). */
  protected async sceneUnderControl(): Promise<CutResult> {
    const cut = this.cut!;
    // lines decoded before the camera is taken: ≤ 1.5 s, the player held in place meanwhile (camera free)
    const ids = this.sceneLines();
    let ready = false;
    const pr = this.linesReady(ids, 1.5).then(() => { ready = true; });
    await this.hold(0.02);
    if (!ready) { try { this.ctx.player.cinematic(true, { viewmodel: 'lowered' }); } catch { /* ignore */ } await pr; }
    const T = this.sceneSchedule();
    this.sceneTimes = Object.fromEntries(Object.entries(T).filter(([k]) => k !== 'd5').map(([k, v]) => [k, +v.toFixed(3)]));
    const cam0 = this.mk('mk5_c1_cam0'), cam1 = this.mk('mk5_c1_cam1');
    const solP = this.mk('mk5_c1_sol'), doorP = this.mk('mk5_c1_door'), outP = this.mk('mk5_c1_out'), endP = this.mk('mk5_c1_end');
    const duty = this.door('d5_duty');
    const dutyLook = duty ? duty.position.clone().setY(this.doorFloor(duty) + 1.5) : cam0.clone().add(V(0, -0.15, -1.4));
    const endYaw = Math.atan2(-(doorP.x - endP.x), -(doorP.z - endP.z));
    const tilt = () => this.solHead().clone().add(V(0.22, -0.06, 0));
    let a: EnemyActor | null = null;
    // a scene line on its cue: `now` (starts on this frame), `cue` = this instant (the H5 log), gap tiny (the scene owns them)
    const say = (id: string, at?: () => V3) => {
      void this.say(id, { pri: 'scene', now: true, gap: 0.02, cue: this.now, at: at ?? undefined });
    };
    const cues: CamCue[] = [
      { t: 0, run: () => {
        this.talk.flush(true);
        // phase C with the camera: d5_duty opens (its own sound) on him; d5_ready shut
        this.set('inScene', true);
        a = this.makeSoldierActor();
      } },
      // (a non-human actor reads a live object once: his head is re-pinned on the moving camera while it dollies)
      { t: 1.0, run: () => this.lookAt(a, cut.eye) },
      { t: 2.0, run: () => this.lookAt(a, cut.eye) },
      { t: 3.0, run: () => this.lookAt(a, cut.eye) },
      { t: 3.6, run: () => this.lookAt(a, cut.eye) },
      { t: 1.5, run: () => this.faceTo(a, cam1.clone().setY(solP.y), 0.8) },
      { t: T.T1, run: () => say('l5_reyes_c1_1') },
      { t: T.T2, run: () => say('l5_reyes_c1_2') },
      { t: T.T3, run: () => say('l5_reyes_c1_3') },
      // he only looks; his head tilts 4° in the silence
      { t: T.T3 + lineDuration('l5_reyes_c1_3') + 0.6, run: () => this.lookAt(a, tilt()) },
      { t: T.T4, run: () => { this.lookAt(a, cut.eye); say('l5_reyes_c1_4'); } },
      // CHOIR's voice through his throat mic, at his head (speak() micro-motion from the channel's actor binding)
      { t: T.T5, run: () => say(this.choiceId('l5_sol_c1_1'), () => this.solHead().clone()) },
      { t: T.T6, run: () => say('l5_sol_c1_2', () => this.solHead().clone()) },
      // he turns away toward the ready door: his back (and the Clasp) to the camera
      { t: T.T7, run: () => { this.lookAt(a, doorP.clone().setY(1.6)); this.faceTo(a, doorP, 1.0); } },
      { t: T.T9, run: () => this.holdOpen('d5_ready') },
      // (one straight leg through the door: a waypoint at the door made him slow to a stop in the doorway)
      { t: T.T9 + 0.3, run: () => { this.pose(a, 'walk'); void this.walk(a, [outP], 1.4); } },
      { t: T.T9 + 1.0, run: () => say('l5_reyes_c1_5') },
      // the leaves close behind him — never on him: if he is not yet clear of the wall, they wait for him (≤ 0.6 s)
      { t: T.T10, run: () => { this.S('l5_c1_door', async () => {
        const d = this.door('d5_ready');
        if (d) await this.untilOr(() => !this.sol || this.solClear(d), 0.6);
        try { d?.close(); d?.lock(); } catch { /* ignore */ }
      }); } },
    ];
    // (stamp each cue's script time when it runs: the playthrough compares lines with their cues)
    const shots: CamShot[] = [
      // S1: the eye blends from the player's eye to cam0, looking at the door centre (body already at the end mark)
      { dur: 0.6, eye: cam0, look: dutyLook, fov: 72, enter: 'blend', blend: 0.6, body: endP, bodyYaw: endYaw },
      // S2: dolly cam0 → cam1 over 3.0 s (linear, 1.7 m/s), look = his head (live), fov 72 → 60
      { dur: 3.0, eye: [cam0, cam1], look: this.solHead, fov: [72, 60], ease: 'linear', enter: 'blend', blend: 0.5 },
      // (S2 → S3: hold at cam1 until T2)
      ...(T.T2 > 3.6 + 1e-3 ? [{ dur: T.T2 - 3.6, eye: cam1, look: this.solHead, fov: 60 } as CamShot] : []),
      // S3: hold at cam1, look his head, fov 60 → 52 over the whole shot, sway 0.6
      { dur: T.T7 + 0.3 - Math.max(3.6, T.T2), eye: cam1, look: this.solHead, fov: [60, 52], sway: 0.6, ease: 'linear' },
      // S4: look → his nape (live), fov 52 → 30 over 1.2 s (inOut)
      { dur: 1.2, eye: cam1, look: this.solNape, fov: [52, 30], sway: 0.4, ease: 'inOut' },
      // T8: hold on the nape — the Clasp's mark blinks red (1 Hz) twice in view
      { dur: T.T9 - (T.T7 + 1.5), eye: cam1, look: this.solNape, fov: 30, sway: 0.3 },
      // S5: look → his chest (live), fov 30 → 60 over 0.8 s, as he walks out
      { dur: 0.8, eye: cam1, look: this.solChest, fov: [30, 60], sway: 0.5 },
      // hand-back: onto the player's own view at mk5_c1_end, yaw toward the ready door (continuous)
      { dur: T.H - (T.T9 + 0.8), eye: cam1, look: this.solChest, fov: 60, handback: true },
    ];
    this.stamp('scene_start');
    const r = await cut.play('l5_c1', shots, {
      place: { pos: endP.clone(), yaw: endYaw, pitch: 0 },
      viewmodel: 'lowered', topUp: true, cues,
      end: (how) => { if (how === 'skipped') this.talk.flush(); this.sceneEnd(how === 'skipped' ? 'skipped' : 'played'); },
    });
    return r;
  }

  /**
   * The scene's end state — natural end, skip and a `cp5_duty` load are the same: the actor gone (he is behind the shut
   * ready door), d5_duty auto and d5_ready locked (phase D0), the scene flag. `g5_s1` is spawned by the caller.
   */
  protected sceneEnd(result: 'played' | 'skipped'): void {
    this.sceneResult = result;
    // (played: he is removed once the ready door is shut on him — never in view; skipped / a load: at once)
    const d = this.door('d5_ready');
    const a = this.sol;
    if (result === 'played' && a && d && !this.isShut(d)) {
      this.S('l5_c1_drop', async () => {
        await this.untilOr(() => this.isShut(d), 1.5);
        if (this.sol === a) this.dropSoldierActor();
        else this.drop(a);
      });
    } else this.dropSoldierActor();
    this.f.inScene = false;
    if (!this.f.scene) this.set('scene', true);
    else this.syncPhase();
  }
}
