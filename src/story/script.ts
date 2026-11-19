/**
 * The Sublevel 3 script — REVISION 2 (docs/DESIGN.md): a slow burn. The first minutes hold no combat at
 * all; dread comes from vignettes, puppet "actors", PA lines, light and sound. Then the android in the
 * junction stands up.
 *
 * Structure: every beat is its own "thread" (async function) waiting on its own condition, so play in
 * any order can never stall the flow. Conditions combine level trigger events with room/position polls,
 * every lock has a guaranteed unlock path, and everything the level / enemies modules add in revision 2
 * (`level.vignette`, `enemies.actor`, new rooms, triggers, interactables) is optional at runtime.
 *
 * REVISION 3 (checkpoints): everything that must survive a reload lives in ONE serialisable record,
 * `prog` (beats / cue markers done, fragments read, flags, enemy groups triggered and cleared). Each beat
 * has (a) its trigger + scene — the thread, as before — and (b) an idempotent entry in `CONSEQUENCES`:
 * the lasting state it leaves behind (door locks, light groups, machines, screens, interactables). The
 * scene applies it through `beat()` / `once()`; loading a checkpoint applies the same entries for every
 * recorded marker (`fastForward`) with no scene at all — so the two can never drift apart. After a load
 * every thread is started as usual: its trigger is re-evaluated from `prog`, and every scene / scare / PA
 * line is guarded by its marker, so what happened before the checkpoint never fires again while what had
 * not happened yet still does.
 *
 * Pacing rules implemented by `cue()`:
 *   - one event at a time: after each scare a quiet window (10–30 s) must pass before the next;
 *   - never while a note is open, never during (or right after) combat;
 *   - scares are gated on where the player is AND where they are looking, so they are actually seen.
 */
import * as THREE from 'three';
import type { EnemyActor, GameContext, LoopHandle, PickupKind } from '../core/types';
import type { UIInternal } from '../ui/types';
import type { Sequencer } from './sequencer';
import type { MusicDirector } from './director';
import type { CameraRig } from './camera';
import { ALL_SCREENS, type World } from './world';
import {
  CHOIR, ELEVATOR_VOICE, FRAGMENTS, HALE_RECORDER_ID, OBJECTIVES, PROMPTS, SCREENS, TAG_ID, TOASTS, UNIT_LINES, UNIT_LINE_IDS, WAKE_PUMP,
  type Fragment, type Line,
} from './text';
import { hasSay, speak } from './voice';
import type { VoiceHandle } from '../core/types';
import { CHECKPOINT_IDS, emptyProgress, type CheckpointId, type Progress } from './save';

interface Hooks {
  setObjective(text: string): void;
  /** A checkpoint is due and the moment is calm: write the save (story/index.ts owns the storage). */
  checkpoint(id: CheckpointId): void;
  /** The ending was reached: the save is no longer wanted. */
  finished(): void;
  /** REVISION 4: hand over to level 2 (store level + loadout, reload). False = stay and show the ending. */
  handoff?(): boolean;
}

/** One-shot level vignettes that leave the room visibly changed (re-applied silently on load). */
const LASTING_VIGNETTES = ['med_arm_drop', 'quarters_locker_bang', 'quarters_curtain', 'sec_vent_drop', 'storage_canister', 'airlock_cycle'];

const EMERGENCY_GROUPS = ['corr_a_emergency', 'fab_emergency', 'gen_emergency', 'lobby_emergency'];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;

/** Where the corridor meets the junction (the silhouette crosses just beyond it). */
const JUNCTION_END = V(0, 1.5, -16.5);
/** Open floor at the far end of the fab hall with long sightlines from the entrance side (probed). */
const FAB_FIGURE_SPOTS = [V(-5, 0, -44), V(5, 0, -44.5), V(-10.5, 0, -44), V(0, 0, -49)];
/** Every scripted vignette id (DESIGN.md) — used by the `--scares` review mode. */
export const VIGNETTES = [
  'med_monitor_spike', 'med_arm_drop', 'corr_lights_chase', 'quarters_locker_bang', 'quarters_curtain',
  'sec_vent_drop', 'storage_canister', 'airlock_cycle', 'fab_conveyor_step', 'fab_arms_watch', 'gen_ripple',
  'pump_knock', 'pump_bubbles', 'lobby_tarp', 'elev_gate_rattle', 'gen_lever_throw',
] as const;
export const ACTOR_SCARES = ['corr_silhouette', 'quarters_figure', 'fab_skitter', 'fab_figure'] as const;

export class Script {
  // ── facts (set by persistent listeners; scripts poll them) ──
  /** THE progress record: plain JSON, the only story state a checkpoint stores (see ./save.ts). */
  private prog: Progress = emptyProgress();
  /** Fast lookup mirror of `prog.beats`. */
  private done = new Set<string>();
  /** True while a checkpoint's consequences are being applied (no scenes, no sound, no events). */
  private ff = false;
  /** Checkpoint this session was restored from (null: fresh run). */
  private restoredFrom: CheckpointId | null = null;

  // ── session-only facts (set by persistent listeners; scripts poll them) ──
  private woke = false;
  private started = false;
  private triggerAt = new Map<string, number>();
  private insideTrig = new Set<string>();
  private lastInElevator = -1e9;
  private triggeredAt = new Map<string, number>();
  private pickedUp = new Set<PickupKind>();
  private closedAt = new Map<string, number>();
  private roomTime = new Map<string, number>();
  private descending = false;
  private armsWatching = false;
  private toastCooldown = new Map<string, number>();
  private objectiveTimer = 0;
  private alarm: LoopHandle | null = null;

  // ── checkpoints ──
  private calmFor = 0;
  private lastCheckpoint: CheckpointId | null = null;
  /** Checkpoint that is due but waiting for a calm moment (debug / tests). */
  private pendingCheckpoint: CheckpointId | null = null;
  private elevLoop: LoopHandle | null = null;

  // ── pacing ──
  /** Script time before which no further scare may fire. */
  private quietUntil = 0;
  private lastCombat = -1e9;
  /** While set, music 'silence' may be held even with an active enemy (the first android standing up). */
  private silenceHold = -1e9;
  private noteId: string | null = null;
  private noteClosedReal = -1e9;
  private lastNoteId: string | null = null;
  private legacyReading = false;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private actors = new Set<EnemyActor>();

  constructor(
    private ctx: GameContext,
    private seq: Sequencer,
    private director: MusicDirector,
    private rig: CameraRig,
    private w: World,
    private logs: Set<string>,
    private hooks: Hooks,
  ) {
    const ev = ctx.events;
    ev.on('trigger:enter', (e) => { this.triggerAt.set(e.id, this.seq.time); this.insideTrig.add(e.id); });
    ev.on('trigger:exit', (e) => { this.insideTrig.delete(e.id); });
    ev.on('enemy:group-cleared', (e) => { if (!this.prog.cleared.includes(e.group)) this.prog.cleared.push(e.group); });
    ev.on('pickup', (e) => { this.pickedUp.add(e.kind); });
    ev.on('interact', (e) => this.onInteract(e.id));
    ev.on('door:denied', (e) => this.onDenied(e.id));
    ev.on('player:died', () => this.onDied());
    ev.on('weapon:empty', () => this.reloadHint());
    ev.on('weapon:fired', (e) => {
      try { if (this.ctx.player.weapons[e.weapon].clip <= 3) this.reloadHint(); } catch { /* ignore */ }
    });
  }

  // ───────────────────────────────────────────────────────────── small helpers

  private get ui(): UIInternal { return this.ctx.ui as UIInternal; }
  private get now(): number { return this.seq.time; }
  private get f(): Progress['flags'] { return this.prog.flags; }
  /** Has this beat / '#cue' marker happened (in this session or before the loaded checkpoint)? */
  private has(id: string): boolean { return this.done.has(id); }
  private loop(id: string, volume: number): LoopHandle | null {
    try { return this.ctx.audio.loop(id, { volume }); } catch { return null; }
  }
  private wait(s: number) { return this.seq.wait(s); }
  private until(p: () => boolean) { return this.seq.waitUntil(p); }
  /** `until(p)` with a timeout; resolves true when `p` became true. */
  private async untilOr(p: () => boolean, seconds: number): Promise<boolean> {
    const t0 = this.now;
    let ok = false;
    await this.until(() => (ok = p()) || this.now - t0 >= seconds);
    return ok;
  }

  /** Record a marker in the progress record and apply its lasting consequences (idempotent). */
  private mark(id: string): boolean {
    if (this.done.has(id)) return false;
    this.done.add(id);
    this.prog.beats.push(id);
    this.consequence(id);
    return true;
  }

  /**
   * A DESIGN.md beat happens now: recorded, its lasting consequences applied, `story:beat` emitted.
   * False when it already happened (also: before the loaded checkpoint) — the caller skips the scene.
   */
  private beat(id: string): boolean {
    if (!this.mark(id)) return false;
    if (this.ctx.debug.verbose) console.log(`[story] beat ${id} @${this.now.toFixed(1)}s`);
    this.ctx.events.emit('story:beat', { id });
    return true;
  }

  /** Internal run-once cue marker ('#id' in the record; not a DESIGN.md beat, so nothing is emitted). */
  private once(id: string): boolean {
    if (!this.mark('#' + id)) return false;
    if (this.ctx.debug.verbose) console.log(`[story] cue ${id} @${this.now.toFixed(1)}s`);
    return true;
  }

