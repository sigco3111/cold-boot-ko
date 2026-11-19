/**
 * Level 3 — "고요한 쪽" (stage 3a). The flow: the lift and the pressure lock, the quiet side, C1 → C2 (scenes.ts),
 * the office, the escape (admin, canteen, the breach, the sentry), the BIO purge holdout, the inner lock, the end.
 *
 * Rules this file is built on (DESIGN.md R1–R8, plan §9):
 *   R1  every gate is a door state of a phase (the level's `applyPhase`), derived from the record (`phase`);
 *       every door that closes behind the player is a latch (`closeBehind`); nothing waits on the player obeying.
 *   R3  every line has a rule (dialogue.ts), checked when it starts.
 *   R4  nothing hostile exists before its beat; every arrival is through a door / hatch that visibly opens or out
 *       of a sealed space; puppets only with no control or behind a real seal.
 *   R5  the scenes run on their own clock with the way back latched.
 *   Gates never wait on a sleeping / unreachable enemy (`rouse`, `fightOutWhere`).
 */
import * as THREE from 'three';
import type { Enemy, GameContext } from '../../core/types';
import type { Sequencer } from '../sequencer';
import type { MusicDirector } from '../director';
import type { World } from '../world';
import { CHECKPOINT_IDS_L3, type CheckpointIdL3 } from '../save';
import type { CheckpointRule } from '../stage/base';
import { applyPhase3 } from '../../level/l3/phases';
import { BIO_DOOR, HATCH_A, HATCH_B, KITCHEN_DOOR, OFFICE, PDOOR, POOL, RADIO_ADMIN, RADIO_CANTEEN, RING_E, V, type Flags3, type HooksL3 } from './base';
import { Scenes3 } from './scenes';
import { OBJ3, OFFICE_READS, SCREEN3, TOAST3, countdown, fragmentsL3, testHour } from './text';

export const VIGNETTES_L3 = ['canteen_hatch_a', 'canteen_hatch_b', 'atr_roof_hatch'] as const;
const SEALED_DOORS = ['d3_q1', 'd3_q2', 'd3_q3', 'd3_q4', 'd3_q5', 'd3_q6', 'd3_lobby', 'd3_shutter_ne', 'd3_pressure', 'd3_lobby_inner'];
const SHUTTER = V(10.5, 4.8, -12);
/** A point on the quarters side of d3_ring_e: what "line of sight to the door" means (§5.2). */
const RING_E_FACE = V(27.6, 1.4, -31);
const PURGE_S = 15;

export class ScriptL3 extends Scenes3 {
  /** For debugState (check-chain): how the run was armed. */
  loadout: 'carry' | 'direct' | 'none' | 'save' = 'none';
  private liftOpenAt = -1e9;
  private quietAt = -1e9;
  private lastClockS = -1;
  private purgeLen = -1;
  private purgeEndAt = -1e9;
  private spawnLog: { group: string; t: number; seen: boolean }[] = [];
  private knockAt = 0;

  constructor(ctx: GameContext, seq: Sequencer, director: MusicDirector, w: World, logs: Set<string>, hooks: HooksL3) {
    super(ctx, seq, director, w, logs, hooks);
    const ev = ctx.events;
    ev.on('interact', (e) => this.onInteract(e.id));
    ev.on('door:denied', (e) => this.onDenied(e.id));
    ev.on('enemy:died', () => { /* counted by the page */ });
  }

  // ───────────────────────────────────────────────────────────── lasting consequences

  private set(k: keyof Flags3, v: boolean | string): void {
    (this.f as unknown as Record<string, boolean | string>)[k] = v;
    this.syncPhase();
  }

