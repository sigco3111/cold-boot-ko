/**
 * Stage 3d §8.13 / §8.3: the grip meter (a thin ring just under the crosshair that follows `player.gripProgress`, −1 = none),
 * its first-grip `Hold E` hint, the `grip_tick` sound, and the key strip (keys held, named by id).
 */
import type { GameContext } from '../core/types';
import { h, toggle } from './dom';

const R = 15, C = 2 * Math.PI * R;
/** Key id → strip name (§8.3). Unknown ids are not shown (levels 1–5 keep their own prompts / toasts). */
export const KEY_NAMES: Record<string, string> = {
  key6_a: '키 A — 헤드엔드',
  key6_b: '키 B — 문풀',
};

const CSS = `
.cb .gripm { position: absolute; left: 50%; top: calc(50% + 34px); width: 40px; height: 40px; margin: 0 0 0 -20px; z-index: 6; pointer-events: none;
  opacity: 0; transition: opacity .2s ease; }
.cb .gripm.show { opacity: 1; }
.cb .gripm svg { width: 100%; height: 100%; display: block; transform: rotate(-90deg); overflow: visible; }
.cb .gripm circle { fill: rgba(3,8,12,.35); stroke: rgba(200,225,235,.28); stroke-width: 2; }
.cb .gripm circle.fill { fill: none; stroke: var(--cyan); stroke-linecap: butt; filter: drop-shadow(0 0 4px rgba(116,228,255,.7)) drop-shadow(0 0 1px #000); transition: stroke .15s; }
.cb .gripm.paused circle.fill { stroke: rgba(200,225,235,.55); filter: drop-shadow(0 0 1px #000); }
.cb .gripm .hint { position: absolute; left: 50%; top: 100%; margin-top: 6px; transform: translateX(-50%); white-space: nowrap; font: 500 10px/1 var(--f-mono);
  letter-spacing: .32em; color: var(--fg-2); text-shadow: 0 0 6px rgba(0,0,0,.95); opacity: 0; transition: opacity .25s ease; }
.cb .gripm.hint-on .hint { opacity: .9; }
.cb .gripm.paused .hint { color: var(--cyan); }
.cb .keystrip { position: absolute; left: 44px; bottom: 205px; display: flex; flex-direction: column; gap: 5px; pointer-events: none; }
.cb .keystrip .k { font: 500 10px/1 var(--f-mono); letter-spacing: .26em; color: #cfeaf2; text-shadow: 0 0 6px rgba(0,0,0,.95); padding-left: 14px; position: relative;
  opacity: 0; transform: translateX(-6px); transition: opacity .4s ease, transform .4s ease; white-space: nowrap; }
.cb .keystrip .k.show { opacity: .9; transform: none; }
.cb .keystrip .k::before { content: ''; position: absolute; left: 0; top: 50%; width: 6px; height: 6px; margin-top: -3px; border: 1px solid var(--cyan); transform: rotate(45deg); background: rgba(116,228,255,.35); }
`;

export class GripMeter {
  private el: HTMLDivElement;
  private arc: SVGCircleElement;
  private strip: HTMLDivElement;
  private keyEls = new Map<string, HTMLElement>();
  private lastP = -1;
  private lastTick = 0;
  private prevP = -1;
  private still = 0;
  private hinted = false;
  private hintLeft = 0;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    if (!document.getElementById('cb-style-grip')) {
      const s = document.createElement('style');
      s.id = 'cb-style-grip';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.el = h('div', 'gripm', parent);
    this.el.innerHTML = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="${R}"/><circle class="fill" cx="20" cy="20" r="${R}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/></svg>`;
    this.arc = this.el.querySelector('circle.fill') as SVGCircleElement;
    h('span', 'hint', this.el, 'E 길게 누르기');
    this.strip = h('div', 'keystrip', parent);
  }

  update(dt: number): void {
    const p = this.ctx.player;
    if (!p) return;
    const g = typeof p.gripProgress === 'number' ? p.gripProgress : -1;
    const on = g >= 0;
    if (on) {
      const v = Math.min(1, Math.max(0, g));
      if (Math.abs(v - this.lastP) > 0.002) { this.lastP = v; this.arc.style.strokeDashoffset = (C * (1 - v)).toFixed(2); }
      // a tick at every 1/12 of the way; a release / pause does not advance, so it is silent
      const step = Math.floor(v * 12);
      if (step > this.lastTick) {
        this.lastTick = step;
        try { this.ctx.audio.play('grip_tick', { volume: 0.35 }); } catch { /* ignore */ }
      } else if (step < this.lastTick) this.lastTick = step;
      this.still = Math.abs(g - this.prevP) < 1e-5 ? this.still + dt : 0;
      this.prevP = g;
      if (!this.hinted) { this.hinted = true; this.hintLeft = 3.2; }
    } else { this.lastP = -1; this.lastTick = 0; this.prevP = -1; this.still = 0; }
    toggle(this.el, 'show', on);
    toggle(this.el, 'paused', on && this.still > 0.15);
    if (this.hintLeft > 0) this.hintLeft -= dt;
    toggle(this.el, 'hint-on', on && (this.hintLeft > 0 || this.still > 0.15));

    for (const [id, name] of Object.entries(KEY_NAMES)) {
      const has = p.hasKey(id);
      let el = this.keyEls.get(id);
      if (has && !el) { el = h('div', 'k', this.strip, name); this.keyEls.set(id, el); void el.offsetWidth; el.classList.add('show'); }
      else if (!has && el) { el.remove(); this.keyEls.delete(id); }
    }
  }
}