  /** Wake / spawn a level enemy group and remember that the fight was started. */
  private engage(group: string, how: 'wake' | 'spawn', stagger?: number): void {
    if (!this.prog.triggered.includes(group)) this.prog.triggered.push(group);
    this.triggeredAt.set(group, this.now);
    if (how === 'wake') this.w.wakeGroup(group, stagger); else this.w.spawnGroup(group);
  }

  // ───────────────────────────────────────────────────────────── lasting consequences

  /**
   * What each beat / cue leaves behind for good. Idempotent, silent, instant — no waits, no sound, no
   * text, no events: the scene around it lives in the beat's thread. Used by `mark()` when the beat
   * happens and by `fastForward()` when a checkpoint is loaded.
   */
  private readonly CONSEQUENCES: Record<string, () => void> = {
    // Security console: the fab access hold is released.
    hold_released: () => {
      this.f.holdReleased = true;
      this.w.unlock('d_fab_outer');
      this.w.screen('sec_console', 'terminal_idle', SCREENS.secConsoleDone);
    },
    armed: () => {
      this.f.armed = true;
      this.ui.setTorchHint?.(false);
    },
    // Security monitors after the vent dropped: one in static, one reporting motion in the junction.
    '#sec_motion': () => {
      this.w.screen('sec_monitor_2', 'static');
      this.w.screen('sec_monitor_3', 'terminal_alert', SCREENS.secMotion);
    },
    husk_wakes: () => { this.f.huskWoke = true; },
    fab_reveal: () => {
      this.f.fabRevealed = true;
      this.w.screen('fab_bigscreen', 'choir');
    },
    // Lock-out tag read: the pump room opens.
    lockout_found: () => {
      this.f.tagRead = true;
      this.w.unlock('d_pump');
    },
    key_taken: () => {
      this.f.keyTaken = true;
      this.f.tagRead = true;
      this.w.unlock('d_pump');
    },
    // Crossing back with the key: the arms follow the player until the breaker is closed.
    fab_return: () => { this.armsWatch(true); },
    // The breaker is closed: lever thrown for good, generator room lit, turbine running.
    power_restored: () => {
      this.f.power = true;
      this.w.setInteractable('gen_lever', false);
      this.armsWatch(false);
      this.w.vignette('gen_lever_throw'); // the level animates the lever only on this call
      this.w.lights('gen', { enabled: true, flicker: 'none', intensityScale: 1 });
      this.w.machine('gen_turbine', 'active');
    },
    // 1.3 s later the bus reaches the hall, the lobby, the lift — and Hale's terminal.
    '#power_hall': () => {
      const w = this.w;
      w.lights('fab', { enabled: true, flicker: 'none', intensityScale: 1 });
      w.lights('lobby', { enabled: true, flicker: 'fluorescent' });
      w.lights('elevator', { enabled: true, flicker: 'none' });
      w.screen('fab_bigscreen', 'terminal_idle', SCREENS.fabResume);
      w.screen('lobby_screen', 'terminal_idle', SCREENS.lobby);
      w.screen('elev_panel', 'terminal_idle', SCREENS.elevUp);
      w.screen('gen_terminal', 'terminal_idle', SCREENS.genBoot);
      w.setInteractable('log_gen', true);
    },
    choir_speaks: () => {
      for (const s of ALL_SCREENS) if (s !== 'gen_terminal') this.w.screen(s, 'choir');
    },
    // Hall lights die, beacons spin, the line runs — and the way out is open from this moment.
    elevator_ready: () => {
      const w = this.w;
      w.lights('fab', { enabled: false });
      for (const g of EMERGENCY_GROUPS) w.lights(g, { enabled: true, flicker: 'alarm' });
      w.machine('fab_arms', 'frenzy');
      w.machine('fab_conveyor', 'active');
      w.unlock('d_lobby');
      w.unlock('d_elev');
      w.setInteractable('elev_button', true);
      this.f.elevatorReady = true;
    },
    // The alarm runs from the ambush until the lift leaves (started once the world is audible).
    fab_ambush: () => { if (!this.ff) this.startAlarm(); },
  };

  private consequence(id: string): void {
    const fn = this.CONSEQUENCES[id];
    if (fn) { try { fn(); } catch (e) { console.warn(`[story] consequence ${id} failed`, e); } return; }
    // Cue markers named after a one-shot vignette with a lasting pose: the level owns the end state.
    if (this.ff && id.startsWith('#') && LASTING_VIGNETTES.includes(id.slice(1))) this.w.vignette(id.slice(1));
  }

  /** The state every run starts from (before any beat). */
  private baseline(): void {
    const w = this.w;
    w.unlock('d_storage');
    w.lock('d_fab_outer');
    w.lock('d_lobby');
    w.lock('d_elev');
    if (w.hasDoor('d_pump')) w.lock('d_pump');
    w.setInteractable('elev_button', false);
    w.setInteractable('log_gen', false);
  }

  /** The music mood the recorded progress implies (momentary silences before scares aside). */
  private baselineMood(): 'silence' | 'ambient' | 'tension' {
    if (this.f.power || this.has('fab_return')) return 'tension';
    if (this.has('pump_enter')) return 'ambient';
    if (this.f.fabRevealed) return 'tension';
    return this.has('#pa_wake') || this.f.armed ? 'ambient' : 'silence';
  }

  private startAlarm(): void {
    if (!this.alarm && !this.descending) this.alarm = this.loop('alarm_loop', 0.55);
  }

  /**
   * Load a checkpoint: adopt its progress record and apply the consequences of every recorded beat, in
   * the order they happened — no scenes, no CHOIR, no scares, no toasts, no `story:beat` events. Enemy
   * groups that were fought are deleted. Call before `start()` and before `player.restore()`.
   */
  fastForward(saved: Progress, from: CheckpointId, cleared: readonly string[]): void {
    const p = emptyProgress();
    p.beats = [...saved.beats];
    p.read = [...saved.read];
    p.visited = [...saved.visited];
    p.flags = { ...p.flags, ...saved.flags };
    p.triggered = [...new Set([...saved.triggered, ...cleared])];
    p.cleared = [...new Set([...saved.cleared, ...cleared])];
    p.checkpoints = [...saved.checkpoints];
    this.prog = p;
    this.done = new Set();
    this.restoredFrom = from;
    this.lastCheckpoint = from;
    this.ff = true;
    const lv = this.ctx.level as unknown as { settle?: (seconds?: number) => void; setSilent?: (on: boolean) => void };
    try {
      try { lv.setSilent?.(true); } catch { /* ignore */ }
      this.baseline();
      for (const id of p.beats) {
        if (this.done.has(id)) continue;
        this.done.add(id);
        this.consequence(id);
      }
      // Every fight that was started before the checkpoint is over (a checkpoint needs them dead).
      for (const g of p.triggered) {
        try { this.ctx.enemies.removeGroup(g); } catch (e) { console.warn(`[story] removeGroup ${g} failed`, e); }
        this.triggeredAt.set(g, -1e9);
      }
      // Set-pieces fired above (lever, vent grille, ...) jump straight to their end pose, silently.
      try { lv.settle?.(14); } catch (e) { console.warn('[story] level.settle failed', e); }
    } finally {
      this.ff = false;
      try { lv.setSilent?.(false); } catch { /* ignore */ }
    }
    // Fragments read before the checkpoint stay readable; their follow-ups are guarded by cue markers.
    for (const id of p.read) this.closedAt.set(id, -1e9);
    this.director.setMood(this.baselineMood());
  }

  /** A copy of the progress record for the save file. */
  snapshot(): Progress {
    return JSON.parse(JSON.stringify(this.prog)) as Progress;
  }

  private toast(text: string, cooldown = 0): void {
    const now = this.now;
    if (cooldown > 0 && (this.toastCooldown.get(text) ?? -1e9) > now - cooldown) return;
    this.toastCooldown.set(text, now);
    this.ctx.events.emit('story:toast', { text });
  }

  private sub(speaker: string, text: string, duration: number): void {
    this.ctx.events.emit('story:subtitle', { speaker, text, duration });
  }

  /**
   * One spoken line: the recorded voice through `audio.say` (subtitle text from the lines JSON, length
   * from the recording), or — line without an id — the old subtitle + synthesised voice.
   * Returns the seconds it takes.
   */
  private say(l: Line, speaker: string, position?: THREE.Vector3): number {
    if (l.id) return speak(this.ctx, l.id, { name: speaker, position, fallbackDuration: l.duration }).duration;
    this.sub(speaker, l.text, l.duration);
    try { this.ctx.audio.choirVoice(l.text, l.duration); } catch { /* ignore */ }
    return l.duration;
  }
  private recorder: VoiceHandle | null = null;

  /** CHOIR in person — every speaker and screen at once: subtitle + voice + a digital shudder. */
  private async choir(lines: Line[], glitch = 0.4): Promise<void> {
    this.quiet(lines.reduce((t, l) => t + l.duration + 0.5, 6));
    for (const l of lines) {
      const d = this.say(l, 'CHOIR');
      if (glitch > 0) this.w.glitch(glitch, 0.25);
      await this.wait(d + 0.5);
    }
  }

  /** CHOIR over the PA: a soft chime, a breath of silence, then one calm line. No glitching. */
  private async pa(lines: Line[]): Promise<void> {
    this.quiet(lines.reduce((t, l) => t + l.duration + 0.5, 7.5));
    this.w.play('pa_chime', undefined, 0.7);
    await this.wait(1.5);
    for (const l of lines) await this.wait(this.say(l, 'PA') + 0.5);
  }