  private readonly CONSEQUENCES: Record<string, () => void> = {
    l3_arrive: () => { this.f.arrived = true; },
    '#lift_open': () => { this.f.liftOpen = true; },
    l3_lock: () => { this.f.latched = true; this.w.screen('lift3_panel', 'terminal_idle', SCREEN3.liftGone); },
    l3_release: () => { this.f.released = true; this.pressurePanels(SCREEN3.released); },
    l3_quiet: () => { this.f.quiet = true; this.quietAt = this.now; this.pressurePanels(SCREEN3.released); },
    l3_meet: () => { this.f.met = true; },
    '#c2': () => { this.f.c2 = true; },
    l3_office_scene: () => { this.f.c2 = true; },
    l3_takeover: () => { this.f.takeover = true; this.takeoverState(this.ff || this.instantNext); },
    l3_office: () => {
      this.f.office = true;
      if (!this.ctx.player.hasKey('facilities_badge')) this.ctx.player.addKey('facilities_badge');
      if (this.ff) { this.officeDark(); this.resetMonitor(true); }
    },
    l3_leave: () => { this.f.left = true; },
    l3_admin_fight: () => { this.f.adminOpen = true; },
    l3_canteen_fight: () => { this.f.canteen = true; },
    l3_breach: () => { this.f.breach = true; },
    '#shutter': () => { this.f.shutter = true; this.nightSign(false); },
    '#garden': () => { this.f.garden = true; if (this.ff) this.w.vignette('atr_roof_hatch'); },
    l3_purge: () => { this.f.purge = true; },
    l3_bio_open: () => { this.f.bioOpen = true; this.w.screen('bio_panel', 'terminal_idle', SCREEN3.bioDone); },
    l3_bio_sealed: () => { this.f.sealed = true; },
  };

  protected consequence(id: string): void {
    const fn = this.CONSEQUENCES[id];
    if (fn) { try { fn(); } catch (e) { console.warn(`[story] consequence ${id} failed`, e); } }
  }

  protected baseline(): void {
    const w = this.w;
    w.screen('lift3_panel', 'terminal_idle', SCREEN3.liftArrive);
    this.pressurePanels(SCREEN3.test(this.t));
    this.lobbyBoard();
    for (let i = 1; i <= 8; i++) w.screen(`admin_screen_${i}`, 'terminal_idle', SCREEN3.admin);
    w.screen('canteen_menu', 'terminal_idle', SCREEN3.menu);
    w.screen('clinic_monitor', 'vitals');
    w.screen('office_monitor', 'camera_feed');
    for (let i = 1; i <= 3; i++) w.screen(`office_thumb_${i}`, 'camera_feed');
    w.screen('bio_reader', 'badge', SCREEN3.reader.idle);
    w.screen('bio_panel', 'terminal_idle', SCREEN3.bioPanel);
    for (const g of ['gallery_emerg', 'lobby_emerg', 'admin_emerg', 'office_emerg', 'stair_w_emerg', 'canteen_emerg', 'clinic_emerg', 'quarters_emerg', 'atrium_emerg', 'feed_l2']) w.lights(g, { enabled: false });
    this.resetMonitor(false);
    this.grade(0.35, 0);
  }

  protected baselineMood(): 'silence' | 'ambient' | 'tension' {
    if (this.f.left) return 'tension';
    if (this.f.takeover) return 'silence';
    return 'ambient';
  }

  // ── fast-forward ──

  protected override afterReplay(): void {
    this.f.kitchenOpen = false;
    this.f.ringOpen = false;
  }
  /** What a phase cannot know: the cast, the inner door held for the admin group. */
  protected override afterSnap(): void {
    const f = this.f;
    if (f.office && !f.breach) { this.makeHalv('h2'); this.pose(this.halv, 'cower'); }
    if (f.office && !f.adminOpen) this.makePuppets('end');
    if (f.left && !f.adminOpen) this.snapLock('d3_lobby_inner');
    this.resetMonitor(f.office);
  }
  private snapLock(id: string): void {
    const d = this.door(id) as (ReturnType<ScriptL3['door']> & { snap?: () => void }) | null;
    try { d?.lock(); d?.snap?.(); } catch { /* ignore */ }
  }

  // ───────────────────────────────────────────────────────────── per frame

  protected override onFrame(dt: number): void {
    const s = this.ctx.state;
    if (s === 'playing' || s === 'cutscene') this.prog.t += dt;
    if (this.talk.busy) this.lastBusyAt = this.now;
  }
  protected override onStep(): void {
    // the one clock (§6.4): the countdown once per second until the release; the lobby board every minute
    const sec = Math.floor(this.t);
    if (sec !== this.lastClockS) {
      this.lastClockS = sec;
      if (!this.f.released) this.pressurePanels(SCREEN3.test(this.t));
      if (!this.f.takeover && sec % 30 === 0) this.lobbyBoard();
    }
    if (this.director.mood !== 'tension' && this.w.active() > 0) this.director.setMood('tension');
  }
  protected override afterObjective(): void { this.quarters(); }

