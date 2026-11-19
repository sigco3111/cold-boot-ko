/**
 * Foreman (level-2 boss) indicator: three small head pips under the checkpoint corner that go dark as its
 * heads are destroyed. No bar, no numbers — it reads like a status lamp strip on the machine.
 *
 * The contract has no per-part events, so head state is read defensively from the enemy object (several
 * plausible shapes, see `readHeads`) and, failing that, estimated from its remaining health.
 */
import type { Enemy, GameContext } from '../core/types';
import { h, svg, toggle } from './dom';

const HEADS = ['head_a', 'head_b', 'head_c'] as const;
const HEAD_PATH = 'M6 1.2 C9.2 1.2 10.8 3.6 10.8 6.6 C10.8 9.6 9 12.6 6 12.8 C3 12.6 1.2 9.6 1.2 6.6 C1.2 3.6 2.8 1.2 6 1.2 Z';
const EYE_PATH = 'M3.6 6.4 H8.4';

function aliveOf(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v > 0;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.alive === 'boolean') return o.alive;
    if (typeof o.dead === 'boolean') return !o.dead;
    if (typeof o.destroyed === 'boolean') return !o.destroyed;
    if (typeof o.health === 'number') return o.health > 0;
    if (typeof o.hp === 'number') return o.hp > 0;
  }
  return null;
}

/** Per-head alive flags, or null when the enemy exposes nothing usable. */
export function readHeads(enemy: Enemy): boolean[] | null {
  const e = enemy as unknown as Record<string, any>;
  const fromList = (list: unknown): boolean[] | null => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const r = list.slice(0, 3).map(aliveOf);
    return r.every((x) => x !== null) ? (r as boolean[]) : null;
  };
  const fromRecord = (rec: unknown): boolean[] | null => {
    if (!rec || typeof rec !== 'object') return null;
    const r = HEADS.map((k) => aliveOf((rec as Record<string, unknown>)[k]));
    return r.every((x) => x !== null) ? (r as boolean[]) : null;
  };
  try {
    for (const src of [e.heads, e.headHealth, e.object?.userData?.heads]) {
      const r = fromList(src) ?? fromRecord(src);
      if (r) return r;
    }
    for (const src of [e.parts, e.partHealth, e.object?.userData?.parts]) {
      const r = fromRecord(src);
      if (r) return r;
    }
    const n = typeof e.headsAlive === 'number' ? e.headsAlive : typeof e.object?.userData?.headsAlive === 'number' ? e.object.userData.headsAlive : null;
    if (n !== null) return [0, 1, 2].map((i) => i < n);
  } catch { /* defensive: never throw from the HUD */ }
  return null;
}

export class BossPips {
  readonly root: HTMLDivElement;
  private pips: HTMLSpanElement[] = [];
  private id: number | null = null;
  private maxHp = 0;
  private alive = [true, true, true];
  private hideLeft = 0;
  private poll = 0;
  private shown = false;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'boss', parent);
    h('span', 'lbl', this.root, '라인 포먼');
    const row = h('div', 'heads', this.root);
    for (let i = 0; i < 3; i++) {
      const p = h('span', 'head', row);
      svg('0 0 12 14', [HEAD_PATH, EYE_PATH], p);
      this.pips.push(p);
    }
    const ev = ctx.events;
    const track = (e: { id: number; type: string }) => {
      if (e.type !== 'foreman') return;
      if (this.id !== e.id) { this.id = e.id; this.maxHp = 0; this.alive = [true, true, true]; this.render(); }
      this.hideLeft = 0;
      this.setShown(true);
    };
    ev.on('enemy:woke', track);
    ev.on('enemy:alerted', track);
    ev.on('enemy:damaged', (e) => {
      if (e.type !== 'foreman') return;
      track(e);
      this.refresh(true);
    });
    ev.on('enemy:died', (e) => {
      if (e.type !== 'foreman' || (this.id !== null && e.id !== this.id)) return;
      this.alive = [false, false, false];
      this.render();
      this.hideLeft = 2.6;
    });
  }

  private enemy(): Enemy | null {
    if (this.id === null) return null;
    try { return this.ctx.enemies?.all?.find((x) => x.id === this.id) ?? null; } catch { return null; }
  }

  private refresh(hit: boolean): void {
    const e = this.enemy();
    if (!e) return;
    let next = readHeads(e);
    if (!next) {
      // No per-head state exposed: estimate from health (three heads share the pool).
      const hp = Math.max(0, e.health ?? 0);
      const mx = (e as unknown as { maxHealth?: number }).maxHealth;
      this.maxHp = Math.max(this.maxHp, typeof mx === 'number' && mx > 0 ? mx : hp, 1);
      const n = e.alive === false ? 0 : Math.max(1, Math.ceil((hp / this.maxHp) * 3 - 1e-6));
      next = [0, 1, 2].map((i) => i < n);
    }
    if (e.alive === false) next = [false, false, false];
    const lost = next.map((a, i) => this.alive[i] && !a);
    this.alive = next;
    this.render();
    lost.forEach((l, i) => { if (l) this.flash(this.pips[i], 'die'); });
    if (hit && !lost.some(Boolean)) this.flash(this.root, 'hit');
  }

  private flash(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  private render(): void {
    this.pips.forEach((p, i) => toggle(p, 'dead', !this.alive[i]));
  }

  private setShown(v: boolean): void {
    if (v === this.shown) return;
    this.shown = v;
    toggle(this.root, 'show', v);
  }

  update(dt: number): void {
    if (!this.shown) return;
    if (this.hideLeft > 0 && (this.hideLeft -= dt) <= 0) { this.setShown(false); this.id = null; return; }
    if ((this.poll -= dt) <= 0) {
      this.poll = 0.25;
      if (this.hideLeft <= 0) {
        const e = this.enemy();
        if (!e) { if (this.id !== null) this.hideLeft = 0.8; }
        else this.refresh(false);
      }
    }
  }
}
