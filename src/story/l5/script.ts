/**
 * Level 5 — "초소 4" (stage 3c §4). The flow: the gate (A → B → B2), the cutscene "Under control" (C), the hand-back
 * and the two units (D0 → D), the first soldier held then released, his radio on the body, Kessler's pickup sequence
 * and her power cue (K), the keypad (S), Post 4 (the spine wave, the quarters, the crawl, the magazine), Kessler's door
 * and the neck check (V), lights-out and the vent wave, the sub bay in the dark, the gallery wheel (W), the tunnel (X)
 * and the end.
 *
 * Rules this file is built on (DESIGN.md R1–R8, plan §9; review fixes §13):
 *   R1  every gate is a door state of a phase (the level's `applyPhase5`), derived from the record (`phase`); every
 *       door that closes behind the player is a latch with a doorway check; nothing opens by timer (the keypad needs
 *       Kessler's power, the tunnel needs the check and the wheel).
 *   R3  every line has a rule (dialogue.ts), checked when it starts; scene / sequence speech is cued from recorded
 *       durations (`lineDuration`, the line's own `onStart` duration) and starts on its cue's frame.
 *   R4  nothing hostile exists before its beat (g5_mag dormant from load); every arrival is out of a sealed space
 *       through a door / vent / drain that visibly opens; `g5_s1` / `g5_patrol` are `spawnGroup`ed in `hold` and enter
 *       `prog.triggered` only when released (B1).
 *   B1  `afterReplay` re-spawns `g5_s1` in hold whenever the radio is not taken — the radio comes back with him.
 *   B2  the radio sits at `corpsePoint(id, 'chest')` (lifted above the wreck box by the manager); its R8 ray ignores
 *       that box.
 *   B3  the neck check measures the horizontal yaw (±50° of −x; pitch ignored), feet on the line with a 0.3 m edge
 *       tolerance, 1.2 s, live feedback (tally amber → white, the silhouette), the line said by the facing.
 *   S2  the spine wave also fires on t5_bay / t5_cmd / 45 s; the door beat waits for door-calm (hostiles in the spine or
 *       ≤ 30 m of walk), a holding soldier at the door is released (fought), strays are removed in calm waits.
 */
import * as THREE from 'three';
import type { GameContext, PalmPlate, PalmResult } from '../../core/types';
import type { Sequencer } from '../sequencer';
import type { MusicDirector } from '../director';
import type { World } from '../world';
import { CHECKPOINT_IDS_L5, type CheckpointIdL5, type ProgressL5 } from '../save';
import type { CheckpointRule } from '../stage/base';
import { lineDuration } from '../voice';
import { fxLead } from '../../audio/voicefx';
import { applyPhase5, type PhaseId5 } from '../../level/l5/phases';
import { GROUPS5, V, type Flags5, type HooksL5 } from './base';
import { Scenes5 } from './scenes';
import { line5, phaseRank5, type Bark5 } from './dialogue';
import { FRAGMENTS5, OBJ5, ON_POST5, RADIO_LABEL5, READ_ROOM5, SCREEN5, TOAST5, dhm5, hhmm5 } from './text';