  protected objective(): string {
    if (!this.live || this.ended) return OBJ3.none;
    switch (this.phase) {
      // (C lasts half a second now — he comes to meet the player: no objective flashes up)
      case 'E': case 'F': case 'F_kitchen': case 'G': return OBJ3.post4;
      case 'H': case 'H_ring': return OBJ3.hold;
      case 'I': return OBJ3.enter;
      default: return OBJ3.none;
    }
  }

  // ───────────────────────────────────────────────────────────── checkpoints (§7)

  protected readonly checkpointIds = CHECKPOINT_IDS_L3;
  protected readonly CHECKPOINTS: Record<CheckpointIdL3, CheckpointRule> = {
    cp3_start: { when: () => this.f.latched, valid: () => !this.f.released },
    cp3_office: { when: () => false, valid: () => false }, // saved at C2's end (checkpointNow)
    cp3_canteen: {
      when: () => this.f.left && !this.f.kitchenOpen && (this.inRoom('canteen') || (this.inRoom('stair_w') && this.pos.y < 1 && this.pos.z < -30.5)),
      valid: () => !this.f.breach,
    },
    cp3_balcony: {
      when: () => this.f.breach && this.f.garden && this.fought('g3_breach', 5) && this.fought('g3_garden', 5) && (this.region3('garden') || this.region3('balcony')),
      valid: () => !this.f.purge,
    },
  };
  /** No checkpoint during a scene, the purge, or after the reader was used. */
  protected override checkpointBlocked(): boolean {
    return this.inScene || !!this.cut?.busy || this.f.purge;
  }
  /** The stand in front of the shutter (I1): there while the shutter is down for the night. */
  private nightSign(on: boolean): void {
    // (detached, not hidden: the level's room culling owns `visible`)
    try {
      const o = this.ctx.level.object('shutter_night_sign');
      if (!o) return;
      if (!on) { if (o.parent) { this.signParent = o.parent; o.removeFromParent(); } }
      else if (!o.parent && this.signParent) this.signParent.add(o);
    } catch { /* ignore */ }
  }
  private signParent: THREE.Object3D | null = null;
  /** Review: the takeover's lights / grade / effects / screens now (no beat, no doors) — frames from anywhere. */
  debugTakeover(): void { this.takeoverState(false); }
  /** Stage 3b D20: the test hour now (3a's CLOCK: 62 + t/3600) — carried to 3b as fact `testHour`. */
  clockHour(): number { return testHour(this.t); }
  /** Debug / check-chain: write a checkpoint now. */
  debugCheckpoint(id: CheckpointIdL3): boolean {
    try { this.hooks.checkpoint(id); if (!this.prog.checkpoints.includes(id)) this.prog.checkpoints.push(id); return true; } catch { return false; }
  }

  // ───────────────────────────────────────────────────────────── flow

  start(): void {
    if (this.started) return;
    this.started = true;
    const f = this.f;
    if (!this.restoredFrom) {
      this.baseline();
      this.snapPhase();
      this.director.setMood('ambient');
    }
    if (!f.takeover) {
      this.startLoop('radio_admin', 'radio_music', RADIO_ADMIN, 0.55);
      this.startLoop('radio_canteen', 'radio_music', RADIO_CANTEEN, 0.35);
      this.startLoop('fountain', 'fountain_loop', POOL, 0.6);
      this.startLoop('aquarium', 'aquarium_loop', OFFICE.aquarium, 0.35);
    }
    this.lastMovePos.copy(this.pos);
    this.lastMoveAt = this.now;
    const S = (n: string, fn: () => Promise<unknown>) => this.S(n, fn);
    S('arrival', () => this.arrival());
    S('lift_latch', () => this.liftLatch());
    S('release', () => this.release());
    S('pressure_latch', () => this.pressureLatch());
    S('meet', () => this.meet());
    S('office_talk', () => this.officeTalk());
    S('office_latch', () => this.officeLatch());
    S('admin', () => this.adminGroup());
    S('pa', () => this.residentsPa());
    S('canteen', () => this.canteen());
    S('canteen_line', () => this.canteenLine());
    S('breach', () => this.breach());
    S('bio_latch', () => this.bioLatch());
    S('end', () => this.endThread());
  }

  /** A new run: control in the lift (it is still arriving; its door is phase A's). */
  begin(short: boolean): void {
    this.short = short;
    this.live = true;
    this.ctx.player.controlsEnabled = true;
    this.ctx.ui.setHudVisible(true);
    this.ctx.setState('playing');
  }
  private short = true;

