/**
 * Subtitles: speaker label + typewriter line. CHOIR lines get a distinct glitchy cyan treatment;
 * speaker 'PA' is CHOIR over the public-address system: a chime icon, calmer, no glitching.
 *
 * REVISION 4 (live dialogue): each speaker has its own label colour (TOMAS warm, CHOIR cyan, units / staff
 * through units pale red, recorder grey). On level 2 a line from a different speaker stacks under the
 * previous one for a moment (rapid back-and-forth stays readable), then the older one fades. While Tomas is
 * on the intercom a small "live" indicator sits above the vitals: LINE CONTROL — CH 3.
 */
import type { GameContext, LevelInfo } from '../core/types';
import { levelOf } from '../core/progress';
import { h, setText, toggle, Typewriter, glyph, svg } from './dom';

type Kind = 'choir' | 'pa' | 'tomas' | 'unit' | 'rec' | 'radio' | 'phone' | '';

/** Seconds an older line stays once a new speaker has taken over. */
const OLD_HOLD = 1.6;

function classify(speaker: string, style: LevelInfo['subtitles']): Kind {
  const s = speaker.trim().toUpperCase();
  if (/^PA$/.test(s)) return 'pa';
  if (/^CHOIR\b/.test(s)) return 'choir';
  // level 5: CHOIR speaking through a soldier keeps CHOIR's colour (the label stays the soldier's: SOLDIER / BREKKE)
  if (/^(해군|브레케)\b/.test(s)) return 'choir';
  // level 5: Kessler on the handset (CHOIR on the radio keeps the CHOIR class above)
  if (/^케슬러|^RADIO\b/.test(s)) return 'radio';
  // level 6: Aas on the sound-powered handset (fx 'phone'): pale grey, small
  if (/^아스 중위|^HANDSET\b/.test(s)) return 'phone';
  if (style === 'single') return ''; // level 1 keeps its original look for every other speaker
  if (/토마스|INTERCOM|LINE CONTROL|HEADSET/.test(s)) return 'tomas';
  if (/RECORD|헤일|TAPE|LOG\b|VOICE MEMO/.test(s)) return 'rec';
  if (/유닛|포먼|보스|아난드|오카포|허스크|직원/.test(s)) return 'unit';
  return '';
}

/** Tomas's lines come over the booth intercom unless the speaker label says otherwise. */
function onIntercom(speaker: string): boolean {
  const s = speaker.toUpperCase();
  return /토마스|INTERCOM|LINE CONTROL|HEADSET/.test(s) && !/GLASS|MUFFLED|유닛|UNIT|THROUGH|CARRIED/.test(s);
}

class Entry {
  readonly root: HTMLDivElement;
  readonly spk: HTMLDivElement;
  readonly spkName: HTMLSpanElement;
  readonly line: HTMLDivElement;
  readonly tw: Typewriter;
  readonly waveBars: HTMLElement[] = [];
  speaker = '';
  kind: Kind = '';
  intercom = false;
  left = 0;
  old = false;
  dying = false;
  joltLeft = 0;
  glitchLeft = 0;
  glitchIdx = -1;

  constructor(parent: HTMLElement) {
    this.root = h('div', 'sub', parent);
    this.spk = h('div', 'spk', this.root);
    const wave = h('span', 'wave', this.spk);
    for (let i = 0; i < 7; i++) this.waveBars.push(h('i', '', wave));
    // PA chime icon: a small horn with two sound arcs.
    const chime = h('span', 'chime', this.spk);
    svg('0 0 22 14', ['M1 5 H4 L9 1.5 V12.5 L4 9 H1 Z', 'M12.5 4.2 C14 5.6 14 8.4 12.5 9.8', 'M15.5 2 C18.6 4.8 18.6 9.2 15.5 12'], chime);
    this.spkName = h('span', '', this.spk, '');
    this.line = h('div', 'line', this.root);
    this.tw = new Typewriter(this.line, 42);
  }

  set(speaker: string, text: string, duration: number, kind: Kind): void {
    this.speaker = speaker;
    this.kind = kind;
    this.intercom = kind === 'tomas' && onIntercom(speaker);
    const r = this.root;
    for (const k of ['choir', 'pa', 'tomas', 'unit', 'rec', 'radio', 'phone'] as const) toggle(r, k, kind === k);
    setText(this.spkName, kind === 'pa' ? 'CHOIR · 공용 방송' : speaker.toUpperCase());
    toggle(this.spk, 'hidden', !speaker);
    // Reveal so the whole line is readable for at least ~45% of its time on screen.
    const cps = Math.max(28, Math.min(70, text.length / Math.max(0.6, duration * 0.55)));
    this.glitchIdx = -1;
    this.glitchLeft = 0;
    this.tw.start(text, cps);
    this.left = Math.max(1.5, duration) + 0.6;
  }

  restoreLine(): void {
    const shown = this.line.firstChild as HTMLElement | null;
    if (shown) shown.textContent = this.tw.text;
  }
}

export class Subtitles {
  readonly root: HTMLDivElement;
  private entries: Entry[] = [];
  private icom: HTMLDivElement;
  private icomBars: HTMLElement[] = [];
  private icomOn = false;
  private icomHold = 0;
  /** Story override for the intercom indicator: null = automatic (Tomas's lines). */
  intercomForced: boolean | null = null;
  /** True while a note card is open: only the newest line is kept (the note sits just above). */
  compact = false;