/** The manifest's per-line lead (what the audio skips): `cut` is in FILE time (W9 notes). */
const MANIFEST = import.meta.glob('../../../voice/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const LEADS = new Map<string, number>();
try {
  const m = (Object.values(MANIFEST)[0] ?? {}) as { lines?: Record<string, { lead?: number }> };
  for (const [id, e] of Object.entries(m.lines ?? {})) if (id.startsWith('l5_')) LEADS.set(id, Math.max(0, Math.min(2, Number(e?.lead) || 0)));
} catch { /* ignore */ }
/** The radio chain's squelch before the voice (fxLead 0.04 s): the voice starts that much after the buffer. */
const RADIO_LEAD = (() => { try { return Math.max(0, fxLead('radio')); } catch { return 0.04; } })();

const QUARTERS = ['spine5', 'berths5', 'heads5', 'mess5', 'galley5', 'arm5', 'sub5'];
const SEQ_A: [string, number][] = [['l5_kes_1', 0], ['l5_reyes_r1', 0.5], ['l5_kes_2', 0.6], ['l5_kes_3', 0.5], ['l5_kes_4', 0.7]];
const DOOR_AFTER: [string, number][] = [['l5_kes_door_5', 0.7], ['l5_kes_door_6', 0.5], ['l5_kes_door_sunde', 0.8], ['l5_kes_door_7', 0.6]];
/** §5.5: which scares are loud, which are exempt from spacing. */
const LOUD5 = new Set(['v5_hull_groan', 'v5_trays', 'v5_boots', 'v5_magazine', 'v5_sub_check']);
const EXEMPT5 = new Set(['v5_magazine', 'v5_body']);
const SCARES5 = ['v5_turnstile', 'v5_hull_groan', 'v5_bunk_radio', 'v5_trays', 'v5_galley_shape', 'v5_water', 'v5_body', 'v5_boots', 'v5_magazine', 'v5_sub_check'];
const CHECK_S = 1.2;

export class ScriptL5 extends Scenes5 {
  /** For debugState (check-chain): how the run was armed. */
  loadout: 'carry' | 'direct' | 'none' | 'save' = 'none';
  arrival: { from: number | null; armor: number } = { from: null, armor: 0 };
  private forced = new Set<string>();
  private handBackAt = -1e9;
  private s1DiedAt = -1e9;
  private s1Id = -1;
  private radioPos: THREE.Vector3 | null = null;
  private radioReady = false;
  private takenAt = -1e9;
  private squawked = false;
  private keypadOpen = false;
  private lastQ = -1e9;
  private inSFor = 0;
  private wheelStartedAt: number | null = null;
  private wheelDoneAt: number | null = null;
  private lightsAt = -1e9;
  private lockGroups = new Set<string>();
  private lockLatchRunning = false;
  private palmBusy = false;
  /** The neck check's count is live (Q answers with the facing line). */
  private checkStage = false;
  private strip: string | null = null;
  // scares
  private lastScare = -1e9;
  private lastLoud = -1e9;
  private roomSince = new Map<string, number>();
  private calmSince = -1e9;
  private galleyLook = 0;
  private bodyASeen = 0;
  private bodyUnseen = 0;
  private spineUnseen = new Map<number, number>();
  // barks
  private lastBark = -1e9;
  private sawPlayer = new Set<number>();
  private downDue = new Map<number, number>();
  private hitAt = new Map<number, number>();
  private soldierDeaths: { p: THREE.Vector3; t: number }[] = [];
  // the g5_mag wake
  private magTime = 0;
  private magBeam = 0;
  private magTouched = false;
  private lastShotFrom: THREE.Vector3 | null = null;

  constructor(ctx: GameContext, seq: Sequencer, director: MusicDirector, w: World, logs: Set<string>, hooks: HooksL5) {
    super(ctx, seq, director, w, logs, hooks);
    const ev = ctx.events;
    ev.on('interact', (e) => this.onInteract(e.id));
    ev.on('door:denied', (e) => this.onDenied(e.id));
    ev.on('pickup', (e) => this.onPickup(e.kind, e.position));
    ev.on('weapon:fired', (e) => { this.lastShotFrom = e.origin.clone(); });
    ev.on('enemy:died', (e) => this.onEnemyDied(e.id, e.group, e.type, e.position));
    ev.on('enemy:alerted', (e) => this.onAlerted(e.id));
    ev.on('enemy:damaged', (e) => this.onEnemyDamaged(e.id));
    ev.on('bullet:impact', (e) => this.onImpact(e.point));
    this.installRadioGate();
  }

  // ───────────────────────────────────────────────────────────── consequences (idempotent; replayed on load)

  private readonly CONSEQUENCES: Record<string, () => void> = {
    '#gate_open': () => { this.f.gateOpen = true; },
    '#gate_latched': () => { this.f.gateLatched = true; },
    '#scene': () => { this.f.scene = true; this.f.inScene = false; },
    '#units': () => { this.f.unitsIn = true; },
    '#s1free': () => { this.f.s1Free = true; },
    '#radio': () => { this.f.radio = true; this.earn('radio'); },
    '#power': () => { this.f.powered = true; },
    l5_keypad: () => { this.f.keypad = true; },
    l5_spine_wave: () => { this.f.spineWave = true; },
    '#hatch_spine': () => { this.f.hatchSpine = true; },
    '#hatch_mag': () => { this.f.hatchMag = true; },
    '#boots': () => { this.f.boots = true; },
    '#door': () => { this.f.door = true; },
    l5_verified: () => { this.f.checked = true; this.earn('l5_door'); },
    '#verified': () => { this.f.verified = true; },
    l5_dark: () => { this.f.dark = true; },
    '#cmd_wave': () => { this.f.cmdWave = true; },
    l5_bay: () => { this.f.bayA = true; },
    l5_wheel: () => { this.f.wheel = true; },
    '#released': () => { this.f.released = true; },
    l5_tunnel: () => { this.f.tunnel = true; },
    '#patrol_free': () => { this.f.patrolFree = true; },
    '#mag': () => { this.f.magAwake = true; },
    '#boat': () => { this.earn('l5_boat'); },
  };
  protected consequence(id: string): void {
    const fn = this.CONSEQUENCES[id];
    if (fn) { try { fn(); } catch (e) { console.warn(`[story] consequence ${id} failed`, e); } }
  }

  /** The world every run starts from (before any phase): screens, prompts, interactables, set pieces. */
  protected baseline(): void {
    const H = this.arrivalHour;
    const s = (n: string, k: Parameters<ScriptL5['screen']>[1], t: string) => this.screen(n, k, t);
    s('gate_panel5', 'terminal_idle', SCREEN5.gateAuth);
    s('gate_log', 'terminal_idle', SCREEN5.gateLog(hhmm5(H - 40 / 60)));
    s('aas_palm', 'palm', SCREEN5.aasPalm(hhmm5(H - 40 / 60)));
    s('onpost', 'onpost', SCREEN5.onpost(ON_POST5));
    s('dock_status', 'dock_status', SCREEN5.dock(dhm5(H)));
    s('key5_panel', 'keypad', SCREEN5.keyOff);
    s('launch', 'launch', SCREEN5.launchIdle);
    s('launch5_palm', 'palm', SCREEN5.palmStandby);
    s('tern_board', 'dock_status', SCREEN5.ternIdle);
    s('tunnel_panel', 'terminal_idle', SCREEN5.tunnelIdle);
    // (W7's hardened door carries the panel as `door5_cmd_panel`; the greybox placeholder keeps §6.4's `cmd_panel`)
    if (this.ctx.level.screen('door5_cmd_panel')) s('door5_cmd_panel', 'terminal_idle', SCREEN5.cmdPanel.replace(/ — /g, '\n'));
    else s('cmd_panel', 'terminal_idle', SCREEN5.cmdPanel);
    this.w.setPrompt('key5_duty', '키패드 — 전원 없음');
    this.w.setInteractable('radio5', false);
    this.call('door5_cmd', 'tally', 'red');
    this.call('door5_cmd', 'pulse', false);
    this.call('door5_cmd', 'look', false);
    this.call('door5_cmd', 'lineGlow', 0);
    this.w.machine('tern', 'active');
  }
  protected baselineMood(): 'silence' | 'ambient' | 'tension' { return this.f.dark ? 'tension' : 'ambient'; }

  protected override applyPhaseTo(id: PhaseId5, snap: boolean): void {
    super.applyPhaseTo(id, snap);
    // the phase table switches these on per phase; a used one stays off (the story owns them after use)
    if (this.f.hatchSpine) this.w.setInteractable('hatch5_spine', false);
    if (this.f.hatchMag) this.w.setInteractable('hatch5_mag', false);
    if (this.f.wheel) this.w.setInteractable('wheel5', false);
  }

  // ── fast-forward ──

  /** B1: a load with the radio not taken never removes `g5_s1` (afterReplay re-spawns him holding). */
  override fastForward(saved: ProgressL5, from: CheckpointIdL5, cleared: readonly string[]): void {
    const radio = !!(saved.flags as Record<string, unknown>)?.radio;
    if (!radio) {
      saved = { ...saved, triggered: saved.triggered.filter((g) => g !== 'g5_s1'), cleared: saved.cleared.filter((g) => g !== 'g5_s1') };
      cleared = cleared.filter((g) => g !== 'g5_s1');
    }
    super.fastForward(saved, from, cleared);
  }
  protected override afterReplay(): void {
    const f = this.f;
    f.inScene = false; f.diveOpen = false; f.lockOpen = false;
    // B1: whenever the radio is not taken, g5_s1 stands again in hold at mk5_s1 (the radio comes back with him)
    if (f.scene && !f.radio) this.spawn('g5_s1', false);
    // g5_patrol: absent after any load (optional; never restored)
    for (const g of ['g5_patrol']) { try { this.ctx.enemies.removeGroup(g); } catch { /* ignore */ } }
  }
  protected override afterSnap(): void { this.restoreWorld(); }

  /** The world of the record, rebuilt silently on a load (snaps, screens, prompts, lights, the strip). */
  private restoreWorld(): void {
    const f = this.f;
    this.screen('gate_panel5', 'terminal_idle', f.gateLatched ? SCREEN5.gateClosed : SCREEN5.gateAuth);
    if (f.powered) { this.snapVig('key5_power'); this.w.setPrompt('key5_duty', '키패드 사용'); }
    this.screen('key5_panel', 'keypad', f.keypad ? SCREEN5.keyOpen : f.powered ? SCREEN5.keyReady : SCREEN5.keyOff);
    if (f.radio) this.w.setInteractable('radio5', false);
    if (f.hatchSpine) this.snapVig('hatch5_spine_open');
    if (f.hatchMag) this.snapVig('hatch5_mag_open');
    if (this.ctx.facts.l5_boat === true) this.screen('launch5_palm', 'palm', SCREEN5.palmRefused);
    for (const id of this.prog.scares) this.snapVig(id);
    if (this.prog.scares.includes('v5_sub_check') || f.verified) { this.screen('tern_board', 'dock_status', SCREEN5.ternDone); this.screen('launch', 'launch', SCREEN5.launchComplete); }
    if (f.checked) this.call('door5_cmd', 'tally', 'white');
    if (f.verified) this.screen('tunnel_panel', 'terminal_idle', f.released ? SCREEN5.tunnelOpen : SCREEN5.tunnelRelease);
    if (f.dark) {
      this.snapVig('lights_out5');
      this.snapVig('dark5_on');
      this.call('door5_cmd', 'lineGlow', 1);
      // (W2b: audio switches to the dark ambience on the beat — again on a restore past it)
      this.ctx.events.emit('story:beat', { id: 'l5_dark' });
    }
    if (f.wheel) this.snapVig('wheel5_turn');
  }

  // ───────────────────────────────────────────────────────────── per frame

  protected override onFrame(dt: number): void {
    const s = this.ctx.state;
    if (s === 'playing' || s === 'cutscene') this.prog.t += dt;
    if (!this.live) return;
    // Q = ask Kessler (§8.6)
    try { if (s === 'playing' && this.ctx.input.pressed('KeyQ')) this.radioAsk(); } catch { /* ignore */ }
    // the HUD radio strip: live while a radio line plays
    if (this.f.radio && !this.ended) {
      const live = this.now < this.radioUntil;
      const key = live ? 'live' : 'idle';
      if (key !== this.strip) { this.strip = key; try { this.ctx.ui.radio({ label: RADIO_LABEL5, live }); } catch { /* ignore */ } }
    }
  }

  protected override onStep(step: number): void {
    if (!this.live || this.ctx.state !== 'playing') return;
    const f = this.f;
    const room = this.w.room();
    for (const r of QUARTERS.concat(['gate5', 'duty5', 'ready5', 'dive5', 'tunnel5'])) {
      if (room === r) { if (!this.roomSince.has(r)) this.roomSince.set(r, this.now); } else this.roomSince.delete(r);
    }
    if (f.keypad && !f.spineWave && !this.below()) this.inSFor += step;
    const calmNow = this.scareCalm(true);
    if (!calmNow) this.calmSince = -1e9; else if (this.calmSince < -1e8) this.calmSince = this.now;
    // view timers
    this.launchSeen = this.sees(this.mk('mk5_launch').setY(this.mk('mk5_launch').y + 1.0), 4.5, 60) ? this.launchSeen + step : 0;
    this.boardSeen = this.sees(this.mk('mk5_tern_board'), 40, 40) ? this.boardSeen + step : 0;
    // §6.2 `l5_kes_boat`: also when the launch console has been in view ≤ 4 m for 2 s (not only on the refused palm)
    if (f.radio && !this.boatAsked && this.launchSeen >= 2 && !this.talk.heard.has('l5_kes_boat')) {
      this.boatAsked = true;
      this.S('kes_boat_view', () => this.kesLater('l5_kes_boat', 20));
    }
    this.selfWaking();
    this.magRules(step);
    this.patrolRules();
    this.scareRules(step);
    this.barkRules();
    this.strayRule(step);
    this.calmWaiting = this.pendingCheckpoint !== null || (f.door ? false : this.at('t5_cmd') && f.keypad);
    if (this.director.mood !== 'tension' && this.w.active() > 0) this.director.setMood('tension');
    else if (this.director.mood === 'tension' && !f.dark && this.w.active() === 0 && this.now - this.lastCombat > 8) this.director.setMood('ambient');
  }

  protected objective(): string {
    if (!this.live || this.ended) return OBJ5.none;
    const f = this.f;
    switch (this.phase) {
      case 'X': return OBJ5.none;
      case 'W': case 'W_lock': return OBJ5.tunnel;
      case 'V': case 'V_lock': return OBJ5.wheel;
      case 'S': case 'S_dive': return f.door && !f.checked ? OBJ5.line : OBJ5.door;
      case 'K': return this.prog.codeWrong >= 3 ? OBJ5.keypadCode : OBJ5.keypad;
      case 'D': case 'D0':
        if (this.squawked && !f.radio) return OBJ5.radio;
        if (!f.unitsIn || this.w.alive('g5_duty') > 0) return OBJ5.survive;
        return OBJ5.ready;
      default: return OBJ5.find;
    }
  }

  // ───────────────────────────────────────────────────────────── checkpoints (§7)

  protected readonly checkpointIds = CHECKPOINT_IDS_L5;
  protected readonly CHECKPOINTS: Record<CheckpointIdL5, CheckpointRule> = {
    cp5_start: { when: () => this.f.gateOpen, valid: () => !this.f.gateLatched },
    cp5_duty: { when: () => false, valid: () => false },
    cp5_ready: {
      when: () => this.f.unitsIn && this.fought('g5_duty', 1.5) && this.holdingIn('g5_s1') > 0 && ['duty5', 'ready5'].includes(this.w.room() ?? ''),
      valid: () => !this.f.s1Free && !this.f.radio,
    },
    cp5_radio: { when: () => this.f.powered && ['duty5', 'ready5'].includes(this.w.room() ?? ''), valid: () => !this.f.keypad },
    cp5_spine: {
      when: () => this.f.spineWave && this.fought('g5_spine', 1.5) && QUARTERS.includes(this.w.room() ?? '') && !this.below(),
      valid: () => !this.f.door,
    },
    cp5_door: { when: () => false, valid: () => false },
    cp5_bay: {
      when: () => this.f.bayA && this.fought('g5_bay_a', 1.5) && this.fought('g5_cmd', 1.5) && ['sub5', 'spine5', 'arm5'].includes(this.w.room() ?? '') && !this.below(),
      valid: () => !this.f.tunnel,
    },
  };
  /** §7: no checkpoint during the scene, the pickup sequence before `_4`, the door beat, the wheel's 4 s, below, X. */
  protected override checkpointBlocked(): boolean {
    const f = this.f;
    return f.inScene || (f.radio && !f.powered) || (f.door && !f.dark) || (f.wheel && !f.released) || f.tunnel || this.below()
      || f.diveOpen || f.lockOpen || this.keypadOpen || this.palmBusy || this.ended;
  }
  /** Debug / check-chain: write a checkpoint now (the record as it is). */
  debugCheckpoint(id: CheckpointIdL5): boolean {
    try { if (!this.prog.checkpoints.includes(id)) this.prog.checkpoints.push(id); this.lastCheckpoint = id; this.hooks.checkpoint(id); return true; } catch { return false; }
  }
  markEnded(): void { this.ended = true; }
  /** §7: the test hour now, carried as fact `testHour`. */
  clockHour(): number { return this.arrivalHour + this.t / 3600; }

  // ───────────────────────────────────────────────────────────── flow

  start(): void {
    if (this.started) return;
    this.started = true;
    if (!this.restoredFrom) {
      this.baseline();
      this.snapPhase();
      this.director.setMood('ambient');
    }
    this.lastMovePos.copy(this.pos);
    this.lastMoveAt = this.now;
    const S = (n: string, fn: () => Promise<unknown>) => this.S(n, fn);
    S('arrival', () => this.arrivalBeat());
    S('gate_latch', () => this.gateLatch());
    S('scene', () => this.sceneThread());
    S('units', () => this.unitsThread());
    S('s1', () => this.s1Thread());
    S('radio_seq', () => this.radioSequence());
    S('power_guard', () => this.powerGuard());
    S('spine', () => this.spineThread());
    S('door', () => this.doorBeat());
    S('cmd', () => this.cmdThread());
    S('bay', () => this.bayThread());
    S('boots', () => this.bootsThread());
    S('tunnel', () => this.tunnelThread());
    if (this.restoredFrom) this.resumeThreads();
  }
  /** After a load past a beat: what a thread cannot know by itself. */
  private resumeThreads(): void {
    const f = this.f;
    if (f.powered && !f.keypad) this.w.setPrompt('key5_duty', '키패드 사용');
    if (f.dark) this.lightsAt = this.now - 1.5;
    if (f.wheel && !f.released) { this.once('released'); }
    if (f.radio) this.strip = null;
  }

  /** A new run: control in the gate lock (phase A). */
  begin(): void {
    this.live = true;
    this.ctx.player.controlsEnabled = true;
    this.ctx.ui.setHudVisible(true);
    this.ctx.setState('playing');
  }
  /** After a checkpoint load (`resumed`). */
  resumeLive(): void {
    this.live = true;
    this.ctx.ui.setHudVisible(true);
    this.strip = null;
  }

  // ── §4.1 arrival (A → B), the gate latch (B → B2) ──

  private async arrivalBeat(): Promise<void> {
    if (this.f.gateOpen) return;
    await this.until(() => this.live && this.ctx.state === 'playing');
    const t0 = this.now;
    this.beat('l5_start');
    await this.until(() => this.now >= t0 + 0.4);
    // the gate rises 2.4 s (its own sounds, S1o); the vignette only drives the dogs and the panel
    this.vig('gate5_open');
    try { this.door('d5_gate')?.open(); } catch { /* ignore */ }
    await this.until(() => this.now >= t0 + 1.2);
    this.vig('gate5_booth');
    await this.until(() => this.now >= t0 + 2.8);
    this.once('gate_open');
    this.checkpointNow('cp5_start');
  }

  private async gateLatch(): Promise<void> {
    await this.until(() => this.f.gateOpen);
    while (!this.f.gateLatched) {
      await this.until(() => this.forced.has('gate') || (this.phase === 'B' && this.inTrig('t5_gate') && this.ctx.state === 'playing'));
      const forced = this.forced.has('gate');
      this.screen('gate_panel5', 'terminal_idle', SCREEN5.gateAuth);
      const ok = forced || await this.latch('d5_gate', () => this.pos.z < -0.6, 1.9, 1.0, 3.6);
      if (ok) {
        this.once('gate_latched');
        this.stamp('gate_latched');
        this.screen('gate_panel5', 'terminal_idle', SCREEN5.gateClosed);
        void this.unit('l5_unit_gate', this.mk('mk5_gate_panel'));
        break;
      }
      // the latch failed (the doorway): the gate rises again, re-armed on the next entry
      this.screen('gate_panel5', 'terminal_idle', SCREEN5.gateClear);
      await this.hold(2.6);
    }
  }

  /**
   * §3 latch: `closeBehind`, but a player standing in the doorway fails it at once — the door never closes on them; it
   * reopens and the trigger re-arms (§9 #3). `halfW` / `halfD`: the doorway box (along / across the wall).
   */
  private async latch(id: string, keepSide: () => boolean, halfW: number, halfD: number, timeout: number): Promise<boolean> {
    const d = this.door(id);
    if (!d) return keepSide();
    const wall = (d as unknown as { spec?: { wall?: string } }).spec?.wall ?? 'z';
    const inDoorway = () => {
      const ax = Math.abs(this.pos.x - d.position.x), az = Math.abs(this.pos.z - d.position.z);
      const [along, across] = wall === 'x' ? [az, ax] : [ax, az];
      return along < halfW && across < halfD && Math.abs(this.pos.y - this.doorFloor(d)) < 1.5;
    };
    if (!inDoorway()) {
      d.lock();
      const t0 = this.now;
      await this.until(() => this.isShut(d) || inDoorway() || this.now - t0 > timeout);
      if (!inDoorway() && this.isShut(d) && keepSide()) return true;
    }
    d.unlock();
    d.open();
    return false;
  }

  // ── §4.2 the cutscene (B2 → C → D0) ──

  private async sceneThread(): Promise<void> {
    if (this.f.scene) return;
    // polled every frame in B2 (S2): a player already waiting at the door starts it the moment B2 applies
    await this.until(() => this.forced.has('scene') || (this.phase === 'B2' && this.ctx.state === 'playing' && this.inTrig('t5_dutydoor') && this.sceneReady()));
    if (!this.cut) { this.sceneEnd('skipped'); this.handBack(); return; }
    const r = await this.sceneUnderControl();
    if (r === 'refused') return;
    this.handBack();
  }
  /** H: control returned — `g5_s1` spawned in hold behind the shut door (B1), `cp5_duty` at once. */
  private handBack(): void {
    this.handBackAt = this.now;
    this.stamp('H');
    this.once('scene');
    if (!this.spawnedGroups.has('g5_s1')) this.spawn('g5_s1', false);
    this.checkpointNow('cp5_duty');
  }

  // ── §4.2 after hand-back: the units (D0 → D) ──

  private async unitsThread(): Promise<void> {
    await this.until(() => this.f.scene);
    if (this.f.unitsIn) return;
    const H = this.handBackAt > -1e8 ? this.handBackAt : this.now;
    await this.until(() => this.now >= H + 1.5 || this.forced.has('units'));
    // inside ready5 behind the shut door (spawn visibility: the door is shut)
    this.spawn('g5_duty', true);
    this.S('out_g5_duty', () => this.fightOut('g5_duty', 60));
    await this.until(() => this.now >= H + 2.5 || this.forced.has('units'));
    this.once('units');
    try { this.door('d5_ready')?.open(); } catch { /* ignore */ }
    this.rouse('g5_duty');
    // they walk in, and run after 2 m (`rush`: a wave that must arrive)
    const from = this.members('g5_duty').map((e) => ({ id: e.id, p: e.position.clone() }));
    const t0 = this.now;
    await this.until(() => this.now - t0 > 1.6 || this.members('g5_duty').some((e) => { const s = from.find((q) => q.id === e.id); return !!s && s.p.distanceTo(e.position) >= 2; }));
    if (this.members('g5_duty').length) this.rush('g5_duty', 20);
  }

  // ── §4.3 the first soldier ──

  private async s1Thread(): Promise<void> {
    await this.until(() => this.f.scene);
    if (this.f.radio) return;
    const H = this.now;
    let dutyDead = -1e9;
    await this.until(() => {
      if (this.f.s1Free || this.forced.has('release_s1')) return true;
      if (this.w.alive('g5_s1') === 0 && this.spawnedGroups.has('g5_s1') && this.s1DiedAt > -1e8) return true;
      if (this.f.unitsIn && dutyDead < -1e8 && this.fought('g5_duty', 0)) dutyDead = this.now;
      if (this.inTrig('t5_ready') && this.pos.z < -24.0) return true;
      if (dutyDead > -1e8 && this.now - dutyDead >= 20 && ['duty5', 'ready5'].includes(this.w.room() ?? '')) return true;
      return this.now - H >= 45;
    });
    if (this.w.alive('g5_s1') > 0) this.releaseS1('story');
  }
  private releaseS1(why: string): void {
    if (!this.f.s1Free) {
      try { this.ctx.enemies.release('g5_s1'); } catch { /* ignore */ }
      this.once('s1free');
      this.markTriggered('g5_s1');
      this.stamp('s1_free');
      if (this.ctx.debug.verbose) console.log(`[story] g5_s1 released (${why})`);
      // (never removed as stranded: the radio — the only way on — is on his body)
      this.S('out_g5_s1', () => this.fightOut('g5_s1', 90, { keep: () => !this.f.radio }));
    }
    for (const e of this.members('g5_s1')) this.downDue.set(e.id, this.now + 3);
  }
  private onAlerted(id: number): void {
    if (!this.started || this.ff) return;
    const e = this.ctx.enemies.all.find((x) => x.id === id);
    if (!e) return;
    // the soldier module released itself (damage, a near miss, sight within 6 m): the story mirrors it
    if (e.group === 'g5_s1' && !this.f.s1Free) this.releaseS1('self');
    if (e.group === 'g5_patrol' && !this.f.patrolFree) this.releasePatrol();
    if (e.type === 'soldier') this.downDue.set(e.id, this.now + 3);
  }
  private onEnemyDamaged(id: number): void {
    if (!this.started || this.ff) return;
    const e = this.ctx.enemies.all.find((x) => x.id === id);
    if (!e) return;
    if (e.type === 'soldier') this.hitAt.set(id, this.now);
    if (e.group === 'g5_s1' && !this.f.s1Free) this.releaseS1('damaged');
    if (e.group === 'g5_patrol' && !this.f.patrolFree) this.releasePatrol();
  }

  private onEnemyDied(id: number, group: string, type: string, p: THREE.Vector3): void {
    if (!this.started || this.ff) return;
    if (type === 'soldier') this.soldierDeaths.push({ p: p.clone(), t: this.now });
    if (group !== 'g5_s1' || this.f.radio) return;
    this.s1DiedAt = this.now;
    this.s1Id = id;
    this.stamp('s1_dead');
    const died = this.now;
    // B2: the radio point follows the chest while the body falls, then is fixed (≥ 1.6 s after enemy:died)
    this.S('radio_point', async () => {
      let last: THREE.Vector3 | null = null, still = 0, prev = this.now;
      await this.until(() => {
        const cp = this.ctx.enemies.corpsePoint(id, 'chest');
        const dt = this.now - prev; prev = this.now;
        if (cp) {
          this.radioPos = cp.clone();
          still = last && last.distanceTo(cp) < 0.004 ? still + dt : 0;
          last = cp.clone();
          this.placeRadio();
        }
        return this.f.radio || (this.now - died >= 1.6 && (still >= 0.25 || this.now - died >= 3.0) && !!cp);
      });
      if (this.f.radio) return;
      if (this.radioPos) this.radioPos = this.safeRadioPoint(this.radioPos, id);
      this.radioReady = true;
      this.placeRadio();
      this.w.setInteractable('radio5', true);
      this.stamp('radio_point');
    });
    this.S('squawk', () => this.squawks(died));
  }
  private placeRadio(): void {
    const it = this.ctx.interactables.get('radio5');
    if (it && this.radioPos) it.position.copy(this.radioPos);
  }
  /**
   * B2 guard: a body that fell against cover can put its chest INSIDE a collider (measured on the greybox: a forward
   * fall at mk5_s1 puts the chest 0.3 m into the kit rack). The radio then moves along the body toward its feet to the
   * first point with open air above and around it (still on the body: never a point nobody can see or reach).
   */
  private safeRadioPoint(cp: THREE.Vector3, id: number): THREE.Vector3 {
    const ph = this.ctx.physics;
    const e = this.ctx.enemies.all.find((x) => x.id === id);
    const feet = e ? e.position.clone().setY(cp.y) : cp.clone();
    let top = cp.y + 2.4;
    try { const r = this.ctx.level.roomAt(cp); if (r) top = Math.min(top, r.bounds.max.y - 0.05); } catch { /* ignore */ }
    const down = V(0, -1, 0);
    // open air above the point and 0.14 m round it: the first thing a ray from under the ceiling meets is the body's
    // own box / the floor below the point (a ray that STARTS inside a box does not see it, so it starts up high)
    const clear = (c: THREE.Vector3) => {
      try {
        for (const d of [V(0, 0, 0), V(0.14, 0, 0), V(-0.14, 0, 0), V(0, 0, 0.14), V(0, 0, -0.14)]) {
          const h = ph.raycast(V(c.x + d.x, top, c.z + d.z), down, top - c.y + 0.3);
          if (h && h.point.y > c.y + 0.02) return false;
        }
        return true;
      } catch { return true; }
    };
    for (let k = 0; k <= 12; k++) {
      const c = cp.clone().lerp(feet, k / 12);
      if (clear(c)) return c;
    }
    return cp.clone();
  }
  /** R8 for the radio (B2): usable only with a clear ray from the eye — the owner's own wreck box does not count. */
  private installRadioGate(): void {
    const it = this.ctx.interactables.get('radio5');
    if (!it) return;
    let base = false;
    Object.defineProperty(it, 'enabled', {
      configurable: true,
      get: () => base && this.radioReady && !this.f.radio && this.radioRay(),
      set: (v: boolean) => { base = v; },
    });
    base = false;
  }
  private radioRay(): boolean {
    const p = this.radioPos;
    if (!p) return false;
    const eye = this.ctx.player.eye;
    try {
      if (this.ctx.physics.lineOfSight(eye, p)) return true;
      const dir = p.clone().sub(eye);
      const len = dir.length();
      const hit = this.ctx.physics.raycast(eye, dir.normalize(), len);
      if (!hit) return true;
      const e = this.ctx.enemies.all.find((x) => x.id === this.s1Id) as unknown as { wreckBox?: THREE.Box3 } | undefined;
      const box = e?.wreckBox?.clone().expandByScalar(0.12);
      return !!box && box.containsPoint(hit.point);
    } catch { return true; }
  }
  /** §4.3: death + 30 s, then every 25 s (4 ×), then every 40 s — until the radio is taken. */
  private async squawks(died: number): Promise<void> {
    let k = 0;
    let next = died + 30;
    for (;;) {
      await this.until(() => this.f.radio || this.now >= next || this.s1DiedAt !== died);
      if (this.f.radio || this.s1DiedAt !== died || this.ended) return;
      const at = this.radioPos?.clone() ?? this.mk('mk5_s1');
      this.sfx('radio_squawk', at, 0.8);
      const id = k % 2 === 1 ? 'l5_kes_squawk_2' : 'l5_kes_squawk_1';
      void this.say(id, { pri: 'scene', now: true, gap: 0.2, at, ttl: 4 });
      if (!this.squawked) { this.squawked = true; this.stamp('squawk'); }
      k++;
      next = this.now + (k <= 4 ? 25 : 40);
    }
  }
  protected override radioNearCam(): boolean {
    const p = this.radioPos;
    return !!p && this.distTo(p) <= 12 && ['duty5', 'ready5'].includes(this.w.room() ?? '');
  }

  /** `radio5` used: the radio is the player's; the pickup sequence. */
  private takeRadio(): void {
    if (this.f.radio) return;
    this.takenAt = this.now;
    // the radio is in hand: a squawk still on the channel stops (Kessler starts 0.4 s after the take)
    const sp = this.talk.speaking;
    if (sp && /^l5_kes_squawk_/.test(sp)) this.talk.cut();
    this.once('radio');
    this.stamp('radio');
    this.toast(TOAST5.radio);
    this.w.setInteractable('radio5', false);
    this.strip = null;
    try { this.ctx.ui.radio({ label: RADIO_LABEL5, live: false }); } catch { /* ignore */ }
  }

  // ── §4.4 Kessler on the radio (D → K) ──

  /**
   * One sequence line on its cue: wait until `at` (a bark in the way is cut first), start it on that frame, resolve at
   * its end with the end time (false: dropped — a death, a rule).
   */
  private async seqLine(id: string, at: number, onStart?: (d: number) => void): Promise<number | false> {
    await this.until(() => this.now >= at - 0.2 || this.ended);
    const sp = this.talk.speaking;
    if (sp && /^l5_sol_/.test(sp)) this.talk.cut();
    await this.until(() => this.now >= at || this.ended);
    if (this.ended) return false;
    const ok = await this.say(id, { pri: 'scene', now: true, gap: 0.02, cue: this.now, onStart });
    if (!ok && !this.talk.heard.has(id) && !(id === 'l5_kes_9' && this.talk.heard.has('l5_kes_9b'))) {
      // (a variant said instead counts; a line dropped by a death ends the sequence)
      const said = [...this.talk.log].reverse().find((l) => l.id === id)?.said;
      if (!said) return false;
    }
    return this.now;
  }

  private async radioSequence(): Promise<void> {
    await this.until(() => this.f.radio);
    const heard = (id: string) => this.talk.heard.has(id);
    if (heard('l5_kes_9') || heard('l5_kes_9b')) { this.S('brekke', () => this.brekke(this.now)); return; }
    this.seqBusy = true;
    try {
      let end: number | false = this.restoredFrom ? this.now + 0.6 : this.takenAt + 0.4;
      if (!this.f.powered) {
        let first = true;
        for (const [id, gap] of SEQ_A) {
          end = await this.seqLine(id, first ? (end as number) : (end as number) + gap);
          first = false;
          // (a line dropped — a cut, a missing take — never strands the player: the keypad still gets its power; Q says the code)
          if (end === false) { if (!this.ended) this.powerCue(); return; }
        }
        this.powerCue();
      }
      // (a load at cp5_radio resumes from the first line not heard)
      const left: [string, number][] = [['l5_kes_5', 0.8], ['l5_kes_6', 0.4]];
      for (const [id, gap] of left) {
        if (heard(id)) continue;
        if (id === 'l5_kes_6') { end = await this.kes6((end as number) + gap); }
        else end = await this.seqLine(id, (end as number) + gap);
        if (end === false) return;
      }
      const rest: [string, number][] = [['l5_kes_7', 0.9], ['l5_reyes_r2', 0.5], ['l5_kes_8', 0.6], ['l5_kes_9', 0.5]];
      for (const [id, gap] of rest) {
        if (heard(id) || (id === 'l5_kes_9' && heard('l5_kes_9b'))) continue;
        end = await this.seqLine(id, (end as number) + gap);
        if (end === false) return;
      }
      this.S('brekke', () => this.brekke(end as number));
    } finally {
      this.seqBusy = false;
    }
  }
  /**
   * `l5_kes_6` stopped at its `cut` (fade 0.03 s): `cut` is in the take's FILE time; the audio skips the take's lead and
   * the radio chain puts its squelch (fxLead) before the voice — so the stop comes `cut − lead + fxLead` after the line's
   * start. CHOIR (`l5_choir_radio`) starts 0.05 s before the stop, over it, on the overlap channel. Resolves with
   * CHOIR's end time (the next line's anchor).
   */
  private async kes6(at: number): Promise<number | false> {
    const l = line5('l5_kes_6');
    const cutT = Math.max(0.5, (l?.cut ?? lineDuration('l5_kes_6')) - (LEADS.get('l5_kes_6') ?? 0) + RADIO_LEAD);
    let started = -1;
    let choirEnd = -1;
    this.S('kes6_cut', async () => {
      await this.until(() => started >= 0 || this.ended);
      if (this.ended) return;
      const lag = () => {
        const h = this.currentHandle() as { trace?: { askP?: number; startP?: number } } | null;
        return h?.trace?.startP && h.trace.askP ? Math.max(0, (h.trace.startP - h.trace.askP) / 1000) : 0;
      };
      await this.until(() => this.now - started >= cutT - 0.05 + lag() || this.talk.speaking !== 'l5_kes_6');
      void this.overlapLine('l5_choir_radio', { onStart: (d) => { choirEnd = this.now + d; } });
      await this.until(() => this.now - started >= cutT + lag() || this.talk.speaking !== 'l5_kes_6');
      if (this.talk.speaking === 'l5_kes_6') {
        const h = this.currentHandle() as { stop?: (f: number) => void } | null;
        if (h?.stop) { try { h.stop(0.03); } catch { /* ignore */ } }
        try { const c = (this.talk as unknown as { current?: { handle?: unknown } }).current; if (c && h?.stop) c.handle = null; } catch { /* ignore */ }
        this.talk.cut();
      }
      this.stamp('kes6_cut');
    });
    const r = await this.seqLine('l5_kes_6', at, () => { started = this.now; });
    if (r === false && started < 0) return false;
    await this.until(() => choirEnd >= 0 || this.ended);
    await this.until(() => this.now >= choirEnd || this.ended);
    return this.ended ? false : choirEnd;
  }
  /** The dialogue channel's current voice handle (read-only use). */
  private currentHandle(): unknown {
    try { return (this.talk as unknown as { current?: { handle?: unknown } }).current?.handle ?? null; } catch { return null; }
  }
  /** Soft-lock guard: the radio taken and no power 45 s later (the sequence stalled) → the power cue anyway. */
  private async powerGuard(): Promise<void> {
    await this.until(() => this.f.radio);
    if (this.f.powered) return;
    const t0 = this.now;
    await this.until(() => this.f.powered || this.ended || this.now - t0 >= 45);
    if (!this.f.powered && !this.ended) { console.warn('[story] level 5: no power cue 45 s after the radio — powered by the guard'); this.powerCue(); }
  }
  /** At `l5_kes_4`'s end (S2): the keypad lights, phase K, Q live, the objective; `cp5_radio` armed. */
  private powerCue(): void {
    if (this.f.powered) return;
    this.once('power');
    this.stamp('power');
    this.vig('key5_power');
    this.screen('key5_panel', 'keypad', SCREEN5.keyReady);
    this.w.setPrompt('key5_duty', '키패드 사용');
    this.toast(TOAST5.q);
    // §4.4: cp5_radio "taken now when calm" (else the calm rule takes it at the next calm moment in duty5 / ready5, in K)
    if (this.calm() && ['duty5', 'ready5'].includes(this.w.room() ?? '')) this.checkpointNow('cp5_radio');
  }
  /** `_9` end + 6 s, calm, once: "That radio was Brekke's." */
  private async brekke(after: number): Promise<void> {
    if (this.talk.heard.has('l5_kes_brekke')) return;
    // (never on the code's acceptance: CHOIR's "Thank you, Commander" has those 2 s)
    // (IA-5: never once Kessler's door has started — after a cp5_radio load the replayed sequence can end late, and the
    // line then fell on lights-out and pushed `l5_kes_dark` 2 s off its cue: the moment for it has passed)
    await this.until(() => this.f.door || (this.now >= after + 6 && this.now - this.acceptedAt > 2.5 && !this.keypadOpen && this.awakeHostiles().length === 0 && !this.seqBusy && this.channelFree() && this.ctx.state === 'playing'));
    if (this.f.door) return;
    await this.say('l5_kes_brekke', { pri: 'scene', now: true });
  }
  /** A Kessler line that waits for the radio to be free (queued behind a sequence, S7), within `ttl` s. */
  private async kesLater(id: string, ttl = 60, opts: { at?: number } = {}): Promise<boolean> {
    const t0 = this.now;
    const ok = await this.untilOr(() => this.now >= (opts.at ?? 0) && !this.seqBusy && this.channelFree() && this.ctx.state === 'playing', ttl);
    if (!ok || this.ended || (this.now - t0 >= ttl)) return false;
    return this.say(id, { pri: 'scene', now: true });
  }

  /** Q (§4.6, §8.6): the ack, then the context line. Live from the power cue; cooldown 5 s. */
  radioAsk(): boolean {
    // (during the neck check Q is Kessler's facing line — the door sequence otherwise holds the radio)
    if (!this.f.powered || this.ended || this.keypadOpen || this.noteOpen || (this.seqBusy && !this.checkStage) || this.ctx.state !== 'playing') return false;
    if (this.now - this.lastQ < 5) return false;
    this.lastQ = this.now;
    this.S('q', async () => {
      const ok = await this.say('l5_kes_ack', { pri: 'scene', now: true, gap: 0.3 });
      if (!ok || this.ended) return;
      if (this.hostileWithin(25)) { await this.say('l5_kes_busy', { pri: 'scene' }); return; }
      const p = this.phase;
      let id: string | null = null;
      if (this.doorCheck.started && !this.doorCheck.done) id = this.facing() === 'door' ? 'l5_kes_door_3' : 'l5_kes_door_hold';
      else if (p === 'K') id = 'l5_kes_4';
      else if (p === 'S' || p === 'S_dive') id = 'l5_kes_hint_door';
      else if (p === 'V' || p === 'V_lock') id = 'l5_kes_hint_wheel';
      else if (p === 'W' || p === 'W_lock') id = 'l5_kes_hint_tunnel';
      if (id) await this.say(id, { pri: 'scene' });
    });
    return true;
  }

  // ── §4.5 the keypad (K → S) ──

  private async openKeypad(code?: string): Promise<string> {
    if (!this.f.powered) { this.sfx('keypad_dead', this.mk('mk5_keypad'), 0.7); return 'dead'; }
    if (this.f.keypad) return 'open';
    if (this.keypadOpen) return 'busy';
    this.keypadOpen = true;
    const pl = this.ctx.player;
    pl.controlsEnabled = false;
    this.screen('key5_panel', 'keypad', SCREEN5.keyTyping(0));
    if (code !== undefined) (this.ctx.debug as { keypadInput: string | null }).keypadInput = code;
    let r: string | null = null;
    try { r = await this.ctx.ui.keypad({ digits: 4, title: '스파인 — 인가된 출입' }); } catch (e) { console.warn('[story] keypad failed', e); }
    this.keypadOpen = false;
    if (this.ctx.state === 'playing' && pl.alive) pl.controlsEnabled = true;
    if (r === null || r === undefined) { if (!this.f.keypad) this.screen('key5_panel', 'keypad', SCREEN5.keyReady); return 'closed'; }
    if (r === '4719') { this.accept(); return 'accepted'; }
    this.wrongCode();
    return 'wrong';
  }
  private accept(): void {
    if (this.f.keypad) return;
    this.sfx('keypad_ok', this.mk('mk5_keypad'), 0.7);
    this.screen('key5_panel', 'keypad', SCREEN5.keyAccepted);
    this.acceptedAt = this.now;
    if (!this.f.powered) this.powerCue();
    this.beat('l5_keypad');
    this.S('key_open', async () => { await this.hold(1.2); this.screen('key5_panel', 'keypad', SCREEN5.keyOpen); });
    // CHOIR on the channel, ≤ 2 s after (C, once) — never over Kessler's sequence (it would delay her cues)
    this.S('choir_key', async () => {
      await this.hold(0.3);
      const ok = await this.untilOr(() => !this.seqBusy && this.channelFree(), 0.9);
      if (this.seqBusy) return;
      // (IA-5: a loose Kessler line on the channel — `_brekke`, an ack, a hint — no longer drops CHOIR's: it cuts in
      // over him, as it does on `_6`; the rule is ≤ 2 s after the acceptance)
      if (!ok) { this.talk.cut(); await this.hold(0.15); }
      await this.say('l5_choir_key', { pri: 'scene', now: true });
    });
  }
  private wrongCode(): void {
    this.sfx('keypad_err', this.mk('mk5_keypad'), 0.7);
    this.screen('key5_panel', 'keypad', SCREEN5.keyRejected);
    this.prog.codeWrong = (this.prog.codeWrong ?? 0) + 1;
    if (this.prog.codeWrong === 1) this.toast(TOAST5.qCode);
  }
  /** H10: type `code` into the keypad (opens it when the player is at the panel) and press ENT. */
  keypad(code: string): Promise<string> | string {
    if (!this.f.powered) { this.sfx('keypad_dead', this.mk('mk5_keypad'), 0.7); return 'dead'; }
    if (this.distTo(this.mk('mk5_keypad')) > 2.6) return 'far';
    if (this.keypadOpen) {
      try { this.ctx.ui.closeKeypad(); } catch { /* ignore */ }
      return new Promise((resolve) => {
        this.S('kp_reopen', async () => { await this.until(() => !this.keypadOpen); resolve(await this.openKeypad(code)); });
      });
    }
    return this.openKeypad(code);
  }

  // ── §4.6 Post 4 (S): the spine wave ──

  private async spineThread(): Promise<void> {
    await this.until(() => this.f.keypad);
    if (this.f.spineWave) return;
    await this.until(() => this.f.spineWave || this.forced.has('spine_wave') || (this.ctx.state === 'playing'
      && (this.inTrig('t5_spine_mid') || this.inSFor >= 45 || this.inTrig('t5_bay') || this.inTrig('t5_cmd'))));
    await this.spineWave();
  }
  private async spineWave(): Promise<void> {
    if (this.f.spineWave) return;
    this.beat('l5_spine_wave');
    this.spawn('g5_spine', true);                         // in the sealed dive locker
    this.S('out_g5_spine', () => this.fightOut('g5_spine', 60));
    this.S('contact', () => this.kesLater('l5_kes_contact', 40));
    await this.hold(0.4);
    this.set('diveOpen', true);                           // S_dive: d5_dive opens
    this.rush('g5_spine', 30);                            // (husks; soldiers never rush)
    const t0 = this.now;
    await this.until(() => this.now - t0 >= 10 || this.members('g5_spine').every((e) => e.position.x < 45.6));
    for (;;) {
      const ok = await this.closeBehind('d5_dive', () => this.pos.x < 45.6);
      if (ok) break;
      await this.hold(2);
    }
    this.set('diveOpen', false);
  }

  // ── §4.7 Kessler's door (S → V), interactive ──

  private async doorBeat(): Promise<void> {
    await this.until(() => this.f.keypad);
    if (this.f.verified) return;
    if (!this.f.door) {
      for (;;) {
        await this.until(() => this.forced.has('door') || ((this.phase === 'S' || this.phase === 'S_dive') && this.inTrig('t5_cmd') && this.ctx.state === 'playing'));
        if (this.forced.has('door')) break;
        if (!this.f.spineWave) { void this.spineWave(); }
        // (one radio: a pickup sequence still running after a load finishes first)
        if (this.fought('g5_spine', 1.0) && this.doorCalm() && !this.seqBusy) break;
        // not calm: Kessler waits (cooldown 20 s); a holding soldier at the door is released (he is fought there);
        // the beat starts on the next door-calm frame in t5_cmd — leaving re-arms it on the next entry
        void this.kesLater('l5_kes_door_wait', 3);
        let go = false;
        await this.until(() => {
          this.releaseBlockers();
          go = this.forced.has('door') || (this.fought('g5_spine', 1.0) && this.doorCalm() && !this.seqBusy && this.inTrig('t5_cmd'));
          return go || !this.inTrig('t5_cmd');
        });
        if (go) break;
      }
      this.once('door');
    }
    await this.doorSequence();
  }
  /** Door-calm blocked by a soldier still in hold near the door: release his group (it is fought, not waited out). */
  private releaseBlockers(): void {
    const line = this.trigCentre('t5_cmd_line', 0);
    for (const e of this.members('g5_patrol')) {
      if (!this.isHolding(e)) continue;
      if (this.roomOf(e.position) === 'spine5' || this.pathLen(e.position, line) <= 30) this.releasePatrol();
    }
  }

  private async doorSequence(): Promise<void> {
    const dc = this.doorCheck;
    dc.started = true;
    this.seqBusy = true;
    this.stamp('door_start');
    try {
      // the line pulses; the door camera watches (tally amber)
      this.call('door5_cmd', 'pulse', true); this.stamp('vignette:cmd5_line');
      if (!this.api('door5_cmd')?.pulse) this.w.vignette('cmd5_line');
      this.call('door5_cmd', 'tally', 'amber');
      this.call('door5_cmd', 'watch', this.ctx.player.eye.clone());
      // (a dropped line never ends the beat: the check, V and lights-out must always follow)
      let end = await this.seqLine('l5_kes_door_1', this.now);
      if (end === false) end = this.now;
      end = await this.seqLine('l5_kes_door_2', end + 0.5);
      if (end === false) end = this.now;
      // the check (B3)
      await this.until(() => this.forced.has('verify') || (this.now >= (end as number) + 0.6 && this.inTrig('t5_cmd_line', 0.3)) || this.ended);
      if (this.ended) return;
      const firstAt = this.now;
      this.checkStage = true;
      if (!this.forced.has('verify')) void this.say('l5_kes_door_3', { pri: 'scene', now: true, gap: 0.05, cue: this.now });
      let count = 0, last = this.now, counting = false, wasOn = true, nextNag = firstAt + 8;
      await this.until(() => {
        const dt = Math.min(0.1, this.now - last); last = this.now;
        if (this.forced.has('verify')) return true;
        if (this.ctx.state !== 'playing') return false;
        this.call('door5_cmd', 'watch', this.ctx.player.eye.clone());
        const on = this.inTrig('t5_cmd_line', 0.3);
        const ok = on && this.facing() === 'away';
        if (ok) {
          if (!counting) { counting = true; this.call('door5_cmd', 'tally', 'white'); this.portLook(true); }
          count += dt;
        } else if (counting || count > 0) {
          counting = false; count = 0;
          this.call('door5_cmd', 'tally', 'amber'); this.portLook(false);
        }
        dc.check = Math.min(1, count / CHECK_S);
        if (wasOn && !on && this.channelFree()) void this.say('l5_kes_door_away', { pri: 'scene', now: true, gap: 0.05 });
        wasOn = on;
        if (!counting && this.now >= nextNag && this.channelFree()) {
          nextNag = this.now + 8;
          void this.say(this.facing() === 'door' ? 'l5_kes_door_3b' : 'l5_kes_door_hold', { pri: 'scene', now: true, gap: 0.05 });
        }
        return count >= CHECK_S;
      });
      dc.check = 1;
      dc.done = true;
      this.checkStage = false;
      this.stamp('check_done');
      this.portLook(false);
      this.call('door5_cmd', 'tally', 'white');
      this.call('door5_cmd', 'pulse', false);
      // (a nag still speaking is cut: "Clean." starts now)
      const sp = this.talk.speaking;
      if (sp && /^l5_kes_door_(3|3b|hold|away)$/.test(sp)) this.talk.cut();
      // check done: "Clean." — fact l5_door, beat l5_verified (with the line's start)
      this.beat('l5_verified');
      end = await this.seqLine('l5_kes_door_4', this.now + (this.channelFree() ? 0 : 0.16));
      if (end === false) end = this.now;
      for (const [id, gap] of DOOR_AFTER) {
        end = await this.seqLine(id, (end as number) + gap, id === 'l5_kes_door_7' ? () => this.verifiedNow() : undefined);
        if (end === false) end = this.now;
      }
      this.verifiedNow();
      const cid = this.choiceId('l5_choir_door');
      end = await this.seqLine(cid, (end as number) + 0.4);
      if (end === false) end = this.now;
      await this.until(() => this.now >= (end as number) + 0.3);
      this.lightsOut();
    } finally {
      this.seqBusy = false;
    }
    // L + 1.0: Kessler; L + 1.5: cp5_door (V, dark, nothing hostile yet)
    const L = this.lightsAt;
    this.S('kes_dark', async () => { await this.seqLine('l5_kes_dark', L + 1.0); });
    await this.until(() => this.now >= L + 1.5);
    this.checkpointNow('cp5_door');
  }
  /** The port silhouette (cmd5_port_look): W7's door API, else the level's toggle vignette. */
  private portLook(on: boolean): void {
    if (on) this.stamp('vignette:cmd5_port_look');
    if (!this.call('door5_cmd', 'look', on) && on) this.w.vignette('cmd5_port_look');
  }
  /** `l5_kes_door_7` starts: phase V — the tunnel cycling (hydraulics isolated), the wheel's objective. */
  private verifiedNow(): void {
    if (this.f.verified) return;
    this.once('verified');
    this.stamp('verified');
    this.screen('tunnel_panel', 'terminal_idle', SCREEN5.tunnelRelease);
    // §9 #21: the boards say COMPLETE after V anyway (the set-up holds)
    this.screen('tern_board', 'dock_status', SCREEN5.ternDone);
    this.screen('launch', 'launch', SCREEN5.launchComplete);
  }
  /** L: CHOIR's answer — lights-out (spine + sub bay mains), the dark regions, the beacons; ambience dark. */
  private lightsOut(): void {
    if (this.f.dark) return;
    if (!this.f.verified) this.verifiedNow();
    if (!this.f.checked) this.beat('l5_verified');
    this.beat('l5_dark');
    this.lightsAt = this.now;
    this.vig('lights_out5');
    this.vig('dark5_on');
    this.call('door5_cmd', 'lineGlow', 1);
    this.director.setMood('tension');
  }

  // ── L + 3.0: g5_cmd (vent skitters + one soldier through the launch-lock access) ──

  private async cmdThread(): Promise<void> {
    await this.until(() => this.f.dark);
    if (this.f.cmdWave) return;
    const at = this.restoredFrom && this.lightsAt <= this.now - 1.4 ? this.now + 1.5 : this.lightsAt + 3.0;
    await this.until(() => this.now >= at || this.forced.has('cmd_wave'));
    await this.cmdWave();
  }
  private async cmdWave(): Promise<void> {
    if (this.f.cmdWave) return;
    const vent = this.mk('mk5_vent_spine');
    if (this.distTo(vent) < 4) await this.untilOr(() => this.distTo(vent) >= 4, 4);
    this.vig('vent5_spine');
    await this.hold(0.4);
    this.once('cmd_wave');
    this.spawn('g5_cmd', true);
    this.S('out_g5_cmd', () => this.fightOut('g5_cmd', 60));
    this.openLock('g5_cmd');
    this.rush('g5_cmd', 30);
  }
  /** `d5_lockside` held open for a wave (V_lock / W_lock), latched behind it (last member z > −55.6, or 10 s). */
  private openLock(group: string): void {
    this.lockGroups.add(group);
    this.set('lockOpen', true);
    const t0 = this.now;
    if (this.lockLatchRunning) return;
    this.lockLatchRunning = true;
    this.S('lock_latch', async () => {
      try {
        await this.hold(0.6);
        await this.until(() => this.now - t0 >= 10 || [...this.lockGroups].every((g) => this.members(g).every((e) => e.position.z > -55.6)));
        for (;;) {
          const ok = await this.closeBehind('d5_lockside', () => this.pos.z > -55.6);
          if (ok) break;
          await this.hold(2);
        }
        this.set('lockOpen', false);
      } finally { this.lockLatchRunning = false; }
    });
  }

  // ── §4.8 the sub bay in the dark (V → W → X) ──

  private async bayThread(): Promise<void> {
    await this.until(() => this.f.verified);
    if (this.f.bayA) return;
    await this.until(() => this.forced.has('bay_a') || (this.ctx.state === 'playing' && this.f.verified && (this.inTrig('t5_bay')
      // (or g5_cmd's soldier reaches the sub bay's north half — north of the bridge — while the player is there)
      || (this.inRoom('sub5') && this.members('g5_cmd').some((e) => e.type === 'soldier' && this.roomOf(e.position) === 'sub5' && e.position.z > this.mk('mk5_launch').z)))));
    await this.bayA();
  }
  private async bayA(): Promise<void> {
    if (this.f.bayA) return;
    this.beat('l5_bay');
    this.spawn('g5_bay_a', true);                         // in the sealed launch-lock access
    this.S('out_g5_bay_a', () => this.fightOut('g5_bay_a', 60));
    this.S('kes_bay', () => this.kesLater('l5_kes_bay', 20));
    await this.hold(0.4);
    this.openLock('g5_bay_a');
    this.rush('g5_bay_a', 30);
  }

  /** `wheel5` (V, from the west gallery): 4.0 s fixed clock; g5_bay_b; the tunnel door released at + 4.0 (W). */
  private async wheel(): Promise<void> {
    if (this.f.wheel || !this.f.verified) return;
    this.beat('l5_wheel');
    const t0 = this.now;
    this.wheelStartedAt = +t0.toFixed(3);
    this.w.setInteractable('wheel5', false);
    this.vig('wheel5_turn');
    this.S('bay_b', () => this.bayB(t0));
    await this.until(() => this.now >= t0 + 4.0);
    this.wheelDoneAt = +this.now.toFixed(3);
    this.once('released');
    this.screen('tunnel_panel', 'terminal_idle', SCREEN5.tunnelOpen);
    const panel = this.atDoor('d5_tunnel');
    let uEnd = this.now + lineDuration('l5_unit_wheel');
    void this.unit('l5_unit_wheel', panel, (d) => { uEnd = this.now + d; });
    this.S('kes_tunnel', async () => { await this.until(() => this.now >= uEnd + 0.4); await this.kesLater('l5_kes_tunnel', 10); });
  }
  private async bayB(t0: number): Promise<void> {
    if (this.prog.triggered.includes('g5_bay_b')) return;
    await this.until(() => this.now >= t0 + 0.5);
    this.spawnedGroups.add('g5_bay_b');
    this.engage('g5_bay_b', 'wake');                     // the dock sentry wakes
    await this.until(() => this.now >= t0 + 1.0);
    this.vig('drain5_a'); this.vig('drain5_b');
    await this.until(() => this.now >= t0 + 1.4);
    this.w.spawnGroup('g5_bay_b');                       // the drain skitters + the husk in the sealed lock access
    await this.until(() => this.now >= t0 + 1.5);
    this.openLock('g5_bay_b');
    this.rush('g5_bay_b', 30);
    this.S('out_g5_bay_b', () => this.fightOut('g5_bay_b', 60));
  }

  private async tunnelThread(): Promise<void> {
    await this.until(() => this.f.released);
    while (!this.f.tunnel) {
      await this.until(() => this.forced.has('tunnel') || ((this.phase === 'W' || this.phase === 'W_lock') && this.inTrig('t5_tunnel') && this.pos.x < 20.8 && this.ctx.state === 'playing')); // (past the doorway: the trigger starts inside it, so a latch tried there always failed)
      const forced = this.forced.has('tunnel');
      const ok = forced || await this.latch('d5_tunnel', () => this.pos.x < 21.6, 1.0, 1.0, 1.8);
      if (ok) { this.beat('l5_tunnel'); break; }
      await this.until(() => !this.inTrig('t5_tunnel') || this.pos.x < 20.8 || this.forced.has('tunnel'));
    }
    // X: the end waits only for hostiles INSIDE the tunnel (stranded: unseen 60 s → removed)
    await this.fightOutWhere('tunnel5', 60);
    // + 0.6 Kessler; her end + 0.5 CHOIR; CHOIR's end + 0.8 the end (each line on its cue)
    const kEnd = await this.seqLine('l5_kes_end', this.now + 0.6);
    const cStart = (kEnd === false ? this.now : kEnd) + 0.5;
    const cEnd = await this.seqLine(this.choiceId('l5_choir_end'), cStart);
    await this.until(() => this.now >= Math.min((cEnd === false ? this.now : cEnd) + 0.8, cStart + 6.5));
    this.beat('l5_end');
    await this.hooks.end();
  }

  // ───────────────────────────────────────────────────────────── the crawl, the patrol, the magazine

  private async bootsThread(): Promise<void> {
    await this.until(() => this.f.keypad);
    if (this.f.boots || this.prog.scares.includes('v5_boots')) return;
    for (;;) {
      await this.until(() => this.forced.has('boots') || this.inTrig('t5_crawl_e'));
      const t0 = this.now;
      let go = false;
      // first t5_crawl_e + 2.0 s, the player still in the crawl, calm, no soldier alive within 40 m; leaving re-arms it
      await this.until(() => {
        if (this.forced.has('boots')) return (go = true);
        if (this.now - t0 < 2.0) return false;
        if (!this.region3('crawl')) return true;
        const soldierNear = this.ctx.enemies.all.some((e) => e.alive && e.type === 'soldier' && e.position.distanceTo(this.pos) <= 40);
        return (go = !soldierNear && this.scareOk('v5_boots'));
      });
      if (go) break;
    }
    this.fireScare('v5_boots');
    this.once('boots');
    this.spawn('g5_patrol', false);
    this.S('patrol', () => this.patrolWalk());
  }
  /** §5.5 #8: in from the sub bay, weapon light on, west along the grating, stop ahead of the player, east to its end. */
  private async patrolWalk(): Promise<void> {
    await this.hold(0.1);
    const e = this.members('g5_patrol')[0];
    if (!e) return;
    const s = this.soldierObj(e.id);
    if (!s?.holdWalkTo) return;
    const walk = (p: THREE.Vector3, light: boolean) => this.isHolding(e) ? s.holdWalkTo!.call(s, p, 1.3, light) : Promise.resolve();
    const bay = this.door('d5_bay');
    const stopZ = this.mk('mk5_boots_stop').z;
    const inSpine = bay ? V(bay.position.x, 0, stopZ) : this.mk('mk5_boots_stop');
    await walk(inSpine, true);
    const x = THREE.MathUtils.clamp(this.pos.x + 1, 18, 34);
    await walk(V(x, 0, stopZ), true);
    await this.hold(3.5);
    await walk(this.mk('mk5_patrol_end'), true);
    if (this.isHolding(e)) await walk(this.mk('mk5_patrol_end'), false);
  }
  private releasePatrol(): void {
    if (this.f.patrolFree) return;
    try { this.ctx.enemies.release('g5_patrol'); } catch { /* ignore */ }
    this.once('patrol_free');
    this.markTriggered('g5_patrol');
    this.S('out_g5_patrol', () => this.fightOut('g5_patrol', 60));
  }
  /** He leaves hold the moment he has sight of the player out of the crawl (§5.5 #8). */
  private patrolRules(): void {
    if (this.f.patrolFree || !this.f.boots || this.below()) return;
    for (const r of this.soldierRows()) {
      if (r.group !== 'g5_patrol' || !r.holding) continue;
      const sees = typeof r.sees === 'boolean' ? r.sees : false;
      if (sees) this.releasePatrol();
    }
  }

  /** Dormant units that woke by themselves (a shot, damage): recorded, so the calm rule waits for them. */
  private selfWaking(): void {
    if (!this.prog.triggered.includes('g5_mag') && this.members('g5_mag').some((e) => e.state !== 'dormant')) {
      if (!this.f.magAwake) this.magWake(true);
    }
  }
  /** §5.1 g5_mag: within 2.2 m; a p5_mag_* taken; a shot within 10 m; the flashlight on its head 1.5 s; 25 s in t5_mag. */
  private magRules(step: number): void {
    if (this.f.magAwake) return;
    const m = this.members('g5_mag')[0];
    if (!m) return;
    if (this.inTrig('t5_mag')) this.magTime += step;
    const head = m.position.clone().setY(m.position.y + 0.9);
    this.magBeam = this.ctx.player.flashlightOn && this.isLookingAt(head, 10, true) && this.distTo(head) <= 14 ? this.magBeam + step : 0;
    const shot = !!this.lastShotFrom && this.now - this.lastShotAt < 0.3 && this.lastShotFrom.distanceTo(m.position) <= 10;
    if (this.pos.distanceTo(m.position) <= 2.2 || this.magTouched || shot || this.magBeam >= 1.5 || this.magTime >= 25) this.magWake(false);
  }
  /** v5_magazine (the wake's own tell, exempt from spacing): the lamp pops; 0.8 s later he sits up. */
  private magWake(already: boolean): void {
    if (this.f.magAwake) return;
    this.once('mag');
    this.fireScare('v5_magazine');
    this.markTriggered('g5_mag');
    this.S('mag_wake', async () => {
      if (!already) await this.hold(0.8);
      this.engage('g5_mag', 'wake');
      await this.fightOut('g5_mag', 60);
    });
  }

  // ───────────────────────────────────────────────────────────── scares (§5.5)

  /** "Calm" for a scare: no awake hostile within 30 m, no shot by anyone within 4 s, playing, no note. */
  private scareCalm(allowKessler: boolean): boolean {
    if (this.ctx.state !== 'playing' || this.noteOpen || this.keypadOpen) return false;
    if (this.hostileWithin(30)) return false;
    if (this.now - this.lastShotAt < 4 || this.now - this.lastEnemyShot < 4) return false;
    if (!allowKessler) {
      const sp = this.talk.speaking;
      if (this.seqBusy || (sp && line5(sp)?.speaker === 'kessler')) return false;
    }
    return true;
  }
  /** §5.5 common rule: once, calm, spacing (45 s / loud 90 s; `v5_magazine` exempt), never in a doorway. */
  private scareOk(id: string, allowKessler = false): boolean {
    if (this.prog.scares.includes(id)) return false;
    if (!this.scareCalm(allowKessler)) return false;
    if (!EXEMPT5.has(id)) {
      if (this.now - this.lastScare < 45) return false;
      if (LOUD5.has(id) && this.now - this.lastLoud < 90) return false;
    }
    return !this.inDoorway();
  }
  private fireScare(id: string): void {
    if (this.prog.scares.includes(id)) return;
    this.prog.scares.push(id);
    this.scareLog.push({ id, t: +this.now.toFixed(2), room: this.w.room() });
    if (!EXEMPT5.has(id)) {
      this.lastScare = this.now;
      if (LOUD5.has(id)) this.lastLoud = this.now;
    }
    // (v5_boots: the vignette is the patrol itself — the story drives it; the level's id is fired for its own state)
    this.vig(id);
  }
  private inFor(room: string): number { const t = this.roomSince.get(room); return t === undefined ? 0 : this.now - t; }

  private scareRules(step: number): void {
    const f = this.f;
    const has = (id: string) => this.prog.scares.includes(id);
    // 1 the turnstile (gatehouse, any phase from B)
    if (!has('v5_turnstile') && this.atLeast('B') && this.inTrig('t5_turnstile') && this.scareOk('v5_turnstile')) this.fireScare('v5_turnstile');
    // 2 the hull groan: g5_s1 dead, ≥ 4 s calm (Kessler allowed), 3 … 9 m from the ajar locker, it within 70° of view
    if (!has('v5_hull_groan') && this.s1DiedAt > -1e8 && this.calmSince > -1e8 && this.now - this.calmSince >= 4 && this.inRoom('ready5')) {
      const lk = this.mk('mk5_locker_slam').setY(1.0);
      const d = this.distTo(lk);
      if (d >= 3 && d <= 9 && this.isLookingAt(lk, 70) && this.scareOk('v5_hull_groan', true)) this.fireScare('v5_hull_groan');
    }
    // 3 the bunk radio: berths with the radio owned, ≥ 3 s inside
    if (!has('v5_bunk_radio') && f.radio && this.inFor('berths5') >= 3 && this.scareOk('v5_bunk_radio')) {
      this.fireScare('v5_bunk_radio');
      this.S('names', async () => {
        // the voice comes in on the set's own clock (quarters.ts publishes RADIO5 on the marker: voiceAt 0.9 s)
        const v5 = this.api('mk5_bunk_radio')?.v5 as { voiceAt?: number } | undefined;
        await this.hold(typeof v5?.voiceAt === 'number' ? v5.voiceAt : 0.9);
        let nEnd = this.now;
        const ok = await this.say('l5_choir_names', { pri: 'scene', now: true, gap: 0.1, cue: this.now, at: this.mk('mk5_bunk_radio'), onStart: (d) => { nEnd = this.now + d; } });
        if (ok || this.talk.heard.has('l5_choir_names')) await this.kesLater('l5_kes_names', 12, { at: nEnd + 1.0 });
      });
    }
    // 4 the trays: first entry into the mess past z −12.5
    if (!has('v5_trays') && this.inRoom('mess5') && this.pos.z > this.mk('mk5_trays').z - 10.0 && this.scareOk('v5_trays')) this.fireScare('v5_trays');
    // 5 the galley shape: the frosted window looked at (≤ 60°) for 0.5 s at 3 … 8 m
    if (!has('v5_galley_shape') && this.inRoom('galley5')) {
      const w = this.mk('mk5_oilskin');
      const d = this.distTo(w);
      this.galleyLook = d >= 3 && d <= 8 && this.isLookingAt(w, 60) ? this.galleyLook + step : 0;
      if (this.galleyLook >= 0.5 && this.scareOk('v5_galley_shape')) this.fireScare('v5_galley_shape');
    } else this.galleyLook = 0;
    // 6 the water: first entry into the washroom, ≥ 2 s inside
    if (!has('v5_water') && this.inFor('heads5') >= 2 && this.scareOk('v5_water')) this.fireScare('v5_water');
    // 7 the body that moved (silent)
    if (!has('v5_body')) this.bodyRule(step);
    // 10 the boat's pre-launch check: ≥ 3 s in the sub bay, phase ≥ S
    if (!has('v5_sub_check') && this.atLeast('S') && this.inFor('sub5') >= 3 && this.scareOk('v5_sub_check')) {
      this.fireScare('v5_sub_check');
      // the console mirrors the boat's check (W7 `tern.check()` runs 19.4 s; the board is the vignette's)
      this.screen('launch', 'launch', 'running|19');
      this.S('launch_done', async () => { await this.hold(19.4); this.screen('launch', 'launch', SCREEN5.launchComplete); });
      this.S('choir_sub', () => this.choirSub());
    }
    if (!this.choirSubAsked && !has('v5_sub_check') && this.atLeast('V') && this.boardSeen >= 2) this.S('choir_sub', () => this.choirSub());
  }
  private choirSubAsked = false;
  private boatAsked = false;
  private async choirSub(): Promise<void> {
    if (this.choirSubAsked) return;
    this.choirSubAsked = true;
    const id = this.choiceId('l5_choir_sub');
    // (IA-5: a line about the boat — said only while the player is still in the sub bay, never in the tunnel after
    // CHOIR's end line, which a 30 s wait for quiet otherwise allowed)
    const here = () => this.inRoom('sub5') && this.phase !== 'X';
    const ok = await this.untilOr(() => (this.facts.kesQuietFor >= 4 && this.channelFree() && this.ctx.state === 'playing') || !here(), 30);
    if (ok && here()) await this.say(id, { pri: 'scene', now: true });
  }
  /**
   * §5.5 #7: the body at mk5_body_a has been in view (≤ 10 m, 1 s); a living g5_spine member has been unseen ≥ 15 s; the
   * player has had no sight of either spot for ≥ 15 s and is ≥ 12 m from both — nothing is seen moving.
   */
  private bodyRule(step: number): void {
    const A = this.mk('mk5_body_a').setY(this.mk('mk5_body_a').y + 0.3), B = this.mk('mk5_body_b').setY(this.mk('mk5_body_b').y + 0.3);
    if (this.sees(A, 10, 50)) this.bodyASeen += step;
    const sight = this.sees(A, 60, 60) || this.sees(B, 60, 60);
    this.bodyUnseen = sight ? 0 : this.bodyUnseen + step;
    for (const e of this.members('g5_spine')) this.spineUnseen.set(e.id, this.inView(e, 60) ? 0 : (this.spineUnseen.get(e.id) ?? 0) + step);
    const carrier = this.members('g5_spine').some((e) => (this.spineUnseen.get(e.id) ?? 0) >= 15);
    // (user decision 2026-11-19: exempt from the calm rule — no hostile within 30 m, no recent shots — and from scare
    // spacing: nothing is seen or heard when it happens, and the living g5_spine member it needs usually hunts the player,
    // so under the common rule it fired in 1 run of 4; it still needs the playing state and no open note / keypad)
    const free = !this.prog.scares.includes('v5_body') && this.ctx.state === 'playing' && !this.noteOpen && !this.keypadOpen;
    if (this.bodyASeen >= 1 && carrier && this.bodyUnseen >= 15 && this.distTo(A) >= 12 && this.distTo(B) >= 12 && free) this.fireScare('v5_body');
  }

  // ───────────────────────────────────────────────────────────── barks (§6.2 soldier lines)

  private barkRules(): void {
    if (this.now - this.lastBark < 20 || this.seqBusy || !this.channelFree()) return;
    const sp = this.talk.speaking;
    if (sp && line5(sp)?.speaker === 'kessler') return;
    const rows = this.soldierRows();
    const all = this.ctx.enemies.all;
    let pick: { base: string; e: { id: number; position: THREE.Vector3 }; b: Bark5 } | null = null;
    for (const r of rows) {
      const e = all.find((x) => x.id === r.id);
      if (!e || !e.alive || r.holding) continue;
      const dist = this.distTo(e.position);
      const head = e.position.clone().setY(e.position.y + 1.6);
      const sees = typeof r.sees === 'boolean' ? r.sees : this.los(head);
      if (sees && !this.sawPlayer.has(e.id)) { this.sawPlayer.add(e.id); this.downDue.set(e.id, this.now + 3); }
      const hit = this.now - (this.hitAt.get(e.id) ?? -1e9) <= 3;
      const felt = this.soldierDeaths.some((d) => this.now - d.t <= 4 && d.p.distanceTo(e.position) <= 20);
      const b = { id: e.id, dist, sees, hitRecently: hit, felt };
      let base: string | null = null;
      if (hit && sees && dist <= 15) base = 'l5_sol_need';
      else if (felt && sees && dist <= 15) base = 'l5_sol_felt';
      else if (sees && dist <= 25 && this.facts.darkWithLight) base = 'l5_sol_light';
      else if (sees && dist <= 15 && this.facts.wastingRounds) base = 'l5_sol_rounds';
      else if (sees && dist <= 15 && (this.downDue.get(e.id) ?? -1e9) >= this.now) base = 'l5_sol_down';
      if (base) { pick = { base, e, b }; break; }
    }
    if (!pick) return;
    const id = this.choiceId(pick.base);
    this.bark = pick.b;
    const at = () => { const x = all.find((q) => q.id === pick!.e.id); return x ? x.position.clone().setY(x.position.y + 1.6) : null; };
    void this.say(id, { pri: 'bark', cooldown: 20, at, onStart: () => { this.lastBark = this.now; this.downDue.delete(pick!.e.id); } });
  }

  // ───────────────────────────────────────────────────────────── reactions

  private onInteract(id: string): void {
    if (!this.started || this.ended || this.ctx.debug.noStory) return;
    const f = this.f;
    // (key5_duty: R8 — the level's eye gate already refuses it from the spine side)
    if (id === 'key5_duty') { void this.openKeypad(); return; }
    if (id === 'radio5') { if (this.radioReady && !f.radio) this.takeRadio(); return; }
    if (id === 'hatch5_spine') {
      if (!f.keypad || f.hatchSpine) return;
      this.vig('hatch5_spine_open');
      this.once('hatch_spine');
      this.w.setInteractable('hatch5_spine', false);
      return;
    }
    if (id === 'hatch5_mag') {
      if (f.hatchMag || this.ctx.player.eye.y >= -0.2) return;
      this.vig('hatch5_mag_open');
      this.once('hatch_mag');
      this.w.setInteractable('hatch5_mag', false);
      return;
    }
    if (id === 'wheel5') { if (f.verified && !f.wheel) this.S('wheel', () => this.wheel()); return; }
    if (id === 'launch5_palm') { if (f.keypad) this.S('palm', () => this.palm()); return; }
    const frag = FRAGMENTS5[id];
    if (!frag) return;
    const room = READ_ROOM5[id];
    if (room && !this.inRoom(room)) return;
    this.openNote(id, frag);
  }

  /** §4.6: the launch palm — 1.6 s on the plate, refused at the end (`NOT ROSTERED — REYES, S.`); fact l5_boat. */
  private async palm(): Promise<void> {
    if (this.palmBusy) return;
    this.palmBusy = true;
    try {
      let r: PalmResult = 'refused';
      const plate = this.palmPlate();
      try { if (plate) r = await this.ctx.player.palm(plate, 1.6); } catch { r = 'refused'; }
      // (a press out of the plate's 1.0 m reach is refused at once by the player module: the plate refuses the same)
      if (r === 'cancelled') return;
      this.screen('launch5_palm', 'palm', SCREEN5.palmRefused);
      this.sfx('badge_deny', this.mk('mk5_launch').setY(this.mk('mk5_launch').y + 1.2), 0.6);
      void this.unit('l5_unit_launch_refused', this.mk('mk5_launch').setY(this.mk('mk5_launch').y + 1.2));
      this.once('boat');
      this.S('kes_boat', () => this.kesLater('l5_kes_boat', 20));
    } finally { this.palmBusy = false; }
  }
  private palmPlate(): PalmPlate | null {
    const c = this.api('launch5_console');
    const pp = c?.palmPoint as THREE.Vector3 | undefined, pn = c?.palmNormal as THREE.Vector3 | undefined;
    if (pp && pn) return { position: pp.clone(), normal: pn.clone(), up: V(0, 1, 0).sub(pn.clone().multiplyScalar(pn.y)).normalize() };
    const it = this.ctx.interactables.get('launch5_palm');
    if (!it) return null;
    const n = this.pos.clone().sub(it.position).setY(0);
    if (n.lengthSq() < 1e-6) n.set(0, 0, -1);
    return { position: it.position.clone(), normal: n.normalize(), up: V(0, 1, 0) };
  }

  private onDenied(id: string): void {
    if (!this.started || !this.live) return;
    if (id !== 'd5_tunnel') return;
    const p = this.phase;
    if (p === 'S' || p === 'S_dive') void this.unit('l5_unit_tunnel_co', this.atDoor(id));
    else if (p === 'V' || p === 'V_lock') void this.unit('l5_unit_tunnel_hyd', this.atDoor(id));
  }

  private onPickup(kind: string, p: THREE.Vector3): void {
    if (!this.started) return;
    if (p && (this.region3('magazine', p) || (p.y < -1.0 && this.roomOf(p) === 'arm5'))) this.magTouched = true;
    if (kind === 'vest') this.toast(TOAST5.vest);
    if (kind === 'plate') this.toast(TOAST5.plate);
  }

  /** A player bullet on Kessler's door / port / camera: sparks, stars — and once, a line. */
  private onImpact(p: THREE.Vector3): void {
    if (!this.started) return;
    const port = this.mk('mk5_port');
    if (Math.hypot(p.x - port.x, p.z - port.z) <= 2.0 && p.y < 3.2 && Math.abs(p.y - port.y) < 2.0 && this.now - this.lastShotAt < 0.5) {
      this.doorShotAt = this.now;
      if (this.f.radio && !this.talk.heard.has('l5_kes_shot')) this.S('kes_shot', () => this.kesLater('l5_kes_shot', 6));
    }
  }

  /** Every frame: the crouch toast at the pit landing (standing). */
  protected override afterObjective(): void {
    if (!this.live || this.ctx.state !== 'playing') return;
    const pl = this.ctx.player;
    if (this.inTrig('t5_landing') && pl.eye.y - pl.position.y > 1.3) this.toast(TOAST5.crouch, 8);
  }

  /** `?nostory=1` (§3): the level's nostory phase; screens as at load. */
  openEverything(): void {
    this.baseline();
    applyPhase5(this.ctx, 'nostory', { snap: true });
  }

  // ───────────────────────────────────────────────────────────── review / debug (H3, H7, H13)

  /** H3: force a gate or a beat with its real consequences; a vignette id (and `id:snap`) is fired as is. */
  fire(name: string): unknown {
    const f = this.f;
    const go = (n: string, fn: () => Promise<unknown> | void) => { this.S('fire_' + n, async () => { await fn(); }); return n; };
    switch (name) {
      case 'gate': if (!f.gateOpen) return null; this.forced.add('gate'); return 'gate';
      case 'scene': if (this.phase !== 'B2') return null; this.forced.add('scene'); return 'scene';
      case 'units': if (!f.scene) return null; this.forced.add('units'); return 'units';
      case 'release_s1': if (!f.scene || this.w.alive('g5_s1') === 0) return null; this.releaseS1('fire'); return 'release_s1';
      case 'radio': if (f.radio || !f.scene) return null; this.radioReady = true; this.takeRadio(); return 'radio';
      case 'power': if (!f.radio) this.takeRadio(); this.powerCue(); return 'power';
      case 'code': if (!f.powered) return null; this.accept(); return 'code';
      case 'spine_wave': if (!f.keypad) return null; return go('spine_wave', () => this.spineWave());
      case 'boots': if (!f.keypad) return null; this.forced.add('boots'); return 'boots';
      case 'door': if (!f.keypad) return null; this.forced.add('door'); return 'door';
      case 'verify': if (!this.doorCheck.started) return null; this.forced.add('verify'); return 'verify';
      case 'dark': if (!f.keypad) return null; this.lightsOut(); return 'dark';
      case 'cmd_wave': if (!f.dark) return null; this.forced.add('cmd_wave'); return go('cmd_wave', () => this.cmdWave());
      case 'bay_a': if (!f.verified) return null; return go('bay_a', () => this.bayA());
      case 'wheel': if (!f.verified) return null; return go('wheel', () => this.wheel());
      case 'bay_b': if (!f.verified) return null; return go('bay_b', () => this.bayB(this.now - 0.5));
      case 'tunnel': if (!f.released) return null; this.forced.add('tunnel'); return 'tunnel';
      default: {
        const base = name.replace(/:snap$/, '');
        const list = (this.ctx.level as unknown as { list?: () => { vignettes: string[] } }).list?.().vignettes ?? null;
        if (list && !list.includes(base)) return null;
        if (!list && !/^(v5_|hatch5_|gate5_|lights_out5|dark5_on|key5_power|wheel5_turn|drain5_|cmd5_|vent5_)/.test(base)) return null;
        if (!this.w.vignette(name)) return null;
        if (!name.endsWith(':snap')) this.stamp(`vignette:${name}`);
        return name;
      }
    }
  }

  /** H13: the world as `--checkpoints` compares it before a death and after the load. */
  worldState(): Record<string, unknown> {
    const doors: Record<string, { open: boolean; locked: boolean; status: string | null }> = {};
    try {
      for (const d of this.ctx.level.doors) doors[d.id] = { open: d.isOpen, locked: d.locked, status: ((d as unknown as { status?: string | null }).status ?? null) };
    } catch { /* ignore */ }
    const k = (n: string) => { const v = this.api(n)?.k; return typeof v === 'number' ? v >= 0.5 : false; };
    const screens: Record<string, string> = {};
    for (const id of ['gate_panel5', 'gate_log', 'aas_palm', 'onpost', 'dock_status', 'key5_panel', 'launch', 'launch5_palm', 'tern_board', 'tunnel_panel', 'cmd_panel']) screens[id] = this.screenText(id === 'cmd_panel' && this.ctx.level.screen('door5_cmd_panel') ? 'door5_cmd_panel' : id);
    let pickups: string[] = [];
    try { pickups = [...(this.ctx.player.snapshot().pickups ?? [])].filter((p) => p.startsWith('p5_')).sort(); } catch { /* ignore */ }
    return {
      doors, hatches: { spine: k('hatch5_spine'), mag: k('hatch5_mag') }, lightsOut: this.f.dark, dark: this.darkRooms(), screens, pickups,
      groups: this.groupsState(), scares: [...this.prog.scares], flags: { ...this.f },
      torch: typeof this.ctx.player.flashlightCharge === 'number' ? +this.ctx.player.flashlightCharge.toFixed(3) : 1,
    };
  }
  /** Room ids covered by `regions.dark` (the soldiers' dark rule, D18). */
  private darkRooms(): string[] {
    const out: string[] = [];
    try {
      const boxes = this.ctx.level.regions?.dark ?? [];
      for (const r of this.ctx.level.rooms) {
        const c = r.bounds.getCenter(new THREE.Vector3());
        c.y = r.bounds.max.y - 1.5;
        const size = r.bounds.getSize(new THREE.Vector3());
        if (boxes.some((b) => b.containsPoint(c) && (b.max.x - b.min.x) >= size.x * 0.9 && (b.max.z - b.min.z) >= size.z * 0.9)) out.push(r.id);
      }
    } catch { /* ignore */ }
    return out.sort();
  }
  private groupsState(): Record<string, { spawned: boolean; alive: number; awake: number; holding: number; triggered: boolean }> {
    const out: Record<string, { spawned: boolean; alive: number; awake: number; holding: number; triggered: boolean }> = {};
    for (const g of GROUPS5) {
      const m = this.members(g);
      out[g] = {
        spawned: this.spawnedGroups.has(g) || m.length > 0, alive: m.length, awake: m.filter((e) => e.state !== 'dormant' && !this.isHolding(e)).length,
        holding: this.holdingIn(g), triggered: this.prog.triggered.includes(g),
      };
    }
    return out;
  }

  get debugState() {
    const f = this.f;
    const it = this.ctx.interactables.get('radio5');
    return {
      level: 5, now: +this.now.toFixed(2), beats: [...this.prog.beats], t: { ...this.marks }, phase: this.phase, phaseApplied: this.phaseApplied,
      flags: { ...f }, checkpoints: [...this.prog.checkpoints], checkpoint: this.lastCheckpoint, pendingCheckpoint: this.pendingCheckpoint,
      restoredFrom: this.restoredFrom, calm: this.started && this.calm(), doorCalm: this.started && this.doorCalm(),
      heard: [...this.talk.heard], missingMarkers: [...this.missingMarkers], loadout: this.loadout, arrival: this.arrival, ended: this.ended,
      scares: [...this.prog.scares], scareLog: this.scareLog.slice(),
      radio: { owned: f.radio, live: this.now < this.radioUntil, pos: this.radioPos ? this.radioPos.toArray().map((v) => +v.toFixed(3)) : null, enabled: !!it?.enabled },
      keypad: { powered: f.powered, open: this.keypadOpen, wrong: this.prog.codeWrong ?? 0, accepted: f.keypad },
      door: { started: this.doorCheck.started, check: +this.doorCheck.check.toFixed(3), facing: this.facing(), done: this.doorCheck.done },
      wheel: { startedAt: this.wheelStartedAt, doneAt: this.wheelDoneAt },
      groups: this.groupsState(),
      scene: { times: this.sceneTimes, result: this.sceneResult, h: this.sceneTimes?.H ?? null },
      spawnLog: this.spawnLog.slice(), strays: this.strays.slice(),
      // extras
      clock: +this.t.toFixed(2), arrivalHour: this.arrivalHour, testHour: +this.clockHour().toFixed(5), objective: this.objective(),
      triggered: [...this.prog.triggered], cleared: [...this.prog.cleared], read: [...this.prog.read], visited: [...this.prog.visited],
      speaking: this.talk.speaking, seqBusy: this.seqBusy, live: this.live, started: this.started, mood: this.director.mood,
      codeWrong: this.prog.codeWrong ?? 0, blocked: this.started && this.checkpointBlocked(), rank: phaseRank5(this.phase),
    };
  }
}

export type { Flags5 };
