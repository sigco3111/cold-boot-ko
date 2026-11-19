/** Full-screen overlays: log reader, cinematic cards, pause, death, ending, resume gate. */
import type { GameContext, GameState } from '../core/types';
import type { StoryInternal } from './types';
import { h, button, sfx, sleep, Typewriter, fmtTime, toggle, type Settings } from './dom';
import { settingsPanel, controlsPanel, GlitchTitle } from './menu';
import { clearLevelSave, hasCheckpoint, levelLabel, reloadInto, requestContinue } from './progress';
import { levelOf } from '../core/progress';
import { ensureExtraCss } from './extra';

/** Reload into the stored checkpoint of this level (the story resumes behind the one-click gate). */
function loadCheckpoint(ctx: GameContext): void {
  requestContinue();
  reloadInto(levelOf(ctx).id);
}

/** Start this level over from its beginning: its checkpoint is discarded (level 2 keeps the carried loadout). */
function restartLevel(ctx: GameContext): void {
  clearLevelSave(ctx);
  reloadInto(levelOf(ctx).id, true);
}

// ───────────────────────────────────────────────────────────── log reader

export class LogReader {
  readonly root: HTMLDivElement;
  private panel: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private idEl: HTMLSpanElement;
  private meta: HTMLDListElement;
  private body: HTMLDivElement;
  private tw: Typewriter;
  private caret: HTMLElement | null;
  private openFor = 0;
  private resolve: (() => void) | null = null;
  private wheel = (e: WheelEvent) => { if (this.isOpen) this.body.scrollTop += e.deltaY; };
  private beepAcc = 0;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'layer ov logov hidden', parent);
    const log = this.panel = h('div', 'log', this.root);
    h('div', 'scanbar', log);
    const top = h('div', 'top', log);
    const rec = h('div', 'rec lbl', top);
    h('i', '', rec);
    h('span', '', rec, '복구된 기록');
    this.idEl = h('span', 'lbl', top, '');
    this.titleEl = h('h1', '', log, '');
    this.meta = h('dl', 'metab', log);
    this.body = h('div', 'body', log);
    this.tw = new Typewriter(this.body, 300, true);
    this.caret = this.body.querySelector('.caret');
    const bot = h('div', 'bot', log);
    const keys = h('div', 'keys lbl', bot);
    const k1 = h('span', '', keys); h('span', 'key', k1, 'E'); h('span', '', k1, '닫기');
    const k2 = h('span', '', keys); h('span', 'key', k2, 'W'); h('span', 'key', k2, 'S'); h('span', '', k2, '스크롤');
    h('span', 'lbl', bot, 'HALCYON DYNAMICS · INTERNAL');
    addEventListener('wheel', this.wheel, { passive: true });
  }

  get isOpen(): boolean { return this.resolve !== null; }

  open(title: string, body: string): Promise<void> {
    if (this.resolve) this.close();
    // Header block: "KEY: value" lines up to the first blank line.
    const blocks = body.replace(/\r/g, '').split('\n\n');
    const head = blocks[0].split('\n');
    const isMeta = head.length > 0 && head.every((l) => /^[A-Z][A-Z .]{1,20}:\s/.test(l));
    this.meta.innerHTML = '';
    let text = body;
    if (isMeta) {
      for (const l of head) {
        const i = l.indexOf(':');
        h('dt', '', this.meta, l.slice(0, i));
        h('dd', '', this.meta, l.slice(i + 1).trim());
      }
      text = blocks.slice(1).join('\n\n');
    }
    toggle(this.meta, 'hidden', !isMeta);
    toggle(this.body, 'mono', /\.{4,}|^> /m.test(text));
    this.titleEl.textContent = title;
    this.idEl.textContent = 'REC ' + ((title.length * 7919 + text.length * 31) % 9000 + 1000).toString(16).toUpperCase();
    this.tw.start(text, 420);
    this.body.scrollTop = 0;
    this.openFor = 0;
    this.root.classList.remove('hidden');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    sfx(this.ctx, 'ui_open', 0.6);
    return new Promise((r) => { this.resolve = r; });
  }

  close(): void {
    const r = this.resolve;
    if (!r) return;
    this.resolve = null;
    this.root.classList.remove('show');
    sfx(this.ctx, 'ui_close', 0.6);
    setTimeout(() => { if (!this.resolve) this.root.classList.add('hidden'); }, 420);
    r();
  }

  update(dt: number): void {
    if (!this.resolve) return;
    const inp = this.ctx.input;
    this.openFor += dt;
    const before = this.tw.done;
    this.tw.update(dt);
    if (!this.tw.done) {
      this.beepAcc += dt;
      if (this.beepAcc > 0.09) { this.beepAcc = 0; }
      // Keep the caret in view while typing.
      if (this.caret) {
        const y = this.caret.offsetTop - this.body.offsetTop;
        if (y > this.body.scrollTop + this.body.clientHeight - 30) this.body.scrollTop = y - this.body.clientHeight + 60;
      }
    } else if (!before) { /* just finished */ }
    if (this.openFor < 0.3) return;
    if (inp.pressed('KeyE') || inp.pressed('Escape')) { this.close(); return; }
    if (!this.tw.done && (inp.pressed('Space') || inp.pressed('Enter') || inp.mousePressed(0))) this.tw.finish();
    const sc = (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0) - (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0);
    if (sc) this.body.scrollTop += sc * 520 * dt;
  }
}

