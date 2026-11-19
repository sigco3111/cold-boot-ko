/**
 * Loader (level-6 boss) indicator (stage 3d §8.13): label `DOCK LOADER` and three lamps (west ram, east ram, pod), in the
 * foreman's look (`boss.ts`, unchanged). A lamp goes dark on `enemy:part-destroyed`; a hit on a part that does no damage
 * (a retracted ram, the shut pod: `amount` 0) shakes that lamp. Re-synced from `enemies.boss(group).partHp` every 0.25 s
 * (a checkpoint restore rebuilds the parts without events).
 */
import type { GameContext } from '../core/types';
import { h, svg, toggle } from './dom';

const PARTS = ['ram_w', 'ram_e', 'pod'] as const;
const PATHS: Record<(typeof PARTS)[number], string[]> = {
  ram_w: ['M1.5 3 H8 V11 H1.5 Z', 'M8 7 H11'],
  ram_e: ['M10.5 3 H4 V11 H10.5 Z', 'M4 7 H1'],
  pod: ['M6 1.2 C9.4 1.2 10.8 4 10.8 7 C10.8 10 9.2 12.8 6 12.8 C2.8 12.8 1.2 10 1.2 7 C1.2 4 2.6 1.2 6 1.2 Z', 'M6 4.5 V9.5'],
};

export class LoaderPips {
  readonly root: HTMLDivElement;
  private pips = new Map<string, HTMLSpanElement>();
  private alive = new Map<string, boolean>(PARTS.map((p) => [p, true]));
  private id: number | null = null;
  private hideLeft = 0;
  private poll = 0;
  private shown = false;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'boss loader', parent);
    h('span', 'lbl', this.root, '도크 로더');
    const row = h('div', 'heads', this.root);
    for (const part of PARTS) {
      const p = h('span', 'head part', row);
      svg('0 0 12 14', PATHS[part], p);
      this.pips.set(part, p);
    }
    const ev = ctx.events;
    const track = (e: { id: number; type: string }) => {
      if (e.type !== 'loader') return;
      if (this.id !== e.id) { this.id = e.id; this.alive.forEach((_, k) => this.alive.set(k, true)); this.render(); }
      this.hideLeft = 0;
      this.setShown(true);
    };
    ev.on('enemy:woke', track);
    ev.on('enemy:alerted', track);
    ev.on('enemy:damaged', (e) => {
      if (e.type !== 'loader') return;
      track(e);
      const el = e.part ? this.pips.get(e.part) : undefined;
      if (el && (e.amount ?? 0) <= 0) this.flash(el, 'clank');
    });
    ev.on('enemy:part-destroyed', (e) => {
      if (e.type !== 'loader') return;
      track(e);
      const el = this.pips.get(e.part);
      if (!el) return;
      this.alive.set(e.part, false);
      this.render();
      this.flash(el, 'die');
    });
    ev.on('enemy:died', (e) => {
      if (e.type !== 'loader' || (this.id !== null && e.id !== this.id)) return;
      this.alive.forEach((_, k) => this.alive.set(k, false));
      this.render();
      this.hideLeft = 2.6;
    });
  }

  private flash(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  private render(): void {
    this.pips.forEach((p, k) => toggle(p, 'dead', !this.alive.get(k)));
  }

  private setShown(v: boolean): void {
    if (v === this.shown) return;
    this.shown = v;
    toggle(this.root, 'show', v);
  }

  update(dt: number): void {
    if (!this.shown) return;
    if (this.hideLeft > 0 && (this.hideLeft -= dt) <= 0) { this.setShown(false); this.id = null; return; }
    if ((this.poll -= dt) > 0 || this.hideLeft > 0) return;
    this.poll = 0.25;
    try {
      const en = this.ctx.enemies?.all?.find((x) => x.id === this.id) ?? null;
      if (!en) { if (this.id !== null) this.hideLeft = 0.8; return; }
      const b = this.ctx.enemies.boss?.(en.group);
      if (b) {
        for (const part of PARTS) {
          const a = b.partHp(part) > 0;
          if (a !== this.alive.get(part)) { this.alive.set(part, a); this.render(); }
        }
      }
    } catch { /* never throw from the HUD */ }
  }
}