  constructor(private ctx: GameContext, parent: HTMLElement) {
    this.root = h('div', 'subs', parent);
    // Intercom "live" tag: above the vitals, out of the way of objective / toast / prompt / subtitles.
    this.icom = h('div', 'icom', parent);
    const ic = h('span', 'ic', this.icom);
    svg('0 0 16 16', ['M8 1.5 a2.2 2.2 0 0 1 2.2 2.2 v4 a2.2 2.2 0 0 1 -4.4 0 v-4 A2.2 2.2 0 0 1 8 1.5 Z', 'M3.6 7.4 a4.4 4.4 0 0 0 8.8 0', 'M8 11.8 V14.5', 'M5.4 14.5 H10.6'], ic);
    h('i', 'live', this.icom);
    h('span', 'lbl', this.icom, '라인 관제  —  채널 3');
    const bars = h('span', 'bars', this.icom);
    for (let i = 0; i < 5; i++) this.icomBars.push(h('i', '', bars));
    ctx.events.on('story:subtitle', (e) => this.show(e.speaker ?? '', e.text ?? '', e.duration ?? 3));
  }

  show(speaker: string, text: string, duration: number): void {
    const style = levelOf(this.ctx).subtitles;
    const kind = classify(speaker, style);
    const live = this.entries.filter((e) => !e.dying);
    const newest = live[live.length - 1];
    let e: Entry;
    if (newest && (newest.speaker === speaker || style === 'single')) {
      // Same speaker continuing (or level 1: one line at a time, as it always was): replace in place.
      e = newest;
    } else {
      // A new voice: the previous line moves up, dims, and leaves shortly.
      for (const o of live) {
        o.old = true;
        o.root.classList.add('old');
        o.left = Math.min(o.left, OLD_HOLD);
        o.tw.finish();
      }
      // At most two lines on screen.
      const keep = this.compact ? 0 : 1;
      while (live.length > keep) this.retire(live.shift()!);
      e = new Entry(this.root);
      this.entries.push(e);
    }
    e.set(speaker, text, duration, kind);
    e.root.classList.remove('old', 'out');
    e.old = false;
    void e.root.offsetWidth;
    e.root.classList.add('show');
  }

  private retire(e: Entry): void {
    if (e.dying) return;
    e.dying = true;
    e.root.classList.remove('show');
    e.root.classList.add('out');
    setTimeout(() => {
      e.root.remove();
      const i = this.entries.indexOf(e);
      if (i >= 0) this.entries.splice(i, 1);
    }, 450);
  }

  update(dt: number): void {
    const st = this.ctx.state;
    const visibleState = st === 'playing' || st === 'cutscene' || st === 'paused';
    // Subtitles never time out while the game is paused.
    const ticking = st === 'playing' || st === 'cutscene';
    let talkingIntercom = false;
    if (this.compact) {
      const live = this.entries.filter((x) => !x.dying);
      for (let i = 0; i < live.length - 1; i++) this.retire(live[i]);
    }
    for (const e of this.entries) {
      if (e.dying) continue;
      if (ticking) e.left -= dt;
      const on = visibleState && e.left > 0.4;
      toggle(e.root, 'show', on);
      e.tw.update(dt);
      if (e.intercom && e.left > 0.4) talkingIntercom = true;
      if (e.kind === 'choir') this.animateChoir(e, dt);
    }
    // Drop finished older lines (the newest stays in the DOM to be reused).
    const live = this.entries.filter((x) => !x.dying);
    for (let i = 0; i < live.length - 1; i++) if (live[i].left <= 0) this.retire(live[i]);

    // Intercom indicator.
    const want = this.intercomForced ?? talkingIntercom;
    if (want) this.icomHold = 0.5;
    else if (this.icomHold > 0) this.icomHold -= dt;
    const icom = visibleState && (want || this.icomHold > 0);
    if (icom !== this.icomOn) { this.icomOn = icom; toggle(this.icom, 'show', icom); }
    if (icom) {
      const t = performance.now() / 1000;
      for (let i = 0; i < this.icomBars.length; i++) {
        const a = want ? 0.25 + Math.abs(Math.sin(t * (9 + i * 2.3) + i * 1.7)) * (0.55 + 0.45 * Math.sin(t * 2.7 + i)) : 0.15;
        this.icomBars[i].style.transform = `scaleY(${Math.max(0.15, a).toFixed(2)})`;
      }
    }
  }

  private animateChoir(e: Entry, dt: number): void {
    // Waveform bars: cheap transform-only animation.
    const t = performance.now() / 1000;
    const talking = !e.tw.done || e.left > 1;
    for (let i = 0; i < e.waveBars.length; i++) {
      const a = talking ? 0.35 + Math.abs(Math.sin(t * (7 + i * 1.7) + i * 1.3)) * (0.65 + 0.35 * Math.sin(t * 3.1 + i)) : 0.3;
      e.waveBars[i].style.transform = `scaleY(${(a * 3).toFixed(2)})`;
    }
    // Occasional jolt + single-glyph corruption.
    if ((e.joltLeft -= dt) <= 0) {
      e.joltLeft = 0.6 + Math.random() * 1.8;
      e.root.classList.add('jolt');
      setTimeout(() => e.root.classList.remove('jolt'), 70 + Math.random() * 60);
    }
    if (e.glitchLeft > 0) {
      if ((e.glitchLeft -= dt) <= 0 && e.glitchIdx >= 0) { e.glitchIdx = -1; e.tw.finish(); e.restoreLine(); }
    } else if (e.tw.done && Math.random() < dt * 1.2) {
      const txt = e.tw.text;
      const i = (Math.random() * txt.length) | 0;
      if (txt[i] && txt[i] !== ' ') {
        e.glitchIdx = i;
        e.glitchLeft = 0.09;
        const shown = e.line.firstChild as HTMLElement | null;
        if (shown) shown.textContent = txt.slice(0, i) + glyph() + txt.slice(i + 1);
      }
    }
  }
}
