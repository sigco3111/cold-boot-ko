/**
 * Level 5's dialogue (stage 3c §6.2): the FACTS a line's condition may ask and the RULES table — one entry per id in
 * `voice/lines.l5.json` (R3). The channel is the shared one (src/story/stage/dialogue.ts); a rule is evaluated when the
 * line STARTS, never when it is queued. Variants are `else` chains, each with its own rule. `U` lines are pure
 * reactions (a recording, a panel answering a press, a line of a scene / sequence on its own clock); everything that
 * names a place, a sight, a state or an earlier line is `C`.
 *
 * The level-5 lines are not in the shared story DB (src/story/voice.ts reads lines.l1 … l4): this file reads
 * `lines.l5.json` itself (with `label`, `cut`), and base.ts writes the subtitles from it.
 */
import { C, U, type DialogueConfig, type Rules } from '../stage/dialogue';
import type { CommonFacts } from '../stage/base';
import { voiceLine, type VoiceLine } from '../voice';
import type { PhaseId5 } from '../../level/l5/phases';
import l5raw from '../../../voice/lines.l5.json?raw';

export type Line5 = VoiceLine & { label?: string; cut?: number };
/** Level 5's lines with their `label` / `cut`. */
export const LINES5 = new Map<string, Line5>();
try { for (const l of JSON.parse(l5raw) as Line5[]) LINES5.set(l.id, l); } catch (e) { console.error('[story] lines.l5.json did not parse', e); }
export const line5 = (id: string): Line5 | undefined => LINES5.get(id) ?? voiceLine(id);

/** Subtitle label of a level-5 line (ui/subtitles.ts: KESSLER → radio class, SOLDIER / BREKKE → CHOIR's colour). */
export function speaker5(l: Line5 | undefined): string {
  if (!l) return '';
  if (l.label) return l.label;
  switch (l.speaker) {
    case 'kessler': return '케슬러';
    case 'reyes': return '레예스';
    case 'choir': return 'CHOIR';
    case 'soldier': return '해군';
    case 'unit': return '정비 유닛';
    default: return l.speaker.toUpperCase();
  }
}
/** A radio line (the HUD strip is live while one plays). */
export const isRadio5 = (l: Line5 | undefined) => !!l && /^radio\b/.test(String(l.fx ?? ''));

/** The phases in story order (variants rank as their base). */
export const PHASE_ORDER5: PhaseId5[] = ['A', 'B', 'B2', 'C', 'D0', 'D', 'K', 'S', 'V', 'W', 'X'];
export function phaseRank5(p: PhaseId5): number {
  const base = p === 'S_dive' ? 'S' : p === 'V_lock' ? 'V' : p === 'W_lock' ? 'W' : p === 'nostory' ? 'X' : p;
  return PHASE_ORDER5.indexOf(base as PhaseId5);
}

/** The soldier a bark would come from (chosen by the script before the bark is asked). */
export interface Bark5 {
  id: number;
  /** Horizontal distance to the player (m). */
  dist: number;
  /** He has sight of the player now. */
  sees: boolean;
  /** He was hit within the last 3 s. */
  hitRecently: boolean;
  /** Another soldier died ≤ 4 s ago within 20 m of him. */
  felt: boolean;
}

export interface Facts5 extends CommonFacts {
  readonly phase: PhaseId5;
  atLeast(p: PhaseId5): boolean;
  readonly choice: 'stop' | 'command';
  readonly radioOwned: boolean;
  /** 4719 accepted. */
  readonly accepted: boolean;
  acceptedWithin(s: number): boolean;
  /** Within 12 m of the radio on the body, in duty5 or ready5 (both rooms have a camera, S6). */
  readonly nearRadioCam: boolean;
  /** The door beat has started. */
  readonly doorStarted: boolean;
  /** The neck check is pending (the beat runs, not done). */
  readonly checkPending: boolean;
  /** Feet in t5_cmd_line (with the B3 edge tolerance). */
  readonly onLine: boolean;
  readonly inCmd: boolean;
  /** 'away' = yaw within ±50° of −x, 'door' = within ±90° of +x, else 'side' (B3). */
  readonly facing: 'door' | 'away' | 'side';
  readonly doorCalm: boolean;
  readonly spineSpawned: boolean;
  /** A living g5_spine member is in view. */
  readonly waveInSight: boolean;
  /** Seconds `mk5_launch` has been in view within 4 m. */
  readonly launchSeenFor: number;
  doorShotWithin(s: number): boolean;
  readonly bayASpawned: boolean;
  readonly darkBeat: boolean;
  /** No living hostile in tunnel5. */
  readonly tunnelClear: boolean;
  /** Seconds since the last Kessler line ended (∞ when none). */
  readonly kesQuietFor: number;
  readonly subCheckDone: boolean;
  /** Seconds the TERN board has been in view (V). */
  readonly boardSeenFor: number;
  /** An awake hostile within `m` metres (holding soldiers excepted). */
  hostileWithin(m: number): boolean;
  /** The player fired ≥ 15 rounds in the last 8 s without a hit on anything. */
  readonly wastingRounds: boolean;
  /** The player stands in `regions.dark` with the flashlight on. */
  readonly darkWithLight: boolean;
  readonly bark: Bark5 | null;
}

