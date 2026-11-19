/** Main menu, settings panel and controls list (settings + controls are reused by the pause screen). */
import type { GameContext, Quality } from '../core/types';
import { h, button, sfx, saveSettings, type Settings, glyph, toggle } from './dom';
import { saveInfo, clearAllProgress, reloadInto, requestBegin, requestContinue, type SaveInfo } from './progress';
import { FIRST_LEVEL, levelInfo, levelOf } from '../core/progress';

/** sessionStorage: BEGIN on a level-2 page reloaded into level 1 — the next menu is a one-click "begin" gate. */
const BEGIN_FRESH_KEY = 'coldboot.beginFresh';

const QUALITIES: Quality[] = ['low', 'medium', 'high', 'ultra'];

export function settingsPanel(ctx: GameContext, settings: Settings, parent: HTMLElement): HTMLDivElement {
  const p = h('div', 'panel interactive', parent);
  h('h3', '', p, '설정');

  // quality
  const q = h('div', 'setting', p);
  const ql = h('div', 'lbl', q);
  h('span', '', ql, '렌더 품질');
  const qv = h('span', '', ql, '');
  const seg = h('div', 'seg', q);
  const qButtons = QUALITIES.map((name) => {
    const b = h('button', '', seg, name);
    b.addEventListener('mouseenter', () => sfx(ctx, 'ui_hover', 0.3));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx(ctx, 'ui_click', 0.6);
      try { ctx.render.setQuality(name); } catch (err) { console.warn('[ui] setQuality failed', err); }
      settings.quality = name;
      saveSettings(settings);
      sync();
    });
    return b;
  });

  // master volume
  const v = h('div', 'setting', p);
  const vl = h('div', 'lbl', v);
  h('span', '', vl, '전체 음량');
  const vv = h('span', '', vl, '');
  const range = h('input', 'interactive', v);
  range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '1';
  range.addEventListener('input', () => {
    settings.volume = Number(range.value) / 100;
    try { ctx.audio.setMasterVolume(settings.volume); } catch { /* ignore */ }
    sync();
  });
  range.addEventListener('change', () => { saveSettings(settings); sfx(ctx, 'ui_click', 0.5); });

  // mouse sensitivity — only if the player module exposes a numeric `sensitivity`.
  const pl = ctx.player as unknown as { sensitivity?: number } | undefined;
  let sens: HTMLInputElement | null = null, sv: HTMLSpanElement | null = null;
  if (pl && typeof pl.sensitivity === 'number') {
    const base = pl.sensitivity;
    const s = h('div', 'setting', p);
    const sl = h('div', 'lbl', s);
    h('span', '', sl, '마우스 감도');
    sv = h('span', '', sl, '');
    sens = h('input', 'interactive', s);
    sens.type = 'range'; sens.min = '20'; sens.max = '300'; sens.step = '5';
    const mult = () => (settings.sensitivity ?? 1);
    sens.value = String(Math.round(mult() * 100));
    sens.addEventListener('input', () => {
      settings.sensitivity = Number(sens!.value) / 100;
      pl.sensitivity = base * settings.sensitivity;
      sync();
    });
    sens.addEventListener('change', () => saveSettings(settings));
  }

  function sync() {
    const cur = (ctx.render?.quality ?? settings.quality ?? 'high') as Quality;
    qButtons.forEach((b, i) => toggle(b, 'on', QUALITIES[i] === cur));
    qv.textContent = cur.toUpperCase();
    const pct = Math.round(settings.volume * 100);
    range.value = String(pct);
    range.style.setProperty('--p', pct + '%');
    vv.textContent = String(pct);
    if (sens && sv) {
      sens.style.setProperty('--p', ((Number(sens.value) - 20) / 280 * 100) + '%');
      sv.textContent = (Number(sens.value) / 100).toFixed(2) + '×';
    }
  }
  sync();
  return p;
}

const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], '이동'],
  [['SHIFT'], '달리기'],
  [['SPACE'], '점프'],
  [['C'], '웅크리기'],
  [['LMB'], '발사'],
  [['RMB'], '조준 (길게, 카빈)'],
  [['R'], '재장전'],
  [['1', '2', '3'], '무기'],
  [['F'], '손전등'],
  [['E'], '사용'],
  [['ESC'], '일시 정지'],
];

export function controlsPanel(parent: HTMLElement): HTMLDivElement {
  const p = h('div', 'panel', parent);
  h('h3', '', p, '조작');
  const g = h('div', 'controls', p);
  for (const [keys, label] of CONTROLS) {
    const k = h('div', 'k', g);
    for (const key of keys) h('span', 'key', k, key);
    h('div', 'd', g, label);
  }
  return p;
}

