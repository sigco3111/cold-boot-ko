/**
 * Level 3 — the two non-interactive cutscenes (stage 3a §4; D8, D9, D11).
 *
 *   C1 "Sealed in till tomorrow" (13.0 s + 1.6 s black): the inner door opens on Halvorsen; he talks, his eyes drop to
 *      the lowered weapon, Reyes asks for a phone, he beckons and walks west, the eye follows him, fade. Under the
 *      black: the body to the visitor chair, the inner door shut + locked, S2 snapped, Halvorsen in his chair, the
 *      murmur. `then: 'hold'` → C2.
 *   C2 "Camera one" (≤ C2_MAX = 45 s, ≈ 41 s): patient disbelief, the monitor turned to CAM 01 (the pressure door
 *      opens, the three units in the lock walk out at 100 % open, west into the lobby) — and then he SEES it: short,
 *      broken lines with silences the schedule owns (see c2Times), CAM 04 (Line Two: dark after STOP, lit and waiting
 *      after COMMAND), the dead phone, CHOIR from the ceiling speaker, the screens die, the takeover, a long stare,
 *      the plea, the badge; the release: the eye rises from the chair already turning to the door (hand-back).
 *
 * A scene does not start until its lines are decoded and processed (`linesReady`): a cue's line then starts on the
 * cue's frame (the say → buffer start is a few ms; the takes' lead-in is skipped by the audio, manifest `lead`).
 *
 * Line times are anchored on the previous line's recorded end (`lineDuration`) + a short gap; camera beats follow the
 * plan's table and shift with the lines. Every effect is a cue on the scene clock; the end state (`c1End` / `c2End`)
 * is applied by BOTH a natural end and a skip, and is the same state a `cp3_office` load rebuilds.
 */
import * as THREE from 'three';
import type { EnemyActor, FeedHandle } from '../../core/types';
import type { CamShot, CamCue, Cutscene, CutResult } from '../cutscene';
import { yawPitchTo } from '../cutscene';
import { lineDuration } from '../voice';
import { Base3, C1P, CAM01, CAM04, FEED_UNITS, FEED_WALK, LOBBY_DOOR, OFFICE, PUPPET_END, PUPPET_LOCK, PUPPET_PATH, V } from './base';
import { SCREEN3, TOAST3, wallClock } from './text';

type V3 = THREE.Vector3;
const PI = Math.PI;
/** C2's longest allowed run (s): the broken delivery and its silences (user notes after I1); playthrough-l3 checks it. */
export const C2_MAX = 45;

/** Render feed options (render/feed.ts `FeedOptions`; the contract type is narrower). */
interface FeedOpts { name: string; rooms: string[]; position?: V3; target?: V3; fov?: number; label?: string; clock?: () => string; active?: boolean; hz?: number; pinLights?: boolean | unknown[]; exposure?: number }

export interface SceneTimes { [k: string]: number }

export abstract class Scenes3 extends Base3 {
  /** Set by index.ts (the page's camera rig). */
  cut: Cutscene | null = null;
  protected feeds: { cam01: FeedHandle | null; cam04: FeedHandle | null } = { cam01: null, cam04: null };
  /** Scene schedules (debugState / the playthrough). */
  protected sceneTimes: { c1?: SceneTimes; c2?: SceneTimes } = {};
  protected sceneLog: { id: string; result: CutResult; at: number; dur: number }[] = [];
  private _head = new THREE.Vector3();
  private _mon = new THREE.Vector3();
  private _up = new THREE.Vector3();

  // ───────────────────────────────────────────────────────────── the cast