  /** After a checkpoint load (`resumed`): live; the office load keeps the weapon stowed (D23). */
  resumeLive(): void {
    this.live = true;
    if (this.f.office) this.controlAt = this.now;
    if (this.f.office && !this.f.left) this.ctx.player.setSafe?.(true);
    this.ctx.ui.setHudVisible(true);
  }

  private async arrival(): Promise<void> {
    if (this.f.liftOpen) return;
    await this.until(() => this.live && this.ctx.state === 'playing');
    if (!this.f.arrived) {
      await this.hold(this.short ? 0.6 : 2.2);
      this.sfx('elevator_arrive', V(0, 5.6, 2.5), 0.7);
      this.beat('l3_arrive');
      await this.say('l3_unit_lift_arrive', { name: '서비스 리프트', at: V(1.6, 6.6, 2.5) });
      await this.hold(0.4);
    }
    if (this.once('lift_open')) this.liftOpenAt = this.now;
  }

  /** A2 → B: `t3_lock` after the lift has been open ≥ 1.5 s; the lift latches and leaves. */
  private async liftLatch(): Promise<void> {
    await this.until(() => this.f.liftOpen);
    if (this.liftOpenAt < -1e8) this.liftOpenAt = this.now - 2;
    while (!this.f.latched) {
      await this.until(() => this.at('t3_lock') && this.now - this.liftOpenAt >= 1.5);
      const ok = await this.closeBehind('d3_lift', () => this.pos.z < -0.6);
      if (ok) {
        this.beat('l3_lock');
        this.sfx('elevator_start', V(0, 5.6, 2.5), 0.6);
        break;
      }
      await this.hold(1.0);
    }
  }

  /** B → B2 (D6): CHOIR releases the door for Reyes — `t3_pdoor` + 2.0 s equalising. No line. */
  private async release(): Promise<void> {
    await this.until(() => this.f.latched && this.at('t3_pdoor'));
    if (this.f.released) return;
    this.pressurePanels(SCREEN3.equalising);
    this.sfx('pdoor_release', PDOOR, 0.8);
    await this.hold(2.0);
    this.beat('l3_release');
    this.sfx('pdoor_open', PDOOR, 0.9);
    this.S('pdoor_open_panel', async () => { await this.hold(2.8); if (!this.f.quiet) this.pressurePanels(SCREEN3.open); });
  }

  /** B2 → C: the pressure door latches behind the player in the gallery. */
  private async pressureLatch(): Promise<void> {
    await this.until(() => this.f.released);
    while (!this.f.quiet) {
      await this.until(() => this.at('t3_gallery'));
      const ok = await this.closeBehind('d3_pressure', () => this.pos.z < -7.7);
      if (ok) { this.beat('l3_quiet'); break; }
      this.pressurePanels(SCREEN3.clear);
      await this.hold(1.5);
      this.pressurePanels(SCREEN3.open);
    }
  }

  /**
   * C → C1 → C2 → E. I1: Halvorsen saw the lock release on his panel and comes out to meet the player — C1 starts a
   * few steps into the gallery, as soon as the pressure door has latched behind them (no wandering an empty, locked
   * habitat first: the shutter is down, the lobby door his).
   */
  private async meet(): Promise<void> {
    if (this.f.office) return;
    for (;;) {
      await this.until(() => this.f.quiet && !this.f.met && this.phase === 'C' && this.ctx.state === 'playing' && this.now - this.quietAt >= 0.5);
      this.inScene = true;
      const r1 = await this.sceneC1();
      if (r1 === 'refused') { this.inScene = false; await this.hold(0.5); continue; }
      break;
    }
    const r2 = await this.sceneC2();
    this.inScene = false;
    void r2;
    this.controlAt = this.now;
    this.stamp('control');
    this.checkpointNow('cp3_office');
  }

  /** Phase E: Halvorsen's two "go" lines and his reactions to his own documents (rules: dialogue.ts). */
  private async officeTalk(): Promise<void> {
    await this.until(() => this.f.office && this.controlAt > -1e8);
    for (const [id, after] of [['l3_halv_go_1', 20], ['l3_halv_go_2', 45]] as const) {
      const ok = await this.cue(() => this.f.office && !this.f.left && this.inRoom('office') && this.now - this.controlAt >= after && this.channelIdle >= 6, () => this.f.left);
      if (!ok) return;
      await this.say(id, { pri: 'talk', at: () => this.halvHead(0) });
    }
  }

