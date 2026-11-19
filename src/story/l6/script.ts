/**
 * Level 6 — "간선", the route (stage 3d §4.1–§4.7; ST-a): the tube (A → T → U), tunnel A and F1 with the crossing,
 * Repeater 2 and F2 (B), tunnel B in the dark and F3's walk-out, the head-end (the lines, the queue, the handset, the
 * crank → Key A, F4), the vault (Key A → the enclosure, the pull → Key B, the ring, F5, the thud), the stair door (Key B →
 * K, the loader spawned — D31), the shaft (the lamps, F6). The moon pool, the boss and the ending are `boss.ts` /
 * `scenes.ts` (ST-b), started from here.
 *
 * Rules this file is built on (DESIGN.md R1–R8, plan §9; review fixes §13):
 *   R1  every gate is a door state of a phase (the level's `applyPhase6`), derived from the record (`phase`); every door
 *       that closes behind the player is a latch armed only past its doorway (re-armed once he moved off); the order is
 *       mechanical (two trapped keys), never a timer.
 *   R3  every line has a rule (dialogue.ts), checked when it starts; sequence speech is cued from recorded durations
 *       (each line starts on its cue's frame; cuts in FILE time less the lead plus the fx lead); a dropped line never
 *       holds anything up (nothing gates on a line).
 *   R4  nothing hostile exists before its beat (only the dormant sentry `g6_tunb_k`); F1 / F3 are `spawnGroup`ed in
 *       `hold` and enter `prog.triggered` only when released (3c B1); every arrival is out of a sealed space through a door
 *       / vent / grille that visibly opens; the loader is spawned when Key B turns (D31).
 *   B4  each key is given / trapped in the SAME synchronous action as its flag (`manual` + Key A, `bjOpen` + removeKey A,
 *       `pulled` + Key B, `shaftOpen` + removeKey B); every restore replays every flag's world consequence (`restoreWorld`,
 *       by flags, in §7's order), never by checkpoint id; keys come from `PlayerSave.keys`.
 */
import * as THREE from 'three';
import type { GameContext, GripHandle } from '../../core/types';
import type { Sequencer } from '../sequencer';
import type { MusicDirector } from '../director';
import type { World } from '../world';
import { CHECKPOINT_IDS_L6, type CheckpointIdL6 } from '../save';
import type { CheckpointRule } from '../stage/base';
import { lineDuration } from '../voice';
import { fxLead } from '../../audio/voicefx';
import { applyPhase6 } from '../../level/l6/phases';
import { GROUPS6, V, type HooksL6 } from './base';
import { Scenes6 } from './scenes';
import { RULES6, isRadio6, line6, phaseRank6, type Bark6 } from './dialogue';
import { FRAGMENTS6, HANDSET_LABEL6, OBJ6, PROMPT6, RADIO_LABEL6, READ_ROOM6, SCREEN6, TOAST6 } from './text';