  /** A service unit's broken, polite mutter. */
  private unitLine(key: keyof typeof UNIT_LINES, at: THREE.Vector3 | null): void {
    // Recorded: the staff member's voice through the unit treatment, from where the unit stands.
    // Without `audio.say` it is a subtitle only (the units mutter `husk_whisper` on their own).
    speak(this.ctx, UNIT_LINE_IDS[key], { name: '정비 유닛', position: at ? at.clone().setY(at.y + 1.5) : undefined, fallbackDuration: 3.6 });
  }

  /** Scripted head turn (drives player yaw/pitch directly; player.update applies them to the camera). */
  private look(point: THREE.Vector3, seconds: number, from?: THREE.Vector3): Promise<void> {
    const p = this.ctx.player;
    const eye = from ?? p.eye;
    const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
    const yaw1 = Math.atan2(-dx, -dz);
    const pitch1 = Math.atan2(dy, Math.hypot(dx, dz));
    const yaw0 = p.yaw, pitch0 = p.pitch;
    let dyaw = yaw1 - yaw0;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const t0 = this.now;
    return this.until(() => {
      const k = Math.min(1, (this.now - t0) / Math.max(0.01, seconds));
      const e = k * k * (3 - 2 * k);
      p.yaw = yaw0 + dyaw * e;
      p.pitch = pitch0 + (pitch1 - pitch0) * e;
      return k >= 1;
    });
  }

  private entered(trigger: string, since = -Infinity): boolean {
    const t = this.triggerAt.get(trigger);
    return t !== undefined && t >= since;
  }

  private inRoom(room: string): boolean { return this.w.room() === room; }
  private get pos(): THREE.Vector3 { return this.ctx.player.position; }

  private groupDone(g: string, since: number, minDelay = 4): boolean {
    if (this.prog.cleared.includes(g)) return true;
    return this.now - since > minDelay && this.w.alive(g) === 0;
  }

  /** A fight the story started is over (false for a group that was never started). */
  private fought(g: string, minDelay = 5): boolean {
    if (!this.prog.triggered.includes(g)) return false;
    return this.groupDone(g, this.triggeredAt.get(g) ?? -1e9, minDelay);
  }

  private ownsPistol(): boolean {
    try { return !!this.ctx.player.weapons.pistol?.owned; } catch { return false; }
  }

  private hasKey(): boolean {
    return this.pickedUp.has('keycard') || this.w.hasKey();
  }

  // ───────────────────────────────────────────────────────────── gaze helpers

  /** Angle (radians) between the view direction and the direction to `point`. */
  private angleTo(point: THREE.Vector3): number {
    const p = this.ctx.player;
    const d = this.tmp.copy(point).sub(p.eye);
    const len = d.length();
    if (len < 1e-3) return 0;
    return Math.acos(THREE.MathUtils.clamp(d.dot(p.forward) / len, -1, 1));
  }

  private los(point: THREE.Vector3): boolean {
    try { return this.ctx.physics.lineOfSight(this.ctx.player.eye, point); } catch { return true; }
  }

  /** The player is facing `point` (within `coneDeg` of the view axis) and, optionally, nothing static is in the way. */
  isLookingAt(point: THREE.Vector3, coneDeg = 25, needLos = false): boolean {
    return this.angleTo(point) <= coneDeg * DEG && (!needLos || this.los(point));
  }

  /** `point` is off-screen (outside `coneDeg`, default wider than the view frustum) or hidden behind geometry. */
  notLookingAt(point: THREE.Vector3, coneDeg = 64): boolean {
    return this.angleTo(point) > coneDeg * DEG || !this.los(point);
  }

  /** Resolves on the first frame `point` is off-screen/occluded (true), or after `timeout` seconds (false). */
  waitUntilLookingAway(point: THREE.Vector3, coneDeg = 64, timeout = 1e9): Promise<boolean> {
    return this.untilOr(() => this.notLookingAt(point, coneDeg), timeout);
  }

  private distTo(point: THREE.Vector3): number {
    const p = this.pos;
    return Math.hypot(p.x - point.x, p.z - point.z);
  }

  // ───────────────────────────────────────────────────────────── pacing

  private get noteOpen(): boolean {
    if (this.legacyReading) return true;
    try { return !!this.ui.noteOpen; } catch { return false; }
  }

  /** Nothing else is competing for the player's attention. */
  private free(): boolean {
    return this.ctx.state === 'playing' && !this.noteOpen && this.w.active() === 0 && this.now - this.lastCombat > 5;
  }

  /** Reserve `seconds` of quiet after an event. */
  private quiet(seconds: number): void {
    this.quietUntil = Math.max(this.quietUntil, this.now + seconds);
  }

  /**
   * Wait for the right moment for a scare: `where()` holds, the player is free (no note, no combat) and
   * the quiet window after the previous event has passed — all on the same frame. Resolves false if
   * `expire()` becomes true first (the moment has passed for good).
   */
  private async cue(where: () => boolean, expire?: () => boolean): Promise<boolean> {
    let ok = false;
    await this.until(() => {
      if (expire?.()) return true;
      ok = this.now >= this.quietUntil && this.free() && where();
      return ok;
    });
    return ok;
  }

  /** Make a figure disappear: silently if unseen, otherwise inside a quarter-second of darkness. */
  private async vanish(a: EnemyActor | null, lightGroup: string): Promise<void> {
    if (!a) return;
    this.actors.delete(a);
    let head: THREE.Vector3;
    try { head = a.position.clone().setY(a.position.y + 1.5); } catch { this.w.removeActor(a); return; }
    if (this.notLookingAt(head, 62)) { this.w.removeActor(a); return; }
    const restore = this.w.blackout(lightGroup);
    this.w.play('spark_zap', head, 0.35);
    await this.wait(0.14);
    this.w.removeActor(a);
    await this.wait(0.2);
    restore();
  }

  private actor(type: 'husk' | 'skitter', position: THREE.Vector3, yaw: number, pose?: string): EnemyActor | null {
    const a = this.w.actor(type, position, yaw, pose);
    if (a) this.actors.add(a);
    return a;
  }

  private dropActor(a: EnemyActor | null): void {
    if (!a) return;
    this.actors.delete(a);
    this.w.removeActor(a);
  }

  private armsWatch(on: boolean): void {
    if (this.armsWatching === on) return;
    // `fab_arms_watch` is a toggle on the level side; only flip our flag if the call went through.
    if (this.w.vignette('fab_arms_watch')) this.armsWatching = on;
  }

  // ───────────────────────────────────────────────────────────── per-frame

  tick(dt: number): void {
    if (!this.started) return;
    if (this.w.active() > 0) this.lastCombat = this.now;
    this.objectiveTimer -= dt;
    if (this.objectiveTimer > 0) return;
    const step = 0.2 - this.objectiveTimer;
    this.objectiveTimer = 0.2;
    const room = this.w.room();
    if (room) {
      this.visit(room);
      if (this.ctx.state === 'playing') this.roomTime.set(room, (this.roomTime.get(room) ?? 0) + step);
    }
    if (this.entered('t_gen')) this.visit('gen');
    if (room === 'elevator' || this.insideTrig.has('t_elevator')) this.lastInElevator = this.now;

    // Music 'silence' overrides the audio module's automatic combat switch — never let it outlast a fight.
    if (this.director.mood === 'silence' && this.w.active() > 0 && this.now > this.silenceHold && !this.descending) {
      this.director.setMood(this.f.fabRevealed ? 'tension' : 'ambient');
    }

    // The breaker lever: prompt follows what the player knows; it stays usable until power is back.
    if (!this.f.power) {
      const key = this.hasKey();
      this.w.setPrompt('gen_lever', key ? PROMPTS.leverKey : this.f.tagRead ? PROMPTS.leverLocked : PROMPTS.leverTag);
      this.w.setInteractable('gen_lever', true);
      this.w.setInteractable('log_gen', false);
    }
    this.hooks.setObjective(this.computeObjective());
    this.checkpoints(step);
  }

  private visit(room: string): void {
    if (!this.prog.visited.includes(room)) this.prog.visited.push(room);
  }

  // ───────────────────────────────────────────────────────────── checkpoints

  /**
   * The six auto-saves. `when` — the story moment has been reached; `valid` — the fight it must come
   * BEFORE has not started. Evaluated from state every tick (5 Hz), so a save that cannot be taken yet
   * (not calm) is simply deferred, and dropped for good once `valid` fails.
   */
  private readonly CHECKPOINTS: Record<CheckpointId, { when: () => boolean; valid: () => boolean }> = {
    // Pistol taken — before the android in the junction stands up.
    cp_armed: { when: () => this.f.armed, valid: () => !this.f.huskWoke && !this.f.fabRevealed },
    // In the airlock, about to enter the hall for the first time.
    cp_fab: { when: () => this.inRoom('airlock'), valid: () => !this.f.fabRevealed },
    // Lock-out tag read — before the pump room's first skitter.
    cp_lockout: { when: () => this.f.tagRead, valid: () => !this.has('pump_first_skitter') && !this.hasKey() && !this.f.power },
    // Key taken and the sump grate pair dead — before crossing the hall again.
    cp_key: { when: () => this.f.keyTaken && this.has('#pump_b_over'), valid: () => !this.has('fab_return') && !this.f.power },
    // Standing at the breaker with the key — before closing it.
    cp_breaker: {
      when: () => this.hasKey() && this.inRoom('gen') && this.distTo(this.w.interactablePos('gen_lever') ?? V(19.4, 0, -38)) < 5,
      valid: () => !this.f.power,
    },
    // The hall ambush (rack + sentry) is survived — before the lobby wakes.
    cp_lobby: { when: () => this.has('#fab_sentry'), valid: () => !this.has('#lobby_ambush') && !this.descending },
  };

