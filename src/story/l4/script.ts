/**
 * Level 4 — "생물 시스템" (stage 3b §4). The flow: the decon (A), the gowning room (B), the air shower (S), the
 * clean loop (C) with its optional rooms, the containment hold and the cold-store override, lights-out and the ambush
 * (D), the theatre gallery, the navy level, the refusal → valve → 25 s equalising holdout (D2), the booth release (E),
 * the tube fight (F), the gate lock (G) and the end.
 *
 * Rules this file is built on (DESIGN.md R1–R8, plan §9):
 *   R1  every gate is a door state of a phase (the level's `applyPhase4`), derived from the record (`phase`); every
 *       door that closes behind the player is a latch (`closeBehind`); the reason for every hold is on a panel beside
 *       the door and in a unit line; nothing waits on the player obeying.
 *   R3  every line has a rule (dialogue.ts), checked when it starts; scene speech is cued from recorded durations.
 *   R4  nothing hostile exists before its beat: four dormant units from load (harmless until their rules); every
 *       arrival is out of a sealed space through a door / grille / sump that visibly opens.
 *   R5  the decon, the shower and the equalising run on fixed clocks; the theatre loop never waits.
 *   Gates never wait on a sleeping / unreachable enemy (`fightOut` rouses every second; stranded → removed).
 */
import * as THREE from 'three';
import type { GameContext } from '../../core/types';
import type { Sequencer } from '../sequencer';
import type { MusicDirector } from '../director';
import type { World } from '../world';
import { CHECKPOINT_IDS_L4, type CheckpointIdL4 } from '../save';
import type { CheckpointRule } from '../stage/base';
import { lineDuration } from '../voice';
import { applyPhase4 } from '../../level/l4/phases';
import { LIGHTS_OUT4 } from '../../level/l4/grey';
import { fxLead } from '../../audio/voicefx';
import { Base4, V, type Flags4, type HooksL4 } from './base';
import { line4 } from './dialogue';
import { FRAGMENTS4, OBJ4, READ_ROOM4, SCREEN4, SUNDE_LOG, TOAST4, doorOpenSeconds, hms } from './text';

/** Deck-2 groups (removed on a load past lights-out; the ambush's stranded watch). */
const DECK2_GROUPS = ['g4_wet', 'g4_rec', 'g4_viv', 'g4_bay', 'g4_vent_a', 'g4_vent_b'];
/** F5 + the plant skitters (the F6 rule, `cp4_armed`). */
const F5_GROUPS = ['g4_chk_sentry', 'g4_store', 'g4_plant'];
/** Groups that exist dormant from load and may wake on their own (shot, damage, proximity): recorded as triggered. */
const SELF_WAKING = ['g4_wet', 'g4_rec', 'g4_lower', 'g4_chk_sentry'];
const CORRIDORS = ['corr_n', 'corr_w', 'corr_e', 'corr_s'];
const EQUALISE_S = 25.0;
const DECON_S = 8.0;
const JETS_S = 6.0;
/** The `screen` voice chain's designed lead before Sunde's voice (0.28 s today: the recorder's tape start). */
const SCREEN_LEAD = (() => { try { return Math.max(0, fxLead('screen')); } catch { return 0; } })();

export class ScriptL4 extends Base4 {
  /** For debugState (check-chain): how the run was armed. */
  loadout: 'carry' | 'direct' | 'none' | 'save' = 'none';
  arrival: { from: number | null; armor: number } = { from: null, armor: 0 };
  private forced = new Set<string>();
  private short = true;
  private recWakeAt = -1;
  private chkTime = 0;
  private unseen = new Map<number, number>();
  private vlog = { state: 'idle' as 'idle' | 'playing' | 'paused' | 'done', next: 0, token: 0, cutAt: -1 };
  private timesRec: Record<string, number> = {};
  private eqLen = -1;
  private failHold = 2.5;
  /** A load past lights-out removed the vivarium's skitters (not saved: the record stays as it was saved). */
  private vivGone = false;
  private deconLen = -1;
  private showerLen = -1;
  private theatreLog: { cue: string; t: number; attempt: number }[] = [];
  private lastShotFrom: THREE.Vector3 | null = null;
  private lastShotT = -1e9;

  constructor(ctx: GameContext, seq: Sequencer, director: MusicDirector, w: World, logs: Set<string>, hooks: HooksL4) {
    super(ctx, seq, director, w, logs, hooks);
    const ev = ctx.events;
    ev.on('interact', (e) => this.onInteract(e.id));
    ev.on('door:denied', (e) => this.onDenied(e.id));
    ev.on('pickup', (e) => this.onPickup(e.kind));
    ev.on('weapon:fired', (e) => { this.lastShotFrom = e.origin.clone(); this.lastShotT = this.now; });
    this.onArmCue((cue) => this.armCue(cue));
    // §5.1: a dormant sentry that is shot wakes (g4_lower), and the navy one counts as F5 (§9 #18)
    ev.on('enemy:damaged', (e) => {
      if (!this.started || this.ff) return;
      const en = this.ctx.enemies.all.find((x) => x.id === e.id);
      if (!en) return;
      if (en.group === 'g4_lower' && !this.prog.triggered.includes('g4_lower')) this.wakeGroup('g4_lower', 'shot in its dock');
      if (en.group === 'g4_chk_sentry') {
        if (!this.prog.triggered.includes('g4_chk_sentry')) this.wakeGroup('g4_chk_sentry', 'shot in its dock');
        if (this.f.suite) this.S('armed', () => this.armed());
      }
    });
  }

  // ───────────────────────────────────────────────────────────── lasting consequences

  private set<K extends keyof Flags4>(k: K, v: Flags4[K]): void {
    (this.f as unknown as Record<string, unknown>)[k] = v;
    this.syncPhase();
  }
  private clock(): string { return hms(doorOpenSeconds(this.arrivalHour, this.t)); }
  private tubePanels(text: string): void { this.screen('booth_panel', 'terminal_idle', text); this.screen('tube_n_panel', 'terminal_idle', text); }
  private showerPanels(text: string): void { this.screen('shower_in_panel', 'terminal_idle', text); this.screen('shower_out_panel', 'terminal_idle', text); }
  private usable(id: string, on: boolean): void { this.w.setInteractable(id, on); }