  /** E → F: the office latch. On success the weapon comes up (D23) and he locks it. */
  private async officeLatch(): Promise<void> {
    await this.until(() => this.f.office);
    while (!this.f.left) {
      await this.until(() => this.phase === 'E' && this.at('t3_office_out') && this.ctx.state === 'playing');
      const ok = await this.closeBehind('d3_office', () => this.pos.z > -19.6);
      if (ok) {
        this.beat('l3_leave');
        this.ctx.player.setSafe?.(false);
        // the admin group's door stays shut until its beat (the phase table says auto)
        if (!this.f.adminOpen) this.door('d3_lobby_inner')?.lock();
        void this.say('l3_halv_lock', { pri: 'scene', at: V(-30, 6.2, -20.6) });
        break;
      }
      await this.hold(1.0);
    }
  }

  /** `l3_leave` + 2.5 s: the inner door opens for the three units; promoted to `g3_admin` at full open. */
  private async adminGroup(): Promise<void> {
    await this.until(() => this.f.left);
    if (this.f.adminOpen) return;
    await this.hold(2.5);
    this.holdOpen('d3_lobby_inner');
    this.sfx('door_open', V(-20, 5.9, -9), 0.7);
    await this.hold(0.9);
    if (!this.puppets.length) this.makePuppets('end');
    for (const p of this.puppets.splice(0)) {
      this.actors.delete(p);
      try { p.promote?.('g3_admin'); } catch (e) { console.warn('[story] promote failed', e); }
    }
    if (!this.prog.triggered.includes('g3_admin')) this.prog.triggered.push('g3_admin');
    this.triggeredAt.set('g3_admin', this.now);
    this.logSpawn('g3_admin', true);
    this.beat('l3_admin_fight');
    const d = this.door('d3_lobby_inner');
    if (d) d.auto = true;
    for (let i = 0; i < 12 && this.w.alive('g3_admin') > 0; i++) { this.rouse('g3_admin'); await this.hold(1); }
  }

  private async residentsPa(): Promise<void> {
    await this.until(() => this.f.left);
    if (this.talk.heard.has('l3_choir_pa_residents')) return;
    await this.hold(4);
    this.sfx('pa_chime', undefined, 0.7);
    await this.hold(1.2);
    await this.say('l3_choir_pa_residents', { pri: 'scene', name: 'PA' });
  }

  // ── the canteen (§5.2 g3_canteen) ──

  private async canteen(): Promise<void> {
    await this.until(() => this.f.left && !this.f.breach && this.at('t3_canteen'));
    if (this.f.canteen || this.f.breach) return;
    this.beat('l3_canteen_fight');
    await this.hold(0.8);
    const first: 'a' | 'b' = this.distTo(HATCH_A) < 3 ? 'b' : 'a';
    void this.hatchDrop(first);
    await this.hold(1.2);
    // the kitchen husk only while the player is > 3 m from the kitchen door; else ≤ 6 s, then the other hatch
    const away = await this.untilOr(() => this.distTo(KITCHEN_DOOR) > 3, 6);
    if (away) await this.kitchenHusk();
    else await this.hatchDrop(first === 'a' ? 'b' : 'a');
  }
  private async hatchDrop(h: 'a' | 'b'): Promise<void> {
    const group = h === 'a' ? 'g3_canteen_ha' : 'g3_canteen_hb';
    this.w.vignette(h === 'a' ? 'canteen_hatch_a' : 'canteen_hatch_b');
    await this.hold(0.4);
    // (the level's spawn: the canteen floor under the hatch, pose 'drop' — the husk starts 4 m up in the void)
    this.engage(group, 'spawn');
    this.logSpawn(group, true);
  }
  private async kitchenHusk(): Promise<void> {
    this.engage('g3_canteen_k', 'spawn');
    this.logSpawn('g3_canteen_k', false);
    this.set('kitchenOpen', true);
    await this.untilOr(() => this.members('g3_canteen_k').every((e) => e.position.z > -45.7) , 8);
    if (this.members('g3_canteen_k').every((e) => e.position.z > -45.7)) this.set('kitchenOpen', false);
    else this.S('kitchen_close', async () => { await this.untilOr(() => this.members('g3_canteen_k').every((e) => e.position.z > -45.7), 20); this.set('kitchenOpen', false); });
  }
  private async canteenLine(): Promise<void> {
    await this.until(() => this.f.breach || ((this.phase === 'F' || this.phase === 'F_kitchen') && (this.inRoom('canteen') || this.inRoom('stair_w')) && this.w.active() <= 2 && !this.talk.busy));
    if (this.f.breach) return;
    await this.say(this.choice === 'command' ? 'l3_choir_canteen_command' : 'l3_choir_canteen_stop', { pri: 'talk' });
  }