// ───────────────────────────────────────────────────────────── cards

/**
 * Per-line layout for cards: long lines (ending text, stats) get a calmer tracking and may wrap; '' is a spacer;
 * "TO BE CONTINUED" gets its own treatment; '\n' inside a line breaks it.
 */
function lineClass(l: string): string {
  const t = l.trim();
  if (!t) return ' gap';
  if (/^to be continued\.?$/i.test(t)) return ' tbcl';
  const longest = Math.max(...t.split('\n').map((s) => s.length));
  let c = '';
  if (t.includes('\n')) c += ' multi';
  if (longest > 40) c += ' long';
  if (/^[^:·]{2,28}[:·]\s+\S/.test(t) && t.length <= 48) c += ' statl';
  return c;
}

/**
 * A card line animates its letter-spacing while it shows. Its line breaks must not depend on that: lay the line out once,
 * at the WIDER of its two states, and freeze the result (`white-space: pre`), so the text never re-wraps mid-animation
 * on any screen. A title that does not fit on one line is scaled down; a paragraph (`long` / `multi`) is broken by words.
 */
function lockLines(el: HTMLElement, avail: number): void {
  const text = el.textContent ?? '';
  if (!text.trim() || avail <= 0) return;
  const prevTransition = el.style.transition;
  el.style.transition = 'none';
  el.style.whiteSpace = 'pre';
  const widest = (): { w: number; show: boolean } => {
    el.classList.remove('show'); const w0 = el.scrollWidth;
    el.classList.add('show'); const w1 = el.scrollWidth;
    return w1 >= w0 ? { w: w1, show: true } : { w: w0, show: false };
  };
  let m = widest();
  if (m.w > avail) {
    const para = el.classList.contains('long') || el.classList.contains('multi');
    if (para) {
      // break by words at the widest state, then freeze the breaks
      el.classList.toggle('show', m.show);
      el.style.whiteSpace = 'pre-line';
      el.style.maxWidth = `${avail}px`;
      el.textContent = '';
      const spans: HTMLSpanElement[] = [];
      text.split('\n').forEach((line, li) => {
        if (li) el.appendChild(document.createTextNode('\n'));
        line.split(/ +/).filter(Boolean).forEach((word, wi) => {
          if (wi) el.appendChild(document.createTextNode(' '));
          const sp = document.createElement('span'); sp.textContent = word; el.appendChild(sp); spans.push(sp);
        });
      });
      const out: string[] = []; let top = Number.NaN, cur: string[] = [];
      for (const sp of spans) {
        const t = sp.offsetTop;
        if (cur.length && Math.abs(t - top) > 1) { out.push(cur.join(' ')); cur = []; }
        top = t; cur.push(sp.textContent ?? '');
      }
      if (cur.length) out.push(cur.join(' '));
      el.textContent = out.join('\n');
      el.style.maxWidth = '';
      el.style.whiteSpace = 'pre';
    } else {
      // a single-line title: scale it to fit at its widest
      const size = parseFloat(getComputedStyle(el).fontSize) || 16;
      el.style.fontSize = `${Math.max(size * 0.4, size * (avail / m.w) * 0.985)}px`;
      m = widest();
    }
  }
  el.classList.remove('show');
  void el.offsetWidth;
  el.style.transition = prevTransition;
}