/** The manifest's per-line lead (what the audio skips): `cut` is in FILE time (3c W9 convention). */
const MANIFEST = import.meta.glob('../../../voice/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const LEADS = new Map<string, number>();
try {
  const m = (Object.values(MANIFEST)[0] ?? {}) as { lines?: Record<string, { lead?: number }> };
  for (const [id, e] of Object.entries(m.lines ?? {})) if (id.startsWith('l6_')) LEADS.set(id, Math.max(0, Math.min(2, Number(e?.lead) || 0)));
} catch { /* ignore */ }
/** The radio chain's squelch before the voice (fxLead 0.04 s); the phone chain has none (fxLead 0). */
const LEAD_OF = (fx: string | undefined): number => {
  try { return Math.max(0, fxLead((fx === 'radio:1' ? 'radio' : fx ?? 'clean') as Parameters<typeof fxLead>[0])); } catch { return fx?.startsWith('radio') ? 0.04 : 0; }
};

const TUNNELS = ['tun6_a', 'rep6', 'tun6_b', 'bay6'];
const SCARE_ROOMS = ['tun6_a', 'rep6', 'tun6_b', 'bay6', 'he6', 'vault6', 'shaft6'];
/** H13 light groups (the level's §2.7 group names). */
const LIGHT_GROUPS6 = ['tun6_a_far', 'tun6_a_emerg', 'shaft6', 'shaft6_emerg', 'pool6', 'pool6_emerg', 'pool6_beacon'];
const X_POS = new THREE.Vector3(1, 0, 0), X_NEG = new THREE.Vector3(-1, 0, 0), Z_POS = new THREE.Vector3(0, 0, 1);

type Grip = { id: string; h: GripHandle; result: 'done' | 'cancelled' | null };

export class ScriptL6 extends Scenes6 {
  /** For debugState (check-chain): how the run was armed. */
  loadout: 'carry' | 'direct' | 'none' | 'save' = 'none';
  arrival: { from: number | null; armor: number } = { from: null, armor: 0 };
  private forced = new Set<string>();
  private strip: string | null = null;
  private lastQ = -1e9;
  private roomSince = new Map<string, number>();
  // F1
  private crossT0 = -1e9;
  private crossEnd = -1e9;
  // F3
  private f3HoldAt = -1e9;
  private f3Seen = 0;
  private f3Beam = 0;
  // the handset (§4.5)
  private phone: 'idle' | 'ringing' | 'talking' | 'dead' | 'done' = 'idle';
  private held = false;
  // grips (§8.5): the running one, and the cumulative progress of a cancelled crank / pull (not persisted)
  private grip: Grip | null = null;
  private crankK = 0;
  private pullK = 0;
  // scares
  private tentLook = 0;
  private drumLook = 0;
  // barks
  private lastBark = -1e9;
  private sawPlayer = new Set<number>();
  private lastSaw = new Map<number, number>();
  private downDue = new Map<number, number>();
  private hitAt = new Map<number, number>();
  private soldierDeaths: { p: THREE.Vector3; t: number }[] = [];
  private lastShotFrom: THREE.Vector3 | null = null;
  private lastImpact: THREE.Vector3 | null = null;
  private rescued = 0;
  private holdLatchRunning = false;
  private holdGroups = new Set<string>();

  constructor(ctx: GameContext, seq: Sequencer, director: MusicDirector, w: World, logs: Set<string>, hooks: HooksL6) {
    super(ctx, seq, director, w, logs, hooks);
    const ev = ctx.events;
    ev.on('interact', (e) => this.onInteract(e.id));
    ev.on('door:denied', (e) => this.onDenied(e.id));
    ev.on('pickup', (e) => this.onPickup(e.kind));
    ev.on('weapon:fired', (e) => { this.lastShotFrom = e.origin.clone(); });
    ev.on('bullet:impact', (e) => { this.lastImpact = e.point.clone(); });
    ev.on('enemy:died', (e) => this.onEnemyDied(e.type, e.position));
    ev.on('enemy:alerted', (e) => this.onAlerted(e.id));
    ev.on('enemy:damaged', (e) => this.onEnemyDamaged(e.id));
    ev.on('player:rescued', () => { this.rescued++; });
  }

  // ───────────────────────────────────────────────────────────── consequences (idempotent; replayed on load)

  private readonly CONSEQUENCES: Record<string, () => void> = {
    '#tube_open': () => { this.f.tubeOpen = true; },
    '#tube_latched': () => { this.f.tubeLatched = true; },
    l6_crossing: () => { this.f.f1 = true; },
    '#crossing': () => { this.f.crossing = true; },
    '#f1_free': () => { this.f.f1Free = true; },
    '#f1_cancel': () => { this.f.f1Cancelled = true; },
    '#f1_done': () => { this.f.f1Done = true; },
    l6_rep: () => { this.f.f2 = true; },
    '#bay': () => { this.f.bayLive = true; },
    '#f3': () => { this.f.f3 = true; },
    '#f3_free': () => { this.f.f3Free = true; },
    '#he': () => { this.f.he = true; },
    '#queue': () => { this.f.queue = true; this.earn('manifest'); },
    '#handset': () => { this.f.handset = true; },
    '#aas': () => { this.f.aas = true; this.earn('aas'); },
    l6_manual: () => { this.f.manual = true; },
    '#f4': () => { this.f.f4 = true; },
    '#bj_open': () => { this.f.bjOpen = true; },
    l6_pulled: () => { this.f.pulled = true; },
    '#f5': () => { this.f.f5 = true; },
    '#thud': () => { this.f.thud = true; },
    l6_shaft_open: () => { this.f.shaftOpen = true; },
    '#lights6': () => { this.f.lights6 = true; },
    '#hatch_vault': () => { this.f.hatchVault = true; },
    '#hatch_he': () => { this.f.hatchHe = true; },
  };
  protected consequence(id: string): void {
    const fn = this.CONSEQUENCES[id];
    if (fn) { try { fn(); } catch (e) { console.warn(`[story] consequence ${id} failed`, e); } }
  }

  /** The world every run starts from (before any phase): screens, prompts, interactables, set pieces, machines. */
  protected baseline(): void {
    this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeCycling);
    this.screen('mimic6', 'mimic', SCREEN6.mimicAuto);
    this.screen('queue6', 'manifest', SCREEN6.queue);
    this.screen('switch6', 'terminal_idle', SCREEN6.switchAuto);
    this.screen('bj6', 'interlock', SCREEN6.bjIdle);
    this.screen('shaft6_panel', 'interlock', SCREEN6.shaftIdle);
    // the story-owned interactables (the phase table never switches them, W4a)
    this.w.setInteractable('he6_phone', false);
    this.w.setInteractable('vault6_loom', false);
    this.w.setInteractable('console6', false);
    this.call('switch6', 'setProgress', 0);
    this.call('switch6', 'keyOut', 0);
    this.w.machine('ping6', 'idle');
  }
  protected baselineMood(): 'silence' | 'ambient' | 'tension' { return this.f.quiet ? 'silence' : 'ambient'; }

  // ── fast-forward (§7, B4: every restore replays every flag's world consequence, by flags) ──

  protected override afterReplay(): void {
    const f = this.f;
    f.holdOpen = false;
    // cp6_he and later: tunnel B's soldier / sentry are cleared (a dormant sentry left behind is not part of a later save)
    if (f.he) for (const g of ['g6_tunb_s', 'g6_tunb_k']) { try { this.ctx.enemies.removeGroup(g); } catch { /* ignore */ } }
    // a save can never hold F1 half done (no checkpoint is due during it); if one does (a debug save), it is over
    if (f.f1 && !f.f1Done) f.f1Done = true;
    // F3 still holding at a cp6_rep save: he was never `triggered`, so a fresh page has no soldier — he walks out again on
    // the next entry into the dark tunnel (never lost, never doubled)
    if (f.f3 && !f.f3Free && !f.he) f.f3 = false;
    // the boss layer: `shaftOpen` → the loader spawned in `working` (D31), then its own record (ST-b)
    this.bossReplay();
  }
  protected override afterSnap(): void { this.restoreWorld(); }

  /** The world of the record, rebuilt silently on a load (snaps, screens, prompts, set pieces, machines). */
  private restoreWorld(): void {
    const f = this.f;
    this.screen('tube_panel6', 'terminal_idle', f.tubeLatched ? SCREEN6.tubeClosed : f.tubeOpen ? SCREEN6.tubeOpen : SCREEN6.tubeCycling);
    if (f.f1Free) this.snapVig('tun6_far_out');
    if (f.f2) this.snapVig('vent6_rep');
    if (f.manual) {
      this.call('switch6', 'setProgress', 1);
      this.call('switch6', 'keyOut', 1);
      this.screen('switch6', 'terminal_idle', SCREEN6.switchManual);
      this.screen('mimic6', 'mimic', SCREEN6.mimicManual);
      this.w.setInteractable('he6_switch', false);
    }
    if (f.bjOpen) {
      this.call('bj6', 'unlock', 1);
      this.snapVig('bj6_open');
      this.screen('bj6', 'interlock', SCREEN6.bjOpen);
      this.w.setInteractable('vault6_lock', false);
      this.w.setInteractable('vault6_loom', !f.pulled);
    }
    if (f.pulled) {
      if (!this.call('bj6', 'ripped')) this.snapVig('bj6_rip');
      this.call('bj6', 'takeKeyB');
      this.screen('bj6', 'interlock', SCREEN6.bjLos);
      this.screen('mimic6', 'mimic', SCREEN6.mimicPulled);
      this.screen('switch6', 'terminal_idle', SCREEN6.los);
      this.screen('queue6', 'manifest', SCREEN6.los);
      this.w.setInteractable('vault6_loom', false);
      this.w.machine('ping6', 'active');
      if (this.prog.launchAt === null && this.t >= f.pullT + 90) this.prog.launchAt = f.pullT + 90;
    }
    if (f.shaftOpen) {
      this.call('shaft6', 'unlock', 1);
      this.screen('shaft6_panel', 'interlock', SCREEN6.shaftOpen);
      this.w.setInteractable('shaft6_lock', false);
    }
    if (f.hatchVault) { this.snapVig('hatch6_vault_open'); this.w.setInteractable('hatch6_vault', false); }
    if (f.hatchHe) { this.snapVig('hatch6_he_open'); this.w.setInteractable('hatch6_he', false); this.w.setInteractable('hatch6_he_plate', false); }
    for (const id of this.prog.scares) if (id !== 'v6_crossing') this.snapVig(id);
    if (f.handset) { this.w.setInteractable('he6_phone', false); this.phone = 'done'; }
    this.bossSnap();
  }

  // ───────────────────────────────────────────────────────────── per frame

  protected override onFrame(dt: number): void {
    const s = this.ctx.state;
    if (s === 'playing' || s === 'cutscene') this.prog.t += dt;
    if (!this.live) return;
    // Q = ask Kessler (§6.2) — from the start (fact `radio`, carried in)
    try { if (s === 'playing' && this.ctx.input.pressed('KeyQ')) this.radioAsk(); } catch { /* ignore */ }
    // the HUD radio strip: live while a radio line plays; the handset's label while it is held
    if (this.radioOwned() && !this.ended && !this.inEndingNow) {
      const live = this.now < this.radioUntil;
      const label = this.held ? HANDSET_LABEL6 : RADIO_LABEL6;
      const key = `${label}|${live}`;
      if (key !== this.strip) { this.strip = key; try { this.ctx.ui.radio({ label, live }); } catch { /* ignore */ } }
    }
    if (this.held) this.holdHandset();
  }
  private radioOwned(): boolean { return this.ctx.facts.radio !== false; }

  protected override onStep(step: number): void {
    this.bossStep(step);
    if (!this.live || this.ctx.state !== 'playing') return;
    const f = this.f;
    const room = this.w.room();
    for (const r of SCARE_ROOMS.concat(['lock6', 'pool6'])) {
      if (room === r) { if (!this.roomSince.has(r)) this.roomSince.set(r, this.now); } else this.roomSince.delete(r);
    }
    this.f3Watch(step);
    this.scareRules(step);
    this.barkRules();
    this.strayRule(step);
    this.prompts();
    // launchAt (D16, S10d): pull + 90 s when the thud never set it
    if (f.pulled && this.prog.launchAt === null && this.t >= f.pullT + 90) this.prog.launchAt = f.pullT + 90;
    this.calmWaiting = this.pendingCheckpoint !== null || (!f.he && this.inTrig('t6_he')) || this.bossCalmWait();
    if (this.director.mood !== 'tension' && this.w.active() > 0) this.director.setMood('tension');
    else if (this.director.mood === 'tension' && this.w.active() === 0 && this.now - this.lastCombat > 8) this.director.setMood('ambient');
  }
  private inFor(room: string): number { const t = this.roomSince.get(room); return t === undefined ? 0 : this.now - t; }

  /** Interlock prompts by the key held (§2.2, §4.6). */
  private prompts(): void {
    const p = this.ctx.player;
    if (!this.f.bjOpen) this.w.setPrompt('vault6_lock', p.hasKey('key6_a') ? PROMPT6.lockA : PROMPT6.lockANo);
    if (!this.f.shaftOpen) this.w.setPrompt('shaft6_lock', p.hasKey('key6_b') ? PROMPT6.lockB : PROMPT6.lockBNo);
  }

  protected objective(): string {
    if (!this.live || this.ended) return OBJ6.none;
    const f = this.f;
    if (f.shaftOpen) return this.bossObjective() ?? OBJ6.pool;
    if (f.pulled) return OBJ6.stair;
    if (f.manual) return OBJ6.bj;
    if (f.he || this.inHeVault()) return OBJ6.switch;
    return OBJ6.headEnd;
  }
  private inHeVault(): boolean { const r = this.w.room(); return r === 'he6' || r === 'vault6' || this.inTrench(); }

  // ───────────────────────────────────────────────────────────── checkpoints (§7)

  protected readonly checkpointIds = CHECKPOINT_IDS_L6;
  protected readonly CHECKPOINTS: Record<CheckpointIdL6, CheckpointRule> = {
    cp6_start: { when: () => this.f.tubeOpen, valid: () => !this.f.tubeLatched },
    cp6_tunnel: { when: () => (this.f.f1Done || this.f.f1Cancelled) && TUNNELS.includes(this.w.room() ?? ''), valid: () => !this.f.bayLive },
    cp6_rep: {
      when: () => this.f.f2 && ['g6_rep_s', 'g6_rep_u', 'g6_rep_k'].every((g) => this.fought(g, 1.5)) && TUNNELS.includes(this.w.room() ?? ''),
      valid: () => !this.f.he,
    },
    cp6_he: { when: () => this.f.he && this.w.room() === 'he6', valid: () => !this.f.manual },
    cp6_manual: {
      when: () => this.f.f4 && this.fought('g6_he', 1.5) && ['he6', 'vault6', 'tun6_b'].includes(this.w.room() ?? '') && !this.inTrench(),
      valid: () => this.f.manual && !this.f.bjOpen && !this.f.pulled,
    },
    cp6_pulled: {
      when: () => this.f.f5 && ['g6_vault', 'g6_vault_k', 'g6_vault_kv'].every((g) => !this.spawnedGroups.has(g) || this.fought(g, 1.5))
        && ['he6', 'vault6'].includes(this.w.room() ?? '') && !this.inTrench(),
      valid: () => this.f.pulled && !this.f.shaftOpen,
    },
    cp6_shaft: {
      // (the lamps normally fire first — the bottom is inside t6_shaft_l1; a run where they never could still saves here)
      when: () => (!this.spawnedGroups.has('g6_shaft') || this.fought('g6_shaft', 0.5))
        && (this.inTrig('t6_shaft_bot') || (this.w.room() === 'shaft6' && this.pos.y < -6)),
      valid: () => this.f.shaftOpen && !this.f.reveal,
    },
    cp6_m1: this.bossCheckpoint('cp6_m1'), cp6_m2: this.bossCheckpoint('cp6_m2'), cp6_m3: this.bossCheckpoint('cp6_m3'),
    cp6_m4: this.bossCheckpoint('cp6_m4'), cp6_m5: this.bossCheckpoint('cp6_m5'), cp6_quiet: this.bossCheckpoint('cp6_quiet'),
  };
  /** §7: no checkpoint during a grip, the tube latch, the trench, the handset call, a wave's open door, the cutscene. */
  protected override checkpointBlocked(): boolean {
    const f = this.f;
    return !!this.grip || this.phone === 'ringing' || this.phone === 'talking' || this.inTrench() || f.holdOpen
      || (f.tubeOpen && !f.tubeLatched && this.inTrig('t6_tube')) || this.ended || this.bossBlocked();
  }
  /**
   * `checkpointNow` with the route's guards: a route checkpoint is written only while its rule is still `valid`, and never
   * after a later checkpoint (a save never goes back — B4: `cp6_start` at 3.9 s after a fast latch, `cp6_he` after the
   * crank). The boss's `cp6_m*` / `cp6_quiet` (ST-b) pass straight through.
   */
  protected override checkpointNow(id: CheckpointIdL6): void {
    const ids = this.checkpointIds;
    if (ids.indexOf(id) <= ids.indexOf('cp6_shaft')) {
      if (!this.CHECKPOINTS[id].valid()) return;
      if (this.lastCheckpoint && ids.indexOf(this.lastCheckpoint) > ids.indexOf(id)) return;
    }
    super.checkpointNow(id);
  }
  /** Debug / check-chain: write a checkpoint now (the record as it is). */
  debugCheckpoint(id: CheckpointIdL6): boolean {
    try { if (!this.prog.checkpoints.includes(id)) this.prog.checkpoints.push(id); this.lastCheckpoint = id; this.hooks.checkpoint(id); return true; } catch { return false; }
  }
  markEnded(): void {
    this.ended = true;
    // H5: a line cut by the end (its script stops) still logs its end — the moment it was cut
    for (const l of this.talk.log as unknown as { dur?: number; end?: number | null }[]) if (typeof l.dur === 'number' && typeof l.end !== 'number') l.end = +this.now.toFixed(3);
  }
  /** D16: the launch's level-clock second (`launchAt`, else pull + 90 once pulled), null before the pull. */
  launchT(): number | null { return this.prog.launchAt ?? (this.f.pulled ? this.f.pullT + 90 : null); }
  /** For the carry (D28). */
  carryFacts(): { manifest: boolean; aas: boolean; trunkCut: boolean; loaderDead: boolean; launchHour: number } {
    const f = this.f, lt = this.launchT();
    return { manifest: f.queue || this.ctx.facts.manifest === true, aas: f.aas, trunkCut: f.trunkCut, loaderDead: f.loaderDead, launchHour: lt === null ? this.arrivalHour : this.hourAt(lt) };
  }

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
    S('tube_latch', () => this.tubeLatch());
    S('f1', () => this.f1Thread());
    S('rep', () => this.repThread());
    S('tunb', () => this.tunbThread());
    S('sentry', () => this.sentryThread());
    S('headend', () => this.headEndThread());
    S('vault_line', () => this.vaultLine());
    S('after_pull', () => this.afterPull());
    this.bossStart();
  }
  /** A new run: control in lock6 (phase A). */
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

  // ── §4.1 arrival (A → T → U) ──

  private async arrivalBeat(): Promise<void> {
    if (this.f.tubeOpen) return;
    await this.until(() => this.live && this.ctx.state === 'playing');
    const t0 = this.now;
    this.beat('l6_start');
    this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeCycling);
    this.S('kes_start', async () => { await this.seqLine('l6_kes_start', t0 + 0.6); });
    await this.until(() => this.now >= t0 + 3.0 || this.forced.has('tube'));
    this.openTube();
    await this.until(() => this.now >= t0 + 3.9 || this.forced.has('tube'));
    this.checkpointNow('cp6_start');
  }
  /** 3.0 s: `d6_tube` opens (phase T; the door plays its own sound), the panel answers. */
  private openTube(): void {
    if (this.f.tubeOpen) return;
    this.once('tube_open');
    this.stamp('tube_open');
    this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeOpen);
    void this.unit('l6_unit_tube', this.mk('mk6_tube_panel'));
  }

  /** §3 / §4.1: the tube latches behind him (armed past the doorway — `t6_tube` and z < −1.3 — re-armed once he moved off). */
  private async tubeLatch(): Promise<void> {
    await this.until(() => this.f.tubeOpen);
    while (!this.f.tubeLatched) {
      await this.until(() => this.forced.has('latch') || (this.phase === 'T' && this.inTrig('t6_tube') && this.pos.z < -1.3 && this.ctx.state === 'playing'));
      const forced = this.forced.has('latch');
      const ok = forced || await this.latch('d6_tube', () => this.pos.z < -0.6, 1.0, 0.95, 3.0);
      if (ok) {
        this.once('tube_latched');
        this.stamp('tube_latched');
        this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeClosed);
        break;
      }
      // the doorway: the tube reopens; re-armed on the next pass (the condition needs him back past the doorway)
      this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeClear);
      await this.hold(2.0);
      this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeOpen);
    }
    // C, once: Kessler, then CHOIR on the channel (+ 0.6)
    if (this.talk.heard.has('l6_kes_start_2')) return;
    const e = await this.seqLine('l6_kes_start_2', this.now + 0.3);
    if (e !== false) await this.seqLine(this.choiceId('l6_choir_start'), e + 0.6);
  }

  // ── §4.2 tunnel A and F1 (U) ──

  private async f1Thread(): Promise<void> {
    await this.until(() => this.f.tubeLatched);
    if (this.f.f1 || this.f.f1Done || this.f.f1Cancelled) return;
    const tU = this.now;
    const pick: { how: 'crossing' | 'release' | 'cancel' } = { how: 'release' };
    await this.until(() => {
      if (this.ctx.state !== 'playing') return false;
      if (this.forced.has('crossing')) { pick.how = 'crossing'; return true; }
      if (this.forced.has('f1')) { pick.how = 'release'; return true; }
      const z = this.pos.z;
      if (z <= -70) { pick.how = 'cancel'; return true; }
      // the crossing: first t6_tun_mid, calm, z > −40 — or 35 s in U with him still north of −70
      if (this.inTrig('t6_tun_mid') && z > -40 && this.scareCalm(true)) { pick.how = 'crossing'; return true; }
      if (z < -40) { pick.how = 'release'; return true; }         // ran past the middle: no crossing, F1 at once
      if (this.now - tU >= 35) { pick.how = z > -40 && this.scareCalm(true) && !this.prog.scares.includes('v6_crossing') ? 'crossing' : 'release'; return true; }
      return false;
    });
    if (pick.how === 'cancel') {
      // R4: he is at the mouth before F1 spawned — it never exists; rep6's F2 is the first fight
      this.once('f1_cancel');
      this.stamp('f1_cancelled');
      return;
    }
    this.beat('l6_crossing');
    this.spawn('g6_tun_s', false);                  // in hold, hidden in rep6 (not `triggered` until released)
    if (pick.how === 'crossing' && !this.prog.scares.includes('v6_crossing')) {
      this.fireScare('v6_crossing');
      this.once('crossing');
      await this.crossingWalk();
    }
    this.releaseF1('story');
    await this.until(() => this.f1UnitsDecided);
    await this.until(() => this.members('g6_tun_s').length === 0 && (this.tunUSkipped || this.members('g6_tun_u').length === 0));
    await this.hold(1.5);
    this.once('f1_done');
    this.stamp('f1_done');
    // C, once: "I heard that." (g6_tun_s dead, calm)
    const ok = await this.untilOr(() => this.calm() && this.channelFree() && !this.seqBusy, 30);
    if (ok) await this.say('l6_kes_tun_done', { pri: 'scene', now: true });
  }
  private f1UnitsDecided = false;
  private tunUSkipped = false;
  /** v6_crossing: s1 walks the mouth (`mk6_cross_0` → `mk6_cross_1`, 1.4 m/s, light on); released + 2 s, a shot, or ≤ 40 m. */
  private async crossingWalk(): Promise<void> {
    await this.hold(0.1);
    const s1p = this.mk('mk6_tun_s1');
    const ms = this.members('g6_tun_s').sort((a, b) => a.position.distanceTo(s1p) - b.position.distanceTo(s1p));
    const s1 = ms[0];
    if (!s1) return;
    const pts = [this.mk('mk6_cross_0'), this.mk('mk6_cross_1')];
    const so = this.soldierObj(s1.id);
    try {
      if (so?.patrol) so.patrol(pts, { speed: 1.4, light: true, end: 'hold' });
      else this.ctx.enemies.patrol('g6_tun_s', pts, { speed: 1.4, light: true, end: 'hold' });
    } catch (e) { console.warn('[story] crossing patrol failed', e); }
    this.crossT0 = this.now;
    this.stamp('crossing_start');
    await this.until(() => {
      if (this.f.f1Free || this.forced.has('f1')) return true;
      const m = this.members('g6_tun_s');
      if (!m.length) return true;
      if (this.crossEnd < -1e8 && this.now - this.crossT0 > 0.5) {
        const s = this.soldierObj(s1.id);
        const walking = s && typeof s.patrolling === 'boolean' ? s.patrolling : s1.position.distanceTo(pts[1]) > 0.8;
        if (!walking || !s1.alive) { this.crossEnd = this.now; this.stamp('crossing_end'); }
      }
      if (this.lastShotAt > this.crossT0) return true;
      if (m.some((e) => this.distTo(e.position) <= 40)) return true;
      return this.crossEnd > -1e8 && this.now >= this.crossEnd + 2.0;
    });
  }
  private releaseF1(why: string): void {
    if (this.f.f1Free) return;
    try { this.ctx.enemies.release('g6_tun_s'); } catch { /* ignore */ }
    this.once('f1_free');
    this.markTriggered('g6_tun_s');
    this.stamp('f1_free');
    if (this.ctx.debug.verbose) console.log(`[story] g6_tun_s released (${why})`);
    for (const e of this.members('g6_tun_s')) this.downDue.set(e.id, this.now + 3);
    // the far lights die, the red points come on (dark extended to z < −52)
    this.vig('tun6_far_out');
    this.S('kes_contact_a', () => this.kesLater('l6_kes_contact_a', 8));
    this.S('out_g6_tun_s', () => this.fightOut('g6_tun_s', 90));
    this.S('f1_units', () => this.f1Units());
  }
  /** Both soldiers in cover + 6 s (or one dead): the husks behind DS2 — skipped when he would see them spawn (R4). */
  private async f1Units(): Promise<void> {
    const t0 = this.now;
    let coverSince = -1e9;
    await this.until(() => {
      if (this.forced.has('f1')) return true;
      const m = this.members('g6_tun_s');
      if (m.length < 2) return true;
      const rows = this.soldierRows().filter((r) => r.group === 'g6_tun_s');
      const inCover = rows.length >= 2 && rows.every((r) => !!(r as { cover?: string | null }).cover);
      if (inCover) { if (coverSince < -1e8) coverSince = this.now; } else coverSince = -1e9;
      return (coverSince > -1e8 && this.now - coverSince >= 6) || this.now - t0 >= 24;
    });
    if (this.w.room() === 'rep6' && this.spawnVisible('g6_tun_u')) {
      this.tunUSkipped = true;
      this.stamp('tun_u_skipped');
    } else {
      this.spawn('g6_tun_u', true);
      this.rush('g6_tun_u', 25);
      this.S('out_g6_tun_u', () => this.fightOut('g6_tun_u', 60));
    }
    this.f1UnitsDecided = true;
  }

  // ── §4.3 Repeater 2 (U → B) ──

  private async repThread(): Promise<void> {
    await this.until(() => this.f.tubeLatched);
    this.S('kes_rep', async () => {
      if (this.talk.heard.has('l6_kes_rep')) return;
      await this.until(() => this.inTrig('t6_rep'));
      await this.kesLater('l6_kes_rep', 20);
    });
    if (this.f.f2) return;
    await this.until(() => this.forced.has('f2') || (this.ctx.state === 'playing' && (this.inTrig('t6_rep_in') || this.inFor('rep6') >= 25)));
    await this.f2Wave();
  }
  private async f2Wave(): Promise<void> {
    if (this.f.f2) return;
    this.beat('l6_rep');
    // the soldier behind RH1 in tun6_b (hidden from every point of rep6); he comes north into rep6's covers
    this.spawn('g6_rep_s', true);
    this.rouse('g6_rep_s');
    this.S('out_g6_rep_s', () => this.fightOut('g6_rep_s', 60));
    this.S('kes_contact_rep', () => this.kesLater('l6_kes_contact_rep', 15));
    await this.hold(0.4);
    // phase B: d6_bay (script door) opens on the two husks
    this.spawn('g6_rep_u', true);
    this.once('bay');
    try { this.door('d6_bay')?.open(); } catch { /* ignore */ }
    this.rush('g6_rep_u', 25);
    this.S('out_g6_rep_u', () => this.fightOut('g6_rep_u', 60));
    await this.hold(0.6);
    this.vig('vent6_rep');
    await this.hold(0.4);
    this.spawn('g6_rep_k', true);
    this.rouse('g6_rep_k');
    this.S('out_g6_rep_k', () => this.fightOut('g6_rep_k', 60));
  }

  // ── §4.4 tunnel B in the dark (B) ──

  private async tunbThread(): Promise<void> {
    await this.until(() => this.f.tubeLatched);
    this.S('kes_tunb', async () => {
      if (this.talk.heard.has('l6_kes_tunb')) return;
      await this.until(() => this.inTrig('t6_tunb'));
      await this.kesLater('l6_kes_tunb', 20);
    });
    if (this.f.f3 || this.f.he) return;
    await this.until(() => this.forced.has('f3') || (this.ctx.state === 'playing' && this.inTrig('t6_tunb_dark')));
    await this.f3Walk();
  }
  /** F3: spawned in he6 behind the shut `d6_he`; +0.5 s he walks out (a real soldier, `patrol`) and holds at the door. */
  private async f3Walk(): Promise<void> {
    if (this.f.f3) return;
    this.once('f3');
    this.f.f3 = true;                                // (also after a load that dropped an unreleased F3, below)
    this.spawn('g6_tunb_s', false);
    await this.hold(0.5);
    const pts = [this.mk('mk6_he_s'), this.mk('mk6_tunb_hold')];
    try { this.ctx.enemies.patrol('g6_tunb_s', pts, { speed: 1.4, light: false, end: 'hold' }); } catch (e) { console.warn('[story] F3 patrol failed', e); }
    this.stamp('f3_walk');
    this.S('f3_release', () => this.f3ReleaseRule());
    const t0 = this.now;
    await this.until(() => {
      if (this.f.f3Free) return true;
      const e = this.members('g6_tunb_s')[0];
      if (!e) return true;
      const s = this.soldierObj(e.id);
      const walking = s && typeof s.patrolling === 'boolean' ? s.patrolling : e.position.distanceTo(pts[1]) > 0.8;
      return (!walking && this.now - t0 > 1.0) || this.now - t0 > 30;
    });
    if (this.f.f3Free || !this.members('g6_tunb_s').length) return;
    this.f3HoldAt = this.now;
    this.stamp('f3_hold');
    await this.hold(1.0);
    if (this.holdingIn('g6_tunb_s') > 0 && !this.talk.heard.has(this.choiceId('l6_choir_dark'))) {
      const ok = await this.untilOr(() => this.channelFree() && !this.seqBusy, 6);
      if (ok) await this.say(this.choiceId('l6_choir_dark'), { pri: 'scene', now: true });
    }
  }
  /** Released by: within 30 m; a shot / near miss (self, `enemy:alerted`); the lamp on him 0.5 s within 25 m; 60 s holding. */
  private async f3ReleaseRule(): Promise<void> {
    let last = this.now;
    await this.until(() => {
      const dt = Math.min(0.2, this.now - last); last = this.now;
      if (this.f.f3Free || this.forced.has('release_f3')) return true;
      const e = this.members('g6_tunb_s')[0];
      if (!e) return true;
      if (this.ctx.state !== 'playing') return false;
      const d = this.distTo(e.position);
      if (d <= 30) return true;
      const chest = e.position.clone().setY(e.position.y + 1.3);
      this.f3Beam = this.ctx.player.flashlightOn && d <= 25 && this.isLookingAt(chest, 12, true) ? this.f3Beam + dt : 0;
      if (this.f3Beam >= 0.5) return true;
      return this.f3HoldAt > -1e8 && this.now - this.f3HoldAt >= 60;
    });
    this.releaseF3('rule');
  }
  private releaseF3(why: string): void {
    if (this.f.f3Free) return;
    if (this.members('g6_tunb_s').length) { try { this.ctx.enemies.release('g6_tunb_s'); } catch { /* ignore */ } }
    this.once('f3_free');
    this.markTriggered('g6_tunb_s');
    this.stamp('f3_free');
    if (this.ctx.debug.verbose) console.log(`[story] g6_tunb_s released (${why})`);
    for (const e of this.members('g6_tunb_s')) this.downDue.set(e.id, this.now + 3);
    this.S('out_g6_tunb_s', () => this.fightOut('g6_tunb_s', 90));
  }
  /** Seconds F3's holding soldier has been in view at > 25 m with the lamp off (`l6_kes_tunb_soldier`). */
  private f3Watch(step: number): void {
    const e = this.members('g6_tunb_s')[0];
    if (!e || this.holdingIn('g6_tunb_s') === 0 || this.talk.heard.has('l6_kes_tunb_soldier')) { this.f3Seen = 0; return; }
    const ok = this.distTo(e.position) > 25 && !this.ctx.player.flashlightOn && this.inView(e, 50);
    this.f3Seen = ok ? this.f3Seen + step : 0;
    if (this.f3Seen >= 1 && !this.kesTunbAsked) { this.kesTunbAsked = true; this.S('kes_tunb_soldier', () => this.kesLater('l6_kes_tunb_soldier', 4)); }
  }
  private kesTunbAsked = false;
  protected override f3SeenFor(): number { return this.f3Seen; }
  protected override f1BothFree(): boolean { return this.f.f1Free && this.members('g6_tun_s').length >= 2; }

  /** The dormant dock sentry: `t6_tunb_sentry`, a shot within 12 m of the dock, or F3 released. */
  private async sentryThread(): Promise<void> {
    if (this.f.he) return;
    const dock = this.mk('mk6_sentry');
    await this.until(() => {
      if (this.members('g6_tunb_k').length === 0) return true;
      if (this.inTrig('t6_tunb_sentry') || this.f.f3Free) return true;
      const near = (p: THREE.Vector3 | null) => !!p && p.distanceTo(dock) <= 12;
      return this.now - this.lastShotAt < 0.3 && (near(this.lastShotFrom) || near(this.lastImpact));
    });
    if (this.members('g6_tunb_k').length === 0 || this.prog.triggered.includes('g6_tunb_k')) return;
    this.engage('g6_tunb_k', 'wake');
    await this.fightOut('g6_tunb_k', 60);
  }

  // ── §4.5 the head-end (B) ──

  private async headEndThread(): Promise<void> {
    await this.until(() => this.f.tubeLatched);
    if (!this.f.he) {
      await this.until(() => this.forced.has('he') || (this.ctx.state === 'playing' && this.inTrig('t6_he')
        && !this.awakeHostiles().some((e) => this.distTo(e.position) <= 30 && ['he6', 'tun6_b'].includes(this.roomOf(e.position) ?? ''))));
      this.once('he');
      this.stamp('he');
      this.checkpointNow('cp6_he');
    }
    // the lines resume from the first not heard (a cp6_he load)
    const heard = (id: string) => this.talk.heard.has(id);
    if (heard('l6_kes_he_3')) return;
    this.seqBusy = true;
    try {
      let e: number | false = this.now + (this.restoredFrom ? 0.8 : 0.2);
      if (!heard('l6_kes_he_1')) { e = await this.seqLine('l6_kes_he_1', e); if (e === false) return; e += 0.5; }
      if (!heard('l6_kes_he_2') && !heard('l6_kes_he_2b')) { e = await this.seqLine('l6_kes_he_2', e); if (e === false) e = this.now; e += 0.6; }
      if (heard('l6_kes_he_2') && !heard('l6_reyes_he')) { e = await this.seqLine('l6_reyes_he', e); if (e === false) e = this.now; e += 0.4; }
      await this.cutLine('l6_kes_he_3', e, { overlap: this.choiceId('l6_choir_he') });
    } finally {
      this.seqBusy = false;
    }
  }

  /**
   * One sequence line on its cue: wait until `at` (a bark in the way is cut first), start it on that frame, resolve at its
   * end with the end time (false: dropped — a death, a rule; a variant said instead counts).
   */
  private async seqLine(id: string, at: number, onStart?: (d: number) => void, where?: () => THREE.Vector3 | undefined): Promise<number | false> {
    await this.until(() => this.now >= at - 0.2 || this.ended);
    const sp = this.talk.speaking;
    if (sp && /^l5_sol_/.test(sp)) this.talk.cut();
    await this.until(() => this.now >= at || this.ended);
    if (this.ended) return false;
    const pos = where?.();
    const ok = await this.say(id, { pri: 'scene', now: true, gap: 0.02, cue: this.now, onStart, ...(pos ? { at: pos } : {}) });
    if (!ok && !this.talk.heard.has(id)) {
      const said = [...this.talk.log].reverse().find((l) => l.id === id)?.said;
      if (!said) return false;
    }
    return this.now;
  }
  /**
   * A line stopped at its `cut` (fade 0.03 s): `cut` is in the take's FILE time; the audio skips the take's lead and the
   * fx chain puts its squelch (fxLead) before the voice — so the stop comes `cut − lead + fxLead` after the line's start.
   * `overlap` (CHOIR over Kessler) starts 0.05 s before the stop, on the overlap channel. Resolves with the end of
   * whichever ends last (the next line's anchor), false when the line was dropped.
   */
  private async cutLine(id: string, at: number, o: { overlap?: string; where?: () => THREE.Vector3 | undefined } = {}): Promise<number | false> {
    const l = line6(id);
    const cutT = Math.max(0.5, (l?.cut ?? lineDuration(id)) - (LEADS.get(id) ?? 0) + LEAD_OF(l?.fx));
    let started = -1;
    let overEnd = -1;
    let done = false;
    this.S('cut_' + id, async () => {
      try {
        await this.until(() => started >= 0 || this.ended || done);
        if (started < 0 || this.ended) return;
        const lag = () => {
          const h = this.currentHandle() as { trace?: { askP?: number; startP?: number } } | null;
          return h?.trace?.startP && h.trace.askP ? Math.max(0, (h.trace.startP - h.trace.askP) / 1000) : 0;
        };
        if (o.overlap) {
          await this.until(() => this.now - started >= cutT - 0.05 + lag() || this.talk.speaking !== id);
          const ov = o.overlap;
          void this.overlapLine(ov, { onStart: (d) => { overEnd = this.now + d; } }).then((ok) => { if (!ok && overEnd < 0) overEnd = this.now; });
          if (overEnd < 0 && !this.talk.log.some((x) => x.id === ov && x.said)) overEnd = this.now;
        }
        await this.until(() => this.now - started >= cutT + lag() || this.talk.speaking !== id);
        if (this.talk.speaking === id) {
          const h = this.currentHandle() as { stop?: (f: number) => void } | null;
          if (h?.stop) { try { h.stop(0.03); } catch { /* ignore */ } }
          try { const c = (this.talk as unknown as { current?: { handle?: unknown } }).current; if (c && h?.stop) c.handle = null; } catch { /* ignore */ }
          this.talk.cut();
        }
        this.stamp(`cut:${id}`);
      } finally { if (overEnd < 0) overEnd = this.now; }
    });
    const r = await this.seqLine(id, at, () => { started = this.now; }, o.where);
    done = true;
    if (r === false && started < 0) return false;
    if (o.overlap) {
      await this.untilOr(() => overEnd >= 0 || this.ended, cutT + 2);
      await this.until(() => this.now >= overEnd || this.ended);
    }
    return this.ended ? false : Math.max(this.now, overEnd);
  }
  /** The dialogue channel's current voice handle (read-only use). */
  private currentHandle(): unknown {
    try { return (this.talk as unknown as { current?: { handle?: unknown } }).current?.handle ?? null; } catch { return null; }
  }
  /** A Kessler line that waits for the radio to be free (queued behind a sequence), within `ttl` s. */
  private async kesLater(id: string, ttl = 60, opts: { at?: number } = {}): Promise<boolean> {
    const t0 = this.now;
    const ok = await this.untilOr(() => this.now >= (opts.at ?? 0) && !this.seqBusy && this.channelFree() && this.ctx.state === 'playing', ttl);
    if (!ok || this.ended || (this.now - t0 >= ttl)) return false;
    return this.say(id, { pri: 'scene', now: true });
  }

  // ── §4.5 / §5.7 #3 the handset ──

  private handsetPos(): THREE.Vector3 {
    const h = this.api('phone6')?.handset;
    return h instanceof THREE.Vector3 ? h.clone() : this.mk('mk6_handset');
  }
  /** Where a held line comes from: 2-D while held (undefined), else the handset on its cord. */
  private phoneAt = (): THREE.Vector3 | undefined => (this.held ? undefined : this.handsetPos());
  private startCall(): void {
    if (this.f.handset) return;
    this.fireScare('v6_handset');                    // the howler (the level's vignette)
    this.once('handset');
    this.phone = 'ringing';
    this.stamp('handset');
    this.S('call', async () => {
      await this.hold(2.4);                          // (the howler's three buzzes)
      if (this.phone !== 'ringing') return;
      this.w.setInteractable('he6_phone', true);
      const T = this.now;
      void this.say('l6_aas_1', { pri: 'scene', now: true, cue: this.now, at: this.handsetPos(), gap: 0.1 });
      await this.until(() => this.phone !== 'ringing' || this.now >= T + 25);
      if (this.phone !== 'ringing' || this.ended) return;
      void this.say('l6_aas_1', { pri: 'scene', now: true, cue: this.now, at: this.handsetPos(), gap: 0.1 });
      const T2 = this.now;
      await this.until(() => this.phone !== 'ringing' || this.now >= T2 + 12);
      if (this.phone !== 'ringing') return;
      // nobody answered: the line dies for good
      this.phone = 'dead';
      this.w.setInteractable('he6_phone', false);
      this.sfx('phone_dead_click', this.handsetPos(), 0.8);
      this.stamp('handset_dead');
    });
  }
  private answer(): void {
    if (this.phone !== 'ringing') return;
    this.phone = 'talking';
    this.stamp('answer');
    this.w.setInteractable('he6_phone', false);
    const sp = this.talk.speaking;
    if (sp === 'l6_aas_1') this.talk.cut();
    this.held = true;
    this.call('phone6', 'lift', this.handPoint());
    this.strip = null;
    this.S('answer', async () => {
      this.seqBusy = true;
      let e: number | false = this.now;
      try {
        e = await this.seqLine('l6_aas_2', this.now + 0.4, undefined, this.phoneAt);
        if (this.talk.heard.has('l6_aas_2')) this.once('aas');
        if (e === false) e = this.now;
        e = await this.seqLine('l6_reyes_aas', e + 0.5);
        if (e === false) e = this.now;
        e = await this.cutLine('l6_aas_3', e + 0.3, { where: this.phoneAt });
      } finally {
        this.seqBusy = false;
        // the line goes dead; the handset drops back onto its cord
        this.sfx('phone_dead_click', this.handsetPos(), 0.8);
        this.sfx('line_hiss', this.handsetPos(), 0.5);
        this.dropHandset(false);
        this.phone = 'done';
      }
      await this.hold(1.2);
      if (this.talk.heard.has('l6_aas_2')) await this.kesLater('l6_kes_aas', 20);
    });
  }
  /** The left hand's point (the handset follows it while held). */
  private handPoint(): THREE.Vector3 {
    const p = this.ctx.player;
    const fwd = p.forward.clone().setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    return p.eye.clone().addScaledVector(fwd, 0.28).addScaledVector(left, 0.2).setY(p.eye.y - 0.12);
  }
  private holdHandset(): void {
    // walking > 2 m from the station: the handset swings back on its cord, the rest plays from it
    if (this.distTo(this.mk('mk6_phone')) > 2.0) { this.dropHandset(true); return; }
    this.call('phone6', 'hold', this.handPoint());
  }
  private dropHandset(sound: boolean): void {
    if (!this.held) return;
    this.held = false;
    this.strip = null;
    this.call('phone6', 'drop');
    if (sound) this.sfx('handset_drop', this.handsetPos(), 0.8);
  }

  // ── §4.5 the queue, the crank → Key A, F4 ──

  private queueRead(): void {
    if (!this.inRoom('he6')) return;
    const f = FRAGMENTS6.note6_queue;
    this.openNote('note6_queue', f);
    if (!this.f.queue) {
      this.once('queue');
      this.S('queue_lines', async () => {
        await this.until(() => this.noteId !== 'note6_queue');
        await this.hold(1.0);
        const ok = await this.untilOr(() => this.awakeHostiles().length === 0 && this.channelFree() && !this.seqBusy && this.ctx.state === 'playing', 40);
        if (!ok || this.talk.heard.has('l6_reyes_queue')) return;
        let e = await this.seqLine('l6_reyes_queue', this.now);
        if (e === false) return;
        e = await this.seqLine('l6_kes_queue', e + 0.5);
        if (e === false) return;
        await this.seqLine(this.choiceId('l6_choir_queue'), e + 0.5);
      });
    }
  }
  protected override queueClosed(): boolean { return this.prog.read.includes('note6_queue') && this.noteId !== 'note6_queue'; }

  /** Start a grip (§8.3) — a held handset drops first (S11d); returns the run or null (refused at once). */
  private startGrip(id: string, point: THREE.Vector3, normal: THREE.Vector3, seconds: number, hold: boolean, motion: 'crank' | 'pull' | 'pump' | 'lever' | 'pin', start = 0, maxDist = 1.8): Grip | null {
    if (this.grip) return null;
    if (this.held) this.dropHandset(true);
    let h: GripHandle;
    try { h = this.ctx.player.grip({ id, point, normal, seconds, hold, motion, start, maxDist }); } catch (e) { console.warn('[story] grip failed', e); return null; }
    const g: Grip = { id, h, result: null };
    this.grip = g;
    void h.done.then((r) => { g.result = r; if (this.grip === g) this.grip = null; });
    return g;
  }
  private crank(): void {
    if (this.f.manual || this.grip) return;
    const hub = this.api('switch6')?.hub;
    const point = hub instanceof THREE.Vector3 ? hub.clone() : this.mk('mk6_switch');
    const g = this.startGrip('he6_switch', point, X_NEG, 3.0, true, 'crank', this.crankK);
    if (!g) return;
    this.S('crank', async () => {
      let turn = Math.floor(this.crankK * 5);
      await this.until(() => {
        const k = g.result === 'done' ? 1 : g.h.progress;
        this.crankK = Math.max(this.crankK, k);
        this.call('switch6', 'setProgress', this.crankK);
        const t = Math.floor(this.crankK * 5 + 1e-6);
        if (t > turn && t <= 5) { turn = t; this.sfx('crank_turn', point, 0.7); }
        return g.result !== null;
      });
      if (g.result === 'done') this.manualNow();
    });
  }
  /** The crank done: Key A, flag `manual`, beat `l6_manual` — one action (D5, B4). */
  private manualNow(): void {
    if (this.f.manual) return;
    this.ctx.player.addKey('key6_a');
    this.beat('l6_manual');
    this.stamp('manual');
    this.crankK = 1;
    this.toast(TOAST6.keyA);
    this.w.setInteractable('he6_switch', false);
    this.sfx('mode_clunk', this.mk('mk6_switch'), 0.9);
    this.call('switch6', 'setProgress', 1);
    this.screen('switch6', 'terminal_idle', SCREEN6.switchManual);
    this.screen('mimic6', 'mimic', SCREEN6.mimicManual);
    this.S('key_a_out', async () => {
      const t0 = this.now;
      await this.until(() => { const k = Math.min(1, (this.now - t0) / 0.6); this.call('switch6', 'keyOut', k); return k >= 1; });
    });
    this.S('manual_lines', async () => {
      const t0 = this.now;
      let uEnd = this.now + lineDuration('l6_unit_manual');
      void this.unit('l6_unit_manual', this.mk('mk6_switch'), (d) => { uEnd = this.now + d; });
      await this.until(() => this.now >= uEnd);
      const k = await this.seqLine('l6_kes_manual', uEnd + 0.4);
      await this.seqLine(this.choiceId('l6_choir_manual'), k === false ? Math.max(this.now, t0 + 1.0) : k + 0.4);
    });
    this.S('f4', async () => { await this.hold(4.0); await this.f4Wave(); });
  }
  /** F4: CHOIR answers the switch — through the vault from hold6 (B_hold, latched behind them). */
  private async f4Wave(): Promise<void> {
    if (this.f.f4) return;
    this.once('f4');
    this.stamp('f4');
    this.spawn('g6_he', true);
    this.S('out_g6_he', () => this.fightOut('g6_he', 60));
    await this.hold(0.4);
    this.openHold('g6_he');
    this.rush('g6_he', 30);
    this.S('kes_he_contact', () => this.kesLater('l6_kes_he_contact', 20));
  }
  /** `d6_hold` held open for a wave (B_hold), latched behind it (last member z < −148.6, or 10 s) — armed only past the doorway. */
  private openHold(group: string): void {
    this.holdGroups.add(group);
    this.set('holdOpen', true);
    const t0 = this.now;
    if (this.holdLatchRunning) return;
    this.holdLatchRunning = true;
    this.S('hold_latch', async () => {
      try {
        await this.hold(0.6);
        await this.until(() => this.now - t0 >= 10 || [...this.holdGroups].every((g) => this.members(g).every((e) => e.position.z < -148.6)));
        for (;;) {
          // (the latch waits for him: never while he is in hold6 or its doorway)
          await this.until(() => this.pos.z < -149.8 || this.ended || this.f.shaftOpen);
          // (phase K locks d6_hold itself: a latch failing there must never reopen it)
          if (this.f.shaftOpen || this.ended) break;
          const ok = await this.latch('d6_hold', () => this.pos.z < -148.6, 1.0, 1.0, 3.0);
          if (ok) break;
          await this.hold(2);
        }
        this.holdGroups.clear();
        this.set('holdOpen', false);
      } finally { this.holdLatchRunning = false; }
    });
  }

  // ── §4.6 the vault: Key A → the enclosure, the pull → Key B, the ring, F5, the thud; Key B → K ──

  private async vaultLine(): Promise<void> {
    if (this.talk.heard.has('l6_kes_vault') || this.f.pulled) return;
    await this.until(() => this.inTrig('t6_vault') && this.ctx.state === 'playing');
    await this.kesLater('l6_kes_vault', 20);
  }

  private deny(unitId: string, at: THREE.Vector3): void {
    this.sfx('interlock_deny', undefined, 0.7);
    void this.unit(unitId, at);
    this.toast(TOAST6.q, 30);
  }
  private insertKeyA(): void {
    if (this.f.bjOpen || this.grip) return;
    const at = this.mk('mk6_bj');
    if (!this.ctx.player.hasKey('key6_a')) { this.deny('l6_unit_deny_a', at); return; }
    const lp = this.api('bj6')?.lockPoint;
    const point = lp instanceof THREE.Vector3 ? lp.clone() : at;
    const g = this.startGrip('vault6_lock', point, Z_POS, 0.6, false, 'pin');
    if (!g) return;
    this.sfx('castell_turn', point, 0.8);
    this.S('key_a', async () => {
      await this.until(() => { this.call('bj6', 'unlock', g.result === 'done' ? 1 : g.h.progress); return g.result !== null; });
      if (g.result === 'done') this.bjOpenNow();
      else this.call('bj6', 'unlock', 0);
    });
  }
  /** Key A turned: trapped (`removeKey`) and `bjOpen` set — one action (B4); the doors part, the loom is usable. */
  private bjOpenNow(): void {
    if (this.f.bjOpen) return;
    this.ctx.player.removeKey('key6_a');
    this.once('bj_open');
    this.stamp('bj_open');
    this.call('bj6', 'unlock', 1);
    this.vig('bj6_open');
    this.screen('bj6', 'interlock', SCREEN6.bjOpen);
    this.w.setInteractable('vault6_lock', false);
    this.w.setInteractable('vault6_loom', true);
    this.S('kes_bj', () => this.kesLater('l6_kes_bj', 15));
  }
  private pull(): void {
    if (!this.f.bjOpen || this.f.pulled || this.grip) return;
    const lp = this.api('bj6')?.loomPoint;
    const point = lp instanceof THREE.Vector3 ? lp.clone() : this.mk('mk6_loom');
    const g = this.startGrip('vault6_loom', point, Z_POS, 3.0, true, 'pull', this.pullK);
    if (!g) return;
    this.S('pull', async () => {
      await this.until(() => {
        const was = this.pullK;
        const k = g.result === 'done' ? 1 : g.h.progress;
        this.pullK = Math.max(this.pullK, k);
        this.call('bj6', 'strain', this.pullK);
        for (const m of [0.3, 0.7]) if (was < m && this.pullK >= m) this.sfx('fibre_strain', point, 0.8);
        return g.result !== null;
      });
      if (g.result === 'done') this.pulledNow();
    });
  }
  /** The pull done: Key B, flag `pulled` (+ its clock), beat `l6_pulled` — one action (D5, B4). */
  private pulledNow(): void {
    if (this.f.pulled) return;
    this.ctx.player.addKey('key6_b');
    this.f.pullT = this.t;
    this.beat('l6_pulled');
    this.stamp('pulled');
    this.pullK = 1;
    this.toast(TOAST6.keyB);
    this.w.setInteractable('vault6_loom', false);
    this.vig('bj6_rip');
    this.call('bj6', 'takeKeyB');
    this.screen('bj6', 'interlock', SCREEN6.bjLos);
    this.screen('mimic6', 'mimic', SCREEN6.mimicPulled);
    this.screen('switch6', 'terminal_idle', SCREEN6.los);
    this.screen('queue6', 'manifest', SCREEN6.los);
    this.w.machine('ping6', 'active');                 // the buoy ping: 20 s → 4 s
    this.S('pull_lines', async () => {
      const at = this.mk('mk6_bj');
      await this.hold(0.3);
      let uEnd = this.now + lineDuration('l6_unit_pull');
      void this.unit('l6_unit_pull', at, (d) => { uEnd = this.now + d; });
      await this.until(() => this.now >= uEnd);
      let e = await this.seqLine('l6_kes_pull_1', uEnd + 0.5);
      if (e === false) e = this.now;
      const e2 = await this.seqLine('l6_kes_pull_2', e + 0.6);
      await this.seqLine(this.choiceId('l6_choir_pull'), (e2 === false ? e : e2) + 0.5);
    });
  }
  /** After the pull: the ring (+4 s), F5 (+5 s); the thud window (+20 … +90 s) is a scare rule. */
  private async afterPull(): Promise<void> {
    await this.until(() => this.f.pulled);
    const pullT = this.f.pullT;
    if (!this.prog.scares.includes('v6_ring')) {
      await this.until(() => this.t >= pullT + 4.0 || this.forced.has('f5'));
      if (!this.prog.scares.includes('v6_ring')) this.fireScare('v6_ring');   // the pull's own consequence (exempt)
    }
    if (this.f.f5) return;
    await this.until(() => this.t >= pullT + 5.0 || this.forced.has('f5'));
    await this.f5Wave();
  }
  private async f5Wave(): Promise<void> {
    if (this.f.f5) return;
    this.once('f5');
    this.stamp('f5');
    this.spawn('g6_vault', true);
    this.S('out_g6_vault', () => this.fightOut('g6_vault', 60));
    // the skitters: under the trench grilles — or from the vault's vent when he is in the trench
    const inTrench = this.inTrench();
    const sk = inTrench ? 'g6_vault_kv' : 'g6_vault_k';
    if (inTrench) {
      this.vig('vent6_vault');
      this.S('f5_k', async () => { await this.hold(0.4); this.spawn(sk, true); this.rouse(sk); await this.fightOut(sk, 60); });
    } else {
      this.spawn(sk, true);
      this.S('f5_k', async () => {
        await this.hold(0.4);
        for (const n of [1, 2, 3]) this.vig(`grille6_${n}`);
        this.rouse(sk);
        await this.fightOut(sk, 60);
      });
    }
    await this.hold(0.4);
    this.openHold('g6_vault');
    this.rush('g6_vault', 30);
  }
  private insertKeyB(): void {
    if (this.f.shaftOpen || this.grip) return;
    const at = this.mk('mk6_shaft_lock');
    if (!this.ctx.player.hasKey('key6_b')) { this.deny('l6_unit_deny_b', at); return; }
    const kp = this.api('shaft6')?.keyPoint;
    const point = kp instanceof THREE.Vector3 ? kp.clone() : at;
    const g = this.startGrip('shaft6_lock', point, X_POS, 0.6, false, 'pin');
    if (!g) return;
    this.sfx('castell_turn', point, 0.8);
    this.S('key_b', async () => {
      await this.until(() => { this.call('shaft6', 'unlock', g.result === 'done' ? 1 : g.h.progress); return g.result !== null; });
      if (g.result === 'done') this.shaftNow();
      else this.call('shaft6', 'unlock', 0);
    });
  }
  /** Key B turned: trapped and `shaftOpen` set — one action (B4); phase K; the loader spawned in `working` (D31). */
  private shaftNow(): void {
    if (this.f.shaftOpen) return;
    this.ctx.player.removeKey('key6_b');
    this.beat('l6_shaft_open');
    this.stamp('shaft_open');
    if (this.prog.launchAt === null && this.f.pulled) this.prog.launchAt = this.f.pullT + 90;   // (the thud can no longer come)
    this.spawnLoader();
    this.call('shaft6', 'unlock', 1);
    this.screen('shaft6_panel', 'interlock', SCREEN6.shaftOpen);
    this.w.setInteractable('shaft6_lock', false);
    void this.unit('l6_unit_shaft', this.mk('mk6_shaft_lock'));
  }

  // ── §4.7 the shaft ──

  private shaftLights(): void {
    if (this.f.lights6) return;
    this.once('lights6');
    this.shaftLightsAt = this.now;
    this.fireScare('v6_shaft_lights');
    this.S('f6', async () => {
      await this.hold(1.0);
      if (this.spawnedGroups.has('g6_shaft')) return;
      this.spawn('g6_shaft', true);
      this.rush('g6_shaft', 20);
      await this.fightOut('g6_shaft', 60);
    });
    this.S('kes_shaft', async () => { await this.hold(4.4); await this.kesLater('l6_kes_shaft', 4); });
  }

  // ───────────────────────────────────────────────────────────── Q (§6.2)

  /** Q: the ack, then the context line. Cooldown 5 s; ignored while a note, a grip or a sequence holds the radio. */
  radioAsk(): boolean {
    if (!this.radioOwned() || this.ended || this.noteOpen || this.grip || this.bossGripNow() || this.seqBusy || this.ctx.state !== 'playing') return false;
    if (this.now - this.lastQ < 5) return false;
    this.lastQ = this.now;
    this.S('q', async () => {
      const ok = await this.say('l6_kes_ack', { pri: 'scene', now: true, gap: 0.3 });
      if (!ok || this.ended) return;
      const r = this.w.room();
      const poolShaft = r === 'pool6' || r === 'shaft6';
      if (!poolShaft && this.hostileWithin(25)) { await this.say('l6_kes_busy', { pri: 'scene' }); return; }
      await this.say(this.hintId(), { pri: 'scene' });
    });
    return true;
  }
  private hintId(): string {
    const f = this.f;
    const b = this.bossFacts();
    if (f.shaftOpen) {
      const h = this.bossHint();
      if (h) return h;
      if (b.endingPending) return 'l6_kes_hint_console';
      if (f.trunkCut && b.loaderAlive) return 'l6_kes_hint_loader';
      return 'l6_kes_hint_frame';
    }
    if (f.pulled) return 'l6_kes_hint_shaft';
    if (f.manual) return 'l6_kes_hint_bj';
    return this.inHeVault() ? 'l6_kes_hint_switch' : 'l6_kes_hint_he';
  }

  // ───────────────────────────────────────────────────────────── scares (§5.7, the route's #1–#7)

  private scareRules(step: number): void {
    const f = this.f;
    const has = (id: string) => this.prog.scares.includes(id);
    if (this.bossNoScare()) return;
    // 2 the tent: in view ≤ 8 m for 0.5 s (the job card's pole stands at its open north side)
    if (!has('v6_tent') && this.inRoom('rep6')) {
      const tent = this.w.interactablePos('note6_jobcard') ?? this.mk('mk6_vent_rep');
      this.tentLook = this.sees(tent, 8, 50) ? this.tentLook + step : 0;
      if (this.tentLook >= 0.5 && this.scareOk('v6_tent')) this.fireScare('v6_tent');
    } else this.tentLook = 0;
    // 3 the handset: calm, feet in t6_phone or ≥ 25 s in he6, no sequence line (and before the boat can have left)
    if (!f.handset && f.he && !this.seqBusy && this.channelFree() && (this.inTrig('t6_phone') || this.inFor('he6') >= 25)
      && !f.thud && (!f.pulled || this.t < f.pullT + 15) && this.scareOk('v6_handset')) this.startCall();
    // 4 the drum: CD2 in view ≤ 12 m for 1 s, ≥ 4 s in the vault
    if (!has('v6_drum') && this.inRoom('vault6') && this.inFor('vault6') >= 4) {
      this.drumLook = this.sees(this.mk('mk6_drum'), 12, 50) ? this.drumLook + step : 0;
      if (this.drumLook >= 1 && this.scareOk('v6_drum')) this.fireScare('v6_drum');
    } else this.drumLook = 0;
    // 6 the thud: only within pull + 20 … + 90 s, in vault6 / he6, before Key B (else never — S4, S10d)
    if (!f.thud && f.pulled && !f.shaftOpen && this.t >= f.pullT + 20 && this.t <= f.pullT + 90
      && ['vault6', 'he6'].includes(this.w.room() ?? '') && !this.inTrench() && this.scareOk('v6_thud')) this.thudNow();
    // 7 the shaft lamps: first below L1 with no hostile within 20 m (exempt from spacing; it carries F6 and cp6_shaft)
    if (!f.lights6 && f.shaftOpen && this.inTrig('t6_shaft_l1') && !this.hostileWithin(20) && !this.noteOpen) this.shaftLights();
  }
  private thudNow(): void {
    if (this.f.thud) return;
    this.fireScare('v6_thud');
    this.once('thud');
    this.thudAt = this.now;
    this.prog.launchAt = this.t;                       // D16: the moment he heard the launch through the hull
    this.S('kes_thud', async () => { await this.hold(1.2); await this.kesLater('l6_kes_thud', 1.8); });
  }

  // ───────────────────────────────────────────────────────────── barks (§6.2 soldier lines, 3c's gate)

  private barkRules(): void {
    if (this.now - this.lastBark < 20 || this.seqBusy || !this.channelFree()) return;
    const sp = this.talk.speaking;
    if (sp && line6(sp)?.speaker === 'kessler') return;
    const rows = this.soldierRows();
    const all = this.ctx.enemies.all;
    let pick: { base: string; e: { id: number; position: THREE.Vector3 }; b: Bark6 } | null = null;
    for (const r of rows) {
      const e = all.find((x) => x.id === r.id);
      if (!e || !e.alive || r.holding) continue;
      const dist = this.distTo(e.position);
      const head = e.position.clone().setY(e.position.y + 1.6);
      const sees = typeof r.sees === 'boolean' ? r.sees : this.los(head);
      if (sees && !this.sawPlayer.has(e.id)) { this.sawPlayer.add(e.id); this.downDue.set(e.id, this.now + 3); }
      if (sees) this.lastSaw.set(e.id, this.now);
      const hit = this.now - (this.hitAt.get(e.id) ?? -1e9) <= 3;
      const felt = this.soldierDeaths.some((d) => this.now - d.t <= 4 && d.p.distanceTo(e.position) <= 20);
      // (ST-b: lost sight ≥ 3 s with a last-known position — the soldier still aware of him)
      const seenAt = this.lastSaw.get(e.id);
      const lostFor = !sees && r.aware && seenAt !== undefined ? this.now - seenAt : 0;
      const b = { id: e.id, dist, sees, hitRecently: hit, felt, lostFor };
      let base: string | null = null;
      if (hit && sees && dist <= 15) base = 'l5_sol_need';
      else if (felt && sees && dist <= 15) base = 'l5_sol_felt';
      else if (sees && dist <= 25 && this.facts.darkWithLight) base = 'l5_sol_light';
      else if (sees && dist <= 15 && this.facts.wastingRounds) base = 'l5_sol_rounds';
      else if (sees && dist <= 15 && (this.downDue.get(e.id) ?? -1e9) >= this.now) base = 'l5_sol_down';
      // (ST-b: the three level-6 pairs, §6.2 — their rules exist only when their lines do)
      else if (sees && dist <= 30 && this.inTrig('t6_cage') && RULES6.l6_sol_frame_stop) base = 'l6_sol_frame';
      else if (sees && dist >= 15 && this.f.shaftOpen && !this.f.pin && RULES6.l6_sol_reach_stop) base = 'l6_sol_reach';
      else if (lostFor >= 3 && lostFor <= 12 && RULES6.l6_sol_lost_stop) base = 'l6_sol_lost';
      if (base) { pick = { base, e, b }; break; }
    }
    if (!pick) return;
    const id = this.choiceId(pick.base);
    this.bark = pick.b;
    const at = () => { const x = all.find((q) => q.id === pick!.e.id); return x ? x.position.clone().setY(x.position.y + 1.6) : null; };
    void this.say(id, { pri: 'bark', cooldown: 20, at, onStart: () => { this.lastBark = this.now; this.downDue.delete(pick!.e.id); } });
  }

  // ───────────────────────────────────────────────────────────── reactions

  private onAlerted(id: number): void {
    if (!this.started || this.ff) return;
    const e = this.ctx.enemies.all.find((x) => x.id === id);
    if (!e) return;
    // the soldier module released itself (damage, a near miss, sight within 6 m): the story mirrors it
    if (e.group === 'g6_tun_s' && !this.f.f1Free) this.releaseF1('self');
    if (e.group === 'g6_tunb_s' && !this.f.f3Free) this.releaseF3('self');
    if (e.type === 'soldier') this.downDue.set(e.id, this.now + 3);
  }
  private onEnemyDamaged(id: number): void {
    if (!this.started || this.ff) return;
    const e = this.ctx.enemies.all.find((x) => x.id === id);
    if (!e) return;
    if (e.type === 'soldier') this.hitAt.set(id, this.now);
    if (e.group === 'g6_tun_s' && !this.f.f1Free) this.releaseF1('damaged');
    if (e.group === 'g6_tunb_s' && !this.f.f3Free) this.releaseF3('damaged');
  }
  private onEnemyDied(type: string, p: THREE.Vector3): void {
    if (!this.started || this.ff) return;
    if (type === 'soldier') this.soldierDeaths.push({ p: p.clone(), t: this.now });
    if (this.soldierDeaths.length > 20) this.soldierDeaths.shift();
  }

  protected onInteract(id: string): void {
    if (!this.started || this.ended || this.ctx.debug.noStory) return;
    if (this.bossInteract(id)) return;
    const f = this.f;
    switch (id) {
      case 'he6_switch': this.crank(); return;
      case 'he6_phone': this.answer(); return;
      case 'note6_queue': this.queueRead(); return;
      case 'vault6_lock': this.insertKeyA(); return;
      case 'vault6_loom': this.pull(); return;
      case 'shaft6_lock': this.insertKeyB(); return;
      case 'hatch6_vault':
        if (f.hatchVault) return;
        this.vig('hatch6_vault_open');
        this.once('hatch_vault');
        this.w.setInteractable('hatch6_vault', false);
        return;
      case 'hatch6_he':
        // (the level's eye gate refuses it from above; the story re-checks the eye — 3c S1j)
        if (f.hatchHe || this.ctx.player.eye.y >= -0.2) return;
        this.vig('hatch6_he_open');
        this.once('hatch_he');
        this.w.setInteractable('hatch6_he', false);
        this.w.setInteractable('hatch6_he_plate', false);
        return;
    }
    const frag = FRAGMENTS6[id];
    if (!frag) return;
    const room = READ_ROOM6[id];
    if (room && !this.inRoom(room)) return;
    this.openNote(id, frag);
  }

  private onDenied(id: string): void {
    if (!this.started || !this.live) return;
    // the stair door itself (its interlock is the barrel beside it)
    if (id === 'd6_shaft' && !this.f.shaftOpen && !this.ctx.player.hasKey('key6_b')) void this.unit('l6_unit_deny_b', this.mk('mk6_shaft_lock'));
    if (id === 'd6_tube' && this.f.tubeLatched) this.screen('tube_panel6', 'terminal_idle', SCREEN6.tubeClosed);
  }
  private onPickup(kind: string): void {
    if (!this.started) return;
    if (kind === 'vest') this.toast(TOAST6.vest);
    if (kind === 'plate') this.toast(TOAST6.plate);
  }

  /** Every 0.2 s: the crouch toast at the trench stairs (standing). */
  protected override afterObjective(): void {
    if (!this.live || this.ctx.state !== 'playing') return;
    const pl = this.ctx.player;
    if (this.inTrig('t6_trench') && pl.eye.y - pl.position.y > 1.3) this.toast(TOAST6.crouch, 8);
  }

  /** `?nostory=1` (§3): the level's nostory phase; screens as at load. */
  openEverything(): void {
    this.baseline();
    applyPhase6(this.ctx, 'nostory', { snap: true });
  }

  // ───────────────────────────────────────────────────────────── review / debug (H3, H7, H13, H16, H17)

  /** H3: force a gate or a beat with its real consequences; a vignette id (and `id:snap`) is fired as is. */
  fire(name: string): unknown {
    const f = this.f;
    const go = (n: string, fn: () => Promise<unknown> | void) => { this.S('fire_' + n, async () => { await fn(); }); return n; };
    switch (name) {
      case 'tube': if (f.tubeOpen) return null; this.forced.add('tube'); return 'tube';
      case 'latch': if (!f.tubeOpen || f.tubeLatched) return null; this.forced.add('latch'); return 'latch';
      case 'crossing': if (!f.tubeLatched || f.f1 || f.f1Cancelled) return null; this.forced.add('crossing'); return 'crossing';
      case 'f1':
        if (!f.tubeLatched || f.f1Cancelled) return null;
        this.forced.add('f1');
        if (f.f1 && !f.f1Free) this.releaseF1('fire');
        return 'f1';
      case 'f2': if (!f.tubeLatched) return null; this.forced.add('f2'); return go('f2', () => this.f2Wave());
      case 'f3': if (!f.tubeLatched) return null; this.forced.add('f3'); return go('f3', () => this.f3Walk());
      case 'release_f3': if (!f.f3) return null; this.forced.add('release_f3'); this.releaseF3('fire'); return 'release_f3';
      case 'handset': if (f.handset) return null; this.startCall(); return 'handset';
      case 'answer':
        if (this.phone === 'idle' && !f.handset) this.startCall();
        if (this.phone !== 'ringing') return null;
        return go('answer', async () => { await this.until(() => this.phone !== 'ringing' || this.now >= (this.marks.handset ?? this.now) + 2.5); this.answer(); });
      case 'queue':
        if (!f.queue) this.once('queue');
        if (!this.prog.read.includes('note6_queue')) this.prog.read.push('note6_queue');
        this.S('fire_queue', async () => {
          if (this.talk.heard.has('l6_reyes_queue')) return;
          let e = await this.seqLine('l6_reyes_queue', this.now + 0.2); if (e === false) return;
          e = await this.seqLine('l6_kes_queue', e + 0.5); if (e === false) return;
          await this.seqLine(this.choiceId('l6_choir_queue'), e + 0.5);
        });
        return 'queue';
      case 'manual': if (f.manual) return null; this.cancelGrip(); this.manualNow(); return 'manual';
      case 'f4': if (!f.manual) return null; return go('f4', () => this.f4Wave());
      case 'bj': if (!f.manual || f.bjOpen) return null; this.cancelGrip(); this.bjOpenNow(); return 'bj';
      case 'pull': if (!f.bjOpen || f.pulled) return null; this.cancelGrip(); this.pulledNow(); return 'pull';
      case 'f5': if (!f.pulled) return null; this.forced.add('f5'); return go('f5', () => this.f5Wave());
      case 'thud': if (!f.pulled || f.shaftOpen || f.thud) return null; this.thudNow(); return 'thud';
      case 'shaft': if (!f.pulled || f.shaftOpen) return null; this.cancelGrip(); this.shaftNow(); return 'shaft';
      case 'shaft_lights': if (!f.shaftOpen || f.lights6) return null; this.shaftLights(); return 'shaft_lights';
      case 'he': if (f.he) return null; this.forced.add('he'); return 'he';
      default: {
        const b = this.bossFire(name);
        if (b) return b;
        if (['reveal', 'hostile', 'pin', 'pump', 'fire', 'ram_e', 'ram_w', 'pod', 'quiet', 'console'].includes(name)) return null;
        const base = name.replace(/:snap$/, '');
        const list = (this.ctx.level as unknown as { list?: () => { vignettes: string[] } }).list?.().vignettes ?? null;
        if (list && !list.includes(base)) return null;
        if (!list && !/^(v6_|bj6_|hatch6_|grille6_|vent6_|tun6_far_out|beacons6|lights_out6|loader_dead6)/.test(base)) return null;
        if (!this.w.vignette(name)) return null;
        if (!name.endsWith(':snap')) this.stamp(`vignette:${name}`);
        return name;
      }
    }
  }
  private cancelGrip(): void { try { this.grip?.h.cancel(); } catch { /* ignore */ } this.grip = null; }

  /** H16: drive a grip — `'done'` completes it, `'abandon'` cancels it, a number holds E for that many seconds (real progress). */
  gripHook(id: string, mode: 'done' | 'abandon' | number): boolean {
    const cur = () => this.grip ?? this.bossGripNow();
    if (!cur() || cur()!.id !== id) this.onInteract(id);
    const g = cur();
    if (!g || g.id !== id) return false;
    const dbg = (this.ctx.player as unknown as { debug?: { grip?: (c?: string) => unknown; gripHold?: (on?: boolean) => unknown } }).debug;
    if (mode === 'done') dbg?.grip?.('done');
    else if (mode === 'abandon') dbg?.grip?.('abandon');
    else if (typeof mode === 'number' && Number.isFinite(mode)) {
      dbg?.gripHold?.(true);
      this.S('grip_hold', async () => { await this.hold(Math.max(0, mode)); dbg?.gripHold?.(false); });
    }
    return true;
  }
  /** H17: the water at the feet. */
  wade(): { depth: number; cap: number; canCrouch: boolean; canJump: boolean; canSprint: boolean; rescued: number } {
    const p = this.ctx.player;
    let caps: { walk?: number; sprint?: number; jump?: number; crouch?: boolean } | null = null;
    try { caps = ((p as unknown as { debug?: { water?: () => { caps?: typeof caps } } }).debug?.water?.()?.caps) ?? null; } catch { caps = null; }
    return {
      depth: +(Number(p.wading) || 0).toFixed(3), cap: caps?.walk ?? 1, canCrouch: caps?.crouch ?? true,
      canJump: (caps?.jump ?? 1) > 0, canSprint: (caps?.sprint ?? 1) > 0, rescued: this.rescued,
    };
  }

  /** H13: the world as `--checkpoints` compares it before a death and after the load. */
  worldState(): Record<string, unknown> {
    const doors: Record<string, { open: boolean; locked: boolean; status: string | null }> = {};
    try {
      for (const d of this.ctx.level.doors) doors[d.id] = { open: d.isOpen, locked: d.locked, status: ((d as unknown as { status?: string | null }).status ?? null) };
    } catch { /* ignore */ }
    const lid = (n: string) => { const v = this.api(n)?.k; return typeof v === 'number' ? v >= 0.5 : false; };
    const lights: Record<string, boolean> = {};
    for (const g of LIGHT_GROUPS6) { try { const hs = this.ctx.render.lights.group(g); if (hs.length) lights[g] = hs.some((h) => h.enabled); } catch { /* ignore */ } }
    const screens: Record<string, string> = {};
    for (const id of ['tube_panel6', 'mimic6', 'queue6', 'switch6', 'bj6', 'shaft6_panel', 'dock_board', 'gauge6', 'console6']) screens[id] = this.screenText(id);
    let pickups: string[] = [];
    try { pickups = [...(this.ctx.player.snapshot().pickups ?? [])].filter((p) => p.startsWith('p6_')).sort(); } catch { /* ignore */ }
    let keys: string[] = [];
    try { keys = [...this.ctx.player.keys].sort(); } catch { /* ignore */ }
    const bw = this.bossWorld();
    return {
      doors, keys, hatches: { vault: this.f.hatchVault || lid('hatch6_vault'), he: this.f.hatchHe || lid('hatch6_he') }, lights,
      dark: this.darkRooms(), screens, pickups, groups: this.groupsState(), scares: [...this.prog.scares], flags: { ...this.f },
      torch: typeof this.ctx.player.flashlightCharge === 'number' ? +this.ctx.player.flashlightCharge.toFixed(3) : 1,
      boss: bw.boss, slots: bw.slots, frame: bw.frame, waves: bw.waves,
    };
  }
  /** Room ids covered by `regions.dark` (the soldiers' dark rule). */
  private darkRooms(): string[] {
    const out: string[] = [];
    try {
      const boxes = this.ctx.level.regions?.dark ?? [];
      for (const r of this.ctx.level.rooms) {
        const c = r.bounds.getCenter(new THREE.Vector3());
        const size = r.bounds.getSize(new THREE.Vector3());
        if (boxes.some((b) => b.containsPoint(c) && (b.max.x - b.min.x) >= size.x * 0.9 && (b.max.z - b.min.z) >= size.z * 0.9)) out.push(r.id);
      }
    } catch { /* ignore */ }
    return out.sort();
  }
  private groupsState(): Record<string, { spawned: boolean; alive: number; awake: number; holding: number; triggered: boolean }> {
    const out: Record<string, { spawned: boolean; alive: number; awake: number; holding: number; triggered: boolean }> = {};
    for (const g of [...GROUPS6, 'g6_loader', 'g6_w1', 'g6_w1_r', 'g6_w2', 'g6_w2_r', 'g6_w3', 'g6_w3_r', 'g6_w3_s', 'g6_w3_s_r']) {
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
    const g = this.grip ?? this.bossGripNow();
    const bd = this.bossDebug();
    let keys: string[] = [];
    try { keys = [...this.ctx.player.keys].sort(); } catch { /* ignore */ }
    return {
      level: 6, now: +this.now.toFixed(2), beats: [...this.prog.beats], t: { ...this.marks }, phase: this.phase, phaseApplied: this.phaseApplied,
      flags: { ...f }, checkpoints: [...this.prog.checkpoints], checkpoint: this.lastCheckpoint, restoredFrom: this.restoredFrom,
      calm: this.started && this.calm(), heard: [...this.talk.heard], missingMarkers: [...this.missingMarkers], loadout: this.loadout,
      arrival: this.arrival, ended: this.ended, scares: [...this.prog.scares], scareLog: this.scareLog.slice(), groups: this.groupsState(),
      spawnLog: this.spawnLog.slice(), strays: this.strays.slice(), radio: { owned: this.radioOwned(), live: this.now < this.radioUntil, label: this.held ? HANDSET_LABEL6 : RADIO_LABEL6 },
      // + stage 3d
      keys, grip: g ? { id: g.id, progress: +g.h.progress.toFixed(4), holding: g.h.holding } : null,
      frame: bd.frame, boss: bd.boss, launchAt: this.launchT(), ending: bd.ending,
      // extras
      pendingCheckpoint: this.pendingCheckpoint, clock: +this.t.toFixed(2), arrivalHour: this.arrivalHour, testHour: +this.clockHour().toFixed(5),
      objective: this.objective(), triggered: [...this.prog.triggered], cleared: [...this.prog.cleared], read: [...this.prog.read],
      visited: [...this.prog.visited], speaking: this.talk.speaking, seqBusy: this.seqBusy, live: this.live, started: this.started,
      mood: this.director.mood, blocked: this.started && this.checkpointBlocked(), rank: phaseRank6(this.phase), phone: this.phone, held: this.held,
      crankK: +this.crankK.toFixed(3), pullK: +this.pullK.toFixed(3), radioLine: isRadio6(line6(this.talk.speaking ?? '')),
    };
  }
}