  /**
   * Calm: in play, alive, on the ground, no note open, nothing hunting, no shots exchanged for a few
   * seconds, and every fight the story has started so far is over — never a save during a fight.
   */
  private calm(): boolean {
    const ctx = this.ctx, p = ctx.player;
    if (ctx.state !== 'playing' || !this.woke || this.descending || this.noteOpen) return false;
    if (!p.alive || p.health <= 0 || !p.controlsEnabled) return false;
    if (Math.abs(p.velocity.y) > 0.4) return false;
    if (this.w.active() > 0 || this.now - this.lastCombat < 3) return false;
    for (const g of this.prog.triggered) if (!this.fought(g, 8)) return false;
    return true;
  }

  private checkpoints(step: number): void {
    if (this.ctx.debug.noStory) return;
    const taken = this.prog.checkpoints;
    const lastIdx = this.lastCheckpoint ? CHECKPOINT_IDS.indexOf(this.lastCheckpoint) : -1;
    // The latest checkpoint whose moment has come (never an earlier one than the last save).
    let due: CheckpointId | null = null;
    for (let i = CHECKPOINT_IDS.length - 1; i > lastIdx; i--) {
      const id = CHECKPOINT_IDS[i];
      if (taken.includes(id)) continue;
      const c = this.CHECKPOINTS[id];
      if (c.when() && c.valid()) { due = id; break; }
    }
    this.pendingCheckpoint = due;
    if (!due || !this.calm()) { this.calmFor = 0; return; }
    this.calmFor += step;
    if (this.calmFor < 0.6) return;
    this.calmFor = 0;
    this.pendingCheckpoint = null;
    taken.push(due);
    this.lastCheckpoint = due;
    if (this.ctx.debug.verbose) console.log(`[story] checkpoint ${due} @${this.now.toFixed(1)}s`);
    try { this.hooks.checkpoint(due); } catch (e) { console.error('[story] checkpoint failed', e); }
  }

  /** The objective is always recomputed from state, never pushed by a beat. */
  private computeObjective(): string {
    if (!this.woke || this.descending) return OBJECTIVES.none;
    if (this.f.power) {
      if (this.f.elevatorReady && this.now - this.lastInElevator < 1.5) return OBJECTIVES.callElevator;
      return OBJECTIVES.reachElevator;
    }
    if (this.hasKey()) return this.inRoom('gen') ? OBJECTIVES.closeBreaker : OBJECTIVES.returnKey;
    if (this.f.tagRead) return this.inRoom('pump') ? OBJECTIVES.findHale : OBJECTIVES.findKey;
    if (this.f.fabRevealed) return this.prog.visited.includes('gen') ? OBJECTIVES.throwBreaker : OBJECTIVES.findPower;
    if (this.f.holdReleased) return this.f.armed ? OBJECTIVES.enterFab : OBJECTIVES.takePistol;
    if (this.f.sawFabHold) return this.inRoom('sec') ? OBJECTIVES.useConsole : OBJECTIVES.checkSecurity;
    return OBJECTIVES.findSomeone;
  }

  // ───────────────────────────────────────────────────────────── flow

  /**
   * Enforce the starting state and start every beat thread. Idempotent. After `fastForward()` the world
   * already holds the checkpoint's state: the same threads start, and each one finds in `prog` what is
   * behind it (its scene is skipped) and what is still ahead.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.restoredFrom) {
      // Loops that belong to the restored state (the world is audible from here on).
      if (this.has('fab_ambush')) this.startAlarm();
    } else {
      this.baseline();
      this.director.setMood('silence');
    }

    const S = (n: string, f: () => Promise<unknown>) => this.seq.spawn(n, f);
    S('med', () => this.medScares());
    S('pa_wake', () => this.paWake());
    S('corridor', () => this.corridorFirstDark());
    S('quarters', () => this.quarters());
    S('quarters_figure', () => this.quartersFigure());
    S('junction_hold', () => this.junctionHold());
    S('armed', () => this.armedAndVent());
    S('husk', () => this.huskWakes());
    S('storage', () => this.storage());
    S('airlock', () => this.airlock());
    S('fab_reveal', () => this.fabReveal());
    S('fab_figure', () => this.fabFigure());
    S('fab_first', () => this.fabFirstFight());
    S('gen', () => this.genRipple());
    S('lockout', () => this.lockoutFollowUp());
    S('fab_cross', () => this.fabCross());
    S('pump', () => this.pumpEnter());
    S('pump_skitter', () => this.pumpFirstSkitter());
    S('key', () => this.keyTakenBeat());
    S('fab_return', () => this.fabReturn());
    // Only after a load: a power-up sequence the checkpoint cut short picks up where it was.
    if (this.f.power && !this.has('#fab_sentry')) S('power', () => this.powerSequence(null));
    S('lobby', () => this.lobby());
    S('elev_gate', () => this.elevatorGate());
    S('elevator_fallback', () => this.elevatorFallback());
  }

  /** Opening: lying on the bed, the hold is released, eyes open. */
  async wakeCutscene(short: boolean): Promise<void> {
    const ctx = this.ctx, p = ctx.player, ui = this.ui, w = this.w;
    ui.setHudVisible(false);
    w.fade(1, 0);
    ui.eyelids?.(0, 0);
    ui.blur?.(16, 0);
    ctx.setState('cutscene');
    p.controlsEnabled = false;
    const sp = ctx.level.spawn;
    p.teleport(sp.position.clone(), sp.yaw, 1.32);
    this.rig.wake = { rise: 0, roll: 0.2, lying: this.rig.lyingPoint() };
    this.beat('wake');
    this.director.setMood('silence');
    await this.wait(0.05);
    ui.blackout?.(false, short ? 0.6 : 1.6);

    const monitor = (() => { try { return ctx.audio.loop('monitor_hum', { volume: 0.3 }); } catch { return null; } })();
    let blipping = true;
    this.seq.spawn('blips', async () => {
      // A flat, patient alarm from the infusion pump.
      for (let i = 0; i < 10 && blipping; i++) { w.play('alarm_blip', undefined, 0.28); await this.wait(1.4); }
    });

    if (!short) {
      await this.wait(1.4);
      this.say(WAKE_PUMP, '주입 펌프');
      w.fade(0.2, 1.8); ui.eyelids?.(0.28, 1.6);
      await this.wait(1.9);
      ui.eyelids?.(0, 0.22);
      await this.wait(0.7);
      ui.eyelids?.(0.62, 1.4); ui.blur?.(8, 2.4); w.fade(0.08, 1.5);
      await this.wait(2.0);
      ui.eyelids?.(0.12, 0.18);
      await this.wait(0.32);
    } else {
      await this.wait(0.6);
    }
    ui.eyelids?.(1, 1.0); ui.blur?.(0, short ? 1.5 : 3.2); w.fade(0, 1.6);
    await this.wait(short ? 0.4 : 1.2);

    // Sit up and look toward the door.
    const door = w.objectPos('med_terminal', new THREE.Vector3(0, 1.45, 0));
    door.y = Math.max(1.2, Math.min(1.8, door.y));
    const looking = this.look(door, short ? 2.0 : 3.2, sp.position.clone().setY(1.65));
    const rise = short ? 1.6 : 2.8;
    const t0 = this.now;
    await this.until(() => {
      const k = Math.min(1, (this.now - t0) / rise);
      if (this.rig.wake) this.rig.wake.rise = k;
      return k >= 1;
    });
    await looking;
    this.rig.wake = null;
    blipping = false;
    monitor?.setVolume(0.1, 3);
    await this.wait(0.3);

    p.controlsEnabled = true;
    ctx.setState('playing');
    this.afterWake(false);
  }

  /** Controls on. Also the autostart entry point. Only ONE hint here; the rest arrive in context. */
  afterWake(skipHints: boolean): void {
    this.woke = true;
    this.ctx.ui.setHudVisible(true);
    if (!this.restoredFrom) this.director.setMood('silence');
    this.quiet(6);
    this.hooks.setObjective(this.computeObjective());
    if (skipHints) return;
    this.seq.spawn('hints', async () => {
      await this.wait(2.5);
      // Only if the player hasn't already worked it out.
      const sp = this.ctx.level.spawn.position;
      if (this.distTo(sp) < 0.6) this.toast(TOASTS.move);
    });
  }

  private reloadHint(): void {
    if (!this.started || !this.once('hint_reload')) return;
    this.toast(TOASTS.reload);
  }

  // ───────────────────────────────────────────────────────────── act 1 — nobody is here