  // ── the breach (§5.2 g3_breach, g3_garden) ──

  private async breach(): Promise<void> {
    await this.until(() => this.f.left && !this.f.breach && this.at('t3_garden'));
    if (this.f.breach) return;
    this.beat('l3_breach');
    this.engage('g3_breach', 'spawn');                       // inside the windowless lock (sealed)
    this.logSpawn('g3_breach', false);
    if (this.halv) this.dropHalv();                          // behind his locked door, out of the player's world
    await this.hold(0.2);
    const d = this.door('d3_pressure');
    try { d?.unlock(); if (d) d.auto = false; d?.open(); } catch { /* ignore */ }
    this.sfx('pdoor_open', PDOOR, 1.0);
    this.pressurePanels(SCREEN3.open);
    // §5.2: at 100 % open (+2.8 s) they come out. (I1: they stood idle in the lock until the shutter wait below
    // ended at +8 s — the door opened on nothing.)
    this.S('breach_go', async () => { await this.hold(2.6); this.rouse('g3_breach'); });
    this.S('breach_line', async () => {
      await this.hold(3);
      await this.say(this.choice === 'command' ? 'l3_choir_breach_command' : 'l3_choir_breach_stop', { pri: 'scene', ttl: 6 });
    });
    this.S('sentry', async () => {
      await this.hold(5.9);
      // in the roof hatch void, 0.84 m over the closed panel (the level's spawn)
      this.engage('g3_garden', 'spawn');
      this.logSpawn('g3_garden', false);
      await this.hold(0.1);
      this.once('garden');
      this.w.vignette('atr_roof_hatch');
    });
    await this.untilOr(() => this.members('g3_breach').some((e) => Math.hypot(e.position.x - SHUTTER.x, e.position.z - SHUTTER.z) < 3 && e.position.y > 4), 8);
    this.once('shutter');                                    // G: pressure door + shutter open
    this.stamp('shutter');
    this.sfx('shutter_roll', SHUTTER.clone().setY(6), 0.9);
    for (let i = 0; i < 30 && this.w.alive('g3_breach') + this.w.alive('g3_garden') > 0; i++) {
      this.rouse('g3_breach'); this.rouse('g3_garden');
      await this.hold(1);
    }
  }

  // ── the purge (§5.2, D18) ──

  private async purge(): Promise<void> {
    this.beat('l3_purge');
    this.purgeAt = this.now;
    this.w.screen('bio_reader', 'badge', SCREEN3.reader.accepted);
    this.sfx('badge_ok', BIO_DOOR, 0.7);
    this.sfx('purge_cycle', BIO_DOOR, 1.0);
    void this.say('l3_unit_bio_reader', { pri: 'scene', next: true, at: V(11.8, 6.0, -39.5) });
    this.S('purge_line', async () => {
      await this.hold(4.2);
      await this.say(this.choice === 'command' ? 'l3_choir_purge_command' : 'l3_choir_purge_stop', { pri: 'talk', ttl: 9 });
    });
    this.S('breach2', () => this.breach2());
    const t0 = this.now;
    let shown = -1;
    await this.until(() => {
      const left = Math.max(0, Math.ceil(PURGE_S - (this.now - t0)));
      if (left !== shown) { shown = left; this.w.screen('bio_panel', 'terminal_idle', SCREEN3.bioPurge(left)); }
      return this.now - t0 >= PURGE_S;
    });
    this.purgeLen = +(this.now - t0).toFixed(3);
    this.purgeEndAt = this.now;
    this.beat('l3_bio_open');
    this.w.screen('bio_reader', 'badge', SCREEN3.reader.idle);
  }
  /** `l3_purge` + 5 s, only out of sight of d3_ring_e and ≥ 8 m from it; never after the purge. */
  private async breach2(): Promise<void> {
    await this.hold(5);
    await this.until(() => this.f.bioOpen || (!this.los(RING_E_FACE) && this.distTo(RING_E) >= 8));
    if (this.f.bioOpen || this.f.breach2) return;
    this.f.breach2 = true;
    this.engage('g3_breach_2', 'spawn');
    this.logSpawn('g3_breach_2', false);
    this.set('ringOpen', true);
    await this.untilOr(() => this.members('g3_breach_2').every((e) => e.position.x < 27.6), 10);
    this.set('ringOpen', false);
    for (let i = 0; i < 20 && this.w.alive('g3_breach_2') > 0; i++) { this.rouse('g3_breach_2'); await this.hold(1); }
  }