  private readonly CONSEQUENCES: Record<string, () => void> = {
    l4_decon_done: () => { this.f.deconDone = true; this.screen('decon_panel', 'terminal_idle', SCREEN4.deconClear); },
    l4_shower: () => { this.f.showered = true; },
    '#clean': () => { this.f.clean = true; this.cleanAt = this.now; this.showerPanels(SCREEN4.showerDone); },
    l4_clean: () => { this.f.cleanSeen = true; },
    l4_override: () => { this.f.override = true; this.screen('cold_panel', 'containment', SCREEN4.storeAck(this.clock())); this.usable('cold_ack', false); },
    '#suite': () => { this.f.suite = true; this.screen('surg_hold', 'containment', SCREEN4.suiteCleared); },
    l4_lights_out: () => {
      this.f.lightsOut = true;
      if (this.ff) {
        // a load past lights-out (W2b: the beat again on restore); the vignette's tweens are settled by the load
        this.vig('lights_out4');
        for (const g of LIGHTS_OUT4.off) this.w.lights(g, { enabled: false });
        for (const g of LIGHTS_OUT4.emerg) this.w.lights(g, { enabled: true });
        this.ctx.events.emit('story:beat', { id: 'l4_lights_out' });
      }
    },
    '#bay_done': () => { this.f.bayDone = true; this.f.bayOpen = false; },
    '#vent_a': () => { this.f.vent = 'a'; if (this.ff) this.vig('vent_s_a'); },
    '#vent_b': () => { this.f.vent = 'b'; if (this.ff) this.vig('vent_s_b'); },
    '#viv': () => { this.f.viv = true; if (this.ff) this.vig('viv_vent'); },
    l4_theatre: () => { this.f.theatre = true; this.earn('l4_theatre'); },
    '#lower': () => { this.f.lower = true; },
    '#lcorr': () => { this.f.lcorr = true; },
    '#navy': () => { this.f.navy = true; },
    '#refused': () => { this.f.refused = true; if (!this.f.equalised) this.tubePanels(SCREEN4.tubeRefused); },
    l4_armed: () => { this.f.armed = true; },
    '#store_done': () => { this.f.storeDone = true; this.f.storeOpen = false; },
    l4_equalise: () => {
      this.f.equalising = true; this.eqAt = this.now; this.usable('valve4', false);
      if (this.ff) this.vig('valve_open');
    },
    '#sump': () => { if (this.ff) this.vig('plant_sump'); },
    '#equalised': () => {
      this.f.equalised = true; this.earn('l4_equalised'); this.f.equalising = false;
      this.screen('plant_gauge', 'terminal_idle', SCREEN4.gaugeDone);
      if (!this.f.released) this.tubePanels(SCREEN4.tubeReady);
      this.w.lights('plant_beacon', { enabled: false });
    },
    '#release': () => { this.f.released = true; this.tubePanels(SCREEN4.tubeOpen); this.usable('booth_release', false); },
    l4_tube_fight: () => { this.f.tubeFight = true; },
    '#gate_open': () => { this.f.gateOpen = true; this.f.tubeOpen = false; },
    l4_gatelock: () => { this.f.gateLock = true; },
  };

  protected consequence(id: string): void {
    const fn = this.CONSEQUENCES[id];
    if (fn) { try { fn(); } catch (e) { console.warn(`[story] consequence ${id} failed`, e); } }
  }

  /** The world every run starts from (before any phase): screens, interactables, the arm, lights not yet touched. */
  protected baseline(): void {
    const s = (n: string, k: Parameters<Base4['screen']>[1], t?: string) => this.screen(n, k, t);
    s('decon_panel', 'terminal_idle', SCREEN4.decon(8));
    this.showerPanels(SCREEN4.showerIdle);
    s('fumig_status', 'terminal_alert', SCREEN4.fumig);
    s('surg_hold', 'containment', SCREEN4.suiteHold(this.clock()));
    s('cold_panel', 'containment', SCREEN4.storeHold(this.clock()));
    s('node2_screen', 'choir', SCREEN4.node2);
    s('pi_video', 'video_log', SCREEN4.video.idle);
    s('roster', 'roster');
    this.tubePanels(SCREEN4.tubeIdle);
    s('plant_gauge', 'terminal_idle', SCREEN4.gaugeIdle);
    s('gate_panel', 'terminal_idle', SCREEN4.gateIdle);
    for (const id of ['cold_ack', 'valve4', 'booth_release', 'log4_video']) this.usable(id, true);
    this.w.setPrompt('log4_video', '기록 재생');
    this.w.lights('plant_beacon', { enabled: false });
    for (const m of ['theatre_arm', 'cold_jam']) this.w.machine(m, 'active');
    // §4.4: failHold = max(2.5, dur(l4_unit_theatre_2) + 0.5), set at level start
    this.failHold = Math.max(2.5, lineDuration('l4_unit_theatre_2') + 0.5);
    try { (this.obj('theatre_arm')?.userData.setFailHold as ((s: number) => void) | undefined)?.(this.failHold); } catch { /* ignore */ }
    this.grade(-0.3, 0);
  }

  protected baselineMood(): 'silence' | 'ambient' | 'tension' { return this.f.lightsOut ? 'tension' : 'ambient'; }

  // ── fast-forward ──

  protected override afterReplay(): void {
    const f = this.f;
    f.bayOpen = false; f.storeOpen = false; f.tubeOpen = false;
    if (!f.equalised) f.equalising = false;
    // §7: a load past lights-out — every Deck-2 group cleared if dead, else removed silently (the vivarium vent too)
    if (f.lightsOut) {
      for (const g of DECK2_GROUPS) { try { this.ctx.enemies.removeGroup(g); } catch { /* ignore */ } if (!this.prog.triggered.includes(g)) this.prog.triggered.push(g); }
      this.vivGone = true;
    }
    if (f.armed) { for (const g of F5_GROUPS) { try { this.ctx.enemies.removeGroup(g); } catch { /* ignore */ } if (!this.prog.triggered.includes(g)) this.prog.triggered.push(g); } f.storeDone = true; }
    if (f.lcorr) { try { this.ctx.enemies.removeGroup('g4_lower'); } catch { /* ignore */ } }
  }

  // ───────────────────────────────────────────────────────────── per frame

  protected override onFrame(dt: number): void {
    const s = this.ctx.state;
    if (s === 'playing' || s === 'cutscene') this.prog.t += dt;
  }

