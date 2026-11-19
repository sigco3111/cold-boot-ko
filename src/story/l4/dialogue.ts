/**
 * Level 4's dialogue (stage 3b §6.2): the FACTS a line's condition may ask and the RULES table — one entry per id in
 * `voice/lines.l4.json` (R3). The channel is the shared one (src/story/stage/dialogue.ts); a rule is evaluated when the
 * line STARTS, never when it is queued. Variants are `else` chains, each with its own rule. `U` lines are pure
 * reactions (a recording, a panel answering a press); everything that names a place, a sight or an earlier line is `C`.
 */
import { C, U, type DialogueConfig, type Rules } from '../stage/dialogue';
import type { CommonFacts } from '../stage/base';
import { voiceLine, type VoiceLine } from '../voice';
import type { PhaseId4 } from '../../level/l4/phases';
import l4raw from '../../../voice/lines.l4.json?raw';

/** Level 4's lines with their `cut` (the shared story DB, src/story/voice.ts, holds the same lines without it). */
export const LINES4 = new Map<string, VoiceLine & { cut?: number }>();
try { for (const l of JSON.parse(l4raw) as (VoiceLine & { cut?: number })[]) LINES4.set(l.id, l); } catch (e) { console.error('[story] lines.l4.json did not parse', e); }
export const line4 = (id: string): (VoiceLine & { cut?: number }) | undefined => LINES4.get(id) ?? voiceLine(id);

/** Subtitle label of a level-4 line. */
export function speaker4(l: VoiceLine | undefined): string {
  if (!l) return '';
  if (l.speaker === 'sunde') return 'A. 순데 박사';
  if (l.speaker === 'choir') return 'CHOIR';
  if (l.fx === 'pa') return '수술실 1';
  return '정비 유닛';
}

/** The phases in story order. Script-only variants rank as their base phase. */
export const PHASE_ORDER4: PhaseId4[] = ['A', 'B', 'S', 'C', 'D', 'D2', 'E', 'F', 'G'];
export function phaseRank4(p: PhaseId4): number {
  const base = p === 'D_bay' || p === 'D_store' ? 'D' : p === 'F_open' ? 'E' : p === 'nostory' ? 'G' : p;
  return PHASE_ORDER4.indexOf(base as PhaseId4);
}

export interface Facts4 extends CommonFacts {
  readonly phase: PhaseId4;
  atLeast(p: PhaseId4): boolean;
  readonly choice: 'stop' | 'command';
  /** Feet in the theatre gallery (t4_gallery). */
  readonly inGallery: boolean;
  /** The arm's cue right now ('' without an arm). */
  readonly armCue: string;
  /** Seconds until the arm's next `approach` cue (∞ without an arm). */
  readonly toApproach: number;
  /** Seconds since the clean side opened (phase C; −1 before). */
  readonly cleanFor: number;
  /** Seconds a Deck-2 body (not Dahl) has been in view within 3 m without a break. */
  readonly bodySeenFor: number;
  /** Seconds the Node 2 window has been in view within 6 m without a break. */
  readonly node2SeenFor: number;
  /** Seconds the roster screen has been in view within 6 m without a break. */
  readonly rosterSeenFor: number;
  /** A pane of `mk4_glass` was hit within `s` seconds. */
  glassHitWithin(s: number): boolean;
  /** The carbine was taken within `s` seconds and is owned. */
  carbineWithin(s: number): boolean;
  /** Seconds the equalising has been running (−1 when not running). */
  readonly equalisingFor: number;
  /** The tube fight (F6) has started. */
  readonly tubeFight: boolean;
}

const stop = (F: Facts4) => F.choice === 'stop';
const command = (F: Facts4) => F.choice === 'command';
/** A choice pair: `<base>_stop` / `<base>_command`, each with the shared condition. */
function pair(rules: Rules<Facts4>, base: string, when: (F: Facts4) => boolean, why: string): void {
  rules[`${base}_stop`] = C((F) => stop(F) && when(F), `stop; ${why}`, `${base}_command`, { once: true });
  rules[`${base}_command`] = C((F) => command(F) && when(F), `command; ${why}`, undefined, { once: true });
}

