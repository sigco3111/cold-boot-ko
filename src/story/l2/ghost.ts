/**
 * Level 2 script — the two holograms (REVISION 5 "Holograms", REVISION 5.1 "Ghost").
 *
 * PATTERN 14 (`holo_ghost`): Okafor's walk, played by a faulty projector that roams the section. It is a
 * projection, so it may be shot (R2): the enemies module tears and collapses it by itself (also when it is
 * stared at from close); the story only decides where it is.
 *   – introduced on first entering the fitting bays: it flickers on walking in place on the free fourth
 *     rig, steps off and walks away THROUGH a wall;
 *   – afterwards it stands at stations ≥ 5 m from the player, in dim places, on the player's side of the
 *     partition, in phases B, C, D, G, H — never during the taking (E, F);
 *   – collapsed (shot / stared at / walked at): gone for 45–90 s;
 *   – after the supervisor dies it appears once more at the core door, walks into the real Unit 14 standing
 *     there and vanishes; if the real Unit 14 is dead it never returns.
 * PATTERN 00 (`holo_tech`): the reference pattern walking in place on the calibration rig.
 * In-world explanations (one line each): the rig screen, and a fault note on rig 4.
 */
import * as THREE from 'three';
import type { EnemyActor } from '../../core/types';
import { Base, V, face } from './base';
import { SCREEN2 } from './text';

/** What the enemies module's holograms offer beyond the contract (optional at run time). */
type Holo = EnemyActor & { readonly present?: boolean; collapse?: () => void; appear?: () => void };

/** Dim places it may stand, per side of the partition (z = −50.35). */
const STATIONS_NORTH = [V(-7.5, 0, -25.5), V(-8, 0, -34), V(-1.5, 0, -29), V(1.5, 0, -38), V(8.5, 0, -25.5), V(-3, 0, -47.5), V(19, 0, -29), V(11.4, 0, -39), V(19, 0, -39)];
const STATIONS_SOUTH = [V(-8, 0, -54), V(-5, 0, -61), V(-1, 0, -67.5), V(8.8, 0, -53.5), V(8.8, 0, -68), V(-19, 0, -66.5), V(-13, 0, -66), V(17, 0, -57.2)];

export abstract class Ghosted extends Base {
  protected ghost: Holo | null = null;
  private ghostMode: 'none' | 'rig' | 'walk' | 'station' = 'none';
  private ghostAbsentUntil = 0;
  private ghostWallAt = -1e9;
  private ghostSince = 0;
  private ghostUnseenFor = 0;
  protected ghostCommentAt = -1e9;
  private ghostBusy = false;
  protected holoTech: Holo | null = null;

  protected override ghostState() { return this.ghost && this.present(this.ghost) ? this.ghostMode : 'none'; }
  protected override ghostThroughWallAt() { return this.ghostWallAt; }
  protected override rigPlaying() { return !!this.holoTech; }
  protected override ghostBehind(): boolean {
    const g = this.ghost;
    if (!g || !this.present(g) || this.ghostMode !== 'station') return false;
    if (this.now - this.ghostCommentAt < 60) return false;
    return this.distTo(g.position) < 25 && this.angleTo(this.headOf(g).clone()) > 100 * Math.PI / 180;
  }

  /** Keep the projection away for a while (after a checkpoint load nothing new turns up at once). */
  protected ghostRest(seconds: number): void { this.ghostAbsentUntil = Math.max(this.ghostAbsentUntil, this.now + seconds); }

  private present(a: Holo): boolean { return a.present !== false && this.actors.has(a); }

  private dropGhost(absent: [number, number] | null): void {
    const g = this.ghost;
    this.ghost = null;
    this.ghostMode = 'none';
    this.drop(g);
    if (absent) this.ghostAbsentUntil = this.now + absent[0] + Math.random() * (absent[1] - absent[0]);
  }
  /** Make it break up (enemies module's own effect), then take it away. */
  private async collapseGhost(): Promise<void> {
    const g = this.ghost;
    if (!g) return;
    this.ghostMode = 'none';
    try { if (g.present !== false) g.collapse?.(); } catch { /* ignore */ }
    await this.hold(0.9);
    if (this.ghost === g) this.dropGhost([45, 90]);
  }

  /** The fourth rig: the free slot in the row of treadmills the level's worker units stand on. */
  private ghostRig(): THREE.Vector3 {
    if (this.w.hasObject('rig_unit14')) return this.w.objectPos('rig_unit14', V(17, 0, -31));
    const s = this.w.spawns('g2_fit_tread').map((x) => x.position);
    if (s.length >= 2) {
      const a = s[0], b = s[s.length - 1];
      const step = b.clone().sub(a).multiplyScalar(1 / (s.length - 1));
      const next = b.clone().add(step), prev = a.clone().sub(step);
      const inside = (p: THREE.Vector3) => p.x > 10.8 && p.x < 19.2 && p.z > -39.2 && p.z < -28.8;
      if (inside(next)) return next.setY(a.y);
      if (inside(prev)) return prev.setY(a.y);
    }
    return V(17.5, 0, -30.5);
  }