  protected override onStep(step: number): void {
    if (!this.live || this.ctx.state !== 'playing') return;
    const f = this.f;
    // dormant units that woke by themselves (a shot, damage, proximity): recorded, so the calm rule waits for them
    for (const g of SELF_WAKING) {
      if (this.prog.triggered.includes(g)) continue;
      if (this.members(g).some((e) => e.state !== 'dormant')) {
        this.prog.triggered.push(g);
        this.triggeredAt.set(g, this.now);
        this.S('out_' + g, () => this.fightOut(g, 60));
        if (g === 'g4_chk_sentry' && f.suite) this.S('armed', () => this.armed());
      }
    }
    this.recordsRules();
    // view timers (§6.2 "in view": a clear ray from the eye within 50°)
    const deck2 = Math.abs(this.pos.y - 4.8) < 1.5;
    const body = deck2 && this.bodies.some((b) => b.name !== '달' && Math.abs(b.p.y - 4.8) < 1 && this.sees(b.p.clone().setY(b.p.y + 0.35), 3.6));
    this.bodySeen = body ? this.bodySeen + step : 0;
    this.node2Seen = this.sees(this.mk('mk4_node2_win'), 6) ? this.node2Seen + step : 0;
    this.rosterSeen = this.sees(this.mk('mk4_roster'), 6) ? this.rosterSeen + step : 0;
    if (f.clean && !f.suite && !f.holdSeen) {
      const d = this.door('d4_surg');
      if (d && this.sees(d.position.clone().setY(this.doorFloor(d) + 1.4), 8)) f.holdSeen = true;
    }
    // CHOIR's sight / act lines (rules decide at the start; 'talk': they never cut a scene line)
    const idle = this.quietNow();
    const fresh = (base: string) => !this.talk.heard.has(`${base}_stop`) && !this.talk.heard.has(`${base}_command`);
    if (idle && this.bodySeen >= 1 && f.clean && !f.suite && fresh('l4_choir_bodies')) void this.say(this.choiceId('l4_choir_bodies'), { pri: 'talk', ttl: 3 });
    if (idle && this.node2Seen >= 1.5 && fresh('l4_choir_node2')) void this.say(this.choiceId('l4_choir_node2'), { pri: 'talk', ttl: 3 });
    if (this.rosterSeen >= 3 || this.facts.readWithin('term4_ctrl', 10)) {
      if (this.atLeast('D')) f.roster = true;
      if (idle && this.atLeast('D') && fresh('l4_choir_roster')) void this.say(this.choiceId('l4_choir_roster'), { pri: 'talk', ttl: 10 });
    }
    if (this.talk.heard.has('l4_sunde_5')) { f.video = true; this.earn('l4_video'); }
    if (f.roster) this.earn('l4_roster');
    // F5's 60 s in the checkpoint; F6's unseen timers
    if (f.suite && this.at('t4_chk')) this.chkTime += step;
    for (const e of this.ctx.enemies.all) {
      if (!e.alive || !F5_GROUPS.includes(e.group)) continue;
      const far = this.distTo(e.position) >= 25 && !this.los(e.position.clone().setY(e.position.y + 1.1));
      this.unseen.set(e.id, far ? (this.unseen.get(e.id) ?? 0) + step : 0);
    }
    if (this.director.mood !== 'tension' && this.w.active() > 0) this.director.setMood('tension');
  }
  private choiceId(base: string): string { return `${base}_${this.choice}`; }

  protected objective(): string {
    if (!this.live || this.ended) return OBJ4.none;
    const f = this.f;
    switch (this.phase) {
      case 'G': return OBJ4.gate;
      case 'F': case 'F_open': case 'E': return OBJ4.tube;
      case 'D2': return OBJ4.booth;
      case 'D': case 'D_bay': case 'D_store':
        if (f.equalised) return OBJ4.booth;
        if (f.equalising || f.refused) return OBJ4.plant;
        return f.lcorr || this.prog.visited.includes('lcorr') || this.prog.visited.includes('chk') ? OBJ4.booth : OBJ4.suite;
      case 'C': return f.holdSeen || this.talk.heard.has('l4_unit_hold') ? OBJ4.hold : OBJ4.post4;
      default: return OBJ4.post4;
    }
  }

  // ───────────────────────────────────────────────────────────── checkpoints (§7)

  protected readonly checkpointIds = CHECKPOINT_IDS_L4;
  protected readonly CHECKPOINTS: Record<CheckpointIdL4, CheckpointRule> = {
    cp4_start: { when: () => this.f.deconDone, valid: () => !this.f.showered },
    cp4_clean: { when: () => this.f.clean && this.f.cleanSeen, valid: () => !this.f.override },
    cp4_cold: { when: () => this.f.clean && this.at('t4_cold', () => this.inRoom('cold')), valid: () => !this.f.override },
    cp4_hold: {
      when: () => this.f.suite && this.f.bayDone && this.f.vent !== '' && this.fought('g4_bay', 3) && this.fought(`g4_vent_${this.f.vent}`, 3)
        && (CORRIDORS.includes(this.w.room() ?? '') || this.inRoom('scrub')),
      valid: () => !this.f.lower,
    },
    cp4_lower: { when: () => this.f.suite && this.at('t4_stair_foot'), valid: () => !this.f.navy },
    cp4_navy: { when: () => this.f.suite && this.at('t4_chk') && !this.f.armed, valid: () => !this.f.armed },
    cp4_armed: {
      when: () => this.f.equalised && this.f.storeDone && F5_GROUPS.every((g) => this.fought(g, 3))
        && (['plant4', 'guard', 'chk', 'lcorr'].includes(this.w.room() ?? '') || (this.inRoom('tube') && this.pos.z > -80)),
      valid: () => !this.f.tubeFight,
    },
  };
  /** §7: no checkpoint during the decon, the shower cycle, the hold sequence, the equalising, F6 or the gate lock. */
  protected override checkpointBlocked(): boolean {
    const f = this.f;
    return !f.deconDone || (f.showered && !f.clean) || (f.override && !f.bayDone) || (f.equalising && !f.equalised) || f.tubeFight || f.gateLock;
  }
  /** Debug / check-chain: write a checkpoint now (the record as it is). */
  debugCheckpoint(id: CheckpointIdL4): boolean {
    try { this.hooks.checkpoint(id); if (!this.prog.checkpoints.includes(id)) this.prog.checkpoints.push(id); return true; } catch { return false; }
  }
  /** The page's end ran (debugState.ended; no more checkpoints / lines). */
  markEnded(): void { this.ended = true; }
  /** D20 / §7: the test hour now, carried as fact `testHour`. */
  clockHour(): number { return this.arrivalHour + this.t / 3600; }
  /** D24: the first-view facts carried out of level 4. */
  firstViews(): Record<string, boolean> {
    const f = this.f;
    return { l4_theatre: f.theatre, l4_video: f.video || this.talk.heard.has('l4_sunde_5'), l4_roster: f.roster, l4_equalised: f.equalised };
  }

  // ───────────────────────────────────────────────────────────── flow

  start(): void {
    if (this.started) return;
    this.started = true;
    this.t0 = this.prog.t;
    if (!this.restoredFrom) {
      this.baseline();
      this.snapPhase();
      this.director.setMood('ambient');
    }
    this.lastMovePos.copy(this.pos);
    this.lastMoveAt = this.now;
    const S = (n: string, fn: () => Promise<unknown>) => this.S(n, fn);
    S('decon', () => this.decon());
    S('choir_enter', () => this.choirEnter());
    S('shower', () => this.shower());
    S('clean', () => this.cleanBeat());
    S('viv', () => this.vivarium());
    S('gallery', () => this.gallery());
    S('lower', () => this.lowerLevel());
    S('armed_watch', () => this.armedWatch());
    S('tube_line', () => this.tubeLine());
    S('f6', () => this.f6());
    S('gate_latch', () => this.gateLatch());
    S('end', () => this.endThread());
    // after a load past a beat, its background fights resume (nothing hostile is left: they only watch)
    if (this.restoredFrom) this.resumeThreads();
  }
  private resumeThreads(): void {
    const f = this.f;
    if (f.released && !f.tubeFight) this.tubePanels(SCREEN4.tubeOpen);
  }

  /** A new run: control in the sealed lock (phase A). */
  begin(short: boolean): void {
    this.short = short;
    this.live = true;
    this.ctx.player.controlsEnabled = true;
    this.ctx.ui.setHudVisible(true);
    this.ctx.setState('playing');
  }
  /** After a checkpoint load (`resumed`). */
  resumeLive(): void {
    this.live = true;
    this.ctx.ui.setHudVisible(true);
  }

  // ── §4.1 arrival and decon (A, 8.6 s in a sealed 4 × 4 lock) ──