/** Title with per-letter glitching + an occasional horizontal tear. */
export class GlitchTitle {
  readonly el: HTMLHeadingElement;
  private spans: HTMLSpanElement[] = [];
  private next = 1.5;
  private restore: { s: HTMLSpanElement; t: number; ch: string }[] = [];
  constructor(parent: HTMLElement, text: string) {
    this.el = h('h1', 'title', parent);
    for (const ch of text) {
      const s = h('span', '', this.el, ch === ' ' ? ' ' : ch);
      this.spans.push(s);
    }
    const ghost = h('span', 'ghost', this.el, text);
    ghost.setAttribute('aria-hidden', 'true');
  }
  update(dt: number): void {
    for (let i = this.restore.length - 1; i >= 0; i--) {
      const r = this.restore[i];
      if ((r.t -= dt) <= 0) { r.s.textContent = r.ch; r.s.className = ''; this.restore.splice(i, 1); }
    }
    if ((this.next -= dt) > 0) return;
    this.next = 0.8 + Math.random() * 3.2;
    const n = Math.random() < 0.25 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const s = this.spans[(Math.random() * this.spans.length) | 0];
      if (s.textContent === ' ' || this.restore.some((r) => r.s === s)) continue;
      const ch = s.textContent!;
      const mode = Math.random();
      if (mode < 0.5) { s.textContent = glyph(); s.className = 'g'; }
      else if (mode < 0.8) { s.className = 'x'; }
      else { s.className = 'g'; }
      this.restore.push({ s, t: 0.05 + Math.random() * 0.14, ch });
    }
    if (Math.random() < 0.3) {
      this.el.classList.remove('tear');
      void this.el.offsetWidth;
      this.el.classList.add('tear');
    }
  }
}