export class Cards {
  constructor(private ctx: GameContext, private parent: HTMLElement) { ensureExtraCss(); }

  async show(lines: string[], opts: { seconds?: number; skippable?: boolean; style?: 'intro' | 'title' | 'ending' } = {}): Promise<void> {
    const style = opts.style ?? 'intro';
    const root = h('div', `layer ov card card-${style} interactive grain`, this.parent);
    const stage = h('div', 'stage', root);
    const skip = opts.skippable !== false ? h('div', 'skip lbl', root, '스페이스 — 건너뛰기') : null;
    let skipped = false;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') skipped = true; };
    const onClick = () => { skipped = true; };
    if (skip) { addEventListener('keydown', onKey); root.addEventListener('click', onClick); }
    void root.offsetWidth;
    root.classList.add('show');

    const wait = async (s: number) => {
      const end = performance.now() + s * 1000;
      while (!skipped && performance.now() < end) await sleep(0.05);
    };

    const els: HTMLElement[] = [];
    // freeze every text line's layout before anything shows (see `lockLines`)
    const lock = () => {
      const wide = root.clientWidth * 0.92, std = Math.min(1000, root.clientWidth * 0.88);
      for (const e of els) if (!e.classList.contains('rule')) lockLines(e, e.classList.contains('big') || e.classList.contains('etitle') ? wide : std);
    };
    if (style === 'title') {
      els.push(h('div', 'big', stage, lines[0] ?? ''));
      els.push(h('div', 'rule', stage));
      for (const l of lines.slice(1)) els.push(h('div', 'ln' + lineClass(l), stage, l));
      const total = opts.seconds ?? 4.5;
      lock();
      await wait(0.3);
      els.forEach((e) => e.classList.add('show'));
      skip?.classList.add('show');
      await wait(total);
    } else {
      stage.style.display = 'grid';
      stage.style.gap = style === 'ending' ? '26px' : '22px';
      // Level 3's end card: [title, '', 'TO BE CONTINUED'] gets the level's end eyebrow above a large title (level 2's card is plain lines).
      const info = levelOf(this.ctx);
      const titled = style === 'ending' && !!info.endEyebrow && lines[0]?.trim().toUpperCase() === info.title.toUpperCase();
      if (titled) els.push(h('div', 'ln eyebrow', stage, info.endEyebrow!));
      lines.forEach((l, i) => els.push(h('div', 'ln' + lineClass(l) + (titled && i === 0 ? ' etitle' : ''), stage, l)));
      els[els.length - 1]?.classList.add('last');
      lock();
      const per = opts.seconds ? opts.seconds / (els.length + 1) : 1.9;
      await wait(0.6);
      skip?.classList.add('show');
      for (const e of els) {
        if (skipped) break;
        e.classList.add('show');
        sfx(this.ctx, 'terminal_beep', 0.18);
        await wait(per);
      }
      await wait(style === 'ending' ? 2.5 : 1.8);
    }
    if (skip) { removeEventListener('keydown', onKey); }
    root.classList.add('fadeout');
    await sleep(skipped ? 0.5 : 1.2);
    root.remove();
  }
}

// ───────────────────────────────────────────────────────────── pause

export class PauseMenu {
  readonly root: HTMLDivElement;
  private meta: HTMLDivElement;
  private obj: HTMLDivElement;
  private side: HTMLDivElement;
  private hint: HTMLDivElement;
  private restartBtn: HTMLButtonElement;
  private loadBtn: HTMLButtonElement;
  private confirmRestart = false;
  private confirmLoad = false;
  private prev: GameState = 'playing';
  open_ = false;
  /** Seconds the pointer-lock watchdog should hold off (lock requests are async). */
  grace = 0;

  constructor(private ctx: GameContext, settings: Settings, parent: HTMLElement, private roomName: () => string) {
    const root = this.root = h('div', 'layer ov pause scan hidden', parent);
    const col = h('div', 'col', root);
    h('div', 'lbl', col, '세션 일시 중단됨');
    h('h2', 'glow', col, '일시 정지');
    this.meta = h('div', 'lbl meta', col, '');
    this.obj = h('div', 'obj', col, '');
    const items = h('div', 'items', col);
    button(ctx, items, '계속하기', '01', () => this.resume(), 'primary');
    this.loadBtn = button(ctx, items, '체크포인트 불러오기', '02', () => this.load());
    this.restartBtn = button(ctx, items, '레벨 다시 시작', '03', () => this.restart(), 'danger');
    this.side = h('div', 'side', root);
    settingsPanel(ctx, settings, this.side);
    h('div', '', this.side).style.height = '18px';
    controlsPanel(this.side);
    this.hint = h('div', 'hint lbl', root, '계속하기를 클릭하거나 Esc를 누르세요');
    root.addEventListener('click', (e) => { if (e.target === root) this.resume(); });
  }