  private async decon(): Promise<void> {
    if (this.f.deconDone) return;
    await this.until(() => this.live && this.ctx.state === 'playing');
    const t0 = this.now;
    this.beat('l4_start');
    this.screen('decon_panel', 'terminal_idle', SCREEN4.decon(8));
    let end = t0 + 0.6 + DECON_S;
    let shown = 8;
    const count = () => {
      const left = Math.max(0, Math.ceil(t0 + 0.6 + DECON_S - this.now));
      if (left !== shown && this.now >= t0 + 0.6) { shown = left; this.screen('decon_panel', 'terminal_idle', SCREEN4.decon(left)); }
    };
    await this.until(() => this.now >= t0 + 0.6 || this.forced.has('decon'));
    this.vig('decon_cycle');
    await this.until(() => this.now >= t0 + 0.8 || this.forced.has('decon'));
    void this.unit('l4_unit_decon', {
      at: this.mk('mk4_decon_panel'), cue: t0 + 0.8,
      onStart: (d) => { end = Math.max(end, this.now + d + 0.4); },
    });
    await this.until(() => { count(); return this.now >= end || this.forced.has('decon'); });
    this.deconLen = +(this.now - (t0 + 0.6)).toFixed(3);
    this.beat('l4_decon_done');
    this.checkpointNow('cp4_start');
  }

  /** `t4_gown` or decon end + 3.0 s: CHOIR, once (rule: ≥ B, in the lock or gowning). */
  private async choirEnter(): Promise<void> {
    await this.until(() => this.f.deconDone && this.live);
    if (this.talk.heard.has('l4_choir_enter_stop') || this.talk.heard.has('l4_choir_enter_command')) return;
    await this.untilOr(() => this.at('t4_gown'), 3.0);
    await this.say(this.choiceId('l4_choir_enter'), { pri: 'scene', ttl: 20 });
  }

  // ── §4.2 the air shower (S): one-way latch, 6 s jets ──

  private async shower(): Promise<void> {
    await this.until(() => this.f.deconDone);
    if (!this.f.showered) {
      for (;;) {
        await this.until(() => this.forced.has('shower') || (this.phase === 'B' && this.at('t4_shower') && this.ctx.state === 'playing'));
        const forced = this.forced.has('shower');
        const ok = await this.latch('d4_shower_in', () => forced || this.pos.z < -6.4);
        if (ok) { this.beat('l4_shower'); break; }
        this.showerPanels(SCREEN4.showerClear);
        await this.hold(1.5);
        this.showerPanels(SCREEN4.showerIdle);
      }
    }
    if (this.f.clean) return;
    const t1 = this.now;
    let jets = JETS_S;
    void this.unit('l4_unit_shower', { at: this.atDoor('d4_shower_out'), cue: t1, onStart: (d) => { jets = Math.max(JETS_S, d + 0.4); } });
    await this.hold(0.3);
    this.vig('shower_cycle');
    let shown = -1;
    await this.until(() => {
      const left = Math.max(0, Math.ceil(t1 + 0.3 + jets - this.now));
      if (left !== shown) { shown = left; this.showerPanels(SCREEN4.showerCycle(left)); }
      return this.now >= t1 + 0.3 + jets;
    });
    await this.hold(0.6);
    this.showerLen = +(this.now - t1).toFixed(3);
    this.once('clean');
    this.door('d4_shower_out')?.open();
  }

  /**
   * §3 latch for the two one-way doors (the shower, the gate lock): `closeBehind`, but a player standing in the
   * doorway fails it at once — the door never closes on them; it reopens and the trigger re-arms (§9 #20).
   */
  private async latch(id: string, keepSide: () => boolean): Promise<boolean> {
    const d = this.door(id);
    if (!d) return keepSide();
    const inDoorway = () => Math.abs(this.pos.x - d.position.x) < 1.1 && Math.abs(this.pos.z - d.position.z) < 0.9 && Math.abs(this.pos.y - this.doorFloor(d)) < 1.5;
    if (!inDoorway()) {
      d.lock();
      const t0 = this.now;
      // (a std leaf closes in ≈ 0.9 s: not shut after 1.6 s = something is in the way)
      await this.until(() => this.isShut(d) || inDoorway() || this.now - t0 > 1.6);
      if (!inDoorway() && this.isShut(d) && keepSide()) return true;
    }
    d.unlock();
    d.open();
    return false;
  }

  /** First `t4_clean` in C: beat (cp4_clean is then due). */
  private async cleanBeat(): Promise<void> {
    await this.until(() => this.f.clean && this.at('t4_clean'));
    this.beat('l4_clean');
  }

  // ── §5.1 the optional rooms' units ──

  /** g4_rec (slumped in records): note closed + 0.8 s, ≤ 2.5 m, a shot within 12 m, 75 s in records — never while reading. */
  private recordsRules(): void {
    if (this.prog.triggered.includes('g4_rec') || !this.f.clean) return;
    const m = this.members('g4_rec');
    if (!m.length) return;
    if (this.noteOpen) return;
    const p = m[0].position;
    const near = this.inRoom('records') && this.distTo(p) <= 2.5;
    const shot = !!this.lastShotFrom && this.now - this.lastShotT < 0.3 && this.lastShotFrom.distanceTo(p) <= 12;
    const long = (this.roomTime.get('records') ?? 0) >= 75;
    const closed = this.recWakeAt > 0 && this.now >= this.recWakeAt;
    if (near || shot || long || closed) this.wakeGroup('g4_rec', 'slumped in records');
  }
  private wakeGroup(g: string, through: string): void {
    if (this.prog.triggered.includes(g) && this.triggeredAt.get(g) !== undefined && (this.triggeredAt.get(g) ?? -1e9) > -1e8) return;
    this.engage(g, 'wake');
    this.logSpawn(g, through);
    this.S('out_' + g, () => this.fightOut(g, 60));
  }

  /** g4_viv: first `t4_viv_deep` → the grille drops (not on top of the player), + 0.4 s the two skitters. */
  private async vivarium(): Promise<void> {
    await this.until(() => this.f.viv || this.vivGone || (this.f.clean && this.at('t4_viv_deep')));
    if (this.f.viv || this.vivGone) return;
    const vent = this.mk('mk4_vent_viv');
    if (this.distTo(vent) < 2.5) await this.untilOr(() => this.distTo(vent) >= 3, 4);
    if (this.f.viv) return;
    this.vig('viv_vent');
    this.once('viv');
    await this.hold(0.4);
    this.engage('g4_viv', 'spawn');
    this.logSpawn('g4_viv', 'viv_vent grille');
    this.S('out_g4_viv', () => this.fightOut('g4_viv', 60));
  }

  // ── §4.3 the override, lights-out, the ambush ──