  /** Medical: the flat monitor shows two heartbeats; the arm slides off the gurney as you pass it. */
  private async medScares(): Promise<void> {
    await this.until(() => this.woke);
    const left = () => this.prog.visited.includes('junction') || (this.inRoom('corr_a') && this.pos.z < -3);
    await this.wait(5);
    if (await this.cue(() => this.inRoom('med'), left)) {
      if (this.once('med_monitor_spike')) { this.w.vignette('med_monitor_spike'); this.quiet(14); }
    }
    // Passing the gurney on the way to the door.
    if (await this.cue(() => this.inRoom('med') && this.pos.z < 4.2 && this.pos.z > 0.6, left)) {
      if (this.once('med_arm_drop')) { this.w.vignette('med_arm_drop'); this.quiet(12); }
    }
  }

  /** "Good morning, Technician Reyes." — right after the terminal says who authorised the hold. */
  private async paWake(): Promise<void> {
    await this.until(() => this.woke && (this.closedAt.has('log_med') || this.entered('t_med_exit') || this.inRoom('corr_a')));
    if (this.closedAt.has('log_med')) await this.wait(1.6);
    else await this.wait(0.8);
    await this.until(() => !this.noteOpen && this.ctx.state === 'playing');
    if (!this.once('pa_wake')) return;
    await this.pa(CHOIR.paWake);
    this.quiet(7);
    await this.wait(2);
    if (this.director.mood === 'silence') this.director.setMood('ambient');
  }

  /** Corridor: the lights die one by one toward you; something walks across the far end. */
  private async corridorFirstDark(): Promise<void> {
    if (this.has('corr_first_dark')) return;
    await this.until(() => this.woke && this.inRoom('corr_a'));
    if (!this.f.armed) this.ui.setTorchHint?.(true);
    const gone = () => this.f.huskWoke || this.f.fabRevealed;
    // Facing the junction end from more than 8 m away.
    const ok = await this.cue(
      () => this.inRoom('corr_a') && this.pos.z > -7.2 && this.pos.z < -0.8 && this.isLookingAt(JUNCTION_END, 26),
      gone,
    );
    if (!ok || !this.beat('corr_first_dark')) return;
    this.quiet(30);
    const prevMood = this.director.mood;
    this.director.setMood('silence');
    this.seq.spawn('torch_hint', async () => {
      await this.wait(1.8);
      if (!this.ctx.player.flashlightOn) this.toast(TOASTS.flashlight);
    });
    await this.corrSilhouette(true);
    await this.wait(6);
    if (this.director.mood === 'silence') this.director.setMood(prevMood === 'silence' ? 'ambient' : prevMood);
  }

  /** The lights chase + the figure crossing the junction (also used by the review mode). */
  private async corrSilhouette(withLights: boolean): Promise<void> {
    const w = this.w;
    let restore: (() => void) | null = null;
    if (withLights && !w.vignette('corr_lights_chase')) {
      // Fallback (level without vignettes): the whole corridor drops out for three seconds.
      w.play('power_down', undefined, 0.5);
      restore = w.blackout('corr_a');
    }
    await this.wait(0.5);
    // From the Security side to the Storage side, between the two doors — it never comes this way.
    const a = this.actor('husk', V(-2.7, 0, -15.4), -Math.PI / 2, 'idle');
    if (a) {
      try { a.setEyes(false); } catch { /* ignore */ }
      const walk = a.moveTo(V(2.7, 0, -15.4), 1.3).catch(() => undefined);
      // Half-way across, its head turns toward you and the eyes come on. It keeps walking.
      this.seq.spawn('silhouette_look', async () => {
        await this.wait(1.7);
        if (!this.actors.has(a)) return;
        try { a.lookAt(this.ctx.player.eye); a.setEyes(true); } catch { /* ignore */ }
      });
      // Arrived, timed out, or the player ran at it.
      await Promise.race([walk, this.wait(6), this.until(() => this.pos.z < -11.5)]);
      await this.vanish(a, 'junction');
    } else {
      await this.wait(2.6);
      w.play('husk_step', V(0, 0, -17), 0.7);
    }
    await this.wait(0.8);
    restore?.();
  }

  /** Crew quarters (optional, no enemies ever): notes, the locker, the curtain. */
  private async quarters(): Promise<void> {
    await this.until(() => this.woke && (this.inRoom('quarters') || this.entered('t_quarters')));
    this.beat('quarters');
    const gone = () => this.f.fabRevealed;
    const inQ = () => this.inRoom('quarters');

    this.seq.spawn('q_locker', async () => {
      // After the badges note — or after a good while in the room without reading it.
      await this.until(() => this.closedAt.has('note_quarters_badges') || (this.roomTime.get('quarters') ?? 0) > 40 || gone());
      await this.wait(1.4);
      if (!(await this.cue(inQ, gone)) || !this.once('quarters_locker_bang')) return;
      this.w.vignette('quarters_locker_bang');
      this.quiet(26);
    });

    this.seq.spawn('q_curtain', async () => {
      // "I'm not opening the curtain." — it closes by itself, behind you.
      await this.until(() => this.closedAt.has('note_quarters_bunk') || (this.roomTime.get('quarters') ?? 0) > 75 || gone());
      await this.wait(1.2);
      const curtain = this.w.objectPos('quarters_curtain', V(1e6, 0, 0));
      const known = curtain.x < 1e5;
      const t0 = this.now;
      const behind = () => inQ() && (!known || this.notLookingAt(curtain, 58) || this.now - t0 > 25);
      if (!(await this.cue(behind, gone)) || !this.once('quarters_curtain')) return;
      this.w.vignette('quarters_curtain');
      this.quiet(24);
    });

    await this.wait(3);
    if ((await this.cue(inQ, gone)) && this.once('quarters_breath')) {
      this.w.play('breath_far', this.quartersFigureSpot().setY(1.4), 0.5);
      this.quiet(8);
    }
  }

  /** The corner of the canteen where a unit stands with its face to the wall. */
  private quartersFigureSpot(): THREE.Vector3 {
    const marker = this.w.objectPos('quarters_figure', V(1e6, 0, 0));
    if (marker.x < 1e5) return marker.setY(0);
    // Room corner nearest the canteen table, away from the door (east wall, z = -6.5).
    const table = this.w.interactablePos('note_quarters_badges') ?? V(-8.2, 0, -4.2);
    const cx = table.x < -5.5 ? -8.85 : -2.15;
    const cz = table.z > -7 ? -3.65 : -10.35;
    return V(cx, 0, cz);
  }

  /**
   * Quarters: a unit stands in the canteen corner, facing the wall, eyes dark. Once the player has
   * really seen it, it is removed the moment it is off-screen. Come too close and the light blinks.
   */
  private async quartersFigure(): Promise<void> {
    if (!this.w.hasRoom('quarters') || this.has('#quarters_figure')) return;
    await this.until(() => this.woke && (this.inRoom('corr_a') || this.inRoom('quarters')));
    const gone = () => this.f.fabRevealed || this.f.huskWoke;
    const spot = this.quartersFigureSpot();
    const head = spot.clone().setY(1.55);
    // Face the nearer wall pair's corner.
    const yaw = Math.atan2(-(spot.x < -5.5 ? -1 : 1), -(spot.z > -7 ? 1 : -1));
    const a = this.actor('husk', spot, yaw, 'idle');
    if (!a) return;
    try { a.setEyes(false); } catch { /* ignore */ }
    let seen = 0, last = this.now, close = false;
    await this.until(() => {
      const dt = this.now - last; last = this.now;
      if (gone()) return true;
      if (!this.inRoom('quarters')) return false;
      if (this.isLookingAt(head, 20, true)) seen += dt;
      close = this.distTo(spot) < 3.3;
      return seen > 0.8 || close;
    });
    if (close && !this.notLookingAt(head, 62)) {
      await this.vanish(a, 'quarters');
    } else {
      await this.waitUntilLookingAway(head, 64);
      this.dropActor(a);
    }
    if (gone()) return;
    this.once('quarters_figure');
    this.quiet(18);
    await this.wait(1.5);
    if (this.inRoom('quarters')) this.w.play('breath_far', head, 0.35);
  }

  /** The fab door refuses: CHOIR, helpfully, says where the hold can be lifted. */
  private async junctionHold(): Promise<void> {
    await this.until(() => this.woke && this.f.sawFabHold);
    await this.wait(1.6);
    if (!(await this.cue(() => this.inRoom('junction') || this.inRoom('corr_a'), () => this.f.holdReleased))) return;
    if (!this.once('pa_hold')) return;
    this.quiet(12);
    await this.pa(CHOIR.paHold);
  }

  // ───────────────────────────────────────────────────────────── act 2 — they took them

  private onSecConsole(): void {
    const f = FRAGMENTS.term_sec_unlock;
    this.openNote('term_sec_unlock', f, false);
    if (!this.beat('hold_released')) return;
    this.w.play('door_unlock', V(0, 1.4, -20), 0.6);
    this.seq.spawn('hold_toast', async () => {
      await this.until(() => !this.noteOpen);
      await this.wait(0.5);
      this.toast(TOASTS.holdReleased);
    });
  }