export class MainMenu {
  readonly root: HTMLDivElement;
  private title: GlitchTitle;
  private side: HTMLDivElement;
  private sideMode: 'settings' | 'controls' | null = null;
  private sys: HTMLDivElement;
  private items: HTMLButtonElement[] = [];
  private continueBtn: HTMLButtonElement;
  private continueWhere: HTMLSpanElement;
  private levelLine: HTMLDivElement;
  private levelLineText: HTMLSpanElement;
  private info: SaveInfo | null = null;
  private freshGate: HTMLDivElement | null = null;
  /** How the menu was left (read by the story after `open()` resolves). */
  choice: 'begin' | 'continue' = 'begin';
  private resolve: (() => void) | null = null;
  // Enter takes the first entry: CONTINUE when there is a checkpoint, otherwise BEGIN.
  private keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Enter' && this.resolve) this.begin(this.continueBtn.classList.contains('hidden') ? 'begin' : 'continue');
  };
  private sysT = 61 * 3600 + 2 * 60 + 17;
  private sysAcc = 0;

  constructor(private ctx: GameContext, private settings: Settings, parent: HTMLElement) {
    const root = this.root = h('div', 'layer ov menu grain scan hidden', parent);
    const col = h('div', 'col', root);
    const eb = h('div', 'eyebrow', col);
    h('span', 'dot', eb);
    h('span', 'lbl', eb, '할시온 다이내믹스  ·  에리두 심해 기지  ·  하부 3층');
    this.title = new GlitchTitle(col, 'COLD BOOT');
    h('div', 'subtitle', col, '기계들은 계속 일하고 있었다.');
    h('div', 'rule2', col);
    const items = h('div', 'items', col);
    // CONTINUE sits above BEGIN and only exists while a checkpoint is stored (see open()).
    this.levelLine = h('div', 'lvlline lbl hidden', items);
    h('i', '', this.levelLine);
    this.levelLineText = h('span', '', this.levelLine, '');
    this.continueBtn = button(ctx, items, '이어하기', '00', () => this.begin('continue'), 'primary hidden');
    this.continueWhere = h('span', 'where', this.continueBtn, '');
    this.items.push(button(ctx, items, '시작', '01', () => this.begin('begin'), 'primary'));
    this.items.push(button(ctx, items, '설정', '02', () => this.showSide('settings')));
    this.items.push(button(ctx, items, '조작', '03', () => this.showSide('controls')));

    this.side = h('div', 'side', root);

    const foot = h('div', 'foot', root);
    const warn = h('div', 'warn', foot);
    warn.innerHTML = '<b>▲ Headphones recommended.</b><br>Contains flashing lights, sudden loud sounds and violence.';
    this.sys = h('div', 'sys', foot);
    this.renderSys();
  }

  private showSide(mode: 'settings' | 'controls'): void {
    const same = this.sideMode === mode;
    this.items[1].classList.toggle('sel', !same && mode === 'settings');
    this.items[2].classList.toggle('sel', !same && mode === 'controls');
    this.side.classList.remove('show');
    if (same) { this.sideMode = null; return; }
    this.sideMode = mode;
    this.side.innerHTML = '';
    if (mode === 'settings') settingsPanel(this.ctx, this.settings, this.side);
    else controlsPanel(this.side);
    void this.side.offsetWidth;
    this.side.classList.add('show');
  }

  private renderSys(): void {
    const t = this.sysT;
    const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = Math.floor(t % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    this.sys.innerHTML = `CHOIR  ·  3,962 NODES RESPONDING<br>SURFACE UPLINK  <em>■ LOST</em>  ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }

  open(): Promise<void> {
    const info = this.info = saveInfo();
    toggle(this.continueBtn, 'hidden', !info);
    const where = info?.place ?? '';
    this.continueWhere.textContent = where ? `—  ${where}` : '';
    // §8.1: the stored level's menu line ("Level 2 — Line Two", "Chapter 3 — The Quiet Side"); none for level 1
    const line = info ? levelInfo(info.level).menuLine : null;
    this.levelLineText.textContent = line ?? '';
    toggle(this.levelLine, 'hidden', !line);
    this.choice = 'begin';
    let fresh = false;
    try { fresh = sessionStorage.getItem(BEGIN_FRESH_KEY) === '1'; sessionStorage.removeItem(BEGIN_FRESH_KEY); } catch { /* ignore */ }
    if (fresh && !info) return this.openFreshGate();
    this.root.classList.remove('hidden', 'leaving');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    addEventListener('keydown', this.keyHandler);
    return new Promise((r) => { this.resolve = r; });
  }

  /** After BEGIN reloaded a level-2 page into level 1: one click (the audio / pointer-lock gesture) and go. */
  private openFreshGate(): Promise<void> {
    const g = this.freshGate = h('div', 'layer ov gate interactive grain scan', this.root.parentElement!);
    const st = h('div', 'stage', g);
    h('h2', 'glow', st, 'COLD BOOT');
    h('div', 'lbl', st, `클릭하여 시작  ·  ${levelInfo(FIRST_LEVEL).place}`);
    void g.offsetWidth;
    g.classList.add('show');
    return new Promise((r) => {
      this.resolve = r;
      const go = () => { removeEventListener('keydown', onKey); this.begin('begin'); };
      const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
      g.addEventListener('click', go, { once: true });
      addEventListener('keydown', onKey);
    });
  }

  private begin(choice: 'begin' | 'continue'): void {
    const r = this.resolve;
    if (!r) return;
    const here = levelOf(this.ctx).id;
    if (choice === 'begin') {
      // BEGIN always starts the whole game over: level 1, no checkpoints, no carried loadout.
      clearAllProgress();
      // A page forced to a level by its URL (?level=2) begins THAT level; the story handles it.
      if (here !== FIRST_LEVEL && this.ctx.debug.level !== here) {
        this.resolve = null;
        // The story's own begin request (one-click gate + intro); our gate is the fallback for older builds.
        if (!requestBegin()) { try { sessionStorage.setItem(BEGIN_FRESH_KEY, '1'); } catch { /* ignore */ } }
        sfx(this.ctx, 'ui_open', 0.7);
        this.root.classList.add('leaving');
        setTimeout(() => reloadInto(FIRST_LEVEL), 500);
        return;
      }
    } else if (this.info && this.info.level !== here) {
      // The stored run is on another level than this page (a forced ?level=): reload into it.
      this.resolve = null;
      if (this.info.place !== null) requestContinue();
      sfx(this.ctx, 'ui_open', 0.7);
      this.root.classList.add('leaving');
      setTimeout(() => reloadInto(this.info!.level), 500);
      return;
    }
    this.choice = choice;
    this.resolve = null;
    removeEventListener('keydown', this.keyHandler);
    // Must happen inside the click gesture.
    const unlock = (() => { try { return this.ctx.audio.unlock(); } catch { return Promise.resolve(); } })();
    if (!this.ctx.debug.autostart) this.ctx.input.requestPointerLock();
    sfx(this.ctx, 'ui_open', 0.7);
    this.root.classList.add('leaving');
    setTimeout(() => { this.root.classList.add('hidden'); this.root.classList.remove('show', 'leaving'); }, 950);
    const fg = this.freshGate;
    if (fg) { this.freshGate = null; fg.classList.remove('show'); setTimeout(() => fg.remove(), 600); }
    Promise.resolve(unlock).catch(() => {}).finally(() => r());
  }

  update(dt: number): void {
    if (this.root.classList.contains('hidden')) return;
    this.title.update(dt);
    this.sysAcc += dt;
    if (this.sysAcc >= 1) { this.sysAcc -= 1; this.sysT += 1; this.renderSys(); }
  }
}