export const RULES4: Rules<Facts4> = {
  // ── machines answering what the player did this instant
  l4_unit_decon: U('decon start (the lock reacts to the arrival)'),
  l4_unit_shower: U('the shower latch held'),
  l4_unit_clean: U('d4_shower_in denied, phase ≥ C', { cooldown: 10 }),
  l4_unit_hold: U('d4_surg denied in phase C', { cooldown: 10 }),
  l4_unit_cold_ack: U('cold_ack pressed in phase C, inside the cold store'),
  l4_unit_release_refused: U('booth_release pressed, not equalised', { cooldown: 6 }),
  l4_unit_equalise: U('valve4 pulled (first)', { once: true }),
  l4_unit_equalised: U('the equalising clock ran out', { once: true }),
  l4_unit_release: U('booth_release pressed, equalised (first)', { once: true }),
  l4_unit_tube_denied: U('d4_tube_n denied in D / D2', { cooldown: 10 }),
  l4_unit_gatelock: U('d4_tube_s denied, phase ≤ E', { cooldown: 10 }),
  l4_unit_gate: U('the end: latched in the gate lock, 0 hostiles inside'),
  // ── the gallery announcer (on the arm's cues; the loop never waits)
  l4_unit_theatre_0: C((F) => F.inGallery && F.toApproach > 3, 'first frame in the gallery, the cycle not within 3 s before approach', undefined, { once: true }),
  l4_unit_theatre_1: C((F) => F.inGallery && F.armCue === 'approach', 'in the gallery, cue approach', undefined, { once: true }),
  l4_unit_theatre_2: C((F) => F.inGallery && F.armCue === 'fail', 'in the gallery, cue fail', undefined, { once: true }),
  l4_unit_theatre_3: C((F) => F.inGallery && F.armCue === 'regel' && F.heard('l4_unit_theatre_2'), 'in the gallery, cue regel, heard theatre_2', undefined, { once: true }),
  // ── Sunde's log (a recording: unconditional, played only by the player's press)
  l4_sunde_1: U('the video log (a recording)'), l4_sunde_2: U('the video log'), l4_sunde_3: U('the video log'),
  l4_sunde_4: U('the video log'), l4_sunde_5: U('the video log'), l4_sunde_6: U('the video log'),
  l4_sunde_7: U('the video log'), l4_sunde_8: U('the video log'), l4_sunde_9: U('the video log (stopped at its cut)'),
};
pair(RULES4, 'l4_choir_enter', (F) => F.atLeast('B') && (F.room === 'lock4' || F.room === 'gown'), 'phase ≥ B, in the lock or gowning');
pair(RULES4, 'l4_choir_bodies', (F) => F.phase === 'C' && F.cleanFor >= 5 && F.bodySeenFor >= 1, 'phase C for 5 s, a Deck-2 body (not Dahl) in view within 3 m for 1 s');
pair(RULES4, 'l4_choir_node2', (F) => F.atLeast('C') && F.node2SeenFor >= 1.5, 'the Node 2 window in view within 6 m for 1.5 s');
pair(RULES4, 'l4_choir_hold', (F) => F.atLeast('D') && F.heard('l4_unit_cold_ack'), 'phase ≥ D, heard the cold-store acknowledgement');
pair(RULES4, 'l4_choir_theatre', (F) => F.inGallery && F.heard('l4_unit_theatre_3'), 'in the gallery, heard theatre_3');
pair(RULES4, 'l4_choir_glass', (F) => F.atLeast('C') && F.glassHitWithin(2), 'phase ≥ C, a watched pane hit within 2 s');
pair(RULES4, 'l4_choir_armoury', (F) => F.carbineWithin(3) && F.room === 'chk', 'the carbine taken within 3 s, in the checkpoint');
pair(RULES4, 'l4_choir_roster', (F) => F.readWithin('term4_ctrl', 10) || F.rosterSeenFor >= 3, 'read the roster terminal within 10 s, or the roster screen in view within 6 m for 3 s');
pair(RULES4, 'l4_choir_pumps', (F) => F.equalisingFor >= 8, 'equalising running ≥ 8 s');
pair(RULES4, 'l4_choir_tube', (F) => F.inTrigger('t4_tube_0') && F.phase === 'E' && !F.tubeFight, 't4_tube_0, phase E, the tube fight not started');
pair(RULES4, 'l4_choir_end', (F) => F.phase === 'G' && F.hostilesWhere('gatel') === 0, 'phase G, 0 hostiles in the gate lock');

export const L4_DIALOGUE: DialogueConfig<Facts4> = {
  rules: RULES4,
  line: line4,
  offStageFx: ['unit', 'recorder', 'pa', 'screen', 'choir'],
};