  /** The pistol — then the vent grille drops, and nothing comes out. */
  private async armedAndVent(): Promise<void> {
    // Pistol taken from the locker — or (debug give=all) already owned when walking into Security.
    await this.until(() => this.woke && (this.f.armed || this.pickedUp.has('pistol') || (this.ownsPistol() && (this.inRoom('sec') || this.entered('t_sec')))));
    this.beat('armed');
    if (this.has('#sec_vent_drop')) return; // the grille already hangs open (before the loaded checkpoint)
    const w = this.w;
    const inSec = () => this.inRoom('sec');
    if (!this.f.huskWoke) this.director.setMood('silence');
    await this.wait(4.5);
    if (await this.cue(inSec, () => !inSec() || this.f.huskWoke)) {
      if (this.once('sec_vent_drop')) {
        if (!w.vignette('sec_vent_drop')) {
          const vent = w.objectPos('sec_vent', V(-7, 3.1, -17));
          w.play('metal_clang', vent, 0.9);
          w.shake(0.12);
        }
        this.quiet(16);
        // Nothing comes out. Let that sit.
        await this.wait(8);
        if (inSec() && !this.f.huskWoke) {
          w.screen('sec_monitor_2', 'static');
          await this.wait(0.6);
          if (this.once('sec_motion')) w.play('terminal_beep', w.objectPos('sec_console', V(-9.9, 1.2, -17)), 0.5);
        }
      }
    }
    await this.wait(2);
    if (this.director.mood === 'silence' && !this.f.huskWoke) this.director.setMood('ambient');
  }

  /** FIRST ENEMY: armed, back in the junction — the slumped android stands up. */
  private async huskWakes(): Promise<void> {
    await this.until(() => this.f.armed);
    const t0 = this.now;
    await this.until(() => this.f.huskWoke
      || (this.now - t0 > 5 && this.inRoom('junction') && !this.noteOpen && this.ctx.state === 'playing')
      || this.inRoom('airlock') || this.f.fabRevealed);
    if (this.beat('husk_wakes')) {
      const w = this.w;
      const spawn = w.spawns('g_junction')[0]?.position ?? null;
      // Music stays down until it is on its feet.
      this.director.setMood('silence');
      this.silenceHold = this.now + 7;
      this.engage('g_junction', 'wake');
      await this.wait(1.4);
      this.unitLine('junction', spawn);
      await this.untilOr(() => {
        try { return this.ctx.enemies.all.some((e) => e.group === 'g_junction' && (e.state === 'chase' || e.state === 'attack')); } catch { return true; }
      }, 5);
      this.silenceHold = -1e9;
      this.director.setMood(this.f.fabRevealed ? 'tension' : 'ambient');
    }
    if (this.has('#pa_husk')) return;
    await this.until(() => this.fought('g_junction', 6));
    this.quiet(8);
    await this.wait(6);
    if (!(await this.cue(() => true, () => this.f.fabRevealed)) || !this.once('pa_husk')) return;
    this.quiet(12);
    await this.pa(CHOIR.paHusk);
  }

  /** Storage (optional): Hale's plan on a clipboard; a canister tips off a shelf. */
  private async storage(): Promise<void> {
    if (this.has('#storage_canister')) return;
    await this.until(() => this.woke && (this.inRoom('storage') || this.entered('t_storage')));
    const inS = () => this.inRoom('storage');
    await this.wait(5);
    if (!(await this.cue(inS, () => this.f.power)) || !this.once('storage_canister')) return;
    this.w.vignette('storage_canister');
    this.quiet(20);
  }

  /** The decon lock cycles around you; a wet hand slaps the inner glass. */
  private async airlock(): Promise<void> {
    if (this.has('#airlock_cycle')) return;
    await this.until(() => this.woke && (this.inRoom('airlock') || this.entered('t_airlock')));
    await this.wait(0.9);
    if (!(await this.cue(() => this.inRoom('airlock'), () => this.f.fabRevealed)) || !this.once('airlock_cycle')) return;
    this.w.vignette('airlock_cycle');
    this.quiet(14);
  }

  // ───────────────────────────────────────────────────────────── act 3 — the hall

  private async fabReveal(): Promise<void> {
    if (this.has('fab_reveal')) return;
    await this.until(() => this.woke && (this.entered('t_fab_enter') || this.inRoom('fab')));
    if (!this.beat('fab_reveal')) return;
    const w = this.w;
    this.director.setMood('tension');
    this.quiet(30);
    await this.wait(1.6);
    // Far away, something small runs along the ceiling — only once the player is facing the hall.
    await this.untilOr(() => this.isLookingAt(V(0, 6, -40), 50), 5);
    void this.fabSkitter();
    await this.wait(5.5);
    await this.untilOr(() => this.free(), 12);
    w.glitch(0.5, 0.3);
    w.play('glitch', undefined, 0.4);
    await this.wait(0.8);
    await this.choir(CHOIR.fabReveal, 0.3);
    this.quiet(22);
  }

  private async fabSkitter(): Promise<void> {
    // Under the ceiling, close enough to read as a small dark shape with one red dot.
    const from = V(-9, 7.7, -38.5), to = V(9, 7.7, -40.5);
    const a = this.actor('skitter', from, -Math.PI / 2, 'ceiling');
    this.w.play('vent_scuttle', V(0, 7.5, -39.5), 0.5);
    if (!a) return;
    await Promise.race([a.moveTo(to).catch(() => undefined), this.wait(7)]);
    this.dropActor(a);
  }

  /**
   * Where the far figure stands: an open spot at the far end of the hall near a work light, picked so
   * there is a clear sightline from where the player is now (it must be seen), at least 13 m away.
   * Null when no candidate works from here.
   */
  private fabFigureSpot(): THREE.Vector3 | null {
    const marker = this.w.objectPos('fab_figure', V(1e6, 0, 0));
    if (marker.x < 1e5) return marker.setY(0);
    // In order of preference (nearest a work light first).
    for (const c of FAB_FIGURE_SPOTS) {
      if (this.distTo(c) <= 13) continue;
      if (!this.los(this.tmp2.set(c.x, 1.55, c.z)) || !this.los(this.tmp2.set(c.x, 0.5, c.z))) continue;
      return c.clone();
    }
    return null;
  }

  /** A unit stands motionless under a far work light. The lights blink. It is gone. */
  private async fabFigure(): Promise<void> {
    await this.until(() => this.f.fabRevealed);
    const gone = () => this.f.tagRead || this.f.power;
    let spot = V(0, 0, 0);
    const placed = await this.cue(() => {
      if (!this.inRoom('fab')) return false;
      const c = this.fabFigureSpot();
      if (!c) return false;
      spot = c;
      // Placed while the spot is outside the view (it is simply there when the player turns).
      return this.angleTo(this.tmp2.set(c.x, 1.5, c.z)) > 58 * DEG;
    }, gone);
    if (!placed) return;
    const head = spot.clone().setY(1.55);
    const a = this.actor('husk', spot, Math.atan2(-(this.pos.x - spot.x), -(this.pos.z - spot.z)), 'idle');
    if (!a) return;
    this.quiet(20);
    // The hall is dark: what the player finds is two motionless points of light at head height.
    try { a.setEyes(true); } catch { /* ignore */ }
    let seen = 0, last = this.now, near = false;
    const t0 = this.now;
    await this.until(() => {
      const dt = this.now - last; last = this.now;
      if (gone() || this.w.active() > 0) return true;
      if (this.isLookingAt(head, 16, true)) seen += dt;
      near = this.distTo(spot) < 9;
      return seen > 1.1 || near || this.now - t0 > 90;
    });
    if (seen > 1.1 && this.once('fab_figure')) {
      // Its head turns to you. Then the lights blink.
      try { a.lookAt(this.ctx.player.eye); } catch { /* ignore */ }
      await this.wait(0.7);
      await this.vanish(a, 'fab');
      this.quiet(22);
    } else if (near) {
      await this.vanish(a, 'fab');
    } else {
      await this.waitUntilLookingAway(head, 64, 20);
      await this.vanish(a, 'fab');
    }
  }

  /** The android at the bench stops working. */
  private async fabFirstFight(): Promise<void> {
    const bench = this.w.spawns('g_fab_first').find((s) => s.type === 'husk')?.position ?? V(-4.1, 0, -37.2);
    await this.until(() => this.f.fabRevealed && (
      this.entered('t_fab_mid') || (this.inRoom('fab') && (this.pos.z < -36 || this.distTo(bench) < 5.5)) || this.f.power));
    if (!this.beat('fab_first_fight')) return;
    this.engage('g_fab_first', 'wake', 0.5);
    await this.wait(1.2);
    if (this.w.alive('g_fab_first') > 0) this.unitLine('bench', bench);
  }

  private async genRipple(): Promise<void> {
    if (this.has('#gen_ripple')) return;
    await this.until(() => this.woke && (this.inRoom('gen') || this.entered('t_gen')));
    await this.wait(2);
    if (!(await this.cue(() => this.inRoom('gen'), () => this.f.power)) || !this.once('gen_ripple')) return;
    this.w.vignette('gen_ripple');
    this.quiet(10);
  }

  // ───────────────────────────────────────────────────────────── act 4 — the lock-out

  /** The lever without the key: read the tag. Never throws it. */
  private onLeverLocked(): void {
    this.openNote(TAG_ID, FRAGMENTS[TAG_ID], true);
    if (this.f.tagRead) { this.toast(TOASTS.leverLocked, 6); return; }
    this.beat('lockout_found');
  }

  /** After the tag: CHOIR, helpfully, says where Hale went. */
  private async lockoutFollowUp(): Promise<void> {
    if (this.has('#pa_lockout')) return;
    const w = this.w;
    await this.until(() => this.f.tagRead && !this.noteOpen);
    if (this.hasKey()) return;
    // Guaranteed path: a level without the pump room / key pickup hands the key over here.
    if (!w.hasRoom('pump') || !w.pickupSpawn('keycard')) {
      await this.wait(2);
      try { this.ctx.player.addKey('keycard'); } catch { /* ignore */ }
      return;
    }
    await this.wait(2.2);
    if (!(await this.cue(() => true, () => this.hasKey())) || !this.once('pa_lockout')) return;
    this.quiet(12);
    await this.pa(CHOIR.paLockout);
  }