  /** I → J: the outer lock latches behind the player. */
  private async bioLatch(): Promise<void> {
    await this.until(() => this.f.bioOpen);
    while (!this.f.sealed) {
      await this.until(() => this.at('t3_bio_lock') && this.ctx.state === 'playing');
      const ok = await this.closeBehind('d3_bio', () => this.pos.x > 12.4);
      if (ok) { this.beat('l3_bio_sealed'); break; }
      await this.until(() => !this.at('t3_bio_lock'));
    }
  }

  /** D19: hostiles that got into the lock are fought out; the end line (or 4 s); the end. */
  private async endThread(): Promise<void> {
    await this.until(() => this.f.sealed);
    this.stamp('sealed');
    await this.fightOutWhere('bio_lock', 60);
    await this.hold(0.8);
    const said = this.say(this.choice === 'command' ? 'l3_choir_end_command' : 'l3_choir_end_stop', { pri: 'scene' });
    await Promise.race([said, this.hold(6)]);
    await this.hold(0.6);
    this.beat('l3_end');
    await this.hooks.end();
  }

  // ───────────────────────────────────────────────────────────── reactions

  private onInteract(id: string): void {
    if (!this.started || this.ended) return;
    if (id === 'bio_reader') { this.reader(); return; }
    if (OFFICE_READS.includes(id) && !this.inRoom('office')) return; // R8: only from inside
    const f = fragmentsL3(this.t)[id];
    if (f) this.openNote(id, f);
  }
  /** A readable opened: Halvorsen reacts to his own documents (rules: in the office, read within 10 s, once). */
  protected override onNoteOpened(id: string): void {
    const react: Record<string, string> = { note3_schedule: 'l3_halv_signed', note3_memo: 'l3_halv_memo', note3_pad: 'l3_halv_pad' };
    const line = react[id];
    if (!line || !this.halv || this.f.left) return;
    this.S('halv_react', async () => {
      await this.hold(1.2);
      await this.say(line, { pri: 'talk', ttl: 10, at: () => this.halvHead(0) });
    });
  }
  private reader(): void {
    const at = V(11.8, 6.0, -39.5);
    if (!this.ctx.player.hasKey('facilities_badge')) {
      this.w.screen('bio_reader', 'badge', SCREEN3.reader.denied);
      this.sfx('badge_deny', at, 0.6);
      void this.say('l3_unit_bio_denied', { pri: 'talk', ttl: 2, at });
      this.S('reader_idle', async () => { await this.hold(2.5); if (!this.f.purge) this.w.screen('bio_reader', 'badge', SCREEN3.reader.idle); });
      return;
    }
    if (this.f.purge) return;
    this.S('purge', () => this.purge());
  }

  private onDenied(id: string): void {
    if (!this.started) return;
    const f = this.f;
    const door = this.door(id);
    const at = door ? door.position.clone().setY(this.doorFloor(door) + 1.6) : undefined;
    if (id === 'd3_office' && f.left) {
      this.toast(TOAST3.halvLocked, 4);
      void this.say('l3_halv_door', { pri: 'talk', ttl: 3, at: V(-30, 6.2, -20.6) });
      return;
    }
    if (id.startsWith('d3_q') && !f.takeover) { this.toast(TOAST3.private, 4); return; }
    if (id === 'd3_shutter_ne' && !f.takeover) { this.toast(TOAST3.night, 4); return; }
    if (SEALED_DOORS.includes(id) && f.takeover) {
      this.toast(TOAST3.sealed, 4);
      const badge = this.ctx.player.hasKey('facilities_badge');
      void this.say(badge ? 'l3_unit_sector_badge' : 'l3_unit_sector', { pri: 'talk', ttl: 2, at });
      return;
    }
    if (id === 'd3_bio') { this.toast(TOAST3.noBadge, 4); return; }
    if (['d3_stair_w', 'd3_lobby_inner', 'd3_kitchen', 'd3_ring_e', 'd3_office'].includes(id)) this.toast(TOAST3.staff, 4);
  }