  /** The fault note on rig 4 (story-owned readable when the level has none) and what the rig screens say. */
  protected ghostFiction(): void {
    try {
      if (!this.ctx.interactables.get('note2_rig14')) {
        const rig = this.ghostRig();
        // On the rig's post, on the side toward the middle of the room.
        const at = V(rig.x + (rig.x > 15 ? -0.9 : 0.9), 1.15, rig.z);
        this.ctx.interactables.add({ id: 'note2_rig14', kind: 'log', position: at, radius: 2.0, prompt: '리그 고장 기록 읽기', enabled: true });
      }
    } catch { /* ignore */ }
    this.w.screen('fitting_rig14_screen', 'terminal_alert', SCREEN2.rig14);
  }

  /** Pattern 00 on the calibration rig (from `l2_rig`; re-created on load). */
  protected showRigPattern(): void {
    if (this.holoTech) return;
    const rig = this.w.objectPos('rig_ref', V(17.5, 0, -37.5));
    const y = Math.max(rig.y, this.groundY(rig.x, rig.z, 2.5));
    const a = this.actor('husk', V(rig.x, y, rig.z), Math.PI / 2, 'tread', 'holo_tech') as Holo | null;
    this.holoTech = a;
    this.gait(a, 'human');
  }

  /** One thread for the roaming projection. */
  protected async ghostLoop(): Promise<void> {
    this.ctx.events.on('actor:shot', (e) => {
      if (e.actor !== this.ghost || this.ghostMode === 'none') return;
      // The hologram tears and collapses by itself; it is then gone for a while.
      this.ghostMode = 'none';
      const g = this.ghost;
      this.S('ghost_shot', async () => { await this.hold(1.2); if (this.ghost === g) this.dropGhost([45, 90]); });
    });
    this.S('ghost_last', () => this.ghostLast());
    if (!this.f.ghostIntro) {
      await this.until(() => this.live && (this.f.power || this.inRoom('fitting')));
      if (!this.f.power && !this.f.ghostIntro) await this.ghostIntro();
    }
    for (;;) {
      await this.hold(0.4);
      if (this.ended) return;
      if (this.ghostBusy || this.ctx.state !== 'playing') continue;
      const ph = this.phase;
      const allowed = (ph === 'B' || ph === 'C' || ph === 'D' || ph === 'G' || ph === 'H') && this.f.ghostIntro;
      const g = this.ghost;
      if (g) {
        // Collapsed by the stare (enemies side), walked at, or out of its time: away it goes.
        if (!this.present(g)) { this.dropGhost([45, 90]); continue; }
        if (!allowed) { this.dropGhost(null); continue; }
        const d = this.distTo(g.position);
        if (d < 5) { this.ghostBusy = true; await this.collapseGhost(); this.ghostBusy = false; continue; }
        const unseen = this.notLookingAt(this.headOf(g).clone(), 68);
        this.ghostUnseenFor = unseen ? this.ghostUnseenFor + 0.4 : 0;
        // Left behind, or on the other side of the partition: it lets go unseen and turns up again later.
        const side = (z: number) => z > -50.35;
        if (unseen && (d > 30 || side(g.position.z) !== side(this.pos.z) || (this.ghostUnseenFor > 25 && this.now - this.ghostSince > 40))) this.dropGhost([10, 25]);
        continue;
      }
      if (!allowed || this.now < this.ghostAbsentUntil || this.w.active() > 0 || this.noteOpen) continue;
      const spot = this.ghostStation();
      if (!spot) continue;
      const a = this.actor('husk', spot, face(spot, this.pos), 'idle', 'holo_ghost') as Holo | null;
      if (!a) return;
      this.ghost = a;
      this.ghostMode = 'station';
      this.ghostSince = this.now;
      this.ghostUnseenFor = 0;
      this.gait(a, 'limp');
      this.lookAt(a, this.ctx.player.eye);
    }
  }