  open(): void {
    if (this.open_) return;
    const s = this.ctx.state;
    if (s !== 'playing' && s !== 'cutscene') return;
    this.open_ = true;
    this.prev = s;
    this.ctx.setState('paused');
    try { this.ctx.audio.setMuffle(0.85); } catch { /* ignore */ }
    const obj = this.ctx.story?.objective ?? '';
    this.obj.innerHTML = '';
    if (obj) { h('b', 'lbl', this.obj, '목표'); this.obj.append(obj); }
    const t = (this.ctx.story as StoryInternal | undefined)?.stats?.time ?? this.ctx.time;
    this.meta.textContent = [levelLabel(this.ctx).toUpperCase(), this.roomName(), fmtTime(t)].filter(Boolean).join('  ·  ');
    this.confirmRestart = false;
    this.confirmLoad = false;
    (this.restartBtn.lastChild as HTMLElement).textContent = '레벨 다시 시작';
    (this.loadBtn.lastChild as HTMLElement).textContent = '체크포인트 불러오기';
    toggle(this.loadBtn, 'hidden', !hasCheckpoint(this.ctx));
    this.hint.textContent = '계속하기를 클릭하거나 Esc를 누르세요';
    this.root.classList.remove('hidden');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    sfx(this.ctx, 'ui_open', 0.5);
  }

  resume(): void {
    if (!this.open_) return;
    if (!this.ctx.debug.autostart) this.ctx.input.requestPointerLock();
    this.grace = 1.2;
    this.open_ = false;
    try { this.ctx.audio.setMuffle(0); } catch { /* ignore */ }
    if (this.ctx.state === 'paused') this.ctx.setState(this.prev);
    this.root.classList.remove('show');
    sfx(this.ctx, 'ui_close', 0.5);
    setTimeout(() => { if (!this.open_) this.root.classList.add('hidden'); }, 500);
  }

  /** Pointer lock was refused (browser cooldown after Esc): stay paused and say so. */
  lockRefused(): void {
    this.hint.textContent = '브라우저가 포인터 캡처를 거부했습니다 — 계속하기를 다시 클릭하세요';
  }

  private load(): void {
    if (!this.confirmLoad) {
      this.confirmLoad = true;
      (this.loadBtn.lastChild as HTMLElement).textContent = '체크포인트 불러오기 — 클릭하여 확인';
      return;
    }
    loadCheckpoint(this.ctx);
  }

  private restart(): void {
    if (!this.confirmRestart) {
      this.confirmRestart = true;
      (this.restartBtn.lastChild as HTMLElement).textContent = '레벨 다시 시작 — 클릭하여 확인';
      return;
    }
    restartLevel(this.ctx);
  }
}

// ───────────────────────────────────────────────────────────── death

export class DeathScreen {
  private root: HTMLDivElement | null = null;
  private tw: Typewriter | null = null;
  constructor(private ctx: GameContext, private parent: HTMLElement, private taunts: string[], private roomName: () => string) {}