  /** Crossing the hall to the pump room: the arms follow you; the conveyor steps when your back is turned. */
  private async fabCross(): Promise<void> {
    if (this.f.keyTaken || this.f.power) return;
    await this.until(() => this.f.tagRead && this.inRoom('fab'));
    if (this.f.keyTaken || this.f.power) return;
    this.armsWatch(true);
    const rack = this.w.spawns('g_fab_rack');
    const mid = V(0, 4.5, -38);
    if (rack.length) { mid.set(0, 0, 0); for (const s of rack) mid.add(s.position); mid.multiplyScalar(1 / rack.length); mid.y = 4.2; }
    const done = () => this.f.keyTaken || this.f.power;
    const ok = await this.cue(() => this.inRoom('fab') && this.pos.x < 4 && this.distTo(mid) > 3.5 && this.angleTo(mid) > 80 * DEG, done);
    if (ok && this.once('fab_conveyor_step')) {
      this.w.vignette('fab_conveyor_step');
      this.quiet(20);
    }
    await this.until(() => this.inRoom('pump') || this.f.power || this.has('fab_return'));
    if (!this.has('fab_return')) this.armsWatch(false);
  }

  private async pumpEnter(): Promise<void> {
    if (this.has('#pump_knock')) return;
    await this.until(() => this.woke && (this.inRoom('pump') || this.entered('t_pump')));
    // Wet, dark, quiet. Music drops back; combat switches itself.
    if (this.beat('pump_enter') && !this.f.power) this.director.setMood('ambient');
    const deep = () => this.has('pump_first_skitter');
    await this.wait(3);
    if (!(await this.cue(() => this.inRoom('pump'), deep)) || !this.once('pump_knock')) return;
    this.w.vignette('pump_knock');
    this.quiet(12);
  }

  /** First skitter — late, alone, and telegraphed. */
  private async pumpFirstSkitter(): Promise<void> {
    if (this.has('#pump_bubbles')) return;
    await this.until(() => this.woke && (this.has('pump_first_skitter') || this.entered('t_pump_deep') || (this.inRoom('pump') && this.pos.x < -17)));
    if (this.beat('pump_first_skitter')) this.engage('g_pump_a', 'spawn');
    await this.until(() => this.fought('g_pump_a', 5));
    await this.wait(5);
    // Something large moves under the water while you stand over Hale.
    if (!(await this.cue(() => this.inRoom('pump'), () => this.has('fab_return'))) || !this.once('pump_bubbles')) return;
    this.w.vignette('pump_bubbles');
    this.quiet(8);
  }

  /** Hale's key comes out of her fist — and the sump grate by the door lifts. */
  private async keyTakenBeat(): Promise<void> {
    await this.until(() => this.woke && (this.f.keyTaken || this.hasKey()));
    const w = this.w;
    if (this.beat('key_taken')) {
      if (w.hasRoom('pump') && this.prog.visited.includes('pump') && w.spawns('g_pump_b').length) {
        // Marked as started right away: no checkpoint in the breath before the grate lifts.
        if (!this.prog.triggered.includes('g_pump_b')) this.prog.triggered.push('g_pump_b');
        this.triggeredAt.set('g_pump_b', this.now + 2.5);
        await this.wait(1.8);
        const grate = w.spawns('g_pump_b')[0]?.position ?? V(-13.5, 0, -38);
        w.play('water_slosh', grate, 0.9);
        await this.wait(0.7);
        this.engage('g_pump_b', 'spawn');
      }
    }
    if (!this.has('#pump_b_over')) {
      const since = this.now;
      await this.until(() => !this.prog.triggered.includes('g_pump_b') || this.fought('g_pump_b', 5) || this.now - since > 150);
      this.once('pump_b_over'); // → checkpoint cp_key
    }
    if (this.has('#fab_conveyor_step_2')) return;
    await this.wait(4);
    if (this.f.power) return;
    if ((await this.cue(() => true, () => this.f.power || this.has('fab_return'))) && this.once('pa_key')) {
      this.quiet(10);
      await this.pa(CHOIR.paKey);
    }
    // Far off, through the wall: the line has moved one place while you were away.
    await this.wait(3);
    if (!this.f.power && !this.inRoom('fab') && this.once('fab_conveyor_step_2')) w.vignette('fab_conveyor_step');
  }

  /** Back across the hall with the key. */
  private async fabReturn(): Promise<void> {
    if (this.has('fab_return')) return;
    await this.until(() => this.woke && this.hasKey() && this.inRoom('fab') && (this.pos.x > -9.5 || !this.w.hasRoom('pump')));
    if (this.f.power || !this.beat('fab_return')) return;
    const w = this.w;
    this.director.setMood('tension');
    if (this.once('fab_conveyor_step_2')) w.vignette('fab_conveyor_step');
    // Started now (the skitter drops a few seconds after the husk stirs): no checkpoint in between.
    if (w.spawns('g_fab_return').length) {
      this.prog.triggered.push('g_fab_return');
      this.triggeredAt.set('g_fab_return', this.now + 4.5);
    }
    await this.wait(1.2);
    const husk = w.spawns('g_fab_return').find((s) => s.type === 'husk')?.position ?? null;
    w.wakeGroup('g_fab_return', 0.6);
    await this.wait(1.4);
    if (w.alive('g_fab_return') > 0) this.unitLine('returnHusk', husk);
    await this.wait(1.6);
    w.spawnGroup('g_fab_return');
  }

  // ───────────────────────────────────────────────────────────── act 5 — required

  /** The lever with the key: the breaker closes. There is no other way forward. */
  private async powerRestored(): Promise<void> {
    if (this.f.power) return;
    const w = this.w;
    this.ui.closeNote?.();
    this.beat('power_restored');
    // Anything still dormant in the hall comes alive with the bus.
    if (this.beat('fab_first_fight')) this.engage('g_fab_first', 'wake', 0.8);
    w.shake(0.35);
    this.toast(TOASTS.busLive);
    await this.powerSequence(null);
  }

  /**
   * Everything that follows the lever, as guarded steps: each one is skipped when its marker is already
   * in the progress record, so the sequence can also be resumed after a load.
   */
  private async powerSequence(speaking: Promise<void> | null): Promise<void> {
    const w = this.w;
    if (!this.has('#power_hall')) {
      await this.wait(1.3);
      // The whole hall lights up: the hanging line in full view, for a moment. Hale's terminal wakes.
      this.once('power_hall');
      w.play('metal_groan', V(0, 6, -38), 0.7);
      w.play('terminal_beep', w.interactablePos('log_gen') ?? V(12.4, 1.4, -35), 0.8);
    }
    if (!this.has('choir_speaks')) {
      await this.wait(3.0);
      this.beat('choir_speaks');
      w.glitch(1, 0.8);
      speaking = this.choir(CHOIR.powerRestored, 0.5);
      await this.wait(2.2);
    }
    if (!this.has('elevator_ready')) {
      // Lights die, beacons spin, the line starts moving.
      w.play('power_down', undefined, 0.9);
      w.lights('fab', { enabled: false });
      await this.wait(0.6);
      // The way out is open from this moment, whatever happens next.
      this.beat('elevator_ready');
    }
    if (!this.has('fab_ambush')) {
      // Hold the ambush until Hale's last entry has been read — or ~12 s have gone by.
      const genHas = !!this.ctx.interactables.get('log_gen');
      const t0 = this.now;
      const readingGen = () => this.noteOpen && this.noteId === 'log_gen';
      await this.until(() => {
        const t = this.now - t0;
        if (t > 26) return true;
        if (readingGen()) return false;
        if (this.closedAt.has('log_gen')) return this.now - (this.closedAt.get('log_gen') ?? 0) > 1.2;
        return t > (genHas ? 12 : 3) || !this.inRoom('gen');
      });
      if (speaking) await speaking;
      this.beat('fab_ambush');
      this.engage('g_fab_rack', 'wake', 1.2);
      this.seq.spawn('rack_line', async () => { await this.wait(2.5); if (this.inRoom('fab')) this.unitLine('rack', null); });
      this.director.setMood('tension');
    }
    if (!this.has('#fab_sentry')) {
      await this.wait(8);
      if (this.once('fab_sentry')) this.engage('g_fab_sentry', 'spawn');
    }
  }

  /** The lobby: one of the tarps shifts. Then it gets up. */
  private async lobby(): Promise<void> {
    if (this.has('#lobby_ambush')) return;
    await this.until(() => this.f.power && (this.entered('t_lobby') || this.inRoom('lobby')));
    if (!this.once('lobby_ambush')) return;
    this.w.vignette('lobby_tarp');
    await this.wait(2.2);
    this.engage('g_lobby', 'wake', 0.7);
  }

  /** Something hits the cage gate from the shaft side, once, before you touch the button. */
  private async elevatorGate(): Promise<void> {
    if (this.has('#elev_gate_rattle')) return;
    await this.until(() => this.f.elevatorReady && (this.inRoom('elevator') || this.insideTrig.has('t_elevator') || (this.inRoom('lobby') && this.pos.z < -56.2)));
    await this.wait(0.8);
    if (this.descending || this.noteOpen || !this.once('elev_gate_rattle')) return;
    this.w.vignette('elev_gate_rattle');
    this.w.shake(0.15);
  }