const stop = (F: Facts5) => F.choice === 'stop';
const command = (F: Facts5) => F.choice === 'command';
/** A choice pair: `<base>_stop` / `<base>_command`, each with the shared condition. */
function pair(rules: Rules<Facts5>, base: string, when: (F: Facts5) => boolean, why: string, extra: { once?: boolean; max?: number } = { once: true }): void {
  rules[`${base}_stop`] = C((F) => stop(F) && when(F), `stop; ${why}`, `${base}_command`, extra);
  rules[`${base}_command`] = C((F) => command(F) && when(F), `command; ${why}`, undefined, extra);
}
/** §6.2 bark gate (the speaker's part; the script owns the 20 s spacing and "never over a Kessler scene line"). */
const barkOk = (F: Facts5, range = 15) => !!F.bark && F.bark.sees && F.bark.dist <= range;

export const RULES5: Rules<Facts5> = {
  // ── the cutscene (scene clock, §4.2)
  l5_reyes_c1_1: U('scene T1'), l5_reyes_c1_2: U('scene T2'), l5_reyes_c1_3: U('scene T3'), l5_reyes_c1_4: U('scene T4'),
  l5_sol_c1_2: U('scene T6'), l5_reyes_c1_5: U('scene T9 + 1.0'),
  // ── Kessler: the body squawk, the pickup sequence (a reaction to the take), Q
  l5_kes_squawk_1: U('the body radio squawks (death + 30 s, then every 25 / 40 s, radio not taken)'),
  l5_kes_squawk_2: C((F) => !F.radioOwned && F.nearRadioCam, 'radio not taken; within 12 m of it, in duty5 / ready5 (cameras)', 'l5_kes_squawk_1'),
  l5_kes_1: U('pickup sequence'), l5_kes_2: U('pickup sequence'), l5_kes_3: U('pickup sequence'),
  l5_kes_4: U('pickup sequence (its end = the power cue) / Q before S'),
  l5_kes_5: U('pickup sequence'), l5_kes_6: U('pickup sequence (stopped at its cut)'), l5_kes_7: U('pickup sequence (after CHOIR)'),
  l5_kes_8: U('pickup sequence'),
  l5_kes_9: C((F) => !F.accepted, 'the code not yet accepted', 'l5_kes_9b'),
  l5_kes_9b: C((F) => F.accepted, 'the code already accepted (S2)'),
  l5_kes_brekke: C((F) => F.radioOwned, "the radio was taken from g5_s1's body (true by construction)", undefined, { once: true }),
  l5_reyes_r1: U('pickup sequence'), l5_reyes_r2: U('pickup sequence'),
  l5_kes_ack: U('Q pressed'),
  l5_kes_hint_door: C((F) => F.phase === 'S' || F.phase === 'S_dive', 'Q, phase S'),
  l5_kes_hint_wheel: C((F) => F.phase === 'V' || F.phase === 'V_lock', 'Q, phase V'),
  l5_kes_hint_tunnel: C((F) => F.phase === 'W' || F.phase === 'W_lock', 'Q, phase W'),
  l5_kes_busy: C((F) => F.hostileWithin(25), 'Q while a hostile is awake within 25 m'),
  l5_kes_contact: C((F) => F.spineSpawned && F.room !== 'sub5' && !F.waveInSight, 'g5_spine spawned, player not in sub5, no wave member in sight', undefined, { once: true }),
  l5_kes_names: C((F) => F.heard('l5_choir_names'), 'heard l5_choir_names', undefined, { once: true }),
  l5_kes_boat: C((F) => F.radioOwned && (F.fact('l5_boat') === true || F.launchSeenFor >= 2), 'radio; fact l5_boat, or mk5_launch in view ≤ 4 m for 2 s', undefined, { once: true }),
  // ── the door beat (§4.7, B3)
  l5_kes_door_wait: C((F) => F.inCmd && (F.phase === 'S' || F.phase === 'S_dive') && !F.doorCalm, 'in t5_cmd, phase S, not door-calm', undefined, { cooldown: 20 }),
  l5_kes_door_1: C((F) => F.doorStarted, 'the door beat starts'),
  l5_kes_door_2: U('door beat'),
  l5_kes_door_3: C((F) => F.checkPending && F.onLine && F.facing === 'door', 'check pending, on the line, facing the door', 'l5_kes_door_hold'),
  l5_kes_door_hold: C((F) => F.checkPending && F.onLine && F.facing !== 'door', 'check pending, on the line, not facing the door (B3)'),
  l5_kes_door_3b: C((F) => F.checkPending && F.facing === 'door', 'check pending 8 s after the first line, still facing the door', 'l5_kes_door_hold', { cooldown: 8 }),
  l5_kes_door_away: C((F) => F.checkPending && !F.onLine, 'left t5_cmd_line with the check pending', undefined, { cooldown: 10 }),
  l5_kes_door_4: U('the check done'), l5_kes_door_5: U('door beat'), l5_kes_door_6: U('door beat'),
  l5_kes_door_sunde: U('door beat'), l5_kes_door_7: U('door beat (its start = phase V)'),
  l5_kes_shot: C((F) => F.radioOwned && F.doorShotWithin(3), 'a player bullet hit door5_cmd / the port', undefined, { once: true }),
  l5_kes_dark: C((F) => F.darkBeat, 'beat l5_dark', undefined, { once: true }),
  l5_kes_bay: C((F) => F.bayASpawned, 'g5_bay_a spawned', undefined, { once: true }),
  l5_kes_tunnel: C((F) => F.atLeast('W'), 'phase W (l5_unit_wheel end + 0.4)', undefined, { once: true }),
  l5_kes_end: C((F) => (F.phase === 'X') && F.tunnelClear, 'phase X, 0 hostiles in tunnel5'),
  // ── CHOIR
  l5_choir_radio: U("at l5_kes_6's cut"),
  l5_choir_key: C((F) => F.acceptedWithin(2), 'the code accepted ≤ 2 s ago', undefined, { once: true }),
  l5_choir_names: U('v5_bunk_radio (the vignette is the trigger)'),
  // ── UNIT (machines answering the instant)
  l5_unit_gate: U('the gate latch held'),
  l5_unit_tunnel_co: U('d5_tunnel denied in S', { cooldown: 10 }),
  l5_unit_tunnel_hyd: U('d5_tunnel denied in V', { cooldown: 10 }),
  l5_unit_wheel: U('the wheel + 4.0 s'),
  l5_unit_launch_refused: U('the launch palm refused', { cooldown: 6 }),
};
pair(RULES5, 'l5_sol_c1_1', (F) => F.phase === 'C', 'scene T5', { once: false });
pair(RULES5, 'l5_sol_down', (F) => barkOk(F), 'a soldier leaves hold / first sees the player, sight ≤ 15 m', { max: 2 });
pair(RULES5, 'l5_sol_need', (F) => barkOk(F) && !!F.bark?.hitRecently, 'the speaker was hit in the last 3 s, sight ≤ 15 m', { max: 2 });
pair(RULES5, 'l5_sol_felt', (F) => barkOk(F) && !!F.bark?.felt, 'another soldier died ≤ 4 s ago within 20 m of the speaker, sight', { max: 2 });
pair(RULES5, 'l5_sol_rounds', (F) => barkOk(F) && F.wastingRounds, 'player fired ≥ 15 rounds in 8 s with no hit, sight ≤ 15 m', { max: 2 });
pair(RULES5, 'l5_sol_light', (F) => barkOk(F, 25) && F.darkWithLight, 'player in regions.dark with the flashlight on, sight ≤ 25 m', { max: 2 });
pair(RULES5, 'l5_choir_door', (F) => F.heard('l5_kes_door_7'), 'after l5_kes_door_7');
pair(RULES5, 'l5_choir_sub', (F) => F.kesQuietFor >= 4 && F.room === 'sub5' && F.phase !== 'X' && (F.subCheckDone || (F.atLeast('V') && F.boardSeenFor >= 2)), 'no Kessler for 4 s; in sub5 before X; after v5_sub_check (or the board in view 2 s in V)');
pair(RULES5, 'l5_choir_end', (F) => F.phase === 'X' && F.heard('l5_kes_end'), 'phase X, after l5_kes_end');

export const L5_DIALOGUE: DialogueConfig<Facts5> = {
  rules: RULES5,
  line: line5,
  offStageFx: ['unit', 'recorder', 'pa', 'screen', 'choir', 'radio', 'radio:1'],
};
