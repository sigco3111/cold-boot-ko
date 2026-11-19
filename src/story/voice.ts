/**
 * Spoken lines (REVISION 4). The text lives in `voice/lines.l1.json` / `voice/lines.l2.json` (the story
 * owns it; the voice tool generates one audio file per id). At run time a line is played with
 * `ctx.audio.say(id)`; the subtitle text comes from the same JSON and its duration from the handle
 * (manifest). Builds whose audio module has no `say` yet fall back to the old behaviour: subtitle with
 * an estimated duration, plus the synthesised `choirVoice` for CHOIR.
 */
import type * as THREE from 'three';
import type { GameContext, VoiceHandle } from '../core/types';
import l1raw from '../../voice/lines.l1.json?raw';
import l2raw from '../../voice/lines.l2.json?raw';
import l3raw from '../../voice/lines.l3.json?raw';
import l4raw from '../../voice/lines.l4.json?raw';

export interface VoiceLine {
  id: string;
  speaker: string;
  text: string;
  spoken?: string;
  note?: string;
  fx?: string;
}

const DB = new Map<string, VoiceLine>();
for (const raw of [l1raw, l2raw, l3raw, l4raw]) {
  try { for (const l of JSON.parse(raw) as VoiceLine[]) DB.set(l.id, l); } catch (e) { console.error('[story] voice lines did not parse', e); }
}

/** Recorded durations (voice/manifest.json), for scenes that schedule lines on a clock (stage 3a C2). */
const DURATIONS = new Map<string, number>();
// (the same module the audio system bundles: import.meta.glob of the one manifest, no second copy)
const MANIFEST = import.meta.glob('../../voice/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>;
try {
  const m = (Object.values(MANIFEST)[0] ?? {}) as { lines?: Record<string, { duration?: number; lead?: number }> };
  // (what is heard: the file less its lead-in, which the audio skips — src/audio/voice.ts)
  for (const [id, e] of Object.entries(m.lines ?? {})) if (Number.isFinite(e?.duration)) DURATIONS.set(id, Number(e.duration) - Math.max(0, Math.min(2, Number(e.lead) || 0)));
} catch (e) { console.error('[story] voice manifest did not parse', e); }

export function voiceLine(id: string): VoiceLine | undefined { return DB.get(id); }
/** Expected length of a line (s): the recording's, else the reading-time estimate. */
export function lineDuration(id: string): number {
  const d = DURATIONS.get(id);
  if (d !== undefined && d > 0.2) return d;
  const l = DB.get(id);
  return estimateDuration(l?.spoken ?? l?.text ?? '');
}
export function voiceIds(prefix: string): string[] { return [...DB.keys()].filter((k) => k.startsWith(prefix)); }

/** Reading time when no recording tells us better. */
export function estimateDuration(text: string): number {
  const words = text.replace(/—/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;
  return Math.max(1.4, 0.7 + words * 0.36);
}

const NAMES: Record<string, string> = { choir: 'CHOIR', tomas: '토마스', hale: 'D. 헤일', unit: '정비 유닛', halvorsen: '할보센', reyes: '레예스', resident: '거주자', sunde: 'A. 순데 박사' };

/** Subtitle speaker label for a line (a unit speaking with a staff voice is still a unit). */
export function speakerName(l: VoiceLine): string {
  if (l.fx === 'unit') return '정비 유닛';
  return NAMES[l.speaker] ?? l.speaker.toUpperCase();
}

export interface SpeakOpts {
  /** Subtitle speaker label (default from the line's speaker). */
  name?: string;
  position?: THREE.Vector3;
  volume?: number;
  /** false: sound only. */
  subtitle?: boolean;
  /** Duration to assume when there is no recording / no `say`. */
  fallbackDuration?: number;
}

export interface Spoken { duration: number; handle: VoiceHandle | null; text: string }

export function hasSay(ctx: GameContext): boolean {
  return typeof (ctx.audio as unknown as { say?: unknown })?.say === 'function';
}

/** Play one line: recorded voice (when available) + subtitle. Never throws. */
export function speak(ctx: GameContext, id: string, opts: SpeakOpts = {}): Spoken {
  const l = DB.get(id);
  const text = l?.text ?? '';
  let duration = opts.fallbackDuration ?? estimateDuration(l?.spoken ?? text);
  let handle: VoiceHandle | null = null;
  if (hasSay(ctx)) {
    try {
      handle = ctx.audio.say(id, { position: opts.position, volume: opts.volume });
      if (handle && Number.isFinite(handle.duration) && handle.duration > 0.2) duration = handle.duration;
    } catch (e) { console.warn(`[story] say ${id} failed`, e); handle = null; }
  } else if (l?.speaker === 'choir') {
    try { ctx.audio.choirVoice(text, duration); } catch { /* ignore */ }
  }
  if (opts.subtitle !== false && text) {
    ctx.events.emit('story:subtitle', { speaker: opts.name ?? (l ? speakerName(l) : ''), text, duration: duration + 0.25 });
  }
  return { duration, handle, text };
}

export function preload(ctx: GameContext, idsOrPrefixes: string[]): void {
  try {
    const a = ctx.audio as unknown as { preloadVoice?: (ids: string[]) => Promise<void> };
    if (typeof a.preloadVoice === 'function') void a.preloadVoice(idsOrPrefixes).catch(() => undefined);
  } catch { /* ignore */ }
}