  private async override(): Promise<void> {
    if (this.f.override) return;
    const t0 = this.now;
    this.beat('l4_override');
    this.stamp('override');
    this.sfx('hold_beep', this.mk('mk4_cold_panel'), 0.6);
    let end = t0 + lineDuration('l4_unit_cold_ack');
    void this.unit('l4_unit_cold_ack', { at: this.mk('mk4_cold_panel'), cue: t0, onStart: (d) => { end = this.now + d; } });
    await this.until(() => this.now >= end + 0.3);
    this.once('suite');                                        // D: d4_surg auto (green), HOLD CLEARED
    this.stamp('suite');
    this.toast(TOAST4.holdCleared);
    await this.until(() => this.now >= end + 0.6);
    // (a playing video-log line finishes first — the log pauses at its end, §9 #7; lights-out follows CHOIR's real end)
    let cEnd = -1, done = false;
    void this.say(this.choiceId('l4_choir_hold'), { now: true, next: true, gap: 0.05, onStart: (d) => { cEnd = this.now + d; } }).then(() => { done = true; });
    await this.until(() => cEnd >= 0 || done);
    if (cEnd < 0) cEnd = this.now;
    await this.until(() => this.now >= cEnd + 0.4);
    this.lightsOut();
  }

  /** L: the Deck-2 lights go in a wave from the cold store; the units come. */
  private lightsOut(): void {
    if (this.f.lightsOut) return;
    this.beat('l4_lights_out');
    this.stamp('lights_out');
    this.vig('lights_out4');                                   // (its power_down + lights_thunk are the vignette's)
    this.director.setMood('tension');
    if (this.w.alive('g4_wet') > 0) { this.wakeGroup('g4_wet', 'wet-lab bench (lights-out)'); this.rouse('g4_wet'); }
    if (this.w.alive('g4_rec') > 0) this.wakeGroup('g4_rec', 'records (lights-out)');
    this.S('bay', () => this.bay());
    this.S('vent', () => this.vent());
  }

  private async bay(): Promise<void> {
    const L = this.now;
    await this.until(() => this.now >= L + 1.5);
    this.engage('g4_bay', 'spawn');                          // inside the sealed bay
    this.logSpawn('g4_bay', 'sealed bay');
    this.S('out_g4_bay', () => this.fightOut('g4_bay', 60));
    await this.until(() => this.now >= L + 2.0);
    this.set('bayOpen', true);                                // D_bay: d4_bay opens (0.85 s)
    this.sfx('bay_door', this.mk('mk4_bay_door').setY(6.2), 0.9);
    await this.until(() => this.now >= L + 2.9);
    this.rouse('g4_bay');
    this.runOnceOut('g4_bay', (e) => e.position.x < 14.6);
    await this.untilOr(() => this.members('g4_bay').every((e) => e.position.x < 14.6), 10);
    // latch: the player must not be in the bay / its doorway (plan: x < 14.6 — the corridor's east edge)
    for (;;) {
      const ok = await this.closeBehind('d4_bay', () => !this.inRoom('bay') && this.pos.x < 14.6);
      if (ok) break;
      await this.hold(2);
    }
    this.once('bay_done');
    this.stamp('bay_closed');
  }

  /**
   * §4.3 / §4.6 "walk out, RUN after 3 m": a wave sent out of a sealed room walks through its door, then runs to the
   * player (`rush`: it must arrive — the ambush, the holdout, the tube fight), from the first member out (≤ 4 s).
   */
  private runOnceOut(group: string, out: (e: { position: THREE.Vector3 }) => boolean): void {
    this.S('run_' + group, async () => {
      await this.untilOr(() => this.members(group).some(out), 4);
      if (this.members(group).length) { this.rush(group, 40); this.stamp(`run:${group}`); }
    });
  }

  /** L + 5.0: the vent farther from the player (≥ 4 m, else ≤ 4 s, then the other); grille, + 0.4 s the pair. */
  private async vent(): Promise<void> {
    const L = this.now;
    await this.until(() => this.now >= L + 5.0);
    if (this.f.vent) return;
    const A = this.mk('mk4_vent_s_a'), B = this.mk('mk4_vent_s_b');
    let side: 'a' | 'b' = this.distTo(A) >= this.distTo(B) ? 'a' : 'b';
    const far = () => (side === 'a' ? A : B);
    if (this.distTo(far()) < 4) {
      const ok = await this.untilOr(() => this.distTo(far()) >= 4, 4);
      if (!ok) side = side === 'a' ? 'b' : 'a';
    }
    this.vig(side === 'a' ? 'vent_s_a' : 'vent_s_b');
    this.once(side === 'a' ? 'vent_a' : 'vent_b');
    await this.hold(0.4);
    // the level holds one pair per vent (g4_vent_a / g4_vent_b): only the chosen vent's pair comes out
    const group = `g4_vent_${side}`;
    this.engage(group, 'spawn');
    this.logSpawn(group, `vent_s_${side} grille`);
    this.S('out_' + group, () => this.fightOut(group, 60));
  }

  // ── §4.4 the theatre (the loop never waits) ──

  /**
   * Every cue of the arm: the announcer while the player is in the gallery. (The theatre's two screens, `theatre_cam`
   * and `theatre_screen`, are driven by the surgical dressing from the arm's cycle — cue, LED, attempt, parked — not here.)
   */
  private armCue(cue: string): void {
    if (!this.started) return;
    this.theatreLog.push({ cue, t: +this.now.toFixed(2), attempt: this.attempt() });
    if (this.theatreLog.length > 60) this.theatreLog.shift();
    if (!this.live || this.ctx.state !== 'playing' || !this.facts.inGallery) return;
    const spk = this.mk('mk4_gallery_spk');
    const heard = (id: string) => this.talk.heard.has(id);
    // (ttl 0.15: a line that cannot start on its cue is dropped and waits for the next cycle, never late)
    if (cue === 'approach' && !heard('l4_unit_theatre_1')) void this.unit('l4_unit_theatre_1', { at: spk });
    if (cue === 'fail' && !heard('l4_unit_theatre_2')) void this.unit('l4_unit_theatre_2', { at: spk });
    if (cue === 'regel' && heard('l4_unit_theatre_2') && !heard('l4_unit_theatre_3')) {
      void this.unit('l4_unit_theatre_3', { at: spk }).then((ok) => {
        if (!ok) return;
        this.S('choir_theatre', async () => {
          await this.hold(1.0);
          await this.say(this.choiceId('l4_choir_theatre'), { pri: 'scene', ttl: 20, cue: this.now });
        });
      });
    }
  }
  /** First frame in the gallery: beat `l4_theatre`; `_0` at once unless the cycle is within 3 s before `approach`. */
  private async gallery(): Promise<void> {
    await this.until(() => this.f.suite && this.facts.inGallery && this.ctx.state === 'playing');
    this.beat('l4_theatre');
    if (!this.talk.heard.has('l4_unit_theatre_0')) void this.unit('l4_unit_theatre_0', { at: this.mk('mk4_gallery_spk') });
  }

  // ── §4.5 the navy level ──

  private async lowerLevel(): Promise<void> {
    await this.until(() => this.f.suite && this.at('t4_stair_foot'));
    this.once('lower');
    await this.until(() => this.at('t4_lcorr') || this.f.lcorr);
    if (!this.f.lcorr) {
      await this.hold(1.0);
      this.once('lcorr');
      if (!this.prog.triggered.includes('g4_lower')) this.wakeGroup('g4_lower', 'ceiling dock');
    }
    await this.until(() => this.at('t4_chk'));
    this.once('navy');
  }

