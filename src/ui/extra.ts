/** Chapter-3 UI additions (task P5): skip ring, end-card eyebrow/title, long place names. Own stylesheet, scoped under `.cb`. */
import { h } from './dom';

export const EXTRA_CSS = `
.cb .skipring { position: absolute; right: 44px; bottom: 36px; z-index: 12; display: flex; align-items: center; gap: 12px; pointer-events: none;
  opacity: 0; transition: opacity .35s ease; text-shadow: 0 0 8px rgba(0,0,0,.9); }
.cb .skipring.show { opacity: .78; }
.cb .skipring .lbl { color: var(--fg-2); letter-spacing: .32em; }
.cb .skipring svg { width: 22px; height: 22px; display: block; transform: rotate(-90deg); overflow: visible; }
.cb .skipring circle { fill: rgba(3,8,12,.55); stroke: var(--faint); stroke-width: 1.5; }
.cb .skipring circle.fill { fill: none; stroke: var(--cyan); stroke-linecap: butt; filter: drop-shadow(0 0 4px rgba(116,228,255,.7)); }
.cb .skipring.done circle.fill { stroke: var(--fg); }

.cb .location { padding: 0 5vw; text-wrap: balance; }
.cb .location span { display: inline-block; max-width: 100%; margin-right: -.72em; }
.cb .location small { margin-right: -.45em; }

.cb .card.card-ending .ln.eyebrow { font: 500 10px/1 var(--f-mono); letter-spacing: .32em; margin-right: -.32em; color: var(--dim); margin-bottom: 6px; }
.cb .card.card-ending .ln.eyebrow.show { letter-spacing: .36em; }
.cb .card.card-ending .ln.etitle { font: 100 clamp(40px, 5.2vw, 76px)/1.1 var(--f-thin); letter-spacing: .6em; margin-right: -.4em; color: #eef8ff; }
.cb .card.card-ending .ln.etitle.show { letter-spacing: .42em; text-shadow: 0 0 22px rgba(120,220,255,.35), 0 0 2px rgba(200,240,255,.6); }
`;

export function ensureExtraCss(): void {
  if (document.getElementById('cb-style-p5')) return;
  const s = document.createElement('style');
  s.id = 'cb-style-p5';
  s.textContent = EXTRA_CSS;
  document.head.appendChild(s);
}

const R = 9, C = 2 * Math.PI * R;

/** Bottom-right "hold to skip" ring. progress 0…1 fills it; null hides it. No input handling. */
export class SkipRing {
  private el: HTMLDivElement;
  private arc: SVGCircleElement;
  constructor(parent: HTMLElement) {
    ensureExtraCss();
    this.el = h('div', 'skipring', parent);
    this.el.innerHTML = `<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="${R}"/><circle class="fill" cx="11" cy="11" r="${R}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/></svg>`;
    this.arc = this.el.querySelector('circle.fill') as SVGCircleElement;
    h('span', 'lbl', this.el, '스페이스를 길게 눌러 건너뛰기');
  }
  set(progress: number | null): void {
    if (progress == null || !Number.isFinite(progress)) { this.el.classList.remove('show', 'done'); return; }
    const p = Math.min(1, Math.max(0, progress));
    this.arc.style.strokeDashoffset = (C * (1 - p)).toFixed(2);
    this.el.classList.add('show');
    this.el.classList.toggle('done', p >= 1);
  }
}
