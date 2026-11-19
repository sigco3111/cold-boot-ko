/**
 * Level 6 — the moon pool (stage 3d §4.8, §5.5, §5.6.9, §7.1; ST-b): the reveal, the hostile start, the loader's stages,
 * the boss waves W1–W3 and their twins (latest-only restore), the six milestones with `checkpointNow`, the frame
 * (pin → pump → lever), the shear (§4.8.1), the dock ammo lockers and the ammo top-up (B5), the quiet.
 *
 * Rules this file keeps (plan §7.1 / §13):
 *  - the loader (`g6_loader`) and every wave group are spawned with `spawnGroup` — never `engage`, never in `triggered`
 *    (a fresh page can then spawn a wave's TWIN; the stage base removes `triggered ∪ cleared` on a load);
 *  - waves key on their step only (W1 the hostile start, W2 the pin, W3 the pressure — always in this order, so the
 *    "latest" wave is the highest done); each is `pending` from its step until it spawns, `alive`, then `dead`;
 *  - a milestone (pin, pressure, cut, ram E, ram W, pod) writes `cp6_m<n>` (n = milestones done) 1.0 s later with
 *    `checkpointNow`, pushed to a running grip's end + 1.0 s (never skipped); the save carries the loader's `BossState`;
 *  - a boss restore (a fresh page): the latest wave's restore point, health ≥ 60, the best weapon's reserve ≥ 90, the
 *    three lockers re-armed, the loader rebuilt (`boss.restore`: guard for its 3 s grace), the frame as saved (partial
 *    pump work is not saved), then ONLY the latest wave — its twin after 3.0 s if it was alive, re-queued under its own
 *    rule if pending, nothing if dead; earlier waves stay gone;
 *  - nothing waits on a line: every sequence line that is dropped resolves at once and the beat goes on.
 *
 * The interface the route (script.ts) and the hooks (index.ts) call: bossStart / bossStep / bossInteract / bossFire /
 * bossReplay / bossSnap / bossBlocked / bossNoScare / bossHint / bossCheckpoint / bossCalmWait / bossFacts / bossBusy /
 * bossObjective / bossDebug / bossWorld / lockers.
 */
import * as THREE from 'three';
import type { BossControl, BossState, GripHandle, WeaponId } from '../../core/types';
import type { CheckpointRule } from '../stage/base';
import { Base6, type BossFacts6 } from './base';
import { FRAGMENTS6, OBJ6, hhmm6, transferBody } from './text';

export type BossCheckpointId6 = 'cp6_m1' | 'cp6_m2' | 'cp6_m3' | 'cp6_m4' | 'cp6_m5' | 'cp6_quiet';
type WaveKey = 'w1' | 'w2' | 'w3';
type Milestone = 'pin' | 'pressure' | 'cut' | 'ram_e' | 'ram_w' | 'pod';
type LockerKey = 'e' | 'w' | 'n';
type BossGrip = { id: string; h: GripHandle; result: 'done' | 'cancelled' | null };