  /** F5 (`l4_armed`): carbine / a vest taken, the valve, the navy sentry woken or damaged, or 60 s in the checkpoint. */
  private async armedWatch(): Promise<void> {
    await this.until(() => this.f.armed || (this.f.suite && this.chkTime >= 60));
    if (!this.f.armed) await this.armed();
  }
  private async armed(): Promise<void> {
    if (this.f.armed) return;
    this.beat('l4_armed');
    this.stamp('armed');
    if (!this.prog.triggered.includes('g4_chk_sentry')) this.wakeGroup('g4_chk_sentry', 'dock over the booth');
    else this.rouse('g4_chk_sentry');
    await this.hold(2.0);
    this.engage('g4_store', 'spawn');                         // inside the sealed sterile store
    this.logSpawn('g4_store', 'sealed sterile store');
    this.S('out_g4_store', () => this.fightOut('g4_store', 60));
    await this.hold(0.4);
    this.set('storeOpen', true);                               // D_store
    await this.hold(0.9);
    this.rouse('g4_store');
    this.runOnceOut('g4_store', (e) => e.position.x < 3.6);
    await this.untilOr(() => this.members('g4_store').every((e) => e.position.x < 3.6), 10);
    // latch: not with the player in the store / its doorway (plan: x < 3.6 — read as "not on the store side")
    for (;;) {
      const ok = await this.closeBehind('d4_store', () => !this.inRoom('store4') && !(this.pos.x >= 3.6 && this.pos.x <= 4.6 && Math.abs(this.pos.z + 41) < 1.2 && Math.abs(this.pos.y - 4.8) < 1));
      if (ok) break;
      await this.hold(2);
    }
    this.once('store_done');
  }

  /** Feet inside the booth (x/z of the level's `booth` region, on the navy deck). */
  private inBooth(): boolean { return this.region('booth') && this.pos.y < 2; }
  private refuse(): void {
    this.once('refused');
    this.tubePanels(SCREEN4.tubeRefused);
    this.sfx('badge_deny', this.mk('mk4_booth'), 0.6);
    void this.unit('l4_unit_release_refused', { at: this.mk('mk4_booth') });
  }
  private release(): void {
    if (this.f.released) return;
    this.once('release');
    this.toast(TOAST4.released);
    this.sfx('badge_ok', this.mk('mk4_booth'), 0.6);
    void this.unit('l4_unit_release', { at: this.mk('mk4_booth') });
  }

  /** The valve: the pumps run 25 s on a fixed clock, loud; the sump opens at + 6 s; the units come wherever they are. */
  private async equalise(): Promise<void> {
    if (this.f.equalising || this.f.equalised) return;
    const t0 = this.now;
    this.beat('l4_equalise');
    this.stamp('equalise');
    this.vig('valve_open');
    const gauge = this.mk('mk4_gauge');
    void this.unit('l4_unit_equalise', { at: gauge, cue: t0 });
    // (`mk4_pumps`: between the two pump sets, 1 m up — audible across the checkpoint)
    this.startLoop('pumps', 'pump_loop', this.obj('mk4_pumps') ? this.mk('mk4_pumps') : this.roomPoint('plant4', 1.0).setX(this.roomPoint('plant4').x - 2.5), 1.0);
    this.startLoop('beacon', 'alarm_beacon', this.roomPoint('plant4', 3.0), 0.6);
    this.w.lights('plant_beacon', { enabled: true });
    if (!this.f.armed) this.S('armed', () => this.armed());
    this.S('sump', async () => {
      await this.until(() => this.now >= t0 + 6.0);
      this.vig('plant_sump');
      this.once('sump');
      await this.hold(0.4);
      this.engage('g4_plant', 'spawn');
      this.logSpawn('g4_plant', 'floor sump grille');
      this.S('out_g4_plant', () => this.fightOut('g4_plant', 60));
    });
    this.S('choir_pumps', async () => {
      await this.until(() => this.now >= t0 + 8.0);
      if (this.f.equalising) await this.say(this.choiceId('l4_choir_pumps'), { pri: 'talk', ttl: 10 });
    });
    let shown = '';
    await this.until(() => {
      const el = this.forced.has('equalised') ? EQUALISE_S : this.now - t0;
      const txt = SCREEN4.gaugeRun(Math.ceil(EQUALISE_S - el), 3.1 * Math.max(0, 1 - el / EQUALISE_S));
      if (txt !== shown) { shown = txt; this.screen('plant_gauge', 'terminal_idle', txt); }
      return el >= EQUALISE_S;
    });
    this.eqLen = +(this.now - t0).toFixed(3);
    this.once('equalised');                                // D2: the booth releases
    void this.unit('l4_unit_equalised', { at: gauge });
    this.stopLoop('pumps', 3);
    this.stopLoop('beacon', 3);
    this.toast(TOAST4.equalised);
  }

  // ── §4.6 the tube and the end ──

  private async tubeLine(): Promise<void> {
    await this.until(() => this.f.tubeFight || (this.f.released && this.at('t4_tube_0')));
    if (this.f.tubeFight) return;
    await this.say(this.choiceId('l4_choir_tube'), { pri: 'talk', ttl: 8 });
  }

  /** F6: past `t4_tube_1` and every F5 / plant unit dead, or ≥ 25 m away and unseen for 20 s. */
  private f5Clear(): boolean {
    for (const e of this.ctx.enemies.all) {
      if (!e.alive || !F5_GROUPS.includes(e.group)) continue;
      if ((this.unseen.get(e.id) ?? 0) < 20) return false;
    }
    return true;
  }
  private async f6(): Promise<void> {
    await this.until(() => this.forced.has('tube_fight') || (this.f.released && !this.f.tubeFight && this.inRoom('tube') && this.pos.z <= -72 && this.f5Clear()));
    await this.tubeFight();
  }
  private async tubeFight(): Promise<void> {
    if (this.f.tubeFight) return;
    this.beat('l4_tube_fight');
    this.stamp('tube_fight');
    this.engage('g4_tube', 'spawn');                          // inside the sealed gate lock
    this.logSpawn('g4_tube', 'sealed gate lock');
    this.S('out_g4_tube', () => this.fightOut('g4_tube', 60));
    await this.hold(0.2);
    this.set('tubeOpen', true);                                // F_open: d4_tube_s held open
    await this.hold(2.0);
    this.rouse('g4_tube');
    this.runOnceOut('g4_tube', (e) => e.position.z > -106.4);
    await this.untilOr(() => this.members('g4_tube').every((e) => e.position.z > -105), 12);
    this.once('gate_open');                                    // F: the gate lock door auto
    this.stamp('gate_open');
  }

  /** F → G: the gate lock latches behind the player. */
  private async gateLatch(): Promise<void> {
    await this.until(() => this.f.gateOpen);
    while (!this.f.gateLock) {
      // (past the doorway: the trigger starts inside it, so a latch tried there always failed and never re-armed)
      await this.until(() => this.forced.has('gatelock') || (this.at('t4_gatel') && this.pos.z < -108.2 && this.ctx.state === 'playing'));
      const forced = this.forced.has('gatelock');
      const ok = await this.latch('d4_tube_s', () => forced || this.pos.z < -107.4);
      if (ok) { this.beat('l4_gatelock'); break; }
      await this.until(() => !this.at('t4_gatel') || this.pos.z > -108.2 || this.forced.has('gatelock'));
    }
  }