  /** Phase ≥ F in the quarters: knocking behind two red doors; the resident at cabin 3 (rules: dialogue.ts). */
  private quarters(): void {
    if (!this.f.left || !this.live || this.ctx.state !== 'playing') return;
    // a viewport hit after the takeover: CHOIR, once
    if (this.facts.viewportHitWithin(0.4) && !this.talk.busy) void this.say(this.choice === 'command' ? 'l3_choir_glass_command' : 'l3_choir_glass_stop', { pri: 'talk', ttl: 2 });
    if (!this.inRoom('quarters')) return;
    const shot = (d: string) => this.facts.shotDoorEver(d);
    if (this.now >= this.knockAt) {
      this.knockAt = this.now + 8 + Math.random() * 12;
      const doors = ['d3_q1', 'd3_q5'].filter((d) => !shot(d));
      const d = doors.length ? this.door(doors[Math.floor(Math.random() * doors.length)]) : null;
      if (d) this.sfx('dist_knock', d.position.clone().setY(1.3), 0.6);
    }
    if (this.at('t3_q3') && !this.talk.busy && !shot('d3_q3')) {
      if (!this.talk.heard.has('l3_resident_1')) void this.say('l3_resident_1', { pri: 'talk', ttl: 2, at: V(23, 1.5, -27.8) });
      else if (!this.talk.heard.has('l3_resident_2') && this.talk.since('resident') >= 4) void this.say('l3_resident_2', { pri: 'talk', ttl: 2, at: V(23, 1.5, -27.8) });
    }
  }

  /** R4 evidence for the tests: was any member of `group` in view at its spawn / promotion (behind = a door that just opened). */
  private logSpawn(group: string, throughDoor: boolean): void {
    this.S('spawnlog', async () => {
      await this.hold(0.05);
      const seen = this.members(group).some((e) => this.inView(e, 60));
      this.spawnLog.push({ group, t: +this.now.toFixed(2), seen: seen && !throughDoor });
    });
  }

  /** `?nostory=1` (§3): every door auto except the cabins, kitchen, ring_e (locked), bio_inner (dark); evening; no actors. */
  openEverything(): void {
    this.baseline();
    this.nightSign(false);
    applyPhase3(this.ctx, 'nostory', { snap: true });
  }

  // ───────────────────────────────────────────────────────────── review / debug

  fire(name: string): unknown {
    if ((VIGNETTES_L3 as readonly string[]).includes(name)) return this.w.vignette(name) ? { x: 0, y: 0, z: 0 } : null;
    return null;
  }

  get debugState() {
    const pos = (a: { position: THREE.Vector3 } | null) => (a ? [a.position.x, a.position.y, a.position.z].map((v) => +v.toFixed(2)) : null);
    let cut: unknown = null;
    try { cut = this.cut?.debugState() ?? null; } catch { /* ignore */ }
    return {
      level: 3, beats: [...this.prog.beats], flags: { ...this.f }, phase: this.phase, phaseApplied: this.phaseApplied,
      now: +this.now.toFixed(2), clock: +this.t.toFixed(2), countdown: countdown(this.t), t: { ...this.marks },
      heard: [...this.talk.heard], lines: this.talk.log.length, speaking: this.talk.speaking, talking: this.talk.busy,
      restoredFrom: this.restoredFrom, loadout: this.loadout, checkpoint: this.lastCheckpoint, pendingCheckpoint: this.pendingCheckpoint,
      checkpoints: [...this.prog.checkpoints], calm: this.started && this.calm(), triggered: [...this.prog.triggered], cleared: [...this.prog.cleared],
      mood: this.director.mood, actors: this.actors.size, live: this.live, ended: this.ended,
      halv: this.halv ? { at: this.halvAt, pose: this.halvPose, pos: pos(this.halv) } : null,
      puppets: this.puppets.map((p) => pos(p)), feedActors: this.feedActors.length,
      feeds: { cam01: this.feeds.cam01?.active ?? null, cam04: this.feeds.cam04?.active ?? null },
      scenes: { times: this.sceneTimes, log: this.sceneLog, inScene: this.inScene, cut },
      purge: { len: this.purgeLen, at: this.purgeAt > -1e8 ? +this.purgeAt.toFixed(2) : null, endAt: this.purgeEndAt > -1e8 ? +this.purgeEndAt.toFixed(2) : null },
      spawns: this.spawnLog.slice(), safe: !!this.ctx.player.safe, controlAt: this.controlAt > -1e8 ? +this.controlAt.toFixed(2) : null,
    };
  }
}