/** §5.6.9: the milestones in canonical order (the restore rebuilds `milestones` from the flags in this order). */
const MILESTONES: Milestone[] = ['pin', 'pressure', 'cut', 'ram_e', 'ram_w', 'pod'];
/** §5.5: the wave groups (original, twin; W3 also has a stores6 variant). */
const WAVE_GROUPS: Record<WaveKey, { orig: string; twin: string }> = {
  w1: { orig: 'g6_w1', twin: 'g6_w1_r' }, w2: { orig: 'g6_w2', twin: 'g6_w2_r' }, w3: { orig: 'g6_w3', twin: 'g6_w3_r' },
};
const W3_STORES = 'g6_w3_s';
/** §5.2: what each dock locker holds. */
const LOCKER_LOAD: Record<LockerKey, [string, number][]> = {
  e: [['ammo_carbine', 60]], w: [['ammo_carbine', 30], ['ammo_shotgun', 8]], n: [['ammo_carbine', 60]],
};
/** §5.6.4 / D21 numbers the story owns. */
const BOSS6 = {
  grace: 3.0, saveDelay: 1.0, w1At: 2.0, storesAt: 2.4, w2At: 1.5, w3Cap: 3, reserve: 90, healthFloor: 60,
  hostileMin: 10.0, hostileMax: 18.0, pin: 1.2, pump: 6.0, lever: 0.6, strokes: 12,
  paAgain: 25, paMore: 4, shiftPa: 20, consoleNag: 60,
};
/** The bosses' story markers (missing = error, D22). */
export const BOSS_MARKERS6 = ['mk6_reveal', 'mk6_boss_safe', 'mk6_boss_safe_w', 'mk6_horn', 'mk6_pin', 'mk6_pump', 'mk6_lever', 'mk6_cage', 'mk6_windows'] as const;
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export abstract class Boss6 extends Base6 {
  /** Milestones reached, in order (H7 `boss.milestones`). */
  protected milestones: string[] = [];
  /** Script time of the hostile start (H7 `boss.hostileAt`). */
  protected hostileAt: number | null = null;
  /** E1 / E2 running (scenes.ts sets it). */
  protected inEndingNow = false;
  /** The live pump work 0 … 1 (not saved: a restore starts the pump from 0 unless the pressure is full). */
  protected pumpK = 0;

  private bossGrip: BossGrip | null = null;
  private bossForced = new Set<string>();
  private revealAt = -1e9;
  private pool2End = Infinity;
  private waveAt: Record<WaveKey, number> = { w1: -1e9, w2: -1e9, w3: -1e9 };
  private waveGroup: Record<WaveKey, string | null> = { w1: null, w2: null, w3: null };
  /** Script time before which no wave may spawn (a boss restore's 3 s grace). */
  private graceUntil = -1e9;
  private saveDue: number | null = null;
  private litFor = 0;
  private lastPa = -1e9;
  private paCount = 0;
  private lastShiftPa = -1e9;
  private lastMode: string | null = null;
  private storesLatchRunning = false;
  private storesGroups = new Set<string>();
  private boardText = '';
  private gaugeText = '';
  private lowUntil = -1e9;
  private quietAt = -1e9;
  private consoleAskAt = -1e9;
  private windowLook = 0;
  private bossAsked = new Set<string>();
  private warned = new Set<string>();
  private bossMarkersChecked = false;

  // ───────────────────────────────────────────────────────────── the loader (D31)

  /** The loader: spawned with `spawnGroup` — never `engage`, never in `triggered` (§7.1). */
  protected spawnLoader(): void {
    if (this.f.loaderDead || this.members('g6_loader').length > 0) return;
    this.spawnedGroups.add('g6_loader');
    this.w.spawnGroup('g6_loader');
  }
  protected loaderAlive(): boolean { return this.members('g6_loader').length > 0; }
  protected bossCtl(): BossControl | null {
    try { return this.ctx.enemies.boss('g6_loader'); } catch { return null; }
  }
  protected loaderRow(): Record<string, unknown> | null {
    try {
      const d = (this.ctx.enemies as unknown as { debug?: { loader?: (g?: string) => unknown } }).debug;
      return (d?.loader?.('g6_loader') as Record<string, unknown>) ?? null;
    } catch { return null; }
  }
  protected slots(): (string | null)[] {
    try { return (this.ctx.level.dock?.slots ?? []).map((s) => s.container); } catch { return []; }
  }
  /** The loader's PA (D29: the horn rides the trolley — the enemy supplies it; else `mk6_horn`). */
  protected loaderPoint(): THREE.Vector3 | null {
    const row = this.loaderRow();
    const g = row?.grab;
    if (Array.isArray(g) && g.length === 3) return V3(Number(g[0]), -2.6, Number(g[2]));
    const m = this.members('g6_loader')[0];
    return m ? m.position.clone() : this.obj('mk6_horn') ? this.mk('mk6_horn') : null;
  }
  private grabPos(): THREE.Vector3 | null {
    const g = this.loaderRow()?.grab;
    return Array.isArray(g) && g.length === 3 ? V3(Number(g[0]), Number(g[1]), Number(g[2])) : null;
  }
  private warnOnce(k: string, msg: string): void { if (!this.warned.has(k)) { this.warned.add(k); console.warn(`[story] level 6: ${msg}`); } }

  // ───────────────────────────────────────────────────────────── small speech helpers (the route's are private)

  /** A sequence line on its cue (`at`): starts on that frame; resolves with its end time, false when dropped. */
  protected async cueLine(id: string, at: number, where?: () => THREE.Vector3 | undefined): Promise<number | false> {
    await this.until(() => this.now >= at - 0.2 || this.ended);
    // a timed line takes the channel: a bark, a teaching / hint line, the loader's PA or a Q answer yields to it (IA-6 —
    // `_pump_done` still playing at the shear held `_dark` 0.2–0.25 s past cut + 1.2)
    const sp = this.talk.speaking;
    if (sp && /^l[56]_sol_|^l6_kes_(boss_|pump_|pin$|hint_|ack$|busy$)|^l6_unit_loader_/.test(sp)) this.talk.cut();
    await this.until(() => this.now >= at || this.ended);
    if (this.ended) return false;
    const pos = where?.();
    const ok = await this.say(id, { pri: 'scene', now: true, gap: 0.02, cue: this.now, ...(pos ? { at: pos } : {}) });
    if (!ok && !this.talk.log.some((l) => l.id === id && l.said)) return false;
    return this.now;
  }
  /** A Kessler line when the channel is free (no sequence on it), within `ttl` s; false when it never could start. */
  protected async kesFree(id: string, ttl = 20): Promise<boolean> {
    if (this.talk.heard.has(id)) return false;
    const ok = await this.untilOr(() => !this.seqBusy && this.channelFree() && this.ctx.state === 'playing', ttl);
    if (!ok || this.ended) return false;
    return this.say(id, { pri: 'scene', now: true });
  }
  /** Ask a C-line once per page when its condition is first true (a teaching line); the rule decides at the start. */
  private askOnce(id: string, ttl = 8): void {
    if (this.bossAsked.has(id) || this.talk.heard.has(id)) return;
    this.bossAsked.add(id);
    this.S('ask_' + id, () => this.kesFree(id, ttl));
  }
  private pa(id: string): void { void this.unit(id, this.loaderPoint() ?? undefined); }

  // ───────────────────────────────────────────────────────────── threads (start; a restore enters them at its flags)

  protected bossStart(): void {
    if (!this.bossMarkersChecked) {
      this.bossMarkersChecked = true;
      for (const m of BOSS_MARKERS6) if (!this.obj(m) && !this.missingMarkers.includes(m)) { this.missingMarkers.push(m); console.error(`[story] level 6: marker "${m}" missing`); }
    }
    const ev = this.ctx.events;
    ev.on('enemy:part-destroyed', (e) => { if (e.type === 'loader' && !this.ff) this.onPart(e.part); });
    ev.on('enemy:died', (e) => { if (e.type === 'loader' && !this.ff) this.loaderDied(); });
    ev.on('boss:stage', (e) => { if (e.group === 'g6_loader' && e.stage >= 2 && !this.ff) this.lightsOut(); });
    const api = this.api('frame6');
    if (api && 'screenAuto' in api) (api as { screenAuto: boolean }).screenAuto = false;
    if (this.restoredFrom) this.afterBossLoad();
    this.S('boss_reveal', () => this.revealThread());
    this.S('boss_hostile', () => this.hostileThread());
    this.S('boss_quiet', () => this.quietThread());
  }

  /** A load (any checkpoint): the boss state the record says; a boss checkpoint's restore extras (§5.6.9). */
  private afterBossLoad(): void {
    const f = this.f;
    this.milestones = MILESTONES.filter((m) => this.milestoneDone(m));
    this.pumpK = f.pressure >= 1 ? 1 : 0;
    if (f.hostile) this.hostileAt = this.now;
    if (f.reveal) this.revealAt = this.now - BOSS6.hostileMin;
    if (f.quiet) {
      // (audio: music to silence + the quiet beds; the feed warmed up; the ending's lines decoded)
      this.ctx.events.emit('story:beat', { id: 'l6_quiet' });
      this.quietAt = this.now;
      this.prepareEnding();
      return;
    }
    if (!f.hostile || !String(this.restoredFrom ?? '').startsWith('cp6_m')) return;
    // ── a boss restore (B5, S2) ──
    const p = this.ctx.player;
    const latest = this.prog.waves.latest;
    const safe = latest === 'w3' ? 'mk6_boss_safe_w' : 'mk6_boss_safe';
    try { p.teleport(this.mk(safe), latest === 'w3' ? -Math.PI / 2 : Math.PI / 2, 0); } catch (e) { console.warn('[story] boss restore teleport failed', e); }
    try { p.health = Math.min(p.maxHealth, Math.max(p.health, BOSS6.healthFloor)); } catch { /* ignore */ }
    this.topUpAmmo();
    this.armLockers();
    this.graceUntil = this.now + BOSS6.grace;
    // only the latest wave (S2a): earlier ones are gone for good
    const w = this.prog.waves;
    for (const k of ['w1', 'w2', 'w3'] as WaveKey[]) {
      if (k === latest) continue;
      if (w[k] === 'alive' || w[k] === 'pending') w[k] = 'dead';
    }
    if (latest && w[latest] === 'alive') {
      w[latest] = 'pending';                 // (it is not in the world until its twin spawns)
      this.S('twin_' + latest, async () => { await this.until(() => this.now >= this.graceUntil); this.spawnWave(latest, true); });
    } else if (latest && w[latest] === 'pending') {
      this.S('requeue_' + latest, () => this.waveRule(latest));
    }
    this.stamp('boss_restore');
  }

  /** §5.5: the best weapon's reserve topped to ≥ 90 (the carbine if owned). */
  private topUpAmmo(): void {
    const p = this.ctx.player;
    const order: [WeaponId, string][] = [['carbine', 'ammo_carbine'], ['shotgun', 'ammo_shotgun'], ['pistol', 'ammo_pistol']];
    for (const [id, ammo] of order) {
      const ws = p.weapons?.[id];
      if (!ws?.owned) continue;
      const need = BOSS6.reserve - (ws.reserve ?? 0);
      if (need > 0) { try { p.give(ammo as Parameters<typeof p.give>[0], need); } catch (e) { console.warn('[story] ammo top-up failed', e); } }
      return;
    }
  }

  // ── §4.8 the reveal ──

  private async revealThread(): Promise<void> {
    await this.until(() => this.f.shaftOpen);
    if (this.f.reveal) return;
    await this.until(() => this.f.reveal || this.bossForced.has('reveal')
      || (this.ctx.state === 'playing' && (this.inTrig('t6_reveal') || this.w.room() === 'pool6')));
    this.revealNow();
  }
  protected revealNow(): void {
    const f = this.f;
    if (f.reveal) return;
    f.reveal = true;
    (this.prog.flags as unknown as Record<string, unknown>).revealT = this.t;
    this.revealAt = this.now;
    this.beat('l6_reveal');
    this.stamp('reveal');
    this.spawnLoader();
    try { this.bossCtl()?.cue('lower'); } catch (e) { console.warn('[story] loader cue failed', e); }
    this.setTransferNote();
    // §5.7 #8: exempt from the boss rule and from spacing (S4) — once, calm
    if (!this.prog.scares.includes('v6_well_eyes') && this.scareCalm(true)) this.fireScare('v6_well_eyes');
    this.board();
    this.S('reveal_board', async () => { await this.hold(6.0); this.board(); });
    this.S('reveal_lines', async () => {
      this.seqBusy = true;
      try {
        const e = await this.cueLine('l6_kes_pool_1', this.revealAt + 0.6);
        if (e === false || this.f.hostile) { this.pool2End = this.now; return; }
        const e2 = await this.cueLine('l6_kes_pool_2', e + 0.5);
        this.pool2End = e2 === false ? this.now : e2;
      } finally { this.seqBusy = false; }
    });
  }
  private revealHhmm(): string {
    const rt = (this.prog.flags as unknown as Record<string, unknown>).revealT;
    return typeof rt === 'number' ? hhmm6(this.hourAt(rt)) : '--:--';
  }
  private setTransferNote(): void {
    const n = FRAGMENTS6.note6_transfer;
    if (n) n.body = transferBody(this.revealHhmm());
  }

  // ── the hostile start ──

  private async hostileThread(): Promise<void> {
    await this.until(() => this.f.reveal);
    if (this.f.hostile) return;
    await this.until(() => {
      if (this.f.hostile || this.bossForced.has('hostile')) return true;
      if (this.ctx.state !== 'playing') return false;
      const due = Math.min(Math.max(this.revealAt + BOSS6.hostileMin, this.pool2End + 0.5), this.revealAt + BOSS6.hostileMax);
      if (this.now >= due) return true;
      if (this.inTrig('t6_floor')) return true;
      const ctl = this.bossCtl();
      if (ctl && ctl.stage >= 1) return true;                                       // damaged: it woke itself
      if (this.lastShotAt > this.revealAt && this.w.room() === 'pool6') return true; // a shot in the chamber
      return false;
    });
    this.hostileNow();
  }
  protected hostileNow(): void {
    const f = this.f;
    if (f.hostile) return;
    if (!f.reveal) this.revealNow();
    f.hostile = true;
    this.hostileAt = this.now;
    this.beat('l6_loader');
    this.stamp('hostile');
    try { this.bossCtl()?.wake(); } catch (e) { console.warn('[story] loader wake failed', e); }
    this.vig('beacons6');
    // `alarm_beacon` is a LOOP (the sounder's two-tone, 2 s period): a 6 s burst with the beacons, then off (IA-6 —
    // played as a one-shot it was refused: "is a loop; use loop()")
    if (!this.ff) {
      try {
        const h = this.ctx.audio.loop('alarm_beacon', { position: this.obj('mk6_horn') ? this.mk('mk6_horn') : undefined, volume: 0.9 });
        let on = true; const off = () => { if (on) { on = false; try { h.stop(1.0); } catch { /* ignore */ } } };
        this.S('alarm_burst', async () => { await this.hold(6.0); off(); });
        setTimeout(off, 9000);   // (a death / restore that ends the thread still stops it)
      } catch (e) { console.warn('[story] alarm_beacon failed', e); }
    }
    this.pa('l6_unit_loader_1');
    this.lastPa = this.now; this.paCount = 1;
    this.board();
    // W1 (+2.0, its door +2.4): pending from its step (a save in between re-queues it)
    if (this.prog.waves.w1 === null) {
      this.prog.waves.w1 = 'pending';
      this.prog.waves.latest = this.prog.waves.latest ?? 'w1';
      this.S('w1', async () => { await this.hold(BOSS6.w1At); if (this.prog.waves.w1 === 'pending') this.spawnWave('w1', false); });
    }
    const t0 = this.now;
    this.S('hostile_lines', async () => {
      // (a reveal line still on the channel is let finish: CHOIR waits its turn, never over Kessler)
      await this.untilOr(() => !this.seqBusy, 6);
      this.seqBusy = true;
      try {
        const c = await this.cueLine(this.choiceId('l6_choir_pool'), Math.max(this.now, t0 + 0.4));
        await this.cueLine('l6_kes_boss_1', (c === false ? this.now : c) + 0.4);
      } finally { this.seqBusy = false; }
    });
  }

  // ───────────────────────────────────────────────────────────── waves (§5.5)

  private nonLoaderHostiles(): number { return this.awakeHostiles().length; }

  /** A wave's rule after its step (W2: + 1.5 s; W3: when ≤ 3 non-loader hostiles live) — always after a restore's grace. */
  private async waveRule(k: WaveKey): Promise<void> {
    if (k === 'w3') await this.until(() => this.now >= this.graceUntil && this.nonLoaderHostiles() <= BOSS6.w3Cap && this.ctx.state === 'playing');
    else await this.until(() => this.now >= this.graceUntil && this.ctx.state === 'playing');
    if (this.prog.waves[k] === 'pending' && !this.ended) this.spawnWave(k, false);
  }
  private spawnWave(k: WaveKey, twin: boolean): void {
    const w = this.prog.waves;
    if (w[k] === 'alive' || w[k] === 'dead' || this.ended || this.f.quiet) return;
    let group = twin ? WAVE_GROUPS[k].twin : WAVE_GROUPS[k].orig;
    // (a group this page's load removed can never spawn again: the twin stands in)
    const gone = (g: string) => this.prog.triggered.includes(g) || this.prog.cleared.includes(g);
    if (!twin && gone(group)) { group = WAVE_GROUPS[k].twin; twin = true; }
    // W3 from stores6 when d6_pool is open or the player is in the shaft (§5.1); its twin always from the shaft bottom
    let stores = k === 'w1';
    if (k === 'w3' && !twin) {
      const d = this.door('d6_pool');
      if ((d && !this.isShut(d)) || this.w.room() === 'shaft6') { group = W3_STORES; stores = true; }
    }
    w[k] = 'alive';
    w.latest = k;
    this.waveAt[k] = this.now;
    this.waveGroup[k] = group;
    this.spawnedGroups.add(group);
    this.w.spawnGroup(group);
    this.stamp(`${k}${twin ? '_twin' : ''}`);
    this.S('wave_' + group, async () => {
      await this.hold(0.1);
      if (k === 'w2' || k === 'w3') this.rush(group, 30);     // (soldiers have no rush: only the husks run)
      else this.rouse(group);
      if (stores) { await this.hold(BOSS6.storesAt - BOSS6.w1At - 0.1); this.openStores(group); }
    });
  }
  /** `d6_stores` held open for W1 / W3's stores variant (K_stores), latched behind it (§3: last member z < −148.6, or 10 s). */
  private openStores(group: string): void {
    this.storesGroups.add(group);
    this.set('storesOpen', true);
    const t0 = this.now;
    if (this.storesLatchRunning) return;
    this.storesLatchRunning = true;
    this.S('stores_latch', async () => {
      try {
        await this.hold(0.6);
        await this.until(() => this.now - t0 >= 10 || [...this.storesGroups].every((g) => this.members(g).every((e) => e.position.z < -148.6)));
        for (;;) {
          // never while he is in stores6 or its doorway (he is on the keep side: south of the door)
          await this.until(() => this.pos.z < -149.8 || this.ended);
          if (this.ended) break;
          const ok = await this.latch('d6_stores', () => this.pos.z < -148.6, 1.0, 1.0, 3.0);
          if (ok) break;
          await this.hold(2);
        }
        this.storesGroups.clear();
        this.set('storesOpen', false);
      } finally { this.storesLatchRunning = false; }
    });
  }
  /** Every step: a wave whose members are all dead (or removed) is `dead`. */
  private waveWatch(): void {
    const w = this.prog.waves;
    for (const k of ['w1', 'w2', 'w3'] as WaveKey[]) {
      const g = this.waveGroup[k];
      if (w[k] !== 'alive' || !g || this.now - this.waveAt[k] < 1.0) continue;
      if (this.members(g).length === 0) { w[k] = 'dead'; this.stamp(`${k}_dead`); }
    }
  }
  protected override onRemoved(group: string, living: import('../../core/types').Enemy[], gone: boolean): void {
    super.onRemoved(group, living, gone);
    // (a wave removed by the stray / stranded rule is gone: dead for the record)
    for (const k of ['w1', 'w2', 'w3'] as WaveKey[]) if (this.waveGroup[k] === group && this.prog.waves[k] === 'alive') this.prog.waves[k] = 'dead';
  }

  // ───────────────────────────────────────────────────────────── milestones (D21, §5.6.9)

  private milestoneDone(m: Milestone): boolean {
    const f = this.f;
    return m === 'pin' ? f.pin : m === 'pressure' ? f.pressure >= 1 : m === 'cut' ? f.trunkCut : m === 'ram_e' ? f.ramE : m === 'ram_w' ? f.ramW : f.loaderDead;
  }
  private milestone(m: Milestone): void {
    if (this.milestones.includes(m)) return;
    this.milestones.push(m);
    this.once(`m_${m}`);
    this.stamp(`m_${m}`);
    this.saveDue = Math.max(this.saveDue ?? 0, this.now + BOSS6.saveDelay);
  }
  private gripRunning(): boolean {
    if (this.bossGrip) return true;
    try { return this.ctx.player.gripProgress >= 0; } catch { return false; }
  }
  /** The milestone save: 1.0 s after, pushed to a running grip's end + 1.0 s, never skipped while he lives. */
  private milestoneSave(): void {
    if (this.saveDue === null || this.ended) return;
    if (this.gripRunning()) { this.saveDue = Math.max(this.saveDue, this.now + BOSS6.saveDelay); return; }
    if (this.now < this.saveDue || this.ctx.state !== 'playing') return;
    const p = this.ctx.player;
    if (!p.alive || p.health <= 0) { this.saveDue = null; return; }
    this.saveDue = null;
    const n = MILESTONES.filter((m) => this.milestoneDone(m)).length;
    if (n < 1 || n > 5) return;            // (the sixth ends the fight: cp6_quiet follows when calm)
    const ctl = this.bossCtl();
    try { if (ctl) this.prog.boss = ctl.snapshot(); else if (this.f.loaderDead && this.prog.boss) this.prog.boss = { ...this.prog.boss, dead: true }; } catch { /* ignore */ }
    this.checkpointNow(`cp6_m${n}` as BossCheckpointId6);
  }

  // ───────────────────────────────────────────────────────────── the frame (§4.8, §8.5)

  private frameApi(fn: string, ...a: unknown[]): boolean { return this.call('frame6', fn, ...a); }
  private startBossGrip(id: string, point: THREE.Vector3, seconds: number, hold: boolean, motion: 'pump' | 'lever' | 'pin', start = 0): BossGrip | null {
    if (this.bossGrip) return null;
    const n = this.pos.clone().sub(point).setY(0);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    n.normalize();
    let h: GripHandle;
    try { h = this.ctx.player.grip({ id, point, normal: n, seconds, hold, motion, start, maxDist: 1.8 }); } catch (e) { console.warn('[story] grip failed', e); return null; }
    const g: BossGrip = { id, h, result: null };
    this.bossGrip = g;
    void h.done.then((r) => { g.result = r; if (this.bossGrip === g) this.bossGrip = null; });
    return g;
  }
  /** The running frame grip (H16 / H7 `grip`, Q is ignored while it runs). */
  protected bossGripNow(): { id: string; h: GripHandle } | null { return this.bossGrip; }
  private cancelBossGrip(): void { try { this.bossGrip?.h.cancel(); } catch { /* ignore */ } this.bossGrip = null; }
  private framePoint(key: 'pinPoint' | 'pumpGrip' | 'leverGrip', mk: string): THREE.Vector3 {
    const v = this.api('frame6')?.[key];
    if (v instanceof THREE.Vector3) return v.clone();
    if (typeof v === 'function') { try { const r = (v as () => unknown)(); if (r instanceof THREE.Vector3) return r; } catch { /* ignore */ } }
    return this.mk(mk);
  }
  private shearAt(): THREE.Vector3 {
    const v = this.api('frame6')?.shearPoint;
    return v instanceof THREE.Vector3 ? v.clone() : this.mk('mk6_lever');
  }
  /** A frame control pressed: the hostile start if it has not come (§4.8 "any frame6_* use"). */
  private frameUse(): void { if (!this.f.hostile) this.hostileNow(); }

  private pinUse(): void {
    this.frameUse();
    if (this.f.pin || this.bossGrip) return;
    const point = this.framePoint('pinPoint', 'mk6_pin');
    const g = this.startBossGrip('frame6_pin', point, BOSS6.pin, true, 'pin');
    if (!g) return;
    this.S('pin', async () => {
      await this.until(() => { this.frameApi('pin', Math.min(0.85, (g.result === 'done' ? 1 : g.h.progress) * 0.85)); return g.result !== null; });
      if (g.result === 'done') this.pinDone();
      else if (!this.f.pin) this.frameApi('pin', 0);
    });
  }
  protected pinDone(): void {
    const f = this.f;
    if (f.pin) return;
    f.pin = true;
    this.stamp('pin');
    this.frameApi('pin', 1);
    this.sfx('pin_draw', this.framePoint('pinPoint', 'mk6_pin'), 0.9);
    this.milestone('pin');
    try { this.bossCtl()?.setStage(2); } catch { /* ignore */ }
    this.lightsOut();
    this.gauge();
    if (this.prog.waves.w2 === null) {
      this.prog.waves.w2 = 'pending';
      this.prog.waves.latest = 'w2';
      this.S('w2', async () => { await this.hold(BOSS6.w2At); await this.waveRule('w2'); });
    }
    this.S('pin_lines', async () => {
      const ok = await this.kesFree('l6_kes_pin', 8);
      const t0 = this.now;
      // CHOIR: pin out + 2.0, no Kessler line playing
      await this.untilOr(() => this.now >= t0 + (ok ? 0.6 : 2.0) && !this.seqBusy && this.channelFree(), 12);
      if (!this.ended) await this.say(this.choiceId('l6_choir_pin'), { pri: 'scene', now: true });
    });
  }
  private pumpUse(): void {
    this.frameUse();
    const f = this.f;
    if (f.pressure >= 1 || this.bossGrip) return;
    if (!f.pin) { this.shearDeny('l6_unit_shear_pin'); return; }
    const point = this.framePoint('pumpGrip', 'mk6_pump');
    const g = this.startBossGrip('frame6_pump', point, BOSS6.pump, true, 'pump', this.pumpK);
    if (!g) return;
    this.S('pump', async () => {
      await this.until(() => {
        const was = this.pumpK;
        const k = g.result === 'done' ? 1 : g.h.progress;
        this.pumpK = Math.max(this.pumpK, Math.min(1, k));
        if (this.pumpK !== was) {
          this.frameApi('pump', this.pumpK);
          if (Math.floor(this.pumpK * BOSS6.strokes + 1e-6) > Math.floor(was * BOSS6.strokes + 1e-6)) this.sfx('pump_stroke', point, 0.8);
          this.gauge();
          if (was < 0.5 && this.pumpK >= 0.5) this.pumpHalf();
        }
        return g.result !== null;
      });
      if (g.result === 'done' || this.pumpK >= 1) this.pumpDone();
    });
  }
  private pumpHalf(): void {
    this.S('pump_half', async () => {
      const ok = await this.kesFree('l6_kes_pump_half', 6);
      if (!ok) return;
      await this.untilOr(() => !this.seqBusy && this.channelFree(), 10);
      await this.hold(0.5);
      if (!this.ended) await this.say(this.choiceId('l6_choir_pump'), { pri: 'scene', now: true });
    });
  }
  protected pumpDone(): void {
    const f = this.f;
    if (f.pressure >= 1) return;
    if (!f.pin) this.pinDone();
    this.pumpK = 1;
    f.pressure = 1;
    this.stamp('pressure');
    this.frameApi('pump', 1);
    this.sfx('gauge_tick', this.shearAt(), 0.7);
    this.gauge();
    this.milestone('pressure');
    try { this.bossCtl()?.setStage(3); } catch { /* ignore */ }
    // the lever's guard springs open
    this.S('guard', async () => { const t0 = this.now; await this.until(() => { const k = Math.min(1, (this.now - t0) / 0.35); this.frameApi('guard', k); return k >= 1; }); });
    if (this.prog.waves.w3 === null) {
      this.prog.waves.w3 = 'pending';
      this.prog.waves.latest = 'w3';
      this.S('w3', () => this.waveRule('w3'));
    }
    this.S('pump_done', () => this.kesFree('l6_kes_pump_done', 8));
  }
  private leverUse(): void {
    this.frameUse();
    const f = this.f;
    if (f.trunkCut || this.bossGrip) return;
    if (f.pressure < 1) {
      this.sfx('interlock_deny', undefined, 0.7);
      this.lowUntil = this.now + 1.2;
      this.gauge();
      this.S('low_gauge', async () => { await this.hold(1.25); this.gauge(); });
      this.shearDeny(f.pin ? 'l6_unit_shear_low' : 'l6_unit_shear_pin');
      return;
    }
    const point = this.framePoint('leverGrip', 'mk6_lever');
    const g = this.startBossGrip('frame6_lever', point, BOSS6.lever, false, 'lever');
    if (!g) return;
    this.S('lever', async () => {
      await this.until(() => { this.frameApi('lever', (g.result === 'done' ? 1 : g.h.progress) * 0.9); return g.result !== null; });
      if (g.result === 'done') this.shearNow();
      else this.frameApi('lever', 0);
    });
  }
  // (IA-6: the shear's panel speaker 0.5 m above the shear point — AT the point the frame's own steel occluded it from a
  //  player 2 m away in the cage: −4.4 dB vs the reference)
  private shearDeny(id: string): void { void this.unit(id, this.shearAt().add(V3(0, 0.5, 0))); }

  /** §4.8.1 the shear: the trunk goes dark — in control, no camera taken. t = 0 at the lever's grip end. */
  protected shearNow(): void {
    const f = this.f;
    if (f.trunkCut) return;
    if (f.pressure < 1) this.pumpDone();
    const t0 = this.now;
    f.trunkCut = true;
    this.beat('l6_cut');
    this.stamp('cut');
    this.earn('trunkCut');
    this.milestone('cut');
    const fired = this.frameApi('fire', (cue: string, at: THREE.Vector3) => {
      switch (cue) {
        case 'slam': this.sfx('shear_fire', at, 1.0); try { this.ctx.player.shake(0.3); this.ctx.fx.fluid?.(at, V3(0, 1, 0), 14); } catch { /* ignore */ } this.stamp('shear_slam'); break;
        case 'part': this.sfx('tether_whip', at, 1.0); this.stamp('shear_part'); break;
        case 'splash': this.sfx('splash_big', at, 0.9); this.stamp('shear_splash'); break;
        case 'brake': this.sfx('winch_brake', at, 0.9); this.stamp('shear_brake'); break;
      }
    });
    if (!fired) {
      // (no set piece: the sounds on the plan's clock)
      this.S('shear_sfx', async () => {
        await this.hold(0.05); this.sfx('shear_fire', this.shearAt(), 1.0);
        await this.hold(0.2); this.sfx('tether_whip', this.shearAt(), 1.0);
        await this.hold(0.85); this.sfx('splash_big', this.shearAt(), 0.9);
        await this.hold(0.3); this.sfx('winch_brake', this.shearAt(), 0.9);
      });
    }
    this.S('shear', async () => {
      await this.until(() => this.now >= t0 + 0.30);
      this.w.machine('ping6', 'off');              // the next ping never comes
      await this.until(() => this.now >= t0 + 0.60);
      this.screensCut();
      // The tether outside is cut ONCE: pool.ts watches `frame6.state().fired`; only without the set piece does the story cut it.
      if (!fired) this.cutCable(6);
      const e = await this.cueLine('l6_kes_dark', t0 + 1.2);
      if (this.loaderAlive()) await this.cueLine('l6_kes_cut_loader', (e === false ? this.now : e) + 0.4);
    });
  }
  private screensCut(): void {
    this.board();
    this.gauge();
    this.screen('mimic6', 'mimic', 'cut');
    this.consoleIdle();
  }
  private cutCable(seconds: number): void {
    const u = this.api('fx6_sea');
    const h = (u?.handle ?? u) as { cutCable?: (s?: number) => void } | null;
    if (h && typeof h.cutCable === 'function') { try { h.cutCable(seconds); } catch (e) { console.warn('[story] cutCable failed', e); } }
    else this.warnOnce('sea', 'no viewport fx handle (object "fx6_sea") — the cut cable is not shown');
  }

  // ── the loader's parts ──

  private onPart(part: string): void {
    if (part === 'ram_e' || part === 'ram_w') this.ramDestroyed(part);
    else if (part === 'pod') this.loaderDied();
  }
  private ramDestroyed(part: 'ram_e' | 'ram_w'): void {
    const f = this.f;
    if (part === 'ram_e' ? f.ramE : f.ramW) return;
    if (part === 'ram_e') f.ramE = true; else f.ramW = true;
    this.stamp(part);
    this.milestone(part);
    if (f.ramE && f.ramW) {
      this.pa('l6_unit_loader_3');
      this.S('boss_pod', async () => { await this.hold(2.6); await this.kesFree('l6_kes_boss_pod', 10); });
    }
    this.board();
  }
  protected loaderDied(): void {
    const f = this.f;
    if (f.loaderDead) return;
    if (!f.ramE) this.ramDestroyed('ram_e');
    if (!f.ramW) this.ramDestroyed('ram_w');
    f.loaderDead = true;
    this.stamp('loader_dead');
    this.earn('loaderDead');
    this.milestone('pod');
    try { this.prog.boss = this.bossCtl()?.snapshot() ?? (this.prog.boss ? { ...this.prog.boss, dead: true } : null); } catch { /* ignore */ }
    this.board();
    this.S('loader_dead_lines', async () => {
      await this.hold(1.0);
      let ok = false;
      if (!f.trunkCut) ok = await this.kesFree('l6_kes_loader_dead', 6);
      await this.untilOr(() => !this.seqBusy && this.channelFree(), 10);
      await this.hold(ok ? 0.6 : 0.6);
      if (!this.ended) await this.say(this.choiceId('l6_choir_loader'), { pri: 'scene', now: true });
    });
  }
  /** Stage ≥ 2 (pin out, or a ram): the high-bays go (once). */
  private lightsOut(): void {
    if (this.f.lights_out6) return;
    this.f.lights_out6 = true;
    this.stamp('lights_out6');
    this.vig('lights_out6');
  }

  // ───────────────────────────────────────────────────────────── the quiet (§4.8 last rows)

  private async quietThread(): Promise<void> {
    await this.until(() => this.f.trunkCut && this.f.loaderDead);
    if (!this.f.quiet) {
      // every awake hostile anywhere fought (3c's stray rule acts meanwhile: `bossCalmWait`), then 2.0 s of calm
      await this.fightOutWhere((e) => e.alive && e.state !== 'dormant' && e.type !== 'loader' && !this.isHolding(e), 60, { stop: () => this.bossForced.has('quiet') });
      let since = -1;
      await this.until(() => {
        if (this.bossForced.has('quiet')) return true;
        if (!this.calm()) { since = -1; return false; }
        if (since < 0) since = this.now;
        return this.now - since >= 2.0;
      });
      this.quietNow();
    }
    // the console nag (60 s after the ask, calm, cooldown 60)
    this.S('console_nag', async () => {
      for (;;) {
        await this.until(() => this.ended || this.f.ending || (this.consoleAskAt > -1e8 && this.now - this.consoleAskAt >= BOSS6.consoleNag && this.calm() && this.channelFree() && !this.seqBusy));
        if (this.ended || this.f.ending) return;
        this.consoleAskAt = this.now;
        await this.say('l6_kes_console_2', { pri: 'scene', now: true });
      }
    });
    if (!this.talk.heard.has('l6_kes_console')) {
      await this.until(() => this.now >= this.quietAt + 3.0);
      if (this.f.ending) return;
      const ok = await this.kesFree('l6_kes_console', 30);
      this.consoleAskAt = this.now;
      if (!ok) this.consoleAskAt = this.now - BOSS6.consoleNag + 10;
    } else this.consoleAskAt = this.now;
  }
  protected quietNow(): void {
    const f = this.f;
    if (f.quiet) return;
    f.quiet = true;
    this.quietAt = this.now;
    this.beat('l6_quiet');
    this.stamp('quiet');
    this.director.setMood('silence');
    this.checkpointNow('cp6_quiet');
    this.prepareEnding();
  }
  /** Warm-up at the quiet (scenes.ts): the feed and the lines. */
  protected prepareEnding(): void { /* scenes.ts */ }

  // ───────────────────────────────────────────────────────────── the lockers (B5)

  private lockerKey(id: string): LockerKey | null {
    return id === 'locker6_e' ? 'e' : id === 'locker6_w' ? 'w' : id === 'locker6_n' ? 'n' : null;
  }
  private takeLocker(k: LockerKey): void {
    if (this.prog.lockers[k]) return;
    this.prog.lockers[k] = true;
    const id = `locker6_${k}`;
    this.call(id, 'swing');
    this.call(id, 'set', false);
    this.w.setInteractable(id, false);
    for (const [kind, n] of LOCKER_LOAD[k]) { try { this.ctx.player.give(kind as Parameters<typeof this.ctx.player.give>[0], n); } catch { /* ignore */ } }
    // (audio plays the pickup sound from the event — one owner)
    const at = this.w.interactablePos(id) ?? this.pos.clone();
    try { this.ctx.events.emit('pickup', { kind: 'ammo_carbine', amount: LOCKER_LOAD[k][0][1], position: at }); } catch { /* ignore */ }
  }
  /** The lockers as the record says (taken → empty and shut off). */
  private lockersAsSaved(): void {
    for (const k of ['e', 'w', 'n'] as LockerKey[]) {
      const id = `locker6_${k}`, taken = !!this.prog.lockers[k];
      this.call(id, 'set', !taken);
      if (!taken) this.call(id, 'open', 0);
      this.w.setInteractable(id, !taken);
    }
  }
  /** Every boss restore: all three re-armed (B5). */
  private armLockers(): void {
    this.prog.lockers = { e: false, w: false, n: false };
    this.lockersAsSaved();
  }

  // ───────────────────────────────────────────────────────────── screens

  /** `dock_board` (§6.4) from the record. Before the reveal it keeps its arrival state. */
  protected board(): void {
    const f = this.f;
    if (!f.reveal) return;
    const lowered = this.now - this.revealAt >= 6.0 || f.hostile || this.restoredFrom !== null;
    const rams = (f.ramE ? 1 : 0) + (f.ramW ? 1 : 0);
    const rows = [
      '문풀 — 도크 — 2,140 M',
      `이송 B-14: ${lowered ? '웰 안 — 록 주기 대기' : '하강 중'}`,
      '화물 록: 내부 문 닫힘',
      '배수: 34 % — 정지됨',
      f.trunkCut ? '트렁크: 신호 손실 · 부이: 신호 손실' : `TETHER: TAUT — BUOY: ${f.pulled ? '링크 활성' : '대기'}`,
      `로더 DL-2: ${f.loaderDead ? '오프라인' : rams >= 2 ? '제어 고장' : f.hostile ? '위험 — 도크에 인원' : '작동 중'}`,
    ];
    const t = rows.join('\n');
    if (t === this.boardText) return;
    this.boardText = t;
    this.screen('dock_board', 'dock_board', t);
  }
  /** `gauge6` (§6.4 texts): `핀 삽입됨` → `0 BAR — 펌프` → `n BAR` → `210 BAR — READY` → `발사됨` / `압력 낮음` (1.2 s). */
  protected gauge(): void {
    const f = this.f;
    const k = f.pressure >= 1 ? 1 : this.pumpK;
    // §6.4's display strings (W5's `gaugeState` reads `n BAR …` as bar, `압력 낮음|k`, `핀 삽입됨`, `발사됨`)
    const bar = Math.round(k * 210);
    const t = f.trunkCut ? '발사됨' : !f.pin ? '핀 삽입됨' : this.now < this.lowUntil ? `압력 낮음|${k.toFixed(3)}`
      : k >= 1 ? '210 BAR — 준비' : bar <= 0 ? '0 BAR — 펌프' : `${bar} BAR`;
    if (t === this.gaugeText) return;
    this.gaugeText = t;
    this.screen('gauge6', 'gauge', t);
  }
  /** The console's idle page (the dock board's lines; after the cut the trunk is LOS). */
  protected consoleIdle(): void {
    const t = this.f.trunkCut
      ? '헤드엔드 중계기 — 도크\n트렁크: 신호 손실 · 부이: 신호 손실\n문풀 — 도크 — 2,140 M\n화물 록: 내부 문 닫힘\n마지막 발송 (버퍼됨): 1건'
      : undefined;
    this.call('console6', 'page', 'idle', t ? { text: t } : {});
  }

  // ───────────────────────────────────────────────────────────── per step

  protected bossStep(step: number): void {
    if (!this.started) return;
    const f = this.f;
    this.milestoneSave();
    if (!f.shaftOpen || !this.live) return;
    this.waveWatch();
    const playing = this.ctx.state === 'playing';
    const ctl = this.bossCtl();
    // the gauge's PRESSURE LOW ends by itself
    if (f.pin && !f.trunkCut && this.gaugeText.startsWith('low|') && this.now >= this.lowUntil) this.gauge();
    if (f.hostile && !f.loaderDead && ctl && playing) {
      // flood-lit with an aware soldier (D20) — `l6_kes_boss_flood`
      let lit = false;
      try { lit = ctl.floodLit(this.ctx.player.eye) && this.soldierRows().some((r) => r.aware && !r.holding); } catch { lit = false; }
      this.litFor = lit ? this.litFor + step : 0;
      const B = this.bossFacts();
      if (B.slamRecoveryInView && B.ramsGone === 0) this.askOnce('l6_kes_boss_ram');
      if (this.litFor >= 2 && B.floodAlive) this.askOnce('l6_kes_boss_flood');
      if (B.inCage && B.soldierAlive) this.askOnce('l6_kes_boss_frame');
      // the PA again on the dock (cooldown 25 s, ≤ 4 more); a SHIFT / DROP starting
      if (B.onDock && this.now - this.lastPa >= BOSS6.paAgain && this.paCount < 1 + BOSS6.paMore) { this.lastPa = this.now; this.paCount++; this.pa('l6_unit_loader_1'); }
      const mode = String(this.loaderRow()?.mode ?? '');
      if ((mode === 'shift' || mode === 'drop') && mode !== this.lastMode && this.now - this.lastShiftPa >= BOSS6.shiftPa) { this.lastShiftPa = this.now; this.pa('l6_unit_loader_2'); }
      this.lastMode = mode;
    } else this.litFor = 0;
    // the console: usable while the ending is pending and nothing is awake (the precondition, D17)
    const ready = f.quiet && !f.ending && this.awakeHostiles().length === 0;
    this.w.setInteractable('console6', ready);
    // §5.7 #9 v6_window: after the quiet, feet in t6_windows or the windows in view ≤ 20 m for 2 s
    if (f.quiet && !this.prog.scares.includes('v6_window') && playing) {
      const win = this.mk('mk6_windows');
      const near = this.inTrig('t6_windows');
      this.windowLook = this.sees(win, 20, 40, false) ? this.windowLook + step : 0;
      if ((near || this.windowLook >= 2) && this.scareCalm(false) && !this.inDoorway()) this.fireScare('v6_window');
    }
  }
  /** The stray rule may act (base6 `calmWaiting`): from the quiet's wait until the console is used (D17 / S11e). */
  protected bossCalmWait(): boolean { return this.f.trunkCut && this.f.loaderDead && !this.f.ending; }

  // ───────────────────────────────────────────────────────────── interactions, H3

  protected bossInteract(id: string): boolean {
    switch (id) {
      case 'frame6_pin': this.pinUse(); return true;
      case 'frame6_pump': this.pumpUse(); return true;
      case 'frame6_lever': this.leverUse(); return true;
      case 'console6': this.consoleUse(); return true;
      case 'note6_transfer': this.setTransferNote(); return false;   // (the route opens the readable)
    }
    const k = this.lockerKey(id);
    if (k) { this.takeLocker(k); return true; }
    return false;
  }
  /** The console pressed (scenes.ts runs the ending). */
  protected consoleUse(): void { /* scenes.ts */ }

  protected bossFire(name: string): string | null {
    const f = this.f;
    switch (name) {
      case 'reveal': if (!f.shaftOpen || f.reveal) return null; this.revealNow(); return 'reveal';
      case 'hostile': if (!f.shaftOpen || f.hostile) return null; this.hostileNow(); return 'hostile';
      case 'pin': if (!f.shaftOpen || f.pin) return null; this.cancelBossGrip(); this.frameUse(); this.pinDone(); return 'pin';
      case 'pump': if (!f.pin || f.pressure >= 1) return null; this.cancelBossGrip(); this.pumpDone(); return 'pump';
      case 'fire': if (f.pressure < 1 || f.trunkCut) return null; this.cancelBossGrip(); this.frameApi('lever', 1); this.shearNow(); return 'fire';
      case 'ram_e': case 'ram_w':
        if (!f.shaftOpen || (name === 'ram_e' ? f.ramE : f.ramW) || f.loaderDead) return null;
        this.frameUse();
        this.debugKill(name);
        return name;
      case 'pod':
        if (!f.shaftOpen || f.loaderDead) return null;
        this.frameUse();
        if (!f.ramE) this.debugKill('ram_e');
        if (!f.ramW) this.debugKill('ram_w');
        this.debugKill('pod');
        return 'pod';
      case 'quiet': if (!f.trunkCut || !f.loaderDead || f.quiet) return null; this.bossForced.add('quiet'); return 'quiet';
      case 'console': if (!f.quiet || f.ending) return null; this.consoleUse(); return 'console';
    }
    return null;
  }
  /** H3 `ram_e` / `ram_w` / `pod`: the part destroyed for real on the loader (its events set the flags). */
  private debugKill(part: 'ram_e' | 'ram_w' | 'pod'): void {
    let done = false;
    try {
      const o = (this.ctx.enemies as unknown as { debug?: { loaderObj?: () => unknown } }).debug?.loaderObj?.() as
        { alive?: boolean; hp?: Record<string, number>; destroy?: (p: string, at: THREE.Vector3) => void } | null;
      if (o && o.alive && o.hp && typeof o.destroy === 'function' && (o.hp[part] ?? 0) > 0) {
        const pos = (this.loaderRow()?.parts as Record<string, { pos?: number[] }> | undefined)?.[part]?.pos;
        const at = Array.isArray(pos) && pos.length === 3 ? V3(pos[0], pos[1], pos[2]) : (this.grabPos() ?? this.mk('mk6_horn'));
        o.hp[part] = 0;
        o.destroy.call(o, part, at);
        done = true;
      }
    } catch (e) { console.warn(`[story] debug kill ${part} failed`, e); }
    // (no loader object: the record moves on alone)
    if (part === 'pod') { if (!done || !this.f.loaderDead) this.loaderDied(); }
    else if (!(part === 'ram_e' ? this.f.ramE : this.f.ramW)) this.ramDestroyed(part);
  }

  // ───────────────────────────────────────────────────────────── restore (§7 order, §7.1)

  /** afterReplay, after the route's flags: the loader spawned / restored / removed. */
  protected bossReplay(): void {
    const f = this.f;
    f.storesOpen = false;
    if (f.loaderDead) {
      try { this.bossCtl()?.removeSilently(); } catch { /* ignore */ }
      return;
    }
    if (!f.shaftOpen) return;
    this.spawnLoader();
    const ctl = this.bossCtl();
    if (!ctl) return;
    try {
      if (f.hostile) {
        if (this.prog.boss) ctl.restore(this.prog.boss as BossState);
        else ctl.wake();
        if (f.pressure >= 1) ctl.setStage(3); else if (f.pin) ctl.setStage(2);
      } else if (f.reveal) ctl.cue('lower');
    } catch (e) { console.warn('[story] loader restore failed', e); }
  }
  /** afterSnap: screens, the frame, lights, the cut tether, the dead loader's wreck, the lockers. */
  protected bossSnap(): void {
    const f = this.f;
    const api = this.api('frame6');
    if (api && 'screenAuto' in api) (api as { screenAuto: boolean }).screenAuto = false;
    if (f.pin) this.frameApi('pin', 1);
    if (f.pressure >= 1) { this.frameApi('pump', 1); this.frameApi('guard', 1); }
    if (f.trunkCut) {
      const had = this.frameApi('fired');
      this.w.machine('ping6', 'off');
      this.screen('mimic6', 'mimic', 'cut');
      if (!had) this.cutCable(0);   // with the set piece, pool.ts cuts it on `state().fired`
    }
    if (f.hostile) this.snapVig('beacons6');
    if (f.lights_out6) this.snapVig('lights_out6');
    if (f.loaderDead) {
      try { this.bossCtl()?.removeSilently(); } catch { /* ignore */ }
      this.snapVig('loader_dead6');
    }
    if (f.reveal) this.setTransferNote();
    this.pumpK = f.pressure >= 1 ? 1 : 0;
    this.boardText = ''; this.gaugeText = '';
    this.board();
    if (f.shaftOpen) this.gauge();
    this.consoleIdle();
    this.lockersAsSaved();
    this.w.setInteractable('console6', false);
  }

  /** No checkpoint now: a boss grip, the cutscene. */
  protected bossBlocked(): boolean { return !!this.bossGrip || this.inEndingNow; }
  /** A scare may not fire now (§5.7 boss rule: none from the hostile start until `l6_quiet`). */
  protected bossNoScare(): boolean { return this.f.hostile && !this.f.quiet; }
  /** Q in phase K: the boss hint id (null = the route picks it). */
  protected bossHint(): string | null { return null; }
  /** Every boss checkpoint is written with `checkpointNow` (never by the calm saver). */
  protected bossCheckpoint(_id: BossCheckpointId6): CheckpointRule { return { when: () => false, valid: () => false }; }

  protected bossFacts(): BossFacts6 {
    const f = this.f;
    const ctl = this.bossCtl();
    let soldier = false;
    try { soldier = this.ctx.enemies.all.some((e) => e.alive && e.type === 'soldier'); } catch { /* ignore */ }
    let floodAlive = false;
    if (ctl) for (const p of ['flood_1', 'flood_2', 'flood_3', 'flood_4']) { try { if (ctl.partHp(p) > 0) floodAlive = true; } catch { /* ignore */ } }
    const row = ctl ? this.loaderRow() : null;
    const grab = row ? this.grabPos() : null;
    const recovery = !!row && row.mode === 'slam' && row.phase === 'recover' && !!grab && this.sees(grab, 60, 45, false);
    const inView = this.memberInView('g6_loader', 50) || (!!grab && this.sees(grab, 70, 50, false));
    return {
      stage: ctl?.stage ?? 0, loaderAlive: this.loaderAlive(), loaderInView: inView, onDock: this.region3('dock'),
      inCage: this.inTrig('t6_cage'), soldierAlive: soldier, floodLitFor: this.litFor, floodAlive, slamRecoveryInView: recovery,
      ramsGone: (f.ramE ? 1 : 0) + (f.ramW ? 1 : 0), endingPending: f.quiet && f.trunkCut && f.loaderDead && !f.ending,
      inEnding: this.inEndingNow,
    };
  }
  /** §7.1: the loader alive and past `working` is not calm. */
  protected bossBusy(): boolean { return this.f.hostile && !this.f.loaderDead && this.loaderAlive(); }
  /** The objective in phase K past the reveal (null = the route's `The moon pool — down the stairs`). */
  protected bossObjective(): string | null {
    const f = this.f;
    if (f.quiet) return f.ending ? OBJ6.none : OBJ6.console;
    if (f.trunkCut && !f.loaderDead) return OBJ6.loader;
    if (f.trunkCut) return OBJ6.clear;   // cut + loader dead, before the quiet (the fight-out)
    if (f.hostile) return OBJ6.tether;
    return null;
  }
  /** H7 `boss`, `frame`, `ending` (scenes.ts adds the ending's times / result). */
  protected bossDebug(): {
    boss: { stage: number; mode: string | null; parts: Record<string, number>; floods: boolean[]; slots: (string | null)[]; waves: { w1: unknown; w2: unknown; w3: unknown; latest: unknown }; milestones: string[]; hostileAt: number | null };
    frame: { pin: boolean; pressure: number; fired: boolean };
    ending: { pending: boolean; started: boolean; times: Record<string, number> | null; result: string | null };
  } {
    const f = this.f;
    const ctl = this.bossCtl();
    const row = this.loaderRow();
    const parts: Record<string, number> = {};
    for (const p of ['flood_1', 'flood_2', 'flood_3', 'flood_4', 'ram_e', 'ram_w', 'pod']) { try { parts[p] = ctl ? ctl.partHp(p) : 0; } catch { parts[p] = 0; } }
    const w = this.prog.waves;
    return {
      boss: {
        stage: ctl?.stage ?? 0, mode: typeof row?.mode === 'string' ? row.mode : null, parts,
        floods: ['flood_1', 'flood_2', 'flood_3', 'flood_4'].map((p) => (parts[p] ?? 0) > 0),
        slots: this.slots(), waves: { w1: w.w1, w2: w.w2, w3: w.w3, latest: w.latest }, milestones: [...this.milestones], hostileAt: this.hostileAt,
      },
      frame: { pin: f.pin, pressure: f.pressure >= 1 ? 1 : +this.pumpK.toFixed(4), fired: f.trunkCut },
      ending: { pending: this.bossFacts().endingPending, started: f.ending, times: null, result: null },
    };
  }
  /** H13 boss part: `boss`, `slots`, `frame` (the SAVED pressure: 0 or 1), `waves`. */
  protected bossWorld(): { boss: BossState | null; slots: (string | null)[]; frame: { pin: boolean; pressure: number; fired: boolean }; waves: unknown } {
    const ctl = this.bossCtl();
    let snap: BossState | null = null;
    try { snap = ctl ? ctl.snapshot() : null; } catch { snap = null; }
    const f = this.f;
    return { boss: snap, slots: this.slots(), frame: { pin: f.pin, pressure: f.pressure >= 1 ? 1 : 0, fired: f.trunkCut }, waves: { ...this.prog.waves } };
  }
  /** H19: the dock ammo lockers (armed = not taken since the last restore). */
  lockers(): { e: { armed: boolean }; w: { armed: boolean }; n: { armed: boolean } } {
    const l = this.prog.lockers;
    return { e: { armed: !l.e }, w: { armed: !l.w }, n: { armed: !l.n } };
  }
}