  /** Halvorsen (absent until his beat). `at`: 'h1' behind the inner door (C1), 'h2' in his chair. */
  protected makeHalv(at: 'h1' | 'h2'): EnemyActor | null {
    this.dropHalv();
    let a: EnemyActor | null = null;
    try {
      const pos = at === 'h1' ? C1P.h1.clone() : OFFICE.seat.clone();
      a = this.ctx.enemies.actor('human', pos, at === 'h1' ? -PI / 2 : OFFICE.seatYaw, at === 'h1' ? 'idle' : 'sit_desk', { who: 'halvorsen' }) ?? null;
    } catch (e) { console.warn('[story] Halvorsen actor failed', e); }
    if (!a) return null;
    this.actors.add(a);
    this.halv = a;
    this.halvAt = at;
    this.halvPose = at === 'h1' ? 'idle' : 'sit_desk';
    const P = (n: string, v: unknown) => { try { a!.prop?.(n, v); } catch { /* ignore */ } };
    if (at === 'h1') { P('mug', true); P('badge', 'lanyard'); }
    else {
      P('mug', false);
      P('desk', OFFICE.desk);
      P('phone', OFFICE.phone);
      P('badgeTarget', OFFICE.badge);
      const arm = this.monitorArm();
      if (arm) P('monitor', arm);
      P('badge', this.f.office ? 'none' : 'lanyard');
    }
    return a;
  }
  protected dropHalv(): void {
    if (this.halv) this.drop(this.halv);
    this.halv = null;
    this.halvAt = 'none';
  }
  protected monitorArm(): THREE.Object3D | null {
    try { return this.ctx.level.object('office_monitor_arm') ?? null; } catch { return null; }
  }
  /** The monitor on its pivot (the level's `office_monitor_arm`; never moved): facing him, or turned to the visitor. */
  protected resetMonitor(turned: boolean): void {
    const arm = this.monitorArm();
    if (!arm) return;
    arm.rotation.set(0, turned ? PI : 0, 0);
    arm.updateMatrixWorld(true);
  }
  /** His eyes (live): the head bone + 7 cm; fallback by pose. */
  protected halvHead = (up = 0.07): V3 => {
    const a = this.halv, o = a?.object.getObjectByName('head');
    if (o) { o.getWorldPosition(this._head); this._head.y += up; return this._head; }
    const p = a?.position ?? OFFICE.seat;
    return this._head.set(p.x, p.y + (this.halvAt === 'h2' ? 1.22 : 1.66), p.z);
  };
  protected monitorPoint = (): V3 => {
    // the screen's centre (the arm's mesh), not the pivot
    const arm = this.monitorArm();
    if (!arm) return this._mon.copy(OFFICE.monitorArm);
    let mesh: THREE.Object3D | null = null;
    arm.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o; });
    return (mesh ?? arm).getWorldPosition(this._mon);
  };

  /** The three C2 units (actors, solid; sealed in the lock, later in the lobby). */
  protected makePuppets(where: 'lock' | 'end'): void {
    this.dropPuppets();
    const at = where === 'lock' ? PUPPET_LOCK : PUPPET_END;
    for (const p of at) {
      const a = this.actor('husk', p.clone(), where === 'lock' ? 0 : PI / 2, 'idle');
      if (!a) continue;
      this.eyes(a, true);
      this.puppets.push(a);
    }
  }
  protected dropPuppets(): void {
    for (const a of this.puppets.splice(0)) this.drop(a);
  }

  // ───────────────────────────────────────────────────────────── feeds

  protected makeFeed(which: 'cam01' | 'cam04', active: boolean): FeedHandle | null {
    if (this.feeds[which]) return this.feeds[which];
    const r = this.ctx.render as unknown as { feed?: (o: FeedOpts) => FeedHandle };
    if (typeof r.feed !== 'function') return null;
    const c = which === 'cam01' ? CAM01 : CAM04;
    try {
      const h = r.feed({
        name: which, rooms: which === 'cam01' ? ['gallery_n', 'lock', 'lobby'] : ['feed_l2'],
        position: c.pos.clone(), target: c.look.clone(), fov: c.fov, active, hz: 12,
        label: which === 'cam01' ? 'CAM 01  GALLERY N' : 'CAM 04  2번 라인',
        clock: () => wallClock(this.t, true),
        // CAM 04's set has one light, far from the player: pin it explicitly (the default pin search found none)
        ...(which === 'cam04' ? { pinLights: [...this.ctx.render.lights.group('feed_l2')], exposure: 2.0 } : { exposure: 0.7 }),
      });
      this.feeds[which] = h;
      return h;
    } catch (e) { console.warn(`[story] feed ${which} failed`, e); return null; }
  }
  protected bindMonitor(which: 'cam01' | 'cam04'): void {
    const h = this.feeds[which], m = this.mat('office_monitor');
    if (!m) return;
    try {
      if (h) this.ctx.materials.setScreen(m, 'feed', { texture: h.texture });
      else this.ctx.materials.setScreen(m, 'camera_feed');
    } catch { /* ignore */ }
  }
  protected dropFeeds(): void {
    for (const k of ['cam01', 'cam04'] as const) {
      const h = this.feeds[k];
      if (h) { try { h.remove(); } catch { /* ignore */ } }
      this.feeds[k] = null;
    }
  }
  /** CAM 04's set: 8 units on the apron (STOP: dark, heads down; COMMAND: lit, facing the camera) + 2 walkers. */
  protected makeFeedSet(): void {
    this.dropFeedSet();
    const lit = this.choice === 'command';
    for (const p of FEED_UNITS) {
      const a = this.actor('husk', p.clone(), PI, lit ? 'idle' : 'standing');
      if (!a) continue;
      this.eyes(a, lit);
      if (lit) this.lookAt(a, CAM04.pos.clone());
      this.feedActors.push(a);
    }
    for (let i = 0; i < 2; i++) {
      const a = this.actor('husk', FEED_WALK[0].clone().add(V(-1.6 * i, 0, 0.4 * i)), -PI / 2, 'idle');
      if (!a) continue;
      this.eyes(a, true);
      this.feedActors.push(a);
    }
    this.w.lights('feed_l2', { enabled: true, intensityScale: 2.5 });
  }
  protected dropFeedSet(): void {
    for (const a of this.feedActors.splice(0)) this.drop(a);
    this.w.lights('feed_l2', { enabled: false });
  }

  /** The player's flashlight is off in the lit office (C2: it would glare on the monitor); back as it was at the end. */
  private lampWas = false;
  private lampSet = false;
  protected lamp(on: boolean): void {
    const p = this.ctx.player as unknown as { flashlightOn: boolean; applyLoadout?: (s: { flashlight: boolean }) => void };
    const put = (v: boolean) => { try { if (p.flashlightOn !== v) p.applyLoadout?.({ flashlight: v }); } catch { /* ignore */ } };
    if (!on) { if (!this.lampSet) { this.lampWas = p.flashlightOn; this.lampSet = true; } put(false); return; }
    if (this.lampSet) { put(this.lampWas); this.lampSet = false; }
  }

  /**
   * Wait (wall clock, ≤ `timeout` s) until every line in `ids` is fetched, decoded and processed by the audio — so a
   * cue's line starts on the cue's frame, with its gesture. Normally instant (the level preloads its lines at boot).
   */
  protected async linesReady(ids: string[], timeout: number): Promise<boolean> {
    const a = this.ctx.audio as unknown as { preloadVoice?: (ids: string[]) => Promise<void> };
    if (typeof a.preloadVoice !== 'function') return true;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      a.preloadVoice(ids).then(() => { done = true; }, () => undefined),
      new Promise<void>((r) => { timer = setTimeout(r, timeout * 1000); }),
    ]);
    if (timer) clearTimeout(timer);
    if (!done) console.warn(`[story] scene lines not ready after ${timeout} s — starting anyway`);
    return done;
  }

  // ───────────────────────────────────────────────────────────── C1

  /** The lowered weapon, seen from his side: a little ahead of and well below the eye. */
  private lowGun(): V3 {
    const c = this.ctx.camera;
    return new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion).setY(0).normalize().multiplyScalar(0.4).add(c.position).add(V(0, -0.85, 0));
  }

  /** C1's body (I1): where the player stands in the gallery, clamped west of the lock door so the walk fits 13 s. */
  protected c1Body(): V3 {
    const p = this.pos;
    const x = THREE.MathUtils.clamp(p.x, C1P.bodyX[0], C1P.bodyX[1]);
    return V(x, C1P.body.y, THREE.MathUtils.clamp(p.z, -10.2, -8.6));
  }
  /** Where he stops: ≈ 4.2 m short of the body (the marker `halv_c1_meet` for the nominal body), never in the doorway. */
  protected c1Meet(body: V3): V3 {
    return V(Math.max(-11.3, body.x + (C1P.meet.x - C1P.body.x)), C1P.meet.y, C1P.meet.z);
  }

  /**
   * C1 schedule (I1). Every gesture starts WITH its line (the recorded durations, `lineDuration`): the startle is the
   * "Christ—"; he talks while he hurries up the gallery; his eyes drop to the gun with "Is that a gun?"; the beckon
   * with "Okay. Okay. My office." The walk length depends on where the player stands (`walkS`).
   */
  protected c1Times(walkS = 5.1): SceneTimes {
    const d1 = Math.max(lineDuration('l3_halv_c1_1'), lineDuration('l3_halv_c1_1_shots'));
    const d2 = this.ctx.player.currentWeapon !== null ? lineDuration('l3_halv_c1_2') : lineDuration('l3_halv_c1_2b');
    const d3 = lineDuration('l3_reyes_phone');
    const d4 = lineDuration('l3_halv_c1_3');
    const gap = 0.08;
    const T: SceneTimes = { door: 0.3, startle: 0.6 };
    T.l1 = T.startle + 0.05;                       // the startle IS the first word
    T.go = T.l1 + 0.25;                            // he comes at once, talking
    T.arrive = T.go + walkS;
    T.l2 = Math.max(T.l1 + d1 + gap, T.arrive - 0.25);
    T.l3 = T.l2 + d2 + gap;
    T.l4 = T.l3 + d3 + gap;
    T.beckon = T.l4;
    T.walk = T.l4 + 0.4;
    T.dolly = T.walk + 0.25;
    T.fade = Math.min(11.8, Math.max(T.dolly + 0.6, T.l4 + d4 - 0.5));
    T.end = T.fade + 1.2;
    T.black = 1.6;
    return T;
  }

  /** C1 — "Sealed in till tomorrow". Resolves with the scene result; the player is held for C2 (`then: 'hold'`). */
  protected async sceneC1(): Promise<CutResult> {
    const cut = this.cut!;
    // its lines ready before the first cue (normally cached long before); C2's start loading now
    await this.linesReady(['l3_halv_c1_1', 'l3_halv_c1_1_shots', 'l3_halv_c1_2', 'l3_halv_c1_2b', 'l3_reyes_phone', 'l3_halv_c1_3', 'l3_reyes_murmur'], 1.5);
    void this.linesReady(this.c2Lines(), 20);
    const body = this.c1Body();
    const meet = this.c1Meet(body);
    const SPEED = 1.4;
    const T = this.c1Times(C1P.h1.distanceTo(meet) / SPEED);
    this.sceneTimes.c1 = T;
    const a = this.makeHalv('h1');
    const head = () => this.halvHead(0.02);
    const E0 = body.clone().setY(body.y + 1.65), E1 = E0.clone().add(V(-0.15, 0, 0));
    const Ed = V(Math.max(meet.x + 3.0, body.x - 1.0), E0.y, E0.z);   // (a short step after him, never up to him)
    const say = (id: string, at?: () => V3) => { void this.say(id, { pri: 'scene', now: true, gap: 0.05, at: at ?? (() => this.halvHead(0)) }); };
    const cues: CamCue[] = [
      { t: 0, run: () => { this.talk.flush(true); this.lamp(false); this.holdOpen('d3_lobby'); } },
      { t: T.door, run: () => { this.beat('l3_meet'); this.sfx('door_open', LOBBY_DOOR.clone(), 0.6); } },
      { t: T.startle, run: () => { this.pose(a, 'startle'); this.sfx('mug_clink', C1P.h1.clone().setY(5.9), 0.6); } },
      { t: T.l1, run: () => say('l3_halv_c1_1') },
      { t: T.go, run: () => { this.pose(a, 'talk'); void this.walk(a, [meet], SPEED); } },
      { t: T.l2, run: () => { this.pose(a, 'talk'); say('l3_halv_c1_2'); this.lookAt(a, this.lowGun()); } },
      { t: T.l2 + 1.0, run: () => this.lookAt(a, cut.eye) },
      { t: T.l3, run: () => { this.pose(a, 'idle'); void this.say('l3_reyes_phone', { pri: 'scene', now: true, gap: 0.05 }); } },
      { t: T.l4, run: () => { say('l3_halv_c1_3'); this.pose(a, 'beckon'); } },
      { t: T.walk, run: () => { this.pose(a, 'idle'); void this.walk(a, [C1P.walk], 1.1); } },
      { t: T.fade, run: () => { this.stopLoop('radio_admin', 1.2); } },
    ];
    // a long snap (the player ran up the gallery) blends a little longer
    const blend = THREE.MathUtils.clamp(0.35 + 0.06 * this.pos.distanceTo(body), 0.35, 0.8);
    const shots: CamShot[] = [
      // (he is 7-12 m away at first: the push 72 -> 46 brings him up to a readable size as he arrives)
      { dur: T.dolly, eye: [E0, E1], look: head, fov: [72, 46], enter: 'blend', blend, body, bodyYaw: PI / 2, ease: 'linear' },
      { dur: T.fade - T.dolly, eye: [E1, Ed], look: () => this.halvHead(0.1), fov: [46, 56], body: 'follow' },
      { dur: T.end - T.fade, eye: Ed, look: () => this.halvHead(0.1), fov: 56, fadeOut: 1.2, body: 'follow' },
      {
        dur: T.black, eye: Ed, black: true,
        cues: [
          { t: 0.05, run: () => this.c1Black(), skip: () => { /* c1End */ } },
          { t: 0.3, run: () => this.murmur() },
          { t: 0.9, run: () => this.sfx('chair_creak', OFFICE.visitor.clone().setY(5.2), 0.6) },
        ],
      },
    ];
    const r = await cut.play('l3_c1', shots, {
      place: { pos: OFFICE.visitor.clone(), yaw: PI / 2, pitch: 0 },
      viewmodel: 'lowered', then: 'hold', pin: a ? [a] : [], cues,
      when: () => this.sceneReady(),
      end: (how) => { if (how === 'skipped') this.talk.flush(); this.c1End(); },
    });
    this.sceneLog.push({ id: 'l3_c1', result: r, at: this.now, dur: cut.debugState().log.slice(-1)[0]?.t ?? 0 });
    return r;
  }

  /** §4.1: no hostile alive, the way back shut and locked, phase C. */
  protected sceneReady(): boolean {
    const lift = this.door('d3_lift'), pd = this.door('d3_pressure');
    let hostile = false;
    try { hostile = this.ctx.enemies.all.some((e) => e.alive); } catch { /* ignore */ }
    const ok = !hostile && (!lift || (lift.locked && lift.closed)) && (!pd || (pd.locked && pd.closed));
    return ok;
  }

  /** Under the black, in order: teleport (the body is already moved by the shot), snap S2, Halvorsen to H2. */
  private c1Black(): void {
    this.ctx.player.teleport(OFFICE.visitor.clone(), PI / 2, 0);
    if (this.once('c2')) { /* consequence sets the flag */ }
    this.snapPhase();
    this.resetMonitor(false);
    if (this.halvAt !== 'h2') this.makeHalv('h2');
  }
  private c1End(): void {
    if (!this.has('l3_meet')) this.beat('l3_meet');
    this.c1Black();
  }
  /** `l3_reyes_murmur`: Reyes, unintelligible (fx room:400 for this call), ducked −10 dB, no subtitle. */
  private murmur(): void {
    try {
      // through the wall, unintelligible: room + low-pass 400 Hz for this call only (AudioSystem.say `fx`). In the ear,
      // not at the office: under the black the listener (the scene camera) is still out in the gallery, 30 m away and
      // behind two walls — positioned there it was measured at ≈ −40 dB, i.e. not heard at all
      this.ctx.audio.say('l3_reyes_murmur', { volume: 0.32, fx: 'room:400' });
      this.talk.log.push({ t: this.now, id: 'l3_reyes_murmur', cond: null, said: 'l3_reyes_murmur', pri: 'over' });
    } catch { /* ignore */ }
  }

  // ───────────────────────────────────────────────────────────── C2

  /** Every line C2 may say (both CHOIR variants): the scene does not start until they are decoded and processed. */
  protected c2Lines(): string[] {
    return ['l3_halv_c2_1', 'l3_halv_c2_2', 'l3_halv_c2_3', 'l3_halv_c2_3b', 'l3_halv_c2_4', 'l3_halv_c2_4b', 'l3_halv_c2_6',
      'l3_halv_c2_6b', 'l3_choir_told_stop', 'l3_choir_told_command', 'l3_choir_quiet', 'l3_halv_c2_7', 'l3_halv_c2_7b',
      'l3_halv_c2_7c', 'l3_reyes_come', 'l3_halv_c2_9', 'l3_halv_c2_9b'];
  }

  /**
   * C2 schedule (I1: speech and movement start together; user notes after I1: he must not read it like a script).
   * Every line is anchored on the previous one's heard end (`lineDuration`: the recording less its lead-in) and each
   * gesture on the START of its line. The silences between his short, broken lines are the scene's, not the takes':
   *   sure    — "…a pressure test." / "It's on the schedule… Look." (he turns the monitor with "Look.")
   *   he SEES — 1.3 s of nothing (the door opening on CAM 01), "That's… that's the pressure door.", a breath,
   *             "That's— it's OPEN. Why is it…" trailing off as the units walk out
   *   thrown  — the camera on him: leaned back, eyes from the screen to Reyes, a hand over his face, back to the screen
   *   CAM 04  — "Line Two… that's Line Two.", a look, "Why are they just… STANDING THERE?" (he leans in to the desk)
   *   phone   — the reach is a beat of its own (1.3 s, the receiver at his ear before he speaks), "No… no tone.",
   *             "There's ALWAYS A TONE."
   *   CHOIR   — he looks up at the speaker; "quiet"; the screens and the lamp die; he flinches in the dark
   *   stare   — ≥ 1.2 s after the lights: he stares at the dead screen, then his eyes come to Reyes
   *   plea    — "The navy." / "Post 4— at the DOCK. Past Biological…" / "You came THROUGH THEM.", cowering;
   *             Reyes "Come with me."; "I can't… I— I CAN'T." (the badge comes off the lanyard); "Take the badge. GO!"
   *             with the push across the desk.
   */
  protected c2Times(): SceneTimes {
    const d = lineDuration;
    const choirId = this.choice === 'command' ? 'l3_choir_told_command' : 'l3_choir_told_stop';
    const T: SceneTimes = {};
    T.l1 = 0.3;
    T.l2 = T.l1 + d('l3_halv_c2_1') + 0.25;
    T.turn = T.l2 + d('l3_halv_c2_2') - 0.6;     // "…Look."
    T.mon = T.turn + 0.8;
    T.door = T.turn + 0.3;                      // the real door opens (2.6 s) as the screen comes round
    T.walk = T.door + 2.65;                     // 100 % open: the units walk out
    T.stare = T.l2 + d('l3_halv_c2_2');         // he has said "Look." — now he looks
    T.l3 = Math.max(T.stare + 1.3, T.door + 1.2);
    T.l3b = T.l3 + d('l3_halv_c2_3') + 0.6;
    T.look = T.l3b + d('l3_halv_c2_3b') + 0.2;  // the camera on him: eyes to Reyes …
    T.rub = T.look + 0.3;                       // … both hands over his face (2.4 s) …
    T.lookBack = T.look + 1.5;                  // … his eyes back to the screen as the hands come down
    T.cam04 = Math.max(T.walk + 1.5, T.look + 2.2);   // (the units seen walking out ≥ 1.5 s first)
    T.l4 = T.cam04 + 0.45;
    T.l4b = T.l4 + d('l3_halv_c2_4') + 0.75;
    T.reach = T.l4b + d('l3_halv_c2_4b') + 0.35; // he reaches for the phone (receiver at his ear ≈ 1 s later)
    T.phone = T.reach;
    T.l6 = T.reach + 1.3;
    T.l6b = T.l6 + d('l3_halv_c2_6') + 0.6;
    T.speaker = T.l6b + d('l3_halv_c2_6b') + 0.3;
    T.choir = T.speaker;
    T.mon2 = T.choir + d(choirId) + 0.25;
    T.quiet = T.mon2;
    T.die = T.quiet + 0.8;                      // monitor -> static -> black
    T.thumbs = T.die + 0.5;
    T.takeover = T.die + 1.0;
    T.lamp = T.die + 1.5;
    T.face = Math.max(T.quiet + d('l3_choir_quiet'), T.lamp) + 0.15;
    T.eyes = T.face + 0.9;                      // the stare ends: his eyes come to Reyes
    T.l7 = T.face + 1.45;                       // ≥ 1.2 s after the lights and CHOIR's last word
    T.l7b = T.l7 + d('l3_halv_c2_7') + 0.6;
    T.l7c = T.l7b + d('l3_halv_c2_7b') + 0.45;
    T.come = T.l7c + d('l3_halv_c2_7c') + 0.3;
    T.l9 = T.come + d('l3_reyes_come') + 0.3;
    T.l9b = T.l9 + d('l3_halv_c2_9') + 0.5;
    T.give = T.l9b;                             // the push lands on "GO!" (the slide is 1.5 s in)
    T.badge = T.l9b + 1.0;
    T.release = Math.max(T.badge + 0.6, T.l9b + d('l3_halv_c2_9b') + 0.05);
    T.end = T.release + 1.4;
    if (T.end > C2_MAX) console.error(`[story] C2 runs ${T.end.toFixed(2)} s (> ${C2_MAX})`);
    return T;
  }

  /** C2 — "Camera one". Ends with control in the office (weapon stowed, badge, phase E). */
  protected async sceneC2(): Promise<CutResult> {
    const cut = this.cut!;
    // (normally all cached long before; never more than 1.5 s of extra black)
    await this.linesReady(this.c2Lines(), 1.5);
    const T = this.c2Times();
    this.sceneTimes.c2 = T;
    if (this.halvAt !== 'h2') this.makeHalv('h2');
    const a = this.halv;
    const E = OFFICE.visitorEye;
    const face = () => this.halvHead(0.0);
    const toward = (from: V3, to: V3, m: number) => from.clone().add(to.clone().sub(from).normalize().multiplyScalar(m));
    const Ep = toward(E, OFFICE.seat.clone().setY(6.0), 0.1);
    // (plan: 0.25 m; 0.8 m so the 0.55 m screen reads at fov 46 — the zoom stays capped at 46)
    const Elean = toward(Ep, OFFICE.monitorArm, 0.8);
    // the stare and the plea: a slow push in on him (from 3 m he was a tenth of the frame for 10 s)
    const Eplea = toward(Ep, OFFICE.seat.clone().setY(5.95), 0.75);
    const bp = yawPitchTo(Eplea, OFFICE.badge);
    const phonePt = OFFICE.seat.clone().lerp(OFFICE.phone, 0.5).setY(6.05);
    const endEye = OFFICE.endPos.clone().setY(OFFICE.endPos.y + 1.65);
    const say = (id: string, at?: () => V3) => { void this.say(id, { pri: 'scene', now: true, gap: 0.1, at: at ?? (() => this.halvHead(0)) }); };
    const choirId = this.choice === 'command' ? 'l3_choir_told_command' : 'l3_choir_told_stop';
    const mon = () => this.monitorPoint().clone();
    const cues: CamCue[] = [
      { t: 0.0, run: () => this.c2Start() },
      { t: 0.05, run: () => { this.pose(a, 'sit_desk'); this.lookAt(a, cut.eye); this.prop(a, 'expr', 'auto'); } },
      // ── sure
      { t: T.l1, run: () => say('l3_halv_c2_1') },
      { t: T.l2, run: () => { say('l3_halv_c2_2'); this.pose(a, 'rub_face'); } },
      { t: T.turn, run: () => { this.pose(a, 'turn_monitor'); this.sfx('chair_creak', OFFICE.seat.clone().setY(5.3), 0.4); } },
      { t: T.door, run: () => { this.openPressureForFeed(); } },
      // ── he sees it
      { t: T.stare, run: () => { this.lookAt(a, mon()); this.prop(a, 'expr', 'disbelief'); } },
      { t: T.l3, run: () => say('l3_halv_c2_3') },
      { t: T.walk, run: () => this.puppetsWalk() },
      { t: T.l3b, run: () => { say('l3_halv_c2_3b'); this.pose(a, 'sit_lean_back'); } },
      // ── thrown (on camera)
      { t: T.look, run: () => this.lookAt(a, cut.eye) },
      { t: T.rub, run: () => this.pose(a, 'rub_face') },
      { t: T.lookBack, run: () => { this.lookAt(a, mon()); this.prop(a, 'expr', 'worry'); } },
      // ── CAM 04
      { t: T.cam04 - 0.7, run: () => { const h = this.feeds.cam04; if (h) h.active = true; this.feedWalkers(); } },
      // (no pose change here: his hands are still coming down from his face — a pose switch mid-overlay crossed his arms)
      { t: T.cam04, run: () => { this.bindMonitor('cam04'); this.sfx('monitor_switch', this.monitorPoint().clone(), 0.5); } },
      { t: T.cam04 + 0.3, run: () => { const h = this.feeds.cam01; if (h) h.active = false; } },
      { t: T.l4, run: () => say('l3_halv_c2_4') },
      { t: T.l4b, run: () => { say('l3_halv_c2_4b'); this.pose(a, 'sit_desk'); this.prop(a, 'expr', 'fear'); } },
      // ── the phone
      { t: T.reach, run: () => { this.pose(a, 'phone_ear'); this.prop(a, 'expr', 'worry'); } },
      { t: T.l6, run: () => { say('l3_halv_c2_6'); this.sfx('phone_dead', OFFICE.phone.clone(), 0.5); } },
      { t: T.l6b, run: () => say('l3_halv_c2_6b') },
      // ── CHOIR
      { t: T.choir, run: () => { this.pose(a, 'phone_down'); this.lookAt(a, OFFICE.speaker.clone()); this.prop(a, 'expr', 'fear'); } },
      { t: T.choir, run: () => void this.say(choirId, { pri: 'scene', now: true, gap: 0.15, at: OFFICE.speaker.clone() }) },
      { t: T.quiet, run: () => { this.lookAt(a, mon()); void this.say('l3_choir_quiet', { pri: 'scene', now: true, gap: 0.15, at: OFFICE.speaker.clone() }); } },
      { t: T.die, run: () => { this.w.screen('office_monitor', 'static'); this.sfx('screen_die', this.monitorPoint().clone(), 0.6); } },
      { t: T.die + 0.3, run: () => { this.screenOff('office_monitor'); this.dropFeeds(); } },
      { t: T.thumbs, run: () => { for (let i = 1; i <= 3; i++) this.screenOff(`office_thumb_${i}`); this.sfx('screen_die', V(-33.8, 6.5, -24.2), 0.5); } },
      { t: T.takeover, run: () => this.takeover(false) },
      { t: T.lamp, run: () => { this.officeDark(); this.sfx('office_die', OFFICE.lamp.clone(), 0.6); this.pose(a, 'flinch'); } },
      // ── the stare, then the plea
      { t: T.eyes, run: () => this.lookAt(a, cut.eye) },
      { t: T.l7, run: () => { this.pose(a, 'cower'); this.prop(a, 'expr', 'fear'); this.lookAt(a, cut.eye); say('l3_halv_c2_7'); } },
      { t: T.l7b, run: () => say('l3_halv_c2_7b') },
      { t: T.l7c, run: () => say('l3_halv_c2_7c') },
      { t: T.come, run: () => void this.say('l3_reyes_come', { pri: 'scene', now: true, gap: 0.1 }) },
      { t: T.l9, run: () => { this.pose(a, 'hand_badge'); say('l3_halv_c2_9'); } },
      { t: T.give, run: () => { this.pose(a, 'give'); say('l3_halv_c2_9b'); } },
      { t: T.release + 0.9, run: () => this.takeBadge() },
    ];
    // (fov: the plan's 60 / 58 framed a 3 m-away man at a tenth of the frame; 52 with the zoom to the screen capped at
    // 46 — still a small, slow change)
    const shots: CamShot[] = [
      { dur: T.turn, eye: [E, Ep], look: face, fov: 52, enter: 'fade', fade: 0.6, body: OFFICE.visitor, bodyYaw: PI / 2, ease: 'linear' },
      { dur: T.mon - T.turn, eye: [Ep, Elean], look: this.monitorPoint, fov: [52, 46], enter: 'blend', blend: 0.8 },
      // the door opens, the silence, his two broken lines, the units walk out
      { dur: T.look - T.mon, eye: Elean, look: this.monitorPoint, fov: 46 },
      // back to him: leaned back, eyes to Reyes, a hand over his face, back to the screen
      { dur: T.cam04 - T.look, eye: Ep, look: face, fov: 52, enter: 'blend', blend: 0.6 },
      { dur: T.phone - T.cam04, eye: Elean, look: this.monitorPoint, fov: 46, enter: 'blend', blend: 0.6 },
      { dur: T.speaker - T.phone, eye: [Elean, Ep], look: phonePt, fov: [46, 52], enter: 'blend', blend: 0.8 },
      // (up toward the speaker, but keeping him in frame looking up with us: a bare ceiling corner reads as nothing)
      { dur: T.mon2 - T.speaker, eye: Ep, look: () => this._up.copy(this.halvHead(0)).lerp(OFFICE.speaker, 0.28), fov: 52, enter: 'blend', blend: 0.8 },
      { dur: T.face - T.mon2, eye: Ep, look: this.monitorPoint, fov: 52, enter: 'blend', blend: 0.8 },
      { dur: T.badge - T.face, eye: [Ep, Eplea], look: face, fov: [52, 44], enter: 'blend', blend: 0.8, ease: 'linear' },
      { dur: T.release - T.badge, eye: Eplea, look: OFFICE.badge, fov: 44, enter: 'blend', blend: 0.6 },
      { dur: T.end - T.release, eye: [Eplea, endEye], yaw: [bp.yaw, OFFICE.endYaw], pitch: [bp.pitch, OFFICE.endPitch], fov: [44, 72], handback: true },
    ];
    const r = await cut.play('l3_c2', shots, {
      place: { pos: OFFICE.endPos.clone(), yaw: OFFICE.endYaw, pitch: OFFICE.endPitch },
      viewmodel: 'hidden', safe: true, topUp: true, pin: a ? [a] : [], cues, fadeIn: 0.6,
      end: (how) => { if (how === 'skipped') this.talk.flush(); this.instantNext = how === 'skipped'; try { this.c2End(); } finally { this.instantNext = false; } },
    });
    this.sceneLog.push({ id: 'l3_c2', result: r, at: this.now, dur: cut.debugState().log.slice(-1)[0]?.t ?? 0 });
    return r;
  }

  /** C2 t 0 (still black): `l3_office_scene`; the puppets sealed in the lock; the feeds; CAM 04's set. */
  private c2Start(): void {
    this.beat('l3_office_scene');
    this.lamp(false);
    this.makePuppets('lock');
    this.makeFeedSet();
    this.makeFeed('cam01', true);
    this.makeFeed('cam04', false);
    this.bindMonitor('cam01');
    this.resetMonitor(false);
  }
  /** The real pressure door opens (story move inside S2: the door is locked in the phase table). */
  private openPressureForFeed(): void {
    const d = this.door('d3_pressure');
    if (!d) return;
    try { d.unlock(); d.auto = false; d.open(); } catch { /* ignore */ }
    this.pressurePanels(SCREEN3.open);
    this.sfx('pdoor_open', this.monitorPoint().clone(), 0.25);
  }
  /** At 100 % open: single file, 1.4 m apart (their start marks), 1.7 m/s, out of the lock, west, into the lobby. */
  private puppetsWalk(): void {
    this.holdOpen('d3_lobby');
    this.puppets.forEach((p, i) => { this.gait(p, 'walk'); void this.walk(p, [PUPPET_PATH[0], PUPPET_PATH[1], PUPPET_END[i]], 1.7); });
  }
  private feedWalkers(): void {
    const walkers = this.feedActors.slice(FEED_UNITS.length);
    walkers.forEach((w, i) => { void this.walk(w, [FEED_WALK[1].clone().add(V(1.6 * i, 0, 0.4 * i))], 1.25); });
  }
  /** The office goes dark: the banker's lamp and fill off, the cold emergency light. */
  protected officeDark(): void {
    this.w.lights('office', { enabled: false });
    this.w.lights('office_emerg', { enabled: true });
    this.screenOff('office_monitor');
    for (let i = 1; i <= 3; i++) this.screenOff(`office_thumb_${i}`);
  }
  /** The takeover at C2 t ≈ 19.4: `l3_takeover` (S2T seal + the cold state). Puppets still in the lobby doorway keep it open. */
  protected takeover(instant: boolean): void {
    if (!this.beat('l3_takeover')) return;
    if (instant) return;
    if (this.puppets.some((p) => p.position.x > -12.8)) {
      this.holdOpen('d3_lobby');
      this.S('lobby_seal', async () => {
        await this.untilOr(() => this.puppets.every((p) => p.position.x < -12.8), 8);
        this.door('d3_lobby')?.lock();
      });
    }
  }
  protected prop(a: EnemyActor | null, name: string, v: unknown): void {
    try { (a as unknown as { prop?: (n: string, v: unknown) => void } | null)?.prop?.(name, v); } catch { /* ignore */ }
  }
  private takeBadge(): void {
    try { this.halv?.prop?.('badge', 'none'); } catch { /* ignore */ }
    if (!this.ctx.player.hasKey('facilities_badge')) {
      this.ctx.player.addKey('facilities_badge');
      this.toast(TOAST3.badge);
    }
  }
  /** C2's end state — natural end, skip and a `cp3_office` load are the same (§4.3). */
  protected c2End(): void {
    if (!this.has('l3_office_scene')) this.beat('l3_office_scene');
    this.lamp(true);
    if (!this.f.takeover) this.beat('l3_takeover');
    this.dropFeedSet();
    this.dropFeeds();
    this.officeDark();
    this.resetMonitor(true);
    // the three units at the inner door, sealed in the lobby (recreated exactly at their marks)
    const placed = this.puppets.length === 3 && this.puppets.every((p, i) => p.position.distanceTo(PUPPET_END[i]) < 0.3);
    if (!placed) this.makePuppets('end');
    this.door('d3_lobby')?.lock();
    this.takeBadge();
    if (this.halvAt !== 'h2') this.makeHalv('h2');
    this.pose(this.halv, 'cower');
    try { this.halv?.prop?.('badge', 'none'); } catch { /* ignore */ }
    this.beat('l3_office');
  }
}