  /** G: hostiles inside the gate lock are fought out; the gate panel, the dogs, CHOIR; the end. */
  private async endThread(): Promise<void> {
    await this.until(() => this.f.gateLock);
    this.stamp('sealed');
    await this.fightOutWhere('gatel', 60);
    await this.hold(0.6);
    const panel = this.mk('mk4_gate_panel');
    this.screen('gate_panel', 'terminal_idle', SCREEN4.gateEq);
    let end = this.now + lineDuration('l4_unit_gate');
    void this.unit('l4_unit_gate', { at: panel, onStart: (d) => { end = this.now + d; } });
    await this.until(() => this.now >= end + 0.3);
    this.screen('gate_panel', 'terminal_idle', SCREEN4.gateAuth);
    this.vig('gate_dogs');
    this.stamp('dogs');
    await this.hold(0.4);
    const cStart = this.now;
    let cEnd = this.now + lineDuration(this.choiceId('l4_choir_end'));
    void this.say(this.choiceId('l4_choir_end'), { pri: 'scene', now: true, next: true, gap: 0.05, onStart: (d) => { cEnd = this.now + d; } });
    await this.until(() => this.now >= Math.min(cEnd + 0.8, cStart + 6));
    this.beat('l4_end');
    this.stamp('end');
    await this.hooks.end();
  }

  // ───────────────────────────────────────────────────────────── Sunde's video log (§6.2)

  private pressVideo(): void {
    if (this.vlog.state === 'playing') { this.stopLog(); return; }
    if (this.vlog.state === 'done') this.vlog.next = 0;
    this.vlog.state = 'playing';
    const tok = ++this.vlog.token;
    this.w.setPrompt('log4_video', 'Stop log');
    this.S('video_log', () => this.runLog(tok));
  }
  private stopLog(): void {
    this.vlog.token++;
    const sp = this.talk.speaking;
    if (sp && sp.startsWith('l4_sunde_')) this.talk.cut();     // fade 0.12 s
    this.pauseLog();
  }
  private pauseLog(): void {
    this.vlog.state = 'paused';
    this.screen('pi_video', 'video_log', SCREEN4.video.paused(this.vlog.next + 1));
    this.w.setPrompt('log4_video', '기록 재생');
  }
  /** Each line on its beat: the scene owns the gaps; the screen's pose runs for exactly the line; the last stops at `cut`. */
  private async runLog(tok: number): Promise<void> {
    const first = this.vlog.next;
    const video = this.mk('mk4_video');
    const near = () => this.distTo(video) <= 14 || this.sees(video, 30, 60);
    for (let i = first; i < SUNDE_LOG.length; i++) {
      if (i > first) await this.hold(SUNDE_LOG[i - 1].gap);
      if (tok !== this.vlog.token) return;
      // a line that is not the log's own (a scene line, CHOIR) holds the channel: the log pauses at this line's start
      // (the press itself waits a moment for a line already playing — CHOIR on the PA — to end)
      // (and the channel's gap after the last line: a line asked inside it would start up to 0.35 s after the press)
      if (i === first && !this.channelFree()) await this.untilOr(() => this.channelFree() || tok !== this.vlog.token, 8);
      if (tok !== this.vlog.token) return;
      if (this.talk.busy) { this.pauseLog(); return; }
      const L = SUNDE_LOG[i];
      let started = false;
      const ok = await this.say(L.id, {
        pri: 'talk', now: true, gap: 0.05, at: video, subtitleIf: near, cue: this.now,
        onStart: (d) => {
          started = true;
          // the `screen` chain puts its designed lead (the recorder's tape start, voicefx `fxLead`) before the voice:
          // the face on the screen moves with the VOICE, so its pose starts that much after the line
          const lead = SCREEN_LEAD;
          if (lead > 0.01) this.S('video_pose', async () => { await this.hold(lead); if (tok === this.vlog.token) this.screen('pi_video', 'video_log', SCREEN4.video.play(i + 1, d, L.pose)); });
          else this.screen('pi_video', 'video_log', SCREEN4.video.play(i + 1, d, L.pose));
          if (L.id === 'l4_sunde_9') this.scheduleCut(tok);
        },
      });
      if (tok !== this.vlog.token) return;
      if (!started || !ok) { if (L.id !== 'l4_sunde_9' || !started) { this.pauseLog(); return; } }
      this.vlog.next = i + 1;
    }
    this.vlog.state = 'done';
    this.vlog.next = 0;
    this.w.setPrompt('log4_video', '기록 재생');
  }
  /** `l4_sunde_9` stops at the line's `cut` (fade 0.03 s) and the screen goes to static on the same frame. */
  private scheduleCut(tok: number): void {
    // (`cut` is in the take's time; the rendered line starts with the chain's lead)
    const cut = (line4('l4_sunde_9')?.cut ?? lineDuration('l4_sunde_9')) + SCREEN_LEAD;
    const t0 = this.now;
    this.S('sunde_cut', async () => {
      await this.until(() => {
        if (tok !== this.vlog.token) return true;
        // the audio starts a few ms after the say: measure from the buffer's start when the trace has it
        const h = this.currentHandle() as { trace?: { askP?: number; startP?: number } } | null;
        const lag = h?.trace?.startP && h.trace.askP ? Math.max(0, (h.trace.startP - h.trace.askP) / 1000) : 0;
        return this.now - t0 >= cut + lag;
      });
      if (tok !== this.vlog.token) return;
      const h = this.currentHandle() as { stop?: (f: number) => void } | null;
      if (this.talk.speaking === 'l4_sunde_9') {
        // stop the voice with the plan's 0.03 s fade, then free the channel (the line ends HERE: lineLog `end`)
        if (h?.stop) { try { h.stop(0.03); } catch { /* ignore */ } }
        try { const c = (this.talk as unknown as { current?: { handle?: unknown } }).current; if (c && h?.stop) c.handle = null; } catch { /* ignore */ }
        this.talk.cut();
      }
      this.vlog.cutAt = +this.now.toFixed(3);
      this.screen('pi_video', 'video_log', SCREEN4.video.static);
    });
  }
  /** The dialogue channel's current voice handle (the shared channel keeps it private; read-only use). */
  private currentHandle(): unknown {
    try { return (this.talk as unknown as { current?: { handle?: unknown } }).current?.handle ?? null; } catch { return null; }
  }

  // ───────────────────────────────────────────────────────────── reactions