  /** If the level never registers `elev_button`, entering the cab after power still ends the level. */
  private async elevatorFallback(): Promise<void> {
    await this.until(() => this.f.power && !this.ctx.interactables.get('elev_button') && (this.entered('t_elevator') || this.inRoom('elevator')));
    await this.wait(2.5);
    this.seq.spawn('descent', () => this.descent());
  }

  // ───────────────────────────────────────────────────────────── act 6 — down

  private async descent(): Promise<void> {
    if (this.descending || !this.f.power) return;
    this.descending = true;
    const ctx = this.ctx, p = ctx.player, w = this.w;
    this.ui.closeNote?.();
    w.setInteractable('elev_button', false);
    ctx.setState('cutscene');
    p.controlsEnabled = false;
    this.hooks.setObjective('');
    this.beat('descent');
    for (const a of [...this.actors]) this.dropActor(a);
    // Make sure we're inside the cage before it shuts.
    if (p.position.z > -59) {
      p.teleport(new THREE.Vector3(THREE.MathUtils.clamp(p.position.x, -1.6, 1.6), 0, -60.4), p.yaw, p.pitch);
    }
    w.lock('d_elev');
    const panel = w.objectPos('elevator_cab', new THREE.Vector3(0, 1.4, -61));
    void this.look(new THREE.Vector3(0, 1.5, -57), 1.6); // look back at the gate as it shuts
    w.screen('elev_panel', 'terminal_idle', SCREENS.elevDepart);
    await this.wait(2.2);
    w.machine('elevator', 'active');
    this.elevLoop = this.loop('elevator_loop', 0.9);
    this.alarm?.stop(2);
    this.alarm = null;
    w.shake(0.25);
    this.director.hard('silence');
    await this.wait(3.2);
    void this.look(new THREE.Vector3(panel.x + 1.2, 1.45, -61.5), 1.4);
    w.screen('elev_panel', 'terminal_alert', SCREENS.elevDown);
    w.play('alarm_blip', undefined, 0.9);
    w.glitch(0.6, 0.4);
    await this.wait(1.2);
    await this.wait(this.say(ELEVATOR_VOICE, '엘리베이터') + 0.6);
    await this.choir(CHOIR.descent, 0.5);
    w.play('power_down', undefined, 1);
    w.lights('elevator', { enabled: false });
    w.shake(0.5);
    w.fade(1, 3.0);
    this.elevLoop?.stop(3.2);
    await this.wait(3.6);
    this.beat('end');
    try { this.hooks.finished(); } catch { /* ignore */ }
    // REVISION 4: the lift arrives at Line Two — the next page load is level 2.
    try { if (this.hooks.handoff?.()) return; } catch (e) { console.error('[story] handoff failed', e); }
    ctx.setState('ended');
    this.ui.setHudVisible(false);
    await ctx.ui.showEnding();
  }

  // ───────────────────────────────────────────────────────────── reactions

  private onInteract(id: string): void {
    if (!this.started || this.descending) return;
    if (id === 'term_sec_unlock') { this.onSecConsole(); return; }
    if (id === 'gen_lever') {
      if (this.f.power) return;
      if (this.hasKey()) this.seq.spawn('power', () => this.powerRestored());
      else this.onLeverLocked();
      return;
    }
    if (id === 'elev_button') { this.seq.spawn('descent', () => this.descent()); return; }
    if (id === 'log_gen' && !this.f.power) return;
    const f = FRAGMENTS[id];
    if (f) this.openNote(id, f, true);
  }

  /** Short fragments open as a compact note card; the world keeps running. */
  private openNote(id: string, f: Fragment, isRecord: boolean): void {
    // The same E press that closes a note must not immediately re-open it.
    if (this.noteId === id) return;
    if (this.lastNoteId === id && performance.now() - this.noteClosedReal < 350) return;
    if (isRecord) this.logs.add(id);
    if (!this.prog.read.includes(id)) this.prog.read.push(id);
    this.ctx.events.emit('story:log', { id, title: f.header, body: f.body });
    // Hale's recorder plays while its transcript is open (recorded voice only — no synthesised stand-in).
    if (f.style === 'voice' && id === 'log_pump' && hasSay(this.ctx)) {
      try { this.recorder?.stop(0.1); } catch { /* ignore */ }
      this.recorder = speak(this.ctx, HALE_RECORDER_ID, { subtitle: false, position: this.w.interactablePos(id) ?? undefined }).handle;
    }
    const done = () => {
      if (this.noteId !== id) return;
      this.noteId = null;
      this.lastNoteId = id;
      this.noteClosedReal = performance.now();
      this.closedAt.set(id, this.now);
    };
    this.noteId = id;
    const ui = this.ui;
    if (typeof ui.showNote === 'function') {
      ui.showNote(f.header, f.body, f.style).catch((e) => console.error('[story] showNote failed', e)).finally(done);
      return;
    }
    // Legacy UI without the note card: the pausing overlay.
    this.legacyReading = true;
    const prev = this.ctx.state;
    const pausable = prev === 'playing';
    if (pausable) this.ctx.setState('paused');
    ui.showLog(f.header, f.body).catch((e) => console.error('[story] showLog failed', e)).finally(() => {
      this.legacyReading = false;
      if (pausable && this.ctx.state === 'paused') this.ctx.setState(prev);
      done();
    });
  }

  private onDenied(id: string): void {
    if (!this.started) return;
    switch (id) {
      case 'd_fab_outer':
        this.f.sawFabHold = true;
        this.toast(TOASTS.fabHold, 4);
        break;
      case 'd_pump':
        this.toast(TOASTS.pumpLocked, 4);
        break;
      case 'd_lobby':
        if (!this.f.power) this.toast(TOASTS.noPower, 4);
        break;
      case 'd_elev':
        if (!this.f.power) this.toast(TOASTS.noPowerElev, 4);
        break;
    }
  }

  private onDied(): void {
    const ctx = this.ctx;
    if (ctx.state === 'ended' || ctx.state === 'dead') return;
    ctx.setState('dead');
    this.alarm?.stop(1.5);
    this.ui.closeNote?.();
    this.ui.setHudVisible(false);
    ctx.ui.showDeath().catch((e) => console.error('[story] showDeath failed', e));
  }

  // ───────────────────────────────────────────────────────────── review / debug

  /**
   * Fire one vignette or actor scare in place, ignoring pacing and gaze gates (for
   * `scripts/playthrough.mjs --scares`). Returns where to look, or null for unknown names.
   */
  fire(name: string): { x: number; y: number; z: number } | null {
    const at = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z });
    switch (name) {
      case 'corr_silhouette':
        this.seq.spawn('dbg', () => this.corrSilhouette(false));
        return at(JUNCTION_END);
      case 'quarters_figure': {
        const spot = this.quartersFigureSpot();
        const yaw = Math.atan2(-(spot.x < -5.5 ? -1 : 1), -(spot.z > -7 ? 1 : -1));
        const a = this.actor('husk', spot, yaw, 'idle');
        try { a?.setEyes(false); } catch { /* ignore */ }
        this.seq.spawn('dbg', async () => { await this.wait(6); this.dropActor(a); });
        return at(spot.setY(1.5));
      }
      case 'fab_skitter':
        this.seq.spawn('dbg', () => this.fabSkitter());
        return { x: 0, y: 7.7, z: -39.5 };
      case 'fab_figure': {
        const spot = this.fabFigureSpot() ?? FAB_FIGURE_SPOTS[0].clone();
        const a = this.actor('husk', spot, Math.atan2(-(this.pos.x - spot.x), -(this.pos.z - spot.z)), 'idle');
        try { a?.setEyes(true); } catch { /* ignore */ }
        this.seq.spawn('dbg', async () => {
          await this.wait(2.5);
          try { a?.lookAt(this.ctx.player.eye); } catch { /* ignore */ }
          await this.wait(2.5);
          await this.vanish(a, 'fab');
        });
        return at(spot.setY(1.5));
      }
    }
    if ((VIGNETTES as readonly string[]).includes(name)) {
      if (name === 'fab_arms_watch') this.armsWatching = !this.armsWatching;
      return this.w.vignette(name) ? { x: 0, y: 0, z: 0 } : null;
    }
    return null;
  }

  /** Test hook: end the current quiet window (the playthrough doesn't sit through every pause). */
  hurry(): void { this.quietUntil = 0; this.lastCombat = -1e9; }

  /** Snapshot for the playthrough assertions. */
  get debugState() {
    return {
      beats: [...this.prog.beats], quietFor: Math.max(0, this.quietUntil - this.now), note: this.noteId,
      armed: this.f.armed, consoleUsed: this.f.holdReleased, lockoutFound: this.f.tagRead, keyTaken: this.f.keyTaken,
      power: this.f.power, actors: this.actors.size, mood: this.director.mood,
      // checkpoints
      restoredFrom: this.restoredFrom, checkpoint: this.lastCheckpoint, pendingCheckpoint: this.pendingCheckpoint,
      checkpoints: [...this.prog.checkpoints], calm: this.started && this.calm(),
      triggered: [...this.prog.triggered], cleared: [...this.prog.cleared], flags: { ...this.f },
    };
  }
}