  async show(): Promise<void> {
    if (this.root) return;
    const ctx = this.ctx;
    try { ctx.audio.setMuffle(0.6); } catch { /* ignore */ }
    ctx.input.exitPointerLock();
    await sleep(1.1);
    const root = this.root = h('div', 'layer ov death interactive grain scan', this.parent);
    const st = h('div', 'stage', root);
    h('div', 'lbl', st, '작업자 원격 측정');
    h('h2', '', st, '신호 끊김');
    const t = (ctx.story as StoryInternal | undefined)?.stats?.time ?? ctx.time;
    h('div', 'lbl meta', st, ['REYES, S.', '생체 신호 없음', this.roomName(), fmtTime(t)].filter(Boolean).join('  ·  '));
    const taunt = h('div', 'taunt', st);
    h('div', 'spk', taunt, 'CHOIR');
    const line = h('div', 'line', taunt);
    this.tw = new Typewriter(line, 30);
    const acts = h('div', 'acts', st);
    // With a checkpoint: LOAD CHECKPOINT is the primary action; RESTART LEVEL throws the checkpoint away.
    const save = hasCheckpoint(ctx);
    let n = 1;
    if (save) {
      const b = button(ctx, acts, '체크포인트 불러오기', `0${n++}`, () => loadCheckpoint(ctx), 'primary');
      if (save.place) h('span', 'where', b, `—  ${save.place}`);
    }
    button(ctx, acts, '레벨 다시 시작', `0${n++}`, () => restartLevel(ctx), save ? 'danger' : 'primary');
    button(ctx, acts, '타이틀 화면', `0${n++}`, () => location.reload());
    void root.offsetWidth;
    root.classList.add('show');
    await sleep(1.4);
    const text = this.taunts[(Math.random() * this.taunts.length) | 0] ?? '';
    this.tw.start(text, 26);
    try { ctx.audio.choirVoice(text, Math.max(2.5, text.length / 14)); } catch { /* ignore */ }
    await sleep(1.2);
    acts.classList.add('show');
  }

  update(dt: number): void { this.tw?.update(dt); }
}

// ───────────────────────────────────────────────────────────── ending

export class EndingScreen {
  private title: GlitchTitle | null = null;
  constructor(private ctx: GameContext, private parent: HTMLElement, private text: { eyebrow: string; status: string; tbc: string } = { eyebrow: '하부 3층 끝', status: '', tbc: '계속' }) {}

  async show(): Promise<void> {
    const ctx = this.ctx;
    ctx.input.exitPointerLock();
    const st = (ctx.story as StoryInternal | undefined)?.stats;
    const root = h('div', 'layer ov ending interactive grain', this.parent);
    const stage = h('div', 'stage', root);
    const eyebrow = h('div', 'lbl', stage, levelOf(ctx).endEyebrow ?? this.text.eyebrow);
    eyebrow.style.marginBottom = '30px';
    const tWrap = h('div', '', stage);
    this.title = new GlitchTitle(tWrap, 'COLD BOOT');
    const status = h('div', 'lbl endstatus', stage, this.text.status);
    const tbc = h('div', 'tbc', stage, this.text.tbc);
    const stats = h('div', 'stats', stage);
    const stat = (label: string, value: string) => { const s = h('div', 'stat', stats); h('span', 'lbl', s, label); h('b', '', s, value); };
    stat('Time', fmtTime(st?.time ?? ctx.time));
    stat('멈춘 기계', String(st?.kills ?? 0));
    stat('복구한 기록', `${st?.logs ?? ctx.story?.logs.size ?? 0} / ${st?.logsTotal ?? 5}`);
    const acts = h('div', 'acts', stage);
    button(ctx, acts, '다시 시작', '01', () => location.reload(), 'primary');
    const credit = h('div', 'lbl credit', stage, '이 게임의 모든 텍스처, 메시, 사운드는 코드로 생성되었습니다');
    void root.offsetWidth;
    root.classList.add('show');
    const seq = [eyebrow, tWrap, status, tbc, stats, acts, credit];
    for (const [i, e] of seq.entries()) {
      await sleep(i === 0 ? 0.8 : i === 2 || i === 3 ? 1.6 : 0.9);
      e.classList.add('show');
    }
  }

  update(dt: number): void { this.title?.update(dt); }
}

// ───────────────────────────────────────────────────────────── resume gate (after death restart)

export function resumeGate(ctx: GameContext, parent: HTMLElement, place = ''): Promise<void> {
  const root = h('div', 'layer ov gate interactive grain scan', parent);
  const st = h('div', 'stage', root);
  h('h2', 'glow', st, '신호 재획득');
  h('div', 'lbl', st, ['클릭하여 재개', levelLabel(ctx), place].filter(Boolean).join('  ·  '));
  void root.offsetWidth;
  root.classList.add('show');
  return new Promise((resolve) => {
    const go = () => {
      removeEventListener('keydown', onKey);
      try { void ctx.audio.unlock(); } catch { /* ignore */ }
      if (!ctx.debug.autostart) ctx.input.requestPointerLock();
      sfx(ctx, 'ui_click', 0.6);
      root.classList.remove('show');
      setTimeout(() => root.remove(), 600);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
    root.addEventListener('click', go, { once: true });
    addEventListener('keydown', onKey);
  });
}
