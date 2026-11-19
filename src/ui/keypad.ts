/**
 * Keypad overlay (stage 3c §8.5). Not a pause: the game keeps running, the POINTER STAYS LOCKED. A virtual cursor is
 * driven by the mouse deltas (the story disables player control while it is open, so the camera does not turn);
 * left click presses the key under it; digit keys / numpad / Backspace / Enter work directly. Esc / E, taking damage
 * and any non-`playing` state close it (resolves null) without ever touching the pointer lock.
 * `ctx.debug.keypadInput` (tests): consumed as it opens and typed key by key, then ENT.
 */
import type { GameContext } from '../core/types';
import { h, setText, toggle, sfx } from './dom';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '입력'] as const;
const CURSOR_SPEED = 1.15;
/** Digit1-3 pick weapons: keep them away from the player while the pad is open. */
const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3'];

export class Keypad {
  readonly root: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private dispEl: HTMLDivElement;
  private cells: HTMLDivElement[] = [];
  private keyEls = new Map<string, HTMLDivElement>();
  private cursor: HTMLDivElement;
  private resolve: ((v: string | null) => void) | null = null;
  private digits = 4;
  private value = '';
  private cx = 0;
  private cy = 0;
  private hover: string | null = null;
  private age = 0;
  private flashKey: string | null = null;
  private flashLeft = 0;
  private typeQueue: string[] = [];
  private typeLeft = 0;
  private bad = 0;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'keypad hidden', parent);
    const panel = h('div', 'kp-panel', this.root);
    this.titleEl = h('div', 'kp-title', panel);
    this.dispEl = h('div', 'kp-display', panel);
    this.statusEl = h('div', 'kp-status', panel);
    const grid = h('div', 'kp-grid', panel);
    for (const k of KEYS) {
      this.keyEls.set(k, h('div', `kp-key${k.length > 1 ? ' fn' : ''}${k === '입력' ? ' ent' : ''}`, grid, k));
    }
    h('div', 'kp-hint', panel, '클릭  ·  숫자  ·  입력  ·  ESC');
    this.cursor = h('div', 'kp-cursor', this.root);
    ctx.events.on('player:damaged', () => { if (this.resolve) this.close(); });
  }

  get isOpen(): boolean { return this.resolve !== null; }

  open(o: { digits: number; title: string; panel?: string }): Promise<string | null> {
    if (this.resolve) this.close();
    this.digits = Math.max(1, Math.min(8, o.digits | 0));
    this.value = '';
    this.age = 0;
    this.bad = 0;
    this.typeQueue = [];
    setText(this.titleEl, o.title);
    this.dispEl.innerHTML = '';
    this.cells = [];
    for (let i = 0; i < this.digits; i++) this.cells.push(h('div', 'kp-cell', this.dispEl));
    this.root.classList.remove('hidden');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    this.root.parentElement?.classList.add('kp-open');
    // the cursor starts on the middle of the pad (the "5")
    const r = this.keyEls.get('5')!.getBoundingClientRect();
    const host = this.root.getBoundingClientRect();
    this.cx = r.left + r.width / 2 - host.left;
    this.cy = r.top + r.height / 2 - host.top;
    this.hover = null;
    this.render();
    const injected = this.ctx.debug.keypadInput;
    if (injected) {
      this.ctx.debug.keypadInput = null;
      for (const c of injected.slice(0, 16)) this.typeQueue.push(c);
      this.typeQueue.push('입력');
      this.typeLeft = 0.25;
    }
    return new Promise((res) => { this.resolve = res; });
  }

  close(): void {
    const r = this.resolve;
    if (!r) return;
    this.resolve = null;
    this.hide();
    r(null);
  }

  private hide(): void {
    this.typeQueue = [];
    this.root.classList.remove('show');
    this.root.parentElement?.classList.remove('kp-open');
    setTimeout(() => { if (!this.resolve) this.root.classList.add('hidden'); }, 250);
  }

  private press(k: string): void {
    sfx(this.ctx, 'keypad_beep', 0.55);
    this.flashKey = k === '지움' ? '지움' : k;
    this.flashLeft = 0.14;
    if (k === '지움') this.value = '';
    else if (k === '지움') this.value = this.value.slice(0, -1);
    else if (k === '입력') {
      if (this.value.length < this.digits) {
        sfx(this.ctx, 'keypad_err', 0.5);
        this.bad = 0.4;
      } else {
        const v = this.value, r = this.resolve;
        this.resolve = null;
        this.hide();
        r?.(v);
        return;
      }
    } else if (this.value.length < this.digits) this.value += k;
    this.render();
  }

  private render(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const has = i < this.value.length;
      setText(c, has ? this.value[i] : '');
      toggle(c, 'full', has);
      toggle(c, 'next', i === this.value.length);
    }
  }

  update(dt: number): void {
    if (!this.resolve) return;
    const ctx = this.ctx, inp = ctx.input;
    if (ctx.state !== 'playing') { this.close(); return; }
    this.age += dt;
    // keep Digit1-3 away from the weapon switch (the story also disables control; belt and braces)
    for (const c of WEAPON_KEYS) if (inp.pressed(c) || inp.down(c)) ctx.player?.consumeKey?.(c);

    // the pointer stays locked: deltas move the cursor, which never leaves the screen
    const host = this.root.getBoundingClientRect();
    this.cx = Math.max(0, Math.min(host.width, this.cx + inp.mouseDX * CURSOR_SPEED));
    this.cy = Math.max(0, Math.min(host.height, this.cy + inp.mouseDY * CURSOR_SPEED));
    this.cursor.style.transform = `translate(${this.cx.toFixed(1)}px, ${this.cy.toFixed(1)}px)`;
    let over: string | null = null;
    const x = this.cx + host.left, y = this.cy + host.top;
    for (const [k, el] of this.keyEls) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { over = k; break; }
    }
    if (over !== this.hover) {
      if (this.hover) this.keyEls.get(this.hover)!.classList.remove('hover');
      if (over) this.keyEls.get(over)!.classList.add('hover');
      this.hover = over;
    }
    if (inp.mousePressed(0) && over) this.press(over);
    if (!this.resolve) return;

    // E / Esc leave (not on the frame it opened: the E that opened it is still "pressed")
    if (this.age > 0.2 && (inp.pressed('Escape') || inp.pressed('KeyE'))) { this.close(); return; }
    for (let d = 0; d <= 9; d++) {
      if (inp.pressed(`Digit${d}`) || inp.pressed(`Numpad${d}`)) this.press(String(d));
      if (!this.resolve) return;
    }
    if (inp.pressed('Backspace') || inp.pressed('Delete')) this.press('지움');
    if (inp.pressed('Enter') || inp.pressed('NumpadEnter')) this.press('입력');
    if (!this.resolve) return;

    // test hook: type the injected code key by key (visible, with the clicks)
    if (this.typeQueue.length) {
      this.typeLeft -= dt;
      if (this.typeLeft <= 0) { this.typeLeft = 0.16; this.press(this.typeQueue.shift()!); }
      if (!this.resolve) return;
    }
    if (this.flashLeft > 0 && (this.flashLeft -= dt) <= 0) this.flashKey = null;
    for (const [k, el] of this.keyEls) toggle(el, 'down', this.flashKey === k);
    if (this.bad > 0) this.bad -= dt;
    toggle(this.dispEl, 'bad', this.bad > 0);
    setText(this.statusEl, this.value.length >= this.digits ? 'ENT 누르기' : '코드 입력');
  }
}