  private onInteract(id: string): void {
    if (!this.started || this.ended || this.ctx.debug.noStory) return;
    const f = this.f;
    if (id === 'cold_ack') {
      if (this.phase === 'C' && !f.override && this.inRoom('cold')) this.S('override', () => this.override());
      return;
    }
    if (id === 'booth_release') {
      if (!this.inBooth() || f.released || !f.suite) return;
      if (f.equalised) this.release(); else this.refuse();
      return;
    }
    if (id === 'valve4') {
      if (!this.inRoom('plant4') || !f.suite || f.equalising || f.equalised) return;
      this.S('equalise', () => this.equalise());
      return;
    }
    if (id === 'log4_video') {
      if (!this.inRoom('pi_office')) return;
      this.logs.add('log4_video');
      if (!this.prog.read.includes('log4_video')) this.prog.read.push('log4_video');
      this.pressVideo();
      return;
    }
    const frag = FRAGMENTS4[id];
    if (!frag) return;
    // R8: a readable works only from inside its room (the roster terminal: from inside the booth)
    if (id === 'term4_ctrl' ? !this.inBooth() : READ_ROOM4[id] && !this.inRoom(READ_ROOM4[id])) return;
    this.openNote(id, frag);
  }
  protected override onNoteOpened(id: string): void {
    if (id === 'term4_ctrl') this.f.roster = true;
    if (this.inRoom('records') && (id === 'note4_consent' || id === 'note4_tveit') && !this.prog.triggered.includes('g4_rec')) {
      // g4_rec wakes 0.8 s after the note closes — never while it is open
      this.S('rec_note', async () => {
        await this.until(() => !this.noteOpen);
        if (this.recWakeAt < 0) this.recWakeAt = this.now + 0.8;
      });
    }
  }

  private onPickup(kind: string): void {
    if (!this.started) return;
    if (kind === 'carbine') {
      this.carbineAt = this.now;
      this.toast(TOAST4.carbine);
      this.S('choir_armoury', async () => { await this.hold(0.6); await this.say(this.choiceId('l4_choir_armoury'), { pri: 'talk', ttl: 2.4 }); });
    }
    if ((kind === 'carbine' || kind === 'vest') && this.f.suite) this.S('armed', () => this.armed());
  }

  private onDenied(id: string): void {
    if (!this.started || !this.live) return;
    const p = this.phase;
    if (id === 'd4_shower_in' && this.atLeast('C')) { void this.unit('l4_unit_clean', { at: this.atDoor(id) }); return; }
    if (id === 'd4_surg' && p === 'C') {
      this.f.holdSeen = true;
      this.sfx('hold_beep', this.atDoor(id), 0.6);
      void this.unit('l4_unit_hold', { at: this.atDoor(id) });
      return;
    }
    if (id === 'd4_tube_n' && (p === 'D' || p === 'D2' || p === 'D_store' || p === 'D_bay')) { void this.unit('l4_unit_tube_denied', { at: this.atDoor(id) }); return; }
    if (id === 'd4_tube_s' && !this.atLeast('F') && p !== 'F_open') { void this.unit('l4_unit_gatelock', { at: this.atDoor(id) }); return; }
    if (id === 'd4_bay') { this.toast(TOAST4.serviceOnly, 4); return; }
    if (id === 'd4_store') this.toast(TOAST4.staffOnly, 4);
  }

  /** A watched pane hit: CHOIR, once (rule: ≥ C, within 2 s). */
  protected override afterObjective(): void {
    if (this.live && this.ctx.state === 'playing' && this.facts.glassHitWithin(1.6) && this.quietNow()) {
      void this.say(this.choiceId('l4_choir_glass'), { pri: 'talk', ttl: 2 });
    }
  }

  /** `?nostory=1` (§3): every door auto except d4_bay, d4_store (locked), d4_cold (open); lights normal; arm running. */
  openEverything(): void {
    this.baseline();
    applyPhase4(this.ctx, 'nostory', { snap: true });
  }

  // ───────────────────────────────────────────────────────────── review / debug

  /**
   * Test hooks (`story.fire(name)`): force a gate or a beat with its real consequences (no player condition).
   * Returns what it did, or null for an unknown name. A level vignette id is fired as is.
   */
  fire(name: string): unknown {
    const f = this.f;
    const go = (n: string, fn: () => Promise<unknown> | void) => { this.S('fire_' + n, async () => { await fn(); }); return n; };
    switch (name) {
      case 'decon': this.forced.add('decon'); return 'decon';
      case 'shower': this.forced.add('shower'); return 'shower';
      case 'override': if (!f.clean) return null; return go('override', () => this.override());
      case 'lights_out': return go('lights_out', () => { if (!f.override) { this.beat('l4_override'); this.once('suite'); } this.lightsOut(); });
      case 'armed': return go('armed', () => this.armed());
      case 'refuse': this.refuse(); return 'refuse';
      case 'equalise': return go('equalise', () => this.equalise());
      case 'equalised': this.forced.add('equalised'); if (!f.equalising && !f.equalised) go('equalise', () => this.equalise()); return 'equalised';
      case 'release': if (!f.equalised) { this.once('equalised'); } this.release(); return 'release';
      case 'tube_fight': this.forced.add('tube_fight'); return 'tube_fight';
      case 'gate_open': if (!f.tubeFight) this.beat('l4_tube_fight'); this.once('gate_open'); return 'gate_open';
      case 'gatelock': this.forced.add('gatelock'); return 'gatelock';
      case 'video': this.pressVideo(); return this.vlog.state;
      default:
        if (!this.w.vignette(name)) return null; this.stamp(`vignette:${name}`); return name;
    }
  }

  get debugState() {
    const f = this.f;
    return {
      level: 4, beats: [...this.prog.beats], flags: { ...f }, phase: this.phase, phaseApplied: this.phaseApplied,
      now: +this.now.toFixed(2), clock: +this.t.toFixed(2), arrivalHour: this.arrivalHour, testHour: +this.clockHour().toFixed(5),
      t: { ...this.marks }, heard: [...this.talk.heard], lines: this.talk.log.length, speaking: this.talk.speaking, talking: this.talk.busy,
      restoredFrom: this.restoredFrom, loadout: this.loadout, arrival: this.arrival, checkpoint: this.lastCheckpoint, pendingCheckpoint: this.pendingCheckpoint,
      checkpoints: [...this.prog.checkpoints], calm: this.started && this.calm(), blocked: this.started && this.checkpointBlocked(),
      triggered: [...this.prog.triggered], cleared: [...this.prog.cleared], read: [...this.prog.read], visited: [...this.prog.visited],
      mood: this.director.mood, live: this.live, started: this.started, ended: this.ended, objective: this.objective(),
      missingMarkers: [...this.missingMarkers], bodies: this.bodies.length, panes: this.panes.length,
      arm: { ok: this.arm.ok, placeholder: this.arm.placeholder, cue: this.arm.cue(), t: +this.arm.t().toFixed(2), n: this.arm.n(), period: +this.arm.period().toFixed(2), attempt: this.attempt(), led: this.arm.led(), log: this.theatreLog.slice(-16) },
      video: { ...this.vlog },
      times: { decon: this.deconLen, shower: this.showerLen, equalise: this.eqLen, chkTime: +this.chkTime.toFixed(1), ...this.timesRec },
      cues: this.cueLog.slice(-80),
      spawns: this.spawnLog.slice(),
      views: { body: +this.bodySeen.toFixed(1), node2: +this.node2Seen.toFixed(1), roster: +this.rosterSeen.toFixed(1) },
      facts: this.firstViews(), failHold: this.failHold,
    };
  }
}

export { V };