  /** A station on the player's side, 9–24 m away, outside the view (it is found, it never pops in). */
  private ghostStation(): THREE.Vector3 | null {
    const north = this.pos.z > -50.35;
    let best: THREE.Vector3 | null = null, bestScore = -1e9;
    for (const s of north ? STATIONS_NORTH : STATIONS_SOUTH) {
      const d = this.distTo(s);
      if (d < 9 || d > 24) continue;
      const head = this.tmp2.set(s.x, 1.55, s.z).clone();
      const sees = this.los(head);
      if (this.angleTo(head) < 72 * Math.PI / 180 && sees) continue;
      const score = (sees ? 6 : 0) - Math.abs(d - 13) * 0.4 + Math.random();
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best ? best.clone() : null;
  }

  /** It flickers on walking in place on the fourth rig, steps off, and leaves through the wall. */
  private async ghostIntro(): Promise<void> {
    const rig = this.ghostRig();
    this.f.ghostIntro = true;
    const a = this.actor('husk', rig, Math.PI / 2, 'tread', 'holo_ghost') as Holo | null;
    if (!a) return;
    this.ghostBusy = true;
    this.ghost = a;
    this.ghostMode = 'rig';
    this.ghostSince = this.now;
    this.gait(a, 'limp');
    const head = () => this.headOf(a).clone();
    const gone = () => this.ghost !== a || !this.present(a) || this.f.power;
    // It has to be seen on the rig first — but it does not wait for ever.
    await this.untilOr(() => gone() || (this.inRoom('fitting') && this.isLookingAt(head(), 30, true) && this.distTo(a.position) < 14), 20);
    if (!gone()) {
      void this.talk.lines(['l2_tomas_unit14'], { pri: 'talk' });
      await this.untilOr(gone, 3.2);
    }
    if (!gone()) {
      // Off the belt and straight at the nearest wall of the bay (x 10…20, z −40…−28) — and through it.
      this.ghostMode = 'walk';
      this.pose(a, 'idle');
      const walls = [V(rig.x, 0, -28), V(20, 0, rig.z), V(rig.x, 0, -40)].sort((p, q) => p.distanceTo(rig) - q.distanceTo(rig));
      const wall = walls[0];
      const dir = wall.clone().sub(rig).setY(0).normalize();
      const through = wall.clone().addScaledVector(dir, 1.4).setY(0);
      // Step off the side of the rig first (rigs stand in a row along z).
      const off = V(rig.x + (rig.x > 15 ? -1.3 : 1.3), 0, rig.z);
      const path = Math.abs(dir.x) > 0.5 ? [through] : [off, V(off.x, 0, wall.z + (wall.z > -34 ? -0.3 : 0.3)), V(off.x, 0, through.z)];
      let seen = false;
      const watch = () => { if (this.inRoom('fitting') && this.isLookingAt(head(), 45) && this.distTo(a.position) < 16) seen = true; return gone(); };
      await Promise.race([this.walk(a, path, 0.85), this.until(watch)]);
      watch();
      if (!gone()) {
        if (seen) this.ghostWallAt = this.now;
        this.dropGhost([35, 60]);
        void this.talk.lines(['l2_tomas_unit14_off'], { pri: 'talk' });
      }
    }
    if (this.ghost === a && !this.present(a)) this.dropGhost([45, 90]);
    else if (this.ghost === a && this.f.power) this.dropGhost(null);
    this.ghostBusy = false;
  }

  /** The last time: at the core door it walks into the real Unit 14 and is gone. */
  private async ghostLast(): Promise<void> {
    await this.until(() => this.f.foremanDead);
    if (this.f.unit14Dead || this.has('#ghost_last')) return;
    await this.hold(1.0);
    const real = () => this.unit14();
    await this.until(() => {
      if (this.f.unit14Dead || this.f.core || this.ended) return true;
      const u = real();
      if (!u || this.w.active() > 0 || this.ghostBusy) return false;
      const d = this.distTo(u.position);
      return d > 7 && d < 18 && this.isLookingAt(this.tmp2.copy(u.position).setY(1.5).clone(), 50, true);
    });
    const u = real();
    if (!u || this.f.unit14Dead || this.f.core || this.ended || u.state !== 'dormant' || !this.once('ghost_last')) return;
    this.ghostBusy = true;
    this.dropGhost(null);
    // It comes from the side away from the player, 4 m out, never nearer than 5 m to them.
    const toPlayer = this.pos.clone().sub(u.position).setY(0).normalize();
    const side = V(-toPlayer.z, 0, toPlayer.x);
    let from = u.position.clone().addScaledVector(side, 4).setY(0);
    const alt = u.position.clone().addScaledVector(side, -4).setY(0);
    if (this.distTo(alt) > this.distTo(from) || from.x < -9 || from.x > 9) from = alt;
    const a = this.actor('husk', from, face(from, u.position), 'idle', 'holo_ghost') as Holo | null;
    if (a) {
      this.ghost = a;
      this.ghostMode = 'walk';
      this.gait(a, 'limp');
      const gone = () => !this.present(a) || !real();
      await Promise.race([this.walk(a, [u.position.clone().setY(from.y)], 0.8), this.until(gone)]);
      // Inside the unit: the projection is gone, and the unit's eye comes on.
      if (this.present(a) && real()) {
        try { (u as unknown as { setEyes?: (on: boolean) => void }).setEyes?.(true); } catch { /* ignore */ }
        this.w.play('terminal_beep', u.position.clone().setY(1.5), 0.25);
      }
      if (this.ghost === a) this.dropGhost(null);
    }
    this.ghostAbsentUntil = 1e9; // it never roams again
    this.ghostBusy = false;
  }
}
