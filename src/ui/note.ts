/**
 * Compact NOTE card for short readable fragments (revision 2): a small slip near the lower middle of the
 * screen — a header line plus one to five lines of text that type in quickly. It never fills the screen
 * and never pauses the world. Closes with E / Esc / click, by walking away (> 3 m after ≥ 1.5 s), or when
 * the player is hurt.
 */
import * as THREE from 'three';
import type { GameContext } from '../core/types';
import type { NoteStyle } from '../story/text';
import { h, sfx, Typewriter } from './dom';

const STYLE_LABEL: Record<NoteStyle, string> = { paper: '쪽지', terminal: '단말기', tag: '태그', voice: '재생' };
const WALK_AWAY = 3;
const WALK_AWAY_MIN_OPEN = 1.5;

export class NoteCard {
  readonly root: HTMLDivElement;
  private card: HTMLDivElement;
  private kind: HTMLSpanElement;
  private header: HTMLSpanElement;
  private body: HTMLDivElement;
  private tw: Typewriter;
  private bars: HTMLElement[] = [];
  private openFor = 0;
  private resolve: (() => void) | null = null;
  private origin = new THREE.Vector3();
  private style: NoteStyle = 'paper';

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'note hidden', parent);
    this.card = h('div', 'ncard', this.root);
    const top = h('div', 'ntop', this.card);
    const wave = h('span', 'nwave', top);
    for (let i = 0; i < 5; i++) this.bars.push(h('i', '', wave));
    this.kind = h('span', 'nkind', top, '노트');
    this.header = h('span', 'nhead', top, '');
    const close = h('span', 'nclose', top);
    h('span', 'key', close, 'E');
    this.body = h('div', 'nbody', this.card);
    this.tw = new Typewriter(this.body, 110);
    ctx.events.on('player:damaged', () => this.close());
    ctx.events.on('game:state', (e) => { if (e.state === 'dead' || e.state === 'ended' || e.state === 'menu') this.close(); });
  }

  get isOpen(): boolean { return this.resolve !== null; }

  open(header: string, body: string, style: NoteStyle = 'paper'): Promise<void> {
    if (this.resolve) this.close();
    this.style = style;
    this.root.className = `note n-${style}`;
    this.kind.textContent = STYLE_LABEL[style] ?? '노트';
    this.header.textContent = header;
    // About a second to type any fragment in, whatever its length.
    this.tw.start(body, Math.max(150, body.length / 1.0));
    this.openFor = 0;
    try { this.origin.copy(this.ctx.player.position); } catch { /* ignore */ }
    void this.root.offsetWidth;
    this.root.classList.add('show');
    sfx(this.ctx, 'ui_open', 0.35);
    return new Promise((r) => { this.resolve = r; });
  }

  close(): void {
    const r = this.resolve;
    if (!r) return;
    this.resolve = null;
    this.root.classList.remove('show');
    sfx(this.ctx, 'ui_close', 0.3);
    setTimeout(() => { if (!this.resolve) this.root.classList.add('hidden'); }, 320);
    r();
  }

  update(dt: number): void {
    if (!this.resolve) return;
    const ctx = this.ctx;
    // Frozen (not closed) while the pause menu is up.
    if (ctx.state !== 'playing' && ctx.state !== 'cutscene') return;
    this.openFor += dt;
    this.tw.update(dt);
    if (this.style === 'voice') {
      const t = performance.now() / 1000;
      for (let i = 0; i < this.bars.length; i++) {
        const a = this.tw.done ? 0.3 : 0.4 + Math.abs(Math.sin(t * (6 + i * 1.9) + i)) * 0.9;
        this.bars[i].style.transform = `scaleY(${(a * 2.4).toFixed(2)})`;
      }
    }
    const inp = ctx.input;
    if (this.openFor >= 0.3) {
      if (inp.pressed('KeyE') || inp.pressed('Escape')) { this.close(); return; }
      if (inp.mousePressed(0)) {
        if (!this.tw.done) this.tw.finish(); else { this.close(); return; }
      }
    }
    if (this.openFor >= WALK_AWAY_MIN_OPEN) {
      let far = false;
      try { far = ctx.player.position.distanceTo(this.origin) > WALK_AWAY; } catch { /* ignore */ }
      if (far) this.close();
    }
  }
}
